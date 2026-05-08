import { saveProfile, loadProfile, getLastUpdated, isStorageAvailable } from './storage.js';
import { validateFormData, sanitizeFormData, getFirstError } from './validation.js';

/**
 * Popup Controller - Main popup logic
 * Handles profile management, API key storage, and form filling
 */
class PopupController {
  constructor() {
    this.profile = null;
    this.isProcessing = false;
    this.storageAvailable = false;
    this.init();
  }

  async init() {
    try {
      this.cacheElements();
      this.bindEvents();
      
      this.storageAvailable = await isStorageAvailable();
      
      if (!this.storageAvailable) {
        this.showToast('Storage not available. Some features may not work.', 'error');
        this.elements.statusText.textContent = 'Storage Error';
      }
      
      await this.loadProfile();
      await this.loadApiKey();
      this.updateStatus();
      await this.checkFillingStatus();
    } catch (error) {
      console.error('Initialization error:', error);
      this.showToast('Failed to initialize extension', 'error');
    }
  }

  cacheElements() {
    this.elements = {
      apiKey: document.getElementById('apiKey'),
      saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
      profileForm: document.getElementById('profileForm'),
      name: document.getElementById('name'),
      email: document.getElementById('email'),
      phone: document.getElementById('phone'),
      address: document.getElementById('address'),
      skills: document.getElementById('skills'),
      experience: document.getElementById('experience'),
      saveProfileBtn: document.getElementById('saveProfileBtn'),
      fillFormBtn: document.getElementById('fillFormBtn'),
      statusIndicator: document.getElementById('statusIndicator'),
      statusText: document.querySelector('.status-text'),
      toast: document.getElementById('toast'),
      toastMessage: document.getElementById('toastMessage'),
      loadingOverlay: document.getElementById('loadingOverlay'),
      loadingText: document.getElementById('loadingText'),
      reviewModeToggle: document.getElementById('reviewModeToggle'),
      fillBtnText: document.getElementById('fillBtnText')
    };
  }

  bindEvents() {
    this.elements.profileForm.addEventListener('submit', (e) => this.handleSaveProfile(e));
    this.elements.saveApiKeyBtn.addEventListener('click', () => this.handleSaveApiKey());
    this.elements.fillFormBtn.addEventListener('click', () => this.handleFillForm());
    this.elements.reviewModeToggle.addEventListener('change', () => this.updateFillButtonText());
  }

  updateFillButtonText() {
    const isReview = this.elements.reviewModeToggle.checked;
    this.elements.fillBtnText.textContent = isReview ? 'Review & Fill' : 'Fill Form';
  }

  async loadProfile() {
    try {
      this.showLoading('Loading profile...');
      
      const result = await loadProfile();
      
      if (!result.success) {
        console.error('Error loading profile:', result.error);
        this.showToast('Failed to load profile', 'error');
        this.profile = this.getDefaultProfile();
      } else {
        this.profile = result.profile;
      }
      
      this.populateForm();
      
      const lastUpdated = await getLastUpdated();
      if (lastUpdated.success && lastUpdated.timestamp) {
        const date = new Date(lastUpdated.timestamp);
        console.log('Profile last updated:', date.toLocaleString());
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      this.showToast('Error loading profile', 'error');
      this.profile = this.getDefaultProfile();
      this.populateForm();
    } finally {
      this.hideLoading();
    }
  }

  async loadApiKey() {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'GET_API_KEY'
      });
      
      if (result.success && result.hasKey) {
        this.elements.apiKey.value = '••••••••••••••••';
        console.log('[Popup] API key loaded');
      }
    } catch (error) {
      console.error('[Popup] Error loading API key:', error);
    }
  }

  getDefaultProfile() {
    return {
      name: '',
      email: '',
      phone: '',
      address: '',
      skills: '',
      experience: ''
    };
  }

  populateForm() {
    if (!this.profile) {
      this.profile = this.getDefaultProfile();
    }

    this.elements.name.value = this.profile.name || '';
    this.elements.email.value = this.profile.email || '';
    this.elements.phone.value = this.profile.phone || '';
    this.elements.address.value = this.profile.address || '';
    this.elements.skills.value = this.profile.skills || '';
    this.elements.experience.value = this.profile.experience || '';
  }

  async handleSaveProfile(event) {
    event.preventDefault();

    if (this.isProcessing) return;

    if (!this.storageAvailable) {
      this.showToast('Storage not available. Cannot save profile.', 'error');
      return;
    }

    const formData = this.getFormData();
    
    const validation = validateFormData(formData);
    if (!validation.valid) {
      const firstError = getFirstError(validation);
      this.showToast(firstError, 'error');
      this.focusFirstError(validation.fieldErrors);
      return;
    }

    const sanitizedData = sanitizeFormData(formData);

    this.showLoading('Saving profile...');

    try {
      const result = await saveProfile(sanitizedData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save profile');
      }

      this.profile = sanitizedData;
      this.showToast('Profile saved successfully!', 'success');
      this.updateStatus();
    } catch (error) {
      console.error('Error saving profile:', error);
      this.showToast(error.message || 'Failed to save profile', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async handleSaveApiKey() {
    const apiKey = this.elements.apiKey.value.trim();
    
    if (!apiKey) {
      this.showToast('Please enter an API key', 'error');
      return;
    }

    if (!apiKey.startsWith('gsk_')) {
      this.showToast('Invalid API key format. Groq API keys start with "gsk_"', 'error');
      return;
    }

    this.showLoading('Saving API key...');

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'SAVE_API_KEY',
        payload: { apiKey }
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save API key');
      }

      this.elements.apiKey.value = '••••••••••••••••';
      this.showToast('API key saved successfully!', 'success');
      this.updateStatus();
    } catch (error) {
      console.error('[Popup] Error saving API key:', error);
      this.showToast(error.message || 'Failed to save API key', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async handleFillForm() {
    if (this.isProcessing) {
      return;
    }

    const formData = this.getFormData();
    const validation = validateFormData(formData);
    
    if (!validation.valid) {
      const firstError = getFirstError(validation);
      this.showToast(firstError, 'error');
      this.focusFirstError(validation.fieldErrors);
      return;
    }

    const sanitizedData = sanitizeFormData(formData);
    
    this.showLoading('Saving profile...');
    try {
      const result = await saveProfile(sanitizedData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save profile');
      }
      
      this.profile = sanitizedData;
    } catch (error) {
      console.error('Error saving profile:', error);
      this.showToast(error.message || 'Failed to save profile', 'error');
      this.hideLoading();
      return;
    }

    try {
      const isReviewMode = this.elements.reviewModeToggle.checked;
      
      console.log(`[Popup] Sending FILL_FORM message to background with review mode: ${isReviewMode}`);
      
      this.isProcessing = true;
      if (isReviewMode) {
        this.showLoading('AI is analyzing form...');
        this.reviewTimer = setTimeout(() => {
          if (this.isProcessing) {
            this.elements.loadingText.textContent = 'Please review fields on the page...';
          }
        }, 3000);
      } else {
        this.showLoading('Filling form with AI...');
      }

      const response = await chrome.runtime.sendMessage({
        type: 'FILL_FORM',
        payload: { reviewMode: isReviewMode }
      });

      if (this.reviewTimer) clearTimeout(this.reviewTimer);
      this.handleFillResponse(response);
    } catch (error) {
      if (this.reviewTimer) clearTimeout(this.reviewTimer);
      
      // If error is due to popup closing, just log it
      if (error.message.includes('message channel closed')) {
        console.log('[Popup] Message channel closed (popup likely closed). Process continues in background.');
        return;
      }

      console.error('[Popup] Error filling form:', error);
      
      if (error.message.includes('Receiving end does not exist')) {
        this.showToast('Content script not loaded. Refresh the page and try again.', 'error');
      } else {
        this.showToast(error.message || 'Failed to fill form. Make sure you are on a page with forms.', 'error');
      }
      this.hideLoading();
    }
  }

  async checkFillingStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_FILL_STATUS' });
      if (response.success && response.status) {
        const { active, result, reviewMode } = response.status;
        
        if (active) {
          console.log('[Popup] Detected active fill process, re-attaching...');
          this.isProcessing = true;
          this.showLoading(reviewMode ? 'Please review fields on the page...' : 'Filling form with AI...');
          this.startStatusPolling();
        } else if (result) {
          console.log('[Popup] Detected pending fill result, showing...');
          this.handleFillResponse(result);
          chrome.runtime.sendMessage({ type: 'CLEAR_FILL_STATUS' });
        }
      }
    } catch (error) {
      console.error('[Popup] Error checking fill status:', error);
    }
  }

  startStatusPolling() {
    if (this.statusPollingInterval) clearInterval(this.statusPollingInterval);
    
    this.statusPollingInterval = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_FILL_STATUS' });
        if (response.success && response.status && !response.status.active) {
          clearInterval(this.statusPollingInterval);
          this.statusPollingInterval = null;
          
          if (response.status.result) {
            this.handleFillResponse(response.status.result);
            chrome.runtime.sendMessage({ type: 'CLEAR_FILL_STATUS' });
          }
        }
      } catch (error) {
        console.error('[Popup] Status polling error:', error);
        clearInterval(this.statusPollingInterval);
        this.statusPollingInterval = null;
      }
    }, 1000);
  }

  handleFillResponse(response) {
    this.hideLoading();
    
    if (!response.success) {
      this.showToast(response.error || 'Failed to fill form', 'error');
      return;
    }

    if (response.cancelled) {
      this.showToast('Fill cancelled by user');
      return;
    }

    this.showToast(`Form filled successfully! ${response.filled} fields filled, ${response.skipped} skipped`, 'success');
  }

  getFormData() {
    return {
      name: this.elements.name.value,
      email: this.elements.email.value,
      phone: this.elements.phone.value,
      address: this.elements.address.value,
      skills: this.elements.skills.value,
      experience: this.elements.experience.value
    };
  }

  focusFirstError(fieldErrors) {
    if (!fieldErrors) return;

    const errorFields = Object.keys(fieldErrors);
    if (errorFields.length > 0) {
      const firstField = errorFields[0];
      const element = this.elements[firstField];
      if (element) {
        element.focus();
      }
    }
  }

  updateStatus() {
    const hasProfile = this.profile && this.profile.name && this.profile.email;
    const hasApiKey = this.elements.apiKey.value && this.elements.apiKey.value !== '' && this.elements.apiKey.value !== '••••••••••••••••';
    
    this.elements.fillFormBtn.disabled = !hasProfile;

    if (hasProfile && hasApiKey) {
      this.elements.statusIndicator.classList.remove('incomplete');
      this.elements.statusText.textContent = 'Ready';
    } else if (!hasApiKey) {
      this.elements.statusIndicator.classList.add('incomplete');
      this.elements.statusText.textContent = 'No API key';
    } else {
      this.elements.statusIndicator.classList.add('incomplete');
      this.elements.statusText.textContent = 'Incomplete';
    }
  }

  showToast(message, type = 'success') {
    this.elements.toastMessage.textContent = message;
    this.elements.toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      this.elements.toast.classList.remove('show');
      this.elements.toast.classList.add('hidden');
    }, 3000);
  }

  showLoading(text = 'Processing...') {
    this.isProcessing = true;
    this.elements.loadingText.textContent = text;
    this.elements.loadingOverlay.classList.remove('hidden');
    this.elements.loadingOverlay.classList.add('show');
  }

  hideLoading() {
    this.isProcessing = false;
    this.elements.loadingOverlay.classList.remove('show');
    this.elements.loadingOverlay.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    new PopupController();
  } catch (error) {
    console.error('Failed to initialize popup:', error);
  }
});
