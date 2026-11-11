/* ================================ motor ================================ */
const KB_KEY = 'revisor-fiscal-base-v1';
const SET_KEY = 'revisor-fiscal-preferencias-v1';

const S = {
  loaded: false, demo: false, files: [], empresa: { nome: '', cnpj: '' },
  headers: [], hkey: [], map: {}, missing: [], hasAnoMes: false,
  tipo: 'ENT', recs: [], com: [], sem: [], alvo: [], groups: [], months: [], monthIdx: new Map(),
  totals: {}, regTable: [], checks: [], timings: [], procMs: 0,
  settings: Object.assign({ excluirIcms: true, cidade: 'Montenegro', escritorio: 'Milk Advocacia', analista: '', minManualBase: 60, minManualGrupo: 2, minAssistGrupo: .5, minRelManual: 180, minRelAssist: 45 }, store.get(SET_KEY, {})),
  kb: store.get(KB_KEY, {}),
  ui: { view: 'painel', filter: 'todos', q: '', sort: 'valor', showN: 60, drawer: null }
};
function saveSettings() { store.set(SET_KEY, S.settings); }
function saveKB() { store.set(KB_KEY, S.kb); }

/* --- leitura do Excel: .xlsx em fluxo (rápido e com pouca memória); SheetJS para .xls/.csv ou se o fluxo falhar --- */
const NAO_ACHEI = f => 'Não encontrei as colunas da exportação do SistemaMA (CFOP, Vlr PIS…) em "' + f.name + '". Confira se é a consulta "EFD - Contribuições - 037 - Entradas" ou "047 - Saídas", Todos os Registros - Completo, a Junção 513 (EFD ICMS/IPI + EFD-Contribuições) ou a ECF 0000/0010.';
async function readWorkbook(file, prog) {
  if (/\.xls[xm]$/i.test(file.name || '') || !file.name) {
    try {
      const r = await readXlsxStream(file, p => prog && prog(Math.round(p * 100) + '% lido'));
      if (!r) throw new Error(NAO_ACHEI(file));
      return r;
    } catch (e) {
      if (/Não encontrei/.test(e.message) || file.size > 40e6 || typeof XLSX === 'undefined') throw e;
      console.warn('leitura em fluxo falhou, usando SheetJS', e);
    }
  }
  if (typeof XLSX === 'undefined') throw new Error('A biblioteca de leitura de Excel não carregou. Verifique a conexão com a internet e recarregue a página.');
  const buf = await file.arrayBuffer();
  await tick();
  const wb = XLSX.read(buf, { type: 'array', dense: true, cellDates: true, cellNF: false, cellText: false, cellHTML: false });
  // a aba com mais linhas e com as colunas esperadas
  let best = null;
  for (const name of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
    let hr = -1;
    for (let i = 0; i < Math.min(10, aoa.length); i++) {
      const ks = (aoa[i] || []).map(normKey);
      if (cabecalhoConhecido(ks)) { hr = i; break; }
    }
    if (hr >= 0 && (!best || aoa.length > best.aoa.length)) best = { name, aoa, hr };
  }
  if (!best) throw new Error(NAO_ACHEI(file));
  const headers = best.aoa[best.hr].map(h => h == null ? '' : String(h).trim());
  const rows = best.aoa.slice(best.hr + 1).filter(r => r && r.some(v => v != null && v !== ''));
  // remove uma eventual linha de totais no fim (AutoSoma)
  while (rows.length && !rows[rows.length - 1].slice(0, 3).some(v => v != null && v !== '')) rows.pop();
  return { headers, rows };
}

function mapHeaders(headers) {
  const hk = headers.map(normKey), map = {}, missing = [];
  for (const [key, def] of Object.entries(FIELDS)) {
    let idx = -1;
    for (const n of def.names) { idx = hk.indexOf(n); if (idx >= 0) break; }
    if (idx < 0 && def.prefix) idx = hk.findIndex(h => h.startsWith(def.prefix));
    if (idx >= 0) map[key] = idx; else if (def.req) missing.push(key);
  }
  return { hk, map, missing, hasAnoMes: hk[0] === 'ano' && hk[1] === 'mes' };
}
/* 037 (entradas) ou 047 (saídas): pelo cabeçalho e, na dúvida, pelo 1º dígito do CFOP */
/* 037 x 047: colunas que só uma das duas consultas tem (a 037 real também traz "Data Entrada/Saída", então ela não decide);
   sem elas, a maioria dos CFOP (1/2/3 = entradas, 5/6/7 = saídas) */
function detectTipo(hk, rows, map) {
  if (hk.includes('faturamento') || hk.includes('vlr seguro') || hk.includes('vlr outras da')) return 'SAI';
  if (hk.includes('deb cred') || hk.includes('natureza credito') || hk.includes('natureza base calculo credito') || hk.includes('nome contabil') || hk.includes('nome conta')) return 'ENT';
  let s = 0, e = 0;
  for (let i = 0; i < rows.length && i < 5000; i++) { const c = digits(rows[i][map.cfop]); if (/^[567]/.test(c)) s++; else if (/^[123]/.test(c)) e++; }
  return s > e ? 'SAI' : 'ENT';
}
const kbKey = g => MODE.kbPrefix + (g.ncm || '-') + '|' + (g.cfop || '-');

/* --- pipeline: cada etapa é medida e mostrada na tela --- */
async function runPipeline(input, onStep) {
  const T = [];
  const step = async (id, label, fn) => {
    onStep && onStep({ id, label, state: 'run' }); await tick();
    const prog = d => onStep && onStep({ id, label, state: 'run', detail: d });
    const t0 = now(); const detail = await fn(prog); const ms = now() - t0 + (id === 'ler' && input.pre && input.pre.ms || 0); // a leitura dos arquivos já separados conta aqui
    T.push({ id, label, ms, detail }); onStep && onStep({ id, label, state: 'ok', ms, detail }); await tick();
  };
  const t0 = now();
  let headers, rows, empresa = { nome: '', cnpj: '' }, fileNames = [];
  const demoTipo = input.demo ? (input.demo === 'SAI' ? 'SAI' : 'ENT') : null;

  await step('ler', 'Leitura do arquivo', async (prog) => {
    if (demoTipo) { const d = demoTipo === 'SAI' ? buildDemoSaidas() : buildDemo(); headers = d.headers; rows = d.rows; empresa = Object.assign({}, d.empresa); fileNames = [MODES[demoTipo].titulo + '.xlsx']; }
    else if (input.pre) { headers = input.pre.headers; rows = input.pre.rows; fileNames = input.pre.fileNames.slice(); } // já lidos (vários arquivos separados em 037 e 047)
    else {
      for (const f of input.files) {
        const wb = await readWorkbook(f, d => prog((input.files.length > 1 ? f.name + ': ' : '') + d));
        if (!headers) { headers = wb.headers; rows = wb.rows; }
        else {
          if (wb.headers.map(normKey).join('|') !== headers.map(normKey).join('|')) throw new Error('"' + f.name + '" tem colunas diferentes do primeiro arquivo. Importe juntos apenas arquivos da mesma consulta (ex.: a 037 dividida por ano); a 037 e a 047 são analisadas separadamente.');
          for (const r of wb.rows) rows.push(r);
        }
        fileNames.push(f.name);
      }
    }
    if (input.sample) empresa = Object.assign({}, DEMO_EMPRESA);
    return fNum(rows.length) + ' linhas · ' + headers.length + ' colunas' + (fileNames.length > 1 ? ' · ' + fileNames.length + ' arquivos unidos' : '');
  });

  let M;
  await step('map', 'Mapeamento das colunas', async () => {
    M = mapHeaders(headers);
    if (M.missing.length) throw new Error('Colunas obrigatórias não encontradas: ' + M.missing.map(k => FIELDS[k].names[0].toUpperCase()).join(', ') + '.');
    setMode(demoTipo || (input.pre && input.pre.tipo) || detectTipo(M.hk, rows, M.map));
    return 'Planilha ' + MODE.planilha + ' (' + MODE.nome + ') · ' + Object.keys(M.map).length + ' campos reconhecidos de ' + Object.keys(FIELDS).length + (M.hasAnoMes ? ' · ANO/MÊS já existiam' : '');
  });

  const recs = [];
  await step('anomes', 'Colunas ANO e MÊS', async () => {
    const m = M.map; let bad = 0;
    for (let i = 0; i < rows.length; i++) {
      const v = rows[i];
      const d = toDate(v[m.periodo]) || toDate(v[m.dataDoc]);
      if (!d) { bad++; continue; }
      const cst = digits(v[m.cstPis]).slice(0, 2), cstC = m.cstCof != null ? digits(v[m.cstCof]).slice(0, 2) : cst;
      recs.push({
        i, v, ano: d.y, mes: String(d.m).padStart(2, '0') + '/' + d.y, ym: d.y * 100 + d.m,
        registro: String(v[m.registro] || ''), cfop: digits(v[m.cfop]).slice(0, 4), ncm: digits(v[m.ncm], 8), desc: String(v[m.desc] || '').trim(),
        tipoItem: m.tipoItem != null ? String(v[m.tipoItem] || '') : '', part: m.part != null ? String(v[m.part] || '') : '',
        vlrItem: toNum(v[m.vlrItem]), vlrDesc: m.vlrDesc != null ? toNum(v[m.vlrDesc]) : 0, vlrIcms: m.vlrIcms != null ? toNum(v[m.vlrIcms]) : 0,
        cst, cstC, bcPis: toNum(v[m.bcPis]), aliqPis: toNum(v[m.aliqPis]), vlrPis: toNum(v[m.vlrPis]), aliqCof: toNum(v[m.aliqCof]), vlrCof: toNum(v[m.vlrCof]),
        g: null, ov: null
      });
    }
    if (!recs.length) throw new Error('Nenhuma linha com período válido. Confira a coluna "Período".');
    if (!empresa.cnpj && M.map.cnpj != null) empresa.cnpj = digits(rows[0][M.map.cnpj]);
    return fNum(recs.length) + ' linhas datadas' + (bad ? ' · ' + bad + ' sem período (ignoradas)' : '') + ' · ' + ymLabel(recs.reduce((a, r) => Math.min(a, r.ym), 999999)) + ' a ' + ymLabel(recs.reduce((a, r) => Math.max(a, r.ym), 0));
  });

  const tot = {};
  await step('tot', 'Totais e conferência', async () => {
    tot.n = recs.length; tot.vlrItem = 0; tot.bcPis = 0; tot.pis = 0; tot.cof = 0; tot.icms = 0;
    for (const r of recs) { tot.vlrItem += r.vlrItem; tot.bcPis += r.bcPis; tot.pis += r.vlrPis; tot.cof += r.vlrCof; tot.icms += r.vlrIcms; }
    return fBRL(tot.vlrItem) + ' em itens · PIS ' + fBRL(tot.pis) + ' · COFINS ' + fBRL(tot.cof);
  });

  const monthsMap = new Map(); const regMap = new Map();
  await step('din', 'Dinâmicas por registro e por mês', async () => {
    for (const r of recs) {
      let mo = monthsMap.get(r.ym);
      if (!mo) { mo = { ym: r.ym, ano: r.ano, mes: r.mes, n: 0, bcPis: 0, pis: 0, cof: 0, nc: 0, cum: 0, pot: 0, potBase: 0, contIcms: 0 }; monthsMap.set(r.ym, mo); }
      mo.n++; mo.bcPis += r.bcPis; mo.pis += r.vlrPis; mo.cof += r.vlrCof;
      if (r.vlrPis > 0 && Math.abs(r.aliqPis - 1.65) < .001) mo.nc++;
      if (r.vlrPis > 0 && Math.abs(r.aliqPis - .65) < .001 && !/^f150/i.test(r.registro)) mo.cum++;
      const rk = r.ano + '|' + r.registro;
      let rg = regMap.get(rk); if (!rg) { rg = { ano: r.ano, registro: r.registro, pis: 0, cof: 0, n: 0 }; regMap.set(rk, rg); }
      rg.pis += r.vlrPis; rg.cof += r.vlrCof; rg.n++;
    }
    return monthsMap.size + ' meses · ' + new Set([...regMap.values()].map(x => x.registro)).size + ' tipos de registro';
  });

  const months = [...monthsMap.values()].sort((a, b) => a.ym - b.ym);
  months.forEach(mo => { mo.regime = mo.nc > 0 ? 'NC' : (mo.cum > 0 ? 'CUM' : 'SEM'); });
  // mês sem nenhum crédito entre meses não cumulativos: segue o regime do ano
  const anoNC = new Set(months.filter(m => m.regime === 'NC').map(m => m.ano));
  months.forEach(mo => { if (mo.regime === 'SEM' && anoNC.has(mo.ano)) mo.regime = 'NC'; });
  const monthIdx = new Map(months.map(m => [m.ym, m]));

  let com = [], sem = [];
  await step('sep', 'Separação COM e SEM PIS/COFINS', async () => {
    // como no vídeo (13:44): filtro na coluna Vlr PIS; zerado ou vazio vai para NOTAS SEM PC
    for (const r of recs) (Math.abs(r.vlrPis) > .004 ? com : sem).push(r);
    const sC = com.reduce((a, r) => a + r.vlrItem, 0), sS = sem.reduce((a, r) => a + r.vlrItem, 0);
    tot.sepOk = (com.length + sem.length === recs.length) && Math.abs(sC + sS - tot.vlrItem) < .05;
    tot.comN = com.length; tot.semN = sem.length; tot.comV = sC; tot.semV = sS;
    return SAI() ? fNum(com.length) + ' vendas tributadas · ' + fNum(sem.length) + ' sem PIS/COFINS · soma ' + (tot.sepOk ? 'confere' : 'NÃO confere')
      : fNum(com.length) + ' com crédito · ' + fNum(sem.length) + ' sem crédito · soma ' + (tot.sepOk ? 'confere' : 'NÃO confere');
  });

  const groups = [];
  const alvo = SAI() ? com : sem;
  await step('cls', 'Pré-classificação por NCM + CFOP', async () => {
    const gm = new Map();
    // saídas: CSTs sem tributação já usados para o mesmo NCM em vendas (sinal de cadastro inconsistente)
    const semTrib = new Map();
    if (SAI()) for (const r of sem) { if (!r.ncm || !CST_NAO_TRIB.has(r.cst) || !CFOP_SAI_VENDA.has(r.cfop.slice(1))) continue; let st = semTrib.get(r.ncm); if (!st) semTrib.set(r.ncm, st = new Set()); st.add(r.cst); }
    for (const r of alvo) {
      const k = (r.ncm || '-') + '|' + (r.cfop || '-') + (r.cfop ? '' : '|' + normKey(r.desc).slice(0, 24)) + (!r.ncm && REG_CONSOLIDADO.test(r.registro) ? '|consolidado' : '');
      let g = gm.get(k);
      if (!g) { g = { key: k, ncm: r.ncm, cfop: r.cfop, registro: r.registro, tipoItem: r.tipoItem, recs: [], n: 0, vlr: 0, descs: new Map(), parts: new Map(), csts: new Map(), ncN: 0 }; gm.set(k, g); }
      g.recs.push(r); g.n++; g.vlr += r.vlrItem; r.g = g;
      g.descs.set(r.desc, (g.descs.get(r.desc) || 0) + 1);
      if (r.part) g.parts.set(r.part, (g.parts.get(r.part) || 0) + 1);
      g.csts.set(r.cst, (g.csts.get(r.cst) || 0) + 1);
      const mo = monthIdx.get(r.ym); if (mo && mo.regime === 'NC') g.ncN++;
    }
    for (const g of gm.values()) {
      g.descTop = [...g.descs.entries()].sort((a, b) => b[1] - a[1])[0][0];
      g.cstMain = [...g.csts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      g.nc = g.ncN > 0;
      if (SAI()) g.semTribCst = g.ncm && semTrib.has(g.ncm) ? [...semTrib.get(g.ncm)].sort() : [];
      g.sug = (SAI() ? suggestSai : suggest)(g, S.kb); g.dec = null; g.learn = false;
      groups.push(g);
    }
    const rank = g => SAI() ? { COM: 0, AVA: 1, SEM: 2 }[CLS_KEY[g.sug.cls]] : 0; // saídas: o que pede ação aparece primeiro
    groups.sort((a, b) => rank(a) - rank(b) || b.vlr - a.vlr);
    const c = { COM: 0, SEM: 0, AVA: 0 }; groups.forEach(g => c[CLS_KEY[g.sug.cls]]++);
    return SAI() ? groups.length + ' grupos NCM + CFOP · ' + c.COM + ' para recuperar · ' + c.AVA + ' para avaliar · ' + c.SEM + ' corretos'
      : groups.length + ' grupos NCM + CFOP · ' + c.COM + ' com indício de crédito · ' + c.AVA + ' para avaliar · ' + c.SEM + ' sem crédito';
  });

  Object.assign(S, {
    loaded: true, demo: !!(input.demo || input.sample), tipo: MODE.id, files: fileNames, empresa, headers, hkey: M.hk, map: M.map, hasAnoMes: M.hasAnoMes,
    recs, com, sem, alvo, groups, months, monthIdx, totals: tot, regTable: [...regMap.values()].sort((a, b) => a.ano - b.ano || a.registro.localeCompare(b.registro))
  });
  await step('ck', 'Checklist automático', async () => {
    recompute();
    const att = S.checks.filter(c => c.st !== 'ok' && c.st !== 'info').length;
    return S.checks.length + ' verificações · ' + att + ' pedem atenção';
  });
  S.timings = T; S.procMs = now() - t0 + (input.pre && input.pre.ms || 0);
  return S;
}

/* --- classificação final e crédito potencial --- */
const clsOf = r => r.ov || (r.g ? (r.g.dec || r.g.sug.cls) : null);
function creditOf(r) {
  if (clsOf(r) !== CLS.COM) return null;
  if (S.tipo === 'SAI') return { base: r2(r.bcPis), pis: r2(r.vlrPis), cof: r2(r.vlrCof) }; // saída tributada indevidamente: o que foi pago
  const mo = S.monthIdx.get(r.ym);
  if (!mo || mo.regime !== 'NC') return null;
  const base = Math.max(0, r.vlrItem - r.vlrDesc - (S.settings.excluirIcms && r.ym >= 202305 ? r.vlrIcms : 0));
  return { base: r2(base), pis: r2(base * .0165), cof: r2(base * .076) };
}

function recompute() {
  S.months.forEach(m => { m.pot = 0; m.potBase = 0; m.potPis = 0; m.potCof = 0; });
  let pot = { base: 0, pis: 0, cof: 0, n: 0 };
  const byYear = new Map();
  for (const r of S.alvo) {
    const c = creditOf(r); if (!c) continue;
    const mo = S.monthIdx.get(r.ym); mo.pot += c.pis + c.cof; mo.potBase += c.base; mo.potPis += c.pis; mo.potCof += c.cof;
    pot.base += c.base; pot.pis += c.pis; pot.cof += c.cof; pot.n++;
    const y = byYear.get(r.ano) || { ano: r.ano, base: 0, pis: 0, cof: 0 }; y.base += c.base; y.pis += c.pis; y.cof += c.cof; byYear.set(r.ano, y);
  }
  S.pot = pot; S.potYears = [...byYear.values()].sort((a, b) => a.ano - b.ano);
  S.checks = runChecks();
  S.resumo = buildResumo();
  if (S.analyses && S.analyses[S.tipo] && S.analyses[S.tipo].snap.recs === S.recs) S.analyses[S.tipo].snap.resumo = S.resumo;
  const g = S.groups;
  S.clsCount = { COM: 0, SEM: 0, AVA: 0, revisados: 0, vlrRev: 0 };
  for (const x of g) { S.clsCount[CLS_KEY[x.dec || x.sug.cls]]++; if (x.dec) { S.clsCount.revisados++; S.clsCount.vlrRev += x.vlr; } }
}

/* --- checklist: as verificações que hoje dependem da memória do analista --- */
function runChecks() {
  if (S.tipo === 'SAI') return runChecksSai();
  const T = S.totals, out = [];
  const add = o => out.push(o);
  const nc = S.months.filter(m => m.regime === 'NC'), semMeses = S.months.filter(m => m.regime !== 'NC');
  const per = ymLabel(S.months[0].ym) + ' a ' + ymLabel(S.months[S.months.length - 1].ym);
  const E = S.empresa.nome || 'a empresa';

  // 1. integridade
  const dupKey = new Map(); let dups = 0;
  if (S.map.chave != null && S.map.numItem != null) for (const r of S.recs) {
    const k = r.v[S.map.chave]; if (!k) continue; const kk = k + '|' + r.v[S.map.numItem] + '|' + r.registro + '|' + r.cfop + '|' + r.cst + '|' + r.vlrItem.toFixed(2) + '|' + r.desc;
    if (dupKey.has(kk)) dups++; else dupKey.set(kk, 1);
  }
  add({
    id: 'integridade', t: 'Integridade da base e da separação', st: T.sepOk && !dups ? 'ok' : 'warn', n: T.n, v: null,
    txt: (T.sepOk ? 'COM (' + fNum(T.comN) + ') + SEM (' + fNum(T.semN) + ') = ' + fNum(T.n) + ' linhas; a soma de Vlr Item confere com a base.' : 'A soma das abas não confere com a base: revisar a exportação.') + (dups ? ' ' + fNum(dups) + ' linhas repetidas (mesma chave e item).' : ' Nenhuma linha repetida.'),
    acao: dups ? 'Conferir as linhas repetidas antes de concluir.' : 'Nada a fazer.', rel: ''
  });
  // 2. regime
  add({
    id: 'regime', t: 'Regime de apuração por período', st: semMeses.length ? 'warn' : 'info', n: nc.length, v: null,
    txt: nc.length + ' de ' + S.months.length + ' meses com créditos no regime não cumulativo (1,65% e 7,6%).' + (semMeses.length ? ' Meses sem crédito escriturado: ' + semMeses.map(m => m.mes).join(', ') + ' (possível regime cumulativo; ficam fora do potencial).' : ''),
    acao: 'Confirmar o regime de cada ano no relatório (Simples, Presumido ou Real).',
    rel: 'No período analisado (' + per + '), ' + E + ' apurou o PIS e a COFINS no regime não cumulativo em ' + nc.length + ' de ' + S.months.length + ' meses, com alíquotas de 1,65% e 7,6%, o que permite o aproveitamento de créditos sobre aquisições nos termos das Leis 10.637/2002 e 10.833/2003.'
  });
  // 3. oportunidade: itens classificados com crédito
  const comGroups = S.groups.filter(g => (g.dec || g.sug.cls) === CLS.COM);
  const potT = S.pot.pis + S.pot.cof;
  add({
    id: 'oportunidade', t: 'Aquisições com direito a crédito escrituradas sem crédito', st: potT > 0 ? 'opp' : 'ok', n: S.pot.n, v: potT,
    txt: fNum(S.pot.n) + ' itens em ' + comGroups.length + ' grupos NCM + CFOP classificados como ' + CLS.COM + '. Base de ' + fBRL(S.pot.base) + ': PIS ' + fBRL(S.pot.pis) + ' e COFINS ' + fBRL(S.pot.cof) + ' (valores nominais).',
    acao: 'Revisar os grupos de confiança média e baixa na Classificação.',
    rel: 'O cruzamento das notas fiscais de entrada escrituradas na EFD-Contribuições identificou ' + fNum(S.pot.n) + ' itens adquiridos para revenda ou com direito a crédito que foram lançados sem o aproveitamento de PIS e COFINS. O crédito não aproveitado soma ' + fBRL(potT) + ' (PIS ' + fBRL(S.pot.pis) + ' e COFINS ' + fBRL(S.pot.cof) + '), em valores nominais, passível de recuperação administrativa.'
  });
  // 4. ICMS na base do crédito após 05/2023
  let ci = { n: 0, icms: 0 };
  for (const r of S.com) {
    if (r.ym < 202305 || r.vlrIcms <= 0 || /^f150/i.test(r.registro)) continue;
    if (r.bcPis > r.vlrItem - r.vlrDesc - r.vlrIcms + .01) { ci.n++; ci.icms += Math.min(r.vlrIcms, r.bcPis - (r.vlrItem - r.vlrDesc - r.vlrIcms)); }
  }
  const ciV = r2(ci.icms * .0925); S.icmsEnt = { n: ci.n, base: r2(ci.icms), pis: r2(ci.icms * .0165), cof: r2(ci.icms * .076), v: ciV };
  add({
    id: 'icms-base', t: 'ICMS mantido na base do crédito a partir de 05/2023', st: ci.n ? 'risk' : 'ok', n: ci.n, v: ciV,
    txt: ci.n ? fNum(ci.n) + ' itens com crédito calculado sem excluir o ICMS destacado. ICMS na base: ' + fBRL(ci.icms) + '; crédito tomado a maior: ' + fBRL(ciV) + '.' : 'Nenhum item com ICMS na base do crédito após 05/2023.',
    acao: ci.n ? 'Retificar a EFD-Contribuições dos meses afetados ou provisionar a contingência.' : 'Nada a fazer.',
    rel: ci.n ? 'Constatou-se que ' + E + ' não excluiu o ICMS destacado da base de cálculo dos créditos de PIS e COFINS em ' + fNum(ci.n) + ' itens a partir de maio de 2023, contrariando a Lei 14.592/2023. O crédito aproveitado a maior soma ' + fBRL(ciV) + ' e deve ser estornado ou retificado.' : ''
  });
  // 5. crédito tomado em monofásico ou alíquota zero (revenda)
  let mz = { n: 0, v: 0, ncms: new Set() };
  for (const r of S.com) {
    const nr = ncmRule(r.ncm); if (!nr) continue;
    const c3 = r.cfop.slice(1);
    if (nr.t === 'ZERO' || (nr.t === 'MONO' && CFOP_REVENDA.has(c3))) { mz.n++; mz.v += r.vlrPis + r.vlrCof; mz.ncms.add(fmtNCM(r.ncm) + ' ' + nr.nome.toLowerCase()); }
  }
  add({
    id: 'mono', t: 'Crédito tomado sobre produto monofásico ou de alíquota zero', st: mz.n ? 'risk' : 'ok', n: mz.n, v: r2(mz.v),
    txt: mz.n ? fNum(mz.n) + ' itens com crédito de ' + fBRL(mz.v) + ' sobre NCM sem direito a crédito na revenda: ' + [...mz.ncms].slice(0, 4).join('; ') + '.' : 'Nenhum crédito sobre produtos monofásicos ou de alíquota zero.',
    acao: mz.n ? 'Estornar o crédito indevido e orientar o cadastro fiscal dos produtos.' : 'Nada a fazer.',
    rel: mz.n ? 'Foram identificados créditos de PIS e COFINS sobre aquisições de produtos sujeitos à incidência monofásica ou à alíquota zero, vedados pelo art. 3º, I, "b" e § 2º, II, da Lei 10.833/2003. O crédito indevido soma ' + fBRL(mz.v) + '.' : ''
  });
  // 5b. crédito tomado sobre material de uso e consumo (o diagnóstico da Milk aponta esse valor à parte)
  const uc = { n: 0, v: 0 };
  for (const r of S.com) { if (r.cfop && CFOP_USO_CONSUMO.has(r.cfop.slice(1))) { uc.n++; uc.v += r.vlrPis + r.vlrCof; } }
  add({
    id: 'uso-consumo', t: 'Crédito tomado sobre material de uso e consumo', st: uc.n ? 'risk' : 'ok', n: uc.n, v: uc.n ? r2(uc.v) : null,
    txt: uc.n ? fNum(uc.n) + ' itens com CFOP de uso e consumo (x556/x407) escriturados com crédito de ' + fBRL(uc.v) + '.' : 'Nenhum crédito tomado sobre itens com CFOP de uso e consumo.',
    acao: uc.n ? 'Conferir se o item é insumo essencial ou relevante; se não for, estornar o crédito.' : 'Nada a fazer.',
    rel: uc.n ? 'Também foi verificado aproveitamento incorreto de PIS e COFINS no valor total de ' + fBRL(uc.v) + ' referentes a produtos adquiridos para uso e consumo que não possuem direito ao crédito, por não se enquadrarem no conceito de insumo.' : ''
  });
  // 6. alíquota divergente
  let al = { n: 0, v: 0 };
  for (const r of S.com) {
    if (/^f150/i.test(r.registro)) continue;
    const mo = S.monthIdx.get(r.ym); if (!mo || mo.regime !== 'NC') continue;
    if ((r.vlrPis > 0 && Math.abs(r.aliqPis - 1.65) > .001) || (r.vlrCof > 0 && Math.abs(r.aliqCof - 7.6) > .001)) { al.n++; al.v += r.vlrItem; }
  }
  add({
    id: 'aliquota', t: 'Alíquota divergente de 1,65% e 7,6% em meses não cumulativos', st: al.n ? 'warn' : 'ok', n: al.n, v: al.n ? r2(al.v) : null,
    txt: al.n ? fNum(al.n) + ' itens creditados com alíquota diferente da básica (base de ' + fBRL(al.v) + '). Pode haver crédito calculado a menor.' : 'Todas as alíquotas conferem.',
    acao: al.n ? 'Recalcular o crédito destes itens com a alíquota básica.' : 'Nada a fazer.',
    rel: al.n ? 'Em ' + fNum(al.n) + ' itens o crédito foi calculado com alíquotas diferentes de 1,65% (PIS) e 7,6% (COFINS), o que indica crédito apurado a menor a ser revisto.' : ''
  });
  // 7. CST PIS x COFINS
  const cstDiv = S.recs.filter(r => r.cst && r.cstC && r.cst !== r.cstC);
  add({
    id: 'cst', t: 'CST de PIS diferente do CST de COFINS', st: cstDiv.length ? 'warn' : 'ok', n: cstDiv.length, v: cstDiv.length ? r2(cstDiv.reduce((a, r) => a + r.vlrItem, 0)) : null,
    txt: cstDiv.length ? fNum(cstDiv.length) + ' itens com CST diferente entre as duas contribuições (ex.: PIS ' + cstDiv[0].cst + ' e COFINS ' + cstDiv[0].cstC + ').' : 'CSTs de PIS e COFINS coerentes em todos os itens.',
    acao: cstDiv.length ? 'Conferir o cadastro tributário dos itens: o crédito de uma das contribuições pode ter ficado de fora.' : 'Nada a fazer.', rel: ''
  });
  // 8. itens sem NCM
  const semNcm = S.sem.filter(r => !r.ncm && !/^a1/i.test(r.registro));
  add({
    id: 'ncm', t: 'Itens sem NCM entre as notas sem crédito', st: semNcm.length ? 'warn' : 'ok', n: semNcm.length, v: semNcm.length ? r2(semNcm.reduce((a, r) => a + r.vlrItem, 0)) : null,
    txt: semNcm.length ? fNum(semNcm.length) + ' itens de mercadoria sem NCM: a classificação depende da descrição.' : 'Todos os itens de mercadoria têm NCM.',
    acao: semNcm.length ? 'Classificar pela descrição ou pedir o XML das notas.' : 'Nada a fazer.', rel: ''
  });
  // 9. estoque de abertura
  const f150 = S.com.filter(r => /^f150/i.test(r.registro));
  const f150m = new Set(f150.map(r => r.ym)).size;
  add({
    id: 'estoque', t: 'Crédito presumido sobre o estoque de abertura', st: !f150.length ? 'info' : (f150m === 12 ? 'ok' : 'warn'), n: f150m, v: f150.length ? r2(f150.reduce((a, r) => a + r.vlrPis + r.vlrCof, 0)) : null,
    txt: !f150.length ? 'Nenhum registro F150 na base. Se a empresa migrou para o lucro real no período, verificar se o crédito do estoque de abertura foi aproveitado.' : 'F150 escriturado em ' + f150m + ' meses (' + ymLabel(Math.min(...f150.map(r => r.ym))) + ' a ' + ymLabel(Math.max(...f150.map(r => r.ym))) + ')' + (f150m === 12 ? ': as 12 parcelas mensais estão completas.' : ': o esperado são 12 parcelas mensais.'),
    acao: !f150.length ? 'Confirmar a data de ingresso no regime não cumulativo.' : (f150m === 12 ? 'Nada a fazer.' : 'Conferir as parcelas faltantes ou excedentes.'),
    rel: f150.length && f150m === 12 ? 'Em relação ao estoque de abertura, a empresa aproveitou corretamente o crédito presumido em doze parcelas mensais, iguais e sucessivas, a partir do ingresso no regime não cumulativo (Lei 10.637/2002, art. 11; Lei 10.833/2003, art. 12).' : ''
  });
  return out;
}

function setGroupCls(g, cls) {
  g.dec = cls;
  if (g.learn) learnGroup(g);
  recompute();
}
function learnGroup(g) {
  const cls = g.dec || g.sug.cls;
  S.kb[kbKey(g)] = { cls, motivo: (cls === g.sug.cls ? g.sug.motivo : 'Decisão do analista') + ' (registrado em ' + new Date().toLocaleDateString('pt-BR') + ')', lei: cls === g.sug.cls ? g.sug.lei : '', ncm: g.ncm, cfop: g.cfop, desc: g.descTop };
  saveKB();
}

/* --- checklist das saídas (047): o que foi pago a maior e o que pode ter ficado sem recolher --- */
function runChecksSai() {
  const T = S.totals, out = [], add = o => out.push(o);
  const E = S.empresa.nome || 'a empresa', M0 = S.months[0].ym;
  const per = ymLabel(M0) + ' a ' + ymLabel(S.months[S.months.length - 1].ym);
  const venda = r => r.cfop && CFOP_SAI_VENDA.has(r.cfop.slice(1));
  // 1. integridade
  const dupKey = new Set(); let dups = 0;
  if (S.map.chave != null && S.map.numItem != null) for (const r of S.recs) {
    const k = r.v[S.map.chave]; if (!k) continue; const kk = k + '|' + r.v[S.map.numItem] + '|' + r.registro + '|' + r.cfop + '|' + r.cst + '|' + r.vlrItem.toFixed(2) + '|' + r.desc;
    if (dupKey.has(kk)) dups++; else dupKey.add(kk);
  }
  add({
    id: 'integridade', t: 'Integridade da base e da separação', st: T.sepOk && !dups ? 'ok' : 'warn', n: T.n, v: null,
    txt: (T.sepOk ? 'Tributadas (' + fNum(T.comN) + ') + sem PIS/COFINS (' + fNum(T.semN) + ') = ' + fNum(T.n) + ' linhas; a soma de Vlr Item confere com a base.' : 'A soma das abas não confere com a base: revisar a exportação.') + (dups ? ' ' + fNum(dups) + ' linhas repetidas (mesma chave e item).' : ' Nenhuma linha repetida.'),
    acao: dups ? 'Conferir as linhas repetidas antes de concluir.' : 'Nada a fazer.', rel: ''
  });
  // 2. regime por faixas de meses
  const faixas = [];
  for (const m of S.months) { const f = faixas[faixas.length - 1]; if (f && f.reg === m.regime) { f.fim = m.ym; f.n++; } else faixas.push({ reg: m.regime, ini: m.ym, fim: m.ym, n: 1 }); }
  const RG = { NC: ['não cumulativo (1,65% e 7,6%)', 'no regime não cumulativo, às alíquotas de 1,65% (PIS) e 7,6% (COFINS), próprio do Lucro Real'], CUM: ['cumulativo (0,65% e 3%)', 'no regime cumulativo, às alíquotas de 0,65% (PIS) e 3% (COFINS), próprio do Lucro Presumido'], SEM: ['sem débito escriturado', 'sem débito de PIS e COFINS escriturado'] };
  add({
    id: 'regime', t: 'Regime de apuração por período', st: faixas.some(f => f.reg === 'SEM') ? 'warn' : 'info', n: S.months.length, v: null,
    txt: faixas.map(f => RG[f.reg][0] + ' de ' + ymLabel(f.ini) + ' a ' + ymLabel(f.fim) + ' (' + f.n + (f.n === 1 ? ' mês' : ' meses') + ')').join('; ').replace(/^./, c => c.toUpperCase()) + '.',
    acao: 'Confirmar o regime de cada ano (Simples, Presumido ou Real) e citar no relatório.',
    rel: 'Inicialmente, verificamos o regime de apuração do PIS e da COFINS adotado por ' + E + ' no período analisado (' + per + '). ' + faixas.filter(f => f.reg !== 'SEM' || f.n > 2).map(f => 'De ' + ymLong(f.ini) + ' a ' + ymLong(f.fim) + ', a empresa apurou as contribuições ' + RG[f.reg][1] + '.').join(' ')
  });
  // 3. oportunidade: receitas tributadas indevidamente
  const potT = S.pot.pis + S.pot.cof, cats = new Map();
  for (const r of S.alvo) { const c = creditOf(r); if (!c) continue; const g = r.g, k = r.ov || (g.dec && g.dec !== g.sug.cls) ? 'Decisão do analista' : (g.sug.cat || 'Outros'); cats.set(k, (cats.get(k) || 0) + c.pis + c.cof); }
  const catTxt = [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k.toLowerCase() + ' ' + fBRL(v));
  const recG = S.groups.filter(g => (g.dec || g.sug.cls) === CLS.COM);
  add({
    id: 'oportunidade', t: 'Vendas tributadas que não deveriam pagar PIS/COFINS', st: potT > 0 ? 'opp' : 'ok', n: S.pot.n, v: r2(potT),
    txt: potT > 0 ? fNum(S.pot.n) + ' itens de venda em ' + recG.length + ' grupos NCM + CFOP classificados como RECUPERAR: PIS ' + fBRL(S.pot.pis) + ' e COFINS ' + fBRL(S.pot.cof) + ' (valores nominais). Por origem: ' + catTxt.join('; ') + '.' : 'Nenhuma venda tributada classificada como RECUPERAR.',
    acao: 'Revisar os grupos RECUPERAR e AVALIAR na Classificação e corrigir o CST no cadastro dos produtos.',
    rel: potT > 0 ? 'Na análise das notas fiscais de saída escrituradas na EFD-Contribuições, identificamos ' + fNum(S.pot.n) + ' itens de venda tributados pelo PIS e pela COFINS que não deveriam sofrer a incidência das contribuições (' + catTxt.map(x => x.replace(/ R\$.*$/, '')).join(', ') + '). O valor pago a maior soma ' + fBRL(potT) + ' (PIS ' + fBRL(S.pot.pis) + ' e COFINS ' + fBRL(S.pot.cof) + '), em valores nominais, passível de restituição ou compensação na esfera administrativa.' : ''
  });
  // 4. ICMS na base de cálculo dos débitos (Tema 69 do STF)
  const inc = { n: 0, icms: 0, v: 0, mi: 999999, ma: 0 }, exc = { n: 0, first: null }; let comIcms = 0;
  S.months.forEach(m => { m.icmsPot = 0; });
  for (const r of S.com) {
    if (r.vlrIcms <= .009 || r.cst === '03') continue; comIcms++;
    const semIcms = r.vlrItem - r.vlrDesc - r.vlrIcms;
    if (r.bcPis > semIcms + .01) { const x = Math.min(r.vlrIcms, r.bcPis - semIcms), v = x * (r.aliqPis + r.aliqCof) / 100; inc.n++; inc.icms += x; inc.v += v; inc.pis = (inc.pis || 0) + x * r.aliqPis / 100; inc.cof = (inc.cof || 0) + x * r.aliqCof / 100; inc.mi = Math.min(inc.mi, r.ym); inc.ma = Math.max(inc.ma, r.ym); const mo = S.monthIdx.get(r.ym); if (mo) mo.icmsPot += v; }
    else { exc.n++; if (exc.first == null || r.ym < exc.first) exc.first = r.ym; }
  }
  const desde = exc.first && exc.first > M0 ? 'a partir de ' + ymLong(exc.first) : 'em todo o período analisado';
  const residual = inc.n && inc.v < 100 && inc.n < comIcms * .01; // casos isolados: não muda a conclusão
  if (residual) S.months.forEach(m => { m.icmsPot = 0; });
  S.icmsSai = { n: inc.n, base: r2(inc.icms), pis: r2(inc.pis || 0), cof: r2(inc.cof || 0), v: r2(inc.v), mi: inc.n ? inc.mi : null, ma: inc.n ? inc.ma : null, first: exc.first, residual: !!residual, comIcms };
  add({
    id: 'icms-base', t: 'ICMS destacado na base de cálculo do PIS e da COFINS (Tema 69 do STF)', st: inc.n && !residual ? 'opp' : (comIcms ? 'ok' : 'info'), n: inc.n, v: inc.n ? r2(inc.v) : null,
    txt: residual ? 'A empresa já exclui o ICMS destacado da base do PIS e da COFINS ' + desde + ' (' + fNum(exc.n) + ' itens com ICMS próprio). Só ' + fNum(inc.n) + ' itens isolados ficaram com o imposto na base (' + ymLabel(inc.mi) + ' a ' + ymLabel(inc.ma) + '; ' + fBRL(inc.v) + ').'
      : inc.n ? fNum(inc.n) + ' itens de venda com o ICMS dentro da base das contribuições (' + ymLabel(inc.mi) + ' a ' + ymLabel(inc.ma) + '). ICMS na base: ' + fBRL(inc.icms) + '; PIS/COFINS pagos a maior: ' + fBRL(inc.v) + '.' + (exc.n ? ' A exclusão já aparece em ' + fNum(exc.n) + ' itens (desde ' + ymLabel(exc.first) + ').' : '')
      : comIcms ? 'A empresa já exclui o ICMS destacado da base do PIS e da COFINS ' + desde + ' (' + fNum(exc.n) + ' itens com ICMS próprio conferidos).' : 'Nenhuma venda tributada com ICMS próprio destacado (vendas com ICMS-ST ou sem ICMS).',
    acao: residual ? 'Casos isolados e de valor irrelevante: conferir se convém incluir no pedido.' : inc.n ? 'Recalcular as contribuições dos meses afetados sem o ICMS e pedir a restituição ou compensação, observado o prazo de cinco anos.' : 'Nada a fazer.',
    rel: residual ? E + ' já exclui o ICMS destacado da base de cálculo do PIS e da COFINS nas vendas ' + desde + ', em conformidade com o Tema 69 do STF (RE 574.706/PR); foram encontrados apenas ' + fNum(inc.n) + ' itens isolados com o imposto na base, de valor irrelevante (' + fBRL(inc.v) + ').'
      : inc.n ? 'Em maio de 2021, o Supremo Tribunal Federal concluiu o julgamento do Tema 69 da repercussão geral (RE 574.706/PR) e firmou a tese de que o ICMS destacado nas notas fiscais não compõe a base de cálculo do PIS e da COFINS. Constatamos que ' + E + ' manteve o ICMS na base de cálculo das contribuições em ' + fNum(inc.n) + ' itens de venda entre ' + ymLong(inc.mi) + ' e ' + ymLong(inc.ma) + ', o que resultou no pagamento a maior de ' + fBRL(inc.v) + ', em valores nominais, passível de recuperação.'
      : comIcms ? E + ' já exclui o ICMS destacado da base de cálculo do PIS e da COFINS nas vendas ' + desde + ', em conformidade com o Tema 69 do STF (RE 574.706/PR).' : ''
  });
  // 5. alíquota diferente da do regime do mês
  const al = { n: 0, v: 0, ex: null };
  for (const r of S.com) {
    if (r.cst === '02' || r.cst === '03') continue;
    const mo = S.monthIdx.get(r.ym), exp = mo && (mo.regime === 'NC' ? [1.65, 7.6] : mo.regime === 'CUM' ? [.65, 3] : null); if (!exp) continue;
    if ((r.vlrPis > 0 && r.aliqPis > 0 && Math.abs(r.aliqPis - exp[0]) > .001) || (r.vlrCof > 0 && r.aliqCof > 0 && Math.abs(r.aliqCof - exp[1]) > .001)) { al.n++; al.v += r.bcPis; if (!al.ex) al.ex = r; }
  }
  const pct = n => String(n).replace('.', ',') + '%';
  add({
    id: 'aliquota', t: 'Alíquota diferente da do regime do mês', st: al.n ? 'warn' : 'ok', n: al.n, v: al.n ? r2(al.v) : null,
    txt: al.n ? fNum(al.n) + ' itens tributados com alíquota fora do regime do mês (ex.: ' + pct(al.ex.aliqPis) + ' e ' + pct(al.ex.aliqCof) + ' em ' + al.ex.mes + '), base de ' + fBRL(al.v) + '.' : 'Todas as alíquotas conferem com o regime de cada mês.',
    acao: al.n ? 'Conferir: alíquota menor que a do regime indica débito a menor (contingência); maior indica pagamento a maior.' : 'Nada a fazer.', rel: ''
  });
  // 6. CST PIS x COFINS
  const cstDiv = S.recs.filter(r => r.cst && r.cstC && r.cst !== r.cstC);
  add({
    id: 'cst', t: 'CST de PIS diferente do CST de COFINS', st: cstDiv.length ? 'warn' : 'ok', n: cstDiv.length, v: cstDiv.length ? r2(cstDiv.reduce((a, r) => a + r.vlrItem, 0)) : null,
    txt: cstDiv.length ? fNum(cstDiv.length) + ' itens com CST diferente entre as duas contribuições (ex.: PIS ' + cstDiv[0].cst + ' e COFINS ' + cstDiv[0].cstC + ').' : 'CSTs de PIS e COFINS coerentes em todos os itens.',
    acao: cstDiv.length ? 'Conferir o cadastro tributário dos itens.' : 'Nada a fazer.', rel: ''
  });
  // 7. mesmo NCM tributado em umas vendas e não em outras
  const tribN = new Map(), naoN = new Map(), descN = new Map();
  for (const r of S.com) if (r.ncm && venda(r)) { tribN.set(r.ncm, (tribN.get(r.ncm) || 0) + r.vlrItem); if (!descN.has(r.ncm)) descN.set(r.ncm, r.desc); }
  for (const r of S.sem) if (r.ncm && venda(r) && CST_NAO_TRIB.has(r.cst)) { naoN.set(r.ncm, (naoN.get(r.ncm) || 0) + r.vlrItem); if (!descN.has(r.ncm)) descN.set(r.ncm, r.desc); }
  const ambos = [...tribN.keys()].filter(n => naoN.has(n)).sort((a, b) => (tribN.get(b) + naoN.get(b)) - (tribN.get(a) + naoN.get(a)));
  add({
    id: 'ncm-misto', t: 'NCM tributado em umas vendas e sem tributação em outras', st: ambos.length ? 'warn' : 'ok', n: ambos.length, v: null,
    txt: ambos.length ? ambos.length + ' NCM com tratamento diferente no período: ' + ambos.slice(0, 4).map(n => fmtNCM(n) + ' ' + String(descN.get(n) || '').toLowerCase().slice(0, 36) + ' (tributado ' + fBRL(tribN.get(n)) + ' · sem tributação ' + fBRL(naoN.get(n)) + ')').join('; ') + (ambos.length > 4 ? '; …' : '.') : 'Cada NCM tem o mesmo tratamento em todas as vendas.',
    acao: ambos.length ? 'Definir a tributação correta de cada NCM: se for monofásico ou de alíquota zero, as vendas tributadas entram no valor a recuperar; se for tributado, as vendas sem PIS/COFINS são contingência.' : 'Nada a fazer.',
    rel: ''
  });
  // 8. vendas sem PIS/COFINS de NCM fora das regras (possível débito a menor)
  const sr = { n: 0, base: 0, v: 0, ncms: new Set() };
  for (const r of S.sem) {
    if (!venda(r) || !CST_NAO_TRIB.has(r.cst) || !r.ncm || ncmRule(r.ncm)) continue;
    const mo = S.monthIdx.get(r.ym), a = mo && mo.regime === 'CUM' ? .0365 : .0925;
    sr.n++; sr.base += r.vlrItem; sr.v += r.vlrItem * a; sr.ncms.add(r.ncm);
  }
  add({
    id: 'sem-trib', t: 'Vendas sem PIS/COFINS de produtos fora das regras de monofásico e alíquota zero', st: sr.n ? 'warn' : 'ok', n: sr.n, v: sr.n ? r2(sr.v) : null,
    txt: sr.n ? fNum(sr.n) + ' itens vendidos sem as contribuições (CST 04 a 09) em ' + sr.ncms.size + ' NCM que não constam nas regras do Revisor: base de ' + fBRL(sr.base) + '. Se forem produtos tributados, o débito não recolhido seria de cerca de ' + fBRL(sr.v) + '.' : 'Todas as vendas sem PIS/COFINS têm NCM com regra de monofásico ou alíquota zero.',
    acao: sr.n ? 'Conferir o enquadramento desses NCM (a lista de regras é um ponto de partida e não esgota a legislação).' : 'Nada a fazer.', rel: ''
  });
  // 9. vendas consolidadas (NFC-e/cupom) sem o produto: a revisão por NCM não alcança essas vendas
  const cons = S.com.filter(r => !r.ncm && REG_CONSOLIDADO.test(r.registro));
  if (cons.length) {
    const vc = cons.reduce((a, r) => a + r.vlrItem, 0), pc = T.comV ? vc / T.comV * 100 : 0;
    add({
      id: 'consolidadas', t: 'Vendas consolidadas sem o produto (NFC-e e cupom)', st: 'info', n: cons.length, v: r2(vc),
      txt: fNum(cons.length) + ' linhas de venda consolidada (' + [...new Set(cons.map(r => (r.registro.match(REG_CONSOLIDADO) || [''])[0].toUpperCase()))].join(', ') + '), ' + fBRL(vc) + ' (' + NUM.format(Math.round(pc)) + '% das vendas tributadas). O SPED não traz NCM nem descrição dessas vendas.',
      acao: 'Para estender a revisão de monofásicos e alíquota zero às vendas de balcão, pedir os XML das NFC-e ou o relatório de vendas por produto do sistema da empresa.',
      rel: 'As vendas registradas por NFC-e são escrituradas de forma consolidada na EFD-Contribuições (' + fBRL(vc) + ' no período), sem a identificação dos produtos. A análise destas vendas por NCM depende dos arquivos XML das notas, que podem ser solicitados para ampliar a revisão.'
    });
  }
  // 10. vendas tributadas sem NCM (fora as consolidadas)
  const semNcm = S.com.filter(r => !r.ncm && !/^a1/i.test(r.registro) && !REG_CONSOLIDADO.test(r.registro) && !/^\d3(5[1-9]|60)$/.test(r.cfop || ''));
  add({
    id: 'ncm', t: 'Vendas tributadas sem NCM', st: semNcm.length ? 'warn' : 'ok', n: semNcm.length, v: semNcm.length ? r2(semNcm.reduce((a, r) => a + r.vlrItem, 0)) : null,
    txt: semNcm.length ? fNum(semNcm.length) + ' itens sem NCM: a classificação depende da descrição.' : 'Todos os itens de mercadoria têm NCM.',
    acao: semNcm.length ? 'Classificar pela descrição ou pedir o XML das notas.' : 'Nada a fazer.', rel: ''
  });
  return out;
}


/* --- resumo de cada análise para a minuta no modelo da Milk (fica guardado junto com a análise) --- */
function buildResumo() {
  const ck = Object.fromEntries(S.checks.map(c => [c.id, c]));
  const faixas = [];
  for (const m of S.months) { const f = faixas[faixas.length - 1]; if (f && f.reg === m.regime) { f.fim = m.ym; f.n++; } else faixas.push({ reg: m.regime, ini: m.ym, fim: m.ym, n: 1 }); }
  const anosReg = {};
  for (const m of S.months) { const a = anosReg[m.ano] || (anosReg[m.ano] = { NC: 0, CUM: 0, SEM: 0 }); a[m.regime]++; }
  const ult = [...S.months].reverse().find(m => m.regime !== 'SEM');
  const R = { tipo: S.tipo, cnpj: S.empresa.cnpj, ini: S.months[0].ym, fim: S.months[S.months.length - 1].ym, faixas, anosReg, regimeAtual: ult ? ult.regime : null, pot: { base: r2(S.pot.base), pis: r2(S.pot.pis), cof: r2(S.pot.cof) } };
  if (S.tipo === 'ENT') {
    const porNcm = new Map();
    for (const r of S.alvo) { const c = creditOf(r); if (!c) continue; const k = r.ncm || '-'; let x = porNcm.get(k); if (!x) porNcm.set(k, x = { ncm: r.ncm, desc: r.desc, base: 0, pis: 0, cof: 0, n: 0 }); x.base += c.base; x.pis += c.pis; x.cof += c.cof; x.n++; }
    R.ncms = [...porNcm.values()].sort((a, b) => (b.pis + b.cof) - (a.pis + a.cof));
    R.icmsCred = S.icmsEnt || null;
    R.usoConsumo = ck['uso-consumo'] ? ck['uso-consumo'].v || 0 : 0;
    R.estoque = ck.estoque ? { st: ck.estoque.st, n: ck.estoque.n, txt: ck.estoque.txt } : null;
  } else {
    const cat = { zero: { base: 0, pis: 0, cof: 0 }, outras: { base: 0, pis: 0, cof: 0 } };
    for (const r of S.alvo) { const c = creditOf(r); if (!c) continue; const g = r.g, k = !r.ov && !(g.dec && g.dec !== g.sug.cls) && /Alíquota zero|Monofásico/.test(g.sug.cat || '') ? 'zero' : 'outras'; cat[k].base += c.base; cat[k].pis += c.pis; cat[k].cof += c.cof; }
    R.aliqZero = cat.zero; R.outrasReceitas = cat.outras;
    // por categoria (venda de ativo, alíquota zero, exportação...), para o quadro geral
    const cm = new Map();
    for (const r of S.alvo) { const c = creditOf(r); if (!c) continue; const g = r.g, k = (!r.ov && !(g.dec && g.dec !== g.sug.cls) && g.sug.cat) || 'Receitas não tributáveis'; const x = cm.get(k) || { cat: k, base: 0, pis: 0, cof: 0, mi: 999999, ma: 0 }; x.base += c.base; x.pis += c.pis; x.cof += c.cof; if (r.ym < x.mi) x.mi = r.ym; if (r.ym > x.ma) x.ma = r.ym; cm.set(k, x); }
    R.cats = [...cm.values()].map(x => Object.assign(x, { base: r2(x.base), pis: r2(x.pis), cof: r2(x.cof) })).sort((a, b) => (b.pis + b.cof) - (a.pis + a.cof));
    // produtos de alíquota zero ou monofásicos vendidos com tributação (vão para o parágrafo de alíquota zero do diagnóstico)
    const zm = new Map();
    for (const g of S.groups) { if ((g.dec || g.sug.cls) !== CLS.COM || (g.dec && g.dec !== g.sug.cls) || !/Alíquota zero|Monofásico/.test(g.sug.cat || '') || !g.ncm) continue; const k = g.ncm, nr = ncmRule(g.ncm); const x = zm.get(k) || { ncm: g.ncm, nome: nr ? nr.nome : g.descTop, v: 0 }; x.v += g.vlr; zm.set(k, x); }
    R.zeroNcms = [...zm.values()].sort((a, b) => b.v - a.v);
    R.icms = S.icmsSai || null;
  }
  return R;
}

/* --- várias análises abertas ao mesmo tempo (a 037 e a 047 da mesma empresa) --- */
const SNAP_KEYS = ['loaded', 'demo', 'tipo', 'files', 'empresa', 'headers', 'hkey', 'map', 'hasAnoMes', 'recs', 'com', 'sem', 'alvo', 'groups', 'months', 'monthIdx', 'totals', 'regTable', 'timings', 'procMs', 'pot', 'potYears', 'checks', 'clsCount', 'resumo', 'icmsSai', 'icmsEnt'];
S.analyses = {};
function guardarAnalise() { if (!S.loaded) return; const snap = {}; for (const k of SNAP_KEYS) snap[k] = S[k]; S.analyses[S.tipo] = { snap }; }
function ativarAnalise(tipo) {
  const a = S.analyses[tipo]; if (!a) return false;
  guardarAnalise();
  Object.assign(S, a.snap); setMode(tipo); recompute();
  return true;
}
/* a outra análise só entra na minuta se for da mesma empresa (mesmo CNPJ) */
function resumoDe(tipo) {
  if (S.tipo === tipo) return S.resumo;
  const a = S.analyses[tipo]; if (!a || !a.snap.resumo) return null;
  return digits(a.snap.empresa.cnpj) === digits(S.empresa.cnpj) ? a.snap.resumo : null;
}
