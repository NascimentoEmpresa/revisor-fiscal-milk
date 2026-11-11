/* ======================= ECD (I200/I250 · Partidas de Lançamento) =======================
   Regra da analista da Milk (áudio e mensagens de 10/11/2026, conferida no exemplo MAXXI):
   1. Na ECD, as contas de despesa que podem dar crédito pelas hipóteses do art. 3º das Leis 10.637/2002 e
      10.833/2003 (energia, aluguel, combustível, depreciação, fretes...) e o que for essencial e relevante à atividade.
   2. Tabela por conta contábil com a soma dos lançamentos: débitos normais (sem o encerramento do exercício),
      só nos meses em que a empresa estava no regime não cumulativo (Lucro Real).
   3. "Já utilizado": na 037, a base de cálculo do PIS das notas COM crédito na mesma conta contábil; os bens do
      ativo (F120/F130) vão para a conta de depreciação.
   4. Diferença × 9,25% = crédito a recuperar, que a analista confere (enquadramento e documentos). */

const ECD_CLS = { SIM: 'INCLUIR', AVA: 'AVALIAR', NAO: 'NÃO INCLUIR' };
/* palavras da descrição da conta -> categoria. Ordem importa: a primeira que casar vale. */
const ECD_REGRAS = [
  // fora: folha, tributos, financeiras, penalidades, contas redutoras
  { re: /^\(-\)|^\(\s*-\s*\)|devolu|estorno|redutor|\bdedu/, cat: 'Conta redutora ou devolução', cls: 'NAO' },
  { re: /sal[aá]rio|ordenado|f[eé]rias|13[ºo°]|d[eé]cimo|inss|fgts|pr[oó][ -]?labore|indeniza|aviso pr[eé]vio|rescis|encargos sociais|provis[aã]o de f[eé]rias|provis[aã]o 13|gratifica|hora extra|comiss[oõ]es? s\/ vendas/, cat: 'Folha de pagamento e encargos', cls: 'NAO' },
  { re: /\bicms\b|\bpis\b|cofins|\bipi\b|\biss\b|ipva|iptu|irpj|csll|imposto|tributo|taxas? diversas|contribui[cç][aã]o sindical/, cat: 'Tributos', cls: 'NAO' },
  { re: /juros|iof|banc[aá]ri|financeir|cobran[cç]a|desconto|varia[cç][aã]o cambial|empr[eé]stimo|financiamento|aplica[cç]/, cat: 'Despesas e receitas financeiras', cls: 'NAO' },
  { re: /multa|infra[cç]|perda|ganho|aliena[cç]|doa[cç]|brinde|patroc[ií]nio/, cat: 'Multas, perdas, alienações e liberalidades', cls: 'NAO' },
  { re: /assist[eê]ncia m[eé]dica|plano de sa[uú]de|alimenta[cç]|refei[cç]|vale.?transporte|cesta|seguro de vida/, cat: 'Benefícios a empregados (crédito só em casos específicos)', cls: 'NAO' },
  { re: /telefon|internet|comunica[cç]|correio|material de escrit|honor[aá]rios cont|advocat|consultoria|propaganda|publicidade|marketing|viagens?|hospedag|representa[cç]/, cat: 'Despesas administrativas e comerciais', cls: 'NAO' },
  // hipóteses expressas do art. 3º
  { re: /energia el[eé]tric|energia\b|luz e for[cç]a/, cat: 'Energia elétrica (art. 3º, III)', cls: 'SIM' },
  { re: /arrendamento mercantil|leasing/, cat: 'Arrendamento mercantil (art. 3º, V)', cls: 'SIM' },
  { re: /alugu[eé]l|loca[cç][aã]o de (pr[eé]dio|im[oó]v|m[aá]quina|equip|ve[ií]cul)/, cat: 'Aluguéis (art. 3º, IV): só dá crédito se pago a pessoa jurídica', cls: 'AVA' },
  { re: /deprecia|amortiza/, cat: 'Depreciação e amortização (art. 3º, VI e VII)', cls: 'SIM' },
  { re: /combust[ií]v|lubrific|diesel|gasolina|[oó]leo/, cat: 'Combustíveis e lubrificantes (art. 3º, II)', cls: 'SIM' },
  { re: /frete|carreto|armazenag|transporte de (carga|mercad)/, cat: 'Fretes e armazenagem (art. 3º, IX)', cls: 'SIM' },
  { re: /manuten[cç]|conserva[cç]|pe[cç]as|pneu|repara[cç]|oficina/, cat: 'Manutenção, peças e pneus (insumo)', cls: 'SIM' },
  // dependem da atividade: essencial ou relevante (STJ, REsp 1.221.170)
  { re: /material de uso|uso e consumo|material de consumo|insumo|mat[eé]ria.?prima|embalag/, cat: 'Material de uso e consumo e insumos (essencial ou relevante)', cls: 'AVA' },
  { re: /servi[cç]os? (de )?terceiros|servi[cç]os tomados|m[aã]o de obra terceir|terceiriza/, cat: 'Serviços de terceiros PJ (essencial ou relevante)', cls: 'AVA' },
  { re: /ped[aá]gio/, cat: 'Pedágio (essencial em transporte)', cls: 'AVA' },
  { re: /seguro/, cat: 'Seguros (essencial conforme a atividade)', cls: 'AVA' },
  { re: /ve[ií]culo|frota|caminh/, cat: 'Despesas com veículos (essencial conforme a atividade)', cls: 'AVA' },
  { re: /uniforme|\bepi\b|equipamento de prote|seguran[cç]a do trabalho|limpeza|higien|dedetiza|vigil[aâ]ncia/, cat: 'Uniformes, EPI, limpeza e segurança (essencial conforme a atividade)', cls: 'AVA' },
  { re: /servi[cç]os? de transporte|subcontrat|agregado/, cat: 'Serviços de transporte contratados (essencial conforme a atividade)', cls: 'AVA' }
];
function categoriaConta(desc) {
  const d = String(desc || '').toLowerCase().normalize('NFC');
  for (const r of ECD_REGRAS) if (r.re.test(d)) return { cat: r.cat, cls: ECD_CLS[r.cls] };
  return { cat: 'Sem regra: confira a natureza da conta', cls: ECD_CLS.AVA };
}

function lerECD(headers, rows, files) {
  const hk = headers.map(normKey), ix = n => hk.indexOf(n);
  const I = { per: ix('periodo'), data: ix('data lancamento'), tipo: ix('tipo lancamento'), conta: ix('conta'), nat: ix('natureza conta'), desc: ix('descricao conta societaria'),
    vlr: ix('vlr partida'), dc: ix('d c'), num: ix('numero lancamento'), hist: ix('descricao historico'), cnpj: ix('cnpj') };
  const contas = new Map(); let ymMin = 999999, ymMax = 0;
  rows.forEach((r, i) => {
    if (!String(r[I.nat] || '').trim().startsWith('04')) return; // só contas de resultado
    const conta = String(r[I.conta] == null ? '' : r[I.conta]).trim(); if (!conta) return;
    const ym = ymDe(r[I.per]) || ymDe(r[I.data]); if (!ym) return;
    if (ym < ymMin) ymMin = ym; if (ym > ymMax) ymMax = ym;
    let c = contas.get(conta);
    if (!c) contas.set(conta, c = { conta, desc: String(r[I.desc] || '').trim(), meses: new Map(), linhas: [] });
    const enc = /^e/i.test(String(r[I.tipo] || '').trim()), d = String(r[I.dc] || '').trim().toUpperCase() === 'D', v = toNum(r[I.vlr]) || 0;
    const m = c.meses.get(ym) || { d: 0, c: 0, enc: 0, n: 0 };
    if (enc) m.enc += v; else if (d) { m.d += v; c.linhas.push(i); } else m.c += v;
    m.n++; c.meses.set(ym, m);
  });
  for (const c of contas.values()) { const s = categoriaConta(c.desc); c.cat = s.cat; c.sug = s.cls; c.ov = null; }
  const cnpj = I.cnpj >= 0 ? (rows.map(r => digits(r[I.cnpj])).find(c => c.length >= 11) || '') : '';
  return { headers, rows, I, contas, files, cnpj, ymMin, ymMax, anosOff: new Set(), atrib: {} };
}

const clsConta = c => c.ov || c.sug;
/* meses em que a empresa estava no não cumulativo: pela 037 (regime do mês) ou, sem ela, pelos anos de Lucro Real da ECF */
function mesesNC() {
  const a = S.tipo === 'ENT' ? S : (S.analyses.ENT && S.analyses.ENT.snap);
  if (a && a.monthIdx && a.monthIdx.size) { const s = new Set(); for (const [ym, m] of a.monthIdx) if (m.regime === 'NC') s.add(ym); return { meses: s, fonte: '037' }; }
  const ecf = S.extras.ecf;
  if (ecf && ecf.anos.length) { const anos = new Set(ecf.anos.filter(x => /real/i.test(x.trib)).map(x => x.ano)); return { anos, fonte: 'ECF' }; }
  return null;
}
/* "já utilizado" na 037: base do PIS das notas com crédito, por conta contábil (F120/F130 = bens do ativo) */
function jaUtilizado037() {
  const a = S.tipo === 'ENT' ? S : (S.analyses.ENT && S.analyses.ENT.snap);
  if (!a || !a.recs || !a.map || a.map.contaCtb == null) return null;
  const P = new Map(), iN = a.map.nomeCtb, iNat = a.hkey ? a.hkey.indexOf('natureza credito') : -1;
  for (const r of a.recs) {
    if (!((r.vlrPis || 0) > 0)) continue;
    const ativo = /^F1[23]0/.test(r.registro);
    const k = ativo ? '#ATIVO' : String(r.v[a.map.contaCtb] == null ? '' : r.v[a.map.contaCtb]).trim() || '#SEM';
    const p = P.get(k) || { conta: k, nome: ativo ? 'Bens do ativo imobilizado (F120/F130)' : (iN != null ? String(r.v[iN] || '').trim() : ''), base: 0, n: 0, anos: new Map() };
    p.base += r.bcPis || 0; p.n++; p.anos.set(r.ano, (p.anos.get(r.ano) || 0) + (r.bcPis || 0)); P.set(k, p);
    // natureza do crédito (04 energia, 09/10/11 ativo...): serve quando a conta da 037 não existe na ECD (ex.: conta "GERAL")
    const nat = iNat >= 0 ? String(r.v[iNat] || '').trim().slice(0, 2) : '';
    if (!p.nats) p.nats = new Map(); const pn = p.nats.get(nat) || new Map(); pn.set(r.ano, (pn.get(r.ano) || 0) + (r.bcPis || 0)); p.nats.set(nat, pn);
  }
  return P;
}
function analisarECD(e) {
  const nc = mesesNC(), ja = jaUtilizado037();
  e.fonteRegime = nc ? nc.fonte : null; e.com037 = !!ja;
  const noEscopo = ym => !e.anosOff.has(Math.floor(ym / 100)) && (!nc || (nc.meses ? nc.meses.has(ym) : nc.anos.has(Math.floor(ym / 100))));
  const anos = new Set(); for (const c of e.contas.values()) for (const ym of c.meses.keys()) anos.add(Math.floor(ym / 100));
  e.anos = [...anos].sort();
  e.anosEscopo = e.anos.filter(a => !e.anosOff.has(a) && (!nc || (nc.meses ? [...nc.meses].some(ym => Math.floor(ym / 100) === a) : nc.anos.has(a))));
  const depr = [...e.contas.values()].find(c => /deprecia/i.test(c.desc) && clsConta(c) !== ECD_CLS.NAO);
  for (const c of e.contas.values()) {
    let d = 0, cr = 0, enc = 0, dT = 0, cT = 0;
    for (const [ym, m] of c.meses) { dT += m.d; cT += m.c; if (noEscopo(ym)) { d += m.d; cr += m.c; enc += m.enc; } }
    c.valor = r2(d); c.estornos = r2(cr); c.despesa = dT >= cT; // conta de despesa: débitos normais maiores que os créditos normais
    c.ja = 0; c.jaDe = [];
  }
  // já utilizado: mesma conta contábil; bens do ativo na conta de depreciação; as demais, como a analista atribuir
  e.semConta = [];
  const NAT_ALVO = { '04': /energia|luz e for/i, '05': /alugu|loca[cç]/i, '06': /alugu|loca[cç]/i, '08': /arrendamento|leasing/i, '07': /frete|carreto|armazen/i, '14': /frete|carreto|transporte/i, '09': /deprecia/i, '10': /deprecia/i, '11': /deprecia|amortiza/i };
  const contaNat = nat => { const re = NAT_ALVO[nat]; if (!re) return null; return [...e.contas.values()].filter(c => re.test(c.desc) && c.despesa && clsConta(c) !== ECD_CLS.NAO).sort((a, b) => b.valor - a.valor)[0] || null; };
  if (ja) for (const p0 of ja.values()) {
    // conta da 037 que não existe na ECD: reparte pela natureza do crédito, sem decisão manual
    const parts = p0.conta !== '#ATIVO' && !e.contas.has(p0.conta) && !(e.atrib[p0.conta] != null) && p0.nats && p0.nats.size ? [...p0.nats].map(([nat, anos]) => ({ conta: p0.conta + (nat ? ' · natureza ' + nat : ''), nome: p0.nome, n: p0.n, anos, nat, porNat: contaNat(nat) })) : [p0];
    for (const p of parts) {
    let base = 0; for (const [ano, v] of p.anos) if (e.anosEscopo.includes(ano)) base += v;
    if (!base) continue;
    const manual = e.atrib[p.conta] != null && e.atrib[p.conta] !== '';
    let alvo = manual ? e.contas.get(e.atrib[p.conta]) : e.atrib[p.conta] === '' ? null : p.conta === '#ATIVO' ? depr : p.porNat !== undefined ? p.porNat : e.contas.get(p.conta);
    if (alvo && !manual && (!alvo.despesa || clsConta(alvo) === ECD_CLS.NAO)) alvo = null; // conta de receita ou fora da análise: a analista decide
    if (alvo) { alvo.ja = r2(alvo.ja + base); alvo.jaDe.push(p.conta === '#ATIVO' ? 'bens do ativo (F120)' : p.porNat !== undefined ? 'natureza ' + p.nat + ' da 037' : 'conta ' + p.conta); }
    if (!alvo || manual) e.semConta.push({ conta: p.conta, nome: p.nome, base: r2(base), n: p.n, atrib: e.atrib[p.conta] });
    }
  }
  recalcECD(e);
  return e;
}
function recalcECD(e) {
  const R = { contas: 0, sim: 0, ava: 0, valor: 0, ja: 0, dif: 0, pis: 0, cof: 0 };
  for (const c of e.contas.values()) {
    if (!c.despesa || !c.valor) continue;
    R.contas++;
    const cls = clsConta(c);
    if (cls === ECD_CLS.AVA) R.ava++;
    if (cls !== ECD_CLS.SIM) continue;
    const v = c.ajuste != null ? c.ajuste : c.valor; R.sim++; R.valor += v; R.ja += c.ja; R.dif += v - c.ja; // como a analista: a diferença negativa também entra no total
  }
  R.valor = r2(R.valor); R.ja = r2(R.ja); R.dif = r2(R.dif);
  // como a analista: 9,25% de uma vez sobre a diferença; o PIS é 1,65% e a COFINS o restante (fecha no centavo)
  R.base = Math.max(0, R.dif); R.total = r2(R.base * (CRED_PIS + CRED_COF)); R.pis = r2(R.base * CRED_PIS); R.cof = r2(R.total - R.pis);
  e.res = R; return R;
}

/* ---------- Excel da ECD ---------- */
async function buildWorkbookECD(onProgress) {
  const e = S.extras.ecdA, R = recalcECD(e), B = new XlsxBook();
  B.title = 'ECD x EFD-Contribuições - ' + (S.empresa.nome || fmtCNPJ(S.extras.cnpj));
  const sel = [...e.contas.values()].filter(c => c.despesa && c.valor && clsConta(c) === ECD_CLS.SIM).sort((a, b) => a.desc.localeCompare(b.desc, 'pt-BR'));
  const anosTxt = e.anosEscopo.join(', ');
  // 1. a dinâmica da analista: conta, valor na ECD, já utilizado na 037, diferença
  B.addSheet({
    name: 'DINAMICA ECD x EFD', tab: 'FF1C7A55', grid: false, cols: [34, 18, 18, 18, 46],
    rows: async (emit) => {
      emit([{ v: 'Créditos da ECD não aproveitados no EFD-Contribuições — ' + (S.empresa.nome || fmtCNPJ(S.extras.cnpj)), s: XS.title }], { ht: 24 });
      emit([{ v: 'ECD (I200/I250): débitos normais das contas de despesa em ' + anosTxt + ' (sem o encerramento). Já utilizado: base do PIS das notas com crédito da 037 na mesma conta (bens do ativo na depreciação). Fonte: ' + e.files.join(', '), s: XS.note }]);
      emit([]);
      const h0 = emit(['Rótulos de Linha', 'Soma de Vlr Partida', 'já utilizado', 'diferença', 'origem do já utilizado'], { s: XS.headG });
      for (const c of sel) { const row = emit.proxima(), v = c.ajuste != null ? c.ajuste : c.valor; emit([c.desc, { v, s: XS.brl }, { v: c.ja, s: XS.brl }, { v: r2(v - c.ja), f: 'B' + row + '-C' + row, s: XS.brl }, (c.jaDe.join(', ') || '—') + (c.ajuste != null ? ' · valor ajustado pela analista (na ECD: ' + fBRL(c.valor) + ')' : '')]); }
      const tr = emit.proxima();
      emit([{ v: 'Total Geral', s: XS.txtB }, { v: R.valor, f: 'SUM(B' + (h0 + 1) + ':B' + (tr - 1) + ')', s: XS.brlB }, { v: R.ja, f: 'SUM(C' + (h0 + 1) + ':C' + (tr - 1) + ')', s: XS.brlB }, { v: R.dif, f: 'SUM(D' + (h0 + 1) + ':D' + (tr - 1) + ')', s: XS.brlB }]);
      emit([]);
      const cr = emit(['Crédito (9,25% da diferença)', null, null, { v: R.total, f: 'ROUND(MAX(0,D' + tr + ')*9.25%,2)', s: XS.brlTot }]);
      emit(['   PIS (1,65%)', null, null, { v: R.pis, f: 'ROUND(MAX(0,D' + tr + ')*1.65%,2)', s: XS.brl }]);
      emit(['   COFINS (7,6%)', null, null, { v: R.cof, f: 'D' + cr + '-D' + (cr + 1), s: XS.brl }]);
      if (e.semConta.length) {
        emit([]);
        emit([{ v: 'Créditos da 037 em contas fora da tabela (não entram no já utilizado)', s: XS.bold }]);
        emit(['Conta na 037', 'Base do PIS', 'notas'], { s: XS.headG });
        for (const s of e.semConta) emit([s.conta + (s.nome ? ' · ' + s.nome : ''), { v: s.base, s: XS.brl }, { v: s.n, s: XS.int }]);
      }
      emit([]);
      emit([{ v: 'O fato de um valor não constar como crédito no EFD-Contribuições não significa que seja recuperável: confira o enquadramento legal e os documentos.', s: XS.note }]);
    }
  });
  // 2. todas as contas de despesa com a decisão
  const todas = [...e.contas.values()].filter(c => c.despesa && c.valor).sort((a, b) => b.valor - a.valor);
  B.addSheet({
    name: 'CONTAS DE RESULTADO', grid: false, freeze: { row: 1 }, cols: [12, 40, 14, 56, 18, 18, 18], filterRef: 'A1:G' + (todas.length + 1),
    dv: todas.length ? [{ sqref: 'C2:C' + (todas.length + 1), list: [ECD_CLS.SIM, ECD_CLS.AVA, ECD_CLS.NAO] }] : [],
    rows: async (emit) => {
      emit(['Conta', 'Descrição', 'Decisão', 'Categoria', 'Débitos (ECD)', 'Estornos (créditos)', 'Já utilizado (037)'], { s: XS.bHeadHl });
      for (const c of todas) emit([c.conta, c.desc, clsConta(c), c.ov ? 'Decisão do analista' : c.cat, { v: c.valor, s: XS.eBrlB }, { v: c.estornos, s: XS.eBrlB }, { v: c.ja, s: XS.eBrlB }], { s: XS.bGen });
    }
  });
  // 3. lançamentos das contas incluídas, no período (como a aba "SOMENTE ... REAL" da analista)
  const H = e.headers.map(h => h == null ? '' : String(h)), hk = H.map(normKey), isV = hk.map(k => /^vlr /.test(k));
  const nc = mesesNC(), ok = ym => !e.anosOff.has(Math.floor(ym / 100)) && (!nc || (nc.meses ? nc.meses.has(ym) : nc.anos.has(Math.floor(ym / 100))));
  const lin = []; for (const c of sel) for (const i of c.linhas) { const r = e.rows[i], ym = ymDe(r[e.I.per]) || ymDe(r[e.I.data]); if (ok(ym)) lin.push(r); }
  B.addSheet({
    name: 'LANÇAMENTOS SELECIONADOS', grid: false, split: true, freeze: { row: 1 }, landscape: true, filterRef: 'A1:' + colName(H.length - 1) + (lin.length + 1),
    cols: H.map((h, i) => isV[i] ? 16 : null),
    rows: async (emit, y) => {
      emit(H, { s: XS.bHeadHl });
      for (let k = 0; k < lin.length; k++) { emit(lin[k].map((v, i) => v == null || v === '' ? BLANK : isV[i] && typeof v !== 'number' ? toNum(v) : v), { s: H.map((h, i) => isV[i] ? XS.eBrlB : XS.bGen) }); if (k % 4000 === 3999) await y(Math.round(k / lin.length * 100)); }
    }
  });
  return B.build(onProgress);
}
const arquivoECD = () => 'ECD x EFD-Contribuições - ' + nomeArq() + '.xlsx';
