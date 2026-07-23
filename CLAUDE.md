# CekDiabetes.id — Project Guide

## What this project is

A diabetes type-2 risk assessment web app using the FINDRISC questionnaire. Users answer 8 questions and receive a risk score, personalised recommendations, and can export a PDF report. Hosted on GitHub Pages at `cekdiabetes.id`. No build tooling — pure vanilla HTML/CSS/JS with ES modules.

## File map

| File | Role |
|---|---|
| `index.html` | Entire UI, all CSS, and inline `<script type="module">` entry point. Contains all pages and components. |
| `app.js` | App state (`currentUser`, `historyResults`), auth UI sync, history rendering, PDF export wrappers. Exposes functions on `window.*` for HTML onclick handlers. |
| `auth.js` | Firebase Auth wrappers: `registerUser`, `loginUser`, `logoutUser`, `watchAuthState`. |
| `result-service.js` | Firestore CRUD for results. `saveResult` writes, `getUserResults` reads. `mapCurrentResultFromDOMOrState()` scrapes DOM as fallback. |
| `firebase.js` | Firebase init — exports `auth` (Firebase Auth) and `db` (Firestore). |
| `pdf-service.js` | jsPDF A4 PDF generation. All coordinates in mm. `COLORS` = RGB arrays, `PAGE` = layout constants. |
| `c45.js` | Pure C4.5 decision-tree algorithm (Entropy, Information Gain, Gain Ratio, `buildTree`, `treeToRules`). No DOM/Firebase access. |
| `training-data-service.js` | Firestore read for the C4.5 training set. `getTrainingDataset()` reads the `training_data` collection. |
| `scripts/import-training-data.mjs` | Dev-only Node script (Firebase Admin SDK) that seeds `training_data` from a JSON export of the Excel dataset. Not deployed with the site — see the file header for usage. |

## Architecture patterns

### SPA routing
`showPage(name)` toggles the CSS class `active` on `#page-{name}` elements. Pages: `home`, `test`, `learn`, `history`, `analysis`, `about`.

### Auth state
`watchAuthState(cb)` in `app.js` sets the module-level `currentUser`. `updateAuthUI()` syncs every auth-dependent element (nav chip, mobile email, mobile Masuk button). Always call `updateAuthUI()` after changing auth-related DOM.

### i18n
Elements carry `data-t="key"` attributes. `setLang('id'|'en')` swaps text content from an inline translations object. Lang toggle buttons: `#btn-id` / `#btn-en` (desktop), `#btn-id-m` / `#btn-en-m` (mobile).

### Mobile drawer
Hamburger opens `#mobileDrawer`. Auth chip is hidden on mobile via `.auth-chip { display:none }` in the mobile media query — the drawer's login button `#mobile-masuk-btn` overrides this with `#mobile-masuk-btn { display:block }`. Visibility when logged in is controlled via inline `style.display` in `updateAuthUI()`.

### History page
`renderHistoryPage()` in `app.js`:
- No user → `renderHistoryEmpty(message)` (sets text, clears list)
- User, empty results → `renderHistoryEmpty(message)`
- User, has results → `removeHistoryState()` (removes the `#history-state` element from DOM entirely, not just clears it) then renders `#history-list`

**Do not** clear `#history-state` text and leave it in the DOM when results exist — it creates invisible spacing. Always call `removeHistoryState()`.

### Analisis Decision Tree page (`#page-analysis`)
Read-only, no login required. `runDecisionTreeAnalysis()` in `app.js` (bound to the "Buat / Perbarui Analisis" button, exposed as `window.runDecisionTreeAnalysis`) fetches `training_data` via `getTrainingDataset()`, runs `buildTree()` from `c45.js`, then renders four sections: `#analysis-stats`, `#analysis-tree`, `#analysis-gain-table`, `#analysis-rules`, `#analysis-conclusion`. The tree is recomputed client-side on every click — not persisted — since the dataset is small (~hundreds of rows). Attribute keys/labels are defined once in `c45.js` (`ATTRIBUTES`, `ATTRIBUTE_LABELS`) and must match the `key` values used in `index.html`'s `questions[]` array.

### PDF generation (pdf-service.js)
- Units: mm. Page: 210×297, margin: 14.
- Colors: `COLORS.blue = [26, 86, 168]` (RGB arrays, passed to `setFillColor`/`setTextColor`/`setDrawColor`).
- Use `ensureSpace(doc, y, neededHeight)` before drawing any block to auto-add pages.
- Circle number centering: circle at `(cx, cy, r)`, text at `(cx, cy + 1.5, { align: "center" })`.
- jsPDF loaded from CDN — no npm, no bundler.

## Key DOM element IDs

| ID | Purpose |
|---|---|
| `nav-auth-chip` | Desktop navbar Masuk/Riwayat button |
| `mobile-masuk-btn` | Mobile drawer login button (hidden when logged in) |
| `mobile-auth-email` | Mobile drawer email display |
| `auth-guest-box` / `auth-user-box` | Auth page guest vs. logged-in panel |
| `auth-current-email` | Logged-in email display in auth page |
| `history-state` | History page status message (removed from DOM when results exist) |
| `history-list` | History cards container |
| `score-counter` | FINDRISC score counter element |

## Firebase

- Auth: email/password only.
- Firestore path for results: `users/{uid}/results/{docId}`.
- Result fields: `userId`, `email`, `score`, `maxScore`, `riskLevel`, `riskClass`, `riskMessage`, `probability`, `answers[]`, `recommendations[]`, `createdAt` (serverTimestamp).
- Firestore collection for the C4.5 training set: `training_data/{docId}` (top-level, not per-user; already has ~988 real rows in production). Fields: `age`, `bmi`, `waist`, `activity`, `diet`, `bp_meds`, `glucose_history`, `family_history` hold the **FINDRISC point value** for that answer (the `pts` numbers in `questions[].options` in `index.html` — e.g. age is `0|2|3|4`), not free text, plus `riskLevel` (target label — one of `Rendah`, `Sedikit Meningkat`, `Sedang`, `Tinggi`, `Sangat Tinggi`; note: no "Risiko " prefix, unlike the `riskClass`/`riskLevel` values used in `result-service.js`). `c45.js`'s `VALUE_LABELS`/`valueLabel()` map these point codes back to readable text for display. Seeded via `scripts/import-training-data.mjs` (⚠️ destructive — wipes the collection first); the website only reads it, never writes to it. **Firestore security rules must allow public read (and deny public write) on `training_data`** — set this in the Firebase Console; it isn't managed from this repo.

## Conventions

- No build step for the deployed site. Never introduce a bundler, transpiler, or `package.json` at the repo root unless explicitly asked. The one exception is `scripts/` (own `package.json`, Node/Firebase Admin) — a local dev-only tool never served by GitHub Pages, not part of the SPA.
- All new JS goes into the appropriate existing module file (not inline in HTML).
- New HTML onclick handlers must call functions exposed on `window.*` from `app.js`.
- Text in Indonesian (`id`) by default; add `data-t` keys to any user-visible string that should be bilingual.
- Do not use `display:none` CSS hacks to hide DOM elements that should be fully removed — remove them from the DOM when they serve no purpose.
