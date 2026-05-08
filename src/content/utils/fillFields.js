/**
 * fillFields.js — DOM injection utility
 * Handles React, Vue, and vanilla forms correctly.
 * Loaded as content script (no imports).
 */

// ─── Field tracking (prevents re-fill loops in multi-step forms) ──────────────

const _filledIds = new Set();

function isFieldAlreadyFilled(id) { return _filledIds.has(id); }
function markFieldAsFilled(id) { _filledIds.add(id); }
function clearFilledFieldTracking() { _filledIds.clear(); }
function getFilledFieldIds() { return new Set(_filledIds); }

// ─── Native value setter (React compatibility) ────────────────────────────────

function setNativeValue(el, value) {
  try {
    const proto = Object.getPrototypeOf(el);
    const ownSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
    const protoSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (ownSetter && ownSetter !== protoSetter) {
      protoSetter?.call(el, value);
    } else {
      ownSetter?.call(el, value);
    }
  } catch (err) {
    el.value = value; // fallback
  }
}

function fireEvents(el, ...types) {
  for (const type of types) {
    try {
      el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    } catch (_) {}
  }
}

// ─── Individual fill functions ────────────────────────────────────────────────

function fillTextInput(el, value, skipFilled = false) {
  const id = el.id || el.name || el.type || 'input';
  if (skipFilled && isFieldAlreadyFilled(id)) return true;
  if (!value && value !== 0) return false;
  el.focus();
  setNativeValue(el, String(value));
  fireEvents(el, 'input', 'change', 'blur');
  el.blur();
  if (skipFilled) markFieldAsFilled(id);
  return true;
}

function fillTextarea(el, value, skipFilled = false) {
  const id = el.id || el.name || 'textarea';
  if (skipFilled && isFieldAlreadyFilled(id)) return true;
  if (!value && value !== 0) return false;
  el.focus();
  setNativeValue(el, String(value));
  fireEvents(el, 'input', 'change', 'blur');
  el.blur();
  if (skipFilled) markFieldAsFilled(id);
  return true;
}

function fillSelect(el, value, skipFilled = false) {
  const id = el.id || el.name || 'select';
  if (skipFilled && isFieldAlreadyFilled(id)) return true;
  if (!value) return false;

  el.focus();
  const opts = Array.from(el.options);
  const valStr = String(value).toLowerCase();

  let match = opts.find(o => o.value === value || o.text === value)
    || opts.find(o => o.value.toLowerCase() === valStr || o.text.toLowerCase() === valStr)
    || opts.find(o => o.value.toLowerCase().includes(valStr) || o.text.toLowerCase().includes(valStr));

  if (!match) { el.blur(); return false; }

  el.selectedIndex = match.index;
  fireEvents(el, 'change', 'blur');
  el.blur();
  if (skipFilled) markFieldAsFilled(id);
  return true;
}

function fillRadio(el, checked, skipFilled = false) {
  const id = el.name || 'radio';
  if (skipFilled && isFieldAlreadyFilled(id)) return true;
  if (checked && !el.checked) {
    el.click();
    fireEvents(el, 'change');
    if (skipFilled) markFieldAsFilled(id);
  }
  return true;
}

function fillCheckbox(el, checked, skipFilled = false) {
  const id = el.id || el.name || 'checkbox';
  if (skipFilled && isFieldAlreadyFilled(id)) return true;
  const shouldCheck = checked === true || checked === 'true';
  if (el.checked !== shouldCheck) {
    el.click();
    fireEvents(el, 'change');
    if (skipFilled) markFieldAsFilled(id);
  }
  return true;
}

// ─── Type dispatcher ──────────────────────────────────────────────────────────

function fillFieldByType(el, value, skipFilled = false) {
  if (!el) return false;
  const tag = el.tagName;
  const type = (el.type || '').toLowerCase();

  if (tag === 'TEXTAREA') return fillTextarea(el, value, skipFilled);
  if (tag === 'SELECT') return fillSelect(el, value, skipFilled);
  if (tag === 'INPUT') {
    if (type === 'radio') return fillRadio(el, value === true || value === 'true', skipFilled);
    if (type === 'checkbox') return fillCheckbox(el, value, skipFilled);
    return fillTextInput(el, value, skipFilled);
  }

  // Fallback
  try {
    el.value = value;
    fireEvents(el, 'input', 'change');
    return true;
  } catch (_) { return false; }
}

// ─── Element finder ───────────────────────────────────────────────────────────

function findElementByFieldId(fieldId, detectedFields) {
  const field = detectedFields.find(f => f.id === fieldId);
  if (field?.element && document.body.contains(field.element)) return field.element;

  // Re-query from DOM using id/name embedded in fieldId
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
  return null;
}

// ─── Batch fill ───────────────────────────────────────────────────────────────

function fillFields(fieldMapping, detectedFields, skipFilled = false) {
  const result = { filled: 0, skipped: 0, alreadyFilled: 0, errors: [] };

  console.log('[FillFields] Starting fill — mapping keys:', Object.keys(fieldMapping).length, '| detected fields:', detectedFields.length);

  for (const [fieldId, value] of Object.entries(fieldMapping)) {
    if (value === null || value === undefined) {
      console.log('[FillFields] SKIP (null value):', fieldId);
      result.skipped++;
      continue;
    }
    if (skipFilled && isFieldAlreadyFilled(fieldId)) {
      console.log('[FillFields] SKIP (already filled):', fieldId);
      result.alreadyFilled++;
      continue;
    }

    const el = findElementByFieldId(fieldId, detectedFields);
    if (!el) {
      console.warn('[FillFields] FAIL (element not found):', fieldId, '→ value was:', value);
      result.errors.push({ fieldId, error: 'Element not found' });
      result.skipped++;
      continue;
    }

    console.log('[FillFields] Filling:', fieldId, '→', value, '| tag:', el.tagName, '| type:', el.type);
    const ok = fillFieldByType(el, value, skipFilled);
    if (ok) {
      console.log('[FillFields] ✓ Filled:', fieldId);
      result.filled++;
    } else {
      console.warn('[FillFields] ✗ Fill failed:', fieldId);
      result.errors.push({ fieldId, error: 'Fill failed' });
      result.skipped++;
    }
  }

  return result;
}

function fillAllFields(fieldMapping, detectedFields, skipFilled = true) {
  clearFilledFieldTracking();
  const res = fillFields(fieldMapping, detectedFields, skipFilled);
  console.log('[FillFields] Complete:', res);
  return { ...res, total: Object.keys(fieldMapping).length };
}