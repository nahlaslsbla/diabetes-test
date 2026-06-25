import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDvs9Zb3ID2MN4yEl2dPhe14vWJQUFDNJk",
  authDomain: "diabetes-checker-165c1.firebaseapp.com",
  projectId: "diabetes-checker-165c1",
  storageBucket: "diabetes-checker-165c1.firebasestorage.app",
  messagingSenderId: "307691990161",
  appId: "1:307691990161:web:34ce827ecafc0a3ddba330",
  measurementId: "G-N2L67W5Y1N"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
