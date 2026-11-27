// Rotas da API. Cada uma diz quem pode usar: cliente (sem login), garçom, motoboy ou administrador.
const express = require('express');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const db = require('./db');
const loja = require('./loja');
const whatsapp = require('./whatsapp');
const s = require('./servicos');
const { estado } = require('./estado');
const { abrirSessao, fecharSessao, exigir } = require('./auth');
const { falhar, texto, dispositivoDe, limitador } = require('./util');

const r = express.Router();
const ok = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then((v) => { if (!res.headersSent) res.json(v ?? { ok: true }); }).catch(next);
const nome = (req) => req.usuario?.nome || 'Equipe';

/* Perfis:
   admin     → tudo
   atendente → pedidos, comandas, caixa e clientes (sem visão geral, cardápio, configurações e sem criar equipe)
   garcom    → comandas das mesas
   motoboy   → entregas */
const admin = exigir('admin');
const balcao = exigir('admin', 'atendente');
const garcom = exigir('garcom', 'atendente', 'admin');
const motoboy = exigir('motoboy', 'admin');
const ehEquipeLoja = (req) => ['admin', 'atendente'].includes(req.usuario?.perfil);
const ehSalao = (req) => ['garcom', 'atendente', 'admin'].includes(req.usuario?.perfil);

const limiteLogin = limitador(10, 10 * 60 * 1000);
const limitePedidos = limitador(15, 60 * 60 * 1000);
const limiteClientes = limitador(40, 60 * 60 * 1000);

r.get('/estado', ok(estado));

/* ---------- Login da equipe ---------- */
r.post('/login', ok(async (req, res) => {
  limiteLogin(req.ip);
  const usuario = texto(req.body.usuario, 40).toLowerCase();
  const { rows } = await db.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(req.body.senha || ''), u.senha_hash))) falhar(401, 'Usuário ou senha incorretos. Confira e tente de novo.');
  abrirSessao(res, u);
  return { nome: u.nome, usuario: u.usuario, perfil: u.perfil };
}));
r.post('/logout', ok((req, res) => { fecharSessao(res); }));

/* ---------- Equipe (só o administrador) ---------- */
r.post('/usuarios', admin, ok(async (req) => {
  const n = texto(req.body.nome, 60);
  const usuario = texto(req.body.usuario, 30).toLowerCase();
  const senha = String(req.body.senha || '');
  const perfil = req.body.perfil;
  if (!n || !usuario) falhar(400, 'Preencha o nome e o usuário.');
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) falhar(400, 'O usuário precisa ter de 3 a 30 letras ou números, sem espaços nem acentos.');
  if (senha.length < 4) falhar(400, 'A senha precisa ter pelo menos 4 caracteres.');
  if (!['atendente', 'garcom', 'motoboy', 'admin'].includes(perfil)) falhar(400, 'Tipo de funcionário inválido.');
  try {
    await db.query('INSERT INTO usuarios (nome, usuario, senha_hash, perfil) VALUES ($1, $2, $3, $4)', [n, usuario, await bcrypt.hash(senha, 10), perfil]);
  } catch (err) {
    if (err.code === '23505') falhar(409, 'Já existe alguém com esse usuário.');
    throw err;
  }
}));
r.delete('/usuarios/:usuario', admin, ok(async (req) => {
  if (req.params.usuario === req.usuario.usuario) falhar(400, 'Você não pode remover o seu próprio acesso.');
  const { rows } = await db.query("SELECT count(*)::int AS n FROM usuarios WHERE perfil = 'admin' AND usuario <> $1", [req.params.usuario]);
  const { rows: alvo } = await db.query('SELECT perfil FROM usuarios WHERE usuario = $1', [req.params.usuario]);
  if (alvo[0]?.perfil === 'admin' && !rows[0].n) falhar(400, 'O sistema precisa de pelo menos um administrador.');
  await db.query('DELETE FROM usuarios WHERE usuario = $1', [req.params.usuario]);
}));

/* ---------- Configurações, cardápio e mesas (administrador) ---------- */
r.put('/config', admin, ok(async (req) => { await loja.salvarConfig(req.body); }));
r.put('/cardapio', admin, ok(async (req) => { await loja.salvarCardapio(req.body); }));

/** Pausar ou voltar a receber pedidos (o atendente também pode) */
r.post('/loja/aberta', balcao, ok(async (req) => { await loja.definirAberta(req.body.aberta !== false); }));

r.get('/mesas/:numero/qr.svg', balcao, ok(async (req, res) => {
  const mesa = (await loja.mesas()).find((m) => m.numero === Number(req.params.numero));
  if (!mesa) falhar(404, 'Mesa não encontrada.');
  const url = `${req.protocol}://${req.get('host')}/?m=${mesa.codigo}`;
  res.type('image/svg+xml').send(await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#1B1530', light: '#FFFFFF' } }));
}));

/** Folha para imprimir os QR Codes de todas as mesas. */
r.get('/mesas/imprimir', balcao, ok(async (req, res) => {
  const { config } = loja.obter();
  const cartoes = await Promise.all((await loja.mesas()).map(async (m) => {
    const svg = await QRCode.toString(`${req.protocol}://${req.get('host')}/?m=${m.codigo}`, { type: 'svg', margin: 1 });
    return `<div class="c">${svg}<b>Mesa ${String(m.numero).padStart(2, '0')}</b><span>Aponte a câmera e peça por aqui</span></div>`;
  }));
  const nomeLoja = config.marca.nome.replace(/</g, '&lt;');
  res.type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>QR Codes das mesas · ${nomeLoja}</title>
<style>body{font-family:system-ui,sans-serif;margin:16px;color:#1B1530}h1{font-size:18px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.c{border:1.5px dashed #bbb;border-radius:12px;padding:14px;text-align:center;display:flex;flex-direction:column;gap:6px;break-inside:avoid}
.c svg{width:100%;max-width:180px;margin:0 auto}.c b{font-size:22px}.c span{font-size:12px;color:#555}@media print{h1,p{display:none}}</style>
<h1>${nomeLoja} · QR Codes das mesas</h1><p>Recorte e cole em cada mesa. Cada código só abre a própria mesa.</p>
<div class="g">${cartoes.join('')}</div><script>window.print()</script></html>`);
}));

/* ---------- WhatsApp da loja (QR Code, igual ao BarberFlow) ---------- */
r.post('/whatsapp/conectar', admin, ok(() => whatsapp.conectar()));
r.get('/whatsapp/status', admin, ok(() => whatsapp.status()));
r.post('/whatsapp/desconectar', admin, ok(() => whatsapp.desconectar()));
r.post('/whatsapp/teste', admin, ok((req) => whatsapp.testar(req.body.numero)));

/* ---------- Clientes: cadastro pelo telefone ---------- */
const quemPede = (req) => (ehEquipeLoja(req) ? '*' : dispositivoDe(req) || falhar(400, 'Atualize a página e tente de novo.'));
r.post('/clientes/buscar', ok(async (req) => {
  limiteClientes(req.ip);
  return { cliente: await s.buscarCliente(req.body.telefone, quemPede(req)) };
}));
r.post('/clientes', ok(async (req) => {
  limiteClientes(req.ip);
  return s.salvarCliente(req.body, quemPede(req));
}));

/* ---------- Pedidos de entrega e balcão ---------- */
r.post('/pedidos', ok(async (req) => {
  const equipe = ehEquipeLoja(req);
  if (!equipe) limitePedidos(req.ip);
  return s.criarPedido(req.body, { equipe, dispositivo: equipe ? null : dispositivoDe(req) });
}));
r.post('/pedidos/:num/avancar', balcao, ok((req) => s.avancarPedido(req.params.num)));
r.post('/pedidos/:num/cancelar', balcao, ok((req) => s.cancelarPedido(req.params.num, nome(req))));
r.post('/pedidos/sair', motoboy, ok((req) => s.sairParaEntrega(req.body.nums, nome(req))));
r.post('/pedidos/:num/entregar', motoboy, ok((req) => s.concluirEntrega(req.params.num, req.body, nome(req))));

/* ---------- Comandas das mesas ---------- */
/** Cliente pelo QR Code: a mesa sai do código (ninguém pede em nome de outra mesa digitando o número). */
async function mesaDoCliente(req) {
  const pelaMesa = await loja.mesaDoCodigo(String(req.body.codigo || ''));
  if (pelaMesa) return pelaMesa;
  // Já tem comanda aberta com este aparelho (pedir mais / pedir a conta)
  const disp = dispositivoDe(req);
  const n = Number(req.body.mesa);
  if (disp && n) {
    const { rows } = await db.query(`SELECT mesa FROM comandas WHERE aberta AND mesa = $1 AND (dados->'dispositivos') ? $2`, [n, disp]);
    if (rows[0]) return n;
  }
  falhar(403, 'Leia o QR Code da mesa para pedir por aqui.');
}

r.post('/comandas/lancar', ok(async (req) => {
  const equipe = ehSalao(req);
  if (equipe) return s.lancarNaComanda(req.body.mesa, req.body.itens, { nome: req.body.nome, por: 'garcom', quem: nome(req) });
  limitePedidos(req.ip);
  return s.lancarNaComanda(await mesaDoCliente(req), req.body.itens, { nome: req.body.nome, por: 'qr', telefone: req.body.telefone, dispositivo: dispositivoDe(req) });
}));
r.post('/comandas/:mesa/rodadas/:i', garcom, ok((req) => s.statusRodada(req.params.mesa, req.params.i, req.body.status, req.usuario.perfil)));
r.post('/comandas/conta', ok(async (req) => {
  const equipe = ehSalao(req);
  return s.pedirConta(equipe ? req.body.mesa : await mesaDoCliente(req), req.body.sim !== false);
}));
r.post('/comandas/:mesa/fechar', garcom, ok((req) => s.fecharComanda(req.params.mesa, req.body, nome(req))));

/* ---------- Caixa (administrador e atendente) ---------- */
r.post('/caixa/abrir', balcao, ok((req) => s.abrirCaixa(req.body, nome(req))));
r.post('/caixa/movimento', balcao, ok((req) => s.movimentoCaixa(req.body, nome(req))));
r.post('/caixa/corrigir', balcao, ok((req) => s.corrigirMovimento(String(req.body.id), req.body.novo || {}, req.body, nome(req))));
r.post('/caixa/fechar', balcao, ok((req) => s.fecharCaixa(req.body, nome(req))));

r.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

module.exports = r;
