/* ==========================================================================
   FOMITO · CADASTRO DE CLIENTES (pelo telefone)
   --------------------------------------------------------------------------
   O telefone é a "chave" do cliente:
     1. No finalizar pedido, o cliente digita o celular.
     2. Se este aparelho já pediu com esse número, puxamos o nome e os
        endereços salvos.
     3. Se não, ele preenche nome + endereço e o cadastro é criado (ou o
        endereço é somado ao cadastro que já existe).
     4. Ele pode ter vários endereços (Casa, Trabalho...) e escolhe um por pedido.

   Segurança: um aparelho novo NÃO vê os endereços de outro só sabendo o
   número. O próximo passo é confirmar o telefone por código no WhatsApp.
   Os clientes ficam no banco (tabela "clientes"). O painel vê todos.
   ========================================================================== */

window.Fomito = window.Fomito || {};

(() => {
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

  /* ---------- Consultas ---------- */
  /** Lista completa (só o painel recebe) */
  const lista = () => Fomito.estado.clientes || [];

  /** Procura na lista do painel. Retorna o cliente ou null. */
  const buscar = (telefone) => lista().find((c) => c.telefone === soDigitos(telefone)) || null;

  /** Procura no servidor (cardápio do cliente e lançar pedido). Retorna o cliente ou null. */
  const buscarRemoto = async (telefone) => (await Fomito.api("POST", "/clientes/buscar", { telefone })).cliente;

  /** Cria o cadastro com o primeiro endereço (ou soma o endereço ao cadastro existente) */
  const cadastrar = ({ telefone, nome, endereco }) => Fomito.acao("POST", "/clientes", { telefone, nome, endereco });

  /** Soma mais um endereço ao cliente. Retorna o cliente atualizado, com enderecoId do novo. */
  const adicionarEndereco = (telefone, endereco) => Fomito.acao("POST", "/clientes", { telefone, endereco });

  /** "Rua das Flores, 120 · Centro · Ap 3" */
  const textoEndereco = (e) => [e.rua, e.bairro, e.compl].filter(Boolean).join(" · ");

  Fomito.clientes = { lista, buscar, buscarRemoto, cadastrar, adicionarEndereco, textoEndereco, soDigitos, formatarTelefone, telefoneValido };
})();
