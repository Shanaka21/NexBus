const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const ACCESS_TTL_SEC = 30 * 60; // 30 min, same staleness budget the profile cache already tolerates
const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

// Access token carries everything the auth middleware needs without a DB round trip.
function signAccessToken(user) {
  return jwt.sign(
    { uid: user.uid, email: user.email, role: user.role, operatorId: user.operatorId || null, tokenVersion: user.tokenVersion || 0 },
    secret(),
    { expiresIn: ACCESS_TTL_SEC }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, secret()); // throws on expired/invalid/tampered tokens
}

const hash = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// Issues a new refresh token row for the user, returns the raw (unhashed) token to hand to the client.
async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, hash(raw), now, now + REFRESH_TTL_MS]
  );
  return raw;
}

// Validates a presented refresh token, revokes it, and issues a replacement (rotation).
// Returns null if the token is unknown, expired, or already revoked.
async function rotateRefreshToken(raw) {
  const { rows } = await pool.query(
    'SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1',
    [hash(raw)]
  );
  const row = rows[0];
  if (!row || row.revoked_at || row.expires_at < Date.now()) return null;
  await pool.query('UPDATE refresh_tokens SET revoked_at = $1 WHERE id = $2', [Date.now(), row.id]);
  const nextRaw = await issueRefreshToken(row.user_id);
  return { userId: row.user_id, refreshToken: nextRaw };
}

async function revokeAllRefreshTokens(userId) {
  await pool.query('UPDATE refresh_tokens SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL', [Date.now(), userId]);
}

module.exports = {
  signAccessToken, verifyAccessToken, issueRefreshToken, rotateRefreshToken, revokeAllRefreshTokens,
  ACCESS_TTL_SEC, hashToken: hash
};
