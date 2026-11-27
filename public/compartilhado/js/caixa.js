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

   Deveria ter na gaveta (dinheiro) e na maquininha: veja contas-caixa.js

   O caixa fica no banco (tabela "caixas"). As contas são refeitas no
   servidor, que é quem grava; aqui elas servem para mostrar na tela.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  /* ---------- Contas do caixa ----------
     A conta (gaveta, maquininha e bolsas) é a MESMA do servidor: compartilhado/js/contas-caixa.js */
  const resumo = (caixa) => Fomito.contasCaixa.resumo(caixa);

  /* ---------- Consultas ---------- */
  const estado = () => Fomito.estado.caixa || { aberto: null, fechamentos: [] };
  const aberto = () => estado().aberto;

  /* ---------- Ações (administrador) ---------- */
  const abrir = ({ fundo, motoboys = {}, garcons = {} }) => Fomito.acao("POST", "/caixa/abrir", { fundo, motoboys, garcons });

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
  const fechar = ({ contado, credito, debito, obs = "" }) => Fomito.acao("POST", "/caixa/fechar", { contado, credito, debito, obs });

  const FORMAS = { dinheiro: "Dinheiro", pix: "Pix", credito: "Cartão de crédito", debito: "Cartão de débito" };
  /* Para mostrar (o convênio não é escolhido no caixa: vem do pedido ou da comanda) */
  const FORMAS_TODAS = { ...FORMAS, convenio: "Convênio" };
  /* Nomes que aparecem na tela (simples, para qualquer um entender) */
  const NOMES = { sangria: "Tirar dinheiro", suprimento: "Colocar dinheiro", fundo: "Dinheiro inicial" };

  Fomito.caixa = { estado, aberto, abrir, registrar, corrigir, correcoes, fechar, resumo, FORMAS, FORMAS_TODAS, NOMES };
})();
