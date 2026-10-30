# Juegos de mesa en conversación

Esta guía cubre los seis paquetes opcionales de juegos de mesa que puedes jugar contra los personajes de un chat en Conversation Mode: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** y **Rock-Paper-Scissors**. Explica cómo empezar un juego y qué significa cada opción de configuración. También muestra cómo jugar en cada tablero y cómo dejar que los personajes empiecen juegos por su cuenta.

## Qué son los juegos de mesa

Los juegos de mesa son pequeños juegos de tablero que corren dentro de un chat en Conversation Mode. Marinara Engine reparte las cartas o prepara el tablero, y aplica cada regla por ti. Cada personaje sentado narra sus propias jugadas dentro de su papel. Un tablero en vivo aparece encima de la caja de mensajes mientras juegas.

Instala cada juego que quieras desde **Agents → Agent Organizer (Organizador de agentes)** . Queda disponible de inmediato, sin reiniciar Marinara. Un juego que no esté instalado no aparece en el selector de juegos, su comando slash no está disponible y su ajuste de comando de personaje se mantiene oculto.

Dos cosas que debes tener presentes:

- Los juegos de mesa funcionan solo en Conversation Mode. No puedes empezar uno en un chat de Roleplay ni en Game Mode. Si escribes un comando de juego en un chat de Roleplay, verás un mensaje como "UNO can only be played in conversation chats."
- Solo puede haber un juego activo por chat a la vez. Empezar un juego nuevo reemplaza cualquier juego que ya esté corriendo en ese chat, incluso uno terminado que todavía muestre su cartel de final.

También necesitas al menos un personaje en el chat. Debes sentar a al menos uno de ellos como bot antes de poder repartir o empezar. Las jugadas del bot y las líneas dentro de su papel usan la misma conexión que tus respuestas normales de chat. No hace falta ninguna cuenta ni API key adicional. Una **API key** (clave de API) es el código secreto que le permite a Marinara comunicarse con un proveedor de IA.

## Empezar un juego

Hay tres maneras de empezar un juego. Las tres funcionan solo en un chat de Conversation Mode con al menos un personaje.

### Escribe un comando slash

Un **comando slash** es una instrucción corta que escribes en la caja de mensajes y que empieza con una barra diagonal. Escribe uno de estos y pulsa Enter para abrir la ventana de configuración de ese juego:

- **/uno** empieza una partida de UNO con los personajes de este chat.
- **/chess** empieza una partida de ajedrez uno contra uno con un personaje de este chat.
- **/poker** empieza una partida de póker Texas Hold'em con los personajes de este chat.
- **/8ball** (o **/pool**) empieza una partida de billar 8-ball uno contra uno con un personaje de este chat.
- **/tictactoe** (o **/ttt**) empieza una partida de tres en raya uno contra uno con un personaje de este chat.
- **/rps** empieza un duelo de Rock-Paper-Scissors uno contra uno con un personaje de este chat.

### Dilo en el chat

También puedes simplemente pedirlo en un mensaje normal. Un mensaje como "let's play uno", "start a game of chess" o "deal me into poker" abre la ventana de configuración de ese juego automáticamente. Tu mensaje se envía igual que siempre, así que un personaje puede reaccionar a tu invitación en la misma respuesta. Esto solo ocurre cuando ese juego no está ya corriendo en el chat.

### Deja que un personaje te invite

Un personaje puede ofrecer un juego (o aceptar tu oferta) por su cuenta. Cuando un personaje está dispuesto a jugar en ese momento, su respuesta empieza el juego de inmediato con las reglas predeterminadas del chat. No aparece ninguna ventana de configuración. Si el personaje está ocupado o no quiere jugar, simplemente lo dice dentro de su papel.

Para que este camino funcione, el ajuste **Commands** (Comandos) del chat debe estar activado, y el interruptor propio de ese juego también debe estar activado. Consulta "Deja que los personajes empiecen juegos por su cuenta" más abajo.

## UNO

### Configura UNO

La ventana de configuración se titula **Start UNO**.

En la sección **Players** (Jugadores), marca cada personaje que quieras que juegue como bot. Todos los personajes del chat están marcados de forma predeterminada. La casilla **You go first** está marcada de forma predeterminada y te da el turno de apertura. Si el chat no tiene personajes, la sección dice "Add at least one character to this chat to play."

La sección **House rules** (Reglas de la casa) contiene reglas opcionales. Todas están desactivadas de forma predeterminada. Activa las que quieras:

| Regla | Qué hace |
|---|---|
| **Stacking** | Acumula +2/+4 sobre el siguiente jugador en vez de robar. |
| **Draw to match** | Sigue robando hasta que robes una carta jugable. |
| **7-0 rule** | El 7 intercambia manos con un jugador elegido; el 0 rota todas las manos. |
| **Jump-in** | Juega una carta idéntica fuera de turno. |
| **Force play** | Si una carta robada es jugable, debes jugarla. |

Debajo de las reglas, **Starting hand** (Mano inicial) fija con cuántas cartas empieza cada jugador. El valor predeterminado es **7**, y puedes elegir cualquier valor de 1 a 10. La casilla **Penalize missed UNO** está marcada de forma predeterminada. Cuando está activada, un jugador al que pillen sin declarar UNO roba 2 cartas, y la mecánica "Catch!" está activa. Cuando está desactivada, no hay penalización.

Haz clic en **Cancel** para cerrar la ventana, o haz clic en **Deal** (Repartir) para empezar. El botón Deal muestra el número total de asientos, por ejemplo **Deal (3p)** para ti más dos bots. Se mantiene desactivado hasta que se seleccione al menos un personaje. UNO sienta de 2 a 10 jugadores en total.

### Juega en el tablero de UNO

El tablero aparece encima de la caja de mensajes, titulado **UNO**. Muestra el color activo y una flecha de dirección que se invierte con un Reverse. También muestra el conteo del montón de robo como "Draw pile: N", más una insignia "+N" cuando hay una penalización de robo acumulada. La línea de turno dice "Your turn" en tu turno o el nombre del personaje en caso contrario.

Los asientos se listan en orden de juego. Tu asiento está marcado con "(you)", el asiento que va a jugar está marcado con "next", y cualquier asiento que baje a una carta muestra "UNO?". Si un oponente llega a una carta sin declarar UNO, un botón **Catch!** te deja delatarlo. Esto solo aparece cuando la regla **Penalize missed UNO** está activada.

Tu mano se muestra como cartas en las que puedes hacer clic. Las cartas jugables se levantan y resaltan; el resto se atenúan. Al hacer clic en una carta comodín se abre un selector "Pick a color:". Con la **7-0 rule** activada, al hacer clic en un 7 se abre un selector "Swap hands with:". Aparecen botones adicionales según haga falta, como **Draw**, **Pass** y un **Call UNO!** resaltado cuando debes declarar. Jugar tu penúltima carta declara UNO por ti al mismo tiempo, así que un bot no puede pillarte en ese instante.

Cuando el juego termina, un cartel dice "{winner} wins!" o "Game over" si no hay un ganador claro.

## Chess

### Configura Chess

La ventana de configuración se titula **Start Chess**. El ajedrez siempre es uno contra uno, así que juegan exactamente dos asientos.

En la sección **Opponent** (Oponente), elige un único personaje con los botones de opción. El primer personaje está seleccionado de forma predeterminada. Incluso en un chat grupal, solo se sienta un personaje como tu oponente. Los demás siguen chateando con normalidad.

En la sección **Your color** (Tu color), elige **White**, **Random** o **Black**. **Random** es el valor predeterminado. Una nota dice "White moves first."

Haz clic en **Cancel** para cerrar la ventana, o haz clic en **Start game** para comenzar.

### Juega en el tablero de Chess

El tablero aparece titulado **Chess**, con una cuadrícula de 8x8 y piezas dibujadas a mano. La ficha de cada bando muestra las piezas enemigas que ha capturado y una ventaja de material "+N". La línea de turno dice "Your turn" en tu turno, o muestra el nombre del personaje en el suyo. Añade un aviso de jaque cuando estás en jaque.

Haz clic en una de tus propias piezas para seleccionarla. Los movimientos legales se muestran como un punto en las casillas vacías y un anillo en las capturas. El último movimiento y cualquier jaque se resaltan, y los bordes están etiquetados con las filas y columnas. Cuando juegas con las negras, el tablero se voltea para que tu bando quede abajo. Un peón que llega a la última fila abre un selector "Promote to:" con Queen, Rook, Bishop y Knight.

Cuando el juego termina, un cartel anuncia al ganador por jaque mate, un empate con su motivo (como ahogado o la regla de los cincuenta movimientos), o "Game over". Una tira corta de historial de movimientos debajo del tablero lista los movimientos recientes en notación estándar.

## Poker

### Configura Poker

La ventana de configuración se titula **Start Poker**. La mesa sienta de 2 a 8 jugadores, es decir, tú más hasta siete personajes.

En la sección **Players**, marca los personajes que quieras sentar. Una vez marcados siete, el resto se atenúan. Una nota dice "8 seats max (you + up to 7 characters)."

La sección **Dealer** (Repartidor) es un menú desplegable. El valor predeterminado es **House dealer (silent)**, que reparte sin comentarios. En su lugar, puedes elegir cualquier personaje para que anuncie las manos, los flops y los showdowns con su propia voz. Las cartas se reparten de forma justa en ambos casos, y un repartidor no tiene por qué ser un jugador sentado.

La sección **Stakes** (Apuestas) tiene cuatro cajas numéricas:

| Ajuste | Predeterminado | Notas |
|---|---|---|
| **Starting stack** | **1000** | Fichas con las que empieza cada jugador (100 a 1,000,000). |
| **Small blind** | **10** | La ciega grande siempre es el doble de esta. |
| **Blinds double every** | **0** | Número de manos entre subidas de ciega. 0 significa nunca. |
| **Hand limit** | **0** | 0 significa jugar hasta que solo un jugador tenga fichas. |

Cuando fijas un **Hand limit**, la sesión termina después de esa cantidad de manos y gana el jugador con más fichas.

Haz clic en **Cancel** para cerrar la ventana, o haz clic en **Deal** para empezar. El botón Deal muestra el conteo de asientos, por ejemplo **Deal (4p)**.

### Juega en el tablero de Poker

El encabezado del tablero muestra la mano actual, la calle y las ciegas, junto con el bote total. La línea de turno dice "Your turn" o el nombre del personaje actual. Cinco ranuras de cartas comunitarias se sitúan encima de los asientos.

Cada asiento muestra el nombre del jugador, "(you)" en el tuyo, una insignia "D" para el botón del repartidor, y "SB" o "BB" para las ciegas. También muestra el conteo de fichas y el estado, como una apuesta actual, "folded", "all in" o "busted". Tus propias dos cartas tapadas aparecen más grandes bajo "Your hand". Una etiqueta en lenguaje sencillo aparece en cuanto tienes una mano, por ejemplo "Full house, kings over nines".

En tu turno, una barra de acciones te da **Fold**, **Check**, **Call** y un **All in** resaltado. Cuando puedes apostar o subir, aparece una caja de apuesta con botones rápidos **Min**, **½ pot**, **Pot** y **All-in** más un botón de envío.

Al final de cada mano, un panel **Showdown** revela las manos y adjudica el bote. Un botón **Next hand** reparte la siguiente ronda. Cuando termina toda la sesión, un cartel nombra al ganador de la sesión y lista el conteo final de fichas de cada asiento.

## 8-Ball Pool

### Configura 8-Ball Pool

La ventana de configuración se titula **Start 8-Ball Pool**. El billar es uno contra uno, así que juegas contra un único personaje.

- **Opponent**: elige el personaje contra el que juegas.
- **Announcer** (Locutor): opcional. El valor predeterminado es **Silent (no announcer)**. Elige un personaje para que narre los tiros con su propia voz.
- **Match length** (Duración del partido): **Race to 1**, **Race to 3** o **Race to 5**. Es cuántos racks necesitas para ganar el partido. Un rack es una partida completa de billar.
- **Who breaks first** (Quién rompe primero): **You**, **Random** o **Them**. Una nota dice "Later racks alternate the break."

Haz clic en **Start game** para comenzar. El botón dice "Racking up..." mientras se prepara la mesa.

### Juega en el tablero de 8-Ball Pool

El tablero muestra una mesa de billar vista desde arriba con la posición real de cada bola. En tu turno, la línea de turno dice "Your turn". En el turno del personaje muestra su nombre con "is thinking...". Tiras eligiendo uno de los tiros sugeridos, y luego las bolas ruedan por la mesa usando una simulación de física. Una línea debajo de la mesa describe el último tiro, o dice "Rack over." entre racks.

## Tic-Tac-Toe

El tres en raya es uno contra uno. La configuración elige el oponente y si juegas con **X**, **O** o una marca aleatoria. La X mueve primero. Durante tu turno, haz clic en una casilla vacía. Marinara bloquea los movimientos ilegales, le pide al personaje su movimiento dentro de su papel, y detecta victorias y empates automáticamente.

## Rock-Paper-Scissors

Rock-Paper-Scissors es uno contra uno. La configuración elige el oponente y un partido al mejor de tres, al mejor de cinco o al mejor de siete. Elige **Rock**, **Paper** o **Scissors** en cada ronda. La elección de tu oponente se mantiene oculta hasta que ambas elecciones estén listas, y entonces Marinara revela el resultado y actualiza el marcador del partido.

## Terminar un juego

Cada tablero tiene un botón para terminar el juego antes de tiempo, marcado con un icono de X.

- En el tablero de UNO se llama **End game** y primero pregunta "End this game?".
- En el tablero de Chess se llama **Resign** y primero pregunta "Resign and end this game?".
- En el tablero de Poker se llama **End game** mientras hay una mano en juego y primero pregunta "End this poker game?". Una vez que toda la sesión ha terminado, cambia a **Close** y no necesita confirmación.
- En el tablero de 8-Ball Pool se llama **End game** y primero pregunta "End this pool game?". Una vez que el partido ha terminado, cambia a **Close** y no necesita confirmación.
- En Tic-Tac-Toe y Rock-Paper-Scissors, usa el control de cerrar o terminar del tablero para limpiar el partido actual.

Terminar un juego elimina su estado. No se registra ningún ganador cuando terminas un juego antes de tiempo de esta manera.

## Deja que los personajes empiecen juegos por su cuenta

Tú controlas si un personaje puede ofrecer o aceptar un juego en **Chat Settings → Agents** (Ajustes del chat → Agentes), en los controles de **Commands**. También puedes fijar esto durante el asistente de configuración del chat nuevo, en su paso **Automation** (Automatización).

El interruptor maestro **Commands** está activado de forma predeterminada. Controla todos los comandos ejecutados por personajes, incluidos los juegos de mesa, los selfies, las memorias y las llamadas. Desactivarlo impide que los personajes empiecen nada por su cuenta.

Bajo Commands, cada juego instalado tiene su propio interruptor, y los seis están activados de forma predeterminada:

- **UNO**: "Let characters start a game of UNO at the table when you agree to play."
- **Chess**: "Let characters accept a one-on-one chess challenge at the table."
- **Poker**: "Let characters sit down for a game of Texas Hold'em poker at the table."
- **8-Ball Pool**: "Let characters rack up a game of 8-ball pool at the table."
- **Tic-Tac-Toe**: "Let characters accept a one-on-one tic-tac-toe challenge at the table."
- **Rock-Paper-Scissors**: "Let characters accept a one-on-one rock-paper-scissors match at the table."

Estos interruptores solo controlan el camino ejecutado por personajes. El comando slash de un juego instalado y la frase de chat "let's play" siguen funcionando cuando su interruptor de personaje está desactivado.

## Guías relacionadas

- [Conversation Mode: Primeros pasos](getting-started.md)
- [Referencia de comandos slash](../chats/slash-commands.md)
