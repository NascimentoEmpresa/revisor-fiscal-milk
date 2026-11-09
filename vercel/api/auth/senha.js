// POST /api/auth/senha {atual, nova} → troca a própria senha e derruba as outras sessões.
import { q } from '../../lib/db.js';
import { conferir, gerarHash, senhaFraca } from '../../lib/senha.js';
import { criarToken, gravarCookie } from '../../lib/sessao.js';
import { protegido, json, corpo, auditar } from '../../lib/http.js';
export default protegido(['POST'], async (req, res, u) => {
  const b = await corpo(req);
  if (!(await conferir(String(b.atual || ''), u.senha_hash))) return json(res, 400, { erro: 'Senha atual incorreta.' });
  const fraca = senhaFraca(b.nova); if (fraca) return json(res, 400, { erro: fraca });
  const [n] = await q('UPDATE usuarios SET senha_hash = $1, trocar_senha = FALSE, sessao_versao = sessao_versao + 1 WHERE id = $2 RETURNING *', [await gerarHash(String(b.nova)), u.id]);
  gravarCookie(res, await criarToken(n)); await auditar(u.id, 'trocou_senha', null, req);
  return json(res, 200, { ok: true });
});
