import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCn96WJhm1NpBZSXZ9hBqWNUM9TRgfThVE",
  authDomain: "dineboss-prod.firebaseapp.com",
  projectId: "dineboss-prod",
  storageBucket: "dineboss-prod.firebasestorage.app",
  messagingSenderId: "1019729752673",
  appId: "1:1019729752673:web:ec459d05ad7c96b6dcf020",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
