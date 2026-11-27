/* ==========================================================================
   FOMITO · PAINEL › CLIENTES (gestão de clientes)
   --------------------------------------------------------------------------
   Carregado antes do painel.js. O cadastro nasce sozinho quando o cliente
   informa o celular no finalizar pedido.
     1. Indicadores, quem mais compra e a lista com segmentos
        (Fiéis, Novos, Ativos, Em risco, Sumidos) e ordenação
     2. Mensagem automática para quem sumiu (WhatsApp)
     3. Ficha do cliente: números, favoritos, histórico, convênio e endereços
   Os números vêm prontos do servidor (src/estado.js › clientesComResumo).
   ========================================================================== */

let buscaClientes = "";
let segmentoClientes = "todos";
let ordemClientes = "gasto";
let rankingPor = "gasto";

const SEGMENTOS = {
  fiel: { nome: "Fiel", plural: "Fiéis", cor: "verde", dica: "3 ou mais pedidos nos últimos 60 dias" },
  novo: { nome: "Novo", plural: "Novos", cor: "roxo", dica: "Primeiro pedido há menos de 30 dias" },
  ativo: { nome: "Ativo", plural: "Ativos", cor: "cinza", dica: "Pede de vez em quando" },
  risco: { nome: "Em risco", plural: "Em risco", cor: "amarelo", dica: "Está demorando mais que o normal para voltar" },
  sumido: { nome: "Sumido", plural: "Sumidos", cor: "vermelho", dica: "Não pede há muito tempo" },
  sem: { nome: "Sem pedido", plural: "Sem pedido", cor: "cinza", dica: "Cadastrou e ainda não pediu" },
};
const ORDENS = {
  gasto: ["Quem mais gasta", (a, b) => b.gasto - a.gasto],
  pedidos: ["Quem mais pede", (a, b) => b.pedidos - a.pedidos],
  recentes: ["Pediu mais recente", (a, b) => (b.ultimoTs || 0) - (a.ultimoTs || 0)],
  sumidos: ["Há mais tempo sem pedir", (a, b) => (b.diasSem ?? -1) - (a.diasSem ?? -1)],
  ticket: ["Maior ticket médio", (a, b) => b.ticket - a.ticket],
};
const escCli = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const tagSegmento = (s) => (SEGMENTOS[s] ? `<span class="tag tag--${SEGMENTOS[s].cor}" title="${SEGMENTOS[s].dica}">${SEGMENTOS[s].nome}</span>` : "");
const frequencia = (c) => (c.intervalo ? `pede a cada ~${c.intervalo} dia${c.intervalo === 1 ? "" : "s"}` : c.pedidos === 1 ? "1 pedido até agora" : "");

/* ---------- 1. TELA ---------- */
function renderClientes() {
  const todos = Fomito.clientes.lista();
  const termo = Fomito.paraBusca(buscaClientes);
  const digitos = Fomito.clientes.soDigitos(buscaClientes);
  const conta = (s) => todos.filter((c) => c.segmento === s).length;
  const lista = todos
    .filter((c) => segmentoClientes === "todos" || (segmentoClientes === "convenio" ? c.convenio?.ativo : c.segmento === segmentoClientes))
    .filter((c) => !termo || Fomito.paraBusca(c.nome).includes(termo) || (digitos && c.telefone.includes(digitos)))
    .sort(ORDENS[ordemClientes][1]);
  const comPedido = todos.filter((c) => c.pedidos);
  const gasto = comPedido.reduce((s, c) => s + c.gasto, 0);
  const pedidosTotal = comPedido.reduce((s, c) => s + c.pedidos, 0);
  const ativos30 = todos.filter((c) => c.diasSem !== null && c.diasSem <= 30).length;
  const novos30 = todos.filter((c) => c.primeiroTs && Date.now() - c.primeiroTs <= 30 * 86400000).length;
  const ranking = [...comPedido].sort(rankingPor === "gasto" ? ORDENS.gasto[1] : ORDENS.pedidos[1]).slice(0, 5);
  const maxRank = ranking[0] ? (rankingPor === "gasto" ? ranking[0].gasto : ranking[0].pedidos) : 1;
  const filtros = [["todos", "Todos", todos.length], ...["fiel", "novo", "ativo", "risco", "sumido", "sem"].map((s) => [s, SEGMENTOS[s].plural, conta(s)]), ["convenio", "Convênio", todos.filter((c) => c.convenio?.ativo).length]].filter(([id, , n]) => id === "todos" || n);

  $('[data-secao="clientes"].secao').innerHTML = `
    <div class="kpis kpis--clientes">
      <div class="card kpi"><span class="kpi__rotulo">Clientes ${icone("pessoas", "ic--sm")}</span><span class="kpi__valor">${todos.length}</span><span class="variacao bom"><b>+${novos30}</b> nos últimos 30 dias</span></div>
      <div class="card kpi"><span class="kpi__rotulo">Ativos ${icone("sobe", "ic--sm")}</span><span class="kpi__valor">${ativos30}</span><span class="variacao">pediram nos últimos 30 dias</span></div>
      <div class="card kpi"><span class="kpi__rotulo">Fiéis ${icone("estrela", "ic--sm")}</span><span class="kpi__valor">${conta("fiel")}</span><span class="variacao">3+ pedidos em 60 dias</span></div>
      <div class="card kpi kpi--destaque"><span class="kpi__rotulo">Para chamar de volta ${icone("sino", "ic--sm")}</span><span class="kpi__valor">${conta("risco") + conta("sumido")}</span><span class="variacao">${conta("risco")} em risco · ${conta("sumido")} sumidos</span></div>
      <div class="card kpi"><span class="kpi__rotulo">Ticket médio ${icone("moeda", "ic--sm")}</span><span class="kpi__valor">${moeda(pedidosTotal ? gasto / pedidosTotal : 0)}</span><span class="variacao">por pedido</span></div>
    </div>

    <div class="duas-colunas">
      <div class="card painel-card">
        <div class="painel-card__topo"><h3>Quem mais compra</h3>
          <nav class="filtros"><button class="filtro ${rankingPor === "gasto" ? "ativo" : ""}" data-ranking="gasto">Gasto</button><button class="filtro ${rankingPor === "pedidos" ? "ativo" : ""}" data-ranking="pedidos">Pedidos</button></nav></div>
        <div class="ranking">
          ${ranking.map((c, i) => {
            const v = rankingPor === "gasto" ? c.gasto : c.pedidos;
            return `
            <div class="ranking__linha linha-clicavel" data-cliente="${c.telefone}">
              <span class="ranking__pos ranking__pos--${i + 1}">${i + 1}</span>
              <div class="pilha" style="gap:4px;flex:1;min-width:0">
                <div class="entre"><span class="forte">${escCli(c.nome)}</span><span class="num forte">${rankingPor === "gasto" ? moeda(v) : `${v} pedido${v === 1 ? "" : "s"}`}</span></div>
                <div class="barra-cat__trilho"><span style="width:${Math.max(4, (v / maxRank) * 100)}%"></span></div>
              </div>
            </div>`;
          }).join("") || `<p class="pequeno fraco">Ainda sem pedidos com celular.</p>`}
        </div>
      </div>
      ${ehAdmin ? cartaoReativacao(conta("sumido")) : ""}
    </div>

    <div class="card painel-card">
      <div class="painel-card__topo" style="flex-wrap:wrap">
        <div class="pilha" style="gap:2px"><h3>Clientes</h3><span class="pequeno suave">${lista.length} de ${todos.length} · toque para ver a ficha</span></div>
        <span class="linha" style="gap:8px;flex-wrap:wrap">
          <label class="busca-painel">${icone("busca", "ic--sm")}<input id="buscaClientes" placeholder="Nome ou telefone" value="${escCli(buscaClientes)}"></label>
          <select class="input input--sm" id="ordemClientes" aria-label="Ordenar">${Object.entries(ORDENS).map(([id, [nome]]) => `<option value="${id}" ${id === ordemClientes ? "selected" : ""}>${nome}</option>`).join("")}</select>
        </span>
      </div>
      <nav class="filtros">${filtros.map(([id, nome, n]) => `<button class="filtro ${segmentoClientes === id ? "ativo" : ""}" data-segmento="${id}">${nome} <small>${n}</small></button>`).join("")}</nav>
      ${segmentoClientes !== "todos" && SEGMENTOS[segmentoClientes] ? `<p class="pequeno suave">${SEGMENTOS[segmentoClientes].dica}.</p>` : ""}
      <div class="lista-clientes">
        ${lista.map((c) => `
          <div class="cliente-linha linha-clicavel" data-cliente="${c.telefone}">
            <span class="avatar" style="width:40px;height:40px;font-size:13px">${iniciais(c.nome)}</span>
            <div class="pilha" style="gap:2px;flex:1;min-width:0">
              <div class="linha" style="gap:6px;flex-wrap:wrap"><span class="forte">${escCli(c.nome)}</span>${tagSegmento(c.segmento)}${c.convenio?.ativo ? `<span class="tag tag--roxo">Convênio</span>` : ""}</div>
              <span class="pequeno suave">${c.pedidos ? `${c.pedidos} pedido${c.pedidos === 1 ? "" : "s"} · ticket ${moeda(c.ticket)}` : "Ainda não pediu"}${c.pedidos ? ` · último: ${c.ultimo.toLowerCase()}` : ""}</span>
              ${frequencia(c) ? `<span class="pequeno fraco">${frequencia(c)}${c.favoritos?.[0] ? ` · gosta de ${escCli(c.favoritos[0].nome)}` : ""}</span>` : ""}
            </div>
            <div class="pilha" style="gap:0;align-items:flex-end"><span class="num forte">${moeda(c.gasto)}</span><span class="pequeno fraco">gasto</span></div>
          </div>`).join("") || `<p class="suave" style="text-align:center;padding:24px">Nenhum cliente neste filtro.</p>`}
      </div>
    </div>`;
}

/* ---------- 2. MENSAGEM PARA QUEM SUMIU ---------- */
function cartaoReativacao(qtdSumidos) {
  const r = Fomito.config.ler().clientes?.reativacao || {};
  const exemplo = (r.texto || "").replace(/\{nome\}/g, "Ana").replace(/\{dias\}/g, r.dias || 30).replace(/\{loja\}/g, Fomito.config.ler().marca.nome);
  return `
    <div class="card painel-card">
      <div class="painel-card__topo">
        <div class="pilha" style="gap:2px"><h3>Chamar de volta quem sumiu</h3><span class="pequeno suave">Mensagem automática no WhatsApp para quem não pede há um tempo.</span></div>
        <label class="interruptor" title="Ligar a mensagem automática"><input type="checkbox" id="rvAtivo" ${r.ativo ? "checked" : ""}><span></span></label>
      </div>
      <div class="form-grade">
        <div class="campo"><label for="rvDias">Sem pedir há (dias)</label><input class="input" id="rvDias" type="number" min="7" max="365" value="${r.dias || 30}"></div>
        <div class="campo"><label for="rvIntervalo">Não repetir antes de (dias)</label><input class="input" id="rvIntervalo" type="number" min="7" max="365" value="${r.intervalo || 30}"></div>
      </div>
      <div class="campo"><label for="rvTexto">Mensagem <span class="fraco">({nome}, {dias} e {loja} são trocados)</span></label><textarea class="input" id="rvTexto" rows="3" maxlength="600">${escCli(r.texto || "")}</textarea></div>
      <div class="balao-whats"><span class="pequeno fraco">Como chega:</span><p id="rvPrevia">${escCli(exemplo)}</p></div>
      <p class="pequeno fraco">Envia de hora em hora, das 10h às 20h, até 15 por vez, pelo WhatsApp conectado da loja. Hoje: ${qtdSumidos} cliente${qtdSumidos === 1 ? "" : "s"} no segmento Sumidos.</p>
      <div class="linha" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn--primario btn--sm" data-salvar-reativacao>${icone("check", "ic--sm")} Salvar</button>
        <button class="btn btn--contorno btn--sm" data-ver-sumidos>${icone("pessoas", "ic--sm")} Quem vai receber</button>
      </div>
    </div>`;
}

async function salvarReativacao() {
  const cfg = Fomito.config.ler();
  cfg.clientes = { ...(cfg.clientes || {}), reativacao: {
    ativo: $("#rvAtivo").checked, dias: Number($("#rvDias").value), intervalo: Number($("#rvIntervalo").value), texto: $("#rvTexto").value,
  } };
  await Fomito.config.salvar(cfg);
  toast(cfg.clientes.reativacao.ativo ? "Mensagem automática ligada" : "Configuração salva (mensagem desligada)", "check");
  renderClientes();
}

async function verSumidos() {
  let r;
  try { r = await Fomito.api("GET", "/clientes/sumidos"); } catch (err) { return toast(err.message, "info"); }
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  camada.innerHTML = `
    <div class="folha" style="max-width:440px;display:flex;flex-direction:column;gap:14px">
      <div class="folha__topo"><div class="pilha" style="gap:0"><h2>Quem vai receber</h2><span class="pequeno suave">${r.total} cliente${r.total === 1 ? "" : "s"} sem pedir e sem mensagem recente</span></div><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
      <div class="lista-rolagem pilha" style="gap:0">
        ${r.lista.map((c) => `<div class="extrato-linha"><span class="forte">${escCli(c.nome)}</span><span class="pequeno suave">há ${c.dias} dias</span></div>`).join("") || `<p class="pequeno fraco">Ninguém para chamar agora.</p>`}
      </div>
      ${r.total ? `<button class="btn btn--primario btn--bloco" data-enviar-sumidos>${icone("whatsapp", "ic--sm")} Enviar agora (até 15)</button>` : `<button class="btn btn--contorno btn--bloco" data-fechar>Fechar</button>`}
    </div>`;
  document.body.appendChild(camada);
  camada.addEventListener("click", async (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return camada.remove();
    const botao = e.target.closest("[data-enviar-sumidos]");
    if (!botao) return;
    botao.disabled = true;
    try {
      const feito = await Fomito.api("POST", "/clientes/sumidos/enviar");
      camada.remove();
      toast(feito.enviados ? `${feito.enviados} mensagem(ns) enviada(s)${feito.faltam ? `. Faltam ${feito.faltam}` : ""}` : (feito.erro || "Nenhuma mensagem enviada"), feito.enviados ? "whatsapp" : "info");
    } catch (err) { toast(err.message, "info"); botao.disabled = false; }
  });
}

/* ---------- 3. FICHA DO CLIENTE ---------- */
async function abrirCliente(telefone) {
  const c = Fomito.clientes.buscar(telefone);
  if (!c) return;
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--lado";
  const conv = c.convenio;
  const desenhar = (historico) => {
    camada.innerHTML = `
    <div class="folha folha--lado">
      <div class="folha__topo">
        <div class="linha" style="gap:12px"><span class="avatar">${iniciais(c.nome)}</span><div class="pilha" style="gap:2px"><h2>${escCli(c.nome)}</h2><span class="linha" style="gap:6px">${tagSegmento(c.segmento)}<span class="pequeno suave">cliente desde ${c.desde}</span></span></div></div>
        <button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button>
      </div>

      <div class="mini-kpis">
        <div><span class="pequeno suave">Pedidos</span><strong>${c.pedidos}</strong></div>
        <div><span class="pequeno suave">Total gasto</span><strong>${moeda(c.gasto)}</strong></div>
        <div><span class="pequeno suave">Ticket médio</span><strong>${moeda(c.ticket)}</strong></div>
        <div><span class="pequeno suave">Último pedido</span><strong>${c.ultimo}</strong></div>
        <div><span class="pequeno suave">Frequência</span><strong>${c.intervalo ? `${c.intervalo} dias` : "—"}</strong></div>
        <div><span class="pequeno suave">Em 60 dias</span><strong>${c.ultimos60 || 0}</strong></div>
      </div>

      ${c.favoritos?.length ? `
      <div class="ficha-bloco">
        <span class="rotulo">O que mais pede</span>
        <div class="linha" style="gap:6px;flex-wrap:wrap">${c.favoritos.map((f) => `<span class="chip-fav">${escCli(f.nome)} <b>${f.qtd}×</b></span>`).join("")}</div>
      </div>` : ""}

      <div class="ficha-bloco">
        <span class="rotulo">Contato</span>
        <div class="entre"><span class="linha" style="gap:8px">${icone("telefone", "ic--sm")}<span class="num">${Fomito.clientes.formatarTelefone(c.telefone)}</span></span>
          <a class="btn btn--contorno btn--sm" href="https://wa.me/55${c.telefone}" target="_blank" rel="noopener">${icone("whatsapp", "ic--sm")} WhatsApp</a></div>
        ${c.reativadoEm ? `<span class="pequeno fraco">Recebeu a mensagem de “sentimos sua falta” em ${new Date(c.reativadoEm).toLocaleDateString("pt-BR")}</span>` : ""}
      </div>

      <div class="ficha-bloco">
        <span class="rotulo">Convênio</span>
        ${conv?.ativo
          ? `<div class="entre"><span class="linha" style="gap:8px">${icone("conta", "ic--sm")}<span>Ativo${conv.empresa ? ` · ${escCli(conv.empresa)}` : ""}${conv.limite ? ` · limite ${moeda(conv.limite)}` : ""}</span></span>${ehAdmin ? `<button class="btn btn--contorno btn--sm" data-ativar-convenio="${c.telefone}">Editar</button>` : ""}</div>`
          : `<div class="entre"><span class="pequeno suave">Compra agora e paga no fechamento do mês.</span>${ehAdmin ? `<button class="btn btn--secundario btn--sm" data-ativar-convenio="${c.telefone}">${icone("mais", "ic--sm")} Ativar convênio</button>` : ""}</div>`}
      </div>

      <div class="ficha-bloco">
        <span class="rotulo">Pedidos (${historico ? historico.length : "..."})</span>
        <div class="lista-rolagem pilha" style="gap:0">
          ${historico === null ? `<p class="pequeno fraco">Carregando...</p>` : historico.map((p) => `
            <div class="extrato-linha">
              <div class="pilha" style="gap:1px;min-width:0"><span class="forte">#${p.num} · ${p.modo === "entrega" ? "Entrega" : p.retirada ? "Retirada" : "Balcão"}</span><span class="pequeno fraco">${new Date(p.em).toLocaleDateString("pt-BR")} · ${escCli(p.itens.slice(0, 3).join(", "))}${p.itens.length > 3 ? "..." : ""}</span></div>
              <span class="pilha" style="gap:2px;align-items:flex-end"><span class="num forte">${moeda(p.total)}</span>${p.status === "cancelado" ? `<span class="tag tag--vermelho">Cancelado</span>` : ""}</span>
            </div>`).join("") || `<p class="pequeno fraco">Nenhum pedido ainda.</p>`}
        </div>
      </div>

      <div class="ficha-bloco">
        <span class="rotulo">Endereços salvos (${c.enderecos.length})</span>
        ${c.enderecos.map((e) => `
          <div class="endereco-ficha">
            <span class="opcao__icone">${icone("pin", "ic--sm")}</span>
            <div class="pilha" style="gap:0"><span class="forte">${escCli(e.apelido)}</span><span class="pequeno suave">${escCli(Fomito.clientes.textoEndereco(e))}${e.ref ? ` · Ref.: ${escCli(e.ref)}` : ""}</span></div>
          </div>`).join("") || `<p class="pequeno fraco">Nenhum endereço salvo.</p>`}
      </div>
    </div>`;
  };
  desenhar(null);
  document.body.appendChild(camada);
  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) camada.remove();
  });
  try { desenhar(await Fomito.api("GET", `/clientes/${c.telefone}/historico`)); } catch { desenhar([]); }
}

/* ---------- Cliques e digitação ---------- */
document.addEventListener("click", (e) => {
  if (!e.target.closest('[data-secao="clientes"].secao')) return;
  const linha = e.target.closest("[data-cliente]");
  if (linha) return abrirCliente(linha.dataset.cliente);
  const seg = e.target.closest("[data-segmento]");
  if (seg) { segmentoClientes = seg.dataset.segmento; return renderClientes(); }
  const rk = e.target.closest("[data-ranking]");
  if (rk) { rankingPor = rk.dataset.ranking; return renderClientes(); }
  if (e.target.closest("[data-salvar-reativacao]")) return salvarReativacao();
  if (e.target.closest("[data-ver-sumidos]")) return verSumidos();
});
document.addEventListener("change", (e) => {
  if (e.target.id === "ordemClientes") { ordemClientes = e.target.value; renderClientes(); }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "rvTexto" || e.target.id === "rvDias") {
    const p = $("#rvPrevia");
    if (p) p.textContent = $("#rvTexto").value.replace(/\{nome\}/g, "Ana").replace(/\{dias\}/g, $("#rvDias").value).replace(/\{loja\}/g, Fomito.config.ler().marca.nome);
    return;
  }
  if (e.target.id !== "buscaClientes") return;
  buscaClientes = e.target.value;
  renderClientes();
  const campo = $("#buscaClientes");
  campo.focus();
  campo.setSelectionRange(campo.value.length, campo.value.length);
});
