// Mensagens automáticas no WhatsApp do cliente pela Evolution API (igual ao BarberFlow).
// Quem envia é sempre o servidor: a chave da API nunca vai para o navegador.
const db = require('./db');
const loja = require('./loja');

const moeda = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const montar = (texto, dados) => texto.replace(/\{(\w+)\}/g, (_, k) => dados[k] ?? `{${k}}`);

function api() {
  const w = loja.obter().config.whatsapp;
  const apiKey = process.env.EVOLUTION_API_KEY || w.apiKey;
  if (!w.apiUrl || !apiKey || !w.instancia) return null;
  return {
    instancia: encodeURIComponent(w.instancia),
    chamar: async (metodo, caminho, corpo) => {
      const r = await fetch(`${w.apiUrl}${caminho}`, {
        method: metodo,
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(15000),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(dados?.response?.message?.[0] || dados?.message || `Evolution API respondeu ${r.status}`), { status: 502 });
      return dados;
    },
  };
}

/**
 * Avisa o cliente sobre o pedido (recebido, preparo, saiu, entregue).
 * Roda em segundo plano: se o WhatsApp falhar, o pedido segue normal.
 */
async function avisar(pedido, tipo) {
  try {
    const { config, cardapio } = loja.obter();
    const modelo = config.whatsapp.modelos[tipo];
    const conexao = api();
    if (!modelo?.ativo || !conexao || !config.whatsapp.conectado || !pedido.telefone) return;
    const digitos = String(pedido.telefone).replace(/\D/g, '');
    if (digitos.length < 10) return;
    const forma = cardapio.formasPagamento.find((f) => f.id === pedido.pag);
    const texto = montar(modelo.texto, {
      nome: String(pedido.cliente || '').split(' ')[0],
      pedido: pedido.num,
      loja: config.marca.nome,
      total: moeda(pedido.total),
      previsao: cardapio.lanchonete.tempoEntrega,
      pagamento: forma ? forma.nome + (pedido.pag === 'dinheiro' && pedido.troco ? `, troco para ${moeda(pedido.troco)}` : '') : '-',
    });
    await conexao.chamar('POST', `/message/sendText/${conexao.instancia}`, { number: '55' + digitos, text: texto });
    await db.query(`UPDATE pedidos SET dados = jsonb_set(dados, '{whats}', to_jsonb($2::text)) WHERE num = $1`, [pedido.num, modelo.titulo]);
  } catch (err) {
    console.error(`WhatsApp (pedido #${pedido.num}, ${tipo}):`, err.message);
  }
}

/** Gera o QR Code para conectar o número da loja. Cria a instância se ainda não existir. */
async function conectar() {
  const conexao = api();
  if (!conexao) throw Object.assign(new Error('Preencha a URL da API, a chave e o nome da instância e salve antes de conectar.'), { status: 400 });
  try {
    await conexao.chamar('POST', '/instance/create', { instanceName: decodeURIComponent(conexao.instancia), qrcode: true, integration: 'WHATSAPP-BAILEYS' });
  } catch { /* a instância já existe */ }
  const r = await conexao.chamar('GET', `/instance/connect/${conexao.instancia}`);
  if (r?.instance?.state === 'open') { await status(); return { conectado: true }; }
  return { qr: r.base64 || null, codigo: r.pairingCode || null };
}

/** Pergunta à Evolution API se o número está conectado e guarda a resposta. */
async function status() {
  const conexao = api();
  if (!conexao) return { conectado: false };
  const r = await conexao.chamar('GET', `/instance/connectionState/${conexao.instancia}`);
  const conectado = r?.instance?.state === 'open' || r?.state === 'open';
  let numero = '';
  if (conectado) {
    try {
      const lista = await conexao.chamar('GET', `/instance/fetchInstances?instanceName=${conexao.instancia}`);
      const dono = (Array.isArray(lista) ? lista[0] : lista)?.ownerJid || (Array.isArray(lista) ? lista[0] : lista)?.instance?.owner || '';
      numero = String(dono).split('@')[0];
    } catch { /* sem o número, segue */ }
  }
  const w = loja.obter().config.whatsapp;
  if (w.conectado !== conectado || w.numero !== numero) await loja.marcarWhatsApp(conectado, numero);
  return { conectado, numero };
}

async function desconectar() {
  const conexao = api();
  if (conexao) await conexao.chamar('DELETE', `/instance/logout/${conexao.instancia}`).catch(() => {});
  await loja.marcarWhatsApp(false);
}

module.exports = { avisar, conectar, status, desconectar };
