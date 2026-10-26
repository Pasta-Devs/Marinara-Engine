# Ramificações de chat

Este guia explica as ramificações de chat no Marinara Engine: o que é uma ramificação e como criar uma. Você também vê como trocar de ramificação, visualizar o gráfico de ramificações, renomear, excluir, exportar e importar. Com uma ramificação, você testa um caminho diferente dentro do chat sem perder o original.

## O que é uma ramificação

Uma ramificação é uma cópia do chat que compartilha o histórico até um ponto escolhido. Use as ramificações para explorar outra direção e, ao mesmo tempo, manter o chat original intacto.

Todas as ramificações de um mesmo chat ficam agrupadas. Na lista de chats, o chat mantém a linha dele e mostra um contador de ramificações. Assim que pelo menos uma ramificação do grupo registra de qual chat do grupo foi criada, clicar no contador abre as ramificações abaixo dele; uma ramificação de origem desconhecida fica diretamente abaixo do chat. As sessões Game são sessões numeradas em vez de ramificações, então um grupo Game sempre mantém uma única linha. Cada ramificação mostra o nome de exibição e quando esteve ativa pela última vez. Uma ramificação criada de outra fica aninhada abaixo dela, então as ramificações de ramificações aparecem como uma árvore, em vez de uma lista plana. Você pode passar direto para uma ramificação pela lista ou usar a seção **Chat Branches** (ramificações do chat) de **Chat Settings** (veja abaixo) para renomeá-las, excluí-las, exportá-las ou importá-las.

Cada ramificação pode ter o próprio nome de exibição, então você consegue rotulá-las como "final feliz" e "final sombrio". Esse nome de exibição é independente do nome do chat que está por trás.

A linhagem de uma ramificação registra o chat de origem imediato e a mensagem em que ela foi criada. O ID da mensagem de origem e o da cópia são mantidos; assim, integrações podem identificar o ponto da ramificação mesmo que as mensagens copiadas recebam novos IDs. Ramificar uma ramificação registra essa ramificação como origem imediata, não a raiz original. Ramificações antigas e irmãs importadas mantêm o nome de exibição, mas não têm linhagem conhecida: um grupo sem linhagem conhecida mantém uma única linha na lista de chats, e suas ramificações continuam acessíveis pela seção **Chat Branches**.

## Ramificar a partir daqui

A ramificação é criada a partir de qualquer mensagem do chat.

1. Passe o mouse sobre uma mensagem (ou toque nela no celular) para exibir a barra de ações da mensagem.
2. Clique no botão **Branch from here** (ramificar a partir daqui). Ele usa um ícone pequeno de ramificação.

Marinara copia o chat até aquela mensagem, incluindo ela, para uma nova ramificação. A nova ramificação:

- Mantém o mesmo modo, personagens, persona, preset de prompt e conexão do chat de origem.
- Copia todas as mensagens, inclusive todos os swipes (respostas alternativas) e qual swipe estava ativo. Veja o guia [Ações de mensagem](messages.md) para entender como os swipes funcionam.
- Copia os instantâneos de tracker e de estado do jogo ligados às mensagens copiadas, então os chats de Roleplay e de Game Mode preservam o estado.
- Mantém o trabalho do Advanced Memory em um chat de Roleplay, para você não precisar preparar de novo o histórico copiado. As memórias de cenas anteriores já concluídas continuam prontas para serem lembradas. A cena a partir da qual você ramifica volta a ser a cena em andamento, e as memórias antigas dela são descartadas. Veja [Memory Recall e resumos do chat](../agents/memory.md).
- Começa com o nome de exibição **New Branch**. Você pode renomeá-la (veja abaixo).
- Fica na mesma pasta de chats do chat de origem.

Um chat vazio tem âncoras de mensagem nulas. Excluir um chat de origem não muda a linhagem histórica de seus filhos. Excluir todo o grupo de ramificações continua excluindo todos os chats do grupo.

Os resumos diários e semanais não são levados junto. Os resumos contínuos com intervalos de mensagens persistidos totalmente contidos na ramificação copiada são levados junto e remapeados para os novos IDs de mensagem da ramificação. Os resumos cujo intervalo de origem cruza o ponto de ramificação, ou os resumos antigos sem metadados de mensagens, são deixados de fora. A nova ramificação começa esses resumos do zero.

Não é possível ramificar um chat de cena. Nesse tipo de chat, o botão **Branch from here** não aparece. Os chats de cena têm uma ação própria, a **Clone from here** (clonar a partir daqui). Veja [Cenas: criando uma ramificação do roleplay](../roleplay/scenes.md) para saber como ela funciona.

## A seção Chat Branches

Abra **Chat Settings** e expanda **Chat Branches**, abaixo de **Chat Name**. O cabeçalho mostra o número atual de ramificações. No computador, você pode destacá-la em uma janela própria; veja [Visão geral de Chat Settings](chat-settings.md#popping-a-section-out-into-its-own-window).

A seção lista todas as ramificações do chat atual, com a que você está vendo em primeiro lugar. Cada linha mostra o nome da ramificação e a hora da última atualização.

### Trocar para outra ramificação

Clique na linha de uma ramificação para abri-la. A tela do chat passa para a ramificação escolhida.

<a id="see-the-branch-graph"></a>

### Ver o gráfico de ramificações

O gráfico de ramificações mostra onde cada ramificação se separou, algo que a lista não mostra.

1. Abra a seção **Chat Branches**.
2. Clique no botão **Branch graph** (gráfico de ramificações), o botão comprido acima dos botões de exportação. Clique nele de novo para fechar o gráfico.

O gráfico abre em uma janela própria, que você pode mover e redimensionar. No celular, abre como um painel. O gráfico preenche a janela: uma janela maior recolhe menos trechos, e um gráfico com espaço de sobra aumenta e se espalha. Um gráfico um pouco largo demais encolhe para caber, até três quartos do tamanho, e passa a rolar para os lados além disso. As linhas dividem a altura da janela e rolam quando há chats demais para caber.

- Cada chat do grupo ganha uma linha, na mesma ordem de árvore da lista de chats. As mensagens seguem da esquerda para a direita, um ponto por mensagem. Pontos cinza são suas mensagens, pontos na cor de destaque são respostas dos personagens e círculos vazados são mensagens do narrador ou do sistema.
- Uma ramificação desenha apenas as próprias mensagens. Uma linha a liga à mensagem de onde foi criada, então você vê exatamente onde ela se separou.
- Ramificações antigas e ramificações cujo chat de origem foi excluído não têm ponto de separação registrado. Elas são desenhadas a partir do chat do topo, com uma linha tracejada, e a legenda mostra **Fork not recorded** (ponto de ramificação não registrado).
- Trechos longos sem uma ramificação por perto são recolhidos em um marcador **··· N ···**, em que N é o número de mensagens ocultas. Clique nele para mostrar essas mensagens ou use **Expand all** (expandir tudo) para abrir todos os trechos. **Collapse long runs** (recolher trechos longos) os recolhe de novo.
- Os pontos de separação e a mensagem mais recente de cada ramificação têm um círculo. Passe o ponteiro sobre ele, toque nele ou coloque o foco nele com o teclado para ver o número da mensagem, quem a escreveu e o começo do texto.
- Clique no nome ou na linha de uma ramificação para passar para ela. A ramificação que você está vendo fica destacada, e o gráfico abre com a rolagem na mensagem mais recente dela.

O gráfico se atualiza quando você cria uma ramificação, renomeia ou exclui um chat e logo depois que novas mensagens chegam.

### Renomear uma ramificação

1. Abra a seção **Chat Branches**.
2. Clique no botão de lápis (renomear) na linha da ramificação que você quer renomear.
3. Abre-se uma caixa de diálogo chamada **Rename Branch**, com a mensagem "Set a display name for this chat branch."
4. Digite um nome novo e confirme no botão **Rename**.

Um nome vazio, ou um nome que você não alterou, é ignorado.

### Excluir uma ramificação

1. Abra a seção **Chat Branches**.
2. Clique no botão de lixeira (excluir) na linha da ramificação.
3. Uma caixa de diálogo chamada **Delete Branch** pergunta "Delete this branch? Messages will be lost."
4. Confirme no botão **Delete**.

Ao excluir uma ramificação, só ela e as mensagens dela somem. As outras ramificações continuam lá.

### Excluir todas as ramificações

Quando um chat tem duas ou mais ramificações, um botão **Delete All Branches** (excluir todas as ramificações) aparece na parte de baixo da seção. Ele pergunta "Delete all N branches? This cannot be undone." Confirme no botão **Delete All** para remover de uma vez todas as ramificações do grupo.

Isso também pode ser feito pela lista de chats. Exclua um chat com ramificações pelo ícone de lixeira dele. Uma caixa de diálogo chamada **Delete Chat** pergunta então o que você quer excluir. Ela oferece o botão **Delete This Branch Only** e o botão **Delete All N Branches**. Veja [Gerenciar a lista de chats](managing-chats.md) para mais detalhes sobre excluir pela lista.

## Exportar uma ramificação

A seção **Chat Branches** tem botões de exportação na parte de cima. Eles exportam a ramificação que você está vendo no momento.

- **JSONL**: baixa a ramificação como um arquivo JSONL. JSONL significa uma mensagem por linha de texto, e esse formato é compatível com SillyTavern.
- **Text**: baixa a ramificação como uma transcrição em texto simples.
- **Markdown** e **Story**: baixam a ramificação como um arquivo Markdown legível ou como uma página web estilizada. Veja [Formatos de arquivo que você vai encontrar](export-import.md#file-formats-you-will-see).

Para exportar vários chats de uma vez, veja [Exportar e importar chats](export-import.md). Esse guia também explica a opção de incluir o raciocínio do modelo nas exportações.

## Importar um arquivo JSONL como nova ramificação

Um registro de chat salvo pode entrar como nova ramificação do chat que você tem aberto.

1. Abra a seção **Chat Branches**.
2. Clique no botão **Import** (importar).
3. Escolha um arquivo JSONL (`.jsonl`) exportado do SillyTavern ou do Marinara.

Marinara acrescenta o arquivo como nova ramificação no grupo do chat atual. Uma mensagem parecida com "Imported N messages as a new branch" deve aparecer. Em seguida, o aplicativo passa para a nova ramificação.

## Guias relacionados

- [Ações de mensagem: editar, excluir, swipe e regenerar](messages.md)
- [Exportar e importar chats](export-import.md)
- [Gerenciar a lista de chats](managing-chats.md)
