import { NextRequest, NextResponse } from 'next/server';

const API_INTERNAL_BASE = (process.env.API_INTERNAL_URL || 'http://api:8000').replace(/\/+$/,'');
const API = `${API_INTERNAL_BASE}/api`;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '/';
  const raw = url.searchParams.get('raw') || '0';
  const r = await fetch(`${API}/projects/${params.id}/files?path=${encodeURIComponent(path)}&raw=${raw}`);
  const text = await r.text();
  const ct = r.headers.get('Content-Type') || 'application/json';
  return new NextResponse(text, { status: r.status, headers: { 'Content-Type': ct } });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.text();
  const r = await fetch(`${API}/projects/${params.id}/files`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
}

