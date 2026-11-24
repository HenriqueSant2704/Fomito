/* ==========================================================================
   FOMITO · PAINEL DA LANCHONETE (lógica do protótipo)
   --------------------------------------------------------------------------
   Organização:
     1. Dados fictícios do painel
     2. Navegação do menu
     3. Visão geral (dashboard)
     4. Pedidos em tempo real (quadro)
     5. Comandas
     6. Cardápio, Clientes, detalhe e lançamento de pedido → arquivos próprios
        (cardapio.js · clientes.js · pedido.js, carregados antes deste)
     7. Equipe (usuários garçom)
     8. Configurações (marca, WhatsApp, impressão e som)
     9. Início
   ========================================================================== */

const { dados, moeda, icone, $, $$, toast, sessao, alertas } = Fomito;

/* Só o administrador entra no painel. Garçom ou visitante volta ao Portal. */
const usuarioLogado = sessao.exigir("admin");
const iniciais = (nome) => nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/* ---------- 1. DADOS ---------- */
const vendasSemana = [
  { dia: "Seg", valor: 2140 }, { dia: "Ter", valor: 2580 }, { dia: "Qua", valor: 2310 },
  { dia: "Qui", valor: 2920 }, { dia: "Sex", valor: 3640 }, { dia: "Sáb", valor: 4210 }, { dia: "Dom", valor: 3850 },
];

/* status: "novo" → "preparo" → "pronto" → "concluido" */
/* itens: [idProduto, quantidade, adicionais?, observação?] */
let pedidos = [
  { num: 1042, cliente: "Ana Souza",   modo: "entrega", telefone: "(11) 98888-7777", endereco: "Rua das Flores, 120, Centro", itens: [[2, 1, ["bacon"], "sem cebola"], [6, 1], [10, 2]], pag: "dinheiro", troco: 100, status: "novo", min: 1 },
  { num: 1041, cliente: "Mesa 07",     modo: "local",   itens: [[1, 2], [13, 2]],          pag: null,       status: "novo",    min: 3 },
  { num: 1040, cliente: "Bruno Lima",  modo: "entrega", telefone: "(11) 97777-1234", endereco: "Av. Paulista, 900, ap 52", itens: [[3, 1], [11, 1]], pag: "pix", status: "preparo", min: 9, whats: "Em preparo" },
  { num: 1039, cliente: "Mesa 05",     modo: "local",   itens: [[7, 1], [11, 3]],          pag: null,       status: "preparo", min: 12 },
  { num: 1038, cliente: "Carla Dias",  modo: "entrega", telefone: "(11) 96666-4321", endereco: "Rua Bahia, 45, Jardim", itens: [[5, 2], [10, 2]], pag: "credito", status: "pronto", min: 21, whats: "Saiu para entrega" },
  { num: 1037, cliente: "Diego Alves", modo: "entrega", telefone: "(11) 95555-0000", endereco: "Rua Goiás, 300", itens: [[8, 1], [13, 4]], pag: "debito", status: "concluido", min: 38, whats: "Entregue" },
  { num: 1036, cliente: "Mesa 03",     modo: "local",   itens: [[1, 1], [2, 1], [10, 2]],  pag: null,       status: "concluido", min: 44 },
];

const colunas = [
  { id: "novo",      titulo: "Novos",           cor: "var(--laranja)",  acao: "Aceitar",        proximo: "preparo" },
  { id: "preparo",   titulo: "Em preparo",      cor: "var(--amarelo-escuro)", acao: "Marcar pronto", proximo: "pronto" },
  { id: "pronto",    titulo: "Pronto / em rota", cor: "var(--roxo)",    acao: "Concluir",       proximo: "concluido" },
  { id: "concluido", titulo: "Concluídos",      cor: "var(--verde-escuro)", acao: null },
];

/* Total do pedido, contando adicionais e taxa de entrega */
const precoItem = ([id, qtd, extras = []]) => {
  const p = Fomito.produto(id);
  const adicionais = (dados.adicionais[p.cat] || []).filter((a) => extras.includes(a.id));
  return (p.preco + adicionais.reduce((s, a) => s + a.preco, 0)) * qtd;
};
const totalPedido = (p) => p.itens.reduce((s, item) => s + precoItem(item), 0) + (p.modo === "entrega" ? dados.lanchonete.taxaEntrega : 0);
const comTotal = (p) => ({ ...p, total: totalPedido(p) });

const titulos = {
  dashboard: ["Visão geral", "Resumo de hoje, segunda-feira, 23 de novembro."],
  pedidos: ["Pedidos", "Acompanhe e avance os pedidos em tempo real."],
  comandas: ["Comandas", "Situação das mesas do salão."],
  cardapio: ["Cardápio", "Produtos, fotos, categorias, adicionais e a vitrine do topo."],
  clientes: ["Clientes", "Cadastros feitos pelo telefone no finalizar pedido, com os endereços salvos."],
  equipe: ["Equipe", "Crie o acesso dos garçons. Eles entram pelo Portal e vão direto para as comandas."],
  configuracoes: ["Configurações", "Sua marca, WhatsApp, impressora e o funcionamento da loja."],
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
            const p = Fomito.produto(id);
            return `<div class="ranking__item"><span class="ranking__pos">${i + 1}</span>${Fomito.foto(p, 36)}<span style="flex:1" class="forte">${p.nome}</span><span class="suave pequeno num">${qtd} un.</span></div>`;
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
    : `${icone(forma.icone, "ic--sm")}<span>${forma.nome} na entrega${p.pag === "dinheiro" && p.troco ? `<br>Troco para ${moeda(p.troco)}: levar <b>${moeda(p.troco - totalPedido(p))}</b>` : ""}</span>`;
  return `
    <div class="card pedido ${p.status === "novo" ? "pedido--novo" : ""}" data-pedido="${p.num}" title="Ver detalhes do pedido">
      <div class="entre"><span class="forte num">#${p.num}</span><span class="pequeno fraco">há ${p.min} min</span></div>
      <div class="entre"><span class="forte">${p.cliente}</span><span class="tag ${p.modo === "entrega" ? "tag--roxo" : "tag--cinza"}">${p.modo === "entrega" ? "Entrega" : "No local"}</span></div>
      <div class="pedido__itens">${p.itens.map(([id, q, extras = [], obs]) => `${q}× ${Fomito.produto(id).nome}${extras.length ? ` <span class="fraco">+ ${extras.length} adicional</span>` : ""}${obs ? `<br><span class="fraco">Obs.: ${obs}</span>` : ""}`).join("<br>")}</div>
      <div class="pedido__pag">${pagamento}</div>
      ${p.whats ? `<div class="pedido__whats">${icone("whatsapp", "ic--sm")}<span>WhatsApp enviado: ${p.whats}</span></div>` : ""}
      <div class="entre"><span class="preco">${moeda(totalPedido(p))}</span>
        <span class="linha" style="gap:6px">
          ${p.status !== "novo" ? `<button class="btn-icone" data-cupom="${p.num}" aria-label="Imprimir cupom do pedido ${p.num}" title="Imprimir cupom">${icone("impressora", "ic--sm")}</button>` : ""}
          ${coluna.acao ? `<button class="btn ${p.status === "novo" ? "btn--primario" : "btn--contorno"} btn--sm" data-avancar="${p.num}">${coluna.acao}</button>` : ""}
        </span>
      </div>
    </div>`;
}

function renderPedidos() {
  $('[data-secao="pedidos"].secao').innerHTML = `
    <div class="entre" style="flex-wrap:wrap">
      <span class="pequeno suave">Clique num pedido para ver os detalhes. Pedido por telefone ou no balcão? Lance aqui.</span>
      <button class="btn btn--primario btn--sm" data-lancar-pedido>${icone("mais", "ic--sm")} Lançar pedido</button>
    </div>
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

/* Qual mensagem de WhatsApp sai em cada mudança de status (só pedidos de entrega) */
const mensagemDoStatus = { preparo: "preparo", pronto: "saiu", concluido: "entregue" };

document.addEventListener("click", (e) => {
  const reimprimir = e.target.closest("[data-cupom]");
  if (reimprimir) return mostrarCupom(pedidos.find((x) => x.num === Number(reimprimir.dataset.cupom)), false);

  const b = e.target.closest("[data-avancar]");
  if (!b) return;
  const p = pedidos.find((x) => x.num === Number(b.dataset.avancar));
  const aceitou = p.status === "novo";
  p.status = colunas.find((c) => c.id === p.status).proximo;

  const msg = p.modo === "entrega" ? alertas.enviarWhatsApp(comTotal(p), mensagemDoStatus[p.status]) : null;
  if (msg) p.whats = msg.titulo;
  renderPedidos();

  if (aceitou && Fomito.config.ler().impressao.aoAceitar) mostrarCupom(p, true);
  else toast(msg ? `WhatsApp para ${p.cliente.split(" ")[0]}: “${msg.titulo}”` : `Pedido #${p.num} atualizado`, msg ? "whatsapp" : "check");
});

/* Janela com a prévia do cupom de 80mm. Ao aceitar, já manda imprimir. */
function mostrarCupom(p, aoAceitar) {
  const texto = aoAceitar ? alertas.imprimirCupom(comTotal(p)) : alertas.textoCupom(comTotal(p));
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  camada.innerHTML = `
    <div class="folha" style="max-width:420px;display:flex;flex-direction:column;gap:16px">
      <div class="folha__topo">
        <div class="pilha"><h2>${aoAceitar ? "Pedido aceito" : "Cupom do pedido"}</h2>
          <span class="pequeno suave">${aoAceitar ? "Cupom enviado para a impressora térmica (80mm)." : "Prévia na largura da impressora térmica (80mm)."}</span></div>
        <button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button>
      </div>
      <div class="cupom"><pre>${texto.replace(/</g, "&lt;")}</pre></div>
      ${p.whats && aoAceitar ? `<div class="pedido__whats">${icone("whatsapp", "ic--sm")}<span>WhatsApp enviado para ${p.cliente}: “${p.whats}”</span></div>` : ""}
      <div class="linha" style="gap:10px">
        <button class="btn btn--contorno" data-imprimir style="flex:1">${icone("impressora", "ic--sm")} ${aoAceitar ? "Imprimir de novo" : "Imprimir"}</button>
        <button class="btn btn--primario" data-fechar style="flex:1">Pronto</button>
      </div>
    </div>`;
  document.body.appendChild(camada);
  const fechar = () => { camada.remove(); document.removeEventListener("keydown", aoTeclar); };
  const aoTeclar = (e) => e.key === "Escape" && fechar();
  document.addEventListener("keydown", aoTeclar);
  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return fechar();
    if (e.target.closest("[data-imprimir]")) { alertas.imprimirCupom(comTotal(p)); toast("Cupom enviado para a impressora", "impressora"); }
  });
}

function atualizarBadge() {
  const novos = pedidos.filter((p) => p.status === "novo").length;
  $("#badgeNovos").textContent = novos;
  $("#badgeNovos").hidden = !novos;
}

/* Simula pedidos novos chegando: toca o alarme e manda o WhatsApp de "recebido" */
const pedidosSimulados = [
  { num: 1043, cliente: "Eduarda Rocha", modo: "entrega", telefone: "(11) 94444-2222", endereco: "Rua Pará, 77, Centro", itens: [[3, 1, ["ovo"]], [7, 1], [10, 1]], pag: "dinheiro", troco: 100 },
  { num: 1044, cliente: "Felipe Araújo", modo: "entrega", telefone: "(11) 93333-1111", endereco: "Rua Ceará, 12", itens: [[2, 2], [6, 1], [13, 2]], pag: "pix" },
];
function chegarPedido() {
  const novo = pedidosSimulados.shift();
  if (!novo) return;
  Object.assign(novo, { status: "novo", min: 0 });
  const msg = alertas.enviarWhatsApp(comTotal(novo), "recebido");
  if (msg) novo.whats = msg.titulo;
  pedidos.unshift(novo);
  atualizarBadge();
  if (!$('[data-secao="pedidos"].secao').hidden) renderPedidos();
  const tocou = alertas.tocarAlerta();
  toast(`Novo pedido #${novo.num} de ${novo.cliente}${tocou ? "" : " (clique na tela para liberar o som)"}`, "sino");
  $("#btnSom").classList.add("tocando");
  setTimeout(() => $("#btnSom").classList.remove("tocando"), 2500);
}
setTimeout(chegarPedido, 7000);
setTimeout(chegarPedido, 45000);

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
    <div class="entre" style="flex-wrap:wrap">
      <p class="pequeno fraco">Os garçons abrem, lançam e fecham as comandas pela tela de comandas.</p>
      <a class="btn btn--contorno btn--sm" href="../garcom/index.html">${icone("mesa", "ic--sm")} Abrir tela de comandas</a>
    </div>`;
}

/* ---------- 6. CARDÁPIO e CLIENTES ----------
   Ficam em arquivos próprios: cardapio.js, clientes.js e pedido.js */

/* ---------- 7. EQUIPE ---------- */
function renderEquipe() {
  const usuarios = sessao.usuarios();
  const rotulo = { admin: ["roxo", "Administrador"], garcom: ["laranja", "Garçom"] };
  $('[data-secao="equipe"].secao').innerHTML = `
    <div class="duas-colunas">
      <div class="card painel-card">
        <div class="painel-card__topo"><h3>Pessoas com acesso</h3><span class="pequeno fraco">${usuarios.length} usuários</span></div>
        <div>
          ${usuarios.map((u) => `
            <div class="membro">
              <span class="avatar">${iniciais(u.nome)}</span>
              <div class="membro__info"><span class="forte">${u.nome}</span><span class="pequeno suave">Usuário: ${u.usuario}</span></div>
              <span class="tag tag--${rotulo[u.perfil][0]}">${rotulo[u.perfil][1]}</span>
              ${u.perfil === "garcom" ? `<button class="btn-icone" data-remover="${u.usuario}" aria-label="Remover ${u.nome}">${icone("lixo", "ic--sm")}</button>` : `<span style="width:38px"></span>`}
            </div>`).join("")}
        </div>
      </div>

      <form class="card painel-card" id="formGarcom" novalidate>
        <div class="pilha" style="gap:2px"><h3>Novo garçom</h3><p class="pequeno suave">Crie o usuário e passe a senha para o garçom.</p></div>
        <div class="campo"><label for="gNome">Nome</label><input class="input" id="gNome" placeholder="Ex.: Paula Souza"></div>
        <div class="form-grade">
          <div class="campo"><label for="gUsuario">Usuário</label><input class="input" id="gUsuario" placeholder="Ex.: paula" autocomplete="off"></div>
          <div class="campo"><label for="gSenha">Senha</label><input class="input" id="gSenha" placeholder="Mínimo 4 caracteres" autocomplete="new-password"></div>
        </div>
        <p class="form-erro" id="gErro" hidden></p>
        <button class="btn btn--primario" type="submit">${icone("mais", "ic--sm")} Criar acesso de garçom</button>
        <div class="regras">
          <span class="rotulo">O que o garçom pode fazer</span>
          <span class="regra">${icone("check", "ic--sm")}Entrar pelo Portal e ir direto para as comandas</span>
          <span class="regra">${icone("check", "ic--sm")}Abrir mesas, lançar itens e fechar contas</span>
          <span class="regra">${icone("fechar", "ic--sm")}Não acessa o painel, o financeiro nem as configurações</span>
        </div>
      </form>
    </div>`;

  $("#formGarcom").addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = $("#gNome").value.trim();
    const usuario = $("#gUsuario").value.trim().toLowerCase();
    const senha = $("#gSenha").value;
    const erro = !nome || !usuario ? "Preencha o nome e o usuário."
      : senha.length < 4 ? "A senha precisa ter pelo menos 4 caracteres."
      : sessao.criarUsuario({ nome, usuario, senha, perfil: "garcom" });
    if (erro) { $("#gErro").textContent = erro; $("#gErro").hidden = false; return; }
    renderEquipe();
    toast(`Acesso criado para ${nome}. Usuário: ${usuario}`, "equipe");
  });
  $('[data-secao="equipe"].secao').onclick = (e) => {
    const b = e.target.closest("[data-remover]");
    if (!b) return;
    sessao.removerUsuario(b.dataset.remover);
    renderEquipe();
    toast("Acesso removido", "lixo");
  };
}

/* ---------- 8. CONFIGURAÇÕES ---------- */
let abaConfig = "marca";
let rascunho = null; // cópia das configurações enquanto o dono edita

function renderConfiguracoes() {
  rascunho ||= Fomito.config.ler();
  const abas = [["marca", "paleta", "Sua marca"], ["whatsapp", "whatsapp", "WhatsApp"], ["impressao", "impressora", "Impressora e som"], ["loja", "loja", "Loja e entrega"]];
  $('[data-secao="configuracoes"].secao').innerHTML = `
    <nav class="abas">${abas.map(([id, ic, nome]) => `<button class="aba ${abaConfig === id ? "ativo" : ""}" data-aba="${id}">${icone(ic, "ic--sm")}${nome}</button>`).join("")}</nav>
    <div id="conteudoConfig">${{ marca: configMarca, whatsapp: configWhatsApp, impressao: configImpressao, loja: configLoja }[abaConfig]()}</div>
    <div class="barra-salvar">
      <span class="pequeno suave">As mudanças valem para o cardápio, o Portal, o painel e as comandas.</span>
      <span class="linha" style="gap:8px">
        <button class="btn btn--contorno" id="cfgRestaurar">Restaurar padrão</button>
        <button class="btn btn--primario" id="cfgSalvar">Salvar alterações</button>
      </span>
    </div>`;
  ligarConfig();
}

/* --- Aba: Sua marca (nome, logo, cores e fontes) --- */
function configMarca() {
  const m = rascunho.marca;
  const opcoes = (lista, atual) => lista.map((f) => `<option ${f === atual ? "selected" : ""}>${f}</option>`).join("");
  return `
    <div class="duas-colunas">
      <div class="card painel-card">
        <div class="pilha" style="gap:2px"><h3>Identidade do restaurante</h3><p class="pequeno suave">O Fomito é a plataforma. Aqui o restaurante coloca a própria marca.</p></div>
        <div class="form-grade">
          <div class="campo"><label for="mNome">Nome do restaurante</label><input id="mNome" class="input" data-marca="nome" value="${m.nome}"></div>
          <div class="campo"><label for="mSlogan">Frase de apresentação</label><input id="mSlogan" class="input" data-marca="slogan" value="${m.slogan}"></div>
        </div>
        <div class="campo">
          <label>Logo</label>
          <div class="logo-envio">
            <span class="logo-envio__previa">${Fomito.config.simbolo(m)}</span>
            <div class="pilha" style="gap:6px">
              <label class="btn btn--contorno btn--sm" for="mLogo">${icone("fotos", "ic--sm")} Enviar imagem</label>
              <input type="file" id="mLogo" accept="image/*" hidden>
              ${m.logo ? `<button class="btn btn--sm" id="mLogoRemover" style="color:var(--vermelho-escuro)">Remover logo</button>` : `<span class="pequeno fraco">Sem logo, usamos a inicial do nome.</span>`}
            </div>
          </div>
        </div>
        <div class="form-grade">
          <div class="campo"><label for="mCor1">Cor principal</label><div class="cor-campo"><input type="color" id="mCor1" data-marca="corPrincipal" value="${m.corPrincipal}"><span class="num">${m.corPrincipal.toUpperCase()}</span></div></div>
          <div class="campo"><label for="mCor2">Cor de destaque</label><div class="cor-campo"><input type="color" id="mCor2" data-marca="corDestaque" value="${m.corDestaque}"><span class="num">${m.corDestaque.toUpperCase()}</span></div></div>
        </div>
        <div class="campo"><label>Combinações prontas</label>
          <div class="paletas">
            ${[["#4B2B8F", "#FF8A00"], ["#B91C1C", "#F59E0B"], ["#14532D", "#EAB308"], ["#111827", "#F97316"], ["#1E3A8A", "#22C55E"], ["#7C2D12", "#FB923C"]]
              .map(([a, b]) => `<button class="paleta" data-paleta="${a},${b}" title="${a} + ${b}"><span style="background:${a}"></span><span style="background:${b}"></span></button>`).join("")}
          </div>
        </div>
        <div class="form-grade">
          <div class="campo"><label for="mFonte1">Fonte dos títulos</label><select id="mFonte1" class="input" data-marca="fonteTitulo">${opcoes(Fomito.config.FONTES_TITULO, m.fonteTitulo)}</select></div>
          <div class="campo"><label for="mFonte2">Fonte dos textos</label><select id="mFonte2" class="input" data-marca="fonteTexto">${opcoes(Fomito.config.FONTES_TEXTO, m.fonteTexto)}</select></div>
        </div>
      </div>

      <div class="card painel-card">
        <div class="painel-card__topo"><h3>Como o cliente vai ver</h3><span class="tag tag--cinza">Prévia</span></div>
        <div class="previa-app" id="previaApp">${previaApp(m)}</div>
      </div>
    </div>`;
}

function previaApp(m) {
  const p = Fomito.produto(2);
  Fomito.config.carregarFonte(m.fonteTitulo);
  Fomito.config.carregarFonte(m.fonteTexto);
  return `
    <div class="previa-app__topo" style="background:${Fomito.config.misturar(m.corPrincipal, "#000000", 0.42)}">
      <span class="logo" style="background:#fff;padding:5px 10px 5px 5px;border-radius:999px">${Fomito.config.simbolo(m)}<span class="logo__nome" style="font-family:'${m.fonteTitulo}',system-ui,sans-serif;color:${m.corPrincipal};font-size:15px">${m.nome}</span></span>
    </div>
    <div class="previa-app__corpo" style="font-family:'${m.fonteTexto}',system-ui,sans-serif">
      <strong style="font-family:'${m.fonteTitulo}',system-ui,sans-serif;font-size:20px">${m.nome}</strong>
      <span class="pequeno suave">${m.slogan}</span>
      <div class="previa-app__item">${Fomito.foto(p, 56)}<div class="pilha" style="flex:1"><b>${p.nome}</b><span class="pequeno" style="color:${m.corPrincipal};font-weight:600">${moeda(p.preco)}</span></div>
        <span class="tag" style="background:${Fomito.config.misturar(m.corDestaque, "#FFFFFF", 0.88)};color:${Fomito.config.misturar(m.corDestaque, "#000000", 0.25)}">Mais pedido</span></div>
      <button class="btn btn--bloco" style="background:${m.corPrincipal};color:#fff">Ver sacola · ${moeda(29.9)}</button>
    </div>`;
}

/* --- Aba: WhatsApp (Evolution API) --- */
function configWhatsApp() {
  const w = rascunho.whatsapp;
  const exemplo = { nome: "Ana", pedido: 1042, loja: rascunho.marca.nome, total: moeda(69.9), previsao: dados.lanchonete.tempoEntrega, pagamento: "Dinheiro, troco para R$ 100,00" };
  return `
    <div class="duas-colunas">
      <div class="pilha" style="gap:16px">
        <div class="card painel-card">
          <div class="painel-card__topo">
            <div class="pilha" style="gap:2px"><h3>Conexão com a Evolution API</h3><p class="pequeno suave">O número da loja envia as mensagens automáticas para o cliente.</p></div>
            <span class="tag ${w.conectado ? "tag--verde" : "tag--cinza"}">${w.conectado ? "Conectado" : "Desconectado"}</span>
          </div>
          <div class="form-grade">
            <div class="campo" style="grid-column:1/-1"><label for="wUrl">URL da API</label><input id="wUrl" class="input" data-whats="apiUrl" value="${w.apiUrl}"></div>
            <div class="campo"><label for="wKey">Chave da API (apikey)</label><input id="wKey" class="input" type="password" data-whats="apiKey" value="${w.apiKey}" placeholder="Cole a chave aqui"></div>
            <div class="campo"><label for="wInst">Nome da instância</label><input id="wInst" class="input" data-whats="instancia" value="${w.instancia}"></div>
          </div>
          ${w.conectado
            ? `<div class="whats-conectado">${icone("whatsapp")}<div class="pilha" style="flex:1"><b>${w.numero}</b><span class="pequeno suave">Instância “${w.instancia}” pronta para enviar</span></div><button class="btn btn--contorno btn--sm" id="wDesconectar">Desconectar</button></div>`
            : `<div class="linha" style="gap:10px"><button class="btn btn--primario" id="wConectar">${icone("whatsapp", "ic--sm")} Conectar e gerar QR Code</button><span class="pequeno fraco">Abra o WhatsApp da loja e escaneie.</span></div>
               <div id="wQr" hidden></div>`}
        </div>
        <div class="aviso">${icone("info", "ic--sm")}<span>Protótipo: a conexão e os envios são simulados. No sistema real, o servidor (Node.js) chama a Evolution API, do mesmo jeito que no BarberFlow, e a chave fica guardada só no servidor.</span></div>
      </div>

      <div class="card painel-card">
        <div class="pilha" style="gap:2px"><h3>Mensagens automáticas</h3><p class="pequeno suave">Use {nome}, {pedido}, {loja}, {total}, {previsao} e {pagamento}.</p></div>
        ${Object.entries(w.modelos).map(([id, m]) => `
          <div class="modelo">
            <div class="entre"><span class="forte">${m.titulo}</span><label class="interruptor"><input type="checkbox" data-modelo-ativo="${id}" id="ativo-${id}" ${m.ativo ? "checked" : ""}><span></span></label></div>
            <textarea class="input" rows="2" data-modelo="${id}" id="modelo-${id}">${m.texto}</textarea>
            <div class="bolha" id="previa-${id}">${Fomito.config.montarMensagem(m.texto, exemplo)}</div>
          </div>`).join("")}
      </div>
    </div>`;
}

/* --- Aba: Impressora e som --- */
function configImpressao() {
  const { impressao: imp, som } = rascunho;
  const exemplo = { ...comTotal(pedidos.find((x) => x.num === 1042)) };
  return `
    <div class="duas-colunas">
      <div class="pilha" style="gap:16px">
        <div class="card painel-card">
          <div class="pilha" style="gap:2px"><h3>Impressora térmica</h3><p class="pequeno suave">Compatível com impressoras de cupom de 80mm, como a POS-80.</p></div>
          <div class="config-pag"><span>Imprimir o cupom ao aceitar o pedido</span><label class="interruptor"><input type="checkbox" id="iAuto" ${imp.aoAceitar ? "checked" : ""}><span></span></label></div>
          <div class="form-grade">
            <div class="campo"><label for="iLargura">Largura do papel</label><select id="iLargura" class="input"><option ${imp.largura === "80mm" ? "selected" : ""}>80mm</option><option ${imp.largura === "58mm" ? "selected" : ""}>58mm</option></select></div>
            <div class="campo"><label for="iVias">Vias por pedido</label><input id="iVias" class="input" type="number" min="1" max="3" value="${imp.vias}"></div>
            <div class="campo" style="grid-column:1/-1"><label for="iRodape">Mensagem no fim do cupom</label><input id="iRodape" class="input" value="${imp.rodape}"></div>
          </div>
          <button class="btn btn--contorno" id="iTeste">${icone("impressora", "ic--sm")} Imprimir cupom de teste</button>
        </div>
        <div class="card painel-card">
          <div class="pilha" style="gap:2px"><h3>Som de novo pedido</h3><p class="pequeno suave">Toca um alerta no computador do caixa sempre que chega pedido.</p></div>
          <div class="config-pag"><span>Tocar som quando chegar pedido</span><label class="interruptor"><input type="checkbox" id="sAtivo" ${som.ativo ? "checked" : ""}><span></span></label></div>
          <div class="campo"><label for="sVolume">Volume</label><input id="sVolume" type="range" min="0.1" max="1" step="0.1" value="${som.volume}"></div>
          <button class="btn btn--contorno" id="sTeste">${icone("sino", "ic--sm")} Testar som</button>
        </div>
      </div>
      <div class="card painel-card">
        <div class="painel-card__topo"><h3>Prévia do cupom</h3><span class="tag tag--cinza">80mm</span></div>
        <div class="cupom"><pre>${alertas.textoCupom(exemplo).replace(/</g, "&lt;")}</pre></div>
      </div>
    </div>`;
}

/* --- Aba: Loja e entrega --- */
function configLoja() {
  const l = dados.lanchonete;
  return `
    <div class="duas-colunas">
      <div class="card painel-card">
        <h3>Dados da loja</h3>
        <div class="form-grade">
          <div class="campo"><label for="cfgTel">Telefone / WhatsApp</label><input id="cfgTel" class="input" value="(11) 3333-4444"></div>
          <div class="campo"><label for="cfgMesas">Número de mesas</label><input id="cfgMesas" class="input" type="number" value="12"></div>
          <div class="campo" style="grid-column:1/-1"><label for="cfgEnd">Endereço</label><input id="cfgEnd" class="input" value="${l.endereco}"></div>
          <div class="campo"><label for="cfgAbre">Abre às</label><input id="cfgAbre" class="input" type="time" value="18:00"></div>
          <div class="campo"><label for="cfgFecha">Fecha às</label><input id="cfgFecha" class="input" type="time" value="23:30"></div>
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
    </div>`;
}

/* Liga os campos da aba aberta ao rascunho */
function ligarConfig() {
  const sec = $('[data-secao="configuracoes"].secao');
  const atualizarPrevia = () => { const el = $("#previaApp"); if (el) el.innerHTML = previaApp(rascunho.marca); };

  sec.onclick = (e) => {
    const aba = e.target.closest("[data-aba]");
    if (aba) { abaConfig = aba.dataset.aba; return renderConfiguracoes(); }
    const paleta = e.target.closest("[data-paleta]");
    if (paleta) {
      [rascunho.marca.corPrincipal, rascunho.marca.corDestaque] = paleta.dataset.paleta.split(",");
      return renderConfiguracoes();
    }
    if (e.target.closest("#mLogoRemover")) { rascunho.marca.logo = ""; return renderConfiguracoes(); }
    if (e.target.closest("#wConectar")) {
      $("#wQr").hidden = false;
      $("#wQr").innerHTML = `<div class="qr">${qrFalso()}<div class="pilha" style="gap:4px"><b>Escaneie com o WhatsApp da loja</b><span class="pequeno suave">WhatsApp → Aparelhos conectados → Conectar aparelho</span><span class="pequeno fraco">Protótipo: conecta sozinho em 3 segundos.</span></div></div>`;
      setTimeout(() => {
        Object.assign(rascunho.whatsapp, { conectado: true, numero: "+55 11 3333-4444" });
        Fomito.config.salvar({ ...Fomito.config.ler(), whatsapp: rascunho.whatsapp });
        if (abaConfig === "whatsapp") renderConfiguracoes();
        toast("WhatsApp conectado", "whatsapp");
      }, 3000);
    }
    if (e.target.closest("#wDesconectar")) { rascunho.whatsapp.conectado = false; return renderConfiguracoes(); }
    if (e.target.closest("#iTeste")) { alertas.imprimirCupom(comTotal(pedidos.find((x) => x.num === 1042))); toast("Cupom de teste enviado para a impressora", "impressora"); }
    if (e.target.closest("#sTeste")) {
      const salvo = Fomito.config.ler();
      Fomito.config.salvar({ ...salvo, som: { ...rascunho.som, ativo: true } });
      alertas.tocarAlerta();
      Fomito.config.salvar(salvo);
    }
    if (e.target.closest("#cfgRestaurar")) { rascunho = Fomito.config.padrao(); renderConfiguracoes(); toast("Valores padrão carregados. Salve para aplicar.", "info"); }
    if (e.target.closest("#cfgSalvar")) {
      Fomito.config.salvar(rascunho);
      Fomito.config.aplicarMarca(rascunho.marca);
      Object.assign(dados.lanchonete, { nome: rascunho.marca.nome, slogan: rascunho.marca.slogan });
      $("#logo").innerHTML = Fomito.logo(true);
      atualizarMenuLoja();
      toast("Configurações salvas e aplicadas em todo o sistema");
    }
  };

  sec.oninput = (e) => {
    const t = e.target;
    if (t.dataset.marca) {
      rascunho.marca[t.dataset.marca] = t.value;
      if (t.type === "color") t.nextElementSibling.textContent = t.value.toUpperCase();
      atualizarPrevia();
      const previaLogo = $(".logo-envio__previa"); if (previaLogo) previaLogo.innerHTML = Fomito.config.simbolo(rascunho.marca);
    }
    if (t.dataset.whats) rascunho.whatsapp[t.dataset.whats] = t.value;
    if (t.dataset.modelo) {
      rascunho.whatsapp.modelos[t.dataset.modelo].texto = t.value;
      $(`#previa-${t.dataset.modelo}`).textContent = Fomito.config.montarMensagem(t.value, { nome: "Ana", pedido: 1042, loja: rascunho.marca.nome, total: moeda(69.9), previsao: dados.lanchonete.tempoEntrega, pagamento: "Dinheiro, troco para R$ 100,00" });
    }
    if (t.id === "iRodape") rascunho.impressao.rodape = t.value;
    if (t.id === "iVias") rascunho.impressao.vias = Number(t.value);
    if (t.id === "sVolume") rascunho.som.volume = Number(t.value);
  };

  sec.onchange = (e) => {
    const t = e.target;
    if (t.dataset.marca) { rascunho.marca[t.dataset.marca] = t.value; atualizarPrevia(); }
    if (t.dataset.modeloAtivo) rascunho.whatsapp.modelos[t.dataset.modeloAtivo].ativo = t.checked;
    if (t.id === "iAuto") rascunho.impressao.aoAceitar = t.checked;
    if (t.id === "iLargura") rascunho.impressao.largura = t.value;
    if (t.id === "sAtivo") rascunho.som.ativo = t.checked;
    if (t.id === "mLogo" && t.files[0]) {
      const leitor = new FileReader();
      leitor.onload = () => { rascunho.marca.logo = leitor.result; renderConfiguracoes(); };
      leitor.readAsDataURL(t.files[0]);
    }
  };
}

/* Desenho de QR Code de mentira, só para o protótipo */
function qrFalso() {
  let quadrados = "";
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    const canto = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (canto) continue;
    if ((x * 7 + y * 13 + x * y) % 3 === 0) quadrados += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  const olho = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="none" stroke="#1B1530" stroke-width="1" transform="translate(.5 .5) scale(.857)" /><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
  return `<svg viewBox="-1 -1 23 23" width="132" height="132" fill="#1B1530" aria-label="QR Code de exemplo">${quadrados}${olho(0, 0)}${olho(14, 0)}${olho(0, 14)}</svg>`;
}

/* Nome e iniciais do restaurante no menu lateral */
function atualizarMenuLoja() {
  const nome = Fomito.config.ler().marca.nome;
  $("#menuLojaNome").textContent = nome;
  $("#menuLojaAvatar").textContent = iniciais(nome);
}

/* Botão do sino: liga/desliga o som de novo pedido */
function atualizarBotaoSom() {
  const ativo = Fomito.config.ler().som.ativo;
  $("#btnSom").innerHTML = icone(ativo ? "sino" : "somoff");
  $("#btnSom").title = ativo ? "Som de novo pedido ligado" : "Som de novo pedido desligado";
}
$("#btnSom").addEventListener("click", () => {
  const cfg = Fomito.config.ler();
  cfg.som.ativo = !cfg.som.ativo;
  Fomito.config.salvar(cfg);
  if (rascunho) rascunho.som.ativo = cfg.som.ativo;
  atualizarBotaoSom();
  if (cfg.som.ativo) alertas.tocarAlerta();
  toast(cfg.som.ativo ? "Som de novo pedido ligado" : "Som de novo pedido desligado", cfg.som.ativo ? "sino" : "somoff");
});

/* ---------- 9. INÍCIO ---------- */
const renderizadores = {
  dashboard: renderDashboard,
  pedidos: renderPedidos,
  comandas: renderComandas,
  cardapio: renderCardapio,
  clientes: renderClientes,
  equipe: renderEquipe,
  configuracoes: renderConfiguracoes,
};

$("#logo").innerHTML = Fomito.logo(true);
if (usuarioLogado) {
  $("#avatar").textContent = iniciais(usuarioLogado.nome);
  $("#avatar").title = usuarioLogado.nome;
}
$("#btnSair").addEventListener("click", () => sessao.sair());
atualizarMenuLoja();
atualizarBotaoSom();
abrirSecao(new URLSearchParams(location.search).get("secao") || "dashboard");
