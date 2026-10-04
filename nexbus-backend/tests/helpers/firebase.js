// In-memory stand-in for config/firebase.js so tests never touch the real project.
const store = {};      // 'collection/id' -> data
const auditLog = [];   // everything written to system_logs

const snap = (id, data) => ({ id, exists: data !== undefined, data: () => data, ref: { id } });

const collection = (name) => ({
  add: async (data) => {
    if (name === 'system_logs') auditLog.push(data);
    else store[`${name}/auto-${Object.keys(store).length}`] = data;
    return { id: 'auto' };
  },
  doc: (id = 'auto') => ({
    id,
    get: async () => snap(id, store[`${name}/${id}`]),
    set: async (data) => { store[`${name}/${id}`] = data; },
    update: async (data) => { store[`${name}/${id}`] = { ...store[`${name}/${id}`], ...data }; }
  }),
  where: () => ({ get: async () => ({ docs: [], empty: true, size: 0 }), where: () => ({ get: async () => ({ docs: [], empty: true, size: 0 }) }) }),
  get: async () => ({ docs: [], empty: true, size: 0 })
});

const tokens = {
  passenger: { uid: 'p1', email: 'p@x.lk', role: 'passenger' },
  driver: { uid: 'd1', email: 'd@x.lk', role: 'driver', operatorId: 'op1' },
  operator: { uid: 'o1', email: 'o@x.lk', role: 'operator', operatorId: 'op1' },
  admin: { uid: 'a1', email: 'a@x.lk', role: 'admin' }
};

const auth = {
  verifyIdToken: async (token) => {
    if (tokens[token]) return tokens[token];
    const err = new Error('bad token');
    err.code = token === 'expired' ? 'auth/id-token-expired' : 'auth/argument-error';
    throw err;
  }
};

module.exports = {
  admin: {},
  db: { collection, batch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }), runTransaction: async (fn) => fn({ get: async () => snap('x', undefined), set() {}, update() {} }) },
  auth,
  messaging: { send: async () => {} },
  FieldValue: { delete: () => null, serverTimestamp: () => 0, increment: (n) => n },
  __store: store,
  __audit: auditLog
};
