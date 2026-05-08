/**
 * Groq API Integration
 * Handles communication with Groq Chat Completions API
 * API calls only happen in background.js for security
 */

const GROQ_API_CONFIG = {
  BASE_URL: 'https://api.groq.com/openai/v1/chat/completions',
  MODEL: 'llama-3.3-70b-versatile',
  MAX_RETRIES: 3,
  TIMEOUT: 30000, // 30 seconds
  TEMPERATURE: 0.3,
  MAX_TOKENS: 2048
};

/**
 * Validate JSON response from AI
 * @param {string} jsonString - The JSON string to validate
 * @returns {Object|null} - Parsed JSON object or null if invalid
 */
function validateJSONResponse(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Check if it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.error('[Groq API] Response is not a valid object');
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('[Groq API] JSON parse error:', error);
    return null;
  }
}

/**
 * Extract JSON from AI response (handles markdown code blocks)
 * @param {string} content - The raw content from AI
 * @returns {string} - Extracted JSON string
 */
function extractJSONFromContent(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Remove markdown code blocks if present
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                   content.match(/```\s*([\s\S]*?)\s*```/) ||
                   content.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    return jsonMatch[1] || jsonMatch[0];
  }
  
  return content.trim();
}

/**
 * Build the prompt for Groq AI
 * @param {Array<Object>} fields - Detected form fields
 * @param {Object} profile - User profile data
 * @returns {string} - The prompt string
 */
function buildPrompt(fields, profile) {
  const fieldsDescription = fields.map((field, index) => {
    return `
Field ${index}:
- ID: ${field.id}
- Type: ${field.type}
- Name: ${field.name || 'N/A'}
- Label: ${field.label || 'N/A'}
- Placeholder: ${field.placeholder || 'N/A'}
- Required: ${field.required}
`.trim();
  }).join('\n');

  const profileDescription = Object.entries(profile)
    .filter(([_, value]) => value && typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  return `You are a form-filling assistant. Your task is to intelligently match user profile data to form fields.

USER PROFILE:
${profileDescription || 'No profile data available'}

FORM FIELDS:
${fieldsDescription}

TASK:
Analyze each field and determine which profile value (if any) should be used to fill it. Return a JSON object where:
- Keys are the field IDs
- Values are the corresponding profile values to fill the field
- Use null if no suitable profile value exists for a field

IMPORTANT RULES:
1. Return ONLY valid JSON, no markdown, no code blocks, no explanations
2. Match intelligently based on field context (e.g., "email" field → email value)
3. Handle variations in naming (e.g., "phone", "telephone", "tel" → phone value)
4. Use null for fields that don't have a matching profile value
5. Do not invent or hallucinate values - only use data from the profile

Response format (JSON only):
{
  "field_id_1": "profile_value_1",
  "field_id_2": "profile_value_2",
  "field_id_3": null,
  ...
}

Provide the JSON response now:`;
}

/**
 * Make API request to Groq with timeout
 * @param {string} prompt - The prompt to send
 * @param {string} apiKey - The Groq API key
 * @param {AbortSignal} signal - Abort signal for timeout
 * @returns {Promise<Object>} - API response
 */
async function makeGroqRequest(prompt, apiKey, signal) {
  const response = await fetch(GROQ_API_CONFIG.BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_API_CONFIG.MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: GROQ_API_CONFIG.TEMPERATURE,
      max_tokens: GROQ_API_CONFIG.MAX_TOKENS
    }),
    signal: signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Groq API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`
    );
  }

  return await response.json();
}

/**
 * Get field-to-value mapping from Groq AI
 * @param {Array<Object>} fields - Detected form fields
 * @param {Object} profile - User profile data
 * @param {string} apiKey - Groq API key
 * @returns {Promise<Object>} - Field mapping object
 */
async function getFieldMapping(fields, profile, apiKey) {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!fields || fields.length === 0) {
    throw new Error('No fields provided');
  }

  if (!profile || typeof profile !== 'object') {
    throw new Error('Invalid profile data');
  }

  console.log('[Groq API] Requesting field mapping for', fields.length, 'fields');

  const prompt = buildPrompt(fields, profile);
  
  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= GROQ_API_CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`[Groq API] Attempt ${attempt}/${GROQ_API_CONFIG.MAX_RETRIES}`);
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GROQ_API_CONFIG.TIMEOUT);

      const response = await makeGroqRequest(prompt, apiKey, controller.signal);
      
      clearTimeout(timeoutId);

      // Extract content from response
      const content = response.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in API response');
      }

      console.log('[Groq API] Raw response:', content);

      // Extract JSON from content
      const jsonString = extractJSONFromContent(content);
      
      if (!jsonString) {
        throw new Error('No JSON found in response');
      }

      // Validate JSON
      const mapping = validateJSONResponse(jsonString);
      
      if (!mapping) {
        throw new Error('Invalid JSON in response');
      }

      console.log('[Groq API] Valid mapping received:', mapping);
      return mapping;

    } catch (error) {
      console.error(`[Groq API] Attempt ${attempt} failed:`, error.message);
      
      // If it's the last attempt, throw the error
      if (attempt === GROQ_API_CONFIG.MAX_RETRIES) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[Groq API] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Test API connection
 * @param {string} apiKey - Groq API key
 * @returns {Promise<Object>} - Test result
 */
async function testConnection(apiKey) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for test

    const response = await makeGroqRequest(
      'Respond with "OK" to confirm connection.',
      apiKey,
      controller.signal
    );

    clearTimeout(timeoutId);

    return {
      success: true,
      message: 'Connection successful'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate API key format
 * @param {string} apiKey - The API key to validate
 * @returns {boolean} - True if valid format
 */
function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // Groq API keys typically start with 'gsk_'
  return apiKey.startsWith('gsk_') && apiKey.length >= 32;
}

export {
  GROQ_API_CONFIG,
  getFieldMapping,
  testConnection,
  validateApiKeyFormat,
  buildPrompt,
  validateJSONResponse,
  extractJSONFromContent
};
