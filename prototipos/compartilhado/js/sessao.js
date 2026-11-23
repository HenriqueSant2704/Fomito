/* ==========================================================================
   FOMITO · LOGIN E PERFIS (simulado no navegador)
   --------------------------------------------------------------------------
   Perfis:
     admin  → dono/gerente: acessa o PAINEL (e as comandas)
     garcom → acessa só as COMANDAS (não vê o painel)
   No protótipo os usuários ficam guardados no navegador (localStorage).
   No sistema real isso vira tabela no Neon + senha criptografada no Node.js.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  const CHAVE_USUARIOS = "fomito.usuarios";
  const CHAVE_SESSAO = "fomito.sessao";
  let memoria = {}; // reserva, caso o navegador bloqueie o armazenamento

  const ler = (chave, padrao) => {
    try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; }
    catch { return memoria[chave] ?? padrao; }
  };
  const gravar = (chave, valor) => {
    memoria[chave] = valor;
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* segue só em memória */ }
  };

  const usuariosIniciais = [
    { nome: "Zé Silva", usuario: "admin", senha: "1234", perfil: "admin" },
    { nome: "Carlos Mendes", usuario: "carlos", senha: "1234", perfil: "garcom" },
  ];

  Fomito.sessao = {
    usuarios: () => ler(CHAVE_USUARIOS, usuariosIniciais),

    criarUsuario(novo) {
      const lista = this.usuarios();
      if (lista.some((u) => u.usuario === novo.usuario)) return "Já existe alguém com esse usuário.";
      gravar(CHAVE_USUARIOS, [...lista, novo]);
      return null;
    },

    removerUsuario(usuario) {
      gravar(CHAVE_USUARIOS, this.usuarios().filter((u) => u.usuario !== usuario));
    },

    /* Retorna o usuário logado ou null */
    entrar(usuario, senha) {
      const u = this.usuarios().find((x) => x.usuario === usuario.trim().toLowerCase() && x.senha === senha);
      if (u) gravar(CHAVE_SESSAO, { nome: u.nome, usuario: u.usuario, perfil: u.perfil });
      return u || null;
    },

    atual: () => ler(CHAVE_SESSAO, null),

    sair() {
      gravar(CHAVE_SESSAO, null);
      location.href = "../cliente/index.html";
    },

    /* Para onde cada perfil vai depois do login */
    destino: (perfil) => (perfil === "admin" ? "../painel/index.html" : "../garcom/index.html"),

    /* Protege uma tela: se o perfil não puder entrar, volta para o Portal */
    exigir(...perfisPermitidos) {
      const s = this.atual();
      if (!s || !perfisPermitidos.includes(s.perfil)) {
        location.replace("../portal/index.html");
        return null;
      }
      return s;
    },
  };
})();
