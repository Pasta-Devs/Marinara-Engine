# Escribir conjuntos de reglas de Game Mode

Un conjunto de reglas explica a Game Mode cómo funciona un sistema de mesa: qué dados tira una prueba, qué contiene la ficha, qué recursos se gastan y qué recupera un descanso. Esta guía es para quienes quieren escribir uno y compartirlo. Para jugar con uno creado por otra persona, empieza por [Elegir las reglas](../game/getting-started.md#choosing-rules).

Un conjunto es un archivo JSON. Son datos, no código. Nada se ejecuta, así que importarlo no puede hacer nada en tu computadora. Antes de importar un archivo ajeno, lee con atención el texto del Game Master: se envía al modelo en todas las partidas que usan el conjunto.

## Lee esto primero: qué puede y qué no puede hacer un conjunto

Un conjunto solo puede rellenar los parámetros de una mecánica que el motor ya conoce. Actualmente conoce cinco formas de resolver pruebas; el archivo elige una con `resolution.kind`:

- **`dice-sum`**: tira dados, suma números de la ficha e iguala o supera una dificultad. Abarca sistemas d20, sistemas de 2d6 más atributo y muchos otros.
- **`dice-pool`**: tira la cantidad de dados del personaje y cuenta los que alcanzan un objetivo. Abarca sistemas donde una puntuación representa un puñado de dados en vez de una bonificación.

- **`dice-highest`**: tira una reserva y lee su dado más alto, o suma los pocos más altos. Abarca Blades in the Dark y Trophy Dark.
- **`roll-against`**: saca un resultado igual o inferior (o superior) al número de la ficha. Abarca las habilidades porcentuales y las pruebas de GURPS.
- **`symbol-pool`**: forma y mejora dados narrativos y después cancela los símbolos opuestos. Abarca las pruebas de Genesys.

Los cinco se describen por completo en [Tipos de resolución](#resolution-kinds).

Una mecánica que no encaje en estas formas no se puede escribir en el archivo. Las reservas enfrentadas son un ejemplo. Cada una necesita un nuevo tipo de resolución dentro del motor: una contribución de código con pruebas, no un JSON. Si tu sistema lo necesita, abre una solicitud de función en el repositorio del motor y describe la mecánica con varias tiradas resueltas. Esos ejemplos se convierten en las pruebas.

Game Mode puede resolver una pelea con el combate propio de Marinara o con las reglas de tu conjunto. El bloque opcional `battle` presta al combate de Marinara las cifras de las fichas: consulta [Batallas](#battles-lending-the-sheet-to-marinaras-combat). El bloque opcional `combat` define cómo resuelve el conjunto la pelea: consulta [Combate](#combat-a-fight-your-own-rules-resolve). El motor ya aplica esas reglas. **Combat Preference** (Preferencia de combate) elige la presentación Classic o, si el conjunto define distancia, un campo Tactical.

## Inicio rápido

1. Copia el ejemplo que coincida con las tiradas de tu sistema. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) es un sistema pequeño de 2d6 con tres atributos que demuestra que el formato no presupone un d20 ni seis atributos. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) es una reserva pequeña de dados de diez caras con tres puntuaciones y seis oficios. Como ejemplo completo, consulta el archivo 5e (SRD 5.1) en [`ruleset-5e-2014.example.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/ruleset-5e-2014.example.json).
2. Cambia `id` por el tuyo. Usa minúsculas, dígitos y guiones simples, como `ember-roads`.
3. Edita la ficha, los descansos y el texto del Game Master.
4. Impórtalo; consulta [Probar tu conjunto](#trying-your-ruleset). La importación comprueba todo el archivo e indica los errores línea por línea antes de guardar nada.
5. Crea una partida, elige tu conjunto en **Rules** (Reglas) y juega unas cuantas pruebas.

Para recibir ayuda al escribir, configura el JSON Schema en tu editor añadiendo esta primera línea dentro de las llaves exteriores del archivo:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

El esquema detecta claves mal escritas y tipos incorrectos mientras escribes. No comprueba que los nombres apunten a elementos existentes, como una habilidad que nombra un atributo. Eso lo hace la importación.

Puedes añadir una línea `"$comment": "..."` a cualquier objeto para dejarte una nota. El motor la ignora.

## Las partes del archivo

| Clave | Qué contiene |
| --- | --- |
| `schemaVersion` | Siempre `1`. |
| `id`, `version` | El nombre del conjunto para el motor y un entero que incrementas cada vez que publicas un cambio. |
| `name` | Lo que ven los jugadores en el asistente. |
| `edition` | Opcional. Una línea sobre la edición o borrador. |
| `license` | Opcional. Un ID SPDX y la atribución exigida por la fuente. |
| `coverage` | Lo que cubre el conjunto y el resumen de una línea del asistente. |
| `resolution` | Cómo se tira una prueba o salvación. |
| `sheet` | Todo lo que hay en la ficha. |
| `rests` | Lo que restaura y elimina cada descanso. |
| `gm` | El texto que recibe el modelo del Game Master y los valores de ficha que ve por personaje. |
| `catalogs` | Opcional. Entradas preparadas que ofrece el editor para evitar escribir listas largas a mano. |
| `items` | Opcional. Las palabras con las que se escriben tus objetos: categorías, rarezas, estadísticas, ranuras y dinero. |
| `battle` | Opcional. Qué lee una batalla de la ficha y qué escribe al terminar. |
| `combat` | Opcional. Cómo resuelven tus reglas una pelea y qué ejecuta la pantalla de batalla. |
| `layers` | Opcional. Variantes del conjunto que se activan al crear una partida. |

El archivo puede ocupar hasta 512 KB (256 KB antes de Capability API 1.340). El texto que llega a un prompt (nombres, etiquetas, texto del Game Master) no puede contener saltos de línea, corchetes ni llaves dobles.

Los IDs de la ficha (atributos, habilidades, campos, reservas, etc.) usan minúsculas, dígitos y guiones bajos, y empiezan por letra, como `grit_max`.

<a id="resolution-kinds"></a>

### Tipos de resolución

`resolution.kind` elige cómo tirar. Todos los tipos leen la misma ficha y comparten tres claves; las partes del archivo posteriores a `resolution` no cambian al alternar:

- `abilityModifier`: cómo se convierte una puntuación en un número. `identity` usa la propia puntuación; `floorHalfMinusTen` es la regla de 5e; `stepTable` permite definir umbrales como `[[score, number], ...]`.
- `proficiencyTiers`: niveles de entrenamiento de una habilidad o salvación. El primero se aplica a habilidades no incluidas. Cada nivel añade `flat`, o `multiplier` por la bonificación de competencia, o ambos. Si el sistema tiene esa bonificación, indica su origen con `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: opcional; solo se necesita para un nivel que multiplica.

El significado del número depende del tipo: `dice-sum` lo suma a la tirada; `dice-pool` y `dice-highest` tiran esa cantidad de dados. `symbol-pool` mantiene separados el atributo y el entrenamiento para formar y mejorar dados narrativos.

#### `dice-sum`: sumar los dados

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

#### `dice-pool`: tirar los dados y contarlos

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

#### Qué puede escribir el Game Master en una prueba de reserva

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

#### `dice-highest`: tirar los dados y leer el más alto

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

#### `roll-against`: sacar como máximo (o como mínimo) el número de la ficha

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

#### `symbol-pool`: tirar dados narrativos y leer los símbolos

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
- `outcomes` puede leer el recuento de éxitos netos (`total`) o `net successes - needed + 1` (`margin`). Las franjas siguen decidiendo el éxito de la forma habitual; los símbolos críticos originales siguen marcados. `spend` solo compra dados base adicionales del personaje dentro de `pool.max`. El combate queda fuera, como en `dice-highest`.
- El registro conserva `resolution="sum"`, con `symbols="2s 1a 1t"`, `thrown=` que identifica cada dado y `rolls=` con su cara (contando desde 1). El `symbolDetails` codificado conserva las etiquetas, los símbolos de las caras y ambas marcas de crítico. `setback` registra los dados de contratiempo independientes que realmente se añadieron tras el límite compartido de contratiempo, y `upgradeOwn` registra las mejoras adicionales realmente aplicadas; se omiten las adiciones ignoradas o nulas. La tarjeta y el resumen nombran los símbolos netos, incluido un resultado vacío, en vez de sumar números de caras. Las sustituciones pueden cambiar las reglas de este tipo, pero no reemplazar `symbols` ni `dice`.

#### Qué queda fuera y por qué

Estas mecánicas todavía necesitan su propio tipo de resolución:

- **Reservas enfrentadas** resuelven dos personajes a la vez; una prueba tiene un solo lanzador.
- **Reservas sumadas con un dado especial** (como OpenD6) suman los dados y tratan uno de forma distinta.

Las dos cosas que antes quedaban fuera ya están modeladas; la sección sobre gastar para cambiar tiradas explica cómo. Una regla del propio sistema, "spend a point for a success" o "spend a point to throw the failures again", es `resolution.spend`. Una repetición que el sistema concede gratis cuando la situación lo pide es `resolution.reroll`, descrito arriba. Una que pertenece a algo elegido por el personaje es `mechanics.check` de una entrada de catálogo, pagado con el coste propio de esa entrada.

### Franjas de resultado: más que éxito o fracaso

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

### Pruebas que tiran a su manera

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

### Gastar para cambiar una tirada

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

### Un amuleto que cambia una tirada

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

### La ficha

- `sections` agrupa elementos en el editor. Los campos, valores derivados y listas nombran con `section` la sección en la que están, y también pueden hacerlo los atributos, habilidades y salvaciones: el editor, la ficha de la partida y el bloque de ficha del GM los muestran entonces bajo ese encabezado (una ficha que no les asigna sección los muestra exactamente como antes). Una sección también puede llevar una regla `untrained` (abajo).
- `abilities` son las puntuaciones principales. `skills` y `saves` pueden nombrar el atributo con el que tiran, un `cap` y una regla `untrained` (abajo).
- `fields` contiene valores individuales. Tipos: `number`, `text`, `longtext`, `boolean`, `enum` (lista fija de opciones) y `dice` (texto como `1d8`).
- Los valores `derived` se calculan a partir de otros y no pueden sobrescribirse a mano. Una ficha puede tener hasta 400 (Capability API 1.111; 240 desde 1.88, 120 desde 1.84 y 60 antes); un paquete con más de 240 declara 1.111. Las operaciones son `sum`, `min`, `max`, `scale` (multiplicar por un número fijo y redondear), `multiply` (de dos a seis valores multiplicados entre sí, como el modificador de Constitución por el nivel; Capability API 1.82), `stepTable` (consultar umbrales, como cuando un nivel determina competencia) y `enumTable` (un número para cada valor de un campo enum o de un estado vivo; consulta Estados vivos más abajo).
- `lists` son tablas con columnas propias, como equipo, conjuros o rasgos. Una lista tiene hasta 24 columnas; un paquete con una lista de más de 12 declara Capability API 1.165. Una lista con `pools` convierte cada fila en un recurso con máximo propio, para rasgos de clase de usos limitados. Una columna numérica puede rellenarse con una tirada: `"roll": { "count": 1, "sides": 8 }`, donde `sides` es un número, otra columna de la misma fila (`{ "column": "die" }`, una columna numérica o un enum cuyos valores se leen como dados, como `d8`) o un valor de la ficha. El editor de la ficha muestra un botón Roll que tira los dados del propio motor y escribe el total, limitado al `min` y al `max` de la columna (Capability API 1.85).
- `live` es lo que cambia al jugar: `pools` (puntos de golpe, espacios de conjuro, Grit), `tracks` (número en una escala, como agotamiento, o contador de heridas con casillas), `text` (notas breves, como la concentración), `conditions` y `states` (un valor de un conjunto cerrado, como una forma o una postura).

Todo lector de números los nombra con una referencia de valor: un objeto con exactamente una clave entre `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` e `itemStat`. Por ejemplo, una reserva con máximo derivado: `"max": { "derived": "grit_max" }`.

- `listSum` suma una columna numérica de una lista: `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` es opcional y nombra una columna booleana; solo cuentan las filas donde está activada. Una celda vacía cuenta como el valor predeterminado de su columna, y una lista oculta por `hideWhen` no suma nada. Ember Roads calcula así Burden a partir del equipo que lleva cargado el personaje, de modo que nunca puede desviarse de la lista como lo haría un número escrito a mano. Una columna escalada de catálogo no puede leer una suma de lista, ni siquiera mediante un valor derivado: una lista puede contener celdas escaladas, propias o que vuelven a leerla, y el recálculo nunca terminaría.
- `livePool` lee lo que queda en una de tus `live.pools` (la reserva de una fila de lista no es una de ellas). `liveTrack` lee uno de tus `live.tracks`, con un `read` opcional: `"value"`, dónde está (predeterminado); `"filled"`, cuánto supera su `min`; `"remaining"`, cuánto le falta para su `max`; o, solo en un contador de heridas, `"penalty"`, la penalización vigente. Una reserva o contador oculto lee 0. "Harm still to take" de Gravewatch es `{ "liveTrack": "harm", "read": "remaining" }`.
- Una lectura viva toma el estado vivo tal como está cuando se tira una prueba, empieza un combate o se escribe el bloque de ficha del GM. Si aún no hay ninguno (el editor de fichas, la revisión de una importación), lee el estado con el que empieza el juego: una reserva llena o vacía según su `start`, un contador en su `default`, un contador de heridas limpio.
- Nada que se calcule antes de que exista un estado vivo puede leer uno: el `max` de una reserva o de un contador, la bonificación de competencia, o la columna escalada o el escalado de un catálogo. Eso se mantiene a través de un valor derivado que lea uno y de una habilidad limitada por un valor vivo, y la importación nombra el valor que lo hace.
- Estos tres requieren Capability API 1.39 en un conjunto empaquetado.
- `itemStat` lee los objetos que tiene el personaje, como la guardia de la armadura que lleva puesta, y sigue la misma regla que una lectura viva. Consulta [Objetos en la ficha](#items-on-the-sheet). Capability API 1.52.

**Qué hace una prueba sin entrenamiento.** Una habilidad o salvación en la que el personaje no tiene entrenamiento (su nivel es el primero) se tira como siempre, salvo que el conjunto diga otra cosa con `untrained` en la habilidad o salvación o en la sección donde está (la regla propia de la habilidad o salvación tiene prioridad):

```json
"sections": [{ "id": "labour", "label": "Labour", "untrained": { "by": -1 } }],
"skills": [
  { "id": "dig", "label": "Dig", "ability": "sinew", "section": "labour", "untrained": "refuse" },
  { "id": "listen", "label": "Listen", "ability": "nerve", "untrained": "harder" }
]
```

- `"normal"`: como siempre (predeterminado).
- `{ "by": -3 }`: se suma al número de la prueba, de -20 a 20: dados en una reserva, una cantidad fija en una suma. Forma parte del número que muestra la ficha y que tira cada prueba, antes de cualquier `cap`.
- `"harder"`: un paso más difícil. En una reserva, el objetivo por dado sube uno (sin salir del rango del objetivo), así que necesita un conjunto de reservas cuyo objetivo pueda moverse; en cualquier otro caso se rechaza al importar, porque nunca podría cambiar una tirada.
- `"refuse"`: la prueba no se tira. El motor devuelve la petición del GM con `reason="untrained"`, lo que la zanja: nada la tira después, se informa al GM de que el personaje no pudo intentarlo y la narración lo refleja. El endpoint de pruebas de habilidad responde a esa prueba con un 400 (`skill_check_untrained`), y una rama creada a partir de ella no conserva ninguna de las dos mitades. El editor de fichas no muestra ningún número para ella.
- Un personaje sin ficha no tiene entrenamiento que leer, así que no se le aplica ninguna regla de falta de entrenamiento.
- El recordatorio del GM enumera las reglas de falta de entrenamiento, por sección o por habilidad, para que pida pruebas que el personaje pueda hacer.

Las secciones en atributos, habilidades y salvaciones, y `untrained` en cualquier lugar, requieren Capability API 1.41 en un conjunto empaquetado.

Una habilidad o salvación puede llevar un `cap`, una referencia de valor que es lo máximo a lo que puede llegar su prueba: una puntuación que no puede superar o un contador que la frena. Gravewatch limita Soothe a la Resolve que le queda a un guardián, `"cap": { "livePool": "resolve" }`. El número limitado es el que muestra la ficha y el que tira cada prueba, y un cambio con `with=` se calcula sobre el número anterior al límite y después se vuelve a limitar. Un límite no puede leer un modificador de habilidad o salvación, ni tampoco el valor derivado que lee ni ningún valor derivado declarado antes que ese, para que la ficha se siga calculando una sola vez, de arriba abajo. Capability API 1.39.

`hideWhen` oculta un campo, un valor derivado, una lista, una reserva o un contador simple según el valor de otro campo, exactamente de una de tres formas: `equals` un valor, `notEquals` un valor (oculto siempre que el campo tenga cualquier otro, que es como se dice "solo para este tipo de personaje") o `in` una lista de valores. Cada valor nombrado debe ser uno que el campo pueda contener, o la regla nunca coincidiría, y se comprueba de uno en uno; para `notEquals` e `in` eso incluye el rango de un campo numérico y la longitud de un campo de texto. La regla lee el valor que muestra el editor de fichas: un campo sin valor es el valor con el que empieza una ficha en blanco, y un valor enum que el conjunto ya no ofrece es el predeterminado del campo. El archivo 5e usa `equals` para ocultar espacios de conjuro a quien no lanza conjuros; Gravewatch quita el aceite de linterna de la ficha de todo guardián que no esté en la guardia nocturna con `"hideWhen": { "field": "watch", "notEquals": "night" }`. Una capa no puede retirar un valor con el que compare cualquiera de ellas. Un contador de heridas no puede ocultarse, porque las tiradas y los combates lo leen muestre lo que muestre la ficha. `notEquals` e `in` requieren Capability API 1.39.

El `max` de un contador simple puede ser una referencia de valor en vez de un número, para que una puntuación del personaje determine hasta dónde llega: `"max": { "field": "willpower_rating" }`. Su `min` y su `default` siguen siendo números. Un contador de heridas con niveles con nombre tiene un `max` igual a su número de niveles; un contador de casillas numeradas tiene la longitud que indica su propio `max` (consulta Casillas numeradas más abajo). `alwaysShow: true` muestra un contador en el bloque de ficha del GM incluso en su valor predeterminado, para una puntuación que importa en cada turno; sin él, un contador en su valor predeterminado se omite, porque tres salvaciones contra la muerte a cero no dicen nada. Estos tres requieren Capability API 1.37 en un conjunto empaquetado.

### Estados vivos: una forma, una postura, una luz

Un campo enum se elige al crear el personaje y no cambia, y un estado solo está activado o desactivado. Un **estado vivo** es un valor de un conjunto cerrado que cambia durante el juego: la forma de un cambiaformas, una postura de combate, cuánto alumbra una linterna.

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

- `values` son de dos a cuarenta, y cada uno se muestra como su entrada de `valueLabels` o tal cual. Siguen la regla de toda etiqueta (una línea, sin corchetes ni llaves de macro) y nunca contienen comillas dobles, porque el comando de ficha los entrecomilla. Hasta doce estados.
- `default` es el valor con el que empieza toda ficha y, si lo omites, el primer valor. Solo se guarda un estado que se ha movido de su valor predeterminado, y un valor guardado que el estado ya no ofrece se lee como el predeterminado.
- `hideWhen` quita un estado de una ficha según el valor de un campo, igual que con una reserva: no se muestra, ningún comando lo cambia y una tabla (abajo) lo lee como si no tuviera valor.
- El GM fija uno con `[sheet: who="Name" op="state" state="Stance" value="Reckless"]`, nombrando el estado por su ID o etiqueta y el valor por sí mismo o por su etiqueta. Se rechaza un estado o un valor que la ficha no tiene (`unknown-state`, `unknown-value`). El motor enseña el comando y enumera todos los valores solo si tu conjunto tiene un estado, y cada bloque de ficha indica el valor de cada estado, incluido el predeterminado, porque "en forma humana" es un dato que la narración necesita en cada turno.
- La pantalla de ficha de la partida muestra un selector para cada estado.
- Un descanso restablece uno con un paso de restauración que lo nombra: `{ "state": "stance", "to": "default" }`, o `"to"` uno de sus valores.

**Números que lo siguen.** Un valor derivado con `"op": "enumTable"` da un número para cada valor de un campo enum o de un estado vivo:

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

- `from` nombra exactamente uno entre `field` (un campo enum) y `liveState`. Cada fila de `table` es un valor que este puede tener, de uno a cuarenta. Un valor que la tabla omite, y un estado que la ficha oculta, leen `default` (0 si lo omites).
- Un campo queda fijado al crear el personaje, así que una tabla basada en uno puede alimentar un máximo: Gravewatch da una Resolve más a un guardián de la guardia del alba. Un estado vivo cambia durante el juego, así que una tabla basada en uno es una lectura viva, como `liveTrack`: nada que se calcule antes de que exista un estado vivo puede leerla, ni directamente ni mediante otro valor derivado. Por eso la clave es `liveState` y no `state`: toda lectura del estado vivo se llama `live`, y así tanto tú como la importación pueden distinguir lo que un máximo no puede usar.
- Para llevar el número a los dados, apunta `resolution.adjust` hacia él (consulta Modificadores fuera de la ficha). Ember Roads suma su Stance a cada tirada de Brawn; Gravewatch resta una linterna cerrada u oscura de cada tirada de Nerve.
- Una capa puede retirar un valor de un campo para el que una tabla tiene una fila. Esa fila simplemente no se lee mientras la capa está activa.

Los estados vivos, `enumTable` y un paso de descanso que nombra un `state` requieren Capability API 1.42 en un conjunto empaquetado.

### Contadores de heridas: salud en una escala de marcas

Muchos sistemas no cuentan puntos de golpe. Tienen una columna de casillas, cada una peor que la anterior, y marcas una al recibir daño. Añade `kinds` y, o bien `levels` con nombre, o bien `boxes` numeradas (abajo), a una entrada `live.tracks` para convertir un número en una de estas escalas:

**¿Qué forma necesita tu sistema?** Una reserva guarda CUÁNTO daño llegó; un contador guarda cuánto Y el tipo de cada parte. Si una herida es contundente, letal o agravada y el tipo sigue importando después del golpe (porque lo agravado cura más despacio, no puede absorberse o acaba matando), debe conservarse tras la tirada. Solo una marca lo conserva. Una reserva no puede: al restar daño solo queda un número menor, sin memoria de qué puntos eran de cada tipo. Por eso `combat.damageKinds` se rechaza cuando la salud es una reserva, en vez de ignorarse. Una reserva sí puede tener `damageTypes`, y los enemigos pueden resistirlos o ser inmunes: eso determina cuánto daño llega, no qué herida queda después.

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

- `levels` tiene 1–16 peldaños, del mejor al peor. Cada uno tiene `label` y `penalty` entero igual o menor que 0. Un negativo grande expresa quedar fuera de combate, así que `-99` es válido.
- `kinds` tiene 1–6 tipos de daño que admite el contador, cada uno con `id`, `label` breve para la casilla y `severity`. Las severidades deben ser distintas; solo importa su orden, no los números, así que sepáralas como quieras.
- Ambos van juntos. Se rechaza `kinds` sin `levels` ni `boxes`, porque no habría dónde marcar, y `levels` o `boxes` sin `kinds`, porque la marca debe ser de algún tipo. Un contador tiene `levels` o `boxes`, nunca ambos.
- **Distingue los términos.** `kinds` define lo que PUEDE SER una marca. Una MARCA es uno de esos tipos situado en el contador durante la partida. La definición contiene tipos; la ficha contiene marcas.
- Un contador de heridas empieza sin marcas, así que su `min` es 0. Un contador con niveles con nombre tiene la longitud de sus niveles, así que su `max` es `levels.length`, y cualquier otra declaración se rechaza en vez de corregirse, para que nunca contenga dos longitudes contradictorias. Un contador de casillas tiene la longitud que indica su propio `max`, que puede ser un valor que calcula la ficha (consulta Casillas numeradas más abajo).

**Las reglas exactas**, porque una interpretación vaga produce un contador incorrecto:

- Las marcas se ordenan con **las más graves primero**. Siete niveles admiten como máximo siete marcas.
- Cada marca se **inserta por orden de gravedad**, nunca simplemente al final. Ocupa el nivel más alto que le corresponde y desplaza las más leves hacia abajo.
- La penalización activa es la del **nivel marcado más bajo**, nunca la suma. Tres marcas en el ejemplo dan `-3`, no `0 + -1 + -3`.
- `amount` es la cantidad de marcas de un tipo, **aplicadas una a una**. Así, llenarse a mitad del proceso sigue la misma regla que empezar lleno.
- Marcar un contador **lleno** **aumenta un paso la gravedad de su marca más leve**, en vez de añadir otra. Sube un peldaño en tu escala de tipos, sea cual sea el tipo nuevo.
- Una marca que superaría la gravedad máxima se queda en ella; la que no pudo entrar cuenta como **desbordamiento**. Este se guarda para que recargar no olvide el daño recibido.
- **Curar usa el mismo comando con cantidad negativa.** Antes de cualquier marca elimina el desbordamiento. Una curación que nombra uno de los tipos del contador solo elimina marcas de ese tipo, así que "lo contundente se cura, lo letal se queda" es `kind="bashing"` con cantidad negativa; una que no nombra ningún tipo del contador elimina primero las marcas más leves.

**Marcar durante el juego.** El GM escribe `[sheet: op="damage" track="harm" kind="knock" amount="1"]` y cura con `amount` negativo. En un contador que se llena por casilla, añade `box="3"` para la casilla donde cae el golpe. La forma de reserva de `damage`, que nombra `pool=`, no cambia. El comando `track` ordinario se rechaza para heridas: un número no identifica los tipos de marcas nuevas. El jugador también puede marcar y limpiar casillas a mano, como esperan estos sistemas.

**Un combate también puede marcarlo.** Apunta `combat.health` al contador en vez de a una reserva: un golpe acertado marca las casillas que indica `combat.damageKinds.marks`, del tipo al que ese bloque asigna su daño. Un personaje con el contador lleno está caído, el estado que consulta la regla de muerte. En un contador que se llena por casilla, el daño `per-point` nombra la casilla donde cae y `per-blow` apunta a la primera, y un golpe que ninguna casilla puede recibir derriba al personaje, que es lo que significa quedar fuera de combate en los sistemas que usan un contador así. Curar elimina una marca, la más leve, de cualquier tipo. Los puntos temporales se rechazan porque el contador no tiene un espacio para ellos. El motor lo lee como niveles RESTANTES; el resto del combate, caer, revivir, el registro y el resumen no cambia.

**Un descanso puede curar heridas.** Un paso de restauración que use `"to"` lo reduce a esa cantidad de marcas, incluido el desbordamiento; con un `"by"` NEGATIVO elimina esa cantidad, empezando por el desbordamiento, así que `"by": { "const": -2 }` elimina dos. Un paso que además nombra un `kind` solo elimina marcas de ese tipo: "Catch your breath" de Gravewatch es `{ "track": "harm", "kind": "knock", "to": "min" }`, que cura los golpes y deja los desgarros. Un paso que AÑADIRÍA marcas no hace nada, porque un descanso no causa daño, y eso incluye un `"by"` positivo: se omite sin aviso, así que escribe el signo menos.

#### Casillas numeradas en vez de niveles con nombre

Si un contador mide tanto como la resistencia del personaje, dale `boxes` en vez de `levels`. Tiene tantas casillas como su propio `max`, que puede ser un valor que calcula la ficha (nunca uno que lea el estado vivo), hasta 64:

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

- La penalización vigente se lee en `table` (una tabla por peldaños, como la de un valor derivado, con penalizaciones iguales o menores que 0) según el número de casillas `filled` o `remaining`, sea cual sea ese número, así que una tabla puede costar algo sin ninguna marca. No depende de qué casillas estén marcadas.
- Las casillas están numeradas: la ficha muestra "Box 3", y el bloque de ficha del GM indica cuántas hay marcadas de cuántas en vez de nombrar un nivel.

#### Llenar por casilla y contadores que rechazan

- `"fill": "indexed"` coloca una marca en la casilla que nombra el comando con `box=` (la primera si no nombra ninguna), o en la siguiente libre por encima de ella, y nunca mueve una marca ya colocada. Una curación elimina la más alta de las marcas más leves. La pantalla de ficha permite al jugador hacer clic en cualquier casilla libre.
- `"onFull": "refuse"` rechaza una marca que no tiene casilla libre, en vez de aumentar la gravedad de la marca más leve. Se rechaza el comando entero, así que tres marcas con dos casillas libres no colocan ninguna. Un contador indexado siempre rechaza; indícalo con `"onFull": "refuse"` a su lado.

#### Niveles que añade una lista

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` en un contador con niveles con nombre permite que una lista de la ficha lo alargue para cada personaje. Cada fila, en orden, añade su cantidad de niveles (16 como máximo) con su penalización, después del último nivel cuya penalización sea al menos igual de buena, con el nombre de ese nivel si las penalizaciones coinciden y, si no, con el de la penalización. Las cicatrices de Gravewatch funcionan así. Una lista que la ficha oculta no añade nada, y si se borra una fila mientras sus niveles están marcados, las marcas que ya no caben se conservan como desbordamiento: editar la ficha no deshace el daño.

`boxes`, `fill`, `onFull`, `extra` y el `kind` de un paso de descanso requieren Capability API 1.40 en un conjunto empaquetado.

### La penalización de las tiradas

`resolution.penaltyFrom` nombra el contador de heridas que penaliza todas las pruebas del conjunto. Se declara, no se presupone: sin él, las tiradas funcionan igual que antes de que existieran los contadores.

Lo que HACE la penalización depende del tipo de resolución, igual que el número de la ficha:

- En `dice-pool`, **quita dados de la reserva**, con mínimo `pool.min`. Un `pool.min` de 1 permite tirar un dado incluso desde el último peldaño; un `pool.min` de 0 permite no tirar ninguno y fallar sin lanzar.
- En `dice-sum`, es un **modificador fijo**, incorporado al mismo número al que ya contribuyen atributo y entrenamiento.

Debe nombrar un contador de heridas. Uno ordinario no tiene penalización y se rechaza al importar. El resultado indica la aplicada, para que el jugador entienda por qué tiró menos dados; el bloque de ficha del GM también muestra el peldaño y su coste.

### Modificadores fuera de la ficha

Algunos números de una ficha acompañan a cada tirada a la que afectan: una mochila pesada en cada escalada, una penalización de armadura en cada intento de sigilo, una bendición en todo. `resolution.adjust` lo indica, en cualquiera de los dos tipos:

```json
"adjust": [{ "value": { "derived": "burdened" }, "abilities": ["brawn"] }]
```

- `value` es un valor de la ficha, con la misma forma que lee un valor derivado, incluido el estado vivo. Un número negativo resta. Ember Roads suma el volumen del equipo que lleva cargado un personaje en un Burden, y una tabla por peldaños convierte cada tres puntos en uno menos en cada tirada de Brawn. Una tabla basada en un estado vivo es la forma en que una forma o una postura llega a los dados (consulta Estados vivos).
- `abilities` es opcional. Con él, el modificador solo se aplica a una prueba que tira con uno de esos atributos: el propio atributo, una habilidad o salvación que lo usa, una habilidad tirada con él mediante `with=` o una pareja de atributos que lo incluye. Sin él, se aplica a todas las pruebas.
- Se aplica donde se aplica la penalización por heridas: dados en una reserva, con el mismo mínimo `pool.min`, y un número fijo en una suma, dentro del modificador que suma el registro. Hasta ocho entradas, que se suman en cada prueba.
- Un combate del conjunto lo añade a cada tirada que construye a partir de una ficha, al empezar el combate: un ataque tirado con un atributo o una habilidad, una salvación, una prueba de enfrentamiento y la iniciativa leídas de un atributo, una habilidad o una salvación toman las entradas de ese atributo, y cualquier otra tirada solo toma las entradas que se aplican a todas las tiradas.
- Un personaje sin ficha no obtiene nada de él, igual que no obtiene ningún modificador.

El resultado indica lo que añadió la ficha (`adjust="-2"` en el registro y una línea en la tarjeta de dados), para que el jugador vea por qué una tirada salió así. Requiere Capability API 1.38 en un conjunto empaquetado.

### Descansos

Un descanso es una lista de restauraciones y elementos que borrar. Cada paso nombra un objetivo (`pool`, `poolGroup`, `listPools`, `track` o `state`) y lo fija (`"to": "max"`, `"to": "min"` o un número) o modifica (`"by": { "const": 1 }` o `"by": { "fractionOfMax": 0.5 }`). Si nombra un contador de heridas, solo puede curarlo, así que su `by` es negativo; consulta arriba. Un paso que nombra un estado vivo solo lo fija, en `"default"` o en uno de sus valores. Un paso `poolGroup` con `fractionOfMax` cambia cada reserva del grupo según su propia fracción; añade `"shared": true` (Capability API 1.77) para calcular la fracción sobre el máximo de todo el grupo y repartirla entre las reservas del grupo en el orden en que las lista la ficha, cada una hasta lo que le falta. El descanso largo de 5e, "la mitad del número total de" dados de golpe del personaje, guardados en una reserva por dado, es `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

### Texto del Game Master

- `checkGuidance` sustituye el párrafo integrado que enseña a pedir pruebas. Indica el sistema y cuándo tirar. El GM solo nombra habilidad y dificultad. El motor tira y calcula desde la ficha: no pidas al modelo que haga matemáticas.
- `sheetGuidance` presenta las fichas en el prompt. Explica qué recursos importan y cuándo gastarlos.
- `worldGuidance` es opcional y se lee una vez al generar el mundo para adaptar la ambientación a las reglas: sin pólvora, magia escasa, muertos que caminan. Nunca llega a un turno.
- `sheetSummary` elige campos, valores derivados y filas de listas que ve el GM de cada personaje. El motor siempre muestra modificadores de atributo, habilidades y salvaciones entrenadas y valores vivos. Mantén breve lo demás, pues se envía en cada turno. El `nameColumn` de una lista del resumen puede ser una columna de texto o enum (un enum muestra la etiqueta de su valor), y `columns` nombra hasta tres columnas más de la propia fila que se muestran tras el nombre, para que el bloque diga `Gear: Crowbar 1d6` en vez de solo nombres. Una columna booleana muestra su etiqueta cuando está activada. Ambos requieren Capability API 1.37 en un conjunto empaquetado.
- No hace falta enseñar el comando de ficha en `sheetGuidance`. El motor enseña cada comando por sí mismo, con los nombres que declara tu archivo, y si tu conjunto tiene un contador de heridas añade el comando `op="damage"` para marcarlo y enumera sus niveles y tipos de daño. Si tiene estados vivos, añade el comando `op="state"` y enumera los valores que puede tomar cada uno.

### Referencia completa de reglas para el GM (Capability API 1.145)

El `gmReference` opcional **de nivel superior** contiene la referencia completa de reglas del conjunto para el Game Master, de hasta 16.000 caracteres. Pon aquí las reglas de arbitraje ampliadas y deja las instrucciones breves sobre pruebas y recursos en `gm.checkGuidance` y `gm.sheetGuidance`. Esos campos, y `gm.worldGuidance`, mantienen sus límites de 1.500 caracteres; el texto de las capas también conserva sus límites actuales.

```json
"gmReference": "When a journey crosses hostile country, judge supplies, shelter and exposure before the next leg. A failed navigation check costs time rather than silently moving the party to its destination."
```

La referencia aparece bajo **Game Master rules reference** en el prompt de sistema estable, una vez por solicitud. Nunca se copia en el recordatorio de cada turno. Como el resto del texto apto para prompts, debe ocupar una sola línea, sin caracteres de control, corchetes ni llaves de macro (`{{` y `}}`). Si la solicitud sigue superando el límite de contexto tras los ajustes habituales del historial y del presupuesto de respuesta, la referencia se acorta con un corte marcado antes de recortar las instrucciones principales. Déjala sin definir para mantener los prompts actuales. Un paquete que la use debe declarar en el manifiesto `schemaVersion: 2` y `capabilityApi: { "major": 1, "minor": 145 }` o posterior.

## Relojes de progreso del grupo y de la escena (`clocks`)

Capability API **1.143** añade un objeto `clocks` opcional de nivel superior. Omítelo para mantener desactivados los comandos de reloj. El objeto es estricto: solo acepta estas tres claves.

```json
"clocks": {
  "sizes": [4, 6, 8],
  "max": 8,
  "text": "Create clocks for looming threats and long projects. Tick them when the fiction advances."
}
```

`sizes` admite de uno a seis números enteros distintos de segmentos, cada uno de 2 a 12; de forma predeterminada es `[4, 6, 8]`. `max` es el número máximo de relojes que se conservan a la vez, de 1 a 12, y de forma predeterminada vale 8. El `text` opcional es una línea apta para prompts de hasta 400 caracteres que explica cuándo debe crear y avanzar relojes el GM. Un objeto vacío activa los valores predeterminados.

Los relojes pertenecen al grupo o a la escena, no a un personaje. El recordatorio del GM enumera sus nombres y su llenado en cada turno y enseña estos comandos:

- `[clock: name="Alarm raised" size="6"]` crea un reloj vacío. Un tamaño no permitido, un nombre existente (sin distinguir mayúsculas de minúsculas) o haber alcanzado `max` impiden crearlo.
- `[clock: name="Alarm raised" tick="2"]` añade segmentos. Los avances negativos los quitan; el llenado se limita a `0..size`. Un reloj lleno está completo, sigue visible y cuenta para `max` hasta que se borra. Un avance negativo puede reabrirlo.
- `[clock: name="Alarm raised" clear]` elimina el reloj nombrado.

Los nombres son líneas únicas de 1 a 100 caracteres sin comillas dobles, corchetes, caracteres de control ni llaves de macro. Cada etiqueta pide exactamente una acción. Los comandos se aplican en el orden de la respuesta, así que un reloj se puede crear y avanzar en la misma respuesta. El motor reescribe cada etiqueta con `result="ok" now="4/6"` (o `now="cleared"`), o con `result="refused" reason="..."`. Se descartan los atributos de resultado que aporte el modelo. Se rechazan los relojes desconocidos y las solicitudes mal formadas; se aplican como máximo 40 comandos por respuesta.

Game Mode muestra un círculo segmentado, el nombre y el llenado junto al estado del grupo. Las etiquetas se quedan en la respuesta guardada como comprobantes y se ocultan de la narración. Los relojes se guardan en cada instantánea del estado de la partida como `rulesetClocks`; si faltan datos, no hay relojes. Regenerar parte de la instantánea anterior, continuar parte de la actual, y seleccionar o eliminar swipes o mensajes restaura los relojes junto con el resto de esa instantánea.

## Ficha de grupo: una banda, una nave o Story Points compartidos

Capability API **1.144** añade un `party` opcional de nivel superior, junto a `sheet`. Contiene una ficha compartida por partida, como la banda de Blades, la nave de Lasers & Feelings o los Story Points de Genesys:

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

`fields` usa el mismo esquema de campos que `sheet.fields`; `pools` usa el de `sheet.live.pools`, incluidos `start`, `group`, `hideWhen` y `allowTemp`. Se necesita al menos un campo o una reserva, y sus IDs deben ser únicos dentro de la ficha de grupo. Los IDs de personaje y de grupo pueden coincidir. En esta versión menor, las fichas de grupo no tienen secciones, listas, atributos, valores derivados ni migraciones de ficha de personaje. El `max` de una reserva lee una constante o un campo numérico del grupo. Las fórmulas de personaje no pueden leer valores del grupo, y las fórmulas del grupo no pueden leer valores de personaje. `hideWhen` también nombra solo campos del grupo.

`advancement.fields` nombra los campos number, text o longtext que el GM puede cambiar de forma permanente. `advancement.text` y `text` aceptan cada uno una línea apta para prompts de como máximo 400 caracteres. El `summary` opcional reutiliza `gm.sheetSummary`: sus `fields` seleccionan campos del grupo; `derived` y `lists` deben estar vacíos. Sin resumen, se muestran todos los campos visibles del grupo. Las reservas aparecen siempre.

```text
[sheet: sheet="party" op="restore" pool="coin" amount="3"]
[sheet: sheet="party" op="spend" pool="coin" amount="2"]
[sheet: sheet="party" op="advance" field="heat" by="2"]
[sheet: sheet="party" op="advance" field="upgrades" to="Hidden vault"]
```

`sheet="party"` selecciona la ficha compartida; omite `who`. El `who="party"` existente sigue aplicándose a cada **personaje** y nunca cambia la ficha compartida. Esta versión menor permite `spend`, `restore` y el `advance` de campos en la ficha de grupo. Las fichas desconocidas, las operaciones no admitidas, las reservas insuficientes, los avances no declarados y los valores no válidos se rechazan y se reescriben con el resultado del motor. Las reservas del grupo siguen la misma aritmética de actual y máximo, y los mismos valores predeterminados, que las reservas de personaje.

El GM recibe en cada turno la etiqueta, los campos y las reservas del grupo junto a los bloques de ficha de los personajes. Game Mode ofrece una ficha de grupo plegable y de solo lectura junto a los retratos de los personajes, con la misma presentación de ficha. Los valores permanentes se guardan una sola vez en los metadatos del chat (`gamePartySheet`), junto a `gameCharacterCards`, y comparten los comprobantes de avance. Las reservas vivas usan la entrada reservada `$party` de `rulesetLive`; los nombres normalizados de personaje no pueden coincidir con ella. Regenerar parte de antes de la respuesta, y seleccionar o eliminar swipes restaura los valores permanentes y vivos mediante el historial existente. Los conjuntos sin `party` mantienen su comportamiento actual.

**Creación compartida del grupo (Capability API 1.163).** Una ficha de grupo puede incluir `lists` (hasta 12, escritas como las listas de la ficha de personaje), un `builder` guiado propio y `fromMembers`: hasta 8 campos numéricos del grupo que se leen de los personajes del grupo, cada uno `{ "field", "count": true }` (cuántos personajes hay) o `{ "field", "sum": "<character number field>" }` (lo que suman los suyos, como los puntos de Totem). Los campos de miembros se calculan a partir de los personajes tal como están cada vez que se lee la ficha compartida, así que, si un personaje se une o se va, cambian al instante. Con listas, el `summary.lists` del grupo puede nombrarlas.

El creador se escribe exactamente igual que el de un personaje (reservas, pasos, filas con precio, ofertas de gasto, perfiles) y sigue las mismas reglas respecto a los campos y las listas propios del grupo. Sus pasos de catálogo y de copia de filas pueden leer los catálogos del conjunto que alimentan las listas del grupo. En Game Mode, cualquier jugador abre Edit en la ficha compartida, que ofrece la configuración guiada, y la guarda para todo el grupo. Cada guardado nombra la revisión sobre la que se abrió (`gamePartySheetRevision` en los metadatos del chat, que sube con cada guardado y con los cambios de la propia historia): un guardado abierto antes de que llegara el de otra persona se rechaza, se muestra la ficha más reciente y el borrador del jugador sigue abierto, así que volver a guardar es su decisión de sustituirla.

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

## Catálogos: entradas preparadas para las listas de la ficha

Escribir una lista de conjuros, una tabla de equipo o una página de rasgos fila por fila es tedioso. Un catálogo es una colección con nombre de entradas preparadas que distribuyes con el conjunto. El editor las ofrece en un selector de cada lista que alimenta el catálogo; elegir una rellena la fila.

Los catálogos son opcionales. Puede haber hasta doce por conjunto; el motor no conoce su temática: todos los IDs, columnas, filtros y palabras proceden del archivo.

### La cabecera

La cabecera va en `catalogs`, en el nivel superior del archivo, junto a `gm`.

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

- `id` y `label`: el ID sigue las reglas de IDs de ficha; la etiqueta da nombre al selector.
- `holds`: `"rows"` (predeterminado y usado por todos los catálogos anteriores a esta versión), `"creatures"` o `"items"`. Un catálogo de criaturas es un bestiario que lee el combate, y un catálogo de objetos enumera cosas que lleva el grupo. Ninguno de los dos escribe en fichas, declara `feeds` ni aparece nunca en el selector. Consulta [Criaturas](#creatures-a-bestiary-a-fight-reads) y [Objetos](#items-what-a-party-carries) más abajo.
- `feeds`: de una a ocho listas de ficha donde pueden escribir las entradas. Obligatorio para filas y rechazado para criaturas u objetos. Una entrada no puede escribir en otra lista ni colocar un valor que sus columnas no admitan.
- `filters`: opcional, hasta ocho. Define cómo acotar el selector: `number`, un valor `text` o `tags` (varias palabras). `startFrom` nombra un campo con el que se abre el selector: un personaje con Calling Tinker ve primero las entradas Tinker.
- `units`: opcional. Define qué significa en el sistema un alcance o tamaño de área del bloque `mechanics`.

### Una entrada

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

- `id`: minúsculas, dígitos y guiones simples, único dentro del catálogo.
- `label` y `summary`: lo que muestra el selector. El resumen es opcional, de una línea y hasta 300 caracteres.
- `filters`: valores de los filtros de la cabecera. Un filtro `number` recibe un número; `text`, una cadena; `tags`, una lista de cadenas.
- `rows`: lo que escribe la selección, entre una y seis filas. `list` pertenece a `feeds`; las claves de `values` son los IDs de columnas de esa lista.
- `creature`: un adversario en vez de filas, para catálogos cuyo `holds` indica criaturas. Cada entrada tiene exactamente uno entre `rows` y `creature`; una criatura no lleva `mechanics`, pues define lo que hace en sus acciones.

Cada valor se valida contra las columnas de destino. Los nombres mal escritos o números fuera de rango se notifican con su entrada de origen. Las entradas incluidas en el archivo de reglas se validan al cargarlo, que para un archivo importado es durante la importación. Un catálogo separado de paquete se valida la primera vez que lo solicita el selector; si contiene un error, muestra sus motivos en vez de entradas.

### Una entrada, varias listas

Un rasgo de usos limitados ocupa dos filas: el rasgo y su contador. Sigue siendo una sola selección.

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

### Valores que mantiene actualizados el conjunto

Los números de una fila pertenecen al jugador desde que la elige. Hay una excepción útil: máximos que dependen del personaje, como usos iguales a un atributo o un recurso de clase que crece por nivel. Una fila puede nombrar hasta cuatro columnas numéricas propias en un mapa `scaled`; el editor mantiene esas celdas actualizadas.

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- La clave es una columna `number` de la lista.
- `from` es una referencia de valor ordinaria, con el mismo vocabulario cerrado del resto del formato. Para algo más complejo, declara un valor `derived` y apúntalo desde `from` (`"from": { "derived": "lay_on_hands_max" }`). Aquí no se añade aritmética nueva.
- `table` es opcional. Consulta el valor de la referencia en una tabla por peldaños, como cuando un nivel determina un número: `"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`.
- `values` debe seguir incluyendo un número ordinario para la columna; omitirlo se rechaza. Es el valor antes de conocer la ficha y el que conserva una ficha sin esa referencia.
- Una fila con `scaled` debe ser la única de la entrada para esa lista; así, una fila marcada siempre coincide con una sola especificación. O bien (Capability API 1.92) cada fila que la entrada escribe en esa lista debe llevar su propio nombre en la columna de nombre de la lista (la `nameColumn` de sus reservas o, si no, su primera columna de texto). Entonces la fila de la ficha se empareja con su especificación por ese nombre, de modo que un rasgo puede dar dos usos que crecen cada uno por su cuenta; una fila que el jugador renombra se deja como está.

El valor se calcula al editar la ficha, nunca al leerla: una fila guardada siempre contiene el número que declara. Se adapta a su columna: se limita entre `min` y `max` y se redondea hacia abajo si admite enteros. En el ejemplo, Heart 3 da tres usos y Heart 0 o menor, ninguno. La fila permanece con 0 usos; un contador con máximo 0 no es una reserva, por lo que no hay nada que gastar.

Las columnas escaladas requieren Capability API 1.23 para conjuntos empaquetados. Los comunitarios importados los valida el motor que los lee, sin requisitos adicionales.

### Las filas elegidas son copias

Cada fila elegida se copia a la ficha con la clave adicional `_catalog`, que contiene `<catalog id>/<entry id>`. Los IDs de columna empiezan por letra, así que esta clave nunca puede ser una tuya.

La copia pertenece al personaje. El jugador puede editarla, la ficha sigue funcionando sin el conjunto instalado y publicar una versión nueva nunca reescribe personajes. La marca permite al selector mostrar lo que ya tiene la ficha y a la función de actualización identificarlo.

### Actualizar desde el conjunto

La marca permite al editor avisar si el texto nuevo difiere de la fila. Una línea bajo la lista indica cuántas filas tienen texto nuevo; **Review** (Revisar) muestra el contenido guardado junto al del conjunto, con una casilla por fila. Nada se escribe hasta pulsar **Update selected** (Actualizar seleccionadas); solo cambian las columnas diferentes de las filas marcadas. Todo lo demás se conserva, incluida la marca.

La comparación es deliberadamente limitada:

- Solo compara valores existentes de columnas `text`, `longtext`, `dice` y `enum`. Los valores `number` y `boolean` pertenecen al jugador y se conservan, incluidos 0 y false. Una columna aún ausente puede ofrecerse con su valor tipado, incluidos números e interruptores. Se excluyen las columnas escaladas, porque ya siguen la ficha.
- Solo compara columnas definidas por la entrada. Las omitidas no se tocan, contengan lo que contengan.
- Se omiten valores que la propia columna rechazaría, como un `enum` retirado o texto superior a `maxLength`.
- La fila se relaciona con su fila de origen por posición entre las que comparten marca en esa lista, mientras la ficha conserve tantas como escribe la entrada. Si no, solo funciona si la entrada escribe una sola fila en esa lista. Si el jugador borra una de dos filas, se deja la entrada intacta en vez de adivinar.
- Si el catálogo ya no tiene la entrada, la fila se deja intacta sin avisos.

Así, reformular o renombrar puede llegar a personajes que ya eligieron la entrada, si lo aceptan. Cambiar el significado de un número no llega ni llegará: la columna pertenece al jugador desde que la fila es suya.

### `mechanics`: qué hace una entrada en números

Una entrada puede incluir `mechanics` opcional para expresar efectos numéricos: `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (dados como `2d6` o número fijo), `amountAdd` (un valor que se lee de la ficha de quien la usa y se suma a la cantidad, como `{ "field": "level_fighter" }` para un Second Wind de 1d10 más el nivel de guerrero; necesita un `amount`, solo se lee en los combates propios del conjunto (los combates Classic y Tactical del motor usan la cantidad tal como está escrita) y es Capability API 1.83), `damageType`, `attackRoll`, `autoHit`, `save` (una salvación de la ficha y el efecto de superarla), `applies` (estados que aplica), `temporary` (puntos temporales de salud), `scales` (cantidad que crece con la ficha), `cost` (reserva que gasta), `perCostStep`, `targetsPerCostStep`, `budget` (parte de la economía de acciones que gasta), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` y `check`.

Un ataque dirigido a enemigos puede dejar algo con lo que golpear en turnos posteriores mediante `summons` (Capability API 1.122). Para Spiritual Weapon, pon `"summons": { "budget": "bonus", "rounds": 10, "move": 20, "reach": 5 }` en su entrada de ataque. El lanzamiento hace el primer ataque y deja el arma junto a su primer objetivo cuando terminan las reacciones; un lanzamiento cancelado no deja nada. Los golpes posteriores solo gastan el presupuesto de economía declarado, mantienen el nivel al que se pagó el lanzamiento para escalar el daño y abren las mismas ventanas de reacción. Las distancias usan la unidad del catálogo; si se omite, el movimiento es cero y el alcance es una casilla. Sobre un tablero, el arma puede golpear a un enemigo que esté dentro de su movimiento más su alcance, ignorando los muros, y se coloca junto a él. Sin tablero, cualquier enemigo en pie está a su alcance. Las rondas se descuentan al final de los turnos del portador, sin contar el turno del lanzamiento. La invocación termina al llegar a cero, al ser derrotado su portador o cuando termina la concentración de su entrada. Volver a lanzar la misma entrada sustituye su invocación.

Una entrada con `area` puede permanecer con `zone` (Capability API 1.172): `{ "rounds", "anchor", "triggers", "atCast" }`. Permanece durante `rounds` (de 1 a 1000) turnos de su lanzador, contados como los de una invocación, y termina antes si termina la concentración que la mantiene o si su lanzador es derrotado. `anchor: "point"` (el predeterminado) conserva las casillas sobre las que se lanzó; `anchor: "caster"` es una explosión alrededor de su lanzador que va adonde va él, así que su alcance es 0. `triggers` indica cuándo vuelve a aplicar el efecto propio de la entrada (amount, plus, save, applies) a una criatura: `enter` (entra en ella, o la alcanza una zona que lleva consigo su lanzador), `turn-start` o `turn-end` (empieza o termina su turno en ella). Una criatura queda alcanzada una vez por turno sea cual sea el activador, y quien quedó alcanzado por el propio lanzamiento cuenta como alcanzado ese turno. A quién alcanza depende de la entrada: `friendlyFire: false` deja fuera al bando del lanzador, una curación o una entrada aliada se limita a él, y una zona que lleva consigo su lanzador nunca lo alcanza a él. `atCast: false` no hace nada al aparecer. Volver a lanzar la entrada sustituye su zona. El tablero colorea sus casillas, el combate la enumera con los turnos que le quedan y el registro indica cada vez que alcanza a alguien. Fuera de un tablero, retiene a quienes estaban bajo el lanzamiento, y `turn-start` y `turn-end` los alcanzan.

```json
"mechanics": { "kind": "attack", "area": { "shape": "burst", "size": 20 }, "range": 120,
  "amount": { "dice": "5d8" }, "damageType": "poison", "save": { "save": "con_save", "onSuccess": "half" },
  "concentration": true, "zone": { "rounds": 100, "triggers": ["enter", "turn-start"] } }
```

Eso es Cloudkill. Spirit Guardians es `"area": { "shape": "burst", "size": 15 }, "range": 0, "friendlyFire": false` con `"zone": { "rounds": 100, "anchor": "caster", "triggers": ["enter", "turn-start"], "atCast": false }`; Moonbeam es una explosión de 5 pies con `"triggers": ["enter", "turn-start"]`.

Una zona mantenida en un punto puede moverse y cambiar su terreno (Capability API 1.173). `move: { "budget", "distance" }` permite a su lanzador moverla en su turno: el combate ofrece "Move <zone>" con ese presupuesto, que se elige en el tablero como un desplazamiento, hacia cualquier casilla a `distance` o menos de su centro. `drift: { "distance" }` la aleja esa distancia en línea recta de su lanzador al empezar cada uno de los turnos de este, deteniéndose en el borde del tablero. En ambos casos, quien quede cubierto ahora y no lo estuviera antes queda alcanzado según indique `enter`. Solo una explosión mantenida en un punto se mueve o deriva. `terrain: { "difficult": true }` hace que entrar en cada una de sus casillas cueste el doble de movimiento a quien alcanza (el terreno que ya es difícil no se vuelve a duplicar), y `terrain: { "perDistance": { "every", "amount", "damageType" } }` inflige `amount` (dados y valor fijo, como los de la propia entrada) a quien alcanza por cada `every` que se mueva dentro de ella, sin salvación, sumando todos sus desplazamientos. El registro indica cada movimiento, cada deriva y cada daño.

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

Cloudkill añade `"drift": { "distance": 10 }`. Spike Growth es una explosión de 20 pies sin cantidad propia, `"triggers": []` (su terreno es lo único que hace), `"atCast": false` y `"terrain": { "difficult": true, "perDistance": { "every": 5, "amount": { "dice": "2d4" }, "damageType": "piercing" } }`.

Una zona puede hacer más a quien alcanza (Capability API 1.174). `breaksConcentration: true` hace que una criatura alcanzada mientras se concentra tire la salvación de concentración del conjunto contra la dificultad de salvación propia de la entrada, antes del efecto de la entrada, y pierda la concentración si falla; la entrada necesita un `save`. `damageCap` termina la zona cuando ha infligido en total esa cantidad de daño desde que apareció, sumando sus alcances y su terreno. Sleet Storm es una explosión de 40 pies con `"save": { "save": "dex" }`, `"applies": [{ "condition": "prone", "duration": "instant" }]` y `"zone": { "rounds": 10, "triggers": ["enter", "turn-start"], "breaksConcentration": true, "terrain": { "difficult": true } }`. Guardian of Faith es una explosión con `"friendlyFire": false`, `"amount": { "flat": 20 }` y `"zone": { "rounds": 1000, "triggers": ["enter", "turn-start"], "atCast": false, "damageCap": 60 }`.

La dificultad contra la que se escapa de un estado aplicado por una entrada puede ser la dificultad de salvación propia de la entrada (1.174): `"escapeDc": "save"` en la entrada de `applies`, junto a un enfrentamiento cuyo `from.holding` es ese estado. Web y Black Tentacles apresan con `{ "condition": "restrained", "duration": "until-save", "escapeDc": "save" }`, y el enfrentamiento para escapar de la criatura apresada se tira contra la CD de salvación de conjuros del lanzador. Si lo aplicó algo sin dificultad de salvación, se escapa según indique el enfrentamiento, contra quien lo mantiene.

El `use` de un objeto también puede llevar `concentration` y `zone` (1.174), como una entrada de catálogo, así que un pergamino de conjuro de Cloudkill o Moonbeam mantiene su área duradera y depende de la concentración de quien lo lee.

Una zona movida puede embestir, y su terreno puede costar más (Capability API 1.175). `move: { ..., "ram": true }` la envía casilla a casilla en línea recta hacia donde se movió; en la primera casilla en la que alcanza a alguien a quien no cubría antes, se detiene, lo alcanza como si lo embistiera (digan lo que digan sus activadores) y no puede volver a moverse ese turno. Las criaturas que entran en ella solo quedan alcanzadas según indiquen sus activadores. Flaming Sphere es una explosión de 5 pies con `"triggers": ["turn-end"]` y `"move": { "budget": "bonus", "distance": 30, "ram": true }`. `terrain.costTimes` (de 2 a 10) hace que cada paso para entrar en ella cueste esa cantidad de pasos normales, y el terreno que ya es difícil no cuesta más que eso: Plant Growth es `"terrain": { "costTimes": 4 }`. Sustituye a `difficult`, que equivale a `costTimes: 2`. `terrain.halvesSpeed: true` hace que cada paso en su interior vuelva a costar el doble, además de cualquier terreno difícil: Spirit Guardians es `"terrain": { "halvesSpeed": true }`.

Las sujeciones que impone un conjuro solo se pueden romper como indique el conjuro (también 1.175). Un enfrentamiento para liberarse con `"from": { "holding": "restrained", "escapable": true }` solo se ofrece contra una sujeción que nombre un `escapeDc`, así que el mismo enfrentamiento rompe una telaraña y nunca una petrificación. `applies[].escapeChecks` nombra las pruebas de enfrentamiento que pueden romper esa sujeción, en lugar de las pruebas de atacante del propio enfrentamiento: Black Tentacles apresa con `"escapeDc": "save", "escapeChecks": ["might", "agility"]`, y Web con `"escapeChecks": ["might"]`. `zone.whileHeld: { "condition", "amount", "damageType" }` inflige su cantidad, sin salvación y en lugar del efecto propio de la zona, a quien empieza un turno en ella ya sujeto por ese estado procedente de su lanzador: el `"whileHeld": { "condition": "restrained", "amount": { "dice": "3d6" }, "damageType": "bludgeoning" }` de Black Tentacles.

Una entrada o el uso de un objeto pueden curar (Capability API 1.176). `ends: { "conditions": [...], "count"? }` quita esos estados a su objetivo en el orden nombrado, como máximo `count` de ellos: Lesser Restoration es `"ends": { "conditions": ["blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. `stabilizes: true` estabiliza a un objetivo moribundo, que deja de tirar salvaciones contra la muerte, y necesita un bloque de combate con una regla `dying`: Spare the Dying. `revives: { "withinRounds", "health" }` solo se dirige a alguien que murió hace no más de esa cantidad de rondas y lo devuelve con esa salud: Revivify es `"revives": { "withinRounds": 10, "health": { "flat": 1 } }`. Una entrada que solo termina estados o estabiliza solo se ofrece contra alguien a quien ayudaría; una del tipo `utility` sin nada más que hacer se ofrece mientras cure.

Las áreas pueden ser cajas, y las duraderas, muros (Capability API 1.177). `area.shape: "box"` es un cuadrado de `size` de lado cuya esquina más cercana se sitúa en la casilla apuntada y que se extiende alejándose de su creador; en un eje en el que su creador está alineado con ella, se centra en esa casilla. Sin `range`, se sitúa pegada a su creador. Web es `"area": { "shape": "box", "size": 20 }` con un alcance de 60. `area.shape: "wall"` solo existe como área que permanece, así que necesita una `zone`: mide `size` de largo y `width` de grosor (una casilla si no se indica), y atraviesa la casilla apuntada en perpendicular a la línea que viene de su creador, o va desde ahí hacia la casilla `toward` de la elección; `"ring": <diameter>` permite a su lanzador colocarlo en cambio como un anillo de ese diámetro alrededor de la casilla apuntada, cuando la elección indica `"ring": true`. Un muro no necesita activador: Wind Wall solo aplica su efecto al aparecer. Un muro nunca se mueve, ni deriva, ni sigue a su creador. `zone.blocks: ["move", "sight"]` cierra sus casillas al paso, a la vista o a ambos mientras se mantiene, y quien esté donde se levanta se coloca en la casilla libre más cercana (en el lado elegido cuando hay una igual de cerca): Wall of Stone bloquea ambos; Wall of Force, el movimiento; Wall of Fire, la vista. `zone.side: { "distance", "triggers" }` hace que las casillas a `distance` o menos de uno de sus lados alcancen según indiquen sus propios `triggers`, además de las casillas del propio muro; el `side` de la elección indica cuál: `near`, el de su creador (dentro de un anillo), o `far` (fuera); si se omite, far. Wall of Fire es `"area": { "shape": "wall", "size": 60, "ring": 20 }`, `"zone": { "rounds": 10, "triggers": ["enter", "turn-end"], "blocks": ["sight"], "side": { "distance": 10, "triggers": ["turn-end"] } }`.

La visión importa (Capability API 1.178). `combat.senses` enumera los sentidos que ven donde los ojos no pueden, cada uno `{ "id", "label", "sheet"?, "blind"? }`: el alcance de un personaje se lee de su ficha mediante `sheet` (nada si es cero), una criatura lleva el suyo como `"senses": { "darkvision": 60 }` en la distancia del conjunto, y un sentido `blind` (vista ciega, sentido de la vibración) funciona sin ojos. Entonces el bloque necesita `combat.distance`. Una zona con `obscures` oculta todo lo que hay en ella, y todo lo que se ve a través de ella, a quien no tenga a su alcance ninguno de los sentidos que enumera su `pierced`: Fog Cloud es `"obscures": {}`, y Darkness, `"obscures": { "pierced": ["blindsight", "truesight"] }`. Una zona así no necesita activador, y una entrada `utility` que no hace nada más que dejar un área en pie (Fog Cloud, Darkness, un muro) está en el menú y se coloca donde elija su lanzador. Una entrada de `combat.conditions` con `unseen` oculta del mismo modo a quien la tiene: invisible es `"unseen": { "pierced": ["blindsight", "truesight"] }`. `combat.sight` indica lo que esto hace: `unseenAttacks: true` da ventaja a un ataque cuando su objetivo no puede ver al atacante y desventaja cuando el atacante no puede ver a su objetivo, y `eyes` nombra el sentido (como lo nombra el `lacks` de un estado) que es la vista, así que una criatura cegada solo ve mediante un sentido `blind`. Una entrada o acción de criatura con `seen: true` solo puede elegir objetivos que su creador pueda ver, como dice "una criatura que puedas ver dentro del alcance". Una explosión o una caja se puede colocar varias veces a la vez con `area.copies` (de 2 a 10), cada copia tocando a otra, y el jugador coloca cada una: Fire Storm es `"area": { "shape": "box", "size": 10, "copies": 10 }`. Una zona colocada varias veces se queda donde se lanza.

Las zonas pueden actuar sobre quien está en ellas (Capability API 1.179). `combat.components` nombra lo que puede necesitar el uso de algo, cada uno `{ "id", "label" }` (los componentes verbal, somático y material de 5e), y una entrada o la acción de una criatura enumeran los suyos en `components`. El `inside` de una zona aplica `conditions` a quien esté en ella y le evita los tipos de daño de `immune` mientras permanezca; su `forbids: { "components": [...] }` impide usar dentro cualquier cosa que los necesite, como hace el `forbids` de un estado con quien lo tiene (amordazado). Silence es `"inside": { "conditions": ["deafened"], "immune": ["thunder"] }, "forbids": { "components": ["verbal"] }`. El `wards: { "catalogs": [...], "maxLevel": N }` de una zona protege a quien está dentro de cualquier cosa de esos catálogos usada desde fuera a nivel N o inferior, juzgada al nivel al que se paga: Globe of Invulnerability es `"wards": { "catalogs": ["spells"], "maxLevel": 5 }`. Un estado que quita presupuestos (`budgets` con un `flat` negativo), aplicado durante el propio turno de quien lo tiene, también los quita de ese turno, así que la salvación fallida de Stinking Cloud al empezar el turno cuesta la acción de ese turno.

Los sentidos y la visión van más allá (Capability API 1.180). Un estado que aplica una entrada puede terminar cuando quien lo tiene actúa: `"endsWhenHolder": { "attacks": true, "casts": ["spells"] }` lo quita en cuanto ha hecho un ataque o ha usado una entrada de un catálogo que nombra, y el uso de un objeto que indica `"casts": "spells"` (un pergamino, una varita) cuenta como lanzar desde ese catálogo. El ataque o el conjuro que lo terminó todavía lo tenía, así que Invisibility da ventaja a su único ataque y luego desaparece. Lo que hace por sí misma una zona en pie no cuenta como una acción de su lanzador. Un estado de `combat.conditions`, o el efecto `worn` o `carried` de un objeto, puede dar sentidos con un alcance en la distancia del conjunto, `"senses": { "darkvision": 60 }`; mientras dura, cuenta el mayor entre ese alcance y el propio de quien lo tiene, así que funcionan el conjuro Darkvision, True Seeing (`{ "truesight": 120 }`) y las goggles of night. Un estado con `"cancelsUnseen": true` permite a todos ver a quien lo tiene, sea cual sea el estado que lo oculta, igual que Faerie Fire perfila a los invisibles; las zonas que ocultan y los muros siguen ocultándolo.

Las protecciones, las salvaciones, el lanzamiento de conjuros de los monstruos y los pergaminos van más allá (Capability API 1.181). El `wards` de una zona compara el nivel al que se pagó un conjuro, salvo que indique `"by": "base"`, que compara el nivel propio del conjuro, se pagara como se pagara, como hace Globe of Invulnerability. `"maxLevelPerCostStep": 1` deja fuera un nivel más por cada paso que se pagó el propio lanzamiento de la protección por encima de su base. El `save` de una entrada o de la acción de una criatura puede indicar contra qué más cuenta, `"against": { "damage": ["poison"] }`, para que se le aplique un modificador de salvación `against` veneno, y quién tiene éxito sin tirar: `"succeeds": { "immune": ["poison"], "conditionImmune": ["poisoned"], "is": { "tags": ["nonbreathing"] } }` (basta con uno), como necesita Stinking Cloud. El `spellcasting` de una criatura puede indicar lo que necesitan sus conjuros en lugar de los `components` de cada entrada, para todo el rasgo o por conjuro, con `[]` para el lanzamiento innato que no necesita ninguno, así que Silence no lo detiene. El uso de un objeto puede ser `"kind": "utility"` cuando lo único que hace es dejar un área en pie (un pergamino de Fog Cloud, Darkness, Silence o Globe of Invulnerability); necesita un `area` y una `zone`.

Empujones, vientos y gafas (Capability API 1.182). El `"push": 15` de una entrada empuja a quien alcanza y no se salva 15 de la distancia del catálogo en línea recta, alejándolo de su creador, y se detiene ante cualquier cosa sólida o cualquiera que esté en pie; una zona empuja del mismo modo a quien alcanza. Una zona que mantiene su lanzador (`"anchor": "caster"`) ahora puede ser una línea o un cono además de una explosión: apunta en la dirección en que se lanzó y va adonde va su lanzador, y `"turn": { "budget": "bonus" }` le permite gastar ese presupuesto en su turno para orientarla en otra dirección, alcanzando a quien cubra ahora como si hubiera entrado en ella (el Gust of Wind de 5e). El `terrain` de una zona con `"towardCaster": true` hace que su terreno difícil solo cuente para un paso que acerque a quien se mueve a su lanzador. Un sentido que da un estado o un objeto puede ser `{ "add": 60 }` en vez de un alcance, lo que suma al alcance propio de ese sentido de quien lo tiene, o da 60 a quien no lo tiene (las goggles of night de 5e).

Zonas que estallan más tarde o se consumen (Capability API 1.183). Una zona con `"detonates"` no hace nada mientras está en pie ni al lanzarse: cuando termina, porque terminó su concentración, se agotaron sus rondas o se volvió a lanzar, aplica una vez el efecto propio de la entrada a todos los que estén en ella. `"grows": { "dice": "1d6" }` suma eso a su cantidad al final de cada turno de su lanzador, incluido el turno en que se lanzó, así que tira los mismos dados que la cantidad propia de la entrada; `"touched": true` hace que quien se mueva a su centro tire la salvación de la entrada, y la hace estallar si falla (el Delayed Blast Fireball de 5e). Se queda donde se lanzó. Una zona con `"burns": { "by": ["fire"], "amount": { "dice": "2d4" }, "damageType": "fire" }` se prende cuando cae daño de uno de esos tipos sobre cualquiera de sus casillas o sobre alguien que esté en ella; se consume cuando vuelve a llegar el turno de su lanzador, lo que termina el conjuro, y mientras tanto inflige su cantidad sin salvación a cualquier otro que empiece un turno en ella (el Web de 5e).

Las criaturas también empujan (Capability API 1.184). La acción de una criatura acepta `"push": 60` en la distancia propia del conjunto, como una entrada de catálogo: quien recibe el golpe es empujado esa distancia en línea recta, alejándose de la criatura, y, con un `save`, solo cuando lo falla, así que `"onSuccess": "none"` mantiene el daño y solo le ahorra el empujón y lo que aplica `applies` (la Tail de una tortuga dragón). El uso de un objeto puede dar a una línea su `width`, como los 60 por 10 pies de un pergamino de Gust of Wind.

Lo que es una criatura cuenta más (Capability API 1.185). Una salvación puede indicar `"modes": [{ "is": { "types": ["undead"] }, "mode": "disadvantage" }]`, de modo que un objetivo que sea eso la tira dos veces y se queda con la peor (Sunbeam); el `"maxAgainst": { "types": ["plant"] }` de una entrada inflige su daño máximo a un objetivo que sea eso (Blight). `targetTypes` también puede indicar `"abilityAtMost": { "int": 3 }`, para un objetivo cuya puntuación sea como máximo esa (una criatura escrita sin esa puntuación no queda excluida), y `"notImmuneTo": ["charmed"]` (Sleep). El modificador de un estado puede tirar los ataques dos veces: `{ "to": "attacks", "mode": "disadvantage", "atSource": true }` son los propios ataques de quien lo tiene contra quien se lo aplicó (Chill Touch), y `{ "to": "attacks-taken", "mode": "disadvantage", "from": { "types": ["fiend", "undead"] } }` son los ataques que hacen contra quien lo tiene los atacantes que sean eso (Protection from Evil and Good). Un cambio a las salvaciones puede ser `"against": { "from": { "types": ["dragon"] } }`, que coincide con cualquier salvación contra algo que hizo una criatura de ese tipo (Dragon Scale Mail).

Las acciones de una criatura pueden recargarse juntas (Capability API 1.186): da a cada `"recharge"` el mismo `"group"` y los mismos dados, y usar cualquiera gasta ambas, mientras que una sola tirada al inicio del turno de la criatura recupera las dos (las dos armas de aliento de un dragón metálico). Un golpe puede incluir `"charge"`: `{ "atLeast": 10, "plus": [{ "dice": "2d8", "type": "piercing" }], "save": { "save": "str_save", "difficulty": 14 }, "push": 10, "applies": [{ "condition": "prone", "duration": "instant" }] }` añade sus cláusulas cuando el desplazamiento de la criatura en este turno terminó con una carrera de al menos `atLeast` directamente hacia aquel a quien golpea, con cada paso una casilla más cerca de él; entonces el objetivo hace la salvación y, si falla (o siempre, si no hay salvación), es empujado y recibe los estados (la Charge de un minotauro). Una carga acompaña a un golpe contra un único objetivo y solo se mide sobre un tablero.

El `attack` de un objeto puede decir más sobre lo que golpea (Capability API 1.187). `"against": [{ "is": { "types": ["construct"] }, "toHit": 2 }]` suma al ataque contra un objetivo que sea eso (una mace of smiting). Una cláusula `plus` puede indicar `"not": { "types": ["construct", "undead"] }` para saltarse los objetivos que sean eso, `"blow": "ranged"` para contar solo en un golpe arrojado o disparado (un dwarven thrower) o `"melee"` solo en uno cuerpo a cuerpo, y `"tempHp": true` para dar a quien la empuña puntos de golpe temporales iguales a lo que infligió (una sword of life stealing). Un estado `onHit` puede nombrar `"targetIs"` (un giant slayer que derriba a un gigante) y `"oncePerTurn": true` (una sword of wounding). `"slay": [{ "when": "critical", "not": { "types": ["construct", "undead"] }, "healthAtMost": 99, "save": { "save": "con_save", "difficulty": 15 }, "charges": 1 }]` mata directamente a un objetivo al que el impacto dejó con `healthAtMost` o menos, si falla la salvación cuando la hay, y gasta las cargas del objeto cuando lo hace (una nine lives stealer); `"immuneTo": ["slashing"]` perdona a un objetivo inmune a eso (una vorpal sword). La salud se lee después del daño del golpe.

El `live.conditions` de una ficha, el `clear.conditions` de un descanso y `combat.conditions` admiten hasta 320 entradas (Capability API 1.269; 160 desde 1.188 y 80 antes). Un modificador `to: "attacks"` puede nombrar `"ability": "str"` para que solo cambie los ataques hechos con ese atributo (el Weakening Breath de un dragón de oro), y un modificador `to: "checks"` puede nombrar `"abilities": ["str"]` para que solo cambie las pruebas de atributo hechas con uno de ellos, incluidas las pruebas enfrentadas y las pruebas de habilidad de ese atributo (la Rage de un bárbaro). Las acciones del perfil de una criatura no nombran ningún atributo, así que un modificador de ataques restringido a un atributo nunca las alcanza.

Un estado de `combat.conditions` puede dañar a quien lo tiene (Capability API 1.189): `"harms": { "at": "turn-start", "dice": "1d4", "type": "necrotic" }` inflige eso al empezar cada uno de sus turnos (o `"turn-end"`), de parte de quien lo aplicó, antes de cualquier salvación que lo termine. `"stacks": 10` permite volver a aplicarlo mientras dura, hasta esa cantidad de veces, y su daño se inflige una vez por cada una (una sword of wounding); terminarlo los termina todos. `"onePerSource": true` lo mantiene en un solo portador por origen: si se aplica a otra persona, deja a quien lo tenía del mismo origen (el enemigo jurado de un oathbow). La entrada `against` del ataque de un objeto puede nombrar `"marked": "sworn"` en lugar de `is` o junto a él, lo que coincide con un objetivo que tiene ese estado procedente de quien empuña el arma, y, además de `toHit`, puede indicar `"mode": "advantage"`, `"ignoresCover": true` (la cobertura inferior a la total no cuenta) y `"ignoresLongRange": true`; una cláusula `plus` también puede indicar `"marked": "sworn"` (los 3d6 perforantes del oathbow). La acción del perfil de una criatura puede nombrar `"ability": "str"`, el atributo con el que se hace su ataque, para que la alcancen los cambios a los ataques o al daño restringidos a un atributo.

Una entrada `modes` del ataque de un objeto puede ser una forma totalmente distinta de usar el arma (Capability API 1.190): `"range": { "normal": 120 }` es hasta dónde llega en ese modo, en la distancia propia del conjunto; `"plus"` añade cláusulas a un impacto, como las del propio ataque; `"line": { "dice": "4d6", "type": "lightning", "save": { "save": "dex_save", "difficulty": 13, "onSuccess": "half" } }` es un rayo contra el que se salvan todos los que estén entre quien empuña el arma y el objetivo (ninguno de ellos dos) antes de tirar el ataque; y `"charges": 1` gasta esa cantidad de las cargas propias del objeto, así que el modo solo se ofrece mientras las tenga (una javelin of lightning: `charges.max` 1 y `stack` 1 en el objeto). Una línea necesita un tablero por el que avanzar.

Un estado de combate con el efecto `"cannot-heal"` impide cualquier curación a quien lo tiene mientras dura, y el registro lo indica (Capability API 1.191): el Chill Touch de 5e. `"conditionImmunitiesFrom": [{ "conditions": ["charmed", "frightened"], "from": { "types": ["fiend", "undead"] } }]` en un estado de combate impide esos estados solo cuando los aplica una criatura que cumple `from`; uno que ya esté aplicado se queda (Protection from Evil and Good). El `targetTypes.abilityAtLeast` de un conjuro es el mínimo cuyo máximo es `abilityAtMost`: `{ "int": 5 }` pasa por alto a una criatura con Inteligencia 4 o menos (Hideous Laughter), y una criatura escrita sin esa puntuación no queda excluida. El `against.actions` de un modificador de salvaciones nombra acciones por ID, nombre o grupo de recarga compartido, sin distinguir mayúsculas de minúsculas, y restringe todo lo demás que indica `against`: `{ "from": { "types": ["dragon"] }, "actions": ["frightful_presence", "breath_weapons"] }` es el aliento o la Frightful Presence de un dragón y nunca su Wing Attack, y también cuenta la salvación repetida para terminar un estado que aplicó una de ellas.

El ataque de un objeto puede llevar más efectos adicionales (Capability API 1.192). `"ignoresResistance": true` deja pasar su daño a través de la resistencia del objetivo al tipo de daño propio del ataque, incluida la resistencia a todo, mientras que una cláusula `plus` de otro tipo sigue reduciéndose a la mitad (el daño cortante de una vorpal sword); la inmunidad se mantiene. El `"saved"` de una entrada `slay` enumera estados, con la misma forma que `applies`, que recibe en su lugar un objetivo que supera la salvación de ese slay: `[{ "condition": "frightened", "duration": { "rounds": 1, "of": "source" } }]` es el infernal asustado de quien empuña una mace of disruption hasta el final del siguiente turno de este. `"othersWhileMarked": { "condition": "sworn", "mode": "disadvantage" }` hace que cualquier otro ataque con arma de quien la empuña se tire con ese modo mientras siga en pie una criatura a la que aplicó `sworn`, o solo los ataques a distancia con `"ranged": true` (un oathbow). Y, en un combate sin tablero, una acción de área (de una criatura o de un conjuro) se puede dirigir a gente de cualquier bando, nunca a su creador, porque alcanza a cada criatura que esté dentro; `friendlyFire: false` la limita al otro bando, como sobre un tablero.

Un enfrentamiento puede ser una prueba contra un número fijo en lugar de una tirada enfrentada (Capability API 1.193). Omite `defender` y da `"difficulty": 15`; el actor tira la mejor de sus pruebas `attacker` y gana si iguala ese número. `"targets"` indica sobre quién se puede hacer: `"enemy"` (el predeterminado), `"ally"` o `"any"`, incluido el actor. `"targetHolds": "wounded"` solo lo ofrece sobre un objetivo que tenga ese estado, y `"targetDying": true` solo sobre uno moribundo que aún no esté estable. `onWin.stabilizes` estabiliza a un objetivo moribundo. Así, una prueba de Sabiduría (Medicina) CD 15 que termina las heridas de una sword of wounding es `{ "difficulty": 15, "targets": "any", "targetHolds": "wounded", "onWin": { "ends": [{ "condition": "wounded", "on": "target" }] } }`, y la de CD 10 que salva a los moribundos es `{ "difficulty": 10, "targets": "ally", "targetDying": true, "onWin": { "stabilizes": true } }`. Un combate de reservas cuenta éxitos, así que rechaza `difficulty`. El `"healedOnlyByRest": true` del ataque de un objeto sella los puntos de golpe que quita: ninguna curación lleva a quien lo recibe por encima de su máximo menos lo sellado, y cualquier descanso los restaura y elimina el sello. El `harms` de un estado de combate acepta el mismo `"healedOnlyByRest": true`, así que las heridas que deja la espada también sellan lo que quitan.

Un tamaño puede ocupar más de una casilla (Capability API 1.194). Da a una entrada de `combat.sizes.order` un recuento `"cells"`, `{ "id": "large", "label": "Large", "cells": 2 }`, y una criatura de ese tamaño ocupará esa cantidad de casillas de lado en un tablero, siendo su propia casilla la superior izquierda: el Large de 5e es 2; Huge, 3, y Gargantuan, 4. Se coloca donde cabe entera, en el lugar más cercano a donde se pidió que estuviera. El alcance y la distancia se miden desde y hasta la casilla más cercana que ocupa, así que una espada alcanza a un ogro desde junto a cualquiera de sus cuatro casillas; solo camina por donde cabe entera y nadie atraviesa ninguna parte de ella; un área la alcanza cuando cualquiera de sus casillas está dentro; un empujón la mueve entera; y se la ve, y tiene la cobertura que tenga, desde la más despejada de sus casillas. Un tamaño sin `cells` ocupa una, exactamente como antes.

Un estado puede hacer más grande o más pequeño a quien lo tiene (Capability API 1.195). Da a una entrada de `combat.conditions` un `"size": { "steps": 1 }` y, mientras dure, quien lo tiene avanza esa cantidad de tamaños en `combat.sizes.order`, o retrocede con un número negativo, nunca más allá del primero ni del último: el Enlarge de 5e es `1`, y el Reduce, `-1`. Su alcance, lo que alcanzan las áreas y cualquier cosa que pregunte por su tamaño leen el nuevo, y cuando termina vuelve a su propio tamaño. Sobre un tablero, quien crece ocupa su nuevo tamaño sobre todas las casillas en las que estaba, si cabe en terreno despejado y libre de los demás, o el mayor tamaño inferior que quepa, así que un ogro agrandado en un pasillo solo crece tanto como permite el pasillo; quien encoge conserva su casilla superior izquierda. El registro indica quién cambió y a qué. Necesita `combat.sizes`; combínalo con un modificador `damage` para los dados del arma y con un modo `checks` y `saves` de Fuerza para el resto del conjuro.

Una entrada puede elegir sus objetivos según la salud que les queda (Capability API 1.196). `"healthPool": { "dice": "5d8" }` en sus `mechanics` se tira una vez al usarla y se reparte empezando por el objetivo con menos salud restante: cada uno solo resulta afectado mientras su salud no supere lo que queda, que entonces consume, y los demás quedan totalmente al margen, como funcionan Sleep y Color Spray de 5e; `perCostStep` lo aumenta cuando se lanza a un nivel superior. `"healthAtMost": 150` solo afecta a un objetivo con esa salud o menos, como Power Word Stun; `"kills": true` mata directamente a quien afecta, así que Power Word Kill es `"healthAtMost": 100, "kills": true`. Ambos leen la salud que le queda a un objetivo, después de que `targetTypes` haya dicho a quién puede afectar. El registro indica lo que tiró una reserva y para quién alcanzó.

Un modificador de daño puede tirar los propios dados de un golpe más veces (Capability API 1.197). `{ "to": "damage", "attacks": "weapon", "ability": "str", "diceTimes": 2 }` en un estado hace que el 1d8 + 2 de un pico de guerra inflija 2d8 + 2 mientras dura, como las armas de un duergar agrandado; su parte fija sigue igual, un crítico duplica los dados extra como duplica el resto, y la media del menú los cuenta. Cambia el daño que inflige un golpe y nada más. La acción de una criatura con `"self": true` usada en su propio turno ahora recae sobre la propia criatura, como ya hacía en una reacción, así que se aplican sus `applies`.

Una zona puede infligir en sus activadores un tipo de daño distinto del que inflige al aparecer (Capability API 1.198). `"zone": { "rounds": 100, "triggers": ["enter"], "atCast": true, "damageType": "slashing" }` en una entrada cuyo propio `damageType` es `"piercing"` inflige daño perforante a quien rodea el muro al aparecer y daño cortante a quien entre en él después, como hace el Wall of Thorns de 5e. Necesita el `amount` propio de la entrada y un activador, un lado o una embestida con los que infligirlo, y nombra uno de los `combat.damageTypes` cuando el conjunto los declara.

Una reserva de salud puede pasar por alto a algunos de sus objetivos (Capability API 1.199). `"healthPoolSkips": { "conditions": ["unconscious"] }` junto a un `healthPool` deja al margen a quien tenga uno de esos estados y no gasta reserva en él, como Sleep de 5e ignora a los inconscientes; `"unseeing": true` hace lo mismo con quien no puede ver al creador de la entrada (cegado, o sin línea de visión hacia él), como Color Spray ignora a las criaturas que no pueden ver. Nombra `conditions`, `unseeing` o ambos, y necesita un `healthPool`.

Un muro puede estar formado por secciones que se golpean y se rompen una a una (Capability API 1.200). `"zone": { "rounds": 100, "triggers": [], "blocks": ["move", "sight"], "sections": { "every": 10, "health": 30, "defense": 12, "vulnerable": ["fire"], "broken": { "triggers": ["enter"], "amount": { "dice": "5d6" }, "damageType": "cold", "save": "con_save", "onSave": "half" } } }` es el Wall of Ice de 5e: cada panel de 10 pies tiene CA 12 y 30 puntos de golpe y recibe el doble de daño de fuego (`resist` e `immune` funcionan igual). Un ataque que se dirige a un enemigo o a cualquiera e inflige daño puede apuntar en su lugar a una sección: su opción enumera como `walls` las casillas que puede golpear, y la elección nombra una de ellas como `wall`. El ataque se tira y su daño se inflige como contra una criatura, y el registro indica lo que recibió la sección y lo que le queda. Una sección reducida a 0 se rompe: deja de bloquear, y quien entra en ella (o empieza o termina allí un turno, según indiquen sus `triggers`) recibe su `amount`, una vez por turno, y se salva con su `save` contra la dificultad propia de la entrada para recibir la mitad (`onSave: "none"` para no recibir nada). Las secciones necesitan un muro con `blocks`, y el `save` de una sección rota necesita el `save` propio de la entrada.

Una entrada puede mover los contadores vivos de la ficha y devolver salud sellada (Capability API 1.201). `"tracks": [{ "track": "exhaustion", "by": -1 }]` quita un nivel de agotamiento a quien alcanza, como hace el Greater Restoration de 5e, y `"by": 1` en una entrada con salvación (Sickening Radiance) suma uno a quien la falla. Cada contador se limita a sus propios márgenes, los niveles que reducen a la mitad el máximo de salud surten efecto de inmediato, y alcanzar un nivel con `defeats` mata. `"unseals": true` devuelve la salud que solo devolvería un descanso (lo que quitó un golpe con `seals`), igual que Greater Restoration termina una reducción del máximo de puntos de golpe. Una entrada que solo cura de esta forma solo se ofrece sobre alguien a quien ayudaría. El `broken` de una sección de muro puede llevar su propio `perCostStep`, que se suma una vez por cada paso que se pagó el lanzamiento por encima de su base: el aire gélido de Wall of Ice, `{ "dice": "1d6" }`. Los contadores son contadores simples, no contadores de heridas, y `unseals` necesita que la salud se lleve en puntos.

Un estado que aplica una entrada puede terminar con otro que esa entrada también aplica (Capability API 1.202). En `"applies": [{ "condition": "charmed", "duration": { "rounds": 10 }, "saveEnds": { "save": "wis_save", "at": "damaged" } }, { "condition": "incapacitated", "duration": "instant", "endsWith": "charmed" }]`, el Hypnotic Pattern de 5e, la incapacitación termina siempre que termina el hechizamiento: una salvación, una cura, la ruptura de la concentración de su lanzador, un aliado que lo sacude para despertarlo o el final del combate. Solo se va con él el estado aplicado por el mismo uso, y el registro indica por qué. `endsWith` nombra otro estado de la misma lista `applies` (o de la lista `onEnd`, `charge` o `saved`), nunca el suyo propio.

La acción de una criatura puede reducir el máximo de salud de su objetivo (Capability API 1.203). `"reducesMax": { "save": "con_save", "difficulty": 14 }` en el Life Drain de un espectro hace que el objetivo tire esa salvación cuando el golpe impacta; si falla, el daño que recibe se resta tanto de su máximo como de su salud, y ninguna curación lo devuelve antes de un descanso. Con `"lasting": true` (el Slam de un gólem de arcilla), ni siquiera un descanso lo hace, solo una entrada con `unseals` (Greater Restoration). Un objetivo cuyo máximo se reduce a 0 de esta forma muere. Una ficha guarda lo que ningún descanso devuelve como el `lasting` de su reserva, dentro de `sealed`. Necesita que la salud se lleve en puntos.

Una cura puede aplicar una de sus curas en vez de todas (Capability API 1.204). Con `"cureOneOf": true`, una entrada que termina algunos estados con `ends`, mueve `tracks` y aplica `unseals` (el Greater Restoration de 5e: hechizado, petrificado, un nivel de agotamiento o el máximo de puntos de golpe) aplica exactamente una: cada una se ofrece como un modo de la opción (un estado, un contador o la reserva de salud, por su etiqueta), como los modos de un arma, y un uso sin ninguno elegido aplica la primera de ellas, en ese orden, para la que el objetivo tenga algo. Necesita al menos dos curas entre las que elegir.

Un máximo reducido puede no necesitar salvación propia (Capability API 1.235). Un `reducesMax` sin `save` ni `difficulty` reduce el máximo con el daño de cada golpe que impacta (el Bite del vampiro de 5e); con `"onFailedSave": true`, solo cuando el objetivo falló la salvación propia de la entrada (el Harm de 5e, una entrada de catálogo con salvación; ahí `reducesMax` nunca tiene salvación propia). `damageType` solo cuenta el daño de ese tipo (el necrótico del Bite), y `"heals": true` devuelve a su creador tantos puntos de golpe como redujo. Las mecánicas de catálogo también aceptan `reducesMax`, y `leavesAtLeast` impide que el daño de la entrada deje al objetivo por debajo de esa cantidad de puntos de golpe (Harm deja 1). `targetHolds` en la acción de una criatura o en las mecánicas de catálogo limita a quién se puede dirigir: a alguien que tenga uno de sus `conditions`, o uno de sus `fromSelf` que le aplicó el creador de la acción (el Bite: agarrado por el vampiro, o incapacitado o apresado).

Un estado puede dar usos propios a quien lo tiene (Capability API 1.236). El `actions` de un estado de combate enumera entradas de catálogo (`spells/break-enchantment`) que quien lo tiene puede usar mientras dura: solo están en el menú entonces, no cuestan nada de la ficha salvo el presupuesto que gasta cada una, y se tiran con los números propios de quien lo tiene, como sus conjuros (una criatura que lanza conjuros usa los de su lanzamiento). Una entrada con `"endsCondition": "<condition>"` termina ese estado en quien la usa una vez usada, y también la concentración que lo mantiene cuando es la de quien la usa: el Dispel Evil and Good de 5e, cuyos Break Enchantment y Dismissal terminan cada uno el conjuro. `ends.from` (una prueba de tipo y etiqueta) solo cura lo que aplicó una criatura que la supera: Break Enchantment termina un hechizamiento o un miedo causado por un celestial, un elemental, un feérico, un infernal o un muerto viviente, y deja el de cualquier otro. `dismisses` saca del combate a quien alcanza y no se salva, vivo, fuera del tablero y del orden de turnos: `true` para siempre (Dismissal), o `{ "while": "<condition>" }` mientras tenga ese estado, que debe aplicar la misma entrada (el Banishment de 5e). Entonces su duración corre en los turnos de su lanzador y, cuando termina, por su tiempo, una salvación o la concentración del lanzador, vuelve donde estaba, o al lugar libre más cercano en el que quepa. Con `gone` (una prueba de tipo y etiqueta), quien la supera y vio el estado durar todo su tiempo se queda fuera.

Un combate puede empezar con parte de sus participantes desprevenidos (Capability API 1.237). La escena dice quiénes: el encuentro del que procede los marca con `"surprised": true`, sean del grupo o enemigos. En su primer turno no pueden moverse ni actuar, y su menú solo contiene terminarlo; no hacen reacciones, ni usos legendarios, hasta que termine ese turno o la primera ronda, lo que llegue antes. Un estado de combate con `"cannotBeSurprised": true` impide que quien lo tiene sea sorprendido nunca: el Foresight de 5e. Una entrada de catálogo con `"ignoresSurpriseWith": "<catalog>/<entry>"` nombra un uso que quien la tiene puede seguir haciendo mientras está sorprendido, y hacerlo termina la sorpresa en ese momento, así que el resto del turno es suyo: el Feral Instinct de 5e, que permite a un bárbaro sorprendido actuar con normalidad si primero entra en furia.

Una entrada de catálogo puede dar a quien la tiene un segundo turno en la primera ronda de un combate (Capability API 1.238). `"extraFirstTurn": { "initiative": -10 }` en una entrada que está en una lista de la ficha sitúa ese segundo turno en la iniciativa de quien la tiene más el número, después de todos los que estén en ese número o por encima; cada uno de los dos es un turno completo, y a partir de la segunda ronda hace un turno por ronda como siempre. Quien queda fuera de combate antes de que llegue el segundo turno simplemente lo pierde. Con `"unlessSurprised": true`, no hay segundo turno para quien empieza el combate sorprendido: el Thief's Reflexes de 5e.

Un estado de combate puede limitar lo que compra su presupuesto concedido a un golpe cuerpo a cuerpo, y dejar una marca en los contadores de quien lo tiene al terminar (Capability API 1.239). Con `"grants": { "budget": "bonus", "attacks": true, "melee": true }`, el único ataque que paga ese presupuesto solo se hace con un arma que golpea a su alcance, y una arrojadiza solo contra alguien a su alcance, ya que se blande en lugar de lanzarse; no se ofrece un arma con distancia y sin alcance. `"onEnd": { "tracks": [{ "track": "exhaustion", "by": 1 }] }` mueve por niveles los contadores vivos de quien lo tiene cuando termina el estado, termine como termine, como hace `tracks` en una entrada de catálogo; `applies` y `tracks` pueden ir juntos o por separado. El `"usesOf": "<row name>"` de una entrada de catálogo gasta los usos de la entrada de esa fila (su fila contador) en vez de los suyos. Así, el Frenzy de 5e es una entrada de Berserker, Frenzied Rage, con `"usesOf": "Rage"`, que aplica la furia y un estado `frenzied` que termina con ella mediante `endsWith`, y que reúne las dos cosas.

La iniciativa puede tirarse dos veces y quedarse con la mejor o la peor (Capability API 1.240). `combat.initiative.checkAbility` indica que la iniciativa es una prueba hecha con ese atributo, así que todo lo que hace tirar dos veces esa prueba hace tirar dos veces la iniciativa: un estado con `own-checks-advantage` (el Foresight de 5e) o un modificador `checks` con un `mode`, restringido a ese atributo o a ninguno (el Cat's Grace de Enhance Ability sobre Destreza). Una entrada de catálogo que está en una lista de la ficha con `"initiativeMode": "advantage"` (o `"disadvantage"`) hace tirar dos veces la iniciativa de quien la tiene, tenga lo que tenga: el Feral Instinct de 5e. La ventaja y la desventaja se anulan, como en cualquier tirada; la entrada de iniciativa del registro lleva `mode` y la tirada descartada en `dropped`. Un combate que tira la iniciativa cada ronda la tira dos veces cada ronda. Solo con dados tirados: la iniciativa de una reserva no se tira dos veces.

Una reacción puede responder al impacto del PROPIO ataque de quien la tiene (Capability API 1.241): una reacción `"hit"` con `"by": "self"` se ofrece al atacante cuando su tirada ha impactado, después de que hayan respondido todos los alcanzados por el golpe, y se dirige a quien impactó (escribe `"at": "target"`). `"weapon": true` limita cualquier momento de impacto al golpe de un arma: un ataque, o la acción de un solo objetivo de una criatura, que no procedan de ningún catálogo. Una reacción al propio impacto no la detiene lo que detiene las reacciones, ya que elegirla forma parte del ataque; márcala como `"free"` salvo que realmente gaste un presupuesto. El Stunning Strike de 5e es una: `"reaction": { "on": "hit", "by": "self", "weapon": true, "blow": "melee", "at": "target" }`, gratuita, con un coste de ki, una salvación de Constitución y `stunned` hasta el final del siguiente turno del monje. Con `"addsToBlow": true`, la cantidad de una entrada de ataque se une a ese golpe en lugar de infligirse por separado: se tira cuando el golpe impacta, la duplica su crítico, y sus cláusulas solo se aplican a un objetivo al que alcanzan. El Divine Smite de 5e es 2d8 radiantes, `perCostStep` 1d8, una cláusula de 1d8 radiantes con `targetIs` infernal o muerto viviente, y `"perCostStepsMax": 3`: la cantidad máxima de pasos de coste superior que cuentan, para cualquier entrada con `perCostStep` o `targetsPerCostStep`. Un ataque hecho dentro de otra ventana (un ataque de oportunidad) nunca se retiene por su impacto, así que no se le añade nada.

Lo que contiene una ficha puede cambiar sus filas de ataque, conceder ataques y esperar a la acción de ataque (Capability API 1.242). Una entrada de catálogo que está en una lista de la ficha con `attackRows` cambia las filas cuyos nombres enumera (sin distinguir mayúsculas de minúsculas), mientras se cumplan sus límites `when` (un valor de la ficha, como la armadura puesta con un máximo de 0): `abilities` usa el mejor entre el atributo propio de la fila y estos para el ataque y, cuando el daño de la fila suma el mismo atributo, para el daño; `die` (`from` un valor de la ficha, mediante una `table` de umbrales, hasta un número de caras) tira un dado de ese tamaño en lugar de los dados de la fila cuando su media es mejor; `qualities` se suman a lo que llevan los golpes para superar una resistencia. El Martial Arts de 5e es `{ "names": ["Unarmed Strike", "Shortsword", ...], "abilities": ["str", "dex"], "die": { "from": { "field": "level_monk" }, "table": [[1, 4], [5, 6], [11, 8], [17, 10]] }, "when": { "value": { "derived": "armor_worn" }, "atMost": 0 } }`, y Ki-Empowered Strikes es `{ "names": ["Unarmed Strike"], "qualities": ["magical"] }`. El `grantsStrike` de una entrada que se tiene permite a quien la tiene comprar un ataque con otro presupuesto una vez gastado el presupuesto propio de un ataque, exactamente como hace el `grants.attacks` de un estado: `names` lo limita a esos ataques; `melee`, al cuerpo a cuerpo, y `afterAttack`, a un turno en el que se hizo la acción de ataque (`true`, o `{ "names": [...] }` para una acción de ataque hecha con uno de esos). El ataque desarmado adicional de Martial Arts es `{ "budget": "bonus", "names": ["Unarmed Strike"], "afterAttack": { "names": [...the monk weapons] } }`. El `grants` de un estado acepta los mismos `names` y `afterAttack`. Una entrada con `afterAttack` solo se ofrece después de la acción de ataque: Flurry of Blows es una entrada `utility` del presupuesto de acción adicional, que gasta un ki, con `afterAttack`, `gives` 2 de un presupuesto declarado con count 0 y un `grantsStrike` de Unarmed Strike con ese presupuesto. La acción de ataque es cualquier ataque hecho desde una lista de ataques o un objeto que paga su propio presupuesto o un ataque que ya compró, nunca uno pagado por una concesión.

Un ataque de oportunidad se retiene donde impacta exactamente igual que un ataque en un turno (Capability API 1.243): se pregunta a todos los que tienen una respuesta a ese impacto, a su creador el último para lo que le añade (Divine Smite, Stunning Strike), y la propia ventana del desplazamiento, con su atacante ya respondido, se sigue preguntando una vez que el golpe ha impactado. Quien se desplaza y queda inmovilizado por el camino (un estado con `speed-zero`, como aturdido o agarrado) no avanza más allá de la casilla en la que fue golpeado. Una entrada que es una reacción o que se añade a otro golpe nunca se elige como el propio ataque de oportunidad.

Las reglas de ataque alcanzan a las armas empuñadas, y una lista de ataques puede dar una fila a todas las fichas (Capability API 1.244). `combat.attacks[].always` enumera hasta 4 filas escritas con las columnas de esa lista que el combate de cada ficha tiene además de las suyas; una fila de la ficha con el mismo nombre se usa en su lugar. El ataque desarmado de 5e es `{ "name": "Unarmed Strike", "ability": "str", "proficient": true, "bonus": 0, "damage": "1", "damage_type": "bludgeoning", "reach": 5 }`. Los `names` de una regla `attackRows` ahora también coinciden con un arma empuñada por el nombre con el que se conoce su ataque, y sus `items` coinciden con armas empuñadas por etiquetas: todas las de `tags` y ninguna de `notTags` (`{ "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] }`, así que una dagger +1 cuenta); una regla nombra `names`, `items` o ambos. `wielding: { "only": {...} }`, con los mismos `names`, `tags` y `notTags`, mantiene una regla solo mientras todas las armas empuñadas sean de esas, o no se empuñe ninguna: "desarmado o empuñando solo armas de monje". Un `grantsStrike` acepta el mismo `wielding` y un `when` como el de una regla `attackRows`, así que el ataque adicional de Martial Arts no se ofrece con armadura.

Varios usos a la vez, una salvación que deja a 0, impactos de ataques con nombre y daño cuando termina un estado (Capability API 1.245). El `usesSpent` de una entrada gasta esa cantidad de usos de su fila (o de la de `usesOf`) en un solo uso, y solo se ofrece mientras queden suficientes: los 3 ki de Quivering Palm. Los `names` de una reacción `"hit"` solo responden a un impacto de esos ataques, comparados por nombre sin distinguir mayúsculas de minúsculas: Quivering Palm es `{ "on": "hit", "by": "self", "names": ["Unarmed Strike"], "at": "target" }`, que aplica un estado `quivering` de larga duración. `dropsOnFailedSave` en una entrada con salvación deja a 0 de salud al objetivo que la falla en lugar de infligir su cantidad (una criatura queda fuera; un personaje, moribundo si el conjunto tiene una regla para moribundos); un objetivo que la supera recibe la cantidad según indique el `onSuccess` de la salvación. Terminar las vibraciones es una acción con `targetHolds: { "fromSelf": ["quivering"] }`, 10d10 necróticos, una salvación de Constitución con `onSuccess: "none"` y `dropsOnFailedSave`. El `onEnd.harm` de un estado (`dice`, `flat`, `type`, `unless`) inflige daño a quien lo tiene cuando termina, de parte de quien lo aplicó, salvo que quien lo tiene sea lo que nombra `unless`: Hurl Through Hell es una reacción al impacto con `dismisses: { "while": "hurled" }` y `hurled` con una duración de `{ "rounds": 1, "of": "source" }`, y el `onEnd` del estado `hurled` es `{ "harm": { "dice": "10d10", "type": "psychic", "unless": { "types": ["fiend"] } } }`.

`afterAttack` también reconoce por etiquetas el arma con la que se hizo la acción de ataque (Capability API 1.246): `{ "names": [...], "items": { "tags": ["simple", "melee"], "notTags": ["two_handed", "heavy"] } }` es después de un ataque con uno de esos nombres o con un arma empuñada que tenga todas las de `tags` y ninguna de `notTags`, se llame como se llame, así que una dagger +1 cuenta. Nombra `names`, `items` o ambos, tanto en una entrada como en un `grantsStrike` o en la concesión de un estado.

Golpes temerarios y brutales (Capability API 1.247). Una entrada con `beforeAttack` solo se ofrece en el propio turno de quien la tiene, antes de que haya atacado en él: Reckless Attack es un `buff` gratuito sobre el bárbaro con `beforeAttack`, que aplica `reckless` durante `{ "rounds": 1 }` y `exposed` durante `{ "rounds": 1, "at": "turn-start" }`. Un cambio a los ataques acepta `attacks` (`weapon`, `spell` o `any`) y `blow` (`melee` o `ranged`) igual que un cambio al daño, con `ability`: `reckless` es `{ "to": "attacks", "mode": "advantage", "ability": "str", "attacks": "weapon", "blow": "melee" }`, y `exposed` tiene el efecto `attacks-against-advantage`. El `criticalDice` de un cambio al daño añade esa cantidad de los dados de daño propios del golpe solo en un impacto crítico, sin duplicarlos: Brutal Critical es un nivel sobre un valor derivado del bárbaro con `{ "to": "damage", "criticalDice": 1, "attacks": "weapon", "blow": "melee" }`, un nivel por cada dado.

Respuestas a los impactos de una ráfaga (Capability API 1.248). El `budget` de un momento `hit` lo limita a los impactos de un ataque pagado con ese presupuesto: Open Hand Technique responde a `{ "on": "hit", "by": "self", "budget": "flurry" }`, el presupuesto que da (`gives`) Flurry of Blows y que gasta su `grantsStrike`. El `oneOf` de una reacción nombra un grupo de respuestas al propio impacto de quien la tiene del que solo se elige una por impacto: Open Hand Technique son tres entradas gratuitas que comparten `"oneOf": "open-hand"`, una con una `save` de Destreza que aplica `prone`, otra con una `save` de Fuerza y un `push` de 15, y otra que aplica un estado con el efecto `cannot-react` durante `{ "rounds": 1, "at": "turn-start" }`. Elegir una gasta las otras dos para ese impacto; el siguiente impacto vuelve a ofrecer las tres. `oneOf` va en un momento `hit` con `by` `self` y sin `also`.

Rescates después de la tirada (Capability API 1.249). Un cambio a `attacks`, `saves` o `checks` con `"rescue": true` se reserva fuera de la tirada: solo cuando la propia tirada de quien lo tiene se queda corta, y su máximo (la parte fija y cada dado en su valor más alto) podría compensar la diferencia, se tira y se suma, y se gasta el estado del que procede. Si no podría cambiar la tirada, se conserva. Bardic Inspiration es un estado aplicado a un aliado con `{ "to": "saves", "dice": "1d6", "rescue": true }` y lo mismo para `attacks` y `checks` (un estado por tamaño de dado, elegido por el nivel del bardo como otras franjas); Guidance es `checks` con `1d4`, y Resistance, `saves` con `1d4`. Un fallo natural nunca se rescata, y un combate con reserva de dados no reserva nada. El `rescue` de una entrada la saca del menú: se gasta, con sus usos y su coste, cuando ha fallado la propia tirada de ese tipo de quien la tiene. `{ "roll": "saves", "by": "reroll" }` vuelve a tirar la salvación y vale la nueva tirada (Indomitable con sus propios usos; Diamond Soul con `usesOf` Ki); `{ "roll": "attacks", "by": "success" }` convierte un fallo en un impacto y `{ "roll": "checks", "by": "success" }`, una prueba fallida en un éxito (Stroke of Luck). Primero se prueban los cambios reservados.

Cutting Words y evasión (Capability API 1.250). El `lowersRoll` de una entrada se usa cuando impacta el ataque de otro, en una reacción `hit` sin `by` (con `for` y `within` para responder por los aliados): sus `dice`, o un `die` cuyo tamaño depende de un valor como el de Martial Arts (`{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }`), se restan de la tirada, que entonces se vuelve a comparar con la defensa; un impacto natural sigue impactando. Cutting Words es un `debuff` gratuito con `{ "on": "hit", "for": "ally", "within": 60 }` y `usesOf` el contador de inspiración del bardo. El `evasion` de un estado de combate o de un nivel nombra salvaciones: contra algo que inflige la mitad con un éxito, una salvación superada no recibe nada y una fallida, la mitad. Evasion es un nivel sobre el nivel del pícaro o del monje con `"evasion": ["dex_save"]`.

Lay on Hands (Capability API 1.251). El `usesChosen` de una entrada permite a quien la usa elegir cuántos de sus usos gasta un solo uso, desde uno hasta lo que quede, y cura esa cantidad de veces su cantidad. La opción lleva `amount: { max }` y la elección envía `amount`; si se omite, gasta lo que cura por completo al primer objetivo de media. Es para un `heal` sin `usesSpent`. Lay on Hands es un `heal` de `"amount": { "flat": 1 }` con `usesOf` un contador de cinco por nivel de paladín, `usesChosen` y `"targetTypes": { "not": { "types": ["undead", "construct"] } }`.

Font of Magic (Capability API 1.252). El `restore` de una entrada devuelve a una reserva de quien alcanza, en un `heal` o un `buff`: una reserva viva por ID, o la reserva de una fila de lista por su nombre (`"Sorcery Points"`). Con un `cost` en una familia de reservas, `perCostStep` lo aumenta por cada paso por encima del más barato, de modo que un espacio de conjuro de un hechicero se convierte en Sorcery Points iguales a su nivel: un `buff` sobre sí mismo que cuesta `slots_1` con `"restore": { "pool": "Sorcery Points", "amount": { "flat": 1 } }` y `"perCostStep": { "flat": 1 }`. `overMax` le permite superar el máximo de la reserva; lo que lo supera se guarda aparte y desaparece cuando un descanso devuelve la reserva a su máximo. Un espacio creado a partir de puntos es una entrada por nivel, `usesOf` los puntos, con `usesSpent` su precio y `"restore": { "pool": "slots_2", "amount": { "flat": 1 }, "overMax": true }`. Una entrada que restauraría a su propio usuario una reserva que no tiene no aparece en su menú.

Metamagia (Capability API 1.253). El `alters` de una entrada cambia cómo se usa una entrada de sus `catalogs`: nunca está en un menú por sí misma, sino que se ofrece con cada una a la que se ajusta, se elige al usar esa y se paga con sus propios usos (`usesOf` los Sorcery Points con `usesSpent`, o `usesSpentByLevel` para el nivel al que se paga el conjuro, al menos uno). Es un `utility` sin reacción. Solo una por uso, salvo que se una (`joins`) a otra. Lo que cambia, y cada una solo se ajusta a un conjuro en el que tenga algo que cambiar: `spares` (un valor de la ficha: esa cantidad de su usuario y sus aliados que alcanza superan su salvación sin más: Careful), `range` (`{ "times": 2, "touch": 30 }`: Distant), `rerolls` (esa cantidad de sus dados de daño por debajo de la media se vuelven a tirar, empezando por el más bajo: Empowered, con `joins`), `lasts` (lo que aplica durante un minuto o más dura esa cantidad de veces más, nunca más de un día: Extended), `heightens` (su primer objetivo tira su primera salvación con desventaja: Heightened), `budget` (`{ "from": "action", "to": "bonus" }`: Quickened), `drops` (los componentes que entonces no necesita, y nadie puede responder a que se lance: Subtle) y `twins` (un objetivo más para un conjuro de un solo objetivo que no sea solo de su usuario y que no gane nada con un espacio superior: Twinned). Un conjuro que en este momento solo puede lanzarse con una de ellas (Quickened una vez gastada la acción, Subtle bajo Silence) se ofrece con `alterNeeded`, y la elección tiene que llevarla. La elección envía `alters`, los IDs del `alters` de la opción; el registro indica `altered`.

La metamagia tal como se elige (Capability API 1.254). `rerolls` vuelve a tirar los más bajos de todos los dados de daño de un conjuro, nunca más de esa cantidad en total: los suyos, los de cada cláusula de `plus` y, en un impacto crítico, los extra con lo que quede. Un conjuro de ataque los tira por cada objetivo al que impacta. Cuando una alteración `spares` alcanza a más miembros del bando de su usuario de los que perdona, su usuario elige a quiénes: la oferta `alters` de la opción lleva `spares` (cuántos), y la elección envía `spares`, los IDs del bando de su usuario que se perdonan (ninguno no perdona a nadie). Si se omite, perdona a los primeros que alcanza. La elección se mantiene durante una ventana que responde al lanzamiento. Se rechaza como `bad-alter` un `spares` sin ninguna alteración que perdone a alguien, con más IDs de los que perdona, con un ID repetido o con uno de otro bando.

El objetivo de Heightened y Acid Arrow (Capability API 1.255). Cuando una alteración `heightens` alcanza a más de uno, su usuario elige quién tira su primera salvación con desventaja: la oferta `alters` de la opción lleva `heightens: true`, y la elección envía `heightens`, el ID de un combatiente (uno al que se apunta, cuando se apunta a alguno, y nunca su usuario). Si se omite, es el primero al que alcanza. Una entrada con `halfOnMiss: true` (debe tener `attackRoll` y un `amount`) sigue infligiendo la mitad de su daño al fallar, también el de sus cláusulas, y nada más de lo que hace al impactar. El `harmsPerCostStep` de una entrada de `applies` (`{ "dice": "1d4" }`) suma esa cantidad a lo que inflige el estado con `harms` por cada paso de coste superior con el que se aplicó: el ácido posterior de Acid Arrow, 1d4 más por cada nivel de espacio por encima del 2.º.

Los rescates propios de quien los tiene, entradas que nunca recaen en su usuario y estados de uno en uno (Capability API 1.256). El `rescue` de una entrada también puede ser `by: "twenty"` (solo con `roll: "checks"`): el d20 de una prueba fallida cuenta como un 20, y solo se gasta cuando eso la hace superar, como hace Stroke of Luck con una prueba de atributo. `by: "die"` añade un dado propio de quien lo tiene cuando nada de lo que se le ha dado podría compensar la diferencia y ese dado sí podría: `dice` (`"1d10"`, Dark One's Own Luck) o un `die` cuyo tamaño depende de un valor de la ficha, `{ "from": { "field": "level" }, "table": [[1, 6], [5, 8], [10, 10], [15, 12]] }` (Peerless Skill). Primero se prueba un estado que se le haya dado. `notSelf: true` en una entrada dirigida a una criatura `ally` o `any` impide que recaiga en su propio usuario: Bardic Inspiration. El `oneAtATime` de un estado de combate nombra un grupo (`"bardic"`): mientras una criatura tenga un estado de ese grupo, no se le aplica ningún otro del grupo, incluido el mismo; el evento del estado indica `already`.

Respuestas a más tipos de tirada (Capability API 1.257). `lowersRoll` también puede enumerar `"also": ["checks", "damage"]`: además de a una tirada de ataque que impactó, sus dados se restan de la prueba de atributo de otro (un enfrentamiento como un agarre, la prueba previa de un objeto, la prueba de Counterspell) o de su tirada de daño cuando se hace. Eso lo gasta por sí mismo, con el presupuesto, los usos y el coste de la entrada, el primero del otro bando cuya entrada alcance a quien tira, y solo cuando su máximo podría cambiar la tirada: una prueba que tendría éxito y podría entonces fallar, o un daño que derribaría a alguien del bando de quien lo tiene y podría entonces dejarlo en pie. Cutting Words es `{ "dice": "1d6", "also": ["checks", "damage"] }` con su dado según el nivel, `needs: ["hearing"]` y `targetTypes: { "notImmuneTo": ["charmed"] }`. Un rescate puede nombrar `saves` (solo un rescate de `saves`): se gasta solo en esas salvaciones. Con `budget` también consume uno de ese presupuesto, y no se gasta sin él: un ring of evasion es `{ "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" }` con sus cargas como usos. El uso de un objeto también puede llevar `halfOnMiss`, con `attackRoll` y un `amount`: un pergamino de Acid Arrow.

Enfermedades (Capability API 1.258). Los `kinds` de un estado de combate (`["disease"]`) indican qué tipo de estado es. Un tipo nunca es el propio ID de un estado. El `ends` de una cura puede nombrar un tipo en lugar de estados: cuenta cada estado de ese tipo, y su `count` sigue quitando solo esa cantidad, así que la "una enfermedad" de Lesser Restoration es `{ "conditions": ["disease", "blinded", "deafened", "paralyzed", "poisoned"], "count": 1 }`. Una inmunidad (los `conditionImmunities` de una criatura o de un objeto, o los de un estado o un nivel) también puede nombrar un tipo: Divine Health es un estado con `"conditionImmunities": ["disease"]`. Un `saveEnds` puede contar: `successes` (de 2 a 10) es cuántos éxitos lo terminan, y `failures` (`{ "count": 3, "becomes": "blinding_sickness" }`) aplica `becomes` en su lugar, sin reloj y sin más salvaciones, cuando han fallado esa cantidad de salvaciones. El evento del estado indica `worsened`. Eso es Contagion: un estado `until-save` contra el que se hace una salvación al final de cada turno, con tres en cada sentido. Un estado sin reloj no se retira cuando termina el combate, así que una enfermedad que ya ha arraigado dura más que él hasta que algo la cure.

Rescates en objetos puestos (Capability API 1.259). El `use` de un objeto puede llevar un `rescue` igual que las mecánicas de una entrada, incluidos `saves` y `budget`. Nunca está en el menú, y solo se gasta mientras el objeto está puesto (cuando tiene ranuras) y tiene las `charges` que gasta su uso. Gastarlo consume una de esas cargas. Un ring of evasion es un objeto con `"charges": { "max": 3 }` y `"use": { "kind": "buff", "targets": "self", "free": true, "charges": 1, "rescue": { "roll": "saves", "by": "success", "saves": ["dex_save"], "budget": "reaction" } }`. Sus cargas vuelven según indique el `recharge` del objeto.

Enfermedades entre combates (Capability API 1.260). Un estado de combate puede llevar `onRest: { "rests": [restId], "lowersMax": { "dice": "3d6", "flat": 0 }, "lasting": true }`: cada vez que quien lo tiene hace uno de esos descansos mientras lo tiene, el máximo de salud baja esa cantidad, tirada donde se hace el descanso, después de que el descanso haya devuelto lo que devuelve. Sin `lasting`, el siguiente descanso lo devuelve; con él, solo algo que quite el sello. Un `onRest.save: { "save": saveId, "difficulty": 15, "cures": true }` se tira primero, como las pruebas del conjunto y con el propio modificador de la ficha: solo un fallo reduce el máximo, y con `cures` un éxito termina el estado (la enfermedad del otyugh). Solo la salud llevada en puntos tiene un máximo que reducir. El Mummy Rot de 5e es un estado sin reloj con `"onRest": { "rests": ["long"], "lowersMax": { "dice": "3d6" }, "lasting": true }`. Una salvación que cuenta hasta un final o hasta aquello en lo que se convierte (1.258) ya no se detiene cuando termina el combate: al terminar cualquier combate, incluidos aquellos de los que se huye, se tiran las salvaciones de turno que le quedan a quien lo tiene, así que para entonces Contagion o se ha superado o ha arraigado. Una salvación que solo se hace al recibir daño espera al daño.

Fases de una enfermedad (Capability API 1.261). Un estado de combate puede llevar `onDamaged: { "applies": [...] }`, que se aplica a quien lo tiene cada vez que recibe daño, con un reloj como los de `onEnd` (el aturdimiento de Slimy Doom hasta el final del siguiente turno de quien lo tiene); `expires: { "becomes": conditionId }`, en el que se convierte, sin reloj, cuando se agota su propio reloj, incluido el final de un combate, pero no cuando termina de cualquier otra forma (la enfermedad del Tentacle de un aboleth tras su minuto); y `curedOnlyBy: { "catalogs": [catalogId], "minLevel": 6 }`, de modo que solo lo termina una cura de esos catálogos pagada a ese nivel o superior. `onRest.restoredWhenCured: true` (con `lasting`) devuelve lo que los descansos de ese estado quitaron del máximo cuando se retira, sea como sea, incluida su propia salvación superada. El efecto `cannot-heal-nonmagical` impide toda curación salvo la mágica: en un combate, una acción cuyas cualidades indican `"magical"`; fuera de él, una operación de restauración con `"magical": true` (una poción con la etiqueta `magical` lo es), y nunca un descanso; una restauración rechazada indica `cannot-heal`. La acción de un perfil puede llevar `ends` como una entrada de catálogo, incluidos los tipos: el Healing Touch de un unicornio es `"heal": { "dice": "2d8", "flat": 2 }, "ends": { "conditions": ["disease", "poisoned"] }, "targets": "ally"`. Una cura en la que el lanzador elige entre sus estados, una maldición entre varias, es `cureOneOf` (1.204).

Cualidades en la acción de una criatura (Capability API 1.262). La acción de un perfil puede llevar `qualities`, etiquetas de objeto que declara el conjunto, igual que las de una entrada de catálogo: `["magical"]` hace que su curación sea mágica, lo que `cannot-heal-nonmagical` deja pasar, y que una salvación contra ella sea una salvación contra la magia. El uso de un objeto en un combate lleva del mismo modo las etiquetas propias del objeto, así que una poción con la etiqueta `magical` cura como magia ahí igual que en la ficha.

Auras (Capability API 1.263). Un estado de combate puede llevar `auras`, hasta cuatro: cada una extiende sus `conditions` a quien esté a `distance` o menos de quien la tiene, en el `side` `allies`, `enemies` o `all`, y también a quien la tiene con `self: true` (no con `enemies`). `when` lee uno de los valores de la ficha de quien la tiene con `atLeast` o `atMost`, de modo que un aura puede activarse a partir de un nivel. Quien está caído, derrotado o tiene el efecto `cannot-act` no extiende nada. Lo que extiende un aura se aplica a medida que avanza el combate, se retira cuando los dos se separan (el registro indica `aura` y `parted`), nunca se escribe en una ficha y desaparece cuando termina el combate; un estado que extiende un aura no puede llevar un aura propia. Sin tablero, el aura alcanza a todos los de su bando. Para que quien la tiene empiece cada combate con el estado, da a las mecánicas de una entrada de catálogo, o a un perfil, `keepsOn`: los estados que mantiene durante todo el combate, que tampoco se escriben nunca en una ficha. El Aura of Protection de 5e es un `aura-of-protection` mantenido cuya aura extiende un estado que suma el Carisma del paladín a las salvaciones; Holy Nimbus es un aura sobre los enemigos cuyo estado inflige daño al empezar su turno.

Comportamiento forzado (Capability API 1.264). Un estado de combate puede llevar `behavior`, que decide lo que hace con su turno quien lo tiene. `only` enumera todo lo que puede contener el turno además de terminarlo: `move` (caminar y levantarse), `escape` (liberarse de una sujeción) y las acciones estándar que declara el conjunto; una lista vacía solo deja terminar el turno (el alto de Command). `onlyWhenStuck` nombra acciones estándar permitidas solo mientras no haya adonde caminar (el Dodge de Turn Undead). `moves: "away"` solo camina alejándose de quien aplicó el estado, nunca un paso más cerca, y termina más lejos; `moves: "toward"` solo camina acercándose (la aproximación de Command, Sympathy). `table` se tira al empezar cada turno de quien lo tiene, `{dice, rows: [{atMost, does}]}`, y decide el turno la primera fila para la que la tirada no supera su valor: `wander` camina toda su velocidad en una dirección que elige un d8 y termina el turno, `nothing` lo termina, `strike` solo permite un ataque cuerpo a cuerpo contra una criatura a su alcance que eligen los dados (amiga o enemiga; nada si no hay nadie) y `normal`, como una tirada por encima de todas las filas, deja el turno como está (Confusion, Mindfire). El registro muestra la tirada como un evento `compelled`, y todo lo demás se rechaza como `compelled`. Una salvación que termina un estado también puede ser `at: "action"`: quien lo tiene gasta su acción para tirarla (Irresistible Dance).

Más de las auras (Capability API 1.265). Las `conditions` de un aura ahora son opcionales, siempre que extienda estados, inflija daño o pida una salvación. `needs` enumera los sentidos que debe tener quien la recibe, y ni quien la tiene ni quien la recibe pueden estar en una zona cuyas `inside.conditions` quiten esos sentidos: Countercharm con `needs: ["hearing"]` se detiene ante Silence. `harms` `{dice, flat, type}` lo inflige quien la tiene a todos los que alcanza el aura al empezar cada uno de sus propios turnos (la Fire Aura de un balor). `save` `{save, difficulty, applies, seen?, immuneOnSuccess?}` lo hacen todos los que alcanza el aura al empezar su propio turno: un fallo aplica `applies` de parte de quien la tiene con esa dificultad, `seen` solo la pide mientras los dos puedan verse (la mirada de un basilisco), e `immuneOnSuccess` mantiene el aura de quien la tiene lejos de ellos durante el resto del combate tras un éxito (la Fear Aura de un pit fiend). El `against.casts` de un modificador de salvación lo limita a las salvaciones contra lo que se lanza desde esos catálogos, incluido el uso de un objeto que lanza desde uno, y después a todo lo demás que nombre: la ventaja de Holy Nimbus contra los conjuros lanzados por infernales o muertos vivientes es `against: { casts: ["spells"], from: { types: ["fiend", "undead"] } }`.

Más comportamiento forzado (Capability API 1.266). Un `behavior` puede llevar `drops` `{slots?, tags?, at, pickUp?}`: quien lo tiene suelta cada objeto puesto que ocupe una de las `slots` o lleve una de las `tags`, y cada acción de perfil cuyas `qualities` lleven una de las `tags`, ya sea al aplicarse el estado (`at: "applied"`, el "suelta lo que esté sujetando" de Fear) o al empezar cada uno de sus turnos (`at: "turn-start"`, el "suelta" de Command). Lo que cayó queda en la casilla donde estaba: ninguna de sus acciones es ya suya (se rechazan como `dropped`), no da nada de lo que daba mientras lo llevaba puesto, y desaparece su parte de la defensa de quien lo tiene (los 2 de un escudo). Lo recoge estando en esa casilla o junto a ella, con la única recogida gratuita del turno, o con el presupuesto `pickUp` cuando el estado nombra uno; el registro muestra `letFall` y `pickedUp`. `onlyWhenStuck: "any"` hace que un turno que empieza sin ningún sitio adonde el estado deje caminar a quien lo tiene sea totalmente suyo (el "a menos que no haya adonde moverse" de Fear). `keepsOut` es una distancia respecto a quien aplicó el estado: dentro de ella, quien lo tiene solo se aleja, y solo se detiene fuera de ella mientras cualquier punto de fuera esté a su alcance (el "no puede moverse voluntariamente a un espacio a 30 pies o menos de ti" de Turn Undead). Una salvación que termina un estado puede ser `unseen: true`, que solo se tira mientras quien lo tiene no pueda ver a quien se lo aplicó (la salvación de Fear fuera de la línea de visión). El `applies` de una entrada puede llevar `destroysUpTo` `[{tier, when?}]`: una criatura que falla la salvación y cuyo nivel de amenaza es igual o inferior al `tier` más alto cuyo `when` se cumple en la ficha del usuario queda destruida sin más (Destroy Undead, de VD 1/2 con clérigo de nivel 5 hasta VD 4 con nivel 17); un personaje, o una criatura sin nivel, nunca lo queda.

Apuntar con cualquier sentido, objetivos cercanos entre sí, áreas que crecen, más usos y cosas sujetas (Capability API 1.267). Una entrada o acción de criatura que `needs` sentidos puede añadir `needsAny: true`: cumple los requisitos un objetivo que conserve cualquiera de ellos, y solo se rechaza uno al que le falten todos (el "cada muerto viviente que pueda verte u oírte" de Turn Undead). `targetsWithin` es una distancia dentro de la cual debe estar cada pareja de objetivos elegidos; en caso contrario se rechaza como `targets-apart` (las criaturas de espacio superior de Command, "a 30 pies o menos entre sí"). Un `area` puede llevar `sizePerCostStep`, la distancia que crece su tamaño por cada paso que se sube su coste (la esfera de Confusion, que crece 5 pies por nivel de espacio); un muro nunca crece. Un objeto con `use` puede enumerar `moreUses` `[{label, use}]`: cada uno es otra entrada del menú, con el nombre del objeto y su `label`, que consume las mismas cargas y se suelta con el objeto (una varita de varios conjuros). Una criatura puede enumerar `held` `[{label, tags, defense?}]`, cosas que sujeta y que no son una acción propia (un escudo impreso en el perfil): un estado cuyo `drops` nombra una de sus `tags` hace que se suelten junto con sus acciones etiquetadas, su `defense` desaparece de la suya hasta que las recoge, y cada una se recoge como un objeto soltado.

Miradas, y auras según a quién alcanzan (Capability API 1.268). Un aura puede llevar `targetTypes`, que se lee como el de una entrada: solo alcanza a quien sea eso (la Horrific Appearance de una sea hag, solo humanoides). `sourcesOf` nombra estados: solo alcanza a quien haya aplicado uno de ellos a quien la tiene (la Barbed Hide de un barbed devil, que daña a quien lo agarra). El `save` de un aura puede llevar `failedBy` `{atLeast, applies}`: un fallo por al menos esa cantidad aplica esos estados en su lugar (la mirada de una medusa, que petrifica sin más con un fallo por 5 o más). Una salvación `seen` puede llevar `avert: true`: quien alcanza puede, en su turno y sin coste, apartar la mirada de quien la tiene; hasta que vuelva a mirar (también por libre elección suya) se salta esa salvación y no puede ver a quien la tiene, así que sus ataques contra él se hacen sin verlo; el registro muestra `averted`, y el director mantiene apartada la mirada de sus criaturas mientras quede alguien más contra quien luchar. Una salvación que termina un estado puede llevar `seenLean` (`"advantage"` o `"disadvantage"`): se tira así mientras quien lo tiene pueda ver a quien aplicó el estado (la salvación repetida de la sea hag, con desventaja mientras ella esté a la vista).

Bastones que se lanzan con los números de quien los sostiene (Capability API 1.269). El `use` de un objeto puede leer su dificultad de salvación de la ficha de quien lo sostiene con `sheetDifficulty`, un valor como el que lee `toHit.sheetBonus` (`{ "derived": "spell_save_dc" }`), en lugar de `saveDifficulty`; su bonificación de ataque ya se lee de la ficha del mismo modo, con `toHit.sheetBonus` (`{ "derived": "spell_attack" }`) y sin atributos. Un uso con `charges` puede llevar `chargeStep` `{max, amount?, targets?}`: quien lo usa puede gastar hasta `max` cargas más, cada una un paso de coste superior, que añaden `amount` y `targets` como un espacio superior añade `perCostStep` y `targetsPerCostStep`, y hacen crecer un área con `sizePerCostStep` (el conjuro de un Staff of Power a un nivel superior, el 1d6 de fuerza por carga de un Staff of Striking). El menú los ofrece como pagos llamados `charges:<how many more>`, solo tantos como cargas le queden al objeto. La misma versión menor sube a 320 los estados que puede declarar un conjunto, y el `save` de un aura puede llevar `immuneWhenEnds: true`: cuando termina lo que aplicó un fallo, termine como termine (una salvación, su reloj, una cura), el aura de quien la tiene se mantiene lejos de ellos durante el resto del combate, igual que `immuneOnSuccess` la mantiene lejos tras una salvación superada (el "la supera o el efecto termina para ella" de una sea hag).

Un tipo nombrado al lanzar (Capability API 1.270). Las `mechanics` de una entrada de catálogo con `applies` pueden llevar `kindChoice: true`: su usuario nombra uno de los `combat.creatureTypes` (un tipo o una etiqueta) al usarla, ofrecidos como modos `kind-<id>`, y lo que aplica recuerda ese tipo. Un aura de lo que aplicó con `chosenKind: true` solo alcanza a criaturas de ese tipo, y una con `orSeen: true` también alcanza a quien pueda ver a quien la tiene, esté lo lejos que esté, así que el Antipathy de 5e aplica a su objetivo un estado cuya aura, `side: "all"`, asusta al tipo elegido a 60 pies o menos o a la vista, y sus asustados se alejan (`moves: "away"`) mientras que los hechizados de Sympathy se acercan. El `saveEnds` de un estado puede llevar `beyond`, en la distancia del conjunto: su salvación solo se tira mientras quien lo tiene esté más lejos que eso de quien se lo aplicó, y con `unseen`, también fuera de su vista (el "no a 60 pies o menos del objetivo ni capaz de verlo" de Antipathy).

Más de lo que hacen los bastones y los anillos (Capability API 1.271). El `use` de un objeto puede llevar `label`, que se muestra junto al nombre del objeto igual que la etiqueta de una entrada de `moreUses` ("Staff of Fire: Burning Hands"); un uso adicional se nombra con su propia `label`. Un uso puede llevar `amountAdd`, un valor que se lee de la ficha de quien lo sostiene y se suma a su cantidad, igual que el de una entrada de catálogo (el Cure Wounds de un Staff of Healing, `{ "abilityModFromField": "spellcasting_ability" }`), dentro y fuera de un combate. Un `chargeStep` puede llevar `push`, en la distancia del conjunto: cada carga más empuja a su objetivo esa distancia más lejos, además del `push` propio del uso (los 5 pies por carga de un Ring of the Ram). El `charges.breaksOn` de un objeto puede llevar `regains` `{atLeast, amount}`: cuando se gasta su última carga y su dado muestra `atLeast` o más, el objeto recupera en su lugar `amount` cargas (el 1d12 + 1 con un 20 de un Staff of the Magi), dentro y fuera de un combate y cuando el inventario gasta una carga; `atMost` puede omitirse entonces para un objeto que nunca se rompe.

Un objeto que se convierte en otro (Capability API 1.272). El `charges.breaksOn` de un objeto puede llevar `becomes`, otro objeto del conjunto como `<catalog>/<entry>`, junto a `atMost`: con las caras que lo romperían, el objeto se convierte en ese otro (el bastón no mágico de un Staff of Striking, o un Staff of Power que conserva solo su +2 como un objeto escrito solo con eso). En un combate, sus usos desaparecen y a partir de entonces golpea como el objeto nuevo, y el combate vuelve a escribir la pila como ese objeto, con su nombre y sin cargas; fuera de un combate y cuando el inventario gasta una carga, la pila cambia del mismo modo. El objeto nombrado debe ser otro objeto del conjunto, esté en el archivo de catálogo que esté.

Cargas gastadas al impactar (Capability API 1.273). El `attack.spends` de un arma enumera hasta cuatro formas en que quien la sostiene puede gastar las cargas del objeto cuando un golpe con ella ha impactado: cada una tiene una `label`, las `charges` que cuesta, un `amount` de dados y una parte fija que se suma al golpe con su propio `type` de daño (el del arma cuando no nombra ninguno) y, de forma opcional, `blow` (solo un golpe `melee` o `ranged`), `chargeStep` (`max` cargas más, cada una que vuelve a sumar su `amount`: el 1d6 de fuerza por carga de un Staff of Striking, hasta tres) y `onHit` (hasta dos estados que recibe aquel al que impacta, cada uno con `rounds`, una `save` que lo evita o `saveEnds`: la salvación de Constitución de un Staff of Withering). En un combate, cada una se ofrece a quien la sostiene en su propio impacto con esa arma, y en ningún otro, después de que haya respondido aquel al que impactó; sus dados se tiran con el golpe y los duplica su crítico, y el dado de última carga del objeto se tira como en un uso. El objeto tiene cargas.

Números fijados a partir de quien aplicó un estado (Capability API 1.274). Un estado que aplica una entrada con `applies` puede llevar un `value`, una referencia de valor que se lee de la ficha de quien lo aplica en el momento en que se aplica (el `{ "abilityModFromField": "spellcasting_ability" }` de Heroism), y el `temporary` de un estado de combate da a quien lo tiene puntos temporales al empezar o terminar (`at`) cada uno de sus turnos: `dice` y `flat`, más ese valor con `value: true`, y con `lostWhenEnds` lo que quede de ellos desaparece cuando termina el estado, salvo que quien lo tiene tenga más de los que dio por otra fuente. El `save.appliedDifficulty` de un aura tira su salvación contra la dificultad de salvación de lo que aplicó el estado del aura a quien la tiene, fijada en el momento en que se aplicó (la CD de salvación de conjuros del lanzador de Antipathy/Sympathy); su `difficulty` se mantiene para un aura que no aplicó nada. Una salvación que termina un estado `at: "damaged"` puede indicar `bySource`: solo se tira ante el daño de quien aplicó el estado (la salvación de Sympathy cuando el objetivo daña a quien lo tiene). El `behavior.keepsIn` de un estado impide a quien lo tiene, una vez que está a esa distancia o menos de quien lo aplicó, alejarse nunca más (el "no puede alejarse voluntariamente" de Sympathy). Y el `use` de un objeto puede llevar `kindChoice` igual que las mecánicas de una entrada (1.270), así que un pergamino de Antipathy/Sympathy nombra su tipo al usarse.

Estados en suspenso en vez de terminados (Capability API 1.275). Junto a `whileSourceInSight`, el `orSourceWithin` de un estado de combate (una distancia en las unidades propias del conjunto) lo mantiene activo mientras quien lo tiene esté así de cerca de quien lo aplicó, lo vea o no: fuera de la vista y fuera de esa distancia queda en suspenso, sigue aplicado a quien lo tiene con su reloj en marcha, y vuelve a estar activo en cuanto se cumple cualquiera de las dos cosas (el miedo de Antipathy, a 60 pies o menos o a la vista). Los `suppresses` de un estado de combate enumeran otros estados que deja en suspenso mientras está activo: lo que hacen se detiene, siguen aplicados y vuelven a estar activos cuando termina (el hechizamiento y el miedo de Calm Emotions, y los de Mindless Rage).

Teletransportes (Capability API 1.276). El `mechanics.teleport` de una entrada de catálogo, el `use.teleport` de un objeto o el `teleport` de la acción de una criatura mueven al instante a su usuario a un lugar libre a `distance` o menos (en las unidades propias del conjunto): sin pasos intermedios, así que nadie puede atacarlo al irse, y una zona en la que aterriza lo alcanza como si hubiera entrado caminando. Solo sobre un tablero, así que necesita `combat.distance`; fuera de un tablero no se ofrece una acción que solo teletransporta. Con `seen`, solo a un lugar que su usuario pueda ver en ese momento (un muro, una niebla o una ceguera que quita los ojos dejan fuera de la lista las casillas que hay detrás): el Misty Step de 5e, `{ "distance": 30, "seen": true }`. `carries` (de 1 a 8) lleva consigo esa cantidad de criaturas voluntarias del bando de su usuario, no más grandes que él, que estén a `carriesWithin` o menos (tocándolo si se omite), y cada una aterriza tan cerca de su usuario como haya sitio: Dimension Door, `{ "distance": 500, "carries": 1, "carriesWithin": 5 }`. Una acción de criatura con teletransporte recae sobre la propia criatura (el Teleport de un blink dog). La opción enumera las casillas a las que puede ir como `teleport.cells`, y quién puede acompañarlo como `teleport.carries`; una elección nombra la casilla como `at` y su compañía como `carries`. Un teletransporte nunca es un área ni una reacción.

Seis estados a la vez, y una vista que de verdad ve (Capability API 1.277). `applies` admite hasta 6 entradas en las mecánicas de una entrada de catálogo, en el uso de un objeto y en la acción de una criatura (antes eran 4): Rage y Frenzy añaden cada uno el estado de Mindless Rage junto a sus cuatro. Y `whileSourceInSight` (con `orSourceWithin` al lado) ahora lee la propia vista de quien lo tiene, igual que el `orSeen` de un aura: sigue haciendo falta una línea despejada en el tablero y, además, quien lo tiene debe ver su origen con sus ojos o sus sentidos, así que la ceguera que quita los ojos, una niebla que oculta, la oscuridad más allá de lo que alcanza a ver o un origen que no ve (invisible) lo rompen igual que un muro.

Calm Emotions (Capability API 1.278). Una salvación puede indicar `alliesMayFail: true` (en la `save` de una entrada de catálogo, del uso de un objeto o de la acción de una criatura): un objetivo del propio bando de su usuario la deja actuar y falla sin tirar, y el registro lo indica, mientras que cualquier otro tira como siempre. Los `effects` de un estado pueden llevar `cannot-target-source-side`: quien lo tiene no apunta nada a quien se lo aplicó ni a nadie de su bando, salvo que ese bando sea el suyo (entonces no excluye a nadie). `endsWhen` admite dos finales más junto a `damaged` y `harmed-by-source-side`, hasta los cuatro: `attacked`, una tirada de ataque que cualquiera hace contra quien lo tiene, impacte o falle (una acción que impacta sin tirar no cuenta), y `ally-harmed-in-sight`, daño a cualquier otro del bando de quien lo tiene que este vea (una línea despejada en el tablero y sus propios ojos o sentidos). Y `endsWhenHarmedFrom` enumera catálogos: el daño a quien lo tiene por cualquier cosa lanzada desde uno de ellos, por quien sea, incluidos el conjuro de un pergamino y una zona en pie, lo termina; el daño es daño, o ser objetivo de una acción dañina, como en `harmed-by-source-side`, y volver a lanzar el mismo estado lo renueva en vez de terminarlo. Cada uno de estos espera a que termine el paso que lo causó. Y un estado que deja en suspenso (`suppresses`) un estado activo de quien lo tiene ya no termina por una inmunidad que da ese mismo estado: queda suspendido, no curado, así que un miedo que ya estaba aplicado cuando empieza una furia inmune al miedo vuelve cuando termina la furia (el Mindless Rage de 5e), mientras que los miedos nuevos siguen sin poder aplicarse.

Teletransportes fuera del combate, pasajeros a la vista y humo (Capability API 1.279). Un `teleport` (en una entrada de catálogo, el uso de un objeto o la acción de una criatura) admite tres claves más. `leaves: true`: puede sacar a su usuario del combate por completo, la milla de un unicornio, en vez de llevarlo a una casilla; la elección no nombra entonces ningún `at` (el menú muestra un botón "Leave the fight"), y su usuario y quien vaya con él se marchan vivos (se muestran como "Left the fight", conservan su salud y nada los trae de vuelta). Fuera de un tablero, marcharse es el único destino posible, y puede acompañarlo cualquiera que esté en pie en el bando de su usuario, ya que nada mide quién está cerca. Un grupo que está fuera del combate y del que alguien se ha ido de esta forma ha huido (el resultado `fled`, que termina el combate como huir); un enemigo que se ha ido así no está vencido ni sigue en pie, sino que ha escapado, y el resumen lo indica. Las propias criaturas del director se marchan con un cuarto de su salud o menos, llevándose a quien puedan. `carriesSeen: true` (con `carries`): solo pueden acompañarlo los que su usuario pueda ver, las "criaturas voluntarias que pueda ver" de un unicornio. Y `smoke` (`{}`, o `{ "pierced": [senses] }`): se forma una nube sobre las casillas que dejó su usuario y las casillas en las que aterriza, que oculta igual que el `obscures` de una zona, desde que aterriza hasta el final del siguiente turno de su usuario: el humo de la Cape of the Mountebank.

Un teletransporte que ataca (Capability API 1.280). El teletransporte de una criatura puede nombrar como `strike` una de sus propias acciones (su `id`): el "Antes o después de teletransportarse, el perro puede hacer un ataque de mordisco" de un blink dog. Teletransportarse permite entonces que esa acción le siga una vez este turno sin coste (el menú indica "Free, part of the same action"), y el menú también la ofrece en el orden inverso, como "Bite, then Teleport" con el presupuesto del teletransporte, tras lo cual el teletransporte le sigue una vez sin coste. Ninguno da paso a un tercero. El ataque hecho primero gasta los usos y la recarga del teletransporte junto con los suyos, y solo se ofrece mientras queden ambos. El ataque es otra acción simple de la misma criatura: no el propio teletransporte, una secuencia, otro teletransporte, una reacción ni algo comprado con puntos. Solo el teletransporte de una criatura nombra una; se rechaza el de una entrada de catálogo o el del uso de un objeto. En un combate que no mide distancias, un teletransporte no va a ninguna parte, así que no se empareja nada. El director también lo usa: una criatura demasiado lejos para llegar caminando hasta su presa se teletransporta junto a ella y la muerde en el mismo turno.

Golpes que drenan (Capability API 1.281). Las `mechanics` de una entrada de catálogo o la acción de una criatura pueden llevar `drain`: su usuario recupera salud igual al daño que el golpe infligió a cada objetivo, después de las resistencias, redondeada hacia abajo y nunca por encima de su máximo, y no se resta nada del máximo del objetivo (para eso, consulta `reducesMax`). `share` (mayor que 0, hasta 1; todo si se omite) es la parte que se recupera, y `damageType` solo cuenta el daño de ese tipo: el Psychic Drain de un aboleth es `drain: {}`, y Vampiric Touch, `drain: { "share": 0.5, "damageType": "necrotic" }`. Lo que impide curarse también impide esto. Un drenaje necesita daño que devolver, así que se rechaza uno en una entrada sin `amount`, en una curación o en una acción de criatura sin `damage`.

Explosiones centradas en su usuario (Capability API 1.282). Un `area` (de una entrada de catálogo o de la acción de una criatura) puede indicar `around: true`: una explosión de `size` centrada en su usuario y que nunca se apunta. Al usarla queda alcanzado todo el que esté a `size` o menos del usuario, amigos y enemigos por igual salvo que `friendlyFire` sea falso (una que cura, solo el propio bando de su usuario), y nunca el propio usuario. Un muro entre ellos deja fuera a una criatura, salvo que el área también indique `throughWalls: true`: el Channel Negative Energy de un mummy lord, "incluidas las que estén tras barreras y doblando esquinas". En un combate sin tablero alcanza a todos. No se dirige a nadie, así que funciona tanto como acción signature comprada entre turnos como en un turno. Solo una explosión única se centra en su usuario (sin `copies`), `throughWalls` solo va con `around`, y la explosión de una entrada alrededor de su usuario se produce al instante, así que no deja ninguna `zone`. Channel Negative Energy es una acción de criatura con `signature: { "cost": 2 }`, `area: { "shape": "burst", "size": 60, "around": true, "throughWalls": true }` y `applies` un estado con el efecto `cannot-heal` durante `{ "rounds": 1, "of": "source" }`, hasta el final del siguiente turno del mummy lord. El director la valora según a quién alcanza, igual que valora una forma apuntada.

Movimientos legendarios (Capability API 1.283). Una acción de criatura con un coste `signature` puede indicar `move` y nada más de lo que hace: su creador camina entre turnos, eligiendo una casilla del tablero como en un desplazamiento en su propio turno, con un margen prestado solo para ese movimiento, así que el movimiento de su propio turno queda intacto. `move: { "share": 0.5 }` es una parte de su velocidad (una tarasca "se mueve hasta la mitad de su velocidad"), `move: { "distance": 60 }`, una distancia en la unidad propia del conjunto, y `move: {}`, toda su velocidad; no `share` y `distance` a la vez. Recibe ataques al salir del alcance de alguien como cualquier desplazamiento, y la ventana en la que se compró se sigue preguntando cuando impacta el ataque. `noOpportunity: true` no provoca a nadie (un vampiro "se mueve hasta su velocidad sin provocar ataques de oportunidad"). `untouchable: true` es un movimiento al que nada puede dañar ni retener (el Whirlwind of Sand de un mummy lord, `{ "distance": 60, "untouchable": true }`): lo que retenga a su creador lo suelta primero, nadie lo ataca, y ninguna zona ni terreno que cruce le hace nada. Una criatura retenida, o sin velocidad, no tiene adonde ir con ningún otro movimiento. Fuera de un tablero no se ofrece nada. El director compra uno igual que compra un teletransporte: para apartarse de un enemigo que tiene al lado cuando está malherido, o para acercarse a uno cuando no tiene ninguno a su alcance.

Lanzamientos legendarios (Capability API 1.284). Una acción de criatura con un coste `signature` puede indicar `casting` y nada más de lo que hace: entre turnos ofrece cada conjuro que su creador podría lanzar en su propio turno con el `budget` de la acción, de su `spellcasting` o de los conjuros de su ficha, con nombres como "Cast a Spell: Fireball". Cada uno se apunta, se paga y se resuelve exactamente igual que en el turno de la criatura (objetivos, una casilla para un área, un espacio o un uso gastado como siempre), y se gastan los puntos en lugar del presupuesto, así que su propio turno conserva todos los presupuestos que tenía. `casting: { "cantripsOnly": true }` solo ofrece trucos (conjuros que no se pagan con ninguna reserva): el Cantrip de un lich, `signature: { "cost": 1 }`. El Cast a Spell de una esfinge es `casting: {}` con `signature: { "cost": 3 }`. Todo lo que abre el conjuro (un Counterspell, una reacción a recibir daño de él) se responde como en un turno, y la ventana en la que se compró se sigue preguntando cuando todo eso se ha cerrado. El director compra uno cuando el conjuro vale los puntos, igual que valora cualquier otra acción signature.

Moverse después de la acción, y con una sola velocidad (Capability API 1.285). Una acción signature que hace algo (daño, un área, una salvación, un estado) también puede llevar un `move`: primero se aplica lo que hace y después su creador puede moverse a una casilla que ofreció el menú, elegida junto con la acción; no elegir ninguna también es una opción, y una casilla a la que ya no puede llegar después de lo que hizo simplemente no se recorre. Un `move` también puede nombrar una forma de moverse con `speed` (`walk`, `fly`, `swim`, `climb` o `burrow`): su `share` se lee solo de esa velocidad, solo se mueve de esa forma, y una criatura sin esa velocidad no tiene adonde ir. El Wing Attack de un dragón es su explosión a su alrededor (`area: { "shape": "burst", "size": 10, "around": true }`, su salvación y su derribo) con `move: { "share": 0.5, "speed": "fly" }`: "El dragón puede entonces volar hasta la mitad de su velocidad de vuelo". Un `move` sigue sin llevar `teleport`, `sequence`, `reaction` ni `charge`. El director sale volando tras el golpe de alas cuando está malherido junto a un enemigo, o se acerca a uno que está fuera de su alcance.

Ocultación leve y el viento (Capability API 1.286). El `obscures` de una zona, o el `smoke` de un teletransporte, puede indicar `light: true`: entonces no oculta a nadie y solo oscurece levemente a quien se ve a través de él o está dentro, como la luz tenue de 5e o el humo de una Cape of the Mountebank (el motor sabe a quién se ve así; Hide y Perception lo leen). También puede indicar `dispersed: true`: una zona cuya regla indica `disperses: true` lo termina entonces allí donde se encuentran, después de cada acción, junto con la concentración que lo mantiene. El Fog Cloud de 5e es `obscures: { "dispersed": true }`, y su Gust of Wind, una zona con `disperses: true`; Darkness no indica ninguno de los dos, así que el viento no le afecta. Una zona que solo dispersa no necesita activador.

Hide, Search y Detect (Capability API 1.287). `combat.hiding` hace real la acción estándar `hide`: `{ "stealth": "stealth", "perception": "perception", "noisy": ["verbal"] }` nombra dos de los `combat.checks` y, de forma opcional, `passive` (10), `lightly` (5) y los `combat.components` que hacen ruido. Hide tira `stealth` con los propios dados del combate; su usuario queda entonces oculto para cada oponente que no lo vea con claridad (tras un muro, en una niebla, invisible, o viéndolo solo levemente oscurecido) y cuya Percepción pasiva, que es `passive` más su prueba `perception`, y `lightly` menos cuando solo lo ve levemente oscurecido, no supera el total. Un oponente para el que está oculto no lo ve, así que no puede apuntarle nada, lo atacan como alguien no visto, y `combat.sight.unseenAttacks` da ventaja a ese ataque. Esconderse dura de un turno a otro y termina: para todos, cuando su usuario ataca, hace un enfrentamiento, daña a alguien o pide una salvación, o usa algo que necesita un componente `noisy` (un conjuro sin componente verbal, o una niebla que coloca, lo mantiene oculto); y para cada oponente que pase a verlo con claridad o cuya pasiva supere ahora el total, después de cualquier paso y en cada casilla de un desplazamiento. La acción estándar `search` (añádela a `combat.standard`; necesita `combat.hiding`) tira `perception` y encuentra, para quien busca, a todos los que están ocultos para él cuyo total no supera la tirada. Una acción de criatura con `search: true` hace lo mismo y nada más: un Detect legendario es `{ "name": "Detect", "budget": "action", "signature": { "cost": 1 }, "search": true }`. Una criatura lee ambas pruebas de sus propios `checks`. El director busca cuando todos sus oponentes están ocultos para él, y usa un Detect entre turnos cuando lo está alguno. Fuera de un tablero, nadie puede estar oculto salvo por un estado que ya lo oculte.

Ready (Capability API 1.288). `combat.readying: { "budget": "reaction" }` hace real la acción Ready: para cada opción que su usuario podría usar ahora con su presupuesto `standard` (un ataque, un conjuro, una acción de criatura) y para un desplazamiento, el menú ofrece dos entradas, preparadas para cuando un oponente se acerca a su alcance (`comes`) o para cuando uno actúa (`acts`). Elegir una gasta el presupuesto estándar y retiene esa opción hasta el inicio del siguiente turno de su usuario. Cuando el desplazamiento de un oponente lo lleva, en cualquier paso, a un lugar donde la opción retenida podría apuntarle (y quien la retiene lo ve), o un oponente termina allí cualquier cosa que haga, una ventana pregunta a quien la retiene, que usa la opción llamada `readied` con `budget` (la reacción de 5e) o la deja pasar, y no se le vuelve a preguntar en ese desplazamiento. Un desplazamiento retenido llega tan lejos como alcanza toda la velocidad de quien lo retiene, y salir del alcance de alguien durante él provoca ataques de oportunidad como cualquier desplazamiento. Con `"concentrates": true` (necesita `combat.concentration`), un conjuro se paga al prepararlo y se mantiene mediante concentración: al activarse no se vuelve a pagar, perder la concentración lo pierde, y uno que nunca se activa queda gastado. Preparar cualquier otra cosa no paga nada hasta que se activa. El de 5e es `{ "budget": "reaction", "concentrates": true }`.

Dispersión lenta (Capability API 1.289). El `dispersed` de una niebla puede ser `{ "after": N }` en lugar de `true`: un viento que la alcanza solo la termina entonces cuando ha soplado sobre ella N rondas completas seguidas, contadas desde el turno en que la alcanzó por primera vez. Un viento que deja de alcanzarla antes, porque se ha movido, ha terminado o ha desaparecido, reinicia la cuenta cuando uno vuelve a alcanzarla. El Stinking Cloud de 5e, que un viento fuerte como Gust of Wind dispersa tras 1 ronda, es `"obscures": { "dispersed": { "after": 1 } }`.

Buscar a los ocultos, con sus modificadores (Capability API 1.290). Una prueba del combate que se lee de una habilidad (`{ "skillMod": "stealth" }`) ahora cuenta como prueba de esa habilidad al tirarla, así que un cambio restringido a ella mediante `skills` se aplica en Hide, Search y en los enfrentamientos: la desventaja de la armadura pesada en Stealth, el +10 de Pass without Trace, la ventaja de las Eyes of the Eagle en Perception. `combat.hiding.passiveMode` (el 5 de 5e) se suma a una Percepción pasiva que tiene ventaja y se resta de una que tiene desventaja; sin él, una pasiva no lee ningún modo. Un cambio `{ "to": "checks-taken", "skills": ["perception"], "mode": "disadvantage" }` aplica ese modo a las pruebas hechas para encontrar a quien lo tiene, tanto a la pasiva de un oponente como a su Search; acepta un `mode` y nada más. La Cloak of Elvenkind de 5e. Cuando un Search encuentra que alguien cambia cómo se tira para él, vuelve a tirar solo para él, y el registro también muestra esa tirada.

Las formas propias de una criatura de esconderse y de mirar (Capability API 1.291). La acción de una criatura puede ser un permiso, `"standard": { "actions": ["disengage", "hide"] }`: esas acciones estándar (de `combat.standard`) hechas con el propio presupuesto de esa acción, como el Nimble Escape del goblin de 5e con la acción adicional. Con `"while": "obscured"` solo vale mientras la criatura esté en una niebla o una bruma, o en un combate que se libra con luz tenue u oscuridad: el Shadow Stealth de la sombra. Los `checkModes` de una criatura hacen que tire dos veces sus propias pruebas con algunas habilidades: `{ "skills": ["perception"], "mode": "advantage", "sight": true }` solo mientras puede ver (Keen Sight), con `"light": ["sunlight"]` solo con esa luz (Sunlight Sensitivity, con `"mode": "disadvantage"`), y con `"terrain": ["snow"]` solo en una loseta del tablero o en un tipo de lugar que nombre (Snow Camouflage; los lugares son los del generador táctico: nieve, cueva, montañas, agua y el resto). El `passive` de una criatura es su Percepción pasiva impresa, que se usa en lugar de `hiding.passive` más su prueba (necesita `combat.hiding`). La luz con la que se libra un combate depende de la hora del día de la escena: luz solar de día al aire libre, luz tenue al amanecer y al anochecer, oscuridad de noche, y luz brillante que no es la del sol bajo techo o cuando la hora no dice nada que el motor pueda leer. La luz solo afecta a lo que la lee (estos modos y `while: "obscured"`). Sin `combat.sight.darkness` (1.294), no cambia quién puede ver a quién.

Las formas propias de alguien de esconderse y de encontrar a los ocultos (Capability API 1.292). El `mechanics.hiding` de una entrada de catálogo (de cualquier tipo, incluido `utility`) y el `hiding` de una criatura son permisos que se leen donde `combat.hiding` oculta de verdad. `"behindLarger": true` permite a quien lo tiene esconderse detrás de alguien al menos un tamaño más grande que esté entre él y quien mira, en cada línea entre ambos (el Naturally Stealthy de un mediano; necesita `combat.sizes`). `"still": 10` suma esa cantidad a su total de Stealth al esconderse, y se resta de nuevo cuando se mueve o hace una acción (el Hide in Plain Sight de un explorador). `"slow": "advantage"` tira su Hide con ventaja cuando no se ha movido más de la mitad de su velocidad en este turno (el Supreme Sneak de un ladrón). `"aware": { "within": 10, "lostWith": ["deafened"] }` significa que nadie a esa distancia o menos, en la unidad propia del conjunto, está oculto para él, salvo que tenga uno de esos estados (el Blindsense de un pícaro). El `"starts": 15` de una criatura empieza el combate oculta a la vista de todos con ese total, para cualquiera cuya Percepción pasiva no lo supere, lo vea con claridad o no, hasta que se mueve, y vuelve a ocultarse así con la acción Hide (el Transparent de un gelatinous cube).

Las propias tiradas de ataque de una criatura, tiradas dos veces (Capability API 1.293). Los `attackModes` de una criatura se aplican donde se aplicarían sus `checkModes`: `{ "mode": "disadvantage", "sight": true, "light": ["sunlight"] }` es la Sunlight Sensitivity de 5e, desventaja en sus ataques mientras puede ver y el combate se libra con luz solar. Cada modo indica dónde se aplica, con `sight`, `light` o `terrain`. El modo se une a todas las demás ventajas y desventajas de la tirada, así que ambas siguen anulándose.

La oscuridad (Capability API 1.294). Con `combat.sight.darkness`, la luz con la que se libra un combate impide ver a los ojos: `{ "seeIn": ["darkvision"], "pierced": ["truesight"], "carried": { "bright": 20, "dim": 20 } }`. A nadie en la oscuridad se le ve, y a nadie con luz tenue se le ve con claridad, salvo con un sentido de `seeIn` dentro de su alcance, que ve la oscuridad como luz tenue y la luz tenue como brillante, o con un sentido `blind` o uno de `pierced` dentro de su alcance, que ven sea cual sea la luz. Lo que ilumina la oscuridad: `carried`, la luz que lleva todo el que combate con una ficha salvo que un sentido de `seeIn` le llegue (una antorcha); `light` en un estado (el truco Light), en el efecto `worn` o `carried` de un objeto (una linterna) o en una criatura (bandidos con antorchas, un elemental de fuego). Cada uno es `{ "bright": N, "dim": N }` en la distancia propia del conjunto: luz brillante hasta esa distancia y luz tenue otro tanto. Los muros detienen la luz, y quien está abatido no emite ninguna. Donde la oscuridad es real, todo lo que lee la luz la lee donde está cada uno: quién ve a quién (ataques contra quien no se ve, esconderse, una criatura que puedas ver), estar oculto (`while: "obscured"`) y los `checkModes` y `attackModes` de una criatura. Un combate en una cueva o una mazmorra se libra en la oscuridad a cualquier hora.

Apagar una luz y volver a encenderla (Capability API 1.295). Quien lleva la luz `carried` tiene en su menú un interruptor para ella, con el nombre de su `label` (`"Torch"`; "Light" cuando no indica ninguno). Cuesta su `budget` cuando nombra uno y, si no, es gratuito una vez por turno. Una luz apagada no emite nada, así que quien la lleva puede pasar desapercibido en la oscuridad; al volver a encenderla, se le ve, y se le encuentra si estaba escondido. Un objeto con `toggle` solo emite la `light` de su efecto mientras está encendido, como una linterna sorda.

Luces que encienden y apagan criaturas y objetos (Capability API 1.296). Una acción de criatura con `"sheds": { "bright": 10, "dim": 10 }` fija la luz que emite su usuario a partir de entonces, y `"sheds": "out"` la apaga. No hace nada más ni apunta a nadie: el Ignited Illumination del magmin son dos acciones así con su acción adicional, y el Variable Illumination de un will-o'-wisp es una acción por cada alcance. Una criatura con `"unlit": true` empieza el combate con su `light` apagada, y necesita una de sus acciones para encenderla. El `toggle.offLight` de un objeto es la luz que emite mientras está apagado, en lugar de la de su efecto: una linterna sorda con la capucha bajada emite `{ "bright": 0, "dim": 5 }`. Una luz sin alcance brillante solo emite luz tenue, incluso donde se sostiene.

Luz de las zonas, y luz que termina la oscuridad o muestra lo invisible (Capability API 1.297). Los `lights` de una zona de conjuro (en pies, como cualquier `light`) iluminan solo las propias casillas de la zona, medidos desde su centro: el punto en el que se lanza una explosión, o su lanzador en una zona que este mantiene consigo, así que una linterna de ojo de buey es un cono de 60 pies anclado en su lanzador con `"lights": { "bright": 60, "dim": 60 }` que no ilumina nada detrás de él. Dancing Lights es una zona de punto móvil con `{ "bright": 0, "dim": 10 }`. Una zona que oculta con `"obscures": { "darkness": true }` es oscuridad mágica, y una zona con `"dispelsDark": { "upTo": 3 }` termina toda esa oscuridad que tocan sus casillas cuyo espacio fuera de ese nivel o inferior, cuando se lanza cualquiera de las dos: Daylight. Una luz con `"reveals": true`, en una zona, un efecto de objeto, un estado o una criatura, muestra a todos los que no se ven por un estado y están en su luz brillante: una lantern of revealing. Cualquiera de estos necesita Capability API 1.297.

Luz oculta bajo un estado, y luz solar (Capability API 1.298). El `"lightOutWhile": ["invisible"]` de una criatura apaga su propia luz, fijaran lo que fijaran sus últimas acciones, mientras tenga cualquiera de esos estados, y la recupera cuando termina el estado: la Invisibility de un will-o'-wisp también oculta su luz. Una luz con `"sunlight": true`, en una criatura, un efecto de objeto, un estado o una zona, convierte su luz brillante en luz solar, que es lo que lee `"light": ["sunlight"]` en un modo de prueba o de ataque: una sun blade contra Sunlight Sensitivity. Su luz solar también cuenta sobre un tablero que ya está iluminado.

Oscuridad mágica contra la luz (Capability API 1.299). Una zona de oscuridad mágica (`"obscures": { "darkness": true }`) con `"dispelsLight": { "upTo": 2 }` apaga la luz creada por un conjuro de ese nivel o inferior, allí donde se encuentran y llegara antes la que llegara: los `lights` de una zona o la `light` de un estado aplicado por un conjuro, que termina con la concentración del conjuro cuando es esta la que lo mantiene (el Darkness de 5e sobre Flame Blade). Solo la luz mágica ilumina las casillas de cualquier oscuridad mágica, sea cual sea la luz con la que se libre el combate: la luz de un conjuro en una zona o un estado siempre lo es, y cualquier otra luz lo es cuando indica `"magical": true` (la de una sun blade); una antorcha dentro de la oscuridad no ilumina nada allí. Un `dispelsDark` con `"within": 60` solo termina la oscuridad que esté así de cerca de su centro: la esfera brillante de Daylight, no su luz tenue más allá. Cualquiera de estos necesita Capability API 1.299.

Lo extra de un coste superior solo cada tantos pasos (Capability API 1.300). `"perCostStepsEvery": 2` suma `perCostStep` una vez por cada dos pasos de coste superior en lugar de por cada uno. Una acción que da un estado (1.236) ahora crece según el coste al que se pagó el conjuro que aplicó el estado, con sus propios `perCostStep`, `perCostStepsEvery` y `perCostStepsMax`: el golpe de Flame Blade de 5e es `3d6` con `"perCostStep": { "dice": "1d6" }, "perCostStepsEvery": 2`, así que una hoja invocada con un espacio de nivel 4 golpea por 4d6. Usar `perCostStepsEvery` necesita Capability API 1.300.

Zonas que lleva alguien consigo, y copias colocadas por separado (Capability API 1.301). El `"carried": "any"` de una zona hace que una explosión colocada en una casilla en la que hay alguien vaya adonde vaya esa persona, centrada en ella: el Darkness o el Daylight de 5e sobre un objeto que sostiene. Con `"own"`, solo cuenta una casilla en la que esté su lanzador, para un conjuro que solo puede lanzarse sobre un objeto que sostenga su propio lanzador. Colocada en una casilla vacía, se queda allí. Una zona que se lleva consigo es una sola explosión en un punto y nunca se mueve por sí misma. El `"copiesWithin": 20` de un área coloca sus `copies` con cada centro a 20 pies o menos del de otra, en lugar de tocándose, y una zona de copias que su lanzador puede mover (`move`) las mueve todas del mismo modo: el Dancing Lights de 5e es una explosión de 10 pies con `"copies": 4, "copiesWithin": 20` y `"lights": { "bright": 0, "dim": 10 }`. Cualquiera de los dos necesita Capability API 1.301.

Entradas que cambian otra (Capability API 1.302). Una entrada que está en una lista de la ficha con `"amends": [{ "entry": "spells/eldritch-blast", ... }]` cambia esa entrada de quien la tiene cada vez que la usa, y varias se acumulan. `"damageAdd"` (un valor, como `{ "abilityMod": "cha" }`) se suma a su daño en cada impacto: Agonizing Blast. `"range"` (en la distancia del conjunto) es su alcance cuando es mayor: los 300 pies de Eldritch Spear. `"push"` empuja a quien impacta esa distancia en línea recta, y `"pushOptional": true` también lo ofrece como "Eldritch Blast (no push)": Repelling Blast. Un alcance o un empujón necesitan `combat.distance`, y la entrada nombrada debe existir. Necesita Capability API 1.302.

Usos solo con cierta luz, y estados que terminan al moverse o actuar (Capability API 1.303). Una entrada con `"usableIn": { "light": ["dark", "dim"] }` solo se ofrece mientras su usuario esté en una de esas luces: One with Shadows. El `endsWhenHolder` de un estado también puede indicar `"moves": true` (termina cuando quien lo tiene se mueve) o `"acts": true` (termina cuando quien lo tiene hace una acción, ataca o lanza), junto a `attacks` y `casts`: las sombras ocultan a un brujo que se queda quieto. Necesita Capability API 1.303.

Una vez por criatura hasta un descanso (Capability API 1.304). Una entrada con `"oncePerTarget": { "until": "long" }` (un descanso que declara el conjunto) no se ofrece contra una criatura sobre la que ya se usó hasta que su usuario hace ese descanso, por muchos combates que haya en medio: Chains of Carceri. Sobre quién se usó se guarda por nombre en la ficha viva del usuario, y solo ese descanso lo borra. No en un área ni en una entrada dirigida a su usuario. Necesita Capability API 1.304.

Objetivos que crecen con la ficha, y el mismo objetivo otra vez (Capability API 1.305). `"targetsScale": { "from": { "field": "level" }, "table": [[1, 0], [5, 1], [11, 2], [17, 3]] }` añade esa cantidad de objetivos en cada peldaño de lo que lee, igual que `scales` añade dados. Con `"targetsRepeat": true`, el mismo objetivo puede elegirse más de una vez, y cada elección es un ataque propio con su propia tirada, que lleva todo lo que modifica la entrada: los rayos de eldritch blast, con el daño de Agonizing Blast y el empujón de Repelling Blast en cada uno. El selector de objetivos del combate añade un rayo por clic mientras quede sitio, y el motor, cuando lleva a un combatiente, pone los rayos sobrantes en el que eligió. Ninguno de los dos va en un área ni en una entrada dirigida a su usuario. Necesita Capability API 1.305.

Un arma puesta en la mano (Capability API 1.306). Una entrada `"utility"` con `"conjures": { "items": ["gear/longsword", ...], "proficient": true, "qualities": ["magical"], "binds": { "tags": ["magic"] } }` pone una de esas armas cuerpo a cuerpo en la mano de su usuario durante el resto del combate, elegida al usarla como el modo de un arma; `binds` también ofrece cada arma empuñada con la que coincide, que entonces cuenta como esta. Con `proficient` se usa con competencia, y sus golpes llevan `qualities`. Otro uso la sustituye, y un arma vinculada vuelve a ser lo que era. Las modificaciones de la entrada que la conjura alcanzan al arma: el `"damagePlus": { "add": { "abilityMod": "cha" }, "type": "necrotic", "atLeast": 1 }` de una modificación añade daño de su propio tipo al impactar (Lifedrinker), y `"strikes": 2` hace que un gasto del presupuesto de ataque compre esa cantidad de ataques (Thirsting Blade). El motor, cuando lleva a un combatiente, pone una vez en su mano el arma que golpea más fuerte. Necesita Capability API 1.306: Pact of the Blade.

Lo que mantiene su propio usuario (Capability API 1.307). La propia acción de una criatura puede indicar `"concentration": true`, igual que una entrada de catálogo: lo que aplica termina cuando termina esa concentración, y el daño la pone a prueba como siempre. La Invisibility de un imp o de un quasit. El `endsWhenHolder` de un estado también puede indicar `"uses": ["scare", "spells/bolt"]`: termina cuando quien lo tiene usa una de ellas, las acciones propias de una criatura por ID o las entradas de catálogo como `<catalog>/<entry>`. La invisibilidad de un quasit termina cuando usa su Scare. El `"appliesSelf": [{ "condition": "mote", "duration": { "rounds": 10 } }]` de una entrada aplica esos estados a su propio usuario al usarla, pase lo que pase con sus objetivos, mantenidos por su concentración cuando la tiene, al nivel al que se lanzó: la mota de Sunbeam, un estado de combate con `light` y `"actions": ["spells/sunbeam-line"]` para los rayos posteriores. Una criatura que siempre es invisible no necesita nada nuevo: `keepsOn: ["invisible"]` (1.263) lo mantiene. Necesita Capability API 1.307.

Pendientes de 1.303 a 1.306 (Capability API 1.308). El `use` de un pergamino o de una varita puede llevar `targetsScale` y `targetsRepeat`, que se leen de la ficha de su usuario: un pergamino de eldritch blast dispara un rayo más con el nivel 5 de quien lo lee, y los dardos de una varita pueden ir todos a una misma criatura. Necesita Capability API 1.308. Tres cambios no necesitan ninguna clave nueva. Una reacción es actuar: un estado cuyo `endsWhenHolder` indica `"acts": true` también termina con cualquier reacción que haga quien lo tiene, igual que One with Shadows termina con "una reacción". `oncePerTarget` distingue a dos criaturas con el mismo nombre: Chains of Carceri sobre un imp deja libre al otro imp, y el imp de un combate posterior solo queda excluido cuando el nombre era el de esa criatura concreta. Un arma puesta en la mano (1.306) puede ser un arma cuerpo a cuerpo arrojadiza (un ataque con `reach` y `range` a la vez, como una daga o una jabalina). Se descarta sin gastar ninguna acción desde el menú del combate, y desaparece cuando muere quien la creó. Nunca está a más de 5 pies de quien la creó, porque un combate nunca se la quita de la mano.

Lo que necesita esconderse, Feral Senses, la sorpresa y el ritual de vinculación (Capability API 1.309). Un `hiding` con `still` puede indicar `"stillWhile": { "holds": "camouflaged", "wall": true }`: la bonificación solo cuenta mientras quien lo tiene tenga ese estado (el camuflaje preparado de antemano, con una entrada utility de 1 minuto o fijado antes del combate) y, con `wall`, esté junto a una casilla que bloquee la vista. Eso es Hide in Plain Sight. `"unseenStrikes": true` elimina la desventaja de atacar a alguien al que no puede ver quien lo tiene, que es la primera mitad de Feral Senses. La segunda mitad no necesita nada, porque un combate ya sabe dónde está cada criatura que no está oculta. El `hiding` de una criatura con `starts` puede indicar `"surprises": true`: cualquiera para quien empiece oculta empieza el combate sorprendido, como hace el Transparent de un gelatinous cube. Un `conjures` con `binds` puede nombrar un campo de texto vivo en `"boundIn"`: solo se vincula el arma empuñada cuyo nombre está escrito ahí, y ninguna mientras esté vacío. Escribir el nombre ahí es el ritual de una hora hecho fuera del combate, durante un descanso corto. Necesita Capability API 1.309.

Repeticiones y estados que terminan a distancia (Capability API 1.310). Las mecánicas de una entrada de concentración pueden indicar `"repeats": { "budget": "action" }`: mientras su usuario se concentre en ella, su efecto se vuelve a ofrecer con ese presupuesto, sin costar nada de la ficha, sin iniciar una nueva concentración y sin volver a aplicar nada a su usuario, al nivel y con el paso de coste al que se pagó el lanzamiento. El menú lo muestra como "Vampiric Touch again". `"notSaved": true` nunca lo ofrece contra una criatura que superó una salvación contra este lanzamiento (Eyebite), y `"sameTargets": true` solo lo ofrece contra aquellos a quienes se dirigió el lanzamiento (Heat Metal, con una acción adicional). `repeats` necesita `concentration` y un presupuesto conocido. Un `applies` puede indicar `"endsAway": { "beyond": 60, "unseen": true }`: el estado se retira cuando quien lo tiene está a más de esa distancia de quien se lo aplicó y, con `unseen`, no puede verlo. Ese es el pánico de Eyebite. Se comprueba en cada paso de un desplazamiento, de quien sea, y al terminar cada turno. Necesita Capability API 1.310.

Pendientes de 1.307 y 1.309 (Capability API 1.311). El `use` de un objeto puede llevar `appliesSelf`, igual que las mecánicas de una entrada: un pergamino de Sunbeam deja la mota, y con ella los rayos posteriores, en la mano de quien lo lee, mantenida por la concentración de la lectura. La acción de una criatura puede indicar `"dyingOnly": true` (solo se puede elegir a una criatura sin salud que siga viva), `"slaysOnFailedSave": true` (un objetivo que falla la propia salvación de la acción muere) y `"healsOnSlay": { "dice": "3d6" }` (la criatura recupera esa cantidad por cada uno que muere). Ese es el Consume Life de un will-o'-wisp. `slaysOnFailedSave` necesita una `save`, y `healsOnSlay` necesita `slaysOnFailedSave`. Una regla de `combat.conditions` puede indicar `"endsWhenHolder": { "moves": true, "acts": true }`: el estado se retira de quien lo tiene, y de su ficha, en su primer paso (`moves`) o con cualquier cosa que haga salvo Hide, incluidas las reacciones (`acts`), se aplicara como se aplicara. Ese es el camuflaje de Hide in Plain Sight, marcado en la ficha antes del combate. Necesita Capability API 1.311.

Un trueno alrededor de un impacto (Capability API 1.312). El modo de un arma puede indicar `"aroundHit": { "within": 30, "save": { "save": "con_save", "difficulty": 17 }, "condition": "stunned", "rounds": 1, "of": "source" }`. Un impacto en ese modo hace que aquel al que impacta, y todos los que estén a `within` o menos de él, se salven o reciban `condition`. Eso incluye a los aliados y a quien empuña el arma, si están así de cerca. `rounds` cuenta sus propios turnos o, con `of: "source"`, los de quien empuña el arma, así que `rounds: 1, of: "source"` es "hasta el final de tu siguiente turno". `of` necesita `rounds`. Fuera de un tablero, solo se salva aquel al que impacta. Junto con el `range` y las `charges` del modo, esto es un Hammer of Thunderbolts arrojado por una carga. Su Giant's Bane es el `slay` del arma con `when: "critical"`. Necesita Capability API 1.312.

Maze, Expeditious Retreat, las opciones de un lanzamiento y sumas de atributo con tope (Capability API 1.313). Un `dismisses` con `while` puede indicar `"turns": true`. La criatura está fuera del combate pero sigue haciendo sus turnos, y en ellos solo se le ofrece lo que termina el estado que la mantiene fuera, o terminar el turno. Un `applies` puede llevar `"checkEnds": { "check": "intellect", "difficulty": 20, "passes": { "types": ["monstrosity"] } }`: quien lo tiene puede gastar el presupuesto estándar en esa prueba de `combat.checks` contra el número para terminarlo. Una criatura que cumple `passes` tiene éxito sin tirar. Juntos, son el Maze de 5e y su minotauro, que vuelve a donde estaba cuando la prueba tiene éxito. Las mecánicas de una entrada pueden indicar `"takes": ["dash"]` (o `disengage`, `dodge`), y su usuario hace esas acciones estándar al usarla: Expeditious Retreat hace Dash al lanzarse. Los Dash con acción adicional posteriores proceden del `grants` de su estado. Un `repeats` puede nombrar un `group`: las entradas de un mismo grupo son las opciones de un lanzamiento, y mientras se mantenga la concentración en cualquiera de ellas, se vuelven a ofrecer todas. `notSaved` y el nivel del lanzamiento se comparten, como en el dormido, el aterrorizado y el enfermo de Eyebite. El cambio de atributo de un objeto `{ "add": 4, "max": 30 }` se suma a la puntuación que deja cada `set`, hasta `max`, y nunca baja una puntuación que ya esté por encima. Sin `max`, una suma funciona como antes. El `"binds": { "needsWorn": [{ "anyOf": ["magic_items/belt-of-hill-giant-strength", ...] }, { "anyOf": ["magic_items/gauntlets-of-ogre-power"] }] }` de un objeto permite vincularlo solo mientras el mismo personaje lleve puesto un objeto de cada grupo, vinculado donde se vincula ese objeto, y lo desvincula en cuanto uno de ellos se quita, se desvincula o sale de su bolsa. Con `"worn": { "abilities": { "str": { "add": 4, "max": 30 } } }`, eso es un Hammer of Thunderbolts. Necesita Capability API 1.313.

Resilient Sphere (Capability API 1.314). Una entrada de `combat.conditions` puede llevar `"sealed": { "rolls": { "budget": "action", "share": 0.5 }, "lifted": { "budget": "action" }, "brokenBy": ["spells/disintegrate"] }`. Mientras el estado dura, quien lo tiene queda aislado de todos los demás. Nadie más puede apuntarle nada, un área o una explosión pasan de largo, y nada de nadie más lo daña, lo cura ni le aplica un estado, incluidas las zonas y las auras. Tampoco nada suyo alcanza a nadie más, y nadie lo ataca cuando se mueve, ni él a nadie. Su propio movimiento es nulo, pero con `rolls` puede gastar ese presupuesto para moverse hasta `share` de su velocidad. Con `lifted`, alguien que esté a su lado puede gastar ese presupuesto para levantarlo. A partir de entonces, quien lo tiene va adonde camine quien lo lleva hasta que este lo deja en el suelo, lo que es gratuito, o termina el estado. Las entradas de `brokenBy` todavía pueden apuntar a quien lo tiene y, en lugar de hacer lo que hacen, terminan el estado y la concentración que lo mantiene: Disintegrate sobre la esfera. Las mecánicas de una entrada pueden indicar `"targetsUpTo": "large"`, uno de los `combat.sizes`, y entonces solo se dirige a criaturas de ese tamaño o menores. Ese es el "de tamaño Large o menor" de Resilient Sphere. Necesita Capability API 1.314.

Acciones de guarida (Capability API 1.315). La acción de una criatura puede llevar `"lair": true`, y la criatura, `"lairInitiative"` (20 si se omite). Mientras la criatura combate en su guarida (el `"inLair": true` del Game Master en ese enemigo, o la lista `inLair` de un encuentro), hace una acción de guarida por ronda cuando la cuenta del combate pasa por el número de su guarida, perdiendo los empates: entre los dos turnos entre los que cae ese número, después del último turno de la ronda cuando todos están en ese número o por encima, o antes del primerísimo turno cuando todos están por debajo. No puede hacer la misma acción de guarida dos rondas seguidas. Una acción de guarida se apunta y se resuelve como en su propio turno, con su `budget` prestado para ella, y no gasta nada del propio turno de la criatura. Nunca está en el menú del propio turno de la criatura, y no se hace mientras la criatura está caída o no puede actuar. Una acción de guarida no es una reacción ni se compra con puntos, una secuencia nunca nombra una, y `lairInitiative` necesita al menos una acción de guarida. Los dragones de 5e hacen las suyas en la cuenta de iniciativa 20.

Elementos de escenario (Capability API 1.316). Un combate sobre un tablero puede tener elementos de escenario que se pueden romper: los `board.props` de un encuentro, o los `props` de un campo de batalla del mundo tal como se pintan. Cada uno tiene una `label`, las `cells` que ocupa, su `health`, una `defense` (10 si se omite) y tipos de daño opcionales `resist`, `vulnerable` e `immune`. `blocks` cierra sus casillas al paso (`move`), a la vista (`sight`) o a ambos mientras está en pie, y nadie empieza el combate dentro de él. Un elemento `fragile` se rompe con cualquier cosa que lo golpee. Un ataque que puede golpear la sección de un muro puede golpear en su lugar un elemento de escenario: aparece entre los `walls` de la opción, y el `wall` de la elección nombra su casilla. Un área alcanza a todos los elementos que toca y les inflige el mismo daño que tira para todos los demás; un elemento de escenario nunca se salva. Un elemento a 0 queda roto: ya no cierra nada, y su etiqueta se añade a la lista `broken` del tablero, al resumen del combate y a la recapitulación que lee el Game Master (`Broken: Sluice Gate; Oil Jar`). El activador `broke` de una historia se dispara con él.

Legendary Resistance (Capability API 1.317). El `"legendaryResistance": 3` de una criatura convierte en éxitos sus tres primeras salvaciones fallidas de un combate: el "Si el dragón falla una tirada de salvación, puede elegir tener éxito en su lugar" (3/día) de 5e. El motor siempre elige hacerlo, en cualquier salvación, incluida una que un estado hace fallar sin más; nunca mientras la criatura está caída. La salvación se registra tal como se tiró, seguida de una línea que indica que tuvo éxito en su lugar y cuántas quedan. Un número entero de 1 a 20.

El uso de un objeto también puede llevar `"targetsUpTo"` (Capability API 1.317), igual que las mecánicas de una entrada desde 1.314: el `"targetsUpTo": "large"` de un pergamino de Resilient Sphere solo alcanza a una criatura de ese tamaño o menor. Lee `combat.sizes`, y es para un uso dirigido a una criatura, no a un área.

Eventos del tablero y maleza (Capability API 1.318). El tablero de un combate puede cambiar por sí solo a medida que pasan las rondas: los `board.events` de un encuentro, o los `events` de un campo de batalla del mundo tal como se pintan. Cada evento tiene un `id`, una `label` opcional y ocurre `at` `"round-start"` o `"round-end"`, `from` una ronda (2 al inicio de una ronda y 1 al final, si se omite), `every` tantas rondas (1) y `until` una ronda si lo indica. `where` nombra sus casillas: `cells`, un `block` (`x`, `y`, `w`, `h`), un `ring` alrededor de una casilla (`x`, `y`) que llega a `start` casillas la primera vez y `step` casillas más cada vez siguiente, un `sweep` que entra desde un borde (`from` `north`, `south`, `east` o `west`) con los mismos `start` y `step`, o `{"spread": "growth"}`, cada casilla libre junto a la maleza. Un anillo o un barrido solo alcanza su franja más reciente, de `step` casillas de profundidad (al menos una), también la primera vez, así que un anillo con `start` 3 deja intacto su centro; `filled` alcanza todo lo que hay dentro. `onlyOn` lo limita a casillas de esos terrenos. `change` indica lo que ocurre allí, al menos uno de: `terrain`, `height` (de 0 a 3), `light` (`bright`, `dim`, `dark`, `sunlight` o `clear`), `obscured` (`light`, `heavy` o `clear`), `growth` (verdadero o falso), `season` (un nombre, o null para quitarla), `rotate` (solo un `block` cuadrado, girado 1, 2 o 3 cuartos de vuelta en el sentido de las agujas del reloj con sus losetas, alturas, suelo, los elementos de escenario que estén por completo dentro y quien esté por completo dentro) y `tell`, la línea que dice el registro en lugar de la normal. Quien quede donde nadie puede estar (el hielo agrietado convertido en agua) se coloca en la casilla libre más cercana. Un tablero admite hasta 32 eventos.

Arrastrados (Capability API 1.329). El `change` de un evento del tablero también puede indicar `push`, `{"toward": "east", "squares": 3}` (un borde, `north`, `south`, `east` o `west`, y de 1 a 6 casillas): quien esté en el suelo sobre sus casillas es arrastrado en esa dirección casilla a casilla, nunca fuera del tablero, contra un muro o un elemento de escenario cerrado, a un suelo en el que nadie puede estar ni contra otra persona, y nadie lo ataca por ello; los más cercanos a ese borde van primero, y quien está en el aire queda intacto. El registro indica a quién arrastró. El canal del molino de Mill of Hours. O `drift`, con la misma forma: lo que oculta sus casillas (leve o denso) es empujado en esa dirección y vuelve a entrar por el lado opuesto de su `block`, o del tablero para cualquier otro `where`; nada más se mueve en las casillas, y lo denso se queda donde está aunque se empuje lo leve sobre ello. Los ventisqueros de Leaffall. Los eventos pintados de un campo de batalla admiten ambos.

La maleza en una casilla cuesta el doble para entrar (no más que otro terreno difícil) y oscurece levemente a quien está en ella. Un golpe cuyo tipo de daño corta la maleza (cortante, salvo que el `growth.cutBy` del tablero diga otra cosa) puede dirigirse a una casilla de maleza que alcance, que aparece entre los `walls` de la opción: despeja esa casilla sin tirar y gasta la acción. El daño de un tipo que quema la maleza (fuego, salvo que `growth.burnedBy` diga otra cosa) la quema en cada casilla en la que cae: todo el alcance de un área o la casilla de aquel al que impacta. Las mecánicas de una entrada, o el uso de un objeto, con `"clears": "growth"` y un `area` despejan la maleza de esa área: unas tijeras de podar, `{"kind": "utility", "area": {"shape": "box", "size": 15}, "clears": "growth"}`. El `board.ground` de un encuentro pinta de inicio maleza, luz, ocultación y estaciones en las casillas; un campo de batalla del mundo pinta la maleza como filas `growth` de `g` y `.`, y sus estaciones igual que las Experiences.

Sombra, reglas de luz, campanillas y los que rehúyen la luz (Capability API 1.319). Una luz con `"shade": true` proyecta sombra: luz tenue hasta donde llega su `dim`, y la luz brillante y la luz solar también son tenues allí, las ilumine lo que las ilumine. No tiene luz brillante y no es `reveals` ni `sunlight`. La sombra nunca llega a la oscuridad mágica. La Lantern of Dusk de la experiencia de muestra es un objeto que se lleva con `{"light": {"bright": 0, "dim": 15, "shade": true}}`. La propia luz de una casilla (1.318) y la sombra son también lo que leen los ojos allí: sobre un tablero iluminado, a una criatura que está en una casilla oscura no se la ve salvo con un sentido que ve en la oscuridad.

El tablero de un combate puede tener una regla de luz: el `board.lightRule` de un encuentro, o la `lightRule` de un campo de batalla del mundo tal como se pinta. Al terminar cada ronda, todo el que esté por completo en una de sus luces (`in`; luz brillante y luz solar si no se indica, y la luz brillante incluye la luz solar) suma un final de ronda más allí, y en cada `rounds`-ésimo (1 si no se indica) sus `tracks` se mueven `by` y se le aplican sus estados `applies`. Salir, aunque sea a la sombra de una casilla, reinicia la cuenta. `spares` nombra los `types` y `tags` de criatura a los que nunca afecta. Una regla que no mueve ningún contador que tenga la ficha ni aplica ningún estado que conozca el combate no hace nada y se descarta. Noonfield es `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1}]}`: un nivel de agotamiento por minuto al sol.

Salvaciones de las reglas de luz (Capability API 1.321). Cada criatura a la que una regla de luz está a punto de afectar tira el `save` de la regla (`save`, `difficulty`), y una salvación superada la libra esta vez; la cuenta se reinicia en ambos casos. Su `against` (`conditions` que conoce el combate, tipos de `damage`) es aquello contra lo que cuenta la salvación, así que se aplica un modificador de salvación con un `against` que coincida: un sombrero de paja puesto o llevado con `{"to": "saves", "mode": "advantage", "against": {"conditions": ["noon_light"]}}`. El `upTo` de la entrada de un contador es hasta dónde lo mueve la regla, así que el agotamiento que lo superaría se detiene ahí y no se añade nada cuando ya se ha alcanzado. Noonfield tal como está escrito: `{"label": "Noonfield", "rounds": 10, "tracks": [{"track": "exhaustion", "by": 1, "upTo": 3}], "save": {"save": "con_save", "difficulty": 12, "against": {"conditions": ["noon_light"]}}}`, con un estado `noon_light` que añade la experiencia para que lo nombre el sombrero.

Usos de objeto como reacciones (Capability API 1.322). El `use` de un objeto (o uno de sus `moreUses`) puede llevar una `reaction`, indicada como la de una entrada de catálogo, y entonces solo se ofrece cuando se abre ese momento, pagado con `budget` (la reacción del portador) y con sus cargas o el propio objeto como cualquier uso. Liesl's Coffin, una vez al día cuando una criatura a 5 pies o menos de su portador recibe un impacto, +5 a la CA para ella hasta el inicio del siguiente turno del portador, también contra ese impacto: `{"kind": "buff", "budget": "reaction", "targets": "any", "charges": 1, "reaction": {"on": "hit", "at": "target", "for": "any", "within": 5}, "applies": [{"condition": "coffin_ward", "duration": {"rounds": 1, "at": "turn-start", "of": "source"}}]}` en un objeto con `"charges": {"max": 1, "recharge": {"rests": ["long"], "amount": "max"}}`. The Straw Proxy, un ataque dirigido a su dueño que se pierde mientras el muñeco arde: `{"kind": "buff", "budget": "reaction", "targets": "self", "consumes": true, "reaction": {"on": "aimed", "cancels": true, "for": "self"}}`. El uso de un objeto nombra su momento: se rechaza `"reaction": true`.

Held Ground y la siega (Capability API 1.323). Un combate puede librarse en Held Ground, un lugar donde la muerte queda en suspenso: el `heldGround` del combate (`label`, un `condition` y `marks` como `[{"track", "by"}]`), que le pasa la regla de región de la historia. Allí, quien se queda sin salud queda abatido en lugar de morir o caer: un oponente queda fuera del combate; un personaje queda estable, nunca tira para morir ni acumula fallos por recibir daño, y se le puede curar como siempre. Los abatidos reciben su `condition` (y un personaje, el propio estado del conjunto para estar caído), y cada uno con ficha mueve sus contadores `marks`: la marca de Owing de la experiencia de muestra. Lo que mataría sin más abate en su lugar. Un golpe que siega (`reaps`), en la acción de una criatura o el ataque de un objeto, siega a quien abate: se queda caído, no recibe ningún estado ni ninguna marca, y un personaje segado está muerto. The Reaping Hook es un arma cuyo `attack` tiene `"reaps": true`. Los combatientes abatidos y segados llevan `felled` y `reaped`, para que la historia pueda levantar más tarde a los abatidos.

Fin de Held Ground (Capability API 1.330). La historia puede liberar Held Ground en mitad de un combate, cuando cambia el año: el `releaseRulesetHeldGround(definition, state, release)` del director (por debajo, el `rulesetReleaseHeldGround` compartido). A partir de entonces, quien se queda sin salud muere o cae como en cualquier otro lugar. Los abatidos que no fueron segados mueren, oponentes y personajes por igual, salvo que `release.felled` sea `"down"`, en cuyo caso un personaje cae y empieza a morir según la propia regla del conjunto. Con `release.owing` (`{"track"?, "bonus"?}`; el contador es el primero marcado por Held Ground si se omite), las marcas de cada personaje en él vencen: una de las salvaciones contra la muerte del conjunto por marca, con `bonus` sumado a cada una (los Debts Settled del grupo), que se tiran hasta que se acaban las marcas o se decide la cuenta, con naturales según indique la regla de moribundos; después se gastan las marcas. Tres fallos (el máximo del contador de fallos) es la muerte. El registro indica quién murió, quién cayó y las tiradas de cada personaje. Un combate que no está en Held Ground se queda como estaba.

Áreas y terreno de las criaturas (Capability API 1.324). Una acción de criatura con un `area` puede dejar esa área en pie con `zone`, escrita como la zona de una entrada de catálogo (`rounds`, `triggers`, `obscures`, `terrain` y el resto): el Freezing Fog de The Owed, el cubo de harina de Scatter Flour, el suelo que se hiela y se vuelve terreno difícil. Una zona con `"untilLair": true` también termina cuando vuelve a llegar la cuenta de guarida de su creador, antes de que se elija esa acción de guarida, si no la han terminado antes sus `rounds`: "hasta la siguiente acción de guarida". En cambio, una acción de criatura puede cambiar para siempre el suelo que cubre su área con `ground`, indicado como en el `change` de un evento del tablero (`terrain`, `height` de 0 a 3, `light`, `obscured`, `growth`, `season` y un `tell` para el registro): la hoguera se apaga (`"light": "dark"`), el hielo se agrieta (`"terrain": "water"`); quien quede en una casilla en la que nadie puede estar se mueve a la casilla libre más cercana. Ambos necesitan el `area` de la acción, y un `ground` cambia algo. Un conjunto que use cualquiera de los dos, o `untilLair` en cualquier sitio, necesita Capability API 1.324.

Criaturas llamadas a un combate (Capability API 1.325). La acción de una criatura puede indicar `"calls": { "creature": "creatures/zombie", "count": { "dice": "1d4" } }`: al usarla, esa cantidad de la criatura de bestiario nombrada (un `"<catalogId>/<entryId>"` de los catálogos del conjunto o del bestiario que recibió el combate; `count` es `{"dice"}`, `{"flat"}` o ambos, ocho como máximo cada vez) se une al combate en el bando de su usuario, creadas como el combate creó las suyas y con nombre una a una ("Zombie 1", "Zombie 2"). Con un `area`, se colocan donde se apunta, y tan cerca como haya sitio cuando está lleno; sin ella, junto a quien las llamó, y la acción no se dirige a nadie. Tiran su propia iniciativa y ocupan su lugar en el orden: un lugar que los turnos de esta ronda ya han pasado es de la ronda siguiente. Con `"initiative": "after"`, sus turnos van justo después del de quien las llamó. Una acción de guarida puede llamar (Shelves Lean), y el turno en medio del cual cayó su cuenta continúa como estaba. Una criatura que no se encuentra en ningún sitio cuando empieza el combate no llama a nadie, y un combate no admite más de 40. El registro indica quién llegó. Un conjunto que use `calls` necesita Capability API 1.325.

Atraídos hacia una criatura (Capability API 1.326). La acción de una criatura puede indicar `"draws": { "spends": "reaction" }`: aquel al que alcanza (con un `save`, solo si lo falla) gasta en ese momento ese presupuesto para caminar hasta su velocidad hacia la criatura, por el camino libre hasta la casilla a la que puede llegar que esté más cerca de ella, sin provocar ataques. Quien no tiene nada de ese presupuesto, o no podría acercarse más, no gasta nada y se queda. El Whisper a Name de The Owed. `spends` es uno de los presupuestos de la economía. Un conjunto que use `draws` necesita Capability API 1.326.

El momento de la guarida (Capability API 1.327). Una acción de criatura con `"actedOnly": true` solo puede dirigirse a alguien que ya haya empezado su turno en esta ronda, incluido el que está en curso; antes del primerísimo turno del combate, mientras una guarida actúa antes que nadie, nadie lo ha hecho. Ese es el "una criatura que ya haya actuado esta ronda" de Hour Bell. La duración de un estado puede añadir `"untilLair": true` a sus `rounds`: también se retira cuando quien lo aplicó llega a la cuenta de su guarida, antes de que se elija esa acción de guarida (el "hasta la siguiente acción de guarida" de Hour Bell). Una acción de criatura mantenida por su `concentration` puede nombrar `"brokenNextLair"`, una de sus propias acciones de guarida: cuando esa concentración se rompe (por daño, al caer o por lo que hace una zona, nunca porque quien la mantiene la termine o empiece otra), esa acción de guarida es la siguiente que hace y la única que se ofrece, hiciera lo que hiciera la ronda anterior; una vez hecha, la elección vuelve a ser libre. La Litany of Keeping del padre Ivo y las estanterías que se inclinan. Un conjunto que use cualquiera de estos necesita Capability API 1.327.

Dificultad de salvación movida por un estado (Capability API 1.328). El cambio `{ "to": "save-difficulty", "flat": -2 }` de un estado mueve la dificultad de cada salvación que pide quien lo tiene mientras lo tiene: las propias salvaciones de sus acciones y la dificultad de salvación indicada para las salvaciones que terminan lo que esas acciones aplican. Acepta una cantidad `flat` y nada más, y nunca toca la dificultad de una prueba, una salvación de concentración (que fija el daño) ni las criaturas que una acción llama al combate. El Un-age del Miller of Hours: una CD de salvación de conjuros 2 puntos menor. Un conjunto que lo use necesita Capability API 1.328.

Elementos de escenario y alimentarse (Capability API 1.331). Un estado de combate puede indicar `"whileNearProp": {"prop": "Year-Wheel", "within": 10}`: solo está activo mientras quien lo tiene esté a esa distancia o menos (en la unidad del conjunto) de un elemento de escenario en pie del tablero con esa etiqueta, y queda en suspenso, no terminado, en cualquier otro lugar o cuando ese elemento se rompe; un combate sin tablero lo mantiene activo. El Favour de la Wheel. El `area` de explosión de una acción de criatura puede indicar `"aroundProp": "Shelf"`: se apunte donde se apunte, cubre cada casilla a su `size` o menos de un elemento de escenario en pie con esa etiqueta, también detrás de él. Shelves Lean alrededor de las filas de estanterías del Granary. Un aura puede indicar `"feeds": 15`: quien la tiene recupera esa cantidad de puntos de golpe cada vez que alguien al que alcanza el aura queda abatido, cae o muere, y un aura puede no hacer nada más que eso. El Collector de The Owed. Un conjunto que use cualquiera de estos necesita Capability API 1.331.

Volver a encender, caer dentro y usos junto a un elemento de escenario (Capability API 1.332). Un elemento de escenario del tablero (los `board.props` de un encuentro, o uno pintado en un campo de batalla) puede indicar `"relight": {"light": "bright", "squares": 2, "budget"?: "action"}`: mientras cualquier casilla a `squares` o menos de él no tenga esa luz según la lee el combate, a quien esté a su lado se le ofrece "Light it again" con ese presupuesto (`action` si no se indica), que pone esa luz en cada una de esas casillas. La hoguera de The Owed tras Bonfire Gutters. El `ground` de una acción de criatura puede indicar `"occupants": "stay"` con su `terrain`: quien esté donde el suelo se convierte en algo en lo que nadie puede estar se queda ahí, caído a través del hielo al agua, en lugar de moverse a la casilla libre más cercana (`"shove"`, el predeterminado). Una entrada de catálogo o el uso de un objeto pueden indicar `"usableNear": {"prop": "Year-Wheel", "within": 5}`: solo se ofrece mientras su usuario esté a esa distancia o menos de un elemento de escenario en pie nombrado por su ID o su etiqueta, nunca en un combate sin tablero. El Hymnal de Fennick junto a la Year-Wheel. Desde 1.332, `whileNearProp`, `aroundProp` y `usableNear` nombran un elemento de escenario de la misma forma: por su ID (`"p1"`) o por su etiqueta leída de forma flexible, sin distinguir mayúsculas de minúsculas, ignorando un "the" inicial y todo lo que no sean letras y dígitos, así que `"Year-Wheel"` encuentra un elemento con la etiqueta "The Year-Wheel". Un conjunto que use `usableNear` u `occupants` necesita Capability API 1.332.

Arte del tablero de combate (Capability API 1.333). El tablero de un combate puede dibujarse a partir de un paquete de tableros: hojas PNG sobre una cuadrícula de casillas (48 píxeles para el aspecto de RPG Maker) con losetas bajo ID fijos, creadas en Pixelforge y guardadas en la biblioteca (`POST /api/game-tile-packs/boards`). `bt_plains`, `bt_forest`, `bt_mountain`, `bt_ruin`, `bt_water` y `bt_wall` son los terrenos, con hasta ocho variantes cada uno que se eligen por casilla, o un patrón más grande que una casilla extendido sobre el tablero; `bt_edge_water` y `bt_edge_wall` son bloques de cuadrícula doble de dieciséis piezas, de cuatro casillas por cuatro, dispuestos como los bloques `edge_` de Pixelforge, que funden el agua y los muros con las llanuras adyacentes; `bt_height1` a `bt_height3` son bordes sobre el terreno elevado. `bo_dim`, `bo_dark`, `bo_sunlight`, `bo_fog_light`, `bo_fog_heavy`, `bo_growth`, `bo_ice` (una casilla en invierno), `bo_zone`, `bo_aim` y `bo_reach` se dibujan sobre una casilla en lugar de los tintes actuales. El sprite de un elemento de escenario es `bp_<name>` a lo largo de sus casillas (`"art": "bp_bonfire"` en el elemento o, si se omite, su etiqueta en palabras en minúsculas unidas por `_` y sin un "the" inicial, así que "The Year-Wheel" es `bp_year_wheel`), y `bp_<name>_broken` cuando está roto. Un campo de batalla pintado o el tablero de un encuentro pueden nombrar su paquete con `"pack": "local/<id>"`; sin ninguno, se dibuja con el paquete de la biblioteca para su entorno (el `environment` de un paquete), después con el `board/<environment>` integrado y, si no, como ahora, y los elementos de escenario también se buscan en el paquete de elementos de la biblioteca (`"environment": "props"`) y después en el `board/props` integrado. Una loseta que le falte a un paquete se dibuja como ahora. Una zona de catálogo puede indicar `"art": "bz_<name>"`: cada casilla que cubre se dibuja con esa loseta del paquete del tablero o, si no, con `bo_zone`. Un conjunto que use el `art` de zona necesita Capability API 1.333.

Más turno gracias a un objeto (Capability API 1.334). El uso de un objeto puede indicar `"gives": [{"budget": "action", "count": 1}]`, igual que las mecánicas de una entrada de catálogo (Action Surge): usarlo da al instante a su usuario esa parte más del turno, con el tope que corresponda, así que no se guarda nada para después. El Time-Flour Loaf, que se come con una acción adicional, da una acción más en ese momento. Un conjunto que lo use necesita Capability API 1.334.

Dados gastados en un descanso (Capability API 1.335). Un descanso puede indicar `"dice": {"pool": "hit_dice", "die": {"field": "hit_die"}, "add": {"abilityMod": "con"}, "heals": "hp", "extra"?: {"die": {...}, "add"?: {...}}}`: el `[sheet: op="rest" rest="short" dice="2"]` del Game Master (o uno para todo el grupo) gasta entonces primero esa cantidad de `pool`, tira cada dado (`die` es cualquier valor, o un campo enum escrito como "d8") más `add`, nunca menos de 0 por dado, y devuelve esa cantidad a `heals` como una curación no mágica, antes de que el descanso haga lo que indica. `extra` es un dado más para cada uno que gaste alguno: el miembro del grupo cuyo `die` tiene más caras lo tira por cada uno, más su propio `add`. El Song of Rest de 5e, y el +1 en cada uno de sus dados del Brown Teapot de Pell como estadística de objeto que lee `add`. Un conjunto que use los `dice` de descanso necesita Capability API 1.335.

Dados de descanso en varias reservas (Capability API 1.337). Los `"dice"` de un descanso pueden ser una lista, una entrada por reserva, cada una con su propio `die`, `add`, `heals` y `extra`: `[{"pool": "hit_dice_d10", "die": {"const": 10}, ...}, {"pool": "hit_dice_d6", "die": {"const": 6}, ...}]`, así que un guerrero 1 / mago 1 gasta un d10 y un d6. `[sheet: op="rest" rest="short" dice="N" pool="hit_dice_d6"]` gasta solo de esa reserva; sin `pool`, los dados salen de la primera reserva de la lista que tenga alguno, después de la siguiente, y si en total no hay suficientes se rechaza sin gastar nada. El dado extra (Song of Rest) es el de la primera entrada que tenga uno, se tira una vez para todo el gasto, y cura lo que cura la primera reserva de la que se gastó; llega incluso cuando solo paga una reserva posterior. En una partida, los dados de un descanso leen lo que lleva cada personaje, así que cuenta un `itemStat` en `add` o en el `add` del dado extra: la Teapot de Pell, `{"itemStat": {"stat": "song_of_rest_add", "from": "carried", "pick": "max", "default": 0}}`. Un conjunto con una lista aquí necesita Capability API 1.337.

Iconos (Capability API 1.338). Una entrada de catálogo y un estado de la ficha pueden nombrar su icono, `"icon": "ic_poison_cloud"`: una loseta del paquete de iconos de la partida (un paquete de tableros del tipo `icons`; consulta packages/server/src/assets/board-packs/README.md). Sin él, el motor busca el nombre derivado: para un estado `ic_cond_<id>`, para un objeto `ic_item_<entry id>` (o `ic_item_<name>` para uno que inventó el Game Master) y para cualquier otra entrada de catálogo `ic_<catalog id>_<entry id>` (`ic_spells_fireball`), con los guiones como `_`. Sin ninguno de los dos, se muestra la letra o el texto actuales. Un conjunto que nombre un icono necesita Capability API 1.338.

Una lista de acciones de guarida para una concentración rota (Capability API 1.336). `"brokenNextLair"` puede ser una lista de sus propias acciones de guarida, cada una de ellas una sola vez, en lugar de una sola: `["shelves_lean_north", "shelves_lean_south"]`. Cuando esa concentración se rompe, la siguiente acción de guarida es una de esas y ninguna otra, hiciera lo que hiciera la ronda anterior, y quien lleve a la criatura elige cuál. Una criatura que lleva el motor elige la que alcanzaría a más enemigos; entre las que empaten, las valora como valora cualquier otra cosa. Una vez hecha, la elección vuelve a ser libre. Un conjunto con una lista aquí necesita Capability API 1.336.

Un estado, o un objeto puesto o llevado, con `"alerts": 15` delata a quien se mueve oculto a esa distancia o menos de quien lo tiene: ya no está oculto para nadie, y el registro indica que lo delató quien lo tiene. La Wind-Chime de la experiencia de muestra es un objeto que se lleva con `{"alerts": 15}`. El `"stillIn": ["bright"]` de una criatura le impide moverse mientras cualquiera de sus casillas esté en una de esas luces: ahí su menú no tiene ningún desplazamiento. El Lantern-Shy de la experiencia de muestra.

Auras que crecen, sujeciones con un máximo, liberarse y aguantar (Capability API 1.320). El `"grows": {"by": 10, "upTo": 40}` de un aura llega `by` más lejos al empezar cada turno de quien la tiene, hasta no más de `upTo`, que es mayor que su `distance`; el registro indica hasta dónde llega ahora. Sus `harms` pueden indicar `"on": "their-turn"`: se inflige al empezar cada turno de cada uno al que alcanza, en lugar de todo a la vez al empezar el turno de quien la tiene. `"lingers": true` deja lo que extiende sobre quien ya no alcanza hasta que empiece su siguiente turno, y el aura lo vuelve a mantener si lo alcanza antes. El Frost Debt de The Owed es `{"distance": 20, "side": "enemies", "conditions": ["no_heal"], "grows": {"by": 10, "upTo": 40}, "lingers": true, "harms": {"dice": "2d6", "type": "cold", "on": "their-turn"}}`.

Lo que aplica una acción puede llevar `"heldAtMost": 2`: mientras su origen mantenga esa cantidad de otros con ello, no se aplica a un tercero (el registro indica que no se aplica), como los Grasps de The Owed. El `shakeOff` de un estado con `"self": true` permite también a quien lo tiene terminarlo, gastando el presupuesto sin prueba: el Seed Hopper, `{"budget": "action", "self": true}`, del que se libera quien está sujeto o un aliado a su lado. El `"hangsOn": {"uses": 1, "extraTurn": true, "label": "Hourglass"}` de una criatura la deja a 1 punto de golpe en lugar de caer a 0, `uses` veces por combate, pero no contra lo que mata sin más; con `extraTurn` hace un turno propio justo después de aquel en el que ocurrió, y el orden vuelve a ser el que era cuando termina ese turno.

El selector muestra el bloque en una línea. Quién lee el resto depende del bloque elegido por el conjunto:

- Con [`combat`](#combat-a-fight-your-own-rules-resolve), la pelea lee sus efectos de combate. `range`, `area` y `friendlyFire` se aplican en campos con posiciones; `reaction` marca una entrada que responde a algo en vez de usarse en un turno y nombra el momento que espera (consulta [Ventanas](#windows-holding-the-fight-open)); una marcada simplemente con `true` no nombra ninguno y no aparece en ningún menú. `check` afecta a pruebas de habilidad, como se explica arriba.
- Con solo [`battle`](#battles-lending-the-sheet-to-marinaras-combat), la batalla lee `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` y `cost`, pues el combate propio de Marinara tiene dónde aplicarlos.

El vocabulario es cerrado: las claves o valores que no están en la lista se rechazan en vez de ignorarse.

`cost` también es lo que paga el comando `use` del GM fuera de batalla, descrito a continuación.

### Comandos de ficha: avance permanente (Capability API 1.142)

Un conjunto puede permitir cambios en la creación permanente del personaje con `sheet.advancement`:

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

Incluye solo IDs de campos que tu ficha declare como número o texto (`text` o `longtext`), como máximo 24. Los booleanos permiten, respectivamente, todos los atributos, habilidades o salvaciones; omitidos o falsos significan que no hay permiso. Al importar se rechazan un conjunto de permisos vacío, un campo desconocido, un tipo de campo no admitido o una clave desconocida. `text` es una guía opcional de como máximo 400 caracteres aptos para prompts. Sin `advancement`, los comandos existentes se comportan como antes y se rechaza toda solicitud `advance`.

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

Nombra exactamente un objetivo. Los campos y los atributos aceptan exactamente uno de `by` o `to`; el texto solo acepta `to`. Los nombres y los niveles coinciden con IDs o etiquetas, sin distinguir mayúsculas de minúsculas. Las habilidades y las salvaciones aceptan cualquier nivel declarado en `resolution.proficiencyTiers`. Los campos numéricos respetan `integer`, `min` y `max`; los atributos respetan sus límites enteros; el texto respeta `maxLength`. Un valor no válido se rechaza con un motivo `bad-amount` que indica el límite, y nunca se ajusta en silencio. También se rechazan el avance desactivado, los objetivos no permitidos, los nombres desconocidos y los niveles desconocidos. La etiqueta reescrita lleva `result` y el nuevo valor en `now`. Omite `who` para el jugador, o usa `who="party"` para todas las tarjetas del grupo que no sean ambiguas; los rechazos parciales nombran las tarjetas que no pudieron avanzar.

El motor guarda la creación en la tarjeta de la partida mediante el mismo almacenamiento de metadatos que una edición del jugador, conservando su versión de ficha y recalculando los valores derivados a partir de la nueva creación. Las tarjetas de la biblioteca no cambian. Igual que con los comandos vivos, un swipe alternativo o una respuesta regenerada parten de antes de los cambios de la respuesta saliente. Cada respuesta registra la creación con la que termina, incluidas las respuestas sin avance. Seleccionar un swipe restaura su instantánea; eliminar la última respuesta deja a la vista la instantánea anterior. Eliminar una respuesta más antigua deja vigente una instantánea posterior hasta que se elimina esa respuesta posterior. Una continuación actualiza la instantánea de la misma respuesta. Deshacer solo cambia los valores que aún coinciden con el resultado registrado, así que las ediciones posteriores del jugador se conservan y las ediciones no relacionadas no impiden deshacer una concesión de XP.

### El comando `use`: permitir al Game Master pagar el coste que escribiste

Mientras narra, el GM actualiza fichas con comandos `[sheet: ...]`: `spend`, `restore` (`heal` significa lo mismo), `damage`, `temp`, `track`, `condition`, `note` y `rest`. Los conjuntos con catálogos reciben otro:

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` equivale a `op="use"` y `spell=` a `name=`; así funciona la expresión que elige el GM sin que el formato deba conocer la palabra "spell".

El nombre se compara sin distinguir mayúsculas con las filas del personaje procedentes de tus catálogos. La fila responde al nombre mostrado al GM (columna de nombre de `sheetSummary`, después `pools.nameColumn` y después la primera columna de texto) y al `label` de su entrada de origen. Así, renombrar una fila no hace perder su acceso. Se rechazan tanto nombres sin coincidencia como nombres compartidos por dos entradas distintas.

Lo que gasta:

- Cada término de `mechanics.cost`. Si nombra una reserva viva, paga de ella. Si nombra un GRUPO, paga de la primera reserva del grupo que pueda costearlo, por orden de declaración. No sube automáticamente a otra reserva superior, porque un grupo no siempre es una escala.
- Además, uno de cada reserva de fila escrita por la misma entrada, como el contador de usos de un rasgo: la segunda fila de `Last Ember`. Un contador con máximo 0 no tiene usos; se rechaza el comando en vez de ejecutarlo gratis.

`pool=` es el lanzamiento a nivel superior: el mismo precio único, pagado desde otra reserva del grupo. Solo se acepta si el coste tiene un único término y la reserva nombrada comparte su grupo o paga por él. Lo demás se rechaza sin reinterpretarlo.

**Una reserva que paga por otro grupo** (Capability API 1.171). El `pays` de una reserva viva nombra hasta otros cuatro grupos cuyos costes también puede pagar, a su propio nivel (su `level`, o su posición en su propio grupo), y nunca un coste de nivel superior al suyo. Los espacios de pacto de 5e pagan conjuros cuyo coste se expresa en espacios de conjuro, como puede hacer un brujo multiclase:

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

Un combate ofrece una reserva así junto a las reservas superiores del propio grupo del conjuro, y un pago con ella hace crecer el conjuro tantos pasos como su nivel supere al del conjuro: un espacio de pacto de nivel 3 paga Magic Missile como lo haría un espacio de nivel 3. Un uso cuya propia reserva está vacía se sigue ofreciendo, pagado solo con una reserva superior o con una que pague por ella, así que un conjuro de nivel 1 se lanza con un espacio de nivel 2 cuando se acaban los espacios de nivel 1. `targetsPerCostStep` (1.171, de 1 a 10) en las `mechanics` de una entrada añade esa cantidad de objetivos por cada paso que se paga por encima, hasta 20 como máximo: Hold Person es `"targetCount": 1, "targetsPerCostStep": 1`.

Es todo o nada. Si no puede pagarse alguna parte, se rechaza el comando entero, no cambia nada y se avisa al jugador. Una entrada sin coste, como un truco o rasgo pasivo, se acepta sin cambiar nada.

### Incluido en el archivo o en uno propio

Un catálogo pequeño se incluye en `ruleset.json`, dentro de `entries` de la cabecera. Uno largo vive en su propio archivo y la cabecera lo nombra con `asset`. Cada catálogo tiene exactamente una de esas opciones.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

La ruta siempre es `catalogs/<the catalog's id>.json`. El archivo tiene esta forma:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Los archivos de catálogo separados van en un paquete: uno publicado mediante el catálogo oficial o un archivo de paquete de conjunto de reglas que importas tú (consulta [Compartir tu conjunto de reglas](#sharing-your-ruleset)). El paquete los incluye en `contributions.assets.paths` junto a `ruleset.json` y necesita Capability API 1.21. Un catálogo de criaturas, incluido o separado, necesita Capability API 1.27, y uno de objetos, 1.49. **Un conjunto importado como archivo único o compartido mediante GitHub incluye sus catálogos dentro del archivo**, de modo que deben caber en el límite total de 512 KB. Eso permite unos cientos de entradas breves.

Los límites son doce catálogos por conjunto, 2000 entradas por catálogo en ambas formas y 2 MB por archivo de catálogo. Un paquete cuyo `ruleset.json` supere los 256 KB, o con un archivo de catálogo de más de 1 MB, necesita Capability API 1.340, que subió ambos límites.

### El creador guiado: crear un personaje paso a paso

Una ficha puede declarar `sheet.builder` (Capability API 1.86). El editor de fichas, en los editores de personajes y de personas y en **Edit sheet** (Editar ficha) de una partida, se abre entonces en una vista **Guided** (Guiado) junto al formulario completo (**All fields**, Todos los campos): los pasos en la parte superior, cada uno con una insignia que cuenta las elecciones que aún esperan, **Back** (Atrás) y **Next** (Siguiente), que nunca bloquean (un jugador puede dejar elecciones para más tarde), y, a su lado, el personaje tal como está: lo que escribieron los pasos, las puntuaciones, los valores que nombra `gm.sheetSummary` (clase de armadura, bonificación de competencia) y las salvaciones y habilidades entrenadas.

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

Hasta 24 pasos, cada uno `{ id, label, kind, ... }`; un paquete con más de 16 declara Capability API 1.112:

- `catalog`: entradas de un catálogo de filas, mostradas como tarjetas con su `summary` detrás de **Info** (Información). `min` (1 de forma predeterminada) es cuántas pide el paso y `max` (1 de forma predeterminada), el máximo que admite; con `max` 1, una selección nueva sustituye a la anterior. Ambos pueden llegar a 40; un paquete con cualquiera de los dos por encima de 20 declara Capability API 1.110. `field` nombra un campo de texto o enum en el que se escriben las etiquetas seleccionadas (un campo enum toma el ID o la etiqueta de la entrada, el que sea uno de sus valores). `filters` fija valores de los filtros del catálogo, y `within: { step, filter }` solo ofrece entradas cuyo `filter` nombra una entrada seleccionada en ese paso anterior, como una subraza nombra su raza; si se deselecciona la raza, su subraza no cuenta para nada. `upTo: { filter, value }` (Capability API 1.87) solo ofrece entradas cuyo `filter` numérico sea como máximo `value`, un valor que se lee de la ficha tal como está, como los rasgos hasta el nivel del personaje (`{ "filter": "level", "value": { "derived": "level" } }`); una entrada sin el filtro siempre se ofrece, y una selección que la ficha ya no alcanza no cuenta para nada, pero se conserva. Una selección que cambia el valor leído (una clase que fija el nivel) se resuelve en el mismo cambio, igual que un valor cambiado en **All fields** (un nivel que se baja ahí retira al instante lo que dio un rasgo por encima de él). `countFrom` (Capability API 1.90) es un valor que se lee de la ficha del mismo modo y que vale a la vez como `min` y `max`: cuántas entradas pide el paso y el máximo que admite, redondeado hacia abajo y nunca por encima de `max`, como los conjuros que conoce una clase al nivel del personaje (`{ "derived": "spells_known" }`). Las selecciones que lo superan se conservan, pero no cuentan para nada hasta que vuelva a subir la cuenta. Un paso de catálogo también puede llevar `stamp` (Capability API 1.108), de 1 a 4 valores de columna que se escriben en cada fila que añade, como `"stamp": { "class": "wizard" }` en el paso de conjuros del mago y `"stamp": { "class": "cleric" }` en el del clérigo. Cada clave debe ser una columna de todas las listas que alimenta el catálogo; los valores son cadenas, números o booleanos. El sello sustituye al valor inicial del catálogo. Las filas existentes y las ediciones posteriores en **All fields** siguen siendo del jugador. Con Capability API 1.130, un valor del sello puede ser en su lugar un objeto cuyo `fromWithin` sea `"id"`, `"label"` o un ID de filtro declarado por el catálogo padre: lee el primer padre coincidente en el orden de selección, escribe una cadena o un número una sola vez al añadir la fila, y deja esa columna sin sello si no coincide ningún padre o si su filtro falta o es un array.

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

- `fields`: un formulario breve de campos con nombre. Su insignia cuenta los que siguen vacíos, salvo los que aparecen en `optional` (una subclase que se elige en un nivel posterior). `shownWhen: { "field_id": { "field": "level" } }` (Capability API 1.107) muestra y cuenta un campo con nombre del paso solo mientras su referencia de valor lea más de 0 en la ficha tal como está; los campos ocultos conservan sus valores. `total: { "fields": ["level_bard", "level_other"], "max": 20 }` (1.107) limita al menos dos campos numéricos del paso a un máximo combinado (un entero de 1 a 1000), reduciendo el máximo de cada entrada según los valores actuales de las demás sin bajar de su propio mínimo, y suma uno a la insignia si el total supera el límite; **Next** sigue funcionando.
- `abilities`: las puntuaciones (`abilities`, todas si se omite), fijadas por cualquiera de los `methods`: `pointBuy` (un `budget` que no supere lo que cuesta comprar todas las puntuaciones hasta arriba, y el coste de cada puntuación desde la más baja, en la que empiezan todas, subiendo de una en una; una puntuación escrita a mano parte de la puntuación más cercana de la tabla), `standardArray` (un valor para cada puntuación), `roll` (`count` dados de `sides`, conservando los `keep` más altos, tirados con los propios dados del motor, una tirada por puntuación, y repartidos después como un conjunto) y `manual`. `manual: true` conserva los límites de puntuación existentes; `manual: { min, max }` (Capability API 1.110) ajusta las puntuaciones base escritas antes de las concesiones a esos límites enteros, con min de al menos -100, max de como máximo 1000 y min como máximo igual a max, mientras los propios límites de cada atributo siguen limitando el total. `default` (1.87) es el método con el que empieza un personaje que el creador inicia desde una ficha en blanco (y que conserva aunque cambie después el predeterminado del conjunto), de modo que alguien que empieza ve, por ejemplo, la compra de puntos hasta que elige otro; un personaje descrito nunca lo toma, y sus puntuaciones se quedan como están hasta que el jugador elige un método después de describirlo; **Manual entry** (Entrada manual) sigue siendo la edición escrita dentro de sus límites, y **All fields** siempre está disponible. Lo que añaden las selecciones va encima: el paso muestra base, bonificación, total y modificador. Como máximo, un paso de atributos.
- `allocate` (Capability API 1.152): círculos por etapas con asignaciones por prioridad o presupuestos por grupo, como se describe más abajo.
- `trained`: las elecciones de habilidades y salvaciones que ofrecen las selecciones, y el propio `choose: [{ "what": "skills", "count": 2, "from": [...] }]` del paso (cualquiera de ellas cuando se omite `from`).
- `startingGear`: enumera el equipo inicial del conjunto. El equipo se toma en una partida, desde el inventario, como siempre.
- `choices` (Capability API 1.91): `catalog` nombra un catálogo de filas, y el paso es donde se eligen las entradas de él que conceden las selecciones (`grants.entries`, abajo), como un idioma a tu elección.

Un paso de equipo inicial puede llevar `"strict": true` (Capability API 1.109). En el modo de solo lo válido, el predeterminado, solo ofrece el equipo cuyo `fits` sea verdadero en la ficha tal como está, sin estado vivo, más el equipo sin `fits`; no hay lista de otro equipo. Para 5e, pon `fits: { "value": { "field": "wizard_level" }, "atLeast": 1 }` en el kit de mago y el campo de nivel de clase correspondiente en cada kit de las demás clases; deja el kit de acólito sin `fits` para que le sirva a todos. La edición libre vuelve a ofrecer todos los kits. El selector del inventario borra una selección que deja de encajar tras un cambio de clase o al salir de la edición libre e indica el motivo; también comprueba que encaje antes de tomar el equipo. Sin equipo que encaje, el paso muestra su estado vacío y Next sigue disponible. Los pasos sin `strict` siguen ofreciendo todos los kits. El modo es local a cada pantalla; no se registra con una creación guardada ni se envía al servidor.

Lo que da una selección son las `grants` de su entrada, que solo lee el creador:

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

- `abilities.add` suma a las puntuaciones; `abilities.choose` permite al jugador elegir `count` puntuaciones (nunca una dos veces, nunca una de `except`) que reciben `amount` cada una. Con `"repeat": true` (Capability API 1.93), una puntuación puede elegirse más de una vez, `amount` cada vez, así que `{ "count": 2, "amount": 1, "repeat": true }` es el +2 a una puntuación o +1 a dos de una mejora de puntuación de atributo; el paso muestra un signo menos junto a una puntuación para retirar una. En ambos casos, ninguna puntuación supera su `max`. `upTo` (Capability API 1.96) limita hasta dónde puede subir una puntuación la propia elección, después de lo que añaden todas las demás concesiones: `{ "count": 2, "amount": 1, "repeat": true, "upTo": 20 }` es la mejora del SRD, que "no puede aumentar una puntuación de atributo por encima de 20"; el paso desactiva una puntuación que ya está en ese valor. La elección se muestra en el paso de atributos o, si no lo hay, donde se seleccionó la entrada.
- `trained` entrena habilidades y salvaciones, y ofrece elecciones, que se muestran en el primer paso de entrenamiento o donde se seleccionó la entrada. Se entrenan al `tier` de la concesión o, si no, al `tier` del creador o, si no, al primer nivel por encima de sin entrenar que ofrece la ficha para habilidades o salvaciones. Una elección nunca ofrece lo que las selecciones ya entrenan a su nivel o a uno superior, directamente o mediante una elección anterior (Capability API 1.104): un trasfondo que entrena Insight deja la elección de habilidad de una clase a las demás, como pide el SRD. Una elección guardada antes de que se tomara así no cuenta para nada, de modo que el paso pide otra, y no se muestra una elección a la que no le queda nada que ofrecer. Una elección puede indicar `"held": "<tier>"` (Capability API 1.105): solo ofrece lo que las selecciones entrenan a ese nivel o superior, o lo que una elección por debajo de su propio nivel tiene en él, como la Expertise de 5e son dos habilidades en las que tienes competencia: `{ "tier": "expertise", "choose": [{ "what": "skills", "count": 2, "held": "proficient" }] }`. `held` está por debajo del nivel al que entrena la elección.
- `sets` escribe valores de campo: el dado de golpe de una clase, su atributo de lanzamiento de conjuros.
- Una entrada de catálogo puede indicar cuándo la ofrece un paso del creador: `offeredWhen` (Capability API 1.99) es un valor que se lee de la ficha tal como está, y la entrada solo se ofrece mientras lea más de 0, como 5e solo ofrece una segunda clase cuando se cumplen sus requisitos de multiclase (un valor derivado por clase). Una selección que más tarde lee 0 no cuenta para nada y se conserva, como las de `upTo`. Se rechaza una entrada cuya propia selección cambia lo que lee su `offeredWhen` (una puntuación que sube, un campo que fija, una habilidad que entrena, una lista en la que escribe, directamente o mediante un valor derivado), ya que se ofrecería a sí misma, se retiraría y se volvería a ofrecer. Una entrada con un grupo `exclusive` se lee en la ficha sin ninguna de las selecciones que el paso tiene guardadas en ese grupo (Capability API 1.100), ya que seleccionarla las descarta: una dote tomada en lugar de una mejora de puntuación de atributo y condicionada a Fuerza 13 no se ofrece con la Fuerza que dio esa mejora. Una elección que concede una entrada (`grants.entries.choose`) limita del mismo modo sus opciones a su `offeredWhen` (Capability API 1.106). El selector de catálogo de **All fields** ofrece todas las entradas, como siempre.
- Una entrada de catálogo puede nombrar un grupo `exclusive` (Capability API 1.94): un paso del creador conserva una selección de cada grupo, así que seleccionar una descarta la otra selección del paso de ese grupo, y solo cuenta la última. Una dote tomada en lugar de una mejora de puntuación de atributo comparte grupo con ella: `"exclusive": "fighter-asi-4"`.
- `entries` (Capability API 1.91) ofrece entradas de otro catálogo de filas para elegir: `{ "choose": [{ "catalog": "languages", "count": 1 }] }`, como máximo seis elecciones. `filters` fija valores de los filtros de ese catálogo e `ids` enumera las únicas entradas que se ofrecen (`{ "catalog": "tools", "count": 1, "ids": ["smiths-tools", "brewers-supplies", "masons-tools"] }`). Se eligen en el paso `choices` del creador para ese catálogo (se rechaza una concesión que nombre un catálogo sin ese paso), solo se ofrecen entradas que escriben filas y sus filas van a la ficha, y una entrada elegida para una concesión no se ofrece para otra. No se aplican sus propias concesiones.
- Una selección también escribe las `rows` de la entrada, una vez. Una entrada puede llevar `grants` y ninguna `rows` (una clase cuyos rasgos proceden de otro catálogo), y un catálogo cuyas entradas solo conceden no necesita `feeds`; el selector de catálogo nunca ofrece esas entradas.

Deseleccionar retira lo que dio una selección, y solo eso: sus aumentos (hasta donde los límites de una puntuación les dejaron subir), su entrenamiento, sus valores de campo y sus filas. Lo que la ficha ya tenía del propio jugador (una habilidad entrenada a mano, una fila añadida desde el selector de catálogo) sigue siendo suyo, y una edición hecha en **All fields** se mantiene hasta que cambie la propia respuesta del creador para ese valor. Una entrada seleccionada en dos pasos sobre un mismo catálogo concede una sola vez, y una que ocultan las capas de una partida sigue contando por lo que dio. Un campo que fija (`sets`) una selección solo se escribe mientras siga en blanco, o mientras el creador ya responda por él, así que un nivel escrito a mano nunca se sobrescribe; un valor del que responde el creador y que el jugador cambia en su propio paso de campos sigue siendo del creador, y desaparece cuando una selección posterior ya no lo pide. Las elecciones del jugador se guardan junto a la ficha, de modo que un paso puede reabrirse más tarde.

**Asignación de valores por etapas (Capability API 1.152).** Un paso `allocate` compra un círculo por punto, con su propio presupuesto y sus propios topes de creación. No cambia el método ni las respuestas guardadas del único paso `abilities`. Usa pasos separados para los atributos, las Virtudes y los puntos gratuitos posteriores:

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

Hay de 1 a 12 grupos, cada uno con un `id` estable, una `label` y de 1 a 120 objetivos. Los objetivos son distintos dentro de todo el paso. Un objetivo nombra exactamente un `{ ability }`, `{ field }` numérico, `{ skill }`, `{ save }` o `{ bonus }` existente; una bonificación es la entrada numérica de `build.bonuses` de una habilidad o salvación existente. Los grupos usan exactamente un modo de presupuesto: `priorities` tiene una asignación entera no negativa por grupo (se admiten duplicados), o **todos** los grupos declaran `budget: Ref`. Las posiciones de prioridad se asignan de forma explícita, y asignar una posición ocupada intercambia los grupos. El orden del array nombra primaria, secundaria, terciaria y, después, prioridades numeradas; pon primero las asignaciones mayores si esos nombres deben seguir el tamaño. Los presupuestos son como máximo de 1.200.000 puntos.

`base` es opcional; `min` y `max` son obligatorios. Cada uno acepta un entero o una `Ref` no viva, como `{ "derived": "archetype_floor" }`. Los valores deben resolverse en números enteros de 0 a 10.000 y caber en los límites de almacenamiento o en el mapa de niveles del objetivo. La primera base sustituye al valor predeterminado de un objetivo en blanco, conservando las puntuaciones de método y las concesiones existentes; una base posterior es un mínimo sobre las etapas anteriores. Sin base, la etapa empieza en el valor existente. Un min y un max iguales fijan la puntuación de creación: `base: 0, min: 0, max: 0` expresa una Apariencia fija. Los mínimos no compran círculos automáticamente. Los presupuestos y los límites pueden usar los operadores derivados existentes, pero no pueden leer objetivos que cambie este paso o uno posterior, ni siquiera mediante valores derivados. Las condiciones de las concesiones gratuitas tampoco pueden leer valores de un grupo de asignación que puedan cambiar, incluidos los grupos conectados de otras etapas. No se admiten precios con fórmula: cada incremento pagado cuesta un punto. Una fuente sin resolver o no válida se muestra como **not configured** (sin configurar).

Los objetivos de habilidad y salvación necesitan `sheet.builder.ratingTiers`, por separado para cada objetivo:

```json
"ratingTiers": [
  { "target": { "skill": "athletics" }, "tiers": ["none", "trained", "expert"] },
  { "target": { "save": "will" }, "tiers": ["none", "trained"] }
]
```

El índice del array es el valor numérico. Los mapas tienen de 1 a 12 IDs de nivel existentes, ofrecidos y crecientes, empezando por el nivel sin entrenar del conjunto; nunca se deducen de las bonificaciones de nivel. Distintos objetivos pueden usar mapas distintos. Pon en grupos separados los objetivos con distintos topes de creación.

El `grants.ratings` de un catálogo aporta círculos gratuitos, antes de **todas** las etapas de pago:

```json
"ratings": [
  { "target": { "skill": "athletics" }, "add": 1 },
  { "target": { "save": "will" }, "set": 1 }
]
```

Cada concesión tiene un `add` positivo o un `set` no negativo, nunca ambos. Todas las concesiones `set` son mínimos: gana la más alta, y después se acumulan todas las sumas, deteniéndose en el límite de almacenamiento del objetivo. Así, dos sumas gratuitas de rango llegan al rango dos sin cargar el presupuesto de pago. El entrenamiento existente y las concesiones de campos y atributos se combinan antes que estas concesiones de valor. Las elecciones de entradas siguen escribiendo solo filas; nunca aplican de forma recursiva las concesiones de la entrada elegida.

La interfaz muestra el valor base o anterior, el gratuito, el comprado y el total, el rango de creación y el presupuesto restante. El signo más se desactiva en un tope, sin presupuesto o mientras haya compras no válidas o sustituciones manuales que requieran atención. Gastar de menos, los mínimos imposibles y las sustituciones reciben insignias; Back y Next siguen disponibles. Reasignar una prioridad conserva los incrementos guardados del grupo. Un grupo en el que se ha gastado de más queda inactivo por completo; una compra por encima del tope de su objetivo queda inactiva para ese objetivo. Reduce o borra esas respuestas para repararlas, o restaura la asignación anterior para reactivarlas. Las etapas posteriores pueden superar los topes de creación anteriores. **All fields** sigue siendo la edición libre, con las sustituciones mostradas de forma explícita en vez de ajustadas a las reglas de creación.

El `builder.allocations[stepId]` guardado contiene los índices de posición de prioridad por ID de grupo, los incrementos `bought` pagados y `notes` opcionales por claves de objetivo estables `kind/id` (por ejemplo `ability/strength`). `annotations: true` ofrece hasta 1.000 caracteres por objetivo para explicaciones de herencia o especialidades; el creador no juzga ese texto. Los incrementos aplicados pertenecen por separado a cada etapa. Reabrir nunca vuelve a conceder concesiones ni rellena recursos, y describir una ficha existente registra las elecciones sin reescribirla, también cuando termina la descripción. Deseleccionar recalcula los valores gratuitos y las etapas de pago, conservando las diferencias manuales.

**Presupuestos compartidos y compras con precio (Capability API 1.153).** Declara hasta 12 reservas de creación en `sheet.builder.pools`. Varios pasos `spend` pueden usar una misma reserva; las reservas separadas mantienen independientes los puntos de ocupación y los de interés personal. Los presupuestos son referencias de valor no vivas, incluidos los cálculos existentes `sum`, `scale`, `multiply`, `min`, `max`, `stepTable`, `enumTable` y `listSum`. Su valor resuelto debe ser finito y estar entre 0 y 100.000. Una fuente que falta está "sin configurar".

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

Cada paso tiene hasta 120 ofertas con un `id` y una `label` estables. Los objetivos usan el mismo contrato de exactamente uno entre `ability`, `field` numérico, `skill`/`save` con mapa o `bonus` que las etapas de asignación. Las compras de filas de lista quedan reservadas para la función de identidad de filas (F4); esta API no identifica las filas por su posición en el array. Los límites deben caber en los límites de almacenamiento del objetivo. Los valores iniciales y las concesiones gratuitas se conservan y nunca se vuelven a cobrar: un Background con dos círculos gratuitos y cinco de pago tiene siete.

Un coste es exactamente uno de estos:

- `{ "flat": 1 }`: un punto por cada incremento de valor.
- `{ "perRank": 5 }`: cinco veces el rango siguiente, así que subir de 2 a 3 cuesta 15.
- `{ "table": [[5, 0], [5.25, 5], [5.5, 12]] }`: precios acumulados en valores crecientes. La siguiente compra pasa al valor adyacente y cuesta la diferencia (aquí, 5 y después 7). Los valores fraccionarios requieren un campo numérico no entero; las tablas incluyen ambos límites de la oferta.

El `overrides: [{ "when": { "derived": "career_affinity" }, "cost": { "perRank": 2 } }]` opcional contiene como máximo 12 entradas. Gana la primera condición positiva. Las condiciones leen la ficha antes de las compras; si ninguna coincide, se usa el precio base. Los presupuestos y las condiciones no pueden leer objetivos comprados, ni siquiera mediante valores derivados, ni depender de elecciones posteriores. Las concesiones gratuitas y las etapas de asignación se aplican antes que las compras con precio.

Los precios tienen márgenes positivos, salvo los créditos declarados explícitamente. Para un defecto cuyo valor aumenta, usa `"credit": true, "cost": { "flat": -1 }`. Para una reducción desde una línea base declarada, usa `"credit": true, "baseline": 10, "min": 6, "max": 10, "cost": { "flat": 1 }`: una compra baja de 10 a 9 y registra un crédito de un punto. El valor inicial debe coincidir con la línea base. Un objetivo con crédito solo tiene una oferta en todo el creador, lo que evita ciclos de compra y crédito.

Las reservas tienen un crédito cero de forma predeterminada. Fija `creditLimit` en el crédito total máximo y, de forma opcional, añade hasta 12 `caps: [{ "filter": "flaw", "maxCredit": 2 }]`. Los filtros nombran `tags: ["flaw"]` de las ofertas, de modo que los créditos de defectos y de desventajas pueden tener topes separados. Los topes cuentan los créditos brutos, con independencia del gasto positivo. Las cantidades distintas de peculiaridades siguen siendo restricciones de elecciones o de filas.

**Filas contadas y filas que coinciden (Capability API 1.205).** Un `listSum` puede llevar `where: { "column", "equals" }` para leer solo las filas cuya celda sea igual a un valor (una celda vacía lee el valor predeterminado de su columna), y `count: true` en lugar de `column` para contar las filas en vez de sumar una columna. La pirámide de talentos de Genesys son dos recuentos derivados y una regla de creación:

```json
{
  "id": "tier2",
  "label": "Tier 2 talents",
  "op": "sum",
  "of": [{ "listSum": { "list": "talents", "count": true, "where": { "column": "tier", "equals": 2 } } }]
}
```

con una regla cuyo `value` lee `tier2` y cuyo `max` lee el recuento del nivel 1 menos uno.

**Precios de fila calculados por fila (Capability API 1.206).** El `cost` de objeto de un paso de filas puede escalar su `column` por `times` y sumar `add`, así que `{ "column": "tier", "times": 5 }` pone a un talento de Genesys un precio de 5 XP por nivel; `add` solo es un precio fijo escrito como objeto. `overrides` (hasta 4) da un precio que se usa en su lugar cuando un valor derivado nombrado por un prefijo y la propia celda de la fila lee más de 0 en la ficha: `{ "add": 5, "overrides": [{ "derived": { "prefix": "affinity_", "cell": "ability" }, "cost": 4 }] }` pone a un Charm de Exalted un precio de 4 Bonus Points cuando `affinity_<its Ability>` es mayor que 0. Una celda enum debe tener un valor derivado para cada valor que pueda contener.

**Ofertas sin precio (Capability API 1.207).** El `cost` de una oferta de gasto (o el de una sustitución) puede ser `{ "unpriced": true }` mientras la fuente no haya aportado el precio: la oferta se muestra con una nota, bloquea la reserva sin nada a cambio y nunca se compra. Una compra guardada con un precio que después pasa a estar sin precio queda inactiva y se conserva para repararla.

**Más campos (Capability API 1.208).** Una ficha puede declarar hasta 240 campos; antes de 1.208, el techo es 160. Los rangos de habilidad, los rangos de categoría, los potenciales y los totales de Rolemaster necesitan ese espacio.

**Tiradas escritas en un atributo (Capability API 1.209).** La tirada de un paso `roll` puede nombrar `ability` en lugar de `field` (exactamente uno de los dos). El resultado se limita a los propios límites del atributo. Con `gain`, la prueba se tira contra la puntuación y solo un resultado superior a ella suma la ganancia, que el creador conserva entonces como aumento: volver a tirar o a comprar la puntuación mantiene la mejora por encima. Sin `gain`, el resultado se escribe como una puntuación escrita a mano y se conserva hasta que cambie la propia respuesta del creador para esa puntuación. Un atributo calculado no se puede tirar, y cada atributo se tira como máximo una vez por paso.

**Columnas de lista calculadas (Capability API 1.210).** Una columna numérica puede nombrar `sum`: hasta otras seis columnas numéricas de la misma fila, sumadas (una celda vacía lee el valor predeterminado de su columna) y limitadas al `min` y al `max` de la columna. La celda se muestra de solo lectura, se rellena en cada lectura de una ficha guardada, y la leen las sumas, las pruebas de fila y todo lo demás como si fuera una celda escrita. Una columna calculada no se tira y nunca suma otra columna calculada. El valor de una especialidad de CoC es `"sum": ["base", "occupation", "interest"]`.

**Aumentos parciales de puntuación (Capability API 1.211).** El `abilities.choose` de una concesión puede nombrar `partialFrom`. Una puntuación que ya está en esa marca o por encima cuando llega la elección recibe un aumento parcial, y dos parciales dan `amount` una vez. Las elecciones cuentan en el orden en que las hace el creador, después de cada aumento completo, así que las mejoras posteriores de Pathfinder 2e leen `"amount": 1, "partialFrom": 4`: un modificador de +4 necesita dos mejoras para llegar a +5. Se combina con `upTo`.

**Pruebas de fila en una postura (Capability API 1.212).** Una entrada de `checks[]` de una lista puede nombrar `stance`, una de las `resolution.stances` de la reserva de dados. Entonces la prueba de cada fila está en esa postura, igual que una habilidad que enumera la postura: las ocupaciones de Stewpot cuentan los dados a la manera de STILLNESS. El recordatorio del Game Master nombra las filas con las habilidades de la postura.

**Especialidades de atributo (Capability API 1.213).** El `contextual` de una lista puede fijar `"abilities": true`. Entonces su celda `skill` puede nombrar un atributo (por ID, etiqueta o forma abreviada) además de una habilidad, y la fila se aplica a cualquier prueba tirada con ese atributo: una prueba de atributo pura, una habilidad cuyo atributo propio sea ese o una habilidad a la que `with=` cambie a él. Una especialidad de atributo de World of Darkness, "Strength: lifting", es una fila llamada "lifting" cuya celda de habilidad dice "Strength".

**Cancelación desactivada (Capability API 1.214).** Un `check` contextual (en el `contextual` de una lista o en el `mechanics.contextual` de una entrada) puede fijar `"cancel": false`. En una tirada a la que se aplica, las caras iguales o inferiores a `resolution.cancel.upTo` no quitan éxitos; una pifia las sigue leyendo. El conjunto debe tener un `resolution.cancel` que desactivar.

**Objetos accesibles sin llevarlos (Capability API 1.215).** El `grants.itemAccess` de una entrada de catálogo enumera hasta 48 de los objetos del conjunto (`<catalog>/<entry>`, nunca un servicio). Seleccionar la entrada en el creador guiado los pone a disposición del personaje: la ficha y el bloque de ficha del Game Master los muestran como no llevados, y no entra nada en la bolsa. El Game Master añade uno al inventario cuando se toma, igual que un personaje de Blades declara su carga al empezar un trabajo.

**Círculos de fila en la creación (Capability API 1.216).** Un grupo `allocate` puede nombrar `rows`, hasta cuatro parejas `{list, column}`: los círculos de esa columna numérica en las filas de la lista cuentan contra el presupuesto del grupo junto a sus objetivos. Las filas se editan en la lista; un grupo con más círculos de fila que su presupuesto queda pendiente del jugador. La sustitución de coste de un paso de filas puede dar `times`, una tarifa por unidad para la columna de coste, en lugar de un `cost` fijo. Las filas de Craft de Exalted ponen "dots" contra los 28 círculos de Ability y ponen a los círculos "bought" un precio de `times: 2`, sustituido por `times: 1` donde está fijado `affinity_<ability>`; una columna de valor calculada (1.210) suma ambos.

**El mejor valor (Capability API 1.217).** Un `check` contextual puede fijar `"best": true`: una prueba de habilidad a la que se aplica tira el mejor valor de habilidad del personaje cuando es superior al pedido. Un conjunto `dice-highest` puede usar una prueba contextual que solo haga esto; cualquier otro efecto de prueba sigue necesitando una reserva de dados. El Rook's Gambit de Blades es una fila de habilidad especial con `"check": {"best": true}`, aplicada por nombre.

**Costes que marcan un contador (Capability API 1.218).** Una entrada de `cost` contextual puede ser `{"track": "<id>", "by": N}` además de `{"pool", "amount"}`: aplicar la fila o la entrada marca ese contador vivo simple N veces, hasta donde le dejen sus límites (un contador de heridas no se marca así). El `contextual` de una lista también puede llevar un `cost`. El Rook's Gambit de Blades es una fila con `"check": {"best": true}` y `"cost": [{"track": "stress", "by": 2}]`. Los nombres que aplica `apply=` leen igual los apóstrofos y las comillas curvos y rectos.

**Catálogos prestados (Capability API 1.220).** Un catálogo puede tomar prestado el catálogo de otro conjunto instalado en vez de llevar el suyo: `{ "id": "creatures", "label": "Creatures", "holds": "creatures", "from": { "ruleset": "5e-2014", "catalog": "creatures" } }`. El conjunto que presta se encuentra por su ID, tal cual o bajo un espacio de nombres de la comunidad, y sus entradas se leen respecto al conjunto que toma prestado, así que una entrada que nombra algo que este no declara (un estado, un nivel de amenaza, un sentido) se deja fuera y se registra, mientras el resto pasa. Las `entries` junto a `from` se suman a las prestadas, o sustituyen a una con el mismo ID; se comprueban al leer el conjunto, así que la cabecera nombra los `filters` que lleven (una cabecera sin ninguno toma los del que presta). Una criatura prestada escrita como ficha usa los IDs del conjunto que presta; `from.sheet` indica cómo se leen en el que toma prestado: `fields` asigna un campo a otro ID (o `null` para dejarlo fuera), `values` asigna los valores de un campo, y `tiers` asigna niveles de competencia (los de una criatura, y los que concede o pide cualquier entrada), como en `"sheet": { "fields": { "ac": "ac_typed", "size": null }, "values": { "hp_method": { "by_hand": "manual" } }, "tiers": { "proficient": "trained" } }`. Cualquier entrada prestada, incluidos los objetos, admite dos más: `refs` lee un valor derivado del que presta como uno de los valores del que toma prestado (`"refs": { "prof_martial_weapons": { "field": "martial_weapons" }, "armor_speed_strength": { "abilityScore": "str" } }`), y `slots` pone la ranura de un objeto con el nombre del que toma prestado (`"slots": { "body": "armor" }`). Un catálogo no puede tomar prestado de su propio conjunto ni de un catálogo que a su vez toma prestado. El arte de una criatura prestada se busca como el del conjunto que presta (`5e-2014/creatures/<id>` en un paquete de criaturas). Las referencias a un catálogo prestado, como los conjuros de una criatura, se comprueban al leer el catálogo, no al leer el conjunto.

**Listas de avance más largas (Capability API 1.219).** `sheet.advancement.fields` admite hasta 64 campos (antes, 24), así que una partida en la que un nivel sube muchos campos, como los espacios de cada nivel de conjuro y las listas de competencias, puede dejar que el GM los suba todos. Una lista de más de 24 campos necesita 1.219.

**Compras en dos sentidos, de propiedad e intercambios (Capability API 1.164).** `"direction": "both"` permite que una misma oferta suba y baje su valor desde donde empieza (su `baseline`, cuando se declara, debe coincidir con la ficha): cada paso hacia arriba cuesta el precio de la curva y cada paso hacia abajo por debajo del inicio lo devuelve como crédito, limitado por el `creditLimit` y los topes de la reserva. El libro de cuentas solo avanza en un sentido, así que bajar un valor que se compró retira la última compra al precio que se pagó, y subir uno que se bajó devuelve su crédito; comprar y bajar nunca genera crédito. Un objetivo así tiene una sola oferta en todo el creador. La ST de GURPS es `{ "target": { "ability": "st" }, "direction": "both", "baseline": 10, "min": 7, "max": 14, "cost": { "flat": 10 } }`; un coste de tabla pone precio a pasos fraccionarios como Basic Speed. `"direction": "increase"` y `"decrease"` nombran directamente una oferta en un solo sentido (`"decrease"` es la reducción descrita arriba, con su línea base y su crédito).

`"effect": "ownership"` pone precio a una oferta en su propia escala, desde su `baseline` (o `min`) hacia arriba, y la ficha conserva el mayor entre su propio valor y el nivel comprado: una familiaridad de un punto de GURPS se paga y aparece en la lista aunque un valor predeterminado ya sea mejor, y reembolsarla no le cuesta nada a la ficha.

`"exchange": { "from": <rating>, "units": 2, "gain": 1, "floor": 9 }` convierte una oferta en un intercambio cerrado de creación: cada compra baja `from` en `units` y sube el objetivo en `gain` (1 de forma predeterminada), sin dejar nunca `from` por debajo de `floor` ni subir el objetivo por encima de `max`. No le cuesta nada a la reserva, así que omite `cost`. Los puntos intercambiados nunca se vuelven a intercambiar: una vez que un intercambio ha subido un valor, ningún otro intercambio lo baja, y una vez que uno ha bajado un valor, ningún otro intercambio lo sube. Los intercambios que una clase no puede hacer (`when`) pueden nombrar los mismos valores al revés. Un reembolso devuelve ambos valores. El intercambio de requisito principal de OSE es una oferta por cada puntuación que se baja:

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

El creador guarda los deltas pagados con signo y sus precios originales bajo IDs estables de paso y oferta, con como máximo 1.000 líneas de compra por oferta. El reembolso elimina la última línea y revierte exactamente su aportación y el precio registrado, incluida la eliminación de un crédito. Nunca reembolsa un valor gratuito. No se gastan XP vivos, inventario, moneda ni recursos del grupo.

Cambiar la carrera, las concesiones gratuitas o las fuentes de presupuesto conserva el libro de cuentas. Las compras no válidas quedan inactivas; la reserva muestra su gasto original, puntos restantes negativos cuando se ha gastado de más, y el nuevo precio propuesto. Los objetivos compartidos también suspenden las compras dependientes de otras reservas. **Reprice saved purchases** (Volver a poner precio a las compras guardadas) acepta de forma explícita un precio nuevo válido para la reserva; si no, reembolsa líneas para repararla. Ninguna compra se elimina ni se vende en silencio. Los puntos sin gastar son informativos. Back y Next siguen disponibles, y **All fields** conserva las sustituciones manuales visibles dentro de los límites del esquema. Describir un personaje existente y reabrir las elecciones guardadas nunca vuelve a conceder círculos.

**Filas con nombre (Capability API 1.154).** Un paso `rows` permite al jugador añadir, editar y quitar sus propias filas en una de las listas de la ficha durante la creación: criados, contactos, rituales y sus ingredientes, o cualquier otra cosa que no enumere un catálogo.

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

`columns` es el subconjunto de columnas de la lista que edita el paso (todas si se omite). `required` nombra las columnas que una fila debe rellenar para contar. La insignia cuenta las filas completas que aún faltan por debajo de `min` (de 0 a 20), más cada fila con una celda obligatoria vacía, así que un ingrediente a medio escribir sigue sin resolverse. `max` detiene **Add a row** (Añadir una fila) y nunca supera el `maxItems` de la lista. Una fila nueva parte de los valores predeterminados de las columnas y después de `defaults`, que deben caber en cada columna.

El paso edita la lista donde está cada fila, así que dos criados con el mismo nombre siguen siendo dos filas, y quitar uno conserva el otro. Las filas que escribió una selección de catálogo se muestran de solo lectura con una nota "Added by a pick" y aparecen y desaparecen con la selección. **All fields** edita todas las filas como antes.

**Ofertas condicionales, límites leídos de la ficha y reglas de creación (Capability API 1.155).** Una oferta de gasto también puede llevar:

- `when: Ref`: solo se ofrece mientras lea más de 0 en la ficha antes de las compras, como las habilidades propias de una ocupación o un Background que puede tomar una tribu. Una oferta que nunca se compra deja la reserva como está; las compras guardadas en una oferta que el personaje ya no puede tomar se quedan, inactivas, para repararlas.
- `minFrom: Ref` y `maxFrom: Ref`: un mínimo y un máximo que se leen de la ficha, dentro de `min` y `max`. Credit Rating toma el rango de su ocupación; Dodge se detiene en DEX. Un valor por debajo del mínimo se compra hasta él en una sola compra.
- `allowedRatings: number[]`: los únicos valores en los que puede terminar una compra, como un Merit que se vende a 1, 3 o 5 círculos. Cada compra va directamente al siguiente valor permitido al precio de la curva.

Igual que los presupuestos y las sustituciones, estos no pueden leer un objetivo comprado. Una elección de entrenamiento con `onDuplicate: "replace"` puede nombrar `replacementFrom`, las habilidades (o salvaciones) por las que se puede sustituir un duplicado, en lugar de todas las que tiene la ficha; rige para lo que se muestra, se guarda y se aplica.

`sheet.builder.constraints` contiene hasta 40 reglas de creación. Cada una nombra el `step` cuya insignia la lleva y la `label` que se muestra ahí mientras no se cumple, un `when: Ref` opcional y exactamente uno de estos:

- `value: Ref` con `min`, `max` o ambos (cada uno un número o una Ref).
- `rows: { list, filter?, sum? }` con `min`, `max` o ambos: el número de filas de la lista, o el total de la columna numérica `sum`, sobre las filas que conserva `filter` (`{ column, equals?, below?, above? }`).
- `distinct: { list, column }`: no hay dos filas con el mismo valor rellenado (sin distinguir mayúsculas de minúsculas ni espacios).
- `approved: fieldId`: un campo booleano que debe estar activado, como la aprobación de un Storyteller.

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

Una regla incumplida nunca bloquea Back, Next ni **All fields**.

**Puntuaciones calculadas y efectos aplicados a una tirada (Capability API 1.156).** Un atributo puede llevar `value: Ref[]` (de 1 a 8): su puntuación es la suma de esas referencias, limitada a su `min` y su `max`, y se muestra de solo lectura. Un atributo de Blades es la suma de sus acciones marcadas; la Perception de GURPS es `[{ "abilityScore": "iq" }, { "field": "perception_bought" }]`, y las habilidades que tiran con ella siguen lo que se compró. Los valores derivados, los topes y las habilidades pueden leer una puntuación calculada, pero ninguna puede leer otra, ni siquiera mediante un valor derivado. El creador nunca fija una, y se ignora todo lo que se guarde para ella.

Una lista puede declarar `contextual` para que sus filas se apliquen a una tirada cuando el Game Master las nombra:

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

`name` es la columna por la que el Game Master nombra una fila. `skill` (opcional) contiene la habilidad a la que se aplica una fila, por ID o etiqueta; una celda vacía se aplica a cualquier prueba. `bonus` (una columna numérica) y `dice` (una columna de dados) suman a la prueba, como dados en un conjunto de reservas. `to: "saves"` aplica las filas a las salvaciones en su lugar. En un conjunto de reservas, `check: { dice?, successes?, double?, explode? }` da a cada fila aplicada el mismo efecto sobre la reserva, como una especialidad cuyos 10 explotan.

Una entrada de catálogo puede llevar `mechanics.contextual` con `effects` (`own-checks-advantage` y los demás efectos de prueba y salvación), `modifiers` a `checks` o `saves`, `skills` y `saves` que lo restringen, un efecto `check` de reserva y `cost: [{ "pool": "...", "amount": 1 }]`, que se paga una vez en la tirada a la que se aplica. El Game Master escribe `apply="Strong Back; Quick Eye"` (hasta cuatro nombres) en una prueba. Solo cambian la prueba los nombres que se aplican a ella: una fila de otra habilidad, un nombre que comparten dos filas y un coste que la reserva no puede cubrir no cambian nada. Tener una fila nunca cambia una tirada por sí solo. El registro enumera lo que se aplicó en `from`.

**Monedas iniciales tiradas y leídas de la ficha (Capability API 1.157).** Una línea de monedas del equipo inicial puede llevar `roll` (dados como `"2d6"`) o `countFrom` (una Ref que se lee de la ficha del portador) en lugar de `count`, nunca ambos, y `times` (de 1 a 10000) multiplica cualquiera de los dos:

```json
{ "coins": "gold", "roll": "5d4", "times": 10 }
```

El selector muestra los dados ("5d4 gold, rolled when taken"). La tirada se hace una vez, cuando el grupo o el portador toma el paquete, así que reabrir el selector no puede volver a tirarla. `countFrom` lee la propia ficha del portador, como un campo de Credit Rating; se rechaza un portador sin ficha, y una cantidad de 0 no añade nada. Las líneas de objetos conservan su `count` fijo.

**Valores iniciales fijados una vez (Capability API 1.158).** Un paso del creador de `kind: "initialize"` escribe valores iniciales cuando el jugador los confirma, y nunca más por sí solo:

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

Cada escritura nombra un campo de la ficha y un `value` (un valor fijo, o una Ref para un campo numérico) o `remaining`, lo que una reserva del creador ha dejado sin gastar. El paso muestra cada campo tal como está y el valor que tendrá; su insignia espera hasta que el jugador los fija. Los valores escritos se guardan con el creador, así que reabrirlo, importar el personaje o cambiar POW más adelante nunca los vuelve a escribir. Cuando la ficha ha cambiado desde entonces, el paso muestra lo que sustituiría volver a fijarlos, y solo lo hace el **Set again** (Volver a fijar) del jugador. Nunca se escribe en un personaje que se describe tal como ya es.

Una reserva viva puede declarar `startFrom: Ref` para empezar en un valor que se lee de la ficha en lugar de llena o vacía, limitado a 0 y a su máximo, y un contador simple puede declarar `startFrom` en lugar de `default`. Si apunta a un campo que escribió un paso de inicialización, SAN empieza en el POW a partir del que se fijó y se queda donde la deje el juego: un valor vivo guardado siempre gana sobre el punto de partida de la reserva.

**Selecciones y filas con precio (Capability API 1.159).** Un paso de catálogo o un paso de filas puede nombrar un `pool` del creador y un `cost`, de modo que lo que el jugador selecciona o escribe se paga con la misma reserva que los pasos de gasto. El coste de un paso de catálogo es un número o `{ "filter": "tier" }`, el propio filtro numérico de la entrada. El coste de un paso de filas es un número o `{ "column": "cost" }`, que se lee de cada fila; un precio negativo es un crédito, limitado al `creditLimit` de la reserva, así que un defecto financia rasgos. Un paso de filas también puede nombrar `from`, un catálogo de filas que alimenta su lista: el jugador añade una copia de la fila de una entrada tantas veces como quiera, y cada copia es una fila propia, con su precio y que se quita por separado:

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

No se ofrece una selección que la reserva no pueda pagar. Las selecciones y las filas con precio se pagan primero y nunca se venden por el jugador: cuando quitar un defecto hace que se gaste de más en la reserva, las compras de los pasos de gasto dejan de aplicarse hasta que el jugador lo repara, y la insignia de cada paso con precio cuenta la reparación. Un total que una columna no puede superar (los niveles de Rite) es una regla de creación (1.155) con `rows.sum` y `max`.

**Perfiles de creación y fases anteriores (Capability API 1.160).** `sheet.builder.profiles` (hasta 16) permite que un tipo de personaje, una carrera o un paquete aporten sus propios pasos y presupuestos:

```json
"profiles": [
  { "id": "dragon", "label": "Dragon-Blooded", "when": { "field": "dragon" },
    "steps": ["aspect_gifts"], "budgets": { "bonus": { "const": 15 } } },
  { "id": "lunar", "label": "Lunar", "when": { "field": "lunar" },
    "steps": ["moon_gifts"], "budgets": { "bonus": { "const": 18 } } }
]
```

El primer perfil cuyo `when` lee más de 0 es el del personaje, y el creador indica cuál. Un paso que enumera algún perfil solo se muestra mientras el perfil del personaje sea uno de los que lo enumeran; sus respuestas se conservan mientras está oculto y no conceden nada. Los `budgets` de un perfil sustituyen a los propios de esas reservas, así que cambiar de tipo nunca conserva el presupuesto del otro tipo: las compras que ya no cubre dejan de aplicarse hasta que el jugador las repara.

Un paso de catálogo o un paso de inicialización puede declarar `reads: { "before": "step_id" }`. Entonces el `offeredWhen` de sus entradas y su `upTo` (o los valores del paso de inicialización) leen la ficha tal como la dejan los pasos anteriores a ese paso: se retira todo lo que seleccionaron, concedieron o compraron los pasos posteriores, y se conserva lo que escribió el jugador. Un paso de multiclase lee las puntuaciones de atributo antes de la mejora de este nivel; una instantánea de Humanity lee las Virtudes antes de los puntos gratuitos, por mucho que el jugador haya ido y venido entre los pasos.

**Filas que son pruebas por sí mismas (Capability API 1.161).** Una lista puede declarar hasta cuatro `checks`, de modo que cada fila que escribe el jugador es una prueba que el Game Master puede pedir por su nombre:

```json
"checks": [{ "id": "science", "name": "name", "rating": "rating", "ability": "edu" }]
```

`name` es la columna de texto por la que se llama una fila y `rating` la columna numérica que es su valor; `ability` (opcional) se suma igual que el atributo de una habilidad. Science (Physics) y Science (Biology) son dos filas y dos pruebas, cada una con su propio valor. Dos pruebas en una lista son dos posturas respaldadas por un mismo valor, cada una con una `label` que el Game Master dice después del nombre de la fila: "Fire stew (bold)" y "Fire stew (careful)". Primero se buscan coincidencias con las propias habilidades, salvaciones y atributos de la ficha. Un nombre que comparten dos filas no es ninguna prueba hasta que se renombra una, y la prueba de una fila eliminada desaparece con ella. El bloque de ficha del Game Master enumera cada prueba de fila con su número, y `with=` funciona como en una habilidad. Un paso de filas con precio según la columna de valor (1.159) compra los valores con la reserva de creación.

**Tiradas de creación conservadas con sus dados (Capability API 1.162).** Los dados de creación son `{ "count", "sides", "keep"?, "add"?, "multiplier"? }`: las `keep` caras más altas, más `add`, por `multiplier`, así que el `(2d6+6) x 5` de CoC es `{ "count": 2, "sides": 6, "add": 6, "multiplier": 5 }`.

El `methods.rolls` de un paso de atributos tira todas las puntuaciones en orden, cada una con los dados de su propio grupo, y nunca deja que una tirada pase a otra puntuación (método `"rolls"`):

```json
"rolls": [
  { "abilities": ["str", "con", "dex", "app", "pow"], "dice": { "count": 3, "sides": 6, "multiplier": 5 } },
  { "abilities": ["siz", "int", "edu"], "dice": { "count": 2, "sides": 6, "add": 6, "multiplier": 5 } }
]
```

Un paso de `kind: "roll"` enumera hasta 12 `rolls`, cada una escrita en un `field` numérico: Luck, puntos de golpe, dinero inicial. `best` (2 o 3) tira esa cantidad de veces y conserva la mejor; `floor` (un número o una Ref) es el mínimo que puede tener el resultado, como 1 punto de golpe o un potencial que nunca baja de su estadística; `gain` lo convierte en cambio en una prueba de mejora, tirada contra el campo y que solo suma `gain` cuando la tirada lo supera, como hace la mejora de EDU de CoC. Cada tirada se conserva con sus caras y se muestra con ellas. Una tirada ya hecha se mantiene; reabrir el creador nunca vuelve a tirar, y solo lo ofrece un paso con `retry: true`. Nunca se tira para un personaje que se describe.

**Elecciones contadas y restricciones de creación (Capability API 1.151).** Cualquier paso puede llevar `when: Ref` (mostrarlo y aplicarlo solo mientras el valor no vivo de la ficha sea mayor que cero) y `requiredWhen: Ref` (contar las elecciones sin terminar en su insignia solo mientras sea mayor que cero). Los pasos ocultos conservan sus respuestas guardadas. Next y Back siguen disponibles incluso con elecciones incompletas o no válidas; All fields sigue siendo la edición libre.

Los pasos de catálogo pueden declarar hasta 12 `quotas`, cada una con uno de los filtros con tipo del catálogo:

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

Esto es una pirámide al estilo de Fate cuando el catálogo ofrece cada habilidad en cada valor. Las entradas declaran sus concesiones de entrenamiento con IDs explícitos de nivel de competencia; los valores numéricos de los filtros nunca inventan una correspondencia de niveles. Una cuota cumple `0 <= min <= max <=` el máximo del paso. Los mínimos afectan a la insignia; los máximos desactivan más selecciones coincidentes. `distinctBy` nombra un filtro existente: las selecciones no pueden compartir su valor (ni ninguna etiqueta, en un filtro de etiquetas), y una entrada a la que le falte ese filtro no puede contar. Si no, la distinción es por ID de entrada. `quotaBelow: { "filter": "tier" }` exige estrictamente más selecciones activas en el nivel n−1 que en el nivel n para los niveles enteros positivos por encima de 1. El nivel 1 es la base. Quitar una selección que sirve de apoyo deja inactivas las selecciones superiores sobrantes, retirando sus concesiones y conservando sus respuestas para repararlas.

Las posiciones de `abilities.choose`, `trained.choose`, el `choose` de un paso de entrenamiento y `entries.choose` aceptan:

- `id`: un ID de ficha estable. Las posiciones nuevas deberían usarlo; así, las respuestas guardadas sobreviven a una reordenación. Las posiciones antiguas sin ID conservan sus claves por posición. Los IDs son únicos entre todas las elecciones que ofrece un paso de origen.
- `countFrom: Ref`, con un `max` explícito (de 1 a 20, como máximo 6 para atributos). `count` sigue siendo la cantidad fija cuando no hay `countFrom`. Una cantidad dinámica se redondea hacia abajo y se limita entre cero y `max`. Lee los operadores derivados existentes, nunca expresiones ejecutables.
- `excludeChoices: ["background/restricted"]`: IDs de elecciones anteriores del mismo tipo, escritos como `source_step/choice_id`. Excluyen las respuestas activas de la elección anterior, incluidas las sustituciones. Las referencias deben poder verificarse en la definición o en el mismo archivo de catálogo. Por tanto, las elecciones de concesión anteriores incluidas en el archivo o los pasos de entrenamiento explícitos pueden alimentar un archivo de catálogo posterior; se rechazan las referencias a otro archivo de catálogo externo. Los IDs de elección de las entradas alternativas de un mismo paso también deben ser únicos.

Las elecciones de atributo aceptan además `from`, que se cruza con los atributos de la ficha y con `except`. Para mejoras distintas de PF2e, una elección `restricted` puede ofrecer `["str", "dex"]`, seguida de una elección `free_boost` que excluye `background/restricted`. Las elecciones de entradas aceptan las mismas `quotas`, `distinctBy` y `quotaBelow` que los pasos de catálogo, limitadas por `max` o `count`; siguen escribiendo filas sin aplicar las propias concesiones de las entradas elegidas.

Las elecciones de entrenamiento aceptan además `tier` (un nivel ofrecido por encima de sin entrenar, que sustituye al nivel de la concesión o del creador), `only: "any" | "trained" | "untrained"` y `onDuplicate: "replace"`. La elegibilidad lee el entrenamiento manual y las concesiones activas anteriores, excluyendo las escrituras previas del propio creador. Una habilidad seleccionada que ya entrenan esas fuentes abre una posición de sustitución aparte entre las habilidades sin entrenar del mismo tipo, conservando la respuesta original. Las sustituciones respetan las exclusiones y el nivel de la elección. Su clave guardada es la clave de la posición original más `/replacement`. Los rangos ajenos a la carrera de un Human pueden excluir una elección de carrera anterior y usar `only: "untrained"`; cambiar la carrera conserva las respuestas posteriores no válidas.

Las condiciones y las nuevas cantidades de posiciones solo pueden leer valores que cambian pasos anteriores, lo que evita concesiones que se habilitan a sí mismas o cíclicas. Una cantidad de posiciones no puede leer valores de la ficha cuando un archivo de catálogo externo posterior podría cambiarlos; adelanta su paso de origen o mantén ese catálogo dentro del archivo. Una condición puede usar un `enumTable` derivado existente para que un paso de subraza solo sea obligatorio para una ascendencia. `requiredWhen` solo afecta a las insignias y puede leer cualquier valor no vivo válido. Las nuevas elecciones restringidas siguen sin resolverse cuando falta contenido elegible, con una explicación "sin configurar". Nunca reducen en silencio su cantidad obligatoria al contenido disponible. Las ediciones manuales de la ficha y los personajes descritos mantienen las reglas de propiedad existentes del creador.

Un personaje creado sin el creador (una ficha que no está en blanco y aún no tiene elecciones del creador) se abre como **described** (descrito): las selecciones registran lo que el personaje ya es (los aumentos de su raza se consideran ya incluidos en sus puntuaciones) y no cambian nada en la ficha, hasta que el jugador elige **Done: let picks change the sheet** (Listo: dejar que las selecciones cambien la ficha). A partir de entonces, cambiar una selección retira lo que dio la descrita.

Sin `tier`, el entrenamiento va al primer nivel por encima de sin entrenar que ofrece la ficha; una ficha que ofrece un medio nivel (como las habilidades de 5e) fija `"tier": "proficient"`.

<a id="items-what-a-party-carries"></a>

## Objetos: lo que lleva el grupo

Las armaduras, las armas, las pociones, el equipo, la munición y el dinero son objetos. Un bloque opcional `items` declara las palabras con las que se escribe cada objeto de tu conjunto, y un catálogo con `holds: "items"` enumera los propios objetos. Ambos necesitan Capability API 1.49; `rarityCaps` y `propose` del bloque, que rigen los objetos que inventa el Game Master, necesitan 1.51; un valor que lee los objetos de un personaje (`itemStat`) necesita 1.52; lo que hace un objeto en las pruebas mientras se lleva puesto o encima, con los límites de `bonus` del bloque, necesita 1.53; lo que un objeto exige a quien lo lleva puesto y los atributos que cambia necesitan 1.54; el `attack` de un arma necesita 1.55; lo que hace un objeto en un combate necesita 1.56; lo que dispara un arma y lo que tiene cargado necesitan 1.57; los modos de un arma, el ataque con la mano secundaria, el mínimo y los estados al impactar necesitan 1.58; lo que hace usar un objeto en un combate, con las cargas que contiene, necesita 1.59; un uso que restaura una reserva necesita 1.60; las cargas recuperadas al descansar o un objeto que se rompe al vaciarse necesitan 1.61; un uso que pide antes una prueba (`gate`) necesita 1.62; las tablas de botín y el botín de una criatura necesitan 1.63; una línea de botín que suelta monedas o una capa que retira monedas necesita 1.64; un mercado, el lugar `sold` de un objeto y un `service` necesitan 1.65; un día de mercado (unos fondos diarios, `buyBack`, el `stock` de un vendedor, una cantidad `limited` o un `sold` que no nombra ningún lugar) necesita 1.69; un efecto adicional que se activa con las armas que se empuñan (`weapons`) necesita 1.70; el equipo inicial (`startingGear`) necesita 1.78, y un objeto arriesgado, una falsificación o un vendedor deshonesto necesitan 1.79.

### El bloque de objetos

El bloque va en `items`, en el nivel superior del archivo. Este es el de Ember Roads, algo abreviado:

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

- `categories`: de una a 24. Cada objeto tiene exactamente una, como armadura, arma o poción.
- `rarities`: opcional, hasta 12. Enuméralas de la más común a la más rara.
- `tags`: opcional, hasta 48. Propiedades que puede tener un objeto, como arrojadizo o plateado.
- `stats`: opcional, hasta 24. Los números y palabras que lleva un objeto, declarados exactamente como una columna de lista: `number`, `text`, `boolean`, `enum` o `dice`, con rango, valores y valor predeterminado cuando el tipo los tiene. `promptVisible` (`true` de forma predeterminada) indica si se muestra al Game Master la estadística junto al objeto. Ponlo en `false` para algo que solo debe ver el jugador, como dónde está escondido un objeto.
- `slots`: opcional, hasta 12. Dónde se lleva puesto o se empuña un objeto, y cuántas ranuras de ese tipo tiene un personaje, de 1 a 20.
- `binding`: opcional. Sintonización, investidura o cualquier otra cosa que limite cuántos objetos puede tener vinculados a la vez un personaje. `label` es su nombre y `max` es un valor leído de la ficha del personaje, como `{ "abilityScore": "nerve" }` o un valor derivado. No puede leer el estado vivo, porque cuántos objetos puede vincular un personaje no cambia con cada golpe.
- `carry`: opcional. `stat` nombra la estadística numérica que es el peso de un objeto, cuyo `min` es 0 o más. `encumberedAbove` es cuánto lleva un personaje antes de quedar sobrecargado, y `limit` (opcional), lo máximo que puede llevar. Ambos se leen de la ficha como `binding.max`. Sin `carry`, el peso no significa nada y nadie queda nunca sobrecargado.
- `currencies`: opcional, hasta seis familias de una a diez monedas cada una.
  - Las monedas de una familia se cambian entre sí según `value`, que cuenta la moneda más pequeña de la familia. Así, la moneda más pequeña vale 1 y no hay dos monedas de una familia que valgan lo mismo.
  - Dos familias nunca se cambian entre sí. La moneda de otra nación, o los favores de una ambientación, son una familia propia.
  - El ID de una moneda es único entre todas las familias, porque el coste de un objeto nombra solo la moneda.
  - La `label` de una moneda es su nombre para cualquier cantidad (`pennies`); `one` (Capability API 1.89) es su nombre para exactamente una (`penny`), que se usa siempre que un precio, unos fondos o un mercado nombran una sola moneda. Sin él, la `label` también vale para una.
  - `perWeight` (opcional, y solo junto a `carry`) indica cuántas monedas de la familia pesan una unidad de la estadística de carga.
  - Las monedas son el dinero del grupo y se llevan en las bolsas como cualquier objeto (consulta Dinero, más abajo).
- `rarityCaps`: opcional, como máximo una por rareza. Lo máximo que puede dar un objeto que inventa el Game Master en esa rareza: el valor más alto de cada estadística numérica nombrada en `stats`, dentro del rango de esa estadística y como número entero si la estadística admite enteros, y `bonus` (Capability API 1.53), la bonificación fija más alta que puede sumar uno de sus modificadores al llevarse puesto o encima. En una rareza con `bonus`, se omite una bonificación en dados, porque los dados no pueden limitarse a un número; una penalización nunca se limita. Un objeto inventado queda sujeto a ello; los objetos que enumeran tus catálogos son tuyos y nunca se limitan.
- `propose`: `true` de forma predeterminada. `false` prohíbe al Game Master inventar objetos de tu conjunto.
- `native`: `true` de forma predeterminada. `false` desactiva los objetos sin tipo propios de Game Mode en las partidas de tu conjunto (consulta **Dónde se leen los objetos**). El Game Master puede seguir inventando objetos, escritos con las palabras de tu conjunto.
- `freeform`: en qué se convierte un objeto que escribe el jugador. `"plain"` (predeterminado) lo conserva como objeto sin reglas, como hasta ahora. `"refuse"` solo permite objetos de tu conjunto.
- `lootTables` (Capability API 1.63): opcional, hasta 24. Lo que sueltan las criaturas de un combate ganado y el `[loot:]` del Game Master (consulta Botín, más abajo).

### Un objeto

Un catálogo de objetos no declara `feeds`:

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

Cada entrada lleva un `item` en vez de `rows` o una `creature`:

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

- `id`, `label`, `summary` y `filters` funcionan igual que en cualquier entrada. La etiqueta es el nombre del objeto.
- `category` es obligatorio. `rarity` y `tags` son opcionales, y los tres nombran IDs propios del bloque. Un objeto solo puede tener rareza si el bloque declara alguna.
- `stats`: valores para las estadísticas del bloque. Cada uno es un valor que su estadística podría contener.
- `slots`: cuántas ranuras de cada tipo ocupa el objeto, nunca más de las que tiene un personaje.
- `stack`: lo máximo que contiene una pila, de 1 a 999.999. Sin él, una pila contiene tantos como cualquier pila de Game Mode. Un objeto que contiene `charges` va solo en su pila.
- `cost`: una cantidad entera (`amount`) de una moneda, nombrada por su ID en `unit`. El selector la muestra, y el Game Master la ve junto al objeto (consulta Dinero, más abajo).
- `sold` (Capability API 1.65): `{ "place": "city" }`, el más pequeño de los lugares de tu mercado que vende el objeto, por encima de cualquier regla que diga otra cosa; con 1.69 puede, en su lugar o además, indicar cuántos tiene disponibles un lugar en un día (`"limited": 2` o `"limited": "1d3"`) (consulta Mercados, más abajo).
- `service` (Capability API 1.65): `true` para alojamiento, un pasaje o una bendición: se compra como un objeto y nunca se lleva encima. Comprarlo solo paga; nada más lo mete en una bolsa (añadir uno se rechaza como `service`), y el selector omite los servicios. Un servicio tiene un `cost`, y nada relacionado con llevarlo o usarlo (`slots`, `stack`, `binds`, `worn`, `carried`, `requires`, `attack`, `use`, `charges`).
- `binds`: el objeto debe vincularse antes de hacer nada mientras se lleva puesto. `restriction` (opcional) indica con palabras quién puede vincularlo, y `cursed: true` marca uno que no se deja soltar. Solo un conjunto con `binding` puede tener objetos que se vinculan.
- `worn` y `carried` (opcionales, Capability API 1.53): lo que hace el objeto en las pruebas y salvaciones de quien lo tiene mientras lo lleva puesto y mientras solo lo lleva encima, (1.54) los atributos que fija o aumenta y (1.56) lo que hace en un combate. Consulta [Pruebas fuera de un combate](#checks-outside-a-fight) y [Armadura y efectos puestos en un combate](#armor-and-worn-effects-in-a-fight).
- `requires` (opcional, Capability API 1.54): lo que exige el objeto a quien lo lleva puesto y lo que se aplica mientras no lo cumple. Consulta [Pruebas fuera de un combate](#checks-outside-a-fight).
- `attack` (opcional, Capability API 1.55): lo que hace el objeto como arma en un combate mientras se lleva puesto, (1.57) lo que dispara y tiene cargado, y (1.58) sus otros modos, un ataque con la mano secundaria, un mínimo para su daño y los estados que aplica al impactar. Consulta [Armas en un combate](#weapons-in-a-fight), [Munición y recarga](#ammunition-and-reloading) y [Modos, una segunda arma, un mínimo y estados al impactar](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit).
- `toggle` (opcional, Capability API 1.170): un interruptor que lleva el objeto, `{ "label", "budget" }`. Un combate lo ofrece como opción con ese presupuesto ("Turn on Flame Tongue: Flames"), el inventario como un botón con la etiqueta, y se queda en la pila entre combates tal como se dejó; empieza apagado. Un objeto con interruptor va solo en su pila mientras está encendido. Una cláusula `plus` de un arma con `when: "toggled"` solo se inflige mientras está encendido. La flame tongue de 5e: `"toggle": { "label": "Flames", "budget": "bonus" }` y `"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`.
- `use` y `charges` (opcionales, Capability API 1.59): lo que hace usar el objeto, en un combate y fuera de él, y las cargas que contiene para que ese uso las gaste, y (1.60) una reserva que restaura. Consulta [Usar objetos en un combate](#using-items-in-a-fight) y [Usar objetos fuera de un combate](#using-items-outside-a-fight).

Un objeto no lleva `mechanics`: lo que hace se escribe en su bloque `item`.

### Dónde se leen los objetos

Todo lo anterior se comprueba al importar el conjunto, y tus catálogos de objetos se distribuyen con él. En una partida, los lee el inventario de Game Mode:

- **Tus objetos están en la bolsa.** Una pila puede ser uno de tus objetos y sigue siendo ese objeto, lo llame como lo llame el jugador. El botón **From the ruleset** (Del conjunto de reglas) del inventario abre un selector con todos los objetos que enumeran tus catálogos, con la búsqueda y los filtros del catálogo, y una capa que oculta una entrada también la oculta ahí.
- **Los nombres encuentran tus objetos.** Un nombre que escribe el jugador, o uno que escribe el Game Master en `[inventory: action="add"]`, que sea la `label` de uno de tus objetos, con cualquier combinación de mayúsculas, añade ese objeto. Si dos objetos comparten etiqueta, un nombre encuentra el que tus catálogos enumeran primero.
- **`stack`** se respeta: añadir, fijar, combinar o dar por encima de él llena la pila y empieza una nueva.
- **`freeform: "refuse"`** deja al jugador solo tus objetos: el selector y los nombres que son tus objetos.
- **`native: false`** deja al Game Master solo tus objetos y los que inventa: se rechaza un nombre que no es ninguna de las dos cosas (`not-ruleset-item`), aunque sigue pudiendo añadirse más de algo que ya se tiene, y sus instrucciones lo indican. Un combate ya no pregunta a un modelo qué hacen los objetos del inventario, así que solo combaten tus objetos: en un combate del conjunto, tus armas empuñadas y los usos de tus objetos (consulta Armas en un combate, más abajo), y en una batalla Classic o Tactical, tus objetos con un `use` (consulta Objetos en batallas Classic y Tactical, más abajo). Lo que escribe el jugador sigue rigiéndose por `freeform`, y lo que llevaba el grupo vuelve en una sesión nueva en cualquier caso.
- **Qué es un objeto** se muestra en la pila seleccionada: su categoría, rareza y propiedades por sus etiquetas, las estadísticas que da, su resumen y cuántos contiene una pila. El selector también muestra su `cost`. El Game Master ve cada uno de tus objetos que tiene con su categoría, rareza, propiedades y las estadísticas que dejaste en `promptVisible`, como `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`.

- **`slots`**: un objeto que ocupa ranuras puede equiparlo quien lo lleva mientras tenga esas ranuras libres, y un objeto de una pila mayor se separa en su propia pila para llevarlo puesto. El inventario muestra cada ranura en uso por personaje.
- **`binding`**: un objeto que `binds` puede vincularse, hasta `binding.max` leído de la ficha de su portador (un personaje sin ficha lee una en blanco). Un objeto `cursed`, una vez vinculado, sigue vinculado: el jugador no puede desvincularlo, quitárselo, regalarlo ni eliminarlo, y solo el Game Master puede terminar la maldición.
- **`carry`**: un objeto pesa su valor de `carry.stat` (un objeto sin él no pesa nada), y la carga de un personaje es lo que pesa su bolsa, comparada con `encumberedAbove` y `limit` leídos de su propia ficha. Un objeto añadido a la vista compartida del inventario, por el jugador o por el Game Master sin `who=`, va a quien pueda llevarlo sin quedar sobrecargado (primero el jugador y después el grupo en orden), repartido según el espacio que le queda a cada uno cuando nadie puede llevarlo entero. Nada supera el `limit` de nadie: lo que nadie puede llevar se queda atrás y se informa al Game Master. Dale a una estadística de peso `"integer": false` para pesos como un cuarto de libra.
- **El Game Master inventa objetos con tus palabras.** Salvo que pongas `propose: false`, su `[inventory: action="add"]` puede describir un objeto nuevo: `like=` uno de tus objetos como punto de partida y después cualquiera de `category=`, `rarity=`, `tags=`, `stats=` (pares `id=value`), `slots=` (`id=count`), `binds=` (`yes`, `cursed` o `no`), `worn=` y `carried=` (cambios separados por `;`, cada uno `+N`, `-N`, `advantage`, `disadvantage` o `fails` para salvaciones, en habilidades o salvaciones por nombre, o en `checks` o `saves` para todas ellas, `+N` o `-N` en el nombre de un atributo para subirlo o bajarlo y, si tienes combates, `+N`, `-N`, ventaja o desventaja en los ataques y `+N` o `-N` en la defensa o en tu palabra para ella: `worn="+1 Sneak; disadvantage on Sway checks"`, `carried="+1 Brawn"`, `worn="+1 Guard"` o `none`) y `summary=`, cada parte por su ID o etiqueta. Una estadística de objeto que ya cuenta tu defensa (Guard de Ember Roads suma el `guard` de lo que se lleva puesto) es la forma en que una armadura la aumenta, así que se omite un cambio puesto en la defensa junto a esa estadística y la respuesta lo indica: un modelo pequeño escribe `guard=1` y `+1 Guard` para un único +1. También lee lo que suele escribir en su lugar un modelo pequeño: un número tras el nombre (`Brawn +1`), "bonus" tras los ataques o la defensa (`+1 attack roll bonus`), `none` para una lista vacía de propiedades, estadísticas o ranuras, y `worn=`, `carried=` o `summary=` dentro de `stats=` cuando no tienes ninguna estadística con ese nombre. El motor solo conserva lo que tiene tu bloque: se omite una categoría, propiedad, estadística, ranura, habilidad o salvación desconocida, una rareza que no tienes se convierte en la más baja, un número se limita al rango de su estadística y después a `rarityCaps` para su rareza, una bonificación puesta o encima a la `bonus` de su rareza (incluida la parte de la que partió `like`), y un nombre que es uno de tus objetos es simplemente ese objeto. La respuesta indica al Game Master qué se cambió (nunca sobre una estadística que no le muestras), y los detalles del objeto muestran cada cambio al jugador. La partida conserva el objeto, así que el mismo nombre es ese objeto el resto de la partida, y una sesión nueva lo conserva mientras alguien lo siga teniendo.
- El Game Master puede hacer `equip` y `unequip` de tus objetos con su comando de inventario si tienes `slots`, y `bind` y `unbind` si tienes `binding`: solo se le informa de los que tiene tu conjunto. Ve la carga de cada personaje, sus objetos vinculados y sus ranuras, y lo que lleva puesto o vinculado.

- **Lo que hace un objeto mientras se lleva puesto o encima** se muestra en la pila seleccionada y en el selector ("While worn: -1 on checks (Sneak)"), y el Game Master lo ve junto al objeto (`worn: -1 on checks (Sneak)`). Las pruebas fuera de un combate lo aplican (consulta Pruebas fuera de un combate, más abajo).
- **Lo que hace un arma** se muestra igual ("Attack (Action): Brawn to hit, 1d6 + Brawn cut damage"), y un combate la ofrece mientras se empuña (consulta Armas en un combate, más abajo).
- **Lo que hace usar un objeto** se muestra igual ("Use (Action): heals 1d4 + 1, range 0 paces, used up"), con las cargas que le quedan. Lo ofrece un combate, y también el botón **Use** (Usar) del inventario y el `[inventory: action="use"]` del Game Master (consulta Usar objetos en un combate y Usar objetos fuera de un combate, más abajo).

En una batalla Classic o Tactical, cada uno de tus objetos con un `use` hace ahí lo que indica, y uno sin él no se ofrece (consulta Objetos en batallas Classic y Tactical, más abajo). Diga lo que diga `native`, la ficha puede leer tus objetos (abajo), un arma empuñada es un ataque en un combate del conjunto y dispara lo que saca de la bolsa, lo que hace un objeto mientras se lleva puesto o encima cuenta en él (consulta Armadura y efectos puestos en un combate, más abajo), un objeto con un `use` se usa según sus propias reglas, en un combate y fuera de él (consulta Usar objetos en un combate y Usar objetos fuera de un combate, más abajo), y tus `currencies` son el dinero del grupo (consulta Dinero, más abajo).

<a id="items-on-the-sheet"></a>

### Objetos en la ficha

Una referencia de valor puede leer los objetos que tiene un personaje con `itemStat` (Capability API 1.52). Ember Roads suma la guardia de la armadura que lleva puesta un viajero a su Guard, que es lo que debe superar un golpe:

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from`: `"worn"` son los objetos que lleva puestos el personaje: un objeto que ocupa ranuras mientras está equipado, uno que `binds` mientras está vinculado, y uno que hace ambas cosas mientras cumple ambas. Un objeto que no hace ninguna nunca se lleva puesto. `"carried"` es el resto de lo que tiene, y `"all"`, ambos.
- `pick`: `"sum"` suma el valor de cada objeto multiplicado por cuántos hay; `"max"` y `"min"` leen el valor individual más alto o más bajo, y `"count"` cuenta los objetos según cuántos hay.
- `stat` nombra una de tus estadísticas de objeto. `sum`, `max` y `min` necesitan una estadística `number`. `count` puede omitirla para contar todos los objetos, o nombrar cualquier estadística para contar solo los objetos que la dan.
- `slot`, `category` y `tag` (opcionales) conservan solo los objetos que ocupan esa ranura, son de esa categoría o tienen esa propiedad.
- `default` (opcional, 0 si se omite) es lo que lee cuando no se elige ningún objeto o ninguno da la estadística.

Los objetos cambian durante el juego, así que `itemStat` sigue la misma regla que una lectura viva: el `max` de una reserva o de un contador, la bonificación de competencia, `binding.max`, los números de `carry` y la columna escalada o el escalado de un catálogo no pueden leerlo, ni siquiera mediante un valor derivado. En cualquier otro lugar donde se lea un número, sí puede: un valor derivado, el `adjust` de una prueba, el `cap` de una habilidad, la defensa, la absorción o la iniciativa de un combate.

Los objetos de un personaje son los de su propia bolsa. La tarjeta del jugador (la que lleva el nombre del personaje con el que juega el chat o, si no, la primera) lee la bolsa del jugador, y cada una de las demás tarjetas, la suya. Solo cuentan los objetos de tu conjunto, porque un objeto simple no tiene estadísticas que leer. La ficha en pantalla, una prueba, el bloque de ficha del Game Master y un combate al empezar leen lo que tiene cada personaje en ese momento. Fuera de una partida, en el editor de fichas o en la revisión de una importación, nadie tiene nada e `itemStat` lee su `default`.

<a id="checks-outside-a-fight"></a>

### Pruebas fuera de un combate

Una prueba o salvación que el Game Master pide fuera de un combate lee más que la ficha: los estados activos del propio personaje, los niveles que ha alcanzado, lo que hacen sus objetos mientras los lleva puestos o encima, y lo que cuesta el requisito de un objeto puesto mientras no lo cumple. Es el mismo vocabulario que usan los estados de un combate (Capability API 1.53 para las claves de objeto y la restricción).

Un objeto indica lo que hace con `worn`, que se aplica mientras lo lleva puesto (y vinculado, si se vincula), y `carried`, que se aplica mientras solo lo lleva encima. El abrigo de cuero de Ember Roads cruje cuando te mueves a hurtadillas, y una piedra de camino hace que la gente de las caravanas confíe en ti:

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

Cada uno toma las partes de un estado que lee una prueba:

- `effects`: `own-checks-advantage`, `own-checks-disadvantage`, `own-saves-advantage` y `own-saves-disadvantage`.
- `modifiers`: cambios `to` pruebas o salvaciones, con `flat`, `dice` (y `minus`), `mode` y sus propios `skills` o `saves`, exactamente como los de un estado.
- `failsSaves`: salvaciones que su portador falla sin tirar.
- `skills` y `saves`: a qué habilidades o salvaciones se refieren los efectos y los modificadores que no nombran las suyas.
- `abilities` (Capability API 1.54): atributos que cambia, por ID, cada uno `{ "set": N }` (al menos N: una puntuación más alta se mantiene) o `{ "add": N }` (un número negativo lo reduce). Se aplican antes de calcular la ficha, así que todo lo que lee el atributo lee el valor cambiado: la ficha en pantalla, los valores derivados, las pruebas, el bloque de ficha del Game Master y un combate al empezar. Primero se aplican las sumas, después el `set` más alto, y se respetan el `min` y el `max` del propio atributo. El máximo de una reserva o de un contador y la bonificación de competencia se calculan solo a partir de la ficha, así que un objeto no los mueve.

Los guanteletes de piel de buey de Ember Roads prestan a un agarre débil el de un boyero:

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

Lo que hace un objeto en un combate (defensa, ataques, velocidad, los demás efectos del combate y el daño y los estados que evita) está en [Armadura y efectos puestos en un combate](#armor-and-worn-effects-in-a-fight); una prueba fuera de un combate solo lee las partes anteriores. Un objeto se aplica una vez, por muchas pilas de él que tenga alguien.

Un objeto también puede exigir algo a quien lo lleva puesto, con `requires`: un valor de su ficha (`value`, cualquier referencia de valor, leída como todo lo que está en juego), lo mínimo que puede ser (`atLeast`) y lo que se aplica mientras no lo alcanza (`otherwise`, con el mismo vocabulario, salvo que no puede cambiar un atributo, porque lo que exige puede leer uno). Hasta cuatro. La pala de sepulturero de Gravewatch es un trabajo pesado para un guardián débil:

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

Un requisito lee el atributo tal como lo dejan los objetos de quien lo lleva puesto, así que unos guanteletes que fijan Sinew en 3 cumplen el de la pala.

En una prueba:

- Cada modificador que se refiere a ella suma su número, y sus dados se tiran: un número fijo en una prueba sumada, dados en una reserva. Una prueba de atributo, y una prueba que el conjunto no puede nombrar, solo leen lo que no está restringido a nada, y una salvación solo lee lo que se refiere a salvaciones.
- La ventaja y la desventaja de todas las fuentes, incluido el `mode=` del Game Master, se anulan entre sí: con cualquiera de cada una, la prueba se tira una sola vez. Solo se inclina un conjunto que tira dos veces (`resolution.advantage`).
- Una salvación que un estado u objeto hace fallar falla sin tirar, y no se gasta nada en ella.
- El registro indica lo que la cambió: `effects="-1"` para el número, `from="Leather coat"` para lo que la cambió y `automatic="true"` para una salvación fallada sin tirar. La tarjeta de dados muestra lo mismo, y el Game Master lo lee en el turno siguiente. Se le indica que el motor aplica estos cambios, para que no vuelva a sumarlos.

Gravewatch muestra lo mismo en una reserva: la Dawn bell vinculada añade un dado a Ward, y Rattled quita uno de Soothe y de Barter.

### Defensas por tipo de daño de estados, niveles, objetos y filas de la ficha (Capability API 1.132)

`combat.conditions[]` y `combat.levels[]` pueden conceder `resist`, `vulnerable`, `immune` (de 1 a 30 entradas cada uno) y `conditionImmunities` (de 1 a 40 IDs de estado). Se aplican mientras dura el estado o mientras se alcanza el umbral del nivel. Una inmunidad a un estado recién obtenida termina ese estado si ya está activo e impide volver a aplicarlo. La inmunidad tiene prioridad sobre la resistencia; la resistencia y la vulnerabilidad se anulan. Varias resistencias nunca reducen el daño a la mitad dos veces.

`resist` e `immune` usan la forma de las criaturas: una palabra de daño o `{ "type": "bludgeoning", "except": ["magical"] }`. Cualquier etiqueta nombrada en el golpe se salta esa entrada. `vulnerable` sigue siendo solo palabras de daño. La misma forma de excepción funciona en los efectos `worn` y `carried` de los objetos. Declara las etiquetas de excepción en `items.tags` y ponlas en las cualidades del arma o del conjuro. Por ejemplo, Stoneskin es una asignación de estado:

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

La armor of invulnerability usa ese mismo array `resist` dentro de su efecto `worn`. Protection from Energy puede conceder `resist: ["fire"]`; un rasgo como Brave puede conceder `conditionImmunities: ["frightened"]`. Un nivel puede conceder `resist: ["poison"]` en su umbral. Las palabras de daño estáticas desconocidas se señalan cuando `combat.damageTypes` declara el vocabulario, igual que en las criaturas; sin esa declaración, las palabras de daño son texto libre.

Para los rasgos de ascendencia o de catálogo, `combat.sheetHides` contiene hasta ocho fuentes (se permite un array vacío). Cada una nombra una lista de la ficha, una columna de texto o enum de esa lista y uno de los cuatro tipos. Para un enano cuya fila de rasgos contiene `"poison"` en una columna `resistance`:

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

Cada fila aporta palabras separadas por comas, recortadas y comparadas sin distinguir mayúsculas de minúsculas; las palabras vacías se omiten. Añadir una fila con `"fire"` añade resistencia al fuego; eliminarla quita esa fuente. Las palabras de resistencia e inmunidad pueden incluir `except`, como en `"bludgeoning except magical silvered"`. Las vulnerabilidades y las inmunidades a estados son palabras simples. Las palabras de daño declaradas desconocidas en el texto de la ficha se ignoran, igual que los IDs de estado desconocidos; una columna enum para inmunidades a estados solo debe declarar IDs de estado al importar. Los resúmenes de la ficha, de la batalla y del Game Master incluyen estas defensas y sus excepciones.

<a id="weapons-in-a-fight"></a>

### Armas en un combate

Un objeto puede ser un arma (Capability API 1.55). Su `attack` tiene la forma de las [filas de ataque](#combat-a-fight-your-own-rules-resolve) de un bloque de combate, con valores en lugar de columnas, y un [combate del conjunto](#combat-a-fight-your-own-rules-resolve) lo ofrece como ataque mientras el objeto se lleva puesto: empuñado con las manos que ocupa y vinculado si se vincula. Uno guardado o que solo se lleva encima no ofrece nada, y las filas de ataque y las acciones propias de una criatura funcionan exactamente como antes. El hacha de mano de Ember Roads:

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget`: el presupuesto que gasta, uno de `combat.economy.budgets`.
- `toHit`: lo que suma para acertar. `abilities` son uno o más IDs de atributo, y cuenta el mejor de ellos (un arma de destreza enumera dos). `skill` suma lo que suma una prueba de esa habilidad, con el atributo del ataque en lugar del propio de la habilidad, igual que en una fila de ataque. `proficiency` es un valor de la ficha del portador: si lee más de 0, se suma la bonificación de competencia del conjunto (`{ "const": 1 }` para siempre). `bonus` es un número. `sheetBonus` es un número que se lee de la ficha del portador y se suma tal cual, para lo que el portador aporta a todas las armas de un tipo y no lo que es el arma: el estilo de combate Archery de 5e da `{ "derived": "archery" }` a cada arma a distancia, un valor derivado que es 2 para un arquero y 0 para cualquier otro (Capability API 1.95; los datos del objeto lo nombran por su nombre en la ficha). `target` es el objetivo por dado propio de un combate de reservas para el ataque de esta arma (la pala de Gravewatch cuenta cada dado desde 6 en vez del 7 de la reserva), y solo puede darlo un conjunto `dice-pool` cuyo `target` pueda moverse; en un combate sumado, su `bonus` dice lo mismo.
- `damage`: los `dice` que inflige, con el mejor de sus `abilities` de daño sumado, un `bonus` y un `type`. Un combate sumado necesita `dice`; en un combate de reservas, un impacto inflige sus éxitos y `dice` añade esa cantidad más del dado propio de la reserva. `sheetBonus` (Capability API 1.97) es un número de la ficha del portador que se suma al daño igual que el de `toHit`, y con `"oneHanded": true` solo cuenta mientras el arma se sostiene con una mano: no un arma `versatile` empuñada a dos manos, ni una que ocupa dos de una ranura. El Dueling de 5e da `{ "derived": "dueling" }`, 2 para un duelista que sostiene un arma. `rerollUpTo` (Capability API 1.98) es un valor de la ficha del portador: los dados de daño propios del arma iguales o inferiores a él se vuelven a tirar una vez y vale la cara nueva, también los dados extra de un crítico, solo mientras el arma se empuña a dos manos (un arma `versatile` con las manos libres, o una que ocupa dos de una ranura) y solo en un combate sumado. El Great Weapon Fighting de 5e da `{ "derived": "great_weapon_fighting" }`, 2 con el estilo.
- `reach` y `range` (`normal`, y `long` para lo que sigue alcanzando más allá) están en tu unidad de `combat.distance` y la necesitan. Un arma con ambos es arrojadiza, igual que una fila de ataque: un golpe de cerca, un lanzamiento más allá. Sin ninguno, alcanza una casilla.
- `versatile`: los `dice` que inflige en su lugar mientras cada ranura que ocupa tenga sitio para otro tanto entre lo que lleva puesto su portador: una lanza en una mano con la otra libre.
- `strikes`: cuántos ataques compra un gasto, leído de la ficha del portador, igual que el `strikes` de una fila de ataque. Un arma sin él da un ataque por gasto, por muchos ataques que tenga quien la empuña.

Cualquiera de esos números o palabras puede leer en su lugar una estadística del propio objeto: `{ "stat": "damage" }` es el `damage` del objeto, y una estadística a la que el objeto no da nada es como si el valor no estuviera escrito. `abilities` y `skill` leen una estadística enum cuyas palabras son IDs de atributo o de habilidad, y `type`, una estadística de texto o enum. Así, un objeto que el Game Master inventa `like=` un arma también es un arma y combate con sus propias estadísticas, limitadas por `rarityCaps` como cualquier estadística (un valor que escribes se copia tal cual). Uno inventado sin ranura ni vinculación nunca se lleva puesto, así que se crea sin el ataque. Un modelo pequeño suele describir un arma y omitir `like=`, así que uno inventado en una categoría de tus armas sin nada de lo que partir combate como el arma de esa categoría a la que más se parece por nombre (una palabra compartida en cualquier sentido, así que una ballesta se parece a un arco) o, si no, como la primera de ellas, tomando cualquier estadística que lea ese ataque y que la propuesta omitió, y la respuesta lo indica ("It fights as Hand axe does."). El formulario de propuesta del Game Master también le indica que un arma creada como otra combate como ella.

Las propiedades de un arma son lo que llevan sus golpes. Una entrada `resist` o `immune` de una criatura puede indicar qué la atraviesa: `{ "type": "tearing", "except": ["silver"] }` se recibe completo de un arma con la propiedad `silver` y se resiste de cualquier otra cosa. El grave wight de Gravewatch está escrito así, y su silver coffin nail lo atraviesa. El daño que no procede de un objeto arma nombra lo que lleva con `qualities` (Capability API 1.101), con las mismas etiquetas de objeto: en las `mechanics` de una entrada de catálogo (un conjuro) y en el `damage` de la acción de una criatura (la maza de un deva). La "resistencia al daño contundente, perforante y cortante de ataques no mágicos" de 5e es `{ "type": "slashing", "except": ["magical"] }` junto a lo mismo para los otros dos, con `magical` en las etiquetas de sus armas mágicas y `"qualities": ["magical"]` en sus conjuros y en los ataques de criatura que el SRD considera mágicos.

Los detalles del arma y la línea del Game Master indican lo que hace: `attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`, con `1d8 with a hand free` para la boar spear de Ember Roads y `at 6` junto a la pala de Gravewatch.

<a id="ammunition-and-reloading"></a>

#### Munición y recarga

Un arma puede disparar algo y puede tener una cantidad cargada propia (Capability API 1.57). El arco de caza de Ember Roads dispara flechas, y la pistola de guardia de Gravewatch lleva una bala, cargada con la munición y la pólvora del guardián:

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo`: lo que dispara el arma, según una de tus `tags` de objeto. Cada ataque toma `perAttack` (1 si no dice nada) de los objetos con esa propiedad que lleva su portador, puestos o no, de la primera pila de ese tipo de su bolsa y después de la siguiente. El arma solo se ofrece mientras lleve suficientes, y el menú del combate indica cuántos quedan. Tras un combate que gana el grupo, `recover` (de 0 a 1) de lo que disparó cada uno vuelve a la pila de la que salió: la proporción se suma a lo largo de todo el combate y se redondea hacia abajo una vez por pila, así que la mitad de cinco flechas disparadas desde un carcaj son dos. Un combate perdido o del que se huye no devuelve nada.
- `clip`: una cantidad cargada que el arma lleva consigo. `max` es cuánto contiene, escrito o leído de una estadística numérica del objeto, y `reload` es el presupuesto que gasta una recarga. Un ataque gasta lo cargado en vez de tomar de la bolsa, y el arma solo se ofrece mientras contenga suficiente para uno. Una opción **Reload** (Recargar) en el menú del combate gasta `reload` y la llena: desde la bolsa si tiene `ammo` (todo lo que aún contenga la bolsa si es menos) y por completo si no tiene. La cantidad se guarda en la pila de inventario del arma, así que una pistola vaciada en un combate sigue vacía en el siguiente. Un arma que nadie ha disparado aún está cargada, y también una que un jugador combina en una pila de varias, porque una cantidad cargada pertenece a un arma. Las balas de un cargador no se recogen tras un combate, así que `recover` es para un arma sin cargador.

Lo que un combate dispara, carga y recoge se escribe en el inventario a medida que se da cada paso, igual que la salud del grupo, y el diario indica lo que se usó. Se rechaza un paso cuya pila ya no existe o contiene menos de lo que contaba el combate, igual que un objeto gastado que el combate no encuentra. El registro del combate indica cada disparo, recarga y recogida ("Hunting bow: 2 left to shoot.", "Ada loads 1 into Watch pistol: 1 of 1 loaded."), y los detalles del objeto y la línea del Game Master indican lo que dispara y contiene el arma: `ammunition Arrow (1 an attack, 50% picked up after a won fight)` y `holds 1, reload (Act)`.

<a id="modes-a-second-weapon-a-floor-and-conditions-on-a-hit"></a>

#### Modos, una segunda arma, un mínimo y estados al impactar

Un arma puede tener otras formas de hacer su ataque, una compañera en la mano secundaria, un daño mínimo que inflige y estados que aplica a lo que golpea (Capability API 1.58). El arco de caza de Ember Roads puede disparar una andanada, y el silver coffin nail de Gravewatch puede empuñarse en cada mano y marca aquello en lo que se clava hondo:

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes`: hasta seis formas más de hacer el ataque, cada una con un `id`, una `label` y lo que cambia. `ammo` es cuántos disparos hace un ataque con ese modo, así que el arma tiene `ammo` o un `clip` desde el que disparar. `toHit` es lo que suma para acertar: dados en un combate de reservas y un número en uno sumado. `target` mueve en esa cantidad el objetivo por dado de un combate de reservas (desde el propio del arma o, si no, el de la reserva; `+1` es más difícil), si el objetivo de la reserva puede moverse. `targets` es a cuántos puede apuntar, cada uno con su propia tirada de ataque. El menú del combate pregunta de qué forma una vez elegido el ataque (después de su estilo de iniciativa, si hay estilos), cada una con lo que se espera que haga, y solo ofrece los modos para los que su portador tiene disparos. Un miembro del grupo que interpreta el motor evalúa cada modo dirigido a un objetivo, y deja a un jugador los modos para varios. En una ventana, un ataque se hace tal cual.
- `offHand`: un arma para la mano secundaria. El bloque de combate nombra el presupuesto que gasta un segundo ataque y si su daño conserva un atributo positivo:

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  Una vez que su portador ha atacado este turno con un arma marcada `offHand`, cada una de las demás armas de ese tipo que lleva puestas ofrece un segundo ataque con ese presupuesto, llamado "Silver coffin nail, off hand" en el menú. `ability` es `full` (predeterminado) o `penalty-only`, que suma el atributo de daño solo cuando resta algo, como hace el combate con dos armas de 5e. Un ataque con la mano secundaria es un único golpe, compre los ataques que compre el ataque principal, y nunca un golpe contra alguien que se aleja. Un arma marcada `offHand` necesita el `offHand` del bloque de combate. `fullWhen` (Capability API 1.97) es un valor de la ficha del combatiente: si es mayor que 0, la mano secundaria de ese combatiente conserva el atributo completo diga lo que diga `ability`, como hace el estilo Two-Weapon Fighting de 5e.

- `floor`: lo mínimo que inflige un impacto, escrito o leído de una estadística numérica del objeto. El daño de un combate de reservas después de la absorción, o el daño de un combate sumado, se sube hasta él antes de que una resistencia lo reduzca a la mitad, y el registro lo indica. Un golpe que gasta tira el número de quien lo hace y nunca se sube.
- `onHit`: hasta cuatro de tus estados que recibe el objetivo cuando el daño que infligió el golpe alcanzó `atLeast`, durante `rounds` de sus propios turnos o, sin él, hasta que algo lo quite. El daño es lo que le llegó después de la absorción y de sus resistencias; un golpe que toma quita iniciativa en vez de causar daño, así que no aplica ninguno. Una entrada también puede llevar `save: { "save": <save id>, "difficulty": n }`, que el objetivo tira cuando el estado se le iba a aplicar, y un éxito lo evita, y `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`, que hace que dure hasta que quien lo tiene supere esa salvación al principio o al final de cada uno de sus turnos o al recibir un daño mayor que cero (entonces no tiene `rounds`). Ambas cuentan como salvaciones contra ese estado, y contra la magia cuando el arma es mágica (Capability API 1.169). La sword of wounding de 5e: `{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`.
- `plus`: hasta tres cantidades más en cada impacto, cada una `{ "dice", "flat", "type", "save", "targetIs", "when" }`, tirada, con su tipo y resistida por separado (Capability API 1.169). `save` nombra su propia `difficulty` y su `onSuccess` (`half` o `none`). `targetIs` solo la inflige a un objetivo de esos tipos o etiquetas de criatura (consulta Tipos de criatura y pruebas de objetivo). `when: "critical"` solo la inflige en un impacto crítico; los dados de cualquier cláusula se duplican en un impacto crítico igual que los del arma. Una javelin of lightning es `{ "dice": "4d6", "type": "lightning" }`; una dragon slayer, `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`; una sword of sharpness, `{ "flat": 14, "type": "slashing", "when": "critical" }`. Una previsión solo cuenta una cláusula contra un objetivo al que alcanza, y nunca una que sea solo para críticos. `when: "toggled"` solo la inflige mientras el interruptor del objeto está encendido (Capability API 1.170; consulta `toggle` más abajo).

Los detalles del arma y la línea del Game Master lo indican todo: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` y `Marked for 2 rounds when a hit deals 2 or more`.

<a id="armor-and-worn-effects-in-a-fight"></a>

### Armadura y efectos puestos en un combate

Lo que hace un objeto mientras se lleva puesto o encima también puede cambiar un combate (Capability API 1.56) para su portador, junto a sus estados y niveles. Cada uno toma las partes de un estado que lee un combate:

- `effects`: cualquiera de los de un estado salvo los cinco que no puede tener un nivel (`half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side`, `cannot-approach-source`), porque nadie le puso un objeto a su portador y nunca termina por sí solo: `own-attacks-advantage`, `attacks-against-disadvantage`, `resist-all`, `speed-zero` y los demás.
- `modifiers`: cambios `to` la defensa, los ataques y la velocidad, además de las pruebas y salvaciones, exactamente como los de un estado; en un combate `dice-pool`, un cambio a los ataques es un número fijo de dados, igual que el de un estado.
- `resist`, `vulnerable` e `immune`: tipos de daño de los que su portador recibe la mitad, el doble o nada, igual que los de una criatura (y comprobados contra `combat.damageTypes` si declaras alguno). `conditionImmunities`: tus propios estados que nunca se aplican a su portador.

El widow's ring maldito de Gravewatch cuesta un dado en cada ataque, su Dawn bell vinculada impide que a su portador se le aplique Rattled, y una piedra de camino de Ember Roads llevada encima protege del calor:

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

Un combate lee cada objeto una vez, con el nombre de la pila ("Widow's ring" junto a una tirada en el registro, y en una defensa), igual que una prueba; el `otherwise` de un requisito no cumplido también cuenta en un combate, así que una armadura demasiado pesada para quien la lleva puede costar velocidad. Los detalles de un objeto y la línea del Game Master lo indican todo ("While worn: -1 on attacks", "worn: +1 on checks (Ward), immune to Rattled"). Una armadura que simplemente suma a una defensa o a una absorción es una estadística de objeto leída con `itemStat` (consulta Objetos en la ficha), igual que el Guard de Ember Roads lee el abrigo que se lleva puesto.

**Dureza.** Si la iniciativa es un número que mueven los ataques, `combat.pool.hardness` es la dureza de un combatiente, leída de su ficha al empezar el combate (la de su armadura, mediante `itemStat`), y una criatura da su propia `hardness`. Un golpe que gasta cuyos dados están por debajo de ella impacta y no hace nada: el número de quien lo hace sigue volviendo a la base, el registro lo indica ("Ada's Grave spade lands on the warden with 5 dice, below a hardness of 6, and does nothing.") y el menú no le prevé ningún daño. Solo puede tenerla un conjunto con un estilo que gasta, y una criatura escrita como ficha la toma de la ficha.

<a id="using-items-in-a-fight"></a>

### Usar objetos en un combate

Un objeto puede usarse en un combate (Capability API 1.59): una cataplasma sobre un corte, un tónico que se traga, una campana que se toca. Su `use` indica lo que hace usarlo con las palabras que usa el `mechanics` de una entrada de catálogo (consulta [Qué lee un combate de `mechanics`](#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` o `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire` y, desde Capability API 1.174, `concentration` y `zone`, con el `budget` que gasta, o `free`. La cataplasma de Ember Roads y el tónico de calor y la campana del alba de Gravewatch:

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

- Un uso aparece en el menú del combate bajo **Items** (Objetos), con el nombre del objeto ("Poultice") se llame como se llame la pila. Un objeto que ocupa ranuras o se vincula se usa mientras se lleva puesto (y vinculado, si se vincula), como la campana; cualquier otro, mientras se lleva encima.
- Gasta un presupuesto, o es `free`, y paga consigo mismo: un `cost`, `perCostStep`, `check`, `concentration`, `reaction`, `scales`, `gives`, `standard` o `rider` es para una entrada de catálogo que tiene una ficha, y se rechaza en un uso.
- `toHit`, en un uso con `attackRoll`, es lo que suma para acertar, tal como lo indica el `toHit` de un arma (consulta Armas en un combate): atributos, una habilidad, una bonificación y, en un combate de reservas, un objetivo por dado. Sin él, la tirada no suma nada.
- `saveDifficulty`: el número contra el que se tira una salvación que pide (la suya propia, una que termina un estado que aplica, o la de una cláusula sin `difficulty`), escrito o leído de una estadística numérica del objeto. Una entrada de una ficha lee ese número de la fuente de su catálogo; un objeto no tiene ninguna, así que indica el suyo.
- `consumes: true` quita uno de la pila del objeto cada vez que se usa, y el menú indica cuántos quedan. El último que se usa se lleva la pila con él.
- `restore` (Capability API 1.60) devuelve parte de una reserva de cada ficha a la que llega, como una bolsa de sangre devuelve sangre: `{ "pool": "resolve", "amount": { "flat": 1 } }`, con `dice` y `flat` como los tiene un `amount`. Nombra una de tus reservas vivas, nunca la reserva de salud (la salud vuelve con una curación), y va en un uso que ayuda, un `heal` o un `buff`. Una criatura no tiene reservas, así que no recibe nada. El registro lo indica ("Ada gets back 1 Resolve, and is on 3 of 4."), y un miembro del grupo que interpreta el motor deja en paz una reserva llena. El tónico de calor de Gravewatch restaura un punto de Resolve junto a su curación.
- `charges` gasta esa cantidad de las `charges` propias del objeto, cuyo `max` es cuántas contiene, de 1 a 100, escrito o leído de una estadística numérica del objeto (se rechaza un objeto que da esa estadística como menos de 1, y uno que pasa de 100 contiene 100). La cantidad se guarda en la pila de inventario del objeto, así que una campana tocada dos veces en un combate tiene una carga en el siguiente, y una que nadie ha tocado está llena. Las cargas pertenecen a un objeto, así que un objeto que las contiene tiene un `stack` de 1. Un uso se consume o gasta cargas, nunca ambas cosas, y las cargas de un objeto siempre las gasta su uso. Dos claves de `charges` van más allá (Capability API 1.61), como las tiene la campana del alba de Gravewatch:

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge`: cuáles de tus `rests` devuelven las cargas y cuántas: `"max"` llena el objeto, y una cantidad (`{ "dice": "1d6", "flat": 1 }`) devuelve esa cantidad, nunca por encima de `max`. Un descanso devuelve las cargas de cada objeto que lleva su personaje y que lo nombra, tanto si lo hace el botón Rest de la ficha como el `[sheet: op="rest"]` del Game Master; la ficha y la bolsa se escriben juntas, y una respuesta regenerada solo recarga una vez. La ficha indica lo que volvió tras el descanso ("Dawn bell 3/3 charges"), y el Game Master ve las cargas que le quedan a cada objeto junto a él en el inventario ("2 of 3 charges left").
  - `breaksOn`: cuando un uso gasta la última carga, el motor tira un d`die`, y con `atMost` o menos el objeto se rompe y desaparece de la bolsa, en un combate y fuera de él. El registro del combate lo indica ("Dawn bell breaks (a 1 on its die)."), también el informe del botón Use ("Its last charge spent, it breaks."), y el diario lo cuenta como perdido.

- `gate` (Capability API 1.62) es una prueba que su usuario supera antes de que el objeto funcione, como pide un pergamino de un conjuro por encima del nivel de quien lo lee. `check` nombra lo que se tira: `{ "skill": "ward" }`, `{ "ability": "wits" }` o un valor de la ficha (`{ "value": { "derived": "spell_mod" } }`, para un número que varía de un personaje a otro, como el modificador de lanzamiento de conjuros de un lanzador de 5e). `difficulty` va de 1 a 100, escrito o leído de una estadística numérica del objeto (un objeto que no lo da queda fuera del menú, y su botón Use lo dice claramente). `unless` omite la prueba cuando un valor de la ficha del usuario es al menos `atLeast`. Una prueba fallida consume el objeto (o gasta sus cargas) para nada. En un combate, la prueba se tira al gastar el objeto, con los dados propios del combate (una reserva en un combate de reservas, donde `difficulty` son los éxitos que necesita) y el número de la ficha leído al empezar el combate, y cuenta lo que suman a esa prueba los estados y objetos puestos del usuario, incluido lo propio de una habilidad. El registro lo indica ("Ada rolls Ward to use Page of the vigil litany: 2 successes from 2 dice at 7 or more (8, 9), needing 2 successes, a success."). La página de la letanía de vigilia de Gravewatch tiene una:

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

Lo que un combate consume y las cargas que deja se escriben en el inventario a medida que se da cada paso, igual que los disparos de un arma, y el diario indica lo que se usó. El registro del combate indica cada uso ("Poultice: 1 of 2 left.", "Dawn bell: 2 of 3 left."). Un miembro del grupo que interpreta el motor solo usa una curación en alguien herido, y nadie usa un objeto para golpear a alguien que se aleja. Los detalles del objeto y la línea del Game Master indican lo que hace usarlo: "Use (Action): heals 1d4 + 1, range 0 paces, used up" y `use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`, y los detalles muestran las cargas que quedan. Un objeto que el Game Master inventa `like=` uno de los tuyos se usa como ese, cargas incluidas.

### Objetos en batallas Classic y Tactical

Un conjunto que no resuelve sus propios combates los deja a las batallas Classic y Tactical propias de Game Mode, donde se pregunta a un modelo qué hacen los objetos del inventario cuando empieza un combate. Tus objetos no se adivinan: cada uno con un `use` hace lo que este indica, con los números propios del motor, y la suposición del Game Master solo se pide para los objetos que no son tuyos (y para ninguno con `native: false`).

- Un `heal` cura y un `attack` daña en una proporción de la salud máxima del objetivo, según la media de su `amount`: una media de 7, el `1d8+3` de un arma básica, es algo más de una quinta parte, nunca menos de una vigésima parte y como mucho toda. Esa es la escala con la que el puente de combate lee los números de una entrada de catálogo. El `damageType` es el elemento.
- El primer estado de `applies` se aplica como estado con su propio nombre, durante sus `rounds` (2 si no las tiene), y un `buff` o `debuff` es solo ese estado, que sube o baja la defensa como lo hacen los estados propios del motor.
- `targets` indica en quién se usa. Sin él, una curación o una mejora va a un aliado, y un ataque o un perjuicio, a un enemigo.
- `consumes: true` quita uno de la pila, y un uso sin él deja el objeto donde está.
- Una tirada para acertar, una salvación, un área, los puntos temporales y una reserva restaurada no tienen cabida en estas batallas, igual que ahí con el `mechanics` de una entrada de catálogo: la descripción del objeto en el menú sigue indicándolos.
- Un objeto que ocupa ranuras solo se usa mientras se lleva puesto, y uno que se vincula, solo mientras está vinculado, igual que en un combate del conjunto. Uno que se consume se toma de lo que se lleva puesto, nunca de uno de repuesto de la bolsa.
- Un objeto cuyo uso gasta `charges` se ofrece mientras le quede un uso, y el menú Items cuenta sus usos. Cada uso las gasta de la pila del objeto, primero la del propio jugador, y el último gasto tira su `breaksOn`: si se rompe, desaparece de la bolsa y el diario lo cuenta como perdido.
- Un objeto que pide antes una prueba (`gate`) la tira en el servidor cuando lo usa un miembro del grupo, con la ficha de ese miembro y lo que lleva puesto (un acompañante sin tarjeta propia tira con una ficha en blanco, y solo la unidad propia del jugador recurre a la tarjeta del jugador), igual que la tira el botón Use, y se omite cuando se cumple `unless`. Si falla, el objeto se gasta (o se gastan sus cargas) y no hace nada, y el registro lo indica: "Ada rolls Ward to use Page of the vigil litany: 0 against 2, failed, and it is used up for nothing."
- Un objeto sin `use` no se ofrece en estas batallas, ni tampoco una curación sin `amount`.

El motor calcula por sí mismo el efecto de cada objeto, así que lo que envía la pantalla nunca decide lo que hace uno de tus objetos.

### Botín

Un combate ganado suelta botín en toda partida de Game Mode, una vez, en las bolsas del grupo. Sin conjunto, procede de las tablas propias de Game Mode (más y más raro en una partida más difícil), y lo mismo ocurre en un conjunto que no declara tablas de botín y deja `native` activado. Un conjunto que declara tablas de botín suelta en su lugar sus propios objetos, y uno con `native: false` y sin tablas no suelta nada.

`lootTables` en el bloque `items` (Capability API 1.63) las enumera, como hacen los ajuares funerarios de Gravewatch:

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

- `rolls` es cuántas elecciones hace la tabla: un número de 0 a 20, o dados (`"1d2"`), 1 de forma predeterminada.
- Cada elección saca una línea según su `weight` (1 de forma predeterminada) frente a las demás. Una línea nombra uno de tus objetos como `<catalog>/<entry>`, un `filter` por `rarity`, `category` y `tag`, que elige por igual entre todos los objetos que coinciden, o (Capability API 1.64) `coins`, una de tus monedas por su ID. `count` es cuántos se sueltan, un número o dados, 1 de forma predeterminada. Un objeto o una moneda que retira una capa no suelta nada, ni tampoco un filtro que no encuentra ninguno.
- Una criatura del bestiario nombra la tabla que lleva con `loot` (consulta Criaturas, más abajo). Un combate del conjunto ganado tira la tabla de cada criatura derrotada, y un combate que el motor no resuelve con tus reglas no tiene criaturas del bestiario, así que no suelta nada.
- Lo que se suelta va a la vista compartida igual que una adición, preguntando primero a la bolsa del jugador, y lo que nadie puede llevar se queda atrás. El resumen que recibe el Game Master indica lo que se soltó y que ya está en las bolsas, el diario lo indica y una notificación lo muestra.
- El Game Master tira una tabla en la historia con `[loot: table="grave_goods" who="Ada"]` (`who=` para la bolsa de un personaje), medido desde donde empezó el turno, igual que sus etiquetas de inventario, así que una respuesta regenerada suelta una sola vez. Cada objeto que se suelta se responde como una adición, y sus instrucciones enumeran tus tablas.

### Dinero

Tus `currencies` son el dinero del grupo. Una moneda es un objeto en las bolsas, una pila de cada moneda como cualquier otra, con el nombre de su `label`:

- Pesa una unidad de tu estadística de carga por cada `perWeight` monedas de su familia, cuenta para la carga de su portador y se coloca según la regla de carga cuando entra. Una familia sin `perWeight` no pesa nada.
- El jugador añade monedas desde la lista **Coins** (Monedas) del selector, y las divide, regala y combina como cualquier pila.
- Una línea sobre las pilas del inventario muestra las monedas de cada familia a la vista y su valor en la moneda más pequeña de la familia. El Game Master ve ese valor junto a cada bolsa (`Coin worth 432 pennies`, o `no coins` para un monedero vacío, con la bolsa del jugador incluida aunque no contenga nada), y el `cost` de un objeto junto al objeto (`costs 3 shillings`).
- El Game Master paga con `[inventory: action="pay" amount="3 shillings" who="Ada"]` y cobra con `action="earn"`. `amount` es una cantidad y una moneda, por su ID o etiqueta, en singular o plural, con cualquier combinación de mayúsculas (`1 penny`, `12 pennies`). Un pago sale de una bolsa (la del jugador sin `who=`), solo en la familia propia de la moneda: primero van las monedas más grandes que caben, después se cambia la moneda más pequeña restante que cubre lo que aún se debe, y el cambio vuelve en las monedas más pequeñas de la familia, empezando por las más grandes. La respuesta indica lo que se pagó y lo que volvió: pagar 3 shillings de un monedero que contiene una crown es `Paid with crowns ×1; shillings ×2 back.` Se rechaza un pago que la bolsa no puede cubrir (`cannot-afford`), una moneda que no tienes (`unknown-coin`) y cualquier pago en un conjunto sin monedas (`no-currencies`). Un cobro es una adición de esa moneda, a la bolsa de `who` o repartida según la regla de carga. El diario enumera lo gastado y lo cobrado, y una notificación lo muestra. Sus instrucciones enumeran tus monedas, y solo las tiene un conjunto que tenga alguna.
- Comprar es un pago seguido de una adición o, en un conjunto con mercado, un `buy` (abajo). No hay pantalla de tienda.

### Equipo inicial

`items.startingGear` (Capability API 1.78) enumera el equipo que un personaje puede meter en su bolsa al empezar: el kit de una clase, el de un trasfondo, el de una vocación. Nunca se da por sí solo. El inventario muestra una fila **Starting gear** (Equipo inicial), y el jugador elige un equipo, una opción para cada una de sus elecciones y un objeto de cada lista, y después lo mete en su bolsa o en la de un miembro del grupo. Primero aparece el equipo que encaja (`fits`) con la ficha del personaje y después el equipo sin `fits` (para cualquier personaje, como el de un trasfondo); se ofrece todo el equipo, porque el concepto de un personaje lo acuerdan el jugador y el Game Master.

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

- Una línea es uno de los objetos del conjunto (`item`), monedas (`coins`, un ID de unidad), un objeto que el jugador elige de una lista fija (`oneOf`, de 2 a 48 objetos) o un objeto simple por su nombre (`name`, cuando `freeform` permite objetos simples; sujeto a las reglas de una etiqueta, así que sin corchetes, `{{` ni saltos de línea). `count` va de 1 a 999; `equip: true` hace que se ponga un objeto al tomarlo, si sus ranuras están libres, así que la armadura cuenta desde el principio.
- `choices` va de 0 a 8, cada una con 2 a 6 opciones con sus propias líneas.
- `group`: el equipo que un personaje toma una vez por grupo (el de una clase y el de un trasfondo). Volver a tomar el mismo grupo es una decisión que el jugador toma en el cuadro de diálogo, y se suma a lo que ya hay en la bolsa. El equipo sin grupo es su propio grupo, nunca el mismo que un grupo con el mismo nombre.
- `fits` lee la ficha sin su estado vivo, igual que la carga. Solo ordena la lista.
- Tomarlo es todo o nada: el equipo demasiado pesado para quien lo va a llevar se rechaza entero, y el cuadro de diálogo indica cuánto pesa frente a lo que aún puede llevar. Un objeto que una capa saca de la partida se omite y se nombra, igual que una lista de la que saca todos los objetos; las monedas de un tipo que una capa saca se pagan en la moneda más grande que quede del mismo valor, y el cuadro de diálogo las muestra así. Se rechaza el equipo del que no queda nada, para que nunca se marque como tomado a cambio de nada. Un servicio nunca se ofrece desde una lista.
- La importación comprueba cada objeto (en un catálogo incluido en el archivo; un catálogo en su propio archivo se comprueba al tomar el equipo), moneda, objeto simple y referencia `fits`, rechaza un servicio y rechaza una cantidad que necesitaría más pilas de las que admite una bolsa a la vez.

### Mercados

Un `market` en el bloque `items` (Capability API 1.65) indica qué vende un lugar y a qué precio, en vez de que todas las tiendas vendan de todo a su precio de lista. El de Gravewatch, algo abreviado:

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

- `prices`: de uno a ocho niveles, cada uno un multiplicador (`times`, mayor que 0) sobre el `cost` de un objeto, y uno de ellos el `default`. Un precio es el coste en la moneda más pequeña de su familia multiplicado por el nivel y redondeado en ella (nunca por debajo de una moneda para algo que cuesta algo), y se expresa en la moneda en la que está escrito su coste si esa moneda lo paga exactamente o, si no, en la moneda más grande que dejan tus capas y que lo hace: en `dear`, un abrigo que cuesta 8 shillings cuesta 12 shillings, y una poción de 5e que cuesta 50 gp cuesta 50 gold pieces, nunca 5 platinum. Regatear o el humor de un vendedor mueven el nivel, nunca el número.
- `places`: de uno a doce tamaños de lugar, del más pequeño al más grande, con tus propias palabras.
- `sold`: reglas para el lugar más pequeño que vende lo que elige un filtro. Un filtro nombra una `rarity`, una `category` y una `tag`, cualquiera de ellas, y coincide con un objeto que tenga todas las que nombra; decide la primera regla que coincide con un objeto. El `sold` propio de un objeto tiene prioridad sobre las reglas, y un objeto que nada nombra se vende en cualquier lugar.
- `sellers`: tipos de vendedor, cada uno con lo que `sells` (filtros, cualquiera de los cuales elige un objeto), el `place` más pequeño que tiene uno (cualquier lugar, sin él) y, opcionalmente, a quién vende `only`: un valor de la ficha del comprador, con su estado vivo y lo que lleva encima, al menos `atLeast`, que se indica al Game Master como `label`. Sin `sellers`, cualquiera en un lugar vende lo que vende ese lugar.
- Un objeto sin `cost` no está a la venta, ni tampoco uno que oculta una capa o uno cuyas monedas retiró una capa.

**Dónde está el grupo.** El Game Master indica en qué lugar está una escena y su tamaño con `[place: name="Millbrook" size="market town"]`, el tamaño por su ID o etiqueta, y omite el tamaño para un lugar sin mercado (un camino, las tierras salvajes). El motor responde a cada etiqueta en su sitio, rechazando un tamaño que no tienes, y el último lugar al que respondió en sus propias respuestas que ve el jugador, desde el inicio de conversación más reciente, es el lugar vigente hasta que se indique otro. Una etiqueta de lugar que escribe un jugador nunca cuenta. Una respuesta regenerada solo lee lo que vino antes de la indicación que sustituye.

**Comprar.** El Game Master compra con `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`, con `level` (el predeterminado sin él) y `seller` (cualquier vendedor de aquí que venda el objeto, sin él) opcionales. El motor le pone precio en el lugar vigente cuando termina la respuesta, saca el precio del monedero del comprador (el del jugador sin `who=`) igual que un pago, con cambio, y mete el objeto en su bolsa, o solo paga un servicio. Ocurren ambas cosas o ninguna. La respuesta indica lo que costó (`price="12 shillings"`) y lo que se pagó y se devolvió, y una notificación lo muestra. Una compra se rechaza, sin cambiar nada, si no se ha indicado lugar (`no-place`), si un nivel, objeto o vendedor no existe (`unknown-level`, `unknown-item`), si no hay precio (`not-for-sale`), si el lugar es demasiado pequeño para el objeto (`not-here`), si no hay aquí ningún vendedor que lo venda (`no-seller`), si el comprador no cumple el `only` de un vendedor (`not-to-you`), si el monedero no puede cubrirlo (`cannot-afford`) o si una bolsa no puede llevarlo.

**Lo que ve el Game Master.** Mientras una escena está en un lugar con mercado, un bloque MARKET nombra el lugar y su tamaño, los niveles de precio y cada vendedor que hay allí con una docena de lo que vende al nivel predeterminado, de lo más barato a lo más caro; cualquier cosa que venda puede comprarse por su nombre. Sus instrucciones enseñan `[place:]` y `buy`, y solo las tiene un conjunto con mercado.

#### Un día de mercado

Un día de mercado (Capability API 1.69) hace que las existencias de un lugar cambien y se agoten, y permite al grupo vender. El de Gravewatch, algo abreviado:

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

- **El día.** Un día en un lugar dura hasta que el Game Master nombra otro lugar; empieza un día nuevo en el mismo lugar volviendo a indicarlo con `day="new"` (`[place: name="Millbrook" size="market town" day="new"]`). Todo lo siguiente se calcula por día a partir de las respuestas del Game Master que ve el jugador, así que un swipe, una respuesta regenerada o una rama no necesitan guardar nada, y un día siempre tira las mismas existencias.
- **`limited`** en una regla `sold` o en el `sold` propio de un objeto: cuántos tiene disponibles un lugar en un día, un número o dados tirados para el día. Una regla puede nombrar un límite sin lugar (se vende en cualquier lugar, unos pocos cada vez); el lugar de un objeto procede de la primera regla que nombra un lugar, y su límite, de la primera que nombra un límite. Una vez comprados, una compra se rechaza (`sold-out`) hasta un día nuevo.
- **`stock`** en un vendedor: una de tus tablas de botín, tirada una vez al día para lo que ese vendedor tiene en existencias además de lo que vende. Lo que sale (solo objetos, nunca monedas) lo vende únicamente ese vendedor, tantos como salieron, digan lo que digan `sells` y `sold`; el `only` de un vendedor sigue aplicándose.
- **`buyBack`**: la proporción (mayor que 0, como máximo 1) del precio predeterminado de un objeto que paga un vendedor por él. Lo compra un vendedor de aquí que venda ese tipo de cosa (cualquiera, sin vendedores). Sin `buyBack`, nadie compra nada.
- **`purse`** en un tamaño de lugar: lo máximo que pagan en total sus vendedores en un día, en una de tus monedas. Las ventas pagadas en la familia de esa moneda cuentan contra ese máximo; sin fondos, compran sin límite.
- **Vender.** El Game Master vende con `[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]`. El motor le pone precio, lo saca de la bolsa de quien vende (la del jugador sin `who=`; nunca un objeto maldito vinculado) y mete sus monedas, empezando por las más grandes, o lo rechaza sin cambiar nada: si no se ha indicado lugar, si nadie aquí lo compra (`not-bought`), si no hay precio (`not-for-sale`), si los fondos del día se han agotado (`purse-spent`), si no se tiene ninguno o si la bolsa no puede llevar las monedas. La respuesta indica lo que se obtuvo (`price="4 shillings"`), el diario lo registra como vendido y una notificación lo muestra.
- El bloque MARKET añade lo que tiene cada vendedor en existencias hoy, cuántos quedan de un objeto limitado, lo que pagan los vendedores de aquí y cuánto queda de los fondos del día; sus instrucciones enseñan `sell` y `day="new"`.

#### Vendedores honrados y deshonestos

Capability API 1.79 permite que un objeto sea arriesgado o una falsificación, y que un vendedor sea deshonesto.

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- **`risky`** en un objeto: la advertencia que hace un vendedor honrado antes de venderlo. El bloque MARKET lo muestra con "(warn the buyer first: ...)" junto a la mercancía de un vendedor honrado; un vendedor deshonesto no dice nada.
- **`passesFor`** en un objeto lo convierte en una falsificación de otro objeto (`<catalog>/<entry>`): un objeto real y vendible de la misma categoría, que se lleva puesto en las mismas ranuras y que se vincula si la falsificación se vincula. Se comprueba al importar cuando ambos se pueden leer, al instalar para cada archivo de catálogo y de nuevo cuando un mercado lo ofrece, así que nunca se vende una falsificación cuyo objetivo falta o está oculto por una capa. Un objeto maldito (`binds.cursed`) o una falsificación nunca están entre la mercancía de nadie, ni en las existencias de un vendedor honrado.
- **`honest: false`** en un vendedor: una falsificación que sale en su tabla de `stock` se ofrece como el objeto por el que se hace pasar, al precio de ese objeto, y el bloque MARKET muestra al Game Master la verdad a su lado. Una compra que nombra a ese vendedor y ese objeto recibe la falsificación; una compra que no nombra a ningún vendedor nunca la recibe.
- **Una falsificación en la bolsa** se muestra como el objeto por el que se hace pasar en todos los sitios que mira el jugador (la bolsa, el diario, las notificaciones, los combates), y conserva lo que es en realidad. El bloque de inventario del Game Master la marca como `[FAKE: really ...]` y le pide que la siga llamando por el nombre con el que se muestra.
- **Descubierta**: `[inventory: action="reveal" item="Bag of Holding" who="Ada"]`, vincularla (al sintonizarla se revela una maldición), usarla (ocurre lo que hace en realidad; cuando eso es nada que las reglas puedan calcular, lo cuenta el Game Master) o vendérsela a un comprador honrado, que dice lo que es en realidad y paga lo que vale eso (su propio `cost`), o la rechaza si no tiene. Un comprador deshonesto acepta una falsificación como lo que parece. A partir de entonces es su objeto verdadero.
- **Puesta o llevada**: una falsificación hace en la ficha del personaje lo que hace en realidad (sus efectos `worn` o `carried` y sus estadísticas). El primer cambio de inventario tras el cual la ficha muestra un número, o lo que suma una prueba, que no daría el objeto por el que se hace pasar la descubre, y el diario y la pantalla indican lo que era. Una diferencia que solo lee un combate (una resistencia) no la descubre, ni tampoco un cambio solo en la ficha hasta el siguiente cambio de inventario. En un combate, un arma falsa puesta sigue atacando como el arma por la que se hace pasar.
- Con la confianza de un solo jugador, Peek Prompt muestra la vista del Game Master, incluida la verdad.

<a id="using-items-outside-a-fight"></a>

### Usar objetos fuera de un combate

El mismo `use` funciona fuera de un combate (Capability API 1.60 para `restore`; el resto no necesita nada nuevo). El botón **Use** del inventario, en uno de tus objetos con un `use`, y el `[inventory: action="use" item="Poultice" who="Juno"]` del Game Master hacen lo que hace el objeto a quien lo lleva, con los dados del motor:

- Una curación devuelve salud: la cantidad en una reserva de salud, o una marca eliminada en un contador de heridas, igual que una curación en un combate. Los puntos `temporary` van a una reserva de salud, `restore` devuelve su reserva y cada estado que `applies` se aplica hasta que algo lo quite.
- Un uso que daña, o que apunta al otro bando (`kind` `attack` o `debuff`, o `targets` `enemy`), no alcanza a nadie: fuera de un combate no hay nadie en el tablero a quien golpear. El objeto se usa igualmente, y se informa al Game Master de lo que hace para que lo narre.
- Quita uno de la pila o gasta sus cargas exactamente igual que un combate, y uno al que no le queda ninguna, o uno que ocupa una ranura o se vincula y no se lleva puesto, se rechaza sin cambiar nada. La ficha y la bolsa se escriben juntas.
- Un `gate` se tira primero, igual que una prueba: los dados propios del conjunto con el número de la ficha, la penalización por heridas del usuario y lo que hacen a esa prueba sus estados y sus objetos puestos o encima. Uno fallido consume el objeto para nada, y la línea lo indica ("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

Lo que ocurrió se indica en una línea: "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." El botón Use lo envía al Game Master en un bloque `[item_used]` después de "I use my Poultice.", que el chat muestra como una insignia; la propia etiqueta del Game Master se responde con él, medida desde donde empezó el turno igual que sus otras etiquetas, así que una respuesta regenerada nunca usa un objeto dos veces. Un objeto sin `use`, o en una partida sin conjunto, se sigue indicando sin más: "I use my rope."

<a id="battles-lending-the-sheet-to-marinaras-combat"></a>

## Batallas: prestar la ficha al combate de Marinara

De forma predeterminada, una batalla no conoce la ficha. Construye los combatientes como siempre; un personaje puede salir de una pelea sin cambios en los puntos de golpe de su ficha.

El bloque opcional `battle` cambia eso en una sola dirección: presta las cifras al combate y escribe su resultado de vuelta. **No hace que el combate siga tus reglas.** Los dados, quién acierta y cuánto daño hace siguen siendo de Marinara. Por eso la salud se transfiere como proporción del máximo, no como tu cifra: media salud en la ficha equivale a media barra de la que Marinara creó. Tu reserva de 9 puntos no entra directamente en una pelea donde un golpe hace 12.

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health`: obligatorio. Reserva viva que representa los puntos de golpe. Debe pertenecer a `sheet.live.pools`, no ser una lista cuyas filas son reservas.
- `energy`: opcional. Reserva que puede gastar el combate y que se convierte en la barra MP. Debe ser distinta de `health`, pues no se pueden gastar puntos de golpe como energía.
- `slots`: opcional. Reservas gastadas de una en una, cada una con `level` de 1 a 9: `[{ "pool": "slots_1", "level": 1 }]`. Cada nivel y reserva se usa una sola vez.
- `skills`: opcional, hasta ocho. Listas cuyas filas pasan a ser habilidades de combate. Solo cuentan filas de tus catálogos cuya entrada tenga `mechanics`: una fila escrita a mano no expresa efectos numéricos. `onlyWhen` nombra una columna booleana que debe estar activada, como un conjuro preparado. `alwaysWhen` nombra una columna y un valor que permiten entrar de todos modos, como conjuros que no requieren preparación. Es la excepción a `onlyWhen` y se rechaza sin él.

### Qué entra y qué vuelve

**Al entrar**, para cada miembro cuya ficha tiene la partida: la proporción de salud determina el punto inicial en la barra de Marinara; la reserva de energía se convierte en MP; cada reserva de espacios se convierte en espacios de ese nivel; las filas marcadas se convierten en habilidades. Salud máxima, ataque, defensa, velocidad y nivel siguen siendo cifras de Marinara. Una reserva de salud a cero hace empezar caído; por encima de cero nunca se empieza con menos de un punto, para que el redondeo no derribe a alguien por una proporción pequeña.

**Al salir**, una vez terminada la pelea: la proporción final de la barra se convierte a la escala de la reserva y se aplica como daño o curación la diferencia respecto al inicio. Energía y espacios son cantidades, no proporciones, y vuelven tal cual. Todo sigue las reglas de los botones de la ficha; los cambios rechazados se omiten y notifican, no se fuerzan. Una pelea que no cambió la salud no escribe ningún cambio, para que las conversiones por sí solas nunca alteren la ficha.

**En ninguna dirección**: tiradas de ataque, salvaciones, concentración y efectos de pagar más. Están en `mechanics` para que los lea un sistema de combate completo en el futuro; este puente no los aplica y el conjunto no debe afirmar que sí.

Una batalla abandonada no escribe nada. Si borras el mensaje que la inició o nunca llega al final, la ficha queda igual: la pelea no ocurrió.

### Cómo se convierte una entrada en habilidad

El bloque `mechanics` se interpreta así:

- `kind` determina el tipo de habilidad. Se omiten entradas `utility` y las marcadas `reaction`, pues el combate de Marinara no tiene dónde aplicarlas.
- `amount` determina la fuerza como multiplicador del ataque del combatiente, no como daño fijo. Dados mayores nunca golpean más suave; el multiplicador permanece en el rango usado por habilidades generadas.
- `range` y `area.size` se dividen por `units.distance.perCell` del catálogo para obtener casillas, sin redondear nunca a cero. Una explosión usa su radio, un cono la mitad y una línea una casilla. Un área afecta a todos los enemigos cubiertos y respeta `friendlyFire`.
- `damageType` se convierte en elemento. No se transfiere `targets`: Marinara determina los objetivos válidos de curaciones, mejoras y ataques por el tipo de habilidad.
- Un `cost` de energía se convierte en coste MP; varios se suman. Un `cost` de exactamente un espacio gasta uno de ese nivel. Marinara cobra una cantidad de energía o un espacio, nunca ambos: omite entradas con dos espacios, espacios de dos niveles o espacio más energía. También omite costes de otras reservas, como salud o recursos de clase, para no concederlos gratis.
- `buff` y `debuff` se convierten en los efectos propios de Marinara. Otras promesas del texto, como quitar un estado de la ficha, no se aplican. Omite `mechanics` si el efecto solo tiene sentido fuera de batalla.

`coverage.combat` sigue siendo independiente y conserva su significado: actívalo solo si las batallas siguen realmente las reglas de tu sistema.

<a id="combat-a-fight-your-own-rules-resolve"></a>

## Combate: una pelea que resuelven tus propias reglas

El bloque `battle` presta al combate las cifras de la ficha, manteniendo la aritmética de Marinara. El bloque opcional `combat` define cómo RESUELVEN tus reglas la pelea. Parametriza un tipo de combate del motor, igual que `resolution` parametriza pruebas; todos sus nombres son tuyos. Hay dos tipos: `attack-vs-defense`, donde los dados se suman y se comparan con un número, y `dice-pool`, donde un combate tira las reservas propias de tu conjunto `dice-pool` y cuenta éxitos (consulta Un combate tirado con reservas, más abajo).

**Una partida cuyo conjunto declara `combat` pelea según ese bloque.** Las cifras del grupo vienen de sus fichas, los adversarios de tu bestiario o escala de amenaza, y cada turno se resuelve con tus dados. Todo lo gastado o perdido se guarda en la ficha en el momento, así que cerrar la pestaña a mitad no pierde nada. La pantalla usa tus palabras: ataques y capacidades en el menú, presupuestos, estados y registro con los cálculos reales. Las carencias se enumeran en la sección sobre lo que falta.

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

Ese es todo el bloque Ember Roads y sus partidas lo usan para combatir. El borrador 5e usa las mismas claves para d20:

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

### Todas las claves

- `kind`: `"attack-vs-defense"` (un bando tira contra la defensa del otro; acertar causa daño) o `"dice-pool"` (consulta Un combate tirado con reservas). Cada clave siguiente significa lo mismo en ambos, leída como ese tipo lee los números.
- `health`: obligatorio. Lo que quita la pelea: `{ "pool": "grit" }`, una reserva que disminuye y cuyo margen temporal absorbe primero el daño si existe; o `{ "track": "harm" }`, un contador de heridas que MARCA. El contador necesita `damageKinds` y no concede puntos temporales.
- `defense`: obligatorio, referencia de valor. Un campo introducido por el jugador o un valor derivado que calculas.
- `initiative`: obligatorio. Dados tirados una vez al inicio y referencia opcional de modificador. Los empates favorecen el modificador mayor y después el orden de preparación del combate. `"each": "round"` vuelve a tirar la iniciativa de todos al empezar cada ronda nueva, con el modificador tal como esté entonces (así, un modificador que lee un contador de heridas es más lento una vez herido), y la ronda empieza por quien quede primero en el nuevo orden. Capability API 1.47. Un combate `dice-pool` puede tirarla en su lugar como reserva: `pool` (una referencia de valor) es cuántos dados, y sus éxitos más `plus` son el número, sin `dice` ni `modifier` al lado. `resource`, que necesita `pool`, conserva ese número y permite que los ataques lo muevan (consulta "Iniciativa que mueven los ataques", más abajo). Capability API 1.48.
- `attackRoll`: obligatorio en `attack-vs-defense` y rechazado en `dice-pool`, que tira las reservas propias de tu resolución. Define dados, si se tira dos veces y se conserva una (`advantage`), qué hacen las caras extremas de un dado (`naturals.max`: `critical`, `hit` o `none`; `naturals.min`: `miss` o `none`) y qué hace el crítico (`critical`: `double-dice` vuelve a tirar los dados de daño; `max-dice` añade una vez sus caras máximas; `none` es un impacto normal). Las caras especiales requieren un único dado, igual que en pruebas. Las salvaciones de combate usan estos mismos dados. `criticalFrom` amplía la cara de crítico: un valor que se lee de la ficha del atacante y que es la cara natural más baja que cuenta como crítico, como `{ "field": "critical_from" }` para un Champion de 5e cuya ficha dice 19. Se limita a la cara más alta del dado, un valor inferior a 2 significa que no hay rango (solo la cara más alta, como en un personaje cuyo campo se deja en 0), y necesita un único dado con `naturals.max` fijado en `critical`. Capability API 1.81.
- `economy`: obligatorio. `budgets` define lo que cabe en un turno: ID, etiqueta, `per` (`turn` se repone al inicio del turno del portador; `round`, al empezar una ronda) y `count`. El PRIMER presupuesto es el principal, gastado por acciones estándar. `movement` es una referencia opcional de distancia recorrida por turno, en tu unidad. La leen combates sobre tablero; consulta Posiciones.
- `attacks`: opcional. Listas de ficha cuyas filas son armas. `name` es la columna de nombre; `damage.dice`, la de dados; `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` y `damage.type` nombran columnas de la misma lista. Una columna `ability` es un `enum` con un ID de atributo; otros valores no añaden nada. `proficiency` es `boolean`: activarlo añade competencia. Sin dados legibles, la fila no es un ataque; una cuerda sigue siendo cuerda. `toHit.skill` nombra una columna `enum` con uno de tus IDs de habilidad: la fila suma lo que suma una prueba de esa habilidad, con el `ability` propio de la fila en lugar del de la habilidad si nombra uno, exactamente como lo cambia el `with=` de una prueba (Capability API 1.47).

  `strikes` referencia cuántos ataques compra UN gasto del presupuesto. Elegir una fila sin ataques disponibles gasta el presupuesto y deja el resto disponibles. Mientras quede alguno, todas las filas que declaran `strikes` son gratuitas: cambiar arma, objetivo o caminar entre ataques surge del propio menú. `strikesCappedBy` nombra una columna booleana que limita SU fila a un único ataque, por muchos que compre la lista: sirve para armas que disparan una vez por turno, como la propiedad Loading de SRD 5.1. No tiene sentido, y se rechaza, en listas que ya compran un ataque por gasto. Los ataques disponibles pertenecen al COMBATIENTE, no a una lista: dos listas con `strikes` comparten la misma cantidad, use la fila que use. Se borran al terminar el turno que los compró. Sin declaración se compra uno por gasto, como antes.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`: opcional. Listas cuyas filas marcadas por catálogo son capacidades, filtradas como `battle.skills` mediante `onlyWhen` y `alwaysWhen`. Sus efectos son el `mechanics` de la entrada; el bloque establece el `budget` predeterminado, el `toHit` añadido si tira para acertar y la `saveDifficulty` de las salvaciones. Se rechaza una entrada que pide salvación, propia o para terminar un estado aplicado, si su lista no tiene `saveDifficulty`: una salvación contra nada siempre tendría éxito. Con Capability API 1.108, `byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }` selecciona referencias según la clase de una fila. Un clérigo 3 / mago 2 puede derivar el ataque del clérigo de la competencia más Sabiduría y la CD de 8 más ese ataque, y los del mago, de Inteligencia. La columna debe existir en la lista de origen, y `values` contiene de 1 a 20 entradas. Cada entrada puede sustituir cualquiera de las dos referencias; una referencia omitida, un valor de columna ausente o un valor no incluido conservan la referencia propia del origen. El combate, el resumen de filas de la ficha y el resumen del Game Master leen los mismos números por fila. Tanto `stamp` como `byColumn` requieren schemaVersion 2 y capabilityApi 1.108 o posterior.
- `standard`: opcional, lista cerrada `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. Siempre se resuelven `dodge` (los ataques recibidos se tiran dos veces y conservan el peor) y `help` (el siguiente ataque del aliado se tira dos veces y conserva el mejor). `dash` (otro movimiento completo) y `disengage` (nadie ataca por alejarte este turno) se resuelven en tablero y solo se registran sin él. `hide` y `ready` se aceptan, pero aún no hacen nada.
- `standardEffects`: opcional, efectos de acciones estándar que su indicador no contiene. Hoy solo `dodge`: `{ "dodge": { "saves": ["dex_save"] } }` indica qué salvaciones tira dos veces conservando la mejor mientras dura. Solo nombra salvaciones declaradas, y solo si `standard` incluye `dodge`. Sin esto, esquivar sigue dificultando los impactos y nada más.
- `conditions`: opcional. Asigna TUS IDs de estado a sus efectos para que ficha y combate compartan un registro: un personaje envenenado sigue así después. Lista cerrada: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side` (1.278) y `cannot-approach-source`. `failsSaves` nombra las salvaciones que falla sin tirar. Los seis efectos que requieren distancia o movimiento (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) solo tienen efecto en tablero; consulta Posiciones. `cannot-react` excluye al portador de las ventanas abiertas por movimiento, por lo que no se le pregunta. Hay otras cuatro claves:
  - `modifiers`: los números que cambia mientras está activo. Consulta Números que cambia un estado, más abajo.
  - `saves`: salvaciones a las que se refieren los dos efectos de salvación y cualquier modificador a las salvaciones. Sin ella, todas; declararla sin ninguno de ellos se rechaza.
  - `skills`: habilidades a las que se refieren los dos efectos de prueba y cualquier modificador a las pruebas que no nombra habilidades propias. Sin ella, todas; declararla sin ninguno de ellos se rechaza. Los enfrentamientos de un combate tiran las pruebas propias del combate, no habilidades, así que algo restringido a habilidades nunca llega a uno; una prueba fuera de un combate con una de esas habilidades sí lo lee (consulta Pruebas fuera de un combate, más abajo). Capability API 1.53.
  - `whileSourceInSight`: lo que solo cuenta mientras quien lo aplicó esté a la vista del portador. `true` condiciona todo el estado; una lista de sus efectos condiciona solo esos y conserva el resto, como un miedo que impide acercarte aunque no veas el origen. Se rechazan efectos que el estado no tenga. Sin tablero no hay línea de visión que romper y todo cuenta igualmente.
  - `endsWhenSourceDown`: se quita en cuanto cae quien lo aplicó.
  - Sentidos (Capability API 1.127): el `lacks` de un estado nombra los sentidos que no tiene quien lo tiene, y el `mechanics.needs` de una entrada de catálogo o el `needs` de la acción de una criatura nombran los sentidos que debe tener un objetivo para que le afecte. Para el Deafened de 5e, escribe `"lacks": ["hearing"]`; para Command, escribe `"needs": ["hearing"]` en sus mecánicas. Un objetivo ensordecido queda fuera del menú de objetivos de Command. Un efecto de área o de varios objetivos que necesita el oído se salta ese objetivo por completo: ni salvación, ni daño, ni estados. Cuando termina Deafened, el objetivo vuelve a ser válido. Cada lista tiene de uno a cuatro IDs de sentido únicos, con las palabras del propio conjunto; el motor no conoce ningún nombre de sentido.
  - Solo utilizable mientras la ficha lo permita (Capability API 1.166): el `mechanics.usableWhen` de una entrada de catálogo es `{ "value": <value reference>, "atLeast": n, "atMost": n }` (uno de los límites o ambos). En un combate, la entrada se ofrece, en el turno de quien la tiene o en una ventana de reacción, solo mientras el valor que se lee de su ficha, su estado vivo y sus objetos esté dentro de los límites; se lee cada vez que se dibuja el menú. El Protection de 5e necesita un escudo en la mano: `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. El "sin armadura pesada" de Rage es lo mismo con `"atMost": 0` sobre la cuenta de armaduras pesadas. Una criatura escrita como perfil no tiene ficha, así que nada la retiene.
  - Estados que solo se aplican mientras lo permita la ficha de quien los aplica (Capability API 1.167): una entrada de `applies` en las mecánicas de una entrada de catálogo o en el uso de un objeto puede llevar `"when"`, con la misma forma que `usableWhen`. Se lee de la ficha, el estado vivo y los objetos de quien lo aplica, en el momento en que se aplicaría, y una entrada fuera de sus límites se omite; las demás se siguen aplicando. El Rage de 5e aplica `raging` y uno de tres estados de daño dentro del límite de cuatro entradas: `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, después `raging_damage_3` con `"atLeast": 9, "atMost": 15` y `raging_damage_4` con `"atLeast": 16`. Quien aplica sin ficha aplica todas las entradas. El perfil de una criatura y el `onEnd` de un estado no tienen ficha de quien aplica que leer, así que ahí se rechaza `when`. Requiere schemaVersion 2 y capabilityApi 1.167 o posterior.
  - Tipos de criatura y pruebas de objetivo (Capability API 1.168): `combat.creatureTypes` enumera lo que puede ser un combatiente, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id": "devil", "label": "devil" }], "field": "race", "default": "humanoid" }`. Una criatura nombra su propio `type` y sus `tags`; el tipo de un personaje es el valor del campo de texto o de elección `field` cuando es uno de los tipos y, si no, `default` (los personajes de 5e son humanoides). Una prueba de objetivo es `{ "types": [...], "tags": [...] }` y se cumple con cualquier coincidencia; un combatiente sin tipo ni etiquetas nunca coincide. Va en tres sitios: el `targetIs` de una cláusula de daño solo inflige esa cláusula a un objetivo que coincide (una dragon slayer: `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`; el agua bendita: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`); el `targetIs` de una entrada de `applies` solo aplica ese estado a un objetivo que coincide; y `mechanics.targetTypes: { "is": test, "not": test }` indica a quién se puede elegir o alcanzar (Animal Friendship: `{ "is": { "types": ["beast"] } }`; Sleep: `{ "not": { "types": ["undead"] } }`). Un área pasa de largo a quien deja fuera `targetTypes`. Una previsión solo cuenta una cláusula `targetIs` contra un objetivo al que alcanzaría; la media simple de la ficha la deja fuera. El panel de batalla y el Game Master ven el tipo y las etiquetas de cada combatiente. Requiere schemaVersion 2 y capabilityApi 1.168 o posterior.
  - Finales de estado (Capability API 1.125): Charm Person usa `"endsWhen": ["harmed-by-source-side"]`. Un daño mayor que cero de quien lo aplicó o de cualquiera de su bando, o que estos apunten a quien lo tiene con un ataque, una salvación o un estado dañino, lo termina después de que la acción dañina se resuelva por completo, aunque el ataque falle o la salvación tenga éxito. `"saveWhenDamaged": true` repite una salvación de turno al recibir daño: cada cantidad de daño mayor que cero repite el `saveEnds` de la acción que lo aplicó con su CD guardada; un éxito lo termina. Sin una salvación o una CD guardadas, no se tira nada. Hypnotic Pattern usa `"endsWhen": ["damaged"]` y `"shakeOff": { "budget": "action" }`: cualquier daño mayor que cero lo termina de inmediato, o bien otro combatiente del bando de quien lo tiene puede gastar ese presupuesto en su propio turno para terminarlo. `shakeOff.reach` está en la unidad de distancia del conjunto y vale una casilla de forma predeterminada; sin tablero no se mide ninguna distancia. La economía debe declarar su presupuesto. `endsWhen` tiene una o dos entradas únicas. Estas claves no cambian los finales por caída del origen ni por concentración. Para una salvación solo ante un daño mayor que cero, nunca al inicio ni al final del turno, usa `saveEnds.at: "damaged"` (Capability API 1.129): el applies de Dominate Person es `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`, que tira una vez por golpe con la CD guardada de la acción que lo aplicó sin necesitar `saveWhenDamaged`.
  - La economía de acciones (Capability API 1.76), tal como la cambian Haste y Slow:
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]` da a quien lo tiene esa cantidad más (o menos) de un presupuesto de turno en cada turno, nunca por debajo de cero. Solo se puede cambiar así un presupuesto que se repone `per` turno. Un presupuesto puede declararse con `"count": 0` para uno que solo llena un estado, y la pantalla solo lo muestra mientras alguien tenga algo de él. Un oponente inventado nunca gasta uno.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true, "items": true }` indica en qué se puede gastar ese presupuesto: las acciones estándar nombradas (de la propia lista `standard` del conjunto, nunca en el primer presupuesto, donde ya están todas las acciones estándar), un ataque con arma de un solo golpe (compre los ataques que compre normalmente una acción; para una criatura, un ataque de su perfil contra un solo objetivo, nunca un ataque múltiple) y el uso de un objeto: `true` para cualquier objeto, o `{ "tags": ["mundane"] }` solo para un objeto con una de esas etiquetas de objeto (el Use an Object de 5e es el de un objeto mundano, nunca la activación de un objeto mágico). Se ofrecen cuando se ha agotado el presupuesto que gastarían normalmente, y solo en el propio turno de quien lo tiene: una concesión nunca paga una reacción.
    - `exclusive`: `["action", "bonus"]`, dos presupuestos de los que un turno solo gasta uno: gastar cualquiera de ellos vacía el otro.
    - `attacksPerTurn`: cuántos ataques (acciones que tiran para acertar, cada parte de ataque de una secuencia y un enfrentamiento que ocupa el lugar de un golpe, como un agarre) hace quien lo tiene en su propio turno, dé lo que dé una acción. Una reacción en el turno de otro ni se limita ni se cuenta.
    - `onEnd`: `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`, lo que deja atrás cuando termina definitivamente (se agota, una salvación o un daño lo terminan, se rompe la concentración), nunca cuando se vuelve a aplicar. Dura algunas `rounds` (nunca `"until-save"` ni `"instant"`). Si se deja atrás en mitad del propio turno de quien lo tiene, sus rondas empiezan con el turno siguiente, así que una ronda es todo el turno siguiente.
  - Cuando termina un combate, termine como termine, cada estado que aplicó con un reloj, un `endsAfter` o una concentración se retira de la ficha sin dejar nada atrás, y la concentración termina. Un estado sin reloj (el derribo de una caída) se queda.

  `own-saves-advantage` y su opuesto tiran dos veces y conservan una, como los ataques; se cancelan entre sí. `own-checks-advantage` y su opuesto hacen lo mismo con el lado del portador en un enfrentamiento, que es donde un combate hace sus pruebas de atributo, y con sus pruebas fuera de un combate. `resist-all` reduce a la mitad todo daño además de las defensas propias del objetivo y se cancela con una vulnerabilidad de la misma manera. `cannot-target-source` impide apuntar cualquier cosa a quien lo aplicó (`cannot-target-source-side`, 1.278: ni a nadie de su bando, salvo que sea el del portador). `cannot-approach-source` impide acercarse más que la casilla actual, incluido el camino: permite rodear hasta otra igual de distante, pero no pasar cerca y salir por el otro lado.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **Daño que cambia un estado (Capability API 1.133).** `damage` cambia lo que inflige quien lo tiene; `damage-taken` cambia lo que recibe quien lo tiene. Ambos aceptan `flat`, `dice` (y `minus`) o `times: 0.5 | 2`. Las sumas se aplican una vez por impacto de ataque, aunque el impacto tenga varias cláusulas de daño; los críticos duplican los dados añadidos igual que el conjunto duplica sus demás dados. Las salvaciones y los impactos automáticos no reciben ninguna. `times` cambia todo el impacto después de las sumas y antes de la resistencia, redondeando el total hacia abajo una sola vez entre todas sus cláusulas. Las cantidades añadidas se enfrentan a la resistencia con su propio `damageType`, o con el tipo del impacto si se omite. Las sumas del mismo tipo se unen a esa cantidad antes de la resistencia.

  `attacks` es `weapon`, `spell` o `any` (el predeterminado). Las filas de listas de ataques y los ataques de objetos equipados son armas, igual que las tiradas de ataque de perfil contra un solo objetivo; las capacidades de catálogo (incluido el lanzamiento de conjuros de las criaturas) y los usos de objetos son ataques de conjuro u otros. `blow: "melee" | "ranged"` sigue a 1.118, así que un arma arrojadiza a su alcance es cuerpo a cuerpo. `ability` nombra el atributo realmente elegido para la tirada de ataque: el atributo de una fila, o el primer mejor atributo que ofrece un objeto (incluido el de destreza). Las acciones de perfil simples no tienen ninguno y nunca coinciden con una restricción de atributo. Estas claves y `damageType` se rechazan en otros objetivos de modificador. `fromSource: true` solo es para `damage-taken`: el impacto debe venir de quien aplicó el estado registrado. Un estado no registrado, un nivel o un objeto no tienen origen que los aplique y no pueden coincidir.

  En 5e, declara estos IDs de estado en la ficha y pon después estas entradas en `combat.conditions`:

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

  Divine Favor y Rage recaen en su lanzador; Ray of Enfeeblement y Hunter's Mark, en su objetivo. Hex usa la entrada `damage-taken` de la marca con `attacks: "any"` y `damageType: "necrotic"`. Los niveles y los efectos `worn`, `carried` y `otherwise` de requisito de los objetos comparten estos modificadores. El menú de ataque solo cuenta las propias sumas y multiplicadores de quien lo tiene; nunca promete ahí la marca de un objetivo. Los resúmenes de la ficha y del prompt describen los propios modificadores de daño de quien lo tiene, y la vista de batalla también describe los que recibe. Los paquetes que usan cualquiera de los dos objetivos requieren schemaVersion 2 y capabilityApi 1.133 o posterior, también cuando el objeto está en un archivo de catálogo separado.

  **Números que cambia un estado.** Cada entrada de `modifiers` nombra lo que cambia, `to`, y en cuánto:
  - `defense`: el número que debe alcanzar un ataque contra el portador. Solo un número fijo.
  - `attacks`, `saves`, `checks`: las tiradas de ataque, salvaciones y pruebas de enfrentamiento del propio portador. Un número fijo, o `dice` tirados cada vez que se hace la tirada (`"1d4"`); `minus: true` resta los dados en vez de sumarlos.
  - `speed`: cuánto camina el portador, en tu propia unidad de distancia (`flat`), o `times` 0.5 o 2 para la mitad o el doble, aplicado después de cada cambio fijo. Solo se lee en un tablero, igual que `speed-zero`.
  - `health-max`: `times` 0.5 y nada más reduce a la mitad el máximo de salud de quien lo tiene, redondeado hacia abajo y nunca por debajo de 1 (Capability API 1.115). Un contador de salud de casillas no tiene máximo que reducir. La salud por encima del máximo reducido se pierde al empezar el combate, y la curación nunca lo supera.

  Un modificador a `checks` puede nombrar sus propias `skills`, y uno a `saves` sus propias `saves`, que lo restringen en lugar de las del estado. Cualquiera de ellos puede tirar dos veces con `mode: "advantage"` o `"disadvantage"`, que se cuenta junto con los efectos del mismo nombre y se cancela igual que ellos, con o sin un número al lado; así, un mismo estado puede hacer Sneak más difícil y Climb más fácil a la vez. Estas tres claves necesitan Capability API 1.53.

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  Un número fijo lleva su propio signo, y 0 se rechaza. Cada modificador se muestra en el registro junto a la tirada que cambió, con el nombre del estado ("12 + 5 + 3 (Blessed) = 20"), y la probabilidad de acertar y la de ganar del menú lo tienen en cuenta. Los estados se acumulan entre sí; el mismo estado dos veces sigue siendo un estado.

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels`: opcional. Niveles de un contador vivo que cuentan como estados mientras el contador esté lo bastante alto, que es como se expresa un estado que empeora por pasos, como el agotamiento. Cada entrada nombra un `track` simple (no un contador de heridas), el nivel `at` en el que empieza y lo que hace, con los mismos `effects`, `modifiers`, `failsSaves`, `saves` y `skills` que tiene un estado. Cuenta cada nivel que ha alcanzado el contador, así que se suman a medida que sube. Un nivel no tiene origen y solo termina cuando baja lo que lee, así que `half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side` y `cannot-approach-source` se rechazan en uno. Solo un combatiente con ficha tiene contadores. El registro nombra un nivel por su contador y número ("- 1 (Heat 3)").

  En lugar de `track`, un nivel puede leer un valor `derived` (Capability API 1.54), calculado con el estado vivo y los objetos del personaje, para que nadie tenga que marcar nada: Ember Roads ralentiza a cualquiera que lleve 10 de volumen o más.

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

  Un umbral que varía de un personaje a otro ("more than five times Strength") es un valor derivado que lo resta: `scale` por -1 da la parte que hay que restar, y una `sum` de ambos es lo que lee el nivel.

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

  `"defeats": true` saca del combate para siempre a quien lo tiene en cuanto empieza, antes de que nadie se mueva (Capability API 1.115). Este y la salud perdida por un máximo reducido se resuelven una sola vez, al empezar el combate; cualquier otro nivel se lee cada vez que se lee el número que cambia.

  Los oponentes también llevan contadores (Capability API 1.115). Uno sin ficha empieza con los `tracks` que se le dan, por tus IDs de contador: una criatura que propone el Game Master puede nombrarlos (`"tracks": { "exhaustion": 2 }`), igual que un oponente del bestiario que se pone en un combate. Los `conditionImmunities` de una criatura pueden nombrar un contador que lee un nivel, y entonces ninguno de los niveles de ese contador le afecta, tenga ficha o no: los muertos vivientes y los constructos de 5e, inmunes al agotamiento.

  Los modificadores, los niveles y los efectos de prueba necesitan Capability API 1.45.

- `checks` y `contests`: opcionales. Lo que lee un enfrentamiento y los enfrentamientos que cualquiera puede iniciar en un combate: agarrar, empujar, liberarse. Consulta Enfrentamientos, más abajo. Capability API 1.43.
- `concentration`: opcional. Campo vivo `text` que registra lo mantenido, `save` exigida por el daño, `floor` mínimo de dificultad y `fromDamage`, proporción del daño que la fija si es mayor. Empezar otra capacidad de concentración termina la anterior; fallar la salvación la termina y quita los estados que mantenía.
- `dying`: opcional, `kind: "saves"`. Dos contadores de tiradas (la cantidad necesaria es el máximo de cada uno), `dice`, `succeedAt`, efectos de caras extremas (`naturals.max`: `revive-1` o `success`; `naturals.min`: `one-failure` o `two-failures`), coste de daño estando caído (`damageWhileDown`, `criticalWhileDown`) y `condition` del personaje caído. Sin bloque, salud cero solo lo deja caído y curar lo devuelve.
- `damageTypes`: opcional. Tipos del sistema, comparados sin distinguir mayúsculas.
- `damageKinds`: obligatorio si `health` es un contador de heridas y rechazado si es una reserva; solo una marca conserva un tipo. Define qué `kinds` marca cada golpe y cuántas casillas. `default` recibe lo no asignado, incluido daño sin tipo; `byType` asigna `damageTypes` a tipos de marca, ignorando mayúsculas: `"Fire"` y `"fire"` son una clave y declarar ambas se rechaza. `marks` no tiene predeterminado porque las respuestas son opuestas: `"per-point"` cuenta niveles de salud según daño, así que tres de daño marcan tres casillas y reducirlo ayuda; `"per-blow"` marca una casilla si el golpe acierta, sea cual sea su fuerza. Un golpe con varias cláusulas marca una casilla usando el tipo más grave que llegó. Indica cuál usa el sistema: `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool`: obligatorio en `dice-pool` y rechazado en `attack-vs-defense`. Consulta Un combate tirado con reservas.
- `spendLimits`: opcional. Cuánto de una reserva viva puede gastar un combatiente por `turn` o por `round` en un combate, sea del tipo que sea: `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max` se lee una vez al empezar el combate. Un coste que supera lo que queda del límite no se puede pagar, así que queda fuera del menú, por mucho que haya en la reserva. Un límite por turno vuelve a empezar al inicio del turno de su portador, y uno por ronda, al empezar una ronda. Un oponente escrito con números simples no paga nada de una ficha, así que un límite nunca le afecta; un oponente escrito como ficha paga de sus propias reservas y queda sujeto al límite como cualquier otro. Capability API 1.47.
- `threat`: opcional y necesario para bestiarios. `tiers` es la escala de adversarios: ID, etiqueta, intervalo `health`, `defense`, `toHit`, intervalo `damagePerRound` y `saveDifficulty`. Cada criatura nombra un nivel; un adversario no escrito se adapta al que pidió el GM, sin salirse de tu escala. `damagePerRound` expresa lo que hace a UN objetivo por ronda, incluida toda su secuencia.

### Salvaciones contra estados, daño o magia (Capability API 1.134)

Un modificador con `to: "saves"` puede llevar `against`. Necesita al menos uno de `conditions` (IDs de estado de la ficha), `damage` (tipos de daño) o `magic: true`. Basta con una coincidencia cualquiera; `saves` sigue restringiendo qué salvación, como una condición Y adicional. Usa el `mode: "advantage"` del modificador, no `effects`, para restringir la ventaja de esta forma. Estos modificadores funcionan en estados, en niveles de contador o derivados alcanzados y en efectos de objetos. Para los rasgos de raza, deriva un valor de la raza elegida en la ficha y vincula el modificador a un nivel que se alcanza cuando ese valor es 1. Modificadores de ejemplo:

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

Brave usa `conditions: ["frightened"]`. Magic Resistance usa `magic: true` sin `saves`, en un nivel derivado de la ficha o un nivel de contador de una criatura. El `applies` de una acción cuenta aunque la salvación evite el estado; su daño incluye cada cláusula `plus`. Los nombres de daño se comparan sin distinguir mayúsculas de minúsculas. La magia es la cualidad `"magical"` de 1.101: las `mechanics.qualities` de un catálogo (incluso sin daño), el `damage.qualities` de la acción de una criatura o las etiquetas de un objeto arma. Un conjuro debe llevar esa cualidad; su nombre o su catálogo por sí solos no lo hacen mágico. Una salvación para terminar un estado, incluidos `saveWhenDamaged` y `saveEnds.at: "damaged"`, es solo contra ese estado. Las salvaciones de concentración y de muerte no son contra nada. Fuera del combate, las peticiones de salvación del Game Master no llevan un origen ni un estado estructurados; `against` nunca coincide con esas peticiones. La ficha, los detalles del objeto, los detalles de la batalla y el resumen de la ficha del Game Master muestran estas restricciones. Requiere schemaVersion 2 y capabilityApi 1.134 o posterior.

### Un combate tirado con reservas: `dice-pool`

Un conjunto `dice-pool` cuenta éxitos en vez de sumar dados, y sus combates también pueden hacerlo. `"kind": "dice-pool"` necesita que `resolution.kind` sea `"dice-pool"`, y lee la ficha como ya lo hacen tus pruebas de reserva: **cada número que suma una tirada es una cantidad de dados, y cada número con el que se compara es una cantidad de éxitos.** Así que no se renombra nada:

- Un número para acertar (el de una fila de ataque, el `toHit` de una lista de capacidades, el de una acción de criatura) es la reserva que tira un ataque. El dado, el objetivo que debe alcanzar un dado y las caras con las que se duplica, explota, cancela y pifia son las de tu `resolution`. El contador de heridas que nombra tu `resolution.penaltyFrom` resta su penalización de la reserva, igual que en una prueba.
- `defense` es cuántos éxitos necesita un ataque, y nunca menos de uno. El modificador de un estado a `defense` y la cobertura (`cover.bonus`, o `cover.threeQuarters`) se suman a ella.
- Cada éxito por encima de los necesarios añade un dado de daño. Una pifia falla, cuente lo que cuente. No hay críticos: un impacto fuerte vale sus dados extra.
- El número de una salvación es su reserva, y su dificultad, los éxitos que necesita. Un enfrentamiento tira la prueba de cada bando como reserva, y gana el bando con más éxitos.
- El modificador de un estado a ataques, salvaciones o pruebas son dados que se añaden o se quitan, así que es un número `flat`: un modificador tirado (`dice`) se rechaza.
- El daño son dados de tu dado: los `dice` de una cantidad (de una criatura, de una entrada) indican cuántos y deben ser de tu dado, y su parte `flat` son éxitos automáticos, que nunca se tiran. La columna de dados de daño de una fila de ataque se lee por su cantidad, `damage.ability` añade como dados la puntuación de ese atributo y `damage.bonus` añade éxitos automáticos. `perCostStep` y `scales` añaden dados, como siempre. La curación y los puntos temporales son cantidades, y se suman como antes.
- La iniciativa es una suma (`initiative.dice` y `modifier`), o una reserva si la pides (`initiative.pool`, abajo), y una regla de muerte conserva sus propios dados.

Lo que tira un combate de reservas más allá de eso es su bloque `pool`:

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage`: si una tirada que se inclina se tira dos veces y se conserva la que tiene más éxitos (una pifia cuenta como menos que cualquier tirada que no pifió). Sin él, un combate tira una vez diga lo que diga un estado.
- `damageTarget`: el objetivo por dado contra el que se tiran los dados de daño y de absorción. El objetivo predeterminado de tu resolución si lo omites. Esos dados cuentan una vez cada cara igual o superior a él y nada más: con ellos nada se duplica, explota, cancela ni pifia.
- `soak`: lo que un objetivo resta del daño que hace un impacto, por tipo de daño. `all` es una referencia de valor para cualquier tipo, y `byKind`, una por cada tipo de tu contador de salud, que tiene prioridad sobre `all` para su tipo; un tipo que no nombra ninguno de los dos no se absorbe. Con `"roll": true`, el objetivo tira esa cantidad de dados contra el objetivo de daño y cada éxito resta uno. Con `"roll": false`, el número se resta de los dados de daño antes de tirarlos, así que nunca afecta a los éxitos automáticos, que la absorción tirada resta como cualquier otro. Nada baja de cero, y no se tira nada para absorber un golpe que no contó nada. Una criatura da sus propios números como `soak: { "all": 1, "byKind": { "knock": 3 } }`, lo que necesita que el `soak` del bloque indique cómo se absorbe. La resistencia, la vulnerabilidad, la inmunidad y `resist-all` se aplican después de la absorción, a lo que queda.
- `hardness`: una referencia de valor para la dureza de un combatiente, si la iniciativa es un número que mueven los ataques. Consulta [Armadura y efectos puestos en un combate](#armor-and-worn-effects-in-a-fight).

El daño de cada objetivo se tira para ese objetivo, porque lo que ganó un impacto por encima de los éxitos necesarios, y lo que absorbe, es suyo. La segunda cláusula de un golpe y un efecto adicional son cada uno su propia reserva de daño de su propio tipo, sin dados extra del impacto. El menú prevé una reserva con exactitud: la probabilidad de alcanzar los éxitos necesarios y lo que valen los dados de daño después de lo que absorbe el primer objetivo.

Gravewatch está escrito así: sus guardianes tiran una puntuación y un oficio, absorben los golpes contundentes con Sinew y no absorben en absoluto los desgarros, pueden gastar un punto de Resolve por turno y vuelven a tirar la iniciativa cada ronda.

**Declarar en orden inverso no está implementado.** Algunos sistemas hacen que todos declaren su acción antes de que nadie actúe, empezando por el más lento. En un combate donde cada combatiente elige una acción cuando llega su turno, declarar primero no cambia nada que lea ninguna regla, así que no hay nada que pueda decir una clave.

### Dados de daño mínimos (Capability API 1.146)

Un combate de reservas puede conservar dados incluso contra una absorción alta, como hace el **Overwhelming** de Exalted:

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

Esto es `combat.damage.minimum`, una referencia de valor que se lee de la ficha actual del **atacante**. Después de que la absorción estática quite dados a la primera reserva de daño de un impacto, la reserva sube al menos hasta este número. Son dados enteros, redondeados hacia abajo y limitados entre cero y `resolution.pool.max`, no éxitos automáticos: cada dado que sobrevive puede fallar. La absorción tirada sigue quitando éxitos después de la tirada de daño; no reduce una reserva de dados, así que el mínimo no protege los éxitos frente a ella. La resistencia y la inmunidad se siguen aplicando. Los golpes que gastan iniciativa ignoran el mínimo, igual que ignoran el daño del arma y la absorción; los golpes que quitan iniciativa lo usan.

Un arma puede sustituir el mínimo común con `item.attack.damage.minimum`. Acepta las mismas referencias de valor sobre quien la sostiene, o `{ "stat": "overwhelming" }` para una de las estadísticas numéricas propias del objeto. Un cero declarado también sustituye al mínimo común. Esto es distinto del `floor` de arma existente, que garantiza una cantidad de daño después de la absorción. Las cláusulas de daño adicionales y los efectos adicionales no reciben otro mínimo. El registro del combate y el diario muestran el mínimo resuelto junto a los dados. Tanto la clave de combate como la clave del arma requieren **Capability API 1.146** en un paquete, incluidas las armas de archivos de catálogo externos.

### Un impacto que aturde (Capability API 1.147)

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze` es para los combates de reservas. `over` lee la ficha actual del **objetivo**, justo antes del impacto. Un solo impacto debe infligir **estrictamente más** daño que ese número, después de la absorción, las salvaciones y la resistencia. Sus cláusulas de daño cuentan juntas; los impactos separados nunca se acumulan para aturdir. En un contador que marca por golpe, un impacto que causa daño cuenta como un nivel. Un golpe que quita iniciativa en vez de salud no puede aturdir. Por ahora, `measure` solo es `"damage"`.

El objetivo se salta exactamente su siguiente turno. Los impactos que aturden antes de ese turno no acumulan más turnos saltados. El turno saltado sigue haciendo avanzar los relojes de los estados y el resto de la contabilidad de turnos, incluidos los cambios de ronda y la iniciativa que se vuelve a tirar. Guardar y volver a cargar el combate conserva el salto pendiente. `condition`, cuando aparece, nombra un estado declarado de la ficha. El combate lo marca hasta que pasa el turno saltado o termina el combate. Un estado que ya estaba presente se deja como está; la inmunidad al estado impide la marca, pero no el salto. `text` es una narración opcional, no otro efecto. El registro y el contexto de combate del Game Master registran el impacto y el salto. La clave requiere **Capability API 1.147**.

### El objetivo elige el tipo de herida (Capability API 1.148)

Añade `remap` a la asignación existente `combat.damageKinds`; conserva su `default`, `byType` y `marks`:

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

Un combate de reservas elige primero el tipo del ataque con su asignación normal y después lee el `when` de cada reasignación en el **objetivo**. Un número distinto de cero activa la regla. `from` y `to` deben ser tipos del contador de heridas de salud. Gana la primera regla que coincide; las reasignaciones no se encadenan. Se pueden dar como máximo 12. Con `tags`, al menos una debe coincidir con el ataque: un arma ya lleva `item.tags`, y las mecánicas de catálogo y el daño de las criaturas ya llevan `qualities`. Estos nombres proceden de `items.tags`. Sin `tags`, puede coincidir cualquier ataque de ese tipo. No hace falta ningún campo nuevo de etiqueta de ataque.

El tipo resultante decide tanto la **absorción** como las marcas de herida. Así, el impacto letal de un arma de fuego puede volverse contundente contra un vampiro y usar la absorción contundente; la misma arma de fuego contra otra persona, o una hoja contra ese vampiro, conserva su tipo normal. El _tipo_ de daño original del ataque no cambia para la resistencia y la inmunidad. Cada cláusula de daño usa su propio tipo y las etiquetas del ataque. El registro del combate y el diario muestran los tipos original y reasignado, y la previsión de daño lee la misma regla. Una criatura simple sin ficha puede cumplir una referencia constante, pero no puede aportar valores de ficha para estas reglas; dale una ficha de criatura para eso. Solo la nueva clave `remap` requiere **Capability API 1.148**; las asignaciones de tipos de daño anteriores mantienen su compatibilidad actual.

### Iniciativa que mueven los ataques

Algunos sistemas de reservas mantienen la iniciativa como un número durante todo el combate y permiten que los ataques la muevan: una forma de atacar se la quita al objetivo, otra gasta la del propio atacante como daño, y quien cae hasta una línea fijada se derrumba. Un combate `dice-pool` puede expresarlo (Capability API 1.48):

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

- **La apertura.** Todos tiran `pool` dados al empezar el combate, y los éxitos más `plus` son su número, así que `resource` necesita `pool`: los dados sumados son un orden, no una cantidad de dados. El `initiativeModifier` de una criatura es su reserva, porque cada número que suma un combate de reservas son dados. El número se conserva: nunca se vuelve a tirar (`each` se rechaza junto a `resource`), y al empezar cada ronda el orden se ordena según los números tal como estén.
- **Estilos.** Cada ataque (una fila de ataque, una capacidad o entrada de catálogo que tira para acertar y causa daño, una acción de criatura que lo hace y una acción formada por otras acciones) se ofrece una vez por estilo, y un jugador elige el estilo antes que el objetivo. Hasta cuatro, cada uno toma o gasta, y al menos uno toma. Una elección que no nombra ningún estilo se hace en el primero; se rechaza una en la que no se ofrece el ataque. Un ataque conserva el estilo con el que se hizo hasta que termina, aunque una respuesta cambie el número de quien lo hace antes de que impacte.
- **Un estilo que toma.** Al impactar, el daño se tira como siempre (los dados extra del impacto, los dados del arma, la absorción por tipo, los éxitos automáticos), y lo que cuenta se resta del número del objetivo en vez de su salud. El atacante gana todo eso más `gain`.
- **Un estilo que gasta.** Solo se ofrece mientras el número del atacante esté por encima de la línea de derrumbe (0 si no das `crash`), y nunca para una acción formada por otras acciones, porque un número se gasta en un solo golpe. Al impactar, el daño es el número del atacante en el momento de hacer el ataque, en dados contra el objetivo de daño, y nada más: sin dados del arma, sin dados extra del impacto, sin éxitos automáticos, sin absorción. Marca la salud con el propio tipo de daño del ataque. Una vez terminado el ataque, un número que impactó en alguien vuelve a `base`, y uno que no impactó en nadie pierde lo que indica `onMiss` según el número con el que se hizo (una tabla por peldaños: pares `[at least, lose]`, ascendentes; nada por debajo del primer peldaño).
- **Derrumbarse.** Un número que cae hasta `crash.at` o por debajo se ha derrumbado: se le aplica la `condition` (uno de tus propios estados, y opcional), y quien lo llevó hasta ahí gana `bonus`. Un fallo que derrumba a quien lo hizo no da bonificación a nadie. Un combatiente derrumbado no puede gastar. El derrumbe se levanta, estado incluido, cuando su número vuelve a superar la línea, después de `recoverAfter` de sus propios turnos (su número vuelve a `base` al empezar ese turno) y cuando termina el combate, termine como termine. Alguien cuya tirada de apertura esté en la línea o por debajo empieza el combate derrumbado. `base` debe estar por encima de `crash.at`, o volver a él lo derrumbaría de nuevo.

El menú muestra la previsión propia de cada estilo: la probabilidad de impactar, y lo que tomaría un estilo que toma o el daño que haría uno que gasta. El panel de estado muestra el número de todos, y el registro indica cada cambio y su motivo: "Ada gains 5 initiative for crashing Rats, and is on 14." El selector del motor evalúa un golpe que toma con un turno de antelación: tomar y después gastar frente a gastar ahora y de nuevo desde la base.

<a id="what-a-fight-reads-from-mechanics"></a>

### Qué lee un combate de `mechanics`

`kind` determina si `amount` es daño o curación; cualquier entrada marcada como `reaction` queda fuera del menú, al igual que una entrada `utility`, salvo que cambie lo que puede contener el propio turno (véase más abajo). `attackRoll` realiza una tirada contra la defensa del objetivo con el `toHit` de la lista; `autoHit` omite por completo ese paso. `save` tira la salvación del propio objetivo contra la `saveDifficulty` de la lista, y `onSuccess` determina si un éxito recibe la mitad o nada. `targetCount` indica a cuántos objetivos puede dirigirse. Una capacidad que no tira para atacar (un área contra la que todos realizan una salvación, algo que impacta directamente) tira sus dados UNA VEZ para todos ellos; una que tira para impactar a cada objetivo vuelve a tirar sus dados por cada impacto. `applies` impone condiciones a lo que afecta, cada una con una `duration` de `instant` (sin reloj propio: permanece hasta que algo la retire), `until-save` (que necesita `saveEnds` a su lado) o `{ "rounds": n }`, y un `saveEnds` opcional que identifica la salvación y si se repite en `turn-end` o `turn-start`. Las rondas descuentan los turnos propios del portador a medida que termina cada uno; `{ "rounds": 1, "at": "turn-start" }` los cuenta a medida que empieza cada uno, que es como se dice "hasta el inicio de tu siguiente turno". `"of": "source"` (Capability API 1.119) cuenta en su lugar los turnos de quien lo aplicó, empezando por el siguiente, que es como se dice de otra persona "hasta el final de tu siguiente turno". El `{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }` de Guiding Bolt da ventaja a la siguiente tirada de ataque contra su objetivo antes del final del siguiente turno del lanzador. Si el origen sale del combate, las rondas se cuentan en los propios turnos del portador. Los `delays` de un estado de combate (Capability API 1.120) retienen lo que usa quien lo tiene: una acción de uno de sus `catalogs`, pagada con su `budget`, tira un dado de `chance.sides` y, con `chance.atLeast` o más, todavía no ocurre. Al empezar el siguiente turno de quien lo tiene, se completa con ese mismo presupuesto y sigue como habría seguido, respuestas incluidas, y si no puede actuar o no le queda nada de ese presupuesto, se pierde. Lo que costó sigue gastado en ambos casos. El Slow de 5e es `"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`. `endsAfter` quita el estado tras el primer `own-attack` (la siguiente tirada de ataque del portador), `attacked` (la siguiente tirada de ataque contra el portador) u `own-save` (la siguiente salvación del portador), diga lo que diga su reloj, así que `{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }` es "en su siguiente ataque antes del final de su siguiente turno". Uno que dura un ataque dura todo el ataque, daño incluido, y uno nuevo que aplica el mismo golpe se queda. Ambos necesitan Capability API 1.45. `temporary` concede puntos temporales a la reserva de salud, que nunca se acumulan: se conserva la protección mayor. `scales` aumenta la cantidad con los DADOS adicionales que su tabla indica para el valor que lee. `cost` se paga mediante el comando `use` de la propia ficha, y `budget` sustituye qué parte de la economía se consume.

`plus` contiene hasta tres cantidades MÁS en el mismo golpe, junto a `amount`, cada una con su propia tirada y tipo ("and 2d6 fire"). Una cláusula es `{ "dice": "2d6", "flat": 1, "type": "fire" }` y puede llevar su propia `save`, `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`, que tira el OBJETIVO con independencia de lo que ya le haya exigido la acción: `none` elimina toda esa cláusula con un éxito y `half` deja la mitad, mientras que el resto del golpe no cambia en ninguno de los casos. Sin `difficulty`, utiliza el número de la salvación de la propia acción y, después, la `saveDifficulty` de la lista. Un crítico duplica los dados de cada cláusula con la misma regla que duplica los de la primera cantidad; una cláusula sin `type` utiliza el tipo de daño del propio golpe, y el golpe completo sigue siendo UNA prueba de concentración, con el daño sumado, y una prueba para caer. Una cláusula necesita un `amount` al que acompañar, y un `heal` no lleva ninguna.

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

Tres claves indican qué hace una entrada con la economía del propio turno, y una entrada `utility` que declare cualquiera de ellas se ofrece en lugar de descartarse:

- `free`: no consume ningún presupuesto. Sigue pagando el `cost` que indique y no puede indicar también un `budget`.
- `gives`: `[{ "budget": "action", "count": 1 }]`, hasta cuatro. Usarla añade esos presupuestos en ese mismo momento, con un límite igual a lo que contiene un turno más lo concedido, para que nada pueda ahorrarse para un turno posterior.
- `standard`: `{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`. Su poseedor puede realizar esas acciones estándar con ESE presupuesto. Se ofrecen junto a las ordinarias como `standard:<id>@<budget>`, y la propia entrada queda fuera del menú cuando solo concede ese permiso, porque un permiso no es algo que se ejecute.

Una entrada del nuevo `kind: "rider"` es PASIVA: nadie la ejecuta, nunca aparece en el menú y añade automáticamente una cláusula de daño al primer impacto que cumpla los requisitos en un período. Lleva `rider` y nada más que pueda ejecutarse:

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

`sources` identifica las listas de ataques de las que procede y `requires` una columna de sus filas con valor verdadero, de modo que un efecto adicional que solo se activa con ciertas armas puede especificarlas sin que Engine sepa qué es un arma; no indicar ninguna significa cualquier impacto de su poseedor. Un arma empuñada desde la bolsa no es una fila, así que `weapons` (Capability API 1.70) nombra además las propiedades de objeto con las que se activa: `"weapons": { "tags": ["finesse", "ranged"] }` se activa con un impacto de un arma empuñada que tenga cualquiera de esas propiedades, incluido su golpe con la mano secundaria. Nombrar solo `weapons` no se activa con ninguna fila, y nombrar solo filas no se activa con ninguna arma empuñada. `when` acepta CUALQUIERA de sus opciones: `advantage` es la inclinación final de la tirada de ataque, y `ally-adjacent` es un aliado del atacante que esté en pie y pueda actuar, a una casilla del objetivo en un tablero o en cualquier lugar si no hay tablero. `ally-adjacent-no-disadvantage` (Capability API 1.126) exige además que la tirada final no tenga desventaja una vez que la ventaja y la desventaja se anulan; el ejemplo anterior lo usa para Sneak Attack. `oncePer` es `turn` (se renueva al inicio de todos los turnos, de modo que un golpe realizado mientras actúa otra persona todavía puede incluir uno) o `round`. `amount` crece con el `scales` de la propia entrada, y `type` es el tipo de daño, cuyo valor predeterminado es el del propio golpe.

<a id="creatures-a-bestiary-a-fight-reads"></a>

### Criaturas: un bestiario que lee el combate

Un catálogo que declara `"holds": "creatures"` contiene oponentes en lugar de filas de ficha. No alimenta ninguna lista, el selector del editor de fichas nunca lo ofrece y todos sus números se escriben con las claves que ya declara tu bloque `combat`. Necesita un bloque `combat` y una escala `threat`, porque cada criatura se clasifica en uno de tus propios niveles.

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

Los números siguientes son la forma directa de escribir una criatura. Una escrita en los términos de tu propio conjunto de reglas, como `sheet`, obtiene de esa ficha `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`, `checks`, `soak` y `hardness` (véase "Una criatura escrita en los términos de tu conjunto de reglas", más abajo).

- `health`: un número, o `{ "dice": "3d6", "flat": 2 }`, que se tira una vez al crear el combate. Una previsión lee la media, de modo que un menú nunca promete un dado que nadie ha tirado.
- `defense`, `initiativeModifier`, `speed`: contra qué se tira un ataque, qué se suma a la iniciativa (o, si la iniciativa se tira como reserva, cuántos dados tira) y cuánto camina en un turno, en tu propia unidad de distancia.
- `abilities` y `saves`: usan como claves los identificadores de características y salvaciones que declara tu ficha. Una salvación no indicada se lee como cero.
- `checks`: lo que suma en un enfrentamiento, con los IDs de `combat.checks` como claves. Uno no indicado se lee como cero. Capability API 1.43.
- `soak`: solo en un combate `dice-pool`, lo que absorbe: `all` para cualquier daño, `byKind` para un tipo de tu contador de salud. Capability API 1.47.
- `hardness`: si la iniciativa es un número que mueven los ataques, un golpe que gasta cuyos dados están por debajo de ella no hace nada. Capability API 1.56.
- `speeds` y `hover`: cómo se mueve además de caminar (consulta Otras formas de moverse, en Posiciones). Capability API 1.113.
- `shield: true`: tiene las manos ocupadas, así que no se aplica la alternativa `twoHanded` de una acción. Capability API 1.102.
- `size`: uno de los `combat.sizes`, por ID, que lee el `maxSizeAbove` de un enfrentamiento (consulta Tamaños y CD de escape). Capability API 1.103.
- `type` y `tags`: uno de los `combat.creatureTypes.types` y hasta ocho de sus `tags`, por ID, que leen las pruebas de objetivo (consulta Tipos de criatura y pruebas de objetivo). Capability API 1.168.
- `resist`, `vulnerable`, `immune`: tipos de daño, comparados sin distinguir mayúsculas, que se validan contra `combat.damageTypes` cuando declaras alguno. Una entrada `resist` o `immune` también puede indicar qué la atraviesa, `{ "type": "tearing", "except": ["silver"] }`: un golpe de un objeto arma con una de esas propiedades de objeto se recibe tal cual (Capability API 1.55, consulta [Armas en un combate](#weapons-in-a-fight)), igual que una acción cuyo `damage.qualities` o una entrada de catálogo cuyas `mechanics.qualities` nombren una (Capability API 1.101). `conditionImmunities` identifica tus propias condiciones, o un contador que leen tus `combat.levels` (Capability API 1.115).
- `tier`: a qué peldaño de `combat.threat` pertenece.
- `loot` (Capability API 1.63): el ID de la tabla de botín que tira un combate ganado por ella (consulta Botín, más arriba).
- `traits`: pares breves de nombre y texto que se muestran al Game Master. Nunca se resuelven, por lo que cualquier cosa con números pertenece a una acción.
- `signaturePoints`: puntos que se recuperan al inicio de su propio turno y se gastan en acciones `signature`.
- `riders`: hasta cuatro, equivalentes al `rider` de una entrada de catálogo, escritos en el bloque. Cada uno es `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, con un `type` opcional y un `actions` opcional que indica con cuáles de las acciones del propio bloque se activa. El efecto adicional de un bloque no lee ninguna lista de ficha, por lo que no tiene las claves `sources` y `requires`. Una criatura escrita como ficha obtiene los efectos adicionales de sus listas, exactamente igual que un personaje.
- `actions`: hasta doce, cada una con su propio `id`. Una acción lleva lo mismo que un bloque de estadísticas escrito a mano (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), más cuatro cosas exclusivas de las criaturas. `reach` indica hasta dónde golpea, `range` hasta dónde se lanza o dispara y `area` la forma en la que impacta, todo en tu propia unidad de distancia; `range` puede ser un número simple o `{ "normal": 30, "long": 120 }` si llega más lejos con una penalización, y `area` es `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (véase Posiciones):
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. Cuando se agotan, la acción sale del menú.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Empieza el combate disponible, se gasta al usarla y se tira al inicio del propio turno de la criatura: `from` o más la recupera. El registro incluye los dados en ambos casos.
  - `damage.alternatives` (Capability API 1.102): hasta cuatro cantidades que inflige en lugar de la primera, cada una `{ "when": ..., "dice": "1d10", "flat": 3 }`; gana la primera que se cumple. El tipo, las cláusulas y las cualidades siguen siendo los de la acción. `"when": "twoHanded"` se cumple salvo que la criatura tenga `"shield": true`, que es el "o 8 (1d10 + 3) de daño cortante si se usa a dos manos" de 5e; `"when": { "selfHealthAtMost": 0.5 }` se cumple mientras su salud sea como máximo esa parte de su máximo, que es el "o 5 (2d4) de daño perforante si al enjambre le quedan la mitad de sus puntos de golpe o menos" de un enjambre. La previsión del menú y el golpe la leen tal como está.
  - `sequence`: otras acciones del mismo bloque, en orden, cada una con su propio objetivo. **Así se escribe una criatura que golpea dos veces con una sola acción.** Un presupuesto paga toda la secuencia. Una secuencia no lleva nada propio y nunca puede identificar otra secuencia.
  - `signature`: `{ "cost": n }`, se compra con los puntos de la propia criatura en lugar de un presupuesto y solo mientras actúa otra persona: el combate la ofrece en la ventana entre un turno y el siguiente (véase Ventanas).
  - `reaction`: el mismo objeto que el `mechanics.reaction` de una entrada de catálogo (consulta Ventanas): la acción no está en el menú de ningún turno y se ofrece en su lugar en el momento que nombra. Una reacción no es también una acción distintiva, y ninguna secuencia puede crear una.
  - `self: true`: recae sobre la propia criatura en vez de sobre otra persona, así que no lleva `targetCount` ni `area`. Ambos necesitan Capability API 1.46. Una Parry es ambas cosas, con un estado `parrying` que suma 2 a la defensa:

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
- Una salvación necesita una dificultad en la propia acción: `save.difficulty` para una salvación que impone la acción, o `saveDifficulty` para una condición que termina con una salvación cuando la acción no tiene la suya propia. Una acción de bloque se escribe con números simples incluso en una criatura con ficha, así que ese número reside en la acción. La salvación de una cláusula puede omitir su `difficulty` y recurrir al mismo número.
- `damage.plus` es la misma lista de cláusulas que el `plus` de una entrada de catálogo y se lee exactamente igual: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` es un mordisco cuyo calor tiene su propia cantidad, a la que se aplica resistencia y que se duplica por separado.

Una acción de criatura puede devolver puntos de golpe con `heal` (dados, una cantidad fija o ambos), limitados al máximo de su objetivo. `targets: "ally"` alcanza a su propio bando, incluida ella misma; `targets: "any"` alcanza a cualquiera de los dos bandos. Sin `targets`, alcanza al otro bando como antes. Estas claves necesitan Capability API 1.121. Una curación no lleva `damage`, `toHit`, `save` ni `area`; `targets` no acepta `self` ni `sequence`, y una secuencia no lleva ninguna de las dos claves. El Healing Touch de un deva es:

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

El `spellcasting` de una criatura (Capability API 1.123) lanza conjuros de catálogo sin gastar espacios ni puntos. Su `saveDifficulty` y su `toHit` aportan los números del conjuro; una criatura con `sheet` puede omitirlos para usar los números de lanzamiento de conjuros de su ficha. Una criatura simple debe aportar cualquier número que necesiten sus conjuros. Cada `entry` nombra una entrada de catálogo existente con `mechanics`. Si se omite `uses`, es a voluntad; `level` es el nivel de lanzamiento para escalar con `perCostStep`, o la base de la entrada si se omite. La entrada sigue aportando su presupuesto, sus objetivos, su concentración, sus reacciones, sus áreas y sus invocaciones. La lista de una dríade podría escribirse así; estos IDs de conjuro son ilustrativos y deben aportarse en un catálogo `spells`:

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

Para un aquelarre de brujas, añade `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }` junto a `spells` y `"coven": true` en cada conjuro compartido. Esos conjuros solo se ofrecen mientras al menos tres combatientes en pie del bando del lanzador lleven ese ID de aquelarre, cada uno a 30 unidades de distancia del conjunto o menos del lanzador, medidas en casillas sin más. Sin tablero, cuentan todos los miembros en pie. Los usos de cada conjuro son una reserva compartida por todo el aquelarre, identificada por el ID del aquelarre y la entrada. Un bloque de aquelarre necesita un conjuro de aquelarre y un conjuro de aquelarre necesita el bloque; se rechazan las entradas duplicadas. Una criatura que propone el Game Master pierde `spellcasting` al ajustarse, porque una escala de amenaza no puede limitar una lista de conjuros.

El bestiario del borrador de 5e contiene cinco criaturas escritas a mano en `docs/development/ruleset-5e-2014.example.json`, que cubren una secuencia, una recarga, una salvación con una condición, resistencias e inmunidades, usos limitados, puntos de acciones distintivas y una criatura escrita como ficha.

#### Una criatura escrita en los términos de tu conjunto de reglas

Una criatura no tiene que escribirse con números simples. Dale una `sheet`, con exactamente la misma estructura que la ficha de un personaje, y el combate la construye igual que a un miembro del grupo: su salud, defensa, salvaciones, iniciativa, velocidad y todos los ataques y capacidades de sus listas son lo que determinen tus propias fórmulas de ficha. Así expresa un conjunto de reglas que sus oponentes tienen las mismas características, habilidades y listas que sus personajes, sean cuales sean. El Toll Warden de Ember Roads:

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

- **Todas las partes son opcionales**: `abilities`, `skills`, `saves`, `bonuses`, `fields` y `lists`, con los identificadores que declara tu ficha como claves. Lo omitido se lee con el valor predeterminado de tu ficha, exactamente como en un personaje en blanco. El Grit del guardián es 9 porque tu `grit_max` suma 4, su Toughness y su Brawn, y su Guard es 7 por una razón semejante.
- **Cada número tiene un único origen.** Una criatura con ficha no proporciona también `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves` o `checks`, y Engine rechaza el archivo si lo hace. Puede no tener `actions` propias, porque sus listas son lo que hace. Una criatura sin ficha sigue proporcionando los tres primeros y al menos una acción.
- **Se valida como los datos de autoría que es.** Cada identificador debe estar declarado en tu ficha; una habilidad o salvación se establece en uno de los niveles de competencia que ofreces para ella; un campo, puntuación, bonificación o columna contiene lo que declara admitir (un entero dentro de su intervalo, uno de sus valores, etc.), y una lista no contiene más filas de las permitidas. No hay parte `live`, porque el combate guarda lo que la criatura ha gastado.
- **Una fila puede proceder de un catálogo.** `_catalog: "<catalog>/<entry>"` identifica la entrada de la que se seleccionó una fila, como en la ficha de un personaje, y el combate lee de esa entrada qué cuesta y qué hace la fila. El catálogo debe alimentar esa lista. Cuando el catálogo está escrito en línea, la entrada debe existir en él; cuando reside en su propio archivo, una fila que identifica una entrada ausente del archivo simplemente no concede nada a la criatura. Los catálogos que identifican las fichas de un bestiario se cargan para el combate junto con el bestiario.
- **Lo que la entrada declara junto a la ficha sigue contando**: `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune` y `conditionImmunities`.
- **Paga de sus propias reservas.** Empiezan llenas, las gasta en lo que le proporcionan sus listas y se le ofrecen las formas de pago mayores (un conjuro con un espacio superior) exactamente como a un miembro del grupo, tanto si decide Engine como si decide el Game Master. Hold the Line le cuesta Luck al guardián.
- **Con un contador de heridas, su salud es el contador.** Un golpe marca el contador propio de la criatura según tus `damageKinds`, después de aplicar sus `resist`, `vulnerable` e `immune`, por lo que una criatura inmune a un tipo de daño no recibe ninguna marca de él.
- **Sigue siendo un oponente.** A cero queda fuera de combate en lugar de agonizar; nunca tira contra la muerte; la pantalla muestra lo que siempre mostraba de un oponente y nada de su ficha, y no se escribe lo que haya gastado en ningún otro lugar, ni siquiera cuando un personaje comparte su nombre.
- **Una ficha cuya salud total sea cero** queda fuera del combate, y el registro inicial explica el motivo, en lugar de introducir algo a lo que nadie puede dañar.
- Una capa que retire un valor de uno de tus campos enumerados nunca elimina a una criatura que lo utilice: mientras la capa esté activa, ese campo toma su valor predeterminado para la criatura, exactamente como para un personaje, y no se rechaza a la criatura por ello.
- Un Game Master también puede inventar una, que queda limitada a su nivel (véase Oponentes que nadie escribió).
- Un paquete que incluya una declara Capability API 1.34.

El Toll Sergeant del borrador de 5e es lo mismo en una ficha d20: su Armor Class, puntos de golpe, salvaciones y dos golpes por acción proceden de sus propios campos y su lista de ataques.

#### Oponentes que nadie escribió

Cuando un Game Master inventa un oponente, Engine ajusta la propuesta a tu escala `threat` antes de cualquier tirada: la salud entra en la franja del nivel; la defensa, el ataque y las dificultades de salvación se limitan a dos por encima de los del nivel, y el daño se reduce hasta que la mejor ronda de la criatura (su secuencia más potente o su acción individual más potente, medida contra un objetivo) quepa en el `damagePerRound` del nivel. Primero reduce la cantidad de dados, luego la parte fija, después un golpe de una secuencia y, solo entonces, el tamaño del dado, sin reducir nunca nada a cero. Se descartan los nombres que no contiene tu conjunto de reglas: tipos de daño, condiciones y salvaciones desconocidos, y cualquier acción después de las seis primeras. Un nivel que nunca declaraste recurre al más bajo de tu escala. Cada cambio se devuelve como una frase sencilla para que el registro pueda explicar qué se hizo.

Una invención también puede escribirse como `sheet`, igual que una criatura de bestiario; así obtiene espacios y conjuros un mago inventado. El Game Master ve los identificadores de tu ficha y lo que puede contener cada uno, las listas que lee un combate y los nombres que ofrecen tus catálogos para ellas, de modo que un conjuro se identifica en lugar de describirse: una fila que identifica una entrada de catálogo, con cualquier combinación de mayúsculas, se convierte en esa entrada, y los valores propios del Game Master (como que un conjuro esté preparado) se aplican encima. La ficha se lee con tolerancia porque la escribió un modelo: se descarta un nombre que no exista en tu conjunto de reglas, un valor se ajusta a su campo o columna y no se usan los números escritos junto a la ficha.

Una criatura inventada que no sea un jefe queda limitada a lo que le abre tu conjunto de reglas. Un filtro de catálogo con `startFrom` identifica el campo de ficha por el que se organizan sus entradas (la lista de conjuros del paquete 5e por `class`), y una criatura inventada conserva solo las entradas cuyo filtro coincide con su propio valor de ese campo, comparado como lo hace el selector al abrirse. Así, un Sorcerer nunca tiene toda la lista de conjuros, y quien no indique clase no obtiene nada de un catálogo organizado por clase. Después se completan las elecciones que dejó abiertas sin volver a consultar al Game Master: para cada lista cuyas filas solo cuentan una vez elegidas (`onlyWhen` en una fuente de capacidades de combate), entre las entradas disponibles que puede pagar con sus propias reservas, se completa cada reserva con un pequeño número de entradas (más para una criatura más competente), así como aquello que puede usar a voluntad. Lo que recibe depende de su temperamento y competencia, los mismos con los que combate: una criatura protectora o de apoyo busca lo que sostiene a su bando; una temeraria, daño; una metódica o paciente, lo que frena al enemigo; y cuanto más competente sea, más probable es que lleve una reacción, una contra o cualquier otra cosa que altere el turno. La selección utiliza la semilla del propio combate, por lo que un mismo combate siempre se completa de la misma manera. Una fila que el Game Master haya identificado de una lista así cuenta como elegida.

Un jefe queda enteramente en manos del Game Master, como excepción que puede ser: no se le quita nada ni se le completa nada.

Después, ambos quedan limitados a su nivel:

- La salud entra en la franja del nivel mediante el único campo del que se lee: el máximo de la reserva es ese campo o una `sum` con exactamente un campo (el máximo de puntos de golpe de 5e, Toughness de Ember Roads). Una fórmula de salud sin un único campo se deja como está y el registro lo indica. La longitud de un contador de heridas es tuya y nunca cambia.
- Una vez construida la criatura, la defensa, el ataque y las dificultades de salvación se limitan a dos por encima de los del nivel, y el daño se reduce hasta que su mejor ronda quepa en el `damagePerRound` del nivel, contando el mayor pago que pueda permitirse. Primero se reduce lo que compra un pago mayor, luego los dados, la parte fija, un golpe y, solo entonces, el tamaño del dado.

Tu propio bestiario nunca se limita. Son datos que escribiste tú, así que Engine los acepta tal como están.

### Posiciones: un combate sobre un tablero

Un combate se desarrolla en el teatro de la mente hasta que tu bloque indica cuánto vale una casilla de tablero. Declara `distance` y podrá librarse sobre una cuadrícula; entonces movimiento, alcance, distancias, áreas, línea de visión, cobertura y golpes contra quien se aleja empiezan a tener significado. Todos son números que escribiste tú; Engine proporciona el tablero y nada más.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
"opportunity": { "budget": "reaction" }
```

Ember Roads declara una sola línea y nada más; ese es el propósito: nada del resto es obligatorio.

```json
"distance": { "label": "paces", "perCell": 2 }
```

**La casilla.** `distance.perCell` indica cuánta cantidad de TU unidad vale una casilla, y `label` es el nombre de esa unidad. Todas las distancias del mundo del bloque la utilizan: `economy.movement`, la `speed` de una criatura, el `reach` y el `range` de un arma, y el `reach` y el `range` de una acción de criatura. Un catálogo que declare su propio `units.distance` convierte sus propios `mechanics.range` y `area.size` con su `perCell`; uno que no lo declare usa este. Una distancia mayor que cero se redondea a la casilla más cercana, nunca a ninguna, por lo que cualquier cosa a la que hayas dado un número alcanza al menos una. Cero no es una distancia corta, sino que conserva su propio significado: un `mechanics.range` de 0 es uno mismo o contacto (y tocar a otra persona alcanza la casilla siguiente), y una columna `reach` o `range` de arma con valor 0 en una fila significa que esa fila no tiene esa distancia.

**Si el combate usa un tablero.** Deben coincidir dos cosas: tu bloque declara `distance` y la partida del jugador tiene el estilo de combate Tactical. Con el estilo Classic, o con un conjunto de reglas sin `distance`, el combate sigue siendo teatro de la mente: cualquiera puede apuntar a cualquiera y no se lee nada de lo siguiente.

**Lo que ve el jugador.** Se dibuja el tablero con el terreno del propio estilo táctico. Cada casilla es un botón, accesible con el puntero o las teclas de dirección, e indica qué es, quién está en ella y qué significa para la elección parcialmente realizada. Caminar ilumina las casillas ofrecidas por el menú, cada una con su coste EN TU UNIDAD, dibuja el camino hasta ellas y marca en ámbar cualquier casilla cuyo camino provocaría un golpe de alguien, identificándolo debajo del tablero. Una opción que requiere un objetivo ilumina a quienes pueden elegirse, simultáneamente en el tablero y en la lista. Una opción con `area` apunta a una casilla, y la casilla bajo el puntero indica a quién atraparía, incluidos los aliados. Lo que queda del movimiento permitido se muestra junto a tus presupuestos, también en tu unidad. La pantalla no mide nada: el servidor envía cada casilla, coste, camino, objetivo y punto de mira.

**Movimiento.** El movimiento permitido de un turno es `economy.movement` para un miembro del grupo, o la `speed` propia de la criatura, dividido por `perCell` y redondeado HACIA ABAJO, nunca menos de una casilla mientras pueda moverse. Se repone al inicio del turno de su poseedor y puede gastarse antes, entre y después de las acciones: caminar, golpear, volver a caminar. Entrar en una casilla cuesta uno, o más si el terreno es difícil. Ocho direcciones, todas con el mismo coste, porque así se juegan las cuadrículas de mesa a las que se dirige. Se puede pasar por un aliado, pero no detenerse sobre nadie; un oponente es un muro; no se puede entrar en nada sólido ni cortar una esquina entre dos casillas sólidas.

**Otras formas de moverse** (Capability API 1.113). Los `speeds` de una criatura indican cómo se mueve además de caminar, `{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }` en tu unidad, y `"hover": true` indica que un volador no necesita moverse para mantenerse en el aire (necesita una velocidad `fly`). Las de un miembro del grupo salen de la ficha mediante `economy.movementModes`, referencias de valor con las mismas claves, como lo harían la velocidad de nado de una raza o la velocidad de vuelo de un conjuro; un cero significa que no se mueve de esa forma. `speed` y `economy.movement` siguen siendo la marcha. Sobre un tablero:

- el margen es la forma más rápida en que se mueven, y cada casilla recorrida se descuenta de todas las formas a la vez, así que una criatura que camina 30 y vuela 60 puede caminar 10 y después volar 40, y nunca caminar más de 30;
- un volador entra en cualquier casilla que no sea sólida por una casilla, incluidos el agua y un desnivel de cualquier altura;
- un nadador cruza el agua por una casilla y camina por tierra;
- un escalador supera un desnivel de cualquier altura por lo que cueste el terreno al que sube;
- la velocidad de excavación se conserva para el Game Master y se mueve como una marcha, ya que un tablero no tiene suelo por el que excavar.

Cada paso se da de la forma más barata a la que le quede suficiente. Un combate sin tablero no lee nada de esto, y quien solo camina se mueve exactamente como antes.

**Altura de vuelo** (Capability API 1.114). Sobre un tablero cuyo conjunto da `combat.elevation.levelHeight` y `combat.distance.perCell`, a un volador se le ofrecen Fly up y Fly down donde está, cada uno al coste de un nivel de su vuelo (un nivel de 5 pies en casillas de 5 pies es una casilla). Hasta 20 niveles por encima del suelo sobre el que está. Mientras está en el aire:

- solo vuela, una casilla por paso por encima de todo lo que no sea sólido;
- la distancia entre él y cualquier otro es la mayor entre la distancia en el plano y la altura entre ellos, así que una espada con 5 pies de alcance no puede tocar a un dragón a 30 pies de altura, y su mordisco tampoco puede tocar al caballero;
- tiene la ventaja de la altura sobre cualquiera que esté más bajo, como se la daría una colina;
- salir del alcance de alguien para quien está demasiado alto no provoca ningún ataque;
- si lo derriban, lo tumban o lo dejan con velocidad cero, cae al suelo de debajo según indique `falling`, salvo que tenga `hover`.

Volar hasta un terreno tan alto como él, o más, lo hace aterrizar, igual que un volador en el suelo vuela hasta lo alto de un acantilado. No hay clave nueva: un motor anterior a 1.114 mantiene a los voladores en el suelo, así que un paquete que dependa de la altura declara 1.114.

**Alcance y distancia.** Una fila de arma los obtiene de `combat.attacks[].reach` y `.range`, cada uno una columna de esa misma lista o el mismo número en todas las filas:

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

Una columna con valor 0 en una fila indica que esa fila no tiene esa distancia; así puede convivir una espada ordinaria con un hacha arrojadiza en la misma lista. Una fila sin alcance llega a una casilla. Una acción de criatura utiliza su propio `reach` o `range`, y una capacidad de catálogo utiliza `mechanics.range` (0 es uno mismo o contacto, que equivale a una casilla cuando se dirige a otra persona).

Una fila con AMBOS es un arma arrojadiza: dentro de su alcance golpea cuerpo a cuerpo y fuera dispara. Por tanto, las reglas siguientes para disparos no le afectan en la mano de alguien, y sirve para golpear a quien pasa cerca, cosa que no hace un arco.

Una acción de criatura también puede llevar el `area` en la que impacta, en tu propia unidad: `{ "shape": "cone",
"size": 15 }`, con `"friendlyFire": false` para perdonar a su propio bando. Así, un arma de aliento es un cono real sobre el tablero en lugar de un número de objetivos. Una secuencia no tiene forma propia; las acciones que identifica tienen las suyas. Un combate sin tablero ignora la forma y utiliza `targetCount`, por lo que una entrada de criatura puede llevar ambos y ser fiel en los dos casos.

**Hasta dónde se puede enviar una forma.** Lo indica `range`: una bola lanzada a cien pies lleva uno. Sin distancia, una explosión se produce donde se coloca, en la casilla del propio actor, y un cono o una línea pueden apuntar a cualquier lugar dentro de la longitud que dibujan, porque ahí la casilla solo indica su dirección. Esto se aplica tanto a `mechanics.area` de una entrada de catálogo como al área de una criatura.

`ranged` indica qué cuesta un disparo efectuado más allá de su distancia ordinaria `normal`, o con alguien del bando contrario en la casilla siguiente. Cada uno es `"disadvantage"` o `"normal"`; omite el bloque y ninguno cuesta nada. Un golpe cuerpo a cuerpo nunca es un disparo, así que ninguna regla le afecta, ni tampoco a un arma arrojadiza usada dentro de su propio alcance.

**Áreas.** El `mechanics.area` de una entrada se convierte en una forma real en el tablero, dirigida a una casilla en lugar de a alguien, y `targetCount` no determina nada: la forma decide a cuántos alcanza. Atrapa a todos los que estén en esas casillas, amigos y enemigos, salvo que la entrada indique `"friendlyFire": false`.

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

Una explosión abarca todas las casillas dentro de su tamaño alrededor de la casilla a la que se apuntó. Un cono parte del actor hacia esa casilla, con una anchura en cada paso igual a la distancia recorrida. Una línea avanza igual, con una casilla de ancho. Las tres se detienen ante cualquier cosa sólida.

Una línea en el `mechanics.area` de una entrada o en el `area` de la acción de una criatura puede llevar `width` en la misma unidad que `size`, redondeada a casillas con un mínimo de una (Capability API 1.128), por ejemplo `{ "shape": "line", "size": 60, "width": 10 }` para una línea de 60 pies que tiene 10 pies de ancho; omítelo para una casilla, y un ancho de casillas par pone su columna extra a la izquierda del lanzador.

**Línea de visión y cobertura.** Una línea recta de casillas entre ambos: un muro o una montaña en ella bloquean un disparo e impiden que un área se extienda más allá, y el objetivo simplemente no aparece en el menú. Sobre el agua se ve: un disparo cruza un río, y un área en línea continúa por encima de él. Los combates propios del motor usan la misma prueba de visión.

La cobertura se lee desde donde está el atacante, con las líneas entre esquinas de la regla opcional de cuadrícula de la DMG: desde la mejor esquina del atacante, una línea hasta cada esquina de la casilla del objetivo. Tres o cuatro líneas que atraviesan un muro o una montaña son cobertura de tres cuartos; cualquier línea que atraviese uno, o un terreno que sirva de cobertura (bosque, ruinas), es media cobertura; el terreno bajo por sí solo nunca da más de media. Un objetivo al que el atacante no puede ver en absoluto tiene cobertura total y no aparece en el menú. Contra un ataque, un objetivo que está sobre un terreno que sirve de cobertura tiene al menos media, como siempre; a una salvación solo le ayuda lo que hay entre ella y el efecto.

- `cover.bonus` es lo que suma la media cobertura a la defensa contra la que se tira un ataque, y el registro lo indica.
- `cover.threeQuarters` (Capability API 1.74) es lo que suma la de tres cuartos; sin él, `bonus` sirve para ambas.
- `cover.saves` (1.74) nombra las salvaciones a las que también ayuda la cobertura, contra la propia salvación de una acción (nunca una salvación que termina un estado o mantiene la concentración): desde donde cae una explosión, y desde su creador para todo lo demás. El registro también lo indica.
- `cover.creatures` (1.74) hace que cualquiera que esté en medio dé media cobertura, sea amigo o enemigo.
- Una salvación cuyo texto dice que el objetivo no gana nada con la cobertura (el Sacred Flame de 5e) indica `"ignoresCover": true` (1.74), en el `mechanics.save` de una entrada, en el `save` de la acción de una criatura o en el `save` del uso de un objeto.

**Altura.** Un tablero puede tener altura, hasta tres niveles, y todo combate con posiciones camina y ve según ella, diga lo que diga el conjunto: subir un nivel cuesta una casilla más, bajar no cuesta nada, un desnivel de dos niveles o más es un acantilado por el que nadie camina (y por el que no se empuja a nadie hacia arriba), y un terreno más alto que ambos extremos bloquea la visión. Al disparar hacia abajo desde un terreno más alto, la cobertura baja de en medio no oculta nada. Un conjunto indica lo que añade su sistema con `elevation` (Capability API 1.75, y necesita `distance`):

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight` es la altura de un nivel en la distancia propia del conjunto.
- `highGround` es lo que da a una tirada de ataque golpear hacia abajo desde un terreno más alto: `"advantage"`, o `{ "bonus": n }`, que se resta de la defensa contra la que se tira el ataque. Si se omite, no da nada.
- `rangeBonus` es cuántas casillas más llega un disparo desde un terreno más alto.
- `falling` es lo que hace una caída: alguien empujado desde un desnivel de dos niveles o más cae abajo y recibe `dice` por cada `per` de la caída (niveles por `levelHeight`), como máximo `max` dados, de `type`, y después recibe el estado `prone`, si lo hay. Los dados se tiran como el sistema tira el daño: sumados o, en `dice-pool`, contados como éxitos con la absorción restada. Una caída es un golpe como cualquier otro, así que puede derribar a alguien o romper su concentración. El registro indica desde cuánta altura cayó. Sin `falling`, la caída se anota y no hace nada.

**Golpes contra quien se aleja.** Declara `opportunity.budget` y, cuando un combatiente salga caminando del alcance de un enemigo en pie que pueda actuar, tenga ese presupuesto y disponga de algo cuerpo a cuerpo con lo que golpear, el movimiento se DETIENE donde está y se pregunta al enemigo si desea golpear. Aceptar gasta el presupuesto y se resuelve exactamente como el mismo ataque en su propio turno; dejarlo pasar no cuesta nada. En ambos casos, el movimiento se reanuda donde se detuvo, pagando cada casilla realmente cruzada, y un golpe que derribe a quien se mueve termina su movimiento donde cayó. Una oportunidad por enemigo para todo el recorrido, por muchas veces que el camino salga del mismo alcance. `disengage` lo impide durante el resto del turno, y un conjunto de reglas sin `opportunity` no tiene nada de esto.

La pregunta es una VENTANA y detiene todo el combate: nada más se mueve hasta que respondan todos los consultados. La ventana de un miembro del grupo la responde el jugador, con el golpe o **Pass** (pasar) a su lado; la de los demás la responde quien los interpreta, y un jefe del Game Master mediante la decisión del propio Game Master. Véase Ventanas más abajo.

**Qué hace un oponente con el tablero.** Un oponente que nadie interpreta evalúa cada casilla alcanzable frente a todas las opciones que podría tomar desde allí, resta valor por cada golpe que recibiría durante el recorrido y prefiere no moverse si ya puede hacer lo mejor desde donde está. Si no tiene nada al alcance, se acerca, y primero esprinta si tu lista `standard` incluye `dash`.

**Rechazos que puedes ver.** `out-of-reach` (más lejos de lo que alcanza), `no-line-of-sight` (algo sólido en medio), `unreachable` (una casilla cuyo coste no puede pagar el movimiento o en la que no puede terminar) y `bad-cell` (una forma dirigida a un lugar al que no puede apuntar).

### Qué hace un combate con tu bloque en el servidor

Una partida cuyo conjunto de reglas declare `combat` obtiene un combate resuelto por él, sobre la misma batalla guardada que siempre ha usado Engine:

- **Quién participa.** El Game Master indica quién combate; Engine lee los números de cada miembro del grupo en su propia ficha. Un miembro sin ficha para tu conjunto de reglas se rechaza por nombre, en lugar de recibir números que no escribiste.
- **De dónde proceden los números de un oponente**, por este orden: la criatura que el Game Master identificó en tu bestiario; luego una cuya etiqueta coincida con el nombre del oponente; después un bloque de estadísticas propuesto por el Game Master para este combate, ajustado a tu escala de amenaza; y, por último, una criatura simple construida con los números del propio peldaño. Cada alternativa y cada ajuste se registran con palabras sencillas para que el combate pueda explicar qué hizo. Un conjunto de reglas sin entrada de bestiario, propuesta ni escala de amenaza rechaza el combate en lugar de inventar uno.
- **Tus fichas son el registro.** La salud, las reservas, las condiciones, la concentración y los contadores de tu regla de agonía se escriben mediante las reglas de la propia ficha tras cada acción aceptada, de modo que recargar a mitad del combate muestra exactamente lo que dejó, sin un recuento final que pueda contradecirlo.
- **Tu menú es la única fuente de legalidad.** Todo aquel que actúa, jugador u oponente, elige un identificador del mismo menú que produce tu bloque. Un oponente controlado por Engine elige de él con las tácticas del propio Engine; a uno controlado por el Game Master se le pide elegir un identificador de ese mismo menú, mostrándole tus números sin decirle nunca qué harán los dados.
- **Tus dados.** Un combate lleva su propia semilla y un cursor, por lo que uno recuperado del disco continúa con los dados que habría tirado.

### En pantalla

El combate se desarrolla en la pantalla de batalla con tus palabras. El menú contiene tus ataques, tus capacidades, tus enfrentamientos y las acciones estándar que enumeraste, indicando cada una qué gasta de tus presupuestos y reservas. Se muestran el orden de turnos, la ronda, cada condición que identificaste con sus rondas restantes, los puntos temporales, la concentración y los dos contadores de tu regla de agonía. El registro imprime la aritmética real en tus términos: "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Cada acción aceptada se escribe en la ficha al ocurrir, por lo que recargar a mitad del combate es exacto y después se indica al Game Master que no vuelva a cambiar esos números.

Un combate con posiciones se dibuja en el tablero en lugar del escenario de retratos; véase Posiciones para saber qué hace el jugador con él. Toda distancia en él, en el menú y en el registro se expresa en TU unidad: "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Enfrentamientos: agarrar, empujar, liberarse

Algunos movimientos no son un ataque contra una defensa, sino un enfrentamiento: ambos bandos tiran y quien saca más se sale con la suya. Agarrar a alguien, derribarlo o apartarlo de un empujón y liberarse tienen la misma forma, así que un conjunto expresa cada uno como datos:

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

- **`checks`** son los números que lee un enfrentamiento, cada uno un valor de la ficha, leído una vez al empezar el combate igual que una defensa o una salvación. Una criatura escrita con números simples da los suyos (`"checks": { "brawn": 2 }`); una con ficha los lee de ella. Hasta doce.
- **La tirada.** Ambos bandos tiran tus `attackRoll.dice` y suman la mejor de las pruebas que pueden usar aquí (`attacker.checks`, `defender.checks`). Gana el total más alto; un empate favorece al defensor salvo que `ties` diga `"attacker"`. El registro indica ambos bandos: "Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with Brawn, and wins."
- **Ganar** hace lo que indica `onWin`, al menos una cosa:
  - `applies` aplica estados al perdedor con el ganador como origen, así que un estado que marques con `endsWhenSourceDown` termina cuando cae quien sujeta. `rounds` le da un reloj; sin él, dura hasta que algo lo termine.
  - `ends` quita estados al actor o al objetivo.
  - `push` aleja al perdedor del ganador en línea recta, esa distancia en tu unidad, deteniéndose antes de cualquier cosa sólida, de cualquiera que esté en pie, del borde del tablero y de una esquina demasiado estrecha para pasar. Es forzado: no gasta nada de su movimiento y nadie le golpea por ello. Un combate sin tablero no mueve a nadie.
    Perder no hace nada, que es lo que es un agarre fallido.
- **`from: { "holding": "held" }`** hace que un enfrentamiento solo apunte a quien aplicó ese estado al actor, y solo lo pone en el menú mientras dura: así se expresa liberarse.
- **`reach`**, en tu unidad de distancia, es hasta dónde llega; la casilla siguiente si lo omites. `reach` y `push` necesitan `combat.distance`.
- **`strike: true`** le permite ocupar el lugar de un ataque cuando una acción compra varios, igual que un ataque: si se elige primero, gasta el presupuesto y deja disponibles el resto de los ataques; si se elige con ataques disponibles, cuesta uno de ellos. La referencia de 5e hace así los agarres y los empujones.
- **En el menú**, un enfrentamiento tiene su propio grupo e indica su probabilidad de ganar. Un oponente que interpreta el motor lo evalúa como cualquier otra cosa, pero con moderación: un agarre o un empujón prepara algo, y liberarse es lo que más vale, solo mientras se está sujeto. Un Game Master que interpreta a un oponente elige uno del mismo menú.
- Las pruebas de un oponente que inventa un Game Master se limitan a su nivel, igual que su probabilidad de acertar.

Los enfrentamientos requieren Capability API 1.43 en un conjunto empaquetado.

<a id="windows-holding-the-fight-open"></a>

### Ventanas: mantener abierto el combate

Algunos momentos pertenecen a alguien distinto de quien está actuando. Engine mantiene el combate abierto para esa persona en lugar de decidir por ella, y esa pausa es una ventana.

Siete cosas abren una, y dos proceden de lo que ya declaraste:

- **Alguien se aleja.** Un movimiento que sale del alcance de un enemigo capaz de golpear se detiene en ese paso y le pregunta. Véase Golpes contra quien se aleja, más arriba.
- **Entre un turno y el siguiente.** Cuando termina un turno, se pregunta a cada oponente con `signaturePoints` que pueda pagar una de sus propias acciones `signature` si desea comprarla, antes de iniciar el siguiente turno. Es el único momento en el que se compran: una acción distintiva no aparece en el menú de turno de nadie, incluido el suyo.
- **Alguien usa algo.** Antes de resolverlo, se pregunta a todos los del OTRO bando que tengan una entrada a la espera de ese momento, sea quien sea el objetivo, siempre que esa entrada alcance a quien lo usa. Una acción estándar y un enfrentamiento no abren ese momento.
- **Algo apunta a alguien.** Antes de resolverlo, se pregunta a todos los objetivos del OTRO bando que tengan una entrada a la espera de ese momento. Un amigo que te cura no es una amenaza a la que responder, así que una acción de un amigo no abre ninguna ventana.
- **Una tirada de ataque impacta a alguien.** Antes de su daño, se pregunta a quien recibió el impacto, si tiene una entrada a la espera de ese momento. Lo que elija cuenta para este ataque: consulta El momento después de un impacto, más abajo.
- **Algo ha dañado a alguien.** Después de resolverlo, se pregunta a todos los que hayan recibido daño y tengan una entrada a la espera de ESE momento, sea quien sea el causante. Recibir daño es un hecho sobre ti; una entrada dirigida de vuelta a quien lo causó sigue sin poder apuntar a un amigo.
- **Alguien cae.** Antes del daño y del derribo, para quien tenga una reacción que alcance a quien cae y permita su bando (Capability API 1.124).

- **Alguien empieza su turno.** Antes de que actúe, para una entrada que lo alcance en su bando objetivo (Capability API 1.131).

Las seis últimas son las que solicita una entrada de catálogo, o una acción propia de una criatura, al identificar el momento que espera. Cuando una acción abre tanto `used` como `aimed`, primero se pregunta por el uso; si nadie lo anula, a continuación se pregunta a aquellos a quienes apunta, y se resuelve una vez que ambos han respondido. Por recibir un impacto se pregunta a medida que impacta cada una de sus tiradas, y por recibir daño, una vez terminada toda la acción.

Qué hace una ventana, sea cual sea su causa:

- **Nada más se mueve mientras está abierta.** Ni el actor cuyo turno está en curso, ni el final de ese turno, ni otra ventana. El combate espera. Una caída retiene su aterrizaje mientras termina el paso de la acción que la causó; por las caídas posteriores se pregunta después.
- **Pregunta de uno en uno**, en orden de turno, una sola vez a cada uno. Pasar siempre es una respuesta y no cuesta nada. Si alguien consultado no tiene ninguna opción que pueda ejecutar, se omite en lugar de preguntarle.
- **Continúa exactamente donde se detuvo.** Un movimiento termina por las casillas que le quedaban, pagando cada una de las que realmente cruzó.
- **Responde quien los interpreta.** La ventana de tu propio miembro del grupo es tuya, con la opción y **Pass** (pasar) a su lado en el menú; la de un oponente la responde quien lo interpreta, y a un jefe del Game Master se le pregunta mediante el Game Master, con dejar pasar el momento como una de las respuestas.
- **Se guarda con el combate.** Una partida cerrada a mitad de un movimiento vuelve con las mismas personas pendientes de responder y las mismas casillas por recorrer.

No declaras nada para las dos primeras: un conjunto de reglas con `opportunity.budget` obtiene una, un bestiario con `signaturePoints` obtiene la otra, y uno sin ambos nunca las ve.

**Indicar qué momento espera una entrada.** Escribe `mechanics.reaction` como un objeto en lugar de `true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` es `used`, `aimed`, `hit`, `harmed`, `falls` o `turn-start`, y es lo que coloca la entrada en el menú de esa ventana. Son los únicos seis momentos que vigila Engine. Una entrada que todavía indique `"reaction": true` solo dice que no se ejecuta en un turno; eso no basta para ofrecerla en ningún lugar, así que no aparece en ningún menú.
- `at` es `source` (el valor predeterminado), `target` o `chosen`. `source` dirige lo ejecutado hacia quien causó el momento y completa el objetivo, de modo que no se pide elegir a nadie; `chosen` conserva los objetivos propios de la entrada y pregunta. `target` apunta a la criatura de la que trata el momento. Una respuesta `falls` recae en los que caen elegidos.
- `cancels` impide por completo que suceda lo que retenía la ventana. Solo una entrada `used` o `aimed` puede indicarlo: un momento que ya ocurrió no puede cancelarse, y un impacto ya se ha tirado.
- `against` restringe lo que responde la entrada a cosas usadas desde ciertos catálogos: `"against": { "catalogs": ["spells"] }` responde a un conjuro y a nada más. Una acción sin entrada detrás (un arma de una lista, una acción propia de una criatura) no procede de ningún catálogo, así que nunca abre el momento para una entrada que nombra catálogos. Omite `against` y la entrada responde a cualquier cosa.

Dale también un `budget`, o gastará el predeterminado de la lista. Una reacción casi siempre gasta un presupuesto propio, lo que impide que un turno contenga varias.

**Su coste se gasta antes de preguntar a nadie.** Una acción cancelada deja de suceder, pero no deja de haberse comprado: el presupuesto y las reservas ya se gastaron. Si tu sistema los devuelve, todavía no puede expresarlo.

Una contra se escribe así, y en un tablero solo responde a alguien dentro de su propio `range`:

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**Una respuesta que solo llega hasta cierto nivel** (Capability API 1.116). `"upTo": "paid"` en una reacción `used` que anula solo detiene lo que se pagó a un nivel no superior al que se pagó la propia respuesta, y `"above": { "check": <value>, "dc": 10 }` es la prueba que, aun así, detiene algo superior, contra `dc` más su nivel. El Counterspell de 5e, que detiene un conjuro del nivel de su espacio o inferior y pide por encima de eso una prueba de atributo de lanzamiento de conjuros contra 10 + el nivel del conjuro, lanzado a nivel superior como cualquier conjuro:

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

El nivel de cualquier cosa pagada es el nivel de la reserva de la que salió: el `level` propio de una reserva, un valor que se lee de la ficha de quien la tiene, cuando indica uno (los espacios de pacto de 5e, lanzados al nivel de espacio del brujo) y, si no, su posición en su grupo, siendo 1 la primera reserva. Algo que no costó nada, o que salió de una reserva sin grupo, es de nivel 0, así que lo detiene cualquier respuesta de este tipo. La prueba son los propios dados del combate con los estados de quien responde que afectan a las pruebas; un combate `dice-pool` no tiene CD que alcanzar y rechaza `above`. Una criatura sin ficha escribe su prueba como `{ "const": n }`. El registro indica el nivel y la tirada siempre que la respuesta llega por encima de sí misma, y le sigue la línea habitual cuando lo detiene. Sin `above`, algo superior simplemente no se detiene, y lo que costó la respuesta sigue gastado.

**El momento después de un impacto.** Una entrada en `hit` es la forma de expresar Shield, una Parry y Uncanny Dodge. El ataque se retiene después de su tirada, y se pregunta a quien recibió el impacto antes de infligir ningún daño. Lo que elija cuenta para ese ataque: su tirada no se repite, sino que se vuelve a comprobar contra su defensa tal como esté ahora, así que un estado que suma a la defensa puede convertir el impacto en un fallo, y una cara natural que siempre impacta sigue impactando. Un estado que dura un ataque (`endsAfter: "attacked"`) aplicado como respuesta cubre este ataque, daño incluido, y se gasta con él, que es como se dice "reduce a la mitad el daño de ese ataque": `resist-all` durante un ataque.

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

El ataque continúa exactamente donde se retuvo: el resto de sus objetivos y, en una acción de criatura formada por otras acciones, el resto de sus partes. Cada tirada que impacta a alguien que tiene una respuesta así se retiene en su turno, y un combate guardado mientras la ventana está abierta vuelve igual. Un ataque hecho dentro de una ventana (un golpe contra alguien que se aleja, una acción distintiva, una respuesta) nunca se retiene, porque nada abierto dentro de una ventana abre otra. El registro muestra la tirada y contra qué se hizo cuando se abre la ventana y, si la respuesta cambió la defensa, si ahora falla. Los oponentes que interpreta Engine solo se protegen cuando eso convierte el impacto en un fallo.

Un paquete que identifique un momento necesita Capability API 1.33, y uno que use `used` o `against` necesita 1.44. Uno que espera `hit` necesita 1.46.

**Responder a un conjuro por su nombre** (Capability API 1.117). `against` puede nombrar `entries` como `<catalog>/<entry>` junto a `catalogs`, y cualquiera de los dos que coincida abre el momento. `also` hace la misma respuesta en hasta tres momentos más, cada uno con su propio `against`. El `noDamageFrom` de un estado mantiene totalmente lejos de quien lo tiene el daño de esas entradas mientras dura, sea cual sea el tipo de daño. El Shield de 5e se usa cuando un ataque impacta y cuando se apunta Magic Missile a su lanzador, y bajo él Magic Missile no hace nada:

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

Solo el primer momento puede anular, así que una reacción que anula no tiene `also`. El catálogo que nombra una entrada tiene que ser uno que tenga el conjunto. Una entrada que no está en él simplemente nunca abre el momento. Un golpe que se evita así aparece en el registro como uno al que el objetivo es inmune.

**Responder solo a algunos golpes** (Capability API 1.118). Un momento `hit` puede indicar `"blow": "melee"` o `"blow": "ranged"`. Un golpe es cuerpo a cuerpo mientras su objetivo esté al alcance del arma, así que una daga lanzada desde lejos es a distancia y la misma daga usada junto a su objetivo es cuerpo a cuerpo. Un arma con alcance y sin distancia es siempre cuerpo a cuerpo, y una con distancia y sin alcance es siempre a distancia. En un combate sin tablero, un arma que tiene alcance se considera blandida en la mano. `"seesSource": true`, en cualquier momento salvo `falls`, solo lo abre mientras quien lo tiene ve a quien lo causó. Eso significa una línea de visión entre ellos en el tablero (sin tablero, todos ven a todos), y nunca a alguien que ha hecho la acción estándar Hide hasta que se le pasa al inicio de su siguiente turno. El Parry de 5e es ambas cosas:

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

Ambas claves también pueden escribirse en un momento de `also`, y `blow` solo en uno `hit`.

**Detener una caída** (Capability API 1.124). Una reacción a `falls`, también en `also`, responde a una criatura que cae de un saliente o a un volador obligado a bajar al suelo, antes de que la caída cause daño o la deje tumbada. Su distancia y su bando objetivo se comprueban respecto a quien cae, y su respuesta recae en esa criatura. Para Feather Fall, da a la entrada estas mecánicas y declara `feather_falling` en los estados vivos de la ficha:

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

Su entrada de `combat.conditions` es `{ "condition": "feather_falling", "fallsSafely": true }`. Mientras dura, este estado impide el daño por caída y el estado tumbado que aplicaría una caída; no elimina un estado que causó la caída. Usa `targets: "self"` para una respuesta solo a la propia caída del lanzador. Una caída no tiene entrada de origen, así que su reacción no puede llevar `cancels`, `blow`, `seesSource` ni `against`. Una entrada de un solo objetivo pregunta por cada caída por separado. Esto resuelve el aterrizaje; no registra un descenso ralentizado.

**Responder por otra criatura** (Capability API 1.131). `for` es `self` de forma predeterminada; `ally` excluye a quien la tiene, mientras que `any` lo incluye. Ambos preguntan a quienes la tienen en el bando del objetivo dentro del `within` exigido, en la unidad de distancia del catálogo, y solo en `aimed` o `hit`. Estas claves también funcionan en cada momento de `also`. `seesSource` sigue exigiendo ver al atacante. Protection aplica `own-attacks-disadvantage` al origen antes de tirar los dados de ataque. Su duración `this-action` termina cuando la acción se resuelve o se anula. Sin una distancia explícita al origen, la respuesta de un tercero alcanza a ese origen; `within` mide la distancia hasta la criatura protegida. Declara `protected_attack` en la ficha y da ese efecto a su estado de combate:

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**Poner la respuesta en el objetivo.** `at: "target"` se aplica a la criatura atacada, mientras que `source` sigue siendo el atacante. Shield Guardian representa a quien lleva el amuleto como un aliado a 5 o menos; `parrying` concede `+2` a la defensa. El impacto retenido vuelve a comprobar la defensa de ese aliado después de la respuesta:

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

**Al inicio de un turno.** `on: "turn-start"` pregunta cuando una criatura del bando objetivo de la entrada empieza su turno dentro de su distancia, antes de que esa criatura actúe. Esa criatura es el `source`. Una entrada dañina responde al otro bando; una que ayuda, a su propio bando. No puede llevar `cancels`, `blow`, `against` ni `upTo`. La acción de criatura Unnerving Mask pide una salvación de Sabiduría; una ronda en el reloj de la criatura afectada dura todo este turno y expira al final (omite `of: "source"`):

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

**Anular con una salvación.** `cancelSave: { save, dc }` requiere `cancels`; quien la tiene tira con sus modificadores de salvación habituales. Un éxito anula, un fallo deja que la acción original se resuelva, y ambos gastan la reacción. `against.actions` nombra de una a doce acciones de perfil, comparando el nombre completo sin distinguir mayúsculas de minúsculas (como máximo 80 caracteres cada uno). Rock Catching representa atrapar la roca anulando todo el ataque, incluido todo su daño, en vez de solo su daño contundente. Los IDs de salvación son los de tu conjunto (`dex` aquí; `dex_save` en el ejemplo de 5e incluido):

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**Detener a varios que caen.** Una entrada `falls` con un `targetCount` mayor que uno ofrece las criaturas elegibles que caen por un mismo golpe o efecto, dentro de su distancia y en su bando objetivo. El menú y el director eligen de forma predeterminada a todos los elegibles hasta la cantidad, empezando por los más cercanos; el jugador puede cambiar la selección. Una caída posterior es un evento aparte. Feather Fall usa el mismo estado `fallsSafely` de antes:

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

### Todavía no

Dicho claramente, porque un conjunto de reglas no debe prometer lo que Engine no hace:

- **Más allá del tablero modesto**: no hay vuelo sobre obstáculos, paso por espacios estrechos ni monturas. A una criatura solo la mueven su propio movimiento, un teletransporte y lo que la empuja (un enfrentamiento, una entrada, la acción de una criatura o una zona). Nadie arrastra a una criatura que sujeta.
- **Un enfrentamiento es simple.** Su tirada no abre ninguna ventana, pero sí se puede responder a una caída que cause.
- **Una entrada solo puede esperar seis momentos**, `used`, `aimed`, `hit`, `harmed`, `falls` y `turn-start` (véase Ventanas, más arriba). Son los momentos que Engine detecta en nombre de una entrada; las otras dos ventanas, alguien que se aleja y la pausa entre turnos, las abre el propio combate y no son momentos que pueda solicitar una entrada. No existe un momento para una tirada de salvación ni para una muerte.
- **No se encadenan.** El combate mantiene una ventana en lugar de una pila, así que nada abierto dentro de una ventana abre otra: una contra no puede recibir a su vez una contra, lo que inflige una reacción no abre otro momento, y un ataque hecho dentro de una ventana no se retiene cuando impacta. Una caída a la que se puede responder y que se produce durante una ventana se retiene hasta que esta se cierra, y después se pregunta por ella cuando le toca.
- **Solo una tirada de ataque es un impacto.** Algo que alcanza sin ella (dardos que simplemente impactan, un área contra la que todos hacen una salvación) no abre ningún momento `hit`.
- **Los modificadores de daño son de los impactos de ataque.** Una respuesta puede poner un modificador de daño a quien la tiene o reducir a la mitad el daño recibido con `resist-all`; los modificadores de daño nunca cambian un efecto que solo pide una salvación.
- **No se devuelve nada.** Lo que costó una acción cancelada queda gastado.
- **Lo que cambia un estado es una lista cerrada.** La defensa, las tiradas de ataque, las salvaciones, las pruebas de enfrentamiento, la velocidad, el máximo de salud, el daño infligido y el daño recibido (también para los niveles y los efectos de los objetos). Los modificadores de daño solo cambian los impactos de ataque; nunca se suman al daño basado en salvaciones ni a los impactos automáticos.
- **Una criatura escrita con números simples no tiene contador de heridas.** En un conjunto de reglas cuya salud sea un contador, esa criatura sigue perdiendo puntos; dale una `sheet` y sus golpes marcarán casillas, mitigados primero por sus propios `resist`, `vulnerable` e `immune`.
- **Un efecto adicional se activa solo.** `on` tiene un único valor, `hit`, así que lo aplica el primer impacto del período que cumpla los requisitos, sin ningún momento en el que se pregunte si deseas gastarlo.
- **Un número que mueven los ataques es simple.** Un golpe que gasta tira el número y nada más, así que ningún arma lo cambia, incluido su `floor` (un objetivo resistente absorbe un golpe que toma, y su dureza detiene uno que gasta, pero nada más reduce ninguno de los dos); un derrumbe se levanta tras un número fijo de turnos por muy profundo que fuera; y un ataque hecho en una ventana (un golpe contra alguien que se aleja, una reacción, un movimiento distintivo) se hace en el primer estilo.
- **Un oponente inventado no absorbe nada y no tiene dureza.** Una criatura que el Game Master inventa para un combate queda limitada a tu escala de amenaza, que no dice nada sobre absorción ni dureza, así que no tiene ninguna de las dos.

## Capas: variantes de tu propio conjunto de reglas

Una capa es una variante con nombre de tu conjunto de reglas que el jugador activa al crear una partida: magia escasa, invierno duro, una dificultad más cruda. Las capas residen en el archivo del conjunto de reglas, en una matriz opcional `layers`, por lo que viajan con él y nunca pueden faltar en una partida que las haya usado. El asistente las muestra como interruptores debajo de tu conjunto de reglas, y la elección queda fijada para toda la vida de esa partida, igual que el propio conjunto.

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

**Qué puede hacer una capa.** La lista es cerrada, y cada efecto restringe algo o añade texto:

- `gm.guidance` se añade al final de tu `gm.checkGuidance`, después de tu propio texto y del de cualquier capa anterior. `gm.worldGuidance` se añade al final de `gm.worldGuidance` del mismo modo.
- `fields` retira valores de un campo **enumerado**. `removeValues` identifica valores que el campo ya contiene, debe sobrevivir al menos uno y, si el `default` del campo es uno de los retirados, la capa indica otro `default` que sobreviva.
- `difficultyLadder` sustituye tu escala por otra con la estructura de tu propio tipo de resolución: `{label, dc}` para `dice-sum` y `{label, successes, target?}` para `dice-pool`. Se somete exactamente a las mismas validaciones que tu propia escala. Cuando varias capas activas declaran una, gana la última.
- `catalogs` oculta entradas del selector del editor de fichas. Cada regla identifica uno de los `filters` declarados por ese catálogo y exactamente una comparación: `above` o `below` para un filtro `number`, `equals` o `notIn` para uno `text` o `tags`. Nunca se oculta una entrada que no establezca ese filtro.
- `currencies` retira monedas: `removeUnits` nombra monedas sueltas y `removeFamilies`, familias enteras. La moneda más pequeña de una familia solo se va con su familia, para que cada familia que queda pueda seguir pagando y dando cambio. Mientras la capa está activa, nadie gana, paga con, elige ni suelta una moneda retirada, y la línea del monedero la omite. Un precio expresado en ella se indica en la moneda más grande que queda y que lo paga exactamente, con el mismo valor: la larga noche de Gravewatch retira la crown, así que una pistola de guardia de 3 crowns cuesta 15 shillings. Un objeto cuya familia entera ha desaparecido no tiene precio.

**Qué no puede hacer una capa.** No puede añadir un valor enumerado, un campo, una habilidad, una reserva o un descanso, cambiar el tipo de resolución, tocar el estado en vivo o los números de combate ni añadir una llamada a un modelo. Un valor que una capa _añadiera_ sería desconocido para todos los demás lectores de la ficha, así que los valores solo se retiran. Todo lo que quede fuera de esta lista es un cambio del propio conjunto de reglas o un segundo conjunto.

**Conflictos.** `conflicts` identifica capas que no pueden estar activas juntas. Basta con indicar un lado del par. El asistente desactiva el otro interruptor y, si una elección guardada contiene ambos de algún modo, se descarta la capa declarada **después**, para que las mismas dos elecciones siempre produzcan las mismas reglas.

**Una ficha que ya contenga un valor retirado lo conserva.** Nada reescribe al personaje. El editor simplemente deja de ofrecer el valor, y un personaje que ya lo tenía lo muestra tal como es. Desactiva la capa en una nueva partida y el valor volverá a ofrecerse. Lo mismo ocurre con una entrada de catálogo oculta: queda fuera del selector y una fila que el jugador ya eligió permanece en la ficha. Las monedas que retira una capa y que alguien ya lleva se quedan en su bolsa.

**Límites.** 12 capas por conjunto de reglas y 4000 caracteres de instrucciones por capa, contando ambas cadenas juntas. Un conjunto de reglas empaquetado que declare `layers` o un `gm.worldGuidance` base necesita Capability API 1.25, y uno cuyas capas retiran monedas necesita 1.64. Uno que importes lo valida Engine al leerlo, así que no necesita nada.

**Las capas escritas por otra persona** (una capa de magia escasa para un conjunto de reglas que no escribiste, distribuida en su propio archivo) llegarán más adelante. Actualmente, una capa se distribuye dentro del conjunto de reglas al que pertenece.

<a id="trying-your-ruleset"></a>

## Probar tu conjunto de reglas

Los conjuntos de reglas comunitarios usan el mismo interruptor que los agentes importados. Abre **Settings** (ajustes) > **Advanced** (avanzado) > **Danger Zone** (zona de peligro) y comprueba que **Allow custom Agent imports** (permitir importaciones de agentes personalizados) esté activado. La importación también necesita acceso desde localhost o **Admin Access** (acceso de administrador) configurado.

1. Abre el panel **Agents** (agentes) y elige el botón **Import agents** (importar agentes), el icono de descarga de la fila de botones de la parte superior del panel.
2. Elige **Game Mode ruleset** (conjunto de reglas del modo de juego) y selecciona tu archivo JSON, o un archivo de paquete de conjunto de reglas que termine en `.ruleset.json` (consulta [Compartir tu conjunto de reglas](#sharing-your-ruleset)).
3. Lee la revisión. Muestra el nombre, la versión, la licencia, lo que cubre el conjunto de reglas y el texto del Game Master. Elige **Import** (importar).

Tu conjunto aparece en la sección **Rules** (reglas) del panel y en la elección **Rules** del asistente de configuración para nuevas partidas. Uno importado desde un archivo se clasifica como `local/<your id>`, de modo que nunca pueda confundirse con uno oficial ni con el de otra persona.

### Cambiar un conjunto de reglas que ya importaste

Una versión importada nunca se reescribe. Si cambias el archivo y lo vuelves a importar con la misma `version`, la importación se rechaza y te pide aumentar el número. Es intencional: una partida está ligada a la versión exacta con la que se creó, para que una campaña en curso nunca despierte con cálculos diferentes.

Por tanto, el ciclo durante la redacción es: editar, aumentar `version`, importar, iniciar una partida nueva. Las versiones antiguas permanecen instaladas junto a la nueva hasta que retires el conjunto de reglas de la sección **Rules**. Retirar uno que todavía usa una partida hace que esta indique que falta su conjunto de reglas hasta que vuelvas a importarlo.

Si cambias la estructura de la ficha (añades, retiras o renombras elementos), aumenta también `sheet.version`. Las fichas existentes se leen con tolerancia: se conservan los valores que la nueva ficha no conoce y los ausentes toman sus valores predeterminados.

### Mover valores a nuevos IDs: `sheet.migrations`

Añadir cosas no necesita nada más. Cuando una nueva estructura mueve un valor a otro sitio (un campo renombrado, un único nivel que se convierte en un nivel por clase, una única reserva de dados de golpe que se convierte en una por dado), indica cómo en `sheet.migrations` (Capability API 1.77), para que cada personaje creado con la estructura antigua conserve sus números: en la biblioteca, en las partidas, en las partidas guardadas antiguas, las ramas y los puntos de control, y en las tarjetas importadas.

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

- Cada entrada mueve una ficha guardada de la versión `from` a `from + 1`, y se ejecuta, en orden, para cada ficha guardada en esa versión o en una anterior. No elimines nunca ninguna después de publicarla: una ficha guardada hace mucho la sigue necesitando. Una versión que solo añade no necesita ninguna.
- `rename` (un `ability`, `skill`, `save` o `field`): el valor se copia a su nuevo ID. Una habilidad o salvación se lleva su bonificación. Un renombrado puede continuar uno de una entrada anterior, o alimentar un campo que un `route` posterior envía a otro sitio; la importación sigue la cadena hasta donde termina.
- `route`: el valor de un campo va al campo que nombra el texto de otro campo. Un caso gana cuando sus palabras aparecen en el texto de `by` como palabras completas (solo las letras forman una palabra, así que "Fighter3" nombra a un guerrero), sin distinguir mayúsculas de minúsculas, y gana exactamente un caso. Si no gana ninguno, o varios ("Fighter 3 / Wizard 2", entre los que no se puede repartir un único número sin preguntar), va a `else`. `default` sustituye al valor en una ficha que nunca lo guardó. `by` es un campo que tiene la ficha, o uno que una estructura anterior renombró. Los destinos son campos numéricos o de texto sin valor predeterminado, o con un valor predeterminado de 0 o vacío: el valor llega a uno de ellos y todos los demás conservan su valor predeterminado, así que cualquier otro valor predeterminado se leería como un nivel que nadie dio. Se sigue hasta su nuevo sitio un destino que un renombrado posterior mueve.
- `routeLive` (un `pool` o `track` del estado vivo): el valor guardado va al de los `cases` que muestre la ficha migrada (una reserva con un máximo mayor que 0, un contador que la ficha no oculte) o, si no, a `else`. Los contadores a los que va un valor son todos contadores de heridas (lleva las marcas) o todos simples (lleva el número).
- Cada paso de creación copia: el valor antiguo se queda donde estaba, así que una versión anterior de tu conjunto sigue leyendo la ficha como antes. Un paso nunca sobrescribe un valor que ya esté en su destino.
- La importación rechaza una entrada igual o superior a `sheet.version`, dos entradas de la misma versión, un paso que escribe en un ID que la ficha no tiene, un caso que aparece dos veces, y un `rename` o `routeLive` que lee de un ID que la ficha todavía tiene (un ID del que se ha movido el valor nunca se vuelve a usar, que es lo que hace que esos pasos se puedan volver a ejecutar sin riesgo).
- Las fichas se migran siempre que se leen, y la nueva estructura se guarda en la siguiente edición. El estado vivo no tiene versión propia, así que `routeLive` se ejecuta en cada lectura: la clave antigua se descarta y su valor solo se mueve mientras la clave nueva no exista todavía, de modo que nunca se sobrescribe un valor que se haya gastado o recuperado descansando desde entonces. Adónde fue lo decide la primera escritura después de la actualización: una ficha corregida más tarde (un nivel de clase movido a mano) no lo vuelve a mover. Un combate que ya estaba en curso cuando llega la nueva versión termina igualmente, como antes.

<a id="sharing-your-ruleset"></a>

## Compartir tu conjunto de reglas

**Como archivo.** Envía el archivo JSON a un amigo. Lo importa igual que tú.

**Como archivo de paquete.** Un conjunto de reglas demasiado grande para un solo archivo, con catálogos en sus propios archivos, viaja como un único archivo JSON simple llamado `<name>.ruleset.json`. Contiene el manifiesto del paquete y los documentos del conjunto, cada uno con sus bytes exactos en base64:

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

El manifiesto enumera `ruleset.json` y cada `catalogs/<id>.json` en `contributions.assets.paths` y en `files`, con el tamaño y el sha256 de cada uno. Un editor de conjuntos de reglas como Pixelforge crea uno. **Import agents** → **Game Mode ruleset** toma el archivo y muestra la misma revisión que para un archivo de conjunto de reglas, con cada catálogo y su número de entradas. No hay nada comprimido, así que nunca contiene más que su propio tamaño. Se lee como datos y nunca se instala como paquete: se rechaza, indicando el motivo, si contiene cualquier otra cosa (otra clave, cualquier otro archivo, un documento que no esté en base64 estricto o no sea texto UTF-8), si su manifiesto es algo más que el de un conjunto de reglas (cualquier código, permiso u otra contribución), si un archivo no es el que enumera el manifiesto, si un `$comment` supera los 2.000 caracteres o `$schema` nombra algo distinto del esquema propio del motor, o si no se puede leer el conjunto o un catálogo. Se clasifica como `local/<its id>`, igual que un archivo de conjunto de reglas, con un máximo de 24 MB y como máximo 12 archivos de catálogo de 2 MB cada uno. Una versión es su conjunto de reglas y sus catálogos juntos, así que un catálogo modificado también necesita una `version` más alta. No se aceptan paquetes de conjuntos de reglas en zip.

**Desde un repositorio de GitHub.** Si guardas tu trabajo en un repositorio público de GitHub, coloca cada conjunto de reglas en una carpeta `rulesets` en la raíz del repositorio, un archivo por conjunto:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Un usuario añade tu repositorio una sola vez mediante la lista de repositorios de agentes personalizados, revisa lo que contiene y puede sincronizarlo después para recibir nuevas versiones. La lista de repositorios personalizados es una función avanzada que quien ejecuta el servidor debe activar con `ENABLE_CUSTOM_AGENT_REPOS=true`. Los conjuntos de reglas de un repositorio se clasifican bajo el nombre de su propietario, como `alice/ember-roads`, para que dos autores puedan publicar uno llamado `v20` sin colisiones.

Se aplican dos límites. Un repositorio puede contener como máximo 32 archivos JSON directamente dentro de `rulesets`; si tiene más, se rechaza. Una cuenta llamada `local` no puede publicar conjuntos de reglas, porque `local/` se reserva para los importados desde un archivo.

**En el catálogo oficial.** Un sistema muy utilizado y con licencias claras puede ofrecerse a todo el mundo mediante **Download Agents** (descargar agentes). Eso requiere un pull request al repositorio [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Consulta allí el paquete `ruleset-5e-2014` para ver la estructura.

## Licencias

Publica solo texto de reglas que tengas derecho a compartir. Muchos sistemas publican un documento de referencia con una licencia abierta, y ese es el documento del que puedes copiar. Coloca el identificador de la licencia y el texto de atribución que exige bajo `license`. No copies texto de manuales sin licencia abierta. Un conjunto de reglas necesita principalmente nombres y números, y el texto del Game Master debe estar escrito con tus propias palabras.

## Solución de problemas

- **La importación dice que un nombre no existe.** Algo del archivo apunta a un identificador no declarado, como una habilidad que identifica una característica que retiraste. El mensaje indica la ruta hasta la línea.
- **La importación dice que una versión ya está instalada con otro contenido.** Aumenta `version` y vuelve a importar.
- **Mi conjunto de reglas no aparece en el asistente de configuración.** Comprueba que **Allow custom Agent imports** esté activado. Mientras esté desactivado, los conjuntos importados quedan fuera de las partidas nuevas. Las partidas que ya usan uno siguen funcionando.
- **Una partida dice que falta su conjunto de reglas.** No está instalada la versión exacta con la que se creó. Vuelve a importar esa versión del archivo.
