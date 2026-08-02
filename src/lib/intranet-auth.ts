import crypto from 'crypto';

/**
 * Sessão da Intranet (site-moderna).
 * Formato: base64url(payload).base64url(HMAC-SHA256).
 * Segredo: INTRANET_JWT_SECRET (compartilhado com Painel/Site).
 * Cookie httpOnly: intranet_sessao.
 *
 * Fonte: Site da Moderna/site-moderna/src/lib/intranetServer.ts
 */

export const COOKIE = 'intranet_sessao';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const DEV_FALLBACK = 'intranet-dev-secret-apenas-local-nao-use-em-prod';

function secret(): string {
  const s = process.env.INTRANET_JWT_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== 'production') return DEV_FALLBACK;
  throw new Error('INTRANET_JWT_SECRET ausente ou muito curto em produção');
}

export type SessaoIntranet = { email: string; perfil: string; nome: string; sv?: number };

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

function sign(payload: SessaoIntranet & { exp?: number }): string {
  const body = b64({ ...payload, exp: payload.exp ?? Math.floor(Date.now() / 1000) + MAX_AGE });
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/** Verifica assinatura + expiração. Retorna payload ou null. */
export function verifySession(token: string | null | undefined): SessaoIntranet | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
    const macBuf = Buffer.from(mac);
    const expBuf = Buffer.from(expected);
    if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf)) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return { email: p.email, perfil: p.perfil, nome: p.nome, sv: p.sv };
  } catch {
    return null;
  }
}

function cookieDomain(): string | undefined {
  const d = process.env.INTRANET_COOKIE_DOMAIN;
  if (d) return d;
  if (process.env.NODE_ENV === 'production') return '.gelateriamoderna.com.br';
  return undefined;
}

export function sessionCookie(payload: SessaoIntranet) {
  const domain = cookieDomain();
  return {
    name: COOKIE,
    value: sign(payload),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE,
    ...(domain ? { domain } : {}),
  };
}

export function clearCookie() {
  const domain = cookieDomain();
  return {
    name: COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    ...(domain ? { domain } : {}),
  };
}
