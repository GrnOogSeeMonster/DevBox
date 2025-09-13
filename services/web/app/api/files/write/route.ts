import { NextRequest, NextResponse } from 'next/server';
const API = process.env.NEXT_PUBLIC_API_BASE || 'https://api.devbox.local';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const r = await fetch(`${API}/api/projects/${projectId}/files`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
}
