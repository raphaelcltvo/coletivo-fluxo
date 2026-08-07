# Prompt mestre — Dashboard FTW

Use este prompt (com a skill `dashboard-ftw` instalada/disponível) para acionar o agente completo.
Copie, ajuste os colchetes `[...]` e envie — anexe a logo do cliente na mesma mensagem se já tiver.

---

> Execute o Dashboard FTW para **[NOME DO CLIENTE]**, usando a planilha do Drive **[nome exato ou
> link da planilha]**. Segue a logo do cliente para extrair as cores.
>
> Regras obrigatórias:
> - Consulte a estrutura real dessa planilha antes de codar — não presuma nada.
> - Use **somente** os dados dela. Nenhuma loja, valor, cor, indicador ou benchmark de outro
>   cliente (a Tapí é só o molde de layout, nunca fonte de dado).
> - Inclua apenas as abas que a planilha sustenta com dado próprio (Dash·Mês Fechado, Dash·Parcial,
>   Status de Alavancas, Investimento, Margem/DRE, Comparativo Parciais, Eficiência Operacional,
>   BP×Pedidos, Método FTW, Legenda) — as demais simplesmente não devem existir no HTML, nunca
>   aparecer ocultas com dado inventado.
> - Siga a especificação técnica fixa do molde: nomenclatura "Pedidos" (nunca "Vendas"), "Margem de
>   Contribuição iFood" com a base sempre declarada, setas sempre pelo sinal real do número com cor
>   indicando bom/ruim (nunca cinza — e para Budget%/Promoções+Ads/CPO, cair é verde), header em
>   dois níveis (Parcial/Consolidado + Legenda sempre visível), mobile com menu accordion e
>   auto-hide no scroll, carregador ao vivo com limiar de cobertura escalando com o tamanho da
>   rede do cliente, todo texto/insight gerado dinamicamente dos dados vigentes (nunca número fixo
>   escrito à mão), Método FTW com benchmarks de mercado citáveis e farol/score.
> - Antes de me entregar qualquer arquivo, rode o teste de boot headless (sintaxe + execução +
>   conferência de 2–3 valores contra a planilha) e só então apresente.
> - Me entregue o arquivo nomeado com o cliente e também uma cópia `index.html` pronta para
>   hospedar (Netlify ou GitHub Pages), com um resumo do que entrou e do que ficou de fora (e por quê).

---

## Variações comuns

**Atualizar um dashboard já existente com dado novo da planilha:**
> Atualiza o Dash do **[cliente]** com a planilha do Drive dele. Antes de editar, copie o arquivo
> atual para um arquivo de trabalho separado (nunca edite por cima do arquivo de outro cliente por
> engano), aplique só o que mudou, rode o teste de boot, e só depois me entregue.

**Cliente sem abertura por loja (planilha só tem o total da marca):**
> A planilha do **[cliente]** não separa por loja — trate a marca inteira como uma "loja única" e
> não crie filtro de loja. Use só as abas de total da rede.

**Rede pequena (poucas lojas):**
> Lembre que o limiar de cobertura do carregador ao vivo precisa escalar com o tamanho da rede
> (não pode usar um número fixo que travaria uma rede pequena).
