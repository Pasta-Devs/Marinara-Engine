# Orçamento de tokens e recursão em lorebooks

Este guia explica como Marinara Engine limita a quantidade de texto de lorebook que chega à IA. Aqui você vê o campo **Token Budget** (orçamento de tokens) e o campo **Entry Limit** (limite de entradas) de cada lorebook, além do campo **Lorebook Token Budget**, que vale para o chat inteiro. O guia também mostra como Marinara corta entradas quando o orçamento acaba e o que faz a varredura **Recursive** (recursiva).

Um token é um pedacinho de texto, mais ou menos alguns caracteres. Todo modelo tem uma janela de contexto limitada, ou seja, um total máximo de texto que ele consegue ler de uma vez. O orçamento evita que os lorebooks ocupem essa janela toda e espremam a conversa de verdade.

## Dois orçamentos de tokens

Marinara aplica dois orçamentos de tokens separados sempre que monta um prompt. Se uma entrada estourar qualquer um dos dois, Marinara pula essa entrada.

1. Cada lorebook tem o próprio campo **Token Budget**. Ele limita quanto texto aquele lorebook pode acrescentar por resposta.
2. O chat tem um único campo **Lorebook Token Budget**. Ele limita o texto somado de todos os lorebooks ativos naquele chat.

Os dois limites valem ao mesmo tempo. Uma entrada pode ser barrada pelo orçamento do lorebook, pelo orçamento do chat ou pelos dois.

## Definir o Token Budget e o Entry Limit de um lorebook

Abra um lorebook pelo painel **Lorebooks** e vá até a aba **Overview** (visão geral). Perto das configurações de varredura ficam dois campos numéricos.

- **Token Budget** (padrão **2048**): o máximo de tokens que este lorebook pode acrescentar em uma resposta. Use **0** para não ter limite.
- **Entry Limit** (padrão **100**): o máximo de entradas que este lorebook pode acrescentar em uma resposta. O valor vai de **1** a **1000**.

O campo **Entry Limit** é um limite à parte do orçamento de tokens. Ele conta entradas, não tokens. Mesmo com espaço no orçamento de tokens, o lorebook para de acrescentar entradas ao chegar nesse limite. E o orçamento de tokens continua podendo pular entradas mesmo que o lorebook ainda esteja abaixo do **Entry Limit**.

Veja um exemplo: um lorebook com **Token Budget** de **2048** e uma entrada de 3000 tokens. Esse lorebook nunca consegue acrescentar a entrada. Diminua o orçamento só quando um lorebook estiver ocupando espaço demais. Aumente quando entradas importantes forem puladas com frequência.

## O Lorebook Token Budget do chat inteiro

O limite do chat fica no painel lateral **Settings** (Configurações) do chat, na seção **Lorebooks**.

1. Abra um chat.
2. Abra o painel lateral **Settings** do chat.
3. Localize a seção **Lorebooks**.
4. Preencha o campo **Lorebook Token Budget**.

O padrão é **8192**. Use **0** para não ter limite. Esse orçamento é o total para todos os lorebooks ativos neste chat. Ele vale além do campo **Token Budget** de cada lorebook.

## Como as entradas são cortadas

Quando o número de entradas correspondentes passa do que o orçamento permite, Marinara mantém as mais importantes e descarta o resto. Antes de cortar, Marinara ordena as entradas para que as mais prováveis de serem úteis sobrevivam.

- As entradas **Constant** (constantes) vêm primeiro. São as entradas configuradas para entrar sempre que o lorebook estiver ativo.
- Depois vêm as entradas que corresponderam à mensagem mais recente.
- As demais seguem na ordem normal de inserção.

Marinara percorre essa lista e acrescenta cada entrada que ainda couber. Se uma entrada estourar um orçamento, Marinara pula essa entrada e segue em frente. Mesmo assim, todas as entradas abaixo da pulada continuam sendo verificadas. Ou seja, uma entrada menor ainda pode entrar depois que Marinara pulou uma maior.

<a id="seeing-skipped-entries-in-active-context"></a>

## Ver as entradas puladas no Active Context

Não é preciso adivinhar quais entradas ficaram de fora. Abra **Chat Settings** e expanda **Active Context** (contexto ativo). A seção mostra o resultado ao vivo da varredura de lorebooks mais recente.

Quando alguma entrada correspondente é pulada, um aviso âmbar aparece no topo. Ele diz "N matching lore entries were skipped by token budget." Expanda o aviso para ver cada entrada pulada.

Cada entrada pulada informa de qual lorebook veio e por que foi barrada. O motivo é um destes:

- **lorebook budget**: a entrada não coube no campo **Token Budget** daquele lorebook.
- **chat budget**: a entrada não coube no campo **Lorebook Token Budget** do chat inteiro.
- **lorebook and chat budgets**: os dois limites já estavam cheios.

Expanda uma entrada pulada para ver mais detalhes. Ela mostra as palavras-chave correspondentes, o tamanho estimado em tokens e quanto do orçamento já tinha sido usado. Se lorebooks grandes forem pulados com frequência, **Active Context** sugere os agentes **Knowledge Retrieval** ou **Knowledge Router**. Costumam lidar melhor com lorebooks grandes do que aumentar os limites.

## Varredura recursiva

Normalmente Marinara procura correspondências de palavras-chave só nas mensagens recentes. Com a varredura **Recursive** ativada, Marinara também analisa o texto das entradas que acabaram de ser ativadas. Assim, uma entrada ativada consegue puxar entradas relacionadas cujas palavras-chave aparecem no texto dela.

Ative a opção na aba **Overview** do lorebook.

1. Abra o lorebook.
2. Abra a aba **Overview**.
3. Ative o botão liga/desliga **Recursive**. Ele vem desativado por padrão.
4. Ajuste o campo **Max Depth** se quiser mudar até onde vai o encadeamento.

O campo **Max Depth** (padrão **3**) define quantas varreduras extras acontecem. Cada passagem procura novas correspondências de palavras-chave nas entradas recém-ativadas. O valor vai de **1** a **10**. Valores maiores encontram mais lore conectada, mas exigem mais processamento.

A recursão também precisa ser ativada entrada por entrada. No painel lateral expandido de uma entrada, o botão liga/desliga **Recursion** define se o conteúdo daquela entrada pode acionar outras entradas. Ele vem desativado por padrão. Deixe assim, a menos que essa entrada deva se encadear com outra lore. Veja [Entradas de lorebook: chaves, posição e momento](entries.md) para conhecer todos os controles de entrada.

A recursão não escapa dos orçamentos. As entradas encontradas em uma passagem recursiva também contam no **Token Budget**, no **Entry Limit** e no **Lorebook Token Budget** do chat inteiro, como qualquer outra entrada.

## Guias relacionados

- [Entradas de lorebook: chaves, posição e momento](entries.md)
- [Visão geral dos lorebooks](overview.md)
- [Fontes de conhecimento: agentes Retrieval e Router](../agents/knowledge-sources.md)
