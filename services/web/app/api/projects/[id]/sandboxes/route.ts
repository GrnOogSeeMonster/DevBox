import { NextRequest, NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_BASE || 'https://api.devbox.local';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.text();
  const r = await fetch(`${API}/api/projects/${params.id}/sandboxes`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
}
