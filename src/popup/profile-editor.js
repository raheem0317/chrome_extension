import { DEFAULT_PROFILE } from '../shared/constants.js';
import { isValidEmail, isValidPhone } from '../shared/utils.js';

/**
 * Profile Editor - Manages profile form in popup
 */
class ProfileEditor {
  constructor(formElement) {
    this.form = formElement;
    this.currentProfile = { ...DEFAULT_PROFILE };
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  loadProfile(profile) {
    this.currentProfile = { ...DEFAULT_PROFILE, ...profile };
    this.populateForm();
  }

  populateForm() {
    const fields = Object.keys(DEFAULT_PROFILE);
    fields.forEach(field => {
      const input = this.form.querySelector(`#${field}`);
      if (input) {
        input.value = this.currentProfile[field] || '';
      }
    });
  }

  getFormData() {
    const formData = {};
    const fields = Object.keys(DEFAULT_PROFILE);
    
    fields.forEach(field => {
      const input = this.form.querySelector(`#${field}`);
      if (input) {
        formData[field] = input.value.trim();
      }
    });
    
    return formData;
  }

  validateForm(formData) {
    const errors = [];

    // Required fields
    if (!formData.firstName) {
      errors.push('First name is required');
    }
    if (!formData.lastName) {
      errors.push('Last name is required');
    }
    if (!formData.email) {
      errors.push('Email is required');
    } else if (!isValidEmail(formData.email)) {
      errors.push('Invalid email format');
    }

    // Optional field validation
    if (formData.phone && !isValidPhone(formData.phone)) {
      errors.push('Invalid phone number format');
    }

    return errors;
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const formData = this.getFormData();
    const errors = this.validateForm(formData);

    if (errors.length > 0) {
      this.showErrors(errors);
      return false;
    }

    this.currentProfile = { ...DEFAULT_PROFILE, ...formData };
    return this.currentProfile;
  }

  showErrors(errors) {
    // Remove existing error messages
    const existingErrors = this.form.querySelectorAll('.error-message');
    existingErrors.forEach(el => el.remove());

    // Show new errors
    errors.forEach(error => {
      const errorEl = document.createElement('div');
      errorEl.className = 'error-message';
      errorEl.textContent = error;
      errorEl.style.color = '#ef4444';
      errorEl.style.fontSize = '12px';
      errorEl.style.marginTop = '4px';
      this.form.insertBefore(errorEl, this.form.firstChild);
    });
  }

  clearErrors() {
    const existingErrors = this.form.querySelectorAll('.error-message');
    existingErrors.forEach(el => el.remove());
  }

  reset() {
    this.form.reset();
    this.currentProfile = { ...DEFAULT_PROFILE };
    this.clearErrors();
  }
}

export default ProfileEditor;
