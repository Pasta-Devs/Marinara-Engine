# Como gerenciar a lista de chats

Este guia explica a lista de chats no Marinara Engine. Aqui você vê para que servem as três abas de modo e como criar, importar, renomear, excluir, organizar, buscar e gerenciar chats em lote. O guia também cobre a linha de chats recentes da tela inicial.

## A lista de chats e as abas de modo

Os chats ficam no painel **Chats**, a barra lateral da esquerda. No topo do painel ficam três abas de modo:

- **CONVO**, de Conversation: um chat simples, no estilo de aplicativo de mensagens.
- **RP**, de Roleplay: uma cena imersiva, com personagens e acompanhamento do mundo.
- **GM**, de Game: um RPG para um jogador só, conduzido pela IA.

Cada aba mostra apenas os chats daquele modo. Ao clicar em uma aba, a lista muda.

Cada linha da lista mostra o nome do chat e o avatar do personagem ou dos personagens. Nos chats de Conversation, um pontinho colorido no avatar indica o status de cada personagem. Quando aparece um selo vermelho na linha, ele traz a quantidade de mensagens não lidas.

Algumas linhas mostram um pequeno ícone de ramificação com um número. Isso quer dizer que o chat tem mais de uma ramificação, e que as ramificações estão agrupadas em uma linha só. Para entender o que são as ramificações, veja [Ramificações de chat](branches.md).

## Como criar um chat

1. Escolha a aba de modo que você quer (**CONVO**, **RP** ou **GM**).
2. Clique no botão **+**, perto do topo do painel. A dica dele diz **New Conversation**, **New Roleplay** ou **New Game**, conforme a aba ativa.
3. O aplicativo cria o chat, abre ele e abre também o painel **Chat Settings** (configurações do chat) e um assistente de configuração, para você terminar a preparação.

O chat novo recebe o nome **New Conversation**, **New Roleplay** ou **New Game**. Renomeie ele quando quiser (veja "Como renomear um chat", mais abaixo).

É preciso ter pelo menos uma conexão para que um chat abra. A conexão liga Marinara a um provedor de IA. Se ainda não houver nenhuma conexão, no lugar do chat aparece a janela **Set Up** (configurar). Ela pede que você escolha uma conexão primeiro. Se não existir nenhuma, ela mostra **No connections found** e um botão **Open Connections**. Para criar uma conexão, veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

Se você salvou um perfil de configurações padrão marcado com estrela para aquele modo, Marinara aplica ele ao chat novo automaticamente. Veja [Visão geral do painel Chat Settings](chat-settings.md).

## Como importar um chat

Você pode importar um registro de chat salvo como arquivo `.jsonl`, vindo do SillyTavern ou do Marinara.

1. Escolha a aba de modo em que o chat importado deve entrar.
2. Clique no botão **Import** (importar), perto do topo do painel. A dica dele diz **Import SillyTavern or Marinara chat JSONL**.
3. Escolha o arquivo `.jsonl`.

Marinara cria um chat novo no modo da aba atual e abre ele. Deve aparecer uma mensagem com o texto **Imported N messages**, em que N é a quantidade de mensagens.

Para conhecer todas as formas de importar e exportar chats, incluindo a importação em lote e os formatos de exportação, veja [Exportar e importar chats](export-import.md).

## Como renomear um chat

O nome do chat é visível só para você. Ele não é enviado para a IA e não muda a conversa.

1. Abra o chat.
2. Abra **Chat Settings** pelo botão no chat.
3. Na seção **Chat Name**, clique no nome atual para transformar ele em uma caixa de texto.
4. Digite o nome novo e pressione Enter ou clique no botão de marca de seleção.

Para saber mais sobre o painel Chat Settings, veja [Visão geral do painel Chat Settings](chat-settings.md).

## Como excluir um chat

Para excluir um chat só, passe o mouse sobre a linha dele e clique no botão de lixeira. No celular, o botão de lixeira fica sempre visível. Uma caixa de diálogo chamada **Delete Chat** pergunta "Delete this chat?". Clique em **Delete** para confirmar.

A exclusão de um chat é definitiva. Ela também interrompe qualquer resposta que ainda esteja sendo gerada para aquele chat.

### A caixa de diálogo de escolha da ramificação

Se o chat que você exclui tem mais de uma ramificação, abre uma janela diferente. Ela se chama **Delete Chat** e avisa que a conversa tem várias ramificações. Ela oferece duas opções:

- **Delete This Branch Only** remove apenas a ramificação em que você clicou.
- **Delete All N Branches** remove todas as ramificações do grupo, em que N é a quantidade de ramificações.

Para gerenciar as ramificações sem excluir o chat inteiro, veja [Ramificações de chat](branches.md).

### Como ativar ou desativar a confirmação de exclusão

Uma configuração geral do aplicativo, chamada **Confirm before deleting**, controla se essas caixas de diálogo de confirmação aparecem. Ela vem ativada por padrão e fica em **Settings** (Configurações), na aba **General**. O próprio texto de ajuda dela recomenda deixar ativada.

## Pastas de chats

Dentro de cada aba de modo, os chats podem ser agrupados em pastas.

1. Verifique se a aba atual tem pelo menos um chat. O botão **New Folder** (nova pasta) só aparece acima da lista nesse caso.
2. Clique em **New Folder**. A pasta é criada com o nome **unnamed** (ou **unnamed 2**, **unnamed 3** e assim por diante, se esse nome já estiver em uso).

Para renomear uma pasta, dê um clique duplo nela, um toque duplo, ou coloque o foco nela e pressione F2. Renomear para um nome vazio não tem efeito.

Para excluir uma pasta, clique no botão de lixeira na linha dela. Uma caixa de diálogo chamada **Delete Folder** pede a confirmação. Excluir uma pasta nunca exclui os chats que estão dentro dela. Esses chats voltam para o nível principal.

Para reordenar as pastas, arraste elas para cima ou para baixo pela alça de arrastar.

Para mover um chat para dentro de uma pasta, arraste a linha dele até a pasta. Para tirar um chat de todas as pastas, arraste ele até a área vazia abaixo das pastas. Em tela sensível ao toque, pressione e segure um chat por cerca de meio segundo para começar a arrastar. Se você tiver vários chats selecionados, arrastar um deles move a seleção inteira.

Os chats que não estão em nenhuma pasta aparecem em uma lista simples, abaixo das pastas.

## Busca, ordenação e filtro por tag

Cada aba de modo tem a própria caixa de busca no topo da lista. O texto de exemplo muda conforme a aba: **Search conversations...**, **Search roleplays...** ou **Search games...**. A busca considera o nome do chat, as tags e os nomes dos personagens. Ela não procura dentro do texto das mensagens.

Ao lado da caixa de busca fica um menu de ordenação, com a dica **Sort chats**. Ele tem quatro opções:

- **Newest**, o padrão, mostra primeiro os chats com atividade mais recente.
- **Oldest** mostra primeiro os de atividade mais antiga.
- **A-Z** ordena por nome, de A a Z.
- **Z-A** ordena por nome, de Z a A.

Se algum chat da aba tiver tags, aparece uma linha de filtro por tag. Clique no chip **Tags** para abrir a lista de tags. Depois clique em uma tag para ver só os chats que a têm. Clique em **Clear** para tirar o filtro. Quando há muitas tags, um chip **+N more** mostra as restantes.

Observação: esta tela filtra apenas pelas tags que o chat já tem. Não existe aqui um botão para adicionar uma tag a um chat.

A lista mostra até 100 chats por vez. Se você tiver mais, um botão **Load more** aparece no fim para exibir o próximo lote.

## Como selecionar vários chats

Você pode agir sobre vários chats de uma vez.

1. Clique no botão **Select chats** (selecionar chats), perto do topo do painel (o ícone de marca de seleção).
2. Clique em cada chat que você quer. Em vez de abrir o chat, uma caixa de seleção é marcada em cada linha escolhida.
3. Uma barra no rodapé mostra quantos chats estão selecionados, com dois botões.

O botão **Export** (exportar) baixa todos os chats selecionados juntos, em um único arquivo `.zip`. O botão **Delete** remove eles. Antes disso, o Delete mostra uma confirmação chamada **Delete Chats**.

Para sair do modo de seleção sem fazer nada, clique de novo no botão de seleção. Trocar de aba também limpa a seleção.

## Recent Chats na tela inicial

A tela inicial mostra uma linha compacta **Recent Chats** (chats recentes) com os três chats de atividade mais recente. Cada chat aparece como um pequeno chip, com avatar, selo do modo e nome do chat. Clique em um chip para abrir aquele chat. Se você ainda não tiver nenhum chat, a linha mostra **No chats yet**.

## Guias relacionados

- [Ramificações de chat](branches.md)
- [Exportar e importar chats](export-import.md)
- [Visão geral do painel Chat Settings](chat-settings.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
