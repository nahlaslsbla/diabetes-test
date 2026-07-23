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

## Architecture patterns

### SPA routing
`showPage(name)` toggles the CSS class `active` on `#page-{name}` elements. Pages: `home`, `test`, `learn`, `history`, `about`.

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

## Conventions

- No build step. Never introduce a bundler, transpiler, or `package.json` unless explicitly asked.
- All new JS goes into the appropriate existing module file (not inline in HTML).
- New HTML onclick handlers must call functions exposed on `window.*` from `app.js`.
- Text in Indonesian (`id`) by default; add `data-t` keys to any user-visible string that should be bilingual.
- Do not use `display:none` CSS hacks to hide DOM elements that should be fully removed — remove them from the DOM when they serve no purpose.
