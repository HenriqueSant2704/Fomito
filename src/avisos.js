// Avisos em tempo real (Server-Sent Events), igual ao BarberFlow.
// Quando algo muda (pedido novo, pronto, saiu, conta pedida...), o servidor avisa na hora
// todas as telas abertas, e elas buscam o estado novo. O aviso só diz "mudou": nenhum dado vai
// junto, então qualquer tela (até a do cliente) pode ouvir sem ver nada que não deve.
// Isso resolve a demora com o celular bloqueado ou a aba em segundo plano, quando o
// navegador segura os timers por até 1 minuto.
const ouvintes = new Set();

function assinar(req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const ping = setInterval(() => res.write(': ping\n\n'), 25000); // mantém a conexão viva
  ouvintes.add(res);
  req.on('close', () => { clearInterval(ping); ouvintes.delete(res); });
}

let agendado = null;
/** Avisa todas as telas que algo mudou (junta vários avisos seguidos num só). */
function avisarMudanca() {
  if (agendado) return;
  agendado = setTimeout(() => {
    agendado = null;
    const msg = `event: mudou\ndata: ${Date.now()}\n\n`;
    for (const res of ouvintes) res.write(msg);
  }, 60);
}

module.exports = { assinar, avisarMudanca, total: () => ouvintes.size };
