import { STORAGE_KEYS, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../shared/constants.js';
import { deepClone } from '../shared/utils.js';

/**
 * Storage Manager - Handles all chrome.storage.local operations
 */
class StorageManager {
  /**
   * Get user profile from storage
   */
  async getProfile() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
      return result[STORAGE_KEYS.USER_PROFILE] || deepClone(DEFAULT_PROFILE);
    } catch (error) {
      console.error('Error getting profile:', error);
      return deepClone(DEFAULT_PROFILE);
    }
  }

  /**
   * Save user profile to storage
   */
  async saveProfile(profile) {
    try {
      // Validate profile structure
      const validatedProfile = this.validateProfile(profile);
      await chrome.storage.local.set({
        [STORAGE_KEYS.USER_PROFILE]: validatedProfile
      });
      return { success: true, profile: validatedProfile };
    } catch (error) {
      console.error('Error saving profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get API key from storage
   */
  async getApiKey() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
      return result[STORAGE_KEYS.API_KEY] || '';
    } catch (error) {
      console.error('Error getting API key:', error);
      return '';
    }
  }

  /**
   * Save API key to storage
   */
  async saveApiKey(apiKey) {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.API_KEY]: apiKey.trim()
      });
      return { success: true };
    } catch (error) {
      console.error('Error saving API key:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get settings from storage
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      return result[STORAGE_KEYS.SETTINGS] || deepClone(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('Error getting settings:', error);
      return deepClone(DEFAULT_SETTINGS);
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings(settings) {
    try {
      const validatedSettings = { ...DEFAULT_SETTINGS, ...settings };
      await chrome.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: validatedSettings
      });
      return { success: true, settings: validatedSettings };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate profile structure
   */
  validateProfile(profile) {
    const validated = deepClone(DEFAULT_PROFILE);
    
    for (const key in DEFAULT_PROFILE) {
      if (key in profile && typeof profile[key] === 'string') {
        validated[key] = profile[key].trim();
      }
    }
    
    return validated;
  }

  /**
   * Check if profile is complete
   */
  isProfileComplete(profile) {
    const requiredFields = ['firstName', 'lastName', 'email'];
    return requiredFields.every(field => {
      const value = profile[field];
      return value && value.trim().length > 0;
    });
  }

  /**
   * Clear all storage data
   */
  async clearAll() {
    try {
      await chrome.storage.local.clear();
      return { success: true };
    } catch (error) {
      console.error('Error clearing storage:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new StorageManager();
