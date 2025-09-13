import { NextRequest, NextResponse } from 'next/server';

const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://api:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const r = await fetch(`${API_INTERNAL}/api/auth/login`, {
    method: 'POST',
    body: form as any,
  });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
}
