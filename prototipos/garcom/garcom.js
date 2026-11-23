/* ==========================================================================
   PRONTITO · TELA DO GARÇOM (lógica do protótipo)
   --------------------------------------------------------------------------
   Organização:
     1. Estado (mesas fictícias)
     2. Lista de mesas
     3. Comanda da mesa
     4. Lançar itens
     5. Fechar conta
     6. Início
   ========================================================================== */

const { dados, moeda, $, $$, toast } = Prontito;

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

const totalMesa = (m) => Prontito.totalItens(m.itens);
const rotulo = { livre: "Livre", ocupada: "Ocupada", conta: "Pediu a conta" };
const corTag = { livre: "cinza", ocupada: "roxo", conta: "laranja" };

/* ---------- 2. LISTA DE MESAS ---------- */
function renderFiltros() {
  const conta = (s) => mesas.filter((m) => s === "todas" || m.status === s).length;
  const filtros = [["todas", "Todas"], ["livre", "Livres"], ["ocupada", "Ocupadas"], ["conta", "Pediram a conta"]];
  $("#filtros").innerHTML = filtros
    .map(([id, nome]) => `<button class="chip ${estado.filtro === id ? "ativo" : ""}" data-filtro="${id}">${nome} · ${conta(id)}</button>`)
    .join("");

  const ocupadas = mesas.filter((m) => m.status !== "livre").length;
  $("#resumoMesas").textContent = `${ocupadas} de ${mesas.length} mesas em atendimento`;
}

function renderMesas() {
  $("#grade").innerHTML = mesas
    .filter((m) => estado.filtro === "todas" || m.status === estado.filtro)
    .map((m) => `
      <button class="mesa mesa--${m.status} ${estado.mesaAtual === m.numero ? "selecionada" : ""}" data-mesa="${m.numero}">
        <span class="mesa__numero"><small>Mesa</small>${String(m.numero).padStart(2, "0")}</span>
        <span class="tag tag--${corTag[m.status]}">${rotulo[m.status]}</span>
        <span class="mesa__rodape">
          ${m.status === "livre"
            ? `<span class="suave">Toque para abrir</span>`
            : `<span class="suave">👥 ${m.pessoas} · ⏱ ${m.desde} min</span><span class="preco">${moeda(totalMesa(m))}</span>`}
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
        const p = Prontito.produto(item.id);
        return `
          <div class="linha-item">
            <div class="foto foto--${p.cat}">${p.emoji}</div>
            <div class="linha-item__info">
              <div class="forte">${item.qtd}× ${p.nome}</div>
              <span class="tag ${item.entregue ? "tag--verde" : "tag--amarelo"}">${item.entregue ? "Entregue" : "Na cozinha"}</span>
            </div>
            <span class="forte">${moeda(p.preco * item.qtd)}</span>
          </div>`;
      }).join("")
    : `<div class="comanda__vazia"><div style="font-size:44px">📝</div><p class="suave">Comanda vazia.<br>Lance o primeiro pedido da mesa.</p></div>`;

  painel.innerHTML = `
    <div class="comanda__topo">
      <div class="pilha" style="gap:4px">
        <span class="pequeno" style="opacity:.8">Comanda</span>
        <h2>Mesa ${String(m.numero).padStart(2, "0")}</h2>
        <span class="pequeno" style="opacity:.85">${m.status === "livre" ? "Mesa livre" : `👥 ${m.pessoas} pessoas · aberta há ${m.desde} min`}</span>
      </div>
      <button class="btn-icone comanda__fechar-painel" id="voltarMesas" aria-label="Voltar">✕</button>
    </div>
    <div class="comanda__itens">${itensHtml}</div>
    <div class="comanda__rodape">
      <div class="entre"><span class="forte">Total da mesa</span><span class="preco comanda__total">${moeda(totalMesa(m))}</span></div>
      <div class="comanda__acoes">
        <button class="btn btn--suave" id="btnLancar">＋ Lançar itens</button>
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
        <div class="entre"><h2>Lançar na mesa ${mesa.numero}</h2><button class="btn-icone" data-fechar>✕</button></div>
        <nav class="chips">${dados.categorias.map((c) => `<button class="chip ${c.id === categoria ? "ativo" : ""}" data-cat="${c.id}">${c.icone} ${c.nome}</button>`).join("")}</nav>
        <div class="lancar__lista">
          ${dados.produtos.filter((p) => p.cat === categoria).map((p) => `
            <div class="lancar__produto ${pedido[p.id] ? "tem" : ""}">
              <div class="foto foto--${p.cat}">${p.emoji}</div>
              <div style="flex:1"><div class="forte">${p.nome}</div><span class="preco pequeno">${moeda(p.preco)}</span></div>
              <div class="qtd"><button data-id="${p.id}" data-q="-1">−</button><span>${pedido[p.id] || 0}</span><button data-id="${p.id}" data-q="1">+</button></div>
            </div>`).join("")}
        </div>
        <button class="btn btn--primario btn--bloco" data-enviar ${qtdTotal ? "" : "disabled"}>🔥 Enviar para a cozinha ${qtdTotal ? `(${qtdTotal})` : ""}</button>
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
      toast(`Pedido da mesa ${mesa.numero} enviado para a cozinha`, "🔥");
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
      ? `<div class="troco-caixa erro">Faltam ${moeda(falta)}</div>`
      : `<div class="troco-caixa">💵 Troco a devolver: ${moeda(-falta)}</div>`;
  }

  function render() {
    camada.innerHTML = `
      <div class="folha conta">
        <div class="entre"><h2>Fechar mesa ${mesa.numero}</h2><button class="btn-icone" data-fechar>✕</button></div>

        <div class="conta__total">
          <span class="suave pequeno">Total a pagar</span>
          <span class="preco">${moeda(totalFinal())}</span>
          <span class="pequeno suave">Consumo ${moeda(totalMesa(mesa))}${conta.taxaServico ? ` + 10% serviço ${moeda(totalMesa(mesa) * 0.1)}` : ""}</span>
        </div>

        <label class="check"><input type="checkbox" data-servico ${conta.taxaServico ? "checked" : ""}> Incluir 10% de serviço</label>

        <div class="divisao card" style="padding:12px 14px">
          <div><div class="forte">Dividir a conta</div><div class="pequeno suave">${conta.pessoas > 1 ? `${moeda(totalFinal() / conta.pessoas)} por pessoa` : "Uma pessoa paga tudo"}</div></div>
          <div class="qtd"><button data-p="-1">−</button><span>${conta.pessoas}</span><button data-p="1">+</button></div>
        </div>

        <div class="campo"><label>Forma de pagamento</label>
          <div class="formas">
            ${dados.formasPagamento.map((f) => `
              <button class="opcao ${conta.forma === f.id ? "ativa" : ""}" data-forma="${f.id}">
                <span class="opcao__icone">${f.icone}</span><span class="opcao__titulo pequeno">${f.nome}</span>
              </button>`).join("")}
          </div>
        </div>

        ${conta.forma === "dinheiro" ? `
          <div class="campo"><label>Valor recebido</label>
            <input class="input" data-recebido inputmode="decimal" placeholder="R$ 0,00" value="${conta.recebido}">
          </div>
          <div id="caixaTroco">${blocoTroco()}</div>` : ""}

        <button class="btn btn--verde btn--bloco" data-confirmar>✓ Confirmar pagamento e liberar mesa</button>
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
      toast(`Mesa ${mesa.numero} paga e liberada`, "✅");
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

$("#logo").innerHTML = Prontito.logo();
atualizarTudo();
