// Regras de negócio que precisam valer no servidor (o navegador não decide preço nem caixa).
const { falhar, arred, numero, texto } = require('./util');

/**
 * Adicionais que o cliente pode escolher num produto: os da categoria (menos os que o dono
 * desmarcou neste produto) e os avulsos ligados só a ele. Igual ao Fomito.adicionaisDo do navegador.
 */
function adicionaisDo(cardapio, p) {
  const fora = p.adicionaisFora || [];
  const daCategoria = (cardapio.adicionais[p.cat] || []).filter((a) => !fora.includes(a.id));
  const avulsos = (cardapio.avulsos || []).filter((a) => (p.avulsos || []).includes(a.id) && !daCategoria.some((x) => x.id === a.id));
  return [...daCategoria, ...avulsos];
}

/**
 * Monta um item com o preço do cardápio de agora (o que o cliente mandou só diz o quê e quanto).
 * Guarda o nome e o preço no item: se o produto mudar depois, o pedido antigo continua certo.
 */
function montarItem(cardapio, { id, qtd, extras = [], obs = '', sem = [] }) {
  const p = cardapio.produtos.find((x) => x.id === Number(id));
  if (!p) falhar(400, 'Um dos produtos não está mais no cardápio. Atualize a página.');
  if (p.esgotado) falhar(409, `${p.nome} acabou de esgotar. Tire da sacola para continuar.`);
  const q = Number(qtd);
  if (!Number.isInteger(q) || q < 1 || q > 99) falhar(400, 'Quantidade inválida.');
  const opcoes = adicionaisDo(cardapio, p);
  const escolhidos = (Array.isArray(extras) ? extras : []).filter((e) => opcoes.some((a) => a.id === e));
  const preco = arred(p.preco + opcoes.filter((a) => escolhidos.includes(a.id)).reduce((s, a) => s + a.preco, 0));
  /* Ingredientes que o cliente tirou: viram "SEM alface" na observação, que já aparece
     no painel, no garçom, na notinha da cozinha e no acompanhamento */
  const tirados = (Array.isArray(sem) ? sem : []).filter((x) => (p.ingredientes || []).includes(x));
  const obsFinal = [tirados.map((x) => `SEM ${x.toLowerCase()}`).join(', '), texto(obs, 140)].filter(Boolean).join(' · ');
  return { id: p.id, qtd: q, extras: escolhidos, obs: obsFinal, ...(tirados.length ? { sem: tirados } : {}), preco, nome: p.nome };
}

function montarItens(cardapio, itens) {
  if (!Array.isArray(itens) || !itens.length) falhar(400, 'Escolha pelo menos um item.');
  if (itens.length > 60) falhar(400, 'Pedido grande demais. Fale com a loja.');
  return itens.map((i) => montarItem(cardapio, i));
}

const somaItens = (itens) => arred(itens.reduce((s, i) => s + i.preco * i.qtd, 0));

/* ---------- Caixa ---------- */
const VENDAS = ['comanda', 'entrega', 'balcao'];

/** Mesma conta do protótipo: o que deveria ter na gaveta. */
/**
 * Bolsa de cada motoboy, separada da gaveta do balcão:
 * troco inicial + dinheiro das entregas dele (o cliente deu − o troco devolvido).
 */
function bolsasMotoboys(caixa) {
  const bolsas = {};
  const bolsa = (nome) => (bolsas[nome] ||= { fundo: 0, recebido: 0, troco: 0, dinheiro: 0, entregas: 0 });
  for (const [nome, b] of Object.entries(caixa.motoboys || {})) Object.assign(bolsa(nome), { fundo: b.fundo || 0, fechamento: b.fechamento || null });
  for (const m of caixa.movimentos) {
    if (m.tipo !== 'entrega') continue;
    const b = bolsa(m.por);
    b.entregas++;
    if (m.forma === 'dinheiro') { b.dinheiro += m.valor; b.recebido += m.recebido ?? m.valor; b.troco += m.troco || 0; }
  }
  for (const b of Object.values(bolsas)) b.esperado = arred(b.fundo + b.dinheiro);
  return bolsas;
}

function resumoCaixa(caixa) {
  const r = { vendas: 0, porForma: { dinheiro: 0, pix: 0, credito: 0, debito: 0 }, recebidoDinheiro: 0, troco: 0, sangrias: 0, suprimentos: 0, qtdVendas: 0 };
  for (const m of caixa.movimentos) {
    if (VENDAS.includes(m.tipo)) {
      r.vendas += m.valor;
      r.qtdVendas++;
      r.porForma[m.forma] = (r.porForma[m.forma] || 0) + m.valor;
      r.troco += m.troco || 0;
      if (m.forma === 'dinheiro') r.recebidoDinheiro += m.recebido ?? m.valor;
    }
    if (m.tipo === 'sangria') r.sangrias += m.valor;
    if (m.tipo === 'suprimento') r.suprimentos += m.valor;
  }
  /* Gaveta do balcão: o dinheiro das entregas fica na bolsa do motoboy, não aqui */
  const dinheiroEntregas = caixa.movimentos.filter((m) => m.tipo === 'entrega' && m.forma === 'dinheiro').reduce((s, m) => s + m.valor, 0);
  r.dinheiroEntregas = arred(dinheiroEntregas);
  r.esperado = arred(caixa.fundo + r.porForma.dinheiro - dinheiroEntregas - r.sangrias + r.suprimentos);
  r.bolsas = bolsasMotoboys(caixa);
  r.vendas = arred(r.vendas);
  return r;
}

const FORMAS = ['dinheiro', 'pix', 'credito', 'debito'];

/**
 * Confere um pagamento: forma válida, valor positivo e, no dinheiro,
 * quanto o cliente deu (obrigatório) e o troco calculado aqui.
 */
function conferirPagamento({ forma, valor, recebido }) {
  if (!FORMAS.includes(forma)) falhar(400, 'Forma de pagamento inválida.');
  const v = numero(valor);
  if (!(v > 0)) falhar(400, 'Informe o valor do pagamento.');
  if (forma !== 'dinheiro') return { forma, valor: v };
  const deu = numero(recebido);
  if (!(deu >= v)) falhar(400, 'No dinheiro, informe quanto o cliente deu (precisa cobrir o valor).');
  return { forma, valor: v, recebido: deu, troco: arred(deu - v) };
}

module.exports = { adicionaisDo, bolsasMotoboys, montarItem, montarItens, somaItens, resumoCaixa, conferirPagamento, FORMAS, VENDAS };
