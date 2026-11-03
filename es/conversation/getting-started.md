# Conversation Mode: primeros pasos

Conversation Mode (modo Conversación) es el modo de chat estilo mensajería: uno o más personajes, una barra de entrada y un historial con desplazamiento, como escribirle a un amigo. No tiene Game Master ni arte de escena. Los personajes también pueden escribirte primero, seguir horarios semanales, enviar selfies y jugar juegos de mesa, y estas funciones solo existen en este modo.

## Empezar un chat de Conversation

Antes de empezar: añade una cuenta en **Connections** (Conexiones) (consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)) y ten al menos un personaje. Una persona, la tarjeta de personaje que te representa, es opcional (consulta [Personas de usuario](../characters/personas.md)).

1. En la barra lateral de chats, abre la pestaña **CONVO** y haz clic en **New Conversation**. Se abre un asistente de configuración de cuatro páginas.
2. En la primera página, **Name & Connection**, dale nombre al chat y elige la cuenta que escribe las respuestas.
3. En la segunda página, **Prompt Preset**, elige el preset del prompt de Conversation, o mantén el predeterminado.
4. En la tercera página, **Persona & Characters**, elige tu persona y uno o más personajes.
5. En la última página, **Automation**, elige cuánto hacen los personajes por su cuenta (consulta la tabla de abajo).
6. Haz clic en **Start Chatting**.

Un personaje crea un chat privado. Dos o más crean un chat grupal; no hace falta ningún modo extra. Consulta [Chats grupales](../chats/group-chats.md) para saber cómo se turnan.

Si no funcionó: **Start Chatting** necesita una cuenta y al menos un personaje. Puedes cerrar el asistente y definir todo más tarde en **Chat Settings** (Ajustes del chat).

## Elegir las opciones de Automation

| Opción | Predeterminado | Qué hace |
| --- | --- | --- |
| **Autonomous Messages** | Activado | Los personajes te escriben primero cuando llevas un rato en silencio. |
| **Generate Schedules** | Desactivado | Crea una rutina semanal para cada personaje. Solo se muestra cuando **Autonomous Messages** está activado. |
| **Commands** | Desactivado | Interruptor general de las acciones que un personaje hace por su cuenta. |

Activa **Generate Schedules** y luego elige tu zona horaria en el campo que aparece. En **Chat Settings**, el mismo interruptor se llama **Schedules**. Los horarios y los límites de mensajes de contacto están en [Horarios de personajes y mensajes autónomos](schedules.md).

Cámbialas más tarde en **Chat Settings → Autonomous Messaging**. Si los personajes escriben demasiado, desactiva **Autonomous Messages** allí, o pon tu presencia en **Do Not Disturb**.

<a id="choose-which-commands-a-character-can-use"></a>

## Elegir qué Commands puede usar un personaje

Los Commands son acciones que el personaje decide hacer por sí mismo. Tú no los escribes. Tras la configuración, abre **Chat Settings → Agents → Commands**. El interruptor general **Commands** controla todas las familias: cuando está desactivado, ninguna familia funciona.

Cada familia tiene su propio interruptor. Todas empiezan activadas excepto **Videos**, que debes activar tú. Las familias que pertenecen a un agente opcional solo se muestran cuando instalas ese agente desde **Agents → Agent Organizer**.

| Familia | Qué puede hacer un personaje | Necesita un agente |
| --- | --- | --- |
| **Schedule Updates** | Cambiar su estado actual. | No |
| **Cross-Post** | Enviar un mensaje a otro chat. | No |
| **Memories** | Crear memorias para otros personajes. | No |
| **Scenes** | Iniciar una escena inmersiva. | No |
| **Influence** | Influir en un chat conectado. | No |
| **Notes** | Guardar notas duraderas para un chat conectado. | No |
| **Reactions** | Reaccionar a los mensajes con insignias de emoji. | No |
| **Selfies** | Pedir una selfie generada. | Illustrator |
| **Videos** | Enviar mensajes de video cortos. | Illustrator |
| **Music** | Reproducir canciones con el Music Player activo. | Music DJ |
| **Haptics** | Controlar dispositivos hápticos conectados. | Haptic Feedback |
| **Calls** | Llamarte para una llamada. | Calls |
| **UNO** | Iniciar o aceptar una partida de UNO. | UNO |
| **Chess** | Aceptar un desafío de ajedrez. | Chess |
| **Poker** | Sentarse a jugar Texas Hold'em. | Poker |
| **8-Ball Pool** | Armar una partida de billar. | 8-Ball Pool |
| **Tic-Tac-Toe** | Aceptar un desafío de tres en raya. | Tic-Tac-Toe |
| **Rock-Paper-Scissors** | Aceptar una partida. | Rock-Paper-Scissors |

Para **Influence** y **Notes**, consulta [Chats conectados](../chats/connected-chats.md). La última columna indica el agente que debes instalar desde **Agent Organizer**.

<a id="your-presence-status"></a>

## Tu estado de presencia

Tu presencia es una píldora de color en el pie de la barra lateral. Es la misma en todos los chats. Haz clic en ella para elegir:

| Estado | Significado |
| --- | --- |
| **Active** | Estás en línea. |
| **Idle** | Estás ausente. |
| **Do Not Disturb** | Detiene los mensajes autónomos. |
| **Invisible** | Oculta tu estado a los modelos. |

Si sigues en **Active** y no haces nada durante 10 minutos, Marinara pone **Idle** y vuelve a poner **Active** cuando regresas. Si eliges tú un estado, este cambio automático se detiene hasta que elijas **Active** de nuevo. **Idle** no detiene los mensajes de contacto.

Junto a la píldora está el cuadro de estado, que muestra "What's up?" cuando está vacío. Escribe allí tu actividad actual (hasta 120 caracteres) para que los personajes lo sepan. Las entradas recientes aparecen en **Recent status** para que puedas reutilizarlas.

<a id="react-and-get-notified"></a>

## Reaccionar y recibir avisos

Usa **Add reaction** en un mensaje para reaccionar con un emoji. Las respuestas posteriores pueden ver tu reacción. Con el comando **Reactions** activado, los personajes pueden reaccionar a tus mensajes y a los de los demás.

Cuando un personaje escribe en un chat que no estás viendo, aparece una burbuja con su avatar en el borde de la pantalla. Haz clic en ella para abrir ese chat, o en su X para descartarla. En un teléfono, varias burbujas se agrupan en una sola que puedes tocar.

## Conviene saber

Un chat de Conversation no usa el **First Message** (Primer mensaje) de la tarjeta de personaje ni su **Dialogue Highlight Color** (Color de resalte del diálogo) y **Message Box Color** (Color del cuadro de mensaje). El **Name Display Color** (Color del nombre) sigue coloreando el nombre encima de cada mensaje. Consulta [Dónde se muestran tus colores](../characters/colors-and-stats.md#where-your-colors-show).

## Funciones relacionadas

- [Selfies](selfies.md): los personajes envían fotos generadas de sí mismos.
- [Llamadas de audio y video de Conversation](calls.md)
- [Juegos de mesa](table-games.md): inicia una partida con `/uno`, `/chess`, `/poker`, `/8ball`, `/tictactoe` o `/rps`.
- [Horarios de personajes y mensajes autónomos](schedules.md)
- [Perfiles de Conversation Mode](profiles.md)
- [Emojis, stickers y GIF personalizados](emoji-stickers-gifs.md)
- [Chats conectados](../chats/connected-chats.md)

## Solución de problemas

| Síntoma | Solución |
| --- | --- |
| Los personajes escriben demasiado | Desactiva **Autonomous Messages**, pon **Do Not Disturb**, o marca más horas como ausente en los [horarios](schedules.md). |
| Un personaje responde todo en un grupo | Define quién habla en [Chats grupales](../chats/group-chats.md). |
| Un personaje olvida el chat anterior | Usa un modelo con una ventana de contexto más grande (cuánto texto lee a la vez), o añade datos clave a una entrada de lorebook. |
| Una selfie no se parece al personaje | Consulta [Selfies](selfies.md). |

Más ayuda: [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).
