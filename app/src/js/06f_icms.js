/* ======================= ICMS · 069 (entradas) e 070 (saídas) da EFD ICMS/IPI =======================
   Tese do exemplo MAXXI (diagnóstico de 01/2026): transportadora emitiu CT-e com ICMS destacado em
   prestação que começa e termina no RS (UF RS/RS) para tomador com inscrição estadual ativa no RS, hipótese de
   isenção (Decreto 55.371/2020, a partir de 23/07/2020). O ICMS desses CT-e pode ser recuperado.
   Como a analista fez: CT-e (D100) emitidos pela empresa, RS/RS, com ICMS; período da inscrição estadual de
   cada tomador consultado na SEFAZ ("CONTRIB. ICMS": "DE dd/mm/aaaa A dd/mm/aaaa"), por mês; dentro dos 5 anos.
   O Revisor sugere o período pelo registro 0150 dos SPEDs da EFD ICMS (inscrição do participante em cada mês),
   e a analista confirma ou corrige com a consulta da SEFAZ.
   Reflexos: o débito de ICMS menor reduz o crédito presumido de 20% (quando a empresa usa) e diminui o ICMS
   excluído da base do PIS/COFINS (9,25% no não cumulativo, 3,65% no cumulativo). */

const ICMS_DECRETO_RS = 202007; // isenção do transporte interno a contribuinte inscrito: 23/07/2020
const ICMS_INI_DECRETO = '2020-07-23';
const ICMS_SAI_NAO_RECEITA = /^(20[1-9]|210|41[0-3]|55[3-7])$/; // devoluções de compra, ativo e uso e consumo: não são receita
const ICMS_DEV_COMPRA = /^(20[1-9]|210|41[0-3]|553|556)$/;

function lerICMS(headers, rows, files) {
  const hk = headers.map(normKey), ix = n => hk.indexOf(n);
  const I = { reg: ix('registros'), emit: ix('indicador emitente'), sit: ix('situacao'), part: ix('cnpj cpf participante'), nome: ix('nome participante'),
    uf: ix('uf origem destino'), num: ix('numero documento'), modelo: ix('modelo'), chave: ix('chave nf e'), data: ix('data documento'), per: ix('periodo'),
    vlrDoc: ix('vlr documento'), vop: ix('vlr operacao'), cfop: ix('cfop'), cst: ix('cst icms'), bc: ix('vlr base calculo icms'), aliq: ix('aliquota icms'), icms: ix('vlr icms'), cnpj: ix('cnpj') };
  // entradas (069) ou saídas (070): pela maioria dos CFOP
  let ent = 0, sai = 0; for (const r of rows) { const c = String(r[I.cfop] || '').trim().charAt(0); if ('123'.includes(c) && c) ent++; else if ('567'.includes(c) && c) sai++; }
  const tipo = sai >= ent ? 'S' : 'E';
  const meses = new Map(), cte = new Map(); // ICMS de saída por mês (contexto) e CT-e candidatos por chave
  const rec = new Map(), visto = new Set(), dev = new Map(), anul = new Map(), credPart = new Set(), cred = new Map(); // para os outros pontos (06g)
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], ym = ymDe(r[I.data]) || ymDe(r[I.per]); if (!ym) continue;
    const icms = toNum(r[I.icms]) || 0;
    const m = meses.get(ym) || { icms: 0, docs: 0 }; m.icms += icms; m.docs++; meses.set(ym, m);
    const cf = digits(r[I.cfop]).slice(0, 4), c3 = cf.slice(1), chv = String(r[I.chave] || '') || 'L' + i, kop = chv + '|' + cf, vop = toNum(r[I.vop]) || 0;
    if (tipo === 'S' && /^[567]/.test(cf) && !ICMS_SAI_NAO_RECEITA.test(c3)) { // receita (exclusão do ICMS da base do PIS/COFINS)
      const x = rec.get(ym) || { op: 0, icms: 0 }; if (!visto.has(kop)) { visto.add(kop); x.op += vop; } x.icms += icms; rec.set(ym, x); }
    if (tipo === 'S' && icms > 0 && ICMS_DEV_COMPRA.test(c3)) { // devolução de compra com ICMS destacado
      const d = dev.get(kop) || { k: kop, ch: chv, ym, data: r[I.data], num: String(r[I.num] || '').trim(), part: digits(r[I.part]), nome: String(r[I.nome] || '').trim(), cfop: cf, emit: String(r[I.emit] || '').trim(), sit: String(r[I.sit] || '').trim(), icms: 0, op: vop };
      d.icms += icms; dev.set(kop, d); }
    if (tipo === 'E' && /^[12]206$/.test(cf)) { // anulação de prestação de serviço de transporte
      const a = anul.get(chv) || { k: chv, ch: chv, ym, data: r[I.data], num: String(r[I.num] || '').trim(), part: digits(r[I.part]), nome: String(r[I.nome] || '').trim(), cfop: cf, op: 0, icms: 0, cf: new Set() };
      if (!a.cf.has(cf)) { a.cf.add(cf); a.op += vop; } a.icms += icms; anul.set(chv, a); }
    if (tipo === 'E' && icms > 0 && /^[123]/.test(cf) && !/^[12]206$/.test(cf)) { credPart.add(digits(r[I.part]));
      const x = cred.get(kop) || { k: kop, ym, data: r[I.data], num: String(r[I.num] || '').trim(), part: digits(r[I.part]), nome: String(r[I.nome] || '').trim(), cfop: cf, icms: 0 }; x.icms += icms; cred.set(kop, x); }
    if (tipo !== 'S' || icms <= 0) continue;
    const reg = String(r[I.reg] || ''), mod = String(r[I.modelo] || '').trim();
    if (!/^D100/i.test(reg) && mod !== '57' && mod !== '67') continue;           // só conhecimento de transporte
    if (normKey(r[I.uf]) !== 'rs rs') continue;                                 // início e fim no RS
    if (!/^0/.test(String(r[I.emit] || '0').trim())) continue;                  // emissão própria
    if (!/^0[01]$/.test(String(r[I.sit] || '00').trim())) continue;             // regular (cancelados ficam fora)
    const ch = String(r[I.chave] || '') || 'L' + i;
    const c = cte.get(ch) || { ch, i, part: digits(r[I.part]), nome: String(r[I.nome] || '').trim(), ym, data: r[I.data], num: String(r[I.num] || ''), cfop: digits(r[I.cfop]), aliq: toNum(r[I.aliq]) || 0, bc: 0, icms: 0, linhas: [] };
    c.bc += toNum(r[I.bc]) || 0; c.icms += icms; c.linhas.push(i); cte.set(ch, c);
  }
  const cnpj = I.cnpj >= 0 ? (rows.map(r => digits(r[I.cnpj])).find(c => c.length >= 11) || '') : '';
  return { tipo, headers, rows, I, meses, cte, files, cnpj, periodos: {}, ativo: {}, rec, dev: [...dev.values()], anul: [...anul.values()], credPart, cred: [...cred.values()], exclOv: {}, devOv: {}, anulOv: {} };
}

/* registro 0150 dos SPEDs da EFD ICMS/IPI (.txt): inscrição estadual de cada participante em cada mês */
function lerSped0150(texto, nome) {
  let ym = 0, cnpj = '', ehIcms = false, doc = null; const ie = new Map(), aj = [];
  for (const ln of texto.split(/\r?\n/)) {
    if (ln.startsWith('|0000|')) { const p = ln.split('|'); // EFD ICMS/IPI: |0000|COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|
      ehIcms = /^\d{8}$/.test(p[4] || '') && /^\d{8}$/.test(p[5] || ''); if (!ehIcms) return null;
      ym = +(p[4].slice(4, 8) + p[4].slice(2, 4)); cnpj = digits(p[7]); continue; }
    if (ln.startsWith('|0150|')) { const p = ln.split('|'), c = digits(p[5] || p[6]); if (c) ie.set(c, String(p[7] || '').trim()); continue; }
    // bloco C: ajustes por documento (C197), para saber se o ICMS de uma devolução foi estornado
    if (ln.startsWith('|C100|')) { const p = ln.split('|'); doc = { part: digits(p[4]), num: String(p[8] || '').replace(/^0+/, ''), ch: p[9] || '' }; continue; }
    if (ln.startsWith('|C197|') && doc) { const p = ln.split('|'); aj.push({ ym, cod: p[2] || '', desc: p[3] || '', vlr: toNum(p[7]) || toNum(p[8]) || 0, part: doc.part, num: doc.num, ch: doc.ch }); continue; }
    if (/^\|[D-H9]\d{3}\|/.test(ln)) break; // depois do bloco C não interessa
  }
  return ehIcms && ym ? { ym, cnpj, ie, nome, aj } : null;
}
function guardarSped0150(lst) {
  const m = S.extras.ie0150 || (S.extras.ie0150 = { meses: new Set(), ie: new Map(), files: [] });
  if (!m.aj) m.aj = new Map();
  for (const s of lst) { m.meses.add(s.ym); m.files.push(s.nome); for (const [c, ie] of s.ie) { let x = m.ie.get(c); if (!x) m.ie.set(c, x = new Map()); x.set(s.ym, ie); }
    for (const a of s.aj || []) m.aj.set(a.ym + '|' + a.cod + '|' + a.vlr + '|' + a.ch + '|' + a.desc, a); } // original e retificadora do mesmo mês: um só
}

/* período da inscrição estadual: "DE 27/12/2007 A 02/05/2022", "DESDE 01/04/2010", "01/2021 a 12/2022", "NÃO" */
function periodoIE(txt) {
  const s = String(txt || '').trim(); if (!s) return null;
  if (/^n[aã]o|sem ie|n[aã]o contribuinte/i.test(s)) return { ini: 0, fim: 0, nao: true };
  const ds = [...s.matchAll(/(?:(\d{1,2})\/)?(\d{1,2})\/(\d{4})/g)].map(m => +m[3] * 100 + +m[2]);
  if (!ds.length) return undefined; // texto que não deu para entender
  if (/desde/i.test(s) || ds.length === 1) return { ini: ds[0], fim: 999912 };
  return { ini: ds[0], fim: ds[1] };
}
/* sugestão pelo 0150: do primeiro ao último mês em que o tomador aparece com inscrição */
function sugestao0150(part) {
  const m = S.extras.ie0150 && S.extras.ie0150.ie.get(part); if (!m) return null;
  const com = [...m].filter(([, ie]) => ie && !/^isento$/i.test(ie)).map(([ym]) => ym).sort((a, b) => a - b);
  return com.length ? { meses: new Set(com), ini: com[0], fim: com[com.length - 1], ie: m.get(com[com.length - 1]) } : { meses: new Set(), sem: true };
}
const ymTxt = ym => ym >= 999912 ? 'hoje' : String(ym % 100).padStart(2, '0') + '/' + Math.floor(ym / 100);

/* regime de PIS/COFINS de cada ano (para o reflexo da exclusão do ICMS): ECF, ou a 037/047 */
function regimePC(ym) {
  for (const t of ['ENT', 'SAI']) { const a = S.tipo === t ? S : (S.analyses[t] && S.analyses[t].snap); const mo = a && a.monthIdx && a.monthIdx.get(ym); if (mo && mo.regime) return mo.regime === 'NC' ? 'NC' : 'CUM'; }
  const e = S.extras.ecf && S.extras.ecf.anos.find(x => x.ano === Math.floor(ym / 100)); if (e) return /real/i.test(e.trib) ? 'NC' : 'CUM';
  return null;
}

function analisarICMS(c) {
  const cut = c.corte || corte5anos();
  c.corteYm = cut;
  const tom = new Map();
  for (const t of c.cte.values()) {
    let x = tom.get(t.part); if (!x) tom.set(t.part, x = { part: t.part, nome: t.nome, n: 0, icms: 0, sel: 0, selN: 0, anos: new Map(), min: 999999, max: 0 });
    x.n++; x.icms += t.icms; if (t.ym < x.min) x.min = t.ym; if (t.ym > x.max) x.max = t.ym;
  }
  for (const x of tom.values()) {
    x.sug = sugestao0150(x.part);
    const dig = c.periodos[x.part];
    x.per = dig != null && dig !== '' ? periodoIE(dig) : null; x.fonte = x.per ? 'SEFAZ (analista)' : x.sug && !x.sug.sem ? 'EFD ICMS 0150' : null;
    x.invalido = dig != null && dig !== '' && x.per === undefined;
  }
  const R = { cte: c.cte.size, icms: 0, n: 0, anos: new Map(), tomadores: tom.size, conf: 0, sug: 0, pend: 0, presum: 0, pc: 0, pcNC: 0, pcCUM: 0, semRegime: 0 };
  const pres = c.presumido ? periodoIE(c.presumido) : null;
  for (const t of c.cte.values()) {
    const x = tom.get(t.part); t.sel = false; t.motivo = '';
    if (t.ym < ICMS_DECRETO_RS) { t.motivo = 'antes do Decreto 55.371/2020'; continue; }
    if (t.ym < cut) { t.motivo = 'fora do prazo de 5 anos'; continue; }
    let dentro;
    if (x.per && !x.per.nao) dentro = t.ym >= x.per.ini && t.ym <= x.per.fim;
    else if (x.per && x.per.nao) dentro = false;
    else dentro = !!(x.sug && x.sug.meses && x.sug.meses.has(t.ym)); // sugestão: inscrição no 0150 daquele mês
    if (c.ativo[x.part] === false) dentro = false;
    if (!dentro) { t.motivo = x.per ? 'fora do período da inscrição' : x.sug ? 'sem inscrição no 0150 do mês' : 'sem período informado'; continue; }
    t.sel = true; x.sel += t.icms; x.selN++;
    R.icms += t.icms; R.n++;
    const a = Math.floor(t.ym / 100), y = R.anos.get(a) || { icms: 0, n: 0, presum: 0, pc: 0 }; y.icms += t.icms; y.n++;
    if (pres && !pres.nao && t.ym >= pres.ini && t.ym <= pres.fim) { y.presum += t.icms * 0.2; R.presum += t.icms * 0.2; }
    const rg = regimePC(t.ym); if (rg === 'NC') { y.pc += t.icms * 0.0925; R.pcNC += t.icms * 0.0925; } else if (rg === 'CUM') { y.pc += t.icms * 0.0365; R.pcCUM += t.icms * 0.0365; } else R.semRegime += t.icms;
    R.anos.set(a, y);
  }
  for (const x of tom.values()) { if (x.sel) { if (x.fonte === 'SEFAZ (analista)') R.conf++; else R.sug++; } else if (!x.per && !(x.sug && !x.sug.sem)) R.pend++; }
  R.icms = r2(R.icms); R.presum = r2(R.presum); R.pc = r2(R.pcNC + R.pcCUM);
  c.tom = tom; c.res = R;
  return c;
}
/* prazo de 5 anos para pedir a restituição: a partir do mês atual de cinco anos atrás */
function corte5anos() { const d = new Date(); return (d.getFullYear() - 5) * 100 + d.getMonth() + 1; }

/* ---------- Excel do ICMS ---------- */
async function buildWorkbookICMS(onProgress) {
  const c = S.extras.icmsS, R = analisarICMS(c).res, B = new XlsxBook();
  const emp = S.empresa.nome || fmtCNPJ(S.extras.cnpj);
  B.title = 'ICMS - CT-e isentos RS - ' + emp;
  const anos = [...R.anos].sort((a, b) => a[0] - b[0]);
  B.addSheet({
    name: 'IMPACTO ICMS', tab: 'FF1C7A55', grid: false, cols: [36, 18, 12, 22, 24, 50],
    rows: async (emit) => {
      emit([{ v: 'ICMS destacado em CT-e isentos (transporte RS/RS para tomador inscrito) — ' + emp, s: XS.title }], { ht: 24 });
      emit([{ v: 'EFD ICMS/IPI 070 (D100). Isenção: Decreto 55.371/2020, a partir de 23/07/2020, para tomador com inscrição estadual ativa no RS. Prazo: a partir de ' + ymTxt(c.corteYm) + '. Fonte: ' + c.files.join(', '), s: XS.note }]);
      emit([]);
      const h = emit(['Ano', 'ICMS a recuperar', 'CT-e', 'Reflexo no crédito presumido (20%)', 'Reflexo no PIS/COFINS (exclusão do ICMS)'], { s: XS.headG });
      for (const [a, y] of anos) emit([{ v: String(a), s: XS.def }, { v: r2(y.icms), s: XS.brl }, { v: y.n, s: XS.int }, { v: r2(y.presum), s: XS.brl }, { v: r2(y.pc), s: XS.brl }]);
      const t = emit.proxima();
      emit([{ v: 'Total', s: XS.txtB }, { v: R.icms, f: 'SUM(B' + (h + 1) + ':B' + (t - 1) + ')', s: XS.brlB }, { v: R.n, f: 'SUM(C' + (h + 1) + ':C' + (t - 1) + ')', s: XS.intB }, { v: R.presum, f: 'SUM(D' + (h + 1) + ':D' + (t - 1) + ')', s: XS.brlB }, { v: R.pc, f: 'SUM(E' + (h + 1) + ':E' + (t - 1) + ')', s: XS.brlB }]);
      emit([]);
      emit([{ v: 'Reflexos (valores a recolher se o ICMS for recuperado): o crédito presumido de 20% cai junto com o débito; e o ICMS que deixou de ser excluído da base do PIS/COFINS volta a ser tributado (9,25% no não cumulativo, 3,65% no cumulativo).', s: XS.note }]);
      if (R.semRegime) emit([{ v: 'Sem regime de PIS/COFINS conhecido para ' + fBRL(R.semRegime) + ' de ICMS: importe a 037/047 ou a ECF para calcular esse reflexo.', s: XS.note }]);
      emit([{ v: 'A recuperação depende de autorização da SEFAZ/RS, que verifica se o tomador aproveitou o crédito. Confira o período de inscrição de cada tomador na consulta da SEFAZ (CCC/Sintegra).', s: XS.note }]);
    }
  });
  const tom = [...c.tom.values()].sort((a, b) => b.sel - a.sel || b.icms - a.icms);
  B.addSheet({
    name: 'TOMADORES', grid: false, freeze: { row: 1 }, cols: [18, 44, 30, 18, 10, 16, 16, 10, 34], filterRef: 'A1:I' + (tom.length + 1),
    rows: async (emit) => {
      emit(['CNPJ do tomador', 'Nome', 'CONTRIB. ICMS (período da inscrição)', 'Fonte do período', 'CT-e', 'ICMS dos CT-e RS/RS', 'ICMS a recuperar', 'CT-e', 'Inscrição no 0150 (meses)'], { s: XS.bHeadHl });
      for (const x of tom) emit([fmtCNPJ(x.part), x.nome, c.periodos[x.part] || (x.sug && !x.sug.sem ? 'sugerido: ' + ymTxt(x.sug.ini) + ' a ' + ymTxt(x.sug.fim) : ''), x.fonte || '—', { v: x.n, s: XS.int }, { v: r2(x.icms), s: XS.eBrlB }, { v: r2(x.sel), s: XS.eBrlB }, { v: x.selN, s: XS.int }, x.sug && !x.sug.sem ? x.sug.meses.size + ' meses' : 'não aparece'], { s: XS.bGen });
    }
  });
  // CT-e selecionados, com as colunas originais e a coluna da analista
  const H = c.headers.map(h => h == null ? '' : String(h)), hk = H.map(normKey), isV = hk.map(k => /^vlr /.test(k));
  const lin = []; for (const t of c.cte.values()) if (t.sel) for (const i of t.linhas) lin.push({ r: c.rows[i], per: c.periodos[t.part] || 'sugerido pelo 0150' });
  lin.sort((a, b) => (ymDe(a.r[c.I.data]) - ymDe(b.r[c.I.data])));
  const iIcms = c.I.icms;
  B.addSheet({
    name: 'SOMENTE CTE COM ICMS RS X RS', grid: false, split: true, freeze: { row: 1 }, landscape: true, filterRef: 'A1:' + colName(H.length) + (lin.length + 1),
    cols: H.map((h, i) => isV[i] ? 14 : null).concat([30]),
    rows: async (emit, y) => {
      emit(H.slice(0, iIcms + 1).concat(['CONTRIB. ICMS'], H.slice(iIcms + 1)), { s: XS.bHeadHl });
      for (let k = 0; k < lin.length; k++) {
        const v = lin[k].r.map((x, i) => x == null || x === '' ? BLANK : isV[i] && typeof x !== 'number' ? toNum(x) : x);
        emit(v.slice(0, iIcms + 1).concat([lin[k].per], v.slice(iIcms + 1)), { s: XS.bGen });
        if (k % 4000 === 3999) await y(Math.round(k / lin.length * 100));
      }
    }
  });
  return B.build(onProgress);
}
const arquivoICMS = () => 'ICMS - CT-e isentos RS - ' + nomeArq() + '.xlsx';
