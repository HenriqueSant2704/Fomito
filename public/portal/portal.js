/* ==========================================================================
   FOMITO · PORTAL (login da equipe)
   Admin → painel. Garçom → comandas. Motoboy → entregas.
   ========================================================================== */

const { $, sessao } = Fomito;

$("#logo").innerHTML = Fomito.logo();
$("#logoClaro").innerHTML = Fomito.logo(true);

/* Se já estiver logado, segue direto para a tela do perfil */
const logado = sessao.atual();
if (logado) location.replace(sessao.destino(logado.perfil));

$("#formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const botao = $("#formLogin [type=submit]");
  botao.disabled = true;
  const r = await sessao.entrar($("#usuario").value, $("#senha").value);
  botao.disabled = false;
  if (typeof r === "string") {
    $("#erro").textContent = r;
    $("#erro").hidden = false;
    return;
  }
  location.href = sessao.destino(r.perfil);
});

$("#verSenha").addEventListener("click", () => {
  const campo = $("#senha");
  campo.type = campo.type === "password" ? "text" : "password";
  $("#verSenha").textContent = campo.type === "password" ? "Mostrar" : "Ocultar";
});
