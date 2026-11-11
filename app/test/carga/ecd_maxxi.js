// ECD x 037 da MAXXI: o Revisor reproduz a tabela da analista (R$ 602.130,55 → R$ 55.697,08)?
const ctx = require('../harness.js'), fs = require('fs'), A = ctx.__api;
const X = process.env.MAXXI || '/tmp/claude-0/maxxi/MAXXI/PLANILHA DE ANÁLISE/';
const arq = n => new File([fs.readFileSync(X + n)], n);
(async () => {
  const f37 = arq('EFD - Contribuições - 037 - Entradas - Todos os Registros - Completo.xlsx');
  const w37 = await A.readXlsxStream(f37);
  await A.runPipeline({ pre: { tipo: 'ENT', headers: w37.headers, rows: w37.rows, fileNames: [f37.name], ms: 0 } }, () => {});
  const S = ctx.__S; console.log('037:', S.recs.length, 'linhas · contaCtb na coluna', S.map.contaCtb, '· meses NC', [...S.monthIdx.values()].filter(m => m.regime === 'NC').length);
  const t0 = Date.now(), fe = arq('ECD - I200, I250 - Partidas Lançamento - Completo.xlsx');
  const we = await A.readXlsxStream(fe);
  console.log('ECD lida:', we.rows.length, 'linhas em', Date.now() - t0, 'ms · tipo', ctx.__api.tipoExtra(we.headers.map(ctx.normKey)));
  A.guardarExtra('ECD', A.lerECD(we.headers, we.rows, [fe.name]));
  const e = S.extras.ecdA, show = () => { const R = e.res; console.log('   ECD', R.valor.toFixed(2), '· já utilizado', R.ja.toFixed(2), '· diferença', R.dif.toFixed(2), '· crédito', (R.pis + R.cof).toFixed(2), '· contas SIM', R.sim, 'AVALIAR', R.ava); };
  console.log('anos', e.anos, 'no escopo', e.anosEscopo, '(regime pela', e.fonteRegime + ')');
  console.log('1) só a sugestão do Revisor:'); show();
  for (const c of [...e.contas.values()].filter(c => c.despesa && c.valor && c.sug !== 'NÃO INCLUIR').sort((a, b) => b.valor - a.valor)) console.log('     ', c.sug.padEnd(11), c.conta.padEnd(6), c.desc.padEnd(32), c.valor.toFixed(2).padStart(13), c.ja.toFixed(2).padStart(13), c.jaDe.join(','), '|', c.cat);
  console.log('   037 fora da tabela:', e.semConta.map(s => s.conta + ' ' + s.nome + ' ' + s.base).join(' | '));
  // decisões da analista: as 9 contas dela, nada mais; a 411 (F100) somada nos seguros
  const dela = new Set(['714', '524', '361', '363', '1063', '358', '713', '712', '1061']);
  for (const c of e.contas.values()) c.ov = dela.has(c.conta) ? 'INCLUIR' : (c.sug === 'INCLUIR' ? 'NÃO INCLUIR' : (c.sug === 'AVALIAR' ? 'NÃO INCLUIR' : null));
  A.analisarECD(e); console.log('2) com as contas que a analista escolheu:'); show();
  e.atrib['411'] = '358'; A.analisarECD(e); console.log('3) + a conta 411 da 037 somada nos seguros (como ela fez):'); show();
  console.log('   relatório: diferença 602130.55 · crédito 55697.08');
  const b = await A.buildWorkbookECD(); fs.writeFileSync('/tmp/claude-0/ecd_out.xlsx', Buffer.from(await b.arrayBuffer())); console.log('Excel ECD:', b.size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
