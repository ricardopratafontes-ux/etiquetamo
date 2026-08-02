import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from './intranet-auth';

export function verificarSessaoAPI(request: NextRequest): boolean {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies['intranet_sessao'];
  const sessao = verifySession(token);
  return sessao !== null;
}

export function responderNaoAutenticado() {
  return NextResponse.json(
    { erro: 'Não autenticado. Faça login primeiro.' },
    { status: 401 }
  );
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  header.split(';').forEach((cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(value || '');
  });
  return cookies;
}
