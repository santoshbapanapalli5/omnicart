import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCQL5k1z8kXyg6580gCaKr_ghMa0sFHdiI",
  authDomain: "omnicart-824b0.firebaseapp.com",
  projectId: "omnicart-824b0",
  storageBucket: "omnicart-824b0.firebasestorage.app",
  messagingSenderId: "225619740100",
  appId: "1:225619740100:web:dcdba70266c0474b-ab98-4e5cb5f85fd9",
  measurementId: "G-G5GEWEW45B"
};

// Initialize Firebase safely for SSR/Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);