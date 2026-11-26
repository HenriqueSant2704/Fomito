// Prepara o banco: cria as tabelas, a configuração inicial e o login do administrador.
// Uso: npm run db:setup   (pode rodar de novo sem perder nada)
// O servidor também faz isso sozinho ao ligar, então no Render não precisa rodar nada.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

/** Cria o primeiro administrador a partir do .env (ADMIN_USER / ADMIN_PASSWORD), só se não houver nenhum. */
async function criarAdminInicial() {
  const { rows } = await db.query("SELECT count(*)::int AS n FROM usuarios WHERE perfil = 'admin'");
  if (rows[0].n) return false;
  const usuario = (process.env.ADMIN_USER || 'admin').toLowerCase();
  const senha = process.env.ADMIN_PASSWORD;
  if (!senha || senha.length < 6) {
    console.warn('\n  Ainda não há administrador. Defina ADMIN_PASSWORD (6+ caracteres) no .env ou no Render e reinicie.\n');
    return false;
  }
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error('ADMIN_USER precisa ser um login curto, sem espaços nem acentos (ex.: ze).');
  await db.query("INSERT INTO usuarios (nome, usuario, senha_hash, perfil) VALUES ($1, $2, $3, 'admin') ON CONFLICT (usuario) DO NOTHING",
    [process.env.ADMIN_NAME || 'Administrador', usuario, await bcrypt.hash(senha, 10)]);
  console.log(`✓ Administrador criado (usuário: ${usuario})`);
  return true;
}

async function main() {
  console.log('Conectando no banco...');
  await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log('✓ Tabelas prontas');
  await require('./loja').carregar();
  console.log('✓ Configurações e cardápio inicial');
  if (!(await criarAdminInicial())) console.log('• Administrador já existia (não mexi)');
  console.log('\nPronto! Agora rode: npm run dev\n');
  await db.pool.end();
}

if (require.main === module) main().catch((err) => { console.error('Erro:', err.message); process.exit(1); });

module.exports = { criarAdminInicial };
