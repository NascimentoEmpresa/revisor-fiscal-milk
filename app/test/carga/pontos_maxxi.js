// Outros pontos da MAXXI: exclusão do ICMS por mês (070 x 047), anulação 1206 (069 x 037), devoluções com ICMS (070 x C197)
// diagnóstico: exclusão 52.081,43 (a 9,25% em todos os meses) · anulação 09/2021 28.672,34 · devoluções 979,83
const ctx = require('../harness.js'), fs = require('fs'), path = require('path'), A = ctx.__api;
const X = '/tmp/claude-0/maxxi/MAXXI/', P = X + 'PLANILHA DE ANÁLISE/';
const arq = f => new File([fs.readFileSync(f)], path.basename(f));
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const S = ctx.__S;
  for (const [tipo, n] of [['ENT', 'EFD - Contribuições - 037 - Entradas - Todos os Registros - Completo.xlsx'], ['SAI', 'EFD - Contribuições - 047 - Saídas - Todos os Registros - Completo.xlsx']]) {
    const w = await A.readXlsxStream(arq(P + n)); await A.runPipeline({ pre: { tipo, headers: w.headers, rows: w.rows, fileNames: [n], ms: 0 } }, () => {}); ctx.guardarAnalise();
  }
  const sp = []; for (const f of fs.readdirSync(X + 'DOCUMENTAÇÃO/EFD ICMS').filter(f => f.endsWith('.txt'))) { const s = A.lerSped0150(fs.readFileSync(X + 'DOCUMENTAÇÃO/EFD ICMS/' + f, 'latin1'), f); if (s) sp.push(s); }
  A.guardarSped0150(sp);
  for (const n of ['EFD - ICMS-IPI - 070 - Saídas - Todos os Registros - Completo.xlsx', 'EFD - ICMS-IPI - 069 - Entradas - Todos os Registros - Completo.xlsx']) {
    const w = await A.readXlsxStream(arq(P + n)), c = A.lerICMS(w.headers, w.rows, [n]); if (c.tipo === 'S') c.corte = 202010; A.guardarExtra('ICMS', c);
  }
  const ex = A.analisarExclusao(), an = A.analisarAnulacoes(), dv = A.analisarDevolucoes();
  console.log('exclusão: meses', ex.meses.filter(m => m.sel).map(m => m.ym).join(' '));
  ok(ex.icms.toFixed(2) === '563042.50', 'ICMS não excluído 10/2020 a 03/2022: ' + ex.icms.toFixed(2) + ' (analista 563.042,50)');
  ok(ex.v925.toFixed(2) === '52081.43', 'a 9,25% em todos os meses: ' + ex.v925.toFixed(2) + ' (diagnóstico 52.081,43)');
  console.log('     pelo regime de cada mês (Q1/2022 cumulativo, 3,65%): PIS ' + ex.pis + ' COFINS ' + ex.cof + ' = ' + (ex.pis + ex.cof).toFixed(2));
  const a21 = an.docs.filter(d => d.sel);
  ok(an.n === 1 && (an.pis + an.cof).toFixed(2) === '28672.34', 'anulação: ' + an.n + ' nota(s) ' + a21.map(d => d.data + ' ' + d.base).join(', ') + ' → ' + (an.pis + an.cof).toFixed(2) + ' (diagnóstico 28.672,34) · cumulativo para conferir: ' + an.cum + ' notas ' + an.cumBase);
  ok(dv.icms.toFixed(2) === '979.83', 'devoluções sem estorno: ' + dv.icms.toFixed(2) + ' em ' + dv.n + ' notas (analista 979,83) · estornadas ' + dv.estornado);
  for (const d of dv.docs) console.log('     ', d.num, d.cfop, d.icms, d.st);
  const G = A.quadroGeral(); console.log('QUADRO GERAL'); for (const x of G.rec) console.log('  ', x.bloco.padEnd(10), x.desc.padEnd(60), x.per.padEnd(20), x.v.toFixed(2));
  console.log('   TOTAL A RECUPERAR', G.totRec); for (const x of G.recolher) console.log('  ', x.bloco.padEnd(10), x.desc.padEnd(60), x.v.toFixed(2)); console.log('   TOTAL A RECOLHER', G.totRecolher);
  const b = await A.buildWorkbookPontos(); fs.writeFileSync('/tmp/claude-0/pontos_out.xlsx', Buffer.from(await b.arrayBuffer())); console.log('Excel outros pontos:', b.size, 'bytes');
  // os cards (kpi, ICON) ficam na interface: conferidos no teste e2e
})().catch(e => { console.error(e); process.exit(1); });
