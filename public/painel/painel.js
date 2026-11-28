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
const SECOES_ATENDENTE = ["pedidos", "comandas", "caixa", "clientes", "convenios", "equipe"];
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
  { id: "concluido", titulo: "Concluídos",       cor: "var(--verde-escuro)",   status: ["concluido", "cancelado"], acao: null },
];
const colunaDoStatus = (status) => colunas.find((c) => c.status.includes(status));

/* Total do pedido: cada item guarda o preço da hora em que foi pedido */
const precoItem = (item) => Fomito.pedidos.precoItem(item);
const totalPedido = (p) => Fomito.pedidos.total(p);
const comTotal = (p) => ({ ...p, total: totalPedido(p) });
const nomeItem = (item) => item[5] || Fomito.produto(item[0]).nome;

/* Último pedido real de entrega (botão "Usar o último pedido real" da prévia da notinha) */
const ultimoPedidoEntrega = () => lerPedidos().find((x) => x.modo === "entrega");

const titulos = {
  dashboard: ["Visão geral", ""],
  pedidos: ["Pedidos", "Acompanhe e avance os pedidos em tempo real."],
  caixa: ["Caixa", "Quanto entrou em dinheiro, Pix e cartão, quanto deveria ter na gaveta e o fechamento do dia."],
  comandas: ["Comandas", "Mesas abertas pelo QR Code ou pelo garçom, contas fechadas e os QR Codes das mesas."],
  cardapio: ["Cardápio", "Produtos, fotos, categorias, adicionais e a vitrine do topo."],
  clientes: ["Clientes", "Cadastros feitos pelo telefone no finalizar pedido, com os endereços salvos."],
  convenios: ["Convênios", "Clientes que compram agora e pagam no fechamento: quanto cada um deve, extrato e recebimento."],
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
  const f = Fomito.estado.loja || {};
  /* Fora dos dias/horário a loja fecha sozinha: o botão continua servindo para pausar */
  $("#textoLoja").textContent = !aberta ? "Pedidos pausados" : f.foraDoHorario ? `Fora do horário${f.abreEm ? ` · abre ${f.abreEm}` : ""}` : "Recebendo pedidos";
  $("#textoLoja").title = f.foraDoHorario ? "O cardápio não aceita pedidos fora dos dias e do horário de Configurações → Loja. Pelo painel você ainda lança pedidos." : "";
}
document.addEventListener("fomito:estado", () => atualizarStatusLoja());
$("#lojaAberta").addEventListener("change", async (e) => {
  const aberta = e.target.checked;
  try { await Fomito.acao("POST", "/loja/aberta", { aberta }); } finally { atualizarStatusLoja(); }
  toast(aberta ? "Loja aberta para pedidos" : "Novos pedidos pausados", aberta ? "check" : "info");
});

/* ---------- 3. VISÃO GERAL ---------- */
/* Gráfico de faturamento: escolha o período (Hoje por hora, 7 dias, 30 dias).
   Passando o mouse (ou o dedo), a bolinha corre pela linha e mostra a data e o valor daquele ponto. */
const PERIODOS_GRAFICO = {
  hoje:   { botao: "Hoje",    titulo: "Faturamento de hoje, por hora", media: "por hora" },
  semana: { botao: "7 dias",  titulo: "Faturamento dos últimos 7 dias", media: "por dia" },
  mes:    { botao: "30 dias", titulo: "Faturamento dos últimos 30 dias", media: "por dia" },
};
let periodoGrafico = (() => { try { return PERIODOS_GRAFICO[localStorage.getItem("fomito.periodoGrafico")] ? localStorage.getItem("fomito.periodoGrafico") : "semana"; } catch { return "semana"; } })();
const GRAF = { L: 640, A: 210, m: { e: 48, d: 14, t: 16, b: 28 } };

/* Topo do eixo arredondado para um número "bonito" (100, 250, 500, 1 mil, 2,5 mil...) */
function topoDoEixo(maior) {
  if (maior <= 0) return 100;
  const passo = 10 ** Math.floor(Math.log10(maior));
  const fator = [1, 2, 2.5, 5, 10].find((f) => f * passo >= maior);
  return fator * passo;
}
const valorDoEixo = (v) => v >= 1000 ? `${String(+(v / 1000).toFixed(1)).replace(".", ",")} mil` : String(Math.round(v));

function graficoLinha(pontos) {
  const { L, A, m } = GRAF;
  const max = topoDoEixo(Math.max(...pontos.map((p) => p.valor)));
  const x = (i) => m.e + (i * (L - m.e - m.d)) / Math.max(1, pontos.length - 1);
  const y = (v) => m.t + (1 - v / max) * (A - m.t - m.b);
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.valor)}`).join(" ");
  const area = `${linha} L${x(pontos.length - 1)},${A - m.b} L${x(0)},${A - m.b} Z`;
  const grades = [0, max / 2, max].map((v) => `
    <line x1="${m.e}" x2="${L - m.d}" y1="${y(v)}" y2="${y(v)}" stroke="var(--borda)" stroke-dasharray="${v ? "3 4" : "0"}" />
    <text x="${m.e - 10}" y="${y(v) + 4}" text-anchor="end">${v ? valorDoEixo(v) : "0"}</text>`).join("");
  /* Com muitos pontos (30 dias, horas) mostra só alguns rótulos para não amontoar */
  const salto = pontos.length > 16 ? Math.ceil(pontos.length / 8) : pontos.length > 9 ? 2 : 1;
  const mostraRotulo = (i) => (pontos.length - 1 - i) % salto === 0;
  const rotulo = (p) => pontos.length > 9 && p.rotulo !== "Hoje" && /\//.test(p.data) ? p.data : p.rotulo;
  const ultimo = pontos.length - 1;
  /* Bolinha e etiqueta ficam por cima em HTML: o SVG estica (preserveAspectRatio="none") e a bolinha viraria oval */
  const pct = (i) => ({ e: (x(i) / L) * 100, t: (y(pontos[i].valor) / A) * 100 });
  const fixo = pct(ultimo);

  return `
    <svg viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" role="img" aria-label="${PERIODOS_GRAFICO[periodoGrafico].titulo}">
      <defs><linearGradient id="gArea" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#4B2B8F" stop-opacity=".14"/><stop offset="1" stop-color="#4B2B8F" stop-opacity="0"/>
      </linearGradient></defs>
      ${grades}
      <path d="${area}" fill="url(#gArea)"/>
      <path d="${linha}" fill="none" stroke="var(--roxo)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      ${pontos.map((p, i) => mostraRotulo(i) ? `<text x="${x(i)}" y="${A - 6}" text-anchor="middle">${rotulo(p)}</text>` : "").join("")}
      <line class="grafico__guia" x1="0" x2="0" y1="${m.t}" y2="${A - m.b}" stroke="var(--roxo)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" style="display:none"/>
    </svg>
    <span class="grafico__ponto grafico__ponto--fixo" style="left:${fixo.e}%;top:${fixo.t}%"></span>
    <span class="grafico__ponto grafico__ponto--mouse" hidden></span>
    <div class="grafico__dica" hidden></div>`;
}

/* Liga o "passar o mouse": acha o ponto mais perto e move a bolinha, a linha-guia e a etiqueta */
function ligarDicaGrafico(caixa, pontos) {
  const { L, A, m } = GRAF;
  const max = topoDoEixo(Math.max(...pontos.map((p) => p.valor)));
  const passo = (L - m.e - m.d) / Math.max(1, pontos.length - 1);
  const ponto = caixa.querySelector(".grafico__ponto--mouse");
  const dica = caixa.querySelector(".grafico__dica");
  const guia = caixa.querySelector(".grafico__guia");
  const mostrar = (i) => {
    const p = pontos[i];
    const xv = m.e + i * passo, yv = m.t + (1 - p.valor / max) * (A - m.t - m.b);
    const esq = (xv / L) * 100, topo = (yv / A) * 100;
    ponto.hidden = false; dica.hidden = false; guia.style.display = "";
    ponto.style.left = `${esq}%`; ponto.style.top = `${topo}%`;
    guia.setAttribute("x1", xv); guia.setAttribute("x2", xv);
    dica.innerHTML = `<span class="grafico__dica-data">${p.titulo}</span><strong>${moeda(p.valor)}</strong><span class="grafico__dica-vendas">${p.vendas ? `${p.vendas} ${p.vendas === 1 ? "venda" : "vendas"}` : "Sem vendas"}</span>`;
    dica.style.left = `${esq}%`; dica.style.top = `${topo}%`;
    /* Perto das bordas a etiqueta vira para dentro, para não sair do cartão */
    dica.classList.toggle("grafico__dica--esq", esq > 78);
    dica.classList.toggle("grafico__dica--dir", esq < 22);
    dica.classList.toggle("grafico__dica--baixo", topo < 30);
  };
  const esconder = () => { ponto.hidden = true; dica.hidden = true; guia.style.display = "none"; };
  const mover = (e) => {
    const r = caixa.getBoundingClientRect();
    const xv = ((e.clientX - r.left) / r.width) * L;
    mostrar(Math.min(pontos.length - 1, Math.max(0, Math.round((xv - m.e) / passo))));
  };
  caixa.addEventListener("pointermove", mover);
  caixa.addEventListener("pointerdown", mover);
  caixa.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") esconder(); });
}

function renderGrafico() {
  const alvo = $("#cardGrafico");
  if (!alvo) return;
  const g = relatorio().grafico || {};
  const pontos = (g[periodoGrafico] || []).length ? g[periodoGrafico] : [{ rotulo: "Hoje", data: "", titulo: "Hoje", valor: 0, vendas: 0 }, { rotulo: "", data: "", titulo: "", valor: 0, vendas: 0 }];
  const per = PERIODOS_GRAFICO[periodoGrafico];
  const total = pontos.reduce((s, d) => s + d.valor, 0);
  const melhor = pontos.reduce((a, b) => (b.valor > a.valor ? b : a), pontos[0]);
  alvo.innerHTML = `
    <div class="painel-card__topo grafico__topo">
      <div class="pilha"><h3>${per.titulo}</h3>
        <span class="pequeno suave">Total de <b class="num">${moeda(total)}</b> · média de ${moeda(total / pontos.length)} ${per.media}${melhor.valor > 0 ? ` · melhor: ${melhor.titulo.replace(/^Hoje, /, "")} (${moeda(melhor.valor)})` : ""}</span></div>
      <div class="segmentado segmentado--sm" role="tablist" aria-label="Período do gráfico">
        ${Object.entries(PERIODOS_GRAFICO).map(([id, p]) => `<button type="button" role="tab" data-periodo="${id}" class="${id === periodoGrafico ? "ativo" : ""}" aria-selected="${id === periodoGrafico}">${p.botao}</button>`).join("")}
      </div>
    </div>
    <div class="grafico">${graficoLinha(pontos)}</div>`;
  ligarDicaGrafico(alvo.querySelector(".grafico"), pontos);
  alvo.querySelectorAll("[data-periodo]").forEach((b) => b.addEventListener("click", () => {
    periodoGrafico = b.dataset.periodo;
    try { localStorage.setItem("fomito.periodoGrafico", periodoGrafico); } catch {}
    renderGrafico();
  }));
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
      <div class="card painel-card" id="cardGrafico"></div>
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
  renderGrafico();
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
  const h = Fomito.pedidos.hora;
  const pago = p.pagoCom === "dinheiro" && p.recebido ? ` · recebeu ${moeda(p.recebido)}${p.trocoDado ? `, troco ${moeda(p.trocoDado)}` : ""}` : "";
  if (p.modo !== "entrega") {
    if (p.status !== "concluido") return "";
    const forma = p.pagoCom ? ` · ${(Fomito.formaPag(p.pagoCom)?.nome || p.pagoCom).toLowerCase()}` : "";
    return `<div class="pedido__situacao pedido__situacao--concluido">${icone("check", "ic--sm")}<span>Retirado às ${h(p.entregueEm)}${p.retiradoPor ? `, por <b>${p.retiradoPor}</b>` : ""}${p.pagoCom === "dinheiro" ? pago : forma}</span></div>`;
  }
  const texto = {
    pronto: `${icone("relogio", "ic--sm")}<span>Aguardando o motoboy sair</span>`,
    rota: `${icone("entrega", "ic--sm")}<span>Com <b>${p.motoboy}</b> · saiu às ${h(p.saiuEm)}</span>`,
    concluido: `${icone("check", "ic--sm")}<span>Entregue por <b>${p.motoboy || "motoboy"}</b> às ${h(p.entregueEm)}${pago}</span>`,
  }[p.status];
  return texto ? `<div class="pedido__situacao pedido__situacao--${p.status}">${texto}</div>` : "";
}

/* Pedido cancelado: o motivo que foi para o cliente, quem cancelou e a hora */
function motivoCancelado(p) {
  if (p.status !== "cancelado") return "";
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<div class="pedido__situacao pedido__situacao--cancelado">${icone("fechar", "ic--sm")}<span>Cancelado${p.canceladoPor ? ` por <b>${esc(p.canceladoPor)}</b>` : ""}${p.canceladoEm ? ` às ${Fomito.pedidos.hora(p.canceladoEm)}` : ""}${p.motivoCancelamento ? `<br>Motivo: ${esc(p.motivoCancelamento)}` : ""}</span></div>`;
}

function cardPedido(p) {
  const forma = Fomito.formaPag(p.pag) || { icone: "dinheiro", nome: "Pagamento" };
  const acao = acaoDoPedido(p);
  const pagamento = p.modo === "local"
    ? (p.pag
      ? `${icone(forma.icone, "ic--sm")}<span>${forma.nome} na retirada${p.pag === "dinheiro" && p.troco ? `<br>Troco para ${moeda(p.troco)}: separar <b>${moeda(p.troco - totalPedido(p))}</b>` : ""}${p.telefone ? `<br>${p.telefone}` : ""}</span>`
      : `${icone("usuario", "ic--sm")}<span>Pagamento no balcão</span>`)
    : `${icone(forma.icone, "ic--sm")}<span>${forma.nome} na entrega${p.pag === "dinheiro" && p.troco ? `<br>Troco para ${moeda(p.troco)}: levar <b>${moeda(p.troco - totalPedido(p))}</b>` : ""}</span>`;
  return `
    <div class="card pedido ${p.status === "novo" ? "pedido--novo" : ""} ${p.status === "cancelado" ? "pedido--cancelado" : ""}" data-pedido="${p.num}" title="Ver detalhes do pedido">
      <div class="entre"><span class="forte num">#${p.num}</span><span class="pequeno fraco">há ${p.min} min</span></div>
      <div class="entre"><span class="forte">${p.cliente}</span><span class="tag ${p.modo === "entrega" ? "tag--roxo" : "tag--cinza"}">${p.modo === "entrega" ? p.bairro || "Entrega" : "Balcão"}</span></div>
      <div class="pedido__itens">${p.itens.map((item) => { const [, q, extras = [], obs] = item; return `${q}× ${nomeItem(item)}${extras.length ? ` <span class="fraco">+ ${extras.length} adicional</span>` : ""}${obs ? `<br><span class="fraco">Obs.: ${obs}</span>` : ""}`; }).join("<br>")}</div>
      ${["concluido", "cancelado"].includes(p.status) ? "" : `<div class="pedido__pag">${pagamento}</div>`}
      ${situacaoEntrega(p)}${motivoCancelado(p)}
      ${p.whats && !["concluido", "cancelado"].includes(p.status) ? `<div class="pedido__whats">${icone("whatsapp", "ic--sm")}<span>WhatsApp enviado: ${p.whats}</span></div>` : ""}
      <div class="entre"><span class="preco">${moeda(totalPedido(p))}</span>
        <span class="linha" style="gap:6px">
          ${p.status === "cancelado" ? `<span class="tag tag--vermelho">Cancelado</span>` : ""}
          ${!["novo", "cancelado"].includes(p.status) ? `<button class="btn-icone" data-cupom="${p.num}" aria-label="Imprimir cupom do pedido ${p.num}" title="Imprimir cupom">${icone("impressora", "ic--sm")}</button>` : ""}
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
            ...lista.map((p) => [p.entregueEm || p.canceladoEm || p.criadoEm, cardPedido(p)]),
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
  /* Cliente retirou no balcão: antes de concluir, registra como pagou (vai para o caixa) */
  let pagamento;
  if (acao.proximo === "concluido") {
    pagamento = await janelaRetirada(antes);
    if (!pagamento) return;
  }
  const p = await Fomito.pedidos.avancar(antes.num, pagamento);
  pedidosSincronizados();
  renderPedidos();

  if (aceitou && Fomito.config.ler().impressao.aoAceitar) mostrarCupom(p, true);
  else if (p.status === "pronto" && p.modo === "entrega") toast(`Pedido #${p.num} pronto. Os motoboys foram avisados.`, "sino");
  else if (p.status === "pronto") toast(`Pedido #${p.num} pronto para retirar no balcão`, "sino");
  else if (p.status === "concluido") toast(`Pedido #${p.num} retirado${p.trocoDado ? ` · troco ${moeda(p.trocoDado)}` : ""}. Pagamento no caixa.`, "check");
  else toast(`Pedido #${p.num} atualizado`, "check");
});

/* "Cliente retirou": como ele pagou no balcão. Convênio não cobra. */
function janelaRetirada(p) {
  const total = totalPedido(p);
  return janelaPagamento({
    titulo: `Cliente retirou · #${p.num}`,
    subtitulo: p.cliente,
    total,
    combinado: p.pag ? `Combinado: ${Fomito.formaPag(p.pag)?.nome || "-"}${p.pag === "dinheiro" && p.troco ? `, troco para ${moeda(p.troco)}` : ""}` : "Pagamento no balcão",
    forma: p.pag === "convenio" ? "convenio" : p.pag || "",
    trocoCombinado: p.troco,
    botao: p.pag === "convenio" ? "Cliente retirou" : "Recebi e o cliente retirou",
  }).then((r) => r && { forma: r.forma, recebido: r.recebido });
}

/**
 * Janela de pagamento do painel (igual ao motoboy e ao garçom): forma, e no dinheiro
 * o valor recebido é OBRIGATÓRIO e o troco é calculado; se faltar, não deixa confirmar.
 * valorEditavel: o valor pode ser menor (pagar uma parte), até "total".
 * Devolve { forma, valor, recebido, obs } ou null se fechar a janela.
 */
function janelaPagamento({ titulo, subtitulo = "", total, rotuloTotal = "Valor do pedido", combinado = "", forma = "", trocoCombinado = null, botao = "Confirmar", valorEditavel = false, observacao = false }) {
  const arred = (n) => Math.round(n * 100) / 100;
  const numero = (t) => parseFloat(String(t).replace(/\./g, "").replace(",", ".")) || 0;
  const convenio = forma === "convenio";
  const r = { forma, recebido: "", valor: total.toFixed(2).replace(".", ","), obs: "" };
  const formas = Fomito.formasAtivas();
  const valor = () => (valorEditavel ? arred(numero(r.valor)) : total);
  const notas = () => { const v = valor(); return [...new Set([trocoCombinado, Math.ceil(v / 10) * 10, Math.ceil(v / 50) * 50, Math.ceil(v / 100) * 100])].filter((n) => n && n > v).slice(0, 3); };
  const caixaAberto = () => !!Fomito.caixa.aberto();
  const problema = () => {
    if (!caixaAberto()) return "O caixa está fechado. Abra o caixa (menu Caixa) para registrar o pagamento.";
    if (!(valor() > 0)) return "Informe o valor.";
    if (valor() > total + 0.005) return `O valor não pode passar de ${moeda(total)}.`;
    if (!r.forma) return "Escolha a forma de pagamento.";
    if (r.forma !== "dinheiro") return null;
    if (!r.recebido) return "Informe quanto o cliente entregou em dinheiro para calcular o troco.";
    if (numero(r.recebido) < valor()) return `Faltam ${moeda(valor() - numero(r.recebido))} para cobrir o valor.`;
    return null;
  };
  const blocoTroco = () => {
    if (r.forma !== "dinheiro") return "";
    if (!r.recebido) return `<div class="troco-caixa aviso-campo">${icone("info", "ic--sm")}<span>Campo obrigatório: o troco é calculado a partir do valor recebido.</span></div>`;
    const v = numero(r.recebido);
    return v < valor()
      ? `<div class="troco-caixa erro"><span>Faltam</span><strong class="num">${moeda(valor() - v)}</strong></div>`
      : `<div class="troco-caixa"><span>Troco a devolver</span><strong class="num">${moeda(v - valor())}</strong></div>`;
  };
  const areaConfirmar = () => {
    const erro = problema();
    const mostrar = erro && (r.recebido !== "" || !caixaAberto() || (valorEditavel && (valor() > total + 0.005 || !(valor() > 0))));
    return `${mostrar ? `<p class="form-erro">${erro}</p>` : ""}
      <button class="btn btn--primario btn--bloco" data-confirmar ${erro ? "disabled" : ""}>${icone("check", "ic--sm")} ${botao}</button>`;
  };

  return new Promise((resolver) => {
    const camada = document.createElement("div");
    camada.className = "sobreposicao sobreposicao--centro";
    document.body.appendChild(camada);
    let enviado = false;
    const fechar = (resultado) => { camada.remove(); document.removeEventListener("keydown", tecla); resolver(resultado); };
    const tecla = (e) => { if (e.key === "Escape") fechar(null); };
    document.addEventListener("keydown", tecla);
    const desenhar = () => {
      camada.innerHTML = `
        <div class="folha receber" style="max-width:460px">
          <div class="folha__topo"><div class="pilha" style="gap:2px"><h2>${titulo}</h2><span class="pequeno suave">${subtitulo}</span></div><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
          <div class="receber__total"><span class="rotulo">${rotuloTotal}</span><span class="preco">${moeda(total)}</span>${combinado ? `<span class="pequeno suave">${combinado}</span>` : ""}</div>
          ${valorEditavel ? `
            <div class="campo"><label for="valorPagamento">Valor que o cliente está pagando agora</label>
              <input class="input num" id="valorPagamento" inputmode="decimal" value="${r.valor}">
              <span class="pequeno fraco">Para pagar só uma parte, diminua o valor.</span></div>` : ""}
          ${convenio
            ? `<div class="aviso aviso--convenio">${icone("conta", "ic--sm")}<span><b>Convênio:</b> não cobre nada. O valor vai para a conta do cliente na loja.</span></div>`
            : `<div class="campo"><span class="rotulo-campo">Como o cliente pagou?</span>
                <div class="formas-painel">
                  ${formas.map((f) => `<button class="opcao ${r.forma === f.id ? "ativa" : ""}" data-forma="${f.id}"><span class="opcao__icone">${icone(f.icone, "ic--sm")}</span><span class="opcao__titulo pequeno">${f.nome}</span></button>`).join("")}
                </div></div>`}
          ${r.forma === "dinheiro" ? `
            <div class="campo"><label for="recebidoPagamento">Valor recebido em dinheiro <span class="obrigatorio">*</span></label>
              <input class="input num ${r.recebido ? "" : "input--pendente"}" id="recebidoPagamento" inputmode="decimal" placeholder="Quanto o cliente entregou" value="${r.recebido}">
              <div class="notas" id="notasPagamento">${botoesNotas()}</div>
            </div>
            <div id="caixaTroco">${blocoTroco()}</div>` : ""}
          ${observacao ? `<div class="campo"><label for="obsPagamento">Observação <span class="fraco">(opcional)</span></label><input class="input" id="obsPagamento" maxlength="200" value="${r.obs.replace(/"/g, "&quot;")}"></div>` : ""}
          <div id="areaConfirmar">${areaConfirmar()}</div>
        </div>`;
    };
    function botoesNotas() {
      return `<button data-nota="${valor()}">Valor exato</button>
        ${notas().map((n) => `<button data-nota="${n}">${moeda(n)}${n === trocoCombinado ? " (combinado)" : ""}</button>`).join("")}`;
    }
    const parcial = () => {
      if ($("#caixaTroco", camada)) $("#caixaTroco", camada).innerHTML = blocoTroco();
      if ($("#notasPagamento", camada)) $("#notasPagamento", camada).innerHTML = botoesNotas();
      $("#areaConfirmar", camada).innerHTML = areaConfirmar();
      $("#recebidoPagamento", camada)?.classList.toggle("input--pendente", !r.recebido);
    };
    const confirmar = () => {
      if (problema() || enviado) return;
      enviado = true; // um clique só
      fechar({ forma: r.forma, valor: valor(), recebido: r.forma === "dinheiro" ? arred(numero(r.recebido)) : null, obs: r.obs.trim() });
    };
    desenhar();
    camada.addEventListener("click", (e) => {
      if (e.target === camada || e.target.closest("[data-fechar]")) return fechar(null);
      const f = e.target.closest("[data-forma]");
      if (f) { r.forma = f.dataset.forma; r.recebido = ""; return desenhar(); }
      const nota = e.target.closest("[data-nota]");
      if (nota) { r.recebido = Number(nota.dataset.nota).toFixed(2).replace(".", ","); $("#recebidoPagamento", camada).value = r.recebido; return parcial(); }
      if (e.target.closest("[data-confirmar]")) confirmar();
    });
    camada.addEventListener("input", (e) => {
      if (e.target.id === "recebidoPagamento") { r.recebido = e.target.value; parcial(); }
      if (e.target.id === "valorPagamento") { r.valor = e.target.value; parcial(); }
      if (e.target.id === "obsPagamento") r.obs = e.target.value;
    });
    camada.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("input")) confirmar(); });
  });
}

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
              <span class="membro__acoes">
                <button class="btn-icone" data-editar-membro="${u.usuario}" aria-label="Editar ${u.nome}" title="Editar nome, usuário, tipo e senha">${icone("editar", "ic--sm")}</button>
                ${u.perfil !== "admin" ? `<button class="btn-icone" data-remover="${u.usuario}" aria-label="Remover ${u.nome}" title="Remover acesso">${icone("lixo", "ic--sm")}</button>` : ""}
              </span>
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
    $$('[data-secao="equipe"].secao [data-remover], [data-secao="equipe"].secao [data-editar-membro]').forEach((b) => b.remove());
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
    const editar = e.target.closest("[data-editar-membro]");
    if (editar) return editarMembro(editar.dataset.editarMembro);
    const b = e.target.closest("[data-remover]");
    if (!b) return;
    if (!(await Fomito.confirmar("Remover acesso?", `O usuário <b>${b.dataset.remover}</b> sai do sistema na hora e não consegue mais entrar.`, "Remover acesso"))) return;
    await sessao.removerUsuario(b.dataset.remover);
    renderEquipe();
    toast("Acesso removido", "lixo");
  };
}

/* Editar um funcionário: nome, usuário de login, tipo e senha nova (opcional) */
function editarMembro(login) {
  const u = sessao.usuarios().find((x) => x.usuario === login);
  if (!u) return;
  const perfis = sessao.PERFIS;
  const euMesmo = u.usuario === usuarioLogado.usuario;
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  camada.innerHTML = `
    <form class="folha" style="max-width:440px;display:flex;flex-direction:column;gap:14px" novalidate>
      <div class="folha__topo"><div class="linha" style="gap:12px"><span class="avatar">${iniciais(u.nome)}</span><div class="pilha" style="gap:0"><h2>Editar acesso</h2><span class="pequeno suave">${u.nome}${euMesmo ? " (você)" : ""}</span></div></div><button type="button" class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
      <div class="campo"><label for="eNome">Nome</label><input class="input" id="eNome" maxlength="60" value="${u.nome.replace(/"/g, "&quot;")}"></div>
      <div class="form-grade">
        <div class="campo"><label for="eUsuario">Usuário (para entrar)</label><input class="input" id="eUsuario" maxlength="30" autocomplete="off" value="${u.usuario}"></div>
        <div class="campo"><label for="ePerfil">Tipo</label><select class="input" id="ePerfil" ${euMesmo ? "disabled" : ""}>${Object.entries(perfis).map(([id, p]) => `<option value="${id}" ${id === u.perfil ? "selected" : ""}>${p.nome}</option>`).join("")}</select></div>
      </div>
      <div class="campo">
        <label for="eSenha">Senha nova <span class="fraco">(deixe em branco para manter)</span></label>
        <div class="campo-senha"><input class="input" id="eSenha" type="password" autocomplete="new-password" placeholder="Mínimo 4 caracteres"><button type="button" class="link pequeno" data-ver-senha>Mostrar</button></div>
      </div>
      ${u.perfil === "motoboy" ? `<p class="pequeno fraco">Se mudar o nome, as entregas em rota e a bolsa de hoje passam para o nome novo.</p>` : ""}
      ${euMesmo ? `<p class="pequeno fraco">Você não pode mudar o seu próprio tipo de acesso.</p>` : ""}
      <p class="form-erro" id="eErro" hidden></p>
      <button class="btn btn--primario btn--bloco" type="submit" data-ok>${icone("check", "ic--sm")} Salvar alterações</button>
    </form>`;
  document.body.appendChild(camada);
  const form = camada.querySelector("form");
  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return camada.remove();
    const ver = e.target.closest("[data-ver-senha]");
    if (ver) { const i = $("#eSenha", camada); i.type = i.type === "password" ? "text" : "password"; ver.textContent = i.type === "password" ? "Mostrar" : "Esconder"; }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = $("#eNome", camada).value.trim();
    const usuario = $("#eUsuario", camada).value.trim().toLowerCase();
    const senha = $("#eSenha", camada).value;
    const perfil = $("#ePerfil", camada).value;
    const mostrar = (t) => { $("#eErro", camada).textContent = t; $("#eErro", camada).hidden = false; };
    if (!nome || !usuario) return mostrar("Preencha o nome e o usuário.");
    if (senha && senha.length < 4) return mostrar("A senha nova precisa ter pelo menos 4 caracteres.");
    const erro = await sessao.editarUsuario(u.usuario, { nome, usuario, perfil, senha });
    if (erro) return mostrar(erro);
    camada.remove();
    if (euMesmo) { usuarioLogado.nome = nome; usuarioLogado.usuario = usuario; $("#avatar").textContent = iniciais(nome); }
    renderEquipe();
    toast(senha ? `${nome}: dados e senha atualizados` : `${nome} atualizado`, "check");
  });
}

/* ---------- 8. CONFIGURAÇÕES ---------- */
let abaConfig = "marca";
let rascunho = null; // cópia das configurações enquanto o dono edita

/* "Restaurar" volta ao padrão SÓ a parte da aba aberta (antes voltava tudo, até as cores) */
const RESTAURAR = {
  marca: { nome: "cores e fontes", texto: "As cores e as fontes da marca voltam ao padrão. O nome, a frase e a logo continuam.",
    aplicar: (p) => { const { corPrincipal, corDestaque, fonteTitulo, fonteTexto } = p.marca; Object.assign(rascunho.marca, { corPrincipal, corDestaque, fonteTitulo, fonteTexto }); } },
  whatsapp: { nome: "mensagens", texto: "Os textos das mensagens automáticas voltam ao padrão. A conexão do WhatsApp continua.",
    aplicar: (p) => { rascunho.whatsapp.modelos = p.whatsapp.modelos; } },
  impressao: { nome: "impressora e som", texto: "A notinha, a impressora e o som voltam ao padrão.",
    aplicar: (p) => { rascunho.impressao = p.impressao; rascunho.som = p.som; } },
};

function renderConfiguracoes() {
  rascunho ||= Fomito.config.ler();
  const abas = [["marca", "paleta", "Sua marca"], ["whatsapp", "whatsapp", "WhatsApp"], ["impressao", "impressora", "Impressora e som"], ["loja", "loja", "Loja e entrega"]];
  $('[data-secao="configuracoes"].secao').innerHTML = `
    <nav class="abas">${abas.map(([id, ic, nome]) => `<button class="aba ${abaConfig === id ? "ativo" : ""}" data-aba="${id}">${icone(ic, "ic--sm")}${nome}</button>`).join("")}</nav>
    <div id="conteudoConfig">${{ marca: configMarca, whatsapp: configWhatsApp, impressao: configImpressao, loja: configLoja }[abaConfig]()}</div>
    <div class="barra-salvar">
      <span class="pequeno suave">As mudanças valem para o cardápio, o Portal, o painel e as comandas.</span>
      <span class="linha" style="gap:8px">
        ${RESTAURAR[abaConfig] ? `<button class="btn btn--contorno" id="cfgRestaurar">Restaurar ${RESTAURAR[abaConfig].nome}</button>` : ""}
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
          <div class="campo"><label for="mFonte1">Fonte dos títulos</label><select id="mFonte1" class="input" data-fontes data-marca="fonteTitulo">${opcoes(Fomito.config.FONTES_TITULO, m.fonteTitulo)}</select></div>
          <div class="campo"><label for="mFonte2">Fonte dos textos</label><select id="mFonte2" class="input" data-fontes data-marca="fonteTexto">${opcoes(Fomito.config.FONTES_TEXTO, m.fonteTexto)}</select></div>
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
  const exemplo = { nome: "Ana", pedido: 1042, loja: rascunho.marca.nome, total: moeda(69.9), previsao: dados.lanchonete.tempoEntrega, pagamento: "Dinheiro, troco para R$ 100,00", mesa: "Mesa 05", endereco: dados.lanchonete.endereco || "nosso balcão", motivo: "Produto esgotado: X-Burguer" };
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
        <div class="pilha" style="gap:2px"><h3>Mensagens automáticas</h3><p class="pequeno suave">Use {nome}, {pedido}, {loja}, {total}, {previsao}, {pagamento}, {mesa}, {endereco} e {motivo} (no cancelado).</p></div>
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
  const exemplo = pedidoDoTeste();
  return `
    <div class="duas-colunas">
      <div class="pilha" style="gap:16px">
        <div class="card painel-card">
          <div class="pilha" style="gap:2px"><h3>Impressora térmica</h3><p class="pequeno suave">Compatível com impressoras de cupom de 80mm, como a POS-80.</p></div>
          <div class="config-pag"><span>Imprimir o cupom ao aceitar o pedido</span><label class="interruptor"><input type="checkbox" id="iAuto" ${imp.aoAceitar ? "checked" : ""}><span></span></label></div>
          <div class="form-grade">
            <div class="campo"><label for="iLargura">Largura do papel</label><select id="iLargura" class="input"><option ${imp.largura === "80mm" ? "selected" : ""}>80mm</option><option ${imp.largura === "58mm" ? "selected" : ""}>58mm</option></select></div>
            <div class="campo"><label for="iVias">Vias por pedido</label><input id="iVias" class="input" type="number" min="1" max="3" value="${imp.vias}"></div>
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
        <p class="pequeno suave">Toque em qualquer parte sublinhada da notinha para editar: as palavras em roxo (como TOTAL e Pagamento) e os dados do pedido de exemplo em laranja (itens, adicionais, observação, valores, taxa, total, cliente e pagamento). Os dados de exemplo servem só para o teste: não criam pedido, não entram no caixa e não mexem no cardápio.</p>
        <div class="cupom" id="previaCupom">${editorCupom(exemplo, imp)}</div>
        <div class="linha" style="gap:8px;flex-wrap:wrap">
          <button type="button" class="btn btn--contorno btn--sm" data-pteste-add>${icone("mais", "ic--sm")} Adicionar item</button>
          <button type="button" class="btn btn--contorno btn--sm" data-pteste-modo>${icone("entrega", "ic--sm")} <span id="ptesteModoTexto">${lerPedidoTeste().modo === "entrega" ? "Mudar para retirada" : "Mudar para entrega"}</span></button>
        </div>
        <div class="linha" style="gap:16px;flex-wrap:wrap">
          <button type="button" class="link pequeno" data-restaurar-cupom>Voltar ao modelo padrão</button>
          <button type="button" class="link pequeno" data-pteste-reset>Usar o último pedido real</button>
        </div>
      </div>
    </div>`;
}

/* Notinha editável na própria prévia: o topo e o fim são texto livre (uma linha por linha do papel);
   o meio vem do pedido e fica travado. Telefone e endereço do cliente podem ser escondidos. */
const escHtml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
/* Pedaços de uma linha do meio: as palavras (rótulos) são editáveis, os dados do pedido não */
const pedacosEditor = (pedacos, rot) => pedacos.map((x) => (typeof x === "string"
  ? `<span class="cupom__dado">${escHtml(x)}</span>`
  : `<span class="cupom__rotulo" contenteditable="plaintext-only" spellcheck="false" data-rotulo-cupom="${x.r}" title="Toque para trocar esta palavra">${escHtml(rot[x.r])}</span>`)).join("");
const linhaEditor = (x, rot) => (x.col ? `<span>${pedacosEditor(x.col[0], rot)}</span><span>${pedacosEditor(x.col[1], rot)}</span>` : x.p ? pedacosEditor(x.p, rot) : escHtml(x.t));

function editorCupom(pedido, imp) {
  const p = partesCupomTeste(pedido, imp);
  const area = (zona, linhas, dica) => `<textarea class="cupom__zona" data-zona-cupom="${zona}" rows="${Math.max(1, linhas.length)}" spellcheck="false" placeholder="${dica}" aria-label="${zona === "topo" ? "Topo da notinha" : "Fim da notinha"}">${escHtml(linhas.join("\n"))}</textarea>`;
  const ocultas = Object.entries(p.ocultaveis).filter(([k, tem]) => tem && !p.mostrar[k]);
  return `
    <div class="cupom__papel">
      ${area("topo", p.topo, "Toque para escrever o topo (nome, CNPJ, Instagram...)")}
      <div class="cupom__linha">${"-".repeat(42)}</div>
      <div class="cupom__fixo">
        ${p.meio.map((x) => linhaEditorTeste(x, p, pedido)).join("")}
        ${ocultas.map(([k]) => `<button type="button" class="cupom__mostrar" data-mostrar-linha-cupom="${k}">+ mostrar ${k === "telefoneCliente" ? "telefone" : "endereço"} do cliente</button>`).join("")}
      </div>
      <div class="cupom__linha">${"-".repeat(42)}</div>
      ${area("fim", p.fim, "Toque para escrever o fim (agradecimento, promoção...)")}
    </div>`;
}
function atualizarPreviaCupom() {
  const el = $("#previaCupom");
  if (el) el.innerHTML = editorCupom(pedidoDoTeste(), rascunho.impressao);
}
/* Começa a editar: guarda o topo e o fim atuais no rascunho (a partir daí o texto é do dono) */
function garantirModeloEditavel() {
  const imp = rascunho.impressao;
  const p = alertas.partesCupom(pedidoDoTeste(), imp);
  imp.modelo = { ...(imp.modelo || {}), topo: p.topo, fim: p.fim, rotulos: { ...p.rotulos }, mostrar: { ...p.mostrar } };
  return imp.modelo;
}

/* --- Pedido de teste da notinha ---
   Os dados de exemplo (itens, adicionais, observação, valores, taxa, total, cliente e pagamento)
   que aparecem na prévia e saem no "Imprimir cupom de teste". Ficam no rascunho das configurações
   (rascunho.impressao.pedidoTeste) e só são gravados ao clicar em "Salvar alterações".
   Não criam pedido, não entram no caixa, não mudam o cardápio e NUNCA entram na notinha de um
   pedido real: essa sai sempre com os itens e valores do próprio pedido. */
/* Modelo padrão do exemplo (definido pelo Miguel): é para ele que "Voltar ao modelo padrão" volta */
const PEDIDO_TESTE_PADRAO = Object.freeze({
  num: "1001", modo: "entrega",
  cliente: "Cliente de teste", telefone: "(11) 90000-0000", endereco: "Rua Exemplo, 100, Centro",
  pag: "dinheiro", troco: "", taxa: "0,00", total: "",
  itens: [{ qtd: "1", nome: "Cheeseburger", adicionais: "", obs: "", valor: "24,00" }],
});
const pedidoTestePadrao = () => structuredClone(PEDIDO_TESTE_PADRAO);
const numBR = (v) => parseFloat(String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, (m, i, s) => (s.includes(",") ? "" : m)).replace(",", ".")) || 0;
const valorBR = (n) => (Number(n) || 0).toFixed(2).replace(".", ",");

/** Copia um pedido de verdade (ou o exemplo padrão) para o formulário editável */
function pedidoTesteDe(p) {
  const taxa = p.taxa ?? dados.lanchonete.taxaEntrega ?? 0;
  return {
    num: String(p.num ?? 1001), modo: p.modo === "entrega" ? "entrega" : "retirada",
    cliente: p.cliente || "", telefone: p.telefone || "", endereco: p.endereco || "",
    pag: p.pag || "dinheiro", troco: p.troco ? valorBR(p.troco) : "",
    taxa: valorBR(taxa), total: "",
    itens: (p.itens || []).map((it) => {
      const [id, qtd = 1, extras = [], obs = "", preco, nome] = it;
      const prod = Fomito.produto(id);
      const adicionais = Fomito.todosAdicionaisDo(prod).filter((a) => extras.includes(a.id)).map((a) => a.nome).join(", ");
      return { qtd: String(qtd), nome: nome || prod?.nome || "", adicionais, obs, valor: valorBR(preco ?? precoItem(it) / qtd) };
    }),
  };
}
/** O exemplo que está na tela: o salvo (ou o que está sendo editado) ou, se não houver, o padrão */
function lerPedidoTeste() {
  const imp = rascunho.impressao;
  if (!Array.isArray(imp.pedidoTeste?.itens) || !imp.pedidoTeste.itens.length) imp.pedidoTeste = pedidoTestePadrao();
  return imp.pedidoTeste;
}
/** Converte o formulário no formato de pedido que a notinha usa: itens [id, qtd, extras, obs, preço unitário, nome] */
function pedidoDoTeste() {
  const t = lerPedidoTeste();
  /* Os adicionais e a observação digitados entram na notinha por partesCupomTeste (abaixo) */
  const itens = t.itens.map((i) => [null, Math.max(1, Math.round(numBR(i.qtd)) || 1), [], "", numBR(i.valor), String(i.nome || "").trim() || "Item"]);
  const extrasTeste = t.itens.map((i) => ({
    adicionais: String(i.adicionais || "").split(",").map((a) => a.trim()).filter(Boolean),
    obs: String(i.obs || "").trim(),
  }));
  const entrega = t.modo === "entrega";
  const taxa = entrega ? numBR(t.taxa) : 0;
  const soma = itens.reduce((s, i) => s + i[1] * i[4], 0) + taxa;
  return {
    num: String(t.num || "").trim() || "1001", modo: t.modo, criadoEm: Date.now(),
    cliente: String(t.cliente || "").trim() || "-", telefone: String(t.telefone || "").trim(),
    endereco: entrega ? String(t.endereco || "").trim() : "", pag: t.pag,
    troco: t.pag === "dinheiro" ? numBR(t.troco) : 0, taxa, itens,
    total: String(t.total || "").trim() ? numBR(t.total) : soma, somaAutomatica: soma, extrasTeste,
  };
}
/* A notinha monta cada item só com a linha "1x Nome   valor". Aqui, só para o teste, colocamos
   embaixo de cada item os adicionais ("+ Ovo") e a observação ("OBS: ..."), no mesmo formato
   dos pedidos de verdade. Nada fora desta tela é alterado. */
function itensComExtras(pedido, blocoItens, mostrarObs) {
  return blocoItens.split("\n").map((cabeca, n) => {
    const x = pedido.extrasTeste[n] || { adicionais: [], obs: "" };
    return [cabeca, ...x.adicionais.map((a) => `   + ${a}`), ...(x.obs && mostrarObs ? [`   OBS: ${x.obs}`] : [])].join("\n");
  }).join("\n");
}
const ehBlocoItens = (x) => typeof x.t === "string" && /^\d+x /.test(x.t);
/** Partes da notinha para a prévia editável, já com adicionais e observação */
function partesCupomTeste(pedido, imp) {
  const p = alertas.partesCupom(pedido, imp);
  p.meio = p.meio.map((x) => {
    if (!ehBlocoItens(x)) return x;
    const novo = itensComExtras(pedido, x.t, p.mostrar.observacoes);
    return { ...x, t: novo, texto: novo };
  });
  return p;
}
/** Texto da notinha de teste (o mesmo da prévia) */
function textoCupomTeste(pedido, imp) {
  const p = alertas.partesCupom(pedido, imp);
  const bloco = p.meio.find(ehBlocoItens);
  const texto = alertas.textoCupom(pedido, imp);
  return bloco ? texto.replace(bloco.t, () => itensComExtras(pedido, bloco.t, p.mostrar.observacoes)) : texto;
}
/** Manda a notinha de teste para a impressora (mesma área de impressão que o painel já usa) */
function imprimirCupomTeste() {
  const texto = textoCupomTeste(pedidoDoTeste(), rascunho.impressao);
  let area = document.getElementById("areaImpressao");
  if (!area) { area = document.createElement("pre"); area.id = "areaImpressao"; document.body.appendChild(area); }
  area.textContent = texto;
  try { window.print(); } catch { /* alguns ambientes bloqueiam a janela de impressão */ }
}
/* Dados do pedido de exemplo editáveis direto na prévia (em laranja).
   Cada pedaço editável tem data-cupom-dado com o campo: "num", "cliente", "item.0.nome", "item.0.ad.1"... */
const dadoTeste = (campo, valor, dica = "Toque para editar") => `<span class="cupom__valor" contenteditable="plaintext-only" spellcheck="false" data-cupom-dado="${campo}" title="${dica}">${escHtml(valor)}</span>`;
const rotuloTeste = (r, rot) => pedacosEditor([{ r }], rot);
const temRotulo = (x, r) => (x.col ? x.col.flat() : x.p || []).some((q) => q && q.r === r);
const linhaTeste = (html, col = false, extra = "") => `<div class="cupom__fixo-linha ${col ? "cupom__fixo-linha--col" : ""}">${html}${extra}</div>`;
const botaoTeste = (attr, texto) => `<button type="button" class="cupom__mostrar pteste-mais" ${attr}>${texto}</button>`;

/** Uma linha do meio da prévia: troca os dados fixos por pedaços editáveis */
function linhaEditorTeste(x, partes, pedido) {
  const t = lerPedidoTeste();
  const rot = partes.rotulos;
  const ocultar = x.ocultar ? `<button type="button" class="cupom__ocultar" data-ocultar-cupom="${x.ocultar}" aria-label="Esconder esta linha" title="Esconder esta linha">×</button>` : "";
  if (temRotulo(x, "pedido")) return linhaTeste(`<span>${rotuloTeste("pedido", rot)} #${dadoTeste("num", t.num)}</span><span>${pedacosEditor(x.col[1], rot)}</span>`, true);
  for (const [r, campo] of [["cliente", "cliente"], ["tel", "telefone"], ["end", "endereco"]]) {
    if (temRotulo(x, r)) return linhaTeste(`${rotuloTeste(r, rot)}: ${dadoTeste(campo, t[campo])}`, false, ocultar);
  }
  if (ehBlocoItens(x)) {
    return t.itens.map((i, n) => {
      const qtd = Math.max(1, Math.round(numBR(i.qtd)) || 1);
      const adicionais = String(i.adicionais || "").split(",").map((a) => a.trim()).filter(Boolean);
      const remover = t.itens.length > 1 ? `<button type="button" class="cupom__ocultar" data-pteste-remover="${n}" aria-label="Remover este item" title="Remover este item">×</button>` : "";
      return `<div class="pteste-item">`
        + linhaTeste(`<span>${dadoTeste(`item.${n}.qtd`, qtd, "Quantidade")}x ${dadoTeste(`item.${n}.nome`, i.nome || "Item", "Nome do produto")}</span><span class="pteste-valor">${dadoTeste(`item.${n}.valor`, valorBR(numBR(i.valor) * qtd), "Valor do item (quantidade x preço)")}</span>`, true, remover)
        + adicionais.map((a, k) => linhaTeste(`   + ${dadoTeste(`item.${n}.ad.${k}`, a, "Adicional (apague o texto para tirar)")}`)).join("")
        + (i.obs && partes.mostrar.observacoes ? linhaTeste(`   OBS: ${dadoTeste(`item.${n}.obs`, i.obs, "Observação (apague o texto para tirar)")}`) : "")
        + `<div class="pteste-acoes">${botaoTeste(`data-pteste-adicional="${n}"`, "+ adicional")}${i.obs ? "" : botaoTeste(`data-pteste-obs="${n}"`, "+ observação")}</div>`
        + `</div>`;
    }).join("");
  }
  if (temRotulo(x, "taxa")) return linhaTeste(`<span>${rotuloTeste("taxa", rot)}</span><span>${dadoTeste("taxa", pedido.taxa > 0 ? valorBR(pedido.taxa) : "Grátis", "Taxa de entrega (0 ou vazio = Grátis)")}</span>`, true);
  if (temRotulo(x, "total")) {
    const auto = String(t.total || "").trim() ? botaoTeste('data-pteste-total-auto title="Voltar a somar os itens e a taxa"', "↺ somar") : "";
    return linhaTeste(`<span>${rotuloTeste("total", rot)}</span><span>${auto} R$ ${dadoTeste("total", valorBR(pedido.total), "Total (apague para somar sozinho)")}</span>`, true);
  }
  if (temRotulo(x, "pagamento")) {
    const formas = dados.formasPagamento.map((f) => `<option value="${f.id}" ${f.id === t.pag ? "selected" : ""}>${escHtml(f.nome)}</option>`).join("");
    const resto = x.p.slice(2).map((q) => (typeof q === "string" ? escHtml(q) : rotuloTeste(q.r, rot))).join("");
    const troco = t.pag === "dinheiro" && !numBR(t.troco) ? botaoTeste("data-pteste-troco", "+ troco") : "";
    return linhaTeste(`${rotuloTeste("pagamento", rot)}: <select class="cupom__select" data-pteste-pag aria-label="Forma de pagamento">${formas}</select> ${resto}`) + (troco ? `<div class="pteste-acoes">${troco}</div>` : "");
  }
  if (temRotulo(x, "trocoPara")) return linhaTeste(`<span>${rotuloTeste("trocoPara", rot)}</span><span>${dadoTeste("troco", valorBR(numBR(t.troco)), "Troco para (apague para tirar)")}</span>`, true);
  return linhaTeste(linhaEditor(x, rot), !!x.col, ocultar);
}

/** Grava o que foi digitado num pedaço laranja da prévia */
function gravarDadoTeste(campo, texto) {
  const t = lerPedidoTeste();
  const v = texto.replace(/\s+/g, " ").trim();
  const [, n, sub, k] = campo.split(".");
  const item = campo.startsWith("item.") ? t.itens[Number(n)] : null;
  if (campo === "num") { if (/^\d+$/.test(v)) t.num = v; }
  else if (["cliente", "telefone", "endereco"].includes(campo)) { if (v) t[campo] = v; }
  else if (campo === "taxa") t.taxa = !v || /gr[aá]tis/i.test(v) ? "0,00" : valorBR(numBR(v));
  else if (campo === "total") t.total = v ? valorBR(numBR(v)) : "";
  else if (campo === "troco") t.troco = v && numBR(v) ? valorBR(numBR(v)) : "";
  else if (item && sub === "qtd") { const q = Math.round(numBR(v)); if (q >= 1) item.qtd = String(q); }
  else if (item && sub === "nome") { if (v) item.nome = v; }
  else if (item && sub === "valor") item.valor = valorBR(numBR(v) / (Math.max(1, Math.round(numBR(item.qtd)) || 1)));
  else if (item && sub === "obs") item.obs = v;
  else if (item && sub === "ad") {
    const lista = String(item.adicionais || "").split(",").map((a) => a.trim()).filter(Boolean);
    lista[Number(k)] = v.replace(/,/g, " ");
    item.adicionais = lista.filter(Boolean).join(", ");
  }
}
/** Coloca o cursor num pedaço da prévia, com o texto selecionado para digitar por cima */
function focarDadoTeste(campo) {
  const el = $(`[data-cupom-dado="${campo}"]`);
  if (!el) return;
  el.focus();
  const faixa = document.createRange(); faixa.selectNodeContents(el);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(faixa);
}
let ptesteRedesenhoPendente = false;
function redesenharPreviaTeste(focar) {
  ptesteRedesenhoPendente = false;
  atualizarPreviaCupom();
  const txt = $("#ptesteModoTexto");
  if (txt) txt.textContent = lerPedidoTeste().modo === "entrega" ? "Mudar para retirada" : "Mudar para entrega";
  if (focar) focarDadoTeste(focar);
}
/* Enter confirma, Esc desiste; ao sair do pedaço, grava e redesenha a notinha (o total recalcula) */
function ligarDadosTeste(sec) {
  if (sec.dataset.ptesteLigado) return;
  sec.dataset.ptesteLigado = "1";
  sec.addEventListener("keydown", (e) => {
    const el = e.target.closest?.("[data-cupom-dado]");
    if (!el) return;
    if (e.key === "Enter") { e.preventDefault(); el.blur(); }
    if (e.key === "Escape") { el.dataset.desistiu = "1"; el.blur(); }
  });
  /* Se a pessoa saiu do pedaço clicando num botão (ex.: "+ adicional"), espera o clique terminar
     antes de redesenhar, senão o botão some debaixo do mouse e o clique se perde */
  let mouseApertado = false;
  const redesenharSeLivre = () => {
    if (!ptesteRedesenhoPendente || document.activeElement?.closest?.("[data-cupom-dado]")) return;
    redesenharPreviaTeste();
  };
  sec.addEventListener("pointerdown", () => { mouseApertado = true; });
  document.addEventListener("pointerup", () => { if (mouseApertado) { mouseApertado = false; setTimeout(redesenharSeLivre); } });
  sec.addEventListener("focusout", (e) => {
    const el = e.target.closest?.("[data-cupom-dado]");
    if (!el) return;
    if (!el.dataset.desistiu) gravarDadoTeste(el.dataset.cupomDado, el.textContent);
    ptesteRedesenhoPendente = true;
    if (!mouseApertado) setTimeout(redesenharSeLivre);
  });
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
          <div class="campo"><label for="cfgTel">Telefone / WhatsApp</label><input id="cfgTel" class="input" inputmode="tel" data-loja="telefone" value="${esc(l.telefone)}" placeholder="(11) 3333-4444"></div>
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
  ligarDadosTeste(sec);

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
    if (e.target.closest("#iTeste, [data-imprimir-teste]")) { imprimirCupomTeste(); toast("Cupom de teste enviado para a impressora", "impressora"); }
    /* Pedido de teste: adicionar, remover item e voltar ao último pedido real */
    if (e.target.closest("[data-pteste-add]")) {
      const t = lerPedidoTeste();
      t.itens.push({ qtd: "1", nome: "Novo item", adicionais: "", obs: "", valor: "0,00" });
      return redesenharPreviaTeste(`item.${t.itens.length - 1}.nome`);
    }
    if (e.target.closest("[data-pteste-modo]")) {
      const t = lerPedidoTeste();
      t.modo = t.modo === "entrega" ? "retirada" : "entrega";
      return redesenharPreviaTeste();
    }
    const maisAdicional = e.target.closest("[data-pteste-adicional]");
    if (maisAdicional) {
      const item = lerPedidoTeste().itens[Number(maisAdicional.dataset.ptesteAdicional)];
      const lista = String(item.adicionais || "").split(",").map((a) => a.trim()).filter(Boolean);
      item.adicionais = [...lista, "Adicional"].join(", ");
      return redesenharPreviaTeste(`item.${maisAdicional.dataset.ptesteAdicional}.ad.${lista.length}`);
    }
    const maisObs = e.target.closest("[data-pteste-obs]");
    if (maisObs) {
      lerPedidoTeste().itens[Number(maisObs.dataset.ptesteObs)].obs = "Observação";
      return redesenharPreviaTeste(`item.${maisObs.dataset.ptesteObs}.obs`);
    }
    if (e.target.closest("[data-pteste-troco]")) {
      lerPedidoTeste().troco = valorBR(Math.ceil((pedidoDoTeste().total + 1) / 10) * 10);
      return redesenharPreviaTeste("troco");
    }
    if (e.target.closest("[data-pteste-total-auto]")) {
      lerPedidoTeste().total = "";
      return redesenharPreviaTeste();
    }
    const remover = e.target.closest("[data-pteste-remover]");
    if (remover) {
      const t = lerPedidoTeste();
      if (t.itens.length > 1) t.itens.splice(Number(remover.dataset.ptesteRemover), 1);
      return redesenharPreviaTeste();
    }
    if (e.target.closest("[data-pteste-reset]")) {
      const real = ultimoPedidoEntrega();
      if (!real) return toast("Ainda não há pedido de entrega para copiar", "info");
      rascunho.impressao.pedidoTeste = pedidoTesteDe(real);
      redesenharPreviaTeste();
      return toast("Exemplo trocado pelo último pedido de entrega. Salve para gravar.", "info");
    }
    const ocultar = e.target.closest("[data-ocultar-cupom]");
    if (ocultar) { garantirModeloEditavel().mostrar[ocultar.dataset.ocultarCupom] = false; return atualizarPreviaCupom(); }
    const mostrar = e.target.closest("[data-mostrar-linha-cupom]");
    if (mostrar) { garantirModeloEditavel().mostrar[mostrar.dataset.mostrarLinhaCupom] = true; return atualizarPreviaCupom(); }
    if (e.target.closest("[data-restaurar-cupom]")) {
      rascunho.impressao.modelo = { topo: null, fim: null, rotulos: {}, mostrar: { telefoneCliente: true, enderecoCliente: true, observacoes: true } };
      rascunho.impressao.rodape = "Obrigado pela preferência!";
      /* O pedido de exemplo também volta ao padrão: some item, adicional, observação, retirada e valor editado */
      rascunho.impressao.pedidoTeste = pedidoTestePadrao();
      redesenharPreviaTeste();
      return toast("Modelo padrão de volta. Salve para gravar.", "info");
    }
    if (e.target.closest("#sTeste")) alertas.tocarAlerta(rascunho.som.volume);
    if (e.target.closest("#cfgRestaurar")) {
      const r = RESTAURAR[abaConfig];
      if (!r || !(await Fomito.confirmar(`Restaurar ${r.nome}?`, `${r.texto} As outras abas não mudam.`, "Restaurar"))) return;
      r.aplicar(Fomito.config.padrao());
      renderConfiguracoes();
      return toast("Padrão carregado só nesta aba. Salve para aplicar.", "info");
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
    if (t.dataset.rotuloCupom) {
      const texto = t.textContent.replace(/\s+/g, " ").slice(0, 24);
      garantirModeloEditavel().rotulos[t.dataset.rotuloCupom] = texto.trim() ? texto : alertas.ROTULOS[t.dataset.rotuloCupom];
      return;
    }
    if (t.dataset.zonaCupom) {
      const m = garantirModeloEditavel();
      m[t.dataset.zonaCupom] = t.value.split("\n").map((l) => l.slice(0, 42));
      t.rows = Math.max(1, t.value.split("\n").length);
    }
    if (t.id === "iVias") rascunho.impressao.vias = Number(t.value);
    if (t.id === "sVolume") rascunho.som.volume = Number(t.value);
  };

  sec.onchange = (e) => {
    const t = e.target;
    if (t.dataset.marca) { rascunho.marca[t.dataset.marca] = t.value; atualizarPrevia(); }
    if (t.dataset.modeloAtivo) rascunho.whatsapp.modelos[t.dataset.modeloAtivo].ativo = t.checked;
    if (t.id === "iAuto") rascunho.impressao.aoAceitar = t.checked;
    if (t.dataset.ptestePag != null) { lerPedidoTeste().pag = t.value; redesenharPreviaTeste(); }
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
  const marca = Fomito.config.ler().marca;
  /* Barra do celular: símbolo e nome do restaurante, com a página atual embaixo */
  $("#barraSimbolo").innerHTML = Fomito.config.simbolo(marca);
  $("#barraNome").textContent = marca.nome;
}

/* No celular, o sino e o avatar vão para a barra do topo (no computador ficam no cabeçalho) */
const telaEstreita = window.matchMedia("(max-width: 1024px)");
function posicionarAcoesTopo() {
  const destino = telaEstreita.matches ? $("#barraAcoes") : $(".topo .linha");
  [$("#btnSom"), $("#avatar")].forEach((el) => el && el.parentElement !== destino && destino.appendChild(el));
}
telaEstreita.addEventListener("change", posicionarAcoesTopo);
posicionarAcoesTopo();
Fomito.config.carregarFonte?.("Nunito");

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
  convenios: renderConvenios,
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

/* Palavra da notinha: Enter só termina a edição (a palavra fica numa linha) */
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.dataset?.rotuloCupom) { e.preventDefault(); e.target.blur(); }
});
