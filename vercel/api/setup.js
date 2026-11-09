// POST /api/setup {token, nome, email, senha} → cria as tabelas e o primeiro administrador.
// Só funciona com o SETUP_TOKEN certo e enquanto não houver nenhum usuário.
import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { q } from '../lib/db.js';
import { gerarHash, senhaFraca } from '../lib/senha.js';
import { json, corpo, mesmaOrigem, auditar } from '../lib/http.js';
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });
    if (!mesmaOrigem(req)) return json(res, 403, { erro: 'Origem não permitida' });
    const b = await corpo(req), tk = process.env.SETUP_TOKEN;
    if (!tk || tk.length < 16 || !igual(b.token || '', tk)) return json(res, 403, { erro: 'Código de instalação inválido.' });
    const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
    for (const cmd of schema.replace(/--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)) await q(cmd);
    const [c] = await q('SELECT COUNT(*) AS n FROM usuarios'); if (Number(c.n) > 0) return json(res, 409, { erro: 'O sistema já foi instalado.' });
    const email = String(b.email || '').trim().toLowerCase(), nome = String(b.nome || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !nome) return json(res, 400, { erro: 'Informe nome e um e-mail válido.' });
    const fraca = senhaFraca(b.senha); if (fraca) return json(res, 400, { erro: fraca });
    const [u] = await q("INSERT INTO usuarios (email, nome, papel, senha_hash, trocar_senha) VALUES ($1, $2, 'admin', $3, FALSE) RETURNING id", [email, nome, await gerarHash(String(b.senha))]);
    await auditar(u.id, 'instalacao', email, req);
    return json(res, 201, { ok: true });
  } catch (e) { console.error(e); return json(res, 500, { erro: 'Erro interno' }); }
}
