// POST /api/auth/login {email, senha} → cookie de sessão. Limite: 5 erros por e-mail ou 20 por IP em 15 min.
import { q } from '../../lib/db.js';
import { conferir } from '../../lib/senha.js';
import { criarToken, gravarCookie } from '../../lib/sessao.js';
import { json, corpo, ipDe, mesmaOrigem, auditar, publico } from '../../lib/http.js';
const FALHA = 'E-mail ou senha incorretos.';
const HASH_FALSO = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==';
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });
    if (!mesmaOrigem(req)) return json(res, 403, { erro: 'Origem não permitida' });
    const b = await corpo(req), email = String(b.email || '').trim().toLowerCase(), senha = String(b.senha || ''), ip = ipDe(req);
    if (!email || !senha || email.length > 200 || senha.length > 200) return json(res, 400, { erro: FALHA });
    const [t] = await q(`SELECT
        COUNT(*) FILTER (WHERE email = $1 AND NOT ok) AS por_email,
        COUNT(*) FILTER (WHERE ip = $2 AND NOT ok) AS por_ip
      FROM tentativas_login WHERE em > now() - interval '15 minutes'`, [email, ip]);
    if (Number(t.por_email) >= 5 || Number(t.por_ip) >= 20) return json(res, 429, { erro: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.' });
    const [u] = await q('SELECT * FROM usuarios WHERE email = $1', [email]);
    const ok = await conferir(senha, u ? u.senha_hash : HASH_FALSO) && !!u && u.ativo; // sempre calcula o hash: mesmo tempo com ou sem usuário
    await q('INSERT INTO tentativas_login (email, ip, ok) VALUES ($1, $2, $3)', [email, ip, ok]);
    if (!ok) { await auditar(u ? u.id : null, 'login_falhou', email, req); return json(res, 401, { erro: FALHA }); }
    await q('UPDATE usuarios SET ultimo_login = now() WHERE id = $1', [u.id]);
    gravarCookie(res, await criarToken(u));
    await auditar(u.id, 'login', null, req);
    return json(res, 200, { usuario: publico(u) });
  } catch (e) { console.error(e); return json(res, 500, { erro: 'Erro interno' }); }
}
