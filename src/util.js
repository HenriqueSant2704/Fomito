// Funções pequenas usadas pelo servidor inteiro.

/** Erro com status HTTP e mensagem clara para quem usa a tela. */
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const falhar = (status, mensagem) => { throw erro(status, mensagem); };

/** Arredonda para centavos. */
const arred = (v) => Math.round(Number(v) * 100) / 100;
const numero = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? arred(n) : NaN;
};

/** Celular só com números, sem o 55 do Brasil: "+55 (11) 98888-7777" → "11988887777" */
const soDigitos = (texto) => {
  let d = String(texto || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
};
const formatarTelefone = (texto) => {
  const d = soDigitos(texto);
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/** Texto curto e sem espaços sobrando (protege o banco de textos enormes). */
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);

/** Meia-noite de hoje no fuso da loja (TZ=America/Sao_Paulo). */
const inicioDoDia = (diasAtras = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d;
};

/** Identificador do aparelho do cliente (gerado no navegador e guardado nele). */
const dispositivoDe = (req) => {
  const d = String(req.get('X-Dispositivo') || '');
  return /^[A-Za-z0-9-]{8,64}$/.test(d) ? d : null;
};

/** Limite simples de tentativas por IP (protege contra pedidos de trote em massa). */
function limitador(max, janelaMs) {
  const contagem = new Map();
  setInterval(() => contagem.clear(), janelaMs).unref();
  return (chave) => {
    const n = (contagem.get(chave) || 0) + 1;
    contagem.set(chave, n);
    if (n > max) falhar(429, 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.');
  };
}

/**
 * Separa o número do fim do nome da rua (endereços antigos vinham juntos):
 * "Rua das Flores, 120" → { rua: "Rua das Flores", numero: "120" }. Sem número no fim, devolve a rua inteira.
 */
function separarNumero(rua) {
  const m = String(rua || '').trim().match(/^(.*?)[,\s]+(?:n[ºo°.]?\s*)?(\d+[A-Za-z]?(?:-\d+)?|s\/?n)\s*$/i);
  return m && m[1].trim() ? { rua: m[1].trim().replace(/,$/, ''), numero: m[2] } : { rua: String(rua || '').trim(), numero: '' };
}

module.exports = { erro, falhar, arred, numero, soDigitos, formatarTelefone, texto, inicioDoDia, dispositivoDe, limitador, separarNumero };
