// Só admin.
//   GET    lista os usuários
//   POST   cria   {email, nome, papel, senha, cargo?, oab?, telefone?, escritorio?, cidade?}
//   PATCH  altera {id, nome?, email?, papel?, ativo?, senha?, cargo?, oab?, telefone?, escritorio?, cidade?}
//   DELETE exclui {id}
// Travas: sempre sobra pelo menos um administrador ativo; ninguém exclui a si mesmo. Mudar e-mail, perfil, senha
// ou desativar derruba as sessões abertas da pessoa (sessao_versao + 1).
import { q } from '../../lib/db.js';
import { gerarHash, senhaFraca } from '../../lib/senha.js';
import { protegido, json, corpo, publico, auditar } from '../../lib/http.js';
const PAPEIS = ['admin', 'analista'];
const PERFIL = { cargo: 120, oab: 40, telefone: 40, escritorio: 160, cidade: 120 }; // campo: tamanho máximo
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
const txt = (v, max) => v == null ? null : String(v).trim().slice(0, max);
const adminsAtivos = async () => Number((await q("SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'admin' AND ativo"))[0].n);

export default protegido(['GET', 'POST', 'PATCH', 'DELETE'], async (req, res, admin) => {
  if (req.method === 'GET') return json(res, 200, (await q('SELECT * FROM usuarios ORDER BY nome')).map(publico));
  const b = await corpo(req);

  if (req.method === 'POST') {
    const email = String(b.email || '').trim().toLowerCase(), nome = txt(b.nome, 160) || '', papel = PAPEIS.includes(b.papel) ? b.papel : 'analista';
    if (!emailOk(email) || !nome) return json(res, 400, { erro: 'Informe nome e um e-mail válido.' });
    const fraca = senhaFraca(b.senha); if (fraca) return json(res, 400, { erro: fraca });
    const [ja] = await q('SELECT id FROM usuarios WHERE email = $1', [email]); if (ja) return json(res, 409, { erro: 'Já existe um usuário com esse e-mail.' });
    const [n] = await q(`INSERT INTO usuarios (email, nome, papel, senha_hash, cargo, oab, telefone, escritorio, cidade)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [email, nome, papel, await gerarHash(String(b.senha)), ...Object.entries(PERFIL).map(([k, m]) => txt(b[k], m) || null)]);
    await auditar(admin.id, 'criou_usuario', email, req); return json(res, 201, publico(n));
  }

  const id = Number(b.id); const [alvo] = await q('SELECT * FROM usuarios WHERE id = $1', [id]);
  if (!alvo) return json(res, 404, { erro: 'Usuário não encontrado.' });

  if (req.method === 'DELETE') {
    if (alvo.id === admin.id) return json(res, 400, { erro: 'Você não pode excluir o próprio usuário.' });
    if (alvo.papel === 'admin' && alvo.ativo && await adminsAtivos() <= 1) return json(res, 400, { erro: 'O sistema precisa de pelo menos um administrador ativo.' });
    await q('DELETE FROM usuarios WHERE id = $1', [id]);
    await auditar(admin.id, 'excluiu_usuario', alvo.email, req);
    return json(res, 200, { ok: true });
  }

  // PATCH
  const tiraAdmin = (b.ativo === false || (b.papel && b.papel !== 'admin')) && alvo.papel === 'admin' && alvo.ativo;
  if (tiraAdmin && await adminsAtivos() <= 1) return json(res, 400, { erro: 'O sistema precisa de pelo menos um administrador ativo.' });
  let email = null;
  if (b.email != null) {
    email = String(b.email).trim().toLowerCase();
    if (!emailOk(email)) return json(res, 400, { erro: 'E-mail inválido.' });
    if (email === alvo.email) email = null;
    else { const [ja] = await q('SELECT id FROM usuarios WHERE email = $1 AND id <> $2', [email, id]); if (ja) return json(res, 409, { erro: 'Já existe um usuário com esse e-mail.' }); }
  }
  if (b.nome != null && !txt(b.nome, 160)) return json(res, 400, { erro: 'O nome não pode ficar vazio.' });
  let hash = null; if (b.senha) { const fraca = senhaFraca(b.senha); if (fraca) return json(res, 400, { erro: fraca }); hash = await gerarHash(String(b.senha)); }
  const papel = PAPEIS.includes(b.papel) ? b.papel : null;
  const derruba = b.ativo === false || !!hash || !!email || (papel && papel !== alvo.papel);
  // campos de perfil: só os enviados mudam (texto vazio apaga)
  const perfil = Object.keys(PERFIL).map(k => k in b ? (txt(b[k], PERFIL[k]) || null) : alvo[k]);
  const [n] = await q(`UPDATE usuarios SET nome = COALESCE($1, nome), papel = COALESCE($2, papel), ativo = COALESCE($3, ativo),
      senha_hash = COALESCE($4, senha_hash), trocar_senha = CASE WHEN $4::text IS NULL THEN trocar_senha ELSE TRUE END,
      email = COALESCE($5, email), cargo = $6, oab = $7, telefone = $8, escritorio = $9, cidade = $10,
      sessao_versao = sessao_versao + $11 WHERE id = $12 RETURNING *`,
    [txt(b.nome, 160), papel, typeof b.ativo === 'boolean' ? b.ativo : null, hash, email, ...perfil, derruba ? 1 : 0, id]);
  const mudou = Object.keys(b).filter(k => k !== 'id' && k !== 'senha'); if (hash) mudou.push('senha');
  await auditar(admin.id, 'alterou_usuario', alvo.email + ': ' + mudou.join(', '), req);
  return json(res, 200, publico(n));
}, { papel: 'admin' });
