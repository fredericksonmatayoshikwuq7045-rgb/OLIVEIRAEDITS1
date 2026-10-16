const DB_NAME = 'OliveiraEditsV2';
const VERSION = 1;
let database: Promise<IDBDatabase> | undefined;
function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      for (const name of ['records', 'assets']) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      database = undefined;
      reject(new Error('Feche outras abas do editor para atualizar o armazenamento.'));
    };
  });
  return database;
}
export async function browserRead<T>(store: 'records' | 'assets', key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}
export async function browserWrite(store: 'records' | 'assets', key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Gravação cancelada pelo navegador.'));
  });
}
export async function readLegacyFile(kind: 'video' | 'image', id: string | number): Promise<Blob | null> {
  const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = indexedDB.open('OliveiraEditsDB');
    let absent = false;
    request.onupgradeneeded = () => {
      absent = true;
      request.transaction?.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => (absent ? resolve(null) : reject(request.error));
  });
  if (!db) return null;
  try {
    if (!db.objectStoreNames.contains('files')) return null;
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = db.transaction('files', 'readonly').objectStore('files').get(`${kind}-${id}`);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
