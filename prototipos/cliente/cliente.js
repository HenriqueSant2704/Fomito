/* ==========================================================================
   PRONTITO · APP DO CLIENTE (lógica do protótipo)
   --------------------------------------------------------------------------
   Organização:
     1. Estado        → tudo que a tela "lembra"
     2. Navegação     → troca entre as telas
     3. Cardápio      → categorias, busca e lista de produtos
     4. Produto       → folha para escolher quantidade/observação
     5. Carrinho
     6. Checkout      → endereço/mesa, pagamento e troco
     7. Acompanhamento
     8. Início
   ========================================================================== */

const { dados, moeda, $, $$, toast } = Prontito;

/* ---------- 1. ESTADO ---------- */
const estado = {
  modo: "entrega",          // "entrega" | "local"
  categoria: "todas",
  busca: "",
  carrinho: [],             // [{ id, qtd, obs }]
  pagamento: null,          // id da forma de pagamento
  trocoPara: "",
  semTroco: false,
  etapaPedido: 0,
};

const taxaEntrega = () => (estado.modo === "entrega" ? dados.lanchonete.taxaEntrega : 0);
const subtotal = () => Prontito.totalItens(estado.carrinho);
const total = () => subtotal() + taxaEntrega();
const qtdItens = () => estado.carrinho.reduce((s, i) => s + i.qtd, 0);

/* ---------- 2. NAVEGAÇÃO ---------- */
function irPara(nomeTela) {
  $$(".tela").forEach((t) => (t.hidden = t.dataset.tela !== nomeTela));
  window.scrollTo(0, 0);
  const renderizar = { carrinho: renderCarrinho, checkout: renderCheckout, acompanhamento: renderAcompanhamento };
  renderizar[nomeTela]?.();
}

document.addEventListener("click", (e) => {
  const alvo = e.target.closest("[data-ir]");
  if (alvo) irPara(alvo.dataset.ir);
});

/* ---------- 3. CARDÁPIO ---------- */
function renderCategorias() {
  const todas = [{ id: "todas", nome: "Todos", icone: "✨" }, ...dados.categorias];
  $("#categorias").innerHTML = todas
    .map((c) => `<button class="chip ${estado.categoria === c.id ? "ativo" : ""}" data-cat="${c.id}">${c.icone} ${c.nome}</button>`)
    .join("");
}

function cardProduto(p) {
  return `
    <button class="produto" data-produto="${p.id}">
      <div class="foto foto--${p.cat}">${p.emoji}</div>
      <div class="produto__info">
        ${p.destaque ? `<span class="destaque">🔥 Mais pedido</span>` : ""}
        <span class="produto__nome">${p.nome}</span>
        <span class="produto__desc">${p.desc}</span>
        <div class="produto__rodape">
          <span class="preco">${moeda(p.preco)}</span>
          <span class="produto__add">+</span>
        </div>
      </div>
    </button>`;
}

function renderProdutos() {
  const termo = estado.busca.toLowerCase();
  const html = dados.categorias
    .filter((c) => estado.categoria === "todas" || c.id === estado.categoria)
    .map((c) => {
      const itens = dados.produtos.filter((p) => p.cat === c.id && p.nome.toLowerCase().includes(termo));
      if (!itens.length) return "";
      return `<h3 class="secao-titulo">${c.icone} ${c.nome}</h3>${itens.map(cardProduto).join("")}`;
    })
    .join("");

  $("#listaProdutos").innerHTML =
    html || `<div class="vazio"><div class="vazio__emoji">🤔</div>Nada encontrado para "${estado.busca}".</div>`;
}

function atualizarBarraCarrinho() {
  const qtd = qtdItens();
  $("#barraCarrinho").hidden = qtd === 0;
  $("#barraQtd").textContent = qtd;
  $("#barraTotal").textContent = moeda(subtotal());
}

$("#categorias").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-cat]");
  if (!chip) return;
  estado.categoria = chip.dataset.cat;
  renderCategorias();
  renderProdutos();
});

$("#busca").addEventListener("input", (e) => {
  estado.busca = e.target.value;
  renderProdutos();
});

$$(".modo__opcao").forEach((botao) =>
  botao.addEventListener("click", () => {
    estado.modo = botao.dataset.modo;
    $$(".modo__opcao").forEach((b) => b.classList.toggle("ativo", b === botao));
    toast(estado.modo === "entrega" ? "Modo entrega: levamos até você" : "Modo comer aqui: pague com o garçom", estado.modo === "entrega" ? "🛵" : "🍽️");
  })
);

/* ---------- 4. FOLHA DO PRODUTO ---------- */
$("#listaProdutos").addEventListener("click", (e) => {
  const card = e.target.closest("[data-produto]");
  if (card) abrirProduto(Number(card.dataset.produto));
});

function abrirProduto(id) {
  const p = Prontito.produto(id);
  let qtd = 1;

  const camada = document.createElement("div");
  camada.className = "sobreposicao";
  camada.innerHTML = `
    <div class="folha pilha" style="gap:16px">
      <div class="foto foto--${p.cat}" style="height:170px;font-size:84px;border-radius:var(--raio-lg)">${p.emoji}</div>
      <div class="pilha" style="gap:6px">
        <h2>${p.nome}</h2>
        <p class="suave">${p.desc}</p>
        <span class="preco" style="font-size:22px">${moeda(p.preco)}</span>
      </div>
      <div class="campo">
        <label for="obs">Alguma observação?</label>
        <textarea id="obs" class="input" rows="2" placeholder="Ex.: sem cebola, ponto da carne..."></textarea>
      </div>
      <div class="entre">
        <div class="qtd"><button data-q="-1">−</button><span id="qtdFolha">1</span><button data-q="1">+</button></div>
        <button class="btn btn--primario" id="adicionar" style="flex:1">Adicionar · <span id="precoFolha">${moeda(p.preco)}</span></button>
      </div>
    </div>`;
  document.body.appendChild(camada);

  camada.addEventListener("click", (e) => {
    if (e.target === camada) return camada.remove();
    const q = e.target.closest("[data-q]");
    if (q) {
      qtd = Math.max(1, qtd + Number(q.dataset.q));
      $("#qtdFolha", camada).textContent = qtd;
      $("#precoFolha", camada).textContent = moeda(p.preco * qtd);
    }
    if (e.target.closest("#adicionar")) {
      adicionarAoCarrinho(id, qtd, $("#obs", camada).value.trim());
      camada.remove();
    }
  });
}

function adicionarAoCarrinho(id, qtd, obs = "") {
  const existente = estado.carrinho.find((i) => i.id === id && i.obs === obs);
  if (existente) existente.qtd += qtd;
  else estado.carrinho.push({ id, qtd, obs });
  atualizarBarraCarrinho();
  toast(`${Prontito.produto(id).nome} no carrinho`, "🛒");
}

/* ---------- 5. CARRINHO ---------- */
function renderCarrinho() {
  if (!estado.carrinho.length) {
    $("#itensCarrinho").innerHTML = `
      <div class="vazio"><div class="vazio__emoji">🛒</div>
      <p>Seu carrinho está vazio.</p><br>
      <button class="btn btn--suave" data-ir="cardapio">Ver cardápio</button></div>`;
    $("#resumoCarrinho").hidden = true;
    return;
  }

  $("#itensCarrinho").innerHTML =
    estado.carrinho
      .map((item, i) => {
        const p = Prontito.produto(item.id);
        return `
        <div class="card item">
          <div class="foto foto--${p.cat}">${p.emoji}</div>
          <div class="item__info">
            <div class="forte">${p.nome}</div>
            ${item.obs ? `<div class="pequeno suave">“${item.obs}”</div>` : ""}
            <div class="preco">${moeda(p.preco * item.qtd)}</div>
          </div>
          <div class="qtd"><button data-i="${i}" data-q="-1">${item.qtd === 1 ? "🗑" : "−"}</button><span>${item.qtd}</span><button data-i="${i}" data-q="1">+</button></div>
        </div>`;
      })
      .join("") +
    `<button class="btn btn--contorno" data-ir="cardapio">+ Adicionar mais itens</button>`;

  $("#resumoCarrinho").hidden = false;
  $("#resumoCarrinho").innerHTML = `
    ${linhasResumo()}
    <button class="btn btn--primario btn--bloco" data-ir="checkout">Continuar</button>`;
}

function linhasResumo() {
  return `
    <div class="entre pequeno"><span class="suave">Subtotal</span><span>${moeda(subtotal())}</span></div>
    ${estado.modo === "entrega" ? `<div class="entre pequeno"><span class="suave">Taxa de entrega</span><span>${moeda(taxaEntrega())}</span></div>` : ""}
    <div class="entre"><span class="forte">Total</span><span class="preco" style="font-size:20px">${moeda(total())}</span></div>`;
}

$("#itensCarrinho").addEventListener("click", (e) => {
  const b = e.target.closest("[data-q]");
  if (!b) return;
  const item = estado.carrinho[b.dataset.i];
  item.qtd += Number(b.dataset.q);
  if (item.qtd <= 0) estado.carrinho.splice(b.dataset.i, 1);
  atualizarBarraCarrinho();
  renderCarrinho();
});

/* ---------- 6. CHECKOUT ---------- */
function renderCheckout() {
  const entrega = estado.modo === "entrega";

  const blocoLocal = `
    <div class="card bloco">
      <h3 class="bloco__titulo">🍽️ Comer aqui</h3>
      <div class="campo"><label>Número da mesa</label><input class="input" type="number" placeholder="Ex.: 7" value="7"></div>
      <div class="campo"><label>Seu nome</label><input class="input" placeholder="Para o garçom te chamar" value="Ana"></div>
    </div>
    <div class="aviso"><span>💡</span><span>No consumo local, o <b>pagamento é feito com o garçom</b> quando você pedir para fechar a conta.</span></div>`;

  const blocoEntrega = `
    <div class="card bloco">
      <h3 class="bloco__titulo">📍 Endereço de entrega</h3>
      <div class="campo"><label>Rua e número</label><input class="input" value="Rua das Flores, 120"></div>
      <div class="linha">
        <div class="campo" style="flex:1"><label>Bairro</label><input class="input" value="Centro"></div>
        <div class="campo" style="width:40%"><label>Complemento</label><input class="input" placeholder="Apto, bloco..."></div>
      </div>
      <div class="campo"><label>Telefone</label><input class="input" value="(11) 98888-7777"></div>
    </div>
    <div class="card bloco">
      <h3 class="bloco__titulo">💰 Como vai pagar? <small>pagamento na entrega</small></h3>
      <div class="pilha" style="gap:8px" id="formasPagamento">
        ${dados.formasPagamento.map((f) => `
          <button class="opcao ${estado.pagamento === f.id ? "ativa" : ""}" data-pag="${f.id}">
            <span class="opcao__icone">${f.icone}</span>
            <span class="opcao__texto"><span class="opcao__titulo">${f.nome}</span><br><span class="opcao__sub">${f.sub}</span></span>
            <span class="opcao__radio"></span>
          </button>
          ${f.id === "dinheiro" && estado.pagamento === "dinheiro" ? blocoTroco() : ""}`).join("")}
      </div>
    </div>`;

  $("#checkout").innerHTML = `
    ${entrega ? blocoEntrega : blocoLocal}
    <div class="card resumo">
      <h3 class="bloco__titulo">🧾 Resumo</h3>
      ${estado.carrinho.map((i) => `<div class="entre pequeno"><span>${i.qtd}× ${Prontito.produto(i.id).nome}</span><span>${moeda(Prontito.produto(i.id).preco * i.qtd)}</span></div>`).join("")}
    </div>`;

  renderRodapeCheckout();
  ligarEventosTroco();
}

function blocoTroco() {
  return `
    <div class="troco">
      <span class="troco__pergunta">Troco para quanto?</span>
      <div class="troco__valor">
        <span class="forte suave">R$</span>
        <input class="input" id="trocoPara" inputmode="decimal" placeholder="0,00" value="${estado.trocoPara}" ${estado.semTroco ? "disabled" : ""}>
      </div>
      <div class="chips" id="sugestoesTroco">
        ${sugestoesTroco().map((v) => `<button class="chip" data-troco="${v}">R$ ${v}</button>`).join("")}
      </div>
      <label class="check"><input type="checkbox" id="semTroco" ${estado.semTroco ? "checked" : ""}> Não preciso de troco</label>
      <div id="resultadoTroco"></div>
    </div>`;
}

/* Sugere notas "redondas" acima do total: 50, 100, 200... */
function sugestoesTroco() {
  return [20, 50, 100, 200].filter((v) => v > total()).slice(0, 3);
}

function valorTroco() {
  return parseFloat(String(estado.trocoPara).replace(",", ".")) || 0;
}

function atualizarResultadoTroco() {
  const el = $("#resultadoTroco");
  if (!el) return;
  if (estado.semTroco || !estado.trocoPara) return (el.innerHTML = "");
  const v = valorTroco();
  el.innerHTML = v < total()
    ? `<span class="troco__erro">O valor precisa ser maior que o total (${moeda(total())}).</span>`
    : `<span class="troco__resultado">O entregador levará <strong>${moeda(v - total())}</strong> de troco.</span>`;
}

function ligarEventosTroco() {
  $("#formasPagamento")?.addEventListener("click", (e) => {
    const sug = e.target.closest("[data-troco]");
    if (sug) {
      estado.trocoPara = sug.dataset.troco;
      estado.semTroco = false;
      $("#trocoPara").value = estado.trocoPara;
      $("#trocoPara").disabled = false;
      $("#semTroco").checked = false;
      atualizarResultadoTroco();
      return renderRodapeCheckout();
    }
    const op = e.target.closest("[data-pag]");
    if (op) {
      estado.pagamento = op.dataset.pag;
      renderCheckout();
    }
  });
  $("#trocoPara")?.addEventListener("input", (e) => {
    estado.trocoPara = e.target.value;
    atualizarResultadoTroco();
    renderRodapeCheckout();
  });
  $("#semTroco")?.addEventListener("change", (e) => {
    estado.semTroco = e.target.checked;
    $("#trocoPara").disabled = estado.semTroco;
    atualizarResultadoTroco();
    renderRodapeCheckout();
  });
  atualizarResultadoTroco();
}

function podeConfirmar() {
  if (estado.modo === "local") return true;
  if (!estado.pagamento) return false;
  if (estado.pagamento === "dinheiro") return estado.semTroco || valorTroco() >= total();
  return true;
}

function renderRodapeCheckout() {
  $("#rodapeCheckout").innerHTML = `
    ${linhasResumo()}
    <button class="btn btn--primario btn--bloco" id="confirmar" ${podeConfirmar() ? "" : "disabled"}>
      ${estado.modo === "entrega" ? "Confirmar pedido" : "Enviar para a cozinha"}
    </button>`;
  $("#confirmar").onclick = confirmarPedido;
}

/* ---------- 7. ACOMPANHAMENTO ---------- */
const etapas = {
  entrega: [
    { icone: "📝", titulo: "Pedido recebido", sub: "A lanchonete confirmou seu pedido", emoji: "📝" },
    { icone: "🔥", titulo: "Em preparo", sub: "Seu lanche está na chapa", emoji: "👨‍🍳" },
    { icone: "🛵", titulo: "Saiu para entrega", sub: "O entregador está a caminho", emoji: "🛵" },
    { icone: "🏠", titulo: "Entregue", sub: "Bom apetite!", emoji: "😋" },
  ],
  local: [
    { icone: "📝", titulo: "Pedido recebido", sub: "A cozinha recebeu seu pedido", emoji: "📝" },
    { icone: "🔥", titulo: "Em preparo", sub: "Está ficando pronto", emoji: "👨‍🍳" },
    { icone: "🍽️", titulo: "Servido na mesa", sub: "Peça a conta ao garçom quando quiser", emoji: "😋" },
  ],
};
let timerPedido;

function confirmarPedido() {
  estado.pedido = { numero: 1000 + Math.floor(Math.random() * 900), modo: estado.modo, itens: [...estado.carrinho], total: total(), pagamento: estado.pagamento, troco: estado.semTroco ? null : valorTroco() };
  estado.carrinho = [];
  estado.etapaPedido = 0;
  atualizarBarraCarrinho();
  irPara("acompanhamento");

  /* Demonstração: avança uma etapa a cada 4 segundos */
  clearInterval(timerPedido);
  timerPedido = setInterval(() => {
    const lista = etapas[estado.pedido.modo];
    if (estado.etapaPedido >= lista.length - 1) return clearInterval(timerPedido);
    estado.etapaPedido++;
    if (!$('[data-tela="acompanhamento"]').hidden) renderAcompanhamento();
  }, 4000);
}

function renderAcompanhamento() {
  const pedido = estado.pedido;
  if (!pedido) {
    $("#acompanhamento").innerHTML = `<div class="vazio"><div class="vazio__emoji">🧾</div><p>Você ainda não fez nenhum pedido.</p><br><button class="btn btn--suave" data-ir="cardapio">Ver cardápio</button></div>`;
    return;
  }
  const lista = etapas[pedido.modo];
  const atual = lista[estado.etapaPedido];
  const progresso = ((estado.etapaPedido + 1) / lista.length) * 100;
  const forma = dados.formasPagamento.find((f) => f.id === pedido.pagamento);

  $("#acompanhamento").innerHTML = `
    <div class="status-topo">
      <span class="status-topo__emoji">${atual.emoji}</span>
      <span class="pequeno" style="opacity:.8">Pedido #${pedido.numero}</span>
      <h3>${atual.titulo}</h3>
      <span class="pequeno" style="opacity:.85">${pedido.modo === "entrega" ? `Previsão: ${dados.lanchonete.tempoEntrega}` : "Mesa 7"}</span>
      <div class="status-topo__barra"><span style="width:${progresso}%"></span></div>
    </div>

    <div class="card linha-tempo">
      ${lista.map((e, i) => `
        <div class="etapa ${i < estado.etapaPedido ? "feita" : ""} ${i === estado.etapaPedido ? "atual" : ""}">
          <span class="etapa__ponto">${i < estado.etapaPedido ? "✓" : e.icone}</span>
          <div><div class="etapa__titulo">${e.titulo}</div><div class="pequeno suave">${e.sub}</div></div>
        </div>`).join("")}
    </div>

    <div class="card resumo">
      <h3 class="bloco__titulo">🧾 Itens</h3>
      ${pedido.itens.map((i) => `<div class="entre pequeno"><span>${i.qtd}× ${Prontito.produto(i.id).nome}</span><span>${moeda(Prontito.produto(i.id).preco * i.qtd)}</span></div>`).join("")}
      <div class="entre resumo__total"><span class="forte">Total</span><span class="preco">${moeda(pedido.total)}</span></div>
      ${pedido.modo === "entrega" ? `
        <div class="aviso" style="margin-top:6px"><span>${forma?.icone}</span><span>Pagamento na entrega: <b>${forma?.nome}</b>${pedido.pagamento === "dinheiro" && pedido.troco ? ` · troco para ${moeda(pedido.troco)} (levar ${moeda(pedido.troco - pedido.total)})` : pedido.pagamento === "dinheiro" ? " · sem troco" : ""}.</span></div>`
        : `<div class="aviso" style="margin-top:6px"><span>🙋</span><span>Pague com o garçom ao fechar a conta.</span></div>`}
    </div>
    <p class="demo">Protótipo: o status avança sozinho a cada 4 segundos.</p>`;
}

/* ---------- 8. INÍCIO ---------- */
$("#logo").innerHTML = Prontito.logo();
$("#nomeLoja").textContent = dados.lanchonete.nome;
$("#tempoLoja").textContent = dados.lanchonete.tempoEntrega;
renderCategorias();
renderProdutos();
atualizarBarraCarrinho();
