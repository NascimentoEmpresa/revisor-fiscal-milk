// Sessão: token JWT (HS256) num cookie HttpOnly + Secure + SameSite=Strict, válido por 8 h.
// A cada pedido à API o usuário é conferido no banco (ativo e versão da sessão), então desativar
// alguém ou trocar a senha derruba as sessões abertas na hora.
import { SignJWT, jwtVerify } from 'jose';
import { q } from './db.js';
export const COOKIE = 'rf_sessao';
export const DURACAO_S = 8 * 60 * 60;
const chave = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET ausente ou curta (mínimo 32 caracteres)');
  return new TextEncoder().encode(s);
};
export async function criarToken(u) {
  return new SignJWT({ papel: u.papel, sv: u.sessao_versao })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(String(u.id)).setIssuedAt()
    .setExpirationTime(`${DURACAO_S}s`).setIssuer('revisor-fiscal').sign(chave());
}
export async function lerToken(token) {
  try { return (await jwtVerify(token, chave(), { issuer: 'revisor-fiscal', algorithms: ['HS256'] })).payload; } catch { return null; }
}
export function cookieDe(req) {
  const m = /(?:^|;\s*)rf_sessao=([^;]+)/.exec(req.headers.cookie || '');
  return m ? decodeURIComponent(m[1]) : null;
}
export function gravarCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACAO_S}`);
}
export function apagarCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}
/** Usuário da sessão, conferido no banco; null se não houver sessão válida. */
export async function usuarioDaSessao(req) {
  const t = cookieDe(req); if (!t) return null;
  const p = await lerToken(t); if (!p) return null;
  const [u] = await q('SELECT * FROM usuarios WHERE id = $1', [Number(p.sub)]);
  if (!u || !u.ativo || u.sessao_versao !== p.sv) return null;
  return u;
}
