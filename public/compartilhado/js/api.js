/* ==========================================================================
   FOMITO · CONVERSA COM O SERVIDOR
   --------------------------------------------------------------------------
   Este arquivo é o primeiro de toda tela. Ele:
     1. baixa o estado do sistema (GET /api/estado) antes de a tela montar;
     2. carrega os scripts da tela, na ordem;
     3. pede o estado de novo a cada 3 segundos (o "tempo real": o cliente
        pede no celular e o painel, o garçom e o motoboy veem na hora);
     4. faz as ações (Fomito.acao), que sempre passam pelo servidor.

   As telas leem tudo de Fomito.estado de forma imediata (sem esperar),
   como no protótipo. Só as ações esperam o servidor responder.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  /* Cada aparelho do cliente ganha um identificador próprio (fica só nele).
     Assim ele vê os próprios pedidos e a comanda da mesa, e mais ninguém. */
  let dispositivo = "";
  try {
    dispositivo = localStorage.getItem("fomito.dispositivo") || "";
    if (!dispositivo) { dispositivo = crypto.randomUUID(); localStorage.setItem("fomito.dispositivo", dispositivo); }
  } catch { dispositivo = crypto.randomUUID ? crypto.randomUUID() : `d${Date.now()}${String(Math.random()).slice(2, 10)}`; }

  /* Código da mesa vindo do QR Code (?m=abc123) */
  /* Fica lembrado por 6 horas: se o cliente recarregar ou abrir sem o ?m=, continua na mesma mesa.
     Quando a comanda dele é fechada, o celular esquece a mesa na hora (Fomito.esquecerMesa). */
  let codigoMesa = (() => {
    const daUrl = new URLSearchParams(location.search).get("m") || "";
    try {
      if (daUrl) { localStorage.setItem("fomito.mesaQR", JSON.stringify({ codigo: daUrl, em: Date.now() })); return daUrl; }
      const salvo = JSON.parse(localStorage.getItem("fomito.mesaQR"));
      return salvo && Date.now() - salvo.em < 6 * 3600 * 1000 ? salvo.codigo : "";
    } catch { return daUrl; }
  })();

  Fomito.estado = {
    sessao: null, versao: null, config: null, cardapio: null, mesaQR: null,
    pedidos: [], comandas: { abertas: [], fechadas: [] }, caixa: { aberto: null, fechamentos: [] },
    clientes: [], usuarios: [], mesas: [], relatorio: null,
  };
  Fomito.codigoMesa = codigoMesa;
  Fomito.esquecerMesa = () => {
    codigoMesa = "";
    Fomito.codigoMesa = "";
    Fomito.estado.mesaQR = null;
    try { localStorage.removeItem("fomito.mesaQR"); } catch { /* sem armazenamento */ }
    /* Tira o ?m= do endereço: recarregar a página não volta para a mesa */
    const url = new URL(location.href);
    if (url.searchParams.has("m")) { url.searchParams.delete("m"); history.replaceState(null, "", url); }
  };

  /** Chamada à API. Erro do servidor vira um Error com a mensagem para mostrar na tela. */
  /* Envios (POST/PUT/DELETE) em andamento: o mesmo envio clicado de novo espera o primeiro,
     em vez de ir duas vezes para o servidor (ex.: duplo clique em "Enviar no WhatsApp"). */
  const emAndamento = new Map();
  let ocupadas = 0;
  const travar = () => { ocupadas++; document.body?.classList.add("ocupado"); };
  const destravar = () => { if (--ocupadas === 0) document.body?.classList.remove("ocupado"); };

  function api(metodo, url, corpo) {
    if (metodo === "GET") return chamar(metodo, url, corpo);
    const chave = `${metodo} ${url} ${corpo === undefined ? "" : JSON.stringify(corpo)}`;
    if (emAndamento.has(chave)) return emAndamento.get(chave);
    /* Enquanto o servidor não responde, os botões ficam travados (sem envio em dobro) */
    travar();
    const envio = chamar(metodo, url, corpo).finally(() => { emAndamento.delete(chave); destravar(); });
    emAndamento.set(chave, envio);
    return envio;
  }

  async function chamar(metodo, url, corpo) {
    let r;
    try {
      r = await fetch(`/api${url}`, {
        method: metodo,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Dispositivo": dispositivo },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw new Error("Sem conexão com o servidor. Confira a internet e tente de novo.");
    }
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401 && Fomito.estado.sessao) setTimeout(() => location.replace("../portal/"), 1200);
      throw Object.assign(new Error(dados.error || "Algo deu errado. Tente de novo."), { status: r.status });
    }
    return dados;
  }

  let iniciado = false;
  function aplicar(novo) {
    const e = Fomito.estado;
    ["sessao", "versao", "mesaQR", "pedidos", "comandas", "caixa", "clientes", "usuarios", "mesas", "relatorio", "maisPedidos"]
      .forEach((k) => { if (k in novo) e[k] = novo[k]; });
    if (novo.config) e.config = novo.config;
    if (novo.cardapio) {
      /* Troca o conteúdo do mesmo objeto: as telas guardam a referência em "dados" */
      if (e.cardapio) { Object.keys(e.cardapio).forEach((k) => delete e.cardapio[k]); Object.assign(e.cardapio, novo.cardapio); }
      else e.cardapio = novo.cardapio;
    }
    if (iniciado && (novo.config || novo.cardapio)) {
      Fomito.config?.aplicarMarca();
      document.dispatchEvent(new CustomEvent("fomito:loja"));
    }
  }

  /** Baixa o estado atual do servidor. */
  async function sincronizar() {
    const q = new URLSearchParams({ v: Fomito.estado.versao ?? "" });
    if (codigoMesa) q.set("m", codigoMesa);
    aplicar(await api("GET", `/estado?${q}`));
    if (iniciado) document.dispatchEvent(new CustomEvent("fomito:estado")); // as telas conferem o que mudou na hora
  }

  /* Tempo real: o servidor avisa na hora quando algo muda (pedido novo, pronto, conta...).
     Com o aviso ligado, a busca de 3 em 3 s vira só uma reserva (a cada 20 s). */
  let avisoLigado = false;
  let buscando = null;
  const buscarJa = () => {
    clearTimeout(buscando);
    buscando = setTimeout(() => sincronizar().catch(() => {}), 40);
  };
  function ouvirServidor() {
    if (!("EventSource" in window)) return;
    const fonte = new EventSource("/api/eventos");
    fonte.addEventListener("mudou", buscarJa);
    fonte.onopen = () => { if (!avisoLigado) { avisoLigado = true; buscarJa(); } };
    fonte.onerror = () => { avisoLigado = false; }; // o navegador reconecta sozinho
  }
  /* Voltou para a tela (desbloqueou o celular, trocou de aba): busca na hora */
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") buscarJa(); });

  /**
   * Faz uma ação no servidor e já atualiza o estado.
   * Enquanto espera, os botões ficam travados (evita pedido em dobro).
   * Se der erro, a mensagem aparece sozinha (veja "unhandledrejection" abaixo).
   */
  async function acao(metodo, url, corpo) {
    travar();
    try {
      const resposta = await api(metodo, url, corpo);
      await sincronizar().catch(() => {});
      return resposta;
    } finally {
      destravar();
    }
  }

  /* Qualquer ação que falhar mostra a mensagem do servidor */
  window.addEventListener("unhandledrejection", (ev) => {
    const msg = ev.reason?.message;
    if (!msg) return;
    ev.preventDefault();
    if (Fomito.toast) Fomito.toast(msg, "info");
    else alert(msg);
  });

  function carregarScript(src) {
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = ok;
      s.onerror = () => falha(new Error(`Não consegui carregar ${src}`));
      document.body.appendChild(s);
    });
  }

  /* ---------- Tela de carregamento ----------
     Aparece na hora, com a marca do restaurante (guardada da última visita),
     e some suave quando a tela está pronta. */
  const TEXTOS = { cliente: "Preparando o cardápio", painel: "Abrindo o painel", garcom: "Carregando as mesas", motoboy: "Buscando as entregas", portal: "Abrindo o Portal" };
  const textoDaTela = TEXTOS[location.pathname.split("/").filter(Boolean)[0] || "cliente"] || "Carregando";
  const marcaGuardada = () => { try { return JSON.parse(localStorage.getItem("fomito.marca")) || null; } catch { return null; } };
  const escapar = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function desenharMarca(el, m) {
    const marca = { nome: "Fomito", corPrincipal: "#4B2B8F", corDestaque: "#FF8A00", logo: "", ...(m || {}) };
    el.style.setProperty("--cp", marca.corPrincipal);
    el.style.setProperty("--cd", marca.corDestaque);
    const inicial = escapar((marca.nome.trim()[0] || "F").toUpperCase());
    el.querySelector(".carregando__simbolo").innerHTML = marca.logo
      ? `<img src="${escapar(marca.logo)}" alt="">`
      : `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="var(--cd)"/>
           <text x="31" y="45" text-anchor="middle" font-family="Nunito, system-ui, sans-serif" font-weight="900" font-size="36" fill="#fff">${inicial}</text>
           <g class="carregando__vapor" stroke="#fff" stroke-opacity=".7" stroke-width="3.2" stroke-linecap="round"><path d="M46 8.5l.8 4.4"/><path d="M53.5 11.8l-3 3.2"/><path d="M56.5 19.5l-4.3.6"/></g></svg>`;
    el.querySelector(".carregando__nome").textContent = marca.nome;
  }

  let carregando = null;
  function mostrarCarregando() {
    const estilo = document.createElement("style");
    estilo.textContent = `
      .carregando { --cp:#4B2B8F; --cd:#FF8A00; position:fixed; inset:0; z-index:1000; display:grid; place-items:center;
        background: radial-gradient(120% 80% at 50% 30%, #fff 0%, #FFF7ED 55%, color-mix(in srgb, var(--cd) 10%, #FFF7ED) 100%);
        transition: opacity .4s ease, visibility .4s ease; font-family: Inter, system-ui, sans-serif; }
      .carregando.saindo { opacity:0; visibility:hidden; }
      .carregando__caixa { display:flex; flex-direction:column; align-items:center; gap:14px; transform:translateY(-4%); }
      .carregando__marca { position:relative; width:84px; height:84px; margin-bottom:10px; }
      .carregando__anel { position:absolute; inset:-14px; border-radius:50%;
        background: conic-gradient(from 0deg, transparent 0 55%, color-mix(in srgb, var(--cp) 25%, transparent) 70%, var(--cp) 100%);
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px));
                mask: radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px));
        animation: carregando-girar 1.1s linear infinite; }
      .carregando__simbolo { width:84px; height:84px; border-radius:24px; overflow:hidden; display:grid; place-items:center;
        box-shadow: 0 14px 34px color-mix(in srgb, var(--cd) 38%, transparent), 0 2px 6px rgba(27,21,48,.08);
        animation: carregando-respirar 1.8s ease-in-out infinite; background:#fff; }
      .carregando__simbolo svg, .carregando__simbolo img { width:100%; height:100%; display:block; object-fit:cover; }
      .carregando__vapor path { animation: carregando-vapor 1.8s ease-in-out infinite; }
      .carregando__vapor path:nth-child(2) { animation-delay:.2s } .carregando__vapor path:nth-child(3) { animation-delay:.4s }
      .carregando__nome { font: 800 21px/1.1 Nunito, system-ui, sans-serif; color: var(--cp); letter-spacing:-.01em; text-align:center; max-width:80vw; }
      .carregando__texto { display:flex; align-items:center; gap:2px; font-size:13.5px; font-weight:500; color:#6B6480; }
      .carregando__texto i { width:4px; height:4px; margin-left:3px; border-radius:50%; background: var(--cd); animation: carregando-ponto 1.2s ease-in-out infinite; }
      .carregando__texto i:nth-child(2) { animation-delay:.15s } .carregando__texto i:nth-child(3) { animation-delay:.3s }
      .carregando__rodape { position:absolute; bottom:28px; font-size:11.5px; color:#A39DB3; letter-spacing:.02em; }
      @keyframes carregando-girar { to { transform: rotate(360deg); } }
      @keyframes carregando-respirar { 0%,100% { transform: scale(1); } 50% { transform: scale(1.045); } }
      @keyframes carregando-vapor { 0%,100% { opacity:.25; transform:translateY(1px); } 50% { opacity:1; transform:translateY(-1.5px); } }
      @keyframes carregando-ponto { 0%,80%,100% { opacity:.25; transform:translateY(0); } 40% { opacity:1; transform:translateY(-3px); } }
      @media (prefers-reduced-motion: reduce) { .carregando *, .carregando { animation:none !important; transition:none !important; } }`;
    document.head.appendChild(estilo);
    carregando = document.createElement("div");
    carregando.className = "carregando";
    carregando.setAttribute("role", "status");
    carregando.setAttribute("aria-live", "polite");
    carregando.innerHTML = `
      <div class="carregando__caixa">
        <div class="carregando__marca"><span class="carregando__anel"></span><div class="carregando__simbolo"></div></div>
        <div class="carregando__nome"></div>
        <div class="carregando__texto">${textoDaTela}<i></i><i></i><i></i></div>
      </div>
      <span class="carregando__rodape">Pedidos com Fomito</span>`;
    desenharMarca(carregando, marcaGuardada());
    document.body.appendChild(carregando);
  }

  function esconderCarregando() {
    if (!carregando) return;
    const el = carregando;
    carregando = null;
    el.classList.add("saindo");
    setTimeout(() => el.remove(), 450);
  }

  /* Guarda a marca para a próxima visita já abrir com ela */
  function guardarMarca() {
    const m = Fomito.estado.config?.marca;
    if (!m) return;
    const resumo = { nome: m.nome, corPrincipal: m.corPrincipal, corDestaque: m.corDestaque, logo: m.logo || "" };
    try { localStorage.setItem("fomito.marca", JSON.stringify(resumo)); } catch { /* sem armazenamento */ }
    if (carregando) desenharMarca(carregando, resumo);
  }

  function telaDeErro(mensagem) {
    esconderCarregando();
    document.body.insertAdjacentHTML("beforeend", `
      <div style="position:fixed;inset:0;z-index:999;display:grid;place-items:center;background:#FFF7ED;padding:24px;font-family:system-ui,sans-serif">
        <div style="max-width:360px;text-align:center;display:flex;flex-direction:column;gap:12px;color:#1B1530">
          <strong style="font-size:20px">Não foi possível abrir agora</strong>
          <span style="color:#5b5470">${mensagem}</span>
          <button onclick="location.reload()" style="height:46px;border:0;border-radius:12px;background:#4B2B8F;color:#fff;font-weight:700;font-size:15px;cursor:pointer">Tentar de novo</button>
        </div>
      </div>`);
  }

  /**
   * Abre a tela: baixa o estado, carrega os scripts em ordem e liga a atualização.
   * Uso no HTML: Fomito.iniciar(["../compartilhado/js/icones.js", ..., "cliente.js"])
   */
  async function iniciar(scripts) {
    mostrarCarregando();
    try {
      await sincronizar();
      guardarMarca();
      for (const src of scripts) await carregarScript(src);
    } catch (err) {
      return telaDeErro(err.message);
    }
    Fomito.aplicarIcones?.();
    esconderCarregando();
    iniciado = true;
    ouvirServidor();
    let ultimaBusca = 0;
    setInterval(() => {
      const intervalo = avisoLigado ? 20000 : 3000; // reserva: se o aviso cair, volta a buscar de 3 em 3 s
      if (Date.now() - ultimaBusca < intervalo) return;
      ultimaBusca = Date.now();
      sincronizar().catch(() => {});
    }, 3000);
  }

  Fomito.api = api;
  Fomito.acao = acao;
  Fomito.sincronizar = sincronizar;
  Fomito.iniciar = iniciar;
  Fomito.dispositivo = dispositivo;

  /* Foto escolhida no celular ou no computador: diminui antes de enviar (máx. 1400px, JPG) */
  Fomito.lerImagem = (arquivo, max = 1400) => new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onerror = () => falha(new Error("Não consegui ler a imagem."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => falha(new Error("Esse arquivo não é uma imagem."));
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        const ctx = c.getContext("2d");
        const png = arquivo.type === "image/png";
        if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL(png ? "image/png" : "image/jpeg", 0.85));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
})();
