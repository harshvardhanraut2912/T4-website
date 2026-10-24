// app/llms.txt/route.js  (new file)
// Served at /llms.txt: a plain-text summary of the whole platform for AI assistants.
import { llmsText } from '@/lib/homeSeoContent';

export const dynamic = 'force-static';

export function GET() {
  return new Response(llmsText(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
