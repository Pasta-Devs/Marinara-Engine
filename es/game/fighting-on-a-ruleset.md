# Game Mode: peleas con un conjunto de reglas

Algunos conjuntos de reglas, como 5e (SRD 5.1), libran una batalla completa con sus propias reglas en lugar de prestar unas cuantas cifras al combate de Marinara. Esta guía muestra cómo es una pelea así y cómo jugar tu turno. Para las partidas con las reglas propias de Marinara, consulta [Game Mode: combate](combat.md). Para elegir un conjunto de reglas, consulta [Jugar con un conjunto de reglas](rulesets.md).

Estas peleas no las inicias tú. El Game Master (GM) inicia una cuando la historia lo requiere, como en cualquier partida. Marinara la construye a partir de las fichas del grupo y las criaturas del conjunto de reglas, o a partir de oponentes que el GM describe en los términos del conjunto de reglas.

## La pantalla de batalla

La pantalla es la propia del conjunto de reglas:

- **El menú** muestra los ataques y las habilidades de tu personaje. Cada uno indica lo que gasta de la economía de acciones del conjunto de reglas (lo que puedes hacer en cada turno) y de sus reservas (recursos acumulados, como los espacios de conjuro).
- **El panel de debajo** muestra el orden de turnos, la ronda, los estados de todos con los nombres del conjunto de reglas y lo que queda de cada presupuesto.
- **El registro** muestra el cálculo real, por ejemplo "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit."

Cada acción se escribe en la ficha de personaje en cuanto se produce. Cerrar la pestaña a mitad del combate no hace perder nada, y después se le indica al GM que las cifras ya están resueltas.

## Jugar tu turno

1. Lee el registro y el panel para ver la ronda, el orden y tus presupuestos.
2. Elige un ataque o una habilidad del menú.
3. Si necesita un objetivo, elige uno de la lista. En un campo de batalla también puedes hacer clic en uno del tablero.
4. Lee la línea del registro para ver qué pasó.
5. Cuando no te quede nada por hacer, o quieras saltarte el turno, elige **Pass** (Pasar).

Si no puedes actuar, puede que una acción falte del menú a propósito. Comprueba esto:

- Cuesta más de lo que te queda. Mira los presupuestos (lo que queda de cada reserva y acción) en el panel.
- Supera un límite por turno de un recurso. Se vuelve a ofrecer en tu siguiente turno.
- Es una forma de liberarse, que solo aparece mientras algo te retiene.
- Necesita un objetivo y no hay nadie al alcance. El menú dice **Nobody is in reach. Move closer.** (Nadie está al alcance. Acércate.) Consulta [En un campo de batalla](#on-a-battlefield).

El menú agrupa sus opciones bajo estos encabezados, cuando el conjunto de reglas los tiene:

| Grupo | Qué contiene |
| --- | --- |
| **Attacks** (Ataques), **Abilities** (Habilidades), **Items** (Objetos) | Tus ataques, habilidades y objetos. |
| **Standard actions** (Acciones estándar) | Las acciones comunes del conjunto de reglas. |
| **Stat block actions** (Acciones del bloque de estadísticas) | Las acciones que enumera el bloque de estadísticas de una criatura. |
| **Contests** (Enfrentamientos) | Agarres, empujones y liberarse (consulta [Enfrentamientos](#contests)). |
| **Movement** (Movimiento) | Caminar en un campo de batalla (consulta [En un campo de batalla](#on-a-battlefield)). |
| **Spend symbols** (Gastar símbolos) | Lo que compran los símbolos sobrantes, en un conjunto de reglas con dados de símbolos. |
| **Reload** (Recargar), **Switches** (Interruptores) | Recargar, y los interruptores que define el conjunto de reglas. |
| **End of turn** (Fin del turno) | Terminar tu turno. |

## Qué cabe en un turno

Lo que cabe en un turno lo decide el conjunto de reglas.

- Un golpe puede causar más de un tipo de daño. Cada parte se tira, se resiste y se somete a salvación por separado, mientras que el conjunto sigue siendo un solo golpe.
- Gastar una acción una vez puede comprar varios ataques. Mientras queden, el menú los ofrece gratis e indica cuántos tienes, para que puedas volver a golpear, usar otra cosa o caminar entre ellos.
- Una habilidad puede no costar nada, darte una segunda acción solo para este turno o permitirte correr, retirarte u ocultarte con una parte menor de tu turno.
- Algo que tu personaje hace siempre, como daño adicional en el primer golpe que cumple las condiciones de un turno, se añade solo y aparece en el registro.

## Estados

Un estado es un efecto duradero sobre un combatiente. Según el conjunto de reglas, puede dificultar o facilitar tus salvaciones (tiradas para resistir un efecto), reducir a la mitad todo tipo de daño, impedirte atacar a quien te lo aplicó o acercarte a esa persona, o terminar cuando esa persona cae. También puede cambiar un número: sumar a tu defensa, añadir o quitar dados en tus ataques, salvaciones y enfrentamientos, o hacerte más lento. El registro muestra cada uno junto a la tirada que cambió, y las probabilidades del menú lo tienen en cuenta. Algunos duran hasta el inicio de tu siguiente turno, o solo hasta el siguiente ataque o salvación a los que se aplican. Un conjunto de reglas también puede contar algo, como el agotamiento, en un contador de tu ficha, de modo que cada nivel empeora un poco las cosas mientras dura.

## Conjuntos con reservas de dados

Un conjunto de reglas cuyas pruebas tiran un puñado de dados y cuentan los que alcanzan un objetivo combate de la misma forma.

- **Ataques.** Un ataque tira tu reserva y necesita cierto número de éxitos para acertar, nunca menos de uno. Cada éxito por encima de esos añade un dado al daño. El daño también se tira como dados.
- **Absorción.** El objetivo puede absorber parte del daño según el tipo de daño. La absorción es una defensa que o bien tira dados que restan uno cada uno, o bien quita dados antes de tirar el daño. Lo que queda marca sus heridas.
- **Penalizaciones y estados.** Tu penalización por heridas quita dados de tus reservas igual que de tus pruebas, y un estado añade o quita dados. Las salvaciones y los enfrentamientos también son reservas.
- **El registro** indica cuántos dados se tiraron, qué tenían que alcanzar, cuántos éxitos sacaron y cuánto restó la absorción.
- **Iniciativa y límites.** Un conjunto así puede volver a tirar la iniciativa en cada ronda, y puede limitar cuánto de un recurso gastas en un turno.

Algunos conjuntos de reservas mantienen la iniciativa como un único número para todo el combate que los ataques mueven. Eliges cómo hacer cada ataque: quitarle parte de su número a tu objetivo para ti en vez de herirlo, o gastar tu propio número como dados de daño. Un ataque de gasto que acierta reinicia tu número. Uno que falla te cuesta tanto como indique el conjunto de reglas. Quien cae hasta la línea de derrumbe del conjunto (su propio límite inferior para ese número) se ha derrumbado y no puede gastar hasta recuperarse. El orden sigue los números en cada ronda, y el número de cada uno aparece junto a su salud.

Un conjunto de reglas que tira dados con símbolos narrativos, como un sistema de estilo Genesys, también los usa para pelear. Un ataque tira tus dados contra los dados de dificultad del objetivo, los símbolos se cancelan como en una prueba y lo que queda decide si impacta. El conjunto de reglas indica qué compran los símbolos sobrantes, así que nunca se le pregunta al GM.

<a id="contests"></a>

## Enfrentamientos

Un conjunto de reglas puede permitir que cualquiera en una pelea inicie un enfrentamiento: una tirada contra un oponente. Puedes agarrar a alguien, derribarlo o apartarlo de un empujón, o liberarte de un agarre. Ambos lados tiran y suman su propio número, gana el total más alto, y el menú muestra tu probabilidad de ganar antes de elegir.

- Ganar un agarre retiene a tu oponente en su sitio hasta que se libere o caigas. Perder no hace nada.
- Liberarse solo está en el menú mientras algo te retiene, y solo contra quien te retiene.
- Un empujón solo mueve a alguien en un campo de batalla, y se detiene ante los muros y ante cualquiera que esté en medio.

## Responder a la jugada de otra persona

Algunas habilidades responden a la jugada de otro combatiente en vez de usarse en tu propio turno. La pelea se detiene y el menú ofrece tu respuesta junto a **Pass** cuando:

- un oponente está a punto de usar algo,
- algo te apunta,
- un ataque acaba de alcanzarte, o
- algo acaba de hacerte daño,

y tienes una respuesta para ese momento. Después de un impacto, el registro indica qué sacó el ataque y contra qué se hizo, para que veas si una respuesta como Shield lo convertiría en un fallo. Si la usas, se vuelve a comprobar la misma tirada y el registro indica si sigue acertando.

Los oponentes también pueden responder, con una parada propia. Una reacción que anula puede detener la habilidad de un oponente antes de que ocurra, sea cual sea su objetivo, mientras el oponente esté dentro del alcance de esa reacción. Un conjunto de reglas puede indicar que solo responde a algunos tipos de habilidad, como los conjuros. Lo que costaba la habilidad detenida se gasta igualmente, y nada puede responder a una reacción que anula.

<a id="on-a-battlefield"></a>

## En un campo de batalla

Un conjunto de reglas puede definir cuánto representa una casilla de un campo de batalla en su propia distancia, en pies, pasos o su propia unidad. Si lo hace y la opción **Combat Preference** (Preferencia de combate) de tu partida está en **Tactical** (Táctico), la pelea se libra en un campo de batalla: los mismos tableros (generados o hechos a mano para el lugar), el mismo terreno y el mismo despliegue que las [batallas Tactical](combat.md#tactical-battles-and-terrain) propias de Marinara. Un conjunto sin distancia, o una partida configurada como **Classic** (Clásica), combate sin posiciones, y cualquiera puede tomar como objetivo a cualquiera.

En el campo de batalla, las cifras propias del conjunto de reglas lo deciden todo:

- La distancia que se puede recorrer en un turno procede de la regla de movimiento del conjunto o de la velocidad de la criatura.
- El alcance de un arma, cuerpo a cuerpo o a distancia, procede de sus propias filas.
- El área de una habilidad se convierte en una explosión, un cono o una línea reales, y un muro bloquea un disparo.
- Estar detrás de algo añade lo que el conjunto indique que añade la cobertura.
- Salir del alcance de alguien le permite golpearte cuando el conjunto indica que ese golpe cuesta algo.
- El movimiento va en ocho direcciones a una casilla cada una, como en las cuadrículas de mesa. No es el modelo de cuatro direcciones de las batallas Tactical propias de Marinara.

Cómo usar el tablero:

1. Cada casilla es su propio botón. Usa el puntero o las teclas de flecha. Cada casilla indica qué es, quién la ocupa y cuánto cuesta llegar caminando.
2. Elige **Move** (Mover). Las casillas que puedes alcanzar se iluminan con su coste en la unidad del conjunto. La ruta se dibuja al pasar el puntero por una o al enfocarla. El ámbar marca una casilla cuyo camino provocaría el golpe de alguien, y debajo del tablero se nombra a quiénes.
3. Elige algo que necesite un objetivo. Los objetivos válidos se iluminan, y puedes hacer clic en ellos en el tablero o en la lista.
4. Para una habilidad de área, apunta a una casilla. Las casillas a las que puedes apuntar se iluminan, y la que está bajo el puntero indica a quién alcanzaría, incluidos los aliados.
5. Pulsa <kbd>Esc</kbd> para abandonar una elección a medio hacer y devolver el teclado al menú.

Puedes gastar movimiento antes y después de una acción. El menú vuelve con lo que queda, y el panel lo muestra como **Movement** en la unidad del conjunto.

Un conjunto de reglas puede aprovechar más el campo de batalla: cobertura por grados hasta la de tres cuartos, terreno elevado que cambia los ataques y las caídas, criaturas que vuelan, nadan, trepan o excavan, **Hide** (Ocultarse) y **Search** (Buscar) en el menú, y una pausa que le pregunta a un oponente si quiere golpear cuando alguien se aparta de él. Cuáles de estas cosas usa una pelea depende del conjunto. Un conjunto de reglas también puede permitir que una criatura pase por un espacio más pequeño, monte una montura o arrastre a alguien a quien sujeta. Volar sobre obstáculos todavía no está implementado: una criatura que vuela se mueve como cualquier otra.

## Guías relacionadas

- [Game Mode: jugar con un conjunto de reglas](rulesets.md)
- [Game Mode: combate](combat.md)
- [Game Mode: dados y pruebas de habilidad](dice-and-skill-checks.md)
- [Escribir conjuntos de reglas de Game Mode](../extending/writing-rulesets.md)
