// export const storage = {
//   saveToken: (token) => localStorage.setItem("token", token),
//   getToken: () => localStorage.getItem("token"),
//   savePrivateKey: (key) => localStorage.setItem("privateKey", key),
//   getPrivateKey: () => localStorage.getItem("privateKey"),
//   saveUser: (user) => localStorage.setItem("currentUser", JSON.stringify(user)),
//   getUser: () => JSON.parse(localStorage.getItem("currentUser") || "null"),
//   clear: () => localStorage.clear(),
// };

const IDB_NAME    = "whisperbox";
const IDB_VERSION = 1;
const IDB_STORE   = "keys";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror   = (e) => reject(e.target.error);
  });
}

async function idbSet(id, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req   = store.put({ id, value });
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function idbGet(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req   = store.get(id);
    req.onsuccess = (e) => resolve(e.target.result?.value ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export const storage = {
  saveToken:  (token) => localStorage.setItem("token", token),
  getToken:   ()      => localStorage.getItem("token"),
  clearToken: ()      => localStorage.removeItem("token"),

  saveUser:  (user) => localStorage.setItem("wb_user", JSON.stringify(user)),
  getUser:   ()     => {
    try { return JSON.parse(localStorage.getItem("wb_user") || "null"); }
    catch { return null; }
  },
  clearUser: () => localStorage.removeItem("wb_user"),

  savePrivateKey:  async (userId, key) => await idbSet(`pk_${userId}`, key),
  getPrivateKey:   async (userId)      => await idbGet(`pk_${userId}`),

  clearSession: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("wb_user");
  },
};
