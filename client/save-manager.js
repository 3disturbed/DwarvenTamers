import {
  CHUNK_STORE,
  clearBrowserStore,
  getBrowserEntries,
  replaceBrowserEntries,
} from '../shared/BrowserDatabase.js';
import {
  APP_BACKUP_FILENAME_PREFIX,
  APP_BACKUP_FORMAT,
  APP_NAME,
  APP_STORAGE_PREFIX,
} from '../shared/AppConfig.js';

const SAVE_PREFIX = APP_STORAGE_PREFIX;
const BACKUP_FORMAT = APP_BACKUP_FORMAT;
const BACKUP_VERSION = 2;

export function createBackup(storage, now = new Date(), indexedData = { chunks: [] }) {
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
    indexedData,
  };
}

export async function createFullBackup(storage, now = new Date()) {
  return createBackup(storage, now, {
    chunks: await getBrowserEntries(CHUNK_STORE),
  });
}

export function validateBackup(value) {
  if (!value || value.format !== BACKUP_FORMAT || ![1, BACKUP_VERSION].includes(value.version)) {
    throw new Error(`This is not a supported ${APP_NAME} backup.`);
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
  if (value.indexedData !== undefined) {
    const chunks = value.indexedData?.chunks;
    if (!Array.isArray(chunks) || chunks.some(entry =>
      !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string')) {
      throw new Error('The backup contains invalid world data.');
    }
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

export async function replaceFullSaveData(storage, backup) {
  validateBackup(backup);
  const previousLocal = createBackup(storage);
  const previousChunks = await getBrowserEntries(CHUNK_STORE);
  try {
    replaceSaveData(storage, backup);
    await replaceBrowserEntries(CHUNK_STORE, backup.indexedData?.chunks || []);
  } catch (error) {
    replaceSaveData(storage, previousLocal);
    await replaceBrowserEntries(CHUNK_STORE, previousChunks);
    throw error;
  }
}

export async function clearFullSaveData(storage) {
  await clearBrowserStore(CHUNK_STORE);
  clearSaveData(storage);
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

  exportButton.addEventListener('click', async () => {
    const backup = await createFullBackup(localStorage);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${APP_BACKUP_FILENAME_PREFIX}-${backup.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    const chunkCount = backup.indexedData.chunks.length;
    setStatus(`Backup ready — ${chunkCount} world chunks included.`, 'success');
  });

  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const backup = validateBackup(JSON.parse(await file.text()));
      await replaceFullSaveData(localStorage, backup);
      setStatus('Backup restored. Reloading your adventure…', 'success');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(error.message || 'Could not restore this backup.', 'error');
    }
  });

  resetButton.addEventListener('click', async () => {
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
    await clearFullSaveData(localStorage);
    setStatus('Progress cleared. Reloading…', 'success');
    window.setTimeout(() => window.location.reload(), 500);
  });
}
