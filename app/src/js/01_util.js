'use strict';
/* ============================== utilidades ============================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tick = () => new Promise(r => setTimeout(r, 0));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR');
const NUM2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fBRL = n => BRL.format(n || 0);
const fNum = n => NUM.format(n || 0);
const fN2 = n => NUM2.format(n || 0);
function fBRLc(n) { // compacto: R$ 16,2 mi
  const a = Math.abs(n || 0);
  if (a >= 1e9) return 'R$ ' + NUM2.format(n / 1e9).replace(/,?0+$/, '') + ' bi';
  if (a >= 1e6) return 'R$ ' + new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n / 1e6) + ' mi';
  if (a >= 1e4) return 'R$ ' + new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n / 1e3) + ' mil';
  return fBRL(n);
}
function fMs(ms) { return ms < 1000 ? Math.max(1, Math.round(ms)) + ' ms' : NUM2.format(ms / 1000) + ' s'; }
function fDur(min) {
  if (min < 60) return Math.round(min) + ' min';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') + ' min' : '');
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ymLabel = ym => String(ym % 100).padStart(2, '0') + '/' + Math.floor(ym / 100);
const ymLong = ym => MESES[(ym % 100) - 1] + ' de ' + Math.floor(ym / 100);
const hoje = () => { const d = new Date(); return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); };

function normKey(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function toNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
function toDate(v) { // devolve {y, m, d} ou null
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const dt = new Date(EXCEL_EPOCH + Math.round(v) * 86400000);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return { y: +m[3], m: +m[2], d: +m[1] };
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return { y: +m[2], m: +m[1], d: 1 };
  return null;
}
const serial = (y, m, d) => (Date.UTC(y, m - 1, d) - EXCEL_EPOCH) / 86400000;
function digits(v, len) {
  if (v == null || v === '') return '';
  let s = typeof v === 'number' ? String(Math.round(v)) : String(v).replace(/\D/g, '');
  if (len && s && s.length < len) s = s.padStart(len, '0');
  return s;
}
function fmtNCM(n) { return n && n.length === 8 ? n.slice(0, 4) + '.' + n.slice(4, 6) + '.' + n.slice(6) : (n || '—'); }
function fmtCNPJ(s) { const d = digits(s); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (s || ''); }

/* gerador pseudoaleatório determinístico (dados de demonstração sempre iguais) */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* armazenamento indisponível */ } }
};

/* salvar arquivo: no claude.ai usa a capacidade "downloads"; fora dele, link de download comum */
let _dl = null;
async function getDownloads() {
  if (_dl !== null) return _dl;
  try { _dl = (window.claude && typeof window.claude.use === 'function') ? await window.claude.use('downloads') : false; }
  catch (e) { _dl = false; }
  return _dl || false;
}
async function saveFile(filename, blob, opt = {}) {
  const dl = await getDownloads();
  if (dl) {
    for (let tent = 0; ; tent++) {
    try { await dl.save({ filename, data: blob }); toast('Arquivo salvo: ' + filename); return true; }
    catch (e) {
      if (e && e.code === 'declined') { toast('Download cancelado: ' + filename); return false; }
      if (e && e.code === 'rate_limited' && opt.retry && tent < 5) { await new Promise(r => setTimeout(r, 1500)); continue; } // vários arquivos seguidos ("Baixar tudo")
      if (e && e.code === 'rate_limited') { toast('Já existe um download aguardando confirmação.'); return false; }
      if (e && !['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code)) { toast('Não foi possível salvar: ' + (e.message || e.code)); return false; }
      break;
    }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  toast('Download iniciado: ' + filename);
  return true;
}
