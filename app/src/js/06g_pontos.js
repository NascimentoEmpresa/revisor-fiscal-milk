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

function cardRetencoes() {
  const pd = analisarPerdcomp(), rt = analisarRetencoes(); let h = '';
  if (pd) h += '<section class="card"><div class="card-h"><h2>PER/DCOMP transmitidos</h2><span class="sub">' + pd.L.length + ' PDF</span></div><div class="card-b"><div class="tbl-wrap"><table><thead><tr><th>Número</th><th>Transmissão</th><th>Documento · crédito</th><th>Tributo · período</th><th class="n">Crédito original</th></tr></thead><tbody>' +
    pd.L.map(p => '<tr><td class="mono small">' + esc(p.num) + '</td><td class="mono small">' + esc(p.transm || '—') + '</td><td class="small">' + esc([p.tipoDoc, p.tipoCred].filter(Boolean).join(' · ')) + '</td><td class="small">' + esc([p.tributo, p.pa].filter(Boolean).join(' · ')) + (p.conflito && p.conflito.length ? '<div class="small" style="color:var(--risk)">mesmo período de: ' + esc(p.conflito.join(', ')) + '</div>' : '') + '</td><td class="n">' + (p.valor ? fBRL(p.valor) : '—') + '</td></tr>').join('') + '</tbody></table></div><p class="small muted" style="margin-top:8px">A lista e a conferência com os pontos do diagnóstico vão para o Word.</p></div></section>';
  if (!rt) return h;
  return h + ('<section class="card"><div class="card-h"><h2>Retenções na fonte · DIRF x ECF (Y570)</h2></div><div class="card-b"><p class="small" style="margin-top:0">' +
    (!rt.comY570 ? 'A relação de rendimentos do e-CAC (DIRF) foi lida: ' + fBRL(rt.totDirf) + ' de imposto retido. Importe a ECF Y570 para conferir o que foi escriturado.'
      : rt.faltam.length ? 'Retenções da DIRF que não estão na ECF: ' + rt.faltam.map(a => '<b>' + a.ano + '</b> ' + fBRL(a.imp)).join(' · ') + ' (total ' + fBRL(rt.tot) + '). O texto vai para o Word.'
        : 'As retenções da DIRF conferem com as da ECF (' + fNum(rt.nEcf) + ' linhas na Y570).') + '</p></div></section>');
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

/* ---------- textos do Word: uma seção para cada ponto levantado, no estilo dos diagnósticos da Milk ---------- */
function blocosDiagnostico() {
  const X = extrasDaEmpresa(), Sa = resumoDe('SAI'), E = S.empresa.nome || 'a empresa', B = [];
  const fx = (a, b) => a === b ? ymTxt(a) : ymTxt(a) + ' a ' + ymTxt(b);
  // ECD
  const e = X.ecdA;
  if (e && e.res && e.res.pis + e.res.cof > 0) {
    const sel = [...e.contas.values()].filter(c => c.despesa && c.valor && clsConta(c) === ECD_CLS.SIM).sort((a, b) => a.desc.localeCompare(b.desc, 'pt-BR'));
    B.push({ titulo: 'CONTAS IDENTIFICADAS NA ECD PASSÍVEIS DE CREDITAMENTO', pars: [
      'Na Escrituração Contábil Digital (ECD, registros I200/I250) foram analisadas as contas de despesa dos períodos em que ' + E + ' apurou o PIS e a COFINS no regime não cumulativo (' + e.anosEscopo.join(', ') + '), à luz das hipóteses do art. 3º das Leis 10.637/2002 e 10.833/2003 e dos critérios de essencialidade e relevância (STJ, REsp 1.221.170/PR).',
      'Dos valores contabilizados nessas contas foram descontadas as bases já utilizadas como crédito na EFD-Contribuições. A diferença, de ' + fBRL(e.res.dif) + ', registrada na ECD mas não refletida na EFD-Contribuições, pode gerar um crédito estimado de ' + fBRL(e.res.pis + e.res.cof) + ' (PIS ' + fBRL(e.res.pis) + ' e COFINS ' + fBRL(e.res.cof) + ').'],
      tab: { cols: [{ h: 'Conta', w: 3600 }, { h: 'Valor na ECD', w: 1800, right: true }, { h: 'Já utilizado', w: 1800, right: true }, { h: 'Diferença', w: 1800, right: true }],
        rows: sel.map(c => { const v = c.ajuste != null ? c.ajuste : c.valor; return [c.desc, fBRL(v), fBRL(c.ja), fBRL(v - c.ja)]; }).concat([['Total', fBRL(e.res.valor), fBRL(e.res.ja), fBRL(e.res.dif)]]) },
      depois: ['O fato de um valor não constar como crédito no EFD-Contribuições não significa que seja recuperável: os documentos de cada conta devem ser conferidos quanto ao enquadramento legal antes do aproveitamento.'] });
  }
  // Junção 513
  const j = X.j513 && X.j513.res;
  if (j && j.pis + j.cof > 0) B.push({ titulo: 'CRUZAMENTO DA EFD ICMS/IPI COM A EFD-CONTRIBUIÇÕES', pars: [
    'No cruzamento das notas fiscais escrituradas na EFD ICMS/IPI com as escrituradas na EFD-Contribuições (registros C100/C170), foram identificadas notas de entrada que não constam na EFD-Contribuições e que dão direito a crédito, com base de ' + fBRL(j.base) + ', resultando em crédito de PIS e COFINS de ' + fBRL(j.pis + j.cof) + ' (PIS ' + fBRL(j.pis) + ' e COFINS ' + fBRL(j.cof) + ').'] });
  // venda de ativo e demais receitas não tributáveis (047)
  if (Sa && Sa.cats) for (const c of Sa.cats) if (/ativo/i.test(c.cat) && c.pis + c.cof > 0) B.push({ titulo: 'PIS E COFINS SOBRE VENDA DE ATIVO IMOBILIZADO', pars: [
    'Foram tributadas pelo PIS e pela COFINS operações de venda de bens do ativo imobilizado (' + fx(c.mi, c.ma) + '), receita que não integra a base de cálculo das contribuições (Lei 10.637/2002, art. 1º, § 3º, VI, e Lei 10.833/2003, art. 1º, § 3º, II). O recolhimento indevido soma ' + fBRL(c.pis) + ' de PIS e ' + fBRL(c.cof) + ' de COFINS, passível de restituição ou compensação.'] });
  // exclusão do ICMS por mês: o texto vai no parágrafo da análise da exclusão (06b)
  // anulações
  const an = analisarAnulacoes();
  if (an && an.n) B.push({ titulo: 'ANULAÇÃO DE PRESTAÇÃO DE SERVIÇO DE TRANSPORTE', pars: [
    'Foram emitidas anulações de prestação de serviço de transporte (CFOP 1.206/2.206) em ' + fx(an.mi, an.ma) + ', período em que a empresa apurava o PIS e a COFINS no regime não cumulativo, sem o correspondente crédito na EFD-Contribuições. Sobre a base de ' + fBRL(an.base) + ' (valor anulado, descontado o ICMS) cabe o crédito de ' + fBRL(an.pis + an.cof) + ' (PIS ' + fBRL(an.pis) + ' e COFINS ' + fBRL(an.cof) + ').'] });
  // serviços sem tributação (a recolher)
  const ss = Sa && Sa.servSemTrib;
  if (ss && ss.v > 0) B.push({ titulo: 'RECEITAS DE SERVIÇO SEM TRIBUTAÇÃO DE PIS E COFINS', pars: [
    'Verificou-se a existência de documentos de prestação de serviço registrados nos blocos ' + ss.regs.join(', ') + ' da EFD-Contribuições (' + fx(ss.mi, ss.ma) + ') que compõem o faturamento, mas não tiveram a correspondente tributação de PIS e COFINS (CST 08, 09, 49 ou 99), com base de ' + fBRL(ss.base) + '. O PIS e a COFINS não recolhidos somam ' + fBRL(ss.v) + ' (PIS ' + fBRL(ss.pis) + ' e COFINS ' + fBRL(ss.cof) + '), pela alíquota do regime de cada mês. Recomenda-se verificar a natureza dessas operações e, se tributadas, regularizar o recolhimento.'] });
  // ICMS: CT-e isentos no RS
  const ic = X.icmsS && X.icmsS.res;
  if (ic && ic.icms > 0) {
    const anos = [...ic.anos].sort((a, b) => a[0] - b[0]);
    B.push({ titulo: 'ICMS – PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE INTERMUNICIPAL RS', pars: [
      'Conforme o Decreto 55.371/2020, a contar de 23/07/2020, a prestação de serviço de transporte de cargas que tenha início e término no território do Estado do Rio Grande do Sul é isenta do ICMS quando realizada a contribuinte inscrito no CGC/TE.',
      'Observou-se que a empresa emitiu CT-e com destaque de ICMS em prestações com início e término no Rio Grande do Sul, para tomadores com inscrição estadual ativa no período, hipótese alcançada pela isenção. Foram identificados ' + fNum(ic.n) + ' CT-e, no montante de ' + fBRL(ic.icms) + ' passível de pedido de restituição ou compensação.',
      'A efetiva recuperação depende de autorização da Secretaria da Fazenda do Estado do Rio Grande do Sul, que verificará se houve o aproveitamento do crédito pelo tomador do serviço. O valor poderá ser utilizado mediante emissão de nota fiscal de crédito (RICMS/RS, Decreto 37.699/1997, Livro II, art. 26, II), escriturada nos registros C100 e C190 com CFOP 1.949 e situação 08, mantidos à disposição do fisco os CT-e e as consultas das inscrições estaduais dos tomadores.'],
      tab: { cols: [{ h: 'Ano', w: 1400 }, { h: 'CT-e', w: 1400, right: true }, { h: 'ICMS a recuperar', w: 2200, right: true }, { h: 'Reflexo crédito presumido', w: 2200, right: true }, { h: 'Reflexo PIS/COFINS', w: 2000, right: true }],
        rows: anos.map(([a, y]) => [String(a), fNum(y.n), fBRL(y.icms), fBRL(y.presum), fBRL(y.pc)]).concat([['Total', fNum(ic.n), fBRL(ic.icms), fBRL(ic.presum), fBRL(ic.pc)]]) },
      depois: ['A recuperação impactará outros pontos da apuração: ' + (ic.presum > 0 ? 'o crédito presumido de 20% cai junto com o débito (' + fBRL(ic.presum) + ' a estornar); ' : '') + 'o ICMS recuperado deixa de ser excluído da base do PIS e da COFINS (' + fBRL(ic.pc) + ' a recolher). O impacto estimado dessas correções é de ' + fBRL(ic.presum + ic.pc) + ', sujeito à apuração definitiva após as conciliações fiscais e contábeis.'] });
  }
  // devoluções de compra com ICMS
  const dv = analisarDevolucoes();
  if (dv && dv.n) B.push({ titulo: 'DEVOLUÇÕES DE COMPRA COM DESTAQUE DE ICMS', pars: [
    'Nas devoluções de compra registradas com os CFOPs ' + anosTexto([...dv.cfops].sort().map(c => c.charAt(0) + '.' + c.slice(1))) + ', o ICMS destacado não foi estornado por ajuste de crédito (registro C197) em ' + fNum(dv.n) + ' notas fiscais, totalizando ' + fBRL(dv.icms) + ' de crédito de ICMS não utilizado.' + (dv.estornado ? ' As demais devoluções com destaque de ICMS tiveram o débito estornado por ajuste (' + fBRL(dv.estornado) + ').' : '')] });
  // crédito presumido x créditos das entradas
  const ep = analisarEstornoPresumido();
  if (ep && ep.icms > 0) B.push({ titulo: 'CRÉDITO PRESUMIDO DE ICMS E CRÉDITOS DAS ENTRADAS', pars: [
    'No período em que a empresa apurou o ICMS pelo crédito presumido, foram identificados créditos de ICMS decorrentes de aquisições (' + [...ep.docs.reduce((m, d) => { const k = ymTxt(d.ym) + ', CFOP ' + d.cfop.charAt(0) + '.' + d.cfop.slice(1); m.set(k, (m.get(k) || 0) + d.icms); return m; }, new Map())].map(([k, v]) => k + ', ' + fBRL(v)).join('; ') + '), totalizando ' + fBRL(ep.icms) + '.',
    'Uma vez adotado o regime de crédito presumido, o contribuinte fica impedido de se apropriar de outros créditos de ICMS vinculados às entradas, pois o benefício substitui o sistema ordinário de creditamento. Recomenda-se o estorno desses valores.'] });
  // PER/DCOMP já transmitidos
  const pd = analisarPerdcomp();
  if (pd) B.push({ titulo: 'PER/DCOMP TRANSMITIDOS', pars: [
    'Foram consultados ' + pd.L.length + ' PER/DCOMP transmitidos pela empresa: ' + pd.L.map(p => 'nº ' + p.num + (p.transm ? ', de ' + p.transm : '') + ' – ' + [p.tipoDoc, p.tipoCred ? 'crédito de ' + p.tipoCred.toLowerCase() : '', p.tributo ? p.tributo + (p.pa ? ' (período de apuração ' + p.pa + ')' : '') : '', p.valor ? 'crédito original de ' + fBRL(p.valor) : ''].filter(Boolean).join(', ')).join('; ') + '.',
    pd.conflitos.length ? 'Atenção: ' + pd.conflitos.map(p => 'o PER/DCOMP nº ' + p.num + ' utiliza crédito de ' + p.tributo + ' de ' + p.pa + ', período também alcançado por ' + p.conflito.join(' e ')).join('; ') + '. Confirme se o crédito já pedido não é o mesmo levantado neste diagnóstico.'
      : 'Os pedidos já realizados não se referem aos pontos levantados neste diagnóstico.'] });
  // retenções na fonte (DIRF x ECF)
  const rt = analisarRetencoes();
  if (rt && rt.comY570) B.push({ titulo: 'RETENÇÕES NA FONTE – DIRF x ECF', pars: [rt.faltam.length
    ? 'No que tange às retenções informadas pelas fontes pagadoras na DIRF, observa-se que parte delas não foi escriturada na ECF (registro Y570): ' + rt.faltam.map(a => a.ano + ', ' + fBRL(a.imp) + ' (' + a.fontes.slice(0, 3).join(', ') + (a.fontes.length > 3 ? ' e outras' : '') + ')').join('; ') + ', totalizando ' + fBRL(rt.tot) + '. Por não constarem da escrituração fiscal, o aproveitamento desses valores dependeria da retificação da ECF; recomenda-se avaliar a conveniência diante do valor envolvido, evitando-se inconsistências ou riscos desnecessários.'
    : 'As retenções na fonte informadas pelas fontes pagadoras na DIRF (' + anosTexto(rt.anos) + ') conferem com as escrituradas na ECF (registro Y570), não havendo valores retidos a deduzir além dos já considerados.'] });
  return B;
}

/* ---------- gráficos do Word, feitos pelo sistema (no lugar das imagens do SistemaMA) ---------- */
function dadosGraficos() {
  const X = extrasDaEmpresa(), E = anaENT(), Sa = anaSAI(), M = new Map(), mes = ym => { let m = M.get(ym); if (!m) M.set(ym, m = { fat: 0, comp: 0, pisD: 0, cofD: 0, pisC: 0, cofC: 0, icms: null, st: null }); return m; };
  if (Sa) for (const r of Sa.recs) { const m = mes(r.ym), c3 = (r.cfop || '').slice(1); if (!CFOP_SAI_SEM_RECEITA.has(c3) && !CFOP_SAI_DEV_COMPRA.has(c3)) m.fat += Math.max(r.vlrItem || 0, r.bcPis || 0); /* F550 e consolidados: a receita vem na base */ m.pisD += r.vlrPis || 0; m.cofD += r.vlrCof || 0; }
  if (E) for (const r of E.recs) { const m = mes(r.ym), c3 = (r.cfop || '').slice(1); if (!CFOP_SEM_AQUISICAO.has(c3)) m.comp += r.vlrItem || 0; m.pisC += r.vlrPis || 0; m.cofC += r.vlrCof || 0; }
  const ap = X.ie0150 && X.ie0150.apur; if (ap) for (const [ym, a] of ap) { const m = mes(ym); m.icms = a.icms || 0; m.st = a.st || 0; }
  const meses = [...M.keys()].sort((a, b) => a - b); if (!meses.length) return null;
  const v = f => meses.map(ym => r2(f(M.get(ym))));
  const pis = v(m => Math.max(0, m.pisD - m.pisC)), cof = v(m => Math.max(0, m.cofD - m.cofC)), icms = v(m => m.icms || 0), st = v(m => m.st || 0);
  return { meses, fat: v(m => m.fat), comp: v(m => m.comp), pis, cof, icms, st, trib: meses.map((_, i) => r2(pis[i] + cof[i] + icms[i] + st[i])), temSai: !!Sa, temEnt: !!E, temIcms: !!ap };
}
/* desenho em canvas (PNG) para o Word: barras e linha num eixo só (tudo em R$), legenda, rótulos só nos picos */
function desenharGrafico(o) {
  if (typeof document === 'undefined') return null;
  o.barras = o.barras.filter(b => b.v.some(v => v > 0)); if (!o.barras.length && !(o.linha && o.linha.v.some(v => v > 0))) return null; // série zerada fica fora da legenda
  const W = 2000, H = 900, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); if (!g) return null;
  const COR = ['#2a78d6', '#eb6834', '#1baf7a'], txt = '#0b0b0b', txt2 = '#52514e', grade = '#e6e5e1', n = o.meses.length;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.fillStyle = txt; g.font = '600 34px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(o.titulo, W / 2, 50);
  const L = 170, R = W - 40, T = 120, B = H - 150, max = Math.max(1, ...o.barras.flatMap(s => s.v), ...(o.linha ? o.linha.v : []));
  const passo = (() => { const e = Math.pow(10, Math.floor(Math.log10(max / 5))), c = [1, 2, 2.5, 5, 10].map(k => k * e).find(k => max / k <= 6); return c || e * 10; })(), topo = Math.ceil(max / passo) * passo;
  const y = v => B - (v / topo) * (B - T), abrev = v => v >= 1e6 ? (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi' : v >= 1e3 ? (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil' : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  g.font = '24px Arial, sans-serif'; g.textAlign = 'right'; g.lineWidth = 1;
  for (let v = 0; v <= topo + 1e-6; v += passo) { g.strokeStyle = grade; g.beginPath(); g.moveTo(L, y(v)); g.lineTo(R, y(v)); g.stroke(); g.fillStyle = txt2; g.fillText('R$ ' + abrev(v), L - 12, y(v) + 8); }
  const col = (R - L) / n, nb = o.barras.length, bw = Math.max(2, Math.min(28, (col - 4) / nb - 2));
  o.barras.forEach((s, k) => { g.fillStyle = COR[k]; s.v.forEach((v, i) => { if (!(v > 0)) return; const x = L + i * col + (col - nb * (bw + 2)) / 2 + k * (bw + 2), yy = y(v); g.beginPath(); if (g.roundRect) g.roundRect(x, yy, bw, B - yy, [Math.min(4, bw / 2), Math.min(4, bw / 2), 0, 0]); else g.rect(x, yy, bw, B - yy); g.fill(); }); });
  if (o.linha) { g.strokeStyle = COR[nb]; g.lineWidth = 4; g.beginPath(); o.linha.v.forEach((v, i) => { const x = L + i * col + col / 2; i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); }); g.stroke(); }
  // rótulos: só o maior valor de cada série
  g.font = '600 22px Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = txt;
  for (const [k, s] of o.barras.concat(o.linha ? [o.linha] : []).entries()) { const i = s.v.indexOf(Math.max(...s.v)); if (s.v[i] > 0) g.fillText('R$ ' + abrev(s.v[i]), L + i * col + col / 2, y(s.v[i]) - 12 - k * 24); }
  // meses
  g.fillStyle = txt2; g.font = '20px Arial, sans-serif'; const cada = Math.max(1, Math.ceil(n / 30));
  o.meses.forEach((ym, i) => { if (i % cada) return; g.save(); g.translate(L + i * col + col / 2, B + 14); g.rotate(-Math.PI / 3); g.textAlign = 'right'; g.fillText(ymTxt(ym), 0, 8); g.restore(); });
  g.strokeStyle = txt2; g.lineWidth = 2; g.beginPath(); g.moveTo(L, B); g.lineTo(R, B); g.stroke();
  // legenda
  const itens = o.barras.map((s, k) => [s.nome, COR[k], 'b']).concat(o.linha ? [[o.linha.nome, COR[nb], 'l']] : []);
  g.font = '24px Arial, sans-serif'; g.textAlign = 'left'; let lx = L; const ly = 90;
  for (const [nm, c, t] of itens) { g.fillStyle = c; if (t === 'b') g.fillRect(lx, ly - 18, 22, 22); else g.fillRect(lx, ly - 9, 30, 5); g.fillStyle = txt; g.fillText(nm, lx + 36, ly); lx += 60 + g.measureText(nm).width; }
  if (o.nota) { g.fillStyle = txt2; g.font = 'italic 20px Arial, sans-serif'; g.textAlign = 'left'; g.fillText(o.nota, L, H - 18); }
  const b64 = cv.toDataURL('image/png').split(',')[1], bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { png: u8, w: W, h: H };
}
function graficosWord() {
  const d = dadosGraficos(); if (!d || typeof document === 'undefined') return {};
  const G = {};
  if (d.temSai || d.temEnt) G.grafEvol = desenharGrafico({ titulo: 'Evolução da Carga Tributária - Mensal', meses: d.meses, barras: [d.temSai ? { nome: 'Faturamento', v: d.fat } : null, d.temEnt ? { nome: 'Compras', v: d.comp } : null].filter(Boolean), linha: { nome: 'Tributos', v: d.trib }, nota: 'Fonte: EFD-Contribuições (037/047)' + (d.temIcms ? ' e EFD ICMS/IPI (E110/E210)' : '') + '. Tributos = PIS e COFINS (débitos menos créditos)' + (d.temIcms ? ' + ICMS e ICMS-ST a recolher.' : '.') });
  if (d.temSai) G.grafPC = desenharGrafico({ titulo: 'PIS/COFINS a recolher - Mensal', meses: d.meses, barras: [{ nome: 'PIS/PASEP', v: d.pis }, { nome: 'COFINS', v: d.cof }], nota: 'Débitos da 047 menos créditos da 037, por mês' + (d.temEnt ? '.' : ' (sem a 037, só os débitos).') });
  if (d.temIcms) G.grafICMS = desenharGrafico({ titulo: 'ICMS e ICMS-ST a recolher - Mensal', meses: d.meses, barras: [{ nome: 'ICMS', v: d.icms }, { nome: 'ICMS-ST', v: d.st }], nota: 'Fonte: SPED EFD ICMS/IPI, registros E110 e E210.' });
  for (const k of Object.keys(G)) if (!G[k]) delete G[k];
  return G;
}
