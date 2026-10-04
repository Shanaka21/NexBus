const { db, auth } = require('../config/firebase');
const { AppError } = require('../utils/errors');
const audit = require('./audit.service');

// With the Firebase Auth emulator running (FIREBASE_AUTH_EMULATOR_HOST) the same REST calls go to the emulator
const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST ? 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST + '/' : 'https://';
const IDENTITY = emulator + 'identitytoolkit.googleapis.com/v1/accounts';
const SECURE_TOKEN = emulator + 'securetoken.googleapis.com/v1/token';

function apiKey() {
  const key = process.env.FIREBASE_API_KEY;
  if (!key) throw new AppError(500, 'AUTH_NOT_CONFIGURED', 'Sign-in is not configured on the server');
  return key;
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// Verifies the password with the Firebase Auth REST API and returns tokens plus the profile.
async function login(email, password) {
  const data = await post(`${IDENTITY}:signInWithPassword?key=${apiKey()}`, { email, password, returnSecureToken: true });
  if (data.error) {
    await audit.log({ action: 'LOGIN_FAILED', entity: 'users', severity: 'security', details: { email } });
    if (String(data.error.message).startsWith('USER_DISABLED')) {
      throw new AppError(401, 'ACCOUNT_DISABLED', 'This account has been disabled');
    }
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const uid = data.localId;
  const profile = (await db.collection('users').doc(uid).get()).data() || {};
  if (profile.status === 'disabled') throw new AppError(401, 'ACCOUNT_DISABLED', 'This account has been disabled');

  const role = profile.role || 'passenger';
  const operatorId = profile.operator_id || null;

  // Accounts created before roles existed get their claim set on first sign-in
  const record = await auth.getUser(uid);
  if (record.customClaims?.role !== role) {
    await auth.setCustomUserClaims(uid, { role, operatorId });
  }
  // The custom token lets the client open read-only Firestore listeners that are restricted by the security rules
  const customToken = await auth.createCustomToken(uid, { role, operatorId });

  await audit.log({ userId: uid, action: 'LOGIN', entity: 'users', entityId: uid });
  return {
    message: 'Login successful',
    uid,
    name: profile.full_name || profile.name || data.displayName || 'User',
    email: data.email,
    role,
    operator_id: operatorId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresIn: Number(data.expiresIn),
    customToken
  };
}

async function refresh(refreshToken) {
  const res = await fetch(`${SECURE_TOKEN}?key=${apiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
  });
  const data = await res.json();
  if (data.error) throw new AppError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again');
  return { idToken: data.id_token, refreshToken: data.refresh_token, expiresIn: Number(data.expires_in) };
}

// Always answers the same way so the endpoint cannot be used to discover which emails are registered.
async function forgotPassword(email) {
  await post(`${IDENTITY}:sendOobCode?key=${apiKey()}`, { requestType: 'PASSWORD_RESET', email });
  return { message: 'If this email is registered, a reset link has been sent.' };
}

async function firebaseToken(user) {
  return auth.createCustomToken(user.uid, { role: user.role, operatorId: user.operatorId || null });
}

module.exports = { login, refresh, forgotPassword, firebaseToken };
