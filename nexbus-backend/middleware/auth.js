const { db, auth } = require('../config/firebase');
const audit = require('../services/audit.service');
const { AppError } = require('../utils/errors');

const profileCache = new Map(); // uid -> { at, profile }
const CACHE_MS = 60 * 1000;

async function loadProfile(uid) {
  const hit = profileCache.get(uid);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.profile;
  const snap = await db.collection('users').doc(uid).get();
  const profile = snap.exists ? snap.data() : {};
  profileCache.set(uid, { at: Date.now(), profile });
  return profile;
}

const clearProfileCache = (uid) => profileCache.delete(uid);

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'TOKEN_MISSING', 'Please sign in to continue');

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token, true); // true = reject revoked tokens
  } catch (err) {
    await audit.log({ action: 'AUTH_FAILED', entity: req.originalUrl, severity: 'security', details: { code: err.code } });
    throw new AppError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again');
  }

  // Role comes from the server-set custom claim; accounts created before claims fall back to the profile.
  const profile = await loadProfile(decoded.uid);
  if (profile.status === 'disabled') throw new AppError(401, 'ACCOUNT_DISABLED', 'This account has been disabled');

  req.user = {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name,
    role: decoded.role || profile.role || 'passenger',
    operatorId: decoded.operatorId || profile.operator_id || null
  };
  next();
}

module.exports = authenticate;
module.exports.clearProfileCache = clearProfileCache;
