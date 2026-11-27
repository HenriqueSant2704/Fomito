/* ==========================================================================
   FOMITO · CONTAS DO CAIXA (um arquivo só para o servidor e as telas)
   --------------------------------------------------------------------------
   O servidor (src/regras.js) e o painel usam esta MESMA conta, então o que a
   tela mostra é sempre o que o servidor confere no fechamento.

   Para onde vai cada pagamento:
     • Entrega                 → bolsa do MOTOBOY que entregou (dinheiro e maquininha dele)
     • Mesa fechada por garçom → bolsa do GARÇOM, se ele trabalha com bolsa própria
                                 (pochete + maquininha). Sem bolsa, vai para o caixa.
     • Balcão, retirada, mesa fechada pelo atendente e convênio recebido → CAIXA
       (gaveta do dinheiro + maquininha do balcão)

   Deveria ter na gaveta (dinheiro) =
     dinheiro inicial + vendas em dinheiro do caixa + convênios recebidos em dinheiro
     + dinheiro colocado − dinheiro tirado
   Deveria ter na maquininha = crédito e débito que caíram no caixa (o extrato sai separado)
   Pix cai direto na conta: fica só como registro, sem conferência.
   ========================================================================== */
(function (raiz) {
  const VENDAS = ["comanda", "entrega", "balcao"];
  const arred = (v) => Math.round(v * 100) / 100;

  const novaBolsa = (tipo) => ({ tipo, fundo: 0, recebido: 0, troco: 0, dinheiro: 0, credito: 0, debito: 0, pix: 0, convenio: 0, qtd: 0, entregas: 0, ultima: 0, fechamento: null });

  /** Para onde foi o pagamento: { tipo: "motoboy" | "garcom", nome } ou null (caixa) */
  function destino(caixa, m) {
    if (m.tipo === "entrega") return { tipo: "motoboy", nome: m.por };
    if (m.tipo === "comanda") {
      const g = (caixa.garcons || {})[m.por];
      if (g && m.hora >= (g.definidoEm || 0)) return { tipo: "garcom", nome: m.por };
    }
    return null;
  }

  function resumo(caixa) {
    const r = {
      vendas: 0, qtdVendas: 0, porForma: { dinheiro: 0, pix: 0, credito: 0, debito: 0 },
      recebidoDinheiro: 0, troco: 0, sangrias: 0, suprimentos: 0, recebidoConvenio: 0, convenioDinheiro: 0,
      gaveta: { dinheiro: 0, recebido: 0, troco: 0, credito: 0, debito: 0, pix: 0 },
    };
    const bolsas = { motoboy: {}, garcom: {} };
    const bolsa = (tipo, nome) => (bolsas[tipo][nome] ||= novaBolsa(tipo));
    Object.entries(caixa.motoboys || {}).forEach(([nome, b]) => Object.assign(bolsa("motoboy", nome), { fundo: b.fundo || 0, fechamento: b.fechamento || null }));
    Object.entries(caixa.garcons || {}).forEach(([nome, b]) => Object.assign(bolsa("garcom", nome), { fundo: b.fundo || 0, fechamento: b.fechamento || null }));

    for (const m of caixa.movimentos || []) {
      if (m.tipo === "sangria") { r.sangrias += m.valor; continue; }
      if (m.tipo === "suprimento") { r.suprimentos += m.valor; continue; }
      const venda = VENDAS.includes(m.tipo);
      if (venda) {
        r.vendas += m.valor;
        r.qtdVendas++;
        r.porForma[m.forma] = (r.porForma[m.forma] || 0) + m.valor;
        r.troco += m.troco || 0;
        if (m.forma === "dinheiro") r.recebidoDinheiro += m.recebido ?? m.valor;
      } else if (m.tipo === "convenio") {
        /* Cliente pagou o convênio: entra no caixa do dia em que pagou, mas não é venda nova */
        r.recebidoConvenio += m.valor;
        if (m.forma === "dinheiro") r.convenioDinheiro += m.valor;
      } else continue;

      const d = venda ? destino(caixa, m) : null;
      const alvo = d ? bolsa(d.tipo, d.nome) : r.gaveta;
      if (d) { alvo.qtd++; if (d.tipo === "motoboy") alvo.entregas++; alvo.ultima = Math.max(alvo.ultima, m.hora || 0); }
      if (m.forma === "dinheiro") {
        if (d || venda) { alvo.dinheiro += m.valor; alvo.recebido += m.recebido ?? m.valor; alvo.troco += m.troco || 0; }
      } else if (alvo[m.forma] !== undefined) alvo[m.forma] += m.valor;
    }

    const pendentes = [];
    for (const tipo of ["motoboy", "garcom"]) {
      for (const [nome, b] of Object.entries(bolsas[tipo])) {
        ["recebido", "troco", "dinheiro", "credito", "debito", "pix", "convenio"].forEach((k) => { b[k] = arred(b[k]); });
        b.esperado = arred(b.fundo + b.dinheiro);
        b.esperadoCartao = arred(b.credito + b.debito);
        /* Precisa conferir: tem troco ou recebeu algo, e não foi conferida depois do último recebimento */
        b.pendente = (b.fundo > 0 || b.qtd > 0) && (!b.fechamento || b.ultima > b.fechamento.em);
        if (b.pendente) pendentes.push({ tipo, nome });
      }
    }
    ["dinheiro", "recebido", "troco", "credito", "debito", "pix"].forEach((k) => { r.gaveta[k] = arred(r.gaveta[k]); });
    r.vendas = arred(r.vendas);
    r.convenioDinheiro = arred(r.convenioDinheiro);
    r.recebidoConvenio = arred(r.recebidoConvenio);
    r.bolsas = bolsas.motoboy; // motoboys (nome antigo, usado em várias telas)
    r.bolsasGarcons = bolsas.garcom;
    r.bolsasPendentes = pendentes;
    r.dinheiroEntregas = arred(Object.values(bolsas.motoboy).reduce((s, b) => s + b.dinheiro, 0));
    r.dinheiroGarcons = arred(Object.values(bolsas.garcom).reduce((s, b) => s + b.dinheiro, 0));
    /* Gaveta: só o dinheiro que ficou no caixa (vendas do caixa já vêm sem o troco) */
    r.esperado = arred((caixa.fundo || 0) + r.gaveta.dinheiro + r.convenioDinheiro + r.suprimentos - r.sangrias);
    r.cartoesEsperado = { credito: r.gaveta.credito, debito: r.gaveta.debito };
    return r;
  }

  const contas = { resumo, destino, VENDAS };
  if (typeof module === "object" && module.exports) module.exports = contas;
  else { raiz.Fomito = raiz.Fomito || {}; raiz.Fomito.contasCaixa = contas; }
})(typeof window !== "undefined" ? window : globalThis);
