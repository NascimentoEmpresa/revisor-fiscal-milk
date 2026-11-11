/* ======================= planilhas complementares do SistemaMA =======================
   Ficam ao lado das análises da 037 e da 047 (mesma empresa) e alimentam o Excel próprio e o Word:
   - Junção 513 (EFD ICMS/IPI + EFD-Contribuições, C100/C170, "Todos os Documentos e CFOP - Resumido"):
     notas que estão no EFD ICMS mas não no EFD-Contribuições. Nas entradas, viram crédito de PIS/COFINS
     não aproveitado ("notas não escrituradas"); nas saídas, risco de receita sem PIS/COFINS.
   - ECF 0000/0010 (Identificação PJ e Parâmetros de Tributação): forma de tributação e de apuração por ano.
   A classificação das notas da 513 usa o que o MESMO fornecedor vende nas notas da 037 (NCM, descrição e a
   classificação do Revisor), porque a 513 não traz os itens da nota. */

S.extras = { cnpj: '', j513: null, ecf: null, ecd: null, ecdA: null, icmsS: null, icmsE: null, ie0150: null };

/* reconhece a planilha complementar pelo cabeçalho (normalizado por normKey) */
function tipoExtra(hk) {
  if (hk.includes('existe efd') && hk.includes('existe con') && hk.some(k => k.startsWith('vlr operacional'))) return 'J513';
  if (hk.includes('forma tributacao') && hk.includes('forma apuracao') && hk.includes('periodo inicial')) return 'ECF';
  if (hk.includes('vlr partida') && hk.includes('d c') && hk.includes('tipo lancamento') && hk.includes('conta')) return 'ECD';
  if (hk.includes('cst icms') && hk.includes('indicador emitente') && hk.includes('uf origem destino') && hk.includes('vlr icms')) return 'ICMS';
  if (hk.includes('cnpj fonte pagadora') && hk.includes('vlr ir retido fonte')) return 'Y570';
  if (hk.includes('cnpj fonte pagadora') && hk.includes('vlr imposto retido') && hk.includes('ano calendario')) return 'DIRF';
  return null;
}
const EXTRA_NOME = { REPETIDO: 'Repetido: lido uma vez só', PERDCOMP: 'PER/DCOMP (PDF do e-CAC)', Y570: 'ECF Y570 · IR e CSLL retidos na fonte', DIRF: 'e-CAC · Rendimentos e imposto retido (DIRF)', J513: 'Junção 513 · EFD ICMS × Contribuições', ECF: 'ECF 0000/0010 · Parâmetros de tributação', ECD: 'ECD · I200/I250 Partidas de lançamento', ICMS: 'EFD ICMS/IPI · 069/070', SPED: 'SPED EFD ICMS/IPI · 0150' };

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
  if (S.extras.cnpj && c && c !== S.extras.cnpj) S.extras = { cnpj: c, j513: null, ecf: null, ecdA: null, icmsS: null, icmsE: null, ie0150: null, ret: null, perdcomp: null, ecd: S.extras.ecd && S.extras.ecd.cnpj === c ? S.extras.ecd : null };
  if (!S.extras.cnpj) S.extras.cnpj = c;
  if (tipo === 'J513') S.extras.j513 = analisarJ513(dados);
  if (tipo === 'ECF') { S.extras.ecf = dados; if (S.extras.ecdA) analisarECD(S.extras.ecdA); }
  if (tipo === 'ECD') S.extras.ecdA = analisarECD(dados);
  if (tipo === 'ICMS') { if (dados.tipo === 'S') S.extras.icmsS = analisarICMS(Object.assign(dados, { corte: dados.corte || (S.extras.icmsS ? S.extras.icmsS.corte : null) })); else S.extras.icmsE = dados; }
  if (tipo === 'ECF' && S.extras.icmsS) analisarICMS(S.extras.icmsS);
  if (tipo === 'PERDCOMP') { const L = S.extras.perdcomp || (S.extras.perdcomp = []); if (!L.some(x => x.num === dados.num)) L.push(dados); L.sort((a, b) => (a.ymT || 0) - (b.ymT || 0)); }
  if (tipo === 'Y570' || tipo === 'DIRF') { const r = S.extras.ret || (S.extras.ret = { y570: null, dirf: null }); r[tipo === 'Y570' ? 'y570' : 'dirf'] = dados; }
}
/* complementares só valem para a empresa que está na tela */
const extrasDaEmpresa = () => !S.extras.cnpj || !S.empresa.cnpj || digits(S.empresa.cnpj) === S.extras.cnpj ? S.extras : { j513: null, ecf: null, ecd: null, ecdA: null, icmsS: null, icmsE: null, ie0150: null, ret: null, perdcomp: null };

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

/* ---------- retenções na fonte: ECF Y570 (o que a empresa escriturou) x e-CAC / DIRF (o que as fontes pagadoras informaram) ---------- */
function lerY570(headers, rows, files) {
  const hk = headers.map(normKey), ix = n => hk.indexOf(n), I = { ano: ix('ano'), per: ix('periodo inicial'), fonte: ix('cnpj fonte pagadora'), nome: ix('nome fonte pagadora'), cod: ix('codigo receita'), desc: ix('descricao codigo receita'), rend: ix('vlr rendimento bruto'), ir: ix('vlr ir retido fonte'), csll: ix('vlr csll retido fonte'), cnpj: ix('cnpj') };
  const L = []; for (const r of rows) { const f = digits(r[I.fonte]); if (!f) continue; const ano = +(String(r[I.ano] || '').slice(0, 4)) || Math.floor((ymDe(r[I.per]) || 0) / 100); L.push({ ano, fonte: f.padStart(14, '0'), nome: String(r[I.nome] || '').trim(), cod: digits(r[I.cod]), desc: String(r[I.desc] || '').trim(), rend: toNum(r[I.rend]), ir: toNum(r[I.ir]), csll: toNum(r[I.csll]) }); }
  const cnpj = I.cnpj >= 0 ? (rows.map(r => digits(r[I.cnpj])).find(c => c.length >= 11) || '') : '';
  return { L, files, cnpj };
}
function lerDIRF(headers, rows, files) {
  const hk = headers.map(normKey), ix = n => hk.indexOf(n), I = { ano: ix('ano calendario'), fonte: ix('cnpj fonte pagadora'), nome: ix('razao social fonte pagadora'), cod: ix('codigo receita'), desc: ix('descricao codigo darf'), rend: ix('vlr rendimento tributavel'), imp: ix('vlr imposto retido'), cnpj: ix('cnpj beneficiario') };
  const L = []; for (const r of rows) { const f = digits(r[I.fonte]); if (!f) continue; L.push({ ano: +String(r[I.ano] || '').slice(0, 4), fonte: f.padStart(14, '0'), nome: String(r[I.nome] || '').trim(), cod: digits(r[I.cod]), desc: String(r[I.desc] || '').trim(), rend: toNum(r[I.rend]), imp: toNum(r[I.imp]) }); }
  const cnpj = I.cnpj >= 0 ? (rows.map(r => digits(r[I.cnpj])).find(c => c.length >= 11) || '') : '';
  return { L, files, cnpj };
}
/* retenção informada na DIRF e não escriturada na ECF (mesmo ano, fonte pagadora e código) */
function analisarRetencoes() {
  const r = extrasDaEmpresa().ret; if (!r || !r.dirf) return null;
  const chave = x => x.ano + '|' + x.fonte.slice(0, 8) + '|' + x.cod, ecf = new Set(r.y570 ? r.y570.L.map(chave) : []);
  const faltam = new Map(); let tot = 0, totDirf = 0;
  for (const x of r.dirf.L) { totDirf += x.imp; if (!r.y570 || ecf.has(chave(x)) || !(x.imp > 0)) continue; const a = faltam.get(x.ano) || { ano: x.ano, imp: 0, n: 0, fontes: new Set() }; a.imp += x.imp; a.n++; a.fontes.add(x.nome); faltam.set(x.ano, a); tot += x.imp; }
  return { comY570: !!r.y570, faltam: [...faltam.values()].sort((a, b) => a.ano - b.ano).map(a => Object.assign(a, { imp: r2(a.imp), fontes: [...a.fontes] })), tot: r2(tot), totDirf: r2(totDirf), anos: [...new Set(r.dirf.L.map(x => x.ano))].sort(), nEcf: r.y570 ? r.y570.L.length : 0 };
}

/* ---------- PER/DCOMP (PDF do e-CAC): texto das páginas -> dados do pedido ---------- */
let _pdfjs = null;
function carregarPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjs) return _pdfjs;
  const um = (id, src) => new Promise((ok, erro) => { const s = document.createElement('script'), emb = document.getElementById(id); if (emb) { s.textContent = emb.textContent; document.head.appendChild(s); ok(); } else { s.src = src; s.onload = ok; s.onerror = () => erro(new Error('não foi possível carregar o leitor de PDF')); document.head.appendChild(s); } });
  // o "worker" roda na própria página (pdfjsWorker global): não precisa de Worker nem de outro domínio
  _pdfjs = um('rf-pdfjs-worker', '/vendor/pdf.worker.min.js').then(() => um('rf-pdfjs', '/vendor/pdf.min.js')).then(() => window.pdfjsLib);
  return _pdfjs;
}
async function pdfLinhas(file) {
  const lib = await carregarPdfjs(), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise, out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent(), L = new Map();
    for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const y = Math.round(it.transform[5]); let k = [...L.keys()].find(z => Math.abs(z - y) <= 2); if (k == null) { k = y; L.set(k, []); } L.get(k).push(it); }
    for (const y of [...L.keys()].sort((a, b) => b - a)) out.push(L.get(y).sort((a, b) => a.transform[4] - b.transform[4]).map(t => t.str.trim()).join(' | '));
  }
  return out;
}
function lerPerdcomp(lines, nome) {
  const txt = lines.join('\n'); if (!/PERDCOMP|PER\/DCOMP/i.test(txt) || !/Tipo de Cr[ée]dito/i.test(txt)) return null;
  const campo = (re, desde = 0) => { for (let i = desde; i < lines.length; i++) { const p = lines[i].split(' | '); if (re.test(p[0])) return p.slice(1).join(' ').trim() || null; } return null; };
  let iOrig = lines.findIndex(l => /^ORIGEM DO CR[ÉE]DITO/i.test(l)); if (iOrig < 0) iOrig = lines.findIndex(l => /^CR[ÉE]DITO [A-ZÇÃÉ ]{6,}$/.test(l.trim())); // PER/DCOMP 8.0: sem o título ORIGEM
  const num = (txt.match(/\d{5}\.\d{5}\.\d{6}\.\d\.\d\.\d{2}-\d{4}/) || [])[0] || nome;
  const dt = campo(/^Data de Transmiss[ãa]o$/i), pa = iOrig >= 0 ? (lines.slice(iOrig).map(l => l.split(' | ')).find(p => p.some(x => /^Per[ií]odo de Apura[çc][ãa]o$/i.test(x))) || []).slice(-1)[0] : null;
  const debitos = lines.map(l => /^\d{3}\. \| (D[ée]bito .+)$/i.exec(l) || /^\d{3}\. (D[ée]bito .+)$/i.exec(l)).filter(Boolean).map(m => m[1].replace(/ \| /g, ' ').trim());
  const ymDt = v => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(v || ''); return m ? +m[3] * 100 + +m[2] : 0; };
  return { num, files: [nome], cnpj: digits((txt.match(/CNPJ (\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) || [])[1] || ''), transm: dt, ymT: ymDt(dt),
    tipoDoc: campo(/^Tipo de Documento$/i), tipoCred: campo(/^Tipo de Cr[ée]dito$/i), retif: campo(/^PER\/DCOMP Retificador$/i), judicial: campo(/^Cr[ée]dito Oriundo de A[çc][ãa]o Judicial$/i),
    valor: toNum(campo(/^Valor Original do Cr[ée]dito Inicial$/i)), atualizado: toNum(campo(/^Cr[ée]dito Atualizado$/i)), debitosTot: toNum(campo(/^Total dos D[ée]bitos deste Documento$/i)),
    pa, ymPA: ymDt(pa), tributo: iOrig >= 0 ? campo(/^Grupo de Tributo$/i, iOrig) : null, codigo: iOrig >= 0 ? campo(/^C[óo]digo da Receita$/i, iOrig) : null, debitos };
}
/* PER/DCOMP x pontos do diagnóstico: o crédito pedido é do mesmo tributo e período de algum ponto? */
function analisarPerdcomp() {
  const L = extrasDaEmpresa().perdcomp; if (!L || !L.length) return null;
  const Sa = resumoDe('SAI'), ex = analisarExclusao(), an = analisarAnulacoes(), faixas = [];
  if (ex && ex.n) faixas.push({ t: 'exclusão do ICMS da base do PIS/COFINS', mi: ex.mi, ma: ex.ma });
  if (an && an.n) faixas.push({ t: 'anulação de CT-e', mi: an.mi, ma: an.ma });
  if (Sa && Sa.cats) for (const c of Sa.cats) if (c.pis + c.cof > 0) faixas.push({ t: 'PIS/COFINS sobre ' + c.cat.toLowerCase(), mi: c.mi, ma: c.ma });
  for (const p of L) { p.conflito = /pis|cofins/i.test(p.tributo || '') && p.ymPA ? faixas.filter(f => p.ymPA >= f.mi && p.ymPA <= f.ma).map(f => f.t) : []; }
  return { L, conflitos: L.filter(p => p.conflito.length) };
}
