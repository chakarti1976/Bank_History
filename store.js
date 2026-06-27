/* store.js — IndexedDB persistence layer for Nordea Tracker
   Stores parsed + categorized statements so data survives page refreshes.
*/

const Store = (() => {
  const DB_NAME    = 'NordeaTracker';
  const DB_VERSION = 1;
  const STORE_NAME = 'statements';
  let db = null;

  // ── Open / create DB ──────────────────────────────────────────────────
  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const _db = e.target.result;
        if (!_db.objectStoreNames.contains(STORE_NAME)) {
          const store = _db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('period', 'period', { unique: true });
          store.createIndex('invoiceDate', 'invoiceDate', { unique: false });
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  // ── Save a parsed statement (upsert by period) ────────────────────────
  async function save(statement) {
    const _db = await open();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Check if this period already exists
      const idx = store.index('period');
      const getReq = idx.get(statement.period);
      getReq.onsuccess = e => {
        const existing = e.target.result;
        const record = { ...statement };
        if (existing) record.id = existing.id; // overwrite
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(putReq.result);
        putReq.onerror   = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // ── Load all statements, sorted by invoiceDate asc ───────────────────
  async function loadAll() {
    const _db = await open();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = e => {
        const rows = e.target.result || [];
        rows.sort((a, b) => (a.invoiceDate || '').localeCompare(b.invoiceDate || ''));
        resolve(rows);
      };
      req.onerror = e => reject(e.target.error);
    });
  }

  // ── Delete a statement by id ──────────────────────────────────────────
  async function remove(id) {
    const _db = await open();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  // ── Count stored statements ───────────────────────────────────────────
  async function count() {
    const _db = await open();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  return { save, loadAll, remove, count };
})();
