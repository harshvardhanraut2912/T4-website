// SAVE THIS FILE AS: app/api/dashboard/announcements/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const { data, error } = await db
      .from('announcements')
      .select('id,title,image_url,body_text,display_order,created_at')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ announcements: data || [] });
  } catch (error) {
    console.error('Dashboard announcements GET:', error);
    return NextResponse.json({ announcements: [] });
  }
}
