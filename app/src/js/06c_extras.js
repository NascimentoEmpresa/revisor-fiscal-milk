/* ======================= planilhas complementares do SistemaMA =======================
   Ficam ao lado das análises da 037 e da 047 (mesma empresa) e alimentam o Excel próprio e o Word:
   - Junção 513 (EFD ICMS/IPI + EFD-Contribuições, C100/C170, "Todos os Documentos e CFOP - Resumido"):
     notas que estão no EFD ICMS mas não no EFD-Contribuições. Nas entradas, viram crédito de PIS/COFINS
     não aproveitado ("notas não escrituradas"); nas saídas, risco de receita sem PIS/COFINS.
   - ECF 0000/0010 (Identificação PJ e Parâmetros de Tributação): forma de tributação e de apuração por ano.
   A classificação das notas da 513 usa o que o MESMO fornecedor vende nas notas da 037 (NCM, descrição e a
   classificação do Revisor), porque a 513 não traz os itens da nota. */

S.extras = { cnpj: '', j513: null, ecf: null, ecd: null };

/* reconhece a planilha complementar pelo cabeçalho (normalizado por normKey) */
function tipoExtra(hk) {
  if (hk.includes('existe efd') && hk.includes('existe con') && hk.some(k => k.startsWith('vlr operacional'))) return 'J513';
  if (hk.includes('forma tributacao') && hk.includes('forma apuracao') && hk.includes('periodo inicial')) return 'ECF';
  return null;
}
const EXTRA_NOME = { J513: 'Junção 513 · EFD ICMS × Contribuições', ECF: 'ECF 0000/0010 · Parâmetros de tributação' };

/* ano-mês (aaaamm) de uma data em texto dd/mm/aaaa, Date ou número de série do Excel */
function ymDe(v) {
  if (v instanceof Date) return v.getFullYear() * 100 + v.getMonth() + 1;
  if (typeof v === 'number' && v > 20000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1; }
  const s = String(v == null ? '' : v), m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s) || /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) { const a = /^(\d{1,2})\/(\d{4})$/.exec(s.trim()); return a ? +a[2] * 100 + +a[1] : 0; }
  return m[1].length === 4 ? +m[1] * 100 + +m[2] : +m[3] * 100 + +m[2];
}

/* ---------- Junção 513 ---------- */
const J513_CLS = { COM: 'COM CREDITO', SEM: 'SEM CREDITO', AVA: 'AVALIAR' };
const J513_SAI = { SEM: 'NÃO TRIBUTA PC', AVA: 'AVALIAR', RISCO: 'RISCO' };
const CRED_PIS = 0.0165, CRED_COF = 0.076;

function lerJ513(headers, rows, files) {
  const hk = headers.map(normKey), ix = n => hk.indexOf(n);
  const I = { tipo: ix('tipo operacao'), chave: ix('chave nf e'), num: ix('numero documento'), data: ix('data documento'), per: ix('periodo'),
    mes: ix('mes'), part: ix('cnpj cpf participante'), cod: ix('codigo participante'), cfop: ix('cfop'), cfopCred: ix('cfop permite credito'),
    vlr: hk.findIndex(k => k.startsWith('vlr operacional')), vlrCon: ix('vlr item con'), eE: ix('existe efd'), eC: ix('existe con'), cnpj: ix('cnpj') };
  const sim = v => normKey(v) === 'sim';
  const notas = [];
  rows.forEach((r, i) => {
    const cfop = digits(r[I.cfop]); // sem CFOP (nota sem itens): fica na aba, mas não entra na análise
    const eEv = r[I.eE], eCv = r[I.eC];
    const n = {
      i, row: r, tipo: String(r[I.tipo] == null ? '' : r[I.tipo]).trim().startsWith('1') || /^[5-7]/.test(cfop) ? 'S' : 'E',
      ym: ymDe(r[I.per]) || ymDe(r[I.mes]) || ymDe(r[I.data]), chave: String(r[I.chave] || ''), num: String(r[I.num] || ''),
      data: r[I.data], part: digits(r[I.part]), cfop, vlr: toNum(r[I.vlr]) || 0, eE: sim(eEv), eC: sim(eCv),
      // anotação que a analista escreveu no lugar do "Não" (planilhas já trabalhadas), só para referência
      obs: !sim(eCv) && normKey(eCv) !== 'nao' && eCv != null && eCv !== '' ? String(eCv).trim() : (!sim(eEv) && normKey(eEv) !== 'nao' && eEv != null && eEv !== '' ? String(eEv).trim() : ''),
      ov: null
    };
    n.cand = !!cfop && n.eE && !n.eC; // está no EFD ICMS e não está no EFD-Contribuições
    notas.push(n);
  });
  const cnpj = I.cnpj >= 0 ? (rows.map(r => digits(r[I.cnpj])).find(c => c.length >= 11) || '') : '';
  return { headers, rows, I, notas, files, cnpj };
}

/* o que o fornecedor vende na 037: valor por classificação do Revisor e os produtos mais comprados */
function perfisFornecedor() {
  const a = S.tipo === 'ENT' ? S : (S.analyses.ENT && S.analyses.ENT.snap);
  if (!a || !a.recs || !a.map) return null;
  const iPart = a.map.cnpjPart, iCpf = a.map.cpfPart;
  if (iPart == null && iCpf == null) return null;
  const P = new Map();
  for (const rec of a.recs) {
    const c = digits((iPart != null && rec.v[iPart]) || (iCpf != null && rec.v[iCpf]) || ''); if (!c) continue;
    let p = P.get(c); if (!p) P.set(c, p = { n: 0, v: 0, com: 0, sem: 0, ava: 0, prod: new Map(), motSem: new Map() });
    const v = Math.abs(rec.vlrItem || 0) || 0.01, ja = (rec.vlrPis || 0) > 0;
    // item já com crédito na 037 ou classificado COM CREDITO pelo Revisor/analista = o fornecedor vende algo que gera crédito
    const cls = ja ? 'COM CREDITO' : (rec.ov || (rec.g ? (rec.g.dec || rec.g.sug.cls) : 'AVALIAR'));
    p.n++; p.v += v;
    if (cls === 'COM CREDITO') p.com += v; else if (cls === 'SEM CREDITO') { p.sem += v; const m = rec.g && rec.g.sug && rec.g.sug.motivo; if (m) p.motSem.set(m, (p.motSem.get(m) || 0) + v); } else p.ava += v;
    const k = (rec.ncm || '') + '|' + (rec.desc || '');
    p.prod.set(k, (p.prod.get(k) || 0) + v);
  }
  return { P, monthIdx: a.monthIdx };
}
const topProd = p => { let best = null, bv = -1; for (const [k, v] of p.prod) if (v > bv) { bv = v; best = k; } const [ncm, desc] = (best || '|').split('|'); return (desc ? desc.trim() : 'itens') + (ncm ? ' (NCM ' + ncm + ')' : ''); };
const topMot = p => { let best = '', bv = -1; for (const [k, v] of p.motSem) if (v > bv) { bv = v; best = k; } return best; };

const F3 = c => c.slice(1); // CFOP sem o primeiro dígito (1/2/3 = entrada interna/interestadual/exterior)
function sugJ513Ent(n, perf) {
  const c = F3(n.cfop);
  if (n.vlr <= 0) return { cls: J513_CLS.SEM, motivo: 'NOTA SEM VALOR', conf: 'a' };
  if (/^55[1-5]$/.test(c) || c === '406') return { cls: J513_CLS.SEM, motivo: 'ATIVO IMOBILIZADO: crédito pela depreciação, fora desta análise', conf: 'a' };
  if (/^9\d\d$/.test(c)) return { cls: J513_CLS.SEM, motivo: 'OUTRAS ENTRADAS, REMESSAS E RETORNOS (CFOP ' + n.cfop + ')', conf: 'a' };
  if (/^(20[1-9]|41[01])$/.test(c)) return { cls: J513_CLS.AVA, motivo: 'DEVOLUÇÃO DE VENDA: gera crédito só se a venda foi tributada', conf: 'b' };
  if (/^15\d$/.test(c)) return { cls: J513_CLS.AVA, motivo: 'TRANSFERÊNCIA ENTRE ESTABELECIMENTOS (CFOP ' + n.cfop + ')', conf: 'b' };
  if (/^11[67]$/.test(c)) return { cls: J513_CLS.AVA, motivo: 'ENTREGA FUTURA (CFOP ' + n.cfop + '): confira se o crédito já foi tomado na nota de faturamento (CFOP 1922/2922)', conf: 'b' };
  if (/^25\d$/.test(c)) return { cls: J513_CLS.COM, motivo: 'ENERGIA ELÉTRICA', conf: 'm' };
  if (/^35\d$/.test(c)) return { cls: J513_CLS.COM, motivo: 'SERVIÇO DE TRANSPORTE (FRETE)', conf: 'm' };
  if (/^30\d$/.test(c)) return { cls: J513_CLS.SEM, motivo: 'SERVIÇO DE COMUNICAÇÃO', conf: 'm' };
  // compras (revenda, industrialização, uso e consumo, combustível): decide pelo que o fornecedor vende na 037
  const p = perf && perf.P.get(n.part);
  if (!p) return { cls: J513_CLS.AVA, motivo: 'FORNECEDOR SEM NOTAS NA 037: confira os itens da nota', conf: 'b' };
  const sc = p.com / p.v, ss = p.sem / p.v, prod = topProd(p), qt = ' (' + p.n + ' ite' + (p.n === 1 ? 'm' : 'ns') + ' na 037)';
  if (sc >= 0.7) return { cls: J513_CLS.COM, motivo: 'FORNECEDOR VENDE ' + prod.toUpperCase() + ': com crédito na 037' + qt, conf: sc >= 0.95 ? 'm' : 'b' };
  if (ss >= 0.7) { const m = topMot(p); return { cls: J513_CLS.SEM, motivo: 'FORNECEDOR VENDE ' + prod.toUpperCase() + ': sem crédito na 037' + (m ? ' (' + m + ')' : '') + qt, conf: ss >= 0.95 ? 'm' : 'b' }; }
  if (sc + ss < 0.05) return { cls: J513_CLS.AVA, motivo: 'FORNECEDOR VENDE ' + prod.toUpperCase() + ': na 037 esses itens ainda estão para avaliar; decida lá e a 513 acompanha' + qt, conf: 'b' };
  return { cls: J513_CLS.AVA, motivo: 'FORNECEDOR VENDE ' + prod.toUpperCase() + ': ' + Math.round(sc * 100) + '% do valor com crédito e ' + Math.round(ss * 100) + '% sem crédito na 037' + qt, conf: 'b' };
}
function sugJ513Sai(n) {
  const c = F3(n.cfop);
  if (n.vlr <= 0) return { cls: J513_SAI.SEM, motivo: 'NOTA SEM VALOR', conf: 'a' };
  if (/^9\d\d$/.test(c)) return { cls: J513_SAI.SEM, motivo: 'REMESSA, RETORNO OU OUTRA SAÍDA SEM RECEITA (CFOP ' + n.cfop + ')', conf: 'a' };
  if (/^55\d$/.test(c)) return { cls: J513_SAI.SEM, motivo: 'ATIVO IMOBILIZADO OU USO E CONSUMO (CFOP ' + n.cfop + ')', conf: 'm' };
  if (/^(20[1-9]|41[01])$/.test(c)) return { cls: J513_SAI.SEM, motivo: 'DEVOLUÇÃO DE COMPRA: não é receita', conf: 'm' };
  if (/^15\d$/.test(c)) return { cls: J513_SAI.SEM, motivo: 'TRANSFERÊNCIA ENTRE ESTABELECIMENTOS', conf: 'm' };
  return { cls: J513_SAI.AVA, motivo: 'VENDA FORA DO EFD-CONTRIBUIÇÕES: confira se a receita foi oferecida a PIS/COFINS', conf: 'b' };
}

/* classifica as notas, calcula crédito e risco e monta o resumo */
function analisarJ513(j) {
  const perf = perfisFornecedor();
  j.comPerfil = !!perf;
  for (const n of j.notas) n.sug = !n.cand ? null : n.tipo === 'E' ? sugJ513Ent(n, perf) : sugJ513Sai(n);
  recalcJ513(j, perf);
  return j;
}
const clsJ = n => n.ov || (n.sug && n.sug.cls);
function recalcJ513(j, perf) {
  perf = perf || perfisFornecedor();
  const mi = perf && perf.monthIdx;
  const R = { notas: j.notas.length, ent: 0, sai: 0, soCon: 0, cand: { E: 0, S: 0 }, com: 0, base: 0, pis: 0, cof: 0, ava: { E: 0, S: 0 }, semE: 0, riscoBase: 0, porMotivo: new Map(), porAno: new Map() };
  for (const n of j.notas) {
    if (n.tipo === 'E') R.ent++; else R.sai++;
    if (!n.eE && n.eC) R.soCon++;
    n.cred = null;
    if (!n.cand) continue;
    R.cand[n.tipo]++;
    const cls = clsJ(n);
    if (cls === 'AVALIAR') R.ava[n.tipo]++;
    if (n.tipo === 'E' && cls === J513_CLS.COM) {
      // só nos meses não cumulativos (Lucro Real); sem a 037 carregada, considera não cumulativo
      const mo = mi && mi.get(n.ym);
      if (mo && mo.regime !== 'NC') { n.cred = { base: 0, pis: 0, cof: 0, cum: true }; continue; }
      n.cred = { base: r2(n.vlr), pis: r2(n.vlr * CRED_PIS), cof: r2(n.vlr * CRED_COF) };
      R.com++; R.base += n.cred.base; R.pis += n.cred.pis; R.cof += n.cred.cof;
      const a = Math.floor(n.ym / 100); const y = R.porAno.get(a) || { base: 0, pis: 0, cof: 0, n: 0 }; y.base += n.cred.base; y.pis += n.cred.pis; y.cof += n.cred.cof; y.n++; R.porAno.set(a, y);
    } else if (n.tipo === 'E' && cls === J513_CLS.SEM) R.semE++;
    if (n.tipo === 'S' && cls === J513_SAI.AVA) R.riscoBase += n.vlr;
    const mk = n.tipo + '|' + cls + '|' + (n.ov ? 'Decisão do analista' : n.sug.motivo.replace(/ \(\d+ ite(m|ns) na 037\)$/, '').replace(/\(CFOP \d+\)/, '').trim());
    const pm = R.porMotivo.get(mk) || { n: 0, v: 0 }; pm.n++; pm.v += n.vlr; R.porMotivo.set(mk, pm);
  }
  R.base = r2(R.base); R.pis = r2(R.pis); R.cof = r2(R.cof); R.riscoBase = r2(R.riscoBase);
  j.res = R;
  return R;
}

/* ---------- ECF 0000/0010 ---------- */
function lerECF(headers, rows, files) {
  const hk = headers.map(normKey), ix = n => hk.indexOf(n);
  const I = { ini: ix('periodo inicial'), fim: ix('periodo final'), trib: ix('forma tributacao'), apur: ix('forma apuracao'), est: ix('forma apuracao estimativa mensal'), per: ix('forma tributacao periodo'), qual: ix('qualificacao pj'), cnpj: ix('cnpj') };
  const limpa = v => String(v == null ? '' : v).replace(/^\s*\w+\s*[–-]\s*/, '').trim(); // "1 – Lucro Real" -> "Lucro Real"
  const anos = [];
  for (const r of rows) {
    const ym = ymDe(r[I.ini]); if (!ym) continue;
    const apur = String(r[I.apur] == null ? '' : r[I.apur]).trim().toUpperCase();
    anos.push({
      ano: Math.floor(ym / 100), ini: r[I.ini], fim: r[I.fim], trib: limpa(r[I.trib]), tribCod: String(r[I.trib] || '').trim().charAt(0),
      apur: apur.startsWith('A') ? 'ANUAL' : apur.startsWith('T') ? 'TRIMESTRAL' : limpa(r[I.apur]).toUpperCase(),
      // estimativa mensal (12 letras, uma por mês): E = receita bruta, B = balanço/balancete de suspensão ou redução
      est: String(r[I.est] || '').trim(), porPeriodo: String(r[I.per] || '').trim(), qual: limpa(r[I.qual])
    });
  }
  anos.sort((a, b) => a.ano - b.ano);
  const cnpj = I.cnpj >= 0 ? (rows.map(r => digits(r[I.cnpj])).find(c => c.length >= 11) || '') : '';
  return { anos, files, cnpj };
}
/* frase do regime de apuração para o Word: "ANUAL (2021 a 2024)" ou por ano quando muda */
function textoApuracao(ecf) {
  if (!ecf || !ecf.anos.length) return '';
  const grupos = []; for (const a of ecf.anos) { const g = grupos[grupos.length - 1]; const k = a.apur + (a.apur === 'ANUAL' && a.est ? (/^B+$/.test(a.est) ? ' (estimativa por balanço/balancete de suspensão ou redução)' : /^E+$/.test(a.est) ? ' (estimativa pela receita bruta)' : '') : ''); if (g && g.k === k && g.fim === a.ano - 1) g.fim = a.ano; else grupos.push({ k, ini: a.ano, fim: a.ano }); }
  return grupos.map(g => g.k + ' ' + (g.ini === g.fim ? 'em ' + g.ini : 'de ' + g.ini + ' a ' + g.fim)).join('; ');
}
const tribAtualECF = ecf => ecf && ecf.anos.length ? ecf.anos[ecf.anos.length - 1].trib.toUpperCase() : '';

/* ---------- guarda junto da empresa ---------- */
function guardarExtra(tipo, dados) {
  const c = digits(dados.cnpj || '');
  if (S.extras.cnpj && c && c !== S.extras.cnpj) S.extras = { cnpj: c, j513: null, ecf: null, ecd: S.extras.ecd && S.extras.ecd.cnpj === c ? S.extras.ecd : null };
  if (!S.extras.cnpj) S.extras.cnpj = c;
  if (tipo === 'J513') S.extras.j513 = analisarJ513(dados);
  if (tipo === 'ECF') S.extras.ecf = dados;
}
/* complementares só valem para a empresa que está na tela */
const extrasDaEmpresa = () => !S.extras.cnpj || !S.empresa.cnpj || digits(S.empresa.cnpj) === S.extras.cnpj ? S.extras : { j513: null, ecf: null, ecd: null };

/* ---------- Excel da Junção 513 ---------- */
async function buildWorkbookJ513(onProgress) {
  const j = S.extras.j513, R = recalcJ513(j), B = new XlsxBook();
  B.title = 'Junção 513 - Notas fora do EFD-Contribuições - ' + (S.empresa.nome || fmtCNPJ(S.extras.cnpj));
  const H = j.headers.map(h => h == null ? '' : String(h)), hk = H.map(normKey);
  const isV = hk.map(k => /^vlr /.test(k)), stOf = hk.map((k, i) => isV[i] ? XS.eBrlB : XS.bGen);
  const extra = ['CLASSIF.', 'MOTIVO', 'CONFIANÇA', 'ORIGEM', 'BASE DO CRÉDITO', 'PIS (1,65%)', 'COFINS (7,6%)'];
  const nH = H.length, cCls = colName(nH), cBase = colName(nH + 4), cVlr = colName(j.I.vlr);
  const cell = (n, k) => { const v = n.row[k]; return v == null || v === '' ? BLANK : (isV[k] ? (typeof v === 'number' ? v : toNum(v)) : v); };
  const aba = (nome, tipo) => {
    const lst = j.notas.filter(n => n.tipo === tipo);
    return {
      name: nome, grid: false, split: true, freeze: { row: 1 }, landscape: true, filterRef: 'A1:' + colName(nH + extra.length - 1) + (lst.length + 1),
      cols: H.map((h, i) => isV[i] ? 16 : null).concat([18, 60, 11, 12, 16, 14, 14]),
      dv: tipo === 'E' ? [{ sqref: cCls + '2:' + cCls + (lst.length + 1), list: [J513_CLS.COM, J513_CLS.SEM, J513_CLS.AVA] }] : [{ sqref: cCls + '2:' + cCls + (lst.length + 1), list: [J513_SAI.SEM, J513_SAI.AVA, J513_SAI.RISCO] }],
      rows: async (emit, y) => {
        emit(H.concat(extra), { s: H.map(() => XS.bHeadHl).concat(extra.map(() => XS.bHeadHl)) });
        for (let k = 0; k < lst.length; k++) {
          const n = lst[k], row = emit.proxima(), cls = n.cand ? clsJ(n) : '', s = n.sug;
          const cells = H.map((h, i) => cell(n, i));
          if (n.cand) {
            const orig = n.ov ? 'Analista' : 'Revisor';
            if (tipo === 'E') {
              const f = 'IF(' + cCls + row + '="' + J513_CLS.COM + '",' + cVlr + row + ',0)';
              cells.push(cls, n.ov ? 'Decisão do analista' : s.motivo, n.ov ? '—' : CONF[s.conf], orig, { v: n.cred ? n.cred.base : 0, f }, { v: n.cred ? n.cred.pis : 0, f: 'ROUND(' + cBase + row + '*1.65%,2)' }, { v: n.cred ? n.cred.cof : 0, f: 'ROUND(' + cBase + row + '*7.6%,2)' });
            } else cells.push(cls, n.ov ? 'Decisão do analista' : s.motivo, n.ov ? '—' : CONF[s.conf], orig);
          }
          emit(cells, { s: stOf.concat([XS.bGen, XS.bWrap, XS.bGen, XS.bGen, XS.eBrlB, XS.eBrlB, XS.eBrlB]) });
          if (k % 4000 === 3999) await y(Math.round(k / lst.length * 100));
        }
      }
    };
  };
  // resumo primeiro: é o que a analista leva para o relatório
  const cand = j.notas.filter(n => n.cand);
  B.addSheet({
    name: 'NOTAS NÃO ESCRITURADAS', tab: 'FF1C7A55', grid: false, cols: [4, 70, 12, 18, 18, 16, 16],
    rows: async (emit) => {
      emit([null, { v: 'Notas no EFD ICMS/IPI que não estão no EFD-Contribuições — ' + (S.empresa.nome || fmtCNPJ(S.extras.cnpj)), s: XS.title }], { ht: 26 });
      emit([null, { v: 'Junção 513 do SistemaMA (C100/C170). Crédito de 1,65% + 7,6% sobre o valor da nota nas entradas marcadas ' + J513_CLS.COM + ', só nos meses não cumulativos. Fonte: ' + j.files.join(', '), s: XS.note }]);
      emit([]);
      emit([null, 'Indicador', 'Notas', 'Valor das notas', 'Base do crédito', 'PIS', 'COFINS'], { s: [0, XS.headG, XS.headG, XS.headG, XS.headG, XS.headG, XS.headG] });
      const soma = (f) => cand.filter(f).reduce((a, n) => a + n.vlr, 0);
      emit([null, 'Notas de entrada só no EFD ICMS', { v: R.cand.E, s: XS.int }, { v: r2(soma(n => n.tipo === 'E')), s: XS.brl }]);
      emit([null, '   com crédito (' + J513_CLS.COM + ')', { v: R.com, s: XS.int }, null, { v: R.base, s: XS.brl }, { v: R.pis, s: XS.brl }, { v: R.cof, s: XS.brl }]);
      emit([null, '   sem crédito', { v: R.semE, s: XS.int }]);
      emit([null, '   para avaliar', { v: R.ava.E, s: XS.int }]);
      emit([null, 'Notas de saída só no EFD ICMS', { v: R.cand.S, s: XS.int }, { v: r2(soma(n => n.tipo === 'S')), s: XS.brl }]);
      emit([null, '   vendas para avaliar (possível receita sem PIS/COFINS)', { v: R.ava.S, s: XS.int }, { v: R.riscoBase, s: XS.brl }]);
      emit([null, 'Notas só no EFD-Contribuições (informativo)', { v: R.soCon, s: XS.int }]);
      emit([null, { v: 'Crédito de PIS/COFINS das notas não escrituradas', s: XS.bold }, null, null, { v: R.base, s: XS.brlB }, { v: R.pis, s: XS.brlB }, { v: r2(R.cof), s: XS.brlB }]);
      emit([null, { v: 'Total (PIS + COFINS)', s: XS.bold }, null, null, null, null, { v: r2(R.pis + R.cof), s: XS.brlTot }]);
      emit([]);
      emit([null, 'Por motivo', 'Notas', 'Valor das notas'], { s: [0, XS.headG, XS.headG, XS.headG] });
      for (const [k, m] of [...R.porMotivo].sort((a, b) => b[1].v - a[1].v)) { const [t, cls, mot] = k.split('|'); emit([null, (t === 'E' ? 'Entrada · ' : 'Saída · ') + cls + ' · ' + mot, { v: m.n, s: XS.int }, { v: r2(m.v), s: XS.brl }]); }
      if (R.porAno.size) {
        emit([]);
        emit([null, 'Crédito por ano', 'Notas', '', 'Base do crédito', 'PIS', 'COFINS'], { s: [0, XS.headG, XS.headG, XS.headG, XS.headG, XS.headG, XS.headG] });
        for (const [a, y] of [...R.porAno].sort((p, q) => p[0] - q[0])) emit([null, { v: String(a), s: XS.def }, { v: y.n, s: XS.int }, null, { v: r2(y.base), s: XS.brl }, { v: r2(y.pis), s: XS.brl }, { v: r2(y.cof), s: XS.brl }]);
      }
      emit([]);
      emit([null, { v: 'A sugestão vem do que o mesmo fornecedor vende nas notas da 037 (a 513 não traz os itens). Confira as notas marcadas AVALIAR e mude a coluna CLASSIF. nas abas ENTRADAS e SAÍDAS; os valores de cada nota se recalculam.', s: XS.note }]);
    }
  });
  B.addSheet(aba('ENTRADAS', 'E'));
  B.addSheet(aba('SAÍDAS', 'S'));
  return B.build(onProgress);
}
const arquivoJ513 = () => 'Junção 513 - Notas não escrituradas - ' + nomeArq() + '.xlsx';
