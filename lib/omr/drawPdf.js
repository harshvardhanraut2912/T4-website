// OMR PDF renderer. Geometry comes only from ./layout.js so the PDF and future scanner
// consume exactly the same coordinates.

import { PAGE, MARKER, markerList, pageCodeSquares, sheetCode, ROLL_DIGITS } from "./layout";

const BLACK = 0;
const PT = 0.3528;
const LOGO_MAX_W = 30.0; // mm, matches the question-paper PDF logo footprint (~1.18 in)
const LOGO_MAX_H = 15.5; // mm, matches the question-paper PDF logo footprint (~0.61 in)
const WATERMARK_MM = 123.0; // 7000 twips ~= 123.4 mm in the existing PDF generator

function setInk(doc) {
  doc.setDrawColor(BLACK);
  doc.setFillColor(BLACK);
  doc.setTextColor(BLACK);
}

function fit(doc, text, maxW) {
  let t = String(text || "");
  if (doc.getTextWidth(t) <= maxW) return t;
  while (t.length > 1 && doc.getTextWidth(t + "...") > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "...";
}

function drawFilledSquare(doc, cx, cy, size) {
  doc.rect(cx - size / 2, cy - size / 2, size, size, "F");
}

function drawRegistrationFrame(doc, pageNo, layout) {
  setInk(doc);

  // Four primary fiducials. TL is deliberately larger: it is the orientation anchor.
  markerList().forEach((m) => drawFilledSquare(doc, m.cx, m.cy, m.size));

  // Timing boxes are restricted to the lower answer-bubble region.
  layout.trackers.forEach((t) => drawFilledSquare(doc, t.cx, t.cy, t.size));

  // Dedicated roll-number registration frame: four isolated boxes around the roll box.
  layout.rollTrackers.forEach((t) => drawFilledSquare(doc, t.cx, t.cy, t.size));

  // Page identity: 4 binary squares, MSB first.
  doc.setLineWidth(0.25);
  pageCodeSquares(pageNo).forEach((b) => {
    if (b.bit) doc.rect(b.x, b.y, b.size, b.size, "F");
    else doc.rect(b.x, b.y, b.size, b.size, "S");
  });
}

function bubble(doc, st, cx, cy, text) {
  doc.setLineWidth(st.line);
  doc.circle(cx, cy, st.r, "S");
  if (text !== "" && text !== null && text !== undefined) {
    const pt = Math.max(5.5, st.r * 2.55);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(pt);
    doc.text(String(text), cx, cy + 0.34 * st.r, { align: "center" });
  }
}

function drawInstructions(doc, layout, box) {
  const st = layout.style;
  setInk(doc);
  doc.setLineWidth(0.3);
  doc.rect(box.x, box.y, box.w, box.h, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("INSTRUCTIONS", box.x + 3, box.y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  const lines = [
    "1. Use a black or blue ball pen only.",
    "2. Darken one circle completely.",
    "3. Do not tick, cross or partially shade circles.",
    "4. Do not write over the black tracking squares.",
  ];
  let y = box.y + 10;
  lines.forEach((l) => {
    const wrapped = doc.splitTextToSize(l, box.w - 6);
    doc.text(wrapped, box.x + 3, y);
    y += wrapped.length * 3.25 + 0.6;
  });

  const ey = box.y + box.h - 6.1;
  const r = Math.min(st.r, 2.5);
  const ex = box.x + 4 + r;
  const gap = r * 2 + 8;
  doc.setLineWidth(0.3);
  doc.circle(ex, ey, r, "FD");
  doc.circle(ex + gap, ey, r, "S");
  doc.line(ex + gap - r * 0.6, ey, ex + gap - r * 0.15, ey + r * 0.55);
  doc.line(ex + gap - r * 0.15, ey + r * 0.55, ex + gap + r * 0.7, ey - r * 0.6);
  doc.circle(ex + gap * 2, ey, r, "S");
  doc.line(ex + gap * 2 - r * 0.6, ey - r * 0.6, ex + gap * 2 + r * 0.6, ey + r * 0.6);
  doc.line(ex + gap * 2 - r * 0.6, ey + r * 0.6, ex + gap * 2 + r * 0.6, ey - r * 0.6);
  doc.circle(ex + gap * 3, ey, r, "S");
  doc.circle(ex + gap * 3, ey, r * 0.28, "F");
  doc.setFontSize(6.0);
  doc.setFont("helvetica", "bold");
  doc.text("CORRECT", ex, ey - r - 1.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("WRONG", ex + gap * 2, ey - r - 1.2, { align: "center" });
}

function drawRoll(doc, layout) {
  const st = layout.style;
  const roll = layout.roll;
  setInk(doc);
  doc.setLineWidth(0.3);
  doc.rect(roll.box.x, roll.box.y, roll.box.w, roll.box.h, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("ROLL NUMBER (3 digits)", roll.box.x + 3, roll.box.y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.text("Write each digit in its box, then shade the matching circle.", roll.box.x + 3, roll.box.y + 9);

  roll.writeBoxes.forEach((b) => doc.rect(b.x, b.y, b.w, b.h, "S"));
  roll.bubbles.forEach((b) => bubble(doc, st, b.cx, b.cy, b.value));
  void ROLL_DIGITS;
}

function drawOptionHeaders(doc, layout, page) {
  setInk(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.1);
  page.columns.forEach((c) => {
    c.optX.forEach((x, i) => doc.text(layout.letterList[i], x, c.y + 3.2, { align: "center" }));
  });
}

function drawQuestions(doc, layout, page) {
  const st = layout.style;
  setInk(doc);

  // Scanner-first default: letters sit above the bubbles, leaving the fill ROI clean.
  if (layout.letters === "header") drawOptionHeaders(doc, layout, page);

  page.questions.forEach((qq) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(6.5, Math.min(8.5, st.r * 3)));
    doc.text(String(qq.q), qq.numX, qq.cy + 1, { align: "right" });
    qq.bubbles.forEach((b) => bubble(doc, st, b.cx, b.cy, layout.letters === "inside" ? b.option : ""));
  });
}

function imageSize(doc, dataUrl, maxW, maxH) {
  try {
    const props = doc.getImageProperties(dataUrl);
    const w = Number(props?.width) || 1;
    const h = Number(props?.height) || 1;
    const k = Math.min(maxW / w, maxH / h);
    return { w: w * k, h: h * k };
  } catch {
    return { w: maxW, h: maxH };
  }
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load logo"));
    img.src = dataUrl;
  });
}

// This intentionally mirrors lib/pdfgen/logo.js:
// 1000px transparent canvas, logo fitted inside 780px, opacity .13 and Gaussian blur 5px.
async function bakeWatermark(dataUrl) {
  if (!dataUrl) return null;
  try {
    const img = await loadImage(dataUrl);
    const size = 1000;
    const fit = 780;
    const k = Math.min(fit / (img.naturalWidth || img.width), fit / (img.naturalHeight || img.height));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * k));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * k));
    const x = Math.round((size - w) / 2);
    const y = Math.round((size - h) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, size, size);
    ctx.globalAlpha = 0.13;
    ctx.filter = "blur(5px)";
    ctx.drawImage(img, x, y, w, h);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

async function drawLogo(doc, logoData, pageNo) {
  if (!logoData) return;
  if (pageNo === 1) {
    try {
      const size = imageSize(doc, logoData, LOGO_MAX_W, LOGO_MAX_H);
      // Same top-left placement concept as the question-paper PDF: logo in the margin/title block.
      doc.addImage(logoData, "PNG", 17, 18, size.w, size.h, "omr-logo", "FAST");
    } catch {
      // A bad optional logo must never prevent OMR generation.
    }
  }
}

function drawWatermark(doc, watermarkData) {
  if (!watermarkData) return;
  try {
    const x = (PAGE.w - WATERMARK_MM) / 2;
    const y = (PAGE.h - WATERMARK_MM) / 2;
    doc.addImage(watermarkData, "PNG", x, y, WATERMARK_MM, WATERMARK_MM, "omr-watermark", "FAST");
  } catch {
    // Optional watermark failure should not break the printable sheet.
  }
}

// opts: { title, date, logo }
export async function drawOmrPdf(JsPDF, layout, opts = {}) {
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const title = String(opts.title || "OMR Answer Sheet").slice(0, 120);
  const code = sheetCode(layout);
  const pages = layout.pages.length;
  const watermark = opts.logo ? await bakeWatermark(opts.logo) : null;

  for (let idx = 0; idx < layout.pages.length; idx++) {
    const page = layout.pages[idx];
    if (idx > 0) doc.addPage("a4", "portrait");
    setInk(doc);

    // Watermark first so every black scanner mark stays crisp above it.
    drawWatermark(doc, watermark);
    drawRegistrationFrame(doc, page.no, layout);

    if (page.no === 1) {
      // Keep the title centred. The logo occupies the top-left header area without changing question geometry.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(fit(doc, title, 140), PAGE.w / 2 + 8, layout.header.titleY + 2, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`OMR ANSWER SHEET  |  ${layout.total} Questions  |  Page 1 of ${pages}`, PAGE.w / 2, layout.header.titleY + 7, { align: "center" });

      const fy = layout.header.fieldsY + 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.text("Name:", 17, fy);
      doc.line(29, fy + 0.8, 128, fy + 0.8);
      doc.text("Date:", 134, fy);
      if (opts.date) {
        doc.setFont("helvetica", "normal");
        doc.text(String(opts.date), 146, fy);
      }
      doc.line(145, fy + 0.8, 193, fy + 0.8);

      drawRoll(doc, layout);
      drawInstructions(doc, layout, layout.header.instr);
      await drawLogo(doc, opts.logo, page.no);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(fit(doc, title, 120), 17, layout.header.page2Top - 2.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`OMR ANSWER SHEET  |  Page ${page.no} of ${pages}`, 193, layout.header.page2Top - 2.5, { align: "right" });
      doc.setLineWidth(0.2);
      doc.line(17, layout.header.page2Top - 0.8, 193, layout.header.page2Top - 0.8);
    }

    // Sparse outer + inter-column timing trackers are drawn by the registration frame.
    // Do not add per-row tracker columns: they crowd the sheet and can confuse camera detection.
    drawQuestions(doc, layout, page);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3);
    doc.text(`${code}  |  page ${page.no}/${pages}`, PAGE.w / 2, PAGE.h - 4.6 + PT, { align: "center" });
  }

  doc.setProperties({ title: `${title} - OMR sheet`, subject: code, creator: "T4 Academy" });
  return doc;
}
