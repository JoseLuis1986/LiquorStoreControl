export type OfflineOpType = 'consumption' | 'sale';

export type OfflineQueuedOp = {
  id: string;
  type: OfflineOpType;
  path: string;
  method: string;
  body: unknown;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

const DB_NAME = 'liquorcontrol-offline';
const STORE = 'pending-ops';
const LS_KEY = 'liquorcontrol.offlineQueue';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function lsLoad(): OfflineQueuedOp[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as OfflineQueuedOp[]) : [];
  } catch {
    return [];
  }
}

function lsSave(ops: OfflineQueuedOp[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(ops));
}

export async function enqueueOfflineOp(
  op: Omit<OfflineQueuedOp, 'attempts' | 'createdAt'> & {
    attempts?: number;
    createdAt?: string;
  },
): Promise<OfflineQueuedOp> {
  const full: OfflineQueuedOp = {
    ...op,
    attempts: op.attempts ?? 0,
    createdAt: op.createdAt ?? new Date().toISOString(),
  };
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(full);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  const all = lsLoad().filter((o) => o.id !== full.id);
  all.push(full);
  lsSave(all);
  return full;
}

export async function listOfflineOps(): Promise<OfflineQueuedOp[]> {
  const db = await openDb();
  if (db) {
    const fromDb = await new Promise<OfflineQueuedOp[]>((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as OfflineQueuedOp[]);
      req.onerror = () => resolve(lsLoad());
    });
    if (fromDb.length) return fromDb.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return lsLoad().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOfflineOp(id: string) {
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  lsSave(lsLoad().filter((o) => o.id !== id));
}

export async function updateOfflineOp(op: OfflineQueuedOp) {
  await enqueueOfflineOp(op);
}
