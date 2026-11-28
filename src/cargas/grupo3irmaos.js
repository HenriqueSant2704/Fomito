// Cardápio do Grupo 3 Irmãos (Jaborandi/SP), tirado das duas artes do cardápio que eles já usam.
// Entra UMA vez em cada banco (Teste e Produção), ao ligar o servidor:
//   • guarda a marca "grupo3irmaos-v1" em cardapio.cargas e não roda de novo,
//     então o que o restaurante mudar depois no painel nunca é sobrescrito;
//   • não apaga nada: os produtos e categorias que existiam antes (os de demonstração)
//     saem do cardápio e ficam guardados em cardapio.arquivados.
// Fotos: fotos reais de banco livre (Unsplash e Pexels, uso comercial liberado), em
// public/compartilhado/img/3irmaos/fotos/. Antes eram recortes da arte do cardápio (v1).
// O restaurante pode trocar qualquer foto, preço ou texto depois, no painel.

const MARCA = 'grupo3irmaos-v1';
const foto = (nome, legenda = '') => ({ src: `/compartilhado/img/3irmaos/fotos/${nome}.jpg`, legenda });

const categorias = [
  { id: 'chapa', nome: 'Lanches na Chapa', icone: 'lanches' },
  { id: 'brasa', nome: 'Lanches na Brasa', icone: 'chama' },
  { id: 'churrascos', nome: 'Churrascos', icone: 'carnes' },
  { id: 'porcoes', nome: 'Porções', icone: 'porcoes' },
  { id: 'especiais', nome: 'Porções Especiais', icone: 'estrela' },
  { id: 'combos', nome: 'Porções da Casa', icone: 'combo' },
];

/* Adicionais do cardápio: valem para lanches e churrascos (o restaurante pode mudar) */
const ADICIONAIS = [
  { id: 'ovo', nome: 'Ovo', preco: 4.5 },
  { id: 'bacon', nome: 'Bacon', preco: 5 },
  { id: 'cheddar', nome: 'Cheddar', preco: 5 },
  { id: 'catupiry', nome: 'Catupiry', preco: 5 },
  { id: 'cebola-roxa', nome: 'Cebola roxa', preco: 3 },
  { id: 'batata-palha', nome: 'Batata palha', preco: 4.5 },
  { id: 'hamburguer', nome: 'Hambúrguer', preco: 10 },
];
const adicionais = {
  chapa: ADICIONAIS, brasa: ADICIONAIS, churrascos: ADICIONAIS,
  porcoes: [], especiais: [], combos: [],
};

/* [categoria, nome, preço, ingredientes (como no cardápio), fotos, destaque] */
const BURGUER1 = ['Pão especial', 'hambúrguer caseiro', 'bacon', 'maionese caseira', 'alface americana', 'queijo (mussarela ou cheddar)'];
const BURGUER3 = ['Pão especial', '2 hambúrgueres caseiros', 'bacon', 'maionese caseira', 'batata palha', 'alface americana', 'tomate', 'cebola roxa', 'mussarela', 'cheddar', 'catupiry'];
const BURGUER4 = ['Pão especial', '3 hambúrgueres caseiros', 'bacon', 'maionese caseira', 'batata palha', 'alface americana', 'tomate', 'cebola roxa', 'mussarela', 'cheddar'];

const itens = [
  /* Lanches na Chapa */
  ['chapa', 'Chapa Burguer #1 by Tchefy', 20, BURGUER1, ['chapa1']],
  ['chapa', 'Chapa Burguer #2 by Diego', 23, ['Pão especial', 'hambúrguer caseiro', 'bacon', 'maionese caseira', 'alface americana', 'mussarela caseira', 'mussarela', 'cheddar', 'catupiry'], ['chapa2']],
  ['chapa', 'Chapa Burguer #3 by China', 32, BURGUER3, ['chapa3'], true],
  ['chapa', 'Chapa Burguer #4 by China Triplo', 45, BURGUER4, ['chapa4']],
  ['chapa', 'Burguer La Moda Chapeiro', 30, ['Hambúrguer recheado com queijo', 'tomate', 'rúcula', 'cebola roxa', 'queijo', 'cheddar', 'maionese caseira'], ['chapa-moda']],
  /* Lanches na Brasa */
  ['brasa', 'Brasa Burguer #1 by Tchefy', 20, BURGUER1, ['brasa1']],
  ['brasa', 'Brasa Burguer #2 by Diego', 23, BURGUER1, ['brasa2']],
  ['brasa', 'Brasa Burguer #3 by China', 32, BURGUER3, ['brasa3'], true],
  ['brasa', 'Brasa Burguer #4 by China Triplo', 45, BURGUER4, ['brasa4']],
  ['brasa', 'Burguer La Moda Churrasqueiro', 30, ['Pão especial', '2 hambúrgueres caseiros', 'bacon', 'rúcula', 'cebola roxa', 'queijo', 'cheddar', 'maionese caseira'], ['brasa-moda']],
  /* Churrascos */
  ['churrascos', 'Churrasco Chapa', 28, ['Pão', 'carne', 'filé', 'cheddar', 'batata palha', 'vinagrete'], ['churrasco-chapa']],
  ['churrascos', 'Churrasco ao Queijo', 25, ['Pão', 'carne', 'filé', 'mussarela', 'batata palha', 'vinagrete'], ['churrasco-queijo']],
  ['churrascos', 'X Toscana', 25, ['Pão', 'linguiça Toscana', 'queijo', 'mussarela', 'batata palha', 'vinagrete'], ['x-toscana']],
  /* Porções */
  ['porcoes', 'Porção de Batata Simples', 35, ['Batata frita'], ['batata']],
  ['porcoes', 'Porção de Anel de Cebola', 35, ['Anel de cebola'], ['anel-cebola']],
  ['porcoes', 'Porção de Nugget Frito', 45, ['Nugget frito'], ['nugget']],
  ['porcoes', 'Porção de Nugget Frito c/ Batata Completa', 55, ['Nugget frito', 'Batata completa'], ['nugget-batata']],
  ['porcoes', 'Porção de Batata Completa, Requeijão, Cheddar e Bacon', 45, ['Batata frita', 'Requeijão', 'Cheddar', 'Bacon'], ['batata-completa']],
  ['porcoes', 'Porção de Mandioca Frita', 30, ['Mandioca frita'], ['mandioca']],
  ['porcoes', '1 kg de Frango à Passarinho', 45, ['Frango à passarinho'], ['frango']],
  ['porcoes', 'Porção de Frango à Passarinho c/ Mandioca Frita', 57, ['Frango à passarinho', 'Mandioca frita'], ['frango-mandioca']],
  ['porcoes', 'Porção de Frango à Passarinho c/ Batata Frita Completa', 60, ['Frango à passarinho', 'Batata frita completa'], ['frango-batata-completa']],
  /* Porções Especiais */
  ['especiais', 'Porção de Frango à Passarinho c/ Batata Simples', 55, ['Frango à passarinho', 'Batata simples'], ['frango-batata']],
  ['especiais', 'Porção de Torresmo de Rolo c/ Mandioca Frita ou Cozida', 62, ['Torresmo de rolo', 'Mandioca frita ou cozida'], ['torresmo']],
  ['especiais', 'Porção de Calabresa c/ Azeitona e Requeijão', 50, ['Calabresa', 'Azeitona', 'Requeijão'], ['calabresa']],
  ['especiais', 'Porção de Filé de Tilápia', 60, ['Filé de tilápia'], ['tilapia']],
  ['especiais', 'Porção de Carne Bovina', 70, ['Carne bovina'], ['carne']],
  ['especiais', 'Porção de Frios', 45, ['Presunto', 'Mussarela', 'Azeitona verde', 'Salsicha hot dog', 'Cenoura palito', 'Tomate'], ['frios'], true],
  /* Porções da casa (as maiores, para dividir) */
  ['combos', 'Caixa 3 Irmãos', 80, ['1 kg de Frango', '1 kg de Batata Completa', '500 g de Mandioca Frita'], ['caixa'], true],
  ['combos', 'Porção Casal dos 3 Irmãos', 63, ['Frango à Passarinho', 'Calabresa Frita', 'Batata Completa'], ['casal']],
  ['combos', 'Porção Resenha 3 Irmãos', 92, ['Torresmo de Rolo', 'Frango à Passarinho', 'Mandioca Frita ou Batata Frita'], ['resenha']],
  ['combos', 'Porção Familiar 3 Irmãos', 130, ['1 kg de Frango à Passarinho', '500 g de Mandioca Frita', '1 kg de Batata Frita Completa', '500 g de Carne Bovina', 'Molho Branco Caseiro', 'Molho Vermelho Caseiro'], ['familiar'], true],
  ['combos', 'Porção Moda da Casa 3 Irmãos', 150, ['1 kg de Frango à Passarinho', '500 g de Mandioca Frita', '500 g de Carne Bovina', '1 kg de Batata Completa', '300 g de Calabresa Frita', '300 g de Anel de Cebola Frito', 'Molho Branco Caseiro', 'Molho Vermelho Caseiro'], ['moda-casa']],
];

/* "Pão especial, hambúrguer caseiro, bacon." (a linha do cardápio) */
const frase = (lista) => {
  const t = lista.join(', ');
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
};

/* A vitrine é montada pela v2 (abaixo), já com os banners ligados aos produtos */
const vitrine = [];

/** Monta o cardápio novo a partir do atual. Devolve null se já foi aplicado. */
function montar(atual, config) {
  if ((atual.cargas || []).includes(MARCA)) return null;
  const usados = [...(atual.produtos || []), ...((atual.arquivados || {}).produtos || [])].map((p) => Number(p.id) || 0);
  let id = Math.max(3000, ...usados);
  const produtos = itens.map(([cat, nome, preco, ingredientes, fotos, destaque]) => ({
    id: ++id, cat, nome, preco, destaque: !!destaque, esgotado: false,
    desc: frase(ingredientes),
    ingredientes: ingredientes.map((i) => i.charAt(0).toUpperCase() + i.slice(1)),
    fotos: fotos.map((f) => foto(f)),
    adicionaisFora: [],
  }));
  const arquivados = atual.arquivados || {};
  const l = atual.lanchonete || {};
  const cardapio = {
    ...atual,
    categorias, adicionais, produtos,
    arquivados: {
      ...arquivados,
      produtos: [...(arquivados.produtos || []), ...(atual.produtos || [])],
      categorias: [...(arquivados.categorias || []), ...(atual.categorias || [])],
      adicionais: { ...(arquivados.adicionais || {}), ...(atual.adicionais || {}) },
      vitrine: [...(arquivados.vitrine || []), ...(l.vitrine || [])],
    },
    lanchonete: {
      ...l,
      telefone: l.telefone || '(17) 99232-7332',
      cidade: l.cidade || 'Jaborandi/SP',
      /* Endereço de demonstração some; o restaurante completa rua e número no painel */
      endereco: !l.endereco || l.endereco === 'Av. Brasil, 1500, Centro' ? 'Jaborandi/SP' : l.endereco,
      vitrine,
    },
    cargas: [...(atual.cargas || []), MARCA],
  };
  /* Nome e frase da marca: só troca se ainda estiver o padrão do Fomito */
  const novaConfig = structuredClone(config);
  if (!novaConfig.marca.nome || novaConfig.marca.nome === 'Fomito') novaConfig.marca.nome = 'Grupo 3 Irmãos';
  if (!novaConfig.marca.slogan || novaConfig.marca.slogan === 'Lanches na chapa desde 2012') novaConfig.marca.slogan = 'O sabor da brasa, do jeito que você gosta!';
  cardapio.lanchonete.nome = novaConfig.marca.nome;
  cardapio.lanchonete.slogan = novaConfig.marca.slogan;
  return { cardapio, config: novaConfig };
}


/* ---------- v2 (28/11): fotos reais, promoção e vitrine ligada aos produtos ----------
   Roda uma vez por banco, depois da v1. Só troca as fotos que ainda são os recortes da
   arte (pasta antiga); se o restaurante já trocou a foto de um produto, fica a dele. */
const MARCA_V2 = 'grupo3irmaos-v2-fotos';
const PASTA_ANTIGA = /^\/compartilhado\/img\/3irmaos\/(?!fotos\/)/;
const PROMO = 'Hambúrguer Caseiro';

function montarV2(atual) {
  if ((atual.cargas || []).includes(MARCA_V2)) return null;
  const fotosDe = Object.fromEntries(itens.map(([, nome, , , fotos]) => [nome, fotos]));
  let produtos = (atual.produtos || []).map((p) => {
    const recorte = (p.fotos || []).some((f) => PASTA_ANTIGA.test(f.src || ''));
    return recorte && fotosDe[p.nome] ? { ...p, fotos: fotosDe[p.nome].map((f) => foto(f)) } : p;
  });

  /* Promoção: categoria própria no topo do cardápio */
  let categoriasNovas = atual.categorias || [];
  if (!categoriasNovas.some((c) => c.id === 'promocoes')) categoriasNovas = [{ id: 'promocoes', nome: 'Promoções', icone: 'estrela' }, ...categoriasNovas];
  const adicionaisNovos = { ...(atual.adicionais || {}) };
  if (!adicionaisNovos.promocoes) adicionaisNovos.promocoes = ADICIONAIS;
  let promo = produtos.find((p) => p.nome === PROMO);
  if (!promo) {
    const usados = [...produtos, ...((atual.arquivados || {}).produtos || [])].map((p) => Number(p.id) || 0);
    const ingredientes = ['Pão fofinho', 'Hambúrguer caseiro 100 g', 'Alface crocante', 'Maionese caseira'];
    promo = {
      id: Math.max(3000, ...usados) + 1, cat: 'promocoes', nome: PROMO, preco: 14.99, destaque: true, esgotado: false,
      desc: 'Promoção da casa: pão fofinho, hambúrguer caseiro de 100 g, alface crocante e maionese caseira.',
      ingredientes, fotos: [foto('promo')], adicionaisFora: [],
    };
    produtos = [promo, ...produtos];
  }

  /* Vitrine: banners que levam direto ao produto; os que o restaurante criou continuam */
  const id = (nome) => produtos.find((p) => p.nome === nome)?.id || null;
  const banners = [
    { ...foto('promo'), selo: 'Promoção · R$ 14,99', titulo: 'Hambúrguer Caseiro', texto: 'Pão fofinho, hambúrguer de 100 g, alface crocante e maionese caseira', produto: promo.id },
    { ...foto('caixa'), titulo: 'Caixa 3 Irmãos', texto: '1 kg de frango, 1 kg de batata completa e 500 g de mandioca por R$ 80,00', produto: id('Caixa 3 Irmãos') },
    { ...foto('brasa3'), titulo: 'O sabor da brasa', texto: 'Lanches na brasa do jeito que você gosta', produto: id('Brasa Burguer #3 by China') },
    { ...foto('familiar'), titulo: 'Porção Familiar 3 Irmãos', texto: 'Para dividir com a família toda', produto: id('Porção Familiar 3 Irmãos') },
  ];
  const l = atual.lanchonete || {};
  const doRestaurante = (l.vitrine || []).filter((v) => !PASTA_ANTIGA.test(v.src || ''));
  return {
    cardapio: {
      ...atual, produtos, categorias: categoriasNovas, adicionais: adicionaisNovos,
      lanchonete: { ...l, vitrine: [...banners, ...doRestaurante] },
      cargas: [...(atual.cargas || []), MARCA_V2],
    },
  };
}


/* Recortes da arte que ficaram para trás (ex.: produto renomeado no painel antes da v2):
   acha o produto da v1 mais parecido na mesma categoria e põe a foto nova. Se não achar,
   tira a foto quebrada e o produto mostra a foto provisória. Roda a cada vez que o servidor
   liga, mas só grava quando ainda existe algum recorte antigo. */
function corrigirRecortes(atual) {
  const antigo = (f) => PASTA_ANTIGA.test(f?.src || '');
  if (!(atual.produtos || []).some((p) => (p.fotos || []).some(antigo))) return null;
  const simples = (t) => String(t).toLowerCase().normalize('NFD').replace(/[^a-z0-9#]/g, '');
  const parecido = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; };
  const produtos = atual.produtos.map((p) => {
    if (!(p.fotos || []).some(antigo)) return p;
    const nome = simples(p.nome);
    const melhor = itens.filter(([cat]) => cat === p.cat)
      .map(([, n, , , fotos]) => ({ fotos, nota: parecido(simples(n), nome) }))
      .sort((a, b) => b.nota - a.nota)[0];
    const novas = melhor && melhor.nota >= 8 ? melhor.fotos.map((f) => foto(f)) : [];
    return { ...p, fotos: [...novas, ...p.fotos.filter((f) => !antigo(f))] };
  });
  return { cardapio: { ...atual, produtos } };
}

module.exports = { MARCA, MARCA_V2, montar, montarV2, corrigirRecortes, itens, categorias, adicionais };
