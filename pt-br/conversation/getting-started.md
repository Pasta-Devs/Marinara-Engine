# Conversation Mode: primeiros passos

Este guia explica o Conversation Mode, o modo de chat em estilo mensageiro que Marinara Engine oferece. Aqui você vê o que é esse modo e como funciona o assistente de configuração de quatro etapas. O guia também apresenta os recursos exclusivos do Conversation: mensagens autônomas, status de presença, reações, selfies e jogos de mesa.

## O que é o Conversation Mode

O Conversation Mode é um dos modos de chat do Marinara Engine. Ele funciona como um aplicativo de mensagens. Você tem um ou mais personagens, uma barra de digitação e um histórico de mensagens que rola na tela.

Pense em mandar mensagens diretas, as DMs, do mesmo jeito que você escreve para um amigo. Não existe game master, nem arte de cena, nem mecânica obrigatória. É o modo de chat mais leve, e muitos usuários passam a maior parte do tempo nele.

O Conversation Mode traz recursos que só fazem sentido em uma relação contínua de mensageiro. Os personagens têm status online ou ausente e agendas semanais. Eles podem mandar mensagem primeiro, enviar selfies, reagir com emoji e jogar jogos de mesa. Cada personagem e cada persona também ganha um pequeno perfil no estilo Discord, com nome de exibição e um "sobre mim". Veja [Perfis do Conversation Mode](profiles.md) para conhecer esses campos de perfil.

Nenhum desses recursos exclusivos do Conversation funciona no Roleplay Mode ou no Game Mode, mesmo quando você reutiliza o mesmo card de personagem lá.

Alguns campos do card funcionam ao contrário. Um chat de Conversation não começa com a **First Message** (primeira mensagem) do card nem com outra saudação; só os chats de Roleplay começam assim. Ele também não usa a **Dialogue Highlight Color** nem a **Message Box Color** do card. A **Name Display Color** continua colorindo o nome do personagem acima de cada mensagem. Veja [Onde as cores aparecem](../characters/colors-and-stats.md#where-your-colors-show).

### Quando escolher o Conversation Mode

Escolha o Conversation Mode quando quiser:

- Conversar com um personagem como se estivesse mandando DM para um amigo, só com texto de ida e de volta.
- Falar com mais de um personagem ao mesmo tempo, em um mesmo chat.
- Deixar os personagens agirem sozinhos: enviar mensagens, seguir agendas e reagir ao longo do tempo.

Prefira o Roleplay Mode ou o Game Mode quando quiser arte de cena, como sprites (a imagem do personagem no palco) e planos de fundo, ou mecânicas de jogo estruturadas.

## O assistente de configuração de quatro etapas

Ao iniciar um novo chat de Conversation, aparece um assistente de configuração com quatro etapas. Você pode fechá-lo e configurar tudo depois, pelo painel lateral de configurações do chat. As quatro etapas são:

1. **Name & Connection** (nome e conexão): dê um nome ao chat e escolha a conexão de IA que os personagens usam. A conexão é um acesso salvo a um provedor de IA. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).
2. **Prompt Preset** (preset de prompt): escolha qual preset fornece o prompt do Conversation, ou seja, o texto que Marinara envia para a IA. Você também pode manter o padrão.
3. **Persona & Characters** (persona e personagens): escolha a persona e um ou mais personagens.
4. **Automation** (automação): defina o quanto os personagens podem fazer por conta própria.

A persona é o personagem que você interpreta. Veja [Personas do usuário](../characters/personas.md).

A quantidade de personagens escolhidos define o formato do chat. Um personagem cria uma DM privada. Dois ou mais criam um chat em grupo, sem precisar ativar nenhum modo extra. Os controles de chat em grupo estão em [Chats em grupo](../chats/group-chats.md).

Com uma conexão definida e pelo menos um personagem escolhido, clique em **Start Chatting** (começar a conversar) para abrir o chat.

### A etapa Automation

A etapa **Automation** sempre traz estes controles:

| Botão liga/desliga | Padrão | O que faz |
|---|---|---|
| **Autonomous Messages** | On | Os personagens podem mandar mensagem primeiro quando você está inativo. |
| **Generate Schedules** | Off | Cria rotinas semanais opcionais. Só aparece com o botão **Autonomous Messages** ativado. |

Se você instalou um pacote de agente que acrescenta comandos do Conversation, a etapa também mostra **Commands** (comandos). As chamadas, as selfies do Illustrator, o Music DJ, o Haptic Feedback e cada jogo de mesa aparecem só quando os pacotes correspondentes estão instalados. Sobre chamadas, veja [Chamadas de áudio e vídeo no Conversation Mode](calls.md).

### A grade de comandos

Quando a seção **Commands** está disponível e ativada, aparece uma grade com até 17 famílias de comandos. Cada uma é uma ação oculta que o personagem executa por conta própria. As opções que pertencem a um pacote só aparecem quando aquele pacote está instalado. Toda família visível começa ativada. Desativar um botão remove apenas aquela família. Os comandos são ações conduzidas pelo modelo, não algo que você digita.

A lista completa de famílias de comandos é esta:

- **Schedule Updates**: os personagens podem mudar o próprio status atual.
- **Cross-Post**: os personagens podem redirecionar uma mensagem para outro chat.
- **Selfies**: os personagens podem pedir selfies geradas por IA.
- **Memories**: os personagens podem criar lembranças para outros personagens.
- **Scenes**: os personagens podem iniciar uma cena imersiva.
- **Music**: os personagens podem tocar músicas pelo Music Player ativo.
- **Haptics**: os personagens podem controlar dispositivos hápticos conectados.
- **Influence**: os personagens podem influenciar um chat conectado.
- **Notes**: os personagens podem salvar notas duradouras em um chat conectado.
- **Calls**: os personagens podem chamar você para uma chamada do Conversation.
- **Reactions**: os personagens podem reagir às mensagens com selos de emoji.
- **UNO**: os personagens podem começar uma partida de UNO na mesa, quando você aceitar jogar.
- **Chess**: os personagens podem aceitar um desafio de xadrez, um contra um, na mesa.
- **Poker**: os personagens podem sentar à mesa para uma partida de pôquer Texas Hold'em.
- **8-Ball Pool**: os personagens podem montar uma partida de sinuca 8-ball na mesa.
- **Tic-Tac-Toe**: os personagens podem aceitar um desafio de jogo da velha, um contra um.
- **Rock-Paper-Scissors**: os personagens podem aceitar uma disputa de pedra, papel e tesoura, um contra um.

Um botão liga/desliga principal, o **Commands**, controla todas elas. Com esse botão desativado, nenhuma família de comandos funciona, mesmo que pareça ativada.

## Mensagens autônomas e o status de presença

As mensagens autônomas deixam o personagem procurar você primeiro. Com o botão **Autonomous Messages** ativado, um personagem envia uma mensagem depois de um tempo de silêncio seu. O personagem leva em conta o quanto ele é falante e, se as agendas estiverem ativas, a própria disponibilidade. Ao terminar o assistente de configuração, as mensagens autônomas ficam ativadas por padrão.

Esse botão pode ser mudado depois. Abra o painel lateral de configurações do chat e procure a seção **Autonomous Messaging** (mensagens autônomas).

### O status de presença

Você tem um status de presença que influencia quando os personagens procuram você. Ele fica no rodapé da barra lateral, como uma pílula colorida com o status atual. Clique na pílula para escolher uma das quatro opções:

- **Active**: você está online e disponível.
- **Idle**: marcado automaticamente quando você se ausenta.
- **Do Not Disturb**: bloqueia as mensagens autônomas.
- **Invisible**: esconde o seu status dos personagens.

Ao lado da pílula fica o campo **What are you doing?** (o que você está fazendo?). Digite ali uma atividade curta, se quiser que os personagens saibam o que você está fazendo. O status de presença é global, ou seja, vale igual em todos os chats.

## Reações e notificações

Qualquer mensagem do Conversation pode receber uma reação em emoji. Use o botão de reação da mensagem para acrescentar a sua. Marinara salva a reação como uma nota do tipo `[User reacted with ...]`, e as respostas seguintes conseguem ver esse registro. Assim, o personagem percebe que você reagiu.

Com a família de comandos **Reactions** ativada, os personagens também reagem. Eles reagem às suas mensagens ou às mensagens uns dos outros. As reações são úteis nos chats em grupo, porque o personagem responde de leve, sem precisar de uma mensagem inteira.

Quando um personagem manda mensagem em um chat que você não está vendo, aparece uma bolha flutuante com o avatar na borda da tela. Clique na bolha para pular para aquele chat, ou dispense a bolha no botão X. No celular, várias bolhas pendentes se juntam em um único grupo que você pode tocar.

## Selfies

Os personagens podem enviar selfies, que são fotos do personagem geradas por IA. A selfie é diferente da arte de cena usada no Roleplay e no Game Mode, porque está ligada a um único personagem.

Para usar as selfies, instale o agente **Illustrator** em **Agents → Download Agents**. Depois abra o painel lateral de configurações do chat, vá em **Agents → Illustrator Settings** e defina uma **Selfie Connection** (conexão para selfies). Essa conexão aponta para um provedor de geração de imagens. Cada selfie consome uma chamada de geração de imagens.

A configuração completa, com estilo, resolução e o botão de pedido manual, está em [Selfies](selfies.md).

## Jogos de mesa

O Conversation Mode tem seis pacotes opcionais de jogos de mesa: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** e **Rock-Paper-Scissors**. Instale os jogos que quiser em **Agents → Download Agents**. O aplicativo distribui as peças, aplica as regras e faz cada personagem narrar as próprias jogadas sem sair do papel. Os jogos de mesa funcionam apenas em chats do Conversation.

Há três formas de começar uma partida:

1. Digite um comando de barra na caixa de mensagem e pressione Enter.
2. Digite uma mensagem comum, como "vamos jogar uno".
3. Deixe um personagem convidar você, com a família de comandos dele ativada.

Os comandos de barra são:

```
/uno
```

```
/chess
```

```
/poker
```

```
/8ball
```

```
/tictactoe
```

```
/rps
```

Cada jogo tem a própria caixa de configuração, com opções. Para as regras completas, as caixas de configuração e os tabuleiros, veja [Jogos de mesa](table-games.md).

## Agendas dos personagens

Cada personagem de um chat do Conversation pode ter uma agenda semanal. A agenda define o status e a atividade do personagem em uma grade de 7 dias por 24 horas. Com isso, as mensagens autônomas respeitam a rotina: um personagem marcado como ausente não procura você naquelas horas.

Você monta uma agenda durante a configuração, ativando o botão **Generate Schedules**. Outra opção: criar ou editar a agenda depois, na seção **Autonomous Messaging** do painel lateral de configurações do chat. O guia [Agendas de personagem e mensagens autônomas](schedules.md) explica o editor de agenda completo, os limites diários e o comando `/status`, que sobrepõe a agenda.

## Solução de problemas

### As mensagens autônomas chegam com frequência demais

Abra o painel lateral de configurações do chat e desative o botão **Autonomous Messages**, na seção **Autonomous Messaging**. Outra opção: colocar o status de presença em **Do Not Disturb**, que bloqueia as mensagens autônomas. Se você usa agendas, marque mais horas como ausente em [Agendas de personagem e mensagens autônomas](schedules.md).

### Um personagem responde a tudo no chat em grupo

Os chats em grupo têm controles de revezamento, como a opção **Reply When Mentioned**. Abra [Chats em grupo](../chats/group-chats.md) para definir quem fala e quando.

### O personagem esquece o que aconteceu antes

Chats longos enchem a memória do modelo. Experimente um modelo com janela de contexto maior. Outra saída: acrescentar os fatos importantes a uma entrada de lorebook, o conjunto de fatos do seu mundo, para que fiquem sempre no contexto. Você também pode começar um chat novo com o mesmo personagem e a mesma persona. Para mais ajuda, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

### A selfie não parece o personagem

Abra as configurações de **Selfies** e defina **Attach Card Appearance** como **Images only** (só imagens) ou **Images and videos** (imagens e vídeos). Se o provedor de imagens aceitar imagens de referência, defina também **Send Avatar References**. Veja [Selfies](selfies.md) para os detalhes.

## Guias relacionados

- [Chamadas de áudio e vídeo no Conversation Mode](calls.md)
- [Agendas de personagem e mensagens autônomas](schedules.md)
- [Perfis do Conversation Mode](profiles.md)
- [Selfies](selfies.md)
- [Emojis personalizados, stickers e GIFs](emoji-stickers-gifs.md)
- [Jogos de mesa](table-games.md)
- [Conectar uma Conversation a um Roleplay ou Game](../chats/connected-chats.md)
