/* ==========================================================================
   FOMITO · PAINEL › CLIENTES (gestão de clientes)
   --------------------------------------------------------------------------
   Carregado antes do painel.js. O cadastro nasce sozinho quando o cliente
   informa o celular no finalizar pedido.
     1. Ranking no topo (pódio): quem mais gasta, mais pede ou é mais frequente
     2. Clientes: filtros por segmento (Fiéis, Novos, Em risco, Sumidos, Convênio)
     3. Sumidos: escolher quem recebe a mensagem e a mensagem automática
     4. Ficha do cliente: números, favoritos, histórico, convênio e endereços
   Os números vêm prontos do servidor (src/estado.js › clientesComResumo).
   ========================================================================== */

let buscaClientes = "";
let segmentoClientes = "todos";
let ordemClientes = "gasto";
let rankingPor = "gasto";
let abaSumidos = "sumido";
const selecionadosSumidos = new Set();

const SEGMENTOS = {
  fiel: { nome: "Fiel", plural: "Fiéis", cor: "verde", ponto: "#16A34A", dica: "3 ou mais pedidos nos últimos 60 dias" },
  novo: { nome: "Novo", plural: "Novos", cor: "roxo", ponto: "#7C3AED", dica: "Primeiro pedido há menos de 30 dias" },
  ativo: { nome: "Ativo", plural: "Ativos", cor: "cinza", ponto: "#64748B", dica: "Pede de vez em quando" },
  risco: { nome: "Em risco", plural: "Em risco", cor: "amarelo", ponto: "#D97706", dica: "Está demorando mais que o normal para voltar" },
  sumido: { nome: "Sumido", plural: "Sumidos", cor: "vermelho", ponto: "#DC2626", dica: "Não pede há muito tempo" },
  sem: { nome: "Sem pedido", plural: "Sem pedido", cor: "cinza", ponto: "#94A3B8", dica: "Cadastrou e ainda não pediu" },
};
const ORDENS = {
  gasto: ["Quem mais gasta", (a, b) => b.gasto - a.gasto],
  pedidos: ["Quem mais pede", (a, b) => b.pedidos - a.pedidos],
  recentes: ["Pediu mais recente", (a, b) => (b.ultimoTs || 0) - (a.ultimoTs || 0)],
  sumidos: ["Há mais tempo sem pedir", (a, b) => (b.diasSem ?? -1) - (a.diasSem ?? -1)],
  ticket: ["Maior ticket médio", (a, b) => b.ticket - a.ticket],
};
/* Critérios do ranking: o valor que decide a posição e como ele aparece */
const RANKINGS = {
  gasto: { nome: "gasta", valor: (c) => c.gasto, texto: (c) => moeda(c.gasto), sub: (c) => `${c.pedidos} pedido${c.pedidos === 1 ? "" : "s"}` },
  pedidos: { nome: "pede", valor: (c) => c.pedidos, texto: (c) => `${c.pedidos} pedido${c.pedidos === 1 ? "" : "s"}`, sub: (c) => moeda(c.gasto) },
  frequencia: { nome: "volta", valor: (c) => c.ultimos60 || 0, texto: (c) => `${c.ultimos60 || 0} em 60 dias`, sub: (c) => (c.intervalo ? `a cada ~${c.intervalo} dias` : "1º pedido") },
};
const escCli = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const tagSegmento = (s) => (SEGMENTOS[s] ? `<span class="tag tag--${SEGMENTOS[s].cor}" title="${SEGMENTOS[s].dica}">${SEGMENTOS[s].nome}</span>` : "");
const frequencia = (c) => (c.intervalo ? `pede a cada ~${c.intervalo} dia${c.intervalo === 1 ? "" : "s"}` : c.pedidos === 1 ? "1 pedido até agora" : "");
const primeiroNomeCli = (n) => String(n || "").split(/\s+/)[0];
const COROA = `<svg class="podio__coroa" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5l4.6 3.8L12 5l4.4 7.3L21 8.5 19.2 18H4.8z" fill="currentColor"/><rect x="4.8" y="19" width="14.4" height="2" rx="1" fill="currentColor"/></svg>`;

/* ---------- 1. RANKING (pódio) ---------- */
function blocoRanking(todos) {
  const r = RANKINGS[rankingPor];
  const top = todos.filter((c) => r.valor(c) > 0).sort((a, b) => r.valor(b) - r.valor(a)).slice(0, 5);
  const comPedido = todos.filter((c) => c.pedidos);
  const ticket = comPedido.reduce((s, c) => s + c.gasto, 0) / Math.max(1, comPedido.reduce((s, c) => s + c.pedidos, 0));
  const ativos = todos.filter((c) => c.diasSem !== null && c.diasSem <= 30).length;
  const chamar = todos.filter((c) => c.segmento === "risco" || c.segmento === "sumido").length;
  const lugar = (c, pos) => (c ? `
    <div class="podio__lugar podio__lugar--${pos} linha-clicavel" data-cliente="${c.telefone}" style="--atraso:${[0, 0.15, 0, 0.3][pos]}s">
      <div class="podio__pessoa">
        ${pos === 1 ? COROA : ""}
        <span class="podio__avatar">${iniciais(c.nome)}</span>
        <span class="podio__nome" title="${escCli(c.nome)}">${escCli(primeiroNomeCli(c.nome))}</span>
        <span class="podio__valor">${r.texto(c)}</span>
        <span class="podio__sub">${r.sub(c)}</span>
      </div>
      <div class="podio__bloco"><span>${pos}º</span></div>
    </div>` : `<div class="podio__lugar podio__lugar--${pos} podio__lugar--vazio"><div class="podio__pessoa"><span class="podio__avatar">?</span><span class="podio__sub">ainda ninguém</span></div><div class="podio__bloco"><span>${pos}º</span></div></div>`);
  return `
    <section class="card hero-ranking">
      <div class="hero-ranking__topo">
        <div class="pilha" style="gap:2px">
          <span class="rotulo">Ranking dos clientes</span>
          <h3 class="hero-ranking__titulo">Quem mais <span>${r.nome}</span></h3>
        </div>
        <div class="segmentado" role="tablist" aria-label="Critério do ranking">
          ${Object.entries({ gasto: "Gasta mais", pedidos: "Pede mais", frequencia: "Mais frequente" }).map(([id, nome]) => `<button class="${rankingPor === id ? "ativo" : ""}" data-ranking="${id}" role="tab" aria-selected="${rankingPor === id}">${nome}</button>`).join("")}
        </div>
      </div>
      <div class="hero-ranking__corpo">
        <div class="podio">${lugar(top[1], 2)}${lugar(top[0], 1)}${lugar(top[2], 3)}</div>
        <div class="hero-ranking__lado">
          ${[top[3], top[4]].map((c, i) => (c ? `
            <div class="ranking-mini linha-clicavel" data-cliente="${c.telefone}">
              <span class="ranking-mini__pos">${i + 4}º</span>
              <span class="avatar" style="width:34px;height:34px;font-size:12px">${iniciais(c.nome)}</span>
              <div class="pilha" style="gap:0;flex:1;min-width:0"><span class="forte">${escCli(c.nome)}</span><span class="pequeno fraco">${r.sub(c)}</span></div>
              <span class="num forte">${r.texto(c)}</span>
            </div>` : "")).join("")}
          <div class="hero-stats">
            <div><strong>${todos.length}</strong><span>clientes</span></div>
            <div><strong>${ativos}</strong><span>ativos em 30 dias</span></div>
            <div><strong>${moeda(ticket)}</strong><span>ticket médio</span></div>
            <div class="hero-stats__alerta"><strong>${chamar}</strong><span>para chamar de volta</span></div>
          </div>
        </div>
      </div>
    </section>`;
}

/* ---------- 2. CLIENTES ---------- */
function blocoListaClientes(todos) {
  const termo = Fomito.paraBusca(buscaClientes);
  const digitos = Fomito.clientes.soDigitos(buscaClientes);
  const conta = (s) => todos.filter((c) => c.segmento === s).length;
  const lista = todos
    .filter((c) => segmentoClientes === "todos" || (segmentoClientes === "convenio" ? c.convenio?.ativo : c.segmento === segmentoClientes))
    .filter((c) => !termo || Fomito.paraBusca(c.nome).includes(termo) || (digitos && c.telefone.includes(digitos)))
    .sort(ORDENS[ordemClientes][1]);
  const pilulas = [
    ["todos", "Todos", todos.length, "#4B2B8F"],
    ...["fiel", "novo", "ativo", "risco", "sumido", "sem"].map((s) => [s, SEGMENTOS[s].plural, conta(s), SEGMENTOS[s].ponto]),
    ["convenio", "Convênio", todos.filter((c) => c.convenio?.ativo).length, "#EA580C"],
  ].filter(([id, , n]) => id === "todos" || n);
  return `
    <section class="card painel-card">
      <div class="painel-card__topo" style="flex-wrap:wrap">
        <div class="pilha" style="gap:2px"><h3>Clientes</h3><span class="pequeno suave">${lista.length} de ${todos.length} · toque para ver a ficha</span></div>
        <span class="linha" style="gap:8px;flex-wrap:wrap">
          <label class="busca-painel">${icone("busca", "ic--sm")}<input id="buscaClientes" placeholder="Nome ou telefone" value="${escCli(buscaClientes)}"></label>
          <label class="ordenar">${icone("baixo", "ic--sm")}<select id="ordemClientes" aria-label="Ordenar">${Object.entries(ORDENS).map(([id, [nome]]) => `<option value="${id}" ${id === ordemClientes ? "selected" : ""}>${nome}</option>`).join("")}</select></label>
        </span>
      </div>
      <div class="seg-filtros">
        ${pilulas.map(([id, nome, n, cor]) => `
          <button class="seg-pilula ${segmentoClientes === id ? "ativa" : ""}" data-segmento="${id}" style="--cor:${cor}" title="${SEGMENTOS[id]?.dica || ""}">
            <span class="seg-pilula__ponto"></span>${nome}<span class="seg-pilula__n">${n}</span>
          </button>`).join("")}
      </div>
      ${segmentoClientes !== "todos" && SEGMENTOS[segmentoClientes] ? `<p class="pequeno suave" style="margin:0">${SEGMENTOS[segmentoClientes].dica}.</p>` : ""}
      <div class="lista-clientes">
        ${lista.map((c) => `
          <div class="cliente-linha linha-clicavel" data-cliente="${c.telefone}" style="--cor:${SEGMENTOS[c.segmento]?.ponto || "#94A3B8"}">
            <span class="avatar cliente-linha__avatar">${iniciais(c.nome)}</span>
            <div class="pilha" style="gap:2px;flex:1;min-width:0">
              <div class="linha" style="gap:6px;flex-wrap:wrap"><span class="forte">${escCli(c.nome)}</span>${tagSegmento(c.segmento)}${c.convenio?.ativo ? `<span class="tag tag--laranja">Convênio</span>` : ""}</div>
              <span class="pequeno suave">${c.pedidos ? `${c.pedidos} pedido${c.pedidos === 1 ? "" : "s"} · ticket ${moeda(c.ticket)} · último: ${c.ultimo.toLowerCase()}` : "Ainda não pediu"}</span>
              ${frequencia(c) ? `<span class="pequeno fraco">${frequencia(c)}${c.favoritos?.[0] ? ` · gosta de ${escCli(c.favoritos[0].nome)}` : ""}</span>` : ""}
            </div>
            <div class="pilha" style="gap:0;align-items:flex-end"><span class="num forte">${moeda(c.gasto)}</span><span class="pequeno fraco">gasto</span></div>
          </div>`).join("") || `<p class="suave" style="text-align:center;padding:24px">Nenhum cliente neste filtro.</p>`}
      </div>
    </section>`;
}

/* ---------- 3. SUMIDOS: escolher quem recebe e a mensagem automática ---------- */
function blocoSumidos(todos) {
  const lista = todos.filter((c) => c.segmento === abaSumidos).sort((a, b) => (b.diasSem || 0) - (a.diasSem || 0));
  [...selecionadosSumidos].forEach((t) => { if (!lista.some((c) => c.telefone === t)) selecionadosSumidos.delete(t); });
  const todosMarcados = lista.length && lista.every((c) => selecionadosSumidos.has(c.telefone));
  const conta = (s) => todos.filter((c) => c.segmento === s).length;
  return `
    <div class="grade-sumidos">
      <section class="card painel-card">
        <div class="painel-card__topo" style="flex-wrap:wrap">
          <div class="pilha" style="gap:2px"><h3>Chamar de volta</h3><span class="pequeno suave">Escolha quem recebe a mensagem agora.</span></div>
          <div class="segmentado segmentado--sm">
            <button class="${abaSumidos === "sumido" ? "ativo" : ""}" data-aba-sumidos="sumido">Sumidos <b>${conta("sumido")}</b></button>
            <button class="${abaSumidos === "risco" ? "ativo" : ""}" data-aba-sumidos="risco">Em risco <b>${conta("risco")}</b></button>
          </div>
        </div>
        ${lista.length ? `
        <label class="sumidos-todos check-linha"><input type="checkbox" data-marcar-todos ${todosMarcados ? "checked" : ""}> Selecionar todos (${lista.length})</label>
        <div class="sumidos-lista lista-rolagem">
          ${lista.map((c) => `
            <label class="sumido-linha ${selecionadosSumidos.has(c.telefone) ? "marcado" : ""}">
              <input type="checkbox" data-sumido="${c.telefone}" ${selecionadosSumidos.has(c.telefone) ? "checked" : ""}>
              <span class="avatar" style="width:34px;height:34px;font-size:12px">${iniciais(c.nome)}</span>
              <span class="pilha" style="gap:1px;flex:1;min-width:0"><span class="forte">${escCli(c.nome)}</span><span class="pequeno fraco">${c.diasSem} dias sem pedir · gastou ${moeda(c.gasto)}${c.favoritos?.[0] ? ` · gosta de ${escCli(c.favoritos[0].nome)}` : ""}</span></span>
              ${c.reativadoEm ? `<span class="tag tag--cinza" title="Já recebeu a mensagem">${(() => { const d = Math.max(0, Math.floor((Date.now() - c.reativadoEm) / 86400000)); return d ? `mensagem há ${d}d` : "mensagem hoje"; })()}</span>` : ""}
            </label>`).join("")}
        </div>
        <div class="sumidos-acao">
          <span class="pequeno suave">${selecionadosSumidos.size ? `<b>${selecionadosSumidos.size}</b> selecionado${selecionadosSumidos.size === 1 ? "" : "s"}` : "Ninguém selecionado"}</span>
          ${ehAdmin ? `<button class="btn btn--primario btn--sm" data-enviar-selecionados ${selecionadosSumidos.size ? "" : "disabled"}>${icone("whatsapp", "ic--sm")} Enviar mensagem${selecionadosSumidos.size ? ` (${selecionadosSumidos.size})` : ""}</button>` : ""}
        </div>` : `<div class="vazio-sumidos">${icone("check")}<span>Ninguém ${abaSumidos === "sumido" ? "sumido" : "em risco"} agora. Bom sinal!</span></div>`}
      </section>
      ${ehAdmin ? cartaoReativacao() : ""}
    </div>`;
}

function cartaoReativacao() {
  const r = Fomito.config.ler().clientes?.reativacao || {};
  const exemplo = (r.texto || "").replace(/\{nome\}/g, "Ana").replace(/\{dias\}/g, r.dias || 30).replace(/\{loja\}/g, Fomito.config.ler().marca.nome);
  return `
    <section class="card painel-card automacao ${r.ativo ? "automacao--ligada" : ""}">
      <div class="painel-card__topo">
        <div class="pilha" style="gap:2px"><h3 class="linha" style="gap:8px">${icone("relogio", "ic--sm")} Mensagem automática</h3><span class="pequeno suave">${r.ativo ? "Ligada: envia sozinha para quem sumir." : "Desligada: só envia quando você escolher."}</span></div>
        <label class="interruptor" title="Ligar a mensagem automática"><input type="checkbox" id="rvAtivo" ${r.ativo ? "checked" : ""}><span></span></label>
      </div>
      <div class="form-grade">
        <div class="campo"><label for="rvDias">Sem pedir há (dias)</label><input class="input" id="rvDias" type="number" min="7" max="365" value="${r.dias || 30}"></div>
        <div class="campo"><label for="rvIntervalo">Não repetir antes de (dias)</label><input class="input" id="rvIntervalo" type="number" min="7" max="365" value="${r.intervalo || 30}"></div>
      </div>
      <div class="campo"><label for="rvTexto">Mensagem <span class="fraco">({nome}, {dias} e {loja} são trocados)</span></label><textarea class="input" id="rvTexto" rows="3" maxlength="600">${escCli(r.texto || "")}</textarea></div>
      <div class="balao-whats"><span class="pequeno fraco">Como chega:</span><p id="rvPrevia">${escCli(exemplo)}</p></div>
      <p class="pequeno fraco" style="margin:0">Envia de hora em hora, das 10h às 20h, até 15 por vez, pelo WhatsApp conectado da loja.</p>
      <button class="btn btn--primario btn--sm" data-salvar-reativacao style="align-self:flex-start">${icone("check", "ic--sm")} Salvar mensagem</button>
    </section>`;
}

function renderClientes() {
  const todos = Fomito.clientes.lista();
  $('[data-secao="clientes"].secao').innerHTML = `${blocoRanking(todos)}${blocoListaClientes(todos)}${blocoSumidos(todos)}`;
}

async function salvarReativacao() {
  const cfg = Fomito.config.ler();
  cfg.clientes = { ...(cfg.clientes || {}), reativacao: {
    ativo: $("#rvAtivo").checked, dias: Number($("#rvDias").value), intervalo: Number($("#rvIntervalo").value), texto: $("#rvTexto").value,
  } };
  await Fomito.config.salvar(cfg);
  toast(cfg.clientes.reativacao.ativo ? "Mensagem automática ligada" : "Mensagem salva (automática desligada)", "check");
  renderClientes();
}

async function enviarSelecionados() {
  const telefones = [...selecionadosSumidos];
  if (!telefones.length) return;
  const nomes = Fomito.clientes.lista().filter((c) => selecionadosSumidos.has(c.telefone)).map((c) => primeiroNomeCli(c.nome));
  if (!(await Fomito.confirmar(`Enviar para ${telefones.length} cliente${telefones.length === 1 ? "" : "s"}?`, `${nomes.slice(0, 6).join(", ")}${nomes.length > 6 ? "..." : ""} vão receber a mensagem no WhatsApp da loja.`, "Enviar agora"))) return;
  try {
    const feito = await Fomito.api("POST", "/clientes/sumidos/enviar", { telefones });
    selecionadosSumidos.clear();
    await Fomito.sincronizar().catch(() => {});
    renderClientes();
    toast(feito.enviados ? `${feito.enviados} mensagem(ns) enviada(s)` : (feito.erro || "Nenhuma mensagem enviada"), feito.enviados ? "whatsapp" : "info");
  } catch (err) { toast(err.message, "info"); }
}

/* ---------- 4. FICHA DO CLIENTE ---------- */
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
            </div>${p.status === "cancelado" && p.motivo ? `<span class="pequeno" style="color:var(--vermelho-escuro);margin:-4px 0 6px">Motivo: ${escCli(p.motivo)}</span>` : ""}`).join("") || `<p class="pequeno fraco">Nenhum pedido ainda.</p>`}
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
  if (e.target.closest(".sumido-linha, [data-marcar-todos]")) return; // checkboxes: tratados no "change"
  const linha = e.target.closest("[data-cliente]");
  if (linha) return abrirCliente(linha.dataset.cliente);
  const seg = e.target.closest("[data-segmento]");
  if (seg) { segmentoClientes = seg.dataset.segmento; return renderClientes(); }
  const rk = e.target.closest("[data-ranking]");
  if (rk) { rankingPor = rk.dataset.ranking; return renderClientes(); }
  const aba = e.target.closest("[data-aba-sumidos]");
  if (aba) { abaSumidos = aba.dataset.abaSumidos; selecionadosSumidos.clear(); return renderClientes(); }
  if (e.target.closest("[data-salvar-reativacao]")) return salvarReativacao();
  if (e.target.closest("[data-enviar-selecionados]")) return enviarSelecionados();
});
document.addEventListener("change", (e) => {
  if (e.target.id === "ordemClientes") { ordemClientes = e.target.value; return renderClientes(); }
  if (e.target.dataset?.sumido) {
    if (e.target.checked) selecionadosSumidos.add(e.target.dataset.sumido); else selecionadosSumidos.delete(e.target.dataset.sumido);
    return renderClientes();
  }
  if (e.target.matches?.("[data-marcar-todos]")) {
    const lista = Fomito.clientes.lista().filter((c) => c.segmento === abaSumidos);
    lista.forEach((c) => (e.target.checked ? selecionadosSumidos.add(c.telefone) : selecionadosSumidos.delete(c.telefone)));
    return renderClientes();
  }
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
