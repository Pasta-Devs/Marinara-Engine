# Jogos de mesa no Conversation

Jogue UNO, xadrez, pôquer, sinuca 8-Ball Pool, jogo da velha e pedra, papel e tesoura contra os personagens de um chat de Conversation. O Marinara distribui as cartas ou monta o tabuleiro, aplica todas as regras e faz cada personagem sentado narrar as suas jogadas no papel dele. Um tabuleiro ao vivo aparece acima da caixa de mensagem enquanto você joga.

Cada jogo é um pacote opcional. Instale os que você quer em **Agents → Agent Organizer** e reinicie o Marinara quando o catálogo pedir. Um jogo que você não instalou não tem comando de barra, não aparece no seletor de jogos e a chave **Commands** dele fica escondida.

Regras que valem para todo jogo:

- Os jogos de mesa funcionam só no Conversation Mode. Em um chat de Roleplay, você vê uma mensagem dizendo que eles só podem ser jogados em chats de Conversation.
- Um jogo pode estar ativo por chat. Iniciar um jogo novo substitui o atual, mesmo um jogo terminado que ainda mostra um banner final.
- O chat precisa de pelo menos um personagem, e você precisa sentar pelo menos um como bot. As jogadas do bot usam o mesmo modelo das respostas normais do chat. Não é preciso uma conta extra nem uma chave de API.

## Inicie um jogo

Antes de começar: instale o jogo e abra um chat de Conversation com pelo menos um personagem.

1. Digite o comando de barra do jogo (uma instrução curta que começa com `/`) na caixa de mensagem e pressione <kbd>Enter</kbd>. A janela de configuração do jogo se abre.
2. Escolha as opções (veja cada jogo abaixo).
3. Clique em **Deal** ou **Start game**.

Se não funcionou: o comando está ausente ou não faz nada quando o jogo não está instalado ou você não está em um chat de Conversation.

| Jogo | Comando | Jogadores |
| --- | --- | --- |
| UNO | `/uno` | Você mais 1 a 9 personagens |
| Chess | `/chess` | Você e um personagem |
| Poker | `/poker` | Você mais 1 a 7 personagens |
| 8-Ball Pool | `/8ball` ou `/pool` | Você e um personagem |
| Tic-Tac-Toe | `/tictactoe` ou `/ttt` | Você e um personagem |
| Rock-Paper-Scissors | `/rps` | Você e um personagem |

Outras formas de iniciar um jogo:

- Digite `/games` para escolher entre os jogos instalados.
- Diga em uma mensagem normal, como "let's play uno", "start a game of chess" ou "deal me into poker". A janela de configuração se abre e a sua mensagem é enviada, para um personagem poder reagir ao seu convite. Isso acontece só quando o jogo ainda não está em andamento.
- Um personagem pode oferecer ou aceitar um jogo por conta própria. A resposta dele então inicia o jogo na hora, com as regras padrão e sem janela de configuração. Se ele está ocupado ou recusa, ele diz isso no papel dele.
- Um personagem só pode fazer isso quando a chave **Commands** do jogo está ativada (veja [Deixe os personagens iniciarem jogos por conta própria](#let-characters-start-games-on-their-own)).

## UNO

A janela de configuração se chama **Start UNO**.

- **Players**: marque cada personagem que joga como bot. Todos vêm marcados por padrão. **You go first** vem marcado por padrão.
- **Starting hand**: cartas por jogador, de 1 a 10. O padrão é **7**.
- **Penalize missed UNO**: marcada por padrão. Um jogador pego sem declarar UNO compra 2 cartas, e **Catch!** fica ativo.
- **House rules**, todas desativadas por padrão:
  - **Stacking**: empilhe +2/+4 na próxima compra em vez de comprar.
  - **Draw to match**: continue comprando até ter uma carta jogável.
  - **7-0 rule**: um 7 troca de mão com um jogador escolhido, e um 0 gira todas as mãos.
  - **Jump-in**: jogue uma carta idêntica fora do turno.
  - **Force play**: se uma carta comprada é jogável, você precisa jogá-la.

**Deal** fica desativado até você escolher pelo menos um personagem. Ele mostra o número de jogadores, por exemplo **Deal (3p)** para você e dois personagens.

No tabuleiro:

- As cartas jogáveis se levantam e o resto escurece. Clique em uma carta para jogá-la.
- Uma carta coringa abre "Pick a color:". Com a **7-0 rule** ativada, um 7 abre "Swap hands with:".
- Os botões aparecem conforme necessário: **Draw**, **Pass**, **Call UNO!** e **Catch!**.
- Jogar a sua penúltima carta declara UNO por você.
- Um banner mostra "{winner} wins!" ou "Game over".

## Chess

A janela de configuração se chama **Start Chess**. Escolha um **Opponent** (o primeiro personagem por padrão). Em um chat em grupo, os outros continuam conversando. **Your color**: **White**, **Random** (padrão) ou **Black**. Clique em **Start game**.

Clique em uma das suas peças para selecioná-la. As jogadas legais aparecem como um ponto, e as capturas como um anel. Jogar de Black vira o tabuleiro. Um peão na última fileira abre "Promote to:" (Queen, Rook, Bishop, Knight). Um banner anuncia xeque-mate, um empate com o motivo, ou "Game over", e uma faixa abaixo do tabuleiro lista as jogadas recentes.

## Poker

A janela de configuração se chama **Start Poker**. A mesa tem de 2 a 8 lugares.

- **Players**: marque os personagens a sentar. Com sete, o resto fica esmaecido.
- **Dealer**: **House dealer (silent)** (padrão) distribui sem comentários. Ou escolha um personagem para anunciar as rodadas e os showdowns.
- **Starting stack**: fichas por jogador, de 100 a 1,000,000. O padrão é **1000**.
- **Small blind**: o big blind é o dobro. O padrão é **10**.
- **Blinds double every**: mãos entre os aumentos de blind. O padrão é **0**, que significa nunca.
- **Hand limit**: a sessão termina depois desse número de mãos, e quem tem mais fichas vence. O padrão é **0**, que joga até um jogador ficar com todas as fichas.

No seu turno, a barra mostra **Fold**, **Check**, **Call** e **All in**. Quando você pode apostar ou aumentar, uma caixa de aposta adiciona os botões **Min**, **½ pot**, **Pot** e **All-in**. Depois de cada mão, um painel **Showdown** entrega o pote, e **Next hand** distribui de novo. No fim da sessão, um banner nomeia o vencedor e lista todas as pilhas finais.

## 8-Ball Pool

A janela de configuração se chama **Start 8-Ball Pool**.

- **Opponent**: o personagem contra quem você joga.
- **Announcer**: **Silent (no announcer)** por padrão, ou um personagem que narra as tacadas.
- **Match length**: **Race to 1**, **Race to 3** ou **Race to 5** racks (um rack é um jogo completo).
- **Who breaks first**: **You**, **Random** ou **Them**. Os racks seguintes alternam a abertura.

Clique em **Start game**. No seu turno, escolha uma das tacadas sugeridas e as bolas rolam em uma simulação de física. Uma linha abaixo da mesa descreve a última tacada.

## Tic-Tac-Toe e Rock-Paper-Scissors

Em **Tic-Tac-Toe**, escolha o oponente e se você joga como **X**, **O** ou uma marca aleatória. O X joga primeiro. Clique em um quadrado vazio no seu turno. As jogadas ilegais são bloqueadas, e as vitórias e os empates são detectados por você.

Em **Rock-Paper-Scissors**, escolha o oponente e uma partida de melhor de três, cinco ou sete. Escolha **Rock**, **Paper** ou **Scissors** a cada rodada. As escolhas ficam escondidas até as duas estarem feitas, e então o resultado e o placar se atualizam.

## Encerre um jogo mais cedo

Todo tabuleiro tem um botão X.

- **UNO**: **End game**. Ele pergunta "End this UNO game?" primeiro.
- **Chess**: **Resign**. Ele pergunta "Resign and end this game?" primeiro.
- **Poker**: **End game**. Ele pergunta "End this poker game?" primeiro. Depois que a sessão termina, ele mostra **Close**.
- **8-Ball Pool**: **End game**. Ele pergunta "End this pool game?" primeiro. Depois que a partida termina, ele mostra **Close**.
- **Tic-Tac-Toe** e **Rock-Paper-Scissors**: use o botão de fechar ou de encerrar do tabuleiro para limpar a partida.

Encerrar um jogo mais cedo exclui o estado dele e não registra vencedor.

<a id="let-characters-start-games-on-their-own"></a>

## Deixe os personagens iniciarem jogos por conta própria

Abra **Chat Settings → Agents → Commands**, ou use a etapa **Automation** quando você cria o chat. A chave geral **Commands** controla todas as ações executadas pelos personagens, incluindo jogos de mesa, selfies e chamadas. Com ela desativada, os personagens não iniciam nada por conta própria.

Cada jogo instalado tem a sua própria chave, ativada, a menos que você a desative: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** e **Rock-Paper-Scissors**. Veja [Escolha quais Commands um personagem pode usar](getting-started.md#choose-which-commands-a-character-can-use).

Essas chaves controlam só o que os personagens fazem. O comando de barra de um jogo e a frase "let's play" funcionam mesmo com a chave desativada.

## Guias relacionados

- [Conversation Mode: primeiros passos](getting-started.md)
- [Referência de comandos de barra](../chats/slash-commands.md)
