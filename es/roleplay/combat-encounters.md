# Encuentros de combate (Roleplay)

Esta guía explica los encuentros de combate en Roleplay Mode. Aprenderás a activar el agente **Combat**, iniciar una pelea y jugarla en la ventana del encuentro. También explica en qué se diferencia esta función del combate de Game Mode.

Los encuentros de combate son una función opcional de Roleplay. Le dan a tu escena una pantalla de batalla estructurada y por turnos, con barras de salud, listas de enemigos y del grupo, y un registro de combate. Si nunca activas la función, tus chats de roleplay funcionan exactamente igual que antes.

## Activar el agente Combat

Un agente es un ayudante que se ejecuta automáticamente durante la generación de mensajes. El agente **Combat** añade la función de batalla a un chat de roleplay. Está desactivado de forma predeterminada, así que debes activarlo en cada chat.

1. Abre el chat al que quieres añadir combate.
2. Abre **Chat Settings** (Ajustes del chat) con su botón en el chat. Está arriba a la derecha, salvo que lo hayas movido.
3. Abre la sección **Agents**.
4. Activa **Enable Agents** si no está ya activado.
5. Añade el agente **Combat** al chat.

Ahora deberías ver un botón **Encounter** (un icono de espadas cruzadas) en la fila de acciones sobre la caja de mensajes. Su tooltip (texto de ayuda) dice **Start Combat Encounter**. Si no ves este botón, el agente **Combat** no está activo para este chat.

Para un recorrido completo del panel de Agents y de cómo funcionan los agentes, consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).

## Iniciar un encuentro

Haz clic en el botón **Encounter** para abrir la caja de configuración. Esta caja se titula **Configure Combat Narrative**. Controla el estilo de escritura que usa la IA durante y después de la pelea.

La caja de configuración tiene dos grupos de estilo:

- **Combat Narration**: el estilo de escritura que se usa mientras ocurre la pelea.
- **Summary Narration**: el estilo de escritura que se usa para el resumen que se escribe en el chat cuando termina la pelea.

Cada grupo tiene los mismos cuatro controles:

- Tiempo verbal: **Present Tense** (presente) o **Past Tense** (pasado).
- Persona: **First Person** (primera persona), **Second Person** (segunda persona) o **Third Person** (tercera persona).
- Narración: **Omniscient** (el narrador lo sabe todo) o **Limited** (el narrador solo sabe lo que sabe un personaje).
- Una caja de texto de punto de vista: escribe a través de los ojos de quién se cuenta la escena. Deja la caja en blanco para mantener una voz de narrador neutral.

Debajo de los grupos de estilo hay un menú desplegable opcional **Spellbook**. Un spellbook es un lorebook (libro de trasfondo, un conjunto guardado de entradas de información del mundo) especial que lista los hechizos y habilidades disponibles en la pelea. Adjunta uno para que la IA sepa qué pueden lanzar tus personajes. Déjalo en **None** si no usas spellbooks.

Cuando estés listo, haz clic en **Begin Combat**. Haz clic en **Cancel** para cerrar la configuración sin iniciar una pelea.

Después de hacer clic en **Begin Combat**, la app muestra "Initializing combat encounter..." mientras la IA construye la pelea. Crea los enemigos, tu grupo, sus ataques y sus objetos. Esto puede tardar unos segundos.

## Jugar el encuentro (la ventana del encuentro)

La pantalla de batalla completa (la ventana del encuentro) se titula **Combat Encounter**. Tiene estas partes:

- **Enemies**: una cuadrícula de tarjetas de enemigo. Cada tarjeta muestra una barra de salud y cualquier efecto de estado.
- **Party**: tu bando de la pelea. Tu propio personaje está marcado con **(You)**.
- **Combat Log**: un registro continuo de lo que ocurre en cada turno.
- **Your Actions**: los botones que usas en tu turno.

En **Your Actions** puedes:

- Elegir uno de tus **Attacks**.
- Usar uno de tus **Items**.
- Escribir una acción libre en la caja **Custom Action** y enviarla. Úsala para cualquier cosa que los botones no cubran, por ejemplo "I kick sand into the guard's eyes".

Cuando un ataque u objeto necesita un objetivo, se abre una caja **Select Target**. Elige un solo enemigo o aliado, o elige **All Enemies** para un ataque de área que golpea a todos los enemigos a la vez. Algunas acciones son solo de área y se saltan la elección de un objetivo único.

Mientras la IA resuelve un turno, la pantalla muestra "Processing action..." y tus botones quedan bloqueados. Se desbloquean cuando el turno termina.

Si la IA devuelve datos que la app no puede leer, aparece una pantalla **Combat Error** en lugar de una app rota. Haz clic en **Close Encounter** en esa pantalla para salir de la pelea de forma segura.

## Terminar un encuentro

Hay dos maneras de terminar una pelea antes de tiempo, además del final natural cuando un bando gana.

- Haz clic en **Conclude** en la barra superior para terminar la pelea antes de tiempo. Primero aparece una caja de confirmación. Luego la app escribe un resumen del combate en el chat.
- Haz clic en el botón **X** en la barra superior para cerrar y descartar la pelea. Primero pregunta una caja de confirmación titulada **End Combat**. Esto no escribe un resumen.

Cuando una pelea termina de forma natural, aparece un banner de resultado: **VICTORY**, **DEFEAT**, **FLED** o **INTERRUPTED**. Luego la app escribe un mensaje de resumen del combate en tu chat, usando el estilo **Summary Narration** que elegiste. Cuando el resumen esté listo, haz clic en **Close Combat Window** para volver a tu escena.

Si el resumen no se genera, el botón dice **Close Anyway** en su lugar. Haz clic en él para volver a tu escena sin resumen.

## En qué se diferencia del combate de Game Mode

Los encuentros de combate son una capa de combate más ligera y separada para Roleplay Mode. Game Mode tiene su propio sistema de combate integrado.

Las diferencias clave:

- Tú mismo inicias un encuentro de roleplay con el botón **Encounter**. En Game Mode, el Game Master (director del juego) de IA inicia el combate cuando la historia lo requiere.
- El combate de roleplay necesita el agente **Combat** activado. El combate de Game Mode no usa el agente **Combat** y funciona sin él.
- Los dos sistemas usan pantallas de batalla diferentes y no se comparten.

Para el sistema de batalla de Game Mode, consulta [Combate de Game Mode](../game/combat.md).

## Guías relacionadas

- [Roleplay Mode: primeros pasos](getting-started.md)
- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Combate de Game Mode](../game/combat.md)
