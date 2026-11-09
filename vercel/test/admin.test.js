// Testes da API de usuários com um Postgres em memória (PGlite). Rode: npm test
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
process.env.AUTH_SECRET = 'x'.repeat(40);
const db = new PGlite(); globalThis.__RF_DB = db;
const { criarToken } = await import('../lib/sessao.js');
const { gerarHash } = await import('../lib/senha.js');
const usuarios = (await import('../api/admin/usuarios.js')).default;
const me = (await import('../api/auth/me.js')).default;

async function chamar(fn, metodo, corpo, quem) {
  const [u] = (await db.query('SELECT * FROM usuarios WHERE id = $1', [quem])).rows;
  const req = { method: metodo, body: corpo || {}, headers: { host: 'x.app', origin: 'https://x.app', cookie: u ? 'rf_sessao=' + await criarToken(u) : '' }, socket: {} };
  let status, out; const res = { setHeader() {}, set statusCode(s) { status = s; }, end(b) { out = JSON.parse(b); } };
  await fn(req, res); return { status, body: out };
}
let A, B, C; // admin 1, admin 2, analista
before(async () => {
  await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  const h = await gerarHash('senha12345a');
  for (const [e, p] of [['a@m.com', 'admin'], ['b@m.com', 'admin'], ['c@m.com', 'analista']]) await db.query('INSERT INTO usuarios (email, nome, papel, senha_hash) VALUES ($1, $1, $2, $3)', [e, p, h]);
  [A, B, C] = (await db.query('SELECT id FROM usuarios ORDER BY id')).rows.map(r => r.id);
});

test('analista não acessa a gestão de usuários', async () => {
  assert.equal((await chamar(usuarios, 'GET', null, C)).status, 403);
  assert.equal((await chamar(usuarios, 'DELETE', { id: B }, C)).status, 403);
});
test('admin cria usuário com dados de perfil', async () => {
  const r = await chamar(usuarios, 'POST', { nome: 'Dani', email: 'D@m.com', papel: 'analista', senha: 'provisoria123', cargo: 'Analista fiscal', cidade: 'Montenegro' }, A);
  assert.equal(r.status, 201); assert.equal(r.body.email, 'd@m.com'); assert.equal(r.body.cargo, 'Analista fiscal'); assert.equal(r.body.cidade, 'Montenegro');
});
test('admin edita nome, e-mail e perfil de outra pessoa; sessão dela cai', async () => {
  const antes = (await db.query('SELECT sessao_versao FROM usuarios WHERE id = $1', [C])).rows[0].sessao_versao;
  const r = await chamar(usuarios, 'PATCH', { id: C, nome: 'Carla Souza', email: 'carla@m.com', oab: 'RS 123', telefone: '' }, A);
  assert.equal(r.status, 200); assert.equal(r.body.nome, 'Carla Souza'); assert.equal(r.body.email, 'carla@m.com'); assert.equal(r.body.oab, 'RS 123');
  assert.equal((await db.query('SELECT sessao_versao FROM usuarios WHERE id = $1', [C])).rows[0].sessao_versao, antes + 1);
});
test('editar sem mandar um campo de perfil não apaga esse campo', async () => {
  await chamar(usuarios, 'PATCH', { id: C, cidade: 'Porto Alegre' }, A);
  const r = await chamar(usuarios, 'PATCH', { id: C, nome: 'Carla S.' }, A);
  assert.equal(r.body.cidade, 'Porto Alegre'); assert.equal(r.body.oab, 'RS 123');
});
test('e-mail repetido e inválido são recusados', async () => {
  assert.equal((await chamar(usuarios, 'PATCH', { id: C, email: 'b@m.com' }, A)).status, 409);
  assert.equal((await chamar(usuarios, 'PATCH', { id: C, email: 'sem-arroba' }, A)).status, 400);
});
test('admin não exclui a si mesmo', async () => {
  const r = await chamar(usuarios, 'DELETE', { id: A }, A); assert.equal(r.status, 400); assert.match(r.body.erro, /próprio/);
});
test('admin exclui outra pessoa', async () => {
  const [d] = (await db.query("SELECT id FROM usuarios WHERE email = 'd@m.com'")).rows;
  assert.equal((await chamar(usuarios, 'DELETE', { id: d.id }, A)).status, 200);
  assert.equal((await db.query('SELECT 1 FROM usuarios WHERE id = $1', [d.id])).rows.length, 0);
  assert.equal((await chamar(usuarios, 'DELETE', { id: d.id }, A)).status, 404);
  assert.ok((await db.query("SELECT 1 FROM auditoria WHERE acao = 'excluiu_usuario'")).rows.length);
});
test('sempre sobra um administrador ativo', async () => {
  assert.equal((await chamar(usuarios, 'DELETE', { id: B }, A)).status, 200); // havia dois
  assert.equal((await chamar(usuarios, 'PATCH', { id: A, papel: 'analista' }, A)).status, 400);
  assert.equal((await chamar(usuarios, 'PATCH', { id: A, ativo: false }, A)).status, 400);
});
test('usuário excluído perde a sessão na hora', async () => {
  const [u] = (await db.query("SELECT * FROM usuarios WHERE email = 'carla@m.com'")).rows;
  const req = { method: 'GET', headers: { host: 'x.app', cookie: 'rf_sessao=' + await criarToken(u) }, socket: {} };
  await chamar(usuarios, 'DELETE', { id: u.id }, A);
  let status; await me(req, { setHeader() {}, set statusCode(s) { status = s; }, end() {} });
  assert.equal(status, 401);
});
