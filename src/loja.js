// Configurações (marca, WhatsApp, impressão, som) e cardápio da loja.
// Ficam numa linha da tabela "loja" e numa cópia em memória, atualizada a cada mudança.
const crypto = require('crypto');
const db = require('./db');
const { falhar, texto, numero, separarNumero } = require('./util');

const CONFIG_PADRAO = require('./padrao/config.json');
const CARDAPIO_PADRAO = require('./padrao/cardapio.json');

let atual = null; // { config, cardapio, versao }

/** Junta o salvo com o padrão (campos novos sempre existem). */
function mesclar(base, extra) {
  const r = { ...base };
  for (const k in extra) {
    r[k] = extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object'
      ? mesclar(base[k], extra[k]) : extra[k];
  }
  return r;
}

async function carregar() {
  await db.query(`INSERT INTO loja (id, config, cardapio) VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING`,
    [CONFIG_PADRAO, CARDAPIO_PADRAO]);
  const { rows } = await db.query('SELECT config, cardapio, versao FROM loja WHERE id = 1');
  atual = { config: mesclar(CONFIG_PADRAO, rows[0].config), cardapio: mesclar(CARDAPIO_PADRAO, rows[0].cardapio), versao: rows[0].versao };
  await garantirMesas(atual.cardapio.lanchonete.mesas);
  return atual;
}

const obter = () => atual;

/* ---------- Imagens: o painel manda "data:image/...", aqui viram /img/123 ---------- */
const TIPOS = { 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1, 'image/gif': 1 };
async function extrairImagens(valor) {
  if (typeof valor === 'string') {
    const m = valor.match(/^data:(image\/[a-z+]+);base64,(.+)$/s);
    if (!m) return valor;
    if (!TIPOS[m[1]]) falhar(400, 'Envie a imagem em JPG, PNG ou WEBP.');
    const dados = Buffer.from(m[2], 'base64');
    if (dados.length > 3 * 1024 * 1024) falhar(413, 'Imagem muito grande (máximo 3 MB).');
    const { rows } = await db.query('INSERT INTO imagens (tipo, dados) VALUES ($1, $2) RETURNING id', [m[1], dados]);
    return `/img/${rows[0].id}`;
  }
  if (Array.isArray(valor)) return Promise.all(valor.map(extrairImagens));
  if (valor && typeof valor === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(valor)) r[k] = await extrairImagens(v);
    return r;
  }
  return valor;
}

async function gravar(campos) {
  const novo = { ...atual, ...campos };
  const { rows } = await db.query(
    'UPDATE loja SET config = $1, cardapio = $2, versao = versao + 1, atualizado_em = now() WHERE id = 1 RETURNING versao',
    [novo.config, novo.cardapio]);
  atual = { ...novo, versao: rows[0].versao };
  return atual;
}

/* ---------- Configurações ---------- */
async function salvarConfig(recebida) {
  if (!recebida || typeof recebida !== 'object') falhar(400, 'Configurações inválidas.');
  const config = mesclar(CONFIG_PADRAO, await extrairImagens(recebida));
  const m = config.marca;
  m.nome = texto(m.nome, 60) || 'Fomito';
  m.slogan = texto(m.slogan, 120);
  for (const c of ['corPrincipal', 'corDestaque']) if (!/^#[0-9a-f]{6}$/i.test(m[c])) m[c] = CONFIG_PADRAO.marca[c];
  // O navegador nunca decide se o WhatsApp está conectado: isso vem da conexão do servidor (src/whatsapp.js)
  config.whatsapp.conectado = atual.config.whatsapp.conectado;
  config.whatsapp.numero = atual.config.whatsapp.numero;
  config.whatsapp.apiUrl = texto(config.whatsapp.apiUrl, 300).replace(/\/+$/, '');
  config.whatsapp.instancia = texto(config.whatsapp.instancia, 60).replace(/[^\w.-]/g, '');
  const cardapio = { ...atual.cardapio, lanchonete: { ...atual.cardapio.lanchonete, nome: m.nome, slogan: m.slogan } };
  return gravar({ config, cardapio });
}

/** Marca a conexão do WhatsApp (chamado pelo servidor, quando a conexão abre ou cai). */
/** Número de mesas do salão: cria o código do QR das mesas novas */
async function definirMesas(qtd) {
  const n = Math.min(200, Math.max(1, parseInt(qtd, 10) || 0));
  if (!n) falhar(400, 'Número de mesas inválido.');
  await garantirMesas(n);
  const cardapio = { ...atual.cardapio, lanchonete: { ...atual.cardapio.lanchonete, mesas: n } };
  return gravar({ cardapio });
}

/** Pausar ou voltar a receber pedidos (administrador ou atendente) */
async function definirAberta(aberta) {
  const cardapio = { ...atual.cardapio, lanchonete: { ...atual.cardapio.lanchonete, aberta: !!aberta } };
  return gravar({ cardapio });
}

async function marcarWhatsApp(conectado, numeroLoja = '') {
  const config = structuredClone(atual.config);
  config.whatsapp.conectado = conectado;
  config.whatsapp.numero = conectado ? numeroLoja : '';
  return gravar({ config });
}

/** O que as telas sem login (e garçom/motoboy) podem ver: sem a chave do WhatsApp. */
function configPublica(config) {
  const { marca, impressao, som } = config;
  return { marca, impressao, som };
}

/* ---------- Cardápio ---------- */
async function salvarCardapio(recebido) {
  if (!recebido || !Array.isArray(recebido.produtos) || !Array.isArray(recebido.categorias)) falhar(400, 'Cardápio inválido.');
  const c = await extrairImagens(recebido);
  const l = c.lanchonete || {};
  const lanchonete = {
    ...atual.cardapio.lanchonete,
    /* Endereço da loja em partes (rua, número, bairro, cidade); o texto completo é montado aqui */
    rua: texto(l.rua, 120), numero: texto(l.numero, 12), bairro: texto(l.bairro, 60), cidade: texto(l.cidade, 60),
    endereco: l.rua ? [[texto(l.rua, 120), texto(l.numero, 12)].filter(Boolean).join(', '), texto(l.bairro, 60), texto(l.cidade, 60)].filter(Boolean).join(', ') : texto(l.endereco, 200),
    horario: texto(l.horario, 120),
    telefone: texto(l.telefone, 30),
    abre: texto(l.abre, 5),
    fecha: texto(l.fecha, 5),
    dias: Array.isArray(l.dias) ? [...new Set(l.dias.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : (atual.cardapio.lanchonete.dias || []),
    mapa: /^https:\/\/[^\s"<>]+$/i.test(texto(l.mapa, 500)) ? texto(l.mapa, 500) : '', // link do Google Maps (opcional)
    tempoEntrega: texto(l.tempoEntrega, 30),
    taxaEntrega: Math.max(0, numero(l.taxaEntrega) || 0),
    mesas: Math.min(200, Math.max(0, parseInt(l.mesas, 10) || 0)),
    aberta: l.aberta !== false,
    vitrine: Array.isArray(l.vitrine) ? l.vitrine.slice(0, 12) : [],
  };
  /* Adicionais avulsos: não pertencem a uma categoria; cada produto escolhe os seus */
  const avulsos = (Array.isArray(c.avulsos) ? c.avulsos : []).slice(0, 200)
    .map((a) => ({ id: texto(a.id, 40), nome: texto(a.nome, 60), preco: Math.max(0, numero(a.preco) || 0) }))
    .filter((a, i, l) => a.id && a.nome && l.findIndex((x) => x.id === a.id) === i);
  const produtos = c.produtos.map((p) => ({
    ...p,
    id: Number(p.id),
    nome: texto(p.nome, 80),
    desc: texto(p.desc, 400),
    preco: Math.max(0, numero(p.preco) || 0),
    esgotado: !!p.esgotado,
    destaque: !!p.destaque,
    ingredientes: (p.ingredientes || []).map((i) => texto(i, 60)).slice(0, 30),
    fotos: (p.fotos || []).slice(0, 10),
    /* Adicionais só deste produto (avulsos) e os da categoria que ele não oferece */
    avulsos: (Array.isArray(p.avulsos) ? p.avulsos : []).map((x) => texto(x, 40)).filter((x) => avulsos.some((a) => a.id === x)),
    adicionaisFora: (Array.isArray(p.adicionaisFora) ? p.adicionaisFora : []).map((x) => texto(x, 40)).slice(0, 60),
  }));
  if (new Set(produtos.map((p) => p.id)).size !== produtos.length || produtos.some((p) => !Number.isInteger(p.id))) falhar(400, 'Produtos com código repetido.');
  const formasPagamento = (c.formasPagamento || atual.cardapio.formasPagamento).map((f) => ({ ...f, ativa: f.ativa !== false }));
  const cardapio = { ...atual.cardapio, ...c, lanchonete, produtos, formasPagamento, avulsos };
  await garantirMesas(lanchonete.mesas);
  return gravar({ cardapio });
}

/* ---------- Mesas e códigos do QR ---------- */
const novoCodigo = () => crypto.randomBytes(5).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, 'x').slice(0, 6);
async function garantirMesas(qtd) {
  const { rows } = await db.query('SELECT numero FROM mesas');
  const tem = new Set(rows.map((r) => r.numero));
  for (let n = 1; n <= qtd; n++) {
    if (!tem.has(n)) await db.query('INSERT INTO mesas (numero, codigo) VALUES ($1, $2) ON CONFLICT DO NOTHING', [n, novoCodigo()]);
  }
}

async function mesas() {
  const { rows } = await db.query('SELECT numero, codigo FROM mesas WHERE numero <= $1 ORDER BY numero', [atual.cardapio.lanchonete.mesas]);
  return rows;
}

async function mesaDoCodigo(codigo) {
  if (!codigo || !/^[a-z0-9]{4,12}$/.test(codigo)) return null;
  const { rows } = await db.query('SELECT numero FROM mesas WHERE codigo = $1 AND numero <= $2', [codigo, atual.cardapio.lanchonete.mesas]);
  return rows[0]?.numero || null;
}

module.exports = { carregar, obter, salvarConfig, salvarCardapio, definirAberta, definirMesas, marcarWhatsApp, configPublica, mesas, mesaDoCodigo, mesclar };
