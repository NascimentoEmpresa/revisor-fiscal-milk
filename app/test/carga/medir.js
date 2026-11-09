// teste de carga: importa arquivos grandes no sistema (Chromium real), mede tempo e memória, gera o Excel
// uso: node carga/medir.js arq1.xlsx [arq2.xlsx ...]
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const V = path.join(__dirname, '../../vendor'), files = process.argv.slice(2).map(f => path.resolve(f));
(async () => {
  const browser = await chromium.launch({ args: ['--js-flags=--max-old-space-size=4096'] });
  const ctx = await browser.newContext({ acceptDownloads: true });
  await ctx.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('crash', () => errs.push('ABA TRAVOU (crash)'));
  const html = path.join(__dirname, 'pagina.html');
  fs.writeFileSync(html, '<!doctype html><html><head><meta charset="utf8"></head><body>' + fs.readFileSync(path.join(__dirname, '../../dist/Revisor Fiscal - offline.html'), 'utf8') + '</body></html>');
  await page.goto('file://' + html);
  await page.waitForSelector('#lg-email', { state: 'visible' }); await page.waitForTimeout(1300);
  await page.fill('#lg-email', 'milk@milk.com.br'); await page.fill('#lg-senha', 'milk'); await page.press('#lg-senha', 'Enter');
  await page.waitForFunction(() => document.getElementById('login').hidden, null, { timeout: 10000 });
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  let pico = 0, vivo = true;
  const amostra = async () => { while (vivo) { try { const m = (await cdp.send('Performance.getMetrics')).metrics.find(x => x.name === 'JSHeapUsedSize'); if (m && m.value > pico) pico = m.value; } catch (e) {} await new Promise(r => setTimeout(r, 300)); } };
  amostra();
  const mb = b => (b / 1048576).toFixed(0) + ' MB';
  const t0 = Date.now();
  await page.setInputFiles('#file', files);
  try { await page.waitForFunction(() => S.loaded && !busy && S.ui.view !== 'importar', null, { timeout: 1200000, polling: 1000 }); }
  catch (e) { errs.push('não terminou de processar: ' + e.message.split('\n')[0]); }
  const tProc = Date.now() - t0;
  const info = await page.evaluate(() => ({ n: S.recs.length, tipo: S.tipo, err: (document.querySelector('#imp-err') || {}).textContent || '' })).catch(e => ({ err: e.message }));
  console.log('arquivos:', files.map(f => path.basename(f) + ' (' + mb(fs.statSync(f).size) + ')').join(' + '));
  console.log('processar:', (tProc / 1000).toFixed(1), 's · linhas:', info.n, '· memória pico:', mb(pico), info.err ? '· erro: ' + info.err : '');
  pico = 0; const t1 = Date.now();
  const dl = page.waitForEvent('download', { timeout: 1200000 }).catch(e => null);
  const r = await page.evaluate(async () => { try { const x = await gerarXlsx(S.tipo); const a = document.createElement('a'); a.href = URL.createObjectURL(x.blob); a.download = 'saida.xlsx'; document.body.appendChild(a); a.click(); return { size: x.blob.size }; } catch (e) { return { err: e.message }; } }).catch(e => ({ err: e.message }));
  const d = r.err ? null : await dl; const out = path.join(__dirname, 'saida_' + Date.now() + '.xlsx');
  if (d) await d.saveAs(out);
  console.log('gerar Excel:', ((Date.now() - t1) / 1000).toFixed(1), 's ·', r.err ? 'ERRO ' + r.err : mb(r.size), '· memória pico:', mb(pico), d ? '· ' + path.basename(out) : '');
  vivo = false; if (errs.length) console.log('ERROS:', errs.join(' | '));
  await browser.close();
})();
