/**
 * Validation Utility Module
 * Handles form validation with robust error checking
 */

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number format (basic validation)
 * @param {string} phone - Phone number to validate
 * @returns {boolean}
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return true; // Phone is optional
  }

  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone.trim());
}

/**
 * Validate required fields
 * @param {Object} formData - Form data object
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {{valid: boolean, errors: Array<string>}}
 */
function validateRequiredFields(formData, requiredFields = ['name', 'email']) {
  const errors = [];

  if (!formData || typeof formData !== 'object') {
    return { valid: false, errors: ['Invalid form data'] };
  }

  requiredFields.forEach(field => {
    const value = formData[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
      errors.push(`${fieldName} is required`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate email field specifically
 * @param {string} email - Email to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateEmailField(email) {
  if (!email || (typeof email === 'string' && email.trim() === '')) {
    return { valid: false, error: 'Email is required' };
  }

  if (!isValidEmail(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true };
}

/**
 * Validate complete form data
 * @param {Object} formData - Form data object
 * @returns {{valid: boolean, errors: Array<string>, fieldErrors: Object}}
 */
function validateFormData(formData) {
  const errors = [];
  const fieldErrors = {};

  // Validate required fields
  const requiredValidation = validateRequiredFields(formData, ['name', 'email']);
  if (!requiredValidation.valid) {
    errors.push(...requiredValidation.errors);
    requiredValidation.errors.forEach(err => {
      const field = err.toLowerCase().split(' ')[0];
      fieldErrors[field] = err;
    });
  }

  // Validate email format
  if (formData.email) {
    const emailValidation = validateEmailField(formData.email);
    if (!emailValidation.valid) {
      if (!fieldErrors.email) {
        errors.push(emailValidation.error);
        fieldErrors.email = emailValidation.error;
      }
    }
  }

  // Validate phone format (optional)
  if (formData.phone && !isValidPhone(formData.phone)) {
    errors.push('Please enter a valid phone number');
    fieldErrors.phone = 'Please enter a valid phone number';
  }

  // Validate field lengths
  if (formData.name && formData.name.length > 100) {
    errors.push('Name is too long (max 100 characters)');
    fieldErrors.name = 'Name is too long';
  }

  if (formData.email && formData.email.length > 254) {
    errors.push('Email is too long');
    fieldErrors.email = 'Email is too long';
  }

  if (formData.skills && formData.skills.length > 1000) {
    errors.push('Skills description is too long (max 1000 characters)');
    fieldErrors.skills = 'Skills description is too long';
  }

  if (formData.experience && formData.experience.length > 2000) {
    errors.push('Experience description is too long (max 2000 characters)');
    fieldErrors.experience = 'Experience description is too long';
  }

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors
  };
}

/**
 * Sanitize string input
 * @param {string} str - String to sanitize
 * @returns {string}
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.trim().replace(/[<>]/g, '');
}

/**
 * Sanitize form data
 * @param {Object} formData - Form data to sanitize
 * @returns {Object}
 */
function sanitizeFormData(formData) {
  if (!formData || typeof formData !== 'object') {
    return {};
  }

  const sanitized = {};
  for (const key in formData) {
    if (typeof formData[key] === 'string') {
      sanitized[key] = sanitizeString(formData[key]);
    } else {
      sanitized[key] = formData[key];
    }
  }

  return sanitized;
}

/**
 * Get first error from validation result
 * @param {Object} validationResult - Validation result object
 * @returns {string}
 */
function getFirstError(validationResult) {
  if (validationResult && validationResult.errors && validationResult.errors.length > 0) {
    return validationResult.errors[0];
  }
  return 'Validation failed';
}

export {
  isValidEmail,
  isValidPhone,
  validateRequiredFields,
  validateEmailField,
  validateFormData,
  sanitizeString,
  sanitizeFormData,
  getFirstError
};
