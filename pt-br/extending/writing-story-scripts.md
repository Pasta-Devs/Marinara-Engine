# Escrever roteiros de história de Game Mode

Um roteiro de história permite que quem o cria conduza o rumo de uma partida de Game Mode: cenas que acontecem quando a equipe chega a algum lugar, pedidos feitos ao Game Master assim que uma condição é cumprida, objetivos que o jogador acompanha no Journal e momentos que o próprio Game Master pode marcar. Este guia é para quem escreve os próprios roteiros. Para jogar num mundo que tem uma história, comece por [Criar um mundo](../game/getting-started.md#making-a-world).

Um roteiro de história é feito de dados, não de código. Nada nele é executado. O Engine confere o roteiro com o mundo para o qual ele foi escrito, aplica-o turno a turno e recusa tudo o que não se encaixa.

## Onde fica uma história

Uma história pertence a um único mundo. Ela nomeia os lugares e as pessoas desse mundo, então só faz sentido com o mundo para o qual foi escrita (a semente, a descrição e as edições manuais dele).

- Num **arquivo de mundo** (`.world.json`), como um `story` de nível superior ao lado de `world`. Uma versão do Engine que não conhece histórias continua lendo o mundo.
- No **pacote de mapas** de uma Experience: cada arquivo de mundo pode levar a sua história, e uma partida nova a recebe junto com o mapa. Veja [pacotes opcionais de agentes](../development/optional-agent-packages.md).
- Num mundo guardado na biblioteca, fora de qualquer partida: `GET`, `PUT` e `DELETE /api/game-worlds/:id/story`, como os de uma partida. Uma partida nova iniciada a partir desse mundo leva a história junto.
- Numa partida, depois que ela começa: `GET`, `PUT` e `DELETE /api/game/:chatId/story` leem, salvam e removem a história. Cada gravação é conferida com o mundo da partida, incluindo as edições manuais, e edições manuais que tirariam algo que a história nomeia são recusadas.

Na configuração de uma partida nova, uma história lida de um arquivo ou de um pacote de mapas é mantida enquanto a semente e a descrição do mundo continuarem como estavam.

## O formato

```json
{
  "storyVersion": 1,
  "flags": [],
  "directions": [],
  "events": [],
  "cutscenes": []
}
```

Os IDs têm de 1 a 40 letras minúsculas, dígitos, `_` ou `-` e são únicos dentro da sua lista. Uma história tem no máximo 64 sinalizadores, 64 diretrizes, 128 eventos e 64 cutscenes. Nenhum texto dela pode conter quebra de linha, colchetes ou `{{`, e nomes escritos dentro de uma tag (um grupo, um plano de fundo) não podem conter aspas duplas: nada do que uma história diz pode se passar por uma das tags do Game Master.

### Sinalizadores

Um sinalizador é um valor que a história guarda: `"bool"` (verdadeiro ou falso) ou `"number"`.

```json
{ "id": "trust", "kind": "number", "initial": 0, "gm": true, "note": "How far the town trusts the party" }
```

- `gm: true` permite que o Game Master o defina (veja [As tags do Game Master](#the-game-masters-tags)); `note` explica a ele o que o sinalizador significa.
- Os sinalizadores ficam ocultos do jogador. Com `quest`, um sinalizador vira um **objetivo de missão** no Journal:

```json
{
  "id": "favours",
  "kind": "number",
  "initial": 0,
  "quest": { "title": "Favours", "text": "Do the town three favours", "goal": 3 }
}
```

Um objetivo de sim ou não é concluído quando o seu sinalizador é verdadeiro; um objetivo numérico, quando o sinalizador atinge o seu `goal` (1 quando não informado), e, com um `goal` escrito, o Journal mostra o progresso. Um objetivo com `"hidden": true` fica oculto no Journal até que um evento o mostre.

### Diretrizes

Uma diretriz é uma instrução permanente para o Game Master, em vigor enquanto as suas condições forem cumpridas:

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

### Condições

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. Todas as condições de uma lista `if` precisam ser cumpridas. Um sinalizador de sim ou não só é comparado com `=` ou `!=`.

### Eventos

Um evento é algo que acontece: quando o seu gatilho dispara e as suas condições são cumpridas, ele executa as suas ações.

```json
{
  "id": "gates",
  "when": { "on": "arrive", "place": "p11" },
  "if": [{ "flag": "banished", "is": "=", "value": false }],
  "do": [{ "cutscene": "gates" }, { "set": "arrived", "value": true }, { "show": "key" }]
}
```

Um evento acontece uma vez, a menos que tenha `"repeat": true` (que `start`, `turn` e `day` ignoram). No máximo 32 eventos acontecem num turno, cada um no máximo uma vez, na ordem em que o roteiro os lista.

**Gatilhos** (`when.on`), todos lidos do que a partida registrou:

| Gatilho | Dispara |
| --- | --- |
| `start` | Na primeira resposta da partida. |
| `turn` | Na resposta número `turn` do Game Master ou depois dela, contando a partida inteira, em todas as sessões. |
| `day` | Quando o dia do mundo (que avança com a passagem de tempo narrada pelo Game Master e com as caminhadas) chega a `day` ou passa dele. |
| `arrive` | Enquanto a equipe está em `place` (um ID de lugar) ou num lugar dentro dele, tendo chegado ali por ter começado ali, por uma caminhada no overworld, por uma visita na cidade ou por um lugar que o Game Master nomeia. Com `repeat`, de novo a cada vez que ela volta de outro lugar. |
| `meet` | Assim que uma resposta tiver nomeado `person` (um ID de pessoa como `p11-3`, ou `p11-e1` para alguém acrescentado manualmente) pelo nome completo. Com `repeat`, de novo a cada resposta que a nomeie. Só as respostas desta sessão são lidas em busca de nomes. |
| `deed` | Assim que o mundo tiver registrado um feito da equipe, do tipo `deed` e em `place`, quando informado. Com `repeat`, de novo a cada resposta que registre um. |
| `fight` | Quando uma luta termina com o `outcome`: `victory`, `defeat` ou `flee`. |
| `broke` | Quando uma luta quebrou o objeto de cenário chamado `prop` (Capability API 1.316), comparado sem diferenciar maiúsculas e minúsculas. Só é possível nomear um objeto de cenário pintado em um dos campos de batalha do mundo. |
| `flags` | Quando as suas condições são cumpridas. Com `repeat`, de novo a cada vez que elas voltam a valer depois de terem deixado de valer. |
| `gm` | Só quando o Game Master o aciona (o evento precisa de `"gm": true`). |
| `step` | Quando uma caminhada passa pela casa `x`, `y` (contadas a partir de 0, do canto superior esquerdo) de `place`: a cidade de um assentamento (o trajeto de uma visita, de porta a porta) ou o mapa de um lugar feito à mão (uma caminhada nele). A casa precisa ser uma em que a equipe possa pisar: numa cidade, chão ligado à praça que não seja um lote livre, já que é nos lotes livres que a história pode construir; num mapa, piso ligado à entrada dele. Um mapa gerado não tem casas para nomear. Com `repeat`, de novo a cada turno cuja caminhada passe por ela. |

Edições manuais que tiram a casa de um evento step (um edifício posto sobre ela, o piso de um mapa transformado em parede) são recusadas ao salvar, com o nome do evento.

Um evento `meet` repetível cuja própria cena nomeia essa pessoa, ou um evento `deed` repetível que realiza o feito que espera, dispararia a si mesmo a cada turno, então o Engine o recusa.

**Ações** (`do`):

| Ação | O que faz |
| --- | --- |
| `{ "set": "<flag>", "value": <value> }` | Define um sinalizador. |
| `{ "add": "<flag>", "amount": <number> }` | Soma a um sinalizador numérico. |
| `{ "tell": "<text>" }` | Pede algo ao Game Master, uma vez, neste turno. |
| `{ "cutscene": "<id>" }` | Reproduz uma cutscene. |
| `{ "show": "<flag>" }` | Mostra no Journal um objetivo de missão oculto. |
| `{ "world": { "deed": "<kind>", "group": "...", "with": "...", "place": "<place id>", "who": "..." } }` | Registra um feito no mundo, que reage a ele como reagiria a um feito registrado pelo próprio Game Master. |

Uma história não dá itens, não inicia lutas, não move a equipe nem encerra a partida: isso continua nas mãos do Game Master e do jogador. Peça essas coisas ao Game Master com `tell`.

### Cutscenes

Uma cutscene é mostrada ao jogador exatamente como foi escrita ou passada ao Game Master para que ele a narre.

```json
{
  "id": "gates",
  "kind": "pages",
  "background": "backgrounds:generated:town-gates",
  "pages": [
    { "text": "The gates creak open." },
    { "speaker": "p11-3", "expression": "happy", "text": "Welcome, travellers." },
    { "speaker": "player", "text": "We come in peace." }
  ]
}
```

Uma cutscene `pages` é reproduzida antes da resposta do Game Master, na narração, uma página por vez: uma página sem falante é narração, e uma página com falante é a fala dessa pessoa, com o nome dela no mundo (ou o do jogador, para `player`) e uma `expression` da própria lista do Game Master. Um `background` é um plano de fundo que a partida tem, ou `backgrounds:generated:<words>` para que um seja criado quando a geração de imagens estiver ativada. O Game Master é avisado de que a cena foi mostrada e continua a partir dela.

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

Uma cutscene `beats` é narrada pelo Game Master com as próprias palavras, beat a beat (cada beat é um passo da cena), naquele turno. Os beats de um evento `gm` são passados ao Game Master junto com o evento, e ele os narra na resposta que marca o momento. Assim, o Game Master conhece desde o início uma cena de beats usada por um evento `gm`, mesmo quando um evento do Engine também a reproduz. Como ele recebe esses beats a cada turno, os beats de todos os eventos `gm` juntos ficam limitados a 16.000 caracteres.

<a id="the-intro-message"></a>

### A mensagem de introdução

`intro` (Capability API 1.339) define como a partida começa, a mesma escolha que a configuração do GM oferece a qualquer partida:

```json
"intro": { "mode": "defined", "text": "The leaves have not fallen in Hollowmere for nine years.", "locked": true }
```

`"defined"` faz da primeira mensagem da partida exatamente o `text`; o Game Master não escreve nada para ela, e regenerá-la produz o mesmo texto. `"guided"` apenas orienta a abertura que o Game Master escreve, como uma orientação que ele lê só para essa primeira resposta. `text` tem de 1 a 8.000 caracteres e pode conter quebras de linha (é o único texto de uma história que pode), mas nunca `{{`; um texto guiado também não pode conter colchetes. Com `locked`, o jogador vê a introdução na configuração do GM e não pode mudá-la; sem isso, a introdução só preenche o campo da configuração, e o jogador pode alterá-la ou apagá-la. Uma partida cuja primeira resposta já foi escrita, ou que herda a equipe de outra partida, não tem introdução.

## Como uma história se desenrola

Uma vez por turno, antes de o Game Master responder, o Engine lê o que a história já fez até ali e o que este turno traz (uma caminhada, uma visita, o fim de uma luta) e deixa os eventos acontecerem. O que acontece fica escrito no início dessa resposta: uma tag que registra cada evento e o que ele definiu, e qualquer cena mostrada como foi escrita. Como a história é lida de volta a partir das respostas, um swipe ou uma regeneração desfaz o que aquela resposta fez, e uma história alterada no meio da partida nunca reescreve o que já aconteceu. Ela continua na próxima sessão da partida.

<a id="the-game-masters-tags"></a>

### As tags do Game Master

A cada turno, o Game Master recebe os valores da história (ocultos do jogador) e as diretrizes em vigor. Do resto do roteiro, ele recebe apenas o que o roteiro torna dele: os eventos `gm` (com a `note` de cada um e quaisquer `beats` a narrar junto com eles) e os sinalizadores `gm`, além de quais desses eventos ele não pode marcar agora (já concluídos ou barrados pelas suas condições). Ele os marca na resposta:

- `[story: event="<id>"]` aciona um evento `gm` cujas condições são cumpridas (uma vez, a menos que ele se repita).
- `[story: flag="<id>" value="<value>"]`, ou `add="<number>"` para um sinalizador numérico, define um sinalizador `gm`.

O Engine responde a cada tag no próprio lugar, um evento no máximo uma vez por turno, e recusa qualquer outra coisa informando o motivo. Numa partida sem história, toda tag de história é recusada. O que o Game Master aciona tem efeito imediato (os sinalizadores, os feitos); as cenas e os pedidos chegam no início da resposta seguinte, exceto os `beats` (ele já foi solicitado a narrá-los junto com o momento). Escreva as `pages` de um evento `gm` como o que vem depois do momento, já que o Game Master já narrou o próprio momento.

## Experimentar uma história

Salve-a numa partida com `PUT /api/game/:chatId/story` e `{ "story": { ... } }`: uma história que não se encaixa é recusada com todos os motivos. A aba World (mundo) da partida lista os objetivos que a história já mostrou, e o prompt do Game Master leva os valores e as diretrizes da história a cada turno.
