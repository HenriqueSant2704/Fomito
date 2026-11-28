// Turno da loja: de que DIA é o caixa aberto, se ele ficou de um dia anterior
// e se o expediente de hoje já acabou (para lembrar de fechar o caixa).
//
// Dia da loja: quem fecha depois da meia-noite (ex.: 18h às 2h) continua no
// mesmo dia até o MEIO do tempo em que a loja fica fechada. Ex.: abre 18h e
// fecha 23h → o dia vira às 8h30. Sem horário em Configurações → Loja, vira às 5h.
const loja = require('./loja');

const minutos = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const doisDigitos = (n) => String(n).padStart(2, '0');
const chave = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const lanchonete = () => loja.obter()?.cardapio?.lanchonete || {};

/** Hora (em minutos) em que o dia da loja vira */
function virada(l = lanchonete()) {
  const abre = minutos(l.abre);
  const fecha = minutos(l.fecha);
  if (abre == null || fecha == null || abre === fecha) return 5 * 60;
  const parado = (abre - fecha + 1440) % 1440; // quanto tempo a loja fica fechada
  return (fecha + Math.floor(parado / 2)) % 1440;
}

/** Dia da loja de um momento, como "2026-11-28" */
function diaDaLoja(ts = Date.now(), l = lanchonete()) {
  return chave(new Date(Number(ts) - virada(l) * 60000));
}

/** "2026-11-27" → "sexta, 27/11" */
function diaTexto(dia) {
  const [a, m, d] = String(dia).split('-').map(Number);
  const data = new Date(a, m - 1, d);
  return `${DIAS[data.getDay()]}, ${doisDigitos(d)}/${doisDigitos(m)}`;
}

/** Diferença em dias entre dois dias da loja ("2026-11-28" − "2026-11-27" = 1) */
function diasEntre(de, ate) {
  const t = (s) => { const [a, m, d] = s.split('-').map(Number); return Date.UTC(a, m - 1, d); };
  return Math.round((t(ate) - t(de)) / 86400000);
}

/** Quando termina o expediente do dia da loja de agora (null se não há horário) */
function fimDoExpediente(agora = Date.now(), l = lanchonete()) {
  const abre = minutos(l.abre);
  const fecha = minutos(l.fecha);
  if (abre == null || fecha == null || abre === fecha) return null;
  const [a, m, d] = diaDaLoja(agora, l).split('-').map(Number);
  const fim = new Date(a, m - 1, d, 0, fecha, 0, 0);
  if (fecha < abre) fim.setDate(fim.getDate() + 1); // fecha depois da meia-noite
  return fim.getTime();
}

/**
 * A situação do caixa para as telas e para as regras do servidor:
 *   caixa: 'fechado' | 'aberto' | 'atrasado' (aberto, mas de um dia anterior e não foi juntado com hoje)
 *   dias: os dias que o caixa aberto cobre (mais de um quando foi juntado)
 *   expedienteAcabou: o caixa é de hoje, o horário de fechar já passou e ele continua aberto
 */
function situacao(caixa, agora = Date.now()) {
  const l = lanchonete();
  const hoje = diaDaLoja(agora, l);
  const fim = fimDoExpediente(agora, l);
  const base = { hoje, hojeTexto: diaTexto(hoje), fecha: l.fecha || '', fimDoExpediente: fim };
  if (!caixa) return { ...base, caixa: 'fechado', dias: [] };
  const dias = Array.isArray(caixa.dias) && caixa.dias.length ? caixa.dias : [caixa.dia || diaDaLoja(caixa.abertoEm, l)];
  const ultimo = dias[dias.length - 1];
  const atrasado = ultimo < hoje;
  const atras = atrasado ? diasEntre(ultimo, hoje) : 0;
  return {
    ...base,
    caixa: atrasado ? 'atrasado' : 'aberto',
    dias,
    diasTexto: dias.map(diaTexto),
    dia: ultimo,
    /* "ontem" quando foi ontem mesmo; senão o dia da semana e a data */
    diaDoCaixa: atrasado ? (atras === 1 ? `ontem (${diaTexto(ultimo)})` : diaTexto(ultimo)) : 'hoje',
    expedienteAcabou: !atrasado && fim != null && agora >= fim,
  };
}

const mensagemAtrasado = (s) => `O caixa de ${s.diaDoCaixa} não foi fechado. Para aceitar pedidos hoje, feche esse caixa e abra um novo, ou junte com o de hoje (menu Caixa).`;

module.exports = { diaDaLoja, diaTexto, situacao, mensagemAtrasado, fimDoExpediente, virada };
