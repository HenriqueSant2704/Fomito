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
   recebido → Novos · preparo → Em preparo · pronto → Pronto */
const colunaDaRodada = { recebido: "novo", preparo: "preparo", pronto: "pronto" };
const acaoDaRodada = { recebido: "Aceitar", preparo: "Marcar pronto", pronto: "Servido na mesa" };

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
      <div class="pedido__itens">${r.itens.map((it) => `${it.qtd}× ${Fomito.produto(it.id).nome}${it.obs ? `<br><span class="fraco">Obs.: ${it.obs}</span>` : ""}`).join("<br>")}</div>
      <div class="pedido__pag">${icone("mesa", "ic--sm")}<span>Comanda aberta: ${moeda(cmd.total(c))} até agora${c.pediuConta ? "<br><b>Pediu a conta</b>" : ""}</span></div>
      <div class="entre"><span class="preco">${moeda(cmd.totalRodada(r))}</span>
        <button class="btn ${r.status === "recebido" ? "btn--primario" : "btn--contorno"} btn--sm" data-rodada="${c.mesa},${i}">${acaoDaRodada[r.status]}</button></div>
    </div>`;
}

document.addEventListener("click", (e) => {
  const botao = e.target.closest("[data-rodada]");
  if (botao) {
    const [mesa, i] = botao.dataset.rodada.split(",").map(Number);
    const r = Fomito.comandas.daMesa(mesa).rodadas[i];
    const novo = Fomito.comandas.PROXIMO[r.status];
    Fomito.comandas.statusRodada(mesa, i, novo);
    renderPedidos();
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
      <div class="card kpi"><div class="kpi__rotulo">Mesas ocupadas${icone("mesa")}</div><div class="kpi__valor">${abertas.length} de 12</div></div>
      <div class="card kpi"><div class="kpi__rotulo">Pediram a conta${icone("conta")}</div><div class="kpi__valor">${conta}</div></div>
      <div class="card kpi"><div class="kpi__rotulo">Em aberto no salão${icone("moeda")}</div><div class="kpi__valor">${moeda(emAberto)}</div></div>
      <div class="card kpi"><div class="kpi__rotulo">Fechadas hoje${icone("check")}</div><div class="kpi__valor">${moeda(fechadas.reduce((s, f) => s + f.total, 0))}</div></div>
    </div>

    <div class="mini-mesas">
      ${Array.from({ length: 12 }, (_, i) => {
        const c = cmd.daMesa(i + 1);
        const s = !c ? "livre" : c.pediuConta ? "conta" : "ocupada";
        return `
          <button class="card mini-mesa ${s}" ${c ? `data-abrir-mesa="${c.mesa}"` : "disabled"}>
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
                  <td>${formas[f.forma] || "-"}</td>
                  <td class="dir preco">${moeda(f.total)}</td>
                </tr>`).join("") || `<tr><td colspan="6" class="suave" style="text-align:center;padding:24px">Nenhuma comanda fechada hoje.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card painel-card">
        <div class="pilha" style="gap:2px"><h3>QR Code das mesas</h3><span class="pequeno suave">Cada mesa tem o seu. Ao ler, o cardápio já abre com o número da mesa e o pedido vai para a comanda dela.</span></div>
        <div class="qr-mesa">
          <div class="qr-mesa__cartao">${qrFalso()}<b>Mesa 07</b><span>Aponte a câmera e peça por aqui</span></div>
          <div class="pilha" style="gap:8px">
            <span class="pequeno suave">Endereço da mesa 07:</span>
            <code class="qr-mesa__link">seusite.com.br/?mesa=7</code>
            <a class="btn btn--contorno btn--sm" href="../cliente/index.html?mesa=7">${icone("externo", "ic--sm")} Testar como cliente</a>
            <button class="btn btn--primario btn--sm" onclick="Fomito.toast('Protótipo: gera um PDF com os 12 QR Codes para imprimir','impressora')">${icone("impressora", "ic--sm")} Imprimir QR das 12 mesas</button>
          </div>
        </div>
      </div>
    </div>

    <div class="entre" style="flex-wrap:wrap">
      <p class="pequeno fraco">Os garçons lançam itens e fecham a conta pela tela de comandas.</p>
      <a class="btn btn--contorno btn--sm" href="../garcom/index.html">${icone("mesa", "ic--sm")} Abrir tela de comandas</a>
    </div>`;
}

/* ---------- 3. FICHA DA COMANDA ---------- */
function abrirComandaPainel(mesa) {
  const cmd = Fomito.comandas;
  const c = cmd.daMesa(mesa);
  if (!c) return;
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--lado";
  camada.innerHTML = `
    <div class="folha folha--lado">
      <div class="folha__topo">
        <div class="pilha" style="gap:4px"><h2>${cmd.mesaTexto(c.mesa)}</h2>
          <span class="linha" style="gap:6px"><span class="tag tag--${c.pediuConta ? "laranja" : "roxo"}">${c.pediuConta ? "Pediu a conta" : "Comanda aberta"}</span><span class="pequeno fraco">desde ${cmd.hora(c.abertaEm)}${c.nome ? ` · ${c.nome}` : ""}</span></span></div>
        <button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button>
      </div>
      ${c.rodadas.map((r, i) => {
        const st = cmd.STATUS[r.status];
        return `
          <div class="ficha-bloco">
            <div class="entre"><span class="rotulo">${i + 1}º pedido · ${cmd.hora(r.hora)} · ${r.por === "qr" ? "QR da mesa" : "garçom"}</span><span class="tag tag--${st.cor}">${st.nome}</span></div>
            ${r.itens.map((it) => `<div class="entre pequeno"><span>${it.qtd}× ${Fomito.produto(it.id).nome}</span><span class="num">${moeda(cmd.precoItem(it))}</span></div>`).join("")}
          </div>`;
      }).join("")}
      <div class="ficha-bloco">
        <div class="entre"><span class="forte">Total da comanda</span><span class="preco">${moeda(cmd.total(c))}</span></div>
        <span class="pequeno fraco">+ serviço de 10% (opcional): ${moeda(cmd.total(c) * 0.1)}</span>
      </div>
      <div class="acoes-pedido"><a class="btn btn--primario" style="flex:1" href="../garcom/index.html">${icone("mesa", "ic--sm")} Abrir nas comandas para fechar</a></div>
    </div>`;
  document.body.appendChild(camada);
  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) camada.remove();
  });
}

/* O cliente pede pelo celular: o painel confere as comandas a cada 3 segundos */
let versaoComandasPainel = JSON.stringify(Fomito.comandas.abertas());
setInterval(() => {
  const agora = JSON.stringify(Fomito.comandas.abertas());
  if (agora === versaoComandasPainel) return;
  const novas = Fomito.comandas.abertas().reduce((s, c) => s + c.rodadas.length, 0) > JSON.parse(versaoComandasPainel).reduce((s, c) => s + c.rodadas.length, 0);
  versaoComandasPainel = agora;
  if (novas) {
    alertas.tocarAlerta();
    toast("Pedido novo de uma mesa (QR Code)", "mesa");
  }
  const aberta = $(".secao:not([hidden])")?.dataset.secao;
  if (aberta === "pedidos") renderPedidos();
  if (aberta === "comandas") renderComandas();
  atualizarBadge();
}, 3000);
