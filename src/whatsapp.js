// WhatsApp da loja: mensagens automáticas para o cliente (pedido recebido, em preparo, saiu, entregue).
// Funciona como no BarberFlow: o dono lê um QR Code uma vez (como o WhatsApp Web) e o servidor
// fica conectado. A "chave" da conexão fica no banco (tabela wa_auth), então quando o Render
// reinicia o WhatsApp volta sozinho, sem ler o QR Code de novo. Não precisa de nenhuma API paga.
// Não é a API oficial da Meta: o ideal é usar um chip só para isso, não o WhatsApp pessoal.
const QRCode = require('qrcode');
const db = require('./db');
const loja = require('./loja');

let B = null; // biblioteca Baileys (só existe como módulo ESM, por isso o import dinâmico)
const lib = async () => (B ||= await import('@whiskeysockets/baileys'));

// A biblioteca escreve muita coisa técnica no log; aqui fica tudo em silêncio.
const SILENT = { level: 'silent', child: () => SILENT, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} };

// estado: 'off' (desconectado) | 'conectando' | 'qr' (esperando ler) | 'on' (conectado)
const st = { estado: 'off', qr: null, numero: '', nome: '', erro: '' };
let sock = null;
let querLigado = false;
let tentativas = 0;
let timerReconectar = null;

const info = () => ({ estado: st.estado, conectado: st.estado === 'on', qr: st.estado === 'qr' ? st.qr : null, numero: st.numero, nome: st.nome, erro: st.erro });

/** Guarda no banco se está conectado e o número (a tela de Configurações mostra). */
async function marcar(estado, erro = '') {
  st.estado = estado;
  st.erro = erro;
  const w = loja.obter()?.config?.whatsapp;
  const conectado = estado === 'on';
  if (w && (w.conectado !== conectado || (conectado && w.numero !== st.numero))) {
    await loja.marcarWhatsApp(conectado, st.numero).catch(() => {});
  }
}

/** Sessão do WhatsApp no Neon em vez de arquivos (o disco do Render some a cada reinício). */
async function sessaoNoBanco() {
  const { initAuthCreds, BufferJSON, proto } = await lib();
  const enc = (v) => JSON.stringify(v, BufferJSON.replacer);
  const dec = (v) => JSON.parse(v, BufferJSON.reviver);
  const gravar = (k, v) => db.query('INSERT INTO wa_auth (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, enc(v)]);
  const { rows } = await db.query("SELECT value FROM wa_auth WHERE key = 'creds'");
  const creds = rows[0] ? dec(rows[0].value) : initAuthCreds();
  return {
    creds,
    state: {
      creds,
      keys: {
        get: async (tipo, ids) => {
          const out = {};
          if (!ids.length) return out;
          const { rows: r } = await db.query('SELECT key, value FROM wa_auth WHERE key = ANY($1)', [ids.map((id) => `${tipo}:${id}`)]);
          const m = new Map(r.map((x) => [x.key, x.value]));
          for (const id of ids) {
            let v = m.has(`${tipo}:${id}`) ? dec(m.get(`${tipo}:${id}`)) : null;
            if (v && tipo === 'app-state-sync-key') v = proto.Message.AppStateSyncKeyData.fromObject(v);
            out[id] = v;
          }
          return out;
        },
        set: async (dados) => {
          const tarefas = [];
          for (const cat in dados) {
            for (const id in dados[cat]) {
              const v = dados[cat][id];
              tarefas.push(v ? gravar(`${cat}:${id}`, v) : db.query('DELETE FROM wa_auth WHERE key = $1', [`${cat}:${id}`]));
            }
          }
          await Promise.all(tarefas);
        },
      },
    },
    salvarCreds: () => gravar('creds', creds),
  };
}

const apagarSessao = () => db.query('DELETE FROM wa_auth').catch(() => {});

async function ligar() {
  querLigado = true;
  clearTimeout(timerReconectar);
  if (sock) return;
  const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, Browsers } = await lib();
  const auth = await sessaoNoBanco();
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { /* usa a versão que vem na biblioteca */ }
  if (st.estado !== 'qr') st.estado = 'conectando';
  const s = makeWASocket({
    auth: auth.state, logger: SILENT, version, browser: Browsers.ubuntu('Fomito'),
    markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false,
  });
  sock = s;
  let viuQr = false;
  s.ev.on('creds.update', auth.salvarCreds);
  s.ev.on('connection.update', async (u) => {
    if (sock !== s) return;
    if (u.qr) {
      viuQr = true;
      st.qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 300 });
      st.estado = 'qr';
    }
    if (u.connection === 'open') {
      tentativas = 0;
      st.qr = null;
      st.numero = String(s.user?.id || '').split(/[:@]/)[0];
      st.nome = s.user?.name || s.user?.verifiedName || '';
      await marcar('on');
    }
    if (u.connection === 'close') {
      sock = null;
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
        querLigado = false; st.numero = ''; st.nome = '';
        await apagarSessao();
        return marcar('off', 'O WhatsApp foi desconectado pelo celular. Toque em Conectar e leia o QR Code de novo.');
      }
      if (!querLigado) return marcar('off');
      if (code === DisconnectReason.restartRequired) return ligar().catch(falhou); // acontece logo depois de ler o QR Code
      if (!auth.creds.me) {
        querLigado = false;
        if (!viuQr) console.error('WhatsApp da loja:', u.lastDisconnect?.error?.message);
        return marcar('off', viuQr ? 'O QR Code expirou. Toque em Conectar para gerar outro.' : 'Não deu para falar com o WhatsApp agora. Tente de novo em alguns minutos.');
      }
      tentativas += 1;
      st.estado = 'conectando';
      timerReconectar = setTimeout(() => ligar().catch(falhou), Math.min(120000, 3000 * 2 ** Math.min(tentativas, 6)));
    }
  });
}

function falhou(err) {
  sock = null;
  console.error('WhatsApp da loja:', err.message);
  marcar('off', 'Não deu para conectar ao WhatsApp agora. Tente de novo em alguns minutos.');
}

/** Dono tocou em "Conectar": gera o QR Code (a tela pergunta o status até aparecer). */
async function conectar() {
  if (st.estado === 'on' || st.estado === 'qr') return info();
  st.erro = '';
  await ligar().catch(falhou);
  return info();
}

/** Dono tocou em "Desconectar": sai do WhatsApp e apaga a sessão. */
async function desconectar() {
  querLigado = false;
  clearTimeout(timerReconectar);
  const s = sock; sock = null;
  if (s) { try { await s.logout(); } catch { try { s.end(undefined); } catch { /* já fechou */ } } }
  await apagarSessao();
  st.numero = ''; st.nome = ''; st.qr = null;
  await marcar('off');
  return info();
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Manda um texto para um celular brasileiro (só os números, com DDD). */
/* Só para testar no computador, sem celular conectado: WHATSAPP_SIMULAR=1 mostra as mensagens no terminal */
const SIMULAR = process.env.WHATSAPP_SIMULAR === '1';

async function enviar(telefone, texto) {
  if (SIMULAR) { console.log(`[WhatsApp simulado] para ${telefone}: ${texto}`); return; }
  if (st.estado !== 'on' || !sock) throw Object.assign(new Error('O WhatsApp da loja está desconectado.'), { status: 409 });
  let d = String(telefone || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10) throw Object.assign(new Error('Telefone incompleto.'), { status: 400 });
  // Pergunta ao WhatsApp qual é o número certo (alguns celulares antigos não têm o 9 na conta)
  const [r] = await sock.onWhatsApp('55' + d);
  if (!r || !r.exists) throw Object.assign(new Error('Esse número não tem WhatsApp.'), { status: 400 });
  // Mostra "digitando…" por alguns segundos, como uma pessoa faria
  await sock.sendPresenceUpdate('composing', r.jid).catch(() => {});
  await esperar(1200 + Math.min(3000, texto.length * 20));
  await sock.sendPresenceUpdate('paused', r.jid).catch(() => {});
  await sock.sendMessage(r.jid, { text: texto });
}

const moeda = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const montar = (texto, dados) => texto.replace(/\{(\w+)\}/g, (_, k) => dados[k] ?? `{${k}}`);

/**
 * Avisa o cliente sobre o pedido (recebido, preparo, saiu, entregue).
 * Roda em segundo plano: se o WhatsApp falhar, o pedido segue normal.
 */
async function avisar(pedido, tipo) {
  try {
    const { config, cardapio } = loja.obter();
    const modelo = config.whatsapp.modelos[tipo];
    if (!modelo?.ativo || (st.estado !== 'on' && !SIMULAR) || !pedido.telefone) return;
    const forma = cardapio.formasPagamento.find((f) => f.id === pedido.pag);
    const texto = montar(modelo.texto, {
      nome: String(pedido.cliente || '').split(' ')[0] || 'tudo bem',
      pedido: pedido.num ?? '',
      loja: config.marca.nome,
      total: moeda(pedido.total || 0),
      previsao: cardapio.lanchonete.tempoEntrega,
      mesa: pedido.mesa || '',
      endereco: cardapio.lanchonete.endereco || 'nosso balcão',
      pagamento: forma ? forma.nome + (pedido.pag === 'dinheiro' && pedido.troco ? `, troco para ${moeda(pedido.troco)}` : '') : '-',
    });
    await enviar(pedido.telefone, texto);
    /* No pedido (entrega e balcão) fica marcada a última mensagem; a mesa não guarda */
    if (pedido.mesa == null && pedido.num) await db.query(`UPDATE pedidos SET dados = jsonb_set(dados, '{whats}', to_jsonb($2::text)) WHERE num = $1`, [pedido.num, modelo.titulo]);
  } catch (err) {
    console.error(`WhatsApp (pedido #${pedido.num}, ${tipo}):`, err.message);
  }
}

/** Mensagem de teste do painel (Configurações → WhatsApp) */
async function testar(numero) {
  const { config } = loja.obter();
  await enviar(numero, `Teste do ${config.marca.nome}: as mensagens automáticas dos pedidos estão funcionando. ✅`);
  return { ok: true };
}

/** Ao ligar o servidor: se já tinha um WhatsApp conectado, reconecta sozinho. */
async function iniciar() {
  try {
    const { rows } = await db.query("SELECT 1 FROM wa_auth WHERE key = 'creds' AND value LIKE '%\"me\"%'");
    if (rows[0]) await ligar();
    else if (loja.obter()?.config?.whatsapp?.conectado) await marcar('off'); // banco dizia conectado, mas não há sessão
  } catch (err) { falhou(err); }
}

module.exports = { enviarTexto: (telefone, texto) => enviar(telefone, texto), avisar, conectar, desconectar, testar, iniciar, status: async () => info() };
