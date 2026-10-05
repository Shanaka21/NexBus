const crypto = require('crypto');
const { pool } = require('../config/db');
const { AppError } = require('../utils/errors');
const userService = require('./user.service');
const audit = require('./audit.service');
const { clearProfileCache } = require('../middleware/auth');
const { revokeAllRefreshTokens } = require('../utils/tokens');

async function createOperator(user, dto) {
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await pool.query(
      'INSERT INTO operators (id, name, registration_no, contact_phone, email, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, dto.name, dto.registration_no, dto.contact_phone || null, dto.email || null, 'active', now]
    );
  } catch (err) {
    if (err.code === '23505') throw new AppError(409, 'REGISTRATION_IN_USE', 'An operator with this registration number already exists');
    throw err;
  }
  await audit.log({ userId: user.uid, action: 'OPERATOR_CREATED', entity: 'operators', entityId: id });
  return { id, ...dto, status: 'active', created_at: now };
}

async function listOperators() {
  const { rows } = await pool.query('SELECT * FROM operators');
  return rows.map(r => ({ ...r, created_at: Number(r.created_at) }));
}

async function createUser(user, dto) {
  if (dto.role === 'operator') {
    const { rows } = await pool.query('SELECT id FROM operators WHERE id = $1', [dto.operator_id]);
    if (!rows[0]) throw new AppError(400, 'OPERATOR_NOT_FOUND', 'Select an existing operator company');
  }
  const created = await userService.createAccount(dto);
  await audit.log({ userId: user.uid, action: 'USER_CREATED', entity: 'users', entityId: created.uid, details: { role: dto.role } });
  return created;
}

async function listUsers({ role }) {
  const { rows } = role
    ? await pool.query('SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT 500', [role])
    : await pool.query('SELECT * FROM users ORDER BY created_at DESC LIMIT 500');
  return rows.map(u => ({
    uid: u.id, full_name: u.full_name, email: u.email, phone: u.phone, role: u.role,
    operator_id: u.operator_id || null, status: u.status || 'active', created_at: Number(u.created_at)
  }));
}

// Disabling bumps the token version and revokes refresh tokens, so the middleware rejects the user's
// current access token on its next request (within the 60s status-cache window) and refresh fails outright.
async function setUserStatus(admin, uid, status) {
  if (uid === admin.uid) throw new AppError(400, 'VALIDATION_ERROR', 'You cannot change your own status');
  const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [uid]);
  if (!rows[0]) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  await pool.query('UPDATE users SET status = $1, token_version = token_version + 1 WHERE id = $2', [status, uid]);
  if (status === 'disabled') await revokeAllRefreshTokens(uid);
  clearProfileCache(uid);
  await audit.log({ userId: admin.uid, action: status === 'disabled' ? 'USER_DISABLED' : 'USER_ENABLED', entity: 'users', entityId: uid });
  return { message: `Account ${status === 'disabled' ? 'disabled' : 'enabled'}`, status };
}

async function searchLogs({ action, user_id: userId, severity, limit }) {
  const { rows } = await pool.query('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 300');
  return rows
    .map(l => ({ id: String(l.id), user_id: l.user_id, action: l.action, entity: l.entity, entity_id: l.entity_id, details: l.details, severity: l.severity, created_at: Number(l.created_at) }))
    .filter(l => (!action || l.action.includes(action.toUpperCase())) &&
      (!userId || l.user_id === userId) &&
      (!severity || l.severity === severity))
    .slice(0, limit || 100);
}

module.exports = { createOperator, listOperators, createUser, listUsers, setUserStatus, searchLogs };
