// MAXXI completo pela tela, como a analista faria, e conferência do quadro geral com o diagnóstico
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const X = '/tmp/claude-0/xi/', OUT = '/tmp/claude-0/e2e_full'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const dls = []; p.on('download', async d => { const f = path.join(OUT, 'dl' + dls.length + '_' + d.suggestedFilename()); dls.push(f); await d.saveAs(f); });
  const html = path.join(OUT, 'p.html'); fs.writeFileSync(html, '<!doctype html><html><head><meta charset="utf8"></head><body>' + fs.readFileSync('/home/claude/milk/repo/app/dist/Revisor Fiscal - offline.html', 'utf8') + '</body></html>');
  await p.goto('file://' + html); await p.waitForSelector('#lg-email', { state: 'visible' }); await p.waitForTimeout(1300);
  await p.fill('#lg-email', 'milk@milk.com.br'); await p.fill('#lg-senha', 'milk'); await p.press('#lg-senha', 'Enter'); await p.waitForFunction(() => document.getElementById('login').hidden, null, { timeout: 10000 });
  const t0 = Date.now(), sped = fs.readdirSync(X + 'sped').map(f => X + 'sped/' + f);
  await p.setInputFiles('#file', [X + 'e037.xlsx', X + 's047.xlsx', X + 's070.xlsx', X + 'e069.xlsx', X + 'ecf.xlsx', X + 'ecd.xlsx', X + 'y570.xlsx', X + 'dirf.xlsx'].concat(sped, fs.readdirSync(X + 'pd').map(f => X + 'pd/' + f)));
  await p.waitForFunction(() => !busy && S.extras.icmsS && S.extras.icmsE && S.extras.ie0150 && S.extras.ecdA && S.extras.ret && S.extras.perdcomp && S.analyses.ENT && S.analyses.SAI, null, { timeout: 600000, polling: 1000 });
  await p.waitForFunction(() => S.ui.view === 'painel', null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(1500);
  ok(true, 'tudo importado de uma vez em ' + Math.round((Date.now() - t0) / 1000) + ' s');
  await p.evaluate(() => go('outras')); await p.waitForTimeout(800);
  const setv = async (sel, v) => p.evaluate(([sel, v]) => { const i = document.querySelector(sel); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
  // ICMS: prazo 01/2021, períodos da SEFAZ e crédito presumido, como no diagnóstico
  await setv('#f-icorte', '01/2021'); await p.waitForTimeout(300);
  const rs = JSON.parse(fs.readFileSync('/tmp/claude-0/rsrs.json')), per = {}; for (const [ch, v, ct, cn] of rs) if (cn && ct) per[String(cn).padStart(14, '0')] = String(ct);
  await p.evaluate(per => { for (const x of S.extras.icmsS.tom.values()) S.extras.icmsS.periodos[x.part] = per[x.part] || (x.sel ? 'NÃO' : ''); analisarICMS(S.extras.icmsS); }, per);
  await setv('#f-ipres', '01/2022 a 09/2025'); await p.waitForTimeout(300);
  await setv('#f-pcorte', '10/2020'); await p.waitForTimeout(300);
  // ECD: as 9 contas dela e a 411 nos seguros
  await p.evaluate(() => { const e = S.extras.ecdA, dela = new Set(['714', '524', '361', '363', '1063', '358', '713', '712', '1061']); for (const c of e.contas.values()) c.ov = dela.has(c.conta) ? 'INCLUIR' : (c.sug !== 'NÃO INCLUIR' ? 'NÃO INCLUIR' : null); e.atrib['411'] = '358'; analisarECD(e); refreshOutras(); });
  await p.waitForTimeout(500);
  const G = await p.evaluate(() => quadroGeral());
  console.log('QUADRO GERAL (Revisor)'); for (const x of G.rec.concat([{ bloco: '', desc: 'TOTAL A RECUPERAR', per: '', v: G.totRec }], G.recolher, [{ bloco: '', desc: 'TOTAL A RECOLHER', per: '', v: G.totRecolher }])) console.log('  ', (x.bloco || '').padEnd(10), x.desc.slice(0, 66).padEnd(66), (x.per || '').padEnd(18), x.v.toFixed(2).padStart(13));
  const v = k => (G.rec.concat(G.recolher).filter(x => x.k === k).reduce((a, x) => a + x.v, 0)).toFixed(2);
  ok(v('ecd') === '55697.08', 'ECD ' + v('ecd') + ' (diagnóstico 55.697,08)');
  ok(v('cte') === '907342.82', 'ICMS CT-e ' + v('cte') + ' (diagnóstico 908.037,34; diferença conhecida de R$ 694,52)');
  ok(v('icms') === '40838.06', 'exclusão do ICMS ' + v('icms') + ' pelo regime (diagnóstico 52.081,43 a 9,25%)');
  ok(v('sai') === '13998.37', 'venda de ativo ' + v('sai') + ' (diagnóstico 2.492,86 + 11.505,51)');
  ok(v('anul') === '28672.34', 'anulação ' + v('anul')); ok(v('dev') === '979.83', 'devoluções ' + v('dev'));
  ok(v('estorno') === '46.06', 'estorno presumido ' + v('estorno')); ok(v('servsem') === '2478.16', 'serviços sem PIS/COFINS ' + v('servsem') + ' (diagnóstico lançou a base, 67.894,85)');
  ok((+v('presum') + +v('reflexo')).toFixed(2) === '170179.31', 'reflexos da recuperação do ICMS ' + (+v('presum') + +v('reflexo')).toFixed(2) + ' (diagnóstico ~180.000)');
  ok(!G.rec.some(x => x.k === 'ent'), '037 não entra separada (como a analista: já está dentro da ECD)');
  const pr = await p.evaluate(() => { const pd = analisarPerdcomp(), rt = analisarRetencoes(); return { n: pd.L.length, nums: pd.L.map(x => x.num + ' ' + x.transm + ' ' + x.tributo + ' ' + x.pa + ' ' + x.valor), conf: pd.conflitos.length, rt: rt.faltam.map(a => a.ano + ':' + a.imp), tot: rt.tot }; });
  console.log('     PER/DCOMP:', JSON.stringify(pr.nums), '· conflitos', pr.conf, '· retenções fora da ECF', JSON.stringify(pr.rt), pr.tot);
  ok(pr.n === 3, 'PER/DCOMP: 3 PDFs lidos (o PDF da lista do e-CAC e o da DIRF ficam de fora)');
  ok(pr.tot === 392.64, 'retenções da DIRF fora da ECF: ' + pr.tot + ' (2020 e 2022)');
  await p.screenshot({ path: OUT + '/outras.png', fullPage: true });
  // Baixar tudo
  await p.evaluate(() => { S.empresa.nome = 'EMPRESA TESTE TRANSPORTES'; go('exportar'); }); await p.waitForTimeout(700);
  await p.click('#b-tudo'); const t = Date.now(); while (Date.now() - t < 240000) { await p.waitForTimeout(1000); if (await p.evaluate(() => !busy && !document.querySelector('#b-tudo').disabled) && dls.length >= 5) break; } await p.waitForTimeout(3000);
  console.log('arquivos:', dls.map(f => path.basename(f) + ' ' + Math.round(fs.statSync(f).size / 1024) + ' KB').join(' | '));
  ok(dls.length === 6, 'Baixar tudo (037, 047, ICMS, outros pontos, ECD, Word): ' + dls.length + ' arquivos');
  const wf = dls.find(f => { try { return require('child_process').execSync('unzip -l "' + f + '"').toString().includes('word/document.xml'); } catch (e) { return false; } });
  if (wf) { const x = require('child_process').execSync('unzip -p "' + wf + '" word/document.xml').toString(); for (const t of ['PER/DCOMP TRANSMITIDOS', 'RETENÇÕES NA FONTE', 'ICMS – PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE', 'CONTAS IDENTIFICADAS NA ECD', 'ANULAÇÃO DE PRESTAÇÃO', 'DEVOLUÇÕES DE COMPRA', 'CRÉDITO PRESUMIDO DE ICMS', 'RECEITAS DE SERVIÇO SEM TRIBUTAÇÃO', 'VENDA DE ATIVO']) ok(x.includes(t), 'Word: seção ' + t); ok(!x.includes('EXCLUSÃO DE MERCADORIAS DA ST'), 'Word: sem as seções de ICMS-ST (empresa de serviço)'); }
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
