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

function caixaAberto(cx) {
  const r = Fomito.caixa.resumo(cx);
  const nomes = { ...Fomito.caixa.FORMAS };
  const curtas = { dinheiro: "Dinheiro", pix: "Pix", credito: "Crédito", debito: "Débito" };
  const cartoes = r.porForma.credito + r.porForma.debito;
  const correcoes = Fomito.caixa.correcoes(cx);
  const filtros = [["todas", "Todas"], ["dinheiro", "Dinheiro"], ["pix", "Pix"], ["cartao", "Cartões"], ["saidas", "Tirado e colocado"], ["corrigidos", `Corrigidos${correcoes.length ? ` (${correcoes.length})` : ""}`]];
  const passa = (m) => filtroCaixa === "todas"
    || (filtroCaixa === "corrigidos" && m.correcoes?.length)
    || (filtroCaixa === "saidas" ? ["sangria", "suprimento"].includes(m.tipo)
      : filtroCaixa === "cartao" ? ["credito", "debito"].includes(m.forma) && !["sangria", "suprimento"].includes(m.tipo)
      : m.forma === filtroCaixa && !["sangria", "suprimento"].includes(m.tipo));
  const lista = [...cx.movimentos].reverse().filter(passa);
  const abertas = Fomito.comandas.abertas();

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

    <div class="kpis">
      <div class="card kpi"><div class="kpi__rotulo">Vendas no caixa${icone("moeda")}</div><div class="kpi__valor">${moeda(r.vendas)}</div><span class="variacao">${r.qtdVendas} pagamentos recebidos</span></div>
      <div class="card kpi kpi--destaque"><div class="kpi__rotulo">Dinheiro na gaveta${icone("dinheiro")}</div><div class="kpi__valor">${moeda(r.esperado)}</div><span class="variacao">é o que deveria ter agora</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Pix${icone("pix")}</div><div class="kpi__valor">${moeda(r.porForma.pix)}</div><span class="variacao">cai direto na conta</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Cartões${icone("cartao")}</div><div class="kpi__valor">${moeda(cartoes)}</div><span class="variacao">crédito ${moeda(r.porForma.credito)} · débito ${moeda(r.porForma.debito)}</span></div>
    </div>

    <div class="grade-caixa">
        <div class="card painel-card">
          <div class="pilha" style="gap:2px"><h3>Dinheiro na gaveta</h3><span class="pequeno suave">Como o sistema chega no valor que deveria ter</span></div>
          <div class="conferencia">
            <div class="entre"><span>Dinheiro inicial</span><span class="num">${moeda(cx.fundo)}</span></div>
            <div class="entre"><span>+ Notas que os clientes deram</span><span class="num">${moeda(r.recebidoDinheiro)}</span></div>
            <div class="entre"><span>− Troco devolvido</span><span class="num valor-saida">${moeda(r.troco)}</span></div>
            <div class="entre"><span>+ Dinheiro colocado</span><span class="num">${moeda(r.suprimentos)}</span></div>
            <div class="entre"><span>− Dinheiro tirado</span><span class="num valor-saida">${moeda(r.sangrias)}</span></div>
            <div class="entre conferencia__total"><span>Deveria ter na gaveta</span><span class="num">${moeda(r.esperado)}</span></div>
          </div>
          <p class="pequeno fraco">Ex.: pedido de R$ 100 pago com uma nota de R$ 200. Entram R$ 200, saem R$ 100 de troco e a gaveta fica com +R$ 100. Pix e cartão caem na conta, não na gaveta.</p>
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
    ${abertas.length ? `<div class="aviso">${icone("mesa", "ic--sm")}<span>${abertas.length} mesas com comanda aberta (${moeda(abertas.reduce((s, c) => s + Fomito.comandas.total(c), 0))}). Entram no caixa quando o garçom fechar a conta.</span></div>` : ""}
    <div class="card painel-card">
        <div class="painel-card__topo" style="flex-wrap:wrap"><h3>Movimentações</h3>
          <nav class="filtros">${filtros.map(([id, nome]) => `<button class="filtro ${filtroCaixa === id ? "ativo" : ""}" data-filtro-caixa="${id}">${nome}</button>`).join("")}</nav></div>
        <div class="tabela-rolagem">
          <table class="tabela">
            <thead><tr><th>Hora</th><th>Descrição</th><th>Forma</th><th class="dir">Valor</th><th class="dir">Cliente deu</th><th class="dir">Troco</th><th class="dir">Na gaveta</th><th><span class="oculto">Corrigir</span></th></tr></thead>
            <tbody>
              ${lista.map((m) => {
                const saida = m.tipo === "sangria";
                const entradaGaveta = m.tipo === "suprimento";
                const tipo = { comanda: ["Mesa", "roxo"], entrega: ["Entrega", "cinza"], sangria: ["Tirado", "vermelho"], suprimento: ["Colocado", "amarelo"], balcao: ["Balcão", "cinza"] }[m.tipo];
                /* Quanto mudou na gaveta: dinheiro entra (já sem o troco), Pix e cartão não */
                const gaveta = saida ? `<span class="valor-saida">− ${moeda(m.valor)}</span>`
                  : entradaGaveta || m.forma === "dinheiro" ? `<span class="valor-entrada">+ ${moeda(m.valor)}</span>`
                  : `<span class="fraco pequeno">na conta</span>`;
                return `
                  <tr>
                    <td class="num suave">${horaCaixa(m.hora)}</td>
                    <td><div class="forte">${m.ref}</div><div class="linha pequeno suave" style="gap:6px;flex-wrap:wrap"><span class="tag tag--${tipo[1]}">${tipo[0]}</span>${m.por}${m.correcoes?.length ? `<button class="tag tag--amarelo" data-historico="${m.id}" title="Ver o histórico da correção">${icone("editar", "ic--sm")}Corrigido</button>` : ""}</div>
                      ${m.correcoes?.length ? `<div class="pequeno fraco">${resumoCorrecao(m.correcoes[m.correcoes.length - 1])}</div>` : ""}</td>
                    <td class="suave" style="white-space:nowrap">${saida || entradaGaveta ? "Dinheiro" : curtas[m.forma]}</td>
                    <td class="dir num">${saida || entradaGaveta ? "-" : moeda(m.valor)}</td>
                    <td class="dir num suave">${m.recebido ? moeda(m.recebido) : m.forma === "dinheiro" && !saida && !entradaGaveta ? moeda(m.valor) : "-"}</td>
                    <td class="dir num suave">${m.troco ? moeda(m.troco) : "-"}</td>
                    <td class="dir num forte" style="white-space:nowrap">${gaveta}</td>
                    <td class="dir"><button class="btn-icone btn-icone--sm" data-corrigir="${m.id}" aria-label="Corrigir ${m.ref}" title="Corrigir">${icone("editar", "ic--sm")}</button></td>
                  </tr>`;
              }).join("") || `<tr><td colspan="8" class="suave" style="text-align:center;padding:24px">Nenhuma movimentação neste filtro.</td></tr>`}
            </tbody>
          </table>
        </div>
        <p class="pequeno fraco">Lançou errado? Use ${icone("editar", "ic--sm")} para corrigir. A correção fica no registro abaixo com o seu nome, e o valor original não é apagado.</p>
    </div>
    ${correcoes.length ? `
      <div class="card painel-card">
        <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>Registro de correções</h3><span class="pequeno suave">Quem lançou, quem corrigiu, o que mudou e por quê. Não pode ser apagado.</span></div><span class="tag tag--amarelo">${correcoes.length} ${correcoes.length > 1 ? "correções" : "correção"}</span></div>
        <div class="tabela-rolagem">
          <table class="tabela">
            <thead><tr><th>Quando</th><th>Pagamento</th><th>Lançado por</th><th>O que mudou</th><th>Motivo</th><th>Corrigido por</th></tr></thead>
            <tbody>
              ${correcoes.map((c) => `
                <tr>
                  <td class="num suave" style="white-space:nowrap">${horaCaixa(c.em)}</td>
                  <td class="forte">${c.movimento.ref}</td>
                  <td class="suave">${c.movimento.por}</td>
                  <td>${mudancas(c).map((t) => `<div class="pequeno">${t}</div>`).join("")}</td>
                  <td class="pequeno">${c.motivo}</td>
                  <td class="suave">${c.por}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>` : ""}`;
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
  janelaCaixa("Abrir caixa", `
    <p class="suave pequeno">Conte o dinheiro que já está na gaveta para dar troco. O sistema começa daqui e vai somando cada pagamento em dinheiro, já descontando o troco.</p>
    <div class="campo"><label for="fundo">Dinheiro inicial na gaveta <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="fundo" class="input" inputmode="decimal" value="150,00"></div></div>
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("check", "ic--sm")} Abrir caixa</button>`,
  async (c) => {
    const fundo = formatoDinheiro($("#fundo", c).value);
    if ($("#fundo", c).value.trim() === "") { $("#erroCaixa", c).textContent = "Informe o dinheiro inicial (pode ser R$ 0,00)."; $("#erroCaixa", c).hidden = false; return false; }
    await Fomito.caixa.abrir({ fundo });
    toast(`Caixa aberto com ${moeda(fundo)} na gaveta`, "dinheiro");
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

/* ---------- 3. CLIQUES ---------- */
document.addEventListener("click", (e) => {
  if (!$('[data-secao="caixa"].secao')?.contains(e.target)) return;
  const filtro = e.target.closest("[data-filtro-caixa]");
  if (filtro) { filtroCaixa = filtro.dataset.filtroCaixa; return renderCaixa(); }
  if (e.target.closest("[data-abrir-caixa]")) return janelaAbrir();
  if (e.target.closest("[data-fechar-caixa]")) return janelaFechar();
  const corrigir = e.target.closest("[data-corrigir]");
  if (corrigir) return janelaCorrigir(corrigir.dataset.corrigir);
  const historico = e.target.closest("[data-historico]");
  if (historico) return janelaHistorico(historico.dataset.historico);
  const mov = e.target.closest("[data-movimento]");
  if (mov) janelaMovimento(mov.dataset.movimento);
});
