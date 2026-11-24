/* ==========================================================================
   FOMITO · APP DO CLIENTE (lógica do protótipo)
   --------------------------------------------------------------------------
   Organização:
     1. Estado        → tudo que a tela "lembra"
     2. Navegação     → troca entre as telas
     3. Cardápio      → categorias, busca e lista de produtos
     4. Produto       → tela com galeria de fotos, ingredientes e adicionais
     5. Sacola
     6. Finalizar     → entrega ou local, cadastro pelo telefone, endereços, pagamento e troco
     7. Acompanhamento
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
  etapaPedido: 0,
  /* Finalizar pedido */
  etapaCliente: "telefone", // "telefone" → "identificado"
  telefone: "",
  cliente: null,            // cadastro encontrado ou criado (clientes.js)
  enderecoId: null,
  novoEndereco: false,      // formulário de "Adicionar novo endereço" aberto?
  mesa: "7",
  nomeLocal: "",
};
const iniciais = (nome) => nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

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
    <div class="entre linha-total"><span class="forte">Subtotal</span><span class="preco">${moeda(subtotal())}</span></div>
    <span class="pequeno fraco">Entrega ou comer no local: você escolhe no próximo passo.</span>
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

/* ---------- 6. FINALIZAR ----------
   Ordem da tela:
     a) Como você quer receber? (Entrega ou Comer no local)
     b) Entrega → telefone → cadastro novo OU endereços salvos → pagamento
        Local   → mesa e nome (paga com o garçom)
     c) Resumo do pedido
*/
const { clientes } = Fomito;

function renderCheckout() {
  const entrega = estado.modo === "entrega";
  $("#checkout").innerHTML = `
    <div class="bloco">
      <h3 class="bloco__titulo">Como você quer receber?</h3>
      <div class="modo-escolha">
        <button class="modo-card ${entrega ? "ativo" : ""}" data-modo="entrega">
          <span class="modo-card__icone">${icone("entrega")}</span>
          <b>Entrega</b><span>${dados.lanchonete.tempoEntrega} · ${moeda(dados.lanchonete.taxaEntrega)}</span>
        </button>
        <button class="modo-card ${!entrega ? "ativo" : ""}" data-modo="local">
          <span class="modo-card__icone">${icone("local")}</span>
          <b>Comer no local</b><span>Na mesa · sem taxa</span>
        </button>
      </div>
    </div>
    ${entrega ? blocoCliente() + (estado.cliente ? blocoPagamento() : "") : blocoLocal()}
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("pedidos")} Resumo</h3>
      ${estado.carrinho.map((i) => `<div class="entre pequeno"><span>${i.qtd}× ${Fomito.produto(i.id).nome}</span><span class="num">${moeda(precoUnitario(i) * i.qtd)}</span></div>`).join("")}
    </div>`;
  renderRodapeCheckout();
  ligarEventosTroco();
}

/* --- Comer no local --- */
function blocoLocal() {
  return `
    <div class="bloco">
      <h3 class="bloco__titulo">${icone("local")} Sua mesa</h3>
      <div class="duas">
        <div class="campo"><label for="mesa">Número da mesa</label><input id="mesa" class="input" type="number" min="1" value="${estado.mesa}"></div>
        <div class="campo"><label for="nomeLocal">Seu nome</label><input id="nomeLocal" class="input" placeholder="Como te chamamos" value="${estado.nomeLocal}"></div>
      </div>
      <div class="aviso">${icone("info", "ic--sm")}<span>No consumo local, o pagamento é feito com o garçom quando você pedir a conta.</span></div>
    </div>`;
}

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
      <p class="demo">Teste: (11) 98888-7777 já tem cadastro com 2 endereços. Qualquer outro número abre o cadastro novo.</p>
    </div>`;

  const topo = `
    <div class="cliente-topo">
      <span class="cliente-topo__avatar">${c ? iniciais(c.nome) : icone("usuario", "ic--sm")}</span>
      <div class="pilha" style="gap:0;flex:1;min-width:0">
        <span class="forte">${c ? `Olá, ${c.nome.split(" ")[0]}!` : "Primeira vez por aqui?"}</span>
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
        ${c.enderecos.map((e) => `
          <button class="opcao ${e.id === estado.enderecoId ? "ativa" : ""}" data-endereco="${e.id}">
            <span class="opcao__icone">${icone(e.apelido === "Trabalho" ? "loja" : "pin")}</span>
            <span class="opcao__texto"><span class="opcao__titulo">${e.apelido}</span><span class="opcao__sub">${clientes.textoEndereco(e)}${e.ref ? `<br>Ref.: ${e.ref}` : ""}</span></span>
            <span class="opcao__radio"></span>
          </button>`).join("")}
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
function formEndereco(apelidoPadrao) {
  return `
    <div class="campo"><label>Nome do endereço</label>
      <div class="apelidos" id="apelidos">${["Casa", "Trabalho", "Outro"].map((a) => `<button class="apelido ${a === apelidoPadrao ? "ativo" : ""}" data-apelido="${a}">${a}</button>`).join("")}</div>
    </div>
    <div class="campo"><label for="endRua">Rua e número</label><input id="endRua" class="input" autocomplete="street-address" placeholder="Ex.: Rua das Flores, 120"></div>
    <div class="duas">
      <div class="campo"><label for="endBairro">Bairro</label><input id="endBairro" class="input" placeholder="Bairro"></div>
      <div class="campo"><label for="endCompl">Complemento</label><input id="endCompl" class="input" placeholder="Apto, bloco"></div>
    </div>
    <div class="campo"><label for="endRef">Ponto de referência <span class="fraco">(opcional)</span></label><input id="endRef" class="input" placeholder="Ex.: portão verde"></div>`;
}

/* Lê os campos de endereço. Retorna null (e mostra o erro) se faltar algo. */
function lerEndereco() {
  const valor = (id) => $(id).value.trim();
  const endereco = { apelido: $(".apelido.ativo").dataset.apelido, rua: valor("#endRua"), bairro: valor("#endBairro"), compl: valor("#endCompl"), ref: valor("#endRef") };
  if (!endereco.rua || !endereco.bairro) return mostrarErro("Preencha a rua com número e o bairro."), null;
  return endereco;
}
function mostrarErro(texto) {
  $("#erroCadastro").textContent = texto;
  $("#erroCadastro").hidden = false;
}

/* --- Pagamento na entrega --- */
function blocoPagamento() {
  return `
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
}

/* --- Cliques e digitação da tela de finalizar --- */
function buscarTelefone() {
  estado.telefone = clientes.soDigitos($("#tel").value);
  if (!clientes.telefoneValido(estado.telefone)) return toast("Digite o celular com DDD", "info");
  estado.cliente = clientes.buscar(estado.telefone);
  estado.etapaCliente = "identificado";
  renderCheckout();
  if (estado.cliente) toast(`Cadastro encontrado: ${estado.cliente.enderecos.length} endereço(s) salvo(s)`, "check");
}

$("#checkout").addEventListener("click", (e) => {
  const modo = e.target.closest("[data-modo]");
  if (modo) { estado.modo = modo.dataset.modo; return renderCheckout(); }

  if (e.target.closest("#buscarTel")) return buscarTelefone();
  if (e.target.closest("#trocarTel")) {
    Object.assign(estado, { etapaCliente: "telefone", cliente: null, novoEndereco: false });
    renderCheckout();
    return $("#tel").focus();
  }

  const apelido = e.target.closest("[data-apelido]");
  if (apelido) return $$(".apelido").forEach((a) => a.classList.toggle("ativo", a === apelido));

  const endereco = e.target.closest("[data-endereco]");
  if (endereco) { estado.enderecoId = Number(endereco.dataset.endereco); return renderCheckout(); }

  if (e.target.closest("#novoEndereco")) { estado.novoEndereco = true; renderCheckout(); return $("#endRua").focus(); }
  if (e.target.closest("#cancelarEndereco")) { estado.novoEndereco = false; return renderCheckout(); }

  if (e.target.closest("#salvarEndereco")) {
    const end = lerEndereco();
    if (!end) return;
    estado.enderecoId = clientes.adicionarEndereco(estado.telefone, end).id;
    estado.cliente = clientes.buscar(estado.telefone);
    estado.novoEndereco = false;
    renderCheckout();
    return toast("Endereço salvo no seu cadastro", "pin");
  }

  if (e.target.closest("#salvarCadastro")) {
    const nome = $("#cadNome").value.trim();
    if (nome.length < 3) return mostrarErro("Digite seu nome.");
    const end = lerEndereco();
    if (!end) return;
    estado.cliente = clientes.cadastrar({ telefone: estado.telefone, nome, endereco: end });
    estado.enderecoId = estado.cliente.enderecos[0].id;
    renderCheckout();
    return toast("Cadastro salvo! Da próxima vez é só o celular.", "check");
  }
});

$("#checkout").addEventListener("input", (e) => {
  if (e.target.id === "tel") e.target.value = clientes.formatarTelefone(e.target.value);
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
  if (estado.modo === "local") return Number(estado.mesa) > 0 && estado.nomeLocal.trim().length > 1;
  if (!estado.cliente || estado.novoEndereco) return false;
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
  const endereco = estado.cliente?.enderecos.find((e) => e.id === estado.enderecoId);
  estado.pedido = {
    numero: 1000 + Math.floor(Math.random() * 900), modo: estado.modo, itens: [...estado.carrinho], total: total(),
    pagamento: estado.pagamento, troco: estado.semTroco ? null : valorTroco(),
    cliente: estado.modo === "entrega" ? estado.cliente.nome : estado.nomeLocal.trim(),
    endereco: endereco ? `${endereco.apelido}: ${clientes.textoEndereco(endereco)}` : null,
    mesa: estado.mesa,
  };
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
      <span class="suave">${pedido.modo === "entrega" ? `Previsão de entrega: ${dados.lanchonete.tempoEntrega}` : `Mesa ${pedido.mesa} · ${pedido.cliente}`}</span>
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
    ${pedido.endereco ? `<div class="aviso">${icone("pin", "ic--sm")}<span>Entregar para <b>${pedido.cliente}</b> em ${pedido.endereco}</span></div>` : ""}
    <div class="aviso">${icone(pedido.modo === "entrega" ? (forma?.icone || "dinheiro") : "usuario", "ic--sm")}<span>${pagamento}</span></div>
    <p class="demo">Protótipo: o status avança sozinho a cada 4 segundos.</p>`;
}

/* ---------- 8. INÍCIO ---------- */
const loja = dados.lanchonete;
$("#logo").innerHTML = Fomito.config.simbolo(Fomito.config.ler().marca);
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
