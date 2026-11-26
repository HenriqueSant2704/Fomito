# Fomito

**Seu negócio sempre no controle.**

Sistema para lanchonetes: cardápio online com pedidos para entrega, comanda da mesa pelo QR Code,
telas do garçom e do motoboy, controle de caixa e painel de gestão. Cada restaurante coloca a própria marca.

Stack: HTML, CSS e JavaScript puros no navegador · Node.js + Express no servidor · banco Neon (PostgreSQL) · hospedagem no Render.

## Telas

| Endereço | Quem usa |
|---|---|
| `/` (cardápio) | Cliente: pede para entrega ou, pelo QR Code da mesa, abre a comanda |
| `/portal/` | Equipe entra com usuário e senha. O link fica discreto no rodapé do cardápio |
| `/painel/` | Só o **administrador**: pedidos, comandas, caixa, cardápio, clientes, equipe e configurações |
| `/garcom/` | **Garçom** (e o administrador): mesas, servir o que ficou pronto, lançar itens e fechar a conta |
| `/motoboy/` | **Motoboy** (e o administrador): prontos por bairro, sair, receber e finalizar |

O primeiro administrador nasce do `.env` (`ADMIN_USER` / `ADMIN_PASSWORD`). Ele cria os garçons e motoboys em **Painel → Equipe**.

## Rodar no computador

1. Crie um banco no [Neon](https://neon.tech) para o Fomito e copie a *connection string*.
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL`, `JWT_SECRET` e `ADMIN_PASSWORD`.
3. Instale e ligue:

```
npm install
npm run dev
```

Abra http://localhost:3000. As tabelas são criadas sozinhas quando o servidor liga (pode rodar `npm run db:setup` se quiser fazer antes).

## Colocar no ar (Render)

1. No Render: **New → Blueprint** e escolha o repositório `HenriqueSant2704/Fomito` (ele lê o `render.yaml`).
2. Quando pedir, cole a `DATABASE_URL` do Neon e escolha a `ADMIN_PASSWORD`. O `JWT_SECRET` é gerado sozinho.
3. Cada push na `main` publica de novo (auto-deploy). Ao ligar, o servidor ajusta as tabelas do Neon sozinho.

No plano grátis o Render "dorme" depois de um tempo sem acesso e demora uns segundos para acordar.

## Como funciona por dentro

```
src/
├── server.js     ← liga o Express, as telas (public/) e a API (/api)
├── rotas.js      ← todas as rotas e quem pode usar cada uma
├── estado.js     ← GET /api/estado: o que cada tela recebe (cliente, garçom, motoboy, admin)
├── servicos.js   ← pedidos, comandas, caixa e clientes (sempre em transação)
├── regras.js     ← preço dos itens e contas do caixa (o navegador nunca decide preço)
├── loja.js       ← marca, cardápio, fotos e códigos das mesas
├── whatsapp.js   ← mensagens automáticas pela Evolution API
├── auth.js       ← login com cookie protegido (JWT) e perfis
├── schema.sql    ← tabelas do banco
└── padrao/       ← cardápio e configurações iniciais
public/
├── compartilhado/js/api.js   ← baixa o estado, carrega a tela e atualiza a cada 3 s
├── compartilhado/js/*.js     ← pedidos, comandas, caixa, clientes, config (leem Fomito.estado)
└── cliente/ portal/ painel/ garcom/ motoboy/
```

- **Tempo real:** cada tela pede `GET /api/estado` a cada 3 segundos. O cliente pede no celular e o painel, o garçom e o motoboy veem na hora, com som e aviso.
- **Ações:** tudo que muda dados passa pelo servidor (`Fomito.acao`). Enquanto espera, os botões ficam travados para não sair pedido em dobro. Se der erro, a mensagem aparece na tela.
- **Preços:** o servidor calcula o total com o cardápio dele e guarda o preço de cada item no pedido. Mudar o preço depois não altera pedido antigo.
- **Caixa:** pagamento de mesa (garçom) e de entrega (motoboy) só entra com o caixa aberto. No dinheiro, o valor recebido é obrigatório e o troco é calculado no servidor. Correções nunca apagam o original.
- **Fotos e logo:** o painel diminui a imagem antes de enviar; o servidor guarda no banco e serve em `/img/123`.

## Segurança

- Senhas com bcrypt; sessão num cookie `httpOnly` que o navegador não lê.
- Cada perfil só recebe o que precisa: o cliente não vê caixa nem clientes; garçom e motoboy não veem a chave do WhatsApp.
- **QR Code da mesa** leva um código aleatório (`/?m=7f3k2a`): ninguém pede em nome de outra mesa digitando o número.
- **Cadastro pelo telefone:** um aparelho novo não vê os endereços de outra pessoa só sabendo o número.
- Limite de tentativas de login e de pedidos por conexão.

## WhatsApp (Evolution API)

Em **Painel → Configurações → WhatsApp**: URL da API, chave e nome da instância. Salve, toque em **Conectar e gerar QR Code** e leia com o WhatsApp da loja.
O servidor envia: pedido recebido, em preparo (ao aceitar), saiu para entrega e entregue. Se o WhatsApp falhar, o pedido segue normal.

## Impressora térmica (POS-80)

O servidor no Render não enxerga a impressora do balcão: o cupom sai do navegador do computador da loja.
Instale a POS-80 como impressora padrão e abra o Chrome com `--kiosk-printing` para imprimir direto, sem a janela.

## Próximos passos

- Web Push com Service Worker (avisar garçom e motoboy com o celular bloqueado).
- Confirmar o telefone do cliente por código no WhatsApp.
- Pagamento do pedido de balcão entrando no caixa.

O desenho e as regras aprovados nos protótipos (rodadas v1 a v8) estão em [`docs/prototipo.md`](docs/prototipo.md).
