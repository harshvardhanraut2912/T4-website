// app/api/xp/leaderboard/route.js
//
// XP leaderboard for the student dashboard star button.
// Reads profiles.xp_count (service role, server side only) and returns a
// trimmed public view: name, avatar, xp. No emails / phone numbers leave here.
import { NextResponse } from 'next/server';
import { getVerifiedUser, supabaseAdmin } from '@/lib/studentAuth';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 200;

export async function GET(request) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: 'Invalid Session' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, avatar_url, xp_count, updated_at')
      .order('xp_count', { ascending: false })
      .order('updated_at', { ascending: true })
      .limit(MAX_ROWS);
    if (error) throw error;

    // Standard competition ranking: equal XP shares a rank.
    let lastXp = null;
    let lastRank = 0;
    const rows = (data || []).map((p, i) => {
      const xp = Number(p.xp_count) || 0;
      const rank = xp === lastXp ? lastRank : i + 1;
      lastXp = xp;
      lastRank = rank;
      return {
        id: p.id,
        name: p.full_name || p.username || 'Student',
        avatar_url: p.avatar_url || null,
        xp,
        rank,
        isMe: p.id === user.id,
      };
    });

    const me = rows.find((r) => r.isMe) || null;
    return NextResponse.json({ leaderboard: rows, me });
  } catch (err) {
    console.error('XP leaderboard GET:', err);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
