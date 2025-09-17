import { NextRequest, NextResponse } from 'next/server';
const API_INTERNAL_BASE = (process.env.API_INTERNAL_URL || 'http://api:8000').replace(/\/+$/,'');
const API = `${API_INTERNAL_BASE}/api`;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const path = url.searchParams.get('path') || '/';
  const r = await fetch(`${API}/projects/${projectId}/files?path=${encodeURIComponent(path)}`);
  const text = await r.text();
  const ct = r.headers.get('Content-Type') || 'application/json';
  return new NextResponse(text, { status: r.status, headers: { 'Content-Type': ct } });
}
