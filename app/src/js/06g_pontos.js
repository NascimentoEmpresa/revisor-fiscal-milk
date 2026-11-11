/* ======================= Outros pontos da EFD ICMS/IPI x EFD-Contribuições =======================
   Como a analista fez no diagnóstico da MAXXI (01/2026):
   1. Exclusão do ICMS da base do PIS/COFINS, mês a mês: a receita da 070 (Vlr Operação dos CFOP de receita) menos o
      ICMS destacado, comparada com a base do PIS/COFINS dos documentos com ICMS na 047 (C100, D100/D200, modelos 55/57/65/67).
      Quando a base declarada fica perto da receita com o ICMS, a empresa não excluiu o ICMS naquele mês e o ICMS
      inteiro do mês é o valor a recuperar (9,25% no não cumulativo, 3,65% no cumulativo).
   2. Anulação de prestação de serviço de transporte (CFOP 1206/2206, 069): a receita anulada pagou PIS/COFINS. No não
      cumulativo, se a nota não entrou com crédito na 037, o crédito é (Vlr Operação − ICMS) × 9,25%. No cumulativo, a
      anulação reduz a base no M215: só conferir.
   3. Devolução de compra com ICMS destacado (5202, 5556, 5553...): se a entrada não teve crédito de ICMS, o débito da
      devolução é estornado por um ajuste C197 ("crédito ref. devolução NF ..."). Sem o ajuste, o ICMS pode ser recuperado. */

const ehDocIcms = (reg, mod) => /^(55|57|65|67|01|1B|04|08|8B|09|10|11|26|27)$/i.test(mod) || /^[CD]/i.test(reg || '');
const ymFaixa = (a, b) => !a ? '' : a === b ? ymTxt(a) : ymTxt(a) + ' a ' + ymTxt(b);
const anaSAI = () => { const a = S.tipo === 'SAI' ? S : (S.analyses.SAI && S.analyses.SAI.snap); return a && a.recs && digits(a.empresa.cnpj) === digits(S.empresa.cnpj) ? a : null; };
const anaENT = () => { const a = S.tipo === 'ENT' ? S : (S.analyses.ENT && S.analyses.ENT.snap); return a && a.recs && digits(a.empresa.cnpj) === digits(S.empresa.cnpj) ? a : null; };
const aliqRegime = rg => rg === 'NC' ? { pis: 0.0165, cof: 0.076, t: '9,25%' } : rg === 'CUM' ? { pis: 0.0065, cof: 0.03, t: '3,65%' } : null;
const corteOutros = () => (S.extras.icmsS && (S.extras.icmsS.corteOutros || S.extras.icmsS.corteYm)) || (S.extras.icmsE && S.extras.icmsE.corteOutros) || corte5anos();
function divPC(base, al) { const tot = r2(base * (al.pis + al.cof)), pis = r2(base * al.pis); return { pis, cof: r2(tot - pis), tot }; }

/* 1. exclusão do ICMS por mês (070 x 047) */
function analisarExclusao() {
  const c = extrasDaEmpresa().icmsS, a = anaSAI();
  if (!c || !c.rec || !c.rec.size) return null;
  const R = { meses: [], com047: !!a, cut: corteOutros(), icms: 0, base: 0, pis: 0, cof: 0, v925: 0, semRegime: 0, n: 0, mi: 0, ma: 0, itens047: a && a.icmsSai ? a.icmsSai.comIcms : 0 };
  if (!a) return R;
  const iMod = a.hkey ? a.hkey.indexOf('modelo') : -1, bc = new Map();
  for (const r of a.recs) { if (!ehDocIcms(r.registro, iMod >= 0 ? String(r.v[iMod] == null ? '' : r.v[iMod]).trim() : '')) continue; bc.set(r.ym, (bc.get(r.ym) || 0) + (r.bcPis || 0)); }
  for (const ym of [...c.rec.keys()].sort((x, y) => x - y)) {
    const x = c.rec.get(ym), E = r2(x.icms); if (E <= 0.009) continue;
    const C = r2(x.op), G = r2(bc.get(ym) || 0), liq = r2(C - E), nao = Math.max(0, Math.min(E, r2(G - liq))), pct = nao / E;
    const rg = regimePC(ym), al = aliqRegime(rg), dentro = ym >= R.cut;
    const auto = pct >= 0.5, ov = c.exclOv[ym], sel = dentro && (ov != null ? ov : auto);
    const m = { ym, op: C, icms: E, bc: G, liq, nao: r2(nao), pct, rg, auto, ov: ov != null, sel, dentro, pis: 0, cof: 0 };
    if (sel) {
      R.icms += E; R.n++; R.v925 += E * 0.0925; if (!R.mi) R.mi = ym; R.ma = ym;
      if (al) { const v = divPC(E, al); m.pis = v.pis; m.cof = v.cof; R.base += E; R.pis += v.pis; R.cof += v.cof; } else R.semRegime += E;
    }
    R.meses.push(m);
  }
  R.icms = r2(R.icms); R.base = r2(R.base); R.pis = r2(R.pis); R.cof = r2(R.cof); R.v925 = r2(R.v925);
  return R;
}

/* 2. anulações 1206/2206 (069) */
function analisarAnulacoes() {
  const X = extrasDaEmpresa(), c = X.icmsE; if (!c || !c.anul) return null;
  const e = anaENT(), cred = new Set();
  if (e && e.map && e.map.chave != null) for (const r of e.recs) if ((r.vlrPis || 0) > 0) cred.add(String(r.v[e.map.chave] || ''));
  const R = { docs: [], cut: corteOutros(), base: 0, pis: 0, cof: 0, n: 0, cum: 0, cumBase: 0, mi: 0, ma: 0, com037: !!e };
  for (const d of [...c.anul].sort((x, y) => x.ym - y.ym)) {
    const base = r2(d.op - d.icms), rg = regimePC(d.ym), ov = c.anulOv[d.k];
    let st, sel = false;
    if (d.ym < R.cut) st = 'fora do prazo de 5 anos';
    else if (base <= 0) st = 'sem valor';
    else if (cred.has(d.ch)) st = 'já creditada na 037';
    else if (rg === 'NC') { st = 'sem crédito na 037'; sel = true; }
    else if (rg === 'CUM') { st = 'cumulativo: conferir o ajuste de redução no M215'; R.cum++; R.cumBase += base; }
    else st = 'sem regime conhecido: importe a 037/047 ou a ECF';
    if (ov != null && d.ym >= R.cut && base > 0) sel = ov;
    const al = aliqRegime(rg) || aliqRegime('NC'), v = sel ? divPC(base, al) : { pis: 0, cof: 0 };
    R.docs.push(Object.assign({}, d, { base, rg, st, sel, ov: ov != null, pis: v.pis, cof: v.cof }));
    if (sel) { R.n++; R.base += base; R.pis += v.pis; R.cof += v.cof; if (!R.mi) R.mi = d.ym; R.ma = d.ym; }
  }
  R.base = r2(R.base); R.pis = r2(R.pis); R.cof = r2(R.cof); R.cumBase = r2(R.cumBase);
  return R;
}

/* 3. devoluções de compra com ICMS destacado (070) x ajustes C197 dos SPEDs */
function analisarDevolucoes() {
  const X = extrasDaEmpresa(), c = X.icmsS; if (!c || !c.dev) return null;
  const sp = X.ie0150, aj = sp && sp.aj ? [...sp.aj.values()] : [], credPart = X.icmsE && X.icmsE.credPart;
  const R = { docs: [], cut: corteOutros(), icms: 0, n: 0, semSped: 0, estornado: 0, mi: 0, ma: 0, comSped: !!sp, cfops: new Set() };
  for (const d of [...c.dev].sort((x, y) => x.ym - y.ym)) {
    const num = d.num.replace(/^0+/, ''), reNum = num ? new RegExp('(^|\\D)0*' + num + '(\\D|$)') : null;
    const a = aj.find(x => x.ch === d.ch) || aj.find(x => Math.abs(x.vlr - d.icms) < 0.015 && ((reNum && reNum.test(x.desc)) || (x.part && x.part === d.part)));
    let st, sel;
    if (d.ym < R.cut) { st = 'fora do prazo de 5 anos'; sel = false; }
    else if (a) { st = 'estornado no C197 ' + a.cod + ' (' + ymTxt(a.ym) + ')'; sel = false; R.estornado += d.icms; }
    else if (sp && sp.meses.has(d.ym)) { st = 'sem ajuste C197 nos SPEDs'; sel = true; }
    else { st = 'sem o SPED do mês: conferir o C197'; sel = true; R.semSped++; }
    if (sel && credPart && credPart.has(d.part)) st += ' · o fornecedor tem entradas com crédito de ICMS na 069: conferir a nota devolvida';
    const ov = c.devOv[d.k]; if (ov != null && d.ym >= R.cut) sel = ov;
    R.docs.push(Object.assign({}, d, { st, sel, ov: ov != null, aj: a || null }));
    if (sel) { R.n++; R.icms += d.icms; R.cfops.add(d.cfop); if (!R.mi) R.mi = d.ym; R.ma = d.ym; }
  }
  R.icms = r2(R.icms); R.estornado = r2(R.estornado);
  return R;
}

/* 4. crédito presumido de ICMS: quem usa o presumido não pode tomar crédito das entradas (069) no mesmo período.
   Ficam de fora o ressarcimento de ST (1603/2603) e as anulações (1206/2206). */
function analisarEstornoPresumido() {
  const X = extrasDaEmpresa(), c = X.icmsE, sP = X.icmsS && X.icmsS.presumido; if (!c || !c.cred) return null;
  const per = sP ? periodoIE(sP) : null, R = { docs: [], icms: 0, n: 0, mi: 0, ma: 0, semPeriodo: !per || per.nao };
  if (R.semPeriodo) return R;
  for (const d of [...c.cred].sort((a, b) => a.ym - b.ym)) {
    if (d.ym < per.ini || d.ym > per.fim || /^[12]603$/.test(d.cfop)) continue;
    R.docs.push(d); R.n++; R.icms += d.icms; if (!R.mi) R.mi = d.ym; R.ma = d.ym;
  }
  R.icms = r2(R.icms); return R;
}

/* ---------- quadro geral, no formato do diagnóstico (BLOCO, DESCRIÇÃO, PERÍODO, VALOR) ---------- */
function quadroGeral() {
  const X = extrasDaEmpresa(), E = resumoDe('ENT'), Sa = resumoDe('SAI'), Q = quadroResumo();
  const rec = [], recolher = [], per = (a, b) => a ? ymFaixa(a, b) : 'Diversos';
  const add = (lst, bloco, desc, p, v, k) => { if (v && v > 0.004) lst.push({ bloco, desc, per: p, v: r2(v), k }); };
  const le = Q.L.find(l => l.k === 'ent'); if (E && le.v) add(rec, 'PIS/COFINS', 'Notas lançadas sem crédito (037)', per(E.ini, E.fim), le.v.pis + le.v.cof, 'ent');
  const ex = Q.L.find(l => l.k === 'icms');
  if (ex && ex.v) add(rec, 'PIS/COFINS', 'Exclusão do ICMS da base de cálculo', ex.per || per(Sa && Sa.icms && Sa.icms.mi, Sa && Sa.icms && Sa.icms.ma), ex.v.pis + ex.v.cof, 'icms');
  if (Sa && Sa.cats) for (const c of Sa.cats) {
    const nome = /ativo/i.test(c.cat) ? 'venda de ativo' : c.cat.toLowerCase();
    const pc = c.mi && c.mi < 999999 ? ymFaixa(c.mi, c.ma) : 'Diversos'; add(rec, 'PIS/COFINS', 'PIS indevido sobre ' + nome, pc, c.pis, 'sai'); add(rec, 'PIS/COFINS', 'COFINS indevida sobre ' + nome, pc, c.cof, 'sai');
  }
  const an = Q.L.find(l => l.k === 'anul'); if (an && an.v) add(rec, 'PIS/COFINS', 'Crédito não apropriado – anulação', an.per, an.v.pis + an.v.cof, 'anul');
  const j = Q.L.find(l => l.k === 'j513'); if (j && j.v) add(rec, 'PIS/COFINS', 'Notas não escrituradas no EFD-Contribuições', 'Diversos', j.v.pis + j.v.cof, 'j513');
  const d = Q.L.find(l => l.k === 'ecd');
  if (d && d.v) add(rec, 'PIS/COFINS', 'Diferenças ECD x EFD-Contribuições', X.ecdA ? X.ecdA.anosEscopo.join(', ') : 'Diversos', d.v.pis + d.v.cof, 'ecd');
  const ic = X.icmsS && X.icmsS.res;
  if (ic && ic.icms > 0) { const an2 = [...ic.anos.keys()].sort(); add(rec, 'ICMS', 'ICMS indevido em prestações isentas (RS)', an2.length > 1 ? an2[0] + ' a ' + an2[an2.length - 1] : String(an2[0]), ic.icms, 'cte'); }
  const dv = analisarDevolucoes();
  if (dv && dv.icms > 0) add(rec, 'ICMS', 'Créditos não aproveitados ' + [...dv.cfops].sort().join(' e '), dv.mi === dv.ma ? ymTxt(dv.mi) : 'Diversos', dv.icms, 'dev');
  const sst = Sa && Sa.servSemTrib; if (sst && sst.v > 0) add(recolher, 'PIS/COFINS', 'PIS/COFINS não recolhidos sobre serviços (' + sst.regs.join('/') + ', base ' + fBRL(sst.base) + ')', ymFaixa(sst.mi, sst.ma), sst.v, 'servsem');
  const ep = analisarEstornoPresumido(); if (ep && ep.icms > 0) add(recolher, 'ICMS', 'Créditos indevidos a estornar (entradas com crédito no período do crédito presumido)', ep.mi === ep.ma ? ymTxt(ep.mi) : ymTxt(ep.mi) + ' a ' + ymTxt(ep.ma), ep.icms, 'estorno');
  if (ic && ic.presum > 0) add(recolher, 'ICMS', 'Reflexo no crédito presumido (20% do ICMS recuperado)', '', ic.presum, 'presum');
  if (ic && ic.pc > 0) add(recolher, 'PIS/COFINS', 'Reflexo da recuperação do ICMS (volta à base do PIS/COFINS)', '', ic.pc, 'reflexo');
  const tot = l => r2(l.reduce((a, x) => a + x.v, 0));
  return { rec, recolher, totRec: tot(rec), totRecolher: tot(recolher) };
}

/* ---------- tela ---------- */
function cardPontos(X) {
  const ex = analisarExclusao(), an = analisarAnulacoes(), dv = analisarDevolucoes();
  if (!ex && !an && !dv && !X.icmsE) return '';
  let h = '<section class="card"><div class="card-h"><h2>Outros pontos · EFD ICMS/IPI x EFD-Contribuições</h2><span class="sub">exclusão do ICMS por mês · anulações 1206 · devoluções com ICMS</span></div><div class="card-b">';
  const k = [];
  if (ex) k.push(kpi('Exclusão do ICMS (070 x 047)', ex.com047 ? fBRLc(ex.pis + ex.cof) : '—', ex.com047 ? fNum(ex.n) + ' meses sem exclusão · ICMS ' + fBRL(ex.icms) : 'importe a 047'));
  if (an) k.push(kpi('Anulações 1206/2206 (069)', fBRLc(an.pis + an.cof), fNum(an.n) + ' notas sem crédito · base ' + fBRL(an.base)));
  if (dv) k.push(kpi('Devoluções com ICMS (070)', fBRLc(dv.icms), fNum(dv.n) + ' notas sem estorno' + (dv.estornado ? ' · ' + fBRL(dv.estornado) + ' estornados' : '')));
  h += '<div class="kpis">' + k.join('') + '</div>';
  h += '<div class="toolbar" style="margin:14px 0 4px;align-items:flex-end;gap:12px"><div class="field" style="max-width:230px"><label for="f-pcorte">Prazo destes pontos: a partir de</label><input type="text" id="f-pcorte" class="mono" value="' + esc(ymTxt(corteOutros())) + '" placeholder="mm/aaaa"></div><span class="small muted" style="padding-bottom:10px">Sem informar, vale o prazo do card do ICMS.</span><span style="flex:1"></span><button class="btn" data-oact="pontos-xlsx" type="button">' + ICON.dl + 'Excel dos outros pontos</button></div>';
  if (ex) {
    h += '<h3 class="small" style="margin:16px 0 6px">1. Exclusão do ICMS da base do PIS/COFINS, por mês</h3>';
    if (!ex.com047) h += '<div class="err-box">Importe a 047 desta empresa: o Revisor compara a receita da 070 menos o ICMS com a base do PIS/COFINS declarada em cada mês.</div>';
    else {
      if (ex.itens047) h += '<p class="small muted">A 047 traz o ICMS por item (' + fNum(ex.itens047) + ' itens): o quadro usa o cálculo por item da 047. Esta comparação fica como conferência.</p>';
      const mostra = S.ui.exTodos ? ex.meses : ex.meses.filter(m => m.sel || m.auto || m.ov);
      h += '<div class="toolbar" style="margin:4px 0 8px"><span class="seg"><button type="button" data-ex-todos="0" aria-pressed="' + !S.ui.exTodos + '">Sem exclusão <span class="ct">' + ex.meses.filter(m => m.sel || m.auto || m.ov).length + '</span></button><button type="button" data-ex-todos="1" aria-pressed="' + !!S.ui.exTodos + '">Todos os meses <span class="ct">' + ex.meses.length + '</span></button></span></div>';
      h += '<div class="tbl-wrap"><table><thead><tr><th>Mês</th><th>Regime</th><th class="n">Receita 070</th><th class="n">ICMS</th><th class="n">Receita − ICMS</th><th class="n">Base PIS/COFINS (047)</th><th class="n">ICMS na base</th><th>Entra</th><th class="n">PIS + COFINS</th></tr></thead><tbody>' +
        (mostra.length ? mostra.map(m => '<tr><td class="mono">' + ymTxt(m.ym) + '</td><td class="small">' + (m.rg === 'NC' ? 'não cumulativo' : m.rg === 'CUM' ? 'cumulativo' : '—') + '</td><td class="n">' + fBRL(m.op) + '</td><td class="n">' + fBRL(m.icms) + '</td><td class="n">' + fBRL(m.liq) + '</td><td class="n">' + fBRL(m.bc) + '</td>' +
          '<td class="n">' + Math.round(m.pct * 100) + '%</td><td>' + (m.dentro ? '<label class="small"><input type="checkbox" data-ex="' + m.ym + '"' + (m.sel ? ' checked' : '') + '> ' + (m.ov ? 'decisão sua' : m.auto ? 'não excluiu' : 'já excluiu') + '</label>' : '<span class="small muted">fora do prazo</span>') + '</td><td class="n"><b>' + (m.sel ? fBRL(m.pis + m.cof) : '—') + '</b></td></tr>').join('')
          : '<tr><td colspan="9" class="muted small">Em todos os meses a base do PIS/COFINS já está sem o ICMS.</td></tr>') + '</tbody></table></div>';
      h += '<p class="small muted" style="margin-top:8px">"ICMS na base" = quanto do ICMS do mês ficou dentro da base declarada. Acima de 50%, o Revisor considera que a empresa não excluiu e conta o ICMS inteiro do mês (como a analista). Alíquota pelo regime de cada mês: 9,25% no não cumulativo e 3,65% no cumulativo' +
        (ex.v925 && Math.abs(ex.v925 - (ex.pis + ex.cof)) > 0.01 ? '. A 9,25% em todos os meses, daria ' + fBRL(ex.v925) + '.' : '.') + (ex.semRegime ? ' Sem regime conhecido para ' + fBRL(ex.semRegime) + ' de ICMS.' : '') + '</p>';
    }
  }
  if (an) {
    h += '<h3 class="small" style="margin:18px 0 6px">2. Anulações de prestação de serviço de transporte (CFOP 1206/2206)</h3>';
    if (!an.com037) h += '<div class="err-box">Sem a 037, o Revisor não sabe se a anulação entrou com crédito. Importe a 037 desta empresa.</div>';
    const anL = S.ui.anTodas ? an.docs : an.docs.filter(d => d.sel || d.ov || d.rg !== 'CUM');
    if (an.cum) h += '<div class="toolbar" style="margin:4px 0 8px"><span class="seg"><button type="button" data-an-todas="0" aria-pressed="' + !S.ui.anTodas + '">Não cumulativo <span class="ct">' + an.docs.filter(d => d.sel || d.ov || d.rg !== 'CUM').length + '</span></button><button type="button" data-an-todas="1" aria-pressed="' + !!S.ui.anTodas + '">Todas <span class="ct">' + an.docs.length + '</span></button></span></div>';
    h += anL.length ? '<div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Nota</th><th>Tomador</th><th class="n">Valor</th><th class="n">ICMS</th><th class="n">Base</th><th>Situação</th><th class="n">PIS + COFINS</th></tr></thead><tbody>' +
      anL.slice(0, S.ui.anN || 60).map(d => '<tr><td class="mono small">' + esc(fDataBr(d.data)) + '</td><td class="mono small">' + esc(d.num) + '</td><td class="small">' + esc(d.nome || fmtCNPJ(d.part)) + '</td><td class="n">' + fBRL(d.op) + '</td><td class="n">' + fBRL(d.icms) + '</td><td class="n">' + fBRL(d.base) + '</td>' +
        '<td><label class="small"><input type="checkbox" data-an="' + esc(d.k) + '"' + (d.sel ? ' checked' : '') + (d.ym < an.cut || d.base <= 0 ? ' disabled' : '') + '> ' + esc(d.ov ? 'decisão sua' : d.st) + '</label></td><td class="n"><b>' + (d.sel ? fBRL(d.pis + d.cof) : '—') + '</b></td></tr>').join('') + '</tbody></table></div>' +
      (anL.length > (S.ui.anN || 60) ? '<div class="toolbar" style="justify-content:center;margin-top:8px"><button class="btn" data-oact="an-mais" type="button">Mostrar mais</button></div>' : '') : (an.docs.length ? '<p class="small muted">Nenhuma anulação em mês não cumulativo.</p>' : '<p class="small muted">Nenhuma anulação 1206/2206 na 069.</p>');
    h += '<p class="small muted" style="margin-top:8px">Base = valor da operação − ICMS, × 9,25% nos meses não cumulativos, quando a nota não entrou com crédito na 037.' + (an.cum ? ' ' + fNum(an.cum) + ' anulações em meses cumulativos (' + fBRL(an.cumBase) + '): no cumulativo elas reduzem a base no M215; confira se o ajuste foi feito e marque as que faltaram.' : '') + '</p>';
  }
  if (dv) {
    h += '<h3 class="small" style="margin:18px 0 6px">3. Devoluções de compra com ICMS destacado</h3>';
    if (!dv.comSped) h += '<div class="err-box">Sem os SPEDs da EFD ICMS (.txt), o Revisor não confere se o ICMS da devolução foi estornado por ajuste C197. Importe os arquivos .txt do período.</div>';
    h += dv.docs.length ? '<div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Nota</th><th>CFOP</th><th>Fornecedor</th><th class="n">ICMS</th><th>Situação</th></tr></thead><tbody>' +
      dv.docs.map(d => '<tr><td class="mono small">' + esc(fDataBr(d.data)) + '</td><td class="mono small">' + esc(d.num) + '</td><td class="mono">' + d.cfop + '</td><td class="small">' + esc(d.nome || fmtCNPJ(d.part)) + '</td><td class="n">' + fBRL(d.icms) + '</td>' +
        '<td><label class="small"><input type="checkbox" data-dv="' + esc(d.k) + '"' + (d.sel ? ' checked' : '') + (d.ym < dv.cut ? ' disabled' : '') + '> ' + esc(d.ov ? 'decisão sua' : d.st) + '</label></td></tr>').join('') + '</tbody></table></div>' : '<p class="small muted">Nenhuma devolução de compra com ICMS na 070.</p>';
    h += '<p class="small muted" style="margin-top:8px">Na devolução de compra sem crédito na entrada (uso e consumo, por exemplo), o ICMS destacado deve ser estornado por um ajuste C197. Marcadas: entram no quadro como crédito de ICMS a recuperar.</p>';
  }
  const ep = analisarEstornoPresumido();
  if (ep) {
    h += '<h3 class="small" style="margin:18px 0 6px">4. Crédito presumido de ICMS x créditos das entradas (069)</h3>';
    h += ep.semPeriodo ? '<p class="small muted">Informe o período do crédito presumido de 20% no card do ICMS (ex.: 01/2022 a 09/2025) para o Revisor procurar créditos de entrada que precisam ser estornados.</p>'
      : ep.docs.length ? '<div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Nota</th><th>CFOP</th><th>Fornecedor</th><th class="n">ICMS creditado</th></tr></thead><tbody>' + ep.docs.map(d => '<tr><td class="mono small">' + esc(fDataBr(d.data)) + '</td><td class="mono small">' + esc(d.num) + '</td><td class="mono">' + d.cfop + '</td><td class="small">' + esc(d.nome || fmtCNPJ(d.part)) + '</td><td class="n">' + fBRL(d.icms) + '</td></tr>').join('') + '</tbody></table></div><p class="small muted" style="margin-top:8px">Quem usa o crédito presumido não pode aproveitar outros créditos de ICMS das entradas no período: o total (' + fBRL(ep.icms) + ') vai para o quadro geral como valor a estornar.</p>'
      : '<p class="small muted">Nenhuma entrada com crédito de ICMS no período do crédito presumido.</p>';
  }
  return h + '</div></section>';
}

function cardQuadroGeral() {
  const G = quadroGeral(); if (!G.rec.length && !G.recolher.length) return '';
  const lin = x => '<tr><td class="small">' + x.bloco + '</td><td>' + esc(x.desc) + '</td><td class="mono small">' + esc(x.per) + '</td><td class="n">' + fBRL(x.v) + '</td></tr>';
  return '<section class="card"><div class="card-h"><h2>Quadro geral · a recuperar e a recolher</h2><span class="sub">no formato do diagnóstico · vai para o Word</span></div><div class="card-b"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bloco</th><th>Descrição</th><th>Período</th><th class="n">Valor (R$)</th></tr></thead><tbody>' +
    G.rec.map(lin).join('') + '<tr class="tot"><td></td><td colspan="2"><b>Total a recuperar</b></td><td class="n"><b>' + fBRL(G.totRec) + '</b></td></tr>' +
    (G.recolher.length ? G.recolher.map(lin).join('') + '<tr class="tot"><td></td><td colspan="2"><b>Total a recolher</b></td><td class="n"><b>' + fBRL(G.totRecolher) + '</b></td></tr>' : '') +
    '</tbody></table></div><p class="small muted" style="margin-top:8px">Valores nominais, sem correção. Os pontos que dependem de documento fora do SistemaMA (PER/DCOMP, valores não recolhidos, estornos de crédito) a analista acrescenta no Word.</p></div></section>';
}

function bindPontos(e) {
  const t = e.target;
  if (t.id === 'f-pcorte') { const p = periodoIE(t.value), c = S.extras.icmsS || S.extras.icmsE; if (c) c.corteOutros = p && p.ini ? p.ini : null; refreshOutras(); return true; }
  if (t.matches('input[data-ex]')) { const c = S.extras.icmsS, ym = +t.dataset.ex, m = analisarExclusao().meses.find(x => x.ym === ym); c.exclOv[ym] = t.checked; if (m && t.checked === m.auto) delete c.exclOv[ym]; refreshOutras(); return true; }
  if (t.matches('input[data-an]')) { const c = S.extras.icmsE, k = t.dataset.an; c.anulOv[k] = t.checked; refreshOutras(); return true; }
  if (t.matches('input[data-dv]')) { const c = S.extras.icmsS, k = t.dataset.dv; c.devOv[k] = t.checked; refreshOutras(); return true; }
  return false;
}

/* ---------- Excel ---------- */
async function buildWorkbookPontos(onProgress) {
  const ex = analisarExclusao(), an = analisarAnulacoes(), dv = analisarDevolucoes(), G = quadroGeral(), B = new XlsxBook();
  const emp = S.empresa.nome || fmtCNPJ(S.extras.cnpj);
  B.title = 'Outros pontos - EFD ICMS x Contribuições - ' + emp;
  B.addSheet({
    name: 'QUADRO GERAL', tab: 'FF1C7A55', grid: false, cols: [14, 56, 22, 18],
    rows: async (emit) => {
      emit([{ v: 'Quadro geral — ' + emp, s: XS.title }], { ht: 24 });
      emit([{ v: 'Valores nominais. A recuperar e a recolher, no formato do diagnóstico.', s: XS.note }]); emit([]);
      emit(['BLOCO', 'DESCRIÇÃO', 'PERÍODO', 'VALOR (R$)'], { s: XS.headG });
      for (const x of G.rec) emit([x.bloco, x.desc, x.per, { v: x.v, s: XS.brl }]);
      emit(['', { v: 'TOTAL A RECUPERAR', s: XS.txtB }, '', { v: G.totRec, s: XS.brlB }]); emit([]);
      for (const x of G.recolher) emit([x.bloco, x.desc, x.per, { v: x.v, s: XS.brl }]);
      if (G.recolher.length) emit(['', { v: 'TOTAL A RECOLHER', s: XS.txtB }, '', { v: G.totRecolher, s: XS.brlB }]);
    }
  });
  if (ex && ex.com047) B.addSheet({
    name: 'EXCLUSÃO ICMS', grid: false, freeze: { row: 4 }, cols: [10, 16, 18, 16, 18, 20, 18, 12, 16, 14, 14, 16],
    rows: async (emit) => {
      emit([{ v: 'Exclusão do ICMS da base do PIS/COFINS, por mês (070 x 047)', s: XS.title }], { ht: 24 });
      emit([{ v: 'C = Vlr Operação dos CFOP de receita na 070; E = ICMS destacado; F = C − E; G = base do PIS/COFINS dos documentos com ICMS na 047 (C100, D100/D200). Se G − F passa de 50% do ICMS, a empresa não excluiu: entra o ICMS inteiro do mês. Prazo: a partir de ' + ymTxt(ex.cut) + '.', s: XS.note }]);
      emit([]);
      const h = emit(['Mês', 'Regime', 'Receita 070 (C)', 'ICMS (E)', 'C − E (F)', 'Base PIS/COFINS 047 (G)', 'G − F', 'ICMS na base', 'Situação', 'PIS', 'COFINS', 'Total'], { s: XS.headG });
      for (const m of ex.meses) emit([ymTxt(m.ym), m.rg === 'NC' ? 'Não cumulativo' : m.rg === 'CUM' ? 'Cumulativo' : '—', { v: m.op, s: XS.brl }, { v: m.icms, s: XS.brl }, { v: m.liq, s: XS.brl }, { v: m.bc, s: XS.brl }, { v: r2(m.bc - m.liq), s: XS.brl }, { v: m.pct, s: XS.pct },
        !m.dentro ? 'fora do prazo' : m.sel ? (m.ov ? 'NÃO DESCONTOU (analista)' : 'NÃO DESCONTOU ICMS') : (m.ov ? 'DESCONTOU (analista)' : 'DESCONTOU'), { v: m.pis, s: XS.brl }, { v: m.cof, s: XS.brl }, { v: r2(m.pis + m.cof), s: XS.brl }]);
      const t = emit.proxima();
      emit([{ v: 'Total', s: XS.txtB }, '', '', { v: ex.icms, s: XS.brlB }, '', '', '', '', '', { v: ex.pis, f: 'SUM(J' + (h + 1) + ':J' + (t - 1) + ')', s: XS.brlB }, { v: ex.cof, f: 'SUM(K' + (h + 1) + ':K' + (t - 1) + ')', s: XS.brlB }, { v: r2(ex.pis + ex.cof), f: 'SUM(L' + (h + 1) + ':L' + (t - 1) + ')', s: XS.brlB }]);
      emit([{ v: 'ICMS no total: só dos meses que não descontaram. Alíquota pelo regime do mês (9,25% não cumulativo; 3,65% cumulativo).' + (Math.abs(ex.v925 - (ex.pis + ex.cof)) > 0.01 ? ' A 9,25% em todos os meses: ' + fBRL(ex.v925) + '.' : ''), s: XS.note }]);
    }
  });
  if (an) B.addSheet({
    name: 'ANULAÇÃO 1206', grid: false, freeze: { row: 1 }, cols: [12, 12, 46, 18, 16, 16, 16, 14, 14, 50], filterRef: 'A1:J' + (an.docs.length + 1),
    rows: async (emit) => {
      emit(['Data', 'Nota', 'Tomador', 'CNPJ', 'Vlr Operação', 'ICMS', 'Base (− ICMS)', 'PIS', 'COFINS', 'Situação'], { s: XS.bHeadHl });
      for (const d of an.docs) emit([fDataBr(d.data), d.num, d.nome, fmtCNPJ(d.part), { v: d.op, s: XS.eBrlB }, { v: d.icms, s: XS.eBrlB }, { v: d.base, s: XS.eBrlB }, { v: d.pis, s: XS.eBrlB }, { v: d.cof, s: XS.eBrlB }, d.ov ? (d.sel ? 'incluída pela analista' : 'excluída pela analista') : d.st], { s: XS.bGen });
    }
  });
  if (dv) B.addSheet({
    name: 'DEV COMPRA ICMS', grid: false, freeze: { row: 1 }, cols: [12, 12, 8, 46, 18, 14, 16, 60], filterRef: 'A1:H' + (dv.docs.length + 1),
    rows: async (emit) => {
      emit(['Data', 'Nota', 'CFOP', 'Fornecedor', 'CNPJ', 'Vlr ICMS', 'A recuperar', 'TEM AJUSTE (C197)?'], { s: XS.bHeadHl });
      for (const d of dv.docs) emit([fDataBr(d.data), d.num, d.cfop, d.nome, fmtCNPJ(d.part), { v: d.icms, s: XS.eBrlB }, { v: d.sel ? d.icms : 0, s: XS.eBrlB }, d.ov ? (d.sel ? 'incluída pela analista' : 'excluída pela analista') : d.st], { s: XS.bGen });
    }
  });
  const ep = analisarEstornoPresumido();
  if (ep && ep.docs.length) B.addSheet({
    name: 'ESTORNO PRESUMIDO', grid: false, freeze: { row: 1 }, cols: [12, 12, 8, 46, 18, 16], filterRef: 'A1:F' + (ep.docs.length + 1),
    rows: async (emit) => {
      emit(['Data', 'Nota', 'CFOP', 'Fornecedor', 'CNPJ', 'ICMS creditado'], { s: XS.bHeadHl });
      for (const d of ep.docs) emit([fDataBr(d.data), d.num, d.cfop, d.nome, fmtCNPJ(d.part), { v: d.icms, s: XS.eBrlB }], { s: XS.bGen });
    }
  });
  return B.build(onProgress);
}
const arquivoPontos = () => 'Outros pontos - EFD ICMS x Contribuições - ' + nomeArq() + '.xlsx';
