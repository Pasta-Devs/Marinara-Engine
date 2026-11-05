# Como gerenciar a lista de chats

O painel **Chats**, à esquerda, guarda todos os seus chats. Use-o para começar, encontrar, ordenar, organizar e excluir chats.

## A lista de chats e as abas de modo

No topo do painel há três abas de modo. Cada aba lista apenas os chats daquele modo.

| Aba | Modo |
| --- | --- |
| **CONVO** | Conversation: um chat no estilo de aplicativo de mensagens. |
| **RP** | Roleplay: uma cena com personagens e acompanhamento do mundo. |
| **GM** | Game: um RPG para um só jogador, conduzido pela IA. |

Cada linha mostra o nome do chat e os avatares dos personagens dele. Nos chats de Conversation, um ponto colorido em um avatar mostra o status daquele personagem. Um selo vermelho é a quantidade de mensagens não lidas. Uma linha com um pequeno ícone de ramificação e um número é um chat com várias ramificações, agrupadas em uma só linha. Veja [Ramificações de chat](branches.md).

## Começar um chat

Antes de começar: adicione pelo menos uma conta em **Connections** (Conexões). Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Clique na aba do modo que você quer.
2. Toque no botão **+** no topo do painel. O rótulo dele é **New Conversation**, **New Roleplay** ou **New Game**, conforme a aba.

Marinara cria e abre o chat. **Chat Settings** (configurações do chat) e um assistente de configuração abrem ao lado dele. O chat começa com o nome **New Conversation**, **New Roleplay** ou **New Game**. Se você salvou um perfil de configurações padrão marcado com estrela para Conversation ou Roleplay, Marinara o aplica ao chat novo. Veja [Perfis de configurações](settings-profiles.md).

Se não funcionou: sem nenhuma conta salva, a janela **Add account** (adicionar conta) abre no lugar de um chat. Escolha um serviço, clique em **Connect** (conectar) e depois escolha um modelo. O passo a passo completo está em [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

## Importar um chat

Você pode importar um registro de chat `.jsonl` do SillyTavern ou do Marinara.

1. Clique na aba do modo em que o chat deve entrar.
2. Toque no botão **Import** (importar) no topo do painel. O rótulo dele é **Import SillyTavern or Marinara chat JSONL**.
3. Escolha o seu arquivo `.jsonl`.

Marinara cria o chat, abre-o e mostra **Imported N messages**. Para os formatos de exportação e a exportação em lote, veja [Exportar e importar chats](export-import.md).

Se não funcionou: uma mensagem pequena na parte de baixo da tela diz **Import failed**, com o motivo. Só arquivos `.jsonl` são aceitos.

## Renomear um chat

O nome do chat é só para você. Ele não é enviado ao modelo.

1. Abra o chat e depois abra **Chat Settings**.
2. Em **Chat Name** (nome do chat), clique no nome atual.
3. Digite o nome novo e pressione <kbd>Enter</kbd> ou clique na marca de seleção.

Veja [Chat Settings](chat-settings.md) para saber como abrir o painel.

<a id="delete-a-chat"></a>

## Excluir um chat

1. Toque no botão de lixeira na linha do chat. No computador, ele aparece quando você aponta o mouse para a linha.
2. Na caixa de diálogo **Delete Chat** (excluir chat), clique em **Delete** (excluir).

A exclusão é definitiva. Ela também interrompe qualquer resposta que ainda esteja sendo escrita para aquele chat.

Se o chat tiver várias ramificações, a caixa de diálogo diz quantas são e oferece duas opções:

- **Delete This Branch Only** (excluir só esta ramificação) remove a ramificação em que você clicou.
- **Delete All N branches** (excluir todas as N ramificações) remove todas as ramificações do grupo.

Para gerenciar as ramificações sem excluir o chat, veja [Ramificações de chat](branches.md).

A configuração geral do aplicativo **Confirm before deleting** (confirmar antes de excluir) controla essas caixas de diálogo. Ela vem ativada por padrão e fica em **Settings → General** (Configurações → Geral).

## Pastas de chats

As pastas agrupam chats dentro de uma aba de modo.

1. Abra uma aba que tenha pelo menos um chat. Só então **New Folder** (nova pasta) aparece abaixo das abas.
2. Clique em **New Folder**. A pasta recebe o nome **unnamed** (depois **unnamed 2**, **unnamed 3**).

| Para fazer isto | Faça isto |
| --- | --- |
| Renomear uma pasta | Dê um clique duplo ou um toque duplo nela, ou coloque o foco nela e pressione <kbd>F2</kbd>. Um nome vazio é ignorado. |
| Excluir uma pasta | Clique no botão de lixeira na linha da pasta. Uma caixa de diálogo **Delete Folder** (excluir a pasta) aparece quando a pasta tem chats. Os chats vão para o nível principal e não são excluídos. |
| Reordenar as pastas | Arraste uma pasta para cima ou para baixo. O menu de ordenação passa para **Custom** (personalizado). |
| Mover um chat para uma pasta | Arraste a linha do chat até a pasta. Em tela sensível ao toque, primeiro pressione e segure o chat por cerca de meio segundo. |
| Tirar um chat de uma pasta | Arraste o chat até a área vazia abaixo das pastas. |

Com vários chats selecionados, arrastar um deles move a seleção inteira. Os chats que estão fora das pastas aparecem abaixo das pastas.

## Buscar, ordenar e filtrar

### Encontrar um chat pelo nome

Cada aba tem uma caixa de busca. O texto de exemplo dela é **Search conversations**, **Search roleplays** ou **Search games**. Digite uma palavra. A busca considera os nomes dos chats, as tags e os nomes dos personagens, não o texto das mensagens.

### Encontrar uma mensagem em todos os chats

1. Toque em **Search all chats** (buscar em todos os chats), o botão ao lado do menu de ordenação.
2. Digite as suas palavras.

A busca procura em todos os chats e pode filtrar por modo, personagem, remetente e data.

O menu de ordenação (**Sort chats**) tem estas opções:

| Opção | Ordem |
| --- | --- |
| **Custom** | A ordem das suas pastas. |
| **Manual order** (ordem manual) | Os chats na ordem em que você os arrasta. Pelo teclado, coloque o foco em um chat e pressione <kbd>Alt</kbd>+<kbd>Up</kbd> ou <kbd>Alt</kbd>+<kbd>Down</kbd>. |
| **Recent** (recentes) | A atividade mais recente primeiro. Este é o padrão. |
| **Newest** (mais novos) | Os criados mais recentemente primeiro. |
| **Oldest** (mais antigos) | Os mais antigos primeiro. |
| **A-Z** e **Z-A** | Por nome. |

Quando algum chat da aba tem uma tag, aparece um chip **Tags (N)**. Clique nele para expandir as tags e depois clique em uma tag para mostrar só os chats que a têm. Clique em **Clear** (limpar) para tirar o filtro. Este painel não consegue adicionar tags a um chat.

A lista mostra 100 chats por vez. Clique em **Load more** (carregar mais) para ver o próximo lote.

<a id="selecting-multiple-chats"></a>

## Como selecionar vários chats

1. Clique no botão de marca de seleção, **Select chats** (selecionar chats), no topo do painel.
2. Clique em cada chat que você quer. As linhas mostram uma caixa de seleção em vez de abrir o chat.
3. Use a barra na parte de baixo, que mostra quantos chats estão selecionados.

**Export** (exportar) baixa os chats selecionados como um único arquivo `.zip` com arquivos `.jsonl`. **Delete** pede a sua confirmação em uma caixa de diálogo **Delete Chats** (excluir chats) e depois remove os chats. Clique de novo no botão de marca de seleção para sair do modo de seleção. Trocar de aba também limpa a seleção.

## Chats recentes na tela inicial

A tela inicial tem um widget **Recent chats** (chats recentes) com os seus chats mais recentes. Cada um mostra o nome, um selo do modo e a última mensagem. Clique em um chat para abri-lo. Sem nenhum chat, o widget mostra **Your chats will show here** (os seus chats vão aparecer aqui). Veja [Widgets da tela inicial](../home/welcome.md#home-widgets).
