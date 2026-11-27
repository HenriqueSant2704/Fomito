/* ==========================================================================
   FOMITO · PAINEL DA LANCHONETE
   --------------------------------------------------------------------------
   Organização:
     1. Dados do painel (vêm do servidor em Fomito.estado)
     2. Navegação do menu
     3. Visão geral (dashboard)
     4. Pedidos em tempo real (quadro)
     5. Comandas → comandas.js · Caixa → caixa.js
     6. Cardápio, Clientes, detalhe e lançamento de pedido → arquivos próprios
        (cardapio.js · clientes.js · pedido.js, carregados antes deste)
     7. Equipe (usuários garçom)
     8. Configurações (marca, WhatsApp, impressão e som)
     9. Início
   ========================================================================== */

const { dados, moeda, icone, $, $$, toast, sessao, alertas } = Fomito;

/* No painel entram o administrador (tudo) e o atendente (a operação do dia).
   Garçom, motoboy ou visitante voltam ao Portal. */
const usuarioLogado = sessao.exigir("admin", "atendente");
const ehAdmin = usuarioLogado.perfil === "admin";
/* O atendente cuida dos pedidos, das comandas, do caixa e dos clientes.
   Não vê a Visão geral (faturamento), o Cardápio e as Configurações, e só olha a Equipe. */
const SECOES_ATENDENTE = ["pedidos", "comandas", "caixa", "clientes", "equipe"];
const podeVer = (secao) => ehAdmin || SECOES_ATENDENTE.includes(secao);
const iniciais = (nome) => nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/* ---------- 1. DADOS ----------
   Os números da Visão geral vêm prontos do servidor (Fomito.estado.relatorio). */
const relatorio = () => Fomito.estado.relatorio || { hoje: {}, ontem: {}, semana: [], categorias: [], entrega: 0, local: 0, maisVendidos: [] };
const hojeExtenso = () => new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

/* Pedidos de entrega e balcão: ficam em compartilhado/js/pedidos.js, os mesmos
   que o cliente acompanha e o motoboy entrega. Os das mesas vêm das comandas.
   O atendente só ACEITA e marca PRONTO. Quem conclui é quem leva o pedido:
   o motoboy (entregue, com o pagamento) e o garçom (servido na mesa). */
const lerPedidos = () => Fomito.pedidos.lista();

/* status: quais status do pedido entram em cada coluna */
const colunas = [
  { id: "novo",      titulo: "Novos",            cor: "var(--laranja)",        status: ["novo"],          acao: "Aceitar",       proximo: "preparo" },
  { id: "preparo",   titulo: "Em preparo",       cor: "var(--amarelo-escuro)", status: ["preparo"],       acao: "Marcar pronto", proximo: "pronto" },
  { id: "pronto",    titulo: "Pronto / em rota", cor: "var(--roxo)",           status: ["pronto", "rota"], acao: null },
  { id: "concluido", titulo: "Concluídos",       cor: "var(--verde-escuro)",   status: ["concluido"],     acao: null },
];
const colunaDoStatus = (status) => colunas.find((c) => c.status.includes(status));

/* Total do pedido: cada item guarda o preço da hora em que foi pedido */
const precoItem = (item) => Fomito.pedidos.precoItem(item);
const totalPedido = (p) => Fomito.pedidos.total(p);
const comTotal = (p) => ({ ...p, total: totalPedido(p) });
const nomeItem = (item) => item[5] || Fomito.produto(item[0]).nome;

/* Pedido de exemplo para a prévia e o teste do cupom (quando ainda não há pedidos) */
const pedidoExemplo = () => lerPedidos().find((x) => x.modo === "entrega") || {
  num: 1001, modo: "entrega", criadoEm: Date.now(), cliente: "Cliente de teste", telefone: "(11) 90000-0000",
  rua: "Rua Exemplo, 100", bairro: "Centro", compl: "", ref: "", endereco: "Rua Exemplo, 100, Centro", pag: "dinheiro", troco: 50,
  itens: dados.produtos.slice(0, 2).map((p) => [p.id, 1, [], "", p.preco, p.nome]),
  total: dados.produtos.slice(0, 2).reduce((s, p) => s + p.preco, 0) + dados.lanchonete.taxaEntrega,
};

const titulos = {
  dashboard: ["Visão geral", ""],
  pedidos: ["Pedidos", "Acompanhe e avance os pedidos em tempo real."],
  caixa: ["Caixa", "Quanto entrou em dinheiro, Pix e cartão, quanto deveria ter na gaveta e o fechamento do dia."],
  comandas: ["Comandas", "Mesas abertas pelo QR Code ou pelo garçom, contas fechadas e os QR Codes das mesas."],
  cardapio: ["Cardápio", "Produtos, fotos, categorias, adicionais e a vitrine do topo."],
  clientes: ["Clientes", "Cadastros feitos pelo telefone no finalizar pedido, com os endereços salvos."],
  equipe: ["Equipe", "Crie o acesso de atendentes, garçons e motoboys. Cada um entra pelo Portal e vai direto para a sua tela."],
  configuracoes: ["Configurações", "Sua marca, WhatsApp, impressora e o funcionamento da loja."],
};

/* ---------- 2. NAVEGAÇÃO ---------- */
function abrirSecao(nome) {
  if (!titulos[nome] || !podeVer(nome)) nome = ehAdmin ? "dashboard" : "pedidos";
  $$(".menu__item").forEach((b) => b.classList.toggle("ativo", b.dataset.secao === nome));
  $$(".secao").forEach((s) => (s.hidden = s.dataset.secao !== nome));
  $("#tituloSecao").textContent = titulos[nome][0];
  $("#barraSecao").textContent = titulos[nome][0];
  menuMovel(false);
  $("#subtituloSecao").textContent = nome === "dashboard" ? `Resumo de hoje, ${hojeExtenso()}.` : titulos[nome][1];
  renderizadores[nome]();
}

/* Menu ☰ (celular e telas estreitas): abre a gaveta com todas as páginas */
function menuMovel(abrir) {
  document.body.classList.toggle("menu-aberto", abrir);
  $("#menuFundo").hidden = !abrir;
  $("#abrirMenu").setAttribute("aria-expanded", String(abrir));
}
$("#abrirMenu").addEventListener("click", () => menuMovel(true));
$("#fecharMenu").addEventListener("click", () => menuMovel(false));
$("#menuFundo").addEventListener("click", () => menuMovel(false));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("menu-aberto")) menuMovel(false); });

$("#menu").addEventListener("click", (e) => {
  const item = e.target.closest("[data-secao]");
  if (item) abrirSecao(item.dataset.secao);
});

/* Pausar pedidos: o cardápio continua aberto, mas o cliente não consegue pedir */
function atualizarStatusLoja() {
  const aberta = dados.lanchonete.aberta !== false;
  $("#lojaAberta").checked = aberta;
  $("#textoLoja").textContent = aberta ? "Recebendo pedidos" : "Pedidos pausados";
}
$("#lojaAberta").addEventListener("change", async (e) => {
  const aberta = e.target.checked;
  try { await Fomito.acao("POST", "/loja/aberta", { aberta }); } finally { atualizarStatusLoja(); }
  toast(aberta ? "Loja aberta para pedidos" : "Novos pedidos pausados", aberta ? "check" : "info");
});

/* ---------- 3. VISÃO GERAL ---------- */
function graficoLinha(pontos) {
  const L = 640, A = 210, m = { e: 40, d: 12, t: 16, b: 28 };
  const max = Math.max(1000, Math.ceil(Math.max(...pontos.map((p) => p.valor)) / 1000) * 1000);
  const x = (i) => m.e + (i * (L - m.e - m.d)) / (pontos.length - 1);
  const y = (v) => m.t + (1 - v / max) * (A - m.t - m.b);
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.valor)}`).join(" ");
  const area = `${linha} L${x(pontos.length - 1)},${A - m.b} L${x(0)},${A - m.b} Z`;
  const ultimo = pontos.length - 1;
  const grades = [0, max / 2, max].map((v) => `
    <line x1="${m.e}" x2="${L - m.d}" y1="${y(v)}" y2="${y(v)}" stroke="var(--borda)" stroke-dasharray="${v ? "3 4" : "0"}" />
    <text x="${m.e - 10}" y="${y(v) + 4}" text-anchor="end">${v ? `${String(v / 1000).replace(".", ",")} mil` : "0"}</text>`).join("");

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

/* Comparação com ontem: "+12% vs. ontem". menorMelhor = tempo de preparo (cair é bom) */
function variacao(hoje, ontem, menorMelhor = false) {
  if (!ontem || hoje == null) return `<span class="variacao">${ontem === 0 || ontem == null ? "Sem dados de ontem" : ""}</span>`;
  const pct = Math.round(((hoje - ontem) / ontem) * 100);
  const sobe = pct >= 0;
  const bom = menorMelhor ? !sobe : sobe;
  return `<span class="variacao ${bom ? "bom" : "ruim"}">${icone(sobe ? "sobe" : "desce")}<b>${sobe ? "+" : "−"}${Math.abs(pct)}%</b> vs. ontem</span>`;
}

function renderDashboard() {
  const r = relatorio();
  const h = r.hoje, o = r.ontem;
  const kpis = [
    { rotulo: "Pedidos hoje", valor: String(h.pedidos ?? 0), icone: "pedidos", v: variacao(h.pedidos, o.pedidos) },
    { rotulo: "Faturamento hoje", valor: moeda(h.faturamento || 0), icone: "moeda", v: variacao(h.faturamento, o.faturamento) },
    { rotulo: "Ticket médio", valor: moeda(h.ticket || 0), icone: "alvo", v: variacao(h.ticket, o.ticket) },
    { rotulo: "Tempo médio de preparo", valor: h.preparo != null ? `${h.preparo} min` : "-", icone: "relogio", v: variacao(h.preparo, o.preparo, true) },
  ];
  const vendasSemana = r.semana.length ? r.semana : [{ dia: "Hoje", valor: 0 }, { dia: "", valor: 0 }];
  const categorias = r.categorias;
  const maisVendidos = r.maisVendidos;

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
        </div>
        <div class="grafico">${graficoLinha(vendasSemana)}</div>
      </div>
      <div class="card painel-card">
        <h3>Vendas por categoria <span class="pequeno fraco" style="font-weight:400">hoje</span></h3>
        ${categorias.map(([nome, pct]) => `
          <div class="barra-cat">
            <div class="entre pequeno"><span>${nome}</span><span class="suave num">${pct}%</span></div>
            <div class="barra-cat__trilho"><span style="width:${pct}%"></span></div>
          </div>`).join("")}
        <div class="divisao-canal">
          <div><span class="pequeno suave">Entrega</span><strong>${r.entrega}%</strong></div>
          <div><span class="pequeno suave">No local</span><strong>${r.local}%</strong></div>
        </div>
      </div>
    </div>

    <div class="duas-colunas">
      <div class="card painel-card">
        <div class="painel-card__topo"><h3>Últimos pedidos</h3><button class="btn btn--contorno btn--sm" onclick="abrirSecao('pedidos')">Ver todos ${icone("seta", "ic--sm")}</button></div>
        <div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Tipo</th><th>Status</th><th class="dir">Total</th></tr></thead>
          <tbody>
            ${lerPedidos().slice(0, 5).map((p) => `
              <tr><td class="forte num">#${p.num}</td><td>${p.cliente}</td>
              <td class="suave">${p.modo === "entrega" ? "Entrega" : "Balcão"}</td>
              <td>${tagStatus(p.status)}</td><td class="dir preco">${moeda(totalPedido(p))}</td></tr>`).join("") || `<tr><td colspan="5" class="suave" style="text-align:center;padding:24px">Nenhum pedido hoje ainda.</td></tr>`}
          </tbody>
        </table></div>
      </div>
      <div class="card painel-card">
        <h3>Mais vendidos hoje</h3>
        <div class="ranking">
          ${maisVendidos.map(([id, qtd], i) => {
            const p = Fomito.produto(id);
            return `<div class="ranking__item"><span class="ranking__pos">${i + 1}</span>${Fomito.foto(p, 36)}<span style="flex:1" class="forte">${p.nome}</span><span class="suave pequeno num">${qtd} un.</span></div>`;
          }).join("") || `<p class="pequeno suave">As vendas de hoje aparecem aqui.</p>`}
        </div>
      </div>
    </div>`;
}

function tagStatus(status) {
  const mapa = { novo: ["laranja", "Novo"], preparo: ["amarelo", "Em preparo"], pronto: ["roxo", "Pronto"], rota: ["roxo", "Em rota"], concluido: ["verde", "Concluído"], cancelado: ["vermelho", "Cancelado"] };
  const [cor, texto] = mapa[status];
  return `<span class="tag tag--${cor}">${texto}</span>`;
}

/* ---------- 4. PEDIDOS (QUADRO EM TEMPO REAL) ----------
   O atendente ACEITA (vai para Em preparo) e marca PRONTO.
   Pronto avisa quem leva: o motoboy (entrega) ou o garçom (mesa).
   Só o pedido de balcão é concluído aqui, quando o cliente retira. */
function acaoDoPedido(p) {
  if (p.status === "novo") return { texto: "Aceitar", proximo: "preparo" };
  if (p.status === "preparo") return { texto: "Marcar pronto", proximo: "pronto" };
  if (p.status === "pronto" && p.modo === "local") return { texto: "Cliente retirou", proximo: "concluido" };
  return null;
}

/* Quem está com o pedido depois de pronto */
function situacaoEntrega(p) {
  if (p.modo !== "entrega") return "";
  const h = Fomito.pedidos.hora;
  const pago = p.pagoCom === "dinheiro" && p.recebido ? ` · recebeu ${moeda(p.recebido)}${p.trocoDado ? `, troco ${moeda(p.trocoDado)}` : ""}` : "";
  const texto = {
    pronto: `${icone("relogio", "ic--sm")}<span>Aguardando o motoboy sair</span>`,
    rota: `${icone("entrega", "ic--sm")}<span>Com <b>${p.motoboy}</b> · saiu às ${h(p.saiuEm)}</span>`,
    concluido: `${icone("check", "ic--sm")}<span>Entregue por <b>${p.motoboy || "motoboy"}</b> às ${h(p.entregueEm)}${pago}</span>`,
  }[p.status];
  return texto ? `<div class="pedido__situacao pedido__situacao--${p.status}">${texto}</div>` : "";
}

function cardPedido(p) {
  const forma = dados.formasPagamento.find((f) => f.id === p.pag) || { icone: "dinheiro", nome: "Pagamento" };
  const acao = acaoDoPedido(p);
  const pagamento = p.modo === "local"
    ? (p.pag
      ? `${icone(forma.icone, "ic--sm")}<span>${forma.nome} na retirada${p.pag === "dinheiro" && p.troco ? `<br>Troco para ${moeda(p.troco)}: separar <b>${moeda(p.troco - totalPedido(p))}</b>` : ""}${p.telefone ? `<br>${p.telefone}` : ""}</span>`
      : `${icone("usuario", "ic--sm")}<span>Pagamento no balcão</span>`)
    : `${icone(forma.icone, "ic--sm")}<span>${forma.nome} na entrega${p.pag === "dinheiro" && p.troco ? `<br>Troco para ${moeda(p.troco)}: levar <b>${moeda(p.troco - totalPedido(p))}</b>` : ""}</span>`;
  return `
    <div class="card pedido ${p.status === "novo" ? "pedido--novo" : ""}" data-pedido="${p.num}" title="Ver detalhes do pedido">
      <div class="entre"><span class="forte num">#${p.num}</span><span class="pequeno fraco">há ${p.min} min</span></div>
      <div class="entre"><span class="forte">${p.cliente}</span><span class="tag ${p.modo === "entrega" ? "tag--roxo" : "tag--cinza"}">${p.modo === "entrega" ? p.bairro || "Entrega" : "Balcão"}</span></div>
      <div class="pedido__itens">${p.itens.map((item) => { const [, q, extras = [], obs] = item; return `${q}× ${nomeItem(item)}${extras.length ? ` <span class="fraco">+ ${extras.length} adicional</span>` : ""}${obs ? `<br><span class="fraco">Obs.: ${obs}</span>` : ""}`; }).join("<br>")}</div>
      ${p.status === "concluido" ? "" : `<div class="pedido__pag">${pagamento}</div>`}
      ${situacaoEntrega(p)}
      ${p.whats && p.status !== "concluido" ? `<div class="pedido__whats">${icone("whatsapp", "ic--sm")}<span>WhatsApp enviado: ${p.whats}</span></div>` : ""}
      <div class="entre"><span class="preco">${moeda(totalPedido(p))}</span>
        <span class="linha" style="gap:6px">
          ${p.status !== "novo" ? `<button class="btn-icone" data-cupom="${p.num}" aria-label="Imprimir cupom do pedido ${p.num}" title="Imprimir cupom">${icone("impressora", "ic--sm")}</button>` : ""}
          ${acao ? `<button class="btn ${p.status === "novo" ? "btn--primario" : "btn--contorno"} btn--sm" data-avancar="${p.num}">${acao.texto}</button>` : ""}
        </span>
      </div>
    </div>`;
}

function renderPedidos() {
  const todos = lerPedidos();
  $('[data-secao="pedidos"].secao').innerHTML = `
    <div class="entre" style="flex-wrap:wrap">
      <span class="pequeno suave">Você aceita e marca pronto. A entrega é finalizada pelo motoboy e a mesa pelo garçom, que recebem o aviso.</span>
      <button class="btn btn--primario btn--sm" data-lancar-pedido>${icone("mais", "ic--sm")} Lançar pedido</button>
    </div>
    <div class="kanban">
      ${colunas.map((c) => {
        const lista = todos.filter((p) => c.status.includes(p.status));
        const rodadas = rodadasDaColuna(c.id); // pedidos das mesas (comandas)
        /* Concluídos: entregas e balcão finalizados + comandas das mesas com a conta fechada, o mais recente primeiro */
        if (c.id === "concluido") {
          const fechadas = Fomito.comandas.fechadas();
          const cards = [
            ...lista.map((p) => [p.entregueEm || p.criadoEm, cardPedido(p)]),
            ...fechadas.map((f) => [f.fechadaEm, cardComandaFechada(f)]),
          ].sort((a, b) => b[0] - a[0]).map(([, html]) => html);
          return `
          <div class="coluna" style="--cor-coluna:${c.cor}">
            <div class="coluna__topo"><h3>${c.titulo}</h3><span class="coluna__qtd">${cards.length}</span></div>
            ${cards.join("") || `<p class="vazio-coluna">Nenhum pedido</p>`}
          </div>`;
        }
        return `
          <div class="coluna" style="--cor-coluna:${c.cor}">
            <div class="coluna__topo"><h3>${c.titulo}</h3><span class="coluna__qtd">${lista.length + rodadas.length}</span></div>
            ${rodadas.map(cardRodada).join("")}${lista.map(cardPedido).join("") || (rodadas.length ? "" : `<p class="vazio-coluna">Nenhum pedido</p>`)}
          </div>`;
      }).join("")}
    </div>`;
  atualizarBadge();
}

/* As mensagens de WhatsApp saem do servidor: recebido, em preparo (ao aceitar),
   saiu para entrega e entregue (pelo motoboy). */
document.addEventListener("click", async (e) => {
  const reimprimir = e.target.closest("[data-cupom]");
  if (reimprimir) return mostrarCupom(Fomito.pedidos.doNumero(reimprimir.dataset.cupom), false);

  const b = e.target.closest("[data-avancar]");
  if (!b) return;
  const antes = Fomito.pedidos.doNumero(b.dataset.avancar);
  const acao = acaoDoPedido(antes);
  if (!acao) return;
  const aceitou = antes.status === "novo";
  const p = await Fomito.pedidos.avancar(antes.num);
  pedidosSincronizados();
  renderPedidos();

  if (aceitou && Fomito.config.ler().impressao.aoAceitar) mostrarCupom(p, true);
  else if (p.status === "pronto" && p.modo === "entrega") toast(`Pedido #${p.num} pronto. Os motoboys foram avisados.`, "sino");
  else if (p.status === "pronto") toast(`Pedido #${p.num} pronto para retirar no balcão`, "sino");
  else toast(`Pedido #${p.num} atualizado`, "check");
});

/* Janela com a prévia do cupom de 80mm. Ao aceitar, já manda imprimir. */
function mostrarCupom(p, aoAceitar) {
  janelaCupom({
    titulo: aoAceitar ? "Pedido aceito" : "Cupom do pedido",
    texto: alertas.textoCupom(comTotal(p)),
    imprimir: () => alertas.imprimirCupom(comTotal(p)),
    aoAceitar,
  });
}

/* Notinha da cozinha de uma rodada da mesa (pedido pelo QR Code ou pelo garçom) */
function mostrarCupomComanda(mesa, indice, aoAceitar) {
  const c = Fomito.comandas.daMesa(mesa);
  if (!c?.rodadas[indice]) return;
  janelaCupom({
    titulo: aoAceitar ? `${Fomito.comandas.mesaTexto(mesa)} aceita` : `Comanda · ${Fomito.comandas.mesaTexto(mesa)}`,
    texto: alertas.textoCupomComanda(c, indice),
    imprimir: () => alertas.imprimirComanda(c, indice),
    aoAceitar,
  });
}

/* Janela com a prévia do cupom de 80mm. Ao aceitar, já manda imprimir. */
function janelaCupom({ titulo, texto, imprimir, aoAceitar }) {
  if (aoAceitar) imprimir();
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  camada.innerHTML = `
    <div class="folha" style="max-width:420px;display:flex;flex-direction:column;gap:16px">
      <div class="folha__topo">
        <div class="pilha"><h2>${titulo}</h2>
          <span class="pequeno suave">${aoAceitar ? "Cupom enviado para a impressora térmica (80mm)." : "Prévia na largura da impressora térmica (80mm)."}</span></div>
        <button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button>
      </div>
      <div class="cupom"><pre>${texto.replace(/</g, "&lt;")}</pre></div>

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
    if (e.target.closest("[data-imprimir]")) { imprimir(); toast("Cupom enviado para a impressora", "impressora"); }
  });
}

function atualizarBadge() {
  const novos = lerPedidos().filter((p) => p.status === "novo").length + rodadasDaColuna("novo").length;
  $("#badgeNovos").textContent = novos;
  $("#badgeNovos").hidden = !novos;
}

/* Som, aviso e o sino balançando quando o cliente pede pelo cardápio. */
function avisarPedidoNovo(texto) {
  atualizarBadge();
  if (!$('[data-secao="pedidos"].secao').hidden) renderPedidos();
  const tocou = alertas.tocarAlerta();
  toast(`${texto}${tocou ? "" : " (clique na tela para liberar o som)"}`, "sino");
  $("#btnSom").classList.add("tocando");
  setTimeout(() => $("#btnSom").classList.remove("tocando"), 2500);
}


/* ---------- 5. COMANDAS ----------
   Ficam em comandas.js (mesmas comandas do cliente e do garçom) */

/* ---------- 6. CARDÁPIO e CLIENTES ----------
   Ficam em arquivos próprios: cardapio.js, clientes.js e pedido.js */

/* ---------- 7. EQUIPE ----------
   O administrador cria o acesso de cada funcionário e escolhe o tipo:
   garçom (comandas das mesas) ou motoboy (entregas). */
const TIPOS_FUNCIONARIO = {
  atendente: {
    icone: "pedidos", sub: "Cuida dos pedidos, da expedição e do caixa",
    regras: [["check", "Entra pelo Portal e vai direto para os Pedidos do painel"], ["check", "Aceita, marca em preparo e pronto: entrega o pedido ao motoboy ou ao garçom"], ["check", "Lança pedidos, cuida das comandas, do caixa e dos clientes"], ["sino", "Ouve o alerta de pedido novo"]],
    nao: "Não vê o faturamento, não mexe no cardápio nem nas configurações e não cria acessos",
  },
  garcom: {
    icone: "mesa", sub: "Atende as mesas pelas comandas",
    regras: [["check", "Entra pelo Portal e vai direto para as comandas"], ["check", "Lança itens, serve os pedidos prontos e fecha a conta"], ["sino", "Recebe aviso quando um pedido da mesa fica pronto"]],
    nao: "Não acessa o painel, o financeiro nem as configurações",
  },
  motoboy: {
    icone: "entrega", sub: "Leva as entregas e recebe o pagamento",
    regras: [["check", "Entra pelo Portal e vai direto para as entregas"], ["check", "Vê os pedidos prontos separados por bairro, com o endereço em destaque"], ["check", "Recebe o pagamento, informa o troco e finaliza a entrega"], ["sino", "Recebe aviso quando um pedido fica pronto para sair"]],
    nao: "Não acessa o painel, o financeiro nem as configurações",
  },
};
let tipoNovoFuncionario = "atendente";

function renderEquipe() {
  const usuarios = sessao.usuarios();
  const perfis = sessao.PERFIS;
  const tipo = TIPOS_FUNCIONARIO[tipoNovoFuncionario];
  const qtd = (perfil) => usuarios.filter((u) => u.perfil === perfil).length;
  $('[data-secao="equipe"].secao').innerHTML = `
    <div class="duas-colunas">
      <div class="card painel-card">
        <div class="painel-card__topo"><h3>Pessoas com acesso</h3><span class="pequeno fraco">${qtd("garcom")} ${qtd("garcom") === 1 ? "garçom" : "garçons"} · ${qtd("motoboy")} ${qtd("motoboy") === 1 ? "motoboy" : "motoboys"}</span></div>
        <div>
          ${usuarios.map((u) => `
            <div class="membro">
              <span class="avatar">${iniciais(u.nome)}</span>
              <div class="membro__info"><span class="forte">${u.nome}</span><span class="pequeno suave">Usuário: ${u.usuario}</span></div>
              <span class="tag tag--${perfis[u.perfil].cor}">${perfis[u.perfil].nome}</span>
              ${u.perfil !== "admin" ? `<button class="btn-icone" data-remover="${u.usuario}" aria-label="Remover ${u.nome}">${icone("lixo", "ic--sm")}</button>` : `<span style="width:38px"></span>`}
            </div>`).join("")}
        </div>
      </div>

      <form class="card painel-card" id="formFuncionario" novalidate>
        <div class="pilha" style="gap:2px"><h3>Novo funcionário</h3><p class="pequeno suave">Escolha o tipo, crie o usuário e passe a senha para a pessoa.</p></div>
        <div class="campo">
          <span class="rotulo-campo">Tipo de funcionário</span>
          <div class="tipos-funcionario">
            ${Object.entries(TIPOS_FUNCIONARIO).map(([id, t]) => `
              <button type="button" class="opcao ${id === tipoNovoFuncionario ? "ativa" : ""}" data-tipo-funcionario="${id}">
                <span class="opcao__icone">${icone(t.icone)}</span>
                <span class="opcao__texto"><span class="opcao__titulo">${perfis[id].nome}</span><span class="opcao__sub">${t.sub}</span></span>
                <span class="opcao__radio"></span>
              </button>`).join("")}
          </div>
        </div>
        <div class="campo"><label for="gNome">Nome</label><input class="input" id="gNome" placeholder="${tipoNovoFuncionario === "motoboy" ? "Ex.: Pedro Alves" : "Ex.: Paula Souza"}"></div>
        <div class="form-grade">
          <div class="campo"><label for="gUsuario">Usuário</label><input class="input" id="gUsuario" placeholder="${tipoNovoFuncionario === "motoboy" ? "Ex.: pedro" : "Ex.: paula"}" autocomplete="off"></div>
          <div class="campo"><label for="gSenha">Senha</label><input class="input" id="gSenha" placeholder="Mínimo 4 caracteres" autocomplete="new-password"></div>
        </div>
        <p class="form-erro" id="gErro" hidden></p>
        <button class="btn btn--primario" type="submit">${icone("mais", "ic--sm")} Criar acesso de ${perfis[tipoNovoFuncionario].nome.toLowerCase()}</button>
        <div class="regras">
          <span class="rotulo">O que o ${perfis[tipoNovoFuncionario].nome.toLowerCase()} pode fazer</span>
          ${tipo.regras.map(([ic, texto]) => `<span class="regra">${icone(ic, "ic--sm")}${texto}</span>`).join("")}
          <span class="regra">${icone("fechar", "ic--sm")}${tipo.nao}</span>
        </div>
      </form>
    </div>`;

  /* O atendente só vê quem tem acesso: não cria nem remove */
  if (!ehAdmin) {
    $("#formFuncionario").remove();
    $$('[data-secao="equipe"].secao [data-remover]').forEach((b) => b.remove());
    return;
  }
  $("#formFuncionario").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = $("#gNome").value.trim();
    const usuario = $("#gUsuario").value.trim().toLowerCase();
    const senha = $("#gSenha").value;
    const erro = !nome || !usuario ? "Preencha o nome e o usuário."
      : senha.length < 4 ? "A senha precisa ter pelo menos 4 caracteres."
      : await sessao.criarUsuario({ nome, usuario, senha, perfil: tipoNovoFuncionario });
    if (erro) { $("#gErro").textContent = erro; $("#gErro").hidden = false; return; }
    renderEquipe();
    toast(`Acesso de ${perfis[tipoNovoFuncionario].nome.toLowerCase()} criado para ${nome}. Usuário: ${usuario}`, "equipe");
  });
  $('[data-secao="equipe"].secao').onclick = async (e) => {
    const tipoBotao = e.target.closest("[data-tipo-funcionario]");
    if (tipoBotao) { tipoNovoFuncionario = tipoBotao.dataset.tipoFuncionario; return renderEquipe(); }
    const b = e.target.closest("[data-remover]");
    if (!b) return;
    if (!(await Fomito.confirmar("Remover acesso?", `O usuário <b>${b.dataset.remover}</b> sai do sistema na hora e não consegue mais entrar.`, "Remover acesso"))) return;
    await sessao.removerUsuario(b.dataset.remover);
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
          <div class="campo"><label for="mHex1">Cor principal</label><div class="cor-campo"><input type="color" data-marca="corPrincipal" value="${m.corPrincipal}" aria-label="Escolher a cor principal"><input class="cor-hex num" id="mHex1" data-hex="corPrincipal" value="${m.corPrincipal.toUpperCase()}" maxlength="7" spellcheck="false" autocomplete="off"></div></div>
          <div class="campo"><label for="mHex2">Cor de destaque</label><div class="cor-campo"><input type="color" data-marca="corDestaque" value="${m.corDestaque}" aria-label="Escolher a cor de destaque"><input class="cor-hex num" id="mHex2" data-hex="corDestaque" value="${m.corDestaque.toUpperCase()}" maxlength="7" spellcheck="false" autocomplete="off"></div></div>
        </div>
        <div class="linha" style="gap:10px;flex-wrap:wrap">
          <button class="btn btn--contorno btn--sm" id="mInverter" type="button">${icone("seta", "ic--sm")} Inverter as cores</button>
          <span class="pequeno fraco">Digite o código (ex.: #1E3A8A) ou clique no quadradinho.</span>
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

/* --- Aba: WhatsApp (conexão pelo QR Code e mensagens automáticas) --- */
function configWhatsApp() {
  const w = rascunho.whatsapp;
  const exemplo = { nome: "Ana", pedido: 1042, loja: rascunho.marca.nome, total: moeda(69.9), previsao: dados.lanchonete.tempoEntrega, pagamento: "Dinheiro, troco para R$ 100,00", mesa: "Mesa 05", endereco: dados.lanchonete.endereco || "nosso balcão" };
  return `
    <div class="duas-colunas">
      <div class="pilha" style="gap:16px">
        <div class="card painel-card">
          <div class="painel-card__topo">
            <div class="pilha" style="gap:2px"><h3>WhatsApp da loja</h3><p class="pequeno suave">O número da loja envia as mensagens automáticas para o cliente.</p></div>
            <span class="tag ${w.conectado ? "tag--verde" : "tag--cinza"}">${w.conectado ? "Conectado" : "Desconectado"}</span>
          </div>
          ${w.conectado
            ? `<div class="whats-conectado">${icone("whatsapp")}<div class="pilha" style="flex:1"><b>${w.numero ? `+${w.numero}` : "Número conectado"}</b><span class="pequeno suave">Pronto para enviar as mensagens automáticas</span></div><button class="btn btn--contorno btn--sm" id="wDesconectar">Desconectar</button></div>
               <div class="campo"><label for="wTesteNum">Enviar mensagem de teste</label>
                 <div class="busca-tel-painel"><input id="wTesteNum" class="input" inputmode="tel" placeholder="(11) 90000-0000"><button class="btn btn--secundario" id="wTeste">Enviar teste</button></div></div>`
            : `<div class="linha" style="gap:10px;flex-wrap:wrap"><button class="btn btn--primario" id="wConectar">${icone("whatsapp", "ic--sm")} Conectar e gerar QR Code</button><span class="pequeno fraco">Abra o WhatsApp da loja e escaneie.</span></div>
               <div id="wQr" hidden></div>`}
        </div>
        <div class="aviso">${icone("info", "ic--sm")}<span>Funciona como o WhatsApp Web: você lê o QR Code uma vez e o sistema fica conectado, mesmo depois de reiniciar. Use de preferência um chip só para a loja, não o seu WhatsApp pessoal.</span></div>
      </div>

      <div class="card painel-card">
        <div class="pilha" style="gap:2px"><h3>Mensagens automáticas</h3><p class="pequeno suave">Use {nome}, {pedido}, {loja}, {total}, {previsao}, {pagamento}, {mesa} e {endereco}.</p></div>
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
  const exemplo = { ...comTotal(pedidoExemplo()) };
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
let rascunhoLoja = null; // cópia dos dados da loja enquanto o dono edita

function configLoja() {
  if (!rascunhoLoja) {
    rascunhoLoja = { ...structuredClone(dados.lanchonete), formas: Object.fromEntries(dados.formasPagamento.map((f) => [f.id, f.ativa !== false])) };
    /* Endereço antigo num campo só ("Av. Brasil, 1500, Centro"): separa em rua, número e bairro */
    if (!rascunhoLoja.rua && rascunhoLoja.endereco) {
      const m = rascunhoLoja.endereco.match(/^(.*?),\s*(\d+\w*|s\/?n)\s*(?:,\s*(.*))?$/i);
      if (m) Object.assign(rascunhoLoja, { rua: m[1].trim(), numero: m[2], bairro: (m[3] || "").trim() });
      else rascunhoLoja.rua = rascunhoLoja.endereco;
    }
  }
  const l = rascunhoLoja;
  const esc = (v) => String(v ?? "").replace(/"/g, "&quot;");
  return `
    <div class="duas-colunas">
      <div class="card painel-card">
        <h3>Dados da loja</h3>
        <div class="form-grade">
          <div class="campo"><label for="cfgTel">Telefone / WhatsApp</label><input id="cfgTel" class="input" data-loja="telefone" value="${esc(l.telefone)}" placeholder="(11) 3333-4444"></div>
          <div class="campo"><label for="cfgRua">Rua</label><input id="cfgRua" class="input" data-loja="rua" value="${esc(l.rua)}" placeholder="Ex.: Av. Brasil"></div>
          <div class="campo"><label for="cfgNumero">Número</label><input id="cfgNumero" class="input" data-loja="numero" inputmode="numeric" value="${esc(l.numero)}" placeholder="Ex.: 1500"></div>
          <div class="campo"><label for="cfgBairro">Bairro</label><input id="cfgBairro" class="input" data-loja="bairro" value="${esc(l.bairro)}" placeholder="Ex.: Centro"></div>
          <div class="campo"><label for="cfgCidade">Cidade</label><input id="cfgCidade" class="input" data-loja="cidade" value="${esc(l.cidade)}" placeholder="Ex.: São Paulo - SP"></div>
          <div class="campo"><label for="cfgAbre">Abre às</label><input id="cfgAbre" class="input" type="time" data-loja="abre" value="${esc(l.abre)}"></div>
          <div class="campo"><label for="cfgFecha">Fecha às</label><input id="cfgFecha" class="input" type="time" data-loja="fecha" value="${esc(l.fecha)}"></div>
          <div class="campo" style="grid-column:1/-1"><span class="rotulo-campo">Dias de funcionamento</span>
            <div class="dias-semana">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="dia ${(l.dias || []).includes(d) ? "ativo" : ""}" data-dia="${d}">${Fomito.DIAS[d]}</button>`).join("")}</div>
            <span class="pequeno suave" id="previaFuncionamento">No cardápio aparece: <b>${Fomito.textoFuncionamento(l) || "-"}</b></span></div>
          <div class="campo" style="grid-column:1/-1"><label for="cfgMapa">Link do Google Maps <span class="fraco">(opcional)</span></label><input id="cfgMapa" class="input" data-loja="mapa" value="${esc(l.mapa)}" placeholder="https://maps.app.goo.gl/...">
            <span class="pequeno fraco">No Google Maps, procure a loja → Compartilhar → Copiar link. Sem o link, o cardápio abre o mapa pelo endereço.</span></div>
          <div class="campo"><label for="cfgTaxa">Taxa de entrega (R$)</label><input id="cfgTaxa" class="input" inputmode="decimal" data-loja="taxaEntrega" value="${String(l.taxaEntrega).replace(".", ",")}"></div>
          <div class="campo"><label for="cfgTempo">Tempo estimado</label><input id="cfgTempo" class="input" data-loja="tempoEntrega" value="${esc(l.tempoEntrega)}"></div>
        </div>
      </div>
      <div class="card painel-card">
        <div class="pilha" style="gap:2px"><h3>Formas de pagamento</h3><p class="pequeno suave">O pagamento é sempre na hora: com o entregador ou com o garçom.</p></div>
        <div>
          ${dados.formasPagamento.map((f) => `
            <div class="config-pag"><span class="linha" style="gap:10px"><span class="opcao__icone">${icone(f.icone, "ic--sm")}</span>${f.nome}</span>
            <label class="interruptor"><input type="checkbox" id="pag-${f.id}" data-forma-ativa="${f.id}" ${l.formas[f.id] ? "checked" : ""}><span></span></label></div>`).join("")}
        </div>
      </div>
    </div>`;
}

/* Liga os campos da aba aberta ao rascunho */
function ligarConfig() {
  const sec = $('[data-secao="configuracoes"].secao');
  const atualizarPrevia = () => { const el = $("#previaApp"); if (el) el.innerHTML = previaApp(rascunho.marca); };

  sec.onclick = async (e) => {
    const aba = e.target.closest("[data-aba]");
    if (aba) { abaConfig = aba.dataset.aba; return renderConfiguracoes(); }
    const paleta = e.target.closest("[data-paleta]");
    if (paleta) {
      [rascunho.marca.corPrincipal, rascunho.marca.corDestaque] = paleta.dataset.paleta.split(",");
      return renderConfiguracoes();
    }
    if (e.target.closest("#mLogoRemover")) { rascunho.marca.logo = ""; return renderConfiguracoes(); }
    const dia = e.target.closest("[data-dia]");
    if (dia) {
      const d = Number(dia.dataset.dia);
      rascunhoLoja.dias = (rascunhoLoja.dias || []).includes(d) ? rascunhoLoja.dias.filter((x) => x !== d) : [...(rascunhoLoja.dias || []), d];
      dia.classList.toggle("ativo");
      $("#previaFuncionamento").innerHTML = `No cardápio aparece: <b>${Fomito.textoFuncionamento(rascunhoLoja) || "-"}</b>`;
      return;
    }
    if (e.target.closest("#wConectar")) return conectarWhatsApp();
    if (e.target.closest("#wDesconectar")) {
      await Fomito.acao("POST", "/whatsapp/desconectar");
      rascunho.whatsapp.conectado = false;
      toast("WhatsApp desconectado", "whatsapp");
      return renderConfiguracoes();
    }
    if (e.target.closest("#wTeste")) {
      const numero = Fomito.clientes.soDigitos($("#wTesteNum").value);
      if (numero.length < 10) return toast("Digite o celular com DDD", "info");
      await Fomito.acao("POST", "/whatsapp/teste", { numero });
      return toast("Mensagem de teste enviada", "whatsapp");
    }
    if (e.target.closest("#mInverter")) {
      [rascunho.marca.corPrincipal, rascunho.marca.corDestaque] = [rascunho.marca.corDestaque, rascunho.marca.corPrincipal];
      return renderConfiguracoes();
    }
    if (e.target.closest("#iTeste")) { alertas.imprimirCupom(comTotal(pedidoExemplo())); toast("Cupom de teste enviado para a impressora", "impressora"); }
    if (e.target.closest("#sTeste")) alertas.tocarAlerta(rascunho.som.volume);
    if (e.target.closest("#cfgRestaurar")) {
      const atual = Fomito.config.ler();
      rascunho = Fomito.config.padrao();
      rascunho.whatsapp = { ...rascunho.whatsapp, apiUrl: atual.whatsapp.apiUrl, apiKey: atual.whatsapp.apiKey, instancia: atual.whatsapp.instancia };
      renderConfiguracoes();
      toast("Valores padrão carregados. Salve para aplicar.", "info");
    }
    if (e.target.closest("#cfgSalvar")) {
      await Fomito.config.salvar(rascunho);
      if (rascunhoLoja) {
        const { formas, ...loja } = rascunhoLoja;
        Object.assign(dados.lanchonete, loja, { taxaEntrega: parseFloat(String(loja.taxaEntrega).replace(",", ".")) || 0, mesas: Number(loja.mesas) || 0, horario: Fomito.textoFuncionamento(loja) });
        dados.formasPagamento.forEach((f) => { f.ativa = formas[f.id]; });
        await Fomito.salvarCardapio();
        rascunhoLoja = null;
      }
      rascunho = Fomito.config.ler();
      Fomito.config.aplicarMarca(rascunho.marca);
      $("#logo").innerHTML = Fomito.logo(true);
      atualizarMenuLoja();
      renderConfiguracoes();
      toast("Configurações salvas e aplicadas em todo o sistema");
    }
  };

  sec.oninput = (e) => {
    const t = e.target;
    /* Código da cor digitado: aceita com ou sem # e atualiza o quadradinho */
    if (t.dataset.hex) {
      const hex = t.value.trim().replace(/^#?/, "#");
      const valido = /^#[0-9a-f]{6}$/i.test(hex);
      t.classList.toggle("cor-hex--erro", !valido && t.value.trim().length >= 6);
      if (valido) {
        rascunho.marca[t.dataset.hex] = hex.toUpperCase();
        t.previousElementSibling.value = hex.toLowerCase();
        atualizarPrevia();
        const previaLogo = $(".logo-envio__previa"); if (previaLogo) previaLogo.innerHTML = Fomito.config.simbolo(rascunho.marca);
      }
    }
    if (t.dataset.marca) {
      rascunho.marca[t.dataset.marca] = t.value;
      if (t.type === "color") t.nextElementSibling.value = t.value.toUpperCase();
      atualizarPrevia();
      const previaLogo = $(".logo-envio__previa"); if (previaLogo) previaLogo.innerHTML = Fomito.config.simbolo(rascunho.marca);
    }
    if (t.dataset.whats) rascunho.whatsapp[t.dataset.whats] = t.value;
    if (t.dataset.modelo) {
      rascunho.whatsapp.modelos[t.dataset.modelo].texto = t.value;
      $(`#previa-${t.dataset.modelo}`).textContent = Fomito.config.montarMensagem(t.value, { nome: "Ana", pedido: 1042, loja: rascunho.marca.nome, total: moeda(69.9), previsao: dados.lanchonete.tempoEntrega, pagamento: "Dinheiro, troco para R$ 100,00", mesa: "Mesa 05", endereco: dados.lanchonete.endereco || "nosso balcão" });
    }
    if (t.dataset.loja) {
      rascunhoLoja[t.dataset.loja] = t.value;
      const previa = $("#previaFuncionamento");
      if (previa) previa.innerHTML = `No cardápio aparece: <b>${Fomito.textoFuncionamento(rascunhoLoja) || "-"}</b>`;
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
    if (t.id === "sVolume") alertas.tocarAlerta(rascunho.som.volume); // ao soltar o controle, já toca no volume escolhido
    if (t.dataset.formaAtiva) rascunhoLoja.formas[t.dataset.formaAtiva] = t.checked;
    if (t.id === "mLogo" && t.files[0]) {
      Fomito.lerImagem(t.files[0], 512).then((url) => { rascunho.marca.logo = url; renderConfiguracoes(); });
    }
  };
}

/* WhatsApp: pede o QR Code ao servidor
   e fica conferindo até o celular da loja ler o código */
let esperaWhatsApp = null;
async function conectarWhatsApp() {
  const desenhar = (s) => {
    const el = $("#wQr");
    if (!el) return;
    el.hidden = false;
    el.innerHTML = s.qr
      ? `<div class="qr"><img src="${s.qr}" width="180" height="180" alt="QR Code para conectar o WhatsApp"><div class="pilha" style="gap:4px"><b>Escaneie com o WhatsApp da loja</b><span class="pequeno suave">No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho</span><span class="pequeno fraco">Esperando a leitura... o código muda sozinho a cada 20 segundos.</span></div></div>`
      : s.erro
        ? `<div class="aviso">${icone("info", "ic--sm")}<span>${s.erro}</span></div>`
        : `<div class="pequeno suave linha" style="gap:8px">${icone("relogio", "ic--sm")}Gerando o QR Code...</div>`;
  };
  desenhar(await Fomito.acao("POST", "/whatsapp/conectar"));
  clearInterval(esperaWhatsApp);
  let vezes = 0;
  esperaWhatsApp = setInterval(async () => {
    if (++vezes > 100 || abaConfig !== "whatsapp") return clearInterval(esperaWhatsApp);
    const s = await Fomito.api("GET", "/whatsapp/status").catch(() => null);
    if (!s) return;
    if (!s.conectado) {
      desenhar(s);
      if (s.estado === "off") clearInterval(esperaWhatsApp);
      return;
    }
    clearInterval(esperaWhatsApp);
    await Fomito.sincronizar();
    rascunho = Fomito.config.ler();
    renderConfiguracoes();
    toast("WhatsApp conectado", "whatsapp");
  }, 2000);
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
/* O sino liga/desliga o som só neste computador (cada balcão escolhe o seu) */
$("#btnSom").addEventListener("click", () => {
  const cfg = Fomito.config.ler();
  cfg.som.ativo = !cfg.som.ativo;
  Fomito.config.somNesteAparelho(cfg.som.ativo);
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
  caixa: renderCaixa,
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
atualizarStatusLoja();
atualizarBadge();
document.addEventListener("fomito:loja", () => { atualizarStatusLoja(); atualizarMenuLoja(); $("#logo").innerHTML = Fomito.logo(true); });
/* Menu: o atendente só vê as seções dele */
$$(".menu__item[data-secao]").forEach((b) => { b.hidden = !podeVer(b.dataset.secao); });
abrirSecao(new URLSearchParams(location.search).get("secao") || (ehAdmin ? "dashboard" : "pedidos"));
