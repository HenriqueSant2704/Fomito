/* ==========================================================================
   FOMITO · FUNÇÕES UTILITÁRIAS
   Pequenas funções usadas por todas as telas. Depende de icones.js e ilustracoes.js.
   ========================================================================== */

window.Fomito = window.Fomito || {};

/* Formata número como moeda: 24.9 -> "R$ 24,90" */
/* Taxa de entrega: R$ 0 vira "Frete grátis" */
Fomito.taxaTexto = (valor) => (Number(valor) > 0 ? Fomito.moeda(Number(valor)) : "Frete grátis");

Fomito.moeda = (valor) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* Atalhos para selecionar elementos */
Fomito.$ = (seletor, raiz = document) => raiz.querySelector(seletor);
Fomito.$$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/* Mostra uma mensagem rápida no rodapé da tela */
Fomito.toast = (mensagem, icone = "check") => {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = icone === "info" ? "toast toast--aviso" : "toast"; // aviso/erro em laranja, confirmação em verde
  el.innerHTML = `${Fomito.icone(icone, "ic--sm")}${mensagem}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
};

/* Texto para busca: sem acento, maiúscula, traço, ponto ou espaço; "cheese" vira "x"
   e "burguer" vira "burger" ("cheeseburger" acha o X-Burguer). Usado em todas as buscas. */
Fomito.paraBusca = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/cheese|chis/g, "x").replace(/burguer/g, "burger").replace(/[^a-z0-9]/g, "");

/* HTML do logo do restaurante (símbolo + nome), vindo das Configurações */
Fomito.logo = (claro = false) => {
  const marca = Fomito.config.ler().marca;
  return `
  <span class="logo ${claro ? "logo--claro" : ""}">
    ${Fomito.config.simbolo(marca)}
    <span class="logo__nome">${marca.nome}</span>
  </span>`;
};

/* Uma foto da galeria: imagem enviada pelo dono (src) ou ilustração (desenho + cena) */
Fomito.imagemFoto = (foto, categoria) => {
  if (foto?.src) return `<img class="foto__img" src="${foto.src}" alt="${foto.legenda || ""}">`;
  return foto && Fomito.cena ? Fomito.cena(foto.desenho, foto.cena, categoria) : Fomito.icone(categoria);
};

/* Miniatura do produto: usa a primeira foto da galeria (a capa) */
Fomito.foto = (produto, tamanho = 56) =>
  `<div class="foto" style="width:${tamanho}px;height:${tamanho}px">${Fomito.imagemFoto(produto.fotos?.[0], produto.cat)}</div>`;

/* Soma o total de uma lista de itens [{id, qtd}] */
Fomito.totalItens = (itens) =>
  itens.reduce((soma, item) => soma + Fomito.produto(item.id).preco * item.qtd, 0);

/* ---------- Janelas no estilo do sistema (no lugar de prompt, alert e confirm) ----------
   Fomito.dialogo({ titulo, texto, topo, campos: [{ id, rotulo, valor, tipo, placeholder, obrigatorio, ajuda }],
                    confirmar, cancelar, perigo, aoDigitar(valores, camada) })
   → Promise com os valores { id: valor } (ou true sem campos), ou null se cancelou. */
Fomito.dialogo = ({ titulo, texto = "", topo = "", campos = [], confirmar = "Confirmar", cancelar = "Cancelar", perigo = false, aoDigitar } = {}) =>
  new Promise((resolver) => {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const camada = document.createElement("div");
    camada.className = "sobreposicao sobreposicao--centro dialogo";
    camada.innerHTML = `
      <form class="folha dialogo__folha" novalidate>
        <div class="folha__topo"><h2>${titulo}</h2><button type="button" class="btn-icone" data-cancelar aria-label="Fechar">${Fomito.icone("fechar")}</button></div>
        ${topo}
        ${texto ? `<p class="suave dialogo__texto">${texto}</p>` : ""}
        ${campos.map((c) => `
          <div class="campo">
            <label for="dlg-${c.id}">${c.rotulo}${c.obrigatorio ? ` <span class="obrigatorio">*</span>` : ""}</label>
            ${c.tipo === "select"
              ? `<select id="dlg-${c.id}" class="input" data-campo-dialogo="${c.id}">${(c.opcoes || []).map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(c.valor) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`
              : c.tipo === "textarea"
              ? `<textarea id="dlg-${c.id}" class="input" rows="2" data-campo-dialogo="${c.id}" placeholder="${esc(c.placeholder)}" maxlength="${c.max || 200}">${esc(c.valor)}</textarea>`
              : `<input id="dlg-${c.id}" class="input" data-campo-dialogo="${c.id}" value="${esc(c.valor)}" placeholder="${esc(c.placeholder)}" maxlength="${c.max || 120}" ${c.tipo === "moeda" ? `inputmode="decimal"` : ""} autocomplete="off">`}
            ${c.ajuda ? `<span class="pequeno fraco">${c.ajuda}</span>` : ""}
          </div>`).join("")}
        <p class="form-erro" hidden></p>
        <div class="dialogo__acoes">
          <button type="button" class="btn btn--contorno" data-cancelar>${cancelar}</button>
          <button type="submit" class="btn ${perigo ? "btn--perigo" : "btn--primario"}">${confirmar}</button>
        </div>
      </form>`;
    document.body.appendChild(camada);
    const form = camada.querySelector("form");
    const valores = () => Object.fromEntries(campos.map((c) => [c.id, form.querySelector(`[data-campo-dialogo="${c.id}"]`).value.trim()]));
    const fechar = (resultado) => { document.removeEventListener("keydown", tecla, true); camada.remove(); resolver(resultado); };
    const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); fechar(null); } };
    document.addEventListener("keydown", tecla, true);
    camada.addEventListener("click", (e) => { if (e.target === camada || e.target.closest("[data-cancelar]")) fechar(null); });
    form.addEventListener("input", () => { form.querySelector(".form-erro").hidden = true; aoDigitar?.(valores(), camada); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = valores();
      const faltando = campos.find((c) => c.obrigatorio && !v[c.id]);
      const erro = faltando ? `Preencha: ${faltando.rotulo.toLowerCase()}.` : campos.map((c) => c.validar?.(v[c.id])).find(Boolean);
      if (erro) { const el = form.querySelector(".form-erro"); el.textContent = erro; el.hidden = false; return; }
      fechar(campos.length ? v : true);
    });
    (form.querySelector("[data-campo-dialogo]") || form.querySelector("[type=submit]")).focus();
  });

/** Pergunta sim/não. Ex.: if (!(await Fomito.confirmar("Cancelar pedido?", "...", "Cancelar pedido"))) return; */
Fomito.confirmar = (titulo, texto, botao = "Confirmar", perigo = true) =>
  Fomito.dialogo({ titulo, texto, confirmar: botao, cancelar: "Voltar", perigo }).then(Boolean);

/* ---------- Funcionamento e localização da loja (Configurações → Loja e entrega) ---------- */
Fomito.DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "18:00" → "18h", "23:30" → "23h30" */
const horaCurta = (h) => {
  const [hh, mm] = String(h || "").split(":");
  return hh ? `${Number(hh)}h${mm && mm !== "00" ? mm : ""}` : "";
};

/** Dias abertos em texto: "Todos os dias", "Qua a Dom" (seguidos, mesmo passando do sábado) ou "Seg, Qua e Sex" */
Fomito.textoDias = (dias) => {
  const lista = [...new Set((dias || []).map(Number))].filter((d) => d >= 0 && d <= 6);
  if (!lista.length) return "";
  if (lista.length === 7) return "Todos os dias";
  /* Procura um começo de onde todos os dias seguem em sequência (ex.: Qua, Qui, Sex, Sáb, Dom) */
  for (const inicio of lista) {
    const seq = lista.map((_, i) => (inicio + i) % 7);
    if (seq.every((d) => lista.includes(d)) && lista.length > 2) return `${Fomito.DIAS[inicio]} a ${Fomito.DIAS[seq.at(-1)]}`;
  }
  const nomes = [1, 2, 3, 4, 5, 6, 0].filter((d) => lista.includes(d)).map((d) => Fomito.DIAS[d]);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : nomes[0];
};

/** "Qua a Dom · 18h às 23h30" (usa o texto livre antigo se não houver dias marcados) */
Fomito.textoFuncionamento = (loja) => {
  const dias = Fomito.textoDias(loja.dias);
  const horas = loja.abre && loja.fecha ? `${horaCurta(loja.abre)} às ${horaCurta(loja.fecha)}` : "";
  return [dias, horas].filter(Boolean).join(" · ") || loja.horario || "";
};

/** Link que abre o mapa no ponto exato: o link colado pelo dono ou a busca pelo endereço */
Fomito.linkMapa = (loja) => {
  if (/^https:\/\//i.test(loja.mapa || "")) return loja.mapa;
  return loja.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loja.endereco)}` : "";
};

/* Fileiras que deslizam para o lado: marca as bordas que ainda têm conteúdo,
   para o CSS esmaecer e o usuário perceber que dá para arrastar */
(() => {
  const SEL = ".filtros, .abas, .filtros-forma, .categorias, .miniaturas, .destaques__trilho, .tabela-rolagem";
  const marcar = (el) => {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle("rola-x", max > 2);
    el.toggleAttribute("data-mais-esq", max > 2 && el.scrollLeft > 2);
    el.toggleAttribute("data-mais-dir", max > 2 && el.scrollLeft < max - 2);
    /* Na primeira vez que cada fileira aparece cortada, ela dá uma "espiadinha" para o lado
       e volta: mostra que dá para arrastar (uma vez por fileira, por visita) */
    const chave = `${el.closest("[data-secao]")?.dataset.secao || ""}|${el.className.replace(/ rola-x/g, "")}`;
    if (max > 24 && el.scrollLeft === 0 && !espiadas.has(chave) && el.getBoundingClientRect().top < innerHeight) {
      espiadas.add(chave);
      setTimeout(() => {
        el.scrollTo({ left: Math.min(48, max), behavior: "smooth" });
        setTimeout(() => el.scrollTo({ left: 0, behavior: "smooth" }), 520);
      }, 450);
    }
  };
  const espiadas = new Set();
  let pendente = false;
  const todas = () => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => { pendente = false; document.querySelectorAll(SEL).forEach(marcar); });
  };
  document.addEventListener("scroll", (e) => { if (e.target.matches?.(SEL)) marcar(e.target); else if (e.target === document) todas(); }, true);
  window.addEventListener("resize", todas);
  const iniciar = () => { todas(); new MutationObserver(todas).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) iniciar(); else document.addEventListener("DOMContentLoaded", iniciar);
})();

/* ---------- Máscaras: telefone e CPF em todos os campos ----------
   Telefone: (00) 00000-0000 (ou (00) 0000-0000 no fixo), no máximo 11 números.
   CPF: 000.000.000-00, no máximo 11 números. O sistema guarda só os números.
   Vale para qualquer campo com inputmode="tel"/type="tel" ou data-mascara="telefone"|"cpf". */
(() => {
  const so = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);
  Fomito.mascaraTelefone = (v) => {
    const d = so(v);
    if (!d) return "";
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  Fomito.mascaraCpf = (v) => {
    const d = so(v);
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(".") + (d.length > 9 ? `-${d.slice(9)}` : "");
  };
  const TEL = 'input[inputmode="tel"], input[type="tel"], input[data-mascara="telefone"]';
  const CPF = 'input[data-mascara="cpf"]';
  const aplicar = (el) => {
    const mascara = el.matches(CPF) ? Fomito.mascaraCpf : el.matches(TEL) ? Fomito.mascaraTelefone : null;
    if (!mascara) return;
    el.maxLength = el.matches(CPF) ? 14 : 15;
    const novo = mascara(el.value);
    if (novo !== el.value) el.value = novo;
  };
  /* Na fase de captura: as telas já leem o valor formatado */
  document.addEventListener("input", (e) => { if (e.target.matches?.(`${TEL}, ${CPF}`)) aplicar(e.target); }, true);
  document.addEventListener("focusin", (e) => { if (e.target.matches?.(`${TEL}, ${CPF}`)) aplicar(e.target); });
})();

/* Documento do convênio: CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00), pela quantidade de números */
(() => {
  Fomito.mascaraDocumento = (v) => {
    const d = String(v || "").replace(/\D/g, "").slice(0, 14);
    if (d.length <= 11) return Fomito.mascaraCpf(d);
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}${d.length > 12 ? `-${d.slice(12)}` : ""}`;
  };
  const DOC = 'input[data-mascara="documento"]';
  const aplicar = (el) => {
    el.maxLength = 18;
    const novo = Fomito.mascaraDocumento(el.value);
    if (novo !== el.value) el.value = novo;
  };
  document.addEventListener("input", (e) => { if (e.target.matches?.(DOC)) aplicar(e.target); }, true);
  document.addEventListener("focusin", (e) => { if (e.target.matches?.(DOC)) aplicar(e.target); });
})();
