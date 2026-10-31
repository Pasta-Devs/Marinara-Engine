# Pruebas de conjuntos de reglas

Esta página forma parte de [Escribir conjuntos de reglas de Game Mode](writing-rulesets.md). Cómo tira un conjunto de reglas una prueba o una salvación: los cinco tipos de resolución, las franjas de resultado, las pruebas que tiran a su manera y el gasto o los amuletos que cambian una tirada.

<a id="resolution-kinds"></a>

## Tipos de resolución

`resolution.kind` elige cómo tirar. Todos los tipos leen la misma ficha y comparten tres claves; las partes del archivo posteriores a `resolution` no cambian al alternar:

- `abilityModifier`: cómo se convierte una puntuación en un número. `identity` usa la propia puntuación; `floorHalfMinusTen` es la regla de 5e; `stepTable` permite definir umbrales como `[[score, number], ...]`.
- `proficiencyTiers`: niveles de entrenamiento de una habilidad o salvación. El primero se aplica a habilidades no incluidas. Cada nivel añade `flat`, o `multiplier` por la bonificación de competencia, o ambos. Si el sistema tiene esa bonificación, indica su origen con `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: opcional; solo se necesita para un nivel que multiplica.

El significado del número depende del tipo: `dice-sum` lo suma a la tirada; `dice-pool` y `dice-highest` tiran esa cantidad de dados. `symbol-pool` mantiene separados el atributo y el entrenamiento para formar y mejorar dados narrativos.

### `dice-sum`: sumar los dados

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

- `dice`: cantidad de dados y de caras. El total se compara con la dificultad.
- `advantage`: si el Game Master puede pedir dos tiradas y conservar una.
- `naturals`: efecto de las caras mayor y menor de un único dado en pruebas y salvaciones: `none`, `both`, `max-only` o `min-only`. Omítelo para usar solo aritmética. Requiere un dado único; un sistema 2d6 debe usar `none`.
- `dice.faces`: lo que vale cada cara, empezando por la más baja, cuando las caras no valen su propio número (Capability API 1.136). Los cuatro dados Fudge de Fate son `{ "count": 4, "sides": 3, "faces": [-1, 0, 1] }`: la tarjeta muestra −, una cara en blanco y + y los suma, y las probabilidades son exactamente las de Fate. Da un valor por cara.
- `openEnded`: un único dado que sigue tirando (1.136). Una cara igual o superior a `high` se vuelve a tirar y se suma, y otra vez mientras el dado nuevo muestre `high` o más; una cara igual o inferior a `low` se vuelve a tirar y se resta, y esa tirada encadena con `high` del mismo modo. La tirada porcentual abierta de Rolemaster es `{ "high": 96, "low": 5 }` sobre un d100. Una tirada lanza como máximo 20 dados. Las caras naturales y el desplazamiento de las franjas leen el primer dado.
- `unmodified`: caras de un único dado que el registro marca cuando el primer dado las muestra (1.136), para poder aplicar las tablas que tratan aparte "un 66 sin modificar": `[66, 100]`. El registro indica `unmodified="66"`, la tarjeta lo muestra y se indica al Game Master que aplique lo que dicen las reglas al respecto.
- `difficultyLadder`: dificultades que se indica al GM que elija. `dc` es el número que debe alcanzar el total. El Game Master puede nombrar un peldaño en vez de escribir su número, como `difficulty="Hard"`, y el motor toma el número del peldaño.

### `dice-pool`: tirar los dados y contarlos

El número de la ficha es el **tamaño de la reserva**, no una bonificación adicional. Una puntuación de 3 y un oficio que vale 2 tiran cinco dados. Esa es toda la idea: sin vocabulario ni editor de fichas nuevos, un sistema cuyas puntuaciones son puñados de dados usa las mismas `abilities`, `skills` y `proficiencyTiers` que cualquier otro.

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

- `die`: caras de cada dado de la reserva, de 2 a 100.
- `pool`: límites aplicados al número de la ficha antes de las explosiones. Un `min` de 0 permite que una reserva vacía falle sin tirar; `max` no puede superar 100. `abilityPlusAbility: true` permite que una prueba de atributo nombre un segundo atributo con `with=` y tire ambos, para sistemas que tiran dos atributos juntos; sin ello, `with=` no significa nada en una prueba de atributo.
- `target`: cara que debe alcanzar un dado para contar. Pon `min` por debajo de `max` para permitir al GM moverla por prueba con `threshold=`; iguala los tres valores para fijarla.
- `double`: opcional. Una cara igual o superior a `from` cuenta dos veces.
- `explode`: opcional. Una cara igual o superior a `from` tira otro dado, que también puede explotar. Los dados extra se limitan a `pool.max` además de la reserva inicial: una prueba tira como máximo el doble de `pool.max` y un `from` bajo no causa tiradas infinitas.
- Ambos pueden llevar un `min`: la cara más baja hasta la que una prueba puede bajar la regla, con `explode="N"` o `double="N"` en la etiqueta o en una entrada que usó el personaje. Con un `min` puedes omitir `from`, y entonces la regla solo se activa en una prueba que la pida: una especialidad que hace volver a tirar los dieces en una habilidad es `"explode": { "min": 10 }`. `from` no puede estar por debajo de `min`.
- `cancel`: opcional. Una cara igual o inferior a `upTo` quita un éxito. La cantidad nunca baja de cero.
- `botch`: opcional. Si **ningún** dado tuvo éxito y salió una cara igual o inferior a `upTo`, hay fracaso crítico. Una reserva cuyo único éxito se canceló ha fallado, pero no es una pifia. `"rule": "halfOrMore"` lo interpreta de otra forma: caras iguales o inferiores a `upTo` en al menos la mitad de los dados tirados al principio (sin contar explosiones) son un fracaso crítico si ningún dado tuvo éxito; si no, el resultado se mantiene y se marca con `complication="true"`: algo sale mal a la vez. `"noSuccesses"` es el predeterminado.
- `exceptional`: opcional. Esta cantidad de éxitos netos o más, en una prueba superada, es un éxito crítico.
- `situationalDice`: opcional. Límites de dados que el GM puede añadir o quitar con `bonus=` por acrobacias, heridas o mala iluminación.
- `reroll`: opcional. Repeticiones que concede el sistema sin que nadie las pague, hasta seis, cada una con un `id` que el GM nombra en una prueba con `reroll=`. Las caras iguales o inferiores a `upTo` se vuelven a tirar: con `"once"`, la cara nueva se queda sea cual sea; con `"until"`, se sigue tirando hasta que salgan más altas. `upTo` va de 1 a una cara menos que las del dado, porque repetir todas las caras no terminaría nunca, y un `until` se detiene de todos modos tras cien repeticiones en una prueba. No se tira ninguna salvo que la prueba la nombre. Una prueba hace una sola repetición: si un gasto o una entrada que usó el personaje también compró una, se tira la que alcanza más caras y, si alcanzan las mismas, `until` antes que `once`.
- `difficultyLadder`: `successes` indica cuántos éxitos se necesitan. Un peldaño también puede definir `target`, pero solo si es ajustable y dentro de sus límites. Ese es el objetivo con el que cuenta una prueba en ese peldaño: cuando el GM nombra el peldaño con `difficulty=` o escribe un `dc=` que solo necesita exactamente un peldaño. Si varios peldaños necesitan la misma cantidad de éxitos, `dc=` por sí solo no indica cuál se quería, así que el objetivo sigue siendo el predeterminado; nombra el peldaño.

- `target.from`: opcional. Lee el objetivo de cada personaje en su ficha, como el Number de Lasers & Feelings, que cada personaje elige una vez (cualquier referencia de valor: un atributo, un campo, un valor derivado). Se limita a `min`..`max`, y `threshold=` no lo mueve, porque el número es propio del personaje; un umbral comprado por una entrada que usó el personaje sí lo mueve. El `threshold=` del registro indica cuál se usó.
- `stances`: opcional. Hasta seis, cada una con un `id`, una `label`, `count` (`"below"` o `"above"`) y las `skills` que abarca. Una prueba de una de esas habilidades cuenta los dados **por debajo** del objetivo, o **por encima**, en vez de los que lo igualan o superan: Lasers & Feelings tiene una postura Lasers que cuenta por debajo y una postura Feelings que cuenta por encima, con cada habilidad en una de ellas. Una habilidad solo puede estar en una postura. Las posturas omiten `explode`, `double`, `cancel` y `botch`, que se leen respecto a "igual o superior".
- `exact`: opcional. Un dado que muestra exactamente el objetivo: `label` lo nombra (`"LASER FEELINGS"`), `text` puede decir lo que hace en la mesa, y cuenta como un éxito salvo que `counts` sea `false`. El registro lleva `exact="N"`, el número de esos dados, y la tarjeta de dados lo muestra junto al resultado, para que el Game Master pueda dar al jugador la revelación que compra.

Las caras de `cancel` y `botch` deben estar por debajo del objetivo mínimo, y todas las caras nombradas deben existir en el dado. Una regla imposible de activar se rechaza al importar, en vez de descubrirse durante el juego.

Un conjunto empaquetado de reservas requiere Capability API 1.24; un `min` en `explode` o `double`, `pool.abilityPlusAbility` y `botch.rule` requieren 1.37; `reroll`, 1.38, y `target.from`, `stances` y `exact`, 1.137. Uno comunitario importado lo valida el motor que lo lee, así que no necesita nada más.

### Qué puede escribir el Game Master en una prueba de reserva

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
[skill_check: skill="Ward" difficulty="Grim" explode="9"]
[skill_check: skill="Nerve" dc="1" with="Warmth"]
[skill_check: skill="Ward" dc="2" reroll="careful"]
```

- `dc` es la cantidad de **éxitos** necesaria, no un objetivo por dado. Va de 1 al máximo que pueda contar una tirada: el máximo de la reserva, duplicado si hay explosiones y otra vez si las caras cuentan doble.
- `threshold=` mueve el objetivo por dado y solo se ofrece si `target.min` es menor que `target.max`.
- `bonus=` añade o quita dados y solo se ofrece si se declara `situationalDice`.
- `with=` tira una habilidad o salvación con otro atributo. Funciona con ambos tipos; 5e obtiene "Strength (Intimidation)" con el mismo atributo. En una prueba de atributo, en cambio, añade un segundo atributo si `pool.abilityPlusAbility` está activado.
- `difficulty=` nombra un peldaño de la escala en lugar de `dc=`, en ambos tipos: sus éxitos (o su dificultad en una suma) y, en una reserva, su objetivo. Un `dc=` escrito junto a él sigue teniendo prioridad para el número, y `threshold=` para el objetivo. Se ignora un nombre al que no responde ningún peldaño o que comparten dos.
- `explode=` y `double=` mueven las caras de esas reglas para esta prueba y solo se ofrecen si la regla tiene un `min`.
- `reroll=` nombra una de tus entradas `reroll` para esta prueba y solo se ofrece si declaraste alguna. Se ignora un nombre al que no responde ninguna.

Todo respeta el archivo: los valores fuera de rango se ajustan al extremo más cercano y un atributo no ofrecido se ignora, sin rechazar la prueba. El registro muestra lo realmente usado: la dificultad y el umbral como números, los dados adicionales después de los límites, `with=` solo si se sustituyó o añadió el atributo, una cara solo si la prueba la movió, `reroll=` solo si la repetición que nombra fue la que se tiró y volvió a tirar algo, y `complication="true"` cuando una pifia `halfOrMore` salió mal junto a un resultado. El motor siempre tira los dados. Sustituye resultados de reserva escritos por el modelo, ignora `mode="advantage"` porque este tipo no tiene ventaja y no usa dados tirados por el jugador antes del turno.

### `dice-highest`: tirar los dados y leer el más alto

Blades in the Dark y Trophy Dark tiran un puñado de d6 y solo leen el más alto. Capability API 1.138.

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

- El número de la ficha es cuántos dados se tiran, como en una reserva, limitado por `pool` (como máximo 20). Las heridas, `adjust`, los estados y los objetos añaden o quitan dados.
- `keep`: opcional, de 1 a 3, 1 de forma predeterminada. Cuántos de los dados más altos se suman: 1 es Blades; 2, los combates de Trophy Dark.
- `zeroDice`: lo que hace un personaje sin dados. `"lowest-of-two"` (el predeterminado) tira dos y conserva el menor, y nunca puede ser un crítico; `"fail"` falla sin tirar.
- `critical`: opcional. `count` dados que muestran la cara más alta (o `face` y superiores) son un éxito crítico: los dos seises de Blades.
- `dark`: opcional, los dados oscuros de Trophy Dark. `label`, `max` (de 1 a 10) y `text`. El Game Master los añade a una prueba con `dark="N"`. `outcome` es `"all"` de forma predeterminada: se leen con el resto. Con `"outcome": "light"` (Capability API **1.149**), solo los dados claros deciden los dados conservados, el total, las franjas de resultado y los críticos. Si no hay dados claros, se aplica `zeroDice` al lado claro: se tiran dos dados claros y se conserva el menor, o se falla aunque se sigan tirando los dados oscuros. Los dados oscuros siempre se tiran y se registran al final; `darkHighest="true"` significa que un dado oscuro superó estrictamente a todos los dados claros (incluidos los dados claros de reserva; si no se tiró ninguno, gana cualquier dado oscuro). Lo que eso cuesta (Ruin) lo aplica el Game Master. Declarar `dark.outcome`, incluido `"all"`, requiere capabilityApi 1.149.
- `situationalDice`: opcional, los dados que el Game Master puede añadir o quitar con `bonus=` (ayudar, forzarse).
- `spend` solo puede comprar dados.
- `difficultyLadder`: peldaños con `dc`, el número que deben alcanzar los dados conservados. `dc=` en una prueba es ese número, de 1 a `keep` veces las caras del dado.
- `outcomes` leen `by: "total"` a partir de los dados conservados, y una franja `on: "critical-success"` recoge el crítico.

El registro conserva la forma sumada (`resolution="sum"`, `modifier="0"`, los dados conservados como total) y añade `highest="1"`, con `zeroDice="true"` y `dark="N"` cuando corresponden; los dados oscuros son los últimos de `rolls`. Un resultado solo de dados claros también registra `darkOutcome="light"`, así que la tarjeta resalta solo los dados claros conservados, también tras recargar. Un conjunto de este tipo no tiene combate propio, así que se rechaza `combat` junto a él.

### `roll-against`: sacar como máximo (o como mínimo) el número de la ficha

Call of Cthulhu, GURPS y los porcentajes del ladrón de la vieja escuela tiran contra un número de la ficha en vez de sumarlo a los dados. Capability API 1.139.

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

- El número de la ficha para la prueba es el objetivo. El porcentaje de una habilidad es la bonificación por habilidad de la ficha (`bonusRange` llega hasta 100), sin atributo ni bonificación de nivel de entrenamiento; una habilidad de GURPS es su atributo más esa bonificación.
- `dice`: lo que se tira y se suma; 1d100 de forma predeterminada (3d6 en GURPS, 1d20 en una tirada de salvación).
- `against`: `"at-most"` (el predeterminado) tiene éxito con un resultado igual o inferior al objetivo; `"at-least"`, con uno igual o superior.
- `difficultyLadder`: el `dc` de cada peldaño mueve el objetivo, y `divide` (de 2 a 10) divide antes el número de la ficha. El Game Master nombra un peldaño con `difficulty=`; un `dc=` en la etiqueta mueve el número, de -100 a 100. El `dc` del registro es el número contra el que se leyó la tirada, y el registro indica `against="at-most"`.
- `criticalSuccess` y `criticalFailure`: hasta seis reglas cada uno. Una regla nombra caras (`from`, `to`; cualquiera puede quedar abierto) o, para un fracaso, `pastTarget`, una tirada que se aleje esa distancia o más hacia el lado del fallo. `whenTarget` (`atLeast`, `below`) limita una regla a algunos objetivos: el 5 de GURPS solo es un éxito crítico con 15 o más. Un éxito crítico siempre tiene éxito y un fracaso crítico siempre falla.
- `tens`: opcional, solo en un único d100. `bonus="+N"` tira N dados de decenas más y conserva la mejor tirada; `bonus="-N"`, la peor, hasta `max`.
- `outcomes` puede leer `by: "fraction"` en una tirada `at-most`: el `atLeast` de cada franja divide el objetivo, y una tirada igual o inferior a esa parte cae en la franja. Las medidas `margin` (cuánto queda por debajo del objetivo) y `total` también funcionan.

### `symbol-pool`: tirar dados narrativos y leer los símbolos

Genesys forma una reserva a partir de una característica y un rango de habilidad, y después añade dados opuestos. Las caras llevan éxito, ventaja, triunfo, fracaso, amenaza y desesperación en vez de números. Capability API 1.141.

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

- `symbols`: de 2 a 10 símbolos con nombre. `counts` añade además uno de otro símbolo antes de la cancelación: un triunfo añade un éxito y sigue siendo un triunfo. Nombra un símbolo que no tenga su propio `counts`; se rechazan las cadenas y las autorreferencias. `cancels` empareja dos símbolos uno por uno, con como máximo una pareja para cada uno. La declaración inversa es opcional. `text` explica un símbolo al Game Master.
- `dice`: de 2 a 8 dados con nombre, cada uno con 2 a 20 caras. Las caras son listas de hasta tres IDs de símbolo; `[]` es una cara en blanco y los IDs repetidos cuentan dos veces. Todas las referencias deben existir.
- `pool`: `larger-upgraded` (el predeterminado) tira el mayor entre atributo y rango, y mejora tantos dados como indique el menor cuando se declara `upgrade`. `sum` suma ambos y no mejora ninguno. `max` vale 6 de forma predeterminada y no puede superar 12. El atributo usa `abilityModifier`, así que usa `identity` para las características de Genesys. El rango procede del nivel de entrenamiento de la habilidad o la salvación; una prueba de atributo pura tiene rango cero. `with=` cambia la característica como en otras pruebas. Las bonificaciones de la ficha, las heridas, los ajustes y los efectos añaden dados de impulso o de contratiempo mediante la bonificación con signo que se describe abajo.
- `difficulty`: `dc=` cuenta dados opuestos de 0 a `max` (5 de forma predeterminada, 12 como máximo). `difficulty=` nombra en su lugar un peldaño de la escala. `upgrade="N"` sustituye esa cantidad de dados opuestos por el dado mejorado, limitada al número realmente tirado. Nunca añade dados más allá de la dificultad.
- `boost` y `setback`: dados opcionales que añaden `bonus="+N"` y `bonus="-N"`, respectivamente, hasta el `max` de cada uno (3 de forma predeterminada, 6 como máximo). Los ajustes con signo se combinan antes de aplicar este límite. Capability API **1.150** también acepta `setback="N"` por separado: `bonus="2" setback="1"` tira ambos lados. Una bonificación negativa se suma a `setback`, y el total combinado de dados de contratiempo se limita a `setback.max`; los dados de impulso siguen limitados por `boost.max`.
- `allowOwnUpgrade`: opcional, falso si no aparece. Con `true`, `upgradeOwn="N"` mejora N dados más del personaje a `pool.upgrade` (que debe estar declarado), después de las mejoras de la ficha y de los dados comprados. Cuando todos los dados existentes ya están mejorados, cada mejora adicional añade un dado mejorado, siempre dentro de `pool.max`. También funciona con `pool.build: "sum"`. Declarar esta clave, aunque sea como `false`, requiere capabilityApi **1.150**. Los nombres de atributo de la etiqueta usan camel case, como `zeroDice`; `upgradeOwn` afecta a quien tira y `upgrade` sigue afectando solo a los dados de dificultad. Tanto `setback` como `upgradeOwn` aceptan enteros no negativos y se ignoran fuera de las reservas de símbolos; `upgradeOwn` se ignora si no está habilitado.
- `success`: necesita esta cantidad de su símbolo tras la cancelación, uno de forma predeterminada. El éxito y el fracaso críticos marcan cualquier aparición de su símbolo, aunque se cancele el éxito o el fracaso que añade. Ambas marcas pueden darse a la vez, y ninguna cambia si los éxitos netos superaron la prueba.
- `outcomes` puede leer el recuento de éxitos netos (`total`) o `net successes - needed + 1` (`margin`). Las franjas siguen decidiendo el éxito de la forma habitual; los símbolos críticos originales siguen marcados. `spend` solo compra dados base adicionales del personaje dentro de `pool.max`. Sus combates son de tipo `symbol-pool` (Capability API 1.382; consulta [Un combate tirado con dados de símbolos](ruleset-combat.md#a-fight-thrown-in-symbol-dice-symbol-pool)); cualquier otro tipo de combate se rechaza junto a él.
- Fuera de una prueba, una partida con este conjunto puede tirar sus dados por nombre: el campo de dados personalizados del editor de mensajes y la herramienta `roll_dice` del Game Master leen `2 ability 1 proficiency vs 2 difficulty` (el `id` o la `label` de cada dado, sin distinguir mayúsculas de minúsculas) y cuentan y cancelan símbolos como en una prueba, sin la ficha, mejoras ni una escala de dificultad. No hay ninguna clave que lo active.
- El registro conserva `resolution="sum"`, con `symbols="2s 1a 1t"`, `thrown=` que identifica cada dado y `rolls=` con su cara (contando desde 1). El `symbolDetails` codificado conserva las etiquetas, los símbolos de las caras y ambas marcas de crítico. `setback` registra los dados de contratiempo independientes que realmente se añadieron tras el límite compartido de contratiempo, y `upgradeOwn` registra las mejoras adicionales realmente aplicadas; se omiten las adiciones ignoradas o nulas. La tarjeta y el resumen nombran los símbolos netos, incluido un resultado vacío, en vez de sumar números de caras. Las sustituciones pueden cambiar las reglas de este tipo, pero no reemplazar `symbols` ni `dice`.

### Qué queda fuera y por qué

Estas mecánicas todavía necesitan su propio tipo de resolución:

- **Reservas enfrentadas** resuelven dos personajes a la vez; una prueba tiene un solo lanzador.
- **Reservas sumadas con un dado especial** (como OpenD6) suman los dados y tratan uno de forma distinta.

Las dos cosas que antes quedaban fuera ya están modeladas; la sección sobre gastar para cambiar tiradas explica cómo. Una regla del propio sistema, "spend a point for a success" o "spend a point to throw the failures again", es `resolution.spend`. Una repetición que el sistema concede gratis cuando la situación lo pide es `resolution.reroll`, descrito arriba. Una que pertenece a algo elegido por el personaje es `mechanics.check` de una entrada de catálogo, pagado con el coste propio de esa entrada.

## Franjas de resultado: más que éxito o fracaso

Muchos sistemas leen una prueba como uno de varios resultados, y no como un simple éxito o fracaso: los cuatro grados de éxito de Pathfinder, un "por los pelos" que tiene éxito a un coste, los éxitos difíciles y extremos de Call of Cthulhu, el "éxito con estilo" de Fate. `resolution.outcomes` nombra esas franjas, y el motor indica en cada prueba en cuál cayó (Capability API 1.135). Funciona con todos los tipos de resolución.

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

- `by`: de dónde se leen las franjas. `"margin"` (el predeterminado) es cuánto supera el resultado lo que necesitaba la prueba: un total sumado menos su dificultad, o los éxitos netos de una reserva menos los éxitos que necesitaba. `"total"` es el propio resultado: el total sumado o los éxitos netos, fuera cual fuera la dificultad.
- `tiers`: de dos a ocho franjas, **la mejor primero**. `atLeast` es el número más bajo que cae en una franja; el de cada franja es menor que el de la anterior, y la última no tiene ninguno, porque recoge todo lo que queda por debajo. `success` indica si la franja es un éxito, y `critical` la marca como crítica de su tipo (un éxito crítico cuando `success` es verdadero, un fracaso crítico cuando no lo es). Al menos una franja debe tener éxito y al menos una debe fallar. `text` es una línea opcional, de hasta 200 caracteres, que explica al Game Master qué significa la franja en la mesa ("You do it, but the Game Master adds a complication").
- `on`: `"critical-success"` o `"critical-failure"` convierte una franja en aquella en la que cae un crítico, diga lo que diga el número, y nada más cae nunca en ella. No tiene `atLeast`; una franja de éxito crítico es un éxito y una de fracaso crítico no lo es, y hay como máximo una de cada. Los "dos seises" de Blades in the Dark son una franja de éxito crítico situada por encima de la franja de un solo seis; las demás franjas, las que se leen a partir del número, siguen entre sí las reglas anteriores.
- `naturals: "shift"`: la cara más alta de un único dado mueve el resultado una franja hacia arriba, y su cara más baja una franja hacia abajo, nunca más allá de los extremos. Necesita un solo dado y sustituye a `resolution.naturals`, así que pon esos dos a `none` junto a él.

La franja decide el resultado: el éxito y los dos críticos proceden de ella, nunca de la simple comparación. Cuando los `naturals` de un conjunto sumado convierten una cara en un éxito o un fracaso automático, esa cara cae en la franja de ese crítico o, si no la hay, en la mejor o la peor franja, y sigue siendo un crítico. La pifia de una reserva hace lo mismo por abajo, y una reserva con franjas omite `exceptional`, porque las franjas ya dicen qué es un éxito crítico.

Una reserva leída `by: "total"` es como expresa sus resultados un sistema de dificultad fija: el "1 éxito: lo consigues por los pelos; 2: lo haces bien; 3: éxito crítico" de Lasers & Feelings son tres franjas con 3, 2 y 1 éxitos y un fallo por debajo.

El registro nombra la franja con `outcome="Critical success"`, la tarjeta de dados la muestra en lugar de la palabra simple, y al Game Master se le enseñan las franjas y su `text` y se le indica que narre la franja. Un conjunto empaquetado que declara franjas necesita Capability API 1.135.

## Pruebas que tiran a su manera

Algunos juegos tiran la mayoría de las pruebas de una forma y unas pocas de otra: un juego de la vieja escuela tira un d20 por debajo de una puntuación de atributo, pero las habilidades de un ladrón con un d100 y Open Doors con un d6. `resolution.overrides` nombra esas pruebas y las claves de resolución con las que tiran en su lugar. Capability API 1.140.

```json
"overrides": [
  { "id": "thief", "label": "Thief skills", "skills": ["open_locks", "pick_pockets"], "set": { "dice": { "count": 1, "sides": 100 } } },
  { "id": "x_in_6", "label": "X-in-6", "skills": ["open_doors", "listen"], "set": { "dice": { "count": 1, "sides": 6 } } },
  { "id": "favored", "label": "Favored", "skills": ["athletics"], "when": { "field": "favored_athletics" }, "set": { "cancel": null } }
]
```

- Cada sustitución nombra `skills`, `saves` o `abilities` (una o más de las tres), una `label` y un `text` opcional para el Game Master.
- `set` contiene claves de resolución del propio tipo del conjunto, que sustituyen a las del conjunto para esas pruebas. `null` elimina una clave: los 1 de exwod que no cancelan en un atributo favorecido son `"cancel": null`. No se pueden cambiar el tipo, las cuentas de la ficha (`abilityModifier`, `proficiency`, `proficiencyTiers`, `penaltyFrom`, `spend`, `adjust`) ni la `difficultyLadder`. Una reserva de símbolos también bloquea sus `symbols` y `dice`. La resolución que crea una sustitución se comprueba como la del propio conjunto, así que una cara que nombre tiene que estar en sus dados.
- `when`: opcional. Un valor de la ficha de quien tira; la sustitución solo se aplica cuando no es 0, como un campo numérico de 0 o 1 para un atributo favorecido. Sin él, la sustitución se aplica siempre.
- Se usa la primera sustitución que nombra la prueba y cuyo `when` se cumple. Una prueba aparece como máximo en una sustitución sin `when`.

## Gastar para cambiar una tirada

Algunos sistemas permiten pagar por una tirada que está a punto de hacerse: un punto de voluntad por un éxito automático. `resolution.spend` lo define como regla permanente del sistema, no como algo comprado por un personaje:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` es una de tus `live.pools`. No puede empezar vacía, pues no habría nada que gastar al comenzar a jugar.
- `amount` es el coste de UNA compra. `successes`, `dice` y `reroll` indican qué compra; debe comprar al menos uno. Los éxitos se añaden después de contar los dados y de las cancelaciones, porque nadie los tiró. Los dados se tiran con la reserva, dentro de sus límites. Un `reroll` es `{ "upTo": 6, "mode": "once" }`, se interpreta igual que `resolution.reroll` y se compra una sola vez por muchas compras que haga la prueba: un dado que se vuelve a tirar dos veces sigue siendo una repetición.
- `perCheck` indica cuántas compras permite una prueba; como máximo puede comprar por valor de `amount * perCheck` puntos. Ese límite impide que una reserva llena compre una tirada imposible de perder. Es un número de 1 a 10, un valor de la ficha con la misma forma que lee un valor derivado (`{ "abilityScore": "nerve" }`, `{ "derived": "focus" }`) o `"pool"`: tantas como dados tenga la prueba, es decir, el número de la ficha para ella antes de heridas, dados adicionales o modificadores. Un valor de la ficha se lee para quien tira, se redondea hacia abajo y se limita entre 0 y 100; un personaje cuyo límite resulta 0 no compra ni paga nada.
- Un conjunto `dice-pool` puede comprar éxitos, dados o repeticiones de tirada. `dice-highest` y `symbol-pool` solo compran dados. Los demás tipos no pueden declarar `spend`.
- Hasta cuatro entradas, y dos no pueden nombrar la misma reserva, porque la prueba no podría distinguirlas.
- Un gasto que compra un `reroll`, un `perCheck` que no es un número y más de dos entradas requieren Capability API 1.38 en un conjunto empaquetado.

**Se escribe en la propia prueba.** El GM escribe `[skill_check: skill="Nerve" dc="2" spend="resolve:1"]`, no un comando `[sheet:]` separado: los dados se tiran antes de aplicar esos comandos y ya no quedaría nada que cambiar. Una sola resolución tira los dados y paga lo que los modificó.

## Un amuleto que cambia una tirada

`resolution.spend` es una regla del sistema. Una entrada que el personaje realmente ELIGIÓ también puede cambiar una prueba, mediante `mechanics.check` en la entrada de catálogo:

```json
"mechanics": {
  "kind": "utility",
  "cost": [{ "pool": "blood", "amount": 1 }],
  "perCostStep": { "flat": 1 },
  "check": { "reroll": { "upTo": 1, "mode": "once" }, "successes": 1 }
}
```

- `reroll` vuelve a tirar los dados iguales o inferiores a `upTo`. `once` sustituye cada uno una vez y conserva la cara nueva; `until` sigue tirando. `upTo` debe estar por debajo de la cara máxima o repetiría toda la reserva eternamente. El motor limita cuántos dados puede repetir una prueba, diga lo que diga el archivo.
- `dice` añade dados antes de tirar; `successes` añade éxitos después de contar; `threshold` fija el objetivo por dado para esa tirada, dentro del rango permitido por `target`.
- `explode` y `double` mueven las caras de esas reglas para esa tirada, solo si tu regla tiene un `min` y dentro de él: `"check": { "explode": 8 }` es una entrada que hace volver a tirar los ochos. Tienen prioridad sobre lo que escribió el GM en la etiqueta, igual que `threshold`. Capability API 1.37.
- Debe haber al menos uno de ellos; si no, la entrada no dice nada y se rechaza.
- Solo `dice-pool` puede aplicarlo; un conjunto `dice-sum` con `mechanics.check` se rechaza al importar.

**El coste es el `cost` de la entrada**, pagado con el mismo mecanismo que cualquier otro uso: la reserva y un uso de cada contador que escribió esa entrada. `perCostStep` indica que la entrada ESCALA: si lo declara, se compra tantas veces como se haya pagado su precio; si no, se compra una vez por mucho que se ofrezca.

**El GM la nombra en la prueba:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. No usa un comando de ficha separado por el mismo motivo: se tira antes de actualizar los registros.

**Todo o nada.** Si la reserva no alcanza, no se compra ni descuenta nada; la tirada queda como habría sido. Los puntos que no equivalen a un número entero de compras tampoco compran nada. Pedir más de `perCheck` se limita, no se rechaza; solo se paga hasta ese máximo. El motor lo calcula todo. El GM nombra lo que el jugador quiso gastar y nunca toca los dados. El registro indica lo realmente pagado, la entrada aplicada, los éxitos que no se tiraron y cuántos dados se repitieron. Un amuleto no elegido por el personaje, o cuyo catálogo no pueda leer el motor, no hace nada; no se aplica por confianza.
