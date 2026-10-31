# Creador de personajes de conjuntos de reglas

Esta página forma parte de [Escribir conjuntos de reglas de Game Mode](writing-rulesets.md). El creador guiado: crear un personaje por pasos, desde la raza y la clase hasta las puntuaciones, las competencias, los conjuros y el equipo.

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

Hasta 32 pasos, cada uno `{ id, label, kind, ... }`; un paquete con más de 16 declara Capability API 1.112, y uno con más de 24, Capability API 1.768:

- `catalog`: entradas de un catálogo de filas, mostradas como tarjetas con su `summary` detrás de **Info** (Información). `min` (1 de forma predeterminada) es cuántas pide el paso y `max` (1 de forma predeterminada), el máximo que admite; con `max` 1, una selección nueva sustituye a la anterior. Ambos pueden llegar a 60; un paquete con cualquiera de los dos por encima de 20 declara Capability API 1.110, y uno con cualquiera de los dos por encima de 40, Capability API 1.768 (el libro de conjuros de un mago de nivel 20 contiene 44 conjuros). `field` nombra un campo de texto o enum en el que se escriben las etiquetas seleccionadas (un campo enum toma el ID o la etiqueta de la entrada, el que sea uno de sus valores). `filters` fija valores de los filtros del catálogo, y `within: { step, filter }` solo ofrece entradas cuyo `filter` nombra una entrada seleccionada en ese paso anterior, como una subraza nombra su raza; si se deselecciona la raza, su subraza no cuenta para nada. `upTo: { filter, value }` (Capability API 1.87) solo ofrece entradas cuyo `filter` numérico sea como máximo `value`, un valor que se lee de la ficha tal como está, como los rasgos hasta el nivel del personaje (`{ "filter": "level", "value": { "derived": "level" } }`); una entrada sin el filtro siempre se ofrece, y una selección que la ficha ya no alcanza no cuenta para nada, pero se conserva. Una selección que cambia el valor leído (una clase que fija el nivel) se resuelve en el mismo cambio, igual que un valor cambiado en **All fields** (un nivel que se baja ahí retira al instante lo que dio un rasgo por encima de él). `countFrom` (Capability API 1.90) es un valor que se lee de la ficha del mismo modo y que vale a la vez como `min` y `max`: cuántas entradas pide el paso y el máximo que admite, redondeado hacia abajo y nunca por encima de `max`, como los conjuros que conoce una clase al nivel del personaje (`{ "derived": "spells_known" }`). Las selecciones que lo superan se conservan, pero no cuentan para nada hasta que vuelva a subir la cuenta. Un paso de catálogo también puede llevar `stamp` (Capability API 1.108), de 1 a 4 valores de columna que se escriben en cada fila que añade, como `"stamp": { "class": "wizard" }` en el paso de conjuros del mago y `"stamp": { "class": "cleric" }` en el del clérigo. Cada clave debe ser una columna de todas las listas que alimenta el catálogo; los valores son cadenas, números o booleanos. El sello sustituye al valor inicial del catálogo. Las filas existentes y las ediciones posteriores en **All fields** siguen siendo del jugador. Con Capability API 1.130, un valor del sello puede ser en su lugar un objeto cuyo `fromWithin` sea `"id"`, `"label"` o un ID de filtro declarado por el catálogo padre: lee el primer padre coincidente en el orden de selección, escribe una cadena o un número una sola vez al añadir la fila, y deja esa columna sin sello si no coincide ningún padre o si su filtro falta o es un array.

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
- Una entrada de catálogo puede nombrar un grupo `exclusive` (Capability API 1.94): un paso del creador conserva una selección de cada grupo, así que seleccionar una descarta la otra selección del paso de ese grupo, y solo cuenta la última. Una dote tomada en lugar de una mejora de puntuación de atributo comparte grupo con ella: `"exclusive": "fighter-asi-4"`. `"exclusiveDefault": true` (Capability API 1.772) hace que una entrada sea la que un paso que toma todo lo que ofrece toma de su grupo hasta que el jugador selecciona otra.
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

Un paso de filas puede indicar cuántas filas quiere con `countFrom` (Capability API 1.799), un valor que se lee de la ficha: las tiradas de puntos de golpe de 5e, una por nivel después del 1.er nivel. Cuando se muestra el paso, el creador añade filas, cada una tal como la crea **Add a row**, hasta que las propias filas del jugador llegan a esa cantidad, sin superar nunca `max` ni el `maxItems` de la lista; nunca retira una fila, y una fila eliminada ahí sigue eliminada hasta que se vuelve a mostrar el paso. Un personaje que se está describiendo no recibe filas por mirar el paso. El paso espera entonces esa cantidad de filas completas, como hace con `min`, la mayor de las dos cuando se dan ambas, y muestra la misma cuenta "N of M" (N de M). Un conjunto de reglas que lo use necesita Capability API 1.799.

```json
{
  "id": "hit_point_rolls",
  "label": "Hit point rolls",
  "kind": "rows",
  "list": "hp_rolls",
  "required": ["die", "roll"],
  "countFrom": { "derived": "hp_rolls_due" }
}
```

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
