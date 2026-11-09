// Senhas: scrypt (node:crypto) com sal aleatório; comparação em tempo constante.
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
const N = 16384, R = 8, P = 1, LEN = 64;
const derivar = (senha, sal) => new Promise((ok, erro) => scrypt(senha, sal, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (e, k) => e ? erro(e) : ok(k)));
export async function gerarHash(senha) {
  const sal = randomBytes(16);
  const k = await derivar(senha, sal);
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${k.toString('base64')}`;
}
export async function conferir(senha, hash) {
  const p = String(hash || '').split('$');
  if (p.length !== 6 || p[0] !== 'scrypt') return false;
  const k = await derivar(senha, Buffer.from(p[4], 'base64'));
  const alvo = Buffer.from(p[5], 'base64');
  return alvo.length === k.length && timingSafeEqual(alvo, k);
}
/** Regra mínima: 10 caracteres, com letra e número. */
export function senhaFraca(s) {
  s = String(s || '');
  if (s.length < 10) return 'A senha precisa de pelo menos 10 caracteres.';
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return 'Use letras e números na senha.';
  return null;
}
