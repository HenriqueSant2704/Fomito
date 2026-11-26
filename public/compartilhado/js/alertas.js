/* ==========================================================================
   FOMITO · ALERTAS DO PAINEL: SOM, IMPRESSÃO DO CUPOM E WHATSAPP
   --------------------------------------------------------------------------
   Depende de config.js e utils.js.

   1. Som       → toca um "ding-dong" quando chega pedido novo (Web Audio)
   2. Impressão → monta o cupom de 80mm e chama a impressão do navegador
   3. WhatsApp  → monta a prévia da mensagem pelo modelo (quem envia de verdade
                  é o servidor, em src/whatsapp.js, pela Evolution API)
   4. Avisos    → garçom e motoboy: som + vibração + notificação do celular
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  const { moeda } = Fomito;

  /* ---------- 1. SOM ---------- */
  let audio;
  /* Navegadores só liberam som depois do primeiro clique na página */
  document.addEventListener("pointerdown", () => {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
  }, { once: true });

  function tocarAlerta() {
    const { som } = Fomito.config.ler();
    if (!som.ativo) return false;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const notas = [[988, 0], [1319, 0.16], [988, 0.5], [1319, 0.66]]; // si-mi, duas vezes
      notas.forEach(([freq, quando]) => {
        const osc = audio.createOscillator();
        const vol = audio.createGain();
        const t = audio.currentTime + quando;
        osc.type = "sine";
        osc.frequency.value = freq;
        vol.gain.setValueAtTime(0.0001, t);
        vol.gain.exponentialRampToValueAtTime(som.volume * 0.5, t + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        osc.connect(vol).connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.42);
      });
      return audio.state === "running";
    } catch {
      return false;
    }
  }

  /* ---------- 2. CUPOM PARA IMPRESSORA TÉRMICA (80mm) ---------- */
  const linha = "-".repeat(42);
  const colunas = (esq, dir, largura = 42) => {
    const espacos = Math.max(1, largura - esq.length - dir.length);
    return esq + " ".repeat(espacos) + dir;
  };
  const valor = (n) => n.toFixed(2).replace(".", ",");

  /** Gera o texto do cupom (42 colunas = largura de uma POS-80) */
  function textoCupom(pedido) {
    const { marca, impressao } = Fomito.config.ler();
    const loja = Fomito.dados.lanchonete;
    const centro = (t) => " ".repeat(Math.max(0, Math.floor((42 - t.length) / 2))) + t;
    const agora = new Date();
    const data = agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const forma = Fomito.dados.formasPagamento.find((f) => f.id === pedido.pag);

    const itens = pedido.itens.map(([id, qtd, extras = [], obs = ""]) => {
      const p = Fomito.produto(id);
      const nomesExtras = (Fomito.dados.adicionais[p.cat] || []).filter((a) => extras.includes(a.id));
      const unit = p.preco + nomesExtras.reduce((s, a) => s + a.preco, 0);
      return [
        colunas(`${qtd}x ${p.nome}`.slice(0, 32), valor(unit * qtd)),
        ...nomesExtras.map((a) => `   + ${a.nome}`),
        ...(obs ? [`   OBS: ${obs}`] : []),
      ].join("\n");
    }).join("\n");

    const total = pedido.total;
    const partes = [
      centro(marca.nome.toUpperCase()),
      centro(loja.endereco),
      linha,
      colunas(`PEDIDO #${pedido.num}`, pedido.modo === "entrega" ? "ENTREGA" : "NO LOCAL"),
      data,
      `Cliente: ${pedido.cliente}`,
      ...(pedido.telefone ? [`Tel: ${pedido.telefone}`] : []),
      ...(pedido.endereco ? [`End: ${pedido.endereco}`] : []),
      linha,
      itens,
      linha,
      ...(pedido.modo === "entrega" ? [colunas("Taxa de entrega", valor(loja.taxaEntrega))] : []),
      colunas("TOTAL", "R$ " + valor(total)),
      linha,
      pedido.modo === "entrega" ? `Pagamento: ${forma?.nome || "-"} (na entrega)` : "Pagamento com o garçom",
      ...(pedido.pag === "dinheiro" && pedido.troco ? [colunas("Troco para", valor(pedido.troco)), colunas("LEVAR DE TROCO", valor(pedido.troco - total))] : []),
      linha,
      centro(impressao.rodape),
      centro("Pedidos com Fomito"),
    ];
    return partes.join("\n");
  }

  /** Imprime o cupom. Retorna o texto para mostrar a prévia na tela. */
  function imprimirCupom(pedido) {
    const texto = textoCupom(pedido);
    let area = document.getElementById("areaImpressao");
    if (!area) {
      area = document.createElement("pre");
      area.id = "areaImpressao";
      document.body.appendChild(area);
    }
    area.textContent = texto;
    try { window.print(); } catch { /* alguns ambientes bloqueiam a janela de impressão */ }
    return texto;
  }

  /* ---------- 3. WHATSAPP (Evolution API) ---------- */
  /**
   * Monta a mensagem do status e "envia".
   * No sistema real, o backend Node.js faz:
   *   POST {apiUrl}/message/sendText/{instancia}
   *   headers: { apikey: <chave> }
   *   body:    { number: "5511999999999", text: "<mensagem>" }
   */
  function enviarWhatsApp(pedido, status) {
    const { whatsapp, marca } = Fomito.config.ler();
    const modelo = whatsapp.modelos[status];
    if (!modelo?.ativo || !pedido.telefone) return null;
    const forma = Fomito.dados.formasPagamento.find((f) => f.id === pedido.pag);
    const texto = Fomito.config.montarMensagem(modelo.texto, {
      nome: pedido.cliente.split(" ")[0],
      pedido: pedido.num,
      loja: marca.nome,
      total: moeda(pedido.total),
      previsao: Fomito.dados.lanchonete.tempoEntrega,
      pagamento: forma ? forma.nome + (pedido.pag === "dinheiro" && pedido.troco ? `, troco para ${moeda(pedido.troco)}` : "") : "-",
    });
    return { para: pedido.telefone, titulo: modelo.titulo, texto, simulado: !whatsapp.conectado };
  }

  /* ---------- 4. AVISOS PARA GARÇOM E MOTOBOY ----------
     Som + vibração sempre; notificação do navegador quando ele permite
     (aparece mesmo com a aba em segundo plano). Próximo passo: Web Push com
     Service Worker, para o celular avisar com a tela bloqueada. */
  const CHAVE_AVISOS = "fomito.avisos";
  const podeNotificar = () => "Notification" in window;
  const notificacoesAtivas = () => podeNotificar() && Notification.permission === "granted";
  /** Avisos ligados neste aparelho: o navegador liberou a notificação OU a pessoa já tocou em Ativar (som e vibração) */
  const avisosLigados = () => {
    if (notificacoesAtivas()) return true;
    try { return localStorage.getItem(CHAVE_AVISOS) === "1"; } catch { return false; }
  };

  /** Pede permissão para notificar. Retorna "granted", "denied", "default" ou "indisponivel". */
  async function ativarNotificacoes() {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
    try { localStorage.setItem(CHAVE_AVISOS, "1"); } catch { /* sem armazenamento */ }
    if (!podeNotificar()) return "indisponivel";
    try { return await Notification.requestPermission(); } catch { return "denied"; }
  }

  /* O navegador só deixa tocar som depois de um toque na tela: o primeiro toque já libera */
  const liberarSom = () => {
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* sem áudio */ }
  };
  ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, liberarSom, { once: true, capture: true }));

  /** Som + vibração + notificação. tag evita repetir o mesmo aviso. */
  function avisar(titulo, texto, tag) {
    const tocou = tocarAlerta();
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* sem vibração */ }
    if (notificacoesAtivas() && document.visibilityState !== "visible") {
      try { new Notification(titulo, { body: texto, tag, icon: "../compartilhado/img/simbolo.svg" }); } catch { /* alguns celulares exigem Service Worker */ }
    }
    return tocou;
  }

  Fomito.alertas = { tocarAlerta, textoCupom, imprimirCupom, enviarWhatsApp, ativarNotificacoes, notificacoesAtivas, avisosLigados, podeNotificar, avisar };
})();
