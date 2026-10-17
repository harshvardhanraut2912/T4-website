// app/api/admin/qrchecker-link/route.js  (new file)
//
// TESTING ONLY. Exams -> "OMR checker link" popup.
//   POST { id }  -> { token, path, url, origins: [{ label, origin }], expiresHours }
// `url` uses this computer's Wi-Fi/LAN address instead of "localhost", so a phone on the same
// network can open it (e.g. http://10.101.185.56:3000/qrchecker/android/<token>).

import os from "node:os";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminTokenDetailed, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { denyIfSubjectBlocked } from "@/lib/subjectAccess";
import { makeCheckerToken } from "@/lib/qrchecker/token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireAdmin(request) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const check = await verifyAdminTokenDetailed(token, secret);
  return !!check.valid;
}

const bad = (error, status = 400) => NextResponse.json({ error }, { status });
const asArray = (v) => (Array.isArray(v) ? v : typeof v === "string" ? JSON.parse(v || "[]") : []);

// IPv4 addresses of this machine that a phone on the same Wi-Fi could reach, best guess first.
function lanAddresses() {
  const out = [];
  Object.entries(os.networkInterfaces()).forEach(([name, list]) => {
    (list || []).forEach((a) => {
      if (a.family !== "IPv4" || a.internal) return;
      const ip = a.address;
      const virtual = /vethernet|wsl|virtualbox|vmware|docker|hyper-v|loopback|tailscale|zerotier/i.test(name) || /^192\.168\.(56|99)\./.test(ip) || /^169\.254\./.test(ip);
      let rank = 5;
      if (/^192\.168\./.test(ip)) rank = 1;
      else if (/^10\./.test(ip)) rank = 2;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) rank = 3;
      if (virtual) rank += 10;
      out.push({ ip, name, rank });
    });
  });
  return out.sort((a, b) => a.rank - b.rank);
}

export async function POST(request) {
  try {
    if (!(await requireAdmin(request))) return bad("Forbidden: Admin authentication required.", 403);
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    if (!id) return bad("id is required.");

    const { data: row, error } = await supabaseAdmin.from("exam_answer_keys_v2").select("id, answer_manifest").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!row) return bad("Exam not found.", 404);

    const subjects = [...new Set(asArray(row.answer_manifest).map((q) => String(q.q_section || "").trim()).filter(Boolean))];
    const blocked = await denyIfSubjectBlocked(request, subjects);
    if (blocked) return blocked;

    const token = makeCheckerToken(row.id);
    const path = `/qrchecker/android/${token}`;

    const hostHeader = String(request.headers.get("host") || "");
    const port = hostHeader.split(":")[1] || process.env.PORT || "3000";
    const hostName = hostHeader.split(":")[0].toLowerCase();
    const isLocal = !hostName || hostName === "localhost" || hostName.endsWith(".localhost") || hostName === "127.0.0.1" || hostName === "0.0.0.0";

    let origins;
    if (isLocal) {
      // Keep the protocol the admin page is using (https when the dev server runs with --experimental-https).
      const scheme = new URL(request.url).protocol;
      origins = lanAddresses().map((a) => ({ label: `${a.ip}  (${a.name})`, origin: `${scheme}//${a.ip}:${port}` }));
    } else {
      // Already opened through a real address (Wi-Fi IP, tunnel, deployed site): keep that origin.
      const proto = request.headers.get("x-forwarded-proto") || "http";
      origins = [{ label: hostHeader, origin: `${proto}://${hostHeader}` }];
    }
    if (!origins.length) return bad("No Wi-Fi / LAN address found on this computer. Connect it to the same Wi-Fi as the phone.", 503);

    return NextResponse.json({ token, path, url: origins[0].origin + path, origins, expiresHours: 24 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("qrchecker-link error:", err);
    return bad(err.message || "Could not create the link.", err.status || 500);
  }
}
