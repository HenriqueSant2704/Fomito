/* ==========================================================================
   FOMITO · CADASTRO DE CLIENTES (pelo telefone)
   --------------------------------------------------------------------------
   O telefone é a "chave" do cliente:
     1. No finalizar pedido, o cliente digita o celular.
     2. Se já existe cadastro, puxamos o nome e os endereços salvos.
     3. Se não existe, ele preenche nome + endereço e o cadastro é criado.
     4. Ele pode ter vários endereços (Casa, Trabalho...) e escolhe um por pedido.

   No protótipo fica salvo no navegador (localStorage "fomito.clientes").
   No sistema real vira as tabelas "clientes" e "enderecos" no Neon.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
  const CHAVE = "fomito.clientes";

  /* ---------- Telefone ---------- */
  const soDigitos = (texto) => String(texto || "").replace(/\D/g, "").slice(0, 11);

  /** "11988887777" → "(11) 98888-7777" (vai formatando enquanto digita) */
  const formatarTelefone = (texto) => {
    const d = soDigitos(texto);
    if (d.length <= 2) return d ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  const telefoneValido = (texto) => soDigitos(texto).length >= 10;

  /* ---------- Clientes de exemplo ---------- */
  const EXEMPLO = [
    { telefone: "11988887777", nome: "Ana Souza", desde: "mar/2025", pedidos: 14, gasto: 812.4, ultimo: "Hoje",
      enderecos: [
        { id: 1, apelido: "Casa", rua: "Rua das Flores, 120", bairro: "Centro", compl: "", ref: "Portão verde" },
        { id: 2, apelido: "Trabalho", rua: "Av. Brasil, 2200", bairro: "Jardim América", compl: "Sala 4", ref: "" },
      ] },
    { telefone: "11977771234", nome: "Bruno Lima", desde: "jun/2025", pedidos: 9, gasto: 431.7, ultimo: "Hoje",
      enderecos: [{ id: 1, apelido: "Casa", rua: "Av. Paulista, 900", bairro: "Bela Vista", compl: "Ap 52", ref: "" }] },
    { telefone: "11966664321", nome: "Carla Dias", desde: "jan/2025", pedidos: 22, gasto: 1290.0, ultimo: "Hoje",
      enderecos: [{ id: 1, apelido: "Casa", rua: "Rua Bahia, 45", bairro: "Jardim", compl: "", ref: "Ao lado da padaria" }] },
    { telefone: "11955550000", nome: "Diego Alves", desde: "set/2025", pedidos: 5, gasto: 268.5, ultimo: "Hoje",
      enderecos: [{ id: 1, apelido: "Casa", rua: "Rua Goiás, 300", bairro: "Vila Nova", compl: "", ref: "" }] },
    { telefone: "11944442222", nome: "Eduarda Rocha", desde: "out/2025", pedidos: 3, gasto: 154.0, ultimo: "Ontem",
      enderecos: [{ id: 1, apelido: "Casa", rua: "Rua Pará, 77", bairro: "Centro", compl: "Casa 2", ref: "" }] },
    { telefone: "11933331111", nome: "Felipe Araújo", desde: "nov/2025", pedidos: 1, gasto: 92.0, ultimo: "Há 6 dias",
      enderecos: [{ id: 1, apelido: "Casa", rua: "Rua Ceará, 12", bairro: "Centro", compl: "", ref: "" }] },
    { telefone: "11922228888", nome: "Gabriela Nunes", desde: "fev/2025", pedidos: 31, gasto: 1874.3, ultimo: "Há 2 dias",
      enderecos: [
        { id: 1, apelido: "Casa", rua: "Rua Amazonas, 510", bairro: "Jardim", compl: "Ap 31", ref: "" },
        { id: 2, apelido: "Casa da mãe", rua: "Rua Sergipe, 88", bairro: "Vila Nova", compl: "", ref: "Casa azul" },
      ] },
  ];

  /* ---------- Leitura e gravação ---------- */
  let memoria = null;
  const lista = () => {
    try { const v = localStorage.getItem(CHAVE); if (v) return JSON.parse(v); } catch { /* sem armazenamento */ }
    return memoria || structuredClone(EXEMPLO);
  };
  const gravar = (clientes) => {
    memoria = clientes;
    try { localStorage.setItem(CHAVE, JSON.stringify(clientes)); } catch { /* segue em memória */ }
  };

  /** Procura pelo telefone. Retorna o cliente ou null. */
  const buscar = (telefone) => lista().find((c) => c.telefone === soDigitos(telefone)) || null;

  /** Cria o cadastro com o primeiro endereço */
  const cadastrar = ({ telefone, nome, endereco }) => {
    const clientes = lista();
    const novo = { telefone: soDigitos(telefone), nome: nome.trim(), desde: "Hoje", pedidos: 0, gasto: 0, ultimo: "-",
      enderecos: [{ ...endereco, id: 1 }] };
    clientes.push(novo);
    gravar(clientes);
    return novo;
  };

  /** Soma mais um endereço ao cliente e devolve o endereço criado */
  const adicionarEndereco = (telefone, endereco) => {
    const clientes = lista();
    const cliente = clientes.find((c) => c.telefone === soDigitos(telefone));
    const novo = { ...endereco, id: Math.max(0, ...cliente.enderecos.map((e) => e.id)) + 1 };
    cliente.enderecos.push(novo);
    gravar(clientes);
    return novo;
  };

  /** "Rua das Flores, 120 · Centro · Ap 3" */
  const textoEndereco = (e) => [e.rua, e.bairro, e.compl].filter(Boolean).join(" · ");

  Fomito.clientes = { lista, buscar, cadastrar, adicionarEndereco, textoEndereco, soDigitos, formatarTelefone, telefoneValido };
})();
