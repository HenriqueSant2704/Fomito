/* ==========================================================================
   PRONTITO · DADOS FICTÍCIOS DO PROTÓTIPO
   --------------------------------------------------------------------------
   Tudo aqui é de mentira, só para visualizar as telas.
   No sistema real esses dados virão da API (Node.js + Neon).
   ========================================================================== */

window.Prontito = window.Prontito || {};

Prontito.dados = {
  lanchonete: {
    nome: "Lanchonete do Bairro",
    taxaEntrega: 6.0,
    tempoEntrega: "35–50 min",
    aberta: true,
  },

  categorias: [
    { id: "lanches", nome: "Lanches", icone: "lanches" },
    { id: "porcoes", nome: "Porções", icone: "porcoes" },
    { id: "bebidas", nome: "Bebidas", icone: "bebidas" },
  ],

  produtos: [
    { id: 1,  cat: "lanches", nome: "X-Burguer",        desc: "Pão brioche, hambúrguer 150g, queijo, alface e tomate.", preco: 24.9, destaque: true },
    { id: 2,  cat: "lanches", nome: "X-Bacon",          desc: "Hambúrguer 150g, bacon crocante, queijo e maionese da casa.", preco: 29.9, destaque: true },
    { id: 3,  cat: "lanches", nome: "X-Tudo",           desc: "Dois hambúrgueres, ovo, presunto, bacon, queijo e salada.", preco: 36.9 },
    { id: 4,  cat: "lanches", nome: "Misto Quente",     desc: "Pão de forma, presunto e queijo na chapa.", preco: 12.0 },
    { id: 5,  cat: "lanches", nome: "Cachorro-Quente",  desc: "Salsicha, purê, milho, batata palha e vinagrete.", preco: 16.5 },
    { id: 6,  cat: "porcoes", nome: "Batata Frita",     desc: "Porção de 400g, crocante, com sal e orégano.", preco: 22.0, destaque: true },
    { id: 7,  cat: "porcoes", nome: "Batata com Cheddar e Bacon", desc: "400g de batata coberta com cheddar cremoso e bacon.", preco: 32.0 },
    { id: 8,  cat: "porcoes", nome: "Frango a Passarinho", desc: "500g de frango temperado e frito, com alho.", preco: 38.0 },
    { id: 9,  cat: "porcoes", nome: "Calabresa Acebolada", desc: "Calabresa fatiada na chapa com cebola.", preco: 30.0 },
    { id: 10, cat: "bebidas", nome: "Refrigerante Lata", desc: "350ml — Coca, Guaraná ou Fanta.", preco: 6.0 },
    { id: 11, cat: "bebidas", nome: "Suco Natural",      desc: "500ml — laranja, limão ou maracujá.", preco: 9.0 },
    { id: 12, cat: "bebidas", nome: "Água Mineral",      desc: "500ml, com ou sem gás.", preco: 4.0 },
    { id: 13, cat: "bebidas", nome: "Cerveja Long Neck", desc: "330ml bem gelada.", preco: 10.0 },
  ],

  formasPagamento: [
    { id: "dinheiro", nome: "Dinheiro", icone: "dinheiro", sub: "Informe se precisa de troco" },
    { id: "pix",      nome: "Pix",      icone: "pix", sub: "QR Code na hora da entrega" },
    { id: "credito",  nome: "Cartão de crédito", icone: "cartao", sub: "Maquininha na entrega" },
    { id: "debito",   nome: "Cartão de débito",  icone: "cartao", sub: "Maquininha na entrega" },
  ],
};

/* Atalho: busca um produto pelo id */
Prontito.produto = (id) => Prontito.dados.produtos.find((p) => p.id === id);
