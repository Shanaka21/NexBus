// Runs a script (index.js, seed.js, scripts/smoke.js ...) against the local Firebase emulators instead of the real project.
// Start the emulators first with `npm run emulators` (needs Java 11+).
//   node scripts/emu-env.js index.js
const path = require('path');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.FIREBASE_API_KEY = 'emulator-key'; // the emulator accepts any key; the real key is never sent
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'nexbus-7f898';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/emu-env.js <script> [args]');
  process.exit(1);
}
console.log(`[emulator mode] Firestore ${process.env.FIRESTORE_EMULATOR_HOST}, Auth ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
process.argv.splice(1, 2, path.resolve(target)); // the target sees its own argv
require(path.resolve(target));
