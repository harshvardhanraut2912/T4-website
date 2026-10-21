// app/api/admin/dev/enquiries/route.js  (new file)
// Developer-only (needs the developer cookie from /api/admin/dev/unlock).
//   GET   -> all purchase enquiries (p_enquiry), newest first.
//   PATCH -> { id, status?, notes? } mark an enquiry new / contacted / closed, or save a note.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireDev } from "@/lib/devAuth";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const forbidden = () => NextResponse.json({ error: "Developer access required." }, { status: 403 });
const tableMissing = (e) =>
  e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request) {
  try {
    const dev = await requireDev(request);
    if (!dev) return forbidden();
    const { data, error } = await supabaseAdmin
      .from("p_enquiry").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) {
      if (tableMissing(error)) return NextResponse.json({ enquiries: [], setupNeeded: true }, { headers: noStore });
      throw error;
    }
    return NextResponse.json({ enquiries: data || [], setupNeeded: false }, { headers: noStore });
  } catch (err) {
    console.error("dev enquiries GET failed:", err);
    return NextResponse.json({ error: err.message || "Failed to load." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const dev = await requireDev(request);
    if (!dev) return forbidden();
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const patch = {};
    if (body.status !== undefined) {
      if (!["new", "contacted", "closed"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      patch.status = body.status;
      patch.handled_by = dev.email;
      patch.handled_at = new Date().toISOString();
    }
    if (body.notes !== undefined) patch.notes = String(body.notes).slice(0, 2000);
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const { data, error } = await supabaseAdmin.from("p_enquiry").update(patch).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    return NextResponse.json({ ok: true, enquiry: data });
  } catch (err) {
    console.error("dev enquiries PATCH failed:", err);
    return NextResponse.json({ error: err.message || "Failed to save." }, { status: 500 });
  }
}
