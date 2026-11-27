/* ==========================================================================
   FOMITO · PAINEL › CARDÁPIO
   --------------------------------------------------------------------------
   Carregado antes do painel.js (usa dados, moeda, icone, $, toast dele).
   Organização:
     1. Estado da seção
     2. Abas: Produtos · Categorias · Adicionais · Vitrine
     3. Cadastro / edição de produto (fotos, informações, ingredientes,
        adicionais, disponibilidade e prévia)
     4. Cliques e digitação

   Cada mudança grava o cardápio inteiro no servidor (Fomito.salvarCardapio).
   As fotos são diminuídas no navegador e o servidor guarda no banco
   (tabela "imagens"); no cardápio elas viram { src: "/img/123" }.
   ========================================================================== */

/* ---------- 1. ESTADO ---------- */
const cardapio = {
  aba: "produtos",      // "produtos" | "categorias" | "adicionais" | "vitrine"
  filtro: "todas",      // categoria filtrada na lista
  busca: "",
  produto: null,        // rascunho do produto aberto no editor (null = lista)
};

const nomeCategoria = (id) => Fomito.dados.categorias.find((c) => c.id === id)?.nome || "-";

/* ---------- 2. ABAS ---------- */
function renderCardapio() {
  const secao = $('[data-secao="cardapio"].secao');
  if (cardapio.produto) return (secao.innerHTML = editorProduto());
  const abas = [["produtos", "cardapio", "Produtos"], ["categorias", "grade", "Categorias"], ["adicionais", "mais", "Adicionais"], ["vitrine", "fotos", "Vitrine"]];
  secao.innerHTML = `
    <nav class="abas">${abas.map(([id, ic, nome]) => `<button class="aba ${cardapio.aba === id ? "ativo" : ""}" data-aba-cardapio="${id}">${icone(ic, "ic--sm")}${nome}</button>`).join("")}</nav>
    ${{ produtos: abaProdutos, categorias: abaCategorias, adicionais: abaAdicionais, vitrine: abaVitrine }[cardapio.aba]()}`;
}

function abaProdutos() {
  const cats = [{ id: "todas", nome: "Todos" }, ...dados.categorias];
  const conta = (id) => dados.produtos.filter((p) => id === "todas" || p.cat === id).length;
  const termo = Fomito.paraBusca(cardapio.busca);
  const lista = dados.produtos.filter((p) => (cardapio.filtro === "todas" || p.cat === cardapio.filtro) && Fomito.paraBusca(`${p.nome} ${p.desc || ""}`).includes(termo));
  return `
    <div class="entre" style="flex-wrap:wrap">
      <nav class="filtros">${cats.map((c) => `<button class="filtro ${cardapio.filtro === c.id ? "ativo" : ""}" data-filtro-cardapio="${c.id}">${c.nome} <small>${conta(c.id)}</small></button>`).join("")}</nav>
      <div class="linha" style="gap:10px">
        <label class="busca-painel">${icone("busca", "ic--sm")}<input id="buscaCardapio" placeholder="Buscar produto" value="${cardapio.busca}"></label>
        <button class="btn btn--primario btn--sm" data-novo-produto>${icone("mais", "ic--sm")} Novo produto</button>
      </div>
    </div>
    <div class="card painel-card tabela-rolagem">
      <table class="tabela">
        <thead><tr><th>Produto</th><th>Categoria</th><th>Fotos</th><th>Adicionais</th><th class="dir">Preço</th><th>Disponível</th><th></th></tr></thead>
        <tbody>
          ${lista.map((p) => `
            <tr class="linha-clicavel" data-editar-produto="${p.id}">
              <td><div class="linha" style="gap:12px">${Fomito.foto(p, 44)}<div style="min-width:0"><div class="forte linha" style="gap:6px">${p.nome}${p.destaque ? `<span class="tag tag--laranja">Mais pedido</span>` : ""}</div><div class="pequeno suave corta">${p.desc}</div></div></div></td>
              <td class="suave">${nomeCategoria(p.cat)}</td>
              <td><span class="linha suave pequeno" style="gap:5px">${icone("fotos", "ic--sm")}${p.fotos.length}</span></td>
              <td class="suave pequeno">${(dados.adicionais[p.cat] || []).length || "-"}</td>
              <td class="dir preco">${moeda(p.preco)}</td>
              <td><label class="interruptor" data-sem-abrir><input type="checkbox" data-disponivel="${p.id}" ${p.esgotado ? "" : "checked"}><span></span></label></td>
              <td class="dir"><button class="btn-icone" aria-label="Editar ${p.nome}">${icone("editar", "ic--sm")}</button></td>
            </tr>`).join("") || `<tr><td colspan="7" class="suave" style="text-align:center;padding:28px">Nenhum produto encontrado.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function abaCategorias() {
  return `
    <div class="duas-colunas">
      <div class="card painel-card">
        <div class="painel-card__topo"><h3>Categorias do cardápio</h3><span class="pequeno fraco">A ordem aqui é a ordem das abas no cardápio</span></div>
        <div class="lista-ordem">
          ${dados.categorias.map((c, i) => `
            <div class="item-ordem">
              <span class="item-ordem__icone">${icone(c.icone || "cardapio", "ic--sm")}</span>
              <div class="pilha" style="gap:0;flex:1"><span class="forte">${c.nome}</span><span class="pequeno suave">${dados.produtos.filter((p) => p.cat === c.id).length} produtos</span></div>
              <button class="btn-icone" data-mover-categoria="${i},-1" ${i === 0 ? "disabled" : ""} aria-label="Subir">${icone("cima", "ic--sm")}</button>
              <button class="btn-icone" data-mover-categoria="${i},1" ${i === dados.categorias.length - 1 ? "disabled" : ""} aria-label="Descer">${icone("baixo", "ic--sm")}</button>
              <label class="interruptor" title="Mostrar no cardápio"><input type="checkbox" checked><span></span></label>
            </div>`).join("")}
        </div>
      </div>
      <div class="card painel-card">
        <h3>Nova categoria</h3>
        <div class="campo"><label for="novaCategoria">Nome</label><input id="novaCategoria" class="input" placeholder="Ex.: Sobremesas, Combos, Açaí"></div>
        <button class="btn btn--primario" data-criar-categoria>${icone("mais", "ic--sm")} Criar categoria</button>
        <p class="pequeno suave">Depois é só cadastrar os produtos nela. Categoria sem produto não aparece para o cliente.</p>
      </div>
    </div>`;
}

function abaAdicionais() {
  return `
    <p class="suave pequeno">Adicionais são os extras que o cliente marca no detalhe do produto (ex.: bacon extra). Cada categoria tem a sua lista.</p>
    <div class="grade-adicionais">
      ${dados.categorias.map((c) => `
        <div class="card painel-card">
          <div class="painel-card__topo"><h3 class="linha" style="gap:8px">${icone(c.icone || "cardapio", "ic--sm")}${c.nome}</h3><button class="btn btn--contorno btn--sm" data-novo-adicional="${c.id}">${icone("mais", "ic--sm")} Adicional</button></div>
          ${(dados.adicionais[c.id] || []).map((a) => `
            <div class="config-pag"><span>${a.nome}</span><span class="linha" style="gap:14px"><span class="num suave">+ ${moeda(a.preco)}</span><button class="btn-icone" data-remover-adicional="${c.id},${a.id}" aria-label="Remover ${a.nome}">${icone("lixo", "ic--sm")}</button></span></div>`).join("")
            || `<p class="pequeno fraco">Nenhum adicional nesta categoria.</p>`}
        </div>`).join("")}
    </div>`;
}

function abaVitrine() {
  const slides = dados.lanchonete.vitrine;
  return `
    <p class="suave pequeno">As imagens da vitrine aparecem no topo do cardápio e passam sozinhas a cada 5 segundos. Use fotos na horizontal (1200 × 800).</p>
    <div class="grade-vitrine">
      ${slides.map((v, i) => `
        <div class="card slide-card">
          <div class="slide-card__imagem">${Fomito.imagemFoto(v)}<span class="slide-card__ordem">${i + 1}</span>
            <div class="slide-card__texto"><strong>${v.titulo}</strong><span>${v.texto}</span></div></div>
          <div class="entre" style="padding:10px 12px">
            <label class="interruptor" title="Mostrar no cardápio"><input type="checkbox" data-mostrar-slide="${i}" ${v.oculto ? "" : "checked"}><span></span></label>
            <span class="linha" style="gap:4px">
              <button class="btn-icone" data-editar-slide="${i}" aria-label="Editar título e frase">${icone("editar", "ic--sm")}</button>
              <button class="btn-icone" data-remover-slide="${i}" aria-label="Remover">${icone("lixo", "ic--sm")}</button>
            </span>
          </div>
        </div>`).join("")}
      <label class="card slide-card slide-card--nova" for="novoSlide">${icone("fotos")}<b>Adicionar imagem</b><span class="pequeno suave">Título e frase aparecem por cima</span></label>
      <input type="file" id="novoSlide" accept="image/*" hidden>
    </div>`;
}

/* Editor da imagem da vitrine: prévia ao vivo de como fica no topo do cardápio */
async function editarSlide(indice, nova = null) {
  const v = nova || dados.lanchonete.vitrine[indice];
  if (!v) return;
  const previa = (titulo, texto) => `
    <div class="slide-card__imagem editor-slide__previa">${Fomito.imagemFoto(v)}
      <div class="slide-card__texto"><strong>${titulo || "Título da imagem"}</strong><span>${texto || "Uma frase curta sobre a casa"}</span></div></div>`;
  const esc = (t) => String(t).replace(/</g, "&lt;");
  const r = await Fomito.dialogo({
    titulo: nova ? "Nova imagem da vitrine" : "Editar imagem da vitrine",
    topo: `<div id="previaSlide">${previa(esc(v.titulo), esc(v.texto))}</div><span class="pequeno fraco">Assim aparece no topo do cardápio, passando a cada 5 segundos.</span>`,
    campos: [
      { id: "titulo", rotulo: "Título", valor: v.titulo, placeholder: "Ex.: Combo da casa", obrigatorio: true, max: 40 },
      { id: "texto", rotulo: "Frase", valor: v.texto, placeholder: "Ex.: Lanche + batata + refri por R$ 39,90", tipo: "textarea", max: 90 },
    ],
    confirmar: nova ? "Publicar na vitrine" : "Salvar",
    aoDigitar: (val, camada) => { camada.querySelector("#previaSlide").innerHTML = previa(esc(val.titulo), esc(val.texto)); },
  });
  if (!r) return;
  Object.assign(v, { titulo: r.titulo, texto: r.texto });
  if (nova) dados.lanchonete.vitrine.push(v);
  await Fomito.salvarCardapio();
  renderCardapio();
  toast(nova ? "Imagem publicada na vitrine" : "Vitrine atualizada", "check");
}

/* ---------- 3. CADASTRO / EDIÇÃO DE PRODUTO ---------- */
function abrirEditor(id) {
  const base = id
    ? Fomito.produto(id)
    : { id: null, cat: cardapio.filtro === "todas" ? dados.categorias[0]?.id : cardapio.filtro, nome: "", preco: 0, desc: "", ingredientes: [], fotos: [], destaque: false };
  cardapio.produto = { entrega: true, local: true, ...structuredClone(base) };
  renderCardapio();
  window.scrollTo(0, 0);
}

function editorProduto() {
  const p = cardapio.produto;
  const adicionais = dados.adicionais[p.cat] || [];
  return `
    <div class="editor-topo">
      <button class="btn btn--contorno btn--sm" data-fechar-editor>${icone("voltar", "ic--sm")} Voltar</button>
      <span class="pequeno suave">Cardápio › ${nomeCategoria(p.cat)} › <b>${p.id ? p.nome : "Novo produto"}</b></span>
    </div>

    <div class="editor">
      <div class="editor__principal">
        <div class="card painel-card">
          <div class="painel-card__topo">
            <div class="pilha" style="gap:2px"><h3>Fotos</h3><span class="pequeno suave">A primeira é a capa. Inclua fotos do lanche e da casa: o cliente desliza para ver todas.</span></div>
            <span class="tag tag--cinza">${p.fotos.length} de 8</span>
          </div>
          <div class="galeria-editor" id="galeriaEditor">${galeriaEditor()}</div>
        </div>

        <div class="card painel-card">
          <h3>Informações</h3>
          <div class="form-grade">
            <div class="campo"><label for="pNome">Nome do produto</label><input id="pNome" class="input" data-campo="nome" value="${p.nome}" placeholder="Ex.: X-Salada"></div>
            <div class="campo"><label for="pCat">Categoria</label><select id="pCat" class="input" data-campo="cat">${dados.categorias.map((c) => `<option value="${c.id}" ${c.id === p.cat ? "selected" : ""}>${c.nome}</option>`).join("")}</select></div>
            <div class="campo"><label for="pPreco">Preço</label><div class="campo-moeda"><span>R$</span><input id="pPreco" class="input" data-campo="preco" inputmode="decimal" value="${p.preco ? p.preco.toFixed(2).replace(".", ",") : ""}" placeholder="0,00"></div></div>
            <div class="campo"><label for="pTempo">Tempo de preparo</label><select id="pTempo" class="input"><option>Até 15 min</option><option selected>15 a 25 min</option><option>25 a 40 min</option></select></div>
            <div class="campo" style="grid-column:1/-1"><label for="pDesc">Descrição <span class="fraco" id="contaDesc">${p.desc.length}/200</span></label><textarea id="pDesc" class="input" rows="3" maxlength="200" data-campo="desc" placeholder="Conte o que vem no lanche, o tamanho e o que ele tem de especial.">${p.desc}</textarea></div>
          </div>
        </div>

        <div class="card painel-card">
          <div class="pilha" style="gap:2px"><h3>Ingredientes</h3><span class="pequeno suave">Aparecem como etiquetas no detalhe do produto.</span></div>
          <div class="chips-editor" id="chipsIngredientes">
            ${p.ingredientes.map((ing, i) => `<span class="chip-editor">${ing}<button data-remover-ingrediente="${i}" aria-label="Remover ${ing}">${icone("fechar", "ic--sm")}</button></span>`).join("")}
            <input id="novoIngrediente" class="chips-editor__input" placeholder="Digite e aperte Enter">
          </div>
        </div>

        <div class="card painel-card">
          <div class="painel-card__topo"><div class="pilha" style="gap:2px"><h3>Adicionais</h3><span class="pequeno suave">Extras que o cliente pode incluir neste produto.</span></div><button class="link pequeno" data-ir-adicionais>Gerenciar adicionais</button></div>
          ${adicionais.map((a) => `<label class="config-pag check-linha"><span class="linha" style="gap:10px"><input type="checkbox" checked> ${a.nome}</span><span class="num suave">+ ${moeda(a.preco)}</span></label>`).join("")
            || `<p class="pequeno fraco">A categoria ${nomeCategoria(p.cat)} não tem adicionais.</p>`}
        </div>
      </div>

      <aside class="editor__lateral">
        <div class="card painel-card">
          <h3>Disponibilidade</h3>
          <div class="config-pag"><span>Disponível agora</span><label class="interruptor"><input type="checkbox" data-campo-check="disponivel" ${p.esgotado ? "" : "checked"}><span></span></label></div>
          <div class="config-pag"><span>Destaque em “Os mais pedidos”</span><label class="interruptor"><input type="checkbox" data-campo-check="destaque" ${p.destaque ? "checked" : ""}><span></span></label></div>
          <div class="config-pag"><span>Vende para entrega</span><label class="interruptor"><input type="checkbox" data-campo-check="entrega" ${p.entrega ? "checked" : ""}><span></span></label></div>
          <div class="config-pag"><span>Vende para comer no local</span><label class="interruptor"><input type="checkbox" data-campo-check="local" ${p.local ? "checked" : ""}><span></span></label></div>
        </div>
        <div class="card painel-card">
          <div class="painel-card__topo"><h3>Prévia no cardápio</h3><span class="tag tag--cinza">Cliente</span></div>
          <div class="previa-produto" id="previaProduto">${previaProduto()}</div>
        </div>
      </aside>
    </div>

    <div class="barra-salvar">
      ${p.id ? `<button class="btn btn--sm" data-excluir-produto style="color:var(--vermelho-escuro)">${icone("lixo", "ic--sm")} Excluir produto</button>` : `<span class="pequeno suave">Novo produto em ${nomeCategoria(p.cat)}</span>`}
      <span class="linha" style="gap:8px">
        <button class="btn btn--contorno" data-fechar-editor>Cancelar</button>
        <button class="btn btn--primario" data-salvar-produto>${p.id ? "Salvar alterações" : "Cadastrar produto"}</button>
      </span>
    </div>`;
}

function galeriaEditor() {
  const p = cardapio.produto;
  return `
    ${p.fotos.map((f, i) => `
      <div class="foto-editor ${i === 0 ? "foto-editor--capa" : ""}">
        <div class="foto-editor__imagem">${Fomito.imagemFoto(f, p.cat)}
          ${i === 0 ? `<span class="foto-editor__selo">Capa</span>` : ""}
          <span class="foto-editor__acoes">
            ${i > 0 ? `<button data-capa="${i}" title="Usar como capa">${icone("estrela", "ic--sm")}</button>` : ""}
            <button data-remover-foto="${i}" title="Remover foto">${icone("lixo", "ic--sm")}</button>
          </span>
        </div>
        <input class="input foto-editor__legenda" data-legenda="${i}" value="${f.legenda || ""}" placeholder="${i === 0 ? "Foto principal" : "Legenda (ex.: foto da casa)"}">
      </div>`).join("")}
    ${p.fotos.length < 8 ? `
      <label class="foto-editor foto-editor--nova" for="novaFoto">
        <span class="foto-editor__imagem">${icone("fotos")}<b>Adicionar fotos</b><span class="pequeno suave">JPG ou PNG</span></span>
      </label>
      <input type="file" id="novaFoto" accept="image/*" multiple hidden>` : ""}`;
}

function previaProduto() {
  const p = cardapio.produto;
  return `
    <div class="previa-produto__foto">${Fomito.imagemFoto(p.fotos[0], p.cat)}${p.fotos.length > 1 ? `<span class="previa-produto__qtd">${icone("fotos", "ic--sm")} 1/${p.fotos.length}</span>` : ""}</div>
    <div class="previa-produto__corpo">
      <strong>${p.nome || "Nome do produto"}</strong>
      <span class="pequeno suave">${p.desc || "A descrição aparece aqui."}</span>
      <div class="linha" style="gap:6px;flex-wrap:wrap">${p.ingredientes.slice(0, 4).map((i) => `<span class="tag tag--cinza">${i}</span>`).join("")}</div>
      <span class="preco">${moeda(Number(p.preco) || 0)}</span>
    </div>`;
}

const atualizarPrevia = () => { const el = $("#previaProduto"); if (el) el.innerHTML = previaProduto(); };
const atualizarGaleria = () => renderCardapio(); // redesenha fotos, contador e prévia

async function salvarProduto() {
  const p = cardapio.produto;
  if (p.nome.trim().length < 2) return toast("Dê um nome ao produto", "info");
  if (!(p.preco > 0)) return toast("Informe o preço", "info");
  if (!p.fotos.length) p.fotos = [{ desenho: "xburguer", cena: "produto", legenda: "" }];
  const { entrega, local, ...produto } = p;
  if (produto.id) Object.assign(Fomito.produto(produto.id), produto);
  else dados.produtos.push({ ...produto, id: Math.max(0, ...dados.produtos.map((x) => x.id)) + 1, desenho: produto.fotos[0].desenho });
  await Fomito.salvarCardapio();
  cardapio.produto = null;
  cardapio.filtro = produto.cat;
  renderCardapio();
  toast(`${produto.nome} salvo no cardápio`, "check");
}

/* ---------- 4. CLIQUES E DIGITAÇÃO ---------- */
const secaoCardapio = () => $('[data-secao="cardapio"].secao');

document.addEventListener("click", async (e) => {
  if (!secaoCardapio().contains(e.target)) return;
  const alvo = (sel) => e.target.closest(sel);

  if (alvo("[data-aba-cardapio]")) { cardapio.aba = alvo("[data-aba-cardapio]").dataset.abaCardapio; return renderCardapio(); }
  if (alvo("[data-filtro-cardapio]")) { cardapio.filtro = alvo("[data-filtro-cardapio]").dataset.filtroCardapio; return renderCardapio(); }
  if (alvo("[data-novo-produto]")) return abrirEditor(null);
  if (alvo("[data-sem-abrir]")) return;
  if (alvo("[data-editar-produto]")) return abrirEditor(Number(alvo("[data-editar-produto]").dataset.editarProduto));

  /* Categorias, adicionais e vitrine */
  if (alvo("[data-mover-categoria]")) {
    const [i, passo] = alvo("[data-mover-categoria]").dataset.moverCategoria.split(",").map(Number);
    const cats = dados.categorias;
    [cats[i], cats[i + passo]] = [cats[i + passo], cats[i]];
    await Fomito.salvarCardapio();
    return renderCardapio();
  }
  if (alvo("[data-criar-categoria]")) {
    const nome = $("#novaCategoria").value.trim();
    if (!nome) return toast("Digite o nome da categoria", "info");
    let id = nome.toLowerCase().normalize("NFD").replace(/[^\w]/g, "") || "categoria";
    while (dados.categorias.some((c) => c.id === id)) id += "2";
    dados.categorias.push({ id, nome, icone: "cardapio" });
    await Fomito.salvarCardapio();
    renderCardapio();
    return toast(`Categoria ${nome} criada`, "check");
  }
  if (alvo("[data-novo-adicional]")) {
    const cat = alvo("[data-novo-adicional]").dataset.novoAdicional;
    const r = await Fomito.dialogo({
      titulo: "Novo adicional",
      texto: `Aparece no produto como opcional, em <b>${nomeCategoria(cat)}</b>.`,
      campos: [
        { id: "nome", rotulo: "Nome", placeholder: "Ex.: Bacon extra", obrigatorio: true, max: 50 },
        { id: "preco", rotulo: "Preço (R$)", placeholder: "Ex.: 5,00", tipo: "moeda", obrigatorio: true, max: 10,
          validar: (v) => (parseFloat(v.replace(",", ".")) >= 0 ? null : "Digite um preço válido, ex.: 5,00.") },
      ],
      confirmar: "Adicionar",
    });
    if (!r) return;
    const nome = r.nome;
    const preco = Math.round(parseFloat(r.preco.replace(",", ".")) * 100) / 100;
    let id = nome.toLowerCase().normalize("NFD").replace(/[^\w]/g, "") || "adicional";
    while ((dados.adicionais[cat] || []).some((a) => a.id === id)) id += "2";
    (dados.adicionais[cat] ||= []).push({ id, nome, preco });
    await Fomito.salvarCardapio();
    renderCardapio();
    return toast(`${nome} adicionado`, "check");
  }
  if (alvo("[data-remover-adicional]")) {
    const [cat, id] = alvo("[data-remover-adicional]").dataset.removerAdicional.split(",");
    dados.adicionais[cat] = (dados.adicionais[cat] || []).filter((a) => a.id !== id);
    await Fomito.salvarCardapio();
    renderCardapio();
    return toast("Adicional removido", "lixo");
  }
  if (alvo("[data-editar-slide]")) return editarSlide(Number(alvo("[data-editar-slide]").dataset.editarSlide));
  if (alvo("[data-remover-slide]")) {
    const i = Number(alvo("[data-remover-slide]").dataset.removerSlide);
    if (!(await Fomito.confirmar("Remover imagem da vitrine?", `“${dados.lanchonete.vitrine[i]?.titulo || "Imagem"}” sai do topo do cardápio.`, "Remover"))) return;
    dados.lanchonete.vitrine.splice(i, 1);
    await Fomito.salvarCardapio();
    renderCardapio();
    return toast("Imagem removida da vitrine", "lixo");
  }

  /* Editor de produto */
  if (alvo("[data-fechar-editor]")) { cardapio.produto = null; return renderCardapio(); }
  if (alvo("[data-ir-adicionais]")) { cardapio.produto = null; cardapio.aba = "adicionais"; return renderCardapio(); }
  if (alvo("[data-salvar-produto]")) return salvarProduto();
  if (alvo("[data-excluir-produto]")) {
    const p = cardapio.produto;
    if (!(await Fomito.confirmar(`Remover ${p.nome}?`, "O produto sai do cardápio. Os pedidos antigos continuam mostrando o nome dele.", "Remover produto"))) return;
    dados.produtos.splice(dados.produtos.findIndex((x) => x.id === p.id), 1);
    await Fomito.salvarCardapio();
    cardapio.produto = null;
    renderCardapio();
    return toast(`${p.nome} removido do cardápio`, "lixo");
  }
  if (alvo("[data-capa]")) {
    const fotos = cardapio.produto.fotos;
    fotos.unshift(...fotos.splice(Number(alvo("[data-capa]").dataset.capa), 1));
    return atualizarGaleria();
  }
  if (alvo("[data-remover-foto]")) { cardapio.produto.fotos.splice(Number(alvo("[data-remover-foto]").dataset.removerFoto), 1); return atualizarGaleria(); }
  if (alvo("[data-remover-ingrediente]")) {
    cardapio.produto.ingredientes.splice(Number(alvo("[data-remover-ingrediente]").dataset.removerIngrediente), 1);
    renderCardapio();
    return $("#novoIngrediente").focus();
  }
});

document.addEventListener("input", (e) => {
  if (!secaoCardapio().contains(e.target)) return;
  const t = e.target;
  if (t.id === "buscaCardapio") {
    cardapio.busca = t.value;
    renderCardapio();
    const campo = $("#buscaCardapio");
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
    return;
  }
  const p = cardapio.produto;
  if (!p) return;
  if (t.dataset.campo === "preco") p.preco = parseFloat(t.value.replace(/\./g, "").replace(",", ".")) || 0;
  else if (t.dataset.campo) p[t.dataset.campo] = t.value;
  if (t.dataset.campo === "desc") $("#contaDesc").textContent = `${t.value.length}/200`;
  if (t.dataset.legenda) p.fotos[t.dataset.legenda].legenda = t.value;
  atualizarPrevia();
});

document.addEventListener("change", async (e) => {
  if (!secaoCardapio().contains(e.target)) return;
  const t = e.target;
  if (t.dataset.mostrarSlide) {
    dados.lanchonete.vitrine[Number(t.dataset.mostrarSlide)].oculto = !t.checked;
    await Fomito.salvarCardapio();
    return toast(t.checked ? "Imagem aparece no cardápio" : "Imagem escondida do cardápio", "fotos");
  }
  if (t.dataset.disponivel) {
    const p = Fomito.produto(Number(t.dataset.disponivel));
    p.esgotado = !t.checked;
    await Fomito.salvarCardapio();
    return toast(t.checked ? `${p.nome} voltou ao cardápio` : `${p.nome} pausado (aparece como esgotado)`, t.checked ? "check" : "info");
  }
  if (t.dataset.campo === "cat") return renderCardapio(); // troca a lista de adicionais
  if (t.dataset.campoCheck) {
    const chave = t.dataset.campoCheck;
    if (chave === "disponivel") cardapio.produto.esgotado = !t.checked;
    else cardapio.produto[chave] = t.checked;
  }
  /* Fotos enviadas pelo dono: diminuídas aqui; o servidor guarda quando salvar */
  if (t.id === "novaFoto" || t.id === "novoSlide") {
    for (const arquivo of [...t.files]) {
      const src = await Fomito.lerImagem(arquivo);
      if (t.id === "novaFoto") { cardapio.produto.fotos.push({ src, legenda: "" }); atualizarGaleria(); }
      else {
        /* Imagem nova: já abre o editor para dar título e frase antes de publicar */
        await editarSlide(null, { src, titulo: "", texto: "" });
      }
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.id !== "novoIngrediente" || e.key !== "Enter") return;
  const valor = e.target.value.trim();
  if (!valor) return;
  cardapio.produto.ingredientes.push(valor);
  renderCardapio();
  $("#novoIngrediente").focus();
});
