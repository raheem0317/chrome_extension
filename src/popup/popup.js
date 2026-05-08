/**
 * Popup Controller
 * 
 * KEY DESIGN: Popup NEVER awaits long-running operations.
 * It starts a job, gets a jobId, then polls every second.
 * Popup can close safely at any time — the job continues in background.
 */

import { saveProfile, loadProfile, getLastUpdated, isStorageAvailable } from './storage.js';
import { validateFormData, sanitizeFormData, getFirstError } from './validation.js';

class PopupController {
  constructor() {
    this.profile = null;
    this.storageAvailable = false;
    this.activeJobId = null;
    this.pollTimer = null;
    this.init();
  }

  async init() {
    try {
      this.cacheElements();
      this.bindEvents();

      this.storageAvailable = await isStorageAvailable();
      if (!this.storageAvailable) {
        this.showToast('Storage not available', 'error');
      }

      await this.loadProfile();
      await this.loadApiKeyStatus();
      this.updateStatus();
      await this.resumePendingJob();
    } catch (err) {
      console.error('[Popup] Init error:', err);
      this.showToast('Failed to initialise extension', 'error');
    }
  }

  cacheElements() {
    this.els = {
      apiKey:           document.getElementById('apiKey'),
      saveApiKeyBtn:    document.getElementById('saveApiKeyBtn'),
      profileForm:      document.getElementById('profileForm'),
      name:             document.getElementById('name'),
      email:            document.getElementById('email'),
      phone:            document.getElementById('phone'),
      address:          document.getElementById('address'),
      skills:           document.getElementById('skills'),
      experience:       document.getElementById('experience'),
      saveProfileBtn:   document.getElementById('saveProfileBtn'),
      fillFormBtn:      document.getElementById('fillFormBtn'),
      statusIndicator:  document.getElementById('statusIndicator'),
      statusText:       document.querySelector('.status-text'),
      toast:            document.getElementById('toast'),
      toastMessage:     document.getElementById('toastMessage'),
      loadingOverlay:   document.getElementById('loadingOverlay'),
      loadingText:      document.getElementById('loadingText'),
      reviewModeToggle: document.getElementById('reviewModeToggle'),
      fillBtnText:      document.getElementById('fillBtnText')
    };
  }

  bindEvents() {
    this.els.profileForm.addEventListener('submit', e => this.handleSaveProfile(e));
    this.els.saveApiKeyBtn.addEventListener('click', () => this.handleSaveApiKey());
    this.els.fillFormBtn.addEventListener('click', () => this.handleFillForm());
    this.els.reviewModeToggle.addEventListener('change', () => this.updateFillButtonText());

    // Listen for real-time job updates from background
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'JOB_UPDATE' && msg.payload?.jobId === this.activeJobId) {
        this.onJobUpdate(msg.payload);
      }
    });
  }

  updateFillButtonText() {
    this.els.fillBtnText.textContent = this.els.reviewModeToggle.checked
      ? 'Review & Fill' : 'Fill Form';
  }

  // ─── Profile ───────────────────────────────────────────────────────────────

  async loadProfile() {
    this.showLoading('Loading profile...');
    try {
      const res = await loadProfile();
      this.profile = res.success ? res.profile : this.defaultProfile();
      this.populateForm();
    } finally {
      this.hideLoading();
    }
  }

  defaultProfile() {
    return { name: '', email: '', phone: '', address: '', skills: '', experience: '' };
  }

  populateForm() {
    const p = this.profile || this.defaultProfile();
    ['name', 'email', 'phone', 'address', 'skills', 'experience'].forEach(k => {
      if (this.els[k]) this.els[k].value = p[k] || '';
    });
  }

  async handleSaveProfile(e) {
    e.preventDefault();
    const data = this.getFormData();
    const validation = validateFormData(data);
    if (!validation.valid) {
      this.showToast(getFirstError(validation), 'error');
      return;
    }
    const sanitized = sanitizeFormData(data);
    this.showLoading('Saving...');
    try {
      const res = await saveProfile(sanitized);
      if (!res.success) throw new Error(res.error);
      this.profile = sanitized;
      this.showToast('Profile saved!', 'success');
      this.updateStatus();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  // ─── API Key ───────────────────────────────────────────────────────────────

  async loadApiKeyStatus() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      if (res?.success && res.hasKey) {
        this.els.apiKey.value = '••••••••••••••••';
      }
    } catch (err) {
      console.error('[Popup] loadApiKeyStatus error:', err);
    }
  }

  async handleSaveApiKey() {
    const key = this.els.apiKey.value.trim();
    if (!key) return this.showToast('Enter an API key', 'error');
    if (!key.startsWith('gsk_')) return this.showToast('Groq keys start with gsk_', 'error');

    this.showLoading('Saving API key...');
    try {
      const res = await chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', payload: { apiKey: key } });
      if (!res?.success) throw new Error(res?.error || 'Save failed');
      this.els.apiKey.value = '••••••••••••••••';
      this.showToast('API key saved!', 'success');
      this.updateStatus();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  // ─── Fill Form ─────────────────────────────────────────────────────────────

  async handleFillForm() {
    if (this.activeJobId) return; // already running

    // Save profile first
    const data = this.getFormData();
    const validation = validateFormData(data);
    if (!validation.valid) {
      this.showToast(getFirstError(validation), 'error');
      return;
    }

    this.showLoading('Saving profile...');
    try {
      const res = await saveProfile(sanitizeFormData(data));
      if (!res?.success) throw new Error(res?.error || 'Save failed');
      this.profile = sanitizeFormData(data);
    } catch (err) {
      this.hideLoading();
      this.showToast(err.message, 'error');
      return;
    }

    const reviewMode = this.els.reviewModeToggle.checked;
    this.showLoading(reviewMode ? 'AI is analysing form...' : 'Starting fill job...');

    try {
      // ► START JOB — popup gets jobId immediately and does NOT wait for completion
      const res = await chrome.runtime.sendMessage({
        type: 'START_FILL_JOB',
        payload: { reviewMode }
      });

      if (!res?.success) throw new Error(res?.error || 'Could not start job');

      this.activeJobId = res.jobId;
      console.log('[Popup] Job started:', this.activeJobId);
      this.startPolling();
    } catch (err) {
      console.error('[Popup] handleFillForm error:', err);
      this.hideLoading();
      this.showToast(err.message, 'error');
    }
  }

  // ─── Job Polling ───────────────────────────────────────────────────────────

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.pollJobStatus(), 1000);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async pollJobStatus() {
    if (!this.activeJobId) return this.stopPolling();
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'GET_JOB_STATUS',
        payload: { jobId: this.activeJobId }
      });
      if (res?.job) this.onJobUpdate(res.job);
    } catch (err) {
      console.warn('[Popup] Poll error:', err.message);
    }
  }

  onJobUpdate(job) {
    if (!job) return;
    const { status, progress, result, error } = job;

    // Update loading text while running
    if (status === 'running' || status === 'pending') {
      this.els.loadingText.textContent = progress || 'Processing...';
      return;
    }

    if (status === 'awaiting_review') {
      this.els.loadingText.textContent = 'Review the suggestions on the page...';
      return;
    }

    // Terminal states
    if (status === 'done' || status === 'error') {
      this.stopPolling();
      this.activeJobId = null;
      this.hideLoading();

      if (status === 'error') {
        this.showToast(error || 'Something went wrong', 'error');
        return;
      }

      if (result?.cancelled) {
        this.showToast('Fill cancelled');
        return;
      }

      const msg = result?.reviewed
        ? `Filled ${result.filled} fields after review`
        : `Filled ${result.filled} fields (${result.skipped ?? 0} skipped)`;

      this.showToast(msg, 'success');
    }
  }

  // ─── Resume pending job if popup reopened mid-job ─────────────────────────

  async resumePendingJob() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_JOB_STATUS', payload: {} });
      const job = res?.job;
      if (!job) return;
      if (job.status === 'running' || job.status === 'pending' || job.status === 'awaiting_review') {
        console.log('[Popup] Resuming job:', job.jobId);
        this.activeJobId = job.jobId;
        this.showLoading(job.progress || 'Processing...');
        this.startPolling();
      }
    } catch (err) {
      console.warn('[Popup] resumePendingJob error:', err.message);
    }
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  getFormData() {
    return {
      name:       this.els.name.value,
      email:      this.els.email.value,
      phone:      this.els.phone.value,
      address:    this.els.address.value,
      skills:     this.els.skills.value,
      experience: this.els.experience.value
    };
  }

  updateStatus() {
    const hasProfile = this.profile?.name && this.profile?.email;
    const hasKey = this.els.apiKey.value && this.els.apiKey.value !== '••••••••••••••••';
    this.els.fillFormBtn.disabled = !hasProfile;

    if (hasProfile && hasKey) {
      this.els.statusIndicator.classList.remove('incomplete');
      this.els.statusText.textContent = 'Ready';
    } else if (!hasKey) {
      this.els.statusIndicator.classList.add('incomplete');
      this.els.statusText.textContent = 'No API key';
    } else {
      this.els.statusIndicator.classList.add('incomplete');
      this.els.statusText.textContent = 'Incomplete';
    }
  }

  showToast(message, type = 'success') {
    this.els.toastMessage.textContent = message;
    this.els.toast.className = `toast ${type} show`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.els.toast.classList.remove('show');
      this.els.toast.classList.add('hidden');
    }, 3500);
  }

  showLoading(text = 'Processing...') {
    this.els.loadingText.textContent = text;
    this.els.loadingOverlay.classList.remove('hidden');
    this.els.loadingOverlay.classList.add('show');
  }

  hideLoading() {
    this.els.loadingOverlay.classList.remove('show');
    this.els.loadingOverlay.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try { new PopupController(); }
  catch (err) { console.error('[Popup] Fatal init error:', err); }
});