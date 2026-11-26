// Pedidos, comandas das mesas e caixa: tudo que muda dados importantes passa por aqui,
// sempre numa transação, para dois aparelhos ao mesmo tempo não baterem um no outro.
const db = require('./db');
const loja = require('./loja');
const whatsapp = require('./whatsapp');
const { falhar, arred, numero, texto, soDigitos, formatarTelefone } = require('./util');
const { montarItens, somaItens, resumoCaixa, conferirPagamento } = require('./regras');

const mesaTexto = (n) => `Mesa ${String(n).padStart(2, '0')}`;

/* ==========================================================================
   Formatos que as telas usam
   ========================================================================== */
const pedidoDaLinha = (r) => ({ ...r.dados, num: r.num, status: r.status, total: Number(r.total) });

function comandaDaLinha(r) {
  const { dispositivos, ...dados } = r.dados;
  return { ...dados, mesa: r.mesa, numero: r.numero || undefined, total: Number(r.total) };
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

async function abrirCaixa({ fundo }, por) {
  const valor = numero(fundo);
  if (!(valor >= 0)) falhar(400, 'Informe o dinheiro inicial (pode ser R$ 0,00).');
  return db.tx(async (c) => {
    if (await caixaAberto(c, true)) falhar(409, 'Já existe um caixa aberto.');
    const dados = { abertoEm: Date.now(), por, fundo: valor, movimentos: [] };
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
const CAMPOS = ['forma', 'valor', 'recebido', 'troco', 'ref'];
async function corrigirMovimento(id, novo, { motivo }, por) {
  if (!texto(motivo)) falhar(400, 'Escreva o motivo da correção.');
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, 'Só dá para corrigir com o caixa aberto.');
    const m = caixa.dados.movimentos.find((x) => x.id === id);
    if (!m) falhar(404, 'Esse movimento não está no caixa aberto.');
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

    /* Entrega: o pedido também passa a mostrar a forma certa (e o acerto do motoboy) */
    if (m.tipo === 'entrega' && m.pedido) {
      await c.query(`UPDATE pedidos SET dados = dados || $2::jsonb, atualizado_em = now() WHERE num = $1`,
        [m.pedido, { pagoCom: m.forma, recebido: m.recebido ?? null, trocoDado: m.troco ?? null }]);
    }
    return { ...m };
  });
}

async function fecharCaixa({ contado, obs }, por) {
  const v = numero(contado);
  if (!(v >= 0)) falhar(400, 'Informe quanto dinheiro tem na gaveta.');
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, 'Não há caixa aberto.');
    const r = resumoCaixa(caixa.dados);
    if (Math.abs(v - r.esperado) >= 0.005 && !texto(obs)) falhar(400, 'O valor não bateu: escreva uma observação.');
    const correcoes = caixa.dados.movimentos.reduce((s, m) => s + (m.correcoes?.length || 0), 0);
    const fechamento = {
      ...caixa.dados, fechadoEm: Date.now(), fechadoPor: por, vendas: r.vendas, dinheiro: r.porForma.dinheiro,
      esperado: r.esperado, contado: v, obs: texto(obs, 300), porForma: r.porForma, correcoes,
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
  if (!equipe && cardapio.lanchonete.aberta === false) falhar(409, 'A loja não está recebendo pedidos agora.');
  /* "local" = balcão: lançado pelo painel ou "Retirar no balcão" no cardápio */
  const retirada = corpo.modo === 'retirada';
  const modo = (equipe && corpo.modo === 'local') || retirada ? 'local' : 'entrega';
  const itens = montarItens(cardapio, (corpo.itens || []).map((i) => (Array.isArray(i) ? { id: i[0], qtd: i[1], extras: i[2], obs: i[3] } : i)));
  const subtotal = somaItens(itens);
  const taxa = modo === 'entrega' ? cardapio.lanchonete.taxaEntrega : 0;
  const total = arred(subtotal + taxa);

  const dados = { modo, criadoEm: Date.now(), itens: itens.map((i) => [i.id, i.qtd, i.extras, i.obs, i.preco, i.nome]), taxa };
  if (modo === 'entrega') {
    const tel = soDigitos(corpo.telefone);
    if (tel.length < 10) falhar(400, 'Informe o celular com DDD.');
    const formas = cardapio.formasPagamento.filter((f) => f.ativa !== false).map((f) => f.id);
    if (!formas.includes(corpo.pag)) falhar(400, 'Escolha a forma de pagamento.');
    const troco = corpo.pag === 'dinheiro' && corpo.troco ? numero(corpo.troco) : null;
    if (troco !== null && !(troco >= total)) falhar(400, 'O troco precisa ser para um valor maior que o total.');
    Object.assign(dados, {
      cliente: texto(corpo.cliente, 80), telefone: formatarTelefone(tel),
      rua: texto(corpo.rua, 120), compl: texto(corpo.compl, 60), bairro: texto(corpo.bairro, 60), ref: texto(corpo.ref, 120),
      pag: corpo.pag, troco,
    });
    if (!dados.cliente || !dados.rua || !dados.bairro) falhar(400, 'Preencha o nome, a rua e o bairro.');
  } else if (retirada) {
    const tel = soDigitos(corpo.telefone);
    if (tel.length < 10) falhar(400, 'Informe o celular com DDD.');
    const formas = cardapio.formasPagamento.filter((f) => f.ativa !== false).map((f) => f.id);
    if (!formas.includes(corpo.pag)) falhar(400, 'Escolha a forma de pagamento.');
    const troco = corpo.pag === 'dinheiro' && corpo.troco ? numero(corpo.troco) : null;
    if (troco !== null && !(troco >= total)) falhar(400, 'O troco precisa ser para um valor maior que o total.');
    Object.assign(dados, { cliente: texto(corpo.cliente, 80), telefone: formatarTelefone(tel), retirada: true, pag: corpo.pag, troco });
    if (dados.cliente.length < 2) falhar(400, 'Digite seu nome.');
  } else {
    Object.assign(dados, { cliente: texto(corpo.cliente, 80) || 'Balcão · Retirada', pag: null });
  }

  const { rows } = await db.query(
    `INSERT INTO pedidos (modo, status, telefone, dispositivo, dados, total) VALUES ($1, 'novo', $2, $3, $4, $5) RETURNING *`,
    [modo, soDigitos(dados.telefone) || null, dispositivo, dados, total]);
  const pedido = pedidoDaLinha(rows[0]);
  if (modo === 'entrega') whatsapp.avisar(pedido, 'recebido');
  return pedido;
}

/** Muda o pedido dentro de uma transação, com ele travado. */
async function alterarPedido(c, num, fn) {
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
async function avancarPedido(num) {
  const pedido = await db.tx((c) => alterarPedido(c, num, (p) => {
    if (p.status === 'novo') return { status: 'preparo', aceitoEm: Date.now() };
    if (p.status === 'preparo') return { status: 'pronto', prontoEm: Date.now() };
    if (p.status === 'pronto' && p.modo === 'local') return { status: 'concluido', entregueEm: Date.now() };
    falhar(409, `O pedido #${p.num} já mudou em outro aparelho. A tela vai atualizar.`);
  }));
  if (pedido.modo === 'entrega' && pedido.status === 'preparo') whatsapp.avisar(pedido, 'preparo');
  return pedido;
}

async function cancelarPedido(num, por) {
  return db.tx((c) => alterarPedido(c, num, (p) => {
    if (['concluido', 'cancelado'].includes(p.status)) falhar(409, 'Esse pedido já foi finalizado.');
    return { status: 'cancelado', canceladoEm: Date.now(), canceladoPor: por, statusAntes: p.status };
  }));
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
      pagamento = conferirPagamento({ forma, valor: atual.total, recebido });
      return {
        status: 'concluido', entregueEm: Date.now(), motoboy: atual.motoboy || por, pagoCom: pagamento.forma,
        recebido: pagamento.recebido ?? null, trocoDado: pagamento.troco ?? null,
      };
    });
    await registrar(c, caixa, { tipo: 'entrega', pedido: p.num, ref: `Entrega #${p.num} · ${p.cliente}`, ...pagamento, por });
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
async function lancarNaComanda(mesa, itensRecebidos, { nome = '', por = 'qr', quem = '', dispositivo = null } = {}) {
  const { cardapio } = loja.obter();
  const n = Number(mesa);
  if (!Number.isInteger(n) || n < 1 || n > cardapio.lanchonete.mesas) falhar(400, 'Mesa inválida.');
  if (por === 'qr' && cardapio.lanchonete.aberta === false) falhar(409, 'A loja não está recebendo pedidos agora. Chame o garçom.');
  const itens = montarItens(cardapio, itensRecebidos);
  const rodada = { hora: Date.now(), por, ...(quem ? { quem } : {}), status: 'recebido', itens }; // quem: nome do garçom/atendente que lançou

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
  try {
    return await tentar();
  } catch (err) {
    if (err.code === '23505') return tentar(); // duas pessoas abriram a mesma mesa no mesmo instante
    throw err;
  }
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
async function fecharComanda(mesa, { pagamentos, servico = 0 }, por) {
  if (!Array.isArray(pagamentos) || !pagamentos.length) falhar(400, 'Informe o pagamento.');
  return db.tx(async (c) => {
    const caixa = await caixaAberto(c, true);
    if (!caixa) falhar(409, CAIXA_FECHADO);
    const linha = await comandaAberta(c, Number(mesa));
    if (!linha) falhar(404, 'Essa comanda já foi fechada.');
    const base = Number(linha.total);
    const taxa = numero(servico) || 0;
    if (taxa < 0 || taxa > arred(base * 0.2) + 0.01) falhar(400, 'Taxa de serviço inválida.');
    const totalFinal = arred(base + taxa);
    const conferidos = pagamentos.map(conferirPagamento);
    const pago = arred(conferidos.reduce((s, p) => s + p.valor, 0));
    if (Math.abs(pago - totalFinal) > 0.02) falhar(400, `Os pagamentos somam ${pago.toFixed(2).replace('.', ',')}, mas a conta é ${totalFinal.toFixed(2).replace('.', ',')}.`);

    const { rows: [{ n }] } = await c.query("SELECT nextval('comandas_num')::int AS n");
    const forma = conferidos.length > 1 ? 'misto' : conferidos[0].forma;
    const dados = { ...linha.dados, numero: n, fechadaEm: Date.now(), forma, pagamentos: conferidos, servico: taxa, por, pediuConta: false };
    const { rows } = await c.query(
      'UPDATE comandas SET aberta = false, numero = $2, fechada_em = now(), dados = $3, total = $4 WHERE id = $1 RETURNING *',
      [linha.id, n, dados, totalFinal]);
    for (const p of conferidos) await registrar(c, caixa, { tipo: 'comanda', ref: `${mesaTexto(linha.mesa)} · comanda #${n}`, ...p, por });
    return comandaDaLinha(rows[0]);
  });
}

/* ==========================================================================
   CLIENTES (cadastro pelo telefone)
   ========================================================================== */

/** Endereços que este aparelho pode ver (a equipe vê todos). */
const enderecosVisiveis = (cliente, dispositivo) => (dispositivo === '*'
  ? cliente.enderecos
  : cliente.enderecos.filter((e) => (e.dispositivos || []).includes(dispositivo)));

const limparEndereco = ({ dispositivos, ...e }) => e;

async function buscarCliente(telefone, dispositivo) {
  const tel = soDigitos(telefone);
  if (tel.length < 10) falhar(400, 'Digite o celular com DDD.');
  const { rows } = await db.query('SELECT * FROM clientes WHERE telefone = $1', [tel]);
  if (!rows[0]) return null;
  const enderecos = enderecosVisiveis(rows[0], dispositivo);
  if (!enderecos.length) return null; // aparelho novo: cadastra de novo, sem ver os dados de ninguém
  return { telefone: tel, nome: rows[0].nome, enderecos: enderecos.map(limparEndereco) };
}

function lerEndereco(e = {}) {
  const end = {
    apelido: ['Casa', 'Trabalho', 'Outro'].includes(e.apelido) ? e.apelido : (texto(e.apelido, 30) || 'Casa'),
    rua: texto(e.rua, 120), bairro: texto(e.bairro, 60), compl: texto(e.compl, 60), ref: texto(e.ref, 120),
  };
  if (!end.rua || !end.bairro) falhar(400, 'Preencha a rua com número e o bairro.');
  return end;
}

/** Cadastra o cliente ou soma um endereço (se o telefone já existe). Retorna o que este aparelho vê. */
async function salvarCliente({ telefone, nome, endereco }, dispositivo) {
  const tel = soDigitos(telefone);
  if (tel.length < 10) falhar(400, 'Digite o celular com DDD.');
  const end = lerEndereco(endereco);
  return db.tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM clientes WHERE telefone = $1 FOR UPDATE', [tel]);
    let cliente = rows[0];
    if (!cliente) {
      const n = texto(nome, 80);
      if (n.length < 2) falhar(400, 'Digite seu nome.');
      ({ rows: [cliente] } = await c.query('INSERT INTO clientes (telefone, nome) VALUES ($1, $2) RETURNING *', [tel, n]));
    }
    const lista = cliente.enderecos;
    const igual = lista.find((e) => e.rua.toLowerCase() === end.rua.toLowerCase() && e.bairro.toLowerCase() === end.bairro.toLowerCase() && (e.compl || '') === end.compl);
    let id;
    if (igual) {
      Object.assign(igual, { ...end, apelido: igual.apelido });
      if (!(igual.dispositivos ||= []).includes(dispositivo)) igual.dispositivos.push(dispositivo);
      id = igual.id;
    } else {
      id = Math.max(0, ...lista.map((e) => e.id)) + 1;
      lista.push({ ...end, id, dispositivos: [dispositivo] });
    }
    await c.query('UPDATE clientes SET enderecos = $2 WHERE telefone = $1', [tel, JSON.stringify(lista)]);
    const visiveis = enderecosVisiveis({ enderecos: lista }, dispositivo);
    return { telefone: tel, nome: cliente.nome, enderecos: visiveis.map(limparEndereco), enderecoId: id };
  });
}

module.exports = {
  mesaTexto, pedidoDaLinha, comandaDaLinha,
  abrirCaixa, movimentoCaixa, corrigirMovimento, fecharCaixa,
  criarPedido, avancarPedido, cancelarPedido, sairParaEntrega, concluirEntrega,
  lancarNaComanda, statusRodada, pedirConta, fecharComanda,
  buscarCliente, salvarCliente,
};
