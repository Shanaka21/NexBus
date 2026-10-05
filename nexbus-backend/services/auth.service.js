const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { AppError } = require('../utils/errors');
const audit = require('./audit.service');
const { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeAllRefreshTokens, ACCESS_TTL_SEC, hashToken } = require('../utils/tokens');

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

async function login(email, password) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const u = rows[0];
  if (!u || !u.password_hash || !(await bcrypt.compare(password, u.password_hash))) {
    await audit.log({ action: 'LOGIN_FAILED', entity: 'users', severity: 'security', details: { email } });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (u.status === 'disabled') throw new AppError(401, 'ACCOUNT_DISABLED', 'This account has been disabled');

  const idToken = signAccessToken({ uid: u.id, role: u.role, operatorId: u.operator_id, tokenVersion: u.token_version, email: u.email });
  const refreshToken = await issueRefreshToken(u.id);
  await audit.log({ userId: u.id, action: 'LOGIN', entity: 'users', entityId: u.id });

  return {
    message: 'Login successful', uid: u.id, name: u.full_name, email: u.email,
    role: u.role, operator_id: u.operator_id || null, idToken, refreshToken, expiresIn: ACCESS_TTL_SEC
  };
}

async function refresh(refreshToken) {
  const rotated = await rotateRefreshToken(refreshToken);
  if (!rotated) throw new AppError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again');
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [rotated.userId]);
  const u = rows[0];
  if (!u || u.status === 'disabled') throw new AppError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again');

  const idToken = signAccessToken({ uid: u.id, role: u.role, operatorId: u.operator_id, tokenVersion: u.token_version, email: u.email });
  return { idToken, refreshToken: rotated.refreshToken, expiresIn: ACCESS_TTL_SEC };
}

// Google sign-in: the caller has already verified the Google ID token (see routes/auth.js). Finds or
// creates the passenger account by google_sub/email, then issues the same token pair as a password login.
async function loginWithGoogle({ googleSub, email, name }) {
  let { rows } = await pool.query('SELECT * FROM users WHERE google_sub = $1 OR email = $2', [googleSub, email]);
  let u = rows[0];
  if (!u) {
    const uid = crypto.randomUUID();
    const now = Date.now();
    const inserted = await pool.query(
      `INSERT INTO users (id, email, full_name, phone, role, status, preferred_language, google_sub, created_at)
       VALUES ($1, $2, $3, '', 'passenger', 'active', 'en', $4, $5) RETURNING *`,
      [uid, email, name || email.split('@')[0], googleSub, now]
    );
    u = inserted.rows[0];
  } else if (!u.google_sub) {
    await pool.query('UPDATE users SET google_sub = $1 WHERE id = $2', [googleSub, u.id]);
  }
  if (u.status === 'disabled') throw new AppError(401, 'ACCOUNT_DISABLED', 'This account has been disabled');

  const idToken = signAccessToken({ uid: u.id, role: u.role, operatorId: u.operator_id, tokenVersion: u.token_version, email: u.email });
  const refreshToken = await issueRefreshToken(u.id);
  await audit.log({ userId: u.id, action: 'LOGIN', entity: 'users', entityId: u.id, details: { provider: 'google' } });
  return {
    message: 'Login successful', uid: u.id, name: u.full_name, email: u.email,
    role: u.role, operator_id: u.operator_id || null, idToken, refreshToken, expiresIn: ACCESS_TTL_SEC
  };
}

// Always answers the same way so the endpoint cannot be used to discover which emails are registered.
async function forgotPassword(email) {
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (rows[0]) {
    const raw = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    await pool.query(
      'INSERT INTO password_resets (user_id, token_hash, created_at, expires_at) VALUES ($1, $2, $3, $4)',
      [rows[0].id, hashToken(raw), now, now + RESET_TTL_MS]
    );
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    // No email provider is wired up yet; log the link so the reset flow is usable in dev/demo.
    console.log(`Password reset link for ${email}: ${appUrl}/reset-password?token=${raw}`);
  }
  return { message: 'If this email is registered, a reset link has been sent.' };
}

async function resetPassword(token, newPassword) {
  const { rows } = await pool.query('SELECT * FROM password_resets WHERE token_hash = $1', [hashToken(token)]);
  const reset = rows[0];
  if (!reset || reset.used_at || reset.expires_at < Date.now()) {
    throw new AppError(400, 'TOKEN_INVALID', 'This reset link is invalid or has expired');
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2', [passwordHash, reset.user_id]);
  await pool.query('UPDATE password_resets SET used_at = $1 WHERE id = $2', [Date.now(), reset.id]);
  await revokeAllRefreshTokens(reset.user_id);
  return { message: 'Password has been reset. Please sign in again.' };
}

module.exports = { login, refresh, loginWithGoogle, forgotPassword, resetPassword };
