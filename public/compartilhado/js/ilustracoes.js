/* ==========================================================================
   FOMITO · ILUSTRAÇÕES DOS PRODUTOS (só para o protótipo)
   --------------------------------------------------------------------------
   No sistema real, cada foto é enviada pelo dono da lanchonete.
   Aqui desenhamos as "fotos" em SVG para mostrar como a galeria funciona.

   Uso:  Fomito.cena("xburguer", "produto")   → <svg> pronto para a galeria
   Cenas: "produto" (foto principal), "close" (detalhe), "combo",
          "chapa" (preparo), "entrega" (sacola) e "salao" (ambiente).
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  let contador = 0;
  const id = (nome) => `${nome}-${++contador}`;

  /* ---------- Peças de lanche ---------- */
  function paoTopo(g) {
    return `
      <path d="M-100 8 C-100 -62 100 -62 100 8 Q100 16 90 16 H-90 Q-100 16 -100 8z" fill="url(#${g})"/>
      <path d="M-78 -18 C-60 -44 -20 -52 10 -50" stroke="#FFE2A8" stroke-width="7" stroke-linecap="round" fill="none" opacity=".55"/>
      ${[[-48,-30],[-20,-40],[12,-42],[42,-34],[-62,-10],[64,-16],[-30,-14],[2,-22],[32,-14]]
        .map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="3" fill="#FFF6DF" transform="rotate(${(i * 23) % 50 - 25} ${x} ${y})"/>`).join("")}`;
  }
  const alface = (y = 16) => `<path d="M-106 ${y} q10 -10 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 l0 10 h-212z" fill="#58B947"/>`;
  const tomate = (y = 24) => `<rect x="-92" y="${y}" width="184" height="10" rx="5" fill="#E2483D"/>`;
  const carne = (y = 30, alt = 26) => `
    <rect x="-98" y="${y}" width="196" height="${alt}" rx="${alt / 2}" fill="#5A2E1B"/>
    <path d="M-80 ${y + 9} h30 M-30 ${y + 14} h40 M30 ${y + 8} h36" stroke="#7A4128" stroke-width="3" stroke-linecap="round"/>`;
  const queijo = (y = 28) => `<path d="M-100 ${y} H100 L92 ${y + 8} L70 ${y + 22} L58 ${y + 8} L20 ${y + 8} L8 ${y + 26} L-6 ${y + 8} L-52 ${y + 8} L-66 ${y + 20} L-78 ${y + 8} Z" fill="#FFC329"/>`;
  const bacon = (y = 22) => `
    <path d="M-104 ${y} q16 -8 32 0 t32 0 t32 0 t32 0 t32 0 t32 0 t20 -2 v9 q-16 8 -32 0 t-32 0 t-32 0 t-32 0 t-32 0 t-32 0 t-20 2z" fill="#B6452C"/>
    <path d="M-96 ${y + 3} q16 -6 32 0 t32 0 t32 0 t32 0 t32 0 t32 0" stroke="#F3B49A" stroke-width="2" fill="none"/>`;
  const paoBase = (y, g) => `<path d="M-94 ${y} H94 Q96 ${y + 26} 70 ${y + 28} H-70 Q-96 ${y + 26} -94 ${y}z" fill="url(#${g})"/>`;

  function hamburguer(tipo = "simples") {
    const g = id("pao"), g2 = id("paob");
    const defs = `<defs>
      <linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6BE63"/><stop offset="1" stop-color="#D88A2C"/></linearGradient>
      <linearGradient id="${g2}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9A24B"/><stop offset="1" stop-color="#C77A28"/></linearGradient></defs>`;
    let recheio;
    if (tipo === "bacon") recheio = alface(14) + bacon(26) + queijo(34) + carne(40) + paoBase(66, g2);
    else if (tipo === "tudo") recheio = alface(14) + tomate(23) + bacon(34) + queijo(42) + carne(48, 22) + queijo(70) + carne(76, 22) + paoBase(98, g2);
    else recheio = alface(14) + tomate(23) + queijo(32) + carne(38) + paoBase(64, g2);
    return `${defs}<ellipse cx="0" cy="${tipo === "tudo" ? 130 : 98}" rx="120" ry="14" fill="#000" opacity=".12"/>${recheio}${paoTopo(g)}`;
  }

  function cachorroQuente() {
    const g = id("hd");
    return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3B65A"/><stop offset="1" stop-color="#CF8129"/></linearGradient></defs>
      <ellipse cx="0" cy="62" rx="140" ry="12" fill="#000" opacity=".12"/>
      <path d="M-130 10 Q-130 54 -90 56 H90 Q130 54 130 10z" fill="url(#${g})"/>
      <rect x="-140" y="-6" width="280" height="28" rx="14" fill="#B5432A"/>
      <path d="M-120 2 q12 -10 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" stroke="#FFD43B" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M-118 -2 Q-118 -26 -92 -26 H92 Q118 -26 118 -2" fill="url(#${g})" opacity=".95"/>
      ${[-80, -40, 0, 40, 80].map((x) => `<rect x="${x - 6}" y="-38" width="12" height="4" rx="2" fill="#F7D66B" transform="rotate(${x % 3 * 10} ${x} -36)"/>`).join("")}`;
  }

  function misto() {
    return `<ellipse cx="0" cy="66" rx="120" ry="12" fill="#000" opacity=".12"/>
      <g transform="rotate(-8)">
        <rect x="-90" y="-40" width="180" height="100" rx="18" fill="#E7B36A"/>
        <rect x="-82" y="-32" width="164" height="84" rx="14" fill="#F8DDA8"/>
        <path d="M-82 4 H82" stroke="#F4A9A0" stroke-width="10"/>
        <path d="M-82 16 H82 L70 30 L52 16 L10 16 L-2 34 L-14 16 L-82 16z" fill="#FFC329"/>
        <path d="M-60 -12 l20 20 M-20 -12 l20 20 M20 -12 l20 20" stroke="#C98B3F" stroke-width="4" stroke-linecap="round" opacity=".6"/>
      </g>`;
  }

  /* ---------- Porções ---------- */
  function batata(cobertura = false) {
    const palitos = Array.from({ length: 13 }, (_, i) => {
      const x = -66 + i * 11, h = 70 + ((i * 37) % 30), r = (i % 5 - 2) * 5;
      return `<rect x="${x}" y="${-h + 10}" width="12" height="${h}" rx="3" fill="${i % 3 ? "#FFC83D" : "#F4B42A"}" transform="rotate(${r} ${x} 20)"/>`;
    }).join("");
    const extra = cobertura
      ? `<path d="M-74 -30 Q-40 -10 -10 -34 Q20 -8 50 -32 Q70 -16 80 -28 L74 4 H-74z" fill="#FFB020"/>${[-50, -20, 14, 44].map((x) => `<rect x="${x}" y="-30" width="14" height="7" rx="2" fill="#A63E25" transform="rotate(${x % 20} ${x} -26)"/>`).join("")}`
      : "";
    return `<ellipse cx="0" cy="108" rx="96" ry="12" fill="#000" opacity=".12"/>
      ${palitos}${extra}
      <path d="M-84 0 H84 L68 104 H-68z" fill="#E2483D"/>
      <path d="M-84 0 H84 L82 14 H-82z" fill="#C73A30"/>
      <path d="M-22 40 v40 M-22 40 h22 M-22 58 h16" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/>`;
  }

  function tigela(conteudo) {
    return `<ellipse cx="0" cy="84" rx="130" ry="14" fill="#000" opacity=".12"/>
      ${conteudo}
      <path d="M-124 10 H124 Q118 80 0 84 Q-118 80 -124 10z" fill="#FFFFFF"/>
      <path d="M-124 10 H124 Q122 22 118 30 H-118 Q-122 22 -124 10z" fill="#EDE9F3"/>`;
  }
  const frango = () => tigela([[-70, -6], [-30, -22], [12, -14], [52, -26], [86, -2], [-40, 8], [30, 6]]
    .map(([x, y], i) => `<path d="M${x - 26} ${y + 10} q-6 -30 22 -34 q30 -4 32 24 q2 20 -24 22 q-24 2 -30 -12z" fill="${i % 2 ? "#D98C2F" : "#C77A28"}"/><circle cx="${x - 4}" cy="${y - 8}" r="3" fill="#F6C46D"/>`).join(""));
  const calabresa = () => tigela([[-80, 0], [-44, -16], [-6, -6], [34, -18], [72, -2], [-20, 8], [52, 10]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20" fill="#A8322A"/><circle cx="${x}" cy="${y}" r="13" fill="#C9473B"/><circle cx="${x - 4}" cy="${y - 3}" r="2.4" fill="#F2B6A8"/><circle cx="${x + 5}" cy="${y + 4}" r="2" fill="#F2B6A8"/>`).join("")
    + `<path d="M-90 -14 q20 -16 40 0 M10 -24 q20 -14 40 0 M40 2 q16 -12 32 0" stroke="#F5E7FF" stroke-width="5" fill="none" stroke-linecap="round"/>`);

  /* ---------- Bebidas ---------- */
  function lata(cor = "#E2483D") {
    return `<ellipse cx="0" cy="106" rx="62" ry="10" fill="#000" opacity=".12"/>
      <rect x="-48" y="-84" width="96" height="188" rx="16" fill="${cor}"/>
      <rect x="-44" y="-94" width="88" height="16" rx="8" fill="#C9CDD6"/>
      <rect x="-30" y="-84" width="14" height="188" fill="#fff" opacity=".18"/>
      <path d="M-48 10 q24 -22 48 0 t48 0" stroke="#fff" stroke-width="8" fill="none"/>
      <rect x="-48" y="88" width="96" height="16" rx="8" fill="#000" opacity=".12"/>`;
  }
  function copo(liquido = "#FFA530", fruta = true) {
    return `<ellipse cx="0" cy="104" rx="66" ry="10" fill="#000" opacity=".12"/>
      <path d="M22 -110 L40 -150 H60" stroke="#4B2B8F" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M-56 -70 H56 L46 100 H-46z" fill="#F4F2FA" opacity=".9"/>
      <path d="M-52 -40 H52 L44 96 H-44z" fill="${liquido}"/>
      <path d="M-40 -40 L-34 90" stroke="#fff" stroke-width="7" opacity=".35"/>
      ${fruta ? `<circle cx="-50" cy="-68" r="26" fill="#FFD43B"/><circle cx="-50" cy="-68" r="20" fill="#FFE98A"/><path d="M-50 -88 V-48 M-70 -68 H-30 M-64 -82 L-36 -54 M-36 -82 L-64 -54" stroke="#FFD43B" stroke-width="2.5"/>` : ""}`;
  }
  function garrafa(cor = "#7A3E12", rotulo = "#FFC329", alta = true) {
    const topo = alta ? -150 : -110;
    return `<ellipse cx="0" cy="108" rx="54" ry="10" fill="#000" opacity=".12"/>
      <path d="M-14 ${topo} H14 V${topo + 60} Q44 ${topo + 90} 44 ${topo + 120} V100 Q44 106 36 106 H-36 Q-44 106 -44 100 V${topo + 120} Q-44 ${topo + 90} -14 ${topo + 60}z" fill="${cor}"/>
      <rect x="-16" y="${topo - 10}" width="32" height="14" rx="4" fill="#C9CDD6"/>
      <rect x="-44" y="10" width="88" height="56" rx="6" fill="${rotulo}"/>
      <path d="M-22 ${topo + 20} V60" stroke="#fff" stroke-width="7" opacity=".22" stroke-linecap="round"/>`;
  }

  /* Qual desenho usar para cada produto */
  const desenhos = {
    xburguer: () => hamburguer("simples"),
    xbacon: () => hamburguer("bacon"),
    xtudo: () => hamburguer("tudo"),
    misto: misto,
    hotdog: cachorroQuente,
    batata: () => batata(false),
    batatacheddar: () => batata(true),
    frango: frango,
    calabresa: calabresa,
    refri: () => lata("#E2483D"),
    suco: () => copo("#FFA530"),
    agua: () => garrafa("#9BD3F2", "#FFFFFF", false),
    cerveja: () => garrafa("#7A3E12", "#FFC329", true),
  };

  /* Fundos (tons quentes e roxos da marca, em versão "foto") */
  const fundos = {
    lanches: ["#FFE7C7", "#FFC98A"],
    porcoes: ["#FFF0C2", "#FFD36B"],
    bebidas: ["#E8E1FA", "#C4B3F0"],
    escuro:  ["#2A1757", "#140B2E"],
  };

  function svg(conteudo, [c1, c2], extra = "") {
    const g = id("fundo");
    return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><radialGradient id="${g}" cx="35%" cy="25%" r="90%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
      <rect width="400" height="300" fill="url(#${g})"/>${extra}${conteudo}</svg>`;
  }
  const prato = `<ellipse cx="200" cy="232" rx="170" ry="34" fill="#fff" opacity=".55"/>`;

  /**
   * Monta uma "foto" do produto.
   * @param {string} desenho  chave em `desenhos` (ex.: "xbacon")
   * @param {string} tipo     "produto" | "close" | "combo" | "chapa" | "entrega" | "salao"
   * @param {string} categoria lanches | porcoes | bebidas (define o fundo)
   */
  Fomito.cena = (desenho, tipo = "produto", categoria = "lanches") => {
    const item = (desenhos[desenho] || desenhos.xburguer)();
    const fundo = fundos[categoria] || fundos.lanches;

    switch (tipo) {
      case "close":
        return svg(`<g transform="translate(220 190) scale(1.9)">${item}</g>`, fundo);
      case "combo":
        return svg(`${prato}
          <g transform="translate(300 170) scale(.62)">${lata("#E2483D")}</g>
          <g transform="translate(96 168) scale(.66)">${batata(false)}</g>
          <g transform="translate(200 186) scale(.92)">${item}</g>`, fundos.lanches,
          `<circle cx="340" cy="50" r="90" fill="#fff" opacity=".18"/>`);
      case "chapa":
        return svg(`
          ${Array.from({ length: 9 }, (_, i) => `<rect x="20" y="${150 + i * 16}" width="360" height="5" rx="2.5" fill="#3E2A6B"/>`).join("")}
          ${[100, 200, 300].map((x, i) => `<g transform="translate(${x} ${186 + (i % 2) * 14})"><ellipse rx="56" ry="20" fill="#5A2E1B"/><path d="M-36 -4 h70 M-30 6 h60" stroke="#2E1609" stroke-width="5" stroke-linecap="round"/></g>`).join("")}
          ${[[80, 120], [150, 104], [230, 116], [310, 100]].map(([x, y]) => `<path d="M${x} ${y} q-14 -24 6 -46 q-2 22 14 26 q6 -16 2 -30 q24 22 6 50z" fill="#FF8A00" opacity=".85"/>`).join("")}
          ${[[110, 60], [190, 40], [270, 64]].map(([x, y]) => `<path d="M${x} ${y + 40} q-14 -20 0 -40 t0 -40" stroke="#fff" stroke-width="4" fill="none" opacity=".25" stroke-linecap="round"/>`).join("")}`, fundos.escuro);
      case "entrega":
        return svg(`${prato}
          <g transform="translate(200 150)">
            <path d="M-80 -70 H80 L92 90 H-92z" fill="#4B2B8F"/>
            <path d="M-40 -70 a40 34 0 0 1 80 0" stroke="#2A1757" stroke-width="10" fill="none"/>
            <rect x="-30" y="-20" width="60" height="60" rx="16" fill="#FF8A00"/>
            <path d="M-10 26 V-6 H12 M-10 9 H8" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </g>
          ${[[120, 50], [280, 40]].map(([x, y]) => `<path d="M${x} ${y + 40} q-12 -20 0 -40 t0 -40" stroke="#fff" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"/>`).join("")}`, fundos.bebidas);
      case "salao":
        return svg(`
          <rect x="0" y="210" width="400" height="90" fill="#8B5A2B" opacity=".55"/>
          ${[[80, 70], [200, 50], [320, 70]].map(([x, y]) => `<g><path d="M${x} 0 V${y}" stroke="#2A1757" stroke-width="2"/><path d="M${x - 26} ${y + 26} Q${x} ${y - 6} ${x + 26} ${y + 26}z" fill="#2A1757"/><circle cx="${x}" cy="${y + 30}" r="40" fill="#FFD27A" opacity=".35"/><circle cx="${x}" cy="${y + 28}" r="8" fill="#FFE7B0"/></g>`).join("")}
          ${[[110, 200], [290, 200]].map(([x, y]) => `<g><ellipse cx="${x}" cy="${y}" rx="70" ry="14" fill="#5A3417"/><rect x="${x - 4}" y="${y}" width="8" height="70" fill="#3E2410"/><g transform="translate(${x - 18} ${y - 24}) scale(.22)">${hamburguer("simples")}</g><g transform="translate(${x + 30} ${y - 22}) scale(.2)">${lata("#E2483D")}</g></g>`).join("")}`, ["#FFE3B8", "#E7A55A"]);
      default:
        return svg(`${prato}<g transform="translate(200 ${categoria === "bebidas" ? 158 : 168}) scale(${categoria === "bebidas" ? .9 : 1})">${item}</g>`, fundo,
          `<circle cx="330" cy="60" r="110" fill="#fff" opacity=".16"/><circle cx="60" cy="260" r="80" fill="#fff" opacity=".12"/>`);
    }
  };
})();
