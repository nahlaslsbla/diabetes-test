#!/usr/bin/env node
// Dev-only one-off script: imports a training dataset (converted from Excel)
// into Firestore's `training_data` collection, which the "Analisis Decision
// Tree" page on the website reads to build the C4.5 tree.
//
// This script is NOT part of the deployed website (not referenced by
// index.html/app.js) and is never served by GitHub Pages — it's a local
// tool the developer runs once (or whenever the dataset changes).
//
// ⚠️  DESTRUCTIVE: this script DELETES every existing document in
// `training_data` before writing the new dataset, so re-running it replaces
// the whole collection. As of writing, `training_data` already holds real
// data (~988 rows) that the live Analisis page reads from — don't run this
// against production unless you mean to replace that dataset entirely.
//
// Usage:
//   1. Convert your Excel sheet to a JSON array of objects — one object per
//      patient — matching the shape in sample-training-data.json. Keys must
//      be exactly: age, bmi, waist, activity, diet, bp_meds,
//      glucose_history, family_history, riskLevel.
//        - The 8 attribute fields hold the FINDRISC *point value* for that
//          answer (the `pts` numbers in questions[].options inside
//          index.html), not the option text — e.g. age uses 0 | 2 | 3 | 4,
//          bmi uses 0 | 1 | 3. This matches how the live training_data
//          collection is already encoded.
//        - riskLevel is one of: "Rendah", "Sedikit Meningkat", "Sedang",
//          "Tinggi", "Sangat Tinggi".
//   2. Firebase Console → Project settings → Service accounts →
//      Generate new private key. Save the file as
//      scripts/service-account.json (gitignored — never commit it).
//   3. cd scripts && npm install
//   4. node import-training-data.mjs ./dataset.json

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTION_NAME = "training_data";
const REQUIRED_KEYS = [
  "age",
  "bmi",
  "waist",
  "activity",
  "diet",
  "bp_meds",
  "glucose_history",
  "family_history",
  "riskLevel"
];

function* chunk(items, size) {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

function loadDataset(path) {
  const rows = JSON.parse(readFileSync(resolve(path), "utf-8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Dataset JSON harus berupa array berisi minimal 1 objek pasien.");
  }
  rows.forEach((row, index) => {
    const missing = REQUIRED_KEYS.filter((key) => row[key] === undefined || row[key] === "");
    if (missing.length) {
      throw new Error(`Baris ke-${index + 1} tidak lengkap, field kosong: ${missing.join(", ")}`);
    }
  });
  return rows;
}

async function run() {
  const datasetPath = process.argv[2];
  if (!datasetPath) {
    console.error("Usage: node import-training-data.mjs <path-to-dataset.json>");
    process.exit(1);
  }

  const serviceAccountPath = join(__dirname, "service-account.json");
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
  } catch {
    console.error(`Tidak dapat membaca ${serviceAccountPath}.\nUnduh service account key dari Firebase Console (Project settings > Service accounts) dan simpan sebagai scripts/service-account.json.`);
    process.exit(1);
  }

  const rows = loadDataset(datasetPath);

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const collectionRef = db.collection(COLLECTION_NAME);

  const existingDocs = await collectionRef.listDocuments();
  if (existingDocs.length) {
    console.log(`Menghapus ${existingDocs.length} dokumen lama di "${COLLECTION_NAME}"...`);
    for (const batchDocs of chunk(existingDocs, 400)) {
      const batch = db.batch();
      batchDocs.forEach((doc) => batch.delete(doc));
      await batch.commit();
    }
  }

  console.log(`Mengimpor ${rows.length} baris data ke "${COLLECTION_NAME}"...`);
  for (const batchRows of chunk(rows, 400)) {
    const batch = db.batch();
    for (const row of batchRows) {
      batch.set(collectionRef.doc(), row);
    }
    await batch.commit();
  }

  console.log("Selesai. Training dataset berhasil diimpor ke Firestore.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
