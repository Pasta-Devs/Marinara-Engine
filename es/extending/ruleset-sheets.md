# Fichas de conjuntos de reglas

Esta página forma parte de [Escribir conjuntos de reglas de Game Mode](writing-rulesets.md). Qué contiene la ficha de personaje de un conjunto de reglas: atributos, habilidades, campos y listas, estados vivos, contadores de heridas, penalizaciones, descansos y el texto del Game Master, además de la ficha del grupo y los relojes de progreso.

## La ficha

- `sections` agrupa elementos en el editor. Los campos, valores derivados y listas nombran con `section` la sección en la que están, y también pueden hacerlo los atributos, habilidades y salvaciones: el editor, la ficha de la partida y el bloque de ficha del GM los muestran entonces bajo ese encabezado (una ficha que no les asigna sección los muestra exactamente como antes). Una sección también puede llevar una regla `untrained` (abajo).
- `abilities` son las puntuaciones principales. `skills` y `saves` pueden nombrar el atributo con el que tiran, un `cap` y una regla `untrained` (abajo).
- `fields` contiene valores individuales. Tipos: `number`, `text`, `longtext`, `boolean`, `enum` (lista fija de opciones) y `dice` (texto como `1d8`). Un campo `text` o una columna de lista puede añadir `suggestions` (Capability API 1.796): hasta 40 palabras ofrecidas como fichas debajo, cada una de las cuales se añade a lo escrito, y se sigue pudiendo escribir libremente en el campo, como los enemigos predilectos de un explorador elegidos entre los tipos de criatura. Un campo así también puede indicar cuántos elegir con `pick` (Capability API 1.797), un valor leído de la ficha, como un recuento derivado que aumenta con el nivel de clase: el editor dice "Choose N" (Elegir N), muestra cuántos se han elegido y deja de ofrecer más fichas una vez que hay N, aunque nunca se rechaza lo escrito.
- Los valores `derived` se calculan a partir de otros y no pueden sobrescribirse a mano. Una ficha puede tener hasta 800 (Capability API 1.729; 400 desde 1.111, 240 desde 1.88, 120 desde 1.84 y 60 antes); un paquete con más de 240 declara 1.111, y uno con más de 400 declara 1.729. Las operaciones son `sum`, `min`, `max`, `scale` (multiplicar por un número fijo y redondear), `multiply` (de dos a seis valores multiplicados entre sí, como el modificador de Constitución por el nivel; Capability API 1.82), `stepTable` (consultar umbrales, como cuando un nivel determina competencia) y `enumTable` (un número para cada valor de un campo enum o de un estado vivo; consulta Estados vivos más abajo).
- `lists` son tablas con columnas propias, como equipo, conjuros o rasgos. Una lista tiene hasta 24 columnas; un paquete con una lista de más de 12 declara Capability API 1.165. Una lista con `pools` convierte cada fila en un recurso con máximo propio, para rasgos de clase de usos limitados. Una columna numérica puede rellenarse con una tirada: `"roll": { "count": 1, "sides": 8 }`, donde `sides` es un número, otra columna de la misma fila (`{ "column": "die" }`, una columna numérica o un enum cuyos valores se leen como dados, como `d8`) o un valor de la ficha. El editor de la ficha muestra un botón Roll que tira los dados del propio motor y escribe el total, limitado al `min` y al `max` de la columna (Capability API 1.85).
- `live` es lo que cambia al jugar: `pools` (puntos de golpe, espacios de conjuro, Grit), `tracks` (número en una escala, como agotamiento, o contador de heridas con casillas), `text` (notas breves, como la concentración), `conditions` y `states` (un valor de un conjunto cerrado, como una forma o una postura).

Todo lector de números los nombra con una referencia de valor: un objeto con exactamente una clave entre `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` e `itemStat`. Por ejemplo, una reserva con máximo derivado: `"max": { "derived": "grit_max" }`.

- `listSum` suma una columna numérica de una lista: `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` es opcional y nombra una columna booleana; solo cuentan las filas donde está activada. Una celda vacía cuenta como el valor predeterminado de su columna, y una lista oculta por `hideWhen` no suma nada. Ember Roads calcula así Burden a partir del equipo que lleva cargado el personaje, de modo que nunca puede desviarse de la lista como lo haría un número escrito a mano. Una columna escalada de catálogo no puede leer una suma de lista, ni siquiera mediante un valor derivado: una lista puede contener celdas escaladas, propias o que vuelven a leerla, y el recálculo nunca terminaría.
- `livePool` lee lo que queda en una de tus `live.pools` (la reserva de una fila de lista no es una de ellas). `liveTrack` lee uno de tus `live.tracks`, con un `read` opcional: `"value"`, dónde está (predeterminado); `"filled"`, cuánto supera su `min`; `"remaining"`, cuánto le falta para su `max`; o, solo en un contador de heridas, `"penalty"`, la penalización vigente. Una reserva o contador oculto lee 0. "Harm still to take" de Gravewatch es `{ "liveTrack": "harm", "read": "remaining" }`.
- Una lectura viva toma el estado vivo tal como está cuando se tira una prueba, empieza un combate o se escribe el bloque de ficha del GM. Si aún no hay ninguno (el editor de fichas, la revisión de una importación), lee el estado con el que empieza el juego: una reserva llena o vacía según su `start`, un contador en su `default`, un contador de heridas limpio.
- Nada que se calcule antes de que exista un estado vivo puede leer uno: el `max` de una reserva o de un contador, la bonificación de competencia, o la columna escalada o el escalado de un catálogo. Eso se mantiene a través de un valor derivado que lea uno y de una habilidad limitada por un valor vivo, y la importación nombra el valor que lo hace.
- Estos tres requieren Capability API 1.39 en un conjunto empaquetado.
- `itemStat` lee los objetos que tiene el personaje, como la guardia de la armadura que lleva puesta, y sigue la misma regla que una lectura viva. Consulta [Objetos en la ficha](ruleset-items.md#items-on-the-sheet). Capability API 1.52.

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

## Estados vivos: una forma, una postura, una luz

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

<a id="wound-tracks-health-that-is-a-track-not-a-number"></a>

## Contadores de heridas: salud en una escala de marcas

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

### Casillas numeradas en vez de niveles con nombre

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

### Llenar por casilla y contadores que rechazan

- `"fill": "indexed"` coloca una marca en la casilla que nombra el comando con `box=` (la primera si no nombra ninguna), o en la siguiente libre por encima de ella, y nunca mueve una marca ya colocada. Una curación elimina la más alta de las marcas más leves. La pantalla de ficha permite al jugador hacer clic en cualquier casilla libre.
- `"onFull": "refuse"` rechaza una marca que no tiene casilla libre, en vez de aumentar la gravedad de la marca más leve. Se rechaza el comando entero, así que tres marcas con dos casillas libres no colocan ninguna. Un contador indexado siempre rechaza; indícalo con `"onFull": "refuse"` a su lado.

### Niveles que añade una lista

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` en un contador con niveles con nombre permite que una lista de la ficha lo alargue para cada personaje. Cada fila, en orden, añade su cantidad de niveles (16 como máximo) con su penalización, después del último nivel cuya penalización sea al menos igual de buena, con el nombre de ese nivel si las penalizaciones coinciden y, si no, con el de la penalización. Las cicatrices de Gravewatch funcionan así. Una lista que la ficha oculta no añade nada, y si se borra una fila mientras sus niveles están marcados, las marcas que ya no caben se conservan como desbordamiento: editar la ficha no deshace el daño.

`boxes`, `fill`, `onFull`, `extra` y el `kind` de un paso de descanso requieren Capability API 1.40 en un conjunto empaquetado.

## La penalización de las tiradas

`resolution.penaltyFrom` nombra el contador de heridas que penaliza todas las pruebas del conjunto. Se declara, no se presupone: sin él, las tiradas funcionan igual que antes de que existieran los contadores.

Lo que HACE la penalización depende del tipo de resolución, igual que el número de la ficha:

- En `dice-pool`, **quita dados de la reserva**, con mínimo `pool.min`. Un `pool.min` de 1 permite tirar un dado incluso desde el último peldaño; un `pool.min` de 0 permite no tirar ninguno y fallar sin lanzar.
- En `dice-sum`, es un **modificador fijo**, incorporado al mismo número al que ya contribuyen atributo y entrenamiento.

Debe nombrar un contador de heridas. Uno ordinario no tiene penalización y se rechaza al importar. El resultado indica la aplicada, para que el jugador entienda por qué tiró menos dados; el bloque de ficha del GM también muestra el peldaño y su coste.

## Modificadores fuera de la ficha

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

## Descansos

Un descanso es una lista de restauraciones y elementos que borrar. Cada paso nombra un objetivo (`pool`, `poolGroup`, `listPools`, `track` o `state`) y lo fija (`"to": "max"`, `"to": "min"` o un número) o modifica (`"by": { "const": 1 }` o `"by": { "fractionOfMax": 0.5 }`). Si nombra un contador de heridas, solo puede curarlo, así que su `by` es negativo; consulta arriba. Un paso que nombra un estado vivo solo lo fija, en `"default"` o en uno de sus valores. Un paso `poolGroup` con `fractionOfMax` cambia cada reserva del grupo según su propia fracción; añade `"shared": true` (Capability API 1.77) para calcular la fracción sobre el máximo de todo el grupo y repartirla entre las reservas del grupo en el orden en que las lista la ficha, cada una hasta lo que le falta. El descanso largo de 5e, "la mitad del número total de" dados de golpe del personaje, guardados en una reserva por dado, es `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

## Texto del Game Master

- `checkGuidance` sustituye el párrafo integrado que enseña a pedir pruebas. Indica el sistema y cuándo tirar. El GM solo nombra habilidad y dificultad. El motor tira y calcula desde la ficha: no pidas al modelo que haga matemáticas.
- `sheetGuidance` presenta las fichas en el prompt. Explica qué recursos importan y cuándo gastarlos.
- `worldGuidance` es opcional y se lee una vez al generar el mundo para adaptar la ambientación a las reglas: sin pólvora, magia escasa, muertos que caminan. Nunca llega a un turno.
- `opposition` indica quién juega el otro bando de una pelea (Capability API 1.774). `"game-master"` cede el turno de cada oponente al Game Master, que elige una de las opciones que ofrece el Engine, con el selector del propio Engine como respaldo cuando no responde. Se aplica solo en una partida cuyo jugador haya permitido al Game Master jugar los jefes, y en todos los estilos de combate, incluida una pelea Classic o Tactical para un conjunto de reglas sin bloque `combat`. Úsalo para un sistema narrativo cuya oposición se juega como ficción en lugar de como una suma de daño: Fate, Blades in the Dark, Trophy, Lasers & Feelings. `"engine"`, u omitirlo, mantiene el selector del Engine, con los jefes (y, cuando lo pide el jugador, los oponentes con nombre y con mentalidad de genio) a cargo del Game Master. Un conjunto de reglas que use esta clave necesita Capability API 1.774.
- `sheetSummary` elige campos, valores derivados y filas de listas que ve el GM de cada personaje. El motor siempre muestra modificadores de atributo, habilidades y salvaciones entrenadas y valores vivos. Mantén breve lo demás, pues se envía en cada turno. El `nameColumn` de una lista del resumen puede ser una columna de texto o enum (un enum muestra la etiqueta de su valor), y `columns` nombra hasta tres columnas más de la propia fila que se muestran tras el nombre, para que el bloque diga `Gear: Crowbar 1d6` en vez de solo nombres. Una columna booleana muestra su etiqueta cuando está activada. Ambos requieren Capability API 1.37 en un conjunto empaquetado.
- No hace falta enseñar el comando de ficha en `sheetGuidance`. El motor enseña cada comando por sí mismo, con los nombres que declara tu archivo, y si tu conjunto tiene un contador de heridas añade el comando `op="damage"` para marcarlo y enumera sus niveles y tipos de daño. Si tiene estados vivos, añade el comando `op="state"` y enumera los valores que puede tomar cada uno.

## Referencia completa de reglas para el GM

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
