// Gestão de clientes: mensagem automática no WhatsApp para quem sumiu.
// Liga em Painel › Clientes. Roda de hora em hora, só das 10h às 20h, no máximo
// 15 mensagens por vez, e nunca repete para o mesmo cliente antes do intervalo.
const db = require('./db');
const loja = require('./loja');
const whatsapp = require('./whatsapp');

const DIA = 86400000;
const POR_RODADA = 15;
const montar = (texto, dados) => texto.replace(/\{(\w+)\}/g, (_, k) => dados[k] ?? `{${k}}`);
const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || 'tudo bem';

/** Clientes que estão sem pedir há "dias" e não receberam a mensagem dentro do "intervalo" */
async function candidatos(cfg = loja.obter().config.clientes.reativacao) {
  const { rows } = await db.query(
    `SELECT c.telefone, c.nome, c.contato, max(p.criado_em) AS ultimo
       FROM clientes c JOIN pedidos p ON p.telefone = c.telefone AND p.status <> 'cancelado'
      GROUP BY c.telefone
     HAVING max(p.criado_em) < now() - make_interval(days => $1)
      ORDER BY max(p.criado_em) DESC`, [cfg.dias]);
  return rows
    .filter((r) => !r.contato?.reativadoEm || Date.now() - r.contato.reativadoEm >= cfg.intervalo * DIA)
    .map((r) => ({ telefone: r.telefone, nome: r.nome, dias: Math.floor((Date.now() - new Date(r.ultimo).getTime()) / DIA) }));
}

/** Clientes escolhidos na tela, com os dias desde o último pedido */
async function escolhidos(telefones) {
  const { rows } = await db.query(
    `SELECT c.telefone, c.nome, max(p.criado_em) AS ultimo FROM clientes c
       LEFT JOIN pedidos p ON p.telefone = c.telefone AND p.status <> 'cancelado'
      WHERE c.telefone = ANY($1) GROUP BY c.telefone`, [telefones.map((t) => String(t).replace(/\D/g, ''))]);
  return rows.map((r) => ({ telefone: r.telefone, nome: r.nome, dias: r.ultimo ? Math.floor((Date.now() - new Date(r.ultimo).getTime()) / DIA) : 0 }));
}

/** Manda a mensagem para os sumidos. manual = o dono apertou "Enviar agora" (vale fora do horário). */
async function rodar({ manual = false, telefones = null } = {}) {
  const { config } = loja.obter();
  const cfg = config.clientes?.reativacao;
  if (!cfg || (!manual && !cfg.ativo)) return { enviados: 0, faltam: 0 };
  const hora = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }));
  if (!manual && (hora < 10 || hora >= 20)) return { enviados: 0, faltam: 0 };
  /* Selecionados na tela: vai só para eles (o dono escolheu, então não espera o intervalo) */
  const lista = Array.isArray(telefones) && telefones.length
    ? await escolhidos(telefones.slice(0, 30))
    : await candidatos(cfg);
  let enviados = 0;
  const erros = [];
  for (const c of lista.slice(0, telefones ? 30 : POR_RODADA)) {
    try {
      await whatsapp.enviarTexto(c.telefone, montar(cfg.texto, { nome: primeiroNome(c.nome), dias: c.dias, loja: config.marca.nome }));
      await db.query(`UPDATE clientes SET contato = coalesce(contato, '{}'::jsonb) || $2::jsonb WHERE telefone = $1`, [c.telefone, { reativadoEm: Date.now() }]);
      enviados++;
    } catch (err) {
      erros.push(err.message);
      if (err.status === 409) break; // WhatsApp desconectado: para e tenta na próxima rodada
    }
  }
  return { enviados, faltam: Math.max(0, lista.length - enviados), erro: erros[0] || null };
}

function iniciar() {
  setTimeout(() => rodar().catch(() => {}), 2 * 60 * 1000);
  setInterval(() => rodar().catch(() => {}), 60 * 60 * 1000);
}

module.exports = { candidatos, rodar, iniciar };
