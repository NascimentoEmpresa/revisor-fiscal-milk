// Utilidades das funções da API: JSON, corpo, IP, origem (contra CSRF) e exigência de sessão/papel.
import { usuarioDaSessao } from './sessao.js';
import { q } from './db.js';
export const json = (res, status, obj) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
export async function corpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  let s = ''; for await (const c of req) { s += c; if (s.length > 6e5) break; }
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
export const ipDe = req => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || '?';
/** Pedidos que mudam algo precisam vir do próprio site (Origin igual ao Host). */
export function mesmaOrigem(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const o = req.headers.origin; if (!o) return false;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
export async function auditar(usuario, acao, detalhe, req) {
  try { await q('INSERT INTO auditoria (usuario, acao, detalhe, ip) VALUES ($1, $2, $3, $4)', [usuario, acao, detalhe || null, req ? ipDe(req) : null]); } catch { /* auditoria não derruba o pedido */ }
}
/** Envolve um handler: confere método, origem e sessão (e papel, se pedido). */
export function protegido(metodos, fn, { papel } = {}) {
  return async (req, res) => {
    try {
      if (!metodos.includes(req.method)) return json(res, 405, { erro: 'Método não permitido' });
      if (!mesmaOrigem(req)) return json(res, 403, { erro: 'Origem não permitida' });
      const u = await usuarioDaSessao(req);
      if (!u) return json(res, 401, { erro: 'Sessão expirada. Entre de novo.' });
      if (papel && u.papel !== papel) return json(res, 403, { erro: 'Sem permissão' });
      return await fn(req, res, u);
    } catch (e) { console.error(e); return json(res, 500, { erro: 'Erro interno' }); }
  };
}
export const publico = u => ({ id: u.id, email: u.email, nome: u.nome, papel: u.papel, ativo: u.ativo, trocar_senha: u.trocar_senha, cargo: u.cargo, oab: u.oab, telefone: u.telefone, escritorio: u.escritorio, cidade: u.cidade, ultimo_login: u.ultimo_login, criado_em: u.criado_em });
