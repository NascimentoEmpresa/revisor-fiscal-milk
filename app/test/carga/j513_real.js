// 037 + Junção 513 + ECF do exemplo do frigorífico: sugestão do Revisor x anotação da analista
const ctx = require('../harness.js'), fs = require('fs'), path = require('path');
const X = '/tmp/claude-0/modelo/x/', A = ctx.__api;
const arq = n => new File([fs.readFileSync(X + n)], n);
(async () => {
  if (process.env.KB) { // decisões da analista na 037 (NCM + CFOP), como base da equipe
    const lab = JSON.parse(fs.readFileSync('/tmp/claude-0/modelo/lab037.json', 'utf8')), kb = {};
    for (const l of lab) kb[(l[0] || '-') + '|' + (l[1] || '-')] = { cls: /^PERMITE/i.test(l[3]) ? 'COM CREDITO' : 'SEM CREDITO', motivo: 'Decisão da analista: ' + l[3] };
    ctx.__S.kb = kb; console.log('base da equipe:', Object.keys(kb).length, 'decisões');
  }
  const f37 = arq('Consolidações - EFD - Contribuições - 037 - Entradas - Todos os Registros - Completo.xlsx');
  const w37 = await A.readXlsxStream(f37);
  await A.runPipeline({ pre: { tipo: 'ENT', headers: w37.headers, rows: w37.rows, fileNames: [f37.name], ms: 0 } }, () => {});
  const fj = arq('Junções - EFD-ICMS-IPI + EFD-Contribuições - 513 - C100, C170 - Todos os Documentos e CFOP - Resumido.xlsx');
  const wj = await A.readXlsxStream(fj);
  console.log('513 lida:', wj.sheet, wj.rows.length, 'linhas · tipo', A.tipoExtra(wj.headers.map(ctx.normKey)));
  A.guardarExtra('J513', A.lerJ513(wj.headers, wj.rows, [fj.name]));
  const j = ctx.__S.extras.j513, R = j.res;
  console.log('candidatas E/S', R.cand, '· com', R.com, '· base', R.base, '· PIS+COFINS', (R.pis + R.cof).toFixed(2), '· avaliar', R.ava, '· só CON', R.soCon);
  // gabarito: o que a analista anotou
  const credAnalista = /GASOLINA|DIESEL|CABO|UNIFORME/i;
  let ok = 0, tot = 0; const dif = [];
  for (const n of j.notas.filter(n => n.cand && n.tipo === 'E')) {
    const esp = credAnalista.test(n.obs) ? 'COM CREDITO' : 'SEM CREDITO', got = n.sug.cls; tot++;
    if (got === esp) ok++; else dif.push(got.padEnd(12) + ' esperado ' + esp.padEnd(12) + n.cfop + ' ' + String(n.vlr).padStart(10) + ' | analista: ' + n.obs + ' | ' + n.sug.motivo);
  }
  console.log('entradas: sugestão igual à analista em', ok, 'de', tot); dif.forEach(d => console.log('  ', d));
  if (process.env.DBG) { const P = new Map(); for (const n of j.notas.filter(n => n.cand && n.tipo === 'E' && /GASOLINA/.test(n.obs))) P.set(n.part, 1); const perf = ctx.__api.perfis(); for (const c of P.keys()) { const p = perf.P.get(c); console.log(c, 'com', Math.round(p.com), 'sem', Math.round(p.sem), 'ava', Math.round(p.ava), [...p.prod].sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]+' '+Math.round(x[1]))); } }
  const sai = j.notas.filter(n => n.cand && n.tipo === 'S'); console.log('saídas:', sai.map(n => n.cfop + ' ' + n.sug.cls + ' (analista: ' + n.obs + ')').reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {}));
  for (const n of j.notas.filter(n => n.cand && n.tipo === 'E' && n.sug.cls === 'AVALIAR' && /GASOLINA/.test(n.obs))) n.ov = 'COM CREDITO';
  const R2 = ctx.__api.recalcJ513(j); console.log('depois de decidir os 2 diesel: base', R2.base.toFixed(2), '· PIS', R2.pis, '· COFINS', R2.cof, '· total', (R2.pis + R2.cof).toFixed(2), '(relatório: 824,21)');
  const fe = arq('Declarações Federais - ECF - 0 - Identificação - 0000, 0010 - Identificação PJ e Parâmetros de Tributação.xlsx');
  const we = await A.readXlsxStream(fe); A.guardarExtra('ECF', A.lerECF(we.headers, we.rows, [fe.name]));
  console.log('ECF:', A.textoApuracao(ctx.__S.extras.ecf), '|', ctx.__S.extras.ecf.anos.map(a => a.ano + ' ' + a.trib).join(', '));
  const b = await A.buildWorkbookJ513(); fs.writeFileSync('/tmp/claude-0/j513_out.xlsx', Buffer.from(await b.arrayBuffer())); console.log('Excel 513:', b.size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
// depuração do perfil dos fornecedores que ficaram diferentes
module.exports.dbg = true;
