# Encontros de combate (Roleplay)

Este guia explica os encontros de combate no Roleplay Mode. Aqui você vê como ativar o agente **Combat**, começar uma luta e conduzi-la na janela de encontro. O guia também mostra a diferença entre esse recurso e o combate do Game Mode.

Os encontros de combate são um recurso opcional do Roleplay. Eles dão à cena uma tela de batalha estruturada, por turnos, com barras de vida, listas de inimigos e da equipe, e um registro do combate. Se você nunca ativar o recurso, os chats de roleplay continuam funcionando exatamente como antes.

## Ativar o agente Combat

Um agente é um ajudante que roda automaticamente durante a geração da mensagem. O agente **Combat** acrescenta o recurso de batalha a um chat de Roleplay. Ele vem desativado por padrão, então precisa ser ativado chat a chat.

1. Abra o chat em que você quer usar o combate.
2. Abra **Chat Settings** (configurações do chat) pelo botão no chat. Ele começa no canto superior direito, a menos que você o tenha movido.
3. Abra a seção **Agents**.
4. Ative a opção **Enable Agents**, caso ainda não esteja ativa.
5. Adicione o agente **Combat** ao chat.

Agora deve aparecer o botão **Encounter** (com o ícone de espadas cruzadas) na fileira de ações acima da caixa de mensagem. A dica dele diz **Start Combat Encounter**. Se o botão não aparecer, o agente **Combat** não está ativo nesse chat.

Para conhecer o painel **Agents** por inteiro e entender como os agentes funcionam, veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

## Começar um encontro

Clique no botão **Encounter** para abrir a caixa de configuração, chamada **Configure Combat Narrative**. Ela define o estilo de escrita que a IA usa durante e depois da luta.

A caixa de configuração tem dois grupos de estilo:

- **Combat Narration**: o estilo de escrita usado enquanto a luta acontece.
- **Summary Narration**: o estilo de escrita do resumo salvo no chat quando a luta termina.

Cada grupo tem os mesmos quatro controles:

- Tempo verbal: **Present Tense** ou **Past Tense**.
- Pessoa: **First Person**, **Second Person** ou **Third Person**.
- Narração: **Omniscient** (o narrador sabe de tudo) ou **Limited** (o narrador só sabe o que um personagem sabe).
- Um campo de ponto de vista: escreva por quais olhos a cena é contada. Deixe o campo em branco para manter uma voz neutra de narrador.

Abaixo dos grupos de estilo fica o menu suspenso opcional **Spellbook**. Um spellbook é um lorebook especial (um conjunto de fatos do seu mundo salvo em entradas) que lista as magias e habilidades disponíveis na luta. Escolha um para que a IA saiba o que os seus personagens podem conjurar. Deixe em **None** se você não usa spellbooks.

Quando tudo estiver pronto, clique em **Begin Combat**. Clique em **Cancel** para fechar a configuração sem começar a luta.

Depois do clique em **Begin Combat**, o aplicativo mostra "Initializing combat encounter..." enquanto a IA monta a luta. Ela cria os inimigos, a sua equipe, os ataques e os itens de cada um. Isso leva alguns segundos.

## Conduzir o encontro (a janela de encontro)

A tela de batalha completa (a janela de encontro) se chama **Combat Encounter**. Ela tem estas partes:

- **Enemies**: uma grade de cards de inimigos. Cada card mostra uma barra de vida e os efeitos de status ativos.
- **Party**: o seu lado da luta. O seu próprio personagem aparece marcado com **(You)**.
- **Combat Log**: o registro contínuo do que acontece em cada turno.
- **Your Actions**: os botões que você usa no seu turno.

Em **Your Actions** você tem estas opções:

- Escolher um dos seus **Attacks**.
- Usar um dos seus **Items**.
- Escrever uma ação livre no campo **Custom Action** e enviá-la. Use isso para tudo que os botões não cobrem, por exemplo "I kick sand into the guard's eyes".

Quando um ataque ou item precisa de alvo, abre a caixa **Select Target**. Escolha um inimigo ou aliado específico, ou escolha **All Enemies** para um ataque em área que atinge todos os inimigos de uma vez. Algumas ações só funcionam em área e pulam a escolha de alvo único.

Enquanto a IA resolve um turno, a tela mostra "Processing action..." e os botões ficam travados. Eles destravam quando o turno termina.

Se a IA devolver dados que o aplicativo não consegue ler, aparece a tela **Combat Error** no lugar de um aplicativo quebrado. Clique em **Close Encounter** nessa tela para sair da luta com segurança.

## Encerrar um encontro

Há duas formas de terminar uma luta antes da hora, além do fim natural, quando um dos lados vence.

- Clique em **Conclude**, na barra superior, para terminar a luta antes da hora. Uma caixa de confirmação pergunta primeiro. Em seguida, o aplicativo salva um resumo do combate no chat.
- Clique no botão **X**, na barra superior, para fechar e descartar a luta. Uma caixa de confirmação chamada **End Combat** pergunta primeiro. Nesse caso, o aplicativo não salva nenhum resumo.

Quando a luta termina naturalmente, aparece uma faixa com o resultado: **VICTORY**, **DEFEAT**, **FLED** ou **INTERRUPTED**. Depois, o aplicativo salva no chat uma mensagem com o resumo do combate, no estilo **Summary Narration** que você escolheu. Assim que o resumo ficar pronto, clique em **Close Combat Window** para voltar à cena.

Se o resumo não for gerado, o botão passa a mostrar **Close Anyway**. Clique nele para voltar à cena sem resumo.

## Diferenças em relação ao combate do Game Mode

Os encontros de combate são uma camada de combate mais leve e separada, feita para o Roleplay Mode. O Game Mode tem o próprio sistema de combate, já embutido.

As diferenças principais:

- No Roleplay, quem começa o encontro é você, pelo botão **Encounter**. No Game Mode, o Game Master de IA começa o combate quando a história pede.
- O combate do Roleplay exige o agente **Combat** ativado. O combate do Game Mode não usa o agente **Combat** e funciona sem ele.
- Os dois sistemas usam telas de batalha diferentes e nada é compartilhado entre eles.

Para conhecer o sistema de batalha, veja [Game Mode: combate](../game/combat.md).

## Guias relacionados

- [Roleplay Mode: primeiros passos](getting-started.md)
- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Game Mode: combate](../game/combat.md)
