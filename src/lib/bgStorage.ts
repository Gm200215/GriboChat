const DB_NAME = 'GriboChatDB';
const STORE_NAME = 'backgroundStore';
const SESSIONS_STORE = 'sessionsStore';
const DB_VERSION = 2;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBackgroundImage(dataUrl: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(dataUrl, 'bg_image');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to store background in IndexedDB', e);
  }
}

export async function getBackgroundImage(): Promise<string> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('bg_image');
      request.onsuccess = () => resolve(request.result || '');
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('IndexedDB helper is not accessible or failed', e);
    return '';
  }
}

export async function clearBackgroundImage(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete('bg_image');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to clear background in IndexedDB', e);
  }
}

// Low-level helper to write data to SESSIONS_STORE
export async function saveSessionsToDB(sessions: any[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSIONS_STORE, 'readwrite');
      const store = transaction.objectStore(SESSIONS_STORE);
      const request = store.put(sessions, 'chat_sessions');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to store sessions in IndexedDB', e);
  }
}

// Low-level helper to load data from SESSIONS_STORE
export async function getSessionsFromDB(): Promise<any[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSIONS_STORE, 'readonly');
      const store = transaction.objectStore(SESSIONS_STORE);
      const request = store.get('chat_sessions');
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to retrieve sessions from IndexedDB', e);
    return [];
  }
}

// Low-level helper to write active ID to SESSIONS_STORE
export async function saveActiveIdToDB(activeId: string | null): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSIONS_STORE, 'readwrite');
      const store = transaction.objectStore(SESSIONS_STORE);
      let request;
      if (activeId) {
        request = store.put(activeId, 'active_session_id');
      } else {
        request = store.delete('active_session_id');
      }
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to save active id in IndexedDB', e);
  }
}

// Low-level helper to load active ID from SESSIONS_STORE
export async function getActiveIdFromDB(): Promise<string | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSIONS_STORE, 'readonly');
      const store = transaction.objectStore(SESSIONS_STORE);
      const request = store.get('active_session_id');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to load active session id from IndexedDB', e);
    return null;
  }
}

