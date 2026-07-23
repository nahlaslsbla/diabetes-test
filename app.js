import {
  loginUser,
  logoutUser,
  registerUser,
  watchAuthState
} from "./auth.js";
import {
  getUserResults,
  mapCurrentResultFromDOMOrState,
  saveResult
} from "./result-service.js";
import { exportResultToPDF } from "./pdf-service.js";

let currentUser = null;
let activeSaveAttemptId = null;
let historyResults = {};

function showAppToast(message) {
  if (window.showToast) window.showToast(message);
}

function getAuthFormValues() {
  return {
    email: document.getElementById("auth-email")?.value?.trim() || "",
    password: document.getElementById("auth-password")?.value || ""
  };
}

function setAuthLoading(isLoading) {
  ["auth-login-btn", "auth-register-btn", "auth-logout-btn"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.disabled = isLoading;
  });
}

function formatResultDate(value) {
  let date = new Date();
  if (value?.toDate) date = value.toDate();
  else if (value instanceof Date) date = value;
  else if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function updateAuthUI() {
  const guestBox = document.getElementById("auth-guest-box");
  const userBox = document.getElementById("auth-user-box");
  const emailText = document.getElementById("auth-current-email");
  const navChip = document.getElementById("nav-auth-chip");
  const mobileEmail = document.getElementById("mobile-auth-email");

  if (guestBox) guestBox.style.display = currentUser ? "none" : "block";
  if (userBox) userBox.style.display = currentUser ? "block" : "none";
  if (emailText) emailText.textContent = currentUser?.email || "-";
  if (navChip) navChip.textContent = currentUser ? "Riwayat" : "Masuk";
  if (mobileEmail) mobileEmail.textContent = currentUser?.email || "Belum login";
  const mobileMasuk = document.getElementById("mobile-masuk-btn");
  if (mobileMasuk) mobileMasuk.style.display = currentUser ? "none" : "";
}

async function handleAuthAction(action) {
  const { email, password } = getAuthFormValues();
  setAuthLoading(true);
  try {
    if (action === "register") {
      await registerUser(email, password);
      showAppToast("Registrasi berhasil.");
    } else {
      await loginUser(email, password);
      showAppToast("Login berhasil.");
    }
    window.showPage?.("test");
  } catch (error) {
    showAppToast(error.message || "Terjadi kesalahan. Coba lagi.");
  } finally {
    setAuthLoading(false);
  }
}

async function handleLogout() {
  setAuthLoading(true);
  try {
    await logoutUser();
    showAppToast("Logout berhasil.");
  } catch (error) {
    showAppToast(error.message || "Terjadi kesalahan. Coba lagi.");
  } finally {
    setAuthLoading(false);
  }
}

async function handleResultReady(resultData) {
  window.latestResultData = resultData;

  if (!currentUser) {
    showAppToast("Login untuk menyimpan hasil tes ke riwayat.");
    return;
  }
  if (!resultData || window.latestResultSaved) return;

  const attemptId = window.latestResultAttemptId || "latest";
  if (activeSaveAttemptId === attemptId) return;
  activeSaveAttemptId = attemptId;

  try {
    await saveResult(currentUser, resultData);
    window.latestResultSaved = true;
    showAppToast("Hasil tes tersimpan ke riwayat.");
  } catch (error) {
    activeSaveAttemptId = null;
    showAppToast(error.message || "Gagal menyimpan hasil tes.");
  }
}

function renderHistoryEmpty(message) {
  const state = document.getElementById("history-state");
  const list = document.getElementById("history-list");
  if (state) state.textContent = message;
  if (list) list.innerHTML = "";
}

function removeHistoryState() {
  const state = document.getElementById("history-state");
  if (state) state.remove();
}

async function renderHistoryPage() {
  updateAuthUI();

  if (!currentUser) {
    renderHistoryEmpty("Silakan login untuk melihat riwayat hasil tes.");
    return;
  }

  const state = document.getElementById("history-state");
  const list = document.getElementById("history-list");
  if (state) state.textContent = "Memuat riwayat hasil...";
  if (list) list.innerHTML = "";

  try {
    const results = await getUserResults(currentUser);
    historyResults = Object.fromEntries(results.map((item) => [item.id, item]));

    if (results.length === 0) {
      renderHistoryEmpty("Belum ada hasil tes tersimpan.");
      return;
    }

    removeHistoryState();
    if (list) {
      list.innerHTML = results.map((item) => `
        <div class="history-card">
          <div>
            <div class="history-date">${formatResultDate(item.createdAt)}</div>
            <h3>${item.riskLevel || "-"}</h3>
            <p>${item.riskMessage || "-"}</p>
          </div>
          <div class="history-score">
            <strong>${item.score ?? 0}/${item.maxScore ?? 26}</strong>
            <span>${item.probability || "-"}</span>
          </div>
          <button class="btn-outline" onclick="window.exportHistoryResult('${item.id}')">Export PDF</button>
        </div>
      `).join("");
    }
  } catch (error) {
    renderHistoryEmpty(error.message || "Gagal memuat riwayat hasil.");
  }
}

function exportLatestResult() {
  try {
    const resultData = {
      ...mapCurrentResultFromDOMOrState(),
      email: currentUser?.email || window.latestResultData?.email || "",
      createdAt: window.latestResultData?.createdAt || new Date()
    };
    exportResultToPDF(resultData);
  } catch (error) {
    showAppToast(error.message || "Gagal export PDF.");
  }
}

function exportHistoryResult(resultId) {
  try {
    const resultData = historyResults[resultId];
    if (!resultData) throw new Error("Data riwayat tidak ditemukan.");
    exportResultToPDF(resultData);
  } catch (error) {
    showAppToast(error.message || "Gagal export PDF.");
  }
}

window.handleAuthLogin = () => handleAuthAction("login");
window.handleAuthRegister = () => handleAuthAction("register");
window.handleAuthLogout = handleLogout;
window.handleResultReady = handleResultReady;
window.renderHistoryPage = renderHistoryPage;
window.exportLatestResultPDF = exportLatestResult;
window.exportHistoryResult = exportHistoryResult;

watchAuthState((user) => {
  currentUser = user;
  window.currentUser = user;
  updateAuthUI();
  if (document.getElementById("page-history")?.classList.contains("active")) {
    renderHistoryPage();
  }
});
