// Regras de negócio que precisam valer no servidor (o navegador não decide preço nem caixa).
const { falhar, arred, numero, texto } = require('./util');

/**
 * Monta um item com o preço do cardápio de agora (o que o cliente mandou só diz o quê e quanto).
 * Guarda o nome e o preço no item: se o produto mudar depois, o pedido antigo continua certo.
 */
function montarItem(cardapio, { id, qtd, extras = [], obs = '' }) {
  const p = cardapio.produtos.find((x) => x.id === Number(id));
  if (!p) falhar(400, 'Um dos produtos não está mais no cardápio. Atualize a página.');
  if (p.esgotado) falhar(409, `${p.nome} acabou de esgotar. Tire da sacola para continuar.`);
  const q = Number(qtd);
  if (!Number.isInteger(q) || q < 1 || q > 99) falhar(400, 'Quantidade inválida.');
  const opcoes = cardapio.adicionais[p.cat] || [];
  const escolhidos = (Array.isArray(extras) ? extras : []).filter((e) => opcoes.some((a) => a.id === e));
  const preco = arred(p.preco + opcoes.filter((a) => escolhidos.includes(a.id)).reduce((s, a) => s + a.preco, 0));
  return { id: p.id, qtd: q, extras: escolhidos, obs: texto(obs, 140), preco, nome: p.nome };
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
  r.esperado = arred(caixa.fundo + r.porForma.dinheiro - r.sangrias + r.suprimentos);
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

module.exports = { montarItem, montarItens, somaItens, resumoCaixa, conferirPagamento, FORMAS, VENDAS };
