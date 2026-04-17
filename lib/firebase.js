import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * Firebase configuration with environment variable support
 * 
 * Priority:
 * 1. Environment variables (NEXT_PUBLIC_FIREBASE_*)
 * 2. Default dineboss-prod project
 * 
 * For different environments:
 * - Local: Use default or set NEXT_PUBLIC_FIREBASE_* in .env.local
 * - Production: Vercel uses NEXT_PUBLIC_FIREBASE_*
 * - Staging: Can use different project if env vars set
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCn96WJhm1NpBZSXZ9hBqWNUM9TRgfThVE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dineboss-prod.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dineboss-prod",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dineboss-prod.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1019729752673",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1019729752673:web:ec459d05ad7c96b6dcf020",
};

console.log('[Firebase] Initializing with project:', firebaseConfig.projectId);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
