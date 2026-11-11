// 070 + SPED EFD ICMS (0150) + ECF da MAXXI: CT-e RS/RS com ICMS para tomador inscrito (diagnóstico: R$ 908.037,34)
const ctx = require('../harness.js'), fs = require('fs'), path = require('path'), A = ctx.__api;
const X = '/tmp/claude-0/maxxi/MAXXI/', P = X + 'PLANILHA DE ANÁLISE/';
const arq = f => new File([fs.readFileSync(f)], path.basename(f));
(async () => {
  let t = Date.now();
  const w = await A.readXlsxStream(arq(P + 'EFD - ICMS-IPI - 070 - Saídas - Todos os Registros - Completo.xlsx'));
  console.log('070:', w.sheet, w.rows.length, 'linhas em', Date.now() - t, 'ms · tipo', A.tipoExtra(w.headers.map(ctx.normKey)));
  const c = A.lerICMS(w.headers, w.rows, ['070.xlsx']); console.log('   saídas?', c.tipo, '· CT-e RS/RS com ICMS:', c.cte.size);
  t = Date.now(); const sp = [];
  for (const f of fs.readdirSync(X + 'DOCUMENTAÇÃO/EFD ICMS').filter(f => f.endsWith('.txt'))) { const s = A.lerSped0150(fs.readFileSync(X + 'DOCUMENTAÇÃO/EFD ICMS/' + f, 'latin1'), f); if (s) sp.push(s); }
  const ecfTxt = fs.readdirSync(X + 'DOCUMENTAÇÃO/ECF')[0]; console.log('   ECF .txt é ignorado?', A.lerSped0150(fs.readFileSync(X + 'DOCUMENTAÇÃO/ECF/' + ecfTxt, 'latin1'), ecfTxt) === null);
  A.guardarSped0150(sp); console.log('SPED 0150:', sp.length, 'arquivos em', Date.now() - t, 'ms');
  const fe = arq(P + 'ECF - 0000, 0010 - Identificação PJ e Parâmetros de Tributação.xlsx'), we = await A.readXlsxStream(fe); A.guardarExtra('ECF', A.lerECF(we.headers, we.rows, [fe.name]));
  c.corte = 202101; // data do diagnóstico: 01/2026
  A.guardarExtra('ICMS', c); const S = ctx.__S, ic = S.extras.icmsS;
  const show = n => { const R = ic.res; console.log(n, '· ICMS', R.icms.toFixed(2), '· CT-e', R.n, '· anos', JSON.stringify([...R.anos].map(([a, y]) => [a, +y.icms.toFixed(2)])), '· presumido', R.presum, '· PIS/COFINS', R.pc); };
  show('1) só a sugestão do 0150 (sem consultar a SEFAZ)');
  const rs = JSON.parse(fs.readFileSync('/tmp/claude-0/rsrs.json')); for (const [ch, v, ct, cn] of rs) if (cn && ct) ic.periodos[String(cn).padStart(14, '0')] = String(ct);
  A.analisarICMS(ic); show('2) com os períodos da SEFAZ que a analista consultou');
  const sugeridos = [...ic.tom.values()].filter(x => !ic.periodos[x.part] && x.sel); console.log('   tomadores só sugeridos pelo 0150:', sugeridos.length, sugeridos.map(x => x.nome.slice(0, 22) + ' ' + x.sel.toFixed(2)).join(' | '));
  for (const x of sugeridos) ic.periodos[x.part] = 'NÃO'; A.analisarICMS(ic); show('2b) e NÃO nos que a SEFAZ não confirmou');
  ic.presumido = '01/2022 a 09/2025'; A.analisarICMS(ic); show('3) + crédito presumido de 01/2022 a 09/2025');
  console.log('   diagnóstico: ICMS 908.037,34 (2021 308.383,80; 2022-2023 599.653,54) · presumido 119.930,71 · PIS/COFINS 50.412,86');
  const b = await A.buildWorkbookICMS(); fs.writeFileSync('/tmp/claude-0/icms_out.xlsx', Buffer.from(await b.arrayBuffer())); console.log('Excel ICMS:', b.size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
