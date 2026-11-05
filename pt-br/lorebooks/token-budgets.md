# Orçamento de tokens e recursão em lorebooks

Os orçamentos limitam quanto texto de lorebook chega à IA, para que os lorebooks não espremam o chat. Este guia cobre o **Token Budget** (orçamento de tokens) e o **Entry Limit** (limite de entradas) de cada lorebook e o **Lorebook Token Budget** do chat. Também mostra como Marinara corta as entradas e como funciona a varredura **Recursive** (recursiva).

Tokens são pedacinhos de texto que os modelos contam. A janela de contexto de um modelo é quanto texto ele consegue ler de uma vez, contado em tokens. O texto dos lorebooks divide essa janela com o resto do prompt.

## Dois orçamentos de tokens

Marinara aplica dois orçamentos sempre que monta um prompt. Uma entrada é pulada se fizer qualquer um deles passar do limite.

- Cada lorebook tem o próprio **Token Budget**: o máximo de tokens que aquele lorebook pode acrescentar a uma resposta.
- Cada chat tem um único **Lorebook Token Budget**: o máximo de tokens que todos os lorebooks ativos podem acrescentar juntos.

## Definir o Token Budget e o Entry Limit de um lorebook

1. Abra um lorebook pelo painel **Lorebooks**.
2. Clique na aba **Overview** (visão geral).
3. Defina **Token Budget** e **Entry Limit**.

| Configuração | Padrão | O que faz |
| --- | --- | --- |
| **Token Budget** | 2048 | O máximo de tokens que este lorebook acrescenta em uma resposta. 0 significa sem limite. |
| **Entry Limit** | 100 | O máximo de entradas que este lorebook acrescenta em uma resposta. Vai de 1 a 1000. |

O **Entry Limit** conta entradas, não tokens. Um lorebook para de acrescentar entradas quando chega a qualquer um dos dois limites.

Por exemplo, com um **Token Budget** de 2048, uma única entrada de 3000 tokens nunca consegue entrar. Diminua um orçamento se um lorebook ocupar espaço demais. Aumente-o se entradas importantes continuarem sendo puladas.

## Definir o Lorebook Token Budget do chat

1. Abra um chat.
2. Abra **Chat Settings** (configurações do chat).
3. Localize a seção **Lorebooks** e defina **Lorebook Token Budget**.

O padrão é 8192, e 0 significa sem limite. É o total para todos os lorebooks ativos neste chat, além do **Token Budget** próprio de cada lorebook.

## Como as entradas são cortadas

Quando há mais entradas correspondentes do que um orçamento permite, Marinara acrescenta as entradas nesta ordem.

1. As entradas **Constant** (constantes).
2. As entradas que corresponderam às mensagens mais recentes.
3. As demais, na ordem de inserção delas (o campo **Order** da entrada).

Marinara acrescenta cada entrada que ainda couber. Quando uma não cabe, Marinara pula essa entrada e continua verificando as demais. Assim, uma entrada menor ainda pode entrar depois que uma maior foi pulada.

<a id="seeing-skipped-entries-in-active-context"></a>

## Ver as entradas puladas no Active Context

1. Abra **Chat Settings**.
2. Expanda **Active Context** (contexto ativo). A seção mostra a varredura de lorebooks mais recente.

Se entradas correspondentes foram puladas, um aviso no topo diz "N matching lore entries were skipped by token budget." Ele indica cada orçamento que pulou entradas e onde alterá-lo. Expanda o aviso para ver cada entrada pulada, o lorebook dela, as palavras-chave correspondentes, o tamanho estimado e quanto do orçamento já tinha sido usado. O motivo é um destes.

| Motivo | Significado |
| --- | --- |
| **lorebook budget** | A entrada não coube no **Token Budget** daquele lorebook. |
| **chat budget** | A entrada não coube no **Lorebook Token Budget** do chat. |
| **lorebook and chat budgets** | Os dois limites já estavam cheios. |
| **current-location context cap** | A entrada está vinculada ao local atual do mapa, que tem um limite próprio e fixo de 2.048 tokens. |

Uma entrada com texto vazio, ou com um texto que as macros transformam em nada, não aparece na lista. As macros dela continuam rodando; assim, um `{{setvar}}` nela ainda define a variável. Com os dois orçamentos em 0, só o limite do local pode listar entradas puladas.

Se lorebooks grandes continuarem sendo pulados, **Active Context** sugere os agentes **Knowledge Retrieval** ou **Knowledge Router**. Veja [Fontes de conhecimento](../agents/knowledge-sources.md). Esses agentes costumam servir melhor para lorebooks grandes do que um limite maior.

## Varredura recursiva

Normalmente Marinara procura as chaves só nas suas mensagens recentes. Com **Recursive** ativado, Marinara também analisa o texto das entradas que acabaram de ser ativadas. Assim, uma entrada consegue puxar entradas relacionadas.

1. Abra o lorebook e clique em **Overview**.
2. Ative **Recursive**. Ele vem desativado por padrão.
3. Defina **Max Depth** (profundidade máxima) se quiser mudar até onde vai o encadeamento.

**Max Depth** é o número de passagens extras de varredura. O padrão é 3, e o valor vai de 1 a 10. Valores maiores encontram mais lore conectada e usam mais processamento.

Cada entrada também tem o próprio botão liga/desliga **Recursion** (recursão), desativado por padrão, que define se o conteúdo daquela entrada pode acionar outras entradas. Deixe-o desativado, a menos que a entrada deva se encadear. Veja [Entradas de lorebook: chaves, posição e momento de acionar](entries.md).

A recursão não escapa dos orçamentos. As entradas encontradas em uma passagem recursiva contam no **Token Budget**, no **Entry Limit** e no **Lorebook Token Budget** do chat.

## Guias relacionados

- [Entradas de lorebook: chaves, posição e momento de acionar](entries.md)
- [Visão geral dos lorebooks](overview.md)
- [Fontes de conhecimento: agentes Retrieval e Router](../agents/knowledge-sources.md)
