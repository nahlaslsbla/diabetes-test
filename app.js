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
  valueLabel,
  traceDecisionPath,
  computeFeatureImportance
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
  renderResultDecisionPathSection(resultData);

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
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn-outline" onclick="window.exportHistoryResult('${item.id}')">Export PDF</button>
            <button class="btn-outline" id="history-dt-btn-${item.id}" onclick="window.toggleHistoryDecisionPath('${item.id}')">🌳 Decision Tree</button>
          </div>
          <div class="history-decision-wrap" id="history-dt-${item.id}" style="display:none;grid-column:1 / -1;margin-top:12px;padding-top:16px;border-top:1px dashed var(--border)"></div>
        </div>
      `).join("");
    }
  } catch (error) {
    renderHistoryEmpty(error.message || "Gagal memuat riwayat hasil.");
  }
}

async function ensureDecisionAnalysisAttached(resultData) {
  if (resultData.decisionAnalysis) return;
  try {
    const { bundle, pathResult } = await computePersonalPathAndBundle(resultData);
    resultData.decisionPath = pathResult;
    resultData.decisionAnalysis = buildDecisionAnalysisData(bundle, pathResult);
  } catch (error) {
    // No training data / no answers — PDF just renders without this section.
    console.error("Gagal melampirkan analisis decision tree ke PDF:", error);
  }
}

async function exportLatestResult() {
  try {
    const resultData = {
      ...mapCurrentResultFromDOMOrState(),
      email: currentUser?.email || window.latestResultData?.email || "",
      createdAt: window.latestResultData?.createdAt || new Date(),
      decisionPath: window.latestResultData?.decisionPath || null,
      decisionAnalysis: window.latestResultData?.decisionAnalysis || null
    };
    await ensureDecisionAnalysisAttached(resultData);
    exportResultToPDF(resultData);
  } catch (error) {
    showAppToast(error.message || "Gagal export PDF.");
  }
}

async function exportHistoryResult(resultId) {
  try {
    const resultData = historyResults[resultId];
    if (!resultData) throw new Error("Data riwayat tidak ditemukan.");
    await ensureDecisionAnalysisAttached(resultData);
    exportResultToPDF(resultData);
  } catch (error) {
    showAppToast(error.message || "Gagal export PDF.");
  }
}

// ────────── DECISION TREE (C4.5): SHARED TREE CACHE + PER-RESULT PATH ──────────

let cachedTreeBundle = null;

// Population-level tree: training_data only. Used by the standalone
// "Analisis Decision Tree" page (public, not personalized).
async function getOrBuildTree(forceRefresh = false) {
  if (cachedTreeBundle && !forceRefresh) return cachedTreeBundle;

  const rows = await getTrainingDataset();
  if (rows.length === 0) {
    cachedTreeBundle = null;
    return null;
  }

  const attributeKeys = ATTRIBUTES.map((a) => a.key);
  const built = buildTree(rows, attributeKeys, { targetKey: TARGET_KEY });
  cachedTreeBundle = { ...built, rows, rowCount: rows.length };
  return cachedTreeBundle;
}

function normalizeRiskLevel(label) {
  return String(label || "").replace(/^Risiko\s+/i, "").trim();
}

function flattenResultToTrainingRow(resultData) {
  const row = {};
  (resultData.answers || []).forEach((a) => { row[a.key] = a.score; });
  row[TARGET_KEY] = normalizeRiskLevel(resultData.riskLevel);
  return row;
}

// Personalized tree: training_data + the logged-in user's own saved history
// (their own past results, normalized to the same riskLevel labels as
// training_data since buildResults() writes "Risiko Tinggi" while
// training_data uses "Tinggi", etc). Cached per uid so switching accounts
// or logging out invalidates it automatically.
let personalTreeCache = null;

async function getOrBuildPersonalTree(forceRefresh = false) {
  const uid = currentUser?.uid || null;
  if (personalTreeCache && personalTreeCache.uid === uid && !forceRefresh) {
    return personalTreeCache.bundle;
  }

  const trainingRows = await getTrainingDataset();
  let userRows = [];
  if (currentUser) {
    try {
      const userResults = await getUserResults(currentUser);
      userRows = userResults
        .filter((r) => Array.isArray(r.answers) && r.answers.length > 0)
        .map(flattenResultToTrainingRow);
    } catch {
      // If history can't be read, fall back to training data alone.
    }
  }

  const combinedRows = [...trainingRows, ...userRows];
  if (combinedRows.length === 0) {
    personalTreeCache = { uid, bundle: null };
    return null;
  }

  const attributeKeys = ATTRIBUTES.map((a) => a.key);
  const built = buildTree(combinedRows, attributeKeys, { targetKey: TARGET_KEY });
  const bundle = {
    ...built,
    rows: combinedRows,
    rowCount: combinedRows.length,
    trainingCount: trainingRows.length,
    userCount: userRows.length
  };
  personalTreeCache = { uid, bundle };
  return bundle;
}

async function computePersonalPathAndBundle(resultData) {
  if (!resultData || !Array.isArray(resultData.answers) || resultData.answers.length === 0) {
    throw new Error("Data jawaban tidak tersedia untuk hasil ini.");
  }
  const bundle = await getOrBuildPersonalTree();
  if (!bundle) {
    throw new Error('Training dataset belum tersedia di Firebase (koleksi "training_data" kosong).');
  }
  const pathResult = traceDecisionPath(bundle.tree, resultData.answers);
  return { bundle, pathResult };
}

function isRuleOnPath(rule, pathSteps) {
  if (!pathSteps || rule.conditions.length !== pathSteps.length) return false;
  return rule.conditions.every(
    (c, i) => c.attribute === pathSteps[i].attribute && String(c.value) === String(pathSteps[i].value)
  );
}

function renderRulesWithHighlight(rules, pathSteps, maxDisplay = 10) {
  const sorted = [...rules].sort((a, b) => b.count - a.count).slice(0, maxDisplay);
  return sorted
    .map((rule) => {
      const isMatch = isRuleOnPath(rule, pathSteps);
      return `<li class="${isMatch ? "rule-current" : ""}">${isMatch ? "📍 " : ""}${ruleToString(rule)}</li>`;
    })
    .join("");
}

function renderImportanceBars(importanceMap) {
  const entries = Object.entries(importanceMap).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0) || 1;

  return entries
    .slice(0, 8)
    .map(([key, val]) => {
      const pct = (val / total) * 100;
      const tier = pct > 30 ? "Sangat Tinggi" : pct > 20 ? "Tinggi" : pct > 10 ? "Sedang" : "Rendah";
      const tierColor = pct > 30 ? "var(--red)" : pct > 20 ? "var(--amber)" : pct > 10 ? "var(--blue)" : "var(--text-muted)";
      return `
        <div class="importance-row">
          <div class="importance-row-head">
            <span class="importance-label">${attributeLabel(key)} <span class="importance-tier" style="color:${tierColor};background:${tierColor}1A">${tier}</span></span>
            <span class="importance-pct">${pct.toFixed(1)}%</span>
          </div>
          <div class="analysis-dist-bar"><div class="analysis-dist-fill" style="width:${pct.toFixed(0)}%;background:${tierColor}"></div></div>
        </div>
      `;
    })
    .join("");
}

function renderDecisionResultBadge(pathResult) {
  const badgeColor = RISK_DIST_COLORS[pathResult.finalLabel] || "var(--blue)";
  const fallbackNote = pathResult.isFallback
    ? `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">*Kombinasi jawaban ini belum persis ada di data pelatihan; klasifikasi diambil dari mayoritas data paling serupa.</p>`
    : "";
  return `
    <div class="dt-path-result" style="background:${badgeColor}22;border:1.5px solid ${badgeColor};color:${badgeColor}">
      🎯 Klasifikasi Decision Tree: <strong>${pathResult.finalLabel}</strong> <span style="font-weight:400">(n=${pathResult.finalCount} data serupa)</span>
    </div>
    ${fallbackNote}
  `;
}

// Mirrors renderTreeNode()'s path-highlighting logic but produces a plain
// object (attribute/value labels already resolved to text) instead of HTML,
// so pdf-service.js can draw the same "jalur Anda ditandai" tree without
// importing c45.js.
function buildPlainTree(node, isOnPath, pathSteps, stepIndex) {
  if (node.type === "leaf") {
    return {
      type: "leaf",
      label: node.label,
      count: node.count,
      isOnPath,
      isCurrentResult: Boolean(isOnPath && pathSteps && stepIndex === pathSteps.length)
    };
  }

  const currentStep = isOnPath && pathSteps ? pathSteps[stepIndex] : null;
  const children = Object.entries(node.children).map(([value, child]) => {
    const childOnPath = Boolean(currentStep) && String(currentStep.value) === String(value);
    return {
      edgeLabel: `${attributeLabel(node.attribute)} = "${valueLabel(node.attribute, value)}"`,
      node: buildPlainTree(child, childOnPath, pathSteps, childOnPath ? stepIndex + 1 : stepIndex)
    };
  });

  return {
    type: "node",
    attributeLabel: attributeLabel(node.attribute),
    gainRatio: node.gainRatio,
    isOnPath,
    children
  };
}

// Plain-object version of the analysis (no HTML), for pdf-service.js to consume
// without needing to import c45.js. Shares the same underlying computations as
// renderFullDecisionSection() (tree, rules, importance, distribution) but
// formatted for the PDF's simpler layout needs.
function buildDecisionAnalysisData(bundle, pathResult) {
  const { splitLog, rows, rowCount, trainingCount, userCount, tree } = bundle;
  const rules = treeToRules(tree);
  const plainTree = buildPlainTree(tree, Boolean(pathResult.steps), pathResult.steps, 0);

  const importanceMap = computeFeatureImportance(splitLog, rowCount);
  const importanceEntries = Object.entries(importanceMap).sort((a, b) => b[1] - a[1]);
  const importanceTotal = importanceEntries.reduce((sum, [, v]) => sum + v, 0) || 1;
  const importance = importanceEntries.slice(0, 8).map(([key, val]) => ({
    key,
    label: attributeLabel(key),
    pct: (val / importanceTotal) * 100
  }));

  const sortedRules = [...rules].sort((a, b) => b.count - a.count).slice(0, 10);
  const rulesFormatted = sortedRules.map((rule) => ({
    text: ruleToString(rule),
    label: rule.label,
    count: rule.count,
    isCurrent: isRuleOnPath(rule, pathResult.steps)
  }));

  const distributionMap = {};
  for (const row of rows) {
    const label = row[TARGET_KEY] || "-";
    distributionMap[label] = (distributionMap[label] || 0) + 1;
  }
  const distribution = Object.entries(distributionMap).map(([label, count]) => ({
    label,
    count,
    pct: rowCount > 0 ? (count / rowCount) * 100 : 0
  }));

  return { rowCount, trainingCount, userCount, path: pathResult, rules: rulesFormatted, importance, distribution, tree: plainTree };
}

function renderFullDecisionSection(bundle, pathResult) {
  const { tree, splitLog, rows, rowCount, trainingCount, userCount } = bundle;
  const rules = treeToRules(tree);
  const importance = computeFeatureImportance(splitLog, rowCount);

  return `
    <div class="dt-intro-card">
      🌳 Mesin telah mempelajari <strong>${rowCount} riwayat data</strong> (${trainingCount} data pelatihan${userCount ? ` + ${userCount} riwayat Anda sendiri` : ""}) untuk membentuk pohon keputusan C4.5 di bawah ini. Jalur yang ditandai biru menunjukkan bagaimana hasil Anda diklasifikasikan.
    </div>

    <h4 class="dt-subheading">🌳 Pohon Keputusan (jalur Anda ditandai)</h4>
    <div class="tree-view">${renderAnalysisTree(tree, pathResult.steps)}</div>

    ${renderDecisionResultBadge(pathResult)}

    <h4 class="dt-subheading">📋 Aturan (Rules) IF–THEN</h4>
    <p class="dt-subtext">Menampilkan ${Math.min(rules.length, 10)} dari ${rules.length} aturan yang terbentuk dari pohon. Aturan yang sesuai hasil Anda ditandai 📍.</p>
    <ol class="rules-list">${renderRulesWithHighlight(rules, pathResult.steps)}</ol>

    <h4 class="dt-subheading">📊 Faktor Paling Berpengaruh (Gain Ratio)</h4>
    <div class="importance-list">${renderImportanceBars(importance)}</div>

    <h4 class="dt-subheading">📈 Distribusi Kategori Risiko</h4>
    <div class="analysis-stats-grid">${renderAnalysisStats(rows)}</div>
  `;
}

async function renderResultDecisionPathSection(resultData) {
  const section = document.getElementById("result-decision-path-section");
  const stateEl = document.getElementById("result-decision-path-state");
  const contentEl = document.getElementById("result-decision-path-content");
  if (!section || !stateEl || !contentEl) return;

  section.style.display = "block";
  stateEl.style.display = "";
  stateEl.textContent = "Melatih pohon keputusan C4.5 dari data pelatihan...";
  contentEl.style.display = "none";

  try {
    const { bundle, pathResult } = await computePersonalPathAndBundle(resultData);
    resultData.decisionPath = pathResult;
    resultData.decisionAnalysis = buildDecisionAnalysisData(bundle, pathResult);
    contentEl.innerHTML = renderFullDecisionSection(bundle, pathResult);
    stateEl.style.display = "none";
    contentEl.style.display = "block";
  } catch (error) {
    stateEl.textContent = error.message || "Gagal memuat klasifikasi decision tree.";
  }
}

async function toggleHistoryDecisionPath(resultId) {
  const wrap = document.getElementById(`history-dt-${resultId}`);
  const btn = document.getElementById(`history-dt-btn-${resultId}`);
  if (!wrap) return;

  if (wrap.style.display !== "none" && wrap.dataset.loaded === "1") {
    wrap.style.display = "none";
    return;
  }

  wrap.style.display = "block";
  if (wrap.dataset.loaded === "1") return;

  wrap.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Melatih pohon keputusan C4.5...</p>';
  if (btn) btn.disabled = true;

  try {
    const resultData = historyResults[resultId];
    const { bundle, pathResult } = await computePersonalPathAndBundle(resultData);
    resultData.decisionPath = pathResult;
    resultData.decisionAnalysis = buildDecisionAnalysisData(bundle, pathResult);
    wrap.innerHTML = renderFullDecisionSection(bundle, pathResult);
    wrap.dataset.loaded = "1";
  } catch (error) {
    wrap.innerHTML = `<p style="color:var(--red)">${error.message || "Gagal memuat klasifikasi decision tree."}</p>`;
  } finally {
    if (btn) btn.disabled = false;
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

function renderTreeNode(node, edgeLabel, isEdgeOnPath, pathSteps, stepIndex) {
  const edgeClass = isEdgeOnPath ? "tree-edge-label tree-edge-active" : "tree-edge-label";
  const edgeHtml = edgeLabel ? `<div class="${edgeClass}">${isEdgeOnPath ? "➡ " : ""}${edgeLabel}</div>` : "";

  if (node.type === "leaf") {
    const isCurrentResult = isEdgeOnPath && pathSteps && stepIndex === pathSteps.length;
    const boxClass = isCurrentResult ? "tree-leaf-box tree-leaf-current" : "tree-leaf-box";
    const tag = isCurrentResult ? ' <span class="tree-current-tag">Hasil Anda</span>' : "";
    return `<li>${edgeHtml}<div class="${boxClass}">${isCurrentResult ? "📍" : "🍃"} ${node.label} <span>(n=${node.count})</span>${tag}</div></li>`;
  }

  const nodeClass = isEdgeOnPath ? "tree-node-box tree-node-active" : "tree-node-box";
  const currentStep = isEdgeOnPath && pathSteps ? pathSteps[stepIndex] : null;

  const childrenHtml = Object.entries(node.children)
    .map(([value, child]) => {
      const childOnPath = Boolean(currentStep) && String(currentStep.value) === String(value);
      return renderTreeNode(
        child,
        `${attributeLabel(node.attribute)} = "${valueLabel(node.attribute, value)}"`,
        childOnPath,
        pathSteps,
        childOnPath ? stepIndex + 1 : stepIndex
      );
    })
    .join("");

  return `
    <li>
      ${edgeHtml}
      <div class="${nodeClass}">🌳 ${attributeLabel(node.attribute)} <span>(Gain Ratio ${node.gainRatio.toFixed(3)})</span></div>
      <ul class="tree-children">${childrenHtml}</ul>
    </li>
  `;
}

function renderAnalysisTree(tree, pathSteps = null) {
  return `<ul class="tree-children tree-root">${renderTreeNode(tree, null, Boolean(pathSteps), pathSteps, 0)}</ul>`;
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
    const bundle = await getOrBuildTree(true);

    if (!bundle) {
      if (stateEl) stateEl.textContent = 'Training dataset belum tersedia di Firebase (koleksi "training_data" kosong). Import data terlebih dahulu.';
      return;
    }

    const { tree, splitLog, rows, rowCount } = bundle;
    if (stateEl) stateEl.textContent = `Menghitung Entropy, Information Gain, dan Gain Ratio dari ${rowCount} data...`;

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
window.toggleHistoryDecisionPath = toggleHistoryDecisionPath;

watchAuthState((user) => {
  currentUser = user;
  window.currentUser = user;
  updateAuthUI();
  if (document.getElementById("page-history")?.classList.contains("active")) {
    renderHistoryPage();
  }
});
