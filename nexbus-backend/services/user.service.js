const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { AppError } = require('../utils/errors');
const { clearProfileCache } = require('../middleware/auth');

function row(r) {
  if (!r) return null;
  return {
    uid: r.id, full_name: r.full_name, name: r.full_name, email: r.email, phone: r.phone || '',
    role: r.role, operator_id: r.operator_id || null, status: r.status, preferred_language: r.preferred_language,
    region: r.region || undefined, push_token: r.push_token || undefined, photo_url: r.photo_url || null, created_at: Number(r.created_at)
  };
}

async function createAccount({ email, password, full_name: fullName, phone, role, operator_id: operatorId }) {
  const uid = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const now = Date.now();
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role, operator_id, status, preferred_language, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 'en', $8) RETURNING *`,
      [uid, email, passwordHash, fullName, phone || '', role, operatorId || null, now]
    );
    return row(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw new AppError(409, 'EMAIL_IN_USE', 'Email already registered');
    throw err;
  }
}

async function getProfile(uid) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [uid]);
  if (!rows[0]) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  return row(rows[0]);
}

// Accounts that sign in with a provider (Google) are expected to already have a row from /auth/google;
// this is only a defensive fallback in case a profile is somehow missing.
async function ensurePassengerProfile(user) {
  const existing = await pool.query('SELECT * FROM users WHERE id = $1', [user.uid]);
  if (existing.rows[0]) return row(existing.rows[0]);
  const fullName = user.email ? user.email.split('@')[0] : 'Passenger';
  const now = Date.now();
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, full_name, phone, role, status, preferred_language, created_at)
     VALUES ($1, $2, $3, '', 'passenger', 'active', 'en', $4) RETURNING *`,
    [user.uid, user.email || '', fullName, now]
  );
  clearProfileCache(user.uid);
  return row(rows[0]);
}

async function updateProfile(uid, patch) {
  const sets = [];
  const values = [];
  const add = (col, val) => { values.push(val); sets.push(`${col} = $${values.length}`); };

  if (patch.full_name) add('full_name', patch.full_name);
  if (patch.phone !== undefined) add('phone', patch.phone);
  if (patch.region !== undefined) add('region', patch.region);
  if (patch.preferred_language) add('preferred_language', patch.preferred_language);
  if (patch.push_token) add('push_token', patch.push_token);
  add('updated_at', Date.now());

  values.push(uid);
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
  clearProfileCache(uid);
  return getProfile(uid);
}

// Stores the new photo (or clears it with null) and returns the key of the one it replaces, so the caller can delete that file
async function setPhoto(uid, photo) {
  const { rows } = await pool.query('SELECT photo_key FROM users WHERE id = $1', [uid]);
  if (!rows[0]) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  await pool.query('UPDATE users SET photo_url = $1, photo_key = $2, updated_at = $3 WHERE id = $4',
    [photo ? photo.url : null, photo ? photo.key : null, Date.now(), uid]);
  clearProfileCache(uid);
  return { previousKey: rows[0].photo_key, profile: await getProfile(uid) };
}

module.exports = { createAccount, getProfile, ensurePassengerProfile, updateProfile, setPhoto };
