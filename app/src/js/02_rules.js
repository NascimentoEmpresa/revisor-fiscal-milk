/* ======================= layout da planilha e regras ======================= */
/* Cabeçalho da exportação "EFD - Contribuições - 037 - Entradas - Todos os Registros - Completo" (SistemaMA / MA Tecnologias),
   na ordem em que aparece no Excel exportado (conferido com a 037 real enviada pela Milk em 11/2026). */
const MA037 = ['CNPJ', 'Período', 'Registros', 'Modelo', 'Situação', 'Código Participante', 'CNPJ Participante', 'CPF Participante',
  'Nome Participante', 'UF Origem/Destino', 'Número Documento', 'Série', 'Chave NF-e', 'Data Documento', 'Data Entrada/Saída', 'Vlr Documento',
  'Vlr Desconto NF', 'Vlr Mercadoria/Operação', 'Vlr Frete', 'Número Item', 'Código Item', 'Descrição Complementar', 'Descrição Item', 'NCM',
  'Código Serviço', 'Código Barra', 'Tipo Item', 'Vlr Item', 'Qtde', 'Unidade Medida', 'Vlr Desconto Item', 'Natureza Crédito',
  'CFOP', 'Descrição CFOP', 'Vlr ICMS', 'Vlr ICMS-ST', 'Vlr IPI', 'CST PIS', 'Vlr Base Cálculo PIS', 'Qtde Base Cálculo PIS', 'Alíquota PIS',
  'Qtde Alíquota PIS', 'Vlr PIS', 'CST Cofins', 'Vlr Base Cálculo Cofins', 'Qtde Base Cálculo Cofins', 'Alíquota Cofins', 'Qtde Alíquota Cofins',
  'Vlr Cofins', 'Conta Contábil', 'Nome Contábil', 'deb_cred'];
/* Cabeçalho da "EFD - Contribuições - 047 - Saídas - Todos os Registros - Completo" (mesma consulta, visão de saídas). */
const MA047 = ['CNPJ', 'Período', 'Registros', 'Modelo', 'Situação', 'Código Participante', 'CNPJ Participante', 'CPF Participante',
  'Nome Participante', 'UF Origem/Destino', 'Número Documento', 'Série', 'Chave NF-e', 'Data Documento', 'Data Entrada/Saída', 'Vlr Documento',
  'Vlr Desconto NF', 'Vlr Mercadoria/Operação', 'Vlr Frete', 'Vlr Seguro', 'Vlr Outras DA', 'Número Item', 'Código Item', 'Descrição Complementar',
  'Descrição Item', 'NCM', 'Código Serviço', 'Código Barra', 'Tipo Item', 'Vlr Item', 'Qtde', 'Unidade Medida', 'Vlr Desconto Item', 'CFOP',
  'Descrição CFOP', 'Faturamento', 'Natureza', 'Vlr ICMS', 'Vlr ICMS-ST', 'Vlr IPI', 'CST PIS', 'Vlr Base Cálculo PIS', 'Qtde Base Cálculo PIS',
  'Alíquota PIS', 'Qtde Alíquota PIS', 'Vlr PIS', 'CST Cofins', 'Vlr Base Cálculo Cofins', 'Qtde Base Cálculo Cofins', 'Alíquota Cofins',
  'Qtde Alíquota Cofins', 'Vlr Cofins', 'Conta Contábil'];

/* Modo da análise: 037 (Entradas: crédito não aproveitado) ou 047 (Saídas: PIS/COFINS pago a maior nas vendas). */
const MODES = {
  ENT: {
    id: 'ENT', nome: 'Entradas', planilha: '037', titulo: 'EFD - Contribuições - 037 - Entradas - Todos os Registros - Completo', base: 'BASE DE DADOS - ENTRADAS',
    cls: { COM: 'COM CREDITO', SEM: 'SEM CREDITO', AVA: 'AVALIAR' }, alvo: 'NOTAS SEM PC', outra: 'NOTAS COM PC', apurado: 'CRÉDITO APURADO', kbPrefix: ''
  },
  SAI: {
    id: 'SAI', nome: 'Saídas', planilha: '047', titulo: 'EFD - Contribuições - 047 - Saídas - Todos os Registros - Completo', base: 'BASE DE DADOS - SAÍDAS',
    cls: { COM: 'RECUPERAR', SEM: 'CORRETO', AVA: 'AVALIAR' }, alvo: 'NOTAS COM PC', outra: 'NOTAS SEM PC', apurado: 'VALOR A RECUPERAR', kbPrefix: 'S|'
  }
};
let MODE = MODES.ENT;
const SAI = () => MODE.id === 'SAI';

/* campos que o motor precisa: chave interna -> nomes aceitos (normalizados) */
const FIELDS = {
  cnpj: { names: ['cnpj'], req: false },
  periodo: { names: ['periodo', 'periodo apuracao'], req: true },
  registro: { names: ['registros', 'registro'], req: true },
  part: { names: ['nome participante', 'participante'], req: false },
  cnpjPart: { names: ['cnpj participante'], req: false },
  cpfPart: { names: ['cpf participante'], req: false },
  numDoc: { names: ['numero documento', 'numero do documento'], req: false },
  dataDoc: { names: ['data documento', 'data do documento'], req: false },
  chave: { names: ['chave nf e', 'chave nfe', 'chave'], req: false },
  numItem: { names: ['numero item'], req: false },
  codItem: { names: ['codigo item'], req: false },
  desc: { names: ['descricao item', 'descricao do item'], req: true },
  ncm: { names: ['ncm'], req: true },
  tipoItem: { names: ['tipo item'], req: false },
  vlrItem: { names: ['vlr item', 'valor item'], req: true },
  vlrDesc: { names: ['vlr desconto item'], req: false },
  natureza: { names: ['natureza base calculo credito', 'natureza'], prefix: 'natureza', req: false },
  cfop: { names: ['cfop'], req: true },
  vlrIcms: { names: ['vlr icms'], req: false },
  vlrIpi: { names: ['vlr ipi'], req: false },
  cstPis: { names: ['cst pis'], req: true },
  bcPis: { names: ['vlr base calculo pis'], req: true },
  aliqPis: { names: ['aliquota pis'], req: true },
  vlrPis: { names: ['vlr pis'], req: true },
  cstCof: { names: ['cst cofins'], req: true },
  bcCof: { names: ['vlr base calculo cofins'], req: false },
  aliqCof: { names: ['aliquota cofins'], req: true },
  vlrCof: { names: ['vlr cofins'], req: true }
};
/* colunas que a equipe destaca em cinza (A6A6A6) na base (vídeo 2, 09:00–11:00) */
const HIGHLIGHT = ['registros', 'vlr item', 'cfop', 'vlr base calculo pis', 'vlr pis', 'vlr cofins'];
/* colunas formatadas como Moeda e somadas no fim (AutoSoma) no vídeo; as demais ficam no formato Geral */
const CUR_COLS = ['vlr item', 'vlr base calculo pis', 'vlr pis', 'vlr cofins'];
/* Formatação das abas de dados por planilha, igual à da analista.
   047: copiada do Excel final da Milk (047 trabalhada pela analista, out/2026). 037: do vídeo 2 (ainda sem Excel final para conferir).
   ano/mes: nomes das colunas inseridas; hl: colunas em cinza; cur: colunas em Moeda; tot: colunas somadas no fim;
   headHl: cabeçalho inteiro em cinza; totSheets: abas com a linha de soma; pivots: dinâmicas que a analista monta. */
const LAYOUT = {
  ENT: { ano: 'ANO', mes: 'MÊS', hl: HIGHLIGHT, cur: CUR_COLS, tot: CUR_COLS, headHl: false, totSheets: ['base', 'com', 'sem'] },
  SAI: {
    ano: 'ano', mes: 'mês', headHl: true, totSheets: ['base', 'com'],
    hl: ['ano', 'mes', 'modelo', 'ncm', 'cfop', 'cst pis', 'aliquota pis', 'aliquota cofins', 'vlr item', 'vlr icms', 'vlr base calculo pis', 'vlr pis', 'vlr cofins'],
    cur: ['vlr item', 'vlr icms', 'vlr base calculo pis', 'vlr pis', 'vlr cofins'],
    tot: ['vlr item', 'vlr base calculo pis', 'vlr pis', 'vlr cofins'],
    curCol: ['vlr item', 'vlr icms', 'vlr pis'], // colunas formatadas inteiras como Moeda (cabeçalho junto)
    minW: { 'vlr pis': 14.14, 'vlr cofins': 14 } // larguras que a analista deixou nessas colunas
  }
};
const TEXT_COLS = ['cnpj', 'cnpj participante', 'cpf participante', 'chave nf e', 'ncm', 'codigo item', 'codigo barras', 'codigo barra', 'cfop', 'cst pis', 'cst cofins',
  'codigo participante', 'numero documento', 'serie', 'codigo servico', 'conta contabil', 'modelo', 'situacao'];

const CFOP_DESC = {
  '1101': 'Compra para industrialização', '1102': 'Compra para comercialização', '1111': 'Compra para industrialização de mercadoria recebida anteriormente em consignação industrial',
  '1113': 'Compra para comercialização de mercadoria recebida anteriormente em consignação mercantil', '1116': 'Compra para industrialização originada de encomenda para recebimento futuro',
  '1117': 'Compra para comercialização originada de encomenda para recebimento futuro', '1118': 'Compra de mercadoria para comercialização pelo adquirente originário, entregue pelo vendedor remetente ao destinatário, em venda à ordem',
  '1120': 'Compra para industrialização, em venda à ordem, já recebida do vendedor remetente', '1121': 'Compra para comercialização, em venda à ordem, já recebida do vendedor remetente',
  '1151': 'Transferência para industrialização', '1152': 'Transferência para comercialização', '1153': 'Transferência de energia elétrica para distribuição', '1154': 'Transferência para utilização na prestação de serviço',
  '1201': 'Devolução de venda de produção do estabelecimento', '1202': 'Devolução de venda de mercadoria adquirida ou recebida de terceiros',
  '1251': 'Compra de energia elétrica para distribuição ou comercialização', '1252': 'Compra de energia elétrica por estabelecimento industrial', '1253': 'Compra de energia elétrica por estabelecimento comercial',
  '1254': 'Compra de energia elétrica por estabelecimento prestador de serviço de transporte', '1255': 'Compra de energia elétrica por estabelecimento prestador de serviço de comunicação',
  '1256': 'Compra de energia elétrica por estabelecimento de produtor rural', '1257': 'Compra de energia elétrica para consumo por demanda contratada',
  '1301': 'Aquisição de serviço de comunicação para execução de serviço da mesma natureza', '1302': 'Aquisição de serviço de comunicação por estabelecimento industrial', '1303': 'Aquisição de serviço de comunicação por estabelecimento comercial',
  '1351': 'Aquisição de serviço de transporte para execução de serviço da mesma natureza', '1352': 'Aquisição de serviço de transporte por estabelecimento industrial', '1353': 'Aquisição de serviço de transporte por estabelecimento comercial',
  '1401': 'Compra para industrialização em operação com mercadoria sujeita ao regime de substituição tributária', '1403': 'Compra para comercialização em operação com mercadoria sujeita ao regime de substituição tributária',
  '1406': 'Compra de bem para o ativo imobilizado cuja mercadoria está sujeita ao regime de substituição tributária', '1407': 'Compra de mercadoria para uso ou consumo cuja mercadoria está sujeita ao regime de substituição tributária',
  '1408': 'Transferência para industrialização em operação com mercadoria sujeita ao regime de substituição tributária', '1409': 'Transferência para comercialização em operação com mercadoria sujeita ao regime de substituição tributária',
  '1410': 'Devolução de venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária', '1411': 'Devolução de venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária',
  '1551': 'Compra de bem para o ativo imobilizado', '1552': 'Transferência de bem do ativo imobilizado', '1556': 'Compra de material para uso ou consumo', '1557': 'Transferência de material para uso ou consumo',
  '1652': 'Compra de combustível ou lubrificante para comercialização', '1653': 'Compra de combustível ou lubrificante por consumidor ou usuário final',
  '1901': 'Entrada para industrialização por encomenda', '1902': 'Retorno de mercadoria remetida para industrialização por encomenda', '1903': 'Entrada de mercadoria remetida para industrialização e não aplicada no referido processo',
  '1904': 'Retorno de remessa para venda fora do estabelecimento', '1905': 'Entrada de mercadoria recebida para depósito em depósito fechado ou armazém geral', '1906': 'Retorno de mercadoria remetida para depósito fechado ou armazém geral',
  '1907': 'Retorno simbólico de mercadoria remetida para depósito fechado ou armazém geral', '1908': 'Entrada de bem por conta de contrato de comodato', '1909': 'Retorno de bem remetido por conta de contrato de comodato',
  '1910': 'Entrada de bonificação, doação ou brinde', '1911': 'Entrada de amostra grátis', '1912': 'Entrada de mercadoria ou bem recebido para demonstração', '1913': 'Retorno de mercadoria ou bem remetido para demonstração',
  '1914': 'Retorno de mercadoria ou bem remetido para exposição ou feira', '1915': 'Entrada de mercadoria ou bem recebido para conserto ou reparo', '1916': 'Retorno de mercadoria ou bem remetido para conserto ou reparo',
  '1917': 'Entrada de mercadoria recebida em consignação mercantil ou industrial', '1918': 'Devolução de mercadoria remetida em consignação mercantil ou industrial', '1919': 'Devolução simbólica de mercadoria vendida ou utilizada em processo industrial, remetida anteriormente em consignação',
  '1920': 'Entrada de vasilhame ou sacaria', '1921': 'Retorno de vasilhame ou sacaria', '1949': 'Outra entrada de mercadoria ou prestação de serviço não especificada'
};
const CFOP_DESC_SAI = {
  '5101': 'Venda de produção do estabelecimento', '5102': 'Venda de mercadoria adquirida ou recebida de terceiros', '5103': 'Venda de produção do estabelecimento, efetuada fora do estabelecimento',
  '5104': 'Venda de mercadoria adquirida de terceiros, efetuada fora do estabelecimento', '5105': 'Venda de produção que não deva por ele transitar', '5106': 'Venda de mercadoria adquirida de terceiros que não deva por ele transitar',
  '5115': 'Venda de mercadoria recebida anteriormente em consignação mercantil', '5117': 'Venda de mercadoria originada de encomenda para entrega futura', '5119': 'Venda à ordem por conta e ordem de terceiros',
  '5120': 'Venda à ordem ao adquirente originário', '5152': 'Transferência de mercadoria adquirida de terceiros', '5201': 'Devolução de compra para industrialização', '5202': 'Devolução de compra para comercialização',
  '5401': 'Venda de produção com substituição tributária (contribuinte substituto)', '5402': 'Venda de produção com ST entre contribuintes substitutos', '5403': 'Venda de mercadoria com ST (contribuinte substituto)',
  '5405': 'Venda de mercadoria com ST (contribuinte substituído)', '5409': 'Transferência de mercadoria com ST', '5410': 'Devolução de compra para industrialização com ST', '5411': 'Devolução de compra para comercialização com ST',
  '5551': 'Venda de bem do ativo imobilizado', '5552': 'Transferência de bem do ativo imobilizado', '5553': 'Devolução de compra de bem para o ativo imobilizado', '5556': 'Devolução de compra de material de uso ou consumo',
  '5557': 'Transferência de material de uso ou consumo', '5652': 'Venda de combustível adquirido de terceiros', '5655': 'Venda de combustível a comerciante varejista', '5656': 'Venda de combustível a consumidor final',
  '5667': 'Venda de combustível a consumidor de outra UF', '5901': 'Remessa para industrialização por encomenda', '5902': 'Retorno de mercadoria utilizada na industrialização por encomenda',
  '5904': 'Remessa para venda fora do estabelecimento', '5905': 'Remessa para depósito fechado ou armazém geral', '5908': 'Remessa de bem por conta de contrato de comodato', '5909': 'Retorno de bem recebido em comodato',
  '5910': 'Remessa em bonificação, doação ou brinde', '5911': 'Remessa de amostra grátis', '5912': 'Remessa de mercadoria para demonstração', '5913': 'Retorno de mercadoria recebida para demonstração',
  '5915': 'Remessa de mercadoria para conserto ou reparo', '5916': 'Retorno de mercadoria recebida para conserto ou reparo', '5917': 'Remessa de mercadoria em consignação', '5920': 'Remessa de vasilhame ou sacaria',
  '5921': 'Devolução de vasilhame ou sacaria', '5922': 'Simples faturamento de venda para entrega futura', '5929': 'Lançamento relativo a operação registrada em ECF', '5933': 'Prestação de serviço tributada pelo ISSQN',
  '5949': 'Outra saída de mercadoria ou prestação de serviço não especificada'
};
function cfopDesc(c) {
  if (!c) return 'Sem CFOP';
  if (/^[567]/.test(c)) {
    const d = CFOP_DESC_SAI['5' + c.slice(1)];
    return d ? d + (c[0] === '6' ? ' (interestadual)' : c[0] === '7' ? ' (exportação)' : '') : 'CFOP ' + c;
  }
  const k = (c[0] === '2' || c[0] === '3') ? '1' + c.slice(1) : c;
  const d = CFOP_DESC[k];
  return d ? d + (c[0] === '2' ? ' (interestadual)' : c[0] === '3' ? ' (importação)' : '') : 'CFOP ' + c;
}
const cstDesc = c => (SAI() ? CST_SAI_DESC[c] : CST_DESC[c]) || CST_DESC[c] || '';
const CST_DESC = {
  '50': 'Com direito a crédito (receita tributada no mercado interno)', '51': 'Com direito a crédito (receita não tributada)', '52': 'Com direito a crédito (exportação)',
  '53': 'Com direito a crédito (tributada e não tributada)', '54': 'Com direito a crédito (tributada e exportação)', '55': 'Com direito a crédito (não tributada e exportação)', '56': 'Com direito a crédito (todas as receitas)',
  '60': 'Crédito presumido', '70': 'Aquisição sem direito a crédito', '71': 'Aquisição com isenção', '72': 'Aquisição com suspensão', '73': 'Aquisição a alíquota zero',
  '74': 'Aquisição sem incidência da contribuição', '75': 'Aquisição por substituição tributária', '98': 'Outras operações de entrada', '99': 'Outras operações'
};

/* --- grupos de CFOP (a 1ª posição 1/2/3 é removida antes da consulta) --- */
const CF = s => new Set(s.split(' '));
const CFOP_REVENDA = CF('101 102 111 113 116 117 118 120 121 122 401 403 652');
const CFOP_ST = CF('401 403');
const CFOP_SEM_AQUISICAO = CF('151 152 153 154 408 409 552 557 901 902 903 904 905 906 907 908 909 910 911 912 913 914 915 916 917 918 919 920 921');
const CFOP_USO_CONSUMO = CF('556 407');
const CFOP_ATIVO = CF('551 406');
const CFOP_COMBUSTIVEL = CF('653');
const CFOP_ENERGIA = CF('251 252 253 254 255 256 257');
const CFOP_FRETE = CF('351 352 353 354 355 356 360');
const CFOP_COMUNIC = CF('301 302 303 304 305 306');
const CFOP_DEVOLUCAO = CF('201 202 410 411');
const CFOP_OUTRAS = CF('949');

/* --- NCM: regras de partida. Fonte primária: a legislação citada. A base é da Milk: cada decisão do analista vira regra. --- */
const NCM_RULES = [
  // incidência monofásica / concentrada
  { p: '27101259', t: 'MONO', nome: 'Gasolina', lei: 'Lei 9.718/1998, art. 4º; Lei 10.833/2003, art. 3º, I, "b"' },
  { p: '27101921', t: 'MONO', nome: 'Óleo diesel', lei: 'Lei 9.718/1998, art. 4º; Lei 10.833/2003, art. 3º, I, "b"' },
  { p: '27101911', t: 'MONO', nome: 'Querosene de aviação', lei: 'Lei 10.560/2002, art. 2º' },
  { p: '27111910', t: 'MONO', nome: 'GLP', lei: 'Lei 9.718/1998, art. 4º' },
  { p: '220710', t: 'MONO', nome: 'Álcool etílico', lei: 'Lei 9.718/1998, art. 5º' },
  { p: '22072011', t: 'MONO', nome: 'Álcool etílico combustível', lei: 'Lei 9.718/1998, art. 5º' },
  { p: '3001', t: 'MONO', nome: 'Produto farmacêutico', lei: 'Lei 10.147/2000, art. 1º' },
  { p: '3003', t: 'MONO', nome: 'Medicamento', lei: 'Lei 10.147/2000, art. 1º' },
  { p: '3004', t: 'MONO', nome: 'Medicamento', lei: 'Lei 10.147/2000, art. 1º' },
  { p: '3303', t: 'MONO', nome: 'Perfumaria', lei: 'Lei 10.147/2000, art. 1º' },
  { p: '3304', t: 'MONO', nome: 'Cosmético', lei: 'Lei 10.147/2000, art. 1º' },
  { p: '3305', t: 'MONO', nome: 'Produto capilar', lei: 'Lei 10.147/2000, art. 1º' },
  { p: '3307', t: 'MONO', nome: 'Higiene pessoal', lei: 'Lei 10.147/2000, art. 1º' },
  { p: '4011', t: 'MONO', nome: 'Pneu novo', lei: 'Lei 10.485/2002, art. 5º' },
  { p: '4013', t: 'MONO', nome: 'Câmara de ar', lei: 'Lei 10.485/2002, art. 5º' },
  { p: '2201', t: 'MONO', nome: 'Água mineral', lei: 'Lei 13.097/2015 (bebidas frias)' },
  { p: '2202', t: 'MONO', nome: 'Refrigerante / bebida não alcoólica', lei: 'Lei 13.097/2015 (bebidas frias)' },
  { p: '2203', t: 'MONO', nome: 'Cerveja', lei: 'Lei 13.097/2015 (bebidas frias)' },
  // alíquota zero
  { p: '31', t: 'ZERO', nome: 'Adubo ou fertilizante', lei: 'Lei 10.925/2004, art. 1º, I' },
  { p: '3808', t: 'ZERO', nome: 'Defensivo agropecuário', lei: 'Lei 10.925/2004, art. 1º, II', sai: 'AVA', obs: 'só o de uso agropecuário; inseticida doméstico é tributado' },
  { p: '25083000', t: 'ZERO', nome: 'Corretivo de solo (argila)', lei: 'Lei 10.925/2004, art. 1º, IV' },
  { p: '25221000', t: 'ZERO', nome: 'Cal viva (corretivo de solo)', lei: 'Lei 10.925/2004, art. 1º, IV' },
  { p: '25222000', t: 'ZERO', nome: 'Cal hidratada (corretivo de solo)', lei: 'Lei 10.925/2004, art. 1º, IV' },
  { p: '0407', t: 'ZERO', nome: 'Ovos', lei: 'Lei 10.865/2004, art. 28, III' },
  { p: '07', t: 'ZERO', nome: 'Hortícola', lei: 'Lei 10.865/2004, art. 28, III' },
  { p: '08', t: 'ZERO', nome: 'Fruta', lei: 'Lei 10.865/2004, art. 28, III' },
  { p: '0901', t: 'ZERO', nome: 'Café', lei: 'Lei 10.925/2004, art. 1º' },
  { p: '4901', t: 'ZERO', nome: 'Livro', lei: 'Lei 10.865/2004, art. 28, VI' },
  { p: '0401', t: 'ZERO', nome: 'Leite', lei: 'Lei 10.925/2004, art. 1º' },
  { p: '1006', t: 'ZERO', nome: 'Arroz', lei: 'Lei 10.925/2004, art. 1º' },
  { p: '1101', t: 'ZERO', nome: 'Farinha de trigo', lei: 'Lei 10.925/2004, art. 1º' },
  { p: '17019900', t: 'ZERO', nome: 'Açúcar', lei: 'Lei 10.925/2004, art. 1º' },
  { p: '48181000', t: 'ZERO', nome: 'Papel higiênico', lei: 'Lei 10.925/2004, art. 1º' },
  // carnes (cesta básica): conferido com a análise da Milk de um frigorífico (11/2026)
  { p: '0201', t: 'ZERO', nome: 'Carne bovina fresca ou refrigerada', lei: 'Lei 10.925/2004, art. 1º, XIX (Lei 12.839/2013)' },
  { p: '0202', t: 'ZERO', nome: 'Carne bovina congelada', lei: 'Lei 10.925/2004, art. 1º, XIX (Lei 12.839/2013)' },
  { p: '0203', t: 'ZERO', nome: 'Carne suína', lei: 'Lei 10.925/2004, art. 1º, XIX (Lei 12.839/2013)' },
  { p: '0204', t: 'ZERO', nome: 'Carne ovina ou caprina', lei: 'Lei 10.925/2004, art. 1º, XIX (Lei 12.839/2013)' },
  { p: '0206', t: 'ZERO', nome: 'Miudezas comestíveis', lei: 'Lei 10.925/2004, art. 1º, XIX (Lei 12.839/2013)' },
  { p: '0207', t: 'ZERO', nome: 'Carne de aves', lei: 'Lei 10.925/2004, art. 1º, XIX (Lei 12.839/2013)' },
  { p: '0209', t: 'ZERO', nome: 'Toucinho e gordura', lei: 'Lei 10.925/2004, art. 1º, XIX (Lei 12.839/2013)' },
  { p: '0210', t: 'ZERO', nome: 'Carne salgada, seca ou defumada', lei: 'Lei 10.925/2004, art. 1º, XIX (Lei 12.839/2013)' }
];
NCM_RULES.sort((a, b) => b.p.length - a.p.length);
function ncmRule(ncm) {
  if (!ncm) return null;
  for (const r of NCM_RULES) if (ncm.startsWith(r.p)) return r;
  return null;
}

const CLS = Object.assign({}, MODES.ENT.cls);
/* rótulos da coluna CLASSIF. como a equipe digita (vídeo 2, 16:14: "COM CREDITO") */
const CLS_KEY = { 'COM CREDITO': 'COM', 'SEM CREDITO': 'SEM', 'AVALIAR': 'AVA', 'RECUPERAR': 'COM', 'CORRETO': 'SEM', 'COM CRÉDITO': 'COM', 'SEM CRÉDITO': 'SEM' };
function setMode(id) { MODE = MODES[id] || MODES.ENT; Object.assign(CLS, MODE.cls); }
const normCls = c => c === 'COM CRÉDITO' ? 'COM CREDITO' : c === 'SEM CRÉDITO' ? 'SEM CREDITO' : c;
const clsDoModo = c => { c = normCls(c); return c === CLS.COM || c === CLS.SEM || c === CLS.AVA; };
const CONF = { a: 'Alta', m: 'Média', b: 'Baixa' };

/* Motor de regras: devolve a sugestão para um grupo (NCM + CFOP) de itens escriturados sem crédito. */
function suggest(g, kb) {
  const learned = kb && (kb[(g.ncm || '-') + '|' + (g.cfop || '-')] || (g.ncm && kb[g.ncm + '|*']));
  if (learned && clsDoModo(learned.cls)) return { cls: normCls(learned.cls), motivo: learned.motivo || 'Decisão registrada pela equipe', lei: learned.lei || '', conf: 'a', origem: 'Base da equipe' };

  const c3 = g.cfop ? g.cfop.slice(1) : '';
  const nr = ncmRule(g.ncm);
  const cst = g.cstMain;
  const servico = /^a1/i.test(g.registro) || /servi/i.test(g.tipoItem || '');

  if (!g.nc) return { cls: CLS.SEM, motivo: 'Período sem apuração não cumulativa (possível Lucro Presumido)', lei: 'Lei 10.833/2003, art. 10', conf: 'm', origem: 'Regime' };
  if (g.cfop && CFOP_SEM_AQUISICAO.has(c3))
    return { cls: CLS.SEM, motivo: 'CFOP sem aquisição (remessa, retorno, transferência, bonificação ou amostra)', lei: 'Lei 10.833/2003, art. 3º, I e II (crédito sobre bens adquiridos)', conf: 'a', origem: 'CFOP' };
  if (servico) {
    if (/frete|transporte/i.test(g.descTop)) return { cls: CLS.COM, motivo: 'Frete na operação de compra ou venda', lei: 'Lei 10.833/2003, art. 3º, I e IX', conf: 'm', origem: 'Serviço' };
    if (/aluguel|locac/i.test(g.descTop)) return { cls: CLS.COM, motivo: 'Aluguel de prédio, máquina ou equipamento', lei: 'Lei 10.833/2003, art. 3º, IV', conf: 'm', origem: 'Serviço' };
    return { cls: CLS.SEM, motivo: 'Serviço administrativo, sem relação com a revenda (não é insumo)', lei: 'Lei 10.833/2003, art. 3º, II; Parecer Normativo COSIT nº 5/2018', conf: 'm', origem: 'Serviço' };
  }
  if (!g.ncm) return { cls: CLS.AVA, motivo: 'Item sem NCM: classificar pela descrição', lei: '', conf: 'b', origem: 'Dados' };
  if (nr && nr.t === 'MONO') {
    if (CFOP_REVENDA.has(c3)) return { cls: CLS.SEM, motivo: 'Monofásico na revenda: ' + nr.nome, lei: nr.lei + '; Lei 10.833/2003, art. 3º, I, "b"', conf: 'a', origem: 'NCM' };
    return { cls: CLS.AVA, motivo: nr.nome + ' para consumo próprio: crédito só se for insumo essencial ou relevante', lei: 'Lei 10.833/2003, art. 3º, II; REsp 1.221.170/PR', conf: 'b', origem: 'NCM' };
  }
  if (nr && nr.t === 'ZERO') return { cls: CLS.SEM, motivo: 'Alíquota zero na aquisição: ' + nr.nome, lei: nr.lei + '; Lei 10.833/2003, art. 3º, § 2º, II', conf: 'a', origem: 'NCM' };
  if (CFOP_REVENDA.has(c3)) {
    const st = CFOP_ST.has(c3) ? ' (o ICMS-ST não afasta o crédito de PIS/COFINS)' : '';
    const conf = (cst === '70' || cst === '98' || cst === '99' || cst === '') ? 'a' : 'm';
    const obs = conf === 'm' ? ' · CST ' + cst + ' informado: conferir NCM e descrição' : '';
    return { cls: CLS.COM, motivo: 'Revenda de produto tributado escriturada sem crédito' + st + obs, lei: 'Lei 10.637/2002 e Lei 10.833/2003, art. 3º, I', conf, origem: 'CFOP + NCM' };
  }
  if (CFOP_DEVOLUCAO.has(c3)) return { cls: CLS.COM, motivo: 'Devolução de venda tributada (natureza 12)', lei: 'Lei 10.833/2003, art. 3º, VIII', conf: 'm', origem: 'CFOP' };
  if (CFOP_ENERGIA.has(c3)) return { cls: CLS.COM, motivo: 'Energia elétrica consumida no estabelecimento', lei: 'Lei 10.833/2003, art. 3º, III', conf: 'a', origem: 'CFOP' };
  if (CFOP_FRETE.has(c3)) return { cls: CLS.COM, motivo: 'Frete na operação de compra ou venda', lei: 'Lei 10.833/2003, art. 3º, I e IX', conf: 'm', origem: 'CFOP' };
  if (CFOP_ATIVO.has(c3)) return { cls: CLS.AVA, motivo: 'Ativo imobilizado: crédito sobre depreciação ou aquisição (naturezas 09 e 10)', lei: 'Lei 10.833/2003, art. 3º, VI e § 14', conf: 'm', origem: 'CFOP' };
  if (CFOP_COMBUSTIVEL.has(c3)) return { cls: CLS.AVA, motivo: 'Combustível para consumo: crédito só se for insumo essencial ou relevante', lei: 'Lei 10.833/2003, art. 3º, II; REsp 1.221.170/PR', conf: 'b', origem: 'CFOP' };
  if (CFOP_USO_CONSUMO.has(c3)) return { cls: CLS.AVA, motivo: 'Uso e consumo: crédito só se for insumo essencial ou relevante à atividade', lei: 'REsp 1.221.170/PR; Parecer Normativo COSIT nº 5/2018', conf: 'b', origem: 'CFOP' };
  if (CFOP_COMUNIC.has(c3)) return { cls: CLS.SEM, motivo: 'Serviço de comunicação em estabelecimento comercial (não é insumo)', lei: 'Lei 10.833/2003, art. 3º, II', conf: 'm', origem: 'CFOP' };
  if (CFOP_OUTRAS.has(c3)) return { cls: CLS.AVA, motivo: 'Outra entrada não especificada: verificar a natureza da operação', lei: '', conf: 'b', origem: 'CFOP' };
  return { cls: CLS.AVA, motivo: 'Sem regra para o CFOP ' + (g.cfop || '—') + ': análise manual', lei: '', conf: 'b', origem: 'Sem regra' };
}


/* ======================= saídas (planilha 047) ======================= */
/* CFOPs sem o 1º dígito (5, 6 ou 7) */
const CFOP_SAI_VENDA = CF('101 102 103 104 105 106 109 110 111 112 113 114 115 116 117 118 119 120 122 123 124 125 401 402 403 404 405 651 652 653 654 655 656 667');
const CFOP_SAI_REVENDA = CF('102 104 106 108 110 115 117 119 120 123 403 404 405 652 654 656');
const CFOP_SAI_SEM_RECEITA = CF('151 152 153 155 156 408 409 552 557 901 902 903 904 905 906 907 908 909 910 911 912 913 914 915 916 917 918 919 920 921 923 924 925 934');
const CFOP_SAI_DEV_COMPRA = CF('201 202 208 209 210 410 411 412 413 503 553 556 660 661 662');
const CST_SAI_DESC = {
  '01': 'Tributável (alíquota básica)', '02': 'Tributável (alíquota diferenciada)', '03': 'Tributável (alíquota por unidade de medida)', '04': 'Monofásica (revenda a alíquota zero)',
  '05': 'Substituição tributária', '06': 'Alíquota zero', '07': 'Isenta', '08': 'Sem incidência', '09': 'Suspensão', '49': 'Outras operações de saída', '99': 'Outras operações'
};
const CST_NAO_TRIB = new Set(['04', '05', '06', '07', '08', '09']);
/* registros que consolidam a venda sem o produto (NFC-e, cupom fiscal, ECF) */
const REG_CONSOLIDADO = /\b(C175|C181|C185|C381|C385|C481|C485|C491|C495|C601|C605|C870|C880|D300|D350)\b/i;

/* Motor de regras das saídas: sugestão para um grupo (NCM + CFOP) de vendas tributadas.
   RECUPERAR = a contribuição foi paga sobre uma receita que não deveria ser tributada. */
function suggestSai(g, kb) {
  const learned = kb && (kb['S|' + (g.ncm || '-') + '|' + (g.cfop || '-')] || (g.ncm && kb['S|' + g.ncm + '|*']));
  if (learned && clsDoModo(learned.cls)) return { cls: learned.cls, motivo: learned.motivo || 'Decisão registrada pela equipe', lei: learned.lei || '', conf: 'a', origem: 'Base da equipe', cat: 'Base da equipe' };
  const c0 = g.cfop ? g.cfop[0] : '', c3 = g.cfop ? g.cfop.slice(1) : '';
  const nr = ncmRule(g.ncm);
  if (c0 === '7') return { cls: CLS.COM, motivo: 'Exportação tributada: a receita de exportação não sofre PIS nem COFINS', lei: 'Lei 10.637/2002, art. 5º, I; Lei 10.833/2003, art. 6º, I', conf: 'a', origem: 'CFOP', cat: 'Exportação' };
  if (g.cfop && CFOP_SAI_SEM_RECEITA.has(c3)) return { cls: CLS.COM, motivo: 'Operação sem receita (remessa, retorno, transferência, bonificação ou amostra) tributada', lei: 'Lei 10.637/2002 e Lei 10.833/2003, art. 1º (incidência sobre a receita)', conf: 'm', origem: 'CFOP', cat: 'Operação sem receita' };
  if (c3 === '551') return { cls: CLS.COM, motivo: 'Venda de bem do ativo imobilizado tributada: receita excluída da base', lei: 'Lei 10.637/2002, art. 1º, § 3º, VI; Lei 10.833/2003, art. 1º, § 3º, II', conf: 'm', origem: 'CFOP', cat: 'Venda de ativo imobilizado' };
  if (g.cfop && CFOP_SAI_DEV_COMPRA.has(c3)) return { cls: CLS.AVA, motivo: 'Devolução de compra com débito: o usual é estornar o crédito da entrada (CST 49), não tributar como receita', lei: 'Guia Prático da EFD-Contribuições', conf: 'b', origem: 'CFOP' };
  if (!g.ncm && REG_CONSOLIDADO.test(g.registro)) return { cls: CLS.SEM, motivo: 'Venda consolidada (NFC-e ou cupom): o SPED não traz o produto. Para revisar por NCM, pedir os XML das notas ou o relatório de vendas por produto', lei: 'Guia Prático da EFD-Contribuições (registros C175, C181/C185, C481/C485)', conf: 'm', origem: 'Registro' };
  if (!g.ncm) return { cls: CLS.AVA, motivo: 'Item sem NCM: conferir pela descrição', lei: '', conf: 'b', origem: 'Dados' };
  if (nr && nr.t === 'MONO') {
    if (CFOP_SAI_REVENDA.has(c3)) return { cls: CLS.COM, motivo: 'Revenda de produto monofásico tributada (' + nr.nome.toLowerCase() + '): na revenda a alíquota é zero, CST 04', lei: nr.lei, conf: 'a', origem: 'NCM', cat: 'Monofásico na revenda' };
    return { cls: CLS.AVA, motivo: nr.nome + ' em venda de produção própria: fabricante e importador recolhem pela alíquota concentrada', lei: nr.lei, conf: 'b', origem: 'NCM' };
  }
  if (nr && nr.t === 'ZERO') {
    if (nr.sai === 'AVA') return { cls: CLS.AVA, motivo: nr.nome + ' tributado na venda: alíquota zero ' + (nr.obs || 'conforme o uso'), lei: nr.lei, conf: 'm', origem: 'NCM' };
    return { cls: CLS.COM, motivo: 'Produto de alíquota zero tributado na venda: ' + nr.nome.toLowerCase() + '. O correto é CST 06', lei: nr.lei, conf: 'a', origem: 'NCM', cat: 'Alíquota zero' };
  }
  if (g.semTribCst && g.semTribCst.length) return { cls: CLS.AVA, motivo: 'O mesmo NCM aparece em outras vendas sem tributação (CST ' + g.semTribCst.join(', ') + '): conferir o cadastro do produto', lei: '', conf: 'm', origem: 'Histórico do NCM' };
  if (CFOP_SAI_VENDA.has(c3) || c3 === '933') return { cls: CLS.SEM, motivo: 'Venda de produto com tributação normal', lei: 'Lei 10.637/2002 e Lei 10.833/2003, art. 1º', conf: 'a', origem: 'CFOP + NCM' };
  if (c3 === '949' || c3 === '922') return { cls: CLS.AVA, motivo: 'Outra saída não especificada: verificar se houve receita', lei: '', conf: 'b', origem: 'CFOP' };
  return { cls: CLS.AVA, motivo: 'Sem regra para o CFOP ' + (g.cfop || '—') + ': análise manual', lei: '', conf: 'b', origem: 'Sem regra' };
}
