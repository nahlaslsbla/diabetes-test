const PAGE = {
  width: 210,
  height: 297,
  margin: 14,
  bottom: 274
};

const COLORS = {
  blue: [26, 86, 168],
  blueDark: [15, 61, 122],
  teal: [14, 124, 91],
  yellow: [212, 160, 23],
  amber: [196, 90, 26],
  red: [178, 32, 32],
  redDark: [127, 0, 0],
  text: [17, 24, 39],
  muted: [107, 114, 128],
  border: [209, 213, 219],
  bg: [247, 249, 252],
  white: [255, 255, 255]
};

function getCreatedAtDate(resultData) {
  const createdAt = resultData?.createdAt;
  if (createdAt?.toDate) return createdAt.toDate();
  if (createdAt instanceof Date) return createdAt;
  if (typeof createdAt === "string" || typeof createdAt === "number") {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function formatDate(date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatFileDate(date) {
  return date.toISOString().slice(0, 10);
}

function sanitizeText(value) {
  return String(value || "-")
    .replace(/\u2265/g, ">=")
    .replace(/\u2264/g, "<=")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00B2/g, "2")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function setTextColor(doc, color = COLORS.text) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFillColor(doc, color) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDrawColor(doc, color = COLORS.border) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function writeLines(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(sanitizeText(text), maxWidth);
  lines.forEach((line, index) => {
    doc.text(line, x, y + (index * lineHeight));
  });
  return y + (lines.length * lineHeight);
}

function riskColor(resultData) {
  const riskClass = resultData?.riskClass || "";
  if (riskClass.includes("very-high")) return COLORS.redDark;
  if (riskClass.includes("high")) return COLORS.red;
  if (riskClass.includes("moderate")) return COLORS.amber;
  if (riskClass.includes("slight")) return COLORS.yellow;
  return COLORS.teal;
}

function ensureSpace(doc, y, neededHeight) {
  if (y + neededHeight <= PAGE.bottom) return y;
  doc.addPage();
  drawPageHeader(doc, true);
  return 48;
}

function drawPageHeader(doc, compact = false) {
  setFillColor(doc, COLORS.blueDark);
  doc.rect(0, 0, PAGE.width, compact ? 20 : 38, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compact ? 11 : 17);
  setTextColor(doc, COLORS.white);
  doc.text("CekDiabetes.id", PAGE.margin, compact ? 13 : 17);

  if (!compact) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Laporan Hasil Tes Risiko Diabetes FINDRISC", PAGE.margin, 27);
    doc.text("Screening informatif, bukan diagnosis medis.", PAGE.margin, 33);
  }
}

function drawSectionTitle(doc, title, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setTextColor(doc, COLORS.blueDark);
  doc.text(sanitizeText(title), PAGE.margin, y);
  setDrawColor(doc, COLORS.border);
  doc.line(PAGE.margin, y + 3, PAGE.width - PAGE.margin, y + 3);
  return y + 10;
}

function drawInfoPill(doc, label, value, x, y, width) {
  setFillColor(doc, COLORS.bg);
  setDrawColor(doc, COLORS.border);
  doc.roundedRect(x, y, width, 18, 3, 3, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  setTextColor(doc, COLORS.muted);
  doc.text(sanitizeText(label).toUpperCase(), x + 4, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  setTextColor(doc, COLORS.text);
  writeLines(doc, value, x + 4, y + 12, width - 8, 4);
}

function drawSummaryCard(doc, resultData, date, y) {
  const color = riskColor(resultData);
  setFillColor(doc, COLORS.white);
  setDrawColor(doc, COLORS.border);
  doc.roundedRect(PAGE.margin, y, PAGE.width - (PAGE.margin * 2), 54, 4, 4, "FD");

  setFillColor(doc, color);
  doc.roundedRect(PAGE.margin + 6, y + 8, 36, 30, 4, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  setTextColor(doc, COLORS.white);
  doc.text(`${resultData.score ?? 0}`, PAGE.margin + 14, y + 21);
  doc.setFontSize(8.5);
  doc.text(`/ ${resultData.maxScore ?? 26}`, PAGE.margin + 23, y + 21);
  doc.setFontSize(7.5);
  doc.text("SKOR", PAGE.margin + 15, y + 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setTextColor(doc, color);
  doc.text(sanitizeText(resultData.riskLevel || "-"), PAGE.margin + 50, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setTextColor(doc, COLORS.text);
  writeLines(doc, resultData.riskMessage || "-", PAGE.margin + 50, y + 22, 128, 4.5);

  drawInfoPill(doc, "Tanggal tes", formatDate(date), PAGE.margin + 50, y + 32, 76);
  drawInfoPill(doc, "Estimasi 10 tahun", resultData.probability || "-", PAGE.margin + 132, y + 32, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setTextColor(doc, COLORS.muted);
  writeLines(doc, `Email: ${resultData.email || "-"}`, PAGE.margin + 6, y + 47, 38, 3.8);

  return y + 64;
}

function drawRiskMeter(doc, resultData, y) {
  const score = Number(resultData.score || 0);
  const maxScore = Number(resultData.maxScore || 26);
  const x = PAGE.margin;
  const width = PAGE.width - (PAGE.margin * 2);
  const barY = y + 12;
  const segments = [
    { label: "0-7 Rendah", end: 7, color: COLORS.teal },
    { label: "8-11 Meningkat", end: 11, color: COLORS.yellow },
    { label: "12-14 Sedang", end: 14, color: COLORS.amber },
    { label: "15-20 Tinggi", end: 20, color: COLORS.red },
    { label: "21-26 Sangat tinggi", end: 26, color: COLORS.redDark }
  ];
  let start = 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextColor(doc, COLORS.text);
  doc.text("Interpretasi skor", x, y);

  segments.forEach((segment) => {
    const segmentWidth = ((segment.end - start) / maxScore) * width;
    setFillColor(doc, segment.color);
    doc.rect(x + ((start / maxScore) * width), barY, segmentWidth, 5, "F");
    start = segment.end;
  });

  const pointerX = x + Math.min(Math.max(score / maxScore, 0), 1) * width;
  setFillColor(doc, COLORS.text);
  doc.triangle(pointerX, barY - 3, pointerX - 2.5, barY - 7, pointerX + 2.5, barY - 7, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextColor(doc, COLORS.muted);
  let labelX = x;
  segments.forEach((segment) => {
    doc.text(segment.label, labelX, barY + 13);
    labelX += width / segments.length;
  });

  return y + 30;
}

const DT_RISK_COLORS = {
  "Rendah": COLORS.teal,
  "Sedikit Meningkat": COLORS.yellow,
  "Sedang": COLORS.amber,
  "Tinggi": COLORS.red,
  "Sangat Tinggi": COLORS.redDark
};

function drawDecisionPathSteps(doc, path, y) {
  (path.steps || []).forEach((step, index) => {
    y = ensureSpace(doc, y, 10);
    setFillColor(doc, COLORS.blue);
    doc.circle(PAGE.margin + 4, y - 1.5, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setTextColor(doc, COLORS.white);
    doc.text(String(index + 1), PAGE.margin + 4, y - 0.2, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setTextColor(doc, COLORS.text);
    doc.text(sanitizeText(`${step.attributeLabel} = "${step.valueLabel}"`), PAGE.margin + 12, y);

    y += 9;
  });

  const color = DT_RISK_COLORS[path.finalLabel] || COLORS.blue;
  y = ensureSpace(doc, y, 16);
  setFillColor(doc, color);
  doc.roundedRect(PAGE.margin, y - 5, PAGE.width - (PAGE.margin * 2), 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  setTextColor(doc, COLORS.white);
  doc.text(sanitizeText(`Klasifikasi: ${path.finalLabel} (n=${path.finalCount} data serupa)`), PAGE.margin + 6, y + 3.5);
  y += 14;

  if (path.isFallback) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    setTextColor(doc, COLORS.muted);
    y = writeLines(
      doc,
      "*Kombinasi jawaban ini belum persis ada di data pelatihan; klasifikasi diambil dari mayoritas data paling serupa.",
      PAGE.margin,
      y + 4,
      PAGE.width - (PAGE.margin * 2),
      4
    ) + 4;
  }

  return y;
}

function drawTreeNodePdf(doc, node, edgeLabel, depth, y) {
  const indent = PAGE.margin + (depth * 5);
  const maxWidth = PAGE.width - PAGE.margin - indent;

  if (edgeLabel) {
    const prefix = node.isOnPath ? "-> " : "";
    const lines = doc.splitTextToSize(sanitizeText(`${prefix}${edgeLabel}`), maxWidth);
    y = ensureSpace(doc, y, (lines.length * 4.3) + 1);
    doc.setFont("helvetica", node.isOnPath ? "bold" : "normal");
    doc.setFontSize(7.6);
    setTextColor(doc, node.isOnPath ? COLORS.blue : COLORS.muted);
    lines.forEach((line, index) => doc.text(line, indent, y + (index * 4.3)));
    y += (lines.length * 4.3) + 1;
  }

  if (node.type === "leaf") {
    const prefix = node.isCurrentResult ? "* " : "- ";
    const suffix = node.isCurrentResult ? " (Hasil Anda)" : "";
    const lines = doc.splitTextToSize(sanitizeText(`${prefix}${node.label} (n=${node.count})${suffix}`), maxWidth);
    y = ensureSpace(doc, y, (lines.length * 4.3) + 3);
    doc.setFont("helvetica", node.isCurrentResult ? "bold" : "normal");
    doc.setFontSize(7.6);
    setTextColor(doc, node.isCurrentResult ? COLORS.blue : COLORS.text);
    lines.forEach((line, index) => doc.text(line, indent, y + (index * 4.3)));
    return y + (lines.length * 4.3) + 3;
  }

  const lines = doc.splitTextToSize(sanitizeText(`${node.attributeLabel} (Gain Ratio ${node.gainRatio.toFixed(3)})`), maxWidth);
  y = ensureSpace(doc, y, (lines.length * 4.3) + 1);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  setTextColor(doc, node.isOnPath ? COLORS.blue : COLORS.text);
  lines.forEach((line, index) => doc.text(line, indent, y + (index * 4.3)));
  y += (lines.length * 4.3) + 1.5;

  node.children.forEach((edge) => {
    y = drawTreeNodePdf(doc, edge.node, edge.edgeLabel, depth + 1, y);
  });

  return y;
}

function drawDecisionTreeDiagram(doc, tree, y) {
  if (!tree) return y;

  y = ensureSpace(doc, y, 20);
  y = drawSectionTitle(doc, "Pohon keputusan (jalur Anda ditandai)", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  setTextColor(doc, COLORS.muted);
  y = writeLines(
    doc,
    "Jalur berwarna biru menunjukkan bagaimana hasil ini ditelusuri melalui pohon keputusan C4.5.",
    PAGE.margin,
    y,
    PAGE.width - (PAGE.margin * 2),
    4
  ) + 5;

  y = drawTreeNodePdf(doc, tree, null, 0, y);

  return y + 4;
}

function drawImportanceBars(doc, importance, y) {
  if (!importance?.length) return y;

  y = ensureSpace(doc, y, 20);
  y = drawSectionTitle(doc, "Faktor paling berpengaruh (Gain Ratio)", y);

  const maxPct = importance[0]?.pct || 1;
  const barStartX = PAGE.margin + 62;
  const barMaxWidth = PAGE.width - PAGE.margin - barStartX - 16;

  importance.forEach((item) => {
    y = ensureSpace(doc, y, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setTextColor(doc, COLORS.text);
    doc.text(sanitizeText(item.label), PAGE.margin, y + 1);

    const barWidth = Math.max(2, (item.pct / maxPct) * barMaxWidth);
    setFillColor(doc, COLORS.bg);
    doc.rect(barStartX, y - 2.3, barMaxWidth, 3.5, "F");
    setFillColor(doc, COLORS.blue);
    doc.rect(barStartX, y - 2.3, barWidth, 3.5, "F");

    doc.setFont("helvetica", "bold");
    setTextColor(doc, COLORS.blueDark);
    doc.text(`${item.pct.toFixed(1)}%`, PAGE.width - PAGE.margin, y + 1, { align: "right" });

    y += 9;
  });

  return y + 4;
}

function drawDistributionBars(doc, distribution, y) {
  if (!distribution?.length) return y;

  y = ensureSpace(doc, y, 20);
  y = drawSectionTitle(doc, "Distribusi kategori risiko (data pelatihan)", y);

  const barStartX = PAGE.margin + 42;
  const barMaxWidth = PAGE.width - PAGE.margin - barStartX - 30;

  distribution.forEach((item) => {
    y = ensureSpace(doc, y, 9);
    const color = DT_RISK_COLORS[item.label] || COLORS.blue;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setTextColor(doc, COLORS.text);
    doc.text(sanitizeText(item.label), PAGE.margin, y + 1);

    setFillColor(doc, COLORS.bg);
    doc.rect(barStartX, y - 2.3, barMaxWidth, 3.5, "F");
    setFillColor(doc, color);
    doc.rect(barStartX, y - 2.3, (item.pct / 100) * barMaxWidth, 3.5, "F");

    doc.setFont("helvetica", "bold");
    setTextColor(doc, COLORS.text);
    doc.text(`${item.pct.toFixed(0)}% (${item.count})`, PAGE.width - PAGE.margin, y + 1, { align: "right" });

    y += 9;
  });

  return y + 4;
}

function drawRulesList(doc, rules, y) {
  if (!rules?.length) return y;

  y = ensureSpace(doc, y, 20);
  y = drawSectionTitle(doc, "Aturan (rules) IF-THEN", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  setTextColor(doc, COLORS.muted);
  y = writeLines(
    doc,
    `Menampilkan ${rules.length} aturan utama dari pohon. Aturan yang sesuai hasil ini ditandai warna biru.`,
    PAGE.margin,
    y,
    PAGE.width - (PAGE.margin * 2),
    4
  ) + 5;

  rules.forEach((rule, index) => {
    const lines = doc.splitTextToSize(sanitizeText(rule.text), PAGE.width - (PAGE.margin * 2) - 10);
    const blockHeight = 3 + lines.length * 4;
    y = ensureSpace(doc, y, blockHeight + 4);

    if (rule.isCurrent) {
      setFillColor(doc, COLORS.blue);
      doc.roundedRect(PAGE.margin, y - 3.5, PAGE.width - (PAGE.margin * 2), blockHeight, 2, 2, "F");
      setTextColor(doc, COLORS.white);
    } else {
      if (index % 2 === 0) {
        setFillColor(doc, COLORS.bg);
        doc.rect(PAGE.margin, y - 3.5, PAGE.width - (PAGE.margin * 2), blockHeight, "F");
      }
      setTextColor(doc, COLORS.text);
    }

    doc.setFont("helvetica", rule.isCurrent ? "bold" : "normal");
    doc.setFontSize(7.8);
    lines.forEach((line, lineIndex) => {
      doc.text(line, PAGE.margin + 4, y + (lineIndex * 4));
    });

    y += blockHeight;
  });

  return y + 4;
}

function drawDecisionAnalysis(doc, resultData, y) {
  const analysis = resultData?.decisionAnalysis;
  const path = analysis?.path || resultData?.decisionPath;
  if (!path) return y;

  y = ensureSpace(doc, y, 30);
  y = drawSectionTitle(doc, "Klasifikasi decision tree (C4.5)", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, COLORS.muted);
  const introText = analysis
    ? `Pohon dilatih dari ${analysis.rowCount} data (${analysis.trainingCount} data pelatihan${analysis.userCount ? ` + ${analysis.userCount} riwayat Anda sendiri` : ""}). Jalur berikut menunjukkan bagaimana hasil ini diklasifikasikan, sebagai pembanding independen terhadap skor FINDRISC di atas.`
    : "Jalur berikut menunjukkan bagaimana algoritma C4.5 mengklasifikasikan hasil ini.";
  y = writeLines(doc, introText, PAGE.margin, y, PAGE.width - (PAGE.margin * 2), 4.5) + 6;

  y = drawDecisionTreeDiagram(doc, analysis?.tree, y);
  y = drawDecisionPathSteps(doc, path, y);

  if (!analysis) return y + 4;

  y = drawImportanceBars(doc, analysis.importance, y);
  y = drawDistributionBars(doc, analysis.distribution, y);
  y = drawRulesList(doc, analysis.rules, y);

  return y + 4;
}

function drawRecommendations(doc, recommendations, y) {
  y = drawSectionTitle(doc, "Rekomendasi personal", y);

  if (recommendations.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setTextColor(doc, COLORS.muted);
    doc.text("-", PAGE.margin, y);
    return y + 8;
  }

  recommendations.forEach((item, index) => {
    const title = sanitizeText(item.title || item.t || item.e || "Rekomendasi");
    const description = sanitizeText(item.description || item.d || item.de || "");
    const lines = doc.splitTextToSize(description, 158);
    const cardHeight = Math.max(24, 14 + (lines.length * 4.6));
    y = ensureSpace(doc, y, cardHeight + 6);

    setFillColor(doc, COLORS.white);
    setDrawColor(doc, COLORS.border);
    doc.roundedRect(PAGE.margin, y, PAGE.width - (PAGE.margin * 2), cardHeight, 4, 4, "FD");

    setFillColor(doc, COLORS.blue);
    doc.circle(PAGE.margin + 8, y + 10, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextColor(doc, COLORS.white);
    doc.text(String(index + 1), PAGE.margin + 8, y + 11.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setTextColor(doc, COLORS.text);
    doc.text(title, PAGE.margin + 18, y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    setTextColor(doc, COLORS.muted);
    lines.forEach((line, lineIndex) => {
      doc.text(line, PAGE.margin + 18, y + 16 + (lineIndex * 4.6));
    });

    y += cardHeight + 6;
  });

  return y;
}

function drawAnswers(doc, answers, y) {
  if (!Array.isArray(answers) || answers.length === 0) return y;

  y = ensureSpace(doc, y, 34);
  y = drawSectionTitle(doc, "Ringkasan jawaban", y);

  answers.forEach((answer, index) => {
    y = ensureSpace(doc, y, 16);
    const question = sanitizeText(answer.question || answer.key || `Pertanyaan ${index + 1}`);
    const selected = sanitizeText(answer.answer || "-");
    const score = answer.score ?? 0;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setTextColor(doc, COLORS.text);
    doc.text(`${index + 1}.`, PAGE.margin, y);
    writeLines(doc, question, PAGE.margin + 7, y, 120, 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    setTextColor(doc, COLORS.muted);
    writeLines(doc, selected, PAGE.margin + 7, y + 5, 138, 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setTextColor(doc, COLORS.blueDark);
    doc.text(`${score} poin`, PAGE.width - PAGE.margin - 18, y);

    y += 14;
  });

  return y + 4;
}

function drawFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setDrawColor(doc, COLORS.border);
    doc.line(PAGE.margin, 282, PAGE.width - PAGE.margin, 282);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    setTextColor(doc, COLORS.muted);
    doc.text("Hasil ini bersifat informatif dan bukan diagnosis medis.", PAGE.margin, 287);
    doc.text(`Halaman ${page}/${pageCount}`, PAGE.width - PAGE.margin - 22, 287);
  }
}

export function exportResultToPDF(resultData) {
  if (!window.jspdf?.jsPDF) {
    throw new Error("Library jsPDF belum siap.");
  }
  if (!resultData) {
    throw new Error("Data hasil tes tidak tersedia.");
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const date = getCreatedAtDate(resultData);
  const recommendations = Array.isArray(resultData.recommendations)
    ? resultData.recommendations
    : [];

  doc.setProperties({
    title: "CekDiabetes.id - Hasil Tes Risiko Diabetes",
    subject: "Laporan hasil tes FINDRISC",
    author: "CekDiabetes.id"
  });

  drawPageHeader(doc);
  let y = 50;

  y = drawSummaryCard(doc, resultData, date, y);
  y = drawRiskMeter(doc, resultData, y);
  y = drawDecisionAnalysis(doc, resultData, y);

  y = ensureSpace(doc, y, 34);
  y = drawSectionTitle(doc, "Catatan hasil", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setTextColor(doc, COLORS.text);
  y = writeLines(
    doc,
    "Gunakan laporan ini sebagai bahan diskusi awal dengan tenaga kesehatan, terutama jika skor Anda berada pada kategori sedang, tinggi, atau sangat tinggi.",
    PAGE.margin,
    y,
    PAGE.width - (PAGE.margin * 2),
    5
  ) + 8;

  y = drawRecommendations(doc, recommendations, y);
  y = drawAnswers(doc, resultData.answers, y);

  drawFooter(doc);
  doc.save(`cekdiabetes-result-${formatFileDate(date)}.pdf`);
}
