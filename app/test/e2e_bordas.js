// casos de borda da importação
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const X = '/tmp/claude-0/xx/', OUT = '/tmp/claude-0/e2e_edge'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
const ok = (c, m) => console.log((c ? 'OK   ' : 'FALHA') + ' ' + m);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const nova = async () => {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const html = path.join(OUT, 'p.html'); if (!fs.existsSync(html)) fs.writeFileSync(html, '<!doctype html><html><head><meta charset="utf8"></head><body>' + fs.readFileSync('/home/claude/milk/repo/app/dist/Revisor Fiscal - offline.html', 'utf8') + '</body></html>');
    await p.goto('file://' + html); await p.waitForSelector('#lg-email', { state: 'visible' }); await p.waitForTimeout(1300);
    await p.fill('#lg-email', 'milk@milk.com.br'); await p.fill('#lg-senha', 'milk'); await p.press('#lg-senha', 'Enter'); await p.waitForFunction(() => document.getElementById('login').hidden, null, { timeout: 10000 });
    return p;
  };
  const carrega = async (p, fs_, cond) => { await p.setInputFiles('#file', fs_); await p.waitForFunction(cond || (() => S.loaded && !busy), null, { timeout: 150000, polling: 500 }); await p.waitForTimeout(1500); };
  const base = async p => p.evaluate(() => ({ n: S.totals.n, v: S.totals.vlrItem.toFixed(2), pot: (S.pot.pis + S.pot.cof).toFixed(2), tipo: S.tipo }));
  // 1. referência: a 037 sozinha
  let p = await nova(); await carrega(p, [X + 'e037.xlsx']); const ref = await base(p); console.log('     referência 037:', JSON.stringify(ref)); await p.context().close();
  // 2. a mesma 037 duas vezes (cópia com outro nome)
  p = await nova(); await carrega(p, [X + 'e037.xlsx', X + 'e037_copia.xlsx']); const dup = await base(p);
  ok(dup.n === ref.n && dup.v === ref.v, 'mesma 037 duas vezes: lida uma vez só (' + dup.n + ' linhas)'); await p.context().close();
  // 3. a 037 em .csv
  p = await nova(); await carrega(p, [X + 'csv/e037.csv']); const csv = await base(p);
  ok(csv.n === ref.n && csv.v === ref.v && csv.pot === ref.pot, '037 em .csv (vírgula, valores formatados "R$ 1,234.56") dá o mesmo resultado (' + csv.n + ' linhas · Vlr Item ' + csv.v + ' · crédito ' + csv.pot + ')'); await p.context().close();
  p = await nova(); await carrega(p, [X + 'csv2/e037.csv']); const csv2 = await base(p);
  ok(csv2.n === ref.n && csv2.v === ref.v && csv2.pot === ref.pot, '037 em .csv (ponto e vírgula, como o Excel salva) dá o mesmo resultado (' + csv2.v + ' · ' + csv2.pot + ')'); await p.context().close();
  // 4. complementares antes, 037 depois (ECD e 513 refeitas com a 037)
  p = await nova(); await carrega(p, [X + 'fecd.xlsx', X + 'j513.xlsx'], () => !busy && S.extras.ecdA && S.extras.j513);
  const a1 = await p.evaluate(() => ({ ja: S.extras.ecdA.res.ja, perfil: S.extras.j513.comPerfil }));
  await carrega(p, [X + 'e037.xlsx']); const a2 = await p.evaluate(() => ({ ja: S.extras.ecdA.res.ja, perfil: S.extras.j513.comPerfil }));
  ok(a1.ja === 0 && a2.ja > 0 && !a1.perfil && a2.perfil, 'ECD e 513 antes da 037: refeitas quando a 037 chega (já utilizado ' + a1.ja + ' → ' + a2.ja + ')'); await p.context().close();
  // 5. só a 047 (empresa sem a 037): painel, outras e exportar sem erro
  p = await nova(); await carrega(p, [X + 'f047.xlsx']); await p.evaluate(() => go('outras')); await p.waitForTimeout(500); await p.evaluate(() => go('exportar')); await p.waitForTimeout(500);
  ok(await p.evaluate(() => S.tipo === 'SAI' && !!document.querySelector('#b-tudo')), 'só a 047: telas abrem e o Exportar fica pronto'); await p.context().close();
  // 6. outra empresa na mesma importação: recusa com mensagem
  p = await nova(); await p.setInputFiles('#file', [X + 'e037.xlsx', '/tmp/claude-0/xi/s047.xlsx']); await p.waitForTimeout(8000);
  const msg = await p.evaluate(() => /são de empresas diferentes/.test(document.body.innerText) && !S.loaded);
  ok(msg, 'empresas diferentes juntas: recusado com a mensagem "são de empresas diferentes"'); await p.context().close();
  // 7. depois de uma empresa, outra empresa: a tela troca e os complementares da anterior somem
  p = await nova(); await carrega(p, [X + 'e037.xlsx', X + 'fecd.xlsx'], () => !busy && S.loaded && S.extras.ecdA);
  await carrega(p, ['/tmp/claude-0/xi/s047.xlsx'], () => !busy && S.loaded && S.tipo === 'SAI');
  const t7 = await p.evaluate(() => ({ cnpj: S.empresa.cnpj, ecd: !!extrasDaEmpresa().ecdA, q: quadroResumo().L.find(l => l.k === 'ecd').v }));
  ok(!t7.ecd && !t7.q, 'outra empresa depois: a ECD da anterior não aparece no quadro (' + t7.cnpj + ')'); await p.context().close();
  console.log('ERROS:', errs.length ? [...new Set(errs)].join(' | ') : 'nenhum');
  await b.close();
})();
