/* ============ minuta no MODELO da Milk: o .docx que a equipe já usa, preenchido com os dados desta empresa ============ */
/* No vídeo 2 (21:12) a analista abre o diagnóstico de uma empresa parecida e troca à mão datas, nome, CNPJ, regime,
   valores e prints. Aqui o mesmo arquivo (MODELO.docx) é carregado uma vez, fica só neste navegador, e o Revisor troca
   o que vem da EFD-Contribuições. O que depende de outras fontes (gráficos do SistemaMA, ECD) fica marcado em amarelo. */

/* --- armazenamento do modelo (IndexedDB; se não houver, fica só na memória da aba) --- */
const ARQ = {
  mem: {},
  db() {
    return new Promise((res, rej) => {
      try { const r = indexedDB.open('revisor-fiscal', 1); r.onupgradeneeded = () => r.result.createObjectStore('arquivos'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); }
    });
  },
  async get(k) { try { const d = await ARQ.db(); return await new Promise((res, rej) => { const q = d.transaction('arquivos').objectStore('arquivos').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); } catch (e) { return ARQ.mem[k] || null; } },
  async set(k, v) { ARQ.mem[k] = v; try { const d = await ARQ.db(); await new Promise((res, rej) => { const t = d.transaction('arquivos', 'readwrite'); t.objectStore('arquivos').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); return true; } catch (e) { return false; } },
  async del(k) { delete ARQ.mem[k]; try { const d = await ARQ.db(); await new Promise((res) => { const t = d.transaction('arquivos', 'readwrite'); t.objectStore('arquivos').delete(k); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* */ } }
};

/* --- edição de texto em parágrafos do Word sem perder a formatação (o texto costuma vir quebrado em várias "runs") --- */
const DX = {
  dec: s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&'),
  nodes(p) { const out = [], re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:t(?:\s[^>]*)?\/>/g; let m; while ((m = re.exec(p))) out.push({ i: m.index, len: m[0].length, text: m[1] != null ? DX.dec(m[1]) : '' }); return out; },
  text(p) { return DX.nodes(p).map(n => n.text).join(''); },
  splice(p, a, b, novo) { // troca [a, b) do texto do parágrafo; a formatação é a da run onde o trecho começa
    const ns = DX.nodes(p); if (!ns.length) return p;
    const T = ns.map(n => n.text), st = [];
    let pos = 0, k0 = -1;
    for (let k = 0; k < ns.length; k++) { st.push(pos); if (k0 < 0 && T[k].length && a >= pos && a < pos + T[k].length) k0 = k; pos += T[k].length; }
    if (k0 < 0) { if (a !== pos) return p; k0 = ns.length - 1; while (k0 > 0 && !T[k0].length) k0--; } // trecho no fim do texto
    for (let k = k0; k < ns.length; k++) {
      const s0 = st[k], s1 = s0 + T[k].length;
      if (k === k0) T[k] = T[k].slice(0, a - s0) + novo + (b <= s1 ? T[k].slice(b - s0) : '');
      else { if (s0 >= b) break; T[k] = b >= s1 ? '' : T[k].slice(b - s0); }
    }
    let out = '', last = 0;
    ns.forEach((n, k) => { out += p.slice(last, n.i) + '<w:t xml:space="preserve">' + xmlEsc(T[k]) + '</w:t>'; last = n.i + n.len; });
    return out + p.slice(last);
  },
  replaceAll(p, find, repl) {
    if (!find) return p;
    let t = DX.text(p), i = t.indexOf(find), guard = 0;
    while (i >= 0 && guard++ < 50) { p = DX.splice(p, i, i + find.length, repl); t = DX.text(p); i = t.indexOf(find, i + repl.length); }
    return p;
  },
  replaceRe(p, re, fn) { const t = DX.text(p), m = re.exec(t); if (!m) return null; return DX.splice(p, m.index, m.index + m[0].length, fn(m)); },
  setText(p, novo) { return DX.splice(p, 0, DX.text(p).length, novo); },
  pPr(p) { const m = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(p); return m ? m[0] : ''; },
  rPr(p) { const m = /<w:r(?:\s[^>]*)?>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/.exec(p); return m ? m[1] : ''; },
  hlRun(t, rPr) { // run destacada em amarelo, com a formatação da run original quando houver
    let rp = rPr || '<w:rPr></w:rPr>';
    if (!/<w:highlight /.test(rp)) rp = rp.replace('</w:rPr>', '<w:highlight w:val="yellow"/></w:rPr>');
    return '<w:r>' + rp + '<w:t xml:space="preserve">' + xmlEsc(t) + '</w:t></w:r>';
  },
  /* parágrafos mais internos (os que contêm o texto), em ordem, com início e fim no XML */
  paras(x) {
    const out = [], stack = [], re = /<w:p(?=[\s>\/])[^>]*?(\/?)>|<\/w:p>/g; let m;
    while ((m = re.exec(x))) {
      if (m[0] === '</w:p>') { const st = stack.pop(); if (st && !st.child) out.push({ a: st.a, b: m.index + 6 }); if (stack.length) stack[stack.length - 1].child = true; }
      else if (m[1] !== '/') { if (stack.length) stack[stack.length - 1].child = true; stack.push({ a: m.index, child: false }); }
    }
    return out.sort((p, q) => p.a - q.a);
  }
};

/* --- tabelas no padrão do diagnóstico (cabeçalho preto, valores à direita) --- */
function dxTabela(cols, rows, o = {}) {
  const W = cols.reduce((a, c) => a + c.w, 0);
  const brd = '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders>';
  const cell = (t, c, f) => '<w:tc><w:tcPr><w:tcW w:w="' + c.w + '" w:type="dxa"/>' + (f.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + f.fill + '"/>' : '') + '</w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="' + (c.right ? 'right' : 'left') + '"/></w:pPr><w:r><w:rPr>' + (f.b ? '<w:b/>' : '') + (f.color ? '<w:color w:val="' + f.color + '"/>' : '') + (f.hl ? '<w:highlight w:val="yellow"/>' : '') + '<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">' + xmlEsc(t == null ? '' : String(t)) + '</w:t></w:r></w:p></w:tc>';
  let x = '<w:tbl><w:tblPr><w:tblW w:w="' + W + '" w:type="dxa"/><w:jc w:val="center"/>' + brd + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + cols.map(c => '<w:gridCol w:w="' + c.w + '"/>').join('') + '</w:tblGrid>';
  x += '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + cols.map(c => cell(c.h, c, { fill: '000000', b: true, color: 'FFFFFF' })).join('') + '</w:tr>';
  rows.forEach((r, i) => { const tot = o.totalLast && i === rows.length - 1; x += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + cols.map((c, j) => cell(r[j], c, { b: tot || j === 0, hl: o.hl && o.hl(i, j) })).join('') + '</w:tr>'; });
  return x + '</w:tbl>';
}

/* --- textos gerados no estilo do diagnóstico --- */
const ymL = ym => ymLabel(ym);
function formaTributacao(anosReg) {
  const anos = Object.keys(anosReg).map(Number).sort((a, b) => a - b), cum = anos.filter(a => anosReg[a].CUM > anosReg[a].NC), nc = anos.filter(a => anosReg[a].NC >= anosReg[a].CUM && anosReg[a].NC > 0);
  const faixa = (l, sep) => !l.length ? '' : l.length === 1 ? String(l[0]) : l[0] + sep + l[l.length - 1];
  return [cum.length ? 'PRESUMIDO ' + faixa(cum, ' A ') : '', nc.length ? 'LUCRO REAL ' + faixa(nc, '/') : ''].filter(Boolean).join(' - ');
}
function anosTexto(l) { return l.length === 1 ? String(l[0]) : l.length === 2 ? l[0] + ' e ' + l[1] : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]; }

/* --- preenchimento --- */
async function preencherModelo(bytes, d) {
  const files = fflate.unzipSync(bytes);
  const dec = new TextDecoder(), enc = new TextEncoder();
  const rd = p => files[p] ? dec.decode(files[p]) : null, wr = (p, s) => { files[p] = enc.encode(s); };
  const relat = { feitos: [], pendentes: [] };
  const R = { ENT: d.ent, SAI: d.sai };
  let doc = rd('word/document.xml');
  if (!doc) throw new Error('o arquivo não parece ser um documento do Word (.docx)');
  const textos = DX.paras(doc).map(pp => DX.text(doc.slice(pp.a, pp.b)));
  const todo = textos.join('\n');
  // 1. identificação da empresa do modelo
  let nomeAnt = null;
  for (const t of textos) { const m = /^\s*EMPRESA:\s*(.+?)\s*$/i.exec(t); if (m) { nomeAnt = m[1]; break; } }
  if (!nomeAnt) for (const t of textos) { const m = /^\s*[ÁÀA]\s+([A-ZÀ-Ú0-9][^,]{3,})$/.exec(t.trim()); if (m && /LTDA|S\.?A\.?|ME\b|EIRELI|[A-Z]{4,}/.test(m[1])) { nomeAnt = m[1].trim(); break; } }
  const cnpjAnt = (/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.exec(todo) || [null])[0];
  const perAnt = (/\d{2}\/\d{4}\s+A\s+\d{2}\/\d{4}/.exec(todo) || [null])[0];
  const nome = (d.nome || '').trim().toLocaleUpperCase('pt-BR'), cnpj = fmtCNPJ(d.cnpj);
  const tot = { linhas: [] };

  // 2. troca parágrafo a parágrafo (de trás para frente, para não deslocar as posições)
  const ps = DX.paras(doc);
  const imgDepois = new Map(); // parágrafo de imagem que vem logo depois de um título conhecido
  const marca = (k, i) => { if (!imgDepois.has(k)) imgDepois.set(k, i); };
  let alvo = null;
  ps.forEach((pp, i) => {
    const t = textos[i];
    if (/Evolu[cç][aã]o da Ca\w*ga Tribut[aá]ria/i.test(t)) alvo = 'grafEvol';
    else if (/Carga Tribut[aá]ria PIS E COFINS/i.test(t)) alvo = 'grafPC';
    else if (/Carga Tribut[aá]ria ICMS/i.test(t)) alvo = 'grafICMS';
    else if (/montante total a recuperar equivalente/i.test(t)) alvo = 'ncms';
    else if (/^\s*CONCLUS[AÃ]O\s*$/i.test(t)) alvo = 'resumo';
    const xml = doc.slice(pp.a, pp.b);
    if (alvo && /r:(embed|id)="[^"]+"/.test(xml) && /<w:drawing>|<w:pict|<w:object/.test(xml)) { marca(alvo, i); alvo = null; }
  });
  let capaLogo = -1;
  for (let i = 0; i < ps.length; i++) { const xml = doc.slice(ps[i].a, ps[i].b); if (/^\s*.+?,\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}\.?\s*$/i.test(textos[i])) break; if (/<w:drawing>|<w:pict/.test(xml) && /r:(embed|id)="/.test(xml)) { capaLogo = i; break; } }

  const regs = {
    ent: R.ENT, sai: R.SAI,
    ini: Math.min(...[R.ENT, R.SAI].filter(Boolean).map(r => r.ini)), fim: Math.max(...[R.ENT, R.SAI].filter(Boolean).map(r => r.fim))
  };
  const anosReg = {}; [R.ENT, R.SAI].filter(Boolean).forEach(r => { for (const [a, v] of Object.entries(r.anosReg)) { const x = anosReg[a] || (anosReg[a] = { NC: 0, CUM: 0, SEM: 0 }); x.NC = Math.max(x.NC, v.NC); x.CUM = Math.max(x.CUM, v.CUM); x.SEM = Math.max(x.SEM, v.SEM); } });
  const regAtual = (R.SAI && R.SAI.regimeAtual) || (R.ENT && R.ENT.regimeAtual);
  const regAtualTxt = regAtual === 'CUM' ? 'LUCRO PRESUMIDO' : regAtual === 'NC' ? 'LUCRO REAL' : null;
  const cumAnos = Object.keys(anosReg).map(Number).filter(a => anosReg[a].CUM > anosReg[a].NC).sort();
  const ncAnos = Object.keys(anosReg).map(Number).filter(a => anosReg[a].NC > 0 && anosReg[a].NC >= anosReg[a].CUM).sort();

  // valores do quadro final
  const linhaE = R.ENT ? { t: 'C100 Notas lançadas sem Créditos', ...R.ENT.pot } : null;
  const icm = R.SAI && R.SAI.icms && R.SAI.icms.n && !R.SAI.icms.residual ? R.SAI.icms : null;
  const linhaI = icm ? { t: 'Exclusão do ICMS da BC Pis/Cofins', base: icm.base, pis: icm.pis, cof: icm.cof } : null;
  const linhaZ = R.SAI && (R.SAI.aliqZero.pis + R.SAI.aliqZero.cof) > 0 ? { t: 'PIS e COFINS PAGOS ALIQUOTA 0', ...R.SAI.aliqZero } : null;
  const linhaO = R.SAI && (R.SAI.outrasReceitas.pis + R.SAI.outrasReceitas.cof) > 0 ? { t: 'PIS e COFINS sobre receitas não tributáveis', ...R.SAI.outrasReceitas } : null;
  const linhas = [linhaE, linhaI, linhaZ, linhaO].filter(Boolean);
  const totalGeral = r2(linhas.reduce((a, l) => a + l.pis + l.cof, 0));

  const temRegime = !!(R.ENT || R.SAI);
  for (let i = ps.length - 1; i >= 0; i--) {
    const pp = ps[i]; let p = doc.slice(pp.a, pp.b); const t0 = textos[i]; let q, ok = false; // ok = trecho preenchido e conferido pelo sistema: sai do amarelo
    // nome e CNPJ em todo o documento
    if (nomeAnt && nome && t0.includes(nomeAnt)) { p = DX.replaceAll(p, nomeAnt, nome); if (t0.length < 90 && /^\s*(EMPRESA:|[ÀÁ]\s)/i.test(t0)) ok = true; }
    if (cnpjAnt && cnpj && t0.includes(cnpjAnt)) { p = DX.replaceAll(p, cnpjAnt, cnpj); if (t0.length < 40) ok = true; }
    // data da carta
    if ((q = /^(\s*)(.+?),\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}\.?\s*$/i.exec(DX.text(p))) && DX.text(p).length < 60) { p = DX.setText(p, (d.cidade || q[2]) + ', ' + hoje() + '.'); relat.feitos.push('Data da carta'); ok = true; }
    // período (capa e carta)
    if (perAnt && DX.text(p).includes(perAnt)) { p = DX.replaceAll(p, perAnt, ymL(regs.ini) + ' A ' + ymL(regs.fim)); relat.feitos.push('Período da capa'); ok = true; }
    if ((q = DX.replaceRe(p, /no per[ií]odo de [a-zç]+ de \d{4} a [a-zç]+ de \d{4}/i, () => 'no período de ' + ymLong(regs.ini) + ' a ' + ymLong(regs.fim)))) { p = q; relat.feitos.push('Período da carta'); ok = true; }
    // dados da empresa
    if (Object.keys(anosReg).length && (q = DX.replaceRe(p, /(FORMA DE TRIBUTA[ÇC][ÃA]O ATUAL:\s*)(.+)$/i, m => m[1] + formaTributacao(anosReg)))) { p = q; relat.feitos.push('Forma de tributação'); ok = true; }
    if (/^\s*REGIME DE APURA[ÇC][ÃA]O:/i.test(DX.text(p))) relat.pendentes.push('Regime de apuração do IRPJ/CSLL (trimestral ou anual): vem da ECF, conferir a linha "' + DX.text(p).trim() + '"');
    if (regAtualTxt && (q = DX.replaceRe(p, /atualmente tributada pelo (LUCRO REAL|LUCRO PRESUMIDO|SIMPLES NACIONAL)/i, () => 'atualmente tributada pelo ' + regAtualTxt))) { p = q; if (/^\s*Destacamos que a empresa .{0,160}poder[áa] aproveitar/i.test(DX.text(p))) ok = true; }
    // regimes por ano: sem ano no Presumido, o parágrafo do Presumido sai; sem ano no Real, sai o do Real
    if (temRegime && /^Em \d{4}(?:(?:, \d{4})* e \d{4})? optou pelo Lucro Presumido/i.test(DX.text(p))) {
      if (cumAnos.length) { p = DX.replaceRe(p, /^Em \d{4}(?:(?:, \d{4})* e \d{4})? optou pelo Lucro Presumido/i, () => 'Em ' + anosTexto(cumAnos) + ' optou pelo Lucro Presumido'); ok = true; }
      else p = '';
      relat.feitos.push('Anos no Lucro Presumido');
    }
    if (temRegime && /^A partir de \d{4} adotou o Lucro Real/i.test(DX.text(p))) {
      if (ncAnos.length) { p = DX.replaceRe(p, /^A partir de \d{4} adotou o Lucro Real/i, () => cumAnos.length ? 'A partir de ' + ncAnos[0] + ' adotou o Lucro Real' : 'No período analisado, adotou o Lucro Real'); ok = true; }
      else p = '';
      relat.feitos.push('Ano de entrada no Lucro Real');
    }
    if (p && R.ENT && R.ENT.estoque && /^Em rela[çc][ãa]o aos cr[ée]ditos referente ao estoque de abertura/i.test(DX.text(p))) {
      const e = R.ENT.estoque;
      if (e.st !== 'ok') p = DX.setText(p, e.st === 'info' ? 'Em relação aos créditos referentes ao estoque de abertura, não foi identificado no período analisado o aproveitamento do crédito presumido (registro F150), o que deve ser verificado em relação à data de ingresso da pessoa jurídica no regime de apuração não cumulativa do PIS e COFINS.' : 'Em relação aos créditos referentes ao estoque de abertura, o crédito presumido foi escriturado em ' + e.n + ' parcelas mensais (registro F150), quando o correto são doze parcelas mensais, iguais e sucessivas a partir da data do ingresso da pessoa jurídica no regime de apuração não cumulativa do PIS e COFINS.');
      relat.feitos.push('Estoque de abertura'); ok = true;
    }
    // produtos de alíquota zero vendidos com tributação (047)
    if (p && R.SAI && /al[ií]quota zero nas vendas/i.test(DX.text(p))) {
      const z = R.SAI.zeroNcms || [];
      if (z.length) {
        const lista = anosTexto(z.slice(0, 12).map(x => fmtNCM(x.ncm) + ' (' + x.nome.replace(/\s*\(.*\)/, '').toLowerCase() + ')')) + (z.length > 12 ? ', entre outros' : '');
        const r2_ = DX.replaceRe(p, /(produtos de NCM:?\s*)(\[RELACIONAR OS NCM\]|[\d.]+(?:\s*(?:;|,|e)\s*[\d.]+)*\s*(?:\([^)]*\))?)/i, m => m[1] + lista);
        if (r2_) { p = r2_; ok = true; relat.feitos.push('Produtos de alíquota zero'); }
      } else { p = DX.setText(p, 'No período analisado, não foram identificadas vendas tributadas de produtos sujeitos à alíquota zero ou à incidência monofásica.'); ok = true; relat.feitos.push('Produtos de alíquota zero'); }
    }
    // ICMS na base dos débitos (047)
    if (R.SAI && R.SAI.icms && /exclus[ãa]o do ICMS da Base de C[áa]lculo do PIS e COFINS/i.test(DX.text(p)) && /levantamento apontou|j[áa] utiliza a exclus[ãa]o/i.test(DX.text(p))) {
      const ic = R.SAI.icms, per = ymL(R.SAI.ini) + ' a ' + ymL(R.SAI.fim), quem = 'A empresa ' + (nome || 'EMPRESA') + (regAtualTxt ? ' atualmente tributada pelo ' + regAtualTxt : '');
      const txt = ic.n && !ic.residual
        ? quem + (ic.first ? ' já utiliza a exclusão do ICMS da Base de Cálculo do PIS e COFINS a partir da competência ' + ymL(ic.first) + ', no entanto, o levantamento apontou ' : ' não utiliza a exclusão do ICMS da Base de Cálculo do PIS e COFINS, e o levantamento apontou ') + fBRL(ic.v) + ' de PIS e COFINS pagos sobre valores de ICMS ainda não descontados da base de cálculo no período analisado de ' + ymL(ic.mi) + ' a ' + ymL(ic.ma) + '.'
        : quem + ' já utiliza a exclusão do ICMS da Base de Cálculo do PIS e COFINS ' + (ic.first && ic.first > R.SAI.ini ? 'a partir da competência ' + ymL(ic.first) : 'em todo o período analisado (' + per + ')') + (ic.n ? ', restando apenas valores residuais de ' + fBRL(ic.v) + '.' : ', não havendo valores a recuperar.');
      p = DX.setText(p, txt); relat.feitos.push('Exclusão do ICMS da base (saídas)'); ok = true;
    }
    // ICMS na base do crédito (037)
    if (R.ENT && R.ENT.icmsCred && /ICMS da base de c[áa]lculo do cr[ée]dito/i.test(DX.text(p))) {
      const v = R.ENT.icmsCred.v;
      p = v > 0 ? (DX.replaceRe(p, /(cr[ée]dito indevido no valor de )R\$\s*[\d.]+,\d{2}/i, m => m[1] + fBRL(v)) || p)
        : DX.setText(p, 'Foi constatado também que a empresa desconta corretamente o ICMS da base de cálculo do crédito de PIS e COFINS a partir de 1º de maio de 2023, conforme a Lei 14.592/2023.');
      relat.feitos.push('ICMS na base do crédito (entradas)'); ok = true;
    }
    // lançamentos sem crédito (037)
    if (R.ENT && (q = DX.replaceRe(p, /(montante total a recuperar equivalente a )R\$\s*[\d.]+,\d{2}/i, m => m[1] + fBRL(R.ENT.pot.pis + R.ENT.pot.cof)))) { p = q; relat.feitos.push('Total das notas lançadas sem crédito'); ok = true; }
    if (R.ENT && /aproveitamento incorreto de PIS e COFINS/i.test(DX.text(p)) && /uso e consumo/i.test(DX.text(p))) {
      p = R.ENT.usoConsumo > 0 ? (DX.replaceRe(p, /(no valor total de )R\$\s*[\d.]+,\d{2}/i, m => m[1] + fBRL(R.ENT.usoConsumo)) || p) : DX.setText(p, 'Não foi verificado aproveitamento incorreto de PIS e COFINS referente a produtos adquiridos para uso e consumo.');
      relat.feitos.push('Crédito indevido em uso e consumo'); ok = true;
    }
    // total da conclusão
    if (linhas.length && (q = DX.replaceRe(p, /(identifica[çc][ãa]o do montante de )R\$\s*[\d.]+,\d{2}/i, m => m[1] + fBRL(totalGeral)))) { p = q; relat.feitos.push('Total da conclusão'); ok = true; }
    if (ok && p) p = p.replace(/<w:highlight w:val="[^"]*"\/>/g, '');

    // imagens
    if (!p) { doc = doc.slice(0, pp.a) + doc.slice(pp.b); continue; }
    const semImg = (rot) => '<w:p>' + DX.pPr(p) + DX.hlRun('[' + rot + ']', DX.rPr(p)) + '</w:p>';
    if (i === imgDepois.get('grafEvol')) { p = semImg('Colar aqui o gráfico "Evolução da Carga Tributária" do SistemaMA desta empresa'); relat.pendentes.push('Gráfico Evolução da Carga Tributária (SistemaMA)'); }
    else if (i === imgDepois.get('grafPC')) { p = semImg('Colar aqui o gráfico "Carga Tributária PIS e COFINS" do SistemaMA desta empresa'); relat.pendentes.push('Gráfico Carga Tributária PIS e COFINS (SistemaMA)'); }
    else if (i === imgDepois.get('grafICMS')) { p = semImg('Colar aqui o gráfico "Carga Tributária ICMS" do SistemaMA desta empresa'); relat.pendentes.push('Gráfico Carga Tributária ICMS (SistemaMA)'); }
    else if (i === imgDepois.get('ncms')) {
      if (R.ENT && R.ENT.ncms.length) {
        const top = R.ENT.ncms.slice(0, 40), resto = R.ENT.ncms.slice(40);
        const rows = top.map(x => [fmtNCM(x.ncm), x.desc, fNum(x.n), fBRL(x.pis + x.cof)]);
        if (resto.length) rows.push(['Demais ' + resto.length + ' NCM', '', fNum(resto.reduce((a, x) => a + x.n, 0)), fBRL(resto.reduce((a, x) => a + x.pis + x.cof, 0))]);
        rows.push(['Total', '', fNum(R.ENT.ncms.reduce((a, x) => a + x.n, 0)), fBRL(R.ENT.pot.pis + R.ENT.pot.cof)]);
        p = dxTabela([{ h: 'NCM', w: 1300 }, { h: 'Produto', w: 4700 }, { h: 'Itens', w: 900, right: true }, { h: 'PIS + COFINS', w: 2000, right: true }], rows, { totalLast: true }) + '<w:p>' + DX.pPr(p) + '</w:p>';
        relat.feitos.push('Lista dos NCM com crédito');
      } else { p = semImg('Inserir a relação dos NCM com crédito'); relat.pendentes.push('Relação dos NCM com crédito (falta a planilha 037)'); }
    }
    else if (i === imgDepois.get('resumo')) {
      const rows = linhas.map(l => [l.t, fBRL(l.base), fBRL(l.pis), fBRL(l.cof), fBRL(l.pis + l.cof)]);
      rows.push(['', fBRL(linhas.reduce((a, l) => a + l.base, 0)), fBRL(linhas.reduce((a, l) => a + l.pis, 0)), fBRL(linhas.reduce((a, l) => a + l.cof, 0)), fBRL(totalGeral)]);
      p = dxTabela([{ h: '', w: 3300 }, { h: 'Base de Cálculo Total', w: 1700, right: true }, { h: 'PIS (1,65%)', w: 1300, right: true }, { h: 'COFINS (7,60%)', w: 1400, right: true }, { h: 'TOTAL', w: 1400, right: true }], rows, { totalLast: true }) +
        '<w:p>' + DX.pPr(p) + DX.hlRun('Acrescentar ao quadro os créditos levantados na ECD (energia elétrica, fretes, depreciação), se houver.', DX.rPr(p)) + '</w:p>';
      relat.feitos.push('Quadro-resumo dos valores'); relat.pendentes.push('Créditos da ECD no quadro-resumo (energia, fretes, depreciação)');
    }
    else if (i === capaLogo) {
      if (d.logoCliente) {
        const id = 'rIdRFlogo', w = d.logoCliente.w, h = d.logoCliente.h;
        p = p.replace(/r:embed="[^"]+"/, 'r:embed="' + id + '"').replace(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/, (m, cx, cy) => '<wp:extent cx="' + Math.round(+cy * w / h) + '" cy="' + cy + '"/>');
        p = p.replace(/<a:ext cx="(\d+)" cy="(\d+)"\/>/, (m, cx, cy) => '<a:ext cx="' + Math.round(+cy * w / h) + '" cy="' + cy + '"/>');
        const bin = atob(d.logoCliente.data.split(',')[1]), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
        files['word/media/rf_logo_cliente.png'] = u8;
        relat.feitos.push('Logotipo do cliente na capa');
      } else { p = '<w:p>' + DX.pPr(p) + DX.hlRun('[LOGOTIPO DO CLIENTE]', DX.rPr(p)) + '</w:p>'; relat.pendentes.push('Logotipo do cliente na capa'); }
    }
    doc = doc.slice(0, pp.a) + p + doc.slice(pp.b);
  }
  wr('word/document.xml', doc);

  // 3. cabeçalhos e rodapés: só nome e CNPJ
  for (const k of Object.keys(files)) if (/^word\/(header|footer)\d*\.xml$/.test(k)) {
    let x = rd(k); const pr = DX.paras(x);
    for (let i = pr.length - 1; i >= 0; i--) { let p = x.slice(pr[i].a, pr[i].b); if (nomeAnt && nome) p = DX.replaceAll(p, nomeAnt, nome); if (cnpjAnt && cnpj) p = DX.replaceAll(p, cnpjAnt, cnpj); x = x.slice(0, pr[i].a) + p + x.slice(pr[i].b); }
    wr(k, x);
  }
  // 4. relações: logotipo novo e remoção das imagens antigas que deixaram de ser usadas (não fica dado da outra empresa no arquivo)
  let rels = rd('word/_rels/document.xml.rels');
  if (rels) {
    if (d.logoCliente && capaLogo >= 0) rels = rels.replace('</Relationships>', '<Relationship Id="rIdRFlogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/rf_logo_cliente.png"/></Relationships>');
    const usados = new Set((doc.match(/r:(?:embed|id|link|pict)="([^"]+)"/g) || []).map(s => s.replace(/^.*="|"$/g, '')));
    rels = rels.replace(/<Relationship\b[^>]*\/>/g, tag => {
      const id = (/\bId="([^"]+)"/.exec(tag) || [])[1], tp = (/\bType="([^"]+)"/.exec(tag) || [])[1] || '', tg = (/\bTarget="([^"]+)"/.exec(tag) || [])[1];
      if (/\/image$/.test(tp) && !usados.has(id)) { if (tg && !/^https?:/.test(tg)) delete files['word/' + tg.replace(/^\.\//, '')]; return ''; }
      return tag;
    });
    wr('word/_rels/document.xml.rels', rels);
  }
  let ct = rd('[Content_Types].xml');
  if (ct && !/Extension="png"/i.test(ct)) wr('[Content_Types].xml', ct.replace('<Default ', '<Default Extension="png" ContentType="image/png"/><Default '));
  const core = rd('docProps/core.xml');
  if (core) wr('docProps/core.xml', core.replace(/<dc:title>[^<]*<\/dc:title>|<dc:title\/>/, '<dc:title>' + xmlEsc('Diagnóstico Fiscal - ' + (nome || '')) + '</dc:title>'));
  // conferência: valores em R$ que continuam iguais aos do modelo
  const final = DX.paras(doc).map(pp => DX.text(doc.slice(pp.a, pp.b)));
  if (nomeAnt && nome && normKey(nomeAnt) !== normKey(nome) && final.some(t => t.includes(nomeAnt))) relat.pendentes.push('O nome da empresa do modelo ainda aparece em algum trecho');
  if (!R.ENT) relat.pendentes.push('Valores das entradas: carregue também a planilha 037 desta empresa (notas sem crédito, ICMS na base do crédito, uso e consumo)');
  if (!R.SAI) relat.pendentes.push('Valores das saídas: carregue também a planilha 047 desta empresa (exclusão do ICMS, alíquota zero e monofásicos)');
  if (!nomeAnt) relat.pendentes.push('Não achei o nome da empresa do modelo (linha "EMPRESA:" ou "À ...") para trocar');
  relat.amarelo = DX.paras(doc).map(pp => doc.slice(pp.a, pp.b)).filter(p => /w:highlight/.test(p)).map(p => DX.text(p).trim()).filter(t => t && !/^REGIME DE APURA/i.test(t)).map(t => t.length > 110 ? t.slice(0, 107).trim() + '…' : t);
  relat.nomeModelo = nomeAnt; relat.cnpjModelo = cnpjAnt;
  relat.feitos = [...new Set(relat.feitos)]; relat.pendentes = [...new Set(relat.pendentes)];
  return { bytes: fflate.zipSync(files, { level: 6 }), relat };
}

/* modelo padrão: o diagnóstico da Milk, com a estrutura, os textos e a formatação de sempre e sem dado de nenhum cliente.
   Quem quiser pode carregar outro .docx (por exemplo, o de uma empresa parecida) no Exportar. */
const MODELO_MILK_B64 = '{{MODELO_MILK}}';
let _modeloPadrao = null;
function modeloPadrao() {
  if (_modeloPadrao) return _modeloPadrao;
  if (MODELO_MILK_B64.startsWith('{{')) return null;
  const bin = atob(MODELO_MILK_B64), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
  return (_modeloPadrao = u8);
}
const modeloBytes = () => (S.modelo && S.modelo.bytes) || modeloPadrao();

/* dados das análises abertas para o modelo */
function dadosModelo() {
  return { nome: S.empresa.nome, cnpj: S.empresa.cnpj, cidade: S.settings.cidade, ent: resumoDe('ENT'), sai: resumoDe('SAI'), logoCliente: S.logoCliente || null };
}
