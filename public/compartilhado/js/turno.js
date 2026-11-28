/* ==========================================================================
   FOMITO · CAIXA DO TURNO (painel, garçom e motoboy)
   --------------------------------------------------------------------------
   Regra (ajuste 61): o cliente pede sempre, mas a equipe só mexe nos pedidos
   com o caixa aberto.
     • Caixa fechado   → ninguém aceita, prepara, serve, lança nem despacha.
     • Caixa de ontem  → (não foi fechado) não aceita nada novo até fechar
                         esse caixa ou juntar com o de hoje. O que já estava
                         em andamento termina (pronto, servir, entregar, conta).
     • Motoboy         → só sai para entrega com a bolsa dele aberta no caixa.
     • Fim do expediente com o caixa aberto → aviso "Faltou fechar o caixa".

   O servidor manda a situação em Fomito.estado.caixa.turno e é ele quem
   bloqueia de verdade. Aqui é só para avisar antes e mostrar a faixa.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  const situacao = () => Fomito.estado.caixa?.turno || { caixa: Fomito.estado.caixa?.aberto ? "aberto" : "fechado", dias: [] };

  /* Quem lê o aviso: a loja (painel) abre o caixa; garçom e motoboy pedem a quem cuida do caixa */
  const daLoja = () => ["admin", "atendente"].includes(Fomito.estado.sessao?.perfil);

  const TEXTOS = {
    fechadoLoja: "O caixa ainda não foi aberto. Abra o caixa para aceitar e mexer nos pedidos.",
    fechadoEquipe: "O caixa ainda não foi aberto. Peça ao responsável para abrir o caixa no painel.",
    atrasadoLoja: (s) => `O caixa de ${s.diaDoCaixa} não foi fechado. Feche esse caixa ou junte com o de hoje para aceitar pedidos.`,
    atrasadoEquipe: (s) => `O caixa de ${s.diaDoCaixa} não foi fechado. Peça ao responsável para fechar ou juntar com o de hoje no painel.`,
    semBolsa: "Sua bolsa ainda não foi aberta. Peça ao responsável para abrir sua bolsa no Caixa do painel antes de sair para entrega.",
  };

  /**
   * O que impede a ação agora (texto) ou null se pode.
   *   novo: true para COMEÇAR algo (aceitar, lançar, sair para entrega): pede o caixa de hoje
   *   bolsa: true para o motoboy sair (pede a bolsa dele aberta)
   */
  function bloqueio({ novo = false, bolsa = false } = {}) {
    const s = situacao();
    const loja = daLoja();
    if (s.caixa === "fechado") return loja ? TEXTOS.fechadoLoja : TEXTOS.fechadoEquipe;
    if (novo && s.caixa === "atrasado") return loja ? TEXTOS.atrasadoLoja(s) : TEXTOS.atrasadoEquipe(s);
    if (bolsa && Fomito.estado.caixa?.temBolsa === false) return TEXTOS.semBolsa;
    return null;
  }

  /** Confere antes de mandar para o servidor: se não pode, mostra o motivo e balança a faixa do aviso */
  function conferir(opcoes) {
    const motivo = bloqueio(opcoes);
    if (!motivo) return true;
    Fomito.toast?.(motivo, "cadeado");
    const faixa = document.querySelector(".aviso-turno");
    if (faixa) { faixa.classList.remove("aviso-turno--chamar"); void faixa.offsetWidth; faixa.classList.add("aviso-turno--chamar"); }
    return false;
  }

  /* "Faltou fechar o caixa": o fim do expediente de hoje, como "23h30" */
  const horaFim = (s) => (s.fecha ? s.fecha.replace(/^0/, "").replace(":00", "h").replace(":", "h") : "");

  /**
   * A faixa de aviso (HTML) ou "" quando está tudo certo.
   * acoes: botões extras (só o painel tem: abrir, fechar, juntar)
   */
  function faixa({ titulo, texto, tipo = "alerta", icone = "cadeado", acoes = "" }) {
    return `
      <div class="aviso-turno aviso-turno--${tipo}" role="alert">
        <span class="aviso-turno__icone">${Fomito.icone(icone)}</span>
        <div class="aviso-turno__texto"><b>${titulo}</b><span>${texto}</span></div>
        ${acoes ? `<div class="aviso-turno__acoes">${acoes}</div>` : ""}
      </div>`;
  }

  Fomito.turno = { situacao, bloqueio, conferir, faixa, horaFim, TEXTOS };
})();
