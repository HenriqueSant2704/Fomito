/* ==========================================================================
   PRONTITO · APP DO CLIENTE (lógica do protótipo)
   --------------------------------------------------------------------------
   Organização:
     1. Estado        → tudo que a tela "lembra"
     2. Navegação     → troca entre as telas
     3. Cardápio      → categorias, busca e lista de produtos
     4. Produto       → folha para escolher quantidade/observação
     5. Sacola
     6. Finalizar     → endereço/mesa, pagamento e troco
     7. Acompanhamento
     8. Início
   ========================================================================== */

const { dados, moeda, icone, $, $$, toast } = Prontito;

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
  const todas = [{ id: "todas", nome: "Todos" }, ...dados.categorias];
  $("#categorias").innerHTML = todas
    .map((c) => `<button class="aba ${estado.categoria === c.id ? "ativo" : ""}" data-cat="${c.id}">${c.nome}</button>`)
    .join("");
}

function linhaProduto(p) {
  return `
    <button class="produto" data-produto="${p.id}">
      <div class="produto__info">
        ${p.destaque ? `<span class="selo">Mais pedido</span>` : ""}
        <span class="produto__nome">${p.nome}</span>
        <span class="produto__desc">${p.desc}</span>
        <span class="produto__preco">${moeda(p.preco)}</span>
      </div>
      <div class="produto__midia">
        ${Prontito.foto(p, 84)}
        <span class="produto__add" aria-hidden="true">${icone("mais", "ic--sm")}</span>
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
      return `<section class="secao"><h3 class="secao__titulo">${c.nome}</h3><div class="secao__lista">${itens.map(linhaProduto).join("")}</div></section>`;
    })
    .join("");

  $("#listaProdutos").innerHTML =
    html || `<div class="vazio"><span class="vazio__icone">${icone("busca", "ic--lg")}</span>Nenhum item encontrado para “${estado.busca}”.</div>`;
}

function atualizarBarraSacola() {
  const qtd = qtdItens();
  $("#barraSacola").hidden = qtd === 0;
  $("#barraQtd").textContent = qtd;
  $("#barraTotal").textContent = moeda(subtotal());
}

$("#categorias").addEventListener("click", (e) => {
  const aba = e.target.closest("[data-cat]");
  if (!aba) return;
  estado.categoria = aba.dataset.cat;
  renderCategorias();
  renderProdutos();
});

$("#busca").addEventListener("input", (e) => {
  estado.busca = e.target.value;
  renderProdutos();
});

$$("[data-modo]").forEach((botao) =>
  botao.addEventListener("click", () => {
    estado.modo = botao.dataset.modo;
    $$("[data-modo]").forEach((b) => b.classList.toggle("ativo", b === botao));
    toast(estado.modo === "entrega" ? "Pedido para entrega" : "Pedido para comer no local: pagamento com o garçom", estado.modo === "entrega" ? "entrega" : "local");
  })
);

/* ---------- 4. FOLHA DO PRODUTO ---------- */
$("#listaProdutos").addEventListener("click", (e) => {
  const linha = e.target.closest("[data-produto]");
  if (linha) abrirProduto(Number(linha.dataset.produto));
});

function abrirProduto(id) {
  const p = Prontito.produto(id);
  let qtd = 1;

  const camada = document.createElement("div");
  camada.className = "sobreposicao";
  camada.innerHTML = `
    <div class="folha pilha" style="gap:18px">
      <div class="foto" style="height:180px;border-radius:var(--raio-lg)">${icone(p.cat)}</div>
      <div class="pilha" style="gap:6px">
        <h2 style="font-size:21px">${p.nome}</h2>
        <p class="suave">${p.desc}</p>
        <span class="preco" style="font-size:17px">${moeda(p.preco)}</span>
      </div>
      <div class="campo">
        <label for="obs">Observações</label>
        <textarea id="obs" class="input" rows="2" placeholder="Ex.: sem cebola, ponto da carne"></textarea>
      </div>
      <div class="linha" style="gap:12px">
        <div class="qtd"><button data-q="-1" aria-label="Diminuir">${icone("menos", "ic--sm")}</button><span id="qtdFolha">1</span><button data-q="1" aria-label="Aumentar">${icone("mais", "ic--sm")}</button></div>
        <button class="btn btn--primario" id="adicionar" style="flex:1;justify-content:space-between">Adicionar <span id="precoFolha" class="num">${moeda(p.preco)}</span></button>
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
      adicionarASacola(id, qtd, $("#obs", camada).value.trim());
      camada.remove();
    }
  });
}

function adicionarASacola(id, qtd, obs = "") {
  const existente = estado.carrinho.find((i) => i.id === id && i.obs === obs);
  if (existente) existente.qtd += qtd;
  else estado.carrinho.push({ id, qtd, obs });
  atualizarBarraSacola();
  toast(`${Prontito.produto(id).nome} adicionado à sacola`, "sacola");
}

/* ---------- 5. SACOLA ---------- */
function renderCarrinho() {
  if (!estado.carrinho.length) {
    $("#itensCarrinho").innerHTML = `
      <div class="vazio"><span class="vazio__icone">${icone("sacola", "ic--lg")}</span>
      <p>Sua sacola está vazia.</p>
      <button class="btn btn--secundario" data-ir="cardapio">Ver cardápio</button></div>`;
    $("#resumoCarrinho").hidden = true;
    return;
  }

  $("#itensCarrinho").innerHTML = `
    <div class="lista-itens">
      ${estado.carrinho.map((item, i) => {
        const p = Prontito.produto(item.id);
        return `
          <div class="item">
            ${Prontito.foto(p, 52)}
            <div class="item__info">
              <div class="forte">${p.nome}</div>
              ${item.obs ? `<div class="item__obs">${item.obs}</div>` : ""}
              <div class="preco pequeno">${moeda(p.preco * item.qtd)}</div>
            </div>
            <div class="qtd">
              <button data-i="${i}" data-q="-1" aria-label="Diminuir">${icone(item.qtd === 1 ? "lixo" : "menos", "ic--sm")}</button>
              <span>${item.qtd}</span>
              <button data-i="${i}" data-q="1" aria-label="Aumentar">${icone("mais", "ic--sm")}</button>
            </div>
          </div>`;
      }).join("")}
    </div>
    <button class="btn btn--contorno" data-ir="cardapio">${icone("mais", "ic--sm")} Adicionar mais itens</button>`;

  $("#resumoCarrinho").hidden = false;
  $("#resumoCarrinho").innerHTML = `
    ${linhasResumo()}
    <button class="btn btn--primario btn--bloco" data-ir="checkout">Continuar</button>`;
}

function linhasResumo() {
  return `
    <div class="entre pequeno"><span class="suave">Subtotal</span><span class="num">${moeda(subtotal())}</span></div>
    ${estado.modo === "entrega" ? `<div class="entre pequeno"><span class="suave">Taxa de entrega</span><span class="num">${moeda(taxaEntrega())}</span></div>` : ""}
    <div class="entre linha-total"><span class="forte">Total</span><span class="preco">${moeda(total())}</span></div>`;
}

$("#itensCarrinho").addEventListener("click", (e) => {
  const b = e.target.closest("[data-q]");
  if (!b) return;
  const item = estado.carrinho[b.dataset.i];
  item.qtd += Number(b.dataset.q);
  if (item.qtd <= 0) estado.carrinho.splice(b.dataset.i, 1);
  atualizarBarraSacola();
  renderCarrinho();
});

/* ---------- 6. FINALIZAR ---------- */
function renderCheckout() {
  const entrega = estado.modo === "entrega";

  const blocoLocal = `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("local")} Comer no local</h3>
      <div class="duas">
        <div class="campo"><label for="mesa">Número da mesa</label><input id="mesa" class="input" type="number" value="7"></div>
        <div class="campo"><label for="nome">Seu nome</label><input id="nome" class="input" value="Ana"></div>
      </div>
      <div class="aviso">${icone("info", "ic--sm")}<span>No consumo local, o pagamento é feito com o garçom quando você pedir a conta.</span></div>
    </div>`;

  const blocoEntrega = `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("pin")} Endereço de entrega</h3>
      <div class="campo"><label for="rua">Rua e número</label><input id="rua" class="input" value="Rua das Flores, 120"></div>
      <div class="duas">
        <div class="campo"><label for="bairro">Bairro</label><input id="bairro" class="input" value="Centro"></div>
        <div class="campo"><label for="compl">Complemento</label><input id="compl" class="input" placeholder="Apto, bloco"></div>
      </div>
      <div class="campo"><label for="tel">Telefone</label><input id="tel" class="input" value="(11) 98888-7777"></div>
    </div>
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("dinheiro")} Pagamento <small>na entrega</small></h3>
      <div class="pilha" style="gap:8px" id="formasPagamento">
        ${dados.formasPagamento.map((f) => `
          <button class="opcao ${estado.pagamento === f.id ? "ativa" : ""}" data-pag="${f.id}">
            <span class="opcao__icone">${icone(f.icone)}</span>
            <span class="opcao__texto"><span class="opcao__titulo">${f.nome}</span><span class="opcao__sub">${f.sub}</span></span>
            <span class="opcao__radio"></span>
          </button>
          ${f.id === "dinheiro" && estado.pagamento === "dinheiro" ? blocoTroco() : ""}`).join("")}
      </div>
    </div>`;

  $("#checkout").innerHTML = `
    ${entrega ? blocoEntrega : blocoLocal}
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("pedidos")} Resumo</h3>
      ${estado.carrinho.map((i) => `<div class="entre pequeno"><span>${i.qtd}× ${Prontito.produto(i.id).nome}</span><span class="num">${moeda(Prontito.produto(i.id).preco * i.qtd)}</span></div>`).join("")}
    </div>`;

  renderRodapeCheckout();
  ligarEventosTroco();
}

function blocoTroco() {
  return `
    <div class="troco">
      <span class="troco__pergunta">Troco para quanto?</span>
      <div class="troco__valor">
        <span>R$</span>
        <input class="input" id="trocoPara" inputmode="decimal" placeholder="0,00" value="${estado.trocoPara}" ${estado.semTroco ? "disabled" : ""}>
      </div>
      <div class="troco__sugestoes">
        ${sugestoesTroco().map((v) => `<button data-troco="${v}">R$ ${v}</button>`).join("")}
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
    ? `<span class="troco__erro">O valor precisa ser maior que o total de ${moeda(total())}.</span>`
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
      ${estado.modo === "entrega" ? "Confirmar pedido" : "Enviar pedido para a cozinha"}
    </button>`;
  $("#confirmar").onclick = confirmarPedido;
}

/* ---------- 7. ACOMPANHAMENTO ---------- */
const etapas = {
  entrega: [
    { icone: "recebido", titulo: "Pedido recebido", sub: "A lanchonete confirmou seu pedido" },
    { icone: "chama", titulo: "Em preparo", sub: "Seu pedido está sendo preparado" },
    { icone: "entrega", titulo: "Saiu para entrega", sub: "O entregador está a caminho" },
    { icone: "inicio", titulo: "Entregue", sub: "Bom apetite!" },
  ],
  local: [
    { icone: "recebido", titulo: "Pedido recebido", sub: "A cozinha recebeu seu pedido" },
    { icone: "chama", titulo: "Em preparo", sub: "Está ficando pronto" },
    { icone: "local", titulo: "Servido na mesa", sub: "Peça a conta ao garçom quando quiser" },
  ],
};
let timerPedido;

function confirmarPedido() {
  estado.pedido = { numero: 1000 + Math.floor(Math.random() * 900), modo: estado.modo, itens: [...estado.carrinho], total: total(), pagamento: estado.pagamento, troco: estado.semTroco ? null : valorTroco() };
  estado.carrinho = [];
  estado.etapaPedido = 0;
  atualizarBarraSacola();
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
    $("#acompanhamento").innerHTML = `<div class="vazio"><span class="vazio__icone">${icone("pedidos", "ic--lg")}</span><p>Você ainda não fez nenhum pedido.</p><button class="btn btn--secundario" data-ir="cardapio">Ver cardápio</button></div>`;
    return;
  }
  const lista = etapas[pedido.modo];
  const atual = lista[estado.etapaPedido];
  const forma = dados.formasPagamento.find((f) => f.id === pedido.pagamento);

  const pagamento = pedido.modo === "entrega"
    ? `Pagamento na entrega: <b>${forma?.nome}</b>${pedido.pagamento === "dinheiro" ? (pedido.troco ? `, troco para ${moeda(pedido.troco)} (o entregador leva ${moeda(pedido.troco - pedido.total)})` : ", sem troco") : ""}.`
    : "Pagamento com o garçom ao fechar a conta.";

  $("#acompanhamento").innerHTML = `
    <div class="status">
      <span class="rotulo">Pedido #${pedido.numero}</span>
      <h3 class="status__titulo" style="font-family:var(--fonte-marca);font-weight:800">${atual.titulo}</h3>
      <span class="suave">${pedido.modo === "entrega" ? `Previsão de entrega: ${dados.lanchonete.tempoEntrega}` : "Mesa 7"}</span>
      <div class="status__progresso" style="grid-template-columns:repeat(${lista.length},1fr)">
        ${lista.map((_, i) => `<span class="${i < estado.etapaPedido ? "feito" : i === estado.etapaPedido ? "atual" : ""}"></span>`).join("")}
      </div>
    </div>

    <div class="card linha-tempo">
      ${lista.map((e, i) => `
        <div class="etapa ${i < estado.etapaPedido ? "feita" : ""} ${i === estado.etapaPedido ? "atual" : ""}">
          <span class="etapa__ponto">${icone(i < estado.etapaPedido ? "check" : e.icone, "ic--sm")}</span>
          <div><div class="etapa__titulo">${e.titulo}</div><div class="pequeno suave">${e.sub}</div></div>
        </div>`).join("")}
    </div>

    <div class="card resumo">
      <span class="rotulo">Itens</span>
      ${pedido.itens.map((i) => `<div class="entre pequeno"><span>${i.qtd}× ${Prontito.produto(i.id).nome}</span><span class="num">${moeda(Prontito.produto(i.id).preco * i.qtd)}</span></div>`).join("")}
      <div class="entre resumo__total"><span class="forte">Total</span><span class="preco">${moeda(pedido.total)}</span></div>
    </div>
    <div class="aviso">${icone(pedido.modo === "entrega" ? (forma?.icone || "dinheiro") : "usuario", "ic--sm")}<span>${pagamento}</span></div>
    <p class="demo">Protótipo: o status avança sozinho a cada 4 segundos.</p>`;
}

/* ---------- 8. INÍCIO ---------- */
$("#logo").innerHTML = Prontito.logo();
$("#nomeLoja").textContent = dados.lanchonete.nome;
$("#tempoLoja").textContent = dados.lanchonete.tempoEntrega;
$("#taxaLoja").textContent = moeda(dados.lanchonete.taxaEntrega);
renderCategorias();
renderProdutos();
atualizarBarraSacola();
