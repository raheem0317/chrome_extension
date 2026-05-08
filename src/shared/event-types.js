// Event type definitions for message passing

/**
 * Create a message object
 */
export function createMessage(type, payload = {}) {
  return {
    type,
    payload,
    timestamp: Date.now()
  };
}

/**
 * Validate message structure
 */
export function isValidMessage(message) {
  return message && 
         typeof message === 'object' && 
         typeof message.type === 'string' &&
         message.timestamp;
}

/**
 * Message sender types
 */
export const MESSAGE_SENDERS = {
  POPUP: 'popup',
  BACKGROUND: 'background',
  CONTENT: 'content'
};

/**
 * Event names for internal use
 */
export const INTERNAL_EVENTS = {
  FORM_DETECTED: 'formDetected',
  FIELD_DETECTED: 'fieldDetected',
  FILL_STARTED: 'fillStarted',
  FILL_PROGRESS: 'fillProgress',
  FILL_COMPLETED: 'fillCompleted',
  FILL_ERROR: 'fillError',
  PROFILE_UPDATED: 'profileUpdated',
  SETTINGS_UPDATED: 'settingsUpdated'
};
