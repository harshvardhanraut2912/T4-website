// 📂 SAVE AT: app/api/training/image/route.js   (REPLACE — retired)
//
// Training Ground now runs on the shared exam engine (/exam.html) and the shared
// /api/exam/* routes. This old endpoint is intentionally disabled.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const gone = () => NextResponse.json(
  { error: 'Training Ground now runs on the exam engine. Please refresh and start a new session.' },
  { status: 410, headers: { 'Cache-Control': 'private, no-store' } }
);

export const GET = gone;
export const POST = gone;
