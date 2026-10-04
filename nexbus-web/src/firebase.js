import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Web configuration. The API key comes from nexbus-web/.env.local (VITE_FIREBASE_API_KEY); see .env.example.
const env = import.meta.env
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'nexbus-7f898.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'nexbus-7f898',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'nexbus-7f898.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '188813305489',
  appId: env.VITE_FIREBASE_APP_ID || '1:188813305489:web:5a428b22a0c8c8f6c8b4c130',
})

export const auth = getAuth(app)
export const db = getFirestore(app)

// The live listeners are protected by Firestore security rules, so the dashboard signs in to Firebase too.
// A failure here only disables live listeners; the screens fall back to polling the API.
export async function signInFirebase(customToken) {
  try {
    await signInWithCustomToken(auth, customToken)
    return true
  } catch {
    return false
  }
}

export const signOutFirebase = () => signOut(auth).catch(() => {})
