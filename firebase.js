import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCzukOEygm_1Kj30oqdkCplCUKirGJB4sw",
  authDomain: "diabetes-e7e1b.firebaseapp.com",
  projectId: "diabetes-e7e1b",
  storageBucket: "diabetes-e7e1b.firebasestorage.app",
  messagingSenderId: "591658083588",
  appId: "1:591658083588:web:bf5bf9cacafda8805c1c51"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
