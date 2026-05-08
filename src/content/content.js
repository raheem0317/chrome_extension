/**
 * Content Script — DOM layer only
 * Detects fields, fills fields, shows review modal.
 * Never calls AI. Never holds API keys.
 * 
 * Messages handled:
 *   PING                → { success: true }
 *   DETECT_FIELDS       → { success, fields, count }
 *   FILL_FIELDS         → { success, filled, skipped, errors }
 *   SHOW_REVIEW_MODAL   → { success } (modal shown; result sent back via REVIEW_CONFIRMED/CANCELLED)
 */

(function () {
  'use strict';

  // Prevent double-injection
  if (window.__aiFormFillerLoaded) {
    console.log('[Content] Already loaded, skipping re-init');
    return;
  }
  window.__aiFormFillerLoaded = true;

  // ─── State ──────────────────────────────────────────────────────────────────
  let cachedFields = [];
  let activeModal = null;

  // ─── Utilities ───────────────────────────────────────────────────────────────

  function safeSend(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            console.warn('[Content] sendMessage error:', chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch (err) {
        console.warn('[Content] sendMessage threw:', err.message);
        resolve(null);
      }
    });
  }

  // ─── Message listener ────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] Message received:', message.type);

    handleMessage(message)
      .then(sendResponse)
      .catch(err => {
        console.error('[Content] Handler error:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // always async
  });

  async function handleMessage(message) {
    switch (message.type) {

      case 'PING':
        return { success: true };

      case 'DETECT_FIELDS': {
        clearFieldCache();
        const fields = detectAllFields();
        cachedFields = fields;
        console.log('[Content] Detected', fields.length, 'fields');
        console.log('[Content] Field IDs:', fields.map(f => f.id));
        // Strip element refs before sending (not serialisable)
        return {
          success: true,
          fields: fields.map(stripElement),
          count: fields.length
        };
      }

      case 'FILL_FIELDS': {
        const { fieldMapping, detectedFields } = message.payload || {};
        if (!fieldMapping) return { success: false, error: 'No fieldMapping provided' };

        console.log('[Content] FILL_FIELDS received');
        console.log('[Content] fieldMapping keys:', Object.keys(fieldMapping));
        console.log('[Content] fieldMapping:', JSON.stringify(fieldMapping));
        console.log('[Content] cachedFields count:', cachedFields.length);
        console.log('[Content] cachedFields with element refs:', cachedFields.filter(f => f.element).length);

        // Merge any freshly passed detectedFields with cached (keep element refs)
        if (detectedFields?.length) mergeIntoCache(detectedFields);

        // Re-resolve element references for any cached fields missing them
        resolveElementRefs();

        console.log('[Content] After resolve — cachedFields with element refs:', cachedFields.filter(f => f.element).length);

        const result = fillAllFields(fieldMapping, cachedFields, false);
        console.log('[Content] Fill result:', JSON.stringify(result));
        return { success: true, ...result };
      }

      case 'SHOW_REVIEW_MODAL': {
        const { jobId, fieldMapping, detectedFields } = message.payload || {};
        if (detectedFields?.length) mergeIntoCache(detectedFields);
        resolveElementRefs();

        showReviewModal(jobId, fieldMapping);
        return { success: true };
      }

      default:
        return { success: false, error: `Unknown message: ${message.type}` };
    }
  }

  // ─── Cache helpers ───────────────────────────────────────────────────────────

  function stripElement(f) {
    const { element, ...rest } = f;
    return rest;
  }

  function mergeIntoCache(incomingFields) {
    // incoming fields have no element refs; we add live refs from the DOM
    for (const incoming of incomingFields) {
      if (!cachedFields.find(c => c.id === incoming.id)) {
        const el = findElementByFieldId(incoming.id);
        if (el) {
          cachedFields.push({ ...incoming, element: el });
          console.log('[Content] Merged field into cache:', incoming.id, '→ element found');
        } else {
          cachedFields.push({ ...incoming, element: null });
          console.warn('[Content] Merged field into cache:', incoming.id, '→ NO element found');
        }
      }
    }
  }

  /**
   * Re-resolve DOM element references for all cached fields.
   * Handles the case where element refs were lost due to serialization round-trip.
   */
  function resolveElementRefs() {
    for (const field of cachedFields) {
      if (!field.element || !document.body.contains(field.element)) {
        const el = findElementByFieldId(field.id);
        if (el) {
          field.element = el;
        } else {
          console.warn('[Content] resolveElementRefs: no element found for', field.id);
        }
      }
    }
  }

  function findElementByFieldId(fieldId) {
    // fieldId format: "id:xxx|name:yyy|type:zzz"
    const idMatch = fieldId.match(/id:([^|]+)/);
    const nameMatch = fieldId.match(/name:([^|]+)/);

    if (idMatch?.[1]) {
      const el = document.getElementById(idMatch[1]);
      if (el) return el;
    }
    if (nameMatch?.[1]) {
      const el = document.querySelector(`[name="${nameMatch[1]}"]`);
      if (el) return el;
    }

    // Fallback: try querySelector with the actual id/name values
    if (idMatch?.[1]) {
      try {
        const el = document.querySelector(`#${CSS.escape(idMatch[1])}`);
        if (el) return el;
      } catch (_) {}
    }

    return null;
  }

  // ─── Review Modal bridge ──────────────────────────────────────────────────────

  function showReviewModal(jobId, fieldMapping) {
    if (activeModal) {
      activeModal.hide();
      activeModal = null;
    }

    activeModal = new ReviewModal(
      fieldMapping,
      cachedFields,
      async (confirmedMapping) => {
        activeModal = null;
        showNotification('Sending confirmed fields...', 'info', 1500);
        await safeSend({
          type: 'REVIEW_CONFIRMED',
          payload: { jobId, confirmedMapping }
        });
      }
    );

    activeModal.onCancel = async () => {
      activeModal = null;
      await safeSend({ type: 'REVIEW_CANCELLED', payload: { jobId } });
    };

    activeModal.show();
  }

  console.log('[Content] Content script ready');
})();