# Ramificações de chat

Este guia explica as ramificações de chat no Marinara Engine: o que é uma ramificação e como criar uma. Você também vê como trocar de ramificação, renomear, excluir, exportar e importar. Com uma ramificação, você testa um caminho diferente dentro do chat sem perder o original.

## O que é uma ramificação

Uma ramificação é uma cópia do chat que compartilha o histórico até um ponto escolhido. Use as ramificações para explorar outra direção e, ao mesmo tempo, manter o chat original intacto.

Todas as ramificações de um mesmo chat ficam agrupadas. Na lista de chats, um chat com mais de uma ramificação aparece como uma linha só. Ao lado dela fica um contador pequeno de ramificações. Para abrir e alternar entre elas, use a janela **Chat Branches** (ramificações do chat), explicada abaixo.

Cada ramificação pode ter o próprio nome de exibição, então você consegue rotulá-las como "final feliz" e "final sombrio". Esse nome de exibição é independente do nome do chat que está por trás.

## Ramificar a partir daqui

A ramificação é criada a partir de qualquer mensagem do chat.

1. Passe o mouse sobre uma mensagem (ou toque nela no celular) para exibir a barra de ações da mensagem.
2. Clique no botão **Branch from here** (ramificar a partir daqui). Ele usa um ícone pequeno de ramificação.

Marinara copia o chat até aquela mensagem, incluindo ela, para uma nova ramificação. A nova ramificação:

- Mantém o mesmo modo, personagens, persona, preset de prompt e conexão do chat de origem.
- Copia todas as mensagens, inclusive todos os swipes (respostas alternativas) e qual swipe estava ativo. Veja o guia [Ações de mensagem](messages.md) para entender como os swipes funcionam.
- Copia os instantâneos de tracker e de estado do jogo ligados às mensagens copiadas, então os chats de Roleplay e de Game Mode preservam o estado.
- Começa com o nome de exibição **New Branch**. Você pode renomeá-la (veja abaixo).
- Fica na mesma pasta de chats do chat de origem.

Os resumos diários e semanais não são levados junto. Os resumos contínuos com intervalos de mensagens persistidos totalmente contidos na ramificação copiada são levados junto e remapeados para os novos IDs de mensagem da ramificação. Os resumos cujo intervalo de origem cruza o ponto de ramificação, ou os resumos antigos sem metadados de mensagens, são deixados de fora. A nova ramificação começa esses resumos do zero.

Não é possível ramificar um chat de cena. Nesse tipo de chat, o botão **Branch from here** não aparece. Os chats de cena têm uma ação própria, a **Clone from here** (clonar a partir daqui). Veja [Cenas: criando uma ramificação do roleplay](../roleplay/scenes.md) para saber como ela funciona.

## A janela Chat Branches

Abra a janela pelo botão de ramificação na barra de ferramentas do chat. O botão usa um ícone de ramificação e mostra o número atual de ramificações. A dica dele diz **Switch branch**.

A janela se chama **Chat Branches** e traz o subtítulo "Switch, import, export, or clean up this chat's branches." Ela lista todas as ramificações do chat atual, e a ramificação que você está vendo aparece em primeiro lugar. Cada linha mostra o nome de exibição da ramificação e a hora da última atualização.

### Trocar para outra ramificação

Clique em qualquer linha de ramificação na janela para abri-la. A janela se fecha e a tela do chat passa para a ramificação escolhida.

### Renomear uma ramificação

1. Abra a janela **Chat Branches**.
2. Clique no botão de lápis (renomear) na linha da ramificação que você quer renomear.
3. Abre-se uma caixa de diálogo chamada **Rename Branch**, com a mensagem "Set a display name for this chat branch."
4. Digite um nome novo e confirme no botão **Rename**.

Um nome vazio, ou um nome que você não alterou, é ignorado.

### Excluir uma ramificação

1. Abra a janela **Chat Branches**.
2. Clique no botão de lixeira (excluir) na linha da ramificação.
3. Uma caixa de diálogo chamada **Delete Branch** pergunta "Delete this branch? Messages will be lost."
4. Confirme no botão **Delete**.

Ao excluir uma ramificação, só ela e as mensagens dela somem. As outras ramificações continuam lá.

### Excluir todas as ramificações

Quando um chat tem duas ou mais ramificações, um botão **Delete All Branches** (excluir todas as ramificações) aparece na parte de baixo da janela. Ele pergunta "Delete all N branches? This cannot be undone." Confirme no botão **Delete All** para remover de uma vez todas as ramificações do grupo.

Isso também pode ser feito pela lista de chats. Exclua um chat com ramificações pelo ícone de lixeira dele. Uma caixa de diálogo chamada **Delete Chat** pergunta então o que você quer excluir. Ela oferece o botão **Delete This Branch Only** e o botão **Delete All N Branches**. Veja [Gerenciar a lista de chats](managing-chats.md) para mais detalhes sobre excluir pela lista.

## Exportar uma ramificação

A janela **Chat Branches** tem botões de exportação na parte de cima. Eles exportam a ramificação que você está vendo no momento.

- **JSONL**: baixa a ramificação como um arquivo JSONL. JSONL significa uma mensagem por linha de texto, e esse formato é compatível com SillyTavern.
- **Text**: baixa a ramificação como uma transcrição em texto simples.

Para exportar vários chats de uma vez, veja [Exportar e importar chats](export-import.md). Esse guia também explica a opção de incluir o raciocínio do modelo nas exportações.

## Importar um arquivo JSONL como nova ramificação

Um registro de chat salvo pode entrar como nova ramificação do chat que você tem aberto.

1. Abra a janela **Chat Branches**.
2. Clique no botão **Import** (importar).
3. Escolha um arquivo JSONL (`.jsonl`) exportado do SillyTavern ou do Marinara.

Marinara acrescenta o arquivo como nova ramificação no grupo do chat atual. Uma mensagem parecida com "Imported N messages as a new branch" deve aparecer. Em seguida, o aplicativo passa para a nova ramificação.

## Guias relacionados

- [Ações de mensagem: editar, excluir, swipe e regenerar](messages.md)
- [Exportar e importar chats](export-import.md)
- [Gerenciar a lista de chats](managing-chats.md)
