import { NextRequest, NextResponse } from 'next/server';

const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://api:8000';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await fetch(`${API_INTERNAL}/api/projects/${params.id}/session-log`);
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}


