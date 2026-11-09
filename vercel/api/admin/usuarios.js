// Só admin. GET lista · POST cria {email, nome, papel, senha} · PATCH altera {id, nome?, papel?, ativo?, senha?}.
import { q } from '../../lib/db.js';
import { gerarHash, senhaFraca } from '../../lib/senha.js';
import { protegido, json, corpo, publico, auditar } from '../../lib/http.js';
const PAPEIS = ['admin', 'analista'];
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
export default protegido(['GET', 'POST', 'PATCH'], async (req, res, admin) => {
  if (req.method === 'GET') return json(res, 200, (await q('SELECT * FROM usuarios ORDER BY nome')).map(publico));
  const b = await corpo(req);
  if (req.method === 'POST') {
    const email = String(b.email || '').trim().toLowerCase(), nome = String(b.nome || '').trim().slice(0, 160), papel = PAPEIS.includes(b.papel) ? b.papel : 'analista';
    if (!emailOk(email) || !nome) return json(res, 400, { erro: 'Informe nome e um e-mail válido.' });
    const fraca = senhaFraca(b.senha); if (fraca) return json(res, 400, { erro: fraca });
    const [ja] = await q('SELECT id FROM usuarios WHERE email = $1', [email]); if (ja) return json(res, 409, { erro: 'Já existe um usuário com esse e-mail.' });
    const [n] = await q('INSERT INTO usuarios (email, nome, papel, senha_hash) VALUES ($1, $2, $3, $4) RETURNING *', [email, nome, papel, await gerarHash(String(b.senha))]);
    await auditar(admin.id, 'criou_usuario', email, req); return json(res, 201, publico(n));
  }
  const id = Number(b.id); const [alvo] = await q('SELECT * FROM usuarios WHERE id = $1', [id]);
  if (!alvo) return json(res, 404, { erro: 'Usuário não encontrado.' });
  const tiraAdmin = (b.ativo === false || (b.papel && b.papel !== 'admin')) && alvo.papel === 'admin';
  if (tiraAdmin) { const [c] = await q("SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'admin' AND ativo"); if (Number(c.n) <= 1) return json(res, 400, { erro: 'O sistema precisa de pelo menos um administrador ativo.' }); }
  let hash = null; if (b.senha) { const fraca = senhaFraca(b.senha); if (fraca) return json(res, 400, { erro: fraca }); hash = await gerarHash(String(b.senha)); }
  const derruba = b.ativo === false || !!hash || (b.papel && b.papel !== alvo.papel);
  const [n] = await q(`UPDATE usuarios SET nome = COALESCE($1, nome), papel = COALESCE($2, papel), ativo = COALESCE($3, ativo),
      senha_hash = COALESCE($4, senha_hash), trocar_senha = CASE WHEN $4::text IS NULL THEN trocar_senha ELSE TRUE END,
      sessao_versao = sessao_versao + $5 WHERE id = $6 RETURNING *`,
    [b.nome ? String(b.nome).trim().slice(0, 160) : null, PAPEIS.includes(b.papel) ? b.papel : null, typeof b.ativo === 'boolean' ? b.ativo : null, hash, derruba ? 1 : 0, id]);
  await auditar(admin.id, 'alterou_usuario', alvo.email + ' ' + JSON.stringify({ papel: b.papel, ativo: b.ativo, senha: !!hash }), req);
  return json(res, 200, publico(n));
}, { papel: 'admin' });
