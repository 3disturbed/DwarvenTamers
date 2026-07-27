const SAVE_PREFIX = 'soloheim:';
const BACKUP_FORMAT = 'soloheim-save';
const BACKUP_VERSION = 1;

export function createBackup(storage, now = new Date()) {
  const data = {};
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(SAVE_PREFIX)) data[key] = storage.getItem(key);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data,
  };
}

export function validateBackup(value) {
  if (!value || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new Error('This is not a supported SoloHiem backup.');
  }
  if (!value.data || typeof value.data !== 'object' || Array.isArray(value.data)) {
    throw new Error('The backup does not contain valid save data.');
  }
  for (const [key, storedValue] of Object.entries(value.data)) {
    if (!key.startsWith(SAVE_PREFIX) || typeof storedValue !== 'string') {
      throw new Error('The backup contains an invalid save entry.');
    }
    // All current save values are JSON; parsing catches truncated exports.
    JSON.parse(storedValue);
  }
  return value;
}

export function replaceSaveData(storage, backup) {
  validateBackup(backup);
  const previous = createBackup(storage);
  try {
    clearSaveData(storage);
    for (const [key, value] of Object.entries(backup.data)) storage.setItem(key, value);
  } catch (error) {
    clearSaveData(storage);
    for (const [key, value] of Object.entries(previous.data)) storage.setItem(key, value);
    throw error;
  }
}

export function clearSaveData(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(SAVE_PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export function initializeSaveManager() {
  const dialog = document.getElementById('save-dialog');
  const openButton = document.getElementById('save-btn');
  const closeButton = document.getElementById('save-close');
  const exportButton = document.getElementById('save-export');
  const importButton = document.getElementById('save-import');
  const fileInput = document.getElementById('save-file');
  const resetButton = document.getElementById('save-reset');
  const status = document.getElementById('save-status');
  if (!dialog || !openButton || !closeButton || !exportButton ||
      !importButton || !fileInput || !resetButton || !status) return;

  let resetTimer = null;
  const setStatus = (message, type = '') => {
    status.textContent = message;
    status.className = type;
  };
  const cancelReset = () => {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = null;
    resetButton.textContent = 'Reset';
    resetButton.classList.remove('confirming');
  };
  const close = () => {
    cancelReset();
    dialog.close();
    openButton.focus({ preventScroll: true });
  };

  openButton.addEventListener('click', () => {
    setStatus('');
    dialog.showModal();
  });
  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  exportButton.addEventListener('click', () => {
    const backup = createBackup(localStorage);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `soloheim-backup-${backup.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus(`Backup ready — ${Object.keys(backup.data).length} save entries exported.`, 'success');
  });

  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const backup = validateBackup(JSON.parse(await file.text()));
      replaceSaveData(localStorage, backup);
      setStatus('Backup restored. Reloading your adventure…', 'success');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(error.message || 'Could not restore this backup.', 'error');
    }
  });

  resetButton.addEventListener('click', () => {
    if (!resetButton.classList.contains('confirming')) {
      resetButton.textContent = 'Confirm reset';
      resetButton.classList.add('confirming');
      setStatus('Press Confirm reset within 5 seconds to erase local progress.', 'error');
      resetTimer = window.setTimeout(() => {
        cancelReset();
        setStatus('');
      }, 5000);
      return;
    }
    cancelReset();
    clearSaveData(localStorage);
    setStatus('Progress cleared. Reloading…', 'success');
    window.setTimeout(() => window.location.reload(), 500);
  });
}
