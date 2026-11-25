/* ==========================================================================
   FOMITO · PEDIDOS DE ENTREGA E BALCÃO
   --------------------------------------------------------------------------
   Os pedidos das mesas ficam nas comandas (comandas.js). Aqui ficam os
   pedidos de ENTREGA e de BALCÃO, os mesmos para:
     • o cliente, que pediu pelo cardápio e acompanha o status;
     • o painel, onde o atendente ACEITA e marca PRONTO;
     • o motoboy, que SAI PARA ENTREGA, recebe o pagamento e FINALIZA.

   Caminho do pedido de entrega:
     novo → preparo → pronto → rota → concluido
     (painel)  (painel)  (motoboy) (motoboy, com o pagamento)

   No protótipo fica no navegador (localStorage "fomito.pedidos"), então o
   cardápio, o painel e o motoboy abertos no mesmo navegador conversam.
   No sistema real vira as tabelas "pedidos" e "pedido_itens" no Neon,
   com atualização em tempo real (WebSocket) e notificação no celular.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  const CHAVE = "fomito.pedidos";
  const minutos = (n) => Date.now() - n * 60000;

  /* ---------- Exemplo: pedidos de hoje em bairros diferentes ---------- */
  const end = (rua, bairro, compl = "", ref = "") => ({ rua, bairro, compl, ref });
  const EXEMPLO = [
    { num: 1042, criadoEm: minutos(1),  cliente: "Ana Souza",      telefone: "(11) 98888-7777", ...end("Rua das Flores, 120", "Centro", "", "Portão verde"), itens: [[2, 1, ["bacon"], "sem cebola"], [6, 1], [10, 2]], pag: "dinheiro", troco: 100, status: "novo" },
    { num: 1041, criadoEm: minutos(16), cliente: "Rafael Melo",    telefone: "(11) 91234-5678", ...end("Rua Amazonas, 510", "Jardim", "Ap 31"), itens: [[3, 2], [10, 2]], pag: "pix", status: "pronto", prontoEm: minutos(2), whats: "Em preparo" },
    { num: 1040, criadoEm: minutos(9),  cliente: "Bruno Lima",     telefone: "(11) 97777-1234", ...end("Av. Paulista, 900", "Bela Vista", "Ap 52"), itens: [[3, 1], [11, 1]], pag: "pix", status: "preparo", whats: "Em preparo" },
    { num: 1039, criadoEm: minutos(19), cliente: "Gabriela Nunes", telefone: "(11) 92222-3333", ...end("Rua Pará, 77", "Centro", "Casa 2"), itens: [[1, 1], [10, 1]], pag: "dinheiro", troco: 50, status: "pronto", prontoEm: minutos(4), whats: "Em preparo" },
    { num: 1038, criadoEm: minutos(21), cliente: "Carla Dias",     telefone: "(11) 96666-4321", ...end("Rua Bahia, 45", "Jardim", "", "Ao lado da padaria"), itens: [[5, 2], [10, 2]], pag: "credito", status: "pronto", prontoEm: minutos(5), whats: "Em preparo" },
    { num: 1036, criadoEm: minutos(34), cliente: "Marina Costa",   telefone: "(11) 94545-1212", ...end("Rua Sergipe, 88", "Vila Nova", "", "Casa azul"), itens: [[2, 1], [7, 1], [13, 2]], pag: "debito", status: "rota", prontoEm: minutos(14), saiuEm: minutos(10), motoboy: "Lucas Ramos", whats: "Saiu para entrega" },
    { num: 1037, criadoEm: minutos(80), cliente: "Diego Alves",    telefone: "(11) 95555-0000", ...end("Rua Goiás, 300", "Vila Nova"), itens: [[8, 1], [13, 4]], pag: "debito", status: "concluido", prontoEm: minutos(62), saiuEm: minutos(58), entregueEm: minutos(40), motoboy: "João Pereira", whats: "Entregue" },
  ];

  /* ---------- Leitura e gravação ---------- */
  let memoria = null;
  const ler = () => {
    try { const v = localStorage.getItem(CHAVE); if (v) return JSON.parse(v); } catch { /* sem armazenamento */ }
    return memoria || structuredClone(EXEMPLO);
  };
  const gravar = (d) => {
    memoria = d;
    try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch { /* segue em memória */ }
  };
  const alterar = (fn) => { const d = ler(); const r = fn(d); gravar(d); return r; };

  /* ---------- Contas ---------- */
  const precoItem = ([id, qtd, extras = []]) => {
    const p = Fomito.produto(id);
    const adicionais = (Fomito.dados.adicionais[p.cat] || []).filter((a) => extras.includes(a.id));
    return (p.preco + adicionais.reduce((s, a) => s + a.preco, 0)) * qtd;
  };
  const total = (p) => p.itens.reduce((s, item) => s + precoItem(item), 0) + (p.modo === "entrega" ? Fomito.dados.lanchonete.taxaEntrega : 0);
  const qtdItens = (p) => p.itens.reduce((s, [, qtd]) => s + qtd, 0);
  /** Endereço numa linha: "Rua Pará, 77, Casa 2, Centro" */
  const textoEndereco = (p) => [p.rua, p.compl, p.bairro].filter(Boolean).join(", ");

  /* Cada pedido sai com os campos calculados que as telas usam */
  const completar = (p) => ({ modo: "entrega", ...p, min: Math.max(0, Math.round((Date.now() - p.criadoEm) / 60000)), endereco: p.rua ? textoEndereco(p) : p.endereco || "", total: total({ modo: "entrega", ...p }) });

  /* ---------- Consultas ---------- */
  const lista = () => ler().map(completar).sort((a, b) => b.criadoEm - a.criadoEm);
  const doNumero = (num) => lista().find((p) => p.num === Number(num)) || null;
  /** Pedidos de entrega por status, ex.: entregas("pronto") */
  const entregas = (...status) => lista().filter((p) => p.modo === "entrega" && status.includes(p.status));

  /** Agrupa por bairro, com os bairros de mais pedidos primeiro */
  const porBairro = (pedidos) => {
    const grupos = {};
    pedidos.forEach((p) => (grupos[p.bairro || "Sem bairro"] ||= []).push(p));
    return Object.entries(grupos)
      .map(([bairro, lista]) => ({ bairro, pedidos: lista.sort((a, b) => a.criadoEm - b.criadoEm) }))
      .sort((a, b) => b.pedidos.length - a.pedidos.length || a.bairro.localeCompare(b.bairro));
  };

  /* ---------- Ações ---------- */
  /** Cria um pedido novo (entrega ou balcão). Retorna o pedido completo. */
  const criar = (dados) => alterar((d) => {
    const num = Math.max(1044, ...d.map((p) => p.num)) + 1;
    const novo = { modo: "entrega", ...dados, num, criadoEm: Date.now(), status: "novo" };
    d.push(novo);
    return completar(novo);
  });

  /** Muda o status e guarda campos extras (quem, quando, pagamento...) */
  const atualizar = (num, campos) => alterar((d) => {
    const p = d.find((x) => x.num === Number(num));
    if (!p) return null;
    if (campos.status === "pronto") campos.prontoEm = Date.now();
    Object.assign(p, campos);
    return completar(p);
  });

  const remover = (num) => alterar((d) => { const i = d.findIndex((x) => x.num === Number(num)); if (i >= 0) d.splice(i, 1); });

  /** O motoboy sai com um ou mais pedidos prontos */
  const sairParaEntrega = (nums, motoboy) => nums.map((num) => atualizar(num, { status: "rota", motoboy, saiuEm: Date.now() }));

  /**
   * O motoboy entregou e recebeu: o pedido vira concluído e o pagamento
   * entra no caixa com o valor recebido e o troco (como no fechar conta).
   * Retorna o pedido, ou null se o caixa estiver fechado.
   */
  const concluirEntrega = (num, { forma, recebido, troco, por }) => {
    const p = doNumero(num);
    if (!p || (Fomito.caixa && !Fomito.caixa.aberto())) return null;
    const dinheiro = forma === "dinheiro";
    Fomito.caixa?.registrar({ tipo: "entrega", pedido: p.num, ref: `Entrega #${p.num} · ${p.cliente}`, forma, valor: p.total, ...(dinheiro ? { recebido, troco } : {}), por });
    return atualizar(num, { status: "concluido", entregueEm: Date.now(), pagoCom: forma, recebido: dinheiro ? recebido : null, trocoDado: dinheiro ? troco : null, motoboy: p.motoboy || por });
  };

  const STATUS = {
    novo:      { nome: "Novo", cor: "laranja", icone: "recebido" },
    preparo:   { nome: "Em preparo", cor: "amarelo", icone: "chama" },
    pronto:    { nome: "Pronto", cor: "roxo", icone: "sino" },
    rota:      { nome: "Em rota", cor: "roxo", icone: "entrega" },
    concluido: { nome: "Entregue", cor: "verde", icone: "check" },
  };
  const hora = (ts) => (ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-");

  Fomito.pedidos = { lista, doNumero, entregas, porBairro, criar, atualizar, remover, sairParaEntrega, concluirEntrega, total, precoItem, qtdItens, textoEndereco, STATUS, hora, CHAVE };
})();
