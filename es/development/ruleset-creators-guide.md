# Guía para crear conjuntos de reglas

Usa esta página para planificar un conjunto de reglas de Game Mode para tu propio sistema de mesa antes de abrir las páginas de referencia. Explica cómo encajan las partes de un conjunto de reglas, qué decisiones importan más y qué aprendimos al convertir 16 sistemas muy diferentes. La referencia clave por clave empieza en [Escribir conjuntos de reglas de Game Mode](../extending/writing-rulesets.md), y cada sección siguiente enlaza la página que resume.

Un conjunto de reglas es un archivo JSON (o un paquete de archivos) que le dice a Marinara Engine cómo funciona tu sistema. El Engine tira entonces cada prueba, aplica cada cambio de ficha y puede resolver peleas completas según tus reglas. Nada en un conjunto de reglas es código, así que diseñas rellenando las mecánicas que el Engine ya conoce. Una mecánica que no conoce es una solicitud de función para el Engine.

Cada clave de abajo indica la versión menor de Capability API que la añadió. Un paquete que usa la clave declara esa versión menor o una posterior (consulta [Versionado, pruebas y publicación](#versioning-testing-and-publishing)).

Es fácil confundir dos términos:

- **Classic y Tactical** son _estilos de combate_: una batalla con menús y filas delanteras y traseras, o una batalla sobre un tablero. Cualquier partida, con o sin conjunto de reglas, usa uno de ellos.
- **Las reglas propias de Marinara** son las que usa una partida cuando no tiene conjunto de reglas. Un conjunto de reglas las sustituye.

## Anatomía de un conjunto de reglas

Un conjunto de reglas es un archivo JSON de como máximo 512 KB, que se valida entero al importarlo. Los conjuntos de reglas más grandes separan sus catálogos en un paquete. Empieza copiando el ejemplo más cercano a tus dados:

- [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json): 2d6 más un atributo.
- [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json): una reserva de d10.
- El [paquete completo de 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) en Marinara-Agents.

Indícale a tu editor el [JSON Schema](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/extending/ruleset.schema.json) con una línea `$schema` para autocompletar y comprobar errores de escritura.

| Clave                                                            | Qué contiene                                                                                                      | Referencia                                                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `id`, `version`, `name`, `edition`, `license` | Identidad. `version` es un número entero que se aumenta con cada cambio publicado                                             | [Escribir conjuntos de reglas](../extending/writing-rulesets.md)                                                                                               |
| `coverage`                                                     | Lo que cubre el conjunto de reglas (pruebas, combate y demás) y el resumen de una línea del asistente                              | [Escribir conjuntos de reglas](../extending/writing-rulesets.md)                                                                                               |
| `resolution`                                                   | Cómo se tira una prueba: uno de cinco tipos, más franjas de resultado, gastos y repeticiones de tirada                                   | [Pruebas](../extending/ruleset-checks.md)                                                                                                           |
| `sheet`                                                        | Atributos, habilidades, campos, listas, reservas vivas, contadores, estados, contadores de heridas, penalizaciones, migraciones                  | [Fichas](../extending/ruleset-sheets.md)                                                                                                           |
| `party`, `clocks`                                              | Una ficha compartida del grupo (tripulación, nave, puntos de historia) y relojes de progreso                                                | [Fichas](../extending/ruleset-sheets.md)                                                                                                           |
| `rests`                                                        | Lo que restaura y elimina cada descanso                                                                                 | [Fichas](../extending/ruleset-sheets.md)                                                                                                           |
| `gm`, `gmReference`                                            | Texto del Game Master, el resumen por personaje, quién controla a los oponentes y una referencia de reglas de hasta 16,000 caracteres | [Fichas](../extending/ruleset-sheets.md)                                                                                                           |
| `catalogs`                                                     | Entradas ya preparadas (conjuros, talentos, criaturas), cada una con un bloque `mechanics` opcional                           | [Catálogos](../extending/ruleset-catalogs.md), [Mecánicas](../extending/ruleset-mechanics.md), [Creador](../extending/ruleset-character-builder.md) |
| `items`                                                        | Categorías, armas, armaduras, munición, botín, dinero, equipo inicial, mercados                                       | [Objetos](../extending/ruleset-items.md)                                                                                                             |
| `battle`                                                       | Presta los números de tu ficha a las peleas Classic y Tactical propias de Marinara                                           | [Combate](../extending/ruleset-combat.md)                                                                                                           |
| `combat`                                                       | Resuelve la pelea completa según tus reglas, con bestiario, tablero, reacciones y enfrentamientos                                 | [Combate](../extending/ruleset-combat.md)                                                                                                           |
| `layers`                                                       | Variantes que un jugador activa para una partida (Low magic, Hard winter)                                                   | [Capas y traducciones](../extending/ruleset-layers-and-translations.md)                                                                         |

**IDs.** El ID del conjunto de reglas usa minúsculas, dígitos y guiones simples (`ember-roads`). Los IDs de la ficha usan minúsculas, dígitos y guiones bajos, y empiezan por una letra (`grit_max`). Mantén los IDs estables una vez que publiques, porque los personajes guardados, otros conjuntos de reglas que toman prestados tus catálogos y las superposiciones de Experiences apuntan a ellos.

**Texto seguro para prompts.** Todo lo que llega al modelo (nombres, etiquetas, texto del Game Master) ocupa una sola línea, sin corchetes y sin `{{` ni `}}`.

**Paquetes.** Un conjunto de reglas demasiado grande para un solo archivo se distribuye como `<id>.ruleset.json`: un manifiesto más `ruleset.json`, hasta 12 archivos `catalogs/<id>.json` de 2 MB cada uno y hasta 40 traducciones, todo en base64. Se rechazan los archivos zip. Un editor de conjuntos de reglas como Pixelforge crea este archivo por ti. El manifiesto declara la versión menor de Capability API que necesita tu conjunto de reglas.

**Cómo se clasifica un conjunto de reglas.** Un archivo importado se convierte en `local/<id>`, uno de un repositorio de GitHub se convierte en `<owner>/<id>` y el del catálogo oficial conserva su ID sin prefijos. Dos autores pueden publicar cada uno un `v20` sin entrar en conflicto.

## Pruebas, dados y la ficha

Tu primera decisión, y la más importante, es `resolution.kind`, porque todo lo demás se interpreta a través de ella. El Game Master solo nombra una habilidad y una dificultad. El Engine tira los dados, hace los cálculos con la ficha y le dice el resultado al modelo, así que nunca escribas texto del Game Master que le pida al modelo hacer cálculos.

| Tipo           | Cómo tira                                                                                                                             | Sistemas para los que encaja                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `dice-sum`     | Tira dados, suma números de la ficha e iguala o supera una dificultad. Admite caras personalizadas, cadenas abiertas y dados explosivos                | Juegos d20, 2d6 más atributo, Fate (4dF con caras −1/0/+1), Rolemaster  |
| `dice-pool`    | Tira una cantidad de dados que toma de la ficha y cuenta los que alcanzan un objetivo. El objetivo puede venir de la ficha, por prueba, por encima o por debajo | World of Darkness, Exalted, juegos similares a Shadowrun, Lasers & Feelings     |
| `dice-highest` | Tira una reserva y lee el dado más alto, o suma los pocos más altos. Admite una regla de cero dados y un segundo conjunto de dados "oscuros"                        | Blades in the Dark y otros juegos Forged in the Dark, Trophy Dark |
| `roll-against` | Saca un resultado igual o inferior (o superior) al número de la ficha                                                                                            | Call of Cthulhu, GURPS, BRP, X-in-6 de la vieja escuela                     |
| `symbol-pool`  | Forma y mejora dados narrativos, cancela los símbolos opuestos                                                                                | Genesys y similares                                                |

Después añade lo que necesite tu sistema. Todo está en [Pruebas de conjuntos de reglas](../extending/ruleset-checks.md):

- **Franjas de resultado** (`resolution.outcomes`, 1.135): de dos a ocho resultados con etiqueta según el margen o el total, como grados de éxito, "éxito con un coste" o éxitos difíciles y extremos. Cada franja puede llevar una línea que le diga al Game Master qué significa en la mesa. Esta fue la función que más sistemas necesitaron entre los que convertimos.
- **Pruebas que tiran a su manera** (`resolution.overrides`, 1.140): unas cuantas habilidades con dados diferentes, como habilidades de ladrón con d100 y Abrir puertas con d6 en un juego d20.
- **Gastar para cambiar una tirada** (`resolution.spend`) y repeticiones gratuitas (`resolution.reroll`): fuerza de voluntad para un éxito, Suerte, puntos de héroe. `perCheck` limita lo que puede comprar una tirada, así que una reserva llena no puede comprar un resultado seguro.
- **Un amuleto que cambia una tirada**: pon `mechanics.check` en la entrada de catálogo que eligió un personaje, pagado con el coste propio de esa entrada.

**Lo que una prueba aún no puede hacer.** Reservas enfrentadas (se comparan dos participantes que tiran) y reservas que se suman con un dado comodín, como en OpenD6. Ambas necesitan un nuevo tipo de resolución dentro del Engine. Si tu sistema depende de una, abre una solicitud de función en el repositorio del Engine con unas cuantas tiradas resueltas; se convierten en las pruebas.

**La ficha** ([Fichas de conjuntos de reglas](../extending/ruleset-sheets.md)) contiene atributos, habilidades, campos, listas y valores derivados, más el estado activo que el Engine cambia durante la partida:

- **Reservas** como puntos de golpe, fuerza de voluntad, motas o espacios de conjuro, que se gastan y restauran mediante comandos de ficha y descansos.
- **Contadores** como estrés, Ruina o XP, con activadores cuando se llenan.
- **Contadores de heridas**, para una salud que se expresa en niveles con nombre o casillas numeradas en vez de un número, con penalizaciones a las tiradas.
- **Estados vivos** como una forma, una postura o el ánima, que pueden cambiar las tiradas mientras se mantienen.
- **Ficha del grupo y relojes**: una tripulación, una nave o puntos de historia compartidos, y relojes de progreso de 4, 6 u 8 segmentos.

El Game Master cambia la ficha mediante comandos de ficha que el Engine le enseña automáticamente, con tus propios IDs, así que no los explicas en `gm.sheetGuidance`. El avance permanente (XP, puntos nuevos, subidas de nivel) usa comandos de ficha de catálogo; consulta [Catálogos de conjuntos de reglas](../extending/ruleset-catalogs.md).

**Crear personajes.** El [creador de personajes](../extending/ruleset-character-builder.md) guía al jugador por los pasos que defines: origen y clase, puntuaciones (tiradas, compradas o asignadas), competencias, conjuros, equipo y dinero inicial, con comprobaciones de legalidad y creación compartida del grupo. Los catálogos pueden tomar prestado el catálogo de otro conjunto de reglas instalado con `from` (1.220), así que una variante de 5e puede reutilizar las criaturas y los conjuros del SRD en vez de copiarlos.

**Texto del Game Master.** `gm.checkGuidance` y `gm.sheetGuidance` (1,500 caracteres cada uno) se envían cada turno, así que mantenlos breves. `gm.worldGuidance` se lee una vez, cuando se crea el mundo ("sin pólvora", "la magia es escasa"). `gmReference` contiene hasta 16,000 caracteres de reglas más completas en el prompt (las instrucciones enviadas a la IA) de sistema estable. `gm.sheetSummary` elige lo que ve el modelo por personaje, y todo lo que aparece ahí cuesta tokens (fragmentos de texto) cada turno. Escríbelo todo con tus propias palabras, nunca copies texto del manual de reglas.

## Combate

Un conjunto de reglas participa en las peleas con uno de tres grados de profundidad. Puedes empezar con poca profundidad y aumentarla después. Elige según cuánto de la identidad de tu sistema reside en sus peleas.

| Profundidad          | Qué escribes                                                                        | Qué ocurre en una pelea                                                                                                                                   | Adecuado para                                                          |
| -------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Ninguna           | Sin bloque `battle` ni `combat`                                                         | El combate Classic o Tactical propio de Marinara crea a los combatientes por su cuenta. La ficha no cambia                                                              | Sistemas narrativos donde las peleas son ficción (Fate, Blades, Trophy) |
| Prestar la ficha | Un bloque `battle`: reserva de salud, reserva de energía opcional, espacios de conjuro, hasta 8 listas de habilidades | Los cálculos y dados de Marinara, pero la salud empieza con la misma proporción de la barra que en la ficha, y el resultado se vuelve a escribir en ella                                  | Sistemas ligeros que quieren consecuencias duraderas                     |
| Tus propias reglas | Un bloque `combat`                                                                      | Tus dados resuelven cada ataque, salvación y enfrentamiento. Los oponentes vienen de tu bestiario o escala de amenaza, y cada coste se escribe en la ficha al producirse | Sistemas tácticos con muchas reglas (5e, Pathfinder, Storyteller, Genesys)   |

**El bloque `combat`** parametriza uno de tres tipos que tiene el Engine: `attack-vs-defense` (dados contra un número de defensa), `dice-pool` (tus reservas, contando éxitos) o `symbol-pool` (dados narrativos con gastos, 1.382). Lo esencial es `health` (una reserva que disminuye, un contador de heridas que se marca o un contador simple que se llena, 1.383), `defense`, `initiative`, `attackRoll`, una `economy` de acciones y las listas que se convierten en `attacks` y `abilities`. Un bloque pequeño completo ocupa unas 25 líneas; el bloque de Ember Roads en [Combate de conjuntos de reglas](../extending/ruleset-combat.md#combat-a-fight-your-own-rules-resolve) es una buena plantilla.

Más allá de lo esencial, añade lo que necesite tu sistema:

- **Estados**, con efectos de una lista cerrada (defensa, tiradas de ataque, salvaciones, enfrentamientos, velocidad, salud máxima, daño infligido y recibido).
- **Salvaciones**, concentración, reglas de agonía y reacciones que se mantienen en **ventanas** (una entrada puede esperar a `used`, `aimed`, `hit`, `harmed`, `falls` o `turn-start`).
- **Enfrentamientos** para agarrar, empujar y liberarse.
- **Criaturas**: un catálogo de bestiario que lee la pelea, con bloques de estadísticas, acciones, sentidos y lanzamiento de conjuros. Una **escala de amenaza** permite al Game Master inventar un oponente para una pelea, y `combat.threat.budget` (1.803) crea encuentros con un presupuesto de experiencia por dificultad.
- **Mecánicas de las entradas** en las entradas de catálogo: formas de área, zonas duraderas, muros, invocaciones, curas y sentidos. Consulta [Mecánicas de las entradas de conjuntos de reglas](../extending/ruleset-mechanics.md).

**Classic o Tactical.** Tus propias peleas solo tienen tablero si `combat` declara `distance` (`label`, `perCell`) y la ficha o las criaturas dan movimiento. Sin ellos, una partida Tactical sigue usando tus reglas mediante el teatro de la mente. Si tus reglas dependen de la posición (áreas, alcance, flanqueo), establece `"styles": ["tactical"]` (1.379) para que cada partida con tu conjunto de reglas tenga un tablero.

**El arte de criaturas** es independiente de las reglas: un [paquete de criaturas](../extending/writing-creature-packs.md) (`.creatures.json`, más fácil de crear en Pixelforge) dibuja tu bestiario en el tablero Tactical haciendo coincidir los IDs de criatura. Lo que no tiene arte conserva una ficha.

**Los límites conocidos** se enumeran en [Todavía no](../extending/ruleset-combat.md#not-yet). Los que más afectaron a las conversiones fueron las tiradas de defensa enfrentadas (Esquivar y Contraatacar, Parar y Bloquear), las localizaciones de impacto, la iniciativa por bando y las reacciones a reacciones. El Game Master los narra alrededor de la pelea del Engine.

## La IA de combate: mentes, temperamentos y quién controla a los oponentes

El Engine controla a cada oponente y compañero de IA que no controle nadie más, sin una llamada al modelo por turno. Es independiente del conjunto de reglas: la probamos con conversiones de Storyteller, Exalted, juegos de la vieja escuela, Call of Cthulhu, GURPS y Genesys, además de 5e. Funciona sin ninguna de las claves siguientes; estas hacen que tus criaturas peleen según su naturaleza. Todas están en [Mecánicas de las entradas de conjuntos de reglas](../extending/ruleset-mechanics.md), y el diseño está en [IA de combate de Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-combat-ai.md).

| Clave                                                               | Qué controla                                                                                                                                                                                                          | API            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `mind` en una criatura, o niveles de `combat.minds` basados en un atributo | Cuánto piensa: `mindless`, `instinct`, `cunning`, `tactical`, `genius`. Las bestias usan instinto de forma predeterminada; los constructos y cienos carecen de mente                                                                        | 1.761          |
| `behavior.temperament`                                            | Cómo pelea: reckless, cautious, opportunistic, protective, supportive, disciplined, cowardly, patient, methodical, coordinated                                                                                         | 1.763          |
| Temperamentos solo por la historia                                           | `fanatical` (nunca pierde el valor), `arrogant` (se contiene, levanta el vuelo cuando es legendaria y está perdiendo), `territorial`, `cruel`, `honourable` (ofrece Surrender (Rendirse) al grupo), `hungry` (se lleva a una víctima arrastrando). Nunca se asignan al azar | 1.778 a 1.784 |
| `behavior.role`                                                   | bruiser, bulwark, skirmisher, marksman, spellcaster, supporter, controller, `solo` (1.776). Se asigna según sus capacidades si no se indica                                                                                            | 1.763          |
| `behavior.targets`, `opens`, `pack`, `ambush`                     | Prioridades de objetivo, un movimiento inicial, tácticas de manada, esperar escondida                                                                                                                                                       | 1.763          |
| `behavior.shifts`                                                 | Un temperamento que cambia al quedar ensangrentada, caer un aliado, caer el líder o quedar acorralada                                                                                                                                 | 1.779          |
| `combat.morale`                                                   | Cuándo y cómo comprueban su valor los enemigos (2d6 por debajo de una puntuación, o una salvación), y quién se rinde                                                                                                                                    | 1.762, 1.775   |
| `gm.opposition: "game-master"`                                    | El Game Master controla a cada oponente, eligiendo entre las opciones legales del Engine, con el Engine como respaldo                                                                                                                | 1.774          |

`behavior` puede estar en todo el bloque `combat`, en un tipo de criatura o en un bloque de estadísticas, y cada uno tiene prioridad sobre el anterior. Ejemplos del SRD: un lobo `{"targets": ["wounded"], "pack": true}`, un goblin `{"temperament": "cowardly", "targets": ["weakest"]}`, un necrófago `{"ambush": true}`.

**Para peleas en tablero, la IA necesita** `combat.distance`, movimiento (`combat.economy.movement` o un `speed` de criatura), un `range` en los ataques a distancia y las filas de armas, y un `area` en todo lo que alcance una zona. Sin alcance, una pistola solo funciona a la distancia de un brazo. Sin áreas, la IA nunca se dispersa.

**Sistemas narrativos.** De forma predeterminada, el Engine controla a los enemigos ordinarios y el Game Master controla a los jefes. Para un sistema cuya oposición es ficción en vez de daño (Fate, Blades, Trophy, Lasers & Feelings), `gm.opposition: "game-master"` permite al modelo interpretar a cada oponente según su personaje. Solo tiene efecto cuando el jugador activó "GM directs bosses" (El GM dirige a los jefes) en la configuración, porque ese es su consentimiento para las llamadas al modelo durante las peleas.

**Sin un bloque de combate**, tus partidas siguen teniendo moral en las peleas Classic y Tactical: cada enemigo que no sea jefe ni carezca de mente obtiene una puntuación de 2 a 12 según su mente y temperamento, y los enemigos pensantes pueden rendirse. Quien escribe el encuentro puede marcar el `leader` de un bando.

**Temperamento del grupo.** Cada miembro del grupo recibe un temperamento a partir de su Description (Descripción) cuando empieza una partida, y solo cambia por motivos de la historia en la revisión de final de sesión. Los compañeros de IA pelean según ese temperamento. Un conjunto de reglas no lo establece, pero tu texto del Game Master puede apoyarse en él.

## Capas, superposiciones y migraciones

Tres mecanismos cambian un conjunto de reglas sin bifurcarlo. Usa una capa para una variante que elige el jugador, una superposición para contenido que pertenece a una aventura y una migración cuando cambias la estructura de la ficha.

**Las capas** (`layers`, hasta 12) son interruptores en el asistente New Game (Nueva partida), fijos durante toda la vida de esa partida. Una capa solo puede restringir o añadir texto, nunca añadir reglas:

- añadir orientación del Game Master (`gm.guidance`, `gm.worldGuidance`; 4,000 caracteres por capa);
- quitar valores de un campo enumerado, sustituir la escala de dificultades u ocultar entradas de catálogo mediante un filtro declarado;
- quitar monedas (1.64), quitar vendedores del mercado, marcar objetos como no disponibles para la venta o cambiar tablas de botín (1.813);
- declarar `conflicts` con otras capas.

Una capa no puede añadir un campo, valor, habilidad, reserva, descanso, vendedor ni tabla de botín, cambiar el tipo de resolución ni tocar los números de combate. Los personajes conservan todo lo que quita una capa. La capa **Low magic** (Magia escasa) del SRD es un buen modelo: conjuros limitados al nivel 5, objetos por encima de poco común más raros y normalmente no a la venta, criaturas de mucha magia fuera de los encuentros aleatorios y orientación del mundo que pide al Game Master explicar por qué la magia es escasa. Otros autores pueden copiarla. Todavía no se admiten capas escritas para el conjunto de reglas de otra persona.

**Las superposiciones** (1.355) permiten que el paquete de mapas de una Experience añada criaturas, estados, estados de ficha, objetos y contadores (1.367) a tu conjunto de reglas mientras esa Experience esté activa. Mantén los monstruos y el botín específicos de la aventura en una superposición, no en tu conjunto de reglas base. Una superposición que reutiliza uno de tus IDs, o que no encaja, se omite entera, lo que es otro motivo para mantener los IDs estables. Referencia: [superposiciones de conjuntos de reglas](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/optional-agent-packages.md#capability-api-1355-ruleset-overlays).

**Las migraciones** (`sheet.migrations`, 1.77) indican cómo se trasladan los personajes guardados cuando renombras un campo, divides un nivel en niveles por clase o divides una reserva. Añadir elementos no necesita migración; aumenta `sheet.version` cuando cambia la estructura de la ficha. Referencia: [Capas, traducciones y migraciones](../extending/ruleset-layers-and-translations.md).

## Traducciones

Escribe el conjunto de reglas en inglés y distribuye cada otro idioma como su propio archivo de traducción (1.811). Las traducciones solo cambian lo que se muestra: las reglas, los comandos de ficha y todo lo que se le dice al Game Master se mantienen en inglés, así que una traducción nunca puede romper una partida.

Una traducción usa la cadena en inglés como clave, palabra por palabra:

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

- Los códigos de idioma coinciden con los del propio Engine (`ru`, `pt-BR`, `zh-Hans`). Una cadena ausente o vacía se muestra en inglés, y `pt-BR` recurre primero a `pt` como respaldo.
- **En un archivo de paquete compartido**, ponlas en `locales/<language>.json`, hasta 40 de 8 MB cada una. La importación solo conserva el idioma actual del Engine; para cambiarlo, cambia el idioma y vuelve a importar.
- **En el catálogo oficial**, cada idioma es un paquete separado, `<id>-<version>.<language>.json`, enumerado en `locales` en la entrada del catálogo con su URL, sha256, tamaño y un nombre y descripción de tienda traducidos. El Engine descarga solo el paquete de su idioma actual y lo sustituye cuando cambia el idioma. Incluir los 11 idiomas del SRD en un solo archivo aumentó la descarga de 7 MB a 34 MB, por eso los paquetes están separados.
- Una traducción corregida no necesita una nueva `version`.

El paquete del SRD distribuye 11 idiomas de esta forma y es el modelo que debes copiar. Referencia: [Traducciones](../extending/ruleset-layers-and-translations.md#translations).

## El paquete de 5e (SRD 5.1): un ejemplo de tamaño completo

El [paquete ruleset-5e-2014](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) en Marinara-Agents usa casi todas las funciones de esta página, así que consúltalo cuando quieras ver una clave en uso real. Cosas que vale la pena copiar:

- **Distribución**: `ruleset.json` más un archivo por catálogo en `catalogs/` (criaturas, conjuros, objetos mágicos y más), integrados en un paquete `.ruleset.json`. Sus archivos README y MODELING.md explican cómo se modeló cada regla.
- **Licencias**: atribución CC BY 4.0 en `license`, una línea de "sin afiliación" y ningún nombre de producto registrado en ninguna parte.
- **Combate completo**: un bloque d20 `attack-vs-defense` con presupuestos de acción, acción adicional y reacción, concentración, reacciones como Shield y Counterspell, un tablero, un bestiario completo con mentes y temperamentos, y un presupuesto de encuentro.
- **Creador**: raza, clase, puntuaciones tiradas o compradas, competencias, conjuros y equipo inicial.
- **Una capa** (Low magic) y **11 traducciones** como paquetes bajo demanda.
- **IDs estables**: otros conjuntos de reglas toman prestados sus conjuros y criaturas, así que sus IDs nunca cambian.
- **Pruebas de regresión** que se ejecutan como su propia tarea de CI con cada cambio.

Si tu sistema es una variante de d20, considera tomar prestados sus catálogos con `from` (1.220) en vez de copiarlos.

## Diseñar sistemas similares: lo que nos enseñaron las conversiones

Convertimos 16 sistemas de una colección de la comunidad a este formato, desde juegos narrativos de reglas ligeras hasta Rolemaster. La lección principal: aquí un conjunto de reglas se aplica, no se sugiere. El Engine tira cada prueba y aplica cada cambio de ficha, así que todo lo que dejas en "el GM se encargará" queda realmente sin resolver. Decide pronto qué controla el Engine y qué narra el Game Master.

| Familia de sistemas      | Ejemplos                            | Resolución     | Claves que lo hicieron funcionar                                                                                                       | A cargo del Game Master                                                      |
| ------------------ | ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Sistemas d20 y d% con muchas reglas  | 5e, Pathfinder 2e, Rolemaster       | `dice-sum`     | Franjas de resultado para grados de éxito; `openEnded` y `unmodified` para Rolemaster; `gmReference` para tablas grandes              | Tipos de bonificación no acumulables de Pathfinder; tablas de críticos de Rolemaster más allá de las franjas |
| Vieja escuela         | OSE                                 | `dice-sum`     | `resolution.overrides` para habilidades de ladrón (d100) y X-in-6 (d6); moral con 2d6                                                   | Iniciativa por bando (se juega como individual)                                       |
| Tirada igual o inferior         | Call of Cthulhu 7e, GURPS Lite      | `roll-against` | `against`, dados `tens` de bonificación y penalización, caras críticas, franjas difíciles y extremas                                             | Esquivar, Contraatacar y Parar enfrentados; localizaciones de impacto de GURPS                        |
| Reservas de Storyteller  | V20, W20, Exalted 3e, Exalted WoD   | `dice-pool`    | Contadores de heridas con penalizaciones, estados vivos (formas, ánima), excepciones para los resultados de 1 que no cancelan, un bloque `combat` basado en reservas    | Disciplinas y Dones de área salvo que se escriban como entradas                         |
| Forged in the Dark | Blades in the Dark, Trophy Dark     | `dice-highest` | `keep`, `zeroDice`, un conjunto de dados `dark`, franjas (6 / 4 a 5 / 1 a 3), contadores con `onFull`, relojes, una ficha de grupo para la tripulación | Peleas, mediante `gm.opposition: "game-master"`                               |
| Reservas con posturas       | Lasers & Feelings, un juego original | `dice-pool`    | `target` leído de la ficha, `stances` (por debajo o por encima), `exact` para una coincidencia exacta, una ficha de grupo para la nave               | Peleas, como ficción                                                           |
| Fate               | Fate Core                           | `dice-sum`     | Caras personalizadas para 4dF, franjas para un empate y un éxito con estilo                                                                 | Invocaciones y forzados como historia; peleas como ficción                              |
| Dados narrativos     | Genesys                             | `symbol-pool`  | `combat.kind: "symbol-pool"` con `symbols.spends`, absorción y salud en un contador de Heridas que se llena                               | Gastos en pruebas fuera de las peleas                                              |

**Consejos prácticos de esas conversiones:**

1. **Empieza por los dados, después la ficha y después el texto del Game Master.** Consigue que una prueba se tire correctamente antes de añadir catálogos o combate.
2. **Usa franjas de resultado dondequiera que tu sistema las tenga.** El `text` de cada franja le dice al modelo qué ocurre en la mesa, que es donde viven los sistemas narrativos.
3. **Prefiere no tener bloque de combate a tener uno medio correcto.** Un sistema narrativo se juega mejor con las peleas propias de Marinara (o con oposición del Game Master) que con un bloque de combate que modela sus reglas a medias.
4. **Si escribes combate, dale lo básico para el tablero**: `distance`, movimiento, alcances en las armas a distancia y al menos un ataque de área. Todas las conversiones que probamos con IA carecían de alguno de estos elementos, y sus peleas se estancaban o nunca usaban el posicionamiento.
5. **Comprueba el movimiento respecto a tu escala.** A 2 metros por casilla, una criatura con velocidad 2 no podía subir colinas y las peleas se estancaban.
6. **Anota tus fuentes.** Mantén un archivo de notas por conjunto de reglas con cada regla de origen y cómo se convirtió, sobre todo donde elegiste entre interpretaciones contradictorias. Es lo primero que piden quienes revisan.
7. **Cuando al Engine realmente le falta una mecánica**, déjasela al Game Master en `gmReference` y abre una solicitud de función con ejemplos resueltos. Muchas funciones de esta página (franjas de resultado, `dice-highest`, `roll-against`, peleas de símbolos, relojes, fichas de grupo) existen porque una conversión las pidió.

<a id="versioning-testing-and-publishing"></a>

## Versionado, pruebas y publicación

**Importan dos números de versión.** La `version` de tu conjunto de reglas es un número entero que aumentas con cada cambio publicado. Una versión instalada nunca se reescribe, y cada partida permanece ligada a la versión exacta con la que se creó, así que una campaña en curso nunca cambia sus cálculos. La versión de **Capability API** indica qué funciones del Engine necesita tu archivo. El manifiesto de un paquete declara `schemaVersion: 2` y `capabilityApi: { "major": 1, "minor": N }`, donde N es la versión menor más alta de cualquier clave que uses, para que nunca se ofrezca tu conjunto de reglas a un Engine más antiguo. Los conjuntos de reglas del catálogo oficial necesitan al menos 1.374. Un archivo simple que importas no necesita nada, porque el Engine que lo lee lo valida.

**El ciclo del borrador.** Editar, aumentar `version`, importar, iniciar una partida nueva. Se rechaza importar la misma versión con contenido diferente. Las versiones antiguas permanecen instaladas hasta que retires el conjunto de reglas. Aumenta `sheet.version` cuando cambia la estructura de la ficha y escribe una migración cuando se trasladan valores.

**Pruebas.**

- Usa la línea `$schema` para que tu editor detecte errores de escritura y tipos incorrectos mientras escribes.
- Impórtalo: activa **Settings → Advanced → Danger Zone → Allow custom Agent imports** (Configuración → Avanzado → Zona de peligro → Permitir importaciones de agentes personalizados), y después usa **Agents → Import agents → Game Mode ruleset** (Agentes → Importar agentes → Conjunto de reglas de Game Mode). La revisión enumera cada problema con su ruta antes de guardar nada, incluidos los nombres que no apuntan a nada.
- Juega unas cuantas pruebas de cada tipo que declaraste, incluidas las excepciones, los gastos y cada franja de resultado. El registro muestra los cálculos reales.
- Si tienes un bloque `combat`, pelea tanto en Classic como en Tactical, con compañeros de IA, contra criaturas de cada mente. Vigila los estancamientos (nadie puede alcanzar a nadie), el fuego amigo de las áreas y los enemigos que nunca usan sus mejores acciones.
- Activa y desactiva cada capa, y cambia el idioma del Engine si distribuyes traducciones.
- Si una Experience superpone contenido a tu conjunto de reglas, `POST /api/game/experience/check` informa de lo que no encaja.
- Pide a alguien que pruebe el juego sin conocer tu sistema que cree un personaje con el creador.

**Publicación.** Hay cinco vías, desde la más sencilla (detalles en [Compartir tu conjunto de reglas](../extending/writing-rulesets.md#sharing-your-ruleset)):

1. Envía el archivo `.json`.
2. Envía un paquete `.ruleset.json`, con catálogos y traducciones dentro.
3. Ponlo en un repositorio público de GitHub en `rulesets/` (como máximo 32 archivos). Los usuarios añaden el repositorio como fuente personalizada, y se clasifica bajo tu nombre de GitHub.
4. Propón su inclusión en el catálogo oficial con un pull request a [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), organizado como `ruleset-5e-2014`. Esto es para sistemas muy jugados con licencias claras.
5. Distribuye una Experience cuyo paquete de mapas superponga contenido de aventura a tu conjunto de reglas.

**Licencias.** Publica solo texto de reglas que tengas derecho a compartir. Muchos sistemas tienen un documento de referencia con licencia abierta; pon su ID SPDX y la atribución requerida en `license`. Un conjunto de reglas necesita sobre todo nombres y números, así que escribe todo el texto del Game Master con tus propias palabras.

### Antes de compartir

- [ ] Los IDs son definitivos y siguen las reglas de los IDs.
- [ ] `license` tiene el ID SPDX y la atribución, y no se usan nombres registrados sin permiso.
- [ ] Cada tipo de prueba, excepción, gasto y franja se tiró al menos una vez en una partida.
- [ ] `gm.checkGuidance` y `gm.sheetGuidance` son breves, nunca piden al modelo hacer cálculos y están escritos con tus propias palabras.
- [ ] Se jugaron peleas en cada estilo que permite tu conjunto de reglas, o `combat.styles` los limita.
- [ ] El manifiesto del paquete declara la versión menor correcta de Capability API.
- [ ] Se ha aumentado `version` respecto al último archivo que tiene otra persona.
- [ ] Un archivo de notas explica cómo se convirtió cada regla de origen.

## Guías relacionadas

- [Escribir conjuntos de reglas de Game Mode](../extending/writing-rulesets.md)
- [Arquitectura de Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-mode-architecture.md), para cambiar el código de reglas del Engine
- [IA de combate de Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-combat-ai.md)
- [Jugar con un conjunto de reglas](../game/rulesets.md)
