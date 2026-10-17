// lib/pdfgen/leaderboard.js  (new file, server only)
//
// Draws the LEADERBOARD PDF with pdfkit (A4, portrait). Used by app/api/admin/leaderboard-pdf/route.js.
//
//   buildLeaderboardPdf({ orgName, title, viewLabel, generatedText, logo, rows, avatars, showAttempt, showPhotos })
//      logo      { buf, ext, wPx, hPx } | null          (lib/pdfgen/logo.js -> .header)
//      rows      [{ rank, name, percentage, attemptNumber, avatarUrl }]   best first, real ranks
//      avatars   Map<avatarUrl, { buf, ext }>            (lib/pdfgen/avatars.js); a missing entry = initials circle
//      showPhotos  optional; default = on when at least one picture was found
//   -> Promise<Buffer>
//
// LAYOUT (iOS-style: white page, hairline separators, grouped rounded lists, with a restrained navy
//         accent, soft medal tints and muted result colours)
//   page 1   large title header (organisation . test name . view . date, logo at the right)
//            one grouped summary card, "Top performers" medal cards, then the ranking list
//   page 2+  slim title line, list header repeated
//   every page  footer: organisation . generated time . Page x of y
//
// Only the 14 built-in PDF fonts are used (no font files to deploy), so text is limited to Latin
// characters: safeText() folds fancy Unicode (e.g. bold-math "Jay") to plain letters first.

import PDFDocument from "pdfkit";

/* ----------------------------------------------------------------------------- text */
export function safeText(value, max = 100) {
  const t = String(value ?? "")
    .normalize("NFKC") // bold / italic "math" letters, full-width forms -> plain letters
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7e\u00a0-\u00ff]/g, " ") // anything the built-in fonts cannot draw
    .replace(/\s+/g, " ")
    .trim();
  return t.slice(0, max);
}

const initialsOf = (name) => {
  const parts = String(name || "").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

/* -------------------------------------------------------------------------- palette */
// iOS system greys: label / secondary label / tertiary label, separators and grouped backgrounds.
const C = {
  navy: "#1b3566",
  blue: "#2f5fb3",
  ink: "#1c1c1e",
  slate: "#5b6577",
  mute: "#8a93a5",
  line: "#e6eaf1",
  edge: "#d5dbe6",
  group: "#eef2f9",
  card: "#f7f9fd",
  track: "#e3e8f1",
  white: "#ffffff",
};
// Medal metals: gradient tones, ring, numeral colour, ribbon colours and a soft row / card tint.
const MEDAL = [
  { light: "#fbe9a0", mid: "#e5b53a", dark: "#b88614", ring: "#9c7410", text: "#6b4d06", rib1: "#b88614", rib2: "#d9a62b", tint: "#fff8e3", edge: "#efd48a" }, // gold
  { light: "#f6f7f9", mid: "#c4c9d0", dark: "#8f969f", ring: "#7b828b", text: "#464c54", rib1: "#8f969f", rib2: "#b1b7bf", tint: "#f4f6f9", edge: "#cfd5dd" }, // silver
  { light: "#efc29a", mid: "#cd8240", dark: "#94561d", ring: "#7c4616", text: "#5a3009", rib1: "#94561d", rib2: "#b87a3d", tint: "#fcf1e6", edge: "#e6c3a0" }, // bronze
];
const AVATAR_COLORS = ["#1b3566", "#2f5fb3", "#0f766e", "#6d4c9f", "#a05a1c", "#3f6f3a"];
const colorFor = (name) => {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

// performance band of a score (muted tones)
function band(p) {
  if (p >= 80) return { label: "Outstanding", fg: "#1e5b36", bg: "#e6f3ea", bd: "#bddcc6", bar: "#3f9462" };
  if (p >= 60) return { label: "Very good", fg: "#1f4a8f", bg: "#e8effa", bd: "#bfd0ee", bar: "#2f5fb3" };
  if (p >= 40) return { label: "Satisfactory", fg: "#8a5a10", bg: "#fbf1de", bd: "#ecd5a2", bar: "#d89a2b" };
  return { label: "Needs work", fg: "#9a2f2f", bg: "#fbeaea", bd: "#eebcbc", bar: "#d65a5a" };
}

/* ------------------------------------------------------------------------- geometry */
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 36; // side margin
const CW = PAGE_W - MX * 2; // content width
const FOOT_Y = 806;
const BOTTOM = 796; // rows never go below this

const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n) || 0)) / 100;

export function buildLeaderboardPdf({ orgName, title, viewLabel, generatedText, logo, rows, avatars, showAttempt, showPhotos }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 0,
        bufferPages: true,
        info: { Title: `${title} - Leaderboard`, Author: orgName, Creator: orgName, Subject: viewLabel },
      });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // photo column: on when the admin asked for photos (students without one get an initials circle)
      const showPhotoCol = showPhotos === undefined ? avatars instanceof Map && avatars.size > 0 : !!showPhotos;

      /* -------------------------------------------------------------- small helpers */
      const font = (bold, size) => doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
      const width = (str, bold, size, spacing = 0) => font(bold, size).widthOfString(str, { characterSpacing: spacing });
      // text with its top-left at (x, y); everything is placed manually, so nothing ever wraps or paginates
      const put = (str, x, y, { bold = false, size = 10, color = C.ink, spacing = 0 } = {}) => {
        font(bold, size).fillColor(color).text(str, x, y, { lineBreak: false, characterSpacing: spacing });
      };
      const putR = (str, right, y, o = {}) => put(str, right - width(str, o.bold, o.size ?? 10, o.spacing ?? 0), y, o);
      const putC = (str, cx, y, o = {}) => put(str, cx - width(str, o.bold, o.size ?? 10, o.spacing ?? 0) / 2, y, o);
      // y that centres the capital letters of `size` pt text on the line cy
      const midY = (cy, size) => cy - size * 0.36;
      const fit = (str, maxW, bold, size) => {
        if (width(str, bold, size) <= maxW) return str;
        let s = str;
        while (s.length > 1 && width(`${s}...`, bold, size) > maxW) s = s.slice(0, -1);
        return `${s.trimEnd()}...`;
      };
      const wrap = (str, maxW, bold, size, maxLines) => {
        const words = str.split(" ");
        const lines = [];
        let cur = "";
        for (let i = 0; i < words.length; i++) {
          const next = cur ? `${cur} ${words[i]}` : words[i];
          if (width(next, bold, size) <= maxW || !cur) { cur = next; continue; }
          lines.push(cur);
          cur = words[i];
          if (lines.length === maxLines - 1) { cur = words.slice(i).join(" "); break; }
        }
        lines.push(cur);
        return lines.slice(0, maxLines).map((l, i, a) => (i === a.length - 1 ? fit(l, maxW, bold, size) : l));
      };
      const gradient = (x0, y0, x1, y1, stops) => {
        const g = doc.linearGradient(x0, y0, x1, y1);
        stops.forEach(([at, col]) => g.stop(at, col));
        return g;
      };

      const drawLogo = (x, y, w, h) => {
        if (!logo || !logo.buf) return false;
        try {
          doc.image(logo.buf, x, y, { fit: [w, h], align: "center", valign: "center" });
          return true;
        } catch {
          return false; // e.g. a GIF: pdfkit cannot embed it, the PDF is simply printed without a logo
        }
      };

      // grey initials / photo circle with a hairline ring
      const avatar = (row, cx, cy, r) => {
        const img = avatars?.get?.(row.avatarUrl);
        let done = false;
        if (img) {
          doc.save();
          try {
            doc.circle(cx, cy, r).clip();
            doc.image(img.buf, cx - r, cy - r, { cover: [r * 2, r * 2], align: "center", valign: "center" });
            done = true;
          } catch { /* unreadable picture: initials below */ }
          doc.restore();
          if (done) doc.circle(cx, cy, r).lineWidth(0.6).strokeColor(C.edge).stroke();
        }
        if (!done) {
          doc.circle(cx, cy, r).fill(colorFor(row.name));
          putC(initialsOf(row.name), cx, midY(cy, r * 0.9), { bold: true, size: r * 0.9, color: C.white });
        }
      };

      // gold / silver / bronze medal: gradient disc, ring, inner ring, numeral (+ ribbon when `ribbon`)
      const medal = (cx, cy, r, rank, ribbon = false) => {
        const m = MEDAL[Math.min(Math.max(rank, 1), 3) - 1];
        if (ribbon) {
          doc.save();
          doc.polygon([cx - r * 0.95, cy - r * 1.9], [cx - r * 0.3, cy - r * 1.9], [cx + r * 0.6, cy - r * 0.4], [cx - r * 0.05, cy - r * 0.4]).fill(m.rib1);
          doc.polygon([cx + r * 0.95, cy - r * 1.9], [cx + r * 0.3, cy - r * 1.9], [cx - r * 0.6, cy - r * 0.4], [cx + r * 0.05, cy - r * 0.4]).fill(m.rib2);
          doc.restore();
        }
        doc.circle(cx, cy, r).fill(gradient(cx - r, cy - r, cx + r, cy + r, [[0, m.light], [0.5, m.mid], [1, m.dark]]));
        doc.circle(cx, cy, r).lineWidth(Math.max(0.7, r * 0.09)).strokeColor(m.ring).stroke();
        doc.save();
        doc.strokeOpacity(0.55);
        doc.circle(cx, cy, r * 0.74).lineWidth(Math.max(0.5, r * 0.05)).strokeColor(m.light).stroke();
        doc.restore();
        putC(String(rank), cx, midY(cy, r * 1.05), { bold: true, size: r * 1.05, color: m.text });
      };

      /* ------------------------------------------------------------------- page chrome */
      let pageNo = 0;
      const hairline = (y) => doc.moveTo(MX, y).lineTo(MX + CW, y).lineWidth(0.6).strokeColor(C.edge).stroke();

      // first page: iOS "large title" header
      const header = (top) => {
        doc.rect(0, 0, PAGE_W, 10).fill(C.navy);
        doc.rect(0, 10, PAGE_W, 2.5).fill(C.blue);
        let logoW = 0;
        if (logo) {
          const s = 50;
          if (drawLogo(MX + CW - s, top, s, s)) logoW = s + 16;
        }
        const room = CW - logoW;
        put(fit(orgName.toUpperCase(), room, true, 8.5), MX, top + 2, { bold: true, size: 8.5, color: C.blue, spacing: 1.4 });
        const lines = wrap(title, room, true, 25, 2);
        let ty = top + 18;
        lines.forEach((ln) => { put(ln, MX, ty, { bold: true, size: 25, color: C.navy, spacing: -0.4 }); ty += 29; });
        put(fit(`Leaderboard  |  ${viewLabel}`, room, false, 11), MX, ty + 2, { size: 11, color: C.slate });
        put(generatedText, MX, ty + 19, { size: 8.5, color: C.mute });
        const bottom = Math.max(ty + 38, top + 62);
        hairline(bottom);
        doc.rect(MX, bottom - 1, 56, 2).fill(C.blue);
        return bottom;
      };

      // following pages: slim title line
      const strip = (top) => {
        doc.rect(0, 0, PAGE_W, 6).fill(C.navy);
        let tx = MX;
        if (logo && drawLogo(MX, top - 2, 20, 20)) tx = MX + 28;
        const rw = width(viewLabel, false, 8.5);
        put(fit(title, MX + CW - rw - 16 - tx, true, 11), tx, midY(top + 8, 11), { bold: true, size: 11, color: C.navy });
        putR(viewLabel, MX + CW, midY(top + 8, 8.5), { size: 8.5, color: C.mute });
        hairline(top + 22);
        return top + 22;
      };

      const newPage = () => {
        if (pageNo > 0) doc.addPage();
        pageNo += 1;
      };

      /* ------------------------------------------------------------------- list parts */
      const COL = {
        rankCx: MX + 30,
        photoCx: MX + 68,
        nameX: showPhotoCol ? MX + 92 : MX + 58,
        attemptCx: MX + 290,
        barX: MX + 326,
        barW: 66,
        scoreR: MX + 440,
        resultR: MX + CW - 14,
      };
      const nameMax = (showAttempt ? COL.attemptCx - 36 : COL.barX - 16) - COL.nameX;
      const ROW_H = showPhotoCol ? 38 : 30;
      const HEAD_H = 24;
      let segTop = 0; // top of the rounded list on the current page

      const tableHead = (top) => {
        segTop = top;
        doc.save();
        doc.roundedRect(MX, top, CW, HEAD_H + 20, 9).clip();
        doc.rect(MX, top, CW, HEAD_H).fill(C.navy);
        doc.restore();
        const o = { bold: true, size: 7.5, color: "#d6e0f5", spacing: 0.8 };
        const y = midY(top + HEAD_H / 2, 7.5);
        putC("RANK", COL.rankCx, y, o);
        put("STUDENT", showPhotoCol ? COL.photoCx - 14 : COL.nameX, y, o);
        if (showAttempt) putC("ATTEMPT", COL.attemptCx, y, o);
        put("SCORE", COL.barX, y, o);
        putR("RESULT", COL.resultR, y, o);
        return top + HEAD_H;
      };

      // closes the rounded outline of the list segment that ends at `bottom`
      const tableClose = (bottom) => {
        doc.roundedRect(MX, segTop, CW, bottom - segTop, 9).lineWidth(0.7).strokeColor(C.edge).stroke();
      };

      const tableRow = (row, top, last) => {
        const cy = top + ROW_H / 2;
        const mt = row.rank <= 3 ? MEDAL[row.rank - 1] : null;
        doc.rect(MX + 0.5, top, CW - 1, ROW_H).fill(mt ? mt.tint : C.white);
        if (mt) doc.rect(MX + 0.5, top, 3, ROW_H).fill(mt.mid);
        if (!last) doc.moveTo(COL.nameX - (showPhotoCol ? 26 : 0), top + ROW_H).lineTo(MX + CW, top + ROW_H).lineWidth(0.5).strokeColor(C.line).stroke();

        // rank: medal for 1-3, plain grey numeral otherwise
        if (row.rank <= 3) medal(COL.rankCx, cy, 9.5, row.rank, false);
        else putC(String(row.rank), COL.rankCx, midY(cy, 10.5), { bold: true, size: 10.5, color: C.navy });

        // photo + name
        if (showPhotoCol) avatar(row, COL.photoCx, cy, 14);
        put(fit(row.name, nameMax, true, 10.5), COL.nameX, midY(cy, 10.5), { bold: true, size: 10.5, color: C.ink });

        // attempt
        if (showAttempt) putC(`Attempt ${row.attemptNumber}`, COL.attemptCx, midY(cy, 8.5), { size: 8.5, color: C.slate });

        // thin neutral score bar + number
        const bd = band(row.percentage);
        doc.roundedRect(COL.barX, cy - 2.5, COL.barW, 5, 2.5).fill(C.track);
        const fw = Math.max(0, COL.barW * clamp01(row.percentage));
        if (fw > 0.5) doc.roundedRect(COL.barX, cy - 2.5, Math.max(fw, 5), 5, 2.5).fill(bd.bar);
        putR(pct(row.percentage), COL.scoreR, midY(cy, 10.5), { bold: true, size: 10.5, color: C.ink });

        // result: soft muted pill
        const pw2 = 66;
        doc.roundedRect(COL.resultR - pw2, cy - 7.5, pw2, 15, 7.5).lineWidth(0.6).fillAndStroke(bd.bg, bd.bd);
        putC(bd.label, COL.resultR - pw2 / 2, midY(cy, 7.5), { bold: true, size: 7.5, color: bd.fg });
      };

      /* ----------------------------------------------------------------------- page 1 */
      newPage();
      let y = header(34) + 16;

      // one grouped summary card with hairline dividers
      const count = rows.length;
      const avg = rows.reduce((n, r) => n + r.percentage, 0) / Math.max(1, count);
      const sorted = rows.map((r) => r.percentage).sort((p, q) => p - q);
      const median = count % 2 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
      const stats = [
        { label: "STUDENTS", value: String(count), color: C.navy },
        { label: "TOP SCORE", value: pct(rows[0]?.percentage ?? 0), color: "#3f9462" },
        { label: "AVERAGE", value: pct(avg), color: C.blue },
        { label: "MEDIAN", value: pct(median), color: "#d89a2b" },
      ];
      const SH = 56;
      doc.roundedRect(MX, y, CW, SH, 9).lineWidth(0.7).fillAndStroke(C.card, C.edge);
      const sw = CW / 4;
      stats.forEach((c, i) => {
        const x = MX + i * sw;
        if (i > 0) doc.moveTo(x, y + 12).lineTo(x, y + SH - 12).lineWidth(0.5).strokeColor(C.edge).stroke();
        doc.rect(x + 16, y + 9, 14, 2, ).fill(c.color);
        put(c.label, x + 16, y + 16, { bold: true, size: 7, color: C.mute, spacing: 0.9 });
        put(c.value, x + 16, y + 28, { bold: true, size: 17, color: C.navy });
      });
      y += SH + 20;

      // top performers: three medal cards
      const top3 = rows.slice(0, 3);
      if (top3.length) {
        put("TOP PERFORMERS", MX, y, { bold: true, size: 8, color: C.blue, spacing: 1.2 });
        y += 14;
        const pg = 10;
        const pw = (CW - pg * 2) / 3;
        const PH = 112;
        top3.forEach((r, i) => {
          const x = MX + i * (pw + pg);
          const cx = x + pw / 2;
          const mc = MEDAL[Math.min(r.rank, 3) - 1];
          doc.roundedRect(x, y, pw, PH, 10).lineWidth(0.8).fillAndStroke(mc.tint, mc.edge);
          medal(cx, y + 36, 17, Math.min(r.rank, 3), true);
          const nameLines = wrap(r.name, pw - 20, true, 10, 2);
          nameLines.forEach((ln, k) => putC(ln, cx, y + 62 + k * 12, { bold: true, size: 10, color: C.navy }));
          putC(pct(r.percentage), cx, y + 90, { bold: true, size: 14, color: mc.text });
        });
        y += PH + 22;
      }

      /* ------------------------------------------------------------------- list pages */
      put("RANKING", MX, y - 4, { bold: true, size: 8, color: C.blue, spacing: 1.2 });
      y += 10;
      y = tableHead(y);
      rows.forEach((row, i) => {
        if (y + ROW_H > BOTTOM) {
          tableClose(y);
          newPage();
          y = strip(34) + 16;
          y = tableHead(y);
        }
        tableRow(row, y, i === rows.length - 1);
        y += ROW_H;
      });
      tableClose(y);

      // closing note
      const note = "Ranks are real ranks: students with equal scores share the same rank.";
      if (y + 22 > BOTTOM) { newPage(); y = strip(34) + 6; }
      put(note, MX, y + 10, { size: 8, color: C.mute });

      /* ------------------------------------------------------------------------ footer */
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.moveTo(MX, FOOT_Y).lineTo(MX + CW, FOOT_Y).lineWidth(0.5).strokeColor(C.edge).stroke();
        put(fit(orgName, 190, true, 7.5), MX, FOOT_Y + 8, { bold: true, size: 7.5, color: C.navy });
        putC(generatedText, MX + CW / 2, FOOT_Y + 8, { size: 7.5, color: C.mute });
        putR(`Page ${i + 1} of ${range.count}`, MX + CW, FOOT_Y + 8, { size: 7.5, color: C.slate });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
