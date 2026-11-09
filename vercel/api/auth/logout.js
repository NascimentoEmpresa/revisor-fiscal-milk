// POST /api/auth/logout → apaga o cookie.
import { apagarCookie } from '../../lib/sessao.js';
import { json, mesmaOrigem } from '../../lib/http.js';
export default function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });
  if (!mesmaOrigem(req)) return json(res, 403, { erro: 'Origem não permitida' });
  apagarCookie(res); return json(res, 200, { ok: true });
}
