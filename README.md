# AI Form Filler — Chrome Extension

An intelligent Chrome extension that automatically fills form fields on any webpage using AI (OpenRouter API) and your stored user profile.

## Features

- **AI-Powered Mapping**: Uses OpenRouter AI (with model fallback) to intelligently map form fields to your profile data
- **Review Before Fill**: Preview and edit AI suggestions before they are applied
- **Secure Architecture**: API key never leaves the background service worker
- **Multi-Model Fallback**: Tries GPT-4o Mini → Claude 3.5 Sonnet → Llama 3.3 70B
- **Production Resilience**: Retry logic, timeout handling, malformed JSON recovery

## Prerequisites

- Google Chrome (v116+)
- OpenRouter API key (get one at https://openrouter.ai/keys)

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select this folder

## Usage

1. Click the extension icon in the toolbar
2. Enter your OpenRouter API key in the "API Configuration" section
3. Fill in your profile (name, email, phone, etc.)
4. Navigate to any webpage with a form
5. Click "Review & Fill" or "Fill Form"

## Architecture

```
popup.js  →  background.js  →  OpenRouter API
                  ↓
             content.js (DOM only)
```

### Security

- **API key** is stored in `chrome.storage.local`, accessed ONLY by `background.js`
- **popup.js** and **content.js** NEVER see the API key
- All AI calls happen exclusively in the background service worker

### How It Works

1. User clicks "Fill Form" in popup
2. Popup sends `START_FILL_JOB` message to background
3. Background detects form fields via content script
4. Background sends field metadata + profile to OpenRouter AI
5. AI returns JSON mapping of field IDs → profile values
6. Background sends mapping to content script for DOM injection

## Project Structure

```
├── manifest.json
├── src/
│   ├── background/
│   │   ├── background.js          # Service worker (job orchestrator)
│   │   ├── utils/
│   │   │   └── api.js             # OpenRouter API (fetch, retry, fallback)
│   │   ├── groq-api.js            # Deprecated stub (redirects to utils/api.js)
│   │   └── storage-manager.js     # Chrome storage helper
│   ├── content/
│   │   ├── content.js             # DOM-only message handler
│   │   ├── field-analyzer.js      # Field semantic analysis
│   │   ├── form-detector.js       # Form detection
│   │   ├── form-filler.js         # Form filling logic
│   │   ├── review-modal.js        # Review modal component
│   │   ├── utils/
│   │   │   ├── detectFields.js    # Field detection utilities
│   │   │   ├── fillFields.js      # Field filling utilities
│   │   │   └── notification.js    # In-page notifications
│   │   └── components/
│   │       └── ReviewModal.js     # Shadow DOM review modal
│   ├── popup/
│   │   ├── popup.html             # Extension popup UI
│   │   ├── popup.css              # Popup styles
│   │   ├── popup.js               # Popup controller
│   │   ├── storage.js             # Profile storage helpers
│   │   ├── profile-editor.js      # Profile form logic
│   │   └── validation.js          # Input validation
│   └── shared/
│       ├── constants.js           # Shared constants & config
│       ├── event-types.js         # Message type definitions
│       └── utils.js               # Shared utilities
└── icons/
```

## OpenRouter API Configuration

The extension uses OpenRouter with automatic model fallback:

| Priority | Model | Provider |
|----------|-------|----------|
| 1 (Primary) | `openai/gpt-4o-mini` | OpenAI |
| 2 (Fallback) | `anthropic/claude-3.5-sonnet` | Anthropic |
| 3 (Fallback) | `meta-llama/llama-3.3-70b-instruct` | Meta |

### Resilience Features

- **Timeout**: 45s per request (AbortController)
- **Retries**: 3 attempts per model with exponential backoff
- **Model Fallback**: Automatically tries the next model if one is unavailable
- **JSON Recovery**: Multi-stage parsing (direct → cleanup → aggressive extraction)
- **Error Logging**: Detailed `[OpenRouter]` `[AI]` `[Background]` prefixed logs

## Security Notes

- API key is stored securely and never transmitted except to OpenRouter API
- Content scripts have no access to the API key
- All AI processing happens in the isolated background service worker
- No data is sent to any server other than OpenRouter
