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
import { getTrainingDataset } from "./training-data-service.js";
import {
  ATTRIBUTES,
  ATTRIBUTE_LABELS,
  TARGET_KEY,
  buildTree,
  treeToRules,
  ruleToString,
  valueLabel
} from "./c45.js";

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
  const navLogout = document.getElementById("nav-logout-btn");
  if (navLogout) navLogout.style.display = currentUser ? "" : "none";
  const mobileLogout = document.getElementById("mobile-logout-btn");
  if (mobileLogout) mobileLogout.style.display = currentUser ? "" : "none";
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

// ────────── ANALISIS DECISION TREE (C4.5) ──────────

const RISK_DIST_COLORS = {
  "Rendah": "var(--teal)",
  "Sedikit Meningkat": "var(--yellow)",
  "Sedang": "var(--amber)",
  "Tinggi": "var(--red)",
  "Sangat Tinggi": "var(--red)"
};

function attributeLabel(key) {
  return ATTRIBUTE_LABELS[key] || key;
}

function renderAnalysisStats(rows) {
  const total = rows.length;
  const distribution = {};
  for (const row of rows) {
    const label = row[TARGET_KEY] || "-";
    distribution[label] = (distribution[label] || 0) + 1;
  }

  const distCards = Object.entries(distribution)
    .map(([label, count]) => `
      <div class="analysis-stat-card">
        <div class="stat-value">${count}</div>
        <div class="stat-label">${label}</div>
        <div class="analysis-dist-bar"><div class="analysis-dist-fill" style="width:${((count / total) * 100).toFixed(0)}%;background:${RISK_DIST_COLORS[label] || "var(--blue)"}"></div></div>
      </div>
    `)
    .join("");

  return `
    <div class="analysis-stat-card">
      <div class="stat-value">${total}</div>
      <div class="stat-label">Total Data Pasien</div>
    </div>
    ${distCards}
  `;
}

function renderTreeNode(node, edgeLabel) {
  const edgeHtml = edgeLabel ? `<div class="tree-edge-label">${edgeLabel}</div>` : "";
  if (node.type === "leaf") {
    return `<li>${edgeHtml}<div class="tree-leaf-box">🍃 ${node.label} <span>(n=${node.count})</span></div></li>`;
  }
  const childrenHtml = Object.entries(node.children)
    .map(([value, child]) => renderTreeNode(child, `${attributeLabel(node.attribute)} = "${valueLabel(node.attribute, value)}"`))
    .join("");
  return `
    <li>
      ${edgeHtml}
      <div class="tree-node-box">🌳 ${attributeLabel(node.attribute)} <span>(Gain Ratio ${node.gainRatio.toFixed(3)})</span></div>
      <ul class="tree-children">${childrenHtml}</ul>
    </li>
  `;
}

function renderAnalysisTree(tree) {
  return `<ul class="tree-children tree-root">${renderTreeNode(tree, null)}</ul>`;
}

function renderGainTable(splitLog) {
  if (!splitLog.length) {
    return "<p>Tidak ada split — data pelatihan terlalu homogen untuk membentuk cabang.</p>";
  }
  return splitLog
    .map(
      (entry) => `
      <div class="gain-node-block">
        <h4>Node: ${entry.path} <span class="gain-node-meta">(n=${entry.sampleCount}, Entropy=${entry.entropy.toFixed(4)})</span></h4>
        <div class="table-scroll">
          <table class="analysis-table">
            <thead><tr><th>Atribut</th><th>Information Gain</th><th>Split Information</th><th>Gain Ratio</th></tr></thead>
            <tbody>
              ${entry.candidates
                .map(
                  (c, i) => `
                <tr class="${i === 0 ? "best-split" : ""}">
                  <td>${attributeLabel(c.attribute)}</td>
                  <td>${c.informationGain.toFixed(4)}</td>
                  <td>${c.splitInformation.toFixed(4)}</td>
                  <td>${c.gainRatio.toFixed(4)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `
    )
    .join("");
}

function renderAnalysisRules(rules) {
  const sorted = [...rules].sort((a, b) => b.count - a.count);
  return sorted.map((rule) => `<li>${ruleToString(rule)}</li>`).join("");
}

function renderAnalysisConclusion(tree) {
  if (tree.type === "leaf") {
    return `<p>Data pelatihan terlalu homogen untuk membentuk percabangan (mayoritas pasien berada pada kategori risiko yang sama). Tambahkan variasi data pada <code>training_dataset</code> untuk mendapatkan pohon yang lebih informatif.</p>`;
  }
  return `<p>Berdasarkan nilai <strong>Gain Ratio</strong>, atribut yang paling berpengaruh terhadap risiko diabetes pada data pelatihan ini adalah <strong>${attributeLabel(tree.attribute)}</strong> (Gain Ratio = ${tree.gainRatio.toFixed(4)}), yang menjadi root node dari pohon keputusan.</p>`;
}

async function runDecisionTreeAnalysis() {
  const btn = document.getElementById("analysis-run-btn");
  const stateEl = document.getElementById("analysis-state");
  const resultsEl = document.getElementById("analysis-results");

  if (btn) btn.disabled = true;
  if (resultsEl) resultsEl.style.display = "none";
  if (stateEl) {
    stateEl.style.display = "";
    stateEl.textContent = "Mengambil training dataset dari Firebase...";
  }

  try {
    const rows = await getTrainingDataset();

    if (rows.length === 0) {
      if (stateEl) stateEl.textContent = 'Training dataset belum tersedia di Firebase (koleksi "training_dataset" kosong). Import data terlebih dahulu.';
      return;
    }

    if (stateEl) stateEl.textContent = `Menghitung Entropy, Information Gain, dan Gain Ratio dari ${rows.length} data...`;

    const attributeKeys = ATTRIBUTES.map((a) => a.key);
    const { tree, splitLog } = buildTree(rows, attributeKeys, { targetKey: TARGET_KEY });
    const rules = treeToRules(tree);

    document.getElementById("analysis-stats").innerHTML = renderAnalysisStats(rows);
    document.getElementById("analysis-tree").innerHTML = renderAnalysisTree(tree);
    document.getElementById("analysis-gain-table").innerHTML = renderGainTable(splitLog);
    document.getElementById("analysis-rules").innerHTML = renderAnalysisRules(rules);
    document.getElementById("analysis-conclusion").innerHTML = renderAnalysisConclusion(tree);

    if (stateEl) stateEl.style.display = "none";
    if (resultsEl) resultsEl.style.display = "block";
    showAppToast("Analisis pohon keputusan berhasil dibuat.");
  } catch (error) {
    if (stateEl) {
      stateEl.style.display = "";
      stateEl.textContent = error.message || "Gagal menjalankan analisis.";
    }
    showAppToast(error.message || "Gagal menjalankan analisis.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.handleAuthLogin = () => handleAuthAction("login");
window.handleAuthRegister = () => handleAuthAction("register");
window.handleAuthLogout = handleLogout;
window.handleResultReady = handleResultReady;
window.renderHistoryPage = renderHistoryPage;
window.exportLatestResultPDF = exportLatestResult;
window.exportHistoryResult = exportHistoryResult;
window.runDecisionTreeAnalysis = runDecisionTreeAnalysis;

watchAuthState((user) => {
  currentUser = user;
  window.currentUser = user;
  updateAuthUI();
  if (document.getElementById("page-history")?.classList.contains("active")) {
    renderHistoryPage();
  }
});
