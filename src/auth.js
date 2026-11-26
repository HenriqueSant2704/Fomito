// Login da equipe (administrador, garçom e motoboy) com sessão num cookie protegido.
const jwt = require('jsonwebtoken');
const { erro } = require('./util');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) {
  console.error('\n  Defina JWT_SECRET no .env com pelo menos 16 caracteres (veja o README).\n');
  process.exit(1);
}
const COOKIE = 'fomito_sessao';

function abrirSessao(res, usuario) {
  const token = jwt.sign({ id: usuario.id }, SECRET, { expiresIn: '30d' });
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 3600 * 1000, path: '/',
  });
}
function fecharSessao(res) { res.clearCookie(COOKIE, { path: '/' }); }

/**
 * Lê o cookie e coloca em req.usuario { id, nome, usuario, perfil } (ou null).
 * Confere no banco a cada vez: se o administrador removeu a pessoa, ela sai na hora.
 */
function lerSessao(db) {
  return async (req, res, next) => {
    req.usuario = null;
    const token = req.cookies && req.cookies[COOKIE];
    if (!token) return next();
    try {
      const { id } = jwt.verify(token, SECRET);
      const { rows } = await db.query('SELECT id, nome, usuario, perfil FROM usuarios WHERE id = $1', [id]);
      req.usuario = rows[0] || null;
      if (!req.usuario) fecharSessao(res);
    } catch {
      fecharSessao(res);
    }
    next();
  };
}

/** Só deixa passar quem tem um destes perfis. */
const exigir = (...perfis) => (req, res, next) => {
  if (!req.usuario) return next(erro(401, 'Faça login para continuar.'));
  if (!perfis.includes(req.usuario.perfil)) return next(erro(403, 'Seu acesso não permite fazer isso.'));
  next();
};

module.exports = { abrirSessao, fecharSessao, lerSessao, exigir };
