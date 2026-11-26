/* ==========================================================================
   FOMITO · ÍCONES DE LINHA
   --------------------------------------------------------------------------
   Uso no JS:   Fomito.icone("sacola")            → <svg ...>
   Uso no HTML: <i data-icone="sacola"></i>          (trocado ao carregar)
   Para adicionar um ícone novo, inclua o desenho (viewBox 24x24) abaixo.
   ========================================================================== */

window.Fomito = window.Fomito || {};

Fomito.icones = {
  inicio:     '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  pedidos:    '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9.5 8h5M9.5 12h5"/>',
  mesa:       '<path d="M3 8h18M5 8v12M19 8v12M8 8V5h8v3"/><path d="M5 14h14"/>',
  cardapio:   '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  ajustes:    '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  sino:       '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  busca:      '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  voltar:     '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  seta:       '<path d="m9 6 6 6-6 6"/>',
  cima:       '<path d="m6 15 6-6 6 6"/>',
  baixo:      '<path d="m6 9 6 6 6-6"/>',
  telefone:   '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mais:       '<path d="M12 5v14M5 12h14"/>',
  menos:      '<path d="M5 12h14"/>',
  lixo:       '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  fechar:     '<path d="M18 6 6 18M6 6l12 12"/>',
  check:      '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  sacola:     '<path d="M5.5 7.5h13l-1 13h-11z"/><path d="M9 7.5a3 3 0 0 1 6 0"/>',
  entrega:    '<path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  local:      '<path d="M4 3v7a2.5 2.5 0 0 0 5 0V3M6.5 3v18"/><path d="M17.5 3c-2 0-3 2.5-3 6s1 4 3 4v8"/>',
  pin:        '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  dinheiro:   '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  pix:        '<path d="m12 3 9 9-9 9-9-9z"/><path d="m8 12 4-4 4 4-4 4z"/>',
  cartao:     '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6.5 15h4"/>',
  relogio:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pessoas:    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21 20c0-2.6-1.6-4.8-4-5.6"/>',
  usuario:    '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5"/>',
  chef:       '<path d="M6.5 14A4 4 0 0 1 7.6 6.3a4.8 4.8 0 0 1 8.8 0A4 4 0 0 1 17.5 14v6h-11z"/><path d="M6.5 17h11"/>',
  chama:      '<path d="M12 3s5 4.5 5 10a5 5 0 0 1-10 0c0-2.4 1.4-4 1.4-4s.6 2 2.1 2C10.5 7 12 3 12 3z"/>',
  recebido:   '<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  concluido:  '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  estrela:    '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  loja:       '<path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16"/><path d="M9.5 20v-5h5v5"/>',
  sobe:       '<path d="m4 16 5.5-5.5 4 4L20 8"/><path d="M15 8h5v5"/>',
  desce:      '<path d="m4 8 5.5 5.5 4-4L20 16"/><path d="M15 16h5v-5"/>',
  alvo:       '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
  moeda:      '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.4-.8-1.3-1.2-2.5-1.2-1.5 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4.1 0 1.1-1 2-2.5 2-1.3 0-2.3-.5-2.7-1.4M12 6.5V8M12 16v1.5"/>',
  editar:     '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  externo:    '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  info:       '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  conta:      '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M14.5 8.5c-.3-.6-1-1-2-1-1.2 0-2 .6-2 1.5 0 2 4.5 1 4.5 3 0 .9-.9 1.5-2.2 1.5-1 0-1.8-.4-2.1-1M12.5 6.5v1M12.5 14v1"/>',
  grade:      '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  fotos:      '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-8.5 8"/>',
  cadeado:    '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  sair:       '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  equipe:     '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M19 8v6M16 11h6"/>',
  whatsapp:   '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.8z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.6-2-1-1 .8c-1-.5-1.8-1.3-2.2-2.2l.8-1-1-2z"/>',
  impressora: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/><path d="M17 12h.01"/>',
  somoff:     '<path d="M6 9a6 6 0 0 1 9.5-4.9M18 9c0 6 2.5 8 2.5 8H8"/><path d="M10 20.5a2 2 0 0 0 4 0"/><path d="M3 3l18 18"/>',
  paleta:     '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1-.8-1.4-.8-2.3 0-1 .8-1.7 1.8-1.7h2.2a3.5 3.5 0 0 0 3.5-3.5c0-4.3-3.8-7.8-8.5-7.8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.3" r="1"/><circle cx="14.5" cy="7.3" r="1"/>',
  /* categorias */
  lanches:    '<path d="M4 11a8 5.5 0 0 1 16 0z"/><path d="M3 14h18"/><path d="M4.5 17h15a1.5 1.5 0 0 1-1.5 2.5H6A1.5 1.5 0 0 1 4.5 17z"/>',
  porcoes:    '<path d="M6 10h12l-1.8 10.5H7.8z"/><path d="M8.5 10 7.5 4M11 10V3.5M13.5 10l.8-5.5M16 10l1.2-4"/>',
  bebidas:    '<path d="M6.5 8h11l-1.4 12.5H7.9z"/><path d="M5.5 8h13M12 8l1.5-4.5H17"/>',
};

Fomito.icone = (nome, classe = "") =>
  `<svg class="ic ${classe}" viewBox="0 0 24 24" aria-hidden="true">${Fomito.icones[nome] || ""}</svg>`;

/* Troca todos os <i data-icone="..."> da página pelo SVG */
Fomito.aplicarIcones = (raiz = document) =>
  raiz.querySelectorAll("i[data-icone]").forEach((el) => {
    el.outerHTML = Fomito.icone(el.dataset.icone, el.className);
  });

document.addEventListener("DOMContentLoaded", () => Fomito.aplicarIcones());
