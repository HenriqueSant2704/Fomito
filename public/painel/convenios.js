/* ==========================================================================
   FOMITO · PAINEL › CONVÊNIOS
   --------------------------------------------------------------------------
   Cliente conveniado compra agora (entrega, retirada, balcão ou mesa) e a
   loja cobra no fechamento. O que ele deve sai dos pedidos e das comandas
   pagos com "Convênio"; os pagamentos recebidos entram no caixa aberto.
     1. Lista dos conveniados (quanto cada um deve)
     2. Ligar / editar convênio de um cliente (só o administrador)
     3. Extrato do mês: imprimir, mandar no WhatsApp e receber o pagamento
   ========================================================================== */

let listaConvenios = null; // vem do servidor (GET /convenios)
let buscaConvenios = "";
const dataCurta = (t) => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const mesDe = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const nomeMes = (m) => { const [a, mm] = m.split("-").map(Number); return new Date(a, mm - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };
const escConv = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

async function carregarConvenios() {
  try { listaConvenios = await Fomito.api("GET", "/convenios"); } catch (err) { listaConvenios = []; toast(err.message, "info"); }
  if (!$('[data-secao="convenios"].secao').hidden) desenharConvenios();
}

/* ---------- 1. LISTA ---------- */
function renderConvenios() {
  if (!listaConvenios) $('[data-secao="convenios"].secao').innerHTML = `<p class="suave">Carregando os convênios...</p>`;
  else desenharConvenios();
  carregarConvenios();
}

function desenharConvenios() {
  const lista = listaConvenios || [];
  const termo = Fomito.paraBusca(buscaConvenios);
  const ativos = lista.filter((c) => c.ativo);
  const mostrar = lista.filter((c) => !termo || Fomito.paraBusca(`${c.nome} ${c.empresa || ""} ${c.telefone}`).includes(termo))
    .sort((a, b) => (b.ativo - a.ativo) || (b.devido - a.devido));
  const emAberto = lista.reduce((s, c) => s + c.devido, 0);
  const passaram = ativos.filter((c) => c.limite > 0 && c.devido >= c.limite * 0.9).length;

  $('[data-secao="convenios"].secao').innerHTML = `
    <div class="kpis">
      <div class="card kpi"><span class="kpi__rotulo">Conveniados ${icone("pessoas", "ic--sm")}</span><span class="kpi__valor">${ativos.length}</span><span class="variacao">${lista.length - ativos.length ? `${lista.length - ativos.length} desligado(s)` : "com convênio ativo"}</span></div>
      <div class="card kpi kpi--destaque"><span class="kpi__rotulo">A receber ${icone("conta", "ic--sm")}</span><span class="kpi__valor">${moeda(emAberto)}</span><span class="variacao">somando todos os convênios</span></div>
      <div class="card kpi"><span class="kpi__rotulo">Perto do limite ${icone("alvo", "ic--sm")}</span><span class="kpi__valor">${passaram}</span><span class="variacao">usaram 90% ou mais</span></div>
    </div>

    <div class="card painel-card">
      <div class="painel-card__topo" style="flex-wrap:wrap">
        <div class="pilha" style="gap:2px"><h3>Clientes com convênio</h3><span class="pequeno suave">Compram agora e pagam no fechamento. Pelo cardápio, confirmam com o CPF.</span></div>
        <span class="linha" style="gap:8px;flex-wrap:wrap">
          <label class="busca-painel">${icone("busca", "ic--sm")}<input id="buscaConvenios" placeholder="Nome, empresa ou telefone" value="${escConv(buscaConvenios)}"></label>
          ${ehAdmin ? `<button class="btn btn--primario btn--sm" data-novo-convenio>${icone("mais", "ic--sm")} Novo convênio</button>` : ""}
        </span>
      </div>
      <div class="convenios">
        ${mostrar.map((c) => {
          const uso = c.limite > 0 ? Math.min(100, Math.round((c.devido / c.limite) * 100)) : null;
          return `
          <div class="convenio-card ${c.ativo ? "" : "convenio-card--off"}">
            <div class="convenio-card__topo">
              <span class="avatar" style="width:38px;height:38px;font-size:12px">${iniciais(c.nome)}</span>
              <div class="pilha" style="gap:0;flex:1;min-width:0"><span class="forte">${escConv(c.nome)}</span><span class="pequeno suave">${c.empresa ? `${escConv(c.empresa)} · ` : ""}${Fomito.clientes.formatarTelefone(c.telefone)}</span></div>
              ${c.ativo ? `<span class="tag tag--verde">Ativo</span>` : `<span class="tag tag--cinza">Desligado</span>`}
            </div>
            <div class="entre"><span class="pequeno suave">Em aberto</span><strong class="preco">${moeda(c.devido)}</strong></div>
            ${uso !== null ? `<div class="barra-cat"><div class="entre pequeno"><span class="suave">Limite ${moeda(c.limite)}</span><span class="num">${uso}%</span></div><div class="barra-cat__trilho"><span style="width:${uso}%;${uso >= 90 ? "background:var(--vermelho-escuro)" : ""}"></span></div></div>` : `<span class="pequeno fraco">Sem limite definido</span>`}
            <span class="pequeno fraco">Fecha todo dia ${c.diaFechamento || 1} · ${c.compras} compra${c.compras === 1 ? "" : "s"}${c.ultimaCompra ? ` · última em ${dataCurta(c.ultimaCompra)}` : ""}</span>
            <div class="linha" style="gap:8px;flex-wrap:wrap">
              <button class="btn btn--contorno btn--sm" data-extrato="${c.telefone}">${icone("conta", "ic--sm")} Extrato</button>
              ${c.devido > 0 ? `<button class="btn btn--primario btn--sm" data-receber-convenio="${c.telefone}">${icone("dinheiro", "ic--sm")} Receber</button>` : ""}
              ${ehAdmin ? `<button class="btn-icone btn-icone--sm" data-editar-convenio="${c.telefone}" aria-label="Editar convênio" title="Editar">${icone("editar", "ic--sm")}</button>` : ""}
            </div>
          </div>`;
        }).join("") || `<p class="suave" style="padding:12px 0">${lista.length ? "Nenhum convênio nesta busca." : "Nenhum cliente com convênio ainda. Use “Novo convênio” ou ative na ficha do cliente."}</p>`}
      </div>
    </div>`;
}

/* ---------- 2. LIGAR / EDITAR ---------- */
async function janelaConvenio(telefone) {
  const atual = (listaConvenios || []).find((c) => c.telefone === telefone);
  const cliente = telefone ? Fomito.clientes.buscar(telefone) : null;
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--centro";
  camada.innerHTML = `
    <form class="folha" style="max-width:460px;display:flex;flex-direction:column;gap:14px" novalidate>
      <div class="folha__topo"><div class="pilha" style="gap:0"><h2>${atual ? "Editar convênio" : "Novo convênio"}</h2><span class="pequeno suave">${cliente ? escConv(cliente.nome) : "O cliente compra agora e paga no fechamento"}</span></div><button type="button" class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></div>
      ${telefone ? "" : `
      <div class="form-grade">
        <div class="campo"><label for="cvTel">Celular</label><input class="input" id="cvTel" inputmode="tel" placeholder="(11) 90000-0000"></div>
        <div class="campo"><label for="cvNome">Nome</label><input class="input" id="cvNome" maxlength="80" placeholder="Se ainda não tem cadastro"></div>
      </div>`}
      <div class="form-grade">
        <div class="campo"><label for="cvCpf">CPF ou CNPJ</label><input class="input" id="cvCpf" inputmode="numeric" data-mascara="documento" maxlength="18" placeholder="${atual ? `Atual: ${atual.cpfFinal}` : "CPF da pessoa ou CNPJ da empresa"}"><span class="pequeno fraco">O cliente digita este número no cardápio para confirmar.</span></div>
        <div class="campo"><label for="cvEmpresa">Empresa <span class="fraco">(opcional)</span></label><input class="input" id="cvEmpresa" maxlength="80" value="${escConv(atual?.empresa || "")}" placeholder="Ex.: Metalúrgica Silva"></div>
        <div class="campo"><label for="cvLimite">Limite <span class="fraco">(0 = sem limite)</span></label><div class="campo-moeda"><span>R$</span><input class="input" id="cvLimite" inputmode="decimal" value="${atual?.limite ? String(atual.limite).replace(".", ",") : "0,00"}"></div></div>
        <div class="campo"><label for="cvDia">Dia do fechamento</label><select class="input" id="cvDia">${Array.from({ length: 28 }, (_, i) => `<option ${(atual?.diaFechamento || 5) === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>
      </div>
      ${atual ? `<label class="config-pag check-linha"><span>Convênio ativo</span><label class="interruptor"><input type="checkbox" id="cvAtivo" ${atual.ativo ? "checked" : ""}><span></span></label></label>` : ""}
      <p class="form-erro" id="cvErro" hidden></p>
      <button class="btn btn--primario btn--bloco" type="submit" data-ok>${icone("check", "ic--sm")} ${atual ? "Salvar convênio" : "Ativar convênio"}</button>
    </form>`;
  document.body.appendChild(camada);
  camada.addEventListener("click", (e) => { if (e.target === camada || e.target.closest("[data-fechar]")) camada.remove(); });
  camada.addEventListener("input", (e) => {
    if (e.target.id === "cvTel") e.target.value = Fomito.clientes.formatarTelefone(e.target.value);
  });
  camada.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = (t) => { $("#cvErro", camada).textContent = t; $("#cvErro", camada).hidden = false; };
    const tel = telefone || Fomito.clientes.soDigitos($("#cvTel", camada).value);
    const ativo = atual ? $("#cvAtivo", camada).checked : true;
    const cpf = $("#cvCpf", camada).value.replace(/\D/g, "");
    if (!Fomito.clientes.telefoneValido(tel)) return erro("Digite o celular com DDD.");
    if (ativo && cpf.length !== 11 && cpf.length !== 14 && !(atual && !cpf)) return erro("Digite o CPF (11 números) ou o CNPJ (14 números).");
    try {
      await Fomito.api("PUT", `/convenios/${tel}`, {
        ativo, cpf: cpf || undefined, nome: $("#cvNome", camada)?.value || "",
        empresa: $("#cvEmpresa", camada).value, limite: parseFloat($("#cvLimite", camada).value.replace(/\./g, "").replace(",", ".")) || 0, diaFechamento: Number($("#cvDia", camada).value),
        ...(atual && !cpf ? { manterCpf: true } : {}),
      });
    } catch (err) { return erro(err.message); }
    camada.remove();
    toast(ativo ? "Convênio salvo" : "Convênio desligado", "check");
    await Fomito.sincronizar().catch(() => {});
    carregarConvenios();
  });
}

/* ---------- 3. EXTRATO E RECEBIMENTO ---------- */
let mesExtrato = null;
function textoExtrato(x, mes) {
  const compras = x.compras.filter((c) => !mes || mesDe(c.em) === mes);
  const pagos = x.pagos.filter((p) => !mes || mesDe(p.em) === mes);
  const linha = "-".repeat(42);
  const col = (e, d) => e.slice(0, 42 - d.length - 1).padEnd(42 - d.length) + d;
  const v = (n) => n.toFixed(2).replace(".", ",");
  return [
    "EXTRATO DO CONVÊNIO",
    Fomito.config.ler().marca.nome,
    linha,
    `${x.nome}${x.empresa ? ` · ${x.empresa}` : ""}`,
    mes ? `Período: ${nomeMes(mes)}` : "Período: tudo",
    linha,
    ...compras.map((c) => col(`${dataCurta(c.em)} ${c.descricao}`, v(c.valor))),
    ...(compras.length ? [] : ["Sem compras no período"]),
    col("Compras no período", v(compras.reduce((s, c) => s + c.valor, 0))),
    ...(pagos.length ? [linha, "Pagamentos", ...pagos.map((p) => col(`${dataCurta(p.em)} ${Fomito.caixa.FORMAS_TODAS[p.forma] || p.forma}`, `-${v(p.valor)}`))] : []),
    linha,
    col("TOTAL EM ABERTO", `R$ ${v(x.devido)}`),
    `Fechamento todo dia ${x.diaFechamento || 1}`,
  ].join("\n");
}

async function abrirExtrato(telefone) {
  let x;
  try { x = await Fomito.api("GET", `/convenios/${telefone}`); } catch (err) { return toast(err.message, "info"); }
  const meses = [...new Set([...x.compras, ...x.pagos].map((m) => mesDe(m.em)))].sort().reverse();
  mesExtrato = meses[0] || mesDe(Date.now());
  const camada = document.createElement("div");
  camada.className = "sobreposicao sobreposicao--lado";
  document.body.appendChild(camada);
  const desenhar = () => {
    const compras = x.compras.filter((c) => mesDe(c.em) === mesExtrato).reverse();
    const pagos = x.pagos.filter((p) => mesDe(p.em) === mesExtrato).reverse();
    const totalMes = compras.reduce((s, c) => s + c.valor, 0);
    camada.innerHTML = `
      <div class="folha folha--lado">
        <div class="folha__topo">
          <div class="linha" style="gap:12px"><span class="avatar">${iniciais(x.nome)}</span><div class="pilha" style="gap:0"><h2>${escConv(x.nome)}</h2><span class="pequeno suave">${x.empresa ? `${escConv(x.empresa)} · ` : ""}fecha todo dia ${x.diaFechamento || 1}</span></div></div>
          <button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button>
        </div>
        <div class="mini-kpis">
          <div><span class="pequeno suave">Em aberto</span><strong>${moeda(x.devido)}</strong></div>
          <div><span class="pequeno suave">Compras no mês</span><strong>${moeda(totalMes)}</strong></div>
          <div><span class="pequeno suave">Limite</span><strong>${x.limite ? moeda(x.limite) : "—"}</strong></div>
        </div>
        <div class="campo"><label for="mesExtrato">Mês</label><select class="input" id="mesExtrato">${(meses.length ? meses : [mesExtrato]).map((m) => `<option value="${m}" ${m === mesExtrato ? "selected" : ""}>${nomeMes(m)}</option>`).join("")}</select></div>
        <div class="ficha-bloco">
          <span class="rotulo">Compras (${compras.length})</span>
          <div class="lista-rolagem pilha" style="gap:0">
            ${compras.map((c) => `
              <div class="extrato-linha">
                <div class="pilha" style="gap:1px;min-width:0"><span class="forte">${escConv(c.descricao)}</span><span class="pequeno fraco">${dataCurta(c.em)} · ${escConv(c.itens.slice(0, 3).join(", "))}${c.itens.length > 3 ? "..." : ""}</span></div>
                <span class="linha" style="gap:6px"><span class="num forte">${moeda(c.valor)}</span>${ehAdmin && c.tipo === "pedido" ? `<button class="btn-icone btn-icone--sm btn-icone--perigo" data-estornar="${c.num}" title="Tirar do convênio" aria-label="Tirar o pedido #${c.num} do convênio">${icone("lixo", "ic--sm")}</button>` : ""}</span>
              </div>`).join("") || `<p class="pequeno fraco">Nenhuma compra neste mês.</p>`}
          </div>
        </div>
        ${pagos.length ? `
        <div class="ficha-bloco">
          <span class="rotulo">Pagamentos recebidos</span>
          ${pagos.map((p) => `<div class="extrato-linha extrato-linha--pago"><div class="pilha" style="gap:1px"><span class="forte">${Fomito.caixa.FORMAS_TODAS[p.forma] || p.forma}</span><span class="pequeno fraco">${dataCurta(p.em)} · recebido por ${escConv(p.por || "-")}${p.obs ? ` · ${escConv(p.obs)}` : ""}</span></div><span class="num forte">− ${moeda(p.valor)}</span></div>`).join("")}
        </div>` : ""}
        <div class="linha" style="gap:8px;flex-wrap:wrap;margin-top:auto">
          <button class="btn btn--contorno btn--sm" data-imprimir-extrato>${icone("impressora", "ic--sm")} Imprimir</button>
          <button class="btn btn--contorno btn--sm" data-whats-extrato>${icone("whatsapp", "ic--sm")} Enviar no WhatsApp</button>
          ${x.devido > 0 ? `<button class="btn btn--primario btn--sm" data-receber-extrato style="flex:1">${icone("dinheiro", "ic--sm")} Receber pagamento</button>` : ""}
        </div>
      </div>`;
  };
  desenhar();
  camada.addEventListener("change", (e) => { if (e.target.id === "mesExtrato") { mesExtrato = e.target.value; desenhar(); } });
  camada.addEventListener("click", async (e) => {
    if (e.target === camada || e.target.closest("[data-fechar]")) return camada.remove();
    if (e.target.closest("[data-imprimir-extrato]")) return Fomito.alertas.imprimirTexto(textoExtrato(x, mesExtrato));
    if (e.target.closest("[data-whats-extrato]")) {
      try { await Fomito.api("POST", `/convenios/${x.telefone}/enviar`, { texto: textoExtrato(x, mesExtrato) }); toast(`Extrato enviado para ${x.nome}`, "whatsapp"); }
      catch (err) { toast(err.message, "info"); }
      return;
    }
    if (e.target.closest("[data-receber-extrato]")) { camada.remove(); return janelaReceberConvenio(x.telefone, x); }
    const est = e.target.closest("[data-estornar]");
    if (est) {
      const r = await Fomito.dialogo({
        titulo: `Tirar o pedido #${est.dataset.estornar} do convênio?`,
        texto: "O pedido fica cancelado e sai do que o cliente deve. Use para pedido de teste ou lançado errado. Fica registrado com o seu nome.",
        campos: [{ id: "motivo", rotulo: "Motivo", obrigatorio: true, max: 200, placeholder: "Ex.: pedido de teste" }],
        confirmar: "Tirar do convênio", perigo: true,
      });
      if (!r) return;
      try {
        const novo = await Fomito.api("POST", `/convenios/${x.telefone}/estornar`, { num: Number(est.dataset.estornar), motivo: r.motivo });
        Object.assign(x, { compras: novo.compras, pagos: novo.pagos, devido: novo.devido });
        desenhar();
        toast(`Pedido #${novo.num} tirado do convênio`, "lixo");
        carregarConvenios();
      } catch (err) { toast(err.message, "info"); }
    }
  });
}

async function janelaReceberConvenio(telefone, extrato) {
  const x = extrato || await Fomito.api("GET", `/convenios/${telefone}`).catch((err) => { toast(err.message, "info"); return null; });
  if (!x) return;
  if (!Fomito.caixa.aberto()) return toast("Abra o caixa para receber o pagamento do convênio.", "info");
  const r = await Fomito.dialogo({
    titulo: `Receber de ${x.nome}`,
    texto: `Em aberto: <b>${moeda(x.devido)}</b>. O valor entra no caixa aberto e baixa a conta do convênio.`,
    campos: [
      { id: "valor", rotulo: "Valor recebido (R$)", tipo: "moeda", valor: x.devido.toFixed(2).replace(".", ","), obrigatorio: true },
      { id: "forma", rotulo: "Forma", tipo: "select", valor: "pix", opcoes: Object.entries(Fomito.caixa.FORMAS) },
      { id: "recebido", rotulo: "Se for dinheiro: quanto o cliente deu (R$)", tipo: "moeda", valor: "" },
      { id: "obs", rotulo: "Observação (opcional)", max: 200 },
    ],
    confirmar: "Receber",
  });
  if (!r) return;
  const valor = parseFloat(String(r.valor).replace(/\./g, "").replace(",", ".")) || 0;
  const recebido = r.forma === "dinheiro" ? (parseFloat(String(r.recebido).replace(/\./g, "").replace(",", ".")) || valor) : undefined;
  try {
    const feito = await Fomito.api("POST", `/convenios/${telefone}/receber`, { valor, forma: r.forma, recebido, obs: r.obs });
    toast(`${moeda(valor)} recebido. ${feito.devido > 0 ? `Ainda em aberto: ${moeda(feito.devido)}` : "Convênio quitado!"}`, "check");
    await Fomito.sincronizar().catch(() => {});
    carregarConvenios();
  } catch (err) { toast(err.message, "info"); }
}

/* ---------- Cliques ---------- */
document.addEventListener("click", (e) => {
  const sec = $('[data-secao="convenios"].secao');
  const dentro = sec?.contains(e.target) || e.target.closest(".folha--lado");
  if (e.target.closest("[data-ativar-convenio]")) return janelaConvenio(e.target.closest("[data-ativar-convenio]").dataset.ativarConvenio);
  if (!dentro) return;
  if (e.target.closest("[data-novo-convenio]")) return janelaConvenio(null);
  const ed = e.target.closest("[data-editar-convenio]");
  if (ed) return janelaConvenio(ed.dataset.editarConvenio);
  const ex = e.target.closest("[data-extrato]");
  if (ex) return abrirExtrato(ex.dataset.extrato);
  const rc = e.target.closest("[data-receber-convenio]");
  if (rc) return janelaReceberConvenio(rc.dataset.receberConvenio);
});
document.addEventListener("input", (e) => {
  if (e.target.id !== "buscaConvenios") return;
  buscaConvenios = e.target.value;
  desenharConvenios();
  const campo = $("#buscaConvenios");
  campo.focus();
  campo.setSelectionRange(campo.value.length, campo.value.length);
});
