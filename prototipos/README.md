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
│   │   ├── ilustracoes.js     ← "fotos" ilustradas dos produtos e da vitrine
│   │   ├── sessao.js          ← login, perfis (admin/garçom) e proteção das telas
│   │   ├── dados.js           ← cardápio, fotos, adicionais e dados de exemplo
│   │   └── utils.js           ← funções pequenas (moeda, toast, logo...)
│   └── img/simbolo.svg        ← símbolo "F" da marca
├── cliente/   (index.html · cliente.css · cliente.js)
├── portal/    (index.html · portal.css · portal.js)
├── garcom/    (index.html · garcom.css · garcom.js)
└── painel/    (index.html · painel.css · painel.js)
```

Cada tela tem **3 arquivos com o mesmo nome da pasta**: o HTML (estrutura), o CSS (visual) e o JS (comportamento).
Os arquivos JS são divididos em seções numeradas no topo, para achar rápido o que mudar.

## Como mudar o visual

- **Cores e fontes:** só em `compartilhado/css/tokens.css`. Mudou ali, muda em todas as telas.
- **Produtos, fotos e adicionais:** `compartilhado/js/dados.js`.
- **Componentes (botão, cartão, campo):** `compartilhado/css/base.css`.
- **Ícones:** `compartilhado/js/icones.js`. No HTML use `<i data-icone="nome"></i>`, no JS `Fomito.icone("nome")`.

## Identidade da marca

- Nome: **Fomito** · Slogan: "Seu negócio sempre no controle."
- Roxo `#4B2B8F` (institucional) · Laranja `#FF8A00` (destaques) · Creme `#FFF7ED` (fundos)
- Verde `#22C55E` e Vermelho `#EF4444` (complementares: sucesso e alerta)
- **Nunito** para títulos e marca · **Inter** para textos
- Visual arredondado na medida, amigável e profissional

## Próximo passo

Depois de aprovados os protótipos, o sistema real será feito com Node.js, banco Neon (PostgreSQL) e hospedagem no Render.
