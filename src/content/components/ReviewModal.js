/**
 * Review Modal Component
 * Displays detected fields and AI-suggested values for user confirmation
 * Injected dynamically into the webpage with scoped styles using Shadow DOM
 */

class ReviewModal {
  constructor(fieldMapping, detectedFields, onConfirm) {
    this.fieldMapping = fieldMapping;
    this.detectedFields = detectedFields;
    this.onConfirm = onConfirm;
    this.onCancel = null; // Will be set by ContentScript
    this.modalElement = null;
    this.shadowRoot = null;
    this.editedMapping = { ...fieldMapping };
    this.skippedFields = new Set();
  }

  /**
   * Create and inject the modal into the DOM
   */
  show() {
    console.log('[ReviewModal] Showing modal...');
    // Remove existing if any
    const existing = document.getElementById('ai-form-filler-review-modal');
    if (existing) existing.remove();

    // Create modal container
    this.modalElement = document.createElement('div');
    this.modalElement.id = 'ai-form-filler-review-modal';
    
    // Use shadow DOM to avoid CSS conflicts
    this.shadowRoot = this.modalElement.attachShadow({ mode: 'open' });
    
    // Build modal content
    const style = this.getStyles();
    const content = this.getModalContent();
    
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(content);
    
    // Add to document body
    document.body.appendChild(this.modalElement);
    
    // Bind events
    this.bindEvents();
    
    // Trigger animation
    requestAnimationFrame(() => {
      const container = this.shadowRoot.querySelector('.modal-container');
      const backdrop = this.shadowRoot.querySelector('.modal-overlay');
      if (container) container.classList.add('visible');
      if (backdrop) backdrop.classList.add('visible');
    });

    this.updateCounts();
  }

  /**
   * Get scoped CSS styles for the modal (Premium Dark Theme)
   */
  getStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      :host {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        pointer-events: none;
      }

      .modal-overlay {
        position: absolute;
        inset: 0;
        background: rgba(5, 5, 15, 0.75);
        backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: all;
      }

      .modal-overlay.visible {
        opacity: 1;
      }

      .modal-container {
        position: relative;
        background: linear-gradient(160deg, #12131f 0%, #0d0e1c 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(120, 80, 255, 0.15);
        max-width: 620px;
        width: 90%;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: translateY(20px) scale(0.98);
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: all;
      }

      .modal-container.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      .modal-header {
        padding: 24px 28px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: linear-gradient(180deg, rgba(120, 80, 255, 0.08) 0%, transparent 100%);
      }

      .modal-title {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: #f0f0f8;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .title-icon {
        color: #a78bfa;
        font-size: 24px;
      }

      .modal-subtitle {
        margin: 6px 0 0 0;
        font-size: 13px;
        color: rgba(180, 180, 210, 0.65);
        font-weight: 400;
      }

      .modal-body {
        padding: 20px 24px;
        overflow-y: auto;
        flex: 1;
        scrollbar-width: thin;
        scrollbar-color: rgba(120, 80, 255, 0.3) transparent;
      }

      .modal-body::-webkit-scrollbar {
        width: 6px;
      }

      .modal-body::-webkit-scrollbar-thumb {
        background: rgba(120, 80, 255, 0.3);
        border-radius: 10px;
      }

      .field-item {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        transition: all 0.2s ease;
      }

      .field-item:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(120, 80, 255, 0.3);
      }

      .field-item.skipped {
        opacity: 0.5;
        background: rgba(255, 255, 255, 0.01);
        border-color: transparent;
      }

      .field-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 10px;
      }

      .field-name {
        font-weight: 600;
        font-size: 14px;
        color: #e5e7eb;
        margin: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .field-badges {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .badge {
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .badge-type { background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.3); }
      .badge-status { background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); }
      .badge-edited { background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); }
      .badge-skipped { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }

      .field-label {
        font-size: 12px;
        color: rgba(180, 180, 210, 0.6);
        margin-bottom: 10px;
        display: block;
      }

      .field-input-group {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .field-input {
        flex: 1;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #f3f4f6;
        font-size: 14px;
        padding: 10px 14px;
        outline: none;
        transition: all 0.2s;
      }

      .field-input:focus {
        border-color: rgba(120, 80, 255, 0.5);
        box-shadow: 0 0 0 3px rgba(120, 80, 255, 0.1);
      }

      .field-input:disabled {
        color: rgba(180, 180, 210, 0.3);
        text-decoration: line-through;
      }

      .action-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: rgba(180, 180, 210, 0.7);
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      .action-btn.btn-skip:hover { color: #f87171; border-color: rgba(248, 113, 113, 0.3); background: rgba(248, 113, 113, 0.1); }
      .action-btn.btn-unskip:hover { color: #34d399; border-color: rgba(52, 211, 153, 0.3); background: rgba(52, 211, 153, 0.1); }

      .modal-footer {
        padding: 20px 28px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.2);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .footer-stats {
        font-size: 13px;
        color: rgba(180, 180, 210, 0.6);
        display: flex;
        gap: 12px;
      }

      .stat-item b { color: #a78bfa; }

      .footer-actions {
        display: flex;
        gap: 12px;
      }

      .btn {
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-cancel {
        background: rgba(255, 255, 255, 0.05);
        color: #f3f4f6;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .btn-cancel:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
      }

      .btn-confirm {
        background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
        color: white;
        box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
      }

      .btn-confirm:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(124, 58, 237, 0.4);
      }

      .empty-state {
        text-align: center;
        padding: 40px;
        color: rgba(180, 180, 210, 0.6);
      }
    `;
    return style;
  }

  /**
   * Get modal HTML content
   */
  getModalContent() {
    const container = document.createElement('div');
    container.className = 'modal-container';
    
    const fieldsHtml = this.getFieldsHtml();
    
    container.innerHTML = `
      <div class="modal-overlay" data-action="close"></div>
      <div class="modal-header">
        <h2 class="modal-title">
          <span class="title-icon">✦</span>
          Review Form Fields
        </h2>
        <p class="modal-subtitle">Verify AI suggestions before injecting them into the form</p>
      </div>
      <div class="modal-body">
        ${fieldsHtml}
      </div>
      <div class="modal-footer">
        <div class="footer-stats">
          <span class="stat-item"><b id="count-fill">0</b> to fill</span>
          <span class="stat-item"><b id="count-skip">0</b> skipped</span>
        </div>
        <div class="footer-actions">
          <button class="btn btn-cancel" data-action="cancel">Cancel</button>
          <button class="btn btn-confirm" data-action="confirm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Confirm & Fill
          </button>
        </div>
      </div>
    `;
    
    return container;
  }

  /**
   * Generate HTML for field items
   */
  getFieldsHtml() {
    const entries = Object.entries(this.fieldMapping);
    
    if (entries.length === 0) {
      return `
        <div class="empty-state">
          <p>No fields detected on this page</p>
        </div>
      `;
    }
    
    return entries.map(([fieldId, value]) => {
      const fieldMetadata = this.detectedFields.find(f => f.id === fieldId);
      const fieldName = fieldMetadata?.name || fieldId;
      const fieldLabel = fieldMetadata?.label || fieldMetadata?.placeholder || 'Form Field';
      const fieldType = fieldMetadata?.type || 'text';
      const isSkipped = this.skippedFields.has(fieldId);
      const isEdited = this.editedMapping[fieldId] !== this.fieldMapping[fieldId];
      
      let statusBadge = '<span class="badge badge-status">AI Ready</span>';
      if (isSkipped) statusBadge = '<span class="badge badge-skipped">Skipped</span>';
      else if (isEdited) statusBadge = '<span class="badge badge-edited">Edited</span>';
      
      return `
        <div class="field-item ${isSkipped ? 'skipped' : ''}" data-field-id="${fieldId}">
          <div class="field-header">
            <h3 class="field-name" title="${this.escapeHtml(fieldName)}">${this.escapeHtml(fieldName)}</h3>
            <div class="field-badges">
              <span class="badge badge-type">${fieldType}</span>
              <span class="status-badge-container">${statusBadge}</span>
            </div>
          </div>
          <span class="field-label">${this.escapeHtml(fieldLabel)}</span>
          <div class="field-input-group">
            <input 
              type="text" 
              class="field-input" 
              value="${this.escapeHtml(value)}"
              data-field-id="${fieldId}"
              ${isSkipped ? 'disabled' : ''}
            >
            <button class="action-btn ${isSkipped ? 'btn-unskip' : 'btn-skip'}" data-action="${isSkipped ? 'unskip' : 'skip'}" data-field-id="${fieldId}" title="${isSkipped ? 'Include' : 'Skip'}">
              ${isSkipped ? `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 13l4 4L19 7"></path>
                </svg>
              ` : `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"></path>
                </svg>
              `}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    // Backdrop / Cancel
    this.shadowRoot.querySelector('.modal-overlay').addEventListener('click', () => this.cancel());
    this.shadowRoot.querySelector('[data-action="cancel"]').addEventListener('click', () => this.cancel());
    
    // Confirm
    this.shadowRoot.querySelector('[data-action="confirm"]').addEventListener('click', () => this.confirm());
    
    // Inputs
    this.shadowRoot.querySelectorAll('.field-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const fieldId = e.target.dataset.fieldId;
        this.editedMapping[fieldId] = e.target.value;
        this.updateBadge(fieldId);
        this.updateCounts();
      });
    });
    
    // Skip Toggle
    this.shadowRoot.querySelectorAll('[data-action="skip"], [data-action="unskip"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fieldId = e.currentTarget.dataset.fieldId;
        const action = e.currentTarget.dataset.action;
        
        if (action === 'skip') this.skippedFields.add(fieldId);
        else this.skippedFields.delete(fieldId);
        
        this.updateFieldUI(fieldId);
        this.updateCounts();
      });
    });

    // ESC key
    this.keydownHandler = (e) => {
      if (e.key === 'Escape') this.cancel();
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  updateFieldUI(fieldId) {
    const item = this.shadowRoot.querySelector(`.field-item[data-field-id="${fieldId}"]`);
    if (!item) return;

    const isSkipped = this.skippedFields.has(fieldId);
    item.classList.toggle('skipped', isSkipped);
    
    const input = item.querySelector('.field-input');
    if (input) input.disabled = isSkipped;

    const btn = item.querySelector('.action-btn');
    if (btn) {
      btn.dataset.action = isSkipped ? 'unskip' : 'skip';
      btn.className = `action-btn ${isSkipped ? 'btn-unskip' : 'btn-skip'}`;
      btn.innerHTML = isSkipped ? `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 13l4 4L19 7"></path>
        </svg>
      ` : `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"></path>
        </svg>
      `;
    }

    this.updateBadge(fieldId);
  }

  updateBadge(fieldId) {
    const item = this.shadowRoot.querySelector(`.field-item[data-field-id="${fieldId}"]`);
    const container = item?.querySelector('.status-badge-container');
    if (!container) return;

    const isSkipped = this.skippedFields.has(fieldId);
    const isEdited = this.editedMapping[fieldId] !== this.fieldMapping[fieldId];

    if (isSkipped) container.innerHTML = '<span class="badge badge-skipped">Skipped</span>';
    else if (isEdited) container.innerHTML = '<span class="badge badge-edited">Edited</span>';
    else container.innerHTML = '<span class="badge badge-status">AI Ready</span>';
  }

  updateCounts() {
    const skipCount = this.skippedFields.size;
    const fillCount = Object.keys(this.fieldMapping).length - skipCount;

    const fillEl = this.shadowRoot.getElementById('count-fill');
    const skipEl = this.shadowRoot.getElementById('count-skip');
    
    if (fillEl) fillEl.textContent = fillCount;
    if (skipEl) skipEl.textContent = skipCount;
  }

  hide() {
    if (!this.modalElement) return;
    
    const container = this.shadowRoot.querySelector('.modal-container');
    const backdrop = this.shadowRoot.querySelector('.modal-overlay');
    
    if (container) container.classList.remove('visible');
    if (backdrop) backdrop.classList.remove('visible');
    
    document.removeEventListener('keydown', this.keydownHandler);

    setTimeout(() => {
      if (this.modalElement && this.modalElement.parentNode) {
        this.modalElement.parentNode.removeChild(this.modalElement);
      }
      this.modalElement = null;
      this.shadowRoot = null;
    }, 300);
  }

  confirm() {
    const finalMapping = {};
    Object.entries(this.editedMapping).forEach(([fieldId, value]) => {
      if (!this.skippedFields.has(fieldId)) {
        finalMapping[fieldId] = value;
      }
    });
    
    this.hide();
    if (this.onConfirm) this.onConfirm(finalMapping);
  }

  cancel() {
    this.hide();
    if (this.onCancel) this.onCancel();
  }
}

// Class available in global scope when loaded as content script
