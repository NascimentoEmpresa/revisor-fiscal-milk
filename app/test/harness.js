const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { atob, btoa, Uint8Array, DataView, TextDecoder, console, setTimeout, clearTimeout, TextEncoder, Blob, Intl, Math, Date, performance, URL,
  fflate: require('../vendor/fflate-0.8.2/package/umd/index.js'), XLSX: require('../vendor/xlsx-0.18.5/package/dist/xlsx.full.min.js') };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const files = ['01_util.js','02_rules.js','03_demo.js','03b_reader.js','04_engine.js','05_xlsx.js','06_docx.js','06b_modelo.js','06c_extras.js','06d_outras.js','06e_ecd.js','06f_icms.js'];
let code = files.map(f => fs.readFileSync(path.join(__dirname,'../src/js',f),'utf8')).join('\n');
code += '\n;globalThis.__S = S; globalThis.XlsxBook = XlsxBook; globalThis.XS = XS; globalThis.normKey = normKey; globalThis.TEXT_COLS = TEXT_COLS; globalThis.buildDemo = buildDemo; globalThis.buildDemoSaidas = buildDemoSaidas; globalThis.preencherModelo = preencherModelo; globalThis.guardarAnalise = guardarAnalise; globalThis.ativarAnalise = ativarAnalise; globalThis.dadosModelo = dadosModelo; globalThis.DX = DX; globalThis.__XR = XR; globalThis.__api = {lerICMS, analisarICMS, lerSped0150, guardarSped0150, buildWorkbookICMS, periodoIE, lerECD, analisarECD, recalcECD, buildWorkbookECD, perfis: perfisFornecedor, lerJ513, lerECF, analisarJ513, recalcJ513, guardarExtra, buildWorkbookJ513, textoApuracao, tipoExtra, quadroResumo, runPipeline, readXlsxStream, buildDemoSaidas, buildWorkbook, buildDocx, buildRawExport, recompute, setGroupCls, suggest, creditOf, clsOf};';
vm.runInContext(code, ctx, {filename:'app.js'});
module.exports = ctx;
