// SAVE THIS FILE AS: app/api/admin/announcements/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLE = 'announcements';

export async function GET() {
  try {
    const { data, error } = await db
      .from(TABLE)
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ announcements: data || [] });
  } catch (error) {
    console.error('Admin announcements GET:', error);
    return NextResponse.json({ error: error.message || 'Failed to load announcements.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const title = String(body.title || '').trim();
    const image_url = String(body.image_url || '').trim();
    const body_text = String(body.body_text || '').trim();

    if (!title) return NextResponse.json({ error: 'Announcement title is required.' }, { status: 400 });
    if (!image_url) return NextResponse.json({ error: 'Please upload an announcement image.' }, { status: 400 });

    const { data: maxRows, error: maxError } = await db
      .from(TABLE)
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);
    if (maxError) throw maxError;

    const nextOrder = Number(maxRows?.[0]?.display_order || 0) + 1;
    const { data, error } = await db
      .from(TABLE)
      .insert({
        title,
        image_url,
        body_text: body_text || null,
        is_active: body.is_active !== false,
        display_order: Number(body.display_order) || nextOrder,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ announcement: data });
  } catch (error) {
    console.error('Admin announcements POST:', error);
    return NextResponse.json({ error: error.message || 'Failed to create announcement.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Announcement id is required.' }, { status: 400 });

    const patch = {};
    if (typeof body.title === 'string') patch.title = body.title.trim();
    if (typeof body.image_url === 'string') patch.image_url = body.image_url.trim();
    if (typeof body.body_text === 'string') patch.body_text = body.body_text.trim() || null;
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
    if (body.display_order !== undefined) patch.display_order = Number(body.display_order) || 0;

    const { data, error } = await db.from(TABLE).update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return NextResponse.json({ announcement: data });
  } catch (error) {
    console.error('Admin announcements PATCH:', error);
    return NextResponse.json({ error: error.message || 'Failed to update announcement.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Announcement id is required.' }, { status: 400 });

    const { error } = await db.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin announcements DELETE:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete announcement.' }, { status: 500 });
  }
}
