/* ====================== gravador de .xlsx (OOXML + fflate) ====================== */
/* Escrito à mão para gerar planilhas grandes rápido e com pouca memória: estilos, filtros, painéis congelados,
   fórmulas vivas, validação de lista e formatação condicional. */
const XS = { // índices de cellXfs (ver styles.xml abaixo)
  def: 0, head: 1, txt: 2, brl: 3, brlHl: 4, date: 5, int: 6, dec: 7, txtHl: 8, bold: 9, brlTot: 10, title: 11, note: 12,
  headY: 13, brlB: 14, pct: 15, headG: 16, wrap: 17, intB: 18, txtB: 19, dateHl: 20, decHl: 21, ind: 22,
  // padrão das abas de dados da equipe (vídeo 2): bordas finas, cabeçalho em negrito, colunas-chave em cinza A6A6A6, Moeda só nos 4 valores
  bHead: 23, bHeadHl: 24, bGen: 25, bTxt: 26, bTxtHl: 27, bGenHl: 28, bBrlHl: 29, bDate: 30, colHl: 31, totHl: 32, bBrl: 33, bWrap: 34,
  topGen: 35, topInt: 36, topBrl: 37, // CHECKLIST: tudo alinhado ao topo da linha
  // Moeda exatamente como a da analista ("R$" #,##0.00, negativo sem vermelho): cabeçalho, célula cinza, somas e coluna
  eHeadBrl: 38, eBrlHl: 39, eTotHl: 40, eTotB: 41, eBrl: 42, eBrlB: 43
};
/* limite do Excel: 1.048.576 linhas por aba. Uma aba de dados maior continua em "NOME (2)", "NOME (3)"…, cada parte com
   o cabeçalho e até XL_DADOS linhas de dados (a última linha fica livre para os totais). */
const XL_LINHAS = 1048576, XL_DADOS = XL_LINHAS - 2;
const parteNome = (nome, k) => k === 1 ? nome : (nome.length > 26 ? nome.slice(0, 26).trim() : nome) + ' (' + k + ')';
const partesDe = (nome, n) => { const out = []; const q = Math.max(1, Math.ceil(n / XL_DADOS)); for (let k = 1; k <= q; k++) out.push({ nome: parteNome(nome, k), linhas: Math.min(XL_DADOS, n - (k - 1) * XL_DADOS) }); return out; };
const BLANK = Object.freeze({ blank: true });
/* abas de dados que passam do limite e saem divididas, na análise que está na tela */
function abasDivididas() {
  const sai = S.tipo === 'SAI', M = MODES[S.tipo];
  const l = sai ? [[M.base, S.recs.length], [M.alvo, S.com.length], [M.outra, S.sem.length]] : [[M.base, S.recs.length], [M.outra, S.com.length], [M.alvo, S.alvo.length]];
  return l.filter(x => x[1] > XL_DADOS).map(([nome, n]) => ({ nome, n, partes: Math.ceil(n / XL_DADOS) }));
}
const avisoDivisao = () => abasDivididas().map(d => 'a aba ' + d.nome + ' (' + fNum(d.n) + ' linhas) foi dividida em ' + d.partes + ' abas').join('; ') + ', porque o Excel aceita no máximo 1.048.576 linhas por aba. Cada parte tem as próprias tabelas dinâmicas, com os dados dela.'; // célula com texto vazio: a exportação do SistemaMA traz as células vazias assim
const colName = (() => { const c = []; return i => c[i] || (c[i] = (function (n) { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; })(i)); })();
const xmlEsc = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00;[Red]\\-&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="165" formatCode="&quot;R$&quot;\\ #,##0.00"/></numFmts>' +
  '<fonts count="7">' +
  '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
  '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
  '<font><b/><sz val="16"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
  '<font><i/><sz val="10"/><color rgb="FF6B7079"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FF15171A"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
  '<font><sz val="10"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
  '</fonts>' +
  '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF111111"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE4E6E9"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF9E6846"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFA6A6A6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="4"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FF9AA0A8"/></bottom><diagonal/></border>' +
  '<border><left/><right/><top style="medium"><color rgb="FF15171A"/></top><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="44">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' + // 0 def
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' + // 1 head
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + // 2 txt
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + // 3 brl
  '<xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>' + // 4 brlHl
  '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + // 5 date
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + // 6 int
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + // 7 dec
  '<xf numFmtId="49" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>' + // 8 txtHl
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' + // 9 bold
  '<xf numFmtId="164" fontId="2" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>' + // 10 brlTot
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' + // 11 title
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="0"/></xf>' + // 12 note
  '<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' + // 13 headY
  '<xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' + // 14 brlB
  '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + // 15 pct
  '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' + // 16 headG
  '<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 17 wrap
  '<xf numFmtId="3" fontId="2" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>' + // 18 intB
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>' + // 19 txtB (total label)
  '<xf numFmtId="14" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>' + // 20 dateHl
  '<xf numFmtId="4" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>' + // 21 decHl
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" indent="1"/></xf>' + // 22 ind (itens internos da dinâmica)
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1"/>' + // 23 bHead
  '<xf numFmtId="0" fontId="2" fillId="5" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' + // 24 bHeadHl
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="3" xfId="0" applyBorder="1"/>' + // 25 bGen
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="3" xfId="0" applyNumberFormat="1" applyBorder="1"/>' + // 26 bTxt
  '<xf numFmtId="49" fontId="0" fillId="5" borderId="3" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' + // 27 bTxtHl
  '<xf numFmtId="0" fontId="0" fillId="5" borderId="3" xfId="0" applyFill="1" applyBorder="1"/>' + // 28 bGenHl
  '<xf numFmtId="164" fontId="0" fillId="5" borderId="3" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' + // 29 bBrlHl (Moeda)
  '<xf numFmtId="14" fontId="0" fillId="0" borderId="3" xfId="0" applyNumberFormat="1" applyBorder="1"/>' + // 30 bDate
  '<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"/>' + // 31 colHl (coluna inteira em cinza)
  '<xf numFmtId="164" fontId="2" fillId="5" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>' + // 32 totHl (AutoSoma)
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="3" xfId="0" applyNumberFormat="1" applyBorder="1"/>' + // 33 bBrl
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="3" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="0"/></xf>' + // 34 bWrap
  '<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>' + // 35 topGen
  '<xf numFmtId="3" fontId="6" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>' + // 36 topInt
  '<xf numFmtId="164" fontId="6" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>' + // 37 topBrl
  '<xf numFmtId="165" fontId="2" fillId="5" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 38 eHeadBrl
  '<xf numFmtId="165" fontId="0" fillId="5" borderId="3" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' + // 39 eBrlHl
  '<xf numFmtId="165" fontId="2" fillId="5" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>' + // 40 eTotHl
  '<xf numFmtId="165" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' + // 41 eTotB
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + // 42 eBrl
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="3" xfId="0" applyNumberFormat="1" applyBorder="1"/>' + // 43 eBrlB
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '<dxfs count="3">' +
  '<dxf><font><b/><color rgb="FF1C7A55"/></font><fill><patternFill><bgColor rgb="FFDDF0E7"/></patternFill></fill></dxf>' +
  '<dxf><font><color rgb="FF4A4F57"/></font><fill><patternFill><bgColor rgb="FFECEDEF"/></patternFill></fill></dxf>' +
  '<dxf><font><b/><color rgb="FF8A5A00"/></font><fill><patternFill><bgColor rgb="FFFBEFD2"/></patternFill></fill></dxf>' +
  '</dxfs><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>';

class XlsxBook {
  constructor() { this.sst = new Map(); this.sstN = 0; this.sheets = []; this.names = []; this.chunks = []; this.enc = new TextEncoder(); }
  si(s) { let i = this.sst.get(s); if (i === undefined) { i = this.sst.size; this.sst.set(s, i); } this.sstN++; return i; }
  /* sheet: {name, cols:[widths], freeze:{row, col}, filterRef, cf:[{sqref, rules:[{eq, dxf}]}], dv:[{sqref, list}], tab, rows: (emit) => Promise}
     emit(cells, opts) grava uma linha: cells = array de valores ou {v, s, f} */
  addSheet(sh) { this.sheets.push(sh); }
  async build(onProgress) {
    const zipChunks = []; let err = null;
    const zip = new fflate.Zip((e, data) => { if (e) err = e; else zipChunks.push(data); });
    const addText = (path, text) => { const f = new fflate.ZipDeflate(path, { level: 6 }); zip.add(f); f.push(this.enc.encode(text), true); };
    for (let si = 0; si < this.sheets.length; si++) {
      const sh = this.sheets[si];
      if (!sh.rows) continue; // continuação de uma aba dividida: já gravada junto com a primeira parte
      let f, buf = [], bufLen = 0, r = 0, cur = sh, idx = si, parte = 1, cab = null;
      const flush = (final) => { if (buf.length || final) { f.push(this.enc.encode(buf.join('')), !!final); buf = []; bufLen = 0; } };
      const w = s => { buf.push(s); bufLen += s.length; if (bufLen > 1 << 20) flush(false); };
      const abrir = (o, i) => {
        f = new fflate.ZipDeflate('xl/worksheets/sheet' + (i + 1) + '.xml', { level: 1 }); zip.add(f); r = 0;
        let head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
        if (o.tab) head += '<sheetPr><tabColor rgb="' + o.tab + '"/></sheetPr>';
        head += '<sheetViews><sheetView workbookViewId="0"' + (i === 0 ? ' tabSelected="1"' : '') + (o.zoom ? ' zoomScale="' + o.zoom + '"' : '') + (o.grid === false ? ' showGridLines="0"' : '') + '>';
        if (o.freeze) {
          const { row = 0, col = 0 } = o.freeze, tl = colName(col) + (row + 1);
          const pane = row && col ? 'bottomRight' : row ? 'bottomLeft' : 'topRight';
          head += '<pane' + (col ? ' xSplit="' + col + '"' : '') + (row ? ' ySplit="' + row + '"' : '') + ' topLeftCell="' + tl + '" activePane="' + pane + '" state="frozen"/><selection pane="' + pane + '" activeCell="' + tl + '" sqref="' + tl + '"/>';
        }
        head += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
        if (o.cols && o.cols.some(wd => wd != null)) head += '<cols>' + o.cols.map((wd, i) => wd == null ? '' : '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + wd + '" customWidth="1"' + (o.colStyles && o.colStyles[i] ? ' style="' + o.colStyles[i] + '"' : '') + '/>').join('') + '</cols>';
        w(head + '<sheetData>');
      };
      const fechar = (o) => {
        // numa aba dividida, filtro, validação e formatação condicional vão só até a última linha desta parte
        const ate = ref => o.split ? String(ref).replace(/(\$?[A-Z]+\$?)(\d+)(?=\s|$)/g, (m, c, n, off, all) => all.indexOf(':') >= 0 && off > all.indexOf(':') ? c + Math.min(+n, r) : m) : ref;
        let tail = '</sheetData>';
        if (o.filterRef) { o.filterRef = ate(o.filterRef); tail += '<autoFilter ref="' + o.filterRef + '"/>'; }
        if (o.merges && o.merges.length) tail += '<mergeCells count="' + o.merges.length + '">' + o.merges.map(m => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>';
        let prio = 1;
        for (const cf of (o.cf || [])) tail += '<conditionalFormatting sqref="' + ate(cf.sqref) + '">' + cf.rules.map(rl => '<cfRule type="cellIs" dxfId="' + rl.dxf + '" priority="' + (prio++) + '" operator="equal"><formula>' + xmlEsc('"' + rl.eq + '"') + '</formula></cfRule>').join('') + '</conditionalFormatting>';
        if (o.dv && o.dv.length) tail += '<dataValidations count="' + o.dv.length + '">' + o.dv.map(d => '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Classificação" error="Escolha um valor da lista." sqref="' + ate(d.sqref) + '"><formula1>' + xmlEsc('"' + d.list.join(',') + '"') + '</formula1></dataValidation>').join('') + '</dataValidations>';
        tail += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>';
        if (o.landscape) tail += '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
        tail += '<ignoredErrors><ignoredError sqref="A1:XFD1048576" numberStoredAsText="1"/></ignoredErrors>'; // sem o triângulo verde em CNPJ, NCM, CFOP (texto de propósito)
        w(tail + '</worksheet>');
        flush(true);
        o.lastRow = r;
      };
      const gravar = (cells, o) => {
        r++;
        let x = '<row r="' + r + '"' + (o && o.ht ? ' ht="' + o.ht + '" customHeight="1"' : '') + '>';
        for (let c = 0; c < cells.length; c++) {
          let cell = cells[c]; if (cell == null || cell === '') continue;
          let s = o && o.s != null ? (Array.isArray(o.s) ? o.s[c] : o.s) : 0, v = cell, fm = null;
          if (typeof cell === 'object' && !(cell instanceof Date)) { v = cell.v; if (cell.s != null) s = cell.s; fm = cell.f || null; }
          const ref = colName(c) + r, sa = s ? ' s="' + s + '"' : '';
          if (cell === BLANK) { x += '<c r="' + ref + '"' + sa + ' t="s"><v>' + this.si('') + '</v></c>'; continue; } // texto vazio, como vem do SistemaMA
          if (cell.e) { x += '<c r="' + ref + '"' + sa + '/>'; continue; } // só o formato
          if (fm) {
            if (typeof v === 'string') x += '<c r="' + ref + '"' + sa + ' t="str"><f>' + xmlEsc(fm) + '</f><v>' + xmlEsc(v) + '</v></c>';
            else x += '<c r="' + ref + '"' + sa + '><f>' + xmlEsc(fm) + '</f>' + (v != null && isFinite(v) ? '<v>' + v + '</v>' : '') + '</c>';
          } else if (typeof v === 'number') { if (isFinite(v)) x += '<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>'; }
          else if (v instanceof Date) x += '<c r="' + ref + '"' + sa + '><v>' + serial(v.getFullYear(), v.getMonth() + 1, v.getDate()) + '</v></c>';
          else if (typeof v === 'boolean') x += '<c r="' + ref + '"' + sa + ' t="b"><v>' + (v ? 1 : 0) + '</v></c>';
          else { const str = String(v); if (str !== '') x += '<c r="' + ref + '"' + sa + ' t="s"><v>' + this.si(str) + '</v></c>'; }
        }
        w(x + '</row>');
        return r;
      };
      // aba com split: ao chegar no limite do Excel (XL_DADOS linhas de dados), fecha esta parte e continua em "NOME (2)"…
      // com o cabeçalho repetido. A última linha da aba fica livre para a linha de totais.
      const cheia = () => cur.split && cab && r >= XL_DADOS + 1;
      const virar = () => {
        fechar(cur);
        parte++;
        const nova = Object.assign({}, sh, { name: parteNome(sh.name, parte), rows: null, parteDe: sh.name, filterRef: sh.filterRef, dv: sh.dv, cf: sh.cf });
        this.sheets.splice(idx + 1, 0, nova); idx++; cur = nova;
        abrir(cur, idx);
        gravar(cab.cells, cab.o);
      };
      const emit = (cells, o) => {
        if (!cab && cur.split) cab = { cells, o };
        else if (cheia()) virar();
        return gravar(cells, o);
      };
      emit.proxima = () => cheia() ? 2 : r + 1; // número da linha que a próxima chamada de emit vai gravar
      abrir(cur, idx);
      await sh.rows(emit, async (msg) => { if (onProgress) onProgress(cur.name, msg); await tick(); });
      fechar(cur);
      if (parte > 1) sh.partes = parte;
      await tick();
    }
    // strings compartilhadas
    {
      const f = new fflate.ZipDeflate('xl/sharedStrings.xml', { level: 6 }); zip.add(f);
      let parts = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + this.sstN + '" uniqueCount="' + this.sst.size + '">'];
      let n = 0;
      for (const s of this.sst.keys()) {
        parts.push('<si><t' + (/^\s|\s$/.test(s) ? ' xml:space="preserve"' : '') + '>' + xmlEsc(s) + '</t></si>');
        if (++n % 20000 === 0) { f.push(this.enc.encode(parts.join('')), false); parts = []; }
      }
      parts.push('</sst>'); f.push(this.enc.encode(parts.join('')), true);
    }
    addText('xl/styles.xml', STYLES_XML);
    // tabelas dinâmicas: um cache por aba de origem, uma tabela por aba de dinâmica
    for (const sh of this.sheets) if (sh.pivot && sh.pivot.cache.recs.length > XL_DADOS) { sh.pivot = null; sh.estatica = true; const orig = sh.rows; sh.rows = async (emit, y) => { await orig(emit, y); emit([]); emit([{ v: 'Base com mais de 1.048.576 linhas (limite do Excel por aba): dividida em várias abas. Esta tabela traz os valores já somados de todas elas; não é uma dinâmica atualizável.', s: XS.note }]); }; }
    const pivs = this.sheets.map((sh, i) => ({ sh, i })).filter(x => x.sh.pivot), caches = [];
    for (const { sh } of pivs) if (!caches.includes(sh.pivot.cache)) caches.push(sh.pivot.cache);
    caches.forEach((c, k) => { c.id = k + 1; addText('xl/pivotCache/pivotCacheDefinition' + c.id + '.xml', c.xml()); });
    pivs.forEach(({ sh, i }, k) => {
      const n = k + 1, R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
      addText('xl/pivotTables/pivotTable' + n + '.xml', sh.pivot.xml(sh.pivot.cache.id));
      addText('xl/pivotTables/_rels/pivotTable' + n + '.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + 'pivotCacheDefinition" Target="../pivotCache/pivotCacheDefinition' + sh.pivot.cache.id + '.xml"/></Relationships>');
      addText('xl/worksheets/_rels/sheet' + (i + 1) + '.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + 'pivotTable" Target="../pivotTables/pivotTable' + n + '.xml"/></Relationships>');
    });
    const defs = [];
    this.sheets.forEach((sh, i) => { if (sh.filterRef) defs.push('<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">' + "'" + sh.name + "'!" + sh.filterRef.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2') + '</definedName>'); });
    for (const d of this.names) defs.push('<definedName name="' + d.name + '">' + xmlEsc(d.ref) + '</definedName>');
    addText('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000" activeTab="0"/></bookViews><sheets>' +
      this.sheets.map((sh, i) => '<sheet name="' + xmlEsc(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets>' +
      (defs.length ? '<definedNames>' + defs.join('') + '</definedNames>' : '') + '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
      (caches.length ? '<pivotCaches>' + caches.map(c => '<pivotCache cacheId="' + c.id + '" r:id="rIdPc' + c.id + '"/>').join('') + '</pivotCaches>' : '') + '</workbook>');
    const n = this.sheets.length;
    addText('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      this.sheets.map((sh, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId' + (n + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
      caches.map(c => '<Relationship Id="rIdPc' + c.id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition' + c.id + '.xml"/>').join('') + '</Relationships>');
    addText('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
    const iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    addText('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xmlEsc(this.title || 'Revisor Fiscal') + '</dc:title><dc:creator>Revisor Fiscal</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:modified></cp:coreProperties>');
    addText('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>');
    addText('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      this.sheets.map((sh, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      caches.map(c => '<Override PartName="/xl/pivotCache/pivotCacheDefinition' + c.id + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml"/>').join('') +
      pivs.map((x, k) => '<Override PartName="/xl/pivotTables/pivotTable' + (k + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml"/>').join('') +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
    zip.end();
    if (err) throw err;
    return new Blob(zipChunks, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}


/* ===================== tabelas dinâmicas de verdade (pivot tables) ===================== */
/* O cache aponta para o intervalo da aba de origem e é atualizado ao abrir (refreshOnLoad), sem guardar cópia dos
   registros (saveData="0"): o arquivo não dobra de tamanho e o Excel recalcula a dinâmica a partir da base.
   As células da dinâmica já saem preenchidas no layout compacto do Excel, para quem abre no modo protegido. */
const pvKey = v => v == null || v === '' ? '\u0000' : (typeof v === 'number' ? 'n' : 's') + v;
const pvNorm = v => v == null || v === '' ? null : v instanceof Date ? serial(v.getFullYear(), v.getMonth() + 1, v.getDate()) : (typeof v === 'boolean' ? (v ? 1 : 0) : v);
const pvCmp = (a, b) => a == null ? (b == null ? 0 : 1) : b == null ? -1 : typeof a === typeof b ? (typeof a === 'number' ? a - b : String(a).localeCompare(String(b), 'pt-BR', { numeric: true })) : (typeof a === 'number' ? -1 : 1);
const pvCmpMes = (a, b) => { const k = v => { const m = /^(\d{1,2})\/(\d{4})$/.exec(String(v || '')); return m ? +m[2] * 100 + +m[1] : 9e9; }; return k(a) - k(b) || pvCmp(a, b); };

class PivotCache {
  constructor(sheet, headers, recs, val, opt) {
    this.sheet = sheet; this.recs = recs; this.val = val; this.axis = new Map(); this.data = new Set();
    this.blankEmpty = !!(opt && opt.blankEmpty); // abas com texto vazio nas células vazias: o rótulo da dinâmica fica em branco, não "(vazio)"
    const seen = new Set();
    this.names = headers.map((h, i) => { const b = String(h == null ? '' : h).trim() || 'Coluna ' + (i + 1); let n = b, k = 2; while (seen.has(n.toLowerCase())) n = b + (k++); seen.add(n.toLowerCase()); return n; });
    this.ref = 'A1:' + colName(headers.length - 1) + (recs.length + 1);
  }
  norm(v) { return this.blankEmpty && (v == null || v === '') ? '' : pvNorm(v); }
  distinct(fi) { const m = new Map(); for (const r of this.recs) { const v = this.norm(this.val(r, fi)), k = pvKey(v); if (!m.has(k)) m.set(k, v); } return [...m.values()]; }
  setAxis(fi, items) { const idx = new Map(); items.forEach((v, i) => idx.set(pvKey(v), i)); this.axis.set(fi, { items, idx }); }
  typeAttrs(vals, withCount) {
    let str = 0, num = 0, blank = 0, int = true, mn = Infinity, mx = -Infinity;
    for (const v of vals) { if (v == null) blank++; else if (typeof v === 'number') { num++; if (!Number.isInteger(v)) int = false; if (v < mn) mn = v; if (v > mx) mx = v; } else str++; }
    let a = '';
    if (num && !str) a = (blank ? '' : ' containsSemiMixedTypes="0"') + ' containsString="0"' + (blank ? ' containsBlank="1"' : '') + ' containsNumber="1"' + (int ? ' containsInteger="1"' : '') + ' minValue="' + mn + '" maxValue="' + mx + '"';
    else if (num && str) a = ' containsMixedTypes="1"' + (blank ? ' containsBlank="1"' : '') + ' containsNumber="1"' + (int ? ' containsInteger="1"' : '') + ' minValue="' + mn + '" maxValue="' + mx + '"';
    else if (blank) a = ' containsBlank="1"';
    return a + (withCount ? ' count="' + vals.length + '"' : '');
  }
  fieldXml(fi) {
    const nm = '<cacheField name="' + xmlEsc(this.names[fi]) + '" numFmtId="0">', ax = this.axis.get(fi);
    if (ax) return nm + '<sharedItems' + this.typeAttrs(ax.items, true) + '>' + ax.items.map(v => v == null ? '<m/>' : typeof v === 'number' ? '<n v="' + v + '"/>' : '<s v="' + xmlEsc(v) + '"/>').join('') + '</sharedItems></cacheField>';
    if (this.data.has(fi)) { const vals = this.recs.map(r => { const v = pvNorm(this.val(r, fi)); return this.blankEmpty && v == null ? '' : v; }); return nm + '<sharedItems' + this.typeAttrs(vals, false) + '/></cacheField>'; }
    return nm + '<sharedItems/></cacheField>';
  }
  xml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" saveData="0" refreshOnLoad="1" createdVersion="6" refreshedVersion="6" minRefreshableVersion="3" recordCount="' + this.recs.length + '">' +
      '<cacheSource type="worksheet"><worksheetSource ref="' + this.ref + '" sheet="' + xmlEsc(this.sheet) + '"/></cacheSource><cacheFields count="' + this.names.length + '">' +
      this.names.map((n, fi) => this.fieldXml(fi)).join('') + '</cacheFields></pivotCacheDefinition>';
  }
}

/* Tabela dinâmica no layout compacto (padrão do Excel): até 2 campos de linha, filtros de relatório e N valores (Soma).
   spec: { name, rows: [fi, fi?], page: [fi], data: [{ fi, name }], sortDesc, order: { fi: cmp }, note } */
function pivotSheet(cache, spec) {
  const R = spec.rows, P = spec.page || [], D = spec.data, val = cache.val;
  D.forEach(d => cache.data.add(d.fi));
  const top = new Map(), grand = D.map(() => 0);
  for (const rec of cache.recs) {
    const sums = D.map(d => { const v = val(rec, d.fi); return typeof v === 'number' && isFinite(v) ? v : 0; });
    const v1 = cache.norm(val(rec, R[0])), k1 = pvKey(v1);
    let a = top.get(k1); if (!a) top.set(k1, a = { v: v1, s: D.map(() => 0), kids: new Map() });
    for (let i = 0; i < sums.length; i++) { a.s[i] += sums[i]; grand[i] += sums[i]; }
    if (R.length > 1) {
      const v2 = cache.norm(val(rec, R[1])), k2 = pvKey(v2);
      let b = a.kids.get(k2); if (!b) a.kids.set(k2, b = { v: v2, s: D.map(() => 0) });
      for (let i = 0; i < sums.length; i++) b.s[i] += sums[i];
    }
  }
  for (const fi of R.concat(P)) {
    if (cache.axis.has(fi)) continue;
    let items = cache.distinct(fi);
    if (fi === R[0] && (spec.sortDesc || spec.sortAsc)) { const sb = spec.sortBy || 0, tot = v => { const a = top.get(pvKey(v)); return a ? a.s[sb] : -Infinity; }; items.sort((a, b) => spec.sortAsc ? tot(a) - tot(b) : tot(b) - tot(a)); } // empate: ordem em que aparece na aba (como o Excel)
    else items.sort((spec.order && spec.order[fi]) || pvCmp);
    cache.setAxis(fi, items);
  }
  const ax1 = cache.axis.get(R[0]), ax2 = R.length > 1 ? cache.axis.get(R[1]) : null;
  const lines = [];
  for (const a of [...top.values()].sort((p, q) => ax1.idx.get(pvKey(p.v)) - ax1.idx.get(pvKey(q.v)))) {
    lines.push({ lvl: 0, v: a.v, s: a.s, x: ax1.idx.get(pvKey(a.v)) });
    if (ax2) for (const b of [...a.kids.values()].sort((p, q) => ax2.idx.get(pvKey(p.v)) - ax2.idx.get(pvKey(q.v)))) lines.push({ lvl: 1, v: b.v, s: b.s, x: ax2.idx.get(pvKey(b.v)) });
  }
  lines.push({ grand: true, s: grand });
  const L = spec.top ? 1 : P.length ? P.length + 2 : 3, nD = D.length, nf = spec.numFmt || 164;
  const X = k => k ? '<x v="' + k + '"/>' : '<x/>';
  const xml = cacheId => {
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><pivotTableDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" name="' + xmlEsc(spec.name) + '" cacheId="' + cacheId + '" applyNumberFormats="0" applyBorderFormats="0" applyFontFormats="0" applyPatternFormats="0" applyAlignmentFormats="0" applyWidthHeightFormats="1" dataCaption="Valores" updatedVersion="6" minRefreshableVersion="3" useAutoFormatting="1" itemPrintTitles="1" createdVersion="6" indent="0" outline="1" outlineData="1" multipleFieldFilters="0">';
    x += '<location ref="A' + L + ':' + colName(nD) + (L + lines.length) + '" firstHeaderRow="' + (nD > 1 ? 0 : 1) + '" firstDataRow="1" firstDataCol="1"' + (P.length ? ' rowPageCount="' + P.length + '" colPageCount="1"' : '') + '/>';
    x += '<pivotFields count="' + cache.names.length + '">';
    for (let fi = 0; fi < cache.names.length; fi++) {
      const isRow = R.includes(fi), isPage = P.includes(fi);
      if (isRow || isPage) {
        const its = cache.axis.get(fi).items, srt = isRow && fi === R[0] && (spec.sortDesc || spec.sortAsc);
        x += '<pivotField axis="' + (isRow ? 'axisRow' : 'axisPage') + '" showAll="0"' + (srt ? ' sortType="' + (spec.sortAsc ? 'ascending' : 'descending') + '"' : '') + '><items count="' + (its.length + 1) + '">' + its.map((v, i) => '<item x="' + i + '"/>').join('') + '<item t="default"/></items>' +
          (srt ? '<autoSortScope><pivotArea dataOnly="0" outline="0" fieldPosition="0"><references count="1"><reference field="4294967294" count="1" selected="0"><x v="' + (spec.sortBy || 0) + '"/></reference></references></pivotArea></autoSortScope>' : '') + '</pivotField>';
      } else x += D.some(d => d.fi === fi) ? '<pivotField dataField="1" showAll="0"/>' : '<pivotField showAll="0"/>';
    }
    x += '</pivotFields><rowFields count="' + R.length + '">' + R.map(fi => '<field x="' + fi + '"/>').join('') + '</rowFields>';
    x += '<rowItems count="' + lines.length + '">' + lines.map(l => l.grand ? '<i t="grand"><x/></i>' : l.lvl ? '<i r="1">' + X(l.x) + '</i>' : '<i>' + X(l.x) + '</i>').join('') + '</rowItems>';
    x += nD > 1 ? '<colFields count="1"><field x="-2"/></colFields><colItems count="' + nD + '">' + D.map((d, i) => i ? '<i i="' + i + '"><x v="' + i + '"/></i>' : '<i><x/></i>').join('') + '</colItems>' : '<colItems count="1"><i/></colItems>';
    if (P.length) x += '<pageFields count="' + P.length + '">' + P.map(fi => '<pageField fld="' + fi + '" hier="-1"/>').join('') + '</pageFields>';
    x += '<dataFields count="' + nD + '">' + D.map(d => '<dataField name="' + xmlEsc(d.name) + '" fld="' + d.fi + '" baseField="0" baseItem="0" numFmtId="' + nf + '"/>').join('') + '</dataFields>';
    x += '<pivotTableStyleInfo name="PivotStyleLight16" showRowHeaders="1" showColHeaders="1" showRowStripes="0" showColStripes="0" showLastColumn="1"/>';
    x += '<extLst><ext uri="{962EF5D1-5CA2-4c93-8EF4-DBF5C05439D2}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:pivotTableDefinition hideValuesRow="1" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"/></ext></extLst></pivotTableDefinition>';
    return x;
  };
  const vS = nf === 165 ? XS.eBrl : XS.brl, tS = nf === 165 ? XS.eTotB : XS.brlTot;
  const rows = async (emit) => {
    if (!spec.top) {
      const noteCell = spec.note ? { v: spec.note, s: XS.note } : null;
      if (P.length) P.forEach((fi, i) => { const c = [{ v: cache.names[fi], s: XS.bold }, '(Tudo)']; if (i === 0 && noteCell) { c[nD + 2] = noteCell; } emit(c); });
      else emit(noteCell ? [noteCell] : []);
      emit([]);
    }
    emit([{ v: 'Rótulos de Linha', s: XS.bold }].concat(D.map(d => ({ v: d.name, s: XS.bold }))));
    for (const l of lines) {
      if (l.grand) { emit([{ v: 'Total Geral', s: XS.txtB }].concat(l.s.map(v => ({ v: r2(v), s: tS })))); continue; }
      const lab = l.v == null ? '(vazio)' : l.v, sub = ax2 && !l.lvl;
      emit([{ v: lab, s: l.lvl ? XS.ind : (sub ? XS.bold : 0) }].concat(l.s.map(v => ({ v: r2(v), s: sub ? XS.brlB : vS }))));
    }
  };
  return { rows, pivot: { cache, xml }, lines: lines.length };
}

/* ---------- monta a pasta de trabalho de trabalho da revisão ---------- */
async function buildWorkbook(onProgress) {
  const B = new XlsxBook(), sai = S.tipo === 'SAI';
  const H = S.headers, hk = S.hkey, off = S.hasAnoMes ? 0 : 2;
  const BASE = MODE.base, ALVO = MODE.alvo, OUTRA = MODE.outra, APUR = MODE.apurado;
  B.title = 'Revisão PIS/COFINS - ' + MODE.nome + ' - ' + (S.empresa.nome || fmtCNPJ(S.empresa.cnpj));
  // colunas da base: ano e mês (texto, como =TEXTO(Período;"aaaa") e =TEXTO(Período;"mm/aaaa")) + as originais, na ordem do SistemaMA
  const LY = LAYOUT[sai ? 'SAI' : 'ENT'];
  const baseCols = [];
  if (!S.hasAnoMes) { baseCols.push({ h: LY.ano, k: 'ano', type: 'txt', hl: LY.hl.includes('ano') }, { h: LY.mes, k: 'mes', type: 'txt', hl: LY.hl.includes('mes') }); }
  H.forEach((h, i) => {
    const k = hk[i];
    let type = 'gen';
    if (/^vlr /.test(k)) type = 'brl';
    else if (/^aliquota/.test(k) || /^qtde/.test(k)) type = 'dec';
    else if (/^data |^periodo$/.test(k)) type = 'date';
    else if (TEXT_COLS.includes(k)) type = 'txt';
    baseCols.push({ h: h || ('Coluna ' + (i + 1)), i, k, type, hl: LY.hl.includes(k), cur: LY.cur.includes(k), tot: LY.tot.includes(k) });
  });
  // formatação igual à da analista: bordas finas em todas as células, cabeçalho em negrito (todo em cinza na 047),
  // cinza só nas colunas-chave, Moeda nas colunas de valor; as demais no formato Geral
  const styleOf = c => c.cur ? (c.hl ? XS.eBrlHl : XS.eBrlB) : (c.hl ? XS.bGenHl : XS.bGen);
  const curCol = c => c.cur && (!LY.curCol || LY.curCol.includes(c.k)); // coluna inteira em Moeda (o cabeçalho vai junto)
  const headOf = c => LY.headHl ? (curCol(c) ? XS.eHeadBrl : XS.bHeadHl) : (c.hl ? XS.bHeadHl : XS.bHead);
  const fmtD = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  // valor como veio da exportação (datas em texto dd/mm/aaaa, vazios como texto vazio); a análise usa o valor convertido
  const valOf = (rec, c) => {
    if (c.k === 'ano') return String(rec.ano); if (c.k === 'mes') return rec.mes;
    let v = rec.v[c.i];
    if (v == null) return null;
    if (c.type === 'brl' || c.type === 'dec') return typeof v === 'number' ? v : (v === '' ? null : toNum(v));
    if (c.type === 'date') return v instanceof Date ? fmtD(v) : typeof v === 'number' ? (() => { const d = new Date(Math.round((v - 25569) * 864e5)); return fmtD(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); })() : v;
    if (c.type === 'txt' && typeof v === 'number') { if (c.k === 'ncm') return digits(v, 8); if (c.k === 'cfop') return digits(v); return String(v); }
    return v;
  };
  const cellOf = (rec, c) => { const v = valOf(rec, c); return v == null || v === '' ? BLANK : v; };
  const colIdx = key => baseCols.findIndex(c => c.i === S.map[key]);
  const baseStyles = baseCols.map(styleOf), baseHead = baseCols.map(headOf);
  const N = S.recs.length;
  const totIdx = baseCols.map((c, i) => c.tot ? i : -1).filter(i => i >= 0);
  const per = ymLabel(S.months[0].ym) + ' a ' + ymLabel(S.months[S.months.length - 1].ym);
  const T_ = (ent, sa) => sai ? sa : ent;
  const fmtW = v => 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // largura das colunas em Moeda como o "auto ajuste" do Excel (as demais ficam no padrão, como no arquivo da equipe)
  const curWidth = (list, ci) => { let mx = 0, sum = 0; for (const rec of list) { const v = valOf(rec, baseCols[ci]); if (typeof v === 'number') { sum += v; if (Math.abs(v) > mx) mx = Math.abs(v); } } if (baseCols[ci].tot) mx = Math.max(mx, Math.abs(sum)); return Math.max(10.71, (LY.minW && LY.minW[baseCols[ci].k]) || 0, +(fmtW(mx).length - 0.57).toFixed(2)); };
  const baseW = baseCols.map((c, i) => c.cur ? curWidth(S.recs, i) : null); // as abas NOTAS são cópias da base: mesmas larguras

  // ---------- abas de dados (BASE, NOTAS COM PC, NOTAS SEM PC) ----------
  const lastCol = colName(baseCols.length - 1);
  const dataSheet = (name, list, comTotal) => {
    const n = list.length, cols = baseW;
    return {
      name, grid: false, cols, colStyles: baseCols.map(c => curCol(c) ? XS.eBrl : 0), split: true, filterRef: 'A1:' + lastCol + (n + (comTotal ? 2 : 1)), landscape: true,
      rows: async (emit, yieldp) => {
        emit(baseCols.map(c => c.h), { s: baseHead });
        for (let k = 0; k < n; k++) {
          emit(baseCols.map(c => cellOf(list[k], c)), { s: baseStyles });
          if (k % 4000 === 3999) await yieldp(Math.round(k / n * 100));
        }
        if (!comTotal) return;
        // AutoSoma logo abaixo da última linha, nas colunas de valor (como a analista: =SOMA(X1:Xn), a primeira sem borda)
        const tot = [];
        totIdx.forEach((ci, j) => {
          let sum = 0; for (const rec of list) { const v = valOf(rec, baseCols[ci]); if (typeof v === 'number') sum += v; }
          tot[ci] = { v: r2(sum), f: n > XL_DADOS ? null : 'SUM(' + colName(ci) + '1:' + colName(ci) + (n + 1) + ')', s: j ? XS.eHeadBrl : XS.eTotHl };
        });
        if (LY.headHl && totIdx.length > 2) for (let ci = totIdx[1] + 1; ci < totIdx[totIdx.length - 1]; ci++) if (!tot[ci]) tot[ci] = { e: 1, s: XS.eTotB };
        emit(tot);
      }
    };
  };

  // ---------- aba classificada: CLASSIF. ao lado do NCM ----------
  // ENT: é a própria NOTAS SEM PC (como no vídeo). SAI: a NOTAS COM PC fica igual à da analista e a classificação vai para a
  // aba extra ITENS A RECUPERAR, só com as vendas marcadas RECUPERAR ou AVALIAR (as CORRETO ficam de fora).
  const ncmPos = colIdx('ncm');
  const semCols = baseCols.slice(0, ncmPos + 1).concat([{ h: 'CLASSIF.', k: 'cls', type: 'cls' }], baseCols.slice(ncmPos + 1));
  const extra = sai ? ['MOTIVO', 'FUNDAMENTO', 'CONFIANÇA', 'ORIGEM DA REGRA', 'REGIME DO MÊS', 'BASE A RECUPERAR', 'PIS A RECUPERAR', 'COFINS A RECUPERAR', 'LINHA NA ABA NOTAS COM PC']
    : ['MOTIVO', 'FUNDAMENTO', 'CONFIANÇA', 'ORIGEM DA REGRA', 'REGIME DO MÊS', 'BASE DO CRÉDITO', 'PIS POTENCIAL', 'COFINS POTENCIAL'];
  const SL = key => colName(semCols.findIndex(c => c.i === S.map[key]));
  const cCls = colName(ncmPos + 1), cReg = colName(semCols.length + 4), cBase = colName(semCols.length + 5), cPis = colName(semCols.length + 6), cCof = colName(semCols.length + 7);
  const mesPos = semCols.findIndex(c => c.k === 'mes'), cMes = mesPos >= 0 ? colName(mesPos) : null;
  const cPer = S.map.periodo != null ? SL('periodo') : null, cItem = SL('vlrItem'), cDesc = S.map.vlrDesc != null ? SL('vlrDesc') : null, cIcms = S.map.vlrIcms != null ? SL('vlrIcms') : null;
  const CLSHEET = sai ? 'ITENS A RECUPERAR' : ALVO;
  const linhaCom = sai ? new Map(S.alvo.map((r, k) => [r, k < XL_DADOS ? k + 2 : (k % XL_DADOS + 2) + ' (aba ' + (Math.floor(k / XL_DADOS) + 1) + ')'])) : null;
  const alvo = sai ? S.alvo.filter(r => clsOf(r) !== CLS.SEM) : S.alvo, aN = alvo.length;
  const semStyles = semCols.map(c => c.type === 'cls' ? XS.bGen : styleOf(c)).concat([XS.bWrap, XS.bWrap, XS.bGen, XS.bGen, XS.bGen, XS.eBrlB, XS.eBrlB, XS.eBrlB, XS.bGen]);
  const semHead = semCols.map(c => c.type === 'cls' ? (LY.headHl ? XS.bHeadHl : XS.bHead) : headOf(c)).concat(extra.map(() => LY.headHl ? XS.bHeadHl : XS.bHead));
  const semTot = semCols.map((c, i) => c.tot ? i : -1).filter(i => i >= 0);
  const regTxt = mo => !mo ? '' : mo.regime === 'NC' ? 'NÃO CUMULATIVO' : sai ? (mo.regime === 'CUM' ? 'CUMULATIVO' : 'SEM DÉBITO') : 'SEM APURAÇÃO NC';
  // a partir de 05/2023 (Lei 14.592/2023), pela coluna mês (texto mm/aaaa: vale para o Excel em qualquer idioma)
  const desde0523 = row => cMes ? '(VALUE(RIGHT(' + cMes + row + ',4))*100+VALUE(LEFT(' + cMes + row + ',2)))>=202305' : 'DATEVALUE(' + cPer + row + ')>=DATE(2023,5,1)';
  const semColW = semCols.map(c => c.type === 'cls' ? 16 : c.cur ? baseW[baseCols.indexOf(c)] : null).concat([46, 40, 11, 14, 16, 15, 14, 15].concat(sai ? [12] : []));
  const lastSem = colName(semCols.length + extra.length - 1);
  const alvoSheet = {
    name: CLSHEET, grid: false, cols: semColW, colStyles: semCols.map(c => c.type !== 'cls' && curCol(c) ? XS.eBrl : 0),
    split: true, tab: sai ? 'FF9E6846' : null, freeze: sai ? { row: 1 } : null, filterRef: 'A1:' + lastSem + (aN + 2), landscape: true,
    dv: aN ? [{ sqref: cCls + '2:' + cCls + (aN + 1), list: [CLS.COM, CLS.SEM, CLS.AVA] }] : [],
    rows: async (emit, yieldp) => {
      emit(semCols.map(c => c.h).concat(extra), { s: semHead });
      for (let k = 0; k < aN; k++) {
        const rec = alvo[k], row = emit.proxima(), cls = clsOf(rec), g = rec.g, mo = S.monthIdx.get(rec.ym), c = creditOf(rec);
        const cells = semCols.map(col => col.type === 'cls' ? cls : cellOf(rec, col));
        const sug = g.sug, by = rec.ov || g.dec ? (cls === sug.cls ? sug : null) : sug;
        let fB, fP, fC;
        if (sai) {
          const ok = cCls + row + '="' + CLS.COM + '"';
          fB = 'IF(' + ok + ',' + SL('bcPis') + row + ',0)'; fP = 'IF(' + ok + ',' + SL('vlrPis') + row + ',0)'; fC = 'IF(' + ok + ',' + SL('vlrCof') + row + ',0)';
        } else {
          fB = 'IF(AND(' + cCls + row + '="' + CLS.COM + '",' + cReg + row + '="NÃO CUMULATIVO"),MAX(0,N(' + cItem + row + ')' + (cDesc ? '-N(' + cDesc + row + ')' : '') + (cIcms && (cMes || cPer) ? '-IF(AND(ExcluirICMS,' + desde0523(row) + '),N(' + cIcms + row + '),0)' : '') + '),0)';
          fP = 'ROUND(' + cBase + row + '*1.65%,2)'; fC = 'ROUND(' + cBase + row + '*7.6%,2)';
        }
        cells.push(by ? by.motivo : 'Decisão do analista', by ? by.lei : '', by ? CONF[by.conf] : '—', rec.ov || g.dec ? 'Analista' : sug.origem, regTxt(mo),
          { v: c ? c.base : 0, f: fB }, { v: c ? c.pis : 0, f: fP }, { v: c ? c.cof : 0, f: fC });
        if (sai) cells.push(linhaCom.get(rec) || '');
        emit(cells, { s: semStyles });
        if (k % 4000 === 3999) await yieldp(Math.round(k / aN * 100));
      }
      const tot = [];
      semTot.forEach((ci, j) => { let sum = 0; for (const rec of alvo) { const v = valOf(rec, semCols[ci]); if (typeof v === 'number') sum += v; } tot[ci] = { v: r2(sum), f: aN > XL_DADOS ? null : 'SUM(' + colName(ci) + '1:' + colName(ci) + (aN + 1) + ')', s: j ? XS.eHeadBrl : XS.eTotHl }; });
      for (let key = 0; key < 3; key++) { const ci = semCols.length + 5 + key; let sum = 0; for (const rec of alvo) { const c = creditOf(rec); if (c) sum += [c.base, c.pis, c.cof][key]; } tot[ci] = { v: r2(sum), f: aN > XL_DADOS ? null : 'SUM(' + colName(ci) + '2:' + colName(ci) + (aN + 1) + ')', s: XS.eHeadBrl }; }
      emit(tot);
    }
  };

  // ---------- tabelas dinâmicas ----------
  const fA = baseCols.findIndex(c => c.k === 'ano'), fM = baseCols.findIndex(c => c.k === 'mes');
  const fReg = colIdx('registro'), fBc = colIdx('bcPis'), fPis = colIdx('vlrPis'), fCof = colIdx('vlrCof');
  const heads = baseCols.map(c => c.h), bval = (rec, fi) => valOf(rec, baseCols[fi]);
  // Base acima do limite do Excel: cada parte ("NOME (2)"…) ganha as mesmas tabelas dinâmicas da parte 1, sobre os dados
  // dela, com um aviso embaixo. Com uma parte só, tudo fica exatamente como antes (mesmos nomes e caches).
  const fatias = (nome, list) => { const q = Math.max(1, Math.ceil(list.length / XL_DADOS)); return partesDe(nome, list.length).map((pt, k) => ({ nome: pt.nome, k: k + 1, q, recs: q > 1 ? list.slice(k * XL_DADOS, k * XL_DADOS + pt.linhas) : list })); };
  const comAviso = (sh, f, nome, n) => {
    if (f.q < 2) return sh;
    const txt = 'Atenção: parte ' + f.k + ' de ' + f.q + '. Esta tabela dinâmica usa só os dados da aba "' + f.nome + '". A aba ' + nome + ' tem ' + fNum(n) + ' linhas e foi dividida em ' + f.q + ' abas porque o Excel aceita no máximo 1.048.576 linhas por aba. Some as partes para o total geral.';
    const orig = sh.rows; return Object.assign({}, sh, { rows: async (emit, y) => { await orig(emit, y); emit([]); emit([{ v: txt, s: XS.note }]); } });
  };
  const dat3 = [{ fi: fBc, name: 'Soma de Vlr Base Cálculo PIS' }, { fi: fPis, name: 'Soma de Vlr PIS' }, { fi: fCof, name: 'Soma de Vlr Cofins' }];
  const pivTab = (name, p, colA) => ({ name, grid: false, cols: [colA, 26.71, 14.86, 17.86], colStyles: [0, XS.eBrl, XS.eBrl, XS.eBrl], rows: p.rows, pivot: p.pivot });
  const larg = (list, fi) => { let mx = 16; for (const v of list) mx = Math.max(mx, String(v == null ? '' : v).length); return Math.min(80, Math.max(18, +(mx * 0.945).toFixed(2))); };

  B.addSheet(dataSheet(BASE, S.recs, LY.totSheets.includes('base')));
  if (sai) {
    // 047: as abas e dinâmicas do Excel final da analista, na mesma ordem
    const fMod = baseCols.findIndex(c => c.k === 'modelo'), fCfop = colIdx('cfop');
    let nT = 0; const nomeT = () => 'Tabela dinâmica' + (++nT);
    for (const f of fatias(BASE, S.recs)) {
      const pcBase = new PivotCache(f.nome, heads, f.recs, bval, { blankEmpty: true }), av = sh => comAviso(sh, f, BASE, S.recs.length);
      const pR = pivotSheet(pcBase, { name: nomeT(), top: true, rows: [fReg], data: dat3, numFmt: 165 });
      B.addSheet(av(pivTab(parteNome('REGISTRO', f.k), pR, larg(pcBase.distinct(fReg), fReg))));
      if (fMod >= 0) { const pM = pivotSheet(pcBase, { name: nomeT(), top: true, rows: [fMod], data: dat3, numFmt: 165 }); B.addSheet(av(pivTab(parteNome('MODELO', f.k), pM, 18))); }
      const pC = pivotSheet(pcBase, { name: nomeT(), top: true, rows: [fCfop], data: dat3, numFmt: 165 }); B.addSheet(av(pivTab(parteNome('CFOP', f.k), pC, 18)));
    }
    if (S.com.length) for (const f of fatias(ALVO, S.com)) {
      const pcCom = new PivotCache(f.nome, heads, f.recs, bval, { blankEmpty: true });
      const p = pivotSheet(pcCom, { name: nomeT(), top: true, rows: [ncmPos], data: dat3, numFmt: 165, sortAsc: true, sortBy: 1 });
      B.addSheet(comAviso({ ...pivTab(parteNome('DIN NCM COM PC - ORDEM CRESCENT', f.k), p, 18), colStyles: null }, f, ALVO, S.com.length));
    }
    B.addSheet(dataSheet(ALVO, S.com, LY.totSheets.includes('com')));
    B.addSheet(dataSheet(OUTRA, S.sem, LY.totSheets.includes('sem')));
    if (S.sem.length) for (const f of fatias(OUTRA, S.sem)) {
      const pcSem = new PivotCache(f.nome, heads, f.recs, bval, { blankEmpty: true });
      const p = pivotSheet(pcSem, { name: nomeT(), top: true, rows: [ncmPos], data: dat3, numFmt: 165 });
      B.addSheet(comAviso(pivTab(parteNome('DIN NCM SEM PC', f.k), p, 18), f, OUTRA, S.sem.length));
    }
  } else {
    // 037: como no vídeo 2 (DINAMICA POR REG, DINAM POR BC PC, NOTAS COM PC, DINAMICA POR NCM sobre a NOTAS SEM PC classificada)
    for (const f of fatias(BASE, S.recs)) {
      const pcBase = new PivotCache(f.nome, heads, f.recs, bval, { blankEmpty: true }), av = sh => comAviso(sh, f, BASE, S.recs.length);
      const pReg = pivotSheet(pcBase, { name: 'DinamicaPorReg', rows: fA >= 0 ? [fA, fReg] : [fReg], data: [{ fi: fPis, name: 'Soma de Vlr PIS' }, { fi: fCof, name: 'Soma de Vlr Cofins' }] });
      const pMes = pivotSheet(pcBase, { name: 'DinamicaPorBC', rows: fA >= 0 && fM >= 0 ? [fA, fM] : [fM >= 0 ? fM : fReg], data: dat3, order: { [fM]: pvCmpMes } });
      B.addSheet(av({ name: parteNome('DINAMICA POR REG', f.k), grid: false, cols: [58, 20, 20], rows: pReg.rows, pivot: pReg.pivot }));
      B.addSheet(av({ name: parteNome('DINAM POR BC PC', f.k), grid: false, cols: [20, 30, 20, 20], rows: pMes.rows, pivot: pMes.pivot }));
    }
    const nSem = semCols.length;
    const alvoVal = (rec, fi) => {
      if (fi < nSem) { const col = semCols[fi]; return col.type === 'cls' ? clsOf(rec) : valOf(rec, col); }
      const k = fi - nSem; if (k < 5) return null;
      const c = creditOf(rec); return c ? [c.base, c.pis, c.cof][k - 5] : 0;
    };
    const fItemA = semCols.findIndex(c => c.i === S.map.vlrItem);
    B.addSheet(dataSheet(OUTRA, S.com, LY.totSheets.includes('com')));
    if (aN) for (const f of fatias(ALVO, alvo)) {
      const cAlvo = new PivotCache(f.nome, semCols.map(c => c.h).concat(extra), f.recs, alvoVal, { blankEmpty: true });
      const pNcm = pivotSheet(cAlvo, { name: 'DinamicaPorNCM', rows: [ncmPos], sortAsc: true, data: [{ fi: fItemA, name: 'Soma de Vlr Item' }] });
      B.addSheet(comAviso({ name: parteNome('DINAMICA POR NCM', f.k), grid: false, cols: [20, 20], rows: pNcm.rows, pivot: pNcm.pivot }, f, ALVO, aN));
    }
    B.addSheet(alvoSheet);
  }

  // ---------- RESUMO (extra do Revisor) ----------
  const potT = S.pot.pis + S.pot.cof;
  const caTot = 4 + S.months.length + new Set(S.months.map(m => m.ano)).size;
  const AQ = "'" + APUR + "'!";
  B.addSheet({
    name: 'RESUMO', tab: 'FF111111', grid: false, cols: [4, 64, 22, 22, 22, 22, 60],
    rows: async (emit) => {
      emit([null, { v: 'Revisão PIS/COFINS (' + MODE.nome.toLowerCase() + ') — ' + (S.empresa.nome || 'Empresa'), s: XS.title }], { ht: 26 });
      emit([null, { v: 'CNPJ ' + fmtCNPJ(S.empresa.cnpj) + ' · período ' + per + ' · gerado pelo Revisor Fiscal em ' + new Date().toLocaleString('pt-BR'), s: XS.note }]);
      emit([null, { v: 'Fonte: ' + S.files.join(', ') + (abasDivididas().length ? ' · ATENÇÃO: ' + avisoDivisao() : ''), s: XS.note }]);
      emit([]);
      emit([null, 'Indicador', 'Valor'], { s: [0, XS.headG, XS.headG] });
      emit([null, 'Linhas processadas', { v: S.totals.n, s: XS.int }]);
      emit([null, T_('Total de itens de entrada (Vlr Item)', 'Total das saídas (Vlr Item)'), { v: r2(S.totals.vlrItem), s: XS.brl }]);
      emit([null, T_('Crédito escriturado — PIS', 'Débito escriturado — PIS'), { v: r2(S.totals.pis), s: XS.brl }]);
      emit([null, T_('Crédito escriturado — COFINS', 'Débito escriturado — COFINS'), { v: r2(S.totals.cof), s: XS.brl }]);
      emit([null, T_('Itens com crédito (aba NOTAS COM PC)', 'Vendas tributadas (aba NOTAS COM PC)'), { v: S.totals.comN, s: XS.int }]);
      emit([null, T_('Itens sem crédito (aba NOTAS SEM PC)', 'Saídas sem PIS/COFINS (aba NOTAS SEM PC)'), { v: S.totals.semN, s: XS.int }]);
      emit([null, T_('Crédito potencial — PIS', 'Valor a recuperar — PIS'), { v: r2(S.pot.pis), f: AQ + 'D' + caTot, s: XS.brlB }]);
      emit([null, T_('Crédito potencial — COFINS', 'Valor a recuperar — COFINS'), { v: r2(S.pot.cof), f: AQ + 'E' + caTot, s: XS.brlB }]);
      emit([null, T_('Crédito potencial — total', 'Valor a recuperar — total'), { v: r2(potT), f: 'C12+C13', s: XS.brlB }]);
      if (!sai) {
        const exRow = emit([null, 'Excluir ICMS da base do crédito a partir de 05/2023 (Lei 14.592/2023)', { v: !!S.settings.excluirIcms, s: XS.bold }]);
        B.names.push({ name: 'ExcluirICMS', ref: 'RESUMO!$C$' + exRow });
        emit([null, { v: 'Altere para VERDADEIRO/FALSO: a aba CRÉDITO APURADO recalcula. Na aba NOTAS SEM PC, mude a coluna CLASSIF. e o crédito se atualiza.', s: XS.note }]);
      } else emit([null, { v: 'Na aba ITENS A RECUPERAR (vendas marcadas RECUPERAR ou AVALIAR), mude a coluna CLASSIF. e a aba VALOR A RECUPERAR se atualiza.', s: XS.note }]);
      emit([]);
      const hy = [0, XS.headG, XS.headG, XS.headG, XS.headG, XS.headG];
      emit([null, T_('Crédito potencial por ano', 'Valor a recuperar por ano'), T_('Base do crédito', 'Base tributada indevidamente'), T_('PIS (1,65%)', 'PIS'), T_('COFINS (7,6%)', 'COFINS'), 'Total'], { s: hy });
      for (const y of S.potYears) emit([null, { v: y.ano, s: XS.def }, { v: r2(y.base), s: XS.brl }, { v: r2(y.pis), s: XS.brl }, { v: r2(y.cof), s: XS.brl }, { v: r2(y.pis + y.cof), s: XS.brlB }]);
      if (!S.potYears.length) emit([null, { v: 'Nenhum valor no período.', s: XS.note }]);
      emit([]);
      emit([null, 'Checklist', 'Situação', 'Itens', 'Valor (R$)', null, 'O que fazer'], { s: [0, XS.headG, XS.headG, XS.headG, XS.headG, XS.headG, XS.headG] });
      const stTxt = { ok: 'OK', opp: 'OPORTUNIDADE', risk: 'RISCO', warn: 'ATENÇÃO', info: 'INFORMATIVO' };
      for (const c of S.checks) emit([null, c.t, stTxt[c.st], { v: c.n, s: XS.int }, c.v != null ? { v: c.v, s: XS.brl } : null, null, { v: c.acao, s: XS.wrap }]);
      emit([]);
      emit([null, { v: 'Classificações sugeridas por regras automáticas. Revisão final do analista responsável. Valores nominais, sem atualização pela Selic.', s: XS.note }]);
    }
  });

  // ---------- CRÉDITO APURADO / VALOR A RECUPERAR (extra: fórmulas vivas sobre a aba classificada) ----------
  const SS = "'" + CLSHEET + "'!";
  const sr = col => SS + '$' + col + '$2:$' + col + '$' + (Math.max(aN, 1) + 1);
  if (sai) B.addSheet(alvoSheet);
  B.addSheet({
    name: APUR, tab: 'FF1C7A55', cols: [10, 12, 24, 18, 18, 20], freeze: { row: 3 },
    rows: async (emit) => {
      emit([{ v: T_('Crédito de PIS/COFINS não aproveitado, por mês', 'PIS/COFINS pagos a maior nas vendas, por mês'), s: XS.title }], { ht: 24 });
      emit([{ v: T_('Soma dos itens com CLASSIF. = ' + CLS.COM + ' na aba NOTAS SEM PC. Muda sozinho quando a classificação muda.', 'Soma das vendas com CLASSIF. = RECUPERAR na aba ITENS A RECUPERAR. Muda sozinho quando a classificação muda.'), s: XS.note }]);
      emit(['ANO', 'MÊS', T_('Base do crédito', 'Base tributada indevidamente'), T_('PIS (1,65%)', 'PIS a recuperar'), T_('COFINS (7,6%)', 'COFINS a recuperar'), 'Total'], { s: XS.head });
      const anos = [...new Set(S.months.map(m => m.ano))];
      let first = 4;
      for (const a of anos) {
        const ms = S.months.filter(m => m.ano === a);
        const r0 = first;
        for (const m of ms) {
          const row = first++;
          const soma = col => partesDe(CLSHEET, Math.max(aN, 1)).map(pt => { const q = "'" + pt.nome + "'!", fx = c => q + '$' + c + '$2:$' + c + '$' + (pt.linhas + 1); return 'SUMIFS(' + fx(col) + ',' + fx(cMes || 'B') + ',"' + m.mes + '")'; }).join('+');
          const pb = m.potBase, pp = r2(m.potPis), pc = r2(m.potCof);
          const anoCol = cMes;
          emit([{ v: a, s: XS.def }, m.mes,
            { v: r2(pb), f: anoCol ? soma(cBase) : null, s: XS.brl },
            { v: pp, f: anoCol ? soma(cPis) : null, s: XS.brl },
            { v: pc, f: anoCol ? soma(cCof) : null, s: XS.brl },
            { v: r2(pp + pc), f: 'D' + row + '+E' + row, s: XS.brlB }]);
        }
        const row = first++;
        const y = S.potYears.find(x => x.ano === a) || { base: 0, pis: 0, cof: 0 };
        emit([{ v: a, s: XS.bold }, { v: 'Total ' + a, s: XS.bold }, { v: r2(y.base), f: 'SUM(C' + r0 + ':C' + (row - 1) + ')', s: XS.brlB }, { v: r2(y.pis), f: 'SUM(D' + r0 + ':D' + (row - 1) + ')', s: XS.brlB }, { v: r2(y.cof), f: 'SUM(E' + r0 + ':E' + (row - 1) + ')', s: XS.brlB }, { v: r2(y.pis + y.cof), f: 'SUM(F' + r0 + ':F' + (row - 1) + ')', s: XS.brlB }]);
      }
      const row = first;
      emit([{ v: 'Total geral', s: XS.txtB }, { v: '', s: XS.txtB }, { v: r2(S.pot.base), f: 'SUMIFS(C4:C' + (row - 1) + ',B4:B' + (row - 1) + ',"Total*")', s: XS.brlTot }, { v: r2(S.pot.pis), f: 'SUMIFS(D4:D' + (row - 1) + ',B4:B' + (row - 1) + ',"Total*")', s: XS.brlTot }, { v: r2(S.pot.cof), f: 'SUMIFS(E4:E' + (row - 1) + ',B4:B' + (row - 1) + ',"Total*")', s: XS.brlTot }, { v: r2(S.pot.pis + S.pot.cof), f: 'SUMIFS(F4:F' + (row - 1) + ',B4:B' + (row - 1) + ',"Total*")', s: XS.brlTot }]);
    }
  });

  // ---------- RESUMO NCM (extra: ranking com o motivo da classificação) ----------
  B.addSheet({
    name: 'RESUMO NCM', tab: 'FF9E6846', cols: [12, 8, 44, 34, 9, 16, 16, 52, 40], freeze: { row: 3 }, filterRef: 'A3:I' + (S.groups.length + 3),
    rows: async (emit) => {
      emit([{ v: T_('Itens sem crédito agrupados por NCM e CFOP, do maior para o menor valor', 'Vendas tributadas agrupadas por NCM e CFOP, do maior para o menor valor'), s: XS.title }], { ht: 24 });
      emit([{ v: 'Classificar os primeiros grupos cobre a maior parte do valor. Classificação no momento da exportação.', s: XS.note }]);
      emit(['NCM', 'CFOP', 'Descrição mais frequente', T_('Fornecedor principal', 'Cliente principal'), 'Itens', 'Classificação', 'Vlr Item', 'Motivo', 'Fundamento'], { s: XS.head, ht: 30 });
      for (const g of S.groups) {
        const cls = g.dec || g.sug.cls, s = cls === g.sug.cls ? g.sug : null;
        const part = [...g.parts.entries()].sort((a, b) => b[1] - a[1])[0];
        emit([{ v: g.ncm || '', s: XS.txt }, { v: g.cfop || '', s: XS.txt }, g.descTop, part ? part[0] : '', { v: g.n, s: XS.int }, cls, { v: r2(g.vlr), s: XS.brl }, { v: s ? s.motivo : 'Decisão do analista', s: XS.wrap }, { v: s ? s.lei : '', s: XS.wrap }]);
      }
    }
  });

  // ---------- CHECKLIST (extra) ----------
  B.addSheet({
    name: 'CHECKLIST', tab: 'FFB4372B', cols: [5, 46, 14, 10, 16, 60, 46, 80], freeze: { row: 3 },
    rows: async (emit) => {
      emit([{ v: 'Checklist automático da revisão', s: XS.title }], { ht: 24 });
      emit([{ v: 'Verificações que todo diagnóstico deve cobrir. O texto sugerido entra na minuta do relatório.', s: XS.note }]);
      emit(['#', 'Verificação', 'Situação', 'Itens', 'Valor (R$)', 'Constatação', 'O que fazer', 'Texto sugerido para o relatório'], { s: XS.head, ht: 30 });
      const stTxt = { ok: 'OK', opp: 'OPORTUNIDADE', risk: 'RISCO', warn: 'ATENÇÃO', info: 'INFORMATIVO' };
      S.checks.forEach((c, i) => emit([{ v: i + 1, s: XS.topGen }, { v: c.t, s: XS.wrap }, { v: stTxt[c.st], s: XS.topGen }, { v: c.n, s: XS.topInt }, c.v != null ? { v: c.v, s: XS.topBrl } : null, { v: c.txt, s: XS.wrap }, { v: c.acao, s: XS.wrap }, { v: c.rel || '', s: XS.wrap }], { ht: 75 }));
    }
  });

  return B.build(onProgress);
}

/* planilha "crua" no formato da exportação do SistemaMA (para testar a importação) */
async function buildRawExport(tipo) {
  const sai = tipo === 'SAI', d = sai ? buildDemoSaidas() : buildDemo();
  const B = new XlsxBook(); B.title = MODES[sai ? 'SAI' : 'ENT'].titulo;
  const hk = d.headers.map(normKey);
  const st = hk.map(k => /^vlr /.test(k) ? XS.dec : /^data |^periodo$/.test(k) ? XS.date : (TEXT_COLS.includes(k) ? XS.txt : 0));
  B.addSheet({
    name: 'Planilha', cols: hk.map(k => /descri|nome/.test(k) ? 30 : 12), rows: async (emit, y) => {
      emit(d.headers, { s: XS.bold });
      for (let i = 0; i < d.rows.length; i++) { emit(d.rows[i], { s: st }); if (i % 5000 === 4999) await y(); }
    }
  });
  return B.build();
}

/* amostra pequena (≈ 400 linhas) gravada como .xlsx e importada pelo mesmo caminho de um arquivo real: para demonstrar o processo */
async function buildSampleFile(tipo) {
  const sai = tipo === 'SAI', d = sai ? buildDemoSaidas() : buildDemo();
  const ym = r => r[1].getFullYear() * 100 + r[1].getMonth() + 1;
  let i = 0;
  const keep = sai
    ? r => { const m = ym(r); if (m < 202401 || m > 202506) return false; i++; return r[40] !== '01' || !/^[56](102|405|404)$/.test(r[33]) || /^(2522|4011)/.test(String(r[25])) || r[43] === .65 || i % 20 === 0; }
    : r => { const m = ym(r); if (m < 202501 || m > 202506) return false; i++; return r[37] !== '50' || /F150|C500|F100/.test(r[2]) || i % 9 === 0; };
  const rows = d.rows.filter(keep), hk = d.headers.map(normKey);
  const st = hk.map(k => /^vlr /.test(k) ? XS.dec : /^data |^periodo$/.test(k) ? XS.date : (TEXT_COLS.includes(k) ? XS.txt : 0));
  const B = new XlsxBook(); B.title = MODES[sai ? 'SAI' : 'ENT'].titulo;
  B.addSheet({ name: 'Planilha', cols: hk.map(k => /descri|nome/.test(k) ? 30 : 12), rows: async (emit) => { emit(d.headers, { s: XS.bold }); for (const r of rows) emit(r, { s: st }); } });
  const blob = await B.build();
  const name = MODES[sai ? 'SAI' : 'ENT'].titulo + '.xlsx';
  try { return new File([blob], name, { type: blob.type }); } catch (e) { blob.name = name; return blob; }
}
