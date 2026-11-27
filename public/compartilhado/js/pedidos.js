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

   Os pedidos ficam no banco (tabela "pedidos"). As telas leem de
   Fomito.estado.pedidos, que o servidor atualiza a cada 3 segundos.
   Preço e total são calculados no servidor, com o cardápio de lá.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  /* ---------- Contas ----------
     Cada item guarda o preço da hora do pedido: [id, qtd, extras, obs, preço unitário, nome] */
  const precoItem = ([id, qtd, extras = [], , preco]) => {
    if (preco != null) return preco * qtd;
    const p = Fomito.produto(id);
    const adicionais = Fomito.todosAdicionaisDo(p).filter((a) => extras.includes(a.id));
    return (p.preco + adicionais.reduce((s, a) => s + a.preco, 0)) * qtd;
  };
  const total = (p) => p.total ?? p.itens.reduce((s, item) => s + precoItem(item), 0) + (p.modo === "entrega" ? Fomito.dados.lanchonete.taxaEntrega : 0);
  const qtdItens = (p) => p.itens.reduce((s, [, qtd]) => s + qtd, 0);
  /** Endereço numa linha: "Rua Pará, 77, Casa 2, Centro" */
  const textoEndereco = (p) => [p.rua, p.compl, p.bairro].filter(Boolean).join(", ");

  /* Cada pedido sai com os campos calculados que as telas usam */
  const completar = (p) => ({ modo: "entrega", ...p, min: Math.max(0, Math.round((Date.now() - p.criadoEm) / 60000)), endereco: p.rua ? textoEndereco(p) : p.endereco || "", total: total({ modo: "entrega", ...p }) });

  /* ---------- Consultas ---------- */
  const lista = () => (Fomito.estado.pedidos || []).map(completar).sort((a, b) => b.criadoEm - a.criadoEm);
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

  /* ---------- Ações (todas passam pelo servidor) ---------- */
  /** Cria um pedido novo (entrega ou balcão). Retorna o pedido completo. */
  const criar = async (dados) => completar(await Fomito.acao("POST", "/pedidos", dados));

  /** Painel: aceitar → em preparo → pronto (e, no balcão, cliente retirou) */
  const avancar = async (num) => completar(await Fomito.acao("POST", `/pedidos/${num}/avancar`));

  /** Painel: cancela o pedido com o motivo (vai para o cliente no WhatsApp; fica registrado quem cancelou) */
  const cancelar = (num, motivo) => Fomito.acao("POST", `/pedidos/${num}/cancelar`, { motivo });

  /** O motoboy sai com um ou mais pedidos prontos */
  const sairParaEntrega = async (nums) => (await Fomito.acao("POST", "/pedidos/sair", { nums })).map(completar);

  /**
   * O motoboy entregou e recebeu: o pedido vira concluído e o pagamento
   * entra no caixa com o valor recebido e o troco (calculado no servidor).
   */
  const concluirEntrega = async (num, { forma, recebido }) => completar(await Fomito.acao("POST", `/pedidos/${num}/entregar`, { forma, recebido }));

  const STATUS = {
    novo:      { nome: "Novo", cor: "laranja", icone: "recebido" },
    preparo:   { nome: "Em preparo", cor: "amarelo", icone: "chama" },
    pronto:    { nome: "Pronto", cor: "roxo", icone: "sino" },
    rota:      { nome: "Em rota", cor: "roxo", icone: "entrega" },
    concluido: { nome: "Entregue", cor: "verde", icone: "check" },
    cancelado: { nome: "Cancelado", cor: "vermelho", icone: "fechar" },
  };
  const hora = (ts) => (ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-");

  Fomito.pedidos = { lista, doNumero, entregas, porBairro, criar, avancar, cancelar, sairParaEntrega, concluirEntrega, total, precoItem, qtdItens, textoEndereco, STATUS, hora };
})();
