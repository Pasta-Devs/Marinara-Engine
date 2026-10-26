# Escribir guiones de historia de Game Mode

Un guion de historia permite a quien lo escribe guiar cómo se desarrolla una partida de Game Mode: escenas que se
reproducen cuando el grupo llega a algún sitio, cosas que se le piden al Game Master cuando se cumple una condición,
objetivos que el jugador sigue en el diario y momentos que el propio Game Master puede marcar. Esta guía es para quienes
escriben los suyos. Para jugar un mundo que tiene una historia, empieza por [Crear un mundo](../game/getting-started.md#making-a-world).

Un guion de historia son datos, no código. Nada en él se ejecuta. El motor lo comprueba contra el mundo al que
pertenece, lo reproduce turno a turno y rechaza todo lo que no encaje.

## Dónde vive una historia

Una historia pertenece a un solo mundo. Nombra los lugares y los habitantes de ese mundo, así que solo tiene sentido
con el mundo para el que se escribió (su semilla, su descripción y sus ediciones a mano).

- En un **archivo de mundo** (`.world.json`), como un `story` de nivel superior junto a `world`. Una versión del motor
  que no conoce las historias sigue leyendo el mundo.
- En el **paquete de mapas** de una Experience: cada archivo de mundo puede llevar su historia, y una partida nueva
  la toma junto con el mapa. Consulta [paquetes opcionales de agentes](../development/optional-agent-packages.md).
- En un mundo guardado en la biblioteca, fuera de cualquier partida: `GET`, `PUT` y `DELETE /api/game-worlds/:id/story`,
  igual que en una partida. Una partida nueva iniciada desde ese mundo se lleva la historia consigo.
- En una partida, una vez iniciada: `GET`, `PUT` y `DELETE /api/game/:chatId/story` la leen, la guardan y la eliminan.
  Al guardarla se comprueba contra el mundo de la partida, ediciones a mano incluidas, y se rechazan las ediciones a
  mano que quitarían algo que la historia nombra.

En la configuración de una partida nueva, una historia leída de un archivo o de un paquete de mapas se conserva
mientras la semilla y la descripción del mundo sigan como estaban.

## La estructura

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

Los IDs tienen de 1 a 40 letras minúsculas, dígitos, `_` o `-`, y son únicos dentro de su lista. Una historia contiene
como máximo 256 indicadores (64 antes de Capability API 1.353), 64 directrices, 256 eventos (128 antes de 1.349),
64 cinemáticas, 32 peleas, 16 finales y 600 entradas de conocimiento. Ningún texto puede contener un salto de línea,
corchetes ni `{{`, y los nombres escritos dentro de una etiqueta (un grupo, un fondo) no pueden contener comillas
dobles: nada de lo que diga una historia puede hacerse pasar por una de las etiquetas del Game Master.

### Indicadores

Un indicador es un valor que guarda la historia: `"bool"` (verdadero o falso) o `"number"`.

```json
{ "id": "trust", "kind": "number", "initial": 0, "gm": true, "note": "How far the town trusts the party" }
```

- `gm: true` permite que el Game Master lo establezca (consulta [Las etiquetas del Game Master](#the-game-masters-tags));
  `note` le dice qué significa el indicador.
- Los indicadores están ocultos para el jugador. Con `quest`, un indicador se convierte en un **objetivo de misión** en el diario:

```json
{
  "id": "favours",
  "kind": "number",
  "initial": 0,
  "quest": { "title": "Favours", "text": "Do the town three favours", "goal": 3 }
}
```

Un indicador numérico puede tener un `min` y un `max` (Capability API 1.358): cada `set` y `add` lo mantiene
dentro de ellos, también las etiquetas del propio Game Master, así que una puntuación de aprobación se mantiene
entre -10 y 10 por muchos eventos que le sumen. Su `initial` debe estar dentro de esos límites.

```json
{ "id": "approval", "kind": "number", "initial": 0, "min": -10, "max": 10, "gm": true }
```

Un objetivo de sí o no se cumple cuando su indicador es verdadero; uno numérico, cuando llega a su `goal`
(1 si no se indica), y si se escribe un `goal`, el diario muestra cuánto se ha avanzado. Un objetivo con
`"hidden": true` espera en el diario hasta que un evento lo muestra.

#### Relojes

Un indicador numérico puede ser un **reloj** que el jugador ve llenarse (Capability API 1.342): un círculo
de 2 a 12 segmentos, uno lleno por punto, que se muestra en el HUD del juego y la pestaña World, con su título
y lo que ocurre cuando se llena.

```json
{
  "id": "reeve",
  "kind": "number",
  "initial": 0,
  "gm": true,
  "clock": { "title": "The Reeve's patience", "segments": 6, "full": "The Reeve sends his men." }
}
```

Establécelo, súmale y compruébalo en condiciones como cualquier indicador numérico. En cada turno se le comunican
los relojes al Game Master y, una vez, cuando uno se llena (por un evento, o por su propia etiqueta al turno
siguiente), lo que debe provocar. Un reloj con `"hidden": true` permanece oculto hasta que un evento lo muestra con `show`.

### Directrices

Una directriz es una instrucción permanente para el Game Master, vigente mientras se cumplan sus condiciones:

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

<a id="conditions"></a>

### Condiciones

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. Deben cumplirse todas las
condiciones de una lista `if`. Un indicador de sí o no solo se compara con `=` o `!=`.

`{ "party": "<person id>", "is": "in" | "out" }` pregunta si un habitante del mundo viaja ahora con el
grupo, como un compañero reclutado por la historia (Capability API 1.349).

`{ "partySize": { "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <1 to 32> } }` pregunta cuántos
integran el grupo: el personaje del jugador y cada compañero que viaja con él, salvo los compañeros que nunca
pelean (Capability API 1.360). Solo se cumple cuando el motor conoce el tamaño del grupo.

`{ "any": [<condition>, <condition>, ...] }` se cumple cuando se cumple cualquiera de sus 2 a 8 condiciones
(Capability API 1.358): una alternativa en una sola lista, en lugar de dos eventos.

```json
"if": [{ "any": [{ "flag": "won_granary", "is": "=", "value": true }, { "party": "p11-3", "is": "in" }] }]
```

### Conocimiento

Lo que los habitantes saben y dicen de sí mismos, de los demás y del entorno, que cambia con el avance
de la historia (Capability API 1.348). Cada entrada se comunica al Game Master como algo que ese habitante
puede decir si viene al caso, en un turno en el que:

- se cumplen sus condiciones,
- su `person` está en la escena: se nombra en la última respuesta o en el mensaje del jugador, o viaja con el grupo,
- y, cuando tiene `keys`, también se dice una de ellas allí. Una entrada sin habitante necesita claves y entra solo por ellas.

Se comunican como máximo 12 por turno. Desde 1.361 se ordenan: primero los habitantes que nombra la escena,
después las entradas sin habitante que activan sus palabras y luego los compañeros que solo van de viaje;
dentro de cada categoría, las entradas se reparten habitante por habitante, para que un compañero hablador
nunca desplace al resto. Los compañeros que van de viaje siempre conservan dos de las 12, por concurrida
que esté la escena, repartidas de la misma manera.

```json
"knowledge": [
  { "id": "hob-self", "person": "p3-4", "text": "Hob was a miller's boy before the year stopped." },
  { "id": "hob-mill", "person": "p3-4", "if": [{ "flag": "act", "is": ">=", "value": 2 }],
    "text": "Since the second act, Hob is afraid of the mill." },
  { "id": "hob-bells", "person": "p3-4", "keys": ["bells"], "text": "Hob thinks the bells are a lie." },
  { "id": "wheel", "keys": ["mill", "millwheel"], "text": "The mill's wheel has not turned in a hundred autumns." }
]
```

Un guion contiene hasta 600 entradas. Se comunican como máximo 12 por turno, en el orden del guion, así que
pon primero las que más importen.

### Eventos

Un evento es algo que ocurre: cuando su disparador se activa y se cumplen sus condiciones, realiza sus acciones.

```json
{
  "id": "gates",
  "when": { "on": "arrive", "place": "p11" },
  "if": [{ "flag": "banished", "is": "=", "value": false }],
  "do": [{ "cutscene": "gates" }, { "set": "arrived", "value": true }, { "show": "key" }]
}
```

Un evento ocurre una sola vez, salvo que tenga `"repeat": true` (que `start`, `turn` y `day` ignoran). En un turno
ocurren como máximo 32 eventos, cada uno como mucho una vez, en el orden en que los lista el guion.

**Disparadores** (`when.on`), todos leídos de lo que ha registrado la partida:

| Disparador | Se activa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`    | En la primera respuesta de la partida.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `turn`     | En la respuesta número `turn` del Game Master o en una posterior, contando toda la partida a través de las sesiones.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `day`      | Cuando el día del mundo (que avanza cuando el Game Master hace pasar el tiempo y con las caminatas) es `day` o posterior.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `arrive`   | Mientras el grupo está en `place` (un ID de lugar) o en un lugar dentro de él, tras llegar allí por empezar en él, por una caminata por el mapa del mundo, por una visita en el pueblo o por un lugar que nombra el Game Master. Con `repeat`, de nuevo cada vez que vuelve desde otro lugar.                                                                                                                                                                                                                                                                                       |
| `meet`     | Cuando una respuesta ha nombrado a `person` (un ID de habitante como `p11-3`, o `p11-e1` para uno añadido a mano) con su nombre completo. Con `repeat`, de nuevo por cada respuesta que lo nombre. Solo se buscan nombres en las respuestas de esta sesión.                                                                                                                                                                                                                                                                                                                         |
| `deed`     | Cuando el mundo ha registrado un acto del grupo, del tipo `deed` y en `place` si se indica. Con `repeat`, de nuevo por cada respuesta que registre uno.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `fight`    | Cuando una pelea termina con `outcome`: `victory`, `defeat` o `flee`. Con `fight` (una de las peleas del guion, 1.358), solo cuando esa pelea terminó así: la que inició la última respuesta del Game Master, mediante la acción `fight` de la historia o su propia activación. |
| `leave`    | Cuando el grupo sale de `place` (un ID de lugar) y de todos los lugares dentro de él (1.358): por una caminata, una visita, un lugar que nombra el Game Master o el `move` de la historia, en la última respuesta o en este turno. Con `repeat`, de nuevo cada vez que sale. |
| `broke`    | Cuando una pelea rompió el elemento de escenario llamado `prop` (Capability API 1.316), comparado sin distinguir mayúsculas. Solo se puede nombrar un elemento de escenario pintado en uno de los campos de batalla del mundo.                                                                                                                                                                                                                                                                                                                                                      |
| `flags`    | Cuando se cumplen sus condiciones. Con `repeat`, de nuevo cada vez que pasan a cumplirse después de no cumplirse.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `gm`       | Solo cuando el Game Master lo activa (el evento necesita `"gm": true`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `rest`     | Después de una respuesta en la que el grupo descansó: un `[sheet: op="rest"]` aplicado por la respuesta del Game Master, del descanso del conjunto de reglas que nombra `rest` (su ID o etiqueta, como `long`) o cualquiera (1.349). |
| `travel`   | En un turno en que el grupo parte de un lugar hacia otro, desde dentro de `from` y hacia dentro de `to` cuando se indican (1.349). |
| `idle`     | Después de `turns` respuestas seguidas sin que ocurra nada: ningún evento de historia, caminata ni pelea (1.349). |
| `step`     | Cuando una caminata pasa por la celda `x`, `y` (empezando en 0 desde la esquina superior izquierda) de `place`: el pueblo de un asentamiento (el recorrido de una visita, de puerta a puerta) o el mapa de un lugar hecho a mano (una caminata por él). La celda debe ser una a la que el grupo pueda pasar: en un pueblo, terreno conectado con la plaza que no sea un solar libre, donde la historia puede construir; en un mapa, suelo conectado con su entrada. Un mapa generado no tiene celdas que nombrar. Con `repeat`, de nuevo en cada turno cuya caminata pase por ella. |

Las ediciones a mano que quitan la celda de un evento step (un edificio colocado encima, el suelo de un mapa convertido
en muro) se rechazan al guardar, con el nombre del evento.

Un evento `meet` que se repite y cuya propia escena nombra a ese habitante, o un evento `deed` que se repite y realiza
el acto que espera, se dispararía a sí mismo en cada turno, así que el motor lo rechaza.

**Acciones** (`do`):

| Acción                                                                                                  | Qué hace                                                                              |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `{ "set": "<flag>", "value": <value> }`                                                                 | Establece un indicador.                                                               |
| `{ "add": "<flag>", "amount": <number> }`                                                               | Suma a un indicador numérico.                                                         |
| `{ "tell": "<text>" }`                                                                                  | Le pide algo al Game Master, una vez, en este turno.                                  |
| `{ "cutscene": "<id>" }`                                                                                | Reproduce una cinemática.                                                             |
| `{ "show": "<flag>" }`                                                                                  | Muestra en el diario un objetivo de misión oculto.                                    |
| `{ "world": { "deed": "<kind>", "group": "...", "with": "...", "place": "<place id>", "who": "..." } }` | Registra un acto en el mundo, que responde igual que ante uno del propio Game Master. |
| `{ "give": { "item": "<catalog/entry or a name>", "count": 1, "who": "...", "summary": "..." } }` | Da un objeto (1.343): uno de los objetos del conjunto de reglas del juego por su ID, u otro por su nombre (con `summary` para decir qué es), a la bolsa del jugador o al miembro del grupo que nombra `who`. Entra como lo haría uno del propio Game Master, así que se aplican las reglas del inventario. Se rechaza un ID que no ofrece el conjunto de reglas, con el motivo en la respuesta. |
| `{ "fight": "<fight id>" }` | Inicia una de las peleas del guion (1.343). Se le dice al Game Master que prepare su inicio, y la pelea que sigue tiene los oponentes de la historia. |
| `{ "move": "<place id>" }` | Sitúa al grupo en un lugar del mundo (1.343), como una caminata; un evento `arrive` que provoque ocurre en el mismo turno. |
| `{ "ending": "<ending id>" }` | Termina la partida con uno de los finales del guion (1.343): se reproduce su escena, el Game Master cierra con su epílogo y al jugador se le muestra el final y se le ofrece terminar la sesión. Después no ocurre nada más en la historia. |
| `{ "music": "<track id>" }` o `{ "music": null }` | Pone una pista de su Experience por encima de la música del lugar (1.345), hasta otra orden, o `null` devuelve el control a la del lugar. La pista debe ser una de las `music` del paquete de mapas. |
| `{ "recruit": "<person id>" }` | Incorpora al grupo a uno de los compañeros de su Experience (1.347), con su ficha para el conjunto de reglas del juego. Se le dice al Game Master que muestre su incorporación. |
| `{ "dismiss": "<person id>" }` | Deja que un compañero salga del grupo (1.347). |
| `{ "season": { "place": "<place id>", "to": "winter" } }` | Mantiene un lugar y todos los lugares dentro de él en una estación, sea cual sea la fecha (1.351); sin `place`, el mundo entero. `"to": null` lo devuelve a las propias `seasons` del guion o a la fecha. |
| `{ "sheet": { "condition": "<id>", "state": "on" }` o `{ "sheet": { "track": "<id>", "by": 1, "upTo": 3 } }` | Activa una condición de ficha en cada miembro del grupo o la quita (`"off"`), o mueve un contador de cada ficha, deteniéndose en `upTo` (1.368): el frío de Rime Edge que ningún descanso cura, mediante una condición cuya condición de combate tiene `cannot-heal-nonmagical`. La activación del propio motor lo aplica con la respuesta que escribe; la del Game Master, en el turno posterior a aquel en que la marcó. |

Cualquier acción puede llevar su propio `if` (Capability API 1.358): solo se realiza si sus condiciones
se cumplen cuando el evento llega a ella, una vez realizadas las acciones anteriores del evento, así que
un evento puede ramificarse.

```json
"do": [
  { "add": "approval", "amount": 2 },
  { "tell": "Hob warms to the party.", "if": [{ "flag": "approval", "is": ">=", "value": 5 }] },
  { "tell": "Hob keeps his distance.", "if": [{ "flag": "approval", "is": "<", "value": 5 }] }
]
```

Las acciones realizadas se registran con la activación, para que las escenas y peticiones de un evento `gm`
lleguen al turno siguiente tal como se realizaron cuando el Game Master lo marcó.

Cada función de historia necesita una versión menor de Capability API:

- los relojes necesitan 1.342;
- las peleas, los finales y las acciones `give`, `fight`, `move` y `ending` necesitan 1.343;
- las órdenes de música necesitan 1.345;
- reclutar o despedir compañeros necesita 1.347;
- el conocimiento necesita 1.348;
- los eventos `rest`, `travel` e `idle`, una `priority`, una condición `party` o más de 128 eventos necesitan 1.349;
- `seasons` y la acción `season` necesitan 1.351;
- más de 64 indicadores necesitan 1.353;
- las `variants` de pelea necesitan 1.356;
- las condiciones `any`, un evento `fight` que nombra su pelea, un evento `leave`, el `min` o `max` de un indicador y un `if` en una acción o página necesitan 1.358;
- una condición `partySize`, una variante para un grupo de más de 6 o sin límite superior, o más de 6 variantes necesitan 1.360;
- una acción `season` con `over` sobre todo lo que contiene necesita 1.361;
- `exposures` necesita 1.362;
- las criaturas de pelea con `adjust` necesitan 1.363;
- un `save` de exposición o el `upTo` de un contador necesita 1.364;
- el `sparedByShade` de una exposición necesita 1.365;
- `heldGround` necesita 1.366;
- una acción `sheet` necesita 1.368;
- el `release` de un terreno de muerte retenida necesita 1.369;
- dar una lista de alternativas necesita 1.370 (un ID de entrada solo y sin calificar, que desde 1.370 se da desde cualquier catálogo que lo tenga, es un nombre para un Engine anterior);
- las criaturas de pelea que ajustan `calls` o `levels` con `adjust` necesitan 1.371.

Un compañero es un habitante del archivo de habitantes del paquete marcado como tal (consulta los habitantes
del paquete de mapas en [paquetes opcionales de agentes](../development/optional-agent-packages.md)).

De los eventos `rest`, `travel` e `idle` que podrían ocurrir en un turno, solo ocurre uno: el de mayor `priority`
(un entero de -100 a 100, 0 si se omite; el primero del guion en caso de empate). Así, la conversación de un
compañero junto a la fogata, una discusión entre dos compañeros en el camino o un compañero que se acerca
al jugador en una hora tranquila nunca se amontonan. Con una condición `party`, esa escena solo ocurre
mientras esos compañeros viajan con el grupo. Un guion puede tener 256 eventos desde 1.349 (128 antes).

### Exposiciones

Lo que estar en un lugar le hace al grupo con el tiempo (Capability API 1.362), como un campo de luz de
mediodía que desgasta a los viajeros fuera de una pelea igual que la regla de luz de un tablero dentro de ella:

```json
"exposures": [
  { "id": "noonfield", "place": "e9", "label": "Noonfield's light", "hours": 1,
    "tracks": [{ "track": "exhaustion", "by": 1 }], "applies": ["sunstruck"],
    "if": [{ "flag": "darkness_carried", "is": "=", "value": false }],
    "tell": "The light presses on them; darkness would be a mercy." }
]
```

Según el reloj del juego: el primer turno en que el grupo está en `place` (o dentro de él) mientras se cumple
`if` la inicia, y cada turno posterior cuenta cuántas `hours` han pasado allí desde entonces. Cada vez que
transcurren, el motor mueve los `tracks` en `by` y activa las condiciones `applies` en cada miembro del grupo,
con sus propios comandos de ficha aplicados junto con los de la respuesta, y se lo comunica al Game Master
(con `tell`). Salir del lugar, o dejar de cumplirse `if`, la termina; la próxima vez comienza de nuevo.
Se registra una vez en la respuesta (`[story: exposure=...]`).

Un contador puede detenerse en un máximo (Capability API 1.364): `{ "track": "exhaustion", "by": 1, "upTo": 3 }`
nunca lo lleva más allá de 3 ni mueve uno que ya esté por encima. Una exposición puede pedir una salvación
en lugar de afectar a todos (1.364), con la misma estructura que el `save` de la regla de luz de un tablero de pelea (1.321):

```json
"save": { "save": "con_save", "difficulty": 12, "against": { "conditions": ["noon_light"] } }
```

Cada vez que afecta al grupo, el motor tira esa salvación para cada miembro a partir de su propia ficha,
y solo quienes fallan reciben sus contadores y condiciones, cada uno con su propio comando de ficha.
`against` indica contra qué se realiza la salvación, para que un modificador de salvación limitado a ello
cuente fuera de una pelea como dentro: el sombrero de paja de una superposición con
`{ "to": "saves", "mode": "advantage", "against": { "conditions": ["noon_light"] } }` da ventaja a quien
lo lleva. Se le comunica al Game Master quién se salvó y quién falló, con los totales.

Con `"sparedByShade": true` (Capability API 1.365), una sombra que lleve encendida cualquier miembro del grupo
mantiene alejada una exposición, como cuando no se cumple `if`: un objeto cuya `light` puesta o transportada
tiene `"shade": true` (la Lantern of Dusk del ejemplo), uno con interruptor solo mientras está encendido.
Encenderlo termina la exposición; apagarlo la inicia de nuevo.

### Terreno de muerte retenida

Donde la muerte queda retenida (Capability API 1.366), como en el valle del ejemplo:

```json
"heldGround": [
  { "id": "valley", "place": "p0", "label": "The Held Autumn", "condition": "felled",
    "marks": [{ "track": "owing", "by": 1 }],
    "if": [{ "flag": "year_turned", "is": "=", "value": false }],
    "tell": "Nobody here has died in forty years." }
]
```

Mientras el grupo está en `place` (o dentro de él; sin uno, en el mundo entero) y se cumple `if`, una pelea
por conjunto de reglas iniciada allí se libra sobre Held Ground (1.323): quien se queda sin salud queda
abatido, fuera de la pelea, estable y sin agonizar, y vuelve a levantarse después salvo que lo derribe algo
que siegue vidas. `condition` se activa en los abatidos y se mueven los contadores `marks` de cada personaje
abatido (una marca de Owing). Se aplica la primera entrada que se cumpla. La historia registra cuándo el
grupo entra y sale (`[story: held=...]`) y se lo comunica al Game Master cada vez (con `tell`); en cada
turno que se mantiene, se le recuerda al Game Master qué significa.

El terreno de muerte retenida puede soltar lo retenido (Capability API 1.369): el cambio de año del ejemplo.
Su `release` dice qué se cobra entonces:

```json
"release": { "felled": "die", "owing": { "track": "owing", "bonus": { "flag": "hymn_bonus" } } }
```

`felled` indica qué ocurre con quien yace abatido: muere (`"die"`, el valor predeterminado) o cae y empieza
a agonizar según la regla del propio conjunto (`"down"`). `owing` hace que cada miembro del grupo tire una
salvación de agonía del conjunto por cada marca en `track` (el primer contador marcado del terreno si no
se indica), con `bonus` sumado a cada una (un número o un indicador numérico leído cuando se suelta lo
retenido), hasta que se agoten las marcas o se decida el resultado; las marcas se gastan y tres fallos
son la muerte. En una pelea por conjunto de reglas que sigue allí, lo retenido se suelta en el mismo paso
que lo cambia: el uso de un objeto que gasta el número de historia que lee su `if` (1.359), o un elemento
de escenario roto al que responde un evento `broke` (1.316), y los eventos de indicadores que eso activa.
Los abatidos y Owing se cobran en esa ronda, mediante la liberación propia de la pelea (1.330). Fuera de
una pelea, el turno de historia que lo registra tira Owing de cada miembro a partir de su ficha y le
comunica al Game Master quién vivió y quién murió; una pelea sin terminar allí suelta lo retenido en su
siguiente paso. Lo que soltó una pelea nunca se vuelve a tirar.

<a id="seasons"></a>

### Estaciones

Las estaciones de un mundo siguen su calendario, 90 días cada una. Una historia puede mantener lugares
en una estación sea cual sea la fecha (Capability API 1.351): un valle atrapado en otoño, una colina en invierno.

```json
"seasons": [{ "place": "p3", "season": "autumn" }, { "season": "summer" }]
```

Cada entrada mantiene un lugar y todos los lugares dentro de él; una sin `place` mantiene el mundo entero.
Decide el lugar retenido más cercano: una aldea en invierno dentro de una región en otoño está en invierno.
La acción `season` cambia esa retención durante la partida o la suelta. Una retención con `over` sobre todo
lo que contiene (1.361) es la excepción: tiene prioridad sobre cualquier estación allí, las propias del
guion y todas las demás retenciones (primero la más exterior de este tipo), así que
`{ "season": { "to": "spring", "over": true } }` cambia el mundo entero a la vez. Donde el grupo está en
una estación retenida, se le comunica al Game Master la estación y que está retenida; se genera el clima
para ella; el mapa del mundo dibuja cada celda con la estación del lugar más cercano (las casillas
`<id>@<season>` de un paquete de casillas), y un pueblo con la suya propia.

Un campo de batalla pintado a mano también puede pintarse con estaciones: una fila `seasons` por fila de
casillas, una letra o `.` por casilla, con `seasonKeys` para nombrar las letras (`{ "a": "autumn", "w": "winter" }`).
Una casilla dejada en `.` está en la estación del lugar de la pelea. Las casillas de una pelea empiezan
en ellas, y los eventos de mapa de su ronda pueden cambiarlas, como un anillo de escarcha que se extiende
o una línea de primavera que avanza.

### Peleas

Una pelea fijada por la historia: contra quién se pelea y dónde, cuando el mundo tiene un tablero pintado para ella.

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

Cada criatura es una criatura del bestiario del conjunto de reglas del juego, por su ID (`catalog/entry`)
o su nombre, y se incluyen `count` de ellas (numeradas cuando hay varias), llamadas `name` en la pelea
si se indica. `battlefield` es un tablero pintado a mano en el mundo (`b<n>`), donde se pelea sea cual
sea el lugar de inicio; sin él se pelea donde comienza, como cualquier otra pelea. `note` le dice al
Game Master cómo se inicia. Se rechaza un ID que no tiene el conjunto: esas criaturas quedan fuera de la
pelea y se registra el rechazo. Una pelea que queda sin criaturas empieza de todos modos como la fijó
la historia, en su campo de batalla, pero el Game Master elige a sus enemigos.

Una pelea puede ajustarse para grupos de otros tamaños (Capability API 1.356). El grupo es el personaje
del jugador y cada compañero que viaja con él, salvo un compañero marcado como `noncombatant` (1.360).

```json
"variants": [
  { "party": { "min": 3, "max": 4 }, "creatures": [{ "creature": "creatures/scarecrow", "count": 4 }] },
  { "party": 5, "creatures": [{ "creature": "creatures/scarecrow", "count": 5 }], "battlefield": "b3",
    "note": "The Owed wakes in the loft." }
]
```

Se libra la variante cuyo `party` incluye el tamaño del grupo, con sus propias criaturas y sus propios
`battlefield` y `note` cuando los indica (los de la pelea si no). Un grupo cuyo tamaño no cubre ninguna
variante libra la pelea tal como está escrita. Dos variantes no pueden cubrir el mismo tamaño.

Una entrada de criatura de una pelea o variante puede ajustarla para esa pelea con `adjust` (Capability API 1.363),
para que un jefe escale con el grupo sin necesitar una criatura propia: `"adjust": { "legendaryResistance": 2, "maxHp": 40 }`
le da esa Legendary Resistance (0 la quita) y esa salud (un número fijo en lugar de la de su bloque, dados incluidos).
Se le comunica al Game Master junto a la criatura. El `calls` de un ajuste cambia a quién llaman las acciones
de la criatura (Capability API 1.371): `[{ "action": "shelves_lean", "creature": "creatures/wraith" }]`, por
el ID o nombre de la acción, para una acción que llama (1.325). Sus `levels` cambian cualquiera de esos valores
a partir de un nivel del grupo, cada uno sobre el anterior: `"levels": [{ "from": 8, "calls": [{ "action": "shelves_lean", "creature":
"creatures/wraith" }] }]`. El nivel del grupo es el mayor que haya alcanzado cualquiera de sus miembros,
leído de los campos de nivel que nombran las fichas de compañeros de la Experience para el conjunto del
juego; sin uno, no se leen los `levels`. Un `party` nombra tamaños de hasta 32; un rango sin `max`
(`{ "min": 7 }`, Capability API 1.360) cubre cualquier grupo desde su `min`, por grande que sea. Se le
comunica al Game Master para qué tamaño se fijó la pelea al comenzar, y de nuevo después de su resumen.

### Finales

```json
{ "id": "kept", "title": "The Year Kept", "cutscene": "bells", "epilogue": "The valley stays held." }
```

`cutscene` es una de las escenas del guion, que se reproduce al comenzar el final; `epilogue` es con lo
que el Game Master cierra la partida y lo que lee el jugador cuando se muestra el final.

### Cinemáticas

Una cinemática se muestra al jugador exactamente como está escrita o se le entrega al Game Master para que la narre.

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

Una cinemática `pages` se reproduce antes de la respuesta del Game Master, en la narración, una página cada vez: una
página sin hablante es narración, y una con hablante es lo que dice ese habitante, con su nombre en el mundo (o el
del jugador, para `player`) y con una `expression` de la propia lista del Game Master. Un `background` es un fondo que
tiene la partida, o `backgrounds:generated:<words>` para que se cree uno cuando la generación de imágenes está activada.
Se le dice al Game Master que la escena se mostró, y continúa a partir de ella.

Una página puede llevar un `if` (Capability API 1.358): solo se muestra mientras se cumplen sus condiciones
al reproducir la escena, para que una escena de campamento dé una intervención a cada compañero solo
mientras viaja con el grupo.

```json
{ "speaker": "p11-3", "text": "Another night.", "if": [{ "party": "p11-3", "is": "in" }] }
```

Una escena cuyas páginas quedan todas retenidas no muestra nada.

```json
{ "id": "dusk", "kind": "beats", "beats": ["Lamps are lit.", "A bell tolls."] }
```

Una cinemática `beats` (pasos narrativos) la narra el Game Master con sus propias palabras, paso a paso, en ese turno.
Los pasos de un evento `gm` se le entregan al Game Master junto con el evento, y los narra en la respuesta que marca el
momento. Por eso, el Game Master conoce desde el principio una escena de pasos que usa un evento `gm`, aunque también
la reproduzca un evento del motor. Como se le entregan en cada turno, los pasos de todos los eventos `gm` juntos se
limitan a 16.000 caracteres.

<a id="the-intro-message"></a>

### El mensaje de introducción

`intro` (Capability API 1.339) define cómo empieza la partida, la misma elección que ofrece la configuración del GM a cualquier partida:

```json
"intro": { "mode": "defined", "text": "The leaves have not fallen in Hollowmere for nine years.", "locked": true }
```

`"defined"` hace que el primer mensaje de la partida sea exactamente `text`; el Game Master no escribe nada para él,
y regenerarlo da el mismo texto. `"guided"` solo da forma a la apertura que escribe el Game Master, como una guía
que lee únicamente para esa primera respuesta. `text` tiene de 1 a 8000 caracteres y puede contener saltos de línea
(es el único texto de una historia que puede), pero nunca `{{`; el texto guiado tampoco puede contener corchetes.
Con `locked`, el jugador ve la introducción en la configuración del GM y no puede cambiarla; sin él, la introducción
solo rellena el campo de la configuración, y el jugador puede cambiarla o borrarla. Una partida cuya primera
respuesta ya se escribió, o que conserva su grupo de una partida anterior, no tiene introducción. Una Experience
también puede definir su introducción junto con sus demás valores de configuración del GM
(`contributions.gameSurface.setup.defaults.intro`, 1.372); esa se lee primero.

## Cómo se juega una historia

Una vez por turno, antes de que responda el Game Master, el motor lee lo que la historia ha hecho hasta ahora y
lo que trae este turno (una caminata, una visita, el final de una pelea) y deja que ocurran los eventos. Lo que ocurre
se escribe al principio de esa respuesta: una etiqueta que registra cada evento y lo que estableció, y cualquier escena
mostrada tal como está escrita. Como la historia se vuelve a leer a partir de las respuestas, un
swipe (respuesta alternativa) o una regeneración deshace lo que hizo su respuesta, y una historia cambiada a mitad de
partida nunca reescribe lo que ya ocurrió. La historia continúa en la siguiente sesión de la partida.

<a id="the-game-masters-tags"></a>

### Las etiquetas del Game Master

En cada turno, al Game Master se le comunican los valores de la historia (ocultos para el jugador) y las directrices
vigentes. Del resto del guion solo se le comunica lo que el guion le asigna: los eventos `gm` (con su `note` y los
`beats` que deba narrar con ellos) y los indicadores `gm`, y cuáles de esos eventos no puede marcar ahora (ya
ocurridos, o retenidos por sus condiciones). Los marca en su respuesta:

- `[story: event="<id>"]` activa un evento `gm` cuyas condiciones se cumplen (una vez, salvo que se repita).
- `[story: flag="<id>" value="<value>"]`, o `add="<number>"` para un indicador numérico, establece un indicador `gm`.

Los objetos dados, la pelea y el movimiento de un evento `gm` entran en la respuesta con su etiqueta;
su escena final y su epílogo llegan al principio de la siguiente respuesta.

El motor responde a cada etiqueta allí donde aparece, un evento como máximo una vez por turno, y rechaza cualquier otra
cosa indicando el motivo. En una partida sin historia, se rechazan todas las etiquetas de historia. Lo que activa
el Game Master surte efecto de inmediato (sus indicadores, sus actos); sus escenas y lo que pide llegan al principio de
la siguiente respuesta, salvo sus `beats` (se le pidió narrarlos con el momento). Escribe las `pages` de un evento `gm`
como lo que sigue al momento, ya que el Game Master ya ha narrado el momento en sí.

## Probar una historia

Guárdala en una partida con `PUT /api/game/:chatId/story` y `{ "story": { ... } }`: una historia que no encaja se
rechaza con todos los motivos. La pestaña World de la partida lista los objetivos y relojes que ha mostrado la historia, y el
prompt (las instrucciones enviadas a la IA) del Game Master lleva los valores y las directrices de la historia en cada turno.
