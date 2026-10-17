// lib/omr/scan.js  (new file)
//
// TESTING ONLY. Reads a PHOTO of a printed OMR sheet (made by lib/omr/layout.js + drawPdf.js) and
// returns the roll number and the marked option of every question on that page.
// Pure JavaScript, no libraries, nothing leaves the phone.
//
//   1. grey + adaptive threshold, find black connected blobs
//   2. keep the blobs that are solid squares, pick the 4 that form the corner frame (TL is bigger)
//   3. homography sheet-mm -> photo-px from the 4 corners, then refined with the edge trackers
//   4. page number from the 4 page-code squares, roll number + answers from the bubbles
//
// Every coordinate comes from buildLayout() -- the same source of truth the PDF is drawn from.

import { TRACKERS, markerList, pageCodeSquares } from "./layout";

const MAX_SIDE = 2200; // photos are scaled down to this before scanning
const MARK_MIN = 0.22; // darkness (0..1) a bubble needs to count as filled
const MULTI_RATIO = 0.6; // a 2nd bubble this dark (relative to the darkest) = multiple marks
const SHEET_W_MM = 192; // TL-TR marker distance (210 - 2*9)
const SHEET_H_MM = 279; // TL-BL marker distance (297 - 2*9)

export class ScanError extends Error {}

/* ------------------------------------------------------------------ image loading (browser) */

// File (from the camera / gallery) -> { data, width, height, canvas } scaled to MAX_SIDE.
export async function loadPhoto(file) {
  let bmp = null;
  try {
    bmp = await createImageBitmap(file); // honours the EXIF rotation of phone photos
  } catch {
    bmp = null;
  }
  let src = bmp;
  let revoke = "";
  if (!src) {
    revoke = URL.createObjectURL(file);
    src = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new ScanError("That photo could not be opened."));
      im.src = revoke;
    });
  }
  const w0 = src.width || src.naturalWidth;
  const h0 = src.height || src.naturalHeight;
  const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w0 * k));
  canvas.height = Math.max(1, Math.round(h0 * k));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if (bmp && bmp.close) bmp.close();
  if (revoke) URL.revokeObjectURL(revoke);
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: id.data, width: id.width, height: id.height, canvas };
}

/* ------------------------------------------------------------------ small maths */

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

// Least-squares homography from pairs [{ x, y, u, v }] (sheet mm -> photo px). Returns 9 numbers or null.
function fitHomography(pairs) {
  const n = pairs.length;
  if (n < 4) return null;
  let mx = 0, my = 0, mu = 0, mv = 0;
  pairs.forEach((p) => { mx += p.x; my += p.y; mu += p.u; mv += p.v; });
  mx /= n; my /= n; mu /= n; mv /= n;
  let ds = 0, dd = 0;
  pairs.forEach((p) => { ds += Math.hypot(p.x - mx, p.y - my); dd += Math.hypot(p.u - mu, p.v - mv); });
  const ss = Math.SQRT2 / (ds / n || 1);
  const sd = Math.SQRT2 / (dd / n || 1);
  const ATA = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const ATb = new Array(8).fill(0);
  const add = (row, rhs) => {
    for (let i = 0; i < 8; i++) {
      ATb[i] += row[i] * rhs;
      for (let j = 0; j < 8; j++) ATA[i][j] += row[i] * row[j];
    }
  };
  pairs.forEach((p) => {
    const x = (p.x - mx) * ss, y = (p.y - my) * ss, u = (p.u - mu) * sd, v = (p.v - mv) * sd;
    add([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    add([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  });
  const h = solve(ATA, ATb);
  if (!h) return null;
  // H = Td^-1 * Hn * Ts
  const Hn = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  const Ts = [ss, 0, -ss * mx, 0, ss, -ss * my, 0, 0, 1];
  const Tdi = [1 / sd, 0, mu, 0, 1 / sd, mv, 0, 0, 1];
  const mul = (a, b) => {
    const o = new Array(9).fill(0);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c];
    return o;
  };
  const H = mul(Tdi, mul(Hn, Ts));
  const s = H[8] || 1;
  return H.map((v) => v / s);
}

const project = (H, x, y) => {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
};

/* ------------------------------------------------------------------ blobs */

function toGray(rgba, W, H) {
  const g = new Uint8ClampedArray(W * H);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return g;
}

// Pixel is "ink" when it is clearly darker than its own neighbourhood (copes with shadows / uneven light).
function adaptiveInk(gray, W, H) {
  const W1 = W + 1;
  const integ = new Uint32Array(W1 * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += gray[y * W + x];
      integ[(y + 1) * W1 + x + 1] = integ[y * W1 + x + 1] + row;
    }
  }
  const R = Math.max(8, Math.round(Math.max(W, H) / 26));
  const ink = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1);
      const sum = integ[y1 * W1 + x1] - integ[y0 * W1 + x1] - integ[y1 * W1 + x0] + integ[y0 * W1 + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const g = gray[y * W + x];
      if (g < mean * 0.74 && g < 170) ink[y * W + x] = 1;
    }
  }
  return ink;
}

// Connected components -> list of solid-square blobs [{ cx, cy, area, side }].
function squareBlobs(ink, W, H) {
  const labels = new Int32Array(W * H);
  const parent = new Int32Array((W * H >> 1) + 2);
  let next = 1;
  const find = (a) => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!ink[i]) continue;
      const l = x > 0 ? labels[i - 1] : 0;
      const t = y > 0 ? labels[i - W] : 0;
      if (!l && !t) { parent[next] = next; labels[i] = next++; }
      else if (l && !t) labels[i] = l;
      else if (!l && t) labels[i] = t;
      else {
        const a = find(l), b = find(t);
        if (a !== b) { if (a < b) parent[b] = a; else parent[a] = b; }
        labels[i] = Math.min(a, b);
      }
    }
  }
  const area = new Int32Array(next), minx = new Int32Array(next).fill(1e9), maxx = new Int32Array(next).fill(-1);
  const miny = new Int32Array(next).fill(1e9), maxy = new Int32Array(next).fill(-1);
  const sx = new Float64Array(next), sy = new Float64Array(next);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!labels[i]) continue;
      const r = find(labels[i]);
      labels[i] = r;
      area[r]++; sx[r] += x; sy[r] += y;
      if (x < minx[r]) minx[r] = x; if (x > maxx[r]) maxx[r] = x;
      if (y < miny[r]) miny[r] = y; if (y > maxy[r]) maxy[r] = y;
    }
  }
  const maxArea = W * H * 0.01;
  const candIdx = new Int32Array(next).fill(-1);
  const cands = [];
  for (let r = 1; r < next; r++) {
    if (!area[r] || parent[r] !== r) continue;
    const a = area[r];
    if (a < 120 || a > maxArea) continue;
    const bw = maxx[r] - minx[r] + 1, bh = maxy[r] - miny[r] + 1;
    if (bw < 6 || bh < 6 || Math.max(bw, bh) / Math.min(bw, bh) > 1.7 || a / (bw * bh) < 0.4) continue;
    candIdx[r] = cands.length;
    cands.push({ r, area: a, cx: sx[r] / a, cy: sy[r] / a, xs: [], ys: [] });
  }
  if (!cands.length) return [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = labels[y * W + x];
      if (l && candIdx[l] >= 0) { const c = cands[candIdx[l]]; c.xs.push(x); c.ys.push(y); }
    }
  }
  const out = [];
  cands.forEach((c) => {
    const n = c.xs.length;
    const step = Math.max(1, Math.ceil(n / 600));
    let best = Infinity, du = 1, dv = 1;
    for (let deg = 0; deg < 90; deg += 5) {
      const co = Math.cos((deg * Math.PI) / 180), si = Math.sin((deg * Math.PI) / 180);
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (let k = 0; k < n; k += step) {
        const u = c.xs[k] * co + c.ys[k] * si, v = -c.xs[k] * si + c.ys[k] * co;
        if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
      }
      const a = (u1 - u0 + 1) * (v1 - v0 + 1);
      if (a < best) { best = a; du = u1 - u0 + 1; dv = v1 - v0 + 1; }
    }
    const fill = c.area / best;
    const asp = Math.max(du, dv) / Math.min(du, dv);
    if (fill >= 0.82 && asp <= 1.4) out.push({ cx: c.cx, cy: c.cy, area: c.area, side: Math.sqrt(c.area) });
  });
  return out;
}

/* ------------------------------------------------------------------ corner frame */

// Four solid squares forming a 192 x 279 mm rectangle. Returns [TL, TR, BR, BL] (photo px) + px-per-mm.
function pickFrame(blobs) {
  const top = [...blobs].sort((a, b) => b.area - a.area).slice(0, 16);
  let best = null;
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) for (let k = j + 1; k < top.length; k++) for (let l = k + 1; l < top.length; l++) {
    const pts = [top[i], top[j], top[k], top[l]];
    const cx = (pts[0].cx + pts[1].cx + pts[2].cx + pts[3].cx) / 4;
    const cy = (pts[0].cy + pts[1].cy + pts[2].cy + pts[3].cy) / 4;
    pts.sort((a, b) => Math.atan2(a.cy - cy, a.cx - cx) - Math.atan2(b.cy - cy, b.cx - cx)); // clockwise on screen
    const d = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
    const d01 = d(pts[0], pts[1]), d12 = d(pts[1], pts[2]), d23 = d(pts[2], pts[3]), d30 = d(pts[3], pts[0]);
    const r1 = d01 / d23, r2 = d12 / d30;
    if (r1 < 0.7 || r1 > 1.43 || r2 < 0.7 || r2 > 1.43) continue;
    const A = (d01 + d23) / 2, B = (d12 + d30) / 2;
    const asp = Math.max(A, B) / Math.min(A, B);
    if (asp < 1.16 || asp > 1.85) continue;
    let straight = true;
    for (let v = 0; v < 4; v++) {
      const p = pts[v], a = pts[(v + 3) % 4], b = pts[(v + 1) % 4];
      const ax = a.cx - p.cx, ay = a.cy - p.cy, bx = b.cx - p.cx, by = b.cy - p.cy;
      if (Math.abs((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))) > 0.5) straight = false;
    }
    if (!straight) continue;
    const s = (A + B) / (SHEET_W_MM + SHEET_H_MM);
    if (pts.some((p) => p.side / s < 4 || p.side / s > 9)) continue; // markers are 5.5 / 7 mm
    const areas = pts.map((p) => p.area);
    if (Math.max(...areas) / Math.min(...areas) > 3.2) continue;
    const sum = areas[0] + areas[1] + areas[2] + areas[3];
    if (!best || sum > best.sum) best = { pts, sum, s };
  }
  if (!best) return null;
  // The biggest square is the TL marker; clockwise from it: TR, BR, BL.
  let t = 0;
  best.pts.forEach((p, i) => { if (p.area > best.pts[t].area) t = i; });
  const ord = [0, 1, 2, 3].map((o) => best.pts[(t + o) % 4]);
  const wh = Math.hypot(ord[0].cx - ord[1].cx, ord[0].cy - ord[1].cy) / Math.hypot(ord[0].cx - ord[3].cx, ord[0].cy - ord[3].cy);
  if (wh < 0.5 || wh > 0.9) return null; // could not tell which corner is the big one
  return { corners: ord, s: best.s };
}

/* ------------------------------------------------------------------ bubble reading */

function makeSampler(gray, W, H) {
  return (x, y) => {
    if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) return 255;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * W + x0;
    return (gray[i] * (1 - fx) + gray[i + 1] * fx) * (1 - fy) + (gray[i + W] * (1 - fx) + gray[i + W + 1] * fx) * fy;
  };
}

const INNER = [[0, 0, 1]];
[[0.28, 6], [0.5, 10], [0.72, 14]].forEach(([rad, n]) => { for (let k = 0; k < n; k++) INNER.push([rad, (k / n) * Math.PI * 2, 0]); });
const RING = [];
[1.3, 1.6].forEach((rad) => { for (let k = 0; k < 8; k++) RING.push([rad, (k / 8) * Math.PI * 2 + (rad > 1.4 ? 0.39 : 0)]); });

// 0 (as bright as the paper around it) .. 1 (black)
function darkness(H, sample, cx, cy, r) {
  let inner = 0;
  INNER.forEach((p, i) => {
    const [x, y] = i === 0 ? [cx, cy] : [cx + Math.cos(p[1]) * p[0] * r, cy + Math.sin(p[1]) * p[0] * r];
    const [u, v] = project(H, x, y);
    inner += sample(u, v);
  });
  inner /= INNER.length;
  const ring = RING.map(([rad, a]) => {
    const [u, v] = project(H, cx + Math.cos(a) * rad * r, cy + Math.sin(a) * rad * r);
    return sample(u, v);
  }).sort((a, b) => b - a);
  const paper = ring.slice(0, 8).reduce((s, v) => s + v, 0) / 8;
  return Math.max(0, Math.min(1, 1 - inner / Math.max(paper, 1)));
}

function decide(darks) {
  const order = darks.map((d, i) => [d, i]).sort((a, b) => b[0] - a[0]);
  const [d1, i1] = order[0];
  const d2 = order.length > 1 ? order[1][0] : 0;
  if (d1 < MARK_MIN) return { state: "blank", index: -1 };
  if (d2 >= MARK_MIN && d2 >= MULTI_RATIO * d1) return { state: "multi", index: -1 };
  return { state: "ok", index: i1 };
}

/* ------------------------------------------------------------------ main */

// img = { data (RGBA), width, height }; layout = buildLayout(...) for the printed sheet.
export function scanSheet(img, layout) {
  const { width: W, height: H } = img;
  const gray = toGray(img.data, W, H);
  const blobs = squareBlobs(adaptiveInk(gray, W, H), W, H);
  const frame = pickFrame(blobs);
  if (!frame) throw new ScanError("Could not see the four black corner squares. Put the whole sheet in the photo, flat and well lit.");

  // corners -> first homography
  const mk = Object.fromEntries(markerList().map((m) => [m.id, m]));
  const ids = ["TL", "TR", "BR", "BL"];
  const pairs = ids.map((id, i) => ({ x: mk[id].cx, y: mk[id].cy, u: frame.corners[i].cx, v: frame.corners[i].cy }));
  let Hm = fitHomography(pairs);
  if (!Hm) throw new ScanError("Could not work out the sheet position. Try another photo.");

  // refine with the small edge trackers (more points -> less drift in the middle of the sheet)
  const small = blobs.filter((b) => b.side / frame.s > 1.9 && b.side / frame.s < 3.9);
  const trackers = [...TRACKERS, ...layout.rollTrackers];
  const matched = [];
  trackers.forEach((t) => {
    const [pu, pv] = project(Hm, t.cx, t.cy);
    let bestB = null, bestD = 2.5 * frame.s;
    small.forEach((b) => { const dd = Math.hypot(b.cx - pu, b.cy - pv); if (dd < bestD) { bestD = dd; bestB = b; } });
    if (bestB) matched.push({ x: t.cx, y: t.cy, u: bestB.cx, v: bestB.cy });
  });
  let used = 0;
  let tracks = []; // tracker squares that were matched (drawn as small dots in the live view)
  if (matched.length >= 6) {
    let set = [...pairs, ...matched];
    for (let it = 0; it < 4; it++) {
      const Hn = fitHomography(set);
      if (!Hn) break;
      const res = set.map((p) => { const [u, v] = project(Hn, p.x, p.y); return Math.hypot(u - p.u, v - p.v) / frame.s; });
      let worst = -1, wv = 0.6;
      res.forEach((r, i) => { if (i >= 4 && r > wv) { wv = r; worst = i; } });
      Hm = Hn;
      if (worst < 0) break;
      set = set.filter((_, i) => i !== worst);
    }
    used = set.length - 4;
    tracks = set.slice(4);
  }

  const sample = makeSampler(gray, W, H);

  // page number (4 squares, MSB first; filled = 1)
  const bits = pageCodeSquares(1).map((q) => (darkness(Hm, sample, q.x + q.size / 2, q.y + q.size / 2, q.size / 2) > 0.4 ? 1 : 0));
  const pageNo = (bits[0] << 3) | (bits[1] << 2) | (bits[2] << 1) | bits[3];
  const page = layout.pages[pageNo - 1];
  if (!page) throw new ScanError(`Page code ${pageNo} is not part of this sheet (the sheet has ${layout.pages.length} page${layout.pages.length === 1 ? "" : "s"}). Check the style / options under "Sheet settings".`);

  const marks = ids.map((id, i) => ({ u: frame.corners[i].cx, v: frame.corners[i].cy, r: 5 * frame.s, kind: "corner" }));
  tracks.forEach((p) => marks.push({ u: p.u, v: p.v, r: 1.8 * frame.s, kind: "track" }));
  const dot = (b, kind) => { const [u, v] = project(Hm, b.cx, b.cy); marks.push({ u, v, r: b.r * frame.s, kind }); };

  // roll number (page 1 only)
  let roll = null;
  if (pageNo === 1) {
    const digits = [];
    for (let di = 0; di < layout.roll.bubbles.length / 10; di++) {
      const row = layout.roll.bubbles.filter((b) => b.digit_index === di);
      const dec = decide(row.map((b) => darkness(Hm, sample, b.cx, b.cy, b.r)));
      digits.push(dec.state === "ok" ? row[dec.index].value : null);
      if (dec.state === "ok") dot(row[dec.index], "pick");
      else row.forEach((b) => dot(b, dec.state === "multi" ? "multi" : "blank"));
    }
    roll = { digits, text: digits.map((d) => (d === null ? "?" : String(d))).join(""), valid: digits.every((d) => d !== null) };
  }

  // answers
  const answers = page.questions.map((qq) => {
    const dec = decide(qq.bubbles.map((b) => darkness(Hm, sample, b.cx, b.cy, b.r)));
    if (dec.state === "ok") dot(qq.bubbles[dec.index], "pick");
    else if (dec.state === "multi") qq.bubbles.forEach((b) => dot(b, "multi"));
    return { q: qq.q, letter: dec.state === "ok" ? qq.bubbles[dec.index].option : null, state: dec.state };
  });

  return { pageNo, roll, answers, trackers: used, scale: frame.s, marks };
}

/* ------------------------------------------------------------------ test overlay (browser) */

// Draws the photo with what the scanner saw: blue = corner squares, green = chosen bubble, red = multiple marks.
export function drawOverlay(canvasEl, photo, result) {
  const k = Math.min(1, 900 / photo.width);
  canvasEl.width = Math.round(photo.width * k);
  canvasEl.height = Math.round(photo.height * k);
  const ctx = canvasEl.getContext("2d");
  ctx.drawImage(photo.canvas, 0, 0, canvasEl.width, canvasEl.height);
  result.marks.forEach((m) => {
    ctx.beginPath();
    ctx.arc(m.u * k, m.v * k, Math.max(2, m.r * k), 0, Math.PI * 2);
    ctx.lineWidth = 2;
    if (m.kind === "corner") { ctx.strokeStyle = "#007aff"; ctx.stroke(); }
    else if (m.kind === "track") { ctx.strokeStyle = "#06b6d4"; ctx.stroke(); }
    else if (m.kind === "pick") { ctx.strokeStyle = "#16a34a"; ctx.fillStyle = "rgba(22,163,74,.35)"; ctx.fill(); ctx.stroke(); }
    else if (m.kind === "multi") { ctx.strokeStyle = "#dc2626"; ctx.stroke(); }
  });
}
