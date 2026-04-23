import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyCmH1-ZWzNmRhbeDA6inllnnEp7ShbDG_8",
  authDomain: "nexbus-7f898.firebaseapp.com",
  projectId: "nexbus-7f898",
  storageBucket: "nexbus-7f898.firebasestorage.app",
  messagingSenderId: "188813305489",
  appId: "1:188813305489:web:5a428b22a0c8c8f6c8b4c130"
};

const app = initializeApp(firebaseConfig);
export default app;