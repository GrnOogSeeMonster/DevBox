import { NextRequest, NextResponse } from 'next/server';

// Internal API base
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://api:8000/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const { path } = params;
  const fullPath = path.join('/');
  const sandboxId = fullPath.split('/')[0];
  if (!sandboxId) return NextResponse.json({ error: 'Sandbox ID required' }, { status: 400 });
  try {
    const sandboxResponse = await fetch(`${API_INTERNAL_URL}/sandboxes/${sandboxId}`, { headers: { 'Content-Type': 'application/json' } });
    if (!sandboxResponse.ok) return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 });
    const sandbox = await sandboxResponse.json();
    const containerName = `sandbox-${sandboxId}`;
    const containerUrl = `http://${containerName}:${sandbox.port}${fullPath.substring(sandboxId.length) || '/'}`;
    const proxyResponse = await fetch(containerUrl, { method: request.method, headers: { ...Object.fromEntries(request.headers.entries()), host: containerName } });
    const contentType = proxyResponse.headers.get('content-type') || 'text/html';
    const body = await proxyResponse.text();
    return new NextResponse(body, { status: proxyResponse.status, headers: { 'Content-Type': contentType, 'Cache-Control': 'no-cache' } });
  } catch (error: any) {
    return NextResponse.json({ error: 'Preview service unavailable' }, { status: 503 });
  }
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const { path } = params;
  const fullPath = path.join('/');
  const sandboxId = fullPath.split('/')[0];
  if (!sandboxId) return new NextResponse(null, { status: 400 });
  try {
    const r = await fetch(`${API_INTERNAL_URL}/sandboxes/${sandboxId}`);
    if (!r.ok) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}


