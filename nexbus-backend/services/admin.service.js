const { db, auth } = require('../config/firebase');
const { AppError } = require('../utils/errors');
const userService = require('./user.service');
const audit = require('./audit.service');
const { clearProfileCache } = require('../middleware/auth');

async function createOperator(user, dto) {
  const dup = await db.collection('operators').where('registration_no', '==', dto.registration_no).get();
  if (!dup.empty) throw new AppError(409, 'REGISTRATION_IN_USE', 'An operator with this registration number already exists');
  const data = { ...dto, status: 'active', created_at: Date.now() };
  const ref = await db.collection('operators').add(data);
  await audit.log({ userId: user.uid, action: 'OPERATOR_CREATED', entity: 'operators', entityId: ref.id });
  return { id: ref.id, ...data };
}

async function listOperators() {
  const snap = await db.collection('operators').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createUser(user, dto) {
  if (dto.role === 'operator') {
    const op = await db.collection('operators').doc(dto.operator_id || 'none').get();
    if (!op.exists) throw new AppError(400, 'OPERATOR_NOT_FOUND', 'Select an existing operator company');
  }
  const created = await userService.createAccount(dto);
  await audit.log({ userId: user.uid, action: 'USER_CREATED', entity: 'users', entityId: created.uid, details: { role: dto.role } });
  return created;
}

async function listUsers({ role }) {
  const col = db.collection('users');
  const snap = await (role ? col.where('role', '==', role) : col).limit(500).get();
  return snap.docs
    .map(d => {
      const u = d.data();
      return { uid: d.id, full_name: u.full_name || u.name, email: u.email, phone: u.phone, role: u.role, operator_id: u.operator_id || null, status: u.status || 'active', created_at: u.created_at };
    })
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

// Disabling revokes refresh tokens, so the middleware rejects the user's current token on its next request.
async function setUserStatus(admin, uid, status) {
  if (uid === admin.uid) throw new AppError(400, 'VALIDATION_ERROR', 'You cannot change your own status');
  const ref = db.collection('users').doc(uid);
  if (!(await ref.get()).exists) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  await auth.updateUser(uid, { disabled: status === 'disabled' });
  if (status === 'disabled') await auth.revokeRefreshTokens(uid);
  await ref.update({ status });
  clearProfileCache(uid);
  await audit.log({ userId: admin.uid, action: status === 'disabled' ? 'USER_DISABLED' : 'USER_ENABLED', entity: 'users', entityId: uid });
  return { message: `Account ${status === 'disabled' ? 'disabled' : 'enabled'}`, status };
}

async function searchLogs({ action, user_id: userId, severity, limit }) {
  const snap = await db.collection('system_logs').orderBy('created_at', 'desc').limit(300).get();
  return snap.docs
    .map(d => {
      const { created_ts, ...rest } = d.data(); // eslint-disable-line no-unused-vars
      return { id: d.id, ...rest };
    })
    .filter(l => (!action || l.action.includes(action.toUpperCase())) &&
      (!userId || l.user_id === userId) &&
      (!severity || l.severity === severity))
    .slice(0, limit || 100);
}

module.exports = { createOperator, listOperators, createUser, listUsers, setUserStatus, searchLogs };
