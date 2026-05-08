/**
 * Background Service Worker - Production Architecture
 * 
 * Job-based task system. Popup never waits on long responses.
 * All AI calls happen here. Content scripts only do DOM work.
 * 
 * Flow:
 *   popup.js → startJob() → background processes async → storage updated
 *   popup.js polls GET_FILL_STATUS every 1s → reads result
 */

import { getFieldMapping, validateApiKeyFormat } from './utils/api.js';

// ─── Job Store (in-memory, also mirrored to session storage) ──────────────────

const jobs = new Map();

function createJob(tabId, reviewMode) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job = {
    jobId,
    tabId,
    status: 'pending',   // pending | running | awaiting_review | done | error
    progress: '',
    result: null,
    error: null,
    reviewMode,
    createdAt: Date.now()
  };
  jobs.set(jobId, job);
  persistJob(job);
  return job;
}

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch);
  persistJob(job);
  // Broadcast to any open popups
  chrome.runtime.sendMessage({ type: 'JOB_UPDATE', payload: job }).catch(() => {});
}

async function persistJob(job) {
  try {
    await chrome.storage.session.set({ [`job_${job.jobId}`]: job });
  } catch (_) {
    // session storage may not exist in older Chrome; fall back to local
    try { await chrome.storage.local.set({ currentJob: job }); } catch (_) {}
  }
}

// ─── Message Router ───────────────────────────────────────────────────────────

class BackgroundService {
  constructor() {
    this.setupMessageListener();
    this.setupInstallListener();
    console.log('[Background] Service worker initialised');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[Background] Message received:', message.type, 'from', sender.tab?.id ?? 'popup');

      // All handlers are async — we return true to keep the channel open,
      // but we ALWAYS call sendResponse inside handleMessage (no dangling promises).
      this.handleMessage(message, sender)
        .then(sendResponse)
        .catch(err => {
          console.error('[Background] Unhandled error in handleMessage:', err);
          sendResponse({ success: false, error: err.message });
        });

      return true; // keep message channel open
    });
  }

  async handleMessage(message, sender) {
    switch (message.type) {

      // Popup asks: start a fill job (fire-and-forget style)
      case 'START_FILL_JOB':
        return this.startFillJob(message.payload);

      // Popup polls: what's the current job status?
      case 'GET_JOB_STATUS':
        return this.getJobStatus(message.payload?.jobId);

      // Content script tells us review was confirmed
      case 'REVIEW_CONFIRMED':
        return this.handleReviewConfirmed(message.payload, sender);

      // Content script tells us review was cancelled
      case 'REVIEW_CANCELLED':
        return this.handleReviewCancelled(message.payload);

      // API key management
      case 'SAVE_API_KEY':
        return this.saveApiKey(message.payload);

      case 'GET_API_KEY':
        return this.getApiKeyStatus();

      case 'TEST_API_KEY':
        return this.testApiKey(message.payload);

      // Legacy ping
      case 'PING':
        return { success: true, message: 'pong' };

      default:
        console.warn('[Background] Unknown message type:', message.type);
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  }

  // ─── Fill Job Orchestrator ─────────────────────────────────────────────────

  async startFillJob({ reviewMode = false } = {}) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return { success: false, error: 'No active tab found' };

      const job = createJob(tab.id, reviewMode);
      console.log('[Background] Created job:', job.jobId);

      // Run the pipeline asynchronously — don't await here so popup gets jobId immediately
      this.runFillPipeline(job).catch(err => {
        console.error('[Background] Pipeline error for', job.jobId, err);
        updateJob(job.jobId, { status: 'error', error: err.message });
      });

      return { success: true, jobId: job.jobId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async runFillPipeline(job) {
    const { jobId, tabId, reviewMode } = job;

    // ── Step 1: inject / verify content script ─────────────────────────────
    updateJob(jobId, { status: 'running', progress: 'Connecting to page...' });
    await this.ensureContentScript(tabId);

    // ── Step 2: detect fields ──────────────────────────────────────────────
    updateJob(jobId, { progress: 'Detecting form fields...' });
    const detectResp = await this.sendToContent(tabId, { type: 'DETECT_FIELDS' });
    if (!detectResp?.success) throw new Error(detectResp?.error || 'Field detection failed');
    if (!detectResp.count) throw new Error('No form fields found on this page');

    // ── Step 3: load API key ───────────────────────────────────────────────
    updateJob(jobId, { progress: 'Loading API configuration...' });
    const apiKey = await this.getApiKey();
    if (!apiKey) throw new Error('API key not configured. Add your Groq key in the extension popup.');

    // ── Step 4: load profile ───────────────────────────────────────────────
    updateJob(jobId, { progress: 'Loading profile...' });
    const { userProfile: profile } = await chrome.storage.local.get('userProfile');
    if (!profile?.name || !profile?.email)
      throw new Error('Profile incomplete. Fill in at least name and email.');

    // ── Step 5: call Groq AI ───────────────────────────────────────────────
    updateJob(jobId, { progress: 'AI is analysing form fields...' });
    const fieldMapping = await getFieldMapping(detectResp.fields, profile, apiKey);
    console.log('[Background] AI mapping:', fieldMapping);

    // ── Step 6a: review mode ───────────────────────────────────────────────
    if (reviewMode) {
      updateJob(jobId, {
        status: 'awaiting_review',
        progress: 'Waiting for your review...',
        // stash mapping so content script gets it
        _pendingMapping: fieldMapping,
        _detectedFields: detectResp.fields
      });

      // Ask content script to show review modal
      await this.sendToContent(tabId, {
        type: 'SHOW_REVIEW_MODAL',
        payload: { jobId, fieldMapping, detectedFields: detectResp.fields }
      });

      return; // pipeline pauses here; resumes in handleReviewConfirmed
    }

    // ── Step 6b: direct fill ───────────────────────────────────────────────
    updateJob(jobId, { progress: 'Filling form fields...' });
    const fillResp = await this.sendToContent(tabId, {
      type: 'FILL_FIELDS',
      payload: { fieldMapping, detectedFields: detectResp.fields }
    });

    updateJob(jobId, {
      status: 'done',
      progress: 'Complete',
      result: {
        filled: fillResp?.filled ?? 0,
        skipped: fillResp?.skipped ?? 0,
        errors: fillResp?.errors ?? []
      }
    });

    console.log('[Background] Job complete:', jobId, fillResp);
  }

  async handleReviewConfirmed({ jobId, confirmedMapping }, sender) {
    const job = jobs.get(jobId);
    if (!job) return { success: false, error: 'Job not found' };

    try {
      updateJob(jobId, { progress: 'Filling confirmed fields...' });
      const fillResp = await this.sendToContent(job.tabId, {
        type: 'FILL_FIELDS',
        payload: { fieldMapping: confirmedMapping, detectedFields: job._detectedFields || [] }
      });

      updateJob(jobId, {
        status: 'done',
        progress: 'Complete',
        result: {
          filled: fillResp?.filled ?? 0,
          skipped: fillResp?.skipped ?? 0,
          errors: fillResp?.errors ?? [],
          reviewed: true
        }
      });

      return { success: true };
    } catch (err) {
      updateJob(jobId, { status: 'error', error: err.message });
      return { success: false, error: err.message };
    }
  }

  async handleReviewCancelled({ jobId }) {
    updateJob(jobId, { status: 'done', result: { cancelled: true, filled: 0, skipped: 0 } });
    return { success: true };
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  async getJobStatus(jobId) {
    if (!jobId) {
      // Return most recent job if no ID given
      let latest = null;
      for (const j of jobs.values()) {
        if (!latest || j.createdAt > latest.createdAt) latest = j;
      }
      return { success: true, job: latest ?? null };
    }
    return { success: true, job: jobs.get(jobId) ?? null };
  }

  // ─── Content Script Helpers ───────────────────────────────────────────────

  async ensureContentScript(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      console.log('[Background] Content script already active');
    } catch (_) {
      console.log('[Background] Injecting content scripts...');
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          'src/content/utils/detectFields.js',
          'src/content/utils/fillFields.js',
          'src/content/utils/notification.js',
          'src/content/components/ReviewModal.js',
          'src/content/content.js'
        ]
      });
      await new Promise(r => setTimeout(r, 600));
    }
  }

  async sendToContent(tabId, message, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (err) {
        if (i === retries) throw err;
        console.warn(`[Background] Content message failed (attempt ${i + 1}), retrying...`);
        await this.ensureContentScript(tabId);
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }

  // ─── API Key ──────────────────────────────────────────────────────────────

  async saveApiKey({ apiKey } = {}) {
    if (!apiKey) return { success: false, error: 'API key required' };
    if (!validateApiKeyFormat(apiKey)) return { success: false, error: 'Invalid key format (must start with gsk_)' };
    await chrome.storage.local.set({ groqApiKey: apiKey.trim() });
    console.log('[Background] API key saved');
    return { success: true };
  }

  async getApiKeyStatus() {
    const key = await this.getApiKey();
    return { success: true, hasKey: !!key };
  }

  async getApiKey() {
    const { groqApiKey } = await chrome.storage.local.get('groqApiKey');
    return groqApiKey || null;
  }

  async testApiKey({ apiKey } = {}) {
    if (!apiKey || !validateApiKeyFormat(apiKey)) return { success: false, error: 'Invalid key' };
    try {
      const { testConnection } = await import('./utils/api.js');
      return await testConnection(apiKey);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  setupInstallListener() {
    chrome.runtime.onInstalled.addListener(({ reason }) => {
      console.log('[Background] Extension installed/updated:', reason);
    });
  }
}

// Instantiate
new BackgroundService();