import { NextResponse } from 'next/server';
import { clearCookie } from '@/lib/intranet-auth';

export async function POST() {
  const response = NextResponse.redirect(new URL('/login', process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));
  const cookie = clearCookie();
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
    ...(cookie.domain ? { domain: cookie.domain } : {}),
  });
  return response;
}
