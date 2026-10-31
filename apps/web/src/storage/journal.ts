import type { Entry, Journal } from '../files/engine';
export async function openJournal(): Promise<Journal> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('slamsort-journal', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('operations', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Journal database upgrade blocked by another tab.'));
  });
  return {
    put: (entry: Entry) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction('operations', 'readwrite', { durability: 'strict' });
      tx.objectStore('operations').put(entry);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('Journal write aborted'));
    }),
    all: () => new Promise<Entry[]>((resolve, reject) => {
      const tx = db.transaction('operations', 'readonly'); const request = tx.objectStore('operations').getAll();
      request.onsuccess = () => resolve(request.result as Entry[]); request.onerror = () => reject(request.error);
    }),
  };
}
export function acquireSession(onChange: (held: boolean) => void): () => void {
  let release: (() => void) | undefined, disposed = false;
  if (!navigator.locks) { onChange(false); return () => {}; }
  void navigator.locks.request('slamsort-file-mutation', { ifAvailable: true }, async lock => {
    if (!lock || disposed) { onChange(false); return; }
    onChange(true);
    await new Promise<void>(resolve => { release = resolve; }); onChange(false);
  }).catch(() => onChange(false));
  return () => { disposed = true; release?.(); };
}
