// ECD x 037 do frigorífico (exemplo da Milk): conta "GERAL" na 037, já utilizado pela natureza do crédito, contas e ajustes da analista → R$ 116.393,64
// ECD x 037 da MAXXI: o Revisor reproduz a tabela da analista (R$ 602.130,55 → R$ 55.697,08)?
const ctx = require('../harness.js'), fs = require('fs'), A = ctx.__api;
const X = process.env.FRIG || '/tmp/claude-0/fx/'; // 037 (f037.xlsx) e ECD (fecd.xlsx) do exemplo do frigorífico
const arq = n => new File([fs.readFileSync(X + n)], n);
(async () => {
  const f37 = arq('f037.xlsx');
  const w37 = await A.readXlsxStream(f37);
  await A.runPipeline({ pre: { tipo: 'ENT', headers: w37.headers, rows: w37.rows, fileNames: [f37.name], ms: 0 } }, () => {});
  const S = ctx.__S; console.log('037:', S.recs.length, 'linhas · contaCtb na coluna', S.map.contaCtb, '· meses NC', [...S.monthIdx.values()].filter(m => m.regime === 'NC').length);
  const t0 = Date.now(), fe = arq('fecd.xlsx');
  const we = await A.readXlsxStream(fe);
  console.log('ECD lida:', we.rows.length, 'linhas em', Date.now() - t0, 'ms · tipo', ctx.__api.tipoExtra(we.headers.map(ctx.normKey)));
  A.guardarExtra('ECD', A.lerECD(we.headers, we.rows, [fe.name]));
  const e = S.extras.ecdA, show = () => { const R = e.res; console.log('   ECD', R.valor.toFixed(2), '· já utilizado', R.ja.toFixed(2), '· diferença', R.dif.toFixed(2), '· crédito', (R.pis + R.cof).toFixed(2), '· contas SIM', R.sim, 'AVALIAR', R.ava); };
  console.log('anos', e.anos, 'no escopo', e.anosEscopo, '(regime pela', e.fonteRegime + ')');
  console.log('1) só a sugestão do Revisor:'); show();
  for (const c of [...e.contas.values()].filter(c => c.despesa && c.valor && c.sug !== 'NÃO INCLUIR').sort((a, b) => b.valor - a.valor)) console.log('     ', c.sug.padEnd(11), c.conta.padEnd(6), c.desc.padEnd(32), c.valor.toFixed(2).padStart(13), c.ja.toFixed(2).padStart(13), c.jaDe.join(','), '|', c.cat);
  console.log('   037 fora da tabela:', e.semConta.map(s => s.conta + ' ' + s.nome + ' ' + s.base).join(' | '));
  const dela = ['DESPESAS COM HIGIENE', 'DESPESAS DIVERSAS', 'UNIFORMES', 'DESPESAS DE PEDAGIOS', 'MANUT.DE MOVEIS E UTENSILIOS', 'MANUTENCAO DE INSTALACOES', 'PNEUS E CAMARAS', 'MATERIAL DE EMBALAGENS', 'BENS NATUREZA PERMANENTE', 'MANUT.DE MAQUINAS E EQUIP.', 'DESPESAS C/VEICULOS', 'FRETES E CARRETOS', 'MANUTENCAO DE PREDIO E BENFEIT', 'PRESTACAO  DE SERV. TERC. PJ', 'DEPRECIACOES', 'COMBUSTIVEIS E LUBRIFICANTES', 'MATERIAL DE CONSUMO', 'ENERGIA ELETRICA'];
  for (const c of e.contas.values()) c.ov = dela.includes(c.desc) ? 'INCLUIR' : 'NÃO INCLUIR';
  A.analisarECD(e); console.log('2) com as contas que a analista escolheu:'); show();
  for (const c of e.contas.values()) { if (c.desc === 'PRESTACAO  DE SERV. TERC. PJ') c.ajuste = 160939.84; if (c.desc === 'MATERIAL DE CONSUMO') c.ajuste = 293635.70; }
  A.analisarECD(e); console.log('3) + os dois valores que ela filtrou (serviços e material de consumo):'); show();
  console.log('   relatório: ECD 1.543.352,30 · já utilizado 285.042,68 · base 1.258.309,62 · crédito 116.393,64');
  const b = await A.buildWorkbookECD(); fs.writeFileSync('/tmp/claude-0/ecd_frig.xlsx', Buffer.from(await b.arrayBuffer())); console.log('Excel ECD:', b.size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });

