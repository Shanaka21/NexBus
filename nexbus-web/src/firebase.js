import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "nexbus-7f898.firebaseapp.com",
  projectId: "nexbus-7f898",
  storageBucket: "nexbus-7f898.firebasestorage.app",
  messagingSenderId: "188813305489",
  appId: "1:188813305489:web:5a428b22a0c8f6c8b4c130",
  databaseURL: "https://nexbus-7f898-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
