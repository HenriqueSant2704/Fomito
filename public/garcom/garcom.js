/* ==========================================================================
   FOMITO · TELA DO GARÇOM
   --------------------------------------------------------------------------
   Organização:
     1. Estado (mesas a partir das comandas compartilhadas)
     2. Lista de mesas e "Prontos para servir"
     3. Comanda da mesa
     4. Lançar itens
     5. Fechar conta (valor recebido obrigatório, troco e várias formas)
     6. Início
   ========================================================================== */

const { dados, moeda, icone, $, $$, toast, sessao, alertas } = Fomito;

/* Garçom e administrador podem usar as comandas */
const usuarioLogado = sessao.exigir("garcom", "atendente", "admin");

const novasProntas = new Set(); // rodadas que acabaram de ficar prontas (piscam)

/* ---------- 1. ESTADO ----------
   As comandas ficam em compartilhado/js/comandas.js: as mesmas que o
   cliente abre pelo QR Code da mesa e que o painel acompanha.
   status da mesa: "livre" | "ocupada" | "conta" (cliente pediu a conta) */
const { comandas } = Fomito;

let versaoComandas = JSON.stringify(comandas.abertas()); // para saber o que mudou em outro aparelho

function lerMesas() {
  return Array.from({ length: comandas.totalMesas() }, (_, i) => {
    const c = comandas.daMesa(i + 1);
    return {
      numero: i + 1,
      comanda: c,
      status: !c ? "livre" : c.pediuConta ? "conta" : "ocupada",
      pessoas: c?.pessoas || 0,
      desde: c ? Math.max(0, Math.round((Date.now() - c.abertaEm) / 60000)) : null,
      pelaMesa: c?.rodadas.some((r) => r.por === "qr"),
      naCozinha: c ? c.rodadas.filter((r) => r.status === "recebido" || r.status === "preparo").length : 0,
      paraServir: c ? c.rodadas.filter((r) => r.status === "pronto").length : 0,
    };
  });
}
let mesas = lerMesas();

const estado = { filtro: "todas", mesaAtual: null };

const totalMesa = (m) => (m.comanda ? comandas.total(m.comanda) : 0);
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

/* Garçom com bolsa própria: o que deve ter na pochete e na maquininha (confere no caixa no fim do turno) */
function renderMinhaBolsa() {
  const b = Fomito.estado.caixa?.bolsa;
  const el = $("#minhaBolsa");
  if (!el) return;
  if (!b || usuarioLogado.perfil !== "garcom") { el.innerHTML = ""; return; }
  el.innerHTML = `
    <section class="minha-bolsa">
      <div class="entre"><span class="rotulo">Sua bolsa</span><span class="tag tag--${b.pendente ? "cinza" : "verde"}">${b.pendente ? "Confira no caixa ao fim do turno" : "Conferida"}</span></div>
      <div class="minha-bolsa__numeros">
        <div><span class="pequeno suave">${icone("dinheiro", "ic--sm")} Dinheiro</span><strong>${moeda(b.esperado)}</strong><span class="pequeno fraco">troco ${moeda(b.fundo)} + recebido ${moeda(b.dinheiro)}</span></div>
        <div><span class="pequeno suave">${icone("cartao", "ic--sm")} Maquininha</span><strong>${moeda(b.credito + b.debito)}</strong><span class="pequeno fraco">crédito ${moeda(b.credito)} · débito ${moeda(b.debito)}</span></div>
      </div>
    </section>`;
}

function renderMesas() {
  renderMinhaBolsa();
  $("#grade").innerHTML = mesas
    .filter((m) => estado.filtro === "todas" || m.status === estado.filtro)
    .map((m) => `
      <button class="mesa mesa--${m.status} ${m.paraServir ? "mesa--servir" : ""} ${estado.mesaAtual === m.numero ? "selecionada" : ""}" data-mesa="${m.numero}">
        <span class="mesa__cabeca">
          <span><span class="mesa__rotulo">Mesa</span><span class="mesa__numero">${String(m.numero).padStart(2, "0")}</span></span>
          <span class="tag tag--${corTag[m.status]}">${rotulo[m.status]}</span>
        </span>
        <span class="mesa__rodape">
          ${m.status === "livre"
            ? `<span class="pequeno fraco">Disponível</span>`
            : `<span class="mesa__meta"><span>${icone("pessoas")}${m.pessoas}</span><span>${icone("relogio")}${m.desde} min</span>${m.naCozinha ? `<span class="mesa__cozinha">${icone("chama")}${m.naCozinha}</span>` : ""}${m.paraServir ? `<span class="mesa__servir">${icone("sino")}Servir</span>` : ""}</span><span class="mesa__valor">${moeda(totalMesa(m))}</span>`}
        </span>
      </button>`)
    .join("");
}

/* Pedidos das mesas que a cozinha marcou como prontos: o garçom leva e marca servido */
function rodadasProntas() {
  return comandas.abertas().flatMap((c) => c.rodadas.map((r, i) => ({ c, r, i }))).filter(({ r }) => r.status === "pronto")
    .sort((a, b) => (a.r.prontoEm || a.r.hora) - (b.r.prontoEm || b.r.hora));
}

function renderParaServir() {
  const lista = rodadasProntas();
  $("#paraServir").innerHTML = lista.length ? `
    <section class="servir">
      <div class="servir__topo"><span class="linha" style="gap:8px">${icone("sino", "ic--sm")}<b>Prontos para servir</b></span><span class="servir__qtd">${lista.length}</span></div>
      <div class="servir__lista">
        ${lista.map(({ c, r, i }) => `
          <div class="servir__item ${novasProntas.has(`${c.mesa}-${i}`) ? "servir__item--novo" : ""}">
            <div class="servir__mesa"><span class="pequeno">Mesa</span><strong>${String(c.mesa).padStart(2, "0")}</strong></div>
            <div class="pilha" style="gap:2px;flex:1;min-width:0">
              <span class="pequeno suave">${i + 1}º pedido${r.prontoEm ? ` · pronto às ${comandas.hora(r.prontoEm)}` : ""}</span>
              <span class="forte corta">${r.itens.map((it) => `${it.qtd}× ${Fomito.produto(it.id).nome}`).join(", ")}</span>
            </div>
            <button class="btn btn--sucesso btn--sm" data-servir-pronto="${c.mesa},${i}">${icone("check", "ic--sm")} Servido</button>
          </div>`).join("")}
      </div>
    </section>` : "";
}

$("#paraServir").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-servir-pronto]");
  if (!b) return;
  const [mesa, i] = b.dataset.servirPronto.split(",").map(Number);
  await comandas.statusRodada(mesa, i, "servido");
  atualizarTudo();
  toast(`Pedido servido na mesa ${mesa}`, "check");
});

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

/* ---------- 3. COMANDA ----------
   Os itens aparecem por rodada (cada vez que a mesa pediu), dizendo se
   veio do QR Code da mesa ou do garçom e em que pé está na cozinha. */
/* Tirar item da conta: só atendente e administrador (o garçom pede para eles) */
const podeTirar = ["admin", "atendente"].includes(usuarioLogado.perfil);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const MOTIVOS_TIRAR = ["Lançado errado", "Cliente desistiu", "Acabou na cozinha", "Veio errado", "Cortesia da casa"];

function abrirTirarItem(mesa, ri, ii) {
  const item = mesa.comanda?.rodadas[ri]?.itens[ii];
  if (!item) return;
  const nomeItem = Fomito.produto(item.id)?.nome || item.nome;
  const escolha = { qtd: item.qtd, motivo: "" };
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  document.body.appendChild(camada);
  const fechar = () => camada.remove();
  const render = () => {
    const valor = Math.round(item.preco * escolha.qtd * 100) / 100;
    camada.innerHTML = `
      <div class="folha tirar-folha" role="dialog" aria-label="Tirar item da conta">
        <div class="folha__topo"><h2>Tirar da conta</h2><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
        <div class="tirar-item__resumo">
          <span class="rotulo">Mesa ${String(mesa.numero).padStart(2, "0")} · ${ri + 1}º pedido</span>
          <strong>${item.qtd}× ${esc(nomeItem)}</strong>
          ${item.obs ? `<span class="pequeno suave">Obs.: ${esc(item.obs)}</span>` : ""}
        </div>
        ${item.qtd > 1 ? `
          <div class="entre tirar-item__qtd"><span>Quantos tirar?</span>
            <div class="qtd"><button data-q="-1" aria-label="Menos">${icone("menos", "ic--sm")}</button><b>${escolha.qtd}</b><button data-q="1" aria-label="Mais">${icone("mais", "ic--sm")}</button></div>
          </div>` : ""}
        <div class="campo"><label for="motivoTirar">Motivo <span class="obrigatorio">*</span></label>
          <div class="motivos-tirar">${MOTIVOS_TIRAR.map((t) => `<button class="motivo-tirar ${escolha.motivo === t ? "ativo" : ""}" data-motivo="${t}">${t}</button>`).join("")}</div>
          <input id="motivoTirar" class="input" placeholder="Ou escreva o motivo" value="${esc(escolha.motivo)}" maxlength="200">
        </div>
        <div class="tirar-item__valor entre"><span>Sai da conta</span><strong class="num">− ${moeda(valor)}</strong></div>
        <p class="pequeno fraco">Fica registrado quem tirou, a hora e o motivo.</p>
        <button class="btn btn--perigo btn--bloco" data-ok ${escolha.motivo.trim() ? "" : "disabled"}>${icone("lixo", "ic--sm")} Tirar ${escolha.qtd > 1 ? `${escolha.qtd} itens` : "o item"}</button>
      </div>`;
    const campo = $("#motivoTirar", camada);
    campo.oninput = () => { escolha.motivo = campo.value; $("[data-ok]", camada).disabled = !campo.value.trim(); };
  };
  render();
  camada.addEventListener("click", async (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return fechar();
    const q = e.target.closest("[data-q]");
    if (q) { escolha.qtd = Math.min(item.qtd, Math.max(1, escolha.qtd + Number(q.dataset.q))); return render(); }
    const mot = e.target.closest("[data-motivo]");
    if (mot) { escolha.motivo = mot.dataset.motivo; return render(); }
    if (e.target.closest("[data-ok]")) {
      const r = await Fomito.acao("POST", `/comandas/${mesa.numero}/rodadas/${ri}/itens/${ii}/tirar`, { qtd: escolha.qtd, motivo: escolha.motivo.trim() });
      fechar();
      atualizarTudo();
      toast(r?.liberada ? `Mesa ${mesa.numero} liberada: não sobrou nada na conta` : `${nomeItem} saiu da conta da mesa ${mesa.numero}`, "check");
    }
  });
}

function renderComanda() {
  const m = mesas[estado.mesaAtual - 1];
  const c = m.comanda;
  const painel = $("#comanda");
  painel.classList.add("aberta");

  const itensHtml = c
    ? c.rodadas.map((r, i) => {
        const st = comandas.STATUS[r.status];
        return `
          <div class="rodada-garcom">
            <div class="entre">
              <span class="forte pequeno">${i + 1}º pedido · ${comandas.hora(r.hora)}</span>
              <span class="linha" style="gap:6px"><span class="tag tag--cinza">${r.por === "qr" ? "QR da mesa" : "Garçom"}</span><span class="tag tag--${st.cor}">${st.nome}</span></span>
            </div>
            ${r.itens.map((item, j) => {
              const p = Fomito.produto(item.id) || { nome: item.nome, fotos: [] };
              return `
                <div class="linha-item">
                  ${Fomito.foto(p, 40)}
                  <div class="linha-item__info"><div class="forte">${item.qtd}× ${p.nome}</div>${item.obs ? `<span class="pequeno suave">Obs.: ${item.obs}</span>` : ""}</div>
                  <span class="preco">${moeda(comandas.precoItem(item))}</span>
                  ${podeTirar ? `<button class="btn-icone btn-icone--sm tirar-item" data-tirar-item="${i}:${j}" aria-label="Tirar ${esc(p.nome)} da conta" title="Tirar da conta">${icone("lixo", "ic--sm")}</button>` : ""}
                </div>`;
            }).join("")}
            ${r.status === "pronto" ? `<button class="btn btn--sucesso btn--sm" data-servir="${i}">${icone("check", "ic--sm")} Marcar como servido</button>` : ""}
          </div>`;
      }).join("")
    : `<div class="comanda__vazia"><span class="vazio__icone">${icone("pedidos", "ic--lg")}</span><p class="suave">Mesa livre.<br>A comanda abre quando o cliente pede pelo QR Code ou quando você lança o primeiro pedido.</p></div>`;

  painel.innerHTML = `
    <div class="comanda__topo">
      <div class="pilha">
        <span class="rotulo">Comanda</span>
        <h2>Mesa ${String(m.numero).padStart(2, "0")}</h2>
        <span class="pequeno suave">${!c ? "Mesa livre" : `${c.nome ? c.nome + " · " : ""}${m.pessoas} pessoas · aberta às ${comandas.hora(c.abertaEm)}`}</span>
      </div>
      <span class="tag tag--${corTag[m.status]}">${m.status === "conta" ? "Pediu a conta" : rotulo[m.status]}</span>
      <button class="btn-icone comanda__fechar-painel" id="voltarMesas" aria-label="Voltar">${icone("fechar")}</button>
    </div>
    ${m.status === "conta" ? `<div class="aviso aviso--conta">${icone("conta", "ic--sm")}<span>O cliente pediu a conta pelo celular.</span></div>` : ""}
    <div class="comanda__itens">${itensHtml}</div>
    <div class="comanda__rodape">
      <div class="entre"><span class="forte">Total da mesa</span><span class="preco comanda__total">${moeda(totalMesa(m))}</span></div>
      <div class="comanda__acoes">
        <button class="btn btn--contorno" id="btnLancar">${icone("mais", "ic--sm")} Lançar itens</button>
        <button class="btn btn--primario" id="btnFechar" ${c ? "" : "disabled"}>Fechar conta</button>
      </div>
    </div>`;

  $("#btnLancar").onclick = () => abrirLancamento(m);
  $("#btnFechar").onclick = () => abrirFechamento(m);
  $("#voltarMesas").onclick = () => painel.classList.remove("aberta");
  painel.onclick = async (e) => {
    const tirar = e.target.closest("[data-tirar-item]");
    if (tirar) { const [ri, ii] = tirar.dataset.tirarItem.split(":").map(Number); return abrirTirarItem(m, ri, ii); }
    const servir = e.target.closest("[data-servir]");
    if (!servir) return;
    await comandas.statusRodada(m.numero, Number(servir.dataset.servir), "servido");
    atualizarTudo();
    toast(`Pedido servido na mesa ${m.numero}`, "check");
  };
}

/* ---------- 4. LANÇAR ITENS ---------- */
function abrirLancamento(mesa) {
  const pedido = {};               // { idProduto: qtd }
  const ajustes = {};              // { idProduto: { sem: [ingredientes tirados], obs } }
  let ajustando = null;            // produto com o painel "Ajustar" aberto
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
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
          ${dados.produtos.filter((p) => p.cat === categoria && !p.esgotado).map((p) => `
            <div class="lancar__produto ${pedido[p.id] ? "tem" : ""}">
              ${Fomito.foto(p, 44)}
              <div style="flex:1;min-width:0"><div class="forte">${p.nome}</div><span class="pequeno suave num">${moeda(p.preco)}</span>
                ${ajustes[p.id]?.sem.length || ajustes[p.id]?.obs ? `<div class="pequeno ajuste-resumo">${[ajustes[p.id].sem.length ? `Sem ${ajustes[p.id].sem.join(", ").toLowerCase()}` : "", esc(ajustes[p.id].obs || "")].filter(Boolean).join(" · ")}</div>` : ""}
                ${pedido[p.id] && (p.ingredientes || []).length ? `<button class="link pequeno" data-ajustar="${p.id}">${ajustando === p.id ? "Fechar ajustes" : "Tirar ingrediente / obs."}</button>` : ""}</div>
              <div class="qtd"><button data-id="${p.id}" data-q="-1" aria-label="Diminuir">${icone("menos", "ic--sm")}</button><span>${pedido[p.id] || 0}</span><button data-id="${p.id}" data-q="1" aria-label="Aumentar">${icone("mais", "ic--sm")}</button></div>
            </div>
            ${ajustando === p.id && pedido[p.id] ? `
              <div class="ajuste-item">
                <span class="pequeno fraco">Toque no ingrediente que o cliente não quer</span>
                <div class="ingredientes-garcom">${(p.ingredientes || []).map((ing) => `<button class="ingrediente-garcom ${ajustes[p.id]?.sem.includes(ing) ? "removido" : ""}" data-tirar="${p.id}" data-ing="${esc(ing)}">${esc(ing)}</button>`).join("")}</div>
                <input class="input" data-obs-item="${p.id}" placeholder="Observação (ex.: carne bem passada)" value="${esc(ajustes[p.id]?.obs || "")}" maxlength="140">
              </div>` : ""}`).join("")}
        </div>
        <button class="btn btn--primario btn--bloco" data-enviar ${qtdTotal ? "" : "disabled"}>Enviar para a cozinha${qtdTotal ? ` · ${qtdTotal} ${qtdTotal > 1 ? "itens" : "item"}` : ""}</button>
      </div>`;
  }
  render();

  camada.addEventListener("input", (e) => {
    const o = e.target.closest("[data-obs-item]");
    if (o) (ajustes[o.dataset.obsItem] ||= { sem: [], obs: "" }).obs = o.value; // guarda sem redesenhar (não perde o foco)
  });
  camada.addEventListener("click", async (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return camada.remove();
    const cat = e.target.closest("[data-cat]");
    if (cat) { categoria = cat.dataset.cat; return render(); }
    const q = e.target.closest("[data-q]");
    if (q) {
      const id = Number(q.dataset.id);
      pedido[id] = Math.max(0, (pedido[id] || 0) + Number(q.dataset.q));
      return render();
    }
    const aj = e.target.closest("[data-ajustar]");
    if (aj) { const id = Number(aj.dataset.ajustar); ajustando = ajustando === id ? null : id; return render(); }
    const tirar = e.target.closest("[data-tirar]");
    if (tirar) {
      const id = Number(tirar.dataset.tirar);
      const a = (ajustes[id] ||= { sem: [], obs: "" });
      const ing = tirar.dataset.ing;
      a.sem = a.sem.includes(ing) ? a.sem.filter((x) => x !== ing) : [...a.sem, ing];
      return render();
    }
    if (e.target.closest("[data-enviar]")) {
      const itens = Object.entries(pedido).filter(([, qtd]) => qtd > 0)
        .map(([id, qtd]) => ({ id: Number(id), qtd, sem: ajustes[id]?.sem || [], obs: ajustes[id]?.obs || "" }));
      await comandas.lancar(mesa.numero, itens);
      camada.remove();
      atualizarTudo();
      toast(`Pedido da mesa ${mesa.numero} enviado para a cozinha`, "chama");
    }
  });
}

/* ---------- 5. FECHAR CONTA ----------
   Regras para o restaurante ter controle do caixa:
     • em dinheiro, o "valor recebido" é OBRIGATÓRIO e o troco é calculado;
     • dá para pagar em mais de uma forma (ex.: parte no Pix, parte em dinheiro);
     • a mesa só é liberada quando o total foi pago;
     • cada pagamento entra no caixa do dia (Painel › Caixa). */
const arred = (n) => Math.round(n * 100) / 100;
const numero = (texto) => parseFloat(String(texto).replace(/\./g, "").replace(",", ".")) || 0;

function abrirFechamento(mesa) {
  /* Sem taxa de serviço (decisão do restaurante): a conta é só o consumo */
  const conta = { pessoas: 1, pagamentos: [], forma: "dinheiro", valor: "", recebido: "" };

  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  document.body.appendChild(camada);

  const totalFinal = () => arred(totalMesa(mesa));
  const pago = () => arred(conta.pagamentos.reduce((s, p) => s + p.valor, 0));
  const restante = () => arred(totalFinal() - pago());
  /* Valor desta forma: o que o garçom digitou ou, por padrão, o que falta (ou a parte de cada pessoa) */
  const valorAtual = () => conta.valor !== "" ? numero(conta.valor) : arred(Math.min(restante(), conta.pessoas > 1 ? totalFinal() / conta.pessoas : restante()));
  const caixaAberto = () => !!Fomito.caixa.aberto();
  /* Convênio: o garçom escolhe o cliente conveniado (a parte dele vai para a conta do convênio) */
  let conveniados = [];
  Fomito.api("GET", "/convenios/nomes").then((l) => { conveniados = l || []; if (conveniados.length) render(); }).catch(() => {});

  function problema() {
    const v = valorAtual();
    if (!caixaAberto()) return "O caixa está fechado. Peça ao responsável para abrir o caixa no painel.";
    if (v <= 0) return "Informe o valor desta forma de pagamento.";
    if (v > restante() + 0.005) return `O valor passa do que falta pagar (${moeda(restante())}).`;
    if (conta.forma === "convenio" && !conta.convenioTel) return "Escolha o cliente do convênio.";
    if (conta.forma === "dinheiro") {
      if (!conta.recebido) return "Informe quanto o cliente entregou em dinheiro para calcular o troco.";
      if (numero(conta.recebido) < v) return `Faltam ${moeda(v - numero(conta.recebido))} para cobrir ${moeda(v)}.`;
    }
    return null;
  }

  function blocoTroco() {
    if (conta.forma !== "dinheiro") return "";
    const v = valorAtual();
    if (!conta.recebido) return `<div class="troco-caixa aviso-campo">${icone("info", "ic--sm")}<span>Campo obrigatório: o troco é calculado a partir do valor recebido.</span></div>`;
    const recebido = numero(conta.recebido);
    return recebido < v
      ? `<div class="troco-caixa erro"><span>Faltam</span><strong class="num">${moeda(v - recebido)}</strong></div>`
      : `<div class="troco-caixa"><span>Troco a devolver</span><strong class="num">${moeda(recebido - v)}</strong></div>`;
  }

  function areaConfirmar() {
    const erro = problema();
    const parcial = valorAtual() < restante() - 0.005;
    return `
      ${erro && conta.recebido !== "" || !caixaAberto() ? `<p class="form-erro">${erro}</p>` : ""}
      <button class="btn btn--primario btn--bloco" data-confirmar ${erro ? "disabled" : ""}>
        ${icone("check", "ic--sm")} ${parcial ? `Registrar ${moeda(valorAtual())} e continuar` : "Confirmar pagamento e liberar mesa"}
      </button>`;
  }

  /* Sugestões de notas para o valor recebido */
  const notas = () => {
    const v = valorAtual();
    return [...new Set([Math.ceil(v / 10) * 10, Math.ceil(v / 50) * 50, Math.ceil(v / 100) * 100])].filter((n) => n > v).slice(0, 3);
  };

  function render() {
    const nomes = Fomito.caixa.FORMAS_TODAS;
    camada.innerHTML = `
      <div class="folha conta">
        <div class="folha__topo"><h2>Fechar conta · Mesa ${String(mesa.numero).padStart(2, "0")}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>

        <div class="conta__total">
          <span class="rotulo">Total a pagar</span>
          <span class="preco">${moeda(totalFinal())}</span>
          <span class="pequeno suave num">${comandas.qtdItens(mesa.comanda)} itens consumidos</span>
        </div>

        <div class="divisao card">
          <div><div class="forte">Dividir a conta</div><div class="pequeno suave">${conta.pessoas > 1 ? `${moeda(totalFinal() / conta.pessoas)} por pessoa` : "Uma pessoa paga tudo"}${conta.pagamentos.length ? `<br>${icone("cadeado", "ic--sm")} Travado: já tem pagamento. Para mudar, peça no Caixa.` : ""}</div></div>
          <div class="qtd"><button data-p="-1" aria-label="Menos pessoas" ${conta.pagamentos.length ? "disabled" : ""}>${icone("menos", "ic--sm")}</button><span>${conta.pessoas}</span><button data-p="1" aria-label="Mais pessoas" ${conta.pagamentos.length ? "disabled" : ""}>${icone("mais", "ic--sm")}</button></div>
        </div>

        ${conta.pagamentos.length ? `
          <div class="pagos lista-rolagem">
            ${conta.pagamentos.map((p, i) => `
              <div class="pago">
                ${icone("check", "ic--sm")}
                <span class="flex1">${nomes[p.forma]}${p.forma === "convenio" ? ` <span class="pequeno suave">${p.nome}</span>` : ""}${p.forma === "dinheiro" ? ` <span class="pequeno suave">recebeu ${moeda(p.recebido)} · troco ${moeda(p.troco)}</span>` : ""}</span>
                <b class="num">${moeda(p.valor)}</b>
                <button class="btn-icone btn-icone--sm" data-remover="${i}" aria-label="Desfazer pagamento">${icone("fechar", "ic--sm")}</button>
              </div>`).join("")}
            <div class="entre falta"><span>Falta pagar</span><strong class="num">${moeda(restante())}</strong></div>
          </div>` : ""}

        <div class="campo"><label>Forma de pagamento</label>
          <div class="formas">
            ${dados.formasPagamento.map((f) => `
              <button class="opcao ${conta.forma === f.id ? "ativa" : ""}" data-forma="${f.id}">
                <span class="opcao__icone">${icone(f.icone, "ic--sm")}</span><span class="opcao__titulo pequeno">${f.nome}</span>
              </button>`).join("")}
            ${conveniados.length ? `<button class="opcao ${conta.forma === "convenio" ? "ativa" : ""}" data-forma="convenio"><span class="opcao__icone">${icone("conta", "ic--sm")}</span><span class="opcao__titulo pequeno">Convênio</span></button>` : ""}
          </div>
        </div>
        ${conta.forma === "convenio" ? `
          <div class="campo"><label for="clienteConvenio">Cliente do convênio</label>
            <select class="input" id="clienteConvenio" data-convenio><option value="">Escolha o cliente</option>${conveniados.map((c) => `<option value="${c.telefone}" ${conta.convenioTel === c.telefone ? "selected" : ""}>${c.nome}${c.empresa ? ` · ${c.empresa}` : ""}</option>`).join("")}</select>
            <span class="pequeno fraco">Não cobra agora: o valor vai para a conta do cliente e a loja cobra no fechamento.</span>
          </div>` : ""}

        <div class="campo"><label for="valorForma">Valor nesta forma</label>
          <input class="input num" id="valorForma" data-valor inputmode="decimal" value="${conta.valor !== "" ? conta.valor : valorAtual().toFixed(2).replace(".", ",")}">
          <span class="pequeno fraco">Para pagar com mais de uma forma, diminua o valor e registre o resto depois.</span>
        </div>

        ${conta.forma === "dinheiro" ? `
          <div class="campo"><label for="recebido">Valor recebido em dinheiro <span class="obrigatorio">*</span></label>
            <input class="input num ${conta.recebido ? "" : "input--pendente"}" id="recebido" data-recebido inputmode="decimal" placeholder="Quanto o cliente entregou" value="${conta.recebido}">
            <div class="notas">
              <button data-nota="${valorAtual()}">Valor exato</button>
              ${notas().map((n) => `<button data-nota="${n}">${moeda(n)}</button>`).join("")}
            </div>
          </div>
          <div id="caixaTroco">${blocoTroco()}</div>` : ""}

        <div id="areaConfirmar">${areaConfirmar()}</div>
      </div>`;
  }
  const atualizarParcial = () => {
    if ($("#caixaTroco", camada)) $("#caixaTroco", camada).innerHTML = blocoTroco();
    $("#areaConfirmar", camada).innerHTML = areaConfirmar();
    $("#recebido", camada)?.classList.toggle("input--pendente", !conta.recebido);
  };
  render();

  async function confirmar() {
    if (problema()) return;
    const v = valorAtual();
    const pagamento = { forma: conta.forma, valor: v };
    if (conta.forma === "dinheiro") Object.assign(pagamento, { recebido: numero(conta.recebido), troco: arred(numero(conta.recebido) - v) });
    if (conta.forma === "convenio") Object.assign(pagamento, { telefone: conta.convenioTel, nome: conveniados.find((c) => c.telefone === conta.convenioTel)?.nome || "" });
    conta.pagamentos.push(pagamento);
    Object.assign(conta, { valor: "", recebido: "" });

    if (restante() > 0.005) { render(); return toast(`${moeda(v)} registrado. Falta ${moeda(restante())}`, "check"); }

    /* Tudo pago: a comanda fecha, vira pedido antigo e os pagamentos vão para o caixa */
    const troco = conta.pagamentos.reduce((s, p) => s + (p.troco || 0), 0);
    try {
      await comandas.fechar(mesa.numero, { pagamentos: conta.pagamentos, pessoas: conta.pessoas });
    } catch (err) {
      conta.pagamentos.pop(); // não deu certo: o último pagamento volta a ficar pendente
      render();
      throw err;
    }
    camada.remove();
    atualizarTudo();
    toast(`Mesa ${mesa.numero} paga e liberada${troco ? ` · troco ${moeda(troco)}` : ""}`);
  }

  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return camada.remove();
    const p = e.target.closest("[data-p]");
    if (p) {
      /* Depois do 1º pagamento a divisão trava: mudar agora faria quem já pagou pagar a mais ou a menos */
      if (conta.pagamentos.length) return toast("A divisão travou porque já tem pagamento. A correção é feita no Caixa.", "info");
      conta.pessoas = Math.max(1, conta.pessoas + Number(p.dataset.p)); conta.valor = ""; return render();
    }
    const f = e.target.closest("[data-forma]");
    if (f) { conta.forma = f.dataset.forma; conta.recebido = ""; return render(); }
    const nota = e.target.closest("[data-nota]");
    if (nota) { conta.recebido = Number(nota.dataset.nota).toFixed(2).replace(".", ","); $("#recebido", camada).value = conta.recebido; return atualizarParcial(); }
    const remover = e.target.closest("[data-remover]");
    if (remover) { conta.pagamentos.splice(Number(remover.dataset.remover), 1); return render(); }
    if (e.target.closest("[data-confirmar]")) confirmar();
  });
  camada.addEventListener("change", (e) => {
    if (e.target.matches("[data-convenio]")) { conta.convenioTel = e.target.value; atualizarParcial(); }
  });
  camada.addEventListener("input", (e) => {
    if (e.target.matches("[data-recebido]")) conta.recebido = e.target.value;
    if (e.target.matches("[data-valor]")) conta.valor = e.target.value;
    atualizarParcial();
  });
  camada.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input")) confirmar();
  });
}

/* ---------- 6. INÍCIO ---------- */
function atualizarTudo() {
  mesas = lerMesas();
  versaoComandas = JSON.stringify(comandas.abertas());
  renderParaServir();
  renderFiltros();
  renderMesas();
  if (estado.mesaAtual) renderComanda();
}

$("#logo").innerHTML = Fomito.logo();
if (usuarioLogado) {
  $("#nomeGarcom").textContent = usuarioLogado.nome;
  $("#perfilGarcom").textContent = sessao.PERFIS[usuarioLogado.perfil]?.nome || "Garçom";
  $("#avatarGarcom").textContent = usuarioLogado.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  $("#voltarPainel").hidden = !["admin", "atendente"].includes(usuarioLogado.perfil);
}
$("#btnSair").addEventListener("click", () => sessao.sair());
/* Aberto de dentro do painel (Comandas → tocar na mesa): mostra só a comanda daquela mesa,
   com os pedidos, Lançar itens e Fechar conta, igual ao garçom */
const paramsTela = new URLSearchParams(location.search);
if (paramsTela.get("embutido")) document.body.classList.add("embutido");
if (Number(paramsTela.get("mesa")) > 0) estado.mesaAtual = Number(paramsTela.get("mesa"));
atualizarTudo();
if (estado.mesaAtual) renderComanda();

/* ---------- 7. AVISOS ----------
   A cada 3 segundos confere as comandas (o cliente pede pelo QR e a
   cozinha marca pronto em outros aparelhos). Pedido pronto para servir
   e conta pedida tocam o som, vibram e mostram a notificação do celular. */
function renderAvisoNotificacao() {
  const el = $("#avisoNotificacao");
  if (alertas.avisosLigados()) {
    el.innerHTML = `<div class="avisos-ok">${icone("check", "ic--sm")}Avisos ativados${alertas.notificacoesAtivas() ? "" : " (som e vibração: mantenha esta tela aberta)"}. Você é chamado quando um pedido ficar pronto ou uma mesa pedir a conta.</div>`;
    return;
  }
  el.innerHTML = `
    <div class="ativar-avisos">
      ${icone("sino")}
      <span>Ative os avisos para ser chamado quando um pedido ficar pronto ou uma mesa pedir a conta.</span>
      <button class="btn btn--destaque btn--sm" data-ativar-avisos>Ativar avisos</button>
    </div>`;
}
$("#avisoNotificacao").addEventListener("click", async (e) => {
  if (!e.target.closest("[data-ativar-avisos]")) return;
  const r = await alertas.ativarNotificacoes();
  alertas.tocarAlerta();
  toast(r === "granted" ? "Avisos ativados" : "Som ativado. O navegador não liberou a notificação: mantenha esta tela aberta.", r === "granted" ? "sino" : "info");
  renderAvisoNotificacao();
});
renderAvisoNotificacao();

const verificarMudancasGarcom = () => {
  const agora = JSON.stringify(comandas.abertas());
  if (agora === versaoComandas) return;
  const antes = JSON.parse(versaoComandas);
  comandas.abertas().forEach((c) => {
    const velha = antes.find((x) => x.mesa === c.mesa);
    if (!velha) return toast(`Mesa ${c.mesa} abriu comanda pelo QR Code`, "mesa");
    if (c.rodadas.length > velha.rodadas.length) toast(`Mesa ${c.mesa} pediu mais itens`, "chama");
    /* Ficou pronto agora: chama o garçom */
    c.rodadas.forEach((r, i) => {
      if (r.status === "pronto" && velha.rodadas[i]?.status !== "pronto") {
        novasProntas.add(`${c.mesa}-${i}`);
        setTimeout(() => { novasProntas.delete(`${c.mesa}-${i}`); renderParaServir(); }, 4000);
        alertas.avisar(`Mesa ${String(c.mesa).padStart(2, "0")}: pronto para servir`, `${i + 1}º pedido · ${r.itens.map((it) => `${it.qtd}× ${Fomito.produto(it.id).nome}`).join(", ")}`, `mesa-${c.mesa}-${i}`);
        toast(`Mesa ${c.mesa}: pedido pronto para servir`, "sino");
      }
    });
    if (c.pediuConta && !velha.pediuConta) {
      alertas.avisar(`Mesa ${String(c.mesa).padStart(2, "0")} pediu a conta`, "O cliente pediu a conta pelo celular", `conta-${c.mesa}`);
      toast(`Mesa ${c.mesa} pediu a conta`, "conta");
    }
  });
  atualizarTudo();
};
setInterval(verificarMudancasGarcom, 3000);
/* O servidor avisa na hora quando algo muda (pedido novo, pronto, conta...): confere sem esperar os 3 s */
document.addEventListener("fomito:estado", verificarMudancasGarcom);
