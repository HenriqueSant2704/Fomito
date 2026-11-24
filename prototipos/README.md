# Fomito · Protótipos

Protótipo navegável para alinhar **design e funcionamento** antes do desenvolvimento.
Feito em HTML, CSS e JavaScript puros, sem instalar nada.

## Como abrir

Dê dois cliques em `prototipos/index.html`. O sistema é um só e começa pelo **cardápio do cliente**.

| Tela | Arquivo | Quem usa |
|---|---|---|
| Cardápio (tela inicial) | `cliente/index.html` | Cliente pede para entrega ou para comer no local |
| Portal (login) | `portal/index.html` | Equipe. O link fica discreto no rodapé do cardápio |
| Painel | `painel/index.html` | Só **administrador**: pedidos, comandas, cardápio, equipe e configurações |
| Comandas | `garcom/index.html` | **Garçom** (e o administrador): mesas, lançar itens, fechar conta |

Acessos de teste: `admin` / `1234` (painel) e `carlos` / `1234` (garçom).
No painel, em **Equipe**, o administrador cria novos garçons. Quem entra como garçom vai direto para as comandas e não consegue abrir o painel.

> Os dados são fictícios (`compartilhado/js/dados.js`). Usuários criados ficam salvos só no navegador.
> As "fotos" dos produtos são ilustrações em SVG (`compartilhado/js/ilustracoes.js`). No sistema real, o dono envia as fotos pelo painel.

## Organização das pastas

```
prototipos/
├── index.html                 ← abre o cardápio do cliente
├── compartilhado/             ← tudo que as telas usam
│   ├── css/
│   │   ├── tokens.css         ← CORES, FONTES, RAIOS, SOMBRAS (identidade da marca)
│   │   └── base.css           ← botões, cartões, campos, etiquetas, modais...
│   ├── js/
│   │   ├── icones.js          ← ícones de linha (SVG)
│   │   ├── config.js          ← MARCA DO RESTAURANTE (nome, logo, cores, fontes) + WhatsApp, impressora e som
│   │   ├── alertas.js         ← som de pedido novo, cupom de 80mm e mensagens de WhatsApp
│   │   ├── clientes.js        ← cadastro de clientes pelo telefone, com vários endereços
│   │   ├── ilustracoes.js     ← "fotos" ilustradas dos produtos e da vitrine
│   │   ├── sessao.js          ← login, perfis (admin/garçom) e proteção das telas
│   │   ├── dados.js           ← cardápio, fotos, adicionais e dados de exemplo
│   │   └── utils.js           ← funções pequenas (moeda, toast, logo...)
│   └── img/simbolo.svg        ← símbolo "F" da marca
├── cliente/   (index.html · cliente.css · cliente.js)
├── portal/    (index.html · portal.css · portal.js)
├── garcom/    (index.html · garcom.css · garcom.js)
└── painel/    (index.html · painel.css · painel.js)
    ├── cardapio.js            ← produtos (cadastro com fotos), categorias, adicionais e vitrine
    ├── clientes.js            ← lista de clientes e ficha com endereços
    └── pedido.js              ← detalhe do pedido e "Lançar pedido" (telefone, balcão, mesa)
```

Cada tela tem **3 arquivos com o mesmo nome da pasta**: o HTML (estrutura), o CSS (visual) e o JS (comportamento).
Os arquivos JS são divididos em seções numeradas no topo, para achar rápido o que mudar.

## Finalizar pedido e cadastro do cliente

A escolha **Entrega** ou **Comer no local** fica no finalizar pedido (sacola → Continuar), não mais na tela inicial.

Na entrega, o cliente se identifica pelo **celular**:
1. Digita o telefone. Se já pediu antes, aparecem o nome e os **endereços salvos** para escolher.
2. Se é a primeira vez, preenche nome e endereço e o **cadastro** é salvo.
3. Pode **adicionar um novo endereço** (Casa, Trabalho, Outro) a qualquer momento e escolher em qual receber.

Teste com `(11) 98888-7777` (já tem 2 endereços) ou qualquer outro número. O cadastro aparece no **Painel → Clientes**.
No sistema real o telefone deve ser confirmado por um código no WhatsApp antes de mostrar os endereços, para ninguém ver o endereço de outra pessoa só sabendo o número.

## Painel completo (visualização)

- **Pedidos:** clique num card para ver o detalhe (cliente, itens, troco, andamento, mensagens). **Lançar pedido** registra pedidos por telefone, balcão ou mesa.
- **Cardápio:** abas Produtos, Categorias, Adicionais e Vitrine. O cadastro de produto tem fotos (a primeira é a capa), descrição, ingredientes, adicionais, disponibilidade e a prévia de como o cliente vê.
- **Clientes:** indicadores, busca por nome ou telefone e a ficha com endereços e pedidos.

Neste protótipo o que se cadastra no painel vale só enquanto a página está aberta (os clientes ficam salvos no navegador).

## Marca própria de cada restaurante (white-label)

**Fomito é a plataforma.** Cada restaurante coloca a própria marca em **Painel → Configurações → Sua marca**:
nome, frase, logo (imagem), cor principal, cor de destaque e as fontes de títulos e textos.
Ao salvar, o cardápio, o Portal, o painel, as comandas, o cupom e as mensagens de WhatsApp passam a usar essa marca.
Só o rodapé discreto "Pedidos com Fomito" fica com o nome da plataforma.

Como funciona por dentro (`compartilhado/js/config.js`):
- As configurações ficam salvas no navegador (`localStorage`, chave `fomito.config`). No sistema real viram a tabela `configuracoes` no Neon, uma linha por restaurante.
- A partir das 2 cores escolhidas, o sistema gera os tons mais claros e mais escuros e troca as variáveis `--roxo*` e `--laranja*` de `tokens.css`.
- As fontes vêm do Google Fonts e só carregam quando são usadas.
- Sem logo enviada, o símbolo é um quadrado com a inicial do nome.

## Pedido novo: som, cupom e WhatsApp

| O que acontece | Quando | Onde configurar |
|---|---|---|
| Toca um "ding-dong" | Chega pedido novo | Configurações → Impressora e som |
| Imprime o cupom (80mm) | O pedido é **aceito** | Configurações → Impressora e som |
| Mensagem no WhatsApp do cliente | Recebido, em preparo, saiu para entrega e entregue | Configurações → WhatsApp |

No protótipo, um pedido novo chega sozinho 7 segundos depois de abrir o painel (e outro aos 45 segundos).
O navegador só libera som depois do primeiro clique na página, então clique em qualquer lugar do painel antes.

### Impressora térmica (POS-80)

No protótipo o cupom é montado em 42 colunas (largura do papel de 80mm) e o painel chama a impressão do navegador,
com o CSS `@page { size: 80mm auto }`. Dentro do visualizador do Claude a janela de impressão é bloqueada:
abra `painel/index.html` direto no navegador para testar com a impressora de verdade.

Para o sistema real, há dois caminhos. O servidor no Render **não enxerga** a impressora que está no balcão, então a impressão sempre sai do computador da loja:

1. **Pelo navegador (mais simples).** Instale a POS-80 no Windows como impressora padrão e abra o Chrome com
   `--kiosk-printing`. Assim `window.print()` imprime direto, sem abrir a janela. Não precisa instalar nada além do driver.
2. **ESC/POS direto (mais profissional).** Um programinha no computador da loja recebe o pedido e manda os comandos
   ESC/POS para a impressora (corte de papel, negrito, abrir gaveta). Opções: **QZ Tray**, ou um serviço Node.js local
   com a biblioteca `node-thermal-printer`, que escuta o painel ou o servidor por WebSocket.

### WhatsApp (Evolution API)

Igual ao BarberFlow. Em **Configurações → WhatsApp** ficam a URL da API, a chave, o nome da instância e o QR Code
para conectar o número da loja. As mensagens têm modelos editáveis com as variáveis
`{nome}`, `{pedido}`, `{loja}`, `{total}`, `{previsao}` e `{pagamento}`.

No protótipo a conexão e os envios são **simulados** (o painel mostra "WhatsApp enviado" no card do pedido).
No sistema real quem envia é o servidor Node.js, nunca o navegador, para a chave não vazar:

```
POST {URL_DA_API}/message/sendText/{instancia}
headers: { "apikey": "<chave>" }
body:    { "number": "5511988887777", "text": "Olá, Ana! Seu pedido #1042 saiu para entrega..." }
```

A chave vai no `.env` do servidor (documentada no `.env.example`, nunca no GitHub).

## Como mudar o visual

- **Marca do restaurante:** pelo próprio painel, em Configurações (veja acima). O padrão fica em `compartilhado/js/config.js`.
- **Cores e fontes base:** `compartilhado/css/tokens.css`.
- **Produtos, fotos e adicionais:** `compartilhado/js/dados.js`.
- **Componentes (botão, cartão, campo):** `compartilhado/css/base.css`.
- **Ícones:** `compartilhado/js/icones.js`. No HTML use `<i data-icone="nome"></i>`, no JS `Fomito.icone("nome")`.

## Identidade da plataforma (marca padrão)

- Nome: **Fomito** · Slogan: "Seu negócio sempre no controle."
- Roxo `#4B2B8F` (institucional) · Laranja `#FF8A00` (destaques) · Creme `#FFF7ED` (fundos)
- Verde `#22C55E` e Vermelho `#EF4444` (complementares: sucesso e alerta)
- **Nunito** para títulos e marca · **Inter** para textos
- Visual arredondado na medida, amigável e profissional

## Próximo passo

Depois de aprovados os protótipos, o sistema real será feito com Node.js, banco Neon (PostgreSQL) e hospedagem no Render.
