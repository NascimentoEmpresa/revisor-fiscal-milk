// Foto e dados do perfil ficam na conta de cada usuário. Rode: npm test
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
process.env.AUTH_SECRET = 'x'.repeat(40);
const db = new PGlite(); globalThis.__RF_DB = db;
const { criarToken } = await import('../lib/sessao.js');
const perfil = (await import('../api/perfil.js')).default;
const me = (await import('../api/auth/me.js')).default;
const lista = (await import('../api/admin/usuarios.js')).default;
async function chamar(fn, metodo, corpo, id) {
  const [u] = (await db.query('SELECT * FROM usuarios WHERE id = $1', [id])).rows;
  const req = { method: metodo, body: corpo || {}, headers: { host: 'x.app', origin: 'https://x.app', cookie: 'rf_sessao=' + await criarToken(u) }, socket: {} };
  let status, out; await fn(req, { setHeader() {}, set statusCode(s) { status = s; }, end(b) { out = JSON.parse(b); } }); return { status, body: out };
}
const FOTO = 'data:image/jpeg;base64,' + Buffer.alloc(3000, 7).toString('base64');
let L, M;
before(async () => {
  await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  for (const [e, n, p] of [['larissa@milk.com.br', 'Larissa Milk', 'admin'], ['muriele@milk.com.br', 'Muriele', 'analista']]) await db.query("INSERT INTO usuarios (email, nome, papel, senha_hash) VALUES ($1, $2, $3, 'x')", [e, n, p]);
  [L, M] = (await db.query('SELECT id FROM usuarios ORDER BY id')).rows.map(r => r.id);
});
test('foto de um usuário não aparece para outro', async () => {
  const r = await chamar(perfil, 'PUT', { nome: 'Larissa Milk', cargo: 'Advogada', foto: FOTO }, L);
  assert.equal(r.status, 200); assert.equal(r.body.foto, FOTO);
  assert.equal((await chamar(me, 'GET', null, L)).body.foto, FOTO);
  const m = await chamar(me, 'GET', null, M);
  assert.equal(m.body.foto, null); assert.equal(m.body.cargo, null); assert.equal(m.body.nome, 'Muriele');
});
test('salvar o perfil sem mandar a foto mantém a foto', async () => {
  await chamar(perfil, 'PUT', { nome: 'Larissa Milk', cargo: 'Sócia' }, L);
  assert.equal((await chamar(me, 'GET', null, L)).body.foto, FOTO);
});
test('foto null remove; foto inválida é recusada', async () => {
  assert.equal((await chamar(perfil, 'PUT', { foto: 'javascript:alert(1)' }, L)).status, 400);
  assert.equal((await chamar(perfil, 'PUT', { foto: 'data:image/svg+xml;base64,PHN2Zz4=' }, L)).status, 400);
  assert.equal((await chamar(perfil, 'PUT', { foto: 'data:image/jpeg;base64,' + 'A'.repeat(500000) }, L)).status, 400);
  assert.equal((await chamar(me, 'GET', null, L)).body.foto, FOTO);
  await chamar(perfil, 'PUT', { foto: null }, L);
  assert.equal((await chamar(me, 'GET', null, L)).body.foto, null);
});
test('a lista de usuários do admin não carrega as fotos', async () => {
  await chamar(perfil, 'PUT', { foto: FOTO }, L);
  const r = await chamar(lista, 'GET', null, L);
  assert.ok(r.body.every(u => !('foto' in u)));
});
