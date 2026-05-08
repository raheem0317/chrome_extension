/**
 * Form Field Filling Utility
 * Handles intelligent form field filling with React/Vue compatibility
 * Supports various input types and frameworks
 * Production-ready with error handling and logging
 */

// ============================================================================
// FIELD TRACKING FOR MULTI-STEP FORMS
// ============================================================================

// Global tracking for filled fields to prevent re-filling in multi-step forms
const filledFieldIds = new Set();

/**
 * Check if a field has already been filled
 * @param {string} fieldId - The field identifier
 * @returns {boolean} - True if field was already filled
 */
function isFieldAlreadyFilled(fieldId) {
  return filledFieldIds.has(fieldId);
}

/**
 * Mark a field as filled
 * @param {string} fieldId - The field identifier
 */
function markFieldAsFilled(fieldId) {
  filledFieldIds.add(fieldId);
}

/**
 * Clear all filled field tracking
 * Call this when starting a new form fill operation
 */
function clearFilledFieldTracking() {
  filledFieldIds.clear();
  console.log('[FillFields] Cleared filled field tracking');
}

/**
 * Get all currently filled field IDs
 * @returns {Set<string>} - Set of filled field IDs
 */
function getFilledFieldIds() {
  return new Set(filledFieldIds);
}

// ============================================================================
// CORE FILLING FUNCTIONS
// ============================================================================

/**
 * Set the native value of an element using the native property descriptor
 * This bypasses React/Vue controlled component behavior
 * @param {HTMLElement} element - The element to set value on
 * @param {string} value - The value to set
 */
function setNativeValue(element, value) {
  try {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter?.call(element, value);
    } else {
      valueSetter?.call(element, value);
    }
  } catch (error) {
    console.error('[FillFields] Error setting native value:', error);
  }
}

/**
 * Dispatch React-specific events to trigger reactivity
 * @param {HTMLElement} element - The element to dispatch events on
 */
function dispatchReactEvents(element) {
  const events = ['input', 'change', 'blur'];
  events.forEach(eventType => {
    try {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    } catch (error) {
      console.error(`[FillFields] Error dispatching ${eventType} event:`, error);
    }
  });
}

/**
 * Dispatch Vue-specific events to trigger reactivity
 * @param {HTMLElement} element - The element to dispatch events on
 */
function dispatchVueEvents(element) {
  const events = ['input', 'change'];
  events.forEach(eventType => {
    try {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    } catch (error) {
      console.error(`[FillFields] Error dispatching ${eventType} event:`, error);
    }
  });
}

/**
 * Fill a text input field
 * @param {HTMLInputElement} element - The input element
 * @param {string} value - The value to fill
 * @param {boolean} skipAlreadyFilled - Skip if already filled
 * @returns {boolean} - True if successful or skipped
 */
function fillTextInput(element, value, skipAlreadyFilled = false) {
  try {
    if (!value || value === null) {
      return false;
    }

    const fieldId = element.id || element.name || element.type;
    
    if (skipAlreadyFilled && isFieldAlreadyFilled(fieldId)) {
      console.log(`[FillFields] Skipping already filled field: ${fieldId}`);
      return true;
    }

    element.focus();
    setNativeValue(element, value);
    dispatchReactEvents(element);
    dispatchVueEvents(element);
    element.blur();

    if (skipAlreadyFilled) {
      markFieldAsFilled(fieldId);
    }

    console.log(`[FillFields] Filled text input: ${fieldId}`);
    return true;
  } catch (error) {
    console.error('[FillFields] Error filling text input:', error);
    return false;
  }
}

/**
 * Fill a textarea field
 * @param {HTMLTextAreaElement} element - The textarea element
 * @param {string} value - The value to fill
 * @param {boolean} skipAlreadyFilled - Skip if already filled
 * @returns {boolean} - True if successful
 */
function fillTextarea(element, value, skipAlreadyFilled = false) {
  try {
    if (!value || value === null) {
      return false;
    }

    const fieldId = element.id || element.name || 'textarea';
    
    if (skipAlreadyFilled && isFieldAlreadyFilled(fieldId)) {
      console.log(`[FillFields] Skipping already filled textarea: ${fieldId}`);
      return true;
    }

    element.focus();
    setNativeValue(element, value);
    dispatchReactEvents(element);
    dispatchVueEvents(element);
    element.blur();

    if (skipAlreadyFilled) {
      markFieldAsFilled(fieldId);
    }

    console.log(`[FillFields] Filled textarea: ${fieldId}`);
    return true;
  } catch (error) {
    console.error('[FillFields] Error filling textarea:', error);
    return false;
  }
}

/**
 * Fill a select dropdown
 * @param {HTMLSelectElement} element - The select element
 * @param {string} value - The value to select
 * @param {boolean} skipAlreadyFilled - Skip if already filled
 * @returns {boolean} - True if successful
 */
function fillSelect(element, value, skipAlreadyFilled = false) {
  try {
    if (!value || value === null) {
      return false;
    }

    const fieldId = element.id || element.name || 'select';
    
    if (skipAlreadyFilled && isFieldAlreadyFilled(fieldId)) {
      console.log(`[FillFields] Skipping already filled select: ${fieldId}`);
      return true;
    }

    element.focus();

    let optionFound = false;
    for (const option of element.options) {
      if (option.value === value || option.text === value) {
        element.selectedIndex = option.index;
        optionFound = true;
        break;
      }
    }

    if (!optionFound) {
      const valueLower = value.toLowerCase();
      for (const option of element.options) {
        if (option.value.toLowerCase().includes(valueLower) ||
            option.text.toLowerCase().includes(valueLower)) {
          element.selectedIndex = option.index;
          optionFound = true;
          break;
        }
      }
    }

    if (optionFound) {
      dispatchReactEvents(element);
      dispatchVueEvents(element);
      element.blur();

      if (skipAlreadyFilled) {
        markFieldAsFilled(fieldId);
      }

      console.log(`[FillFields] Filled select: ${fieldId} with value: ${value}`);
      return true;
    }

    console.warn(`[FillFields] No matching option found for select: ${fieldId}, value: ${value}`);
    return false;
  } catch (error) {
    console.error('[FillFields] Error filling select:', error);
    return false;
  }
}

/**
 * Fill a radio button
 * @param {HTMLInputElement} element - The radio input element
 * @param {boolean} checked - Whether to check the radio
 * @param {boolean} skipAlreadyFilled - Skip if already filled
 * @returns {boolean} - True if successful
 */
function fillRadio(element, checked, skipAlreadyFilled = false) {
  try {
    const fieldId = element.name || 'radio';
    
    if (skipAlreadyFilled && isFieldAlreadyFilled(fieldId)) {
      console.log(`[FillFields] Skipping already filled radio group: ${fieldId}`);
      return true;
    }

    if (checked && !element.checked) {
      element.click();
      dispatchReactEvents(element);
      dispatchVueEvents(element);

      if (skipAlreadyFilled) {
        markFieldAsFilled(fieldId);
      }

      console.log(`[FillFields] Filled radio: ${fieldId}`);
    }

    return true;
  } catch (error) {
    console.error('[FillFields] Error filling radio:', error);
    return false;
  }
}

/**
 * Fill a checkbox
 * @param {HTMLInputElement} element - The checkbox input element
 * @param {boolean} checked - Whether to check the box
 * @param {boolean} skipAlreadyFilled - Skip if already filled
 * @returns {boolean} - True if successful
 */
function fillCheckbox(element, checked, skipAlreadyFilled = false) {
  try {
    const fieldId = element.id || element.name || 'checkbox';
    
    if (skipAlreadyFilled && isFieldAlreadyFilled(fieldId)) {
      console.log(`[FillFields] Skipping already filled checkbox: ${fieldId}`);
      return true;
    }

    if (element.checked !== checked) {
      element.click();
      dispatchReactEvents(element);
      dispatchVueEvents(element);

      if (skipAlreadyFilled) {
        markFieldAsFilled(fieldId);
      }

      console.log(`[FillFields] Filled checkbox: ${fieldId}`);
    }

    return true;
  } catch (error) {
    console.error('[FillFields] Error filling checkbox:', error);
    return false;
  }
}

// ============================================================================
// FIELD FINDING AND MAPPING
// ============================================================================

/**
 * Find an element by field ID from detected fields
 * @param {string} fieldId - The field ID to search for
 * @param {Array} detectedFields - Array of detected field metadata
 * @returns {HTMLElement|null} - The found element or null
 */
function findElementByFieldId(fieldId, detectedFields) {
  try {
    const field = detectedFields.find(f => f.id === fieldId);
    if (!field || !field.element) {
      return null;
    }
    
    if (!document.body.contains(field.element)) {
      console.warn(`[FillFields] Element for field ${fieldId} no longer in DOM`);
      return null;
    }

    return field.element;
  } catch (error) {
    console.error('[FillFields] Error finding element by field ID:', error);
    return null;
  }
}

/**
 * Fallback fill method using direct DOM manipulation
 * @param {HTMLElement} element - The element to fill
 * @param {string} value - The value to set
 * @returns {boolean} - True if successful
 */
function fallbackFill(element, value) {
  try {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  } catch (error) {
    console.error('[FillFields] Fallback fill failed:', error);
    return false;
  }
}

/**
 * Fill a field based on its type
 * @param {HTMLElement} element - The element to fill
 * @param {string} value - The value to fill
 * @param {boolean} skipAlreadyFilled - Skip if already filled
 * @returns {boolean} - True if successful
 */
function fillFieldByType(element, value, skipAlreadyFilled = false) {
  try {
    if (!element) return false;

    const tagName = element.tagName;
    const type = element.type?.toLowerCase() || '';

    if (tagName === 'TEXTAREA') {
      return fillTextarea(element, value, skipAlreadyFilled);
    }

    if (tagName === 'SELECT') {
      return fillSelect(element, value, skipAlreadyFilled);
    }

    if (tagName === 'INPUT') {
      switch (type) {
        case 'text':
        case 'email':
        case 'tel':
        case 'url':
        case 'search':
        case 'password':
        case 'number':
          return fillTextInput(element, value, skipAlreadyFilled);
        case 'radio':
          return fillRadio(element, value === true || value === 'true', skipAlreadyFilled);
        case 'checkbox':
          return fillCheckbox(element, value === true || value === 'true', skipAlreadyFilled);
        default:
          return fillTextInput(element, value, skipAlreadyFilled);
      }
    }

    console.warn(`[FillFields] Unknown field type: ${tagName}/${type}, trying fallback`);
    return fallbackFill(element, value);
  } catch (error) {
    console.error('[FillFields] Error filling field by type:', error);
    return false;
  }
}

// ============================================================================
// BATCH FILLING FUNCTIONS
// ============================================================================

/**
 * Fill multiple fields based on field mapping
 * @param {Object} fieldMapping - Object mapping field IDs to values
 * @param {Array} detectedFields - Array of detected field metadata
 * @param {boolean} skipAlreadyFilled - Skip fields that were already filled
 * @returns {Object} - Result with counts and errors
 */
function fillFields(fieldMapping, detectedFields, skipAlreadyFilled = false) {
  const result = {
    filled: 0,
    skipped: 0,
    alreadyFilled: 0,
    errors: []
  };

  console.log(`[FillFields] Starting batch fill for ${Object.keys(fieldMapping).length} fields`);

  for (const [fieldId, value] of Object.entries(fieldMapping)) {
    try {
      if (skipAlreadyFilled && isFieldAlreadyFilled(fieldId)) {
        result.alreadyFilled++;
        continue;
      }

      const element = findElementByFieldId(fieldId, detectedFields);
      
      if (!element) {
        result.errors.push({
          fieldId,
          error: 'Element not found'
        });
        result.skipped++;
        continue;
      }

      const success = fillFieldByType(element, value, skipAlreadyFilled);
      
      if (success) {
        result.filled++;
      } else {
        result.errors.push({
          fieldId,
          error: 'Fill operation failed'
        });
        result.skipped++;
      }
    } catch (error) {
      result.errors.push({
        fieldId,
        error: error.message
      });
      result.skipped++;
    }
  }

  console.log('[FillFields] Batch fill complete:', result);
  return result;
}

/**
 * Fill radio groups by name
 * @param {Object} fieldMapping - Object mapping field IDs to values
 * @param {Array} detectedFields - Array of detected field metadata
 * @param {boolean} skipAlreadyFilled - Skip if already filled
 * @returns {Object} - Result with counts and errors
 */
function fillRadioGroups(fieldMapping, detectedFields, skipAlreadyFilled = false) {
  const result = {
    filled: 0,
    skipped: 0,
    alreadyFilled: 0,
    errors: []
  };

  const radioGroups = {};
  detectedFields.forEach(field => {
    if (field.element && field.element.type === 'radio' && field.element.name) {
      const name = field.element.name;
      if (!radioGroups[name]) {
        radioGroups[name] = [];
      }
      radioGroups[name].push(field);
    }
  });

  console.log(`[FillFields] Found ${Object.keys(radioGroups).length} radio groups`);

  for (const [groupName, fields] of Object.entries(radioGroups)) {
    try {
      if (skipAlreadyFilled && isFieldAlreadyFilled(groupName)) {
        result.alreadyFilled += fields.length;
        continue;
      }

      const fieldId = fields[0]?.id;
      const value = fieldMapping[fieldId];
      
      if (!value) {
        continue;
      }

      const matchingField = fields.find(f => 
        f.element.value === value || 
        f.element.id === value
      );

      if (matchingField && matchingField.element) {
        const success = fillRadio(matchingField.element, true, skipAlreadyFilled);
        if (success) {
          result.filled++;
          if (skipAlreadyFilled) {
            markFieldAsFilled(groupName);
          }
        } else {
          result.errors.push({
            fieldId: groupName,
            error: 'Failed to fill radio group'
          });
          result.skipped++;
        }
      } else {
        result.skipped++;
      }
    } catch (error) {
      result.errors.push({
        fieldId: groupName,
        error: error.message
      });
      result.skipped++;
    }
  }

  return result;
}

/**
 * Main function to fill all fields
 * @param {Object} fieldMapping - Field ID to value mapping
 * @param {Array} detectedFields - Array of detected field metadata
 * @param {boolean} skipAlreadyFilled - Skip fields that were already filled (default: true)
 * @returns {Object} - Result with counts and errors
 */
function fillAllFields(fieldMapping, detectedFields, skipAlreadyFilled = true) {
  console.log('[FillFields] Starting fillAllFields with skipAlreadyFilled:', skipAlreadyFilled);
  
  const standardResult = fillFields(fieldMapping, detectedFields, skipAlreadyFilled);
  const radioResult = fillRadioGroups(fieldMapping, detectedFields, skipAlreadyFilled);
  
  const combinedResult = {
    filled: standardResult.filled + radioResult.filled,
    skipped: standardResult.skipped + radioResult.skipped,
    alreadyFilled: standardResult.alreadyFilled + (radioResult.alreadyFilled || 0),
    errors: [...standardResult.errors, ...radioResult.errors],
    total: Object.keys(fieldMapping).length
  };

  console.log('[FillFields] fillAllFields complete:', combinedResult);
  return combinedResult;
}

// Functions are available in global scope when loaded as content scripts in manifest.js sequence
