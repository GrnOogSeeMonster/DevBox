import { NextRequest, NextResponse } from 'next/server';

const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://api:8000';

export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  let payload: URLSearchParams;
  if (ct.includes('application/json')) {
    const json = await req.json();
    payload = new URLSearchParams();
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === 'string') payload.append(k, v);
    }
  } else {
    const form = await req.formData();
    payload = new URLSearchParams();
    form.forEach((v, k) => payload.append(k, String(v)));
  }
  const r = await fetch(`${API_INTERNAL}/api/auth/register`, {
    method: 'POST',
    body: payload.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  const text = await r.text();
  return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
}
