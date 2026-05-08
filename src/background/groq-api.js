import { GROQ_API_CONFIG, FIELD_CATEGORIES } from '../shared/constants.js';
import { retry } from '../shared/utils.js';

/**
 * Groq API Manager - Handles all API calls to Groq
 */
class GroqAPI {
  constructor() {
    this.baseUrl = GROQ_API_CONFIG.BASE_URL;
    this.model = GROQ_API_CONFIG.MODEL;
    this.maxRetries = GROQ_API_CONFIG.MAX_RETRIES;
    this.timeout = GROQ_API_CONFIG.TIMEOUT;
  }

  /**
   * Get field-to-value mapping from Groq AI
   */
  async getFieldMapping(fields, profile, apiKey) {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (!fields || fields.length === 0) {
      throw new Error('No fields to process');
    }

    const prompt = this.buildPrompt(fields, profile);
    
    try {
      const response = await retry(
        () => this.makeApiRequest(prompt, apiKey),
        this.maxRetries,
        1000
      );
      
      return this.parseResponse(response, fields);
    } catch (error) {
      console.error('Groq API error:', error);
      throw error;
    }
  }

  /**
   * Build the prompt for Groq AI
   */
  buildPrompt(fields, profile) {
    const fieldsDescription = fields.map((field, index) => {
      return `
Field ${index + 1}:
- Type: ${field.type}
- Name: ${field.name || 'N/A'}
- ID: ${field.id || 'N/A'}
- Label: ${field.label || 'N/A'}
- Placeholder: ${field.placeholder || 'N/A'}
- Options: ${field.options ? field.options.join(', ') : 'N/A'}
`.trim();
    }).join('\n');

    const profileDescription = Object.entries(profile)
      .filter(([_, value]) => value && value.trim().length > 0)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');

    return `You are a form-filling assistant. Given form field metadata and a user profile, map each field to the appropriate value from the profile.

USER PROFILE:
${profileDescription || 'No profile data available'}

FORM FIELDS:
${fieldsDescription}

TASK:
For each field, determine which profile field (if any) should be used to fill it. Return ONLY a valid JSON object with field indices as keys and the corresponding profile field names as values.

Available profile fields: ${Object.keys(FIELD_CATEGORIES).join(', ')}

Response format (JSON only, no markdown):
{
  "0": "firstName",
  "1": "email",
  "2": null,
  ...
}

Use null if no suitable profile field exists for a given field. Be smart about matching - e.g., "phone number" should map to "phone", "email address" to "email", etc.`;
  }

  /**
   * Make API request to Groq
   */
  async makeApiRequest(prompt, apiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2048
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('API request timeout');
      }
      
      throw error;
    }
  }

  /**
   * Parse API response and extract field mapping
   */
  parseResponse(response, fields) {
    try {
      const content = response.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in API response');
      }

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const mapping = JSON.parse(jsonStr);

      // Validate mapping
      const validatedMapping = {};
      for (let i = 0; i < fields.length; i++) {
        const fieldKey = String(i);
        const profileField = mapping[fieldKey];
        
        if (profileField && Object.values(FIELD_CATEGORIES).includes(profileField)) {
          validatedMapping[fieldKey] = profileField;
        } else {
          validatedMapping[fieldKey] = null;
        }
      }

      return validatedMapping;
    } catch (error) {
      console.error('Error parsing API response:', error);
      throw new Error(`Failed to parse API response: ${error.message}`);
    }
  }

  /**
   * Test API connection
   */
  async testConnection(apiKey) {
    try {
      const response = await this.makeApiRequest(
        'Respond with "OK" to confirm connection.',
        apiKey
      );
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new GroqAPI();
