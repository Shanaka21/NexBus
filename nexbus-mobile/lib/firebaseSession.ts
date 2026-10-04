import { signInWithCustomToken, signInWithCredential, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { onSessionCleared } from "./userSession";

// The Firestore listeners (live map) are protected by security rules, so the app also signs in to Firebase.
// The backend issues a custom token at login; failure here only disables live listeners, not the REST API.
export async function signInFirebase(customToken?: string | null): Promise<boolean> {
  if (!customToken) return false;
  try {
    await signInWithCustomToken(auth, customToken);
    return true;
  } catch {
    return false;
  }
}

// Google sign-in: exchange the Google access token for a Firebase session and return its ID token
export async function firebaseIdTokenFromGoogle(accessToken: string) {
  const credential = GoogleAuthProvider.credential(null, accessToken);
  const result = await signInWithCredential(auth, credential);
  return {
    idToken: await result.user.getIdToken(),
    refreshToken: result.user.refreshToken,
    uid: result.user.uid,
    name: result.user.displayName,
    email: result.user.email,
  };
}

onSessionCleared(() => { signOut(auth).catch(() => {}); });
