/* ==========================================================================
   FOMITO · PAINEL › DETALHE DO PEDIDO E LANÇAR PEDIDO
   --------------------------------------------------------------------------
   Carregado antes do painel.js (usa Fomito.pedidos, acaoDoPedido, totalPedido...).
     1. Detalhe do pedido: abre ao clicar num card do quadro
     2. Lançar pedido: para pedidos por telefone, balcão ou mesa
   ========================================================================== */

const hora = (ts) => Fomito.pedidos.hora(ts);

/* ---------- 1. DETALHE DO PEDIDO ---------- */
/* "pedido" vem quando é de um dia anterior (Caixa → Fechamentos anteriores): só leitura, sem ações */
function abrirPedido(num, pedido) {
  const antigo = !!pedido;
  const p = antigo ? Fomito.pedidos.completar(pedido) : Fomito.pedidos.doNumero(num);
  const forma = Fomito.formaPag(p.pag) || { icone: "dinheiro", nome: "Pagamento" };
  const entrega = p.modo === "entrega";
  const subtotalPedido = p.itens.reduce((s, item) => s + precoItem(item), 0);
  const passo = ["novo", "preparo", "pronto", "rota", "concluido"].indexOf(p.status);
  /* [ícone, etapa, quando, já aconteceu?] */
  const etapas = [
    ["recebido", "Pedido recebido", p.criadoEm, true],
    ["chama", "Aceito e em preparo", null, passo >= 1],
    ["sino", entrega ? "Pronto · motoboys avisados" : "Pronto para retirar", p.prontoEm, passo >= 2],
    ...(entrega ? [["entrega", `Saiu para entrega${p.motoboy ? ` com ${p.motoboy}` : ""}`, p.saiuEm, passo >= 3]] : []),
    ["concluido", entrega ? "Entregue e pago" : "Retirado no balcão", p.entregueEm, passo >= 4],
  ];
  const acao = acaoDoPedido(p);
  const cadastro = p.telefone && Fomito.clientes.buscar(p.telefone);
  /* O servidor guarda em p.whats a última mensagem que o WhatsApp confirmou */
  const mensagens = entrega && p.whats && p.status !== "cancelado" ? [`Última mensagem enviada: ${p.whats}`] : [];
  const pagoCom = Fomito.formaPag(p.pagoCom);

  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--lado";
  camada.innerHTML = `
    <div class="folha folha--lado">
      <div class="folha__topo">
        <div class="pilha" style="gap:4px">
          <h2 class="num">Pedido #${p.num}</h2>
          <span class="linha" style="gap:6px">${tagStatus(p.status)}<span class="tag ${entrega ? "tag--roxo" : "tag--cinza"}">${entrega ? "Entrega" : "Balcão"}</span><span class="pequeno fraco">${antigo ? new Date(p.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às") : `às ${hora(p.criadoEm)}`}</span></span>
        </div>
        <button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button>
      </div>

      ${p.status === "cancelado" ? `
        <div class="ficha-bloco">
          <span class="rotulo">Cancelamento</span>
          ${motivoCancelado(p)}
          ${p.whats === "Pedido cancelado" ? `<span class="linha pequeno" style="gap:8px;color:#15803D">${icone("whatsapp", "ic--sm")}O cliente recebeu o motivo no WhatsApp</span>` : ""}
        </div>` : ""}

      <div class="ficha-bloco">
        <span class="rotulo">Cliente</span>
        <div class="entre"><span class="forte">${p.cliente}</span>${cadastro ? `<button class="link" data-ver-cliente="${cadastro.telefone}">Ver cadastro</button>` : ""}</div>
        ${p.telefone ? `<span class="linha pequeno suave" style="gap:8px">${icone("telefone", "ic--sm")}${p.telefone}</span>` : ""}
        ${p.endereco ? `<span class="linha pequeno suave" style="gap:8px;align-items:flex-start">${icone("pin", "ic--sm")}${p.endereco}</span>` : ""}
        ${p.ref ? `<span class="pequeno suave" style="padding-left:24px">Referência: ${p.ref}</span>` : ""}
        ${!entrega ? `<span class="linha pequeno suave" style="gap:8px">${icone("loja", "ic--sm")}Retirada no balcão</span>` : ""}
      </div>

      <div class="ficha-bloco">
        <span class="rotulo">Itens</span>
        ${p.itens.map((item) => {
          const [id, qtd, extras = [], obs] = item;
          const prod = Fomito.produto(id);
          const nomesExtras = Fomito.todosAdicionaisDo(prod).filter((a) => extras.includes(a.id));
          return `
            <div class="item-pedido">
              ${prod ? Fomito.foto(prod, 40) : ""}
              <div class="pilha" style="gap:1px;flex:1;min-width:0">
                <span class="forte">${qtd}× ${item[5] || prod?.nome || "Item"}</span>
                ${nomesExtras.map((a) => `<span class="pequeno suave">+ ${a.nome}</span>`).join("")}
                ${obs ? `<span class="pequeno obs">Obs.: ${obs}</span>` : ""}
              </div>
              <span class="num">${moeda(precoItem(item))}</span>
            </div>`;
        }).join("")}
        <div class="totais">
          <div class="entre pequeno"><span class="suave">Subtotal</span><span class="num">${moeda(subtotalPedido)}</span></div>
          ${entrega ? `<div class="entre pequeno"><span class="suave">Taxa de entrega</span><span class="num">${Fomito.taxaTexto(p.taxa ?? dados.lanchonete.taxaEntrega)}</span></div>` : ""}
          <div class="entre"><span class="forte">Total</span><span class="preco">${moeda(totalPedido(p))}</span></div>
        </div>
      </div>

      <div class="ficha-bloco">
        <span class="rotulo">Pagamento</span>
        ${entrega
          ? `<span class="linha" style="gap:8px">${icone(forma.icone, "ic--sm")}${forma.nome} na entrega</span>
             ${p.pag === "dinheiro" && p.troco ? `<div class="troco-painel">Troco para <b>${moeda(p.troco)}</b> · levar <b>${moeda(p.troco - totalPedido(p))}</b></div>` : ""}
             ${pagoCom ? `<div class="pedido__situacao pedido__situacao--concluido">${icone("check", "ic--sm")}<span>${p.motoboy} recebeu no ${pagoCom.nome.toLowerCase()}${p.recebido ? `: ${moeda(p.recebido)}, troco de ${moeda(p.trocoDado || 0)}` : ""}. Já está no caixa.</span></div>` : ""}`
          : `<span class="linha" style="gap:8px">${icone(p.pag ? forma.icone : "usuario", "ic--sm")}${p.pag ? `${forma.nome} na retirada` : "No balcão, na retirada"}</span>
             ${pagoCom ? `<div class="pedido__situacao pedido__situacao--concluido">${icone("check", "ic--sm")}<span>Pago no ${pagoCom.nome.toLowerCase()}${p.recebido ? `: recebeu ${moeda(p.recebido)}, troco de ${moeda(p.trocoDado || 0)}` : ""}. Já está no caixa.</span></div>` : ""}`}
      </div>

      <div class="ficha-bloco">
        <span class="rotulo">Andamento</span>
        <div class="andamento">
          ${etapas.map(([ic, titulo, quando, feita]) => `
            <div class="andamento__etapa ${feita ? "feita" : ""}">
              <span class="andamento__ponto">${icone(feita ? "check" : ic, "ic--sm")}</span>
              <span class="flex1">${titulo}</span><span class="pequeno fraco num">${feita && quando ? hora(quando) : "-"}</span>
            </div>`).join("")}
        </div>
      </div>

      ${mensagens.length ? `
        <div class="ficha-bloco">
          <span class="rotulo">WhatsApp enviado ao cliente</span>
          ${mensagens.map((m) => `<div class="linha pequeno" style="gap:8px;color:#15803D">${icone("whatsapp", "ic--sm")}${m}</div>`).join("")}
        </div>` : ""}

      ${antigo ? `<button class="btn btn--contorno btn--bloco" data-fechar>Fechar</button>` : `<div class="acoes-pedido">
        <button class="btn btn--contorno" data-fechar data-cupom="${p.num}">${icone("impressora", "ic--sm")} Imprimir</button>
        ${!["concluido", "cancelado"].includes(p.status) ? `<button class="btn btn--contorno" data-fechar data-cancelar-pedido="${p.num}" style="color:var(--vermelho-escuro)">Cancelar</button>` : ""}
        ${acao ? `<button class="btn btn--primario" data-fechar data-avancar="${p.num}" style="flex:1">${acao.texto}</button>` : ""}
      </div>`}
    </div>`;
  document.body.appendChild(camada);
  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) camada.remove();
    const verCliente = e.target.closest("[data-ver-cliente]");
    if (verCliente) { camada.remove(); abrirCliente(verCliente.dataset.verCliente); }
  });
}

/* ---------- Cancelar com motivo ----------
   O motivo vai para o cliente no WhatsApp ("Oi, Ana, tudo bem? Seu pedido #1042 foi cancelado. Motivo: ...")
   e fica no pedido: no painel (Concluídos e detalhe) e em Meus pedidos do cliente. */
const MOTIVOS_RAPIDOS = ["Produto esgotado", "Fora da área de entrega", "Loja muito cheia agora", "Vamos fechar mais cedo hoje", "Pedido repetido", "O cliente pediu para cancelar"];
const ESGOTADO = "Produto esgotado";
const escPed = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function cancelarComMotivo(num) {
  const p = Fomito.pedidos.doNumero(num);
  const cfg = Fomito.config.ler();
  const modelo = cfg.whatsapp.modelos.cancelado;
  /* Um botão por produto do pedido: "Acabou: X-Burguer" vira "Produto esgotado: X-Burguer" */
  const produtos = [...new Set(p.itens.map((item) => nomeItem(item)))].slice(0, 4);
  const vaiNoWhats = modelo?.ativo && p.telefone;
  const previa = (motivo) => Fomito.config.montarMensagem(modelo.texto, {
    nome: String(p.cliente || "").split(" ")[0], pedido: p.num, loja: cfg.marca.nome, total: moeda(totalPedido(p)),
    motivo: escPed(String(motivo || "…").replace(/[.!\s]+$/, "")),
  });
  const aviso = !vaiNoWhats
    ? `<div class="aviso">${icone("info", "ic--sm")}<span>${p.telefone ? "A mensagem de cancelamento está desligada em Configurações → WhatsApp." : "Este pedido não tem celular: o cliente não recebe mensagem."}</span></div>`
    : !cfg.whatsapp.conectado
      ? `<div class="aviso">${icone("info", "ic--sm")}<span>O WhatsApp da loja está desconectado: o motivo fica no pedido, mas a mensagem não sai.</span></div>`
      : "";
  const r = await Fomito.dialogo({
    titulo: `Cancelar o pedido #${num}?`,
    topo: `
      <p class="suave dialogo__texto">Escolha um motivo ou escreva o seu.${vaiNoWhats ? ` ${escPed(String(p.cliente).split(" ")[0])} recebe no WhatsApp.` : ""}</p>
      <div class="pilha" style="gap:6px">
        <span class="rotulo">Motivos rápidos</span>
        <div class="motivos-rapidos">
          ${MOTIVOS_RAPIDOS.map((m) => `<button type="button" class="motivo-rapido" data-motivo-rapido="${escPed(m)}">${escPed(m)}</button>`).join("")}
        </div>
        ${produtos.length ? `
          <span class="rotulo">Acabou algum item?</span>
          <div class="motivos-rapidos">
            ${produtos.map((n) => `<button type="button" class="motivo-rapido" data-motivo-esgotado="${escPed(n)}">Acabou: ${escPed(n)}</button>`).join("")}
          </div>` : ""}
      </div>`,
    campos: [{ id: "motivo", rotulo: "Motivo do cancelamento", tipo: "textarea", obrigatorio: true, max: 200, placeholder: "Ex.: acabou o hambúrguer hoje" }],
    confirmar: "Cancelar pedido", cancelar: "Voltar", perigo: true,
    aoDigitar: (v, camada) => {
      const bolha = camada.querySelector("[data-previa-cancelado]");
      if (bolha) bolha.innerHTML = previa(v.motivo);
      camada.querySelectorAll("[data-motivo-rapido]").forEach((b) => b.classList.toggle("ativo", b.dataset.motivoRapido === v.motivo));
      camada.querySelectorAll("[data-motivo-esgotado]").forEach((b) => b.classList.toggle("ativo", v.motivo.startsWith(ESGOTADO + ":") && v.motivo.includes(b.dataset.motivoEsgotado)));
    },
  }, (camada) => {
    /* Prévia da mensagem logo abaixo do campo, como no WhatsApp */
    const campo = camada.querySelector(".campo");
    campo.insertAdjacentHTML("afterend", `${vaiNoWhats ? `<div class="pilha previa-whats" style="gap:6px"><span class="rotulo">Mensagem para o cliente</span><div class="bolha" data-previa-cancelado>${previa("")}</div></div>` : ""}${aviso}`);
  });
  if (!r) return;
  try {
    await Fomito.pedidos.cancelar(num, r.motivo);
    pedidosSincronizados();
    renderPedidos();
    toast(`Pedido #${num} cancelado${vaiNoWhats && cfg.whatsapp.conectado ? ". Motivo enviado no WhatsApp" : ""}`, vaiNoWhats ? "whatsapp" : "info");
  } catch (err) { toast(err.message, "info"); }
}

/* Toque numa sugestão: preenche o motivo (e junta os itens que acabaram) */
document.addEventListener("click", (e) => {
  const rapido = e.target.closest("[data-motivo-rapido], [data-motivo-esgotado]");
  if (!rapido) return;
  const campo = rapido.closest("form").querySelector('[data-campo-dialogo="motivo"]');
  const item = rapido.dataset.motivoEsgotado;
  if (item) {
    const ja = campo.value.startsWith(ESGOTADO + ":") ? campo.value.slice(ESGOTADO.length + 1).split(",").map((x) => x.trim()).filter(Boolean) : [];
    const lista = ja.includes(item) ? ja.filter((x) => x !== item) : [...ja, item];
    campo.value = lista.length ? `${ESGOTADO}: ${lista.join(", ")}` : "";
  } else campo.value = rapido.dataset.motivoRapido;
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  campo.focus();
});

document.addEventListener("click", async (e) => {
  const cancelar = e.target.closest("[data-cancelar-pedido]");
  if (cancelar) return cancelarComMotivo(Number(cancelar.dataset.cancelarPedido));
  if (e.target.closest("button, a, input, label")) return;
  const card = e.target.closest("[data-pedido]");
  if (card) abrirPedido(Number(card.dataset.pedido));
});

/* ---------- 2. LANÇAR PEDIDO (telefone, balcão ou mesa) ---------- */
let novo = null; // rascunho do pedido sendo lançado

function abrirLancarPedido() {
  /* A loja só lança pedido com o caixa de hoje aberto */
  if (!Fomito.turno.conferir({ novo: true })) return;
  novo = { modo: "entrega", telefone: "", buscou: false, cliente: null, enderecoId: null, mesa: "1", nome: "", itens: {}, pag: Fomito.formasAtivas()[0]?.id || "dinheiro", troco: "", cat: dados.categorias[0]?.id || "", busca: "" };
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  camada.id = "lancarPedido";
  camada.innerHTML = `<div class="folha folha--larga"></div>`;
  document.body.appendChild(camada);
  renderLancarPedido();
  camada.addEventListener("click", cliqueLancar);
  camada.addEventListener("input", digitacaoLancar);
}

const itensNovo = () => Object.entries(novo.itens).filter(([, q]) => q > 0).map(([id, q]) => [Number(id), q]);
const totalNovo = () => itensNovo().reduce((s, [id, q]) => s + Fomito.produto(id).preco * q, 0) + (novo.modo === "entrega" ? dados.lanchonete.taxaEntrega : 0);

function renderLancarPedido() {
  const modos = [["entrega", "entrega", "Entrega"], ["balcao", "loja", "Balcão"], ["mesa", "mesa", "Mesa"]];
  $("#lancarPedido .folha").innerHTML = `
    <div class="folha__topo">
      <div class="pilha" style="gap:2px"><h2>Lançar pedido</h2><span class="pequeno suave">Para pedidos que chegam por telefone, no balcão ou na mesa.</span></div>
      <button class="btn-icone" data-fechar-lancar aria-label="Fechar">${icone("fechar")}</button>
    </div>
    <div class="lancar">
      <div class="lancar__coluna">
        <nav class="filtros" style="width:100%">${modos.map(([id, ic, nome]) => `<button class="filtro ${novo.modo === id ? "ativo" : ""}" data-modo-novo="${id}" style="flex:1;justify-content:center">${icone(ic, "ic--sm")}${nome}</button>`).join("")}</nav>
        ${blocoClienteNovo()}
        ${novo.modo === "entrega" ? `
          <div class="campo"><label for="nPag">Pagamento na entrega</label>
            <select id="nPag" class="input">${Fomito.formasAtivas().map((f) => `<option value="${f.id}" ${f.id === novo.pag ? "selected" : ""}>${f.nome}</option>`).join("")}</select></div>
          ${novo.pag === "dinheiro" ? `<div class="campo"><label for="nTroco">Troco para quanto?</label><div class="campo-moeda"><span>R$</span><input id="nTroco" class="input" inputmode="decimal" placeholder="Sem troco" value="${novo.troco}"></div></div>` : ""}` : ""}
      </div>

      <div class="lancar__coluna">
        <div class="entre"><nav class="filtros">${dados.categorias.map((c) => `<button class="filtro ${novo.cat === c.id ? "ativo" : ""}" data-cat-novo="${c.id}">${c.nome}</button>`).join("")}</nav></div>
        <label class="busca-painel" style="width:100%">${icone("busca", "ic--sm")}<input id="nBusca" placeholder="Buscar produto" value="${novo.busca}"></label>
        <div class="seletor-produtos" id="seletorProdutos">${seletorProdutos()}</div>
      </div>
    </div>
    <div class="lancar__rodape" id="rodapeLancar">${rodapeLancar()}</div>`;
}

function blocoClienteNovo() {
  if (novo.modo === "mesa") return `
    <div class="duas-campos">
      <div class="campo"><label for="nMesa">Mesa</label><select id="nMesa" class="input">${Array.from({ length: Fomito.comandas.totalMesas() }, (_, i) => `<option ${String(i + 1) === novo.mesa ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>
      <div class="campo"><label for="nNome">Nome (opcional)</label><input id="nNome" class="input" value="${novo.nome}"></div>
    </div>`;
  if (novo.modo === "balcao") return `
    <div class="campo"><label for="nNome">Nome de quem vai retirar</label><input id="nNome" class="input" value="${novo.nome}" placeholder="Ex.: Marcos"></div>`;

  const c = novo.cliente;
  return `
    <div class="campo"><label for="nTel">Telefone do cliente</label>
      <div class="busca-tel-painel"><input id="nTel" class="input" inputmode="tel" placeholder="(11) 90000-0000" value="${Fomito.clientes.formatarTelefone(novo.telefone)}"><button class="btn btn--secundario" data-buscar-novo>Buscar</button></div>
    </div>
    ${novo.buscou && c ? `
      <div class="cliente-achado">${icone("check", "ic--sm")}<span><b>${c.nome}</b> · ${Fomito.clientes.buscar(c.telefone)?.pedidos ?? 0} pedidos anteriores</span></div>
      <div class="pilha" style="gap:6px">
        ${c.enderecos.map((e) => `
          <button class="opcao ${e.id === novo.enderecoId ? "ativa" : ""}" data-end-novo="${e.id}">
            <span class="opcao__texto"><span class="opcao__titulo">${e.apelido}</span><span class="opcao__sub">${Fomito.clientes.textoEndereco(e)}</span></span><span class="opcao__radio"></span>
          </button>`).join("")}
      </div>` : ""}
    ${novo.buscou && !c ? `
      <div class="aviso">${icone("info", "ic--sm")}<span>Telefone sem cadastro. Preencha para salvar o cliente.</span></div>
      <div class="campo"><label for="nNome">Nome</label><input id="nNome" class="input" value="${novo.nome}"></div>
      <div class="duas-campos"><div class="campo"><label for="nRua">Rua</label><input id="nRua" class="input" placeholder="Ex.: Rua das Flores"></div><div class="campo"><label for="nNumero">Número</label><input id="nNumero" class="input" inputmode="numeric" placeholder="120"></div></div>
      <div class="campo"><label for="nBairro">Bairro</label><input id="nBairro" class="input"></div>` : ""}`;
}

function seletorProdutos() {
  const termo = Fomito.paraBusca(novo.busca);
  return dados.produtos
    .filter((p) => !p.esgotado && (termo ? Fomito.paraBusca(`${p.nome} ${p.desc || ""}`).includes(termo) : p.cat === novo.cat))
    .map((p) => {
      const q = novo.itens[p.id] || 0;
      return `
        <div class="produto-seletor ${q ? "ativo" : ""}">
          ${Fomito.foto(p, 40)}
          <div class="pilha" style="gap:0;flex:1;min-width:0"><span class="forte">${p.nome}</span><span class="pequeno suave">${moeda(p.preco)}</span></div>
          ${q ? `<div class="qtd"><button data-qtd-novo="${p.id},-1" aria-label="Menos">${icone(q === 1 ? "lixo" : "menos", "ic--sm")}</button><span>${q}</span><button data-qtd-novo="${p.id},1" aria-label="Mais">${icone("mais", "ic--sm")}</button></div>`
              : `<button class="btn btn--contorno btn--sm" data-qtd-novo="${p.id},1">${icone("mais", "ic--sm")} Adicionar</button>`}
        </div>`;
    }).join("") || `<p class="pequeno fraco" style="padding:16px 0;text-align:center">Nenhum produto encontrado.</p>`;
}

function rodapeLancar() {
  const itens = itensNovo();
  return `
    <div class="pilha" style="gap:2px;flex:1;min-width:0">
      <span class="pequeno suave corta">${itens.length ? itens.map(([id, q]) => `${q}× ${Fomito.produto(id).nome}`).join(", ") : "Nenhum item ainda"}</span>
      <span class="linha" style="gap:8px"><span class="forte">Total</span><span class="preco">${moeda(totalNovo())}</span>${novo.modo === "entrega" ? `<span class="pequeno fraco">${dados.lanchonete.taxaEntrega > 0 ? `com taxa de ${moeda(dados.lanchonete.taxaEntrega)}` : "frete grátis"}</span>` : ""}</span>
    </div>
    <button class="btn btn--primario" data-confirmar-novo ${itens.length ? "" : "disabled"}>${icone("check", "ic--sm")} Lançar pedido</button>`;
}

async function buscarClienteNovo() {
  novo.telefone = Fomito.clientes.soDigitos($("#nTel").value);
  if (!Fomito.clientes.telefoneValido(novo.telefone)) return toast("Digite o telefone com DDD", "info");
  novo.cliente = await Fomito.clientes.buscarRemoto(novo.telefone);
  novo.buscou = true;
  novo.enderecoId = novo.cliente?.enderecos[0].id ?? null;
  renderLancarPedido();
}

async function confirmarNovo() {
  const base = { itens: itensNovo() };
  if (novo.modo === "entrega") {
    if (!novo.buscou) return toast("Busque o telefone do cliente", "info");
    let c = novo.cliente;
    if (!c) {
      const nome = $("#nNome").value.trim(), rua = $("#nRua").value.trim(), numero = $("#nNumero").value.trim(), bairro = $("#nBairro").value.trim();
      if (!nome || !rua || !numero || !bairro) return toast("Preencha nome, rua, número e bairro do cliente", "info");
      c = await Fomito.clientes.cadastrar({ telefone: novo.telefone, nome, endereco: { apelido: "Casa", rua, numero, bairro, compl: "", ref: "" } });
      novo.cliente = c;
      novo.enderecoId = c.enderecoId;
    }
    const e = c.enderecos.find((x) => x.id === novo.enderecoId);
    const troco = parseFloat(String(novo.troco).replace(",", ".")) || null;
    Object.assign(base, { cliente: c.nome, modo: "entrega", telefone: Fomito.clientes.formatarTelefone(c.telefone), rua: e.rua, numero: e.numero, compl: e.compl, bairro: e.bairro, ref: e.ref, pag: novo.pag, troco });
  } else if (novo.modo === "mesa") {
    /* Mesa não vira pedido solto: entra na comanda da mesa */
    await Fomito.comandas.lancar(novo.mesa, itensNovo().map(([id, qtd]) => ({ id, qtd })), { nome: novo.nome });
    $("#lancarPedido").remove();
    renderPedidos();
    return toast(`Itens lançados na comanda da ${Fomito.comandas.mesaTexto(novo.mesa)}`, "mesa");
  } else {
    Object.assign(base, { cliente: `Balcão · ${novo.nome || "Retirada"}`, modo: "local", pag: null });
  }
  const { num } = await Fomito.pedidos.criar({ ...base, painel: true });
  pedidosSincronizados();
  $("#lancarPedido").remove();
  renderPedidos();
  toast(`Pedido #${num} lançado em Novos`, "check");
}

function cliqueLancar(e) {
  const alvo = (sel) => e.target.closest(sel);
  if (e.target.id === "lancarPedido" || alvo("[data-fechar-lancar]")) return $("#lancarPedido").remove();
  if (alvo("[data-modo-novo]")) { novo.modo = alvo("[data-modo-novo]").dataset.modoNovo; return renderLancarPedido(); }
  if (alvo("[data-buscar-novo]")) return buscarClienteNovo();
  if (alvo("[data-end-novo]")) { novo.enderecoId = Number(alvo("[data-end-novo]").dataset.endNovo); return renderLancarPedido(); }
  if (alvo("[data-cat-novo]")) { novo.cat = alvo("[data-cat-novo]").dataset.catNovo; novo.busca = ""; return renderLancarPedido(); }
  if (alvo("[data-qtd-novo]")) {
    const [id, passo] = alvo("[data-qtd-novo]").dataset.qtdNovo.split(",").map(Number);
    novo.itens[id] = Math.max(0, (novo.itens[id] || 0) + passo);
    $("#seletorProdutos").innerHTML = seletorProdutos();
    $("#rodapeLancar").innerHTML = rodapeLancar();
    return;
  }
  if (alvo("[data-confirmar-novo]")) return confirmarNovo();
}

function digitacaoLancar(e) {
  const t = e.target;
  if (t.id === "nTel") t.value = Fomito.clientes.formatarTelefone(t.value);
  if (t.id === "nNome") novo.nome = t.value;
  if (t.id === "nMesa") novo.mesa = t.value;
  if (t.id === "nTroco") novo.troco = t.value;
  if (t.id === "nPag") { novo.pag = t.value; renderLancarPedido(); }
  if (t.id === "nBusca") { novo.busca = t.value; $("#seletorProdutos").innerHTML = seletorProdutos(); }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "nTel") buscarClienteNovo();
});
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-lancar-pedido]")) abrirLancarPedido();
});

/* Esc fecha o painel lateral ou a janela de lançar pedido */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const aberta = [...document.querySelectorAll(".sobreposicao--lado, #lancarPedido")].pop();
  aberta?.remove();
});
