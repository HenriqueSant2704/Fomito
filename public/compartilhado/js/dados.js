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
