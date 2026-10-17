// lib/qrchecker/token.js  (new file, server only)
//
// TESTING ONLY. Signed, stateless link token for the phone OMR checker:
//   /qrchecker/android/<token>
// The token carries the exam id + an expiry and is signed with a key derived from
// ADMIN_SESSION_SECRET, but with its own label -- so it can never be replayed as an admin cookie
// (lib/adminAuth.js signs with the raw secret). Nothing is stored in the database.

import crypto from "node:crypto";

const TTL_MS = 24 * 60 * 60 * 1000; // link works for 24 hours
const SIG_LEN = 22; // 16 bytes, base64url

function signKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw Object.assign(new Error("ADMIN_SESSION_SECRET is not configured."), { status: 500 });
  return crypto.createHmac("sha256", secret).update("qrchecker-v1").digest();
}

const sign = (body) => crypto.createHmac("sha256", signKey()).update(body).digest().subarray(0, 16).toString("base64url");

export function makeCheckerToken(examId) {
  const payload = { e: String(examId), x: Date.now() + TTL_MS, n: crypto.randomBytes(4).toString("hex") };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}${sign(body)}`;
}

// -> { ok: true, examId } | { ok: false, reason }
export function readCheckerToken(token) {
  try {
    const t = String(token || "");
    if (t.length <= SIG_LEN + 8) return { ok: false, reason: "malformed" };
    const body = t.slice(0, -SIG_LEN);
    const got = Buffer.from(t.slice(-SIG_LEN));
    const want = Buffer.from(sign(body));
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { ok: false, reason: "invalid" };
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.e || !payload?.x) return { ok: false, reason: "malformed" };
    if (Date.now() > payload.x) return { ok: false, reason: "expired" };
    return { ok: true, examId: String(payload.e) };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
