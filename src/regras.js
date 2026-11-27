// Regras de negócio que precisam valer no servidor (o navegador não decide preço nem caixa).
const { falhar, arred, numero, texto } = require('./util');

/**
 * Adicionais que o cliente pode escolher num produto: os da categoria, menos os que o dono
 * desmarcou neste produto. Igual ao Fomito.adicionaisDo do navegador.
 */
function adicionaisDo(cardapio, p) {
  const fora = p.adicionaisFora || [];
  return (cardapio.adicionais[p.cat] || []).filter((a) => !fora.includes(a.id));
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

/* A conta do caixa (gaveta, maquininha e bolsas de motoboys e garçons) fica num arquivo só,
   usado aqui e no painel: public/compartilhado/js/contas-caixa.js */
const contasCaixa = require('../public/compartilhado/js/contas-caixa.js');
const resumoCaixa = (caixa) => contasCaixa.resumo(caixa);
/** Bolsas de um tipo: 'motoboy' (padrão) ou 'garcom' */
const bolsasDe = (caixa, tipo = 'motoboy') => { const r = contasCaixa.resumo(caixa); return tipo === 'garcom' ? r.bolsasGarcons : r.bolsas; };
const bolsasMotoboys = (caixa) => bolsasDe(caixa, 'motoboy');

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

module.exports = { adicionaisDo, bolsasMotoboys, bolsasDe, montarItem, montarItens, somaItens, resumoCaixa, conferirPagamento, FORMAS, VENDAS };
