# Escribir conjuntos de reglas de Game Mode

Un conjunto de reglas explica a Game Mode cómo funciona un sistema de mesa: qué dados tira una prueba, qué contiene la ficha, qué recursos se gastan y qué recupera un descanso. Esta guía es para quienes quieren escribir uno y compartirlo. Para jugar con uno creado por otra persona, empieza por [Elegir las reglas](../game/getting-started.md#choosing-rules).

Un conjunto es un archivo JSON. Son datos, no código. Nada se ejecuta, así que importarlo no puede hacer nada en tu computadora. Antes de importar un archivo ajeno, lee con atención el texto del Game Master: se envía al modelo en todas las partidas que usan el conjunto.

## Lee esto primero: qué puede y qué no puede hacer un conjunto

Un conjunto solo puede rellenar los parámetros de una mecánica que el motor ya conoce. Actualmente conoce dos formas de resolver pruebas; el archivo elige una con `resolution.kind`:

- **`dice-sum`**: tira dados, suma números de la ficha e iguala o supera una dificultad. Abarca sistemas d20, sistemas de 2d6 más atributo y muchos otros.
- **`dice-pool`**: tira la cantidad de dados del personaje y cuenta los que alcanzan un objetivo. Abarca sistemas donde una puntuación representa un puñado de dados en vez de una bonificación.

Ambos se describen por completo en [Tipos de resolución](#resolution-kinds).

Una mecánica que no encaje en ninguna forma no se puede escribir en el archivo. Por ejemplo, quedarse con el dado más alto de una reserva, pruebas porcentuales por debajo de un valor, dados de símbolos y reservas enfrentadas. Cada una necesita un nuevo tipo de resolución dentro del motor: una contribución de código con pruebas, no un JSON. Si tu sistema lo necesita, abre una solicitud de función en el repositorio del motor y describe la mecánica con varias tiradas resueltas. Esos ejemplos se convierten en las pruebas.

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
| `battle` | Opcional. Qué lee una batalla de la ficha y qué escribe al terminar. |
| `combat` | Opcional. Cómo resuelven tus reglas una pelea y qué ejecuta la pantalla de batalla. |
| `layers` | Opcional. Variantes del conjunto que se activan al crear una partida. |

El archivo puede ocupar hasta 256 KB. El texto que llega a un prompt (nombres, etiquetas, texto del Game Master) no puede contener saltos de línea, corchetes ni llaves dobles.

Los IDs de la ficha (atributos, habilidades, campos, reservas, etc.) usan minúsculas, dígitos y guiones bajos, y empiezan por letra, como `grit_max`.

<a id="resolution-kinds"></a>

### Tipos de resolución

`resolution.kind` elige cómo tirar. Ambos tipos leen la misma ficha y comparten tres claves; las partes del archivo posteriores a `resolution` no cambian al alternar:

- `abilityModifier`: cómo se convierte una puntuación en un número. `identity` usa la propia puntuación; `floorHalfMinusTen` es la regla de 5e; `stepTable` permite definir umbrales como `[[score, number], ...]`.
- `proficiencyTiers`: niveles de entrenamiento de una habilidad o salvación. El primero se aplica a habilidades no incluidas. Cada nivel añade `flat`, o `multiplier` por la bonificación de competencia, o ambos. Si el sistema tiene esa bonificación, indica su origen con `"proficiency": { "bonus": { "derived": "proficiency_bonus" } }`.
- `proficiency`: opcional; solo se necesita para un nivel que multiplica.

El significado del número depende del tipo: `dice-sum` lo suma a la tirada; `dice-pool` tira esa cantidad de dados.

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
- `difficultyLadder`: dificultades que se indica al GM que elija. `dc` es el número que debe alcanzar el total.

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

- `die`: caras de cada dado de la reserva, de 2 a 100.
- `pool`: límites aplicados al número de la ficha antes de las explosiones. Un `min` de 0 permite que una reserva vacía falle sin tirar; `max` no puede superar 100.
- `target`: cara que debe alcanzar un dado para contar. Pon `min` por debajo de `max` para permitir al GM moverla por prueba con `threshold=`; iguala los tres valores para fijarla.
- `double`: opcional. Una cara igual o superior a `from` cuenta dos veces.
- `explode`: opcional. Una cara igual o superior a `from` tira otro dado, que también puede explotar. Los dados extra se limitan a `pool.max` además de la reserva inicial: una prueba tira como máximo el doble de `pool.max` y un `from` bajo no causa tiradas infinitas.
- `cancel`: opcional. Una cara igual o inferior a `upTo` quita un éxito. La cantidad nunca baja de cero.
- `botch`: opcional. Si **ningún** dado tuvo éxito y salió una cara igual o inferior a `upTo`, hay fracaso crítico. Una reserva cuyo único éxito se canceló ha fallado, pero no es una pifia.
- `exceptional`: opcional. Esta cantidad de éxitos netos o más, en una prueba superada, es un éxito crítico.
- `situationalDice`: opcional. Límites de dados que el GM puede añadir o quitar con `bonus=` por acrobacias, heridas o mala iluminación.
- `difficultyLadder`: `successes` indica cuántos éxitos se necesitan. Un peldaño también puede definir `target`, pero solo si es ajustable y dentro de sus límites.

Las caras de `cancel` y `botch` deben estar por debajo del objetivo mínimo, y todas las caras nombradas deben existir en el dado. Una regla imposible de activar se rechaza al importar, en vez de descubrirse durante el juego.

Un conjunto empaquetado de reservas requiere Capability API 1.24. Uno comunitario importado lo valida el motor que lo lee, así que no necesita nada más.

#### Qué puede escribir el Game Master en una prueba de reserva

```
[skill_check: skill="Ward" dc="2" who="Bram the Quiet" threshold="8" bonus="-2" with="Sinew"]
```

- `dc` es la cantidad de **éxitos** necesaria, no un objetivo por dado. Va de 1 al máximo que pueda contar una tirada: el máximo de la reserva, duplicado si hay explosiones y otra vez si las caras cuentan doble.
- `threshold=` mueve el objetivo por dado y solo se ofrece si `target.min` es menor que `target.max`.
- `bonus=` añade o quita dados y solo se ofrece si se declara `situationalDice`.
- `with=` tira una habilidad o salvación con otro atributo. Funciona con ambos tipos; 5e obtiene "Strength (Intimidation)" con el mismo atributo.

Todo respeta el archivo: los valores fuera de rango se ajustan al extremo más cercano y un atributo no ofrecido se ignora, sin rechazar la prueba. El registro muestra lo realmente usado: umbral y dados adicionales después de los límites, y `with=` solo si se sustituyó el atributo. El motor siempre tira los dados. Sustituye resultados de reserva escritos por el modelo, ignora `mode="advantage"` porque este tipo no tiene ventaja y no usa dados tirados por el jugador antes del turno.

#### Qué queda fuera y por qué

Cada caso necesita otro tipo de resolución: ninguno se expresa contando dados que alcanzan un objetivo.

- **Conservar el dado más alto** (como Blades in the Dark) requiere un resultado de éxito parcial que las pruebas no tienen.
- **Reservas de postura comparadas con un atributo** (como Lasers and Feelings) deciden si superar o quedar por debajo en cada prueba, otra comparación.
- **Dados de símbolos** (como Genesys) no producen números.
- **Reservas enfrentadas** resuelven dos personajes a la vez; una prueba tiene un solo lanzador.
- **Porcentajes por debajo del valor y porcentajes abiertos** comparan en la dirección contraria.
- **Reservas sumadas con un dado especial** (como OpenD6) suman los dados y tratan uno de forma distinta.

Las dos cosas que antes quedaban fuera ya están modeladas; la sección sobre gastar para cambiar tiradas explica cómo. Una regla del sistema, "spend a point for a success", es `resolution.spend`: compra éxitos o dados, nunca repeticiones. Volver a tirar pertenece a algo elegido por el personaje, por lo que se usa `mechanics.check` de una entrada de catálogo, pagado con el coste propio de esa entrada.

### Gastar para cambiar una tirada

Algunos sistemas permiten pagar por una tirada que está a punto de hacerse: un punto de voluntad por un éxito automático. `resolution.spend` lo define como regla permanente del sistema, no como algo comprado por un personaje:

```json
"spend": [{ "pool": "resolve", "amount": 1, "successes": 1, "perCheck": 2 }]
```

- `pool` es una de tus `live.pools`. No puede empezar vacía, pues no habría nada que gastar al comenzar a jugar.
- `amount` es el coste de UNA compra. `successes` y `dice` indican qué compra; debe comprar al menos uno. Los éxitos se añaden después de contar los dados y de las cancelaciones, porque nadie los tiró. Los dados se tiran con la reserva, dentro de sus límites.
- `perCheck` indica cuántas compras permite una prueba; como máximo puede comprar por valor de `amount * perCheck` puntos. Ese límite impide que una reserva llena compre una tirada imposible de perder.
- Solo lo admite `dice-pool`: una tirada sumada no tiene éxitos ni reserva a los que añadir nada. Se rechaza al importar un conjunto `dice-sum` que declare `spend`.
- Dos entradas no pueden nombrar la misma reserva, porque la prueba no podría distinguirlas.

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
- Debe haber al menos uno de los cuatro; si no, la entrada no dice nada y se rechaza.
- Solo `dice-pool` puede aplicarlo; un conjunto `dice-sum` con `mechanics.check` se rechaza al importar.

**El coste es el `cost` de la entrada**, pagado con el mismo mecanismo que cualquier otro uso: la reserva y un uso de cada contador que escribió esa entrada. `perCostStep` indica que la entrada ESCALA: si lo declara, se compra tantas veces como se haya pagado su precio; si no, se compra una vez por mucho que se ofrezca.

**El GM la nombra en la prueba:** `[skill_check: skill="Brawl" dc="3" use="Potence" spend="blood:3"]`. No usa un comando de ficha separado por el mismo motivo: se tira antes de actualizar los registros.

**Todo o nada.** Si la reserva no alcanza, no se compra ni descuenta nada; la tirada queda como habría sido. Los puntos que no equivalen a un número entero de compras tampoco compran nada. Pedir más de `perCheck` se limita, no se rechaza; solo se paga hasta ese máximo. El motor lo calcula todo. El GM nombra lo que el jugador quiso gastar y nunca toca los dados. El registro indica lo realmente pagado, la entrada aplicada, los éxitos que no se tiraron y cuántos dados se repitieron. Un amuleto no elegido por el personaje, o cuyo catálogo no pueda leer el motor, no hace nada; no se aplica por confianza.

### La ficha

- `sections` agrupa elementos en el editor.
- `abilities` son las puntuaciones principales. `skills` y `saves` pueden nombrar el atributo con el que tiran.
- `fields` contiene valores individuales. Tipos: `number`, `text`, `longtext`, `boolean`, `enum` (lista fija de opciones) y `dice` (texto como `1d8`).
- Los valores `derived` se calculan a partir de otros y no pueden sobrescribirse a mano. Las operaciones son `sum`, `min`, `max`, `scale` (multiplicar y redondear) y `stepTable` (consultar umbrales, como cuando un nivel determina competencia).
- `lists` son tablas con columnas propias, como equipo, conjuros o rasgos. Una lista con `pools` convierte cada fila en un recurso con máximo propio, para rasgos de clase de usos limitados.
- `live` es lo que cambia al jugar: `pools` (puntos de golpe, espacios de conjuro, Grit), `tracks` (número en una escala, como agotamiento, o contador de heridas con casillas), `text` (notas breves, como la concentración) y `conditions`.

Todo lector de números los nombra con una referencia de valor: un objeto con exactamente una clave entre `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod` y `saveMod`. Por ejemplo, una reserva con máximo derivado: `"max": { "derived": "grit_max" }`.

`hideWhen` oculta un campo, lista o reserva cuando otro campo tiene un valor dado. El archivo 5e lo usa para ocultar espacios de conjuro a quien no lanza conjuros.

### Contadores de heridas: salud en una escala de marcas

Muchos sistemas no cuentan puntos de golpe. Tienen una columna de casillas, cada una peor que la anterior, y marcas una al recibir daño. Añade `levels` y `kinds` a una entrada `live.tracks` para convertir un número en una de estas escalas:

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
- Ambos van juntos. Se rechaza `kinds` sin `levels`, porque no habría dónde marcar, y `levels` sin `kinds`, porque la marca debe ser de algún tipo.
- **Distingue los términos.** `kinds` define lo que PUEDE SER una marca. Una MARCA es uno de esos tipos situado en el contador durante la partida. La definición contiene tipos; la ficha contiene marcas.
- La longitud son sus niveles: `min` es 0 y `max` es `levels.length`. Cualquier otra declaración se rechaza en vez de corregirse, para que el archivo nunca contenga dos longitudes contradictorias.

**Las reglas exactas**, porque una interpretación vaga produce un contador incorrecto:

- Las marcas se ordenan con **las más graves primero**. Siete niveles admiten como máximo siete marcas.
- Cada marca se **inserta por orden de gravedad**, nunca simplemente al final. Ocupa el nivel más alto que le corresponde y desplaza las más leves hacia abajo.
- La penalización activa es la del **nivel marcado más bajo**, nunca la suma. Tres marcas en el ejemplo dan `-3`, no `0 + -1 + -3`.
- `amount` es la cantidad de marcas de un tipo, **aplicadas una a una**. Así, llenarse a mitad del proceso sigue la misma regla que empezar lleno.
- Marcar un contador **lleno** **aumenta un paso la gravedad de su marca más leve**, en vez de añadir otra. Sube un peldaño en tu escala de tipos, sea cual sea el tipo nuevo.
- Una marca que superaría la gravedad máxima se queda en ella; la que no pudo entrar cuenta como **desbordamiento**. Este se guarda para que recargar no olvide el daño recibido.
- **Curar usa el mismo comando con cantidad negativa.** Elimina primero las marcas más leves y antes de cualquier marca elimina el desbordamiento.

**Marcar durante el juego.** El GM escribe `[sheet: op="damage" track="harm" kind="knock" amount="1"]` y cura con `amount` negativo. La forma de reserva de `damage`, que nombra `pool=`, no cambia. El comando `track` ordinario se rechaza para heridas: un número no identifica los tipos de marcas nuevas. El jugador también puede marcar y limpiar casillas a mano, como esperan estos sistemas.

**Un combate también puede marcarlo.** Apunta `combat.health` al contador en vez de a una reserva: un golpe acertado marca las casillas que indica `combat.damageKinds.marks`, del tipo al que ese bloque asigna su daño. Un personaje con el contador lleno está caído, el estado que consulta la regla de muerte. Curar elimina una marca. Los puntos temporales se rechazan porque el contador no tiene un espacio para ellos. El motor lo lee como niveles RESTANTES; el resto del combate, caer, revivir, el registro y el resumen no cambia.

**Un descanso puede curar heridas.** Un paso de restauración que use `"to"` lo reduce a esa cantidad de marcas, incluido el desbordamiento; con `"by"` elimina esa cantidad, empezando por el desbordamiento. Un paso que AÑADIRÍA marcas no hace nada, porque el descanso no nombra ningún tipo.

### La penalización de las tiradas

`resolution.penaltyFrom` nombra el contador de heridas que penaliza todas las pruebas del conjunto. Se declara, no se presupone: sin él, las tiradas funcionan igual que antes de que existieran los contadores.

Lo que HACE la penalización depende del tipo de resolución, igual que el número de la ficha:

- En `dice-pool`, **quita dados de la reserva**, con mínimo `pool.min`. Un `pool.min` de 1 permite tirar un dado incluso desde el último peldaño; un `pool.min` de 0 permite no tirar ninguno y fallar sin lanzar.
- En `dice-sum`, es un **modificador fijo**, incorporado al mismo número al que ya contribuyen atributo y entrenamiento.

Debe nombrar un contador de heridas. Uno ordinario no tiene penalización y se rechaza al importar. El resultado indica la aplicada, para que el jugador entienda por qué tiró menos dados; el bloque de ficha del GM también muestra el peldaño y su coste.

### Descansos

Un descanso es una lista de restauraciones y elementos que borrar. Cada paso nombra un objetivo (`pool`, `poolGroup`, `listPools` o `track`) y lo fija (`"to": "max"`, `"to": "min"` o un número) o modifica (`"by": { "const": 1 }` o `"by": { "fractionOfMax": 0.5 }`). Si nombra un contador de heridas, solo puede curarlo; consulta arriba.

### Texto del Game Master

- `checkGuidance` sustituye el párrafo integrado que enseña a pedir pruebas. Indica el sistema y cuándo tirar. El GM solo nombra habilidad y dificultad. El motor tira y calcula desde la ficha: no pidas al modelo que haga matemáticas.
- `sheetGuidance` presenta las fichas en el prompt. Explica qué recursos importan y cuándo gastarlos.
- `worldGuidance` es opcional y se lee una vez al generar el mundo para adaptar la ambientación a las reglas: sin pólvora, magia escasa, muertos que caminan. Nunca llega a un turno.
- `sheetSummary` elige campos, valores derivados y filas de listas que ve el GM de cada personaje. El motor siempre muestra modificadores de atributo, habilidades y salvaciones entrenadas y valores vivos. Mantén breve lo demás, pues se envía en cada turno.

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
- `holds`: `"rows"` (predeterminado y usado por todos los catálogos anteriores a esta versión) o `"creatures"`. Un catálogo de criaturas es un bestiario que lee el combate: no escribe en fichas, no declara `feeds` y nunca aparece en el selector. Consulta [Criaturas](#creatures-a-bestiary-a-fight-reads).
- `feeds`: de una a ocho listas de ficha donde pueden escribir las entradas. Obligatorio para filas y rechazado para criaturas. Una entrada no puede escribir en otra lista ni colocar un valor que sus columnas no admitan.
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
- Una fila con `scaled` debe ser la única de la entrada para esa lista; así, una fila marcada siempre coincide con una sola especificación.

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

Una entrada puede incluir `mechanics` opcional para expresar efectos numéricos: `kind` (`attack`, `heal`, `buff`, `debuff`, `utility`, `rider`), `range`, `area`, `targets`, `targetCount`, `friendlyFire`, `amount` (dados como `2d6` o número fijo), `damageType`, `attackRoll`, `autoHit`, `save` (una salvación de la ficha y el efecto de superarla), `applies` (estados que aplica), `temporary` (puntos temporales de salud), `scales` (cantidad que crece con la ficha), `cost` (reserva que gasta), `perCostStep`, `budget` (parte de la economía de acciones que gasta), `concentration`, `reaction`, `plus`, `free`, `gives`, `standard`, `rider` y `check`.

El selector muestra el bloque en una línea. Quién lee el resto depende del bloque elegido por el conjunto:

- Con [`combat`](#combat-a-fight-your-own-rules-resolve), la pelea lee sus efectos de combate. `range`, `area` y `friendlyFire` se aplican en campos con posiciones; `reaction` marca una entrada que responde a algo y, hasta que pueda nombrar su disparador, no aparece en ningún menú. `check` afecta a pruebas de habilidad, como se explica arriba.
- Con solo [`battle`](#battles-lending-the-sheet-to-marinaras-combat), la batalla lee `kind`, `range`, `area`, `friendlyFire`, `amount`, `damageType` y `cost`, pues el combate propio de Marinara tiene dónde aplicarlos.

El vocabulario es cerrado: las claves o valores que no están en la lista se rechazan en vez de ignorarse.

`cost` también es lo que paga el comando `use` del GM fuera de batalla, descrito a continuación.

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

`pool=` es el lanzamiento a nivel superior: el mismo precio único, pagado desde otra reserva del grupo. Solo se acepta si el coste tiene un único término y la reserva nombrada comparte su grupo. Lo demás se rechaza sin reinterpretarlo.

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

Los archivos separados son para paquetes publicados mediante el catálogo oficial: el paquete los incluye en `contributions.assets.paths` junto a `ruleset.json` y necesita Capability API 1.21. Un catálogo de criaturas, incluido o separado, necesita Capability API 1.27. **Un conjunto importado como archivo único o compartido mediante GitHub incluye sus catálogos dentro del archivo**, de modo que deben caber en el límite total de 256 KB. Eso permite unos cientos de entradas breves.

Los límites son doce catálogos por conjunto, 2000 entradas por catálogo en ambas formas y 1 MB por archivo de catálogo.

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

El bloque `battle` presta al combate las cifras de la ficha, manteniendo la aritmética de Marinara. El bloque opcional `combat` define cómo RESUELVEN tus reglas la pelea. Parametriza un tipo de combate del motor, igual que `resolution` parametriza pruebas; todos sus nombres son tuyos. Actualmente hay un tipo.

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

- `kind`: `"attack-vs-defense"`. Un bando tira contra la defensa del otro; acertar causa daño.
- `health`: obligatorio. Lo que quita la pelea: `{ "pool": "grit" }`, una reserva que disminuye y cuyo margen temporal absorbe primero el daño si existe; o `{ "track": "harm" }`, un contador de heridas que MARCA. El contador necesita `damageKinds` y no concede puntos temporales.
- `defense`: obligatorio, referencia de valor. Un campo introducido por el jugador o un valor derivado que calculas.
- `initiative`: obligatorio. Dados tirados una vez al inicio y referencia opcional de modificador. Los empates favorecen el modificador mayor y después el orden de preparación del combate.
- `attackRoll`: obligatorio. Define dados, si se tira dos veces y se conserva una (`advantage`), qué hacen las caras extremas de un dado (`naturals.max`: `critical`, `hit` o `none`; `naturals.min`: `miss` o `none`) y qué hace el crítico (`critical`: `double-dice` vuelve a tirar los dados de daño; `max-dice` añade una vez sus caras máximas; `none` es un impacto normal). Las caras especiales requieren un único dado, igual que en pruebas. Las salvaciones de combate usan estos mismos dados.
- `economy`: obligatorio. `budgets` define lo que cabe en un turno: ID, etiqueta, `per` (`turn` se repone al inicio del turno del portador; `round`, al empezar una ronda) y `count`. El PRIMER presupuesto es el principal, gastado por acciones estándar. `movement` es una referencia opcional de distancia recorrida por turno, en tu unidad. La leen combates sobre tablero; consulta Posiciones.
- `attacks`: opcional. Listas de ficha cuyas filas son armas. `name` es la columna de nombre; `damage.dice`, la de dados; `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` y `damage.type` nombran columnas de la misma lista. Una columna `ability` es un `enum` con un ID de atributo; otros valores no añaden nada. `proficiency` es `boolean`: activarlo añade competencia. Sin dados legibles, la fila no es un ataque; una cuerda sigue siendo cuerda.

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

- `abilities`: opcional. Listas cuyas filas marcadas por catálogo son capacidades, filtradas como `battle.skills` mediante `onlyWhen` y `alwaysWhen`. Sus efectos son el `mechanics` de la entrada; el bloque establece el `budget` predeterminado, el `toHit` añadido si tira para acertar y la `saveDifficulty` de las salvaciones. Se rechaza una entrada que pide salvación, propia o para terminar un estado aplicado, si su lista no tiene `saveDifficulty`: una salvación contra nada siempre tendría éxito.
- `standard`: opcional, lista cerrada `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. Siempre se resuelven `dodge` (los ataques recibidos se tiran dos veces y conservan el peor) y `help` (el siguiente ataque del aliado se tira dos veces y conserva el mejor). `dash` (otro movimiento completo) y `disengage` (nadie ataca por alejarte este turno) se resuelven en tablero y solo se registran sin él. `hide` y `ready` se aceptan, pero aún no hacen nada.
- `standardEffects`: opcional, efectos de acciones estándar que su indicador no contiene. Hoy solo `dodge`: `{ "dodge": { "saves": ["dex_save"] } }` indica qué salvaciones tira dos veces conservando la mejor mientras dura. Solo nombra salvaciones declaradas, y solo si `standard` incluye `dodge`. Sin esto, esquivar sigue dificultando los impactos y nada más.
- `conditions`: opcional. Asigna TUS IDs de estado a sus efectos para que ficha y combate compartan un registro: un personaje envenenado sigue así después. Lista cerrada: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` y `cannot-approach-source`. `failsSaves` nombra las salvaciones que falla sin tirar. Los seis efectos que requieren distancia o movimiento (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) solo tienen efecto en tablero; consulta Posiciones. `cannot-react` excluye al portador de las ventanas abiertas por movimiento, por lo que no se le pregunta. Hay otras tres claves:
  - `saves`: salvaciones afectadas por los dos efectos de salvación. Sin ella, todas; declararla sin uno de esos efectos se rechaza.
  - `whileSourceInSight`: lo que solo cuenta mientras quien lo aplicó esté a la vista del portador. `true` condiciona todo el estado; una lista de sus efectos condiciona solo esos y conserva el resto, como un miedo que impide acercarte aunque no veas el origen. Se rechazan efectos que el estado no tenga. Sin tablero no hay línea de visión que romper y todo cuenta igualmente.
  - `endsWhenSourceDown`: se quita en cuanto cae quien lo aplicó.

  `own-saves-advantage` y su opuesto tiran dos veces y conservan una, como los ataques; se cancelan entre sí. `resist-all` reduce a la mitad todo daño además de las defensas propias del objetivo y se cancela con una vulnerabilidad de la misma manera. `cannot-target-source` impide apuntar cualquier cosa a quien lo aplicó. `cannot-approach-source` impide acercarse más que la casilla actual, incluido el camino: permite rodear hasta otra igual de distante, pero no pasar cerca y salir por el otro lado.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

- `concentration`: opcional. Campo vivo `text` que registra lo mantenido, `save` exigida por el daño, `floor` mínimo de dificultad y `fromDamage`, proporción del daño que la fija si es mayor. Empezar otra capacidad de concentración termina la anterior; fallar la salvación la termina y quita los estados que mantenía.
- `dying`: opcional, `kind: "saves"`. Dos contadores de tiradas (la cantidad necesaria es el máximo de cada uno), `dice`, `succeedAt`, efectos de caras extremas (`naturals.max`: `revive-1` o `success`; `naturals.min`: `one-failure` o `two-failures`), coste de daño estando caído (`damageWhileDown`, `criticalWhileDown`) y `condition` del personaje caído. Sin bloque, salud cero solo lo deja caído y curar lo devuelve.
- `damageTypes`: opcional. Tipos del sistema, comparados sin distinguir mayúsculas.
- `damageKinds`: obligatorio si `health` es un contador de heridas y rechazado si es una reserva; solo una marca conserva un tipo. Define qué `kinds` marca cada golpe y cuántas casillas. `default` recibe lo no asignado, incluido daño sin tipo; `byType` asigna `damageTypes` a tipos de marca, ignorando mayúsculas: `"Fire"` y `"fire"` son una clave y declarar ambas se rechaza. `marks` no tiene predeterminado porque las respuestas son opuestas: `"per-point"` cuenta niveles de salud según daño, así que tres de daño marcan tres casillas y reducirlo ayuda; `"per-blow"` marca una casilla si el golpe acierta, sea cual sea su fuerza. Un golpe con varias cláusulas marca una casilla usando el tipo más grave que llegó. Indica cuál usa el sistema: `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `threat`: opcional y necesario para bestiarios. `tiers` es la escala de adversarios: ID, etiqueta, intervalo `health`, `defense`, `toHit`, intervalo `damagePerRound` y `saveDifficulty`. Cada criatura nombra un nivel; un adversario no escrito se adapta al que pidió el GM, sin salirse de tu escala. `damagePerRound` expresa lo que hace a UN objetivo por ronda, incluida toda su secuencia.

### Qué lee un combate de `mechanics`

`kind` determina si `amount` es daño o curación; cualquier entrada marcada como `reaction` queda fuera del menú, al igual que una entrada `utility`, salvo que cambie lo que puede contener el propio turno (véase más abajo). `attackRoll` realiza una tirada contra la defensa del objetivo con el `toHit` de la lista; `autoHit` omite por completo ese paso. `save` tira la salvación del propio objetivo contra la `saveDifficulty` de la lista, y `onSuccess` determina si un éxito recibe la mitad o nada. `targetCount` indica a cuántos objetivos puede dirigirse. Una capacidad que no tira para atacar (un área contra la que todos realizan una salvación, algo que impacta directamente) tira sus dados UNA VEZ para todos ellos; una que tira para impactar a cada objetivo vuelve a tirar sus dados por cada impacto. `applies` impone condiciones a lo que afecta, cada una con una `duration` de `instant` (sin reloj propio: permanece hasta que algo la retire), `until-save` (que necesita `saveEnds` a su lado) o `{ "rounds": n }`, y un `saveEnds` opcional que identifica la salvación y si se repite en `turn-end` o `turn-start`. `temporary` concede puntos temporales a la reserva de salud, que nunca se acumulan: se conserva la protección mayor. `scales` aumenta la cantidad con los DADOS adicionales que su tabla indica para el valor que lee. `cost` se paga mediante el comando `use` de la propia ficha, y `budget` sustituye qué parte de la economía se consume.

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

`sources` identifica las listas de ataques de las que procede y `requires` una columna de sus filas con valor verdadero, de modo que un efecto adicional que solo se activa con ciertas armas puede especificarlas sin que Engine sepa qué es un arma; no indicar ninguna significa cualquier impacto de su poseedor. `when` acepta CUALQUIERA de sus opciones: `advantage` es la inclinación final de la tirada de ataque, y `ally-adjacent` es un aliado del atacante que esté en pie y pueda actuar, a una casilla del objetivo en un tablero o en cualquier lugar si no hay tablero. `oncePer` es `turn` (se renueva al inicio de todos los turnos, de modo que un golpe realizado mientras actúa otra persona todavía puede incluir uno) o `round`. `amount` crece con el `scales` de la propia entrada, y `type` es el tipo de daño, cuyo valor predeterminado es el del propio golpe.

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

Los números siguientes son la forma directa de escribir una criatura. Una escrita en los términos de tu propio conjunto de reglas, como `sheet`, obtiene de esa ficha `health`, `defense`, `initiativeModifier`, `speed`, `abilities` y `saves` (véase «Una criatura escrita en los términos de tu conjunto de reglas», más abajo).

- `health`: un número, o `{ "dice": "3d6", "flat": 2 }`, que se tira una vez al crear el combate. Una previsión lee la media, de modo que un menú nunca promete un dado que nadie ha tirado.
- `defense`, `initiativeModifier`, `speed`: contra qué se tira un ataque, qué se suma a la iniciativa y cuánto camina en un turno, en tu propia unidad de distancia.
- `abilities` y `saves`: usan como claves los identificadores de características y salvaciones que declara tu ficha. Una salvación no indicada se lee como cero.
- `resist`, `vulnerable`, `immune`: tipos de daño, comparados sin distinguir mayúsculas, que se validan contra `combat.damageTypes` cuando declaras alguno. `conditionImmunities` identifica tus propias condiciones.
- `tier`: a qué peldaño de `combat.threat` pertenece.
- `traits`: pares breves de nombre y texto que se muestran al Game Master. Nunca se resuelven, por lo que cualquier cosa con números pertenece a una acción.
- `signaturePoints`: puntos que se recuperan al inicio de su propio turno y se gastan en acciones `signature`.
- `riders`: hasta cuatro, equivalentes al `rider` de una entrada de catálogo, escritos en el bloque. Cada uno es `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, con un `type` opcional y un `actions` opcional que indica con cuáles de las acciones del propio bloque se activa. El efecto adicional de un bloque no lee ninguna lista de ficha, por lo que no tiene las claves `sources` y `requires`. Una criatura escrita como ficha obtiene los efectos adicionales de sus listas, exactamente igual que un personaje.
- `actions`: hasta doce, cada una con su propio `id`. Una acción lleva lo mismo que un bloque de estadísticas escrito a mano (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), más cuatro cosas exclusivas de las criaturas. `reach` indica hasta dónde golpea, `range` hasta dónde se lanza o dispara y `area` la forma en la que impacta, todo en tu propia unidad de distancia; `range` puede ser un número simple o `{ "normal": 30, "long": 120 }` si llega más lejos con una penalización, y `area` es `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (véase Posiciones):
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. Cuando se agotan, la acción sale del menú.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Empieza el combate disponible, se gasta al usarla y se tira al inicio del propio turno de la criatura: `from` o más la recupera. El registro incluye los dados en ambos casos.
  - `sequence`: otras acciones del mismo bloque, en orden, cada una con su propio objetivo. **Así se escribe una criatura que golpea dos veces con una sola acción.** Un presupuesto paga toda la secuencia. Una secuencia no lleva nada propio y nunca puede identificar otra secuencia.
  - `signature`: `{ "cost": n }`, se compra con los puntos de la propia criatura en lugar de un presupuesto y solo mientras actúa otra persona: el combate la ofrece en la ventana entre un turno y el siguiente (véase Ventanas).
- Una salvación necesita una dificultad en la propia acción: `save.difficulty` para una salvación que impone la acción, o `saveDifficulty` para una condición que termina con una salvación cuando la acción no tiene la suya propia. Una acción de bloque se escribe con números simples incluso en una criatura con ficha, así que ese número reside en la acción. La salvación de una cláusula puede omitir su `difficulty` y recurrir al mismo número.
- `damage.plus` es la misma lista de cláusulas que el `plus` de una entrada de catálogo y se lee exactamente igual: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` es un mordisco cuyo calor tiene su propia cantidad, a la que se aplica resistencia y que se duplica por separado.

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
- **Cada número tiene un único origen.** Una criatura con ficha no proporciona también `health`, `defense`, `initiativeModifier`, `speed`, `abilities` o `saves`, y Engine rechaza el archivo si lo hace. Puede no tener `actions` propias, porque sus listas son lo que hace. Una criatura sin ficha sigue proporcionando los tres primeros y al menos una acción.
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
"cover": { "bonus": 2 },
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

**Línea de visión y cobertura.** Una línea recta de casillas entre ambos: cualquier cosa sólida en ella bloquea un disparo e impide que un área se extienda más allá, y el objetivo simplemente no aparece en el menú. El terreno que sirve de cobertura suma `cover.bonus` a la defensa contra la que se tira el ataque, y el registro lo indica. No hay cobertura de tres cuartos, cobertura total ni elevación.

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

El combate se desarrolla en la pantalla de batalla con tus palabras. El menú contiene tus ataques, tus capacidades y las acciones estándar que enumeraste, indicando cada una qué gasta de tus presupuestos y reservas. Se muestran el orden de turnos, la ronda, cada condición que identificaste con sus rondas restantes, los puntos temporales, la concentración y los dos contadores de tu regla de agonía. El registro imprime la aritmética real en tus términos: "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Cada acción aceptada se escribe en la ficha al ocurrir, por lo que recargar a mitad del combate es exacto y después se indica al Game Master que no vuelva a cambiar esos números.

Un combate con posiciones se dibuja en el tablero en lugar del escenario de retratos; véase Posiciones para saber qué hace el jugador con él. Toda distancia en él, en el menú y en el registro se expresa en TU unidad: "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Ventanas: mantener abierto el combate

Algunos momentos pertenecen a alguien distinto de quien está actuando. Engine mantiene el combate abierto para esa persona en lugar de decidir por ella, y esa pausa es una ventana.

Cuatro cosas abren una, y dos proceden de lo que ya declaraste:

- **Alguien se aleja.** Un movimiento que sale del alcance de un enemigo capaz de golpear se detiene en ese paso y le pregunta. Véase Golpes contra quien se aleja, más arriba.
- **Entre un turno y el siguiente.** Cuando termina un turno, se pregunta a cada oponente con `signaturePoints` que pueda pagar una de sus propias acciones `signature` si desea comprarla, antes de iniciar el siguiente turno. Es el único momento en el que se compran: una acción distintiva no aparece en el menú de turno de nadie, incluido el suyo.
- **Algo apunta a alguien.** Antes de resolverlo, se pregunta a todos los objetivos del OTRO bando que tengan una entrada a la espera de ese momento. Un amigo que te cura no es una amenaza a la que responder, así que una acción de un amigo no abre ninguna ventana.
- **Algo ha dañado a alguien.** Después de resolverlo, se pregunta a todos los que hayan recibido daño y tengan una entrada a la espera de ESE momento, sea quien sea el causante. Recibir daño es un hecho sobre ti; una entrada dirigida de vuelta a quien lo causó sigue sin poder apuntar a un amigo.

Las dos últimas son las que solicita una entrada de catálogo al identificar el momento que espera.

Qué hace una ventana, sea cual sea su causa:

- **Nada más se mueve mientras está abierta.** Ni el actor cuyo turno está en curso, ni el final de ese turno, ni otra ventana. El combate espera.
- **Pregunta de uno en uno**, en orden de turno, una sola vez a cada uno. Pasar siempre es una respuesta y no cuesta nada. Si alguien consultado no tiene ninguna opción que pueda ejecutar, se omite en lugar de preguntarle.
- **Continúa exactamente donde se detuvo.** Un movimiento termina por las casillas que le quedaban, pagando cada una de las que realmente cruzó.
- **Responde quien los interpreta.** La ventana de tu propio miembro del grupo es tuya, con la opción y **Pass** (pasar) a su lado en el menú; la de un oponente la responde quien lo interpreta, y a un jefe del Game Master se le pregunta mediante el Game Master, con dejar pasar el momento como una de las respuestas.
- **Se guarda con el combate.** Una partida cerrada a mitad de un movimiento vuelve con las mismas personas pendientes de responder y las mismas casillas por recorrer.

No declaras nada para las dos primeras: un conjunto de reglas con `opportunity.budget` obtiene una, un bestiario con `signaturePoints` obtiene la otra, y uno sin ambos nunca las ve.

**Indicar qué momento espera una entrada.** Escribe `mechanics.reaction` como un objeto en lugar de `true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` es `aimed` o `harmed`, y es lo que coloca la entrada en el menú de esa ventana. Son los únicos dos momentos que vigila Engine. Una entrada que todavía indique `"reaction": true` solo dice que no se ejecuta en un turno; eso no basta para ofrecerla en ningún lugar, así que no aparece en ningún menú.
- `at` es `source` (el valor predeterminado) o `chosen`. `source` dirige lo ejecutado hacia quien causó el momento y completa el objetivo, de modo que no se pide elegir a nadie; `chosen` conserva los objetivos propios de la entrada y pregunta.
- `cancels` impide por completo que suceda lo que retenía la ventana. Solo una entrada `aimed` puede indicarlo: un momento que ya ocurrió no puede cancelarse.

Dale también un `budget`, o gastará el predeterminado de la lista. Una reacción casi siempre gasta un presupuesto propio, lo que impide que un turno contenga varias.

**Su coste se gasta antes de preguntar a nadie.** Una acción cancelada deja de suceder, pero no deja de haberse comprado: el presupuesto y las reservas ya se gastaron. Si tu sistema los devuelve, todavía no puede expresarlo.

Un paquete que identifique un momento necesita Capability API 1.33.

### Todavía no

Dicho claramente, porque un conjunto de reglas no debe prometer lo que Engine no hace:

- **Más allá del tablero modesto**: no hay cobertura de tres cuartos ni total, elevación, vuelo sobre obstáculos, paso por espacios estrechos, monturas, movimiento de agarre o empujón, ocultación ni sorpresa, y nada empuja a nadie a ningún lugar.
- **Una entrada solo puede esperar dos momentos**, `aimed` y `harmed` (véase Ventanas, más arriba). Son los momentos que Engine detecta en nombre de una entrada; las otras dos ventanas, alguien que se aleja y la pausa entre turnos, las abre el propio combate y no son momentos que pueda solicitar una entrada. No existe un momento para una tirada de salvación, un conjuro lanzado como tal, una muerte, el inicio de un turno o una caída.
- **No se encadenan.** El combate mantiene una ventana en lugar de una pila, así que nada abierto dentro de una ventana abre otra: una contra no puede recibir a su vez una contra, y lo que inflija una reacción no abre otro momento.
- **Una reacción detiene algo o hace algo; no puede cambiarle un número.** No hay forma de decir «más difícil de impactar hasta tu siguiente turno», porque una condición es un nombre de una lista cerrada en lugar de un modificador. Es una limitación de las condiciones, no de las reacciones.
- **No se devuelve nada.** Lo que costó una acción cancelada queda gastado.
- Las condiciones hacen lo que puede expresar la lista cerrada de efectos y nada más. Actualmente, una condición que imponga desventaja a PRUEBAS de característica, o que empeore por niveles como el agotamiento, es un simple registro en la ficha.
- **Una criatura escrita con números simples no tiene contador de heridas.** En un conjunto de reglas cuya salud sea un contador, esa criatura sigue perdiendo puntos; dale una `sheet` y sus golpes marcarán casillas, mitigados primero por sus propios `resist`, `vulnerable` e `immune`.
- **Un efecto adicional se activa solo.** `on` tiene un único valor, `hit`, así que lo aplica el primer impacto del período que cumpla los requisitos, sin ningún momento en el que se pregunte si deseas gastarlo.

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

**Qué no puede hacer una capa.** No puede añadir un valor enumerado, un campo, una habilidad, una reserva o un descanso, cambiar el tipo de resolución, tocar el estado en vivo o los números de combate ni añadir una llamada a un modelo. Un valor que una capa _añadiera_ sería desconocido para todos los demás lectores de la ficha, así que los valores solo se retiran. Todo lo que quede fuera de esta lista es un cambio del propio conjunto de reglas o un segundo conjunto.

**Conflictos.** `conflicts` identifica capas que no pueden estar activas juntas. Basta con indicar un lado del par. El asistente desactiva el otro interruptor y, si una elección guardada contiene ambos de algún modo, se descarta la capa declarada **después**, para que las mismas dos elecciones siempre produzcan las mismas reglas.

**Una ficha que ya contenga un valor retirado lo conserva.** Nada reescribe al personaje. El editor simplemente deja de ofrecer el valor, y un personaje que ya lo tenía lo muestra tal como es. Desactiva la capa en una nueva partida y el valor volverá a ofrecerse. Lo mismo ocurre con una entrada de catálogo oculta: queda fuera del selector y una fila que el jugador ya eligió permanece en la ficha.

**Límites.** 12 capas por conjunto de reglas y 4000 caracteres de instrucciones por capa, contando ambas cadenas juntas. Un conjunto de reglas empaquetado que declare `layers` o un `gm.worldGuidance` base necesita Capability API 1.25. Uno que importes lo valida Engine al leerlo, así que no necesita nada.

**Las capas escritas por otra persona** (una capa de magia escasa para un conjunto de reglas que no escribiste, distribuida en su propio archivo) llegarán más adelante. Actualmente, una capa se distribuye dentro del conjunto de reglas al que pertenece.

<a id="trying-your-ruleset"></a>

## Probar tu conjunto de reglas

Los conjuntos de reglas comunitarios usan el mismo interruptor que los agentes importados. Abre **Settings** (ajustes) > **Advanced** (avanzado) > **Danger Zone** (zona de peligro) y comprueba que **Allow custom Agent imports** (permitir importaciones de agentes personalizados) esté activado. La importación también necesita acceso desde localhost o **Admin Access** (acceso de administrador) configurado.

1. Abre el panel **Agents** (agentes) y elige el botón **Import agents** (importar agentes), el icono de descarga de la fila de botones de la parte superior del panel.
2. Elige **Game Mode ruleset** (conjunto de reglas del modo de juego) y selecciona tu archivo JSON.
3. Lee la revisión. Muestra el nombre, la versión, la licencia, lo que cubre el conjunto de reglas y el texto del Game Master. Elige **Import** (importar).

Tu conjunto aparece en la sección **Rules** (reglas) del panel y en la elección **Rules** del asistente de configuración para nuevas partidas. Uno importado desde un archivo se clasifica como `local/<your id>`, de modo que nunca pueda confundirse con uno oficial ni con el de otra persona.

### Cambiar un conjunto de reglas que ya importaste

Una versión importada nunca se reescribe. Si cambias el archivo y lo vuelves a importar con la misma `version`, la importación se rechaza y te pide aumentar el número. Es intencional: una partida está ligada a la versión exacta con la que se creó, para que una campaña en curso nunca despierte con cálculos diferentes.

Por tanto, el ciclo durante la redacción es: editar, aumentar `version`, importar, iniciar una partida nueva. Las versiones antiguas permanecen instaladas junto a la nueva hasta que retires el conjunto de reglas de la sección **Rules**. Retirar uno que todavía usa una partida hace que esta indique que falta su conjunto de reglas hasta que vuelvas a importarlo.

Si cambias la estructura de la ficha (añades, retiras o renombras elementos), aumenta también `sheet.version`. Las fichas existentes se leen con tolerancia: se conservan los valores que la nueva ficha no conoce y los ausentes toman sus valores predeterminados.

## Compartir tu conjunto de reglas

**Como archivo.** Envía el archivo JSON a un amigo. Lo importa igual que tú.

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

