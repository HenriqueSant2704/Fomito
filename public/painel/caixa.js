/* ==========================================================================
   FOMITO · PAINEL › CAIXA
   --------------------------------------------------------------------------
   Carregado antes do painel.js. Usa compartilhado/js/caixa.js.
     1. Tela do caixa (aberto ou fechado)
     2. Janelas: abrir caixa, tirar / colocar dinheiro, corrigir, fechar caixa
     3. Cliques

   De onde vêm as entradas:
     • conta da mesa fechada pelo garçom (com recebido e troco)
     • entrega finalizada pelo motoboy (com recebido e troco)

   Correções: se o garçom ou o motoboy lançou errado (ex.: cartão, mas foi
   Pix), o responsável corrige aqui. Fica registrado quem lançou, quem
   corrigiu, quando, o motivo e o antes/depois. Nada é apagado.
   ========================================================================== */

let filtroCaixa = "todas";
let diaCaixa = null; // fechamento anterior aberto na página do dia: { id, dados, erro }
let filtroDia = "todos";
const formatoDinheiro = (texto) => parseFloat(String(texto).replace(/\./g, "").replace(",", ".")) || 0;
const horaCaixa = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dataCaixa = (ts) => new Date(ts).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
/* Caixa que juntou mais de um dia (ajuste 61): "2 dias juntos" */
const tagDiasJuntos = (cx) => (cx?.dias?.length > 1 ? `<span class="tag tag--roxo" title="Caixa de um dia anterior juntado com o seguinte e fechado de uma vez">${cx.dias.length} dias juntos</span>` : "");
const diasDoCaixa = (cx) => (cx?.dias || []).map((d) => { const [, m, dd] = d.split("-"); return `${dd}/${m}`; }).join(" e ");

/* Etiqueta da diferença entre o contado e o esperado */
function tagDiferenca(contado, esperado) {
  const d = Math.round((contado - esperado) * 100) / 100;
  if (Math.abs(d) < 0.005) return `<span class="tag tag--verde">Bateu</span>`;
  return d < 0 ? `<span class="tag tag--vermelho">Faltou ${moeda(-d)}</span>` : `<span class="tag tag--amarelo">Sobrou ${moeda(d)}</span>`;
}

/* O que mudou numa correção, em frases curtas: "Forma: Crédito → Pix" */
function mudancas(c) {
  const curtas = { dinheiro: "Dinheiro", pix: "Pix", credito: "Crédito", debito: "Débito" };
  const valor = (v) => (v == null ? "-" : moeda(v));
  const linhas = [];
  if (c.antes.forma !== c.depois.forma) linhas.push(`Forma: <s>${curtas[c.antes.forma] || "-"}</s> → <b>${curtas[c.depois.forma] || "-"}</b>`);
  if (c.antes.valor !== c.depois.valor) linhas.push(`Valor: <s>${valor(c.antes.valor)}</s> → <b>${valor(c.depois.valor)}</b>`);
  if (c.antes.recebido !== c.depois.recebido) linhas.push(`Cliente deu: <s>${valor(c.antes.recebido)}</s> → <b>${valor(c.depois.recebido)}</b>`);
  if (c.antes.troco !== c.depois.troco) linhas.push(`Troco: <s>${valor(c.antes.troco)}</s> → <b>${valor(c.depois.troco)}</b>`);
  if (c.antes.ref !== c.depois.ref) linhas.push(`Descrição: <s>${c.antes.ref}</s> → <b>${c.depois.ref}</b>`);
  return linhas;
}
const resumoCorrecao = (c) => `Corrigido por ${c.por} às ${horaCaixa(c.em)}: ${mudancas(c).join(" · ").replace(/<[^>]+>/g, "")}`;

/* ---------- 1. TELA DO CAIXA ---------- */
function renderCaixa() {
  const { aberto, fechamentos } = Fomito.caixa.estado();
  /* Um dia anterior aberto: a página dele no lugar do caixa de hoje (o caixa de hoje continua igual) */
  if (diaCaixa) { $('[data-secao="caixa"].secao').innerHTML = paginaDia(); return; }
  $('[data-secao="caixa"].secao').innerHTML = `
    ${aberto ? caixaAberto(aberto) : caixaFechado(fechamentos[0])}
    <div class="card painel-card">
      <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>Fechamentos anteriores</h3><span class="pequeno suave">Total de vendas soma todas as formas. Na conferência entram o dinheiro da gaveta e a maquininha do caixa; o Pix fica só de registro. Toque num dia para ver tudo dele.</span></div></div>
      <div class="tabela-rolagem">
        <table class="tabela tabela--fechamentos">
          <thead><tr><th>Dia</th><th class="dir">Total de vendas<br><span class="fraco">todas as formas</span></th><th>Dinheiro na gaveta</th><th>Maquininha do caixa</th><th class="dir">Pix<br><span class="fraco">só registro</span></th><th>Fechado por</th><th></th></tr></thead>
          <tbody>
            ${fechamentos.map((f) => `
              <tr class="linha-clicavel fechamento-linha" data-ver-dia="${f.id}" title="Ver tudo deste dia">
                <td><span class="forte" style="text-transform:capitalize">${dataCaixa(f.abertoEm)}</span>${f.dias?.length > 1 ? `<br>${tagDiasJuntos(f)}` : ""}<br><span class="num pequeno suave">${horaCaixa(f.abertoEm)} – ${horaCaixa(f.fechadoEm)}</span></td>
                <td class="dir num forte">${moeda(f.vendas)}</td>
                <td>${linhaConferida(f.esperado, f.contado, "na gaveta")}</td>
                <td>${f.cartao ? linhaConferida(f.cartao.esperado.credito + f.cartao.esperado.debito, f.cartao.contado.credito + f.cartao.contado.debito, "no extrato") : `<span class="pequeno fraco">Não conferida</span>`}</td>
                <td class="dir num suave">${moeda(f.pix ?? f.porForma?.pix ?? 0)}</td>
                <td class="suave">${f.fechadoPor || f.por}${f.correcoes ? `<br><span class="tag tag--amarelo">${f.correcoes} ${f.correcoes > 1 ? "correções" : "correção"}</span>` : ""}${f.obs ? `<div class="pequeno fraco">“${escDia(f.obs)}”</div>` : ""}</td>
                <td class="dir"><span class="ver-dia">Ver o dia ${icone("seta", "ic--sm")}</span></td>
              </tr>`).join("") || `<tr><td colspan="7" class="suave" style="text-align:center;padding:24px">Nenhum fechamento ainda.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* "Deveria ter R$ 220,65 · Contado R$ 220,65 [Bateu]" numa célula */
function linhaConferida(esperado, contado, onde) {
  return `<div class="conferida"><span class="pequeno"><span class="fraco">Deveria ter</span> <b class="num">${moeda(esperado)}</b></span><span class="pequeno"><span class="fraco">Contado ${onde}</span> <b class="num">${moeda(contado)}</b></span>${tagDiferenca(contado, esperado)}</div>`;
}

/* Iniciais para o círculo do nome: "João Pereira" → "JP" */
const iniciaisCaixa = (nome) => String(nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const escAttr = (t) => String(t).replace(/"/g, "&quot;");
const ICONE_FORMA = { dinheiro: "dinheiro", pix: "pix", credito: "cartao", debito: "cartao", convenio: "conta" };
const CURTAS = { dinheiro: "Dinheiro", pix: "Pix", credito: "Crédito", debito: "Débito", convenio: "Convênio" };

/* ---------- Bolsas: motoboys e garçons ----------
   Cada um com o seu dinheiro (troco + o que recebeu) e a sua maquininha, separados da gaveta.
   O garçom só tem bolsa se a loja quiser: sem bolsa, as mesas dele entram no caixa. */
const TIPO_BOLSA = {
  motoboy: { titulo: "Bolsas dos motoboys", perfil: "motoboy", icone: "entrega", texto: "O troco, o dinheiro e a maquininha das entregas ficam com cada motoboy, separados da gaveta.", unidade: ["entrega", "entregas"] },
  garcom: { titulo: "Bolsas dos garçons", perfil: "garcom", icone: "mesa", texto: "Garçom com pochete e maquininha própria: as mesas que ele fecha ficam na bolsa dele. Sem bolsa, entram no caixa.", unidade: ["mesa", "mesas"] },
};
const doTipo = (r, tipo) => (tipo === "garcom" ? r.bolsasGarcons : r.bolsas) || {};
const chaveBolsa = (tipo, nome) => escAttr(`${tipo}|${nome}`);

function cartaoBolsa(tipo, nome, b) {
  const t = TIPO_BOLSA[tipo];
  const chave = chaveBolsa(tipo, nome);
  if (!b) return `
    <div class="bolsa-card bolsa-card--vazia">
      <div class="bolsa-card__topo"><span class="avatar-mini">${iniciaisCaixa(nome)}</span><div class="pilha" style="gap:0;flex:1;min-width:0"><span class="forte">${nome}</span><span class="pequeno fraco">${tipo === "garcom" ? "Sem bolsa: as mesas dele entram no caixa" : "Sem bolsa hoje"}</span></div></div>
      <button class="btn btn--contorno btn--sm btn--bloco" data-troco-bolsa="${chave}">${icone("mais", "ic--sm")} ${tipo === "garcom" ? "Dar bolsa própria" : "Abrir bolsa com troco"}</button>
    </div>`;
  const f = b.fechamento;
  const cartoes = b.credito + b.debito;
  const status = !b.pendente && f
    ? (Math.abs(f.contado - f.esperado) < 0.005 && (!f.cartao || Math.abs(f.cartao.contado.credito + f.cartao.contado.debito - f.cartao.esperado.credito - f.cartao.esperado.debito) < 0.005)
      ? `<span class="tag tag--verde">Conferida</span>` : `<span class="tag tag--amarelo">Conferida com diferença</span>`)
    : f ? `<span class="tag tag--laranja">Recebeu depois</span>` : `<span class="tag tag--cinza">A conferir</span>`;
  return `
    <div class="bolsa-card ${b.pendente ? "bolsa-card--pendente" : ""}">
      <div class="bolsa-card__topo">
        <span class="avatar-mini">${iniciaisCaixa(nome)}</span>
        <div class="pilha" style="gap:0;flex:1;min-width:0"><span class="forte">${nome}</span><span class="pequeno fraco">${b.qtd} ${t.unidade[b.qtd === 1 ? 0 : 1]}</span></div>
        ${status}
      </div>
      <div class="bolsa-card__duas">
        <div class="bolsa-mini"><span class="bolsa-mini__rotulo">${icone("dinheiro", "ic--sm")} Dinheiro</span><strong class="num">${moeda(b.esperado)}</strong><span class="pequeno fraco">troco ${moeda(b.fundo)}<br>recebido ${moeda(b.dinheiro)}</span></div>
        <div class="bolsa-mini"><span class="bolsa-mini__rotulo">${icone("cartao", "ic--sm")} Maquininha</span><strong class="num">${moeda(cartoes)}</strong><span class="pequeno fraco">crédito ${moeda(b.credito)}<br>débito ${moeda(b.debito)}</span></div>
      </div>
      ${b.pix ? `<span class="pequeno fraco">${icone("pix", "ic--sm")} Pix ${moeda(b.pix)}: caiu direto na conta</span>` : ""}
      ${f ? `<span class="pequeno fraco">Conferida por ${f.por} às ${horaCaixa(f.em)}: dinheiro ${moeda(f.contado)}${f.cartao ? ` · maquininha ${moeda(f.cartao.contado.credito + f.cartao.contado.debito)}` : ""}${f.ficaParaAmanha ? ` · ficou ${moeda(f.ficaParaAmanha)} de troco` : ""}${f.obs ? ` · “${f.obs}”` : ""}</span>` : ""}
      ${b.pendente ? `<div class="linha" style="gap:8px">${!f ? `<button class="btn btn--contorno btn--sm" data-troco-bolsa="${chave}">Ajustar troco</button>` : ""}<button class="btn btn--primario btn--sm" style="flex:1" data-conferir-bolsa="${chave}">${icone("check", "ic--sm")} Conferir bolsa</button></div>` : ""}
    </div>`;
}

function blocoBolsas(r, cx, tipo = "motoboy") {
  const t = TIPO_BOLSA[tipo];
  const daEquipe = Fomito.sessao.usuarios().filter((u) => u.perfil === t.perfil).map((u) => u.nome);
  const bolsas = doTipo(r, tipo);
  const nomes = [...new Set([...daEquipe, ...Object.keys(bolsas)])];
  if (!nomes.length) return "";
  const pendentes = nomes.filter((n) => bolsas[n]?.pendente).length;
  return `
    <div class="card painel-card">
      <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>${t.titulo}</h3><span class="pequeno suave">${t.texto}</span></div>${pendentes ? `<span class="tag tag--cinza">${pendentes} a conferir</span>` : ""}</div>
      <div class="bolsas">${nomes.map((n) => cartaoBolsa(tipo, n, bolsas[n])).join("")}</div>
    </div>`;
}

async function janelaTrocoBolsa(tipo, nome) {
  const atual = doTipo(Fomito.caixa.resumo(Fomito.caixa.aberto()), tipo)[nome];
  const garcom = tipo === "garcom";
  const r = await Fomito.dialogo({
    titulo: garcom && !atual ? `Bolsa própria para ${nome}` : `Troco do ${nome}`,
    texto: garcom
      ? "O garçom anda com pochete e maquininha próprias. Dagora em diante, as mesas que ele fechar ficam na bolsa dele (não na gaveta) e ele confere no fim do dia, como o motoboy."
      : "Quanto em dinheiro o motoboy leva na bolsa para dar troco. Sai separado da gaveta do balcão.",
    campos: [{ id: "fundo", rotulo: "Troco na bolsa (R$)", tipo: "moeda", valor: String(atual?.fundo || 0).replace(".", ","), obrigatorio: true }],
    confirmar: garcom && !atual ? "Abrir bolsa" : "Salvar troco",
  });
  if (!r) return;
  await Fomito.acao("POST", `/caixa/${tipo}`, { nome, fundo: formatoDinheiro(r.fundo) });
  renderCaixa();
  toast(`Bolsa do ${nome}: ${moeda(formatoDinheiro(r.fundo))} de troco`, "dinheiro");
}

/* Diferença entre o contado e o esperado, na hora em que digita */
function blocoDiferenca(contado, esperado, vazio) {
  if (contado == null) return `<div class="troco-painel">${icone("info", "ic--sm")} ${vazio}</div>`;
  const d = Math.round((contado - esperado) * 100) / 100;
  return Math.abs(d) < 0.005
    ? `<div class="diferenca diferenca--ok"><span>Bateu certinho</span><strong>${moeda(0)}</strong></div>`
    : `<div class="diferenca ${d < 0 ? "diferenca--falta" : "diferenca--sobra"}"><span>${d < 0 ? "Está faltando" : "Está sobrando"}</span><strong>${moeda(Math.abs(d))}</strong></div>`;
}
const valorCampo = (el) => (el && el.value.trim() !== "" ? formatoDinheiro(el.value) : null);

/* Bloco "Maquininha": crédito e débito do extrato, comparados com o que o sistema registrou */
const blocoMaquininha = (esp, prefixo, titulo) => `
  <div class="conferir-bloco">
    <div class="entre"><span class="conferir-bloco__titulo">${icone("cartao", "ic--sm")} ${titulo}</span><span class="pequeno suave">deveria ter ${moeda(esp.credito + esp.debito)}</span></div>
    <div class="duas-entradas">
      <div class="campo"><label for="${prefixo}Credito">Crédito no extrato <span class="fraco">(deveria ${moeda(esp.credito)})</span></label><div class="campo-moeda"><span>R$</span><input id="${prefixo}Credito" class="input" inputmode="decimal" placeholder="0,00"></div></div>
      <div class="campo"><label for="${prefixo}Debito">Débito no extrato <span class="fraco">(deveria ${moeda(esp.debito)})</span></label><div class="campo-moeda"><span>R$</span><input id="${prefixo}Debito" class="input" inputmode="decimal" placeholder="0,00"></div></div>
    </div>
    <div id="${prefixo}DifCartao"></div>
  </div>`;
function diferencaMaquininha(c, esp, prefixo) {
  const cr = valorCampo($(`#${prefixo}Credito`, c)), db = valorCampo($(`#${prefixo}Debito`, c));
  if (cr == null && db == null) return blocoDiferenca(null, 0, "Tire o extrato da maquininha e digite o crédito e o débito.");
  return blocoDiferenca((cr || 0) + (db || 0), esp.credito + esp.debito);
}

/* Conferência da bolsa: o dinheiro e a maquininha, com a diferença na hora */
function janelaConferirBolsa(tipo, nome) {
  const cx = Fomito.caixa.aberto();
  const b = doTipo(Fomito.caixa.resumo(cx), tipo)[nome];
  if (!b) return;
  const meus = cx.movimentos.filter((m) => { const d = Fomito.contasCaixa.destino(cx, m); return d && d.tipo === tipo && d.nome === nome; });
  const emDinheiro = meus.filter((m) => m.forma === "dinheiro");
  const temCartao = b.credito + b.debito > 0;
  const esp = { credito: b.credito, debito: b.debito };
  janelaCaixa(`Conferir a bolsa do ${nome}`, `
    <div class="conferir-bloco">
      <div class="entre"><span class="conferir-bloco__titulo">${icone("dinheiro", "ic--sm")} Dinheiro na bolsa</span></div>
      <div class="conferencia">
        <div class="entre"><span>Troco inicial</span><span class="num">${moeda(b.fundo)}</span></div>
        <div class="entre"><span>+ Notas que os clientes deram</span><span class="num">${moeda(b.recebido)}</span></div>
        <div class="entre"><span>− Troco devolvido</span><span class="num valor-saida">${moeda(b.troco)}</span></div>
        <div class="entre conferencia__total"><span>Deveria ter na bolsa</span><span class="num">${moeda(b.esperado)}</span></div>
      </div>
      ${emDinheiro.length ? `<details class="lista-det"><summary class="pequeno">${emDinheiro.length > 1 ? `Ver os ${emDinheiro.length} recebimentos em dinheiro` : "Ver o recebimento em dinheiro"}</summary><div class="lista-bolsa lista-rolagem">${emDinheiro.map((m) => `
        <div class="entre pequeno"><span><b>${m.ref.split(" · ")[0]}</b> <span class="fraco">${horaCaixa(m.hora)}</span><br><span class="fraco">deu ${moeda(m.recebido ?? m.valor)} · troco ${moeda(m.troco || 0)}</span></span><span class="num forte">${moeda(m.valor)}</span></div>`).join("")}</div></details>` : ""}
      <div class="duas-entradas">
        <div class="campo"><label for="contadoBolsa">Contado na bolsa <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="contadoBolsa" class="input" inputmode="decimal" placeholder="0,00"></div></div>
        <div class="campo"><label for="ficaBolsa">Fica de troco para amanhã</label><div class="campo-moeda"><span>R$</span><input id="ficaBolsa" class="input" inputmode="decimal" value="0,00"></div></div>
      </div>
      <div id="resultadoBolsa" class="pilha" style="gap:8px">${blocoDiferenca(null, 0, "Conte o dinheiro da bolsa e digite o valor.")}</div>
    </div>
    ${temCartao ? blocoMaquininha(esp, "bolsa", `Maquininha do ${nome.split(" ")[0]}`) : `<p class="pequeno fraco">${icone("cartao", "ic--sm")} Nenhum cartão na maquininha dele hoje.</p>`}
    ${b.pix ? `<p class="pequeno fraco">${icone("pix", "ic--sm")} Pix ${moeda(b.pix)}: caiu direto na conta (só registro).</p>` : ""}
    <div class="campo"><label for="obsBolsa">Observação <span class="fraco">(obrigatória se algo não bater)</span></label><input id="obsBolsa" class="input" maxlength="300" placeholder="Ex.: troco errado no pedido #1004"></div>
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("check", "ic--sm")} Conferir bolsa</button>`,
  async (c) => {
    const erro = (t) => { $("#erroCaixa", c).textContent = t; $("#erroCaixa", c).hidden = false; return false; };
    const contado = valorCampo($("#contadoBolsa", c));
    if (contado == null) return erro("Informe quanto dinheiro tem na bolsa.");
    const credito = temCartao ? valorCampo($("#bolsaCredito", c)) : 0;
    const debito = temCartao ? valorCampo($("#bolsaDebito", c)) : 0;
    if (temCartao && (credito == null || debito == null)) return erro("Digite o crédito e o débito do extrato da maquininha (pode ser 0,00).");
    const obs = $("#obsBolsa", c).value.trim();
    const bateu = Math.abs(contado - b.esperado) < 0.005 && Math.abs(credito - b.credito) < 0.005 && Math.abs(debito - b.debito) < 0.005;
    if (!bateu && !obs) return erro("Algo não bateu: escreva uma observação.");
    try { await Fomito.acao("POST", `/caixa/${tipo}/fechar`, { nome, contado, credito, debito, fica: formatoDinheiro($("#ficaBolsa", c).value), obs }); }
    catch (err) { return erro(err.message); }
    toast(bateu ? `Bolsa do ${nome} bateu` : `Bolsa do ${nome} conferida com diferença`, "check");
  },
  (c) => {
    $("#resultadoBolsa", c).innerHTML = blocoDiferenca(valorCampo($("#contadoBolsa", c)), b.esperado, "Conte o dinheiro da bolsa e digite o valor.");
    if (temCartao) $("#bolsaDifCartao", c).innerHTML = diferencaMaquininha(c, esp, "bolsa");
  });
}

/* ---------- Movimentações agrupadas ----------
   Os pagamentos da mesma comanda (conta dividida) ou do mesmo pedido viram um só cartão,
   que abre para mostrar cada pagamento. Tirar e colocar dinheiro ficam sozinhos. */
const TIPOS_MOV = {
  comanda: { nome: "Mesa", icone: "mesa", cor: "roxo" },
  entrega: { nome: "Entrega", icone: "entrega", cor: "laranja" },
  balcao: { nome: "Balcão", icone: "loja", cor: "azul" },
  sangria: { nome: "Tirado da gaveta", icone: "menos", cor: "vermelho" },
  suprimento: { nome: "Colocado na gaveta", icone: "mais", cor: "verde" },
  convenio: { nome: "Convênio recebido", icone: "conta", cor: "verde" },
};
let filtroForma = "todas";
const abertosCaixa = new Set(); // cartões de movimentação abertos (continuam abertos ao atualizar a tela)

function gruposMovimentos(movimentos, cx = Fomito.caixa.aberto() || { garcons: {} }) {
  const grupos = [];
  const porChave = {};
  movimentos.forEach((m) => {
    const numComanda = m.tipo === "comanda" ? (m.comanda || Number(/comanda #(\d+)/.exec(m.ref || "")?.[1]) || null) : null;
    const chave = numComanda ? `c${numComanda}` : m.tipo === "entrega" && m.pedido ? `e${m.pedido}` : m.id;
    let g = porChave[chave];
    if (!g) { g = porChave[chave] = { chave, tipo: m.tipo, comanda: numComanda, movs: [], hora: m.hora }; grupos.push(g); }
    g.movs.push(m);
    g.hora = Math.max(g.hora, m.hora);
  });
  grupos.forEach((g) => {
    g.total = g.movs.reduce((s, m) => s + m.valor, 0);
    g.corrigido = g.movs.some((m) => m.correcoes?.length);
    g.formas = [...new Set(g.movs.map((m) => m.forma))];
    /* O que esse cartão mudou na gaveta do balcão */
    g.gaveta = g.movs.reduce((s, m) => s + (m.tipo === "sangria" ? -m.valor : m.tipo === "suprimento" ? m.valor : m.forma === "dinheiro" && !Fomito.contasCaixa.destino(cx, m) ? m.valor : 0), 0);
    g.bolsa = Fomito.contasCaixa.destino(cx, g.movs[0]); // entrega → motoboy; mesa de garçom com bolsa → garçom
  });
  return grupos.sort((a, b) => b.hora - a.hora);
}

/* Resumo das correções de um cartão: "Divisão refeita: 3 → 4 pessoas" ou "Corrigido por…" */
function avisoCorrecao(g) {
  const lotes = {};
  g.movs.forEach((m) => (m.correcoes || []).forEach((c) => { (lotes[`${c.em}|${c.motivo}`] ||= { ...c, qtd: 0, novos: 0 }).qtd++; if (c.antes.forma == null && c.antes.valor == null) lotes[`${c.em}|${c.motivo}`].novos++; }));
  const lista = Object.values(lotes).sort((a, b) => a.em - b.em);
  if (!lista.length) return "";
  return lista.map((l) => {
    const redivisao = g.tipo === "comanda" && (l.qtd > 1 || l.novos);
    return `<div class="mov__aviso">${icone("editar", "ic--sm")}<span><b>${redivisao ? `Divisão refeita${l.novos ? ` (+${l.novos} pessoa${l.novos > 1 ? "s" : ""})` : ""}` : "Pagamento corrigido"}</b> por ${l.por} às ${horaCaixa(l.em)}<br><span class="fraco">“${l.motivo}”</span></span></div>`;
  }).join("");
}

function efeitoGrupo(g) {
  const m = g.movs[0];
  if (g.tipo === "sangria") return `<span class="valor-saida">− ${moeda(g.total)} da gaveta</span>`;
  if (g.tipo === "suprimento") return `<span class="valor-entrada">+ ${moeda(g.total)} na gaveta</span>`;
  if (g.formas.every((f) => f === "convenio")) return "no convênio do cliente";
  if (g.bolsa && g.formas.some((f) => f !== "pix")) return `na bolsa do ${String(g.bolsa.nome).split(" ")[0]}`;
  if (g.gaveta) return `<span class="valor-entrada">+ ${moeda(g.gaveta)} na gaveta</span>`;
  return "cai na conta";
}

function cartaoMovimento(g, leitura = false) {
  const t = TIPOS_MOV[g.tipo] || TIPOS_MOV.balcao;
  const m0 = g.movs[0];
  const gaveta = g.tipo === "sangria" || g.tipo === "suprimento";
  const [titulo, detalhe] = gaveta ? [t.nome, m0.ref] : String(m0.ref).split(" · ");
  const divisao = g.tipo === "comanda" ? Math.max(g.movs[0].divisao || 1, g.movs.length) : 0;
  const aberto = abertosCaixa.has(g.chave);
  const sub = [horaCaixa(g.hora), m0.por, g.movs.length > 1 ? `${g.movs.length} pagamentos` : (gaveta ? "" : CURTAS[m0.forma]), divisao > 1 ? `dividida em ${divisao}` : ""].filter(Boolean).join(" · ");
  return `
    <details class="mov mov--${t.cor}" data-mov="${g.chave}" ${aberto ? "open" : ""}>
      <summary>
        <span class="mov__icone">${icone(t.icone, "ic--sm")}</span>
        <span class="mov__texto">
          <span class="mov__titulo">${titulo}${detalhe ? ` <span class="mov__detalhe">${detalhe}</span>` : ""}${g.corrigido ? ` <span class="tag tag--amarelo">Corrigido</span>` : ""}</span>
          <span class="mov__sub">${sub}</span>
        </span>
        <span class="mov__valor"><strong class="${g.tipo === "sangria" ? "valor-saida" : ""}">${g.tipo === "sangria" ? "− " : ""}${moeda(g.total)}</strong><span>${efeitoGrupo(g)}</span></span>
        <span class="mov__seta">${icone("baixo", "ic--sm")}</span>
      </summary>
      <div class="mov__corpo">
        ${avisoCorrecao(g)}
        ${g.movs.map((m, i) => `
          <div class="mov-pag">
            <span class="mov-pag__forma">${icone(gaveta ? "dinheiro" : ICONE_FORMA[m.forma], "ic--sm")}</span>
            <span class="mov-pag__texto">
              <span class="forte">${g.movs.length > 1 ? `${g.tipo === "comanda" ? "Pessoa" : "Pagamento"} ${i + 1} · ` : ""}${gaveta ? "Dinheiro" : Fomito.caixa.FORMAS_TODAS[m.forma]}${m.forma === "convenio" && m.cliente ? ` · ${m.cliente}` : ""}</span>
              <span class="pequeno fraco">${m.forma === "dinheiro" && !gaveta ? `Deu ${moeda(m.recebido ?? m.valor)} · troco ${moeda(m.troco || 0)} · ` : ""}${horaCaixa(m.hora)} · ${m.por}</span>
              ${m.correcoes?.length && !leitura ? `<button class="mov-pag__corr" data-historico="${m.id}">${icone("editar", "ic--sm")} Ver a correção</button>` : ""}
            </span>
            <span class="num forte">${moeda(m.valor)}</span>
            ${leitura ? "" : m.forma === "convenio" || m.tipo === "convenio" ? `<span style="width:32px"></span>` : `<button class="btn-icone btn-icone--sm" data-corrigir="${m.id}" aria-label="Corrigir este pagamento" title="Corrigir">${icone("editar", "ic--sm")}</button>`}
          </div>`).join("")}
        ${leitura ? acoesMovimentoDia(g) : g.tipo === "comanda" && g.comanda ? `
          <div class="mov__acoes">
            <button class="btn btn--contorno btn--sm" data-redividir="${g.comanda}">${icone("equipe", "ic--sm")} Refazer a divisão</button>
            ${Fomito.comandas.fechadas().some((f) => f.numero === g.comanda) ? `<button class="btn btn--contorno btn--sm" data-ver-comanda="${g.comanda}">${icone("conta", "ic--sm")} Ver a comanda</button>` : ""}
          </div>` : ""}
      </div>
    </details>`;
}

/* Registro de correções em cartões: quem corrigiu, o que mudou (antes → depois) e o motivo.
   As correções feitas juntas (ex.: refazer a divisão) aparecem num cartão só. */
function blocoCorrecoes(correcoes) {
  if (!correcoes.length) return "";
  const lotes = [];
  correcoes.forEach((c) => {
    const alvo = c.movimento.comanda ? `c${c.movimento.comanda}` : c.movimento.id;
    const chave = `${c.em}|${c.motivo}|${alvo}`;
    let l = lotes.find((x) => x.chave === chave);
    if (!l) { l = { chave, em: c.em, por: c.por, motivo: c.motivo, itens: [] }; lotes.push(l); }
    l.itens.push(c);
  });
  const linhaMudanca = (c) => {
    const novo = c.antes.forma == null && c.antes.valor == null;
    if (novo) return `<div class="corr-mud"><span class="tag tag--verde">Novo</span> ${CURTAS[c.depois.forma] || "-"} <b>${moeda(c.depois.valor)}</b></div>`;
    return `<div class="corr-mud"><span class="corr-mud__forma">${CURTAS[c.depois.forma] || "-"}</span> ${mudancas(c).join(`<span class="fraco"> · </span>`)}</div>`;
  };
  return `
    <div class="card painel-card">
      <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>Registro de correções</h3><span class="pequeno suave">Quem corrigiu, o que mudou e por quê. Não pode ser apagado.</span></div><span class="tag tag--amarelo">${lotes.length} ${lotes.length > 1 ? "correções" : "correção"}</span></div>
      <div class="corr-lista">
        ${lotes.map((l) => {
          const m = l.itens[0].movimento;
          const redivisao = l.itens.length > 1 || l.itens.some((c) => c.antes.forma == null && c.antes.valor == null);
          const alvo = String(m.ref).replace(" · ", " · ");
          return `
            <div class="corr">
              <span class="avatar-mini">${iniciaisCaixa(l.por)}</span>
              <div class="corr__corpo">
                <div class="entre" style="align-items:flex-start;gap:8px"><span><b>${l.por}</b> ${redivisao ? "refez a divisão de" : "corrigiu"} <b>${alvo}</b></span><span class="pequeno fraco num" style="white-space:nowrap">${horaCaixa(l.em)}</span></div>
                <div class="corr__motivo">“${l.motivo}”</div>
                <div class="corr__mudancas">${l.itens.map(linhaMudanca).join("")}</div>
                <span class="pequeno fraco">Lançado por ${m.por} às ${horaCaixa(m.hora)}</span>
              </div>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function caixaAberto(cx) {
  const r = Fomito.caixa.resumo(cx);
  const turno = Fomito.turno.situacao();
  const nomes = { ...Fomito.caixa.FORMAS_TODAS };
  const cartoes = r.porForma.credito + r.porForma.debito;
  const correcoes = Fomito.caixa.correcoes(cx);
  const grupos = gruposMovimentos(cx.movimentos);
  const doTipo = {
    todas: () => true,
    comanda: (g) => g.tipo === "comanda",
    entrega: (g) => g.tipo === "entrega",
    balcao: (g) => g.tipo === "balcao",
    gaveta: (g) => g.tipo === "sangria" || g.tipo === "suprimento",
    corrigidos: (g) => g.corrigido,
  };
  const daForma = {
    todas: () => true,
    dinheiro: (g) => g.formas.includes("dinheiro") || g.tipo === "sangria" || g.tipo === "suprimento",
    pix: (g) => g.formas.includes("pix") && g.tipo !== "sangria" && g.tipo !== "suprimento",
    cartao: (g) => (g.formas.includes("credito") || g.formas.includes("debito")) && g.tipo !== "sangria" && g.tipo !== "suprimento",
  };
  if (!doTipo[filtroCaixa]) filtroCaixa = "todas";
  const lista = grupos.filter((g) => doTipo[filtroCaixa](g) && daForma[filtroForma](g));
  const conta = (f) => grupos.filter(doTipo[f]).length;
  const filtrosTipo = [["todas", "Tudo"], ["comanda", "Mesas"], ["entrega", "Entregas"], ["balcao", "Balcão"], ["gaveta", "Tirado e colocado"], ["corrigidos", "Corrigidos"]].filter(([id]) => id === "todas" || conta(id));
  const filtrosForma = [["todas", "Todas as formas"], ["dinheiro", "Dinheiro"], ["pix", "Pix"], ["cartao", "Cartões"]];
  const abertas = Fomito.comandas.abertas();
  const todasBolsas = [...Object.values(r.bolsas || {}), ...Object.values(r.bolsasGarcons || {})];
  const dinheiroBolsas = todasBolsas.reduce((s, b) => s + b.dinheiro, 0);
  const cartoesBolsas = todasBolsas.reduce((s, b) => s + b.credito + b.debito, 0);
  const pixTotal = r.gaveta.pix + todasBolsas.reduce((s, b) => s + b.pix, 0);
  const salao = cx.movimentos.filter((m) => m.tipo === "comanda" || m.tipo === "balcao").reduce((s, m) => s + m.valor, 0);
  const entregas = cx.movimentos.filter((m) => m.tipo === "entrega").reduce((s, m) => s + m.valor, 0);
  const maquininha = r.cartoesEsperado.credito + r.cartoesEsperado.debito;

  return `
    <div class="card caixa-status">
      <span class="caixa-status__icone">${icone("dinheiro")}</span>
      <div class="pilha" style="gap:2px;flex:1;min-width:0">
        <span class="linha" style="gap:8px;flex-wrap:wrap"><b>Caixa aberto</b>${turno.caixa === "atrasado" ? `<span class="tag tag--vermelho">De ${turno.diaDoCaixa}</span>` : `<span class="tag tag--verde">Aberto</span>`}${tagDiasJuntos(cx)}</span>
        <span class="pequeno suave">Desde ${dataCaixa(cx.abertoEm)}, ${horaCaixa(cx.abertoEm)} · aberto por ${cx.por} · dinheiro inicial ${moeda(cx.fundo)}${cx.dias?.length > 1 ? ` · junta os dias ${diasDoCaixa(cx)}: fecha tudo de uma vez` : ""}</span>
        ${turno.caixa === "atrasado" ? `<span class="pequeno" style="color:var(--vermelho-escuro)">Não foi fechado. Para aceitar pedidos hoje, feche este caixa e abra um novo, ou junte com o de hoje.</span>` : ""}
      </div>
      <div class="linha" style="gap:8px;flex-wrap:wrap">
        ${turno.caixa === "atrasado" ? `<button class="btn btn--contorno btn--sm" data-turno="juntar">${icone("mais", "ic--sm")} Juntar com o de hoje</button>` : ""}
        <button class="btn btn--contorno btn--sm" data-movimento="suprimento">${icone("mais", "ic--sm")} Colocar dinheiro</button>
        <button class="btn btn--contorno btn--sm" data-movimento="sangria">${icone("menos", "ic--sm")} Tirar dinheiro</button>
        <button class="btn btn--primario btn--sm" data-fechar-caixa>${icone("cadeado", "ic--sm")} Fechar caixa</button>
      </div>
    </div>

    ${blocoBolsas(r, cx, "motoboy")}
    ${blocoBolsas(r, cx, "garcom")}

    <div class="kpis kpis--caixa">
      <div class="card kpi"><div class="kpi__rotulo">Total de vendas${icone("moeda")}</div><div class="kpi__valor">${moeda(r.vendas)}</div><span class="variacao">todas as formas · salão e balcão ${moeda(salao)} · entregas ${moeda(entregas)}</span></div>
      <div class="card kpi kpi--destaque"><div class="kpi__rotulo">Deveria ter na gaveta${icone("dinheiro")}</div><div class="kpi__valor">${moeda(r.esperado)}</div><span class="variacao">dinheiro do caixa agora</span></div>
      <div class="card kpi kpi--destaque"><div class="kpi__rotulo">Maquininha do caixa${icone("cartao")}</div><div class="kpi__valor">${moeda(maquininha)}</div><span class="variacao">crédito ${moeda(r.cartoesEsperado.credito)} · débito ${moeda(r.cartoesEsperado.debito)}</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Nas bolsas${icone("entrega")}</div><div class="kpi__valor">${moeda(dinheiroBolsas + cartoesBolsas)}</div><span class="variacao">dinheiro ${moeda(dinheiroBolsas)} · maquininhas ${moeda(cartoesBolsas)}</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Pix${icone("pix")}</div><div class="kpi__valor">${moeda(pixTotal)}</div><span class="variacao">cai direto na conta · só registro</span></div>
    </div>

    <div class="grade-caixa">
        <div class="card painel-card">
          <div class="pilha" style="gap:2px"><h3>O que conferir no caixa</h3><span class="pequeno suave">Como o sistema chega nos valores. As bolsas conferem à parte.</span></div>
          <div class="conferir-bloco">
            <span class="conferir-bloco__titulo">${icone("dinheiro", "ic--sm")} Dinheiro na gaveta</span>
            <div class="conferencia">
              <div class="entre"><span>Dinheiro inicial</span><span class="num">${moeda(cx.fundo)}</span></div>
              <div class="entre"><span>+ Notas que os clientes deram</span><span class="num">${moeda(r.gaveta.recebido)}</span></div>
              <div class="entre"><span>− Troco devolvido</span><span class="num valor-saida">${moeda(r.gaveta.troco)}</span></div>
              ${r.convenioDinheiro ? `<div class="entre"><span>+ Convênios recebidos em dinheiro</span><span class="num">${moeda(r.convenioDinheiro)}</span></div>` : ""}
              <div class="entre"><span>+ Dinheiro colocado</span><span class="num">${moeda(r.suprimentos)}</span></div>
              <div class="entre"><span>− Dinheiro tirado</span><span class="num valor-saida">${moeda(r.sangrias)}</span></div>
              <div class="entre conferencia__total"><span>Deveria ter na gaveta</span><span class="num">${moeda(r.esperado)}</span></div>
            </div>
          </div>
          <div class="conferir-bloco">
            <span class="conferir-bloco__titulo">${icone("cartao", "ic--sm")} Maquininha do caixa</span>
            <div class="conferencia">
              <div class="entre"><span>Crédito</span><span class="num">${moeda(r.cartoesEsperado.credito)}</span></div>
              <div class="entre"><span>Débito</span><span class="num">${moeda(r.cartoesEsperado.debito)}</span></div>
              <div class="entre conferencia__total"><span>Deveria sair no extrato</span><span class="num">${moeda(maquininha)}</span></div>
            </div>
          </div>
          <p class="pequeno fraco">Ex.: pedido de R$ 100 pago com uma nota de R$ 200. Entram R$ 200, saem R$ 100 de troco e a gaveta fica com +R$ 100. O Pix cai na conta, e o que os motoboys e os garçons com bolsa recebem fica com eles até a conferência da bolsa.</p>
        </div>
        <div class="card painel-card">
          <h3>Por forma de pagamento</h3>
          ${Object.entries(r.porForma).map(([forma, valor]) => `
            <div class="barra-cat">
              <div class="entre pequeno"><span>${nomes[forma]}</span><span class="num">${moeda(valor)} <span class="fraco">${r.vendas ? Math.round((valor / r.vendas) * 100) : 0}%</span></span></div>
              <div class="barra-cat__trilho"><span style="width:${r.vendas ? (valor / r.vendas) * 100 : 0}%"></span></div>
            </div>`).join("")}
        </div>
    </div>
    ${abertas.length ? `<div class="aviso">${icone("mesa", "ic--sm")}<span>${abertas.length} mesas com comanda aberta (${moeda(abertas.reduce((s, c) => s + Fomito.comandas.total(c), 0))}). Entram no caixa quando a conta for fechada.</span></div>` : ""}
    <div class="card painel-card">
        <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>Movimentações</h3><span class="pequeno suave">${lista.length} de ${grupos.length} · toque num cartão para ver os pagamentos</span></div></div>
        <nav class="filtros">${filtrosTipo.map(([id, nome]) => `<button class="filtro ${filtroCaixa === id ? "ativo" : ""}" data-filtro-caixa="${id}">${nome} <small>${id === "todas" ? grupos.length : conta(id)}</small></button>`).join("")}</nav>
        <div class="filtros-forma">${filtrosForma.map(([id, nome]) => `<button class="chip-forma ${filtroForma === id ? "ativo" : ""}" data-filtro-forma="${id}">${id !== "todas" ? icone(ICONE_FORMA[id] || "cartao", "ic--sm") : ""}${nome}</button>`).join("")}</div>
        <div class="movs">
          ${lista.map(cartaoMovimento).join("") || `<div class="suave pequeno" style="text-align:center;padding:24px">Nenhuma movimentação neste filtro.</div>`}
        </div>
        <p class="pequeno fraco">Lançou errado? Abra o cartão e use ${icone("editar", "ic--sm")} no pagamento. A correção fica no registro com o seu nome, e o valor original não é apagado.</p>
    </div>
    ${blocoCorrecoes(correcoes)}`;
}

function caixaFechado(ultimo) {
  return `
    <div class="card caixa-status caixa-status--fechado">
      <span class="caixa-status__icone">${icone("cadeado")}</span>
      <div class="pilha" style="gap:2px;flex:1;min-width:0">
        <span class="linha" style="gap:8px"><b>Caixa fechado</b><span class="tag tag--cinza">Fechado</span></span>
        <span class="pequeno suave">${ultimo ? `Último fechamento às ${horaCaixa(ultimo.fechadoEm)}: vendas de ${moeda(ultimo.vendas)}, ${tagDiferenca(ultimo.contado, ultimo.esperado).replace(/<[^>]+>/g, "").toLowerCase()} na gaveta.` : "Abra o caixa para começar o dia."} Enquanto estiver fechado, o cliente continua pedindo, mas ninguém da loja aceita, serve ou manda para entrega.</span>
      </div>
      <button class="btn btn--primario" data-abrir-caixa>${icone("dinheiro", "ic--sm")} Abrir caixa</button>
    </div>`;
}

/* ---------- 1b. PÁGINA DE UM DIA (Fechamentos anteriores → clicar no dia) ----------
   Tudo daquele caixa, só para consulta: a conferência da gaveta e da maquininha,
   as bolsas com a conferência de cada uma, as movimentações, as correções e
   todos os pedidos e mesas do dia (com o detalhe ao tocar). Não muda o caixa de hoje. */
const escDia = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const diaLongo = (ts) => { const t = new Date(ts).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }); return t[0].toUpperCase() + t.slice(1); };
const duracaoDia = (de, ate) => { const min = Math.max(0, Math.round((ate - de) / 60000)); return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`; };
const bateu = (contado, esperado) => Math.abs(contado - esperado) < 0.005;

async function abrirDia(id) {
  const atual = (diaCaixa = { id, dados: null });
  filtroDia = "todos";
  renderCaixa();
  window.scrollTo({ top: 0 });
  try { atual.dados = await Fomito.api("GET", `/caixa/fechamentos/${id}`); } catch (err) { atual.erro = err.message; }
  if (diaCaixa === atual) renderCaixa();
}

/* Uma linha de conta: rótulo à esquerda, valor à direita */
const linhaConta = (rotulo, valor, classe = "") => `<div class="entre"><span>${rotulo}</span><span class="num ${classe}">${valor}</span></div>`;

function cartaoBolsaDia(tipo, nome, b) {
  const t = TIPO_BOLSA[tipo];
  const f = b.fechamento;
  const cartoes = b.credito + b.debito;
  const cartaoF = f?.cartao ? { esperado: f.cartao.esperado.credito + f.cartao.esperado.debito, contado: f.cartao.contado.credito + f.cartao.contado.debito } : null;
  const ok = f && bateu(f.contado, f.esperado) && (!cartaoF || bateu(cartaoF.contado, cartaoF.esperado));
  const status = !f ? `<span class="tag tag--cinza">Não conferida</span>` : ok ? `<span class="tag tag--verde">Conferida</span>` : `<span class="tag tag--amarelo">Conferida com diferença</span>`;
  return `
    <div class="bolsa-card">
      <div class="bolsa-card__topo">
        <span class="avatar-mini">${iniciaisCaixa(nome)}</span>
        <div class="pilha" style="gap:0;flex:1;min-width:0"><span class="forte">${escDia(nome)}</span><span class="pequeno fraco">${b.qtd} ${t.unidade[b.qtd === 1 ? 0 : 1]}</span></div>
        ${status}
      </div>
      <div class="bolsa-card__duas">
        <div class="bolsa-mini"><span class="bolsa-mini__rotulo">${icone("dinheiro", "ic--sm")} Dinheiro</span><strong class="num">${moeda(b.esperado)}</strong><span class="pequeno fraco">troco ${moeda(b.fundo)}<br>recebido ${moeda(b.dinheiro)}</span></div>
        <div class="bolsa-mini"><span class="bolsa-mini__rotulo">${icone("cartao", "ic--sm")} Maquininha</span><strong class="num">${moeda(cartoes)}</strong><span class="pequeno fraco">crédito ${moeda(b.credito)}<br>débito ${moeda(b.debito)}</span></div>
      </div>
      ${b.recebido ? `<span class="pequeno fraco">Notas dos clientes ${moeda(b.recebido)} · troco devolvido ${moeda(b.troco)}</span>` : ""}
      ${b.pix ? `<span class="pequeno fraco">${icone("pix", "ic--sm")} Pix ${moeda(b.pix)}: caiu direto na conta</span>` : ""}
      ${f ? `
        <div class="dia-conf">
          <div class="dia-conf__grade">
            <span></span><span class="fraco">Deveria</span><span class="fraco">Contado</span><span></span>
            <span>Dinheiro</span><span class="num">${moeda(f.esperado)}</span><b class="num">${moeda(f.contado)}</b>${tagDiferenca(f.contado, f.esperado)}
            ${cartaoF ? `<span>Maquininha</span><span class="num">${moeda(cartaoF.esperado)}</span><b class="num">${moeda(cartaoF.contado)}</b>${tagDiferenca(cartaoF.contado, cartaoF.esperado)}` : ""}
          </div>
          <span class="pequeno fraco">Conferida por ${escDia(f.por)} às ${horaCaixa(f.em)}${f.ficaParaAmanha ? ` · ficou ${moeda(f.ficaParaAmanha)} de troco` : ""}${f.obs ? ` · “${escDia(f.obs)}”` : ""}</span>
        </div>` : ""}
    </div>`;
}

function bolsasDia(r, tipo) {
  const bolsas = Object.entries(doTipo(r, tipo));
  if (!bolsas.length) return "";
  const t = TIPO_BOLSA[tipo];
  return `
    <div class="card painel-card">
      <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>${t.titulo}</h3><span class="pequeno suave">O que cada um levou e trouxe, e a conferência da bolsa.</span></div></div>
      <div class="bolsas">${bolsas.map(([nome, b]) => cartaoBolsaDia(tipo, nome, b)).join("")}</div>
    </div>`;
}

/* Botões dentro do cartão de movimentação do dia: ver o pedido ou a comanda */
function acoesMovimentoDia(g) {
  const m = g.movs[0];
  if (g.tipo === "comanda" && g.comanda && diaCaixa?.dados?.comandas.some((c) => c.numero === g.comanda)) return `<div class="mov__acoes"><button class="btn btn--contorno btn--sm" data-dia-comanda="${g.comanda}">${icone("conta", "ic--sm")} Ver a comanda</button></div>`;
  if (m.pedido && diaCaixa?.dados?.pedidos.some((p) => p.num === m.pedido)) return `<div class="mov__acoes"><button class="btn btn--contorno btn--sm" data-dia-pedido="${m.pedido}">${icone("pedidos", "ic--sm")} Ver o pedido</button></div>`;
  return "";
}

/* Pedidos e mesas do dia numa lista só, do mais recente para o mais antigo */
function vendasDoDia({ pedidos, comandas, caixa }) {
  const formaDaComanda = (c) => {
    const formas = [...new Set((c.pagamentos || []).map((p) => p.forma))];
    return formas.length ? formas.map((f) => CURTAS[f] || f).join(" + ") : "-";
  };
  const linhas = [
    ...pedidos.map((p) => {
      const entrega = p.modo === "entrega";
      const forma = p.pagoCom || p.pag;
      return {
        chave: `p${p.num}`, attr: `data-dia-pedido="${p.num}"`, num: `#${p.num}`, hora: p.criadoEm,
        tipo: entrega ? "entrega" : "balcao", tipoNome: entrega ? "Entrega" : p.retirada ? "Retirada" : "Balcão",
        quem: p.cliente || "-", sub: entrega && p.motoboy ? `com ${p.motoboy}` : p.retiradoPor ? `entregue por ${p.retiradoPor}` : "",
        itens: (p.itens || []).map((i) => `${i[1]}× ${i[5] || Fomito.produto(i[0])?.nome || "Item"}`),
        forma: forma ? (CURTAS[forma] || Fomito.formaPag(forma)?.nome || forma) : "-",
        cancelado: p.status === "cancelado", status: tagStatus(p.status), total: p.status === "cancelado" ? 0 : Number(p.total) || 0, totalOriginal: Number(p.total) || 0,
      };
    }),
    ...comandas.map((c) => {
      const liberada = !!c.cancelada;
      const tirados = (c.cancelamentos || []).reduce((s, x) => s + x.item.qtd, 0);
      return {
        chave: `c${c.numero || c.mesa}`, attr: c.numero ? `data-dia-comanda="${c.numero}"` : `data-dia-comanda-mesa="${c.mesa}|${c.abertaEm}"`, num: c.numero ? `#${c.numero}` : "-", hora: c.fechadaEm || c.abertaEm,
        tipo: "comanda", tipoNome: Fomito.comandas.mesaTexto(c.mesa),
        quem: c.nome || "Sem nome", sub: c.por ? `conta fechada por ${c.por}` : "",
        itens: (liberada ? (c.cancelamentos || []).map((x) => x.item) : (c.rodadas || []).flatMap((r) => r.itens)).map((i) => `${i.qtd}× ${i.nome || Fomito.produto(i.id)?.nome || "Item"}`),
        tirados, forma: liberada ? "-" : `${formaDaComanda(c)}${(c.divisao || 1) > 1 ? ` · ${c.divisao} pessoas` : ""}`,
        cancelado: liberada, status: liberada ? `<span class="tag tag--cinza">Liberada sem conta</span>` : `<span class="tag tag--verde">Paga</span>`, total: liberada ? 0 : Number(c.total) || 0, totalOriginal: liberada ? (c.cancelamentos || []).reduce((s, x) => s + (x.item.preco || 0) * x.item.qtd, 0) : Number(c.total) || 0,
      };
    }),
  ];
  return linhas.sort((a, b) => b.hora - a.hora);
}

function paginaDia() {
  const voltar = `<button class="btn btn--contorno btn--sm" data-voltar-caixa>${icone("voltar", "ic--sm")} Voltar ao caixa de hoje</button>`;
  if (!diaCaixa.dados) return `
    <div class="card painel-card dia-carregando">${voltar}<p class="suave">${diaCaixa.erro ? escDia(diaCaixa.erro) : "Carregando o fechamento…"}</p></div>`;
  const { caixa: f, pedidos, comandas } = diaCaixa.dados;
  const r = Fomito.contasCaixa.resumo(f);
  const todasBolsas = [...Object.values(r.bolsas), ...Object.values(r.bolsasGarcons)];
  const dinheiroBolsas = todasBolsas.reduce((s, b) => s + b.dinheiro, 0);
  const cartoesBolsas = todasBolsas.reduce((s, b) => s + b.credito + b.debito, 0);
  const pix = f.pix ?? r.gaveta.pix + todasBolsas.reduce((s, b) => s + b.pix, 0);
  const esperado = f.esperado ?? r.esperado;
  const cartao = f.cartao || null;
  const maqEsperado = cartao ? cartao.esperado.credito + cartao.esperado.debito : r.cartoesEsperado.credito + r.cartoesEsperado.debito;
  const maqContado = cartao ? cartao.contado.credito + cartao.contado.debito : null;
  const okDinheiro = bateu(f.contado, esperado);
  const okMaq = !cartao || bateu(maqContado, maqEsperado);
  const ticket = r.qtdVendas ? r.vendas / r.qtdVendas : 0;
  const somaTipo = (tipos) => f.movimentos.filter((m) => tipos.includes(m.tipo)).reduce((s, m) => s + m.valor, 0);
  const contaTipo = (tipos) => new Set(f.movimentos.filter((m) => tipos.includes(m.tipo)).map((m) => m.comanda || m.pedido || m.id)).size;
  const vendas = vendasDoDia(diaCaixa.dados);
  const cancelados = vendas.filter((v) => v.cancelado);
  const filtros = { todos: () => true, entrega: (v) => v.tipo === "entrega" && !v.cancelado, balcao: (v) => v.tipo === "balcao" && !v.cancelado, comanda: (v) => v.tipo === "comanda" && !v.cancelado, cancelados: (v) => v.cancelado };
  if (!filtros[filtroDia]) filtroDia = "todos";
  const lista = vendas.filter(filtros[filtroDia]);
  const nomesFiltro = [["todos", "Tudo"], ["entrega", "Entregas"], ["balcao", "Balcão e retirada"], ["comanda", "Mesas"], ["cancelados", "Cancelados"]].filter(([id]) => id === "todos" || vendas.some(filtros[id]));
  const grupos = gruposMovimentos(f.movimentos, f);
  const correcoes = Fomito.caixa.correcoes(f);

  return `
    <div class="card dia-topo">
      <div class="dia-topo__linha">${voltar}<span class="tag tag--cinza">${icone("cadeado", "ic--sm")} Caixa fechado</span></div>
      <div class="dia-topo__titulo">
        <div class="pilha" style="gap:4px;min-width:0">
          <span class="dia-topo__sobre">Fechamento do caixa</span>
          <h2 class="dia-topo__dia">${diaLongo(f.abertoEm)}${f.dias?.length > 1 ? ` <span class="dia-topo__juntos">a ${diaLongo(f.fechadoEm).toLowerCase()}</span>` : ""}</h2>
          ${f.dias?.length > 1 ? `<span class="linha" style="gap:6px">${tagDiasJuntos(f)}<span class="pequeno suave">O caixa de um dia não foi fechado e foi juntado com o seguinte: os dias ${diasDoCaixa(f)} fecharam numa conferência só.</span></span>` : ""}
          <span class="pequeno suave">Aberto às ${horaCaixa(f.abertoEm)} por ${escDia(f.por || "-")} · fechado às ${horaCaixa(f.fechadoEm)} por ${escDia(f.fechadoPor || "-")}${f.fechadoEm - f.abertoEm >= 60000 ? ` · ${duracaoDia(f.abertoEm, f.fechadoEm)} de caixa` : ""}</span>
        </div>
        <div class="dia-topo__resultado ${okDinheiro && okMaq ? "dia-topo__resultado--ok" : "dia-topo__resultado--dif"}">
          <span class="pequeno">Resultado do fechamento</span>
          <strong>${okDinheiro && okMaq ? "Tudo bateu" : "Fechou com diferença"}</strong>
          <span class="linha" style="gap:6px;flex-wrap:wrap">${tagDiferenca(f.contado, esperado).replace(">", ">Gaveta: ")}${cartao ? tagDiferenca(maqContado, maqEsperado).replace(">", ">Maquininha: ") : ""}</span>
        </div>
      </div>
      ${f.obs ? `<div class="dia-obs">${icone("info", "ic--sm")}<span><b>Observação de quem fechou:</b> “${escDia(f.obs)}”</span></div>` : ""}
    </div>

    <div class="kpis kpis--caixa">
      <div class="card kpi"><div class="kpi__rotulo">Total de vendas${icone("moeda")}</div><div class="kpi__valor">${moeda(r.vendas)}</div><span class="variacao">todas as formas · ${r.qtdVendas} pagamentos · ticket ${moeda(ticket)}</span></div>
      <div class="card kpi kpi--destaque"><div class="kpi__rotulo">Dinheiro na gaveta${icone("dinheiro")}</div><div class="kpi__valor">${moeda(f.contado)}</div><span class="variacao">contado · deveria ter ${moeda(esperado)}</span></div>
      <div class="card kpi kpi--destaque"><div class="kpi__rotulo">Maquininha do caixa${icone("cartao")}</div><div class="kpi__valor">${cartao ? moeda(maqContado) : "—"}</div><span class="variacao">${cartao ? `extrato · deveria ${moeda(maqEsperado)}` : `não conferida · deveria ${moeda(maqEsperado)}`}</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Nas bolsas${icone("entrega")}</div><div class="kpi__valor">${moeda(dinheiroBolsas + cartoesBolsas)}</div><span class="variacao">dinheiro ${moeda(dinheiroBolsas)} · maquininhas ${moeda(cartoesBolsas)}</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Pix${icone("pix")}</div><div class="kpi__valor">${moeda(pix)}</div><span class="variacao">caiu direto na conta · só registro</span></div>
    </div>

    <div class="grade-caixa">
      <div class="card painel-card">
        <div class="pilha" style="gap:2px"><h3>Conferência do caixa</h3><span class="pequeno suave">Como o sistema chegou nos valores e o que foi contado.</span></div>
        <div class="conferir-bloco">
          <span class="conferir-bloco__titulo">${icone("dinheiro", "ic--sm")} Dinheiro na gaveta</span>
          <div class="conferencia">
            ${linhaConta("Dinheiro inicial", moeda(f.fundo || 0))}
            ${linhaConta("+ Notas que os clientes deram", moeda(r.gaveta.recebido))}
            ${linhaConta("− Troco devolvido", moeda(r.gaveta.troco), "valor-saida")}
            ${r.convenioDinheiro ? linhaConta("+ Convênios recebidos em dinheiro", moeda(r.convenioDinheiro)) : ""}
            ${linhaConta("+ Dinheiro colocado", moeda(r.suprimentos))}
            ${linhaConta("− Dinheiro tirado", moeda(r.sangrias), "valor-saida")}
            <div class="entre conferencia__total"><span>Deveria ter no caixa (dinheiro)</span><span class="num">${moeda(esperado)}</span></div>
            ${linhaConta("Contado na gaveta", `<b>${moeda(f.contado)}</b>`)}
            <div class="entre"><span>Resultado</span>${tagDiferenca(f.contado, esperado)}</div>
          </div>
        </div>
        <div class="conferir-bloco">
          <span class="conferir-bloco__titulo">${icone("cartao", "ic--sm")} Maquininha do caixa</span>
          <div class="conferencia">
            ${cartao ? `
              <div class="dia-maq"><span></span><span class="fraco">Deveria</span><span class="fraco">Extrato</span></div>
              <div class="dia-maq"><span>Crédito</span><span class="num">${moeda(cartao.esperado.credito)}</span><span class="num forte">${moeda(cartao.contado.credito)}</span></div>
              <div class="dia-maq"><span>Débito</span><span class="num">${moeda(cartao.esperado.debito)}</span><span class="num forte">${moeda(cartao.contado.debito)}</span></div>
              <div class="entre conferencia__total"><span>Resultado</span>${tagDiferenca(maqContado, maqEsperado)}</div>`
            : `${linhaConta("Crédito", moeda(r.cartoesEsperado.credito))}${linhaConta("Débito", moeda(r.cartoesEsperado.debito))}<span class="pequeno fraco">Este caixa foi fechado antes da conferência da maquininha.</span>`}
          </div>
        </div>
      </div>
      <div class="card painel-card">
        <h3>Por forma de pagamento</h3>
        ${Object.entries(r.porForma).filter(([, v]) => v).map(([forma, valor]) => `
          <div class="barra-cat">
            <div class="entre pequeno"><span>${Fomito.caixa.FORMAS_TODAS[forma] || forma}</span><span class="num">${moeda(valor)} <span class="fraco">${r.vendas ? Math.round((valor / r.vendas) * 100) : 0}%</span></span></div>
            <div class="barra-cat__trilho"><span style="width:${r.vendas ? (valor / r.vendas) * 100 : 0}%"></span></div>
          </div>`).join("") || `<span class="pequeno suave">Nenhuma venda neste caixa.</span>`}
        <div class="conferir-bloco">
          <span class="conferir-bloco__titulo">${icone("sacola", "ic--sm")} De onde veio</span>
          <div class="conferencia">
            ${linhaConta(`Mesas <span class="fraco">(${contaTipo(["comanda"])})</span>`, moeda(somaTipo(["comanda"])))}
            ${linhaConta(`Balcão e retirada <span class="fraco">(${contaTipo(["balcao"])})</span>`, moeda(somaTipo(["balcao"])))}
            ${linhaConta(`Entregas <span class="fraco">(${contaTipo(["entrega"])})</span>`, moeda(somaTipo(["entrega"])))}
            ${r.recebidoConvenio ? linhaConta("Convênios recebidos (não é venda nova)", moeda(r.recebidoConvenio)) : ""}
            ${cancelados.length ? linhaConta(`Cancelados <span class="fraco">(${cancelados.length}, não entram)</span>`, moeda(cancelados.reduce((s, v) => s + v.totalOriginal, 0)), "fraco") : ""}
          </div>
        </div>
      </div>
    </div>

    ${bolsasDia(r, "motoboy")}
    ${bolsasDia(r, "garcom")}

    <div class="card painel-card">
      <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>Pedidos e mesas do dia</h3><span class="pequeno suave">${lista.length} de ${vendas.length} · toque para ver o pedido completo</span></div></div>
      <nav class="filtros">${nomesFiltro.map(([id, nome]) => `<button class="filtro ${filtroDia === id ? "ativo" : ""}" data-filtro-dia="${id}">${nome} <small>${vendas.filter(filtros[id]).length}</small></button>`).join("")}</nav>
      <div class="tabela-rolagem">
        <table class="tabela tabela--dia">
          <thead><tr><th>Nº</th><th>Hora</th><th>Tipo</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Situação</th><th class="dir">Total</th></tr></thead>
          <tbody>
            ${lista.map((v) => `
              <tr class="linha-clicavel ${v.cancelado ? "linha-cancelada" : ""}" ${v.attr} title="Ver o detalhe">
                <td class="num forte">${v.num}</td>
                <td class="num suave">${horaCaixa(v.hora)}</td>
                <td><span class="tipo-dia tipo-dia--${v.tipo}">${icone(v.tipo === "entrega" ? "entrega" : v.tipo === "comanda" ? "mesa" : "loja", "ic--sm")} ${escDia(v.tipoNome)}</span></td>
                <td><span class="forte">${escDia(v.quem)}</span>${v.sub ? `<br><span class="pequeno fraco">${escDia(v.sub)}</span>` : ""}</td>
                <td class="pequeno dia-itens">${escDia(v.itens.slice(0, 3).join(", "))}${v.itens.length > 3 ? ` <span class="fraco">+${v.itens.length - 3}</span>` : ""}${v.tirados ? `<br><span class="tag tag--amarelo">${v.tirados} ${v.tirados > 1 ? "itens tirados" : "item tirado"}</span>` : ""}</td>
                <td class="pequeno">${escDia(v.forma)}</td>
                <td>${v.status}</td>
                <td class="dir num forte">${v.cancelado ? `<s class="fraco">${moeda(v.totalOriginal)}</s>` : moeda(v.total)}</td>
              </tr>`).join("") || `<tr><td colspan="8" class="suave" style="text-align:center;padding:24px">Nada neste filtro.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card painel-card">
      <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>Movimentações do caixa</h3><span class="pequeno suave">${grupos.length} · cada pagamento, com o que o cliente deu e o troco, e o dinheiro colocado e tirado</span></div></div>
      <div class="movs">${grupos.map((g) => cartaoMovimento(g, true)).join("") || `<div class="suave pequeno" style="text-align:center;padding:24px">Nenhuma movimentação.</div>`}</div>
    </div>
    ${blocoCorrecoes(correcoes)}
    <div class="dia-rodape">${voltar}</div>`;
}

/* ---------- 2. JANELAS ---------- */
function janelaCaixa(titulo, conteudo, aoConfirmar, aoDigitar) {
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  camada.innerHTML = `
    <div class="folha" style="max-width:440px;display:flex;flex-direction:column;gap:16px">
      <div class="folha__topo"><h2>${titulo}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
      ${conteudo}
    </div>`;
  document.body.appendChild(camada);
  camada.querySelector("input")?.focus();
  camada.addEventListener("click", async (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return camada.remove();
    if (!e.target.closest("[data-ok]")) return;
    /* Espera o servidor: se der erro, a janela continua aberta e a mensagem aparece */
    if ((await aoConfirmar(camada)) !== false) { camada.remove(); renderCaixa(); }
  });
  camada.addEventListener("input", () => { $("#erroCaixa", camada).hidden = true; aoDigitar?.(camada); });
  return camada;
}

function janelaAbrir() {
  /* Abre a gaveta e, junto, a bolsa de cada motoboy que vai sair hoje (ex.: Leonardo R$ 200, Kaique R$ 200) */
  const motoboys = Fomito.sessao.usuarios().filter((u) => u.perfil === "motoboy").map((u) => u.nome);
  const garcons = Fomito.sessao.usuarios().filter((u) => u.perfil === "garcom").map((u) => u.nome);
  const linhaBolsa = (nome = "") => `
    <div class="bolsa-linha">
      <select class="input" data-bolsa-nome aria-label="Motoboy"><option value="">Escolha o motoboy</option>${motoboys.map((m) => `<option ${m === nome ? "selected" : ""}>${m}</option>`).join("")}</select>
      <div class="campo-moeda"><span>R$</span><input class="input" inputmode="decimal" data-bolsa-valor value="0,00" aria-label="Troco na bolsa"></div>
      <button class="btn-icone btn-icone--sm" data-tirar-bolsa aria-label="Tirar esta bolsa" title="Tirar">${icone("lixo", "ic--sm")}</button>
    </div>`;
  const camada = janelaCaixa("Abrir caixa", `
    <div class="abrir-bloco">
      <span class="abrir-bloco__titulo">${icone("dinheiro", "ic--sm")} Gaveta do balcão</span>
      <p class="suave pequeno">Conte o dinheiro que já está na gaveta para dar troco. O sistema começa daqui e vai somando cada pagamento em dinheiro, já descontando o troco.</p>
      <div class="campo"><label for="fundo">Dinheiro inicial na gaveta <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="fundo" class="input" inputmode="decimal" value="150,00"></div></div>
    </div>
    ${motoboys.length ? `
    <div class="abrir-bloco">
      <span class="abrir-bloco__titulo">${icone("entrega", "ic--sm")} Bolsas dos motoboys</span>
      <p class="suave pequeno">Escolha quem sai para entregar hoje e quanto leva de troco (pode ser R$ 0,00). Sai separado da gaveta. Só sai para entrega quem tiver a bolsa aberta.</p>
      <div id="bolsasAbrir" class="pilha" style="gap:8px">${linhaBolsa(motoboys.length === 1 ? motoboys[0] : "")}</div>
      <button class="btn btn--contorno btn--sm" data-mais-bolsa style="align-self:flex-start">${icone("mais", "ic--sm")} Abrir bolsa de outro motoboy</button>
    </div>` : ""}
    ${garcons.length ? `
    <div class="abrir-bloco">
      <span class="abrir-bloco__titulo">${icone("mesa", "ic--sm")} Garçons com bolsa própria</span>
      <p class="suave pequeno">Marque só quem anda com pochete e maquininha própria. Quem não for marcado recebe as mesas no caixa.</p>
      <div class="pilha" style="gap:8px">${garcons.map((g) => `
        <label class="garcom-linha"><input type="checkbox" data-garcom-bolsa="${escAttr(g)}"><span class="forte">${g}</span>
          <div class="campo-moeda"><span>R$</span><input class="input" inputmode="decimal" data-garcom-valor="${escAttr(g)}" value="0,00" aria-label="Troco do ${escAttr(g)}" disabled></div></label>`).join("")}</div>
    </div>` : ""}
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("check", "ic--sm")} Abrir caixa</button>`,
  async (c) => {
    const erro = (t) => { $("#erroCaixa", c).textContent = t; $("#erroCaixa", c).hidden = false; return false; };
    const fundo = formatoDinheiro($("#fundo", c).value);
    const bolsasGarcons = {};
    c.querySelectorAll("[data-garcom-bolsa]").forEach((x) => { if (x.checked) bolsasGarcons[x.dataset.garcomBolsa] = formatoDinheiro(c.querySelector(`[data-garcom-valor="${CSS.escape(x.dataset.garcomBolsa)}"]`).value); });
    if ($("#fundo", c).value.trim() === "") return erro("Informe o dinheiro inicial (pode ser R$ 0,00).");
    const bolsas = {};
    for (const linha of c.querySelectorAll(".bolsa-linha")) {
      const nome = $("[data-bolsa-nome]", linha).value;
      const valor = formatoDinheiro($("[data-bolsa-valor]", linha).value);
      if (!nome) { if (valor > 0) return erro("Escolha o motoboy de cada bolsa."); continue; }
      if (bolsas[nome] != null) return erro(`${nome} está em duas linhas. Deixe uma só.`);
      bolsas[nome] = valor;
    }
    await Fomito.caixa.abrir({ fundo, motoboys: bolsas, garcons: bolsasGarcons });
    const qtd = Object.keys(bolsas).length + Object.keys(bolsasGarcons).length;
    toast(`Caixa aberto com ${moeda(fundo)} na gaveta${qtd ? ` e ${qtd} bolsa${qtd > 1 ? "s" : ""}` : ""}`, "dinheiro");
  });
  camada.addEventListener("click", (e) => {
    if (e.target.closest("[data-mais-bolsa]")) {
      const usados = [...camada.querySelectorAll("[data-bolsa-nome]")].map((s) => s.value);
      const proximo = motoboys.find((m) => !usados.includes(m)) || "";
      $("#bolsasAbrir", camada).insertAdjacentHTML("beforeend", linhaBolsa(proximo));
      return;
    }
    const tirar = e.target.closest("[data-tirar-bolsa]");
    if (tirar) tirar.closest(".bolsa-linha").remove();
  });
  camada.addEventListener("change", (e) => {
    const g = e.target.closest("[data-garcom-bolsa]");
    if (g) camada.querySelector(`[data-garcom-valor="${CSS.escape(g.dataset.garcomBolsa)}"]`).disabled = !g.checked;
  });
}

function janelaMovimento(tipo) {
  const sangria = tipo === "sangria";
  const motivos = sangria ? ["Retirada para o cofre", "Pagamento de fornecedor", "Pagamento de entregador", "Outro"] : ["Reforço de troco", "Moedas", "Outro"];
  const disponivel = Fomito.caixa.resumo(Fomito.caixa.aberto()).esperado;
  janelaCaixa(sangria ? "Tirar dinheiro da gaveta" : "Colocar dinheiro na gaveta", `
    <p class="suave pequeno">${sangria ? `Dinheiro que sai da gaveta sem ser troco, como levar ao cofre. Agora deveria ter ${moeda(disponivel)} na gaveta.` : "Dinheiro que entra na gaveta sem ser venda, como mais troco ou moedas."}</p>
    <div class="campo"><label for="valorMov">Valor <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="valorMov" class="input" inputmode="decimal" placeholder="0,00"></div></div>
    <div class="campo"><label for="motivoMov">Motivo</label><select id="motivoMov" class="input">${motivos.map((m) => `<option>${m}</option>`).join("")}</select></div>
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("check", "ic--sm")} ${sangria ? "Tirar" : "Colocar"} dinheiro</button>`,
  async (c) => {
    const valor = formatoDinheiro($("#valorMov", c).value);
    const erro = (t) => { $("#erroCaixa", c).textContent = t; $("#erroCaixa", c).hidden = false; return false; };
    if (valor <= 0) return erro("Informe o valor.");
    if (sangria && valor > disponivel) return erro(`Não há ${moeda(valor)} na gaveta (deveria ter ${moeda(disponivel)}).`);
    await Fomito.caixa.registrar({ tipo, ref: $("#motivoMov", c).value, valor });
    toast(`${moeda(valor)} ${sangria ? "tirados da" : "colocados na"} gaveta`, "dinheiro");
  });
}

/* Corrigir um pagamento lançado errado. Motivo obrigatório; tudo fica registrado. */
function janelaCorrigir(id) {
  const m = Fomito.caixa.aberto().movimentos.find((x) => x.id === id);
  const venda = !["sangria", "suprimento"].includes(m.tipo);
  const r = { forma: m.forma, valor: m.valor, recebido: m.recebido ?? (m.forma === "dinheiro" ? m.valor : "") };
  const texto = (n) => (n === "" || n == null ? "" : Number(n).toFixed(2).replace(".", ","));
  const nomes = Fomito.caixa.FORMAS;

  const blocoForma = () => !venda ? "" : `
    <div class="campo"><span class="rotulo-campo">Forma de pagamento</span>
      <div class="formas-painel">
        ${Object.entries(nomes).map(([id, nome]) => `<button class="opcao ${r.forma === id ? "ativa" : ""}" data-forma-corr="${id}"><span class="opcao__icone">${icone({ dinheiro: "dinheiro", pix: "pix", credito: "cartao", debito: "cartao" }[id], "ic--sm")}</span><span class="opcao__titulo pequeno">${nome}</span></button>`).join("")}
      </div>
    </div>`;
  const blocoTroco = () => {
    if (!venda || r.forma !== "dinheiro") return "";
    const valor = formatoDinheiro(r.valor), deu = formatoDinheiro(r.recebido);
    return `
      <div class="campo"><label for="corrRecebido">Quanto o cliente deu em dinheiro <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="corrRecebido" class="input" inputmode="decimal" value="${texto(r.recebido)}"></div></div>
      <div id="corrTroco">${r.recebido === "" ? "" : deu < valor ? `<div class="diferenca diferenca--falta"><span>Faltam</span><strong>${moeda(valor - deu)}</strong></div>` : `<div class="diferenca diferenca--ok"><span>Troco</span><strong>${moeda(deu - valor)}</strong></div>`}</div>`;
  };
  const camada = janelaCaixa(venda ? "Corrigir pagamento" : "Corrigir valor", `
    <div class="conferencia">
      <div class="forte">${m.ref}</div>
      <div class="pequeno suave">Lançado por ${m.por} às ${horaCaixa(m.hora)} · ${venda ? `${nomes[m.forma]} ${moeda(m.valor)}${m.recebido ? `, cliente deu ${moeda(m.recebido)}` : ""}` : moeda(m.valor)}</div>
    </div>
    <div id="corrForma">${blocoForma()}</div>
    <div class="campo"><label for="corrValor">Valor ${venda ? "do pagamento" : ""} <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="corrValor" class="input" inputmode="decimal" value="${texto(r.valor)}"></div></div>
    <div id="corrDinheiro">${blocoTroco()}</div>
    <div class="campo"><label for="corrMotivo">Motivo da correção <span class="obrigatorio">*</span></label><input id="corrMotivo" class="input" placeholder="Ex.: o motoboy marcou cartão, mas o cliente pagou no Pix"></div>
    ${m.correcoes?.length ? `<div class="historico-corr"><span class="rotulo">Correções anteriores</span>${m.correcoes.map((c) => `<div class="pequeno"><b>${horaCaixa(c.em)} · ${c.por}:</b> ${mudancas(c).join(" · ")}<div class="fraco">“${c.motivo}”</div></div>`).join("")}</div>` : ""}
    <div class="aviso">${icone("cadeado", "ic--sm")}<span>A correção fica registrada com o seu nome, a hora e o motivo. O valor original não é apagado.</span></div>
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("check", "ic--sm")} Salvar correção</button>`,
  async (c) => {
    const erro = (t) => { $("#erroCaixa", c).textContent = t; $("#erroCaixa", c).hidden = false; return false; };
    const valor = formatoDinheiro(r.valor);
    if (valor <= 0) return erro("Informe o valor.");
    const novo = { valor };
    if (venda) {
      novo.forma = r.forma;
      if (r.forma === "dinheiro") {
        if (r.recebido === "") return erro("Informe quanto o cliente deu em dinheiro.");
        const deu = formatoDinheiro(r.recebido);
        if (deu < valor) return erro("O valor que o cliente deu não cobre o pagamento.");
        Object.assign(novo, { recebido: deu, troco: Math.round((deu - valor) * 100) / 100 });
      }
    }
    const motivo = $("#corrMotivo", c).value;
    /* O servidor guarda o antes e o depois e, se for entrega, corrige também o pedido */
    const feito = await Fomito.caixa.corrigir(m.id, novo, { motivo });
    if (typeof feito === "string") return erro(feito);
    toast("Correção salva no registro", "editar");
  },
  (c) => {
    r.valor = $("#corrValor", c).value;
    if ($("#corrRecebido", c)) { r.recebido = $("#corrRecebido", c).value; }
    const foco = document.activeElement?.id;
    $("#corrDinheiro", c).innerHTML = blocoTroco();
    if (foco === "corrRecebido") { const i = $("#corrRecebido", c); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  });
  camada.addEventListener("click", (e) => {
    const f = e.target.closest("[data-forma-corr]");
    if (!f) return;
    r.forma = f.dataset.formaCorr;
    if (r.forma === "dinheiro" && r.recebido === "") r.recebido = formatoDinheiro(r.valor);
    $("#corrForma", camada).innerHTML = blocoForma();
    $("#corrDinheiro", camada).innerHTML = blocoTroco();
  });
}

/* Histórico de um movimento corrigido */
function janelaHistorico(id) {
  const m = Fomito.caixa.aberto().movimentos.find((x) => x.id === id);
  janelaCaixa("Histórico da correção", `
    <div class="conferencia"><div class="forte">${m.ref}</div><div class="pequeno suave">Lançado por ${m.por} às ${horaCaixa(m.hora)}</div></div>
    <div class="historico-corr lista-rolagem">
      ${m.correcoes.map((c) => `<div class="pequeno"><b>${horaCaixa(c.em)} · corrigido por ${c.por}</b>${mudancas(c).map((t) => `<div>${t}</div>`).join("")}<div class="fraco">Motivo: “${c.motivo}”</div></div>`).join("")}
    </div>
    <button class="btn btn--contorno btn--bloco" data-fechar>Fechar</button>`, () => {});
}

function janelaFechar() {
  const cx = Fomito.caixa.aberto();
  const r = Fomito.caixa.resumo(cx);
  /* Primeiro as bolsas: cada motoboy e garçom com bolsa confere antes de fechar o caixa */
  if (r.bolsasPendentes.length) {
    janelaCaixa("Fechar caixa", `
      <div class="aviso aviso--bolsas">${icone("info", "ic--sm")}<span><b>Antes de fechar, confira ${r.bolsasPendentes.length > 1 ? "as bolsas" : "a bolsa"}.</b> O dinheiro e a maquininha de quem trabalhou com bolsa precisam ser conferidos primeiro.</span></div>
      <div class="pilha" style="gap:8px">${r.bolsasPendentes.map(({ tipo, nome }) => {
        const b = doTipo(r, tipo)[nome];
        return `<div class="pendente-linha"><span class="avatar-mini">${iniciaisCaixa(nome)}</span><div class="pilha" style="gap:0;flex:1;min-width:0"><span class="forte">${nome}</span><span class="pequeno fraco">${tipo === "garcom" ? "Garçom" : "Motoboy"} · dinheiro ${moeda(b.esperado)} · maquininha ${moeda(b.credito + b.debito)}</span></div><button class="btn btn--primario btn--sm" data-conferir-agora="${chaveBolsa(tipo, nome)}">Conferir</button></div>`;
      }).join("")}</div>
      <button class="btn btn--primario btn--bloco" disabled>${icone("cadeado", "ic--sm")} Fechar caixa</button>`, () => false)
      .addEventListener("click", (e) => {
        const k = e.target.closest("[data-conferir-agora]");
        if (!k) return;
        e.target.closest(".sobreposicao").remove();
        const [tipo, ...nome] = k.dataset.conferirAgora.split("|");
        janelaConferirBolsa(tipo, nome.join("|"));
      });
    return;
  }
  const esp = r.cartoesEsperado;
  const temCartao = esp.credito + esp.debito > 0;
  const pixTotal = r.gaveta.pix;
  const turno = Fomito.turno.situacao();
  const titulo = cx.dias?.length > 1 ? `Fechar caixa · ${cx.dias.length} dias juntos` : turno.caixa === "atrasado" ? `Fechar o caixa de ${turno.diaDoCaixa.replace(/^ontem \((.*)\)$/, "ontem")}` : "Fechar caixa";
  janelaCaixa(titulo, `
    ${cx.dias?.length > 1 ? `<div class="aviso aviso--convenio">${icone("info", "ic--sm")}<span>Este caixa junta os dias <b>${diasDoCaixa(cx)}</b>. A conferência abaixo soma tudo e fecha os dois de uma vez.</span></div>` : ""}
    ${turno.caixa === "atrasado" ? `<div class="aviso">${icone("info", "ic--sm")}<span>Este caixa é de <b>${turno.diaDoCaixa}</b>. Depois de fechar, abra o caixa de hoje para aceitar os pedidos.</span></div>` : ""}
    <div class="conferencia">
      ${Object.entries(r.porForma).map(([f, v]) => `<div class="entre"><span>${Fomito.caixa.FORMAS_TODAS[f] || f}</span><span class="num">${moeda(v)}</span></div>`).join("")}
      <div class="entre conferencia__total"><span>Total de vendas <span class="fraco pequeno">(todas as formas)</span></span><span class="num">${moeda(r.vendas)}</span></div>
    </div>
    <div class="conferir-bloco">
      <span class="conferir-bloco__titulo">${icone("dinheiro", "ic--sm")} Dinheiro na gaveta</span>
      <div class="conferencia">
        <div class="entre"><span>Dinheiro inicial</span><span class="num">${moeda(cx.fundo)}</span></div>
        <div class="entre"><span>+ Vendas em dinheiro do caixa</span><span class="num">${moeda(r.gaveta.dinheiro)}</span></div>
        ${r.convenioDinheiro ? `<div class="entre"><span>+ Convênios recebidos em dinheiro</span><span class="num">${moeda(r.convenioDinheiro)}</span></div>` : ""}
        <div class="entre"><span>+ Colocado − tirado</span><span class="num">${moeda(r.suprimentos - r.sangrias)}</span></div>
        <div class="entre conferencia__total"><span>Deveria ter na gaveta</span><span class="num">${moeda(r.esperado)}</span></div>
      </div>
      <div class="campo"><label for="contado">Contado na gaveta <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="contado" class="input" inputmode="decimal" placeholder="0,00"></div></div>
      <div id="diferencaCaixa">${blocoDiferenca(null, 0, "Conte o dinheiro da gaveta e digite o valor.")}</div>
    </div>
    ${temCartao ? blocoMaquininha(esp, "caixa", "Maquininha do caixa") : `<p class="pequeno fraco">${icone("cartao", "ic--sm")} Nenhum cartão na maquininha do caixa hoje.</p>`}
    ${pixTotal ? `<p class="pequeno fraco">${icone("pix", "ic--sm")} Pix no caixa: ${moeda(pixTotal)}. Cai direto na conta, fica só de registro.</p>` : ""}
    <div class="campo"><label for="obsCaixa">Observação <span class="fraco">(obrigatória se algo não bater)</span></label><input id="obsCaixa" class="input" placeholder="Ex.: troco errado na mesa 5"></div>
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("cadeado", "ic--sm")} Fechar caixa</button>`,
  async (c) => {
    const erro = (t) => { $("#erroCaixa", c).textContent = t; $("#erroCaixa", c).hidden = false; return false; };
    const contado = valorCampo($("#contado", c));
    if (contado == null) return erro("Informe quanto dinheiro tem na gaveta.");
    const credito = temCartao ? valorCampo($("#caixaCredito", c)) : 0;
    const debito = temCartao ? valorCampo($("#caixaDebito", c)) : 0;
    if (temCartao && (credito == null || debito == null)) return erro("Digite o crédito e o débito do extrato da maquininha (pode ser 0,00).");
    const obs = $("#obsCaixa", c).value.trim();
    const bateu = Math.abs(contado - r.esperado) < 0.005 && Math.abs(credito - esp.credito) < 0.005 && Math.abs(debito - esp.debito) < 0.005;
    if (!bateu && !obs) return erro("Algo não bateu: escreva uma observação.");
    try { await Fomito.caixa.fechar({ contado, credito, debito, obs }); } catch (err) { return erro(err.message); }
    toast("Caixa fechado. Relatório do dia salvo.", "cadeado");
  },
  (c) => {
    $("#diferencaCaixa", c).innerHTML = blocoDiferenca(valorCampo($("#contado", c)), r.esperado, "Conte o dinheiro da gaveta e digite o valor.");
    if (temCartao) $("#caixaDifCartao", c).innerHTML = diferencaMaquininha(c, esp, "caixa");
    $("#erroCaixa", c).hidden = true;
  });
}

/* Refazer a divisão de uma comanda paga (ex.: dividiram por 3, mas eram 4). Só pelo caixa, com motivo. */
async function janelaRedividir(numero) {
  const movs = Fomito.caixa.aberto().movimentos.filter((m) => m.tipo === "comanda" && m.comanda === numero);
  const total = movs.reduce((s, m) => s + m.valor, 0);
  const atual = movs[0]?.divisao || movs.length;
  const r = await Fomito.dialogo({
    titulo: `Refazer a divisão · comanda #${numero}`,
    texto: `Total de <b>${moeda(total)}</b>, dividido hoje por <b>${atual}</b>: ${movs.map((m) => `${Fomito.caixa.FORMAS[m.forma]} ${moeda(m.valor)}`).join(" · ")}. Cada pagamento passa a ser a parte nova; quem entrar na divisão vira um pagamento novo.`,
    campos: [
      { id: "pessoas", rotulo: "Dividir por quantas pessoas", valor: String(atual + 1), tipo: "moeda", obrigatorio: true, max: 2,
        validar: (v) => (Number(v) >= movs.length ? null : `Precisa ser pelo menos ${movs.length} (já há ${movs.length} pagamento${movs.length > 1 ? "s" : ""}).`) },
      { id: "forma", rotulo: "Como pagou quem entrou na divisão", tipo: "select", valor: "pix", opcoes: Object.entries(Fomito.caixa.FORMAS) },
      { id: "motivo", rotulo: "Motivo", obrigatorio: true, placeholder: "Ex.: chegou mais uma pessoa para dividir", max: 200 },
    ],
    confirmar: "Refazer a divisão",
  });
  if (!r) return;
  const feito = await Fomito.acao("POST", "/caixa/redividir", { comanda: numero, pessoas: Number(r.pessoas), forma: r.forma, motivo: r.motivo });
  renderCaixa();
  toast(`Comanda #${numero} dividida por ${feito.divisao}: ${feito.valores.map(moeda).join(" + ")}`, "check");
}

/* ---------- 3. CLIQUES ---------- */
document.addEventListener("click", (e) => {
  if (!$('[data-secao="caixa"].secao')?.contains(e.target)) return;
  /* Página de um dia anterior */
  const dia = e.target.closest("[data-ver-dia]");
  if (dia) return abrirDia(Number(dia.dataset.verDia));
  if (e.target.closest("[data-voltar-caixa]")) { diaCaixa = null; renderCaixa(); return window.scrollTo({ top: 0 }); }
  const filtroD = e.target.closest("[data-filtro-dia]");
  if (filtroD) { filtroDia = filtroD.dataset.filtroDia; return renderCaixa(); }
  const pedidoDia = e.target.closest("[data-dia-pedido]");
  if (pedidoDia && diaCaixa?.dados) return abrirPedido(null, diaCaixa.dados.pedidos.find((p) => p.num === Number(pedidoDia.dataset.diaPedido)));
  const comandaDia = e.target.closest("[data-dia-comanda], [data-dia-comanda-mesa]");
  if (comandaDia && diaCaixa?.dados) {
    const [mesa, aberta] = (comandaDia.dataset.diaComandaMesa || "").split("|").map(Number);
    const c = diaCaixa.dados.comandas.find((x) => (comandaDia.dataset.diaComanda ? x.numero === Number(comandaDia.dataset.diaComanda) : x.mesa === mesa && x.abertaEm === aberta));
    return c && abrirComandaFechada(c.numero, c, diaCaixa.dados.caixa.movimentos);
  }
  const filtro = e.target.closest("[data-filtro-caixa]");
  if (filtro) { filtroCaixa = filtro.dataset.filtroCaixa; return renderCaixa(); }
  const forma = e.target.closest("[data-filtro-forma]");
  if (forma) { filtroForma = forma.dataset.filtroForma; return renderCaixa(); }
  const verComanda = e.target.closest("[data-ver-comanda]");
  if (verComanda) return abrirComandaFechada(Number(verComanda.dataset.verComanda));
  if (e.target.closest("[data-abrir-caixa]")) return janelaAbrir();
  if (e.target.closest("[data-fechar-caixa]")) return janelaFechar();
  /* data-troco-bolsa / data-conferir-bolsa = "motoboy|Nome" ou "garcom|Nome" */
  const troco = e.target.closest("[data-troco-bolsa]");
  if (troco) { const [tipo, ...n] = troco.dataset.trocoBolsa.split("|"); return janelaTrocoBolsa(tipo, n.join("|")); }
  const bolsa = e.target.closest("[data-conferir-bolsa]");
  if (bolsa) { const [tipo, ...n] = bolsa.dataset.conferirBolsa.split("|"); return janelaConferirBolsa(tipo, n.join("|")); }
  const redividir = e.target.closest("[data-redividir]");
  if (redividir) return janelaRedividir(Number(redividir.dataset.redividir));
  const corrigir = e.target.closest("[data-corrigir]");
  if (corrigir) return janelaCorrigir(corrigir.dataset.corrigir);
  const historico = e.target.closest("[data-historico]");
  if (historico) return janelaHistorico(historico.dataset.historico);
  const mov = e.target.closest("[data-movimento]");
  if (mov) janelaMovimento(mov.dataset.movimento);
});

/* Lembra quais cartões de movimentação estão abertos (a tela se atualiza sozinha) */
document.addEventListener("toggle", (e) => {
  const d = e.target;
  if (!d.matches?.("details.mov")) return;
  if (d.open) abertosCaixa.add(d.dataset.mov); else abertosCaixa.delete(d.dataset.mov);
}, true);

/* Tocar em Caixa no menu volta sempre para o caixa de hoje */
document.addEventListener("click", (e) => { if (e.target.closest('.menu__item[data-secao="caixa"]')) diaCaixa = null; }, true);
