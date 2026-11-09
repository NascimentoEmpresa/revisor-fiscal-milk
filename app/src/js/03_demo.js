/* ===================== dados de demonstração (fictícios) ===================== */
/* Empresa, fornecedores e valores inventados. Estrutura idêntica à planilha 037 do SistemaMA. */
const DEMO_EMPRESA = { nome: 'Casa Forte Materiais de Construção Ltda', cnpj: '11222333000181' };

function buildDemo() {
  const R = rng(20261026);
  const pick = a => a[Math.floor(R() * a.length)];
  const between = (a, b) => a + R() * (b - a);
  const int = (a, b) => Math.floor(between(a, b + 1));
  const reg = {
    C: 'C100/C170 - Documento - Nota Fiscal', A: 'A100/A170 - Nota Fiscal de Serviço', E: 'C500/C501 - Nota Fiscal/Conta de Energia Elétrica',
    F: 'F100 - Demais Documentos e Operações', K: 'F150 - Crédito Presumido sobre Estoque de Abertura'
  };
  const NAT = { rev: '01 - Aquisição de bens para revenda', ene: '04 - Energia elétrica e térmica, inclusive sob a forma de vapor', alu: '05 - Aluguéis de prédios', est: '18 - Estoque de abertura de bens' };
  const TIPO = { rev: '00 - Mercadoria para Revenda', uso: '07 - Material de Uso e Consumo', atv: '08 - Ativo Imobilizado', srv: '09 - Serviços', out: '99 - Outras' };

  // fornecedores fictícios
  let pc = 100;
  const F = (nome, uf) => ({ cod: String(pc++), nome, uf, cnpj: String(10 + Math.floor(R() * 89)) + String(Math.floor(R() * 1e6)).padStart(6, '0') + '0001' + String(int(10, 99)) });
  const S = {
    cimento: F('Cimentos Serra Gaúcha S.A.', 'RS'), tintas: F('Tintas Aurora Ltda', 'SP'), hidra: F('Hidráulica Vale do Caí Ltda', 'RS'),
    ferr: F('Ferragens Taquari Ltda', 'RS'), elet: F('Elétrica Guaíba Distribuidora Ltda', 'RS'), cer: F('Cerâmica Santa Clara Ltda', 'SC'),
    plast: F('Plásticos Pampa Indústria Ltda', 'PR'), aco: F('Aços Missões Comércio Ltda', 'RS'), mad: F('Madeireira Três Pinheiros Ltda', 'SC'),
    metais: F('Metais Serra Azul Ltda', 'SP'), areia: F('Areeira Rio Caí Ltda', 'RS'), posto: F('Posto Estrada Real Ltda', 'RS'),
    papel: F('Papelaria Central Ltda', 'RS'), merc: F('Supermercado Bom Preço Ltda', 'RS'), unif: F('Confecções Vale Verde Ltda', 'RS'),
    tec: F('Assistência Técnica Rio Pardo Ltda', 'RS'), pneu: F('Pneus Litoral Comércio Ltda', 'PR'), agro: F('Agro Sul Insumos Ltda', 'RS'),
    cal: F('Cal Pampeana Mineração Ltda', 'RS'), cont: F('Contabilidade Horizonte S/S', 'RS'), seg: F('Prevenção Segurança do Trabalho Ltda', 'RS'),
    energ: F('Distribuidora de Energia Sul S.A.', 'RS'), imob: F('Imobiliária Centro Norte Ltda', 'RS'), maq: F('Máquinas Serra Equipamentos Ltda', 'RS'),
    limp: F('Comercial Higiene Sul Ltda', 'RS'), epi: F('EPI Proteção Industrial Ltda', 'SC'), info: F('Infotec Suprimentos de Informática Ltda', 'RS'),
    frota: F('Auto Peças Rodovia Ltda', 'RS'), emb: F('Embalagens Vale do Taquari Ltda', 'RS')
  };
  // uso e consumo, frota e embalagens: [código, descrição, NCM, unidade, preço mín., preço máx., alíquota ICMS, fornecedor]
  const USO = [
    ['340220', 'DETERGENTE NEUTRO 5L', '34022000', 'GL', 18, 26, .17, 'limp'], ['481820', 'PAPEL TOALHA INTERFOLHA CX 1000', '48182000', 'CX', 21, 32, .17, 'limp'],
    ['340111', 'SABONETE LIQUIDO 5L', '34013000', 'GL', 24, 35, .17, 'limp'], ['392321', 'SACO DE LIXO 100L PCT 100', '39232190', 'PC', 38, 52, .17, 'limp'],
    ['401519', 'LUVA DE PROTECAO NITRILICA PAR', '40151900', 'PR', 6, 11, .12, 'epi'], ['640340', 'BOTINA DE SEGURANCA BICO PVC', '64034000', 'PR', 69, 95, .12, 'epi'],
    ['650610', 'CAPACETE DE SEGURANCA ABA FRONTAL', '65061000', 'UN', 19, 29, .12, 'epi'], ['900490', 'OCULOS DE PROTECAO INCOLOR', '90049090', 'UN', 8, 14, .12, 'epi'],
    ['844399', 'TONER IMPRESSORA LASER', '84439933', 'UN', 189, 260, .17, 'info'], ['960810', 'CANETA ESFEROGRAFICA AZUL CX 50', '96081000', 'CX', 39, 55, .17, 'info'],
    ['870830', 'PASTILHA DE FREIO CAMINHAO', '87083090', 'JG', 290, 420, .17, 'frota'], ['842123', 'FILTRO DE OLEO CAMINHAO', '84212300', 'UN', 58, 89, .17, 'frota'],
    ['401120', 'PNEU CAMINHAO 275/80 R22,5', '40112090', 'UN', 1890, 2350, .12, 'frota'], ['851220', 'LANTERNA TRASEIRA CAMINHAO', '85122021', 'UN', 120, 180, .17, 'frota'],
    ['392321', 'SACOLA PLASTICA PERSONALIZADA MIL', '39232190', 'MIL', 210, 290, .17, 'emb'], ['481910', 'CAIXA PAPELAO ONDULADO P/ ENTREGA', '48191000', 'UN', 2.1, 3.6, .17, 'emb']
  ];
  // catálogo de revenda: [código, descrição, NCM, unidade, preço mín., preço máx., alíquota ICMS, ST?, fornecedor]
  const CAT = [
    ['100231', 'CIMENTO CP II-F-32 50KG', '25232910', 'SC', 31, 39, 0, true, 'cimento'],
    ['100245', 'ARGAMASSA AC-I INTERNA 20KG', '38245000', 'SC', 11, 16, 0, true, 'cimento'],
    ['100310', 'TIJOLO CERAMICO 6 FUROS 9X14X19', '69041000', 'MIL', 780, 980, .12, false, 'cer'],
    ['100318', 'TELHA CERAMICA PORTUGUESA', '69051000', 'MIL', 2100, 2700, .12, false, 'cer'],
    ['100322', 'PISO CERAMICO 45X45 PEI 4 CX 2,0M2', '69072100', 'CX', 42, 61, .12, false, 'cer'],
    ['100330', 'VASO SANITARIO C/ CAIXA ACOPLADA BRANCO', '69101000', 'UN', 289, 389, 0, true, 'cer'],
    ['200105', 'TUBO PVC ESGOTO 100MM 6M', '39172300', 'BR', 61, 82, .17, false, 'plast'],
    ['200112', 'TUBO PVC SOLDAVEL 25MM 6M', '39172300', 'BR', 21, 29, .17, false, 'plast'],
    ['200118', 'JOELHO PVC SOLDAVEL 25MM 90G', '39174090', 'PC', 1.1, 1.9, .17, false, 'plast'],
    ['200121', 'CAIXA D AGUA POLIETILENO 1000L', '39251000', 'UN', 389, 489, .17, false, 'plast'],
    ['200140', 'MANGUEIRA JARDIM 1/2 30M', '39173290', 'RL', 58, 86, .17, false, 'plast'],
    ['300210', 'TINTA ACRILICA FOSCA BRANCA 18L', '32091010', 'GL', 239, 329, 0, true, 'tintas'],
    ['300214', 'MASSA CORRIDA PVA 25KG', '32149000', 'GL', 61, 82, 0, true, 'tintas'],
    ['300219', 'SELADOR ACRILICO 18L', '32091010', 'GL', 151, 199, 0, true, 'tintas'],
    ['300225', 'SPRAY ESMALTE PRETO FOSCO 400ML', '32089010', 'TB', 14, 21, 0, true, 'tintas'],
    ['400110', 'VERGALHAO CA-50 10MM 12M', '72142000', 'BR', 41, 58, .12, false, 'aco'],
    ['400114', 'TELA SOLDADA Q-92 2X3M', '73144100', 'PC', 79, 108, .12, false, 'aco'],
    ['400121', 'PREGO 18X27 COM CABECA 1KG', '73170020', 'KG', 15, 21, .17, false, 'ferr'],
    ['400125', 'PARAFUSO SEXTAVADO 1/4 X 2', '73181500', 'CT', 23, 34, .17, false, 'ferr'],
    ['400130', 'FECHADURA EXTERNA CROMADA', '83014000', 'UN', 69, 98, .17, false, 'ferr'],
    ['400134', 'DOBRADICA 3 1/2 ZINCADA CJ 3', '83021000', 'CJ', 17, 26, .17, false, 'ferr'],
    ['500101', 'FIO FLEXIVEL 2,5MM 100M AZUL', '85444900', 'RL', 159, 219, 0, true, 'elet'],
    ['500106', 'DISJUNTOR MONOPOLAR 20A', '85362000', 'UN', 12, 19, 0, true, 'elet'],
    ['500110', 'LAMPADA LED BULBO 9W BIVOLT', '85395200', 'UN', 6.5, 10.9, 0, true, 'elet'],
    ['500115', 'CHUVEIRO ELETRICO 5500W 220V', '85161000', 'UN', 79, 119, 0, true, 'elet'],
    ['600102', 'TORNEIRA PAREDE METAL 1/2', '84818019', 'UN', 39, 61, .17, false, 'hidra'],
    ['600108', 'REGISTRO GAVETA 3/4 BRUTO', '84818095', 'UN', 31, 46, .17, false, 'hidra'],
    ['600112', 'CAIXA SIFONADA 100X100X50', '39229000', 'UN', 9, 15, .17, false, 'hidra']
  ];
  const ufPair = uf => uf + '/RS';
  const rows = [];
  let numSeq = 40000;
  const chave = (ym, sup, num) => {
    const yy = String(Math.floor(ym / 100) % 100), mm = String(ym % 100).padStart(2, '0');
    let k = '43' + yy + mm + sup.cnpj + '55' + '001' + String(num).padStart(9, '0') + '1' + String(int(10000000, 99999999));
    let s = 0, w = 2; for (let i = k.length - 1; i >= 0; i--) { s += (+k[i]) * w; w = w === 9 ? 2 : w + 1; }
    const dv = 11 - (s % 11); return k + (dv >= 10 ? 0 : dv);
  };
  const dt = (y, m, d) => new Date(y, m - 1, d);

  function push(o) {
    const r = new Array(MA037.length).fill(null);
    const y = Math.floor(o.ym / 100), m = o.ym % 100;
    const day = o.day || int(1, 28);
    const vItem = r2(o.vItem);
    const icms = o.icms != null ? r2(o.icms) : 0;
    const credito = o.cst === '50' || o.cst === '60';
    const aliqP = o.aliqP != null ? o.aliqP : (credito ? 1.65 : 0);
    const aliqC = o.aliqC != null ? o.aliqC : (credito ? 7.6 : 0);
    let bc = 0;
    if (credito) bc = o.bcFull ? vItem : r2(vItem - (o.ym >= 202305 ? icms : 0));
    const cstC = o.cstC || o.cst;
    const credC = cstC === '50' || cstC === '60';
    Object.assign(r, {
      0: DEMO_EMPRESA.cnpj, 1: dt(y, m, 1), 2: reg[o.reg || 'C'], 3: o.modelo != null ? o.modelo : '55', 4: '00',
      5: o.sup ? o.sup.cod : '', 6: o.sup ? o.sup.cnpj : '', 7: '', 8: o.sup ? o.sup.nome : '', 9: o.sup ? ufPair(o.sup.uf) : '',
      10: String(o.num || ''), 11: o.serie != null ? o.serie : '1', 12: o.chave || '', 13: dt(y, m, day), 14: dt(y, m, Math.min(28, day + int(0, 3))),
      15: r2(o.vDoc || vItem), 16: 0, 17: r2(o.vDoc || vItem), 18: 0, 19: o.nItem || 1, 20: o.cod || '', 21: o.descComp || '', 22: o.desc,
      23: o.ncm || '', 24: o.codServ || '', 25: o.ean || '', 26: o.tipo || TIPO.rev, 27: vItem, 28: o.qtd != null ? o.qtd : '', 29: o.un || '', 30: 0,
      31: credito ? (o.nat || NAT.rev) : '', 32: o.cfop || '', 33: o.cfop ? cfopDesc(o.cfop).replace(/ \((interestadual|importação)\)$/, '') : '',
      34: icms, 35: o.icmsSt ? r2(o.icmsSt) : 0, 36: 0, 37: o.cst, 38: bc, 39: '', 40: aliqP, 41: '', 42: r2(bc * aliqP / 100),
      43: cstC, 44: credC ? bc : 0, 45: '', 46: credC ? aliqC : 0, 47: '', 48: credC ? r2(bc * aliqC / 100) : 0,
      49: o.conta || '04.1.1.02.001', 50: o.nomeConta || 'Compra de mercadorias para revenda', 51: 'C'
    });
    rows.push(r);
  }

  function nota(ym, sup, items, opts = {}) { // items: [{cod,desc,ncm,un,q,unit,icmsRate,st}]
    const num = ++numSeq, ch = chave(ym, sup, num), day = int(1, 28);
    let tot = 0; const prepared = items.map(it => { const v = r2(it.q * it.unit); tot += v; return { ...it, v }; });
    prepared.forEach((it, i) => {
      const interest = sup.uf !== 'RS';
      const cfop = opts.cfop || ((it.st ? '403' : '102').replace(/^/, interest ? '2' : '1'));
      const icms = it.st ? 0 : r2(it.v * (interest ? (it.icmsRate ? .12 : 0) : it.icmsRate));
      push({
        ym, sup, num, chave: ch, day, nItem: i + 1, cod: it.cod, desc: it.desc, ncm: it.ncm, un: it.un, qtd: it.q, vItem: it.v, vDoc: tot,
        icms, icmsSt: it.st ? it.v * .09 : 0, cfop, ean: it.ean || ('789' + String(int(1e9, 9.9e9))), tipo: opts.tipo, conta: opts.conta, nomeConta: opts.nomeConta,
        cst: opts.cst || '50', cstC: opts.cstC, bcFull: opts.bcFull, aliqP: opts.aliqP, aliqC: opts.aliqC
      });
    });
  }
  const catOf = key => CAT.filter(c => c[8] === key);
  const mkItem = c => ({ cod: c[0], desc: c[1], ncm: c[2], un: c[3], q: c[3] === 'MIL' ? int(1, 6) : int(2, 60), unit: r2(between(c[4], c[5])), icmsRate: c[6], st: c[7] });

  const months = [];
  for (let y = 2023; y <= 2026; y++) for (let m = 1; m <= 12; m++) { const ym = y * 100 + m; if (ym <= 202608) months.push(ym); }

  months.forEach((ym, mi) => {
    const sazonal = 1 + .25 * Math.sin((ym % 100) / 12 * Math.PI * 2 - 1) - (Math.floor(ym / 100) - 2023) * .06;
    const nDocs = Math.round(50 * sazonal + int(-4, 4));
    const supKeys = ['cimento', 'tintas', 'hidra', 'ferr', 'elet', 'cer', 'plast', 'aco'];
    for (let d = 0; d < nDocs; d++) {
      const sk = pick(supKeys), sup = S[sk];
      const cat = catOf(sk).length ? catOf(sk) : CAT;
      const n = int(4, 13), items = [];
      for (let i = 0; i < n; i++) items.push(mkItem(pick(cat)));
      // fornecedor hidráulico: base do crédito sem exclusão do ICMS após 05/2023 (achado de contingência)
      nota(ym, sup, items, { bcFull: sk === 'hidra' });
    }
    // energia elétrica (C500) e aluguel (F100): créditos corretos
    push({ ym, reg: 'E', modelo: '06', sup: S.energ, num: 880000 + mi, serie: 'U', desc: 'ENERGIA ELETRICA - CONSUMO DO MES', vItem: between(4200, 6900), cfop: '1253', cst: '50', nat: NAT.ene, tipo: TIPO.out, conta: '04.2.1.05.001', nomeConta: 'Energia elétrica', icms: 0 });
    push({ ym, reg: 'F', modelo: '', sup: S.imob, num: '', serie: '', desc: 'ALUGUEL DO DEPOSITO - CONTRATO 2019/07', vItem: 9800 + (ym >= 202501 ? 650 : 0), cst: '50', nat: NAT.alu, tipo: TIPO.out, conta: '04.2.1.03.001', nomeConta: 'Aluguéis' });
    // estoque de abertura (F150) em 12 parcelas no 1º ano de lucro real
    if (ym <= 202312) push({ ym, reg: 'K', modelo: '', desc: 'ESTOQUE DE ABERTURA - PARCELA ' + (ym % 100) + '/12', vItem: 69922.97, cst: '50', nat: NAT.est, aliqP: .65, aliqC: 3, tipo: TIPO.out, conta: '01.1.2.11.001', nomeConta: 'Estoque de mercadorias', icms: 0 });
    // serviços tomados (A100): sem crédito
    push({ ym, reg: 'A', modelo: '', sup: S.cont, num: 2000 + mi, serie: 'SN', desc: 'HONORARIOS CONTABEIS MENSAIS', codServ: '17.19', vItem: 3850 + (ym >= 202501 ? 350 : 0), cst: ym % 3 ? '70' : '99', tipo: TIPO.srv, conta: '04.2.2.03.001', nomeConta: 'Serviços de terceiros', cfop: '' });
    if (ym % 2 === 0) push({ ym, reg: 'A', modelo: '', sup: S.seg, num: 5000 + mi, serie: 'SN', desc: 'CONSULTORIA EM SEGURANCA DO TRABALHO', codServ: '17.01', vItem: between(900, 1600), cst: '99', tipo: TIPO.srv, conta: '04.2.2.03.001', nomeConta: 'Serviços de terceiros', cfop: '' });

    // ---- itens escriturados SEM crédito (o que a equipe classifica à mão) ----
    if (ym >= 202402) { // madeireira de SC lançada com CST 99: revenda tributada sem crédito
      const it = [['746458', 'CHAPA COMPENSADO PLASTIFICADO 18MM 2,20X1,10', '44123900', 'PC', 119, 149], ['694770', 'CHAPA COMPENSADO RESINADO 10MM', '44123900', 'PC', 61, 79], ['515150', 'TABUA PINUS 2,5X30CM 3M', '44071100', 'PC', 33, 47]];
      nota(ym, S.mad, Array.from({ length: int(3, 7) }, () => { const c = pick(it); return { cod: c[0], desc: c[1], ncm: c[2], un: c[3], q: int(5, 70), unit: r2(between(c[4], c[5])), icmsRate: .12 }; }), { cst: '99', conta: '04.1.1.02.001' });
    }
    if (ym >= 202501 && ym % 2) { // metais com CST 71 informado pelo fornecedor
      nota(ym, S.metais, [{ cod: '299216', desc: 'DUCHA HIGIENICA CROMADA C/ REGISTRO', ncm: '84818019', un: 'UN', q: int(6, 20), unit: r2(between(68, 92)), icmsRate: .12 }, { cod: '117943', desc: 'TORNEIRA COZINHA BICA MOVEL', ncm: '84818019', un: 'UN', q: int(4, 12), unit: r2(between(96, 140)), icmsRate: .12 }], { cst: '71' });
    }
    if (ym >= 202306 && ym <= 202312) { // cimento com ICMS-ST lançado com CST 75
      nota(ym, S.cimento, [mkItem(CAT[0]), mkItem(CAT[0]), mkItem(CAT[1])], { cst: '75' });
    }
    { // areia e brita com CST 98
      const n = int(2, 4), items = [];
      for (let i = 0; i < n; i++) items.push(pick([{ cod: '406270', desc: 'AREIA MEDIA LAVADA', ncm: '25051000', un: 'M3', q: int(5, 30), unit: r2(between(78, 98)), icmsRate: .17 }, { cod: '126680', desc: 'BRITA 1', ncm: '25171000', un: 'M3', q: int(5, 25), unit: r2(between(92, 118)), icmsRate: .17 }]));
      nota(ym, S.areia, items, { cst: '98' });
    }
    for (let i = 0; i < int(2, 4); i++) // óleo diesel da frota de entrega
      nota(ym, S.posto, [{ cod: '431224', desc: 'DIESEL S10', ncm: '27101921', un: 'L', q: r2(between(110, 150)), unit: r2(between(5.6, 6.4)), icmsRate: 0 }], { cfop: '1653', cst: '99', tipo: TIPO.uso, conta: '04.1.2.09.001', nomeConta: 'Combustíveis e lubrificantes' });
    if (ym % 2) nota(ym, S.papel, [{ cod: '9012', desc: 'PAPEL A4 75G 500 FOLHAS', ncm: '48025610', un: 'CX', q: int(1, 4), unit: r2(between(210, 260)), icmsRate: .17 }], { cfop: '1556', cst: '98', tipo: TIPO.uso, conta: '04.2.1.09.001', nomeConta: 'Material de expediente' });
    if (ym % 3 === 0) nota(ym, S.merc, [{ cod: '7711', desc: 'CAFE TORRADO MOIDO 500G', ncm: '09012100', un: 'PC', q: int(6, 12), unit: r2(between(18, 29)), icmsRate: .07 }, { cod: '7720', desc: 'AGUA MINERAL 20L', ncm: '22011000', un: 'UN', q: int(4, 10), unit: r2(between(11, 16)), icmsRate: 0 }], { cfop: '1556', cst: '73', tipo: TIPO.uso, conta: '04.2.1.09.002', nomeConta: 'Copa e cozinha' });
    if (ym % 6 === 2) nota(ym, S.unif, [{ cod: '62034', desc: 'CAMISA UNIFORME BORDADA', ncm: '62052000', un: 'UN', q: int(8, 20), unit: r2(between(48, 64)), icmsRate: .17 }], { cfop: '1556', cst: '98', tipo: TIPO.uso, conta: '04.2.1.09.003', nomeConta: 'Uniformes' });
    if (ym % 4 === 1) nota(ym, S.tec, [{ cod: '8474', desc: 'BETONEIRA 400L - RETORNO DE CONSERTO', ncm: '84743100', un: 'UN', q: 1, unit: r2(between(2800, 3400)), icmsRate: 0 }], { cfop: '1916', cst: '98', tipo: TIPO.atv });
    if (ym % 5 === 0) nota(ym, S.tintas, [{ cod: '300290', desc: 'TINTA ACRILICA 3,6L - BONIFICACAO', ncm: '32091010', un: 'GL', q: int(4, 12), unit: r2(between(58, 74)), icmsRate: 0 }], { cfop: '2910', cst: '98' });
    if (ym % 7 === 0) nota(ym, S.ferr, [{ cod: '530577', desc: 'AMOSTRA FECHADURA DIGITAL', ncm: '83014000', un: 'UN', q: 1, unit: r2(between(150, 210)), icmsRate: 0 }], { cfop: '1911', cst: '98' });
    if (ym % 3 === 1) nota(ym, S.pneu, [{ cod: '880012', desc: 'PNEU CARRINHO DE MAO 3,25-8', ncm: '40114000', un: 'UN', q: int(10, 30), unit: r2(between(39, 52)), icmsRate: .12 }], { cst: ym >= 202503 && ym <= 202508 ? '50' : '70' });
    if (ym % 4 === 2) nota(ym, S.agro, [{ cod: '310520', desc: 'ADUBO NPK 10-10-10 25KG', ncm: '31052000', un: 'SC', q: int(10, 40), unit: r2(between(89, 118)), icmsRate: 0 }], { cst: '73' });
    nota(ym, S.cal, [{ cod: '252220', desc: 'CAL HIDRATADA CH-III 20KG', ncm: '25222000', un: 'SC', q: int(40, 160), unit: r2(between(11, 15)), icmsRate: .17 }], { cst: '73' });
    if (ym === 202309 || ym === 202507) nota(ym, S.maq, [{ cod: '9100', desc: 'BETONEIRA 400L MOTOR 2CV', ncm: '84743100', un: 'UN', q: 1, unit: r2(between(6800, 7900)), icmsRate: .12 }], { cfop: '1551', cst: '98', tipo: TIPO.atv, conta: '01.2.3.04.001', nomeConta: 'Máquinas e equipamentos' });
    if (ym % 8 === 3) nota(ym, S.ferr, [{ cod: '6934', desc: 'FECHADURA SEGURANCA - TROCA EM GARANTIA', ncm: '83014000', un: 'UN', q: int(2, 8), unit: r2(between(180, 260)), icmsRate: 0 }], { cfop: '1949', cst: '98' });
    if (ym % 5 === 2) nota(ym, S.ferr, [{ cod: '9999', desc: 'MATERIAL DIVERSO CONFORME PEDIDO', ncm: '', un: 'UN', q: int(1, 3), unit: r2(between(140, 480)), icmsRate: .17, ean: '' }], { cst: '99' });
    // material de uso e consumo, EPI, informática, frota e embalagens
    const usoNota = (key, nmin, nmax, opt) => { const c = USO.filter(u => u[7] === key); nota(ym, S[key], Array.from({ length: int(nmin, nmax) }, () => { const u = pick(c); return { cod: u[0], desc: u[1], ncm: u[2], un: u[3], q: u[3] === 'MIL' ? int(1, 3) : u[5] > 1000 ? int(1, 4) : int(2, 24), unit: r2(between(u[4], u[5])), icmsRate: u[6] }; }), Object.assign({ cfop: '1556', cst: '98', tipo: TIPO.uso, conta: '04.2.1.09.001', nomeConta: 'Material de uso e consumo' }, opt || {})); };
    usoNota('limp', 2, 4);
    if (ym % 3 === 0) usoNota('epi', 2, 4, { cfop: '2556' });
    if (ym % 2 === 0) usoNota('info', 1, 2);
    if (ym % 2 === 1 || ym % 5 === 0) usoNota('frota', 1, 3, { nomeConta: 'Manutenção de veículos' });
    if (ym % 4 === 3) usoNota('emb', 1, 2, { cst: '70', nomeConta: 'Embalagens' });
    if (ym === 202403 || ym === 202601) nota(ym, S.info, [{ cod: '847130', desc: 'NOTEBOOK 14 POL CORE I5 16GB', ncm: '84713012', un: 'UN', q: int(2, 4), unit: r2(between(3300, 4100)), icmsRate: .12 }], { cfop: '1551', cst: '98', tipo: TIPO.atv, conta: '01.2.3.05.001', nomeConta: 'Equipamentos de informática' });
    // notas inteiras escrituradas sem crédito por erro de cadastro (CST 98 e CST 75)
    if (ym >= 202407 && ym <= 202412) nota(ym, S.ferr, Array.from({ length: int(6, 11) }, () => mkItem(pick(catOf('ferr')))), { cst: '98' });
    if (ym >= 202509 && ym <= 202602) nota(ym, S.elet, Array.from({ length: int(6, 11) }, () => mkItem(pick(catOf('elet')))), { cst: '75' });
    if (ym >= 202601) nota(ym, S.hidra, Array.from({ length: int(4, 8) }, () => mkItem(pick(catOf('hidra')))), { cst: '99' });
    // inconsistências de escrituração (para o checklist)
    if (ym === 202404 || ym === 202411) nota(ym, S.ferr, [mkItem(CAT[17]), mkItem(CAT[18])], { aliqP: .65, aliqC: 3 });
    if (ym === 202502 || ym === 202509 - 100) nota(ym, S.plast, [mkItem(CAT[6]), mkItem(CAT[7])], { cstC: '70' });
  });
  return { headers: MA037.slice(), rows, empresa: DEMO_EMPRESA };
}

/* Demonstração da planilha 047 (Saídas) da mesma empresa fictícia: Lucro Presumido em 2022 (0,65% e 3%), Lucro Real
   a partir de 2023 (1,65% e 7,6%). Erros plantados para o checklist: ICMS na base dos débitos até 03/2024, cal hidratada
   e pneu tributados depois de anos corretos, remessa para conserto e venda de ativo tributadas, torneira sem tributação. */
function buildDemoSaidas() {
  const R = rng(20261027);
  const pick = a => a[Math.floor(R() * a.length)];
  const between = (a, b) => a + R() * (b - a);
  const int = (a, b) => Math.floor(between(a, b + 1));
  const REG = { nfe: 'C100/C170 - Documento - Nota Fiscal', nfce: 'C100/C175 - Documento - Nota Fiscal Eletrônicas' };
  const TIPO = '00 Mercadoria para Revenda';
  const CLI = [['5001', 'Construtora Vale Norte Ltda', 'RS'], ['5002', 'Reformas Bela Vista Ltda', 'RS'], ['5003', 'Condomínio Jardim das Acácias', 'RS'],
    ['5004', 'Agropecuária Coxilha Verde Ltda', 'RS'], ['5005', 'Instaladora Faísca Ltda', 'SC'], ['5006', 'Hotel Serra Alta Ltda', 'RS']]
    .map(([cod, nome, uf]) => ({ cod, nome, uf, cnpj: String(int(10, 98)) + String(int(100000, 999999)) + '0001' + String(int(10, 99)) }));
  // [código, descrição, NCM, unidade, preço mín., preço máx., ICMS próprio, ST?]
  const P = [
    ['100231', 'CIMENTO CP II-F-32 50KG', '25232910', 'SC', 42, 52, 0, true], ['100245', 'ARGAMASSA AC-I INTERNA 20KG', '38245000', 'SC', 17, 24, 0, true],
    ['100310', 'TIJOLO CERAMICO 6 FUROS 9X14X19', '69041000', 'MIL', 1150, 1390, .17, false], ['100322', 'PISO CERAMICO 45X45 PEI 4 CX 2,0M2', '69072100', 'CX', 62, 88, .17, false],
    ['100330', 'VASO SANITARIO C/ CAIXA ACOPLADA BRANCO', '69101000', 'UN', 410, 540, 0, true], ['200105', 'TUBO PVC ESGOTO 100MM 6M', '39172300', 'BR', 89, 118, .17, false],
    ['200112', 'TUBO PVC SOLDAVEL 25MM 6M', '39172300', 'BR', 31, 42, .17, false], ['200118', 'JOELHO PVC SOLDAVEL 25MM 90G', '39174090', 'PC', 2.4, 3.9, .17, false],
    ['200121', 'CAIXA D AGUA POLIETILENO 1000L', '39251000', 'UN', 560, 690, .17, false], ['300210', 'TINTA ACRILICA FOSCA BRANCA 18L', '32091010', 'GL', 340, 459, 0, true],
    ['300214', 'MASSA CORRIDA PVA 25KG', '32149000', 'GL', 89, 118, 0, true], ['400110', 'VERGALHAO CA-50 10MM 12M', '72142000', 'BR', 59, 82, .12, false],
    ['400121', 'PREGO 18X27 COM CABECA 1KG', '73170020', 'KG', 22, 31, .17, false], ['400130', 'FECHADURA EXTERNA CROMADA', '83014000', 'UN', 99, 139, .17, false],
    ['500101', 'FIO FLEXIVEL 2,5MM 100M AZUL', '85444900', 'RL', 229, 309, 0, true], ['500106', 'DISJUNTOR MONOPOLAR 20A', '85362000', 'UN', 18, 27, 0, true],
    ['500110', 'LAMPADA LED BULBO 9W BIVOLT', '85395200', 'UN', 9.9, 15.9, 0, true], ['600102', 'TORNEIRA PAREDE METAL 1/2', '84818019', 'UN', 59, 89, .17, false],
    ['600108', 'REGISTRO GAVETA 3/4 BRUTO', '84818095', 'UN', 46, 66, .17, false], ['600112', 'CAIXA SIFONADA 100X100X50', '39229000', 'UN', 14, 22, .17, false]
  ];
  const CAL = ['252220', 'CAL HIDRATADA CH-III 20KG', '25222000', 'SC', 17, 22, .17, false];
  const PNEU = ['880012', 'PNEU CARRINHO DE MAO 3,25-8', '40114000', 'UN', 59, 79, 0, true];
  const ADUBO = ['310520', 'ADUBO NPK 10-10-10 25KG', '31052000', 'SC', 129, 165, 0, false];
  const FORN = { cod: '106', nome: 'Hidráulica Vale do Caí Ltda', uf: 'RS', cnpj: '33444555000172' }, TEC = { cod: '117', nome: 'Assistência Técnica Rio Pardo Ltda', uf: 'RS', cnpj: '44555666000190' };
  const rows = [];
  let nNfe = 18000, nNfce = 250000;
  const dt = (y, m, d) => new Date(y, m - 1, d);
  const chave = (ym, mod, num) => {
    const yy = String(Math.floor(ym / 100) % 100), mm = String(ym % 100).padStart(2, '0');
    let k = '43' + yy + mm + DEMO_EMPRESA.cnpj + mod + '001' + String(num).padStart(9, '0') + '1' + String(int(10000000, 99999999));
    let s = 0, w = 2; for (let i = k.length - 1; i >= 0; i--) { s += (+k[i]) * w; w = w === 9 ? 2 : w + 1; }
    const dv = 11 - (s % 11); return k + (dv >= 10 ? 0 : dv);
  };
  // regime: 2022 cumulativo (Lucro Presumido); 2023 em diante não cumulativo (Lucro Real)
  const aliq = ym => ym < 202301 ? [.65, 3] : [1.65, 7.6];
  function nota(ym, cli, itens, o = {}) {
    const nfce = !cli, mod = nfce ? '65' : '55', num = nfce ? ++nNfce : ++nNfe, ch = chave(ym, mod, num), day = int(1, 28);
    const y = Math.floor(ym / 100), m = ym % 100;
    const prep = itens.map(c => { const q = o.q || (c[3] === 'MIL' ? int(1, 4) : int(1, nfce ? 6 : 40)), v = r2(q * between(c[4], c[5])); return { c, q, v }; });
    const tot = r2(prep.reduce((a, x) => a + x.v, 0));
    prep.forEach((x, i) => {
      const c = x.c, st = c[7], interest = cli && cli.uf !== 'RS';
      const cfop = o.cfop || ((interest ? '6' : '5') + (st ? (interest ? '404' : '405') : '102'));
      const icms = st || o.semIcms ? 0 : r2(x.v * (interest ? .12 : c[6]));
      const cst = typeof o.cst === 'function' ? o.cst(c) : (o.cst || '01');
      const trib = cst === '01' || cst === '02';
      const [aP, aC] = o.aliq || aliq(ym);
      const exclui = ym >= 202404; // a empresa passou a excluir o ICMS da base em 04/2024
      const bc = trib ? r2(x.v - (exclui ? icms : 0)) : 0;
      const r = new Array(MA047.length).fill(null);
      Object.assign(r, {
        0: DEMO_EMPRESA.cnpj, 1: dt(y, m, 1), 2: nfce ? REG.nfce : REG.nfe, 3: mod, 4: '00', 5: cli ? cli.cod : '', 6: cli ? cli.cnpj : '', 7: '',
        8: cli ? cli.nome : 'CONSUMIDOR FINAL', 9: 'RS/' + (cli ? cli.uf : 'RS'), 10: String(num), 11: '1', 12: ch, 13: dt(y, m, day), 14: dt(y, m, day),
        15: tot, 16: 0, 17: tot, 18: 0, 19: 0, 20: 0, 21: i + 1, 22: c[0], 23: '', 24: o.desc || c[1], 25: c[2], 26: '', 27: '789' + String(int(1e9, 9.9e9)), 28: TIPO,
        29: x.v, 30: x.q, 31: c[3], 32: 0, 33: cfop, 34: cfopDesc(cfop).replace(/ \((interestadual|exportação)\)$/, ''), 35: o.fat === false ? '' : 'Faturamento', 36: o.nat || 'Venda',
        37: icms, 38: 0, 39: 0, 40: cst, 41: bc, 42: '', 43: trib ? aP : 0, 44: '', 45: r2(bc * (trib ? aP : 0) / 100),
        46: cst, 47: bc, 48: '', 49: trib ? aC : 0, 50: '', 51: r2(bc * (trib ? aC : 0) / 100), 52: '3.1.1.01.001'
      });
      rows.push(r);
    });
  }
  const months = [];
  for (let y = 2022; y <= 2026; y++) for (let m = 1; m <= 12; m++) { const ym = y * 100 + m; if (ym <= 202608) months.push(ym); }
  months.forEach(ym => {
    const saz = 1 + .2 * Math.sin((ym % 100) / 12 * Math.PI * 2 - 1);
    for (let d = 0, n = Math.round(42 * saz); d < n; d++) nota(ym, null, Array.from({ length: int(1, 4) }, () => pick(P)));
    for (let d = 0, n = Math.round(30 * saz); d < n; d++) nota(ym, pick(CLI), Array.from({ length: int(3, 9) }, () => pick(P)));
    // torneira vendida sem tributação por erro de cadastro (03 a 06/2025)
    if (ym >= 202503 && ym <= 202506) for (let k = 0; k < 6; k++) nota(ym, pick(CLI), [P[17], P[17]], { cst: '06' });
    // cal hidratada: alíquota zero (CST 06) até 06/2024; tributada a partir de 07/2024 (erro)
    nota(ym, CLI[3], [CAL, CAL], { cst: ym >= 202407 ? '01' : '06' });
    if (ym % 2) nota(ym, null, [CAL], { cst: ym >= 202407 ? '01' : '06' });
    // pneu: monofásico, revenda com CST 04 até 12/2024; tributado a partir de 01/2025 (erro)
    if (ym % 2 === 0) nota(ym, null, [PNEU], { cst: ym >= 202501 ? '01' : '04' });
    // adubo: alíquota zero corretamente aplicada
    if (ym % 3 === 0) nota(ym, CLI[3], [ADUBO, ADUBO], { cst: '06' });
    // remessa em bonificação (sem receita, CST 49) e devolução de compra (CST 49)
    if (ym % 4 === 1) nota(ym, pick(CLI), [P[13]], { cfop: '5910', cst: '49', nat: 'Remessa', fat: false });
    if (ym % 5 === 2) nota(ym, FORN, [P[5], P[6]], { cfop: '5202', cst: '49', nat: 'Devolução de compra', fat: false });
    // remessa para conserto tributada (erro)
    if (ym % 6 === 3 && ym >= 202301) nota(ym, TEC, [['844700', 'BETONEIRA 400L - REMESSA P/ CONSERTO', '84743100', 'UN', 2800, 3400, 0, false]], { cfop: '5915', cst: '01', semIcms: true, nat: 'Remessa', q: 1 });
    // alíquota divergente em meses não cumulativos
    if (ym === 202404 || ym === 202511) nota(ym, CLI[1], [P[2], P[11]], { aliq: [.65, 3] });
  });
  // venda de caminhão usado do ativo imobilizado tributada (erro)
  nota(202505, CLI[0], [['870421', 'CAMINHAO 3/4 ANO 2016 - ATIVO IMOBILIZADO', '87042110', 'UN', 128000, 128000, 0, false]], { cfop: '5551', semIcms: true, nat: 'Outras saídas/prestações', q: 1 });
  return { headers: MA047.slice(), rows, empresa: DEMO_EMPRESA };
}
