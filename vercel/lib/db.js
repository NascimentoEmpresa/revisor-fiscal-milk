// Acesso ao Postgres (Neon). Em teste, um banco em memória é injetado em globalThis.__RF_DB.
import { neon } from '@neondatabase/serverless';
let cache = null;
/** Executa SQL com parâmetros ($1, $2…) e devolve as linhas. */
export async function q(texto, params = []) {
  if (globalThis.__RF_DB) return (await globalThis.__RF_DB.query(texto, params)).rows;
  if (!cache) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL não configurada');
    cache = neon(url);
  }
  return cache.query(texto, params);
}
