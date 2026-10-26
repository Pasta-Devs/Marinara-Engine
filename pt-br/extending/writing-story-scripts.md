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
  "cutscenes": [],
  "fights": [],
  "endings": [],
  "knowledge": []
}
```

Os IDs têm de 1 a 40 letras minúsculas, dígitos, `_` ou `-` e são únicos dentro da sua lista. Uma história tem no máximo 256 sinalizadores (64 antes da Capability API 1.353), 64 diretrizes, 256 eventos (128 antes da 1.349), 64 cutscenes, 32 lutas, 16 finais e 600 entradas de conhecimento. Nenhum texto dela pode conter quebra de linha, colchetes ou `{{`, e nomes escritos dentro de uma tag (um grupo, um plano de fundo) não podem conter aspas duplas: nada do que uma história diz pode se passar por uma das tags do Game Master.

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

Um sinalizador numérico pode ter `min` e `max` (Capability API 1.358): toda operação `set` e `add` o mantém dentro desses limites, inclusive as tags do próprio Game Master, então uma pontuação de aprovação fica entre -10 e 10 por mais eventos que somem a ela. O seu `initial` precisa estar dentro desses limites.

```json
{ "id": "approval", "kind": "number", "initial": 0, "min": -10, "max": 10, "gm": true }
```

Um objetivo de sim ou não é concluído quando o seu sinalizador é verdadeiro; um objetivo numérico, quando o sinalizador atinge o seu `goal` (1 quando não informado), e, com um `goal` escrito, o Journal mostra o progresso. Um objetivo com `"hidden": true` fica oculto no Journal até que um evento o mostre.

#### Relógios

Um sinalizador numérico pode ser um **relógio** que o jogador acompanha se preencher (Capability API 1.342): um círculo de 2 a 12 segmentos, um preenchido por ponto, mostrado no HUD da partida e na aba World, com o título e o que acontece quando fica cheio.

```json
{
  "id": "reeve",
  "kind": "number",
  "initial": 0,
  "gm": true,
  "clock": { "title": "The Reeve's patience", "segments": 6, "full": "The Reeve sends his men." }
}
```

Defina-o, some a ele e teste-o em condições como qualquer sinalizador numérico. O Game Master recebe os relógios a cada turno e, uma vez, quando um fica cheio (por um evento ou pela própria tag dele, no turno seguinte), recebe o que deve fazer acontecer. Um relógio com `"hidden": true` fica oculto até que um evento o mostre com `show`.

### Diretrizes

Uma diretriz é uma instrução permanente para o Game Master, em vigor enquanto as suas condições forem cumpridas:

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

<a id="conditions"></a>

### Condições

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. Todas as condições de uma lista `if` precisam ser cumpridas. Um sinalizador de sim ou não só é comparado com `=` ou `!=`.

`{ "party": "<person id>", "is": "in" | "out" }` pergunta se uma pessoa do mundo viaja com a equipe agora, como um companheiro que a história recrutou (Capability API 1.349).

`{ "partySize": { "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <1 to 32> } }` pergunta quantos membros a equipe tem: o personagem do jogador e cada companheiro que viaja com ele, exceto os companheiros que nunca lutam (Capability API 1.360). Só é cumprida quando o Engine conhece o tamanho da equipe.

`{ "any": [<condition>, <condition>, ...] }` é cumprida quando qualquer uma das suas 2 a 8 condições é cumprida (Capability API 1.358): uma alternativa na mesma lista, em vez de dois eventos.

```json
"if": [{ "any": [{ "flag": "won_granary", "is": "=", "value": true }, { "party": "p11-3", "is": "in" }] }]
```

### Conhecimento

O que as pessoas sabem e dizem sobre si mesmas, umas sobre as outras e sobre o cenário, mudando conforme a história avança (Capability API 1.348). Cada entrada é passada ao Game Master como algo que essa pessoa pode dizer se o assunto surgir, num turno em que:

- as suas condições são cumpridas;
- a sua `person` está na cena: nomeada na última resposta ou na mensagem do jogador, ou viajando com a equipe;
- e, quando ela tem `keys`, uma delas também é dita ali. Uma entrada sem pessoa precisa de palavras-chave e é incluída só por elas.

No máximo 12 são passadas por turno. A partir da 1.361, elas são ordenadas: primeiro as pessoas nomeadas pela cena, depois as entradas sem pessoa acionadas pelas palavras dela e, por fim, os companheiros que apenas acompanham a viagem; dentro de cada grupo, as entradas são distribuídas pessoa por pessoa, para que um companheiro falante nunca tire o espaço dos demais. Os companheiros que acompanham a viagem sempre ficam com duas das 12, por mais cheia que a cena esteja, distribuídas da mesma forma.

```json
"knowledge": [
  { "id": "hob-self", "person": "p3-4", "text": "Hob was a miller's boy before the year stopped." },
  { "id": "hob-mill", "person": "p3-4", "if": [{ "flag": "act", "is": ">=", "value": 2 }],
    "text": "Since the second act, Hob is afraid of the mill." },
  { "id": "hob-bells", "person": "p3-4", "keys": ["bells"], "text": "Hob thinks the bells are a lie." },
  { "id": "wheel", "keys": ["mill", "millwheel"], "text": "The mill's wheel has not turned in a hundred autumns." }
]
```

Um roteiro comporta até 600 entradas. No máximo 12 são passadas por turno, na ordem do roteiro, então coloque primeiro as mais importantes.

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
| `fight` | Quando uma luta termina com o `outcome`: `victory`, `defeat` ou `flee`. Com `fight` (uma das lutas do roteiro, 1.358), só quando essa luta terminou assim: a luta iniciada pela última resposta do Game Master, pela ação `fight` da história ou pelo acionamento do próprio Game Master. |
| `leave` | Quando a equipe sai de `place` (um ID de lugar) e de todos os lugares dentro dele (1.358): por uma caminhada, uma visita, um lugar nomeado pelo Game Master ou o `move` da história, na última resposta ou neste turno. Com `repeat`, de novo a cada vez que ela sai. |
| `broke` | Quando uma luta quebrou o objeto de cenário chamado `prop` (Capability API 1.316), comparado sem diferenciar maiúsculas e minúsculas. Só é possível nomear um objeto de cenário pintado em um dos campos de batalha do mundo. |
| `flags` | Quando as suas condições são cumpridas. Com `repeat`, de novo a cada vez que elas voltam a valer depois de terem deixado de valer. |
| `gm` | Só quando o Game Master o aciona (o evento precisa de `"gm": true`). |
| `rest` | Depois de uma resposta em que a equipe descansou: um `[sheet: op="rest"]` aceito na resposta do Game Master, do descanso do conjunto de regras nomeado por `rest` (seu ID ou rótulo, como `long`) ou de qualquer um (1.349). |
| `travel` | Num turno em que a equipe parte de um lugar para outro, de dentro de `from` para dentro de `to`, quando informados (1.349). |
| `idle` | Depois de `turns` respostas seguidas sem nada acontecer: nenhum evento de história, caminhada ou luta (1.349). |
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
| `{ "give": { "item": "<catalog/entry or a name>", "count": 1, "who": "...", "summary": "..." } }` | Dá um item (1.343): um dos itens do conjunto de regras da partida pelo ID, ou qualquer outro pelo nome (com `summary` explicando o que é), à bolsa do jogador ou ao membro da equipe nomeado por `who`. Ele entra como entraria um item dado pelo próprio Game Master, então as regras do inventário se aplicam. Um ID que o conjunto de regras da partida não oferece é recusado, com o motivo na resposta. |
| `{ "fight": "<fight id>" }` | Inicia uma das lutas do roteiro (1.343). O Game Master é orientado a preparar a entrada nela, e a luta seguinte tem os oponentes da história. |
| `{ "move": "<place id>" }` | Coloca a equipe num lugar do mundo (1.343), como uma caminhada faria; um evento `arrive` provocado por isso acontece no mesmo turno. |
| `{ "ending": "<ending id>" }` | Encerra a partida com um dos finais do roteiro (1.343): a cena é reproduzida, o Game Master conclui com o epílogo e o jogador vê o final e recebe a opção de encerrar a sessão. Nada na história acontece depois disso. |
| `{ "music": "<track id>" }` or `{ "music": null }` | Coloca uma das faixas da sua Experience no lugar da música do local (1.345), até outra indicação, ou `null` devolve o controle à música do local. A faixa precisa estar em `music` do pacote de mapas. |
| `{ "recruit": "<person id>" }` | Inclui um dos companheiros da sua Experience na equipe (1.347), com a ficha dele para o conjunto de regras da partida. O Game Master é orientado a mostrar a chegada dele. |
| `{ "dismiss": "<person id>" }` | Dispensa um companheiro da equipe (1.347). |
| `{ "season": { "place": "<place id>", "to": "winter" } }` | Mantém um lugar e todos os lugares dentro dele numa estação, independentemente da data (1.351); sem `place`, o mundo inteiro. `"to": null` permite voltar às próprias `seasons` do roteiro ou à estação da data. |
| `{ "sheet": { "condition": "<id>", "state": "on" }` or `{ "sheet": { "track": "<id>", "by": 1, "upTo": 3 } }` | Aplica uma condição de ficha a cada membro da equipe ou a remove (`"off"`), ou altera uma trilha da ficha de cada um, parando em `upTo` (1.368): o frio de Rime Edge que nenhum descanso cura, por meio de uma condição cuja condição de combate tem `cannot-heal-nonmagical`. O acionamento pelo próprio Engine a aplica com a resposta que ele escreve; o do Game Master, no turno seguinte ao da marcação. |

Qualquer ação pode ter o próprio `if` (Capability API 1.358): ela só é realizada quando as suas condições são cumpridas no momento em que o evento chega a ela, com as ações anteriores do evento já realizadas, então um evento pode ter ramificações.

```json
"do": [
  { "add": "approval", "amount": 2 },
  { "tell": "Hob warms to the party.", "if": [{ "flag": "approval", "is": ">=", "value": 5 }] },
  { "tell": "Hob keeps his distance.", "if": [{ "flag": "approval", "is": "<", "value": 5 }] }
]
```

As ações realizadas ficam registradas com o acionamento, então as cenas e os pedidos de um evento `gm` chegam no turno seguinte como foram realizados quando o Game Master o marcou.

Cada recurso de história exige uma versão secundária da Capability API:

- relógios exigem 1.342;
- lutas, finais e as ações `give`, `fight`, `move` e `ending` exigem 1.343;
- indicações musicais exigem 1.345;
- recrutar ou dispensar companheiros exige 1.347;
- conhecimento exige 1.348;
- eventos `rest`, `travel` e `idle`, uma `priority`, uma condição `party` ou mais de 128 eventos exigem 1.349;
- `seasons` e a ação `season` exigem 1.351;
- mais de 64 sinalizadores exigem 1.353;
- `variants` de lutas exigem 1.356;
- condições `any`, um evento `fight` nomeando a sua luta, um evento `leave`, `min` ou `max` de um sinalizador e um `if` numa ação ou página exigem 1.358;
- uma condição `partySize`, uma variante para uma equipe acima de 6 membros ou sem limite superior, ou mais de 6 variantes exigem 1.360;
- uma ação `season` com `over` para tudo dentro dela exige 1.361;
- `exposures` exigem 1.362;
- criaturas de luta com `adjust` exigem 1.363;
- um `save` de exposição ou `upTo` de uma trilha exige 1.364;
- `sparedByShade` de uma exposição exige 1.365;
- `heldGround` exige 1.366;
- uma ação `sheet` exige 1.368;
- `release` de Held Ground exige 1.369;
- dar uma lista de alternativas exige 1.370 (um ID de entrada simples e isolado, fornecido a partir de qualquer catálogo que o contenha desde a 1.370, é um nome para um Engine mais antigo);
- criaturas de luta com `adjust` em `calls` ou `levels` exigem 1.371.

Um companheiro é uma pessoa marcada como tal no arquivo de pessoas do pacote (veja as pessoas do pacote de mapas em [pacotes opcionais de agentes](../development/optional-agent-packages.md)).

Dos eventos `rest`, `travel` e `idle` que poderiam acontecer num turno, só um acontece: o de maior `priority` (um inteiro de -100 a 100, 0 quando omitido; o primeiro no roteiro em caso de empate). Assim, uma conversa de companheiro à fogueira, dois companheiros discutindo na estrada ou um companheiro procurando o jogador numa hora tranquila nunca se acumulam. Com uma condição `party`, uma cena assim só acontece enquanto esses companheiros viajam com a equipe. Um roteiro pode ter 256 eventos a partir da 1.349 (128 antes).

### Exposições

O que permanecer num lugar faz à equipe ao longo do tempo (Capability API 1.362), como um campo de luz do meio-dia que desgasta os viajantes fora de uma luta, como a regra de luz de um tabuleiro faz dentro dela:

```json
"exposures": [
  { "id": "noonfield", "place": "e9", "label": "Noonfield's light", "hours": 1,
    "tracks": [{ "track": "exhaustion", "by": 1 }], "applies": ["sunstruck"],
    "if": [{ "flag": "darkness_carried", "is": "=", "value": false }],
    "tell": "The light presses on them; darkness would be a mercy." }
]
```

Pelo relógio da partida: o primeiro turno em que a equipe está em `place` (ou dentro dele) enquanto `if` é cumprida inicia a exposição, e cada turno seguinte conta quantas `hours` se passaram ali desde então. A cada intervalo desses, o Engine altera as `tracks` em `by` e aplica as condições de `applies` a cada membro da equipe, com os próprios comandos de ficha aplicados junto com os da resposta, e avisa o Game Master (com `tell`). Sair do lugar, ou deixar de cumprir `if`, encerra a exposição; ela começa do zero na próxima vez. Isso é registrado na resposta (`[story: exposure=...]`), uma vez.

Uma trilha pode parar num limite máximo (Capability API 1.364): `{ "track": "exhaustion", "by": 1, "upTo": 3 }` nunca a leva além de 3 nem altera uma que já esteja acima disso. Uma exposição pode pedir um teste de resistência em vez de afetar todos (1.364), no mesmo formato de `save` da regra de luz de um tabuleiro de combate (1.321):

```json
"save": { "save": "con_save", "difficulty": 12, "against": { "conditions": ["noon_light"] } }
```

A cada aplicação, o Engine faz esse teste de resistência para cada membro da equipe a partir da própria ficha, e só quem falha recebe as trilhas e condições, cada um com o próprio comando de ficha. `against` indica contra o que o teste é feito, então um modificador de teste restrito a isso vale fora de uma luta como vale dentro dela: um chapéu de palha de uma sobreposição com `{ "to": "saves", "mode": "advantage", "against": { "conditions": ["noon_light"] } }` dá vantagem a quem o usa. O Game Master recebe quem passou e quem falhou, com os totais.

Com `"sparedByShade": true` (Capability API 1.365), uma fonte de sombra carregada acesa por qualquer membro da equipe impede uma exposição, como quando `if` não é cumprida: um item cujo `light` vestido ou carregado tem `"shade": true` (a Lantern of Dusk do exemplo de demonstração), e, se ele tem um botão liga/desliga, só enquanto está ligado. Acendê-lo encerra a exposição; apagá-lo a reinicia do zero.

### Held Ground

Onde a morte fica retida (Capability API 1.366), como no vale do exemplo de demonstração:

```json
"heldGround": [
  { "id": "valley", "place": "p0", "label": "The Held Autumn", "condition": "felled",
    "marks": [{ "track": "owing", "by": 1 }],
    "if": [{ "flag": "year_turned", "is": "=", "value": false }],
    "tell": "Nobody here has died in forty years." }
]
```

Enquanto a equipe está em `place` (ou dentro dele; sem esse campo, no mundo inteiro) e `if` é cumprida, uma luta do conjunto de regras iniciada ali acontece em Held Ground (1.323): quem fica sem vida é abatido, fora da luta, estável e sem morrer, e se levanta depois, a menos que tenha sido abatido por algo que ceifa. `condition` é aplicada aos abatidos, e as trilhas de `marks` de cada personagem abatido são alteradas (uma marca de Owing). Vale a primeira entrada cujas condições forem cumpridas. A história registra a entrada e a saída da equipe (`[story: held=...]`) e avisa o Game Master a cada vez (com `tell`); a cada turno em que o efeito vale, o Game Master recebe um lembrete do que ele significa.

Held Ground pode liberar o que reteve (Capability API 1.369): a virada do ano do exemplo de demonstração. O seu `release` diz o que então deve ser cobrado:

```json
"release": { "felled": "die", "owing": { "track": "owing", "bonus": { "flag": "hymn_bonus" } } }
```

`felled` indica o destino de quem está abatido: morre (`"die"`, o padrão) ou cai e começa a morrer pela regra do próprio conjunto de regras (`"down"`). `owing` faz cada membro da equipe realizar um dos testes de resistência contra a morte do conjunto de regras para cada marca em `track` (a primeira trilha marcada de Held Ground, quando não informada), somando `bonus` a cada um (um número ou um sinalizador numérico lido no momento da liberação), até acabarem as marcas ou o resultado ser decidido; as marcas são gastas, e três falhas significam morte. Numa luta do conjunto de regras ainda naquele local, a liberação acontece no próprio passo que a provoca: o uso de um item que gasta o número da história lido pelo seu `if` (1.359), ou um objeto de cenário quebrado a que um evento `broke` responde (1.316), e os eventos de sinalizadores que eles disparam. Os abatidos e Owing são cobrados nessa rodada, pela liberação da própria luta (1.330). Fora de uma luta, o turno de história que registra isso faz os testes de Owing de cada membro a partir da própria ficha e diz ao Game Master quem viveu e quem morreu; uma luta deixada inacabada ali libera o efeito no próximo passo. O que uma luta já liberou nunca é rolado duas vezes.

<a id="seasons"></a>

### Estações

As estações de um mundo seguem o calendário dele, com 90 dias cada. Uma história pode manter lugares numa estação independentemente da data (Capability API 1.351): um vale preso no outono, uma colina mantida no inverno.

```json
"seasons": [{ "place": "p3", "season": "autumn" }, { "season": "summer" }]
```

Cada definição mantém um lugar e todos os lugares dentro dele; uma sem `place` mantém o mundo inteiro. O lugar mantido mais próximo decide: uma aldeia mantida no inverno dentro de uma região mantida no outono está no inverno. A ação `season` muda uma estação mantida durante a partida ou a libera. Uma definição com `over` para tudo dentro dela (1.361) é a exceção: ela prevalece sobre todas as estações ali, as do roteiro e qualquer outra definição (primeiro a definição mais externa desse tipo), então `{ "season": { "to": "spring", "over": true } }` muda o mundo inteiro de uma vez. Onde a equipe está sob esse efeito, o Game Master recebe a estação e o aviso de que ela está mantida; o clima é criado para ela; o overworld desenha cada casa na estação do lugar mais próximo dela (os tiles `<id>@<season>` de um pacote de tiles), e uma cidade na própria estação.

Um campo de batalha pintado à mão no mundo também pode ser pintado com estações: uma linha `seasons` por linha de tiles, uma letra ou `.` por tile, com `seasonKeys` nomeando as letras (`{ "a": "autumn", "w": "winter" }`). Um tile deixado como `.` fica na estação do lugar da luta. Os tiles de uma luta começam nessas estações, e os eventos de mapa da rodada podem mudá-las, como um anel de geada se expandindo ou uma linha de primavera atravessando o terreno.

### Lutas

Uma luta definida pela história: contra quem se luta e onde, quando o mundo tem um tabuleiro pintado para ela.

```json
{
  "id": "granary",
  "name": "The Granary",
  "creatures": [
    { "creature": "creatures/scarecrow", "count": 3 },
    { "creature": "The Owed", "name": "The Owed" }
  ],
  "battlefield": "b2",
  "note": "The jars break when hit."
}
```

Cada criatura vem do bestiário do conjunto de regras da partida, pelo ID (`catalog/entry`) ou pelo nome, em quantidade `count` (numeradas quando há várias), chamada de `name` na luta quando informado. `battlefield` é um tabuleiro pintado à mão no mundo (`b<n>`), usado onde quer que a luta comece; sem ele, a luta acontece onde começa, como qualquer outra. `note` explica ao Game Master como ela surge. Um ID que o conjunto de regras da partida não tem é recusado: essas criaturas ficam fora da luta e a recusa é registrada. Uma luta que fique sem nenhuma ainda começa como a história definiu, no seu campo de batalha, mas o Game Master escolhe os inimigos.

Uma luta pode ser ajustada para equipes de outros tamanhos (Capability API 1.356). A equipe é o personagem do jogador e cada companheiro que viaja com ele, exceto um companheiro marcado como `noncombatant` (1.360).

```json
"variants": [
  { "party": { "min": 3, "max": 4 }, "creatures": [{ "creature": "creatures/scarecrow", "count": 4 }] },
  { "party": 5, "creatures": [{ "creature": "creatures/scarecrow", "count": 5 }], "battlefield": "b3",
    "note": "The Owed wakes in the loft." }
]
```

É usada a variante cujo `party` abrange o tamanho da equipe, com as próprias criaturas e os próprios `battlefield` e `note` quando informados (caso contrário, os da luta). Uma equipe que não cabe em nenhuma variante enfrenta a luta como escrita. Nenhum tamanho pode ser abrangido por duas variantes.

Uma entrada de criatura de uma luta ou variante pode ajustá-la para aquela luta com `adjust` (Capability API 1.363), para que um chefe acompanhe a equipe sem precisar de uma criatura própria: `"adjust": { "legendaryResistance": 2, "maxHp": 40 }` dá a ela essa Legendary Resistance (0 a remove) e essa vida (um número fixo no lugar do bloco dela, incluindo os dados). O Game Master recebe isso junto com a criatura. O `calls` de um ajuste muda quem as ações da criatura convocam (Capability API 1.371): `[{ "action": "shelves_lean", "creature": "creatures/wraith" }]`, pelo ID ou nome da ação, para uma ação que convoca (1.325). O seu `levels` muda qualquer um desses valores a partir de um nível da equipe, cada um sobre o anterior: `"levels": [{ "from": 8, "calls": [{ "action": "shelves_lean", "creature":
"creatures/wraith" }] }]`. O nível da equipe é o maior alcançado por qualquer membro dela, lido dos campos de nível que as fichas de companheiros da Experience nomeiam para o conjunto de regras da partida; sem um, `levels` não é lido. Um `party` nomeia tamanhos até 32; uma faixa sem `max` (`{ "min": 7 }`, Capability API 1.360) abrange qualquer equipe a partir do seu `min`, por maior que seja. O Game Master recebe o tamanho da equipe para o qual a luta foi ajustada quando ela começa e de novo depois da recapitulação.

### Finais

```json
{ "id": "kept", "title": "The Year Kept", "cutscene": "bells", "epilogue": "The valley stays held." }
```

`cutscene` é uma das cenas do roteiro, reproduzida quando o final começa; `epilogue` é o que o Game Master usa para concluir a partida e o que o jogador lê quando o final é mostrado.

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

Uma página pode ter um `if` (Capability API 1.358): ela só é mostrada enquanto as suas condições forem cumpridas durante a cena, então uma cena de acampamento pode dar uma fala a cada companheiro só enquanto ele viaja com a equipe.

```json
{ "speaker": "p11-3", "text": "Another night.", "if": [{ "party": "p11-3", "is": "in" }] }
```

Uma cena cujas páginas foram todas barradas não mostra nada.

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

`"defined"` faz da primeira mensagem da partida exatamente o `text`; o Game Master não escreve nada para ela, e regenerá-la produz o mesmo texto. `"guided"` apenas orienta a abertura que o Game Master escreve, como uma orientação que ele lê só para essa primeira resposta. `text` tem de 1 a 8.000 caracteres e pode conter quebras de linha (é o único texto de uma história que pode), mas nunca `{{`; um texto guiado também não pode conter colchetes. Com `locked`, o jogador vê a introdução na configuração do GM e não pode mudá-la; sem isso, a introdução só preenche o campo da configuração, e o jogador pode alterá-la ou apagá-la. Uma partida cuja primeira resposta já foi escrita, ou que herda a equipe de outra partida, não tem introdução. Uma Experience também pode definir a introdução junto com os outros valores de configuração do GM (`contributions.gameSurface.setup.defaults.intro`, 1.372); essa é lida primeiro.

## Como uma história se desenrola

Uma vez por turno, antes de o Game Master responder, o Engine lê o que a história já fez até ali e o que este turno traz (uma caminhada, uma visita, o fim de uma luta) e deixa os eventos acontecerem. O que acontece fica escrito no início dessa resposta: uma tag que registra cada evento e o que ele definiu, e qualquer cena mostrada como foi escrita. Como a história é lida de volta a partir das respostas, um swipe ou uma regeneração desfaz o que aquela resposta fez, e uma história alterada no meio da partida nunca reescreve o que já aconteceu. Ela continua na próxima sessão da partida.

<a id="the-game-masters-tags"></a>

### As tags do Game Master

A cada turno, o Game Master recebe os valores da história (ocultos do jogador) e as diretrizes em vigor. Do resto do roteiro, ele recebe apenas o que o roteiro torna dele: os eventos `gm` (com a `note` de cada um e quaisquer `beats` a narrar junto com eles) e os sinalizadores `gm`, além de quais desses eventos ele não pode marcar agora (já concluídos ou barrados pelas suas condições). Ele os marca na resposta:

- `[story: event="<id>"]` aciona um evento `gm` cujas condições são cumpridas (uma vez, a menos que ele se repita).
- `[story: flag="<id>" value="<value>"]`, ou `add="<number>"` para um sinalizador numérico, define um sinalizador `gm`.

Os presentes, a luta e o movimento de um evento `gm` entram na resposta com a sua tag; a cena final e o epílogo chegam no início da resposta seguinte.

O Engine responde a cada tag no próprio lugar, um evento no máximo uma vez por turno, e recusa qualquer outra coisa informando o motivo. Numa partida sem história, toda tag de história é recusada. O que o Game Master aciona tem efeito imediato (os sinalizadores, os feitos); as cenas e os pedidos chegam no início da resposta seguinte, exceto os `beats` (ele já foi solicitado a narrá-los junto com o momento). Escreva as `pages` de um evento `gm` como o que vem depois do momento, já que o Game Master já narrou o próprio momento.

## Experimentar uma história

Salve-a numa partida com `PUT /api/game/:chatId/story` e `{ "story": { ... } }`: uma história que não se encaixa é recusada com todos os motivos. A aba World (mundo) da partida lista os objetivos e relógios que a história já mostrou, e o prompt do Game Master leva os valores e as diretrizes da história a cada turno.
