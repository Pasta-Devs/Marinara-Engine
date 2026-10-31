# Game Mode: Combate

Esta guía explica el combate del Game Mode de Marinara Engine. En el paso **World** (Mundo) del asistente, elige **Classic** (Combate con menús) o **Tactical** (Combate en cuadrícula) en **Combat Preference** (Preferencia de combate). El Game Master de IA (GM) plantea el encuentro y narra los resultados; el motor resuelve las acciones.

## Iniciar un encuentro

Tú no inicias el combate por tu cuenta. El GM inicia una pelea cuando la historia lo pide, por ejemplo cuando provocas a un enemigo o caes en una emboscada. Cuando eso pasa, se abre una pantalla de batalla completa sobre la narración. El motor arma la pelea (tu grupo, los enemigos, sus estadísticas y cualquier regla especial) a partir de lo que está ocurriendo en la historia.

La pantalla de batalla muestra tu grupo en un lado y los enemigos en el otro. Cada luchador tiene una barra de salud (HP, puntos de vida) y, si usa habilidades, una barra de magia (MP, puntos de magia). El orden de turnos se muestra arriba como **Next:** seguido del nombre de quien actúa a continuación. Un contador de rondas muestra **Round** y el número de ronda actual.

En una partida cuyo conjunto de reglas resuelve sus propias peleas, como 5e (SRD 5.1), la pelea es la del conjunto de reglas, no la que describe esta página. Consulta [Peleas con un conjunto de reglas](fighting-on-a-ruleset.md). Un conjunto de reglas que presta su ficha a las batallas conserva el combate de esta página; consulta [Qué ocurre en las batallas](rulesets.md#what-happens-in-battles).

<a id="tactical-battles-and-terrain"></a>

## Batallas tácticas y terreno

El combate táctico sitúa al grupo y a los enemigos en un campo de batalla. Selecciona una unidad del grupo, consulta su alcance de movimiento, elige destino y acción y confirma. Quién actúa y cuándo depende del **Turn order** (Orden de turnos) de la batalla (consulta [Orden de turnos](#turn-order)). Las previsiones de ataque muestran las consecuencias esperadas antes de confirmar.

No hay ajustes del campo de batalla que completar al crear una partida. Cada pelea recibe su propio tablero, generado a partir de una semilla nueva y de la descripción breve del GM para esa escena.

El GM proporciona el entorno, la formación y una descripción breve del terreno. El motor crea las casillas y posiciones iniciales exactas. La descripción puede pedir áreas de terreno y barreras cerca del centro o de un borde. El campo aceptado se guarda, por lo que recargar restaura ese tablero.

El motor comprueba la descripción y la distribución resultante. Conserva el terreno solicitado y garantiza que el encuentro sea accesible. Si las restricciones son incompatibles, el combate informa del problema. **Use generated terrain** (Usar terreno generado) comienza explícitamente sin los elementos rechazados; no los elimina en silencio.

El mundo de una partida también puede tener **campos de batalla hechos a mano**. Son tableros pintados casilla a casilla para uno de los lugares del mundo, con un creador como Pixelforge. Cuando empieza una pelea mientras el grupo está en ese lugar, o en un lugar dentro de él, la pelea usa uno de esos tableros en vez de uno generado. El tablero se usa exactamente como se pintó, en la escena para la que se pintó. Si el lugar tiene varios tableros, la semilla de la pelea elige uno. La descripción del terreno del GM no se usa ahí, pero su formación sigue decidiendo dónde empieza cada bando. Al GM se le dice que el tablero se hizo para este lugar, y la línea del campo de batalla nombra el tablero.

Un tablero hecho a mano debe cumplir tres reglas. Tiene uno de los tres tamaños de tablero. Las dos columnas de cada lado son llanura, donde se forman los bandos. Cada casilla en la que puede estar un luchador conecta con las demás. El creador rechaza un tablero que incumple una regla y dice por qué. Los campos de batalla hechos a mano se guardan con las ediciones a mano del mundo, así que viajan con él en los archivos de mundo, los paquetes de mapas y la biblioteca.

| Terreno | Caminar | Defensa y evasión |
| --- | --- | --- |
| Llanura | Cuesta 1 punto de movimiento | Sin bonificación |
| Bosque | Cuesta 2 puntos de movimiento | +1 de defensa, +15 puntos porcentuales de evasión |
| Ruinas | Cuesta 1 punto de movimiento | +1 de defensa, +10 puntos porcentuales de evasión |
| Montaña, agua, muro | Bloquea el movimiento a pie | Sin bonificación |

Las unidades con una capacidad establecida de vuelo o teletransporte pueden moverse de otra manera:

- **Caminar** sigue casillas de suelo accesibles. Los enemigos bloquean el paso; no se puede terminar en una casilla ocupada.
- **Volar** cruza terreno y unidades intermedias por un punto de movimiento por casilla, incluidos los bosques. Una unidad voladora puede mantenerse sobre una casilla normalmente bloqueada, pero no terminar sobre otra unidad.
- **El teletransporte** ignora terreno y unidades intermedias. El destino debe estar dentro del alcance, desocupado y ser transitable a pie. No puede terminar dentro de un muro, sobre una montaña ni sobre agua sin apoyo.

Ambos movimientos especiales usan la capacidad de movimiento actual y la distancia ortogonal entre casillas. Conservan las bonificaciones de defensa y evasión del destino. Ambos ignoran la altura (ver abajo). No se modelan la altitud de un volador, los techos ni los costes y requisitos de visión específicos de hechizos.

<a id="turn-order"></a>

### Orden de turnos

Una batalla Tactical reparte los turnos de una de dos formas:

- **One at a time, by initiative** (Uno a uno, por iniciativa): cada unidad recibe un puesto en un orden tirado, y solo puede actuar la unidad a la que le toca. El tablero muestra el orden de turnos. Las partidas Overworld RPG nuevas usan este modo.
- **Your whole party, then the enemies** (Todo tu grupo y luego los enemigos): cada unidad del grupo puede actuar y luego se juega la fase enemiga. Las partidas Classic usan este modo.

Para cambiarlo, abre **Chat Settings** (Ajustes del chat), expande **Combat Style** (Estilo de combate) y elige un **Turn order**. Aparece mientras el **Battle system** (Sistema de batalla) es Tactical, salvo que el conjunto de reglas de la partida resuelva sus propios combates. El cambio se aplica en la siguiente batalla; una batalla ya en curso conserva su orden.

### Visión, cobertura y altura

- **Visión.** Los muros y las montañas bloquean la visión. Una unidad solo puede atacar, usar una habilidad o usar un objeto sobre un objetivo que puede ver.
- **Cobertura.** Algo entre el atacante y el objetivo protege al objetivo. Una casilla de bosque o de ruinas en medio, o un muro o una montaña que tapa parte de la vista, da media cobertura. Un muro o una montaña que tapa la mayor parte de la vista da cobertura de tres cuartos. La media cobertura resta 15 puntos porcentuales a la probabilidad de acierto, y la de tres cuartos, 30. La bonificación de la casilla del propio objetivo y su cobertura no se suman: cuenta la mejor.
- **Altura.** En un tablero con montañas, una montaña tiene dos niveles de altura y el terreno que la rodea, uno. Subir un nivel caminando cuesta un punto de movimiento más, y bajar no cuesta nada. Un escalón de dos niveles o más es un acantilado, por el que nadie puede caminar. El terreno elevado también bloquea la visión entre dos casillas más bajas. Atacar hacia abajo desde un terreno elevado suma 10 a la probabilidad de acierto, un ataque a distancia desde un terreno elevado llega una casilla más lejos, y una cobertura baja, como un bosque, no oculta a un objetivo visto desde arriba. Los campos de batalla hechos a mano pueden tener sus propios acantilados.

Las invocaciones todavía no forman parte del combate propio de Marinara.

## Batallas clásicas

Una batalla Classic no tiene tablero. Participa todo el grupo, pero la acción que elijas controla al primer miembro vivo del grupo; los demás compañeros actúan por su cuenta. El menú de acciones y los cálculos de combate que se describen a continuación determinan cómo se juegan las batallas Classic.

## El menú de acciones

En tu turno, eliges una acción del menú. Las seis acciones son:

- **Attack** (Atacar): golpea a un enemigo con un ataque básico.
- **Skills** (Habilidades): usa una habilidad especial. Las habilidades pueden costar MP. Algunas curan a un aliado, algunas golpean a un enemigo y algunas aplican un buff o un debuff.
- **Special** (Especial): escribe una acción libre con tus propias palabras y luego pulsa **Ask GM** (Preguntar al GM). Por ejemplo: "Lanzo arena a la lente agrietada del Ruin Guard". El GM decide qué pasa.
- **Defend** (Defender): sube tu Defensa durante el resto de la ronda para recibir menos daño.
- **Items** (Objetos): usa un objeto de tu bolsa. Elige **Full inventory** (Inventario completo) para abrir tu lista completa de objetos desde aquí. En una partida con un conjunto de reglas, los objetos propios del conjunto hacen lo que dice el conjunto: cuánto curan o dañan y los estados que aplican. Uno que tiene cargas se ofrece mientras le quede un uso, y uno que pide antes una prueba la tira al usarse: si falla, se gasta para nada. Uno al que el conjunto no da ningún uso no se ofrece. El resto de tus objetos hacen lo que el Game Master decidió al empezar la pelea, salvo que el conjunto desactive los objetos propios de Game Mode.
- **Flee** (Huir): abandona la pelea de inmediato. Huir termina el combate al instante.

Después de elegir, la ronda se resuelve. Los resultados aparecen como números de daño flotantes, barras de salud que cambian y líneas en el registro de combate.

<a id="how-combat-math-works"></a>

## Cómo funcionan las matemáticas del combate

Una vez que empieza una pelea, cada ronda se decide con matemáticas de dados fijas, no con la IA. El GM solo narra los resultados. Nunca decide quién golpea ni cuánto daño cae. Esto hace que el combate sea justo y consistente. Un "d20" más abajo significa una tirada de un dado de veinte caras (un número del 1 al 20).

### Iniciativa (orden de turnos)

Al comienzo de cada ronda, cada luchador tira un d20 y suma un bono basado en su Velocidad. Los totales más altos actúan primero. Un luchador se salta toda la ronda si está congelado, aturdido o aprisionado, o si su Velocidad ha bajado a 0.

### Ataque y defensa

Cuando un luchador ataca a otro:

1. El atacante tira un d20 y suma un bono de su estadística de Ataque.
2. El defensor tira un d20 y suma un bono de su estadística de Defensa.
3. Si el total del atacante es menor que el total del defensor, el ataque falla.
4. Un golpe crítico ocurre con un 20 natural, o cuando el atacante supera al defensor por 10 o más.

### Daño

En un golpe acertado, el daño base viene de la estadística de Ataque del atacante y crece con su nivel. Se suman dados de daño extra, y los luchadores de nivel más alto tiran más de ellos. Un golpe crítico multiplica el total por 1,5. La Defensa del defensor reduce entonces el daño, bloqueando hasta el 40 por ciento de su valor de Defensa.

### Escalado de dificultad

El último paso escala el daño según la Dificultad del juego, que tú fijas en el asistente de configuración. Los cuatro ajustes multiplican el daño final así:

| Dificultad | Multiplicador de daño |
|---|---|
| Casual | 0.6 |
| Normal | 1.0 |
| Hard | 1.3 |
| Brutal | 1.6 |

Una dificultad más alta significa que ambos lados golpean más fuerte, así que las peleas son más cortas y arriesgadas.

## Efectos de estado y reacciones elementales

Un efecto de estado es un cambio temporal en el Ataque, la Defensa, la Velocidad o el HP de un luchador. Los buffs ayudan y los debuffs perjudican. Un estado dura un número fijo de rondas y luego desaparece. Los efectos de tipo veneno drenan HP cada ronda, mientras que los de tipo regeneración lo restauran. Tres efectos con nombre (congelado, aturdido y aprisionado) hacen que el luchador afectado se salte su turno.

Algunos ataques y habilidades llevan un elemento: Fire, Ice, Lightning, Poison, Holy o Shadow. El primer elemento que golpea a un objetivo deja un aura, que es un rastro persistente de ese elemento. Un elemento distinto que golpee al mismo objetivo activa entonces una reacción elemental. La reacción añade daño extra y, a menudo, un efecto de estado.

Ejemplos de reacciones son Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse y Electrotoxin. Este sistema funciona por sí solo. No lo activas ni lo configuras. Las reacciones ocurren automáticamente cuando los elementos correctos se encadenan en el mismo objetivo.

## Elementos

Los ataques, las habilidades y los objetos pueden llevar un elemento, y un elemento que alcanza a un objetivo que aún lleva el aura de otro puede desencadenar una reacción que golpea más fuerte. Qué elementos existen depende de la ambientación: una partida sin kit de ambientación, o con uno que no nombra ninguno, combate con los seis clásicos (fuego, hielo, rayo, veneno, sagrado y sombra); una partida wuxia, con las cinco fases (madera, fuego, tierra, metal y agua, cada una vence a la siguiente); una partida cyberpunk o de ópera espacial, con cinético, térmico, EM y químico o plasma; y una partida de la época actual o de los años veinte, sin ninguno. La lluvia y las tormentas en terreno abierto debilitan los elementos parecidos al fuego y refuerzan los parecidos al rayo. En un combate táctico, un elemento golpea más fuerte contra uno al que vence y más débil contra uno que lo vence. Puedes cambiar los elementos de un kit y sus reacciones en **Change its words** (Cambiar sus palabras).

## Campos de batalla

El tablero de un combate táctico se distribuye como el tipo de lugar en el que ocurre la pelea: un bosque tiene árboles entre los que esconderse, una mazmorra muros y pasillos, una ciudad calles. Una partida con kit de ambientación nombra sus propias escenas con sus palabras, cada una distribuida como uno de esos tableros, así que una pelea cyberpunk ocurre en una azotea o en el pasillo de un megabloque y una pelea wuxia en un bosque de bambú o en una casa de té, y las casillas del tablero también usan las palabras de la ambientación (cobertura y escombros en vez de bosque y ruinas). El mapa de una zona y los pequeños detalles en los que se le pide al Game Master que se fije siguen la ambientación de la misma forma. Puedes cambiar las escenas de un kit y las palabras de sus casillas en **Change its words**.

## Mecánicas de jefe y botín

Los enemigos fuertes pueden tener mecánicas de jefe, que son reglas especiales que el GM escribe para esa pelea. Una mecánica puede activarse según un horario, por ejemplo cada pocas rondas, o cuando el jefe baja de un nivel de salud fijado. Las mecánicas pueden golpear a todo tu grupo, aplicar un buff al jefe o aplicar un efecto de estado. Cuando una se activa, el efecto aparece en el registro de combate para que puedas reaccionar.

Cuando ganas una pelea, los enemigos sueltan botín, que va directamente a las bolsas del grupo cuando termina la pelea. Cada objeto tiene una rareza, de más a menos común: common, uncommon, rare, epic y legendary. Una dificultad más alta inclina los objetos que caen hacia otros más raros y reparte un poco más de ellos. Lo que cae depende de tu ambientación: una partida con kit de ambientación suelta el botín propio del kit (una partida de la época actual suelta una tarjeta regalo o un botiquín, nunca una espada encantada), y puedes cambiar esas palabras en **Change its words** del kit. Una partida sin kit suelta lo que suele tener su género, y un género sin kit inicial, como Steampunk, suelta cosas sencillas que no pertenecen a ninguna ambientación concreta. Una notificación indica lo que cayó, y al Game Master se le dice que ya está en tus bolsas. En una partida cuyo conjunto de reglas tiene sus propias tablas de botín, los enemigos sueltan en su lugar los objetos del conjunto, y un conjunto que desactiva los objetos propios de Game Mode suelta solo los suyos. Un cartel de **Victory!** aparece cuando ganas, y un cartel de **Defeat...** aparece si tu grupo cae.

## Interrumpir al GM

Mientras el GM todavía escribe su respuesta, puedes intervenir con el botón **Interrupt** (Interrumpir). Nada de lo que escribas se confirma hasta que lo envías de verdad. Al hacer clic en **Interrupt** se abre una ventana de confirmación titulada **Attempt to Interrupt?** con tres opciones:

- **No**: cancela y deja que el GM siga escribiendo.
- **Force Interrupt** (Forzar interrupción): interviene de forma limpia. Al GM no se le dice que interrumpiste. Tu campo de entrada recibe un contorno verde.
- **Yes** (Sí): intenta una interrupción dentro de la historia que el GM puede resistir. Tu campo de entrada se pone rojo, y la app sugiere "using dice recommended" mientras el botón de dados palpita. Tirar los dados aquí puede ayudar a que tu intento tenga éxito.

Después de confirmar, escribe tu mensaje y envíalo. Si cambias de idea, pulsa **Resume** (Reanudar) para descartar la interrupción pendiente y dejar que la narración continúe. Este control es útil en un momento tenso, como reaccionar justo antes de que estalle una pelea.

## Quick-Time Events

El GM puede activar una superposición de Quick-Time Events, también llamada QTE, para momentos de acción rápidos como esquivar o perseguir. La superposición muestra una barra de cuenta atrás que se encoge, un aviso **React quickly!** (¡Reacciona rápido!) y un botón por cada opción. Cada botón está numerado (1, 2, 3, y así sucesivamente). Haz clic en el botón de la acción que quieras.

Elige una acción antes de que se acabe el tiempo para ganar un bono. Cuanto más rápido reacciones, mayor será el bono. Si el tiempo se acaba primero, recibes una penalización en su lugar. Un Quick-Time Event no usa dados. Es pura velocidad.

## Combate en el teléfono

En un teléfono, la pantalla de batalla se reorganiza para caber en una pantalla pequeña. Los botones de acción se fijan en la parte inferior de la pantalla. Los paneles que no caben en línea pasan a un panel lateral deslizable con cuatro pestañas:

- **Party** (Grupo): los miembros de tu grupo y su salud.
- **Boss Mechanics** (Mecánicas de jefe): las reglas especiales de la pelea actual.
- **Dialogue** (Diálogo): las líneas de batalla que dicen los luchadores.
- **Combat Log** (Registro de combate): el registro ronda a ronda de lo que ocurrió.

Toca una pestaña para abrir su panel. Para cerrarlo, toca fuera del panel o toca el botón de cerrar.

## Guías relacionadas

- [Game Mode: peleas con un conjunto de reglas](fighting-on-a-ruleset.md)
- [Game Mode: Dados y pruebas de habilidad](dice-and-skill-checks.md)
- [Game Mode: Grupo y NPCs](party-and-npcs.md)
- [Game Mode: Primeros pasos](getting-started.md)
- [Encuentros de combate en Roleplay](../roleplay/combat-encounters.md)
