/* ==========================================================================
   FOMITO · FUNÇÕES UTILITÁRIAS
   Pequenas funções usadas por todas as telas. Depende de icones.js e ilustracoes.js.
   ========================================================================== */

window.Fomito = window.Fomito || {};

/* Formata número como moeda: 24.9 -> "R$ 24,90" */
Fomito.moeda = (valor) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* Atalhos para selecionar elementos */
Fomito.$ = (seletor, raiz = document) => raiz.querySelector(seletor);
Fomito.$$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/* Mostra uma mensagem rápida no rodapé da tela */
Fomito.toast = (mensagem, icone = "check") => {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `${Fomito.icone(icone, "ic--sm")}${mensagem}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
};

/* HTML do logo (símbolo + nome) para reaproveitar em qualquer tela */
Fomito.logo = (claro = false, base = "../compartilhado") => `
  <span class="logo ${claro ? "logo--claro" : ""}">
    <img class="logo__simbolo" src="${base}/img/simbolo.svg" alt="">
    <span class="logo__nome">Fomito</span>
  </span>`;

/* Miniatura do produto: usa a primeira foto da galeria (depende de ilustracoes.js) */
Fomito.foto = (produto, tamanho = 56) => {
  const capa = produto.fotos?.[0];
  const conteudo = capa && Fomito.cena
    ? Fomito.cena(capa.desenho, capa.cena, produto.cat)
    : Fomito.icone(produto.cat);
  return `<div class="foto" style="width:${tamanho}px;height:${tamanho}px">${conteudo}</div>`;
};

/* Soma o total de uma lista de itens [{id, qtd}] */
Fomito.totalItens = (itens) =>
  itens.reduce((soma, item) => soma + Fomito.produto(item.id).preco * item.qtd, 0);
