/* ==========================================================================
   FOMITO · DADOS FICTÍCIOS DO PROTÓTIPO
   --------------------------------------------------------------------------
   Tudo aqui é de mentira, só para visualizar as telas.
   No sistema real esses dados virão da API (Node.js + Neon), e as fotos
   serão enviadas pelo dono da lanchonete no painel.
   ========================================================================== */

window.Fomito = window.Fomito || {};

/* Atalho para descrever uma foto da galeria: desenho + tipo de cena + legenda */
const foto = (desenho, cena = "produto", legenda = "") => ({ desenho, cena, legenda });

Fomito.dados = {
  lanchonete: {
    nome: "Lanchonete do Bairro",
    slogan: "Lanches na chapa desde 2012",
    endereco: "Av. Brasil, 1500, Centro",
    horario: "Todos os dias, das 18h às 23h30",
    taxaEntrega: 6.0,
    tempoEntrega: "35–50 min",
    aberta: true,

    /* Vitrine do topo: imagens que o dono escolhe para mostrar a casa */
    vitrine: [
      { ...foto("xburguer", "combo"), titulo: "Combo da casa", texto: "Lanche + batata + refri por R$ 39,90" },
      { ...foto("xbacon", "chapa"),   titulo: "Feito na chapa, na hora", texto: "Carne 150g moída todo dia" },
      { ...foto("xburguer", "salao"), titulo: "Venha comer aqui", texto: "Salão com 12 mesas e atendimento na mesa" },
      { ...foto("xburguer", "entrega"), titulo: "Entrega no bairro", texto: "Chega quentinho em até 50 min" },
    ],
  },

  categorias: [
    { id: "lanches", nome: "Lanches", icone: "lanches" },
    { id: "porcoes", nome: "Porções", icone: "porcoes" },
    { id: "bebidas", nome: "Bebidas", icone: "bebidas" },
  ],

  /* Adicionais que o cliente pode incluir, por categoria */
  adicionais: {
    lanches: [
      { id: "bacon", nome: "Bacon extra", preco: 5 },
      { id: "queijo", nome: "Queijo extra", preco: 3 },
      { id: "ovo", nome: "Ovo", preco: 2.5 },
      { id: "carne", nome: "Carne extra 150g", preco: 9 },
    ],
    porcoes: [
      { id: "cheddar", nome: "Cheddar cremoso", preco: 6 },
      { id: "molho", nome: "Molho da casa", preco: 2 },
    ],
    bebidas: [],
  },

  produtos: [
    { id: 1, cat: "lanches", nome: "X-Burguer", preco: 24.9, destaque: true, desenho: "xburguer",
      desc: "O clássico da casa: hambúrguer de 150g na chapa, queijo derretido e salada fresquinha no pão brioche.",
      ingredientes: ["Pão brioche", "Hambúrguer 150g", "Queijo prato", "Alface", "Tomate", "Maionese da casa"],
      fotos: [foto("xburguer"), foto("xburguer", "close", "Detalhe do lanche"), foto("xburguer", "chapa", "Foto da casa: carne na chapa"), foto("xburguer", "combo", "Sugestão: monte um combo")] },
    { id: 2, cat: "lanches", nome: "X-Bacon", preco: 29.9, destaque: true, desenho: "xbacon",
      desc: "Hambúrguer de 150g com bacon crocante em tiras, queijo e a maionese da casa.",
      ingredientes: ["Pão brioche", "Hambúrguer 150g", "Bacon crocante", "Queijo prato", "Alface", "Maionese da casa"],
      fotos: [foto("xbacon"), foto("xbacon", "close", "Bacon crocante em tiras"), foto("xbacon", "chapa", "Foto da casa: preparo na chapa")] },
    { id: 3, cat: "lanches", nome: "X-Tudo", preco: 36.9, desenho: "xtudo",
      desc: "Para quem tem fome de verdade: dois hambúrgueres, ovo, presunto, bacon, queijo e salada.",
      ingredientes: ["2 hambúrgueres 150g", "Ovo", "Presunto", "Bacon", "Queijo", "Alface", "Tomate"],
      fotos: [foto("xtudo"), foto("xtudo", "close", "Dois andares de carne"), foto("xtudo", "combo", "Sugestão: com batata e refri")] },
    { id: 4, cat: "lanches", nome: "Misto Quente", preco: 12.0, desenho: "misto",
      desc: "Pão de forma na chapa com presunto e queijo derretido.",
      ingredientes: ["Pão de forma", "Presunto", "Queijo"],
      fotos: [foto("misto"), foto("misto", "close", "Queijo derretido")] },
    { id: 5, cat: "lanches", nome: "Cachorro-Quente", preco: 16.5, desenho: "hotdog",
      desc: "Salsicha, purê, milho, batata palha e vinagrete no pão macio.",
      ingredientes: ["Pão", "Salsicha", "Purê", "Milho", "Batata palha", "Vinagrete"],
      fotos: [foto("hotdog"), foto("hotdog", "close", "Montado na hora")] },
    { id: 6, cat: "porcoes", nome: "Batata Frita", preco: 22.0, destaque: true, desenho: "batata",
      desc: "Porção de 400g, sequinha e crocante, com sal e orégano.",
      ingredientes: ["Batata 400g", "Sal", "Orégano"],
      fotos: [foto("batata", "produto"), foto("batata", "close", "Crocante por fora")] },
    { id: 7, cat: "porcoes", nome: "Batata com Cheddar e Bacon", preco: 32.0, desenho: "batatacheddar",
      desc: "400g de batata coberta com cheddar cremoso e pedaços de bacon.",
      ingredientes: ["Batata 400g", "Cheddar cremoso", "Bacon em cubos"],
      fotos: [foto("batatacheddar"), foto("batatacheddar", "close", "Cheddar de verdade")] },
    { id: 8, cat: "porcoes", nome: "Frango a Passarinho", preco: 38.0, desenho: "frango",
      desc: "500g de frango temperado e frito, finalizado com alho dourado.",
      ingredientes: ["Frango 500g", "Alho frito", "Limão"],
      fotos: [foto("frango"), foto("frango", "close", "Bem douradinho")] },
    { id: 9, cat: "porcoes", nome: "Calabresa Acebolada", preco: 30.0, desenho: "calabresa",
      desc: "Calabresa fatiada na chapa com cebola.",
      ingredientes: ["Calabresa", "Cebola"],
      fotos: [foto("calabresa")] },
    { id: 10, cat: "bebidas", nome: "Refrigerante Lata", preco: 6.0, desenho: "refri",
      desc: "350ml bem gelado. Coca-Cola, Guaraná ou Fanta.", ingredientes: ["350ml"],
      fotos: [foto("refri", "produto")] },
    { id: 11, cat: "bebidas", nome: "Suco Natural", preco: 9.0, desenho: "suco",
      desc: "500ml feito na hora: laranja, limão ou maracujá.", ingredientes: ["500ml", "Fruta natural"],
      fotos: [foto("suco", "produto"), foto("suco", "close", "Feito na hora")] },
    { id: 12, cat: "bebidas", nome: "Água Mineral", preco: 4.0, desenho: "agua",
      desc: "500ml, com ou sem gás.", ingredientes: ["500ml"], fotos: [foto("agua")] },
    { id: 13, cat: "bebidas", nome: "Cerveja Long Neck", preco: 10.0, desenho: "cerveja",
      desc: "330ml trincando de gelada.", ingredientes: ["330ml"], fotos: [foto("cerveja")] },
  ],

  formasPagamento: [
    { id: "dinheiro", nome: "Dinheiro", icone: "dinheiro", sub: "Informe se precisa de troco" },
    { id: "pix",      nome: "Pix",      icone: "pix", sub: "QR Code na hora da entrega" },
    { id: "credito",  nome: "Cartão de crédito", icone: "cartao", sub: "Maquininha na entrega" },
    { id: "debito",   nome: "Cartão de débito",  icone: "cartao", sub: "Maquininha na entrega" },
  ],
};

/* Atalho: busca um produto pelo id */
Fomito.produto = (id) => Fomito.dados.produtos.find((p) => p.id === id);
