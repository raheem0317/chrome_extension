# AI Form Filler Chrome Extension

An intelligent Chrome extension that automatically fills form fields on any webpage using AI (Groq API) and your stored user profile.

## Features

- **Universal Form Detection**: Works on Google Forms, JotForm, React forms, and any vanilla HTML forms
- **AI-Powered Mapping**: Uses Groq AI to intelligently map form fields to your profile data
- **No Site-Specific Hardcoding**: Works on any website without custom configurations
- **Modular Architecture**: Clean, maintainable vanilla JavaScript codebase
- **Manifest V3 Compliant**: Built with the latest Chrome extension standards

## Requirements

- Google Chrome (version 88 or higher)
- Groq API key (get one at https://console.groq.com/)
- For development: Chrome Developer Mode enabled

## Installation

### Development Setup

1. Clone or download this repository
2. Add icon files to the `icons/` directory:
   - `icon-16.png` (16x16 pixels)
   - `icon-48.png` (48x48 pixels)
   - `icon-128.png` (128x128 pixels)
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right corner
5. Click "Load unpacked"
6. Select the extension directory

### Production Build

For Chrome Web Store submission:
1. Ensure all icon files are properly sized
2. Test thoroughly across different form types
3. Create a Chrome Web Store developer account
4. Package the extension and submit for review

## Usage

### First-Time Setup

1. Click the extension icon in your browser toolbar
2. Enter your Groq API key in the "API Configuration" section
3. Click "Save API Key"
4. Fill in your user profile information (at minimum: First Name, Last Name, Email)
5. Click "Save Profile"

### Filling Forms

1. Navigate to any webpage with a form
2. Click the extension icon
3. Click the "Fill Form" button
4. The extension will:
   - Detect all form fields on the page
   - Send field metadata to Groq AI
   - Receive an intelligent mapping of fields to your profile data
   - Automatically fill the form fields
5. A success message will show how many fields were filled

## Architecture

### Folder Structure

```
chrome-extension/
├── manifest.json                 # Extension manifest
├── icons/                        # Extension icons
├── src/
│   ├── background/              # Background service worker
│   │   ├── background.js        # Main background script
│   │   ├── groq-api.js          # Groq API integration
│   │   └── storage-manager.js   # Storage operations
│   ├── content/                 # Content scripts
│   │   ├── content.js           # Main content script
│   │   ├── form-detector.js     # Form field detection
│   │   ├── field-analyzer.js    # Field semantic analysis
│   │   └── form-filler.js       # Form field filling
│   ├── popup/                   # Popup UI
│   │   ├── popup.html           # Popup HTML
│   │   ├── popup.css            # Popup styles
│   │   ├── popup.js             # Popup controller
│   │   └── profile-editor.js    # Profile form management
│   └── shared/                  # Shared utilities
│       ├── constants.js         # Extension constants
│       ├── utils.js             # Utility functions
│       └── event-types.js       # Message type definitions
└── README.md                    # This file
```

### Component Overview

#### Background Script (`background.js`)
- Central coordinator for extension lifecycle
- Handles Groq API calls (avoids CORS issues)
- Manages storage operations
- Routes messages between popup and content scripts

#### Content Script (`content.js`)
- Injected into webpages
- Orchestrates form detection and filling
- Communicates with background script
- Handles DOM manipulation

#### Form Detector (`form-detector.js`)
- Dynamically discovers form fields
- Works across frameworks (React, Vue, vanilla)
- Handles shadow DOM traversal
- Observes DOM changes for dynamic forms

#### Field Analyzer (`field-analyzer.js`)
- Extracts semantic meaning from fields
- Analyzes field context (labels, placeholders)
- Identifies field categories (name, email, phone, etc.)

#### Form Filler (`form-filler.js`)
- Injects values using native DOM setters
- Triggers proper React/Vue events
- Handles special field types (dropdowns, checkboxes, radios)
- Provides visual feedback

#### Groq API (`groq-api.js`)
- Constructs API requests to Groq
- Sends field metadata + user profile
- Parses JSON response mapping
- Handles errors and retries

#### Storage Manager (`storage-manager.js`)
- Wraps chrome.storage.local operations
- Manages user profile CRUD
- Validates profile data

#### Popup UI (`popup.html`, `popup.js`, `popup.css`)
- Profile editor interface
- API key configuration
- Fill Form button
- Status indicators

## Communication Flow

```
User clicks "Fill Form" in popup
    ↓
popup.js → background.js → content.js
    ↓
content.js detects fields
    ↓
content.js → background.js (fields metadata)
    ↓
background.js → Groq API (fields + profile)
    ↓
Groq API returns field mapping
    ↓
background.js → content.js (mapping)
    ↓
content.js fills form fields
    ↓
content.js → popup.js (success/error)
```

## Supported Field Types

- Text inputs
- Email fields
- Phone number fields
- Textareas
- Select dropdowns
- Checkboxes
- Radio buttons
- URL fields
- Date fields
- Number fields

## Privacy & Security

- All data is stored locally using `chrome.storage.local`
- API key is stored securely and never transmitted except to Groq API
- No data is sent to any third-party services except Groq
- Profile data is only used for form filling
- Extension works entirely client-side

## Troubleshooting

### Extension not loading
- Ensure Developer Mode is enabled in chrome://extensions/
- Check for errors in the extension details page
- Verify all file paths in manifest.json are correct

### Forms not being detected
- Ensure the page has fully loaded
- Check browser console for errors
- Some forms in iframes may not be detected

### API errors
- Verify your Groq API key is valid
- Check you have sufficient API credits
- Ensure you have internet connectivity

### Fields not filling correctly
- Some fields may be disabled or read-only
- CAPTCHA fields are intentionally skipped
- React/Vue forms may require page reload after filling

## Development

### Testing

Test the extension on various form types:
- Google Forms
- JotForm
- React-based forms
- Vue-based forms
- Vanilla HTML forms
- Single-page applications

### Debugging

1. Open Chrome DevTools on the extension popup
2. Check background script logs in `chrome://extensions/` → Service Worker
3. Check content script logs in the webpage's DevTools console

### Modifying the Code

The codebase is modular and vanilla JavaScript. Each module is self-contained:

- To modify field detection: Edit `form-detector.js`
- To change AI prompts: Edit `groq-api.js`
- To update the UI: Edit `popup.html` and `popup.css`
- To add new profile fields: Update `constants.js` and popup HTML

## API Configuration

The extension uses Groq's LLaMA 3 model. To configure:

1. Get an API key from https://console.groq.com/
2. Enter it in the extension popup
3. The extension uses the `llama3-70b-8192` model by default

To change the model, edit `GROQ_API_CONFIG` in `src/shared/constants.js`.

## License

This project is provided as-is for educational and development purposes.

## Contributing

Contributions are welcome! Please ensure:
- Code follows the existing modular structure
- Vanilla JavaScript only (no frameworks)
- Manifest V3 compliance
- Proper error handling
- Comments for complex logic

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Review browser console for errors
3. Verify API key and network connectivity
