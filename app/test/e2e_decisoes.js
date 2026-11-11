const { chromium } = require('playwright'), fs = require('fs');
const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const entra = async () => { await p.goto('file:///tmp/claude-0/e2e_edge/p.html'); await p.waitForSelector('#lg-email', { state: 'visible' }); await p.waitForTimeout(1300); await p.fill('#lg-email', 'milk@milk.com.br'); await p.fill('#lg-senha', 'milk'); await p.press('#lg-senha', 'Enter'); await p.waitForFunction(() => document.getElementById('login').hidden); };
  const carrega = async () => { await p.setInputFiles('#file', ['/tmp/claude-0/xx/e037.xlsx']); await p.waitForFunction(() => S.loaded && !busy, null, { timeout: 150000 }); await p.waitForTimeout(1500); };
  await entra(); await carrega();
  const a = await p.evaluate(() => { const gs = S.groups.filter(g => (g.dec || g.sug.cls) === CLS.AVA).slice(0, 10); for (const g of gs) setGroupCls(g, CLS.COM); return { n: gs.length, pot: (S.pot.pis + S.pot.cof).toFixed(2) }; });
  await entra(); await carrega();
  const c = await p.evaluate(() => ({ n: S.groups.filter(g => g.dec).length, pot: (S.pot.pis + S.pot.cof).toFixed(2), toast: document.body.innerText.includes('foram reaplicadas') }));
  ok(c.n === a.n && c.pot === a.pot, 'decidi ' + a.n + ' grupos, fechei e importei de novo: ' + c.n + ' decisões voltaram, crédito ' + c.pot + ' = ' + a.pot + (c.toast ? ' (com aviso)' : ''));
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum'); await b.close();
})();
