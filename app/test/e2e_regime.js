// regime por ano: escolha da analista e ECF passam por cima do deduzido da 037
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const OUT = '/tmp/claude-0/e2e_reg'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const html = path.join(OUT, 'p.html'); fs.writeFileSync(html, '<!doctype html><html><head><meta charset="utf8"></head><body>' + fs.readFileSync('/home/claude/milk/repo/app/dist/Revisor Fiscal - offline.html', 'utf8') + '</body></html>');
  const nova = async () => { const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('file://' + html); await p.waitForSelector('#lg-email', { state: 'visible' }); await p.waitForTimeout(1300); await p.fill('#lg-email', 'milk@milk.com.br'); await p.fill('#lg-senha', 'milk'); await p.press('#lg-senha', 'Enter'); await p.waitForFunction(() => document.getElementById('login').hidden); return p; };
  const carrega = async (p, f, cond) => { await p.setInputFiles('#file', f); await p.waitForFunction(cond || (() => S.loaded && !busy), null, { timeout: 200000, polling: 500 }); await p.waitForTimeout(1500); };
  // 1. frigorífico (Lucro Real): a analista diz que 2023 foi Presumido
  let p = await nova(); await carrega(p, ['/tmp/claude-0/xx/e037.xlsx']);
  const a = await p.evaluate(() => ({ pot: S.pot.pis + S.pot.cof, ano23: S.potYears.find(y => y.ano === 2023) }));
  await p.selectOption('select[data-reg-ano="2023"]', 'CUM'); await p.waitForTimeout(800);
  const b2 = await p.evaluate(() => ({ pot: S.pot.pis + S.pot.cof, ano23: S.potYears.find(y => y.ano === 2023), cc: S.credCum, sel: document.querySelector('select[data-reg-ano="2023"]').value, regs: S.months.filter(m => m.ano === 2023).every(m => m.regime === 'CUM') }));
  ok(b2.regs && b2.sel === 'CUM' && !b2.ano23 && b2.pot < a.pot, '2023 como Lucro Presumido: some o crédito sugerido de 2023 (' + a.pot.toFixed(2) + ' → ' + b2.pot.toFixed(2) + ')');
  ok(b2.cc && b2.cc.n > 0, 'crédito já tomado em 2023 vira "crédito indevido no Presumido": ' + b2.cc.n + ' itens, ' + b2.cc.v);
  const q = await p.evaluate(() => quadroGeral().recolher.map(x => x.desc + ' ' + x.v)); ok(q.some(x => /Presumido/.test(x)), 'quadro geral: ' + q.join(' | '));
  await p.screenshot({ path: OUT + '/painel.png', fullPage: true });
  // reabrir a página e importar de novo: a escolha continua
  await p.reload(); await p.waitForSelector('#lg-email', { state: 'visible' }); await p.waitForTimeout(1300); await p.fill('#lg-email', 'milk@milk.com.br'); await p.fill('#lg-senha', 'milk'); await p.press('#lg-senha', 'Enter'); await p.waitForFunction(() => document.getElementById('login').hidden);
  await carrega(p, ['/tmp/claude-0/xx/e037.xlsx']);
  const c = await p.evaluate(() => ({ pot: S.pot.pis + S.pot.cof, sel: document.querySelector('select[data-reg-ano="2023"]').value }));
  ok(c.sel === 'CUM' && Math.abs(c.pot - b2.pot) < 0.01, 'a escolha fica guardada para o CNPJ (' + c.pot.toFixed(2) + ')');
  await p.selectOption('select[data-reg-ano="2023"]', ''); await p.waitForTimeout(800);
  const d = await p.evaluate(() => S.pot.pis + S.pot.cof); ok(Math.abs(d - a.pot) < 0.01, 'volta ao automático: ' + d.toFixed(2));
  await p.context().close();
  // 2. MAXXI: a 047 + a ECF depois (2020-2021 Real, 2022-2025 Presumido)
  p = await nova(); await carrega(p, ['/tmp/claude-0/xi/s047.xlsx']);
  await carrega(p, ['/tmp/claude-0/xi/ecf.xlsx'], () => !busy && S.extras.ecf);
  const e = await p.evaluate(() => { const ms = S.months; return { fontes: [...new Set(ms.map(m => m.ano + ':' + m.regime + ':' + m.regimeFonte))].join(' '), sel: [...document.querySelectorAll('select[data-reg-ano] option:checked')].map(o => o.textContent).join(' | ') }; });
  console.log('     ' + e.fontes); console.log('     ' + e.sel);
  ok(/2022:CUM:ECF/.test(e.fontes) && /2021:NC:ECF/.test(e.fontes), 'ECF importada depois: o regime de cada ano vem dela');
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum'); await b.close();
})();
