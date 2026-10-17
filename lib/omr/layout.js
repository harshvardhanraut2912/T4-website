// OMR sheet layout engine.
//
// IMPORTANT: this file is also the source of truth for the future mobile scanner.
// Every printed coordinate is deterministic. Question bubbles never scale with the
// number of questions: 10 questions and 150 questions use the same physical geometry.

export const PAGE = { w: 210, h: 297 };
export const LAYOUT_VERSION = 3;
export const MAX_QUESTIONS = 300;
export const ROLL_DIGITS = 3;

const MK_INSET = 9;
export const MARKER = { big: 7, small: 5.5 };

// Safe printable content area. The outer tracker frame stays outside this area.
const CONTENT = { x0: 17, x1: 193, y0: 17, y1: 279 };

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

// Physical geometry. These values NEVER depend on total question count.
export const STYLES = {
  big: {
    id: "big", label: "Big circles",
    blurb: "Large, easy-to-fill bubbles. More pages for large exams.",
    r: 3.1, optPitch: 9.8, rowPitch: 9.0, rollPitch: 8.8, rollRow: 9.2, line: 0.34, letters: "header",
  },
  standard: {
    id: "standard", label: "Standard",
    blurb: "Scanner-friendly fixed geometry. Recommended for most exams.",
    r: 2.65, optPitch: 8.4, rowPitch: 7.2, rollPitch: 8.0, rollRow: 8.3, line: 0.30, letters: "header",
  },
  small: {
    id: "small", label: "Compact",
    blurb: "Smaller bubbles for high-question-count papers. Geometry is still fixed.",
    r: 2.25, optPitch: 7.2, rowPitch: 6.4, rollPitch: 7.2, rollRow: 7.4, line: 0.27, letters: "header",
  },
};

const GROUP = 5;
const r2 = (n) => Math.round(n * 100) / 100;

export function markerList() {
  return [
    { id: "TL", cx: MK_INSET, cy: MK_INSET, size: MARKER.big, role: "orientation" },
    { id: "TR", cx: PAGE.w - MK_INSET, cy: MK_INSET, size: MARKER.small, role: "corner" },
    { id: "BL", cx: MK_INSET, cy: PAGE.h - MK_INSET, size: MARKER.small, role: "corner" },
    { id: "BR", cx: PAGE.w - MK_INSET, cy: PAGE.h - MK_INSET, size: MARKER.small, role: "corner" },
  ];
}

// Fixed page-code squares. Page number is 1..15 (4 bits).
export function pageCodeSquares(pageNo) {
  const size = 2.7;
  const gap = 1.8;
  const total = 4 * size + 3 * gap;
  const x0 = PAGE.w / 2 - total / 2;
  const cy = PAGE.h - MK_INSET;
  return [0, 1, 2, 3].map((i) => ({
    bit: (pageNo >> (3 - i)) & 1,
    x: r2(x0 + i * (size + gap)),
    y: r2(cy - size / 2),
    size,
  }));
}

// Extra registration/timing boxes. They are deliberately outside the question area.
// The scanner can use these to establish horizontal row alignment even when the page is skewed.
function fixedEdgeTrackers() {
  const size = 2.8;
  // Timing marks are restricted to the answer-bubble region only.
  // They must never cross the header, roll-number box, instructions, or footer.
  const ys = [108, 143, 178, 213, 248];
  const out = [];
  ys.forEach((y, i) => {
    out.push({ id: `L${i + 1}`, side: "left", x: 4.8, y: r2(y - size / 2), size, cx: 4.8 + size / 2, cy: r2(y) });
    out.push({ id: `R${i + 1}`, side: "right", x: PAGE.w - 4.8 - size, y: r2(y - size / 2), size, cx: PAGE.w - 4.8 - size / 2, cy: r2(y) });

    // One sparse timing column in each gap between the three answer columns.
    const middleXs = [73, 137];
    middleXs.forEach((x, gapIndex) => {
      out.push({
        id: `M${gapIndex + 1}-${i + 1}`,
        side: `middle-${gapIndex + 1}`,
        x: r2(x - size / 2),
        y: r2(y - size / 2),
        size,
        cx: r2(x),
        cy: r2(y),
      });
    });
  });
  return out;
}

function rollCornerTrackers(rollBox) {
  const size = 2.8;
  const gap = 1.7;
  const xL = rollBox.x - gap - size / 2;
  const xR = rollBox.x + rollBox.w + gap + size / 2;
  const yT = rollBox.y - gap - size / 2;
  const yB = rollBox.y + rollBox.h + gap + size / 2;
  return [
    { id: "ROLL-TL", side: "roll-corner", corner: "TL", x: r2(xL - size / 2), y: r2(yT - size / 2), size, cx: r2(xL), cy: r2(yT) },
    { id: "ROLL-TR", side: "roll-corner", corner: "TR", x: r2(xR - size / 2), y: r2(yT - size / 2), size, cx: r2(xR), cy: r2(yT) },
    { id: "ROLL-BL", side: "roll-corner", corner: "BL", x: r2(xL - size / 2), y: r2(yB - size / 2), size, cx: r2(xL), cy: r2(yB) },
    { id: "ROLL-BR", side: "roll-corner", corner: "BR", x: r2(xR - size / 2), y: r2(yB - size / 2), size, cx: r2(xR), cy: r2(yB) },
  ];
}

export const TRACKERS = fixedEdgeTrackers();


function sanitiseOptions(n) {
  const v = Math.round(Number(n));
  return v === 5 ? 5 : 4;
}

function buildColumns(st, nOpt) {
  const numW = 8;
  const areaW = CONTENT.x1 - CONTENT.x0;
  const colInner = numW + nOpt * st.optPitch;
  // Exactly three columns for both 4- and 5-option sheets whenever possible.
  // This keeps the visual grid stable and makes camera row detection simple.
  const cols = areaW >= colInner * 3 + 8 ? 3 : areaW >= colInner * 2 + 6 ? 2 : 1;
  const gap = cols === 3 ? (areaW - colInner * cols) / 2 : cols === 2 ? areaW - colInner * 2 : 0;
  const colX = (c) => {
    if (cols === 1) return CONTENT.x0 + (areaW - colInner) / 2;
    return CONTENT.x0 + c * (colInner + gap);
  };
  return { numW, cols, colInner, gap, colX };
}

// opts: { total, options (4|5), style, letters }
export function buildLayout(opts = {}) {
  const total = Math.max(1, Math.min(MAX_QUESTIONS, Math.round(Number(opts.total) || 0)));
  const nOpt = sanitiseOptions(opts.options);
  const st = STYLES[opts.style] || STYLES.standard;
  const letters = opts.letters === "header" ? "header" : opts.letters === "inside" ? "inside" : st.letters;
  const letterList = OPTION_LETTERS.slice(0, nOpt);
  const { numW, cols, colX } = buildColumns(st, nOpt);

  // ------------------------------ page 1 fixed header
  const headerTop = CONTENT.y0;
  const titleY = headerTop + 6;
  const fieldsY = headerTop + 17;
  const rollTop = headerTop + 25;
  const rollTitleH = 10;
  const rollBoxW = 10;
  const rollH = Math.max(35, rollTitleH + ROLL_DIGITS * st.rollRow + 5);
  const rollRowsTop = rollTop + rollTitleH + 1.5;
  const rollW = rollBoxW + 4 + 10 * st.rollPitch + 3;
  const roll = {
    pitch: st.rollPitch,
    rowPitch: st.rollRow,
    r: st.r,
    box: { x: CONTENT.x0, y: rollTop, w: rollW, h: rollH },
    boxW: rollBoxW,
    writeBoxes: [],
    bubbles: [],
  };
  for (let d = 0; d < ROLL_DIGITS; d++) {
    const cy = rollRowsTop + d * st.rollRow + st.rollRow / 2;
    const writeBox = { x: CONTENT.x0 + 2, y: cy - (st.rollRow - 1.8) / 2, w: rollBoxW, h: st.rollRow - 1.8 };
    roll.writeBoxes.push({ x: r2(writeBox.x), y: r2(writeBox.y), w: r2(writeBox.w), h: r2(writeBox.h) });
    for (let v = 0; v < 10; v++) {
      const cx = CONTENT.x0 + 2 + rollBoxW + 4 + st.rollPitch / 2 + v * st.rollPitch;
      roll.bubbles.push({ digit_index: d, value: v, cx: r2(cx), cy: r2(cy), r: st.r });
    }
  }

  const rollTrackers = rollCornerTrackers(roll.box);

  const instr = {
    x: CONTENT.x0 + rollW + 5,
    y: rollTop,
    w: CONTENT.x1 - (CONTENT.x0 + rollW + 5),
    h: rollH,
  };

  // Page 1 and continuation pages have fixed row grids. Total question count only decides
  // which slots are populated; it NEVER changes bubble size, pitch, column positions or row pitch.
  const page1Top = rollTop + rollH + 7;
  const page2Top = CONTENT.y0 + 17;
  const headerRowH = letters === "header" ? 5 : 0;
  const groupGap = st.rowPitch * 0.28;

  const rowsFit = (top) => {
    let y = top + headerRowH;
    let rows = 0;
    while (rows < 60) {
      const extra = rows > 0 && rows % GROUP === 0 ? groupGap : 0;
      if (y + extra + st.rowPitch > CONTENT.y1) break;
      y += extra + st.rowPitch;
      rows++;
    }
    return rows;
  };

  const rows1 = rowsFit(page1Top);
  const rowsN = rowsFit(page2Top);
  const cap1 = rows1 * cols;
  const capN = rowsN * cols;
  const pages = [];
  let q = 1;
  let pageNo = 1;

  while (q <= total) {
    const top = pageNo === 1 ? page1Top : page2Top;
    const rows = pageNo === 1 ? rows1 : rowsN;
    const page = {
      no: pageNo,
      top: r2(top),
      rows,
      headerRowH,
      columns: [],
      questions: [],
      rowTrackers: [],
    };

    for (let c = 0; c < cols; c++) {
      const x0 = colX(c);
      const col = { index: c, x: r2(x0), y: r2(top), firstQ: q, optX: [], rows: 0 };
      for (let o = 0; o < nOpt; o++) col.optX.push(r2(x0 + numW + st.optPitch / 2 + o * st.optPitch));

      let y = top + headerRowH;
      for (let i = 0; i < rows && q <= total; i++) {
        if (i > 0 && i % GROUP === 0) y += groupGap;
        const cy = y + st.rowPitch / 2;
        page.questions.push({
          q,
          slot: i,
          column: c,
          numX: r2(x0 + numW - 1.5),
          cy: r2(cy),
          bubbles: letterList.map((letter, o) => ({ option: letter, cx: col.optX[o], cy: r2(cy), r: st.r })),
        });
        y += st.rowPitch;
        q++;
        col.rows++;
      }
      col.bottom = r2(y);
      page.columns.push(col);
    }

    pages.push(page);
    pageNo++;
    if (pageNo > 15) break; // 4-bit page code supports 15 pages.
  }

  return {
    version: LAYOUT_VERSION,
    total,
    options: nOpt,
    letterList,
    style: st,
    letters,
    cols,
    numW,
    pages,
    capacity: { firstPage: cap1, otherPages: capN },
    header: { titleY, fieldsY, rollTop, instr, page1Top, page2Top },
    roll,
    rollTrackers,
    markers: markerList(),
    trackers: TRACKERS,
    fits: q > total,
    scanner: {
      coordinateSystem: "A4 portrait, millimetres, origin top-left",
      fixedQuestionGeometry: true,
      note: "Question bubble geometry is independent of total question count. Timing trackers exist only in the lower answer-bubble region; four dedicated trackers surround the roll-number box. No trackers are placed across the header or other objects.",
      row_tracker_size_mm: null,
      perspective_frame: "four corner markers",
      orientation_marker: "TL is larger than TR/BL/BR",
    },
  };
}

export function sheetCode(layout) {
  const tag = { big: "BIG", standard: "STD", small: "SML" }[layout.style.id] || "STD";
  return `OMR${layout.version}-${tag}-${layout.total}Q-${layout.options}O`;
}

export function toCoordinates(layout, meta = {}) {
  const mk = layout.markers;
  const tl = mk.find((m) => m.id === "TL");
  const br = mk.find((m) => m.id === "BR");
  const fw = br.cx - tl.cx;
  const fh = br.cy - tl.cy;
  const norm = (x, y, r = 0) => ({
    nx: Math.round(((x - tl.cx) / fw) * 100000) / 100000,
    ny: Math.round(((y - tl.cy) / fh) * 100000) / 100000,
    ...(r ? { nr: Math.round((r / fw) * 100000) / 100000 } : {}),
  });
  const bubble = (b, extra = {}) => ({ ...extra, cx: b.cx, cy: b.cy, r: b.r, ...norm(b.cx, b.cy, b.r) });

  return {
    format: "cetwalle-omr-layout",
    version: layout.version,
    sheet_code: sheetCode(layout),
    generated_at: new Date().toISOString(),
    exam: { id: meta.examId || "", name: meta.examName || "", total_questions: layout.total },
    style: layout.style.id,
    options_per_question: layout.options,
    option_letters: layout.letterList,
    roll_digits: ROLL_DIGITS,
    units: "mm, origin = top-left corner of the page, x right, y down",
    page: { width: PAGE.w, height: PAGE.h, count: layout.pages.length },
    marker_frame: {
      note: "Use the four corner markers for perspective correction. TL is the orientation marker.",
      tl: { cx: tl.cx, cy: tl.cy },
      br: { cx: br.cx, cy: br.cy },
      width: fw,
      height: fh,
    },
    markers: mk.map((m) => ({ id: m.id, cx: m.cx, cy: m.cy, size: m.size, shape: "filled-square", role: m.role })),
    edge_trackers: layout.trackers.map((t) => ({ ...t, ...norm(t.cx, t.cy, t.size / 2) })),
    roll_trackers: layout.rollTrackers.map((t) => ({ ...t, ...norm(t.cx, t.cy, t.size / 2) })),
    page_code: {
      bits: 4,
      note: "4 small squares between the bottom corner markers, filled = 1, MSB first. Page 1 = 0001.",
      squares: pageCodeSquares(1),
    },
    fill_detection: {
      suggested_roi_radius_ratio: 0.78,
      note: "Measure dark-pixel coverage inside each bubble. Printed letters are thin and should be excluded by using the inner ROI.",
    },
    roll_number: {
      page: 1,
      bubbles: layout.roll.bubbles.map((b) => bubble(b, { digit_index: b.digit_index, value: b.value })),
    },
    pages: layout.pages.map((p) => ({
      page: p.no,
      rows: p.rows,
      row_trackers: [],
    })),
    questions: layout.pages.flatMap((p) => p.questions.map((qq) => ({
      q: qq.q,
      page: p.no,
      column: qq.column,
      slot: qq.slot,
      options: qq.bubbles.map((b) => bubble(b, { option: b.option })),
    }))),
  };
}
