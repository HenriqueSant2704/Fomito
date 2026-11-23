# Prontito · Protótipos

Protótipos navegáveis para alinhar **design e funcionamento** antes do desenvolvimento.
Feitos em HTML, CSS e JavaScript puros, sem instalar nada.

## Como abrir

Dê dois cliques em `prototipos/index.html`. Ele leva às três telas:

| Tela | Arquivo | Para quem |
|---|---|---|
| App do cliente | `cliente/index.html` | Cliente pede para entrega ou para comer no local |
| Garçom | `garcom/index.html` | Garçom abre comandas por mesa, lança itens e fecha a conta |
| Painel da lanchonete | `painel/index.html` | Dono/gerente acompanha pedidos, comandas, cardápio e configurações |

> Os dados são fictícios (`compartilhado/js/dados.js`) e nada é salvo.

## Organização das pastas

```
prototipos/
├── index.html                 ← página inicial com links para as telas
├── compartilhado/             ← tudo que as três telas usam
│   ├── css/
│   │   ├── tokens.css         ← CORES, FONTES, RAIOS, SOMBRAS (identidade da marca)
│   │   └── base.css           ← botões, cartões, campos, etiquetas, modais...
│   ├── js/
│   │   ├── dados.js           ← cardápio e dados de exemplo
│   │   └── utils.js           ← funções pequenas (moeda, toast, logo...)
│   └── img/simbolo.svg        ← símbolo "P" da marca
├── cliente/   (index.html · cliente.css · cliente.js)
├── garcom/    (index.html · garcom.css · garcom.js)
└── painel/    (index.html · painel.css · painel.js)
```

Cada tela tem **3 arquivos com o mesmo nome da pasta**: o HTML (estrutura), o CSS (visual daquela tela) e o JS (comportamento).
Os arquivos JS são divididos em seções numeradas no topo, para achar rápido o que mudar.

## Como mudar o visual

- **Cores e fontes:** só em `compartilhado/css/tokens.css`. Mudou ali, muda em todas as telas.
- **Produtos do cardápio:** `compartilhado/js/dados.js`.
- **Componentes (botão, cartão, campo):** `compartilhado/css/base.css`.

## Identidade da marca

- Roxo `#4B2B8F` (institucional) · Laranja `#FF8A00` (destaques) · Creme `#FFF7ED` (fundos)
- Verde `#22C55E` e Vermelho `#EF4444` (complementares: sucesso e alerta)
- **Nunito** Bold/ExtraBold para títulos e chamadas · **Inter** para textos
- Visual arredondado, amigável e profissional

## Próximo passo

Depois de aprovados os protótipos, o sistema real será feito com Node.js, banco Neon (PostgreSQL) e hospedagem no Render.
