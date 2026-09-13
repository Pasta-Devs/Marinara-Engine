# Roleplay Mode: primeiros passos

Neste guia você aprende o que é o Roleplay Mode, como começar um roleplay e o que aparece na tela. Ele também explica os controles de sprite, a barra de ferramentas do chat, as **Author's Notes** (notas do autor) e onde ler sobre os recursos mais avançados.

## O que é o Roleplay Mode

Roleplay Mode é um dos modos de chat do Marinara Engine. Os outros são Conversation e Game. O Roleplay traz uma visão de cena imersiva montada em volta de uma história.

Uma cena de roleplay pode mostrar uma imagem de plano de fundo, sprites de personagem e um painel com o estado do mundo. O sprite é a imagem do personagem no palco, e ela muda conforme a emoção. O painel de informações, ou HUD, é a faixa de widgets no topo do chat.

O Roleplay também usa ajudantes chamados agentes. Um agente é uma pequena tarefa automática que roda junto com a resposta da IA. Os agentes acompanham o estado do mundo, escolhem sprites, escolhem planos de fundo e muito mais.

A geração de imagens não é obrigatória para usar o Roleplay Mode. Sem ela, o modo continua funcionando como chat só de texto. Os espaços de sprite ficam vazios, o plano de fundo mostra uma cor sólida e o HUD continua acompanhando tudo. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md) para configurar uma conexão.

Escolha o Roleplay Mode quando quiser uma cena imersiva. Escolha o [Conversation Mode](../conversation/getting-started.md) para um chat de mensagens simples. Escolha o [Game Mode](../game/getting-started.md) para um RPG estruturado, com equipe, combate e dados.

## Como começar um roleplay

Crie um chat de Roleplay para abrir o assistente de configuração. O assistente tem cinco etapas. Só a conexão de IA é obrigatória. Todas as outras etapas são opcionais e podem ser alteradas depois.

1. **Name & Connection** (nome e conexão). Dê um nome ao roleplay e escolha qual conexão de IA responde. O nome pode ficar em branco.
2. **Pick a Preset** (escolher um preset). O preset controla a estrutura do prompt e as configurações de geração. O preset padrão funciona bem na maioria dos chats.
3. **Persona & Characters** (persona e personagens). Escolha a persona que você interpreta e quais personagens entram na cena.
4. **Attach Lorebooks** (anexar lorebooks). O lorebook é um conjunto de fatos do seu mundo que a IA lê quando as palavras-chave aparecem. Esta etapa é opcional.
5. **Enable Agents** (ativar agentes). Escolha quais agentes rodam neste chat. Os agentes podem ser adicionados ou removidos depois na seção **Chat Settings** (configurações do chat), em **Agents**.

Depois de terminar o assistente de configuração, a cena abre e você já pode enviar a primeira mensagem.

## O palco: plano de fundo, sprites e HUD

O palco do Roleplay é a área da cena atrás e ao redor das mensagens. Ele tem três partes principais.

O **plano de fundo** é uma imagem de cena inteira atrás da coluna de mensagens. A troca acontece com uma transição suave. O agente **Background** pode escolher um a cada turno, tirado da sua biblioteca de planos de fundo. Também é possível fixar um plano de fundo por chat. Veja [Planos de fundo do Roleplay](backgrounds.md) para conhecer o sistema completo.

Os **sprites** são as imagens de personagem colocadas no palco. Não existe limite fixo. Todo personagem do chat com sprites ativados pode aparecer. Os sprites dependem de uma biblioteca de sprites enviada no card de personagem. Sem ela, o espaço do sprite não mostra nada. Veja [Sprites de personagem](../characters/sprites.md) para adicionar sprites a um personagem.

O **HUD** é uma fileira de widgets pequenos no topo do chat. Cada widget pertence a um tracker (agente de acompanhamento), então o widget só aparece quando o agente dele está ativado. Os widgets mostram data, hora, clima, local, personagens presentes, inventário, missões e atributos. Clique em um widget para abrir um painel e editar os valores. Veja [HUD e trackers do Roleplay](hud-and-trackers.md) para conhecer cada widget e cada modo de bloqueio.

### Controles de exibição dos sprites

Os controles de sprite ficam na seção **Chat Settings**, em **Agents**, no card **Expression Engine**. Eles aparecem assim que pelo menos um personagem tem sprites ativados.

- **Sprite Source** (origem do sprite). Um botão liga/desliga com **Expressions** e **Full-body**. Escolha um ou os dois. Pelo menos um precisa continuar ativado.
- **Expression Size**, **Full-body Size**, **Expression Opacity** e **Full-body Opacity**. Quatro controles deslizantes que definem o tamanho do sprite e o nível de transparência. Essas configurações ficam guardadas neste navegador e não são sincronizadas com outros dispositivos.
- **Default Side** (lado padrão). Um botão liga/desliga entre **Left** e **Right** que define de que lado os novos sprites começam.
- **Expression Avatars**. Quando ativado, os avatares das mensagens na transcrição usam o sprite de expressão atual do personagem.

Para mover os sprites na mão, clique no botão **Arrange** no palco. Enquanto está ativo, ele vira **Done**. Arraste um sprite e depois clique no pequeno visto acima dele para confirmar. Clique em **Done** para terminar. O botão **Reset** limpa todas as posições personalizadas.

Outra opção para definir uma expressão: digite o comando **/emote** na caixa de mensagem. Duas formas funcionam:

```
/emote happy
```

```
/emote "Aria" angry
```

A primeira forma define a expressão para a cena. A segunda mira em um personagem específico, pelo nome. Digite **/emote** sem nenhuma palavra para listar as expressões disponíveis de cada personagem da cena.

## A barra de ferramentas do chat

A barra de ferramentas fica no topo da área de chat. Ela tem botões que abrem painéis pequenos, chamados popovers. Os botões principais são:

- **Chat Summary** (resumo do chat). Mostra e edita o resumo contínuo do chat.
- **Active Context** (contexto ativo). Lista os personagens vinculados, as entradas de lorebook e o preset que alimentaram a última resposta. Mostra quais entradas de lorebook foram acionadas e inseridas.
- **Author's Notes**. Uma nota de texto livre acrescentada ao prompt a cada turno. Veja abaixo.
- **Gallery** (galeria). Abre a galeria de imagens e vídeos do chat, onde você pode gerar uma ilustração ou um plano de fundo.
- **Chat Settings**. Abre o painel lateral com todas as configurações deste chat.

### Author's Notes

**Author's Notes** é uma nota escrita por você que a IA lê em toda geração. Use para um lembrete permanente, como uma regra de tom ou um fato escondido. Abra pelo botão de caneta na barra de ferramentas.

Digite a nota na caixa. Por exemplo: "Keep the tone dark and suspenseful. The villain is secretly an ally."

Abaixo da nota fica o campo numérico **Injection Depth** (profundidade de inserção). Ele define a que altura do histórico do chat a nota é colocada. A ajuda dentro do aplicativo diz: "Depth 0 = after the latest message, 4 = four messages from the end." A profundidade 0 mantém a nota o mais perto possível da resposta mais recente.

As **Author's Notes** funcionam do mesmo jeito no Game Mode e no Conversation Mode. Este guia é a referência principal do recurso.

## O menu Agents & Actions

O botão com o ícone de brilho, na fileira do HUD, abre o menu **Agents & Actions** (agentes e ações). A aba **Activity** lista as saídas dos agentes, chamadas de balões de pensamento. Você pode dispensar cada uma ou usar **Clear all**. As saídas de agentes personalizados também aparecem aqui.

Se algum agente falhou no último turno, aparece uma lista de falhas com um botão para tentar de novo. Por este menu também é possível rodar de novo todos os trackers. Para um passeio em linguagem simples por todo o sistema de agentes, veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

A aba **Injections** só aparece quando o **Debug mode** (modo de depuração) está ativado. Ative na seção **Settings** (Configurações), em **Advanced**. Essa aba mostra os trechos de prompt que os agentes do tipo escritor salvaram antes da última resposta. Entre esses agentes estão o **Prose Guardian**, que reescreve as respostas para seguir as suas regras de estilo, e o **Narrative Director**, que conduz o enredo.

Você pode ver, editar e rodar de novo um trecho salvo. A edição muda só o que é usado quando você regenera aquela mesma resposta. Ela não altera a resposta que já está na tela. Assim a regeneração continua estável e repetível.

O Narrative Director tem um botão **Push Story** acima da caixa de mensagem. Ele prepara o Director para a próxima resposta, e só para ela. O Narrative Director também pode guardar um arco de longo prazo escondido, chamado **Secret Plot**. Veja [Narrative Director e Secret Plot](narrative-director.md) para conhecer os dois.

## Interrupções dos personagens

Em **Chat Settings → Agents → Roleplay Commands**, ative **Interruptions** (interrupções) para permitir que personagens cortem a última mensagem quando uma intervenção verbal ou física for plausível. A função começa desativada e não exige nenhum agente baixado.

O modelo usa `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara procura essa frase literal somente na mensagem imediatamente anterior à resposta, mantém o texto até a frase inclusive e substitui o final por um travessão de interrupção. Diálogos mantêm as aspas de fechamento; ações não recebem aspas. Se não houver correspondência ou ela for ambígua, a mensagem não muda.

Abra as informações de comandos da resposta e escolha **Restore original message** (restaurar mensagem original) para recuperar a mensagem inicial. Regenerar restaura primeiro a entrada original completa, para que a nova resposta decida se interrompe. Selecionar uma variante existente aplica a interrupção dela, a menos que você a tenha restaurado explicitamente. Edições manuais posteriores são preservadas em vez de serem sobrescritas por uma interrupção antiga.

## Echo Chamber

**Echo Chamber** é um agente opcional que acrescenta uma plateia ao vivo reagindo à cena. Funciona como um chat de transmissão que publica uma reação nova de tempos em tempos. Ative na seção **Chat Settings**, em **Agents**, no card **Echo Chamber**. O painel flutua sobre a cena e pode ser recolhido até virar uma pequena pílula.

## Escolhas CYOA

**CYOA** quer dizer Choose Your Own Adventure, ou "escolha sua própria aventura". O agente **CYOA Choices** vem desativado por padrão. Quando ativado, ele acrescenta botões de escolha clicáveis depois de uma resposta. Ao clicar em uma opção, ela vira sua próxima mensagem. Funciona apenas no Roleplay Mode.

## Encontros de combate

O Roleplay Mode tem uma camada leve de combate. Ative o agente **Combat** e clique no botão **Encounter** acima da caixa de mensagem (a dica dele diz "Start Combat Encounter"). Isso abre uma janela de configuração e, em seguida, uma tela de combate com barras de vida e botões de ação. É um sistema separado do combate próprio do Game Mode. Veja [Encontros de combate (Roleplay)](combat-encounters.md) para conhecer o fluxo completo.

## Cenas

A **cena** é uma ramificação paralela de um roleplay. Use para um flashback, um local secundário ou um caminho alternativo, sem perder a linha principal. A cena não puxa contexto de uma Conversation conectada, mesmo quando o roleplay principal puxa. Veja [Cenas: criando uma ramificação do roleplay](scenes.md).

## Como escolher os modelos

Os padrões funcionam bem no Roleplay Mode. Duas dicas gerais ajudam na maioria das configurações.

A conexão do chat é quem escreve a prosa dos personagens. Um modelo intermediário ou melhor mantém a voz estável em cenas longas. As conexões dos agentes rodam tarefas pequenas e estruturadas, como ler o estado ou escolher uma expressão. Modelos muito fracos podem produzir estados errados e escolhas ruins de sprite.

É possível usar para os agentes um modelo mais barato do que o do chat. Muita gente roda o chat em um modelo forte e os agentes em um modelo rápido e barato. Se os valores do HUD ou os sprites saem errados o tempo todo, troque a conexão dos agentes por um modelo mais capaz. Para as configurações de amostragem, veja [Parâmetros de geração](../prompts/generation-parameters.md).

## Solução de problemas

**Os widgets do HUD mostram o valor errado.** Cada widget é preenchido por um tracker. Abra o painel do widget e edite o valor na mão. Se os valores continuarem se desviando, troque a conexão do agente por um modelo mais forte. Você também pode bloquear um campo para que a próxima execução automática não sobrescreva o valor.

**As expressões dos sprites não mudam.** Verifique se o personagem tem uma biblioteca de sprites enviada. A geração de imagens só é necessária quando você quer que Marinara crie sprites novos. Sem sprites para mostrar, o agente de expressão roda, mas não tem o que exibir. Outra opção é definir a expressão na mão, com o comando **/emote**.

**O plano de fundo nunca muda.** O agente **Background** escolhe dentro da sua biblioteca de planos de fundo. Com apenas um ou dois planos de fundo, ele fica escolhendo sempre os mesmos. Acrescente mais planos de fundo para dar mais opções ao agente. Veja [Planos de fundo do Roleplay](backgrounds.md).

**Uma resposta regenerada continua indo na direção errada.** Ative o **Debug mode** na seção **Settings**, em **Advanced**. Abra o menu **Agents & Actions**, procure a aba **Injections** e edite ou rode de novo o trecho salvo antes de regenerar. Para mais ajuda, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Guias relacionados

- [Planos de fundo do Roleplay](backgrounds.md)
- [HUD e trackers do Roleplay](hud-and-trackers.md)
- [Encontros de combate (Roleplay)](combat-encounters.md)
- [Narrative Director e Secret Plot](narrative-director.md)
- [Cenas: criando uma ramificação do roleplay](scenes.md)
- [Sprites de personagem](../characters/sprites.md)
- [Conectar uma Conversation a um Roleplay ou Game](../chats/connected-chats.md)
- [Macros](../prompts/macros.md)
