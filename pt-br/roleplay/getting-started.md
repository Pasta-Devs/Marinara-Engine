# Roleplay Mode: primeiros passos

O Roleplay é o modo de chat para histórias. Ele acrescenta um palco atrás das suas mensagens (um plano de fundo e sprites de personagem) e um HUD (heads-up display) com os detalhes da história. Um agente é um ajudante que roda junto com as respostas, por exemplo um que acompanha o clima ou escolhe um sprite.

Escolha o Roleplay para uma cena de história. Escolha o [Conversation](../conversation/getting-started.md) para mensagens simples, ou o [Game Mode](../game/getting-started.md) para um jogo estruturado, com equipe, combate e dados. Sem geração de imagens, o Roleplay funciona como chat só de texto: os espaços de sprite ficam vazios, o plano de fundo é uma cor sólida e o HUD continua acompanhando a história.

## Começar um roleplay

Antes de começar: adicione uma conta no painel **Connections** (Conexões), no lado direito do aplicativo. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Na barra lateral de chats, clique na aba **RP**.
2. Clique no botão **+** perto do topo da barra lateral. A dica dele diz **New Roleplay** (novo roleplay).

O chat abre com **Chat Settings** (configurações do chat) e um assistente de configuração de cinco etapas. Só a conta é obrigatória. Você pode mudar tudo depois.

1. **Name & Connection** (nome e conexão). Dê um nome ao roleplay (opcional) e escolha qual conexão responde.
2. **Pick a Preset** (escolher um preset). O preset define a estrutura do prompt e os valores de geração. O padrão funciona na maioria dos chats.
3. **Persona & Characters** (persona e personagens). Escolha a sua persona e os personagens da cena. Nesta etapa, um botão chamado **Create your persona** (criar a sua persona) pode montar uma persona para você a partir de algumas perguntas. Veja [Onboarding interativo](../characters/interactive-onboarding.md).
4. **Attach Lorebooks** (anexar lorebooks). O lorebook é um conjunto de fatos do mundo que a IA lê quando as palavras-chave deles aparecem. Opcional.
5. **Enable Agents** (ativar agentes). Escolha quais agentes rodam neste chat. Você pode mudar isso depois em **Chat Settings → Agents**.

Ao terminar, você vê o chat com uma caixa de mensagem. Digite a primeira mensagem e envie.

## O palco: plano de fundo, sprites e HUD

- **Background** (plano de fundo): uma imagem de cena inteira atrás das suas mensagens, que faz uma transição suave quando muda. O agente **Background** pode escolher um a cada turno, ou você pode fixar um por chat. Veja [Planos de fundo do Roleplay](backgrounds.md).
- **Sprites**: as imagens dos personagens no palco. Todo personagem com sprites ativados pode aparecer. O personagem precisa de uma biblioteca de sprites no card, senão o espaço dele fica vazio. Veja [Sprites de personagem](../characters/sprites.md).
- **HUD**: os seus trackers (data, hora, clima, local, quem está presente, inventário, missões, atributos). Ative-os em **Chat Settings → Agents**. Veja [HUD e trackers do Roleplay](hud-and-trackers.md).

### Controles de exibição dos sprites

Abra **Chat Settings** (o botão de controles deslizantes no chat), vá até **Agents** e encontre o cartão **Expression Engine**. Esse é o agente que escolhe as expressões dos sprites. Estes controles aparecem assim que pelo menos um personagem tem sprites ativados.

| Controle | O que faz |
| --- | --- |
| **Sprite Source** (origem do sprite) | Escolha **Expressions** (expressões), **Full-body** ou os dois. Um deles precisa continuar ativado. |
| **Expression Size**, **Full-body Size** | Definem o tamanho de cada tipo de sprite. |
| **Expression Opacity**, **Full-body Opacity** | Definem o quanto cada tipo é transparente. |
| **Default Side** (lado padrão) | **Left** (esquerda) ou **Right**: o lado em que os novos sprites começam. |
| **Expression Avatars** | Quando ativado, os avatares das mensagens usam o sprite de expressão atual do personagem. |

Os quatro controles deslizantes de tamanho e opacidade ficam salvos só neste navegador. Eles não são sincronizados com outros dispositivos.

Para mover os sprites na mão:

1. Clique em **Arrange** (organizar), o botão na cena. Ele vira **Done** (concluir).
2. Arraste um sprite e depois clique no pequeno visto acima dele para confirmar.
3. Clique em **Done** para terminar. **Reset** (redefinir) limpa todas as posições personalizadas.

Para definir uma expressão digitando, envie `/emote happy` para a cena, ou `/emote "Aria" angry` para um personagem. Envie só `/emote` para listar as expressões de cada personagem.

Se não funcionou: os sprites precisam de uma biblioteca de sprites enviada no personagem. Sem ela, o agente de expressão roda, mas não tem nada para mostrar.

## As ferramentas do chat

As ferramentas do chat (busca, ramificações, resumo, contexto ativo, Agent activity, Author's Notes, Gallery) são seções de **Chat Settings**. Abra pelo botão de controles deslizantes no chat. Veja [Visão geral do painel Chat Settings](../chats/chat-settings.md) para saber o que cada uma faz, e [Destacar uma seção em uma janela própria](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Author's Notes

**Author's Notes** (notas do autor) é uma nota que a IA lê em toda resposta. Use para um lembrete permanente, como uma regra de tom ou um fato escondido.

1. Abra **Chat Settings** e expanda **Author's Notes**, abaixo de **Agents**.
2. Digite a nota, por exemplo: "Keep the tone dark and suspenseful."
3. Se estiver em dúvida, deixe **Injection Depth** (profundidade de inserção) como está. Ele define onde a nota fica no chat: 0 é depois da mensagem mais recente, e 4 é quatro mensagens antes do fim.

Para uma nota mais longa, arraste o canto inferior da caixa no computador. As Author's Notes funcionam do mesmo jeito no Game Mode e no Conversation Mode.

<a id="agent-activity"></a>

## Agent activity

**Agent activity** (atividade dos agentes) mostra o que os agentes do chat fizeram. Ela aparece assim que o chat usa agentes ou Advanced Memory. Você a encontra como seção própria logo abaixo de **Agents** em **Chat Settings**, no fim do Tracker Panel e, no computador, no fim da janela Trackers.

- Aba **Activity** (atividade): as saídas que os agentes salvaram, chamadas de balões de pensamento. Dispense uma ou use **Clear all** (limpar tudo). As saídas de agentes personalizados também aparecem aqui.
- Enquanto os agentes trabalham, o ícone dela vira um indicador giratório. Se um agente falha, um pontinho aparece no ícone até você abri-la.
- Os agentes que falharam aparecem em uma lista com um botão para tentar novamente. Você também pode parar os agentes em execução, executar os trackers de novo e usar **Clear Trackers** (limpar os trackers).
- Aba **Injections**: só aparece quando o **Debug mode** (modo de depuração) está ativado em **Settings → Advanced** (Configurações → Avançado). Ela lista os trechos de prompt que os agentes do tipo escritor salvaram antes da última resposta. Entre esses agentes estão o **Prose Guardian**, que reescreve as respostas para seguir as suas regras de estilo, e o **Narrative Director**, que conduz o enredo. Você pode ver, editar e rodar de novo um trecho. A edição muda só o que é usado quando você regenera aquela mesma resposta, então a regeneração continua repetível. Ela não altera a resposta que está na tela.

Para conhecer todos os agentes, veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md). Para o agente que conduz a história, veja [Narrative Director e Secret Plot](narrative-director.md).

## Combate e cenas

- O Roleplay tem uma camada leve de combate. Adicione o agente Combat e clique em **Encounter** (encontro) acima da caixa do chat. Veja [Encontros de combate (Roleplay)](combat-encounters.md).
- Uma cena é uma ramificação paralela para um flashback ou um local secundário. Veja [Cenas: criando uma ramificação do roleplay](scenes.md).
- Para conduzir o enredo, veja [Narrative Director e Secret Plot](narrative-director.md).
- Para jogar com regras de mesa, com testes de dados e fichas de personagem, veja [Roleplay: jogar com um conjunto de regras](rulesets.md).

## Como escolher os modelos

A conexão do chat escreve a prosa dos personagens. Um modelo mais forte mantém a voz do personagem estável em cenas longas. As conexões dos agentes rodam tarefas pequenas e estruturadas, como ler o estado ou escolher uma expressão, e modelos pequenos podem errar nelas. Muita gente roda o chat em um modelo forte e os agentes em um modelo rápido e barato. Se os valores do HUD ou os sprites continuarem saindo errados, passe os agentes para um modelo mais forte. Para as configurações de amostragem, veja [Parâmetros de geração](../prompts/generation-parameters.md).

## Comandos

Estes recursos são opcionais. Os comandos são ações que um personagem pode realizar por conta própria, escritas dentro da resposta como um texto curto entre colchetes, por exemplo `[illustrate: ...]`. Marinara lê os colchetes, realiza a ação e esconde os colchetes da mensagem.

### Ativar um comando

1. Abra **Chat Settings → Agents** e expanda **Commands** (comandos).
2. Ative o botão liga/desliga **Commands** no topo. Todos os comandos dentro dele começam desativados.
3. Ative os comandos que você quer. Um comando acinzentado mostra o que ainda falta para ele.

- **Illustrations** (ilustrações), **Video clips** (clipes de vídeo): adicione o agente Illustrator a este chat.
- **Combat** (combate): adicione o agente Combat a este chat.
- **Soundtrack** (trilha sonora): adicione o agente Music DJ e ative os agentes.
- **Personal Notes** (notas pessoais), **Reminders** (lembretes), **Whisper**: use um chat solo ou um chat em grupo com geração **Individual**.
- **Sound Cues** (sinais sonoros): escolha uma conexão de Music & Sound Effects com os efeitos sonoros ativados.
- **Documents** (documentos), **HTML Artifacts**, **Rolls** (rolagens), **Direct Messages**, **Interruptions**: não precisam de mais nada.

**Rolls**, **Combat**, **Documents** e **Whisper** também perguntam quem pode usá-los: **All** (todos) os personagens ou só o **Narrator** (narrador). O narrador é o personagem que você escolhe em **Narrator character** (personagem narrador). Ele pode usar os comandos exclusivos do narrador e ler as notas, os lembretes e os sussurros de todos.

Se não funcionou: falta o agente ou o tipo de chat de um comando acinzentado. Leia a linha abaixo do botão liga/desliga dele.

### Ilustrações

Antes de começar: adicione o agente Illustrator ao chat e ative **Illustrations**.

Agora um personagem pode pedir uma imagem com `[illustrate: subject="..." characters="..."]`. A imagem usa as configurações do Illustrator do chat e aparece abaixo da mensagem.

Ative **Render in-line** (exibir no meio do texto) para mostrar cada imagem dentro da mensagem, no ponto em que o personagem escreveu o comando. Selecione uma imagem para ver o prompt dela, ou use o **X** para removê-la. A configuração vale só para imagens novas. As imagens que o agente Illustrator cria por conta própria e o layout Visual Novel não mudam.

Você também pode criar uma ilustração por conta própria com `/illustrate`. No Roleplay, isso precisa do agente Illustrator.

<a id="artifacts-on-demand"></a>

### Artefatos sob demanda

Ative **HTML Artifacts** (artefatos HTML) para deixar o narrador criar um objeto do mundo da história, como uma página de grimório, uma placa, um esboço em uma carta ou a leitura de um terminal. O comando é `[html: prompt="..."]`. Ele não precisa de agente. Você também pode pedir um por conta própria com `/html <what you want>`.

O artefato aparece no ponto em que o narrador colocou o comando, depois que a resposta termina. No layout Visual Novel, você vê só um marcador. Uma resposta pode criar no máximo 3 artefatos, e cada um é uma requisição separada ao modelo. A requisição usa a conexão do agente **Immersive HTML**, se ele tiver uma; senão, a sua conexão padrão de agentes; senão, a conexão do chat. A configuração **Parallel requests** (requisições em paralelo) dessa conexão, no editor da conta, define quantas rodam ao mesmo tempo. Para uma página estilizada simples, os tipos prontos de **Documents** são gratuitos e instantâneos.

O narrador não vê o HTML do artefato. Nos turnos seguintes, ele vê uma versão curta em texto simples: o texto legível do artefato e uma linha sobre a aparência dele. Abra o marcador "used html command" abaixo da mensagem para ler ou editar esse texto, ou para excluir o artefato, o que também o remove da memória do narrador. Se uma execução falhar, o marcador diz por quê.

<a id="whispers-and-secrets"></a>

### Sussurros e segredos

Ative **Whisper** (sussurro) para comentários privados, segredos e visões dentro de uma resposta. O comando é `[whisper: character="name" text="the secret"]`. Nomeie exatamente um personagem do chat, ou a sua persona. Só esse personagem e o narrador recebem o texto nos prompts. Um nome desconhecido ou ambíguo é ignorado, então o segredo não vaza.

- **Reveal a secret** (revelar um segredo) mostra um sussurro na sua tela. Isso muda só o que você vê, não o que os personagens sabem. Os sussurros para a sua persona ficam visíveis imediatamente.
- **Edit whisper** (editar sussurro) permite mudar o texto; depois, use **Save** (salvar). Para remover um sussurro, apague o texto e use **Save**. **Cancel** (cancelar) deixa tudo como estava.
- Você pode escrever um sussurro na sua própria mensagem para sussurrar a um personagem. Os mesmos colchetes funcionam quando você edita a mensagem de um personagem ou do narrador. O texto pode ocupar várias linhas e manter as aspas, por exemplo `text=""I love you.""`.
- Uma mensagem que contém só um sussurro fica oculta para os personagens que ele não alcança.
- Se você usar **Hide from AI** (ocultar da IA) em uma mensagem para alguns personagens, o destinatário do sussurro ainda recebe o sussurro, mas nada do restante da mensagem.

Os agentes também podem ler sussurros:

- Estes agentes os leem: Echo Chamber, os trackers, Lorebook Keeper e Long-Term Memory. Nos chats em grupo, a ordem de resposta **Smart** também os lê, então um sussurro pode fazer esse personagem responder em seguida.
- Cada sussurro é marcado como privado e indica o destinatário. O que um agente escreve a partir dele, como uma entrada de lorebook ou uma nota de tracker, ainda pode chegar a outros personagens.
- Em uma sala multijogador hospedada, os agentes e a ordem de resposta **Smart** não recebem sussurros.
- O Relationship Tracker e o Memory Nag leem o chat por conta própria e ainda não veem sussurros.

<a id="your-private-notes"></a>

### Suas notas privadas

Ative **Personal Notes** e escreva `[notes: content="your private note"]` na sua própria mensagem. Só o narrador recebe essas notas, não os outros personagens nem os agentes compartilhados. Use os detalhes de comandos da mensagem para editar ou excluir uma nota. Se um personagem é desativado ou removido do grupo, o narrador deixa de receber as notas desse personagem. Reativar o personagem as traz de volta.

Você também pode guardar uma nota em uma única mensagem:

1. Escolha **Bookmark, pin or note** (marcar, fixar ou adicionar nota) abaixo da mensagem.
2. Escreva uma **Private note** (nota privada). Por padrão, ela continua privada e não é enviada ao modelo.
3. Para compartilhá-la com o modelo, ative **Show the note to the narrator character** (mostrar a nota ao personagem narrador) e escolha um personagem. Só esse personagem recebe a nota, junto àquela mensagem. Compartilhar exige um chat solo ou a geração em grupo **Individual**.

**Remove note** (remover nota) também interrompe o compartilhamento.

<a id="video-clips"></a>

### Clipes de vídeo

Antes de começar: adicione o agente Illustrator ao chat e escolha uma conexão de vídeo em **Scene Videos** (vídeos de cena), no Illustrator.

Ative **Video clips** para deixar os personagens pedirem um clipe curto de um momento importante com `[video: subject="the moment" motion="what moves and how the camera moves" characters="names"]`. O modelo recebe a instrução de preferir esse comando a `[illustrate]` quando o momento envolve movimento. O clipe começa pela imagem definida em **First frame** (primeiro quadro), no Illustrator: uma nova imagem do Illustrator, o avatar ou o sprite do personagem, ou nenhuma. Ele toca na resposta quando fica pronto. Um clipe só é oferecido enquanto o **Video Run Interval** permite, e ele entra na contagem de **Videos per reply**.

### Interrupções dos personagens

Ative **Interruptions** (interrupções) para deixar um personagem cortar a última mensagem quando uma interrupção fizer sentido. O comando é `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara procura essa frase na mensagem imediatamente anterior à resposta, mantém o texto até ela e termina com um travessão. O diálogo mantém as aspas de fechamento. Se a frase não aparecer ou corresponder duas vezes, a mensagem continua como está.

Para recuperar o original, abra as informações de comandos da resposta e escolha **Restore original message** (restaurar mensagem original). Gerar de novo primeiro restaura o original completo, para que a nova resposta possa decidir outra vez. Escolher um swipe existente aplica a interrupção desse swipe, a menos que você a tenha restaurado. As suas edições manuais posteriores são mantidas.

## Echo Chamber

**Echo Chamber** é um agente opcional que acrescenta uma plateia ao vivo reagindo à sua cena, como o chat de uma transmissão ao vivo que publica uma reação nova de tempos em tempos. Ative em **Chat Settings → Agents**, no cartão **Echo Chamber**.

- No computador, arraste a barra de título dele para movê-lo e uma borda para redimensioná-lo. Fixe-o para mantê-lo aberto. O **X** o fecha em um botão que você pode mover.
- No celular, ele começa como uma janela compacta acima das mensagens. Arraste a barra de título para movê-lo, ou uma borda ou um canto para redimensioná-lo. Fixar o mantém aberto quando você toca em outro lugar, e travar impede movimentos acidentais.
- Ele segue o **Chat widget style** (estilo dos widgets do chat) escolhido em **Settings → Appearance → App**. Cada chat lembra a disposição dele.

## Escolhas CYOA

CYOA quer dizer Choose Your Own Adventure (escolha a sua própria aventura). O agente CYOA Choices vem desativado por padrão e funciona só no Roleplay. Quando ativado, ele acrescenta botões de escolha clicáveis depois de uma resposta, e clicar em um deles o envia como a sua próxima mensagem. Para combinar escolhas ou editar uma antes, ative **Add CYOA choices to the message box instead of sending them** (adicionar as escolhas CYOA à caixa de mensagem em vez de enviá-las) em **Settings → General → Input & Editing**. A partir daí, clicar em uma escolha acrescenta o texto dela à sua caixa de mensagem.

## Solução de problemas

| Sintoma | Solução |
| --- | --- |
| Um valor do HUD está errado. | Edite o valor na mão e bloqueie-o para que a próxima execução não mexa nele. Veja [HUD e trackers do Roleplay](hud-and-trackers.md). Se os valores continuarem se desviando, use um modelo de agente mais forte. |
| Os sprites não mudam. | Verifique se o personagem tem uma biblioteca de sprites. Você também pode usar `/emote`. |
| O plano de fundo nunca muda. | O agente **Background** escolhe dentro da sua biblioteca, então acrescente mais planos de fundo. Veja [Planos de fundo do Roleplay](backgrounds.md). |
| Uma resposta regenerada continua indo na direção errada. | Ative o **Debug mode**, abra **Agent activity → Injections** e edite ou rode de novo o trecho salvo antes de regenerar. |

Para mais ajuda, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Guias relacionados

- [Planos de fundo do Roleplay](backgrounds.md)
- [HUD e trackers do Roleplay](hud-and-trackers.md)
- [Encontros de combate (Roleplay)](combat-encounters.md)
- [Narrative Director e Secret Plot](narrative-director.md)
- [Roleplay: jogar com um conjunto de regras](rulesets.md)
- [Cenas: criando uma ramificação do roleplay](scenes.md)
- [Sprites de personagem](../characters/sprites.md)
- [Conectar uma Conversation a um Roleplay ou Game](../chats/connected-chats.md)
- [Macros](../prompts/macros.md)
