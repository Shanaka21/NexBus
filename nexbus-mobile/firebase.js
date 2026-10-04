import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { initializeFirestore } from "firebase/firestore";

// The API key comes from nexbus-mobile/.env.local (EXPO_PUBLIC_FIREBASE_API_KEY); see .env.example
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "nexbus-7f898.firebaseapp.com",
  projectId: "nexbus-7f898",
  storageBucket: "nexbus-7f898.firebasestorage.app",
  messagingSenderId: "188813305489",
  appId: "1:188813305489:web:5a428b22a0c8c8f6c8b4c130"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// On phones keep the Firebase session in AsyncStorage (the browser build persists by itself)
function createAuth() {
  if (Platform.OS === "web") return getAuth(app);
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app); // already initialised (fast refresh)
  }
}

export const auth = createAuth();
// Long polling keeps the read-only live listeners working on mobile networks and proxies
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
export default app;
