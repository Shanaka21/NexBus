const admin = require('firebase-admin');

if (!admin.apps.length) {
  let credential;
  try {
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // Netlify and similar hosts: the key is stored as three environment variables instead of a file
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'nexbus-7f898',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } else {
      credential = admin.credential.cert(require('../serviceAccountKey.json'));
    }
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
