# Ramificações de chat

Uma ramificação é uma cópia de um chat até uma mensagem. Use-a para testar um caminho diferente enquanto o original fica a salvo. Este guia mostra como criar, trocar, visualizar, renomear, excluir, exportar e importar ramificações.

Todas as ramificações de um chat ficam agrupadas. Na lista de chats, o chat mantém uma única linha e mostra um contador de ramificações. Quando pelo menos uma ramificação do grupo registra de qual chat veio, clique no contador para abrir a árvore; uma ramificação sem esse registro fica diretamente abaixo do chat. Se nenhuma ramificação do grupo tem o registro (ramificações antigas ou importadas), o grupo continua em uma só linha; abra as ramificações dele em **Chat Branches** (ramificações do chat). Uma ramificação criada a partir de outra ramificação fica aninhada abaixo dela, então você vê uma árvore. Cada ramificação tem um nome de exibição e a hora em que esteve ativa pela última vez, então você pode rotulá-las como "final feliz" e "final sombrio". O nome de exibição é independente do nome do chat. Um grupo de Game mantém uma só linha, porque as sessões de Game são sessões numeradas, não ramificações.

## Ramificar a partir daqui

1. Toque na mensagem (no computador, aponte o mouse para ela) para mostrar a barra de ações da mensagem.
2. Clique em **Branch from here** (ramificar a partir daqui), o pequeno ícone de ramificação.

Marinara copia o chat até aquela mensagem, incluindo ela, para uma nova ramificação chamada **New Branch**. Você pode renomeá-la depois.

A ramificação:

- Mantém o mesmo modo, os mesmos personagens, a persona, o preset de prompt e a conexão.
- Copia todas as mensagens, com todos os swipes e a informação de qual swipe estava ativo. Veja [Ações de mensagem](messages.md).
- Copia o estado de tracker e de jogo ligado às mensagens copiadas.
- Mantém o trabalho do Advanced Memory em um chat de Roleplay. As memórias de cenas anteriores já concluídas continuam prontas para serem lembradas. A cena a partir da qual você ramifica volta a ser a cena em andamento, e as memórias antigas dela são descartadas. Veja [Memory Recall e resumos do chat](../agents/memory.md).
- Fica na mesma pasta de chats que o chat de origem.

Os resumos diários e semanais não são levados junto. Os resumos contínuos que ficam totalmente dentro das mensagens copiadas são levados junto. Os resumos que cruzam o ponto da ramificação, e os resumos antigos sem dados de mensagem, ficam de fora, e a ramificação começa esses resumos do zero.

Se não funcionou: **Branch from here** não aparece em um chat de cena. Os chats de cena têm **Clone from here** (clonar a partir daqui) no lugar. Veja [Cenas: criando uma ramificação do roleplay](../roleplay/scenes.md).

## A seção Chat Branches

Abra **Chat Settings** (configurações do chat) e expanda **Chat Branches**, abaixo de **Chat Name** (nome do chat). O cabeçalho da seção mostra o número de ramificações. No computador, você pode destacá-la em uma janela própria. Veja [Chat Settings](chat-settings.md#popping-a-section-out-into-its-own-window).

A seção lista todas as ramificações do chat, com a que você está vendo em primeiro lugar. Cada linha mostra o nome de exibição e a hora da última atualização. Clique em uma linha para trocar para aquela ramificação.

Botões acima da lista:

| Botão | O que faz |
| --- | --- |
| **Branch graph** (gráfico de ramificações) | Abre a janela do gráfico. Veja abaixo. |
| **JSONL**, **Text** (texto), **Markdown**, **Story** (história) | Exportam a ramificação que você está vendo. Veja [Exportar e importar chats](export-import.md). |
| **Export a range** (exportar um intervalo) | Exporta uma parte do chat. Não aparece no Game. Veja [Exportar e importar chats](export-import.md#export-part-of-a-chat). |
| **Import** (importar) | Adiciona um arquivo `.jsonl` como nova ramificação. Veja abaixo. |
| **Stats** (estatísticas) | Abre as estatísticas do chat para a ramificação que você está vendo. |

<a id="see-the-branch-graph"></a>

### Ver o gráfico de ramificações

O gráfico mostra onde cada ramificação se separou, algo que a lista não mostra.

1. Abra **Chat Branches** e clique em **Branch graph**. Clique nele de novo para fechar o gráfico.

O gráfico abre em uma janela própria, que você pode mover e redimensionar. No celular, ele abre como um painel. Cada chat do grupo ganha uma linha, na mesma ordem da lista de chats. As mensagens seguem da esquerda para a direita, um ponto por mensagem.

- Pontos cinza são as suas mensagens, pontos na cor de destaque são respostas dos personagens e círculos vazados são mensagens do narrador ou do sistema.
- Uma ramificação desenha apenas as próprias mensagens. Uma linha a liga à mensagem a partir da qual ela foi criada.
- Uma ramificação sem ponto de separação registrado é desenhada a partir do chat do topo, com uma linha tracejada, e a legenda mostra **Fork not recorded** (ponto de ramificação não registrado). Isso vale para ramificações antigas e para ramificações cujo chat de origem foi excluído.
- Trechos longos sem nenhuma separação são recolhidos em um marcador **··· N ···**, em que N é o número de mensagens ocultas. Clique nele para mostrá-las. **Expand all** (expandir tudo) abre todos os trechos, e **Collapse long runs** (recolher trechos longos) os recolhe de novo.
- Os pontos de separação e a mensagem mais recente de cada ramificação têm um círculo. Toque nele, aponte o mouse para ele ou coloque o foco nele com o teclado para ver o número da mensagem, quem a escreveu e o começo do texto.
- Clique no nome ou na linha de uma ramificação para trocar para ela. A ramificação que você está vendo fica destacada.

O gráfico se atualiza quando você cria uma ramificação, renomeia ou exclui um chat, e logo depois que novas mensagens chegam.

### Renomear uma ramificação

1. Em **Chat Branches**, clique no botão de lápis na linha da ramificação.
2. Na caixa de diálogo **Rename Branch** (renomear ramificação), com o texto "Set a display name for this chat branch.", digite um nome novo.
3. Clique em **Rename** (renomear).

Um nome vazio ou não alterado é ignorado.

### Excluir uma ramificação

1. Em **Chat Branches**, clique no botão de lixeira na linha da ramificação.
2. Na caixa de diálogo **Delete Branch** (excluir ramificação), que pergunta "Delete this branch? Messages will be lost.", clique em **Delete** (excluir).

Isso remove apenas essa ramificação e as mensagens dela. As outras ramificações continuam lá.

Com duas ou mais ramificações, **Delete All Branches** (excluir todas as ramificações) aparece na parte de baixo da seção. Ele pergunta "Delete all N branches? This cannot be undone." Confirme com **Delete All** (excluir tudo). Você também pode começar pela lista de chats, em que excluir um chat com ramificações oferece **Delete This Branch Only** (excluir só esta ramificação) e **Delete All N branches** (excluir todas as N ramificações). Veja [Como gerenciar a lista de chats](managing-chats.md#delete-a-chat).

### Importar um arquivo como nova ramificação

1. Em **Chat Branches**, clique em **Import**.
2. Escolha um arquivo `.jsonl` exportado do SillyTavern ou do Marinara.

Marinara adiciona o arquivo como nova ramificação no grupo do chat atual, mostra "Imported N messages as a new branch" e troca para essa ramificação.

## Como as ramificações são ligadas

Esta seção é para quem desenvolve sobre os dados das ramificações.

- Cada ramificação registra o chat de origem imediato e a mensagem em que a ramificação foi criada. Tanto o ID da mensagem de origem quanto o ID da cópia dela são mantidos, então as integrações conseguem encontrar o limite da ramificação mesmo que as mensagens copiadas recebam novos IDs.
- Ramificar uma ramificação registra essa ramificação como a ramificação pai, não a raiz original.
- Assim que pelo menos uma ramificação de um grupo registra a origem, clicar no contador na lista de chats abre a árvore. Uma ramificação de origem desconhecida fica diretamente abaixo do chat. Um grupo sem nenhuma origem conhecida mantém uma só linha, e as ramificações dele são acessadas por **Chat Branches**.
- Excluir um chat pai não muda a origem registrada dos filhos dele. Excluir o grupo inteiro exclui todos os chats do grupo.
