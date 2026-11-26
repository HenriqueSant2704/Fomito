require('dotenv').config();
process.env.TZ ||= 'America/Sao_Paulo'; // "hoje" do caixa e dos relatórios é o dia da loja

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');
const loja = require('./loja');
const { lerSessao } = require('./auth');
const { criarAdminInicial } = require('./setup-db');

const app = express();
const PUBLIC = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '12mb' })); // fotos do cardápio chegam junto
app.use(cookieParser());
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' });
  next();
});

app.get('/saude', (req, res) => res.json({ ok: true }));

app.use('/api', lerSessao(db), (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, require('./rotas'));

// Fotos enviadas pelo painel (o endereço muda quando a foto muda, então pode guardar em cache)
app.get('/img/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT tipo, dados FROM imagens WHERE id = $1', [Number(req.params.id) || 0]);
    if (!rows[0]) return res.sendStatus(404);
    res.set({ 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Security-Policy': "default-src 'none'" });
    res.type(rows[0].tipo).send(rows[0].dados);
  } catch (err) { next(err); }
});

// O sistema começa pelo cardápio do cliente. O QR Code da mesa chega como /?m=codigo.
app.get(['/', '/index.html'], (req, res) => {
  const q = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(302, `/cliente/${q}`);
});
// /painel → /painel/ (as telas usam caminhos relativos como ../compartilhado/)
app.get(['/portal', '/painel', '/garcom', '/motoboy', '/cliente'], (req, res, next) => {
  if (req.originalUrl.split('?')[0].endsWith('/')) return next();
  const q = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(302, `${req.path}/${q}`);
});

app.use(express.static(PUBLIC, {
  extensions: ['html'],
  setHeaders: (res, arquivo) => { if (/\.(html|js|css)$/.test(arquivo)) res.set('Cache-Control', 'no-cache'); },
}));

// Erros: mensagens claras para quem usa, detalhes técnicos só no terminal
app.use((err, req, res, next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err.status === 502) return res.status(502).json({ error: `WhatsApp: ${err.message}` });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Arquivo muito grande.' });
  console.error(err);
  res.status(500).json({ error: 'Algo deu errado no servidor. Tente de novo.' });
});

const PORT = Number(process.env.PORT) || 3000;

// Ao ligar, garante as tabelas (é seguro rodar sempre): uma atualização no Render já ajusta o Neon sozinha.
async function iniciar() {
  await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await loja.carregar();
  await criarAdminInicial();
  app.listen(PORT, () => {
    console.log('\n  Fomito rodando:');
    console.log(`  Cardápio do cliente: http://localhost:${PORT}`);
    console.log(`  Portal da equipe:    http://localhost:${PORT}/portal/\n`);
  });
  // De tempos em tempos confere se o WhatsApp da loja continua conectado
  setInterval(() => require('./whatsapp').status().catch(() => {}), 5 * 60 * 1000).unref();
}

iniciar().catch((err) => {
  console.error('Não consegui iniciar:', err.message);
  process.exit(1);
});
