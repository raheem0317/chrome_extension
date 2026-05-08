/**
 * Groq API Utility — runs ONLY in background.js (service worker)
 * Never imported by popup.js or content.js
 */

const GROQ_API_CONFIG = {
  BASE_URL: 'https://api.groq.com/openai/v1/chat/completions',
  MODEL: 'llama-3.3-70b-versatile',
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30_000,
  TEMPERATURE: 0.2,
  MAX_TOKENS: 2048
};

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) return codeBlock[1].trim();
  const obj = raw.match(/\{[\s\S]*\}/);
  return obj ? obj[0].trim() : raw.trim();
}

function parseMapping(raw) {
  const jsonStr = extractJSON(raw);
  if (!jsonStr) throw new Error('No JSON found in AI response');
  const parsed = JSON.parse(jsonStr);
  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null)
    throw new Error('AI response is not a plain object');
  return parsed;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(fields, profile) {
  const fieldLines = fields.map((f, i) => [
    `Field ${i}:`,
    `  id: ${f.id}`,
    `  type: ${f.type}`,
    `  name: ${f.name || 'N/A'}`,
    `  label: ${f.label || 'N/A'}`,
    `  placeholder: ${f.placeholder || 'N/A'}`,
    `  required: ${f.required}`
  ].join('\n')).join('\n');

  const profileLines = Object.entries(profile)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  return `You are a form-filling assistant. Map form fields to profile values.

PROFILE:
${profileLines || '  (empty)'}

FIELDS:
${fieldLines}

TASK: Return ONLY a valid JSON object where keys are field ids and values are the matching profile values (or null if no match). No markdown, no explanation.

Example:
{"id:email|name:email|type:email": "alice@example.com", "id:name|name:name|type:text": "Alice Smith"}`;
}

// ─── HTTP request ─────────────────────────────────────────────────────────────

async function makeRequest(prompt, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_API_CONFIG.TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_API_CONFIG.BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_API_CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: GROQ_API_CONFIG.TEMPERATURE,
        max_tokens: GROQ_API_CONFIG.MAX_TOKENS
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Groq API ${res.status}: ${body.error?.message || res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out after 30s');
    throw err;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function getFieldMapping(fields, profile, apiKey) {
  if (!apiKey) throw new Error('API key required');
  if (!fields?.length) throw new Error('No fields provided');
  if (!profile) throw new Error('No profile provided');

  const prompt = buildPrompt(fields, profile);
  let lastErr;

  for (let attempt = 1; attempt <= GROQ_API_CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`[Groq API] Attempt ${attempt}/${GROQ_API_CONFIG.MAX_RETRIES}`);
      const data = await makeRequest(prompt, apiKey);
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty AI response');
      const mapping = parseMapping(content);
      console.log('[Groq API] Mapping received:', mapping);
      return mapping;
    } catch (err) {
      lastErr = err;
      console.warn('[Groq API] Attempt failed:', err.message);
      if (attempt < GROQ_API_CONFIG.MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastErr;
}

async function testConnection(apiKey) {
  try {
    await makeRequest('Reply with the single word OK.', apiKey);
    return { success: true, message: 'Connection successful' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function validateApiKeyFormat(key) {
  return typeof key === 'string' && key.startsWith('gsk_') && key.length >= 32;
}

export { getFieldMapping, testConnection, validateApiKeyFormat, GROQ_API_CONFIG };