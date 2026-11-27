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
   • os da categoria dele (menos os que o dono desmarcou neste produto: "adicionaisFora")
   • os avulsos que o dono ligou só a este produto ("avulsos": ids da lista dados.avulsos)
   adicionaisDo → o que o cliente pode escolher agora
   todosAdicionaisDo → para mostrar nomes e preços de itens já pedidos */
Fomito.adicionaisDo = (prod) => {
  if (!prod) return [];
  const d = Fomito.dados;
  const fora = prod.adicionaisFora || [];
  const daCategoria = (d.adicionais[prod.cat] || []).filter((a) => !fora.includes(a.id));
  const avulsos = (d.avulsos || []).filter((a) => (prod.avulsos || []).includes(a.id) && !daCategoria.some((x) => x.id === a.id));
  return [...daCategoria, ...avulsos];
};
Fomito.todosAdicionaisDo = (prod) => {
  if (!prod) return [];
  const daCategoria = Fomito.dados.adicionais[prod.cat] || [];
  return [...daCategoria, ...(Fomito.dados.avulsos || []).filter((a) => !daCategoria.some((x) => x.id === a.id))];
};
