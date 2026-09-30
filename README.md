# LLM Cost Monitor

Painel web que mostra **quanto se gasta com modelos de IA** (OpenAI, Anthropic, Google), **se o orçamento vai estourar** e **se o serviço está saudável** (latência, rate limits e erros).

> **Status: protótipo funcional com dados simulados.** A interface, os cálculos e as regras de negócio são reais; os dados não. Não há backend, persistência nem integração com provedores. Detalhes em [`PRODUCT.md`](./PRODUCT.md).

## O que ele faz

- **KPIs do período** (24h, 7 dias ou 30 dias): gasto, requisições e taxa de erro, custo médio por 1k tokens e latência.
- **Gráficos:** gasto acumulado por provedor, custo por modelo e latência com média móvel.
- **Alertas de orçamento** por provedor e total: Saudável (< 80%), Atenção (≥ 80%) e Crítico (≥ 100%), com webhook simulado via toast.
- **Logs de requisições** com filtros cruzados (status × modelo × latência) e paginação.
- **Modo "Ao vivo":** novas requisições a cada 2,5 s. Tema claro/escuro.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) · Recharts 3 · Framer Motion · next-themes · Lucide

## Começando

**Requisitos:** Node.js **22.18+** (o `npm run check` executa TypeScript direto no Node) e npm.

```bash
git clone https://github.com/joaosclarski/LLM-Cost-Monitor.git
cd LLM-Cost-Monitor
npm install
npm run dev
```

Abra <http://localhost:3000>. Não há variáveis de ambiente nem serviços externos para configurar.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Serve o build de produção |
| `npm run lint` | ESLint |
| `npm run check` | Valida a lógica de dados (custos, alertas, séries, filtros) |

## Estrutura

```
src/
├── app/                  # layout, página única e estilos globais (tokens de cor/tema)
├── components/
│   ├── dashboard.tsx     # header, KPIs, modo ao vivo e composição da página
│   ├── charts.tsx        # gráficos Recharts
│   ├── budget-alerts.tsx # alertas de orçamento + webhook simulado
│   ├── logs-table.tsx    # tabela de logs, filtros e paginação
│   └── ui/               # componentes shadcn/ui
└── lib/
    ├── data.ts           # simulação + funções puras de métricas (sem React)
    └── utils.ts          # cn() e formatadores (USD, ms, números)
scripts/check-data.ts     # verificações com node:assert
PRODUCT.md                # documento de produto: regras, limitações e roadmap
```

**Onde mexer:**
- Preços e modelos: tabela `MODELS` em `src/lib/data.ts` (USD por 1M tokens).
- Regras de cálculo (custo, estados de orçamento, séries, filtros): funções puras em `src/lib/data.ts`.
- Visual: componentes em `src/components/`; cores e tema em `src/app/globals.css`.

## Regras de negócio que não podem quebrar

- `custo = (tokens_input × preço_input + tokens_output × preço_output) / 1.000.000`
- Requisições **429** e **500** custam **$0**.
- Exatamente **80%** já é Atenção; exatamente **100%** já é Crítico.
- O webhook só dispara quando o estado **piora** e se estiver ligado naquele alerta.
- Cor nunca é o único indicador de estado: sempre há ícone e texto.

Lista completa em [`PRODUCT.md` §6.2](./PRODUCT.md).

## Como contribuir

1. Crie uma branch a partir de `master`: `git checkout -b feat/minha-mudanca`.
2. Faça a mudança. Lógica de dados fica em `src/lib/data.ts`, como funções puras; se alterar uma regra, atualize `scripts/check-data.ts`.
3. Antes de abrir o PR, tudo isto precisa passar:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run check
   npm run build
   ```
4. Abra um Pull Request descrevendo **o que** mudou e **por quê**, com um print se houver mudança visual.

> **Atenção:** este projeto usa Next.js 16, que tem mudanças incompatíveis com versões anteriores. Consulte `node_modules/next/dist/docs/` antes de usar APIs do Next (veja `AGENTS.md`).

**Ideias de próximos passos** (detalhadas em [`PRODUCT.md` §6.3](./PRODUCT.md)): ingestão real de logs, persistência dos limites, webhooks reais, preços versionados e autenticação.
