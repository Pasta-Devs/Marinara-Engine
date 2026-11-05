# Encuentros de combate (Roleplay)

Un encuentro de combate le da a una escena de Roleplay una pantalla de batalla por turnos, con barras de salud, listas de enemigos y del grupo, y un registro de combate. Es opcional. Un chat sin él funciona como antes. Game Mode tiene su propio combate aparte: consulta [Combate de Game Mode](../game/combat.md).

## Activar el combate

Un agente es un ayudante que se ejecuta junto con las respuestas. El agente **Combat** añade la función de batalla. Está desactivado de forma predeterminada, así que lo activas en cada chat.

1. Abre el chat. Abre **Chat Settings** (Ajustes del chat) con el botón de controles deslizantes del chat.
2. Ve a **Agents**.
3. Activa **Enable Agents** si está desactivado.
4. Añade el agente **Combat** desde las listas que hay debajo del interruptor.

Ahora aparece un botón **Encounter** (espadas cruzadas) sobre la caja de mensajes. Su tooltip (texto de ayuda) dice **Start Combat Encounter**.

Si no funcionó: sin el botón, el agente **Combat** no está activo en este chat. Para saber cómo funcionan los agentes, consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).

## Iniciar un encuentro

1. Haz clic en **Encounter**. Se abre la caja **Configure Combat Narrative**. Define el estilo de escritura que usa la IA.
2. Elige el estilo para **Combat Narration** (mientras ocurre la pelea) y para **Summary Narration** (el resumen que se escribe en el chat cuando termina). Los dos grupos tienen los mismos cuatro ajustes, que se listan abajo. Los valores predeterminados funcionan, así que puedes hacer clic en **Begin Combat** de inmediato.
3. Opcional: elige un **Spellbook**. Un spellbook es un lorebook (libro de trasfondo, un conjunto guardado de datos del mundo) que lista los hechizos y habilidades disponibles en la pelea. Déjalo en **None** si no usas ninguno.
4. Haz clic en **Begin Combat**. Haz clic en **Cancel** para cerrar la caja sin una pelea.

Ves "Initializing combat encounter..." mientras la IA construye los enemigos, tu grupo, y sus ataques y objetos. Esto puede tardar unos segundos.

| Control de estilo | Opciones |
| --- | --- |
| Tiempo verbal | **Present Tense** (presente), **Past Tense** (pasado) |
| Persona | **First Person** (primera persona), **Second Person** (segunda persona), **Third Person** (tercera persona) |
| Narración | **Omniscient** (omnisciente): lo sabe todo. **Limited** (limitado): sabe lo que sabe un personaje. |
| Punto de vista | Una caja de texto para indicar a través de los ojos de quién se cuenta la escena. Déjala en blanco para un narrador neutral. |

## Jugar tu turno

La pantalla **Combat Encounter** tiene cuatro partes:

- **Enemies**: tarjetas con una barra de salud y efectos de estado.
- **Party**: tu bando. Tu propio personaje está marcado con **(You)**.
- **Combat Log**: un registro de cada turno.
- **Your Actions**: tus botones.

En tu turno, elige un ataque en **Attacks**, usa un objeto en **Items** o escribe una acción libre en **Custom Action** y envíala, por ejemplo "I kick sand into the guard's eyes".

Cuando una acción necesita un objetivo, se abre **Select Target**. Elige un enemigo o un aliado, o **All Enemies** para un ataque de área. Las acciones que solo son de área se saltan este paso.

Mientras la IA resuelve el turno, ves "Processing action..." y tus botones quedan bloqueados. Se desbloquean cuando el turno termina.

Si no funcionó: si la IA devuelve datos que la app no puede leer, aparece una pantalla **Combat Error**. Haz clic en **Close Encounter** para salir de la pelea de forma segura y luego inicia una nueva.

## Terminar un encuentro

- **Conclude** en la barra superior termina la pelea antes de tiempo. Una caja pide confirmación y luego se escribe un resumen del combate en el chat.
- La **X** de la barra superior cierra y descarta la pelea, después de una caja de confirmación titulada **End Combat**. No se escribe ningún resumen.
- Cuando un bando gana, un banner muestra **VICTORY**, **DEFEAT**, **FLED** o **INTERRUPTED**. Se escribe un resumen en el chat con tu estilo de **Summary Narration**. Cuando esté listo, haz clic en **Close Combat Window**.

Si el resumen falla, el botón dice **Close Anyway**. Haz clic en él para volver a la escena sin resumen.

## En qué se diferencia del combate de Game Mode

- Un encuentro de Roleplay lo inicias tú con **Encounter**. En Game Mode, el Game Master (director del juego) inicia el combate cuando la historia lo requiere.
- El combate de Roleplay necesita el agente **Combat**. El combate de Game Mode no.
- Los dos sistemas usan pantallas de batalla diferentes.

## Guías relacionadas

- [Roleplay Mode: primeros pasos](getting-started.md)
- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Combate de Game Mode](../game/combat.md)
