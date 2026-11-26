const { Pool, types } = require('pg');

// Valores em reais (numeric) voltam como número.
types.setTypeParser(1700, (v) => parseFloat(v));

if (!process.env.DATABASE_URL) {
  console.error('\n  Falta a variável DATABASE_URL no arquivo .env (veja o README).\n');
  process.exit(1);
}

// O Neon manda "sslmode=require"; deixamos explícito como conexão segura (verify-full).
const connectionString = process.env.DATABASE_URL.trim().replace(/sslmode=(prefer|require|verify-ca)\b/, 'sslmode=verify-full');

const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30000 });
pool.on('error', (err) => console.error('Erro na conexão com o banco:', err.message));

/** Roda várias consultas numa transação: ou grava tudo, ou nada. */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query: (text, params) => pool.query(text, params), tx };
