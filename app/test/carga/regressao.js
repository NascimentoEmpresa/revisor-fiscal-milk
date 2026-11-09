// gera o Excel da demonstração (037 e 047) com o 05_xlsx.js indicado e grava as partes do ZIP
const fs = require('fs'), path = require('path'), [xlsxJs, out] = process.argv.slice(2);
const orig = fs.readFileSync; fs.readFileSync = function (p, ...a) { if (String(p).endsWith('/src/js/05_xlsx.js')) p = xlsxJs; return orig.call(this, p, ...a); };
const ctx = require('../harness.js'); fs.readFileSync = orig;
const fflate = ctx.fflate;
(async () => {
  for (const t of ['ENT', 'SAI']) {
    const d = t === 'SAI' ? ctx.buildDemoSaidas() : ctx.buildDemo();
    await ctx.__api.runPipeline({ demo: t }, () => {});
    const b = await ctx.__api.buildWorkbook();
    const z = fflate.unzipSync(new Uint8Array(await b.arrayBuffer()));
    for (const [k, v] of Object.entries(z)) { if (/core\.xml/.test(k)) continue; const f = path.join(out, t, k); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, v); }
  }
})().catch(e => { console.error(e); process.exit(1); });
