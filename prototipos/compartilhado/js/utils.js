/* ==========================================================================
   PRONTITO · FUNÇÕES UTILITÁRIAS
   Pequenas funções usadas pelas três telas.
   ========================================================================== */

window.Prontito = window.Prontito || {};

/* Formata número como moeda: 24.9 -> "R$ 24,90" */
Prontito.moeda = (valor) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* Atalhos para selecionar elementos */
Prontito.$ = (seletor, raiz = document) => raiz.querySelector(seletor);
Prontito.$$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/* Mostra uma mensagem rápida no rodapé da tela */
Prontito.toast = (mensagem, icone = "✅") => {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${icone}</span>${mensagem}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
};

/* HTML do logo (símbolo + nome) para reaproveitar em qualquer tela */
Prontito.logo = (claro = false, base = "../compartilhado") => `
  <span class="logo ${claro ? "logo--claro" : ""}">
    <img class="logo__simbolo" src="${base}/img/simbolo.svg" alt="">
    <span class="logo__nome">Prontito</span>
  </span>`;

/* Soma o total de uma lista de itens [{id, qtd}] */
Prontito.totalItens = (itens) =>
  itens.reduce((soma, item) => soma + Prontito.produto(item.id).preco * item.qtd, 0);
