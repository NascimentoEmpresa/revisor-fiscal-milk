// Roteamento da Vercel (antes de qualquer página): sem sessão válida, só /login e /setup abrem.
// A página do sistema e a de usuários nem chegam ao navegador de quem não entrou.
import { jwtVerify } from 'jose';
import { next } from '@vercel/functions';
export const config = { matcher: ['/((?!api/|login|setup|favicon).*)'] };
export default async function middleware(request) {
  const url = new URL(request.url);
  const m = /(?:^|;\s*)rf_sessao=([^;]+)/.exec(request.headers.get('cookie') || '');
  let p = null;
  if (m && process.env.AUTH_SECRET) {
    try { p = (await jwtVerify(decodeURIComponent(m[1]), new TextEncoder().encode(process.env.AUTH_SECRET), { issuer: 'revisor-fiscal', algorithms: ['HS256'] })).payload; } catch { p = null; }
  }
  if (!p) return Response.redirect(new URL('/login', url), 302);
  if (url.pathname.startsWith('/admin') && p.papel !== 'admin') return Response.redirect(new URL('/', url), 302);
  return next();
}
