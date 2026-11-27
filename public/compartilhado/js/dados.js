/* ==========================================================================
   FOMITO · CARDÁPIO
   --------------------------------------------------------------------------
   O cardápio (loja, categorias, adicionais, produtos e formas de pagamento)
   vem do servidor, em Fomito.estado.cardapio. O dono muda pelo painel.
   As "fotos" iniciais são ilustrações (ilustracoes.js); as fotos enviadas
   pelo painel ficam no banco e aparecem como { src: "/img/12" }.
   ========================================================================== */

window.Fomito = window.Fomito || {};

Fomito.dados = Fomito.estado.cardapio;

/* Atalho: busca um produto pelo id. Produto removido do cardápio continua
   aparecendo nos pedidos antigos com o nome guardado no próprio pedido. */
Fomito.produto = (id) => Fomito.dados.produtos.find((p) => p.id === Number(id))
  || { id: Number(id), nome: "Item fora do cardápio", preco: 0, cat: "", desc: "", ingredientes: [], fotos: [], esgotado: true };

/* Formas de pagamento que a loja aceita (o dono liga e desliga nas Configurações) */
Fomito.formasAtivas = () => Fomito.dados.formasPagamento.filter((f) => f.ativa !== false);

/** Grava o cardápio inteiro no servidor (produtos, categorias, adicionais, vitrine e loja). */
Fomito.salvarCardapio = () => Fomito.acao("PUT", "/cardapio", Fomito.dados)
  .catch((err) => { Fomito.estado.versao = null; Fomito.sincronizar().catch(() => {}); throw err; }); // se falhar, volta ao que está salvo

/* ---------- Adicionais de um produto ----------
   Os da categoria dele, menos os que o dono desmarcou neste produto ("adicionaisFora").
   adicionaisDo → o que o cliente pode escolher agora
   todosAdicionaisDo → para mostrar nomes e preços de itens já pedidos */
Fomito.adicionaisDo = (prod) => {
  if (!prod) return [];
  const fora = prod.adicionaisFora || [];
  return (Fomito.dados.adicionais[prod.cat] || []).filter((a) => !fora.includes(a.id));
};
Fomito.todosAdicionaisDo = (prod) => (prod ? Fomito.dados.adicionais[prod.cat] || [] : []);

/* Forma de pagamento pelo id. "convenio" não fica na lista da loja: só aparece para cliente conveniado. */
Fomito.FORMA_CONVENIO = { id: "convenio", nome: "Convênio", icone: "conta", sub: "Fica na sua conta do convênio, você paga no fechamento" };
Fomito.formaPag = (id) => (id === "convenio" ? Fomito.FORMA_CONVENIO : (Fomito.dados.formasPagamento || []).find((f) => f.id === id));
