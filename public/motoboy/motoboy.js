/* ==========================================================================
   FOMITO · TELA DO MOTOBOY
   --------------------------------------------------------------------------
   O motoboy vê os pedidos de entrega PRONTOS, separados por BAIRRO, com o
   endereço e o pedido em destaque. Ele escolhe com quais vai sair (ex.: os
   dois do mesmo bairro), sai para entrega e, ao entregar, recebe o
   pagamento e finaliza: o pedido vira "Entregue" no painel e no cliente,
   e o pagamento entra no caixa com o valor recebido e o troco.

   Organização:
     1. Estado e consultas
     2. Partes do cartão (endereço, itens, cobrança)
     3. Topo: resumo e abas
     4. Aba "Para sair" (por bairro, com seleção)
     5. Aba "Em rota"
     6. Aba "Entregues" (acerto do dinheiro)
     7. Sair para entrega
     8. Finalizar entrega (recebido obrigatório no dinheiro)
     9. Avisos (som, vibração e notificação) e atualização a cada 3 s
    10. Início
   ========================================================================== */

const { dados, moeda, icone, $, toast, sessao, alertas, pedidos } = Fomito;

/* Motoboy e administrador podem abrir as entregas */
const usuarioLogado = sessao.exigir("motoboy", "admin");
const eu = usuarioLogado?.nome || "Motoboy";

/* ---------- 1. ESTADO E CONSULTAS ---------- */
const estado = { aba: "sair", selecionados: new Set(), destacados: new Set() };

const prontos = () => pedidos.entregas("pronto");
const ficandoProntos = () => pedidos.entregas("preparo");
const minhasEmRota = () => pedidos.entregas("rota").filter((p) => p.motoboy === eu);
const hoje = (ts) => ts && new Date(ts).toDateString() === new Date().toDateString();
const minhasEntregues = () => pedidos.entregas("concluido").filter((p) => p.motoboy === eu && hoje(p.entregueEm)).sort((a, b) => b.entregueEm - a.entregueEm);

const forma = (id) => dados.formasPagamento.find((f) => f.id === id);
const minutosDesde = (ts) => Math.max(0, Math.round((Date.now() - ts) / 60000));
const arred = (n) => Math.round(n * 100) / 100;
const numero = (texto) => parseFloat(String(texto).replace(/\./g, "").replace(",", ".")) || 0;

/* ---------- 2. PARTES DO CARTÃO ---------- */
function blocoEndereco(p) {
  return `
    <div class="endereco-moto">
      ${icone("pin")}
      <div style="min-width:0">
        <div class="endereco-moto__rua">${p.rua}</div>
        <div class="endereco-moto__extra">${[p.compl, p.bairro].filter(Boolean).join(" · ")}</div>
        ${p.ref ? `<div class="endereco-moto__ref">${icone("info")}<span>${p.ref}</span></div>` : ""}
      </div>
    </div>`;
}

function blocoItens(p) {
  return `
    <div class="itens-moto">
      ${p.itens.map(([id, qtd, extras = [], obs]) => `
        <div><b>${qtd}×</b> ${Fomito.produto(id).nome}${extras.length ? ` <span class="suave pequeno">+ ${extras.length} adicional</span>` : ""}</div>
        ${obs ? `<div class="obs">Obs.: ${obs}</div>` : ""}`).join("")}
    </div>`;
}

/* Quanto cobrar, de que jeito, e o troco que precisa levar */
function blocoCobrar(p) {
  const f = forma(p.pag);
  const dinheiro = p.pag === "dinheiro";
  const sub = dinheiro
    ? (p.troco ? `Cliente paga com ${moeda(p.troco)} · <span class="levar-troco">levar ${moeda(p.troco - p.total)} de troco</span>` : "Cliente disse que não precisa de troco")
    : p.pag === "pix" ? "Mostrar o QR Code do Pix da loja"
    : "Levar a maquininha";
  const rotulo = dinheiro ? "Cobrar em dinheiro" : p.pag === "pix" ? "Receber no Pix" : `Cobrar no ${f.nome.toLowerCase()}`;
  return `
    <div class="cobrar ${dinheiro ? "cobrar--dinheiro" : ""}">
      <span class="cobrar__icone">${icone(f.icone, "ic--sm")}</span>
      <div class="cobrar__texto"><span class="pequeno suave">${rotulo}</span><span class="pequeno">${sub}</span></div>
      <span class="cobrar__valor">${moeda(p.total)}</span>
    </div>`;
}

const linkMapa = (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.rua}, ${p.bairro}`)}`;
const linkTelefone = (p) => `tel:+55${String(p.telefone).replace(/\D/g, "")}`;

/* ---------- 3. TOPO: RESUMO E ABAS ---------- */
function renderTopo() {
  const qtd = { sair: prontos().length, rota: minhasEmRota().length, feitas: minhasEntregues().length };
  $("#resumo").innerHTML = `
    <div class="resumo-moto__item"><span>Prontos</span><strong>${qtd.sair}</strong></div>
    <div class="resumo-moto__item"><span>Com você</span><strong>${qtd.rota}</strong></div>
    <div class="resumo-moto__item"><span>Entregues hoje</span><strong>${qtd.feitas}</strong></div>`;
  const abas = [["sair", "Para sair", qtd.sair], ["rota", "Em rota", qtd.rota], ["feitas", "Entregues", qtd.feitas]];
  $("#abas").innerHTML = abas.map(([id, nome, n]) => `<button class="${estado.aba === id ? "ativo" : ""}" data-aba="${id}">${nome} <small>${n}</small></button>`).join("");
}

/* ---------- 4. ABA "PARA SAIR" ----------
   Agrupa por bairro (o cliente escolhe o bairro no cadastro do endereço).
   Bairros com mais pedidos aparecem primeiro: dá para levar todos juntos. */
function abaSair() {
  const grupos = pedidos.porBairro(prontos());
  const preparo = pedidos.porBairro(ficandoProntos());
  const cartao = (p) => `
    <article class="entrega entrega--selecionavel ${estado.selecionados.has(p.num) ? "selecionada" : ""} ${estado.destacados.has(p.num) ? "entrega--nova" : ""}" data-selecionar="${p.num}">
      <div class="entrega__cabeca">
        <span class="marcador">${estado.selecionados.has(p.num) ? icone("check") : ""}</span>
        <span class="entrega__num">#${p.num}</span>
        <span class="tag tag--roxo">Pronto</span>
        <span class="entrega__tempo">pronto há ${minutosDesde(p.prontoEm || p.criadoEm)} min</span>
      </div>
      ${blocoEndereco(p)}
      <div class="cliente-moto">${icone("usuario", "ic--sm")}<span class="forte">${p.cliente}</span><span class="suave">· ${pedidos.qtdItens(p)} itens</span></div>
      ${blocoItens(p)}
      ${blocoCobrar(p)}
    </article>`;

  const prontosHtml = grupos.length
    ? grupos.map((g) => {
        const todos = g.pedidos.every((p) => estado.selecionados.has(p.num));
        return `
          <section class="bairro">
            <div class="bairro__topo">
              <span class="bairro__nome">${icone("pin")}<span class="corta">${g.bairro}</span><span class="bairro__qtd">${g.pedidos.length} ${g.pedidos.length > 1 ? "pedidos" : "pedido"}</span></span>
              ${g.pedidos.length > 1 ? `<button class="btn btn--secundario btn--sm" data-bairro="${g.bairro}">${todos ? "Desmarcar" : "Levar todos"}</button>` : ""}
            </div>
            <div class="lista-cartoes">${g.pedidos.map(cartao).join("")}</div>
          </section>`;
      }).join("")
    : `<div class="vazio-moto"><span class="vazio-moto__icone">${icone("entrega", "ic--lg")}</span><strong>Nenhum pedido pronto agora</strong><span class="pequeno">Você recebe um aviso assim que a cozinha marcar um pedido como pronto.</span></div>`;

  const preparoHtml = preparo.length ? `
    <section class="em-preparo">
      <span class="rotulo">Ficando prontos · para você se planejar</span>
      ${preparo.flatMap((g) => g.pedidos).map((p) => `
        <div class="preparo-item">${icone("chama", "ic--sm")}<span class="forte num">#${p.num}</span><span class="corta" style="flex:1"><b>${p.bairro}</b> · ${p.rua}</span><span class="pequeno fraco">em preparo</span></div>`).join("")}
    </section>` : "";

  return prontosHtml + preparoHtml;
}

function renderBarraSaida() {
  const barra = $("#barraSaida");
  const sel = prontos().filter((p) => estado.selecionados.has(p.num));
  barra.hidden = estado.aba !== "sair" || !sel.length;
  if (barra.hidden) return;
  const bairros = [...new Set(sel.map((p) => p.bairro))];
  barra.innerHTML = `
    <div class="barra-saida__dentro">
      <div class="pilha" style="gap:0;min-width:0"><span class="forte">${sel.length} ${sel.length > 1 ? "pedidos" : "pedido"}</span><span class="pequeno suave corta">${bairros.join(", ")}</span></div>
      <button class="btn btn--primario" data-sair>${icone("entrega", "ic--sm")} Sair para entrega</button>
    </div>`;
}

/* ---------- 5. ABA "EM ROTA" ---------- */
function abaRota() {
  const grupos = pedidos.porBairro(minhasEmRota());
  if (!grupos.length) return `<div class="vazio-moto"><span class="vazio-moto__icone">${icone("pin", "ic--lg")}</span><strong>Nenhuma entrega com você</strong><span class="pequeno">Escolha os pedidos em "Para sair" e toque em Sair para entrega.</span></div>`;
  return grupos.map((g) => `
    <section class="bairro">
      <div class="bairro__topo"><span class="bairro__nome">${icone("pin")}<span class="corta">${g.bairro}</span><span class="bairro__qtd">${g.pedidos.length} ${g.pedidos.length > 1 ? "entregas" : "entrega"}</span></span></div>
      <div class="lista-cartoes">
        ${g.pedidos.map((p) => `
          <article class="entrega">
            <div class="entrega__cabeca"><span class="entrega__num">#${p.num}</span><span class="tag tag--roxo">Em rota</span><span class="entrega__tempo">saiu às ${pedidos.hora(p.saiuEm)}</span></div>
            ${blocoEndereco(p)}
            <div class="cliente-moto">${icone("usuario", "ic--sm")}<span class="forte">${p.cliente}</span><span class="suave">${p.telefone}</span></div>
            ${blocoItens(p)}
            ${blocoCobrar(p)}
            <div class="acoes-moto">
              <a class="btn btn--contorno" href="${linkMapa(p)}" target="_blank" rel="noopener" aria-label="Abrir no mapa">${icone("pin", "ic--sm")} Mapa</a>
              <a class="btn btn--contorno" href="${linkTelefone(p)}" aria-label="Ligar para ${p.cliente}">${icone("telefone", "ic--sm")} Ligar</a>
              <button class="btn btn--sucesso" data-entregar="${p.num}">${icone("check", "ic--sm")} Entreguei</button>
            </div>
          </article>`).join("")}
      </div>
    </section>`).join("");
}

/* ---------- 6. ABA "ENTREGUES" ----------
   O dinheiro em mãos é o que o motoboy acerta com o caixa no fim do turno. */
function abaFeitas() {
  const lista = minhasEntregues();
  if (!lista.length) return `<div class="vazio-moto"><span class="vazio-moto__icone">${icone("check", "ic--lg")}</span><strong>Nenhuma entrega finalizada hoje</strong></div>`;
  const total = lista.reduce((s, p) => s + p.total, 0);
  /* Bolsa: troco que saiu da loja + notas que os clientes deram − troco devolvido */
  const b = Fomito.estado.caixa?.bolsa || { fundo: 0, recebido: 0, troco: 0, esperado: 0 };
  return `
    <section class="acerto">
      <div class="entre"><span class="rotulo">Seu dia</span><span class="pequeno suave">${lista.length} ${lista.length > 1 ? "entregas" : "entrega"} · ${moeda(total)}</span></div>
      <div class="bolsa">
        <div class="entre pequeno"><span>Troco que você levou</span><span class="num">${moeda(b.fundo)}</span></div>
        <div class="entre pequeno"><span>Notas recebidas dos clientes</span><span class="num">+ ${moeda(b.recebido)}</span></div>
        <div class="entre pequeno"><span>Troco que você deu</span><span class="num">− ${moeda(b.troco)}</span></div>
      </div>
      <div class="acerto__destaque"><div class="pilha" style="gap:0"><span class="forte">Deve ter na bolsa</span><span class="pequeno">${b.fechamento ? "Bolsa já conferida no caixa" : "Confira no caixa ao fim do turno"}</span></div><strong>${moeda(b.esperado)}</strong></div>
      <span class="pequeno suave">Toque numa entrega para ver o pedido.</span>
      <div>
        ${lista.map((p) => `
          <div class="feita" data-ver-entrega="${p.num}" role="button" tabindex="0">
            <span class="feita__icone">${icone("check", "ic--sm")}</span>
            <div class="pilha" style="gap:0;flex:1;min-width:0"><span class="forte corta">#${p.num} · ${p.bairro}</span><span class="pequeno suave corta">${p.rua} · ${pedidos.hora(p.entregueEm)}</span></div>
            <div class="pilha" style="gap:0;align-items:flex-end"><span class="num forte">${moeda(p.total)}</span><span class="pequeno suave">${forma(p.pagoCom)?.nome || "-"}${p.trocoDado ? ` · troco ${moeda(p.trocoDado)}` : ""}</span></div>
          </div>`).join("")}
      </div>
    </section>`;
}

/* Detalhe de uma entrega feita: para responder o cliente, o gerente ou o restaurante */
function abrirDetalheEntrega(num) {
  const p = pedidos.doNumero(num);
  if (!p) return;
  const camada = document.createElement("div");
  camada.className = "sobreposicao";
  camada.innerHTML = `
    <div class="folha" style="display:flex;flex-direction:column;gap:12px">
      <div class="folha__topo"><h2>Pedido #${p.num}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
      <div class="pilha" style="gap:2px"><span class="forte">${p.cliente}</span><span class="pequeno suave">${p.telefone || ""}</span><span class="pequeno">${p.endereco}${p.ref ? ` · Ref.: ${p.ref}` : ""}</span></div>
      <div class="pilha" style="gap:6px;border-top:1px solid var(--borda);padding-top:10px">
        ${p.itens.map((it) => `<div class="entre pequeno"><span>${it[1]}× ${it[5] || Fomito.produto(it[0]).nome}${it[3] ? `<br><span class="fraco">${it[3]}</span>` : ""}</span><span class="num">${moeda(pedidos.precoItem(it))}</span></div>`).join("")}
        <div class="entre"><span class="forte">Total</span><span class="preco">${moeda(p.total)}</span></div>
      </div>
      <div class="pilha" style="gap:2px;border-top:1px solid var(--borda);padding-top:10px">
        <span class="pequeno">Pago com <b>${forma(p.pagoCom)?.nome || "-"}</b>${p.recebido ? ` · cliente deu ${moeda(p.recebido)}, troco ${moeda(p.trocoDado || 0)}` : ""}</span>
        <span class="pequeno suave">Saiu às ${pedidos.hora(p.saiuEm)} · entregue às ${pedidos.hora(p.entregueEm)}</span>
      </div>
      <button class="btn btn--contorno btn--bloco" data-fechar>Fechar</button>
    </div>`;
  document.body.appendChild(camada);
  camada.addEventListener("click", (e) => { if (e.target === camada || e.target.closest("[data-fechar]")) camada.remove(); });
}
document.addEventListener("click", (e) => {
  const v = e.target.closest("[data-ver-entrega]");
  if (v) abrirDetalheEntrega(Number(v.dataset.verEntrega));
});

function render() {
  /* Tira da seleção o que não está mais pronto (outro motoboy levou) */
  const nums = new Set(prontos().map((p) => p.num));
  estado.selecionados.forEach((n) => { if (!nums.has(n)) estado.selecionados.delete(n); });
  renderTopo();
  $("#lista").innerHTML = { sair: abaSair, rota: abaRota, feitas: abaFeitas }[estado.aba]();
  renderBarraSaida();
}

/* ---------- 7. SAIR PARA ENTREGA ---------- */
async function sair() {
  const nums = [...estado.selecionados];
  if (!nums.length) return;
  await pedidos.sairParaEntrega(nums); // o servidor avisa os clientes no WhatsApp
  estado.selecionados.clear();
  estado.aba = "rota";
  versao = versaoAtual();
  render();
  scrollTo({ top: 0, behavior: "smooth" });
  toast(`Saiu com ${nums.length} ${nums.length > 1 ? "pedidos" : "pedido"}. Boa entrega!`, "entrega");
}

/* ---------- 8. FINALIZAR ENTREGA ----------
   Igual ao fechar conta do garçom: no dinheiro, o valor recebido é
   OBRIGATÓRIO e o troco é calculado. O pagamento vai para o caixa. */
function abrirRecebimento(num) {
  const p = pedidos.doNumero(num);
  const r = { forma: p.pag, recebido: "" };
  const camada = document.createElement("div");
  camada.className = "sobreposicao";
  document.body.appendChild(camada);

  const caixaAberto = () => !Fomito.caixa || !!Fomito.caixa.aberto();
  function problema() {
    if (!caixaAberto()) return "O caixa da loja está fechado. Peça ao responsável para abrir o caixa no painel.";
    if (r.forma !== "dinheiro") return null;
    if (!r.recebido) return "Informe quanto o cliente entregou em dinheiro para calcular o troco.";
    if (numero(r.recebido) < p.total) return `Faltam ${moeda(p.total - numero(r.recebido))} para cobrir o pedido.`;
    return null;
  }
  function blocoTroco() {
    if (r.forma !== "dinheiro") return "";
    if (!r.recebido) return `<div class="troco-caixa aviso-campo">${icone("info", "ic--sm")}<span>Campo obrigatório: o troco é calculado a partir do valor recebido.</span></div>`;
    const recebido = numero(r.recebido);
    return recebido < p.total
      ? `<div class="troco-caixa erro"><span>Faltam</span><strong class="num">${moeda(p.total - recebido)}</strong></div>`
      : `<div class="troco-caixa"><span>Troco a devolver</span><strong class="num">${moeda(recebido - p.total)}</strong></div>`;
  }
  function areaConfirmar() {
    const erro = problema();
    return `
      ${erro && (r.recebido !== "" || !caixaAberto()) ? `<p class="form-erro">${erro}</p>` : ""}
      <button class="btn btn--sucesso btn--bloco" data-confirmar ${erro ? "disabled" : ""} style="height:50px">${icone("check", "ic--sm")} Recebi e entreguei</button>`;
  }
  const notas = () => [...new Set([p.troco, Math.ceil(p.total / 10) * 10, Math.ceil(p.total / 50) * 50, Math.ceil(p.total / 100) * 100])].filter((n) => n && n > p.total).slice(0, 3);

  function desenhar() {
    camada.innerHTML = `
      <div class="folha receber">
        <div class="folha__topo"><div class="pilha" style="gap:2px"><h2>Finalizar entrega #${p.num}</h2><span class="pequeno suave">${p.cliente} · ${p.bairro}</span></div><button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
        <div class="receber__total"><span class="rotulo">Valor do pedido</span><span class="preco">${moeda(p.total)}</span><span class="pequeno suave">Combinado: ${forma(p.pag).nome}${p.pag === "dinheiro" && p.troco ? `, troco para ${moeda(p.troco)}` : ""}</span></div>
        <div class="campo"><span class="rotulo-campo">Como o cliente pagou?</span>
          <div class="formas">
            ${dados.formasPagamento.map((f) => `
              <button class="opcao ${r.forma === f.id ? "ativa" : ""}" data-forma="${f.id}">
                <span class="opcao__icone">${icone(f.icone, "ic--sm")}</span><span class="opcao__titulo pequeno">${f.nome}</span>
              </button>`).join("")}
          </div>
        </div>
        ${r.forma === "dinheiro" ? `
          <div class="campo"><label for="recebido">Valor recebido em dinheiro <span class="obrigatorio">*</span></label>
            <input class="input num ${r.recebido ? "" : "input--pendente"}" id="recebido" inputmode="decimal" placeholder="Quanto o cliente entregou" value="${r.recebido}">
            <div class="notas">
              <button data-nota="${p.total}">Valor exato</button>
              ${notas().map((n) => `<button data-nota="${n}">${moeda(n)}${n === p.troco ? " (combinado)" : ""}</button>`).join("")}
            </div>
          </div>
          <div id="caixaTroco">${blocoTroco()}</div>` : ""}
        <div id="areaConfirmar">${areaConfirmar()}</div>
      </div>`;
  }
  const atualizarParcial = () => {
    if ($("#caixaTroco", camada)) $("#caixaTroco", camada).innerHTML = blocoTroco();
    $("#areaConfirmar", camada).innerHTML = areaConfirmar();
    $("#recebido", camada)?.classList.toggle("input--pendente", !r.recebido);
  };
  desenhar();

  async function confirmar() {
    if (problema()) return;
    const dinheiro = r.forma === "dinheiro";
    const recebido = dinheiro ? numero(r.recebido) : null;
    const troco = dinheiro ? arred(recebido - p.total) : null;
    await pedidos.concluirEntrega(p.num, { forma: r.forma, recebido });
    camada.remove();
    versao = versaoAtual();
    render();
    toast(`Pedido #${p.num} entregue${troco ? ` · troco ${moeda(troco)}` : ""}`, "check");
  }

  camada.addEventListener("click", (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return camada.remove();
    const f = e.target.closest("[data-forma]");
    if (f) { r.forma = f.dataset.forma; r.recebido = ""; return desenhar(); }
    const nota = e.target.closest("[data-nota]");
    if (nota) { r.recebido = Number(nota.dataset.nota).toFixed(2).replace(".", ","); $("#recebido", camada).value = r.recebido; return atualizarParcial(); }
    if (e.target.closest("[data-confirmar]")) confirmar();
  });
  camada.addEventListener("input", (e) => { if (e.target.id === "recebido") { r.recebido = e.target.value; atualizarParcial(); } });
  camada.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("input")) confirmar(); });
}

/* ---------- 9. AVISOS E ATUALIZAÇÃO ----------
   A cada 3 segundos confere os pedidos. Pedido novo pronto:
   toca o som, vibra, mostra o aviso e (com permissão) a notificação do celular. */
function renderAvisoNotificacao() {
  const el = $("#avisoNotificacao");
  if (alertas.avisosLigados()) {
    el.innerHTML = `<div class="avisos-ok">${icone("check", "ic--sm")}Avisos ativados${alertas.notificacoesAtivas() ? "" : " (som e vibração: mantenha esta tela aberta)"}. Você é chamado quando um pedido ficar pronto.</div>`;
    return;
  }
  el.innerHTML = `
    <div class="ativar-avisos">
      ${icone("sino")}
      <span>Ative os avisos para tocar e vibrar quando um pedido ficar pronto, mesmo com outro app aberto.</span>
      <button class="btn btn--destaque btn--sm" data-ativar-avisos>Ativar</button>
    </div>`;
}

async function ativarAvisos() {
  const r = await alertas.ativarNotificacoes();
  alertas.tocarAlerta();
  if (r === "granted") toast("Avisos ativados", "sino");
  else toast("Som ativado. O navegador não liberou a notificação: mantenha esta tela aberta.", "info");
  renderAvisoNotificacao();
}

const versaoAtual = () => JSON.stringify(pedidos.entregas("preparo", "pronto", "rota", "concluido").map(({ num, status, motoboy }) => [num, status, motoboy]));
let versao = versaoAtual();
let conhecidos = new Set(prontos().map((p) => p.num));

const verificarMudancasMotoboy = () => {
  const agora = versaoAtual();
  if (agora === versao) return;
  versao = agora;
  const novos = prontos().filter((p) => !conhecidos.has(p.num));
  conhecidos = new Set(prontos().map((p) => p.num));
  if (novos.length) {
    novos.forEach((p) => estado.destacados.add(p.num));
    setTimeout(() => novos.forEach((p) => estado.destacados.delete(p.num)), 4000);
    const bairros = [...new Set(novos.map((p) => p.bairro))].join(", ");
    const titulo = novos.length > 1 ? `${novos.length} pedidos prontos para entrega` : `Pedido #${novos[0].num} pronto para entrega`;
    alertas.avisar(titulo, `${bairros} · toque para ver`, "pronto");
    toast(`${titulo} · ${bairros}`, "sino");
  }
  render();
};
setInterval(verificarMudancasMotoboy, 3000);
/* O servidor avisa na hora quando algo muda (pedido novo, pronto, conta...): confere sem esperar os 3 s */
document.addEventListener("fomito:estado", verificarMudancasMotoboy);

/* ---------- 10. INÍCIO ---------- */
$("#simbolo").innerHTML = Fomito.config.simbolo(Fomito.config.ler().marca);
$("#nomeMotoboy").textContent = usuarioLogado?.perfil === "admin" ? `${eu} · Administrador` : eu;
$("#voltarPainel").hidden = usuarioLogado?.perfil !== "admin";
$("#btnSair").addEventListener("click", () => sessao.sair());

document.addEventListener("click", (e) => {
  const aba = e.target.closest("[data-aba]");
  if (aba) { estado.aba = aba.dataset.aba; render(); return scrollTo({ top: 0 }); }
  if (e.target.closest("[data-ativar-avisos]")) return ativarAvisos();
  if (e.target.closest("[data-sair]")) return sair();
  const entregar = e.target.closest("[data-entregar]");
  if (entregar) return abrirRecebimento(Number(entregar.dataset.entregar));
  const bairro = e.target.closest("[data-bairro]");
  if (bairro) {
    const doBairro = prontos().filter((p) => p.bairro === bairro.dataset.bairro).map((p) => p.num);
    const todos = doBairro.every((n) => estado.selecionados.has(n));
    doBairro.forEach((n) => (todos ? estado.selecionados.delete(n) : estado.selecionados.add(n)));
    return render();
  }
  if (e.target.closest("a, button, .sobreposicao")) return;
  const card = e.target.closest("[data-selecionar]");
  if (card) {
    const n = Number(card.dataset.selecionar);
    estado.selecionados.has(n) ? estado.selecionados.delete(n) : estado.selecionados.add(n);
    render();
  }
});

renderAvisoNotificacao();
render();
