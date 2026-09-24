# Escrever conjuntos de regras de Game Mode

Um conjunto de regras informa ao Game Mode como funciona um sistema de mesa: quais dados um teste rola, o que há na ficha, quais recursos são gastos e o que um descanso recupera. Este guia é para quem quer escrever seu próprio conjunto e compartilhá-lo. Para jogar com um criado por outra pessoa, comece por [Escolher as regras](../game/getting-started.md#choosing-rules).

Um conjunto é um arquivo JSON. São dados, não código. Nada nele é executado, então importá-lo não pode fazer nada no seu computador. Antes de importar um arquivo alheio, leia com atenção o texto do Game Master: ele é enviado ao modelo em toda partida que usa o conjunto.

## Leia primeiro: o que um conjunto pode e não pode fazer

Um conjunto só pode preencher os parâmetros de uma mecânica que o motor já conhece. Hoje ele conhece duas formas de resolver um teste; o arquivo escolhe uma com `resolution.kind`:

- **`dice-sum`**: rolar dados, adicionar números da ficha e alcançar ou superar uma dificuldade. Isso cobre sistemas d20, sistemas de 2d6 mais atributo e muitos outros.
- **`dice-pool`**: rolar a quantidade de dados do personagem e contar os que atingem um alvo. Isso cobre sistemas em que uma pontuação representa um punhado de dados, não um bônus.

Ambos são descritos por completo em [Tipos de resolução](#resolution-kinds).

Uma mecânica que não se encaixa em nenhuma forma não pode ser escrita no arquivo. Por exemplo: usar o maior dado de uma reserva, testes percentuais abaixo de um valor, dados de símbolos e reservas opostas. Cada uma precisa de um novo tipo de resolução no motor: uma contribuição de código com testes, não um JSON. Se seu sistema precisa disso, abra uma solicitação de recurso no repositório do motor e descreva a mecânica com algumas rolagens resolvidas. Esses exemplos viram os testes.

Game Mode pode resolver uma luta com o combate próprio do Marinara ou com as regras do conjunto. O bloco opcional `battle` empresta ao combate do Marinara os números das fichas: veja [Batalhas](#battles-lending-the-sheet-to-marinaras-combat). O bloco opcional `combat` define como o conjunto resolve a luta: veja [Combate](#combat-a-fight-your-own-rules-resolve). O motor já aplica essas regras. **Combat Preference** (Preferência de combate) escolhe a apresentação Classic ou, quando o conjunto define distância, um campo Tactical.

## Início rápido

1. Copie o exemplo que corresponde às rolagens do seu sistema. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) é um pequeno sistema de 2d6 com três atributos que mostra que o formato não pressupõe d20 nem seis atributos. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) é uma pequena reserva de dados de dez faces com três pontuações e seis ofícios. Como exemplo completo, veja o arquivo 5e (SRD 5.1), [`ruleset-5e-2014.example.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/ruleset-5e-2014.example.json).
2. Troque `id` pelo seu. Use letras minúsculas, dígitos e hífens simples, como `ember-roads`.
3. Edite a ficha, os descansos e o texto do Game Master.
4. Importe o arquivo; veja [Experimentar seu conjunto](#trying-your-ruleset). A importação verifica o arquivo inteiro e informa os erros linha por linha antes de salvar qualquer coisa.
5. Crie uma partida, escolha seu conjunto em **Rules** (Regras) e jogue alguns testes.

Para receber ajuda enquanto escreve, indique o JSON Schema ao editor adicionando esta primeira linha dentro das chaves externas do arquivo:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

O esquema detecta chaves mal escritas e tipos incorretos durante a digitação. Ele não verifica se os nomes apontam para elementos existentes, como uma perícia que nomeia um atributo. A importação faz isso.

Você pode adicionar uma linha `"$comment": "..."` a qualquer objeto para deixar uma nota. O motor a ignora.

## As partes do arquivo

| Chave | Conteúdo |
| --- | --- |
| `schemaVersion` | Sempre `1`. |
| `id`, `version` | O nome do conjunto para o motor e um inteiro que você aumenta a cada mudança publicada. |
| `name` | O que os jogadores veem no assistente. |
| `edition` | Opcional. Uma linha sobre a edição ou o rascunho. |
| `license` | Opcional. Um ID SPDX e a atribuição exigida pela fonte. |
| `coverage` | O que o conjunto cobre e o resumo de uma linha exibido no assistente. |
| `resolution` | Como um teste ou salvaguarda é rolado. |
| `sheet` | Tudo que há na ficha. |
| `rests` | O que cada descanso restaura e limpa. |
| `gm` | O texto fornecido ao modelo do Game Master e os valores de ficha que ele vê por personagem. |
| `catalogs` | Opcional. Entradas prontas oferecidas pelo editor para evitar listas longas digitadas à mão. |
| `battle` | Opcional. O que uma batalha lê da ficha e grava de volta depois. |
| `combat` | Opcional. Como suas regras resolvem uma luta e o que a tela de batalha executa. |
| `layers` | Opcional. Variantes do conjunto ativadas na criação de uma partida. |

O arquivo pode ter até 256 KB. Texto que entra num prompt (nomes, rótulos, texto do Game Master) não pode conter quebras de linha, colchetes nem chaves duplas.

IDs dentro da ficha (atributos, perícias, campos, reservas etc.) usam letras minúsculas, dígitos e sublinhados, começando com uma letra, como `grit_max`.

<a id="resolution-kinds"></a>

### Tipos de resolução

`resolution.kind` escolhe como rolar um teste. Os dois tipos leem a mesma ficha e compartilham três chaves; as partes do arquivo depois de `resolution` não mudam ao alternar:

- `abilityModifier`: como uma pontuação da ficha vira um número. `identity` usa a própria pontuação; `floorHalfMinusTen` é a regra de 5e; `stepTable` permite definir seus limiares como `[[score, number], ...]`.
- `proficiencyTiers`: níveis de treinamento de uma perícia ou salvaguarda. O primeiro vale para uma perícia não listada. Um nível adiciona `flat`, ou `multiplier` vezes um bônus de proficiência, ou ambos. Se o sistema tem esse bônus, indique a origem com `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: opcional, necessário apenas para um nível que multiplica.

O significado do número depende do tipo: `dice-sum` o soma à rolagem; `dice-pool` rola essa quantidade de dados.

#### `dice-sum`: somar os dados

```json
"resolution": {
  "kind": "dice-sum",
  "dice": { "count": 2, "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained" },
    { "id": "trained", "label": "Trained", "flat": 1 }
  ],
  "advantage": false,
  "difficultyLadder": [
    { "label": "Easy", "dc": 6 },
    { "label": "Hard", "dc": 10 }
  ]
}
```

- `dice`: quantidade de dados e de faces. O total é comparado à dificuldade.
- `advantage`: se o GM pode pedir duas rolagens e manter uma.
- `naturals`: efeito das faces máxima e mínima de um dado único em testes e salvaguardas: `none`, `both`, `max-only` ou `min-only`. Omita para usar só aritmética. Exige um único dado; um sistema 2d6 precisa usar `none`.
- `difficultyLadder`: dificuldades entre as quais o GM deve escolher. `dc` é o número que o total precisa alcançar.

#### `dice-pool`: rolar os dados e contá-los

O número da ficha é o **tamanho da reserva**, não um bônus adicional. Uma pontuação de 3 e um ofício que vale 2 rolam cinco dados. Essa é a ideia: sem novo vocabulário de ficha nem novo editor, um sistema cujas pontuações são punhados de dados usa as mesmas `abilities`, `skills` e `proficiencyTiers` de qualquer outro.

```json
"resolution": {
  "kind": "dice-pool",
  "die": { "sides": 10 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "rating_0", "label": "Untried" },
    { "id": "rating_1", "label": "Shown once", "flat": 1 }
  ],
  "pool": { "min": 1, "max": 15 },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`: faces de cada dado da reserva, de 2 a 100.
- `pool`: limites aplicados ao número da ficha antes de qualquer explosão. Um `min` de 0 permite que uma reserva vazia falhe sem rolar; `max` não pode passar de 100.
- `target`: face que o dado precisa atingir para contar. Coloque `min` abaixo de `max` para permitir ao GM ajustá-la por teste com `threshold=`; iguale os três valores para fixá-la.
- `double`: opcional. Uma face igual ou superior a `from` conta duas vezes.
- `explode`: opcional. Uma face igual ou superior a `from` rola mais um dado, que também pode explodir. Dados extras são limitados a `pool.max` além da reserva inicial: um teste rola no máximo o dobro de `pool.max` e um `from` baixo não causa rolagens infinitas.
- `cancel`: opcional. Uma face igual ou inferior a `upTo` retira um sucesso. A contagem nunca fica abaixo de zero.
- `botch`: opcional. Se **nenhum** dado teve sucesso e saiu uma face igual ou inferior a `upTo`, o teste é uma falha crítica. Uma reserva cujo único sucesso foi cancelado falhou, mas não é uma falha crítica.
- `exceptional`: opcional. Essa quantidade de sucessos líquidos ou mais, num teste bem-sucedido, produz um sucesso crítico.
- `situationalDice`: opcional. Limites de dados que o GM pode adicionar ou retirar com `bonus=` por acrobacias, ferimentos ou pouca luz.
- `difficultyLadder`: `successes` informa quantos sucessos são necessários. Um patamar também pode nomear `target`, mas só se for ajustável e dentro dos limites.

As faces de `cancel` e `botch` precisam ficar abaixo do alvo mínimo, e toda face nomeada deve existir no dado. Uma regra impossível de ativar é recusada na importação, em vez de ser descoberta durante a partida.

Um conjunto empacotado que usa reservas exige Capability API 1.24. Um conjunto comunitário importado é validado pelo motor que o lê, então não precisa de nada mais.

#### O que o Game Master pode escrever num teste de reserva

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
```

- `dc` é a quantidade de **sucessos** necessária, não o alvo por dado. Vai de 1 ao máximo que uma rolagem poderia contar: máximo da reserva, dobrado se os dados explodem e dobrado novamente se as faces contam duas vezes.
- `threshold=` ajusta o alvo por dado e só é oferecido quando `target.min` é menor que `target.max`.
- `bonus=` adiciona ou retira dados e só é oferecido se `situationalDice` estiver declarado.
- `with=` rola uma perícia ou salvaguarda com outro atributo. Funciona nos dois tipos; 5e obtém "Strength (Intimidation)" pelo mesmo atributo.

Tudo respeita seu arquivo: valores fora dos limites são ajustados ao extremo mais próximo e um atributo não oferecido é ignorado sem recusar o teste. O registro mostra o que foi realmente usado: alvo e dados extras depois dos limites, e `with=` só quando o atributo foi trocado. O motor sempre rola os dados. Substitui resultados de reserva escritos pelo modelo, ignora `mode="advantage"` porque esse tipo não tem vantagem e não usa um dado que o jogador rolou antes do turno.

#### O que fica fora e por quê

Cada caso exige seu próprio tipo de resolução: nenhum pode ser expresso contando dados que atingem um alvo.

- **Usar o maior dado** (como em Blades in the Dark) exige um nível de sucesso parcial que o resultado de um teste não possui.
- **Reservas de postura comparadas a um atributo** (como em Lasers and Feelings) decidem a direção da comparação por teste.
- **Dados de símbolos** (como em Genesys) não produzem números.
- **Reservas opostas** resolvem dois personagens ao mesmo tempo; um teste tem um único rolador.
- **Percentuais abaixo do valor e percentuais abertos** comparam na outra direção.
- **Reservas somadas com um dado especial** (como em OpenD6) somam os dados e tratam um deles de forma diferente.

As duas coisas que esse tipo deixava de fora já estão modeladas; a seção sobre gastar para mudar uma rolagem explica como. Uma regra do próprio sistema, "spend a point for a success", é `resolution.spend`: compra sucessos ou dados, nunca uma nova rolagem. Rolar novamente pertence a algo escolhido pelo personagem, então usa `mechanics.check` numa entrada de catálogo, pago com o custo da própria entrada.

### Gastar para mudar uma rolagem

Alguns sistemas permitem pagar por uma rolagem prestes a acontecer: um ponto de vontade por um sucesso automático. `resolution.spend` define isso como regra permanente do sistema, não como algo comprado pelo personagem:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` é uma das suas `live.pools`. Não pode começar vazia, pois não haveria nada para gastar no início da partida.
- `amount` é o custo de UMA compra. `successes` e `dice` informam o que ela compra; precisa comprar pelo menos um. Sucessos são adicionados depois da contagem dos dados e das anulações, porque ninguém os rolou. Dados são rolados com a reserva, dentro dos limites dela.
- `perCheck` limita as compras de um teste: no máximo ele pode comprar o equivalente a `amount * perCheck` pontos. Esse teto impede uma reserva cheia de comprar uma rolagem impossível de perder.
- Só `dice-pool` permite isso: uma rolagem somada não tem sucessos nem reserva para receber acréscimos. Um conjunto `dice-sum` que declara `spend` é recusado na importação.
- Duas entradas não podem nomear a mesma reserva, pois o teste não conseguiria distingui-las.

**Isso vai no próprio teste.** O GM escreve `[skill_check: skill="Nerve" dc="2" spend="resolve:1"]`, não um comando `[sheet:]` separado: os dados são rolados antes de aplicar comandos de ficha e não restaria nada para mudar. Uma única resolução rola os dados e paga pelo que os modificou.

### Um amuleto que muda uma rolagem

`resolution.spend` é uma regra do sistema. Uma entrada que o personagem realmente ESCOLHEU também pode mudar um teste, com `mechanics.check` na entrada de catálogo:

```json
"mechanics": {
  "kind": "utility",
  "cost": [{ "pool": "blood", "amount": 1 }],
  "perCostStep": { "flat": 1 },
  "check": { "reroll": { "upTo": 1, "mode": "once" }, "successes": 1 }
}
```

- `reroll` rola novamente os dados iguais ou inferiores a `upTo`. `once` substitui cada um uma vez e mantém a face nova; `until` continua. `upTo` precisa ficar abaixo da face máxima ou rolaria a reserva inteira para sempre. O motor limita quantos dados um teste pode rolar novamente, independentemente do arquivo.
- `dice` adiciona dados antes da rolagem; `successes` adiciona sucessos depois da contagem; `threshold` fixa o alvo por dado para aquela rolagem, dentro da faixa permitida por `target`.
- É necessário pelo menos um dos quatro; caso contrário, a entrada não diz nada e é recusada.
- Só `dice-pool` pode aplicar isso; um conjunto `dice-sum` com `mechanics.check` é recusado na importação.

**O custo é o `cost` da entrada**, pago pelo mesmo mecanismo de qualquer outro uso: a reserva e um uso de cada contador que essa entrada escreveu. `perCostStep` indica que ela ESCALA: se o declara, é comprada tantas vezes quantas seu preço foi pago; caso contrário, é comprada uma vez, independentemente do valor oferecido.

**O GM a nomeia no teste:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Não usa um comando de ficha separado pelo mesmo motivo: os dados rolam antes da atualização dos registros.

**Tudo ou nada.** Se a reserva não cobre o custo, a compra não acontece e nada é descontado; a rolagem continua exatamente como seria. Pontos que não equivalem a um número inteiro de compras também não compram nada. Pedir mais que `perCheck` é limitado, não recusado; só o teto é pago. O motor calcula tudo. O GM nomeia o que o jogador disse que gastaria e nunca mexe nos dados. O registro informa o que foi realmente pago, a entrada aplicada, os sucessos não rolados e quantos dados foram rolados novamente. Um amuleto não escolhido, ou cujo catálogo o motor não consegue ler, não faz nada em vez de ser aplicado por confiança.

### A ficha

- `sections` agrupa elementos no editor.
- `abilities` contém as pontuações principais. `skills` e `saves` podem nomear o atributo de suas rolagens.
- `fields` contém valores individuais. Tipos: `number`, `text`, `longtext`, `boolean`, `enum` (lista fixa de escolhas) e `dice` (texto como `1d8`).
- Valores `derived` são calculados a partir de outros e não podem ser sobrescritos na digitação. Operações: `sum`, `min`, `max`, `scale` (multiplicar e arredondar) e `stepTable` (consultar limiares, como quando um nível define proficiência).
- `lists` contém tabelas com colunas próprias, como equipamento, magias ou características. Uma lista com `pools` transforma cada linha num recurso com máximo próprio, para características de classe com usos limitados.
- `live` é o que muda durante a partida: `pools` (pontos de vida, espaços de magia, Grit), `tracks` (número numa escala, como exaustão, ou trilha de ferimentos com casas), `text` (notas curtas, como concentração) e `conditions`.

Tudo que lê um número o nomeia com uma referência de valor: um objeto com exatamente uma chave entre `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod` e `saveMod`. Por exemplo, uma reserva cujo máximo é derivado: `"max": { "derived": "grit_max" }`.

`hideWhen` oculta um campo, lista ou reserva quando outro campo tem determinado valor. O arquivo 5e usa isso para ocultar espaços de magia de personagens que não lançam magias.

### Trilhas de ferimentos: saúde marcada numa trilha

Muitos sistemas não contam pontos de vida. Têm uma coluna de casas, cada uma pior que a anterior, e você marca uma ao se ferir. Dê `levels` e `kinds` a uma entrada `live.tracks` para transformar um número numa dessas trilhas:

**Qual formato seu sistema precisa?** Uma reserva registra QUANTO dano entrou; uma trilha registra quanto E o tipo de cada parte. Se um ferimento é contundente, letal ou agravado e o tipo ainda importa após o golpe (porque o agravado cura mais devagar, não pode ser absorvido ou acaba matando), precisa continuar registrado após a rolagem. Só uma marca carrega isso. Uma reserva não pode: depois de subtrair o dano, só resta um número menor, sem lembrar quais pontos eram de cada tipo. Por isso `combat.damageKinds` é recusado quando a saúde é uma reserva, em vez de ignorado. Uma reserva ainda pode ter `damageTypes`, e oponentes podem resistir ou ser imunes a eles: isso trata de quanto dano entra, não de qual ferimento fica depois.

```json
{
  "id": "harm",
  "label": "Harm",
  "min": 0,
  "max": 4,
  "levels": [
    { "label": "Scuffed", "penalty": 0 },
    { "label": "Winded", "penalty": -1 },
    { "label": "Bleeding", "penalty": -3 },
    { "label": "Down", "penalty": -99 }
  ],
  "kinds": [
    { "id": "knock", "label": "K", "severity": 0 },
    { "id": "tear", "label": "T", "severity": 1 }
  ]
}
```

- `levels` tem 1–16 patamares, do melhor ao pior. Cada um tem `label` e `penalty` inteiro igual ou inferior a 0. Um número negativo grande expressa ficar fora de ação, então `-99` é válido.
- `kinds` tem 1–6 tipos de dano aceitos, cada um com `id`, `label` curto para a casa e `severity`. As gravidades precisam ser distintas; só a ordem importa, não os números em si, então distribua-os como quiser.
- Os dois andam juntos. `kinds` sem `levels` é recusado porque não haveria onde marcar, e `levels` sem `kinds` é recusado porque uma marca precisa ter um tipo.
- **Separe os dois termos.** `kinds` define o que uma marca PODE SER. Uma MARCA é um desses tipos colocado na trilha durante a partida. A definição contém tipos; a ficha contém marcas.
- O comprimento da trilha corresponde aos níveis: `min` é 0 e `max` é `levels.length`. Qualquer outro valor é recusado em vez de corrigido, para que o arquivo nunca contenha dois comprimentos contraditórios.

**As regras exatas**, porque uma leitura vaga produz a trilha errada:

- As marcas ficam ordenadas, **as mais graves primeiro**. Sete níveis comportam no máximo sete marcas.
- Uma marca é **inserida por ordem de gravidade**, nunca simplesmente no fim. Ocupa o nível mais alto que lhe cabe e empurra as leves para baixo.
- A penalidade ativa é a do **nível marcado mais baixo**, nunca a soma. Três marcas no exemplo dão `-3`, não `0 + -1 + -3`.
- `amount` é a quantidade de marcas de um tipo, **aplicadas uma por vez**. Uma trilha que enche no meio do processo segue a mesma regra de uma que já estava cheia.
- Marcar uma trilha **cheia** **aumenta um passo a gravidade da marca mais leve**, em vez de adicionar outra. Um passo na sua escala de tipos, qualquer que fosse o tipo da marca nova.
- Uma marca que passaria da gravidade máxima fica nela; a que não coube conta como **transbordamento**. Isso é salvo, para que recarregar não esqueça dano já recebido.
- **Curar usa o mesmo comando com quantidade negativa.** Limpa primeiro as marcas mais leves e limpa o transbordamento antes de qualquer marca.

**Marcar durante a partida.** O GM escreve `[sheet: op="damage" track="harm" kind="knock" amount="1"]` e cura com `amount` negativo. A forma de reserva de `damage`, que nomeia `pool=`, não muda. O comando comum `track` é recusado em trilhas de ferimentos: um número não identifica os tipos das novas marcas. O jogador também pode marcar e limpar casas manualmente na ficha, como esses sistemas esperam.

**Uma luta também pode marcá-la.** Aponte `combat.health` para a trilha em vez de uma reserva: um golpe acertado marca as casas indicadas por `combat.damageKinds.marks`, do tipo ao qual esse bloco mapeia seu dano. Um personagem com a trilha cheia está caído, o estado lido pela regra de morte. Cura limpa uma marca. Pontos temporários são recusados porque a trilha não tem um espaço para eles. O motor lê a trilha como níveis RESTANTES; o restante da luta, cair, reviver, o registro e o resumo continuam iguais.

**Um descanso pode curar a trilha.** Uma restauração com `"to"` a reduz àquela quantidade de marcas, incluindo transbordamento; com `"by"`, limpa aquela quantidade, começando pelo transbordamento. Um passo que ADICIONARIA marcas não faz nada porque o descanso não nomeia um tipo.

### A penalidade nas rolagens

`resolution.penaltyFrom` nomeia a trilha de ferimentos cuja penalidade afeta todo teste do conjunto. É declarada, não presumida: sem ela, as rolagens continuam como antes da existência das trilhas.

O EFEITO da penalidade depende do tipo de resolução, assim como o número da ficha:

- Em `dice-pool`, ela **retira dados da reserva**, sem baixar de `pool.min`. Um `pool.min` de 1 permite rolar um dado mesmo no último patamar; um `pool.min` de 0 permite não rolar nenhum e falhar sem lançamento.
- Em `dice-sum`, é um **modificador fixo na rolagem**, incorporado ao mesmo número ao qual atributo e treinamento já contribuem.

Ela precisa nomear uma trilha de ferimentos. Uma trilha comum não tem penalidade e é recusada na importação. O resultado indica a penalidade aplicada para explicar ao jogador seus dados a menos; o bloco de ficha do GM também mostra o patamar e seu custo.

### Descansos

Um descanso lista restaurações e elementos a limpar. Cada passo nomeia um alvo (`pool`, `poolGroup`, `listPools` ou `track`) e o define (`"to": "max"`, `"to": "min"` ou um número) ou modifica (`"by": { "const": 1 }` ou `"by": { "fractionOfMax": 0.5 }`). Se nomeia uma trilha de ferimentos, só pode curá-la; veja acima.

### Texto do Game Master

- `checkGuidance` substitui o parágrafo integrado que ensina a pedir um teste. Informe o sistema e quando rolar. O GM só nomeia perícia e dificuldade. O motor rola e calcula a partir da ficha: não peça matemática ao modelo.
- `sheetGuidance` apresenta as fichas no prompt. Explique quais recursos importam e quando gastá-los.
- `worldGuidance` é opcional e lido uma vez ao gerar o mundo, para adequar a ambientação às regras: sem pólvora, magia rara, mortos que andam. Nunca chega a um turno.
- `sheetSummary` escolhe campos, valores derivados e linhas de listas que o GM vê por personagem. O motor sempre mostra modificadores de atributo, perícias e salvaguardas treinadas e valores vivos. Mantenha o restante curto, pois é enviado a cada turno.

## Catálogos: entradas prontas para as listas da ficha

Digitar uma lista de magias, tabela de equipamento ou página de características linha por linha é cansativo. Um catálogo é uma coleção nomeada de entradas prontas distribuída com o conjunto. O editor as oferece num seletor em cada lista alimentada pelo catálogo; escolher uma preenche a linha.

Catálogos são opcionais. Um conjunto pode ter até doze; o motor não conhece o assunto deles: cada ID, coluna, filtro e palavra vem do arquivo.

### O cabeçalho

O cabeçalho fica em `catalogs`, no nível superior do arquivo, ao lado de `gm`.

```json
"catalogs": [
  {
    "id": "knacks",
    "label": "Knacks",
    "feeds": ["knacks", "tricks"],
    "filters": [
      { "id": "grit", "label": "Grit cost", "type": "number" },
      { "id": "road", "label": "Road", "type": "text" },
      { "id": "callings", "label": "Calling", "type": "tags", "startFrom": { "field": "calling" } }
    ],
    "units": { "distance": { "label": "paces", "perCell": 2 } },
    "entries": []
  }
]
```

- `id` e `label`: o ID segue as regras de IDs da ficha; o rótulo dá nome ao seletor.
- `holds`: `"rows"` (padrão, usado por todos os catálogos anteriores a esta versão) ou `"creatures"`. Um catálogo de criaturas é um bestiário lido pela luta: não escreve em fichas, não declara `feeds` e nunca aparece no seletor. Veja [Criaturas](#creatures-a-bestiary-a-fight-reads).
- `feeds`: de uma a oito listas da ficha onde as entradas podem escrever. Obrigatório para linhas e recusado para criaturas. Uma entrada não pode escrever em outra lista nem colocar um valor que suas colunas não aceitam.
- `filters`: opcional, até oito. Define como filtrar o seletor: `number`, um valor `text` ou `tags` (várias palavras). `startFrom` nomeia um campo usado ao abrir: um personagem cujo Calling é Tinker vê primeiro entradas Tinker.
- `units`: opcional. Define o significado de alcance ou tamanho de área no bloco `mechanics` de uma entrada.

### Uma entrada

```json
{
  "id": "road-sense",
  "label": "Road Sense",
  "summary": "You read a road the way other people read a face.",
  "filters": { "grit": 0, "road": "Ash Flats", "callings": ["Scout", "Courier"] },
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Road Sense", "notes": "Sneak to notice where a road turns bad." }
    }
  ]
}
```

- `id`: letras minúsculas, dígitos e hífens simples, único no catálogo.
- `label` e `summary`: o que o seletor mostra. O resumo é opcional, numa linha e com até 300 caracteres.
- `filters`: valores dos filtros declarados no cabeçalho. `number` recebe um número; `text`, uma string; `tags`, uma lista de strings.
- `rows`: o que a escolha escreve, de uma a seis linhas. `list` pertence a `feeds`; as chaves de `values` são os IDs de colunas dessa lista.
- `creature`: um oponente em vez de linhas, num catálogo cujo `holds` indica criaturas. Cada entrada tem exatamente um entre `rows` e `creature`. Uma criatura não contém `mechanics`: informa seus efeitos nas próprias ações.

Cada valor é verificado contra as colunas de destino. Nome incorreto ou número fora da faixa é informado com sua entrada de origem. Entradas incluídas no arquivo de regras são verificadas ao carregá-lo, o que significa durante a importação de um arquivo importado. Um catálogo separado de pacote é verificado na primeira solicitação do seletor; se tiver erro, mostra os motivos em vez das entradas.

### Uma entrada, várias listas

Uma característica com usos limitados ocupa duas linhas: a característica e seu contador. Continua sendo uma única escolha.

```json
{
  "id": "last-ember",
  "label": "Last Ember",
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Last Ember", "notes": "Spend 1 Grit to give a downed friend 3 Grit back." }
    },
    { "list": "tricks", "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" } }
  ]
}
```

### Valores mantidos atualizados pelo conjunto

Os números de uma linha pertencem ao jogador depois da escolha. Há uma exceção útil: máximos que acompanham o personagem, como usos iguais a um atributo ou um recurso de classe que cresce com o nível. Uma linha pode nomear até quatro colunas numéricas próprias num mapa `scaled`; o editor mantém essas células atualizadas.

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- A chave é uma das colunas `number` da lista.
- `from` é uma referência de valor comum, com o mesmo vocabulário fechado usado no restante. Para algo mais complexo, declare um valor `derived` e aponte `from` para ele (`"from": { "derived": "lay_on_hands_max" }`). Nenhuma aritmética nova é adicionada aqui.
- `table` é opcional. Consulta a referência numa tabela por patamares, como quando um nível define um número: `"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`.
- `values` ainda precisa conter um número comum para a coluna; omiti-lo é recusado. Esse é o valor antes de conhecer a ficha e o que uma ficha sem a referência mantém.
- Uma linha com `scaled` deve ser a única da entrada para aquela lista; assim, uma linha marcada sempre corresponde a uma única especificação.

O valor é calculado ao editar, nunca ao ler: uma linha salva sempre contém o número que declara. Ele é ajustado à coluna: limitado entre `min` e `max` e arredondado para baixo quando a coluna usa inteiros. No exemplo, Heart 3 dá três usos; Heart 0 ou menos não dá nenhum. A linha permanece com 0 usos; como um contador com máximo 0 não é uma reserva, não há nada para gastar em jogo.

Colunas escaladas exigem Capability API 1.23 para conjuntos empacotados. Um conjunto comunitário importado é validado pelo motor que o lê, sem precisar de mais nada.

### Linhas escolhidas são cópias

Cada linha escolhida é copiada para a ficha com uma chave extra, `_catalog`, contendo `<catalog id>/<entry id>`. IDs de colunas começam com letra, então essa chave nunca pode ser uma das suas.

A cópia pertence ao personagem. O jogador pode editá-la, a ficha continua funcionando sem o conjunto instalado e publicar uma versão nova nunca reescreve personagens. A marca permite ao seletor mostrar o que a ficha já tem e à atualização descrita abaixo reconhecer a origem.

### Atualizar a partir do conjunto

Graças à marca, o editor pode avisar quando seu texto novo difere da linha. Uma mensagem curta sob a lista informa quantas linhas têm texto novo; **Review** (Revisar) mostra o conteúdo da ficha ao lado do conjunto, com uma caixa por linha. Nada é escrito antes de **Update selected** (Atualizar selecionadas); só as colunas diferentes das linhas marcadas mudam. Todo o restante é preservado, inclusive a marca.

A comparação é deliberadamente restrita:

- Valores existentes só são comparados em colunas `text`, `longtext`, `dice` e `enum`. Valores `number` e `boolean` pertencem ao jogador e são preservados, inclusive 0 e false. Uma coluna ainda ausente pode ser oferecida com seu valor tipado, incluindo números e interruptores. Uma coluna escalada é excluída porque já acompanha a ficha.
- Só as colunas definidas pela entrada são comparadas. Uma coluna omitida nunca é tocada, qualquer que seja seu conteúdo.
- Um valor recusado pela própria coluna, como um `enum` retirado ou texto acima de `maxLength`, é ignorado em vez de escrito.
- A linha corresponde à de origem pela posição entre as linhas com a mesma marca naquela lista, enquanto a ficha mantiver tantas linhas quanto a entrada escreve. Caso contrário, só funciona se a entrada escrever uma única linha nessa lista. Se o jogador excluir uma de duas linhas, a entrada fica intacta em vez de ser adivinhada.
- Uma linha cuja entrada não existe mais no catálogo fica intacta, silenciosamente.

Assim, reformular ou renomear pode chegar aos personagens que já escolheram a entrada, se aceitarem. Mudar o significado de um número não pode e não vai: essa coluna pertence ao jogador desde que a linha é dele.

### `mechanics`: o que uma entrada faz em números

Uma entrada pode conter um bloco `mechanics` opcional para expressar efeitos numéricos: `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (dados como `2d6` ou número fixo), `damageType`, `attackRoll`, `autoHit`, `save` (uma salvaguarda da ficha e o efeito do sucesso), `applies` (condições aplicadas), `temporary` (pontos temporários de saúde), `scales` (quantidade que cresce com a ficha), `cost` (reserva gasta), `perCostStep`, `budget` (parte da economia de ações gasta), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` e `check`.

O seletor mostra o bloco numa linha. Quem lê o restante depende do bloco escolhido pelo conjunto:

- Com [`combat`](#combat-a-fight-your-own-rules-resolve), a luta lê seus efeitos de combate. `range`, `area` e `friendlyFire` valem em campos com posições; `reaction` marca uma entrada que responde a algo e, até poder nomear seu gatilho, ela não aparece em nenhum menu. `check` afeta testes de perícia, como explicado acima.
- Só com [`battle`](#battles-lending-the-sheet-to-marinaras-combat), a batalha lê `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` e `cost`, pois são as partes que o combate próprio do Marinara consegue aplicar.

O vocabulário é fechado: uma chave ou valor fora da lista é recusado em vez de ignorado.

`cost` também é o preço pago pelo comando `use` do GM fora da batalha, descrito a seguir.

### O comando `use`: deixar o Game Master pagar um preço que você escreveu

Enquanto narra, o GM atualiza fichas com comandos `[sheet: ...]`: `spend`, `restore` (`heal` tem o mesmo sentido), `damage`, `temp`, `track`, `condition`, `note` e `rest`. Um conjunto com catálogos recebe mais um:

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` equivale a `op="use"` e `spell=` a `name=`; assim, a expressão escolhida pelo GM funciona sem o formato precisar conhecer a palavra "spell".

O nome é comparado sem distinguir maiúsculas às linhas do personagem vindas dos seus catálogos. Uma linha responde ao nome mostrado ao GM (coluna de nome de `sheetSummary`, depois `pools.nameColumn`, depois a primeira coluna de texto) e ao `label` da entrada de origem. Renomear uma linha não faz perder seu acesso. Nomes sem correspondência ou compartilhados por duas entradas diferentes são recusados.

O que é gasto:

- Cada termo de `mechanics.cost`. Um termo que nomeia uma reserva viva paga dela; um que nomeia um GRUPO paga da primeira reserva do grupo capaz de cobrir o custo, na ordem de declaração. Não há subida automática para uma reserva superior, porque um grupo nem sempre é uma escala.
- Mais um de cada reserva de linha escrita pela mesma entrada, como o contador de usos de uma característica: a segunda linha de `Last Ember`. Um contador com máximo 0 não tem usos; o comando é recusado em vez de executado de graça.

`pool=` é o lançamento em nível superior: o mesmo preço único, pago de outra reserva do grupo. Só é aceito se o custo tiver um único termo e a reserva nomeada compartilhar seu grupo. Qualquer outra situação é recusada sem reinterpretar.

É tudo ou nada. Se qualquer parte não puder ser paga, o comando inteiro é recusado, nada muda e o jogador é avisado. Uma entrada sem custo, como um truque ou característica passiva, é aceita sem mudar nada.

### Dentro do arquivo ou num arquivo próprio

Um catálogo pequeno fica dentro de `ruleset.json`, em `entries` do cabeçalho. Um longo fica num arquivo próprio, nomeado por `asset` no cabeçalho. Cada catálogo tem exatamente uma dessas opções.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

O caminho sempre é `catalogs/<the catalog's id>.json`. O arquivo tem este formato:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Arquivos separados são para pacotes publicados pelo catálogo oficial: o pacote os lista em `contributions.assets.paths` junto a `ruleset.json` e precisa de Capability API 1.21. Um catálogo de criaturas, incluído ou separado, precisa de Capability API 1.27. **Um conjunto importado como arquivo único ou compartilhado pelo GitHub contém os catálogos dentro do arquivo**, então precisam caber no limite total de 256 KB. Isso comporta algumas centenas de entradas curtas.

Os limites são doze catálogos por conjunto, 2000 entradas por catálogo em ambos os formatos e 1 MB por arquivo de catálogo.

<a id="battles-lending-the-sheet-to-marinaras-combat"></a>

## Batalhas: emprestar a ficha ao combate do Marinara

Por padrão, uma batalha não conhece a ficha. Constrói os combatentes como sempre, e um personagem pode sair da luta sem mudar os pontos de vida na ficha.

O bloco opcional `battle` muda isso numa única direção: empresta os números à luta e grava seu resultado de volta. **Ele não faz o combate seguir suas regras.** A matemática, quem acerta e quanto dano causa continuam sendo do Marinara. Por isso a saúde é transferida como proporção do máximo, não como seu número: meia saúde na ficha começa com meia barra daquela criada pelo Marinara. Sua reserva de 9 pontos nunca entra diretamente numa luta em que um golpe causa 12.

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health`: obrigatório. Reserva viva que representa pontos de vida na luta. Precisa pertencer a `sheet.live.pools`, não ser uma lista cujas linhas são reservas.
- `energy`: opcional. Reserva que a luta pode gastar e que vira a barra MP. Precisa ser diferente de `health`, pois a luta não pode gastar saúde como energia.
- `slots`: opcional. Reservas gastas uma unidade por vez, cada uma com `level` de 1 a 9: `[{ "pool": "slots_1", "level": 1 }]`. Cada nível e reserva são usados uma única vez.
- `skills`: opcional, até oito. Listas cujas linhas viram habilidades de combate. Só contam linhas dos seus catálogos cuja entrada tenha `mechanics`: uma linha digitada à mão não expressa efeitos numéricos. `onlyWhen` nomeia uma coluna booleana que deve estar ativa, como uma magia preparada. `alwaysWhen` nomeia uma coluna e um valor que permitem entrar mesmo assim, como magias sem preparação. É a exceção a `onlyWhen` e é recusada sem ele.

### O que entra e o que volta

**Na entrada**, para cada membro cuja ficha a partida possui: a proporção de saúde determina o início na barra do Marinara; energia vira MP; cada reserva de espaços vira espaços daquele nível; linhas marcadas viram habilidades. Saúde máxima, ataque, defesa, velocidade e nível continuam sendo números do Marinara. Saúde zero faz começar caído; acima de zero, o personagem nunca começa com menos de um ponto, para que uma proporção pequena não o derrube por arredondamento.

**Na saída**, depois de terminar a luta: a proporção final da barra é convertida para a escala da reserva, e a diferença desde o início é aplicada como dano ou cura. Energia e espaços são quantidades, não proporções, e voltam como estão. Tudo segue as regras dos botões da ficha; uma mudança recusada é ignorada e informada, não forçada. Uma luta que não mudou a saúde não escreve mudança nenhuma, para que as duas conversões não alterem a ficha sozinhas.

**Em nenhuma direção**: rolagens de ataque, salvaguardas, concentração e efeitos de um custo maior. Isso fica em `mechanics` para um sistema completo de combate ler um dia; esta ponte não aplica esses efeitos e o conjunto não deve afirmar que aplica.

Uma batalha abandonada não grava nada de volta. Se você excluir a mensagem que a iniciou ou ela nunca terminar, a ficha continua igual: a luta não aconteceu.

### Como uma entrada vira habilidade

O bloco `mechanics` é lido assim:

- `kind` vira o tipo da habilidade. Entradas `utility` e as marcadas `reaction` são omitidas, pois o combate do Marinara não tem onde aplicá-las.
- `amount` define a força como multiplicador do ataque do combatente, não como número de dano. Dados maiores nunca acertam mais fraco; o multiplicador fica na faixa das habilidades geradas.
- `range` e `area.size` são divididos por `units.distance.perCell` do catálogo para obter casas, nunca arredondando para zero. Uma explosão usa o raio, um cone a metade e uma linha uma casa. Áreas atingem todos os inimigos cobertos e respeitam `friendlyFire`.
- `damageType` vira o elemento. `targets` não é transferido: Marinara decide os alvos de curas, melhorias e ataques pelo tipo da habilidade.
- Um `cost` de energia vira custo MP; vários são somados. Um `cost` de exatamente um espaço gasta um daquele nível. Marinara cobra uma quantidade de energia ou um espaço, nunca ambos: omite entradas com dois espaços, espaços de dois níveis ou espaço mais energia. Também omite custos em outras reservas, como saúde ou recurso de classe, para não concedê-los de graça.
- `buff` e `debuff` viram os efeitos próprios do Marinara. Outras promessas do texto, como remover uma condição da ficha, não são aplicadas. Omita `mechanics` se o efeito só fizer sentido fora da batalha.

`coverage.combat` continua separado e mantém seu significado: ative apenas quando as batalhas realmente seguem as regras do seu sistema.

<a id="combat-a-fight-your-own-rules-resolve"></a>

## Combate: uma luta resolvida pelas suas próprias regras

O bloco `battle` empresta os números da ficha à luta mantendo a aritmética do Marinara. O bloco opcional `combat` define como suas regras RESOLVEM a luta. Parametriza um tipo de combate do motor, assim como `resolution` parametriza testes; todos os nomes são seus. Hoje existe um tipo.

**Uma partida cujo conjunto declara `combat` luta conforme esse bloco.** Os números do grupo vêm das fichas, os oponentes do bestiário ou da escala de ameaça, e cada turno é resolvido pelos seus dados. Tudo que um personagem gasta ou perde é gravado na ficha imediatamente: fechar a aba no meio não perde nada. A tela usa seus termos: ataques e habilidades no menu, orçamentos, condições e registro com os cálculos reais. As limitações estão na seção sobre o que ainda falta.

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "grit" },
  "defense": { "derived": "guard" },
  "initiative": { "dice": { "count": 2, "sides": 6 }, "modifier": { "abilityMod": "wits" } },
  "attackRoll": { "dice": { "count": 2, "sides": 6 } },
  "economy": { "budgets": [{ "id": "act", "label": "Action", "per": "turn", "count": 1 }] },
  "attacks": [
    {
      "list": "gear",
      "budget": "act",
      "name": "name",
      "toHit": { "ability": { "column": "swing" } },
      "damage": { "dice": { "column": "damage" }, "ability": { "column": "swing" }, "type": { "column": "harm" } }
    }
  ],
  "abilities": [{ "list": "knacks", "budget": "act" }],
  "standard": ["dodge", "help"],
  "conditions": [
    { "condition": "shaken", "effects": ["own-attacks-disadvantage", "ends-on-damage"] },
    { "condition": "pinned", "effects": ["cannot-act", "speed-zero"] }
  ]
}
```

Esse é o bloco inteiro de Ember Roads, e suas partidas o usam para lutar. O rascunho 5e usa as mesmas chaves para d20:

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "hp" },
  "defense": { "field": "ac" },
  "initiative": { "dice": { "count": 1, "sides": 20 }, "modifier": { "derived": "initiative" } },
  "attackRoll": {
    "dice": { "count": 1, "sides": 20 },
    "advantage": true,
    "naturals": { "max": "critical", "min": "miss" },
    "critical": "double-dice"
  },
  "economy": {
    "budgets": [
      { "id": "action", "label": "Action", "per": "turn", "count": 1 },
      { "id": "bonus", "label": "Bonus action", "per": "turn", "count": 1 },
      { "id": "reaction", "label": "Reaction", "per": "turn", "count": 1 }
    ],
    "movement": { "field": "speed" }
  },
  "abilities": [
    {
      "list": "spells",
      "onlyWhen": "prepared",
      "alwaysWhen": { "column": "level", "equals": 0 },
      "budget": "action",
      "toHit": { "derived": "spell_attack" },
      "saveDifficulty": { "derived": "spell_save_dc" }
    }
  ],
  "concentration": { "text": "concentration", "save": "con_save", "floor": 10, "fromDamage": 0.5 }
}
```

### Todas as chaves

- `kind`: `"attack-vs-defense"`. Um lado rola dados contra a defesa do outro; acertar causa dano.
- `health`: obrigatório. O que a luta retira: `{ "pool": "grit" }`, uma reserva que diminui e cujo buffer temporário absorve o dano primeiro, se existir; ou `{ "track": "harm" }`, uma trilha de ferimentos que recebe MARCAS. A trilha exige `damageKinds` e não concede pontos temporários.
- `defense`: obrigatório, referência de valor. Um campo digitado pelo jogador ou um valor derivado calculado.
- `initiative`: obrigatório. Dados rolados uma vez no início e referência opcional de modificador. Empates favorecem o maior modificador e depois a ordem de preparação da luta.
- `attackRoll`: obrigatório. Define dados, se rola duas vezes e mantém uma (`advantage`), efeitos das faces extremas de um dado (`naturals.max`: `critical`, `hit` ou `none`; `naturals.min`: `miss` ou `none`) e efeito do crítico (`critical`: `double-dice` rola novamente os dados de dano; `max-dice` adiciona uma vez suas faces máximas; `none` é um acerto comum). Faces especiais exigem um único dado, como nos testes. Salvaguardas durante a luta usam esses mesmos dados.
- `economy`: obrigatório. `budgets` define o que cabe num turno: ID, rótulo, `per` (`turn` recarrega no início do turno do portador; `round`, no início da rodada) e `count`. O PRIMEIRO orçamento é o principal, gasto por ações padrão. `movement` é uma referência opcional de distância percorrida por turno, na sua unidade. Lutas em tabuleiro a leem; veja Posições.
- `attacks`: opcional. Listas da ficha cujas linhas são armas. `name` é a coluna de nome; `damage.dice`, a de dados; `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` e `damage.type` nomeiam colunas da mesma lista. Uma coluna `ability` é um `enum` com um ID de atributo; outros valores não acrescentam nada. `proficiency` é `boolean`: ativar adiciona o bônus de proficiência. Sem dados legíveis, a linha não é um ataque; uma corda continua sendo corda.

  `strikes` referencia quantos ataques UM gasto do orçamento compra. Escolher uma linha sem ataques disponíveis gasta o orçamento e deixa os restantes disponíveis. Enquanto houver algum, todas as linhas que declaram `strikes` são gratuitas: trocar de arma, alvo ou andar entre ataques decorre do próprio menu. `strikesCappedBy` nomeia uma coluna booleana que limita SUA linha a um único ataque, independentemente de quantos a lista compra: serve para armas que disparam uma vez por turno, como a propriedade Loading do SRD 5.1. Não faz sentido, e é recusado, numa lista que já compra um ataque por gasto. Os ataques disponíveis pertencem ao COMBATENTE, não a uma lista: duas listas com `strikes` compartilham a mesma quantidade, qualquer que seja a linha usada. São removidos ao terminar o turno que os comprou. Sem declaração, cada gasto compra um ataque, como antes.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`: opcional. Listas cujas linhas marcadas por catálogo são habilidades, filtradas como `battle.skills` com `onlyWhen` e `alwaysWhen`. Os efeitos são o `mechanics` da entrada; o bloco define o `budget` padrão, o `toHit` adicionado quando rola para acertar e a `saveDifficulty` das salvaguardas. Uma entrada que pede salvaguarda, própria ou para terminar uma condição aplicada, é recusada se a lista não tiver `saveDifficulty`: uma salvaguarda contra nada sempre passaria.
- `standard`: opcional, lista fechada `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. `dodge` (ataques recebidos rolam duas vezes e mantêm o pior) e `help` (próximo ataque do aliado rola duas vezes e mantém o melhor) sempre são resolvidos. `dash` (outra cota completa de movimento) e `disengage` (ninguém ataca por você se afastar neste turno) são resolvidos no tabuleiro e apenas registrados fora dele. `hide` e `ready` são aceitos, mas ainda não fazem nada.
- `standardEffects`: opcional, efeitos de uma ação padrão ausentes de seu indicador. Hoje só `dodge` tem isso: `{ "dodge": { "saves": ["dex_save"] } }` informa quais salvaguardas rolam duas vezes e mantêm a melhor enquanto durar. Nomeie só salvaguardas declaradas e apenas se `standard` incluir `dodge`. Sem isso, esquivar continua dificultando acertos e nada mais.
- `conditions`: opcional. Mapeia SEUS IDs de condições para seus efeitos, unindo ficha e luta num registro: um personagem envenenado continua assim depois. Lista fechada: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` e `cannot-approach-source`. `failsSaves` nomeia salvaguardas que falham sem rolar. Os seis efeitos que precisam de distância ou movimento (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) só atuam no tabuleiro; veja Posições. `cannot-react` exclui o portador das janelas abertas por movimento, então ele nunca é consultado. Há mais três chaves:
  - `saves`: salvaguardas afetadas pelos dois efeitos de salvaguarda. Sem ela, todas; declará-la sem um desses efeitos é recusado.
  - `whileSourceInSight`: o que só vale enquanto quem aplicou a condição estiver visível para o portador. `true` condiciona a condição inteira; uma lista de efeitos condiciona só esses e mantém os demais, como medo que impede aproximação mesmo sem ver a origem. Efeitos ausentes da condição são recusados. Sem tabuleiro, não há linha de visão para romper, então tudo vale igualmente.
  - `endsWhenSourceDown`: a condição termina quando quem a aplicou cai.

  `own-saves-advantage` e seu oposto rolam duas vezes e mantêm uma, como ataques; eles se anulam. `resist-all` reduz todo dano pela metade além das defesas próprias do alvo e se anula com uma vulnerabilidade da mesma forma. `cannot-target-source` impede mirar qualquer coisa em quem aplicou a condição. `cannot-approach-source` impede chegar mais perto que a casa atual, incluindo o caminho: contornar até uma casa igualmente distante é permitido, mas passar perto e sair do outro lado não.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

- `concentration`: opcional. Campo vivo `text` que registra o efeito mantido, `save` exigida pelo dano, `floor` mínimo da dificuldade e `fromDamage`, proporção do dano que a define quando maior. Iniciar outra habilidade de concentração termina a primeira; falhar a salvaguarda a encerra e remove as condições mantidas por ela.
- `dying`: opcional, `kind: "saves"`. Duas trilhas que contam as rolagens (a quantidade necessária é o máximo de cada uma), `dice`, `succeedAt`, efeitos das faces extremas (`naturals.max`: `revive-1` ou `success`; `naturals.min`: `one-failure` ou `two-failures`), custo de dano enquanto caído (`damageWhileDown`, `criticalWhileDown`) e `condition` do personagem caído. Sem o bloco, saúde zero só o deixa caído e cura o traz de volta.
- `damageTypes`: opcional. Tipos do sistema, comparados sem distinguir maiúsculas.
- `damageKinds`: obrigatório se `health` nomeia uma trilha de ferimentos e recusado para uma reserva, pois só uma marca mantém um tipo. Define quais `kinds` o golpe marca e quantas casas. `default` recebe o que não foi mapeado, inclusive dano sem tipo; `byType` mapeia `damageTypes` para tipos de marca, ignorando maiúsculas: `"Fire"` e `"fire"` são uma chave e declarar ambas é recusado. `marks` não tem padrão porque as respostas são opostas: `"per-point"` conta níveis de saúde pelo dano, então três de dano marcam três casas e reduzi-lo ajuda; `"per-blow"` marca uma casa se o golpe acerta, qualquer que seja a força. Um golpe com várias cláusulas ainda marca uma casa, usando o tipo mais grave que entrou. Informe qual seu sistema usa: `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `threat`: opcional e necessário para bestiários. `tiers` é a escala de oponentes: ID, rótulo, faixa `health`, `defense`, `toHit`, faixa `damagePerRound` e `saveDifficulty`. Toda criatura nomeia um patamar; um oponente não escrito é ajustado ao que o GM pediu, sem sair da escala. `damagePerRound` expressa o que causa a UM alvo por rodada, incluindo toda a sequência.

### O que um combate lê de `mechanics`

`kind` determina se `amount` é dano ou cura; qualquer entrada marcada como `reaction` fica fora do menu, assim como uma entrada `utility`, a menos que ela mude o que o próprio turno pode conter (veja abaixo). `attackRoll` faz uma rolagem contra a defesa do alvo com o `toHit` da lista; `autoHit` pula isso inteiramente. `save` rola a salvaguarda do próprio alvo contra a `saveDifficulty` da lista, e `onSuccess` determina se um sucesso recebe metade ou nada. `targetCount` indica quantos alvos ela pode atingir. Uma habilidade que não rola ataque (uma área contra a qual todos fazem salvaguardas, algo que simplesmente acerta) rola seus dados UMA VEZ para todos eles; uma que rola para acertar cada alvo rola seus dados novamente a cada acerto. `applies` impõe condições ao que afeta, cada uma com uma `duration` de `instant` (sem relógio próprio: permanece até que algo a remova), `until-save` (que precisa de `saveEnds` ao lado) ou `{ "rounds": n }`, e um `saveEnds` opcional que nomeia a salvaguarda e indica se ela se repete em `turn-end` ou `turn-start`. `temporary` concede pontos temporários à reserva de saúde, e eles nunca se acumulam: permanece a maior proteção. `scales` aumenta a quantidade pelos DADOS extras que sua tabela indica para o valor lido. `cost` é pago pelo comando `use` da própria ficha, e `budget` substitui qual parte da economia é gasta.

`plus` contém até três quantidades A MAIS no mesmo golpe, ao lado de `amount`, cada uma com sua própria rolagem e tipo ("and 2d6 fire"). Uma cláusula é `{ "dice": "2d6", "flat": 1, "type": "fire" }` e pode carregar sua própria `save`, `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`, que o ALVO rola independentemente do que a ação já lhe pediu: `none` elimina toda essa cláusula em um sucesso e `half` deixa metade, enquanto o restante do golpe permanece intacto nos dois casos. Sem `difficulty`, ela recorre ao número usado pela salvaguarda da própria ação e, depois, à `saveDifficulty` da lista. Um crítico dobra os dados de cada cláusula pela mesma regra que dobra os da primeira quantidade; uma cláusula sem `type` usa o tipo de dano do próprio golpe, e o golpe inteiro continua sendo UM teste de concentração, com o dano somado, e um teste para cair. Uma cláusula precisa de um `amount` para acompanhar, e um `heal` não carrega nenhuma.

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

Três chaves dizem o que uma entrada faz com a economia do próprio turno, e uma entrada `utility` que declara qualquer uma delas é oferecida em vez de descartada:

- `free`: não custa orçamento algum. Ainda paga o `cost` que indicar e não pode também indicar um `budget`.
- `gives`: `[{ "budget": "action", "count": 1 }]`, até quatro. Usá-la adiciona a esses orçamentos imediatamente, com limite igual ao que um turno comporta mais a concessão, para que nada possa ser guardado para um turno posterior.
- `standard`: `{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`. Seu portador pode executar essas ações padrão com ESSE orçamento. Elas são oferecidas ao lado das comuns como `standard:<id>@<budget>`, e a própria entrada fica fora do menu quando é apenas essa permissão, pois uma permissão não é algo que alguém execute.

Uma entrada do novo `kind: "rider"` é PASSIVA: ninguém a executa, ela nunca aparece no menu e adiciona automaticamente mais uma cláusula de dano ao primeiro acerto qualificado de um período. Ela carrega `rider` e nada mais que possa ser executado:

```json
{
  "kind": "rider",
  "rider": {
    "on": "hit",
    "sources": ["attacks"],
    "requires": { "column": "finesse" },
    "when": ["advantage", "ally-adjacent"],
    "oncePer": "turn",
    "amount": { "dice": "1d6" }
  },
  "scales": {
    "from": { "field": "level" },
    "table": [
      [1, 0],
      [3, 1]
    ]
  }
}
```

`sources` nomeia as listas de ataques de onde ela vem e `requires` uma coluna verdadeira de suas linhas, de modo que um efeito adicional que só dispara com certas armas pode especificá-las sem que o Engine saiba o que é uma arma; não nomear nenhum significa qualquer acerto de seu portador. `when` aceita QUALQUER das opções: `advantage` é a inclinação final da rolagem de ataque, e `ally-adjacent` é um aliado do atacante que esteja de pé e possa agir, a uma célula do alvo em um tabuleiro ou em qualquer lugar sem tabuleiro. `oncePer` é `turn` (renovado no começo de todos os turnos, de modo que um golpe desferido enquanto outra pessoa age ainda pode carregar um) ou `round`. `amount` cresce com o `scales` da própria entrada, e `type` é o tipo de dano, por padrão o do próprio golpe.

<a id="creatures-a-bestiary-a-fight-reads"></a>

### Criaturas: um bestiário que o combate lê

Um catálogo que declara `"holds": "creatures"` contém oponentes em vez de linhas de ficha. Ele não alimenta nenhuma lista, o seletor do editor de fichas nunca o oferece e todos os seus números usam as chaves que seu bloco `combat` já declara. Ele precisa de um bloco `combat` e de uma escala `threat`, pois uma criatura é classificada em um dos seus próprios níveis.

```json
{
  "id": "road_trouble",
  "label": "Road trouble",
  "holds": "creatures",
  "filters": [{ "id": "tier", "label": "How bad", "type": "text" }],
  "entries": [
    {
      "id": "rust-jackal",
      "label": "Rust Jackal",
      "summary": "A lean thing that lives on the metal roads.",
      "filters": { "tier": "Pack trouble" },
      "creature": {
        "health": { "dice": "3d6" },
        "defense": 6,
        "initiativeModifier": 1,
        "speed": 16,
        "abilities": { "brawn": 1, "wits": 0, "heart": -1 },
        "tier": "pack",
        "actions": [
          {
            "id": "bite",
            "name": "Bite",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d6", "flat": 1, "type": "cut" },
            "reach": 2
          },
          {
            "id": "worry",
            "name": "Worry",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d4", "type": "cut" },
            "applies": [{ "condition": "shaken", "duration": { "rounds": 2 } }]
          },
          {
            "id": "snap_and_worry",
            "name": "Snap and worry",
            "budget": "act",
            "sequence": [
              { "action": "bite", "times": 1 },
              { "action": "worry", "times": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

Os números abaixo são a maneira direta de escrever uma criatura. Uma escrita nos termos do seu próprio conjunto de regras, como `sheet`, obtém `health`, `defense`, `initiativeModifier`, `speed`, `abilities` e `saves` dessa ficha (veja «Uma criatura escrita nos termos do seu conjunto de regras», abaixo).

- `health`: um número, ou `{ "dice": "3d6", "flat": 2 }`, rolado uma vez quando o combate é criado. Uma previsão lê a média, para que um menu nunca prometa um dado que ninguém rolou.
- `defense`, `initiativeModifier`, `speed`: contra o que um ataque é rolado, o que é somado à iniciativa e quanto ela anda em um turno, na sua própria unidade de distância.
- `abilities` e `saves`: usam como chaves os identificadores de atributos e salvaguardas que sua ficha declara. Uma salvaguarda ausente é lida como zero.
- `resist`, `vulnerable`, `immune`: tipos de dano, comparados sem distinguir maiúsculas, e validados contra `combat.damageTypes` quando você declara algum. `conditionImmunities` nomeia suas próprias condições.
- `tier`: a qual degrau de `combat.threat` ela pertence.
- `traits`: pares curtos de nome e texto mostrados ao Game Master. Nunca são resolvidos; portanto, qualquer coisa com números pertence a uma ação.
- `signaturePoints`: pontos devolvidos no início do próprio turno, gastos em ações `signature`.
- `riders`: até quatro, iguais ao `rider` de uma entrada de catálogo, escritos no bloco. Cada um é `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, com um `type` opcional e um `actions` opcional que nomeia em quais ações do próprio bloco ele dispara. O efeito adicional de um bloco não lê listas de ficha; por isso, `sources` e `requires` são as duas chaves que ele não possui. Uma criatura escrita como ficha recebe os efeitos adicionais de suas listas, exatamente como um personagem.
- `actions`: até doze, cada uma com seu próprio `id`. Uma ação carrega o que um bloco de estatísticas escrito à mão carrega (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), mais quatro coisas exclusivas das criaturas. `reach` indica até onde ela golpeia, `range` até onde é arremessada ou disparada e `area` a forma em que atinge, tudo na sua própria unidade de distância; `range` pode ser um número simples ou `{ "normal": 30, "long": 120 }` quando ainda alcança mais longe com uma penalidade, e `area` é `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (veja Posições):
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. Quando se esgotam, a ação sai do menu.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Ela começa o combate disponível, é gasta ao ser usada e rola no início do próprio turno da criatura: `from` ou mais a recupera. O registro contém os dados nos dois casos.
  - `sequence`: outras ações do mesmo bloco, em ordem, cada uma com seu próprio alvo. **É assim que se escreve uma criatura que golpeia duas vezes em uma ação.** Um orçamento paga a sequência inteira. Uma sequência não carrega nada próprio e nunca pode nomear outra sequência.
  - `signature`: `{ "cost": n }`, comprada com os pontos da própria criatura em vez de um orçamento e apenas enquanto outra pessoa age: o combate a oferece na janela entre um turno e o seguinte (veja Janelas).
- Uma salvaguarda precisa de uma dificuldade na própria ação: `save.difficulty` para uma salvaguarda imposta pela ação, ou `saveDifficulty` para uma condição que termina com uma salvaguarda quando a ação não tem a sua própria. Uma ação de bloco é escrita com números simples mesmo em uma criatura com ficha; portanto, esse número fica na ação. A salvaguarda de uma cláusula pode omitir sua `difficulty` e recorrer ao mesmo número.
- `damage.plus` é a mesma lista de cláusulas que o `plus` de uma entrada de catálogo e é lida exatamente da mesma forma: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` é uma mordida cujo calor tem sua própria quantidade, resistida e dobrada separadamente.

O bestiário do rascunho de 5e contém cinco criaturas escritas à mão em `docs/development/ruleset-5e-2014.example.json`, cobrindo uma sequência, uma recarga, uma salvaguarda com condição, resistências e imunidades, usos limitados, pontos de ações características e uma criatura escrita como ficha.

#### Uma criatura escrita nos termos do seu conjunto de regras

Uma criatura não precisa ser escrita com números simples. Dê a ela uma `sheet`, com exatamente a estrutura de uma ficha de personagem, e o combate a constrói como um membro do grupo: sua saúde, defesa, salvaguardas, iniciativa, velocidade e todos os ataques e habilidades das listas são o que suas próprias fórmulas de ficha determinarem. É assim que um conjunto de regras indica que seus oponentes têm os mesmos atributos, perícias e listas que seus personagens, sejam quais forem. O Toll Warden de Ember Roads:

```json
{
  "id": "toll-warden",
  "label": "Toll Warden",
  "creature": {
    "tier": "pack",
    "traits": [{ "name": "Knows the road", "text": "It will not follow anyone past the last milestone." }],
    "sheet": {
      "abilities": { "brawn": 2, "wits": 1, "heart": 1 },
      "skills": { "sway": "trained" },
      "fields": { "calling": "Hauler", "toughness": 3 },
      "lists": {
        "gear": [{ "name": "Toll hook", "swing": "brawn", "damage": "1d6", "harm": "cut" }],
        "knacks": [{ "name": "Hold the Line", "_catalog": "knacks/hold-the-line" }]
      }
    }
  }
}
```

- **Todas as partes são opcionais**: `abilities`, `skills`, `saves`, `bonuses`, `fields` e `lists`, com os identificadores declarados pela ficha como chaves. Tudo que for omitido usa o padrão da própria ficha, exatamente como em um personagem em branco. O Grit do guardião é 9 porque seu `grit_max` soma 4, a Toughness e o Brawn dele, e sua Guard é 7 por um motivo semelhante.
- **Cada número tem uma única origem.** Uma criatura com ficha não fornece também `health`, `defense`, `initiativeModifier`, `speed`, `abilities` ou `saves`, e o Engine recusa o arquivo se ela fizer isso. Ela pode não ter `actions` próprias, pois suas listas definem o que faz. Uma criatura sem ficha ainda fornece os três primeiros e pelo menos uma ação.
- **Ela é validada como os dados de autoria que é.** Cada identificador deve ser declarado pela ficha; uma perícia ou salvaguarda recebe um dos níveis de proficiência oferecidos para ela; um campo, pontuação, bônus ou coluna contém o que declara aceitar (um inteiro dentro do intervalo, um de seus valores e assim por diante), e uma lista não contém mais linhas do que permite. Não há parte `live`, pois o combate guarda o que a criatura gastou.
- **Uma linha pode vir de um catálogo.** `_catalog: "<catalog>/<entry>"` nomeia a entrada de onde uma linha foi escolhida, como na ficha de um personagem, e é nessa entrada que o combate lê o que a linha custa e faz. O catálogo precisa alimentar essa lista. Quando o catálogo está escrito no próprio arquivo, a entrada deve estar nele; quando tem seu próprio arquivo, uma linha que nomeia uma entrada ausente do arquivo simplesmente não dá nada à criatura. Os catálogos nomeados pelas fichas de um bestiário são carregados para o combate junto com o bestiário.
- **O que a entrada declara ao lado da ficha ainda conta**: `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune` e `conditionImmunities`.
- **Ela paga com suas próprias reservas.** Elas começam cheias, são gastas no que suas listas fornecem, e as formas maiores de pagamento (uma magia com um espaço superior) são oferecidas exatamente como para um membro do grupo, seja o Engine ou o Game Master quem decide por ela. Hold the Line custa Luck ao guardião.
- **Com uma trilha de ferimentos, a saúde é a trilha.** Um golpe marca a própria trilha da criatura segundo seus `damageKinds`, depois da aplicação de `resist`, `vulnerable` e `immune`, de modo que uma criatura imune a um tipo de dano não recebe nenhuma marca dele.
- **Ela continua sendo um oponente.** A zero, fica fora de combate em vez de morrer aos poucos; nunca rola contra a morte; a tela mostra o que sempre mostrou de um oponente e nada da ficha, e nada do que ela gastou é gravado de volta em outro lugar, mesmo quando um personagem compartilha seu nome.
- **Uma ficha cuja saúde total seja zero** fica fora do combate, e o registro inicial explica por quê, em vez de introduzir algo que ninguém pode ferir.
- Uma camada que remova um valor de um dos campos enumerados nunca elimina uma criatura que o use: enquanto a camada estiver ativa, esse campo usa seu padrão para a criatura, exatamente como para um personagem, e a criatura não é recusada por isso.
- Um Game Master também pode inventar uma, que fica limitada ao seu nível (veja Oponentes que ninguém escreveu).
- Um pacote que inclua uma declara Capability API 1.34.

O Toll Sergeant do rascunho de 5e é a mesma coisa em uma ficha d20: sua Armor Class, pontos de vida, salvaguardas e dois golpes por ação vêm de seus próprios campos e de sua lista de ataques.

#### Oponentes que ninguém escreveu

Quando um Game Master inventa um oponente, o Engine ajusta a proposta à sua escala `threat` antes de qualquer rolagem: a saúde fica na faixa do nível; defesa, ataque e dificuldades de salvaguarda ficam no máximo dois acima dos valores do nível; e o dano é reduzido até que a melhor rodada da criatura (sua sequência mais forte ou ação individual mais forte, medida contra um alvo) caiba no `damagePerRound` do nível. Primeiro reduz a quantidade de dados, depois a parte fixa, depois um golpe de uma sequência e só então o tamanho do dado, sem nunca reduzir nada a zero. Nomes ausentes do seu conjunto de regras são descartados: tipos de dano, condições e salvaguardas desconhecidos, e qualquer ação além das seis primeiras. Um nível que você nunca declarou recorre à base da escala. Cada alteração retorna como uma frase simples, para que o registro possa dizer o que foi feito.

Uma invenção também pode ser escrita como `sheet`, da mesma forma que uma criatura de bestiário; é assim que um mago inventado recebe espaços e magias. O Game Master vê os identificadores da ficha e o que cada um pode conter, as listas lidas pelo combate e os nomes que seus catálogos oferecem para elas, para que uma magia seja nomeada em vez de descrita: uma linha que nomeia uma entrada de catálogo, com qualquer combinação de maiúsculas, torna-se essa entrada, e os valores próprios do Game Master (como uma magia estar preparada) são aplicados por cima. A ficha é lida com tolerância, pois foi escrita por um modelo: um nome ausente do seu conjunto de regras é descartado, um valor é ajustado ao seu campo ou coluna e os números escritos ao lado da ficha não são usados.

Uma criatura inventada que não seja um chefe fica limitada ao que seu conjunto de regras lhe abre. Um filtro de catálogo com `startFrom` nomeia o campo de ficha pelo qual suas entradas são organizadas (a lista de magias do pacote 5e por `class`), e uma criatura inventada mantém apenas as entradas cujo filtro corresponde ao seu próprio valor desse campo, comparado como o seletor faz ao abrir. Assim, um Sorcerer nunca tem a lista inteira de magias, e quem não nomeia uma classe não recebe nada de um catálogo organizado por classe. As escolhas que ficaram abertas são preenchidas sem perguntar novamente ao Game Master: para cada lista cujas linhas só contam depois de escolhidas (`onlyWhen` em uma fonte de habilidades de combate), entre as entradas disponíveis que pode pagar com suas próprias reservas, cada reserva recebe um pequeno número de entradas (mais para uma criatura mais competente), assim como aquilo que pode usar à vontade. O que ela recebe depende do temperamento e da competência, os mesmos com que luta: uma criatura protetora ou de apoio busca o que sustenta seu lado; uma imprudente, dano; uma metódica ou paciente, o que detém o inimigo; e quanto mais competente for, maior a chance de carregar uma reação, uma contra-ação ou qualquer outra coisa que altere o turno. A seleção usa a semente do próprio combate, de modo que o mesmo combate sempre é preenchido da mesma maneira. Uma linha nomeada pelo Game Master de uma lista assim conta como escolhida.

Um chefe fica inteiramente a cargo do Game Master, como a exceção que pode ser: nada é retirado e nada é preenchido.

Depois, ambos ficam limitados ao seu nível:

- A saúde entra na faixa do nível pelo único campo do qual ela é lida: o máximo da reserva é esse campo ou uma `sum` com exatamente um campo (o máximo de pontos de vida de 5e, a Toughness de Ember Roads). Uma fórmula de saúde sem um campo único fica como foi escrita, e o registro informa isso. O comprimento de uma trilha de ferimentos é seu e nunca é alterado.
- Depois que a criatura é construída, defesa, ataque e dificuldades de salvaguarda ficam limitados a dois acima dos valores do nível, e o dano é reduzido até que sua melhor rodada caiba no `damagePerRound` do nível, contando o maior pagamento que ela pode fazer. Primeiro é reduzido o que um pagamento maior compra, depois os dados, a parte fixa, um golpe e só então o tamanho do dado.

Seu próprio bestiário nunca é limitado. São dados que você escreveu, portanto o Engine os aceita como estão.

### Posições: um combate no tabuleiro

Um combate acontece no teatro da mente até que seu bloco diga quanto vale uma célula do tabuleiro. Declare `distance` e ele poderá acontecer em uma grade; então movimento, alcance, distâncias, áreas, linha de visão, cobertura e golpes contra quem se afasta passam a ter significado. Cada um é um número que você escreveu; o Engine fornece o tabuleiro e nada mais.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2 },
"opportunity": { "budget": "reaction" }
```

Ember Roads declara uma linha disso e nada mais; esse é o objetivo: o restante não é obrigatório.

```json
"distance": { "label": "paces", "perCell": 2 }
```

**A célula.** `distance.perCell` indica quanto da SUA unidade vale uma célula, e `label` é o nome dessa unidade. Todas as distâncias do mundo do bloco a usam: `economy.movement`, a `speed` de uma criatura, o `reach` e o `range` de uma arma e o `reach` e o `range` de uma ação de criatura. Um catálogo que declara seu próprio `units.distance` converte seus `mechanics.range` e `area.size` com seu próprio `perCell`; um que não declara usa este. Uma distância acima de zero é arredondada para a célula mais próxima, nunca para nenhuma; assim, tudo a que você deu um número alcança pelo menos uma. Zero não é uma distância curta e mantém seu próprio significado: um `mechanics.range` de 0 significa si mesmo ou toque (e tocar outra pessoa alcança a célula vizinha), e uma coluna de arma `reach` ou `range` com valor 0 em uma linha significa que essa linha não tem essa distância.

**Se o combate usa um tabuleiro.** Duas coisas precisam coincidir: seu bloco declara `distance` e a partida do jogador usa o estilo de combate Tactical. Com o estilo Classic, ou um conjunto de regras sem `distance`, o combate continua no teatro da mente: qualquer um pode mirar em qualquer um, e nada abaixo é lido.

**O que o jogador vê.** O tabuleiro é desenhado com o terreno do próprio estilo tático. Cada quadrado é um botão, acessível pelo ponteiro ou pelas teclas de direção, e informa o que é, quem está nele e o que a escolha parcialmente feita significa para ele. Caminhar ilumina os quadrados oferecidos pelo menu, cada um com seu custo NA SUA UNIDADE, desenha o caminho e marca em âmbar qualquer quadrado cujo caminho provocaria um golpe de alguém, nomeando essa pessoa abaixo do tabuleiro. Uma opção que recebe um alvo ilumina quem pode ser escolhido, no tabuleiro e na lista ao mesmo tempo. Uma opção com `area` mira em um quadrado, e o quadrado sob o ponteiro informa quem seria atingido, incluindo aliados. O restante do deslocamento permitido aparece ao lado dos orçamentos, também na sua unidade. A tela não mede nada: cada quadrado, custo, caminho, alvo e ponto de mira é enviado pelo servidor.

**Movimento.** O deslocamento permitido de um turno é `economy.movement` para um membro do grupo, ou a `speed` da própria criatura, dividido por `perCell` e arredondado PARA BAIXO, nunca menos de uma célula enquanto ela puder se mover. Ele é reposto no início do próprio turno de seu portador e pode ser gasto antes, entre e depois das ações: caminhar, golpear, caminhar de novo. Entrar em uma célula custa um, ou mais em terreno difícil. Oito direções, todas com o mesmo custo, pois é assim que se jogam as grades de RPG de mesa a que isso se destina. É possível passar por um aliado, mas não parar sobre ninguém; um oponente é uma parede; não se pode entrar em nada sólido nem cortar um canto entre duas células sólidas.

**Alcance e distância.** Uma linha de arma os obtém de `combat.attacks[].reach` e `.range`, cada um sendo uma coluna da mesma lista ou o mesmo número em todas as linhas:

```json
"attacks": [
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "toHit": { "ability": { "column": "ability" } },
    "damage": { "dice": { "column": "damage" } },
    "reach": { "column": "reach" },
    "range": { "normal": { "column": "range" }, "long": { "column": "long_range" } }
  }
]
```

Uma coluna com valor 0 em uma linha indica que essa linha não possui tal distância; assim, uma espada comum pode estar na mesma lista que um machado de arremesso. Uma linha sem alcance chega a uma célula. Uma ação de criatura usa seu próprio `reach` ou `range`, e uma habilidade de catálogo usa `mechanics.range` (0 significa si mesmo ou toque, equivalente a uma célula quando mira em outra pessoa).

Uma linha com AMBOS é uma arma de arremesso: dentro do alcance, é um golpe; além dele, um disparo. Portanto, as regras abaixo para disparos não a afetam na mão de alguém, e ela serve para golpear quem passa, algo que um arco não faz.

Uma ação de criatura também pode carregar a `area` em que atinge, na sua própria unidade: `{ "shape": "cone",
"size": 15 }`, com `"friendlyFire": false` para poupar seu lado. É assim que uma arma de sopro se torna um cone real no tabuleiro em vez de um número de alvos. Uma sequência não tem forma própria; as ações que nomeia têm as suas. Um combate sem tabuleiro ignora a forma e usa `targetCount`, de modo que uma entrada de criatura pode carregar ambos e ser fiel nos dois casos.

**Até onde uma forma pode ser enviada.** `range` informa isso: uma bola lançada a cem pés possui um. Sem distância, uma explosão ocorre onde é colocada, na célula do próprio ator, e um cone ou linha pode mirar em qualquer lugar dentro do comprimento que desenha, pois ali a célula só indica a direção. Isso vale tanto para o `mechanics.area` de uma entrada de catálogo quanto para a área de uma criatura.

`ranged` indica o custo de um disparo feito além de sua distância comum `normal`, ou com alguém do outro lado na célula vizinha. Cada um é `"disadvantage"` ou `"normal"`; omita o bloco e nenhum custa nada. Um golpe nunca é um disparo, então nenhuma regra o afeta, nem uma arma de arremesso usada dentro do próprio alcance.

**Áreas.** O `mechanics.area` de uma entrada se torna uma forma real no tabuleiro, mirando em uma célula em vez de alguém, e `targetCount` não determina nada: a forma decide quantos alcança. Todos que estiverem nas células são atingidos, amigos e inimigos, a menos que a entrada diga `"friendlyFire": false`.

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

Uma explosão abrange todas as células dentro do seu tamanho ao redor da célula visada. Um cone parte do ator em direção a essa célula, com largura em cada passo igual à distância percorrida. Uma linha segue da mesma forma, com uma célula de largura. Os três param em qualquer coisa sólida.

**Linha de visão e cobertura.** Uma linha reta de células entre os dois: qualquer coisa sólida nela bloqueia um disparo e impede que uma área se espalhe além, e o alvo simplesmente não aparece no menu. O terreno que oferece cobertura adiciona `cover.bonus` à defesa contra a qual o ataque é rolado, e o registro informa isso. Não há cobertura de três quartos, cobertura total nem elevação.

**Golpes contra quem se afasta.** Declare `opportunity.budget` e, quando um combatente caminhar para fora do alcance de um inimigo de pé que possa agir, tenha esse orçamento e tenha algo corpo a corpo com que golpear, a caminhada PARA onde está e esse inimigo é consultado sobre golpear. Aceitar gasta o orçamento e resolve exatamente como o mesmo ataque no próprio turno; deixar passar não custa nada. Nos dois casos, a caminhada continua de onde foi interrompida, pagando cada célula realmente cruzada, e um golpe que derruba quem se move encerra a caminhada onde caiu. Uma oportunidade para cada inimigo na caminhada inteira, independentemente de quantas vezes o caminho saia do mesmo alcance. `disengage` impede isso pelo restante do turno, e um conjunto de regras sem `opportunity` não tem nada disso.

A pergunta é uma JANELA e segura o combate inteiro: nada mais se move até que todos os consultados respondam. O jogador responde à janela de um membro do grupo, com o golpe ou **Pass** (passar) ao lado; as demais são respondidas por quem interpreta o combatente, e um chefe do Game Master pela decisão do próprio Game Master. Veja Janelas abaixo.

**O que um oponente faz com o tabuleiro.** Um oponente que ninguém interpreta avalia cada célula alcançável contra cada opção que poderia executar dali, desconta cada golpe que a caminhada provocaria e prefere não se mover quando já pode fazer o melhor de onde está. Sem nada ao alcance, aproxima-se e primeiro corre se sua lista `standard` tiver `dash`.

**Recusas que você pode ver.** `out-of-reach` (mais longe do que alcança), `no-line-of-sight` (algo sólido no caminho), `unreachable` (uma célula cujo custo a caminhada não pode pagar ou onde não pode terminar) e `bad-cell` (uma forma mirando em um lugar proibido).

### O que o combate faz com seu bloco no servidor

Uma partida cujo conjunto de regras declara `combat` recebe um combate resolvido por ele, na mesma batalha salva que o Engine sempre usou:

- **Quem participa.** O Game Master diz quem está lutando; o Engine lê os números de cada membro do grupo em sua própria ficha. Um membro sem ficha para seu conjunto de regras é recusado pelo nome, em vez de receber números que você não escreveu.
- **De onde vêm os números de um oponente**, nesta ordem: a criatura nomeada pelo Game Master no bestiário; depois uma cujo rótulo corresponda ao nome do oponente; depois um bloco de estatísticas proposto pelo Game Master para esse combate, ajustado à sua escala de ameaça; por último, uma criatura simples construída com os números do próprio degrau. Cada alternativa e cada ajuste são registrados em palavras simples para que o combate possa explicar o que fez. Um conjunto de regras sem entrada de bestiário, proposta ou escala de ameaça recusa o combate em vez de inventar um.
- **Suas fichas são o registro.** Saúde, reservas, condições, concentração e contadores da sua regra de morte são gravados pelas regras da própria ficha após cada ação aceita; assim, recarregar no meio do combate mostra exatamente o que ele deixou, sem uma contagem ao final que possa discordar.
- **Seu menu é a única fonte de legalidade.** Todo aquele que age, jogador ou oponente, escolhe um identificador no mesmo menu produzido pelo seu bloco. Um oponente controlado pelo Engine escolhe nele com as táticas do próprio Engine; um controlado pelo Game Master é instruído a escolher um identificador desse mesmo menu, vendo seus números sem jamais saber o que os dados farão.
- **Seus dados.** Um combate carrega sua própria semente e um cursor; portanto, um combate lido novamente do disco continua com os dados que teria rolado.

### Na tela

O combate acontece na tela de batalha com suas palavras. O menu contém seus ataques, suas habilidades e as ações padrão que você listou, cada uma informando o que gasta dos seus orçamentos e reservas. São mostrados a ordem dos turnos, a rodada, cada condição nomeada com suas rodadas restantes, os pontos temporários, a concentração e os dois contadores da sua regra de morte. O registro imprime a aritmética real nos seus termos: "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Cada ação aceita é gravada na ficha quando acontece; assim, recarregar no meio do combate é exato, e depois o Game Master é instruído a não alterar esses números novamente.

Um combate com posições é desenhado no tabuleiro em vez do palco de retratos; veja Posições para saber o que o jogador faz com ele. Toda distância nele, no menu e no registro, é expressa na SUA unidade: "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Janelas: manter o combate aberto

Alguns momentos pertencem a alguém que não é quem está agindo. O Engine mantém o combate aberto para essa pessoa em vez de decidir por ela, e essa pausa é uma janela.

Quatro coisas abrem uma, e duas vêm do que você já declarou:

- **Alguém se afasta.** Uma caminhada que sai do alcance de um inimigo capaz de golpear para nesse passo e pergunta a ele. Veja Golpes contra quem se afasta, acima.
- **Entre um turno e o próximo.** Quando um turno termina, cada oponente com `signaturePoints` que pode pagar uma de suas próprias ações `signature` é consultado sobre comprá-la, antes do próximo turno começar. Esse é o único momento em que elas são compradas: uma ação característica não aparece no menu de turno de ninguém, nem no próprio.
- **Algo mira em alguém.** Antes de resolver, todos os alvos do OUTRO lado que possuem uma entrada esperando esse momento são consultados. Um amigo curando você não é uma ameaça à qual responder, então a ação de um amigo não abre uma janela.
- **Algo feriu alguém.** Depois de resolver, todos que receberam dano e possuem uma entrada esperando ESSE momento são consultados, independentemente de quem causou. Ser ferido é um fato sobre você; uma entrada direcionada de volta a quem causou isso ainda não pode mirar em um amigo.

As duas últimas são as que uma entrada de catálogo solicita ao nomear o momento que espera.

O que uma janela faz, seja qual for sua origem:

- **Nada mais se move enquanto ela está aberta.** Nem o ator de quem é o turno, nem o fim desse turno, nem outra janela. O combate espera.
- **Ela pergunta a um de cada vez**, na ordem dos turnos, uma vez a cada um. Passar sempre é uma resposta e não custa nada. Quem seria consultado e não tem nenhuma opção que possa executar é pulado em vez de consultado.
- **Ela continua exatamente de onde parou.** Uma caminhada termina pelas células restantes, pagando cada uma que realmente cruzou.
- **Quem responde é quem interpreta.** A janela do seu membro do grupo é sua, com a opção e **Pass** (passar) ao lado no menu; a de um oponente é respondida por quem o interpreta, e um chefe do Game Master é consultado pelo Game Master, com deixar o momento passar entre as respostas.
- **Ela é salva com o combate.** Uma partida fechada no meio de uma caminhada volta com as mesmas pessoas ainda a consultar e as mesmas células ainda a percorrer.

Você não declara nada para as duas primeiras: um conjunto de regras com `opportunity.budget` recebe uma, um bestiário com `signaturePoints` recebe a outra, e um conjunto de regras sem ambos nunca as vê.

**Indicar qual momento uma entrada espera.** Escreva `mechanics.reaction` como um objeto em vez de `true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` é `aimed` ou `harmed`, e é o que coloca a entrada no menu dessa janela. Esses são os únicos dois momentos que o Engine observa. Uma entrada que ainda diz `"reaction": true` apenas informa que não é executada em um turno; isso não basta para oferecê-la em algum lugar, então ela não aparece em nenhum menu.
- `at` é `source` (o padrão) ou `chosen`. `source` direciona o que é executado a quem causou o momento e preenche o alvo, para que ninguém precise escolher; `chosen` mantém os alvos da própria entrada e pergunta.
- `cancels` impede completamente que aconteça o que a janela estava segurando. Só uma entrada `aimed` pode declará-lo: um momento que já aconteceu não pode ser cancelado.

Dê a ela também um `budget`, ou ela gastará o padrão da lista. Uma reação quase sempre gasta um orçamento próprio, o que impede um turno de conter várias.

**Seu custo é gasto antes de consultar qualquer pessoa.** Uma ação cancelada é impedida de acontecer, mas não deixa de ter sido comprada: o orçamento e as reservas já foram gastos. Se seu sistema os reembolsa, ainda não pode expressar isso.

Um pacote que nomeia um momento precisa da Capability API 1.33.

### Ainda não

Dito claramente, pois um conjunto de regras não deve prometer o que o Engine não faz:

- **Além do tabuleiro modesto**: não há cobertura de três quartos ou total, elevação, voo sobre obstáculos, passagem apertada, montarias, movimento por agarrão ou empurrão, ocultação ou surpresa, e nada empurra ninguém para lugar algum.
- **Uma entrada só pode esperar dois momentos**, `aimed` e `harmed` (veja Janelas, acima). São os momentos que o Engine percebe em nome de uma entrada; as outras duas janelas, alguém se afastando e a pausa entre turnos, são abertas pelo próprio combate e não são momentos que uma entrada pode solicitar. Não há momento para uma salvaguarda ser rolada, uma magia ser lançada como tal, uma morte, um turno começar ou algo cair.
- **Sem encadeamento.** O combate mantém uma janela em vez de uma pilha, então nada aberto dentro de uma janela abre outra: uma contra-ação não pode ser anulada por outra, e o que uma reação causa não abre outro momento.
- **Uma reação impede algo ou faz algo; ela não pode mudar um número nele.** Não há como dizer «mais difícil de acertar até seu próximo turno», pois uma condição é um nome em uma lista fechada, não um modificador. Essa é uma limitação das condições, não das reações.
- **Nada é reembolsado.** O custo de uma ação cancelada permanece gasto.
- Condições fazem o que a lista fechada de efeitos pode expressar e nada mais. Hoje, uma condição que imponha desvantagem a TESTES de atributo, ou que piore em níveis como a exaustão, é apenas um registro na ficha.
- **Uma criatura escrita com números simples não tem trilha de ferimentos.** Em um conjunto de regras cuja saúde é uma trilha, essa criatura ainda perde pontos; dê a ela uma `sheet` e os golpes recebidos marcarão caixas, mitigados primeiro pelos próprios `resist`, `vulnerable` e `immune`.
- **Um efeito adicional dispara sozinho.** `on` tem um valor, `hit`, então o primeiro acerto qualificado do período o aplica, sem um momento em que você seja consultado sobre gastá-lo.

## Camadas: variantes do seu próprio conjunto de regras

Uma camada é uma variante nomeada do seu conjunto de regras que o jogador ativa ao criar uma partida: pouca magia, inverno rigoroso, uma dificuldade mais dura. As camadas ficam no arquivo do conjunto de regras, em uma matriz opcional `layers`; assim, viajam com ele e nunca podem faltar em uma partida que as usou. O assistente as mostra como interruptores abaixo do conjunto de regras, e a escolha fica fixa durante toda a vida da partida, exatamente como o próprio conjunto.

```json
"layers": [
  {
    "id": "hard_winter",
    "label": "Hard winter",
    "summary": "Cold, hunger and short days. Everything is harder.",
    "conflicts": ["mud_season"],
    "gm": {
      "guidance": "Hard winter is on. Let a failed check cost warmth, food or daylight as well as progress.",
      "worldGuidance": "Hard winter is on. Build a world of closed roads, thin stores and rationed settlements."
    },
    "fields": [{ "id": "calling", "removeValues": ["Sailor"], "default": "Hauler" }],
    "difficultyLadder": [{ "label": "Easy", "dc": 7 }],
    "catalogs": [{ "id": "knacks", "hide": { "filter": "grit", "above": 0 } }]
  },
  {
    "id": "mud_season",
    "label": "Mud season",
    "summary": "Thaw, flooded roads and slow going."
  }
]
```

**O que uma camada pode fazer.** A lista é fechada, e cada efeito restringe algo ou adiciona texto:

- `gm.guidance` é acrescentado ao fim do seu `gm.checkGuidance`, depois do seu texto e do de qualquer camada anterior. `gm.worldGuidance` é acrescentado a `gm.worldGuidance` da mesma forma.
- `fields` remove valores de um campo **enumerado**. `removeValues` nomeia valores que o campo já possui; pelo menos um deve permanecer e, se o `default` do campo for removido, a camada nomeia outro `default` que permaneça.
- `difficultyLadder` substitui sua escala por outra, na estrutura do seu próprio tipo de resolução: `{label, dc}` para `dice-sum` e `{label, successes, target?}` para `dice-pool`. Ela passa exatamente pelas mesmas verificações da sua escala. Quando várias camadas ativas declaram uma, a última vence.
- `catalogs` oculta entradas do seletor do editor de fichas. Cada regra nomeia um dos `filters` declarados pelo catálogo e exatamente uma comparação: `above` ou `below` para um filtro `number`, `equals` ou `notIn` para um filtro `text` ou `tags`. Uma entrada que não define esse filtro nunca é ocultada.

**O que uma camada não pode fazer.** Ela não pode adicionar um valor enumerado, campo, perícia, reserva ou descanso, mudar o tipo de resolução, tocar no estado atual ou nos números de combate, nem adicionar uma chamada de modelo. Um valor que uma camada _adicionasse_ seria desconhecido de todos os outros leitores da ficha, então valores só podem ser removidos. Tudo além dessa lista é uma alteração no próprio conjunto de regras ou um segundo conjunto.

**Conflitos.** `conflicts` nomeia camadas que não podem ficar ativas juntas. Basta nomear um lado do par. O assistente desativa o outro interruptor e, se uma escolha salva tiver ambos de alguma forma, a camada declarada **depois** é descartada; assim, as mesmas duas escolhas sempre produzem as mesmas regras.

**Uma ficha que já contém um valor removido o mantém.** Nada reescreve um personagem. O editor simplesmente deixa de oferecer o valor, e um personagem que já o tinha o mostra como é. Desative a camada em uma nova partida e o valor será oferecido de novo. O mesmo vale para uma entrada de catálogo oculta: ela sai do seletor, e uma linha que o jogador já escolheu permanece na ficha.

**Limites.** 12 camadas por conjunto de regras e 4000 caracteres de orientações por camada, contando as duas strings juntas. Um conjunto de regras empacotado que declara `layers`, ou um `gm.worldGuidance` de base, precisa da Capability API 1.25. Um conjunto importado é validado pelo Engine que o lê, então não precisa de nada.

**Camadas escritas por outra pessoa** (uma camada de pouca magia para um conjunto de regras que você não escreveu, distribuída no próprio arquivo) virão depois. Hoje, uma camada é distribuída dentro do conjunto de regras ao qual pertence.

<a id="trying-your-ruleset"></a>

## Testar seu conjunto de regras

Conjuntos de regras da comunidade usam o mesmo interruptor dos agentes importados. Abra **Settings** (configurações) > **Advanced** (avançado) > **Danger Zone** (zona de perigo) e confirme que **Allow custom Agent imports** (permitir importações de agentes personalizados) esteja ativado. A importação também precisa de acesso por localhost ou de **Admin Access** (acesso de administrador) configurado.

1. Abra o painel **Agents** (agentes) e escolha o botão **Import agents** (importar agentes), o ícone de download na fileira de botões no topo do painel.
2. Escolha **Game Mode ruleset** (conjunto de regras do modo de jogo) e selecione seu arquivo JSON.
3. Leia a revisão. Ela mostra nome, versão, licença, o que o conjunto de regras cobre e o texto do Game Master. Escolha **Import** (importar).

Seu conjunto aparece na seção **Rules** (regras) do painel e na escolha **Rules** do assistente de configuração para novas partidas. Um conjunto importado de um arquivo é classificado como `local/<your id>`, para que nunca seja confundido com um conjunto oficial ou de outra pessoa.

### Alterar um conjunto de regras já importado

Uma versão importada nunca é reescrita. Se você alterar o arquivo e importá-lo novamente com a mesma `version`, a importação será recusada e pedirá que aumente o número. Isso é intencional: uma partida fica vinculada à versão exata em que foi criada, para que uma campanha em andamento nunca acorde com cálculos diferentes.

Portanto, o ciclo durante a elaboração é: editar, aumentar `version`, importar, iniciar uma nova partida. As versões antigas continuam instaladas ao lado da nova até você remover o conjunto de regras da seção **Rules**. Remover um conjunto ainda usado por uma partida faz com que ela informe que o conjunto está ausente até você importá-lo novamente.

Se mudar a estrutura da ficha (adicionar, remover ou renomear elementos), aumente também `sheet.version`. As fichas existentes são lidas com tolerância: valores que a nova ficha desconhece são mantidos, e os ausentes recebem seus padrões.

## Compartilhar seu conjunto de regras

**Como arquivo.** Envie o arquivo JSON a um amigo. Ele o importa como você fez.

**De um repositório do GitHub.** Se você mantém seu trabalho em um repositório público do GitHub, coloque cada conjunto de regras em uma pasta `rulesets` na raiz do repositório, um arquivo por conjunto:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Um usuário adiciona seu repositório uma vez pela lista de repositórios de agentes personalizados, revisa o conteúdo e pode sincronizar depois para receber novas versões. A lista de repositórios personalizados é um recurso avançado que a pessoa responsável pelo servidor precisa ativar com `ENABLE_CUSTOM_AGENT_REPOS=true`. Conjuntos de regras de um repositório são classificados sob o nome do proprietário, como `alice/ember-roads`, para que dois autores possam publicar um conjunto chamado `v20` sem conflitos.

Dois limites se aplicam. Um repositório pode conter no máximo 32 arquivos JSON diretamente em `rulesets`; se tiver mais, será recusado. Uma conta chamada `local` não pode publicar conjuntos de regras, pois `local/` é reservado aos importados de arquivos.

**No catálogo oficial.** Um sistema muito jogado e com licenciamento claro pode ser oferecido a todos por **Download Agents** (baixar agentes). Isso exige um pull request para o repositório [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Veja o pacote `ruleset-5e-2014` para conferir a estrutura.

## Licenciamento

Publique apenas textos de regras que você tem o direito de compartilhar. Muitos sistemas publicam um documento de referência com licença aberta, e é desse documento que você pode copiar. Coloque o identificador da licença e o texto de atribuição exigido em `license`. Não copie textos de livros de regras sem licença aberta. Um conjunto de regras precisa principalmente de nomes e números, e o texto do Game Master deve ser escrito com suas próprias palavras.

## Solução de problemas

- **A importação diz que um nome não existe.** Algo no arquivo aponta para um identificador não declarado, como uma perícia que nomeia um atributo removido. A mensagem informa o caminho até a linha.
- **A importação diz que uma versão já está instalada com conteúdo diferente.** Aumente `version` e importe novamente.
- **Meu conjunto de regras não aparece no assistente de configuração.** Confira se **Allow custom Agent imports** está ativado. Enquanto estiver desativado, conjuntos importados ficam fora de novas partidas. Partidas que já usam um continuam funcionando.
- **Uma partida diz que seu conjunto de regras está ausente.** A versão exata em que a partida foi criada não está instalada. Importe novamente essa versão do arquivo.

