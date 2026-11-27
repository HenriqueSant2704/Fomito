/* ==========================================================================
   FOMITO · PAINEL › COMANDAS DAS MESAS
   --------------------------------------------------------------------------
   Carregado antes do painel.js. Usa compartilhado/js/comandas.js, o mesmo
   que o cliente (QR Code da mesa) e o garçom usam.
     1. Rodadas das comandas no quadro de Pedidos (cozinha)
     2. Seção Comandas: mesas, comandas fechadas e QR Codes
     3. Ficha da comanda (painel lateral)
   ========================================================================== */

/* ---------- 1. RODADAS NO QUADRO DE PEDIDOS ----------
   Cada vez que a mesa pede, a rodada entra na coluna da cozinha:
   recebido → Novos · preparo → Em preparo · pronto → Pronto
   Quando fica pronta, o garçom é avisado e ele marca "servido" na tela dele. */
const colunaDaRodada = { recebido: "novo", preparo: "preparo", pronto: "pronto" };
const acaoDaRodada = { recebido: "Aceitar", preparo: "Marcar pronto" };

function rodadasDaColuna(colunaId) {
  return Fomito.comandas.abertas()
    .flatMap((c) => c.rodadas.map((r, i) => ({ c, r, i })))
    .filter(({ r }) => colunaDaRodada[r.status] === colunaId);
}

function cardRodada({ c, r, i }) {
  const cmd = Fomito.comandas;
  return `
    <div class="card pedido pedido--comanda ${r.status === "recebido" ? "pedido--novo" : ""}" data-abrir-mesa="${c.mesa}" title="Ver a comanda da mesa">
      <div class="entre"><span class="forte">${cmd.mesaTexto(c.mesa)}</span><span class="pequeno fraco">${i + 1}º pedido · ${cmd.hora(r.hora)}</span></div>
      <div class="entre"><span class="forte">${c.nome || "Comanda"}</span><span class="tag tag--cinza">${r.por === "qr" ? "QR da mesa" : "Garçom"}</span></div>
      <div class="pedido__itens">${r.itens.map((it) => `${it.qtd}× ${it.nome || Fomito.produto(it.id).nome}${it.obs ? `<br><span class="fraco">Obs.: ${it.obs}</span>` : ""}`).join("<br>")}</div>
      <div class="pedido__pag">${icone("mesa", "ic--sm")}<span>Comanda aberta: ${moeda(cmd.total(c))} até agora${c.pediuConta ? "<br><b>Pediu a conta</b>" : ""}</span></div>
      ${r.status === "pronto" ? `<div class="pedido__situacao pedido__situacao--pronto">${icone("relogio", "ic--sm")}<span>Aguardando o garçom servir</span></div>` : ""}
      <div class="entre"><span class="preco">${moeda(cmd.totalRodada(r))}</span>
        <span class="linha" style="gap:6px">
          <button class="btn-icone" data-cupom-rodada="${c.mesa},${i}" aria-label="Imprimir a comanda da ${cmd.mesaTexto(c.mesa)}" title="Imprimir para a cozinha">${icone("impressora", "ic--sm")}</button>
          ${acaoDaRodada[r.status] ? `<button class="btn ${r.status === "recebido" ? "btn--primario" : "btn--contorno"} btn--sm" data-rodada="${c.mesa},${i}">${acaoDaRodada[r.status]}</button>` : ""}
        </span></div>
    </div>`;
}

/* Comanda com a conta fechada: entra em "Concluídos" no quadro de Pedidos, marcada como Mesa */
function cardComandaFechada(f) {
  const cmd = Fomito.comandas;
  const formas = Object.fromEntries(dados.formasPagamento.map((x) => [x.id, x.nome]));
  const forma = f.forma === "misto" ? "mais de uma forma" : (formas[f.forma] || "").toLowerCase();
  /* Junta os itens de todas as rodadas: "2× X-Bacon" */
  const itens = {};
  f.rodadas.forEach((r) => r.itens.forEach((it) => {
    const nome = it.nome || Fomito.produto(it.id).nome;
    itens[nome] = (itens[nome] || 0) + it.qtd;
  }));
  const linhas = Object.entries(itens);
  return `
    <div class="card pedido pedido--comanda pedido--fechada" title="Comanda fechada">
      <div class="entre"><span class="forte">${cmd.mesaTexto(f.mesa)}</span><span class="pequeno fraco">comanda #${f.numero}</span></div>
      <div class="entre"><span class="forte">${f.nome || "Comanda"}</span><span class="tag tag--roxo">${icone("mesa", "ic--sm")} Mesa</span></div>
      <div class="pedido__itens">${linhas.slice(0, 4).map(([nome, qtd]) => `${qtd}× ${nome}`).join("<br>")}${linhas.length > 4 ? `<br><span class="fraco">+ ${linhas.length - 4} ${linhas.length - 4 > 1 ? "itens" : "item"}</span>` : ""}</div>
      <div class="pedido__situacao pedido__situacao--concluido">${icone("check", "ic--sm")}<span>Conta fechada${f.por ? ` por <b>${f.por}</b>` : ""} às ${cmd.hora(f.fechadaEm)}${forma ? ` · ${forma}` : ""}</span></div>
      <div class="entre"><span class="preco">${moeda(f.total)}</span><span class="pequeno fraco">${f.rodadas.length} ${f.rodadas.length > 1 ? "pedidos" : "pedido"}</span></div>
    </div>`;
}

document.addEventListener("click", async (e) => {
  const cupom = e.target.closest("[data-cupom-rodada]");
  if (cupom) {
    const [mesa, i] = cupom.dataset.cupomRodada.split(",").map(Number);
    return mostrarCupomComanda(mesa, i, false);
  }
  const botao = e.target.closest("[data-rodada]");
  if (botao) {
    const [mesa, i] = botao.dataset.rodada.split(",").map(Number);
    const r = Fomito.comandas.daMesa(mesa)?.rodadas[i];
    if (!r || !acaoDaRodada[r.status]) return;
    const novo = Fomito.comandas.PROXIMO[r.status];
    await Fomito.comandas.statusRodada(mesa, i, novo);
    renderPedidos();
    versaoComandasPainel = JSON.stringify(Fomito.comandas.abertas());
    /* Aceitou a rodada: sai a notinha para a cozinha (como no pedido de entrega) */
    if (novo === "preparo" && Fomito.config.ler().impressao.aoAceitar) return mostrarCupomComanda(mesa, i, true);
    if (novo === "pronto") return toast(`${Fomito.comandas.mesaTexto(mesa)} pronta. O garçom foi avisado para servir.`, "sino");
    return toast(`${Fomito.comandas.mesaTexto(mesa)}: ${i + 1}º pedido ${Fomito.comandas.STATUS[novo].nome.toLowerCase()}`, Fomito.comandas.STATUS[novo].icone);
  }
  if (e.target.closest("button, a, input, label")) return;
  const card = e.target.closest("[data-abrir-mesa]");
  if (card) abrirComandaPainel(Number(card.dataset.abrirMesa));
});

/* ---------- 2. SEÇÃO COMANDAS ---------- */
function renderComandas() {
  const cmd = Fomito.comandas;
  const abertas = cmd.abertas();
  const fechadas = cmd.fechadas();
  const emAberto = abertas.reduce((s, c) => s + cmd.total(c), 0);
  const conta = abertas.filter((c) => c.pediuConta).length;
  const texto = { livre: "Livre", ocupada: "Ocupada", conta: "Conta" };
  const cor = { livre: "cinza", ocupada: "roxo", conta: "laranja" };
  const formas = Object.fromEntries(dados.formasPagamento.map((f) => [f.id, f.nome]));

  $('[data-secao="comandas"].secao').innerHTML = `
    <div class="kpis">
      <div class="card kpi"><div class="kpi__rotulo">Mesas ocupadas${icone("mesa")}</div><div class="kpi__valor">${abertas.length} de ${cmd.totalMesas()}</div>
        <div class="qtd-mesas"><span class="pequeno suave">Mesas no salão</span><div class="qtd"><button data-mesas="-1" aria-label="Menos mesas">${icone("menos", "ic--sm")}</button><span>${cmd.totalMesas()}</span><button data-mesas="1" aria-label="Mais mesas">${icone("mais", "ic--sm")}</button></div></div></div>
      <div class="card kpi"><div class="kpi__rotulo">Pediram a conta${icone("conta")}</div><div class="kpi__valor">${conta}</div></div>
      <div class="card kpi"><div class="kpi__rotulo">Em aberto no salão${icone("moeda")}</div><div class="kpi__valor">${moeda(emAberto)}</div></div>
      <div class="card kpi"><div class="kpi__rotulo">Fechadas hoje${icone("check")}</div><div class="kpi__valor">${moeda(fechadas.reduce((s, f) => s + f.total, 0))}</div></div>
    </div>

    <div class="mini-mesas">
      ${Array.from({ length: cmd.totalMesas() }, (_, i) => {
        const c = cmd.daMesa(i + 1);
        const s = !c ? "livre" : c.pediuConta ? "conta" : "ocupada";
        return `
          <button class="card mini-mesa ${s}" data-abrir-mesa="${i + 1}" title="${c ? "Ver a comanda" : "Mesa livre: toque para lançar itens"}">
            <div class="entre"><span class="pequeno fraco">Mesa</span><span class="tag tag--${cor[s]}">${texto[s]}</span></div>
            <strong>${String(i + 1).padStart(2, "0")}</strong>
            <span class="preco pequeno">${c ? moeda(cmd.total(c)) : "—"}</span>
            ${c?.rodadas.some((r) => r.por === "qr") ? `<span class="pequeno fraco linha" style="gap:4px">${icone("grade", "ic--sm")}Pediu pelo QR</span>` : ""}
          </button>`;
      }).join("")}
    </div>

    <div class="duas-colunas">
      <div class="card painel-card">
        <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>Comandas fechadas hoje</h3><span class="pequeno suave">Quando o garçom fecha a conta, a comanda vira um pedido antigo.</span></div></div>
        <div class="tabela-rolagem">
          <table class="tabela">
            <thead><tr><th>Nº</th><th>Mesa</th><th>Período</th><th>Itens</th><th>Pagamento</th><th class="dir">Total</th></tr></thead>
            <tbody>
              ${fechadas.map((f) => `
                <tr>
                  <td class="num forte">#${f.numero}</td>
                  <td style="white-space:nowrap">${cmd.mesaTexto(f.mesa)}${f.nome ? `<div class="pequeno fraco">${f.nome}</div>` : ""}</td>
                  <td class="num suave" style="white-space:nowrap">${cmd.hora(f.abertaEm)} – ${cmd.hora(f.fechadaEm)}</td>
                  <td class="num">${cmd.qtdItens(f)} <span class="fraco">em ${f.rodadas.length} ${f.rodadas.length > 1 ? "pedidos" : "pedido"}</span></td>
                  <td>${formas[f.forma] || (f.forma === "misto" ? "Mais de uma forma" : "-")}</td>
                  <td class="dir preco">${moeda(f.total)}</td>
                </tr>`).join("") || `<tr><td colspan="6" class="suave" style="text-align:center;padding:24px">Nenhuma comanda fechada hoje.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card painel-card">
        <div class="pilha" style="gap:2px"><h3>QR Code das mesas</h3><span class="pequeno suave">Cada mesa tem o seu. Ao ler, o cardápio já abre com o número da mesa e o pedido vai para a comanda dela.</span></div>
        ${blocoQrMesa()}
      </div>
    </div>

    <p class="pequeno fraco">Toque numa mesa para ver os pedidos, lançar itens ou fechar a conta (ex.: o cliente veio pagar no balcão).</p>`;
}

/* QR Code de verdade de cada mesa: leva um código difícil de adivinhar (?m=abc123),
   então ninguém pede em nome de outra mesa só trocando o número. */
let qrMesa = 1;
function blocoQrMesa() {
  const mesas = Fomito.estado.mesas || [];
  if (!mesas.length) return `<p class="pequeno suave">Informe o número de mesas em Configurações → Loja e entrega.</p>`;
  const m = mesas.find((x) => x.numero === qrMesa) || mesas[0];
  qrMesa = m.numero;
  const endereco = `${location.origin}/?m=${m.codigo}`;
  return `
    <div class="qr-mesa">
      <div class="qr-mesa__cartao"><img src="/api/mesas/${m.numero}/qr.svg" width="132" height="132" alt="QR Code da ${Fomito.comandas.mesaTexto(m.numero)}"><b>${Fomito.comandas.mesaTexto(m.numero)}</b><span>Aponte a câmera e peça por aqui</span></div>
      <div class="pilha" style="gap:8px">
        <select class="input" id="qrMesa" aria-label="Escolher a mesa">${mesas.map((x) => `<option value="${x.numero}" ${x.numero === m.numero ? "selected" : ""}>${Fomito.comandas.mesaTexto(x.numero)}</option>`).join("")}</select>
        <code class="qr-mesa__link">${endereco}</code>
        <a class="btn btn--contorno btn--sm" href="../cliente/?m=${m.codigo}" target="_blank" rel="noopener">${icone("externo", "ic--sm")} Testar como cliente</a>
        <a class="btn btn--primario btn--sm" href="/api/mesas/imprimir" target="_blank" rel="noopener">${icone("impressora", "ic--sm")} Imprimir QR das ${mesas.length} mesas</a>
      </div>
    </div>`;
}
/* Número de mesas do salão (aqui nas Comandas): muda na hora, com os QR Codes de cada mesa */
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-mesas]");
  if (!b) return;
  const novo = Fomito.comandas.totalMesas() + Number(b.dataset.mesas);
  if (novo < 1) return;
  const ocupada = Fomito.comandas.abertas().find((c) => c.mesa > novo);
  if (ocupada) return toast(`A ${Fomito.comandas.mesaTexto(ocupada.mesa)} está com comanda aberta: feche antes de tirar a mesa.`, "info");
  await Fomito.acao("POST", "/loja/mesas", { mesas: novo });
  renderComandas();
  toast(`Salão com ${novo} mesas`, "mesa");
});

document.addEventListener("change", (e) => {
  if (e.target.id !== "qrMesa") return;
  qrMesa = Number(e.target.value);
  renderComandas();
});

/* ---------- 3. FICHA DA COMANDA ---------- */
function abrirComandaPainel(mesa) {
  /* A mesa abre aqui mesmo, igual à tela do garçom: pedidos, Lançar itens e Fechar conta */
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  camada.innerHTML = `
    <div class="folha folha--mesa">
      <div class="folha__topo"><h2>${Fomito.comandas.mesaTexto(mesa)}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
      <iframe class="mesa-embutida" src="../garcom/?embutido=1&mesa=${mesa}" title="Comanda da ${Fomito.comandas.mesaTexto(mesa)}"></iframe>
    </div>`;
  document.body.appendChild(camada);
  const fechar = () => { camada.remove(); document.removeEventListener("keydown", tecla); };
  const tecla = (e) => e.key === "Escape" && fechar();
  document.addEventListener("keydown", tecla);
  camada.addEventListener("click", (e) => { if (e.target === camada || e.target.closest("[data-fechar]")) fechar(); });
}

/* O cliente pede pelo celular, o garçom serve e o motoboy entrega em outros
   aparelhos: o painel confere as comandas e os pedidos a cada 3 segundos */
let versaoComandasPainel = JSON.stringify(Fomito.comandas.abertas());
const resumoPedidos = (lista) => JSON.stringify(lista.map(({ num, status, motoboy }) => [num, status, motoboy]));
let versaoPedidosPainel = resumoPedidos(Fomito.pedidos.lista());
/** Chamado depois que o próprio painel muda um pedido, para não avisar de novo */
const pedidosSincronizados = () => { versaoPedidosPainel = resumoPedidos(Fomito.pedidos.lista()); };
const verificarMudancasPainel = () => {
  const agora = JSON.stringify(Fomito.comandas.abertas());
  const pedidosAgora = Fomito.pedidos.lista();
  const versaoPedidos = resumoPedidos(pedidosAgora);
  if (agora === versaoComandasPainel && versaoPedidos === versaoPedidosPainel) return;

  /* Rodada nova de uma mesa */
  const rodadas = (lista) => lista.reduce((s, c) => s + c.rodadas.length, 0);
  if (rodadas(Fomito.comandas.abertas()) > rodadas(JSON.parse(versaoComandasPainel))) {
    alertas.tocarAlerta();
    toast("Pedido novo de uma mesa (QR Code)", "mesa");
  }
  /* Pedido novo do cardápio, ou o motoboy saiu / entregou */
  const antes = Object.fromEntries(JSON.parse(versaoPedidosPainel).map(([num, status]) => [num, status]));
  pedidosAgora.forEach((p) => {
    if (!antes[p.num] && p.status === "novo") avisarPedidoNovo(`Novo pedido #${p.num} de ${p.cliente}`);
    else if (antes[p.num] && antes[p.num] !== p.status && p.status === "rota") toast(`${p.motoboy} saiu com o pedido #${p.num} (${p.bairro})`, "entrega");
    else if (antes[p.num] && antes[p.num] !== p.status && p.status === "concluido") toast(`Pedido #${p.num} entregue por ${p.motoboy}`, "check");
  });
  versaoComandasPainel = agora;
  versaoPedidosPainel = versaoPedidos;

  const aberta = $(".secao:not([hidden])")?.dataset.secao;
  if (aberta === "pedidos") renderPedidos();
  if (aberta === "comandas") renderComandas();
  if (aberta === "caixa") renderCaixa();
  if (aberta === "dashboard") renderDashboard();
  atualizarBadge();
};
setInterval(verificarMudancasPainel, 3000);
/* O servidor avisa na hora quando algo muda (pedido novo, pronto, conta...): confere sem esperar os 3 s */
document.addEventListener("fomito:estado", verificarMudancasPainel);
