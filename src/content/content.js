/**
 * Content Script - Main orchestrator for form field detection
 * Injected into webpages to detect and analyze form fields
 * Works with React, Vue, and vanilla HTML forms
 */

class ContentScript {
  constructor() {
    this.mutationObserver = null;
    this.debounceTimer = null;
    this.cachedFields = [];
    this.reviewMode = false;
    this.currentModal = null;
    this.isReady = false;
    this.currentFieldMapping = null;
    this.multiStepMode = false;
    this.autoFillEnabled = false;
    this.currentLoadingNotification = null;
    this.init();
  }

  /**
   * Initialize the content script
   */
  async init() {
    console.log('[AI Form Filler] Content script initializing...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.onReady());
    } else {
      this.onReady();
    }
  }

  /**
   * Called when DOM is ready
   */
  onReady() {
    console.log('[AI Form Filler] DOM ready, starting field detection...');
    
    // Initial field detection
    this.detectFields();
    
    // Setup MutationObserver for dynamic forms
    this.setupMutationObserver();
    
    // Setup message listener for popup communication
    this.setupMessageListener();
    
    // Mark as ready
    this.isReady = true;
    console.log('[AI Form Filler] Content script ready');
  }

  /**
   * Detect all form fields on the page
   * @returns {Array<Object>} - Array of field metadata
   */
  detectFields() {
    try {
      const fields = detectAllFields();
      this.cachedFields = fields;
      console.log(`[AI Form Filler] Detected ${fields.length} form fields`);
      return fields;
    } catch (error) {
      console.error('[AI Form Filler] Error detecting fields:', error);
      return [];
    }
  }

  /**
   * Setup MutationObserver to watch for DOM changes
   * This enables detection of dynamically rendered forms (React, Vue, etc.)
   */
  setupMutationObserver() {
    // Disconnect existing observer if any
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    // Create new MutationObserver
    this.mutationObserver = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    // Start observing the document body
    this.mutationObserver.observe(document.body, {
      childList: true,        // Watch for added/removed nodes
      subtree: true,          // Watch all descendants
      attributes: false,      // Don't watch attribute changes (performance)
      characterData: false    // Don't watch text content changes
    });

    console.log('[AI Form Filler] MutationObserver started with multi-step support');
  }

  /**
   * Handle DOM mutations with debouncing
   * Supports multi-step form auto-fill
   * @param {Array<MutationRecord>} mutations - Array of mutation records
   */
  handleMutations(mutations) {
    // Clear previous timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce detection to avoid excessive processing
    // Longer debounce for multi-step forms to avoid infinite loops
    const debounceDelay = this.multiStepMode ? 500 : 300;

    this.debounceTimer = setTimeout(() => {
      this.checkForFormChanges(mutations);
    }, debounceDelay);
  }
  /**
   * Check if mutations indicate form structure changes
   * @param {Array<MutationRecord>} mutations - Array of mutation records
   */
  checkForFormChanges(mutations) {
    let hasFormChanges = false;

    // Check each mutation for form-related changes
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if node is a form element or contains form fields
          if (this.isFormRelatedElement(node)) {
            hasFormChanges = true;
          }

          // Check children of the node
          if (node.querySelectorAll) {
            const formElements = node.querySelectorAll(
              'form, input, textarea, select'
            );
            if (formElements.length > 0) {
              hasFormChanges = true;
            }
          }
        }
      });
    });

    // Re-detect fields if form structure changed
    if (hasFormChanges) {
      console.log('[AI Form Filler] Form structure changed, re-detecting fields');
      this.handleFieldChange();
    }
  }

  /**
   * Handle field changes - detect new fields and auto-fill if in multi-step mode
   */
  handleFieldChange() {
    const oldFields = [...this.cachedFields];
    const newFields = detectAllFields();
    
    const comparison = compareFieldLists(oldFields, newFields);
    
    if (comparison.hasChanges) {
      console.log('[AI Form Filler] Fields changed:', {
        added: comparison.added.length,
        removed: comparison.removed.length,
        unchanged: comparison.unchanged.length
      });
      
      this.cachedFields = newFields;
      
      // Auto-fill new fields if in multi-step mode
      if (this.multiStepMode && this.autoFillEnabled && comparison.added.length > 0) {
        this.autoFillNewFields(comparison.added);
      }
    }
  }

  /**
   * Auto-fill new fields in multi-step forms
   * @param {Array<Object>} newFields - New fields that appeared
   */
  async autoFillNewFields(newFields) {
    if (!this.currentFieldMapping) {
      console.log('[AI Form Filler] No current field mapping, skipping auto-fill');
      return;
    }

    console.log('[AI Form Filler] Auto-filling new fields:', newFields.length);
    
    // Create mapping for new fields only
    const newFieldMapping = {};
    newFields.forEach(field => {
      const value = this.currentFieldMapping[field.id];
      if (value !== undefined) {
        newFieldMapping[field.id] = value;
      }
    });

    if (Object.keys(newFieldMapping).length === 0) {
      console.log('[AI Form Filler] No matching values for new fields');
      return;
    }

    // Show notification for auto-fill
    showNotification(`Auto-filling ${newFields.length} new fields...`, 'info', 2000);
    
    // Fill new fields (skip already filled to avoid loops)
    const result = fillAllFields(newFieldMapping, this.cachedFields, true);
    
    console.log('[AI Form Filler] Auto-fill result:', result);
    
    // Show result notification
    if (result.filled > 0) {
      showNotification(`Auto-filled ${result.filled} fields in new step`, 'success', 2000);
    }
    
    // Send notification to background about auto-fill
    try {
      chrome.runtime.sendMessage({
        type: 'AUTO_FILL_COMPLETE',
        payload: result
      }).catch(() => {
        // Background may not be listening, ignore error
      });
    } catch (error) {
      console.error('[AI Form Filler] Error sending auto-fill notification:', error);
    }
  }

  /**
   * Check if an element is form-related
   * @param {HTMLElement} element - The element to check
   * @returns {boolean} - True if element is form-related
   */
  isFormRelatedElement(element) {
    const formTags = ['FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'LABEL'];
    return formTags.includes(element.tagName);
  }

  /**
   * Setup message listener for communication with popup
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message).then(sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  /**
   * Handle incoming messages from popup
   * @param {Object} message - The message object
   * @returns {Promise<Object>} - Response object
   */
  async handleMessage(message) {
    console.log('[AI Form Filler Content] Received message:', message.type);
    
    try {
      switch (message.type) {
        case 'DETECT_FIELDS':
          return this.handleDetectFields();
        
        case 'GET_FIELD_COUNT':
          return this.handleGetFieldCount();
        
        case 'HAS_FORMS':
          return this.handleHasForms();
        
        case 'GET_FIELDS_BY_FORM':
          return this.handleGetFieldsByForm();
        
        case 'FILL_FIELDS':
          return this.handleFillFields(message.payload);
        
        case 'SET_REVIEW_MODE':
          return this.handleSetReviewMode(message.payload);
        
        case 'ENABLE_MULTI_STEP':
          return this.handleEnableMultiStep(message.payload);
        
        case 'DISABLE_MULTI_STEP':
          return this.handleDisableMultiStep();
        
        default:
          console.warn('[AI Form Filler Content] Unknown message type:', message.type);
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('[AI Form Filler Content] Error handling message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle field detection request
   * @returns {Promise<Object>} - Response with detected fields
   */
  async handleDetectFields() {
    console.log('[AI Form Filler Content] Handling DETECT_FIELDS request');
    const fields = this.detectFields();
    console.log('[AI Form Filler Content] Detected fields count:', fields.length);
    return {
      success: true,
      fields: fields,
      count: fields.length
    };
  }

  /**
   * Handle get field count request
   * @returns {Promise<Object>} - Response with field count
   */
  async handleGetFieldCount() {
    const count = getFieldCount();
    return {
      success: true,
      count: count
    };
  }

  /**
   * Handle has forms request
   * @returns {Promise<Object>} - Response indicating if forms exist
   */
  async handleHasForms() {
    const hasFormElements = hasForms();
    return {
      success: true,
      hasForms: hasFormElements
    };
  }

  /**
   * Handle get fields by form request
   * @returns {Promise<Object>} - Response with grouped fields
   */
  async handleGetFieldsByForm() {
    const formGroups = groupFieldsByForm();
    const result = {};
    
    formGroups.forEach((fields, form) => {
      const formId = form ? form.id || form.name : 'standalone';
      result[formId] = fields;
    });
    
    return {
      success: true,
      formGroups: result
    };
  }

  /**
   * Handle fill fields request
   * @param {Object} payload - Contains field mapping from AI
   * @returns {Promise<Object>} - Response with fill results
   */
  async handleFillFields(payload) {
    const { fieldMapping, reviewMode, enableMultiStep } = payload || {};
    
    if (!fieldMapping) {
      showNotification('Missing field mapping', 'error');
      return {
        success: false,
        error: 'Missing field mapping'
      };
    }

    try {
      console.log('[AI Form Filler Content] Filling fields with mapping:', fieldMapping);
      console.log('[AI Form Filler Content] Using cached fields:', this.cachedFields.length);
      
      // Show loading notification
      this.currentLoadingNotification = showLoading('Filling form fields...');
      
      // Clear previous filled field tracking for new fill operation
      clearFilledFieldTracking();
      
      // Store mapping for multi-step forms
      this.currentFieldMapping = fieldMapping;
      
      // Check if multi-step mode should be enabled
      if (enableMultiStep !== undefined) {
        this.multiStepMode = enableMultiStep;
        this.autoFillEnabled = enableMultiStep;
        
        if (enableMultiStep) {
          console.log('[AI Form Filler Content] Multi-step mode enabled');
          updateLoading(this.currentLoadingNotification, 'Multi-step mode enabled...');
        }
      }
      
      // Check if this is a multi-step form
      if (isMultiStepForm(this.cachedFields)) {
        console.log('[AI Form Filler Content] Detected multi-step form');
        this.multiStepMode = true;
        this.autoFillEnabled = true;
        updateLoading(this.currentLoadingNotification, 'Detected multi-step form...');
      }
      
      // Check if review mode is enabled
      const shouldReview = reviewMode !== undefined ? reviewMode : this.reviewMode;
      
      if (shouldReview) {
        hideLoadingWithResult(this.currentLoadingNotification, true, 'Opening review mode...');
        this.currentLoadingNotification = null;
        return this.handleReviewMode(fieldMapping);
      }
      
      // Direct fill without review
      updateLoading(this.currentLoadingNotification, 'Filling fields...');
      const results = fillAllFields(fieldMapping, this.cachedFields, false);
      
      console.log('[AI Form Filler Content] Fill results:', results);
      
      // Show success/failure notification
      const success = results.filled > 0 || results.alreadyFilled > 0;
      const message = success 
        ? `Filled ${results.filled} fields successfully`
        : 'Failed to fill fields';
      
      hideLoadingWithResult(this.currentLoadingNotification, success, message);
      this.currentLoadingNotification = null;
      
      return {
        success: true,
        ...results,
        multiStepMode: this.multiStepMode
      };
    } catch (error) {
      console.error('[AI Form Filler Content] Error filling fields:', error);
      
      if (this.currentLoadingNotification) {
        hideLoadingWithResult(this.currentLoadingNotification, false, 'Error filling fields: ' + error.message);
        this.currentLoadingNotification = null;
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle enable multi-step mode request
   * @param {Object} payload - Contains enable boolean
   * @returns {Promise<Object>} - Response
   */
  async handleEnableMultiStep(payload) {
    const { autoFill = true } = payload || {};
    
    this.multiStepMode = true;
    this.autoFillEnabled = autoFill;
    
    console.log('[AI Form Filler Content] Multi-step mode enabled, auto-fill:', autoFill);
    
    return {
      success: true,
      multiStepMode: true,
      autoFillEnabled: autoFill
    };
  }

  /**
   * Handle disable multi-step mode request
   * @returns {Promise<Object>} - Response
   */
  async handleDisableMultiStep() {
    this.multiStepMode = false;
    this.autoFillEnabled = false;
    this.currentFieldMapping = null;
    
    clearFilledFieldTracking();
    
    console.log('[AI Form Filler Content] Multi-step mode disabled');
    
    return {
      success: true,
      multiStepMode: false
    };
  }

  /**
   * Handle review mode - show modal before filling
   * @param {Object} fieldMapping - Field mapping from AI
   * @returns {Promise<Object>} - Response
   */
  async handleReviewMode(fieldMapping) {
    return new Promise((resolve) => {
      console.log('[AI Form Filler Content] Opening review modal');
      
      try {
        // Create and show modal
        this.currentModal = new ReviewModal(
          fieldMapping,
          this.cachedFields,
          (confirmedMapping) => {
            console.log('[AI Form Filler Content] User confirmed mapping:', confirmedMapping);
            
            // Fill fields with confirmed mapping
            const results = fillAllFields(confirmedMapping, this.cachedFields);
            
            console.log('[AI Form Filler Content] Fill results after review:', results);
            
            resolve({
              success: true,
              ...results,
              reviewed: true
            });
          }
        );
        
        // Handle modal cancellation
        this.currentModal.onCancel = () => {
          console.log('[AI Form Filler Content] User cancelled review');
          resolve({
            success: false,
            error: 'User cancelled review',
            cancelled: true
          });
        };
        
        this.currentModal.show();
      } catch (error) {
        console.error('[AI Form Filler Content] Error showing review modal:', error);
        resolve({
          success: false,
          error: 'Failed to show review modal: ' + error.message
        });
      }
    });
  }

  /**
   * Handle set review mode request
   * @param {Object} payload - Contains enabled boolean
   * @returns {Promise<Object>} - Response
   */
  async handleSetReviewMode(payload) {
    const { enabled } = payload || {};
    
    if (typeof enabled === 'boolean') {
      this.reviewMode = enabled;
      console.log('[AI Form Filler Content] Review mode set to:', enabled);
      
      return {
        success: true,
        reviewMode: enabled
      };
    }
    
    return {
      success: false,
      error: 'Invalid review mode value'
    };
  }

  /**
   * Cleanup when content script is unloaded
   */
  cleanup() {
    // Close modal if open
    if (this.currentModal) {
      this.currentModal.hide();
      this.currentModal = null;
    }
    
    // Hide any loading notifications
    if (this.currentLoadingNotification) {
      const notification = this.currentLoadingNotification;
      this.currentLoadingNotification = null;
      try {
        document.body.removeChild(notification);
      } catch (error) {
        // Ignore if already removed
      }
    }
    
    // Disable multi-step mode
    this.multiStepMode = false;
    this.autoFillEnabled = false;
    this.currentFieldMapping = null;
    
    // Clear filled field tracking
    clearFilledFieldTracking();
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    console.log('[AI Form Filler] Content script cleaned up');
  }
}

// Initialize content script
const contentScript = new ContentScript();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  contentScript.cleanup();
});

// Script available in content script context
