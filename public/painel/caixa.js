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
const formatoDinheiro = (texto) => parseFloat(String(texto).replace(/\./g, "").replace(",", ".")) || 0;
const horaCaixa = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dataCaixa = (ts) => new Date(ts).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

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
  $('[data-secao="caixa"].secao').innerHTML = `
    ${aberto ? caixaAberto(aberto) : caixaFechado(fechamentos[0])}
    <div class="card painel-card">
      <div class="painel-card__topo"><h3>Fechamentos anteriores</h3><span class="pequeno fraco">Conferência do dinheiro na gaveta</span></div>
      <div class="tabela-rolagem">
        <table class="tabela">
          <thead><tr><th>Dia</th><th>Período</th><th class="dir">Vendas</th><th class="dir">Deveria ter</th><th class="dir">Contado</th><th>Resultado</th><th>Fechado por</th></tr></thead>
          <tbody>
            ${fechamentos.map((f) => `
              <tr>
                <td class="forte" style="text-transform:capitalize">${dataCaixa(f.abertoEm)}</td>
                <td class="num suave">${horaCaixa(f.abertoEm)} – ${horaCaixa(f.fechadoEm)}</td>
                <td class="dir num">${moeda(f.vendas)}</td>
                <td class="dir num">${moeda(f.esperado)}</td>
                <td class="dir num">${moeda(f.contado)}</td>
                <td>${tagDiferenca(f.contado, f.esperado)}${f.correcoes ? ` <span class="tag tag--amarelo">${f.correcoes} ${f.correcoes > 1 ? "correções" : "correção"}</span>` : ""}${f.obs ? `<div class="pequeno fraco">${f.obs}</div>` : ""}</td>
                <td class="suave">${f.por}</td>
              </tr>`).join("") || `<tr><td colspan="7" class="suave" style="text-align:center;padding:24px">Nenhum fechamento ainda.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* Iniciais para o círculo do nome: "João Pereira" → "JP" */
const iniciaisCaixa = (nome) => String(nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const escAttr = (t) => String(t).replace(/"/g, "&quot;");
const ICONE_FORMA = { dinheiro: "dinheiro", pix: "pix", credito: "cartao", debito: "cartao" };
const CURTAS = { dinheiro: "Dinheiro", pix: "Pix", credito: "Crédito", debito: "Débito" };

/* Bolsa de cada motoboy: separada da gaveta do balcão (troco + dinheiro das entregas) */
function blocoBolsas(r, cx) {
  const motoboys = Fomito.sessao.usuarios().filter((u) => u.perfil === "motoboy").map((u) => u.nome);
  const nomes = [...new Set([...motoboys, ...Object.keys(r.bolsas || {})])];
  if (!nomes.length) return "";
  return `
    <div class="card painel-card">
      <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>Bolsas dos motoboys</h3><span class="pequeno suave">O troco e o dinheiro das entregas ficam com cada motoboy, separados da gaveta do balcão.</span></div></div>
      <div class="bolsas">
        ${nomes.map((nome) => {
          const b = r.bolsas?.[nome];
          const n = escAttr(nome);
          if (!b) return `
            <div class="bolsa-card bolsa-card--vazia">
              <div class="bolsa-card__topo"><span class="avatar-mini">${iniciaisCaixa(nome)}</span><div class="pilha" style="gap:0;flex:1;min-width:0"><span class="forte">${nome}</span><span class="pequeno fraco">Sem bolsa hoje</span></div></div>
              <button class="btn btn--contorno btn--sm btn--bloco" data-troco-motoboy="${n}">${icone("mais", "ic--sm")} Abrir bolsa com troco</button>
            </div>`;
          const emDinheiro = cx.movimentos.filter((m) => m.tipo === "entrega" && m.por === nome && m.forma === "dinheiro").length;
          const f = b.fechamento;
          return `
            <div class="bolsa-card">
              <div class="bolsa-card__topo">
                <span class="avatar-mini">${iniciaisCaixa(nome)}</span>
                <div class="pilha" style="gap:0;flex:1;min-width:0"><span class="forte">${nome}</span><span class="pequeno fraco">${b.entregas} entrega${b.entregas === 1 ? "" : "s"} · ${emDinheiro} em dinheiro</span></div>
                ${f ? tagDiferenca(f.contado, f.esperado) : `<span class="tag tag--cinza">A conferir</span>`}
              </div>
              <div class="conferencia">
                <div class="entre"><span>Troco inicial</span><span class="num">${moeda(b.fundo)}</span></div>
                <div class="entre"><span>+ Notas que os clientes deram</span><span class="num">${moeda(b.recebido)}</span></div>
                <div class="entre"><span>− Troco devolvido</span><span class="num valor-saida">${moeda(b.troco)}</span></div>
                <div class="entre conferencia__total"><span>Deve ter na bolsa</span><span class="num">${moeda(b.esperado)}</span></div>
              </div>
              ${f ? `
                <div class="conferencia conferencia--feita">
                  <div class="entre"><span>Contado</span><span class="num">${moeda(f.contado)}</span></div>
                  <div class="entre"><span>Ficou de troco para amanhã</span><span class="num">${moeda(f.ficaParaAmanha || 0)}</span></div>
                  <div class="entre forte"><span>Entregou no caixa</span><span class="num">${moeda(f.contado - (f.ficaParaAmanha || 0))}</span></div>
                </div>
                <span class="pequeno fraco">Conferida por ${f.por} às ${horaCaixa(f.em)}${f.obs ? ` · “${f.obs}”` : ""}</span>`
              : `<div class="linha" style="gap:8px"><button class="btn btn--contorno btn--sm" data-troco-motoboy="${n}">Ajustar troco</button><button class="btn btn--primario btn--sm" style="flex:1" data-conferir-bolsa="${n}">${icone("check", "ic--sm")} Conferir bolsa</button></div>`}
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

async function janelaTrocoMotoboy(nome) {
  const atual = Fomito.caixa.resumo(Fomito.caixa.aberto()).bolsas?.[nome]?.fundo || 0;
  const r = await Fomito.dialogo({
    titulo: `Troco do ${nome}`,
    texto: "Quanto em dinheiro o motoboy leva na bolsa para dar troco. Sai separado da gaveta do balcão.",
    campos: [{ id: "fundo", rotulo: "Troco na bolsa (R$)", tipo: "moeda", valor: String(atual).replace(".", ","), obrigatorio: true }],
    confirmar: "Salvar troco",
  });
  if (!r) return;
  await Fomito.acao("POST", "/caixa/motoboy", { nome, fundo: formatoDinheiro(r.fundo) });
  renderCaixa();
  toast(`Troco do ${nome}: ${moeda(formatoDinheiro(r.fundo))}`, "dinheiro");
}

/* Conferência da bolsa: a mesma organização da gaveta, com as entregas em dinheiro e a diferença na hora */
function janelaConferirBolsa(nome) {
  const cx = Fomito.caixa.aberto();
  const b = Fomito.caixa.resumo(cx).bolsas?.[nome] || { esperado: 0, fundo: 0, recebido: 0, troco: 0 };
  const entregas = cx.movimentos.filter((m) => m.tipo === "entrega" && m.por === nome && m.forma === "dinheiro");
  const outras = cx.movimentos.filter((m) => m.tipo === "entrega" && m.por === nome && m.forma !== "dinheiro");
  const resultado = (c) => {
    const campo = $("#contadoBolsa", c);
    if (campo.value.trim() === "") return `<div class="troco-painel">${icone("info", "ic--sm")} Conte o dinheiro da bolsa e digite o valor.</div>`;
    const contado = formatoDinheiro(campo.value);
    const fica = Math.min(contado, formatoDinheiro($("#ficaBolsa", c).value));
    const d = Math.round((contado - b.esperado) * 100) / 100;
    return `${Math.abs(d) < 0.005
      ? `<div class="diferenca diferenca--ok"><span>Bateu certinho</span><strong>${moeda(0)}</strong></div>`
      : `<div class="diferenca ${d < 0 ? "diferenca--falta" : "diferenca--sobra"}"><span>${d < 0 ? "Está faltando" : "Está sobrando"}</span><strong>${moeda(Math.abs(d))}</strong></div>`}
      <div class="conferencia"><div class="entre forte"><span>Entrega no caixa agora</span><span class="num">${moeda(contado - fica)}</span></div>${fica ? `<div class="entre pequeno suave"><span>Fica com ele de troco</span><span class="num">${moeda(fica)}</span></div>` : ""}</div>`;
  };
  janelaCaixa(`Conferir a bolsa do ${nome}`, `
    <div class="conferencia">
      <div class="entre"><span>Troco inicial</span><span class="num">${moeda(b.fundo)}</span></div>
      <div class="entre"><span>+ Notas que os clientes deram</span><span class="num">${moeda(b.recebido)}</span></div>
      <div class="entre"><span>− Troco devolvido</span><span class="num valor-saida">${moeda(b.troco)}</span></div>
      <div class="entre conferencia__total"><span>Deve ter na bolsa</span><span class="num">${moeda(b.esperado)}</span></div>
    </div>
    ${entregas.length ? `
      <div class="pilha" style="gap:6px">
        <span class="rotulo">Entregas em dinheiro (${entregas.length})</span>
        <div class="lista-bolsa">
          ${entregas.map((m) => `
            <div class="entre pequeno"><span><b>${m.ref.split(" · ")[0]}</b> <span class="fraco">${horaCaixa(m.hora)}</span><br><span class="fraco">deu ${moeda(m.recebido ?? m.valor)} · troco ${moeda(m.troco || 0)}</span></span><span class="num forte">${moeda(m.valor)}</span></div>`).join("")}
        </div>
      </div>` : ""}
    ${outras.length ? `<p class="pequeno fraco">${outras.length} entrega${outras.length > 1 ? "s" : ""} no Pix ou cartão (${moeda(outras.reduce((s, m) => s + m.valor, 0))}) não passa${outras.length > 1 ? "m" : ""} pela bolsa.</p>` : ""}
    <div class="campo"><label for="contadoBolsa">Dinheiro contado na bolsa <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="contadoBolsa" class="input" inputmode="decimal" placeholder="0,00"></div></div>
    <div class="campo"><label for="ficaBolsa">Fica com ele de troco para amanhã</label><div class="campo-moeda"><span>R$</span><input id="ficaBolsa" class="input" inputmode="decimal" value="0,00"></div></div>
    <div id="resultadoBolsa" class="pilha" style="gap:8px">${`<div class="troco-painel">${icone("info", "ic--sm")} Conte o dinheiro da bolsa e digite o valor.</div>`}</div>
    <div class="campo"><label for="obsBolsa">Observação <span class="fraco">(obrigatória se não bater)</span></label><input id="obsBolsa" class="input" maxlength="300" placeholder="Ex.: troco errado no pedido #1004"></div>
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("check", "ic--sm")} Conferir bolsa</button>`,
  async (c) => {
    const erro = (t) => { $("#erroCaixa", c).textContent = t; $("#erroCaixa", c).hidden = false; return false; };
    if ($("#contadoBolsa", c).value.trim() === "") return erro("Informe quanto dinheiro tem na bolsa.");
    const contado = formatoDinheiro($("#contadoBolsa", c).value);
    const obs = $("#obsBolsa", c).value.trim();
    if (Math.abs(contado - b.esperado) >= 0.005 && !obs) return erro("O valor não bateu: escreva uma observação.");
    try { await Fomito.acao("POST", "/caixa/motoboy/fechar", { nome, contado, fica: formatoDinheiro($("#ficaBolsa", c).value), obs }); }
    catch (err) { return erro(err.message); }
    toast(Math.abs(contado - b.esperado) < 0.005 ? `Bolsa do ${nome} bateu` : `Bolsa do ${nome} conferida com diferença`, "check");
  },
  (c) => { $("#resultadoBolsa", c).innerHTML = resultado(c); });
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
};
let filtroForma = "todas";
const abertosCaixa = new Set(); // cartões de movimentação abertos (continuam abertos ao atualizar a tela)

function gruposMovimentos(movimentos) {
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
    g.gaveta = g.movs.reduce((s, m) => s + (m.tipo === "sangria" ? -m.valor : m.tipo === "suprimento" ? m.valor : m.forma === "dinheiro" && m.tipo !== "entrega" ? m.valor : 0), 0);
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
  if (g.tipo === "entrega" && g.formas.includes("dinheiro")) return `na bolsa do ${String(m.por).split(" ")[0]}`;
  if (g.gaveta) return `<span class="valor-entrada">+ ${moeda(g.gaveta)} na gaveta</span>`;
  return "cai na conta";
}

function cartaoMovimento(g) {
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
              <span class="forte">${g.movs.length > 1 ? `${g.tipo === "comanda" ? "Pessoa" : "Pagamento"} ${i + 1} · ` : ""}${gaveta ? "Dinheiro" : Fomito.caixa.FORMAS[m.forma]}</span>
              <span class="pequeno fraco">${m.forma === "dinheiro" && !gaveta ? `Deu ${moeda(m.recebido ?? m.valor)} · troco ${moeda(m.troco || 0)} · ` : ""}${horaCaixa(m.hora)} · ${m.por}</span>
              ${m.correcoes?.length ? `<button class="mov-pag__corr" data-historico="${m.id}">${icone("editar", "ic--sm")} Ver a correção</button>` : ""}
            </span>
            <span class="num forte">${moeda(m.valor)}</span>
            <button class="btn-icone btn-icone--sm" data-corrigir="${m.id}" aria-label="Corrigir este pagamento" title="Corrigir">${icone("editar", "ic--sm")}</button>
          </div>`).join("")}
        ${g.tipo === "comanda" && g.comanda ? `
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
  const nomes = { ...Fomito.caixa.FORMAS };
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
  const vendasBolsas = r.dinheiroEntregas || 0;
  const bolsaRec = Object.values(r.bolsas || {}).reduce((s, b) => s + b.recebido, 0);
  const bolsaTroco = Object.values(r.bolsas || {}).reduce((s, b) => s + b.troco, 0);
  const qtdBolsas = cx.movimentos.filter((m) => m.tipo === "entrega" && m.forma === "dinheiro").length;
  const salao = cx.movimentos.filter((m) => m.tipo === "comanda" || m.tipo === "balcao").reduce((s, m) => s + m.valor, 0);
  const entregas = cx.movimentos.filter((m) => m.tipo === "entrega").reduce((s, m) => s + m.valor, 0);

  return `
    <div class="card caixa-status">
      <span class="caixa-status__icone">${icone("dinheiro")}</span>
      <div class="pilha" style="gap:2px;flex:1;min-width:0">
        <span class="linha" style="gap:8px"><b>Caixa aberto</b><span class="tag tag--verde">Aberto</span></span>
        <span class="pequeno suave">Desde ${horaCaixa(cx.abertoEm)} · aberto por ${cx.por} · dinheiro inicial ${moeda(cx.fundo)}</span>
      </div>
      <div class="linha" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn--contorno btn--sm" data-movimento="suprimento">${icone("mais", "ic--sm")} Colocar dinheiro</button>
        <button class="btn btn--contorno btn--sm" data-movimento="sangria">${icone("menos", "ic--sm")} Tirar dinheiro</button>
        <button class="btn btn--primario btn--sm" data-fechar-caixa>${icone("cadeado", "ic--sm")} Fechar caixa</button>
      </div>
    </div>

    ${blocoBolsas(r, cx)}

    <div class="kpis kpis--caixa">
      <div class="card kpi"><div class="kpi__rotulo">Vendas do dia${icone("moeda")}</div><div class="kpi__valor">${moeda(r.vendas)}</div><span class="variacao">salão e balcão ${moeda(salao)} · entregas ${moeda(entregas)}</span></div>
      <div class="card kpi kpi--destaque"><div class="kpi__rotulo">Dinheiro na gaveta${icone("dinheiro")}</div><div class="kpi__valor">${moeda(r.esperado)}</div><span class="variacao">é o que deveria ter agora</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Vendas nas bolsas${icone("entrega")}</div><div class="kpi__valor">${moeda(vendasBolsas)}</div><span class="variacao">${qtdBolsas} entrega${qtdBolsas === 1 ? "" : "s"} em dinheiro, com os motoboys</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Pix${icone("pix")}</div><div class="kpi__valor">${moeda(r.porForma.pix)}</div><span class="variacao">cai direto na conta</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Cartões${icone("cartao")}</div><div class="kpi__valor">${moeda(cartoes)}</div><span class="variacao">crédito ${moeda(r.porForma.credito)} · débito ${moeda(r.porForma.debito)}</span></div>
    </div>

    <div class="grade-caixa">
        <div class="card painel-card">
          <div class="pilha" style="gap:2px"><h3>Dinheiro na gaveta</h3><span class="pequeno suave">Como o sistema chega no valor que deveria ter</span></div>
          <div class="conferencia">
            <div class="entre"><span>Dinheiro inicial</span><span class="num">${moeda(cx.fundo)}</span></div>
            <div class="entre"><span>+ Notas que os clientes deram</span><span class="num">${moeda(r.recebidoDinheiro - bolsaRec)}</span></div>
            <div class="entre"><span>− Troco devolvido</span><span class="num valor-saida">${moeda(r.troco - bolsaTroco)}</span></div>
            <div class="entre"><span>+ Dinheiro colocado</span><span class="num">${moeda(r.suprimentos)}</span></div>
            <div class="entre"><span>− Dinheiro tirado</span><span class="num valor-saida">${moeda(r.sangrias)}</span></div>
            <div class="entre conferencia__total"><span>Deveria ter na gaveta</span><span class="num">${moeda(r.esperado)}</span></div>
          </div>
          <p class="pequeno fraco">Ex.: pedido de R$ 100 pago com uma nota de R$ 200. Entram R$ 200, saem R$ 100 de troco e a gaveta fica com +R$ 100. Pix e cartão caem na conta, e o dinheiro das entregas fica na bolsa do motoboy.</p>
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
        <span class="pequeno suave">${ultimo ? `Último fechamento às ${horaCaixa(ultimo.fechadoEm)}: vendas de ${moeda(ultimo.vendas)}, ${tagDiferenca(ultimo.contado, ultimo.esperado).replace(/<[^>]+>/g, "").toLowerCase()} na gaveta.` : "Abra o caixa para começar o dia."} Enquanto estiver fechado, o garçom não consegue receber contas.</span>
      </div>
      <button class="btn btn--primario" data-abrir-caixa>${icone("dinheiro", "ic--sm")} Abrir caixa</button>
    </div>`;
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
      <p class="suave pequeno">Escolha quem sai para entregar hoje e quanto leva de troco. Sai separado da gaveta.</p>
      <div id="bolsasAbrir" class="pilha" style="gap:8px">${linhaBolsa(motoboys.length === 1 ? motoboys[0] : "")}</div>
      <button class="btn btn--contorno btn--sm" data-mais-bolsa style="align-self:flex-start">${icone("mais", "ic--sm")} Abrir bolsa de outro motoboy</button>
    </div>` : ""}
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("check", "ic--sm")} Abrir caixa</button>`,
  async (c) => {
    const erro = (t) => { $("#erroCaixa", c).textContent = t; $("#erroCaixa", c).hidden = false; return false; };
    const fundo = formatoDinheiro($("#fundo", c).value);
    if ($("#fundo", c).value.trim() === "") return erro("Informe o dinheiro inicial (pode ser R$ 0,00).");
    const bolsas = {};
    for (const linha of c.querySelectorAll(".bolsa-linha")) {
      const nome = $("[data-bolsa-nome]", linha).value;
      const valor = formatoDinheiro($("[data-bolsa-valor]", linha).value);
      if (!nome) { if (valor > 0) return erro("Escolha o motoboy de cada bolsa."); continue; }
      if (bolsas[nome] != null) return erro(`${nome} está em duas linhas. Deixe uma só.`);
      bolsas[nome] = valor;
    }
    await Fomito.caixa.abrir({ fundo, motoboys: bolsas });
    const qtd = Object.keys(bolsas).length;
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
    <div class="historico-corr">
      ${m.correcoes.map((c) => `<div class="pequeno"><b>${horaCaixa(c.em)} · corrigido por ${c.por}</b>${mudancas(c).map((t) => `<div>${t}</div>`).join("")}<div class="fraco">Motivo: “${c.motivo}”</div></div>`).join("")}
    </div>
    <button class="btn btn--contorno btn--bloco" data-fechar>Fechar</button>`, () => {});
}

function janelaFechar() {
  const cx = Fomito.caixa.aberto();
  const r = Fomito.caixa.resumo(cx);
  const diferenca = (c) => {
    const campo = $("#contado", c);
    if (campo.value.trim() === "") return `<div class="troco-painel">${icone("info", "ic--sm")} Conte o dinheiro da gaveta e digite o valor.</div>`;
    const d = Math.round((formatoDinheiro(campo.value) - r.esperado) * 100) / 100;
    return Math.abs(d) < 0.005
      ? `<div class="diferenca diferenca--ok"><span>Bateu certinho</span><strong>${moeda(0)}</strong></div>`
      : `<div class="diferenca ${d < 0 ? "diferenca--falta" : "diferenca--sobra"}"><span>${d < 0 ? "Está faltando" : "Está sobrando"}</span><strong>${moeda(Math.abs(d))}</strong></div>`;
  };
  janelaCaixa("Fechar caixa", `
    <div class="conferencia">
      ${Object.entries(r.porForma).map(([f, v]) => `<div class="entre"><span>${Fomito.caixa.FORMAS[f]}</span><span class="num">${moeda(v)}</span></div>`).join("")}
      <div class="entre conferencia__total"><span>Total de vendas</span><span class="num">${moeda(r.vendas)}</span></div>
    </div>
    <div class="conferencia">
      <div class="entre"><span>Dinheiro inicial</span><span class="num">${moeda(cx.fundo)}</span></div>
      <div class="entre"><span>+ Notas recebidas − troco</span><span class="num">${moeda(r.porForma.dinheiro)}</span></div>
      <div class="entre"><span>+ Colocado − tirado</span><span class="num">${moeda(r.suprimentos - r.sangrias)}</span></div>
      <div class="entre conferencia__total"><span>Deveria ter na gaveta</span><span class="num">${moeda(r.esperado)}</span></div>
    </div>
    <div class="campo"><label for="contado">Dinheiro contado na gaveta <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="contado" class="input" inputmode="decimal" placeholder="0,00"></div></div>
    <div id="diferencaCaixa">${`<div class="troco-painel">${icone("info", "ic--sm")} Conte o dinheiro da gaveta e digite o valor.</div>`}</div>
    <div class="campo"><label for="obsCaixa">Observação <span class="fraco">(obrigatória se não bater)</span></label><input id="obsCaixa" class="input" placeholder="Ex.: troco errado na mesa 5"></div>
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("cadeado", "ic--sm")} Fechar caixa</button>`,
  async (c) => {
    const campo = $("#contado", c);
    const erro = (t) => { $("#erroCaixa", c).textContent = t; $("#erroCaixa", c).hidden = false; return false; };
    if (campo.value.trim() === "") return erro("Informe quanto dinheiro tem na gaveta.");
    const contado = formatoDinheiro(campo.value);
    const obs = $("#obsCaixa", c).value.trim();
    if (Math.abs(contado - r.esperado) >= 0.005 && !obs) return erro("O valor não bateu: escreva uma observação.");
    await Fomito.caixa.fechar({ contado, obs });
    toast("Caixa fechado. Relatório do dia salvo.", "cadeado");
  },
  (c) => { $("#diferencaCaixa", c).innerHTML = diferenca(c); $("#erroCaixa", c).hidden = true; });
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
  const filtro = e.target.closest("[data-filtro-caixa]");
  if (filtro) { filtroCaixa = filtro.dataset.filtroCaixa; return renderCaixa(); }
  const forma = e.target.closest("[data-filtro-forma]");
  if (forma) { filtroForma = forma.dataset.filtroForma; return renderCaixa(); }
  const verComanda = e.target.closest("[data-ver-comanda]");
  if (verComanda) return abrirComandaFechada(Number(verComanda.dataset.verComanda));
  if (e.target.closest("[data-abrir-caixa]")) return janelaAbrir();
  if (e.target.closest("[data-fechar-caixa]")) return janelaFechar();
  const trocoMoto = e.target.closest("[data-troco-motoboy]");
  if (trocoMoto) return janelaTrocoMotoboy(trocoMoto.dataset.trocoMotoboy);
  const bolsa = e.target.closest("[data-conferir-bolsa]");
  if (bolsa) return janelaConferirBolsa(bolsa.dataset.conferirBolsa);
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
