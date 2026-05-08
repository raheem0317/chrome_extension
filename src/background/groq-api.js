/**
 * DEPRECATED — This file is no longer used.
 * All AI API logic has been moved to ./utils/api.js (OpenRouter).
 * 
 * This file is kept as a placeholder to avoid import errors in case
 * any legacy code references it. It re-exports from the new location.
 */

import { getFieldMapping, testConnection, validateApiKeyFormat, OPENROUTER_CONFIG } from './utils/api.js';

class OpenRouterAPI {
  async getFieldMapping(fields, profile, apiKey) {
    return getFieldMapping(fields, profile, apiKey);
  }

  async testConnection(apiKey) {
    return testConnection(apiKey);
  }
}

export default new OpenRouterAPI();
