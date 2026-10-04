const admin = require('firebase-admin');

if (!admin.apps.length) {
  let credential;
  try {
    credential = admin.credential.cert(require('../serviceAccountKey.json'));
  } catch {
    // Cloud Run / managed environments: use the attached service account
    credential = admin.credential.applicationDefault();
  }
  admin.initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://nexbus-7f898-default-rtdb.firebaseio.com'
  });
}

module.exports = {
  admin,
  db: admin.firestore(),
  auth: admin.auth(),
  messaging: admin.messaging(),
  FieldValue: admin.firestore.FieldValue
};
