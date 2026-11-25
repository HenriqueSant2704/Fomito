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

   No protótipo fica no navegador (localStorage "fomito.comandas"), então
   o cardápio, o garçom e o painel abertos no mesmo navegador conversam.
   No sistema real vira as tabelas "comandas" e "comanda_itens" no Neon,
   com atualização em tempo real (WebSocket).
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  const CHAVE = "fomito.comandas";
  const minutos = (n) => Date.now() - n * 60000;

  /* Mesas ocupadas de exemplo (as mesmas que o garçom e o painel mostram) */
  const rodada = (min, por, itens, status = "servido") => ({ hora: minutos(min), por, status, itens: itens.map(([id, qtd, extras = [], obs = ""]) => ({ id, qtd, extras, obs })) });
  const EXEMPLO = {
    abertas: [
      { mesa: 2, nome: "Família Costa", pessoas: 4, abertaEm: minutos(48), pediuConta: true, rodadas: [rodada(48, "garcom", [[3, 2], [6, 1], [13, 4]])] },
      { mesa: 3, nome: "", pessoas: 2, abertaEm: minutos(25), pediuConta: false, rodadas: [rodada(25, "garcom", [[1, 1], [2, 1]]), rodada(10, "qr", [[10, 2]])] },
      { mesa: 5, nome: "Rafa", pessoas: 3, abertaEm: minutos(12), pediuConta: false, rodadas: [rodada(12, "qr", [[7, 1]]), rodada(4, "qr", [[11, 3]], "preparo")] },
      { mesa: 9, nome: "", pessoas: 6, abertaEm: minutos(70), pediuConta: true, rodadas: [rodada(70, "garcom", [[8, 2], [9, 1], [13, 8]])] },
      { mesa: 11, nome: "Paulo", pessoas: 1, abertaEm: minutos(18), pediuConta: false, rodadas: [rodada(18, "qr", [[5, 1], [12, 1]], "pronto")] },
    ],
    fechadas: [
      { numero: 2031, mesa: 4, nome: "Júlia", pessoas: 2, abertaEm: minutos(150), fechadaEm: minutos(95), forma: "pix", pagamentos: [{ forma: "pix", valor: 98.67 }], total: 98.67, rodadas: [rodada(150, "qr", [[2, 2], [6, 1]]), rodada(120, "qr", [[13, 2]])] },
      { numero: 2030, mesa: 8, nome: "", pessoas: 3, abertaEm: minutos(210), fechadaEm: minutos(160), forma: "credito", pagamentos: [{ forma: "credito", valor: 124.3 }], total: 124.3, rodadas: [rodada(210, "garcom", [[3, 1], [1, 2], [10, 3]])] },
    ],
  };

  /* ---------- Leitura e gravação ---------- */
  let memoria = null;
  const ler = () => {
    try { const v = localStorage.getItem(CHAVE); if (v) return JSON.parse(v); } catch { /* sem armazenamento */ }
    return memoria || structuredClone(EXEMPLO);
  };
  const gravar = (dados) => {
    memoria = dados;
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch { /* segue em memória */ }
  };
  /** Lê, deixa a função alterar e grava. Retorna o que a função retornar. */
  const alterar = (fn) => { const d = ler(); const r = fn(d); gravar(d); return r; };

  /* ---------- Contas ---------- */
  const precoItem = (item) => {
    const p = Fomito.produto(item.id);
    const extras = (Fomito.dados.adicionais[p.cat] || []).filter((a) => item.extras?.includes(a.id));
    return (p.preco + extras.reduce((s, a) => s + a.preco, 0)) * item.qtd;
  };
  const totalRodada = (r) => r.itens.reduce((s, i) => s + precoItem(i), 0);
  const total = (c) => c.rodadas.reduce((s, r) => s + totalRodada(r), 0);
  const qtdItens = (c) => c.rodadas.reduce((s, r) => s + r.itens.reduce((t, i) => t + i.qtd, 0), 0);

  /* ---------- Ações ---------- */
  const abertas = () => ler().abertas.sort((a, b) => a.mesa - b.mesa);
  const fechadas = () => ler().fechadas.sort((a, b) => b.fechadaEm - a.fechadaEm);
  const daMesa = (mesa) => ler().abertas.find((c) => c.mesa === Number(mesa)) || null;

  /** Lança uma rodada. Se a mesa não tem comanda aberta, abre uma. */
  const lancar = (mesa, itens, { nome = "", por = "qr", pessoas = 2 } = {}) => alterar((d) => {
    let c = d.abertas.find((x) => x.mesa === Number(mesa));
    if (!c) {
      c = { mesa: Number(mesa), nome, pessoas, abertaEm: Date.now(), pediuConta: false, rodadas: [] };
      d.abertas.push(c);
    }
    if (nome && !c.nome) c.nome = nome;
    c.rodadas.push({ hora: Date.now(), por, status: "recebido", itens: itens.map(({ id, qtd, extras = [], obs = "" }) => ({ id, qtd, extras, obs })) });
    return c;
  });

  /** Muda o status de uma rodada (índice) da mesa */
  const statusRodada = (mesa, indice, status) => alterar((d) => {
    const c = d.abertas.find((x) => x.mesa === Number(mesa));
    if (!c?.rodadas[indice]) return;
    c.rodadas[indice].status = status;
    c.rodadas[indice][`${status}Em`] = Date.now(); // ex.: prontoEm, servidoEm
  });

  const pedirConta = (mesa, sim = true) => alterar((d) => {
    const c = d.abertas.find((x) => x.mesa === Number(mesa));
    if (c) c.pediuConta = sim;
  });

  /**
   * Fecha a conta: a comanda vira um pedido antigo e cada pagamento
   * entra no caixa (caixa.js) com o valor recebido e o troco.
   * pagamentos: [{ forma, valor, recebido?, troco? }]
   */
  const fechar = (mesa, { pagamentos, total: valor, servico = 0, por = "" }) => alterar((d) => {
    const i = d.abertas.findIndex((x) => x.mesa === Number(mesa));
    if (i < 0) return null;
    const [c] = d.abertas.splice(i, 1);
    const numero = Math.max(2000, ...d.fechadas.map((f) => f.numero)) + 1;
    const forma = pagamentos.length > 1 ? "misto" : pagamentos[0].forma;
    const fechada = { ...c, numero, fechadaEm: Date.now(), forma, pagamentos, servico, total: valor ?? total(c), por };
    d.fechadas.push(fechada);
    pagamentos.forEach((p) => Fomito.caixa?.registrar({ tipo: "comanda", ref: `${mesaTexto(c.mesa)} · comanda #${numero}`, ...p, por }));
    return fechada;
  });

  const STATUS = {
    recebido: { nome: "Recebido", cor: "laranja", icone: "recebido" },
    preparo:  { nome: "Em preparo", cor: "amarelo", icone: "chama" },
    pronto:   { nome: "Pronto", cor: "roxo", icone: "sino" },
    servido:  { nome: "Servido", cor: "verde", icone: "check" },
  };
  const PROXIMO = { recebido: "preparo", preparo: "pronto", pronto: "servido" };
  const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const mesaTexto = (n) => `Mesa ${String(n).padStart(2, "0")}`;

  Fomito.comandas = { abertas, fechadas, daMesa, lancar, statusRodada, pedirConta, fechar, total, totalRodada, precoItem, qtdItens, STATUS, PROXIMO, hora, mesaTexto, CHAVE };
})();
