/* ==========================================================================
   FOMITO · COMANDAS DAS MESAS
   --------------------------------------------------------------------------
   Uma comanda é a "conta aberta" de uma mesa. Ela é a mesma para todos:
     • o cliente, que pediu pelo QR Code da mesa;
     • o garçom, que lança itens e fecha a conta;
     • o painel, que vê as rodadas chegando na cozinha.

   Cada vez que alguém pede, entra uma RODADA na comanda:
     recebido → preparo → pronto → servido
     (painel: aceita e marca pronto · garçom: é avisado e marca servido)

   Quando o garçom fecha a conta, a comanda sai das abertas e vira um
   pedido antigo no histórico (lista "fechadas").

   As comandas ficam no banco (tabela "comandas"). As telas leem de
   Fomito.estado.comandas, que o servidor atualiza a cada 3 segundos.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  /* ---------- Contas (cada item guarda o preço da hora do pedido) ---------- */
  const precoItem = (item) => {
    if (item.preco != null) return item.preco * item.qtd;
    const p = Fomito.produto(item.id);
    const extras = Fomito.todosAdicionaisDo(p).filter((a) => item.extras?.includes(a.id));
    return (p.preco + extras.reduce((s, a) => s + a.preco, 0)) * item.qtd;
  };
  const totalRodada = (r) => r.itens.reduce((s, i) => s + precoItem(i), 0);
  /** Total dos itens (sem a taxa de serviço) */
  const total = (c) => c.rodadas.reduce((s, r) => s + totalRodada(r), 0);
  const qtdItens = (c) => c.rodadas.reduce((s, r) => s + r.itens.reduce((t, i) => t + i.qtd, 0), 0);

  /* ---------- Consultas ---------- */
  const abertas = () => [...(Fomito.estado.comandas?.abertas || [])].sort((a, b) => a.mesa - b.mesa);
  const fechadas = () => [...(Fomito.estado.comandas?.fechadas || [])].sort((a, b) => b.fechadaEm - a.fechadaEm);
  const daMesa = (mesa) => abertas().find((c) => c.mesa === Number(mesa)) || null;

  /* ---------- Ações (todas passam pelo servidor) ---------- */
  /**
   * Lança uma rodada. Se a mesa não tem comanda aberta, abre uma.
   * O cliente manda o código do QR da mesa; o garçom e o painel mandam o número.
   */
  const lancar = (mesa, itens, { nome = "", telefone = "" } = {}) => Fomito.acao("POST", "/comandas/lancar", {
    mesa: Number(mesa), codigo: Fomito.codigoMesa, nome, telefone,
    itens: itens.map(({ id, qtd, extras = [], obs = "", sem = [] }) => ({ id, qtd, extras, obs, sem })),
  });

  /** Muda o status de uma rodada (índice) da mesa */
  const statusRodada = (mesa, indice, status) => Fomito.acao("POST", `/comandas/${mesa}/rodadas/${indice}`, { status });

  const pedirConta = (mesa, sim = true) => Fomito.acao("POST", "/comandas/conta", { mesa: Number(mesa), codigo: Fomito.codigoMesa, sim });

  /**
   * Fecha a conta: a comanda vira um pedido antigo e cada pagamento
   * entra no caixa com o valor recebido e o troco.
   * pagamentos: [{ forma, valor, recebido? }]
   */
  const fechar = (mesa, { pagamentos, pessoas = 1 }) => Fomito.acao("POST", `/comandas/${mesa}/fechar`, { pagamentos, pessoas });

  const STATUS = {
    recebido: { nome: "Recebido", cor: "laranja", icone: "recebido" },
    preparo:  { nome: "Em preparo", cor: "amarelo", icone: "chama" },
    pronto:   { nome: "Pronto", cor: "roxo", icone: "sino" },
    servido:  { nome: "Servido", cor: "verde", icone: "check" },
  };
  const PROXIMO = { recebido: "preparo", preparo: "pronto", pronto: "servido" };
  const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const mesaTexto = (n) => `Mesa ${String(n).padStart(2, "0")}`;
  /** Quantas mesas a loja tem (Configurações → Loja e entrega) */
  const totalMesas = () => Number(Fomito.dados?.lanchonete?.mesas) || 0;

  Fomito.comandas = { abertas, fechadas, daMesa, lancar, statusRodada, pedirConta, fechar, total, totalRodada, precoItem, qtdItens, STATUS, PROXIMO, hora, mesaTexto, totalMesas };
})();
