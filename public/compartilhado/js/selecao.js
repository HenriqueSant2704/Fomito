/* ==========================================================================
   FOMITO · CAIXA DE ESCOLHA (no lugar do <select> do navegador)
   --------------------------------------------------------------------------
   Toda <select> que aparecer em qualquer tela vira, sozinha, uma caixa no
   visual do sistema: botão arredondado e uma lista que abre por baixo dele
   (no celular, a lista sobe de baixo da tela). Listas com mais de 7 opções
   ganham um campo "Buscar" no topo, que ignora acento, traço e maiúscula.

   Nada muda para quem escreve as telas:
     - continua escrevendo <select> com <option> normalmente;
     - select.value lê e muda o valor (o botão acompanha);
     - os avisos "input" e "change" saem da <select> como antes.

   Opções no formato "Nome · detalhe" (ex.: "X Salada · R$ 25,00") mostram o
   detalhe à direita, em cinza.
   Para manter a caixa do navegador numa <select>: <select data-nativo>.
   Para mostrar cada opção na própria fonte (escolha de fonte): <select data-fontes>.

   Teclado: setas, Enter, Esc, Home/End e letras (abre buscando).
   ========================================================================== */

(() => {
  const BUSCA_A_PARTIR = 8; // a partir de quantas opções aparece o campo "Buscar"
  const celular = () => matchMedia("(max-width: 640px)").matches;
  const toqueNaTela = () => matchMedia("(pointer: coarse)").matches;
  const icone = (nome, reserva) => (Fomito.icone ? Fomito.icone(nome) : reserva);
  const SETA = '<svg class="sel__seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  const paraBusca = (t) => (Fomito.paraBusca ? Fomito.paraBusca(t) : String(t || "").toLowerCase());
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  /* O "value" e o "selectedIndex" originais da <select>: usados para mudar o valor
     sem cair de novo no nosso aviso (que só atualiza o texto do botão). */
  const VALOR = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  const INDICE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");

  let contador = 0;
  let aberta = null; // { sel, botao, painel, fundo, lista, busca, opcoes, ativo }

  /* ---------- Botão no lugar da <select> ---------- */
  function melhorar(sel) {
    if (sel.dataset.selPronta || sel.multiple || sel.hasAttribute("data-nativo")) return;
    sel.dataset.selPronta = "1";
    const id = `sel${++contador}`;
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = `${sel.className} sel__botao`.trim();
    botao.id = `${id}-botao`;
    botao.setAttribute("aria-haspopup", "listbox");
    botao.setAttribute("aria-expanded", "false");
    botao.innerHTML = `<span class="sel__texto"></span>${SETA}`;

    /* O rótulo (<label for>) passa a apontar para o botão */
    const rotulo = !sel.id ? null : document.querySelector(`label[for="${CSS.escape(sel.id)}"]`);
    if (rotulo) rotulo.htmlFor = botao.id;
    else if (sel.getAttribute("aria-label")) botao.setAttribute("aria-label", sel.getAttribute("aria-label"));
    botao._rotulo = rotulo?.textContent.replace("*", "").trim() || sel.getAttribute("aria-label") || "Escolher";

    sel.classList.add("sel__nativa");
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");
    sel.after(botao);
    sel._botao = botao;
    botao._sel = sel;

    /* Quem muda o valor pelo código vê o botão acompanhar */
    Object.defineProperty(sel, "value", { configurable: true, get() { return VALOR.get.call(this); }, set(v) { VALOR.set.call(this, v); atualizar(this); } });
    Object.defineProperty(sel, "selectedIndex", { configurable: true, get() { return INDICE.get.call(this); }, set(v) { INDICE.set.call(this, v); atualizar(this); } });
    sel.addEventListener("change", () => atualizar(sel));
    sel.addEventListener("focus", () => botao.focus()); // ex.: a janela foca o 1º campo
    new MutationObserver(() => atualizar(sel)).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "selected"] });

    botao.addEventListener("click", () => (aberta?.sel === sel ? fechar() : abrir(sel)));
    botao.addEventListener("keydown", (e) => {
      if (aberta?.sel === sel) return;
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); abrir(sel); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); abrir(sel, e.key); }
    });
    atualizar(sel);
    if (document.activeElement === sel) botao.focus({ preventScroll: true });
  }

  /* Texto do botão = opção escolhida */
  function atualizar(sel) {
    const botao = sel._botao;
    if (!botao) return;
    const op = sel.options[INDICE.get.call(sel)];
    const [nome, detalhe] = partes(op?.textContent || "");
    botao.querySelector(".sel__texto").innerHTML = `${esc(nome)}${detalhe ? ` <span class="sel__detalhe">· ${esc(detalhe)}</span>` : ""}`;
    botao.querySelector(".sel__texto").style.fontFamily = sel.hasAttribute("data-fontes") && op ? `"${op.value || op.textContent}", var(--fonte-texto)` : "";
    botao.disabled = sel.disabled;
    botao.title = op?.textContent || "";
  }

  /* "X Salada · R$ 25,00" → ["X Salada", "R$ 25,00"] */
  const partes = (texto) => {
    const i = texto.lastIndexOf(" · ");
    return i > 0 ? [texto.slice(0, i), texto.slice(i + 3)] : [texto, ""];
  };

  /* ---------- Lista aberta ---------- */
  function abrir(sel, letra = "") {
    fechar(false);
    const botao = sel._botao;
    const opcoes = [...sel.options].map((op, i) => ({ op, i, chave: paraBusca(op.textContent) }));
    const temBusca = opcoes.length >= BUSCA_A_PARTIR;
    const noCelular = celular();
    const id = `${botao.id}-lista`;
    const fontes = sel.hasAttribute("data-fontes");

    const painel = document.createElement("div");
    painel.className = `sel-painel${noCelular ? " sel-painel--folha" : ""}`;
    painel.innerHTML = `
      ${noCelular ? `<div class="sel-painel__topo"><strong>${esc(botao._rotulo)}</strong><button type="button" class="sel-painel__fechar" aria-label="Fechar">${icone("fechar", "×")}</button></div>` : ""}
      ${temBusca ? `<label class="sel-busca">${icone("busca", "")}<input type="text" enterkeyhint="search" placeholder="Buscar…" autocomplete="off" spellcheck="false" aria-controls="${id}" aria-label="Buscar na lista"></label>` : ""}
      <ul class="sel-lista" role="listbox" id="${id}" tabindex="-1" aria-label="${esc(botao._rotulo)}">
        ${opcoes.map(({ op, i }) => {
          const [nome, detalhe] = partes(op.textContent);
          const escolhida = i === INDICE.get.call(sel);
          return `<li class="sel-op${escolhida ? " escolhida" : ""}${op.disabled ? " desligada" : ""}" role="option" id="${id}-${i}" data-i="${i}" aria-selected="${escolhida}" ${op.disabled ? 'aria-disabled="true"' : ""}>
            <span class="sel-op__nome"${fontes ? ` style="font-family:'${esc(op.value || op.textContent)}', var(--fonte-texto)"` : ""}>${esc(nome) || "&nbsp;"}</span>
            ${detalhe ? `<span class="sel-op__detalhe">${esc(detalhe)}</span>` : ""}
            <span class="sel-op__marca">${icone("check", "✓")}</span>
          </li>`;
        }).join("")}
      </ul>
      <p class="sel-vazio" hidden>Nada encontrado com esse nome.</p>`;

    let fundo = null;
    if (noCelular) {
      fundo = document.createElement("div");
      fundo.className = "sel-fundo";
      fundo.addEventListener("click", () => fechar());
      document.body.appendChild(fundo);
    }
    document.body.appendChild(painel);

    aberta = { sel, botao, painel, fundo, lista: painel.querySelector(".sel-lista"), busca: painel.querySelector(".sel-busca input"), opcoes, ativo: -1 };
    botao.setAttribute("aria-expanded", "true");
    botao.setAttribute("aria-controls", id);
    botao.classList.add("sel__botao--aberto");

    painel.addEventListener("mousedown", (e) => { if (!e.target.closest("input")) e.preventDefault(); }); // não tira o foco
    painel.querySelector(".sel-painel__fechar")?.addEventListener("click", () => fechar());
    aberta.lista.addEventListener("click", (e) => {
      const li = e.target.closest(".sel-op");
      if (li && !li.classList.contains("desligada")) escolher(Number(li.dataset.i));
    });
    aberta.lista.addEventListener("mousemove", (e) => {
      const li = e.target.closest(".sel-op");
      if (li) marcar(Number(li.dataset.i), false);
    });
    aberta.busca?.addEventListener("input", filtrar);

    posicionar();
    marcar(INDICE.get.call(sel) >= 0 ? INDICE.get.call(sel) : primeiraVisivel(), true);

    /* Foco: no campo de busca (no computador) ou na lista */
    if (aberta.busca && letra) { aberta.busca.value = letra; filtrar(); }
    if (aberta.busca && (!toqueNaTela() || letra)) aberta.busca.focus();
    else aberta.lista.focus({ preventScroll: true });
    if (!aberta.busca && letra) pularPelaLetra(letra);
    requestAnimationFrame(() => painel.classList.add("sel-painel--visivel"));
  }

  function fechar(voltarFoco = true) {
    if (!aberta) return;
    const { botao, painel, fundo } = aberta;
    aberta = null;
    botao.setAttribute("aria-expanded", "false");
    botao.removeAttribute("aria-controls");
    botao.classList.remove("sel__botao--aberto");
    painel.remove();
    fundo?.remove();
    if (voltarFoco && botao.isConnected) botao.focus({ preventScroll: true });
  }

  function escolher(i) {
    const { sel } = aberta;
    const mudou = i !== INDICE.get.call(sel);
    INDICE.set.call(sel, i);
    atualizar(sel);
    fechar();
    if (mudou) {
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  /* Só mostra as opções que batem com o que foi escrito */
  function filtrar() {
    /* Cada palavra escrita precisa aparecer no nome: "porcao bat" acha "Porção de Batata" */
    const palavras = aberta.busca.value.split(/\s+/).map(paraBusca).filter(Boolean);
    let visiveis = 0;
    aberta.opcoes.forEach(({ i, chave }) => {
      const li = aberta.lista.children[i];
      const mostra = palavras.every((p) => chave.includes(p));
      li.hidden = !mostra;
      if (mostra) visiveis++;
    });
    aberta.painel.querySelector(".sel-vazio").hidden = visiveis > 0;
    const atual = aberta.lista.children[aberta.ativo];
    if (!atual || atual.hidden) marcar(primeiraVisivel(), true);
  }

  const visiveis = () => [...aberta.lista.children].filter((li) => !li.hidden && !li.classList.contains("desligada")).map((li) => Number(li.dataset.i));
  const primeiraVisivel = () => visiveis()[0] ?? -1;

  /* Opção destacada (setas do teclado / mouse por cima) */
  function marcar(i, rolar) {
    const lista = aberta.lista;
    lista.querySelector(".ativa")?.classList.remove("ativa");
    aberta.ativo = i;
    const li = lista.children[i];
    const alvo = aberta.busca || lista;
    if (!li) { alvo.removeAttribute("aria-activedescendant"); return; }
    li.classList.add("ativa");
    alvo.setAttribute("aria-activedescendant", li.id);
    if (rolar) li.scrollIntoView({ block: "nearest" });
  }

  function mover(passo) {
    const lista = visiveis();
    if (!lista.length) return;
    const pos = lista.indexOf(aberta.ativo);
    const novo = passo === Infinity ? lista.at(-1) : passo === -Infinity ? lista[0]
      : lista[Math.min(lista.length - 1, Math.max(0, (pos < 0 ? (passo > 0 ? -1 : lista.length) : pos) + passo))];
    marcar(novo, true);
  }

  /* Sem busca: a letra pula para a próxima opção que começa com ela */
  function pularPelaLetra(letra) {
    const l = paraBusca(letra);
    const lista = visiveis();
    const depois = [...lista.filter((i) => i > aberta.ativo), ...lista.filter((i) => i <= aberta.ativo)];
    const achou = depois.find((i) => aberta.opcoes[i].chave.startsWith(l));
    if (achou !== undefined) marcar(achou, true);
  }

  /* Lista logo abaixo do botão (ou acima, se não couber); no celular é a folha de baixo */
  function posicionar() {
    if (!aberta || aberta.painel.classList.contains("sel-painel--folha")) return;
    const { botao, painel, lista } = aberta;
    const r = botao.getBoundingClientRect();
    const alturaTela = window.innerHeight;
    const largura = Math.min(Math.max(r.width, 240), window.innerWidth - 16);
    const espacoAbaixo = alturaTela - r.bottom - 12;
    const espacoAcima = r.top - 12;
    const paraCima = espacoAbaixo < 240 && espacoAcima > espacoAbaixo;
    const extra = painel.offsetHeight - lista.offsetHeight; // busca + margens
    lista.style.maxHeight = `${Math.max(120, Math.min(320, (paraCima ? espacoAcima : espacoAbaixo) - extra - 6))}px`;
    painel.style.width = `${largura}px`;
    painel.style.left = `${Math.min(Math.max(8, r.left), window.innerWidth - largura - 8)}px`;
    if (paraCima) { painel.style.top = ""; painel.style.bottom = `${alturaTela - r.top + 6}px`; }
    else { painel.style.bottom = ""; painel.style.top = `${r.bottom + 6}px`; }
    painel.classList.toggle("sel-painel--cima", paraCima);
  }

  /* ---------- Teclado com a lista aberta ----------
     Fica na "window" e na fase de captura: assim o Esc fecha só a lista,
     e não a janela que está por trás dela. */
  window.addEventListener("keydown", (e) => {
    if (!aberta) return;
    const k = e.key;
    const parar = () => { e.preventDefault(); e.stopPropagation(); };
    if (k === "Escape") { parar(); fechar(); }
    else if (k === "ArrowDown") { parar(); mover(1); }
    else if (k === "ArrowUp") { parar(); mover(-1); }
    else if (k === "PageDown") { parar(); mover(8); }
    else if (k === "PageUp") { parar(); mover(-8); }
    else if (k === "Home" && !aberta.busca) { parar(); mover(-Infinity); }
    else if (k === "End" && !aberta.busca) { parar(); mover(Infinity); }
    else if (k === "Enter" || (k === " " && !aberta.busca)) { parar(); if (aberta.ativo >= 0 && !aberta.lista.children[aberta.ativo].hidden) escolher(aberta.ativo); }
    else if (k === "Tab") { fechar(false); }
    else if (!aberta.busca && k.length === 1 && !e.ctrlKey && !e.metaKey) { parar(); pularPelaLetra(k); }
  }, true);

  /* Clique fora fecha; rolar a página ou mudar o tamanho reposiciona */
  document.addEventListener("pointerdown", (e) => {
    if (aberta && !aberta.painel.contains(e.target) && !aberta.botao.contains(e.target) && e.target !== aberta.fundo) fechar(false);
  }, true);
  window.addEventListener("resize", () => posicionar());
  document.addEventListener("scroll", (e) => { if (aberta && !aberta.painel.contains(e.target)) posicionar(); }, true);

  /* ---------- Acha as <select> novas sozinho ----------
     As telas redesenham partes da página a toda hora: cada <select> nova é melhorada
     assim que entra na página. Se a <select> da lista aberta sair, a lista fecha. */
  const varrer = (raiz) => {
    if (raiz.nodeType !== 1) return;
    if (raiz.tagName === "SELECT") melhorar(raiz);
    else raiz.querySelectorAll?.("select").forEach(melhorar);
  };
  new MutationObserver((mudancas) => {
    mudancas.forEach((m) => m.addedNodes.forEach(varrer));
    if (aberta && !aberta.sel.isConnected) fechar(false);
  }).observe(document.documentElement, { childList: true, subtree: true });
  varrer(document.body || document.documentElement);

  Fomito.selecao = { melhorar, fechar };
})();
