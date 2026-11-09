/* ================= leitor de .xlsx em fluxo (exportações grandes do SistemaMA) ================= */
/* A exportação "Todos os Registros - Completo" chega a 80 mil linhas e 220 MB de XML descompactado: carregar tudo de
   uma vez estoura a memória do navegador. Aqui o .xlsx é lido aos pedaços: o índice do ZIP é lido do fim do arquivo,
   cada parte é descompactada em blocos (fflate) e as linhas são montadas à medida que o XML chega. */

const XR = {
  async bytes(file, a, b) { return new Uint8Array(await file.slice(a, b).arrayBuffer()); },
  u64(dv, p) { return dv.getUint32(p, true) + dv.getUint32(p + 4, true) * 4294967296; },

  async dir(file) {
    const size = file.size, tailLen = Math.min(size, 65557 + 22);
    const tail = await XR.bytes(file, size - tailLen, size), tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    let e = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 5 && tail[i + 3] === 6) { e = i; break; }
    if (e < 0) throw new Error('o arquivo não é um .xlsx (ZIP) válido');
    let n = tv.getUint16(e + 10, true), cdSize = tv.getUint32(e + 12, true), cdOff = tv.getUint32(e + 16, true);
    if ((cdOff === 0xFFFFFFFF || n === 0xFFFF || cdSize === 0xFFFFFFFF) && e >= 20 && tv.getUint32(e - 20, true) === 0x07064b50) { // ZIP64
      const z64 = XR.u64(tv, e - 20 + 8), rec = new DataView((await XR.bytes(file, z64, z64 + 56)).buffer);
      n = XR.u64(rec, 32); cdSize = XR.u64(rec, 40); cdOff = XR.u64(rec, 48);
    }
    const cd = await XR.bytes(file, cdOff, cdOff + cdSize), cv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
    const dec = new TextDecoder(), out = new Map();
    for (let k = 0, p = 0; k < n && p + 46 <= cd.length; k++) {
      if (cv.getUint32(p, true) !== 0x02014b50) break;
      const method = cv.getUint16(p + 10, true), nl = cv.getUint16(p + 28, true), el = cv.getUint16(p + 30, true), cl = cv.getUint16(p + 32, true);
      let csize = cv.getUint32(p + 20, true), usize = cv.getUint32(p + 24, true), off = cv.getUint32(p + 42, true);
      const name = dec.decode(cd.subarray(p + 46, p + 46 + nl));
      if (csize === 0xFFFFFFFF || usize === 0xFFFFFFFF || off === 0xFFFFFFFF) { // campo extra ZIP64
        for (let q = p + 46 + nl, end = q + el; q + 4 <= end;) {
          const id = cv.getUint16(q, true), len = cv.getUint16(q + 2, true);
          if (id === 1) { let r = q + 4; if (usize === 0xFFFFFFFF) { usize = XR.u64(cv, r); r += 8; } if (csize === 0xFFFFFFFF) { csize = XR.u64(cv, r); r += 8; } if (off === 0xFFFFFFFF) off = XR.u64(cv, r); }
          q += 4 + len;
        }
      }
      out.set(name.replace(/^\/+/, '').toLowerCase(), { name, method, csize, usize, off });
      p += 46 + nl + el + cl;
    }
    return out;
  },

  /* descompacta uma parte do ZIP em blocos; onText recebe o XML em pedaços. Devolve quando onText pedir para parar. */
  async stream(file, ent, onText, onProgress) {
    const lh = new DataView((await XR.bytes(file, ent.off, ent.off + 30)).buffer);
    if (lh.getUint32(0, true) !== 0x04034b50) throw new Error('estrutura ZIP inválida');
    const start = ent.off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true), end = start + ent.csize;
    const dec = new TextDecoder('utf-8');
    let stop = false;
    const emit = (chunk, final) => { if (!stop && onText(dec.decode(chunk, { stream: !final }), final) === false) stop = true; };
    let inf = null;
    if (ent.method === 8) inf = new fflate.Inflate(emit);
    else if (ent.method !== 0) throw new Error('método de compressão não suportado (' + ent.method + ')');
    const STEP = 1 << 20;
    let t = now();
    for (let pos = start; pos < end && !stop; pos += STEP) {
      const last = pos + STEP >= end;
      const buf = await XR.bytes(file, pos, Math.min(end, pos + STEP));
      if (inf) inf.push(buf, last); else emit(buf, last);
      if (now() - t > 120) { if (onProgress) onProgress((pos - start) / Math.max(1, end - start)); await tick(); t = now(); }
    }
    if (!stop && end === start) onText('', true);
  },

  async text(file, ent) {
    let s = ''; await XR.stream(file, ent, (t) => { s += t; }); return s;
  },

  unesc(s) {
    if (s.indexOf('&') >= 0) s = s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) =>
      e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e]);
    if (s.indexOf('_x') >= 0) s = s.replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
    return s;
  },
  richText(inner) { // concatena os <t> (ignora a transcrição fonética <rPh>)
    if (inner.indexOf('<rPh') >= 0) inner = inner.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    let s = '', m; const re = /<(?:\w+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g;
    while ((m = re.exec(inner))) if (m[1]) s += m[1];
    return XR.unesc(s);
  },
  colIdx(letters) { let n = 0; for (let i = 0; i < letters.length; i++) n = n * 26 + letters.charCodeAt(i) - 64; return n - 1; },

  async sharedStrings(file, ent) {
    const sst = []; let buf = '';
    await XR.stream(file, ent, (t, final) => {
      buf += t;
      const end = final ? buf.length : buf.lastIndexOf('</si>') + 5;
      if (end < 5) return;
      const part = buf.slice(0, end); buf = buf.slice(end);
      const re = /<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g; let m;
      while ((m = re.exec(part))) sst.push(m[1] ? XR.richText(m[1]) : '');
    });
    return sst;
  },

  /* lê as linhas de uma aba; maxRows > 0 para só espiar o começo */
  async rows(file, ent, sst, opt = {}) {
    const out = [], intern = new Map();
    const IS = s => { if (s.length > 48) return s; let v = intern.get(s); if (v === undefined) { if (intern.size < 300000) intern.set(s, s); v = s; } return v; };
    const rowRe = /<(?:\w+:)?row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g;
    const cellRe = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
    const vRe = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/;
    let buf = '', done = false;
    const parse = part => {
      rowRe.lastIndex = 0; let m;
      while ((m = rowRe.exec(part))) {
        const row = [];
        if (m[1]) {
          cellRe.lastIndex = 0; let c, seq = 0;
          while ((c = cellRe.exec(m[1]))) {
            const at = c[1], inner = c[2];
            const rm = /\br="([A-Z]+)/.exec(at), col = rm ? XR.colIdx(rm[1]) : seq;
            seq = col + 1;
            if (!inner) continue;
            const tm = /\bt="(\w+)"/.exec(at), t = tm ? tm[1] : 'n';
            let v = null;
            if (t === 'inlineStr') v = XR.richText(inner);
            else {
              const vm = vRe.exec(inner);
              if (vm) {
                if (t === 's') v = sst[+vm[1]];
                else if (t === 'str' || t === 'e' || t === 'd') v = XR.unesc(vm[1]);
                else if (t === 'b') v = vm[1] === '1';
                else { const n = +vm[1]; v = isFinite(n) ? n : XR.unesc(vm[1]); }
              } else if (t === 'str' || t === 's') v = '';
            }
            if (typeof v === 'string') v = v === '' ? null : IS(v);
            row[col] = v;
          }
        }
        for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = null;
        out.push(row);
        if (opt.maxRows && out.length >= opt.maxRows) { done = true; return; }
      }
    };
    await XR.stream(file, ent, (t, final) => {
      buf += t;
      let end;
      if (final) end = buf.length;
      else { // fim do último </row> completo (com ou sem prefixo de namespace)
        let k = buf.length;
        for (;;) { k = k > 0 ? buf.lastIndexOf('row>', k - 1) : -1; if (k < 0) return; const lt = buf.lastIndexOf('<', k); if (lt >= 0 && buf[lt + 1] === '/' && /^<\/(\w+:)?$/.test(buf.slice(lt, k))) break; }
        end = k + 4;
      }
      const part = buf.slice(0, end); buf = buf.slice(end);
      parse(part);
      if (opt.onRows) opt.onRows(out.length);
      if (done) return false;
    }, opt.onProgress);
    if (buf && !done) parse(buf);
    return out;
  }
};

/* Lê a planilha da exportação. Devolve { headers, rows, sheet }. */
/* cabeçalho de planilha conhecida: 037/047 (CFOP e Vlr PIS) ou complementar (Junção 513, ECF) */
const cabecalhoConhecido = ks => (ks.includes('cfop') && ks.includes('vlr pis')) || !!tipoExtra(ks);
async function readXlsxStream(file, onProgress) {
  const dir = await XR.dir(file);
  const get = p => dir.get(p.replace(/^\/+/, '').toLowerCase());
  const wbEnt = get('xl/workbook.xml');
  if (!wbEnt) throw new Error('o arquivo não tem a estrutura de uma planilha Excel (.xlsx)');
  const wb = await XR.text(file, wbEnt), relsEnt = get('xl/_rels/workbook.xml.rels');
  const rels = relsEnt ? await XR.text(file, relsEnt) : '';
  const target = {};
  rels.replace(/<(?:\w+:)?Relationship\b[^>]*>/g, tag => { const id = /\bId="([^"]+)"/.exec(tag), tg = /\bTarget="([^"]+)"/.exec(tag); if (id && tg) target[id[1]] = tg[1]; return ''; });
  const sheets = [];
  wb.replace(/<(?:\w+:)?sheet\b[^>]*>/g, tag => {
    const nm = /\bname="([^"]*)"/.exec(tag), rid = /\br:id="([^"]+)"/.exec(tag) || /\b\w+:id="([^"]+)"/.exec(tag);
    let p = rid && target[rid[1]]; if (!p) return '';
    p = p.startsWith('/') ? p.slice(1) : 'xl/' + p.replace(/^\.\//, '');
    const ent = get(p); if (ent) sheets.push({ name: nm ? XR.unesc(nm[1]) : p, ent });
    return '';
  });
  if (!sheets.length) throw new Error('nenhuma aba encontrada no arquivo');
  const sstEnt = get('xl/sharedStrings.xml');
  const sst = sstEnt ? await XR.sharedStrings(file, sstEnt) : [];
  // procura a aba com o cabeçalho da exportação (CFOP e Vlr PIS) nas 12 primeiras linhas
  const findHeader = rows => { for (let i = 0; i < rows.length; i++) { const ks = (rows[i] || []).map(normKey); if (cabecalhoConhecido(ks)) return i; } return -1; };
  let best = null; const achadas = [];
  for (const sh of sheets) {
    const head = await XR.rows(file, sh.ent, sst, { maxRows: 12 });
    const hr = findHeader(head);
    if (hr >= 0) achadas.push(Object.assign({ hr, cab: head[hr].map(normKey) }, sh));
    if (hr >= 0 && (!best || sh.ent.usize > best.ent.usize)) best = Object.assign({ hr, cab: head[hr].map(normKey) }, sh);
  }
  if (!best) return null;
  // Junção 513 já trabalhada: a analista separa ENTRADAS e SAÍDAS em abas; junta as abas com o mesmo cabeçalho
  const mesmas = tipoExtra(best.cab) === 'J513' ? achadas.filter(a => a.cab.filter(Boolean).join('|').startsWith(best.cab.filter(Boolean).join('|').slice(0, 200))) : [best];
  if (mesmas.length > 1) {
    const rows = []; let headers = null;
    for (const a of mesmas) {
      const all = await XR.rows(file, a.ent, sst, { onProgress, onRows: null });
      if (!headers) headers = (all[a.hr] || []).map(h => h == null ? '' : String(h).trim());
      for (let i = a.hr + 1; i < all.length; i++) { const r = all[i]; if (r && r.some(v => v != null && v !== '')) rows.push(r); }
    }
    return { headers, rows, sheet: mesmas.map(a => a.name).join(' + ') };
  }
  const all = await XR.rows(file, best.ent, sst, { onProgress, onRows: null });
  const headers = (all[best.hr] || []).map(h => h == null ? '' : String(h).trim());
  const rows = [];
  for (let i = best.hr + 1; i < all.length; i++) { const r = all[i]; if (r && r.some(v => v != null && v !== '')) rows.push(r); }
  all.length = 0;
  while (rows.length && !rows[rows.length - 1].slice(0, 3).some(v => v != null && v !== '')) rows.pop();
  return { headers, rows, sheet: best.name };
}
