/* ==========================================================================
   FOMITO · PORTAL (lógica do login)
   Admin → painel. Garçom → comandas.
   ========================================================================== */

const { $, $$, sessao } = Fomito;

$("#logo").innerHTML = Fomito.logo();
$("#logoClaro").innerHTML = Fomito.logo(true);

/* Se já estiver logado, segue direto para a tela do perfil */
const logado = sessao.atual();
if (logado) location.replace(sessao.destino(logado.perfil));

$("#formLogin").addEventListener("submit", (e) => {
  e.preventDefault();
  const usuario = sessao.entrar($("#usuario").value, $("#senha").value);
  if (!usuario) {
    $("#erro").textContent = "Usuário ou senha incorretos. Confira e tente de novo.";
    $("#erro").hidden = false;
    return;
  }
  location.href = sessao.destino(usuario.perfil);
});

$("#verSenha").addEventListener("click", () => {
  const campo = $("#senha");
  campo.type = campo.type === "password" ? "text" : "password";
  $("#verSenha").textContent = campo.type === "password" ? "Mostrar" : "Ocultar";
});

/* Atalhos de teste: preenche usuário e senha */
$$("[data-u]").forEach((b) =>
  b.addEventListener("click", () => {
    $("#usuario").value = b.dataset.u;
    $("#senha").value = "1234";
    $("#erro").hidden = true;
  })
);
