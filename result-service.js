import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { db } from "./firebase.js";

function normalizeResultData(user, resultData) {
  return {
    userId: user.uid,
    email: user.email || "",
    score: Number(resultData.score || 0),
    maxScore: Number(resultData.maxScore || 26),
    riskLevel: resultData.riskLevel || "",
    riskClass: resultData.riskClass || "",
    riskMessage: resultData.riskMessage || "",
    probability: resultData.probability || "",
    answers: Array.isArray(resultData.answers) ? resultData.answers : [],
    recommendations: Array.isArray(resultData.recommendations) ? resultData.recommendations : [],
    createdAt: serverTimestamp()
  };
}

export async function saveResult(user, resultData) {
  if (!user?.uid) throw new Error("User belum login.");
  if (!resultData) throw new Error("Data hasil tes tidak tersedia.");

  const resultsRef = collection(db, "users", user.uid, "results");
  const docRef = await addDoc(resultsRef, normalizeResultData(user, resultData));
  return docRef.id;
}

export async function getUserResults(user) {
  if (!user?.uid) return [];

  const resultsRef = collection(db, "users", user.uid, "results");
  const snapshot = await getDocs(query(resultsRef, orderBy("createdAt", "desc")));
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

export function mapCurrentResultFromDOMOrState() {
  if (window.latestResultData) return window.latestResultData;

  const scoreText = document.getElementById("score-counter")?.textContent || "0";
  const score = Number(scoreText);
  const riskLevel = document.querySelector("#score-display .risk-badge")?.textContent?.trim() || "";
  const riskMessage = document.querySelector("#score-display .risk-message")?.textContent?.trim() || "";
  const probabilityText = document.querySelector("#score-display .risk-probability strong")?.textContent?.trim() || "";
  const recommendations = Array.from(document.querySelectorAll("#recs-list .rec-item")).map((item) => ({
    title: item.querySelector("h4")?.textContent?.trim() || "",
    description: item.querySelector("p")?.textContent?.trim() || ""
  }));

  return {
    score,
    maxScore: 26,
    riskLevel,
    riskClass: document.getElementById("score-display")?.className?.replace("score-display", "")?.trim() || "",
    riskMessage,
    probability: probabilityText,
    answers: [],
    recommendations
  };
}
