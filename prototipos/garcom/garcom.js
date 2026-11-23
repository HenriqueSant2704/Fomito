/* ==========================================================================
   FOMITO · TELA DO GARÇOM (lógica do protótipo)
   --------------------------------------------------------------------------
   Organização:
     1. Estado (mesas fictícias)
     2. Lista de mesas
     3. Comanda da mesa
     4. Lançar itens
     5. Fechar conta
     6. Início
   ========================================================================== */

const { dados, moeda, icone, $, $$, toast, sessao } = Fomito;

/* Garçom e administrador podem usar as comandas */
const usuarioLogado = sessao.exigir("garcom", "admin");

/* ---------- 1. ESTADO ---------- */
/* status: "livre" | "ocupada" | "conta" (cliente pediu a conta) */
const mesas = Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, status: "livre", pessoas: 0, desde: null, itens: [] }));

function ocupar(numero, pessoas, minutos, itens, status = "ocupada") {
  Object.assign(mesas[numero - 1], {
    status, pessoas, desde: minutos,
    itens: itens.map(([id, qtd, entregue = true]) => ({ id, qtd, entregue })),
  });
}
ocupar(2, 4, 48, [[3, 2], [6, 1], [13, 4]], "conta");
ocupar(3, 2, 25, [[1, 1], [2, 1], [10, 2]]);
ocupar(5, 3, 12, [[7, 1], [11, 3, false]]);
ocupar(7, 2, 5,  [[2, 2, false], [10, 2]]);
ocupar(9, 6, 70, [[8, 2], [9, 1], [13, 8]], "conta");
ocupar(11, 1, 18, [[5, 1], [12, 1]]);

const estado = { filtro: "todas", mesaAtual: null };

const totalMesa = (m) => Fomito.totalItens(m.itens);
const rotulo = { livre: "Livre", ocupada: "Ocupada", conta: "Conta" };
const corTag = { livre: "cinza", ocupada: "roxo", conta: "laranja" };

/* ---------- 2. LISTA DE MESAS ---------- */
function renderFiltros() {
  const conta = (s) => mesas.filter((m) => s === "todas" || m.status === s).length;
  const filtros = [["todas", "Todas"], ["livre", "Livres"], ["ocupada", "Ocupadas"], ["conta", "Pediram a conta"]];
  $("#filtros").innerHTML = filtros
    .map(([id, nome]) => `<button class="filtro ${estado.filtro === id ? "ativo" : ""}" data-filtro="${id}">${nome} <small>${conta(id)}</small></button>`)
    .join("");

  const ocupadas = mesas.filter((m) => m.status !== "livre").length;
  $("#resumoMesas").textContent = `${ocupadas} de ${mesas.length} mesas em atendimento`;
}

function renderMesas() {
  $("#grade").innerHTML = mesas
    .filter((m) => estado.filtro === "todas" || m.status === estado.filtro)
    .map((m) => `
      <button class="mesa mesa--${m.status} ${estado.mesaAtual === m.numero ? "selecionada" : ""}" data-mesa="${m.numero}">
        <span class="mesa__cabeca">
          <span><span class="mesa__rotulo">Mesa</span><span class="mesa__numero">${String(m.numero).padStart(2, "0")}</span></span>
          <span class="tag tag--${corTag[m.status]}">${rotulo[m.status]}</span>
        </span>
        <span class="mesa__rodape">
          ${m.status === "livre"
            ? `<span class="pequeno fraco">Disponível</span>`
            : `<span class="mesa__meta"><span>${icone("pessoas")}${m.pessoas}</span><span>${icone("relogio")}${m.desde} min</span></span><span class="mesa__valor">${moeda(totalMesa(m))}</span>`}
        </span>
      </button>`)
    .join("");
}

$("#filtros").addEventListener("click", (e) => {
  const f = e.target.closest("[data-filtro]");
  if (!f) return;
  estado.filtro = f.dataset.filtro;
  renderFiltros();
  renderMesas();
});

$("#grade").addEventListener("click", (e) => {
  const card = e.target.closest("[data-mesa]");
  if (!card) return;
  estado.mesaAtual = Number(card.dataset.mesa);
  renderMesas();
  renderComanda();
});

/* ---------- 3. COMANDA ---------- */
function renderComanda() {
  const m = mesas[estado.mesaAtual - 1];
  const painel = $("#comanda");
  painel.classList.add("aberta");

  const itensHtml = m.itens.length
    ? m.itens.map((item) => {
        const p = Fomito.produto(item.id);
        return `
          <div class="linha-item">
            ${Fomito.foto(p, 40)}
            <div class="linha-item__info">
              <div class="forte">${item.qtd}× ${p.nome}</div>
              <span class="tag ${item.entregue ? "tag--verde" : "tag--amarelo"}">${item.entregue ? "Entregue" : "Na cozinha"}</span>
            </div>
            <span class="preco">${moeda(p.preco * item.qtd)}</span>
          </div>`;
      }).join("")
    : `<div class="comanda__vazia"><span class="vazio__icone">${icone("pedidos", "ic--lg")}</span><p class="suave">Comanda vazia.<br>Lance o primeiro pedido da mesa.</p></div>`;

  painel.innerHTML = `
    <div class="comanda__topo">
      <div class="pilha">
        <span class="rotulo">Comanda</span>
        <h2>Mesa ${String(m.numero).padStart(2, "0")}</h2>
        <span class="pequeno suave">${m.status === "livre" ? "Mesa livre" : `${m.pessoas} pessoas · aberta há ${m.desde} min`}</span>
      </div>
      <span class="tag tag--${corTag[m.status]}">${rotulo[m.status]}</span>
      <button class="btn-icone comanda__fechar-painel" id="voltarMesas" aria-label="Voltar">${icone("fechar")}</button>
    </div>
    <div class="comanda__itens">${itensHtml}</div>
    <div class="comanda__rodape">
      <div class="entre"><span class="forte">Total da mesa</span><span class="preco comanda__total">${moeda(totalMesa(m))}</span></div>
      <div class="comanda__acoes">
        <button class="btn btn--contorno" id="btnLancar">${icone("mais", "ic--sm")} Lançar itens</button>
        <button class="btn btn--primario" id="btnFechar" ${m.itens.length ? "" : "disabled"}>Fechar conta</button>
      </div>
    </div>`;

  $("#btnLancar").onclick = () => abrirLancamento(m);
  $("#btnFechar").onclick = () => abrirFechamento(m);
  $("#voltarMesas").onclick = () => painel.classList.remove("aberta");
}

/* ---------- 4. LANÇAR ITENS ---------- */
function abrirLancamento(mesa) {
  const pedido = {};               // { idProduto: qtd }
  let categoria = dados.categorias[0].id;

  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  document.body.appendChild(camada);

  function render() {
    const qtdTotal = Object.values(pedido).reduce((s, q) => s + q, 0);
    camada.innerHTML = `
      <div class="folha lancar">
        <div class="folha__topo"><h2>Lançar itens · Mesa ${String(mesa.numero).padStart(2, "0")}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
        <nav class="abas">${dados.categorias.map((c) => `<button class="aba ${c.id === categoria ? "ativo" : ""}" data-cat="${c.id}">${c.nome}</button>`).join("")}</nav>
        <div class="lancar__lista">
          ${dados.produtos.filter((p) => p.cat === categoria).map((p) => `
            <div class="lancar__produto ${pedido[p.id] ? "tem" : ""}">
              ${Fomito.foto(p, 44)}
              <div style="flex:1;min-width:0"><div class="forte">${p.nome}</div><span class="pequeno suave num">${moeda(p.preco)}</span></div>
              <div class="qtd"><button data-id="${p.id}" data-q="-1" aria-label="Diminuir">${icone("menos", "ic--sm")}</button><span>${pedido[p.id] || 0}</span><button data-id="${p.id}" data-q="1" aria-label="Aumentar">${icone("mais", "ic--sm")}</button></div>
            </div>`).join("")}
        </div>
        <button class="btn btn--primario btn--bloco" data-enviar ${qtdTotal ? "" : "disabled"}>Enviar para a cozinha${qtdTotal ? ` · ${qtdTotal} ${qtdTotal > 1 ? "itens" : "item"}` : ""}</button>
      </div>`;
  }
  render();

  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return camada.remove();
    const cat = e.target.closest("[data-cat]");
    if (cat) { categoria = cat.dataset.cat; return render(); }
    const q = e.target.closest("[data-q]");
    if (q) {
      const id = Number(q.dataset.id);
      pedido[id] = Math.max(0, (pedido[id] || 0) + Number(q.dataset.q));
      return render();
    }
    if (e.target.closest("[data-enviar]")) {
      Object.entries(pedido).filter(([, qtd]) => qtd > 0)
        .forEach(([id, qtd]) => mesa.itens.push({ id: Number(id), qtd, entregue: false }));
      if (mesa.status === "livre") Object.assign(mesa, { status: "ocupada", pessoas: 2, desde: 0 });
      camada.remove();
      atualizarTudo();
      toast(`Pedido da mesa ${mesa.numero} enviado para a cozinha`, "chama");
    }
  });
}

/* ---------- 5. FECHAR CONTA ---------- */
function abrirFechamento(mesa) {
  const conta = { pessoas: 1, forma: "dinheiro", recebido: "", taxaServico: true };

  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  document.body.appendChild(camada);

  const totalFinal = () => totalMesa(mesa) * (conta.taxaServico ? 1.1 : 1);

  function blocoTroco() {
    if (conta.forma !== "dinheiro" || !conta.recebido) return "";
    const recebido = parseFloat(conta.recebido.replace(",", ".")) || 0;
    const falta = totalFinal() - recebido;
    return falta > 0
      ? `<div class="troco-caixa erro"><span>Faltam</span><strong class="num">${moeda(falta)}</strong></div>`
      : `<div class="troco-caixa"><span>Troco a devolver</span><strong class="num">${moeda(-falta)}</strong></div>`;
  }

  function render() {
    camada.innerHTML = `
      <div class="folha conta">
        <div class="folha__topo"><h2>Fechar conta · Mesa ${String(mesa.numero).padStart(2, "0")}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>

        <div class="conta__total">
          <span class="rotulo">Total a pagar</span>
          <span class="preco">${moeda(totalFinal())}</span>
          <span class="pequeno suave num">Consumo ${moeda(totalMesa(mesa))}${conta.taxaServico ? ` + serviço (10%) ${moeda(totalMesa(mesa) * 0.1)}` : ""}</span>
        </div>

        <label class="check"><input type="checkbox" data-servico ${conta.taxaServico ? "checked" : ""}> Incluir 10% de serviço</label>

        <div class="divisao card">
          <div><div class="forte">Dividir a conta</div><div class="pequeno suave">${conta.pessoas > 1 ? `${moeda(totalFinal() / conta.pessoas)} por pessoa` : "Uma pessoa paga tudo"}</div></div>
          <div class="qtd"><button data-p="-1" aria-label="Menos pessoas">${icone("menos", "ic--sm")}</button><span>${conta.pessoas}</span><button data-p="1" aria-label="Mais pessoas">${icone("mais", "ic--sm")}</button></div>
        </div>

        <div class="campo"><label>Forma de pagamento</label>
          <div class="formas">
            ${dados.formasPagamento.map((f) => `
              <button class="opcao ${conta.forma === f.id ? "ativa" : ""}" data-forma="${f.id}">
                <span class="opcao__icone">${icone(f.icone, "ic--sm")}</span><span class="opcao__titulo pequeno">${f.nome}</span>
              </button>`).join("")}
          </div>
        </div>

        ${conta.forma === "dinheiro" ? `
          <div class="campo"><label>Valor recebido</label>
            <input class="input" id="recebido" data-recebido inputmode="decimal" placeholder="R$ 0,00" value="${conta.recebido}">
          </div>
          <div id="caixaTroco">${blocoTroco()}</div>` : ""}

        <button class="btn btn--primario btn--bloco" data-confirmar>${icone("check", "ic--sm")} Confirmar pagamento e liberar mesa</button>
      </div>`;
  }
  render();

  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return camada.remove();
    const p = e.target.closest("[data-p]");
    if (p) { conta.pessoas = Math.max(1, conta.pessoas + Number(p.dataset.p)); return render(); }
    const f = e.target.closest("[data-forma]");
    if (f) { conta.forma = f.dataset.forma; return render(); }
    if (e.target.closest("[data-confirmar]")) {
      Object.assign(mesa, { status: "livre", pessoas: 0, desde: null, itens: [] });
      camada.remove();
      atualizarTudo();
      toast(`Mesa ${mesa.numero} paga e liberada`);
    }
  });
  camada.addEventListener("change", (e) => {
    if (e.target.matches("[data-servico]")) { conta.taxaServico = e.target.checked; render(); }
  });
  camada.addEventListener("input", (e) => {
    if (e.target.matches("[data-recebido]")) {
      conta.recebido = e.target.value;
      $("#caixaTroco", camada).innerHTML = blocoTroco();
    }
  });
}

/* ---------- 6. INÍCIO ---------- */
function atualizarTudo() {
  renderFiltros();
  renderMesas();
  if (estado.mesaAtual) renderComanda();
}

$("#logo").innerHTML = Fomito.logo();
if (usuarioLogado) {
  $("#nomeGarcom").textContent = usuarioLogado.nome;
  $("#perfilGarcom").textContent = usuarioLogado.perfil === "admin" ? "Administrador" : "Garçom";
  $("#avatarGarcom").textContent = usuarioLogado.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  $("#voltarPainel").hidden = usuarioLogado.perfil !== "admin";
}
$("#btnSair").addEventListener("click", () => sessao.sair());
atualizarTudo();
