const { pool } = require('../config/db');
const { verifyAccessToken } = require('../utils/tokens');
const audit = require('../services/audit.service');
const { AppError } = require('../utils/errors');

const statusCache = new Map(); // uid -> { at, status, token_version }
const CACHE_MS = 60 * 1000;

async function loadStatus(uid) {
  const hit = statusCache.get(uid);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  const { rows } = await pool.query('SELECT status, token_version FROM users WHERE id = $1', [uid]);
  const entry = { at: Date.now(), status: rows[0]?.status || null, token_version: rows[0]?.token_version ?? 0 };
  statusCache.set(uid, entry);
  return entry;
}

const clearProfileCache = (uid) => statusCache.delete(uid);

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'TOKEN_MISSING', 'Please sign in to continue');

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    await audit.log({ action: 'AUTH_FAILED', entity: req.originalUrl, severity: 'security', details: { code: err.name } });
    throw new AppError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again');
  }

  const status = await loadStatus(decoded.uid);
  if (status.status === 'disabled') throw new AppError(401, 'ACCOUNT_DISABLED', 'This account has been disabled');
  if (status.status === null) throw new AppError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again');
  if (status.token_version !== decoded.tokenVersion) throw new AppError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again');

  req.user = {
    uid: decoded.uid,
    email: decoded.email,
    role: decoded.role,
    operatorId: decoded.operatorId || null
  };
  next();
}

module.exports = authenticate;
module.exports.clearProfileCache = clearProfileCache;
