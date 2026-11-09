// Acesso ao Postgres (Neon). Em teste, um banco em memória é injetado em globalThis.__RF_DB.
import { neon } from '@neondatabase/serverless';
let cache = null, migrado = false;
// Migrações pequenas e idempotentes, rodadas uma vez por instância (o banco de produção já existia antes delas).
const MIGRACOES = ['ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto TEXT'];
/** Executa SQL com parâmetros ($1, $2…) e devolve as linhas. */
export async function q(texto, params = []) {
  if (globalThis.__RF_DB) return (await globalThis.__RF_DB.query(texto, params)).rows;
  if (!cache) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL não configurada');
    cache = neon(url);
  }
  if (!migrado) { try { for (const m of MIGRACOES) await cache.query(m); migrado = true; } catch { /* antes da instalação a tabela ainda não existe */ } }
  return cache.query(texto, params);
}
