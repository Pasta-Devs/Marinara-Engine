# Chats em grupo e conversas em grupo

Um chat em grupo é qualquer chat de Conversation ou de Roleplay com dois ou mais personagens. Este guia mostra como criar um, gerenciar os membros e escolher quem fala. Game Mode tem um sistema de equipe próprio, que não entra neste guia.

Não existe um botão separado para criar um chat em grupo. Um chat vira um chat em grupo quando você adiciona um segundo personagem. Um chat em grupo não é uma **Folder** (pasta, uma lista salva de personagens que você pode reaproveitar) nem uma **Chat Branch** (ramificação, uma versão alternativa de um chat).

## Crie um chat em grupo

1. No painel **Chats**, clique no botão **+** do modo que você quer (**New Conversation** ou **New Roleplay**).
2. Um assistente de configuração se abre. Na etapa **Persona & Characters** (persona e personagens), digite em **Search characters...** e clique em um personagem para adicioná-lo.
3. Adicione um segundo personagem do mesmo jeito.
4. Termine o assistente de configuração para abrir o chat.

A etiqueta acima do seletor muda. Em Conversation, ela mostra **Group Chat** e o número de membros. Em Roleplay, mostra **Characters** e o número. Se você não renomear o chat, Marinara dá a ele o nome dos personagens, como "Alice, Bob, Carol".

Não existe limite fixo de personagens. Mais personagens significam um prompt mais longo e um custo maior por resposta, então adicione só os personagens de que a cena precisa.

Para adicionar uma pasta inteira de uma vez, abra **Add from Folder** (adicionar a partir de uma pasta) na mesma etapa, escolha uma pasta e clique em **Add** (adicionar). Os personagens que já estão no chat são pulados. O controle só aparece se você tiver pelo menos uma pasta. Veja [Organizando a biblioteca de personagens](../characters/library-organization.md). A linha **Random** (aleatório), identificada como **Dice pick**, adiciona um personagem aleatório que ainda não está no chat.

## Gerencie os membros

Abra **Chat Settings** (configurações do chat) e procure a seção **Characters** (personagens). Ela não existe no Game Mode. Cada linha de membro tem um avatar, um nome, uma alça de arraste, um ícone de olho e um ícone de lixeira.

| Para fazer isto | Faça assim |
|---|---|
| Adicionar um personagem | Clique em **Add Character** (adicionar personagem) e faça a busca. |
| Adicionar uma pasta | Clique em **Add Character** e depois em **Add all** (adicionar todos) na linha da pasta. |
| Mudar vários de uma vez | Clique no nome de um membro. O mesmo seletor se abre. |
| Remover um personagem | Clique no ícone de lixeira (**Remove from chat**). |
| Reordenar | Arraste a alça (**Drag to reorder**). Na ordem **Sequential**, os personagens respondem nesta ordem. |
| Desativar por um tempo | Clique no olho (**Disable in chat**). Clique de novo para ativar (**Enable in chat**). |

Um personagem desativado continua na lista, mas fica fora de todas as respostas. O card de personagem dele não vai para o modelo, e ele não pode ser escolhido para falar. Se você desativar todos os personagens, Marinara trata todos como ativos, para que nenhuma resposta saia vazia. Isso é salvo por chat e não muda nada em outro lugar. Em um grupo de Roleplay no modo Merged, [Automate active characters](#automate-active-characters-merged-only) pode definir isso por você.

<a id="choose-who-speaks"></a>

## Escolha quem fala

Abra **Chat Settings → Group Chat** (configurações do chat → chat em grupo). A seção só aparece quando o chat tem dois ou mais personagens. Os dois modos usam o mesmo botão liga/desliga **Mode** (modo).

- Uma resposta dá voz a todos os personagens. É **Merged (Narrator)** (mesclado: narrador) em Roleplay e **Grouped** (agrupado) em Conversation. Esse é o padrão. Em Roleplay, o narrador é uma voz que descreve a cena, e ele faz parte da mesma resposta.
- **Individual** dá a cada personagem a própria resposta.

Em Conversation, mudar para **Individual** mostra um aviso, **Individual replies can use many tokens**. Cada personagem que responde usa uma requisição separada ao modelo, e grupos grandes com Autonomous Messaging consomem tokens rápido.

### Automate active characters (Roleplay, só no modo Merged)

Esta configuração ativa e desativa personagens por você em um elenco grande. Veja [Automate active characters](#automate-active-characters-merged-only) no fim deste guia.

### Color Dialogues (Roleplay, só no modo Merged)

**Color Dialogues** (colorir os diálogos) vem desativada por padrão. Quando está ativada, as falas de cada personagem usam as cores próprias dele, da aba **Colors** (cores) do editor de personagem. Em um grupo de Conversation, as falas são coloridas automaticamente por quem fala, e não existe botão liga/desliga.

<a id="response-order-individual-only"></a>

### Response Order (só no modo Individual)

Com **Mode** em **Individual**, aparece **Response Order** (ordem de resposta). **Sequential** (sequencial) é o padrão.

| Ordem | O que acontece |
|---|---|
| **Sequential** | Os personagens respondem cada um na sua vez, na ordem da lista **Characters**. Em Conversation, os personagens offline são pulados. |
| **Smart** | Uma chamada curta e oculta ao modelo escolhe quem responde em seguida, em geral um personagem. Uma menção `@Alice` na sua mensagem prevalece sobre a escolha. Em Conversation, ela usa a conversa, o status da agenda e a loquacidade. |
| **Manual** | Ninguém responde por conta própria. Em Roleplay, use o seletor **Trigger Response** (acionar resposta). Em Conversation, mencione um ou mais personagens com `@mention` ou use o seletor. |

Na ordem **Smart**, o modelo pode enfileirar vários personagens. Só o primeiro responde na hora. Use o seletor **Trigger Response**, ou envie uma mensagem vazia, para gerar o próximo personagem da fila.

Se você escolheu um [modelo de decisão](../connections/decision-models.md), pode ativar abaixo dele **Also use it to pick who speaks in Smart response order** (usar também para escolher quem fala na ordem Smart). A ordem Smart passa a pedir uma pontuação de sim ou não para cada candidato.

- As perguntas compartilham as últimas cinco mensagens e uma lista com o nome, o status, a atividade, a loquacidade e um trecho curto da personalidade de cada candidato. Um serviço hospedado também recebe essa lista. Veja [O que o modelo vê](../connections/decision-models.md#what-the-model-sees).
- A velocidade e o custo dependem do modelo e do número de candidatos.
- Em Roleplay, Marinara escolhe quem tem maior probabilidade de falar. Em Conversation, todos que têm motivo respondem, começando pelos mais prováveis. O personagem que acabou de falar espera se outro tiver motivo para responder.
- Se o modelo de decisão não der resposta, a ordem Smart faz a chamada de costume ao modelo.

No modo **Individual** de Roleplay com a ordem **Smart** ou **Manual**, a primeira opção do seletor é **Smart**, marcada com um ícone de pessoas. Ela pede ao modelo que escolha quem fala a seguir só naquela resposta. A ordem salva continua a mesma.

### Acione uma resposta à mão

Use o seletor **Trigger Response** para escolher quem fala. No computador, ele é um botão ao lado de **Send** (enviar), identificado como **Trigger character response**. No celular, ele fica sob **Trigger Response**, na bandeja de ferramentas que você abre pela barra de mensagem. Para indicar quem fala pelo texto, digite `@` e o nome do personagem. Uma lista de sugestões aparece.

### Mais configurações do modo Individual

- **Add Turn To Prompt** (acrescentar o turno ao prompt) vem ativado por padrão. Ele acrescenta uma instrução curta dizendo qual personagem deve responder.
- **Name Prefix History** (só em Roleplay) vem desativado por padrão. Ele muda a forma como as mensagens antigas recebem o nome de quem falou. Deixe desativado, a não ser que algum personagem viva confundindo quem disse o quê.

### Scenario Override (Roleplay)

**Scenario Override** (substituição de cenário) dá a todo o grupo um cenário compartilhado. O texto da caixa substitui o cenário próprio de cada personagem no prompt. Uma caixa vazia deixa cada cenário como está. Não existe botão de ativar e desativar. Para editar em uma janela maior, clique no ícone de expandir (**Expand editor**, com o título **Group Scenario Override**). Esse texto fica com um único chat e fica de fora dos perfis de configurações.

### Character Exchanges (Conversation)

Ative **Character Exchanges** (trocas entre personagens) em **Chat Settings → Autonomous Messaging** para os personagens conversarem entre si enquanto você está longe. Ela vem desativada por padrão e só aparece em um chat em grupo. Ela só roda enquanto Marinara está aberto no navegador, e compartilha o limite diário de mensagens das mensagens autônomas. Funciona com ou sem as agendas de personagem. Em um grupo no modo **Individual**, as trocas e as respostas a `@mention` nunca gastam o último contato do dia do grupo.

## Configurações e padrões

| Configuração | Onde | Padrão |
|---|---|---|
| **Mode** | seção Group Chat | **Merged (Narrator)** em Roleplay, **Grouped** em Conversation |
| **Color Dialogues** | Roleplay, Merged | Desligado |
| **Automate active characters** | Roleplay, Merged | Desligado |
| **Response Order** | Individual | Sequential |
| **Add Turn To Prompt** | Individual | Ligado |
| **Name Prefix History** | Roleplay, Individual | Desligado |
| **Scenario Override** | Roleplay | Vazio |
| **Character Exchanges** | Conversation, Autonomous Messaging | Desligado |

Os perfis de configurações salvam essas configurações, exceto **Scenario Override** e os alfinetes da automação. Veja [Perfis de configurações](settings-profiles.md).

## Referência

<a id="automate-active-characters-merged-only"></a>

### Automate active characters (só no modo Merged)

No modo Merged, o card de todo personagem ativo está no prompt a cada resposta. Em Roleplay, **Automate active characters** (automatizar personagens ativos) pode ativar e desativar os cards por você, para que um elenco grande não encha o contexto. Ela tem três opções e vem em **Off** por padrão.

| Opção | O que faz |
|---|---|
| **Off** | Você escolhe quem está ativo com os botões de olho. |
| **Decision model** | Antes de cada resposta, o seu [modelo de decisão](../connections/decision-models.md) responde a uma pergunta de sim ou não por personagem: esse personagem está na cena que a resposta continua, ou está entrando nela? Um personagem que só é mencionado ou lembrado continua desativado. |
| **Character Tracker** | Os personagens presentes na última resposta, segundo o [Character Tracker](../agents/built-in-agents.md#character-tracker), definem quem está ativo. Isso não exige nenhuma chamada extra ao modelo, mas fica um turno atrasado: um personagem que entra agora só é ativado na próxima resposta. |

Uma dica abaixo da configuração avisa quando algo está faltando: nenhum modelo de decisão escolhido, o Character Tracker desligado neste chat, ou um tracker que roda manualmente e só muda a lista depois que você o executa.

- **Alfinetes.** Com a automação ligada, cada linha de personagem mostra um alfinete à esquerda do olho. Clique nele para fixar o personagem como ele está agora, ativo ou desativado, e a automação passa a deixá-lo em paz. Alternar um olho à mão também fixa esse personagem. Clique em um alfinete de novo para soltá-lo. Passar a automação para **Off** limpa todos os alfinetes.
- **O narrador continua ativo.** O narrador designado nunca é desativado.
- **Sem resposta, a lista fica como está.** No modo **Decision model**, se o modelo não der resposta, usa-se a última cena do Character Tracker, quando houver. Isso também vale para um modelo que pensa primeiro, a menos que **Also gate agents that run before the reply** (avaliar também os agentes que rodam antes da resposta) esteja ativada, e para um elenco grande demais para a entrada do modelo de decisão. Se nenhum dos dois der resposta, a lista continua como está.
- **Um resultado sem ninguém ativo é ignorado.** Um resultado que desativaria todo mundo não é aplicado.
- **Um agente Character Activity prevalece.** Um chat com um agente personalizado que usa o tipo de resultado **Character Activity** mantém esse agente no comando.

O Character Tracker escreve o próprio nome para cada personagem. Marinara associa esse nome a um card pelo ID do card, depois pelo nome e depois pelos apelidos do nome na aba **Colors**. Uma lista do tracker que não cita nenhum dos personagens do chat mantém a lista atual. A automação roda antes de toda resposta, swipe e regeneração, e pula **Continue** e o Impersonate. A configuração é salva nos perfis de configurações. Os alfinetes ficam com aquele chat.
