/* ==========================================================================
   FOMITO · CONTROLE DE CAIXA
   --------------------------------------------------------------------------
   O caixa do dia:
     1. ABRIR      → com o fundo de troco que fica na gaveta
     2. ENTRADAS   → cada pagamento recebido (conta da mesa, entrega)
                     com a forma, o valor recebido e o troco devolvido
     3. SANGRIA    → dinheiro retirado da gaveta (ex.: levar ao cofre)
        SUPRIMENTO → dinheiro colocado na gaveta (ex.: mais troco)
     4. FECHAR     → conta o dinheiro da gaveta e compara com o esperado

   Dinheiro esperado na gaveta =
     fundo de troco + vendas em dinheiro − sangrias + suprimentos
   (a venda em dinheiro já é o recebido menos o troco devolvido)

   No protótipo fica no navegador (localStorage "fomito.caixa").
   No sistema real vira as tabelas "caixas" e "caixa_movimentos" no Neon.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  const CHAVE = "fomito.caixa";
  const minutos = (n) => Date.now() - n * 60000;
  const dias = (n, hora) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(hora, 0, 0, 0); return d.getTime(); };

  /* ---------- Exemplo: caixa aberto hoje e fechamentos anteriores ---------- */
  const mov = (min, dados) => ({ hora: minutos(min), ...dados });
  const EXEMPLO = {
    aberto: {
      abertoEm: minutos(230), por: "Zé Silva", fundo: 150,
      movimentos: [
        mov(220, { tipo: "comanda", ref: "Mesa 06 · comanda #2029", forma: "dinheiro", valor: 76.5, recebido: 80, troco: 3.5, por: "Carlos Mendes" }),
        mov(160, { tipo: "comanda", ref: "Mesa 08 · comanda #2030", forma: "credito", valor: 124.3, por: "Carlos Mendes" }),
        mov(140, { tipo: "entrega", ref: "Entrega #1035 · Marcos Lopes", forma: "dinheiro", valor: 62.4, recebido: 100, troco: 37.6, por: "Entregador" }),
        mov(120, { tipo: "sangria", ref: "Retirada para o cofre", forma: "dinheiro", valor: 100, por: "Zé Silva" }),
        mov(95,  { tipo: "comanda", ref: "Mesa 04 · comanda #2031", forma: "pix", valor: 98.67, por: "Carlos Mendes" }),
        mov(40,  { tipo: "entrega", ref: "Entrega #1037 · Diego Alves", forma: "debito", valor: 84, por: "Entregador" }),
      ],
    },
    fechamentos: [
      { abertoEm: dias(1, 18), fechadoEm: dias(1, 23) + 40 * 60000, por: "Zé Silva", fundo: 150, vendas: 2310.4, dinheiro: 612.3, esperado: 612.3, contado: 610.3, porForma: { dinheiro: 612.3, pix: 840.1, credito: 498, debito: 360 } },
      { abertoEm: dias(2, 18), fechadoEm: dias(2, 23) + 35 * 60000, por: "Zé Silva", fundo: 150, vendas: 2580.9, dinheiro: 701.5, esperado: 701.5, contado: 701.5, porForma: { dinheiro: 701.5, pix: 990.4, credito: 512, debito: 377 } },
      { abertoEm: dias(3, 18), fechadoEm: dias(3, 23) + 50 * 60000, por: "Zé Silva", fundo: 150, vendas: 2140.0, dinheiro: 534.0, esperado: 534.0, contado: 539.0, porForma: { dinheiro: 534, pix: 806, credito: 455, debito: 345 } },
    ],
  };

  /* ---------- Leitura e gravação ---------- */
  let memoria = null;
  const ler = () => {
    try { const v = localStorage.getItem(CHAVE); if (v) return JSON.parse(v); } catch { /* sem armazenamento */ }
    return memoria || structuredClone(EXEMPLO);
  };
  const gravar = (d) => {
    memoria = d;
    try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch { /* segue em memória */ }
  };
  const alterar = (fn) => { const d = ler(); const r = fn(d); gravar(d); return r; };

  /* ---------- Contas do caixa ---------- */
  const VENDAS = ["comanda", "entrega", "balcao"];
  const resumo = (caixa) => {
    const r = { vendas: 0, porForma: { dinheiro: 0, pix: 0, credito: 0, debito: 0 }, troco: 0, sangrias: 0, suprimentos: 0, qtdVendas: 0 };
    caixa.movimentos.forEach((m) => {
      if (VENDAS.includes(m.tipo)) {
        r.vendas += m.valor;
        r.qtdVendas++;
        r.porForma[m.forma] = (r.porForma[m.forma] || 0) + m.valor;
        r.troco += m.troco || 0;
      }
      if (m.tipo === "sangria") r.sangrias += m.valor;
      if (m.tipo === "suprimento") r.suprimentos += m.valor;
    });
    r.esperado = caixa.fundo + r.porForma.dinheiro - r.sangrias + r.suprimentos;
    return r;
  };

  /* ---------- Ações ---------- */
  const estado = () => ler();
  const aberto = () => ler().aberto;

  const abrir = ({ fundo, por }) => alterar((d) => {
    d.aberto = { abertoEm: Date.now(), por, fundo, movimentos: [] };
    return d.aberto;
  });

  /** Registra uma entrada ou saída. Retorna false se o caixa está fechado. */
  const registrar = (movimento) => alterar((d) => {
    if (!d.aberto) return false;
    d.aberto.movimentos.push({ hora: Date.now(), ...movimento });
    return true;
  });

  /** Fecha o caixa com o dinheiro contado na gaveta */
  const fechar = ({ contado, por, obs = "" }) => alterar((d) => {
    if (!d.aberto) return null;
    const r = resumo(d.aberto);
    const fechamento = { abertoEm: d.aberto.abertoEm, fechadoEm: Date.now(), por, fundo: d.aberto.fundo, vendas: r.vendas, dinheiro: r.porForma.dinheiro, esperado: r.esperado, contado, obs, porForma: r.porForma, movimentos: d.aberto.movimentos };
    d.fechamentos.unshift(fechamento);
    d.aberto = null;
    return fechamento;
  });

  const FORMAS = { dinheiro: "Dinheiro", pix: "Pix", credito: "Cartão de crédito", debito: "Cartão de débito" };

  Fomito.caixa = { estado, aberto, abrir, registrar, fechar, resumo, FORMAS, CHAVE };
})();
