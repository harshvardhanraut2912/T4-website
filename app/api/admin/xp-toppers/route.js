// app/api/admin/xp-toppers/route.js  (new file)
//
// GET /api/admin/xp-toppers?limit=10
// Real students ranked by profiles.xp_count (only students that actually earned XP, so
// empty / brand-new accounts never fill the list). Gated by proxy.js like every /api/admin/* route.
// Missing names / photos are filled from Supabase Auth (same idea as /api/admin/users).
// No emails or phone numbers are returned.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const limit = Math.max(3, Math.min(25, Number(new URL(request.url).searchParams.get("limit")) || 10));

    const [{ data: rows, error }, allXp] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, username, avatar_url, current_class, is_online, xp_count, updated_at")
        .gt("xp_count", 0)
        .order("xp_count", { ascending: false })
        .order("updated_at", { ascending: true })
        .limit(limit),
      supabaseAdmin.from("profiles").select("xp_count").gt("xp_count", 0).limit(20000),
    ]);
    if (error) throw error;

    // Name / photo from Supabase Auth where the profile row itself is blank.
    const filled = await Promise.all(
      (rows || []).map(async (p) => {
        let name = p.full_name || "";
        let avatar = p.avatar_url || "";
        if (!name || !avatar) {
          try {
            const { data } = await supabaseAdmin.auth.admin.getUserById(p.id);
            const meta = data?.user?.user_metadata || {};
            name = name || meta.full_name || meta.name || "";
            avatar = avatar || meta.avatar_url || meta.picture || "";
          } catch { /* keep blanks */ }
        }
        return { p, name: name || p.username || "Student", avatar };
      })
    );

    // Standard competition ranking: equal XP shares a rank.
    let lastXp = null, lastRank = 0;
    const toppers = filled.map(({ p, name, avatar }, i) => {
      const xp = Number(p.xp_count) || 0;
      const rank = xp === lastXp ? lastRank : i + 1;
      lastXp = xp; lastRank = rank;
      return { id: p.id, name, avatar_url: avatar || null, class: p.current_class || "", online: !!p.is_online, xp, rank };
    });

    const xpList = allXp.error ? [] : allXp.data || [];
    return NextResponse.json(
      {
        toppers,
        studentsWithXp: xpList.length,
        totalXp: xpList.reduce((sum, r) => sum + (Number(r.xp_count) || 0), 0),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("xp-toppers error:", err);
    return NextResponse.json({ error: err.message || "Failed to load XP toppers." }, { status: 500 });
  }
}
