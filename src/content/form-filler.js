import { FIELD_TYPES } from '../shared/constants.js';
import { isElementInteractable } from '../shared/utils.js';

/**
 * Form Filler - Injects values into form fields
 */
class FormFiller {
  constructor() {
    this.filledFields = new Map();
  }

  /**
   * Fill fields based on mapping
   */
  async fillFields(fieldMapping, profile) {
    const results = {
      success: true,
      filled: 0,
      skipped: 0,
      errors: []
    };

    for (const [fieldId, profileField] of Object.entries(fieldMapping)) {
      if (!profileField || !profile[profileField]) {
        results.skipped++;
        continue;
      }

      const value = profile[profileField];
      const result = await this.fillField(fieldId, value, profileField);

      if (result.success) {
        results.filled++;
        this.filledFields.set(fieldId, value);
      } else {
        results.errors.push(result.error);
      }
    }

    results.success = results.errors.length === 0;
    return results;
  }

  /**
   * Fill a single field
   */
  async fillField(fieldId, value, profileField) {
    try {
      const element = this.findElementById(fieldId);
      
      if (!element) {
        return { success: false, error: `Field not found: ${fieldId}` };
      }

      if (!isElementInteractable(element)) {
        return { success: false, error: `Field not interactable: ${fieldId}` };
      }

      const fieldType = this.getFieldType(element);
      
      switch (fieldType) {
        case FIELD_TYPES.SELECT:
          return this.fillSelect(element, value);
        case FIELD_TYPES.CHECKBOX:
          return this.fillCheckbox(element, value);
        case FIELD_TYPES.RADIO:
          return this.fillRadio(element, value);
        case FIELD_TYPES.TEXTAREA:
          return this.fillTextarea(element, value);
        default:
          return this.fillInput(element, value);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Find element by field ID
   */
  findElementById(fieldId) {
    // Parse field ID (format: "name:value|type:value[index]")
    const nameMatch = fieldId.match(/name:([^|]+)/);
    const idMatch = fieldId.match(/id:([^|[\]]+)/);
    const indexMatch = fieldId.match(/\[(\d+)\]/);

    let element = null;

    // Try by ID first
    if (idMatch) {
      element = document.getElementById(idMatch[1]);
    }

    // Try by name
    if (!element && nameMatch) {
      const elements = document.querySelectorAll(`[name="${nameMatch[1]}"]`);
      if (elements.length > 0) {
        const index = indexMatch ? parseInt(indexMatch[1]) : 0;
        element = elements[index] || elements[0];
      }
    }

    return element;
  }

  /**
   * Get field type
   */
  getFieldType(element) {
    if (element.tagName === 'TEXTAREA') {
      return FIELD_TYPES.TEXTAREA;
    }
    if (element.tagName === 'SELECT') {
      return FIELD_TYPES.SELECT;
    }
    if (element.tagName === 'INPUT') {
      const type = element.type.toLowerCase();
      return FIELD_TYPES[type.toUpperCase()] || FIELD_TYPES.TEXT;
    }
    return FIELD_TYPES.TEXT;
  }

  /**
   * Fill input field
   */
  async fillInput(element, value) {
    // Focus the element
    element.focus();

    // Clear existing value
    element.value = '';

    // Set value using setter
    this.setNativeValue(element, value);

    // Trigger React/Vue events
    this.triggerEvents(element, 'input');
    this.triggerEvents(element, 'change');
    this.triggerEvents(element, 'blur');

    // Blur the element
    element.blur();

    return { success: true };
  }

  /**
   * Fill textarea
   */
  async fillTextarea(element, value) {
    element.focus();
    element.value = '';
    this.setNativeValue(element, value);
    this.triggerEvents(element, 'input');
    this.triggerEvents(element, 'change');
    this.triggerEvents(element, 'blur');
    element.blur();

    return { success: true };
  }

  /**
   * Fill select dropdown
   */
  async fillSelect(element, value) {
    element.focus();

    // Find matching option
    let matchingOption = null;
    
    // Try exact match
    matchingOption = Array.from(element.options).find(opt => opt.value === value);
    
    // Try case-insensitive match
    if (!matchingOption) {
      matchingOption = Array.from(element.options).find(opt => 
        opt.value.toLowerCase() === value.toLowerCase() ||
        opt.text.toLowerCase() === value.toLowerCase()
      );
    }

    if (matchingOption) {
      element.value = matchingOption.value;
      this.triggerEvents(element, 'change');
      this.triggerEvents(element, 'blur');
      element.blur();
      return { success: true };
    }

    return { success: false, error: `No matching option found for value: ${value}` };
  }

  /**
   * Fill checkbox
   */
  async fillCheckbox(element, value) {
    element.focus();

    const shouldBeChecked = this.shouldCheckCheckbox(value);
    
    if (element.checked !== shouldBeChecked) {
      element.checked = shouldBeChecked;
      this.triggerEvents(element, 'change');
      this.triggerEvents(element, 'click');
    }

    element.blur();
    return { success: true };
  }

  /**
   * Fill radio button
   */
  async fillRadio(element, value) {
    const name = element.name;
    if (!name) {
      return { success: false, error: 'Radio button has no name attribute' };
    }

    const radios = document.querySelectorAll(`input[name="${name}"]`);
    let matchingRadio = null;

    // Find matching radio
    matchingRadio = Array.from(radios).find(radio => radio.value === value);
    
    // Try case-insensitive match
    if (!matchingRadio) {
      matchingRadio = Array.from(radios).find(radio => 
        radio.value.toLowerCase() === value.toLowerCase()
      );
    }

    if (matchingRadio) {
      matchingRadio.focus();
      matchingRadio.checked = true;
      this.triggerEvents(matchingRadio, 'change');
      this.triggerEvents(matchingRadio, 'click');
      matchingRadio.blur();
      return { success: true };
    }

    return { success: false, error: `No matching radio found for value: ${value}` };
  }

  /**
   * Determine if checkbox should be checked
   */
  shouldCheckCheckbox(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      return ['true', 'yes', 'on', '1', 'checked'].includes(lowerValue);
    }
    return false;
  }

  /**
   * Set native value using Object.defineProperty
   */
  setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter?.call(element, value);
    } else {
      valueSetter?.call(element, value);
    }

    element.value = value;
  }

  /**
   * Trigger events on element
   */
  triggerEvents(element, eventType) {
    const events = [eventType];
    
    // Trigger additional events for React/Vue compatibility
    if (eventType === 'input') {
      events.push('input');
    }
    if (eventType === 'change') {
      events.push('change');
    }

    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    });

    // Also trigger React-specific events if present
    if (element._valueTracker) {
      element._valueTracker.setValue('');
    }
    
    if (element._reactProps) {
      const setter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
      setter?.call(element, value);
    }
  }

  /**
   * Clear all filled fields
   */
  clearFilledFields() {
    this.filledFields.forEach((value, fieldId) => {
      const element = this.findElementById(fieldId);
      if (element && isElementInteractable(element)) {
        element.value = '';
        this.triggerEvents(element, 'input');
        this.triggerEvents(element, 'change');
      }
    });
    this.filledFields.clear();
  }

  /**
   * Get count of filled fields
   */
  getFilledCount() {
    return this.filledFields.size;
  }

  /**
   * Reset state
   */
  reset() {
    this.filledFields.clear();
  }
}

export default FormFiller;
