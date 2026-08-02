import { NextResponse, type NextRequest } from 'next/server';

const COOKIE = 'intranet_sessao';

// Rotas públicas — sem cookie requerido.
const rotasPublicas = new Set(['/login', '/favicon.ico']);

// Prefixos públicos.
const prefixosPublicos = ['/api/omie', '/api/fila/catalogo', '/api/fila/reimprimir', '/_next', '/assets'];

/**
 * Middleware no edge: verifica presença do cookie. Não valida assinatura (caro).
 * A validação HMAC acontece em lib/perfil.ts (server component, runtime nodejs).
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const publica =
    rotasPublicas.has(path) ||
    prefixosPublicos.some((p) => path === p || path.startsWith(p + '/'));

  if (publica) return NextResponse.next();

  const cookie = request.cookies.get(COOKIE)?.value;
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|assets).*)'],
};
