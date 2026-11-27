/* ==========================================================================
   FOMITO · CONTROLE DE CAIXA
   --------------------------------------------------------------------------
   O caixa do dia:
     1. ABRIR            → com o DINHEIRO INICIAL que o dono deixa na gaveta
     2. PAGAMENTOS       → cada conta de mesa e entrega, com a forma, o valor
                           que o cliente deu e o troco devolvido
     3. TIRAR DINHEIRO   → ex.: levar ao cofre    (no código: tipo "sangria")
        COLOCAR DINHEIRO → ex.: mais troco        (no código: tipo "suprimento")
     4. CORRIGIR         → o responsável corrige um pagamento lançado errado
                           (ex.: o motoboy marcou cartão, mas foi Pix). O valor
                           original NUNCA é apagado: cada correção guarda o
                           antes, o depois, quem corrigiu, quando e o motivo.
     5. FECHAR           → conta o dinheiro da gaveta e compara com o que deveria ter

   Deveria ter na gaveta =
     dinheiro inicial + notas recebidas − troco devolvido
     + dinheiro colocado − dinheiro tirado

   O caixa fica no banco (tabela "caixas"). As contas são refeitas no
   servidor, que é quem grava; aqui elas servem para mostrar na tela.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  /* ---------- Contas do caixa ---------- */
  const VENDAS = ["comanda", "entrega", "balcao"];
  const resumo = (caixa) => {
    const r = { vendas: 0, porForma: { dinheiro: 0, pix: 0, credito: 0, debito: 0 }, recebidoDinheiro: 0, troco: 0, sangrias: 0, suprimentos: 0, qtdVendas: 0 };
    caixa.movimentos.forEach((m) => {
      if (VENDAS.includes(m.tipo)) {
        r.vendas += m.valor;
        r.qtdVendas++;
        r.porForma[m.forma] = (r.porForma[m.forma] || 0) + m.valor;
        r.troco += m.troco || 0;
        if (m.forma === "dinheiro") r.recebidoDinheiro += m.recebido ?? m.valor; // notas que o cliente deu
      }
      /* Cliente pagou o convênio: entra no caixa, mas não é venda nova */
      if (m.tipo === "convenio") { r.recebidoConvenio = (r.recebidoConvenio || 0) + m.valor; if (m.forma === "dinheiro") r.convenioDinheiro = (r.convenioDinheiro || 0) + m.valor; }
      if (m.tipo === "sangria") r.sangrias += m.valor;
      if (m.tipo === "suprimento") r.suprimentos += m.valor;
    });
    /* O dinheiro das entregas fica na bolsa de cada motoboy, não na gaveta do balcão */
    const bolsas = {};
    const bolsa = (nome) => (bolsas[nome] ||= { fundo: 0, recebido: 0, troco: 0, dinheiro: 0, entregas: 0 });
    Object.entries(caixa.motoboys || {}).forEach(([nome, b]) => Object.assign(bolsa(nome), { fundo: b.fundo || 0, fechamento: b.fechamento || null }));
    caixa.movimentos.filter((m) => m.tipo === "entrega").forEach((m) => {
      const b = bolsa(m.por);
      b.entregas++;
      if (m.forma === "dinheiro") { b.dinheiro += m.valor; b.recebido += m.recebido ?? m.valor; b.troco += m.troco || 0; }
    });
    Object.values(bolsas).forEach((b) => { b.esperado = Math.round((b.fundo + b.dinheiro) * 100) / 100; });
    r.bolsas = bolsas;
    r.dinheiroEntregas = Object.values(bolsas).reduce((s, b) => s + b.dinheiro, 0);
    r.esperado = caixa.fundo + r.porForma.dinheiro - r.dinheiroEntregas - r.sangrias + r.suprimentos + (r.convenioDinheiro || 0);
    return r;
  };

  /* ---------- Consultas ---------- */
  const estado = () => Fomito.estado.caixa || { aberto: null, fechamentos: [] };
  const aberto = () => estado().aberto;

  /* ---------- Ações (administrador) ---------- */
  const abrir = ({ fundo, motoboys = {} }) => Fomito.acao("POST", "/caixa/abrir", { fundo, motoboys });

  /** Tirar dinheiro (sangria) ou colocar dinheiro (suprimento) */
  const registrar = ({ tipo, ref, valor }) => Fomito.acao("POST", "/caixa/movimento", { tipo, ref, valor });

  /** Corrige um pagamento. Retorna o movimento corrigido, ou a mensagem de erro (texto). */
  async function corrigir(id, novo, { motivo }) {
    try { return await Fomito.acao("POST", "/caixa/corrigir", { id, novo, motivo }); }
    catch (err) { return err.message; }
  }

  /** Todas as correções do caixa, da mais nova para a mais antiga (para o registro) */
  const correcoes = (caixa) => (caixa?.movimentos || [])
    .flatMap((m) => (m.correcoes || []).map((c) => ({ ...c, movimento: m })))
    .sort((a, b) => b.em - a.em);

  /** Fecha o caixa com o dinheiro contado na gaveta */
  const fechar = ({ contado, obs = "" }) => Fomito.acao("POST", "/caixa/fechar", { contado, obs });

  const FORMAS = { dinheiro: "Dinheiro", pix: "Pix", credito: "Cartão de crédito", debito: "Cartão de débito" };
  /* Para mostrar (o convênio não é escolhido no caixa: vem do pedido ou da comanda) */
  const FORMAS_TODAS = { ...FORMAS, convenio: "Convênio" };
  /* Nomes que aparecem na tela (simples, para qualquer um entender) */
  const NOMES = { sangria: "Tirar dinheiro", suprimento: "Colocar dinheiro", fundo: "Dinheiro inicial" };

  Fomito.caixa = { estado, aberto, abrir, registrar, corrigir, correcoes, fechar, resumo, FORMAS, FORMAS_TODAS, NOMES };
})();
