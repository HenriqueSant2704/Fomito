/* ==========================================================================
   FOMITO · PAINEL › CAIXA
   --------------------------------------------------------------------------
   Carregado antes do painel.js. Usa compartilhado/js/caixa.js.
     1. Tela do caixa (aberto ou fechado)
     2. Janelas: abrir caixa, sangria / suprimento, fechar caixa
     3. Cliques

   De onde vêm as entradas:
     • conta da mesa fechada pelo garçom (com recebido e troco)
     • entrega concluída no quadro de Pedidos (o entregador acertou)
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

/* ---------- 1. TELA DO CAIXA ---------- */
function renderCaixa() {
  const { aberto, fechamentos } = Fomito.caixa.estado();
  $('[data-secao="caixa"].secao').innerHTML = `
    ${aberto ? caixaAberto(aberto) : caixaFechado(fechamentos[0])}
    <div class="card painel-card">
      <div class="painel-card__topo"><h3>Fechamentos anteriores</h3><span class="pequeno fraco">Conferência do dinheiro na gaveta</span></div>
      <div class="tabela-rolagem">
        <table class="tabela">
          <thead><tr><th>Dia</th><th>Período</th><th class="dir">Vendas</th><th class="dir">Dinheiro esperado</th><th class="dir">Contado</th><th>Resultado</th><th>Fechado por</th></tr></thead>
          <tbody>
            ${fechamentos.map((f) => `
              <tr>
                <td class="forte" style="text-transform:capitalize">${dataCaixa(f.abertoEm)}</td>
                <td class="num suave">${horaCaixa(f.abertoEm)} – ${horaCaixa(f.fechadoEm)}</td>
                <td class="dir num">${moeda(f.vendas)}</td>
                <td class="dir num">${moeda(f.esperado)}</td>
                <td class="dir num">${moeda(f.contado)}</td>
                <td>${tagDiferenca(f.contado, f.esperado)}${f.obs ? `<div class="pequeno fraco">${f.obs}</div>` : ""}</td>
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
  const filtros = [["todas", "Todas"], ["dinheiro", "Dinheiro"], ["pix", "Pix"], ["cartao", "Cartões"], ["saidas", "Sangria e suprimento"]];
  const passa = (m) => filtroCaixa === "todas"
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
        <span class="pequeno suave">Desde ${horaCaixa(cx.abertoEm)} · aberto por ${cx.por} · fundo de troco ${moeda(cx.fundo)}</span>
      </div>
      <div class="linha" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn--contorno btn--sm" data-movimento="suprimento">${icone("mais", "ic--sm")} Suprimento</button>
        <button class="btn btn--contorno btn--sm" data-movimento="sangria">${icone("menos", "ic--sm")} Sangria</button>
        <button class="btn btn--primario btn--sm" data-fechar-caixa>${icone("cadeado", "ic--sm")} Fechar caixa</button>
      </div>
    </div>

    <div class="kpis">
      <div class="card kpi"><div class="kpi__rotulo">Vendas no caixa${icone("moeda")}</div><div class="kpi__valor">${moeda(r.vendas)}</div><span class="variacao">${r.qtdVendas} pagamentos recebidos</span></div>
      <div class="card kpi kpi--destaque"><div class="kpi__rotulo">Dinheiro na gaveta${icone("dinheiro")}</div><div class="kpi__valor">${moeda(r.esperado)}</div><span class="variacao">esperado agora</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Pix${icone("pix")}</div><div class="kpi__valor">${moeda(r.porForma.pix)}</div><span class="variacao">cai direto na conta</span></div>
      <div class="card kpi"><div class="kpi__rotulo">Cartões${icone("cartao")}</div><div class="kpi__valor">${moeda(cartoes)}</div><span class="variacao">crédito ${moeda(r.porForma.credito)} · débito ${moeda(r.porForma.debito)}</span></div>
    </div>

    <div class="grade-caixa">
        <div class="card painel-card">
          <h3>Conferência da gaveta</h3>
          <div class="conferencia">
            <div class="entre"><span>Fundo de troco</span><span class="num">${moeda(cx.fundo)}</span></div>
            <div class="entre"><span>+ Vendas em dinheiro</span><span class="num">${moeda(r.porForma.dinheiro)}</span></div>
            <div class="entre"><span>+ Suprimentos</span><span class="num">${moeda(r.suprimentos)}</span></div>
            <div class="entre"><span>− Sangrias</span><span class="num valor-saida">${moeda(r.sangrias)}</span></div>
            <div class="entre conferencia__total"><span>Esperado na gaveta</span><span class="num">${moeda(r.esperado)}</span></div>
          </div>
          <p class="pequeno fraco">Troco devolvido hoje: ${moeda(r.troco)} (já descontado das vendas em dinheiro).</p>
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
            <thead><tr><th>Hora</th><th>Descrição</th><th>Forma</th><th class="dir">Recebido</th><th class="dir">Troco</th><th class="dir">Valor</th></tr></thead>
            <tbody>
              ${lista.map((m) => {
                const saida = m.tipo === "sangria";
                const entradaGaveta = m.tipo === "suprimento";
                const tipo = { comanda: ["Mesa", "roxo"], entrega: ["Entrega", "cinza"], sangria: ["Sangria", "vermelho"], suprimento: ["Suprimento", "amarelo"], balcao: ["Balcão", "cinza"] }[m.tipo];
                return `
                  <tr>
                    <td class="num suave">${horaCaixa(m.hora)}</td>
                    <td><div class="forte">${m.ref}</div><div class="linha pequeno suave" style="gap:6px"><span class="tag tag--${tipo[1]}">${tipo[0]}</span>${m.por}</div></td>
                    <td class="suave" style="white-space:nowrap">${saida || entradaGaveta ? "Dinheiro" : curtas[m.forma]}</td>
                    <td class="dir num suave">${m.recebido ? moeda(m.recebido) : "-"}</td>
                    <td class="dir num suave">${m.troco ? moeda(m.troco) : "-"}</td>
                    <td class="dir num forte ${saida ? "valor-saida" : ""}">${saida ? "− " : ""}${moeda(m.valor)}</td>
                  </tr>`;
              }).join("") || `<tr><td colspan="6" class="suave" style="text-align:center;padding:24px">Nenhuma movimentação neste filtro.</td></tr>`}
            </tbody>
          </table>
        </div>
    </div>`;
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
  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return camada.remove();
    if (e.target.closest("[data-ok]") && aoConfirmar(camada) !== false) { camada.remove(); renderCaixa(); }
  });
  camada.addEventListener("input", () => { $("#erroCaixa", camada).hidden = true; aoDigitar?.(camada); });
}

function janelaAbrir() {
  janelaCaixa("Abrir caixa", `
    <p class="suave pequeno">Conte o dinheiro que fica na gaveta para dar troco no começo do dia.</p>
    <div class="campo"><label for="fundo">Fundo de troco <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="fundo" class="input" inputmode="decimal" value="150,00"></div></div>
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("check", "ic--sm")} Abrir caixa</button>`,
  (c) => {
    const fundo = formatoDinheiro($("#fundo", c).value);
    if ($("#fundo", c).value.trim() === "") { $("#erroCaixa", c).textContent = "Informe o fundo de troco (pode ser R$ 0,00)."; $("#erroCaixa", c).hidden = false; return false; }
    Fomito.caixa.abrir({ fundo, por: usuarioLogado?.nome || "Administrador" });
    toast(`Caixa aberto com ${moeda(fundo)} de troco`, "dinheiro");
  });
}

function janelaMovimento(tipo) {
  const sangria = tipo === "sangria";
  const motivos = sangria ? ["Retirada para o cofre", "Pagamento de fornecedor", "Pagamento de entregador", "Outro"] : ["Reforço de troco", "Moedas", "Outro"];
  const disponivel = Fomito.caixa.resumo(Fomito.caixa.aberto()).esperado;
  janelaCaixa(sangria ? "Sangria (retirar dinheiro)" : "Suprimento (colocar dinheiro)", `
    <p class="suave pequeno">${sangria ? `Dinheiro que sai da gaveta. Hoje há ${moeda(disponivel)} esperados na gaveta.` : "Dinheiro que entra na gaveta sem ser venda, como reforço de troco."}</p>
    <div class="campo"><label for="valorMov">Valor <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="valorMov" class="input" inputmode="decimal" placeholder="0,00"></div></div>
    <div class="campo"><label for="motivoMov">Motivo</label><select id="motivoMov" class="input">${motivos.map((m) => `<option>${m}</option>`).join("")}</select></div>
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("check", "ic--sm")} Registrar ${sangria ? "sangria" : "suprimento"}</button>`,
  (c) => {
    const valor = formatoDinheiro($("#valorMov", c).value);
    const erro = (t) => { $("#erroCaixa", c).textContent = t; $("#erroCaixa", c).hidden = false; return false; };
    if (valor <= 0) return erro("Informe o valor.");
    if (sangria && valor > disponivel) return erro(`Não há ${moeda(valor)} na gaveta (esperado: ${moeda(disponivel)}).`);
    Fomito.caixa.registrar({ tipo, ref: $("#motivoMov", c).value, forma: "dinheiro", valor, por: usuarioLogado?.nome || "Administrador" });
    toast(`${sangria ? "Sangria" : "Suprimento"} de ${moeda(valor)} registrado`, "dinheiro");
  });
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
      <div class="entre"><span>Fundo + dinheiro − sangrias + suprimentos</span><span></span></div>
      <div class="entre conferencia__total"><span>Esperado na gaveta</span><span class="num">${moeda(r.esperado)}</span></div>
    </div>
    <div class="campo"><label for="contado">Dinheiro contado na gaveta <span class="obrigatorio">*</span></label><div class="campo-moeda"><span>R$</span><input id="contado" class="input" inputmode="decimal" placeholder="0,00"></div></div>
    <div id="diferencaCaixa">${`<div class="troco-painel">${icone("info", "ic--sm")} Conte o dinheiro da gaveta e digite o valor.</div>`}</div>
    <div class="campo"><label for="obsCaixa">Observação <span class="fraco">(obrigatória se não bater)</span></label><input id="obsCaixa" class="input" placeholder="Ex.: troco errado na mesa 5"></div>
    <p class="form-erro" id="erroCaixa" hidden></p>
    <button class="btn btn--primario btn--bloco" data-ok>${icone("cadeado", "ic--sm")} Fechar caixa</button>`,
  (c) => {
    const campo = $("#contado", c);
    const erro = (t) => { $("#erroCaixa", c).textContent = t; $("#erroCaixa", c).hidden = false; return false; };
    if (campo.value.trim() === "") return erro("Informe quanto dinheiro tem na gaveta.");
    const contado = formatoDinheiro(campo.value);
    const obs = $("#obsCaixa", c).value.trim();
    if (Math.abs(contado - r.esperado) >= 0.005 && !obs) return erro("O valor não bateu: escreva uma observação.");
    Fomito.caixa.fechar({ contado, obs, por: usuarioLogado?.nome || "Administrador" });
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
  const mov = e.target.closest("[data-movimento]");
  if (mov) janelaMovimento(mov.dataset.movimento);
});
