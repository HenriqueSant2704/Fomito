/* ==========================================================================
   FOMITO · APP DO CLIENTE
   --------------------------------------------------------------------------
   Organização:
     1. Estado        → tudo que a tela "lembra"
     2. Navegação     → troca entre as telas
     3. Cardápio      → categorias, busca e lista de produtos
     4. Produto       → tela com galeria de fotos, ingredientes e adicionais
     5. Sacola
     6. Finalizar     → entrega ou local, cadastro pelo telefone, endereços, pagamento e troco
     7. Meus pedidos  → comanda da mesa (comer no local), entrega e pedidos anteriores
     8. Início
   ========================================================================== */

const { dados, moeda, icone, $, $$, toast } = Fomito;

/* ---------- 1. ESTADO ---------- */
const estado = {
  modo: "entrega",          // "entrega" | "local" (escolhido no finalizar pedido)
  categoria: "todas",
  busca: "",
  carrinho: [],             // [{ id, qtd, obs, extras: [ids] }]
  pagamento: null,          // id da forma de pagamento
  trocoPara: "",
  semTroco: false,
  /* Finalizar pedido */
  etapaCliente: "telefone", // "telefone" → "identificado"
  telefone: "",
  cliente: null,            // cadastro encontrado ou criado (clientes.js)
  enderecoId: null,
  novoEndereco: false,      // formulário de "Adicionar novo endereço" aberto?
  editandoEndereco: null,   // id do endereço salvo sendo editado
  mesaQR: Fomito.estado.mesaQR || null, // mesa lida pelo QR Code (?m=código da mesa; o servidor diz qual é)
  mesa: "",
  nomeLocal: "",
  etapaCheckout: 1,         // finalizar em etapas: 1 = como receber, 2 = pagamento
  /* Retirar no balcão (lembra o nome e o celular da última vez) */
  retNome: (() => { try { return JSON.parse(localStorage.getItem("fomito.retirada"))?.nome || ""; } catch { return ""; } })(),
  retTel: (() => { try { return JSON.parse(localStorage.getItem("fomito.retirada"))?.tel || ""; } catch { return ""; } })(),
};
if (estado.mesaQR) estado.mesa = String(estado.mesaQR);
const iniciais = (nome) => nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const taxaEntrega = () => (estado.modo === "entrega" ? dados.lanchonete.taxaEntrega : 0);
/* Preço de uma unidade do item, já com os adicionais escolhidos */
const adicionaisDe = (item) => (dados.adicionais[Fomito.produto(item.id).cat] || []).filter((a) => item.extras?.includes(a.id));
const precoUnitario = (item) => Fomito.produto(item.id).preco + adicionaisDe(item).reduce((s, a) => s + a.preco, 0);
const subtotal = () => estado.carrinho.reduce((s, i) => s + precoUnitario(i) * i.qtd, 0);
const total = () => subtotal() + taxaEntrega();
const qtdItens = () => estado.carrinho.reduce((s, i) => s + i.qtd, 0);

/* ---------- 2. NAVEGAÇÃO ---------- */
/* Ordem das telas: indo "para a frente" a nova tela entra pela direita; voltando, pela esquerda */
const ORDEM_TELAS = { cardapio: 0, produto: 1, carrinho: 2, checkout: 3, acompanhamento: 4 };
const semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
let telaAtual = "cardapio";

/* Rodapé fixo (sacola, finalizar, produto): a tela ganha espaço embaixo do tamanho
   exato dele, para o último item e o "Adicionar mais itens" nunca ficarem escondidos */
const observadorRodape = new ResizeObserver(() => ajustarEspacoRodape());
function ajustarEspacoRodape() {
  $$(".tela").forEach((t) => {
    const r = [...t.children].find((c) => c.classList.contains("rodape-fixo"));
    t.style.paddingBottom = r && !r.hidden && r.offsetHeight ? `${r.offsetHeight + 28}px` : "";
  });
}
function observarRodapes() {
  $$(".rodape-fixo").forEach((r) => observadorRodape.observe(r));
  ajustarEspacoRodape();
}

function irPara(nomeTela) {
  const frente = (ORDEM_TELAS[nomeTela] ?? 0) >= (ORDEM_TELAS[telaAtual] ?? 0);
  const mudou = nomeTela !== telaAtual;
  telaAtual = nomeTela;
  $$(".tela").forEach((t) => (t.hidden = t.dataset.tela !== nomeTela));
  $("#barraSacola").style.display = nomeTela === "cardapio" ? "" : "none";
  window.scrollTo(0, 0);
  const nova = $(`.tela[data-tela="${nomeTela}"]`);
  if (mudou && nova && !semMovimento) {
    nova.classList.remove("tela--frente", "tela--volta");
    void nova.offsetWidth; // reinicia a animação
    nova.classList.add(frente ? "tela--frente" : "tela--volta");
    clearTimeout(nova._fimAnimacao); // depois de entrar, mudanças na tela (ex.: +1 item) não animam de novo
    nova._fimAnimacao = setTimeout(() => nova.classList.remove("tela--frente", "tela--volta"), 600);
  }
  if (nomeTela === "checkout" && (estado.mesaQR || minhaComanda())) estado.modo = "local";
  if (nomeTela === "checkout") Object.assign(estado, { etapaCheckout: 1, novoEndereco: false, editandoEndereco: null });
  const renderizar = { carrinho: renderCarrinho, checkout: renderCheckout, acompanhamento: renderAcompanhamento };
  renderizar[nomeTela]?.();
  observarRodapes();
  /* Já pediu por este celular: o cadastro (nome e endereços) aparece sozinho */
  if (nomeTela === "checkout" && estado.modo === "entrega" && estado.etapaCliente === "telefone" && $("#tel")) {
    const salvo = recuperar("fomito.telefone", "");
    if (clientes.telefoneValido(salvo)) { $("#tel").value = clientes.formatarTelefone(salvo); buscarTelefone(); }
  }
}

document.addEventListener("click", (e) => {
  const alvo = e.target.closest("[data-ir]");
  if (alvo) irPara(alvo.dataset.ir);
});

/* ---------- 3. CARDÁPIO ---------- */

/* Vitrine do topo: desliza sozinha a cada 5 segundos */
function renderVitrine() {
  const slides = dados.lanchonete.vitrine.filter((v) => !v.oculto);
  $("#vitrine").innerHTML = slides.map((v) => `
    <div class="vitrine__slide">
      ${Fomito.imagemFoto(v, "lanches")}
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
  const destaques = dados.produtos.filter((p) => p.destaque && !p.esgotado);
  $("#blocoDestaques").hidden = !destaques.length || !!estado.busca;
  $("#destaques").innerHTML = destaques.map((p) => `
    <button class="destaque" data-produto="${p.id}">
      <div class="destaque__wrap">${Fomito.foto(p, 168)}<span class="produto__add" aria-hidden="true">${icone("mais", "ic--sm")}</span></div>
      <span class="destaque__nome">${p.nome}</span>
      <span class="destaque__preco">${moeda(p.preco)}</span>
    </button>`).join("");
}

/* Categorias: botões com ícone, fixos no topo ao rolar. Tocar leva até a categoria
   (o cardápio inteiro continua na tela) e o botão ativo acompanha a rolagem. */
function renderCategorias() {
  const comItens = dados.categorias.filter((c) => dados.produtos.some((p) => p.cat === c.id));
  if (!comItens.some((c) => c.id === estado.categoria)) estado.categoria = comItens[0]?.id;
  $("#categorias").innerHTML = comItens
    .map((c) => `<button class="chip-cat ${estado.categoria === c.id ? "ativo" : ""}" data-cat="${c.id}">${icone(c.icone || "cardapio", "ic--sm")}<span>${c.nome}</span></button>`)
    .join("");
}

/* Ativa o botão da categoria e o deixa visível na faixa (rolagem lateral) */
function marcarCategoria(id) {
  if (!id || id === estado.categoria) return;
  estado.categoria = id;
  $$("#categorias .chip-cat").forEach((b) => {
    const ativo = b.dataset.cat === id;
    b.classList.toggle("ativo", ativo);
    if (ativo) b.parentElement.scrollTo({ left: b.offsetLeft - 16, behavior: "smooth" });
  });
}

/* Ao rolar, o botão ativo segue a categoria que está na tela */
let rolandoAteCategoria = false;
window.addEventListener("scroll", () => {
  if (rolandoAteCategoria || $('[data-tela="cardapio"]').hidden) return;
  const limite = $("#categorias").getBoundingClientRect().bottom + 24;
  let atual = null;
  $$("#listaProdutos [data-sec]").forEach((s) => { if (s.getBoundingClientRect().top <= limite) atual = s.dataset.sec; });
  marcarCategoria(atual || $("#listaProdutos [data-sec]")?.dataset.sec);
}, { passive: true });

function linhaProduto(p) {
  return `
    <button class="produto ${p.esgotado ? "produto--esgotado" : ""}" data-produto="${p.id}">
      <div class="produto__info">
        ${p.esgotado ? `<span class="tag tag--cinza">Esgotado</span>` : p.destaque ? `<span class="selo">${icone("chama", "ic--sm")}Mais pedido</span>` : ""}
        <span class="produto__nome">${p.nome}</span>
        <span class="produto__desc">${p.desc}</span>
        <span class="produto__preco">${moeda(p.preco)}</span>
      </div>
      <div class="produto__midia">
        ${Fomito.foto(p, 92)}
        ${p.fotos.length > 1 ? `<span class="produto__fotos">${icone("fotos")}${p.fotos.length}</span>` : ""}
        ${p.esgotado ? "" : `<span class="produto__add" aria-hidden="true">${icone("mais", "ic--sm")}</span>`}
      </div>
    </button>`;
}

function renderProdutos() {
  const termo = estado.busca.toLowerCase();
  const html = dados.categorias
    .map((c) => {
      const itens = dados.produtos.filter((p) => p.cat === c.id && p.nome.toLowerCase().includes(termo));
      if (!itens.length) return "";
      return `<section class="secao" data-sec="${c.id}" id="sec-${c.id}"><h3 class="secao__titulo">${icone(c.icone || "cardapio", "ic--sm")}${c.nome}<span class="secao__qtd">${itens.length}</span></h3><div class="secao__lista">${itens.map(linhaProduto).join("")}</div></section>`;
    })
    .join("");

  $("#listaProdutos").innerHTML =
    html || `<div class="vazio"><span class="vazio__icone">${icone("busca", "ic--lg")}</span>Nenhum item encontrado para “${estado.busca}”.</div>`;
}

function atualizarBarraSacola() {
  const qtd = qtdItens();
  const barra = $("#barraSacola");
  if (barra.hidden && qtd > 0 && !semMovimento) {
    barra.classList.remove("barra-sacola--entra");
    void barra.offsetWidth;
    barra.classList.add("barra-sacola--entra");
  }
  barra.hidden = qtd === 0;
  $("#barraQtd").textContent = qtd;
  $("#barraTotal").textContent = moeda(subtotal());
}

$("#categorias").addEventListener("click", (e) => {
  const aba = e.target.closest("[data-cat]");
  if (!aba) return;
  const secao = $(`#sec-${aba.dataset.cat}`);
  marcarCategoria(aba.dataset.cat);
  if (!secao) return;
  /* Rola até a categoria, descontando a faixa fixa de categorias */
  const topo = secao.getBoundingClientRect().top + window.scrollY - $("#categorias").offsetHeight - 6;
  rolandoAteCategoria = true;
  window.scrollTo({ top: topo, behavior: "smooth" });
  clearTimeout(aba._fim);
  aba._fim = setTimeout(() => (rolandoAteCategoria = false), 700);
});

$("#busca").addEventListener("input", (e) => {
  estado.busca = e.target.value;
  renderDestaques();
  renderProdutos();
});

/* ---------- 4. DETALHE DO PRODUTO ---------- */
/* Qualquer clique num produto (lista ou destaques) abre o detalhe */
document.addEventListener("click", (e) => {
  const card = e.target.closest("[data-produto]");
  if (card) abrirProduto(Number(card.dataset.produto));
});

function abrirProduto(id) {
  const p = Fomito.produto(id);
  const extras = dados.adicionais[p.cat] || [];
  const escolha = { qtd: 1, extras: [], sem: [] }; // sem: ingredientes que o cliente tirou
  const tela = $('[data-tela="produto"]');

  tela.innerHTML = `
    <div class="galeria">
      <div class="galeria__trilho" id="galeria">
        ${p.fotos.map((f) => `
          <div class="galeria__foto">
            ${Fomito.imagemFoto(f, p.cat)}
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
        ${p.fotos.map((f, i) => `<button class="${i ? "" : "ativo"}" data-foto="${i}" aria-label="Ver foto ${i + 1}">${Fomito.imagemFoto(f, p.cat)}</button>`).join("")}
      </div>` : ""}

    <div class="detalhe">
      <div class="detalhe__cabeca">
        <span class="rotulo">${dados.categorias.find((c) => c.id === p.cat)?.nome || ""}${p.destaque ? " · Mais pedido" : ""}</span>
        <h1>${p.nome}</h1>
        <span class="detalhe__preco">${moeda(p.preco)}</span>
        <p class="suave">${p.desc}</p>
      </div>

      <div class="detalhe__bloco">
        <h3>O que vem</h3>
        ${p.ingredientes.length > 1 ? `<p class="pequeno fraco" style="margin:-4px 0 2px">Toque no ingrediente que deseja remover <span class="fraco">(opcional)</span></p>` : ""}
        <div class="ingredientes" id="ingredientes">${p.ingredientes.map((i) => `<button type="button" class="ingrediente" data-ingrediente="${i.replace(/"/g, "&quot;")}" aria-pressed="false">${i}</button>`).join("")}</div>
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
        <button class="btn btn--primario" id="adicionar" style="flex:1;justify-content:space-between;height:48px" ${p.esgotado ? "disabled" : ""}>${p.esgotado ? "Esgotado no momento" : "Adicionar"} <span id="precoProduto" class="num"></span></button>
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
  /* Tocar no ingrediente tira (fica riscado); tocar de novo coloca de volta */
  $("#ingredientes", tela)?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ingrediente]");
    if (!b) return;
    const nome = b.dataset.ingrediente;
    const tirou = !escolha.sem.includes(nome);
    escolha.sem = tirou ? [...escolha.sem, nome] : escolha.sem.filter((x) => x !== nome);
    b.classList.toggle("removido", tirou);
    b.setAttribute("aria-pressed", String(tirou));
  });
  $("#adicionais", tela)?.addEventListener("change", () => {
    escolha.extras = $$("#adicionais input:checked", tela).map((c) => c.value);
    atualizarPreco();
  });
  $("#adicionar", tela).addEventListener("click", () => {
    const origem = $("#adicionar", tela).getBoundingClientRect();
    adicionarASacola(id, escolha.qtd, $("#obs", tela).value.trim(), escolha.extras, escolha.sem);
    irPara("cardapio");
    voarParaSacola(p, origem);
  });

  irPara("produto");
}

/* A foto do produto "voa" do botão Adicionar até a sacola, que dá um pulinho */
function voarParaSacola(produto, origem) {
  const barra = $("#barraSacola");
  const pular = () => {
    barra.classList.remove("barra-sacola--pulo");
    void barra.offsetWidth;
    barra.classList.add("barra-sacola--pulo");
  };
  if (semMovimento || barra.hidden) return pular();
  requestAnimationFrame(() => {
    const alvo = $("#barraQtd").getBoundingClientRect();
    const bola = document.createElement("div");
    bola.className = "voando";
    bola.innerHTML = Fomito.foto(produto, 56);
    document.body.appendChild(bola);
    const x0 = origem.left + origem.width / 2 - 28, y0 = origem.top + origem.height / 2 - 28;
    const x1 = alvo.left + alvo.width / 2 - 28, y1 = alvo.top + alvo.height / 2 - 28;
    const meioX = (x0 + x1) / 2, meioY = Math.min(y0, y1) - 140;
    const voo = bola.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(1.1)`, opacity: 1 },
      { transform: `translate(${meioX}px, ${meioY}px) scale(.85)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) scale(.25)`, opacity: .6 },
    ], { duration: 700, easing: "cubic-bezier(.45,.05,.35,1)" });
    voo.onfinish = () => { bola.parentNode?.removeChild(bola); pular(); };
  });
}

function adicionarASacola(id, qtd, obs = "", extras = [], sem = []) {
  const chave = (i) => `${i.id}|${i.obs}|${[...(i.extras || [])].sort()}|${[...(i.sem || [])].sort()}`;
  const novo = { id, qtd, obs, extras, sem };
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
              ${item.sem?.length ? `<div class="item__obs item__sem">Sem ${item.sem.join(", ").toLowerCase()}</div>` : ""}
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
    <div class="entre linha-total"><span class="forte">Subtotal</span><span class="preco">${moeda(subtotal())}</span></div>
    <span class="pequeno fraco">Entrega ou comer no local: você escolhe no próximo passo.</span>
    <button class="btn btn--primario btn--bloco" data-ir="checkout">Continuar</button>`;
}

function linhasResumo() {
  return `
    <div class="entre pequeno"><span class="suave">Subtotal</span><span class="num">${moeda(subtotal())}</span></div>
    ${estado.modo === "entrega" ? `<div class="entre pequeno"><span class="suave">Taxa de entrega</span><span class="num ${taxaEntrega() > 0 ? "" : "frete-gratis"}">${Fomito.taxaTexto(taxaEntrega())}</span></div>` : ""}
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

/* ---------- 6. FINALIZAR ----------
   Ordem da tela:
     a) Como você quer receber? (Entrega ou Comer no local)
     b) Entrega → telefone → cadastro novo OU endereços salvos → pagamento
        Local   → mesa e nome (paga com o garçom)
     c) Resumo do pedido
*/
const { clientes } = Fomito;

/* Finalizar em etapas:
   1. Como receber (entrega com o cadastro e o endereço, retirada com nome e celular, ou mesa)
   2. Pagamento, resumo e confirmar
   Adicionar ou editar endereço abre uma telinha própria, só com o formulário. */
function indicadorEtapas() {
  const passo = estado.etapaCheckout;
  return `
    <div class="etapas-checkout" aria-label="Etapa ${passo} de 2">
      <span class="etapa-checkout ${passo === 1 ? "atual" : "feita"}"><b>${passo > 1 ? icone("check", "ic--sm") : "1"}</b>Como receber</span>
      <span class="etapas-checkout__linha ${passo > 1 ? "feita" : ""}"></span>
      <span class="etapa-checkout ${passo === 2 ? "atual" : ""}"><b>2</b>Pagamento</span>
    </div>`;
}

/* Resumo de como vai receber, no topo da etapa 2 (com "Alterar") */
function blocoRecebimento() {
  if (estado.modo === "retirada") return `
    <div class="bloco recebimento">
      <span class="recebimento__icone">${icone("loja")}</span>
      <div class="pilha" style="gap:1px;flex:1;min-width:0"><span class="rotulo">Retirar no balcão</span><span class="forte">${estado.retNome}</span><span class="pequeno suave">${clientes.formatarTelefone(estado.retTel)}</span></div>
      <button class="link" data-voltar-etapa>Alterar</button>
    </div>`;
  const c = estado.cliente;
  const e = c.enderecos.find((x) => x.id === estado.enderecoId);
  return `
    <div class="bloco recebimento">
      <span class="recebimento__icone">${icone("entrega")}</span>
      <div class="pilha" style="gap:1px;flex:1;min-width:0"><span class="rotulo">Entregar em · ${e.apelido}</span><span class="forte">${clientes.textoEndereco(e)}</span><span class="pequeno suave">${c.nome} · ${clientes.formatarTelefone(c.telefone)}</span></div>
      <button class="link" data-voltar-etapa>Alterar</button>
    </div>`;
}

/* Telinha própria para adicionar ou editar um endereço */
function telaEndereco() {
  const editando = estado.editandoEndereco != null ? estado.cliente.enderecos.find((x) => x.id === estado.editandoEndereco) : null;
  return `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("pin")} ${editando ? "Editar endereço" : "Novo endereço"}</h3>
      <p class="pequeno suave">${editando ? "Corrija o que precisar e salve." : "Ele fica salvo no seu cadastro para os próximos pedidos."}</p>
      ${formEndereco(editando ? editando.apelido : "Casa", editando || {})}
      <p class="form-erro" id="erroCadastro" hidden></p>
      <div class="duas">
        <button class="btn btn--contorno" id="${editando ? "cancelarEdicao" : "cancelarEndereco"}">Cancelar</button>
        <button class="btn btn--primario" id="${editando ? "salvarEdicao" : "salvarEndereco"}">${editando ? "Salvar alterações" : "Salvar endereço"}</button>
      </div>
    </div>`;
}

/* A etapa 1 está completa? (antes de ir para o pagamento) */
function recebimentoOk() {
  if (estado.modo === "retirada") return estado.retNome.trim().length >= 2 && clientes.telefoneValido(estado.retTel);
  if (estado.modo === "entrega") return !!estado.cliente && !estado.novoEndereco && estado.editandoEndereco == null && !!estado.cliente.enderecos.find((e) => e.id === estado.enderecoId)?.numero;
  return false;
}

function renderCheckout() {
  const entrega = estado.modo === "entrega";
  const retirada = estado.modo === "retirada";
  const subtela = entrega && estado.cliente && (estado.novoEndereco || estado.editandoEndereco != null);
  if (estado.modo === "local" || !recebimentoOk()) estado.etapaCheckout = 1;
  $("#rodapeCheckout").hidden = !!subtela;
  if (subtela) {
    $("#checkout").innerHTML = telaEndereco();
    return;
  }
  if (estado.etapaCheckout === 2) {
    $("#checkout").innerHTML = `
      ${indicadorEtapas()}
      ${blocoRecebimento()}
      ${blocoPagamento()}
      <div class="bloco">
        <h3 class="bloco__titulo">${icone("pedidos")} Resumo</h3>
        ${estado.carrinho.map((i) => `<div class="entre pequeno"><span>${i.qtd}× ${Fomito.produto(i.id).nome}</span><span class="num">${moeda(precoUnitario(i) * i.qtd)}</span></div>`).join("")}
      </div>`;
    renderRodapeCheckout();
    ligarEventosTroco();
    return;
  }
  $("#checkout").innerHTML = `
    ${estado.modo !== "local" ? indicadorEtapas() : ""}
    <div class="bloco">
      <h3 class="bloco__titulo">Como você quer receber?</h3>
      <div class="modo-escolha">
        <button class="modo-card ${entrega ? "ativo" : ""}" data-modo="entrega">
          <span class="modo-card__icone">${icone("entrega")}</span>
          <b>Entrega</b><span>${dados.lanchonete.tempoEntrega} · ${Fomito.taxaTexto(dados.lanchonete.taxaEntrega)}</span>
        </button>
        <button class="modo-card ${retirada ? "ativo" : ""}" data-modo="retirada">
          <span class="modo-card__icone">${icone("loja")}</span>
          <b>Retirar no balcão</b><span>Sem taxa de entrega</span>
        </button>
        <button class="modo-card ${estado.modo === "local" ? "ativo" : ""}" data-modo="local">
          <span class="modo-card__icone">${icone("local")}</span>
          <b>Comer no local</b><span>Abre a comanda da mesa</span>
        </button>
      </div>
    </div>
    ${entrega ? blocoCliente() : retirada ? blocoRetirada() : blocoLocal()}
    ${estado.modo === "local" ? `
      <div class="bloco">
        <h3 class="bloco__titulo">${icone("pedidos")} Resumo</h3>
        ${estado.carrinho.map((i) => `<div class="entre pequeno"><span>${i.qtd}× ${Fomito.produto(i.id).nome}</span><span class="num">${moeda(precoUnitario(i) * i.qtd)}</span></div>`).join("")}
      </div>` : ""}`;
  renderRodapeCheckout();
}

/* --- Comer no local: veja a seção 7 (comanda da mesa) --- */

/* --- Entrega: identificação pelo telefone --- */
function blocoCliente() {
  const c = estado.cliente;

  /* 1) Ainda não informou o telefone */
  if (estado.etapaCliente === "telefone") return `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("usuario")} Seu celular</h3>
      <p class="pequeno suave">Se você já pediu aqui, puxamos seu nome e seus endereços salvos.</p>
      <div class="busca-tel">
        <input id="tel" class="input" inputmode="tel" autocomplete="tel" placeholder="(11) 90000-0000" value="${clientes.formatarTelefone(estado.telefone)}">
        <button class="btn btn--primario" id="buscarTel">Continuar</button>
      </div>
    </div>`;

  const topo = `
    <div class="cliente-topo">
      <span class="cliente-topo__avatar">${c ? iniciais(c.nome) : icone("usuario", "ic--sm")}</span>
      <div class="pilha" style="gap:0;flex:1;min-width:0">
        <span class="forte">${c ? `Olá, ${c.nome.split(" ")[0]}!` : "Primeira vez por aqui?"}</span>
        ${c ? `<span class="pequeno">${c.nome}</span>` : ""}
        <span class="pequeno suave">${clientes.formatarTelefone(estado.telefone)}</span>
      </div>
      <button class="link" id="trocarTel">Trocar</button>
    </div>`;

  /* 2) Telefone novo: cadastro com nome + primeiro endereço */
  if (!c) return `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("usuario")} Seu cadastro</h3>
      ${topo}
      <p class="pequeno suave">Preencha só desta vez. Nos próximos pedidos é só informar o celular.</p>
      <div class="campo"><label for="cadNome">Seu nome</label><input id="cadNome" class="input" autocomplete="name" placeholder="Nome e sobrenome"></div>
      ${formEndereco("Casa")}
      <p class="form-erro" id="erroCadastro" hidden></p>
      <button class="btn btn--secundario btn--bloco" id="salvarCadastro">${icone("check", "ic--sm")} Salvar cadastro</button>
    </div>`;

  /* 3) Cliente encontrado: escolhe o endereço ou cadastra outro */
  if (!c.enderecos.some((e) => e.id === estado.enderecoId)) estado.enderecoId = c.enderecos[0].id;
  return `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("pin")} Entregar em</h3>
      ${topo}
      <div class="pilha" style="gap:8px" id="enderecos">
        ${c.enderecos.map((e) => estado.editandoEndereco === e.id ? `
          <div class="novo-endereco">
            <span class="forte">Editar endereço</span>
            ${formEndereco(e.apelido, e)}
            <p class="form-erro" id="erroCadastro" hidden></p>
            <div class="duas"><button class="btn btn--contorno" id="cancelarEdicao">Cancelar</button><button class="btn btn--secundario" id="salvarEdicao">Salvar alterações</button></div>
          </div>` : `
          <div class="endereco-linha">
            <button class="opcao ${e.id === estado.enderecoId ? "ativa" : ""}" data-endereco="${e.id}">
              <span class="opcao__icone">${icone(e.apelido === "Trabalho" ? "loja" : "pin")}</span>
              <span class="opcao__texto"><span class="opcao__titulo">${e.apelido}</span><span class="opcao__sub">${clientes.textoEndereco(e)}${e.ref ? `<br>Ref.: ${e.ref}` : ""}${e.numero ? "" : `<br><b class="falta-numero">Falta o número: toque no lápis</b>`}</span></span>
              <span class="opcao__radio"></span>
            </button>
            <button class="btn-icone endereco-editar" data-editar-endereco="${e.id}" aria-label="Editar o endereço ${e.apelido}" title="Editar">${icone("editar", "ic--sm")}</button>
          </div>`).join("")}
      </div>
      ${estado.novoEndereco ? `
        <div class="novo-endereco">
          <span class="forte">Novo endereço</span>
          ${formEndereco("Trabalho")}
          <p class="form-erro" id="erroCadastro" hidden></p>
          <div class="duas"><button class="btn btn--contorno" id="cancelarEndereco">Cancelar</button><button class="btn btn--secundario" id="salvarEndereco">Salvar endereço</button></div>
        </div>`
        : `<button class="btn btn--contorno" id="novoEndereco">${icone("mais", "ic--sm")} Adicionar novo endereço</button>`}
    </div>`;
}

/* Campos de endereço (usados no cadastro e no "novo endereço") */
function formEndereco(apelidoPadrao, e = {}) {
  const v = (t) => String(t || "").replace(/"/g, "&quot;");
  return `
    <div class="campo"><label>Nome do endereço</label>
      <div class="apelidos" id="apelidos">${["Casa", "Trabalho", "Outro"].map((a) => `<button class="apelido ${a === apelidoPadrao ? "ativo" : ""}" data-apelido="${a}">${a}</button>`).join("")}</div>
    </div>
    <div class="rua-numero">
      <div class="campo"><label for="endRua">Rua <span class="obrigatorio">*</span></label><input id="endRua" class="input" autocomplete="address-line1" placeholder="Ex.: Rua das Flores" value="${v(e.rua)}"></div>
      <div class="campo"><label for="endNumero">Número <span class="obrigatorio">*</span></label><input id="endNumero" class="input" inputmode="numeric" placeholder="Ex.: 120" maxlength="12" value="${v(e.numero)}"></div>
    </div>
    <div class="duas">
      <div class="campo"><label for="endBairro">Bairro</label><input id="endBairro" class="input" placeholder="Bairro" value="${v(e.bairro)}"></div>
      <div class="campo"><label for="endCompl">Complemento</label><input id="endCompl" class="input" placeholder="Apto, bloco" value="${v(e.compl)}"></div>
    </div>
    <div class="campo"><label for="endRef">Ponto de referência <span class="fraco">(opcional)</span></label><input id="endRef" class="input" placeholder="Ex.: portão verde" value="${v(e.ref)}"></div>`;
}

/* Lê os campos de endereço. Retorna null (e mostra o erro) se faltar algo. */
function lerEndereco() {
  const valor = (id) => $(id).value.trim();
  const endereco = { apelido: $(".apelido.ativo").dataset.apelido, rua: valor("#endRua"), numero: valor("#endNumero"), bairro: valor("#endBairro"), compl: valor("#endCompl"), ref: valor("#endRef") };
  if (!endereco.rua || !endereco.numero || !endereco.bairro) return mostrarErro("Preencha a rua, o número e o bairro."), null;
  return endereco;
}
function mostrarErro(texto) {
  $("#erroCadastro").textContent = texto;
  $("#erroCadastro").hidden = false;
}

/* --- Pagamento na entrega --- */
/* --- Retirar no balcão: só o nome e o celular (para avisar quando ficar pronto) --- */
function blocoRetirada() {
  return `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("loja")} Retirada no balcão</h3>
      <div class="duas">
        <div class="campo"><label for="retNome">Seu nome</label><input id="retNome" class="input" autocomplete="name" placeholder="Como te chamamos" value="${estado.retNome.replace(/"/g, "&quot;")}"></div>
        <div class="campo"><label for="retTel">Celular</label><input id="retTel" class="input" inputmode="tel" autocomplete="tel" placeholder="(11) 90000-0000" value="${clientes.formatarTelefone(estado.retTel)}"></div>
      </div>
      <div class="aviso">${icone("info", "ic--sm")}<span>Retire em <b>${dados.lanchonete.endereco || "nosso balcão"}</b>. Avisamos quando o pedido ficar pronto.</span></div>
    </div>`;
}

function blocoPagamento() {
  return `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("dinheiro")} Pagamento <small>${estado.modo === "retirada" ? "na retirada" : "na entrega"}</small></h3>
      <div class="pilha" style="gap:8px" id="formasPagamento">
        ${Fomito.formasAtivas().map((f) => `
          <button class="opcao ${estado.pagamento === f.id ? "ativa" : ""}" data-pag="${f.id}">
            <span class="opcao__icone">${icone(f.icone)}</span>
            <span class="opcao__texto"><span class="opcao__titulo">${f.nome}</span><span class="opcao__sub">${estado.modo === "retirada" ? f.sub.replace(/(na|da) entrega/, "$1 retirada") : f.sub}</span></span>
            <span class="opcao__radio"></span>
          </button>
          ${f.id === "dinheiro" && estado.pagamento === "dinheiro" ? blocoTroco() : ""}`).join("")}
      </div>
    </div>`;
}

/* --- Cliques e digitação da tela de finalizar --- */
async function buscarTelefone() {
  estado.telefone = clientes.soDigitos($("#tel").value);
  if (!clientes.telefoneValido(estado.telefone)) return toast("Digite o celular com DDD", "info");
  estado.cliente = await clientes.buscarRemoto(estado.telefone);
  guardar("fomito.telefone", estado.telefone); // da próxima vez o cadastro já aparece sozinho
  estado.etapaCliente = "identificado";
  renderCheckout();
  if (estado.cliente) toast(`Cadastro encontrado: ${estado.cliente.enderecos.length} endereço(s) salvo(s)`, "check");
}

$("#checkout").addEventListener("click", async (e) => {
  const modo = e.target.closest("[data-modo]");
  if (modo) { estado.modo = modo.dataset.modo; estado.etapaCheckout = 1; return renderCheckout(); }
  if (e.target.closest("[data-voltar-etapa]")) { estado.etapaCheckout = 1; renderCheckout(); return window.scrollTo(0, 0); }

  if (e.target.closest("#buscarTel")) return buscarTelefone();
  if (e.target.closest("#trocarTel")) {
    Object.assign(estado, { etapaCliente: "telefone", cliente: null, novoEndereco: false, editandoEndereco: null });
    guardar("fomito.telefone", null);
    renderCheckout();
    return $("#tel").focus();
  }

  const apelido = e.target.closest("[data-apelido]");
  if (apelido) return $$(".apelido").forEach((a) => a.classList.toggle("ativo", a === apelido));

  const endereco = e.target.closest("[data-endereco]");
  if (endereco) { estado.enderecoId = Number(endereco.dataset.endereco); return renderCheckout(); }

  const editar = e.target.closest("[data-editar-endereco]");
  if (editar) { estado.editandoEndereco = Number(editar.dataset.editarEndereco); estado.novoEndereco = false; renderCheckout(); return $("#endRua").focus(); }
  if (e.target.closest("#cancelarEdicao")) { estado.editandoEndereco = null; return renderCheckout(); }
  if (e.target.closest("#salvarEdicao")) {
    const end = lerEndereco();
    if (!end) return;
    const salvo = await clientes.editarEndereco(estado.telefone, estado.editandoEndereco, end);
    estado.cliente = salvo;
    estado.enderecoId = salvo.enderecoId;
    estado.editandoEndereco = null;
    renderCheckout();
    return toast("Endereço atualizado", "pin");
  }
  if (e.target.closest("#novoEndereco")) { estado.novoEndereco = true; estado.editandoEndereco = null; renderCheckout(); return $("#endRua").focus(); }
  if (e.target.closest("#cancelarEndereco")) { estado.novoEndereco = false; return renderCheckout(); }

  if (e.target.closest("#salvarEndereco")) {
    const end = lerEndereco();
    if (!end) return;
    const salvo = await clientes.adicionarEndereco(estado.telefone, end);
    estado.enderecoId = salvo.enderecoId;
    estado.cliente = salvo;
    estado.novoEndereco = false;
    renderCheckout();
    return toast("Endereço salvo no seu cadastro", "pin");
  }

  if (e.target.closest("#salvarCadastro")) {
    const nome = $("#cadNome").value.trim();
    if (nome.length < 3) return mostrarErro("Digite seu nome.");
    const end = lerEndereco();
    if (!end) return;
    estado.cliente = await clientes.cadastrar({ telefone: estado.telefone, nome, endereco: end });
    estado.enderecoId = estado.cliente.enderecoId;
    renderCheckout();
    return toast("Cadastro salvo! Da próxima vez é só o celular.", "check");
  }
});

$("#checkout").addEventListener("input", (e) => {
  if (e.target.id === "tel") e.target.value = clientes.formatarTelefone(e.target.value);
  if (e.target.id === "retTel") { e.target.value = clientes.formatarTelefone(e.target.value); estado.retTel = clientes.soDigitos(e.target.value); }
  if (e.target.id === "retNome") estado.retNome = e.target.value;
  /* Retirada: com o celular completo, puxa o nome do cadastro (se ainda não digitou) */
  if (e.target.id === "retTel" && clientes.telefoneValido(estado.retTel) && !estado.retNome.trim()) {
    clientes.buscarRemoto(estado.retTel).then((c) => {
      if (!c || estado.retNome.trim()) return;
      estado.retNome = c.nome;
      const campo = $("#retNome");
      if (campo) campo.value = c.nome;
      renderRodapeCheckout();
    }).catch(() => {});
  }
  if (e.target.id === "retTel" || e.target.id === "retNome") renderRodapeCheckout();
  if (e.target.id === "mesa") estado.mesa = e.target.value;
  if (e.target.id === "nomeLocal") estado.nomeLocal = e.target.value;
  if (e.target.id === "mesa" || e.target.id === "nomeLocal") renderRodapeCheckout();
});
$("#checkout").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "tel") buscarTelefone();
});

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
  if (dados.lanchonete.aberta === false) return false;
  if (estado.modo === "local") return !!minhaComanda() || (!!estado.mesaQR && estado.nomeLocal.trim().length > 1);
  if (estado.modo === "retirada") { if (estado.retNome.trim().length < 2 || !clientes.telefoneValido(estado.retTel)) return false; }
  else if (!estado.cliente || estado.novoEndereco || estado.editandoEndereco != null) return false;
  else if (!estado.cliente.enderecos.find((e) => e.id === estado.enderecoId)?.numero) return false; // endereço sem número
  if (!estado.pagamento) return false;
  if (estado.pagamento === "dinheiro") return estado.semTroco || valorTroco() >= total();
  return true;
}

function renderRodapeCheckout() {
  /* Etapa 1 (entrega ou retirada): o botão leva para o pagamento */
  if (estado.modo !== "local" && estado.etapaCheckout === 1) {
    $("#rodapeCheckout").innerHTML = `
      ${linhasResumo()}
      <button class="btn btn--primario btn--bloco" id="irPagamento" ${recebimentoOk() ? "" : "disabled"}>Continuar para o pagamento ${icone("seta", "ic--sm")}</button>`;
    $("#irPagamento").onclick = () => { estado.etapaCheckout = 2; renderCheckout(); window.scrollTo(0, 0); };
    return;
  }
  $("#rodapeCheckout").innerHTML = `
    ${linhasResumo()}
    ${dados.lanchonete.aberta === false ? `<span class="troco__erro" style="text-align:center">A loja não está recebendo pedidos agora.</span>` : ""}
    <button class="btn btn--primario btn--bloco" id="confirmar" ${podeConfirmar() ? "" : "disabled"}>
      ${estado.modo === "entrega" ? "Confirmar pedido" : estado.modo === "retirada" ? "Confirmar pedido para retirar" : minhaComanda() ? "Adicionar à comanda" : "Abrir comanda e enviar para a cozinha"}
    </button>`;
  $("#confirmar").onclick = confirmarPedido;
}

/* ---------- 7. MEUS PEDIDOS: COMANDA DA MESA E ENTREGA ----------
   Comer no local NÃO gera um pedido solto: abre (ou aumenta) a COMANDA
   da mesa. O cliente vê a comanda no início e em "Meus pedidos", pede
   mais quando quiser e pede a conta. Quando o garçom fecha a conta, a
   comanda vira um pedido antigo e some do início.
*/
const { comandas } = Fomito;
const CHAVE_MINHA = "fomito.minhaComanda";   // { mesa, abertaEm } da comanda deste celular
const CHAVE_ANTERIORES = "fomito.meusPedidos";
const guardar = (chave, valor) => { try { valor == null ? localStorage.removeItem(chave) : localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* segue em memória */ } };
const recuperar = (chave, padrao) => { try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; } };

let minha = recuperar(CHAVE_MINHA, null);
let anteriores = recuperar(CHAVE_ANTERIORES, []);

/** A comanda aberta deste cliente (ou null se não tem / já foi fechada) */
function minhaComanda() {
  if (!minha) return null;
  const c = comandas.daMesa(minha.mesa);
  return c && c.abertaEm === minha.abertaEm ? c : null;
}

/** Se o garçom fechou a conta, a comanda vira pedido antigo */
function verificarFechamento() {
  if (!minha || minhaComanda()) return;
  const fechada = comandas.fechadas().find((f) => f.mesa === minha.mesa && f.abertaEm === minha.abertaEm);
  if (fechada && !anteriores.some((a) => a.numero === fechada.numero)) {
    anteriores.unshift({ tipo: "comanda", numero: fechada.numero, titulo: `Comanda · ${comandas.mesaTexto(fechada.mesa)}`, data: fechada.fechadaEm, itens: comandas.qtdItens(fechada), total: fechada.total, forma: fechada.forma });
    guardar(CHAVE_ANTERIORES, anteriores);
    toast(`Conta da ${comandas.mesaTexto(fechada.mesa)} fechada. Obrigado pela visita!`, "check");
  }
  minha = null;
  guardar(CHAVE_MINHA, null);
}

/* --- Cartão da comanda no início (abaixo do cartão da loja) --- */
function renderMinhaComanda() {
  verificarFechamento();
  const c = minhaComanda();
  const el = $("#minhaComanda");
  if (c) {
    const ultima = c.rodadas[c.rodadas.length - 1];
    const st = comandas.STATUS[ultima.status];
    el.innerHTML = `
      <div class="comanda-cliente">
        <div class="comanda-cliente__topo">
          <span class="comanda-cliente__icone">${icone("mesa")}</span>
          <div class="pilha" style="gap:0;flex:1;min-width:0"><span class="rotulo">Sua comanda</span><strong>${comandas.mesaTexto(c.mesa)}</strong></div>
          <span class="tag tag--${c.pediuConta ? "laranja" : "verde"}">${c.pediuConta ? "Conta pedida" : "Aberta"}</span>
        </div>
        <div class="comanda-cliente__info">
          <span>${comandas.qtdItens(c)} itens · ${c.rodadas.length} ${c.rodadas.length > 1 ? "pedidos" : "pedido"} · desde ${comandas.hora(c.abertaEm)}</span>
          <span class="linha" style="gap:5px">${icone(st.icone, "ic--sm")}Último pedido: <b>${st.nome}</b></span>
        </div>
        <div class="entre"><span class="suave">Total até agora</span><span class="preco">${moeda(comandas.total(c))}</span></div>
        <div class="duas">
          <button class="btn btn--contorno" data-ir="acompanhamento">Ver comanda</button>
          <button class="btn btn--primario" data-pedir-mais>${icone("mais", "ic--sm")} Pedir mais</button>
        </div>
      </div>`;
  } else if (estado.mesaQR) {
    el.innerHTML = `
      <div class="aviso aviso--mesa">${icone("mesa", "ic--sm")}<span>Você está na <b>${comandas.mesaTexto(estado.mesaQR)}</b>. Escolha seus itens: ao finalizar, eles abrem a comanda da mesa.</span></div>`;
  } else el.innerHTML = "";
  $("#botaoMeusPedidos").classList.toggle("tem-comanda", !!c);
}

/* --- Comer no local, no finalizar pedido --- */
function blocoLocal() {
  const c = minhaComanda();
  if (c) return `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("mesa")} Comanda da ${comandas.mesaTexto(c.mesa)}</h3>
      <div class="comanda-resumo"><span>Já na comanda: ${comandas.qtdItens(c)} itens</span><span class="num forte">${moeda(comandas.total(c))}</span></div>
      <div class="aviso">${icone("info", "ic--sm")}<span>Estes itens entram na sua comanda aberta. Você paga tudo junto no final, com o garçom.</span></div>
    </div>`;
  /* Para pedir da mesa é preciso ler o QR Code dela: ninguém pede em nome de outra mesa digitando o número */
  if (!estado.mesaQR) return `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("mesa")} Sua mesa</h3>
      <div class="aviso aviso--mesa">${icone("grade", "ic--sm")}<span>Para comer no local, <b>aponte a câmera do celular para o QR Code da sua mesa</b>. O cardápio abre já com o número dela e o pedido vai direto para a sua comanda.</span></div>
    </div>`;
  return `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("mesa")} Sua mesa</h3>
      <div class="duas">
        <div class="campo"><label for="mesa">Número da mesa</label><input id="mesa" class="input" type="number" min="1" value="${estado.mesa}" readonly><span class="pequeno fraco">Pelo QR Code da mesa</span></div>
        <div class="campo"><label for="nomeLocal">Seu nome</label><input id="nomeLocal" class="input" placeholder="Como te chamamos" value="${estado.nomeLocal}"></div>
      </div>
      <div class="aviso">${icone("info", "ic--sm")}<span>Vamos abrir uma <b>comanda</b> para a sua mesa. Você pode pedir mais vezes e paga tudo no final, com o garçom.</span></div>
    </div>`;
}

/* --- Confirmar (entrega vira pedido; local vai para a comanda) ---
   A entrega vai para compartilhado/js/pedidos.js: a lanchonete aceita e
   marca pronto no painel, e o motoboy sai e finaliza na tela dele. */
const etapas = [
  { icone: "recebido", titulo: "Pedido recebido", sub: "Aguardando a lanchonete aceitar" },
  { icone: "chama", titulo: "Em preparo", sub: "Seu pedido está sendo preparado" },
  { icone: "entrega", titulo: "Saiu para entrega", sub: "O entregador está a caminho" },
  { icone: "inicio", titulo: "Entregue", sub: "Bom apetite!" },
];
/* Status do pedido → etapa que o cliente vê (pronto ainda aparece como "em preparo") */
const etapaDoStatus = { novo: 0, preparo: 1, pronto: 1, rota: 2, concluido: 3 };
const CHAVE_ENTREGA = "fomito.minhaEntrega";
let minhaEntrega = recuperar(CHAVE_ENTREGA, null); // número do pedido de entrega em andamento

async function confirmarPedido() {
  if (estado.modo === "local") return enviarParaComanda();
  const itens = estado.carrinho.map((i) => [i.id, i.qtd, i.extras || [], i.obs || "", i.sem || []]);
  const pagamento = { pag: estado.pagamento, troco: estado.pagamento === "dinheiro" && !estado.semTroco ? valorTroco() : null };
  let p;
  if (estado.modo === "retirada") {
    p = await Fomito.pedidos.criar({ modo: "retirada", cliente: estado.retNome.trim(), telefone: clientes.formatarTelefone(estado.retTel), itens, ...pagamento });
    guardar("fomito.retirada", { nome: estado.retNome.trim(), tel: estado.retTel }); // da próxima vez já vem preenchido
  } else {
    const endereco = estado.cliente.enderecos.find((e) => e.id === estado.enderecoId);
    p = await Fomito.pedidos.criar({
      modo: "entrega", cliente: estado.cliente.nome, telefone: clientes.formatarTelefone(estado.cliente.telefone),
      rua: endereco.rua, numero: endereco.numero, compl: endereco.compl, bairro: endereco.bairro, ref: endereco.ref, itens, ...pagamento,
    });
  }
  minhaEntrega = p.num;
  guardar(CHAVE_ENTREGA, minhaEntrega);
  const retirada = estado.modo === "retirada";
  anteriores.unshift({ tipo: retirada ? "retirada" : "entrega", numero: p.num, titulo: retirada ? "Retirada no balcão" : "Entrega", data: Date.now(), itens: qtdItens(), total: p.total, forma: estado.pagamento });
  guardar(CHAVE_ANTERIORES, anteriores);
  estado.carrinho = [];
  atualizarBarraSacola();
  irPara("acompanhamento");
}

async function enviarParaComanda() {
  const aberta = minhaComanda();
  const mesa = aberta ? aberta.mesa : Number(estado.mesa);
  const jaTinha = !aberta && comandas.daMesa(mesa); // alguém da mesa (ou o garçom) já abriu
  const c = await comandas.lancar(mesa, estado.carrinho, { nome: estado.nomeLocal.trim() });
  minha = { mesa, abertaEm: c.abertaEm };
  guardar(CHAVE_MINHA, minha);
  estado.carrinho = [];
  atualizarBarraSacola();
  renderMinhaComanda();
  irPara("acompanhamento");
  toast(aberta || jaTinha ? `Itens adicionados à comanda da ${comandas.mesaTexto(mesa)}` : `Comanda da ${comandas.mesaTexto(mesa)} aberta`, "mesa");
}

/* --- Tela "Meus pedidos" --- */
/* "Meus pedidos": o que está em andamento (comanda aberta e pedidos ainda não entregues)
   e, embaixo, todos os pedidos anteriores deste celular (entrega, retirada e mesa),
   vindos do servidor. Tocar num cartão abre os detalhes. */
const ATIVOS = ["novo", "preparo", "pronto", "rota"];
function renderAcompanhamento() {
  verificarFechamento();
  const c = minhaComanda();
  const partes = [];
  if (c) partes.push(telaComanda(c));
  const meus = Fomito.pedidos.lista();
  meus.filter((p) => ATIVOS.includes(p.status)).forEach((p) => partes.push(telaEntrega(p)));
  const antigos = [
    ...meus.filter((p) => !ATIVOS.includes(p.status)).map((p) => ({ tipo: p.modo === "local" ? "retirada" : "entrega", chave: `p${p.num}`, data: p.entregueEm || p.canceladoEm || p.criadoEm, p })),
    ...comandas.fechadas().map((f) => ({ tipo: "comanda", chave: `c${f.numero}`, data: f.fechadaEm, f })),
  ].sort((a, b) => b.data - a.data);
  if (antigos.length) partes.push(listaAnteriores(antigos));
  $("#acompanhamento").innerHTML = partes.join(`<hr class="divisor">`) || `
    <div class="vazio"><span class="vazio__icone">${icone("pedidos", "ic--lg")}</span><p>Você ainda não fez nenhum pedido.</p><button class="btn btn--secundario" data-ir="cardapio">Ver cardápio</button></div>`;
}

function telaComanda(c) {
  const servico = comandas.total(c) * 0.1;
  return `
    <div class="status">
      <span class="rotulo">Comanda · ${comandas.mesaTexto(c.mesa)}</span>
      <h3 class="status__titulo" style="font-family:var(--fonte-marca);font-weight:800">${c.pediuConta ? "Conta pedida" : "Comanda aberta"}</h3>
      <span class="suave">${c.pediuConta ? "O garçom já está trazendo a conta." : "Peça mais quando quiser. Você paga tudo no final."}</span>
    </div>
    <div class="card rodadas">
      ${c.rodadas.map((r, i) => {
        const st = comandas.STATUS[r.status];
        return `
          <div class="rodada">
            <div class="entre"><span class="forte">${i + 1}º pedido <span class="pequeno fraco">· ${comandas.hora(r.hora)}${r.por === "garcom" ? " · pelo garçom" : ""}</span></span><span class="tag tag--${st.cor}">${st.nome}</span></div>
            ${r.itens.map((it) => `<div class="entre pequeno"><span>${it.qtd}× ${it.nome || Fomito.produto(it.id).nome}${adicionaisDe(it).length ? ` <span class="fraco">+ ${adicionaisDe(it).map((a) => a.nome).join(", ")}</span>` : ""}${it.obs ? `<br><span class="fraco">${it.obs}</span>` : ""}</span><span class="num">${moeda(comandas.precoItem(it))}</span></div>`).join("")}
          </div>`;
      }).join("")}
      <div class="entre resumo__total"><span class="forte">Total da comanda</span><span class="preco">${moeda(comandas.total(c))}</span></div>
      <span class="pequeno fraco">Serviço de 10% (opcional) cobrado pelo garçom: ${moeda(servico)}</span>
    </div>
    ${c.pediuConta ? `
      <div class="aviso">${icone("conta", "ic--sm")}<span>Pague na mesa com dinheiro, Pix ou cartão. Se quiser, ainda dá para pedir mais.</span></div>` : ""}
    <div class="duas">
      <button class="btn btn--contorno" data-pedir-mais>${icone("mais", "ic--sm")} Pedir mais</button>
      <button class="btn btn--primario" data-pedir-conta ${c.pediuConta ? "disabled" : ""}>${icone("conta", "ic--sm")} ${c.pediuConta ? "Conta pedida" : "Pedir a conta"}</button>
    </div>`;
}

function telaEntrega(pedido) {
  if (pedido.status === "cancelado") return `
    <div class="status">
      <span class="rotulo">Pedido #${pedido.num} · Entrega</span>
      <h3 class="status__titulo" style="font-family:var(--fonte-marca);font-weight:800">Pedido cancelado</h3>
      <span class="suave">A loja cancelou este pedido. Se tiver dúvida, fale com a loja${dados.lanchonete.telefone ? ` pelo ${dados.lanchonete.telefone}` : ""}.</span>
    </div>`;
  if (pedido.modo === "local") return telaRetirada(pedido);
  const passo = etapaDoStatus[pedido.status];
  const atual = etapas[passo];
  const forma = dados.formasPagamento.find((f) => f.id === pedido.pag);
  const pagamento = `Pagamento na entrega: <b>${forma?.nome}</b>${pedido.pag === "dinheiro" ? (pedido.troco ? `, troco para ${moeda(pedido.troco)} (o entregador leva ${moeda(pedido.troco - pedido.total)})` : ", sem troco") : ""}.`;
  const sub = {
    novo: atual.sub,
    preparo: atual.sub,
    pronto: "Pronto! O entregador já vai sair",
    rota: `${pedido.motoboy?.split(" ")[0] || "O entregador"} saiu às ${Fomito.pedidos.hora(pedido.saiuEm)} e está a caminho`,
    concluido: `Entregue às ${Fomito.pedidos.hora(pedido.entregueEm)}. Bom apetite!`,
  }[pedido.status];
  return `
    <div class="status">
      <span class="rotulo">Pedido #${pedido.num} · Entrega</span>
      <h3 class="status__titulo" style="font-family:var(--fonte-marca);font-weight:800">${atual.titulo}</h3>
      <span class="suave">${pedido.status === "concluido" ? sub : `${sub} · previsão ${dados.lanchonete.tempoEntrega}`}</span>
      <div class="status__progresso" style="grid-template-columns:repeat(${etapas.length},1fr)">
        ${etapas.map((_, i) => `<span class="${i < passo || pedido.status === "concluido" ? "feito" : i === passo ? "atual" : ""}"></span>`).join("")}
      </div>
    </div>
    <div class="card linha-tempo">
      ${etapas.map((e, i) => `
        <div class="etapa ${i < passo || pedido.status === "concluido" ? "feita" : ""} ${i === passo && pedido.status !== "concluido" ? "atual" : ""}">
          <span class="etapa__ponto">${icone(i < passo || pedido.status === "concluido" ? "check" : e.icone, "ic--sm")}</span>
          <div><div class="etapa__titulo">${e.titulo}</div><div class="pequeno suave">${i === passo ? sub : e.sub}</div></div>
        </div>`).join("")}
    </div>
    <div class="card resumo">
      <span class="rotulo">Itens</span>
      ${pedido.itens.map((item) => `<div class="entre pequeno"><span>${item[1]}× ${item[5] || Fomito.produto(item[0]).nome}${item[3] ? `<br><span class="fraco">${item[3]}</span>` : ""}</span><span class="num">${moeda(Fomito.pedidos.precoItem(item))}</span></div>`).join("")}
      <div class="entre resumo__total"><span class="forte">Total</span><span class="preco">${moeda(pedido.total)}</span></div>
    </div>
    <div class="aviso">${icone("pin", "ic--sm")}<span>Entregar para <b>${pedido.cliente}</b> em ${pedido.endereco}</span></div>
    <div class="aviso">${icone(forma?.icone || "dinheiro", "ic--sm")}<span>${pagamento}</span></div>`;
}

/* Pedido para retirar no balcão: recebido → em preparo → pronto para retirar → retirado */
function telaRetirada(pedido) {
  const passos = [
    { icone: "recebido", titulo: "Pedido recebido", sub: "Aguardando a lanchonete aceitar" },
    { icone: "chama", titulo: "Em preparo", sub: "Seu pedido está sendo preparado" },
    { icone: "sino", titulo: "Pronto para retirar", sub: "Pode vir buscar no balcão" },
    { icone: "check", titulo: "Retirado", sub: "Bom apetite!" },
  ];
  const passo = { novo: 0, preparo: 1, pronto: 2, concluido: 3 }[pedido.status] ?? 0;
  const feito = pedido.status === "concluido";
  const forma = dados.formasPagamento.find((f) => f.id === pedido.pag);
  return `
    <div class="status">
      <span class="rotulo">Pedido #${pedido.num} · Retirada no balcão</span>
      <h3 class="status__titulo" style="font-family:var(--fonte-marca);font-weight:800">${passos[passo].titulo}</h3>
      <span class="suave">${passos[passo].sub}</span>
      <div class="status__progresso" style="grid-template-columns:repeat(${passos.length},1fr)">
        ${passos.map((_, i) => `<span class="${i < passo || feito ? "feito" : i === passo ? "atual" : ""}"></span>`).join("")}
      </div>
    </div>
    <div class="card linha-tempo">
      ${passos.map((e, i) => `
        <div class="etapa ${i < passo || feito ? "feita" : ""} ${i === passo && !feito ? "atual" : ""}">
          <span class="etapa__ponto">${icone(i < passo || feito ? "check" : e.icone, "ic--sm")}</span>
          <div><div class="etapa__titulo">${e.titulo}</div><div class="pequeno suave">${e.sub}</div></div>
        </div>`).join("")}
    </div>
    <div class="card resumo">
      <span class="rotulo">Itens</span>
      ${pedido.itens.map((item) => `<div class="entre pequeno"><span>${item[1]}× ${item[5] || Fomito.produto(item[0]).nome}${item[3] ? `<br><span class="fraco">${item[3]}</span>` : ""}</span><span class="num">${moeda(Fomito.pedidos.precoItem(item))}</span></div>`).join("")}
      <div class="entre resumo__total"><span class="forte">Total</span><span class="preco">${moeda(pedido.total)}</span></div>
    </div>
    <div class="aviso">${icone("loja", "ic--sm")}<span>Retirar em <b>${dados.lanchonete.endereco || "nosso balcão"}</b> em nome de <b>${pedido.cliente}</b>.</span></div>
    ${forma ? `<div class="aviso">${icone(forma.icone, "ic--sm")}<span>Pagamento na retirada: <b>${forma.nome}</b>${pedido.pag === "dinheiro" && pedido.troco ? `, troco para ${moeda(pedido.troco)}` : ""}.</span></div>` : ""}`;
}

const dataHora = (ts) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " às " + comandas.hora(ts);
const TITULO_TIPO = { entrega: "Entrega", retirada: "Retirada no balcão", comanda: "Comanda" };
const ICONE_TIPO = { entrega: "entrega", retirada: "loja", comanda: "mesa" };

function listaAnteriores(lista) {
  return `
    <div class="pilha" style="gap:10px">
      <span class="rotulo">Pedidos anteriores</span>
      ${lista.map((a) => {
        const cancelado = a.p?.status === "cancelado";
        const numero = a.p ? a.p.num : a.f.numero;
        const titulo = a.tipo === "comanda" ? `Comanda · ${comandas.mesaTexto(a.f.mesa)}` : TITULO_TIPO[a.tipo];
        const itens = a.p ? Fomito.pedidos.qtdItens(a.p) : comandas.qtdItens(a.f);
        const total = a.p ? a.p.total : a.f.total;
        const tag = cancelado ? ["vermelho", "Cancelado"] : a.tipo === "comanda" ? ["verde", "Paga"] : a.tipo === "retirada" ? ["verde", "Retirado"] : ["verde", "Entregue"];
        return `
        <button class="card anterior" data-ver-pedido="${a.chave}">
          <span class="anterior__icone">${icone(ICONE_TIPO[a.tipo], "ic--sm")}</span>
          <div class="pilha" style="gap:0;flex:1;min-width:0;text-align:left"><span class="forte">${titulo}</span><span class="pequeno suave">#${numero} · ${dataHora(a.data)} · ${itens} ${itens === 1 ? "item" : "itens"}</span></div>
          <div class="pilha" style="gap:2px;align-items:flex-end"><span class="num forte">${moeda(total)}</span><span class="tag tag--${tag[0]}">${tag[1]}</span></div>
          <span class="anterior__seta">${icone("seta", "ic--sm")}</span>
        </button>`;
      }).join("")}
    </div>`;
}

/* Detalhes de um pedido anterior: itens, pagamento e quanto foi pago */
function abrirDetalhePedido(chave) {
  const tipoChave = chave[0];
  const numero = Number(chave.slice(1));
  const p = tipoChave === "p" ? Fomito.pedidos.doNumero(numero) : null;
  const f = tipoChave === "c" ? comandas.fechadas().find((x) => x.numero === numero) : null;
  if (!p && !f) return;
  const formas = Object.fromEntries(dados.formasPagamento.map((x) => [x.id, x.nome]));
  const linhaItem = (qtd, nome, valor, obs, extras = []) => `
    <div class="detalhe-item">
      <div class="entre"><span><b>${qtd}×</b> ${nome}</span><span class="num">${moeda(valor)}</span></div>
      ${extras.length ? `<span class="pequeno suave">+ ${extras.join(", ")}</span>` : ""}
      ${obs ? `<span class="pequeno detalhe-item__obs">${obs}</span>` : ""}
    </div>`;
  const nomesExtras = (id, ids = []) => (dados.adicionais[Fomito.produto(id).cat] || []).filter((a) => ids.includes(a.id)).map((a) => a.nome);
  let corpo;
  if (p) {
    const retirada = p.modo === "local";
    const subtotal = p.itens.reduce((s, it) => s + Fomito.pedidos.precoItem(it), 0);
    const pago = p.pagoCom
      ? `${formas[p.pagoCom] || p.pagoCom}${p.recebido ? ` · você deu ${moeda(p.recebido)}${p.trocoDado ? `, troco de ${moeda(p.trocoDado)}` : ""}` : ""}`
      : `${formas[p.pag] || "-"}${p.pag === "dinheiro" && p.troco ? ` · troco para ${moeda(p.troco)}` : ""}`;
    corpo = `
      <div class="detalhe-cabeca">
        <span class="tag tag--${p.status === "cancelado" ? "vermelho" : "verde"}">${p.status === "cancelado" ? "Cancelado" : retirada ? "Retirado" : "Entregue"}</span>
        <span class="pequeno suave">${dataHora(p.criadoEm)}</span>
      </div>
      <div class="detalhe-bloco"><span class="rotulo">Itens</span>
        ${p.itens.map((it) => linhaItem(it[1], it[5] || Fomito.produto(it[0]).nome, Fomito.pedidos.precoItem(it), it[3], nomesExtras(it[0], it[2]))).join("")}
        <div class="detalhe-totais">
          <div class="entre pequeno"><span class="suave">Subtotal</span><span class="num">${moeda(subtotal)}</span></div>
          ${retirada ? "" : `<div class="entre pequeno"><span class="suave">Taxa de entrega</span><span class="num">${Fomito.taxaTexto(p.taxa ?? 0)}</span></div>`}
          <div class="entre"><span class="forte">Total</span><span class="preco">${moeda(p.total)}</span></div>
        </div>
      </div>
      <div class="detalhe-bloco"><span class="rotulo">Pagamento</span>
        <span>${p.status === "cancelado" ? "Pedido cancelado: nada foi cobrado." : pago}</span>
        ${p.status === "cancelado" ? "" : `<span class="pequeno suave">Valor pago: <b>${moeda(p.total)}</b>${retirada ? " na retirada" : " na entrega"}</span>`}
      </div>
      <div class="detalhe-bloco"><span class="rotulo">${retirada ? "Retirada" : "Entrega"}</span>
        <span class="pequeno">${retirada ? `No balcão, em nome de ${p.cliente}` : `${p.cliente} · ${p.endereco}`}</span>
        ${!retirada && p.motoboy && p.entregueEm ? `<span class="pequeno suave">Entregue por ${p.motoboy.split(" ")[0]} às ${comandas.hora(p.entregueEm)}</span>` : ""}
      </div>`;
  } else {
    const consumo = comandas.total(f);
    corpo = `
      <div class="detalhe-cabeca">
        <span class="tag tag--verde">Paga</span>
        <span class="pequeno suave">${comandas.hora(f.abertaEm)} – ${comandas.hora(f.fechadaEm)} · ${dataHora(f.fechadaEm).split(" às ")[0]}</span>
      </div>
      <div class="detalhe-bloco"><span class="rotulo">Itens</span>
        ${f.rodadas.flatMap((r) => r.itens).map((it) => linhaItem(it.qtd, it.nome || Fomito.produto(it.id).nome, comandas.precoItem(it), it.obs, nomesExtras(it.id, it.extras))).join("")}
        <div class="detalhe-totais">
          <div class="entre pequeno"><span class="suave">Consumo</span><span class="num">${moeda(consumo)}</span></div>
          ${f.servico ? `<div class="entre pequeno"><span class="suave">Serviço (10%)</span><span class="num">${moeda(f.servico)}</span></div>` : ""}
          <div class="entre"><span class="forte">Total</span><span class="preco">${moeda(f.total)}</span></div>
        </div>
      </div>
      <div class="detalhe-bloco"><span class="rotulo">Pagamento</span>
        ${(f.pagamentos || []).map((pg) => `<div class="entre pequeno"><span>${formas[pg.forma] || pg.forma}${pg.recebido ? ` <span class="suave">(deu ${moeda(pg.recebido)}, troco ${moeda(pg.troco || 0)})</span>` : ""}</span><span class="num">${moeda(pg.valor)}</span></div>`).join("") || `<span>${formas[f.forma] || "-"}</span>`}
        <span class="pequeno suave">Valor pago: <b>${moeda(f.total)}</b></span>
      </div>`;
  }
  const titulo = p ? `Pedido #${p.num} · ${TITULO_TIPO[p.modo === "local" ? "retirada" : "entrega"]}` : `Comanda #${f.numero} · ${comandas.mesaTexto(f.mesa)}`;
  const camada = document.createElement("div");
  camada.className = "sobreposicao detalhe-pedido";
  camada.innerHTML = `
    <div class="folha detalhe-pedido__folha">
      <div class="folha__topo"><h2>${titulo}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
      ${corpo}
      <button class="btn btn--contorno btn--bloco" data-fechar>Fechar</button>
    </div>`;
  document.body.appendChild(camada);
  camada.addEventListener("click", (e) => { if (e.target === camada || e.target.closest("[data-fechar]")) camada.remove(); });
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ver-pedido]");
  if (b) abrirDetalhePedido(b.dataset.verPedido);
});

/* Botões da comanda (no início e em "Meus pedidos") */
document.addEventListener("click", async (e) => {
  if (e.target.closest("[data-pedir-mais]")) {
    irPara("cardapio");
    return $("#categorias").scrollIntoView({ behavior: "smooth" });
  }
  const c = minhaComanda();
  if (!c) return;
  if (e.target.closest("[data-pedir-conta]")) {
    await comandas.pedirConta(c.mesa);
    toast("O garçom foi avisado e já traz a sua conta", "conta");
    return atualizarTelas();
  }
});

/* O garçom pode mexer na comanda em outro aparelho: confere a cada 3 segundos */
let ultimaVersao = "";
function atualizarTelas() {
  renderMinhaComanda();
  if (!$('[data-tela="acompanhamento"]').hidden) renderAcompanhamento();
}
const verificarMudancasCliente = () => {
  const versao = JSON.stringify([minha ? comandas.daMesa(minha.mesa) : null,
    Fomito.pedidos.lista().map((p) => [p.num, p.status, p.motoboy]), comandas.fechadas().map((f) => f.numero)]);
  if (versao !== ultimaVersao) { ultimaVersao = versao; atualizarTelas(); }
};
setInterval(verificarMudancasCliente, 3000);
/* O servidor avisa na hora quando algo muda (pedido novo, pronto, conta...): confere sem esperar os 3 s */
document.addEventListener("fomito:estado", verificarMudancasCliente);

/* Voltar (seta do topo) no finalizar: da telinha do endereço ou do pagamento volta um passo, sem sair */
$('[data-tela="checkout"] .cabecalho [data-ir]').addEventListener("click", (e) => {
  if (estado.novoEndereco || estado.editandoEndereco != null) Object.assign(estado, { novoEndereco: false, editandoEndereco: null });
  else if (estado.etapaCheckout === 2) estado.etapaCheckout = 1;
  else return; // etapa 1: volta para a sacola
  e.stopPropagation();
  renderCheckout();
  window.scrollTo(0, 0);
});

/* ---------- 8. INÍCIO ---------- */
function renderLoja() {
  const loja = dados.lanchonete;
  const marca = Fomito.config.ler().marca;
  $("#logo").innerHTML = Fomito.config.simbolo(marca);
  $("#nomeLoja").textContent = marca.nome;
  $("#sloganLoja").textContent = marca.slogan;
  /* Dias e horário de funcionamento e o endereço com o link do mapa */
  const funcionamento = Fomito.textoFuncionamento(loja);
  $("#horarioLoja").textContent = funcionamento;
  $("#blocoHorario").hidden = !funcionamento;
  const mapa = Fomito.linkMapa(loja);
  $("#localLoja").hidden = !loja.endereco;
  $("#localLoja").href = mapa || "#";
  $("#enderecoLoja").textContent = loja.endereco || "";
  $("#taxaLoja").textContent = loja.taxaEntrega > 0 ? `Entrega ${moeda(loja.taxaEntrega)}` : "Frete grátis";
  $("#rodapeNome").textContent = marca.nome;
  $("#rodapeEndereco").textContent = loja.endereco;
  $("#rodapeHorario").textContent = funcionamento;
  const aberta = loja.aberta !== false;
  $("#statusLoja").textContent = aberta ? "Aberto" : "Fechado agora";
  $("#statusLoja").className = `tag tag--${aberta ? "verde" : "cinza"}`;
}

/* O dono mudou o cardápio ou a marca no painel: redesenha sem perder a sacola */
document.addEventListener("fomito:loja", () => {
  estado.carrinho = estado.carrinho.filter((i) => dados.produtos.some((p) => p.id === i.id));
  renderLoja();
  renderDestaques();
  renderCategorias();
  renderProdutos();
  atualizarBarraSacola();
  if (!$('[data-tela="checkout"]').hidden) renderRodapeCheckout();
});

renderLoja();
renderMinhaComanda();
renderVitrine();
renderDestaques();
renderCategorias();
renderProdutos();
atualizarBarraSacola();
