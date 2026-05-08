/**
 * Storage Utility Module
 * Handles all chrome.storage.local operations with robust error handling
 */

const STORAGE_KEYS = {
  USER_PROFILE: 'userProfile',
  LAST_UPDATED: 'lastUpdated'
};

/**
 * Save data to chrome.storage.local
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function saveToStorage(key, value) {
  try {
    if (!key) {
      throw new Error('Storage key is required');
    }

    const data = {};
    data[key] = value;
    
    await chrome.storage.local.set(data);
    return { success: true };
  } catch (error) {
    console.error(`Error saving to storage (${key}):`, error);
    return { 
      success: false, 
      error: error.message || 'Failed to save data' 
    };
  }
}

/**
 * Load data from chrome.storage.local
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function loadFromStorage(key, defaultValue = null) {
  try {
    if (!key) {
      throw new Error('Storage key is required');
    }

    const result = await chrome.storage.local.get(key);
    const data = result[key] !== undefined ? result[key] : defaultValue;
    
    return { success: true, data };
  } catch (error) {
    console.error(`Error loading from storage (${key}):`, error);
    return { 
      success: false, 
      error: error.message || 'Failed to load data',
      data: defaultValue
    };
  }
}

/**
 * Save user profile with timestamp
 * @param {Object} profile - User profile object
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function saveProfile(profile) {
  try {
    // Validate profile structure
    if (!profile || typeof profile !== 'object') {
      throw new Error('Invalid profile structure');
    }

    // Save profile with timestamp
    const saveResult = await saveToStorage(STORAGE_KEYS.USER_PROFILE, profile);
    if (!saveResult.success) {
      return saveResult;
    }

    // Update timestamp
    await saveToStorage(STORAGE_KEYS.LAST_UPDATED, Date.now());

    return { success: true };
  } catch (error) {
    console.error('Error saving profile:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to save profile' 
    };
  }
}

/**
 * Load user profile from storage
 * @returns {Promise<{success: boolean, profile?: Object, error?: string}>}
 */
async function loadProfile() {
  try {
    const result = await loadFromStorage(STORAGE_KEYS.USER_PROFILE, {
      name: '',
      email: '',
      phone: '',
      address: '',
      skills: '',
      experience: ''
    });

    return {
      success: result.success,
      profile: result.data,
      error: result.error
    };
  } catch (error) {
    console.error('Error loading profile:', error);
    return {
      success: false,
      profile: {
        name: '',
        email: '',
        phone: '',
        address: '',
        skills: '',
        experience: ''
      },
      error: error.message || 'Failed to load profile'
    };
  }
}

/**
 * Get last updated timestamp
 * @returns {Promise<{success: boolean, timestamp?: number, error?: string}>}
 */
async function getLastUpdated() {
  return await loadFromStorage(STORAGE_KEYS.LAST_UPDATED, null);
}

/**
 * Clear all storage data
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function clearStorage() {
  try {
    await chrome.storage.local.clear();
    return { success: true };
  } catch (error) {
    console.error('Error clearing storage:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to clear storage' 
    };
  }
}

/**
 * Check if storage is available
 * @returns {Promise<boolean>}
 */
async function isStorageAvailable() {
  try {
    await chrome.storage.local.set({ test: 'test' });
    await chrome.storage.local.remove('test');
    return true;
  } catch (error) {
    console.error('Storage not available:', error);
    return false;
  }
}

export {
  STORAGE_KEYS,
  saveToStorage,
  loadFromStorage,
  saveProfile,
  loadProfile,
  getLastUpdated,
  clearStorage,
  isStorageAvailable
};
