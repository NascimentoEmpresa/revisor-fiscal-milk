/* ================================= interface ================================= */
const ICON = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  file: '<svg class="big" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 4h17l9 9v31H12z"/><path d="M29 4v9h9"/><path d="M18 24h14M18 30h14M18 36h9"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'
};
const DOCPATH = '<path d="M10 3.5h14.5L33 12v23a2.5 2.5 0 0 1-2.5 2.5h-20A2.5 2.5 0 0 1 8 35V6a2.5 2.5 0 0 1 2-2.5z" style="fill:var(--fc)"/><path d="M24.5 3.5V10a2 2 0 0 0 2 2H33" fill="#fff" fill-opacity=".38"/>';
const FICON = {
  x: '<svg viewBox="0 0 40 40" aria-hidden="true">' + DOCPATH + '<g stroke="#fff" stroke-width="1.7" fill="none" stroke-linejoin="round"><rect x="12.5" y="17" width="16" height="14" rx="1.6"/><path d="M12.5 21.7h16M12.5 26.3h16M18.3 17v14"/></g></svg>',
  w: '<svg viewBox="0 0 40 40" aria-hidden="true">' + DOCPATH + '<g stroke="#fff" stroke-width="1.8" stroke-linecap="round"><path d="M13 18h15M13 22.5h15M13 27h15M13 31.5h9"/></g></svg>',
  j: '<svg viewBox="0 0 40 40" aria-hidden="true">' + DOCPATH + '<text x="20.5" y="29.5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11.5" font-weight="700" fill="#fff">{ }</text></svg>'
};
const fileIcon = (k, label) => '<div class="fi fi-' + k + '" title="' + label + '">' + FICON[k] + '</div>';
const pill = cls => '<span class="pill ' + CLS_KEY[cls] + '">' + esc(cls) + '</span>';
const confBars = c => '<span class="conf ' + c + '" title="Confiança ' + CONF[c].toLowerCase() + '"><i></i><i></i><i></i></span>';
const STATUS = { ok: 'OK', opp: 'Oportunidade', risk: 'Risco', warn: 'Atenção', info: 'Informativo' };
const TX = (ent, sai) => S.tipo === 'SAI' ? sai : ent;
const kbCount = () => Object.keys(S.kb).filter(k => (S.tipo === 'SAI') === k.startsWith('S|')).length;

function groupCredit(g) { let v = 0; for (const r of g.recs) { const c = creditOf(r); if (c) v += c.pis + c.cof; } return v; }
function minutes() {
  const st = S.settings, G = S.groups.length;
  const manual = st.minManualBase + G * st.minManualGrupo + st.minRelManual;
  const assist = S.procMs / 60000 + G * st.minAssistGrupo + st.minRelAssist;
  return { manual, assist, G };
}

/* ---------- topo e trilho ---------- */
function renderChrome() {
  const c = $('#company');
  if (!S.loaded) { c.innerHTML = '<span class="chip">Nenhuma planilha carregada</span>'; }
  else {
    const per = ymLabel(S.months[0].ym) + ' – ' + ymLabel(S.months[S.months.length - 1].ym);
    const tl = tiposCarregados();
    const modo = tl.length > 1 ? '<span class="msw" role="group" aria-label="Planilha em análise">' + tl.map(t => '<button type="button" data-tipo-sw="' + t + '" aria-pressed="' + (t === S.tipo) + '" title="' + esc(MODES[t].titulo) + '">' + MODES[t].planilha + ' · ' + MODES[t].nome + '</button>').join('') + '</span>'
      : '<span class="chip mode" title="' + esc(MODE.titulo) + '">' + MODE.planilha + ' · ' + MODE.nome + '</span>';
    c.innerHTML = (S.demo ? '<span class="chip demo">Demonstração</span>' : '') + modo +
      (S.empresa.nome ? '<span class="chip nm"><b title="' + esc(S.empresa.nome) + '">' + esc(S.empresa.nome) + '</b></span>' : '<button type="button" class="chip ask" data-goto-name>Informar o nome da empresa</button>') +
      '<span class="chip mono opt">' + esc(fmtCNPJ(S.empresa.cnpj)) + '</span><span class="chip opt per">' + per + '</span>';
  }
  $$('.step').forEach(b => {
    const v = b.dataset.view; b.setAttribute('aria-current', S.ui.view === v ? 'page' : 'false');
    b.classList.toggle('done', S.loaded && (v === 'importar' || (v === 'classificar' && S.clsCount && S.clsCount.revisados > 0)));
  });
  if (S.loaded) {
    const pend = S.groups.filter(g => !g.dec && g.sug.cls === CLS.AVA).length;
    const bc = $('#badge-cls'); bc.textContent = pend ? pend : ''; bc.className = 'step-badge' + (pend ? ' warn' : ''); bc.hidden = !pend; bc.title = pend + ' grupos para avaliar';
    const att = S.checks.filter(x => x.st === 'risk' || x.st === 'warn').length;
    const bk = $('#badge-ck'); bk.textContent = att || ''; bk.className = 'step-badge' + (att ? ' warn' : ''); bk.hidden = !att; bk.title = att + ' verificações pedem atenção';
  }
  const h = $('#top').getBoundingClientRect().height;
  document.documentElement.style.setProperty('--toph', Math.round(h) + 'px');
  const rail = $('.rail'), cur = $('.step[aria-current="page"]');
  if (rail && cur && rail.scrollWidth > rail.clientWidth) rail.scrollLeft = Math.max(0, cur.offsetLeft - 16);
}

function go(view) {
  // sem planilha importada, as outras etapas abrem com a demonstração (dados fictícios), para dar para conhecer todas as telas
  if (!S.loaded && view !== 'importar' && !(view === 'outras' && (S.extras.j513 || S.extras.ecf || S.extras.ecdA))) {
    S.ui.aposImport = view;
    if (!busy) { toast('Nenhuma planilha importada: abrindo a demonstração com dados fictícios.', 3500); process({ demo: 'AMBAS' }); }
    return;
  }
  S.ui.view = view;
  try { if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view); } catch (e) { /* hash indisponível */ }
  render();
  window.scrollTo({ top: 0 });
}
function render() {
  renderChrome();
  const v = S.ui.view, el = $('#view');
  el.innerHTML = v === 'importar' ? viewImportar() : v === 'classificar' ? viewClassificar() : v === 'checklist' ? viewChecklist() : v === 'exportar' ? viewExportar() : v === 'outras' ? viewOutras() : viewPainel();
  if (v === 'painel') bindChart();
  if (v === 'importar') bindDrop();
  if (v === 'outras') bindOutras();
}

/* ---------- 1. importar ---------- */
const PIPE = [['ler', 'Leitura do arquivo'], ['map', 'Mapeamento das colunas'], ['anomes', 'Colunas ANO e MÊS'], ['tot', 'Totais e conferência'], ['din', 'Dinâmicas por registro e por mês'], ['sep', 'Separação COM e SEM PIS/COFINS'], ['cls', 'Pré-classificação por NCM + CFOP'], ['ck', 'Checklist automático']];
const pipeDet = t => t && t.detail ? t.detail : (t && t.state === 'run' ? 'processando…' : 'aguardando');
function pipeHtml(state) {
  return PIPE.map(([id, label]) => {
    const t = state && state[id], det = pipeDet(t);
    return '<div class="pl ' + (t ? t.state : '') + '" data-pl="' + id + '" data-st="' + (t ? t.state : '') + '"><span class="pl-i"></span><div><div class="pl-t">' + label + '</div><div class="pl-d" data-t="' + esc(det) + '">' + esc(det) + '</div></div><span class="pl-ms">' + (t && t.ms != null ? fMs(t.ms) : '') + '</span></div>';
  }).join('');
}
const calmo = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function letras(el, txt) {
  const s = String(txt);
  if (s.length > 160 || calmo()) { el.textContent = s; return; }
  let i = 0; // letra a letra, sem quebrar palavras no meio
  el.innerHTML = s.split(/(\s+)/).map(w => /^\s+$/.test(w) ? (i += w.length, w) : w ? '<span class="lw">' + [...w].map(c => '<span class="lt" style="--i:' + (i++) + '">' + esc(c) + '</span>').join('') + '</span>' : '').join('');
  clearTimeout(el._lt); el._lt = setTimeout(() => { if (el.textContent === s) el.textContent = s; }, 800 + s.length * 14);
}
function pipePatch(st) {
  const pl = $('#pipeline'); if (!pl) return;
  if (pl.children.length !== PIPE.length) { pl.innerHTML = pipeHtml(st); return; }
  PIPE.forEach(([id], k) => {
    const row = pl.children[k], t = st[id], state = t ? t.state : '', det = pipeDet(t), ms = t && t.ms != null ? fMs(t.ms) : '';
    const was = row.dataset.st || '', d = row.querySelector('.pl-d'), m = row.querySelector('.pl-ms');
    if (was !== state) { row.className = 'pl ' + state + (state === 'ok' ? ' pop' : ''); row.dataset.st = state; }
    if (d.dataset.t !== det) { d.dataset.t = det; if (state === 'ok' && was !== 'ok') letras(d, det); else d.textContent = det; }
    if (m.textContent !== ms) { if (ms && state === 'ok') letras(m, ms); else m.textContent = ms; }
  });
}
function viewImportar() {
  const st = {}; (S.timings || []).forEach(t => { st[t.id] = { state: 'ok', ms: t.ms, detail: t.detail }; });
  const atuais = tiposCarregados().map(t => ({ tipo: t, files: anaDe(t).files }));
  return '<div class="phead"><div><span class="band">Etapa 1 · Importar</span><h1>Solte as planilhas exportadas do <em>SistemaMA</em></h1>' +
    '<p>Consultas PREMIUM, <b>EFD - Contribuições</b>: <b>037 - Entradas</b> e <b>047 - Saídas</b>, Todos os Registros - Completo. Selecione as duas juntas (e todos os arquivos, se o sistema dividiu por ano): o Revisor reconhece cada uma e monta as duas análises da empresa. Pode juntar também a <b>Junção 513</b>, a <b>ECD</b> (I200/I250) e a <b>ECF 0000/0010</b>.</p></div></div>' +
    '<div class="grid2"><div class="drop" id="drop">' + ICON.file + '<h2>Arraste a 037 e a 047 para cá</h2><p class="muted small">Os arquivos são lidos neste computador, aos pedaços: planilhas de 80 mil linhas carregam sem travar. Nada é enviado para servidores.</p>' +
    '<div class="toolbar" style="justify-content:center"><button class="btn primary big" data-act="pick" type="button">Escolher arquivos</button></div>' +
    '<div class="files-in static" id="drop-files">' + (S.demo ? '' : atuais.flatMap(a => a.files.map(n => fileChip({ name: n }, 0, a.tipo))).join('')) + '</div>' +
    '<div id="imp-err"></div></div>' +
    '<section class="card"><div class="card-h"><h2>Processamento</h2><span class="sub" id="pl-total">' + (S.procMs ? MODE.planilha + ' ' + MODE.nome + ' · concluído em ' + fMs(S.procMs) : 'aguardando as planilhas') + '</span></div><div class="card-b pipeline" id="pipeline">' + pipeHtml(st) + '</div></section></div>';
}
const fSize = b => b >= 1048576 ? NUM.format(Math.round(b / 104857.6) / 10) + ' MB' : NUM.format(Math.max(1, Math.round(b / 1024))) + ' KB';
function fileChip(f, i, tipo) {
  return '<div class="file-chip" style="--i:' + i + '" data-fk="' + i + '"><span class="fc-ic">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M6 2.5h8.5L19 7v14.5H6z"/><path d="M14.5 2.5V7H19"/><path d="M8.5 11h8M8.5 14.5h8M8.5 18h8M12.5 11v7"/></svg>' + '</span>' +
    '<div style="min-width:0"><div class="fc-n" title="' + esc(f.name) + '">' + esc(f.name) + '</div><div class="fc-s">' + (f.size ? fSize(f.size) + ' · ' : '') + '<span class="fc-st">' + (tipo ? 'planilha ' + MODES[tipo].planilha : 'anexado') + '</span>' + (tipo ? '<span class="fc-tag">' + MODES[tipo].planilha + ' · ' + MODES[tipo].nome + '</span>' : '') + '</div></div>' +
    '<svg class="fc-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>';
}
function showFiles(files) {
  const box = $('#drop-files'), d = $('#drop'); if (!box) return;
  box.classList.remove('static');
  box.innerHTML = files.map((f, i) => fileChip(f, i)).join('');
  if (d) { d.classList.remove('got'); void d.offsetWidth; d.classList.add('got'); }
}
function marcarArquivo(k, tipo) {
  const c = document.querySelector('#drop-files [data-fk="' + k + '"]'); if (!c) return;
  const stEl = c.querySelector('.fc-st'); if (stEl) stEl.textContent = 'reconhecida';
  if (!c.querySelector('.fc-tag')) stEl.insertAdjacentHTML('afterend', '<span class="fc-tag">' + (MODES[tipo] ? MODES[tipo].planilha + ' · ' + MODES[tipo].nome : EXTRA_NOME[tipo]) + '</span>');
}
function bindDrop() {
  const d = $('#drop'); if (!d) return;
  ['dragenter', 'dragover'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.remove('over'); }));
  d.addEventListener('drop', e => { const fs = [...(e.dataTransfer.files || [])].filter(f => /\.(xls[xm]?|csv)$/i.test(f.name)); if (fs.length) importFiles(fs); else showImportError('Solte um arquivo .xlsx exportado do SistemaMA.'); });
}
function showImportError(msg) { const e = $('#imp-err'); if (e) e.innerHTML = '<div class="err-box">' + esc(msg) + '</div>'; toast(msg, 5000); }

/* Vários arquivos de uma vez: cada um é lido, reconhecido pelo cabeçalho (037 ou 047) e entra na sua análise.
   Arquivos da mesma planilha (a 037 dividida por ano, por exemplo) são unidos. */
async function lerArquivos(files, onStep, onFile) {
  const t0 = now(), grupos = new Map(), extras = []; let nLin = 0;
  for (let k = 0; k < files.length; k++) {
    const f = files[k], pre = files.length > 1 ? 'Arquivo ' + (k + 1) + ' de ' + files.length + ' · ' : '';
    onStep({ id: 'ler', state: 'run', detail: pre + f.name });
    const wb = await readWorkbook(f, d => onStep({ id: 'ler', state: 'run', detail: pre + d }));
    const tx = tipoExtra(wb.headers.map(normKey));
    if (tx) { extras.push({ tipo: tx, dados: tx === 'J513' ? lerJ513(wb.headers, wb.rows, [f.name]) : tx === 'ECD' ? lerECD(wb.headers, wb.rows, [f.name]) : lerECF(wb.headers, wb.rows, [f.name]) }); if (onFile) onFile(k, tx); continue; }
    const M = mapHeaders(wb.headers);
    if (M.missing.length) throw new Error('"' + f.name + '": não encontrei as colunas ' + M.missing.map(x => FIELDS[x].names[0].toUpperCase()).join(', ') + '. Confira se é a consulta "EFD - Contribuições - 037 - Entradas" ou "047 - Saídas", Todos os Registros - Completo.');
    const tipo = detectTipo(M.hk, wb.rows, M.map), sig = M.hk.join('|');
    if (onFile) onFile(k, tipo);
    let cnpj = '';
    if (M.map.cnpj != null) for (const r of wb.rows) { const c = digits(r[M.map.cnpj]); if (c.length >= 11) { cnpj = c; break; } }
    const g = grupos.get(tipo);
    if (!g) grupos.set(tipo, { tipo, headers: wb.headers, rows: wb.rows, fileNames: [f.name], cnpj, sig });
    else {
      if (sig !== g.sig) throw new Error('"' + f.name + '" e "' + g.fileNames[0] + '" são da planilha ' + MODES[tipo].planilha + ', mas com colunas diferentes. Exporte as duas de novo pelo SistemaMA (Todos os Registros - Completo).');
      if (cnpj && g.cnpj && cnpj !== g.cnpj) throw new Error('"' + f.name + '" é do CNPJ ' + fmtCNPJ(cnpj) + ' e "' + g.fileNames[0] + '" do CNPJ ' + fmtCNPJ(g.cnpj) + '. Importe juntas apenas planilhas da mesma empresa.');
      for (const r of wb.rows) g.rows.push(r);
      g.fileNames.push(f.name); if (!g.cnpj) g.cnpj = cnpj;
    }
    nLin += wb.rows.length;
  }
  const lst = ['ENT', 'SAI'].filter(t => grupos.has(t)).map(t => grupos.get(t));
  if (lst.length > 1 && lst[0].cnpj && lst[1].cnpj && lst[0].cnpj !== lst[1].cnpj) throw new Error('A 037 ("' + lst[0].fileNames[0] + '", CNPJ ' + fmtCNPJ(lst[0].cnpj) + ') e a 047 ("' + lst[1].fileNames[0] + '", CNPJ ' + fmtCNPJ(lst[1].cnpj) + ') são de empresas diferentes. Importe as planilhas de uma empresa por vez.');
  const ms = now() - t0;
  const out = lst.map(g => ({ tipo: g.tipo, headers: g.headers, rows: g.rows, fileNames: g.fileNames, ms: ms * g.rows.length / Math.max(1, nLin) }));
  const c0 = lst.map(g => g.cnpj).find(Boolean) || (S.loaded ? digits(S.empresa.cnpj) : '');
  for (const x of extras) if (c0 && x.dados.cnpj && x.dados.cnpj !== c0) throw new Error('"' + x.dados.files[0] + '" é do CNPJ ' + fmtCNPJ(x.dados.cnpj) + ', e as planilhas da análise são do CNPJ ' + fmtCNPJ(c0) + '. Importe as planilhas de uma empresa por vez.');
  out.extras = extras;
  return out;
}

/* depois de cada planilha: junta com a outra análise da mesma empresa (outra empresa sai da tela), recupera o nome e o logotipo */
const NOMES_KEY = 'revisor-fiscal-empresas-v1';
const tiposCarregados = () => !S.loaded ? [] : ['ENT', 'SAI'].filter(t => t === S.tipo || (S.analyses[t] && digits(S.analyses[t].snap.empresa.cnpj) === digits(S.empresa.cnpj)));
async function posCarga() {
  const c = digits(S.empresa.cnpj);
  for (const t of Object.keys(S.analyses)) {
    if (t === S.tipo) continue;
    const o = S.analyses[t].snap;
    if (digits(o.empresa.cnpj) !== c || !!o.demo !== !!S.demo) { delete S.analyses[t]; continue; } // outra empresa (ou demonstração x arquivo real)
    if (!S.empresa.nome && o.empresa.nome) S.empresa.nome = o.empresa.nome;
    o.empresa = S.empresa; // o mesmo cadastro nas duas análises: o nome digitado vale para a 037 e a 047
  }
  if (!S.empresa.nome && c && !S.demo) { const nm = store.get(NOMES_KEY, {})[c]; if (nm) S.empresa.nome = nm; }
  guardarAnalise();
  await carregarLogoCliente();
}
function definirNome(v) {
  S.empresa.nome = v;
  const c = digits(S.empresa.cnpj);
  for (const a of Object.values(S.analyses)) if (digits(a.snap.empresa.cnpj) === c) a.snap.empresa.nome = v;
  if (c && !S.demo) { const m = store.get(NOMES_KEY, {}); if (v.trim()) m[c] = v.trim(); else delete m[c]; store.set(NOMES_KEY, m); }
}
function trocarAnalise(tipo) {
  if (busy || tipo === S.tipo || !S.analyses[tipo]) return;
  closeDrawer();
  ativarAnalise(tipo);
  S.ui.filter = 'todos'; S.ui.q = ''; S.ui.showN = 60;
  render(); window.scrollTo({ top: 0 });
  toast('Planilha ' + MODE.planilha + ' · ' + MODE.nome);
}

let busy = false;
async function process(input) {
  if (busy) return; busy = true;
  const prevLoaded = S.loaded;
  if (S.ui.view !== 'importar') { S.ui.view = 'importar'; render(); }
  let st = {};
  const paint = () => pipePatch(st);
  const total = (t, fx) => { const el = $('#pl-total'); if (el) { if (fx) letras(el, t); else el.textContent = t; } };
  if (input.files) showFiles(input.files);
  else if (input.demo) showFiles((input.demo === 'AMBAS' ? ['ENT', 'SAI'] : [input.demo]).map(t => ({ name: MODES[t].titulo + '.xlsx' })));
  paint(); total('processando…');
  const errEl = $('#imp-err'); if (errEl) errEl.innerHTML = '';
  const feitas = []; let extrasLidas = [];
  try {
    let jobs;
    if (input.demo === 'AMBAS') jobs = [{ demo: 'ENT' }, { demo: 'SAI' }];
    else if (input.demo) jobs = [{ demo: input.demo }];
    else { const lidos = await lerArquivos(input.files, s => { st.ler = s; paint(); }, marcarArquivo); extrasLidas = lidos.extras || []; jobs = lidos.map(pre => ({ pre, sample: input.sample })); }
    if (input.demo) (input.demo === 'AMBAS' ? ['ENT', 'SAI'] : [input.demo]).forEach((t, k) => marcarArquivo(k, t));
    for (let k = 0; k < jobs.length; k++) {
      const j = jobs[k], md = MODES[j.demo || j.pre.tipo], pref = jobs.length > 1 ? (k + 1) + ' de ' + jobs.length + ' · ' : '';
      if (k > 0) { st = {}; paint(); }
      total(pref + md.planilha + ' ' + md.nome + ' · processando…');
      guardarAnalise();
      await runPipeline(j, s => { st[s.id] = s; paint(); });
      await posCarga();
      feitas.push(S.tipo);
      total(pref + md.planilha + ' ' + md.nome + ' · concluído em ' + fMs(S.procMs), true);
      renderChrome();
      if (k < jobs.length - 1) await sleep(500);
    }
    if (feitas.length > 1 && S.tipo !== feitas[0]) ativarAnalise(feitas[0]);
    for (const x of extrasLidas) guardarExtra(x.tipo, x.dados);
    // se a 037 chegou depois da 513, refaz a sugestão da 513 com os fornecedores da 037
    if (feitas.includes('ENT') && S.extras.j513 && !extrasLidas.some(x => x.tipo === 'J513')) analisarJ513(S.extras.j513);
    if (feitas.includes('ENT') && S.extras.ecdA && !extrasLidas.some(x => x.tipo === 'ECD')) analisarECD(S.extras.ecdA);
    busy = false;
    if (!jobs.length && extrasLidas.length) {
      total('concluído'); renderChrome();
      toast(extrasLidas.map(x => EXTRA_NOME[x.tipo]).join(' e ') + ': ' + (extrasLidas.length > 1 ? 'reconhecidas' : 'reconhecida') + '.' + (!S.loaded && extrasLidas.some(x => x.tipo === 'J513') ? ' Importe também a 037 para o Revisor sugerir a classificação das notas pelo fornecedor.' : ''), 5000);
      await sleep(650); go('outras'); return;
    }
    toast(feitas.length > 1 ? 'Planilhas ' + feitas.map(t => MODES[t].planilha).join(' e ') + ' processadas. Alterne entre elas no topo da tela.'
      : 'Planilha ' + MODE.planilha + ' (' + MODE.nome.toLowerCase() + '): ' + fNum(S.totals.n) + ' linhas processadas em ' + fMs(S.procMs), 4200);
    await sleep(650);
    const depois = S.ui.aposImport || 'painel'; S.ui.aposImport = null; // a etapa que a pessoa clicou (ou o Exportar, quando veio de lá)
    go(depois);
  } catch (e) {
    busy = false; S.ui.aposImport = null;
    if (S.loaded) setMode(S.tipo);
    const cur = PIPE.find(p => st[p[0]] && st[p[0]].state === 'run');
    if (cur) { const el = $('[data-pl="' + cur[0] + '"]'); if (el) { el.classList.remove('run'); el.classList.add('err'); } }
    total('Interrompido');
    showImportError(e && e.message ? e.message : String(e));
    renderChrome();
    if (feitas.length) toast('A planilha ' + feitas.map(t => MODES[t].planilha).join(' e ') + ' foi processada; a outra não.', 5000);
    else if (prevLoaded) toast('A análise anterior continua carregada.', 4000);
    console.error(e);
  }
}
function importFiles(files) { process({ demo: false, files }); }

/* ---------- 2. painel ---------- */
function viewPainel() {
  const T = S.totals, potT = S.pot.pis + S.pot.cof, risk = S.checks.filter(c => c.st === 'risk'), contT = risk.reduce((a, c) => a + (c.v || 0), 0);
  const per = ymLabel(S.months[0].ym) + ' a ' + ymLabel(S.months[S.months.length - 1].ym);
  const tm = minutes(), econ = tm.manual - tm.assist;
  const comG = S.groups.filter(g => (g.dec || g.sug.cls) === CLS.COM).map(g => ({ g, v: groupCredit(g) })).sort((a, b) => b.v - a.v).slice(0, 6);
  const anos = [...new Set(S.regTable.map(x => x.ano))], regs = [...new Set(S.regTable.map(x => x.registro))];
  if (S.tipo === 'SAI') return viewPainelSai(T, potT, per, tm, econ, comG, anos, regs);
  return '<div class="phead"><div><span class="band">Etapa 2 · Painel</span><h1><em>' + fBRL(potT) + '</em> de crédito não aproveitado</h1>' +
    '<p>' + esc(S.empresa.nome || 'CNPJ ' + fmtCNPJ(S.empresa.cnpj)) + ' · ' + per + ' · ' + fNum(T.n) + ' linhas lidas e organizadas em ' + fMs(S.procMs) + '. Valores nominais; a classificação ainda pode ser revisada.</p></div>' +
    '<div class="toolbar"><button class="btn" data-go="classificar" type="button">Revisar classificação</button><button class="btn primary" data-go="exportar" type="button">' + ICON.dl + 'Gerar Excel e Word</button></div></div>' +
    '<div class="kpis">' +
    kpi('Linhas processadas', fNum(T.n), S.months.length + ' meses · ' + fNum(new Set(S.recs.map(r => r.registro)).size) + ' registros') +
    kpi('Entradas (Vlr Item)', fBRLc(T.vlrItem), fBRL(T.vlrItem)) +
    kpi('Crédito escriturado', fBRLc(T.pis + T.cof), 'PIS ' + fBRLc(T.pis) + ' · COFINS ' + fBRLc(T.cof)) +
    kpi('Itens sem crédito', fNum(T.semN), fBRLc(T.semV) + ' em ' + S.groups.length + ' grupos') +
    '<div class="kpi hero"><div class="kpi-l">Crédito potencial</div><div class="kpi-v"><span>' + fBRLc(potT) + '</span></div><div class="kpi-s">PIS ' + fBRL(S.pot.pis) + ' · COFINS ' + fBRL(S.pot.cof) + '</div></div>' +
    '<div class="kpi risk"><div class="kpi-l">Crédito tomado a maior</div><div class="kpi-v">' + fBRLc(contT) + '</div><div class="kpi-s">' + risk.length + ' ponto' + (risk.length === 1 ? '' : 's') + ' de risco no checklist</div></div>' +
    '</div>' +
    '<div class="grid2"><section class="card"><div class="card-h"><h2>Crédito por mês: escriturado e não aproveitado</h2><div class="legend"><span><i style="background:var(--ink-3);opacity:.45"></i>Escriturado (PIS + COFINS)</span><span><i style="background:var(--copper)"></i>Não aproveitado</span></div></div>' +
    '<div class="card-b"><div class="chart-wrap"><div class="chart" id="chart">' + chartSvg() + '</div></div>' +
    '<div style="margin-top:14px" class="small muted">Regime por mês</div><div class="regime" style="margin-top:6px">' + S.months.map(m => '<span class="' + (m.regime === 'NC' ? '' : m.regime === 'CUM' ? 'cum' : 'none') + '" title="' + m.mes + ': ' + (m.regime === 'NC' ? 'não cumulativo' : m.regime === 'CUM' ? 'cumulativo' : 'sem crédito escriturado') + '"></span>').join('') + '</div>' +
    '<div class="legend" style="margin-top:8px"><span><i style="background:var(--copper);opacity:.8"></i>Não cumulativo</span><span><i style="background:var(--ink-3)"></i>Cumulativo</span><span><i style="background:var(--line)"></i>Sem crédito no mês</span></div></div></section>' +
    timeCard(tm, econ) + '</div>' +
    '<div class="grid2 even"><section class="card"><div class="card-h"><h2>Maiores grupos com crédito não aproveitado</h2><button class="btn" data-go="classificar" type="button">Ver todos</button></div><div class="card-b"><div class="tbl-wrap"><table><thead><tr><th>NCM · CFOP</th><th>Produto</th><th class="n">Itens</th><th class="n">Crédito</th></tr></thead><tbody>' +
    (comG.length ? comG.map(x => '<tr class="click" data-g="' + esc(x.g.key) + '"><td class="mono">' + fmtNCM(x.g.ncm) + '<div class="xs muted">' + esc(x.g.cfop) + '</div></td><td class="ellip" style="max-width:190px" title="' + esc(x.g.descTop) + '">' + esc(x.g.descTop) + '</td><td class="n">' + fNum(x.g.n) + '</td><td class="n"><b>' + fBRL(x.v) + '</b></td></tr>').join('') : '<tr><td colspan="4" class="muted">Nenhum grupo classificado com crédito.</td></tr>') +
    '</tbody></table></div></div></section>' +
    '<section class="card"><div class="card-h"><h2>Créditos escriturados por registro</h2><span class="sub">PIS + COFINS</span></div><div class="card-b"><div class="tbl-wrap"><table><thead><tr><th>Registro</th>' + anos.map(a => '<th class="n">' + a + '</th>').join('') + '</tr></thead><tbody>' +
    regs.map(rg => '<tr><td class="mono" title="' + esc(rg) + '">' + esc(rg.replace(/ - .*$/, '').replace(/\/.*$/, '')) + '</td>' + anos.map(a => { const x = S.regTable.find(t => t.ano === a && t.registro === rg); return '<td class="n">' + (x ? fBRLc(x.pis + x.cof) : '—') + '</td>'; }).join('') + '</tr>').join('') +
    '<tr class="tot"><td>Total</td>' + anos.map(a => '<td class="n">' + fBRLc(S.regTable.filter(t => t.ano === a).reduce((s, t) => s + t.pis + t.cof, 0)) + '</td>').join('') + '</tr></tbody></table></div></div></section></div>';
}
function viewPainelSai(T, potT, per, tm, econ, comG, anos, regs) {
  const ck = Object.fromEntries(S.checks.map(c => [c.id, c])), icms = ck['icms-base'], semT = ck['sem-trib'];
  const icmsV = icms && icms.st === 'opp' ? icms.v || 0 : 0, tot = potT + icmsV;
  return '<div class="phead"><div><span class="band">Etapa 2 · Painel · Saídas (047)</span><h1><em>' + fBRL(tot) + '</em> de PIS/COFINS pagos a maior nas vendas</h1>' +
    '<p>' + esc(S.empresa.nome || 'CNPJ ' + fmtCNPJ(S.empresa.cnpj)) + ' · ' + per + ' · ' + fNum(T.n) + ' linhas lidas e organizadas em ' + fMs(S.procMs) + '. Vendas tributadas indevidamente' + (icmsV ? ' e ICMS na base de cálculo (Tema 69)' : '') + '. Valores nominais; a classificação ainda pode ser revisada.</p></div>' +
    '<div class="toolbar"><button class="btn" data-go="classificar" type="button">Revisar classificação</button><button class="btn primary" data-go="exportar" type="button">' + ICON.dl + 'Gerar Excel e Word</button></div></div>' +
    '<div class="kpis">' +
    kpi('Linhas processadas', fNum(T.n), S.months.length + ' meses · ' + fNum(new Set(S.recs.map(r => r.registro)).size) + ' registros') +
    kpi('Saídas (Vlr Item)', fBRLc(T.vlrItem), fBRL(T.vlrItem)) +
    kpi('PIS/COFINS sobre as vendas', fBRLc(T.pis + T.cof), 'PIS ' + fBRLc(T.pis) + ' · COFINS ' + fBRLc(T.cof)) +
    kpi('Vendas tributadas', fNum(T.comN), fBRLc(T.comV) + ' em ' + S.groups.length + ' grupos') +
    '<div class="kpi hero"><div class="kpi-l">Tributado indevidamente</div><div class="kpi-v"><span>' + fBRLc(potT) + '</span></div><div class="kpi-s">PIS ' + fBRL(S.pot.pis) + ' · COFINS ' + fBRL(S.pot.cof) + '</div></div>' +
    '<div class="kpi' + (icmsV ? ' hero' : '') + '"><div class="kpi-l">ICMS na base (Tema 69)</div><div class="kpi-v">' + (icmsV ? '<span>' + fBRLc(icmsV) + '</span>' : (icms && icms.st === 'ok' ? 'Já exclui' : '—')) + '</div><div class="kpi-s">' + (icms ? esc(icms.st === 'ok' ? 'ICMS fora da base ' + (icms.txt.match(/(em todo o período analisado|a partir de [^(]+)/) || [''])[0].trim() : icms.txt.split('. ')[0]) : '') + '</div></div>' +
    '</div>' +
    '<div class="grid2"><section class="card"><div class="card-h"><h2>PIS/COFINS por mês: débito escriturado e tributado indevidamente</h2><div class="legend"><span><i style="background:var(--ink-3);opacity:.45"></i>Débito escriturado (PIS + COFINS)</span><span><i style="background:var(--copper)"></i>Tributado indevidamente</span>' + (icmsV ? '<span><i style="background:var(--copper-light);opacity:.75"></i>ICMS na base (Tema 69)</span>' : '') + '</div></div>' +
    '<div class="card-b"><div class="chart-wrap"><div class="chart" id="chart">' + chartSvg() + '</div></div>' +
    '<div style="margin-top:14px" class="small muted">Regime por mês (pelas alíquotas das vendas)</div><div class="regime" style="margin-top:6px">' + S.months.map(m => '<span class="' + (m.regime === 'NC' ? '' : m.regime === 'CUM' ? 'cum' : 'none') + '" title="' + m.mes + ': ' + (m.regime === 'NC' ? 'não cumulativo' : m.regime === 'CUM' ? 'cumulativo' : 'sem débito escriturado') + '"></span>').join('') + '</div>' +
    '<div class="legend" style="margin-top:8px"><span><i style="background:var(--copper);opacity:.8"></i>Não cumulativo (1,65% e 7,6%)</span><span><i style="background:var(--ink-3)"></i>Cumulativo (0,65% e 3%)</span><span><i style="background:var(--line)"></i>Sem débito no mês</span></div>' +
    (semT && semT.n ? '<p class="small" style="margin-top:12px"><b>A conferir:</b> ' + esc(semT.txt) + '</p>' : '') + '</div></section>' +
    timeCard(tm, econ) + '</div>' +
    '<div class="grid2 even"><section class="card"><div class="card-h"><h2>Maiores grupos a recuperar</h2><button class="btn" data-go="classificar" type="button">Ver todos</button></div><div class="card-b"><div class="tbl-wrap"><table><thead><tr><th>NCM · CFOP</th><th>Produto</th><th class="n">Itens</th><th class="n">PIS + COFINS</th></tr></thead><tbody>' +
    (comG.length ? comG.map(x => '<tr class="click" data-g="' + esc(x.g.key) + '"><td class="mono">' + fmtNCM(x.g.ncm) + '<div class="xs muted">' + esc(x.g.cfop) + '</div></td><td class="ellip" style="max-width:190px" title="' + esc(x.g.descTop) + '">' + esc(x.g.descTop) + '</td><td class="n">' + fNum(x.g.n) + '</td><td class="n"><b>' + fBRL(x.v) + '</b></td></tr>').join('') : '<tr><td colspan="4" class="muted">Nenhum grupo classificado como RECUPERAR.</td></tr>') +
    '</tbody></table></div></div></section>' +
    '<section class="card"><div class="card-h"><h2>Débitos escriturados por registro</h2><span class="sub">PIS + COFINS</span></div><div class="card-b"><div class="tbl-wrap"><table><thead><tr><th>Ano</th>' + regs.map(rg => '<th class="n" title="' + esc(rg) + '">' + esc(rg.replace(/ - .*$/, '')) + '</th>').join('') + '<th class="n">Total</th></tr></thead><tbody>' +
    anos.map(a => { const ts = S.regTable.filter(t => t.ano === a); return '<tr><td class="mono">' + a + '</td>' + regs.map(rg => { const x = ts.find(t => t.registro === rg); return '<td class="n">' + (x ? fBRLc(x.pis + x.cof) : '—') + '</td>'; }).join('') + '<td class="n"><b>' + fBRLc(ts.reduce((s, t) => s + t.pis + t.cof, 0)) + '</b></td></tr>'; }).join('') +
    '<tr class="tot"><td>Total</td>' + regs.map(rg => '<td class="n">' + fBRLc(S.regTable.filter(t => t.registro === rg).reduce((s, t) => s + t.pis + t.cof, 0)) + '</td>').join('') + '<td class="n">' + fBRLc(S.totals.pis + S.totals.cof) + '</td></tr></tbody></table></div></div></section></div>';
}
function kpi(l, v, s) { return '<div class="kpi"><div class="kpi-l">' + l + '</div><div class="kpi-v">' + v + '</div><div class="kpi-s">' + s + '</div></div>'; }
function timeCard(tm, econ) {
  const st = S.settings, mx = Math.max(tm.manual, 1);
  const inp = (id, label, val, step) => '<div class="field"><label for="' + id + '">' + label + '</label><input type="number" id="' + id + '" min="0" step="' + (step || 1) + '" value="' + val + '" data-prem="' + id.replace('p-', '') + '"></div>';
  return '<section class="card"><div class="card-h"><h2>Tempo da etapa de Excel</h2><span class="sub">estimativa</span></div><div class="card-b" style="display:grid;gap:14px">' +
    '<div class="time"><div class="time-col"><span class="kpi-l">Hoje, manual</span><span class="time-big">' + fDur(tm.manual) + '</span></div><div class="time-col"><span class="kpi-l">Com o Revisor</span><span class="time-big" style="color:var(--credit)">' + fDur(tm.assist) + '</span></div></div>' +
    '<div class="bar-cmp"><div><span>Manual</span><i style="width:100%"></i><span class="num">' + fDur(tm.manual) + '</span></div><div><span>Revisor</span><i class="fast" style="width:' + Math.max(2, tm.assist / mx * 100).toFixed(1) + '%"></i><span class="num">' + fDur(tm.assist) + '</span></div></div>' +
    '<p class="small">Economia estimada de <b>' + fDur(Math.max(0, econ)) + '</b> (' + Math.round(Math.max(0, econ) / mx * 100) + '%) nesta empresa. O processamento em si levou <b>' + fMs(S.procMs) + '</b>.</p>' +
    '<details class="prem"><summary>Premissas (minutos), ajuste à realidade da equipe</summary><div class="prem-grid">' +
    inp('p-minManualBase', 'Preparar base e dinâmicas', st.minManualBase) + inp('p-minManualGrupo', 'Classificar 1 grupo à mão', st.minManualGrupo, .1) +
    inp('p-minAssistGrupo', 'Revisar 1 grupo sugerido', st.minAssistGrupo, .1) + inp('p-minRelManual', 'Montar o relatório à mão', st.minRelManual) + inp('p-minRelAssist', 'Revisar a minuta', st.minRelAssist) +
    '</div><p class="xs muted" style="margin-top:8px">' + tm.G + ' grupos NCM + CFOP nesta empresa. Os padrões são pontos de partida, não medições.</p></details></div></section>';
}
function chartSvg() {
  const M = S.months, n = M.length, W = 760, H = 270, L = 64, Rr = 12, T = 24, B = 38, pw = W - L - Rr, ph = H - T - B;
  const vals = M.map(m => ({ e: m.pis + m.cof, p: m.pot, i: S.tipo === 'SAI' ? m.icmsPot || 0 : 0 }));
  const max = Math.max(1, ...vals.map(v => v.e + v.p + v.i));
  const step = (() => { const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; })();
  const top = Math.ceil(max / step) * step;
  const y = v => T + ph - v / top * ph, bw = pw / n, w = Math.max(2, bw * .68);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + TX('Crédito escriturado e não aproveitado por mês', 'Débito escriturado e valor tributado indevidamente por mês') + '">';
  for (let v = 0; v <= top + 1e-9; v += step) s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line-2)"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--ink-3)" font-family="var(--mono)">' + (v >= 1000 ? NUM.format(Math.round(v / 1000)) + ' mil' : NUM.format(v)) + '</text>';
  M.forEach((m, i) => {
    const x = L + i * bw + (bw - w) / 2, v = vals[i];
    s += '<g class="bar" data-i="' + i + '"><rect x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + ph + '" fill="transparent"/>' +
      '<rect x="' + x + '" y="' + y(v.e) + '" width="' + w + '" height="' + (T + ph - y(v.e)) + '" fill="var(--ink-3)" fill-opacity=".45"/>' +
      (v.p > 0 ? '<rect x="' + x + '" y="' + y(v.e + v.p) + '" width="' + w + '" height="' + (y(v.e) - y(v.e + v.p)) + '" fill="var(--copper)"/>' : '') +
      (v.i > 0 ? '<rect x="' + x + '" y="' + y(v.e + v.p + v.i) + '" width="' + w + '" height="' + (y(v.e + v.p) - y(v.e + v.p + v.i)) + '" fill="var(--copper-light)" fill-opacity=".75"/>' : '') + '</g>';
    if (m.ym % 100 === 1 || i === 0) s += '<text x="' + (L + i * bw + 1) + '" y="' + (H - 12) + '" font-size="11" fill="var(--ink-2)" font-family="var(--mono)">' + MES3[(m.ym % 100) - 1] + '/' + String(m.ano).slice(2) + '</text><line x1="' + (L + i * bw) + '" x2="' + (L + i * bw) + '" y1="' + (T + ph) + '" y2="' + (T + ph + 5) + '" stroke="var(--ink-3)"/>';
  });
  s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '" stroke="var(--ink-3)"/>';
  return s + '</svg>';
}
function bindChart() {
  const c = $('#chart'), tip = $('#tip'); if (!c) return;
  c.addEventListener('mousemove', e => {
    const g = e.target.closest('.bar'); if (!g) { tip.classList.remove('on'); return; }
    const m = S.months[+g.dataset.i];
    tip.innerHTML = '<div style="margin-bottom:4px;font-weight:600">' + ymLong(m.ym) + '</div>' + TX('Escriturado', 'Débito escriturado') + ' <b>' + fBRL(m.pis + m.cof) + '</b><br>' + TX('Não aproveitado', 'Tributado indevidamente') + ' <b>' + fBRL(m.pot) + '</b><br>' + (S.tipo === 'SAI' && m.icmsPot ? 'ICMS na base (Tema 69) <b>' + fBRL(m.icmsPot) + '</b><br>' : '') + 'Base PIS escriturada <b>' + fBRL(m.bcPis) + '</b>';
    const x = Math.min(window.innerWidth - 270, e.clientX + 14), y2 = Math.max(8, e.clientY - 70);
    tip.style.left = x + 'px'; tip.style.top = y2 + 'px'; tip.classList.add('on');
  });
  c.addEventListener('mouseleave', () => tip.classList.remove('on'));
}

/* ---------- 3. classificação ---------- */
function filteredGroups() {
  const q = normKey(S.ui.q), f = S.ui.filter;
  return S.groups.filter(g => {
    const cls = g.dec || g.sug.cls;
    if (f === 'COM' && cls !== CLS.COM) return false;
    if (f === 'SEM' && cls !== CLS.SEM) return false;
    if (f === 'AVA' && cls !== CLS.AVA) return false;
    if (f === 'REV' && !g.dec) return false;
    if (q) { const hay = normKey(g.ncm + ' ' + fmtNCM(g.ncm) + ' ' + g.cfop + ' ' + [...g.descs.keys()].join(' ') + ' ' + [...g.parts.keys()].join(' ') + ' ' + g.sug.motivo); if (!q.split(' ').every(t => hay.includes(t))) return false; }
    return true;
  });
}
function viewClassificar() {
  const C = { COM: 0, SEM: 0, AVA: 0 }; let tot = 0;
  for (const g of S.groups) { C[CLS_KEY[g.dec || g.sug.cls]] += g.vlr; tot += g.vlr; }
  const cnt = k => S.groups.filter(g => CLS_KEY[g.dec || g.sug.cls] === k).length;
  const high = S.groups.filter(g => !g.dec && g.sug.conf === 'a').length;
  const kbN = kbCount();
  const pct = v => (tot ? v / tot * 100 : 0).toFixed(1);
  const list = filteredGroups(), shown = list.slice(0, S.ui.showN);
  const segBtn = (k, label, n) => '<button type="button" data-filter="' + k + '" aria-pressed="' + (S.ui.filter === k) + '">' + label + ' <span class="ct">' + n + '</span></button>';
  return '<div class="phead"><div><span class="band">Etapa 3 · Classificação</span><h1><em>' + S.groups.length + ' grupos</em> de ' + TX('itens sem crédito', 'vendas tributadas') + ', já pré-classificados</h1>' +
    '<p>' + TX('Cada grupo reúne os itens com o mesmo NCM e CFOP, do maior para o menor valor. Confirme ou altere a sugestão: a decisão vale para todos os itens do grupo e pode ficar registrada para as próximas empresas.',
      'Cada grupo reúne as vendas tributadas com o mesmo NCM e CFOP, do maior para o menor valor. RECUPERAR marca o que não deveria ter pago PIS/COFINS (monofásico na revenda, alíquota zero, exportação, remessa, venda de ativo). A decisão vale para todo o grupo e pode ficar registrada para as próximas empresas.') + '</p></div></div>' +
    '<section class="card"><div class="card-b" style="display:grid;gap:10px"><div class="progress" role="img" aria-label="Distribuição do valor"><span class="p-com" style="width:' + pct(C.COM) + '%"></span><span class="p-ava" style="width:' + pct(C.AVA) + '%"></span><span class="p-sem" style="width:' + pct(C.SEM) + '%"></span></div>' +
    '<div class="legend"><span><i style="background:var(--credit)"></i>' + TX('Com crédito ', 'Recuperar ') + pct(C.COM).replace('.', ',') + '% do valor</span><span><i style="background:var(--warn)"></i>Avaliar ' + pct(C.AVA).replace('.', ',') + '%</span><span><i style="background:var(--ink-3)"></i>' + TX('Sem crédito ', 'Correto ') + pct(C.SEM).replace('.', ',') + '%</span><span>· ' + S.clsCount.revisados + ' de ' + S.groups.length + ' grupos confirmados pelo analista</span></div></div></section>' +
    '<div class="bulk"><div class="small"><b>Base da equipe:</b> ' + kbN + ' regra' + (kbN === 1 ? '' : 's') + ' aprendida' + (kbN === 1 ? '' : 's') + ' com decisões anteriores. ' + (high ? high + ' grupos têm sugestão de confiança alta ainda não confirmada.' : 'Todas as sugestões de confiança alta já foram confirmadas.') + '</div>' +
    '<div class="toolbar"><button class="btn" data-act="accept-high" type="button"' + (high ? '' : ' disabled') + '>Confirmar as ' + high + ' sugestões de confiança alta</button><button class="btn" data-act="kb-export" type="button">Exportar base</button><button class="btn" data-act="kb-import" type="button">Importar base</button><input type="file" id="kb-file" accept=".json" hidden></div></div>' +
    '<div class="toolbar"><label class="search">' + ICON.search + '<span class="sr">Buscar</span><input id="q" type="search" placeholder="Buscar NCM, CFOP, produto, ' + TX('fornecedor', 'cliente') + ' ou motivo" value="' + esc(S.ui.q) + '" autocomplete="off"></label>' +
    '<div class="seg" role="group" aria-label="Filtrar">' + segBtn('todos', 'Todos', S.groups.length) + segBtn('COM', TX('Com crédito', 'Recuperar'), cnt('COM')) + segBtn('AVA', 'Avaliar', cnt('AVA')) + segBtn('SEM', TX('Sem crédito', 'Correto'), cnt('SEM')) + segBtn('REV', 'Confirmados', S.clsCount.revisados) + '</div></div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>NCM</th><th>Produto</th><th>CFOP</th><th>CST</th><th class="n">Itens</th><th class="n hl">Vlr Item</th><th class="n">' + TX('Crédito', 'A recuperar') + '</th><th>Classificação</th><th>Motivo</th><th>Conf.</th></tr></thead><tbody id="gbody">' +
    (shown.length ? shown.map(groupRow).join('') : '<tr><td colspan="10" class="muted" style="padding:24px">Nenhum grupo com esse filtro.</td></tr>') + '</tbody></table></div>' +
    (list.length > shown.length ? '<div style="text-align:center"><button class="btn" data-act="more" type="button">Mostrar mais ' + Math.min(60, list.length - shown.length) + ' de ' + (list.length - shown.length) + ' restantes</button></div>' : '<p class="xs muted" style="text-align:center">' + list.length + ' grupo' + (list.length === 1 ? '' : 's') + ' · ' + fBRL(list.reduce((a, g) => a + g.vlr, 0)) + '</p>');
}
function groupRow(g) {
  const cls = g.dec || g.sug.cls, k = CLS_KEY[cls], cr = cls === CLS.COM ? groupCredit(g) : 0;
  const more = g.descs.size > 1 ? ' <span class="muted xs">+' + (g.descs.size - 1) + '</span>' : '';
  return '<tr class="click" data-g="' + esc(g.key) + '"><td class="mono">' + fmtNCM(g.ncm) + '</td><td class="ellip" style="max-width:240px" title="' + esc(g.descTop) + '">' + esc(g.descTop) + more + '</td><td class="mono" title="' + esc(cfopDesc(g.cfop)) + '">' + esc(g.cfop || '—') + '</td><td class="mono" title="' + esc(cstDesc(g.cstMain)) + '">' + esc(g.cstMain || '—') + '</td><td class="n">' + fNum(g.n) + '</td><td class="n hl">' + fBRL(g.vlr) + '</td><td class="n">' + (cr ? '<b style="color:var(--credit)">' + fBRL(cr) + '</b>' : '<span class="muted">—</span>') + '</td>' +
    '<td><select class="cls-select ' + k + '" data-cls="' + esc(g.key) + '" aria-label="Classificação do grupo">' + [CLS.COM, CLS.AVA, CLS.SEM].map(c => '<option' + (c === cls ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>' + (g.dec ? ' <span class="edited">confirmado</span>' : '') + '</td>' +
    '<td class="ellip small" style="max-width:220px" title="' + esc(g.sug.motivo) + '">' + esc(g.dec && g.dec !== g.sug.cls ? 'Alterado pelo analista' : g.sug.motivo) + '</td><td>' + confBars(g.sug.conf) + '</td></tr>';
}

/* gaveta do grupo */
function drawerFx(el) { el.classList.remove('fx'); void el.offsetWidth; el.classList.add('fx'); }
function openDrawer(key) {
  const g = S.groups.find(x => x.key === key); if (!g) return;
  const novo = !$('#drawer').classList.contains('on') || S.ui.drawer !== key;
  S.ui.drawer = key;
  const cls = g.dec || g.sug.cls, cr = groupCredit(g);
  const months = g.recs.map(r => r.ym), mi = Math.min(...months), ma = Math.max(...months);
  const parts = [...g.parts.entries()].sort((a, b) => b[1] - a[1]);
  const descs = [...g.descs.entries()].sort((a, b) => b[1] - a[1]);
  const items = g.recs.slice(0, 60);
  const m = S.map;
  const dr = $('#drawer');
  dr.innerHTML = '<div class="dr-h"><div><div class="mono small muted">NCM ' + fmtNCM(g.ncm) + ' · CFOP ' + esc(g.cfop || '—') + '</div><h3>' + esc(g.descTop) + '</h3></div><button class="x" data-act="close" type="button" aria-label="Fechar">' + ICON.x + '</button></div>' +
    '<div class="dr-b"><dl class="kv"><div><dt>Itens</dt><dd>' + fNum(g.n) + '</dd></div><div><dt>Vlr Item</dt><dd>' + fBRL(g.vlr) + '</dd></div><div><dt>' + TX('Crédito potencial', 'A recuperar') + '</dt><dd style="color:var(--credit)">' + (cr ? fBRL(cr) : '—') + '</dd></div>' +
    '<div><dt>CFOP</dt><dd class="small">' + esc(cfopDesc(g.cfop)) + '</dd></div><div><dt>CST</dt><dd class="small">' + [...g.csts.keys()].map(c => esc(c + ' · ' + cstDesc(c))).join('<br>') + '</dd></div><div><dt>Período</dt><dd>' + ymLabel(mi) + (ma !== mi ? ' a ' + ymLabel(ma) : '') + '</dd></div></dl>' +
    '<div class="why"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="small muted">Sugestão do motor</span>' + pill(g.sug.cls) + confBars(g.sug.conf) + '<span class="xs muted">confiança ' + CONF[g.sug.conf].toLowerCase() + ' · regra: ' + esc(g.sug.origem) + '</span></div><div>' + esc(g.sug.motivo) + '</div>' + (g.sug.lei ? '<div class="law">' + esc(g.sug.lei) + '</div>' : '') + '</div>' +
    '<div><div class="small muted" style="margin-bottom:8px">Decisão para os ' + fNum(g.n) + ' itens do grupo</div><div class="choice">' +
    [[CLS.COM, TX('Entra no crédito apurado', 'Entra no valor a recuperar')], [CLS.AVA, 'Fica pendente de análise'], [CLS.SEM, TX('Fora do crédito', 'Tributação mantida')]].map(([c, d]) => '<button type="button" class="' + CLS_KEY[c] + '" data-choose="' + c + '" aria-pressed="' + (cls === c) + '">' + c + '<span>' + d + '</span></button>').join('') + '</div></div>' +
    '<label class="check"><input type="checkbox" id="learn"' + (g.learn || S.kb[kbKey(g)] ? ' checked' : '') + '><span>Lembrar esta decisão nas próximas empresas (NCM ' + fmtNCM(g.ncm) + ' + CFOP ' + esc(g.cfop || '—') + ')</span></label>' +
    '<div><div class="small muted" style="margin-bottom:6px">Descrições no grupo</div><div class="desc-list">' + descs.slice(0, 6).map(([d, n]) => '<div><span>' + esc(d) + '</span><span class="mono xs">' + n + '</span></div>').join('') + (descs.length > 6 ? '<div class="muted xs">+ ' + (descs.length - 6) + ' descrições</div>' : '') + '</div></div>' +
    (parts.length ? '<div><div class="small muted" style="margin-bottom:6px">' + TX('Fornecedores', 'Clientes') + '</div><div class="desc-list">' + parts.slice(0, 4).map(([d, n]) => '<div><span>' + esc(d) + '</span><span class="mono xs">' + n + '</span></div>').join('') + '</div></div>' : '') +
    '<div><div class="small muted" style="margin-bottom:6px">Itens (' + (g.n > items.length ? 'primeiros ' + items.length + ' de ' + fNum(g.n) : fNum(g.n)) + '). Altere um item só quando ele fugir da regra do grupo.</div><div class="tbl-wrap"><table><thead><tr><th>Mês</th><th>Doc.</th><th>Descrição</th><th class="n">Vlr Item</th><th>Item</th></tr></thead><tbody>' +
    items.map(r => '<tr><td class="mono xs">' + r.mes + '</td><td class="mono xs">' + esc(m.numDoc != null ? r.v[m.numDoc] || '' : '') + '</td><td class="ellip small" style="max-width:180px" title="' + esc(r.desc) + '">' + esc(r.desc) + '</td><td class="n small">' + fBRL(r.vlrItem) + '</td><td><select class="cls-select ' + CLS_KEY[clsOf(r)] + '" data-item="' + r.i + '" aria-label="Classificação do item"><option value="">Do grupo</option>' + [CLS.COM, CLS.AVA, CLS.SEM].map(c => '<option' + (r.ov === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></td></tr>').join('') +
    '</tbody></table></div></div></div>';
  dr.classList.add('on'); dr.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on');
  if (novo) drawerFx(dr);
  setTimeout(() => { const b = dr.querySelector('[aria-pressed="true"]'); (b || dr.querySelector('.x')).focus(); }, 50);
}
function closeDrawer() { S.ui.drawer = null; const d = $('#drawer'); d.classList.remove('on'); d.setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('on'); }

/* ---------- 4. checklist ---------- */
function viewChecklist() {
  const att = S.checks.filter(c => c.st === 'risk' || c.st === 'warn').length;
  return '<div class="phead"><div><span class="band">Etapa 4 · Checklist</span><h1>' + S.checks.length + ' verificações, <em>' + att + ' pedem atenção</em></h1>' +
    '<p>O mesmo roteiro em todas as empresas, para que nenhum ponto dependa da memória de quem faz a análise. O texto sugerido de cada item entra na minuta do diagnóstico.</p></div></div>' +
    '<div class="checks">' + S.checks.map((c, i) => '<article class="ck ' + c.st + '"><div class="ck-bar"></div><div class="ck-b"><div class="ck-top"><span class="ck-n">' + String(i + 1).padStart(2, '0') + '</span><h3>' + esc(c.t) + '</h3><span class="st ' + c.st + '">' + STATUS[c.st] + '</span>' + (c.v != null && c.v > 0 ? '<span class="ck-val">' + fBRL(c.v) + '</span>' : '') + '</div>' +
      '<p class="ck-txt">' + esc(c.txt) + '</p><p class="small"><b>O que fazer:</b> ' + esc(c.acao) + '</p>' +
      (c.rel ? '<details class="rep"><summary>Texto sugerido para o relatório</summary><blockquote id="rel-' + c.id + '">' + esc(c.rel) + '</blockquote><button class="btn" style="margin-top:8px" data-copy="rel-' + c.id + '" type="button">' + ICON.copy + 'Copiar texto</button></details>' : '') + '</div></article>').join('') + '</div>';
}

/* ---------- 5. exportar ---------- */
const anaDe = t => t === S.tipo ? S : S.analyses[t].snap;
const fData = ms => new Date(ms).toLocaleDateString('pt-BR');
function arquivoXlsx(t) { const a = anaDe(t); return 'Revisão PIS-COFINS - ' + MODES[t].nome + ' - ' + nomeArq() + ' - ' + ymLabel(a.months[0].ym).replace('/', '-') + ' a ' + ymLabel(a.months[a.months.length - 1].ym).replace('/', '-') + '.xlsx'; }
const nomeArq = () => (S.empresa.nome.trim() || fmtCNPJ(S.empresa.cnpj)).replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
function viewExportar() {
  const st = S.settings, tl = tiposCarregados(), falta = ['ENT', 'SAI'].filter(t => !tl.includes(t)), md = S.modelo, nomeOk = !!S.empresa.nome.trim();
  const rel = S.relatModelo && S.relatModelo.cnpj === digits(S.empresa.cnpj) ? S.relatModelo : null;
  const linhaAn = t => { const a = anaDe(t); return '<li class="rd ok"><span class="rd-i"></span><div><b>' + MODES[t].planilha + ' · ' + MODES[t].nome + '</b><div class="small muted">' + fNum(a.totals.n) + ' linhas · ' + ymLabel(a.months[0].ym) + ' a ' + ymLabel(a.months[a.months.length - 1].ym) + ' · ' + esc(a.files.join(', ')) + '</div></div><span></span></li>'; };
  const linhaFalta = t => '<li class="rd warn"><span class="rd-i"></span><div><b>' + MODES[t].planilha + ' · ' + MODES[t].nome + ': ainda não importada</b><div class="small muted">' + (t === 'SAI' ? 'Sem ela, a parte das saídas (exclusão do ICMS, alíquota zero, monofásicos) fica marcada em amarelo no Word.' : 'Sem ela, a parte das entradas (notas sem crédito, relação dos NCM) fica marcada em amarelo no Word.') + '</div></div><button class="btn" data-act="pick-add" type="button">Importar a ' + MODES[t].planilha + '</button></li>';
  const temPadrao = !!modeloPadrao(), comModelo = !!md || temPadrao;
  const X5 = extrasDaEmpresa();
  const itens = tl.map(t => 'Excel ' + MODES[t].planilha).concat(X5.j513 ? ['Excel Junção 513'] : []).concat(X5.ecdA ? ['Excel ECD'] : []).concat(comModelo ? ['Word no modelo da Milk' + (tl.length > 1 ? ' (037 + 047)' : '')] : tl.map(t => 'Word ' + MODES[t].planilha));
  // abas na ordem do arquivo: as da analista primeiro, as do Revisor no fim
  const tabs = t => t === 'SAI' ? [MODES[t].base, 'REGISTRO', 'MODELO', 'CFOP', 'DIN NCM COM PC - ORDEM CRESCENT', 'NOTAS COM PC', 'NOTAS SEM PC', 'DIN NCM SEM PC', 'RESUMO', 'ITENS A RECUPERAR', MODES[t].apurado, 'RESUMO NCM', 'CHECKLIST']
    : [MODES[t].base, 'DINAMICA POR REG', 'DINAM POR BC PC', 'NOTAS COM PC', 'DINAMICA POR NCM', 'NOTAS SEM PC', 'RESUMO', MODES[t].apurado, 'RESUMO NCM', 'CHECKLIST'];
  const tabsTxt = t => t === 'SAI' ? 'As mesmas abas e dinâmicas do Excel da analista, com a mesma formatação. No fim, as abas do Revisor com a classificação e o valor a recuperar.'
    : 'As abas que a equipe monta hoje, com tabelas dinâmicas de verdade, filtros, totais e a coluna CLASSIF.';
  return '<div class="phead"><div><span class="band">Etapa 6 · Exportar</span><h1><em>Excel</em> e <em>Word</em> desta empresa</h1><p>Os arquivos saem com a classificação atual. Se algo mudar depois, aqui ou no Excel, basta gerar de novo.</p></div></div>' +
    '<section class="card"><div class="card-h"><h2>Tudo pronto para baixar?</h2><span class="sub">' + esc(fmtCNPJ(S.empresa.cnpj)) + '</span></div><div class="card-b"><ul class="ready">' +
    tl.map(linhaAn).join('') + falta.map(linhaFalta).join('') +
    (X5.j513 ? '<li class="rd ok"><span class="rd-i"></span><div><b>Junção 513 · notas fora do EFD-Contribuições</b><div class="small muted">' + fNum(X5.j513.res.cand.E) + ' entradas · crédito ' + fBRL(X5.j513.res.pis + X5.j513.res.cof) + (X5.j513.res.ava.E + X5.j513.res.ava.S ? ' · ' + (X5.j513.res.ava.E + X5.j513.res.ava.S) + ' notas para avaliar' : '') + '</div></div><button class="btn" data-go="outras" type="button">Ver</button></li>' : '') +
    (X5.ecdA ? '<li class="rd ok"><span class="rd-i"></span><div><b>ECD · contas de despesa x 037</b><div class="small muted">' + X5.ecdA.res.sim + ' contas incluídas · crédito ' + fBRL(X5.ecdA.res.pis + X5.ecdA.res.cof) + (X5.ecdA.res.ava ? ' · ' + X5.ecdA.res.ava + ' contas para avaliar' : '') + '</div></div><button class="btn" data-go="outras" type="button">Ver</button></li>' : '') +
    (X5.ecf ? '<li class="rd ok"><span class="rd-i"></span><div><b>ECF 0000/0010</b><div class="small muted">Regime de apuração: ' + esc(textoApuracao(X5.ecf)) + '</div></div><span></span></li>' : '') +
    '<li class="rd ' + (nomeOk ? 'ok' : 'warn') + '" id="rd-nome"><span class="rd-i"></span><div class="field"><label for="f-nome">Nome da empresa (capa, carta e nome dos arquivos)</label><input type="text" id="f-nome" value="' + esc(S.empresa.nome) + '" placeholder="Razão social, como deve sair no relatório" autocomplete="off"></div><span></span></li>' +
    (md ? '<li class="rd ok"><span class="rd-i"></span><div><b>Modelo do diagnóstico: ' + esc(md.nome) + '</b><div class="small muted">Modelo próprio, carregado em ' + fData(md.data) + (md.empresaModelo ? ' · empresa do modelo: ' + esc(md.empresaModelo) : '') + '. Fica salvo só neste navegador.</div></div><div class="toolbar"><button class="btn" data-act="modelo" type="button">Trocar</button>' + (temPadrao ? '<button class="btn" data-act="modelo-del" type="button">Usar o padrão da Milk</button>' : '<button class="btn" data-act="modelo-del" type="button">Remover</button>') + '</div></li>'
      : temPadrao ? '<li class="rd ok"><span class="rd-i"></span><div><b>Modelo do diagnóstico: padrão da Milk</b><div class="small muted">O diagnóstico de sempre da Milk, com os dados desta empresa. O que depende de outras fontes (gráficos do SistemaMA, ECD) fica em amarelo para completar.</div></div><button class="btn" data-act="modelo" type="button">Usar outro modelo</button></li>'
      : '<li class="rd warn"><span class="rd-i"></span><div><b>Modelo do diagnóstico (Word) ainda não carregado</b><div class="small muted">Carregue o .docx que a equipe usa como ponto de partida.</div></div><button class="btn" data-act="modelo" type="button">Carregar modelo</button></li>') +
    (comModelo ? '<li class="rd' + (S.logoCliente ? ' ok' : '') + '"><span class="rd-i"></span><div><b>Logotipo do cliente na capa</b><div class="small muted">' + (S.logoCliente ? 'Fica guardado para este CNPJ.' : 'Opcional. Sem ele, a capa fica com o aviso [LOGOTIPO DO CLIENTE] em amarelo.') + '</div></div><div class="toolbar">' + (S.logoCliente ? '<span class="logo-prev"><img src="' + S.logoCliente.data + '" alt="Logotipo do cliente"></span><button class="btn" data-act="logo-cli-del" type="button">Remover</button>' : '<button class="btn" data-act="logo-cli" type="button">Carregar logotipo</button>') + '</div></li>' : '') +
    '</ul><input type="file" id="modelo-file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden><input type="file" id="logo-cli-file" accept="image/*,.jpg,.jpeg,.png,.webp,.jfif" hidden>' +
    '<div class="go-all"><div class="small muted">' + (itens.length > 1 ? 'Saem' : 'Sai') + ': <b>' + itens.join(' · ') + '</b></div><button class="btn primary big" data-act="tudo" type="button" id="b-tudo">' + ICON.dl + 'Baixar tudo</button></div></div></section>' +
    (rel ? '<section class="card"><div class="card-h"><h2>Conferência do último Word gerado</h2><span class="sub">' + esc(rel.arquivo) + '</span></div><div class="card-b grid2 even rel-cols"><div><div class="small muted" style="margin-bottom:6px">Preenchido automaticamente</div><ul class="rel-list ok">' + rel.feitos.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div><div><div class="small muted" style="margin-bottom:6px">Completar no Word (marcado em <mark>amarelo</mark>)</div><ul class="rel-list pend">' + (rel.pendentes.length ? rel.pendentes.map(x => '<li>' + esc(x) + '</li>').join('') : '<li>Nada pendente.</li>') + '</ul>' +
      ((rel.amarelo || []).length ? '<details class="rep" style="margin-top:10px"><summary>' + rel.amarelo.length + ' trecho' + (rel.amarelo.length === 1 ? '' : 's') + ' de texto em amarelo para revisar</summary><ul class="rel-list pend" style="margin-top:8px">' + rel.amarelo.slice(0, 30).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></details>' : '') + '</div></div></section>' : '') +
    '<section class="card"><div class="card-h"><h2>Dados do relatório</h2><button class="btn" data-act="perfil" type="button">Editar no perfil</button></div><div class="card-b" style="display:grid;gap:14px">' +
    '<p class="small">Assina o relatório: <b>' + esc(st.analista || 'nome não informado') + '</b>' + (S.perfil.cargo ? ', ' + esc(S.perfil.cargo) : '') + (S.perfil.oab ? ' · OAB ' + esc(S.perfil.oab) : '') + ' · ' + esc(st.escritorio || 'escritório') + ' · carta datada em <b>' + esc(st.cidade || '—') + '</b>.</p>' +
    (tl.includes('ENT') ? '<label class="toggle"><input type="checkbox" id="f-icms"' + (st.excluirIcms ? ' checked' : '') + '><span><b>037: excluir o ICMS da base do crédito a partir de 05/2023</b><br><span class="small muted">Lei 14.592/2023. Desmarque só se houver decisão judicial em favor da empresa. Também pode ser alterado depois, na aba RESUMO do Excel.</span></span></label>' : '') +
    '</div></section>' +
    '<h2 class="sec-h">Arquivos separados</h2><div class="exports">' +
    tl.map(t => '<section class="card xp">' + fileIcon('x', 'Planilha do Excel (.xlsx)') + '<h3>Excel ' + MODES[t].planilha + ' · ' + MODES[t].nome + '</h3><p class="small muted">' + tabsTxt(t) + '</p><div class="tabs-list">' + tabs(t).map(x => '<span>' + x + '</span>').join('') + '</div><button class="btn big" data-act="xlsx" data-tipo="' + t + '" type="button">' + ICON.dl + 'Baixar Excel ' + MODES[t].planilha + '</button></section>').join('') +
    '<section class="card xp">' + fileIcon('w', 'Documento do Word (.docx)') + '<h3>Diagnóstico Fiscal (Word)</h3><p class="small muted">' + (md ? 'O seu modelo' : 'O modelo da Milk') + ', com os dados desta empresa' + (tl.length > 1 ? ' (037 e 047 juntas)' : '') + '. A conferência do que foi preenchido aparece nesta tela.</p>' +
    (comModelo ? '<div class="tabs-list">' + ['Nome e CNPJ', 'Data e período', 'Forma de tributação', 'Valores', 'Alíquota zero', 'Relação dos NCM', 'Quadro da conclusão'].map(x => '<span>' + x + '</span>').join('') + '</div><button class="btn big" data-act="docx" type="button" id="b-docx">' + ICON.dl + 'Baixar Word</button>'
      : tl.map(t => '<button class="btn big" data-act="docx" data-tipo="' + t + '" type="button">' + ICON.dl + 'Minuta ' + MODES[t].planilha + '</button>').join('')) + '</section>' +
    '<section class="card xp">' + fileIcon('j', 'Arquivo de dados (.json)') + '<h3>Base de classificação da equipe</h3><p class="small muted">As ' + Object.keys(S.kb).length + ' decisões registradas (NCM + CFOP, entradas e saídas). Importe em outro computador para compartilhar o aprendizado.</p><button class="btn big" data-act="kb-export" type="button">' + ICON.dl + 'Baixar base</button></section>' +
    '</div><p class="foot">Classificações sugeridas por regras automáticas e confirmadas pelo analista. Valores nominais. A responsabilidade técnica do diagnóstico é do escritório.</p>';
}

/* ---------- eventos ---------- */
function bindEvents() {
  $$('.step').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  $('#btn-import').addEventListener('click', () => { S.ui.aposImport = null; $('#file').click(); });
  $('#company').addEventListener('click', e => {
    const sw = e.target.closest('[data-tipo-sw]'); if (sw) { trocarAnalise(sw.dataset.tipoSw); return; }
    if (e.target.closest('[data-goto-name]')) { go('exportar'); setTimeout(() => { const f = $('#f-nome'); if (f) f.focus(); }, 50); }
  });
  $('#file').addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) importFiles(fs); });
  $('#scrim').addEventListener('click', () => { closeDrawer(); closePerfil(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (S.ui.drawer) closeDrawer(); if (S.ui.perfil) closePerfil(); } });
  $('#btn-perfil').addEventListener('click', openPerfil);
  $('#btn-perfil-top').addEventListener('click', openPerfil);
  bindPerfil();
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== S.ui.view && ['importar', 'painel', 'classificar', 'checklist', 'outras', 'exportar'].includes(h)) go(h); });
  window.addEventListener('resize', () => { const h = $('#top').getBoundingClientRect().height; document.documentElement.style.setProperty('--toph', Math.round(h) + 'px'); });

  const view = $('#view');
  view.addEventListener('click', async e => {
    const t = e.target;
    const goBtn = t.closest('[data-go]'); if (goBtn) { go(goBtn.dataset.go); return; }
    const f = t.closest('[data-filter]'); if (f) { S.ui.filter = f.dataset.filter; S.ui.showN = 60; render(); return; }
    const cp = t.closest('[data-copy]');
    if (cp) { const el = $('#' + cp.dataset.copy); try { await navigator.clipboard.writeText(el.textContent); toast('Texto copiado.'); } catch (err) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Texto selecionado: use Ctrl+C.'); } return; }
    const a = t.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      if (act === 'pick') { S.ui.aposImport = null; $('#file').click(); }
      else if (act === 'pick-add') { S.ui.aposImport = 'exportar'; $('#file').click(); }
      else if (act === 'tudo') await doTudo(a);
      else if (act === 'modelo') { const inp = $('#modelo-file'); inp.onchange = async ev => { const fl = ev.target.files[0]; ev.target.value = ''; if (!fl) return; try { toast('Lendo o modelo…'); const r = await carregarModelo(fl); refreshExportar(); toast('Modelo carregado' + (r.nomeModelo ? ' (empresa do modelo: ' + r.nomeModelo + ')' : '') + '. ' + r.feitos.length + ' pontos preenchidos automaticamente.', 6000); } catch (err) { console.error(err); toast(err.message, 8000); } }; inp.click(); }
      else if (act === 'modelo-del') { S.modelo = null; S.relatModelo = null; await ARQ.del('modelo'); refreshExportar(); toast(modeloPadrao() ? 'Voltou ao modelo padrão da Milk.' : 'Modelo removido deste navegador.'); }
      else if (act === 'logo-cli') { const inp = $('#logo-cli-file'); inp.onchange = async ev => { const fl = ev.target.files[0]; ev.target.value = ''; if (!fl) return; try { const lg = await loadLogo(fl), c = digits(S.empresa.cnpj); S.logoCliente = Object.assign({ cnpj: c }, lg); if (c && !S.demo) await ARQ.set('logo-cliente:' + c, lg); refreshExportar(); toast('Logotipo do cliente aplicado à capa.'); } catch (err) { toast(err.message, 8000); } }; inp.click(); }
      else if (act === 'logo-cli-del') { const c = digits(S.empresa.cnpj); S.logoCliente = null; if (c) await ARQ.del('logo-cliente:' + c); refreshExportar(); toast('Logotipo do cliente removido.'); }
      else if (act === 'demo') process({ demo: a.dataset.tipo || 'ENT' });
      else if (act === 'sample') { try { const f = await buildSampleFile(a.dataset.tipo || 'ENT'); process({ files: [f], sample: true }); } catch (err) { showImportError('Não foi possível gerar a amostra: ' + err.message); } }
      else if (act === 'raw') { const tp = a.dataset.tipo || 'ENT', lb = a.lastChild, old = lb.textContent; a.disabled = true; lb.textContent = 'Gerando…'; try { const blob = await buildRawExport(tp); await saveFile(MODES[tp].titulo + ' (exemplo).xlsx', blob); } catch (err) { toast('Erro ao gerar: ' + err.message); } a.disabled = false; lb.textContent = old; }
      else if (act === 'more') { S.ui.showN += 60; render(); }
      else if (act === 'accept-high') { let n = 0; for (const g of S.groups) if (!g.dec && g.sug.conf === 'a') { g.dec = g.sug.cls; n++; } recompute(); render(); toast(n + ' grupos confirmados.'); }
      else if (act === 'kb-export') { const blob = new Blob([JSON.stringify({ versao: 1, gerado: new Date().toISOString(), regras: S.kb }, null, 2)], { type: 'application/json' }); await saveFile('base-classificacao-pis-cofins.json', blob); }
      else if (act === 'kb-import') { $('#kb-file').click(); $('#kb-file').onchange = async ev => { const fl = ev.target.files[0]; if (!fl) return; try { const j = JSON.parse(await fl.text()); const regras = j.regras || j; let n = 0; for (const [k, v] of Object.entries(regras)) if (v && v.cls && CLS_KEY[v.cls]) { S.kb[k] = v; n++; } saveKB(); for (const g of S.groups) if (!g.dec) g.sug = (S.tipo === 'SAI' ? suggestSai : suggest)(g, S.kb); recompute(); render(); toast(n + ' regras importadas.'); } catch (err) { toast('Arquivo inválido: ' + err.message, 4000); } }; }
      else if (act === 'perfil') openPerfil();
      else if (act === 'xlsx') await doXlsx(a);
      else if (act === 'docx') await doDocx(a);
      return;
    }
    const row = t.closest('tr[data-g]');
    if (row && !t.closest('select')) openDrawer(row.dataset.g);
  });
  view.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('select[data-cls]')) { const g = S.groups.find(x => x.key === t.dataset.cls); setGroupCls(g, t.value); const tr = t.closest('tr'); tr.outerHTML = groupRow(g); renderChrome(); refreshClsHeader(); toast('Grupo ' + fmtNCM(g.ncm) + ' · ' + t.value); }
    if (t.matches('[data-prem]')) { const v = parseFloat(String(t.value).replace(',', '.')); if (isFinite(v) && v >= 0) { S.settings[t.dataset.prem] = v; saveSettings(); const pos = t.id; render(); const el = $('#' + pos); if (el) { el.closest('details').open = true; el.focus(); } } }
    if (t.id === 'f-icms') { S.settings.excluirIcms = t.checked; saveSettings(); recompute(); renderChrome(); toast('Crédito potencial recalculado: ' + fBRL(S.pot.pis + S.pot.cof)); }
  });
  view.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q') { S.ui.q = t.value; S.ui.showN = 60; const pos = t.selectionStart; render(); const q = $('#q'); q.focus(); try { q.setSelectionRange(pos, pos); } catch (err) { /* */ } }
    if (t.id === 'f-nome') { definirNome(t.value); renderChrome(); const li = $('#rd-nome'); if (li) li.className = 'rd ' + (t.value.trim() ? 'ok' : 'warn'); }
    if (t.id === 'f-esc') { S.settings.escritorio = t.value; saveSettings(); }
    if (t.id === 'f-cid') { S.settings.cidade = t.value; saveSettings(); }
    if (t.id === 'f-ana') { S.settings.analista = t.value; saveSettings(); }
  });
  const dr = $('#drawer');
  dr.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-act="close"]')) { closeDrawer(); return; }
    const ch = t.closest('[data-choose]');
    if (ch) { const g = S.groups.find(x => x.key === S.ui.drawer); g.learn = $('#learn').checked; setGroupCls(g, ch.dataset.choose); openDrawer(g.key); refreshAfterDrawer(); toast('Decisão aplicada a ' + fNum(g.n) + ' itens' + (g.learn ? ' e registrada na base da equipe.' : '.')); }
  });
  dr.addEventListener('change', e => {
    const t = e.target, g = S.groups.find(x => x.key === S.ui.drawer); if (!g) return;
    if (t.id === 'learn') { g.learn = t.checked; const k = kbKey(g); if (t.checked) { learnGroup(g); toast('Registrado na base da equipe.'); } else { delete S.kb[k]; saveKB(); toast('Removido da base da equipe.'); } }
    if (t.matches('select[data-item]')) { const r = g.recs.find(x => x.i === +t.dataset.item); r.ov = t.value || null; recompute(); t.className = 'cls-select ' + CLS_KEY[clsOf(r)]; refreshAfterDrawer(); toast('Item ajustado.'); }
  });
}
function refreshAfterDrawer() { renderChrome(); if (S.ui.view === 'classificar' || S.ui.view === 'painel') { const y = window.scrollY; const keep = S.ui.drawer; render(); window.scrollTo(0, y); S.ui.drawer = keep; } }
function refreshClsHeader() { const y = window.scrollY; render(); window.scrollTo(0, y); }

/* gera o Excel de uma análise (a que está na tela ou a outra planilha da mesma empresa) */
async function gerarXlsx(t, onProg) {
  const atual = S.tipo, troca = t !== atual;
  if (troca) ativarAnalise(t);
  try { const r = { nome: arquivoXlsx(t), blob: await buildWorkbook(onProg) }; if (abasDivididas().length) toast('Atenção: ' + avisoDivisao(), 9000); return r; }
  finally { if (troca) ativarAnalise(atual); }
}
async function gerarWord(t) {
  const bytes = modeloBytes(); // o modelo carregado pela equipe ou, sem ele, o modelo padrão da Milk
  if (bytes) {
    const r = await preencherModelo(bytes, dadosModelo());
    const nome = 'Diagnóstico Fiscal - ' + nomeArq() + '.docx';
    S.relatModelo = Object.assign({ cnpj: digits(S.empresa.cnpj), arquivo: nome }, r.relat);
    return [{ nome, blob: new Blob([r.bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) }];
  }
  const out = [], atual = S.tipo;
  for (const x of (t ? [t] : tiposCarregados())) {
    if (x !== S.tipo) ativarAnalise(x);
    try { out.push({ nome: 'Diagnóstico Fiscal - ' + MODES[x].nome + ' - ' + nomeArq() + '.docx', blob: buildDocx() }); }
    finally { if (S.tipo !== atual) ativarAnalise(atual); }
  }
  return out;
}
function pedirNome() {
  if (S.empresa.nome.trim()) return true;
  const f = $('#f-nome'); if (f) { f.focus(); f.closest('li').classList.add('need'); }
  toast('Informe o nome da empresa: ele vai para a capa, a carta e o nome dos arquivos.', 5000);
  return false;
}
async function doXlsx(btn) {
  const t = btn.dataset.tipo || S.tipo;
  btn.disabled = true; const lbl = btn.innerHTML; const t0 = now();
  try {
    btn.textContent = 'Gerando…';
    const f = await gerarXlsx(t, (sheet, p) => { btn.textContent = 'Gerando ' + sheet.toLowerCase() + (p ? ' ' + p + '%' : '') + '…'; });
    btn.textContent = 'Pronto em ' + fMs(now() - t0);
    await saveFile(f.nome, f.blob);
  } catch (e) { console.error(e); toast('Não foi possível gerar o Excel: ' + e.message, 5000); }
  setTimeout(() => { btn.disabled = false; btn.innerHTML = lbl; }, 1200);
}
async function doDocx(btn) {
  if (!pedirNome()) return;
  btn.disabled = true; const lbl = btn.innerHTML;
  try {
    btn.textContent = 'Gerando…'; await tick();
    const fs = await gerarWord(btn.dataset.tipo);
    for (const f of fs) await saveFile(f.nome, f.blob, { retry: true });
    refreshExportar();
  } catch (e) { console.error(e); toast('Não foi possível gerar o Word: ' + e.message, 6000); }
  btn.disabled = false; btn.innerHTML = lbl;
}
/* um clique: o Excel de cada planilha carregada e o Word */
async function doTudo(btn) {
  if (!pedirNome()) return;
  btn.disabled = true; const lbl = btn.innerHTML; const t0 = now(); let n = 0;
  try {
    for (const t of tiposCarregados()) {
      const f = await gerarXlsx(t, (sheet, p) => { btn.textContent = 'Excel ' + MODES[t].planilha + ': ' + sheet.toLowerCase() + (p ? ' ' + p + '%' : '') + '…'; });
      btn.textContent = 'Salvando Excel ' + MODES[t].planilha + '…';
      if (await saveFile(f.nome, f.blob, { retry: true })) n++;
      await sleep(400);
    }
    if (extrasDaEmpresa().j513) {
      btn.textContent = 'Excel da Junção 513…'; await tick();
      if (await saveFile(arquivoJ513(), await buildWorkbookJ513(), { retry: true })) n++;
      await sleep(400);
    }
    if (extrasDaEmpresa().ecdA) {
      btn.textContent = 'Excel da ECD…'; await tick();
      if (await saveFile(arquivoECD(), await buildWorkbookECD(), { retry: true })) n++;
      await sleep(400);
    }
    btn.textContent = 'Gerando o Word…'; await tick();
    for (const f of await gerarWord()) { if (await saveFile(f.nome, f.blob, { retry: true })) n++; await sleep(300); }
    toast(n + ' arquivo' + (n === 1 ? '' : 's') + ' gerado' + (n === 1 ? '' : 's') + ' em ' + fMs(now() - t0) + '.', 4000);
    refreshExportar();
  } catch (e) { console.error(e); toast('Não foi possível gerar: ' + e.message, 6000); }
  const b = $('#b-tudo'); if (b) { b.disabled = false; b.innerHTML = lbl; }
}
function refreshExportar() { if (S.ui.view !== 'exportar') return; const y = window.scrollY; render(); window.scrollTo(0, y); }

/* modelo do diagnóstico (.docx): carregado uma vez, guardado neste navegador */
async function carregarModelo(file) {
  if (!/\.docx$/i.test(file.name)) throw new Error('O modelo precisa ser um arquivo .docx. Se for .doc, abra no Word e use Arquivo > Salvar como > Documento do Word (.docx).');
  if (file.size > 60 * 1024 * 1024) throw new Error('Arquivo muito grande para modelo (máx. 60 MB).');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let z; try { z = fflate.unzipSync(bytes, { filter: f => f.name === 'word/document.xml' }); } catch (e) { z = null; }
  if (!z || !z['word/document.xml']) throw new Error('Não consegui abrir "' + file.name + '" como documento do Word. Abra no Word e salve de novo como .docx.');
  const teste = await preencherModelo(bytes, dadosModelo()); // confere já no carregamento se o Revisor entende o modelo
  const m = { nome: file.name, bytes, data: Date.now(), empresaModelo: teste.relat.nomeModelo || '' };
  S.modelo = m; S.relatModelo = null;
  await ARQ.set('modelo', m);
  return teste.relat;
}
async function carregarLogoCliente() {
  const c = digits(S.empresa.cnpj);
  if (S.logoCliente && S.logoCliente.cnpj === c) return;
  S.logoCliente = null;
  if (!c) return;
  const v = await ARQ.get('logo-cliente:' + c);
  if (v && v.data) S.logoCliente = Object.assign({}, v, { cnpj: c });
}

/* ---------- início ---------- */
const LOGO_KEY = 'revisor-fiscal-logo-v1';
const LOGO_PADRAO = { data: '{{MILK_LOGO}}', w: 360, h: 360, padrao: true };
S.logo = store.get(LOGO_KEY, null) || LOGO_PADRAO;
function applyLogo() {
  const b = $('#brand'), img = $('#brand-logo');
  if (S.logo && S.logo.data) { img.src = S.logo.data; b.classList.add('has-logo'); b.classList.toggle('round', Math.abs(S.logo.w / S.logo.h - 1) < .25); } else { img.removeAttribute('src'); b.classList.remove('has-logo', 'round'); }
}

/* ---------- perfil de quem usa (fica salvo neste navegador) ---------- */
const PERFIL_KEY = 'revisor-fiscal-perfil-v1', TEMA_KEY = 'revisor-fiscal-tema';
// com servidor, o perfil vem da conta de quem entrou (nada do navegador, que pode ser de outro usuário)
S.perfil = Object.assign({ cargo: '', oab: '', email: '', tel: '', foto: null }, window.RF_SERVIDOR ? {} : store.get(PERFIL_KEY, {}));
S.ui.perfil = false;
if (window.RF_SERVIDOR) S.settings.analista = ''; // o nome certo chega com a conta (evita mostrar as iniciais de quem usou antes)
const savePerfil = () => { if (window.RF_SERVIDOR) servidorPerfil(); else store.set(PERFIL_KEY, S.perfil); };
/* Versão com servidor: nome, cargo, OAB, e-mail, telefone, escritório, cidade e foto ficam na conta do usuário (o tema, no navegador) */
let fotoNoServidor; // última foto salva na conta: a foto só é enviada quando muda
let perfilTimer = null;
function servidorPerfil() {
  if (!window.RF_SERVIDOR) return;
  clearTimeout(perfilTimer);
  perfilTimer = setTimeout(() => {
    fetch('/api/perfil', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ nome: S.settings.analista, cargo: S.perfil.cargo, oab: S.perfil.oab, telefone: S.perfil.tel, escritorio: S.settings.escritorio, cidade: S.settings.cidade }, S.perfil.foto !== fotoNoServidor ? { foto: S.perfil.foto || null } : {})) })
      .then(r => { if (r.status === 401) { location.href = '/login'; return; } if (r.ok) r.json().then(u => { fotoNoServidor = u.foto || null; }); else if (r.status === 400) toast('Não consegui salvar a foto. Tente outra imagem.'); }).catch(() => {});
  }, 700);
}
async function carregarContaServidor() {
  if (!window.RF_SERVIDOR) return;
  try {
    const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (r.status === 401) { location.href = '/login'; return; }
    const u = await r.json(); S.conta = u;
    if (u.nome) S.settings.analista = u.nome;
    if (u.escritorio) S.settings.escritorio = u.escritorio;
    if (u.cidade) S.settings.cidade = u.cidade;
    Object.assign(S.perfil, { cargo: u.cargo || '', oab: u.oab || '', email: u.email, tel: u.telefone || '', foto: u.foto || null });
    fotoNoServidor = S.perfil.foto;
    store.del(PERFIL_KEY); // limpa o perfil antigo guardado no navegador (de antes do login por conta)
    renderPerfilChip();
  } catch (e) { /* sem conexão: segue com o que está no navegador */ }
}
const iniciais = n => { const p = String(n || '').trim().split(/\s+/).filter(w => w.length > 2 || /^[A-ZÀ-Ú]/.test(w)); return p.length ? (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() : ''; };
const ICON_USER = '<svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4 20.5c1.6-3.6 4.6-5.5 8-5.5s6.4 1.9 8 5.5"/></svg>';
function avatarHtml() { return S.perfil.foto ? '<img src="' + S.perfil.foto + '" alt="">' : (iniciais(S.settings.analista) || ICON_USER); }
function renderPerfilChip() {
  $$('[data-avatar]').forEach(a => { a.innerHTML = avatarHtml(); });
  $('#pf-nome').textContent = S.settings.analista || 'Seu perfil';
  $('#pf-cargo').textContent = S.perfil.cargo || (S.settings.analista ? S.settings.escritorio : 'Clique para personalizar');
}
function temaAtual() { try { return localStorage.getItem(TEMA_KEY) || 'auto'; } catch (e) { return 'auto'; } }
function aplicarTema(t) {
  try { if (t === 'auto') localStorage.removeItem(TEMA_KEY); else localStorage.setItem(TEMA_KEY, t); } catch (e) { /* */ }
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
}
function perfilHtml() {
  const st = S.settings, P = S.perfil, tema = temaAtual();
  const f = (id, label, val, type, ph, wide) => '<div class="field' + (wide ? ' wide' : '') + '"><label for="' + id + '">' + label + '</label><input type="' + (type || 'text') + '" id="' + id + '" value="' + esc(val || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' autocomplete="off"></div>';
  return '<div class="dr-h"><div><div class="small muted">Perfil</div><h3>Quem usa o Revisor</h3></div><button class="x" data-pf="close" type="button" aria-label="Fechar">' + ICON.x + '</button></div>' +
    '<div class="dr-b">' +
    '<div class="pf-head"><span class="avatar xl" data-avatar>' + avatarHtml() + '</span><div class="who"><b id="pf-h-nome">' + esc(st.analista || 'Sem nome') + '</b><span id="pf-h-cargo">' + esc([P.cargo, P.oab ? 'OAB ' + P.oab : ''].filter(Boolean).join(' · ') || 'Cargo e OAB aparecem aqui') + '</span>' +
    '<div class="toolbar" style="margin-top:10px"><button class="btn" data-pf="foto" type="button">' + (P.foto ? 'Trocar foto' : 'Colocar foto') + '</button>' + (P.foto ? '<button class="btn" data-pf="foto-del" type="button">Remover</button>' : '') + '</div></div></div>' +
    '<section class="pf-sec"><h4>Dados pessoais</h4><div class="pf-grid">' +
    f('pf-analista', 'Nome (assina o relatório)', st.analista, 'text', 'Nome e sobrenome', true) +
    f('pf-cargo-in', 'Cargo', P.cargo, 'text', 'Ex.: Advogada tributarista') + f('pf-oab', 'OAB', P.oab, 'text', 'Ex.: RS 123.456') +
    f('pf-email', 'E-mail', P.email, 'email', 'nome@milkadvocacia.com.br') + f('pf-tel', 'Telefone', P.tel, 'tel', '(51) 99999-9999') +
    '</div></section>' +
    '<section class="pf-sec"><h4>Escritório</h4><div class="pf-grid">' +
    f('pf-esc', 'Escritório', st.escritorio) + f('pf-cid', 'Cidade (data da carta)', st.cidade) +
    '<div class="field wide"><label>Logotipo do escritório</label><div class="logo-row"><div class="logo-prev">' + (S.logo ? '<img src="' + S.logo.data + '" alt="Logotipo">' : 'sem logotipo') + '</div>' +
    '<button class="btn" data-pf="logo" type="button">Trocar</button>' + (S.logo && !S.logo.padrao ? '<button class="btn" data-pf="logo-padrao" type="button">Usar o da Milk</button>' : '') + '<input type="file" id="logo-file" accept="image/*,.jpg,.jpeg,.png,.webp,.jfif" hidden></div>' +
    '<span class="xs muted">Aparece no topo do sistema e no cabeçalho da minuta padrão.</span></div>' +
    '</div></section>' +
    '<section class="pf-sec"><h4>Aparência</h4><div class="theme-seg" role="group" aria-label="Tema">' + [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([k, l]) => '<button type="button" data-tema="' + k + '" aria-pressed="' + (tema === k) + '">' + l + '</button>').join('') + '</div></section>' +
    '<section class="pf-sec"><h4>Dados e privacidade</h4>' +
    '<div class="pf-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span>As planilhas são lidas e processadas neste computador. Nenhum dado fiscal é enviado para servidores. O perfil, o modelo do Word, os clientes e a base da equipe ficam salvos neste navegador.</span></div>' +
    '<details class="pf-tools"><summary>Demonstração e planilhas de exemplo</summary><div class="toolbar"><button class="btn" data-pf="demo" type="button">Abrir demonstração (037 + 047 fictícias)</button><button class="btn" data-pf="raw" data-tipo="ENT" type="button">' + ICON.dl + '<span>037 de exemplo</span></button><button class="btn" data-pf="raw" data-tipo="SAI" type="button">' + ICON.dl + '<span>047 de exemplo</span></button></div></details>' +
    '</section>' +
    '<div class="toolbar" style="justify-content:center">' + (S.conta && S.conta.papel === 'admin' ? '<a class="btn" href="/admin">Usuários</a>' : '') + '<button class="btn" data-pf="sair" type="button">Sair</button></div>' +
    '<p class="pf-foot">Revisor Fiscal 1.0 · desenvolvido por Nascimento para a Milk Advocacia</p></div>';
}
function openPerfil() {
  const el = $('#perfil'); if (S.ui.drawer) closeDrawer();
  el.innerHTML = perfilHtml(); el.classList.add('on'); el.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on'); S.ui.perfil = true;
  drawerFx(el);
  setTimeout(() => { const i = $('#pf-analista'); if (i && !S.settings.analista) i.focus(); else el.querySelector('.x').focus(); }, 60);
}
function closePerfil() { const el = $('#perfil'); if (!el.classList.contains('on')) return; el.classList.remove('on', 'fx'); el.setAttribute('aria-hidden', 'true'); if (!S.ui.drawer) $('#scrim').classList.remove('on'); S.ui.perfil = false; }
function bindPerfil() {
  const el = $('#perfil');
  el.addEventListener('input', e => {
    const t = e.target, v = t.value;
    if (t.id === 'pf-analista') { S.settings.analista = v; saveSettings(); servidorPerfil(); $('#pf-h-nome').textContent = v || 'Sem nome'; }
    else if (t.id === 'pf-cargo-in') { S.perfil.cargo = v; savePerfil(); }
    else if (t.id === 'pf-oab') { S.perfil.oab = v; savePerfil(); }
    else if (t.id === 'pf-email') { S.perfil.email = v; savePerfil(); }
    else if (t.id === 'pf-tel') { S.perfil.tel = v; savePerfil(); }
    else if (t.id === 'pf-esc') { S.settings.escritorio = v; saveSettings(); servidorPerfil(); }
    else if (t.id === 'pf-cid') { S.settings.cidade = v; saveSettings(); servidorPerfil(); }
    else return;
    const c = $('#pf-h-cargo'); if (c) c.textContent = [S.perfil.cargo, S.perfil.oab ? 'OAB ' + S.perfil.oab : ''].filter(Boolean).join(' · ') || 'Cargo e OAB aparecem aqui';
    renderPerfilChip();
  });
  el.addEventListener('change', () => { if (S.ui.view === 'exportar') refreshExportar(); });
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-pf], [data-tema]'); if (!b) return;
    if (b.dataset.tema) { aplicarTema(b.dataset.tema); el.querySelectorAll('[data-tema]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
    const a = b.dataset.pf;
    if (a === 'close') closePerfil();
    else if (a === 'foto') { const inp = $('#foto-file'); inp.onchange = async ev => { const fl = ev.target.files[0]; ev.target.value = ''; if (!fl) return; try { S.perfil.foto = (await loadFoto(fl)).data; savePerfil(); renderPerfilChip(); el.innerHTML = perfilHtml(); toast('Foto aplicada.'); } catch (err) { toast(err.message, 8000); } }; inp.click(); }
    else if (a === 'foto-del') { S.perfil.foto = null; savePerfil(); renderPerfilChip(); el.innerHTML = perfilHtml(); }
    else if (a === 'logo') { const inp = $('#logo-file'); inp.onchange = async ev => { const fl = ev.target.files[0]; ev.target.value = ''; if (!fl) return; try { S.logo = await loadLogo(fl); store.set(LOGO_KEY, S.logo); applyLogo(); el.innerHTML = perfilHtml(); toast('Logotipo aplicado.'); } catch (err) { toast(err.message, 8000); } }; inp.click(); }
    else if (a === 'logo-padrao') { S.logo = LOGO_PADRAO; try { localStorage.removeItem(LOGO_KEY); } catch (err) { /* */ } applyLogo(); el.innerHTML = perfilHtml(); toast('Logotipo da Milk restaurado.'); }
    else if (a === 'demo') { closePerfil(); process({ demo: 'AMBAS' }); }
    else if (a === 'sair') { closePerfil(); if (window.RFLogin) window.RFLogin.sair(); }
    else if (a === 'raw') { const tp = b.dataset.tipo || 'ENT', lb = b.lastChild, old = lb.textContent; b.disabled = true; lb.textContent = 'Gerando…'; try { const blob = await buildRawExport(tp); await saveFile(MODES[tp].titulo + ' (exemplo).xlsx', blob); } catch (err) { toast('Erro ao gerar: ' + err.message); } b.disabled = false; lb.textContent = old; }
  });
}

/* Lê o logotipo sem depender de blob: URLs (alguns visualizadores bloqueiam), identifica o formato real pelos
   primeiros bytes (arquivos salvos do Instagram/WhatsApp costumam ser WebP ou HEIC com extensão .jpg) e
   normaliza para PNG com no máximo 240 px de altura. */
function sniffImage(b) {
  const s = (i, n) => String.fromCharCode.apply(null, Array.from(b.slice(i, i + n)));
  if (b[0] === 0x89 && s(1, 3) === 'PNG') return 'png';
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'webp';
  if (s(0, 3) === 'GIF') return 'gif';
  if (s(0, 2) === 'BM') return 'bmp';
  if (s(4, 4) === 'ftyp') { const br = s(8, 4); return /avi[fs]/.test(br) ? 'avif' : 'heic'; }
  if (/^\s*<(\?xml|svg)/i.test(s(0, 32))) return 'svg';
  if (/^\s*<(!doctype|html)/i.test(s(0, 32))) return 'html';
  return 'desconhecido';
}
function readAsDataURL(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error || new Error('leitura')); fr.readAsDataURL(file); });
}
async function decodeImage(file) {
  if (file.size > 15 * 1024 * 1024) throw new Error('Imagem muito grande (máx. 15 MB).');
  const kind = sniffImage(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
  if (kind === 'html') throw new Error('Esse arquivo é uma página da internet salva com nome de imagem, não uma imagem. Baixe o logotipo de novo ou salve-o como PNG.');
  if (kind === 'desconhecido') throw new Error('Formato de imagem não reconhecido. Abra o arquivo no Paint e use "Salvar como" PNG ou JPG.');
  let src = null, w = 0, h = 0;
  if (kind !== 'svg' && typeof createImageBitmap === 'function') {
    try { src = await createImageBitmap(file); w = src.width; h = src.height; } catch (e) { src = null; }
  }
  if (!src) {
    let url = await readAsDataURL(file);
    if (kind !== 'desconhecido') url = url.replace(/^data:[^;,]*/, 'data:image/' + (kind === 'svg' ? 'svg+xml' : kind));
    try {
      src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
      w = src.naturalWidth || 300; h = src.naturalHeight || 120;
    } catch (e) {
      if (kind === 'heic' || kind === 'avif') throw new Error('A imagem está no formato ' + kind.toUpperCase() + ' (comum em fotos do iPhone), que este navegador não abre. Abra no app Fotos ou Paint e salve como PNG ou JPG.');
      throw new Error('O navegador não conseguiu abrir esta imagem (' + kind.toUpperCase() + '). Abra no Paint e salve como PNG.');
    }
  }
  return { src, w, h };
}
async function loadLogo(file) {
  const { src, w, h } = await decodeImage(file);
  const sc = Math.min(1, 240 / h, 960 / w), cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  c.getContext('2d').drawImage(src, 0, 0, cw, ch);
  if (src.close) src.close();
  return { data: c.toDataURL('image/png'), w: cw, h: ch };
}
/* foto do perfil: recorte quadrado no centro, 256 px */
async function loadFoto(file) {
  const { src, w, h } = await decodeImage(file);
  const s0 = Math.min(w, h), sz = Math.min(256, s0), c = document.createElement('canvas'); c.width = c.height = sz;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, sz, sz);
  g.drawImage(src, (w - s0) / 2, (h - s0) / 2, s0, s0, 0, 0, sz, sz);
  if (src.close) src.close();
  return { data: c.toDataURL('image/jpeg', .9) };
}
async function boot() {
  applyLogo();
  bindEvents();
  renderPerfilChip();
  renderChrome();
  S.ui.view = 'importar'; render();
  carregarContaServidor();
  try { S.modelo = await ARQ.get('modelo'); } catch (e) { S.modelo = null; }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
