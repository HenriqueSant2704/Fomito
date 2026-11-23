/* ==========================================================================
   FOMITO · APP DO CLIENTE (lógica do protótipo)
   --------------------------------------------------------------------------
   Organização:
     1. Estado        → tudo que a tela "lembra"
     2. Navegação     → troca entre as telas
     3. Cardápio      → categorias, busca e lista de produtos
     4. Produto       → tela com galeria de fotos, ingredientes e adicionais
     5. Sacola
     6. Finalizar     → endereço/mesa, pagamento e troco
     7. Acompanhamento
     8. Início
   ========================================================================== */

const { dados, moeda, icone, $, $$, toast } = Fomito;

/* ---------- 1. ESTADO ---------- */
const estado = {
  modo: "entrega",          // "entrega" | "local"
  categoria: "todas",
  busca: "",
  carrinho: [],             // [{ id, qtd, obs, extras: [ids] }]
  pagamento: null,          // id da forma de pagamento
  trocoPara: "",
  semTroco: false,
  etapaPedido: 0,
};

const taxaEntrega = () => (estado.modo === "entrega" ? dados.lanchonete.taxaEntrega : 0);
/* Preço de uma unidade do item, já com os adicionais escolhidos */
const adicionaisDe = (item) => (dados.adicionais[Fomito.produto(item.id).cat] || []).filter((a) => item.extras?.includes(a.id));
const precoUnitario = (item) => Fomito.produto(item.id).preco + adicionaisDe(item).reduce((s, a) => s + a.preco, 0);
const subtotal = () => estado.carrinho.reduce((s, i) => s + precoUnitario(i) * i.qtd, 0);
const total = () => subtotal() + taxaEntrega();
const qtdItens = () => estado.carrinho.reduce((s, i) => s + i.qtd, 0);

/* ---------- 2. NAVEGAÇÃO ---------- */
function irPara(nomeTela) {
  $$(".tela").forEach((t) => (t.hidden = t.dataset.tela !== nomeTela));
  $("#barraSacola").style.display = nomeTela === "cardapio" ? "" : "none";
  window.scrollTo(0, 0);
  const renderizar = { carrinho: renderCarrinho, checkout: renderCheckout, acompanhamento: renderAcompanhamento };
  renderizar[nomeTela]?.();
}

document.addEventListener("click", (e) => {
  const alvo = e.target.closest("[data-ir]");
  if (alvo) irPara(alvo.dataset.ir);
});

/* ---------- 3. CARDÁPIO ---------- */

/* Vitrine do topo: desliza sozinha a cada 5 segundos */
function renderVitrine() {
  const slides = dados.lanchonete.vitrine;
  $("#vitrine").innerHTML = slides.map((v) => `
    <div class="vitrine__slide">
      ${Fomito.cena(v.desenho, v.cena)}
      <div class="vitrine__texto"><strong>${v.titulo}</strong><span>${v.texto}</span></div>
    </div>`).join("");
  ligarCarrossel($("#vitrine"), $("#vitrinePontos"), slides.length, 5000);
}

/* Liga um carrossel (scroll-snap) aos seus pontinhos; opcionalmente passa sozinho */
function ligarCarrossel(trilho, pontos, total, intervalo = 0, aoMudar) {
  pontos.innerHTML = Array.from({ length: total }, (_, i) => `<span class="${i ? "" : "ativo"}"></span>`).join("");
  let atual = 0;
  const marcar = (i) => {
    atual = i;
    [...pontos.children].forEach((p, j) => p.classList.toggle("ativo", j === i));
    aoMudar?.(i);
  };
  trilho.addEventListener("scroll", () => {
    const i = Math.round(trilho.scrollLeft / trilho.clientWidth);
    if (i !== atual) marcar(i);
  }, { passive: true });
  if (intervalo && total > 1) {
    let pausado = false;
    trilho.addEventListener("pointerdown", () => (pausado = true));
    setInterval(() => {
      if (pausado || trilho.offsetParent === null) return;
      trilho.scrollTo({ left: ((atual + 1) % total) * trilho.clientWidth, behavior: "smooth" });
    }, intervalo);
  }
  return { ir: (i) => trilho.scrollTo({ left: i * trilho.clientWidth, behavior: "smooth" }) };
}

/* Carrossel "Os mais pedidos" */
function renderDestaques() {
  $("#destaques").innerHTML = dados.produtos.filter((p) => p.destaque).concat(Fomito.produto(3)).map((p) => `
    <button class="destaque" data-produto="${p.id}">
      <div class="destaque__wrap">${Fomito.foto(p, 168)}<span class="produto__add" aria-hidden="true">${icone("mais", "ic--sm")}</span></div>
      <span class="destaque__nome">${p.nome}</span>
      <span class="destaque__preco">${moeda(p.preco)}</span>
    </button>`).join("");
}

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
        ${p.destaque ? `<span class="selo">${icone("chama", "ic--sm")}Mais pedido</span>` : ""}
        <span class="produto__nome">${p.nome}</span>
        <span class="produto__desc">${p.desc}</span>
        <span class="produto__preco">${moeda(p.preco)}</span>
      </div>
      <div class="produto__midia">
        ${Fomito.foto(p, 92)}
        ${p.fotos.length > 1 ? `<span class="produto__fotos">${icone("fotos")}${p.fotos.length}</span>` : ""}
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
  $("#blocoDestaques").hidden = !!estado.busca;
  renderProdutos();
});

$$("[data-modo]").forEach((botao) =>
  botao.addEventListener("click", () => {
    estado.modo = botao.dataset.modo;
    $$("[data-modo]").forEach((b) => b.classList.toggle("ativo", b === botao));
    toast(estado.modo === "entrega" ? "Pedido para entrega" : "Pedido para comer no local: pagamento com o garçom", estado.modo === "entrega" ? "entrega" : "local");
  })
);

/* ---------- 4. DETALHE DO PRODUTO ---------- */
/* Qualquer clique num produto (lista ou destaques) abre o detalhe */
document.addEventListener("click", (e) => {
  const card = e.target.closest("[data-produto]");
  if (card) abrirProduto(Number(card.dataset.produto));
});

function abrirProduto(id) {
  const p = Fomito.produto(id);
  const extras = dados.adicionais[p.cat] || [];
  const escolha = { qtd: 1, extras: [] };
  const tela = $('[data-tela="produto"]');

  tela.innerHTML = `
    <div class="galeria">
      <div class="galeria__trilho" id="galeria">
        ${p.fotos.map((f) => `
          <div class="galeria__foto">
            ${Fomito.cena(f.desenho, f.cena, p.cat)}
            ${f.legenda ? `<span class="galeria__legenda">${icone(f.cena === "chapa" || f.cena === "combo" ? "loja" : "fotos", "ic--sm")}${f.legenda}</span>` : ""}
          </div>`).join("")}
      </div>
      <div class="galeria__topo">
        <button class="redondo" data-ir="cardapio" aria-label="Voltar ao cardápio">${icone("voltar")}</button>
        ${p.fotos.length > 1 ? `<span class="galeria__contador" id="contador">1 / ${p.fotos.length}</span>` : ""}
      </div>
      ${p.fotos.length > 1 ? `
        <div class="galeria__setas">
          <button class="redondo" data-seta="-1" aria-label="Foto anterior">${icone("voltar", "ic--sm")}</button>
          <button class="redondo" data-seta="1" aria-label="Próxima foto">${icone("seta", "ic--sm")}</button>
        </div>
        <div class="galeria__pontos" id="galeriaPontos"></div>` : ""}
    </div>

    ${p.fotos.length > 1 ? `
      <div class="miniaturas" id="miniaturas">
        ${p.fotos.map((f, i) => `<button class="${i ? "" : "ativo"}" data-foto="${i}" aria-label="Ver foto ${i + 1}">${Fomito.cena(f.desenho, f.cena, p.cat)}</button>`).join("")}
      </div>` : ""}

    <div class="detalhe">
      <div class="detalhe__cabeca">
        <span class="rotulo">${dados.categorias.find((c) => c.id === p.cat).nome}${p.destaque ? " · Mais pedido" : ""}</span>
        <h1>${p.nome}</h1>
        <span class="detalhe__preco">${moeda(p.preco)}</span>
        <p class="suave">${p.desc}</p>
      </div>

      <div class="detalhe__bloco">
        <h3>O que vem</h3>
        <div class="ingredientes">${p.ingredientes.map((i) => `<span>${i}</span>`).join("")}</div>
      </div>

      ${extras.length ? `
        <div class="detalhe__bloco">
          <h3>Turbine seu pedido <span class="pequeno fraco" style="font-weight:400">Opcional</span></h3>
          <div id="adicionais">
            ${extras.map((a) => `
              <label class="adicional"><input type="checkbox" value="${a.id}"><span>${a.nome}</span><span class="suave num">+ ${moeda(a.preco)}</span></label>`).join("")}
          </div>
        </div>` : ""}

      <div class="detalhe__bloco">
        <h3><label for="obs">Observações</label></h3>
        <textarea id="obs" class="input" rows="2" placeholder="Ex.: sem cebola, carne bem passada"></textarea>
      </div>
    </div>

    <footer class="rodape-fixo">
      <div class="linha" style="gap:12px">
        <div class="qtd"><button data-q="-1" aria-label="Diminuir">${icone("menos", "ic--sm")}</button><span id="qtdProduto">1</span><button data-q="1" aria-label="Aumentar">${icone("mais", "ic--sm")}</button></div>
        <button class="btn btn--primario" id="adicionar" style="flex:1;justify-content:space-between;height:48px">Adicionar <span id="precoProduto" class="num"></span></button>
      </div>
    </footer>`;

  const atualizarPreco = () => {
    $("#qtdProduto", tela).textContent = escolha.qtd;
    $("#precoProduto", tela).textContent = moeda(precoUnitario({ id, extras: escolha.extras }) * escolha.qtd);
  };
  atualizarPreco();

  /* Galeria: pontinhos, contador, miniaturas e setas andam juntos */
  if (p.fotos.length > 1) {
    const carrossel = ligarCarrossel($("#galeria", tela), $("#galeriaPontos", tela), p.fotos.length, 0, (i) => {
      $("#contador", tela).textContent = `${i + 1} / ${p.fotos.length}`;
      $$("#miniaturas button", tela).forEach((b, j) => b.classList.toggle("ativo", j === i));
    });
    let atual = 0;
    $("#galeria", tela).addEventListener("scroll", (e) => (atual = Math.round(e.target.scrollLeft / e.target.clientWidth)), { passive: true });
    tela.onclick = (e) => {
      const mini = e.target.closest("[data-foto]");
      if (mini) carrossel.ir(Number(mini.dataset.foto));
      const seta = e.target.closest("[data-seta]");
      if (seta) carrossel.ir(Math.min(p.fotos.length - 1, Math.max(0, atual + Number(seta.dataset.seta))));
    };
  } else {
    tela.onclick = null;
  }

  tela.querySelectorAll(".qtd [data-q]").forEach((b) => b.addEventListener("click", () => {
    escolha.qtd = Math.max(1, escolha.qtd + Number(b.dataset.q));
    atualizarPreco();
  }));
  $("#adicionais", tela)?.addEventListener("change", () => {
    escolha.extras = $$("#adicionais input:checked", tela).map((c) => c.value);
    atualizarPreco();
  });
  $("#adicionar", tela).addEventListener("click", () => {
    adicionarASacola(id, escolha.qtd, $("#obs", tela).value.trim(), escolha.extras);
    irPara("cardapio");
  });

  irPara("produto");
}

function adicionarASacola(id, qtd, obs = "", extras = []) {
  const chave = (i) => `${i.id}|${i.obs}|${[...(i.extras || [])].sort()}`;
  const novo = { id, qtd, obs, extras };
  const existente = estado.carrinho.find((i) => chave(i) === chave(novo));
  if (existente) existente.qtd += qtd;
  else estado.carrinho.push(novo);
  atualizarBarraSacola();
  toast(`${Fomito.produto(id).nome} adicionado à sacola`, "sacola");
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
        const p = Fomito.produto(item.id);
        return `
          <div class="item">
            ${Fomito.foto(p, 52)}
            <div class="item__info">
              <div class="forte">${p.nome}</div>
              ${adicionaisDe(item).length ? `<div class="item__obs">+ ${adicionaisDe(item).map((a) => a.nome).join(", ")}</div>` : ""}
              ${item.obs ? `<div class="item__obs">${item.obs}</div>` : ""}
              <div class="preco pequeno">${moeda(precoUnitario(item) * item.qtd)}</div>
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
      ${estado.carrinho.map((i) => `<div class="entre pequeno"><span>${i.qtd}× ${Fomito.produto(i.id).nome}</span><span class="num">${moeda(precoUnitario(i) * i.qtd)}</span></div>`).join("")}
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
      ${pedido.itens.map((i) => `<div class="entre pequeno"><span>${i.qtd}× ${Fomito.produto(i.id).nome}</span><span class="num">${moeda(precoUnitario(i) * i.qtd)}</span></div>`).join("")}
      <div class="entre resumo__total"><span class="forte">Total</span><span class="preco">${moeda(pedido.total)}</span></div>
    </div>
    <div class="aviso">${icone(pedido.modo === "entrega" ? (forma?.icone || "dinheiro") : "usuario", "ic--sm")}<span>${pagamento}</span></div>
    <p class="demo">Protótipo: o status avança sozinho a cada 4 segundos.</p>`;
}

/* ---------- 8. INÍCIO ---------- */
const loja = dados.lanchonete;
$("#logo").innerHTML = Fomito.logo();
$("#nomeLoja").textContent = loja.nome;
$("#sloganLoja").textContent = loja.slogan;
$("#tempoLoja").textContent = loja.tempoEntrega;
$("#taxaLoja").textContent = `Entrega ${moeda(loja.taxaEntrega)}`;
$("#rodapeNome").textContent = loja.nome;
$("#rodapeEndereco").textContent = loja.endereco;
$("#rodapeHorario").textContent = loja.horario;
renderVitrine();
renderDestaques();
renderCategorias();
renderProdutos();
atualizarBarraSacola();
