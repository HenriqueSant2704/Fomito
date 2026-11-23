/* ==========================================================================
   PRONTITO · PAINEL DA LANCHONETE (lógica do protótipo)
   --------------------------------------------------------------------------
   Organização:
     1. Dados fictícios do painel
     2. Navegação do menu
     3. Visão geral (dashboard)
     4. Pedidos em tempo real (quadro)
     5. Comandas
     6. Cardápio
     7. Configurações
     8. Início
   ========================================================================== */

const { dados, moeda, icone, $, $$, toast } = Prontito;

/* ---------- 1. DADOS ---------- */
const vendasSemana = [
  { dia: "Seg", valor: 2140 }, { dia: "Ter", valor: 2580 }, { dia: "Qua", valor: 2310 },
  { dia: "Qui", valor: 2920 }, { dia: "Sex", valor: 3640 }, { dia: "Sáb", valor: 4210 }, { dia: "Dom", valor: 3850 },
];

/* status: "novo" → "preparo" → "pronto" → "concluido" */
let pedidos = [
  { num: 1042, cliente: "Ana Souza",   modo: "entrega", itens: [[2, 1], [6, 1], [10, 2]], pag: "dinheiro", troco: 100, status: "novo",    min: 1 },
  { num: 1041, cliente: "Mesa 07",     modo: "local",   itens: [[1, 2], [13, 2]],          pag: null,       status: "novo",    min: 3 },
  { num: 1040, cliente: "Bruno Lima",  modo: "entrega", itens: [[3, 1], [11, 1]],          pag: "pix",      status: "preparo", min: 9 },
  { num: 1039, cliente: "Mesa 05",     modo: "local",   itens: [[7, 1], [11, 3]],          pag: null,       status: "preparo", min: 12 },
  { num: 1038, cliente: "Carla Dias",  modo: "entrega", itens: [[5, 2], [10, 2]],          pag: "credito",  status: "pronto",  min: 21 },
  { num: 1037, cliente: "Diego Alves", modo: "entrega", itens: [[8, 1], [13, 4]],          pag: "debito",   status: "concluido", min: 38 },
  { num: 1036, cliente: "Mesa 03",     modo: "local",   itens: [[1, 1], [2, 1], [10, 2]],  pag: null,       status: "concluido", min: 44 },
];

const colunas = [
  { id: "novo",      titulo: "Novos",           cor: "var(--laranja)",  acao: "Aceitar",        proximo: "preparo" },
  { id: "preparo",   titulo: "Em preparo",      cor: "var(--amarelo-escuro)", acao: "Marcar pronto", proximo: "pronto" },
  { id: "pronto",    titulo: "Pronto / em rota", cor: "var(--roxo)",    acao: "Concluir",       proximo: "concluido" },
  { id: "concluido", titulo: "Concluídos",      cor: "var(--verde-escuro)", acao: null },
];

const totalPedido = (p) => Prontito.totalItens(p.itens.map(([id, qtd]) => ({ id, qtd }))) + (p.modo === "entrega" ? dados.lanchonete.taxaEntrega : 0);

const titulos = {
  dashboard: ["Visão geral", "Resumo de hoje, segunda-feira, 23 de novembro."],
  pedidos: ["Pedidos", "Acompanhe e avance os pedidos em tempo real."],
  comandas: ["Comandas", "Situação das mesas do salão."],
  cardapio: ["Cardápio", "Produtos, preços e disponibilidade."],
  configuracoes: ["Configurações", "Dados da lanchonete, entrega e pagamentos."],
};

/* ---------- 2. NAVEGAÇÃO ---------- */
function abrirSecao(nome) {
  $$(".menu__item").forEach((b) => b.classList.toggle("ativo", b.dataset.secao === nome));
  $$(".secao").forEach((s) => (s.hidden = s.dataset.secao !== nome));
  $("#tituloSecao").textContent = titulos[nome][0];
  $("#subtituloSecao").textContent = titulos[nome][1];
  renderizadores[nome]();
}

$("#menu").addEventListener("click", (e) => {
  const item = e.target.closest("[data-secao]");
  if (item) abrirSecao(item.dataset.secao);
});

$("#lojaAberta").addEventListener("change", (e) => {
  $("#textoLoja").textContent = e.target.checked ? "Recebendo pedidos" : "Pedidos pausados";
  toast(e.target.checked ? "Loja aberta para pedidos" : "Novos pedidos pausados", e.target.checked ? "check" : "info");
});

/* ---------- 3. VISÃO GERAL ---------- */
function graficoLinha(pontos) {
  const L = 640, A = 210, m = { e: 40, d: 12, t: 16, b: 28 };
  const max = Math.ceil(Math.max(...pontos.map((p) => p.valor)) / 1000) * 1000;
  const x = (i) => m.e + (i * (L - m.e - m.d)) / (pontos.length - 1);
  const y = (v) => m.t + (1 - v / max) * (A - m.t - m.b);
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.valor)}`).join(" ");
  const area = `${linha} L${x(pontos.length - 1)},${A - m.b} L${x(0)},${A - m.b} Z`;
  const ultimo = pontos.length - 1;
  const grades = [0, max / 2, max].map((v) => `
    <line x1="${m.e}" x2="${L - m.d}" y1="${y(v)}" y2="${y(v)}" stroke="var(--borda)" stroke-dasharray="${v ? "3 4" : "0"}" />
    <text x="${m.e - 10}" y="${y(v) + 4}" text-anchor="end">${v ? `${v / 1000} mil` : "0"}</text>`).join("");

  return `
    <svg viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" role="img" aria-label="Vendas dos últimos 7 dias">
      <defs><linearGradient id="gArea" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#4B2B8F" stop-opacity=".14"/><stop offset="1" stop-color="#4B2B8F" stop-opacity="0"/>
      </linearGradient></defs>
      ${grades}
      <path d="${area}" fill="url(#gArea)"/>
      <path d="${linha}" fill="none" stroke="var(--roxo)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      ${pontos.map((p, i) => `<text x="${x(i)}" y="${A - 6}" text-anchor="middle">${p.dia}</text>`).join("")}
      <circle cx="${x(ultimo)}" cy="${y(pontos[ultimo].valor)}" r="5" fill="var(--laranja)" stroke="#fff" stroke-width="2"><title>${pontos[ultimo].dia}: ${moeda(pontos[ultimo].valor)}</title></circle>
    </svg>`;
}

function variacao(texto, bom, sobe) {
  return `<span class="variacao ${bom ? "bom" : "ruim"}">${icone(sobe ? "sobe" : "desce")}<b>${texto}</b> vs. ontem</span>`;
}

function renderDashboard() {
  const kpis = [
    { rotulo: "Pedidos hoje", valor: "142", icone: "pedidos", v: variacao("+12%", true, true) },
    { rotulo: "Faturamento hoje", valor: "R$ 3.850", icone: "moeda", v: variacao("+18%", true, true) },
    { rotulo: "Ticket médio", valor: "R$ 27,10", icone: "alvo", v: variacao("+4%", true, true) },
    { rotulo: "Tempo médio de preparo", valor: "18 min", icone: "relogio", v: variacao("−8%", true, false) },
  ];
  const categorias = [["Lanches", 58], ["Porções", 27], ["Bebidas", 15]];
  const maisVendidos = [[2, 48], [1, 41], [6, 33], [10, 29]];

  $('[data-secao="dashboard"].secao').innerHTML = `
    <div class="kpis">
      ${kpis.map((k) => `
        <div class="card kpi">
          <div class="kpi__rotulo">${k.rotulo}${icone(k.icone)}</div>
          <div class="kpi__valor">${k.valor}</div>
          ${k.v}
        </div>`).join("")}
    </div>

    <div class="duas-colunas">
      <div class="card painel-card">
        <div class="painel-card__topo">
          <div class="pilha"><h3>Faturamento dos últimos 7 dias</h3><span class="pequeno suave">Total de ${moeda(vendasSemana.reduce((s, d) => s + d.valor, 0))}</span></div>
          <div class="filtros"><button class="filtro ativo">7 dias</button><button class="filtro">30 dias</button></div>
        </div>
        <div class="grafico">${graficoLinha(vendasSemana)}</div>
      </div>
      <div class="card painel-card">
        <h3>Vendas por categoria</h3>
        ${categorias.map(([nome, pct]) => `
          <div class="barra-cat">
            <div class="entre pequeno"><span>${nome}</span><span class="suave num">${pct}%</span></div>
            <div class="barra-cat__trilho"><span style="width:${pct}%"></span></div>
          </div>`).join("")}
        <div class="divisao-canal">
          <div><span class="pequeno suave">Entrega</span><strong>62%</strong></div>
          <div><span class="pequeno suave">No local</span><strong>38%</strong></div>
        </div>
      </div>
    </div>

    <div class="duas-colunas">
      <div class="card painel-card">
        <div class="painel-card__topo"><h3>Últimos pedidos</h3><button class="btn btn--contorno btn--sm" onclick="abrirSecao('pedidos')">Ver todos ${icone("seta", "ic--sm")}</button></div>
        <div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Tipo</th><th>Status</th><th class="dir">Total</th></tr></thead>
          <tbody>
            ${pedidos.slice(0, 5).map((p) => `
              <tr><td class="forte num">#${p.num}</td><td>${p.cliente}</td>
              <td class="suave">${p.modo === "entrega" ? "Entrega" : "No local"}</td>
              <td>${tagStatus(p.status)}</td><td class="dir preco">${moeda(totalPedido(p))}</td></tr>`).join("")}
          </tbody>
        </table></div>
      </div>
      <div class="card painel-card">
        <h3>Mais vendidos hoje</h3>
        <div class="ranking">
          ${maisVendidos.map(([id, qtd], i) => {
            const p = Prontito.produto(id);
            return `<div class="ranking__item"><span class="ranking__pos">${i + 1}</span>${Prontito.foto(p, 36)}<span style="flex:1" class="forte">${p.nome}</span><span class="suave pequeno num">${qtd} un.</span></div>`;
          }).join("")}
        </div>
      </div>
    </div>`;
}

function tagStatus(status) {
  const mapa = { novo: ["laranja", "Novo"], preparo: ["amarelo", "Em preparo"], pronto: ["roxo", "Pronto / em rota"], concluido: ["verde", "Concluído"] };
  const [cor, texto] = mapa[status];
  return `<span class="tag tag--${cor}">${texto}</span>`;
}

/* ---------- 4. PEDIDOS (QUADRO EM TEMPO REAL) ---------- */
function cardPedido(p, coluna) {
  const forma = dados.formasPagamento.find((f) => f.id === p.pag);
  const pagamento = p.modo === "local"
    ? `${icone("usuario", "ic--sm")}<span>Pagamento com o garçom</span>`
    : `${icone(forma.icone, "ic--sm")}<span>${forma.nome} na entrega${p.pag === "dinheiro" ? `<br>Troco para ${moeda(p.troco)}: levar <b>${moeda(p.troco - totalPedido(p))}</b>` : ""}</span>`;
  return `
    <div class="card pedido ${p.status === "novo" ? "pedido--novo" : ""}">
      <div class="entre"><span class="forte num">#${p.num}</span><span class="pequeno fraco">há ${p.min} min</span></div>
      <div class="entre"><span class="forte">${p.cliente}</span><span class="tag ${p.modo === "entrega" ? "tag--roxo" : "tag--cinza"}">${p.modo === "entrega" ? "Entrega" : "No local"}</span></div>
      <div class="pedido__itens">${p.itens.map(([id, q]) => `${q}× ${Prontito.produto(id).nome}`).join("<br>")}</div>
      <div class="pedido__pag">${pagamento}</div>
      <div class="entre"><span class="preco">${moeda(totalPedido(p))}</span>
        ${coluna.acao ? `<button class="btn ${p.status === "novo" ? "btn--primario" : "btn--contorno"} btn--sm" data-avancar="${p.num}">${coluna.acao}</button>` : ""}
      </div>
    </div>`;
}

function renderPedidos() {
  $('[data-secao="pedidos"].secao').innerHTML = `
    <div class="kanban">
      ${colunas.map((c) => {
        const lista = pedidos.filter((p) => p.status === c.id);
        return `
          <div class="coluna" style="--cor-coluna:${c.cor}">
            <div class="coluna__topo"><h3>${c.titulo}</h3><span class="coluna__qtd">${lista.length}</span></div>
            ${lista.map((p) => cardPedido(p, c)).join("") || `<p class="vazio-coluna">Nenhum pedido</p>`}
          </div>`;
      }).join("")}
    </div>
    <p class="pequeno fraco" style="text-align:center">Protótipo: um novo pedido chega sozinho alguns segundos depois de abrir o painel.</p>`;
  atualizarBadge();
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-avancar]");
  if (!b) return;
  const p = pedidos.find((x) => x.num === Number(b.dataset.avancar));
  p.status = colunas.find((c) => c.id === p.status).proximo;
  renderPedidos();
  toast(`Pedido #${p.num} atualizado`);
});

function atualizarBadge() {
  const novos = pedidos.filter((p) => p.status === "novo").length;
  $("#badgeNovos").textContent = novos;
  $("#badgeNovos").hidden = !novos;
}

/* Simula um pedido novo chegando */
setTimeout(() => {
  pedidos.unshift({ num: 1043, cliente: "Eduarda Rocha", modo: "entrega", itens: [[3, 1], [7, 1], [10, 1]], pag: "dinheiro", troco: 100, status: "novo", min: 0 });
  atualizarBadge();
  if (!$('[data-secao="pedidos"].secao').hidden) renderPedidos();
  toast("Novo pedido #1043 recebido", "sino");
}, 6000);

/* ---------- 5. COMANDAS ---------- */
function renderComandas() {
  const mesas = [
    [1, "livre"], [2, "conta", 168.7], [3, "ocupada", 67.8], [4, "livre"], [5, "ocupada", 59], [6, "livre"],
    [7, "ocupada", 71.8], [8, "livre"], [9, "conta", 186], [10, "livre"], [11, "ocupada", 20.5], [12, "livre"],
  ];
  const texto = { livre: "Livre", ocupada: "Ocupada", conta: "Conta" };
  const cor = { livre: "cinza", ocupada: "roxo", conta: "laranja" };
  $('[data-secao="comandas"].secao').innerHTML = `
    <div class="kpis">
      <div class="card kpi"><div class="kpi__rotulo">Mesas ocupadas${icone("mesa")}</div><div class="kpi__valor">6 de 12</div></div>
      <div class="card kpi"><div class="kpi__rotulo">Pediram a conta${icone("conta")}</div><div class="kpi__valor">2</div></div>
      <div class="card kpi"><div class="kpi__rotulo">Em aberto no salão${icone("moeda")}</div><div class="kpi__valor">${moeda(573.8)}</div></div>
      <div class="card kpi"><div class="kpi__rotulo">Garçons no turno${icone("pessoas")}</div><div class="kpi__valor">3</div></div>
    </div>
    <div class="mini-mesas">
      ${mesas.map(([n, s, v]) => `
        <div class="card mini-mesa ${s}">
          <div class="entre"><span class="pequeno fraco">Mesa</span><span class="tag tag--${cor[s]}">${texto[s]}</span></div>
          <strong>${String(n).padStart(2, "0")}</strong>
          <span class="preco pequeno">${v ? moeda(v) : "—"}</span>
        </div>`).join("")}
    </div>
    <p class="pequeno fraco">Os garçons abrem, lançam e fecham as comandas pela tela do garçom.</p>`;
}

/* ---------- 6. CARDÁPIO ---------- */
let filtroCardapio = "todas";
function renderCardapio() {
  const cats = [{ id: "todas", nome: "Todos" }, ...dados.categorias];
  const conta = (id) => dados.produtos.filter((p) => id === "todas" || p.cat === id).length;
  const lista = dados.produtos.filter((p) => filtroCardapio === "todas" || p.cat === filtroCardapio);
  $('[data-secao="cardapio"].secao').innerHTML = `
    <div class="entre" style="flex-wrap:wrap">
      <nav class="filtros" id="filtroCardapio">${cats.map((c) => `<button class="filtro ${filtroCardapio === c.id ? "ativo" : ""}" data-cat="${c.id}">${c.nome} <small>${conta(c.id)}</small></button>`).join("")}</nav>
      <button class="btn btn--primario btn--sm" onclick="Prontito.toast('Protótipo: aqui abriria o cadastro de produto','info')">${icone("mais", "ic--sm")} Novo produto</button>
    </div>
    <div class="card painel-card tabela-rolagem">
      <table class="tabela">
        <thead><tr><th>Produto</th><th>Categoria</th><th class="dir">Preço</th><th>Disponível</th><th></th></tr></thead>
        <tbody>
          ${lista.map((p) => `
            <tr>
              <td><div class="linha" style="gap:12px">${Prontito.foto(p, 40)}<div style="min-width:0"><div class="forte">${p.nome}</div><div class="pequeno suave">${p.desc}</div></div></div></td>
              <td class="suave">${dados.categorias.find((c) => c.id === p.cat).nome}</td>
              <td class="dir preco">${moeda(p.preco)}</td>
              <td><label class="interruptor"><input type="checkbox" id="disp-${p.id}" ${p.id === 9 ? "" : "checked"}><span></span></label></td>
              <td class="dir"><button class="btn-icone" aria-label="Editar ${p.nome}">${icone("editar", "ic--sm")}</button></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  $("#filtroCardapio").onclick = (e) => {
    const c = e.target.closest("[data-cat]");
    if (c) { filtroCardapio = c.dataset.cat; renderCardapio(); }
  };
}

/* ---------- 7. CONFIGURAÇÕES ---------- */
function renderConfiguracoes() {
  const l = dados.lanchonete;
  $('[data-secao="configuracoes"].secao').innerHTML = `
    <div class="duas-colunas">
      <div class="card painel-card">
        <h3>Dados da lanchonete</h3>
        <div class="form-grade">
          <div class="campo"><label for="cfgNome">Nome</label><input id="cfgNome" class="input" value="${l.nome}"></div>
          <div class="campo"><label for="cfgTel">Telefone / WhatsApp</label><input id="cfgTel" class="input" value="(11) 3333-4444"></div>
          <div class="campo" style="grid-column:1/-1"><label for="cfgEnd">Endereço</label><input id="cfgEnd" class="input" value="Av. Brasil, 1500, Centro"></div>
          <div class="campo"><label for="cfgAbre">Abre às</label><input id="cfgAbre" class="input" type="time" value="18:00"></div>
          <div class="campo"><label for="cfgFecha">Fecha às</label><input id="cfgFecha" class="input" type="time" value="23:30"></div>
          <div class="campo"><label for="cfgMesas">Número de mesas</label><input id="cfgMesas" class="input" type="number" value="12"></div>
          <div class="campo"><label for="cfgServ">Taxa de serviço no salão</label><input id="cfgServ" class="input" value="10%"></div>
        </div>
      </div>
      <div class="pilha" style="gap:16px">
        <div class="card painel-card">
          <h3>Entrega</h3>
          <div class="form-grade">
            <div class="campo"><label for="cfgTaxa">Taxa de entrega</label><input id="cfgTaxa" class="input" value="${moeda(l.taxaEntrega)}"></div>
            <div class="campo"><label for="cfgTempo">Tempo estimado</label><input id="cfgTempo" class="input" value="${l.tempoEntrega}"></div>
          </div>
        </div>
        <div class="card painel-card">
          <div class="pilha" style="gap:2px"><h3>Formas de pagamento</h3><p class="pequeno suave">O pagamento é sempre na hora: com o entregador ou com o garçom.</p></div>
          <div>
            ${dados.formasPagamento.map((f) => `
              <div class="config-pag"><span class="linha" style="gap:10px"><span class="opcao__icone">${icone(f.icone, "ic--sm")}</span>${f.nome}</span>
              <label class="interruptor"><input type="checkbox" id="pag-${f.id}" checked><span></span></label></div>`).join("")}
          </div>
        </div>
      </div>
    </div>
    <div><button class="btn btn--primario" onclick="Prontito.toast('Configurações salvas')">Salvar alterações</button></div>`;
}

/* ---------- 8. INÍCIO ---------- */
const renderizadores = {
  dashboard: renderDashboard,
  pedidos: renderPedidos,
  comandas: renderComandas,
  cardapio: renderCardapio,
  configuracoes: renderConfiguracoes,
};

$("#logo").innerHTML = Prontito.logo(true);
abrirSecao(new URLSearchParams(location.search).get("secao") || "dashboard");
