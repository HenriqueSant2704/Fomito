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
  const codigoMesa = new URLSearchParams(location.search).get("m") || "";

  Fomito.estado = {
    sessao: null, versao: null, config: null, cardapio: null, mesaQR: null,
    pedidos: [], comandas: { abertas: [], fechadas: [] }, caixa: { aberto: null, fechamentos: [] },
    clientes: [], usuarios: [], mesas: [], relatorio: null,
  };
  Fomito.codigoMesa = codigoMesa;

  /** Chamada à API. Erro do servidor vira um Error com a mensagem para mostrar na tela. */
  async function api(metodo, url, corpo) {
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
    ["sessao", "versao", "mesaQR", "pedidos", "comandas", "caixa", "clientes", "usuarios", "mesas", "relatorio"]
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
  }

  /**
   * Faz uma ação no servidor e já atualiza o estado.
   * Enquanto espera, os botões ficam travados (evita pedido em dobro).
   * Se der erro, a mensagem aparece sozinha (veja "unhandledrejection" abaixo).
   */
  let ocupadas = 0;
  async function acao(metodo, url, corpo) {
    ocupadas++;
    document.body.classList.add("ocupado");
    try {
      const resposta = await api(metodo, url, corpo);
      await sincronizar().catch(() => {});
      return resposta;
    } finally {
      if (--ocupadas === 0) document.body.classList.remove("ocupado");
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

  function telaDeErro(mensagem) {
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
    try {
      await sincronizar();
      for (const src of scripts) await carregarScript(src);
    } catch (err) {
      return telaDeErro(err.message);
    }
    iniciado = true;
    setInterval(() => sincronizar().catch(() => {}), 3000);
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
