import { NextRequest, NextResponse } from 'next/server';

const ORCH_INTERNAL = (process.env.ORCHESTRATOR_INTERNAL_URL || 'http://orchestrator:8080').replace(/\/+$/,'');

export async function POST(req: NextRequest, { params }: { params: { sid: string } }) {
  const body = await req.text();
  const r = await fetch(`${ORCH_INTERNAL}/agent/${params.sid}/echo`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
}


