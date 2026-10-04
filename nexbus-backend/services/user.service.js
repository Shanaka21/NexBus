const { db, auth } = require('../config/firebase');
const { AppError } = require('../utils/errors');
const { clearProfileCache } = require('../middleware/auth');

const AUTH_ERRORS = {
  'auth/email-already-exists': [409, 'EMAIL_IN_USE', 'Email already registered'],
  'auth/invalid-email': [400, 'VALIDATION_ERROR', 'Invalid email address'],
  'auth/invalid-password': [400, 'VALIDATION_ERROR', 'Password must be at least 6 characters']
};

// Creates the Firebase account, the server-set role claim and the profile document.
async function createAccount({ email, password, full_name: fullName, phone, role, operator_id: operatorId }) {
  let user;
  try {
    user = await auth.createUser({ email, password, displayName: fullName });
  } catch (err) {
    const mapped = AUTH_ERRORS[err.code];
    if (mapped) throw new AppError(mapped[0], mapped[1], mapped[2]);
    throw err;
  }
  await auth.setCustomUserClaims(user.uid, { role, operatorId: operatorId || null });
  const profile = {
    full_name: fullName,
    name: fullName, // older clients read `name`
    email,
    phone: phone || '',
    role,
    operator_id: operatorId || null,
    status: 'active',
    preferred_language: 'en',
    created_at: Date.now()
  };
  await db.collection('users').doc(user.uid).set(profile);
  return { uid: user.uid, ...profile };
}

async function getProfile(uid) {
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  return { uid: doc.id, ...doc.data() };
}

// Accounts that sign in with a provider (Google) have no profile yet: create the passenger profile on first use.
async function ensurePassengerProfile(user) {
  const fullName = user.name || (user.email ? user.email.split('@')[0] : 'Passenger');
  const profile = {
    full_name: fullName, name: fullName, email: user.email || '', phone: '', role: 'passenger',
    operator_id: null, status: 'active', preferred_language: 'en', created_at: Date.now()
  };
  await db.collection('users').doc(user.uid).set(profile);
  await auth.setCustomUserClaims(user.uid, { role: 'passenger', operatorId: null });
  clearProfileCache(user.uid);
  return { uid: user.uid, ...profile };
}

async function updateProfile(uid, patch) {
  const updates = {};
  if (patch.full_name) { updates.full_name = patch.full_name; updates.name = patch.full_name; }
  if (patch.phone !== undefined) updates.phone = patch.phone;
  if (patch.region !== undefined) updates.region = patch.region;
  if (patch.preferred_language) updates.preferred_language = patch.preferred_language;
  if (patch.fcm_token) updates.fcm_token = patch.fcm_token;
  updates.updated_at = Date.now();
  await db.collection('users').doc(uid).set(updates, { merge: true });
  clearProfileCache(uid);
  if (patch.full_name) await auth.updateUser(uid, { displayName: patch.full_name });
  return getProfile(uid);
}

module.exports = { createAccount, getProfile, ensurePassengerProfile, updateProfile };
