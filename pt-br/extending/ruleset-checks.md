# Testes de conjuntos de regras

Esta página faz parte de [Escrever conjuntos de regras de Game Mode](writing-rulesets.md). Como um conjunto de regras rola um teste ou uma salvaguarda: os cinco tipos de resolução, faixas de resultado, testes que rolam do próprio jeito e gastos ou amuletos que mudam uma rolagem.

<a id="resolution-kinds"></a>

## Tipos de resolução

`resolution.kind` escolhe como rolar um teste. Todos os tipos leem a mesma ficha e compartilham três chaves; as partes do arquivo depois de `resolution` não mudam ao alternar:

- `abilityModifier`: como uma pontuação da ficha vira um número. `identity` usa a própria pontuação; `floorHalfMinusTen` é a regra de 5e; `stepTable` permite definir seus limiares como `[[score, number], ...]`.
- `proficiencyTiers`: níveis de treinamento de uma perícia ou salvaguarda. O primeiro vale para uma perícia não listada. Um nível adiciona `flat`, ou `multiplier` vezes um bônus de proficiência, ou ambos. Se o sistema tem esse bônus, indique a origem com `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: opcional, necessário apenas para um nível que multiplica.

O significado do número depende do tipo: `dice-sum` o soma à rolagem; `dice-pool` e `dice-highest` rolam essa quantidade de dados. `symbol-pool` mantém atributo e treinamento separados para montar e aprimorar dados narrativos.

### `dice-sum`: somar os dados

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

### `dice-pool`: rolar os dados e contá-los

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

### O que o Game Master pode escrever num teste de reserva

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

### `dice-highest`: rolar os dados e ler o maior

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

### `roll-against`: rolar no máximo (ou no mínimo) o número da ficha

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

### `symbol-pool`: rolar dados narrativos e ler os símbolos

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
- `outcomes` pode ler a contagem de sucessos líquidos (`total`) ou `net successes - needed + 1` (`margin`). As faixas continuam decidindo o sucesso da forma de sempre; os símbolos críticos originais continuam marcados. `spend` só compra dados extras de personagem dentro de `pool.max`. Suas lutas usam `symbol-pool` (Capability API 1.382, veja [Uma luta com dados de símbolos](ruleset-combat.md#a-fight-thrown-in-symbol-dice-symbol-pool)); qualquer outro tipo de combate é recusado ao lado dele.
- Fora de um teste, uma partida com esse conjunto de regras pode rolar seus dados por nome: o campo de dados personalizados da barra de digitação e a ferramenta `roll_dice` do Game Master leem `2 ability 1 proficiency vs 2 difficulty` (o `id` ou `label` de cada dado, sem diferenciar maiúsculas de minúsculas) e contam e anulam símbolos como em um teste, sem a ficha, aprimoramentos nem escala de dificuldade. Nenhuma chave é necessária para ativar isso.
- O registro mantém `resolution="sum"`, com `symbols="2s 1a 1t"`, `thrown=` identificando cada dado e `rolls=` guardando sua face, contada a partir de 1. O `symbolDetails` codificado preserva os rótulos, os símbolos das faces e os dois marcadores críticos. `setback` registra os dados de revés independentes realmente acrescentados depois do limite compartilhado de revés, e `upgradeOwn` registra os aprimoramentos adicionais realmente aplicados; acréscimos ignorados ou iguais a zero são omitidos. O cartão e o resumo nomeiam os símbolos líquidos, inclusive um resultado vazio, em vez de somar números de faces. Substituições podem mudar as regras desse tipo, mas não podem substituir `symbols` nem `dice`.

### O que fica fora e por quê

Estas mecânicas ainda precisam de um tipo de resolução próprio:

- **Reservas opostas** resolvem dois personagens ao mesmo tempo; um teste tem um único rolador.
- **Reservas somadas com um dado especial** (como em OpenD6) somam os dados e tratam um deles de forma diferente.

As duas coisas que esse tipo deixava de fora já estão modeladas; a seção sobre gastar para mudar uma rolagem, abaixo, explica como. Uma regra do próprio sistema, "spend a point for a success" ou "spend a point to throw the failures again", é `resolution.spend`. Uma nova rolagem que o sistema concede de graça quando a situação pede é `resolution.reroll`, acima. Uma que pertence a algo escolhido pelo personagem é `mechanics.check` numa entrada de catálogo, paga com o custo da própria entrada.

## Faixas de resultado: mais que sucesso ou falha

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

## Testes que rolam do próprio jeito

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

## Gastar para mudar uma rolagem

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

## Um amuleto que muda uma rolagem

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
