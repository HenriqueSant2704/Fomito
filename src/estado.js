// GET /api/estado: tudo que a tela precisa, de acordo com quem está usando.
// As telas pedem de novo a cada 3 segundos (o "tempo real" do sistema).
//   • cliente (sem login): o cardápio, os próprios pedidos e a comanda da mesa
//   • garçom: as comandas e se o caixa está aberto
//   • motoboy: os pedidos de entrega e se o caixa está aberto
//   • administrador: tudo, mais clientes, equipe, caixa completo e o resumo do dia
const db = require('./db');
const loja = require('./loja');
const { pedidoDaLinha, comandaDaLinha } = require('./servicos');
const { inicioDoDia, dispositivoDe, arred, separarNumero } = require('./util');

const PEDIDOS_DO_DIA = `status <> 'cancelado' AND (criado_em >= $1 OR status <> 'concluido')`;

async function caixaResumido() {
  const { rows } = await db.query('SELECT dados FROM caixas WHERE aberto');
  return { aberto: rows[0] ? { abertoEm: rows[0].dados.abertoEm, fundo: 0, movimentos: [] } : null, fechamentos: [] };
}

async function comandasDoDia() {
  const { rows: abertas } = await db.query('SELECT * FROM comandas WHERE aberta ORDER BY mesa');
  const { rows: fechadas } = await db.query('SELECT * FROM comandas WHERE NOT aberta AND fechada_em >= $1 ORDER BY fechada_em DESC', [inicioDoDia()]);
  return { abertas: abertas.map(comandaDaLinha), fechadas: fechadas.map(comandaDaLinha) };
}

const desde = (data) => data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace(/\.| de /g, (m) => (m === '.' ? '' : '/'));
function quando(ms) {
  if (!ms) return '-';
  const dias = Math.floor((inicioDoDia().getTime() - new Date(ms).setHours(0, 0, 0, 0)) / 86400000);
  return dias <= 0 ? 'Hoje' : dias === 1 ? 'Ontem' : `Há ${dias} dias`;
}

/** Clientes com quantos pedidos fizeram, quanto gastaram e quando foi o último. */
async function clientesComResumo() {
  const { rows } = await db.query(`
    SELECT c.telefone, c.nome, c.enderecos, c.criado_em,
           count(p.num)::int AS pedidos, coalesce(sum(p.total), 0) AS gasto, max(p.criado_em) AS ultimo
      FROM clientes c
      LEFT JOIN pedidos p ON p.telefone = c.telefone AND p.status <> 'cancelado'
     GROUP BY c.telefone ORDER BY max(p.criado_em) DESC NULLS LAST, c.nome LIMIT 3000`);
  return rows.map((r) => ({
    telefone: r.telefone, nome: r.nome, desde: desde(r.criado_em), pedidos: r.pedidos, gasto: Number(r.gasto),
    ultimo: quando(r.ultimo), enderecos: r.enderecos.map(({ dispositivos, ...e }) => (e.numero ? e : { ...e, ...separarNumero(e.rua) })),
  }));
}

/** Números da Visão geral: hoje, ontem, últimos 7 dias, categorias e mais vendidos. */
async function relatorio(cardapio) {
  const inicio = inicioDoDia(7);
  const { rows: pedidos } = await db.query(`SELECT dados, total, status, modo, criado_em FROM pedidos WHERE status <> 'cancelado' AND criado_em >= $1`, [inicio]);
  const { rows: comandas } = await db.query('SELECT dados, total, aberta, aberta_em, fechada_em FROM comandas WHERE aberta_em >= $1 OR aberta', [inicio]);
  const dia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const hoje = inicioDoDia().getTime();
  const ontem = inicioDoDia(1).getTime();

  const vendas = []; // { dia, valor, canal, itens: [{id, qtd, valor}] }
  for (const p of pedidos) {
    vendas.push({ dia: dia(p.criado_em), valor: Number(p.total), canal: p.modo === 'entrega' ? 'entrega' : 'local', concluido: p.status === 'concluido',
      preparo: p.dados.prontoEm ? (p.dados.prontoEm - p.dados.criadoEm) / 60000 : null,
      itens: p.dados.itens.map(([id, qtd, , , preco]) => ({ id, qtd, valor: (preco || 0) * qtd })) });
  }
  for (const c of comandas) {
    vendas.push({ dia: dia(c.aberta_em), valor: Number(c.total), canal: 'local', concluido: !c.aberta,
      preparo: null, itens: c.dados.rodadas.flatMap((r) => r.itens.map((i) => ({ id: i.id, qtd: i.qtd, valor: i.preco * i.qtd }))) });
    c.dados.rodadas.forEach((r) => { if (r.prontoEm) vendas.push({ dia: dia(r.hora), valor: 0, canal: null, concluido: false, preparo: (r.prontoEm - r.hora) / 60000, itens: [], soPreparo: true }); });
  }

  const doDia = (d) => vendas.filter((v) => v.dia === d && !v.soPreparo);
  const numeros = (d) => {
    const lista = doDia(d);
    const faturamento = arred(lista.reduce((s, v) => s + v.valor, 0));
    const tempos = vendas.filter((v) => v.dia === d && v.preparo != null && v.preparo >= 0).map((v) => v.preparo);
    return {
      pedidos: lista.length, faturamento,
      ticket: lista.length ? arred(faturamento / lista.length) : 0,
      preparo: tempos.length ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : null,
    };
  };

  const semana = [];
  for (let i = 6; i >= 0; i--) {
    const d = inicioDoDia(i);
    semana.push({ dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').replace(/^./, (l) => l.toUpperCase()), valor: arred(doDia(d.getTime()).reduce((s, v) => s + v.valor, 0)) });
  }

  const itensHoje = doDia(hoje).flatMap((v) => v.itens);
  const porCategoria = {};
  const porProduto = {};
  for (const i of itensHoje) {
    const cat = cardapio.produtos.find((p) => p.id === i.id)?.cat || 'outros';
    porCategoria[cat] = (porCategoria[cat] || 0) + i.valor;
    porProduto[i.id] = (porProduto[i.id] || 0) + i.qtd;
  }
  const totalCat = Object.values(porCategoria).reduce((s, v) => s + v, 0);
  const categorias = cardapio.categorias.map((c) => [c.nome, totalCat ? Math.round((porCategoria[c.id] || 0) * 100 / totalCat) : 0]);
  const canais = doDia(hoje).reduce((s, v) => { s[v.canal] += v.valor; return s; }, { entrega: 0, local: 0 });
  const somaCanais = canais.entrega + canais.local;

  return {
    hoje: numeros(hoje), ontem: numeros(ontem), semana, categorias,
    entrega: somaCanais ? Math.round(canais.entrega * 100 / somaCanais) : 0,
    local: somaCanais ? Math.round(canais.local * 100 / somaCanais) : 0,
    maisVendidos: Object.entries(porProduto).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, qtd]) => [Number(id), qtd]),
  };
}

async function estado(req, res) {
  const u = req.usuario;
  const atual = loja.obter();
  const r = { sessao: u ? { nome: u.nome, usuario: u.usuario, perfil: u.perfil } : null, versao: atual.versao, agora: Date.now() };

  if (String(req.query.v) !== String(atual.versao)) {
    r.config = u?.perfil === 'admin' ? atual.config : loja.configPublica(atual.config);
    r.cardapio = atual.cardapio;
  }

  const hoje = inicioDoDia();
  // Mesa do QR Code (?m=código). Vale também para a equipe testar o cardápio como cliente.
  const mesaQR = await loja.mesaDoCodigo(String(req.query.m || ''));
  r.mesaQR = mesaQR;
  if (!u) {
    // Cliente: os pedidos deste aparelho e a comanda da mesa do QR Code
    const disp = dispositivoDe(req);
    r.pedidos = [];
    r.comandas = { abertas: [], fechadas: [] };
    if (disp) {
      const { rows } = await db.query(`SELECT * FROM pedidos WHERE dispositivo = $1 AND criado_em > now() - interval '90 days' ORDER BY criado_em DESC LIMIT 30`, [disp]);
      r.pedidos = rows.map(pedidoDaLinha);
    }
    const { rows: abertas } = await db.query(`SELECT * FROM comandas WHERE aberta AND ((dados->'dispositivos') ? $1 OR mesa = $2)`, [disp || '-', mesaQR || 0]);
    const { rows: fechadas } = disp
      ? await db.query(`SELECT * FROM comandas WHERE NOT aberta AND (dados->'dispositivos') ? $1 AND fechada_em > now() - interval '90 days' ORDER BY fechada_em DESC LIMIT 20`, [disp])
      : { rows: [] };
    r.comandas = { abertas: abertas.map(comandaDaLinha), fechadas: fechadas.map(comandaDaLinha) };
    return res.json(r);
  }

  if (u.perfil === 'garcom') {
    r.comandas = await comandasDoDia();
    r.caixa = await caixaResumido();
    return res.json(r);
  }

  if (u.perfil === 'motoboy') {
    const { rows } = await db.query(`SELECT * FROM pedidos WHERE modo = 'entrega' AND ${PEDIDOS_DO_DIA} ORDER BY criado_em DESC LIMIT 300`, [hoje]);
    r.pedidos = rows.map(pedidoDaLinha);
    r.caixa = await caixaResumido();
    return res.json(r);
  }

  // Administrador: tudo. Atendente: o mesmo, menos a Visão geral (faturamento).
  const { rows: pedidos } = await db.query(`SELECT * FROM pedidos WHERE ${PEDIDOS_DO_DIA} ORDER BY criado_em DESC LIMIT 400`, [hoje]);
  r.pedidos = pedidos.map(pedidoDaLinha);
  r.comandas = await comandasDoDia();
  const { rows: aberto } = await db.query('SELECT dados FROM caixas WHERE aberto');
  const { rows: fechados } = await db.query('SELECT dados FROM caixas WHERE NOT aberto ORDER BY fechado_em DESC LIMIT 30');
  r.caixa = { aberto: aberto[0]?.dados || null, fechamentos: fechados.map((x) => x.dados) };
  r.clientes = await clientesComResumo();
  const { rows: usuarios } = await db.query("SELECT nome, usuario, perfil FROM usuarios ORDER BY perfil = 'admin' DESC, nome");
  r.usuarios = usuarios;
  r.mesas = await loja.mesas();
  if (u.perfil === 'admin') r.relatorio = await relatorio(atual.cardapio);
  res.json(r);
}

module.exports = { estado };
