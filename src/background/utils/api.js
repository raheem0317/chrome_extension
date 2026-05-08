/**
 * OpenRouter API Utility — runs ONLY in background.js (service worker)
 * Never imported by popup.js or content.js
 * 
 * Architecture: popup.js → background.js → OpenRouter API → content.js
 * API key NEVER leaves the background context.
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const OPENROUTER_CONFIG = {
  BASE_URL: 'https://openrouter.ai/api/v1/chat/completions',
  MODELS: [
    'openai/gpt-4o-mini',
    'anthropic/claude-3.5-sonnet',
    'meta-llama/llama-3.3-70b-instruct'
  ],
  MAX_RETRIES: 3,
  TIMEOUT_MS: 45_000,
  TEMPERATURE: 0.1,
  MAX_TOKENS: 2048,
  RETRY_BASE_DELAY_MS: 1000
};

// ─── JSON Extraction & Recovery ───────────────────────────────────────────────

/**
 * Attempt to extract valid JSON from a potentially malformed AI response.
 * Handles: raw JSON, markdown code blocks, trailing text, partial garbage.
 */
function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') {
    console.warn('[OpenRouter] extractJSON: input is empty or not a string');
    return '';
  }

  // Step 1: Strip markdown code fences
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    console.log('[OpenRouter] Extracted JSON from code block');
    return codeBlockMatch[1].trim();
  }

  // Step 2: Find the outermost { ... } pair
  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    console.log('[OpenRouter] Extracted JSON from brace boundaries');
    return raw.slice(braceStart, braceEnd + 1).trim();
  }

  // Step 3: Return trimmed raw as last resort
  console.warn('[OpenRouter] No JSON structure found, returning raw trimmed');
  return raw.trim();
}

/**
 * Clean up common AI response quirks that break JSON.parse:
 * - Trailing commas before } or ]
 * - Single quotes instead of double quotes (simple cases)
 * - Unescaped newlines inside string values
 */
function cleanupJSON(jsonStr) {
  let cleaned = jsonStr;

  // Remove trailing commas: ,} or ,]
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  // Replace single-quoted keys/values with double quotes (naive but effective for AI output)
  // Only if the string doesn't already use double quotes extensively
  const doubleQuoteCount = (cleaned.match(/"/g) || []).length;
  const singleQuoteCount = (cleaned.match(/'/g) || []).length;
  if (singleQuoteCount > doubleQuoteCount) {
    cleaned = cleaned.replace(/'/g, '"');
    console.log('[OpenRouter] Replaced single quotes with double quotes');
  }

  return cleaned;
}

/**
 * Parse field mapping from raw AI response with multi-stage recovery.
 * Returns a plain object or throws.
 */
function parseMapping(raw) {
  console.log('[AI] Parsing AI response, length:', raw?.length);

  // Stage 1: Direct parse
  const jsonStr = extractJSON(raw);
  if (!jsonStr) throw new Error('No JSON content found in AI response');

  try {
    const parsed = JSON.parse(jsonStr);
    if (validateMappingObject(parsed)) {
      console.log('[AI] Stage 1: Direct parse succeeded');
      return parsed;
    }
  } catch (e) {
    console.warn('[AI] Stage 1 failed:', e.message);
  }

  // Stage 2: Cleanup + parse
  try {
    const cleaned = cleanupJSON(jsonStr);
    const parsed = JSON.parse(cleaned);
    if (validateMappingObject(parsed)) {
      console.log('[AI] Stage 2: Cleanup parse succeeded');
      return parsed;
    }
  } catch (e) {
    console.warn('[AI] Stage 2 failed:', e.message);
  }

  // Stage 3: Aggressive extraction — find any valid JSON object in the string
  try {
    const allObjects = raw.match(/\{[^{}]*\}/g) || [];
    for (const candidate of allObjects) {
      try {
        const parsed = JSON.parse(candidate);
        if (validateMappingObject(parsed)) {
          console.log('[AI] Stage 3: Aggressive extraction succeeded');
          return parsed;
        }
      } catch (_) { /* try next candidate */ }
    }
  } catch (e) {
    console.warn('[AI] Stage 3 failed:', e.message);
  }

  throw new Error('All JSON parsing strategies failed. Raw response: ' + raw.slice(0, 200));
}

/**
 * Validate that the parsed object is a valid field mapping.
 * Must be a non-null, non-array plain object with string or null values.
 */
function validateMappingObject(obj) {
  if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) {
    console.warn('[AI] Validation: not a plain object');
    return false;
  }

  const entries = Object.entries(obj);
  if (entries.length === 0) {
    console.warn('[AI] Validation: empty object');
    return false;
  }

  // All values must be strings or null
  for (const [key, value] of entries) {
    if (value !== null && typeof value !== 'string') {
      console.warn(`[AI] Validation: value for "${key}" is ${typeof value}, expected string or null`);
      return false;
    }
  }

  console.log(`[AI] Validation passed: ${entries.length} field mappings`);
  return true;
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildPrompt(fields, profile) {
  const fieldLines = fields.map((f, i) => [
    `Field ${i}:`,
    `  id: ${f.id}`,
    `  type: ${f.type}`,
    `  name: ${f.name || 'N/A'}`,
    `  label: ${f.label || 'N/A'}`,
    `  placeholder: ${f.placeholder || 'N/A'}`,
    `  required: ${f.required}`,
    f.nearbyText ? `  nearby_text: ${f.nearbyText}` : null
  ].filter(Boolean).join('\n')).join('\n');

  const profileLines = Object.entries(profile)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  return `You are a form-filling assistant. Your ONLY job is to map form fields to user profile values.

RULES:
1. Return ONLY a valid JSON object. Nothing else.
2. Keys are the field "id" values exactly as given.
3. Values are the matching profile data, or null if no match.
4. Do NOT wrap in markdown code blocks.
5. Do NOT add explanations, comments, or extra text.
6. Do NOT return arrays — only a flat JSON object.

USER PROFILE:
${profileLines || '  (empty)'}

FORM FIELDS:
${fieldLines}

RESPOND WITH ONLY THE JSON OBJECT. Example format:
{"id:email|name:email|type:email": "alice@example.com", "id:name|name:name|type:text": "Alice Smith"}`;
}

// ─── HTTP Request with Timeout ────────────────────────────────────────────────

/**
 * Make a single API request to OpenRouter with a specific model.
 * Uses AbortController for timeout handling.
 */
async function makeRequest(prompt, apiKey, model) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.warn(`[OpenRouter] Request timed out after ${OPENROUTER_CONFIG.TIMEOUT_MS}ms (model: ${model})`);
    controller.abort();
  }, OPENROUTER_CONFIG.TIMEOUT_MS);

  console.log(`[OpenRouter] Sending request to model: ${model}`);

  try {
    const res = await fetch(OPENROUTER_CONFIG.BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'chrome-extension://ai-form-filler',
        'X-Title': 'AI Form Filler'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a JSON-only response bot. You never use markdown. You never explain. You only output raw JSON objects.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: OPENROUTER_CONFIG.TEMPERATURE,
        max_tokens: OPENROUTER_CONFIG.MAX_TOKENS
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errorMsg = body.error?.message || body.error?.code || res.statusText;
      console.error(`[OpenRouter] HTTP ${res.status}: ${errorMsg}`);

      // If model not available (404/422), signal to try fallback
      if (res.status === 404 || res.status === 422) {
        const err = new Error(`Model "${model}" unavailable: ${errorMsg}`);
        err.isModelError = true;
        throw err;
      }

      // Rate limit — signal retryable
      if (res.status === 429) {
        const err = new Error(`Rate limited: ${errorMsg}`);
        err.isRetryable = true;
        throw err;
      }

      // Auth error — not retryable
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Authentication failed (${res.status}): ${errorMsg}. Check your OpenRouter API key.`);
      }

      throw new Error(`OpenRouter API ${res.status}: ${errorMsg}`);
    }

    const data = await res.json();
    console.log(`[OpenRouter] Response received from ${model}, usage:`, data.usage);
    return data;

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Request timed out after ${OPENROUTER_CONFIG.TIMEOUT_MS / 1000}s (model: ${model})`);
      timeoutErr.isRetryable = true;
      throw timeoutErr;
    }
    throw err;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get field mapping from OpenRouter AI.
 * Implements: model fallback → retry with exponential backoff → JSON recovery.
 */
async function getFieldMapping(fields, profile, apiKey) {
  if (!apiKey) throw new Error('API key required');
  if (!fields?.length) throw new Error('No fields provided');
  if (!profile) throw new Error('No profile provided');

  const prompt = buildPrompt(fields, profile);
  let lastErr;

  // Outer loop: model fallback
  for (let modelIdx = 0; modelIdx < OPENROUTER_CONFIG.MODELS.length; modelIdx++) {
    const model = OPENROUTER_CONFIG.MODELS[modelIdx];
    console.log(`[OpenRouter] Trying model ${modelIdx + 1}/${OPENROUTER_CONFIG.MODELS.length}: ${model}`);

    // Inner loop: retry with exponential backoff
    for (let attempt = 1; attempt <= OPENROUTER_CONFIG.MAX_RETRIES; attempt++) {
      try {
        console.log(`[OpenRouter] Attempt ${attempt}/${OPENROUTER_CONFIG.MAX_RETRIES} with ${model}`);

        const data = await makeRequest(prompt, apiKey, model);
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          console.warn('[AI] Empty content in response, retrying...');
          throw new Error('Empty AI response — no content in choices[0].message.content');
        }

        console.log('[AI] Raw response content:', content.slice(0, 300));

        const mapping = parseMapping(content);
        console.log(`[OpenRouter] ✓ Mapping received (${Object.keys(mapping).length} fields) via ${model}`);
        return mapping;

      } catch (err) {
        lastErr = err;
        console.warn(`[OpenRouter] Attempt ${attempt} failed (${model}):`, err.message);

        // If model itself is unavailable, skip retries and go to next model
        if (err.isModelError) {
          console.log(`[OpenRouter] Model "${model}" unavailable, falling back to next model...`);
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < OPENROUTER_CONFIG.MAX_RETRIES) {
          const delay = OPENROUTER_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[OpenRouter] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
  }

  // All models and retries exhausted
  console.error('[OpenRouter] ✗ All models and retries exhausted');
  throw new Error(`AI mapping failed after trying all models. Last error: ${lastErr?.message}`);
}

/**
 * Test API connection with a minimal request.
 */
async function testConnection(apiKey) {
  try {
    const model = OPENROUTER_CONFIG.MODELS[0];
    console.log(`[OpenRouter] Testing connection with model: ${model}`);
    const data = await makeRequest('Reply with the single word OK.', apiKey, model);
    const content = data.choices?.[0]?.message?.content || '';
    console.log('[OpenRouter] Test response:', content.trim());
    return { success: true, message: `Connection successful (model: ${model})` };
  } catch (err) {
    console.error('[OpenRouter] Test connection failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Validate OpenRouter API key format.
 * OpenRouter keys start with "sk-or-" and are typically 64+ chars.
 */
function validateApiKeyFormat(key) {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  // OpenRouter keys: "sk-or-v1-..." or "sk-or-..." — at least 20 chars
  return trimmed.startsWith('sk-or-') && trimmed.length >= 20;
}

export { getFieldMapping, testConnection, validateApiKeyFormat, OPENROUTER_CONFIG };