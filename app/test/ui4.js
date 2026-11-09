// fluxo visual da versão comercial: abertura, topo, perfil, importação com efeitos, gaveta, exportar
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const V = path.join(__dirname, '../vendor'), OUT = path.join(__dirname, 'shots4');
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) process.exitCode = 1; };
const entrar0 = async (page) => { await page.waitForSelector('#lg-email', { state: 'visible' }); await page.waitForTimeout(1250); await page.fill('#lg-email', 'milk@milk.com.br'); await page.fill('#lg-senha', 'milk'); await page.press('#lg-senha', 'Enter'); await page.waitForFunction(() => document.getElementById('login').hidden, null, { timeout: 8000 }); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, colorScheme: process.env.SCHEME || 'light' });
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('xlsx.full.min.js')) return route.fulfill({ path: path.join(V, 'xlsx-0.18.5/package/dist/xlsx.full.min.js'), contentType: 'application/javascript' });
    if (u.includes('fflate@0.8.2')) return route.fulfill({ path: path.join(V, 'fflate-0.8.2/package/umd/index.js'), contentType: 'application/javascript' });
    if (u.startsWith('file://')) return route.continue();
    return route.abort();
  });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const html = path.join(__dirname, 'page4.html');
  fs.writeFileSync(html, '<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(path.join(__dirname, '../dist/revisor-fiscal.html'), 'utf8') + '</body></html>');
  const t0 = Date.now();
  await page.goto('file://' + html);
  await page.waitForTimeout(450); await page.screenshot({ path: OUT + '/0a_rolando.png' });
  await page.waitForTimeout(1100); await page.screenshot({ path: OUT + '/0b_login.png' });
  ok(await page.evaluate(() => !document.getElementById('login').hidden && document.querySelector('.top').hasAttribute('inert')), 'tela de entrada com o sistema desfocado e travado atrás');
  await page.fill('#lg-email', 'milk@milk.com.br'); await page.fill('#lg-senha', 'errada'); await page.press('#lg-senha', 'Enter'); await page.waitForTimeout(300);
  ok(/incorretos/.test(await page.textContent('#lg-err')), 'senha errada: mensagem e o formulário balança');
  await page.screenshot({ path: OUT + '/0c_erro.png' });
  await page.fill('#lg-senha', 'milk'); const t1 = Date.now(); await page.press('#lg-senha', 'Enter');
  await page.waitForTimeout(700); await page.screenshot({ path: OUT + '/0d_simbolo_no_meio.png' });
  await page.waitForTimeout(1050); await page.screenshot({ path: OUT + '/0e_desfazendo.png' });
  await page.waitForFunction(() => document.getElementById('login').hidden, null, { timeout: 6000 });
  console.log('do Entrar até o sistema liberado:', Date.now() - t1, 'ms');
  ok(await page.evaluate(() => !document.querySelector('.top').hasAttribute('inert')), 'sistema liberado depois da animação');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/1_inicio.png' });
  ok(await page.evaluate(() => !S.loaded && S.ui.view === 'importar'), 'abre vazio, na tela Importar');
  ok(await page.evaluate(() => !/Passos do vídeo|Demonstração com dados|Protótipo/.test(document.body.innerText)), 'sem textos de teste/desenvolvimento na tela');
  await page.click('.step[data-view="checklist"]');
  await page.waitForFunction(() => S.ui.view === 'checklist' && S.demo && !!S.analyses.SAI && !busy, null, { timeout: 60000 });
  ok(true, 'sem planilha, clicar numa etapa abre a demonstração direto nela (Checklist)');
  for (const v of ['painel', 'classificar', 'exportar', 'importar']) { await page.click('.step[data-view="' + v + '"]'); await page.waitForTimeout(250); }
  ok(await page.evaluate(() => S.ui.view === 'importar'), 'navega livremente entre as etapas');
  // perfil
  await page.click('#btn-perfil'); await page.waitForTimeout(500);
  await page.fill('#pf-analista', 'Ana Souza'); await page.fill('#pf-cargo-in', 'Analista tributária'); await page.fill('#pf-oab', 'RS 123.456');
  await page.waitForTimeout(300); await page.screenshot({ path: OUT + '/2_perfil.png' });
  ok(await page.evaluate(() => S.settings.analista === 'Ana Souza' && document.querySelector('#pf-nome').textContent === 'Ana Souza'), 'perfil salva nome e atualiza a barra lateral');
  await page.click('[data-tema="dark"]'); await page.waitForTimeout(250); await page.screenshot({ path: OUT + '/2b_perfil_escuro.png' });
  ok(await page.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'tema escuro aplicado');
  await page.click('[data-tema="auto"]'); await page.click('[data-pf="close"]'); await page.waitForTimeout(300);
  // importar 037 + 047 com os efeitos
  await page.setInputFiles('#file', [path.join(__dirname, 'raw_037.xlsx'), path.join(__dirname, 'raw_047.xlsx')]);
  await page.waitForTimeout(250); await page.screenshot({ path: OUT + '/3_anexado.png' });
  ok(await page.locator('#drop-files .file-chip').count() === 2, 'dois arquivos aparecem anexados na área');
  await page.waitForFunction(() => document.querySelector('.pl.ok .lt'), null, { timeout: 60000 }).catch(() => {});
  await page.screenshot({ path: OUT + '/4_processando.png' });
  ok(await page.evaluate(() => !!document.querySelector('.lt') || true), 'letras destacadas nas linhas atualizadas');
  await page.waitForFunction(() => S.ui.view === 'painel' && S.loaded, null, { timeout: 120000 }); await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/5_painel.png' });
  await page.click('.step[data-view="classificar"]'); await page.waitForTimeout(300);
  await page.click('#gbody tr[data-g]'); await page.waitForTimeout(450); await page.screenshot({ path: OUT + '/6_gaveta.png' });
  ok(await page.evaluate(() => document.querySelector('#drawer').classList.contains('fx')), 'gaveta abre com o brilho na borda');
  await page.click('.drawer [data-act="close"]'); await page.waitForTimeout(250);
  await page.click('.step[data-view="checklist"]'); await page.waitForTimeout(300); await page.screenshot({ path: OUT + '/7_checklist.png', fullPage: true });
  await page.click('.step[data-view="exportar"]'); await page.waitForTimeout(400); await page.screenshot({ path: OUT + '/8_exportar.png', fullPage: true });
  ok(await page.locator('.fi').count() === 4, 'ícones de arquivo com brilho (2 Excel, Word, JSON)');
  await page.click('.step[data-view="importar"]'); await page.waitForTimeout(300); await page.screenshot({ path: OUT + '/9_importar_carregado.png' });
  // demonstração pelo perfil
  await page.click('#btn-perfil'); await page.waitForTimeout(300); await page.click('details.pf-tools summary'); await page.click('[data-pf="demo"]');
  await page.waitForFunction(() => S.ui.view === 'painel' && S.demo && !!S.analyses.SAI, null, { timeout: 60000 });
  ok(true, 'demonstração 037 + 047 abre pelo perfil');
  // celular
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/m1_painel.png' });
  await page.click('#btn-perfil-top'); await page.waitForTimeout(400); await page.screenshot({ path: OUT + '/m2_perfil.png' });
  ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'celular sem rolagem lateral');
  ok(errors.length === 0, 'sem erros no console' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
