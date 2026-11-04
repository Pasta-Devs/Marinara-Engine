# Encontros de combate (Roleplay)

Um encontro de combate dá a uma cena de Roleplay uma tela de batalha por turnos, com barras de vida, listas de inimigos e da equipe, e um registro do combate. Ele é opcional. Um chat sem ele funciona como antes. O Game Mode tem o próprio combate, separado: veja [Game Mode: combate](../game/combat.md).

## Ativar o combate

Um agente é um ajudante que roda junto com as respostas. O agente **Combat** acrescenta o recurso de batalha. Ele vem desativado por padrão, então você o ativa chat a chat.

1. Abra o chat. Abra **Chat Settings** (configurações do chat) pelo botão de controles deslizantes no chat.
2. Vá até **Agents**.
3. Ative a opção **Enable Agents**, se ela estiver desativada.
4. Adicione o agente **Combat** pelas listas abaixo do botão liga/desliga.

Agora aparece o botão **Encounter** (espadas cruzadas) acima da caixa de mensagem. A dica dele diz **Start Combat Encounter**.

Se não funcionou: sem o botão, o agente **Combat** não está ativo neste chat. Para entender como os agentes funcionam, veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

## Começar um encontro

1. Clique em **Encounter**. A caixa **Configure Combat Narrative** abre. Ela define o estilo de escrita que a IA usa.
2. Escolha o estilo de **Combat Narration** (enquanto a luta acontece) e de **Summary Narration** (o resumo escrito no chat quando ela termina). Os dois grupos têm as mesmas quatro configurações, listadas abaixo. Os padrões funcionam, então você pode clicar em **Begin Combat** na hora.
3. Opcional: escolha um **Spellbook**. Um spellbook é um lorebook (um conjunto salvo de fatos do mundo) que lista as magias e habilidades disponíveis na luta. Deixe em **None** se você não usa um.
4. Clique em **Begin Combat**. Clique em **Cancel** para fechar a caixa sem lutar.

Você vê "Initializing combat encounter..." enquanto a IA monta os inimigos, a sua equipe e os ataques e itens deles. Isso pode levar alguns segundos.

| Controle de estilo | Opções |
| --- | --- |
| Tempo verbal | **Present Tense**, **Past Tense** |
| Pessoa | **First Person**, **Second Person**, **Third Person** |
| Narração | **Omniscient**: sabe de tudo. **Limited**: sabe o que um personagem sabe. |
| Ponto de vista | Um campo de texto para dizer por quais olhos a cena é contada. Deixe em branco para um narrador neutro. |

## Jogar o seu turno

A tela **Combat Encounter** tem quatro partes:

- **Enemies**: cartões com uma barra de vida e os efeitos de status.
- **Party**: o seu lado. O seu próprio personagem aparece marcado com **(You)**.
- **Combat Log**: um registro de cada turno.
- **Your Actions**: os seus botões.

No seu turno, escolha um ataque em **Attacks**, use um item em **Items** ou escreva uma ação livre em **Custom Action** e envie, por exemplo "I kick sand into the guard's eyes".

Quando uma ação precisa de alvo, abre a caixa **Select Target**. Escolha um inimigo ou aliado, ou **All Enemies** para um ataque em área. As ações só de área pulam esta etapa.

Enquanto a IA resolve o turno, você vê "Processing action..." e os seus botões ficam travados. Eles destravam quando o turno termina.

Se não funcionou: se a IA devolver dados que o aplicativo não consegue ler, aparece a tela **Combat Error**. Clique em **Close Encounter** para sair da luta com segurança e depois comece uma nova.

## Encerrar um encontro

- **Conclude**, na barra superior, termina a luta antes da hora. Uma caixa pede confirmação e depois um resumo do combate é escrito no chat.
- O **X**, na barra superior, fecha e descarta a luta, depois de uma caixa de confirmação chamada **End Combat**. Nenhum resumo é escrito.
- Quando um dos lados vence, uma faixa mostra **VICTORY**, **DEFEAT**, **FLED** ou **INTERRUPTED**. Um resumo é escrito no chat no seu estilo de **Summary Narration**. Quando ele ficar pronto, clique em **Close Combat Window**.

Se o resumo falhar, o botão passa a mostrar **Close Anyway**. Clique nele para voltar à cena sem resumo.

## Diferenças em relação ao combate do Game Mode

- No Roleplay, quem começa o encontro é você, com **Encounter**. No Game Mode, o Game Master começa o combate quando a história pede.
- O combate do Roleplay precisa do agente **Combat**. O combate do Game Mode, não.
- Os dois sistemas usam telas de batalha diferentes.

## Guias relacionados

- [Roleplay Mode: primeiros passos](getting-started.md)
- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Game Mode: combate](../game/combat.md)
