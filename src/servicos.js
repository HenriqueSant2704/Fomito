// Pedidos, comandas das mesas e caixa: tudo que muda dados importantes passa por aqui,
// sempre numa transação, para dois aparelhos ao mesmo tempo não baterem um no outro.
const db = require('./db');
const loja = require('./loja');
const whatsapp = require('./whatsapp');
const { falhar, arred, numero, texto, soDigitos, formatarTelefone, separarNumero } = require('./util');
const { montarItens, somaItens, resumoCaixa, conferirPagamento, bolsasDe } = require('./regras');

const mesaTexto = (n) => `Mesa ${String(n).padStart(2, '0')}`;

/* ==========================================================================
   Formatos que as telas usam
   ========================================================================== */
const pedidoDaLinha = (r) => ({ ...r.dados, num: r.num, status: r.status, total: Number(r.total) });

function comandaDaLinha(r) {
  const { dispositivos, ...dados } = r.dados;
  /* O celular de quem pediu pelo QR fica só no servidor (para o WhatsApp), não vai para as telas */
  const rodadas = (dados.rodadas || []).map(({ telefone, ...rd }) => rd);
  return { ...dados, rodadas, mesa: r.mesa, numero: r.numero || undefined, total: Number(r.total) };
}

/* ==========================================================================
   CAIXA
   ========================================================================== */
async function caixaAberto(c, travar = false) {
  const { rows } = await c.query(`SELECT id, dados FROM caixas WHERE aberto ${travar ? 'FOR UPDATE' : ''}`);
  return rows[0] || null;
}

/** Coloca um movimento no caixa aberto (dentro de uma transação que já travou o caixa). */
async function registrar(c, caixa, movimento) {
  const m = caixa.dados.movimentos;
  m.push({ id: `m${Date.now()}-${m.length}`, hora: Date.now(), ...movimento });
  await c.query('UPDATE caixas SET dados = $2 WHERE id = $1', [caixa.id, caixa.dados]);
}

const CAIXA_FECHADO = 'O caixa está fechado. Peça para abrir o caixa no painel.';

async function abrirCaixa({ fundo, motoboys = {}, garcons = {} }, por) {
  const valor = numero(fundo);
  if (!(valor >= 0)) falhar(400, 'Informe o dinheiro inicial (pode ser R$ 0,00).');
  /* Troco que cada motoboy leva na bolsa (separado da gaveta do balcão) */
  const bolsas = {};
  for (const [nome, f] of Object.entries(motoboys || {})) {
    const v = numero(f);
    if (v > 0) bolsas[texto(nome, 60)] = { fundo: v, definidoEm: Date.now(), por };
  }
  /* Garçons que trabalham com bolsa própria (pochete + maquininha): o troco pode ser R$ 0,00 */
  const bolsasGarcons = {};
  for (const [nome, f] of Object.entries(garcons || {})) {
    const v = numero(f);
    if (v >= 0) bolsasGarcons[texto(nome, 60)] = { fundo: v, definidoEm: Date.now(), por };
  }
  return db.tx(async (c) => {
    if (await caixaAberto(c, true)) falhar(409, 'Já existe um caixa aberto.');
    const dados = { abertoEm: Date.now(), por, fundo: valor, motoboys: bolsas, garcons: bolsasGarcons, movimentos: [] };
    await c.query('INSERT INTO caixas (dados) VALUES ($1)', [dados]);
    return dados;
  });
}

async function movimentoCaixa({ tipo, ref, valor }, por) {
  if (!['sangria', 'suprimento'].includes(tipo)) falhar(400, 'Tipo de movimento inválido.');
  const v = numero(valor);
  if (!(v > 0)) falhar(400, 'Informe o valor.');
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, CAIXA_FECHADO);
    const disponivel = resumoCaixa(caixa.dados).esperado;
    if (tipo === 'sangria' && v > disponivel + 0.001) falhar(400, `Não há esse valor na gaveta (deveria ter ${disponivel.toFixed(2).replace('.', ',')}).`);
    await registrar(c, caixa, { tipo, ref: texto(ref, 80) || (tipo === 'sangria' ? 'Tirar dinheiro' : 'Colocar dinheiro'), forma: 'dinheiro', valor: v, por });
    return true;
  });
}

/**
 * Corrige um pagamento lançado errado. Nada é apagado: guarda o antes,
 * o depois, quem corrigiu, quando e o motivo (igual ao protótipo).
 */
/**
 * Refaz a divisão de uma comanda já paga (ex.: o garçom dividiu por 3, mas eram 4).
 * Só pelo caixa (administrador ou atendente), com motivo. Cada pagamento passa a ser a parte
 * nova; quem entrar na divisão vira um pagamento novo. Tudo fica no registro de correções.
 */
/* Pagamentos da comanda como estão no caixa. Mantém o telefone do convênio:
   sem ele, o que o cliente deve sumia do extrato depois de uma correção. */
const pagamentosDaComanda = (dadosCaixa, numero) => dadosCaixa.movimentos
  .filter((m) => m.tipo === 'comanda' && m.comanda === numero)
  .map(({ forma, valor, recebido, troco, telefone, cliente }) => Object.fromEntries(
    Object.entries({ forma, valor, recebido, troco, telefone, cliente }).filter(([, v]) => v != null)));

async function redividirComanda(numero, { pessoas, forma = 'pix', motivo }, por) {
  if (!texto(motivo)) falhar(400, 'Escreva o motivo da correção.');
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, 'Só dá para corrigir com o caixa aberto.');
    const { rows } = await c.query('SELECT * FROM comandas WHERE numero = $1 FOR UPDATE', [Number(numero)]);
    if (!rows[0]) falhar(404, 'Comanda não encontrada.');
    const linha = rows[0];
    const movs = caixa.dados.movimentos.filter((m) => m.tipo === 'comanda' && (m.comanda === Number(numero) || String(m.ref || '').endsWith(`comanda #${numero}`)));
    if (!movs.length) falhar(404, 'Os pagamentos dessa comanda não estão no caixa aberto.');
    const novas = parseInt(pessoas, 10);
    if (!(novas >= movs.length && novas <= 50)) falhar(400, `Escolha de ${movs.length} a 50 pessoas (já há ${movs.length} pagamento${movs.length > 1 ? 's' : ''}).`);
    const total = Number(linha.total);
    const parte = arred(Math.floor((total / novas) * 100) / 100);
    const valores = Array.from({ length: novas }, (_, i) => (i === novas - 1 ? arred(total - parte * (novas - 1)) : parte));
    const agora = Date.now();
    const registro = (antes, depois) => ({ em: agora, por, motivo: texto(motivo, 200), antes, depois });
    movs.forEach((m, i) => {
      const antes = Object.fromEntries(CAMPOS.map((k) => [k, m[k] ?? null]));
      m.valor = valores[i];
      if (m.forma === 'dinheiro') { m.recebido = Math.max(m.recebido ?? 0, m.valor); m.troco = arred(m.recebido - m.valor); }
      m.divisao = novas;
      (m.correcoes ||= []).push(registro(antes, Object.fromEntries(CAMPOS.map((k) => [k, m[k] ?? null]))));
    });
    const f = ['dinheiro', 'pix', 'credito', 'debito'].includes(forma) ? forma : 'pix';
    for (let i = movs.length; i < novas; i++) {
      const novo = { id: `m${agora}-${caixa.dados.movimentos.length}`, hora: agora, tipo: 'comanda', comanda: Number(numero), divisao: novas,
        ref: `${mesaTexto(linha.mesa)} · comanda #${numero}`, forma: f, valor: valores[i], ...(f === 'dinheiro' ? { recebido: valores[i], troco: 0 } : {}), por };
      novo.correcoes = [registro({ forma: null, valor: null, recebido: null, troco: null, ref: null }, Object.fromEntries(CAMPOS.map((k) => [k, novo[k] ?? null])))];
      caixa.dados.movimentos.push(novo);
    }
    await c.query('UPDATE caixas SET dados = $2 WHERE id = $1', [caixa.id, caixa.dados]);
    const d = linha.dados;
    (d.historicoDivisao ||= []).push({ em: agora, por, de: d.divisao || movs.length, para: novas, motivo: texto(motivo, 200) });
    d.divisao = novas;
    d.pagamentos = pagamentosDaComanda(caixa.dados, Number(numero));
    await c.query('UPDATE comandas SET dados = $2 WHERE id = $1', [linha.id, d]);
    return { divisao: novas, valores };
  });
}

const CHAVE_BOLSA = { motoboy: 'motoboys', garcom: 'garcons' };
const tipoBolsa = (tipo) => (tipo === 'garcom' ? 'garcom' : 'motoboy');

/**
 * Define (ou ajusta) o troco da bolsa de um motoboy ou garçom, com o caixa aberto.
 * Para o garçom, criar a bolsa é dizer que ele trabalha com pochete e maquininha próprias:
 * as mesas que ELE fechar dali em diante vão para a bolsa dele, não para a gaveta.
 */
async function trocoBolsa({ nome, fundo, tipo }, por) {
  const t = tipoBolsa(tipo);
  const v = numero(fundo);
  if (!(v >= 0) || !texto(nome)) falhar(400, `Informe o ${t === 'garcom' ? 'garçom' : 'motoboy'} e o troco.`);
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, CAIXA_FECHADO);
    const lista = (caixa.dados[CHAVE_BOLSA[t]] ||= {});
    const novo = !lista[texto(nome, 60)];
    const b = (lista[texto(nome, 60)] ||= {});
    if (b.fechamento && !bolsasDe(caixa.dados, t)[texto(nome, 60)]?.pendente) falhar(409, 'A bolsa já foi conferida hoje.');
    Object.assign(b, { fundo: v, por }, novo || !b.definidoEm ? { definidoEm: Date.now() } : {});
    await c.query('UPDATE caixas SET dados = $2 WHERE id = $1', [caixa.id, caixa.dados]);
    return true;
  });
}

/**
 * Confere a bolsa (separada da gaveta): o dinheiro e o extrato da maquininha (crédito e débito).
 * Se algo não bater, a observação é obrigatória. O que sobrar pode ficar de troco para amanhã.
 */
async function fecharBolsa({ nome, tipo, contado, credito, debito, obs = '', fica = 0 }, por) {
  const t = tipoBolsa(tipo);
  const v = numero(contado);
  if (!(v >= 0)) falhar(400, 'Informe quanto dinheiro tem na bolsa.');
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, CAIXA_FECHADO);
    const b = bolsasDe(caixa.dados, t)[nome];
    if (!b) falhar(404, 'Essa bolsa não existe hoje.');
    /* Maquininha: só pede o extrato se passou cartão por ela */
    const cartao = { credito: numero(credito), debito: numero(debito) };
    for (const k of ['credito', 'debito']) {
      if (b[k] > 0 && !(cartao[k] >= 0)) falhar(400, `Informe o ${k === 'credito' ? 'crédito' : 'débito'} do extrato da maquininha.`);
      if (!(cartao[k] >= 0)) cartao[k] = 0;
    }
    const bateDinheiro = Math.abs(v - b.esperado) < 0.005;
    const bateCartao = Math.abs(cartao.credito - b.credito) < 0.005 && Math.abs(cartao.debito - b.debito) < 0.005;
    if ((!bateDinheiro || !bateCartao) && !texto(obs)) falhar(400, `${!bateDinheiro ? 'O dinheiro' : 'A maquininha'} não bateu: escreva uma observação.`);
    const ficaV = Math.min(v, Math.max(0, numero(fica) || 0));
    const reg = ((caixa.dados[CHAVE_BOLSA[t]] ||= {})[nome] ||= { fundo: 0 });
    reg.fechamento = {
      em: Date.now(), por, contado: v, esperado: b.esperado, obs: texto(obs, 300), ficaParaAmanha: ficaV,
      cartao: { esperado: { credito: b.credito, debito: b.debito }, contado: cartao },
    };
    await c.query('UPDATE caixas SET dados = $2 WHERE id = $1', [caixa.id, caixa.dados]);
    return reg.fechamento;
  });
}

const CAMPOS = ['forma', 'valor', 'recebido', 'troco', 'ref'];
async function corrigirMovimento(id, novo, { motivo }, por) {
  if (!texto(motivo)) falhar(400, 'Escreva o motivo da correção.');
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, 'Só dá para corrigir com o caixa aberto.');
    const m = caixa.dados.movimentos.find((x) => x.id === id);
    if (!m) falhar(404, 'Esse movimento não está no caixa aberto.');
    if (m.forma === 'convenio' || novo.forma === 'convenio' || m.tipo === 'convenio') falhar(400, 'Pagamento de convênio não se corrige aqui: use a página Convênios.');
    const antes = Object.fromEntries(CAMPOS.map((k) => [k, m[k] ?? null]));
    const depois = { ...antes };
    if (novo.valor !== undefined) depois.valor = numero(novo.valor);
    if (!(depois.valor > 0)) falhar(400, 'Informe o valor.');
    if (['comanda', 'entrega', 'balcao'].includes(m.tipo) && novo.forma) {
      Object.assign(depois, conferirPagamento({ forma: novo.forma, valor: depois.valor, recebido: novo.recebido }));
    }
    if (depois.forma !== 'dinheiro') Object.assign(depois, { recebido: null, troco: null });
    if (CAMPOS.every((k) => antes[k] === depois[k])) falhar(400, 'Nada foi alterado.');
    CAMPOS.forEach((k) => { if (depois[k] == null) delete m[k]; else m[k] = depois[k]; });
    (m.correcoes ||= []).push({ em: Date.now(), por, motivo: texto(motivo, 200), antes, depois });
    await c.query('UPDATE caixas SET dados = $2 WHERE id = $1', [caixa.id, caixa.dados]);

    /* Mesa: a comanda fechada também passa a mostrar a forma certa (Concluídos, detalhe e notinha) */
    if (m.tipo === 'comanda' && m.comanda) {
      const { rows: [cmd] } = await c.query('SELECT id, dados FROM comandas WHERE numero = $1 FOR UPDATE', [m.comanda]);
      if (cmd) {
        const pags = pagamentosDaComanda(caixa.dados, m.comanda);
        const formas = [...new Set(pags.map((x) => x.forma))];
        await c.query('UPDATE comandas SET dados = $2 WHERE id = $1', [cmd.id, { ...cmd.dados, pagamentos: pags, forma: pags.length > 1 ? 'misto' : formas[0] }]);
      }
    }
    /* Entrega e balcão: o pedido também passa a mostrar a forma certa (e o acerto do motoboy) */
    if (['entrega', 'balcao'].includes(m.tipo) && m.pedido) {
      await c.query(`UPDATE pedidos SET dados = dados || $2::jsonb, atualizado_em = now() WHERE num = $1`,
        [m.pedido, { pagoCom: m.forma, recebido: m.recebido ?? null, trocoDado: m.troco ?? null }]);
    }
    return { ...m };
  });
}

/**
 * Fecha o caixa: confere o dinheiro da gaveta e o extrato da maquininha do balcão (crédito e débito).
 * Antes, todas as bolsas (motoboys e garçons) precisam estar conferidas e ninguém pode estar na rua.
 * Pix não se confere aqui: fica só registrado.
 */
async function fecharCaixa({ contado, credito, debito, obs }, por) {
  const v = numero(contado);
  if (!(v >= 0)) falhar(400, 'Informe quanto dinheiro tem na gaveta.');
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, 'Não há caixa aberto.');
    /* Entrega na rua: com o caixa fechado o motoboy não consegue finalizar e o dinheiro ficaria fora da conta */
    const { rows: naRua } = await c.query("SELECT num, dados->>'motoboy' AS motoboy FROM pedidos WHERE status = 'rota' ORDER BY num");
    if (naRua.length) falhar(409, `Ainda tem entrega na rua (${naRua.map((p) => `#${p.num}${p.motoboy ? ` com ${p.motoboy}` : ''}`).join(', ')}). Espere o motoboy finalizar para fechar o caixa.`);
    const r = resumoCaixa(caixa.dados);
    if (r.bolsasPendentes.length) {
      const nomes = r.bolsasPendentes.map((b) => `${b.nome} (${b.tipo === 'garcom' ? 'garçom' : 'motoboy'})`).join(', ');
      falhar(409, `Confira antes a bolsa de: ${nomes}. Depois feche o caixa.`);
    }
    const cartao = { credito: numero(credito), debito: numero(debito) };
    for (const k of ['credito', 'debito']) {
      if (r.cartoesEsperado[k] > 0 && !(cartao[k] >= 0)) falhar(400, `Informe o ${k === 'credito' ? 'crédito' : 'débito'} do extrato da maquininha.`);
      if (!(cartao[k] >= 0)) cartao[k] = 0;
    }
    const bateDinheiro = Math.abs(v - r.esperado) < 0.005;
    const bateCartao = Math.abs(cartao.credito - r.cartoesEsperado.credito) < 0.005 && Math.abs(cartao.debito - r.cartoesEsperado.debito) < 0.005;
    if ((!bateDinheiro || !bateCartao) && !texto(obs)) falhar(400, `${!bateDinheiro ? 'O dinheiro da gaveta' : 'A maquininha'} não bateu: escreva uma observação.`);
    const correcoes = caixa.dados.movimentos.reduce((s, m) => s + (m.correcoes?.length || 0), 0);
    const fechamento = {
      ...caixa.dados, fechadoEm: Date.now(), fechadoPor: por, vendas: r.vendas, dinheiro: r.porForma.dinheiro,
      esperado: r.esperado, contado: v, obs: texto(obs, 300), porForma: r.porForma, correcoes, bolsas: r.bolsas, bolsasGarcons: r.bolsasGarcons,
      cartao: { esperado: r.cartoesEsperado, contado: cartao }, pix: arred(r.gaveta.pix + [...Object.values(r.bolsas), ...Object.values(r.bolsasGarcons)].reduce((t, b) => t + b.pix, 0)), // só registro
    };
    await c.query('UPDATE caixas SET aberto = false, fechado_em = now(), dados = $2 WHERE id = $1', [caixa.id, fechamento]);
    return fechamento;
  });
}

/* ==========================================================================
   PEDIDOS DE ENTREGA E BALCÃO
   ========================================================================== */

/**
 * Cria um pedido. O preço sai do cardápio do servidor, nunca do navegador.
 * equipe = true quando foi lançado pelo painel (por telefone ou balcão).
 */
async function criarPedido(corpo, { equipe = false, dispositivo = null } = {}) {
  const { cardapio } = loja.obter();
  if (!equipe) {
    const f = loja.funcionamento(cardapio.lanchonete);
    if (f.pausada) falhar(409, 'A loja não está recebendo pedidos agora.');
    if (f.foraDoHorario) falhar(409, `A loja está fechada agora${f.abreEm ? `. Abre ${f.abreEm}` : ''}.`);
  }
  /* "local" = balcão: lançado pelo painel ou "Retirar no balcão" no cardápio */
  const retirada = corpo.modo === 'retirada';
  const modo = (equipe && corpo.modo === 'local') || retirada ? 'local' : 'entrega';
  const itens = montarItens(cardapio, (corpo.itens || []).map((i) => (Array.isArray(i) ? { id: i[0], qtd: i[1], extras: i[2], obs: i[3], sem: i[4] } : i)));
  const subtotal = somaItens(itens);
  const taxa = modo === 'entrega' ? cardapio.lanchonete.taxaEntrega : 0;
  const total = arred(subtotal + taxa);

  const dados = { modo, criadoEm: Date.now(), itens: itens.map((i) => [i.id, i.qtd, i.extras, i.obs, i.preco, i.nome]), taxa };
  /* Convênio: só para o cliente conveniado. Pelo cardápio ele SEMPRE confirma com o CPF/CNPJ do convênio,
     mesmo que o aparelho esteja logado como equipe (foi assim que um pedido passou com CPF errado).
     Só o "Lançar pedido" do painel (painel: true, com login da loja) dispensa o documento. */
  const peloPainel = equipe && corpo.painel === true;
  const convenio = corpo.pag === 'convenio' && (modo === 'entrega' || retirada || peloPainel);
  if (corpo.pag === 'convenio') {
    if (!convenio) falhar(400, 'Convênio só vale para entrega, retirada ou pedido lançado pela loja.');
    const conv = await conferirConvenio(db, corpo.telefone, total, peloPainel ? null : String(corpo.cpf ?? ''));
    dados.convenio = { empresa: conv.empresa || '' };
  }
  const formasValidas = (lista) => (convenio ? [...lista, 'convenio'] : lista);
  if (modo === 'entrega') {
    const tel = soDigitos(corpo.telefone);
    if (tel.length < 10) falhar(400, 'Informe o celular com DDD.');
    const formas = formasValidas(cardapio.formasPagamento.filter((f) => f.ativa !== false).map((f) => f.id));
    if (!formas.includes(corpo.pag)) falhar(400, 'Escolha a forma de pagamento.');
    const troco = corpo.pag === 'dinheiro' && corpo.troco ? numero(corpo.troco) : null;
    if (troco !== null && !(troco >= total)) falhar(400, 'O troco precisa ser para um valor maior que o total.');
    Object.assign(dados, {
      cliente: texto(corpo.cliente, 80), telefone: formatarTelefone(tel),
      /* Rua e número chegam separados; no pedido ficam juntos ("Rua X, 120"), como a notinha e o motoboy usam */
      rua: [texto(corpo.rua, 120), texto(corpo.numero, 12)].filter(Boolean).join(', '), numero: texto(corpo.numero, 12),
      compl: texto(corpo.compl, 60), bairro: texto(corpo.bairro, 60), ref: texto(corpo.ref, 120),
      pag: corpo.pag, troco,
    });
    if (!dados.cliente || !dados.rua || !separarNumero(dados.rua).numero || !dados.bairro) falhar(400, 'Preencha o nome, a rua, o número e o bairro.');
  } else if (retirada) {
    const tel = soDigitos(corpo.telefone);
    if (tel.length < 10) falhar(400, 'Informe o celular com DDD.');
    const formas = formasValidas(cardapio.formasPagamento.filter((f) => f.ativa !== false).map((f) => f.id));
    if (!formas.includes(corpo.pag)) falhar(400, 'Escolha a forma de pagamento.');
    const troco = corpo.pag === 'dinheiro' && corpo.troco ? numero(corpo.troco) : null;
    if (troco !== null && !(troco >= total)) falhar(400, 'O troco precisa ser para um valor maior que o total.');
    Object.assign(dados, { cliente: texto(corpo.cliente, 80), telefone: formatarTelefone(tel), retirada: true, pag: corpo.pag, troco });
    if (dados.cliente.length < 2) falhar(400, 'Digite seu nome.');
  } else if (convenio) {
    /* Balcão lançado pela loja para um cliente conveniado */
    const tel = soDigitos(corpo.telefone);
    const { rows: [cli] } = await db.query('SELECT nome FROM clientes WHERE telefone = $1', [tel]);
    Object.assign(dados, { cliente: texto(corpo.cliente, 80) || cli?.nome || 'Convênio', telefone: formatarTelefone(tel), pag: 'convenio' });
  } else {
    Object.assign(dados, { cliente: texto(corpo.cliente, 80) || 'Balcão · Retirada', pag: null });
  }

  const { rows } = await db.query(
    `INSERT INTO pedidos (modo, status, telefone, dispositivo, dados, total) VALUES ($1, 'novo', $2, $3, $4, $5) RETURNING *`,
    [modo, soDigitos(dados.telefone) || null, dispositivo, dados, total]);
  const pedido = pedidoDaLinha(rows[0]);
  whatsapp.avisar(pedido, 'recebido'); // entrega e retirada (sem celular, como no balcão do painel, não envia)
  return pedido;
}

/** Muda o pedido dentro de uma transação, com ele travado. */
async function alterarPedido(c, num, fn) {
  if (!Number.isInteger(Number(num))) falhar(404, 'Pedido não encontrado.');
  const { rows } = await c.query('SELECT * FROM pedidos WHERE num = $1 FOR UPDATE', [Number(num)]);
  if (!rows[0]) falhar(404, `Pedido #${num} não encontrado.`);
  const p = pedidoDaLinha(rows[0]);
  const mudancas = await fn(p);
  const novo = { ...p, ...mudancas };
  const { num: _n, status, total, ...dados } = novo;
  await c.query('UPDATE pedidos SET status = $2, dados = $3, atualizado_em = now() WHERE num = $1', [p.num, status, dados]);
  return novo;
}

/** Painel: aceitar (preparo), marcar pronto e, no balcão, cliente retirou. */
async function avancarPedido(num, { forma, recebido } = {}, por = '') {
  const pedido = await db.tx(async (c) => {
    /* Balcão/retirada: quando o cliente retira, o pagamento entra no caixa (como a entrega e a mesa) */
    const caixa = await caixaAberto(c, true); // trava o caixa antes do pedido, na mesma ordem da entrega
    let pagamento = null;
    const p = await alterarPedido(c, num, (atual) => {
      if (atual.status === 'novo') return { status: 'preparo', aceitoEm: Date.now() };
      if (atual.status === 'preparo') return { status: 'pronto', prontoEm: Date.now() };
      if (atual.status === 'pronto' && atual.modo === 'local') {
        pagamento = atual.pag === 'convenio' ? { forma: 'convenio', valor: atual.total } : conferirPagamento({ forma, valor: atual.total, recebido });
        return { status: 'concluido', entregueEm: Date.now(), pagoCom: pagamento.forma, recebido: pagamento.recebido ?? null, trocoDado: pagamento.troco ?? null, retiradoPor: por };
      }
      falhar(409, `O pedido #${atual.num} já mudou em outro aparelho. A tela vai atualizar.`);
    });
    if (pagamento) {
      if (!caixa) falhar(409, CAIXA_FECHADO);
      await registrar(c, caixa, { tipo: 'balcao', pedido: p.num, ref: `${p.retirada ? 'Retirada' : 'Balcão'} #${p.num} · ${p.cliente}`, ...pagamento, ...(pagamento.forma === 'convenio' ? { telefone: soDigitos(p.telefone), cliente: p.cliente } : {}), por });
    }
    return p;
  });
  /* Mensagem certa para cada tipo: entrega (preparo; saiu e entregue vêm do motoboy) e retirada no balcão */
  const tipo = pedido.modo === 'entrega'
    ? { preparo: 'preparo' }[pedido.status]
    : { preparo: 'preparo_balcao', pronto: 'pronto_balcao', concluido: 'retirado' }[pedido.status];
  if (tipo) whatsapp.avisar(pedido, tipo);
  return pedido;
}

/** Mensagem do WhatsApp para quem pediu pela mesa (QR Code) e deixou o celular. O garçom não avisa ninguém. */
function avisarMesa(comanda, rodada, tipo, total) {
  if (rodada?.por !== 'qr' || !rodada.telefone) return;
  whatsapp.avisar({ cliente: rodada.nome || comanda.nome, telefone: rodada.telefone, mesa: mesaTexto(comanda.mesa), total }, tipo);
}

/** Painel: cancela o pedido com o motivo, que vai para o cliente no WhatsApp e fica no pedido. */
async function cancelarPedido(num, por, motivo) {
  const porque = texto(motivo, 200);
  if (!porque) falhar(400, 'Escreva o motivo do cancelamento.');
  const pedido = await db.tx((c) => alterarPedido(c, num, (p) => {
    if (['concluido', 'cancelado'].includes(p.status)) falhar(409, 'Esse pedido já foi finalizado.');
    return { status: 'cancelado', canceladoEm: Date.now(), canceladoPor: por, motivoCancelamento: porque, statusAntes: p.status };
  }));
  whatsapp.avisar(pedido, 'cancelado');
  return pedido;
}

/** O motoboy sai com um ou mais pedidos prontos. */
async function sairParaEntrega(nums, motoboy) {
  if (!Array.isArray(nums) || !nums.length) falhar(400, 'Escolha os pedidos.');
  const saidos = await db.tx(async (c) => {
    const lista = [];
    for (const num of nums) {
      lista.push(await alterarPedido(c, num, (p) => {
        if (p.modo !== 'entrega' || p.status !== 'pronto') falhar(409, `O pedido #${p.num} não está mais pronto para sair (outro motoboy pode ter levado).`);
        return { status: 'rota', motoboy, saiuEm: Date.now() };
      }));
    }
    return lista;
  });
  saidos.forEach((p) => whatsapp.avisar(p, 'saiu'));
  return saidos;
}

/** Entregou e recebeu: o pedido vira concluído e o pagamento entra no caixa. */
async function concluirEntrega(num, { forma, recebido }, por) {
  const pedido = await db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, CAIXA_FECHADO);
    let pagamento;
    const p = await alterarPedido(c, num, (atual) => {
      if (atual.modo !== 'entrega' || !['rota', 'pronto'].includes(atual.status)) falhar(409, `O pedido #${atual.num} já foi finalizado.`);
      pagamento = atual.pag === 'convenio' ? { forma: 'convenio', valor: atual.total } : conferirPagamento({ forma, valor: atual.total, recebido });
      return {
        status: 'concluido', entregueEm: Date.now(), motoboy: atual.motoboy || por, pagoCom: pagamento.forma,
        recebido: pagamento.recebido ?? null, trocoDado: pagamento.troco ?? null,
      };
    });
    await registrar(c, caixa, { tipo: 'entrega', pedido: p.num, ref: `Entrega #${p.num} · ${p.cliente}`, ...pagamento, ...(pagamento.forma === 'convenio' ? { telefone: soDigitos(p.telefone) } : {}), por });
    return p;
  });
  whatsapp.avisar(pedido, 'entregue');
  return pedido;
}

/* ==========================================================================
   COMANDAS DAS MESAS
   ========================================================================== */
async function comandaAberta(c, mesa) {
  const { rows } = await c.query('SELECT * FROM comandas WHERE mesa = $1 AND aberta FOR UPDATE', [mesa]);
  return rows[0] || null;
}

/** Lança uma rodada. Se a mesa não tem comanda aberta, abre uma. */
async function lancarNaComanda(mesa, itensRecebidos, { nome = '', por = 'qr', quem = '', telefone = '', dispositivo = null } = {}) {
  const { cardapio } = loja.obter();
  const n = Number(mesa);
  if (!Number.isInteger(n) || n < 1 || n > cardapio.lanchonete.mesas) falhar(400, 'Mesa inválida.');
  if (por === 'qr' && cardapio.lanchonete.aberta === false) falhar(409, 'A loja não está recebendo pedidos agora. Chame o garçom.');
  /* Fora do horário: quem já está com a comanda aberta ainda pede; mesa nova pelo QR, não */
  if (por === 'qr' && loja.funcionamento(cardapio.lanchonete).foraDoHorario) {
    const { rows } = await db.query('SELECT 1 FROM comandas WHERE mesa = $1 AND aberta', [n]);
    if (!rows[0]) falhar(409, 'A loja está fechada agora. Chame o garçom.');
  }
  const itens = montarItens(cardapio, itensRecebidos);
  const rodada = { hora: Date.now(), por, ...(quem ? { quem } : {}), status: 'recebido', itens }; // quem: nome do garçom/atendente que lançou
  /* Pelo QR, o cliente pode deixar o celular para receber os avisos do pedido no WhatsApp */
  const tel = por === 'qr' ? soDigitos(telefone) : '';
  if (tel.length >= 10) Object.assign(rodada, { telefone: tel, nome: texto(nome, 60) });

  const tentar = () => db.tx(async (c) => {
    let linha = await comandaAberta(c, n);
    if (!linha) {
      const dados = { nome: texto(nome, 60), pessoas: 2, abertaEm: Date.now(), pediuConta: false, rodadas: [], dispositivos: [] };
      ({ rows: [linha] } = await c.query('INSERT INTO comandas (mesa, dados) VALUES ($1, $2) RETURNING *', [n, dados]));
    }
    const d = linha.dados;
    if (nome && !d.nome) d.nome = texto(nome, 60);
    if (dispositivo && !d.dispositivos.includes(dispositivo)) d.dispositivos.push(dispositivo);
    d.rodadas.push(rodada);
    const total = arred(d.rodadas.reduce((s, r) => s + somaItens(r.itens), 0));
    const { rows } = await c.query('UPDATE comandas SET dados = $2, total = $3 WHERE id = $1 RETURNING *', [linha.id, d, total]);
    return comandaDaLinha(rows[0]);
  });
  let comanda;
  try {
    comanda = await tentar();
  } catch (err) {
    if (err.code !== '23505') throw err;
    comanda = await tentar(); // duas pessoas abriram a mesma mesa no mesmo instante
  }
  avisarMesa(comanda, rodada, 'mesa_recebido', comanda.total);
  return comanda;
}

/** Quem pode mudar o quê numa rodada: o painel faz a cozinha, o garçom serve. */
const PASSOS = { recebido: 'preparo', preparo: 'pronto', pronto: 'servido' };
async function statusRodada(mesa, indice, status, perfil) {
  return db.tx(async (c) => {
    const linha = await comandaAberta(c, Number(mesa));
    if (!linha) falhar(404, `A ${mesaTexto(mesa)} não tem comanda aberta.`);
    const r = linha.dados.rodadas[Number(indice)];
    if (!r) falhar(404, 'Pedido da comanda não encontrado.');
    if (PASSOS[r.status] !== status) falhar(409, 'Esse pedido já mudou em outro aparelho. A tela vai atualizar.');
    if (perfil === 'garcom' && status !== 'servido') falhar(403, 'Quem marca em preparo e pronto é o atendente, pelo painel.');
    r.status = status;
    r[`${status}Em`] = Date.now();
    const { rows } = await c.query('UPDATE comandas SET dados = $2 WHERE id = $1 RETURNING *', [linha.id, linha.dados]);
    const comanda = comandaDaLinha(rows[0]);
    const tipo = { preparo: 'mesa_preparo', pronto: 'mesa_pronto' }[status];
    if (tipo) avisarMesa(comanda, r, tipo, comanda.total);
    return comanda;
  });
}

/**
 * Tira um item da conta da mesa (lançado errado, cliente desistiu, acabou na cozinha).
 * Só atendente e administrador, com motivo. Nada some: fica em "cancelamentos" com quem, quando e por quê.
 * Pode tirar só parte da quantidade (ex.: 1 de 3 refris). Se a mesa ficar sem nada, a comanda é encerrada sem conta.
 */
async function tirarItemComanda(mesa, rodadaI, itemI, { qtd, motivo }, por) {
  const porque = texto(motivo, 200);
  if (!porque) falhar(400, 'Escreva o motivo.');
  return db.tx(async (c) => {
    const linha = await comandaAberta(c, Number(mesa));
    if (!linha) falhar(404, `A ${mesaTexto(mesa)} não tem comanda aberta.`);
    const d = linha.dados;
    const r = d.rodadas[Number(rodadaI)];
    const item = r?.itens[Number(itemI)];
    if (!item) falhar(409, 'Esse item já mudou em outro aparelho. A tela vai atualizar.');
    const q = qtd == null ? item.qtd : parseInt(qtd, 10);
    if (!(q >= 1 && q <= item.qtd)) falhar(400, `Escolha de 1 a ${item.qtd}.`);
    (d.cancelamentos ||= []).push({ em: Date.now(), por, motivo: porque, rodada: Number(rodadaI) + 1, statusRodada: r.status, item: { ...item, qtd: q } });
    if (q === item.qtd) r.itens.splice(Number(itemI), 1); else item.qtd -= q;
    if (!r.itens.length) d.rodadas.splice(Number(rodadaI), 1);
    const total = arred(d.rodadas.reduce((s, x) => s + somaItens(x.itens), 0));
    if (!d.rodadas.length) {
      /* Mesa ficou sem nada: libera sem conta (fica guardada como cancelada, não entra em vendas) */
      d.cancelada = { em: Date.now(), por };
      await c.query('UPDATE comandas SET aberta = false, fechada_em = now(), dados = $2, total = 0 WHERE id = $1', [linha.id, d]);
      return { liberada: true };
    }
    const { rows } = await c.query('UPDATE comandas SET dados = $2, total = $3 WHERE id = $1 RETURNING *', [linha.id, d, total]);
    return comandaDaLinha(rows[0]);
  });
}

async function pedirConta(mesa, sim = true) {
  return db.tx(async (c) => {
    const linha = await comandaAberta(c, Number(mesa));
    if (!linha) falhar(404, 'Essa comanda já foi fechada.');
    linha.dados.pediuConta = !!sim;
    if (sim) linha.dados.contaPedidaEm = Date.now();
    const { rows } = await c.query('UPDATE comandas SET dados = $2 WHERE id = $1 RETURNING *', [linha.id, linha.dados]);
    return comandaDaLinha(rows[0]);
  });
}

/**
 * Fecha a conta: confere que os pagamentos cobrem o total (com ou sem os 10%),
 * a comanda vira um pedido antigo e cada pagamento entra no caixa.
 */
async function fecharComanda(mesa, { pagamentos, pessoas = 1 }, por) {
  if (!Array.isArray(pagamentos) || !pagamentos.length) falhar(400, 'Informe o pagamento.');
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, CAIXA_FECHADO);
    const linha = await comandaAberta(c, Number(mesa));
    if (!linha) falhar(404, 'Essa comanda já foi fechada.');
    /* Sem taxa de serviço: a conta é só o consumo */
    const totalFinal = arred(Number(linha.total));
    const taxa = 0;
    const conferidos = [];
    for (const p of pagamentos) {
      if (p.forma !== 'convenio') { conferidos.push(conferirPagamento(p)); continue; }
      const v = numero(p.valor);
      if (!(v > 0)) falhar(400, 'Informe o valor do convênio.');
      const conv = await conferirConvenio(c, p.telefone, v, null);
      conferidos.push({ forma: 'convenio', valor: v, telefone: conv.telefone, cliente: conv.nome });
    }
    const pago = arred(conferidos.reduce((s, p) => s + p.valor, 0));
    if (Math.abs(pago - totalFinal) > 0.02) falhar(400, `Os pagamentos somam ${pago.toFixed(2).replace('.', ',')}, mas a conta é ${totalFinal.toFixed(2).replace('.', ',')}.`);

    const { rows: [{ n }] } = await c.query("SELECT nextval('comandas_num')::int AS n");
    const forma = conferidos.length > 1 ? 'misto' : conferidos[0].forma;
    const divisao = Math.min(50, Math.max(1, parseInt(pessoas, 10) || 1)); // em quantas pessoas a conta foi dividida
    const dados = { ...linha.dados, numero: n, fechadaEm: Date.now(), forma, pagamentos: conferidos, servico: taxa, divisao, por, pediuConta: false };
    const { rows } = await c.query(
      'UPDATE comandas SET aberta = false, numero = $2, fechada_em = now(), dados = $3, total = $4 WHERE id = $1 RETURNING *',
      [linha.id, n, dados, totalFinal]);
    for (const p of conferidos) await registrar(c, caixa, { tipo: 'comanda', comanda: n, divisao, ref: `${mesaTexto(linha.mesa)} · comanda #${n}`, ...p, por });
    const fechada = comandaDaLinha(rows[0]);
    /* Agradece no WhatsApp cada pessoa da mesa que pediu pelo QR e deixou o celular (uma vez cada) */
    const vistos = new Set();
    for (const r of rows[0].dados.rodadas) {
      if (r.por !== 'qr' || !r.telefone || vistos.has(r.telefone)) continue;
      vistos.add(r.telefone);
      avisarMesa(fechada, r, 'mesa_fechada', totalFinal);
    }
    return fechada;
  });
}

/* ==========================================================================
   CLIENTES (cadastro pelo telefone)
   ========================================================================== */

/** Endereços que este aparelho pode ver (a equipe vê todos). */
const enderecosVisiveis = (cliente, dispositivo) => (dispositivo === '*'
  ? cliente.enderecos
  : cliente.enderecos.filter((e) => (e.dispositivos || []).includes(dispositivo)));

/* Endereços antigos tinham "Rua X, 120" num campo só: separa o número do fim, sem perder nada */
const limparEndereco = ({ dispositivos, ...e }) => (e.numero ? e : { ...e, ...separarNumero(e.rua) });

/** Procura o cadastro pelo celular (em qualquer aparelho): nome completo e endereços salvos. */
async function buscarCliente(telefone) {
  const tel = soDigitos(telefone);
  if (tel.length < 10) falhar(400, 'Digite o celular com DDD.');
  const { rows } = await db.query('SELECT * FROM clientes WHERE telefone = $1', [tel]);
  if (!rows[0]) return null;
  return { telefone: tel, nome: rows[0].nome, enderecos: rows[0].enderecos.map(limparEndereco), convenio: !!rows[0].convenio?.ativo };
}

function lerEndereco(e = {}) {
  const end = {
    apelido: ['Casa', 'Trabalho', 'Outro'].includes(e.apelido) ? e.apelido : (texto(e.apelido, 30) || 'Casa'),
    rua: texto(e.rua, 120), numero: texto(e.numero, 12), bairro: texto(e.bairro, 60), compl: texto(e.compl, 60), ref: texto(e.ref, 120),
  };
  if (!end.numero) Object.assign(end, separarNumero(end.rua));
  if (!end.rua || !end.numero || !end.bairro) falhar(400, 'Preencha a rua, o número e o bairro.');
  return end;
}

/**
 * Cadastra o cliente, soma um endereço ou edita um endereço salvo (enderecoId).
 * Se o telefone já existe e veio um nome, o nome é atualizado.
 */
async function salvarCliente({ telefone, nome, endereco, enderecoId }, dispositivo) {
  const tel = soDigitos(telefone);
  if (tel.length < 10) falhar(400, 'Digite o celular com DDD.');
  const end = lerEndereco(endereco);
  return db.tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM clientes WHERE telefone = $1 FOR UPDATE', [tel]);
    let cliente = rows[0];
    const n = texto(nome, 80);
    if (!cliente) {
      if (n.length < 2) falhar(400, 'Digite seu nome.');
      ({ rows: [cliente] } = await c.query('INSERT INTO clientes (telefone, nome) VALUES ($1, $2) RETURNING *', [tel, n]));
    } else if (n.length >= 2 && n !== cliente.nome) {
      await c.query('UPDATE clientes SET nome = $2 WHERE telefone = $1', [tel, n]);
      cliente.nome = n;
    }
    const lista = cliente.enderecos;
    const editando = enderecoId != null ? lista.find((e) => e.id === Number(enderecoId)) : null;
    if (enderecoId != null && !editando) falhar(404, 'Esse endereço não está mais no cadastro.');
    const igual = editando || lista.find((e) => e.rua.toLowerCase() === end.rua.toLowerCase() && e.bairro.toLowerCase() === end.bairro.toLowerCase() && (e.compl || '') === end.compl);
    let id;
    if (editando) {
      Object.assign(editando, end);
      id = editando.id;
    } else if (igual) {
      Object.assign(igual, { ...end, apelido: igual.apelido });
      if (!(igual.dispositivos ||= []).includes(dispositivo)) igual.dispositivos.push(dispositivo);
      id = igual.id;
    } else {
      id = Math.max(0, ...lista.map((e) => e.id)) + 1;
      lista.push({ ...end, id, dispositivos: [dispositivo] });
    }
    await c.query('UPDATE clientes SET enderecos = $2 WHERE telefone = $1', [tel, JSON.stringify(lista)]);
    return { telefone: tel, nome: cliente.nome, enderecos: lista.map(limparEndereco), enderecoId: id };
  });
}

/* ==========================================================================
   CONVÊNIO (o cliente compra agora e paga no fechamento)
   ========================================================================== */
/* Números do CPF (11) ou CNPJ (14). Não usa o soDigitos, que é de telefone (corta em 11). */
const digitosDoc = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 14);
const cpfValido = (cpf) => {
  const d = digitosDoc(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dig = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
};
const cnpjValido = (cnpj) => {
  const d = digitosDoc(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dig = (n) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = pesos.reduce((s, p, i) => s + Number(d[i]) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dig(12) === Number(d[12]) && dig(13) === Number(d[13]);
};
/** Documento do convênio: CPF (pessoa) ou CNPJ (empresa) */
const documentoValido = (doc) => (digitosDoc(doc).length === 14 ? cnpjValido(doc) : cpfValido(doc));

/** Tudo que o cliente comprou no convênio (pedidos e comandas) e tudo que já pagou. */
async function movimentosConvenio(c, tel) {
  const { rows: peds } = await c.query(
    `SELECT num, status, total, criado_em, dados FROM pedidos WHERE telefone = $1 AND dados->>'pag' = 'convenio' AND status <> 'cancelado' ORDER BY criado_em`, [tel]);
  const { rows: cmds } = await c.query(
    `SELECT numero, mesa, fechada_em, dados FROM comandas WHERE NOT aberta AND dados->'pagamentos' @> $1::jsonb ORDER BY fechada_em`,
    [JSON.stringify([{ forma: 'convenio', telefone: tel }])]);
  const { rows: pags } = await c.query('SELECT id, valor, forma, por, obs, em FROM convenio_pagamentos WHERE telefone = $1 ORDER BY em', [tel]);
  const compras = [
    ...peds.map((p) => ({ tipo: 'pedido', num: p.num, em: new Date(p.criado_em).getTime(), valor: Number(p.total), status: p.status,
      descricao: `${p.dados.modo === 'entrega' ? 'Entrega' : p.dados.retirada ? 'Retirada' : 'Balcão'} #${p.num}`,
      itens: (p.dados.itens || []).map((i) => `${i[1]}× ${i[5]}`) })),
    ...cmds.map((m) => ({ tipo: 'comanda', num: m.numero, em: new Date(m.fechada_em).getTime(), status: 'concluido',
      valor: arred(m.dados.pagamentos.filter((p) => p.forma === 'convenio' && p.telefone === tel).reduce((s, p) => s + p.valor, 0)),
      descricao: `${mesaTexto(m.mesa)} · comanda #${m.numero}`,
      itens: (m.dados.rodadas || []).flatMap((r) => r.itens.map((i) => `${i.qtd}× ${i.nome}`)) })),
  ].sort((a, b) => a.em - b.em);
  const pagos = pags.map((p) => ({ tipo: 'pagamento', id: p.id, em: new Date(p.em).getTime(), valor: Number(p.valor), forma: p.forma, por: p.por, obs: p.obs || '' }));
  const devido = arred(compras.reduce((s, x) => s + x.valor, 0) - pagos.reduce((s, x) => s + x.valor, 0));
  return { compras, pagos, devido };
}

/** Confere se o cliente pode comprar no convênio: ativo, CPF certo (pelo cardápio) e dentro do limite. */
async function conferirConvenio(c, telefone, valor, cpf) {
  const tel = soDigitos(telefone);
  const { rows: [cli] } = await c.query('SELECT telefone, nome, convenio FROM clientes WHERE telefone = $1', [tel]);
  const conv = cli?.convenio;
  if (!conv?.ativo) falhar(403, 'Esse cliente não tem convênio com a loja.');
  if (cpf !== null && (!digitosDoc(cpf) || digitosDoc(cpf) !== conv.cpf)) falhar(403, 'O CPF ou CNPJ não confere com o cadastro do convênio.');
  if (conv.limite > 0) {
    const { devido } = await movimentosConvenio(c, tel);
    if (devido + valor > conv.limite + 0.005) falhar(409, `Passa do limite do convênio (${conv.limite.toFixed(2).replace('.', ',')}). Em aberto: ${devido.toFixed(2).replace('.', ',')}.`);
  }
  return { ...conv, telefone: tel, nome: cli.nome };
}

/** Liga, muda ou desliga o convênio de um cliente (só o administrador) */
async function definirConvenio(telefone, { ativo, cpf, limite, diaFechamento, empresa, nome, manterCpf }, por) {
  const tel = soDigitos(telefone);
  if (tel.length < 10) falhar(400, 'Digite o celular com DDD.');
  return db.tx(async (c) => {
    let { rows: [cli] } = await c.query('SELECT * FROM clientes WHERE telefone = $1 FOR UPDATE', [tel]);
    if (!cli) {
      const n = texto(nome, 80);
      if (n.length < 2) falhar(400, 'Digite o nome do cliente.');
      ({ rows: [cli] } = await c.query('INSERT INTO clientes (telefone, nome) VALUES ($1, $2) RETURNING *', [tel, n]));
    }
    const atual = cli.convenio || {};
    if (!ativo) {
      await c.query('UPDATE clientes SET convenio = $2 WHERE telefone = $1', [tel, { ...atual, ativo: false, desligadoEm: Date.now(), desligadoPor: por }]);
      return { telefone: tel, ativo: false };
    }
    /* Editando sem digitar o CPF de novo: fica o que já estava */
    const doc = manterCpf && !digitosDoc(cpf) && atual.cpf ? atual.cpf : digitosDoc(cpf);
    if (!documentoValido(doc)) falhar(400, doc.length === 14 ? 'CNPJ inválido. Confira os números.' : 'CPF inválido. Confira os números.');
    const dia = parseInt(diaFechamento, 10);
    const conv = {
      ...atual, ativo: true, cpf: doc, empresa: texto(empresa, 80),
      limite: Math.max(0, numero(limite) || 0), diaFechamento: dia >= 1 && dia <= 28 ? dia : 1,
      desde: atual.desde || Date.now(), por,
    };
    await c.query('UPDATE clientes SET convenio = $2 WHERE telefone = $1', [tel, conv]);
    return { telefone: tel, ativo: true };
  });
}

/** Conveniados com o que devem (para a página Convênios) */
async function listarConvenios() {
  const { rows } = await db.query("SELECT telefone, nome, convenio FROM clientes WHERE convenio IS NOT NULL ORDER BY nome");
  const lista = [];
  for (const r of rows) {
    const m = await movimentosConvenio(db, r.telefone);
    const ultima = m.compras[m.compras.length - 1];
    const { cpf, ...conv } = r.convenio;
    lista.push({ telefone: r.telefone, nome: r.nome, ...conv, cpfFinal: !cpf ? '' : cpf.length === 14 ? `**.${cpf.slice(2, 5)}.${cpf.slice(5, 8)}/****-**` : `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`, tipoDoc: cpf?.length === 14 ? 'CNPJ' : 'CPF', devido: m.devido, compras: m.compras.length, ultimaCompra: ultima?.em || null });
  }
  return lista;
}

/** Extrato completo de um conveniado */
async function extratoConvenio(telefone) {
  const tel = soDigitos(telefone);
  const { rows: [cli] } = await db.query('SELECT telefone, nome, convenio FROM clientes WHERE telefone = $1', [tel]);
  if (!cli?.convenio) falhar(404, 'Esse cliente não tem convênio.');
  const { cpf, ...conv } = cli.convenio;
  return { telefone: tel, nome: cli.nome, ...conv, ...(await movimentosConvenio(db, tel)) };
}

/** Recebe o pagamento do convênio: baixa o que ele deve e o dinheiro entra no caixa aberto */
async function receberConvenio(telefone, { valor, forma, recebido, obs }, por) {
  const tel = soDigitos(telefone);
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, CAIXA_FECHADO);
    const { rows: [cli] } = await c.query('SELECT nome, convenio FROM clientes WHERE telefone = $1 FOR UPDATE', [tel]);
    if (!cli?.convenio) falhar(404, 'Esse cliente não tem convênio.');
    const { devido } = await movimentosConvenio(c, tel);
    const pagamento = conferirPagamento({ forma, valor, recebido });
    if (pagamento.valor > devido + 0.005) falhar(400, `O cliente deve ${devido.toFixed(2).replace('.', ',')}. Não dá para receber mais que isso.`);
    await c.query('INSERT INTO convenio_pagamentos (telefone, valor, forma, por, obs) VALUES ($1, $2, $3, $4, $5)', [tel, pagamento.valor, pagamento.forma, por, texto(obs, 200)]);
    await registrar(c, caixa, { tipo: 'convenio', telefone: tel, ref: `Convênio · ${cli.nome}`, ...pagamento, por });
    return { devido: arred(devido - pagamento.valor), ...pagamento };
  });
}

/**
 * Tira um pedido do convênio (pedido de teste ou lançado errado): o pedido fica cancelado,
 * sai do que o cliente deve e, se a venda estava no caixa aberto, sai do caixa. Fica registrado.
 */
async function estornarConvenio(telefone, { num, motivo }, por) {
  const tel = soDigitos(telefone);
  if (!texto(motivo)) falhar(400, 'Escreva o motivo.');
  return db.tx(async (c) => {
    const { rows: [p] } = await c.query('SELECT * FROM pedidos WHERE num = $1 FOR UPDATE', [Number(num)]);
    if (!p || p.telefone !== tel || p.dados.pag !== 'convenio') falhar(404, 'Esse pedido não está no convênio deste cliente.');
    if (p.status === 'cancelado') falhar(409, 'Esse pedido já foi tirado.');
    const dados = { ...p.dados, statusAntes: p.status, canceladoEm: Date.now(), canceladoPor: por, estornoConvenio: { em: Date.now(), por, motivo: texto(motivo, 200) } };
    await c.query("UPDATE pedidos SET status = 'cancelado', dados = $2, atualizado_em = now() WHERE num = $1", [p.num, dados]);
    const caixa = await caixaAberto(c, true);
    if (caixa) {
      const i = caixa.dados.movimentos.findIndex((m) => m.pedido === p.num && m.forma === 'convenio');
      if (i >= 0) {
        const [m] = caixa.dados.movimentos.splice(i, 1);
        (caixa.dados.estornos ||= []).push({ ...m, estornadoEm: Date.now(), estornadoPor: por, motivo: texto(motivo, 200) });
        await c.query('UPDATE caixas SET dados = $2 WHERE id = $1', [caixa.id, caixa.dados]);
      }
    }
    return { num: p.num, ...(await movimentosConvenio(c, tel)) };
  });
}

/** Manda o extrato para o cliente no WhatsApp da loja */
/* Evita mandar o mesmo extrato várias vezes seguidas (duplo clique, dois aparelhos): o WhatsApp pode bloquear por spam */
const ultimoExtrato = new Map();
const ESPERA_EXTRATO = 60 * 1000;
async function enviarExtratoConvenio(telefone, textoExtrato) {
  const tel = soDigitos(telefone);
  if (!texto(textoExtrato, 4000)) falhar(400, 'Extrato vazio.');
  const desde = Date.now() - (ultimoExtrato.get(tel) || 0);
  if (desde < ESPERA_EXTRATO) falhar(429, `O extrato já foi enviado para esse cliente agora há pouco. Espere ${Math.ceil((ESPERA_EXTRATO - desde) / 1000)} segundos para mandar de novo.`);
  ultimoExtrato.set(tel, Date.now());
  try {
    await whatsapp.enviarTexto(tel, String(textoExtrato).slice(0, 4000));
  } catch (err) {
    ultimoExtrato.delete(tel); // não foi: pode tentar de novo na hora
    throw err;
  }
}

module.exports = {
  definirConvenio, listarConvenios, extratoConvenio, receberConvenio, enviarExtratoConvenio, estornarConvenio,
  mesaTexto, pedidoDaLinha, comandaDaLinha,
  abrirCaixa, movimentoCaixa, corrigirMovimento, redividirComanda, fecharCaixa, trocoBolsa, fecharBolsa,
  criarPedido, avancarPedido, cancelarPedido, sairParaEntrega, concluirEntrega,
  lancarNaComanda, statusRodada, pedirConta, fecharComanda, tirarItemComanda,
  buscarCliente, salvarCliente,
};
