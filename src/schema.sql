-- Fomito · tabelas do banco (Neon / PostgreSQL)
-- Pode rodar quantas vezes quiser: só cria o que ainda não existe.
-- As datas dentro dos campos "dados" (JSON) ficam em milissegundos, como as telas usam.

-- Equipe: administrador, garçom e motoboy. A senha fica criptografada (bcrypt).
CREATE TABLE IF NOT EXISTS usuarios (
  id          serial PRIMARY KEY,
  nome        text NOT NULL,
  usuario     text NOT NULL UNIQUE,
  senha_hash  text NOT NULL,
  perfil      text NOT NULL CHECK (perfil IN ('admin', 'garcom', 'motoboy')),
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- Uma linha só: configurações (marca, WhatsApp, impressão, som) e o cardápio.
-- "versao" sobe a cada mudança, para as telas baixarem de novo só quando muda.
CREATE TABLE IF NOT EXISTS loja (
  id             int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config         jsonb NOT NULL DEFAULT '{}',
  cardapio       jsonb NOT NULL DEFAULT '{}',
  versao         int NOT NULL DEFAULT 1,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

-- Fotos dos produtos, da vitrine e a logo (enviadas pelo painel).
CREATE TABLE IF NOT EXISTS imagens (
  id         serial PRIMARY KEY,
  tipo       text NOT NULL,
  dados      bytea NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

-- Cada mesa tem um código difícil de adivinhar, usado no QR Code.
CREATE TABLE IF NOT EXISTS mesas (
  numero  int PRIMARY KEY,
  codigo  text NOT NULL UNIQUE
);

-- Clientes cadastrados pelo telefone no finalizar pedido.
-- Cada endereço guarda de quais aparelhos foi cadastrado: um aparelho novo
-- não vê os endereços de outro só sabendo o número.
CREATE TABLE IF NOT EXISTS clientes (
  telefone   text PRIMARY KEY,
  nome       text NOT NULL,
  enderecos  jsonb NOT NULL DEFAULT '[]',
  criado_em  timestamptz NOT NULL DEFAULT now()
);

-- Pedidos de entrega e de balcão.
CREATE SEQUENCE IF NOT EXISTS pedidos_num START 1001;
CREATE TABLE IF NOT EXISTS pedidos (
  num            int PRIMARY KEY DEFAULT nextval('pedidos_num'),
  modo           text NOT NULL,
  status         text NOT NULL,
  telefone       text,
  dispositivo    text,
  dados          jsonb NOT NULL,
  total          numeric(10,2) NOT NULL DEFAULT 0,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedidos_criado ON pedidos (criado_em DESC);
CREATE INDEX IF NOT EXISTS pedidos_status ON pedidos (status);
CREATE INDEX IF NOT EXISTS pedidos_dispositivo ON pedidos (dispositivo);

-- Comandas das mesas. Só pode haver UMA comanda aberta por mesa.
CREATE SEQUENCE IF NOT EXISTS comandas_num START 2001;
CREATE TABLE IF NOT EXISTS comandas (
  id          serial PRIMARY KEY,
  mesa        int NOT NULL,
  aberta      boolean NOT NULL DEFAULT true,
  numero      int UNIQUE,
  dados       jsonb NOT NULL,
  total       numeric(10,2) NOT NULL DEFAULT 0,
  aberta_em   timestamptz NOT NULL DEFAULT now(),
  fechada_em  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS comandas_uma_aberta_por_mesa ON comandas (mesa) WHERE aberta;
CREATE INDEX IF NOT EXISTS comandas_fechada ON comandas (fechada_em DESC);

-- Caixa do dia. Só pode haver UM caixa aberto.
-- Os movimentos (pagamentos, tirar/colocar dinheiro e correções) ficam em dados.movimentos.
CREATE TABLE IF NOT EXISTS caixas (
  id          serial PRIMARY KEY,
  aberto      boolean NOT NULL DEFAULT true,
  dados       jsonb NOT NULL,
  aberto_em   timestamptz NOT NULL DEFAULT now(),
  fechado_em  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS caixas_um_aberto ON caixas ((true)) WHERE aberto;
