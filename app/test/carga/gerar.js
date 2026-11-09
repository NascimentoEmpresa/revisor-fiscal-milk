// gera uma exportação 047 (ou 037) fictícia com N linhas, a partir dos dados de demonstração
// uso: node carga/gerar.js SAI 600000 saida.xlsx
const ctx = require('../harness.js'), fs = require('fs');
const [tipo = 'SAI', nStr = '100000', out = 'carga.xlsx'] = process.argv.slice(2);
const N = +nStr, sai = tipo === 'SAI', d = sai ? ctx.buildDemoSaidas() : ctx.buildDemo();
const hk = d.headers.map(ctx.normKey);
const iNota = hk.findIndex(k => /^(numero|n[uú]mero|num)\b.*(doc|nota)|^documento$|^nota/.test(k));
const st = hk.map(k => /^vlr /.test(k) ? ctx.XS.dec : /^data |^periodo$/.test(k) ? ctx.XS.date : (ctx.TEXT_COLS.includes(k) ? ctx.XS.txt : 0));
const base = d.rows, L = base.length;
(async () => {
  const B = new ctx.XlsxBook(); B.title = 'carga';
  B.addSheet({ name: 'Planilha', rows: async (emit, y) => {
    emit(d.headers, { s: ctx.XS.bold });
    for (let i = 0; i < N; i++) {
      const r = base[i % L].slice();
      if (iNota >= 0) r[iNota] = String(100000 + i);
      emit(r, { s: st });
      if (i % 20000 === 19999) await y();
    }
  } });
  const blob = await B.build();
  fs.writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
  console.log(out, N, 'linhas,', (fs.statSync(out).size / 1e6).toFixed(1), 'MB; base demo', L, 'linhas; coluna nota', iNota >= 0 ? d.headers[iNota] : '(nenhuma)');
})();
