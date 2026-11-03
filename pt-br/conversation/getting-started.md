# Conversation Mode: primeiros passos

O Conversation Mode é o modo de chat no estilo de mensageiro: um ou mais personagens, uma barra de entrada e um histórico que rola, como trocar mensagens com um amigo. Ele não tem mestre de jogo nem arte de cena. Os personagens também podem enviar mensagens primeiro, seguir agendas semanais, enviar selfies e jogar jogos de mesa, e esses recursos existem só neste modo.

## Inicie um chat de Conversation

Antes de começar: adicione uma conta em **Connections** (veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)) e tenha pelo menos um personagem. Uma persona, o cartão de personagem que representa você, é opcional (veja [Personas de usuário](../characters/personas.md)).

1. Na barra lateral de chats, abra a aba **CONVO** e clique em **New Conversation**. Um assistente de configuração com quatro páginas se abre.
2. Na primeira página, **Name & Connection**, dê um nome ao chat e escolha a conta que escreve as respostas.
3. Na segunda página, **Prompt Preset**, escolha o preset do prompt de Conversation, ou mantenha o padrão.
4. Na terceira página, **Persona & Characters**, escolha a sua persona e um ou mais personagens.
5. Na última página, **Automation**, escolha o quanto os personagens fazem por conta própria (veja a tabela abaixo).
6. Clique em **Start Chatting**.

Um personagem forma um chat privado. Dois ou mais formam um chat em grupo, sem precisar de outro modo. Veja [Chats em grupo](../chats/group-chats.md) para a ordem dos turnos.

Se não funcionou: **Start Chatting** precisa de uma conta e de pelo menos um personagem. Você pode fechar o assistente e definir tudo depois em **Chat Settings**.

## Escolha as opções de Automation

| Opção | Padrão | O que ela faz |
| --- | --- | --- |
| **Autonomous Messages** | Ativada | Os personagens enviam mensagem primeiro quando você fica um tempo em silêncio. |
| **Generate Schedules** | Desativada | Cria uma rotina semanal para cada personagem. Aparece só quando **Autonomous Messages** está ativada. |
| **Commands** | Desativada | Chave geral das ações que um personagem faz por conta própria. |

Ative **Generate Schedules** e escolha o seu fuso horário no campo que aparece. Em **Chat Settings**, a mesma chave se chama **Schedules**. As agendas e os limites de check-in estão em [Agendas de personagens e mensagens autônomas](schedules.md).

Mude essas opções depois em **Chat Settings → Autonomous Messaging**. Se os personagens escrevem com frequência demais, desative **Autonomous Messages** ali, ou defina a sua presença como **Do Not Disturb**.

<a id="choose-which-commands-a-character-can-use"></a>

## Escolha quais Commands um personagem pode usar

Commands são ações que o personagem decide fazer sozinho. Você não os digita. Depois da configuração, abra **Chat Settings → Agents → Commands**. A chave geral **Commands** controla todas as famílias: quando ela está desativada, nenhuma família funciona.

Cada família tem a sua própria chave. Todas começam ativadas, exceto **Videos**, que você mesmo precisa ativar. As famílias que pertencem a um agente opcional só aparecem quando você instala esse agente em **Agents → Agent Organizer**.

| Família | O que um personagem pode fazer | Precisa de um agente |
| --- | --- | --- |
| **Schedule Updates** | Mudar o seu status atual. | Não |
| **Cross-Post** | Enviar uma mensagem para outro chat. | Não |
| **Memories** | Criar memórias para outros personagens. | Não |
| **Scenes** | Iniciar uma cena imersiva. | Não |
| **Influence** | Influenciar um chat conectado. | Não |
| **Notes** | Salvar notas duradouras para um chat conectado. | Não |
| **Reactions** | Reagir a mensagens com selos de emoji. | Não |
| **Selfies** | Pedir uma selfie gerada. | Illustrator |
| **Videos** | Enviar mensagens curtas em vídeo. | Illustrator |
| **Music** | Tocar músicas pelo Music Player ativo. | Music DJ |
| **Haptics** | Controlar dispositivos hápticos conectados. | Haptic Feedback |
| **Calls** | Ligar para você em uma chamada. | Calls |
| **UNO** | Iniciar ou aceitar uma partida de UNO. | UNO |
| **Chess** | Aceitar um desafio de xadrez. | Chess |
| **Poker** | Sentar para jogar Texas Hold'em. | Poker |
| **8-Ball Pool** | Montar uma partida de sinuca. | 8-Ball Pool |
| **Tic-Tac-Toe** | Aceitar um desafio de jogo da velha. | Tic-Tac-Toe |
| **Rock-Paper-Scissors** | Aceitar uma partida. | Rock-Paper-Scissors |

Para **Influence** e **Notes**, veja [Chats conectados](../chats/connected-chats.md). A última coluna indica o agente a instalar em **Agent Organizer**.

<a id="your-presence-status"></a>

## O seu status de presença

A sua presença é uma pílula colorida no rodapé da barra lateral. Ela é a mesma em todos os chats. Clique nela para escolher:

| Status | Significado |
| --- | --- |
| **Active** | Você está online. |
| **Idle** | Você está ausente. |
| **Do Not Disturb** | Interrompe as mensagens autônomas. |
| **Invisible** | Esconde o seu status dos modelos. |

Se você fica em **Active** e não faz nada por 10 minutos, o Marinara define **Idle** e volta a definir **Active** quando você retorna. Se você mesmo escolhe um status, essa mudança automática para até você escolher **Active** de novo. **Idle** não interrompe os check-ins.

Ao lado da pílula fica a caixa de status, que mostra "What's up?" quando está vazia. Digite ali a sua atividade atual (até 120 caracteres) para os personagens saberem. As entradas recentes aparecem em **Recent status**, para você reutilizá-las.

<a id="react-and-get-notified"></a>

## Reaja e receba notificações

Use **Add reaction** em uma mensagem para reagir com um emoji. As respostas seguintes podem ver a sua reação. Com o comando **Reactions** ativado, os personagens podem reagir às suas mensagens e às mensagens uns dos outros.

Quando um personagem escreve em um chat que você não está vendo, uma bolha de avatar aparece na borda da tela. Clique nela para abrir esse chat, ou clique no X dela para dispensá-la. No celular, várias bolhas se juntam em um grupo em que você pode tocar.

## Bom saber

Um chat de Conversation não usa a **First Message** do cartão de personagem, nem a **Dialogue Highlight Color** e a **Message Box Color** dele. A **Name Display Color** ainda colore o nome acima de cada mensagem. Veja [Onde as suas cores aparecem](../characters/colors-and-stats.md#where-your-colors-show).

## Recursos relacionados

- [Selfies](selfies.md): os personagens enviam fotos geradas deles mesmos.
- [Chamadas de áudio e vídeo no Conversation](calls.md)
- [Jogos de mesa](table-games.md): inicie um jogo com `/uno`, `/chess`, `/poker`, `/8ball`, `/tictactoe` ou `/rps`.
- [Agendas de personagens e mensagens autônomas](schedules.md)
- [Perfis do Conversation Mode](profiles.md)
- [Emojis, stickers e GIFs personalizados](emoji-stickers-gifs.md)
- [Chats conectados](../chats/connected-chats.md)

## Solução de problemas

| Sintoma | Solução |
| --- | --- |
| Os personagens escrevem com frequência demais | Desative **Autonomous Messages**, defina **Do Not Disturb**, ou marque mais horas como ausente nas [agendas](schedules.md). |
| Um personagem responde a tudo em um grupo | Defina quem fala em [Chats em grupo](../chats/group-chats.md). |
| Um personagem esquece o que veio antes no chat | Use um modelo com uma janela de contexto maior (quanto texto ele lê de uma vez), ou adicione fatos importantes a uma entrada de lorebook. |
| Uma selfie não se parece com o personagem | Veja [Selfies](selfies.md). |

Mais ajuda: [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).
