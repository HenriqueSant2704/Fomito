/* ==========================================================================
   FOMITO · CONFIGURAÇÕES DO RESTAURANTE (marca própria / "white-label")
   --------------------------------------------------------------------------
   Fomito é a plataforma. Cada restaurante coloca o próprio nome, logo,
   cores e fontes, e o sistema inteiro (cardápio, Portal, painel e comandas)
   passa a usar a marca dele.

   Também guarda: modelos de mensagem do WhatsApp, impressão e som.
   Ficam no banco (tabela "loja"); o painel do administrador muda e salva.
   No sistema real vira a tabela "configuracoes" no Neon.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {

  /* Fontes que o restaurante pode escolher (todas do Google Fonts) */
  const FONTES_TITULO = ["Nunito", "Poppins", "Montserrat", "Fredoka", "Playfair Display", "Bebas Neue", "Inter"];
  const FONTES_TEXTO = ["Inter", "Roboto", "Lato", "DM Sans", "Open Sans", "Nunito"];

  const PADRAO = {
    marca: {
      nome: "Fomito",
      slogan: "Lanches na chapa desde 2012",
      logo: "",                 // imagem enviada (data URL). Vazio = símbolo com a inicial
      corPrincipal: "#4B2B8F",
      corDestaque: "#FF8A00",
      fonteTitulo: "Nunito",
      fonteTexto: "Inter",
    },
    whatsapp: {
      apiUrl: "",
      apiKey: "",
      instancia: "fomito-loja",
      conectado: false,
      numero: "",
      modelos: {
        recebido: { ativo: true, titulo: "Pedido recebido", texto: "Olá, {nome}! Recebemos seu pedido #{pedido} na {loja}. Total: {total}. Já vamos começar o preparo." },
        preparo:  { ativo: true, titulo: "Em preparo (entrega)", texto: "{nome}, seu pedido #{pedido} já está na chapa! 🔥 Previsão de entrega: {previsao}." },
        saiu:     { ativo: true, titulo: "Saiu para entrega", texto: "Boa notícia, {nome}! Seu pedido #{pedido} saiu para entrega e chega em breve. 🛵 Pagamento na entrega: {pagamento}." },
        entregue: { ativo: true, titulo: "Entregue", texto: "Pedido #{pedido} entregue. Obrigado pela preferência, {nome}! Bom apetite. 😋" },
        /* Retirada no balcão e mesa pelo QR Code */
        preparo_balcao: {ativo: true,titulo: "Em preparo (retirada)",texto: "{nome}, seu pedido #{pedido} já está sendo preparado! 🔥 Avisamos aqui assim que ficar pronto para retirar."},
        pronto_balcao: {ativo: true,titulo: "Pronto para retirar",texto: "{nome}, seu pedido #{pedido} está pronto! 🎉 Pode vir retirar no balcão da {loja} ({endereco}). Total: {total}."},
        retirado: {ativo: true,titulo: "Retirado",texto: "Pedido #{pedido} retirado. Obrigado pela preferência, {nome}! Bom apetite. 😋"},
        mesa_recebido: {ativo: true,titulo: "Mesa: pedido recebido",texto: "Olá, {nome}! Recebemos seu pedido na {mesa} da {loja}. Já vai para a cozinha. 🍔"},
        mesa_preparo: {ativo: true,titulo: "Mesa: em preparo",texto: "{nome}, seu pedido da {mesa} já está sendo preparado! 🔥"},
        mesa_pronto: {ativo: true,titulo: "Mesa: pronto",texto: "{nome}, seu pedido está pronto e já está indo para a {mesa}! 😋"},
        mesa_fechada: {ativo: true,titulo: "Mesa: conta fechada",texto: "Conta da {mesa} fechada: {total}. Obrigado pela visita, {nome}! Volte sempre. 💛"},
      },
    },
    impressao: { aoAceitar: true, vias: 1, largura: "80mm", rodape: "Obrigado pela preferência!" },
    som: { ativo: true, volume: 0.6 },
  };

  /* Junta o salvo com o padrão (assim campos novos sempre existem) */
  const mesclar = (base, extra) => {
    const r = { ...base };
    for (const k in extra) {
      r[k] = extra[k] && typeof extra[k] === "object" && !Array.isArray(extra[k]) && base[k] ? mesclar(base[k], extra[k]) : extra[k];
    }
    return r;
  };

  /* As configurações vêm do servidor. Garçom, motoboy e cliente não recebem a parte do WhatsApp. */
  /* O som de pedido novo pode ser ligado/desligado em cada computador (botão do sino) */
  const somLocal = () => { try { const v = localStorage.getItem("fomito.som"); return v === null ? null : v === "1"; } catch { return null; } };
  const somNesteAparelho = (ativo) => { try { localStorage.setItem("fomito.som", ativo ? "1" : "0"); } catch { /* sem armazenamento */ } };
  const ler = () => {
    const c = mesclar(PADRAO, structuredClone(Fomito.estado?.config || {}));
    const local = somLocal();
    if (local !== null) c.som.ativo = local;
    return c;
  };
  /** Grava no servidor (só o administrador). */
  const salvar = (config) => Fomito.acao("PUT", "/config", config);

  /* ---------- Cores: gera as variações a partir de 2 cores ---------- */
  const hexParaRgb = (hex) => hex.replace("#", "").match(/.{2}/g).map((h) => parseInt(h, 16));
  const rgbParaHex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const misturar = (hex, com, quanto) => {
    const a = hexParaRgb(hex), b = hexParaRgb(com);
    return rgbParaHex(a.map((v, i) => v + (b[i] - v) * quanto));
  };

  /* Carrega uma fonte do Google Fonts só quando for usada */
  const carregarFonte = (familia) => {
    const id = "fonte-" + familia.replace(/\s/g, "-");
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${familia.replace(/\s/g, "+")}:wght@400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
  };

  /* Símbolo da marca: logo enviada ou um quadrado com a inicial do nome */
  const simbolo = (marca) => {
    if (marca.logo) return `<img class="logo__simbolo logo__simbolo--img" src="${marca.logo}" alt="">`;
    const inicial = (marca.nome.trim()[0] || "F").toUpperCase();
    return `<svg class="logo__simbolo" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="${marca.corDestaque}"/>
      <text x="31" y="45" text-anchor="middle" font-family="'${marca.fonteTitulo}', sans-serif" font-weight="900" font-size="36" fill="#fff">${inicial}</text>
      <g stroke="#fff" stroke-opacity=".6" stroke-width="3.2" stroke-linecap="round"><path d="M46 8.5l.8 4.4"/><path d="M53.5 11.8l-3 3.2"/><path d="M56.5 19.5l-4.3.6"/></g>
    </svg>`;
  };

  /* Aplica a marca do restaurante na página atual */
  const aplicarMarca = (marca = ler().marca) => {
    const r = document.documentElement.style;
    const p = marca.corPrincipal, d = marca.corDestaque;
    r.setProperty("--roxo", p);
    r.setProperty("--roxo-escuro", misturar(p, "#000000", 0.42));
    r.setProperty("--roxo-hover", misturar(p, "#000000", 0.18));
    r.setProperty("--roxo-medio", misturar(p, "#FFFFFF", 0.35));
    r.setProperty("--roxo-claro", misturar(p, "#FFFFFF", 0.9));
    r.setProperty("--laranja", d);
    r.setProperty("--laranja-escuro", misturar(d, "#000000", 0.25));
    r.setProperty("--laranja-claro", misturar(d, "#FFFFFF", 0.88));
    carregarFonte(marca.fonteTitulo);
    carregarFonte(marca.fonteTexto);
    r.setProperty("--fonte-marca", `"${marca.fonteTitulo}", system-ui, sans-serif`);
    r.setProperty("--fonte-texto", `"${marca.fonteTexto}", system-ui, sans-serif`);

    /* Título da aba: "Fomito · Cardápio" vira "Nome do restaurante · Cardápio" */
    document.title = document.title.replace(/^[^·]*·/, `${marca.nome} ·`);

    /* Ícone da aba do navegador */
    const svg = marca.logo ? null : simbolo(marca).replace('class="logo__simbolo" ', 'xmlns="http://www.w3.org/2000/svg" ');
    let icone = document.querySelector("link[rel=icon]");
    if (!icone) { icone = document.createElement("link"); icone.rel = "icon"; document.head.appendChild(icone); }
    icone.href = marca.logo || "data:image/svg+xml," + encodeURIComponent(svg);
  };

  /* Troca {variaveis} de um modelo de mensagem */
  const montarMensagem = (texto, dados) => texto.replace(/\{(\w+)\}/g, (_, chave) => dados[chave] ?? `{${chave}}`);

  Fomito.config = {
    ler, salvar, somNesteAparelho, aplicarMarca, simbolo, montarMensagem, misturar, carregarFonte,
    padrao: () => structuredClone(PADRAO),
    FONTES_TITULO, FONTES_TEXTO,
  };

  aplicarMarca();
})();
