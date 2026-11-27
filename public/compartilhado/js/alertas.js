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

  /* Modelo da notinha (Configurações › Impressora): cabeçalho, mensagem, o que aparece e a ordem.
     Os itens, quantidades e valores vêm SEMPRE do pedido: o modelo só muda textos e o que mostrar. */
  const BLOCOS = ["loja", "pedido", "cliente", "itens", "pagamento", "mensagem"];
  const modeloDe = (impressao) => {
    const m = impressao.modelo || {};
    const ordem = [...(m.ordem || []).filter((b) => BLOCOS.includes(b)), ...BLOCOS.filter((b) => !(m.ordem || []).includes(b))];
    return { cabecalho: "", mensagem: "", ...m, ordem, mostrar: { endereco: true, telefoneLoja: false, telefoneCliente: true, enderecoCliente: true, observacoes: true, fomito: true, ...(m.mostrar || {}) } };
  };
  const centro = (t) => String(t).split("\n").map((l) => " ".repeat(Math.max(0, Math.floor((42 - l.length) / 2))) + l).join("\n");
  const quebrar = (t) => String(t || "").split("\n").map((l) => l.trim()).filter(Boolean);
  /** Junta os blocos na ordem do modelo, com uma linha entre eles */
  const montar = (blocos, m, impressao) => {
    const partes = m.ordem.map((b) => blocos[b]).filter((b) => b && b.length);
    const fim = [...(impressao.rodape ? [centro(impressao.rodape)] : []), ...(m.mostrar.fomito ? [centro("Pedidos com Fomito")] : [])];
    return [...partes.flatMap((b, k) => (k ? [linha, ...b] : b)), ...(fim.length ? [linha, ...fim] : [])].join("\n");
  };
  const blocoLoja = (marca, loja, m, extra = []) => [
    centro(marca.nome.toUpperCase()),
    ...quebrar(m.cabecalho).map(centro),
    ...(m.mostrar.endereco && loja.endereco ? [centro(loja.endereco)] : []),
    ...(m.mostrar.telefoneLoja && loja.telefone ? [centro(`Tel.: ${loja.telefone}`)] : []),
    ...extra,
  ];
  const linhasItem = (qtd, nome, total, extras, obs, m) => [
    colunas(`${qtd}x ${nome}`.slice(0, 32), valor(total)),
    ...extras.map((a) => `   + ${a.nome}`),
    ...(obs && m.mostrar.observacoes ? [`   OBS: ${obs}`] : []),
  ].join("\n");

  /** Gera o texto do cupom (42 colunas = largura de uma POS-80). "impressaoTeste": prévia nas Configurações. */
  function textoCupom(pedido, impressaoTeste) {
    const { marca, impressao: salva } = Fomito.config.ler();
    const impressao = impressaoTeste || salva;
    const m = modeloDe(impressao);
    const loja = Fomito.dados.lanchonete;
    const agora = new Date();
    const data = agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const forma = Fomito.dados.formasPagamento.find((f) => f.id === pedido.pag);

    /* Cada item guarda o nome e o preço da hora do pedido: [id, qtd, extras, obs, preço unitário, nome] */
    const itens = pedido.itens.map(([id, qtd, extras = [], obs = "", preco, nome]) => {
      const p = Fomito.produto(id);
      const nomesExtras = Fomito.todosAdicionaisDo(p).filter((a) => extras.includes(a.id));
      const unit = preco ?? p.preco + nomesExtras.reduce((s, a) => s + a.preco, 0);
      return linhasItem(qtd, nome || p.nome, unit * qtd, nomesExtras, obs, m);
    }).join("\n");

    const total = pedido.total;
    const mensagem = quebrar(m.mensagem).map(centro);
    return montar({
      loja: blocoLoja(marca, loja, m),
      pedido: [colunas(`PEDIDO #${pedido.num}`, pedido.modo === "entrega" ? "ENTREGA" : "RETIRADA BALCAO"), data],
      cliente: [
        `Cliente: ${pedido.cliente}`,
        ...(pedido.telefone && m.mostrar.telefoneCliente ? [`Tel: ${pedido.telefone}`] : []),
        ...(pedido.endereco && m.mostrar.enderecoCliente ? [`End: ${pedido.endereco}`] : []),
      ],
      itens: [
        itens,
        linha,
        ...(pedido.modo === "entrega" ? [colunas("Taxa de entrega", (pedido.taxa ?? loja.taxaEntrega) > 0 ? valor(pedido.taxa ?? loja.taxaEntrega) : "Grátis")] : []),
        colunas("TOTAL", "R$ " + valor(total)),
      ],
      pagamento: [
        pedido.modo === "entrega" ? `Pagamento: ${forma?.nome || "-"} (na entrega)` : forma ? `Pagamento: ${forma.nome} (na retirada)` : "Pagamento no balcão",
        ...(pedido.pag === "dinheiro" && pedido.troco ? [colunas("Troco para", valor(pedido.troco)), colunas("LEVAR DE TROCO", valor(pedido.troco - total))] : []),
      ],
      mensagem,
    }, m, impressao);
  }

  /**
   * Notinha da cozinha de uma rodada da comanda da mesa (QR Code ou garçom).
   * Sai só com os itens daquela rodada, a mesa, quem pediu e as observações.
   */
  function textoCupomComanda(comanda, indice) {
    const { marca, impressao } = Fomito.config.ler();
    const m = modeloDe(impressao);
    const loja = Fomito.dados.lanchonete;
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
    return montar({
      loja: blocoLoja(marca, loja, m, [centro("*** COMANDA DA MESA ***")]),
      pedido: [colunas(mesa, `${indice + 1}o PEDIDO`), data],
      cliente: [
        ...(comanda.nome ? [`Cliente: ${comanda.nome}`] : []),
        `Pedido por: ${r.por === "qr" ? "cliente (QR Code da mesa)" : `garçom${r.quem ? ` ${r.quem}` : ""}`}`,
      ],
      itens: [itens, linha, colunas("Total deste pedido", "R$ " + valor(totalRodada)), colunas("Total da comanda", "R$ " + valor(Fomito.comandas.total(comanda)))],
      pagamento: ["Pagamento no fim, com o garçom"],
      mensagem: quebrar(m.mensagem).map(centro),
    }, m, impressao);
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

  Fomito.alertas = { tocarAlerta, textoCupom, imprimirCupom, textoCupomComanda, imprimirComanda, enviarWhatsApp, ativarNotificacoes, notificacoesAtivas, avisosLigados, podeNotificar, avisar };
})();
