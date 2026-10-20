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
  "cutscenes": []
}
```

Los IDs tienen de 1 a 40 letras minúsculas, dígitos, `_` o `-`, y son únicos dentro de su lista. Una historia contiene
como máximo 64 indicadores, 64 directrices, 128 eventos y 64 cinemáticas. Ningún texto puede contener un salto de línea,
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

Un objetivo de sí o no se cumple cuando su indicador es verdadero; uno numérico, cuando llega a su `goal`
(1 si no se indica), y si se escribe un `goal`, el diario muestra cuánto se ha avanzado. Un objetivo con
`"hidden": true` espera en el diario hasta que un evento lo muestra.

### Directrices

Una directriz es una instrucción permanente para el Game Master, vigente mientras se cumplan sus condiciones:

```json
{ "id": "wary", "text": "The town is wary of strangers.", "if": [{ "flag": "trust", "is": "<", "value": 2 }] }
```

### Condiciones

`{ "flag": "<id>", "is": "=" | "!=" | ">" | ">=" | "<" | "<=", "value": <value> }`. Deben cumplirse todas las
condiciones de una lista `if`. Un indicador de sí o no solo se compara con `=` o `!=`.

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
| `fight`    | Cuando una pelea termina con `outcome`: `victory`, `defeat` o `flee`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `broke`    | Cuando una pelea rompió el elemento de escenario llamado `prop` (Capability API 1.316), comparado sin distinguir mayúsculas. Solo se puede nombrar un elemento de escenario pintado en uno de los campos de batalla del mundo.                                                                                                                                                                                                                                                                                                                                                      |
| `flags`    | Cuando se cumplen sus condiciones. Con `repeat`, de nuevo cada vez que pasan a cumplirse después de no cumplirse.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `gm`       | Solo cuando el Game Master lo activa (el evento necesita `"gm": true`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
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

Una historia no da objetos, no inicia peleas, no mueve al grupo ni termina la partida: eso queda en manos
del Game Master y del jugador. Pídeselo al Game Master con `tell`.

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
respuesta ya se escribió, o que conserva su grupo de una partida anterior, no tiene introducción.

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

El motor responde a cada etiqueta allí donde aparece, un evento como máximo una vez por turno, y rechaza cualquier otra
cosa indicando el motivo. En una partida sin historia, se rechazan todas las etiquetas de historia. Lo que activa
el Game Master surte efecto de inmediato (sus indicadores, sus actos); sus escenas y lo que pide llegan al principio de
la siguiente respuesta, salvo sus `beats` (se le pidió narrarlos con el momento). Escribe las `pages` de un evento `gm`
como lo que sigue al momento, ya que el Game Master ya ha narrado el momento en sí.

## Probar una historia

Guárdala en una partida con `PUT /api/game/:chatId/story` y `{ "story": { ... } }`: una historia que no encaja se
rechaza con todos los motivos. La pestaña World de la partida lista los objetivos que ha mostrado la historia, y el
prompt (las instrucciones enviadas a la IA) del Game Master lleva los valores y las directrices de la historia en cada turno.
