// firebase.js — Firebase config + shared SDK instances.
//
// ⚠️ REPLACE the placeholder values below with YOUR project keys.
// Get them from: Firebase Console → Project Settings → "Your apps" → SDK config.
// These keys are NOT secret (they ship to the browser); your data is protected
// by Firestore Security Rules (see ../firestore.rules), not by hiding the keys.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyACzyCBmUig_ZY3Y-Afu-v9pQhNe0YWFJc",
  authDomain: "rental-service-5f816.firebaseapp.com",
  projectId: "rental-service-5f816",
  storageBucket: "rental-service-5f816.firebasestorage.app",
  messagingSenderId: "42980088047",
  appId: "1:42980088047:web:8326e1aec18e5afb3de31a",
  measurementId: "G-BB7HXZ257R",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
