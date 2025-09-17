import { NextRequest, NextResponse } from 'next/server';
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://api:8000';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const r = await fetch(`${API_INTERNAL}/api/projects/${projectId}/files`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
}
