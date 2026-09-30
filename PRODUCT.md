# LLM Cost Monitor — Documento de Produto

> Estado atual: **protótipo funcional com dados simulados**. Não há backend, persistência nem integração real com provedores. Este documento descreve o que o código faz hoje e o que ainda precisa ser feito para ir a produção.

## Resumo em linguagem simples

Em uma frase: é um painel que mostra **quanto uma empresa está gastando com modelos de IA** (ChatGPT, Claude, Gemini), **se vai estourar o orçamento** e **se o serviço está funcionando bem**.

### O cenário

Imagine uma empresa cujo produto usa IA por trás, como um chatbot de atendimento. Cada vez que um cliente manda uma mensagem, o sistema faz uma **requisição** para um modelo de IA, e o provedor cobra por ela.

A cobrança é por **tokens**, pedaços de texto:

- **input:** o texto enviado ao modelo;
- **output:** a resposta que ele gera.

Cada modelo tem um preço diferente. O gpt-4o, por exemplo, cobra $5 por 1 milhão de tokens de input e $15 por 1 milhão de output. O gemini-1.5-flash cobra centavos. Com milhares de requisições por dia em três provedores, fica difícil saber quanto se está gastando. O painel resolve isso.

### O que aparece na tela, de cima para baixo

1. **Os números principais (4 cartões):**
   - quanto foi gasto no período;
   - quantas requisições foram feitas e quantas deram erro;
   - custo médio por 1k tokens;
   - tempo médio de resposta da IA.

   No topo, o usuário escolhe o período (24 horas, 7 dias ou 30 dias) e tudo é recalculado.
2. **Três gráficos:**
   - o **gasto acumulado por provedor**, mostrando quem pesa mais na conta;
   - o **consumo por modelo**, mostrando qual modelo concentra o gasto;
   - a **latência**, mostrando se a IA ficou lenta em algum momento.
3. **Alertas de orçamento:** cada provedor, e também o total, tem um limite mensal definido pelo usuário. Uma barra mostra quanto já foi usado:
   - 🟢 **Saudável:** abaixo de 80%;
   - 🟡 **Atenção:** a partir de 80%;
   - 🔴 **Crítico:** a partir de 100%, com a barra piscando.

   Quando um alerta piora, aparece uma notificação que simula o envio de um aviso automático (webhook) para outro sistema, como o Slack da equipe.
4. **Tabela de requisições (logs):** o registro de cada chamada (horário, modelo, resultado, tempo, tokens e custo). Os status possíveis são:
   - **200:** deu certo;
   - **429:** chamadas demais, e o provedor bloqueou temporariamente;
   - **500:** erro no provedor.

   Dá para combinar filtros, como "só erros 429 do gpt-4o" ou "só chamadas acima de 2 segundos", para investigar problemas.

### O "tempo real"

Com o botão **"Ao vivo"** ligado, novas requisições chegam a cada 2,5 segundos. Os números, os gráficos e a tabela se atualizam sozinhos, como num painel de monitoramento de verdade.

### O que é real e o que é simulado

A interface, os cálculos e as regras funcionam de verdade. **Os dados são falsos:** nenhuma empresa nem IA real está conectada. O sistema inventa cerca de 3.200 requisições realistas ao abrir e continua gerando novas. Por isso é um **protótipo**: mostra como o produto funcionaria.

Para uso real, faltaria:

- conectar aos dados verdadeiros;
- salvar os limites configurados, que hoje se perdem ao recarregar;
- enviar os avisos de verdade.

As seções abaixo detalham cada ponto em linguagem técnica.

## 1. Visão Geral do Produto

O LLM Cost Monitor é um dashboard web de página única que mostra, quase em tempo real, **quanto se gasta**, **quanto se consome** e **como se comporta** o tráfego de um gateway de LLMs (`acme / llm-gateway · prod`) que atende vários provedores.

Numa única tela, o produto junta:

- indicadores principais (KPIs) do período selecionado;
- três gráficos interativos (gasto acumulado por provedor, custo por modelo e latência);
- alertas de orçamento com limites editáveis e webhook simulado;
- uma tabela de logs de requisições com filtros cruzados e paginação.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (sobre Base UI), Recharts 3, Framer Motion, next-themes e Lucide.

## 2. Problema que Resolve

Equipes que usam mais de um provedor de LLM têm dificuldade em responder rapidamente:

- **Quanto estamos gastando agora e com quem?** Cada provedor cobra de forma diferente e com preços distintos para tokens de input e de output.
- **Vamos estourar o orçamento?** Sem alerta antecipado, o estouro só aparece na fatura.
- **Qual modelo concentra o custo?** Um modelo caro pode dominar a conta mesmo com poucas requisições.
- **A qualidade do serviço está degradando?** Picos de latência, rate limits (429) e erros (500) afetam o produto final.

O dashboard reúne essas respostas num só lugar, com métricas que se atualizam a cada nova requisição e a cada troca de período.

## 3. Público-Alvo

| Perfil | Necessidade principal |
|---|---|
| **Engenheiros de plataforma / MLOps** | Acompanhar latência, taxa de erro e rate limits por modelo; investigar requisições individuais. |
| **Tech leads e gestores de engenharia** | Acompanhar o gasto por provedor e por modelo; decidir trocas de modelo por custo-benefício. |
| **FinOps / Financeiro** | Controlar orçamentos e ser avisado ao chegar a 80% e a 100% do limite. |
| **Desenvolvedores de produtos com IA** | Entender o custo médio por 1k tokens e o impacto das escolhas de modelo. |

## 4. Funcionalidades Principais

### 4.1 Modelo de custos

O custo de cada requisição combina tokens de input e de output com preços próprios de cada modelo (USD por 1M tokens), definidos em `src/lib/data.ts`:

| Modelo | Provedor | Input | Output |
|---|---|---|---|
| gpt-4o | OpenAI | $5.00 | $15.00 |
| gpt-4o-mini | OpenAI | $0.15 | $0.60 |
| claude-3.5-sonnet | Anthropic | $3.00 | $15.00 |
| claude-3.5-haiku | Anthropic | $0.80 | $4.00 |
| gemini-1.5-pro | Google | $1.25 | $5.00 |
| gemini-1.5-flash | Google | $0.075 | $0.30 |

Fórmula: `custo = (tokens_input × preço_input + tokens_output × preço_output) / 1.000.000`.

**Regra de negócio:** requisições com status **429** ou **500** têm custo **$0** (considera-se que não são cobradas) e não têm tokens de output.

### 4.2 Simulação de tráfego

- **Carga inicial:** 3.200 requisições distribuídas nos últimos 30 dias, geradas com um PRNG determinístico (mulberry32, semente 42). O tráfego é mais denso nos dias recentes, para que a curva acumulada fique realista.
- **Mix de modelos:** ponderado (por exemplo, gpt-4o 26%, claude-3.5-sonnet 24%, gpt-4o-mini 18%).
- **Status:** ~92% `200`, ~5% `429 Rate Limit` e ~3% `500 Erro`.
- **Latência:**
  - base própria de cada modelo, com variação aleatória;
  - ~6% de picos (2,2× a 4,2× a base);
  - `429` responde rápido (40–120 ms);
  - `500` soma +1,5 s.
- **Tempo real:** com o modo "Ao vivo" ligado, entram de 1 a 3 requisições novas a cada **2,5 s**. O modo pode ser pausado ou retomado no header.

### 4.3 Filtro de período e métricas derivadas

O seletor de período (**Últimas 24h**, **7 dias**, **30 dias**) recalcula todo o painel, exceto os alertas de orçamento, que usam sempre 30 dias.

| Período | Intervalos (buckets) |
|---|---|
| 24h | 24 × 1 hora |
| 7 dias | 28 × 6 horas |
| 30 dias | 30 × 1 dia |

**KPIs:**
- **Gasto no período:** total em USD e total de tokens.
- **Requisições:** quantidade e taxa de erro (429 + 500).
- **Custo médio / 1k tokens:** `custo total ÷ (tokens totais / 1000)`, somando input e output.
- **Latência (média móvel):** último valor da média móvel e a média geral do período.

### 4.4 Gráficos interativos

1. **Gasto acumulado por provedor** (linhas): curva acumulada de OpenAI, Anthropic e Google, com legenda que mostra o total de cada provedor e tooltip com crosshair.
2. **Consumo por modelo** (barras horizontais): custo por modelo em ordem decrescente; o tooltip mostra tokens e número de requisições.
3. **Latência média** (linhas): média de cada intervalo (linha cinza) e média móvel de **4 intervalos** (linha azul).

As cores seguem uma paleta categórica validada para daltonismo. Provedores usam as cores de série; estados usam cores reservadas (sucesso, atenção, crítico), sempre acompanhadas de ícone e texto.

### 4.5 Alertas de orçamento

- Quatro alertas: **Total**, **OpenAI**, **Anthropic** e **Google**.
- Cada alerta tem **limite editável** (USD) e um interruptor de **webhook**.
- Consumo considerado: janela móvel dos **últimos 30 dias**.
- Estados, com barra de progresso animada:

| Consumo | Estado | Visual |
|---|---|---|
| < 80% | **Saudável** | verde |
| ≥ 80% e < 100% | **Atenção** | amarelo |
| ≥ 100% | **Crítico** | vermelho pulsante |

- **Webhook simulado:** quando um alerta **escala** (Saudável → Atenção ou Atenção → Crítico) e o webhook está ligado, aparece um toast com a mensagem `POST https://hooks.acme.dev/budget → 200 OK`. Quedas de estado não geram notificação.
- **Limites iniciais:** são calculados a partir do gasto simulado, para que a demo abra com um alerta em cada estado.

### 4.6 Logs de requisições

- **Colunas:** horário, ID, modelo (com a cor do provedor), status, latência (vermelha acima de 2 s), tokens de input/output e custo.
- **Filtros cruzados e instantâneos:**
  - **Status:** Todos, 200, 429 e 500. Cada opção mostra a contagem, que já respeita os outros filtros ativos.
  - **Modelo:** todos ou um dos 6 modelos.
  - **Latência:** qualquer, < 500 ms, 500 ms–2 s ou > 2 s.
- A tabela respeita o período selecionado no topo.
- **Paginação:** 12 linhas por página. Qualquer mudança de filtro volta para a página 1.
- Quando nenhum log corresponde aos filtros, a tabela mostra uma mensagem de estado vazio.

### 4.7 Interface e tema

- Layout inspirado em Vercel/Linear: header fixo com efeito de vidro, breadcrumb, cards com borda fina e tipografia Geist.
- Tema **claro/escuro** via `next-themes`: segue o sistema por padrão, com alternância manual no header.
- Animações com Framer Motion: entrada dos cards, pílula deslizante nos seletores, barras de progresso e novas linhas da tabela.
- Responsivo, de 1 a 4 colunas conforme a largura da tela.
- Idioma pt-BR; valores monetários em USD.

## 5. Jornada do Usuário

1. **Chegada:** o usuário abre o dashboard e o painel carrega com os dados dos últimos 7 dias em modo "Ao vivo". Se algum orçamento já estiver em Atenção ou Crítico, os toasts de webhook aparecem logo de início.
2. **Leitura rápida:** nos KPIs, o usuário vê o gasto, o volume, a taxa de erro, o custo por 1k tokens e a latência.
3. **Mudança de horizonte:** ao trocar para 24h ou 30 dias, KPIs, gráficos e tabela são recalculados na hora.
4. **Diagnóstico de custo:** no gráfico acumulado, o usuário identifica o provedor que mais cresce; no gráfico por modelo, o modelo responsável pelo gasto.
5. **Diagnóstico de desempenho:** o gráfico de latência mostra degradações, e a média móvel suaviza o ruído.
6. **Gestão de orçamento:** o usuário ajusta os limites de cada alerta e liga ou desliga o webhook. A barra e o estado mudam na hora; uma escalada gera um toast.
7. **Investigação:** na tabela de logs, o usuário combina filtros (por exemplo, `429` + `gpt-4o`, ou `> 2s`) e navega pelas páginas para ver requisições específicas.
8. **Controle da visualização:** o usuário pode pausar o fluxo ao vivo para analisar um momento fixo e alternar entre tema claro e escuro.

## 6. Pontos de Atenção e Requisitos Críticos

### 6.1 Limitações atuais (protótipo)

- **Dados 100% simulados:** não há integração com APIs de provedores, gateway, banco de dados nem ingestão real de logs.
- **Nada é persistido:** limites e estados de alerta, preferências e logs ao vivo existem só na memória e se perdem ao recarregar. Apenas o tema fica salvo no `localStorage`, via next-themes.
- **Webhook fictício:** o toast apenas simula o disparo; nenhuma requisição HTTP é enviada.
- **Memória sem limite:** no modo ao vivo, a lista de logs cresce sem teto (~1 log/s). Em sessões muito longas, isso degrada o desempenho.
- **Renderização apenas no cliente:** os dados dependem de `Date.now()`, então o dashboard é montado no navegador para evitar erros de hidratação. Não há SSR dos dados.
- **Sem autenticação nem multi-tenant:** a organização e o projeto (`acme / llm-gateway`) estão fixos no código.
- **Preços fixos no código:** a tabela de preços é estática e não foi conferida com os preços oficiais atuais, exceto o GPT-4o, que segue a especificação original.

### 6.2 Regras de negócio que precisam ser preservadas

- O custo deve **sempre** combinar input e output, com preços próprios de cada modelo.
- Requisições com falha (429/500) **não** geram custo.
- Os limites de orçamento são **80% (Atenção)** e **100% (Crítico)**. Um consumo de exatamente 80% já é Atenção; exatamente 100% já é Crítico.
- O webhook só dispara em **escalada** de estado e somente se estiver habilitado naquele alerta.
- Trocar o período deve recalcular a **média móvel de latência** e o **custo médio por 1k tokens**.
- Os filtros de logs são **cruzados** (status × modelo × latência × período), e as contagens por status refletem os demais filtros.
- Cor nunca é o único indicador de estado: sempre há ícone e rótulo de texto (acessibilidade).
- A cor de cada provedor fica fixa independentemente de filtros; não é reatribuída.

### 6.3 Requisitos para evolução a produção

1. **Ingestão real:** coletar os logs do gateway (ou das APIs de uso dos provedores) numa camada de backend/banco, com agregação no servidor.
2. **Preços versionados:** tabela de preços atualizável, com data de vigência, para recalcular corretamente o histórico. Também é preciso suportar tokens em cache e batch, que hoje não são modelados.
3. **Orçamento por mês-calendário:** hoje o "mensal" é uma janela móvel de 30 dias. É preciso definir a regra com o time de finanças (mês-calendário, ciclo de faturamento).
4. **Webhooks reais:** URL configurável, assinatura/segredo, retentativas e deduplicação, para não disparar repetidamente o mesmo estado.
5. **Persistência de alertas:** salvar limites e canais de notificação por organização ou projeto.
6. **Paginação e filtros no servidor:** necessários quando o volume de logs passar de alguns milhares de linhas.
7. **Limite e retenção de dados:** teto de logs em memória no cliente e política de retenção no backend.
8. **Autenticação e controle de acesso:** os logs podem expor metadados sensíveis de uso.
9. **Fuso horário e moeda:** hoje os horários usam o fuso do navegador e os valores estão em USD. Definir o comportamento para equipes em vários fusos e se haverá conversão de moeda.

### 6.4 Qualidade e verificação

- A lógica de custos, os limites de alerta, as séries acumuladas e os filtros são validados por `npm run check` (`scripts/check-data.ts`).
- Antes de qualquer entrega, rodar `npx tsc --noEmit`, `npm run lint` e `npm run build`, que hoje passam sem erros.
