---
name: dashboard-ftw
description: >-
  Gera o "Dashboard FTW" — um dashboard HTML único, integrado ao vivo a uma planilha Google Sheets do Drive,
  para acompanhamento de operações de delivery iFood (e correlatos). Use SEMPRE que o usuário disser
  "Dashboard FTW", "executar o Dashboard FTW", "gerar/criar/montar/atualizar o Dash/Dashboard" de uma
  marca/cliente, ou pedir para replicar/adaptar um dashboard de performance de delivery para uma nova
  planilha — mesmo que não use o nome exato "FTW". Também use ao atualizar um dashboard já existente com
  base numa planilha do Drive. Esta skill é obrigatória — NUNCA construa esse tipo de dashboard sem antes
  consultá-la, porque ela contém regras de segurança de dados entre clientes (nunca misturar dados de uma
  marca com o molde/dados de outra) e um padrão técnico validado ao longo de múltiplas iterações reais.
---

# Dashboard FTW

Gerador de dashboards de performance de delivery (iFood/99Food) em HTML único, com dados ao vivo do Google Sheets. O "Tapí Tapioca e Açaí" foi o **primeiro cliente onde este padrão foi desenvolvido e validado** — por isso "Tapí" aparece como referência de nomenclatura técnica (ex.: nomes de variáveis/funções no código gerado podem manter vestígios como `tapiLike`), mas **isso é só o nome do molde de layout/engine**. NUNCA é fonte de dados.

## ⚠️ REGRA MAIS IMPORTANTE — leia antes de qualquer coisa

**Toda vez** que este comando for acionado:

1. **Pergunte/confirme qual planilha do Drive usar.** Nunca assuma, nunca reaproveite a última planilha usada numa conversa anterior. Se o usuário já citou o nome, ainda assim localize e abra a planilha para confirmar a estrutura antes de codar.
2. **Peça a logo do cliente** (se não foi anexada) para extrair as cores da marca. Nunca reaproveite a paleta de outro cliente. Se não vier logo nenhuma, use um placeholder neutro genérico (nunca a cor/identidade de outro cliente) e avise que está provisório.
3. **Trabalhe 100% restrito aos dados dessa planilha.** Nunca preencha uma aba, loja, valor, ou benchmark com dado vindo de outra marca — nem como "exemplo", nem como fallback, nem para "não deixar vazio". Se a planilha não sustenta uma aba (ex. sem dados de Investimento), **essa aba não existe no HTML gerado** — não aparece oculta com dado falso, simplesmente não é construída.
4. **Nunca copie um arquivo de outro cliente já pronto e edite por cima às pressas.** Isso já causou um incidente real: dados de um cliente vazaram para o arquivo mestre de outro por erro de "em qual arquivo eu estou editando". Sempre: (a) trabalhe numa pasta/arquivo de trabalho isolado, nomeado com o cliente atual; (b) nunca sobrescreva o arquivo de outro cliente já entregue sem confirmar explicitamise que é essa a intenção; (c) depois de qualquer edição, rode o teste de boot (seção "Teste obrigatório antes de entregar") antes de apresentar o arquivo.

Se o usuário disser algo como "gera o Dashboard FTW" sem anexar nada, pare e pergunte a planilha (link ou nome exato) e peça a logo, num único turno, antes de escrever qualquer código.

## Passo a passo de execução

1. **Localizar e abrir a planilha** citada pelo usuário no Google Drive (`Google Drive:search_files`, depois `Google Drive:download_file_content` exportando como xlsx).
2. **Mapear a estrutura real**: listar as abas, procurar o padrão de blocos `"UNIDADE: NOME"` / `"REDE"` (ou o nome da marca sozinho, ex. "SPESSO", quando a planilha não tem abertura por loja — nesse caso trate a marca inteira como uma "loja única"), identificar quais indicadores cada aba sustenta (Vendas/Pedidos, GMV, TM, Novos, Visitas, Conversão, Budget, Promoções+Ads, Sub iFood, CPO, ROI), quais janelas de parcial existem (01-07/01-14/01-21/01-28), se há mês fechado, se há aba de Investimento mensal, aba de Status de Alavancas, aba de Margem/DRE, dados de BP/eficiência operacional.
3. **Decidir quais abas do dashboard entram** com base exclusivamente no que foi encontrado no passo 2 (ver "Abas do padrão" abaixo — cada uma tem seu requisito de dado mínimo).
4. **Extrair as cores da logo** (amostragem de pixels da imagem) para a paleta CSS.
5. **Construir o HTML** seguindo a especificação técnica completa abaixo, usando como referência de código o arquivo `references/tapi-template.html` (o molde de layout/engine mais completo e testado) — mas populando **somente** com os dados extraídos no passo 2.
6. **Rodar o teste de boot obrigatório** (seção própria abaixo) antes de mostrar qualquer coisa ao usuário.
7. **Entregar** o arquivo nomeado com o cliente (ex. `Dashboard_<Cliente>.html`) e uma cópia `index.html` para hospedagem, junto de um resumo do que foi incluído/excluído e por quê.

## Abas do padrão (incluir apenas se a planilha sustentar)

| Aba | Requisito mínimo de dado |
|---|---|
| Dash · Mês Fechado | pelo menos 2 meses fechados, por loja (ou só rede, se não houver abertura por loja) |
| Dash · Parcial | pelo menos 1 janela (01-07/14/21/28) com 2+ períodos |
| Status de Alavancas | aba(s) de status com Budget/Taxa Grátis/CI/Anúncio/Hits por loja e por data |
| Investimento | aba mensal de investimento com Promoções/Anúncios/Total/%Invest por loja |
| Margem (DRE) | aba de DRE/Margem de Contribuição com % fixos (Imposto, CMV, ROY, FPP, Tx iFood) |
| Comparativo Parciais | mesma fonte do Dash·Parcial, usa os 2 períodos mais recentes |
| Eficiência Operacional | dado de BP/despacho (mesmo que de fonte externa combinada, deixar isso explícito) |
| BP × Pedidos | cruzamento — só se BP e Pedidos existirem no mesmo recorte temporal, ou deixar nota clara se os recortes forem diferentes |
| Método FTW | sempre incluir; usar só os indicadores (conv/tm/roi/budget/margem/cmv/atraso) que a planilha sustenta — nunca todos por padrão |
| Legenda | sempre incluir; remover itens de indicadores que a aba correspondente não tiver |

Se restar só 1 grupo de abas (ex. só parcial, sem mês fechado), **não deixe o segundo pill do header vazio** — troque por um aviso ("Todas as janelas são parciais nesta planilha") em vez de um modo sem conteúdo.

## Especificação técnica do molde (regras fixas, não mudam entre clientes)

**Nomenclatura:** sempre "Pedidos" (nunca "Vendas"). Sempre "Margem de Contribuição iFood" com a base declarada (nunca "margem" genérica). Decimais em pt-BR.

**Cores e setas:** a seta SEMPRE reflete o sinal real do número (▲ se subiu, ▼ se desceu). A COR indica se é bom (verde) ou ruim (vermelho) — nunca cinza/neutro. Para métricas de custo (Budget %, Promoções+Ads, CPO), cair é verde mesmo com seta para baixo.

**Layout:** fundo claro, Calibri, bordas arredondadas, cores extraídas da logo do cliente atual. Gráficos Chart.js com `cubicInterpolationMode:'monotone'` (nunca deixar a curva passar acima/abaixo dos pontos reais). Legenda de gráfico sem clique-oculta (`Chart.defaults.plugins.legend.onClick=()=>{}`). Modo destaque nos gráficos de evolução por loja: clicar destaca (linha grossa, cor da marca) e esmaece as demais (cinza claro, sem ocultar) — nunca ocultar linhas ao clicar.

**Header em dois níveis:** pills "Parcial" / "Consolidado" que revelam as abas do respectivo grupo + "Legenda" sempre visível e independente do modo. Clicar num modo navega automaticamente para a primeira aba desse grupo.

**Mobile (≤820px):** cabeçalho compacto (~70–100px, esconde subtítulo/status), menu vira accordion (botão ☰) que fecha sozinho ao navegar para uma aba, e auto-hide do header ao rolar para baixo (reaparece ao rolar para cima; pausado enquanto o menu está aberto).

**Conteúdo sempre dinâmico:** todo texto/insight gerado a partir dos dados vigentes — nunca número ou denominador fixo escrito à mão (ex. ranking sempre `de ${LOJAS.length}`, nunca um número hardcoded). Indicador sempre nomeado junto da variação percentual. Períodos sempre explícitos nos rótulos (ex. "Julho (01–14) vs Junho (01–14)"). Banner de aviso visível quando o JavaScript não executa (preview sem JS, ex. Quick Look do iPhone).

**Carregador ao vivo:** export xlsx do Google Sheets como rota principal, fallback para CSV via endpoint gviz. Parser varre blocos `"UNIDADE: X"` e `"REDE"` (ou o nome da marca sozinho, se for loja única). Snapshot embutido no HTML como contingência offline. **O limiar mínimo de lojas cobertas para aceitar uma atualização ao vivo precisa ESCALAR com o tamanho da rede do cliente** (`Math.max(2, Math.ceil(LOJAS.length*0.7))`) — nunca um número fixo como 10, que travaria redes pequenas.

**Método FTW (benchmarks):** cada indicador comparado a uma referência de mercado publicada e citável (não inventada), com farol 🟢🟡🔴 e Score 0–10. Indicadores possíveis: Conversão de cardápio (25–35%), Ticket médio (≥ R$50), ROI/ROAS (4:1 setor · 8,5:1 iFood Anúncios), Budget de investimento (teto ~5%), Margem de Contribuição (30–40%), CMV (28–35%), Atraso crítico/taxa de problemas (≤2,5%, critério Selo Super iFood). Usar só os que a planilha do cliente atual sustenta. Sempre incluir nota metodológica honesta sobre as limitações das comparações (ex. ROI interno ≠ ROAS atribuído).

## Teste obrigatório antes de entregar

Nunca entregue um arquivo sem antes:
1. Verificar sintaxe JS (`node --check`).
2. Rodar um harness Node headless que simula `document`/`window`/`Chart`/`fetch` e executa o `<script>` extraído do HTML, conferindo que `boot()` roda sem erro e que os insights/tabelas das abas incluídas mostram números plausíveis (bater pelo menos 2-3 valores contra a planilha original).
3. Se qualquer edição foi feita "por cima" de um arquivo existente (não construção do zero), grepar por vestígios de marca errada no resultado final (nome de outro cliente, lojas de outro cliente, cores hardcoded de outro cliente) antes de apresentar.

Ver `references/test-harness.md` para o template do harness de teste.

## Documentos de referência

- `references/tapi-template.html` — HTML completo mais recente e testado do padrão (Tapí), usar como base de código/estrutura, nunca como fonte de dados para outro cliente.
- `references/test-harness.md` — template do harness Node para o teste obrigatório de boot.
- `references/prompt-mestre.md` — o prompt final consolidado, para copiar/colar quando for acionar este fluxo manualmente ou documentar para outra pessoa/agente replicar.
