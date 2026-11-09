/* ===================== minuta do diagnóstico em Word (.docx) ===================== */
const W = {
  run(t, o = {}) {
    const rp = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.caps ? '<w:caps/>' : '') +
      (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + (o.sz ? '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>' : '') + (o.hl ? '<w:highlight w:val="' + o.hl + '"/>' : '') + (o.u ? '<w:u w:val="single"/>' : '');
    return String(t).split('\n').map((line, i) => (i ? '<w:r><w:br/></w:r>' : '') + '<w:r>' + (rp ? '<w:rPr>' + rp + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + xmlEsc(line) + '</w:t></w:r>').join('');
  },
  p(content, o = {}) {
    const runs = Array.isArray(content) ? content.map(c => typeof c === 'string' ? W.run(c, o.r || {}) : W.run(c.t, c)).join('') : W.run(content, o.r || {});
    const pp = (o.style ? '<w:pStyle w:val="' + o.style + '"/>' : '') + (o.keep ? '<w:keepNext/>' : '') + (o.shd ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shd + '"/>' : '') +
      (o.after != null || o.before != null || o.line ? '<w:spacing' + (o.before != null ? ' w:before="' + o.before + '"' : '') + (o.after != null ? ' w:after="' + o.after + '"' : '') + (o.line ? ' w:line="' + o.line + '" w:lineRule="' + (o.lineRule || 'auto') + '"' : '') + '/>' : '') +
      (o.ind ? '<w:ind w:firstLine="' + o.ind + '"/>' : '') + (o.jc ? '<w:jc w:val="' + o.jc + '"/>' : '');
    return '<w:p>' + (pp ? '<w:pPr>' + pp + '</w:pPr>' : '') + runs + '</w:p>';
  },
  band(t) { return W.p(t.toUpperCase(), { style: 'Faixa', keep: true }); },
  h2(t) { return W.p(t, { style: 'Subtitulo', keep: true }); },
  body(content) { return W.p(content, { style: 'Corpo', ind: 709 }); },
  pageBreak() { return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; },
  table(cols, rows, o = {}) { // cols: [{h, w (twips), right}]; rows: arrays; o.totalLast
    const brd = '<w:tblBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="111111"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="9E6846"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="C9CDD2"/></w:tblBorders>';
    let x = '<w:tbl><w:tblPr><w:tblW w:w="' + cols.reduce((a, c) => a + c.w, 0) + '" w:type="dxa"/><w:jc w:val="center"/>' + brd + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' +
      cols.map(c => '<w:gridCol w:w="' + c.w + '"/>').join('') + '</w:tblGrid>';
    const cell = (txt, c, opt) => '<w:tc><w:tcPr><w:tcW w:w="' + c.w + '" w:type="dxa"/>' + (opt.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + opt.fill + '"/>' : '') + '</w:tcPr>' +
      W.p(txt == null ? '' : String(txt), { style: 'Tabela', jc: c.right ? 'right' : 'left', r: { b: opt.b, color: opt.color, hl: opt.hl } }) + '</w:tc>';
    x += '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + cols.map(c => cell(c.h, c, { fill: '111111', b: true, color: 'FFFFFF' })).join('') + '</w:tr>';
    rows.forEach((r, i) => {
      const tot = o.totalLast && i === rows.length - 1;
      x += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + cols.map((c, j) => cell(r[j], c, { b: tot || (o.boldCol === j), fill: tot ? 'EEF0F2' : null, hl: o.hlCell && o.hlCell(i, j) ? 'yellow' : null })).join('') + '</w:tr>';
    });
    return x + '</w:tbl>' + W.p('', { style: 'Tabela', after: 120 });
  }
};

const DOCX_STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="pt-BR" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Corpo"><w:name w:val="Corpo do diagnóstico"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Faixa"><w:name w:val="Faixa de seção"/><w:basedOn w:val="Normal"/><w:next w:val="Corpo"/><w:qFormat/><w:pPr><w:keepNext/><w:shd w:val="clear" w:color="auto" w:fill="111111"/><w:spacing w:before="360" w:after="240" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/><w:color w:val="FFFFFF"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Subtitulo"><w:name w:val="Subtítulo do diagnóstico"/><w:basedOn w:val="Normal"/><w:next w:val="Corpo"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Tabela"><w:name w:val="Texto de tabela"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Rodape"><w:name w:val="Rodapé do diagnóstico"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="6B7079"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>' +
  '</w:styles>';

function buildDocx() {
  const E = S.empresa.nome || 'EMPRESA', cnpj = fmtCNPJ(S.empresa.cnpj), st = S.settings;
  const ini = S.months[0].ym, fim = S.months[S.months.length - 1].ym;
  const ck = Object.fromEntries(S.checks.map(c => [c.id, c]));
  const potT = S.pot.pis + S.pot.cof;
  const riscos = S.checks.filter(c => c.st === 'risk');
  const contT = riscos.reduce((a, c) => a + (c.v || 0), 0);
  const escrT = S.totals.pis + S.totals.cof;
  let b = '';
  // capa
  b += W.p('', { after: 2400 });
  b += W.p([{ t: 'DIAGNÓSTICO FISCAL', b: true, sz: 40, color: 'FFFFFF' }], { style: 'Faixa', before: 0, after: 0, line: 1600, lineRule: 'exact' });
  b += W.p('', { after: 600 });
  b += W.p([{ t: E, b: true, sz: 32 }], { jc: 'center', after: 80 });
  b += W.p('CNPJ ' + cnpj, { jc: 'center', after: 400, r: { color: '4A4F57' } });
  b += W.p('Revisão de PIS e COFINS' + (S.tipo === 'SAI' ? ' sobre as saídas' : '') + ' · ' + ymLong(ini) + ' a ' + ymLong(fim), { jc: 'center', after: 1600, r: { sz: 24 } });
  b += W.pageBreak();
  // carta
  b += W.p((st.cidade || '[Cidade]') + ', ' + hoje() + '.', { jc: 'right', after: 360 });
  b += W.p([{ t: 'À ' + E.toUpperCase(), b: true }], { after: 0 });
  b += W.p('CNPJ ' + cnpj + '.', { after: 240 });
  b += W.p([{ t: 'Assunto: Diagnóstico Fiscal.', b: true, u: true }], { jc: 'right', after: 360 });
  b += W.p('Prezados,', { after: 240 });
  if (S.tipo === 'SAI') b += docSaidas(E, ini, fim, ck, st);
  else {
  b += W.body('Apresentamos à ' + E + ' o Diagnóstico Fiscal da revisão tributária de PIS e COFINS referente ao período de ' + ymLong(ini) + ' a ' + ymLong(fim) + '. O trabalho foi elaborado pela equipe técnica ' + (st.escritorio ? 'do escritório ' + st.escritorio : 'do escritório') + ' a partir do cruzamento das informações escrituradas na EFD-Contribuições e expressa nosso parecer sobre os créditos ainda não aproveitados pela empresa e sobre os pontos de atenção na apuração das contribuições.');
  b += W.band('Objetivo do trabalho');
  b += W.body('A revisão teve como objetivo identificar créditos de PIS e COFINS não aproveitados nas aquisições da empresa e verificar a conformidade dos créditos já escriturados, com base nas Leis 10.637/2002 e 10.833/2003, no entendimento firmado pelo Superior Tribunal de Justiça no REsp 1.221.170/PR (conceito de insumo pelos critérios da essencialidade e da relevância) e no Parecer Normativo COSIT nº 5/2018.');
  b += W.band('Resumo dos resultados');
  b += W.table([{ h: 'Indicador', w: 6000 }, { h: 'Valor', w: 3000, right: true }], [
    ['Itens de entrada analisados', fNum(S.totals.n)],
    ['Valor total das entradas analisadas', fBRL(S.totals.vlrItem)],
    ['Créditos já escriturados (PIS + COFINS)', fBRL(escrT)],
    ['Crédito não aproveitado identificado (PIS + COFINS)', fBRL(potT)],
    ['Créditos aproveitados a maior (contingência)', fBRL(contT)]
  ], { hlCell: (i, j) => i === 3 && j === 1 });
  // regime
  b += W.band('Análise do regime de apuração');
  b += W.body(ck.regime.rel);
  const anos = [...new Set(S.months.map(m => m.ano))];
  b += W.table([{ h: 'Ano', w: 1300 }, { h: 'Meses não cumulativos', w: 2100, right: true }, { h: 'Base de cálculo escriturada', w: 2400, right: true }, { h: 'PIS escriturado', w: 1700, right: true }, { h: 'COFINS escriturada', w: 1700, right: true }],
    anos.map(a => { const ms = S.months.filter(m => m.ano === a); return [a, ms.filter(m => m.regime === 'NC').length + ' de ' + ms.length, fBRL(ms.reduce((s, m) => s + m.bcPis, 0)), fBRL(ms.reduce((s, m) => s + m.pis, 0)), fBRL(ms.reduce((s, m) => s + m.cof, 0))]; })
      .concat([['Total', fNum(S.months.filter(m => m.regime === 'NC').length) + ' de ' + S.months.length, fBRL(S.totals.bcPis), fBRL(S.totals.pis), fBRL(S.totals.cof)]]), { totalLast: true });
  if (ck.estoque.rel) b += W.body(ck.estoque.rel);
  // créditos
  b += W.band('Crédito de PIS e COFINS não aproveitado');
  b += W.body('Neste tópico foram analisadas as aquisições escrituradas sem crédito, classificadas pela combinação de NCM, CFOP e CST e, quando necessário, pela descrição do produto e pela atividade da empresa.');
  b += W.body(ck.oportunidade.rel);
  b += W.table([{ h: 'Ano', w: 1300 }, { h: 'Base do crédito', w: 2600, right: true }, { h: 'PIS (1,65%)', w: 1700, right: true }, { h: 'COFINS (7,6%)', w: 1700, right: true }, { h: 'Total', w: 1900, right: true }],
    S.potYears.map(y => [y.ano, fBRL(y.base), fBRL(y.pis), fBRL(y.cof), fBRL(y.pis + y.cof)]).concat([['Total', fBRL(S.pot.base), fBRL(S.pot.pis), fBRL(S.pot.cof), fBRL(potT)]]), { totalLast: true });
  const top = S.groups.filter(g => (g.dec || g.sug.cls) === CLS.COM).map(g => { let v = 0; for (const r of g.recs) { const c = creditOf(r); if (c) v += c.pis + c.cof; } return { g, v }; }).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
  if (top.length) {
    b += W.h2('Principais produtos com crédito não aproveitado');
    b += W.table([{ h: 'NCM', w: 1300 }, { h: 'Produto', w: 3900 }, { h: 'CFOP', w: 800 }, { h: 'Itens', w: 900, right: true }, { h: 'Crédito (PIS + COFINS)', w: 2300, right: true }],
      top.map(x => [fmtNCM(x.g.ncm), x.g.descTop, x.g.cfop, fNum(x.g.n), fBRL(x.v)]));
  }
  // pontos de atenção
  b += W.band('Pontos de atenção');
  const pontos = S.checks.filter(c => (c.st === 'risk' || c.st === 'warn') && c.rel);
  if (!pontos.length) b += W.body('Não foram identificadas inconsistências relevantes nos créditos já escriturados no período analisado.');
  for (const c of pontos) { b += W.h2(c.t); b += W.body(c.rel); }
  const outros = S.checks.filter(c => (c.st === 'risk' || c.st === 'warn') && !c.rel);
  for (const c of outros) { b += W.h2(c.t); b += W.body(c.txt + ' ' + c.acao); }
  // metodologia
  b += W.band('Metodologia aplicada');
  b += W.body('Os arquivos da EFD-Contribuições foram importados no sistema de revisão e as informações das notas fiscais de entrada foram exportadas para planilha. As aquisições foram separadas entre itens escriturados com e sem crédito; os itens sem crédito foram agrupados por NCM e CFOP e classificados por regras que consideram o regime de incidência do produto (monofásico, alíquota zero ou tributação normal), a natureza da operação e o conceito de insumo, com revisão individual dos casos que dependem da atividade da empresa.');
  b += W.body('Os créditos foram calculados às alíquotas de 1,65% (PIS) e 7,6% (COFINS)' + (st.excluirIcms ? ', com exclusão do ICMS destacado da base de cálculo a partir de maio de 2023, conforme a Lei 14.592/2023' : '') + '. Os créditos já escriturados foram conferidos quanto à alíquota, ao CST, à base de cálculo e à natureza do produto.');
  // conclusão
  b += W.band('Conclusão');
  b += W.body('Diante do exposto, identificamos créditos de PIS e COFINS não aproveitados no valor de ' + fBRL(potT) + ', em valores nominais, passíveis de recuperação na esfera administrativa, observado o prazo de cinco anos.' + (contT > 0 ? ' Também foram constatados créditos aproveitados a maior de ' + fBRL(contT) + ', que recomendamos regularizar.' : ''));
  b += W.body('A forma de aproveitamento (retificação das obrigações acessórias com apuração de pagamento a maior, ou crédito extemporâneo) e eventual atualização monetária serão definidas na etapa de execução, conforme a situação fiscal da empresa.');
  }
  b += W.p('Permanecemos à disposição para os esclarecimentos necessários.', { style: 'Corpo', ind: 709, after: 600 });
  b += W.p([{ t: st.escritorio || 'Escritório', b: true }], { jc: 'center', after: 0 });
  b += W.p(st.analista || 'Analista responsável', { jc: 'center' });

  const docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + b +
    '<w:sectPr><w:headerReference w:type="default" r:id="rId3"/><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const footer = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><w:pPr><w:pStyle w:val="Rodape"/></w:pPr>' +
    '<w:r><w:t xml:space="preserve">' + xmlEsc((st.escritorio || 'Diagnóstico Fiscal') + ' · Diagnóstico Fiscal · ' + E + ' · Página ') + '</w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> de </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>';
  // cabeçalho: logotipo carregado pelo escritório (ou o nome do escritório) no canto direito, como nos relatórios da Milk
  const logo = S.logo && S.logo.data ? S.logo : null;
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  let headerBody;
  if (logo) {
    const cy = 450000, cx = Math.round(cy * logo.w / logo.h);
    headerBody = '<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="right"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="1" name="Logotipo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  } else {
    headerBody = '<w:p><w:pPr><w:pStyle w:val="Rodape"/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:caps/><w:color w:val="111111"/><w:spacing w:val="40"/></w:rPr><w:t xml:space="preserve">' + xmlEsc(st.escritorio || 'Diagnóstico Fiscal') + '</w:t></w:r></w:p>';
  }
  const headerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + '>' + headerBody + '</w:hdr>';
  const enc = new TextEncoder(), u = s => enc.encode(s);
  const iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const files = {
    '[Content_Types].xml': u('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'),
    '_rels/.rels': u('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'),
    'word/document.xml': u(docXml),
    'word/styles.xml': u(DOCX_STYLES),
    'word/footer1.xml': u(footer),
    'word/_rels/document.xml.rels': u('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>'),
    'word/header1.xml': u(headerXml),
    'docProps/core.xml': u('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xmlEsc('Diagnóstico Fiscal - ' + E) + '</dc:title><dc:creator>Revisor Fiscal</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:modified></cp:coreProperties>'),
    'docProps/app.xml': u('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>')
  };
  if (logo) {
    const bin = atob(logo.data.split(',')[1]), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    files['word/media/logo.png'] = bytes;
    files['word/_rels/header1.xml.rels'] = u('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>');
  }
  const zipped = fflate.zipSync(files, { level: 6 });
  return new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/* corpo da minuta das saídas (047): estrutura do diagnóstico da Milk para os tópicos de receita */
function docSaidas(E, ini, fim, ck, st) {
  let b = '';
  const potT = S.pot.pis + S.pot.cof, icms = ck['icms-base'], semTrib = ck['sem-trib'];
  const icmsV = icms && icms.st === 'opp' ? icms.v || 0 : 0, totRec = potT + icmsV;
  b += W.body('Apresentamos à ' + E + ' o Diagnóstico Fiscal da revisão tributária de PIS e COFINS sobre as receitas de vendas, referente ao período de ' + ymLong(ini) + ' a ' + ymLong(fim) + '. O trabalho foi elaborado pela equipe técnica ' + (st.escritorio ? 'do escritório ' + st.escritorio : 'do escritório') + ' a partir das notas fiscais de saída escrituradas na EFD-Contribuições e expressa nosso parecer sobre os valores pagos a maior e os pontos de atenção na tributação das vendas.');
  b += W.band('Objetivo do trabalho');
  b += W.body('A revisão teve como objetivo verificar a correta tributação das receitas pelo PIS e pela COFINS, identificando valores pagos a maior (produtos sujeitos à alíquota zero ou à incidência monofásica na revenda, operações que não geram receita e a inclusão do ICMS na base de cálculo) e eventuais débitos recolhidos a menor, com base nas Leis 10.637/2002, 10.833/2003 e 9.718/1998 e no Tema 69 do Supremo Tribunal Federal.');
  b += W.band('Resumo dos resultados');
  const linhas = [
    ['Itens de saída analisados', fNum(S.totals.n)],
    ['Valor total das saídas analisadas', fBRL(S.totals.vlrItem)],
    ['PIS e COFINS escriturados sobre as saídas', fBRL(S.totals.pis + S.totals.cof)],
    ['Vendas tributadas indevidamente (PIS + COFINS a recuperar)', fBRL(potT)]
  ];
  if (icms && icms.n) linhas.push(['ICMS na base de cálculo (Tema 69): PIS + COFINS pagos a maior', fBRL(icms.v || 0) + (icms.st === 'opp' ? '' : ' (residual)')]);
  linhas.push(['Total a recuperar identificado', fBRL(totRec)]);
  if (semTrib && semTrib.n) linhas.push(['Vendas sem PIS/COFINS a conferir (possível débito a menor)', fBRL(semTrib.v || 0)]);
  b += W.table([{ h: 'Indicador', w: 6000 }, { h: 'Valor', w: 3000, right: true }], linhas, { hlCell: (i, j) => j === 1 && /^Total a recuperar/.test(linhas[i][0]) });
  // regime e carga tributária
  b += W.band('Análise do regime de apuração');
  b += W.body(ck.regime.rel);
  const anos = [...new Set(S.months.map(m => m.ano))];
  const vItemAno = new Map(); for (const r of S.recs) vItemAno.set(r.ano, (vItemAno.get(r.ano) || 0) + r.vlrItem);
  const regAno = a => { const ms = S.months.filter(m => m.ano === a), nc = ms.filter(m => m.regime === 'NC').length, cu = ms.filter(m => m.regime === 'CUM').length; return nc && cu ? 'Misto' : nc ? 'Não cumulativo' : cu ? 'Cumulativo' : '—'; };
  b += W.h2('Carga tributária de PIS e COFINS sobre as saídas');
  b += W.table([{ h: 'Ano', w: 900 }, { h: 'Regime', w: 1700 }, { h: 'Saídas (Vlr Item)', w: 2000, right: true }, { h: 'PIS', w: 1500, right: true }, { h: 'COFINS', w: 1600, right: true }, { h: 'Carga', w: 1000, right: true }],
    anos.map(a => { const ms = S.months.filter(m => m.ano === a), p = ms.reduce((x, m) => x + m.pis, 0), c = ms.reduce((x, m) => x + m.cof, 0), v = vItemAno.get(a) || 0; return [a, regAno(a), fBRL(v), fBRL(p), fBRL(c), v ? NUM2.format((p + c) / v * 100) + '%' : '—']; })
      .concat([['Total', '', fBRL(S.totals.vlrItem), fBRL(S.totals.pis), fBRL(S.totals.cof), S.totals.vlrItem ? NUM2.format((S.totals.pis + S.totals.cof) / S.totals.vlrItem * 100) + '%' : '—']]), { totalLast: true });
  // vendas tributadas indevidamente
  b += W.band('Produtos sujeitos à alíquota zero e à incidência monofásica');
  b += W.body('Determinados produtos têm as alíquotas de PIS e COFINS reduzidas a zero na venda, seja pela natureza do produto (Lei 10.925/2004, art. 1º, e Lei 10.865/2004, art. 28), seja porque a tributação se concentra no fabricante ou importador (incidência monofásica: Leis 10.147/2000, 10.485/2002 e 9.718/1998). Nesses casos a receita da revenda não sofre a incidência das contribuições, e a tributação indevida gera pagamento a maior. Da mesma forma, operações que não geram receita, como remessas, retornos e bonificações, e a venda de bens do ativo imobilizado não compõem a base de cálculo.');
  b += W.body(ck.oportunidade.rel || 'Não foram identificadas vendas tributadas indevidamente no período analisado.');
  if (potT > 0) {
    b += W.table([{ h: 'Ano', w: 1300 }, { h: 'Base tributada', w: 2600, right: true }, { h: 'PIS', w: 1700, right: true }, { h: 'COFINS', w: 1700, right: true }, { h: 'Total', w: 1900, right: true }],
      S.potYears.map(y => [y.ano, fBRL(y.base), fBRL(y.pis), fBRL(y.cof), fBRL(y.pis + y.cof)]).concat([['Total', fBRL(S.pot.base), fBRL(S.pot.pis), fBRL(S.pot.cof), fBRL(potT)]]), { totalLast: true });
    const top = S.groups.filter(g => (g.dec || g.sug.cls) === CLS.COM).map(g => { let v = 0; for (const r of g.recs) { const c = creditOf(r); if (c) v += c.pis + c.cof; } return { g, v }; }).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
    if (top.length) {
      b += W.h2('Principais produtos e operações tributados indevidamente');
      b += W.table([{ h: 'NCM', w: 1300 }, { h: 'Produto', w: 3900 }, { h: 'CFOP', w: 800 }, { h: 'Itens', w: 900, right: true }, { h: 'PIS + COFINS', w: 2300, right: true }],
        top.map(x => [fmtNCM(x.g.ncm), x.g.descTop, x.g.cfop, fNum(x.g.n), fBRL(x.v)]));
    }
  }
  // ICMS na base
  b += W.band('Exclusão do ICMS da base de cálculo do PIS e da COFINS');
  b += W.body('Em maio de 2021, o Supremo Tribunal Federal concluiu o julgamento do Tema 69 da repercussão geral (RE 574.706/PR), fixando a tese de que o ICMS não compõe a base de cálculo do PIS e da COFINS, por não se incorporar ao patrimônio do contribuinte. O valor a excluir é o ICMS destacado nas notas fiscais de venda, independentemente do regime de apuração.');
  b += W.h2('Análise da exclusão do ICMS da base de cálculo');
  b += W.body(icms && icms.rel ? icms.rel : (icms ? icms.txt : ''));
  // pontos de atenção
  b += W.band('Pontos de atenção');
  const pontos = S.checks.filter(c => (c.st === 'risk' || c.st === 'warn' || c.id === 'consolidadas') && c.id !== 'regime');
  if (!pontos.length) b += W.body('Não foram identificadas inconsistências relevantes na escrituração das saídas no período analisado.');
  for (const c of pontos) { b += W.h2(c.t); b += W.body(c.rel || (c.txt + ' ' + c.acao)); }
  // metodologia
  b += W.band('Metodologia aplicada');
  const regs = [...new Set(S.regTable.map(x => x.registro))];
  b += W.body('Como ponto de partida, extraímos da EFD-Contribuições todos os documentos fiscais de saída do período, contemplando os registros: ' + regs.join('; ') + '. As vendas foram separadas entre tributadas e não tributadas; as tributadas foram agrupadas por NCM e CFOP e classificadas por regras que consideram o regime de incidência do produto (monofásico, alíquota zero ou tributação normal) e a natureza da operação, com revisão individual dos casos que dependem do uso do produto. Também foram conferidos o regime de cada mês, as alíquotas aplicadas, a coerência entre os CSTs de PIS e COFINS e a base de cálculo em relação ao ICMS destacado.');
  // conclusão
  b += W.band('Conclusão');
  b += W.body('Diante do exposto, identificamos valores de PIS e COFINS pagos a maior sobre as saídas no montante de ' + fBRL(totRec) + ', em valores nominais, passíveis de restituição ou compensação na esfera administrativa, observado o prazo de cinco anos.' + (semTrib && semTrib.n ? ' Recomendamos ainda conferir o enquadramento das vendas registradas sem tributação apontadas nos pontos de atenção.' : ''));
  b += W.body('A forma de recuperação (retificação das obrigações acessórias com apuração do pagamento a maior e pedido de restituição ou compensação) e a atualização monetária pela taxa Selic serão definidas na etapa de execução, conforme a situação fiscal da empresa.');
  return b;
}
