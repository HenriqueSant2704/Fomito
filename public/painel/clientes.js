/* ==========================================================================
   FOMITO · PAINEL › CLIENTES
   --------------------------------------------------------------------------
   Carregado antes do painel.js. Mostra quem já pediu pelo cardápio:
   o cadastro nasce sozinho quando o cliente informa o celular no
   finalizar pedido (veja compartilhado/js/clientes.js).
     1. Lista com indicadores e busca
     2. Ficha do cliente (endereços e histórico)
   ========================================================================== */

let buscaClientes = "";

/* ---------- 1. LISTA ---------- */
function renderClientes() {
  const todos = Fomito.clientes.lista();
  const termo = buscaClientes.toLowerCase();
  const digitos = Fomito.clientes.soDigitos(buscaClientes);
  const lista = todos
    .filter((c) => c.nome.toLowerCase().includes(termo) || (digitos && c.telefone.includes(digitos)))
    .sort((a, b) => b.pedidos - a.pedidos);
  const recorrentes = todos.filter((c) => c.pedidos > 1).length;
  const gasto = todos.reduce((s, c) => s + c.gasto, 0);
  const pedidosTotal = todos.reduce((s, c) => s + c.pedidos, 0);

  $('[data-secao="clientes"].secao').innerHTML = `
    <div class="kpis">
      <div class="card kpi"><span class="kpi__rotulo">Clientes cadastrados ${icone("pessoas", "ic--sm")}</span><span class="kpi__valor">${todos.length}</span><span class="variacao bom"><b>+3</b> esta semana</span></div>
      <div class="card kpi"><span class="kpi__rotulo">Voltam a pedir ${icone("sobe", "ic--sm")}</span><span class="kpi__valor">${Math.round((recorrentes / todos.length) * 100)}%</span><span class="variacao">pediram mais de uma vez</span></div>
      <div class="card kpi"><span class="kpi__rotulo">Ticket médio ${icone("moeda", "ic--sm")}</span><span class="kpi__valor">${moeda(pedidosTotal ? gasto / pedidosTotal : 0)}</span><span class="variacao">por pedido de entrega</span></div>
      <div class="card kpi"><span class="kpi__rotulo">Endereços salvos ${icone("pin", "ic--sm")}</span><span class="kpi__valor">${todos.reduce((s, c) => s + c.enderecos.length, 0)}</span><span class="variacao">o cliente escolhe a cada pedido</span></div>
    </div>

    <div class="card painel-card">
      <div class="painel-card__topo">
        <h3>Todos os clientes</h3>
        <label class="busca-painel">${icone("busca", "ic--sm")}<input id="buscaClientes" placeholder="Nome ou telefone" value="${buscaClientes}"></label>
      </div>
      <div class="tabela-rolagem">
        <table class="tabela">
          <thead><tr><th>Cliente</th><th>Telefone</th><th>Endereços</th><th class="dir">Pedidos</th><th class="dir">Total gasto</th><th>Último pedido</th><th></th></tr></thead>
          <tbody>
            ${lista.map((c) => `
              <tr class="linha-clicavel" data-cliente="${c.telefone}">
                <td><div class="linha" style="gap:10px"><span class="avatar" style="width:34px;height:34px;font-size:12px">${iniciais(c.nome)}</span><div class="pilha" style="gap:0"><span class="forte">${c.nome}</span><span class="pequeno fraco">Cliente desde ${c.desde}</span></div></div></td>
                <td class="num">${Fomito.clientes.formatarTelefone(c.telefone)}</td>
                <td><span class="linha suave pequeno" style="gap:5px">${icone("pin", "ic--sm")}${c.enderecos.length}</span></td>
                <td class="dir num">${c.pedidos}</td>
                <td class="dir num">${moeda(c.gasto)}</td>
                <td class="suave">${c.ultimo}</td>
                <td class="dir">${icone("seta", "ic--sm")}</td>
              </tr>`).join("") || `<tr><td colspan="7" class="suave" style="text-align:center;padding:28px">Nenhum cliente encontrado.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ---------- 2. FICHA DO CLIENTE ---------- */
function abrirCliente(telefone) {
  const c = Fomito.clientes.buscar(telefone);
  const historico = Fomito.pedidos.lista().filter((p) => p.telefone && Fomito.clientes.soDigitos(p.telefone) === c.telefone);
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--lado";
  camada.innerHTML = `
    <div class="folha folha--lado">
      <div class="folha__topo">
        <div class="linha" style="gap:12px"><span class="avatar">${iniciais(c.nome)}</span><div class="pilha" style="gap:0"><h2>${c.nome}</h2><span class="pequeno suave">Cliente desde ${c.desde}</span></div></div>
        <button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button>
      </div>

      <div class="mini-kpis">
        <div><span class="pequeno suave">Pedidos</span><strong>${c.pedidos}</strong></div>
        <div><span class="pequeno suave">Total gasto</span><strong>${moeda(c.gasto)}</strong></div>
        <div><span class="pequeno suave">Último</span><strong>${c.ultimo}</strong></div>
      </div>

      <div class="ficha-bloco">
        <span class="rotulo">Contato</span>
        <div class="entre"><span class="linha" style="gap:8px">${icone("telefone", "ic--sm")}<span class="num">${Fomito.clientes.formatarTelefone(c.telefone)}</span></span>
          <a class="btn btn--contorno btn--sm" href="https://wa.me/55${c.telefone}" target="_blank" rel="noopener">${icone("whatsapp", "ic--sm")} WhatsApp</a></div>
      </div>

      <div class="ficha-bloco">
        <span class="rotulo">Endereços salvos (${c.enderecos.length})</span>
        ${c.enderecos.map((e) => `
          <div class="endereco-ficha">
            <span class="opcao__icone">${icone("pin", "ic--sm")}</span>
            <div class="pilha" style="gap:0"><span class="forte">${e.apelido}</span><span class="pequeno suave">${Fomito.clientes.textoEndereco(e)}${e.ref ? ` · Ref.: ${e.ref}` : ""}</span></div>
          </div>`).join("")}
      </div>

      <div class="ficha-bloco">
        <span class="rotulo">Pedidos de hoje</span>
        ${historico.map((p) => `<div class="entre pequeno"><span><b class="num">#${p.num}</b> · ${p.itens.length} itens</span><span class="linha" style="gap:8px">${tagStatus(p.status)}<span class="num">${moeda(totalPedido(p))}</span></span></div>`).join("")
          || `<p class="pequeno fraco">Nenhum pedido hoje. O histórico completo vem do banco no sistema real.</p>`}
      </div>
    </div>`;
  document.body.appendChild(camada);
  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) camada.remove();
  });
}

document.addEventListener("click", (e) => {
  const linha = e.target.closest("[data-cliente]");
  if (linha) abrirCliente(linha.dataset.cliente);
});
document.addEventListener("input", (e) => {
  if (e.target.id !== "buscaClientes") return;
  buscaClientes = e.target.value;
  renderClientes();
  const campo = $("#buscaClientes");
  campo.focus();
  campo.setSelectionRange(campo.value.length, campo.value.length);
});
