// 📂 SAVE AT: app/api/ultimate/image/route.js   (NEW FILE)
//
// POST { token, src } -> image bytes. Question images are fetched through our own server so the
// browser never talks to Supabase Storage directly (same idea as /api/exam/image-proxy).
import { NextResponse } from 'next/server';
import { authenticateStudent } from '@/lib/training';
import { isUltimateToken, loadUltimateSession, ultimateImageProxy } from '@/lib/ultimate';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { token, src } = await request.json().catch(() => ({}));
    if (!isUltimateToken(token) || typeof src !== 'string' || !src) return new NextResponse('Missing parameters.', { status: 400 });
    const auth = await authenticateStudent(request);
    if (auth.error) return auth.error;
    const session = await loadUltimateSession(token, auth.email);
    if (!session) return new NextResponse('Unauthorized.', { status: 401 });
    return await ultimateImageProxy(src);
  } catch (err) {
    console.error('Ultimate image error:', err);
    return new NextResponse('Image error.', { status: 500 });
  }
}
