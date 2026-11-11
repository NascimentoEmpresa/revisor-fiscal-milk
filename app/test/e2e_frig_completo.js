// Frigorífico completo pela tela (empresa sem ICMS a analisar): 037 + 047 + 513 + ECD + ECF, decisões da analista → RESUMO dela
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const X = '/tmp/claude-0/xx/', OUT = '/tmp/claude-0/e2e_frig'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const dls = []; p.on('download', async d => { const f = path.join(OUT, 'dl' + dls.length + '.bin'); dls.push(f); await d.saveAs(f); });
  const html = path.join(OUT, 'p.html'); fs.writeFileSync(html, '<!doctype html><html><head><meta charset="utf8"></head><body>' + fs.readFileSync('/home/claude/milk/repo/app/dist/Revisor Fiscal - offline.html', 'utf8') + '</body></html>');
  await p.goto('file://' + html); await p.waitForSelector('#lg-email', { state: 'visible' }); await p.waitForTimeout(1300);
  await p.fill('#lg-email', 'milk@milk.com.br'); await p.fill('#lg-senha', 'milk'); await p.press('#lg-senha', 'Enter'); await p.waitForFunction(() => document.getElementById('login').hidden, null, { timeout: 10000 });
  const t0 = Date.now();
  await p.setInputFiles('#file', ['e037.xlsx', 'f047.xlsx', 'j513.xlsx', 'ecf.xlsx', 'fecd.xlsx'].map(n => X + n));
  await p.waitForFunction(() => !busy && S.extras.j513 && S.extras.ecf && S.extras.ecdA && S.analyses.ENT && S.analyses.SAI, null, { timeout: 600000, polling: 1000 });
  await p.waitForFunction(() => S.ui.view === 'painel', null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(1500);
  ok(true, '037 + 047 + 513 + ECD + ECF em ' + Math.round((Date.now() - t0) / 1000) + ' s');
  // 037: as decisões da analista (aba NOTAS SEM CREDITO), por grupo NCM + CFOP, como ela faria na tela
  const lab = JSON.parse(fs.readFileSync('/tmp/claude-0/modelo/lab037.json', 'utf8'));
  const r37 = await p.evaluate(lab => {
    if (S.tipo !== 'ENT') ativarAnalise('ENT');
    const M = S.map, n = v => v == null ? '' : typeof v === 'number' ? String(+v.toPrecision(12)) : String(v);
    const keyOf = r => [n(r.v[M.periodo]), n(r.v[M.registro]).slice(0, 4), n(r.v[M.chave]) || n(r.v[M.numDoc]), n(r.v[M.numItem]), n(r.v[M.codItem]), (r.vlrItem || 0).toFixed(2)].join('|');
    const pool = new Map(); for (const l of lab) { const a = pool.get(l[6]) || []; a.push(l); pool.set(l[6], a); }
    const dec = new Map(); for (const r of S.alvo) { const a = pool.get(keyOf(r)), l = a && a.length ? a.shift() : null; if (!l || !r.g) continue; const d = /^PERMITE/i.test(l[3]); const x = dec.get(r.g) || { s: 0, p: 0 }; d ? x.p++ : x.s++; dec.set(r.g, x); }
    const antes = avaliarPendente();
    for (const [g, x] of dec) g.dec = x.p >= x.s ? CLS.COM : CLS.SEM;
    recompute(); guardarAnalise();
    const pot0 = (S.pot.pis + S.pot.cof).toFixed(2); S.settings.excluirIcms = false; S.settings.descontoItem = false; recompute(); guardarAnalise(); const pot1 = (S.pot.pis + S.pot.cof).toFixed(2);
    return { antes, depois: avaliarPendente(), pot: pot1, pot0, grupos: dec.size };
  }, lab);
  console.log('     037 com as opções padrão (exclui ICMS desde 05/2023 e desconta o desconto):', r37.pot0, '· como ela fez (Vlr Item cheio):', r37.pot);
  console.log('     037 antes de decidir: ' + r37.antes.grupos + ' grupos em AVALIAR (até R$ ' + r37.antes.v + ') · decidindo ' + r37.grupos + ' grupos como ela → em AVALIAR ' + r37.depois.grupos);
  ok(r37.pot === '186590.75', '037 com as decisões dela: R$ ' + r37.pot + ' (RESUMO 186.590,75; diferença conhecida: 29 fretes sem NCM no mesmo grupo)');
  // 513: as 5 notas que ela creditou
  await p.evaluate(() => { const j = S.extras.j513; for (const nt of j.notas) if (nt.cand && nt.tipo === 'E' && nt.sug.cls === 'AVALIAR' && /GASOLINA|CABO|UNIFORME/.test(nt.obs)) nt.ov = 'COM CREDITO'; recalcJ513(j); });
  // ECD: as contas dela e os dois valores filtrados
  await p.evaluate(() => { const e = S.extras.ecdA, dela = ['DESPESAS COM HIGIENE', 'DESPESAS DIVERSAS', 'UNIFORMES', 'DESPESAS DE PEDAGIOS', 'MANUT.DE MOVEIS E UTENSILIOS', 'MANUTENCAO DE INSTALACOES', 'PNEUS E CAMARAS', 'MATERIAL DE EMBALAGENS', 'BENS NATUREZA PERMANENTE', 'MANUT.DE MAQUINAS E EQUIP.', 'DESPESAS C/VEICULOS', 'FRETES E CARRETOS', 'MANUTENCAO DE PREDIO E BENFEIT', 'PRESTACAO  DE SERV. TERC. PJ', 'DEPRECIACOES', 'COMBUSTIVEIS E LUBRIFICANTES', 'MATERIAL DE CONSUMO', 'ENERGIA ELETRICA'];
    for (const c of e.contas.values()) { c.ov = dela.includes(c.desc) ? 'INCLUIR' : 'NÃO INCLUIR'; if (c.desc === 'PRESTACAO  DE SERV. TERC. PJ') c.ajuste = 160939.84; if (c.desc === 'MATERIAL DE CONSUMO') c.ajuste = 293635.70; } analisarECD(e); });
  // 047: ela descartou os R$ 69.608,25 ("NÃO UTILIZAR - PRODUTO ERRADO (MONDONGO)")
  const z = await p.evaluate(() => { ativarAnalise('SAI'); const antes = (S.pot.pis + S.pot.cof).toFixed(2); for (const g of S.groups) if ((g.dec || g.sug.cls) === CLS.COM) g.dec = CLS.SEM; recompute(); guardarAnalise(); return antes + ' → ' + (S.pot.pis + S.pot.cof).toFixed(2); });
  console.log('     047 RECUPERAR (mondongo) descartado como ela:', z);
  await p.evaluate(() => go('outras')); await p.waitForTimeout(800);
  const Q = await p.evaluate(() => { const Q = quadroResumo(); return Object.fromEntries(Q.L.map(l => [l.k, l.v ? (l.v.pis + l.v.cof).toFixed(2) : null]).concat([['tot', (Q.tot.pis + Q.tot.cof).toFixed(2)]])); });
  console.log('     quadro do Revisor:', JSON.stringify(Q));
  ok(+Q.tot === 310106.84 || Q.tot === '310106.84', 'TOTAL do quadro: ' + Q.tot + ' (RESUMO 310.106,84)');
  ok(Q.j513 === '824.21', '513: ' + Q.j513); ok(Q.ecd === '116393.64', 'ECD: ' + Q.ecd + ' (RESUMO 116.393,64)'); ok(Q.icms === '6298.24', 'exclusão do ICMS (047): ' + Q.icms + ' (RESUMO 6.298,24)');
  console.log('     RESUMO da analista: 186.590,75 + 824,21 + 116.393,64 + 6.298,24 = 310.106,84');
  const pend = await p.evaluate(() => avaliarPendente(S.tipo === 'SAI' ? S : S.analyses.SAI.snap));
  console.log('     047 em AVALIAR:', JSON.stringify(pend));
  await p.screenshot({ path: OUT + '/outras.png', fullPage: true });
  await p.evaluate(() => { definirNome('FRIGORIFICO TESTE LTDA'); go('exportar'); }); await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '/exportar.png', fullPage: true });
  await p.click('#b-tudo'); const t = Date.now(); while (Date.now() - t < 300000) { await p.waitForTimeout(1000); if (dls.length >= 5 && await p.evaluate(() => !busy && !document.querySelector('#b-tudo').disabled)) break; } await p.waitForTimeout(3000);
  ok(dls.length === 5, 'Baixar tudo: ' + dls.length + ' arquivos (037, 047, 513, ECD, Word)');
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
