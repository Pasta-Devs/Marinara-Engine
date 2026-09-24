# Chats em grupo e conversas em grupo

Este guia explica os chats em grupo no Marinara Engine, ou seja, os chats que reúnem dois ou mais personagens ao mesmo tempo. Aqui você vê como criar um chat em grupo e como adicionar ou remover membros. Também mostra como definir quem fala no Conversation Mode e no Roleplay Mode.

## O que é um chat em grupo

Chat em grupo é qualquer chat com dois ou mais personagens. Não existe um botão separado para isso. Um chat comum vira um chat em grupo assim que você adiciona o segundo personagem.

Os chats em grupo funcionam em dois modos: **Conversation** (conversa) e **Roleplay** (interpretação de papéis). Game Mode tem um sistema de equipe próprio, que não entra neste guia.

A palavra "grupo" aparece em contextos diferentes dentro do Marinara. Chat em grupo significa vários personagens em um chat só. Isso não é a mesma coisa que **Folders** (as pastas de personagens), que são listas salvas de personagens para reaproveitar. Também não é a mesma coisa que **Chat Branches** (as ramificações do chat), que são versões alternativas do mesmo chat. Este guia trata apenas dos chats em grupo.

## Como criar um chat em grupo

O chat em grupo nasce no mesmo assistente de configuração de novo chat que você usa para qualquer chat. Basta escolher mais de um personagem.

1. Na barra lateral, clique no botão de novo chat do modo que você quer. O botão diz **New Conversation** ou **New Roleplay**.
2. Vá até a etapa do assistente de configuração chamada **Persona & Characters**.
3. Use a caixa **Search characters...** para localizar um personagem e clique no avatar ou no nome dele para adicioná-lo.
4. Adicione um segundo personagem do mesmo jeito. Você pode adicionar quantos quiser.
5. Termine o assistente de configuração para abrir o chat.

Depois que o segundo personagem entra, a etiqueta acima do seletor muda. No Conversation Mode, ela mostra **Group Chat** seguido do número de membros. No Roleplay Mode, mostra **Characters** seguido do número.

Não existe limite fixo de personagens. Na prática, quanto mais personagens, maior o prompt (o texto que Marinara envia para a IA) e maior o custo de cada resposta. Adicione só os personagens que a cena pede.

Se você não renomear o chat, Marinara usa os nomes dos personagens separados por vírgula. Um exemplo é "Alice, Bob, Carol".

### Adicionar vários personagens de uma vez com as pastas

Se você já montou uma pasta de personagens, adicione a pasta inteira em uma etapa só. As pastas são listas salvas de personagens que você monta no painel **Characters**. É a forma mais rápida de preparar um chat em grupo que você quer reaproveitar.

1. Na etapa **Persona & Characters**, abra o menu suspenso **Add from Folder**.
2. Escolha uma pasta na lista.
3. Clique no botão **Add**, ao lado do menu suspenso.

Todo personagem daquela pasta que ainda não está no chat entra automaticamente. O controle **Add from Folder** só aparece quando existe pelo menos uma pasta. Para aprender a criar e gerenciar as pastas, veja abaixo o guia sobre organizar a biblioteca de personagens.

Outra opção: clique na linha **Random** (identificada como **Dice pick**) para adicionar um personagem aleatório que ainda não esteja no chat.

## Gerenciar os membros depois da criação

Você adiciona, remove e reordena personagens no painel lateral **Chat Settings** (configurações do chat). Abra o painel pelo ícone de engrenagem no cabeçalho do chat. A dica da engrenagem diz **Chat Settings**.

Dentro do painel lateral, procure a seção **Characters**. Ela mostra o número de membros e o texto de ajuda "Characters in this chat. Each character has their own personality that the AI roleplays as." Cada linha de membro traz um avatar, o nome do personagem, uma alça de arraste, um ícone de olho e um ícone de lixeira.

- Para adicionar mais um personagem, clique no botão **Add Character** e faça a busca.
- Para adicionar uma pasta inteira, clique no botão **Add from Folder** e escolha uma.
- Para remover um personagem, clique no ícone de lixeira. A dica dele diz **Remove from chat**.
- Para reordenar os personagens, arraste um membro para cima ou para baixo pela alça de arraste. A dica dela diz **Drag to reorder**.

A ordem dos membros faz diferença. Na ordem de resposta **Sequential** (explicada mais adiante), os personagens respondem na ordem em que aparecem aqui. Arraste um membro para mudar o momento em que ele fala.

A seção **Characters** não aparece em Game Mode. Game Mode gerencia a equipe em outro lugar.

### Desativar um membro sem removê-lo

Às vezes você quer que um personagem fique de fora por um tempo, mas continue na lista. Para isso, use o ícone de olho na linha dele.

- Clique no olho para desativar o personagem. A dica muda para **Disable in chat** e o olho aparece cortado.
- Clique de novo para trazê-lo de volta. A dica passa a dizer **Enable in chat**.

Um personagem desativado continua na lista de membros, mas fica fora de todas as respostas. O card de personagem dele não vai para o modelo, e ele não pode ser escolhido para falar.

Existe uma proteção. Se você desativar todos os personagens do chat, Marinara volta a tratar todos como ativos. Assim, nenhuma resposta sai sem personagem nenhum.

Esse estado de ativado e desativado vale só para o chat atual. O personagem não muda em nenhum outro lugar do aplicativo.

## Quem fala: Roleplay Mode

No Roleplay Mode, um chat em grupo ganha a seção **Group Chat** dentro de **Chat Settings**. Ela só aparece quando o chat tem dois ou mais personagens. Use essa seção para definir como os personagens respondem.

### Merged (Narrator) ou Individual

A configuração **Mode** é um botão liga/desliga com duas opções.

- **Merged (Narrator)** é o padrão. Uma única resposta dá voz a todos os personagens e inclui a narração.
- **Individual** faz cada personagem gerar a própria resposta, separadamente.

### Color Dialogues (só no modo Merged)

Com **Mode** em **Merged (Narrator)**, você pode ativar a opção **Color Dialogues**. Ela vem desativada por padrão. Quando está ativa, as falas de cada personagem aparecem nas cores dele. Essas cores vêm da aba **Colors** do editor de personagem. Essa aba define a cor do nome, a cor do diálogo e a cor da caixa. Veja no guia de edição de personagens como configurar cada uma.

<a id="response-order-individual-only"></a>

### Response Order (só no modo Individual)

Com **Mode** em **Individual**, aparece a configuração **Response Order**. É um botão liga/desliga com três opções.

- **Sequential** é o padrão. Cada personagem responde na sua vez, na ordem em que aparece na lista **Characters**. Reordene os membros para mudar a ordem dos turnos.
- **Smart** usa uma chamada curta e invisível à IA para decidir qual personagem, ou quais personagens, respondem em seguida. Ela lê as mensagens recentes e os detalhes de cada personagem, e em geral escolhe um só. Se você escrever uma menção como `@Alice` na sua mensagem, essa menção prevalece sobre a escolha.

  Se você escolheu um **Decision model** (modelo de decisão; veja [Modelos de decisão](../connections/decision-models.md)), pode ativar **Also use it to pick who speaks in Smart response order** (usar também para escolher quem fala na ordem Smart) abaixo. Smart passa a pedir uma pontuação separada de sim/não por candidato. As perguntas compartilham as últimas cinco mensagens e uma lista com nome, status, atividade, sociabilidade e um trecho curto de personalidade ou descrição dos candidatos. Um provedor hospedado também recebe essa lista; veja [O que o modelo vê](../connections/decision-models.md#what-the-model-sees).

  Essas pontuações podem ser mais rápidas que uma resposta completa de IA, mas velocidade e custo dependem do modelo e do número de candidatos. Em Roleplay, Marinara escolhe quem tem maior probabilidade de falar. Em Conversation, todos com motivo respondem, começando pelos mais prováveis. Quem acabou de falar espera se outra pessoa tem motivo para responder. Se o Decision model não responder, Smart faz sua chamada normal à IA.
- **Manual** interrompe qualquer resposta automática. Você escolhe exatamente quem responde pelo seletor **Trigger Response**, na barra de mensagem.

Na ordem **Smart**, a IA pode enfileirar mais de um personagem. Só o primeiro responde na hora. Para escolher quem fala em seguida, use o seletor **Trigger Response**, na barra de mensagem. Outra opção: envie uma mensagem vazia para gerar a fala do próximo personagem da fila.

O modo **Individual** traz mais dois botões liga/desliga:

- **Add Turn To Prompt** vem ativado por padrão. Ele acrescenta uma instrução curta dizendo qual personagem deve responder neste turno.
- **Name Prefix History** vem desativado por padrão. Ele muda a forma como as mensagens antigas recebem o nome de quem falou antes de irem para o modelo. Deixe desativado, a não ser que algum personagem viva confundindo quem disse o quê.

### Scenario Override

O campo **Scenario Override** define um cenário único, compartilhado por todo o grupo. Digite qualquer texto ali e ele substitui o cenário próprio de cada personagem dentro do prompt. Se o campo ficar vazio, cada personagem mantém o cenário dele, como de costume.

Não existe botão de ativar e desativar. Digitar um texto ativa o recurso. Apagar o texto desativa. Para editar em uma janela maior, clique no ícone de expandir (a dica diz **Expand editor**). O editor ampliado se chama **Group Scenario Override**.

Uma observação sobre reaproveitamento: o texto de **Scenario Override** pertence só a este chat. Ele fica de fora dos perfis de configurações, então não acompanha um perfil quando você abre outro chat.

### Configurações e padrões (Roleplay)

| Configuração | Onde | Padrão |
|---|---|---|
| **Mode** (**Merged (Narrator)** / **Individual**) | seção Group Chat | Merged (Narrator) |
| **Color Dialogues** | seção Group Chat, modo Merged | Off |
| **Response Order** (Sequential / Smart / Manual) | seção Group Chat, modo Individual | Sequential |
| **Add Turn To Prompt** | seção Group Chat, modo Individual | On |
| **Name Prefix History** | seção Group Chat, modo Individual | Off |
| **Scenario Override** | seção Group Chat | Vazio (desativado) |

Quase todas essas configurações entram nos perfis de configurações, então você pode reaproveitá-las. A única exceção é **Scenario Override**, que fica preso ao chat em que foi escrito.

## Quem fala: Conversation Mode

O Conversation Mode aceita os mesmos chats em grupo, mas não mostra a seção **Group Chat**. Os controles dele ficam na seção **Autonomous Messaging** de **Chat Settings**.

Por padrão, uma conversa em grupo se comporta como o modo Merged. Uma resposta pode dar voz a vários personagens de uma vez, e as falas já saem coloridas por personagem. No Conversation Mode não existe um botão liga/desliga separado para as cores.

### Reply When Mentioned

Ative a opção **Reply When Mentioned** para o chat passar a falar um personagem por vez. Com ela ativa, os personagens só respondem quando você os chama pelo nome ou os aciona manualmente. A descrição do botão liga/desliga diz "Characters wait for direct mentions or manual response triggers."

Para chamar um personagem, use uma menção. Digite `@` seguido do nome do personagem na caixa de mensagem e uma lista de sugestões aparece. Quem você mencionar é quem responde.

Para escolher quem fala sem digitar a menção, use o seletor **Trigger Response**.

- No computador, ele é um botão ao lado de Send.
- No celular, ele fica sob o título **Trigger Response**, na bandeja de ferramentas que você abre pela barra de mensagem.

A dica do botão diz "Trigger character response".

### Character Exchanges

Ative a opção **Character Exchanges** para os personagens conversarem entre si por conta própria. Ela vem desativada por padrão. A descrição diz "Characters chat with each other in group chats."

Com ela ativa, os personagens respondem uns aos outros enquanto você está longe, e não só a você. Isso funciona apenas com Marinara aberto no navegador. Se você fechar o aplicativo, as trocas param. O recurso também compartilha o mesmo limite diário de mensagens usado pelas mensagens autônomas.

## Resumo do controle de turnos

| Modo e configuração | O que acontece | Como controlar |
|---|---|---|
| Roleplay, Merged | Uma resposta dá voz a todos os personagens | Sempre todos os personagens juntos |
| Roleplay, Individual, Sequential | Cada personagem responde na ordem dos membros | Arraste para reordenar os membros |
| Roleplay, Individual, Smart | A IA escolhe quem fala em seguida | A menção `@Name` prevalece sobre a escolha |
| Roleplay, Individual, Manual | Ninguém responde sozinho | Use o seletor **Trigger Response** |
| Conversation, padrão | Uma resposta pode dar voz a vários personagens | A menção `@Name` direciona a um personagem |
| Conversation, com Reply When Mentioned ativo | Ninguém responde sem menção ou acionamento | A menção `@Name` ou o seletor **Trigger Response** |
| Conversation, com Character Exchanges ativo | Os personagens também podem se escrever | Desative para parar |

## Guias relacionados

- [Organizando a biblioteca de personagens](../characters/library-organization.md)
- [Conversation Mode: primeiros passos](../conversation/getting-started.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
