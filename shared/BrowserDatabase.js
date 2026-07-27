const DATABASE_NAME = 'soloheim';
const DATABASE_VERSION = 1;
export const CHUNK_STORE = 'chunks';

let databasePromise = null;

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable'));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CHUNK_STORE)) {
        database.createObjectStore(CHUNK_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open save database'));
    request.onblocked = () => reject(new Error('Save database upgrade is blocked by another tab'));
  });
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Save database request failed'));
  });
}

export async function getBrowserValue(storeName, key) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  return requestResult(transaction.objectStore(storeName).get(key));
}

export async function setBrowserValue(storeName, key, value) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  await requestResult(transaction.objectStore(storeName).put(value, key));
}

export async function getBrowserEntries(storeName) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);
  const [keys, values] = await Promise.all([
    requestResult(store.getAllKeys()),
    requestResult(store.getAll()),
  ]);
  return keys.map((key, index) => [key, values[index]]);
}

export async function replaceBrowserEntries(storeName, entries) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.clear();
    for (const [key, value] of entries) store.put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not replace save data'));
    transaction.onabort = () => reject(transaction.error || new Error('Save replacement was aborted'));
  });
}

export async function clearBrowserStore(storeName) {
  await replaceBrowserEntries(storeName, []);
}
