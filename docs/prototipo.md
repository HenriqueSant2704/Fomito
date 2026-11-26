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
| Comandas | `garcom/index.html` | **Garçom** (e o administrador): mesas, servir o que ficou pronto, lançar itens, fechar conta |
| Entregas | `motoboy/index.html` | **Motoboy** (e o administrador): pedidos prontos por bairro, sair, receber e finalizar |

Acessos de teste: `admin` / `1234` (painel), `carlos` / `1234` (garçom) e `joao` / `1234` (motoboy).
No painel, em **Equipe**, o administrador cria garçons e motoboys. Cada um entra pelo Portal e vai direto para a sua tela, sem acesso ao painel.

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
│   │   ├── comandas.js        ← comandas das mesas (cliente pelo QR Code, garçom e painel usam as mesmas)
│   │   ├── caixa.js           ← controle de caixa: abertura, entradas, sangria, suprimento e fechamento
│   │   ├── pedidos.js         ← pedidos de entrega e balcão (cliente, painel e motoboy usam os mesmos)
│   │   ├── ilustracoes.js     ← "fotos" ilustradas dos produtos e da vitrine
│   │   ├── sessao.js          ← login, perfis (admin/garçom) e proteção das telas
│   │   ├── dados.js           ← cardápio, fotos, adicionais e dados de exemplo
│   │   └── utils.js           ← funções pequenas (moeda, toast, logo...)
│   └── img/simbolo.svg        ← símbolo "F" da marca
├── cliente/   (index.html · cliente.css · cliente.js)
├── portal/    (index.html · portal.css · portal.js)
├── garcom/    (index.html · garcom.css · garcom.js)
├── motoboy/   (index.html · motoboy.css · motoboy.js)
└── painel/    (index.html · painel.css · painel.js)
    ├── cardapio.js            ← produtos (cadastro com fotos), categorias, adicionais e vitrine
    ├── clientes.js            ← lista de clientes e ficha com endereços
    ├── pedido.js              ← detalhe do pedido e "Lançar pedido" (telefone, balcão, mesa)
    ├── comandas.js            ← comandas no quadro da cozinha, mesas, contas fechadas e QR Codes
    └── caixa.js               ← seção Caixa: conferência da gaveta, movimentações e fechamentos
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

## Comanda da mesa pelo QR Code

Cada mesa tem um QR Code que abre o cardápio já com o número dela (ex.: `cliente/index.html?mesa=7`).
No protótipo, use o link **"Simular QR da Mesa 07"** no rodapé do cardápio.

1. O cliente pede normalmente e, no finalizar, escolhe **Comer no local**. Pelo QR a mesa já vem preenchida.
2. Isso **não vira um pedido solto: abre a comanda da mesa**. Ela aparece no início (abaixo do cartão da loja) e em **Meus pedidos**.
3. Cada vez que ele pede mais, entra uma nova **rodada** na mesma comanda: Recebido → Em preparo → Pronto → Servido.
4. **Pedir a conta** avisa o garçom. Quando o garçom **fecha a conta**, a comanda vira um **pedido antigo**, sai do início e aparece em "Pedidos anteriores".

As comandas ficam em `compartilhado/js/comandas.js` e são as mesmas para o cliente, o garçom e o painel:
- **Garçom:** vê as mesas abertas pelo QR, as rodadas, quem pediu a conta, marca como servido e fecha a conta.
- **Painel → Pedidos:** as rodadas das mesas entram nas colunas da cozinha (borda roxa).
- **Painel → Comandas:** mesas, comandas fechadas do dia e os QR Codes para imprimir.

No protótipo tudo fica no navegador, então abra o cardápio e o garçom no mesmo navegador para ver um avisar o outro (a cada 3 segundos).
No sistema real isso vira as tabelas `comandas` e `comanda_itens` no Neon, com atualização em tempo real (WebSocket).
O QR deve levar um código da mesa difícil de adivinhar (ex.: `?m=7f3k`), para ninguém pedir em nome de outra mesa digitando o número.

## Quem finaliza cada pedido: motoboy e garçom

O atendente do painel não precisa mais perguntar se a comida chegou. No **Painel → Pedidos** ele só **aceita** (o pedido vai para Em preparo) e **marca pronto**. Daí em diante quem leva é quem finaliza:

| Pedido | Painel (atendente) | Quem finaliza | Vira |
|---|---|---|---|
| Entrega | Aceitar → Marcar pronto | **Motoboy**: sai para entrega, recebe e finaliza | Entregue |
| Mesa (comanda) | Aceitar → Marcar pronto | **Garçom**: leva e marca servido | Servido |
| Balcão | Aceitar → Marcar pronto → Cliente retirou | Atendente | Concluído |

Na coluna "Pronto / em rota" o painel mostra quem está com cada pedido ("Aguardando o motoboy", "Com João · saiu às 19:40", "Aguardando o garçom servir").

**Tela do motoboy** (`motoboy/index.html`, feita para o celular):
- **Para sair:** pedidos prontos **separados por bairro** (o cliente escolhe o bairro no endereço). Bairros com mais pedidos aparecem primeiro, com o botão **Levar todos**.
- O **endereço** é a informação maior do cartão (rua, complemento, bairro e referência), seguido do **pedido** e de **quanto cobrar**: no dinheiro já mostra quanto levar de troco.
- Ele marca os pedidos e toca **Sair para entrega**: o cliente recebe o WhatsApp "Saiu para entrega" e o painel vê com quem está.
- **Em rota:** botões **Mapa**, **Ligar** e **Entreguei**. Ao finalizar, informa como o cliente pagou; no dinheiro o **valor recebido é obrigatório** e o troco é calculado. O pagamento entra no caixa com o nome do motoboy.
- **Entregues:** as entregas do dia e o **dinheiro com ele**, para acertar com o caixa no fim do turno.
- Também vê os pedidos **ficando prontos**, para se planejar.

**Tela do garçom:** um quadro **Prontos para servir** no topo, com o botão **Servido**, e a mesa fica destacada.

**Avisos:** quando um pedido fica pronto, o motoboy (entrega) ou o garçom (mesa) recebe **som, vibração e notificação** (o garçom também quando a mesa pede a conta). Cada um toca em **Ativar avisos** uma vez. O painel também é avisado quando o motoboy sai e entrega.
No protótipo a notificação usa o navegador e precisa da tela aberta. No sistema real vira **Web Push** com Service Worker, para avisar mesmo com o celular bloqueado, e os pedidos viram as tabelas `pedidos` e `pedido_itens` com atualização em tempo real (WebSocket).

## Fechar a conta e controle de caixa

**No garçom (Fechar conta):**
- O valor de cada forma de pagamento já vem preenchido com o que falta pagar (ou a parte de cada um, se dividir).
- No **dinheiro**, o campo **Valor recebido é obrigatório**: sem ele o botão fica bloqueado. Há atalhos de notas (valor exato, R$ 50, R$ 100...) e o **troco é calculado** na hora.
- Dá para **pagar em mais de uma forma** (ex.: parte no Pix e o resto em dinheiro). Cada parte fica listada e pode ser desfeita antes de concluir.
- Com o caixa fechado, o garçom não consegue receber: aparece o aviso para abrir o caixa no painel.

**No painel (Caixa):**
1. **Abrir caixa** com o **dinheiro inicial** que o dono deixa na gaveta.
2. Cada pagamento entra sozinho: conta das mesas (pelo garçom) e entregas finalizadas (pelo motoboy), com a forma, o valor recebido e o troco devolvido.
3. **Tirar dinheiro** (ex.: levar ao cofre) e **Colocar dinheiro** (ex.: mais troco). No código continuam como `sangria` e `suprimento`.
4. **Fechar caixa:** conta o dinheiro da gaveta e compara com o esperado. Se não bater, a observação é obrigatória.
5. **Fechamentos anteriores** mostram se cada dia bateu, faltou ou sobrou (e quantas correções teve).

**Corrigir um pagamento:** se o garçom ou o motoboy lançou errado (ex.: marcou cartão, mas o cliente pagou no Pix), o responsável toca no lápis da movimentação e corrige a forma, o valor ou quanto o cliente deu (o troco é recalculado). O **motivo é obrigatório**. Nada é apagado: o pagamento ganha a etiqueta **Corrigido** e o **Registro de correções** mostra quem lançou, quem corrigiu, a hora, o antes e o depois e o motivo. Se for uma entrega, o pedido também passa a mostrar a forma certa. Só dá para corrigir enquanto o caixa está aberto.

Deveria ter na gaveta = dinheiro inicial + notas que os clientes deram − troco devolvido + dinheiro colocado − dinheiro tirado.

Exemplo: pedido de R$ 100 pago com uma nota de R$ 200. Entram R$ 200, saem R$ 100 de troco e a gaveta fica com +R$ 100. Pix e cartão caem na conta, não na gaveta. Na tabela de movimentações a coluna **Na gaveta** mostra quanto cada pagamento mudou a gaveta.

No sistema real isso vira as tabelas `caixas` e `caixa_movimentos` no Neon, e cada movimento guarda quem fez.

## Painel completo (visualização)

- **Pedidos:** clique num card para ver o detalhe (cliente, itens, troco, andamento, mensagens). **Lançar pedido** registra pedidos por telefone ou balcão; na opção Mesa, os itens entram na comanda da mesa.
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
