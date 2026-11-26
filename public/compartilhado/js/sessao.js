/* ==========================================================================
   FOMITO · LOGIN E PERFIS
   --------------------------------------------------------------------------
   Perfis:
     admin     → dono/gerente: acessa o PAINEL inteiro (e as comandas e entregas)
     atendente → balcão/expedição: pedidos, comandas, caixa e clientes no painel
     garcom  → acessa só as COMANDAS (não vê o painel)
     motoboy → acessa só as ENTREGAS (não vê o painel)
   Os usuários ficam no banco (Neon), com a senha criptografada no servidor.
   A sessão é um cookie protegido: o navegador não consegue ler nem alterar.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  /* Tipos de funcionário que o administrador pode criar */
  const PERFIS = {
    admin:     { nome: "Administrador", cor: "roxo",    tela: "../painel/" },
    atendente: { nome: "Atendente",     cor: "amarelo", tela: "../painel/" },
    garcom:  { nome: "Garçom",        cor: "laranja", tela: "../garcom/" },
    motoboy: { nome: "Motoboy",       cor: "verde",   tela: "../motoboy/" },
  };

  Fomito.sessao = {
    PERFIS,
    usuarios: () => Fomito.estado.usuarios || [],

    /** Cria o acesso. Retorna null se deu certo ou a mensagem de erro. */
    async criarUsuario(novo) {
      try { await Fomito.acao("POST", "/usuarios", novo); return null; }
      catch (err) { return err.message; }
    },

    removerUsuario: (usuario) => Fomito.acao("DELETE", `/usuarios/${encodeURIComponent(usuario)}`),

    /** Retorna o usuário logado ou a mensagem de erro (texto) */
    async entrar(usuario, senha) {
      try { return await Fomito.api("POST", "/login", { usuario, senha }); }
      catch (err) { return err.message; }
    },

    atual: () => Fomito.estado.sessao,

    async sair() {
      await Fomito.api("POST", "/logout").catch(() => {});
      location.href = "../cliente/";
    },

    /* Para onde cada perfil vai depois do login */
    destino: (perfil) => (PERFIS[perfil] || PERFIS.garcom).tela,

    /* Protege uma tela: se o perfil não puder entrar, volta para o Portal */
    exigir(...perfisPermitidos) {
      const s = this.atual();
      if (!s || !perfisPermitidos.includes(s.perfil)) {
        location.replace("../portal/");
        throw new Error("Acesso restrito: voltando ao Portal."); // para de montar a tela
      }
      return s;
    },
  };
})();
