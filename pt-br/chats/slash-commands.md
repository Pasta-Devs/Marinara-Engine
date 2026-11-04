# Referência de comandos de barra

Um comando de barra é um atalho que você digita na caixa de mensagem, começando com `/`, para fazer algo rápido. Alguns mudam a tela na hora. Outros pedem que o modelo escreva alguma coisa.

## Como funcionam os comandos de barra

1. Digite o comando na caixa de mensagem, na parte de baixo do chat.
2. Clique em **Send** (enviar) ou pressione <kbd>Enter</kbd> se **Send on Enter** (enviar com Enter) estiver ativado para o seu modo de chat. Veja [Enviar mensagens e streaming](sending-and-streaming.md#send-on-enter).

Assim que você digita `/`, um menu com os comandos correspondentes aparece acima da caixa. Cada linha mostra o formato do comando e uma descrição curta. Clique em uma linha para preenchê-la na caixa, acrescente o texto extra e envie. A dica da caixa também menciona os comandos: **Write your response, / for commands** em Roleplay e "Message @Alice, / for commands" em Conversation.

Nas tabelas, o formato de cada comando fica na linha dele. Substitua os rótulos entre colchetes, como `[name]` ou `[range]`, pelos seus próprios valores e não digite os colchetes. As entradas marcadas com `(optional)` podem ser omitidas. O `|` separa alternativas. Muitos comandos têm apelidos mais curtos, como `/cont` para `/continue`. Para ver todos os comandos no aplicativo, digite:

```text
/help
```

Alguns comandos rodam no navegador e não custam nada. Outros pedem que o modelo escreva texto, o que usa a sua conta e pode consumir tokens (as unidades que os serviços contam e cobram).

Os comandos de barra funcionam nas caixas de mensagem de Conversation e de Roleplay. Em Game, só funciona `/illustrate` (ou `/ill`) sozinho, sem intervalo nem prompt, e só quando as ilustrações de Game estão configuradas com uma conta de imagem. Qualquer outra coisa que comece com barra é enviada como texto comum. Em Roleplay e em Conversation, os comandos `/illustrate`, `/selfie` e `/video` precisam do agente Illustrator e só aparecem quando ele está instalado.

Vários comandos usam números de mensagem. Marinara conta a partir da primeira mensagem do chat, que é a número 1. `/goto`, `/hide` e `/unhide` usam esses números. **Show message numbers** (mostrar os números das mensagens) os exibe. Veja [Ações de mensagem](messages.md#message-display-toggles).

## Comandos de chat e de mensagem

Estes funcionam em Conversation e em Roleplay.

| Comando | O que faz |
|---|---|
| `/help` | Lista todos os comandos de barra. |
| `/send` | Publica uma mensagem como a sua persona sem pedir uma resposta. As macros são preenchidas, como no **Send**. Formato: `/send [message]`. |
| `/continue` | Acrescenta mais texto à última resposta da IA, sem uma mensagem nova. Também `/cont`. **Settings → General → Responses → Add a new line before /continue text** (Configurações → Geral → Respostas → Adicionar uma nova linha antes do texto de /continue) define se o texto começa depois de uma linha em branco ou no ponto em que parou. |
| `/goto` | Rola o chat até um número de mensagem. Também `/jump`, `/scroll`. Formato: `/goto [number]`. |
| `/hide` | Esconde mensagens do modelo nos próximos turnos. Formato: `/hide [range] [name (optional)]`. |
| `/unhide` | Devolve as mensagens escondidas globalmente. Formato: `/unhide [range]`. |
| `/sys` | Acrescenta uma mensagem de sistema. Ela aparece no chat e orienta o modelo, mas nenhum personagem a diz. Também `/system`. Formato: `/sys [message]`. |
| `/macros` | Lista as macros de prompt, como `{{user}}` e `{{char}}`. Também `/macro`. |
| `/remind` | Marca um tempo e depois publica um lembrete no chat. Também `/reminder`, `/timer`. Formato: `/remind [time] [message]`. |

Exemplos:

```text
/goto 27
/hide 3-8
/remind 30m check the oven
```

`/hide` e `/unhide` aceitam um número, um intervalo ou uma mistura dos dois: `/hide 5`, `/hide 3-8`, `/hide 2-5,9,12`. As mensagens escondidas continuam no chat, mas o modelo não as lê.

Em Roleplay, acrescente um nome de personagem depois do intervalo para esconder as mensagens só daquele personagem. Os outros personagens continuam com acesso.

```text
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

Coloque entre aspas os nomes que têm espaços. As formas antigas com o nome primeiro, como `/hide Maukie 3-8`, continuam funcionando. Se um nome corresponder a vários personagens, use o nome completo. Coloque nomes numéricos entre aspas para diferenciá-los dos números de mensagem, como em `/hide 1 "123"`. Para conferir ou desfazer a ocultação por personagem, use o seletor de avatares de **Hide from AI** (ocultar da IA) da mensagem em um chat de Roleplay em grupo, ou **Unhide from AI** (mostrar para a IA) em um chat com um só personagem. `/unhide` desfaz apenas a ocultação global.

`/remind` recebe um tempo com `h` (horas), `m` (minutos) ou `s` (segundos) e depois uma mensagem. O lembrete vive na sessão do navegador, então deixe a aba aberta até ele disparar.

## Comandos de história e de roleplay

| Comando | O que faz |
|---|---|
| `/guided` | Conduz a próxima resposta. Também `/narrator`, `/narrate`, `/nar`. Formato: `/guided [direction]`. |
| `/as` | Publica uma mensagem como um personagem, ou pede que esse personagem responda. Também `/respond`. Formato: `/as [name] [message (optional)]`. |
| `/emote` | Lista ou troca uma expressão de sprite. Também `/emotion`, `/sprite`. Formato: `/emote [expression]`. |
| `/roll` | Rola dados e publica o resultado. Também `/r`, `/dice`. Formato: `/roll [dice (optional)]`. |
| `/random` | Pede que o modelo acrescente um evento surpresa. Também `/rand`, `/event`. |
| `/scene` | Começa uma cena de Roleplay que se ramifica a partir da conversa. Também `/rp`. Formato: `/scene [description (optional)]`. |
| `/illustrate` | Só em Roleplay. Gera uma imagem de galeria. Precisa do agente Illustrator. Também `/ill`. Formato: `/illustrate [range=N-M] [prompt]`. |
| `/html` | Só em Roleplay. Cria um artefato do mundo da história, como `a spellbook page`, no fim da resposta mais recente. Formato: `/html [what you want]`. |
| `/video` | Só em Roleplay. Cria um clipe curto da resposta mais recente, ou da sua descrição, abaixo dessa resposta. Segue a configuração **First frame** (primeiro quadro) do Illustrator. Precisa do Illustrator. Formato: `/video [description]`. |
| `/impersonate` | Escreve uma resposta como a sua persona. Também `/imp`. Formato: `/impersonate [direction (optional)]`. |
| `/impersonate_prompt` | Define a instrução que `/impersonate` usa neste chat. Também `/imp_prompt`. Formato: `/impersonate_prompt [prompt or reset]`. |

A maioria funciona melhor em Roleplay. `/scene` é executado a partir de um chat de Conversation. `/impersonate` e `/impersonate_prompt` não estão disponíveis em Conversation.

### Conduza uma resposta

```text
/guided make him confess he is lying
/guided respond as "Powers That Be" describe the approaching storm
```

`reply as` e `respond for` também funcionam no lugar de `respond as`. Veja [Geração guiada e Impersonate](guided-and-impersonate.md).

### Publique como um personagem

Omita a mensagem para o modelo escrever a próxima resposta daquele personagem.

```text
/as Dottore "The experiment begins."
/as Dottore
```

### Role dados

`/roll 2d6` rola dois dados de seis lados. Acrescente um modificador, como em `/roll 1d20+5`. Sem nada depois, `/roll` rola `1d20`. Para manter só alguns dados, acrescente `kh` (manter os maiores) ou `kl` (manter os menores) e um número: `/roll 4d6kh3` soma os três maiores, e `/roll 2d20kl1` mantém o menor de dois. Já `dl` e `dh` descartam os menores ou os maiores, como em `/roll 4d6dl1`. Os dados que não contam continuam aparecendo, esmaecidos.

### Troque um sprite

Um sprite é uma imagem do personagem que mostra uma expressão. Digite `/emote` sozinho para ver as expressões disponíveis, ou escreva o nome de uma:

```text
/emote joy
/emote "Powers That Be" joy
```

Com um nome e sem expressão, ele lista as expressões daquele personagem. O comando precisa de um chat de Roleplay com sprites enviados. Veja [Sprites de personagem](../characters/sprites.md).

### Ilustre e crie artefatos

`/illustrate range=12` ilustra a mensagem 12. `/illustrate range=12-18` envia as mensagens de 12 a 18 ao Illustrator. Use os mesmos números de mensagem de `/goto`, em ordem crescente, com no máximo 200 mensagens. As mensagens escondidas ficam de fora. A imagem é anexada à última mensagem visível do intervalo. As mensagens anteriores continuam disponíveis com o Advanced Memory ativado. Sem `range=`, o comando age sobre a cena atual. Um prompt que você digita é usado do jeito que foi escrito.

`/html a terminal readout` não precisa de agente e funciona com **HTML Artifacts** (artefatos HTML) ativado ou não. O narrador pode pedir o mesmo com `[html: prompt="..."]` quando **HTML Artifacts** está ativado em **Roleplay Commands** (comandos de Roleplay). Veja [Artefatos sob demanda](../roleplay/getting-started.md#artifacts-on-demand).

### Escreva a sua resposta

`/impersonate ask about the weather` escreve uma resposta com a voz da sua persona. A persona é o personagem que representa você, escrito `{{user}}` nos prompts. Estes dois comandos não estão disponíveis em Conversation.

## Comandos do modo Conversation

Estes só funcionam em um chat de Conversation.

| Comando | O que faz |
|---|---|
| `/games` | Abre o seletor de jogos instalados. `/game` e `/play` fazem o mesmo. |
| `/selfie` | Gera uma selfie com o agente Illustrator. Acrescente um nome para escolher um personagem. Formato: `/selfie [name (optional)]`. |
| `/video` | Faz um personagem enviar uma mensagem de vídeo curta, usando as configurações de **Video messages** (mensagens de vídeo) do chat. Veja [Mensagens de vídeo](../conversation/selfies.md#video-messages). Formato: `/video [name (optional)]`. |
| `/uno` | Começa uma partida de UNO com os personagens do chat. |
| `/chess` | Começa uma partida de xadrez de um contra um com um personagem. |
| `/poker` | Começa uma partida de Texas Hold'em com os personagens. |
| `/8ball` | Começa uma partida de sinuca bola 8 de um contra um com um personagem. `/pool` faz o mesmo. |
| `/status` | Define ou limpa o status de presença de um personagem. Formato: `/status [online, idle, dnd, offline or clear] [name]`. |

Os comandos de jogo abrem a tela de configuração daquele jogo, e cada um só aparece quando o agente do jogo está instalado. Você pode jogar uma partida por vez em um chat. Veja [Jogos de mesa](../conversation/table-games.md).

`/status` sobrepõe a presença de um personagem. O status pode ser `online`, `idle`, `dnd` (não perturbe) ou `offline`. `clear` remove a sobreposição. Em um chat com vários personagens, acrescente o nome no fim.

```text
/status idle
/status online Alice
```
