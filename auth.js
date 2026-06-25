import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  doc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

function validateCredentials(email, password) {
  if (!email) throw new Error("Email wajib diisi.");
  if (!password) throw new Error("Password wajib diisi.");
  if (password.length < 6) throw new Error("Password minimal 6 karakter.");
}

function mapAuthError(error) {
  const code = error?.code;
  if (code === "auth/email-already-in-use") return "Email sudah terdaftar.";
  if (code === "auth/invalid-email") return "Format email tidak valid.";
  if (code === "auth/weak-password") return "Password minimal 6 karakter.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "Email atau password salah.";
  }
  if (code) return "Terjadi kesalahan. Coba lagi.";
  return error?.message || "Terjadi kesalahan. Coba lagi.";
}

export async function registerUser(email, password) {
  try {
    const cleanEmail = email.trim();
    validateCredentials(cleanEmail, password);
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await setDoc(doc(db, "users", credential.user.uid), {
      email: cleanEmail,
      createdAt: serverTimestamp()
    }, { merge: true });
    return credential.user;
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function loginUser(email, password) {
  try {
    const cleanEmail = email.trim();
    validateCredentials(cleanEmail, password);
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return credential.user;
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
