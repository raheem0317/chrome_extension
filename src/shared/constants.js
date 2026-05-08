// Extension constants
export const EXTENSION_NAME = 'AI Form Filler';
export const EXTENSION_VERSION = '1.0.0';

// Storage keys
export const STORAGE_KEYS = {
  USER_PROFILE: 'userProfile',
  API_KEY: 'openrouterApiKey',
  SETTINGS: 'settings'
};

// Default profile structure
export const DEFAULT_PROFILE = {
  name: '',
  email: '',
  phone: '',
  address: '',
  skills: '',
  experience: ''
};

// Default settings
export const DEFAULT_SETTINGS = {
  autoFill: false,
  confirmBeforeFill: true,
  showNotifications: true
};

// Field types
export const FIELD_TYPES = {
  TEXT: 'text',
  EMAIL: 'email',
  PHONE: 'tel',
  NUMBER: 'number',
  DATE: 'date',
  URL: 'url',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  FILE: 'file',
  HIDDEN: 'hidden',
  PASSWORD: 'password',
  SEARCH: 'search'
};

// Field categories for AI mapping
export const FIELD_CATEGORIES = {
  NAME: 'name',
  FIRST_NAME: 'firstName',
  LAST_NAME: 'lastName',
  EMAIL: 'email',
  PHONE: 'phone',
  ADDRESS: 'address',
  CITY: 'city',
  STATE: 'state',
  ZIP_CODE: 'zipCode',
  COUNTRY: 'country',
  COMPANY: 'company',
  JOB_TITLE: 'jobTitle',
  WEBSITE: 'website',
  NOTES: 'notes'
};

// API configuration
export const OPENROUTER_API_CONFIG = {
  BASE_URL: 'https://openrouter.ai/api/v1/chat/completions',
  MODELS: [
    'openai/gpt-4o-mini',
    'anthropic/claude-3.5-sonnet',
    'meta-llama/llama-3.3-70b-instruct'
  ],
  MAX_RETRIES: 3,
  TIMEOUT: 45000
};

// Message types
export const MESSAGE_TYPES = {
  FILL_FORM: 'FILL_FORM',
  GET_AI_VALUES: 'GET_AI_VALUES',
  FILL_FIELDS: 'FILL_FIELDS',
  FILL_COMPLETE: 'FILL_COMPLETE',
  SAVE_PROFILE: 'SAVE_PROFILE',
  PROFILE_SAVED: 'PROFILE_SAVED',
  CHECK_API_KEY: 'CHECK_API_KEY',
  API_KEY_STATUS: 'API_KEY_STATUS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  GET_PROFILE: 'GET_PROFILE',
  PROFILE_DATA: 'PROFILE_DATA',
  ERROR: 'ERROR'
};

// UI constants
export const UI = {
  POPUP_WIDTH: 400,
  POPUP_HEIGHT: 600,
  TOAST_DURATION: 3000
};
