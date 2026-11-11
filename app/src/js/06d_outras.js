/* ---------- 5. Outras planilhas (Junção 513, ECF, créditos da ECD e quadro-resumo) ----------
   Só declarações de função: o arquivo entra no mesmo script que a interface e é chamado depois do boot. */

function quadroResumo() {
  const X = extrasDaEmpresa(), E = resumoDe('ENT'), Sa = resumoDe('SAI'), j = X.j513 && X.j513.res;
  const icm = Sa && Sa.icms && Sa.icms.n && !Sa.icms.residual ? Sa.icms : null;
  // ECD importada: calculada conta a conta; sem ela, a base que a analista informar
  const ecd = X.ecdA ? { base: X.ecdA.res.base, pis: X.ecdA.res.pis, cof: X.ecdA.res.cof } : X.ecd && X.ecd.base > 0 ? { base: r2(X.ecd.base), pis: r2(X.ecd.base * CRED_PIS), cof: r2(X.ecd.base * CRED_COF) } : null;
  const L = [
    { k: 'ent', t: 'Notas lançadas sem PIS/COFINS (037)', v: E ? E.pot : null, falta: 'importe a 037' },
    { k: 'j513', t: 'Notas não escrituradas no EFD-Contribuições (Junção 513)', v: j && (j.pis + j.cof) > 0 ? { base: j.base, pis: j.pis, cof: j.cof } : j ? { base: 0, pis: 0, cof: 0 } : null, falta: 'importe a Junção 513' },
    { k: 'ecd', t: 'Créditos da ECD (diferença ECD x 037)', v: ecd, falta: 'importe a ECD ou informe a base abaixo' },
    { k: 'icms', t: 'Exclusão do ICMS da base do PIS/COFINS (047)', v: icm ? { base: icm.base, pis: icm.pis, cof: icm.cof } : Sa ? { base: 0, pis: 0, cof: 0 } : null, falta: 'importe a 047' }
  ];
  const tot = L.reduce((a, l) => { if (l.v) { a.base += l.v.base; a.pis += l.v.pis; a.cof += l.v.cof; } return a; }, { base: 0, pis: 0, cof: 0 });
  return { L, tot: { base: r2(tot.base), pis: r2(tot.pis), cof: r2(tot.cof) } };
}

function viewOutras() {
  const X = extrasDaEmpresa(), j = X.j513, ecf = X.ecf, ecdA = X.ecdA;
  let h = '<div class="phead"><div><span class="band">Etapa 5 · Outras planilhas</span><h1>Planilhas <em>complementares</em> do SistemaMA</h1>' +
    '<p>A <b>ECD</b> (I200/I250) mostra as despesas contabilizadas que podem dar crédito e não foram aproveitadas na 037. A <b>Junção 513</b> (EFD ICMS/IPI + EFD-Contribuições, C100/C170) mostra as notas que estão no SPED ICMS e não no SPED Contribuições. A <b>ECF 0000/0010</b> traz a forma de tributação e de apuração de cada ano. As duas entram no Excel e no Word desta empresa.</p></div>' +
    '<div class="toolbar"><button class="btn" data-act="pick" type="button">Importar planilhas</button></div></div>';
  if (!j && !ecf && !ecdA) h += '<section class="card"><div class="card-b"><p>Nenhuma planilha complementar importada. Na etapa Importar, solte a <b>Junção 513</b> ("Junções - EFD-ICMS-IPI + EFD-Contribuições - 513 - C100, C170 - Todos os Documentos e CFOP - Resumido") e a <b>ECF 0000/0010</b> junto com a 037 e a 047, ou depois delas.</p></div></section>';
  if (ecdA) h += cardECD(ecdA);
  if (j) h += cardJ513(j);
  if (ecf) h += cardECF(ecf);
  h += cardQuadro(X);
  return h;
}

function cardJ513(j) {
  const R = j.res, f = S.ui.jf || 'ava', tipo = S.ui.jt || 'E';
  const lst = j.notas.filter(n => n.cand && n.tipo === tipo && (f === 'todas' || (f === 'ava' ? clsJ(n) === 'AVALIAR' : f === 'com' ? clsJ(n) === J513_CLS.COM || clsJ(n) === J513_SAI.RISCO : clsJ(n) === J513_CLS.SEM || clsJ(n) === J513_SAI.SEM)))
    .sort((a, b) => b.vlr - a.vlr);
  const mostra = lst.slice(0, S.ui.jn || 80);
  const nomes = perfisNomes();
  const opts = tipo === 'E' ? [J513_CLS.COM, J513_CLS.SEM, J513_CLS.AVA] : [J513_SAI.SEM, J513_SAI.AVA, J513_SAI.RISCO];
  const linha = n => {
    const cls = clsJ(n), key = cls === J513_CLS.COM || cls === J513_SAI.RISCO ? 'COM' : cls === 'AVALIAR' ? 'AVA' : 'SEM';
    return '<tr><td class="mono small">' + esc(fDataBr(n.data)) + '</td><td class="mono small">' + esc(n.num) + '</td><td class="mono">' + n.cfop + '</td>' +
      '<td><div class="small" title="' + esc(fmtCNPJ(n.part)) + '">' + esc(nomes.get(n.part) || fmtCNPJ(n.part) || '—') + '</div><div class="small muted">' + esc(n.ov ? 'Decisão do analista' : n.sug.motivo) + (n.obs ? ' · <i>planilha: ' + esc(n.obs) + '</i>' : '') + '</div></td>' +
      '<td class="n">' + fBRL(n.vlr) + '</td>' +
      '<td><select class="cls-select ' + key + '" data-j="' + n.i + '" aria-label="Classificação da nota ' + esc(n.num) + '">' + opts.map(o => '<option' + (o === cls ? ' selected' : '') + '>' + o + '</option>').join('') + '</select></td>' +
      (tipo === 'E' ? '<td class="n">' + (n.cred ? fBRL(n.cred.pis + n.cred.cof) : '—') + '</td>' : '') + '</tr>';
  };
  const fb = (k, t, q) => '<button type="button" data-jf="' + k + '" aria-pressed="' + (f === k) + '">' + t + ' <span class="ct">' + q + '</span></button>';
  const cnt = (t, c) => j.notas.filter(n => n.cand && n.tipo === t && c(clsJ(n))).length;
  return '<section class="card"><div class="card-h"><h2>Junção 513 · notas fora do EFD-Contribuições</h2><span class="sub">' + esc(j.files.join(', ')) + '</span></div><div class="card-b">' +
    (!j.comPerfil ? '<div class="err-box" style="margin-bottom:12px">Sem a 037 desta empresa, o Revisor não sabe o que cada fornecedor vende e deixa as compras em AVALIAR. Importe a 037 para a sugestão por fornecedor.</div>' : '') +
    '<div class="kpis">' + kpi('Entradas só no EFD ICMS', fNum(R.cand.E), fNum(R.com) + ' com crédito · ' + fNum(R.ava.E) + ' para avaliar') +
    kpi('Crédito PIS + COFINS', fBRLc(R.pis + R.cof), fBRL(R.pis + R.cof) + ' = base ' + fBRL(R.base) + ' × 9,25%') +
    kpi('Saídas só no EFD ICMS', fNum(R.cand.S), fNum(R.ava.S) + ' vendas para avaliar' + (R.riscoBase ? ' · ' + fBRL(R.riscoBase) : '')) +
    kpi('Só no EFD-Contribuições', fNum(R.soCon), 'informativo') + '</div>' +
    '<div class="toolbar" style="margin:14px 0 8px;flex-wrap:wrap"><span class="msw" role="group" aria-label="Entradas ou saídas"><button type="button" data-jt="E" aria-pressed="' + (tipo === 'E') + '">Entradas</button><button type="button" data-jt="S" aria-pressed="' + (tipo === 'S') + '">Saídas</button></span>' +
    '<span class="seg">' + fb('ava', 'Para avaliar', cnt(tipo, c => c === 'AVALIAR')) + fb('com', tipo === 'E' ? 'Com crédito' : 'Risco', cnt(tipo, c => c === J513_CLS.COM || c === J513_SAI.RISCO)) + fb('sem', tipo === 'E' ? 'Sem crédito' : 'Não tributa', cnt(tipo, c => c === J513_CLS.SEM || c === J513_SAI.SEM)) + fb('todas', 'Todas', R.cand[tipo]) + '</span>' +
    '<span style="flex:1"></span><button class="btn" data-oact="j513-xlsx" type="button">' + ICON.dl + 'Excel da Junção 513</button></div>' +
    (mostra.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Nota</th><th>CFOP</th><th>Fornecedor · motivo</th><th class="n">Valor</th><th>Classificação</th>' + (tipo === 'E' ? '<th class="n">PIS + COFINS</th>' : '') + '</tr></thead><tbody>' + mostra.map(linha).join('') + '</tbody></table></div>' +
      (lst.length > mostra.length ? '<div class="toolbar" style="justify-content:center;margin-top:10px"><button class="btn" data-oact="j-mais" type="button">Mostrar mais ' + Math.min(200, lst.length - mostra.length) + ' de ' + (lst.length - mostra.length) + '</button></div>' : '')
      : '<p class="muted small">Nenhuma nota neste filtro.</p>') +
    '<p class="small muted" style="margin-top:10px">Crédito de 1,65% + 7,6% sobre o valor da nota nas entradas COM CREDITO, só nos meses não cumulativos da 037. As sugestões vêm do que o mesmo fornecedor vende nas notas da 037. Uma decisão sua vale para esta nota.</p>' +
    '</div></section>';
}

function cardECD(e) {
  const R = e.res, todas = S.ui.ecdTodas, ord = { [ECD_CLS.SIM]: 0, [ECD_CLS.AVA]: 1, [ECD_CLS.NAO]: 2 };
  const lst = [...e.contas.values()].filter(c => c.despesa && c.valor && (todas || clsConta(c) !== ECD_CLS.NAO)).sort((a, b) => ord[clsConta(a)] - ord[clsConta(b)] || b.valor - a.valor);
  const opts = [ECD_CLS.SIM, ECD_CLS.AVA, ECD_CLS.NAO], k = c => clsConta(c) === ECD_CLS.SIM ? 'COM' : clsConta(c) === ECD_CLS.AVA ? 'AVA' : 'SEM';
  const linha = c => '<tr><td class="mono small">' + esc(c.conta) + '</td><td><div>' + esc(c.desc) + '</div><div class="small muted">' + esc(c.ov ? 'Decisão do analista' : c.cat) + (c.jaDe.length ? ' · já utilizado: ' + esc(c.jaDe.join(', ')) : '') + '</div></td>' +
    '<td><select class="cls-select ' + k(c) + '" data-ecd="' + esc(c.conta) + '" aria-label="Incluir a conta ' + esc(c.desc) + '">' + opts.map(o => '<option' + (o === clsConta(c) ? ' selected' : '') + '>' + o + '</option>').join('') + '</select></td>' +
    '<td class="n">' + fBRL(c.valor) + '</td><td class="n">' + fBRL(c.ja) + '</td><td class="n"><b>' + fBRL(c.valor - c.ja) + '</b></td></tr>';
  const contasOpt = [...e.contas.values()].filter(c => c.despesa && c.valor).sort((a, b) => a.desc.localeCompare(b.desc, 'pt-BR'));
  const sem = e.semConta.length ? '<div style="margin-top:14px"><b class="small">Créditos da 037 em contas fora da tabela</b><p class="small muted">Não entram no já utilizado. Se correspondem a uma conta da ECD, escolha qual.</p><div class="tbl-wrap"><table><thead><tr><th>Conta na 037</th><th class="n">Base do PIS</th><th>Somar no já utilizado de</th></tr></thead><tbody>' +
    e.semConta.map(s => '<tr><td>' + esc(s.conta.startsWith('#') ? s.nome : s.conta + (s.nome ? ' · ' + s.nome : '')) + '</td><td class="n">' + fBRL(s.base) + '</td><td><select data-ecd-atrib="' + esc(s.conta) + '"><option value="">— nenhuma —</option>' + contasOpt.map(c => '<option value="' + esc(c.conta) + '"' + (s.atrib === c.conta ? ' selected' : '') + '>' + esc(c.desc) + '</option>').join('') + '</select></td></tr>').join('') + '</tbody></table></div></div>' : '';
  const anos = '<span class="seg" role="group" aria-label="Anos da análise">' + e.anos.map(a => '<button type="button" data-ecd-ano="' + a + '" aria-pressed="' + e.anosEscopo.includes(a) + '"' + (e.anosOff.has(a) || e.anosEscopo.includes(a) ? '' : ' disabled title="Fora do regime não cumulativo"') + '>' + a + '</button>').join('') + '</span>';
  return '<section class="card"><div class="card-h"><h2>ECD · despesas x créditos da 037</h2><span class="sub">' + esc(e.files.join(', ')) + '</span></div><div class="card-b">' +
    (!e.com037 ? '<div class="err-box" style="margin-bottom:12px">Sem a 037 desta empresa (com a coluna Conta Contábil), o "já utilizado" fica zerado. Importe a 037 para comparar.</div>' : '') +
    '<div class="kpis">' + kpi('Contas incluídas', fNum(R.sim), fNum(R.ava) + ' para avaliar · ' + fNum(R.contas) + ' contas de despesa') + kpi('Valor na ECD', fBRLc(R.valor), fBRL(R.valor) + ' em débitos normais no período') +
    kpi('Já utilizado (037)', fBRLc(R.ja), fBRL(R.ja) + ' de base do PIS com crédito') + kpi('Crédito PIS + COFINS', fBRLc(R.pis + R.cof), fBRL(R.pis + R.cof) + ' = diferença ' + fBRL(R.dif) + ' × 9,25%') + '</div>' +
    '<div class="toolbar" style="margin:14px 0 8px;flex-wrap:wrap"><span class="small muted">Anos (regime não cumulativo' + (e.fonteRegime ? ', pela ' + e.fonteRegime : '') + '):</span>' + anos +
    '<span class="seg"><button type="button" data-ecd-todas="0" aria-pressed="' + !todas + '">Incluir e avaliar</button><button type="button" data-ecd-todas="1" aria-pressed="' + !!todas + '">Todas as contas</button></span><span style="flex:1"></span><button class="btn" data-oact="ecd-xlsx" type="button">' + ICON.dl + 'Excel da ECD</button></div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Conta</th><th>Descrição · categoria</th><th>Decisão</th><th class="n">ECD</th><th class="n">Já utilizado</th><th class="n">Diferença</th></tr></thead><tbody>' + lst.map(linha).join('') + '</tbody></table></div>' + sem +
    '<p class="small muted" style="margin-top:10px">Contas sugeridas pelas hipóteses do art. 3º das Leis 10.637/2002 e 10.833/2003; as que dependem da atividade (essencial ou relevante) ficam em AVALIAR. A diferença negativa também entra no total, como no Excel da analista. Não constar como crédito no EFD-Contribuições não significa que o valor seja recuperável: confira o enquadramento.</p></div></section>';
}
function perfisNomes() {
  const a = S.tipo === 'ENT' ? S : (S.analyses.ENT && S.analyses.ENT.snap), m = new Map();
  if (!a || !a.recs || !a.map || a.map.cnpjPart == null) return m;
  for (const r of a.recs) { const c = digits(r.v[a.map.cnpjPart] || (a.map.cpfPart != null ? r.v[a.map.cpfPart] : '') || ''); if (c && r.part && !m.has(c)) m.set(c, r.part); }
  return m;
}
function fDataBr(v) {
  if (v instanceof Date) return String(v.getDate()).padStart(2, '0') + '/' + String(v.getMonth() + 1).padStart(2, '0') + '/' + v.getFullYear();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(v || '');
}

function cardECF(ecf) {
  return '<section class="card"><div class="card-h"><h2>ECF 0000/0010 · parâmetros de tributação</h2><span class="sub">' + esc(ecf.files.join(', ')) + '</span></div><div class="card-b">' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ano</th><th>Forma de tributação</th><th>Apuração do IRPJ/CSLL</th><th>Estimativa mensal</th><th>Qualificação</th></tr></thead><tbody>' +
    ecf.anos.map(a => '<tr><td class="mono">' + a.ano + '</td><td>' + esc(a.trib) + '</td><td>' + esc(a.apur) + '</td><td class="mono small">' + esc(a.est || '—') + '</td><td class="small">' + esc(a.qual) + '</td></tr>').join('') +
    '</tbody></table></div><p class="small" style="margin-top:10px">No Word: <b>Regime de apuração:</b> ' + esc(textoApuracao(ecf)) + ' · <b>Forma de tributação atual:</b> ' + esc(tribAtualECF(ecf)) + '.</p>' +
    '<p class="small muted">Estimativa mensal: uma letra por mês; B = balanço ou balancete de suspensão/redução, E = receita bruta.</p></div></section>';
}

function cardQuadro(X) {
  const Q = quadroResumo();
  const lin = l => '<tr><td>' + l.t + '</td>' + (l.v ? '<td class="n">' + fBRL(l.v.base) + '</td><td class="n">' + fBRL(l.v.pis) + '</td><td class="n">' + fBRL(l.v.cof) + '</td><td class="n"><b>' + fBRL(l.v.pis + l.v.cof) + '</b></td>' : '<td colspan="4" class="muted small">' + l.falta + '</td>') + '</tr>';
  return '<section class="card"><div class="card-h"><h2>Quadro-resumo do crédito de PIS/COFINS</h2><span class="sub">vai para a conclusão do Word</span></div><div class="card-b">' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th class="n">Base</th><th class="n">PIS (1,65%)</th><th class="n">COFINS (7,6%)</th><th class="n">Total</th></tr></thead><tbody>' + Q.L.map(lin).join('') +
    '<tr class="tot"><td><b>Total</b></td><td class="n">' + fBRL(Q.tot.base) + '</td><td class="n">' + fBRL(Q.tot.pis) + '</td><td class="n">' + fBRL(Q.tot.cof) + '</td><td class="n"><b>' + fBRL(Q.tot.pis + Q.tot.cof) + '</b></td></tr></tbody></table></div>' +
    (X.ecdA ? '' : '<div class="field" style="max-width:420px;margin-top:14px"><label for="f-ecd">Base dos créditos da ECD (R$), apurada pela analista</label><input type="text" inputmode="decimal" id="f-ecd" value="' + (X.ecd && X.ecd.base ? NUM2.format(X.ecd.base) : '') + '" placeholder="Ex.: 1.258.309,62" autocomplete="off"></div>' +
    '<p class="small muted">Sem a ECD importada, a base apurada pela analista entra aqui e vai para o quadro do Word.</p>') + '</div></section>';
}

function bindOutras() {
  const v = $('#view');
  v.onchange = e => {
    const s = e.target.closest('select[data-j]');
    if (s) { const j = S.extras.j513, n = j.notas.find(x => x.i === +s.dataset.j); if (!n) return; n.ov = s.value === n.sug.cls ? null : s.value; recalcJ513(j); refreshOutras(); toast('Nota ' + n.num + ': ' + s.value + '.'); return; }
    const ec = e.target.closest('select[data-ecd]');
    if (ec) { const c = S.extras.ecdA.contas.get(ec.dataset.ecd); c.ov = ec.value === c.sug ? null : ec.value; analisarECD(S.extras.ecdA); refreshOutras(); return; }
    const at = e.target.closest('select[data-ecd-atrib]');
    if (at) { S.extras.ecdA.atrib[at.dataset.ecdAtrib] = at.value; analisarECD(S.extras.ecdA); refreshOutras(); return; }
    if (e.target.id === 'f-ecd') { const b = toNum(e.target.value) || 0; S.extras.ecd = { cnpj: S.extras.cnpj || digits(S.empresa.cnpj), base: b > 0 ? b : 0 }; refreshOutras(); }
  };
  v.onclick = async e => {
    const f = e.target.closest('[data-jf]'); if (f) { S.ui.jf = f.dataset.jf; S.ui.jn = 80; return refreshOutras(); }
    const t = e.target.closest('[data-jt]'); if (t) { S.ui.jt = t.dataset.jt; S.ui.jn = 80; return refreshOutras(); }
    const ea = e.target.closest('[data-ecd-ano]'); if (ea) { const a = +ea.dataset.ecdAno, s = S.extras.ecdA.anosOff; if (s.has(a)) s.delete(a); else s.add(a); analisarECD(S.extras.ecdA); return refreshOutras(); }
    const et = e.target.closest('[data-ecd-todas]'); if (et) { S.ui.ecdTodas = et.dataset.ecdTodas === '1'; return refreshOutras(); }
    const b = e.target.closest('[data-oact]'); if (!b) return;
    if (b.dataset.oact === 'j-mais') { S.ui.jn = (S.ui.jn || 80) + 200; return refreshOutras(); }
    if (b.dataset.oact === 'ecd-xlsx') {
      b.disabled = true; const lbl = b.innerHTML;
      try { b.textContent = 'Gerando…'; await saveFile(arquivoECD(), await buildWorkbookECD()); }
      catch (er) { console.error(er); toast('Não foi possível gerar o Excel: ' + er.message, 5000); }
      b.disabled = false; b.innerHTML = lbl; return;
    }
    if (b.dataset.oact === 'j513-xlsx') {
      b.disabled = true; const lbl = b.innerHTML;
      try { b.textContent = 'Gerando…'; const blob = await buildWorkbookJ513(); await saveFile(arquivoJ513(), blob); }
      catch (er) { console.error(er); toast('Não foi possível gerar o Excel: ' + er.message, 5000); }
      b.disabled = false; b.innerHTML = lbl;
    }
  };
}
function refreshOutras() { if (S.ui.view !== 'outras') return; const y = window.scrollY; render(); window.scrollTo(0, y); }
