# Juegos de mesa de Conversation

Juega UNO, ajedrez, póker, billar 8-Ball, tres en raya y piedra, papel o tijera contra los personajes de un chat de Conversation. Marinara reparte las cartas o prepara el tablero, aplica todas las reglas y hace que cada personaje sentado narre sus jugadas con su personalidad. Mientras juegas aparece un tablero en vivo encima del cuadro de mensaje.

Cada juego es un paquete opcional. Instala los que quieras desde **Agents → Agent Organizer** (Organizador de agentes) y reinicia Marinara si el catálogo lo pide. Un juego que no has instalado no tiene comando con barra, no aparece en el selector de juegos y su interruptor de **Commands** permanece oculto.

Reglas que se aplican a todos los juegos:

- Los juegos de mesa funcionan solo en Conversation Mode (modo Conversación). En un chat de Roleplay ves un mensaje que dice que solo se puede jugar en chats de Conversation.
- Solo puede haber un juego activo por chat. Empezar un juego nuevo reemplaza al actual, incluso a uno terminado que aún muestra un banner final.
- El chat necesita al menos un personaje, y debes sentar al menos a uno como bot. Las jugadas de los bots usan el mismo modelo que las respuestas normales de tu chat. No hace falta ninguna cuenta ni API key (clave de API) extra.

## Empezar un juego

Antes de empezar: instala el juego y abre un chat de Conversation con al menos un personaje.

1. Escribe el comando con barra del juego (una instrucción corta que empieza con `/`) en el cuadro de mensaje y pulsa <kbd>Enter</kbd>. Se abre la ventana de configuración del juego.
2. Elige las opciones (consulta cada juego más abajo).
3. Haz clic en **Deal** o en **Start game**.

Si no funcionó: el comando no existe o no hace nada cuando el juego no está instalado o no estás en un chat de Conversation.

| Juego | Comando | Jugadores |
| --- | --- | --- |
| UNO | `/uno` | Tú más de 1 a 9 personajes |
| Chess | `/chess` | Tú y un personaje |
| Poker | `/poker` | Tú más de 1 a 7 personajes |
| 8-Ball Pool | `/8ball` o `/pool` | Tú y un personaje |
| Tic-Tac-Toe | `/tictactoe` o `/ttt` | Tú y un personaje |
| Rock-Paper-Scissors | `/rps` | Tú y un personaje |

Otras formas de empezar un juego:

- Escribe `/games` para elegir entre los juegos instalados.
- Dilo en un mensaje normal, como "let's play uno", "start a game of chess" o "deal me into poker". Se abre la ventana de configuración y tu mensaje se envía igualmente, para que un personaje pueda reaccionar a tu invitación. Esto ocurre solo cuando todavía no hay un juego en marcha.
- Un personaje puede ofrecer o aceptar un juego por su cuenta. Su respuesta empieza entonces el juego de inmediato con las reglas predeterminadas y sin ventana de configuración. Si está ocupado o lo rechaza, lo dice con su personalidad.
- Un personaje solo puede hacer esto cuando el interruptor **Commands** del juego está activado (consulta [Dejar que los personajes empiecen juegos por su cuenta](#let-characters-start-games-on-their-own)).

## UNO

La ventana de configuración se titula **Start UNO**.

- **Players**: marca qué personaje juega como bot. Todos están marcados de forma predeterminada. **You go first** está marcado de forma predeterminada.
- **Starting hand**: cartas por jugador, de 1 a 10. El valor predeterminado es **7**.
- **Penalize missed UNO**: marcado de forma predeterminada. Un jugador al que sorprenden sin declarar UNO roba 2 cartas, y **Catch!** está activo.
- **House rules**, todas desactivadas de forma predeterminada:
  - **Stacking**: acumula +2/+4 sobre el siguiente jugador en lugar de robar.
  - **Draw to match**: sigue robando hasta que tengas una carta jugable.
  - **7-0 rule**: un 7 intercambia manos con un jugador elegido; un 0 rota todas las manos.
  - **Jump-in**: juega una carta idéntica fuera de turno.
  - **Force play**: si una carta robada se puede jugar, debes jugarla.

**Deal** permanece desactivado hasta que elijas al menos un oponente. Muestra el número de jugadores, por ejemplo **Deal (3p)** para ti y dos personajes.

En el tablero:

- Las cartas jugables se levantan y el resto se oscurece. Haz clic en una carta para jugarla.
- Una carta comodín abre "Pick a color:". Con la **7-0 rule** activada, un 7 abre "Swap hands with:".
- Los botones aparecen según hacen falta: **Draw**, **Pass**, **Call UNO!** y **Catch!**.
- Jugar tu penúltima carta declara UNO por ti.
- Un banner dice "{winner} wins!" o "Game over".

## Chess

La ventana de configuración se titula **Start Chess**. Elige un **Opponent** (el primer personaje de forma predeterminada). En un chat grupal, los demás siguen conversando. **Your color** es **White**, **Random** (predeterminado) o **Black**. Haz clic en **Start game**.

Haz clic en una de tus piezas para seleccionarla. Las jugadas legales se muestran como un punto, y las capturas como un anillo. Jugar con negras da la vuelta al tablero. Un peón en la última fila abre "Promote to:" (Queen, Rook, Bishop, Knight). Un banner anuncia jaque mate, tablas con su motivo, o "Game over", y una franja debajo del tablero enumera las jugadas recientes.

## Poker

La ventana de configuración se titula **Start Poker**. La mesa tiene de 2 a 8 jugadores.

- **Players**: marca los personajes que quieres sentar. Con siete, el resto se atenúa.
- **Dealer**: **House dealer (silent)** (predeterminado) reparte sin comentarios. O elige un personaje que anuncie las manos y los showdowns.
- **Starting stack**: fichas por jugador, de 100 a 1.000.000. El valor predeterminado es **1000**.
- **Small blind**: la ciega grande es el doble. El valor predeterminado es **10**.
- **Blinds double every**: manos entre cada subida de ciegas. El valor predeterminado es **0**, que significa nunca.
- **Hand limit**: la sesión termina tras este número de manos, y gana quien tenga más fichas. El valor predeterminado es **0**, que juega hasta que un jugador se queda con todas las fichas.

En tu turno la barra muestra **Fold**, **Check**, **Call** y **All in**. Cuando puedes apostar o subir, un cuadro de apuesta añade los botones **Min**, **½ pot**, **Pot** y **All-in**. Después de cada mano, un panel **Showdown** otorga el bote, y **Next hand** reparte de nuevo. Al final de una partida, un banner nombra al ganador y enumera cada stack final.

## 8-Ball Pool

La ventana de configuración se titula **Start 8-Ball Pool**.

- **Opponent**: el personaje contra el que juegas.
- **Announcer**: **Silent (no announcer)** de forma predeterminada, o un personaje que narra los tiros.
- **Match length**: **Race to 1**, **Race to 3** o **Race to 5** racks (un rack es una partida completa).
- **Who breaks first**: **You**, **Random** o **Them**. Los racks siguientes alternan el saque.

Haz clic en **Start game**. En tu turno, elige uno de los tiros sugeridos y las bolas ruedan con una simulación de física. Una línea debajo de la mesa describe el último tiro.

## Tic-Tac-Toe y Rock-Paper-Scissors

En **Tic-Tac-Toe**, elige al oponente y si juegas con **X**, **O** o una marca aleatoria. X mueve primero. Haz clic en un cuadro vacío en tu turno. Las jugadas ilegales se bloquean, y se detectan las victorias y los empates.

En **Rock-Paper-Scissors**, elige al oponente y una partida al mejor de tres, cinco o siete. Elige **Rock**, **Paper** o **Scissors** en cada ronda. Las elecciones permanecen ocultas hasta que ambas están hechas, y entonces se actualizan el resultado y el marcador.

## Terminar un juego antes de tiempo

Cada tablero tiene un botón X.

- **UNO**: **End game**. Antes pregunta "End this UNO game?".
- **Chess**: **Resign**. Pregunta "Resign and end this game?" primero.
- **Poker**: **End game**. Pregunta "End this poker game?" primero. Después de que termina la sesión dice **Close**.
- **8-Ball Pool**: **End game**. Pregunta "End this pool game?" primero. Después de que termina la partida dice **Close**.
- **Tic-Tac-Toe** y **Rock-Paper-Scissors**: usa el botón de cerrar o de terminar del tablero para borrar la partida.

Terminar un juego antes de tiempo borra su estado y no registra ningún ganador.

<a id="let-characters-start-games-on-their-own"></a>

## Dejar que los personajes empiecen juegos por su cuenta

Abre **Chat Settings → Agents → Commands**, o usa el paso **Automation** cuando creas el chat. El interruptor general **Commands** controla todas las acciones que ejecutan los personajes, incluidos los juegos de mesa, las selfies y las llamadas. Con él desactivado, los personajes no empiezan nada por su cuenta.

Cada juego instalado tiene su propio interruptor, activado a menos que lo desactives: **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** y **Rock-Paper-Scissors**. Consulta [Elegir qué Commands puede usar un personaje](getting-started.md#choose-which-commands-a-character-can-use).

Estos interruptores controlan solo lo que hacen los personajes. El comando con barra de un juego y la frase "let's play" funcionan incluso con su interruptor desactivado.

## Guías relacionadas

- [Conversation Mode: primeros pasos](getting-started.md)
- [Referencia de comandos con barra](../chats/slash-commands.md)
