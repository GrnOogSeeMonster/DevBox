import { NextRequest, NextResponse } from 'next/server';

// Normalize internal API base and ensure /api prefix
const API_INTERNAL_BASE = (process.env.API_INTERNAL_URL || 'http://api:8000').replace(/\/+$/,'');
const API = `${API_INTERNAL_BASE}/api`;

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const { path } = params;
  const fullPath = path.join('/');
  
  // Extract sandbox ID from the path (first segment after /preview/)
  const sandboxId = fullPath.split('/')[0];
  
  if (!sandboxId) {
    return NextResponse.json({ error: 'Sandbox ID required' }, { status: 400 });
  }

  try {
    // Get sandbox info from API
    const sandboxResponse = await fetch(`${API}/sandboxes/${sandboxId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!sandboxResponse.ok) {
      return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 });
    }

    const sandbox = await sandboxResponse.json();
    
    // Get the container name
    const containerName = `sandbox-${sandboxId}`;
    
    // Proxy the request to the sandbox container
    const containerUrl = `http://${containerName}:${sandbox.port}${fullPath.substring(sandboxId.length) || '/'}`;
    
    const proxyResponse = await fetch(containerUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        host: containerName,
      },
    });

    if (!proxyResponse.ok) {
      return NextResponse.json({ error: 'Preview not available' }, { status: proxyResponse.status });
    }

    const contentType = proxyResponse.headers.get('content-type') || 'text/html';
    const body = await proxyResponse.text();

    return new NextResponse(body, {
      status: proxyResponse.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Preview proxy error:', error);
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
    const r = await fetch(`${API}/sandboxes/${sandboxId}`);
    if (!r.ok) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}

