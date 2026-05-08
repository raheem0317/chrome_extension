/**
 * Form Field Detection Utility
 * Dynamically detects and extracts metadata from form fields
 * Works with React, Vue, and vanilla HTML forms
 * Production-ready with performance optimizations
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  MAX_SHADOW_DOM_SCAN_DEPTH: 3,
  MAX_PRECEDING_SIBLINGS: 5,
  MAX_TEXT_LENGTH: 100,
  FIELD_CACHE_TTL: 5000, // 5 seconds
  SHADOW_DOM_SCAN_ENABLED: true
};

// ============================================================================
// CACHING
// ============================================================================

let fieldCache = {
  data: null,
  timestamp: 0
};

/**
 * Get cached fields if still valid
 * @returns {Array|null} - Cached fields or null if expired
 */
function getCachedFields() {
  const now = Date.now();
  if (fieldCache.data && (now - fieldCache.timestamp) < CONFIG.FIELD_CACHE_TTL) {
    return fieldCache.data;
  }
  return null;
}

/**
 * Cache field detection results
 * @param {Array} fields - Fields to cache
 */
function cacheFields(fields) {
  fieldCache = {
    data: fields,
    timestamp: Date.now()
  };
}

/**
 * Clear the field cache
 */
function clearFieldCache() {
  fieldCache = {
    data: null,
    timestamp: 0
  };
  console.log('[DetectFields] Field cache cleared');
}

// ============================================================================
// VISIBILITY AND INTERACTABILITY
// ============================================================================

/**
 * Check if an element is visible in the DOM
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} - True if element is visible
 */
function isElementVisible(element) {
  if (!element) return false;
  
  try {
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    );
  } catch (error) {
    console.error('[DetectFields] Error checking element visibility:', error);
    return false;
  }
}

/**
 * Check if an element is interactable (not disabled or readonly)
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} - True if element can be interacted with
 */
function isElementInteractable(element) {
  if (!element) return false;
  
  try {
    return !element.disabled && !element.readOnly && isElementVisible(element);
  } catch (error) {
    console.error('[DetectFields] Error checking element interactability:', error);
    return false;
  }
}

// ============================================================================
// FIELD TYPE DETECTION
// ============================================================================

/**
 * Get the field type based on the element
 * @param {HTMLElement} element - The form field element
 * @returns {string} - The field type
 */
function getFieldType(element) {
  if (!element) return 'text';
  
  try {
    if (element.tagName === 'TEXTAREA') {
      return 'textarea';
    }
    
    if (element.tagName === 'SELECT') {
      return 'select';
    }
    
    if (element.tagName === 'INPUT') {
      const type = element.type?.toLowerCase() || 'text';
      return type;
    }
    
    return 'text';
  } catch (error) {
    console.error('[DetectFields] Error getting field type:', error);
    return 'text';
  }
}

// ============================================================================
// LABEL DETECTION
// ============================================================================

/**
 * Find the label for a form field
 * Uses multiple strategies to find the most appropriate label
 * @param {HTMLElement} element - The form field element
 * @returns {string} - The label text
 */
function findLabel(element) {
  if (!element) return '';
  
  try {
    // Method 1: Check for label with for attribute matching element id
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }
    
    // Method 2: Check if element is inside a label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const text = parentLabel.textContent.replace(element.value, '').trim();
      return text;
    }
    
    // Method 3: Check for aria-label attribute
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label').trim();
    }
    
    // Method 4: Check for aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) {
        return labelElement.textContent.trim();
      }
    }
    
    // Method 5: Search for preceding text content
    const precedingText = findPrecedingText(element);
    if (precedingText) {
      return precedingText;
    }
    
    return '';
  } catch (error) {
    console.error('[DetectFields] Error finding label:', error);
    return '';
  }
}

/**
 * Find text content preceding an element
 * @param {HTMLElement} element - The element to search from
 * @returns {string} - The preceding text
 */
function findPrecedingText(element) {
  if (!element) return '';
  
  try {
    let sibling = element.previousElementSibling;
    let count = 0;
    
    while (sibling && count < CONFIG.MAX_PRECEDING_SIBLINGS) {
      if (sibling.tagName === 'LABEL') {
        return sibling.textContent.trim();
      }
      
      const text = sibling.textContent?.trim() || '';
      if (text.length > 0 && text.length < CONFIG.MAX_TEXT_LENGTH) {
        return text;
      }
      
      sibling = sibling.previousElementSibling;
      count++;
    }
    
    // Check parent's previous sibling
    const parent = element.parentElement;
    if (parent) {
      const parentSibling = parent.previousElementSibling;
      if (parentSibling) {
        const text = parentSibling.textContent?.trim() || '';
        if (text.length > 0 && text.length < CONFIG.MAX_TEXT_LENGTH) {
          return text;
        }
      }
    }
    
    return '';
  } catch (error) {
    console.error('[DetectFields] Error finding preceding text:', error);
    return '';
  }
}

// ============================================================================
// FIELD ID GENERATION
// ============================================================================

/**
 * Generate a unique ID for a field
 * @param {HTMLElement} element - The form field element
 * @returns {string} - A unique identifier
 */
function generateFieldId(element) {
  const parts = [];
  
  if (element.id) {
    parts.push(`id:${element.id}`);
  }
  
  if (element.name) {
    parts.push(`name:${element.name}`);
  }
  
  const type = getFieldType(element);
  parts.push(`type:${type}`);
  
  // Add index if no unique identifiers
  if (parts.length === 0) {
    parts.push(`index:${Array.from(document.querySelectorAll('input, textarea, select')).indexOf(element)}`);
  }
  
  return parts.join('|');
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

/**
 * Extract comprehensive metadata from a form field element
 * @param {HTMLElement} element - The form field element
 * @param {Set} processedIds - Set of already processed field IDs
 * @returns {Object|null} - Field metadata or null if invalid
 */
function extractFieldMetadata(element, processedIds) {
  if (!element || !isElementInteractable(element)) {
    return null;
  }
  
  try {
    const fieldId = generateFieldId(element);
    
    // Skip if already processed
    if (processedIds && processedIds.has(fieldId)) {
      return null;
    }
    
    // Mark as processed
    if (processedIds) {
      processedIds.add(fieldId);
    }
    
    const type = getFieldType(element);
    
    const metadata = {
      id: fieldId,
      element: element, // Store element reference for filling
      label: findLabel(element),
      name: element.name || '',
      placeholder: element.placeholder || '',
      type: type,
      required: element.required || false,
      idAttr: element.id || '',
      ariaLabel: element.getAttribute('aria-label') || '',
      maxLength: element.maxLength || -1,
      pattern: element.pattern || ''
    };
    
    return metadata;
  } catch (error) {
    console.error('[DetectFields] Error extracting field metadata:', error);
    return null;
  }
}

// ============================================================================
// DOM SCANNING
// ============================================================================

/**
 * Scan a specific DOM subtree for form fields
 * @param {HTMLElement} root - The root element to scan
 * @param {Set} processedIds - Set of already processed field IDs
 * @returns {Array<Object>} - Array of field metadata
 */
function scanSubtree(root, processedIds) {
  if (!root) return [];
  
  const fields = [];
  const startTime = performance.now();
  
  try {
    // Single optimized selector for all form field types
    const selector = [
      'input:not([type="submit"]):not([type="button"]):not([type="hidden"]):not([type="file"]):not([type="reset"]):not([type="image"])',
      'textarea',
      'select'
    ].join(',');
    
    const elements = root.querySelectorAll(selector);
    
    elements.forEach(element => {
      const metadata = extractFieldMetadata(element, processedIds);
      if (metadata) {
        fields.push(metadata);
      }
    });
    
    const duration = performance.now() - startTime;
    console.log(`[DetectFields] Scanned ${fields.length} fields in ${duration.toFixed(2)}ms`);
    
    return fields;
  } catch (error) {
    console.error('[DetectFields] Error scanning subtree:', error);
    return fields;
  }
}

/**
 * Scan shadow DOM for form fields (for web components)
 * Optimized to avoid excessive scanning
 * @param {Set} processedIds - Set of already processed field IDs
 * @returns {Array<Object>} - Array of field metadata from shadow DOM
 */
function scanShadowDOM(processedIds) {
  if (!CONFIG.SHADOW_DOM_SCAN_ENABLED) {
    return [];
  }
  
  const fields = [];
  const startTime = performance.now();
  
  try {
    // Only scan elements that are likely to be shadow hosts
    const potentialHosts = document.querySelectorAll('custom-element, [data-has-shadow], *');
    let scannedCount = 0;
    
    potentialHosts.forEach(host => {
      if (scannedCount >= 100) return; // Limit scan for performance
      
      if (host.shadowRoot) {
        const shadowFields = scanSubtree(host.shadowRoot, processedIds);
        fields.push(...shadowFields);
        scannedCount++;
      }
    });
    
    const duration = performance.now() - startTime;
    if (fields.length > 0) {
      console.log(`[DetectFields] Scanned shadow DOM: ${fields.length} fields in ${duration.toFixed(2)}ms`);
    }
    
    return fields;
  } catch (error) {
    console.error('[DetectFields] Error scanning shadow DOM:', error);
    return fields;
  }
}

// ============================================================================
// MAIN DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect all form fields on the page
 * Uses caching to improve performance
 * @returns {Array<Object>} - Array of field metadata objects
 */
function detectAllFields() {
  // Check cache first
  const cached = getCachedFields();
  if (cached) {
    console.log('[DetectFields] Using cached fields');
    return cached;
  }
  
  const startTime = performance.now();
  const processedIds = new Set();
  const fields = [];
  
  try {
    // Scan main document
    const mainFields = scanSubtree(document.body, processedIds);
    fields.push(...mainFields);
    
    // Scan shadow DOM
    const shadowFields = scanShadowDOM(processedIds);
    fields.push(...shadowFields);
    
    // Cache results
    cacheFields(fields);
    
    const duration = performance.now() - startTime;
    console.log(`[DetectFields] Detected ${fields.length} fields in ${duration.toFixed(2)}ms`);
    
    return fields;
  } catch (error) {
    console.error('[DetectFields] Error detecting all fields:', error);
    return fields;
  }
}

/**
 * Detect form fields within a specific form element
 * @param {HTMLFormElement} form - The form element to scan
 * @returns {Array<Object>} - Array of field metadata objects
 */
function detectFieldsInForm(form) {
  if (!form) return [];
  
  const processedIds = new Set();
  return scanSubtree(form, processedIds);
}

/**
 * Find form fields that are outside of <form> tags
 * @returns {Array<Object>} - Array of standalone field metadata
 */
function detectStandaloneFields() {
  const processedIds = new Set();
  const fields = [];
  
  try {
    const selectors = [
      'input:not(form input):not([type="submit"]):not([type="button"]):not([type="hidden"]):not([type="file"]):not([type="reset"]):not([type="image"])',
      'textarea:not(form textarea)',
      'select:not(form select)'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        // Skip if inside a form
        if (!element.closest('form')) {
          const metadata = extractFieldMetadata(element, processedIds);
          if (metadata) {
            fields.push(metadata);
          }
        }
      });
    });
    
    return fields;
  } catch (error) {
    console.error('[DetectFields] Error detecting standalone fields:', error);
    return fields;
  }
}

/**
 * Group fields by their containing form
 * @returns {Map<HTMLFormElement, Array<Object>>} - Map of form to fields
 */
function groupFieldsByForm() {
  const formGroups = new Map();
  
  try {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const fields = detectFieldsInForm(form);
      if (fields.length > 0) {
        formGroups.set(form, fields);
      }
    });
    
    // Add standalone fields
    const standaloneFields = detectStandaloneFields();
    if (standaloneFields.length > 0) {
      formGroups.set(null, standaloneFields);
    }
    
    console.log(`[DetectFields] Grouped fields into ${formGroups.size} forms`);
    return formGroups;
  } catch (error) {
    console.error('[DetectFields] Error grouping fields by form:', error);
    return formGroups;
  }
}

/**
 * Get field count on the page
 * @returns {number} - Total number of detected fields
 */
function getFieldCount() {
  try {
    return detectAllFields().length;
  } catch (error) {
    console.error('[DetectFields] Error getting field count:', error);
    return 0;
  }
}

/**
 * Find a field by its generated ID
 * @param {string} fieldId - The field ID to search for
 * @returns {HTMLElement|null} - The field element or null
 */
function findFieldById(fieldId) {
  try {
    const fields = detectAllFields();
    const field = fields.find(f => f.id === fieldId);
    
    if (!field) return null;
    
    // Verify element still exists in DOM
    if (field.element && document.body.contains(field.element)) {
      return field.element;
    }
    
    // Try to find by ID attribute
    if (field.idAttr) {
      const element = document.getElementById(field.idAttr);
      if (element) return element;
    }
    
    // Try to find by name
    if (field.name) {
      const element = document.querySelector(`[name="${field.name}"]`);
      if (element) return element;
    }
    
    return null;
  } catch (error) {
    console.error('[DetectFields] Error finding field by ID:', error);
    return null;
  }
}

/**
 * Check if the page has any forms
 * @returns {boolean} - True if forms are detected
 */
function hasForms() {
  try {
    return getFieldCount() > 0;
  } catch (error) {
    console.error('[DetectFields] Error checking for forms:', error);
    return false;
  }
}

// ============================================================================
// MULTI-STEP FORM SUPPORT
// ============================================================================

/**
 * Detect only new fields that weren't previously detected
 * @param {Array<Object>} previousFields - Previously detected fields
 * @returns {Array<Object>} - Array of new field metadata
 */
function detectNewFields(previousFields = []) {
  try {
    clearFieldCache(); // Force fresh detection
    const currentFields = detectAllFields();
    const previousIds = new Set(previousFields.map(f => f.id));
    
    const newFields = currentFields.filter(f => !previousIds.has(f.id));
    
    console.log(`[DetectFields] Detected ${newFields.length} new fields`);
    return newFields;
  } catch (error) {
    console.error('[DetectFields] Error detecting new fields:', error);
    return [];
  }
}

/**
 * Compare two field arrays to identify changes
 * @param {Array<Object>} oldFields - Previous field array
 * @param {Array<Object>} newFields - New field array
 * @returns {Object} - Object with added, removed, and unchanged fields
 */
function compareFieldLists(oldFields, newFields) {
  try {
    const oldIds = new Set(oldFields.map(f => f.id));
    const newIds = new Set(newFields.map(f => f.id));
    
    const added = newFields.filter(f => !oldIds.has(f.id));
    const removed = oldFields.filter(f => !newIds.has(f.id));
    const unchanged = newFields.filter(f => oldIds.has(f.id));
    
    return {
      added,
      removed,
      unchanged,
      hasChanges: added.length > 0 || removed.length > 0
    };
  } catch (error) {
    console.error('[DetectFields] Error comparing field lists:', error);
    return {
      added: [],
      removed: [],
      unchanged: newFields,
      hasChanges: false
    };
  }
}

/**
 * Check if fields are likely part of a multi-step form
 * Looks for common multi-step form patterns
 * @param {Array<Object>} fields - Detected fields
 * @returns {boolean} - True if appears to be multi-step
 */
function isMultiStepForm(fields) {
  if (fields.length === 0) return false;
  
  try {
    // Check for typical multi-step indicators
    const indicators = [
      '[role="progressbar"]',
      '.progress',
      '.step-indicator',
      '.wizard',
      '.multi-step',
      '[data-step]',
      '.tabs',
      '.tab-content',
      '.stepper',
      '[role="tablist"]'
    ];
    
    for (const selector of indicators) {
      if (document.querySelector(selector)) {
        console.log('[DetectFields] Detected multi-step form via:', selector);
        return true;
      }
    }
    
    // Check for form with multiple submit buttons (common in wizards)
    const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
    if (submitButtons.length > 1) {
      console.log('[DetectFields] Detected multi-step form via multiple submit buttons');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[DetectFields] Error checking for multi-step form:', error);
    return false;
  }
}

// Functions are available in global scope when loaded as content scripts in manifest.js sequence
