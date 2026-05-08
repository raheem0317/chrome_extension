import { FIELD_TYPES } from '../shared/constants.js';
import { isElementVisible, isElementInteractable } from '../shared/utils.js';

/**
 * Form Detector - Dynamically discovers form fields
 */
class FormDetector {
  constructor() {
    this.observedForms = new Set();
    this.mutationObserver = null;
  }

  /**
   * Detect all form fields on the page
   */
  detectFields() {
    const fields = [];
    const processedIds = new Set();

    // Get all form elements
    const forms = document.querySelectorAll('form');
    const standaloneFields = this.findStandaloneFields();

    // Process form fields
    forms.forEach(form => {
      const formFields = this.scanForm(form, processedIds);
      fields.push(...formFields);
    });

    // Process standalone fields
    standaloneFields.forEach(field => {
      const fieldData = this.analyzeField(field, processedIds);
      if (fieldData) {
        fields.push(fieldData);
      }
    });

    // Scan shadow DOM
    const shadowFields = this.scanShadowDOM(processedIds);
    fields.push(...shadowFields);

    return fields;
  }

  /**
   * Find fields outside of forms
   */
  findStandaloneFields() {
    const selectors = [
      'input:not(form input)',
      'textarea:not(form textarea)',
      'select:not(form select)'
    ];

    const fields = [];
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        // Skip if inside a form
        if (!el.closest('form')) {
          fields.push(el);
        }
      });
    });

    return fields;
  }

  /**
   * Scan a form element for fields
   */
  scanForm(form, processedIds) {
    const fields = [];
    const formElements = form.querySelectorAll('input, textarea, select');

    formElements.forEach(element => {
      const fieldData = this.analyzeField(element, processedIds);
      if (fieldData) {
        fields.push(fieldData);
      }
    });

    return fields;
  }

  /**
   * Analyze a single field element
   */
  analyzeField(element, processedIds) {
    // Skip if already processed
    const fieldId = this.generateFieldId(element);
    if (processedIds.has(fieldId)) {
      return null;
    }
    processedIds.add(fieldId);

    // Skip hidden fields
    if (!isElementVisible(element)) {
      return null;
    }

    // Skip certain field types
    const type = this.getFieldType(element);
    if (type === FIELD_TYPES.HIDDEN || type === FIELD_TYPES.FILE || type === FIELD_TYPES.SUBMIT) {
      return null;
    }

    // Get field metadata
    const metadata = {
      id: fieldId,
      type: type,
      name: element.name || '',
      idAttr: element.id || '',
      label: this.findLabel(element),
      placeholder: element.placeholder || '',
      value: element.value || '',
      required: element.required || false,
      disabled: element.disabled || false,
      readonly: element.readOnly || false,
      options: this.getOptions(element),
      maxLength: element.maxLength || -1,
      pattern: element.pattern || ''
    };

    return metadata;
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
   * Find label for a field
   */
  findLabel(element) {
    // Check for label with for attribute
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }

    // Check for parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      // Exclude the field's own text
      const text = parentLabel.textContent.replace(element.value, '').trim();
      return text;
    }

    // Check for aria-label
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }

    // Check for preceding text
    const preceding = this.findPrecedingText(element);
    if (preceding) {
      return preceding;
    }

    return '';
  }

  /**
   * Find text preceding a field
   */
  findPrecedingText(element) {
    let sibling = element.previousElementSibling;
    
    while (sibling) {
      if (sibling.tagName === 'LABEL') {
        return sibling.textContent.trim();
      }
      if (sibling.textContent && sibling.textContent.trim().length > 0) {
        const text = sibling.textContent.trim();
        if (text.length < 100) {
          return text;
        }
      }
      sibling = sibling.previousElementSibling;
    }

    return '';
  }

  /**
   * Get options for select/radio/checkbox
   */
  getOptions(element) {
    if (element.tagName === 'SELECT') {
      return Array.from(element.options).map(opt => opt.value);
    }
    
    if (element.type === 'radio' || element.type === 'checkbox') {
      const name = element.name;
      if (name) {
        const radios = document.querySelectorAll(`input[name="${name}"]`);
        return Array.from(radios).map(r => r.value);
      }
    }
    
    return [];
  }

  /**
   * Scan shadow DOM for fields
   */
  scanShadowDOM(processedIds) {
    const fields = [];
    
    // Find all shadow hosts
    const shadowHosts = document.querySelectorAll('*');
    
    shadowHosts.forEach(host => {
      if (host.shadowRoot) {
        const shadowFields = host.shadowRoot.querySelectorAll('input, textarea, select');
        shadowFields.forEach(field => {
          const fieldData = this.analyzeField(field, processedIds);
          if (fieldData) {
            fields.push(fieldData);
          }
        });
      }
    });

    return fields;
  }

  /**
   * Generate unique field ID
   */
  generateFieldId(element) {
    const parts = [];
    
    if (element.id) {
      parts.push(`id:${element.id}`);
    }
    if (element.name) {
      parts.push(`name:${element.name}`);
    }
    if (element.type) {
      parts.push(`type:${element.type}`);
    }
    
    const base = parts.join('|') || 'unnamed';
    
    // Add index for uniqueness
    const index = Array.from(document.querySelectorAll(element.tagName)).indexOf(element);
    return `${base}[${index}]`;
  }

  /**
   * Start observing DOM changes for dynamic forms
   */
  startObserving(callback) {
    if (this.mutationObserver) {
      this.stopObserving();
    }

    this.mutationObserver = new MutationObserver((mutations) => {
      let hasFormChanges = false;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'FORM' || 
                node.tagName === 'INPUT' || 
                node.tagName === 'TEXTAREA' || 
                node.tagName === 'SELECT') {
              hasFormChanges = true;
            }
            
            // Check children
            const forms = node.querySelectorAll?.('form, input, textarea, select');
            if (forms && forms.length > 0) {
              hasFormChanges = true;
            }
          }
        });
      });

      if (hasFormChanges && callback) {
        callback();
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Stop observing DOM changes
   */
  stopObserving() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  /**
   * Find field by ID
   */
  findFieldById(fieldId) {
    const fields = this.detectFields();
    return fields.find(f => f.id === fieldId);
  }

  /**
   * Get DOM element for a field
   */
  getFieldElement(fieldId) {
    const fields = this.detectFields();
    const field = fields.find(f => f.id === fieldId);
    
    if (!field) {
      return null;
    }

    if (field.idAttr) {
      return document.getElementById(field.idAttr);
    }
    
    if (field.name) {
      return document.querySelector(`[name="${field.name}"]`);
    }

    return null;
  }
}

export default FormDetector;
