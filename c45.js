// C4.5 decision tree: Entropy → Information Gain → Gain Ratio → tree → IF-THEN rules.
// Pure functions, no DOM/Firebase access — used by app.js to render the Analisis Decision Tree page.

// Matches the live `training_data` Firestore collection: attribute values
// are the FINDRISC point codes (questions[].options[].pts in index.html),
// not free-text labels, and the target field is `riskLevel`.
export const TARGET_KEY = "riskLevel";

export const ATTRIBUTES = [
  { key: "age", label: "Usia" },
  { key: "bmi", label: "IMT (BMI)" },
  { key: "waist", label: "Lingkar Pinggang" },
  { key: "activity", label: "Aktivitas Fisik" },
  { key: "diet", label: "Konsumsi Sayur/Buah" },
  { key: "bp_meds", label: "Obat Tekanan Darah Tinggi" },
  { key: "glucose_history", label: "Riwayat Gula Darah Tinggi" },
  { key: "family_history", label: "Riwayat Keluarga Diabetes" }
];

export const ATTRIBUTE_LABELS = Object.fromEntries(ATTRIBUTES.map((a) => [a.key, a.label]));

// Point-code → human-readable text, so rules/tree read naturally instead of
// showing raw FINDRISC point values. Waist uses tier names (not a cm range)
// because male/female thresholds share the same point codes and the
// training rows don't record gender, so a specific cm range can't be
// attributed reliably.
export const VALUE_LABELS = {
  age: { 0: "< 45 tahun", 2: "45–54 tahun", 3: "55–64 tahun", 4: "≥ 65 tahun" },
  bmi: { 0: "< 25 kg/m²", 1: "25–30 kg/m²", 3: "> 30 kg/m²" },
  waist: { 0: "Normal", 3: "Meningkat", 4: "Tinggi" },
  activity: { 0: "Rutin (≥30 menit/hari)", 2: "Tidak rutin" },
  diet: { 0: "Sayur/buah setiap hari", 1: "Tidak setiap hari" },
  bp_meds: { 0: "Tidak", 2: "Ya" },
  glucose_history: { 0: "Tidak", 5: "Ya" },
  family_history: { 0: "Tidak ada", 3: "Kakek/nenek/paman/bibi/sepupu", 5: "Orang tua/saudara/anak" }
};

export function valueLabel(attributeKey, value) {
  return VALUE_LABELS[attributeKey]?.[value] ?? String(value);
}

function log2(x) {
  return Math.log(x) / Math.LN2;
}

function countLabels(rows, targetKey) {
  const counts = {};
  for (const row of rows) {
    const label = row[targetKey];
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

function majorityLabel(rows, targetKey) {
  const counts = countLabels(rows, targetKey);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitByAttribute(rows, attributeKey) {
  const groups = {};
  for (const row of rows) {
    const value = row[attributeKey];
    if (!groups[value]) groups[value] = [];
    groups[value].push(row);
  }
  return groups;
}

export function entropy(rows, targetKey = TARGET_KEY) {
  const total = rows.length;
  if (total === 0) return 0;
  const counts = countLabels(rows, targetKey);
  return Object.values(counts).reduce((sum, count) => {
    const p = count / total;
    return sum - p * log2(p);
  }, 0);
}

export function informationGain(rows, attributeKey, targetKey = TARGET_KEY) {
  const total = rows.length;
  const baseEntropy = entropy(rows, targetKey);
  const groups = splitByAttribute(rows, attributeKey);
  const weightedEntropy = Object.values(groups).reduce(
    (sum, subset) => sum + (subset.length / total) * entropy(subset, targetKey),
    0
  );
  return baseEntropy - weightedEntropy;
}

export function splitInformation(rows, attributeKey) {
  const total = rows.length;
  const groups = splitByAttribute(rows, attributeKey);
  return Object.values(groups).reduce((sum, subset) => {
    const p = subset.length / total;
    return sum - p * log2(p);
  }, 0);
}

export function gainRatio(rows, attributeKey, targetKey = TARGET_KEY) {
  const splitInfo = splitInformation(rows, attributeKey);
  if (splitInfo === 0) return 0;
  return informationGain(rows, attributeKey, targetKey) / splitInfo;
}

export function evaluateAttributes(rows, attributeKeys, targetKey = TARGET_KEY) {
  const nodeEntropy = entropy(rows, targetKey);
  const stats = attributeKeys.map((attribute) => {
    const gain = informationGain(rows, attribute, targetKey);
    const splitInfo = splitInformation(rows, attribute);
    const ratio = splitInfo === 0 ? 0 : gain / splitInfo;
    return { attribute, informationGain: gain, splitInformation: splitInfo, gainRatio: ratio };
  });
  stats.sort((a, b) => b.gainRatio - a.gainRatio);
  return { nodeEntropy, stats };
}

// Tuned for readability at defense time as much as accuracy: with ~988 rows
// and mostly binary/ternary attributes, maxDepth 4 produced 29 leaf rules —
// too many to walk through. depth 3 + higher min-sample thresholds keeps the
// tree to a presentable size while still splitting on the same attributes.
const DEFAULT_OPTIONS = { maxDepth: 3, minSamplesSplit: 30, minSamplesLeaf: 15 };

/**
 * Recursively builds a C4.5 tree using Gain Ratio for split selection.
 * Returns { tree, splitLog } — splitLog records the Entropy/IG/Gain-Ratio
 * table computed at every internal node, for display in the Analisis page.
 */
export function buildTree(rows, attributeKeys, options = {}) {
  const targetKey = options.targetKey || TARGET_KEY;
  const { maxDepth, minSamplesSplit, minSamplesLeaf } = { ...DEFAULT_OPTIONS, ...options };
  const splitLog = [];

  function leafFrom(subsetRows) {
    return {
      type: "leaf",
      label: majorityLabel(subsetRows, targetKey),
      count: subsetRows.length,
      distribution: countLabels(subsetRows, targetKey)
    };
  }

  function build(subsetRows, remainingAttrs, depth, pathLabel) {
    const distribution = countLabels(subsetRows, targetKey);
    const isPure = Object.keys(distribution).length === 1;

    if (isPure || remainingAttrs.length === 0 || subsetRows.length < minSamplesSplit || depth >= maxDepth) {
      return leafFrom(subsetRows);
    }

    const { nodeEntropy, stats } = evaluateAttributes(subsetRows, remainingAttrs, targetKey);
    splitLog.push({ path: pathLabel, sampleCount: subsetRows.length, entropy: nodeEntropy, candidates: stats });

    const best = stats[0];
    if (!best || best.gainRatio <= 0) {
      return leafFrom(subsetRows);
    }

    const groups = splitByAttribute(subsetRows, best.attribute);
    const children = {};
    for (const [value, subset] of Object.entries(groups)) {
      children[value] =
        subset.length < minSamplesLeaf
          ? leafFrom(subset)
          : build(subset, remainingAttrs.filter((a) => a !== best.attribute), depth + 1, `${pathLabel} > ${ATTRIBUTE_LABELS[best.attribute] || best.attribute}="${value}"`);
    }

    return {
      type: "node",
      attribute: best.attribute,
      entropy: nodeEntropy,
      informationGain: best.informationGain,
      gainRatio: best.gainRatio,
      count: subsetRows.length,
      majorityLabel: majorityLabel(subsetRows, targetKey),
      children
    };
  }

  const tree = build(rows, attributeKeys, 0, "Root");
  return { tree, splitLog };
}

/** Flattens a tree into an array of { conditions, label, count } leaf rules. */
export function treeToRules(tree) {
  const rules = [];
  function walk(node, conditions) {
    if (node.type === "leaf") {
      rules.push({ conditions, label: node.label, count: node.count });
      return;
    }
    for (const [value, child] of Object.entries(node.children)) {
      walk(child, [...conditions, { attribute: node.attribute, value }]);
    }
  }
  walk(tree, []);
  return rules;
}

export function ruleToString(rule) {
  const conditions = rule.conditions
    .map((c) => `${ATTRIBUTE_LABELS[c.attribute] || c.attribute} = "${valueLabel(c.attribute, c.value)}"`)
    .join(" AND ");
  const ifPart = conditions || "(semua data)";
  return `IF ${ifPart} THEN Risiko = ${rule.label} (n=${rule.count})`;
}

/**
 * Walks a single FINDRISC result's own answers down the trained tree,
 * recording the attribute/value taken at each split, and returns the leaf
 * classification it lands on. Used to show a per-result "here's how the
 * C4.5 tree classifies this specific answer set" breakdown (screen + PDF).
 *
 * `answers` is the `resultData.answers[]` array saved by the app — each
 * entry's `score` is the FINDRISC point value, which matches the point-code
 * encoding used in the training_data collection, so no relabeling is needed.
 *
 * If the exact combination of values wasn't seen in training data at some
 * node (no matching child branch), tracing stops there and falls back to
 * that node's majority class — flagged via `isFallback: true`.
 */
export function traceDecisionPath(tree, answers) {
  const flatMap = {};
  (Array.isArray(answers) ? answers : []).forEach((a) => {
    flatMap[a.key] = a.score;
  });

  const steps = [];
  let node = tree;

  while (node && node.type === "node") {
    const rawValue = flatMap[node.attribute];
    const child = node.children[rawValue];

    steps.push({
      attribute: node.attribute,
      attributeLabel: ATTRIBUTE_LABELS[node.attribute] || node.attribute,
      value: rawValue,
      valueLabel: valueLabel(node.attribute, rawValue),
      gainRatio: node.gainRatio
    });

    if (!child) {
      return { steps, finalLabel: node.majorityLabel, finalCount: node.count, isFallback: true };
    }
    node = child;
  }

  if (!node) {
    return { steps, finalLabel: "-", finalCount: 0, isFallback: true };
  }

  return { steps, finalLabel: node.label, finalCount: node.count, isFallback: false };
}

/**
 * Aggregates each attribute's contribution across every split in the tree
 * (weighted by how many training rows passed through that split), giving a
 * whole-tree "feature importance" rather than just the root split's Gain
 * Ratio. Returns raw weighted-Gain-Ratio sums per attribute key — normalize
 * to percentages at the call site for display.
 */
export function computeFeatureImportance(splitLog, totalRows) {
  const importance = {};
  for (const entry of splitLog) {
    const winner = entry.candidates[0];
    if (!winner) continue;
    const weight = totalRows > 0 ? entry.sampleCount / totalRows : 0;
    importance[winner.attribute] = (importance[winner.attribute] || 0) + winner.gainRatio * weight;
  }
  return importance;
}
