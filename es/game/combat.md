# Game Mode: Combate

Esta guía explica el combate del Game Mode de Marinara Engine. En el paso **World** (Mundo) del asistente, elige **Classic** (Combate con menús) o **Tactical** (Combate en cuadrícula) en **Combat Preference** (Preferencia de combate). El Game Master de IA (GM) plantea el encuentro y narra los resultados; el motor resuelve las acciones.

<a id="tactical-battles-and-terrain"></a>

## Batallas tácticas y terreno

El combate táctico sitúa al grupo y a los enemigos en un campo de batalla. Selecciona una unidad del grupo, consulta su alcance de movimiento, elige destino y acción y confirma. Cada unidad puede actuar antes de la fase enemiga. Las previsiones de ataque muestran las consecuencias esperadas antes de confirmar.

Al crear una partida Tactical, puedes elegir opcionalmente una semilla, un tamaño e indicaciones de terreno para el GM. Deja la semilla vacía para generarla. Es un entero entre 0 y 4294967295, incluido cero. Reproduce el tablero cuando los combatientes, la descripción del terreno y las demás entradas del generador son iguales; no obliga al GM a crear la misma historia ni los mismos enemigos.

El GM proporciona el entorno, la formación y una descripción breve del terreno. El motor crea las casillas y posiciones iniciales exactas. La descripción puede pedir áreas de terreno y barreras cerca del centro o de un borde. Las indicaciones son una petición al GM, no una garantía de convertir cada palabra en una casilla. El campo aceptado se guarda, por lo que recargar restaura ese tablero.

El motor comprueba la descripción y la distribución resultante. Conserva el terreno solicitado y garantiza que el encuentro sea accesible. Si las restricciones son incompatibles, el combate informa del problema. **Use generated terrain** (Usar terreno generado) comienza explícitamente sin los elementos rechazados; no los elimina en silencio. Los mapas pintados a mano con precisión y el editor de campos de batalla aún no están disponibles.

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

Ambos movimientos especiales usan la capacidad de movimiento actual y la distancia ortogonal entre casillas. Conservan las bonificaciones de defensa y evasión del destino. Este modelo sencillo de cuadrícula plana no representa altitud, techos ni costos o requisitos de visión de hechizos específicos.

El combate táctico usa fases del grupo y del enemigo, no iniciativa individual de juegos de mesa. Los muros que bloquean el movimiento todavía no bloquean ataques a distancia por línea de visión. Cobertura, perfiles de reglas de mesa y combate completo con invocaciones son trabajos futuros separados.

## Batallas clásicas

Las siguientes secciones sobre menús y cálculos de dados describen el combate Classic. Participa todo el grupo, pero la orden elegida controla al primer combatiente vivo del grupo; los demás compañeros actúan automáticamente.

## Iniciar un encuentro

Tú no inicias el combate por tu cuenta. El GM inicia una pelea cuando la historia lo pide, por ejemplo cuando provocas a un enemigo o caes en una emboscada. Cuando eso pasa, se abre una pantalla de batalla completa sobre la narración. El motor arma la pelea (tu grupo, los enemigos, sus estadísticas y cualquier regla especial) a partir de lo que está ocurriendo en la historia.

La pantalla de batalla muestra tu grupo en un lado y los enemigos en el otro. Cada luchador tiene una barra de salud (HP, puntos de vida) y, si usa habilidades, una barra de magia (MP, puntos de magia). El orden de turnos se muestra arriba como **Next:** seguido del nombre de quien actúa a continuación. Un contador de rondas muestra **Round** y el número de ronda actual.

<a id="games-whose-ruleset-resolves-its-own-fights"></a>

### Partidas cuyo conjunto de reglas resuelve sus propios combates

Un conjunto puede resolver una pelea completa con sus propias reglas, en vez de prestar unas cifras al combate de Marinara. En ese caso, la pantalla de batalla le pertenece: el menú ofrece los ataques y habilidades del personaje, su propia economía de acciones, sus estados y un registro con los cálculos reales. Todo se guarda en la ficha en el momento en que ocurre.

El conjunto también define qué cabe en un turno. Un golpe puede causar varios tipos de daño: cada parte se tira, se resiste y se somete a salvación por separado, pero el conjunto sigue siendo un solo golpe. Gastar una acción puede comprar varios ataques; mientras queden, el menú los ofrece gratis e indica cuántos tienes, para que puedas cambiar de arma o caminar entre ellos. Una habilidad puede ser gratuita, devolver una segunda acción solo para este turno o permitir correr, retirarte u ocultarte gastando una parte menor de tu turno. Algo que tu personaje hace siempre, como daño adicional en el primer golpe que cumple las condiciones de un turno, se añade automáticamente y aparece en el registro. Un estado puede dificultar o facilitar tus propias salvaciones, reducir a la mitad todo tipo de daño, impedirte atacar a quien te lo aplicó o acercarte a él, o terminar cuando caiga.

El conjunto también puede definir cuánto representa una casilla en su propia distancia, en pies, pasos o la unidad que use. Si lo hace y **Combat Preference** (Preferencia de combate) está en **Tactical** (Táctico), la pelea usa un campo generado con los mismos tableros, terreno y despliegue de las batallas Tactical anteriores. La preferencia vuelve a tener efecto en estas partidas. Un conjunto sin distancia, o una partida **Classic** (Clásica), combate como antes: cualquiera puede apuntar a cualquiera.

En ese campo, las cifras del conjunto lo determinan todo. La distancia que recorres por turno procede de su regla de movimiento o de la velocidad de la criatura; el alcance de un arma, de sus filas; el área de una habilidad se convierte en una explosión, un cono o una línea reales; los muros bloquean disparos; la cobertura añade lo que indique el conjunto; y salir del alcance de alguien le permite golpearte cuando las reglas definen el coste de ese ataque. El movimiento usa ocho direcciones a una casilla cada una, como las cuadrículas de mesa para las que se escribieron estas reglas, en vez de las cuatro direcciones del combate Tactical propio de Marinara descrito arriba.

El campo aparece en pantalla. Cada casilla es un botón: puedes recorrerlo con el puntero o las flechas, y cada uno anuncia qué es, quién lo ocupa y cuánto cuesta llegar. **Move** (Mover) ilumina las casillas alcanzables con su coste en la unidad del conjunto, dibuja el camino al pasar el puntero o enfocarlas y marca en ámbar las casillas cuyo camino provoca ataques, indicando quién los haría debajo del tablero. Una acción que requiere objetivo ilumina los válidos y permite seleccionarlos en el tablero o la lista. Si no alcanza a nadie, aparece **Nobody is in reach. Move closer.** (Nadie está al alcance. Acércate.) en vez de ofrecer un golpe al vacío. Un área se apunta a una casilla: se iluminan los orígenes válidos y la casilla bajo el puntero indica a quién alcanzaría, incluidos los aliados. Puedes gastar movimiento antes y después de una acción; el menú vuelve con lo que queda y el panel inferior lo muestra como **Movement** (Movimiento) en la unidad del conjunto. Escape abandona una selección incompleta y devuelve el foco del teclado al menú.

La cobertura de tres cuartos, la elevación, volar sobre obstáculos, ocultarse, el movimiento forzado y elegir si atacar a alguien que se aleja son trabajos futuros separados.

<a id="games-that-use-a-ruleset"></a>

### Partidas con un conjunto de reglas

Si el conjunto permite usar su [ficha](party-and-npcs.md#the-ruleset-sheet) en combate, la batalla empieza con sus recursos y espacios actuales. Las capacidades de catálogo pasan a ser habilidades solo si el combate de Marinara Engine puede ejecutarlas. Se omiten entradas no destinadas al combate, reacciones y costes incompatibles.

La salud se transfiere como proporción del máximo: media salud en la ficha equivale a media barra en batalla. Al terminar se devuelve esa proporción; los recursos y espacios se transfieren directamente. Se conserva el cálculo de combate integrado, sin tiradas de ataque, salvación o concentración del sistema de mesa. Borrar el mensaje que inició el combate no devuelve cambios a la ficha. Sin declaración de combate, las reglas descritas aquí siguen iguales.

## El menú de acciones

En tu turno, eliges una acción del menú. Las seis acciones son:

- **Attack** (Atacar): golpea a un enemigo con un ataque básico.
- **Skills** (Habilidades): usa una habilidad especial. Las habilidades pueden costar MP. Algunas curan a un aliado, algunas golpean a un enemigo y algunas aplican un buff o un debuff.
- **Special** (Especial): escribe una acción libre con tus propias palabras y luego pulsa **Ask GM** (Preguntar al GM). Por ejemplo: "Lanzo arena a la lente agrietada del Ruin Guard". El GM decide qué pasa.
- **Defend** (Defender): sube tu Defensa durante el resto de la ronda para recibir menos daño.
- **Items** (Objetos): usa un objeto de tu bolsa. Elige **Full inventory** (Inventario completo) para abrir tu lista completa de objetos desde aquí.
- **Flee** (Huir): abandona la pelea de inmediato. Huir termina el combate al instante.

Después de elegir, la ronda se resuelve. Los resultados aparecen como números de daño flotantes, barras de salud que cambian y líneas en el registro de combate.

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

## Mecánicas de jefe y botín

Los enemigos fuertes pueden tener mecánicas de jefe, que son reglas especiales que el GM escribe para esa pelea. Una mecánica puede activarse según un horario, por ejemplo cada pocas rondas, o cuando el jefe baja de un nivel de salud fijado. Las mecánicas pueden golpear a todo tu grupo, aplicar un buff al jefe o aplicar un efecto de estado. Cuando una se activa, el efecto aparece en el registro de combate para que puedas reaccionar.

Cuando ganas una pelea, los enemigos sueltan botín. Cada objeto tiene una rareza, de más a menos común: common, uncommon, rare, epic y legendary. Una dificultad más alta inclina los objetos que caen hacia otros más raros y reparte un poco más de ellos. Un cartel de **Victory!** aparece cuando ganas, y un cartel de **Defeat...** aparece si tu grupo cae.

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

- [Game Mode: Dados y pruebas de habilidad](dice-and-skill-checks.md)
- [Game Mode: Grupo y NPCs](party-and-npcs.md)
- [Game Mode: Primeros pasos](getting-started.md)
- [Encuentros de combate en Roleplay](../roleplay/combat-encounters.md)
