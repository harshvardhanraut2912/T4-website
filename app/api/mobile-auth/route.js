import { NextResponse } from "next/server";

// Bridge for the student mobile app's Google login.
//
// Why this exists: Expo Go's deep link (exp://<ip>:<port>/--/auth/callback) changes with the
// network, so Supabase often rejects it and falls back to the Site URL (this website) with
// ?code=... . The app instead asks Supabase to redirect HERE (always allow-listed through
// https://www.parikshiq.online/**), and this page forwards the code to the app's own deep link.
//
// The app passes its deep link as ?return=<url>. Only app schemes are accepted, so this
// can never be used as an open redirect to a normal website.
const ALLOWED_SCHEMES = ["exp:", "exps:", "parikshiq:"];

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ret = searchParams.get("return") || "";

  let target;
  try {
    target = new URL(ret);
  } catch {
    return new NextResponse("Invalid return URL.", { status: 400 });
  }
  if (!ALLOWED_SCHEMES.includes(target.protocol)) {
    return new NextResponse("Return URL scheme is not allowed.", { status: 400 });
  }

  // Forward everything Supabase added (code, error, error_description...) except our own param.
  searchParams.forEach((v, k) => {
    if (k !== "return") target.searchParams.set(k, v);
  });
  const dest = target.toString();

  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Opening app…</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f4f7fc;color:#14213d;text-align:center;padding:24px}
a{display:inline-block;margin-top:18px;padding:14px 22px;border-radius:12px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700}</style>
</head><body><div><h2>Signing you in…</h2><p>Returning to the app.</p>
<a href="${esc(dest)}">Open the app</a></div>
<script>window.location.replace(${JSON.stringify(dest).replace(/</g, "\\u003c")});</script></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
