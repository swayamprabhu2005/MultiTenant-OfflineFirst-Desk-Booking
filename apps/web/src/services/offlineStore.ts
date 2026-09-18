/**
 * IndexedDB Offline Storage & Synchronization Engine
 * Designed for Employee and Branch Admin offline resilience.
 * Stores pending outbox booking transactions and caches floor plans.
 */

const DB_NAME = 'deskbooking_offline_db';
const DB_VERSION = 1;

export interface OutboxItem {
  id: string;
  action: 'CREATE_BOOKING' | 'CANCEL_BOOKING' | 'BULK_BOOKING';
  endpoint: string;
  payload: any;
  createdAt: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  error?: string;
  retryCount: number;
}

let dbInstance: IDBDatabase | null = null;

export async function getOfflineDb(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('outbox_queue')) {
        const outboxStore = db.createObjectStore('outbox_queue', { keyPath: 'id' });
        outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
        outboxStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains('floorplan_cache')) {
        db.createObjectStore('floorplan_cache', { keyPath: 'cacheKey' });
      }
    };

    request.onsuccess = (event: Event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event: Event) => {
      console.error('Failed to open indexedDB:', event);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Enqueue a booking or cancellation operation into the outbox for background sync
 */
export async function enqueueOutboxItem(
  action: OutboxItem['action'],
  endpoint: string,
  payload: any
): Promise<OutboxItem> {
  const db = await getOfflineDb();
  const id = `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const item: OutboxItem = {
    id,
    action,
    endpoint,
    payload,
    createdAt: new Date().toISOString(),
    status: 'PENDING',
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox_queue', 'readwrite');
    const store = tx.objectStore('outbox_queue');
    const req = store.put(item);

    req.onsuccess = () => {
      notifyOutboxUpdated();
      resolve(item);
    };

    req.onerror = () => {
      reject(req.error);
    };
  });
}

/**
 * Retrieve all pending outbox queue items sorted chronologically
 */
export async function getPendingOutboxItems(): Promise<OutboxItem[]> {
  const db = await getOfflineDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox_queue', 'readonly');
    const store = tx.objectStore('outbox_queue');
    const req = store.getAll();

    req.onsuccess = () => {
      const items: OutboxItem[] = (req.result || []).filter(
        (i: OutboxItem) => i.status === 'PENDING' || i.status === 'FAILED'
      );
      items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      resolve(items);
    };

    req.onerror = () => {
      reject(req.error);
    };
  });
}

/**
 * Count of pending outbox items
 */
export async function getOutboxCount(): Promise<number> {
  try {
    const items = await getPendingOutboxItems();
    return items.length;
  } catch {
    return 0;
  }
}

/**
 * Update status of an outbox item
 */
export async function updateOutboxItemStatus(
  id: string,
  status: OutboxItem['status'],
  error?: string
): Promise<void> {
  const db = await getOfflineDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox_queue', 'readwrite');
    const store = tx.objectStore('outbox_queue');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result as OutboxItem;
      if (item) {
        item.status = status;
        if (error) item.error = error;
        if (status === 'FAILED') item.retryCount += 1;
        store.put(item);
      }
      notifyOutboxUpdated();
      resolve();
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Remove an item from outbox once successfully synced
 */
export async function removeOutboxItem(id: string): Promise<void> {
  const db = await getOfflineDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox_queue', 'readwrite');
    const store = tx.objectStore('outbox_queue');
    const req = store.delete(id);

    req.onsuccess = () => {
      notifyOutboxUpdated();
      resolve();
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Clear all outbox items
 */
export async function clearOutbox(): Promise<void> {
  const db = await getOfflineDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox_queue', 'readwrite');
    const store = tx.objectStore('outbox_queue');
    const req = store.clear();

    req.onsuccess = () => {
      notifyOutboxUpdated();
      resolve();
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Cache floor plan data in IndexedDB
 */
export async function cacheFloorPlanData(cacheKey: string, data: any): Promise<void> {
  try {
    const db = await getOfflineDb();
    const tx = db.transaction('floorplan_cache', 'readwrite');
    const store = tx.objectStore('floorplan_cache');
    store.put({
      cacheKey,
      data,
      cachedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to cache floor plan offline:', err);
  }
}

/**
 * Retrieve cached floor plan data from IndexedDB
 */
export async function getCachedFloorPlanData(cacheKey: string): Promise<any | null> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve) => {
      const tx = db.transaction('floorplan_cache', 'readonly');
      const store = tx.objectStore('floorplan_cache');
      const req = store.get(cacheKey);

      req.onsuccess = () => {
        resolve(req.result?.data || null);
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Helper to dispatch window event whenever outbox changes
 */
function notifyOutboxUpdated() {
  getOutboxCount().then((count) => {
    window.dispatchEvent(new CustomEvent('offline-outbox-updated', { detail: { count } }));
  });
}

export function isAppOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
