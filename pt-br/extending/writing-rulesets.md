# Escrever conjuntos de regras de Game Mode

Um conjunto de regras informa ao Game Mode como funciona um sistema de mesa: quais dados um teste rola, o que há na ficha, quais recursos são gastos e o que um descanso recupera. Este guia é para quem quer escrever seu próprio conjunto e compartilhá-lo. Para jogar com um criado por outra pessoa, comece por [Escolher as regras](../game/getting-started.md#choosing-rules).

Um conjunto é um arquivo JSON. São dados, não código. Nada nele é executado, então importá-lo não pode fazer nada no seu computador. Antes de importar um arquivo alheio, leia com atenção o texto do Game Master: ele é enviado ao modelo em toda partida que usa o conjunto.

## Leia primeiro: o que um conjunto pode e não pode fazer

Um conjunto só pode preencher os parâmetros de uma mecânica que o Engine já conhece. Hoje ele conhece cinco formas de resolver um teste; o arquivo escolhe uma com `resolution.kind`:

- **`dice-sum`**: rolar dados, adicionar números da ficha e alcançar ou superar uma dificuldade. Isso cobre sistemas d20, sistemas de 2d6 mais atributo e muitos outros.
- **`dice-pool`**: rolar a quantidade de dados do personagem e contar os que atingem um alvo. Isso cobre sistemas em que uma pontuação representa um punhado de dados, não um bônus.

- **`dice-highest`**: rolar uma reserva e ler o maior dado, ou somar os maiores. Isso cobre Blades in the Dark e Trophy Dark.
- **`roll-against`**: rolar igual ou abaixo (ou acima) do número da ficha. Isso cobre perícias percentuais e testes de GURPS.
- **`symbol-pool`**: montar e aprimorar dados narrativos e depois anular símbolos opostos. Isso cobre os testes de Genesys.

Os cinco são descritos por completo em [Tipos de resolução](#resolution-kinds).

Uma mecânica que não se encaixa nessas formas não pode ser escrita no arquivo. Reservas opostas são um exemplo. Cada uma precisa de um novo tipo de resolução no Engine: uma contribuição de código com testes, não um JSON. Se seu sistema precisa disso, abra uma solicitação de recurso no repositório do Engine e descreva a mecânica com algumas rolagens resolvidas. Esses exemplos viram os testes.

Game Mode pode resolver uma luta com o combate próprio do Marinara ou com as regras do conjunto. O bloco opcional `battle` empresta ao combate do Marinara os números das fichas: veja [Batalhas](#battles-lending-the-sheet-to-marinaras-combat). O bloco opcional `combat` define como o conjunto resolve a luta: veja [Combate](#combat-a-fight-your-own-rules-resolve). O Engine já aplica essas regras. **Combat Preference** (Preferência de combate) escolhe a apresentação Classic ou, quando o conjunto define distância, um campo Tactical.

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

Você pode adicionar uma linha `"$comment": "..."` a qualquer objeto para deixar uma nota. O Engine a ignora.

## As partes do arquivo

| Chave | Conteúdo |
| --- | --- |
| `schemaVersion` | Sempre `1`. |
| `id`, `version` | O nome do conjunto para o Engine e um inteiro que você aumenta a cada mudança publicada. |
| `name` | O que os jogadores veem no assistente. |
| `edition` | Opcional. Uma linha sobre a edição ou o rascunho. |
| `license` | Opcional. Um ID SPDX e a atribuição exigida pela fonte. |
| `coverage` | O que o conjunto cobre e o resumo de uma linha exibido no assistente. |
| `resolution` | Como um teste ou salvaguarda é rolado. |
| `sheet` | Tudo que há na ficha. |
| `rests` | O que cada descanso restaura e limpa. |
| `gm` | O texto fornecido ao modelo do Game Master e os valores de ficha que ele vê por personagem. |
| `catalogs` | Opcional. Entradas prontas oferecidas pelo editor para evitar listas longas digitadas à mão. |
| `items` | Opcional. O vocabulário em que seus itens são escritos: categorias, raridades, estatísticas, espaços, dinheiro. |
| `battle` | Opcional. O que uma batalha lê da ficha e grava de volta depois. |
| `combat` | Opcional. Como suas regras resolvem uma luta e o que a tela de batalha executa. |
| `layers` | Opcional. Variantes do conjunto ativadas na criação de uma partida. |

O arquivo pode ter até 512 KB (256 KB antes da Capability API 1.340). Texto que entra num prompt (nomes, rótulos, texto do Game Master) não pode conter quebras de linha, colchetes nem chaves duplas.

IDs dentro da ficha (atributos, perícias, campos, reservas etc.) usam letras minúsculas, dígitos e sublinhados, começando com uma letra, como `grit_max`.

<a id="resolution-kinds"></a>

### Tipos de resolução

`resolution.kind` escolhe como rolar um teste. Todos os tipos leem a mesma ficha e compartilham três chaves; as partes do arquivo depois de `resolution` não mudam ao alternar:

- `abilityModifier`: como uma pontuação da ficha vira um número. `identity` usa a própria pontuação; `floorHalfMinusTen` é a regra de 5e; `stepTable` permite definir seus limiares como `[[score, number], ...]`.
- `proficiencyTiers`: níveis de treinamento de uma perícia ou salvaguarda. O primeiro vale para uma perícia não listada. Um nível adiciona `flat`, ou `multiplier` vezes um bônus de proficiência, ou ambos. Se o sistema tem esse bônus, indique a origem com `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: opcional, necessário apenas para um nível que multiplica.

O significado do número depende do tipo: `dice-sum` o soma à rolagem; `dice-pool` e `dice-highest` rolam essa quantidade de dados. `symbol-pool` mantém atributo e treinamento separados para montar e aprimorar dados narrativos.

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
- `dice.faces`: quanto vale cada face, da mais baixa para a mais alta, quando as faces não valem o próprio número (Capability API 1.136). Os quatro dados Fudge de Fate são `{ "count": 4, "sides": 3, "faces": [-1, 0, 1] }`: o cartão mostra −, branco e + e os soma, e as chances são exatamente as de Fate. Dê um valor por face.
- `openEnded`: um único dado que continua rolando (1.136). Uma face igual ou superior a `high` é rolada de novo e somada, e de novo enquanto o novo dado mostrar `high` ou mais; uma face igual ou inferior a `low` é rolada de novo e subtraída, e essa rolagem continua em `high` da mesma forma. A rolagem percentual aberta de Rolemaster é `{ "high": 96, "low": 5 }` num d100. Uma rolagem lança no máximo 20 dados. As faces naturais, e o deslocamento das faixas, leem o primeiro dado.
- `unmodified`: faces de um dado único que o registro marca quando o primeiro dado as mostra (1.136), para que tabelas que tratam à parte "um 66 não modificado" possam ser aplicadas: `[66, 100]`. O registro diz `unmodified="66"`, o cartão também, e o Game Master é instruído a aplicar o que as regras dizem sobre isso.
- `difficultyLadder`: dificuldades entre as quais o GM deve escolher. `dc` é o número que o total precisa alcançar. O GM pode nomear um patamar em vez de escrever seu número, como `difficulty="Hard"`, e o Engine lê o número desse patamar.

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
  "pool": { "min": 1, "max": 15, "abilityPlusAbility": true },
  "target": { "default": 7, "min": 5, "max": 9 },
  "explode": { "from": 10, "min": 8 },
  "cancel": { "upTo": 1 },
  "botch": { "upTo": 1 },
  "exceptional": { "successes": 5 },
  "situationalDice": { "min": -3, "max": 3 },
  "reroll": [{ "id": "careful", "upTo": 6, "mode": "once" }],
  "difficultyLadder": [
    { "label": "Plain work", "successes": 1, "target": 6 },
    { "label": "Grim", "successes": 3, "target": 8 }
  ]
}
```

- `die`: faces de cada dado da reserva, de 2 a 100.
- `pool`: limites aplicados ao número da ficha antes de qualquer explosão. Um `min` de 0 permite que uma reserva vazia falhe sem rolar; `max` não pode passar de 100. `abilityPlusAbility: true` permite que um teste de atributo nomeie um segundo atributo com `with=` e role os dois, para sistemas que rolam dois atributos juntos; sem isso, `with=` não significa nada num teste de atributo.
- `target`: face que o dado precisa atingir para contar. Coloque `min` abaixo de `max` para permitir ao GM ajustá-la por teste com `threshold=`; iguale os três valores para fixá-la.
- `double`: opcional. Uma face igual ou superior a `from` conta duas vezes.
- `explode`: opcional. Uma face igual ou superior a `from` rola mais um dado, que também pode explodir. Dados extras são limitados a `pool.max` além da reserva inicial: um teste rola no máximo o dobro de `pool.max` e um `from` baixo não causa rolagens infinitas.
- Ambos podem ter um `min`: a face mais baixa até a qual um teste pode baixar a regra, com `explode="N"` ou `double="N"` na tag ou com uma entrada que o personagem usou. Com um `min`, você pode omitir `from`, e então a regra só dispara num teste que a peça: uma especialidade que faz os dez rolarem de novo numa perícia é `"explode": { "min": 10 }`. `from` não pode ficar abaixo de `min`.
- `cancel`: opcional. Uma face igual ou inferior a `upTo` retira um sucesso. A contagem nunca fica abaixo de zero.
- `botch`: opcional. Se **nenhum** dado teve sucesso e saiu uma face igual ou inferior a `upTo`, o teste é uma falha crítica. Uma reserva cujo único sucesso foi cancelado falhou, mas não é uma falha crítica. `"rule": "halfOrMore"` lê isso de outra forma: faces iguais ou inferiores a `upTo` em pelo menos metade dos dados rolados no início (sem contar explosões) são uma falha crítica quando nenhum dado teve sucesso e, caso contrário, mantêm o resultado e o marcam com `complication="true"`, algo que dá errado junto com ele. `"noSuccesses"` é o padrão.
- `exceptional`: opcional. Essa quantidade de sucessos líquidos ou mais, num teste bem-sucedido, produz um sucesso crítico.
- `situationalDice`: opcional. Limites de dados que o GM pode adicionar ou retirar com `bonus=` por acrobacias, ferimentos ou pouca luz.
- `reroll`: opcional. Novas rolagens que o sistema concede sem que ninguém pague por elas, até seis, cada uma com um `id` que o GM nomeia num teste com `reroll=`. Faces iguais ou inferiores a `upTo` são roladas de novo: com `"once"`, a nova face vale, seja qual for; com `"until"`, até mostrarem mais. `upTo` vai de 1 até uma face abaixo do número de faces do dado, já que rolar de novo todas as faces nunca pararia, e um `until` para de qualquer forma depois de cem novas rolagens num teste. Nenhuma é rolada a menos que o teste a nomeie. Um teste faz uma única nova rolagem: quando um gasto ou uma entrada usada pelo personagem também comprou uma, rola-se a que alcança mais faces e, se alcançarem as mesmas, `until` prevalece sobre `once`.
- `difficultyLadder`: `successes` informa quantos sucessos são necessários. Um patamar também pode nomear `target`, mas só se for ajustável e dentro dos limites. Esse alvo é o que um teste naquele patamar usa para contar: quando o GM nomeia o patamar com `difficulty=` ou escreve um `dc=` que exatamente um patamar exige. Quando vários patamares exigem o mesmo número de sucessos, `dc=` sozinho não diz qual foi o pretendido, então o alvo continua sendo o padrão; nomeie o patamar.

- `target.from`: opcional. Lê o alvo de cada personagem na própria ficha, como o Number de Lasers & Feelings, que o personagem escolhe uma vez (qualquer referência de valor: um atributo, um campo, um valor derivado). Ele é mantido entre `min` e `max`, e `threshold=` não o move, porque o número é do próprio personagem; um limiar comprado por uma entrada que o personagem usou ainda o move. O `threshold=` do registro diz o que foi usado.
- `stances`: opcional. Até seis, cada uma com um `id`, um `label`, `count` (`"below"` ou `"above"`) e as `skills` que cobre. Um teste numa dessas perícias conta os dados **abaixo** do alvo, ou **acima** dele, em vez de iguais ou superiores: Lasers & Feelings é uma postura Lasers que conta abaixo e uma postura Feelings que conta acima, com cada perícia numa delas. Uma perícia só pode estar numa postura. As posturas deixam de fora `explode`, `double`, `cancel` e `botch`, que são lidos contra "igual ou superior".
- `exact`: opcional. Um dado que mostra exatamente o alvo: `label` dá o nome (`"LASER FEELINGS"`), `text` pode dizer o que ele faz na mesa, e ele conta como um sucesso, a menos que `counts` seja `false`. O registro leva `exact="N"`, o número desses dados, e o cartão de dados o mostra ao lado do resultado, para que o Game Master possa dar ao jogador a percepção que ele compra.

As faces de `cancel` e `botch` precisam ficar abaixo do alvo mínimo, e toda face nomeada deve existir no dado. Uma regra impossível de ativar é recusada na importação, em vez de ser descoberta durante a partida.

Um conjunto empacotado que usa reservas exige Capability API 1.24; um `min` em `explode` ou `double`, `pool.abilityPlusAbility` e `botch.rule` exigem 1.37; `reroll` exige 1.38; `target.from`, `stances` e `exact` exigem 1.137. Um conjunto comunitário importado é validado pelo Engine que o lê, então não precisa de nada mais.

#### O que o Game Master pode escrever num teste de reserva

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
[skill_check: skill="Ward" difficulty="Grim" explode="9"]
[skill_check: skill="Nerve" dc="1" with="Warmth"]
[skill_check: skill="Ward" dc="2" reroll="careful"]
```

- `dc` é a quantidade de **sucessos** necessária, não o alvo por dado. Vai de 1 ao máximo que uma rolagem poderia contar: máximo da reserva, dobrado se os dados explodem e dobrado novamente se as faces contam duas vezes.
- `threshold=` ajusta o alvo por dado e só é oferecido quando `target.min` é menor que `target.max`.
- `bonus=` adiciona ou retira dados e só é oferecido se `situationalDice` estiver declarado.
- `with=` rola uma perícia ou salvaguarda com outro atributo. Funciona nos dois tipos; 5e obtém "Strength (Intimidation)" pelo mesmo atributo. Num teste de atributo, ele adiciona um segundo atributo, quando `pool.abilityPlusAbility` está ativado.
- `difficulty=` nomeia um patamar da escala no lugar de `dc=`, nos dois tipos: seus sucessos (ou sua dificuldade numa soma) e, numa reserva, seu alvo. Um `dc=` escrito ao lado ainda prevalece para o número, e `threshold=` para o alvo. Um nome ao qual nenhum patamar responde, ou que dois patamares compartilham, é ignorado.
- `explode=` e `double=` movem as faces dessas regras neste teste e só são oferecidos quando a regra tem um `min`.
- `reroll=` nomeia uma das suas entradas `reroll` para este teste e só é oferecido quando você declarou alguma. Um nome ao qual nenhuma delas responde é ignorado.

Tudo respeita seu arquivo: valores fora dos limites são ajustados ao extremo mais próximo e um atributo não oferecido é ignorado sem recusar o teste. O registro salvo mostra o que a rolagem realmente usou: a dificuldade e o alvo como números, os dados extras depois dos limites, `with=` só quando o atributo foi trocado ou adicionado, uma face só quando o teste a moveu, `reroll=` só quando a nova rolagem que ele nomeia foi a rolada e rolou alguma coisa, e `complication="true"` quando uma falha crítica `halfOrMore` deu errado junto com um resultado. O Engine sempre rola os dados. Substitui resultados de reserva escritos pelo modelo, ignora `mode="advantage"` porque esse tipo não tem vantagem e não usa um dado que o jogador rolou antes do turno.

#### `dice-highest`: rolar os dados e ler o maior

Blades in the Dark e Trophy Dark rolam um punhado de d6 e leem só o maior. Capability API 1.138.

```json
"resolution": {
  "kind": "dice-highest",
  "die": { "sides": 6 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "rating_0", "label": "0" }, { "id": "rating_1", "label": "1", "flat": 1 }],
  "pool": { "min": 0, "max": 6 },
  "zeroDice": "lowest-of-two",
  "critical": { "count": 2 },
  "situationalDice": { "min": -1, "max": 2 },
  "difficultyLadder": [{ "label": "Partial", "dc": 4 }, { "label": "Full", "dc": 6 }],
  "outcomes": {
    "by": "total",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "full", "label": "Full success", "atLeast": 6, "success": true },
      { "id": "partial", "label": "Partial success", "atLeast": 4, "success": true, "text": "You do it, with a consequence." },
      { "id": "bad", "label": "Bad outcome" }
    ]
  }
}
```

- O número da ficha é a quantidade de dados, como numa reserva, mantida dentro de `pool` (no máximo 20). Ferimentos, `adjust`, condições e itens somam ou retiram dados.
- `keep`: opcional, de 1 a 3, padrão 1. Quantos dos maiores dados são somados: 1 é Blades, 2 são as lutas de Trophy Dark.
- `zeroDice`: o que faz um personagem sem dados. `"lowest-of-two"` (o padrão) rola dois e mantém o menor, e nunca pode ser um crítico; `"fail"` falha sem rolar.
- `critical`: opcional. `count` dados que mostram a face máxima (ou `face` e acima) são um sucesso crítico: os dois seis de Blades.
- `dark`: opcional, os dados sombrios de Trophy Dark. `label`, `max` (de 1 a 10) e `text`. O Game Master os acrescenta a um teste com `dark="N"`. `outcome` é `"all"` por padrão: eles são lidos com os demais. Com `"outcome": "light"` (Capability API **1.149**), só os dados claros decidem os dados mantidos, o total, as faixas de resultado e os críticos. Sem dados claros, `zeroDice` se aplica ao lado claro: rolar dois dados claros e manter o menor, ou falhar rolando mesmo assim os dados sombrios. Os dados sombrios são sempre rolados e registrados por último; `darkHighest="true"` significa que um dado sombrio superou estritamente todos os dados claros (inclusive os dados claros substitutos; sem nenhum rolado, qualquer dado sombrio vence). O que isso custa (Ruin) cabe ao Game Master aplicar. Declarar `dark.outcome`, inclusive `"all"`, exige capabilityApi 1.149.
- `situationalDice`: opcional, os dados que o Game Master pode somar ou retirar com `bonus=` (ajuda, esforço extra).
- `spend` só pode comprar dados.
- `difficultyLadder`: patamares com `dc`, o número que os dados mantidos precisam alcançar. `dc=` num teste é esse número, de 1 até `keep` vezes as faces do dado.
- `outcomes` leem `by: "total"` a partir dos dados mantidos, e uma faixa `on: "critical-success"` captura o crítico.

O registro mantém a forma somada (`resolution="sum"`, `modifier="0"`, os dados mantidos como total) e acrescenta `highest="1"`, com `zeroDice="true"` e `dark="N"` quando se aplicam; os dados sombrios são os últimos em `rolls`. Um resultado só dos dados claros também registra `darkOutcome="light"`, para que o cartão destaque só os dados claros mantidos, inclusive depois de recarregar. Um conjunto desse tipo não tem luta própria, então `combat` é recusado ao lado dele.

#### `roll-against`: rolar no máximo (ou no mínimo) o número da ficha

Call of Cthulhu, GURPS e as porcentagens de um ladrão old-school rolam contra um número da ficha em vez de somá-lo aos dados. Capability API 1.139.

```json
"resolution": {
  "kind": "roll-against",
  "dice": { "count": 1, "sides": 100 },
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [{ "id": "base", "label": "Base" }],
  "against": "at-most",
  "criticalSuccess": [{ "from": 1, "to": 1 }],
  "criticalFailure": [{ "from": 100, "to": 100 }, { "from": 96, "whenTarget": { "below": 50 } }],
  "tens": { "max": 2 },
  "difficultyLadder": [
    { "label": "Regular", "dc": 0 },
    { "label": "Hard", "dc": 0, "divide": 2 },
    { "label": "Extreme", "dc": 0, "divide": 5 }
  ],
  "outcomes": {
    "by": "fraction",
    "tiers": [
      { "id": "critical", "label": "Critical", "on": "critical-success", "success": true },
      { "id": "extreme", "label": "Extreme success", "atLeast": 5, "success": true },
      { "id": "hard", "label": "Hard success", "atLeast": 2, "success": true },
      { "id": "regular", "label": "Regular success", "atLeast": 1, "success": true },
      { "id": "fail", "label": "Failure" },
      { "id": "fumble", "label": "Fumble", "on": "critical-failure" }
    ]
  }
}
```

- O número da ficha para o teste é o alvo. A porcentagem de uma perícia é o bônus por perícia da ficha (`bonusRange` vai até 100), sem atributo e sem bônus de nível; uma perícia de GURPS é seu atributo mais esse bônus.
- `dice`: o que é rolado e somado, 1d100 por padrão (3d6 para GURPS, 1d20 para uma salvaguarda).
- `against`: `"at-most"` (o padrão) tem sucesso com resultado igual ou inferior ao alvo, `"at-least"` com resultado igual ou superior.
- `difficultyLadder`: o `dc` de cada patamar move o alvo, e `divide` (de 2 a 10) divide antes o número da ficha. O Game Master nomeia um patamar com `difficulty=`; um `dc=` na tag move o número, de -100 a 100. O `dc` do registro é o número contra o qual a rolagem foi lida, e o registro diz `against="at-most"`.
- `criticalSuccess` e `criticalFailure`: até seis regras cada. Uma regra nomeia faces (`from`, `to`, qualquer um pode ficar aberto) ou, para uma falha, `pastTarget`, uma rolagem a essa distância ou mais no lado da falha. `whenTarget` (`atLeast`, `below`) limita uma regra a alguns alvos: o 5 de GURPS só é sucesso crítico com 15 ou mais. Um sucesso crítico sempre tem sucesso, e uma falha crítica sempre falha.
- `tens`: opcional, só num único d100. `bonus="+N"` rola N dados de dezena a mais e mantém a melhor rolagem, `bonus="-N"` a pior, até `max`.
- `outcomes` pode ler `by: "fraction"` numa rolagem `at-most`: o `atLeast` de cada faixa divide o alvo, e uma rolagem igual ou inferior a essa fração cai na faixa. As medidas `margin` (quanto abaixo do alvo) e `total` também funcionam.

#### `symbol-pool`: rolar dados narrativos e ler os símbolos

Genesys monta uma reserva a partir de uma característica e da graduação de uma perícia e depois acrescenta dados opostos. As faces trazem sucesso, vantagem, triunfo, falha, ameaça e desespero em vez de números. Capability API 1.141.

```json
"resolution": {
  "kind": "symbol-pool",
  "abilityModifier": { "op": "identity" },
  "proficiencyTiers": [
    { "id": "untrained", "label": "Untrained", "flat": 0 },
    { "id": "rank_one", "label": "Rank 1", "flat": 1 }
  ],
  "symbols": [
    { "id": "s", "label": "Success" },
    { "id": "f", "label": "Failure", "cancels": "s" },
    { "id": "a", "label": "Advantage" },
    { "id": "h", "label": "Threat", "cancels": "a" },
    { "id": "t", "label": "Triumph", "counts": "s" },
    { "id": "d", "label": "Despair", "counts": "f" }
  ],
  "dice": [
    { "id": "ability", "label": "Ability", "faces": [[], ["s"], ["s"], ["s", "s"], ["a"], ["a"], ["s", "a"], ["a", "a"]] },
    { "id": "proficiency", "label": "Proficiency", "faces": [[], ["s"], ["s"], ["s", "s"], ["s", "s"], ["a"], ["s", "a"], ["s", "a"], ["s", "a"], ["a", "a"], ["a", "a"], ["t"]] },
    { "id": "difficulty", "label": "Difficulty", "faces": [[], ["f"], ["f", "f"], ["h"], ["h"], ["h"], ["h", "h"], ["f", "h"]] },
    { "id": "challenge", "label": "Challenge", "faces": [[], ["f"], ["f"], ["f", "f"], ["f", "f"], ["h"], ["h"], ["f", "h"], ["f", "h"], ["h", "h"], ["h", "h"], ["d"]] },
    { "id": "boost", "label": "Boost", "faces": [[], [], ["s"], ["s", "a"], ["a", "a"], ["a"]] },
    { "id": "setback", "label": "Setback", "faces": [[], [], ["f"], ["f"], ["h"], ["h"]] }
  ],
  "success": { "symbol": "s", "needed": 1 },
  "pool": { "die": "ability", "upgrade": "proficiency", "max": 6 },
  "difficulty": { "die": "difficulty", "upgrade": "challenge", "max": 5 },
  "boost": { "die": "boost", "max": 3 },
  "setback": { "die": "setback", "max": 3 },
  "criticalSuccess": "t",
  "criticalFailure": "d",
  "difficultyLadder": [{ "label": "Easy", "dc": 1 }, { "label": "Average", "dc": 2 }, { "label": "Hard", "dc": 3 }]
}
```

- `symbols`: de 2 a 10 símbolos nomeados. `counts` também acrescenta um de outro símbolo antes da anulação: um triunfo acrescenta um sucesso e continua sendo um triunfo. Ele nomeia um símbolo sem `counts` próprio; cadeias e autorreferências são recusadas. `cancels` emparelha dois símbolos, um para um, com no máximo um par para cada. A declaração inversa é opcional. `text` explica um símbolo ao Game Master.
- `dice`: de 2 a 8 dados nomeados, cada um com 2 a 20 faces. As faces são matrizes de até três IDs de símbolo; `[]` é uma face em branco, e IDs repetidos contam duas vezes. Todas as referências precisam existir.
- `pool`: `larger-upgraded` (o padrão) rola o maior entre atributo e graduação, aprimorando o número menor quando `upgrade` é declarado. `sum` soma os dois e não aprimora nenhum. `max` tem padrão 6 e não pode passar de 12. O atributo usa `abilityModifier`, então use `identity` para as características de Genesys. A graduação vem do nível de proficiência da perícia ou salvaguarda; um teste de atributo puro tem graduação zero. `with=` troca a característica como nos outros testes. Bônus da ficha, ferimentos, ajustes e efeitos acrescentam dados de impulso ou de revés pelo bônus com sinal descrito abaixo.
- `difficulty`: `dc=` conta dados opostos de 0 até `max` (padrão 5, teto 12). `difficulty=` nomeia um patamar da escala no lugar. `upgrade="N"` substitui essa quantidade de dados opostos pelo dado aprimorado, limitada ao número realmente rolado. Nunca acrescenta dados além da dificuldade.
- `boost` e `setback`: dados opcionais acrescentados por `bonus="+N"` e `bonus="-N"`, respectivamente, até o `max` de cada um (padrão 3, teto 6). Ajustes com sinal se combinam antes de esse limite ser aplicado. A Capability API **1.150** também aceita `setback="N"` de forma independente: `bonus="2" setback="1"` rola os dois lados. Um bônus negativo soma a `setback`, com a contagem combinada de dados de revés limitada a `setback.max`; os dados de impulso continuam limitados por `boost.max`.
- `allowOwnUpgrade`: opcional, falso quando ausente. Com `true`, `upgradeOwn="N"` aprimora mais N dados do personagem para `pool.upgrade` (que precisa ser declarado), depois dos aprimoramentos da ficha e dos dados comprados. Quando todos os dados existentes já foram aprimorados, cada aprimoramento extra acrescenta um dado aprimorado, ainda limitado por `pool.max`. Isso também funciona com `pool.build: "sum"`. Declarar essa chave, mesmo como `false`, exige capabilityApi **1.150**. Os nomes de atributo usam camel case, como `zeroDice`; `upgradeOwn` afeta quem rola, e `upgrade` continua afetando só os dados de dificuldade. Tanto `setback` quanto `upgradeOwn` aceitam inteiros não negativos e são ignorados fora das reservas de símbolos; `upgradeOwn` é ignorado a menos que esteja ativado.
- `success`: exige essa quantidade do seu símbolo depois da anulação, um por padrão. O sucesso crítico e a falha crítica marcam qualquer ocorrência do símbolo que nomeiam, mesmo que o sucesso ou a falha que ele acrescenta seja anulado. Os dois marcadores podem ocorrer juntos, e nenhum muda se os sucessos líquidos passaram no teste.
- `outcomes` pode ler a contagem de sucessos líquidos (`total`) ou `net successes - needed + 1` (`margin`). As faixas continuam decidindo o sucesso da forma de sempre; os símbolos críticos originais continuam marcados. `spend` só compra dados extras de personagem dentro de `pool.max`. O combate fica de fora, como em `dice-highest`.
- O registro mantém `resolution="sum"`, com `symbols="2s 1a 1t"`, `thrown=` identificando cada dado e `rolls=` guardando sua face, contada a partir de 1. O `symbolDetails` codificado preserva os rótulos, os símbolos das faces e os dois marcadores críticos. `setback` registra os dados de revés independentes realmente acrescentados depois do limite compartilhado de revés, e `upgradeOwn` registra os aprimoramentos adicionais realmente aplicados; acréscimos ignorados ou iguais a zero são omitidos. O cartão e o resumo nomeiam os símbolos líquidos, inclusive um resultado vazio, em vez de somar números de faces. Substituições podem mudar as regras desse tipo, mas não podem substituir `symbols` nem `dice`.

#### O que fica fora e por quê

Estas mecânicas ainda precisam de um tipo de resolução próprio:

- **Reservas opostas** resolvem dois personagens ao mesmo tempo; um teste tem um único rolador.
- **Reservas somadas com um dado especial** (como em OpenD6) somam os dados e tratam um deles de forma diferente.

As duas coisas que esse tipo deixava de fora já estão modeladas; a seção sobre gastar para mudar uma rolagem, abaixo, explica como. Uma regra do próprio sistema, "spend a point for a success" ou "spend a point to throw the failures again", é `resolution.spend`. Uma nova rolagem que o sistema concede de graça quando a situação pede é `resolution.reroll`, acima. Uma que pertence a algo escolhido pelo personagem é `mechanics.check` numa entrada de catálogo, paga com o custo da própria entrada.

### Faixas de resultado: mais que sucesso ou falha

Muitos sistemas leem um teste como um entre vários resultados, e não como um simples passou ou falhou: os quatro graus de sucesso de Pathfinder, um "por pouco" que tem sucesso com um custo, os sucessos difíceis e extremos de Call of Cthulhu, o "sucesso com estilo" de Fate. `resolution.outcomes` nomeia essas faixas, e o Engine diz em todo teste em qual delas ele caiu (Capability API 1.135). Funciona com todos os tipos de resolução.

```json
"outcomes": {
  "by": "margin",
  "naturals": "shift",
  "tiers": [
    { "id": "critical_success", "label": "Critical success", "atLeast": 10, "success": true, "critical": true },
    { "id": "success", "label": "Success", "atLeast": 0, "success": true },
    { "id": "failure", "label": "Failure", "atLeast": -9 },
    { "id": "critical_failure", "label": "Critical failure", "critical": true }
  ]
}
```

- `by`: de onde as faixas são lidas. `"margin"` (o padrão) é quanto o resultado passou do que o teste exigia: um total somado menos a dificuldade, ou os sucessos líquidos de uma reserva menos os sucessos exigidos. `"total"` é o próprio resultado: o total somado, ou os sucessos líquidos, seja qual for a dificuldade.
- `tiers`: de duas a oito faixas, **da melhor para a pior**. `atLeast` é o menor número que cai numa faixa; o de cada faixa é menor que o da anterior, e a última faixa não tem nenhum, porque captura tudo abaixo. `success` diz se a faixa é um sucesso, e `critical` a marca como crítica do seu tipo (um sucesso crítico quando `success` é verdadeiro, uma falha crítica quando não é). Pelo menos uma faixa precisa ter sucesso, e pelo menos uma precisa falhar. `text` é uma linha opcional, de até 200 caracteres, que diz ao Game Master o que a faixa significa na mesa ("You do it, but the Game Master adds a complication").
- `on`: `"critical-success"` ou `"critical-failure"` faz de uma faixa aquela em que cai um crítico, diga o número o que disser, e nada mais cai ali. Ela não tem `atLeast`; uma faixa de sucesso crítico é um sucesso, uma de falha crítica não é, e há no máximo uma de cada. Os "dois seis" de Blades in the Dark são uma faixa de sucesso crítico acima da faixa de um único seis; as outras faixas, as lidas a partir do número, seguem entre si as regras acima.
- `naturals: "shift"`: a face máxima de um dado único move o resultado uma faixa para cima, e a face mínima uma faixa para baixo, nunca além das pontas. Exige um único dado e substitui `resolution.naturals`, então defina os dois como `none` ao lado dele.

A faixa decide o resultado: o sucesso e os dois críticos vêm dela, nunca da comparação simples. Quando os `naturals` de um conjunto somado fazem de uma face um sucesso ou uma falha automática, essa face cai na faixa desse crítico ou, sem ela, na melhor ou na pior faixa, e continua sendo um crítico. A falha crítica de uma reserva faz o mesmo na ponta de baixo, e uma reserva com faixas deixa `exceptional` de fora, porque as faixas já dizem o que é um sucesso crítico.

Uma reserva lida com `by: "total"` é como um sistema de dificuldade fixa expressa seus resultados: o "1 sucesso: você consegue por pouco, 2: você faz bem, 3: sucesso crítico" de Lasers & Feelings são três faixas em 3, 2 e 1 sucessos e um erro abaixo disso.

O registro nomeia a faixa com `outcome="Critical success"`, o cartão de dados a mostra no lugar da palavra simples, e o Game Master aprende as faixas e seu `text` e é instruído a narrar a faixa. Um conjunto empacotado que declara faixas exige Capability API 1.135.

### Testes que rolam do próprio jeito

Alguns jogos rolam a maioria dos testes de um jeito e alguns de outro: um jogo old-school rola um d20 abaixo de um atributo, mas as perícias de ladrão num d100 e Open Doors num d6. `resolution.overrides` nomeia esses testes e as chaves de resolução com que eles rolam no lugar. Capability API 1.140.

```json
"overrides": [
  { "id": "thief", "label": "Thief skills", "skills": ["open_locks", "pick_pockets"], "set": { "dice": { "count": 1, "sides": 100 } } },
  { "id": "x_in_6", "label": "X-in-6", "skills": ["open_doors", "listen"], "set": { "dice": { "count": 1, "sides": 6 } } },
  { "id": "favored", "label": "Favored", "skills": ["athletics"], "when": { "field": "favored_athletics" }, "set": { "cancel": null } }
]
```

- Cada substituição nomeia `skills`, `saves` ou `abilities` (uma ou mais das três), um `label` e um `text` opcional para o Game Master.
- `set` contém chaves de resolução do próprio tipo do conjunto, que substituem as do conjunto nesses testes. `null` retira uma chave: os 1 do exwod que não anulam num atributo favorecido são `"cancel": null`. O tipo, a matemática da ficha (`abilityModifier`, `proficiency`, `proficiencyTiers`, `penaltyFrom`, `spend`, `adjust`) e a `difficultyLadder` não podem ser alterados. Uma reserva de símbolos também trava seus `symbols` e `dice`. A resolução que uma substituição produz é verificada como a do próprio conjunto, então uma face que ela nomeia precisa existir nos dados.
- `when`: opcional. Um valor da ficha de quem rola; a substituição só se aplica onde ele não é 0, como um campo numérico de 0 ou 1 para um atributo favorecido. Sem ele, a substituição sempre se aplica.
- Vale a primeira substituição que nomeia o teste e cujo `when` é verdadeiro. Um teste aparece em no máximo uma substituição sem `when`.

### Gastar para mudar uma rolagem

Alguns sistemas permitem pagar por uma rolagem prestes a acontecer: um ponto de vontade por um sucesso automático. `resolution.spend` define isso como regra permanente do sistema, não como algo comprado pelo personagem:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` é uma das suas `live.pools`. Não pode começar vazia, pois não haveria nada para gastar no início da partida.
- `amount` é o custo de UMA compra. `successes`, `dice` e `reroll` informam o que ela compra; precisa comprar pelo menos um deles. Sucessos são adicionados depois da contagem dos dados e das anulações, porque ninguém os rolou. Dados são rolados com a reserva, dentro dos limites dela. Um `reroll` é `{ "upTo": 6, "mode": "once" }`, lido como `resolution.reroll`, e é comprado uma única vez, quantas compras o teste fizer: um dado rolado de novo duas vezes continua sendo uma nova rolagem.
- `perCheck` limita as compras de um teste: no máximo ele pode comprar o equivalente a `amount * perCheck` pontos. Esse teto impede uma reserva cheia de comprar uma rolagem impossível de perder. É um número de 1 a 10, um valor da ficha na mesma forma que um valor derivado lê (`{ "abilityScore": "nerve" }`, `{ "derived": "focus" }`) ou `"pool"`: tantas quantas forem os dados do teste, ou seja, o número da ficha para ele antes de ferimentos, dados extras ou modificadores. Um valor da ficha é lido para quem rola, arredondado para baixo e mantido entre 0 e 100, e um personagem cujo limite chega a 0 não compra nada nem paga nada.
- Um conjunto `dice-pool` pode comprar sucessos, dados ou novas rolagens. `dice-highest` e `symbol-pool` só compram dados. Os outros tipos não podem declarar `spend`.
- Até quatro entradas, e duas não podem nomear a mesma reserva, pois o teste não conseguiria distingui-las.
- Um gasto que compra um `reroll`, um `perCheck` que não é um número e mais de duas entradas exigem Capability API 1.38 num conjunto empacotado.

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

- `reroll` rola novamente os dados iguais ou inferiores a `upTo`. `once` substitui cada um uma vez e mantém a face nova; `until` continua. `upTo` precisa ficar abaixo da face máxima ou rolaria a reserva inteira para sempre. O Engine limita quantos dados um teste pode rolar novamente, independentemente do arquivo.
- `dice` adiciona dados antes da rolagem; `successes` adiciona sucessos depois da contagem; `threshold` fixa o alvo por dado para aquela rolagem, dentro da faixa permitida por `target`.
- `explode` e `double` movem as faces dessas regras para aquela rolagem, e só quando sua regra tem um `min` e dentro dele: `"check": { "explode": 8 }` é uma entrada que faz os oitos rolarem de novo. Eles prevalecem sobre o que o GM escreveu na tag, como `threshold`. Capability API 1.37.
- É necessário pelo menos um destes; caso contrário, a entrada não diz nada e é recusada.
- Só `dice-pool` pode aplicar isso; um conjunto `dice-sum` com `mechanics.check` é recusado na importação.

**O custo é o `cost` da entrada**, pago pelo mesmo mecanismo de qualquer outro uso: a reserva e um uso de cada contador que essa entrada escreveu. `perCostStep` indica que ela ESCALA: se o declara, é comprada tantas vezes quantas seu preço foi pago; caso contrário, é comprada uma vez, independentemente do valor oferecido.

**O GM a nomeia no teste:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. Não usa um comando de ficha separado pelo mesmo motivo: os dados rolam antes da atualização dos registros.

**Tudo ou nada.** Se a reserva não cobre o custo, a compra não acontece e nada é descontado; a rolagem continua exatamente como seria. Pontos que não equivalem a um número inteiro de compras também não compram nada. Pedir mais que `perCheck` é limitado, não recusado; só o teto é pago. O Engine calcula tudo. O GM nomeia o que o jogador disse que gastaria e nunca mexe nos dados. O registro informa o que foi realmente pago, a entrada aplicada, os sucessos não rolados e quantos dados foram rolados novamente. Um amuleto não escolhido, ou cujo catálogo o Engine não consegue ler, não faz nada em vez de ser aplicado por confiança.

### A ficha

- `sections` agrupa elementos no editor. Campos, valores derivados e listas nomeiam a seção em que ficam com `section`, e atributos, perícias e salvaguardas também podem fazer isso: o editor, a ficha da partida e o bloco de ficha do GM os mostram sob esse título (uma ficha que não nomeia seção neles os mostra exatamente como antes). Uma seção também pode ter uma regra `untrained` (abaixo).
- `abilities` contém as pontuações principais. `skills` e `saves` podem nomear o atributo de suas rolagens, um `cap` e uma regra `untrained` (abaixo).
- `fields` contém valores individuais. Tipos: `number`, `text`, `longtext`, `boolean`, `enum` (lista fixa de escolhas) e `dice` (texto como `1d8`).
- Valores `derived` são calculados a partir de outros e não podem ser sobrescritos na digitação. Uma ficha pode ter até 400 deles (Capability API 1.111; 240 a partir da 1.88, 120 a partir da 1.84, 60 antes disso); um pacote com mais de 240 declara 1.111. Operações: `sum`, `min`, `max`, `scale` (multiplicar por um número fixo e arredondar), `multiply` (de dois a seis valores multiplicados entre si, como um modificador de Constitution vezes o nível; Capability API 1.82), `stepTable` (consultar limiares, como quando um nível define o bônus de proficiência) e `enumTable` (um número para cada valor de um campo enum ou de um estado vivo; veja Estados vivos abaixo).
- `lists` contém tabelas com colunas próprias, como equipamento, magias ou características. Uma lista tem até 24 colunas; um pacote com uma lista de mais de 12 declara Capability API 1.165. Uma lista com `pools` transforma cada linha num recurso com máximo próprio, para características de classe com usos limitados. Uma coluna numérica pode ser preenchida por uma rolagem: `"roll": { "count": 1, "sides": 8 }`, em que `sides` é um número, outra coluna da mesma linha (`{ "column": "die" }`, uma coluna numérica ou um enum cujos valores se leem como dados, como `d8`) ou um valor da ficha. O editor de fichas mostra um botão Roll que rola os próprios dados do Engine e escreve o total, mantido entre o `min` e o `max` da coluna (Capability API 1.85).
- `live` é o que muda durante a partida: `pools` (pontos de vida, espaços de magia, Grit), `tracks` (número numa escala, como exaustão, ou trilha de ferimentos com casas), `text` (notas curtas, como concentração), `conditions` e `states` (um valor de um conjunto fechado, como uma forma ou uma postura).

Tudo que lê um número o nomeia com uma referência de valor: um objeto com exatamente uma chave entre `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` e `itemStat`. Por exemplo, uma reserva cujo máximo é derivado: `"max": { "derived": "grit_max" }`.

- `listSum` soma uma coluna numérica de uma lista: `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` é opcional e nomeia uma coluna booleana; só contam as linhas em que ela está ativada. Uma célula vazia conta como o padrão da coluna, e uma lista ocultada por `hideWhen` não soma nada. Ember Roads calcula Burden assim, a partir do equipamento que o personagem leva na mochila, então ele nunca se desencontra da lista como um número digitado poderia. Uma coluna escalada de catálogo não pode ler uma soma de lista, nem por meio de um valor derivado: uma lista pode conter células escaladas, próprias ou que a leem de volta, e o recálculo nunca se estabilizaria.
- `livePool` lê o que resta numa das suas `live.pools` (a reserva de uma linha de lista não é uma delas). `liveTrack` lê uma das suas `live.tracks`, com um `read` opcional: `"value"`, onde ela está (o padrão); `"filled"`, quanto está acima do `min`; `"remaining"`, quanto falta para o `max`; ou, só numa trilha de ferimentos, `"penalty"`, a penalidade ativa. Uma reserva ou trilha oculta lê 0. O "Harm still to take" de Gravewatch é `{ "liveTrack": "harm", "read": "remaining" }`.
- Uma leitura viva pega o estado vivo como está quando um teste é rolado, uma luta começa ou o bloco de ficha do GM é escrito. Quando ainda não existe um (no editor de fichas, na revisão de uma importação), lê o estado em que a partida começa: uma reserva cheia ou vazia conforme seu `start`, uma trilha no seu `default`, uma trilha de ferimentos sem marcas.
- Nada calculado antes de existir um estado vivo pode ler um: o `max` de uma reserva ou de uma trilha, o bônus de proficiência ou a coluna escalada ou a escala de um catálogo. Isso vale também por meio de um valor derivado que lê um e por meio de uma perícia limitada por um valor vivo, e a importação nomeia o valor responsável.
- Esses três exigem Capability API 1.39 num conjunto empacotado.
- `itemStat` lê os itens que o personagem tem, como o valor de guard da armadura que veste, e segue a mesma regra de uma leitura viva. Veja [Itens na ficha](#items-on-the-sheet). Capability API 1.52.

**O que um teste faz sem treinamento.** Uma perícia ou salvaguarda em que o personagem não tem treinamento (seu nível é o primeiro) rola normalmente, a menos que o conjunto diga o contrário, com `untrained` na perícia ou salvaguarda ou na seção em que ela fica (a regra da própria perícia ou salvaguarda prevalece):

```json
"sections": [{ "id": "labour", "label": "Labour", "untrained": { "by": -1 } }],
"skills": [
  { "id": "dig", "label": "Dig", "ability": "sinew", "section": "labour", "untrained": "refuse" },
  { "id": "listen", "label": "Listen", "ability": "nerve", "untrained": "harder" }
]
```

- `"normal"`: normalmente (o padrão).
- `{ "by": -3 }`: somado ao número do teste, de -20 a 20: dados numa reserva, um valor fixo numa soma. Faz parte do número que a ficha mostra e que todo teste rola, antes de qualquer `cap`.
- `"harder"`: um passo mais difícil. Numa reserva, o alvo por dado sobe um (e fica dentro da faixa do alvo), então exige um conjunto de reserva cujo alvo possa se mover; em qualquer outro caso é recusado na importação, porque nunca poderia mudar uma rolagem.
- `"refuse"`: o teste não é rolado. O Engine devolve o pedido do GM com `reason="untrained"`, o que o encerra: nada o rola depois, o GM é informado de que o personagem não pôde tentar, e a narração diz isso. O endpoint de teste de perícia responde a esse teste com um 400 (`skill_check_untrained`), e uma ramificação feita a partir dele não mantém nenhuma das duas metades. O editor de fichas não mostra número para ele.
- Um personagem sem ficha não tem treinamento a ler, então nenhuma regra de falta de treinamento se aplica a ele.
- O lembrete do GM lista as regras de falta de treinamento, por seção ou por perícia, para que ele peça testes que o personagem possa fazer.

Seções em atributos, perícias e salvaguardas, e `untrained` em qualquer lugar, exigem Capability API 1.41 num conjunto empacotado.

Uma perícia ou salvaguarda pode ter um `cap`, uma referência de valor que é o máximo que seu teste pode alcançar: uma pontuação que ela não pode superar ou uma trilha que a segura. Gravewatch limita Soothe ao Resolve que resta a um guardião, `"cap": { "livePool": "resolve" }`. O número limitado é o que a ficha mostra e que todo teste rola, e uma troca com `with=` é calculada sobre o número antes do teto e depois limitada de novo. Um teto não pode ler um modificador de perícia ou de salvaguarda, e o valor derivado que ele lê, ou qualquer valor derivado declarado acima desse, também não pode, para que a ficha continue sendo calculada uma única vez, de cima para baixo. Capability API 1.39.

`hideWhen` oculta um campo, um valor derivado, uma lista, uma reserva ou uma trilha comum pelo valor de outro campo, de exatamente uma de três formas: `equals` um valor, `notEquals` um valor (oculto sempre que o campo contém qualquer outra coisa; é assim que algo fica restrito a um tipo de personagem) ou `in` uma lista de valores. Cada valor nomeado precisa ser um que o campo possa conter, ou a regra nunca coincidiria, e isso é verificado um valor por vez; para `notEquals` e `in`, isso inclui a faixa de um campo numérico e o comprimento de um campo de texto. A regra lê o valor que o editor de fichas mostra: um campo não definido é o valor com que uma ficha em branco começa, e um valor enum que o conjunto não oferece mais é o padrão do campo. O arquivo 5e usa `equals` para ocultar espaços de magia de um personagem que não lança magias; Gravewatch mantém o óleo de lanterna fora da ficha de todo guardião que não está na vigília noturna com `"hideWhen": { "field": "watch", "notEquals": "night" }`. Uma camada não pode remover um valor com o qual qualquer uma dessas regras compara. Uma trilha de ferimentos não pode ser ocultada, porque rolagens e lutas a leem seja o que for que a ficha mostre. `notEquals` e `in` exigem Capability API 1.39.

O `max` de uma trilha comum pode ser uma referência de valor em vez de um número, para que uma pontuação do personagem defina até onde ela vai: `"max": { "field": "willpower_rating" }`. Seus `min` e `default` continuam sendo números. Uma trilha de ferimentos com níveis nomeados tem um `max` igual ao seu número de níveis; uma trilha de casas numeradas tem o comprimento do próprio `max` (veja Casas numeradas abaixo). `alwaysShow: true` imprime uma trilha no bloco de ficha do GM mesmo no seu padrão, para uma pontuação que importa em todo turno; sem isso, uma trilha no padrão é omitida, porque três salvaguardas contra a morte em zero não dizem nada. Esses três exigem Capability API 1.37 num conjunto empacotado.

### Estados vivos: uma forma, uma postura, uma luz

Um campo enum é escolhido quando o personagem é criado e continua escolhido, e uma condição só está ativa ou não. Um **estado vivo** é um valor de um conjunto fechado que muda durante a partida: a forma de um metamorfo, uma postura de luta, quão acesa está uma lanterna.

```json
"live": {
  "states": [
    {
      "id": "stance",
      "label": "Stance",
      "values": ["guarded", "steady", "reckless"],
      "valueLabels": { "guarded": "Guarded", "steady": "Steady", "reckless": "Reckless" },
      "default": "steady"
    }
  ]
}
```

- `values` são de dois a quarenta, cada um mostrado como sua entrada em `valueLabels` ou como ele mesmo. Seguem a regra de todo rótulo (uma linha, sem colchetes, sem chaves de macro) e nunca contêm aspas duplas, porque o comando de ficha os coloca entre aspas. Até doze estados.
- `default` é onde toda ficha começa, e o primeiro valor quando você o omite. Só um estado que saiu do padrão é salvo, e um valor salvo que o estado não oferece mais é lido como o padrão.
- `hideWhen` tira um estado da ficha pelo valor de um campo, como faz com uma reserva: ele não é mostrado, não é definido por comando e é lido por uma tabela (abaixo) como nenhum valor.
- O GM define um com `[sheet: who="Name" op="state" state="Stance" value="Reckless"]`, nomeando o estado pelo ID ou rótulo e o valor por ele mesmo ou por seu rótulo. Um estado ou valor que a ficha não tem é recusado (`unknown-state`, `unknown-value`). O Engine ensina o comando e lista cada valor só quando seu conjunto tem um estado, e todo bloco de ficha diz o valor de cada estado, inclusive o padrão, porque estar em forma humana é um fato de que a narração precisa a cada turno.
- A tela de ficha da partida mostra um seletor para cada estado.
- Um descanso restaura um estado com um passo de restauração que o nomeia: `{ "state": "stance", "to": "default" }`, ou `"to"` um dos seus valores.

**Números que acompanham.** Um valor derivado com `"op": "enumTable"` dá um número para cada valor de um campo enum ou de um estado vivo:

```json
{
  "id": "stance_brawn",
  "label": "Stance on Brawn",
  "op": "enumTable",
  "from": { "liveState": "stance" },
  "table": { "guarded": -1, "reckless": 2 },
  "default": 0
}
```

- `from` nomeia exatamente um entre `field` (um campo enum) e `liveState`. Cada linha de `table` é um valor que ele pode conter, de um a quarenta. Um valor que a tabela omite, e um estado que a ficha oculta, leem `default` (0 quando você o omite).
- Um campo é fixado quando o personagem é criado, então uma tabela baseada nele pode alimentar um máximo: Gravewatch dá um Resolve a mais a um guardião da vigília da aurora. Um estado vivo muda durante a partida, então uma tabela baseada nele é uma leitura viva, como `liveTrack`: nada calculado antes de existir um estado vivo pode lê-la, diretamente ou por meio de outro valor derivado. Por isso a chave é `liveState` e não `state`: toda leitura do estado vivo leva `live` no nome, e é assim que você e a importação sabem o que um máximo não pode usar.
- Para levar o número aos dados, aponte `resolution.adjust` para ele (veja Modificadores da ficha). Ember Roads soma sua Stance a toda rolagem de Brawn; Gravewatch aplica a toda rolagem de Nerve uma penalidade quando a lanterna está fechada ou apagada.
- Uma camada pode retirar de um campo um valor para o qual a tabela tem uma linha. Essa linha simplesmente nunca é lida enquanto a camada estiver ativa.

Estados vivos, `enumTable` e um passo de descanso que nomeia um `state` exigem Capability API 1.42 num conjunto empacotado.

### Trilhas de ferimentos: saúde marcada numa trilha

Muitos sistemas não contam pontos de vida. Têm uma coluna de casas, cada uma pior que a anterior, e você marca uma ao se ferir. Dê a uma entrada `live.tracks` os `kinds` e também `levels` nomeados ou `boxes` numeradas (abaixo) para que ela deixe de ser um número numa escala e vire uma dessas trilhas:

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
- Os dois andam juntos. `kinds` sem `levels` ou `boxes` é recusado porque não haveria onde marcar, e `levels` ou `boxes` sem `kinds` é recusado porque uma marca precisa ter um tipo. Uma trilha tem `levels` ou `boxes`, nunca os dois.
- **Separe os dois termos.** `kinds` define o que uma marca PODE SER. Uma MARCA é um desses tipos colocado na trilha durante a partida. A definição contém tipos; a ficha contém marcas.
- Uma trilha de ferimentos começa sem marcas, então seu `min` é 0. Uma trilha com níveis nomeados tem o comprimento dos seus níveis, então seu `max` é `levels.length`; qualquer outro valor é recusado em vez de corrigido, para que o arquivo nunca contenha dois comprimentos contraditórios. Uma trilha de casas tem o comprimento do próprio `max`, que pode ser um valor calculado pela ficha (veja Casas numeradas abaixo).

**As regras exatas**, porque uma leitura vaga produz a trilha errada:

- As marcas ficam ordenadas, **as mais graves primeiro**. Sete níveis comportam no máximo sete marcas.
- Uma marca é **inserida por ordem de gravidade**, nunca simplesmente no fim. Ocupa o nível mais alto que lhe cabe e empurra as leves para baixo.
- A penalidade ativa é a do **nível marcado mais baixo**, nunca a soma. Três marcas no exemplo dão `-3`, não `0 + -1 + -3`.
- `amount` é a quantidade de marcas de um tipo, **aplicadas uma por vez**. Uma trilha que enche no meio do processo segue a mesma regra de uma que já estava cheia.
- Marcar uma trilha **cheia** **aumenta um passo a gravidade da marca mais leve**, em vez de adicionar outra. Um passo na sua escala de tipos, qualquer que fosse o tipo da marca nova.
- Uma marca que passaria da gravidade máxima fica nela; a que não coube conta como **transbordamento**. Isso é salvo, para que recarregar não esqueça dano já recebido.
- **Curar usa o mesmo comando com quantidade negativa.** Limpa o transbordamento antes de qualquer marca. Uma cura que nomeia um dos tipos da trilha limpa só marcas desse tipo; assim, curar o dano contundente e deixar o letal é `kind="bashing"` com quantidade negativa. Uma cura que não nomeia nenhum tipo da trilha limpa primeiro as marcas mais leves.

**Marcar durante a partida.** O GM escreve `[sheet: op="damage" track="harm" kind="knock" amount="1"]` e cura com `amount` negativo. Numa trilha preenchida por casa, ele adiciona `box="3"` para indicar a casa que o golpe atinge. A forma de reserva de `damage`, que nomeia `pool=`, não muda. O comando comum `track` é recusado em trilhas de ferimentos: um número não identifica os tipos das novas marcas. O jogador também pode marcar e limpar casas manualmente na ficha, como esses sistemas esperam.

**Uma luta também pode marcá-la.** Aponte `combat.health` para a trilha em vez de uma reserva: um golpe acertado marca as casas indicadas por `combat.damageKinds.marks`, do tipo ao qual esse bloco mapeia seu tipo de dano. Um personagem com a trilha cheia está caído, o estado lido pela regra de morte. Numa trilha preenchida por casa, o dano `per-point` nomeia a casa que atinge e o `per-blow` mira a primeira, e um golpe que nenhuma casa pode receber derruba o personagem, que é o que ser posto fora de combate significa nos sistemas que usam esse tipo de trilha. Cura limpa uma marca, a mais leve, de qualquer tipo. Pontos temporários são recusados porque a trilha não tem um espaço para eles. O Engine lê a trilha como níveis RESTANTES; o restante da luta, cair, reviver, o registro e o resumo continuam iguais.

**Um descanso pode curar a trilha.** Uma restauração com `"to"` a reduz àquela quantidade de marcas, incluindo transbordamento; com um `"by"` NEGATIVO, limpa aquela quantidade, começando pelo transbordamento, então `"by": { "const": -2 }` limpa duas. Um passo que também nomeia um `kind` limpa só marcas desse tipo: o "Catch your breath" de Gravewatch é `{ "track": "harm", "kind": "knock", "to": "min" }`, que cura as pancadas e deixa os rasgos. Um passo que ADICIONARIA marcas não faz nada, porque um descanso não marca dano, e isso inclui um `"by"` positivo: ele é ignorado sem aviso, então escreva o sinal de menos.

#### Casas numeradas em vez de níveis nomeados

Quando uma trilha tem o comprimento da resistência do personagem, dê a ela `boxes` em vez de `levels`. Ela tem tantas casas quanto o próprio `max`, que pode ser um valor calculado pela ficha (nunca um que leia o estado vivo), até 64:

```json
{
  "id": "strain",
  "label": "Strain",
  "min": 0,
  "max": { "derived": "strain_boxes" },
  "boxes": {
    "penalty": {
      "by": "remaining",
      "table": [
        [0, -1],
        [1, 0]
      ]
    }
  },
  "kinds": [{ "id": "strain", "label": "S", "severity": 0 }],
  "fill": "indexed",
  "onFull": "refuse"
}
```

- A penalidade ativa é lida em `table` (uma tabela de patamares, como a de um valor derivado, com penalidades iguais ou inferiores a 0) no número de casas `filled` ou `remaining`, seja qual for esse número, então uma tabela pode custar algo sem nada marcado. Ela não depende de quais casas estão marcadas.
- As casas são numeradas: a ficha mostra "Box 3", e o bloco de ficha do GM diz quantas estão marcadas de quantas, em vez de nomear um nível.

#### Preencher por casa e trilhas que recusam

- `"fill": "indexed"` coloca uma marca na casa que o comando nomeia com `box=` (a primeira casa, quando não nomeia nenhuma) ou na próxima casa livre acima dela, e nunca move uma marca depois de colocada. Uma cura limpa a mais alta das marcas mais leves. A tela de ficha permite ao jogador clicar em qualquer casa livre.
- `"onFull": "refuse"` recusa uma marca que não tem casa livre, em vez de aumentar a gravidade da marca mais leve. O comando inteiro é recusado, então três marcas com duas casas livres não colocam nenhuma. Uma trilha indexada sempre recusa; declare isso com `"onFull": "refuse"` ao lado.

#### Níveis que uma lista adiciona

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` numa trilha com níveis nomeados permite que uma lista da ficha a alongue por personagem. Cada linha, em ordem, adiciona sua quantidade de níveis (no máximo 16) com sua penalidade, depois do último nível cuja penalidade seja pelo menos tão boa, com o nome desse nível quando as penalidades coincidem e com o da penalidade caso contrário. As cicatrizes de Gravewatch funcionam assim. Uma lista que a ficha oculta não adiciona nada e, se uma linha for excluída enquanto seus níveis estão marcados, as marcas que não cabem mais ficam como transbordamento: editar a ficha não desfaz dano.

`boxes`, `fill`, `onFull`, `extra` e o `kind` de um passo de descanso exigem Capability API 1.40 num conjunto empacotado.

### A penalidade nas rolagens

`resolution.penaltyFrom` nomeia a trilha de ferimentos cuja penalidade afeta todo teste do conjunto. É declarada, não presumida: sem ela, as rolagens continuam como antes da existência das trilhas.

O EFEITO da penalidade depende do tipo de resolução, assim como o número da ficha:

- Em `dice-pool`, ela **retira dados da reserva**, sem baixar de `pool.min`. Um `pool.min` de 1 permite rolar um dado mesmo no último patamar; um `pool.min` de 0 permite não rolar nenhum e falhar sem lançamento.
- Em `dice-sum`, é um **modificador fixo na rolagem**, incorporado ao mesmo número ao qual atributo e treinamento já contribuem.

Ela precisa nomear uma trilha de ferimentos. Uma trilha comum não tem penalidade e é recusada na importação. O resultado indica a penalidade aplicada para explicar ao jogador seus dados a menos; o bloco de ficha do GM também mostra o patamar e seu custo.

### Modificadores da ficha

Alguns números da ficha acompanham toda rolagem que afetam: uma mochila pesada em toda escalada, uma penalidade de armadura em toda tentativa de furtividade, uma bênção em tudo. `resolution.adjust` declara isso, nos dois tipos:

```json
"adjust": [{ "value": { "derived": "burdened" }, "abilities": ["brawn"] }]
```

- `value` é um valor da ficha, na mesma forma que um valor derivado lê, incluindo o estado vivo. Um número negativo subtrai. Ember Roads soma o volume do equipamento que o personagem leva na mochila num Burden, e uma tabela de patamares transforma cada três pontos disso em um a menos em cada rolagem de Brawn. Uma tabela baseada num estado vivo é como uma forma ou uma postura chega aos dados (veja Estados vivos).
- `abilities` é opcional. Com ele, o modificador só se aplica a um teste rolado com um desses atributos: o próprio atributo, uma perícia ou salvaguarda que o usa, uma perícia rolada com ele por `with=` ou um par de atributos que o inclui. Sem ele, aplica-se a todo teste.
- É aplicado onde a penalidade de ferimentos é aplicada: dados numa reserva, sob o mesmo piso `pool.min`, e um número fixo numa soma, dentro do modificador que o registro soma. Até oito entradas, somadas em cada teste.
- Uma luta do conjunto o soma a toda rolagem que monta a partir de uma ficha, quando a luta começa: um ataque rolado com um atributo ou perícia, uma salvaguarda, um teste de disputa e a iniciativa lidos de um atributo, perícia ou salvaguarda recebem as entradas daquele atributo, e qualquer outra rolagem recebe só as entradas que valem para toda rolagem.
- Um personagem sem ficha não recebe nada disso, assim como não recebe modificador.

O resultado informa o que a ficha adicionou (`adjust="-2"` no registro e uma linha no cartão de dados), para que o jogador veja por que a rolagem saiu assim. Exige Capability API 1.38 num conjunto empacotado.

### Descansos

Um descanso lista restaurações e elementos a limpar. Cada passo nomeia um alvo (`pool`, `poolGroup`, `listPools`, `track` ou `state`) e o define (`"to": "max"`, `"to": "min"` ou um número) ou modifica (`"by": { "const": 1 }` ou `"by": { "fractionOfMax": 0.5 }`). Se nomeia uma trilha de ferimentos, só pode curá-la, então seu `by` é negativo; veja acima. Se nomeia um estado vivo, só pode defini-lo, como `"default"` ou um dos seus valores. Um passo `poolGroup` com `fractionOfMax` muda cada reserva do grupo pela própria fração; acrescente `"shared": true` (Capability API 1.77) para calcular a fração sobre o máximo do grupo inteiro e distribuí-la entre as reservas do grupo na ordem em que a ficha as lista, cada uma até o que lhe falta. O descanso longo de 5e, "metade do número total de" dados de vida do personagem, guardados numa reserva por tipo de dado, é `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

### Texto do Game Master

- `checkGuidance` substitui o parágrafo integrado que ensina a pedir um teste. Informe o sistema e quando rolar. O GM só nomeia perícia e dificuldade. O Engine rola e calcula a partir da ficha: não peça matemática ao modelo.
- `sheetGuidance` apresenta as fichas no prompt. Explique quais recursos importam e quando gastá-los.
- `worldGuidance` é opcional e lido uma vez ao gerar o mundo, para adequar a ambientação às regras: sem pólvora, magia rara, mortos que andam. Nunca chega a um turno.
- `sheetSummary` escolhe campos, valores derivados e linhas de listas que o GM vê por personagem. O Engine sempre mostra modificadores de atributo, perícias e salvaguardas treinadas e valores vivos. Mantenha o restante curto, pois é enviado a cada turno. O `nameColumn` de uma lista do resumo pode ser uma coluna de texto ou enum (um enum mostra o rótulo do seu valor), e `columns` nomeia até mais três colunas da própria linha para imprimir depois do nome, de modo que o bloco diga `Gear: Crowbar 1d6` em vez de mostrar só nomes. Uma coluna booleana imprime seu rótulo quando está ativada. Ambos exigem Capability API 1.37 num conjunto empacotado.
- Você não precisa ensinar o comando de ficha em `sheetGuidance`. O Engine ensina cada comando sozinho, com os nomes que seu arquivo declara, e, quando seu conjunto tem uma trilha de ferimentos, adiciona o comando `op="damage"` para marcá-la e lista seus níveis e tipos de dano. Quando ele tem estados vivos, adiciona o comando `op="state"` e lista os valores que cada um pode assumir.

### Referência completa de regras para o GM (Capability API 1.145)

O `gmReference` opcional, no **nível superior** do arquivo, contém a referência completa de regras do conjunto para o Game Master, com até 16.000 caracteres. Coloque aqui as regras detalhadas de arbitragem e mantenha as instruções curtas de testes e recursos em `gm.checkGuidance` e `gm.sheetGuidance`. Esses campos, e `gm.worldGuidance`, continuam com seus limites de 1.500 caracteres; as orientações das camadas também mantêm seus limites atuais.

```json
"gmReference": "When a journey crosses hostile country, judge supplies, shelter and exposure before the next leg. A failed navigation check costs time rather than silently moving the party to its destination."
```

A referência aparece sob **Game Master rules reference** (referência de regras do Game Master) no prompt de sistema estável, uma vez por requisição. Ela nunca é copiada para o lembrete de cada turno. Como qualquer outro texto seguro para prompt, precisa ter uma única linha, sem caracteres de controle, colchetes nem chaves de macro (`{{` e `}}`). Quando a requisição ainda passa do limite de contexto depois dos ajustes habituais no histórico e no orçamento da resposta, a referência é encurtada com um corte marcado antes que as instruções principais sejam cortadas. Deixe-a sem definir para manter os prompts atuais. Um pacote que a use precisa declarar no manifesto `schemaVersion: 2` e `capabilityApi: { "major": 1, "minor": 145 }` ou mais recente.

## Relógios de progresso do grupo e da cena (`clocks`)

A Capability API **1.143** acrescenta um objeto `clocks` opcional no nível superior. Omita-o para manter os comandos de relógio desativados. O objeto é estrito: só estas três chaves são aceitas.

```json
"clocks": {
  "sizes": [4, 6, 8],
  "max": 8,
  "text": "Create clocks for looming threats and long projects. Tick them when the fiction advances."
}
```

`sizes` permite de uma a seis quantidades de segmentos inteiras e distintas, cada uma de 2 a 12; o padrão é `[4, 6, 8]`. `max` é o número máximo de relógios mantidos ao mesmo tempo, de 1 a 12, com padrão 8. O `text` opcional é uma linha segura para prompt, de até 400 caracteres, que explica quando o GM deve criar e avançar relógios. Um objeto vazio ativa os padrões.

Os relógios pertencem ao grupo e à cena, não a um personagem. O lembrete do GM lista os nomes e o preenchimento deles a cada turno e ensina estes comandos:

- `[clock: name="Alarm raised" size="6"]` cria um relógio vazio. Um tamanho não permitido, um nome que já existe (sem distinguir maiúsculas) ou ter chegado a `max` recusam a criação.
- `[clock: name="Alarm raised" tick="2"]` acrescenta segmentos. Avanços negativos os retiram; o preenchimento fica limitado a `0..size`. Um relógio cheio está concluído, continua visível e conta para `max` até ser removido. Um avanço negativo pode reabri-lo.
- `[clock: name="Alarm raised" clear]` remove o relógio nomeado.

Os nomes são linhas únicas de 1 a 100 caracteres, sem aspas duplas, colchetes, caracteres de controle nem chaves de macro. Cada tag pede exatamente uma ação. Os comandos se aplicam na ordem da resposta, então um relógio pode ser criado e avançado na mesma resposta. O Engine reescreve cada tag com `result="ok" now="4/6"` (ou `now="cleared"`), ou com `result="refused" reason="..."`. Atributos de resultado fornecidos pelo modelo são descartados. Relógios desconhecidos e pedidos malformados são recusados; no máximo 40 comandos se aplicam por resposta.

Game Mode mostra um círculo segmentado, o nome e o preenchimento ao lado do status do grupo. As tags ficam na resposta salva como comprovantes e são ocultadas da narração. Os relógios são guardados em cada instantâneo do estado da partida como `rulesetClocks`; dados ausentes significam nenhum relógio. Regenerar parte do instantâneo anterior, continuar parte do atual, e selecionar ou remover swipes/mensagens restaura os relógios junto com o resto daquele instantâneo.

## Ficha do grupo: um bando, uma nave ou Story Points compartilhados

A Capability API **1.144** acrescenta um `party` opcional no nível superior, ao lado de `sheet`. Ele contém uma ficha compartilhada por partida, como o bando de Blades, a nave de Lasers & Feelings ou os Story Points de Genesys:

```json
"party": {
  "label": "Crew",
  "fields": [
    { "id": "heat", "label": "Heat", "type": "number", "min": 0, "max": 9, "default": 0 },
    { "id": "vault", "label": "Vault capacity", "type": "number", "min": 0, "max": 16, "default": 8 },
    { "id": "upgrades", "label": "Upgrades", "type": "text", "maxLength": 400 }
  ],
  "pools": [{ "id": "coin", "label": "Coin", "max": { "field": "vault" }, "start": "empty" }],
  "advancement": { "fields": ["heat", "vault", "upgrades"], "text": "Record heat after a score." },
  "text": "Coin belongs to the crew."
}
```

`fields` usa o mesmo esquema de campo de `sheet.fields`; `pools` usa o de `sheet.live.pools`, inclusive `start`, `group`, `hideWhen` e `allowTemp`. É preciso pelo menos um campo ou uma reserva, e seus IDs precisam ser únicos dentro da ficha do grupo. IDs de personagem e do grupo podem coincidir. Nesta versão, fichas do grupo não têm seções, listas, atributos, valores derivados nem migrações de ficha de personagem. O `max` de uma reserva lê uma constante ou um campo numérico do grupo. Fórmulas de personagem não podem ler valores do grupo, e fórmulas do grupo não podem ler valores de personagem. `hideWhen` também só nomeia campos do grupo.

`advancement.fields` nomeia campos number, text ou longtext que o GM pode mudar de forma permanente. `advancement.text` e `text` aceitam, cada um, uma linha segura para prompt de no máximo 400 caracteres. O `summary` opcional reaproveita `gm.sheetSummary`: seus `fields` escolhem campos do grupo; `derived` e `lists` precisam ficar vazios. Sem resumo, todos os campos visíveis do grupo são mostrados. As reservas sempre aparecem.

```text
[sheet: sheet="party" op="restore" pool="coin" amount="3"]
[sheet: sheet="party" op="spend" pool="coin" amount="2"]
[sheet: sheet="party" op="advance" field="heat" by="2"]
[sheet: sheet="party" op="advance" field="upgrades" to="Hidden vault"]
```

`sheet="party"` escolhe a ficha compartilhada; deixe `who` de fora. O `who="party"` existente continua se aplicando a cada **personagem** e nunca muda a ficha compartilhada. Esta versão permite `spend`, `restore` e o `advance` de um campo na ficha do grupo. Fichas desconhecidas, operações sem suporte, reservas insuficientes, avanços não declarados e valores inválidos são recusados e reescritos com o resultado do Engine. As reservas do grupo seguem a mesma aritmética de valor atual e máximo e os mesmos padrões das reservas de personagem.

O GM recebe o rótulo, os campos e as reservas do grupo ao lado dos blocos de ficha dos personagens a cada turno. Game Mode oferece uma ficha do grupo recolhível e somente leitura ao lado dos retratos dos personagens, com a mesma apresentação de ficha. Os valores permanentes ficam uma única vez nos metadados do chat (`gamePartySheet`), ao lado de `gameCharacterCards`, e compartilham os comprovantes de avanço. As reservas vivas usam a entrada reservada `$party` de `rulesetLive`; nomes de personagem normalizados não podem colidir com ela. Regenerar parte de antes da resposta, e selecionar ou excluir um swipe restaura os valores permanentes e os vivos pelo histórico existente. Conjuntos sem `party` mantêm o comportamento atual.

**Criação compartilhada do grupo (Capability API 1.163).** Uma ficha do grupo pode ter `lists` (até 12, escritas como as listas da ficha de personagem), um `builder` guiado próprio e `fromMembers`: até 8 campos numéricos do grupo lidos dos personagens do grupo, cada um `{ "field", "count": true }` (quantos personagens há) ou `{ "field", "sum": "<character number field>" }` (quanto os deles somam, como os pontos de Totem). Os campos de membros são calculados a partir dos personagens como estiverem sempre que a ficha compartilhada é lida, então um personagem que entra ou sai os muda na hora. Com listas, o `summary.lists` do grupo pode nomeá-las.

O construtor é escrito exatamente como o de um personagem (reservas, etapas, linhas com preço, ofertas de gasto, perfis) e segue as mesmas regras, aplicadas aos campos e às listas do próprio grupo. Suas etapas de catálogo e de cópia de linhas podem ler os catálogos do conjunto que alimentam listas do grupo. Em Game Mode, qualquer jogador abre o Edit da ficha compartilhada, que oferece a configuração guiada, e a salva para o grupo inteiro. Cada salvamento nomeia a revisão em que foi aberto (`gamePartySheetRevision` nos metadados do chat, aumentada a cada salvamento e pelas mudanças da própria história): um salvamento aberto antes de o de outra pessoa entrar é recusado, a ficha mais nova é mostrada, e o rascunho do jogador continua aberto, então salvar de novo é escolha dele para substituí-la.

```json
"party": {
  "label": "The Crew",
  "fields": [
    { "id": "tier", "label": "Tier", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "size", "label": "Crew size", "type": "number", "min": 0, "max": 12, "default": 0 }
  ],
  "lists": [{ "id": "upgrades", "label": "Upgrades", "columns": [{ "id": "name", "label": "Name", "type": "text" }] }],
  "builder": { "steps": [{ "id": "upgrades", "label": "Upgrades", "kind": "rows", "list": "upgrades" }] },
  "fromMembers": [{ "field": "size", "count": true }]
}
```

## Catálogos: entradas prontas para as listas da ficha

Digitar uma lista de magias, tabela de equipamento ou página de características linha por linha é cansativo. Um catálogo é uma coleção nomeada de entradas prontas distribuída com o conjunto. O editor as oferece num seletor em cada lista alimentada pelo catálogo; escolher uma preenche a linha.

Catálogos são opcionais. Um conjunto pode ter até doze; o Engine não conhece o assunto deles: cada ID, coluna, filtro e palavra vem do arquivo.

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
- `holds`: `"rows"` (padrão, usado por todos os catálogos anteriores a esta versão), `"creatures"` ou `"items"`. Um catálogo de criaturas é um bestiário lido pela luta, e um catálogo de itens lista o que um grupo carrega. Nenhum dos dois escreve em fichas, declara `feeds` ou aparece no seletor. Veja [Criaturas](#creatures-a-bestiary-a-fight-reads) e [Itens](#items-what-a-party-carries) abaixo.
- `feeds`: de uma a oito listas da ficha onde as entradas podem escrever. Obrigatório num catálogo de linhas e recusado num catálogo de criaturas ou de itens. Uma entrada não pode escrever em outra lista nem colocar um valor que suas colunas não aceitam.
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
- Uma linha com `scaled` deve ser a única da entrada para aquela lista; assim, uma linha marcada sempre corresponde a uma única especificação. Ou então (Capability API 1.92) toda linha que a entrada escreve nessa lista precisa ter o próprio nome na coluna de nome da lista (o `nameColumn` das suas reservas ou, sem ele, sua primeira coluna de texto). A linha da ficha passa a corresponder à sua especificação por esse nome, então uma característica pode dar dois usos que crescem cada um por conta própria; uma linha que o jogador renomeia fica intacta.

O valor é calculado ao editar, nunca ao ler: uma linha salva sempre contém o número que declara. Ele é ajustado à coluna: limitado entre `min` e `max` e arredondado para baixo quando a coluna usa inteiros. No exemplo, Heart 3 dá três usos; Heart 0 ou menos não dá nenhum. A linha permanece com 0 usos; como um contador com máximo 0 não é uma reserva, não há nada para gastar em jogo.

Colunas escaladas exigem Capability API 1.23 para conjuntos empacotados. Um conjunto comunitário importado é validado pelo Engine que o lê, sem precisar de mais nada.

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

Uma entrada pode conter um bloco `mechanics` opcional para expressar efeitos numéricos: `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (dados como `2d6` ou número fixo), `amountAdd` (um valor lido da ficha de quem usa e somado à quantidade, como `{ "field": "level_fighter" }` para um Second Wind de 1d10 mais o nível de guerreiro; exige um `amount`, só é lido nas lutas do próprio conjunto (as lutas Classic e Tactical do Engine usam a quantidade como está escrita) e exige Capability API 1.83), `damageType`, `attackRoll`, `autoHit`, `save` (uma salvaguarda da ficha e o efeito do sucesso), `applies` (condições aplicadas), `temporary` (pontos temporários de saúde), `scales` (quantidade que cresce com a ficha), `cost` (reserva gasta), `perCostStep`, `targetsPerCostStep`, `budget` (parte da economia de ações gasta), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` e `check`.

Um ataque que mira inimigos pode deixar algo para golpear em turnos posteriores com `summons` (Capability API 1.122). Para Spiritual Weapon, coloque `"summons": { "budget": "bonus", "rounds": 10, "move": 20, "reach": 5 }` na entrada de ataque. A conjuração faz o primeiro ataque e deixa a arma ao lado do primeiro alvo assim que as reações terminam; uma conjuração cancelada não deixa nada. Os golpes seguintes gastam só o orçamento declarado da economia, mantêm o nível de pagamento da conjuração para a escala do dano e abrem as mesmas janelas de reação. As distâncias usam a unidade do catálogo; movimento omitido é zero, e alcance omitido é uma célula. Num tabuleiro, a arma pode golpear um inimigo dentro do movimento mais o alcance, ignorando paredes, e se move para o lado dele. Sem tabuleiro, qualquer inimigo de pé está ao alcance. As rodadas diminuem ao fim dos turnos de quem a mantém, sem contar o turno da conjuração. A invocação termina em zero, quando quem a mantém é derrotado ou quando a concentração da sua entrada termina. Conjurar de novo a mesma entrada substitui a invocação.

Uma entrada com `area` pode permanecer com `zone` (Capability API 1.172): `{ "rounds", "anchor", "triggers", "atCast" }`. Ela dura `rounds` (de 1 a 1000) turnos do conjurador, contados como os de uma invocação, e termina antes se a concentração que a mantém terminar ou se o conjurador for derrotado. `anchor: "point"` (o padrão) mantém as células em que foi conjurada; `anchor: "caster"` é uma explosão ao redor do conjurador que vai aonde ele for, então seu alcance é 0. `triggers` diz quando ela aplica de novo o efeito da própria entrada (quantidade, plus, salvaguarda, applies) a uma criatura: `enter` (a criatura se move para dentro dela, ou uma zona levada pelo conjurador a alcança), `turn-start` ou `turn-end` (a criatura começa ou termina o turno dentro dela). Uma criatura é pega uma vez por turno, seja qual for o gatilho, e quem a própria conjuração pegou conta como pego naquele turno. Quem ela pega segue a entrada: `friendlyFire: false` deixa de fora o lado do conjurador, uma cura ou uma entrada aliada se limita a ele, e uma zona levada pelo conjurador nunca o pega. `atCast: false` não faz nada quando ela aparece. Conjurar a entrada de novo substitui a zona. O tabuleiro colore as células dela, a luta a lista com os turnos que lhe restam, e o registro diz cada criatura pega. Fora de um tabuleiro, ela mantém quem estava no alvo da conjuração, e `turn-start` e `turn-end` pegam essas criaturas.

```json
"mechanics": { "kind": "attack", "area": { "shape": "burst", "size": 20 }, "range": 120,
  "amount": { "dice": "5d8" }, "damageType": "poison", "save": { "save": "con_save", "onSuccess": "half" },
  "concentration": true, "zone": { "rounds": 100, "triggers": ["enter", "turn-start"] } }
```

Isso é Cloudkill. Spirit Guardians é `"area": { "shape": "burst", "size": 15 }, "range": 0, "friendlyFire": false` com `"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false }`; Moonbeam é uma explosão de 5 pés com `"triggers": ["enter", "turn-start"]`.

Uma zona mantida num ponto pode se mover e mudar o terreno (Capability API 1.173). `move: { "budget", "distance" }` permite ao conjurador movê-la no seu turno: a luta oferece "Move <zone>" para esse orçamento, escolhido no tabuleiro como uma caminhada, para qualquer célula a até `distance` do centro dela. `drift: { "distance" }` a afasta essa distância em linha reta do conjurador no início de cada turno dele, parando na borda do tabuleiro. De um jeito ou de outro, quem ela passa a cobrir e não cobria antes é pego como `enter` diz. Só uma explosão mantida num ponto se move ou deriva. `terrain: { "difficult": true }` faz cada célula dela custar o dobro para entrar a quem ela pega (um terreno que já é difícil não dobra de novo), e `terrain: { "perDistance": { "every", "amount", "damageType" } }` causa `amount` (dados e valor fixo, como na própria entrada) a quem ela pega a cada `every` que a pessoa anda dentro dela, sem salvaguarda, contando entre caminhadas. O registro diz cada movimento, deriva e ferimento.

```json
{
  "id": "moonbeam",
  "name": "Moonbeam",
  "mechanics": {
    "kind": "attack",
    "range": 120,
    "area": { "shape": "burst", "size": 5 },
    "amount": { "dice": "2d10" },
    "damageType": "radiant",
    "save": { "save": "con_save", "onSuccess": "half" },
    "concentration": true,
    "zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "move": { "budget": "action", "distance": 60 } }
  }
}
```

Cloudkill acrescenta `"drift": { "distance": 10 }`. Spike Growth é uma explosão de 20 pés sem quantidade própria, `"triggers": []` (o terreno é tudo o que ela faz), `"atCast": false` e `"terrain": { "difficult": true, "perDistance": { "every": 5, "amount": { "dice": "2d4" }, "damageType": "piercing" } }`.

Uma zona pode fazer mais a quem pega (Capability API 1.174). `breaksConcentration: true` faz uma criatura que ela pega enquanto se concentra rolar a salvaguarda de concentração do conjunto contra a dificuldade de salvaguarda da própria entrada, antes do efeito da entrada, e perder a concentração numa falha; a entrada precisa de um `save`. `damageCap` encerra a zona quando ela tiver causado, no total, esse dano desde que apareceu, contando as criaturas pegas e o terreno. Sleet Storm é uma explosão de 40 pés com `"save": { "save": "dex" }`, `"applies": [{ "condition": "prone", "duration": "instant" }]` e `"zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "breaksConcentration": true, "terrain": { "difficult": true } }`. Guardian of Faith é uma explosão com `"friendlyFire": false`, `"amount": { "flat": 20 }` e `"zone": { "rounds": 1000, "triggers": ["enter", "turn-start"], "atCast": false, "damageCap": 60 }`.

A dificuldade contra a qual se escapa de uma condição aplicada por uma entrada pode ser a dificuldade de salvaguarda da própria entrada (1.174): `"escapeDc": "save"` na entrada de `applies`, ao lado de uma disputa cujo `from.holding` seja essa condição. Web e Black Tentacles impõem restrained com `{ "condition": "restrained", "duration": "until-save", "escapeDc": "save" }`, e a disputa de fuga da criatura restringida é rolada contra a CD de salvaguarda de magia do conjurador. Qualquer coisa que a tenha aplicado sem dificuldade de salvaguarda deixa a fuga como a disputa diz, contra quem a impôs.

O `use` de um item também pode ter `concentration` e `zone` (1.174), como uma entrada de catálogo, então um pergaminho de Cloudkill ou de Moonbeam mantém a área duradoura e é sustentado pela concentração de quem o lê.

Uma zona movida pode abalroar, e seu terreno pode custar mais (Capability API 1.175). `move: { ..., "ram": true }` a envia uma célula de cada vez em linha reta até onde foi movida; na primeira célula em que alcança alguém que não cobria antes, ela para, pega essa pessoa como se a tivesse abalroado (digam o que disserem seus gatilhos) e não pode ser movida de novo naquele turno. Criaturas que entram nela só são pegas como seus gatilhos dizem. Flaming Sphere é uma explosão de 5 pés com `"triggers": ["turn-end"]` e `"move": { "budget": "bonus", "distance": 30, "ram": true }`. `terrain.costTimes` (de 2 a 10) faz cada passo para dentro dela custar essa quantidade de passos comuns, e um terreno que já é difícil não custa mais que isso: Plant Growth é `"terrain": { "costTimes": 4 }`. Ele substitui `difficult`, que equivale a `costTimes: 2`. `terrain.halvesSpeed: true` faz cada passo dentro dela custar o dobro de novo, além de qualquer terreno difícil: Spirit Guardians é `"terrain": { "halvesSpeed": true }`.

Imobilizações impostas por uma magia só podem ser quebradas como a magia diz (também 1.175). Uma disputa de se soltar com `"from": { "holding": "restrained", "escapable": true }` só é oferecida contra uma imobilização que nomeia um `escapeDc`, então a mesma disputa quebra uma teia e nunca uma petrificação. `applies[].escapeChecks` nomeia os testes de disputa que podem quebrar essa imobilização, no lugar dos testes de atacante da própria disputa: Black Tentacles impõe restrained com `"escapeDc": "save", "escapeChecks": ["might", "agility"]`, e Web com `"escapeChecks": ["might"]`. `zone.whileHeld: { "condition", "amount", "damageType" }` causa sua quantidade, sem salvaguarda e no lugar do efeito da própria zona, a quem começa um turno dentro dela já preso por essa condição vinda do conjurador: o `"whileHeld": { "condition": "restrained", "amount": { "dice": "3d6" }, "damageType": "bludgeoning" }` de Black Tentacles.

Uma entrada ou o uso de um item pode curar condições (Capability API 1.176). `ends: { "conditions": [...], "count"? }` tira essas condições do alvo na ordem nomeada, no máximo `count` delas: Lesser Restoration é `"ends": { "conditions": ["blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. `stabilizes: true` estabiliza um alvo que está morrendo, que não rola mais salvaguardas contra a morte, e exige um bloco de combate com uma regra `dying`: Spare the Dying. `revives: { "withinRounds", "health" }` só mira alguém que morreu há no máximo essa quantidade de rodadas e o traz de volta com essa quantidade: Revivify é `"revives": { "withinRounds": 10, "health": { "flat": 1 } }`. Uma entrada que só encerra condições ou estabiliza só é oferecida contra alguém que ela ajudaria; uma do tipo `utility` sem mais nada a fazer é oferecida enquanto curar.

Áreas podem ser quadradas, e as duradouras podem ser muralhas (Capability API 1.177). `area.shape: "box"` é um quadrado de `size` de lado cujo canto mais próximo fica na célula visada, estendendo-se para longe de quem o cria; num eixo em que quem o cria está alinhado, ele fica centrado nessa célula. Sem `range`, ele fica encostado em quem o cria. Web é `"area": { "shape": "box", "size": 20 }` com alcance de 60. `area.shape: "wall"` sempre permanece, então exige uma `zone`: tem `size` de comprimento e `width` de espessura (uma célula sem isso), passando pela célula visada atravessada em relação à linha de quem a cria, ou dali em direção à célula `toward` da escolha; `"ring": <diameter>` permite ao conjurador erguê-la como um anel dessa largura ao redor da célula visada, quando a escolha diz `"ring": true`. Uma muralha não precisa de gatilho: Wind Wall só aplica seu efeito quando aparece. Uma muralha nunca é movida, não deriva nem segue quem a criou. `zone.blocks: ["move", "sight"]` fecha suas células à passagem, à visão ou às duas enquanto ela estiver de pé, e quem está onde ela surge é colocado na célula livre mais próxima (no lado escolhido, quando houver uma tão próxima quanto): Wall of Stone bloqueia as duas coisas, Wall of Force o movimento, Wall of Fire a visão. `zone.side: { "distance", "triggers" }` faz as células a até `distance` de um dos lados pegarem criaturas como seus próprios `triggers` dizem, além das células da própria muralha; o `side` da escolha diz qual, `near` (perto de quem a criou, dentro de um anel) ou `far` (longe, fora dele), e é o lado longe quando omitido. Wall of Fire é `"area": { "shape": "wall", "size": 60, "ring": 20 }`, `"zone": { "rounds": 10, "triggers": ["enter", "turn-end"], "blocks": ["sight"], "side": { "distance": 10, "triggers": ["turn-end"] } }`.

Enxergar importa (Capability API 1.178). `combat.senses` lista os sentidos que veem onde os olhos não veem, cada um `{ "id", "label", "sheet"?, "blind"? }`: o alcance de um personagem é lido da ficha por `sheet` (nenhum em zero), uma criatura leva o próprio como `"senses": { "darkvision": 60 }` na distância do conjunto, e um sentido `blind` (percepção às cegas, sentido sísmico) funciona sem olhos. O bloco passa a exigir `combat.distance`. Uma zona com `obscures` esconde tudo o que está nela, e tudo o que é visto através dela, de quem não tem, dentro do alcance, nenhum dos sentidos que seu `pierced` lista: Fog Cloud é `"obscures": {}`, Darkness é `"obscures": { "pierced": ["blindsight", "truesight"] }`. Uma zona assim não precisa de gatilho, e uma entrada `utility` que só deixa uma área de pé (Fog Cloud, Darkness, uma muralha) fica no menu, colocada onde o conjurador escolher. Uma entrada de `combat.conditions` com `unseen` esconde quem a porta da mesma forma: invisível é `"unseen": { "pierced": ["blindsight", "truesight"] }`. `combat.sight` diz o que isso faz: `unseenAttacks: true` dá vantagem a um ataque quando o alvo não consegue ver o atacante e desvantagem quando o atacante não consegue ver o alvo, e `eyes` nomeia o sentido (como o `lacks` de uma condição o nomeia) que é a visão, então uma criatura cega só vê por um sentido `blind`. Uma entrada ou ação de criatura com `seen: true` só pode escolher alvos que quem a usa consegue ver, como diz "uma criatura que você possa ver dentro do alcance". Uma explosão ou um quadrado pode ser colocado várias vezes de uma vez com `area.copies` (de 2 a 10), cada cópia encostada em outra, e o jogador posiciona cada uma: Fire Storm é `"area": { "shape": "box", "size": 10, "copies": 10 }`. Uma zona colocada várias vezes fica onde foi conjurada.

Zonas podem agir sobre quem está nelas (Capability API 1.179). `combat.components` nomeia o que usar algo pode exigir, cada um `{ "id", "label" }` (os componentes verbal, somático e material de 5e), e uma entrada ou ação de criatura lista os seus em `components`. O `inside` de uma zona impõe `conditions` a quem está nela e afasta dessas pessoas os tipos de dano de `immune` enquanto elas permanecem ali; seu `forbids: { "components": [...] }` impede que qualquer coisa que precise deles seja usada lá dentro, como o `forbids` de uma condição faz com quem a porta (amordaçado). Silence é `"inside": { "conditions": ["deafened"], "immune": ["thunder"] }, "forbids": { "components": ["verbal"] }`. O `wards: { "catalogs": [...], "maxLevel": N }` de uma zona protege quem está dentro de qualquer coisa desses catálogos usada de fora no nível N ou menor, avaliada pelo nível em que foi paga: Globe of Invulnerability é `"wards": { "catalogs": ["spells"], "maxLevel": 5 }`. Uma condição que retira orçamentos (`budgets` com `flat` negativo), imposta durante o próprio turno de quem a porta, também os retira desse turno, então a salvaguarda falhada contra Stinking Cloud no início do turno custa a ação desse turno.

Sentidos e visão vão além (Capability API 1.180). Uma condição que uma entrada aplica pode terminar quando quem a porta age: `"endsWhenHolder": { "attacks": true, "casts": ["spells"] }` a remove assim que a pessoa faz um ataque ou usa uma entrada de um catálogo que ela nomeia, e o uso de um item que diz `"casts": "spells"` (um pergaminho, uma varinha) conta como conjurar desse catálogo. O ataque ou a magia que a encerrou ainda contou com ela, então Invisibility dá vantagem a esse único ataque e some depois. O que uma zona de pé faz por conta própria não é uma ação do conjurador. Uma condição em `combat.conditions`, ou o efeito `worn` ou `carried` de um item, pode dar sentidos com alcance na distância do conjunto, `"senses": { "darkvision": 60 }`; o maior entre esse e o alcance próprio de quem a porta vale enquanto ela durar, então a magia Darkvision, True Seeing (`{ "truesight": 120 }`) e os goggles of night funcionam. Uma condição com `"cancelsUnseen": true` deixa todos verem quem a porta, seja qual for a condição que o esconde, como Faerie Fire contorna o invisível; zonas que obscurecem e muralhas ainda o escondem.

Proteções, salvaguardas, conjuração de monstros e pergaminhos vão além (Capability API 1.181). O `wards` de uma zona compara o nível em que uma magia foi paga, a menos que diga `"by": "base"`, que compara o próprio nível da magia, seja como for que tenha sido paga, como faz Globe of Invulnerability. `"maxLevelPerCostStep": 1` barra um nível a mais para cada passo em que a conjuração da própria proteção foi paga acima da base. O `save` de uma entrada ou ação de criatura pode dizer contra o que mais ele conta, `"against": { "damage": ["poison"] }`, para que um modificador de salvaguarda `against` veneno se aplique a ele, e quem tem sucesso sem rolar: `"succeeds": { "immune": ["poison"], "conditionImmune": ["poisoned"], "is": { "tags": ["nonbreathing"] } }` (basta um), como Stinking Cloud exige. O `spellcasting` de uma criatura pode dizer do que suas magias precisam no lugar dos `components` de cada entrada, para o traço inteiro ou por magia, com `[]` para uma conjuração inata que não precisa de nenhum, para que Silence não a impeça. O uso de um item pode ser `"kind": "utility"` quando tudo o que ele faz é deixar uma área de pé (um pergaminho de Fog Cloud, Darkness, Silence ou Globe of Invulnerability); ele exige uma `area` e uma `zone`.

Empurrões, ventos e óculos (Capability API 1.182). O `"push": 15` de uma entrada empurra quem ela atinge e não passa na salvaguarda 15 unidades da distância do catálogo, em linha reta para longe de quem a usou, parando diante de qualquer coisa sólida ou de alguém de pé; uma zona empurra quem pega da mesma forma. Uma zona mantida pelo conjurador (`"anchor": "caster"`) agora pode ser uma linha ou um cone, além de uma explosão: ela aponta para onde foi conjurada e vai aonde o conjurador for, e `"turn": { "budget": "bonus" }` permite a ele gastar esse orçamento no seu turno para virá-la para outro lado, pegando quem ela passar a cobrir como se a pessoa tivesse entrado nela (Gust of Wind de 5e). O `terrain` de uma zona com `"towardCaster": true` faz seu terreno difícil contar só para um passo que aproxima do conjurador quem se move. Um sentido que uma condição ou um item dá pode ser `{ "add": 60 }` em vez de um alcance, o que soma ao alcance próprio de quem o porta para esse sentido, ou dá 60 a quem não tem nenhum (os goggles of night de 5e).

Zonas que explodem depois ou queimam (Capability API 1.183). Uma zona com `"detonates"` não faz nada enquanto está de pé nem quando é conjurada: quando termina, porque a concentração acabou, as rodadas se esgotaram ou ela foi conjurada de novo, ela aplica uma vez o efeito da própria entrada a todos que estão nela. `"grows": { "dice": "1d6" }` soma isso à quantidade dela no fim de cada turno do conjurador, inclusive o turno em que foi conjurada, então ela rola os mesmos dados da quantidade da própria entrada; `"touched": true` faz quem se move para o centro dela rolar a salvaguarda da entrada e a detona quando a pessoa falha (Delayed Blast Fireball de 5e). Ela fica onde foi conjurada. Uma zona com `"burns": { "by": ["fire"], "amount": { "dice": "2d4" }, "damageType": "fire" }` pega fogo quando dano de um desses tipos atinge qualquer célula dela ou alguém dentro dela; ela queima por completo quando o turno do conjurador volta, encerrando a magia, e enquanto isso causa sua quantidade, sem salvaguarda, a qualquer outra pessoa que comece um turno nela (Web de 5e).

Criaturas também empurram (Capability API 1.184). A ação de uma criatura aceita `"push": 60` na distância do próprio conjunto, como uma entrada de catálogo: quem ela atinge é empurrado essa distância em linha reta para longe da criatura e, com um `save`, só quando falha nele, então `"onSuccess": "none"` mantém o dano e poupa só o empurrão e o que `applies` impõe (o Tail de uma tartaruga-dragão). O uso de um item pode dar `width` a uma linha, como os 60 por 10 pés de um pergaminho de Gust of Wind.

O que uma criatura é conta mais (Capability API 1.185). Uma salvaguarda pode dizer `"modes": [{ "is": { "types": ["undead"] }, "mode": "disadvantage" }]`, para que um alvo desse tipo a role duas vezes e fique com a pior (Sunbeam); o `"maxAgainst": { "types": ["plant"] }` de uma entrada causa o dano máximo a um alvo desse tipo (Blight). `targetTypes` também pode dizer `"abilityAtMost": { "int": 3 }`, para um alvo cujo valor seja no máximo esse (uma criatura escrita sem esse valor não fica de fora), e `"notImmuneTo": ["charmed"]` (Sleep). O modificador de uma condição pode fazer ataques rolarem duas vezes: `{ "to": "attacks", "mode": "disadvantage", "atSource": true }` são os ataques de quem a porta contra quem a impôs (Chill Touch), e `{ "to": "attacks-taken", "mode": "disadvantage", "from": { "types": ["fiend", "undead"] } }` são os ataques feitos contra quem a porta por atacantes desses tipos (Protection from Evil and Good). Uma mudança em salvaguardas pode ser `"against": { "from": { "types": ["dragon"] } }`, que coincide com qualquer salvaguarda contra algo que uma criatura desse tipo fez (Dragon Scale Mail).

As ações de uma criatura podem recarregar juntas (Capability API 1.186): dê a cada `"recharge"` o mesmo `"group"` e os mesmos dados, e usar uma gasta as duas, enquanto uma única rolagem no início do turno da criatura traz as duas de volta (as duas armas de sopro de um dragão metálico). Um golpe pode ter `"charge"`: `{ "atLeast": 10, "plus": [{ "dice": "2d8", "type": "piercing" }], "save": { "save": "str_save", "difficulty": 14 }, "push": 10, "applies": [{ "condition": "prone", "duration": "instant" }] }` acrescenta suas cláusulas quando a caminhada da criatura neste turno terminou com uma corrida de pelo menos `atLeast` em linha reta até quem ela atinge, cada passo uma casa mais perto; então o alvo faz a salvaguarda e, numa falha (ou sempre, sem salvaguarda), é empurrado e recebe as condições (a Charge de um minotauro). Uma investida acompanha um golpe contra um alvo e só é medida num tabuleiro.

O `attack` de um item pode dizer mais sobre o que ele atinge (Capability API 1.187). `"against": [{ "is": { "types": ["construct"] }, "toHit": 2 }]` soma para acertar contra um alvo desse tipo (uma mace of smiting). Uma cláusula `plus` pode dizer `"not": { "types": ["construct", "undead"] }` para pular alvos desses tipos, `"blow": "ranged"` para contar só num golpe arremessado ou disparado (um dwarven thrower) ou `"melee"` só num golpe ao alcance, e `"tempHp": true` para dar a quem empunha pontos de vida temporários iguais ao que ela causou (uma sword of life stealing). Uma condição `onHit` pode nomear `"targetIs"` (uma giant slayer derrubando um gigante) e `"oncePerTurn": true` (uma sword of wounding). `"slay": [{ "when": "critical", "not": { "types": ["construct", "undead"] }, "healthAtMost": 99, "save": { "save": "con_save", "difficulty": 15 }, "charges": 1 }]` mata na hora um alvo que o acerto deixou com `healthAtMost` ou menos, numa salvaguarda falhada quando houver uma, gastando as cargas do item quando isso acontece (uma nine lives stealer); `"immuneTo": ["slashing"]` poupa um alvo imune a isso (uma vorpal sword). A saúde é lida depois do dano do golpe.

O `live.conditions` de uma ficha, o `clear.conditions` de um descanso e `combat.conditions` comportam até 320 entradas (Capability API 1.269; 160 a partir da 1.188, 80 antes disso). Um modificador `to: "attacks"` pode nomear `"ability": "str"` para mudar só os ataques feitos com esse atributo (o Weakening Breath de um dragão dourado), e um modificador `to: "checks"` pode nomear `"abilities": ["str"]` para mudar só os testes de atributo feitos com um deles, inclusive testes de disputa e testes de perícia desse atributo (a Rage de um bárbaro). As ações do bloco de estatísticas de uma criatura não nomeiam atributo, então um modificador de ataques restrito a um atributo nunca chega a elas.

Uma condição em `combat.conditions` pode ferir quem a porta (Capability API 1.189): `"harms": { "at": "turn-start", "dice": "1d4", "type": "necrotic" }` causa isso no início de cada turno da pessoa (ou `"turn-end"`), vindo de quem a impôs, antes de qualquer salvaguarda que a encerre. `"stacks": 10` permite impô-la de novo enquanto dura, até essa quantidade de vezes, e o ferimento é causado uma vez para cada (uma sword of wounding); encerrá-la encerra todas. `"onePerSource": true` a mantém em um único portador por origem: imposta a outra pessoa, ela sai de quem a tinha vinda da mesma origem (o sworn enemy de um oathbow). A entrada `against` do ataque de um item pode nomear `"marked": "sworn"` no lugar de `is` ou ao lado dele, coincidindo com um alvo que tem essa condição vinda de quem empunha, e além de `toHit` pode dizer `"mode": "advantage"`, `"ignoresCover": true` (cobertura que não seja total não conta) e `"ignoresLongRange": true`; uma cláusula `plus` também pode dizer `"marked": "sworn"` (os 3d6 perfurantes do oathbow). A ação do bloco de estatísticas de uma criatura pode nomear `"ability": "str"`, o atributo com que o ataque é feito, para que mudanças em ataques ou em dano restritas a um atributo cheguem a ela.

Uma entrada de `modes` do ataque de um item pode ser um jeito totalmente diferente de usar a arma (Capability API 1.190): `"range": { "normal": 120 }` é até onde ela alcança nesse modo, na distância do próprio conjunto; `"plus"` acrescenta cláusulas a um acerto, como as do próprio ataque; `"line": { "dice": "4d6", "type": "lightning", "save": { "save": "dex_save", "difficulty": 13, "onSuccess": "half" } }` é um raio contra o qual todos que estão de pé entre quem empunha e o alvo (nenhum dos dois) fazem uma salvaguarda antes de o ataque ser rolado; e `"charges": 1` gasta essa quantidade das cargas do próprio item, então o modo só é oferecido enquanto ele as tem (uma javelin of lightning: `charges.max` 1 e `stack` 1 no item). Uma linha precisa de um tabuleiro para percorrer.

Uma condição de combate com o efeito `"cannot-heal"` impede qualquer cura em quem a porta enquanto durar, e o registro diz isso (Capability API 1.191): o Chill Touch de 5e. `"conditionImmunitiesFrom": [{ "conditions": ["charmed", "frightened"], "from": { "types": ["fiend", "undead"] } }]` numa condição de combate afasta essas condições só quando uma criatura do tipo `from` as impõe; uma que já está ativa permanece (Protection from Evil and Good). O `targetTypes.abilityAtLeast` de uma magia é o piso do qual `abilityAtMost` é o teto: `{ "int": 5 }` pula uma criatura de Intelligence 4 ou menos (Hideous Laughter), e uma criatura escrita sem esse valor não fica de fora. O `against.actions` de um modificador de salvaguardas nomeia ações por ID, nome ou grupo de recarga compartilhado, sem distinguir maiúsculas, e restringe tudo o mais que `against` diz: `{ "from": { "types": ["dragon"] }, "actions": ["frightful_presence", "breath_weapons"] }` é o sopro ou a Frightful Presence de um dragão e nunca seu Wing Attack, e a salvaguarda repetida para encerrar uma condição que uma delas impôs também conta.

O ataque de um item pode ter mais efeitos adicionais (Capability API 1.192). `"ignoresResistance": true` faz seu dano atravessar a resistência do alvo ao tipo de dano do próprio ataque, inclusive a resistência a tudo, enquanto uma cláusula `plus` de outro tipo ainda é reduzida à metade (o dano cortante de uma vorpal sword); a imunidade continua valendo. O `"saved"` de uma entrada `slay` lista condições, no mesmo formato de `applies`, que um alvo que passa na salvaguarda do abate recebe no lugar: `[{ "condition": "frightened", "duration": { "rounds": 1, "of": "source" } }]` é o corruptor amedrontado diante de quem empunha uma mace of disruption até o fim do próximo turno de quem empunha. `"othersWhileMarked": { "condition": "sworn", "mode": "disadvantage" }` faz todo outro ataque com arma de quem empunha rolar com esse modo enquanto uma criatura em quem ele impôs `sworn` continuar de pé, ou só os ataques à distância, com `"ranged": true` (um oathbow). E numa luta sem tabuleiro, uma ação de área (de uma criatura ou de uma magia) pode ser apontada para pessoas de qualquer lado, nunca para quem a usa, porque pega cada criatura que estiver nela; `friendlyFire: false` a restringe ao outro lado, como num tabuleiro.

Uma disputa pode ser um teste contra um número fixo em vez de uma rolagem dos dois lados (Capability API 1.193). Omita `defender` e dê `"difficulty": 15`; o ator rola o melhor dos seus testes `attacker` e vence ao alcançá-lo. `"targets"` diz contra quem ela pode ser feita: `"enemy"` (o padrão), `"ally"` ou `"any"`, inclusive o próprio ator. `"targetHolds": "wounded"` só a oferece contra um alvo que tenha essa condição, e `"targetDying": true` só contra um que está morrendo e ainda não foi estabilizado. `onWin.stabilizes` estabiliza um alvo que está morrendo. Assim, um teste de Wisdom (Medicine) CD 15 que encerra os ferimentos de uma sword of wounding é `{ "difficulty": 15, "targets": "any", "targetHolds": "wounded", "onWin": { "ends": [{ "condition": "wounded", "on": "target" }] } }`, e o de CD 10 que salva quem está morrendo é `{ "difficulty": 10, "targets": "ally", "targetDying": true, "onWin": { "stabilizes": true } }`. Uma luta de reserva conta sucessos, então recusa `difficulty`. O `"healedOnlyByRest": true` do ataque de um item sela os pontos de vida que ele tira: nenhuma cura leva quem os perdeu acima do máximo menos o que está selado, e qualquer descanso os restaura e remove o selo. O `harms` de uma condição de combate aceita o mesmo `"healedOnlyByRest": true`, então os ferimentos que a espada deixa também selam o que tiram.

Um tamanho pode ocupar mais de uma célula (Capability API 1.194). Dê a uma entrada de `combat.sizes.order` uma contagem `"cells"`, `{ "id": "large", "label": "Large", "cells": 2 }`, e uma criatura desse tamanho ocupa essa quantidade de células de lado num tabuleiro, sendo a sua própria célula a do canto superior esquerdo: o Large de 5e é 2, Huge 3 e Gargantuan 4. Ela é colocada onde cabe inteira, no lugar assim mais próximo de onde se pediu que ficasse. Alcance e distância são medidos até a célula mais próxima que ela ocupa, e a partir dela, então uma espada alcança um ogro do lado de qualquer uma das suas quatro células; ela só anda por onde cabe inteira, e ninguém atravessa nenhuma parte dela; uma área a pega quando qualquer uma das suas células está dentro; um empurrão a move inteira; e ela é vista, e está tão coberta quanto, a partir da sua célula mais desimpedida. Um tamanho sem `cells` ocupa uma, exatamente como antes.

Uma condição pode deixar quem a porta maior ou menor (Capability API 1.195). Dê a uma entrada de `combat.conditions` um `"size": { "steps": 1 }`, e enquanto ela durar quem a porta fica essa quantidade de tamanhos adiante em `combat.sizes.order`, ou para trás com um número negativo, nunca além do primeiro nem do último: o Enlarge de 5e é `1`, e Reduce `-1`. O alcance da pessoa, o que as áreas pegam dela e tudo o que pergunta seu tamanho leem o novo, e quando a condição termina ela volta ao próprio tamanho. Num tabuleiro, quem cresce ocupa o novo tamanho sobre todas as células em que estava, onde couber em terreno livre e longe de todos os outros, ou o maior tamanho abaixo dele que couber, então um ogro aumentado num corredor só cresce até onde o corredor permite; quem encolhe mantém a célula do canto superior esquerdo. O registro diz quem mudou e para quê. Exige `combat.sizes`; combine-a com um modificador `damage` para os dados da arma e com um modo de `checks` e de `saves` de Strength para o resto da magia.

Uma entrada pode escolher os alvos pela saúde que lhes resta (Capability API 1.196). `"healthPool": { "dice": "5d8" }` no seu `mechanics` é rolado uma vez quando ela é usada e repartido a partir do alvo com menos saúde restante, subindo: cada um só é afetado enquanto sua saúde não passar do que resta, que ele então consome, e os demais ficam totalmente intactos, como funcionam Sleep e Color Spray de 5e; `perCostStep` soma a ela quando é conjurada num nível maior. `"healthAtMost": 150` só afeta um alvo com essa saúde ou menos, como Power Word Stun; `"kills": true` mata na hora quem ela afeta, então Power Word Kill é `"healthAtMost": 100, "kills": true`. Os dois leem a saúde que resta a um alvo, depois que `targetTypes` disse quem ela pode pegar. O registro diz o que uma reserva rolou e para quem ela bastou.

Um modificador de dano pode rolar os próprios dados de um golpe mais vezes (Capability API 1.197). `{ "to": "damage", "attacks": "weapon", "ability": "str", "diceTimes": 2 }` numa condição faz o 1d8 + 2 de uma war pick causar 2d8 + 2 enquanto ela durar, como fazem as armas de um duergar aumentado; a parte fixa fica como estava, um crítico dobra os dados extras como faz com o resto, e a média do menu os conta. Ele muda o dano que um golpe causa e nada mais. A ação de uma criatura com `"self": true` feita no próprio turno agora recai sobre a própria criatura, como já acontecia numa reação, então seus `applies` são impostos.

Uma zona pode causar, nos seus gatilhos, um tipo de dano diferente do que causa ao aparecer (Capability API 1.198). `"zone": { "rounds": 100, "triggers": ["enter"], "atCast": true, "damageType": "slashing" }` numa entrada cujo `damageType` próprio é `"piercing"` causa dano perfurante a quem está ao redor de onde a muralha surge e dano cortante a quem se move para dentro dela depois, como faz a Wall of Thorns de 5e. Exige o `amount` da própria entrada e um gatilho, um lado ou um abalroamento para causá-lo, e nomeia um dos `combat.damageTypes` quando o conjunto os declara.

Uma reserva de saúde compartilhada pode pular alguns dos seus alvos (Capability API 1.199). `"healthPoolSkips": { "conditions": ["unconscious"] }` ao lado de uma `healthPool` deixa em paz quem tem uma dessas condições e não gasta nada da reserva com essa pessoa, como o Sleep de 5e ignora os inconscientes; `"unseeing": true` faz o mesmo com quem não consegue ver quem usou a entrada (cego, ou sem linha de visão até ele), como Color Spray ignora criaturas que não conseguem ver. Ela nomeia `conditions`, `unseeing` ou os dois, e exige uma `healthPool`.

Uma muralha pode ficar de pé em seções que são golpeadas e quebradas uma a uma (Capability API 1.200). `"zone": { "rounds": 100, "triggers": [], "blocks": ["move", "sight"], "sections": { "every": 10, "health": 30, "defense": 12, "vulnerable": ["fire"], "broken": { "triggers": ["enter"], "amount": { "dice": "5d6" }, "damageType": "cold", "save": "con_save", "onSave": "half" } } }` é a Wall of Ice de 5e: cada painel de 10 pés tem CA 12 e 30 pontos de vida e recebe o dobro de fogo (`resist` e `immune` funcionam da mesma forma). Um ataque que mira um inimigo ou qualquer pessoa e causa dano pode ser apontado para uma seção: sua opção lista as células que ele pode golpear como `walls`, e a escolha nomeia uma delas como `wall`. O ataque é rolado e o dano causado como contra uma criatura, e o registro diz o que a seção recebeu e o que lhe resta. Uma seção levada a 0 se quebra: ela deixa de bloquear, e quem entra nela (ou começa ou termina um turno ali, como dizem seus `triggers`) recebe seu `amount`, uma vez por turno, fazendo a salvaguarda `save` dela contra a dificuldade da própria entrada para receber metade (`onSave: "none"` para não receber nada). As seções exigem uma muralha que `blocks`, e um `save` de seção quebrada exige o `save` da própria entrada.

Uma entrada pode mover as trilhas vivas da ficha e devolver saúde selada (Capability API 1.201). `"tracks": [{ "track": "exhaustion", "by": -1 }]` tira um nível de exaustão de quem ela atinge, como faz o Greater Restoration de 5e, e `"by": 1` numa entrada com salvaguarda (Sickening Radiance) soma um a quem falhar. Cada trilha fica dentro dos próprios limites, níveis que reduzem à metade o máximo de saúde valem na hora, e chegar a um nível com `defeats` mata. `"unseals": true` devolve a saúde que só um descanso devolveria (o que um golpe `seals` tirou), como Greater Restoration encerra uma redução do máximo de pontos de vida. Uma entrada que só cura dessa forma só é oferecida contra alguém que ela ajudaria. O `broken` de uma seção de muralha pode ter o próprio `perCostStep`, somado uma vez para cada passo em que a conjuração foi paga acima da base: o ar gélido da Wall of Ice, `{ "dice": "1d6" }`. As trilhas são trilhas comuns, não trilhas de ferimentos, e `unseals` exige saúde contada em pontos.

Uma condição que uma entrada impõe pode terminar junto com outra que ela impõe (Capability API 1.202). Em `"applies": [{ "condition": "charmed", "duration": { "rounds": 10 }, "saveEnds": { "save": "wis_save", "at": "damaged" } }, { "condition": "incapacitated", "duration": "instant", "endsWith": "charmed" }]`, o Hypnotic Pattern de 5e, a incapacitação termina sempre que o encanto termina: uma salvaguarda, uma cura, a concentração do conjurador se rompendo, um aliado sacudindo a pessoa para acordá-la ou o fim da luta. Só a que foi imposta pelo mesmo uso vai junto, e o registro diz por quê. `endsWith` nomeia outra condição da mesma lista `applies` (ou da lista `onEnd`, `charge` ou `saved`), nunca a própria.

A ação de uma criatura pode reduzir o máximo de saúde do alvo (Capability API 1.203). `"reducesMax": { "save": "con_save", "difficulty": 14 }` no Life Drain de uma aparição faz o alvo rolar essa salvaguarda quando o golpe acerta; numa falha, o dano que ele recebe sai do máximo, além da saúde, e nenhuma cura o devolve antes de um descanso. Com `"lasting": true` (o Slam de um golem de argila), nem um descanso o devolve, só uma entrada com `unseals` (Greater Restoration). Um alvo cujo máximo é reduzido a 0 dessa forma morre. Uma ficha guarda o que nenhum descanso devolve como o `lasting` da sua reserva, dentro de `sealed`. Exige saúde contada em pontos.

Uma cura pode fazer uma das suas curas em vez de todas (Capability API 1.204). Com `"cureOneOf": true`, uma entrada que usa `ends` em algumas condições, move `tracks` e tem `unseals` (o Greater Restoration de 5e: encantado, petrificado, um nível de exaustão ou o máximo de pontos de vida) faz exatamente uma: cada uma é oferecida como um modo da opção (uma condição, uma trilha ou a reserva de saúde, pelo rótulo), como os modos de uma arma, e um uso sem nenhum escolhido faz a primeira delas, nessa ordem, para a qual o alvo tiver algo. Exige pelo menos duas curas para escolher.

Um máximo reduzido pode dispensar uma salvaguarda própria (Capability API 1.235). Um `reducesMax` sem `save` e `difficulty` reduz o máximo pelo dano de cada golpe que acerta (o Bite do vampiro de 5e); com `"onFailedSave": true`, só quando o alvo falhou na salvaguarda da própria entrada (o Harm de 5e, uma entrada de catálogo com salvaguarda; ali `reducesMax` nunca tem salvaguarda própria). `damageType` conta só o dano desse tipo (o necrótico do Bite), e `"heals": true` devolve a quem o usou tantos pontos de vida quanto ele reduziu. As mecânicas de catálogo também aceitam `reducesMax`, e `leavesAtLeast` impede que o dano da entrada leve o alvo abaixo dessa quantidade de pontos de vida (Harm deixa 1). `targetHolds` numa ação de criatura ou nas mecânicas de catálogo limita para quem ela pode ser apontada: alguém que tenha uma das suas `conditions`, ou uma das suas `fromSelf` que quem usa a ação lhe impôs (o Bite: agarrado pelo vampiro, ou incapacitado ou impedido).

Uma condição pode dar a quem a porta usos próprios (Capability API 1.236). As `actions` de uma condição de combate listam entradas de catálogo (`spells/break-enchantment`) que quem a porta pode usar enquanto a tiver: elas só ficam no menu nesse período, não custam nada da ficha além do orçamento que cada uma gasta e são roladas com os números de quem a porta, como suas magias (uma criatura conjuradora usa os da sua conjuração). Uma entrada com `"endsCondition": "<condition>"` encerra essa condição em quem a usou assim que é usada, e também a concentração que a mantém, quando é a própria concentração de quem usa: o Dispel Evil and Good de 5e, cujos Break Enchantment e Dismissal encerram cada um a magia. `ends.from` (um teste de tipo e de tag) só cura o que uma criatura que passa nele impôs: Break Enchantment encerra um encanto ou um medo vindo de um celestial, um elemental, uma fada, um corruptor ou um morto-vivo, e mantém um vindo de qualquer outra pessoa. `dismisses` manda quem ela atinge e não passa na salvaguarda para fora da luta, vivo, fora do tabuleiro e fora da ordem dos turnos: `true` para sempre (Dismissal), ou `{ "while": "<condition>" }` enquanto a pessoa tiver essa condição, que a mesma entrada precisa impor (o Banishment de 5e). O relógio dela passa então a correr nos turnos do conjurador e, quando termina, pelo tempo, por uma salvaguarda ou pela concentração do conjurador, a pessoa volta para onde estava, ou para o lugar livre mais próximo onde caiba. Com `gone` (um teste de tipo e de tag), quem passa nele e viu a condição durar o tempo todo fica longe.

Uma luta pode começar com algumas pessoas desprevenidas (Capability API 1.237). A cena diz quem: o encontro de onde ela é tirada as marca com `"surprised": true`, do grupo ou inimigas. No primeiro turno, elas não podem se mover nem agir, e o menu delas só contém encerrá-lo; elas não fazem reação nem uso lendário até esse turno acabar ou a primeira rodada acabar, o que vier primeiro. Uma condição de combate com `"cannotBeSurprised": true` impede que quem a porta seja pego de surpresa: o Foresight de 5e. Uma entrada de catálogo com `"ignoresSurpriseWith": "<catalog>/<entry>"` nomeia um uso que quem a tem ainda pode fazer enquanto surpreso, e fazê-lo encerra a surpresa na hora, então o resto do turno é dele: o Feral Instinct de 5e, que permite a um bárbaro surpreso agir normalmente se entrar em fúria primeiro.

Uma entrada de catálogo pode dar a quem a tem um segundo turno na primeira rodada de uma luta (Capability API 1.238). `"extraFirstTurn": { "initiative": -10 }` numa entrada que está numa lista da ficha coloca esse segundo turno na iniciativa de quem a tem mais o número, depois de todos com esse número ou acima; cada um dos dois é um turno inteiro, e a partir da segunda rodada a pessoa faz um turno por rodada, como sempre. Quem é tirado da luta antes do segundo turno simplesmente o perde. Com `"unlessSurprised": true`, não há segundo turno para quem começa a luta surpreso: o Thief's Reflexes de 5e.

Uma condição de combate pode limitar o que o orçamento que ela concede compra a um golpe ao alcance e deixar uma marca nas trilhas de quem a porta quando termina (Capability API 1.239). Com `"grants": { "budget": "bonus", "attacks": true, "melee": true }`, o único golpe que esse orçamento paga só é feito com uma arma que golpeia ao alcance, e uma arma de arremesso só contra alguém dentro do alcance dela, já que é brandida em vez de arremessada; uma arma com distância e sem alcance não é oferecida. `"onEnd": { "tracks": [{ "track": "exhaustion", "by": 1 }] }` move as trilhas vivas de quem a porta por níveis quando a condição termina, seja como for que termine, como faz `tracks` numa entrada de catálogo; `applies` e `tracks` podem estar juntos ou sozinhos. O `"usesOf": "<row name>"` de uma entrada de catálogo gasta os usos da entrada dessa linha (a linha do contador dela) em vez dos próprios. O Frenzy de 5e passa a ser então uma entrada do Berserker, Frenzied Rage, com `"usesOf": "Rage"`, que impõe a fúria e uma condição `frenzied` que tem `endsWith` com ela, contendo as duas coisas.

A iniciativa pode ser rolada duas vezes, mantendo a melhor ou a pior (Capability API 1.240). `combat.initiative.checkAbility` diz que a iniciativa é um teste feito com esse atributo, então tudo o que faz rolar esse teste duas vezes faz rolar a iniciativa duas vezes: uma condição com `own-checks-advantage` (o Foresight de 5e) ou um modificador de `checks` com `mode`, restrito a esse atributo ou a nenhum (o Cat's Grace de Enhance Ability em Dexterity). Uma entrada de catálogo que está numa lista da ficha com `"initiativeMode": "advantage"` (ou `"disadvantage"`) rola duas vezes a iniciativa de quem a tem, seja o que for que a pessoa tenha: o Feral Instinct de 5e. Vantagem e desvantagem se anulam, como em qualquer rolagem; a entrada de iniciativa do registro leva `mode` e a rolagem `dropped`. Uma luta que rola a iniciativa a cada rodada a rola duas vezes a cada rodada. Só dados rolados: a iniciativa de uma reserva não é rolada duas vezes.

Uma reação pode responder ao PRÓPRIO ataque de quem a tem acertando (Capability API 1.241): uma reação `"hit"` com `"by": "self"` é oferecida ao atacante assim que a rolagem dele acerta, depois que todos os atingidos pelo golpe responderam, e mira quem foi atingido (escreva `"at": "target"`). `"weapon": true` restringe qualquer momento de acerto ao golpe de uma arma: um ataque, ou uma ação de alvo único de uma criatura, que não venha de nenhum catálogo. Uma reação ao próprio acerto não é impedida pelo que impede reações, já que escolhê-la faz parte do ataque; marque-a como `"free"`, a menos que ela realmente gaste um orçamento. O Stunning Strike de 5e é uma delas: `"reaction": { "on": "hit", "by": "self", "weapon": true, "blow": "melee", "at": "target" }`, gratuita, com um custo em ki, uma salvaguarda de Constitution e `stunned` até o fim do próximo turno do monge. Com `"addsToBlow": true`, a quantidade de uma entrada de ataque se junta a esse golpe em vez de ser causada sozinha: rolada quando o golpe acerta, dobrada pelo crítico dele, com as cláusulas só num alvo que elas alcançam. O Divine Smite de 5e é 2d8 radiante, `perCostStep` 1d8, uma cláusula de 1d8 radiante com `targetIs` corruptor ou morto-vivo, e `"perCostStepsMax": 3`: o máximo de passos de um custo maior que contam, para qualquer entrada com `perCostStep` ou `targetsPerCostStep`. Um ataque feito dentro de outra janela (um ataque de oportunidade) nunca fica retido no acerto, então nada é somado a ele.

O que uma ficha contém pode mudar suas linhas de ataque, conceder golpes e esperar pela ação de ataque (Capability API 1.242). Uma entrada de catálogo que está numa lista da ficha com `attackRows` muda as linhas cujos nomes ela lista (comparados sem distinguir maiúsculas), enquanto seus limites `when` valerem (um valor da ficha, como armadura vestida no máximo 0): `abilities` usa o melhor entre o atributo da própria linha e esses para acertar e, quando o dano da linha soma o mesmo atributo, para o dano; `die` (`from` um valor da ficha, por uma `table` de patamares, até um número de faces) rola um dado desse tamanho no lugar dos dados da linha quando ele tem a média melhor; `qualities` somam ao que os golpes levam para atravessar uma resistência. O Martial Arts de 5e é `{ "names": ["Unarmed Strike", "Shortsword", ...], "abilities": ["str", "dex"], "die": { "from": { "field": "level_monk" }, "table": [[1, 4], [5, 6], [11, 8], [17, 10]] }, "when": { "value": { "derived": "armor_worn" }, "atMost": 0 } }`, e Ki-Empowered Strikes é `{ "names": ["Unarmed Strike"], "qualities": ["magical"] }`. O `grantsStrike` de uma entrada que a ficha contém permite a quem a tem comprar um golpe com outro orçamento depois que o orçamento próprio de um ataque foi gasto, exatamente como faz o `grants.attacks` de uma condição: `names` o restringe a esses ataques, `melee` ao alcance, e `afterAttack` a um turno em que a ação de ataque foi feita (`true`, ou `{ "names": [...] }` para uma ação de ataque feita com um desses). O ataque desarmado bônus de Martial Arts é `{ "budget": "bonus", "names": ["Unarmed Strike"], "afterAttack": { "names": [...the monk weapons] } }`. O `grants` de uma condição aceita os mesmos `names` e `afterAttack`. Uma entrada com `afterAttack` só é oferecida depois da ação de ataque: Flurry of Blows é uma entrada `utility` no orçamento bônus, que gasta um ki, com `afterAttack`, `gives` 2 de um orçamento declarado com contagem 0 e um `grantsStrike` de Unarmed Strike nesse orçamento. A ação de ataque é qualquer ataque feito a partir de uma lista de ataques ou de um item pagando o próprio orçamento ou um golpe que já comprou, nunca um pago por uma concessão.

Um ataque de oportunidade fica retido onde acerta, exatamente como um ataque num turno (Capability API 1.243): todos que têm uma resposta a esse acerto são consultados, quem o fez por último, pelo que soma a ele (Divine Smite, Stunning Strike), e a janela da própria caminhada, com quem golpeou já respondido, segue sendo consultada depois que o golpe acertou. Quem caminha e é imobilizado no caminho (uma condição com `speed-zero`, como atordoado ou agarrado) não passa da célula em que foi golpeado. Uma entrada que é uma reação ou que se soma a outro golpe nunca é escolhida como o próprio ataque de oportunidade.

As regras de ataque alcançam as armas empunhadas, e uma lista de ataques pode dar uma linha a toda ficha (Capability API 1.244). `combat.attacks[].always` lista até 4 linhas, escritas nas colunas dessa lista, que a luta de toda ficha tem além das próprias; uma linha da ficha com o mesmo nome é usada no lugar. O ataque desarmado de 5e é `{ "name": "Unarmed Strike", "ability": "str", "proficient": true, "bonus": 0, "damage": "1", "damage_type": "bludgeoning", "reach": 5 }`. Os `names` de uma regra `attackRows` agora também coincidem com uma arma empunhada pelo nome do seu ataque, e seus `items` coincidem com armas empunhadas por tags: todas as de `tags` e nenhuma de `notTags` (`{ "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] }`, então uma dagger +1 conta); uma regra nomeia `names`, `items` ou os dois. `wielding: { "only": {...} }`, com os mesmos `names`, `tags` e `notTags`, mantém uma regra só enquanto toda arma empunhada for uma dessas, ou nenhuma for: "desarmado ou empunhando só armas de monge". Um `grantsStrike` aceita o mesmo `wielding` e um `when` como o de uma regra `attackRows`, então o golpe bônus de Martial Arts não é oferecido de armadura.

Vários usos de uma vez, uma salvaguarda que derruba a 0, acertos por ataques nomeados e dano quando uma condição termina (Capability API 1.245). O `usesSpent` de uma entrada gasta essa quantidade de usos da sua linha (ou da de `usesOf`) num único uso, e só é oferecido enquanto restar essa quantidade: os 3 ki de Quivering Palm. Os `names` de uma reação `"hit"` só respondem a um acerto desses ataques, comparados pelo nome sem distinguir maiúsculas: Quivering Palm é `{ "on": "hit", "by": "self", "names": ["Unarmed Strike"], "at": "target" }`, impondo uma condição `quivering` duradoura. `dropsOnFailedSave` numa entrada com salvaguarda derruba a 0 de saúde um alvo que falha nela, em vez de causar a quantidade (uma criatura fica fora de combate, um personagem fica morrendo quando o conjunto tem uma regra de morte); um alvo que passa recebe a quantidade como diz o `onSuccess` da salvaguarda. Encerrar as vibrações é uma ação com `targetHolds: { "fromSelf": ["quivering"] }`, 10d10 necrótico, uma salvaguarda de Constitution com `onSuccess: "none"` e `dropsOnFailedSave`. O `onEnd.harm` de uma condição (`dice`, `flat`, `type`, `unless`) causa dano a quem a porta quando ela termina, vindo de quem a impôs, a menos que quem a porta seja o que `unless` nomeia: Hurl Through Hell é uma reação de acerto com `dismisses: { "while": "hurled" }` e `hurled` durando `{ "rounds": 1, "of": "source" }`, e o `onEnd` da condição `hurled` é `{ "harm": { "dice": "10d10", "type": "psychic", "unless": { "types": ["fiend"] } } }`.

`afterAttack` também coincide por tags com a arma com que a ação de ataque foi feita (Capability API 1.246): `{ "names": [...], "items": { "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] } }` vale depois de um ataque com um desses nomes ou com uma arma empunhada que tenha todas as `tags` e nenhuma das `notTags`, seja qual for o nome dela, então uma dagger +1 conta. Ele nomeia `names`, `items` ou os dois, tanto numa entrada quanto num `grantsStrike` ou na concessão de uma condição.

Golpes imprudentes e brutais (Capability API 1.247). Uma entrada com `beforeAttack` só é oferecida no próprio turno de quem a tem, antes de essa pessoa atacar nele: Reckless Attack é um `buff` gratuito no bárbaro com `beforeAttack`, aplicando `reckless` por `{ "rounds": 1 }` e `exposed` por `{ "rounds": 1, "at": "turn-start" }`. Uma mudança em ataques aceita `attacks` (`weapon`, `spell` ou `any`) e `blow` (`melee` ou `ranged`), como uma mudança em dano, com `ability`: `reckless` é `{ "to": "attacks", "mode": "advantage", "ability": "str", "attacks": "weapon", "blow": "melee" }`, e `exposed` tem o efeito `attacks-against-advantage`. O `criticalDice` de uma mudança de dano soma essa quantidade dos próprios dados de dano do golpe só num acerto crítico, sem dobrá-los: Brutal Critical é um nível num valor derivado do bárbaro com `{ "to": "damage", "criticalDice": 1, "attacks": "weapon", "blow": "melee" }`, um nível para cada dado.

Respostas aos acertos de uma rajada (Capability API 1.248). O `budget` de um momento `hit` o restringe a acertos de um golpe pago com esse orçamento: Open Hand Technique responde a `{ "on": "hit", "by": "self", "budget": "flurry" }`, o orçamento que Flurry of Blows dá com `gives` e que o `grantsStrike` dela gasta. O `oneOf` de uma reação nomeia um grupo de respostas ao próprio acerto de quem a tem, das quais só uma é usada por acerto: Open Hand Technique são três entradas gratuitas que compartilham `"oneOf": "open-hand"`, uma com uma salvaguarda `save` de Dexterity que aplica `prone`, uma com uma salvaguarda `save` de Strength e `push` de 15, e uma que aplica uma condição com o efeito `cannot-react` por `{ "rounds": 1, "at": "turn-start" }`. Usar uma gasta as outras duas naquele acerto; o próximo acerto oferece as três de novo. `oneOf` vai num momento `hit` com `by` `self` e sem `also`.

Salvamentos depois da rolagem (Capability API 1.249). Uma mudança em `attacks`, `saves` ou `checks` com `"rescue": true` fica fora da rolagem: só quando a rolagem de quem a porta fica aquém, e o máximo dela (a parte fixa e cada dado no valor mais alto) poderia cobrir a diferença, ela é rolada e somada, e a condição de onde veio é gasta. Uma rolagem que ela não conseguiria virar a mantém. Bardic Inspiration é uma condição imposta a um aliado com `{ "to": "saves", "dice": "1d6", "rescue": true }` e o mesmo para `attacks` e `checks` (uma condição por tamanho de dado, escolhida pelo nível do bardo, como as outras faixas); Guidance é `checks` com `1d4`, e Resistance é `saves` com `1d4`. Um erro natural nunca é salvo, e uma luta numa reserva de dados não retém nada. O `rescue` de uma entrada a tira do menu: ela é gasta, com os usos e o custo, quando a rolagem desse tipo de quem a tem falhou. `{ "roll": "saves", "by": "reroll" }` rola a salvaguarda de novo e a nova rolagem vale (Indomitable com os próprios usos; Diamond Soul com `usesOf` Ki); `{ "roll": "attacks", "by": "success" }` transforma um erro em acerto, e `{ "roll": "checks", "by": "success" }`, um teste falhado em sucesso (Stroke of Luck). As mudanças retidas são tentadas primeiro.

Palavras cortantes e evasão (Capability API 1.250). O `lowersRoll` de uma entrada é usado quando o ataque de outra pessoa acerta, numa reação `hit` sem `by` (com `for` e `within` para responder por aliados): seus `dice`, ou um `die` dimensionado por um valor como o de Martial Arts (`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`), são tirados da rolagem, que é então verificada de novo contra a defesa; um acerto natural continua acertando. Cutting Words é um `debuff` gratuito com `{ "on": "hit", "for": "ally", "within": 60 }` e `usesOf` o contador de inspiração do bardo. O `evasion` de uma condição de combate ou de um nível nomeia salvaguardas: contra algo que causa metade num sucesso, uma salvaguarda bem-sucedida não recebe nada, e uma falhada recebe metade. Evasion é um nível no nível do ladino ou do monge com `"evasion": ["dex_save"]`.

Imposição de mãos (Capability API 1.251). O `usesChosen` de uma entrada permite a quem a usa escolher quantos dos seus usos um uso gasta, de um até o que restar, e cura essa quantidade de vezes a sua quantidade. A opção leva `amount: { max }`, e a escolha envia `amount`; se omitido, gasta o que cura totalmente o primeiro alvo, em média. Serve para um `heal` sem `usesSpent`. Lay on Hands é um `heal` de `"amount": { "flat": 1 }` com `usesOf` um contador de cinco por nível de paladino, `usesChosen` e `"targetTypes": { "not": { "types": ["undead", "construct"] } }`.

Fonte de magia (Capability API 1.252). O `restore` de uma entrada devolve parte de uma reserva de quem ela atinge, num `heal` ou num `buff`: uma reserva viva pelo ID, ou a reserva de uma linha de lista pelo nome (`"Sorcery Points"`). Com um `cost` numa família de reservas, `perCostStep` soma a ele para cada passo acima do mais barato, então o espaço de um feiticeiro vira Sorcery Points iguais ao nível dele: um `buff` em si mesmo que custa `slots_1` com `"restore": { "pool": "Sorcery Points", "amount": { "flat": 1 } }` e `"perCostStep": { "flat": 1 }`. `overMax` permite passar do máximo da reserva; o que passa dele é mantido à parte e some quando um descanso devolve a reserva ao máximo. Um espaço feito de pontos é uma entrada por nível, `usesOf` os pontos, com `usesSpent` o preço dele e `"restore": { "pool": "slots_2", "amount": { "flat": 1 }, "overMax": true }`. Uma entrada que restaura em quem a usa uma reserva que essa pessoa não tem não fica no menu dela.

Metamagia (Capability API 1.253). O `alters` de uma entrada muda como uma entrada dos seus `catalogs` é usada: ela nunca fica num menu próprio, mas é oferecida com cada uma em que se encaixa, escolhida quando essa é usada e paga com os próprios usos (`usesOf` os Sorcery Points com `usesSpent`, ou `usesSpentByLevel` pelo nível em que a magia é paga, no mínimo um). É uma `utility` sem reação. Só uma por uso, a menos que ela tenha `joins` com outra. O que ela muda, cada uma servindo só para uma magia em que tenha algo a mudar: `spares` (um valor da ficha: essa quantidade de pessoas, entre quem a usa e os aliados que ela pega, passa automaticamente na salvaguarda: Careful), `range` (`{ "times": 2, "touch": 30 }`: Distant), `rerolls` (essa quantidade dos dados de dano abaixo da média rolados de novo, os menores primeiro: Empowered, com `joins`), `lasts` (o que ela impõe por um minuto ou mais dura essa quantidade de vezes mais, nunca além de um dia: Extended), `heightens` (o primeiro alvo rola a primeira salvaguarda com desvantagem: Heightened), `budget` (`{ "from": "action", "to": "bonus" }`: Quickened), `drops` (os componentes de que ela deixa de precisar, e ninguém pode responder à conjuração dela: Subtle) e `twins` (mais um alvo para uma magia de um alvo só que não seja exclusiva de quem a usa e não ganhe nada com um espaço maior: Twinned). Uma magia que só pode ser conjurada agora com uma delas (Quickened depois que a ação foi gasta, Subtle sob Silence) é oferecida com `alterNeeded`, e a escolha precisa levá-la. A escolha envia `alters`, os IDs vindos do `alters` da opção; o registro diz `altered`.

Metamagia como é escolhida (Capability API 1.254). `rerolls` rola de novo os menores de todos os dados de dano de uma magia, nunca mais que essa quantidade no total: os próprios, os de cada cláusula em `plus` e, num acerto crítico, os extras com o que sobrar. Uma magia de ataque os rola para cada alvo que acerta. Quando uma alteração `spares` pega mais pessoas do lado de quem a usa do que poupa, quem a usa escolhe quem: a oferta `alters` da opção leva `spares` (quantos), e a escolha envia `spares`, os IDs do lado de quem a usa a poupar (nenhum ID não poupa ninguém). Se omitido, poupa os primeiros que pega. A escolha vale durante uma janela que responde à conjuração. `spares` sem uma alteração que poupe alguém, com mais IDs do que ela poupa, com um ID repetido ou com um do outro lado é recusado como `bad-alter`.

O alvo de Heightened e Acid Arrow (Capability API 1.255). Quando uma alteração `heightens` pega mais de um, quem a usa escolhe quem rola a primeira salvaguarda com desvantagem: a oferta `alters` da opção leva `heightens: true`, e a escolha envia `heightens`, o ID de um combatente (um para quem ela está apontada, quando está apontada para alguns, e nunca quem a usa). Se omitido, é o primeiro que ela pega. Uma entrada com `halfOnMiss: true` (ela precisa ter `attackRoll` e um `amount`) ainda causa metade do dano num erro, inclusive o das cláusulas, e nada mais do que faz num acerto. O `harmsPerCostStep` de uma entrada de `applies` (`{ "dice": "1d4" }`) soma isso ao `harms` da condição para cada passo de um custo maior com que ela foi imposta: o ácido posterior de Acid Arrow, 1d4 a mais por nível de espaço acima do 2º.

Salvamentos do próprio portador, entradas que nunca recaem em quem as usa e condições uma de cada vez (Capability API 1.256). O `rescue` de uma entrada também pode ser `by: "twenty"` (só com `roll: "checks"`): o d20 de um teste falhado conta como 20, gasto só quando isso o faz passar, como Stroke of Luck faz num teste de atributo. `by: "die"` soma um dado próprio de quem a tem quando nada que lhe foi dado poderia cobrir a diferença e esse dado poderia: `dice` (`"1d10"`, Dark One's Own Luck) ou um `die` dimensionado por um valor da ficha, `{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }` (Peerless Skill). Uma condição recebida é tentada primeiro. `notSelf: true` numa entrada apontada para uma criatura `ally` ou `any` a mantém longe de quem a usa: Bardic Inspiration. O `oneAtATime` de uma condição de combate nomeia um grupo (`"bardic"`): enquanto uma criatura tiver uma condição desse grupo, nenhuma outra dele, inclusive a mesma, é imposta; o evento da condição diz `already`.

Respostas a mais tipos de rolagem (Capability API 1.257). `lowersRoll` também pode listar `"also": ["checks", "damage"]`: além de uma rolagem de ataque que acertou, seus dados são tirados do teste de atributo de outra pessoa (uma disputa como um agarrão, o teste de uso de um item, o teste de Counterspell) ou da rolagem de dano dela, quando é feita. Isso é gasto sozinho, com o orçamento, os usos e o custo da entrada, pelo primeiro do outro lado cuja entrada alcança quem rola, e só quando o máximo dela poderia virar a rolagem: um teste que teria sucesso e poderia então falhar, ou um dano que derrubaria alguém do lado de quem a tem e poderia então deixá-lo de pé. Cutting Words é `{ "dice": "1d6", "also": ["checks", "damage"] }` com o dado dimensionado pelo nível, `needs: ["hearing"]` e `targetTypes: { "notImmuneTo": ["charmed"] }`. Um salvamento pode nomear `saves` (só um salvamento de `saves`): ele só é gasto nessas salvaguardas. Com `budget`, ele também consome um desse orçamento e não é gasto sem ele: um ring of evasion é `{ "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" }` com as cargas como usos. O uso de um item também pode ter `halfOnMiss`, com `attackRoll` e um `amount`: um pergaminho de Acid Arrow.

Doenças (Capability API 1.258). Os `kinds` de uma condição de combate (`["disease"]`) dizem que tipo de condição ela é. Um tipo nunca é o ID da própria condição. O `ends` de uma cura pode nomear um tipo no lugar de condições: toda condição desse tipo conta, e seu `count` continua pegando só essa quantidade, então a "uma doença" de Lesser Restoration é `{ "conditions": ["disease", "blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. Uma imunidade (o `conditionImmunities` de uma criatura ou de um item, ou o de uma condição ou de um nível) também pode nomear um tipo: Divine Health é uma condição com `"conditionImmunities": ["disease"]`. Um `saveEnds` pode contar: `successes` (de 2 a 10) é quantos sucessos a encerram, e `failures` (`{ "count": 3, "becomes": "blinding_sickness" }`) impõe `becomes` no lugar dela, sem relógio e sem mais salvaguardas, depois que essa quantidade de salvaguardas falhou. O evento da condição diz `worsened`. Isso é Contagion: uma condição `until-save` contra a qual se faz a salvaguarda no fim de cada turno, com três num sentido ou no outro. Uma condição sem relógio não é retirada quando a luta termina, então uma doença que se instalou dura além dela até que algo a cure.

Salvamentos em itens vestidos (Capability API 1.259). O `use` de um item pode ter um `rescue`, como as mecânicas de uma entrada, inclusive `saves` e `budget`. Ele nunca fica no menu e só é gasto enquanto o item está vestido (quando tem espaços) e tem as `charges` que seu uso gasta. Gastá-lo consome uma dessas cargas. Um ring of evasion é um item com `"charges": { "max": 3 }` e `"use": { "kind": "buff", "targets": "self", "free": true, "charges": 1, "rescue": { "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" } }`. As cargas voltam como diz o `recharge` do item.

Doenças entre lutas (Capability API 1.260). Uma condição de combate pode ter `onRest: { "rests": [restId], "lowersMax": { "dice": "3d6", "flat": 0 }, "lasting": true }`: cada vez que quem a porta faz um desses descansos enquanto a tem, o máximo de saúde cai essa quantidade, rolada onde o descanso é feito, depois que o descanso devolveu o que devolve. Sem `lasting`, o próximo descanso o devolve; com ele, só algo que remova o selo. Um `onRest.save: { "save": saveId, "difficulty": 15, "cures": true }` é rolado primeiro, como os testes do conjunto e com o modificador da própria ficha: só uma falha reduz o máximo, e com `cures` um sucesso encerra a condição (a doença do otyugh). Só a saúde contada em pontos tem um máximo a reduzir. O Mummy Rot de 5e é uma condição sem relógio com `"onRest": { "rests": ["long"], "lowersMax": { "dice": "3d6" }, "lasting": true }`. Uma salvaguarda contada até um fim ou até aquilo em que a condição se transforma (1.258) não para mais quando a luta para: quando qualquer luta termina, inclusive as abandonadas em fuga, as salvaguardas de turno que restam a quem a porta são roladas até o fim, então Contagion já terá sido superado ou se instalado. Uma salvaguarda feita só ao receber dano espera pelo dano.

Estágios de doença (Capability API 1.261). Uma condição de combate pode ter `onDamaged: { "applies": [...] }`, imposto a quem a porta cada vez que recebe dano, com relógio como os de `onEnd` (o atordoamento de Slimy Doom até o fim do próximo turno de quem a porta); `expires: { "becomes": conditionId }`, aquilo em que ela se transforma, sem relógio, quando seu próprio relógio se esgota, inclusive no fim de uma luta, mas não quando é encerrada de qualquer outra forma (a doença do Tentacle de um aboleth depois do minuto dela); e `curedOnlyBy: { "catalogs": [catalogId], "minLevel": 6 }`, para que só uma cura desses catálogos paga nesse nível ou acima a encerre. `onRest.restoredWhenCured: true` (com `lasting`) devolve o que os descansos dessa condição tiraram do máximo quando ela sai, seja como for, inclusive pela própria salvaguarda bem-sucedida. O efeito `cannot-heal-nonmagical` impede toda cura que não seja mágica: numa luta, uma ação cujas qualidades dizem `"magical"`; fora dela, uma operação restore com `"magical": true` (uma poção com a tag `magical` é uma delas); e nunca um descanso; um restore recusado diz `cannot-heal`. A ação de um bloco de estatísticas pode ter `ends`, como uma entrada de catálogo, inclusive com tipos: o Healing Touch de um unicórnio é `"heal": { "dice": "2d8", "flat": 2 }, "ends": { "conditions": ["disease", "poisoned"] }, "targets": "ally"`. Uma cura em que o conjurador escolhe entre as condições, uma maldição entre várias, é `cureOneOf` (1.204).

Qualidades na ação de uma criatura (Capability API 1.262). A ação de um bloco de estatísticas pode ter `qualities`, tags de item que o conjunto declara, como as de uma entrada de catálogo: `["magical"]` torna a cura dela mágica, que `cannot-heal-nonmagical` deixa passar, e uma salvaguarda contra ela, uma salvaguarda contra magia. O uso de um item numa luta leva as tags do próprio item da mesma forma, então uma poção com a tag `magical` cura como magia ali, assim como na ficha.

Auras (Capability API 1.263). Uma condição de combate pode ter `auras`, até quatro: cada uma espalha suas `conditions` a quem estiver a até `distance` de quem a porta, no `side` `allies`, `enemies` ou `all`, e também em quem a porta com `self: true` (não com `enemies`). `when` lê um dos valores da ficha de quem a porta com `atLeast` ou `atMost`, então uma aura pode se abrir num nível. Quem a porta e está caído, derrotado ou com o efeito `cannot-act` não espalha nada. O que uma aura espalha é imposto conforme a luta avança, sai quando os dois se separam (o registro diz `aura` e `parted`), nunca é gravado numa ficha e some quando a luta termina; uma condição que uma aura espalha não pode ter aura própria. Sem tabuleiro, a aura alcança todos do lado dela. Para que quem a porta comece toda luta com a condição, dê às mecânicas de uma entrada de catálogo, ou a um bloco de estatísticas, `keepsOn`: as condições que ele mantém a luta inteira, também nunca gravadas numa ficha. A Aura of Protection de 5e é um `aura-of-protection` mantido cuja aura espalha uma condição que soma o Charisma do paladino às salvaguardas; Holy Nimbus é uma aura sobre os inimigos cuja condição fere no início do turno deles.

Comportamento forçado (Capability API 1.264). Uma condição de combate pode ter `behavior`, que decide o que quem a porta faz com o turno. `only` lista tudo o que o turno pode conter além de encerrá-lo: `move` (andar e se levantar), `escape` (se soltar de uma imobilização) e ações padrão que o conjunto declara; uma lista vazia deixa só encerrar o turno (o halt de Command). `onlyWhenStuck` nomeia ações padrão permitidas só enquanto não houver para onde andar (o Dodge de Turn Undead). `moves: "away"` só anda para longe de quem impôs a condição, nunca um passo mais perto, terminando mais longe; `moves: "toward"` só anda para mais perto (o approach de Command, Sympathy). `table` é rolada no início de cada turno de quem a porta, `{dice, rows: [{atMost, does}]}`, e a primeira linha cujo valor a rolagem não ultrapassa decide o turno: `wander` anda toda a velocidade numa direção que um d8 escolhe e encerra o turno, `nothing` o encerra, `strike` só permite um ataque corpo a corpo contra uma criatura ao alcance que os dados escolhem (amiga ou inimiga; nada sem ninguém ali), e `normal`, como uma rolagem acima de todas as linhas, deixa o turno como está (Confusion, Mindfire). O registro mostra a rolagem como um evento `compelled`, e qualquer outra coisa é recusada como `compelled`. Uma salvaguarda que encerra uma condição também pode ser `at: "action"`: quem a porta gasta a ação para rolá-la (Irresistible Dance).

Mais das auras (Capability API 1.265). As `conditions` de uma aura agora são opcionais, desde que ela espalhe condições, cause dano ou peça uma salvaguarda. `needs` lista sentidos que quem recebe precisa ter, e nem quem a porta nem quem recebe podem estar numa zona cujas `inside.conditions` tirem esses sentidos: Countercharm com `needs: ["hearing"]` para diante de Silence. `harms` `{dice, flat, type}` é causado por quem a porta a todos que a aura alcança no início de cada turno de quem a porta (a Fire Aura de um balor). `save` `{save, difficulty, applies, seen?, immuneOnSuccess?}` é feito por todos que a aura alcança no início do próprio turno: uma falha impõe `applies`, vindo de quem a porta, com essa dificuldade, `seen` só pede a salvaguarda enquanto os dois conseguem se ver (o olhar de um basilisco), e `immuneOnSuccess` mantém a aura de quem a porta longe dessa pessoa pelo resto da luta depois de um sucesso (a Fear Aura de um pit fiend). O `against.casts` de um modificador de salvaguarda o restringe a salvaguardas contra o que é conjurado desses catálogos, inclusive o uso de um item que conjura de um deles, e depois a tudo o mais que ele nomeia: a vantagem de Holy Nimbus contra magias conjuradas por corruptores ou mortos-vivos é `against: { casts: ["spells"], from: { types: ["fiend", "undead"] } }`.

Mais comportamento forçado (Capability API 1.266). Um `behavior` pode ter `drops` `{slots?, tags?, at, pickUp?}`: quem a porta deixa cair cada item vestido que ocupa um dos `slots` ou tem uma das `tags`, e cada ação do bloco de estatísticas cujas `qualities` tenham uma das `tags`, seja quando a condição é imposta (`at: "applied"`, o "drops whatever it is holding" de Fear), seja no início de cada turno de quem a porta (`at: "turn-start"`, o "drop" de Command). O que caiu fica na célula onde a pessoa estava: nenhuma das ações disso é dela (recusadas como `dropped`), não dá nada do que dava enquanto vestido, e sua parte na defesa de quem a porta some (os 2 de um escudo). A pessoa o pega estando nessa célula ou ao lado dela, com o único pegar gratuito do turno, ou pelo orçamento `pickUp` quando a condição nomeia um; o registro mostra `letFall` e `pickedUp`. `onlyWhenStuck: "any"` deixa totalmente livre um turno que começa sem lugar para onde a condição deixe quem a porta andar (o "unless there is nowhere to move" de Fear). `keepsOut` é uma distância a partir de quem impôs a condição: dentro dela, quem a porta só se afasta, e ela só para fora dela enquanto houver algum lugar fora ao alcance (o "can't willingly move to a space within 30 feet of you" de Turn Undead). Uma salvaguarda que encerra uma condição pode ser `unseen: true`, rolada só enquanto quem a porta não consegue ver quem a impôs (a salvaguarda de Fear fora da linha de visão). O `applies` de uma entrada pode ter `destroysUpTo` `[{tier, when?}]`: uma criatura que falha na salvaguarda e cujo nível de ameaça está igual ou abaixo do maior `tier` cujo `when` vale na ficha de quem a usa é destruída na hora (Destroy Undead, ND 1/2 com clérigo de 5º nível até ND 4 no 17º); um personagem, ou uma criatura sem nível, nunca é.

Escolha de alvos por qualquer sentido, alvos próximos entre si, áreas que crescem, mais usos e coisas empunhadas (Capability API 1.267). Uma entrada ou ação de criatura que `needs` sentidos pode acrescentar `needsAny: true`: um alvo que mantenha qualquer um deles serve, e só um a quem faltem todos é recusado (o "each undead that can see or hear you" de Turn Undead). `targetsWithin` é uma distância dentro da qual cada par de alvos escolhidos precisa estar, recusado como `targets-apart` caso contrário (as criaturas a mais de Command com espaços maiores, "within 30 feet of each other"). Uma `area` pode ter `sizePerCostStep`, a distância que seu tamanho cresce para cada passo em que o custo é aumentado (a esfera de Confusion crescendo 5 pés por nível de espaço); uma muralha nunca cresce. Um item com um `use` pode listar `moreUses` `[{label, use}]`: cada um é outra entrada do menu, com o nome do item e seu `label`, usando as mesmas cargas e caindo junto com o item (uma varinha de várias magias). Uma criatura pode listar `held` `[{label, tags, defense?}]`, coisas que ela empunha e que não são ações próprias (um escudo impresso no bloco): uma condição cujo `drops` nomeia uma das `tags` delas as faz cair com as ações marcadas com essas tags, a `defense` delas some da defesa da criatura até que ela as pegue, e cada uma é pega como um item que caiu.

Olhares, e auras conforme quem alcançam (Capability API 1.268). Uma aura pode ter `targetTypes`, lido como o de uma entrada: ela só alcança quem é desse tipo (a Horrific Appearance de uma sea hag, só humanoides). `sourcesOf` nomeia condições: ela só alcança quem impôs uma delas a quem a porta (o Barbed Hide de um barbed devil, ferindo quem o agarra). O `save` de uma aura pode ter `failedBy` `{atLeast, applies}`: uma falha por pelo menos essa diferença impõe essas condições no lugar (o olhar de uma medusa, petrificado na hora numa falha por 5 ou mais). Uma salvaguarda `seen` pode ter `avert: true`: quem ela alcança pode, no próprio turno e sem custo, desviar os olhos de quem a porta; até olhar de novo (também por livre escolha), essa pessoa pula essa salvaguarda e não consegue ver quem a porta, então seus ataques contra ele são feitos sem vê-lo; o registro mostra `averted`, e o diretor mantém os olhos das suas criaturas desviados enquanto houver mais alguém para lutar. Uma salvaguarda que encerra uma condição pode ter `seenLean` (`"advantage"` ou `"disadvantage"`): rolada assim enquanto quem a porta consegue ver quem impôs a condição (a salvaguarda repetida da sea hag, com desvantagem enquanto ela estiver à vista).

Cajados que conjuram com os números de quem os empunha (Capability API 1.269). O `use` de um item pode ler a dificuldade de salvaguarda na ficha de quem o empunha com `sheetDifficulty`, um valor lido como `toHit.sheetBonus` lê um (`{ "derived": "spell_save_dc" }`), no lugar de `saveDifficulty`; seu bônus de ataque já é lido da ficha da mesma forma, com `toHit.sheetBonus` (`{ "derived": "spell_attack" }`) e sem atributos. Um uso com `charges` pode ter `chargeStep` `{max, amount?, targets?}`: quem o usa pode gastar até `max` cargas a mais, cada uma um passo de um custo maior, somando `amount` e `targets` como um espaço maior soma `perCostStep` e `targetsPerCostStep`, e aumentando uma área com `sizePerCostStep` (a magia de um Staff of Power num nível maior, o 1d6 de energia por carga de um Staff of Striking). O menu as oferece como pagamentos chamados `charges:<how many more>`, só tantas quantas o item ainda tiver. A mesma versão aumenta para 320 as condições que um conjunto pode declarar, e o `save` de uma aura pode ter `immuneWhenEnds: true`: quando o que uma falha impôs termina, seja como for (uma salvaguarda, o relógio, uma cura), a aura de quem a porta fica longe dessa pessoa pelo resto da luta, como `immuneOnSuccess` a mantém longe depois de uma salvaguarda bem-sucedida (o "is successful or the effect ends for it" de uma sea hag).

Um tipo nomeado ao conjurar (Capability API 1.270). As `mechanics` de uma entrada de catálogo com `applies` podem ter `kindChoice: true`: quem a usa nomeia um dos `combat.creatureTypes` (um tipo ou uma tag) ao usá-la, oferecido como os modos `kind-<id>`, e o que ela impõe lembra esse tipo. Uma aura do que ela impôs com `chosenKind: true` só alcança criaturas desse tipo, e uma com `orSeen: true` também alcança quem consegue ver quem a porta, por mais longe que esteja; assim, o Antipathy de 5e impõe ao alvo uma condição cuja aura, `side: "all"`, amedronta o tipo escolhido a até 60 pés ou à vista, e os amedrontados se afastam (`moves: "away"`), enquanto os encantados de Sympathy se aproximam. O `saveEnds` de uma condição pode ter `beyond`, na distância do conjunto: a salvaguarda só é rolada enquanto quem a porta estiver mais longe que isso de quem a impôs, e com `unseen` também fora da vista dessa pessoa (o "not within 60 feet of the target or able to see it" de Antipathy).

Mais do que cajados e anéis fazem (Capability API 1.271). O `use` de um item pode ter `label`, mostrado ao lado do nome do item como o rótulo de uma entrada `moreUses` ("Staff of Fire: Burning Hands"); um uso adicional é nomeado pelo próprio `label`. Um uso pode ter `amountAdd`, um valor lido da ficha de quem o empunha e somado à quantidade dele, como o de uma entrada de catálogo (o Cure Wounds de um Staff of Healing, `{ "abilityModFromField": "spellcasting_ability" }`), numa luta e fora dela. Um `chargeStep` pode ter `push`, na distância do conjunto: cada carga a mais empurra o alvo essa distância a mais, além do `push` do próprio uso (os 5 pés por carga de um Ring of the Ram). O `charges.breaksOn` de um item pode ter `regains` `{atLeast, amount}`: quando a última carga dele é gasta e o dado mostra `atLeast` ou mais, o item recebe `amount` cargas de volta em vez disso (o 1d12 + 1 com um 20 de um Staff of the Magi), numa luta, fora dela e quando o inventário gasta uma carga; `atMost` pode então ser omitido para um item que nunca quebra.

Um item que vira outro (Capability API 1.272). O `charges.breaksOn` de um item pode ter `becomes`, outro item do conjunto como `<catalog>/<entry>`, ao lado de `atMost`: nas faces que o quebrariam, o item vira esse outro (o quarterstaff não mágico de um Staff of Striking, ou um Staff of Power que só mantém o +2, escrito como um item que tem apenas isso). Numa luta, os usos dele somem e ele passa a golpear como o novo item, e a luta grava a pilha de volta como esse item, com o nome dele e sem cargas; fora de uma luta e quando o inventário gasta uma carga, a pilha muda da mesma forma. O item nomeado precisa ser outro item do conjunto, seja qual for o arquivo de catálogo em que esteja.

Cargas gastas num acerto (Capability API 1.273). O `attack.spends` de uma arma lista até quatro formas de quem a empunha gastar as cargas do item depois que um golpe com ela acertou: cada uma tem um `label`, as `charges` que custa, um `amount` de dados e uma parte fixa somados ao golpe com seu próprio `type` de dano (o da arma, quando não nomeia nenhum) e, opcionalmente, `blow` (só um golpe `melee` ou `ranged`), `chargeStep` (`max` cargas a mais, cada uma somando de novo seu `amount`: o 1d6 de energia por carga de um Staff of Striking, até três) e `onHit` (até duas condições que o atingido recebe, cada uma com `rounds`, um `save` que a evita ou `saveEnds`: a salvaguarda de Constitution de um Staff of Withering). Numa luta, cada uma é oferecida a quem empunha no próprio acerto com essa arma, e em nenhum outro, depois que o atingido respondeu; os dados dela são rolados com o golpe e dobrados pelo crítico dele, e o dado de última carga do item é rolado como num uso. O item tem cargas.

Números fixados a partir de quem impôs uma condição (Capability API 1.274). Uma condição que uma entrada aplica com `applies` pode ter um `value`, uma referência de valor lida da ficha de quem a aplica quando é imposta (o `{ "abilityModFromField": "spellcasting_ability" }` de Heroism), e o `temporary` de uma condição de combate dá a quem a porta pontos temporários no início ou no fim de cada turno dele (`at`): `dice` e `flat`, mais esse valor com `value: true`, e com `lostWhenEnds` o que resta deles some quando a condição termina, a menos que quem a porta tenha mais do que ela deu por causa de outra coisa. O `save.appliedDifficulty` de uma aura rola a salvaguarda contra a dificuldade de salvaguarda daquilo que impôs a condição da aura a quem a porta, fixada quando ela foi imposta (a CD de salvaguarda de magia do conjurador de Antipathy/Sympathy); seu `difficulty` continua valendo para uma aura que nada impôs. Uma salvaguarda que encerra uma condição `at: "damaged"` pode dizer `bySource`: rolada só com dano vindo de quem impôs a condição (a salvaguarda de Sympathy quando o alvo fere quem a porta). O `behavior.keepsIn` de uma condição impede quem a porta, uma vez a essa distância de quem a impôs, de algum dia andar para mais longe (o "can't willingly move away" de Sympathy). E o `use` de um item pode ter `kindChoice`, como as mecânicas de uma entrada (1.270), então um pergaminho de Antipathy/Sympathy nomeia seu tipo quando é usado.

Condições suspensas em vez de encerradas (Capability API 1.275). Ao lado de `whileSourceInSight`, o `orSourceWithin` de uma condição de combate (uma distância nas unidades do próprio conjunto) a mantém valendo enquanto quem a porta estiver perto assim de quem a aplicou, visto ou não: fora da vista e fora do alcance, ela fica suspensa, ainda em quem a porta e com o relógio correndo, e volta a valer no momento em que qualquer uma das duas coisas for verdade (o medo de Antipathy, a até 60 pés ou à vista). O `suppresses` de uma condição de combate lista outras condições que ela suspende enquanto vale: o que elas fazem para, elas continuam impostas e voltam a valer quando ela termina (o encanto e o medo de Calm Emotions, os de Mindless Rage).

Teleportes (Capability API 1.276). O `mechanics.teleport` de uma entrada de catálogo, o `use.teleport` de um item ou o `teleport` de uma ação de criatura move quem o usa na hora para um lugar livre a até `distance` (nas unidades do próprio conjunto): sem passos no meio, então ninguém o golpeia por sair, e uma zona onde ele aterrissa o pega como se tivesse entrado andando. Só num tabuleiro, então exige `combat.distance`; fora de um tabuleiro, uma ação que só teleporta não é oferecida. Com `seen`, só um lugar que quem o usa consegue ver agora (uma muralha, uma neblina ou uma cegueira que tira os olhos mantém fora da lista as células atrás dela): o Misty Step de 5e, `{ "distance": 30, "seen": true }`. `carries` (de 1 a 8) leva essa quantidade de criaturas dispostas do lado de quem o usa, não maiores que ele, de dentro de `carriesWithin` (tocando, quando omitido), e cada uma aterrissa o mais perto de quem o usou que houver espaço: Dimension Door, `{ "distance": 500, "carries": 1, "carriesWithin": 5 }`. Uma ação de criatura com teleporte recai sobre a própria criatura (o Teleport de um blink dog). A opção lista as células para onde ele pode ir como `teleport.cells`, e quem pode ir junto como `teleport.carries`; uma escolha nomeia a célula como `at` e a companhia como `carries`. Um teleporte nunca é uma área nem uma reação.

Seis condições de uma vez, e visão que realmente vê (Capability API 1.277). `applies` comporta até 6 entradas nas mecânicas de uma entrada de catálogo, no uso de um item e numa ação de criatura (4 antes): Rage e Frenzy acrescentam cada uma a condição de Mindless Rage ao lado das suas quatro. E `whileSourceInSight` (com `orSourceWithin` ao lado) agora lê a visão do próprio portador, como faz o `orSeen` de uma aura: uma linha desimpedida no tabuleiro ainda é necessária e, além disso, quem a porta precisa ver a origem com os olhos ou com os sentidos, então uma cegueira que tira os olhos, uma neblina que obscurece, a escuridão além do que ele enxerga ou uma origem que ele não vê (invisível) a rompem, como uma muralha.

Calm Emotions (Capability API 1.278). Uma salvaguarda pode dizer `alliesMayFail: true` (no `save` de uma entrada de catálogo, do uso de um item ou de uma ação de criatura): um alvo do próprio lado de quem a usa a deixa entrar e falha sem rolar, e o registro diz isso, enquanto qualquer outra pessoa rola como sempre. Os `effects` de uma condição podem ter `cannot-target-source-side`: quem a porta não aponta nada para quem a impôs nem para ninguém do lado dessa pessoa, a menos que esse lado seja o do próprio portador (aí ela não impede ninguém). `endsWhen` aceita mais dois fins além de `damaged` e `harmed-by-source-side`, até os quatro: `attacked`, uma rolagem de ataque feita contra quem a porta por qualquer pessoa, acertando ou errando (uma ação que acerta sem rolar não conta), e `ally-harmed-in-sight`, dano a qualquer outra pessoa do lado de quem a porta que ele vê (uma linha desimpedida no tabuleiro e os próprios olhos ou sentidos). E `endsWhenHarmedFrom` lista catálogos: um ferimento a quem a porta vindo de qualquer coisa conjurada de um deles, por qualquer pessoa, inclusive a magia de um pergaminho e uma zona de pé, a encerra; ferimento é dano, ou ser alvo de uma ação nociva, como em `harmed-by-source-side`, e conjurar de novo a mesma condição a renova em vez de encerrá-la. Cada um desses espera o passo que o causou terminar. E uma condição que a condição ativa do próprio portador suspende com `suppresses` não é mais encerrada por uma imunidade que essa mesma condição dá: ela fica suspensa, não curada, então um medo que já estava ativo quando começa uma fúria imune a medo volta quando a fúria termina (o Mindless Rage de 5e), enquanto novos medos continuam sem efeito.

Teleportes para fora da luta, passageiros vistos e fumaça (Capability API 1.279). Um `teleport` (numa entrada de catálogo, no uso de um item ou numa ação de criatura) aceita mais três chaves. `leaves: true`: ele pode tirar quem o usa da luta por completo, a milha de um unicórnio, em vez de levá-lo a uma célula; a escolha então não nomeia `at` (o menu mostra um botão "Leave the fight"), e quem o usa e quem vai junto somem vivos (mostrados como "Left the fight", com a saúde mantida, e nada os traz de volta). Fora de um tabuleiro, sair é o único lugar para onde ele vai, e qualquer um que esteja de pé do lado de quem o usa pode ir junto, já que nada mede quem está perto. Um grupo que está fora da luta com alguém que saiu dessa forma fugiu (o resultado `fled`, que encerra a luta como uma fuga); um inimigo que saiu dessa forma não foi vencido nem continua de pé, mas escapou, e o resumo diz isso. As criaturas do próprio diretor saem com um quarto da saúde ou menos, levando quem puderem. `carriesSeen: true` (com `carries`): só quem o usuário consegue ver pode ir junto, as "willing creatures it can see" de um unicórnio. E `smoke` (`{}`, ou `{ "pierced": [senses] }`): uma nuvem fica nas células que quem o usou deixou e nas células onde aterrissa, obscurecendo como o `obscures` de uma zona, do momento em que ele aterrissa até o fim do próximo turno de quem o usou, a fumaça da Cape of the Mountebank.

Um teleporte que golpeia (Capability API 1.280). O teleporte de uma criatura pode nomear uma das próprias ações como `strike` (o `id` dela): o "Before or after teleporting, the dog can make one bite attack." de um blink dog. Teleportar então permite que essa ação venha em seguida uma vez neste turno, sem custo (o menu diz "Free, part of the same action"), e o menu também a oferece na ordem inversa, como "Bite, then Teleport", no orçamento do teleporte, depois do que o teleporte vem em seguida uma vez sem custo. Nenhum dos dois leva a um terceiro. O golpe feito primeiro gasta os usos e a recarga do teleporte junto com os próprios, e só é oferecido enquanto restarem os dois. O golpe é outra ação simples da mesma criatura: não o próprio teleporte, uma sequência, outro teleporte, uma reação ou algo comprado com pontos. Só o teleporte de uma criatura nomeia um; o de uma entrada de catálogo ou do uso de um item é recusado. Numa luta que não mede distância, um teleporte não vai a lugar nenhum, então nada é combinado. O diretor também o usa: uma criatura longe demais para andar até a presa se teleporta para o lado dela e morde no mesmo turno.

Golpes que drenam (Capability API 1.281). As `mechanics` de uma entrada de catálogo ou a ação de uma criatura podem ter `drain`: quem a usa recupera saúde igual ao dano que o golpe causou a cada alvo, depois das resistências, arredondada para baixo e nunca acima do máximo, e nada sai do máximo do alvo (para isso, veja `reducesMax`). `share` (acima de 0, até 1; tudo, quando omitido) é quanto disso volta, e `damageType` conta só o dano desse tipo: o Psychic Drain de um aboleth é `drain: {}`, Vampiric Touch é `drain: { "share": 0.5, "damageType": "necrotic" }`. O que impede cura também impede isso. Uma drenagem precisa de dano para devolver, então uma numa entrada sem `amount`, numa cura ou numa ação de criatura sem `damage` é recusada.

Explosões centradas em quem as usa (Capability API 1.282). Uma `area` (de uma entrada de catálogo ou de uma ação de criatura) pode dizer `around: true`: uma explosão de `size` centrada em quem a usa e nunca mirada. Todos a até `size` de quem a usa são pegos quando ela é usada, amigos e inimigos, a menos que `friendlyFire` seja falso (uma que cura pega só o próprio lado de quem a usa), e nunca quem a usa. Uma parede entre eles deixa uma criatura de fora, a menos que a área também diga `throughWalls: true`: o Channel Negative Energy de um mummy lord, "including ones behind barriers and around corners". Numa luta sem tabuleiro, ela pega todos. Ela não é apontada para ninguém, então funciona tanto como uma ação característica comprada entre turnos quanto num turno. Só uma explosão única é centrada em quem a usa (sem `copies`), `throughWalls` só vai com `around`, e a explosão de uma entrada ao redor de quem a usa acontece na hora, então não deixa `zone`. Channel Negative Energy é uma ação de criatura com `signature: { "cost": 2 }`, `area: { "shape": "burst", "size": 60, "around": true, "throughWalls": true }` e `applies` uma condição com o efeito `cannot-heal` por `{ "rounds": 1, "of": "source" }`, até o fim do próximo turno do mummy lord. O diretor avalia uma pelos que ela pega, como avalia uma forma mirada.

Movimentos lendários (Capability API 1.283). Uma ação de criatura com custo `signature` pode dizer `move` e nada mais do que faz: quem a usa anda entre turnos, escolhendo uma casa no tabuleiro como numa caminhada no próprio turno, com um deslocamento emprestado só para esse movimento, então o movimento do próprio turno fica intacto. `move: { "share": 0.5 }` é uma fração da velocidade (uma tarrasque "moves up to half its speed"), `move: { "distance": 60 }` uma distância na unidade do próprio conjunto, e `move: {}` a velocidade inteira; nunca `share` e `distance` juntos. Ela é golpeada ao sair do alcance de alguém, como em qualquer caminhada, e a janela em que foi comprada segue sendo consultada assim que o golpe acerta. `noOpportunity: true` não provoca ninguém (um vampiro "moves up to its speed without provoking opportunity attacks"). `untouchable: true` é um movimento que nada pode ferir ou deter (o Whirlwind of Sand de um mummy lord, `{ "distance": 60, "untouchable": true }`): o que estiver segurando quem a usa solta primeiro, ninguém o golpeia, e nenhuma zona ou terreno que ele atravesse lhe faz nada. Uma criatura imobilizada, ou sem velocidade, não tem para onde ir com nenhum outro movimento. Nada é oferecido fora de um tabuleiro. O diretor compra um como compra um teleporte: para se afastar de um inimigo ao lado quando está muito ferido, ou para se aproximar de um quando nenhum está ao alcance.

Conjurações lendárias (Capability API 1.284). Uma ação de criatura com custo `signature` pode dizer `casting` e nada mais do que faz: entre turnos, ela oferece cada magia que quem a usa poderia conjurar no próprio turno com o `budget` da ação, vinda do seu `spellcasting` ou das magias da ficha, chamadas "Cast a Spell: Fireball" e assim por diante. Cada uma é mirada, paga e resolvida exatamente como no turno da criatura (alvos, uma célula para uma área, um espaço ou um uso gasto como sempre), e os pontos são gastos no lugar do orçamento, então o próprio turno mantém todos os orçamentos que tinha. `casting: { "cantripsOnly": true }` só oferece truques (magias pagas sem nenhuma reserva): o Cantrip de um lich, `signature: { "cost": 1 }`. O Cast a Spell de uma esfinge é `casting: {}` com `signature: { "cost": 3 }`. Tudo o que a magia abre (um Counterspell, uma reação a ser ferido por ela) é respondido como num turno, e a janela em que ela foi comprada segue sendo consultada depois que tudo isso se fechou. O diretor compra uma quando a magia vale os pontos, como avalia qualquer outra ação característica.

Mover-se depois da ação, e com uma única velocidade (Capability API 1.285). Uma ação característica que faz algo (dano, uma área, uma salvaguarda, uma condição) também pode ter um `move`: o que ela faz acontece primeiro, e depois quem a usa pode se mover para uma casa que o menu ofereceu, escolhida junto com a ação; não escolher nenhuma também é uma escolha, e uma casa que ela não consegue mais alcançar depois do que fez simplesmente não é percorrida. Um `move` também pode nomear uma forma de se mover com `speed` (`walk`, `fly`, `swim`, `climb` ou `burrow`): seu `share` é lido só dessa velocidade, ele se move só dessa forma, e uma criatura sem essa velocidade não tem para onde ir. O Wing Attack de um dragão é a explosão ao redor dele (`area: { "shape": "burst", "size": 10, "around": true }`, a salvaguarda e a queda) com `move: { "share": 0.5, "speed": "fly" }`: "The dragon can then fly up to half its flying speed." Um `move` continua sem `teleport`, `sequence`, `reaction` ou `charge`. O diretor voa para longe depois do golpe de asas quando está muito ferido ao lado de um inimigo, ou se aproxima de um que está fora do alcance.

Obscurecimento leve e o vento (Capability API 1.286). O `obscures` de uma zona, ou o `smoke` de um teleporte, pode dizer `light: true`: então ele não esconde ninguém e só obscurece levemente quem é visto através dele ou está nele, como fazem a penumbra de 5e ou a fumaça de uma Cape of the Mountebank (o Engine sabe quem é visto dessa forma; Hide e Perception leem isso). Também pode dizer `dispersed: true`: uma zona cuja regra diz `disperses: true` o encerra então onde quer que os dois se encontrem, depois de cada ação, junto com a concentração que o mantém. O Fog Cloud de 5e é `obscures: { "dispersed": true }`, e o Gust of Wind dele, uma zona com `disperses: true`; Darkness não diz nenhum dos dois, então o vento o deixa em paz. Uma zona que só dispersa não precisa de gatilho.

Esconder-se, Search e Detect (Capability API 1.287). `combat.hiding` torna real a ação padrão `hide`: `{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }` nomeia dois dos `combat.checks` e, opcionalmente, `passive` (10), `lightly` (5) e os `combat.components` que fazem barulho. Hide rola `stealth` nos próprios dados da luta; quem o usa fica então escondido de cada oponente que não o vê claramente (atrás de uma parede, numa neblina, invisível, ou vendo-o só levemente obscurecido) e cuja Perception passiva, `passive` mais seu teste `perception` e `lightly` a menos quando o vê só levemente obscurecido, o total alcança. Um oponente de quem ele está escondido não o vê, então não pode apontar nada para ele, ele o ataca como alguém que não é visto, e `combat.sight.unseenAttacks` dá vantagem a esse ataque. O esconderijo dura de um turno para outro e termina: para todos, assim que quem se escondeu ataca, faz uma disputa, fere alguém ou pede uma salvaguarda, ou usa qualquer coisa que precise de um componente `noisy` (uma magia sem componente verbal, ou uma neblina colocada, o mantém escondido); e para cada oponente que passa a vê-lo claramente ou cuja passiva agora supera o total, depois de qualquer passo e em cada célula de uma caminhada. A ação padrão `search` (acrescente-a a `combat.standard`; ela exige `combat.hiding`) rola `perception` e encontra, para quem procura, todos que estão escondidos dele cujo total ela alcança. Uma ação de criatura com `search: true` faz o mesmo e nada mais: um Detect lendário é `{ "name": "Detect", "budget": "action", "signature": { "cost": 1 }, "search": true }`. Uma criatura lê os dois testes nos próprios `checks`. O diretor procura quando todos os oponentes que tem estão escondidos dele, e usa um Detect entre turnos quando algum está. Fora de um tabuleiro, ninguém pode estar escondido, a não ser por uma condição que já o esconde.

Preparar (Capability API 1.288). `combat.readying: { "budget": "reaction" }` torna real a ação Ready: para cada opção que quem a usa poderia fazer agora com o orçamento `standard` (um ataque, uma magia, uma ação de criatura) e para uma caminhada, o menu oferece duas entradas, preparadas para quando um oponente chegar ao alcance (`comes`) ou para quando um agir (`acts`). Escolher uma gasta o orçamento padrão e retém essa opção até o início do próximo turno de quem a usou. Quando a caminhada de um oponente o leva, em qualquer passo, a um lugar para onde a opção retida poderia ser apontada (e quem a retém o vê), ou um oponente termina qualquer coisa que faça ali, uma janela consulta quem a retém, que usa a opção chamada `readied` com `budget` (a reação de 5e) ou a deixa passar e não é consultado de novo nessa caminhada. Uma caminhada retida vai até onde alcança a velocidade inteira de quem a retém, e sair do alcance de alguém nela dá ataques de oportunidade, como qualquer caminhada. Com `"concentrates": true` (exige `combat.concentration`), uma magia é paga quando é preparada e mantida por concentração: dispará-la não a paga de novo, perder a concentração a perde, e uma que nunca dispara continua gasta. Preparar qualquer outra coisa não paga nada até ela disparar. A de 5e é `{ "budget": "reaction", "concentrates": true }`.

Dispersão lenta (Capability API 1.289). O `dispersed` de uma neblina pode ser `{ "after": N }` em vez de `true`: um vento que a alcança só a encerra depois de soprar sobre ela N rodadas inteiras seguidas, contadas a partir do turno em que a alcançou pela primeira vez. Um vento que deixa de alcançá-la antes disso, movido, encerrado ou sumido, reinicia a contagem quando um a alcançar de novo. O Stinking Cloud de 5e, que um vento forte como Gust of Wind dispersa depois de 1 rodada, é `"obscures": { "dispersed": { "after": 1 } }`.

Procurar quem está escondido, com peso (Capability API 1.290). Um teste da luta lido de uma perícia (`{ "skillMod": "stealth" }`) agora conta como teste dessa perícia na rolagem, então uma mudança restrita a ela por `skills` se aplica em Hide, Search e disputas: a desvantagem de armaduras pesadas em Stealth, o +10 de Pass without Trace, a vantagem em Perception de Eyes of the Eagle. `combat.hiding.passiveMode` (o 5 de 5e) é somado a uma Perception passiva com vantagem e tirado de uma com desvantagem; sem ele, uma passiva não lê nenhum modo. Uma mudança `{ "to": "checks-taken", "skills": ["perception"], "mode": "disadvantage" }` aplica esse modo aos testes feitos para encontrar quem a porta, tanto à passiva de um oponente quanto à Search dele; ela aceita um `mode` e nada mais. O Cloak of Elvenkind de 5e. Quando uma Search descobre que alguém muda a forma como ela é rolada para essa pessoa, ela rola de novo só para ela, e o registro também mostra essa rolagem.

As formas próprias de uma criatura se esconder e procurar (Capability API 1.291). A ação de uma criatura pode ser uma permissão, `"standard": { "actions": ["disengage", "hide"] }`: essas ações padrão (de `combat.standard`) feitas com o orçamento da própria ação, como o Nimble Escape do goblin de 5e com a ação bônus. Com `"while": "obscured"`, ela só vale enquanto a criatura estiver numa neblina ou bruma, ou numa luta travada na penumbra ou na escuridão: o Shadow Stealth da sombra. Os `checkModes` de uma criatura rolam duas vezes os próprios testes com algumas perícias: `{ "skills": ["perception"], "mode": "advantage", "sight": true }` só enquanto ela consegue ver (Keen Sight), com `"light": ["sunlight"]` só nessa luz (Sunlight Sensitivity, com `"mode": "disadvantage"`), e com `"terrain": ["snow"]` só numa casa do tabuleiro ou num tipo de lugar que ele nomeia (Snow Camouflage; os lugares são os do gerador tático: neve, caverna, montanhas, água e os demais). O `passive` de uma criatura é a Perception passiva impressa, usada no lugar de `hiding.passive` mais o teste dela (exige `combat.hiding`). A luz em que uma luta é travada vem da hora do dia da cena: luz do sol de dia ao ar livre, penumbra ao amanhecer e ao entardecer, escuridão à noite, e luz forte que não é do sol em ambientes fechados ou quando a hora não diz nada que o Engine leia. A luz só afeta o que a lê (esses modos e `while: "obscured"`). Sem `combat.sight.darkness` (1.294), ela não muda quem consegue ver quem.

As formas próprias de alguém se esconder e encontrar quem está escondido (Capability API 1.292). O `mechanics.hiding` de uma entrada de catálogo (de qualquer tipo, inclusive `utility`) e o `hiding` de uma criatura são permissões lidas onde `combat.hiding` esconde de verdade. `"behindLarger": true` permite a quem o tem se esconder atrás de alguém pelo menos um tamanho maior que esteja entre ele e quem olha, em toda linha entre os dois (o Naturally Stealthy de um halfling; exige `combat.sizes`). `"still": 10` soma isso ao total de Stealth quando ele se esconde, tirado de novo assim que ele se move ou faz uma ação (o Hide in Plain Sight de um patrulheiro). `"slow": "advantage"` rola o Hide com vantagem quando ele não andou mais que metade da velocidade neste turno (o Supreme Sneak de um ladrão). `"aware": { "within": 10, "lostWith": ["deafened"] }` significa que ninguém a essa distância, na unidade do próprio conjunto, está escondido dele, a menos que ele tenha uma dessas condições (o Blindsense de um ladino). O `"starts": 15` de uma criatura começa a luta escondida à vista de todos com esse total, de quem tem uma Perception passiva que não o supera, veja-a claramente ou não, até ela se mover, e ela se esconde assim de novo com a ação Hide (o Transparent de um gelatinous cube).

As próprias rolagens de ataque de uma criatura roladas duas vezes (Capability API 1.293). Os `attackModes` de uma criatura valem onde valeriam seus `checkModes`: `{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }` é o Sunlight Sensitivity de 5e, desvantagem nos ataques enquanto ela consegue ver e a luta é travada à luz do sol. Cada modo diz onde vale, com `sight`, `light` ou `terrain`. O modo se junta a todas as outras vantagens e desvantagens da rolagem, então as duas continuam se anulando.

A escuridão (Capability API 1.294). Com `combat.sight.darkness`, a luz em que uma luta é travada impede os olhos de ver: `{ "seeIn": ["darkvision"], "pierced": ["truesight"], "carried": { "bright": 20, "dim": 20 } }`. Ninguém na escuridão é visto, e ninguém na penumbra é visto claramente, exceto por um sentido de `seeIn` dentro do alcance, que vê a escuridão como penumbra e a penumbra como luz forte, ou por um sentido `blind` ou um de `pierced` dentro do alcance, que veem seja qual for a luz. O que ilumina a escuridão: `carried`, a luz que todos que lutam com ficha carregam, a menos que um sentido de `seeIn` os alcance (uma tocha); `light` numa condição (o truque Light), no efeito `worn` ou `carried` de um item (uma lanterna) ou numa criatura (bandidos com tochas, um elemental do fogo). Cada um é `{ "bright": N, "dim": N }` na distância do próprio conjunto: luz forte até essa distância, penumbra por mais essa mesma distância. Paredes barram a luz, e quem foi derrubado não emite nenhuma. Onde a escuridão é real, tudo o que lê a luz a lê onde alguém está: quem vê quem (ataques contra quem não é visto, esconder-se, uma criatura que você possa ver), estar obscurecido (`while: "obscured"`) e os `checkModes` e `attackModes` de uma criatura. Uma luta numa caverna ou numa masmorra é travada na escuridão a qualquer hora.

Apagar uma luz e acendê-la de novo (Capability API 1.295). Quem carrega a luz `carried` tem no menu um botão para ela, com o nome do seu `label` (`"Torch"`; "Light" quando não diz nenhum). Custa o `budget` dela, quando nomeia um, e caso contrário é gratuito uma vez por turno. Uma luz apagada não emite nada, então quem a carrega pode passar despercebido na escuridão; acesa de novo, ele é visto, e encontrado, se estava escondido. Um item com `toggle` só emite a `light` do seu efeito enquanto está ligado, como faz uma lanterna com capuz.

Luzes ligadas e desligadas por criaturas e itens (Capability API 1.296). Uma ação de criatura com `"sheds": { "bright": 10, "dim": 10 }` define a luz que quem a usa emite a partir de então, e `"sheds": "out"` a apaga. Ela não faz mais nada e não aponta para ninguém: o Ignited Illumination do magmin são duas ações assim na ação bônus, e o Variable Illumination de um will-o'-wisp é uma ação para cada alcance. Uma criatura com `"unlit": true` começa a luta com a `light` apagada, o que exige uma das suas ações para acendê-la. O `toggle.offLight` de um item é a luz que ele emite enquanto está desligado, no lugar da do seu efeito: uma lanterna com o capuz abaixado emite `{ "bright": 0, "dim": 5 }`. Uma luz sem alcance de luz forte só emite penumbra, mesmo onde está sendo segurada.

Luz de zonas, e luz que encerra a escuridão ou mostra o invisível (Capability API 1.297). O `lights` de uma zona de magia (em pés, como qualquer `light`) ilumina só as células da própria zona, medido a partir do centro: o ponto em que uma explosão é conjurada ou, numa zona mantida pelo conjurador, o próprio conjurador, então uma lanterna furta-fogo é um cone de 60 pés ancorado no conjurador com `"lights": { "bright": 60, "dim": 60 }` que não ilumina nada atrás dele. Dancing Lights é uma zona de ponto que se move, com `{ "bright": 0, "dim": 10 }`. Uma zona que obscurece com `"obscures": { "darkness": true }` é escuridão mágica, e uma zona com `"dispelsDark": { "upTo": 3 }` encerra toda escuridão desse tipo que suas células encontram cujo espaço era desse nível ou menor, quando qualquer uma das duas é conjurada: Daylight. Uma luz com `"reveals": true`, numa zona, num efeito de item, numa condição ou numa criatura, mostra todos que não são vistos por causa de uma condição e estão na sua luz forte: uma lantern of revealing. Qualquer uma dessas exige Capability API 1.297.

Luz escondida por uma condição, e luz do sol (Capability API 1.298). O `"lightOutWhile": ["invisible"]` de uma criatura apaga a própria luz dela, seja o que for que suas ações tenham definido por último, enquanto qualquer uma dessas condições estiver nela, e a traz de volta quando a condição termina: a Invisibility de um will-o'-wisp também esconde a luz dele. Uma luz com `"sunlight": true`, numa criatura, num efeito de item, numa condição ou numa zona, torna sua luz forte luz do sol, que é o que `"light": ["sunlight"]` num modo de teste ou de ataque lê: uma sun blade contra Sunlight Sensitivity. A luz do sol dela também conta sobre um tabuleiro já iluminado.

Escuridão mágica contra luz (Capability API 1.299). Uma zona de escuridão mágica (`"obscures": { "darkness": true }`) com `"dispelsLight": { "upTo": 2 }` apaga a luz criada por uma magia desse nível ou menor, onde quer que as duas se encontrem e seja qual for a que veio primeiro: o `lights` de uma zona, ou o `light` de uma condição imposta por uma magia, que termina junto com a concentração da magia quando é ela que a mantém (o Darkness de 5e sobre Flame Blade). Só luz mágica ilumina as células de uma escuridão mágica, seja qual for a luz em que a luta é travada: a luz de uma magia numa zona ou numa condição sempre é, e qualquer outra luz é quando diz `"magical": true` (a de uma sun blade); uma tocha dentro da escuridão não ilumina nada ali. Um `dispelsDark` com `"within": 60` só encerra a escuridão a essa distância do seu centro: a esfera de luz forte de Daylight, não a penumbra além dela. Qualquer uma dessas exige Capability API 1.299.

O acréscimo de um custo maior só a cada tantos passos (Capability API 1.300). `"perCostStepsEvery": 2` soma `perCostStep` uma vez a cada dois passos de um custo maior, em vez de a cada passo. Uma ação que uma condição dá (1.236) agora cresce pelo custo com que foi paga a magia que impôs a condição, com os próprios `perCostStep`, `perCostStepsEvery` e `perCostStepsMax`: o golpe de Flame Blade de 5e é `3d6` com `"perCostStep": { "dice": "1d6" }, "perCostStepsEvery": 2`, então uma lâmina invocada com um espaço de 4º nível golpeia com 4d6. Usar `perCostStepsEvery` exige Capability API 1.300.

Zonas levadas por alguém, e cópias colocadas separadas (Capability API 1.301). O `"carried": "any"` de uma zona faz uma explosão colocada numa célula onde alguém está ir aonde essa pessoa for, centrada nela: o Darkness ou o Daylight de 5e sobre um objeto que ela segura. Com `"own"`, só uma célula onde o conjurador está conta, para uma magia que só pode ser conjurada sobre um objeto que o próprio conjurador segura. Colocada numa célula vazia, ela fica ali. Uma zona levada é uma única explosão num ponto e nunca é movida por conta própria. O `"copiesWithin": 20` de uma área coloca suas `copies` com o centro de cada uma a até 20 pés do de outra, em vez de encostadas, e uma zona de cópias que o conjurador pode mover com `move` move todas da mesma forma: o Dancing Lights de 5e é uma explosão de 10 pés com `"copies": 4, "copiesWithin": 20` e `"lights": { "bright": 0, "dim": 10 }`. Qualquer um dos dois exige Capability API 1.301.

Entradas que mudam outra (Capability API 1.302). Uma entrada que está numa lista da ficha com `"amends": [{ "entry": "spells/eldritch-blast", ... }]` muda essa entrada de quem a tem toda vez que ela é usada, e várias se acumulam. `"damageAdd"` (um valor, como `{ "abilityMod": "cha" }`) é somado ao dano dela em cada acerto: Agonizing Blast. `"range"` (na distância do conjunto) é a distância dela quando for maior: os 300 pés de Eldritch Spear. `"push"` empurra quem ela acerta essa distância em linha reta, e `"pushOptional": true` também a oferece como "Eldritch Blast (no push)": Repelling Blast. Uma distância ou um empurrão exige `combat.distance`, e a entrada nomeada precisa existir. Exige Capability API 1.302.

Usos só em certas luzes, e condições que se mover ou agir encerra (Capability API 1.303). Uma entrada com `"usableIn": { "light": ["dark", "dim"] }` só é oferecida enquanto quem a usa estiver numa dessas luzes: One with Shadows. O `endsWhenHolder` de uma condição também pode dizer `"moves": true` (ela termina quando quem a porta se move) ou `"acts": true` (ela termina quando quem a porta faz uma ação, ataca ou conjura), ao lado de `attacks` e `casts`: as sombras escondem um bruxo que fica parado. Exige Capability API 1.303.

Uma vez por criatura até um descanso (Capability API 1.304). Uma entrada com `"oncePerTarget": { "until": "long" }` (um descanso que o conjunto declara) não é oferecida contra uma criatura em que já foi usada até quem a usa fazer esse descanso, por mais lutas que haja no meio: Chains of Carceri. Em quem ela foi usada fica guardado pelo nome na ficha viva de quem a usa, e só esse descanso o limpa. Não vale numa área nem numa entrada apontada para quem a usa. Exige Capability API 1.304.

Alvos que crescem com a ficha, e o mesmo alvo de novo (Capability API 1.305). `"targetsScale": { "from": { "field": "level" }, "table": [[1, 0], [5, 1], [11, 2], [17, 3]] }` soma essa quantidade de alvos em cada patamar do que lê, como `scales` soma dados. Com `"targetsRepeat": true`, o mesmo alvo pode ser escolhido mais de uma vez, e cada escolha é um ataque próprio com rolagem própria, levando tudo o que modifica a entrada: os raios de eldritch blast, com o dano de Agonizing Blast e o empurrão de Repelling Blast em cada um. O seletor de alvos da luta acrescenta um raio por clique enquanto houver espaço, e o Engine, ao jogar por um combatente, coloca os raios que sobrarem no alvo que escolheu. Nenhum dos dois vale numa área nem numa entrada apontada para quem a usa. Exige Capability API 1.305.

Uma arma posta na mão (Capability API 1.306). Uma entrada `"utility"` com `"conjures": { "items": ["gear/longsword", ...], "proficient": true, "qualities": ["magical"], "binds": { "tags": ["magic"] } }` coloca uma dessas armas corpo a corpo na mão de quem a usa pelo resto da luta, escolhida quando é usada, como o modo de uma arma; `binds` também oferece cada arma empunhada que coincide com ela, que passa então a contar como esta. Com `proficient`, ela é usada com proficiência, e seus golpes levam `qualities`. Outro uso a substitui, e uma arma vinculada volta a ser o que era. As modificações da entrada que a invoca chegam à arma: o `"damagePlus": { "add": { "abilityMod": "cha" }, "type": "necrotic", "atLeast": 1 }` de uma modificação soma dano do próprio tipo num acerto (Lifedrinker), e `"strikes": 2` faz um gasto do orçamento do ataque comprar essa quantidade de ataques (Thirsting Blade). O Engine, ao jogar por um combatente, põe na mão uma vez a arma que acerta com mais força. Exige Capability API 1.306: Pact of the Blade.

O que o próprio usuário mantém (Capability API 1.307). A ação de uma criatura pode dizer `"concentration": true`, como uma entrada de catálogo: o que ela impõe termina quando essa concentração termina, e o dano a testa como de costume. A Invisibility de um imp ou de um quasit. O `endsWhenHolder` de uma condição também pode dizer `"uses": ["scare", "spells/bolt"]`: ela termina quando quem a porta usa uma dessas, as ações da própria criatura pelo ID ou entradas de catálogo como `<catalog>/<entry>`. A invisibilidade de um quasit termina quando ele usa o Scare. O `"appliesSelf": [{ "condition": "mote", "duration": { "rounds": 10 } }]` de uma entrada impõe essas condições a quem a usa quando ela é usada, aconteça o que acontecer com os alvos, mantidas pela concentração dela quando tem uma, no nível em que foi conjurada: o mote de Sunbeam, uma condição de combate com `light` e `"actions": ["spells/sunbeam-line"]` para os raios seguintes. Uma criatura que está sempre invisível não precisa de nada novo: `keepsOn: ["invisible"]` (1.263) a mantém. Exige Capability API 1.307.

O que ficou de fora de 1.303 a 1.306 (Capability API 1.308). O `use` de um pergaminho ou de uma varinha pode ter `targetsScale` e `targetsRepeat`, lidos da ficha de quem o usa: um pergaminho de eldritch blast dispara um raio a mais quando quem o lê está no 5º nível, e os dardos de uma varinha podem ir todos para uma única criatura. Exige Capability API 1.308. Três mudanças não precisam de chave nova. Uma reação é agir: uma condição cujo `endsWhenHolder` diz `"acts": true` também termina com qualquer reação que quem a porta fizer, como One with Shadows termina com "a reaction". `oncePerTarget` distingue duas criaturas com o mesmo nome: Chains of Carceri num imp deixa o outro imp em paz, e o imp de uma luta posterior só fica barrado quando o nome era dessa criatura específica. Uma arma posta na mão (1.306) pode ser uma arma corpo a corpo de arremesso (um ataque com `reach` e `range`, como uma adaga ou um dardo). Ela é dispensada sem gastar ação pelo menu da luta e some quando quem a criou morre. Ela nunca fica a mais de 5 pés de quem a criou, porque uma luta nunca a tira da mão dessa pessoa.

O que o esconderijo exige, Feral Senses, surpresa e o ritual de vínculo (Capability API 1.309). Um `hiding` com `still` pode dizer `"stillWhile": { "holds": "camouflaged", "wall": true }`: o bônus só conta enquanto quem o tem mantém essa condição (a camuflagem feita antes, com uma entrada utility de 1 minuto ou marcada antes da luta) e, com `wall`, está ao lado de uma célula que bloqueia a visão. Isso é Hide in Plain Sight. `"unseenStrikes": true` remove a desvantagem de atacar alguém que quem o tem não consegue ver, que é a primeira metade de Feral Senses. A segunda metade não precisa de nada, porque uma luta já sabe onde está toda criatura que não está escondida. O `hiding` de uma criatura com `starts` pode dizer `"surprises": true`: todos de quem ela começa escondida começam a luta surpresos, como faz o Transparent de um gelatinous cube. Um `conjures` com `binds` pode nomear um campo de texto vivo em `"boundIn"`: só a arma empunhada escrita ali é vinculada, e nenhuma enquanto ele estiver vazio. Escrever o nome ali é o ritual de uma hora feito fora da luta, durante um descanso curto. Exige Capability API 1.309.

Repetições e condições que terminam à distância (Capability API 1.310). As mecânicas de uma entrada de concentração podem dizer `"repeats": { "budget": "action" }`: enquanto quem a usa se concentra nela, o efeito dela é oferecido de novo nesse orçamento, sem custar nada da ficha, sem iniciar uma nova concentração e sem impor nada de novo a quem a usa, no nível e no passo de custo em que a conjuração foi paga. O menu a mostra como "Vampiric Touch again". `"notSaved": true` nunca a oferece contra uma criatura que passou numa salvaguarda contra esta conjuração (Eyebite), e `"sameTargets": true` só a oferece contra quem foi alvo da conjuração (Heat Metal, numa ação bônus). `repeats` exige `concentration` e um orçamento conhecido. Um `applies` pode dizer `"endsAway": { "beyond": 60, "unseen": true }`: a condição sai assim que quem a porta estiver mais longe que isso de quem a impôs e, com `unseen`, não conseguir vê-lo. Esse é o pânico de Eyebite. Isso é verificado em cada passo de uma caminhada, de qualquer pessoa, e no fim de cada turno. Exige Capability API 1.310.

O que ficou de fora de 1.307 e 1.309 (Capability API 1.311). O `use` de um item pode ter `appliesSelf`, como as mecânicas de uma entrada: um pergaminho de Sunbeam deixa o mote, e com ele os raios seguintes, na mão de quem o lê, mantido pela concentração da leitura. A ação de uma criatura pode dizer `"dyingOnly": true` (só pode ser escolhida uma criatura sem saúde que ainda esteja viva), `"slaysOnFailedSave": true` (um alvo que falha na salvaguarda da própria ação morre) e `"healsOnSlay": { "dice": "3d6" }` (a criatura recupera essa quantidade para cada um que morre). Esse é o Consume Life de um will-o'-wisp. `slaysOnFailedSave` exige um `save`, e `healsOnSlay` exige `slaysOnFailedSave`. Uma regra em `combat.conditions` pode dizer `"endsWhenHolder": { "moves": true, "acts": true }`: a condição sai de quem a porta, e da ficha dele, no primeiro passo (`moves`) ou em qualquer coisa que ele faça além de Hide, inclusive reações (`acts`), seja como for que tenha sido imposta. Essa é a camuflagem de Hide in Plain Sight, marcada na ficha antes da luta. Exige Capability API 1.311.

Um trovão ao redor de um acerto (Capability API 1.312). O modo de uma arma pode dizer `"aroundHit": { "within": 30, "save": { "save": "con_save", "difficulty": 17 }, "condition": "stunned", "rounds": 1, "of": "source" }`. Um acerto nesse modo faz o atingido, e todos a até `within` dele, fazerem uma salvaguarda ou receberem `condition`. Isso inclui aliados e quem empunha, se estiverem perto assim. `rounds` conta os próprios turnos deles, ou, com `of: "source"`, os de quem empunha, então `rounds: 1, of: "source"` é "até o fim do seu próximo turno". `of` exige `rounds`. Fora de um tabuleiro, só o atingido faz a salvaguarda. Junto com a `range` e as `charges` do modo, isso é um Hammer of Thunderbolts arremessado gastando uma carga. O Giant's Bane dele é o `slay` da arma com `when: "critical"`. Exige Capability API 1.312.

Maze, Expeditious Retreat, as escolhas de uma conjuração e somas a atributos com teto (Capability API 1.313). Um `dismisses` com `while` pode dizer `"turns": true`. A criatura fica fora da luta, mas ainda faz seus turnos, e neles só lhe é oferecido o que encerra a condição que a mantém longe, ou encerrar o turno. Um `applies` pode ter `"checkEnds": { "check": "intellect", "difficulty": 20, "passes": { "types": ["monstrosity"] } }`: quem a porta pode gastar o orçamento padrão nesse teste de `combat.checks` contra o número para encerrá-la. Uma criatura que `passes` tem sucesso sem rolar. Juntos, isso é o Maze de 5e e o seu minotauro, de volta para onde estava quando o teste tem sucesso. As mecânicas de uma entrada podem dizer `"takes": ["dash"]` (ou `disengage`, `dodge`), e quem a usa faz essas ações padrão quando ela é usada: Expeditious Retreat faz Dash ao ser conjurado. Os Dash com ação bônus depois disso vêm do `grants` da condição dela. Um `repeats` pode nomear um `group`: as entradas de um mesmo grupo são as escolhas de uma conjuração e, enquanto qualquer uma delas estiver em concentração, todas são oferecidas de novo. `notSaved` e o nível da conjuração são compartilhados, como no adormecido, no apavorado e no enjoado de Eyebite. A mudança de atributo de um item `{ "add": 4, "max": 30 }` se soma ao valor que todo `set` deixa, até `max`, e nunca reduz um valor que já esteja acima disso. Sem `max`, uma soma funciona como antes. O `"binds": { "needsWorn": [{ "anyOf": ["magic_items/belt-of-hill-giant-strength", ...] }, { "anyOf": ["magic_items/gauntlets-of-ogre-power"] }] }` de um item só permite vinculá-lo enquanto um item de cada grupo estiver vestido pelo mesmo personagem, vinculado onde esse item se vincula, e o desvincula assim que um deles sai, é desvinculado ou deixa a bolsa dele. Com `"worn": { "abilities": { "str": { "add": 4, "max": 30 } } }`, isso é um Hammer of Thunderbolts. Exige Capability API 1.313.

Resilient Sphere (Capability API 1.314). Uma entrada de `combat.conditions` pode ter `"sealed": { "rolls": { "budget": "action", "share": 0.5 }, "lifted": { "budget": "action" }, "brokenBy": ["spells/disintegrate"] }`. Enquanto a condição vale, quem a porta fica isolado de todos os outros. Ninguém mais pode mirar nada nele, uma área ou explosão passa por ele sem pegá-lo, e nada vindo de outra pessoa o fere, cura ou lhe impõe condição, inclusive zonas e auras. Nada dele alcança outra pessoa, e ninguém o golpeia quando ele se move, nem ele golpeia ninguém. O movimento próprio dele é nulo, mas com `rolls` ele pode gastar esse orçamento para se mover até `share` da sua velocidade. Com `lifted`, alguém ao lado dele pode gastar esse orçamento para levantá-lo. Depois disso, quem a porta vai aonde quem o carrega andar, até que quem o carrega o ponha no chão, o que é gratuito, ou a condição termine. As entradas em `brokenBy` ainda podem ser miradas em quem a porta e, em vez de fazer o que fazem, encerram a condição e a concentração que a mantém: Disintegrate sobre a esfera. As mecânicas de uma entrada podem dizer `"targetsUpTo": "large"`, um dos `combat.sizes`, e ela então só é mirada em criaturas desse tamanho ou menores. Esse é o "Large size or smaller" de Resilient Sphere. Exige Capability API 1.314.

Ações de covil (Capability API 1.315). Uma ação de criatura pode ter `"lair": true`, e a criatura `"lairInitiative"` (20 quando omitido). Enquanto a criatura luta no seu covil (o `"inLair": true` do Game Master nesse inimigo, ou a lista `inLair` de um encontro), ela faz uma ação de covil por rodada quando a contagem da luta passa pelo número do covil, perdendo os empates: entre os dois turnos entre os quais esse número cai, depois do último turno da rodada quando todos estão nesse número ou acima, ou antes do primeiro turno quando todos estão abaixo. Ela não pode fazer a mesma ação de covil duas rodadas seguidas. Uma ação de covil é mirada e resolvida como no próprio turno, com o `budget` dela emprestado para isso, e não gasta nada do turno da criatura. Ela nunca fica no menu do turno da criatura e não é feita enquanto a criatura está caída ou não pode agir. Uma ação de covil não é uma reação nem é comprada com pontos, uma sequência nunca nomeia uma, e `lairInitiative` exige pelo menos uma ação de covil. Os dragões de 5e fazem as suas na contagem de iniciativa 20.

Objetos de cenário (Capability API 1.316). Uma luta num tabuleiro pode ter objetos de cenário de pé nele que podem ser quebrados: os `board.props` de um encontro, ou os `props` de um campo de batalha do mundo, como foram pintados. Cada um tem um `label`, as `cells` que ocupa, sua `health`, uma `defense` (10 quando omitida) e tipos de dano `resist`, `vulnerable` e `immune` opcionais. `blocks` fecha suas células à passagem (`move`), à visão (`sight`) ou às duas enquanto ele estiver de pé, e ninguém começa a luta dentro dele. Um objeto `fragile` é quebrado por qualquer coisa que o acerte. Um ataque que pode golpear a seção de uma muralha pode golpear um objeto no lugar: ele é listado entre as `walls` da opção, e o `wall` da escolha nomeia a célula dele. Uma área pega todo objeto que alcança e causa o mesmo dano que rola para todos os outros; um objeto nunca faz salvaguarda. Um objeto em 0 se quebra: não fecha mais nada, e seu rótulo é acrescentado à lista `broken` do tabuleiro, ao resumo da luta e ao resumo que o Game Master lê (`Broken: Sluice Gate; Oil Jar`). O gatilho `broke` de uma história dispara com ele.

Legendary Resistance (Capability API 1.317). O `"legendaryResistance": 3` de uma criatura transforma em sucessos as três primeiras salvaguardas que ela falha numa luta, o "If the dragon fails a saving throw, it can choose to succeed instead" (3/Day) de 5e. O Engine sempre escolhe fazer isso, em qualquer salvaguarda, inclusive uma que uma condição faz falhar automaticamente; nunca enquanto a criatura está caída. A salvaguarda é registrada como foi rolada, seguida de uma linha dizendo que teve sucesso no lugar e quantas restam. Um número inteiro de 1 a 20.

O uso de um item também pode ter `"targetsUpTo"` (Capability API 1.317), como as mecânicas de uma entrada desde a 1.314: o `"targetsUpTo": "large"` de um pergaminho de Resilient Sphere só alcança uma criatura desse tamanho ou menor. Ele lê `combat.sizes` e serve para um uso apontado para uma criatura, não para uma área.

Eventos do tabuleiro e vegetação (Capability API 1.318). O tabuleiro de uma luta pode mudar sozinho conforme as rodadas passam: os `board.events` de um encontro, ou os `events` de um campo de batalha do mundo, como foram pintados. Cada evento tem um `id`, um `label` opcional e acontece `at` `"round-start"` ou `"round-end"`, `from` uma rodada (2 no início de uma rodada, 1 no fim, quando omitido), `every` tantas rodadas (1) e `until` uma rodada, se disser. `where` nomeia suas células: `cells`, um `block` (`x`, `y`, `w`, `h`), um `ring` ao redor de uma célula (`x`, `y`) que alcança `start` casas na primeira vez e `step` casas a mais a cada vez depois disso, um `sweep` vindo de uma borda (`from` `north`, `south`, `east` ou `west`) com os mesmos `start` e `step`, ou `{"spread": "growth"}`, toda célula livre ao lado da vegetação. Um anel ou varredura só alcança a faixa mais nova, com `step` casas de profundidade (pelo menos uma), inclusive na primeira vez, então um anel com `start` 3 deixa o centro em paz; `filled` alcança tudo o que está dentro. `onlyOn` o restringe a células desses terrenos. `change` diz o que acontece ali, pelo menos um destes: `terrain`, `height` (de 0 a 3), `light` (`bright`, `dim`, `dark`, `sunlight` ou `clear`), `obscured` (`light`, `heavy` ou `clear`), `growth` (true ou false), `season` (um nome, ou null para removê-la), `rotate` (só um `block` quadrado, girado 1, 2 ou 3 quartos de volta no sentido horário com suas casas, alturas, terreno, os objetos de cenário inteiramente dentro dele e quem estiver inteiramente dentro dele) e `tell`, a linha que o registro diz no lugar da comum. Quem fica de pé onde ninguém pode ficar (gelo rachado virando água) é colocado na célula livre mais próxima. Um tabuleiro comporta até 32 eventos.

Levado junto (Capability API 1.329). O `change` de um evento do tabuleiro também pode dizer `push`, `{"toward": "east", "squares": 3}` (uma borda, `north`, `south`, `east` ou `west`, e de 1 a 6 casas): quem está no chão nas células dele é levado nessa direção uma casa de cada vez, nunca para fora do tabuleiro, contra uma parede ou um objeto fechado, para um terreno em que ninguém pode ficar ou contra outra pessoa, e ninguém o golpeia por isso; os mais próximos dessa borda vão primeiro, e quem está no ar fica em paz. O registro diz quem foi levado. O canal do moinho do Mill of Hours. Ou `drift`, no mesmo formato: o que obscurece suas células (leve ou fortemente) é soprado nessa direção e volta pelo lado oposto do seu `block`, ou do tabuleiro, para qualquer outro `where`; nada mais nas células se move, e o forte fica onde o leve é soprado sobre ele. As rajadas do Leaffall. Os eventos pintados de um campo de batalha aceitam os dois.

Vegetação numa célula custa o dobro para entrar (não mais que outro terreno difícil) e obscurece levemente quem está nela. Um golpe cujo tipo de dano corta vegetação (cortante, a menos que o `growth.cutBy` do tabuleiro diga outra coisa) pode ser mirado numa célula de vegetação que ele alcança, listada entre as `walls` da opção: ele limpa essa célula sem rolagem e gasta a ação. Dano de um tipo que queima vegetação (fogo, a menos que `growth.burnedBy` diga outra coisa) a queima em toda célula que atinge, todo o alcance de uma área ou a célula de quem acerta. As mecânicas de uma entrada, ou o uso de um item, com `"clears": "growth"` e uma `area` limpam a vegetação dessa área: tesouras de poda, `{"kind": "utility", "area": {"shape": "box", "size": 15}, "clears": "growth"}`. O `board.ground` de um encontro pinta vegetação, luz, obscurecimento e estações nas células desde o início; um campo de batalha do mundo pinta a vegetação como linhas `growth` de `g` e `.`, e as estações como fazem as Experiences.

Sombra, regras de luz, sinos e os que fogem da luz (Capability API 1.319). Uma luz com `"shade": true` emite sombra: penumbra até onde alcança seu `dim`, e a luz forte e a luz do sol ali também viram penumbra, seja o que for que mais as ilumine. Ela não tem luz forte e não é `reveals` nem `sunlight`. A sombra nunca entra numa escuridão mágica. A Lantern of Dusk da demonstração é um item carregado com `{"light": {"bright": 0, "dim": 15, "shade": true}}`. A luz própria de uma célula (1.318) e a sombra também são o que os olhos leem ali: num tabuleiro iluminado, uma criatura numa célula escura não é vista, a não ser por um sentido que enxerga no escuro.

O tabuleiro de uma luta pode ter uma regra de luz: o `board.lightRule` de um encontro, ou o `lightRule` de um campo de batalha do mundo, como foi pintado. No fim de cada rodada, todos que estão inteiramente numa das luzes dela (`in`; luz forte e luz do sol quando não dito; luz forte inclui luz do sol) contam mais um fim de rodada ali e, a cada `rounds`-ésimo (1 quando não dito), as `tracks` dela se movem em `by` e suas condições `applies` são impostas a eles. Sair, mesmo para a sombra de uma única célula, reinicia a contagem. `spares` nomeia os `types` e as `tags` de criatura que ela nunca afeta. Uma regra que não move nenhuma trilha que a ficha tem e não impõe nenhuma condição que a luta conhece não faz nada e é descartada. Noonfield é `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1}]}`: um nível de exaustão por minuto ao sol.

Salvaguardas de regras de luz (Capability API 1.321). O `save` de uma regra de luz (`save`, `difficulty`) é rolado por cada criatura que ela está prestes a afetar, e uma salvaguarda bem-sucedida escapa dela dessa vez; a contagem reinicia de qualquer forma. Seu `against` (`conditions` que a luta conhece, tipos de `damage`) é aquilo contra o que a salvaguarda conta, então um modificador de salvaguarda com um `against` correspondente se aplica: um chapéu de palha vestido ou carregado com `{"to": "saves", "mode": "advantage", "against": {"conditions": ["noon_light"]}}`. O `upTo` de uma entrada de trilha é até onde a regra a move, então uma exaustão que passaria dele para ali, e nenhuma é acrescentada depois que ele é alcançado. Noonfield como escrito: `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1, "upTo": 3}], "save": {"save": "con_save", "difficulty": 12, "against": {"conditions": ["noon_light"]}}}`, com uma condição `noon_light` que a experiência acrescenta para o chapéu nomear.

Usos de itens como reações (Capability API 1.322). O `use` de um item (ou um dos seus `moreUses`) pode ter uma `reaction`, escrita como a de uma entrada de catálogo, e então só é oferecido quando esse momento se abre, pago com `budget` (a reação de quem o porta) e com as cargas dele ou com o próprio item, como qualquer uso. Liesl's Coffin, uma vez por dia, quando uma criatura a até 5 pés de quem o porta é atingida, dá +5 de CA a ela até o início do próximo turno de quem o porta, inclusive contra esse acerto: `{"kind": "buff", "budget": "reaction", "targets": "any", "charges": 1, "reaction": {"on": "hit", "at": "target", "for": "any", "within": 5}, "applies": [{"condition": "coffin_ward", "duration": {"rounds": 1, "at": "turn-start", "of": "source"}}]}` num item com `"charges": {"max": 1, "recharge": {"rests": ["long"], "amount": "max"}}`. O Straw Proxy, um ataque mirado no dono perdido e o substituto queimado: `{"kind": "buff", "budget": "reaction", "targets": "self", "consumes": true, "reaction": {"on": "aimed", "cancels": true, "for": "self"}}`. O uso de um item nomeia seu momento: `"reaction": true` é recusado.

Held Ground e ceifar (Capability API 1.323). Uma luta pode ser travada em Held Ground, um lugar onde a morte é retida: o `heldGround` da luta (`label`, uma `condition` e `marks` como `[{"track", "by"}]`), que a regra de região da história lhe entrega. Ali, quem chega a zero de saúde é abatido em vez de morrer ou cair: um oponente fica fora da luta; um personagem fica estável, nunca rola contra a morte, não recebe falhas por ser ferido e pode ser curado como de costume. Os abatidos recebem a `condition` dele (e um personagem, a condição própria do conjunto para estar caído), e cada um com ficha move as trilhas de `marks`: a marca de Owing da demonstração. O que mataria na hora abate no lugar. Um golpe que `reaps`, na ação de uma criatura ou no ataque de um item, ceifa quem ele abate: essa pessoa fica caída, não recebe condição nem marca, e um personagem ceifado está morto. O Reaping Hook é uma arma cujo `attack` tem `"reaps": true`. Os combatentes abatidos e ceifados levam `felled` e `reaped`, para que a história possa erguer os abatidos depois.

Held Ground liberado (Capability API 1.330). A história pode liberar o Held Ground no meio de uma luta, quando o ano vira: o `releaseRulesetHeldGround(definition, state, release)` do diretor (com o `rulesetReleaseHeldGround` compartilhado por baixo). A partir daí, quem chega a zero de saúde morre ou cai como em qualquer outro lugar. Os abatidos que não foram ceifados morrem, oponentes e personagens, a menos que `release.felled` seja `"down"`, caso em que um personagem cai e começa a morrer pela regra do próprio conjunto. Com `release.owing` (`{"track"?, "bonus"?}`, sendo a trilha a primeira marcada pelo Held Ground quando omitida), as marcas de cada personagem nela vencem: uma das salvaguardas contra a morte do conjunto por marca, com `bonus` somado a cada uma (o Debts Settled do grupo), roladas até as marcas acabarem ou a contagem se decidir, com os naturais como a regra de morte diz; as marcas são então gastas. Três falhas (o topo da trilha de falhas) é a morte. O registro diz quem morreu, quem caiu e as rolagens de cada personagem. Uma luta que não está em Held Ground fica como estava.

Áreas e terreno de criaturas (Capability API 1.324). Uma ação de criatura com `area` pode deixar essa área de pé com `zone`, escrita como a zona de uma entrada de catálogo (`rounds`, `triggers`, `obscures`, `terrain` e o resto): o Freezing Fog de The Owed, o cubo de farinha de Scatter Flour, o chão congelando e virando terreno difícil. Uma zona com `"untilLair": true` também termina quando a contagem do covil de quem a criou volta a chegar, antes de essa ação de covil ser escolhida, se as `rounds` dela não a encerraram antes: "until the next lair action". Uma ação de criatura pode, em vez disso, mudar para sempre o terreno que sua área cobre com `ground`, como o `change` de um evento do tabuleiro o diz (`terrain`, `height` de 0 a 3, `light`, `obscured`, `growth`, `season` e um `tell` para o registro): a fogueira se apaga (`"light": "dark"`), o gelo racha (`"terrain": "water"`); quem fica numa célula em que ninguém pode ficar é levado para a célula livre mais próxima. Os dois exigem a `area` da ação, e um `ground` precisa mudar alguma coisa. Um conjunto que usa qualquer um dos dois, ou `untilLair` em qualquer lugar, exige Capability API 1.324.

Criaturas chamadas para uma luta (Capability API 1.325). Uma ação de criatura pode dizer `"calls": { "creature": "creatures/zombie", "count": { "dice": "1d4" } }`: quando ela é usada, essa quantidade da criatura de bestiário nomeada (um `"<catalogId>/<entryId>"` dos catálogos do conjunto ou do bestiário que a luta recebeu; `count` é `{"dice"}`, `{"flat"}` ou os dois, no máximo oito de cada vez) entra na luta do lado de quem a usou, construída como a luta construiu as suas e nomeada uma a uma ("Zombie 1", "Zombie 2"). Com uma `area`, elas são colocadas onde ela é mirada e, quando ela fica cheia, o mais perto dela que houver espaço; sem uma, ao lado de quem as chamou, e a ação não é mirada em ninguém. Elas rolam a própria iniciativa e assumem seu lugar na ordem: um lugar que os turnos desta rodada já passaram fica para a próxima rodada. Com `"initiative": "after"`, os turnos delas vêm logo depois do de quem as chamou. Uma ação de covil pode chamar (Shelves Lean), e o turno entre os quais a contagem dela caiu continua como estava. Uma criatura não encontrada em lugar nenhum quando a luta começa não chama ninguém, e uma luta comporta no máximo 40. O registro diz quem chegou. Um conjunto que usa `calls` exige Capability API 1.325.

Atraído até uma criatura (Capability API 1.326). Uma ação de criatura pode dizer `"draws": { "spends": "reaction" }`: quem ela atinge (com um `save`, só numa falha) gasta esse orçamento na hora para andar até a sua velocidade em direção à criatura, pelo caminho livre até a célula ao seu alcance mais próxima dela, sem provocar golpes. Quem não tem mais nada desse orçamento, ou não conseguiria chegar mais perto, não gasta nada e fica onde está. O Whisper a Name de The Owed. `spends` é um dos orçamentos da economia. Um conjunto que usa `draws` exige Capability API 1.326.

Momento do covil (Capability API 1.327). Uma ação de criatura com `"actedOnly": true` só pode ser apontada para alguém que já começou seu turno nesta rodada, inclusive o que está em andamento; antes do primeiríssimo turno da luta, enquanto um covil age antes de todos, ninguém começou. Esse é o "one creature that has already acted this round" do Hour Bell. A duração de uma condição pode acrescentar `"untilLair": true` às suas `rounds`: ela também sai quando quem a impôs chegar de novo à contagem do seu covil, antes de essa ação de covil ser escolhida (o "until the next lair action" do Hour Bell). Uma ação de criatura mantida pela sua `concentration` pode nomear `"brokenNextLair"`, uma das próprias ações de covil: assim que essa concentração é rompida (por dano, por cair ou pelo que uma zona faz, nunca por quem a mantém encerrá-la ou começar outra), essa ação de covil é a próxima que ela faz e a única oferecida, seja qual for a que fez na rodada anterior; depois de feita, a escolha volta a ser livre. A Litany of Keeping do Father Ivo e as prateleiras pendendo. Um conjunto que usa qualquer uma dessas exige Capability API 1.327.

Dificuldade de salvaguarda movida por uma condição (Capability API 1.328). A mudança `{ "to": "save-difficulty", "flat": -2 }` de uma condição move a dificuldade de toda salvaguarda que quem a porta pede enquanto a tem: as salvaguardas das próprias ações e a dificuldade de salvaguarda dada às salvaguardas que encerram o que essas ações impõem. Ela aceita um valor `flat` e nada mais, e nunca afeta a dificuldade de um teste, uma salvaguarda de concentração (definida pelo dano) ou as criaturas que uma ação chama para a luta. O Un-age do Miller of Hours: uma CD de salvaguarda de magia 2 menor. Um conjunto que a usa exige Capability API 1.328.

Objetos de cenário e alimentar-se (Capability API 1.331). Uma condição de combate pode dizer `"whileNearProp": {"prop": "Year-Wheel", "within": 10}`: ela só vale enquanto quem a porta estiver a essa distância (na unidade do conjunto) de um objeto de cenário de pé do tabuleiro com esse rótulo, e fica suspensa, não encerrada, em qualquer outro lugar ou depois que esse objeto é quebrado; uma luta sem tabuleiro a mantém. O Wheel's Favour. A `area` de explosão de uma ação de criatura pode dizer `"aroundProp": "Shelf"`: onde quer que seja mirada, ela cobre toda célula a até o seu `size` de um objeto de pé com esse rótulo, inclusive atrás dele. Shelves Lean ao redor das fileiras de prateleiras do Granary. Uma aura pode dizer `"feeds": 15`: quem a porta recupera essa quantidade de pontos de vida sempre que alguém que a aura alcança é abatido, cai ou é morto, e uma aura pode fazer só isso. O Collector de The Owed. Um conjunto que usa qualquer uma dessas exige Capability API 1.331.

Reacender, cair através, e usos ao lado de um objeto de cenário (Capability API 1.332). Um objeto de cenário do tabuleiro (os `board.props` de um encontro, ou um pintado num campo de batalha) pode dizer `"relight": {"light": "bright", "squares": 2, "budget"?: "action"}`: enquanto qualquer célula a até `squares` dele não estiver nessa luz, como a luta a lê, quem está ao lado dele recebe a opção "Light it again" por esse orçamento (`action` quando não dito), que coloca essa luz em todas essas células. A fogueira de The Owed depois de Bonfire Gutters. O `ground` de uma ação de criatura pode dizer `"occupants": "stay"` com seu `terrain`: quem está onde o chão vira algo em que ninguém fica permanece ali, caído através do gelo na água, em vez de ser levado para a célula livre mais próxima (`"shove"`, o padrão). Uma entrada de catálogo ou o uso de um item pode dizer `"usableNear": {"prop": "Year-Wheel", "within": 5}`: só é oferecido enquanto quem o usa estiver a essa distância de um objeto de pé nomeado pelo ID ou pelo rótulo, nunca numa luta sem tabuleiro. O Fennick's Hymnal junto à Year-Wheel. A partir da 1.332, `whileNearProp`, `aroundProp` e `usableNear` nomeiam um objeto de cenário da mesma forma: pelo ID (`"p1"`), ou pelo rótulo lido de forma tolerante, ignorando maiúsculas, um "the" inicial e tudo o que não for letra ou dígito, então `"Year-Wheel"` encontra um objeto com o rótulo "The Year-Wheel". Um conjunto que usa `usableNear` ou `occupants` exige Capability API 1.332.

Arte do tabuleiro de luta (Capability API 1.333). O tabuleiro de uma luta pode ser desenhado a partir de um pacote de tabuleiro: folhas PNG numa grade de células (48 pixels para o visual de RPG Maker), com peças sob IDs fixos, feitas no Pixelforge e guardadas na biblioteca (`POST /api/game-tile-packs/boards`). `bt_plains`, `bt_forest`, `bt_mountain`, `bt_ruin`, `bt_water` e `bt_wall` são os terrenos, até oito variantes de cada, escolhidas por célula, ou um padrão maior que uma célula estendido sobre o tabuleiro; `bt_edge_water` e `bt_edge_wall` são blocos de grade dupla de dezesseis peças, quatro células por quatro, dispostos como os blocos `edge_` do Pixelforge, que fundem a água e as paredes com as planícies ao lado; `bt_height1` a `bt_height3` são bordas sobre terreno elevado. `bo_dim`, `bo_dark`, `bo_sunlight`, `bo_fog_light`, `bo_fog_heavy`, `bo_growth`, `bo_ice` (uma célula no inverno), `bo_zone`, `bo_aim` e `bo_reach` são desenhados sobre uma célula no lugar das cores atuais. O sprite de um objeto de cenário é `bp_<name>` sobre as células dele (`"art": "bp_bonfire"` no objeto ou, quando omitido, o rótulo em palavras minúsculas unidas por `_`, sem um "the" inicial, então "The Year-Wheel" é `bp_year_wheel`), e `bp_<name>_broken` depois que ele é quebrado. Um campo de batalha pintado ou o tabuleiro de um encontro pode nomear seu pacote com `"pack": "local/<id>"`; sem nenhum, ele é desenhado com o pacote da biblioteca para o seu ambiente (o `environment` de um pacote), depois com o `board/<environment>` embutido, depois como hoje, e os objetos de cenário também são procurados no pacote de objetos da biblioteca (`"environment": "props"`) e depois no `board/props` embutido. Uma peça que falta num pacote é desenhada como hoje. Uma zona de catálogo pode dizer `"art": "bz_<name>"`: toda célula que ela cobre é desenhada com essa peça do pacote do tabuleiro ou, sem ela, com `bo_zone`. Um conjunto que usa o `art` de zona exige Capability API 1.333.

Mais turno a partir de um item (Capability API 1.334). O uso de um item pode dizer `"gives": [{"budget": "action", "count": 1}]`, como as mecânicas de uma entrada de catálogo (Action Surge): usá-lo dá na hora a quem o usa essa quantidade a mais do turno, com limite no ponto em que cai, então nada é guardado para depois. O Time-Flour Loaf, comido com uma ação bônus, dá mais uma ação agora. Um conjunto que o usa exige Capability API 1.334.

Dados gastos num descanso (Capability API 1.335). Um descanso pode dizer `"dice": {"pool": "hit_dice", "die": {"field": "hit_die"}, "add": {"abilityMod": "con"}, "heals": "hp", "extra"?: {"die": {...}, "add"?: {...}}}`: o `[sheet: op="rest" rest="short" dice="2"]` do Game Master (ou um para o grupo inteiro) gasta então primeiro essa quantidade de `pool`, rola cada dado (`die` é qualquer valor, ou um campo enum escrito "d8") mais `add`, nunca abaixo de 0 por dado, e devolve esse total a `heals` como uma cura não mágica, antes de o descanso fazer o que diz. `extra` é mais um dado para todos que gastam algum: o membro do grupo cujo `die` lê mais faces o rola para cada um, mais o próprio `add`. O Song of Rest de 5e, e o +1 em cada um dos seus dados do Pell's Brown Teapot, como uma estatística de item que o `add` lê. Um conjunto que usa `dice` em descansos exige Capability API 1.335.

Dados de descanso em várias reservas (Capability API 1.337). O `"dice"` de um descanso pode ser uma lista, uma entrada por reserva, cada uma com seus próprios `die`, `add`, `heals` e `extra`: `[{"pool": "hit_dice_d10", "die": {"const": 10}, ...}, {"pool": "hit_dice_d6", "die": {"const": 6}, ...}]`, então um guerreiro 1 / mago 1 gasta um d10 e um d6. `[sheet: op="rest" rest="short" dice="N" pool="hit_dice_d6"]` gasta só dessa reserva; sem `pool`, os dados vêm da primeira reserva listada que tenha algum, depois da seguinte, e se houver poucos no total o pedido é recusado sem gastar nada. O dado extra (Song of Rest) é o da primeira entrada que tiver um, rolado uma vez para o gasto inteiro, e cura o que cura a primeira reserva da qual se gastou; ele vem mesmo quando só uma reserva posterior paga. Numa partida, os dados de um descanso leem o que cada personagem carrega, então um `itemStat` em `add` ou no `add` do dado extra conta: o Pell's Teapot, `{"itemStat": {"stat": "song_of_rest_add", "from": "carried", "pick": "max", "default": 0}}`. Um conjunto com uma lista aqui exige Capability API 1.337.

Ícones (Capability API 1.338). Uma entrada de catálogo e uma condição da ficha podem nomear seu ícone, `"icon": "ic_poison_cloud"`: uma peça do pacote de ícones da partida (um pacote de tabuleiro do tipo `icons`; veja packages/server/src/assets/board-packs/README.md). Sem ele, o Engine procura o nome derivado: uma condição `ic_cond_<id>`, um item `ic_item_<entry id>` (ou `ic_item_<name>` para um que o Game Master inventou), qualquer outra entrada de catálogo `ic_<catalog id>_<entry id>` (`ic_spells_fireball`), com hifens como `_`. Sem nenhum dos dois, aparecem a letra ou o texto atuais. Um conjunto que nomeia um ícone exige Capability API 1.338.

Uma lista de ações de covil para uma concentração rompida (Capability API 1.336). `"brokenNextLair"` pode ser uma lista das próprias ações de covil, cada uma uma vez, em vez de uma só: `["shelves_lean_north", "shelves_lean_south"]`. Assim que essa concentração é rompida, a próxima ação de covil é uma dessas e nenhuma outra, seja qual for a que fez na rodada anterior, e quem controla a criatura escolhe qual. Uma criatura controlada pelo Engine faz a que pegaria mais inimigos; entre ações equivalentes, ela as avalia como avalia qualquer outra coisa. Depois de feita, a escolha volta a ser livre. Um conjunto com uma lista aqui exige Capability API 1.336.

Uma condição, ou um item vestido ou carregado, com `"alerts": 15` denuncia quem se move escondido a essa distância de quem o porta: essa pessoa não fica escondida de ninguém, e o registro diz que foi denunciada por quem o porta. O Wind-Chime da demonstração é um item carregado com `{"alerts": 15}`. O `"stillIn": ["bright"]` de uma criatura a impede de se mover enquanto qualquer célula dela estiver numa dessas luzes: ali não há caminhada no menu dela. O Lantern-Shy da demonstração.

Auras que crescem, imobilizações com limite, se soltar à força e resistir (Capability API 1.320). O `"grows": {"by": 10, "upTo": 40}` de uma aura alcança `by` a mais no início de cada turno de quem a porta, até no máximo `upTo`, que é maior que a sua `distance`; o registro diz até onde ela alcança agora. Seu `harms` pode dizer `"on": "their-turn"`: causado no início de cada turno de quem ela alcança, em vez de tudo de uma vez no início do turno de quem a porta. `"lingers": true` deixa o que ela espalha em quem ela não alcança mais até o início do próximo turno dessa pessoa, e a aura volta a mantê-lo se a alcançar antes disso. O Frost Debt de The Owed é `{"distance": 20, "side": "enemies", "conditions": ["no_heal"], "grows": {"by": 10, "upTo": 40}, "lingers": true, "harms": {"dice": "2d6", "type": "cold", "on": "their-turn"}}`.

O que uma ação impõe pode ter `"heldAtMost": 2`: enquanto a origem já mantiver essa quantidade de outros com ela, ela não é imposta a um terceiro (o registro diz que não foi imposta), como os Grasps de The Owed. O `shakeOff` de uma condição com `"self": true` permite a quem a porta também encerrá-la, gastando o orçamento sem teste: o Seed Hopper, `{"budget": "action", "self": true}`, de que o preso ou um aliado ao lado dele se solta à força. O `"hangsOn": {"uses": 1, "extraTurn": true, "label": "Hourglass"}` de uma criatura a deixa com 1 ponto de vida em vez de cair a 0, `uses` vezes por luta, mas não contra o que mata na hora; com `extraTurn`, ela faz um turno próprio logo depois daquele em que isso aconteceu, e a ordem volta a ser a de antes quando esse turno acaba.

O seletor mostra o bloco numa linha. Quem lê o restante depende do bloco escolhido pelo conjunto:

- Com um [bloco `combat`](#combat-a-fight-your-own-rules-resolve), a luta lê seus efeitos de combate. `range`, `area` e `friendlyFire` valem em campos com posições; `reaction` marca uma entrada que responde a algo, em vez de ser usada num turno, e nomeia o momento que ela espera (veja [Janelas](#windows-holding-the-fight-open)); uma entrada marcada apenas com `true` não nomeia nenhum momento e não aparece em nenhum menu. `check` afeta testes de perícia, como explicado acima.
- Só com um [bloco `battle`](#battles-lending-the-sheet-to-marinaras-combat), a batalha lê `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` e `cost`, pois são as partes que o combate próprio do Marinara consegue aplicar.

O vocabulário é fechado: uma chave ou valor fora da lista é recusado em vez de ignorado.

`cost` também é o preço pago pelo comando `use` do GM fora da batalha, descrito a seguir.

### Comandos de ficha: avanço permanente (Capability API 1.142)

Um conjunto pode permitir mudanças na construção permanente do personagem com `sheet.advancement`:

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

Inclua só IDs de campo que sua ficha declara como número ou texto (`text` ou `longtext`), no máximo 24. Os booleanos permitem, respectivamente, todos os atributos, perícias ou salvaguardas; omitidos ou falsos significam nenhuma permissão. Um conjunto vazio de permissões, um campo desconhecido, um tipo de campo sem suporte ou uma chave desconhecida são recusados na importação. `text` é uma orientação opcional de no máximo 400 caracteres seguros para prompt. Sem `advancement`, os comandos existentes funcionam como antes e todo pedido `advance` é recusado.

```
[sheet: op="advance" field="xp" by="250" who="party"]
[sheet: op="advance" field="xp" to="1200"]
[sheet: op="advance" field="humanity" by="-1"]
[sheet: op="advance" field="discipline" to="Auspex"]
[sheet: op="advance" ability="str" by="1"]
[sheet: op="advance" ability="str" to="16"]
[sheet: op="advance" skill="stealth" tier="expert"]
[sheet: op="advance" save="will" tier="trained"]
```

Nomeie exatamente um alvo. Campos e atributos aceitam exatamente um entre `by` e `to`; texto só aceita `to`. Nomes e níveis coincidem com IDs ou rótulos, sem distinguir maiúsculas. Perícias e salvaguardas aceitam qualquer nível declarado em `resolution.proficiencyTiers`. Campos numéricos respeitam `integer`, `min` e `max`; atributos respeitam seus limites inteiros; texto respeita `maxLength`. Um valor inválido é recusado com um motivo `bad-amount` que informa o limite, nunca ajustado em silêncio. Avanço desativado, alvos não permitidos, nomes desconhecidos e níveis desconhecidos também são recusados. A tag reescrita leva `result` e o novo valor em `now`. Omita `who` para o jogador, ou use `who="party"` para cada card do grupo sem ambiguidade; recusas parciais nomeiam quais cards não puderam avançar.

O Engine salva a construção no card da partida pelo mesmo armazenamento de metadados de uma edição do jogador, mantendo a versão da ficha e recalculando os valores derivados a partir da nova construção. Os cards da biblioteca não mudam. Como nos comandos vivos, um swipe alternativo ou uma resposta regenerada parte de antes das mudanças da resposta substituída. Cada resposta registra a construção com que termina, inclusive respostas sem avanço. Selecionar um swipe restaura o instantâneo dele; excluir a resposta mais recente revela o instantâneo anterior. Excluir uma resposta mais antiga deixa em vigor um instantâneo posterior até que essa resposta posterior seja removida. Uma continuação atualiza o instantâneo da mesma resposta. Desfazer só muda valores que ainda coincidem com o resultado registrado, então edições posteriores do jogador sobrevivem, e edições não relacionadas não impedem que uma concessão de XP seja desfeita.

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

`pool=` é o lançamento em nível superior: o mesmo preço único, pago de outra reserva do grupo. Só é aceito se o custo tiver um único termo e a reserva nomeada compartilhar o grupo desse termo ou pagar por ele. Qualquer outra situação é recusada sem reinterpretar.

**Uma reserva que paga por outro grupo** (Capability API 1.171). O `pays` de uma reserva viva nomeia até quatro outros grupos cujos custos ela também pode pagar, no próprio nível (o `level` dela, ou o lugar dela no próprio grupo), e nunca um custo de nível maior que o dela. Os espaços de pacto de 5e pagam magias custeadas pelos espaços de magia, como um bruxo multiclasse pode fazer:

```json
{
  "id": "pact_slots",
  "label": "Pact Slots",
  "group": "pact",
  "max": { "field": "pact_slot_count" },
  "level": { "field": "pact_slot_level" },
  "pays": ["slots"]
}
```

Uma luta oferece uma reserva assim ao lado das reservas maiores do próprio grupo da magia, e um pagamento com ela aumenta a magia em tantos passos quantos o nível dela estiver acima do da magia: um espaço de pacto de 3º nível paga Magic Missile como um espaço de 3º nível pagaria. Um uso cuja própria reserva está vazia continua sendo oferecido, pago só por uma reserva maior ou por uma que paga por ela, então uma magia de 1º nível é conjurada com um espaço de 2º nível depois que os espaços de 1º nível acabam. `targetsPerCostStep` (1.171, de 1 a 10) nas `mechanics` de uma entrada soma essa quantidade de alvos para cada passo acima em que é paga, até no máximo 20: Hold Person é `"targetCount": 1, "targetsPerCostStep": 1`.

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

Arquivos de catálogo separados vêm num pacote: um publicado pelo catálogo oficial ou um arquivo de pacote de conjunto que você mesmo importa (veja [Compartilhar seu conjunto de regras](#sharing-your-ruleset)). O pacote os lista em `contributions.assets.paths` junto a `ruleset.json` e precisa de Capability API 1.21. Um catálogo de criaturas, incluído ou separado, precisa de Capability API 1.27, e um catálogo de itens precisa de 1.49. **Um conjunto importado como arquivo único ou compartilhado pelo GitHub contém os catálogos dentro do arquivo**, então precisam caber no limite total de 512 KB. Isso comporta algumas centenas de entradas curtas.

Os limites são doze catálogos por conjunto, 2000 entradas por catálogo em ambos os formatos e 2 MB por arquivo de catálogo. Um pacote cujo `ruleset.json` passa de 256 KB, ou com um arquivo de catálogo acima de 1 MB, precisa de Capability API 1.340, que aumentou os dois limites.

### O construtor guiado: criar um personagem em etapas

Uma ficha pode declarar `sheet.builder` (Capability API 1.86). O editor de fichas, nos editores de personagem e de persona e no **Edit sheet** (editar ficha) de uma partida, passa a abrir numa visão **Guided** (guiada) ao lado do formulário completo (**All fields**: todos os campos): as etapas no topo, cada uma com um selo que conta as escolhas que ainda espera, **Back** (voltar) e **Next** (avançar), que nunca bloqueiam (um jogador pode deixar escolhas para depois), e o personagem como está ao lado delas: o que as etapas escreveram, os valores dos atributos, os valores que `gm.sheetSummary` nomeia (classe de armadura, bônus de proficiência) e as salvaguardas e perícias treinadas.

```json
"builder": {
  "tier": "proficient",
  "steps": [
    { "id": "race", "label": "Race", "kind": "catalog", "catalog": "races", "field": "race" },
    { "id": "subrace", "label": "Subrace", "kind": "catalog", "catalog": "races", "min": 0,
      "within": { "step": "race", "filter": "parent" } },
    { "id": "class", "label": "Class", "kind": "catalog", "catalog": "classes", "field": "class" },
    { "id": "level", "label": "Level", "kind": "fields", "fields": ["level", "background"] },
    { "id": "scores", "label": "Ability Scores", "kind": "abilities", "methods": {
      "pointBuy": { "budget": 27, "costs": [[8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]] },
      "standardArray": [15, 14, 13, 12, 10, 8],
      "roll": { "count": 4, "sides": 6, "keep": 3 },
      "manual": true } },
    { "id": "skills", "label": "Proficiencies", "kind": "trained" },
    { "id": "gear", "label": "Equipment", "kind": "startingGear" }
  ]
}
```

Até 24 etapas, cada uma `{ id, label, kind, ... }`; um pacote com mais de 16 declara Capability API 1.112:

- `catalog`: entradas de um catálogo de linhas, mostradas como cartões com o `summary` atrás de **Info** (informações). `min` (padrão 1) é quantas a etapa pede, e `max` (padrão 1), o máximo que ela aceita; com `max` 1, uma nova escolha substitui a anterior. Os dois podem ir até 40; um pacote com qualquer um acima de 20 declara Capability API 1.110. `field` nomeia um campo de texto ou enum em que os rótulos escolhidos são escritos (um campo enum recebe o ID ou o rótulo da entrada, o que for um dos seus valores). `filters` fixa valores dos filtros do catálogo, e `within: { step, filter }` só oferece entradas cujo `filter` nomeia uma entrada escolhida naquela etapa anterior, como uma sub-raça nomeia sua raça; desmarque a raça, e a sub-raça deixa de contar. `upTo: { filter, value }` (Capability API 1.87) só oferece entradas cujo `filter` numérico seja no máximo `value`, um valor lido da ficha como está, como características até o nível do personagem (`{ "filter": "level", "value": { "derived": "level" } }`); uma entrada sem o filtro é sempre oferecida, e uma escolha abaixo da qual a ficha caiu depois deixa de contar, mas é mantida. Uma escolha que muda o valor lido (uma classe que define o nível) é resolvida na mesma mudança, assim como um valor mudado em **All fields** (um nível reduzido ali retira na hora o que uma característica acima dele deu). `countFrom` (Capability API 1.90) é um valor lido da ficha da mesma forma que vale tanto como `min` quanto como `max`: quantas entradas a etapa pede e o máximo que aceita, arredondado para baixo e nunca acima de `max`, como as magias que uma classe conhece no nível do personagem (`{ "derived": "spells_known" }`). Escolhas além dele são mantidas, mas não contam até a contagem subir de novo. Uma etapa de catálogo também pode ter `stamp` (Capability API 1.108), de 1 a 4 valores de coluna escritos em toda linha que ela acrescenta, como `"stamp": { "class": "wizard" }` na etapa de magias do mago e `"stamp": { "class": "cleric" }` na do clérigo. Cada chave precisa ser uma coluna em toda lista que o catálogo alimenta; os valores são strings, números ou booleanos. O carimbo substitui o valor inicial do catálogo. As linhas existentes e as edições posteriores em **All fields** continuam sendo do jogador. Com a Capability API 1.130, um valor de carimbo pode ser um objeto cujo `fromWithin` é `"id"`, `"label"` ou um ID de filtro declarado pelo catálogo pai: ele lê o primeiro pai correspondente na ordem das escolhas, escreve uma string ou um número uma vez quando a linha é acrescentada e deixa essa coluna sem carimbo se nenhum pai corresponder ou se o filtro dele estiver ausente ou for uma matriz.

  ```json
  {
    "id": "spells",
    "label": "Spells",
    "kind": "catalog",
    "catalog": "spells",
    "within": { "step": "class", "filter": "class_ids" },
    "stamp": { "class": { "fromWithin": "label" } }
  }
  ```

- `fields`: um formulário curto de campos nomeados. O selo dele conta os que ainda estão vazios, exceto os listados em `optional` (uma subclasse escolhida num nível posterior). `shownWhen: { "field_id": { "field": "level" } }` (Capability API 1.107) mostra e conta um campo nomeado da etapa só enquanto sua referência de valor lê acima de 0 na ficha como está; campos ocultos mantêm seus valores. `total: { "fields": ["level_bard", "level_other"], "max": 20 }` (1.107) mantém pelo menos dois campos numéricos da etapa dentro de um máximo combinado (um inteiro de 1 a 1000), reduzindo o máximo de cada campo pelos valores atuais dos outros sem ficar abaixo do próprio mínimo, e soma um ao selo se o total passar do limite; **Next** continua funcionando.
- `abilities`: os valores de atributo (`abilities`, todos quando omitido), definidos por qualquer um dos `methods`: `pointBuy` (um `budget` que não passe do custo de comprar todos os valores até o topo, e o custo de cada valor a partir do mais baixo, onde todo valor começa, subindo um de cada vez; um valor digitado à mão parte do valor mais próximo da tabela), `standardArray` (um valor para cada atributo), `roll` (`count` dados de `sides`, mantendo os `keep` maiores, rolados pelos próprios dados do Engine, uma rolagem por atributo, depois distribuídas como um conjunto padrão) e `manual`. `manual: true` mantém os limites de valor existentes; `manual: { min, max }` (Capability API 1.110) restringe os valores base digitados, antes das concessões, a esses limites inteiros, com min de pelo menos -100, max de no máximo 1000 e min no máximo igual a max, enquanto os limites próprios de cada atributo continuam valendo para o total. `default` (1.87) é o método em que começa um personagem que o construtor inicia a partir de uma ficha em branco (e que ele mantém, mesmo que o padrão do conjunto mude depois), então um iniciante vê, por exemplo, a compra de pontos até escolher outro; um personagem descrito nunca o recebe, e seus valores ficam como estão até o jogador escolher um método depois de descrever; **Manual entry** (entrada manual) continua sendo a edição digitada dentro dos limites, e **All fields** está sempre lá. O que as escolhas acrescentam vai por cima: a etapa mostra base, bônus, total e modificador. No máximo uma etapa de atributos.
- `allocate` (Capability API 1.152): bolinhas distribuídas em estágios com cotas por prioridade ou orçamentos por grupo, descritas abaixo.
- `trained`: as escolhas de perícias e salvaguardas que as escolhas oferecem, e o próprio `choose: [{ "what": "skills", "count": 2, "from": [...] }]` da etapa (qualquer uma delas quando `from` é omitido).
- `startingGear`: lista o equipamento inicial do conjunto. O equipamento é pego numa partida, no inventário, como sempre.
- `choices` (Capability API 1.91): `catalog` nomeia um catálogo de linhas, e a etapa é onde são escolhidas as entradas dele que as escolhas concedem (`grants.entries`, abaixo), como um idioma à sua escolha.

Uma etapa de equipamento inicial pode ter `"strict": true` (Capability API 1.109). No modo só permitidos, o padrão, ela só oferece equipamento cujo `fits` lê verdadeiro na ficha como está, sem estado vivo, mais o equipamento sem `fits`; não há lista de outros equipamentos. Para 5e, coloque `fits: { "value": { "field": "wizard_level" }, "atLeast": 1 }` no kit do Wizard e o campo de nível de classe correspondente em cada kit de outra classe; deixe `fits` fora do kit do Acolyte para que ele sirva para todos. A edição livre oferece de novo todos os kits. O seletor do inventário limpa uma seleção que deixa de servir depois de uma mudança de classe ou ao sair da edição livre e diz por quê; ele também verifica se serve antes de pegar o equipamento. Sem equipamento que sirva, a etapa mostra o estado vazio, e Next continua disponível. Etapas sem `strict` continuam oferecendo todos os kits. O modo é local a cada tela, não é registrado com uma construção salva nem enviado ao servidor.

O que uma escolha dá são os `grants` da entrada, lidos só pelo construtor:

```json
{
  "id": "half-elf",
  "label": "Half-Elf",
  "grants": {
    "abilities": { "add": { "cha": 2 }, "choose": [{ "count": 2, "amount": 1, "except": ["cha"] }] },
    "trained": { "skills": [], "saves": [], "choose": [{ "what": "skills", "count": 2 }] },
    "sets": { "speed": 30 }
  }
}
```

- `abilities.add` soma aos valores; `abilities.choose` permite ao jogador escolher `count` atributos (nunca um duas vezes, nunca um de `except`) que recebem `amount` cada. Com `"repeat": true` (Capability API 1.93), um atributo pode ser escolhido mais de uma vez, `amount` a cada vez, então `{ "count": 2, "amount": 1, "repeat": true }` é o +2 num atributo ou +1 em dois de um aumento de valor de atributo; a etapa mostra um sinal de menos ao lado de um atributo para desfazer um. Em qualquer caso, nenhum valor passa do seu `max`. `upTo` (Capability API 1.96) limita até onde a própria escolha pode elevar um valor, depois do que todas as outras concessões somam: `{ "count": 2, "amount": 1, "repeat": true, "upTo": 20 }` é o aumento do SRD, que "can't increase an ability score above 20"; a etapa desativa um atributo que já está nesse valor. A escolha aparece na etapa de atributos, ou onde a entrada foi escolhida quando não há nenhuma.
- `trained` treina perícias e salvaguardas e oferece escolhas, mostradas na primeira etapa de treinamento ou onde a entrada foi escolhida. Elas são treinadas no `tier` da concessão, senão no `tier` do construtor, senão no primeiro nível acima de sem treinamento que a ficha oferece para perícias ou salvaguardas. Uma escolha nunca oferece o que as escolhas já treinam no seu nível ou acima, diretamente ou por uma escolha anterior (Capability API 1.104): um antecedente que treina Insight deixa a escolha de perícias de uma classe para as outras, como o SRD pede. Uma escolha guardada antes de ser tomada dessa forma não conta, então a etapa pede outra, e uma escolha sem nada a oferecer não é mostrada. Uma escolha pode dizer `"held": "<tier>"` (Capability API 1.105): ela só oferece o que as escolhas treinam nesse nível ou acima, ou o que uma escolha abaixo do próprio nível mantém ali, como a Expertise de 5e são duas perícias em que você é proficiente: `{ "tier": "expertise", "choose": [{ "what": "skills", "count": 2, "held": "proficient" }] }`. `held` fica abaixo do nível em que a escolha treina.
- `sets` escreve valores de campo: o dado de vida de uma classe, seu atributo de conjuração.
- Uma entrada de catálogo pode dizer quando uma etapa do construtor a oferece: `offeredWhen` (Capability API 1.99) é um valor lido da ficha como está, e a entrada só é oferecida enquanto ele ler acima de 0, como 5e oferece uma segunda classe só quando os pré-requisitos de multiclasse são atendidos (um valor derivado por classe). Uma escolha que depois lê 0 deixa de contar e é mantida, como as de `upTo`. Uma entrada cuja própria escolha muda o que seu `offeredWhen` lê (um valor que ela aumenta, um campo que define, uma perícia que treina, uma lista em que escreve, diretamente ou por meio de um valor derivado) é recusada, já que ela se ofereceria, se retiraria e se ofereceria de novo. Uma entrada com um grupo `exclusive` é lida na ficha sem nenhuma das escolhas que a etapa guardou nesse grupo (Capability API 1.100), já que escolhê-la as descarta: um talento tomado no lugar de um aumento de valor de atributo e que exige Strength 13 não é oferecido com a Strength que esse aumento deu. Uma escolha que uma entrada concede (`grants.entries.choose`) mantém suas opções sujeitas ao `offeredWhen` delas da mesma forma (Capability API 1.106). O seletor de catálogo em **All fields** oferece todas as entradas, como sempre.
- Uma entrada de catálogo pode nomear um grupo `exclusive` (Capability API 1.94): uma etapa do construtor mantém uma escolha de cada grupo, então escolher uma descarta a outra escolha da etapa nesse grupo, e só a mais recente conta. Um talento tomado no lugar de um aumento de valor de atributo compartilha um grupo com ele: `"exclusive": "fighter-asi-4"`.
- `entries` (Capability API 1.91) oferece entradas de outro catálogo de linhas para escolher: `{ "choose": [{ "catalog": "languages", "count": 1 }] }`, no máximo seis escolhas. `filters` fixa valores dos filtros desse catálogo, e `ids` lista as únicas entradas oferecidas (`{ "catalog": "tools", "count": 1, "ids": ["smiths-tools", "brewers-supplies", "masons-tools"] }`). Elas são escolhidas na etapa `choices` do construtor para esse catálogo (uma concessão que nomeia um catálogo sem essa etapa é recusada), só são oferecidas entradas que escrevem linhas e as linhas delas vão para a ficha, e uma entrada escolhida para uma concessão não é oferecida a outra. As concessões delas não são aplicadas.
- Uma escolha também escreve as `rows` da entrada, uma vez. Uma entrada pode ter `grants` e nenhuma `rows` (uma classe cujas características vêm de outro catálogo), e um catálogo cujas entradas só concedem não precisa de `feeds`; o seletor de catálogo nunca oferece essas entradas.

Desmarcar retira o que uma escolha deu, e só isso: os aumentos (até onde os limites de um valor deixaram subir), o treinamento, os valores de campo e as linhas. O que a ficha já tinha do próprio jogador (uma perícia treinada à mão, uma linha acrescentada pelo seletor de catálogo) continua sendo dele, e uma edição feita em **All fields** fica até a resposta do próprio construtor para esse valor mudar. Uma entrada escolhida em duas etapas do mesmo catálogo concede uma única vez, e uma que as camadas de uma partida ocultam continua contando pelo que deu. Um campo que uma escolha define com `sets` só é escrito enquanto ainda estiver em branco, ou enquanto o construtor já responder por ele, então um nível digitado à mão nunca é sobrescrito; um valor pelo qual o construtor responde e que o jogador muda na própria etapa de campos continua sendo do construtor e some quando uma escolha posterior não o pede mais. As escolhas do jogador ficam guardadas ao lado da ficha, então uma etapa pode ser reaberta depois.

**Distribuição de pontuações em estágios (Capability API 1.152).** Uma etapa `allocate` compra uma bolinha por ponto, com orçamento e limites de criação próprios. Ela não muda o método nem as respostas salvas da etapa única `abilities`. Use etapas separadas para atributos, Virtudes e os freebies posteriores:

```json
{
  "id": "attributes",
  "label": "Attributes",
  "kind": "allocate",
  "priorities": [7, 5, 3],
  "annotations": true,
  "groups": [
    {
      "id": "physical",
      "label": "Physical",
      "targets": [{ "ability": "strength" }, { "ability": "dexterity" }, { "ability": "stamina" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "social",
      "label": "Social",
      "targets": [{ "ability": "charisma" }, { "ability": "manipulation" }, { "ability": "appearance" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "mental",
      "label": "Mental",
      "targets": [{ "ability": "perception" }, { "ability": "intelligence" }, { "ability": "wits" }],
      "base": 1,
      "min": 1,
      "max": 5
    }
  ]
}
```

Há de 1 a 12 grupos, cada um com `id` estável, `label` e de 1 a 120 alvos. Os alvos são distintos dentro da etapa inteira. Um alvo nomeia exatamente um `{ ability }` existente, um `{ field }` numérico, um `{ skill }`, um `{ save }` ou um `{ bonus }`; um bônus é a entrada numérica de `build.bonuses` para uma perícia ou salvaguarda existente. Os grupos usam exatamente um modo de orçamento: `priorities` tem uma cota inteira não negativa por grupo (repetições permitidas), ou **todo** grupo declara `budget: Ref`. Os lugares de prioridade são atribuídos explicitamente, e atribuir um lugar ocupado troca os grupos. A ordem da matriz nomeia primário, secundário, terciário e depois prioridades numeradas; coloque as cotas maiores primeiro se esses nomes devem acompanhar o tamanho. Os orçamentos são de no máximo 1.200.000 pontos.

`base` é opcional; `min` e `max` são obrigatórios. Cada um aceita um inteiro ou uma `Ref` que não seja viva, como `{ "derived": "archetype_floor" }`. As pontuações precisam resultar em números inteiros de 0 a 10.000 e caber nos limites de armazenamento ou no mapa de níveis do alvo. A primeira base substitui o padrão de um alvo em branco, mantendo os valores de método e as concessões existentes; uma base posterior é um piso sobre os estágios anteriores. Sem base, o estágio começa na pontuação existente. Mínimo e máximo iguais fixam o valor de criação: `base: 0, min: 0, max: 0` expressa uma Appearance fixa. Os mínimos não compram bolinhas automaticamente. Orçamentos e limites podem usar os operadores derivados existentes, mas não podem ler alvos mudados por esta etapa ou por uma posterior, nem por meio de valores derivados. Condições em concessões gratuitas também não podem ler pontuações num grupo de distribuição que elas possam mudar, inclusive grupos conectados em outros estágios. Preços por fórmula não têm suporte: todo incremento pago custa um ponto. Uma fonte não resolvida ou inválida aparece como **not configured** (não configurado).

Alvos de perícia e de salvaguarda precisam de `sheet.builder.ratingTiers`, separadamente para cada alvo:

```json
"ratingTiers": [
  { "target": { "skill": "athletics" }, "tiers": ["none", "trained", "expert"] },
  { "target": { "save": "will" }, "tiers": ["none", "trained"] }
]
```

O índice da matriz é a pontuação numérica. Os mapas têm de 1 a 12 IDs de nível existentes, oferecidos e crescentes, começando no nível sem treinamento do conjunto; eles nunca são deduzidos dos bônus dos níveis. Alvos diferentes podem usar mapas diferentes. Coloque alvos com limites de criação diferentes em grupos separados.

O `grants.ratings` de um catálogo fornece bolinhas gratuitas, antes de **todos** os estágios pagos:

```json
"ratings": [
  { "target": { "skill": "athletics" }, "add": 1 },
  { "target": { "save": "will" }, "set": 1 }
]
```

Cada concessão tem ou um `add` positivo ou um `set` não negativo, nunca os dois. Todas as concessões `set` são pisos: a maior vence, depois todas as somas se acumulam, parando no limite de armazenamento do alvo. Duas somas gratuitas de graduação chegam, portanto, à graduação dois, sem cobrar do orçamento pago. O treinamento existente e as concessões de campo e de atributo se combinam antes dessas concessões de pontuação. As escolhas de entrada continuam só escrevendo linhas; elas nunca aplicam recursivamente as concessões da entrada escolhida.

A interface mostra as pontuações base/anterior, gratuita, comprada e total, a faixa de criação e o orçamento restante. O sinal de mais fica desativado num limite, sem orçamento ou enquanto compras inválidas ou substituições manuais precisarem de atenção. Gastar de menos, mínimos impossíveis e substituições recebem selos; Back e Next continuam disponíveis. Reatribuir uma prioridade mantém os incrementos salvos do grupo. Um grupo que gastou demais fica inativo por inteiro; uma compra acima do limite do alvo fica inativa para esse alvo. Reduza ou limpe essas respostas para corrigi-las, ou restaure a cota anterior para reativá-las. Estágios posteriores podem passar dos limites de criação anteriores. **All fields** continua sendo a edição livre, com as substituições mostradas explicitamente em vez de ajustadas às regras de criação.

O `builder.allocations[stepId]` salvo guarda os índices dos lugares de prioridade pelo ID do grupo, os incrementos pagos `bought` e `notes` opcionais por chaves de alvo estáveis `kind/id` (por exemplo, `ability/strength`). `annotations: true` oferece até 1.000 caracteres por alvo para explicações de herança ou especialidades; o construtor não julga esse texto. Os incrementos aplicados pertencem separadamente a cada estágio. Reabrir nunca concede de novo as concessões nem reabastece recursos, e descrever uma ficha existente registra as escolhas sem reescrevê-la, inclusive quando a descrição termina. Desmarcar recalcula as pontuações gratuitas e os estágios pagos, preservando as diferenças manuais.

**Orçamentos compartilhados e compras com preço (Capability API 1.153).** Declare até 12 reservas de criação em `sheet.builder.pools`. Várias etapas `spend` podem usar uma mesma reserva; reservas separadas mantêm independentes os pontos de ocupação e os de interesse pessoal. Os orçamentos são referências de valor que não são vivas, inclusive os cálculos existentes `sum`, `scale`, `multiply`, `min`, `max`, `stepTable`, `enumTable` e `listSum`. O valor resolvido precisa ser finito e estar entre 0 e 100.000. Uma fonte ausente aparece como "not configured".

```json
{
  "pools": [
    { "id": "occupation", "label": "Occupation", "budget": { "derived": "occupation_points" }, "creditLimit": 0 },
    { "id": "interest", "label": "Personal interest", "budget": { "derived": "interest_points" } }
  ],
  "steps": [
    {
      "id": "occupation_skills",
      "label": "Occupation skills",
      "kind": "spend",
      "pool": "occupation",
      "offers": [
        {
          "id": "accounting",
          "label": "Accounting",
          "target": { "field": "accounting_value" },
          "cost": { "flat": 1 },
          "min": 5,
          "max": 99
        }
      ]
    }
  ]
}
```

Cada etapa tem até 120 ofertas com `id` e `label` estáveis. Os alvos usam o mesmo contrato de exatamente um `ability`, `field` numérico, `skill`/`save` mapeado ou `bonus` dos estágios de distribuição. Compras de linhas de lista ficam reservadas para o recurso de identidade de linha (F4); esta API não identifica linhas pela posição na matriz. Os limites precisam caber nos limites de armazenamento do alvo. As pontuações iniciais e as concessões gratuitas são preservadas, nunca cobradas de novo: um Background com duas bolinhas gratuitas e cinco pagas tem sete.

Um custo é exatamente um destes:

- `{ "flat": 1 }`: um ponto por incremento de pontuação.
- `{ "perRank": 5 }`: cinco vezes a próxima graduação, então subir de 2 para 3 custa 15.
- `{ "table": [[5, 0], [5.25, 5], [5.5, 12]] }`: preços acumulados em pontuações crescentes. A próxima compra vai para a pontuação seguinte e custa a diferença (5, depois 7, aqui). Pontuações fracionárias exigem um campo numérico não inteiro; as tabelas incluem os dois limites da oferta.

O `overrides: [{ "when": { "derived": "career_affinity" }, "cost": { "perRank": 2 } }]` opcional contém no máximo 12 entradas. A primeira condição positiva vence. As condições leem a ficha antes das compras; sem correspondência, vale o preço base. Orçamentos e condições não podem ler alvos comprados, nem por meio de valores derivados, nem depender de escolhas posteriores. As concessões gratuitas e os estágios de distribuição são aplicados antes das compras com preço.

Os preços têm margens positivas, exceto créditos declarados explicitamente. Para um defeito cuja pontuação aumenta, use `"credit": true, "cost": { "flat": -1 }`. Para uma redução a partir de uma base declarada, use `"credit": true, "baseline": 10, "min": 6, "max": 10, "cost": { "flat": 1 }`: uma compra reduz 10 para 9 e registra um crédito de um ponto. O valor inicial precisa coincidir com a base. Um alvo de crédito tem uma única oferta em todo o construtor, o que impede ciclos de compra e crédito.

As reservas têm crédito zero por padrão. Defina `creditLimit` como o crédito total máximo e, opcionalmente, acrescente até 12 `caps: [{ "filter": "flaw", "maxCredit": 2 }]`. Os filtros nomeiam `tags: ["flaw"]` de ofertas, então os créditos de defeitos e de desvantagens podem ter limites separados. Os limites contam os créditos brutos, independentemente dos gastos positivos. Contagens distintas de peculiaridades continuam sendo restrições de escolha ou de linha.

**Linhas contadas e linhas que correspondem (Capability API 1.205).** Um `listSum` pode ter `where: { "column", "equals" }` para ler só as linhas cuja célula é igual a um valor (uma célula vazia lê o padrão da coluna), e `count: true` no lugar de `column` para contar as linhas em vez de somar uma coluna. A pirâmide de talentos de Genesys são duas contagens derivadas e uma regra de criação:

```json
{
  "id": "tier2",
  "label": "Tier 2 talents",
  "op": "sum",
  "of": [{ "listSum": { "list": "talents", "count": true, "where": { "column": "tier", "equals": 2 } } }]
}
```

com uma regra cujo `value` lê `tier2` e cujo `max` lê a contagem do nível 1 menos um.

**Preços de linha calculados por linha (Capability API 1.206).** O `cost` em forma de objeto de uma etapa de linhas pode multiplicar sua `column` por `times` e somar `add`, então `{ "column": "tier", "times": 5 }` dá a um talento de Genesys o preço de 5 XP por nível; `add` sozinho é um preço fixo escrito como objeto. `overrides` (até 4) dá um preço usado no lugar quando um valor derivado nomeado por um prefixo e pela própria célula da linha lê acima de 0 na ficha: `{ "add": 5, "overrides": [{ "derived": { "prefix": "affinity_", "cell": "ability" }, "cost": 4 }] }` dá a um Charm de Exalted o preço de 4 Bonus Points quando `affinity_<its Ability>` está acima de 0. Uma célula enum precisa ter um valor derivado para cada valor que pode conter.

**Ofertas sem preço (Capability API 1.207).** O `cost` de uma oferta de gasto (ou de uma substituição) pode ser `{ "unpriced": true }` enquanto a fonte não tiver fornecido o preço: a oferta aparece com uma nota, prende a reserva por nada e nunca é comprada. Uma compra salva com um preço que depois passa a não ter preço fica inativa e é mantida para correção.

**Mais campos (Capability API 1.208).** Uma ficha pode declarar até 240 campos; antes da 1.208, o teto é 160. As graduações de perícia, as graduações de categoria, os potenciais e os totais de Rolemaster precisam desse espaço.

**Rolagens escritas num atributo (Capability API 1.209).** A rolagem de uma etapa `roll` pode nomear `ability` em vez de `field` (exatamente um dos dois). O resultado fica dentro dos limites do próprio atributo. Com `gain`, o teste é rolado contra o valor, e só um resultado acima dele soma o ganho, que o construtor passa a manter como aumento: rolar ou comprar o valor de novo mantém a melhoria por cima. Sem `gain`, o resultado é escrito como um valor digitado, mantido até a resposta do próprio construtor para esse valor mudar. Um atributo calculado não pode ser rolado, e cada atributo é rolado no máximo uma vez por etapa.

**Colunas de lista calculadas (Capability API 1.210).** Uma coluna numérica pode nomear `sum`: até seis outras colunas numéricas da mesma linha, somadas (uma célula vazia lê o padrão da sua coluna) e mantidas entre o `min` e o `max` da coluna. A célula aparece somente leitura, é preenchida a cada leitura de uma ficha salva e é lida por somas, testes de linha e tudo o mais como uma célula digitada. Uma coluna calculada não é rolada e nunca soma outra coluna calculada. A pontuação de uma especialidade de CoC é `"sum": ["base", "occupation", "interest"]`.

**Aumentos parciais de valor (Capability API 1.211).** O `abilities.choose` de uma concessão pode nomear `partialFrom`. Um valor que já está nessa marca ou acima quando a escolha chega recebe um aumento parcial, e dois parciais dão `amount` uma vez. As escolhas contam na ordem em que o construtor as faz, depois de todos os aumentos inteiros, então os boosts posteriores de Pathfinder 2e leem `"amount": 1, "partialFrom": 4`: um modificador +4 precisa de dois boosts para chegar a +5. Combina com `upTo`.

**Testes de linha numa postura (Capability API 1.212).** Uma entrada de `checks[]` de uma lista pode nomear `stance`, uma das `resolution.stances` da reserva de dados. O teste de toda linha fica então nessa postura, como uma perícia que a postura lista: as pursuits de Stewpot contam dados do jeito STILLNESS. O lembrete do Game Master nomeia as linhas com as perícias da postura.

**Especialidades de atributo (Capability API 1.213).** O `contextual` de uma lista pode definir `"abilities": true`. A célula `skill` dela pode então nomear um atributo (pelo ID, pelo rótulo ou pela forma curta), além de uma perícia, e a linha se aplica a qualquer teste rolado com esse atributo: um teste de atributo puro, uma perícia cujo atributo próprio é ele, ou uma perícia que `with=` troca para ele. Uma especialidade de atributo de World of Darkness, "Strength: lifting", é uma linha chamada "lifting" cuja célula de perícia diz "Strength".

**Anulação desativada (Capability API 1.214).** Um `check` contextual (no `contextual` de uma lista ou no `mechanics.contextual` de uma entrada) pode definir `"cancel": false`. Numa rolagem em que ele é aplicado, faces iguais ou inferiores a `resolution.cancel.upTo` não retiram sucessos; uma falha crítica ainda as lê. O conjunto precisa ter um `resolution.cancel` para desativar.

**Itens disponíveis sem carregá-los (Capability API 1.215).** O `grants.itemAccess` de uma entrada de catálogo lista até 48 itens do conjunto (`<catalog>/<entry>`, nunca um serviço). Escolher a entrada no construtor guiado os deixa disponíveis para o personagem: a ficha e o bloco de ficha do Game Master os listam como não carregados, e nada vai para a bolsa. O Game Master acrescenta um ao inventário quando ele é pego, como um personagem de Blades declara a carga no início de um trabalho (score).

**Bolinhas de linha na criação (Capability API 1.216).** Um grupo `allocate` pode nomear `rows`, até quatro pares `{list, column}`: as bolinhas nessa coluna numérica nas linhas da lista contam contra o orçamento do grupo, ao lado dos alvos dele. As linhas são editadas na lista; um grupo com mais bolinhas de linha do que seu orçamento fica esperando o jogador. A substituição de custo de uma etapa de linhas pode dar `times`, uma taxa por unidade para a coluna de custo, no lugar de um `cost` fixo. As linhas de Craft de Exalted colocam "dots" contra os 28 pontos de Ability e dão às bolinhas "bought" o preço `times: 2`, substituído por `times: 1` onde `affinity_<ability>` está definido; uma coluna de pontuação calculada (1.210) soma os dois.

**A melhor pontuação (Capability API 1.217).** Um `check` contextual pode definir `"best": true`: um teste de perícia em que ele é aplicado rola a melhor pontuação de perícia do personagem quando ela é maior que a pedida. Um conjunto `dice-highest` pode usar um teste contextual que faça só isso; todos os outros efeitos de teste continuam exigindo uma reserva de dados. O Rook's Gambit de Blades é uma linha de habilidade especial com `"check": {"best": true}`, aplicada pelo nome.

**Custos que marcam uma trilha (Capability API 1.218).** Uma entrada de `cost` contextual pode ser `{"track": "<id>", "by": N}`, além de `{"pool", "amount"}`: aplicar a linha ou a entrada marca N nessa trilha viva comum, até onde os limites dela deixam (uma trilha de ferimentos não é marcada dessa forma). O `contextual` de uma lista também pode ter um `cost`. O Rook's Gambit de Blades é uma linha com `"check": {"best": true}` e `"cost": [{"track": "stress", "by": 2}]`. Nomes aplicados por `apply=` leem igualmente apóstrofos e aspas curvos e retos.

**Catálogos emprestados (Capability API 1.220).** Um catálogo pode pegar emprestado o catálogo de outro conjunto instalado em vez de ter o próprio: `{ "id": "creatures", "label": "Creatures", "holds": "creatures", "from": { "ruleset": "5e-2014", "catalog": "creatures" } }`. O conjunto que empresta é encontrado pelo ID, sozinho ou sob um namespace da comunidade, e as entradas dele são lidas à luz do conjunto que as pega emprestadas, então uma entrada que nomeia algo que esse conjunto não declara (uma condição, um nível de ameaça, um sentido) fica de fora e é registrada, enquanto as demais passam. `entries` ao lado de `from` se somam às emprestadas, ou substituem uma de mesmo ID; elas são verificadas quando o conjunto é lido, então o cabeçalho nomeia os `filters` que elas usam (um cabeçalho sem nenhum recebe os de quem empresta). Uma criatura emprestada escrita como ficha usa os IDs de quem empresta; `from.sheet` diz como eles são lidos no conjunto que pega emprestado: `fields` mapeia um campo para outro ID (ou `null` para deixá-lo de fora), `values` mapeia os valores de um campo, e `tiers` mapeia níveis de proficiência (os de uma criatura e os que qualquer entrada concede ou pede), como em `"sheet": { "fields": { "ac": "ac_typed", "size": null }, "values": { "hp_method": { "by_hand": "manual" } }, "tiers": { "proficient": "trained" } }`. Qualquer entrada emprestada, inclusive itens, aceita mais duas: `refs` lê um valor derivado de quem empresta como um dos valores do conjunto que pega emprestado (`"refs": { "prof_martial_weapons": { "field": "martial_weapons" }, "armor_speed_strength": { "abilityScore": "str" } }`), e `slots` coloca o espaço de um item sob o nome usado pelo conjunto que pega emprestado (`"slots": { "body": "armor" }`). Um catálogo não pode pegar emprestado do próprio conjunto nem de um catálogo que, por sua vez, também pega emprestado. A arte de uma criatura emprestada é encontrada como a de quem empresta (`5e-2014/creatures/<id>` num pacote de criaturas). Referências dentro de um catálogo emprestado, como as magias de uma criatura, são verificadas quando o catálogo é lido, não quando o conjunto é.

**Listas de avanço mais longas (Capability API 1.219).** `sheet.advancement.fields` aceita até 64 campos (eram 24), então um jogo em que um nível aumenta muitos campos, como os espaços de cada nível de magia e as listas de proficiência, pode deixar o GM aumentar todos eles. Uma lista com mais de 24 campos exige 1.219.

**Compras nos dois sentidos, possuídas e trocadas (Capability API 1.164).** `"direction": "both"` permite que uma oferta aumente e diminua a pontuação a partir de onde ela começa (sua `baseline`, quando declarada, precisa coincidir com a ficha): cada passo para cima custa o preço da curva, e cada passo para baixo além do início o devolve como crédito, limitado pelo `creditLimit` e pelos limites da reserva. O registro de compras só corre num sentido de cada vez, então reduzir uma pontuação que foi comprada desfaz a última compra pelo preço pago, e aumentar uma reduzida devolve o crédito dela; comprar e reduzir nunca gera crédito. Um alvo assim tem uma única oferta em todo o construtor. O ST de GURPS é `{ "target": { "ability": "st" }, "direction": "both", "baseline": 10, "min": 7, "max": 14, "cost": { "flat": 10 } }`; um custo em tabela dá preço a passos fracionários, como Basic Speed. `"direction": "increase"` e `"decrease"` nomeiam diretamente uma oferta de um só sentido (`"decrease"` é a redução acima, com sua base e seu crédito).

`"effect": "ownership"` dá preço a uma oferta na própria escala, a partir da sua `baseline` (ou de `min`) para cima, e a ficha mantém o maior entre o próprio valor e o nível comprado: uma familiaridade de um ponto de GURPS é paga e listada mesmo quando um valor padrão já é melhor, e reembolsá-la não custa nada à ficha.

`"exchange": { "from": <rating>, "units": 2, "gain": 1, "floor": 9 }` faz de uma oferta uma troca fechada de criação: cada compra reduz `from` em `units` e aumenta o alvo em `gain` (padrão 1), nunca levando `from` abaixo de `floor` nem o alvo além de `max`. Ela não custa nada à reserva, então omite `cost`. Pontos trocados nunca são trocados de novo: depois que uma troca aumentou uma pontuação, nenhuma outra troca a reduz, e depois que uma reduziu uma pontuação, nenhuma outra troca a aumenta. Trocas que uma classe não pode fazer (`when`) podem nomear as mesmas pontuações no sentido inverso. Um reembolso devolve as duas pontuações. A troca de requisito principal de OSE é uma oferta por valor reduzido:

```json
{
  "id": "wis_to_int",
  "label": "Lower Wisdom to raise Intelligence",
  "target": { "ability": "int" },
  "exchange": { "from": { "ability": "wis" }, "units": 2, "floor": 9 },
  "min": 3,
  "max": 18
}
```

O construtor guarda os deltas pagos com sinal e seus preços originais sob IDs estáveis de etapa e oferta, com no máximo 1.000 linhas de compra por oferta. O reembolso remove a linha mais recente e desfaz exatamente a contribuição dela e o preço registrado, inclusive removendo um crédito. Ele nunca reembolsa uma pontuação gratuita. Nenhum XP vivo, inventário, moeda ou recurso do grupo é gasto.

Mudar de carreira, de concessões gratuitas ou de fontes de orçamento mantém o registro de compras. Compras inválidas ficam inativas; a reserva mostra o gasto original, pontos restantes negativos quando gastou demais e o novo preço proposto. Alvos compartilhados também suspendem compras dependentes em outras reservas. **Reprice saved purchases** (reajustar o preço das compras salvas) aceita explicitamente um novo preço válido para a reserva; caso contrário, reembolse linhas para corrigi-la. Nenhuma compra é excluída ou vendida em silêncio. Pontos não gastos são só informativos. Back/Next continuam disponíveis, e **All fields** preserva substituições manuais visíveis dentro dos limites do esquema. Descrever um personagem existente e reabrir escolhas salvas nunca concede bolinhas de novo.

**Linhas nomeadas (Capability API 1.154).** Uma etapa `rows` permite ao jogador acrescentar, editar e remover as próprias linhas numa das listas da ficha durante a construção: servidores, contatos, rituais e seus ingredientes, ou qualquer outra coisa que um catálogo não lista.

```json
{
  "id": "retainers",
  "label": "Retainers",
  "kind": "rows",
  "list": "retainers",
  "columns": ["name", "role", "loyalty"],
  "required": ["name"],
  "min": 1,
  "max": 4,
  "defaults": { "role": "Hireling" }
}
```

`columns` é o subconjunto das colunas da lista que a etapa edita (todas, quando omitido). `required` nomeia as colunas que uma linha precisa preencher para contar. O selo conta as linhas inteiras que ainda faltam abaixo de `min` (de 0 a 20), mais toda linha com uma célula obrigatória vazia, então um ingrediente escrito pela metade continua pendente. `max` bloqueia **Add a row** (acrescentar uma linha) e nunca passa do `maxItems` da lista. Uma linha nova parte dos padrões das próprias colunas, depois de `defaults`, que precisa caber em cada coluna.

A etapa edita a lista onde cada linha está, então dois servidores com o mesmo nome continuam sendo duas linhas, e remover um mantém o outro. Linhas que uma escolha de catálogo escreveu aparecem somente leitura com a nota "Added by a pick" e vêm e vão com a escolha. **All fields** edita todas as linhas como antes.

**Ofertas condicionais, limites lidos da ficha e regras de criação (Capability API 1.155).** Uma oferta de gasto também pode ter:

- `when: Ref`: só é oferecida enquanto ler acima de 0 na ficha antes das compras, como as perícias próprias de uma ocupação ou um Background que uma tribo pode ter. Uma oferta nunca comprada deixa a reserva como está; compras salvas numa oferta que o personagem não pode mais ter continuam, inativas, para correção.
- `minFrom: Ref` e `maxFrom: Ref`: um piso e um teto lidos da ficha, mantidos dentro de `min` e `max`. Credit Rating recebe a faixa da sua ocupação; Dodge para em DEX. Uma pontuação abaixo do piso é comprada até ele numa única compra.
- `allowedRatings: number[]`: as únicas pontuações em que uma compra pode terminar, como um Merit vendido com 1, 3 ou 5 bolinhas. Cada compra vai direto para a próxima pontuação permitida pelo preço da curva.

Assim como orçamentos e substituições, eles não podem ler um alvo comprado. Uma escolha de treinamento com `onDuplicate: "replace"` pode nomear `replacementFrom`, as perícias (ou salvaguardas) por que uma duplicata pode ser trocada, no lugar de todas as que a ficha tem; isso vale para o que é mostrado, salvo e aplicado.

`sheet.builder.constraints` comporta até 40 regras de criação. Cada uma nomeia a `step` cujo selo a leva e o `label` mostrado ali enquanto ela falha, um `when: Ref` opcional e exatamente um destes:

- `value: Ref` com `min` e/ou `max` (cada um, um número ou uma Ref).
- `rows: { list, filter?, sum? }` com `min` e/ou `max`: a contagem das linhas da lista, ou o total da coluna numérica `sum`, nas linhas que `filter` mantém (`{ column, equals?, below?, above? }`).
- `distinct: { list, column }`: nenhuma linha compartilha com outra um valor preenchido (ignorando maiúsculas e espaços).
- `approved: fieldId`: um campo booleano que precisa estar ativado, como a aprovação de um Storyteller.

```json
{
  "constraints": [
    {
      "id": "disadvantage_cap",
      "label": "Disadvantages give at most 50 points.",
      "step": "traits",
      "rows": { "list": "traits", "filter": { "column": "cost", "below": 0 }, "sum": "cost" },
      "min": -50
    }
  ]
}
```

Uma regra que falha nunca bloqueia Back, Next nem **All fields**.

**Valores calculados e efeitos aplicados a uma rolagem (Capability API 1.156).** Um atributo pode ter `value: Ref[]` (de 1 a 8): seu valor é a soma deles, mantida entre seus `min` e `max`, e aparece somente leitura. Um atributo de Blades é a soma das suas ações marcadas; a Perception de GURPS é `[{ "abilityScore": "iq" }, { "field": "perception_bought" }]`, e as perícias que rolam com ela acompanham o que foi comprado. Valores derivados, tetos e perícias podem ler um valor calculado, mas nenhum valor calculado pode ler outro, nem por meio de um valor derivado. O construtor nunca define um, e qualquer coisa guardada para ele é ignorada.

Uma lista pode declarar `contextual` para que suas linhas se apliquem a uma rolagem quando o Game Master as nomeia:

```json
{
  "id": "stunts",
  "label": "Stunts",
  "maxItems": 10,
  "columns": [
    { "id": "name", "label": "Name", "type": "text", "maxLength": 80 },
    { "id": "skill", "label": "Skill", "type": "text", "maxLength": 40 },
    { "id": "bonus", "label": "Bonus", "type": "number", "min": -5, "max": 5, "default": 2 }
  ],
  "contextual": { "name": "name", "skill": "skill", "bonus": "bonus" }
}
```

`name` é a coluna pela qual o Game Master nomeia uma linha. `skill` (opcional) contém a perícia a que uma linha se aplica, pelo ID ou pelo rótulo; uma célula vazia se aplica a qualquer teste. `bonus` (uma coluna numérica) e `dice` (uma coluna de dados) somam ao teste, como dados num conjunto de reserva. `to: "saves"` aplica as linhas a salvaguardas no lugar. Num conjunto de reserva, `check: { dice?, successes?, double?, explode? }` dá a toda linha aplicada o mesmo efeito na reserva, como uma especialidade cujos 10 explodem.

Uma entrada de catálogo pode ter `mechanics.contextual` com `effects` (`own-checks-advantage` e os outros efeitos de teste e de salvaguarda), `modifiers` em `checks` ou `saves`, `skills` e `saves` que os restringem, um efeito `check` de reserva e `cost: [{ "pool": "...", "amount": 1 }]`, pago uma vez na rolagem em que é aplicado. O Game Master escreve `apply="Strong Back; Quick Eye"` (até quatro nomes) num teste. Só os nomes que se aplicam a esse teste o mudam: uma linha de outra perícia, um nome que duas linhas compartilham e um custo que a reserva não cobre não mudam nada. Ter uma linha nunca muda uma rolagem por si só. O registro lista o que foi aplicado em `from`.

**Moedas iniciais roladas e lidas da ficha (Capability API 1.157).** Uma linha de moedas do equipamento inicial pode ter `roll` (dados como `"2d6"`) ou `countFrom` (uma Ref lida da ficha de quem a recebe) no lugar de `count`, nunca os dois, e `times` (de 1 a 10000) multiplica qualquer um deles:

```json
{ "coins": "gold", "roll": "5d4", "times": 10 }
```

O seletor mostra os dados ("5d4 gold, rolled when taken"). A rolagem acontece uma vez, quando o grupo ou quem recebe pega o pacote, então reabrir o seletor não pode rolá-la de novo. `countFrom` lê a ficha de quem recebe, como um campo de Credit Rating; quem recebe sem ficha é recusado, e uma quantidade 0 não acrescenta nada. As linhas de itens mantêm seu `count` fixo.

**Valores iniciais definidos uma vez (Capability API 1.158).** Uma etapa do construtor com `kind: "initialize"` escreve valores iniciais quando o jogador os confirma, e nunca mais por conta própria:

```json
{
  "id": "start",
  "label": "Starting values",
  "kind": "initialize",
  "writes": [
    { "field": "san_start", "value": { "abilityScore": "pow" } },
    { "field": "xp", "remaining": "creation" }
  ]
}
```

Cada escrita nomeia um campo da ficha e um `value` (um valor fixo, ou uma Ref para um campo numérico) ou `remaining`, o que uma reserva do construtor deixou sem gastar. A etapa mostra cada campo agora e o valor que ele vai receber; o selo dela espera até o jogador defini-los. Os valores escritos são salvos com o construtor, então reabri-lo, importar o personagem ou mudar POW depois nunca os escreve de novo. Quando a ficha mudou desde então, a etapa mostra o que definir de novo substituiria, e só o **Set again** (definir de novo) do jogador faz isso. Um personagem que está sendo descrito como já é nunca recebe escritas.

Uma reserva viva pode declarar `startFrom: Ref` para começar num valor lido da ficha em vez de cheia ou vazia, mantido entre 0 e o máximo dela, e uma trilha comum pode declarar `startFrom` no lugar de `default`. Apontada para um campo que uma etapa de inicialização escreveu, SAN começa no POW a partir do qual foi definida e fica onde a partida a deixar: um valor vivo guardado sempre prevalece sobre onde a reserva começa.

**Escolhas e linhas com preço (Capability API 1.159).** Uma etapa de catálogo ou uma etapa de linhas pode nomear uma `pool` do construtor e um `cost`, para que o que o jogador escolhe ou escreve seja pago com a mesma reserva das etapas de gasto. O custo de uma etapa de catálogo é um número ou `{ "filter": "tier" }`, o filtro numérico da própria entrada. O custo de uma etapa de linhas é um número ou `{ "column": "cost" }`, lido de cada linha; um preço negativo é um crédito, limitado pelo `creditLimit` da reserva, então um defeito financia traços. Uma etapa de linhas também pode nomear `from`, um catálogo de linhas que alimenta a lista dela: o jogador acrescenta uma cópia da linha de uma entrada quantas vezes quiser, e cada cópia é uma linha dele, com preço e remoção próprios:

```json
{
  "id": "charms",
  "label": "Charms",
  "kind": "rows",
  "list": "charms",
  "pool": "bonus",
  "cost": { "column": "cost" },
  "from": "charm_book"
}
```

Uma escolha que a reserva não pode pagar não é oferecida. Escolhas e linhas com preço são pagas primeiro e nunca são vendidas pelo jogador: quando retirar um defeito faz a reserva gastar demais, as compras das etapas de gasto deixam de se aplicar até o jogador corrigir isso, e o selo de cada etapa com preço conta a correção. Um total que uma coluna não pode passar (níveis de Rite) é uma regra de criação (1.155) com `rows.sum` e `max`.

**Perfis de criação e fases anteriores (Capability API 1.160).** `sheet.builder.profiles` (até 16) permite que um tipo de personagem, uma carreira ou um pacote traga as próprias etapas e orçamentos:

```json
"profiles": [
  { "id": "dragon", "label": "Dragon-Blooded", "when": { "field": "dragon" },
    "steps": ["aspect_gifts"], "budgets": { "bonus": { "const": 15 } } },
  { "id": "lunar", "label": "Lunar", "when": { "field": "lunar" },
    "steps": ["moon_gifts"], "budgets": { "bonus": { "const": 18 } } }
]
```

O primeiro perfil cujo `when` lê acima de 0 é o do personagem, e o construtor diz qual é. Uma etapa que algum perfil lista só aparece enquanto um perfil que a lista for o do personagem; as respostas dela ficam guardadas enquanto ela está oculta e não concedem nada. Os `budgets` de um perfil substituem os orçamentos próprios dessas reservas, então trocar de tipo nunca mantém o orçamento do outro tipo: compras que ele não cobre mais deixam de se aplicar até o jogador corrigi-las.

Uma etapa de catálogo ou de inicialização pode declarar `reads: { "before": "step_id" }`. O `offeredWhen` das entradas dela e seu `upTo` (ou os valores da etapa de inicialização) passam a ler a ficha como as etapas anteriores a essa etapa a deixam: tudo o que etapas posteriores escolheram, concederam ou compraram é retirado, e o que o jogador digitou é mantido. Uma etapa de multiclasse lê os valores de atributo de antes do aumento deste nível; um instantâneo de Humanity lê as Virtudes de antes dos freebies, por mais que o jogador tenha ido e voltado entre as etapas.

**Linhas que são testes por si mesmas (Capability API 1.161).** Uma lista pode declarar até quatro `checks`, para que cada linha que o jogador escreve seja um teste que o Game Master pode pedir pelo nome:

```json
"checks": [{ "id": "science", "name": "name", "rating": "rating", "ability": "edu" }]
```

`name` é a coluna de texto pela qual uma linha é chamada, e `rating`, a coluna numérica que é a pontuação dela; `ability` (opcional) é somado como o atributo de uma perícia. Science (Physics) e Science (Biology) são duas linhas e dois testes, cada um com a própria pontuação. Dois testes numa mesma lista são duas posturas apoiadas numa só pontuação, cada uma com um `label` que o Game Master diz depois do nome da linha: "Fire stew (bold)" e "Fire stew (careful)". As perícias, as salvaguardas e os atributos próprios da ficha são comparados primeiro. Um nome que duas linhas compartilham não é teste nenhum até que uma seja renomeada, e o teste de uma linha excluída some com ela. O bloco de ficha do Game Master lista todo teste de linha com o seu número, e `with=` funciona como numa perícia. Uma etapa de linhas com preço pela coluna de pontuação (1.159) compra as pontuações com a reserva de criação.

**Rolagens de criação mantidas com seus dados (Capability API 1.162).** Os dados de criação são `{ "count", "sides", "keep"?, "add"?, "multiplier"? }`: as `keep` faces maiores, mais `add`, vezes `multiplier`, então o `(2d6+6) x 5` de CoC é `{ "count": 2, "sides": 6, "add": 6, "multiplier": 5 }`.

O `methods.rolls` de uma etapa de atributos rola todos os valores em ordem, cada um com os dados do próprio grupo, e nunca deixa uma rolagem passar para outro atributo (método `"rolls"`):

```json
"rolls": [
  { "abilities": ["str", "con", "dex", "app", "pow"], "dice": { "count": 3, "sides": 6, "multiplier": 5 } },
  { "abilities": ["siz", "int", "edu"], "dice": { "count": 2, "sides": 6, "add": 6, "multiplier": 5 } }
]
```

Uma etapa de `kind: "roll"` lista até 12 `rolls`, cada uma escrita num `field` numérico: Luck, pontos de vida, dinheiro inicial. `best` (2 ou 3) rola essa quantidade de vezes e mantém a melhor; `floor` (um número ou uma Ref) é o menor valor que o resultado pode ter, como 1 ponto de vida ou um potencial nunca abaixo da sua estatística; `gain` a transforma num teste de melhoria, rolado contra o campo e somando `gain` só quando a rolagem fica acima dele, como faz a melhoria de EDU de CoC. Toda rolagem é mantida com as faces e mostrada com elas. Uma rolagem já feita vale; reabrir o construtor nunca rola de novo, e só uma etapa com `retry: true` oferece isso. Um personagem que está sendo descrito nunca recebe rolagens.

**Escolhas contadas e restrições de criação (Capability API 1.151).** Toda etapa pode ter `when: Ref` (mostrá-la e aplicá-la só enquanto o valor não vivo da ficha estiver acima de zero) e `requiredWhen: Ref` (contar escolhas pendentes no selo dela só enquanto estiver acima de zero). Etapas ocultas mantêm as respostas salvas. Next e Back continuam disponíveis mesmo com escolhas incompletas ou inválidas; All fields continua sendo a edição livre.

Etapas de catálogo podem declarar até 12 `quotas`, cada uma usando um dos filtros tipados do catálogo:

```json
{
  "id": "ratings",
  "label": "Skill ratings",
  "kind": "catalog",
  "catalog": "ratings",
  "min": 10,
  "max": 10,
  "distinctBy": "skill",
  "quotas": [
    { "filter": "rating", "value": 4, "min": 1, "max": 1 },
    { "filter": "rating", "value": 3, "min": 2, "max": 2 },
    { "filter": "rating", "value": 2, "min": 3, "max": 3 },
    { "filter": "rating", "value": 1, "min": 4, "max": 4 }
  ]
}
```

Isso é uma pirâmide no estilo de Fate quando o catálogo oferece cada perícia em cada pontuação. As entradas declaram suas concessões de treinamento com IDs de nível de proficiência explícitos; valores numéricos de filtro nunca inventam um mapeamento de níveis. Uma cota tem `0 <= min <= max <=` o máximo da etapa. Os mínimos afetam o selo; os máximos desativam novas escolhas que correspondam. `distinctBy` nomeia um filtro existente: as escolhas não podem compartilhar o valor dele (nem qualquer tag, num filtro de tags), e uma entrada sem esse filtro não pode contar. Caso contrário, a distinção é pelo ID da entrada. `quotaBelow: { "filter": "tier" }` exige estritamente mais escolhas ativas no nível n−1 do que no nível n, para níveis inteiros positivos acima de 1. O nível 1 é a base. Remover uma escolha de apoio deixa inativas as escolhas superiores em excesso, retirando suas concessões e mantendo suas respostas para correção.

Os espaços de `abilities.choose`, `trained.choose`, `choose` da etapa de treinamento e `entries.choose` aceitam:

- `id`: um ID estável da ficha. Espaços novos devem usá-lo; assim, as respostas salvas sobrevivem a uma reordenação. Espaços antigos sem ID mantêm suas chaves por posição. Os IDs são únicos entre todas as escolhas oferecidas por uma etapa de origem.
- `countFrom: Ref`, com um `max` explícito (de 1 a 20, no máximo 6 para atributos). `count` continua sendo a contagem fixa quando `countFrom` está ausente. Uma contagem dinâmica é arredondada para baixo e limitada entre zero e `max`. Ela lê operadores derivados existentes, nunca expressões executáveis.
- `excludeChoices: ["background/restricted"]`: IDs de escolhas anteriores do mesmo tipo, escritos como `source_step/choice_id`. Eles excluem as respostas ativas da escolha anterior, inclusive substituições. As referências precisam ser verificáveis na definição ou no mesmo arquivo de catálogo. Escolhas de concessão anteriores incluídas no arquivo ou etapas de treinamento explícitas podem, portanto, alimentar um arquivo de catálogo posterior; referências a outro arquivo de catálogo externo são recusadas. Os IDs de escolha entre entradas alternativas de uma mesma etapa também precisam ser únicos.

As escolhas de atributo também aceitam `from`, cruzado com os atributos da ficha e com `except`. Para boosts distintos de PF2e, uma escolha `restricted` pode oferecer `["str", "dex"]`, seguida de uma escolha `free_boost` que exclui `background/restricted`. As escolhas de entrada aceitam as mesmas `quotas`, `distinctBy` e `quotaBelow` das etapas de catálogo, limitadas por `max` ou `count`; elas continuam escrevendo linhas sem aplicar as concessões das próprias entradas escolhidas.

As escolhas de treinamento também aceitam `tier` (um nível oferecido acima de sem treinamento, que substitui o nível da concessão ou do construtor), `only: "any" | "trained" | "untrained"` e `onDuplicate: "replace"`. A elegibilidade lê o treinamento manual e as concessões ativas anteriores, excluindo as escritas anteriores do próprio construtor. Uma perícia escolhida que essas fontes já treinam abre um espaço separado de substituição entre as perícias sem treinamento do mesmo tipo, mantendo a resposta original. As substituições respeitam as exclusões e o nível da escolha. A chave salva delas é a chave do espaço original mais `/replacement`. As graduações fora da carreira de um Human podem excluir uma escolha de carreira anterior e usar `only: "untrained"`; mudar de carreira mantém as respostas posteriores inválidas.

Condições e novas contagens de espaços só podem ler valores mudados por etapas anteriores, o que impede concessões que se habilitam sozinhas ou cíclicas. Uma contagem de espaços não pode ler valores da ficha quando um arquivo de catálogo externo posterior poderia mudá-los; mova a etapa de origem dela para antes ou mantenha esse catálogo incluído no arquivo. Uma condição pode usar um `enumTable` derivado existente para tornar uma etapa de sub-raça obrigatória para uma única ancestralidade. `requiredWhen` só afeta os selos e pode ler qualquer valor não vivo válido. Novas escolhas restritas continuam pendentes quando falta conteúdo elegível, com uma explicação "not configured". Elas nunca reduzem em silêncio a contagem exigida ao conteúdo disponível. As edições manuais da ficha e os personagens descritos mantêm as regras de propriedade existentes do construtor.

Um personagem feito sem o construtor (uma ficha que não está em branco e ainda não tem escolhas do construtor) abre **descrito**: as escolhas registram o que o personagem já é (os aumentos da raça dele são considerados já incluídos nos valores) e não mudam nada na ficha, até o jogador escolher **Done: let picks change the sheet** (concluído: deixar as escolhas mudarem a ficha). A partir daí, mudar uma escolha retira o que a descrita deu.

Sem `tier`, o treinamento vai para o primeiro nível acima de sem treinamento que a ficha oferece; uma ficha que oferece um meio nível (como as perícias de 5e) define `"tier": "proficient"`.

<a id="items-what-a-party-carries"></a>

## Itens: o que um grupo carrega

Armaduras, armas, poções, equipamentos, munição e dinheiro são itens. Um bloco opcional `items` declara o vocabulário em que todo item do seu conjunto é escrito, e um catálogo com `holds: "items"` lista os próprios itens. Ambos exigem Capability API 1.49; `rarityCaps` e `propose` do bloco, que regem os itens que o Game Master inventa, exigem 1.51; um valor que lê os itens de um personagem (`itemStat`) exige 1.52; o que um item faz com os testes enquanto vestido ou carregado, com os tetos de `bonus` do bloco, exige 1.53; o que um item exige de quem o veste e os atributos que ele altera exigem 1.54; o `attack` de uma arma exige 1.55; o que um item faz numa luta exige 1.56; o que uma arma dispara e mantém carregado exige 1.57; os modos de uma arma, o ataque com a mão inábil, o piso e as condições num acerto exigem 1.58; o que usar um item faz numa luta, com as cargas que ele contém, exige 1.59; um uso que restaura uma reserva exige 1.60; cargas recuperadas num descanso ou um item que quebra ao se esvaziar exigem 1.61; um uso que pede um teste antes (`gate`) exige 1.62; tabelas de loot e o loot de uma criatura exigem 1.63; uma linha de loot que deixa cair moedas ou uma camada que retira moedas exige 1.64; um mercado, o lugar `sold` de um item e um `service` exigem 1.65; um dia de mercado (um caixa, `buyBack`, o `stock` de um vendedor, uma contagem `limited` ou um `sold` que não nomeia lugar) exige 1.69; um efeito adicional que dispara com armas empunhadas (`weapons`) exige 1.70; o equipamento inicial (`startingGear`) exige 1.78; e um item arriscado, uma falsificação ou um vendedor desonesto exige 1.79.

### O bloco de itens

O bloco fica em `items`, no nível superior do arquivo. Este é o de Ember Roads, um pouco resumido:

```json
"items": {
  "categories": [
    { "id": "weapon", "label": "Weapon" },
    { "id": "armor", "label": "Armor" },
    { "id": "ammunition", "label": "Ammunition" }
  ],
  "rarities": [
    { "id": "common", "label": "Common" },
    { "id": "storied", "label": "Storied" }
  ],
  "tags": [
    { "id": "thrown", "label": "Thrown" },
    { "id": "ranged", "label": "Ranged" },
    { "id": "two_handed", "label": "Two-handed" },
    { "id": "arrow", "label": "Arrow" }
  ],
  "stats": [
    { "id": "bulk", "label": "Bulk", "type": "number", "min": 0, "max": 10, "default": 0 },
    { "id": "guard", "label": "Guard", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "damage", "label": "Damage", "type": "dice", "example": "1d6" },
    { "id": "swing", "label": "Rolls with", "type": "enum", "values": ["brawn", "wits", "heart"], "default": "brawn" },
    { "id": "reach", "label": "Reach", "type": "enum", "values": ["close", "near", "far"], "default": "close" }
  ],
  "slots": [
    { "id": "body", "label": "Body", "count": 1 },
    { "id": "hands", "label": "Hands", "count": 2 }
  ],
  "carry": { "stat": "bulk", "encumberedAbove": { "derived": "load" }, "limit": { "const": 12 } },
  "rarityCaps": [
    { "rarity": "common", "stats": { "guard": 1 }, "bonus": 1 },
    { "rarity": "storied", "stats": { "guard": 3 }, "bonus": 2 }
  ],
  "currencies": [
    {
      "id": "coin",
      "label": "Coin",
      "perWeight": 100,
      "units": [
        { "id": "bit", "label": "bits", "value": 1 },
        { "id": "mark", "label": "marks", "value": 10 },
        { "id": "sovereign", "label": "sovereigns", "value": 100 }
      ]
    },
    {
      "id": "salt",
      "label": "Salt",
      "perWeight": 10,
      "units": [
        { "id": "pinch", "label": "pinches", "value": 1 },
        { "id": "cake", "label": "cakes", "value": 20 }
      ]
    }
  ]
}
```

- `categories`: de uma a 24. Todo item tem exatamente uma, como armadura, arma ou poção.
- `rarities`: opcional, até 12. Liste-as da mais comum à mais rara.
- `tags`: opcional, até 48. Propriedades que um item pode ter, como arremessável ou prateado.
- `stats`: opcional, até 24. Os números e palavras que um item carrega, declarados exatamente como uma coluna de lista: `number`, `text`, `boolean`, `enum` ou `dice`, com faixa, valores e padrão quando o tipo os tem. `promptVisible` (padrão `true`) diz se o Game Master vê a estatística ao lado do item. Defina como `false` para algo que só o jogador deve ver, como o lugar onde um item está escondido.
- `slots`: opcional, até 12. Onde um item é vestido ou empunhado, e quantos desse espaço um personagem tem, de 1 a 20.
- `binding`: opcional. Sintonia, investidura ou qualquer outra coisa que limite quantos itens um personagem pode ter vinculados ao mesmo tempo. `label` é como isso se chama, e `max` é um valor lido da ficha do personagem, como `{ "abilityScore": "nerve" }` ou um valor derivado. Não pode ler o estado vivo, porque a quantidade de itens que um personagem pode vincular não muda a cada golpe.
- `carry`: opcional. `stat` nomeia a estatística numérica que é o peso de um item, cujo `min` é 0 ou mais. `encumberedAbove` é quanto um personagem carrega antes de ficar sobrecarregado, e `limit` (opcional), o máximo que ele consegue carregar. Ambos são lidos da ficha como `binding.max`. Sem `carry`, o peso não significa nada e ninguém fica sobrecarregado.
- `currencies`: opcional, até seis famílias de uma a dez moedas cada.
  - As moedas de uma família se convertem umas nas outras pelo `value`, que é contado na menor moeda da família. Assim, a menor moeda vale 1, e duas moedas da mesma família nunca valem o mesmo.
  - Duas famílias nunca se convertem uma na outra. A moeda de uma segunda nação, ou os favores de um cenário, formam uma família própria.
  - O ID de uma moeda é único entre todas as famílias, porque o custo de um item nomeia só a moeda.
  - O `label` de uma moeda é o nome dela para qualquer quantidade (`pennies`); `one` (Capability API 1.89) é o nome dela para exatamente uma (`penny`), dito onde quer que um preço, uma bolsa ou um mercado nomeie uma única moeda. Sem ele, o `label` também vale para uma.
  - `perWeight` (opcional, e só ao lado de `carry`) é quantas moedas da família pesam uma unidade da estatística de peso.
  - As moedas são o dinheiro do grupo, levadas nas bolsas como qualquer item (veja Dinheiro, abaixo).
- `rarityCaps`: opcional, no máximo um por raridade. O máximo que um item inventado pelo Game Master pode conceder naquela raridade: o maior valor de cada estatística numérica nomeada em `stats`, dentro da própria faixa da estatística, e um número inteiro para uma estatística que só aceita inteiros, e `bonus` (Capability API 1.53), o maior bônus fixo que um dos seus modificadores de item vestido ou carregado pode adicionar. Numa raridade com `bonus`, um bônus em dados é omitido, já que dados não podem ser limitados a um número; uma penalidade nunca é limitada. Um item inventado fica sujeito a isso; os itens que seus catálogos listam são seus e nunca são limitados.
- `propose`: `true` por padrão. `false` proíbe o Game Master de inventar itens do seu conjunto.
- `native`: `true` por padrão. `false` desativa os itens sem tipo próprios do Game Mode nas partidas do seu conjunto (veja **O que lê os itens**). O Game Master ainda pode inventar itens, escritos no vocabulário do seu conjunto.
- `freeform`: o que vira um item que o jogador digita. `"plain"` (o padrão) o mantém como um item sem regras, como hoje. `"refuse"` permite só itens do seu conjunto.
- `lootTables` (Capability API 1.63): opcional, até 24. O que as criaturas de uma luta vencida e o `[loot:]` do Game Master deixam cair (veja Loot, abaixo).

### Um item

Um catálogo de itens não declara `feeds`:

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

Cada entrada contém um `item` em vez de `rows` ou de uma `creature`:

```json
{
  "id": "hunting-bow",
  "label": "Hunting bow",
  "summary": "Yew, waxed string, and a grip worn smooth by someone else's hand.",
  "item": {
    "category": "weapon",
    "rarity": "common",
    "tags": ["ranged", "two_handed"],
    "stats": { "bulk": 2, "damage": "1d8", "swing": "wits", "reach": "far" },
    "slots": { "hands": 2 },
    "cost": { "amount": 3, "unit": "sovereign" }
  }
}
```

- `id`, `label`, `summary` e `filters` funcionam como em qualquer entrada. O rótulo é o nome do item.
- `category` é obrigatório. `rarity` e `tags` são opcionais, e os três nomeiam IDs do próprio bloco. Um item só pode ter raridade quando o bloco declara alguma.
- `stats`: valores para as estatísticas do bloco. Cada um é um valor que sua estatística poderia conter.
- `slots`: quantos de cada espaço o item ocupa, nunca mais do que um personagem tem.
- `stack`: o máximo que uma pilha contém, de 1 a 999.999. Sem isso, uma pilha contém tanto quanto qualquer pilha do Game Mode. Um item que tem `charges` fica sozinho na pilha.
- `cost`: um `amount` inteiro de uma moeda, nomeada pelo ID em `unit`. O seletor o mostra, e o Game Master o vê ao lado do item (veja Dinheiro, abaixo).
- `sold` (Capability API 1.65): `{ "place": "city" }`, o menor dos lugares do seu mercado que vende o item, acima de qualquer regra que diga o contrário; com 1.69, ele pode, em vez disso ou além disso, dizer quantos um lugar mantém disponíveis num dia (`"limited": 2` ou `"limited": "1d3"`) (veja Mercados, abaixo).
- `service` (Capability API 1.65): `true` para hospedagem, passagem, uma bênção: comprado como um item e nunca carregado. Comprá-lo só paga; nada mais coloca um serviço numa bolsa (adicionar um é recusado como `service`), e o seletor deixa os serviços de fora. Um serviço tem um `cost` e nada relacionado a carregar ou usar (`slots`, `stack`, `binds`, `worn`, `carried`, `requires`, `attack`, `use`, `charges`).
- `binds`: o item precisa ser vinculado antes de fazer qualquer coisa enquanto vestido. `restriction` (opcional) diz em palavras quem pode vinculá-lo, e `cursed: true` marca um item que não se solta. Só um conjunto com `binding` pode ter itens que se vinculam.
- `worn` e `carried` (opcionais, Capability API 1.53): o que o item faz com os testes e as salvaguardas de quem o porta enquanto está vestido e enquanto está só carregado, (1.54) os atributos que ele define ou aumenta e (1.56) o que ele faz numa luta. Veja [Testes fora de uma luta](#checks-outside-a-fight) e [Armaduras e efeitos de itens vestidos numa luta](#armor-and-worn-effects-in-a-fight).
- `requires` (opcional, Capability API 1.54): o que o item exige de quem o veste e o que se aplica enquanto essa pessoa não atende à exigência. Veja [Testes fora de uma luta](#checks-outside-a-fight).
- `attack` (opcional, Capability API 1.55): o que o item faz como arma numa luta, enquanto vestido, (1.57) o que ele dispara e mantém carregado e (1.58) seus outros modos, um ataque com a mão inábil, um piso para o dano e as condições que impõe num acerto. Veja [Armas numa luta](#weapons-in-a-fight), [Munição e recarga](#ammunition-and-reloading) e [Modos, uma segunda arma, um piso e condições num acerto](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit).
- `toggle` (opcional, Capability API 1.170): um botão liga/desliga que o item tem, `{ "label", "budget" }`. Uma luta o oferece como opção nesse orçamento ("Turn on Flame Tongue: Flames"), o inventário como um botão com o rótulo, e a posição em que foi deixado fica na pilha entre uma luta e outra; ele começa desligado. Um item com botão liga/desliga fica sozinho na pilha enquanto está ligado. A cláusula `plus` de uma arma com `when: "toggled"` só é causada enquanto ele está ligado. A flame tongue de 5e: `"toggle": { "label": "Flames", "budget": "bonus" }` e `"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`.
- `use` e `charges` (opcionais, Capability API 1.59): o que usar o item faz, numa luta e fora dela, as cargas que ele contém para esse uso gastar e (1.60) uma reserva que ele restaura. Veja [Usar itens numa luta](#using-items-in-a-fight) e [Usar itens fora de uma luta](#using-items-outside-a-fight).

Um item não tem `mechanics`: o que ele faz é escrito no seu bloco `item`.

### O que lê os itens

Tudo acima é verificado quando o conjunto é importado, e seus catálogos de itens são distribuídos com ele. Numa partida, o inventário do Game Mode os lê:

- **Seus itens ficam na bolsa.** Uma pilha pode ser um dos seus itens e continua sendo esse item, seja qual for o nome que o jogador lhe der. O botão **From the ruleset** (do conjunto de regras) do inventário abre um seletor com todos os itens que seus catálogos listam, com a busca e os filtros do catálogo, e uma camada que oculta uma entrada também a oculta ali.
- **Nomes encontram seus itens.** Um nome que o jogador digita, ou que o Game Master escreve em `[inventory: action="add"]`, e que seja o `label` de um dos seus itens, com qualquer combinação de maiúsculas e minúsculas, adiciona esse item. Quando dois itens compartilham um rótulo, o nome encontra o que seus catálogos listam primeiro.
- **`stack`** é respeitado: adicionar, definir, juntar ou dar além dele enche a pilha e começa uma nova.
- **`freeform: "refuse"`** deixa ao jogador só os seus itens: o seletor e os nomes que são seus itens.
- **`native: false`** deixa ao Game Master só os seus itens e os que ele inventa: um nome que não é nenhum dos dois é recusado (`not-ruleset-item`), enquanto mais unidades de algo que já está com o grupo ainda podem ser adicionadas, e as instruções dele dizem isso. Uma luta não pergunta mais a um modelo o que os itens do inventário fazem, então só os seus itens lutam: numa luta do conjunto, suas armas empunhadas e os usos dos seus itens (veja Armas numa luta, abaixo), e numa batalha Classic ou Tactical, seus itens com um `use` (veja Itens nas batalhas Classic e Tactical, abaixo). O que o jogador digita continua seguindo `freeform`, e o que o grupo carregava volta numa nova sessão de qualquer forma.
- **O que um item é** aparece na pilha selecionada: sua categoria, raridade e tags pelos rótulos, as estatísticas que concede, seu resumo e quantos uma pilha comporta. O seletor também mostra seu `cost`. O Game Master vê cada um dos seus itens que estão no inventário com categoria, raridade, tags e as estatísticas que você deixou `promptVisible`, como `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`.

- **`slots`**: um item que ocupa espaços pode ser equipado por quem o carrega, enquanto tiver esses espaços livres, e um item de uma pilha maior é separado numa pilha própria para ser vestido. O inventário mostra cada espaço em uso por personagem.
- **`binding`**: um item com `binds` pode ser vinculado, até `binding.max` lido da própria ficha de quem o porta (um personagem sem ficha lê uma ficha em branco). Um item `cursed`, depois de vinculado, continua vinculado: o jogador não pode desvinculá-lo, tirá-lo, dá-lo nem removê-lo, e só o Game Master pode acabar com a maldição.
- **`carry`**: um item pesa seu valor de `carry.stat` (um item sem ele não pesa nada), e a carga de um personagem é o que sua bolsa pesa, comparada a `encumberedAbove` e `limit` lidos da própria ficha. Um item adicionado à visão compartilhada do inventário, pelo jogador ou pelo Game Master sem `who=`, vai para quem puder carregá-lo sem ficar sobrecarregado (primeiro o jogador, depois o grupo em ordem), dividido pelo espaço que resta a cada um quando ninguém consegue levar tudo. Nada passa do `limit` de ninguém: o que ninguém consegue carregar fica para trás, e o Game Master é avisado. Dê `"integer": false` a uma estatística de peso para pesos como um quarto de libra.
- **O Game Master inventa itens no seu vocabulário.** A menos que você defina `propose: false`, o `[inventory: action="add"]` dele pode descrever um item novo: `like=` um dos seus itens como ponto de partida e então qualquer um entre `category=`, `rarity=`, `tags=`, `stats=` (pares `id=value`), `slots=` (`id=count`), `binds=` (`yes`, `cursed` ou `no`), `worn=` e `carried=` (mudanças separadas por `;`, cada uma `+N`, `-N`, `advantage`, `disadvantage` ou `fails` para salvaguardas, em perícias ou salvaguardas pelo nome, ou em `checks` ou `saves` para todas elas, `+N` ou `-N` no nome de um atributo para aumentá-lo ou diminuí-lo e, onde há lutas, `+N`, `-N`, vantagem ou desvantagem em ataques e `+N` ou `-N` na defesa ou na sua palavra para ela: `worn="+1 Sneak; disadvantage on Sway checks"`, `carried="+1 Brawn"`, `worn="+1 Guard"` ou `none`) e `summary=`, cada parte pelo ID ou rótulo. Uma estatística de item que sua defesa já conta (o Guard de Ember Roads soma o `guard` do que está vestido) é a forma como uma armadura a aumenta; por isso, uma mudança vestida na defesa ao lado dessa estatística é omitida, e a resposta diz isso: um modelo pequeno escreve `guard=1` e `+1 Guard` para um único +1. Ele também lê o que um modelo pequeno costuma escrever no lugar: um número depois do nome (`Brawn +1`), "bonus" depois de ataques ou defesa (`+1 attack roll bonus`), `none` para uma lista vazia de tags, estatísticas ou espaços, e `worn=`, `carried=` ou `summary=` dentro de `stats=` quando você não tem estatística com esse nome. O Engine mantém só o que seu bloco tem: uma categoria, tag, estatística, espaço, perícia ou salvaguarda desconhecida é omitida, uma raridade que você não tem vira a mais baixa, um número é limitado à faixa da sua estatística e depois a `rarityCaps` para sua raridade, um bônus vestido ou carregado ao `bonus` da sua raridade (inclusive a parte herdada de `like`), e um nome que é um dos seus itens é simplesmente esse item. A resposta informa ao Game Master o que foi alterado (nunca sobre uma estatística que você não mostra a ele), e os detalhes do item mostram cada alteração ao jogador. A partida guarda o item, então o mesmo nome é esse item pelo resto da partida, e uma nova sessão o mantém enquanto alguém ainda o tiver.
- O Game Master pode usar `equip` e `unequip` nos seus itens com o comando de inventário quando você tem `slots`, e `bind` e `unbind` quando tem `binding`: ele só aprende as ações que seu conjunto tem. Ele vê a carga de cada personagem, os itens vinculados e os espaços, e o que está vestido ou vinculado.

- **O que um item faz enquanto vestido ou carregado** aparece na pilha selecionada e no seletor ("While worn: -1 on checks (Sneak)"), e o Game Master o vê ao lado do item (`worn: -1 on checks (Sneak)`). Os testes fora de uma luta o aplicam (veja Testes fora de uma luta, abaixo).
- **O que uma arma faz** aparece da mesma forma ("Attack (Action): Brawn to hit, 1d6 + Brawn cut damage"), e uma luta a oferece enquanto ela está empunhada (veja Armas numa luta, abaixo).
- **O que usar um item faz** aparece da mesma forma ("Use (Action): heals 1d4 + 1, range 0 paces, used up"), com as cargas que lhe restam. Uma luta oferece o uso, assim como o botão **Use** (usar) do inventário e o `[inventory: action="use"]` do Game Master (veja Usar itens numa luta e Usar itens fora de uma luta, abaixo).

Numa batalha Classic ou Tactical, cada um dos seus itens com um `use` faz ali o que diz, e um item sem ele não é oferecido (veja Itens nas batalhas Classic e Tactical, abaixo). Seja o que for que `native` diga, a ficha pode ler seus itens (abaixo), uma arma empunhada é um ataque numa luta do conjunto, disparando o que tira da bolsa, o que um item faz enquanto vestido ou carregado conta nessa luta (veja Armaduras e efeitos de itens vestidos numa luta, abaixo), um item com um `use` é usado pelas próprias regras, numa luta e fora dela (veja Usar itens numa luta e Usar itens fora de uma luta, abaixo), e suas `currencies` são o dinheiro do grupo (veja Dinheiro, abaixo).

<a id="items-on-the-sheet"></a>

### Itens na ficha

Uma referência de valor pode ler os itens que um personagem tem, com `itemStat` (Capability API 1.52). Ember Roads soma ao Guard de um viajante o guard da armadura que ele veste, que é o que um golpe precisa superar:

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from`: `"worn"` são os itens no personagem: um item que ocupa espaços enquanto está equipado, um que tem `binds` enquanto está vinculado e um que faz as duas coisas enquanto as duas valem. Um item que não faz nenhuma das duas nunca está vestido. `"carried"` é o restante do que ele leva, e `"all"` são os dois.
- `pick`: `"sum"` soma o valor de cada item vezes a quantidade, `"max"` e `"min"` leem o maior ou o menor valor individual, e `"count"` conta os itens, pela quantidade.
- `stat` nomeia uma das suas estatísticas de item. `sum`, `max` e `min` exigem uma estatística `number`. `count` pode omiti-la para contar todos os itens, ou nomear qualquer estatística para contar só os itens que a concedem.
- `slot`, `category` e `tag` (cada um opcional) mantêm só os itens que ocupam esse espaço, são dessa categoria ou têm essa tag.
- `default` (opcional, 0 quando omitido) é o que ele lê quando nenhum item é escolhido ou nenhum deles concede a estatística.

Os itens mudam durante a partida, então `itemStat` segue a mesma regra de uma leitura viva: o `max` de uma reserva ou de uma trilha, o bônus de proficiência, `binding.max`, os números de `carry` e a coluna escalada ou a escala de um catálogo não podem lê-lo, nem por meio de um valor derivado. Em qualquer outro lugar onde um número é lido, ele pode: um valor derivado, o `adjust` de um teste, o `cap` de uma perícia, a defesa, a absorção ou a iniciativa de uma luta.

Os itens de um personagem são os da própria bolsa. O card do jogador (o nomeado como quem o chat interpreta ou, se não houver, o primeiro) lê a bolsa do jogador, e cada outro card lê a sua. Só os itens do seu conjunto contam, já que um item comum não tem estatísticas para ler. A ficha na tela, um teste, o bloco de ficha do GM e uma luta, quando começa, leem o que cada personagem tem naquele momento. Fora de uma partida, no editor de fichas ou na revisão de uma importação, ninguém tem nada e `itemStat` lê seu `default`.

<a id="checks-outside-a-fight"></a>

### Testes fora de uma luta

Um teste ou salvaguarda que o Game Master pede fora de uma luta lê mais que a ficha: as condições ativas do próprio personagem, os níveis que ele atingiu, o que seus itens fazem enquanto vestidos ou carregados e o que a exigência de um item vestido custa enquanto ele não a atende. É o mesmo vocabulário que as condições de uma luta usam (Capability API 1.53 para as chaves de item e a restrição por perícia ou salvaguarda).

Um item diz o que faz com `worn`, que vale enquanto ele está vestido (e vinculado, quando se vincula), e `carried`, que vale enquanto ele está só carregado. O casaco de couro de Ember Roads range quando você se esgueira, e uma pedra-guia faz o povo das caravanas confiar em você:

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

Cada um aceita as partes de uma condição que um teste lê:

- `effects`: `own-checks-advantage`, `own-checks-disadvantage`, `own-saves-advantage` e `own-saves-disadvantage`.
- `modifiers`: mudanças (`to`) em testes ou salvaguardas, com `flat`, `dice` (e `minus`), `mode` e suas próprias `skills` ou `saves`, exatamente como as de uma condição.
- `failsSaves`: salvaguardas que quem o porta falha sem rolar.
- `skills` e `saves`: a quais perícias ou salvaguardas se referem os efeitos e os modificadores que não nomeiam as suas próprias.
- `abilities` (Capability API 1.54): atributos que ele altera, por ID, cada um `{ "set": N }` (pelo menos N: uma pontuação maior permanece) ou `{ "add": N }` (um número negativo o diminui). Eles se aplicam antes de a ficha ser calculada, então tudo que lê o atributo lê o valor alterado: a ficha na tela, valores derivados, testes, o bloco de ficha do GM e uma luta, quando começa. As somas vêm primeiro, depois o maior `set`, e o `min` e o `max` do próprio atributo continuam valendo. O máximo de uma reserva ou de uma trilha e o bônus de proficiência são calculados só a partir da ficha, então um item não os altera.

As manoplas de couro de boi de Ember Roads dão a uma pegada fraca a força de um tropeiro:

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

O que um item faz numa luta (defesa, ataques, velocidade, os outros efeitos da luta e o dano e as condições que ele evita) está em [Armaduras e efeitos de itens vestidos numa luta](#armor-and-worn-effects-in-a-fight); um teste fora de uma luta lê só as partes acima. Um item se aplica uma vez, quantas pilhas dele alguém tenha.

Um item também pode exigir algo de quem o veste, com `requires`: um valor da ficha dessa pessoa (`value`, qualquer referência de valor, lida como tudo o mais durante a partida), o mínimo que ele pode ser (`atLeast`) e o que se aplica enquanto ela não atende à exigência (`otherwise`, no mesmo vocabulário, exceto que não pode alterar um atributo, já que o que é exigido pode lê-lo). Até quatro. A pá de coveiro de Gravewatch é trabalho pesado para um guardião fraco:

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

Uma exigência lê o atributo como os itens de quem veste o deixam, então manoplas que definem Sinew como 3 atendem à exigência da pá.

Num teste:

- Todo modificador que se refere a ele soma seu número, e seus dados são rolados: um número fixo num teste somado, dados numa reserva. Um teste de atributo, e um teste que o conjunto não sabe nomear, leem só o que não está restrito a perícias específicas, e uma salvaguarda lê só o que se refere a salvaguardas.
- Vantagem e desvantagem de todas as fontes, inclusive o `mode=` do Game Master, se anulam: havendo qualquer uma de cada, o teste é rolado uma vez. Só um conjunto que rola duas vezes (`resolution.advantage`) pende para um lado.
- Uma salvaguarda que uma condição ou um item faz falhar falha sem rolagem, e nada é gasto nela.
- O registro diz o que o alterou: `effects="-1"` para o número, `from="Leather coat"` para o que o alterou e `automatic="true"` para uma salvaguarda falhada sem rolagem. O cartão de dados mostra o mesmo, e o Game Master o lê no turno seguinte. Ele é informado de que o Engine aplica isso, para não somar de novo.

Gravewatch mostra o mesmo numa reserva: o sino da aurora vinculado adiciona um dado a Ward, e Rattled tira um de Soothe e de Barter.

### Defesas por tipo vindas de condições, níveis, itens e linhas da ficha (Capability API 1.132)

`combat.conditions[]` e `combat.levels[]` podem conceder `resist`, `vulnerable`, `immune` (de 1 a 30 entradas cada) e `conditionImmunities` (de 1 a 40 IDs de condição). Eles se aplicam enquanto a condição vale ou o limiar do nível é atingido. Uma imunidade a condição recém-adquirida encerra essa condição, se já estiver ativa, e impede que ela seja aplicada de novo. A imunidade prevalece sobre a resistência; resistência e vulnerabilidade se anulam. Várias resistências nunca reduzem o dano à metade duas vezes.

`resist` e `immune` usam a forma das criaturas: uma palavra de dano ou `{ "type": "bludgeoning", "except": ["magical"] }`. Qualquer tag nomeada no golpe ignora essa entrada. `vulnerable` continua sendo palavras de dano simples. A mesma forma de exceção funciona nos efeitos `worn` e `carried` dos itens. Declare as tags de exceção em `items.tags` e coloque-as nas qualidades da arma ou da magia. Por exemplo, Stoneskin é um mapeamento de condição:

```json
{
  "condition": "stoneskin",
  "resist": [
    { "type": "bludgeoning", "except": ["magical"] },
    { "type": "piercing", "except": ["magical"] },
    { "type": "slashing", "except": ["magical"] }
  ]
}
```

Armor of invulnerability usa a mesma matriz `resist` dentro do seu efeito `worn`. Protection from Energy pode conceder `resist: ["fire"]`; um traço como Brave pode conceder `conditionImmunities: ["frightened"]`. Um nível pode conceder `resist: ["poison"]` no seu limiar. Palavras de dano fixas desconhecidas são informadas quando `combat.damageTypes` declara o vocabulário, como nas criaturas; sem essa declaração, as palavras de dano são texto livre.

Para traços de ancestralidade ou de catálogo, `combat.sheetHides` comporta até oito fontes (uma matriz vazia é permitida). Cada uma nomeia uma lista da ficha, uma coluna de texto ou enum dessa lista e um dos quatro tipos. Para um anão cuja linha de traços contém `"poison"` numa coluna `resistance`:

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

Cada linha contribui com palavras separadas por vírgula, sem espaços nas pontas e comparadas sem distinguir maiúsculas; palavras vazias são puladas. Acrescentar uma linha com `"fire"` acrescenta resistência a fogo; excluí-la remove essa fonte. As palavras de resistência e de imunidade podem incluir `except`, como em `"bludgeoning except magical silvered"`. Vulnerabilidades e imunidades a condição são palavras simples. Palavras de dano declaradas e desconhecidas no texto da ficha são ignoradas, assim como IDs de condição desconhecidos; uma coluna enum para imunidades a condição precisa declarar só IDs de condição na importação. Os resumos da ficha, da batalha e do Game Master incluem essas defesas e suas exceções.

<a id="weapons-in-a-fight"></a>

### Armas numa luta

Um item pode ser uma arma (Capability API 1.55). Seu `attack` tem a forma das [linhas de ataque](#combat-a-fight-your-own-rules-resolve) de um bloco de combate, com valores no lugar de colunas, e uma [luta do conjunto](#combat-a-fight-your-own-rules-resolve) o oferece como ataque enquanto o item está vestido: empunhado nas mãos que ocupa e vinculado, quando se vincula. Um item guardado ou só carregado não oferece nada, e as linhas de ataque e as ações próprias de uma criatura funcionam exatamente como antes. O machado de mão de Ember Roads:

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget`: o orçamento que ele gasta, um de `combat.economy.budgets`.
- `toHit`: o que ele soma para acertar. `abilities` são um ou mais IDs de atributo, e conta o melhor deles (uma arma de acuidade lista dois). `skill` soma o que um teste daquela perícia soma, com o atributo do ataque no lugar do da perícia, como faz uma linha de ataque. `proficiency` é um valor da ficha de quem empunha: quando lê acima de 0, o bônus de proficiência do conjunto é somado (`{ "const": 1 }` para sempre). `bonus` é um número. `sheetBonus` é um número lido da ficha de quem empunha e somado como está, para o que quem empunha traz a toda arma de um tipo, e não para o que a arma é: o estilo de luta Archery de 5e dá `{ "derived": "archery" }` a cada arma à distância, um valor derivado que é 2 para um arqueiro e 0 para qualquer outra pessoa (Capability API 1.95; os dados do item o nomeiam pelo nome que tem na ficha). `target` é o alvo por dado próprio de uma luta de reserva para o ataque desta arma (a pá de Gravewatch conta todo dado a partir de 6 em vez do 7 da reserva), e só um conjunto `dice-pool` cujo `target` pode se mover pode definir um; numa luta somada, o `bonus` diz o mesmo.
- `damage`: os `dice` que ela causa, o melhor dos seus `abilities` de dano somado, um `bonus` e um `type`. Uma luta somada exige `dice`; numa luta de reserva, um acerto causa seus sucessos e `dice` adiciona mais essa quantidade de dados do próprio tipo de dado da reserva. `sheetBonus` (Capability API 1.97) é um número da ficha de quem empunha somado ao dano, como o de `toHit`, e com `"oneHanded": true` só conta enquanto a arma é empunhada numa mão: não uma arma `versatile` empunhada com as duas mãos, nem uma que ocupa dois de um espaço. O Dueling de 5e dá `{ "derived": "dueling" }`, 2 para um duelista que empunha uma única arma. `rerollUpTo` (Capability API 1.98) é um valor da ficha de quem empunha: os dados de dano da própria arma iguais ou inferiores a ele são rolados de novo uma vez e a nova face vale, inclusive os dados extras de um crítico, só enquanto a arma é empunhada com as duas mãos (uma arma `versatile` com as mãos livres, ou uma que ocupa dois de um espaço) e só numa luta somada. O Great Weapon Fighting de 5e dá `{ "derived": "great_weapon_fighting" }`, 2 com o estilo.
- `reach` e `range` (`normal`, e `long` para o que ela ainda alcança além disso) ficam na sua unidade de `combat.distance` e precisam dela. Uma arma com os dois é de arremesso, como uma linha de ataque: um golpe de perto, um arremesso além. Sem nenhum dos dois, ela alcança uma célula.
- `versatile`: os `dice` que ela causa no lugar enquanto cada espaço que ocupa tiver lugar para outro tanto entre o que quem a empunha veste: uma lança numa mão com a outra livre.
- `strikes`: quantos ataques um gasto compra, lido da ficha de quem empunha, como o `strikes` de uma linha de ataque. Uma arma sem isso dá um ataque por gasto, quantos ataques seu portador tenha.

Qualquer um desses números ou palavras pode ler a própria estatística do item: `{ "stat": "damage" }` é o `damage` do item, e uma estatística à qual o item não dá valor é como se o valor não estivesse escrito. `abilities` e `skill` leem uma estatística enum cujas palavras são IDs de atributo ou de perícia, e `type`, uma estatística de texto ou enum. Assim, um item que o Game Master inventa `like=` uma arma também é uma arma, que luta com as próprias estatísticas, limitada por `rarityCaps` como qualquer estatística (um valor que você escreve diretamente é copiado como está). Um item inventado sem espaço e sem vínculo nunca é vestido, então é criado sem o ataque. Um modelo pequeno tende a descrever uma arma e omitir `like=`; por isso, um item inventado numa categoria das suas armas, sem nada de onde partir, luta como a arma dessa categoria com o nome mais parecido (uma palavra contida no outro nome, em qualquer direção, então Crossbow se parece com Bow) ou como a primeira delas, herdando qualquer estatística que o ataque leia e que a proposta omitiu, e a resposta diz isso ("It fights as Hand axe does."). O formulário de proposta do Game Master também lhe diz que uma arma criada como outra luta como ela.

As tags de uma arma são o que seus golpes carregam. A entrada `resist` ou `immune` de uma criatura pode dizer o que a atravessa: `{ "type": "tearing", "except": ["silver"] }` é recebido por inteiro de uma arma com a tag `silver` e resistido de qualquer outra coisa. O grave wight de Gravewatch é escrito assim, e o prego de caixão de prata do conjunto o atravessa. Um dano que não vem de um item de arma nomeia o que carrega com `qualities` (Capability API 1.101), nas mesmas tags de item: nas `mechanics` de uma entrada de catálogo (uma magia) e no `damage` de uma ação de criatura (a maça de um deva). A "resistance to bludgeoning, piercing and slashing from nonmagical attacks" de 5e é `{ "type": "slashing", "except": ["magical"] }` ao lado do mesmo para os outros dois, com `magical` nas tags das suas armas mágicas e `"qualities": ["magical"]` nas suas magias e nos ataques de criatura que o SRD chama de mágicos.

Os detalhes da arma e a linha do Game Master dizem o que ela faz: `attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`, com `1d8 with a hand free` para a lança de javali de Ember Roads e `at 6` ao lado da pá de Gravewatch.

<a id="ammunition-and-reloading"></a>

#### Munição e recarga

Uma arma pode disparar algo e manter uma contagem carregada própria (Capability API 1.57). O arco de caça de Ember Roads dispara flechas, e a pistola de vigia de Gravewatch comporta uma bala, carregada a partir do chumbo e da pólvora do guardião:

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo`: o que a arma dispara, por uma das suas `tags` de item. Cada ataque consome `perAttack` (1 quando não diz nada) dos itens com essa tag que quem a empunha carrega, vestidos ou não, da primeira pilha desse tipo na bolsa e depois da seguinte. A arma só é oferecida enquanto ele carrega o suficiente, e o menu da luta diz quantos restam. Depois de uma luta que o grupo vence, `recover` (de 0 a 1) do que cada um disparou volta para a pilha de onde saiu: a fração é somada na luta inteira e arredondada para baixo uma vez por pilha, então metade de cinco flechas disparadas de uma aljava dá duas. Uma luta perdida ou abandonada em fuga não devolve nada.
- `clip`: uma contagem carregada que a arma guarda em si. `max` é quanto ela comporta, escrito diretamente ou lido de uma estatística numérica do item, e `reload` é o orçamento que uma recarga gasta. Um ataque gasta o que está carregado em vez de tirar da bolsa, e a arma só é oferecida enquanto tiver carregado o suficiente para um ataque. Uma opção **Reload** (recarregar) no menu da luta gasta `reload` e a enche: a partir da bolsa quando ela tem `ammo` (tanto quanto a bolsa ainda tiver, quando for menos) e por completo quando não tem. A contagem fica na pilha da arma no inventário, então uma pistola esvaziada numa luta continua vazia na próxima. Uma arma que ninguém disparou ainda está carregada, assim como uma que o jogador junta numa pilha de várias iguais, já que uma contagem carregada pertence a uma única arma. A munição carregada não é recolhida depois de uma luta, então `recover` vale para armas que não têm essa contagem carregada.

O que uma luta dispara, carrega e recolhe é gravado no inventário a cada passo, como a saúde do grupo, e o diário diz o que foi usado. Um passo cuja pilha sumiu, ou contém menos do que a luta contava, é recusado, assim como um item gasto que a luta não encontra. O registro da luta diz cada disparo, recarga e recolhimento ("Hunting bow: 2 left to shoot.", "Ada loads 1 into Watch pistol: 1 of 1 loaded."), e os detalhes do item e a linha do Game Master dizem o que a arma dispara e comporta: `ammunition Arrow (1 an attack, 50% picked up after a won fight)` e `holds 1, reload (Act)`.

<a id="modes-a-second-weapon-a-floor-and-conditions-on-a-hit"></a>

#### Modos, uma segunda arma, um piso e condições num acerto

Uma arma pode ter outras formas de fazer seu ataque, uma parceira na mão inábil, um dano mínimo e condições que impõe ao que acerta (Capability API 1.58). O arco de caça de Ember Roads pode disparar uma saraivada, e o prego de caixão de prata de Gravewatch pode ser empunhado em cada mão e marca o que fere fundo:

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes`: até seis outras formas de fazer o ataque, cada uma com um `id`, um `label` e o que ela muda. `ammo` é quantos disparos um ataque nesse modo consome, então a arma tem `ammo` ou um `clip` de onde disparar. `toHit` é o que ele soma para acertar: dados numa luta de reserva e um número numa luta somada. `target` move nessa quantidade o alvo por dado de uma luta de reserva (a partir do da própria arma, senão do da reserva; `+1` é mais difícil), quando o alvo da reserva pode se mover. `targets` é em quantos alvos ele pode ser mirado, cada um com sua própria rolagem de ataque. O menu da luta pergunta de que forma assim que o ataque é escolhido (depois do seu estilo de iniciativa, quando há estilos), cada uma com o que se espera que faça, e oferece só os modos para os quais quem empunha tem disparos. Um membro do grupo jogado pelo Engine avalia cada modo mirado num único alvo e deixa a um jogador os modos para vários alvos. Numa janela, um ataque é feito como está.
- `offHand`: uma arma para a mão inábil. O bloco de combate nomeia o orçamento que um segundo ataque gasta e se o dano dele mantém um atributo positivo:

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  Depois que quem a empunha atacou neste turno com uma arma marcada `offHand`, cada outra arma desse tipo que ele veste oferece um segundo ataque com aquele orçamento, chamado "Silver coffin nail, off hand" no menu. `ability` é `full` (o padrão) ou `penalty-only`, que soma o atributo de dano só quando ele tira algo, como faz o combate com duas armas de 5e. Um ataque com a mão inábil é um único golpe, quantos ataques o ataque principal compre, e nunca um golpe contra quem se afasta. Uma arma marcada `offHand` exige o `offHand` do bloco de combate. `fullWhen` (Capability API 1.97) é um valor da ficha de quem luta: acima de 0, a mão inábil dessa pessoa mantém o atributo inteiro, diga o que disser `ability`, como faz o estilo Two-Weapon Fighting de 5e.

- `floor`: o mínimo que um acerto causa, escrito diretamente ou lido de uma estatística numérica do item. O dano de uma luta de reserva depois da absorção, ou o dano de uma luta somada, é elevado a ele antes que uma resistência o reduza à metade, e o registro diz isso. Um golpe que gasta rola o número de quem o faz e nunca é elevado.
- `onHit`: até quatro das suas condições que o alvo recebe quando o dano que o golpe causou chegou a `atLeast`, por `rounds` dos turnos dele ou, sem isso, até que algo as remova. O dano é o que o atingiu depois da absorção e das resistências; um golpe que toma retira iniciativa em vez de causar dano, então não impõe nenhuma condição. Uma entrada também pode ter `save: { "save": <save id>, "difficulty": n }`, que o alvo rola quando a condição seria imposta, com um sucesso evitando-a, e `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`, que a faz durar até que quem a porta passe nessa salvaguarda no início ou no fim de cada turno dele ou ao receber dano acima de zero (ela então não tem `rounds`). As duas contam como salvaguardas contra essa condição, e contra magia quando a arma é mágica (Capability API 1.169). A sword of wounding de 5e: `{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`.
- `plus`: até três quantidades a mais em cada acerto, cada uma `{ "dice", "flat", "type", "save", "targetIs", "when" }` e rolada, tipada e resistida por conta própria (Capability API 1.169). `save` nomeia a própria `difficulty` e o próprio `onSuccess` (`half` ou `none`). `targetIs` só a causa a um alvo desses tipos ou tags de criatura (veja Tipos de criatura e testes de alvo). `when: "critical"` só a causa num acerto crítico; os dados de qualquer cláusula são dobrados num acerto crítico, como os da arma. Uma javelin of lightning é `{ "dice": "4d6", "type": "lightning" }`; uma dragon slayer, `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`; uma sword of sharpness, `{ "flat": 14, "type": "slashing", "when": "critical" }`. Uma previsão só conta uma cláusula contra um alvo que ela alcança, e nunca uma só de crítico. `when: "toggled"` só a causa enquanto o botão liga/desliga do item está ligado (Capability API 1.170; veja `toggle` abaixo).

Os detalhes da arma e a linha do Game Master dizem tudo isso: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` e `Marked for 2 rounds when a hit deals 2 or more`.

<a id="armor-and-worn-effects-in-a-fight"></a>

### Armaduras e efeitos de itens vestidos numa luta

O que um item faz enquanto vestido ou carregado também pode mudar uma luta (Capability API 1.56), para quem o porta, junto com suas condições e níveis. Cada um aceita as partes de uma condição que uma luta lê:

- `effects`: qualquer um dos de uma condição, exceto os cinco que um nível não pode ter (`half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side`, `cannot-approach-source`), já que ninguém colocou um item em quem o porta e ele nunca termina sozinho: `own-attacks-advantage`, `attacks-against-disadvantage`, `resist-all`, `speed-zero` e os demais.
- `modifiers`: mudanças (`to`) em defesa, ataques e velocidade, além de testes e salvaguardas, exatamente como as de uma condição; numa luta `dice-pool`, uma mudança em ataques é um número fixo de dados, como numa condição.
- `resist`, `vulnerable` e `immune`: tipos de dano dos quais quem o porta recebe metade, o dobro ou nada, como os de uma criatura (e validados contra `combat.damageTypes` quando você declara algum). `conditionImmunities`: suas próprias condições que nunca são impostas a quem o porta.

O anel da viúva amaldiçoado de Gravewatch custa um dado em todo ataque, o sino da aurora vinculado do mesmo conjunto torna quem o porta imune a Rattled, e uma pedra-guia de Ember Roads, carregada, afasta o calor:

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

Uma luta lê cada item uma vez, com o nome da pilha ("Widow's ring" ao lado de uma rolagem no registro, e numa defesa), como faz um teste; o `otherwise` de uma exigência não atendida também conta numa luta, então uma armadura pesada demais para quem a veste pode custar velocidade. Os detalhes de um item e a linha do Game Master dizem tudo isso ("While worn: -1 on attacks", "worn: +1 on checks (Ward), immune to Rattled"). Uma armadura que simplesmente soma a uma defesa ou a uma absorção é uma estatística de item lida com `itemStat` (veja Itens na ficha), como o Guard de Ember Roads lê o casaco vestido.

**Dureza.** Quando a iniciativa é um número que os ataques movem, `combat.pool.hardness` é a dureza de um combatente, lida da ficha dele quando a luta começa (a da armadura, por meio de `itemStat`), e uma criatura define a própria `hardness`. Um golpe que gasta cujos dados ficam abaixo dela acerta e não faz nada: o número de quem o fez ainda volta à base, o registro diz isso ("Ada's Grave spade lands on the warden with 5 dice, below a hardness of 6, and does nothing."), e o menu não prevê dano para ele. Só um conjunto com um estilo que gasta pode tê-la, e uma criatura escrita como ficha a obtém da ficha.

<a id="using-items-in-a-fight"></a>

### Usar itens numa luta

Um item pode ser usado numa luta (Capability API 1.59): um emplastro pressionado num corte, um tônico engolido, um sino tocado. Seu `use` diz o que usá-lo faz nas mesmas palavras que o `mechanics` de uma entrada de catálogo usa (veja [O que um combate lê de `mechanics`](#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` ou `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire` e, desde a Capability API 1.174, `concentration` e `zone`, com o `budget` que gasta, ou `free`. O emplastro de Ember Roads e o tônico de aquecimento e o sino da aurora de Gravewatch:

```json
"use": { "kind": "heal", "budget": "act", "range": 0, "targets": "ally", "amount": { "dice": "1d4", "flat": 1 }, "consumes": true }
```

```json
"use": { "kind": "heal", "budget": "quick", "targets": "self", "amount": { "flat": 1 }, "consumes": true }
```

```json
"stack": 1,
"use": {
  "kind": "debuff",
  "budget": "act",
  "targets": "enemy",
  "save": { "save": "steel", "onSuccess": "negates" },
  "saveDifficulty": 7,
  "applies": [{ "condition": "rattled", "duration": { "rounds": 2 } }],
  "charges": 1
},
"charges": { "max": 3 }
```

- Um uso fica no menu da luta em **Items** (itens), com o nome do item ("Poultice"), seja qual for o nome da pilha. Um item que ocupa espaços ou se vincula é usado enquanto está vestido (e vinculado, quando se vincula), como o sino; qualquer outro, enquanto é carregado.
- Ele gasta um orçamento, ou é `free`, e paga com ele mesmo: `cost`, `perCostStep`, `check`, `concentration`, `reaction`, `scales`, `gives`, `standard` ou `rider` são para uma entrada de catálogo que uma ficha contém, e são recusados num uso.
- `toHit`, num uso com `attackRoll`, é o que ele soma para acertar, como o `toHit` de uma arma o define (veja Armas numa luta): atributos, uma perícia, um bônus e, numa luta de reserva, um alvo por dado. Sem ele, a rolagem não soma nada.
- `saveDifficulty`: o número contra o qual é rolada uma salvaguarda que ele pede (a sua própria, uma que termina uma condição que ele aplica ou a de uma cláusula sem `difficulty`), escrito diretamente ou lido de uma estatística numérica do item. Uma entrada numa ficha lê esse número da fonte do seu catálogo; um item não tem fonte, então diz o próprio número.
- `consumes: true` tira um da pilha do item a cada uso, e o menu diz quantos restam. O último usado leva a pilha junto.
- `restore` (Capability API 1.60) devolve parte de uma reserva de cada ficha que atinge, como uma bolsa de sangue devolve sangue: `{ "pool": "resolve", "amount": { "flat": 1 } }`, com `dice` e `flat` como num `amount`. Ele nomeia uma das suas reservas vivas, nunca a reserva de saúde (a saúde volta com uma cura), e fica num uso que ajuda, um `heal` ou um `buff`. Uma criatura não tem reservas, então não recebe nada. O registro diz isso ("Ada gets back 1 Resolve, and is on 3 of 4."), e um membro do grupo jogado pelo Engine deixa em paz uma reserva cheia. O tônico de aquecimento de Gravewatch restaura um ponto de Resolve além da cura.
- `charges` gasta essa quantidade das `charges` do próprio item, cujo `max` é quantas ele comporta, de 1 a 100, escrito diretamente ou lido de uma estatística numérica do item (um item que dá a essa estatística menos de 1 é recusado, e um acima de 100 comporta 100). A contagem fica na pilha do item no inventário, então um sino tocado duas vezes numa luta tem uma carga restante na próxima, e um que ninguém tocou está cheio. Cargas pertencem a um único item, então um item que as tem tem `stack` 1. Um uso consome o item ou gasta cargas, nunca os dois, e as cargas de um item são sempre gastas pelo seu uso. Há mais duas chaves em `charges` (Capability API 1.61), como as do sino da aurora de Gravewatch:

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge`: quais dos seus `rests` trazem as cargas de volta, e quantas: `"max"` enche o item, e uma quantidade (`{ "dice": "1d6", "flat": 1 }`) devolve essa quantidade, nunca além de `max`. Um descanso traz de volta as cargas de todo item que o personagem carrega e que nomeia esse descanso, seja pelo botão Rest da ficha, seja pelo `[sheet: op="rest"]` do Game Master; a ficha e a bolsa são gravadas juntas, e uma resposta regenerada recarrega só uma vez. A ficha diz o que voltou depois do descanso ("Dawn bell 3/3 charges"), e o Game Master vê no inventário, ao lado de cada item, as cargas restantes ("2 of 3 charges left").
  - `breaksOn`: quando um uso gasta a última carga, o Engine rola um d`die` e, com resultado igual ou inferior a `atMost`, o item quebra e some da bolsa, numa luta e fora dela. O registro da luta diz isso ("Dawn bell breaks (a 1 on its die)."), o relatório do botão Use também ("Its last charge spent, it breaks."), e o diário o conta como perdido.

- `gate` (Capability API 1.62) é um teste em que quem usa precisa passar antes de o item funcionar, como o pergaminho de uma magia acima do nível de quem o lê exige. `check` nomeia o que é rolado: `{ "skill": "ward" }`, `{ "ability": "wits" }` ou um valor da ficha (`{ "value": { "derived": "spell_mod" } }`, para um número que muda de um personagem para outro, como o modificador de conjuração de um conjurador de 5e). `difficulty` vai de 1 a 100, escrito diretamente ou lido de uma estatística numérica do item (um item que não a fornece fica fora do menu, e seu botão Use diz isso claramente). `unless` pula o teste quando um valor na ficha de quem usa é pelo menos `atLeast`. Um teste falhado consome o item (ou gasta suas cargas) por nada. Numa luta, o teste é rolado quando o item é gasto, com os próprios dados da luta (uma reserva numa luta de reserva, em que `difficulty` é o número de sucessos necessário) e o número da ficha lido quando a luta começou, e conta o que as condições e os itens vestidos de quem usa somam a esse teste, inclusive o da própria perícia. O registro diz isso ("Ada rolls Ward to use Page of the vigil litany: 2 successes from 2 dice at 7 or more (8, 9), needing 2 successes, a success."). A página da litania da vigília de Gravewatch tem um:

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

O que uma luta consome e as cargas que deixa são gravados no inventário a cada passo, como os disparos de uma arma, e o diário diz o que foi usado. O registro da luta diz cada uso ("Poultice: 1 of 2 left.", "Dawn bell: 2 of 3 left."). Um membro do grupo jogado pelo Engine só usa uma cura em alguém ferido, e ninguém usa um item para golpear quem se afasta. Os detalhes do item e a linha do Game Master dizem o que usá-lo faz: "Use (Action): heals 1d4 + 1, range 0 paces, used up" e `use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`, e os detalhes mostram as cargas restantes. Um item que o Game Master inventa `like=` um dos seus é usado como aquele, com cargas e tudo.

### Itens nas batalhas Classic e Tactical

Um conjunto que não resolve as próprias lutas as deixa para as batalhas Classic e Tactical do próprio Game Mode, em que um modelo é consultado sobre o que os itens do inventário fazem quando uma luta começa. Seus itens não são adivinhados: cada um com um `use` faz o que ele diz, com os próprios números do Engine, e o palpite do Game Master só é pedido para os itens que não são seus (e para nenhum, com `native: false`).

- Um `heal` cura e um `attack` fere por uma fração da saúde máxima do alvo, a partir da média do seu `amount`: uma média de 7, o `1d8+3` de uma arma básica, é um pouco mais de um quinto dela, nunca menos de um vigésimo e no máximo tudo. Essa é a escala em que a ponte de combate lê os números de uma entrada de catálogo. O `damageType` é o elemento.
- A primeira condição em `applies` entra como um status com o próprio nome, pelos seus `rounds` (2 sem eles), e um `buff` ou `debuff` é só esse status, que aumenta ou reduz a defesa como os próprios status do Engine fazem.
- `targets` diz em quem ele é usado. Sem isso, uma cura ou uma melhoria vai para um aliado, e um ataque ou um enfraquecimento para um inimigo.
- `consumes: true` tira um da pilha, e um uso sem isso deixa o item onde está.
- Uma rolagem para acertar, uma salvaguarda, uma área, pontos temporários e uma reserva restaurada não têm lugar nessas batalhas, como acontece ali com o `mechanics` de uma entrada de catálogo: a descrição do item no menu ainda os menciona.
- Um item que ocupa espaços só é usado enquanto está vestido, e um que se vincula só enquanto está vinculado, como numa luta do conjunto. Um item consumido é tirado do que está vestido, nunca de um sobressalente na bolsa.
- Um item cujo uso gasta `charges` é oferecido enquanto resta um uso, e o menu Items conta seus usos. Cada uso gasta as cargas da pilha do item, primeiro a do próprio jogador, e o último gasto rola seu `breaksOn`: quebrado, o item some da bolsa, e o diário o conta como perdido.
- Um item que pede um teste antes (`gate`) tem esse teste rolado no servidor quando um membro do grupo o usa, com a ficha desse membro e o que ele veste (um companheiro sem card próprio rola numa ficha em branco, e só a unidade do próprio jogador recorre ao card do jogador), como o botão Use o rola, e pulado quando `unless` vale. Se falhar, o item é gasto (ou suas cargas são) e não faz nada, e o registro diz isso: "Ada rolls Ward to use Page of the vigil litany: 0 against 2, failed, and it is used up for nothing."
- Um item sem `use` não é oferecido nessas batalhas, nem uma cura sem `amount`.

O Engine calcula sozinho o efeito de cada item, então o que a tela envia nunca decide o que um dos seus itens faz.

### Loot

Uma luta vencida deixa loot em toda partida do Game Mode, uma vez, nas bolsas do grupo. Sem conjunto de regras, ele vem das tabelas próprias do Game Mode (mais itens, e mais raros, numa partida mais difícil), e o mesmo acontece num conjunto que não declara tabelas de loot e deixa `native` ativado. Um conjunto que declara tabelas de loot deixa cair os próprios itens no lugar, e um com `native: false` e sem tabelas não deixa cair nada.

`lootTables` no bloco `items` (Capability API 1.63) as lista, como fazem os bens funerários de Gravewatch:

```json
"lootTables": [
  {
    "id": "grave_goods",
    "label": "Grave goods",
    "rolls": "1d2",
    "entries": [
      { "item": "kit/shot-and-powder", "weight": 4, "count": "1d4" },
      { "item": "kit/warming-tonic", "weight": 3 },
      { "item": "kit/litany-page", "weight": 2 },
      { "filter": { "category": "arm" }, "weight": 1 },
      { "coins": "shilling", "weight": 2, "count": "1d6" }
    ]
  }
]
```

- `rolls` é quantas escolhas a tabela faz: um número de 0 a 20 ou dados (`"1d2"`), 1 por padrão.
- Cada escolha sorteia uma linha por `weight` (1 por padrão) contra as outras. Uma linha nomeia um dos seus itens como `<catalog>/<entry>`, um `filter` por `rarity`, `category` e `tag`, que escolhe por igual entre todos os itens que coincidem, ou (Capability API 1.64) `coins`, uma das suas moedas pelo ID. `count` é quantos caem, um número ou dados, 1 por padrão. Um item ou uma moeda que uma camada retira não deixa cair nada, nem um filtro que não encontra nenhum item.
- Uma criatura de bestiário nomeia a tabela que carrega com `loot` (veja Criaturas, abaixo). Uma luta do conjunto vencida rola a tabela de cada criatura derrotada, e uma luta que o Engine não resolve pelas suas regras não tem criaturas de bestiário, então não deixa cair nada.
- O que cai vai para a visão compartilhada como uma adição, começando pela bolsa do jogador, e o que ninguém consegue carregar fica para trás. O resumo que o Game Master recebe diz o que caiu e que isso já está nas bolsas, o diário registra, e uma notificação mostra.
- O Game Master rola uma tabela na história com `[loot: table="grave_goods" who="Ada"]` (`who=` para a bolsa de um personagem), medida a partir de onde o turno começou, como suas tags de inventário, então uma resposta regenerada deixa cair só uma vez. Cada item que cai é respondido como uma adição, e as instruções dele listam suas tabelas.

### Dinheiro

Suas `currencies` são o dinheiro do grupo. Uma moeda é um item nas bolsas, uma pilha de cada moeda como qualquer outra, nomeada pelo seu `label`:

- Ela pesa uma unidade da sua estatística de peso a cada `perWeight` moedas da família, conta para a carga de quem a porta e é colocada pela regra de carga quando entra. Uma família sem `perWeight` não pesa nada.
- O jogador adiciona moedas pela lista **Coins** (moedas) do seletor e as divide, dá e junta como qualquer pilha.
- Uma linha acima das pilhas do inventário mostra as moedas de cada família à vista e seu valor na menor moeda da família. O Game Master vê esse valor ao lado de cada bolsa (`Coin worth 432 pennies`, ou `no coins` para uma bolsa vazia, com a bolsa do jogador listada mesmo quando não tem nada), e o `cost` de um item ao lado do item (`costs 3 shillings`).
- O Game Master paga com `[inventory: action="pay" amount="3 shillings" who="Ada"]` e recebe com `action="earn"`. `amount` é uma quantidade e uma moeda, pelo ID ou rótulo, no singular ou no plural, com qualquer combinação de maiúsculas e minúsculas (`1 penny`, `12 pennies`). Um pagamento sai de uma única bolsa (a do jogador, sem `who=`), só na família da própria moeda: as maiores moedas que cabem vão primeiro, depois a menor moeda restante que cobre o que ainda se deve é trocada, e o troco volta nas moedas menores da família, das maiores para as menores. A resposta diz o que foi pago e o que voltou: 3 shillings de uma bolsa com uma crown dá `Paid with crowns ×1; shillings ×2 back.` Um pagamento que a bolsa não consegue cobrir é recusado (`cannot-afford`), assim como uma moeda que você não tem (`unknown-coin`) e qualquer pagamento num conjunto sem moedas (`no-currencies`). Um recebimento é uma adição dessa moeda, na bolsa de `who` ou dividida pela regra de carga. O diário lista o que foi gasto e recebido, e uma notificação mostra. As instruções dele listam suas moedas, e só um conjunto que tem moedas recebe essas instruções.
- Comprar é um pagamento seguido de uma adição ou, num conjunto com mercado, um `buy` (abaixo). Não há tela de loja.

### Equipamento inicial

`items.startingGear` (Capability API 1.78) lista o equipamento que um personagem pode colocar na bolsa no início: o kit de uma classe, o de um antecedente, o de uma vocação. Ele nunca é dado sozinho. O inventário mostra uma linha **Starting gear** (equipamento inicial), e o jogador escolhe um equipamento, uma opção para cada uma das escolhas dele e um item de cada lista, e então o coloca na bolsa do jogador ou na de um membro do grupo. O equipamento ao qual a ficha do personagem atende com `fits` é listado primeiro, depois o equipamento sem `fits` (para qualquer personagem, como o de um antecedente); todo equipamento é oferecido, porque o conceito de um personagem cabe ao jogador e ao Game Master combinarem.

```json
"startingGear": [
  {
    "id": "fighter", "label": "Fighter", "group": "class",
    "fits": { "value": { "field": "level_fighter" }, "atLeast": 1 },
    "lines": [{ "item": "equipment/shield", "equip": true }],
    "choices": [
      {
        "label": "Armor",
        "options": [
          { "label": "Chain mail", "lines": [{ "item": "equipment/chain-mail", "equip": true }] },
          { "label": "Leather armor and a longbow", "lines": [
            { "item": "equipment/leather-armor", "equip": true },
            { "item": "equipment/longbow" }, { "item": "equipment/arrow", "count": 20 }
          ] }
        ]
      },
      { "label": "A martial weapon", "options": [
        { "label": "Pick one", "lines": [{ "oneOf": ["equipment/longsword", "equipment/battleaxe"] }] },
        { "label": "A greataxe", "lines": [{ "item": "equipment/greataxe" }] }
      ] }
    ]
  },
  { "id": "acolyte", "label": "Acolyte", "group": "background", "lines": [{ "coins": "gp", "count": 15 }, { "name": "Vestments" }] }
]
```

- Uma linha é um dos itens do conjunto (`item`), moedas (`coins`, um ID de moeda), um item que o jogador escolhe de uma lista fixa (`oneOf`, de 2 a 48 itens) ou um item simples pelo nome (`name`, onde `freeform` permite itens simples; sujeito às regras de um rótulo, então sem colchetes, `{{` nem quebras de linha). `count` vai de 1 a 999; `equip: true` veste um item quando ele é pego, onde houver espaços livres, então a armadura conta desde o início.
- `choices` são de 0 a 8, cada uma com 2 a 6 opções com as próprias linhas.
- `group`: o equipamento que um personagem pega uma vez de cada grupo (o de uma classe e o de um antecedente). Pegar o mesmo grupo de novo é uma escolha que o jogador faz na caixa de diálogo, e se soma ao que já está na bolsa. Um equipamento sem grupo é um grupo próprio, nunca igual a um grupo de mesmo nome.
- `fits` lê a ficha sem o estado vivo, como faz a carga. Ele só ordena a lista.
- Pegar é tudo ou nada: um equipamento pesado demais para quem vai levá-lo é recusado por inteiro, e a caixa de diálogo diz quanto ele pesa em relação ao que a pessoa ainda consegue carregar. Um item que uma camada tira da partida fica de fora e é nomeado, assim como uma lista cujos itens ela tira todos; moedas de um tipo que uma camada retira são pagas na maior moeda restante de mesmo valor, e a caixa de diálogo as mostra assim. Um equipamento do qual não sobra nada é recusado, para que nunca seja marcado como pego por nada. Um serviço nunca é oferecido numa lista.
- A importação verifica todo item (num catálogo incluído no arquivo; um catálogo num arquivo próprio é verificado quando o equipamento é pego), moeda, item simples e referência de `fits`, recusa um serviço e recusa uma contagem que precisaria de mais pilhas do que uma bolsa aceita de uma vez.

### Mercados

Um `market` no bloco `items` (Capability API 1.65) diz o que um lugar vende e a que preço, em vez de toda loja vender tudo pelo preço de tabela. O de Gravewatch, um pouco resumido:

```json
"market": {
  "prices": [
    { "id": "cheap", "label": "cheap", "times": 0.75 },
    { "id": "fair", "label": "fair", "times": 1, "default": true },
    { "id": "dear", "label": "dear", "times": 1.5 }
  ],
  "places": [
    { "id": "hamlet", "label": "hamlet" },
    { "id": "village", "label": "village" },
    { "id": "town", "label": "market town" },
    { "id": "city", "label": "city" }
  ],
  "sold": [
    { "filter": { "rarity": "rare" }, "place": "town" },
    { "filter": { "category": "arm" }, "place": "village" }
  ],
  "sellers": [
    { "id": "chandler", "label": "chandler", "sells": [{ "category": "coat" }, { "category": "tonic" }] },
    { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "place": "village" },
    {
      "id": "chapel",
      "label": "chapel of the Vigil",
      "sells": [{ "category": "page" }],
      "place": "town",
      "only": { "value": { "abilityScore": "nerve" }, "atLeast": 3, "label": "wardens of Nerve 3 or more" }
    }
  ]
}
```

- `prices`: de um a oito níveis, cada um um multiplicador (`times`, acima de 0) sobre o `cost` de um item, e um deles o `default`. Um preço é o custo na menor moeda da família vezes o nível, arredondado nela (nunca abaixo de uma moeda para algo que custa alguma coisa), e expresso na moeda em que seu custo está escrito quando essa moeda o paga exatamente, senão na maior moeda que suas camadas deixam e que o paga: em `dear`, um casaco que custa 8 shillings sai por 12 shillings, e uma poção de 5e que custa 50 gp sai por 50 gold pieces, nunca 5 platinum. Pechinchar ou o humor de um vendedor mudam o nível, nunca o número.
- `places`: de um a doze tamanhos de lugar, do menor ao maior, nas suas próprias palavras.
- `sold`: regras para o menor lugar que vende o que um filtro escolhe. Um filtro nomeia `rarity`, `category` e `tag`, quaisquer deles, e coincide com um item que tem todos os que nomeia; a primeira regra que coincide com um item decide. O `sold` do próprio item prevalece sobre as regras, e um item que nada nomeia é vendido em qualquer lugar.
- `sellers`: tipos de vendedor, cada um com o que vende em `sells` (filtros, qualquer um dos quais escolhe um item), o menor `place` que tem um (qualquer lugar, sem isso) e, opcionalmente, a quem ele vende com `only`: um valor da ficha do comprador, com seu estado vivo e o que ele carrega, de pelo menos `atLeast`, informado ao Game Master como `label`. Sem `sellers`, qualquer pessoa num lugar vende o que aquele lugar vende.
- Um item sem `cost` não está à venda, nem um que uma camada oculta ou cujas moedas uma camada retirou.

**Onde o grupo está.** O Game Master diz em que lugar uma cena está e o tamanho dele com `[place: name="Millbrook" size="market town"]`, o tamanho pelo ID ou rótulo, e omite o tamanho para um lugar sem mercado (uma estrada, a natureza selvagem). O Engine responde a cada tag no lugar, recusando um tamanho que você não tem, e o último lugar respondido nas respostas do Game Master que o jogador vê, a partir do início mais recente da conversa, é o lugar em vigor até que outro seja dito. Uma tag de lugar que o jogador digita nunca conta. Uma resposta regenerada lê só o que veio antes da resposta que ela substitui.

**Comprar.** O Game Master compra com `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`, sendo `level` (o padrão, sem ele) e `seller` (qualquer vendedor ali que venda o item, sem ele) opcionais. O Engine define o preço no lugar em vigor quando a resposta termina, tira o preço da bolsa do comprador (a do jogador, sem `who=`) como num pagamento, com troco, e coloca o item na bolsa dele, ou só paga, no caso de um serviço. Ou as duas coisas acontecem, ou nenhuma. A resposta diz quanto custou (`price="12 shillings"`) e o que foi pago e devolvido, e uma notificação mostra. Uma compra é recusada, sem mudar nada, quando não há lugar dito (`no-place`), quando um nível, item ou vendedor não existe no seu conjunto (`unknown-level`, `unknown-item`), quando não há preço (`not-for-sale`), quando o lugar é pequeno demais para o item (`not-here`), quando não há vendedor ali que o venda (`no-seller`), quando o comprador não atende ao `only` do vendedor (`not-to-you`), quando a bolsa não consegue pagar (`cannot-afford`) ou quando a bolsa não consegue carregar o item.

**O que o Game Master vê.** Enquanto uma cena está num lugar com mercado, um bloco MARKET nomeia o lugar e seu tamanho, os níveis de preço e cada vendedor ali com uma dúzia do que vende no nível padrão, do mais barato ao mais caro; qualquer coisa que vendam pode ser comprada pelo nome. As instruções dele ensinam `[place:]` e `buy`, e só um conjunto com mercado as tem.

#### Um dia de mercado

Um dia de mercado (Capability API 1.69) faz as prateleiras de um lugar mudarem e se esgotarem, e permite que o grupo venda de volta. O de Gravewatch, um pouco resumido:

```json
"places": [
  { "id": "hamlet", "label": "hamlet", "purse": { "amount": 10, "unit": "shilling" } },
  { "id": "town", "label": "market town", "purse": { "amount": 100, "unit": "shilling" } }
],
"buyBack": 0.5,
"sold": [{ "filter": { "rarity": "rare" }, "place": "town", "limited": "1d2" }],
"sellers": [
  { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "stock": { "table": "smiths_odd_lot" } }
]
```

- **O dia.** Um dia num lugar dura até o Game Master nomear outro lugar; ele começa um novo dia no mesmo lugar dizendo-o de novo com `day="new"` (`[place: name="Millbrook" size="market town" day="new"]`). Tudo abaixo é calculado por dia a partir das respostas do Game Master que o jogador vê, então um swipe, uma resposta regenerada ou uma ramificação não precisam de nada salvo, e um dia sempre rola a mesma prateleira.
- **`limited`** numa regra `sold` ou no `sold` do próprio item: quantos um lugar mantém disponíveis num dia, um número ou dados rolados para o dia. Uma regra pode nomear um limite sem lugar (vendido em qualquer lugar, poucos de cada vez); o lugar de um item vem da primeira regra que nomeia um lugar, e seu limite, da primeira que nomeia um limite. Depois que se esgotam, uma compra é recusada (`sold-out`) até um novo dia.
- **`stock`** num vendedor: uma das suas tabelas de loot, rolada uma vez por dia para o que aquele vendedor tem em estoque além do que vende. O que ela rola (só itens, nunca moedas) é vendido só por aquele vendedor, na quantidade rolada, seja o que for que `sells` e `sold` digam; o `only` de um vendedor continua valendo.
- **`buyBack`**: a fração (acima de 0, no máximo 1) do preço padrão de um item que um vendedor paga por ele. Um vendedor ali que vende esse tipo de coisa o compra (qualquer pessoa, sem vendedores). Sem `buyBack`, ninguém compra nada de volta.
- **`purse`** num tamanho de lugar: o caixa, isto é, o máximo que seus vendedores pagam num dia, todos juntos, numa das suas moedas. Vendas pagas na família dessa moeda contam contra ele; sem caixa, eles compram sem limite.
- **Vender.** O Game Master vende com `[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]`. O Engine define o preço, tira o item da bolsa de quem vende (a do jogador, sem `who=`; nunca um item amaldiçoado vinculado) e coloca as moedas, das maiores para as menores, ou recusa e não muda nada: nenhum lugar dito, ninguém ali compra o item (`not-bought`), sem preço (`not-for-sale`), caixa do dia esgotado (`purse-spent`), nenhum em mãos, ou moedas que a bolsa não consegue carregar. A resposta diz quanto rendeu (`price="4 shillings"`), o diário o lista como vendido, e uma notificação mostra.
- O bloco MARKET adiciona o que cada vendedor tem em estoque hoje, quantos restam de um item limitado, o que os vendedores ali pagam e quanto resta do caixa do dia; as instruções dele ensinam `sell` e `day="new"`.

#### Vendedores honestos e desonestos

A Capability API 1.79 permite que um item seja arriscado ou uma falsificação, e que um vendedor seja desonesto.

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- **`risky`** num item: o que um vendedor honesto avisa antes de vendê-lo. O bloco MARKET o lista com "(warn the buyer first: ...)" ao lado da mercadoria de um vendedor honesto; um vendedor desonesto não diz nada.
- **`passesFor`** num item faz dele uma falsificação de outro item (`<catalog>/<entry>`): um item real e vendável da mesma categoria, vestido nos mesmos espaços, que se vincula se a falsificação se vincula. Isso é verificado na importação quando os dois podem ser lidos, na instalação para cada arquivo de catálogo e de novo quando um mercado o oferece, então uma falsificação cujo alvo falta ou está oculto por uma camada nunca é vendida. Um item amaldiçoado (`binds.cursed`) ou uma falsificação nunca está entre as mercadorias de ninguém, e nunca no estoque de um vendedor honesto.
- **`honest: false`** num vendedor: uma falsificação que a tabela `stock` dele rola é oferecida como o item pelo qual ela se passa, pelo preço desse item, e o bloco MARKET mostra a verdade ao Game Master ao lado dela. Uma compra que nomeia esse vendedor e esse item recebe a falsificação; uma compra que não nomeia vendedor nunca recebe.
- **Uma falsificação na bolsa** aparece como o item pelo qual se passa em todo lugar em que o jogador olha (a bolsa, o diário, as notificações, as lutas) e mantém o que realmente é. O bloco de inventário do Game Master a marca como `[FAKE: really ...]` e pede que ele continue chamando-a pelo nome com que ela aparece.
- **Descoberta**: `[inventory: action="reveal" item="Bag of Holding" who="Ada"]`, vinculá-la (a sintonia revela uma maldição), usá-la (acontece o que ela realmente faz; quando isso é algo que as regras não calculam, o Game Master o narra) ou vendê-la a um comprador honesto, que diz o que ela realmente é e paga o que isso vale (o próprio `cost` dela), ou recusa, quando ela não tem custo. Um comprador desonesto aceita uma falsificação pelo que ela parece. A partir daí, ela é o seu item verdadeiro.
- **Vestida ou carregada**: uma falsificação faz na ficha do personagem o que realmente faz (seus efeitos `worn` ou `carried` e suas estatísticas). A primeira mudança no inventário depois da qual a ficha mostra um número, ou o que um teste soma, que o item pelo qual ela se passa não mostraria a desmascara, e o diário e a tela dizem o que ela era. Uma diferença que só uma luta lê (uma resistência) não a desmascara, nem uma mudança só na ficha até a próxima mudança no inventário. Numa luta, uma arma falsa vestida ainda ataca como a arma pela qual se passa.
- No modo de confiança de um só jogador, o Peek Prompt mostra a visão do Game Master, inclusive a verdade.

<a id="using-items-outside-a-fight"></a>

### Usar itens fora de uma luta

O mesmo `use` funciona fora de uma luta (Capability API 1.60 para `restore`; o resto não precisa de nada novo). O botão **Use** do inventário, num dos seus itens com um `use`, e o `[inventory: action="use" item="Poultice" who="Juno"]` do Game Master fazem o que o item faz em quem o carrega, com os dados do Engine:

- Uma cura devolve saúde: a quantidade numa reserva de saúde, ou uma marca limpa numa trilha de ferimentos, como faz uma cura numa luta. Pontos `temporary` vão para uma reserva de saúde, `restore` devolve sua reserva, e cada condição que ele aplica (`applies`) é imposta até que algo a remova.
- Um uso que fere, ou que mira o outro lado (`kind` `attack` ou `debuff`, ou `targets` `enemy`), não atinge ninguém: fora de uma luta, não há ninguém no tabuleiro para atingir. O item ainda é usado, e o Game Master é informado do que ele faz, para narrar.
- Ele tira um da pilha ou gasta suas cargas exatamente como numa luta, e um item sem nada restante, ou um que ocupa um espaço ou se vincula e não está vestido, é recusado e não muda nada. A ficha e a bolsa são gravadas juntas.
- Um `gate` é rolado primeiro, como um teste: os dados do próprio conjunto com o número da ficha, a penalidade de ferimentos de quem usa e o que suas condições e itens vestidos ou carregados fazem com esse teste. Um teste falhado consome o item por nada, e a linha diz isso ("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

O que aconteceu é dito numa linha: "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." O botão Use envia isso ao Game Master num bloco `[item_used]` depois de "I use my Poultice.", que o chat mostra como um selo; a tag do próprio Game Master é respondida com ele, medida a partir de onde o turno começou como suas outras tags, então uma resposta regenerada nunca usa um item duas vezes. Um item sem `use`, ou numa partida sem conjunto de regras, continua sendo simplesmente dito: "I use my rope."

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

O bloco `battle` acima empresta à luta os números da ficha, enquanto a aritmética continua sendo do Marinara. O bloco opcional `combat` é a outra coisa: define como suas regras RESOLVEM a luta. Ele parametriza um tipo de combate do Engine, assim como `resolution` parametriza um tipo de teste, e todos os nomes nele são seus. Há dois tipos: `attack-vs-defense`, em que os dados são somados e comparados com um número, e `dice-pool`, em que a luta rola as próprias reservas do seu conjunto `dice-pool` e conta sucessos (veja Uma luta em reservas de dados, abaixo).

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

- `kind`: `"attack-vs-defense"` (um lado rola dados contra a defesa do outro; acertar causa dano) ou `"dice-pool"` (veja Uma luta em reservas de dados). Cada chave abaixo significa o mesmo nos dois, lida do jeito que aquele tipo lê números.
- `health`: obrigatório. O que a luta retira: `{ "pool": "grit" }`, uma reserva que diminui e cujo buffer temporário absorve o dano primeiro, se existir; ou `{ "track": "harm" }`, uma trilha de ferimentos que recebe MARCAS. A trilha exige `damageKinds` e não concede pontos temporários.
- `defense`: obrigatório, referência de valor. Um campo digitado pelo jogador ou um valor derivado calculado.
- `initiative`: obrigatório. Dados rolados uma vez no início e referência opcional de modificador. Empates favorecem o maior modificador e depois a ordem de preparação da luta. `"each": "round"` rola de novo a iniciativa de todos no início de cada nova rodada, com o modificador como estiver naquele momento (então um modificador que lê uma trilha de ferimentos fica mais lento depois de ferido), e a rodada começa por quem estiver primeiro na nova ordem. Capability API 1.47. Uma luta `dice-pool` pode rolá-la como reserva: `pool` (uma referência de valor) é quantos dados, e os sucessos deles mais `plus` são o número, sem `dice` nem `modifier` ao lado. `resource`, que exige `pool`, mantém esse número e deixa os ataques movê-lo (veja "Iniciativa que os ataques movem", abaixo). Capability API 1.48.
- `attackRoll`: obrigatório em `attack-vs-defense` e recusado em `dice-pool`, que rola as próprias reservas da sua resolução. Define dados, se rola duas vezes e mantém uma (`advantage`), efeitos das faces extremas de um dado (`naturals.max`: `critical`, `hit` ou `none`; `naturals.min`: `miss` ou `none`) e efeito do crítico (`critical`: `double-dice` rola novamente os dados de dano; `max-dice` adiciona uma vez suas faces máximas; `none` é um acerto comum). Faces especiais exigem um único dado, como nos testes. Salvaguardas durante a luta usam esses mesmos dados. `criticalFrom` amplia a face crítica: um valor lido da ficha do atacante que é a menor face natural que conta como crítico, como `{ "field": "critical_from" }` para um Champion de 5e cuja ficha diz 19. Ele fica limitado à face máxima do dado, um valor abaixo de 2 significa nenhuma faixa (só a face máxima, como para um personagem cujo campo ficou em 0), e exige um único dado com `naturals.max` definido como `critical`. Capability API 1.81.
- `economy`: obrigatório. `budgets` define o que cabe num turno: ID, rótulo, `per` (`turn` recarrega no início do turno do portador; `round`, no início da rodada) e `count`. O PRIMEIRO orçamento é o principal, gasto por ações padrão. `movement` é uma referência opcional de distância percorrida por turno, na sua unidade. Lutas em tabuleiro a leem; veja Posições.
- `attacks`: opcional. Listas da ficha cujas linhas são armas. `name` é a coluna de nome; `damage.dice`, a de dados; `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` e `damage.type` nomeiam colunas da mesma lista. Uma coluna `ability` é um `enum` com um ID de atributo; outros valores não acrescentam nada. `proficiency` é `boolean`: ativar adiciona o bônus de proficiência. Sem dados legíveis, a linha não é um ataque; uma corda continua sendo corda. `toHit.skill` nomeia uma coluna `enum` com um dos seus IDs de perícia: a linha soma o que um teste daquela perícia soma, com o `ability` da própria linha no lugar do da perícia quando ela nomeia um, exatamente como o `with=` de um teste faz a troca (Capability API 1.47). `strikes` referencia quantos ataques UM gasto do orçamento compra. Escolher uma linha sem ataques disponíveis gasta o orçamento e deixa os restantes disponíveis. Enquanto houver algum, todas as linhas que declaram `strikes` são gratuitas: trocar de arma, alvo ou andar entre ataques decorre do próprio menu. `strikesCappedBy` nomeia uma coluna booleana que limita SUA linha a um único ataque, independentemente de quantos a lista compra: serve para armas que disparam uma vez por turno, como a propriedade Loading do SRD 5.1. Não faz sentido, e é recusado, numa lista que já compra um ataque por gasto. Os ataques disponíveis pertencem ao COMBATENTE, não a uma lista: duas listas com `strikes` compartilham a mesma quantidade, qualquer que seja a linha usada. São removidos ao terminar o turno que os comprou. Sem declaração, cada gasto compra um ataque, como antes.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`: opcional. Listas cujas linhas marcadas por catálogo são habilidades, filtradas como `battle.skills` com `onlyWhen` e `alwaysWhen`. Os efeitos são o `mechanics` da entrada; o bloco define o `budget` padrão, o `toHit` adicionado quando rola para acertar e a `saveDifficulty` das salvaguardas. Uma entrada que pede salvaguarda, própria ou para terminar uma condição aplicada, é recusada se a lista não tiver `saveDifficulty`: uma salvaguarda contra nada sempre passaria. Com a Capability API 1.108, `byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }` escolhe as referências pela classe de uma linha. Um clérigo 3 / mago 2 pode derivar o ataque do clérigo da proficiência mais Wisdom, e a CD de 8 mais esse ataque, e os do mago a partir de Intelligence. A coluna precisa existir na lista da fonte, e `values` comporta de 1 a 20 entradas. Cada entrada pode substituir qualquer uma das referências; uma referência omitida, um valor de coluna ausente ou um valor não listado mantém a referência própria da fonte. O combate, o resumo de linhas da ficha e o resumo do Game Master leem os mesmos números por linha. Tanto `stamp` quanto `byColumn` exigem schemaVersion 2 e capabilityApi 1.108 ou mais recente.
- `standard`: opcional, lista fechada `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. `dodge` (ataques recebidos rolam duas vezes e mantêm o pior) e `help` (próximo ataque do aliado rola duas vezes e mantém o melhor) sempre são resolvidos. `dash` (outra cota completa de movimento) e `disengage` (ninguém ataca por você se afastar neste turno) são resolvidos no tabuleiro e apenas registrados fora dele. `hide` e `ready` são aceitos, mas ainda não fazem nada.
- `standardEffects`: opcional, efeitos de uma ação padrão ausentes de seu indicador. Hoje só `dodge` tem isso: `{ "dodge": { "saves": ["dex_save"] } }` informa quais salvaguardas rolam duas vezes e mantêm a melhor enquanto durar. Nomeie só salvaguardas declaradas e apenas se `standard` incluir `dodge`. Sem isso, esquivar continua dificultando acertos e nada mais.
- `conditions`: opcional. Mapeia SEUS IDs de condições para seus efeitos, unindo ficha e luta num registro: um personagem envenenado continua assim depois. Lista fechada: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side` (1.278) e `cannot-approach-source`. `failsSaves` nomeia salvaguardas que falham sem rolar. Os seis efeitos que precisam de distância ou movimento (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) só atuam no tabuleiro; veja Posições. `cannot-react` exclui o portador das janelas abertas por movimento, então ele nunca é consultado. Há mais quatro chaves ao lado dos efeitos:
  - `modifiers`: os números que a condição altera enquanto vale. Veja Números que uma condição altera, abaixo.
  - `saves`: salvaguardas a que se referem os dois efeitos de salvaguarda e qualquer modificador de salvaguardas. Sem ela, todas; declará-la sem nenhum dos dois é recusado.
  - `skills`: perícias a que se referem os dois efeitos de teste e qualquer modificador de testes que não nomeie perícias próprias. Sem ela, todas; declará-la sem nenhum dos dois é recusado. As disputas de uma luta rolam os próprios testes da luta, não perícias, então algo restrito a perícias nunca chega a uma disputa; um teste fora de uma luta com uma dessas perícias o lê (veja Testes fora de uma luta, abaixo). Capability API 1.53.
  - `whileSourceInSight`: o que só vale enquanto quem aplicou a condição estiver visível para o portador. `true` condiciona a condição inteira; uma lista de efeitos condiciona só esses e mantém os demais, como medo que impede aproximação mesmo sem ver a origem. Efeitos ausentes da condição são recusados. Sem tabuleiro, não há linha de visão para romper, então tudo vale igualmente.
  - `endsWhenSourceDown`: a condição termina quando quem a aplicou cai.
  - Sentidos (Capability API 1.127): o `lacks` de uma condição nomeia sentidos que quem a porta não tem, e o `mechanics.needs` de uma entrada de catálogo ou o `needs` de uma ação de criatura nomeia sentidos que um alvo precisa ter para que ela funcione nele. Para o Deafened de 5e, escreva `"lacks": ["hearing"]`; para Command, escreva `"needs": ["hearing"]` nas mecânicas dela. Um alvo surdo fica fora do menu de alvos de Command. Um efeito de área ou de vários alvos que precisa de audição pula esse alvo por completo: sem salvaguarda, dano nem condições. Quando Deafened termina, o alvo volta a ser válido. Cada lista tem de um a quatro IDs de sentido únicos, nas palavras do próprio conjunto; o Engine não conhece nenhum nome de sentido.
  - Utilizável só enquanto a ficha permitir (Capability API 1.166): o `mechanics.usableWhen` de uma entrada de catálogo é `{ "value": <value reference>, "atLeast": n, "atMost": n }` (um limite ou os dois). Numa luta, a entrada só é oferecida, no turno de quem a tem ou numa janela de reação, enquanto o valor lido da ficha, do estado vivo e dos itens de quem a tem estiver dentro dos limites; ele é lido toda vez que o menu é montado. A Protection de 5e exige um escudo na mão: `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. O "no heavy armor" de Rage é o mesmo com `"atMost": 0` na contagem de armaduras pesadas. Uma criatura escrita como bloco de estatísticas não tem ficha, então nada a impede.
  - Condições aplicadas só enquanto a ficha de quem as aplica permitir (Capability API 1.167): uma entrada de `applies` nas mecânicas de uma entrada de catálogo ou no uso de um item pode ter `"when"`, no mesmo formato de `usableWhen`. Ele é lido da ficha, do estado vivo e dos itens de quem a aplica, no momento em que ela seria imposta, e uma entrada fora dos limites é pulada; as outras ainda se aplicam. O Rage de 5e aplica `raging` e uma de três condições de dano dentro do limite de quatro entradas: `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, depois `raging_damage_3` com `"atLeast": 9, "atMost": 15` e `raging_damage_4` com `"atLeast": 16`. Quem aplica sem ter ficha aplica todas as entradas. O bloco de estatísticas de uma criatura e o `onEnd` de uma condição não têm ficha de quem aplica para ler, então `when` é recusado ali. Exige schemaVersion 2 e capabilityApi 1.167 ou mais recente.
  - Tipos de criatura e testes de alvo (Capability API 1.168): `combat.creatureTypes` lista o que um combatente pode ser, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id": "devil", "label": "devil" }], "field": "race", "default": "humanoid" }`. Uma criatura nomeia o próprio `type` e as próprias `tags`; o tipo de um personagem é o valor do campo de texto ou de escolha `field` quando ele é um dos tipos, senão `default` (personagens de 5e são humanoides). Um teste de alvo é `{ "types": [...], "tags": [...] }` e passa com qualquer correspondência; um combatente sem tipo e sem tags nunca corresponde. Ele vai em três lugares: o `targetIs` de uma cláusula de dano causa essa cláusula só a um alvo que corresponde (uma dragon slayer: `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, água benta: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`); o `targetIs` de uma entrada de `applies` só impõe essa condição a um alvo que corresponde; e `mechanics.targetTypes: { "is": test, "not": test }` diz quem pode ser escolhido ou pego (Animal Friendship: `{ "is": { "types": ["beast"] } }`; Sleep: `{ "not": { "types": ["undead"] } }`). Uma área passa por quem `targetTypes` deixa de fora sem pegá-lo. Uma previsão só conta uma cláusula `targetIs` contra um alvo que ela alcançaria; a média simples da ficha a deixa de fora. O painel de batalha e o Game Master veem o tipo e as tags de cada combatente. Exige schemaVersion 2 e capabilityApi 1.168 ou mais recente.
  - Fins de condição (Capability API 1.125): Charm Person usa `"endsWhen": ["harmed-by-source-side"]`. Dano acima de zero vindo de quem a aplicou ou de alguém do lado dessa pessoa, ou o fato de mirarem quem a porta com um ataque, uma salvaguarda ou uma condição nociva, a encerra depois que a ação nociva se resolve por completo, mesmo que o ataque erre ou a salvaguarda tenha sucesso. `"saveWhenDamaged": true` repete uma salvaguarda de turno ao receber dano: cada dano acima de zero repete o `saveEnds` da ação que a aplicou, na CD guardada; um sucesso a encerra. Sem uma salvaguarda ou CD guardada, nada é rolado. Hypnotic Pattern usa `"endsWhen": ["damaged"]` e `"shakeOff": { "budget": "action" }`: qualquer dano acima de zero a encerra na hora, ou outro combatente do lado de quem a porta pode gastar esse orçamento no próprio turno para encerrá-la. `shakeOff.reach` fica na unidade de distância do conjunto e tem padrão de uma célula; sem tabuleiro, nenhuma distância é medida. A economia precisa declarar o orçamento dele. `endsWhen` tem uma ou duas entradas únicas. Essas chaves não mudam os fins por queda da origem e por concentração. Para uma salvaguarda só com dano acima de zero, nunca no início ou no fim do turno, use `saveEnds.at: "damaged"` (Capability API 1.129): o applies de Dominate Person é `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`, que rola uma vez por golpe na CD guardada da ação que a aplicou, sem precisar de `saveWhenDamaged`.
  - A economia de ações (Capability API 1.76), como Haste e Slow a mudam:
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]` dá a quem a porta essa quantidade a mais (ou a menos) de um orçamento de turno a cada turno, nunca abaixo de nenhum. Só um orçamento que recarrega `per` turno pode ser mudado dessa forma. Um orçamento pode ser declarado com `"count": 0` para um que só uma condição preenche, e a tela só o mostra enquanto alguém tiver algum. Um oponente inventado nunca gasta um.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true, "items": true }` diz em que esse orçamento pode ser gasto: as ações padrão nomeadas (da lista `standard` do próprio conjunto, nunca no primeiro orçamento, onde todas as ações padrão já estão), um ataque com arma de um único golpe (sejam quantos forem os ataques que uma ação disponibilizaria; para uma criatura, um ataque do seu bloco de estatísticas contra um alvo, nunca um ataque múltiplo) e o uso de um item: `true` para qualquer item, ou `{ "tags": ["mundane"] }` só para um item com uma dessas tags de item (o Use an Object de 5e é o de um item comum, nunca a ativação de um item mágico). Elas são oferecidas depois que o orçamento que normalmente gastariam acabou, e só no próprio turno de quem a porta: uma concessão nunca paga uma reação.
    - `exclusive`: `["action", "bonus"]`, dois orçamentos dos quais um turno só gasta um: gastar qualquer um esvazia o outro.
    - `attacksPerTurn`: quantos ataques (ações que rolam para acertar, cada parte de uma sequência que ataca e uma disputa que ocupa o lugar de um golpe, como um agarrão) quem a porta faz no próprio turno, seja o que for que uma ação daria. Uma reação no turno de outra pessoa não é limitada nem contada.
    - `onEnd`: `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`, o que ela deixa para trás quando termina de vez (se esgota, uma salvaguarda ou um dano a encerra, a concentração se rompe), nunca quando é imposta de novo. Ela dura algumas `rounds` (nunca `"until-save"` ou `"instant"`). Deixada para trás no meio do próprio turno de quem a porta, as rodadas dela começam no turno seguinte, então uma rodada é o turno seguinte inteiro.
  - Quando uma luta termina, seja como for, toda condição que ela impôs com relógio, com `endsAfter` ou com concentração sai da ficha sem deixar nada para trás, e a concentração termina. Uma condição sem relógio (o caído de uma queda) permanece.

  `own-saves-advantage` e seu oposto rolam duas vezes e mantêm uma, como ataques; eles se anulam. `own-checks-advantage` e seu oposto fazem o mesmo com o lado de quem a porta numa disputa, que é onde uma luta faz seus testes de atributo, e com os testes dessa pessoa fora de uma luta. `resist-all` reduz todo dano pela metade além das defesas próprias do alvo e se anula com uma vulnerabilidade da mesma forma. `cannot-target-source` impede mirar qualquer coisa em quem aplicou a condição (`cannot-target-source-side`, 1.278: nem em ninguém do lado dessa pessoa, a menos que seja o do próprio portador). `cannot-approach-source` impede chegar mais perto que a casa atual, incluindo o caminho: contornar até uma casa igualmente distante é permitido, mas passar perto e sair do outro lado não.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **Dano que uma condição altera (Capability API 1.133).** `damage` muda o que quem a porta causa; `damage-taken` muda o que quem a porta recebe. Os dois aceitam `flat`, `dice` (e `minus`) ou `times: 0.5 | 2`. Os acréscimos acontecem uma vez por acerto de ataque, mesmo quando o acerto tem várias cláusulas de dano; os críticos dobram os dados acrescentados como o conjunto dobra os outros dados. Salvaguardas e acertos automáticos não recebem nada. `times` muda o acerto inteiro depois dos acréscimos e antes da resistência, arredondando o total para baixo uma única vez considerando todas as cláusulas. As quantidades acrescentadas enfrentam a resistência pelo próprio `damageType`, ou pelo tipo do acerto quando omitido. Acréscimos do mesmo tipo se juntam a essa quantidade antes da resistência.

  `attacks` é `weapon`, `spell` ou `any` (o padrão). As linhas de lista de ataques e os ataques de itens equipados são armas, assim como as rolagens de ataque de alvo único de blocos de estatísticas; as habilidades de catálogo (inclusive a conjuração de criaturas) e os usos de itens são ataques de magia ou de outro tipo. `blow: "melee" | "ranged"` segue a 1.118, então uma arma de arremesso ao alcance é corpo a corpo. `ability` nomeia o atributo de fato escolhido para a rolagem de ataque: o atributo de uma linha, ou o primeiro melhor atributo oferecido por um item (inclusive acuidade). Ações simples de blocos de estatísticas não têm nenhum e nunca coincidem com uma restrição de atributo. Essas chaves e `damageType` são recusados em outros alvos de modificador. `fromSource: true` é só para `damage-taken`: o acerto precisa vir de quem aplicou a condição acompanhada. Uma condição não acompanhada, um nível ou um item não tem origem que a aplicou e não pode coincidir com ele.

  Em 5e, declare estes IDs de condição na ficha e coloque estas entradas em `combat.conditions`:

  ```json
  [
    {
      "condition": "divine_favor",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "1d4", "damageType": "radiant" }]
    },
    {
      "condition": "rage",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "blow": "melee", "ability": "str", "flat": 2 }]
    },
    {
      "condition": "enfeebled",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "ability": "str", "times": 0.5 }]
    },
    {
      "condition": "hunters_mark",
      "modifiers": [{ "to": "damage-taken", "attacks": "weapon", "fromSource": true, "dice": "1d6" }]
    }
  ]
  ```

  Divine Favor e Rage são impostos em quem os conjura; Ray of Enfeeblement e Hunter's Mark, no alvo. Hex usa a entrada `damage-taken` da marca com `attacks: "any"` e `damageType: "necrotic"`. Os níveis e os efeitos `worn`, `carried` e `otherwise` de exigência dos itens compartilham esses modificadores. O menu de ataque só conta os próprios acréscimos e multiplicadores de quem a porta; a marca de um alvo nunca é prometida ali. Os resumos da ficha e do prompt descrevem os modificadores de dano próprios de quem a porta, e a visão da batalha também descreve os recebidos. Pacotes que usam qualquer um dos dois alvos exigem schemaVersion 2 e capabilityApi 1.133 ou mais recente, inclusive quando o item fica num arquivo de catálogo separado.

  **Números que uma condição altera.** Cada entrada em `modifiers` nomeia o que altera, `to`, e em quanto:
  - `defense`: o número que um ataque contra quem a porta precisa alcançar. Só um número fixo.
  - `attacks`, `saves`, `checks`: as próprias rolagens de ataque, salvaguardas e testes de disputa de quem a porta. Um número fixo, ou `dice` rolados toda vez que a rolagem é feita (`"1d4"`); `minus: true` subtrai os dados em vez de somá-los.
  - `speed`: quanto quem a porta anda, na sua própria unidade de distância (`flat`), ou `times` 0.5 ou 2 para metade ou o dobro, aplicado depois de toda mudança fixa. Lido só num tabuleiro, como `speed-zero`.
  - `health-max`: `times` 0.5 e nada mais reduz à metade o máximo de saúde de quem a porta, arredondado para baixo e nunca abaixo de 1 (Capability API 1.115). Uma trilha de saúde em casas não tem máximo para reduzir à metade. A saúde acima do máximo reduzido se perde quando a luta começa, e a cura nunca passa dele.

  Um modificador de `checks` pode nomear as próprias `skills`, e um de `saves` as próprias `saves`, que o restringem no lugar das da condição. Qualquer um deles pode rolar duas vezes com `mode: "advantage"` ou `"disadvantage"`, contado junto com os efeitos de mesmo nome e se anulando como eles, com ou sem um número ao lado; assim, uma condição pode tornar Sneak mais difícil e Climb mais fácil ao mesmo tempo. Essas três chaves exigem Capability API 1.53.

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  Um número fixo carrega o próprio sinal, e 0 é recusado. Todo modificador aparece no registro ao lado da rolagem que alterou, com o nome da condição ("12 + 5 + 3 (Blessed) = 20"), e a chance de acertar e a chance de vencer do menu o levam em conta. Condições se acumulam umas com as outras; a mesma condição duas vezes continua sendo uma condição.

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels`: opcional. Níveis de uma trilha viva que contam como condições enquanto a trilha estiver alta o bastante, que é como se expressa uma condição que piora em etapas, como a exaustão. Cada entrada nomeia uma `track` comum (não uma trilha de ferimentos), o nível `at` em que começa e o que faz, com os mesmos `effects`, `modifiers`, `failsSaves`, `saves` e `skills` de uma condição. Todo nível que a trilha atingiu conta, então eles se somam conforme ela sobe. Um nível não tem origem e só termina quando o que ele lê diminui, então `half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side` e `cannot-approach-source` são recusados num nível. Só um combatente com ficha tem trilhas. O registro nomeia um nível pela trilha e pelo número ("- 1 (Heat 3)").

  No lugar de `track`, um nível pode ler um valor `derived` (Capability API 1.54), calculado com o estado vivo e os itens do personagem, para que ninguém precise marcar nada: Ember Roads deixa mais lento qualquer um que carregue 10 de volume ou mais.

  ```json
  {
    "derived": "bulk_carried",
    "at": 10,
    "modifiers": [
      { "to": "speed", "flat": -2 },
      { "to": "checks", "skills": ["sneak"], "flat": -1 }
    ]
  }
  ```

  Um limiar que muda de um personagem para outro (mais de cinco vezes a Força, por exemplo) é um valor derivado que o subtrai: `scale` por -1 dá a parte a tirar, e uma `sum` das duas é o que o nível lê.

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] },
    { "track": "exhaustion", "at": 4, "modifiers": [{ "to": "health-max", "times": 0.5 }] },
    { "track": "exhaustion", "at": 5, "effects": ["speed-zero"] },
    { "track": "exhaustion", "at": 6, "defeats": true }
  ]
  ```

  `"defeats": true` tira quem o tem da luta de vez quando ela começa, antes de qualquer um se mover (Capability API 1.115). Ele e a saúde perdida por um máximo reduzido à metade são resolvidos uma única vez, quando a luta começa; todos os outros níveis são lidos sempre que o número que mudam é lido.

  Os oponentes também têm trilhas (Capability API 1.115). Um sem ficha começa nas `tracks` que lhe são dadas, pelos IDs das suas trilhas: uma criatura que o Game Master propõe pode nomeá-las (`"tracks": { "exhaustion": 2 }`), e um oponente do bestiário colocado numa luta também. Os `conditionImmunities` de uma criatura podem nomear uma trilha que um nível lê, e então nenhum dos níveis dessa trilha a afeta, com ficha ou não: os mortos-vivos e os constructos de 5e, imunes à exaustão.

  Modificadores, níveis e os efeitos de teste exigem Capability API 1.45.

- `checks` e `contests`: opcionais. O que uma disputa lê e as disputas que qualquer um numa luta pode iniciar: agarrar, empurrar, se soltar. Veja Disputas, abaixo. Capability API 1.43.
- `concentration`: opcional. Campo vivo `text` que registra o efeito mantido, `save` exigida pelo dano, `floor` mínimo da dificuldade e `fromDamage`, proporção do dano que a define quando maior. Iniciar outra habilidade de concentração termina a primeira; falhar a salvaguarda a encerra e remove as condições mantidas por ela.
- `dying`: opcional, `kind: "saves"`. Duas trilhas que contam as rolagens (a quantidade necessária é o máximo de cada uma), `dice`, `succeedAt`, efeitos das faces extremas (`naturals.max`: `revive-1` ou `success`; `naturals.min`: `one-failure` ou `two-failures`), custo de dano enquanto caído (`damageWhileDown`, `criticalWhileDown`) e `condition` do personagem caído. Sem o bloco, saúde zero só o deixa caído e cura o traz de volta.
- `damageTypes`: opcional. Tipos do sistema, comparados sem distinguir maiúsculas.
- `damageKinds`: obrigatório se `health` nomeia uma trilha de ferimentos e recusado para uma reserva, pois só uma marca mantém um tipo. Define quais `kinds` o golpe marca e quantas casas. `default` recebe o que não foi mapeado, inclusive dano sem tipo; `byType` mapeia `damageTypes` para tipos de marca, ignorando maiúsculas: `"Fire"` e `"fire"` são uma chave e declarar ambas é recusado. `marks` não tem padrão porque as respostas são opostas: `"per-point"` conta níveis de saúde pelo dano, então três de dano marcam três casas e reduzi-lo ajuda; `"per-blow"` marca uma casa se o golpe acerta, qualquer que seja a força. Um golpe com várias cláusulas ainda marca uma casa, usando o tipo mais grave que entrou. Informe qual seu sistema usa: `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool`: obrigatório em `dice-pool` e recusado em `attack-vs-defense`. Veja Uma luta em reservas de dados.
- `spendLimits`: opcional. Quanto de uma reserva viva um combatente pode gastar por `turn` ou por `round` numa luta, seja qual for o tipo: `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max` é lido uma vez quando a luta começa. Um custo além do que resta do limite não pode ser pago, então fica fora do menu, por mais que haja na reserva. Um limite por turno recomeça no início do próprio turno de quem o tem, e um por rodada quando a rodada começa. Um oponente escrito com números simples não paga nada de uma ficha, então um limite nunca o restringe; um oponente escrito como ficha paga das próprias reservas e fica sujeito ao limite como qualquer outro. Capability API 1.47.
- `threat`: opcional e necessário para bestiários. `tiers` é a escala de oponentes: ID, rótulo, faixa `health`, `defense`, `toHit`, faixa `damagePerRound` e `saveDifficulty`. Toda criatura nomeia um patamar; um oponente não escrito é ajustado ao que o GM pediu, sem sair da escala. `damagePerRound` expressa o que causa a UM alvo por rodada, incluindo toda a sequência.

### Salvaguardas contra condições, dano ou magia (Capability API 1.134)

Um modificador com `to: "saves"` pode ter `against`. Ele precisa de pelo menos um entre `conditions` (IDs de condição da ficha), `damage` (tipos de dano) ou `magic: true`. Basta uma correspondência; `saves` continua restringindo qual salvaguarda, como um E lógico. Use o `mode: "advantage"` do modificador, não `effects`, para restringir a vantagem dessa forma. Esses modificadores funcionam em condições, em níveis de trilha atingidos ou derivados e em efeitos de itens. Para características de raça, derive um valor a partir da raça escolhida na ficha e associe o modificador a um nível atingido quando esse valor é 1. Exemplos de modificadores:

```json
[
  {
    "$comment": "Dwarven Resilience",
    "to": "saves",
    "mode": "advantage",
    "against": { "conditions": ["poisoned"], "damage": ["poison"] }
  },
  { "$comment": "Fey Ancestry", "to": "saves", "mode": "advantage", "against": { "conditions": ["charmed"] } },
  {
    "$comment": "Gnome Cunning",
    "to": "saves",
    "saves": ["int_save", "wis_save", "cha_save"],
    "mode": "advantage",
    "against": { "magic": true }
  }
]
```

Brave usa `conditions: ["frightened"]`. Magic Resistance usa `magic: true` sem `saves`, num nível derivado da ficha de uma criatura ou num nível de trilha. O `applies` de uma ação conta mesmo que a salvaguarda impeça a condição; o dano dela inclui todas as cláusulas `plus`. Os nomes de dano são comparados sem distinguir maiúsculas. Magia significa a qualidade `"magical"` da 1.101: o `mechanics.qualities` de um catálogo (mesmo sem dano), o `damage.qualities` de uma ação de criatura ou as tags de um item de arma. Uma magia precisa ter essa qualidade; o nome ou o catálogo dela, sozinhos, não a tornam mágica. Uma salvaguarda para encerrar uma condição, inclusive `saveWhenDamaged` e `saveEnds.at: "damaged"`, é só contra essa condição. As salvaguardas de concentração e contra a morte não são contra nada. Fora do combate, os pedidos de salvaguarda do Game Master não levam origem nem condição estruturadas; `against` nunca coincide com esses pedidos. A ficha, os detalhes do item, os detalhes da batalha e o resumo de ficha do Game Master mostram essas restrições. Exige schemaVersion 2 e capabilityApi 1.134 ou mais recente.

### Uma luta em reservas de dados: `dice-pool`

Um conjunto `dice-pool` conta sucessos em vez de somar dados, e suas lutas também podem fazer isso. `"kind": "dice-pool"` exige que `resolution.kind` seja `"dice-pool"` e lê a ficha como seus testes de reserva já leem: **todo número que uma rolagem soma é uma quantidade de dados, e todo número que ela enfrenta é uma contagem de sucessos.** Então nada é renomeado:

- Um número para acertar (o de uma linha de ataque, o `toHit` de uma lista de habilidades, o de uma ação de criatura) é a reserva que um ataque rola. O dado, o alvo que um dado precisa atingir e as faces em que ele dobra, explode, anula e falha criticamente são os da sua `resolution`. A trilha de ferimentos que seu `resolution.penaltyFrom` nomeia tira sua penalidade da reserva, como faz num teste.
- `defense` é quantos sucessos um ataque precisa, e nunca menos de um. O modificador de `defense` de uma condição, e a cobertura (`cover.bonus` ou `cover.threeQuarters`), somam a ele.
- Cada sucesso além dos necessários adiciona um dado de dano. Uma falha crítica erra, seja o que for que tenha contado. Não há críticos: um acerto forte vale pelos dados extras.
- O número de uma salvaguarda é sua reserva, e sua dificuldade, os sucessos de que precisa. Uma disputa rola o teste de cada lado como reserva, e o lado com mais sucessos vence.
- O modificador de uma condição para ataques, salvaguardas ou testes é uma quantidade de dados somada ou retirada, então é um número `flat`: um modificador rolado (`dice`) é recusado.
- O dano é medido em dados do seu dado: o `dice` de uma quantidade (de uma criatura, de uma entrada) diz quantos, e precisa ser do seu dado, e sua parte `flat` são sucessos automáticos, nunca rolados. A coluna de dados de dano de uma linha de ataque é lida pela contagem, `damage.ability` soma a pontuação daquele atributo em dados, e `damage.bonus` soma sucessos automáticos. `perCostStep` e `scales` somam dados, como sempre. Cura e pontos temporários são quantidades e se somam como antes.
- A iniciativa é uma soma (`initiative.dice` e `modifier`) ou uma reserva, quando você pede uma (`initiative.pool`, abaixo), e uma regra de morte mantém os próprios dados.

O que uma luta de reserva rola além disso é definido pelo bloco `pool`:

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage`: se uma rolagem que pende para um lado é rolada duas vezes, mantendo a que teve mais sucessos (uma falha crítica conta como menos que qualquer rolagem sem falha crítica). Sem isso, uma luta rola uma vez, diga o que disser uma condição.
- `damageTarget`: o alvo por dado contra o qual são rolados os dados de dano e de absorção. É o alvo padrão da sua resolução quando você o omite. Esses dados contam uma vez cada face igual ou superior a ele e nada mais: nada dobra, explode, anula ou falha criticamente neles.
- `soak`: o que um alvo tira do dano de um acerto, por tipo de dano. `all` é uma referência de valor para qualquer tipo, e `byKind`, uma por tipo da sua trilha de saúde, que prevalece sobre `all` para o seu tipo; um tipo que nenhum dos dois nomeia não é absorvido. Com `"roll": true`, o alvo rola essa quantidade de dados contra o alvo de dano, e cada sucesso tira um. Com `"roll": false`, o número sai dos dados de dano antes de serem rolados, então nunca afeta sucessos automáticos, que a absorção rolada tira como qualquer outro. Nada fica abaixo de zero, e nada é rolado para absorver um golpe que não contou nada. Uma criatura define os próprios números como `soak: { "all": 1, "byKind": { "knock": 3 } }`, o que exige que o `soak` do bloco diga como a absorção é feita. Resistência, vulnerabilidade, imunidade e `resist-all` se aplicam depois da absorção, ao que restar.
- `hardness`: uma referência de valor para a dureza de um combatente, quando a iniciativa é um número que os ataques movem. Veja [Armaduras e efeitos de itens vestidos numa luta](#armor-and-worn-effects-in-a-fight).

O dano de cada alvo é rolado para aquele alvo, porque o que um acerto ganhou além dos sucessos necessários, e o que o alvo absorve, são dele. A segunda cláusula de um golpe, e um efeito adicional, são cada um uma reserva de dano própria, do seu tipo, sem dados extras do acerto. O menu prevê uma reserva com exatidão: a chance de alcançar os sucessos necessários e quanto valem os dados de dano depois do que o primeiro alvo absorve.

Gravewatch é escrito assim: seus guardiões rolam uma pontuação e um ofício, absorvem pancadas com Sinew e não absorvem rasgos, podem gastar um ponto de Resolve por turno e rolam a iniciativa de novo a cada rodada.

**Declarar em ordem inversa não está implementado.** Alguns sistemas fazem todos declararem sua ação antes de qualquer um agir, do mais lento ao mais rápido. Numa luta em que cada combatente escolhe uma ação quando chega seu turno, declarar primeiro não muda nada que alguma regra leia, então não há nada que uma chave possa dizer.

### Dados mínimos de dano (Capability API 1.146)

Uma luta de reserva pode manter dados mesmo contra uma absorção alta, como faz o **Overwhelming** de Exalted:

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

Isso é `combat.damage.minimum`, uma referência de valor lida da ficha atual do **atacante**. Depois que a absorção fixa tira dados da primeira reserva de dano de um acerto, a reserva é elevada a pelo menos esse número. São dados inteiros, arredondados para baixo e limitados entre zero e `resolution.pool.max`, não sucessos automáticos: todo dado que sobra pode falhar. A absorção rolada ainda tira sucessos depois da rolagem de dano; ela não reduz uma reserva de dados, então o mínimo não protege os sucessos dela. Resistência e imunidade continuam valendo. Golpes que gastam iniciativa ignoram o mínimo, assim como ignoram o dano da arma e a absorção; golpes que tomam iniciativa o usam.

Uma arma pode substituir o mínimo comum com `item.attack.damage.minimum`. Ele aceita as mesmas referências de valor de quem a empunha, ou `{ "stat": "overwhelming" }` para uma das estatísticas numéricas do próprio item. Um zero declarado também substitui o mínimo comum. Isso é diferente do `floor` de arma existente, que garante uma quantidade de dano depois da absorção. Cláusulas de dano extras e efeitos adicionais não recebem outro mínimo. Os dados salvos da luta e o registro mostram o mínimo resolvido ao lado dos dados. Tanto a chave de combate quanto a chave de arma exigem **Capability API 1.146** num pacote, inclusive para armas em arquivos de catálogo externos.

### Um acerto que atordoa (Capability API 1.147)

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze` serve para lutas de reserva. `over` lê a ficha atual do **alvo**, imediatamente antes do acerto. Um único acerto precisa causar **estritamente mais** dano do que esse número, depois da absorção, das salvaguardas e da resistência. As cláusulas de dano dele contam juntas; acertos separados nunca se acumulam para atordoar. Numa trilha que marca por golpe, um acerto que causa dano conta como um nível. Um golpe que toma iniciativa em vez de saúde não pode atordoar. `measure` hoje só pode ser `"damage"`.

O alvo perde exatamente o próximo turno. Outros acertos que atordoam antes desse turno não acumulam turnos perdidos a mais. O turno perdido ainda faz avançar os relógios das condições e o resto da contabilidade do turno, inclusive as mudanças de rodada e a iniciativa rolada de novo. Salvar e recarregar a luta preserva o turno perdido pendente. `condition`, quando presente, nomeia uma condição declarada da ficha. A luta a marca até o turno perdido passar, ou até a luta terminar. Uma condição que já está presente fica onde está; a imunidade à condição impede a marca, mas não impede a perda do turno. `text` é uma narração opcional, não outro efeito. O registro e o contexto da luta do Game Master registram o acerto e o turno perdido. A chave exige **Capability API 1.147**.

### O alvo escolhe o tipo de ferimento (Capability API 1.148)

Acrescente `remap` ao mapeamento `combat.damageKinds` existente; mantenha seus `default`, `byType` e `marks`:

```json
"damageKinds": {
  "default": "bashing",
  "byType": { "bullet": "lethal", "fire": "aggravated" },
  "marks": "per-point",
  "remap": [
    { "when": { "field": "vampire" }, "from": "lethal", "to": "bashing", "tags": ["firearm"] }
  ]
}
```

Uma luta de reserva primeiro escolhe o tipo do ataque pelo mapeamento comum e depois lê o `when` de cada remapeamento no **alvo**. Um número diferente de zero ativa a regra. `from` e `to` precisam ser os dois tipos da trilha de ferimentos de saúde. A primeira regra que corresponde vence; os remapeamentos não se encadeiam. Podem ser dados no máximo 12. Com `tags`, pelo menos uma precisa corresponder ao ataque: uma arma já leva `item.tags`, e as mecânicas de catálogo e o dano de criatura já levam `qualities`. Esses nomes vêm de `items.tags`. Sem `tags`, qualquer ataque desse tipo pode corresponder. Nenhum campo novo de tag de ataque é necessário.

O tipo resultante decide tanto a **absorção** quanto as marcas de ferimento. Assim, o acerto letal de uma arma de fogo pode virar contundente contra um vampiro e usar a absorção de contundente; a mesma arma de fogo contra outra pessoa, ou uma lâmina contra esse vampiro, mantém o tipo comum. O _tipo_ de dano original do ataque não muda para resistência e imunidade. Cada cláusula de dano usa o próprio tipo e as tags do ataque. Os dados salvos da luta e o registro mostram os tipos original e remapeado, e a previsão de dano lê a mesma regra. Uma criatura simples sem ficha pode satisfazer uma referência constante, mas não pode fornecer valores de ficha para essas regras; dê a ela uma ficha de criatura para isso. Só a nova chave `remap` exige **Capability API 1.148**; os mapeamentos de tipo de dano mais antigos mantêm a compatibilidade atual.

### Iniciativa que os ataques movem

Alguns sistemas de reserva mantêm a iniciativa como um número durante a luta inteira e deixam os ataques movê-lo: uma forma de atacar a tira do alvo, outra gasta a do próprio atacante como dano, e quem cai até uma linha definida entra em colapso. Uma luta `dice-pool` pode declarar isso (Capability API 1.48):

```json
"initiative": {
  "pool": { "abilityMod": "nerve" },
  "plus": 3,
  "resource": {
    "base": 3,
    "styles": [
      { "id": "press", "label": "Press", "takes": { "gain": 1 } },
      { "id": "telling", "label": "Telling blow", "spends": { "onMiss": [[0, 1], [6, 2], [11, 3]] } }
    ],
    "crash": { "at": 0, "condition": "reeling", "bonus": 5, "recoverAfter": 3 }
  }
}
```

- **A abertura.** Todos rolam `pool` dados quando a luta começa, e os sucessos mais `plus` são o seu número; por isso `resource` exige `pool`: dados somados são uma ordem, não uma quantidade de dados. O `initiativeModifier` de uma criatura é sua reserva, já que todo número que uma luta de reserva soma é em dados. O número é mantido: nunca é rolado de novo (`each` é recusado ao lado de `resource`), e no início de cada rodada a ordem é organizada pelos números como estiverem.
- **Estilos.** Todo ataque (uma linha de ataque, uma habilidade ou entrada de catálogo que rola para acertar e causa dano, uma ação de criatura que faz isso e uma ação feita de outras ações) é oferecido uma vez por estilo, e o jogador escolhe o estilo antes do alvo. Até quatro, cada um toma ou gasta, e pelo menos um toma. Uma escolha que não nomeia estilo é feita no primeiro; uma num estilo em que o ataque não é oferecido é recusada. Um ataque mantém o estilo em que foi feito até terminar, mesmo quando uma resposta muda o número de quem o fez antes que ele acerte.
- **Um estilo que toma.** Num acerto, o dano é rolado como de costume (os dados extras do acerto, os dados da arma, a absorção por tipo, os sucessos automáticos), e o que ele conta sai do número do alvo em vez da saúde dele. O atacante ganha tudo isso mais `gain`.
- **Um estilo que gasta.** Oferecido só enquanto o número do atacante está acima da linha de colapso (0 quando você não define `crash`), e nunca para uma ação feita de outras ações, já que um número é gasto num único golpe. Num acerto, o dano é o número do atacante no momento do ataque, em dados contra o alvo de dano, e nada mais: sem dados da arma, sem dados extras do acerto, sem sucessos automáticos, sem absorção. Ele marca a saúde pelo próprio tipo de dano do ataque. Quando o ataque termina, um número que acertou alguém volta para `base`, e um que não acertou ninguém perde o que `onMiss` diz para o número com que foi feito (uma tabela de patamares: pares `[at least, lose]`, em ordem crescente; nada abaixo do primeiro patamar).
- **Colapso.** Um número que cai até `crash.at` ou abaixo entra em colapso: a `condition` (uma das suas, e opcional) é imposta a quem o tem, e quem o levou até ali ganha `bonus`. Um erro que leva o próprio autor ao colapso não dá bônus a ninguém. Um combatente em colapso não pode gastar. O colapso termina, com condição e tudo, quando o número dele volta a ficar acima da linha, depois de `recoverAfter` dos próprios turnos (o número volta para `base` no início desse turno) e quando a luta termina, seja como for. Quem tem a rolagem de abertura na linha ou abaixo começa a luta em colapso. `base` precisa ficar acima de `crash.at`, ou voltar a ela causaria um novo colapso.

O menu mostra a previsão de cada estilo: a chance de acertar e o que um estilo que toma tomaria ou o dano que um que gasta causaria. O painel de status mostra o número de todos, e o registro diz cada mudança e o motivo: "Ada gains 5 initiative for crashing Rats, and is on 14." O seletor do Engine avalia um golpe que toma com um turno de antecedência: tomar e depois gastar, contra gastar agora e de novo a partir da base.

<a id="what-a-fight-reads-from-mechanics"></a>

### O que um combate lê de `mechanics`

`kind` determina se `amount` é dano ou cura; qualquer entrada marcada como `reaction` fica fora do menu, assim como uma entrada `utility`, a menos que ela mude o que o próprio turno pode conter (veja abaixo). `attackRoll` faz uma rolagem contra a defesa do alvo com o `toHit` da lista; `autoHit` pula isso inteiramente. `save` rola a salvaguarda do próprio alvo contra a `saveDifficulty` da lista, e `onSuccess` determina se um sucesso recebe metade ou nada. `targetCount` indica quantos alvos ela pode atingir. Uma habilidade que não rola ataque (uma área contra a qual todos fazem salvaguardas, algo que simplesmente acerta) rola seus dados UMA VEZ para todos eles; uma que rola para acertar cada alvo rola seus dados novamente a cada acerto. `applies` impõe condições ao que afeta, cada uma com uma `duration` de `instant` (sem relógio próprio: permanece até que algo a remova), `until-save` (que precisa de `saveEnds` ao lado) ou `{ "rounds": n }`, e um `saveEnds` opcional que nomeia a salvaguarda e indica se ela se repete em `turn-end` ou `turn-start`. As rodadas contam os próprios turnos de quem a porta, diminuindo ao fim de cada um; `{ "rounds": 1, "at": "turn-start" }` as conta no início de cada um, que é como se diz até o início do seu próximo turno. `"of": "source"` (Capability API 1.119) conta os turnos de quem a impôs, a partir do próximo dessa pessoa, que é como se diz "até o fim do seu próximo turno" a respeito de outra pessoa. O `{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }` de Guiding Bolt dá vantagem à próxima rolagem de ataque contra o alvo antes do fim do próximo turno do conjurador. Se a origem sair da luta, as rodadas passam a contar nos turnos do próprio portador. O `delays` de uma condição de combate (Capability API 1.120) adia o que quem a porta usa: uma ação de um dos seus `catalogs`, paga com o `budget` dela, rola um dado de `chance.sides` e, com `chance.atLeast` ou mais, ainda não acontece. No início do próximo turno de quem a porta, ela é concluída com esse mesmo orçamento e segue como teria seguido, com respostas e tudo, e se a pessoa não puder agir ou não tiver nada desse orçamento, ela se perde. O que ela custou continua gasto de qualquer forma. O Slow de 5e é `"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`. `endsAfter` remove a condição depois do primeiro `own-attack` (a próxima rolagem de ataque de quem a porta), `attacked` (a próxima rolagem de ataque feita contra quem a porta) ou `own-save` (a próxima salvaguarda de quem a porta), diga o que disser o relógio dela; assim, `{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }` significa no próximo ataque, antes do fim do próximo turno. Uma condição que dura um ataque dura o ataque inteiro, inclusive o dano, e uma nova que o mesmo golpe impõe permanece. Ambos exigem Capability API 1.45. `temporary` concede pontos temporários à reserva de saúde, e eles nunca se acumulam: permanece a maior proteção. `scales` aumenta a quantidade pelos DADOS extras que sua tabela indica para o valor lido. `cost` é pago pelo comando `use` da própria ficha, e `budget` substitui qual parte da economia é gasta.

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
    "when": ["advantage", "ally-adjacent-no-disadvantage"],
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

`sources` nomeia as listas de ataques de onde ela vem e `requires` uma coluna verdadeira de suas linhas, de modo que um efeito adicional que só dispara com certas armas pode especificá-las sem que o Engine saiba o que é uma arma; não nomear nenhum significa qualquer acerto de seu portador. Uma arma empunhada tirada da bolsa não é uma linha, então `weapons` (Capability API 1.70) também nomeia as tags de item com que ele dispara: `"weapons": { "tags": ["finesse", "ranged"] }` dispara num acerto com uma arma empunhada que tenha qualquer uma das tags, inclusive o golpe com a mão inábil. Nomear só `weapons` não dispara com nenhuma linha, e nomear só linhas não dispara com nenhuma arma empunhada. `when` aceita QUALQUER das opções: `advantage` é a inclinação final da rolagem de ataque, e `ally-adjacent` é um aliado do atacante que esteja de pé e possa agir, a uma célula do alvo em um tabuleiro ou em qualquer lugar sem tabuleiro. `ally-adjacent-no-disadvantage` (Capability API 1.126) também exige que a rolagem final não esteja com desvantagem depois que vantagem e desvantagem se anulam; o exemplo acima o usa para Sneak Attack. `oncePer` é `turn` (renovado no começo de todos os turnos, de modo que um golpe desferido enquanto outra pessoa age ainda pode carregar um) ou `round`. `amount` cresce com o `scales` da própria entrada, e `type` é o tipo de dano, por padrão o do próprio golpe.

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

Os números abaixo são a maneira direta de escrever uma criatura. Uma escrita nos termos do seu próprio conjunto de regras, como `sheet`, obtém `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`, `checks`, `soak` e `hardness` dessa ficha (veja "Uma criatura escrita nos termos do seu conjunto de regras", abaixo).

- `health`: um número, ou `{ "dice": "3d6", "flat": 2 }`, rolado uma vez quando o combate é criado. Uma previsão lê a média, para que um menu nunca prometa um dado que ninguém rolou.
- `defense`, `initiativeModifier`, `speed`: contra o que um ataque é rolado, o que é somado à iniciativa (ou, quando a iniciativa é rolada como reserva, quantos dados ela rola) e quanto ela anda em um turno, na sua própria unidade de distância.
- `abilities` e `saves`: usam como chaves os identificadores de atributos e salvaguardas que sua ficha declara. Uma salvaguarda ausente é lida como zero.
- `checks`: o que ela soma numa disputa, com os IDs de `combat.checks` como chaves. Um que ela não nomeia é lido como zero. Capability API 1.43.
- `soak`: só numa luta `dice-pool`, o que ela absorve: `all` para qualquer dano, `byKind` para um tipo da sua trilha de saúde. Capability API 1.47.
- `hardness`: quando a iniciativa é um número que os ataques movem, um golpe que gasta cujos dados ficam abaixo dela não faz nada. Capability API 1.56.
- `speeds` e `hover`: como ela se move além de andar (veja Outras formas de se mover, em Posições). Capability API 1.113.
- `shield: true`: as mãos dela estão ocupadas, então a alternativa `twoHanded` de uma ação não vale. Capability API 1.102.
- `size`: um dos `combat.sizes`, pelo ID, que o `maxSizeAbove` de uma disputa lê (veja Tamanhos e CDs de fuga). Capability API 1.103.
- `type` e `tags`: um dos `combat.creatureTypes.types` e até oito das `tags` dele, pelo ID, que os testes de alvo leem (veja Tipos de criatura e testes de alvo). Capability API 1.168.
- `resist`, `vulnerable`, `immune`: tipos de dano, comparados sem distinguir maiúsculas, e validados contra `combat.damageTypes` quando você declara algum. Uma entrada `resist` ou `immune` também pode dizer o que a atravessa, `{ "type": "tearing", "except": ["silver"] }`: um golpe de uma arma que tenha uma dessas tags de item é recebido por inteiro (Capability API 1.55, veja [Armas numa luta](#weapons-in-a-fight)), assim como uma ação cujo `damage.qualities`, ou uma entrada de catálogo cujo `mechanics.qualities`, nomeie uma delas (Capability API 1.101). `conditionImmunities` nomeia suas próprias condições, ou uma trilha que seus `combat.levels` leem (Capability API 1.115).
- `tier`: a qual degrau de `combat.threat` ela pertence.
- `loot` (Capability API 1.63): o ID da tabela de loot que uma luta vencida rola para ela (veja Loot, acima).
- `traits`: pares curtos de nome e texto mostrados ao Game Master. Nunca são resolvidos; portanto, qualquer coisa com números pertence a uma ação.
- `signaturePoints`: pontos devolvidos no início do próprio turno, gastos em ações `signature`.
- `riders`: até quatro, iguais ao `rider` de uma entrada de catálogo, escritos no bloco. Cada um é `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, com um `type` opcional e um `actions` opcional que nomeia em quais ações do próprio bloco ele dispara. O efeito adicional de um bloco não lê listas de ficha; por isso, `sources` e `requires` são as duas chaves que ele não possui. Uma criatura escrita como ficha recebe os efeitos adicionais de suas listas, exatamente como um personagem.
- `actions`: até doze, cada uma com seu próprio `id`. Uma ação carrega o que um bloco de estatísticas escrito à mão carrega (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), mais quatro coisas exclusivas das criaturas. `reach` indica até onde ela golpeia, `range` até onde é arremessada ou disparada e `area` a forma em que atinge, tudo na sua própria unidade de distância; `range` pode ser um número simples ou `{ "normal": 30, "long": 120 }` quando ainda alcança mais longe com uma penalidade, e `area` é `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (veja Posições):
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. Quando se esgotam, a ação sai do menu.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Ela começa o combate disponível, é gasta ao ser usada e rola no início do próprio turno da criatura: `from` ou mais a recupera. O registro contém os dados nos dois casos.
  - `damage.alternatives` (Capability API 1.102): até quatro quantidades que ela causa no lugar da primeira, cada uma `{ "when": ..., "dice": "1d10", "flat": 3 }`, vencendo a primeira que valer. O tipo, as cláusulas e as qualidades continuam sendo os da ação. `"when": "twoHanded"` vale a menos que a criatura tenha `"shield": true`, que é o "or 8 (1d10 + 3) slashing damage if used with two hands" de 5e; `"when": { "selfHealthAtMost": 0.5 }` vale enquanto a saúde dela for no máximo essa fração do máximo, que é o "or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer" de um enxame. A previsão do menu e o golpe a leem como está.
  - `sequence`: outras ações do mesmo bloco, em ordem, cada uma com seu próprio alvo. **É assim que se escreve uma criatura que golpeia duas vezes em uma ação.** Um orçamento paga a sequência inteira. Uma sequência não carrega nada próprio e nunca pode nomear outra sequência.
  - `signature`: `{ "cost": n }`, comprada com os pontos da própria criatura em vez de um orçamento e apenas enquanto outra pessoa age: o combate a oferece na janela entre um turno e o seguinte (veja Janelas).
  - `reaction`: o mesmo objeto que o `mechanics.reaction` de uma entrada de catálogo (veja Janelas): a ação não aparece no menu de nenhum turno e é oferecida no momento que ela nomeia. Uma reação não é também uma ação característica, e nenhuma sequência pode incluir uma.
  - `self: true`: ela atinge a própria criatura em vez de outra pessoa, e por isso não aceita `targetCount` nem `area`. Ambos exigem Capability API 1.46. Um Parry é as duas coisas, com uma condição `parrying` que soma 2 à defesa:

    ```json
    {
      "id": "parry",
      "name": "Parry",
      "budget": "reaction",
      "self": true,
      "reaction": { "on": "hit" },
      "applies": [{ "condition": "parrying", "duration": { "rounds": 1 }, "endsAfter": "attacked" }]
    }
    ```

- Uma salvaguarda precisa de uma dificuldade na própria ação: `save.difficulty` para uma salvaguarda imposta pela ação, ou `saveDifficulty` para uma condição que termina com uma salvaguarda quando a ação não tem a sua própria. Uma ação de bloco é escrita com números simples mesmo em uma criatura com ficha; portanto, esse número fica na ação. A salvaguarda de uma cláusula pode omitir sua `difficulty` e recorrer ao mesmo número.
- `damage.plus` é a mesma lista de cláusulas que o `plus` de uma entrada de catálogo e é lida exatamente da mesma forma: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` é uma mordida cujo calor tem sua própria quantidade, resistida e dobrada separadamente.

Uma ação de criatura pode devolver pontos de vida com `heal` (dados, um valor fixo ou os dois), limitados ao máximo do alvo. `targets: "ally"` alcança o próprio lado, inclusive a si mesma; `targets: "any"` alcança qualquer lado. Sem `targets`, ela alcança o outro lado, como antes. Essas chaves exigem Capability API 1.121. Uma cura não leva `damage`, `toHit`, `save` nem `area`; `targets` não aceita `self` nem `sequence`, e uma sequência não leva nenhuma das duas chaves. O Healing Touch de um deva é:

```json
{
  "id": "healing_touch",
  "name": "Healing Touch",
  "budget": "action",
  "heal": { "dice": "4d8", "flat": 2 },
  "targets": "ally",
  "uses": { "per": "day", "count": 3 }
}
```

O `spellcasting` de uma criatura (Capability API 1.123) conjura magias de catálogo sem gastar espaços nem pontos. Seus `saveDifficulty` e `toHit` fornecem os números da magia; uma criatura com `sheet` pode omiti-los para usar os números de conjuração da ficha. Uma criatura simples precisa fornecer todo número de que suas magias precisam. Cada `entry` nomeia uma entrada de catálogo existente com `mechanics`. `uses` omitido significa à vontade; `level` é o nível de conjuração para a escala de `perCostStep`, ou a base da entrada quando omitido. A entrada ainda fornece orçamento, alvos, concentração, reações, áreas e invocações. A lista de uma dríade poderia ser escrita assim; esses IDs de magia são ilustrativos e precisam ser fornecidos num catálogo `spells`:

```json
"spellcasting": {
  "saveDifficulty": 14,
  "spells": [
    { "entry": "spells/druidcraft" },
    { "entry": "spells/entangle", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/goodberry", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/barkskin", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/pass-without-trace", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/shillelagh", "uses": { "per": "day", "count": 1 } }
  ]
}
```

Para um coven de bruxas, acrescente `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }` ao lado de `spells` e `"coven": true` em cada magia compartilhada. Essas magias só são oferecidas enquanto pelo menos três combatentes de pé do lado do conjurador tiverem esse ID de coven, cada um a até 30 unidades de distância do conjunto do conjurador, pela simples distância em células. Sem tabuleiro, todos os membros de pé contam. Os usos de cada magia são uma única reserva compartilhada nesse coven, identificada pelo ID do coven e pela entrada. Um bloco de coven exige uma magia de coven, e uma magia de coven exige o bloco; entradas duplicadas são recusadas. Uma criatura proposta pelo Game Master perde `spellcasting` ao ser ajustada, porque uma escala de ameaça não pode limitar uma lista de magias.

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
- **Cada número tem uma única origem.** Uma criatura com ficha não fornece também `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves` ou `checks`, e o Engine recusa o arquivo se ela fizer isso. Ela pode não ter `actions` próprias, pois suas listas definem o que faz. Uma criatura sem ficha ainda fornece os três primeiros e pelo menos uma ação.
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
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
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

**Outras formas de se mover** (Capability API 1.113). Os `speeds` de uma criatura dão como ela se move além de andar, `{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }` na sua unidade, e `"hover": true` diz que um voador não precisa se mover para continuar no ar (exige uma velocidade `fly`). As de um membro do grupo vêm da ficha por `economy.movementModes`, referências de valor com as mesmas chaves, como seriam a velocidade de natação de uma raça ou a velocidade de voo de uma magia; um zero significa que ele não se move dessa forma. `speed` e `economy.movement` continuam sendo a caminhada. Num tabuleiro:

- o deslocamento permitido é o da forma mais rápida com que eles se movem, e cada célula percorrida sai de todas as formas ao mesmo tempo, então uma criatura que anda 30 e voa 60 pode andar 10 e depois voar 40, e nunca andar mais que 30;
- um voador entra em qualquer lugar que não seja sólido por uma célula, inclusive água e um degrau de qualquer altura;
- um nadador atravessa água por uma célula e anda em terra;
- um escalador sobe um degrau de qualquer altura pelo custo do terreno em que pisa;
- a velocidade de um escavador fica registrada para o Game Master e se move como uma caminhada, já que um tabuleiro não tem chão para escavar túneis.

Cada passo é dado da forma mais barata que ainda tenha deslocamento suficiente. Uma luta sem tabuleiro não lê nada disso, e quem só anda se move exatamente como antes.

**Altura de voo** (Capability API 1.114). Num tabuleiro cujo conjunto dá `combat.elevation.levelHeight` e `combat.distance.perCell`, um voador recebe as opções Fly up e Fly down onde está, cada uma custando o equivalente a um nível do seu voo (um nível de 5 pés em células de 5 pés é uma célula). Até 20 níveis acima do chão sobre o qual está. Enquanto está no alto:

- ele só voa, uma célula por passo sobre qualquer coisa que não seja sólida;
- a distância entre ele e qualquer outra pessoa é a maior entre a distância plana e a altura entre os dois, então uma espada com 5 pés de alcance não toca um dragão a 30 pés de altura, e a mordida dele também não toca o cavaleiro;
- ele tem o terreno elevado sobre qualquer um abaixo, como uma colina lhe daria;
- sair do alcance de alguém para quem ele está alto demais não provoca golpe;
- derrubado, deixado caído ou com a velocidade reduzida a zero, ele cai no chão abaixo como `falling` diz, a menos que tenha `hover`.

Voar até um terreno tão alto quanto ele está, ou mais, o faz pousar, como um voador no chão voa até um penhasco. Nenhuma chave nova: um Engine anterior à 1.114 mantém os voadores no chão, então um pacote que depende de altura declara 1.114.

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

Uma ação de criatura também pode carregar a `area` em que atinge, na sua própria unidade: `{ "shape": "cone", "size": 15 }`, com `"friendlyFire": false` para poupar seu lado. É assim que uma arma de sopro se torna um cone real no tabuleiro em vez de um número de alvos. Uma sequência não tem forma própria; as ações que nomeia têm as suas. Um combate sem tabuleiro ignora a forma e usa `targetCount`, de modo que uma entrada de criatura pode carregar ambos e ser fiel nos dois casos.

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

Uma linha no `mechanics.area` de uma entrada ou na `area` de uma ação de criatura pode ter `width`, na mesma unidade de `size`, arredondada para células com mínimo de uma (Capability API 1.128), por exemplo `{ "shape": "line", "size": 60, "width": 10 }` para uma linha de 60 pés com 10 pés de largura; omita-a para uma célula, e uma largura par em células coloca a coluna extra à esquerda do conjurador.

**Linha de visão e cobertura.** Uma linha reta de células entre os dois: uma parede ou uma montanha nela bloqueia um disparo e impede que uma área se espalhe além, e o alvo simplesmente não aparece no menu. A água é vista de um lado a outro: um disparo atravessa um rio, e uma área em linha continua por cima dele. As lutas próprias do Engine usam o mesmo teste de visão.

A cobertura é lida a partir de onde o atacante está, pelas linhas entre cantos da regra opcional de grade do DMG: do melhor canto do atacante, uma linha para cada canto da célula do alvo. Três ou quatro linhas que passam por uma parede ou uma montanha são cobertura de três quartos; qualquer linha que passe por uma delas, ou por um terreno que valha como cobertura (bosques, ruínas), é meia cobertura; terreno baixo sozinho nunca é mais que meia cobertura. Um alvo que o atacante não consegue ver de forma alguma tem cobertura total e não aparece no menu. Contra um ataque, um alvo num terreno que vale como cobertura tem pelo menos meia cobertura, como sempre teve; uma salvaguarda só é ajudada pelo que está entre ela e o efeito.

- `cover.bonus` é o que a meia cobertura soma à defesa contra a qual um ataque é rolado, e o registro diz isso.
- `cover.threeQuarters` (Capability API 1.74) é o que a cobertura de três quartos soma; sem ele, `bonus` vale para as duas.
- `cover.saves` (1.74) nomeia as salvaguardas que a cobertura também ajuda, contra a própria salvaguarda de uma ação (nunca uma salvaguarda que encerra uma condição ou mantém a concentração): a partir de onde uma explosão cai, e a partir de quem a criou para qualquer outra coisa. O registro também diz isso.
- `cover.creatures` (1.74) faz de qualquer um que esteja no caminho meia cobertura, amigo ou inimigo.
- Uma salvaguarda cujo texto diz que o alvo não ganha nada com cobertura (o Sacred Flame de 5e) diz `"ignoresCover": true` (1.74), no `mechanics.save` de uma entrada, no `save` de uma ação de criatura ou no `save` do uso de um item.

**Altura.** Um tabuleiro pode ter altura, até três níveis, e toda luta posicionada anda e vê conforme ela, diga o que disser o conjunto: subir um nível custa uma célula a mais, descer não custa nada, um degrau de dois níveis ou mais é um penhasco por onde ninguém anda (e para onde ninguém é empurrado), e um terreno mais alto que as duas pontas bloqueia a visão. Atirando de cima de um terreno mais alto, a cobertura baixa no meio não esconde nada. Um conjunto diz o que seu sistema acrescenta com `elevation` (Capability API 1.75, e exige `distance`):

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight` é a altura de um nível na distância do próprio conjunto.
- `highGround` é o que golpear de cima de um terreno mais alto dá a uma rolagem de ataque: `"advantage"`, ou `{ "bonus": n }`, tirado da defesa contra a qual o ataque é rolado. Omitido, não dá nada.
- `rangeBonus` é quantas células a mais um disparo alcança de um terreno mais alto.
- `falling` é o que uma queda faz: quem é empurrado de um degrau de dois níveis ou mais cai embaixo e recebe `dice` para cada `per` da queda (níveis vezes `levelHeight`), no máximo `max` dados, do tipo `type`, e depois recebe a condição `prone`, quando houver uma. Os dados são rolados como o sistema rola dano: somados ou, em `dice-pool`, contados como sucessos com a absorção descontada. Uma queda é um golpe como qualquer outro, então pode derrubar alguém ou romper a concentração dele. O registro diz de que altura a pessoa caiu. Sem `falling`, a queda é anotada e não faz nada.

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

O combate acontece na tela de batalha com suas palavras. O menu contém seus ataques, suas habilidades, suas disputas e as ações padrão que você listou, cada uma informando o que gasta dos seus orçamentos e reservas. São mostrados a ordem dos turnos, a rodada, cada condição nomeada com suas rodadas restantes, os pontos temporários, a concentração e os dois contadores da sua regra de morte. O registro imprime a aritmética real nos seus termos: "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Cada ação aceita é gravada na ficha quando acontece; assim, recarregar no meio do combate é exato, e depois o Game Master é instruído a não alterar esses números novamente.

Um combate com posições é desenhado no tabuleiro em vez do palco de retratos; veja Posições para saber o que o jogador faz com ele. Toda distância nele, no menu e no registro, é expressa na SUA unidade: "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Disputas: agarrar, empurrar, se soltar

Alguns movimentos não são um ataque contra uma defesa, mas uma disputa: os dois lados rolam, e quem se sai melhor consegue o que quer. Agarrar alguém, derrubá-lo ou empurrá-lo para longe e se soltar têm todos a mesma forma, então um conjunto de regras declara cada um deles como dados:

```json
"checks": [
  { "id": "brawn", "label": "Brawn", "value": { "abilityMod": "brawn" } },
  { "id": "wits", "label": "Wits", "value": { "abilityMod": "wits" } }
],
"contests": [
  {
    "id": "grab",
    "label": "Grab",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn", "wits"] },
    "onWin": { "applies": [{ "condition": "held" }] }
  },
  {
    "id": "break_free",
    "label": "Break free",
    "budget": "act",
    "attacker": { "checks": ["brawn", "wits"] },
    "defender": { "checks": ["brawn"] },
    "from": { "holding": "held" },
    "onWin": { "ends": [{ "condition": "held", "on": "actor" }] }
  },
  {
    "id": "shove",
    "label": "Shove back",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn"] },
    "ties": "attacker",
    "onWin": { "push": 4 }
  }
]
```

- **`checks`** são os números que uma disputa lê, cada um um valor da ficha, lido uma vez quando a luta começa, como uma defesa ou uma salvaguarda. Uma criatura escrita com números simples define os próprios (`"checks": { "brawn": 2 }`); uma com ficha os lê dela. Até doze.
- **A rolagem.** Os dois lados rolam seus `attackRoll.dice` e somam o melhor dos testes que podem usar ali (`attacker.checks`, `defender.checks`). O maior total vence; um empate fica com o defensor, a menos que `ties` diga `"attacker"`. O registro mostra os dois lados: "Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with Brawn, and wins."
- **Vencer** faz o que `onWin` diz, pelo menos uma coisa:
  - `applies` impõe condições a quem perde, com o vencedor como origem, então uma condição que você marca com `endsWhenSourceDown` termina quando quem está segurando cai. `rounds` dá um relógio à condição; sem isso, ela dura até que algo a encerre.
  - `ends` remove condições do ator ou do alvo.
  - `push` move quem perde diretamente para longe do vencedor, essa distância na sua unidade, parando antes de qualquer coisa sólida, de alguém de pé, da borda do tabuleiro e de um canto apertado demais para passar. É forçado: não gasta movimento de quem é empurrado, e ninguém o golpeia por isso. Uma luta sem tabuleiro não move ninguém. Perder não faz nada, que é o que um agarrão falhado é.
- **`from: { "holding": "held" }`** faz uma disputa mirar só em quem impôs essa condição ao ator e a coloca no menu só enquanto ela vale: é assim que se expressa se soltar.
- **`reach`**, na sua unidade de distância, é até onde ela alcança; a célula vizinha, quando você o omite. `reach` e `push` exigem `combat.distance`.
- **`strike: true`** permite que ela ocupe o lugar de um ataque quando uma ação compra vários, como faz um ataque: escolhida primeiro, gasta o orçamento e deixa o restante dos ataques disponíveis; escolhida com ataques disponíveis, custa um deles. A referência 5e agarra e empurra assim.
- **No menu**, uma disputa tem seu próprio grupo e informa sua chance de vencer. Um oponente jogado pelo Engine a avalia como qualquer outra coisa, mas com moderação: um agarrão ou um empurrão prepara algo, e se soltar vale mais, só enquanto estiver agarrado. Um Game Master que interpreta um oponente escolhe uma no mesmo menu.
- Um oponente que um Game Master inventa tem seus testes limitados ao seu nível, como sua chance de acertar.

Disputas exigem Capability API 1.43 num conjunto empacotado.

<a id="windows-holding-the-fight-open"></a>

### Janelas: manter o combate aberto

Alguns momentos pertencem a alguém que não é quem está agindo. O Engine mantém o combate aberto para essa pessoa em vez de decidir por ela, e essa pausa é uma janela.

Sete coisas abrem uma, e duas vêm do que você já declarou:

- **Alguém se afasta.** Uma caminhada que sai do alcance de um inimigo capaz de golpear para nesse passo e pergunta a ele. Veja Golpes contra quem se afasta, acima.
- **Entre um turno e o próximo.** Quando um turno termina, cada oponente com `signaturePoints` que pode pagar uma de suas próprias ações `signature` é consultado sobre comprá-la, antes do próximo turno começar. Esse é o único momento em que elas são compradas: uma ação característica não aparece no menu de turno de ninguém, nem no próprio.
- **Alguém usa algo.** Antes de resolver, todos do OUTRO lado que possuem uma entrada esperando esse momento são consultados, seja quem for o alvo, desde que essa entrada alcance quem está usando. Uma ação padrão e uma disputa não abrem esse momento.
- **Algo mira em alguém.** Antes de resolver, todos os alvos do OUTRO lado que possuem uma entrada esperando esse momento são consultados. Um amigo curando você não é uma ameaça à qual responder, então a ação de um amigo não abre uma janela.
- **Uma rolagem de ataque acerta alguém.** Antes do dano, quem foi atingido é consultado, quando tem uma entrada esperando esse momento. O que essa pessoa faz em resposta conta para este ataque: veja O momento depois de um acerto, abaixo.
- **Algo feriu alguém.** Depois de resolver, todos que receberam dano e possuem uma entrada esperando ESSE momento são consultados, independentemente de quem causou. Ser ferido é um fato sobre você; uma entrada direcionada de volta a quem causou isso ainda não pode mirar em um amigo.
- **Alguém cai.** Antes do dano e da queda ao chão, para quem tem uma reação que alcança quem cai e permite o lado dele (Capability API 1.124).

- **Alguém começa o turno.** Antes de agir, para uma entrada que o alcança no lado-alvo dela (Capability API 1.131).

As seis últimas são as que uma entrada de catálogo, ou a própria ação de uma criatura, solicita ao nomear o momento que espera. Quando uma ação abre tanto `used` quanto `aimed`, o uso é consultado primeiro; se ninguém o cancelar, os alvos são consultados em seguida, e ela se resolve depois que os dois forem respondidos. Ser atingido é consultado conforme cada uma das suas rolagens acerta, e ser ferido depois que a ação inteira termina.

O que uma janela faz, seja qual for sua origem:

- **Nada mais se move enquanto ela está aberta.** Nem o ator de quem é o turno, nem o fim desse turno, nem outra janela. O combate espera. Uma queda retém a aterrissagem enquanto o passo da ação que a causou termina; outras quedas são consultadas depois.
- **Ela pergunta a um de cada vez**, na ordem dos turnos, uma vez a cada um. Passar sempre é uma resposta e não custa nada. Quem seria consultado e não tem nenhuma opção que possa executar é pulado em vez de consultado.
- **Ela continua exatamente de onde parou.** Uma caminhada termina pelas células restantes, pagando cada uma que realmente cruzou.
- **Quem responde é quem interpreta.** A janela do seu membro do grupo é sua, com a opção e **Pass** ao lado no menu; a de um oponente é respondida por quem o interpreta, e um chefe do Game Master é consultado pelo Game Master, com deixar o momento passar entre as respostas.
- **Ela é salva com o combate.** Uma partida fechada no meio de uma caminhada volta com as mesmas pessoas ainda a consultar e as mesmas células ainda a percorrer.

Você não declara nada para as duas primeiras: um conjunto de regras com `opportunity.budget` recebe uma, um bestiário com `signaturePoints` recebe a outra, e um conjunto de regras sem ambos nunca as vê.

**Indicar qual momento uma entrada espera.** Escreva `mechanics.reaction` como um objeto em vez de `true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` é `used`, `aimed`, `hit`, `harmed`, `falls` ou `turn-start`, e é o que coloca a entrada no menu dessa janela. Esses seis são os únicos momentos que o Engine observa. Uma entrada que ainda diz `"reaction": true` apenas informa que não é executada em um turno; isso não basta para oferecê-la em algum lugar, então ela não aparece em nenhum menu.
- `at` é `source` (o padrão), `target` ou `chosen`. `source` direciona o que é executado a quem causou o momento e preenche o alvo, para que ninguém precise escolher; `chosen` mantém os alvos da própria entrada e pergunta. `target` aponta para a criatura de que o momento trata. Uma resposta a `falls` recai sobre quem ela escolheu entre os que caem.
- `cancels` impede completamente que aconteça o que a janela estava segurando. Só uma entrada `used` ou `aimed` pode declará-lo: um momento que já aconteceu não pode ser cancelado, e um acerto já foi rolado.
- `against` restringe aquilo a que a entrada responde a coisas usadas de certos catálogos: `"against": { "catalogs": ["spells"] }` responde a uma magia e a nada mais. Uma ação sem entrada por trás (uma arma numa lista, a própria ação de uma criatura) não vem de nenhum catálogo, então nunca abre o momento para uma entrada que nomeia catálogos. Omita `against` e a entrada responde a qualquer coisa.

Dê a ela também um `budget`, ou ela gastará o padrão da lista. Uma reação quase sempre gasta um orçamento próprio, o que impede um turno de conter várias.

**Seu custo é gasto antes de consultar qualquer pessoa.** Uma ação cancelada é impedida de acontecer, mas não deixa de ter sido comprada: o orçamento e as reservas já foram gastos. Se seu sistema os reembolsa, ainda não pode expressar isso.

Uma contra-ação se escreve assim e, num tabuleiro, só responde a alguém dentro do próprio `range`:

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**Uma contra-ação que só alcança até certo ponto** (Capability API 1.116). `"upTo": "paid"` numa reação `used` que cancela só impede o que foi pago num nível não maior que o da própria resposta, e `"above": { "check": <value>, "dc": 10 }` é o teste que impede mesmo assim algo maior, contra `dc` mais o nível dele. O Counterspell de 5e, que impede uma magia do nível do seu espaço ou menor e pede um teste de atributo de conjuração contra 10 + o nível da magia acima disso, lançado em nível superior como qualquer magia:

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

O nível de qualquer coisa paga é o nível da reserva de onde saiu: o `level` da própria reserva, um valor lido da ficha de quem a tem, quando ela diz um (os espaços de pacto de 5e, conjurados no nível de espaço do bruxo), e caso contrário o lugar dela no grupo, sendo a primeira reserva o nível 1. Algo que não custou nada, ou que saiu de uma reserva sem grupo, é de nível 0, então toda contra-ação assim o impede. O teste usa os próprios dados da luta com as condições de quem responde sobre testes; uma luta `dice-pool` não tem CD a alcançar e recusa `above`. Uma criatura sem ficha escreve o teste como `{ "const": n }`. O registro diz o nível e a rolagem sempre que a resposta alcança acima de si mesma, e a linha de sempre vem em seguida quando ela o impede. Sem `above`, algo maior simplesmente não é impedido, e o que a resposta custou continua gasto.

**O momento depois de um acerto.** Uma entrada em `hit` é como se expressam Shield, um Parry e Uncanny Dodge. O ataque fica retido depois da rolagem, e quem foi atingido é consultado antes de qualquer dano. O que essa pessoa faz conta para aquele ataque: a rolagem não é feita de novo, mas verificada de novo, contra a defesa dela como estiver agora, então uma condição que soma à defesa pode transformar o acerto em erro, e uma face natural que sempre acerta continua acertando. Uma condição que dura um ataque (`endsAfter: "attacked"`) imposta como resposta cobre este ataque, inclusive o dano, e é consumida por ele, que é como se expressa reduzir à metade o dano daquele ataque: `resist-all` para um ataque.

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

O ataque continua exatamente de onde ficou retido: o restante dos alvos e, para uma ação de criatura feita de outras ações, o restante das partes. Cada rolagem que acerta alguém com essa resposta fica retida na sua vez, e uma luta salva enquanto a janela está aberta volta da mesma forma. Um ataque feito dentro de uma janela (um golpe contra quem se afasta, uma ação característica, uma resposta) nunca fica retido, porque nada aberto dentro de uma janela abre outra. O registro mostra a rolagem e contra o que ela foi feita quando a janela abre e, quando a resposta mudou a defesa, se agora ela erra. Oponentes jogados pelo Engine só usam uma proteção quando ela transforma o acerto em erro.

Um pacote que nomeia um momento precisa da Capability API 1.33, e um que usa `used` ou `against` precisa da 1.44. Um que espera `hit` precisa da 1.46.

**Responder a uma magia pelo nome** (Capability API 1.117). `against` pode nomear `entries` como `<catalog>/<entry>` ao lado de `catalogs`, e qualquer um que corresponda abre o momento. `also` usa a mesma resposta em até mais três momentos, cada um com o próprio `against`. O `noDamageFrom` de uma condição mantém o dano dessas entradas totalmente longe de quem a porta enquanto ela vale, seja qual for o tipo de dano. O Shield de 5e é usado quando um ataque acerta e quando Magic Missile mira o conjurador, e sob ele Magic Missile não faz nada:

```json
"reaction": {
  "on": "hit",
  "also": [{ "on": "aimed", "against": { "entries": ["spells/magic-missile"] } }]
}
```

```json
{
  "condition": "shielded",
  "modifiers": [{ "to": "defense", "flat": 5 }],
  "noDamageFrom": ["spells/magic-missile"]
}
```

Só o primeiro momento pode cancelar, então uma reação que cancela não tem `also`. O catálogo que uma entrada nomeia precisa ser um que o conjunto tenha. Uma entrada que não está nele simplesmente nunca abre o momento. Um golpe evitado dessa forma aparece no registro como um ao qual o alvo é imune.

**Responder só a alguns golpes** (Capability API 1.118). Um momento `hit` pode dizer `"blow": "melee"` ou `"blow": "ranged"`. Um golpe é corpo a corpo enquanto o alvo está ao alcance da arma, então uma adaga arremessada de longe é à distância, e a mesma adaga usada ao lado do alvo é corpo a corpo. Uma arma com alcance e sem distância é sempre corpo a corpo, e uma com distância e sem alcance é sempre à distância. Numa luta sem tabuleiro, uma arma que tem alcance é considerada brandida na mão. `"seesSource": true`, em qualquer momento exceto `falls`, só o abre enquanto quem a tem vê quem o causou. Isso significa uma linha de visão entre os dois no tabuleiro (sem tabuleiro, todos veem todos), e nunca alguém que fez a ação padrão Hide até que ela perca o efeito no início do próximo turno dessa pessoa. O Parry de 5e tem as duas coisas:

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

As duas chaves também podem ser escritas num momento em `also`, e `blow` só num momento `hit`.

**Amparar uma queda** (Capability API 1.124). Uma reação em `falls`, inclusive em `also`, responde a uma criatura que cai de uma borda ou a um voador forçado ao chão, antes de a queda causar dano ou deixá-la caída. O alcance e o lado-alvo dela são verificados em relação a quem cai, e a resposta recai sobre essa criatura. Para Feather Fall, dê à entrada estas mecânicas e declare `feather_falling` nas condições vivas da ficha:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 60,
  "budget": "reaction",
  "cost": [{ "pool": "slots_1", "amount": 1 }],
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

A entrada de `combat.conditions` dela é `{ "condition": "feather_falling", "fallsSafely": true }`. Enquanto vale, essa condição impede o dano da queda e a condição de caído que uma queda aplicaria; ela não remove uma condição que causou a queda. Use `targets: "self"` para uma resposta só à queda do próprio conjurador. Uma queda não tem entrada de origem, então a reação dela não pode ter `cancels`, `blow`, `seesSource` nem `against`. Uma entrada de alvo único pergunta sobre cada queda separadamente. Isso resolve a aterrissagem; não acompanha uma descida lenta.

**Responder por outra criatura** (Capability API 1.131). `for` é `self` por padrão; `ally` exclui quem a tem, enquanto `any` o inclui. Os dois perguntam a quem a tem do lado do alvo dentro do `within` exigido, na unidade de distância do catálogo, e só em `aimed` ou `hit`. Essas chaves também funcionam em cada momento de `also`. `seesSource` ainda exige ver o atacante. Protection impõe `own-attacks-disadvantage` à origem antes de os dados do ataque serem rolados. A duração `this-action` dela termina quando a ação se resolve ou é cancelada. Sem um alcance explícito até a origem, a resposta de um espectador alcança essa origem; `within` mede a distância até a criatura protegida. Declare `protected_attack` na ficha e dê à condição de combate dele esse efeito:

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**Colocar a resposta no alvo.** `at: "target"` se aplica à criatura atacada, enquanto `source` continua sendo o atacante. Shield Guardian representa quem usa o amuleto como um aliado a até 5; `parrying` concede `+2` de defesa. O acerto retido verifica de novo a defesa desse aliado depois da resposta:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 5,
  "budget": "reaction",
  "reaction": { "on": "hit", "for": "ally", "within": 5, "at": "target" },
  "applies": [{ "condition": "parrying", "duration": "this-action" }]
}
```

**No início de um turno.** `on: "turn-start"` pergunta quando uma criatura do lado-alvo da entrada começa o turno dentro do alcance dela, antes que essa criatura aja. Essa criatura é a `source`. Uma entrada nociva responde ao outro lado, e uma entrada benéfica, ao próprio lado. Ela não pode ter `cancels`, `blow`, `against` nem `upTo`. A ação de criatura Unnerving Mask pede uma salvaguarda de Wisdom; uma rodada no relógio da criatura afetada dura este turno inteiro e expira no fim dele (deixe `of: "source"` de fora):

```json
{
  "id": "unnerving_mask",
  "name": "Unnerving Mask",
  "range": 30,
  "budget": "reaction",
  "reaction": { "on": "turn-start", "at": "source", "seesSource": true },
  "save": { "save": "wis_save", "difficulty": 14, "onSuccess": "negates" },
  "applies": [{ "condition": "frightened", "duration": { "rounds": 1 } }]
}
```

**Cancelar com uma salvaguarda.** `cancelSave: { save, dc }` exige `cancels`; quem a tem rola com os modificadores de salvaguarda de costume. O sucesso cancela, a falha deixa a ação original se resolver, e os dois gastam a reação. `against.actions` nomeia de uma a doze ações de bloco de estatísticas, comparando o nome inteiro sem distinguir maiúsculas (no máximo 80 caracteres cada). Rock Catching representa pegar a pedra cancelando o ataque inteiro, inclusive todo o dano dele, e não só o dano contundente. Os IDs de salvaguarda são os do seu conjunto (`dex` aqui; `dex_save` no exemplo de 5e incluído):

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**Amparar várias quedas.** Uma entrada `falls` com `targetCount` maior que um oferece as criaturas elegíveis que caem por causa de um mesmo golpe ou efeito, dentro do alcance e no lado-alvo dela. O menu e o diretor escolhem por padrão todas as elegíveis até a contagem, das mais próximas para as mais distantes; o jogador pode mudar a seleção. Uma queda posterior é um evento separado. Feather Fall usa a mesma condição `fallsSafely` de cima:

```json
{
  "kind": "buff",
  "targets": "ally",
  "targetCount": 5,
  "range": 60,
  "budget": "reaction",
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

### Ainda não

Dito claramente, pois um conjunto de regras não deve prometer o que o Engine não faz:

- **Além do tabuleiro modesto**: não há voo sobre obstáculos, passagem apertada nem montarias. Uma criatura só é movida pela própria caminhada, por um teleporte e pelo que a empurra (uma disputa, uma entrada, a ação de uma criatura ou uma zona). Ninguém arrasta uma criatura que está segurando.
- **Uma disputa é simples.** A rolagem dela não abre janela, mas uma queda que ela cause pode ser respondida.
- **Uma entrada só pode esperar seis momentos**, `used`, `aimed`, `hit`, `harmed`, `falls` e `turn-start` (veja Janelas, acima). São os momentos que o Engine percebe em nome de uma entrada; as outras duas janelas, alguém se afastando e a pausa entre dois turnos, são abertas pelo próprio combate e não são momentos que uma entrada pode solicitar. Não há momento para uma salvaguarda ser rolada nem para uma morte.
- **Sem encadeamento.** O combate mantém uma janela em vez de uma pilha, então nada aberto dentro de uma janela abre outra: uma contra-ação não pode ser anulada por outra, o que uma reação causa não abre outro momento, e um ataque feito dentro de uma janela não fica retido quando acerta. Uma queda que pode ser respondida, causada durante uma janela, fica retida até ela se fechar e depois é consultada na sua vez.
- **Só uma rolagem de ataque é um acerto.** Algo que atinge sem rolagem (dardos que simplesmente acertam, uma área contra a qual todos fazem salvaguardas) não abre o momento `hit`.
- **Modificadores de dano pertencem a acertos de ataque.** Uma resposta pode impor um modificador de dano a quem a tem ou reduzir à metade o dano recebido com `resist-all`; modificadores de dano nunca mudam um efeito que só pede salvaguarda.
- **Nada é reembolsado.** O custo de uma ação cancelada permanece gasto.
- **O que uma condição altera é uma lista fechada.** Defesa, rolagens de ataque, salvaguardas, testes de disputa, velocidade, máximo de saúde, dano causado e dano recebido (o mesmo vale para níveis e efeitos de itens). Modificadores de dano só mudam acertos de ataque; nunca se somam a dano baseado em salvaguarda nem a acertos automáticos.
- **Uma criatura escrita com números simples não tem trilha de ferimentos.** Em um conjunto de regras cuja saúde é uma trilha, essa criatura ainda perde pontos; dê a ela uma `sheet` e os golpes recebidos marcarão casas, mitigados primeiro pelos próprios `resist`, `vulnerable` e `immune`.
- **Um efeito adicional dispara sozinho.** `on` tem um valor, `hit`, então o primeiro acerto qualificado do período o aplica, sem um momento em que você seja consultado sobre gastá-lo.
- **Um número que os ataques movem é simples.** Um golpe que gasta rola o número e nada mais, então nenhuma arma o altera, inclusive seu `floor` (um alvo resistente absorve um golpe que toma, e sua dureza detém um que gasta, mas nada mais reduz nenhum dos dois); um colapso termina depois de um número fixo de turnos, por mais fundo que tenha ido; e um ataque feito numa janela (um golpe contra quem se afasta, uma reação, uma ação característica) é feito no primeiro estilo.
- **Um oponente inventado não absorve nada e não tem dureza.** Uma criatura que o Game Master cria para uma luta fica limitada à sua escala de ameaça, que não diz nada sobre absorção ou dureza, então ela não tem nenhuma das duas.

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
- `currencies` retira moedas: `removeUnits` nomeia moedas individuais, e `removeFamilies`, famílias inteiras. A menor moeda de uma família só sai junto com a família, para que toda família restante ainda possa pagar e dar troco. Enquanto a camada estiver ativa, ninguém recebe, paga com, escolhe ou deixa cair uma moeda retirada, e a linha de moedas a omite. Um preço expresso nela é dito na maior moeda restante que o paga exatamente, pelo mesmo valor: a camada da longa noite de Gravewatch retira a crown, então uma pistola de vigia de 3 crowns custa 15 shillings. Um item cuja família inteira sumiu não tem preço.

**O que uma camada não pode fazer.** Ela não pode adicionar um valor enumerado, campo, perícia, reserva ou descanso, mudar o tipo de resolução, tocar no estado atual ou nos números de combate, nem adicionar uma chamada de modelo. Um valor que uma camada _adicionasse_ seria desconhecido de todos os outros leitores da ficha, então valores só podem ser removidos. Tudo além dessa lista é uma alteração no próprio conjunto de regras ou um segundo conjunto.

**Conflitos.** `conflicts` nomeia camadas que não podem ficar ativas juntas. Basta nomear um lado do par. O assistente desativa o outro interruptor e, se uma escolha salva tiver ambos de alguma forma, a camada declarada **depois** é descartada; assim, as mesmas duas escolhas sempre produzem as mesmas regras.

**Uma ficha que já contém um valor removido o mantém.** Nada reescreve um personagem. O editor simplesmente deixa de oferecer o valor, e um personagem que já o tinha o mostra como é. Desative a camada em uma nova partida e o valor será oferecido de novo. O mesmo vale para uma entrada de catálogo oculta: ela sai do seletor, e uma linha que o jogador já escolheu permanece na ficha. Moedas que uma camada retira e que alguém já carrega continuam na bolsa dessa pessoa.

**Limites.** 12 camadas por conjunto de regras e 4000 caracteres de orientações por camada, contando as duas strings juntas. Um conjunto de regras empacotado que declara `layers`, ou um `gm.worldGuidance` de base, precisa da Capability API 1.25, e um cujas camadas retiram moedas precisa da 1.64. Um conjunto importado é validado pelo Engine que o lê, então não precisa de nada.

**Camadas escritas por outra pessoa** (uma camada de pouca magia para um conjunto de regras que você não escreveu, distribuída no próprio arquivo) virão depois. Hoje, uma camada é distribuída dentro do conjunto de regras ao qual pertence.

<a id="trying-your-ruleset"></a>

## Testar seu conjunto de regras

Conjuntos de regras da comunidade usam o mesmo interruptor dos agentes importados. Abra **Settings** (configurações) > **Advanced** (avançado) > **Danger Zone** (zona de perigo) e confirme que **Allow custom Agent imports** (permitir importações de agentes personalizados) esteja ativado. A importação também precisa de acesso por localhost ou de **Admin Access** (acesso de administrador) configurado.

1. Abra o painel **Agents** (agentes) e escolha o botão **Import agents** (importar agentes), o ícone de download na fileira de botões no topo do painel.
2. Escolha **Game Mode ruleset** (conjunto de regras do modo de jogo) e selecione seu arquivo JSON, ou um arquivo de pacote de conjunto terminado em `.ruleset.json` (veja [Compartilhar seu conjunto de regras](#sharing-your-ruleset)).
3. Leia a revisão. Ela mostra nome, versão, licença, o que o conjunto de regras cobre e o texto do Game Master. Escolha **Import** (importar).

Seu conjunto aparece na seção **Rules** (regras) do painel e na escolha **Rules** do assistente de configuração para novas partidas. Um conjunto importado de um arquivo é classificado como `local/<your id>`, para que nunca seja confundido com um conjunto oficial ou de outra pessoa.

### Alterar um conjunto de regras já importado

Uma versão importada nunca é reescrita. Se você alterar o arquivo e importá-lo novamente com a mesma `version`, a importação será recusada e pedirá que aumente o número. Isso é intencional: uma partida fica vinculada à versão exata em que foi criada, para que uma campanha em andamento nunca acorde com cálculos diferentes.

Portanto, o ciclo durante a elaboração é: editar, aumentar `version`, importar, iniciar uma nova partida. As versões antigas continuam instaladas ao lado da nova até você remover o conjunto de regras da seção **Rules**. Remover um conjunto ainda usado por uma partida faz com que ela informe que o conjunto está ausente até você importá-lo novamente.

Se mudar a estrutura da ficha (adicionar, remover ou renomear elementos), aumente também `sheet.version`. As fichas existentes são lidas com tolerância: valores que a nova ficha desconhece são mantidos, e os ausentes recebem seus padrões.

### Mover valores para novos IDs: `sheet.migrations`

Acrescentar coisas não exige mais nada. Quando uma nova estrutura move um valor para outro lugar (um campo renomeado, um único nível que vira um nível por classe, uma única reserva de dados de vida que vira uma por tipo de dado), diga como em `sheet.migrations` (Capability API 1.77), para que todo personagem feito na estrutura antiga mantenha seus números: na biblioteca, nas partidas, em salvamentos antigos, ramificações e checkpoints, e em cards importados.

```json
"migrations": [
  {
    "from": 3,
    "steps": [
      { "rename": "field", "from": "xp", "to": "experience" },
      {
        "route": "level",
        "by": "class",
        "cases": [
          { "words": ["fighter"], "to": "level_fighter" },
          { "words": ["wizard"], "to": "level_wizard" }
        ],
        "else": "level_other",
        "default": 1
      },
      {
        "routeLive": "pool",
        "from": "hit_dice",
        "cases": ["hit_dice_d6", "hit_dice_d8", "hit_dice_d10", "hit_dice_d12"],
        "else": "hit_dice_d8"
      }
    ]
  }
]
```

- Cada entrada move uma ficha guardada da versão `from` para `from + 1` e é executada, em ordem, para toda ficha guardada nessa versão ou numa anterior. Nunca remova uma depois de publicada: uma ficha guardada há muito tempo ainda precisa dela. Uma versão que só acrescenta não precisa de nenhuma.
- `rename` (um `ability`, `skill`, `save` ou `field`): o valor é copiado para o novo ID. Uma perícia ou salvaguarda leva o bônus junto. Uma renomeação pode continuar uma de uma entrada anterior ou alimentar um campo que um `route` posterior envia adiante; a importação segue a cadeia até onde ela termina.
- `route`: o valor de um campo vai para o campo que o texto de outro campo nomeia. Um caso vence quando as palavras dele aparecem no texto de `by` como palavras inteiras (só letras formam uma palavra, então "Fighter3" nomeia um fighter), sem distinguir maiúsculas, e exatamente um caso vence. Se nenhum vencer, ou vários ("Fighter 3 / Wizard 2", entre os quais um único número não pode ser dividido sem perguntar), ele vai para `else`. `default` substitui o valor numa ficha que nunca o guardou. `by` é um campo que a ficha tem, ou um que uma estrutura anterior renomeou. Os alvos são campos numéricos ou de texto sem padrão, ou com padrão 0 ou vazio: o valor cai num deles e todos os outros mantêm o padrão, então qualquer outro padrão seria lido como um nível que ninguém deu. Um alvo que uma renomeação posterior move adiante é seguido até lá.
- `routeLive` (uma `pool` ou `track` do estado vivo): o valor guardado vai para aquele dos `cases` que a ficha migrada mostra (uma reserva com máximo acima de 0, uma trilha que a ficha não oculta), senão para `else`. As trilhas para onde um valor vai são todas trilhas de ferimentos (ele leva as marcas) ou todas comuns (ele leva o número).
- Toda etapa sobre a construção permanente copia: o valor antigo fica onde estava, então uma versão mais antiga do seu conjunto ainda lê a ficha como lia. Uma etapa nunca sobrescreve um valor que já está no alvo dela.
- A importação recusa uma entrada igual ou acima de `sheet.version`, duas entradas da mesma versão, uma etapa que escreve num ID que a ficha não tem, um caso listado duas vezes e um `rename` ou `routeLive` que lê de um ID que a ficha ainda tem (um ID retirado nunca é usado de novo, e é isso que torna seguro executar essas etapas de novo).
- As fichas são migradas sempre que são lidas, e a nova estrutura é guardada na próxima edição. O estado vivo não tem versão própria, então `routeLive` é executado a cada leitura: a chave antiga é descartada, e o valor dela só se move enquanto a chave nova ainda não existir, então um valor gasto ou recuperado num descanso desde então nunca é sobrescrito. O destino é definido pela primeira gravação depois da atualização: uma ficha corrigida depois (um nível de classe movido à mão) não o move de novo. Uma luta que já estava em andamento quando a nova versão chega ainda termina, como antes.

<a id="sharing-your-ruleset"></a>

## Compartilhar seu conjunto de regras

**Como arquivo.** Envie o arquivo JSON a um amigo. Ele o importa como você fez.

**Como arquivo de pacote.** Um conjunto grande demais para um único arquivo, com catálogos em arquivos próprios, viaja como um único arquivo JSON simples chamado `<name>.ruleset.json`. Ele contém o manifesto do pacote e os documentos do conjunto, cada um com seus bytes exatos em base64:

```json
{
  "format": "marinara-ruleset",
  "version": 1,
  "manifest": { "kind": ["ruleset"], "…": "the package manifest" },
  "files": {
    "ruleset.json": "<base64>",
    "catalogs/spells.json": "<base64>"
  }
}
```

O manifesto lista `ruleset.json` e cada `catalogs/<id>.json` em `contributions.assets.paths` e em `files`, com o tamanho e o sha256 de cada um. Um editor de conjuntos como o Pixelforge cria um. **Import agents** → **Game Mode ruleset** recebe o arquivo e mostra a mesma revisão de um arquivo de conjunto, com cada catálogo e seu número de entradas. Nada nele é compactado, então ele nunca contém mais que o próprio tamanho. Ele é lido como dados e nunca instalado como pacote: é recusado, com o motivo, se contiver qualquer outra coisa (outra chave, qualquer outro arquivo, um documento que não seja base64 estrito ou não seja texto UTF-8), se o manifesto dele for mais que o de um conjunto (qualquer código, permissão ou outra contribuição), se um arquivo não for o que o manifesto lista, se um `$comment` passar de 2.000 caracteres ou `$schema` nomear qualquer coisa além do esquema do próprio Engine, ou se o conjunto ou um catálogo não puder ser lido. Ele é classificado como `local/<its id>`, como um arquivo de conjunto, com no máximo 24 MB e no máximo 12 arquivos de catálogo de 2 MB cada. Uma versão é o conjunto e os catálogos juntos, então um catálogo alterado também exige uma `version` maior. Pacotes de conjunto não são aceitos como zip.

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
