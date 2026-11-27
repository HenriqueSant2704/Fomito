/* ==========================================================================
   FOMITO · ALERTAS DO PAINEL: SOM, IMPRESSÃO DO CUPOM E WHATSAPP
   --------------------------------------------------------------------------
   Depende de config.js e utils.js.

   1. Som       → toca um "ding-dong" quando chega pedido novo (Web Audio)
   2. Impressão → monta o cupom de 80mm e chama a impressão do navegador
   3. WhatsApp  → monta a prévia da mensagem pelo modelo (quem envia de verdade
                  é o servidor, em src/whatsapp.js, conectado pelo QR Code)
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

  /** Toca o alerta. volume (0,1 a 1) serve para testar antes de salvar. */
  function tocarAlerta(volume) {
    const { som } = Fomito.config.ler();
    if (!som.ativo && volume == null) return false;
    const nivel = Math.min(1, Math.max(0.05, Number(volume ?? som.volume) || 0.6));
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
        vol.gain.exponentialRampToValueAtTime(nivel * nivel * 0.9, t + 0.02); // ao quadrado: o ouvido percebe melhor a diferença
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

  /* Modelo da notinha (Configurações › Impressora): o dono edita o TOPO e o FIM direto na prévia.
     O meio (pedido, cliente, itens, quantidades, valores, total, pagamento) vem SEMPRE do pedido. */
  const centro = (t) => " ".repeat(Math.max(0, Math.floor((42 - String(t).length) / 2))) + t;
  const linhasDe = (lista) => (lista || []).map((l) => String(l).trimEnd());
  /** Topo e fim do modelo; se o dono nunca editou, usa o padrão com os dados da loja */
  function modeloDe(impressao) {
    const { marca } = Fomito.config.ler();
    const loja = Fomito.dados?.lanchonete || {};
    const m = impressao.modelo || {};
    /* Quem personalizou no modelo anterior (cabeçalho, mensagem, rodapé) não perde o que escreveu */
    const topo = m.topo ?? [marca.nome.toUpperCase(), ...String(m.cabecalho || "").split("\n").filter((l) => l.trim()), ...(m.mostrar?.endereco === false ? [] : [loja.endereco || ""]), ...(m.mostrar?.telefoneLoja && loja.telefone ? [`Tel.: ${loja.telefone}`] : [])].filter((l) => l !== "");
    const fim = m.fim ?? [...String(m.mensagem || "").split("\n").filter((l) => l.trim()), impressao.rodape || "", ...(m.mostrar?.fomito === false ? [] : ["Pedidos com Fomito"])].filter((l) => l !== "");
    return { topo: linhasDe(topo), fim: linhasDe(fim), rotulos: rotulosDe(m), mostrar: { telefoneCliente: true, enderecoCliente: true, observacoes: true, ...(m.mostrar || {}) } };
  }
  const linhasItem = (qtd, nome, total, extras, obs, m) => [
    colunas(`${qtd}x ${nome}`.slice(0, 32), valor(total)),
    ...extras.map((a) => `   + ${a.nome}`),
    ...(obs && m.mostrar.observacoes ? [`   OBS: ${obs}`] : []),
  ].join("\n");
  /** Texto final: topo centralizado, meio automático, fim centralizado */
  /* Rótulos do meio da notinha: o dono pode trocar as PALAVRAS (ex.: "TOTAL" → "Subtotal").
     Os valores, itens e dados do pedido nunca são editáveis. */
  const ROTULOS = {
    pedido: "PEDIDO", entrega: "ENTREGA", retirada: "RETIRADA BALCAO", cliente: "Cliente", tel: "Tel", end: "End",
    taxa: "Taxa de entrega", total: "TOTAL", pagamento: "Pagamento", naEntrega: "(na entrega)", naRetirada: "(na retirada)",
    pagBalcao: "Pagamento no balcão", trocoPara: "Troco para", levarTroco: "LEVAR DE TROCO",
  };
  const rotulosDe = (m) => {
    const r = { ...ROTULOS };
    for (const [k, v] of Object.entries(m.rotulos || {})) if (k in ROTULOS && typeof v === "string") r[k] = v.replace(/\s+/g, " ").slice(0, 24);
    return r;
  };
  /* Uma linha do meio é feita de pedaços: texto fixo do pedido ou { r: rótulo editável } */
  const resolver = (pedacos, rot) => pedacos.map((p) => (typeof p === "string" ? p : rot[p.r])).join("");
  const textoLinha = (x, rot) => (x.col ? colunas(resolver(x.col[0], rot), resolver(x.col[1], rot)) : x.p ? resolver(x.p, rot) : x.t);
  const juntar = ({ topo, meio, fim }) => [
    ...topo.map((l) => (l.trim() ? centro(l.trim()) : "")),
    ...(topo.length ? [linha] : []),
    ...meio.map((x) => x.texto ?? x.t),
    ...(fim.length ? [linha, ...fim.map((l) => (l.trim() ? centro(l.trim()) : ""))] : []),
  ].join("\n");

  /**
   * Partes do cupom do pedido. "meio" é uma lista de linhas { t, ocultar? }: "ocultar" marca as que o
   * dono pode esconder na prévia (telefone e endereço do cliente). Nada do meio é editável.
   */
  function partesCupom(pedido, impressaoTeste) {
    const { impressao: salva } = Fomito.config.ler();
    const impressao = impressaoTeste || salva;
    const m = modeloDe(impressao);
    const loja = Fomito.dados.lanchonete;
    const agora = new Date();
    const data = agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const forma = Fomito.Fomito.formaPag(pedido.pag);
    /* Cada item guarda o nome e o preço da hora do pedido: [id, qtd, extras, obs, preço unitário, nome] */
    const itens = pedido.itens.map(([id, qtd, extras = [], obs = "", preco, nome]) => {
      const p = Fomito.produto(id);
      const nomesExtras = Fomito.todosAdicionaisDo(p).filter((a) => extras.includes(a.id));
      const unit = preco ?? p.preco + nomesExtras.reduce((s, a) => s + a.preco, 0);
      return linhasItem(qtd, nome || p.nome, unit * qtd, nomesExtras, obs, m);
    }).join("\n");
    const total = pedido.total;
    const meio = [
      { col: [[{ r: "pedido" }, ` #${pedido.num}`], [{ r: pedido.modo === "entrega" ? "entrega" : "retirada" }]] },
      { t: data },
      { t: linha },
      { p: [{ r: "cliente" }, `: ${pedido.cliente}`] },
      ...(pedido.telefone ? [{ p: [{ r: "tel" }, `: ${pedido.telefone}`], ocultar: "telefoneCliente" }] : []),
      ...(pedido.endereco ? [{ p: [{ r: "end" }, `: ${pedido.endereco}`], ocultar: "enderecoCliente" }] : []),
      { t: linha },
      { t: itens },
      { t: linha },
      ...(pedido.modo === "entrega" ? [{ col: [[{ r: "taxa" }], [(pedido.taxa ?? loja.taxaEntrega) > 0 ? valor(pedido.taxa ?? loja.taxaEntrega) : "Grátis"]] }] : []),
      { col: [[{ r: "total" }], ["R$ " + valor(total)]] },
      { t: linha },
      { p: pedido.modo === "entrega" ? [{ r: "pagamento" }, `: ${forma?.nome || "-"} `, { r: "naEntrega" }] : forma ? [{ r: "pagamento" }, `: ${forma.nome} `, { r: "naRetirada" }] : [{ r: "pagBalcao" }] },
      ...(pedido.pag === "dinheiro" && pedido.troco ? [{ col: [[{ r: "trocoPara" }], [valor(pedido.troco)]] }, { col: [[{ r: "levarTroco" }], [valor(pedido.troco - total)]] }] : []),
    ].filter((x) => !x.ocultar || m.mostrar[x.ocultar]).map((x) => ({ ...x, texto: textoLinha(x, m.rotulos) }));
    return { topo: m.topo, meio, fim: m.fim, rotulos: m.rotulos, mostrar: m.mostrar, ocultaveis: { telefoneCliente: !!pedido.telefone, enderecoCliente: !!pedido.endereco } };
  }

  /** Gera o texto do cupom (42 colunas = largura de uma POS-80). "impressaoTeste": prévia nas Configurações. */
  const textoCupom = (pedido, impressaoTeste) => juntar(partesCupom(pedido, impressaoTeste));

  /**
   * Notinha da cozinha de uma rodada da comanda da mesa (QR Code ou garçom).
   * Sai só com os itens daquela rodada, a mesa, quem pediu e as observações.
   */
  function textoCupomComanda(comanda, indice) {
    const { impressao } = Fomito.config.ler();
    const m = modeloDe(impressao);
    const r = comanda.rodadas[indice];
    const quando = new Date(r.hora);
    const data = quando.toLocaleDateString("pt-BR") + " " + quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const mesa = `MESA ${String(comanda.mesa).padStart(2, "0")}`;
    const itens = r.itens.map((it) => {
      const p = Fomito.produto(it.id);
      const nomesExtras = Fomito.todosAdicionaisDo(p).filter((a) => (it.extras || []).includes(a.id));
      const unit = it.preco ?? p.preco;
      return linhasItem(it.qtd, it.nome || p.nome, unit * it.qtd, nomesExtras, it.obs, m);
    }).join("\n");
    const totalRodada = r.itens.reduce((s, it) => s + (it.preco ?? Fomito.produto(it.id).preco) * it.qtd, 0);
    const meio = [
      centro("*** COMANDA DA MESA ***"),
      colunas(mesa, `${indice + 1}o PEDIDO`),
      data,
      ...(comanda.nome ? [`${m.rotulos.cliente}: ${comanda.nome}`] : []),
      `Pedido por: ${r.por === "qr" ? "cliente (QR Code da mesa)" : `garçom${r.quem ? ` ${r.quem}` : ""}`}`,
      linha,
      itens,
      linha,
      colunas("Total deste pedido", "R$ " + valor(totalRodada)),
      colunas("Total da comanda", "R$ " + valor(Fomito.comandas.total(comanda))),
      linha,
      "Pagamento no fim, com o garçom",
    ].map((t) => ({ t }));
    return juntar({ topo: m.topo, meio, fim: m.fim });
  }

  /** Manda um texto para a impressora térmica (pela impressão do navegador). */
  function imprimirTexto(texto) {
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

  /** Imprime o cupom do pedido. Retorna o texto para mostrar a prévia na tela. */
  const imprimirCupom = (pedido, impressaoTeste) => imprimirTexto(textoCupom(pedido, impressaoTeste));
  /** Imprime a notinha da cozinha de uma rodada da comanda. */
  const imprimirComanda = (comanda, indice) => imprimirTexto(textoCupomComanda(comanda, indice));

  /* ---------- 3. WHATSAPP (prévia das mensagens) ---------- */
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
    const forma = Fomito.Fomito.formaPag(pedido.pag);
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

  Fomito.alertas = { imprimirTexto, tocarAlerta, textoCupom, partesCupom, ROTULOS, imprimirCupom, textoCupomComanda, imprimirComanda, enviarWhatsApp, ativarNotificacoes, notificacoesAtivas, avisosLigados, podeNotificar, avisar };
})();
