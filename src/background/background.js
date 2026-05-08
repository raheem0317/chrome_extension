import { getFieldMapping, validateApiKeyFormat } from './utils/api.js';

/**
 * Background Service Worker
 * Central coordinator for the extension
 * Handles message routing between popup and content scripts
 * API calls happen here for security
 */

class BackgroundService {
  constructor() {
    this.fillingStatus = {
      active: false,
      result: null,
      tabId: null,
      reviewMode: false
    };
    this.init();
  }

  /**
   * Initialize the background service
   */
  init() {
    console.log('[AI Form Filler] Background service initializing...');
    this.setupMessageListener();
    this.setupInstallListener();
    console.log('[AI Form Filler] Background service ready');
  }

  /**
   * Setup message listener for communication with popup and content scripts
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[AI Form Filler] Background received message:', message.type, 'from:', sender.tab?.id || 'popup');
      
      this.handleMessage(message, sender).then(sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  /**
   * Handle incoming messages
   * @param {Object} message - The message object
   * @param {Object} sender - The sender information
   * @returns {Promise<Object>} - Response object
   */
  async handleMessage(message, sender) {
    try {
      switch (message.type) {
        case 'DETECT_FIELDS':
          return await this.handleDetectFields(message, sender);
        
        case 'GET_FIELD_COUNT':
          return await this.handleGetFieldCount(message, sender);
        
        case 'HAS_FORMS':
          return await this.handleHasForms(message, sender);
        
        case 'FILL_FORM':
          return await this.handleFillForm(message, sender);
        
        case 'SAVE_API_KEY':
          return await this.handleSaveApiKey(message);
        
        case 'GET_API_KEY':
          return await this.handleGetApiKey();
        
        case 'TEST_API_KEY':
          return await this.handleTestApiKey(message);
        
        case 'FIELD_METADATA':
          return await this.handleFieldMetadata(message);
        
        case 'PING':
          return { success: true, message: 'pong' };
        
        case 'GET_FILL_STATUS':
          return { success: true, status: this.fillingStatus };
        
        case 'CLEAR_FILL_STATUS':
          this.fillingStatus = { active: false, result: null, tabId: null, reviewMode: false };
          return { success: true };
        
        default:
          console.warn('[AI Form Filler] Unknown message type:', message.type);
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('[AI Form Filler] Background message error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send message to content script with auto-injection fallback
   * @param {number} tabId - The tab ID
   * @param {Object} message - The message to send
   * @returns {Promise<Object>} - Response from content script
   */
  async sendMessageToContentScript(tabId, message) {
    try {
      // Try sending message directly
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      // Content script not loaded - inject it
      console.log('[AI Form Filler] Content script not loaded, injecting...');
      
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [
            'src/content/utils/detectFields.js',
            'src/content/utils/fillFields.js',
            'src/content/utils/notification.js',
            'src/content/components/ReviewModal.js',
            'src/content/content.js'
          ]
        });
        
        console.log('[AI Form Filler] Content scripts injected successfully');
        
        // Wait a moment for scripts to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try sending message again
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (injectError) {
        console.error('[AI Form Filler] Failed to inject content script:', injectError);
        throw new Error('Could not load content script. Make sure you are on a regular webpage (not chrome:// or edge:// pages).');
      }
    }
  }

  /**
   * Handle field detection request
   * Routes to content script to detect fields
   * @param {Object} message - The message object
   * @param {Object} sender - The sender information
   * @returns {Promise<Object>} - Response with detected fields
   */
  async handleDetectFields(message, sender) {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error('[AI Form Filler] No active tab found');
        return { success: false, error: 'No active tab found' };
      }

      console.log('[AI Form Filler] Sending DETECT_FIELDS to tab:', tab.id);
      
      // Send message to content script with auto-injection
      const response = await this.sendMessageToContentScript(tab.id, {
        type: 'DETECT_FIELDS'
      });

      console.log('[AI Form Filler] Received field detection response:', response);
      return response;
    } catch (error) {
      console.error('[AI Form Filler] Error in handleDetectFields:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle get field count request
   * Routes to content script to count fields
   * @param {Object} message - The message object
   * @param {Object} sender - The sender information
   * @returns {Promise<Object>} - Response with field count
   */
  async handleGetFieldCount(message, sender) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        return { success: false, error: 'No active tab found' };
      }

      console.log('[AI Form Filler] Sending GET_FIELD_COUNT to tab:', tab.id);
      
      const response = await this.sendMessageToContentScript(tab.id, {
        type: 'GET_FIELD_COUNT'
      });

      console.log('[AI Form Filler] Received field count response:', response);
      return response;
    } catch (error) {
      console.error('[AI Form Filler] Error in handleGetFieldCount:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle has forms request
   * Routes to content script to check for forms
   * @param {Object} message - The message object
   * @param {Object} sender - The sender information
   * @returns {Promise<Object>} - Response indicating if forms exist
   */
  async handleHasForms(message, sender) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        return { success: false, error: 'No active tab found' };
      }

      console.log('[AI Form Filler] Sending HAS_FORMS to tab:', tab.id);
      
      const response = await this.sendMessageToContentScript(tab.id, {
        type: 'HAS_FORMS'
      });

      console.log('[AI Form Filler] Received has forms response:', response);
      return response;
    } catch (error) {
      console.error('[AI Form Filler] Error in handleHasForms:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle fill form request
   * Orchestrates the form filling process with AI
   * @param {Object} message - The message object
   * @param {Object} sender - The sender information
   * @returns {Promise<Object>} - Response with fill results
   */
  async handleFillForm(message, sender) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        return { success: false, error: 'No active tab found' };
      }

      // Check if review mode is requested
      const reviewMode = message.payload?.reviewMode || false;
      console.log('[AI Form Filler] Starting fill form process for tab:', tab.id, 'review mode:', reviewMode);
      
      // Update status
      this.fillingStatus = {
        active: true,
        result: null,
        tabId: tab.id,
        reviewMode: reviewMode
      };
      
      // Step 1: Detect fields
      console.log('[AI Form Filler] Step 1: Detecting fields...');
      const detectResponse = await this.sendMessageToContentScript(tab.id, {
        type: 'DETECT_FIELDS'
      });

      if (!detectResponse.success) {
        console.error('[AI Form Filler] Field detection failed:', detectResponse.error);
        return { success: false, error: detectResponse.error || 'Failed to detect fields' };
      }

      console.log('[AI Form Filler] Fields detected:', detectResponse.count);
      
      if (detectResponse.count === 0) {
        return { success: false, error: 'No form fields found on this page' };
      }
      
      // Step 2: Get API key
      console.log('[AI Form Filler] Step 2: Getting API key...');
      const apiKey = await this.getApiKey();
      
      if (!apiKey) {
        return { success: false, error: 'API key not configured. Please add your Groq API key in the extension settings.' };
      }

      // Step 3: Get user profile from storage
      console.log('[AI Form Filler] Step 3: Loading user profile...');
      const profileData = await chrome.storage.local.get('userProfile');
      const profile = profileData.userProfile || {};
      
      if (!profile.name || !profile.email) {
        return { success: false, error: 'Please complete your profile (name and email required) before filling forms.' };
      }

      // Step 4: Call Groq API to get field mapping
      console.log('[AI Form Filler] Step 4: Calling Groq API for field mapping...');
      const fieldMapping = await getFieldMapping(detectResponse.fields, profile, apiKey);
      
      console.log('[AI Form Filler] AI mapping received:', fieldMapping);
      
      // Step 5: Send mapping to content script to fill fields (with review mode flag)
      console.log('[AI Form Filler] Step 5: Filling fields...');
      const fillResponse = await this.sendMessageToContentScript(tab.id, {
        type: 'FILL_FIELDS',
        payload: {
          fieldMapping: fieldMapping,
          reviewMode: reviewMode
        }
      });

      console.log('[AI Form Filler] Fill response:', fillResponse);
      
      const result = {
        success: true,
        filled: fillResponse.filled || 0,
        skipped: fillResponse.skipped || 0,
        errors: fillResponse.errors || [],
        cancelled: fillResponse.cancelled || false
      };

      this.fillingStatus.active = false;
      this.fillingStatus.result = result;

      return result;
    } catch (error) {
      console.error('[AI Form Filler] Error in handleFillForm:', error);
      
      const errorResult = { 
        success: false, 
        error: error.message || 'Failed to fill form' 
      };

      // Provide user-friendly error messages
      if (error.message.includes('API key')) {
        errorResult.error = 'Invalid API key. Please check your Groq API key.';
      } else if (error.message.includes('timeout')) {
        errorResult.error = 'Request timed out. Please try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorResult.error = 'Network error. Please check your internet connection.';
      }

      this.fillingStatus.active = false;
      this.fillingStatus.result = errorResult;
      
      return errorResult;
    }
  }

  /**
   * Handle save API key
   * @param {Object} message - The message object
   * @returns {Promise<Object>} - Response
   */
  async handleSaveApiKey(message) {
    try {
      const { apiKey } = message.payload || {};
      
      if (!apiKey) {
        return { success: false, error: 'API key is required' };
      }

      if (!validateApiKeyFormat(apiKey)) {
        return { success: false, error: 'Invalid API key format. Groq API keys should start with "gsk_"' };
      }

      await chrome.storage.local.set({ groqApiKey: apiKey.trim() });
      console.log('[AI Form Filler] API key saved');
      
      return { success: true };
    } catch (error) {
      console.error('[AI Form Filler] Error saving API key:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle get API key
   * @returns {Promise<Object>} - Response with API key status
   */
  async handleGetApiKey() {
    try {
      const apiKey = await this.getApiKey();
      return {
        success: true,
        hasKey: !!apiKey
      };
    } catch (error) {
      console.error('[AI Form Filler] Error getting API key:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle test API key
   * @param {Object} message - The message object
   * @returns {Promise<Object>} - Response with test result
   */
  async handleTestApiKey(message) {
    try {
      const { apiKey } = message.payload || {};
      
      if (!apiKey) {
        return { success: false, error: 'API key is required' };
      }

      if (!validateApiKeyFormat(apiKey)) {
        return { success: false, error: 'Invalid API key format' };
      }

      const { testConnection } = await import('./utils/api.js');
      const result = await testConnection(apiKey);
      
      return result;
    } catch (error) {
      console.error('[AI Form Filler] Error testing API key:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get API key from storage
   * @returns {Promise<string|null>} - The API key or null
   */
  async getApiKey() {
    try {
      const result = await chrome.storage.local.get('groqApiKey');
      return result.groqApiKey || null;
    } catch (error) {
      console.error('[AI Form Filler] Error getting API key:', error);
      return null;
    }
  }

  /**
   * Handle field metadata from content script
   * @param {Object} message - The message object
   * @returns {Promise<Object>} - Response
   */
  async handleFieldMetadata(message) {
    console.log('[AI Form Filler] Field metadata received:', message.payload);
    // Store metadata for later use
    return { success: true };
  }

  /**
   * Setup install/update listener
   */
  setupInstallListener() {
    chrome.runtime.onInstalled.addListener(async (details) => {
      console.log('[AI Form Filler] Extension installed/updated:', details.reason);
      
      if (details.reason === 'install') {
        console.log('[AI Form Filler] First time installation');
        // Initialize default settings if needed
      } else if (details.reason === 'update') {
        console.log('[AI Form Filler] Extension updated to version:', chrome.runtime.getManifest().version);
      }
    });
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Export for testing
export default backgroundService;
