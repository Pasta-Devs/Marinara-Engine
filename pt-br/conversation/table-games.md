# Jogos de mesa no Conversation Mode

Este guia explica os seis pacotes opcionais de jogos de mesa que você pode jogar contra os personagens de um chat no Conversation Mode: **UNO**, **Chess** (xadrez), **Poker**, **8-Ball Pool** (sinuca), **Tic-Tac-Toe** (jogo da velha) e **Rock-Paper-Scissors** (pedra, papel e tesoura). Aqui você vê como iniciar uma partida e o que significa cada opção de configuração. O guia também mostra como jogar em cada tabuleiro e como deixar os personagens iniciarem partidas por conta própria.

## O que são os jogos de mesa

Jogos de mesa são pequenos jogos de tabuleiro que rodam dentro de um chat no Conversation Mode. Marinara Engine distribui as cartas ou monta o tabuleiro e cuida de todas as regras para você. Cada personagem sentado à mesa narra as próprias jogadas dentro do personagem. Um tabuleiro ao vivo aparece acima da caixa de mensagem enquanto você joga.

Instale cada jogo que quiser em **Agents → Agent Organizer (organizador de agentes)** . Ele fica disponível na hora, sem reiniciar Marinara. Um jogo não instalado não aparece no seletor de jogos, o comando de barra dele não funciona e a configuração de comando do personagem correspondente fica oculta.

Dois pontos importantes:

- Os jogos de mesa funcionam só no Conversation Mode. Não é possível iniciar uma partida em um chat de Roleplay ou Game Mode. Se você digitar um comando de jogo em um chat de Roleplay, aparece uma mensagem como "UNO can only be played in conversation chats."
- Só um jogo pode ficar ativo por chat de cada vez. Ao iniciar uma nova partida, ela substitui qualquer jogo em andamento naquele chat, mesmo um jogo já encerrado que ainda mostre a faixa de fim de partida.

Você também precisa de pelo menos um personagem no chat. Pelo menos um deles tem que ficar sentado à mesa como bot antes de distribuir as cartas ou começar. As jogadas dos bots e as falas dentro do personagem usam a mesma conexão das respostas normais do chat. Não é preciso outra conta nem outra chave de API. A **chave de API** é o código secreto que Marinara usa para conversar com um provedor de IA.

## Como iniciar uma partida

Há três formas de iniciar uma partida. As três funcionam só em um chat no Conversation Mode com pelo menos um personagem.

### Digite um comando de barra

Um **comando de barra** é uma instrução curta que você digita na caixa de mensagem começando com uma barra. Digite um destes e pressione Enter para abrir a janela de configuração do jogo:

- **/uno** inicia uma partida de UNO com os personagens deste chat.
- **/chess** inicia uma partida de xadrez um contra um com um personagem deste chat.
- **/poker** inicia uma partida de pôquer Texas Hold'em com os personagens deste chat.
- **/8ball** (ou **/pool**) inicia uma partida de sinuca 8-ball um contra um com um personagem deste chat.
- **/tictactoe** (ou **/ttt**) inicia uma partida de jogo da velha um contra um com um personagem deste chat.
- **/rps** inicia uma disputa de pedra, papel e tesoura um contra um com um personagem deste chat.

### Peça no chat

Outra opção: pedir em uma mensagem normal. Uma mensagem como "let's play uno", "start a game of chess" ou "deal me into poker" abre a janela de configuração daquele jogo automaticamente. A mensagem é enviada normalmente, então um personagem pode reagir ao convite na mesma resposta. Isso só acontece quando aquele jogo ainda não está rodando no chat.

### Deixe um personagem convidar você

Um personagem pode oferecer uma partida (ou aceitar a sua oferta) por conta própria. Quando o personagem está disposto a jogar naquele momento, a resposta dele já inicia a partida com as regras padrão do chat. Nenhuma janela de configuração aparece. Se o personagem estiver ocupado ou não quiser jogar, ele apenas diz isso dentro do personagem.

Para esse caminho funcionar, a configuração **Commands** (comandos) do chat precisa estar ativada, e o botão liga/desliga daquele jogo também. Veja "Deixe os personagens iniciarem partidas por conta própria", mais abaixo.

## UNO

### Como configurar o UNO

A janela de configuração se chama **Start UNO**.

Na seção **Players** (jogadores), marque cada personagem que você quer como bot na partida. Todos os personagens do chat vêm marcados por padrão. A caixa de seleção **You go first** vem marcada por padrão e dá o primeiro turno a você. Se o chat não tiver personagens, a seção mostra "Add at least one character to this chat to play."

A seção **House rules** (regras da casa) reúne regras opcionais. Todas vêm desativadas por padrão. Ative as que quiser:

| Regra | O que ela faz |
|---|---|
| **Stacking** | Empilha +2/+4 sobre o próximo jogador em vez de comprar cartas. |
| **Draw to match** | Compre cartas até tirar uma carta jogável. |
| **7-0 rule** | O 7 troca a mão com um jogador escolhido; o 0 gira todas as mãos. |
| **Jump-in** | Jogue uma carta idêntica fora do seu turno. |
| **Force play** | Se a carta comprada for jogável, você tem que jogá-la. |

Abaixo das regras, o campo **Starting hand** define com quantas cartas cada jogador começa. O padrão é **7**, e você pode escolher qualquer valor de 1 a 10. A caixa de seleção **Penalize missed UNO** vem marcada por padrão. Com ela ativada, o jogador flagrado sem declarar UNO compra 2 cartas, e a mecânica do "Catch!" fica ativa. Desativada, não há penalidade.

Clique em **Cancel** para fechar a janela ou em **Deal** para começar. O botão Deal mostra o número total de lugares na mesa, por exemplo **Deal (3p)** para você mais dois bots. Ele fica desativado até que pelo menos um personagem seja selecionado. O UNO comporta de 2 a 10 jogadores no total.

### Como jogar no tabuleiro do UNO

O tabuleiro aparece acima da caixa de mensagem, com o título **UNO**. Ele mostra a cor ativa e uma seta de direção que inverte quando sai um Reverse. Mostra também a quantidade de cartas do monte como "Draw pile: N", mais um selo "+N" quando há penalidade de compra acumulada. A linha do turno diz "Your turn" no seu turno ou o nome do personagem nos demais.

Os lugares aparecem na ordem de jogo. O seu lugar vem marcado com "(you)", o próximo a jogar aparece como "next", e qualquer lugar com uma única carta mostra "UNO?". Se um adversário chegar a uma carta sem declarar UNO, o botão **Catch!** permite denunciá-lo. Ele só aparece quando a regra **Penalize missed UNO** está ativada.

A sua mão aparece como cartas clicáveis. As cartas jogáveis sobem e ficam destacadas; as outras escurecem. Ao clicar em uma carta curinga, abre o seletor "Pick a color:". Com a regra **7-0 rule** ativada, clicar em um 7 abre o seletor "Swap hands with:". Botões extras aparecem conforme a necessidade, como **Draw**, **Pass** e um **Call UNO!** destacado quando você precisa declarar. Ao jogar a sua penúltima carta, o UNO é declarado junto, então nenhum bot consegue flagrar você naquele instante.

Quando a partida termina, uma faixa mostra "{winner} wins!" ou "Game over", se não houver um vencedor claro.

## Chess

### Como configurar o Chess

A janela de configuração se chama **Start Chess**. O xadrez é sempre um contra um, então a mesa tem exatamente dois lugares.

Na seção **Opponent** (adversário), escolha um único personagem nos botões de opção. O primeiro personagem vem selecionado por padrão. Mesmo em um chat em grupo, só um personagem senta como adversário. Os outros continuam conversando normalmente.

Na seção **Your color** (sua cor), escolha **White**, **Random** ou **Black**. O padrão é **Random**. Um aviso diz "White moves first."

Clique em **Cancel** para fechar a janela ou em **Start game** para começar.

### Como jogar no tabuleiro do Chess

O tabuleiro aparece com o título **Chess**, com uma grade 8x8 e peças desenhadas à mão. O selo de cada lado mostra as peças capturadas do adversário e a vantagem material como "+N". A linha do turno diz "Your turn" no seu turno ou mostra o nome do personagem no dele. Ela acrescenta um aviso de xeque quando você está em xeque.

Clique em uma peça sua para selecioná-la. Os movimentos legais aparecem como um ponto nas casas vazias e um anel nas capturas. O último lance e qualquer xeque ficam destacados, e as bordas trazem a numeração das linhas e colunas. Quando você joga com as pretas, o tabuleiro gira para o seu lado ficar embaixo. Um peão que chega à última fileira abre o seletor "Promote to:" com Queen, Rook, Bishop e Knight.

Quando a partida termina, uma faixa anuncia o vencedor por xeque-mate, um empate com o motivo (afogamento ou a regra dos cinquenta lances, por exemplo) ou "Game over". Uma faixa curta de histórico abaixo do tabuleiro lista os lances recentes em notação padrão.

## Poker

### Como configurar o Poker

A janela de configuração se chama **Start Poker**. A mesa comporta de 2 a 8 jogadores, ou seja, você mais até sete personagens.

Na seção **Players**, marque os personagens que você quer sentados à mesa. Depois de sete marcados, os demais ficam esmaecidos. Um aviso diz "8 seats max (you + up to 7 characters)."

A seção **Dealer** é um menu suspenso. O padrão é **House dealer (silent)**, que distribui as cartas sem comentar nada. Em vez disso, você pode escolher qualquer personagem para anunciar as mãos, os flops e os showdowns com a própria voz. As cartas são distribuídas de forma justa nos dois casos, e o dealer não precisa ser um jogador sentado à mesa.

A seção **Stakes** (apostas) tem quatro campos numéricos:

| Configuração | Padrão | Observações |
|---|---|---|
| **Starting stack** | **1000** | Fichas com que cada jogador começa (100 a 1.000.000). |
| **Small blind** | **10** | O big blind é sempre o dobro deste valor. |
| **Blinds double every** | **0** | Número de mãos entre os aumentos de blind. 0 significa nunca. |
| **Hand limit** | **0** | 0 significa jogar até sobrar só um jogador com fichas. |

Quando você define um valor em **Hand limit**, a sessão termina depois desse número de mãos e vence quem tiver mais fichas.

Clique em **Cancel** para fechar a janela ou em **Deal** para começar. O botão Deal mostra a quantidade de lugares, por exemplo **Deal (4p)**.

### Como jogar no tabuleiro do Poker

O cabeçalho do tabuleiro mostra a mão atual, a street e os blinds, junto com o total do pote. A linha do turno diz "Your turn" ou o nome do personagem da vez. Cinco espaços para as cartas comunitárias ficam acima dos lugares.

Cada lugar mostra o nome do jogador, "(you)" no seu, um selo "D" para o botão do dealer e "SB" ou "BB" para os blinds. Mostra também a quantidade de fichas e o status, como a aposta atual, "folded", "all in" ou "busted". As suas duas cartas fechadas aparecem maiores em "Your hand". Assim que você tem uma mão formada, um rótulo em linguagem simples aparece, por exemplo "Full house, kings over nines".

No seu turno, uma barra de ações traz **Fold**, **Check**, **Call** e um **All in** destacado. Quando você pode apostar ou aumentar, abre uma caixa de aposta com os botões rápidos **Min**, **½ pot**, **Pot** e **All-in**, mais um botão de confirmação.

No fim de cada mão, o painel **Showdown** revela as mãos e entrega o pote. O botão **Next hand** distribui a rodada seguinte. Quando a sessão inteira termina, uma faixa anuncia o vencedor da sessão e lista a contagem final de fichas de cada lugar.

## 8-Ball Pool

### Como configurar o 8-Ball Pool

A janela de configuração se chama **Start 8-Ball Pool**. A sinuca é um contra um, então você joga contra um único personagem.

- **Opponent**: escolha o personagem contra quem você joga.
- **Announcer** (narrador): opcional. O padrão é **Silent (no announcer)**. Escolha um personagem para narrar as tacadas com a própria voz.
- **Match length** (duração da partida): **Race to 1**, **Race to 3** ou **Race to 5**. É a quantidade de racks que você precisa vencer para ganhar a partida. Um rack é um jogo completo de sinuca.
- **Who breaks first** (quem dá a saída): **You**, **Random** ou **Them**. Um aviso diz "Later racks alternate the break."

Clique em **Start game** para começar. O botão mostra "Racking up..." enquanto a mesa é montada.

### Como jogar no tabuleiro do 8-Ball Pool

O tabuleiro mostra uma mesa de sinuca vista de cima, com a posição real de cada bola. No seu turno, a linha do turno diz "Your turn". No turno do personagem, ela mostra o nome dele com "is thinking...". Você joga escolhendo uma das tacadas sugeridas, e as bolas então rolam na mesa com uma simulação de física. Uma linha abaixo da mesa descreve a última tacada ou diz "Rack over." entre um rack e outro.

## Tic-Tac-Toe

O jogo da velha é um contra um. A configuração escolhe o adversário e se você joga de **X**, de **O** ou com uma marca aleatória. O X joga primeiro. No seu turno, clique em uma casa vazia. Marinara bloqueia jogadas inválidas, pede a jogada ao personagem dentro do personagem e detecta vitórias e empates automaticamente.

## Rock-Paper-Scissors

Pedra, papel e tesoura é um contra um. A configuração escolhe o adversário e se a disputa é melhor de três, melhor de cinco ou melhor de sete. Escolha **Rock**, **Paper** ou **Scissors** a cada rodada. A escolha do adversário fica escondida até as duas estarem prontas; então Marinara revela o resultado e atualiza o placar da disputa.

## Como encerrar uma partida

Todo tabuleiro tem um botão para encerrar a partida antes do fim, marcado com um ícone de X.

- No tabuleiro do UNO ele se chama **End game** e pergunta antes "End this game?".
- No tabuleiro do Chess ele se chama **Resign** e pergunta antes "Resign and end this game?".
- No tabuleiro do Poker ele se chama **End game** enquanto uma mão está em jogo e pergunta antes "End this poker game?". Depois que a sessão inteira acaba, ele vira **Close** e não pede confirmação.
- No tabuleiro do 8-Ball Pool ele se chama **End game** e pergunta antes "End this pool game?". Depois que a partida acaba, ele vira **Close** e não pede confirmação.
- No Tic-Tac-Toe e no Rock-Paper-Scissors, use o controle de fechar ou encerrar do tabuleiro para limpar a partida atual.

Ao encerrar uma partida, o estado dela é excluído. Nenhum vencedor é registrado quando você encerra a partida antes do fim dessa forma.

## Deixe os personagens iniciarem partidas por conta própria

Você controla se um personagem pode oferecer ou aceitar uma partida em **Chat Settings → Agents** (configurações do chat), nos controles de **Commands**. Essas opções também aparecem no assistente de configuração de um novo chat, na etapa **Automation**.

O botão liga/desliga principal de **Commands** vem ativado por padrão. Ele controla todos os comandos executados pelos personagens, incluindo os jogos de mesa, as selfies, as lembranças e as chamadas. Ao desativá-lo, os personagens param de iniciar qualquer coisa por conta própria.

Dentro de Commands, cada jogo instalado tem o próprio botão liga/desliga, e os seis vêm ativados por padrão:

- **UNO**: "Let characters start a game of UNO at the table when you agree to play."
- **Chess**: "Let characters accept a one-on-one chess challenge at the table."
- **Poker**: "Let characters sit down for a game of Texas Hold'em poker at the table."
- **8-Ball Pool**: "Let characters rack up a game of 8-ball pool at the table."
- **Tic-Tac-Toe**: "Let characters accept a one-on-one tic-tac-toe challenge at the table."
- **Rock-Paper-Scissors**: "Let characters accept a one-on-one rock-paper-scissors match at the table."

Esses botões controlam só o caminho iniciado pelo personagem. O comando de barra e a frase "let's play" no chat continuam funcionando para um jogo instalado mesmo com o botão do personagem desativado.

## Guias relacionados

- [Conversation Mode: primeiros passos](getting-started.md)
- [Referência de comandos de barra](../chats/slash-commands.md)
