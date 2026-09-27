# Referência de comandos de barra

Neste guia estão listados os comandos de barra que você pode digitar em um chat do Marinara Engine. Um comando de barra é um atalho digitado na caixa de mensagem, começando com uma barra, para fazer algo rápido. Alguns comandos agem na tela na hora, e outros pedem que a IA escreva alguma coisa.

## Como funcionam os comandos de barra

Para executar um comando de barra, digite ele na caixa de mensagem no rodapé do chat e clique em **Send** (enviar). A tecla Enter também envia, se a opção **Send on Enter** (enviar com Enter) estiver ativada para o modo de chat em uso na seção **Settings** (Configurações). Por padrão, Enter envia nos chats de Conversation e começa uma linha nova nos chats de Roleplay. A própria caixa de mensagem lembra os comandos de barra. Em um chat de Roleplay, o texto de exemplo diz **Write your response, / for commands**. Em um chat de Conversation, o texto de exemplo mostra o nome do personagem, como "Message @Alice, / for commands". Uma conversa com mais de um personagem mostra o nome do chat no lugar.

Assim que você digita uma barra, um pequeno menu com os comandos correspondentes aparece acima da caixa. Cada linha traz o formato do comando, incluindo os argumentos, e uma descrição curta. Clique ou toque em uma linha para preencher a caixa com aquele comando, depois acrescente o texto extra e envie.

Substitua os rótulos entre colchetes, como `[name]` ou `[range]`, pelos seus valores; não digite os colchetes. Os argumentos marcados com `(optional)` podem ser omitidos. O símbolo `|` separa alternativas, sejam valores como `prompt|reset` ou formatos completos de comando.

Muitos comandos têm apelidos mais curtos. Por exemplo, `/continue` e o apelido `/cont` fazem exatamente a mesma coisa. Para ver a lista completa dentro do aplicativo a qualquer momento, execute este comando:

```
/help
```

Alguns comandos rodam no navegador e mudam o chat na hora, sem custo nenhum. Outros pedem que a IA gere texto, o que usa o provedor conectado e pode consumir tokens. O token é a unidade que a maioria dos provedores de IA usa para medir e cobrar o texto. As tabelas abaixo indicam o que cada comando faz.

Os comandos de barra funcionam nas caixas de mensagem de **Conversation** e **Roleplay**. No modo **Game**, só `/illustrate` funciona como comando de barra. Qualquer outra coisa digitada com barra na frente é enviada como texto comum.

Vários comandos usam números de mensagem. Marinara conta as mensagens a partir da primeira do chat como número 1, depois 2, depois 3, e assim por diante. Comandos como `/goto`, `/hide` e `/unhide` usam esses números.

## Comandos de chat e de mensagem

Estes comandos ajudam a cuidar do chat e das mensagens dele. Funcionam nos chats de **Conversation** e **Roleplay**.

| Comando | Também funciona como | O que faz |
|---|---|---|
| `/help` | | Lista todos os comandos de barra. |
| `/send [message]` | | Publica uma mensagem no papel da sua persona sem iniciar uma geração. |
| `/continue` | `/cont` | Acrescenta mais texto à última resposta da IA, sem enviar uma mensagem nova. A opção **Add a new line before /continue text** em **Settings → General → Responses** define se esse texto começa depois de uma linha em branco ou direto no ponto em que parou. |
| `/goto [number]` | `/jump`, `/scroll` | Rola o chat até uma mensagem pelo número dela. |
| `/hide [range] [name (optional)]` | | Esconde uma ou mais mensagens da IA nos turnos seguintes. |
| `/unhide [range]` | | Devolve as mensagens escondidas para a visão da IA. |
| `/sys [message]` | `/system` | Acrescenta uma mensagem de sistema. Essa nota aparece no chat e orienta a IA, mas nenhum personagem a diz. |
| `/macros` | `/macro` | Lista as macros de prompt com suporte, como `{{user}}` e `{{char}}`. |
| `/remind [time] [message]` | `/reminder`, `/timer` | Marca um tempo e depois publica uma mensagem de lembrete no chat. |

Para pular até a mensagem 27, digite isto:

```
/goto 27
```

Os comandos `/hide` e `/unhide` aceitam um número, um intervalo ou uma mistura dos dois. Este exemplo esconde as mensagens de 3 a 8:

```
/hide 3-8
```

Você também pode escrever `/hide 5` para uma mensagem ou `/hide 2-5,9,12` para várias. Sem um nome de personagem, as mensagens ficam ocultas para todos. As mensagens ocultas continuam no chat, mas a IA não as lê no próximo turno. Use `/unhide` com o mesmo tipo de lista de números para restaurar as mensagens ocultas globalmente.

No **Roleplay**, acrescente um nome de personagem depois do intervalo para ocultar essas mensagens apenas daquele personagem:

```
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

O acesso dos outros personagens não muda. Se colocar o nome primeiro, use aspas nos nomes com espaços: as formas anteriores `/hide Maukie 3-8` e `/hide "Powers That Be" 2-5,9` continuam funcionando. Se um nome corresponder a vários personagens, use o nome completo. Coloque nomes numéricos entre aspas para distingui-los dos números de mensagem, por exemplo `/hide 1 "123"`. Em um chat de grupo Roleplay, use o seletor de avatares de **Hide from AI** (ocultar da IA) da mensagem para conferir ou desfazer a ocultação por personagem. Em um chat Roleplay com apenas um personagem, use a ação **Unhide from AI** (mostrar novamente à IA) da mensagem. `/unhide` desfaz apenas a ocultação global.

O comando `/remind` recebe um tempo e depois uma mensagem. O tempo usa `h` para horas, `m` para minutos e `s` para segundos. Este exemplo avisa você em 30 minutos:

```
/remind 30m check the oven
```

O lembrete vive na sessão do navegador, então deixe a aba aberta até a hora chegar.

## Comandos de história e roleplay

Estes comandos ajudam a conduzir a história, interpretar um personagem e acrescentar arte. A maioria funciona melhor em um chat de **Roleplay**. A exceção é `/scene`, que você executa a partir de um chat de **Conversation**.

| Comando | Também funciona como | O que faz |
|---|---|---|
| `/guided [direction]` \| `/guided respond for [name] [direction (optional)]` | `/narrator`, `/narrate`, `/nar` | Conduz a próxima resposta da IA na direção que você descrever. |
| `/as [name] [message (optional)]` | `/respond` | Publica uma mensagem como um personagem, ou pede que um personagem responda. |
| `/emote [expression (optional)]` \| `/emote "[name]" [expression (optional)]` | `/emotion`, `/sprite` | Lista ou troca a expressão do sprite de um personagem. |
| `/roll [dice (optional)]` | `/r`, `/dice` | Rola os dados e publica o resultado. |
| `/random` | `/rand`, `/event` | Pede que a IA acrescente um evento surpresa à história. |
| `/scene [description (optional)]` | `/rp` | Executado a partir de um chat de Conversation. Começa uma cena nova de Roleplay, criando uma ramificação a partir daquela conversa. |
| `/illustrate [range=N or range=N-M (optional)] [prompt (optional)]` | `/ill` | Gera uma imagem de galeria para o chat atual. |
| `/impersonate [direction (optional)]` | `/imp` | Escreve uma resposta no papel da persona. |
| `/impersonate_prompt [prompt\|reset]` | `/imp_prompt` | Define a instrução que `/impersonate` usa neste chat. |

Em **Roleplay**, `/illustrate range=12` ilustra a mensagem 12, e `/illustrate range=12-18` envia as mensagens de 12 a 18 ao Illustrator. Use os mesmos números de `/goto`, em ordem crescente, com no máximo 200 mensagens. Mensagens ocultas continuam excluídas. A imagem é anexada à última mensagem visível do intervalo; a revisão do prompt mantém essa seleção mesmo se chegarem mensagens novas. Mensagens anteriores continuam disponíveis com Advanced Memory ativado. Sem `range=`, o comando mantém o comportamento normal para a cena atual. Um prompt digitado opcional é usado diretamente, como antes.

Para conduzir a próxima resposta, escreva a direção depois de `/guided`:

```
/guided make him confess he is lying
```

Em um chat de grupo Roleplay, use `/guided respond for [name] [direction (optional)]` para escolher o personagem que vai responder. Por exemplo:

```
/guided respond for "Powers That Be" describe the approaching storm
```

Use `/as [name] [message (optional)]` para publicar texto no papel de um personagem. Se omitir a mensagem, o modelo gera a próxima resposta daquele personagem:

```
/as Dottore "The experiment begins."
/as Dottore
```

O comando `/roll` entende a notação de dados. Este exemplo rola dois dados de seis lados:

```
/roll 2d6
```

Você pode acrescentar um modificador, como `/roll 1d20+5`. Se digitar `/roll` sem mais nada, Marinara rola `1d20`.

O sprite é uma imagem do personagem que mostra uma expressão. O comando `/emote` troca qual delas aparece. Digite `/emote` sozinho para ver as expressões disponíveis, ou escreva o nome de uma para trocar:

```
/emote joy
```

Para escolher um personagem, use `/emote "[name]" [expression (optional)]`, por exemplo `/emote "Powers That Be" joy`. Omita a expressão para listar as expressões disponíveis daquele personagem.

A troca de sprite exige um chat de Roleplay com sprites enviados. Veja [Sprites de personagem](../characters/sprites.md) para saber como acrescentá-los.

A persona é o personagem que representa você em um chat, escrito como `{{user}}` nos prompts. O comando `/impersonate` escreve uma resposta no seu lugar. Você pode acrescentar uma direção depois dele:

```
/impersonate ask about the weather
```

Os comandos `/impersonate` e `/impersonate_prompt` não estão disponíveis nos chats de **Conversation**. Para um passo a passo completo de geração guiada e personificação, veja [Geração guiada e Impersonate](guided-and-impersonate.md).

## Comandos do Conversation Mode

Estes comandos só funcionam em um chat de **Conversation**.

| Comando | O que faz |
|---|---|
| `/games` | Abre o seletor de jogos de Conversation instalados. `/game` e `/play` fazem o mesmo. |
| `/selfie [name (optional)]` | Gera uma selfie com o agente Illustrator instalado. Acrescente um nome para escolher um personagem. |
| `/uno` | Começa uma partida de UNO com os personagens do chat. |
| `/chess` | Começa uma partida de xadrez de um contra um com um personagem. |
| `/poker` | Começa uma partida de pôquer Texas Hold'em com os personagens. |
| `/8ball` | Começa uma partida de sinuca bola 8 de um contra um com um personagem. `/pool` faz a mesma coisa. |
| `/status [online\|idle\|dnd\|offline\|clear] [name (optional)]` | Define ou limpa o status de presença de um personagem. |

Os comandos `/uno`, `/chess`, `/poker` e `/8ball` abrem a tela de configuração daquele jogo. Só é possível jogar uma partida por vez em um chat. Para as regras e as opções, veja [Jogos de mesa](../conversation/table-games.md).

O comando `/status` sobrepõe a presença de um personagem. O status pode ser `online`, `idle`, `dnd` (não perturbe) ou `offline`. Use `clear` para remover a sobreposição. Este exemplo deixa o personagem ausente:

```
/status idle
```

Em um chat com mais de um personagem, escreva o nome do personagem no fim, como `/status online Alice`.

## Guias relacionados

- [Ações de mensagem](messages.md)
- [Geração guiada e Impersonate](guided-and-impersonate.md)
- [Jogos de mesa](../conversation/table-games.md)
- [Macros](../prompts/macros.md)
