# Chats grupales y conversaciones grupales

Esta guía cubre los chats grupales en Marinara Engine, que son chats con dos o más personajes a la vez. Explica cómo crear un chat grupal y cómo agregar o quitar miembros. También muestra cómo controlar quién habla en el modo Conversation (modo de conversación) y en el modo Roleplay.

## Qué es un chat grupal

Un chat grupal es cualquier chat que tiene dos o más personajes. No hay un botón separado de "chat grupal". Un chat normal simplemente se convierte en chat grupal en cuanto agregas un segundo personaje.

Los chats grupales funcionan en dos modos: **Conversation** y **Roleplay**. Game Mode tiene su propio sistema de grupo aparte y no se cubre aquí.

La palabra "grupo" se usa para varias cosas distintas en Marinara. Un chat grupal significa muchos personajes en un mismo chat. Eso es distinto de las **Folders** (Carpetas), que son listas guardadas de personajes que puedes reutilizar. También es distinto de los **Chat Branches** (Ramas de chat), que son versiones alternativas del mismo chat. Esta guía trata solo sobre chats grupales.

## Crear un chat grupal

Un chat grupal se crea con el mismo asistente de New Chat que usas para cualquier chat. Solo eliges más de un personaje.

1. En la barra lateral, haz clic en el botón de nuevo chat del modo que quieras. El botón dice **New Conversation** o **New Roleplay**.
2. Ve al paso del asistente titulado **Persona & Characters**.
3. Usa la casilla **Search characters...** para encontrar un personaje y luego haz clic en su avatar o nombre para agregarlo.
4. Agrega un segundo personaje de la misma forma. Puedes agregar tantos como quieras.
5. Termina el asistente para abrir el chat.

En cuanto agregas un segundo personaje, la etiqueta sobre el selector se actualiza. En el modo Conversation dice **Group Chat** seguido del número de miembros. En el modo Roleplay dice **Characters** seguido del número.

No hay un límite fijo en la cantidad de personajes. En la práctica, más personajes significan un prompt (las instrucciones enviadas a la IA) más largo y un costo más alto por respuesta. Agrega solo los personajes que la escena necesite.

Si no renombras el chat, Marinara lo nombra según los personajes, unidos con comas. Un ejemplo es "Alice, Bob, Carol".

### Agregar muchos personajes a la vez con Folders

Si has creado una **Folder** de personajes, puedes agregar la Folder entera en un solo paso. Las Folders son listas guardadas de personajes que construyes en el panel **Characters**. Son la forma más rápida de armar un chat grupal que planeas reutilizar.

1. En el paso **Persona & Characters**, abre el menú desplegable **Add from Folder**.
2. Elige una Folder de la lista.
3. Haz clic en **Add** junto al menú desplegable.

Se agrega cada personaje de esa Folder que no esté ya en el chat. El control **Add from Folder** solo aparece si tienes al menos una Folder. Para aprender a crear y administrar Folders, consulta la guía de abajo sobre cómo organizar tu biblioteca de personajes.

También puedes hacer clic en la fila **Random** (etiquetada **Dice pick**) para agregar un personaje al azar que no esté ya en el chat.

## Administrar miembros después de crear el chat

Agregas, quitas y reordenas personajes desde el panel lateral **Chat Settings** (Ajustes del chat). Ábrelo con el icono de engranaje en el encabezado del chat. La tooltip (texto de ayuda) del engranaje dice **Chat Settings**.

Dentro del panel, busca la sección **Characters**. Muestra un número de miembros y el texto de ayuda "Characters in this chat. Each character has their own personality that the AI roleplays as." Cada fila de miembro tiene un avatar, el nombre del personaje, un tirador para arrastrar, un icono de ojo y un icono de papelera.

- Para agregar un personaje más, haz clic en **Add Character** y búscalo.
- Para agregar una Folder entera, haz clic en **Add from Folder** y elige una.
- Para quitar un personaje, haz clic en el icono de papelera. Su tooltip dice **Remove from chat**.
- Para reordenar personajes, arrastra un miembro hacia arriba o abajo con el tirador. Su tooltip dice **Drag to reorder**.

El orden de los miembros importa. En el orden de respuesta **Sequential** (explicado más abajo), los personajes responden en el orden en que aparecen aquí. Arrastra un miembro para cambiar cuándo habla.

La sección **Characters** no aparece en Game Mode. Game Mode administra su grupo en otro lugar.

### Desactivar un miembro sin quitarlo

A veces quieres que un personaje se quede fuera un rato pero siga en la lista. Usa el icono de ojo en su fila de miembro.

- Haz clic en el ojo para desactivar un personaje. La tooltip cambia a **Disable in chat** y el ojo muestra una barra diagonal.
- Haz clic de nuevo para traerlo de vuelta. La tooltip dice **Enable in chat**.

Un personaje desactivado se queda en la lista de miembros pero queda fuera de cada respuesta. Su tarjeta de personaje no se envía al modelo, y no se le puede elegir para hablar.

Hay una protección de seguridad. Si desactivas a todos los personajes del chat, Marinara los trata a todos como activos de nuevo. Esto evita una respuesta sin ningún personaje.

Este estado de activado y desactivado se guarda por chat. No cambia al personaje en ningún otro lugar de la app.

## Quién habla: modo Roleplay

En el modo Roleplay, un chat grupal obtiene una sección **Group Chat** en **Chat Settings**. Aparece solo cuando el chat tiene dos o más personajes. Úsala para controlar cómo responden los personajes.

### Merged (Narrator) o Individual

El ajuste **Mode** es un interruptor de dos botones.

- **Merged (Narrator)** es el predeterminado. Una respuesta da voz a todos los personajes, más cualquier narración, todo a la vez.
- **Individual** hace que cada personaje genere su propia respuesta por separado.

### Color Dialogues (solo en Merged)

Cuando **Mode** es **Merged (Narrator)**, puedes activar **Color Dialogues**. Está desactivado de forma predeterminada. Cuando está activado, las líneas de cada personaje se muestran en los colores propios de ese personaje. Esos colores vienen de la pestaña **Colors** del Character Editor. Esa pestaña define el color del nombre, el color del diálogo y el color de la caja. Consulta la guía de edición de personajes para saber cómo definirlos.

### Response Order (solo en Individual)

Cuando **Mode** es **Individual**, aparece un ajuste **Response Order**. Es un interruptor de tres botones.

- **Sequential** es el predeterminado. Cada personaje responde por turno, en el orden en que aparece en la lista **Characters**. Reordena los miembros para cambiar el orden de los turnos.
- **Smart** usa una breve llamada oculta a la IA para decidir qué personaje o personajes deben responder a continuación. Lee los mensajes recientes y los detalles de cada personaje, y normalmente elige un hablante. Si escribes una mención con arroba como `@Alice` en tu mensaje, eso anula su elección.
- **Manual** detiene cualquier respuesta automática. Eliges exactamente quién responde usando el selector **Trigger Response** en la barra de mensajes.

Con el orden **Smart**, la IA puede poner en cola a más de un personaje. Solo el primero responde de inmediato. Para elegir quién habla a continuación, usa el selector **Trigger Response** en la barra de mensajes. También puedes enviar un mensaje vacío para generar el siguiente personaje en cola.

Aparecen dos interruptores más en el modo **Individual**:

- **Add Turn To Prompt** está activado de forma predeterminada. Agrega una breve instrucción que nombra qué personaje debe responder en este turno.
- **Name Prefix History** está desactivado de forma predeterminada. Cambia cómo se etiquetan los mensajes anteriores con los nombres de los hablantes antes de enviarlos al modelo. Déjalo desactivado a menos que un personaje siga confundiendo quién dijo qué.

### Scenario Override

La casilla **Scenario Override** te permite dar a todo el grupo un mismo escenario compartido. Escribe cualquier texto en ella y ese texto reemplaza el escenario propio de cada personaje en el prompt. Déjala vacía y cada personaje conserva su propio escenario como de costumbre.

No hay un interruptor de activado y desactivado. Escribir texto lo activa. Borrar el texto lo desactiva. Para editar en una ventana más grande, haz clic en el icono de expandir (tooltip **Expand editor**). El editor más grande se titula **Group Scenario Override**.

Una nota sobre la reutilización: el texto de **Scenario Override** está ligado a este único chat. Queda fuera de los perfiles de ajustes, así que no seguirá a un perfil hacia un chat nuevo.

### Ajustes y valores predeterminados (Roleplay)

| Ajuste | Dónde | Predeterminado |
|---|---|---|
| **Mode** (**Merged (Narrator)** / **Individual**) | Sección Group Chat | Merged (Narrator) |
| **Color Dialogues** | Sección Group Chat, modo Merged | Off |
| **Response Order** (Sequential / Smart / Manual) | Sección Group Chat, modo Individual | Sequential |
| **Add Turn To Prompt** | Sección Group Chat, modo Individual | On |
| **Name Prefix History** | Sección Group Chat, modo Individual | Off |
| **Scenario Override** | Sección Group Chat | Vacío (off) |

La mayoría de estos ajustes se guardan en perfiles de ajustes, así que puedes reutilizarlos. La única excepción es **Scenario Override**, que se queda con el chat individual.

## Quién habla: modo Conversation

El modo Conversation admite los mismos chats grupales, pero no muestra la sección **Group Chat**. Sus controles viven en la sección **Autonomous Messaging** de **Chat Settings**.

De forma predeterminada, una conversación grupal actúa como el modo Merged. Una respuesta puede dar voz a varios personajes a la vez, y sus líneas se colorean por hablante automáticamente. No hay un interruptor de color separado que definir en el modo Conversation.

### Reply When Mentioned

Activa **Reply When Mentioned** para cambiar el chat a un personaje a la vez. Cuando está activado, los personajes solo responden cuando los nombras o los activas a mano. La descripción del interruptor dice "Characters wait for direct mentions or manual response triggers."

Nombras a un personaje con una mención con arroba. Escribe `@` seguido del nombre del personaje en la casilla de mensaje, y aparece una lista de autocompletado. Los personajes que mencionas son los que responden.

Para elegir un hablante sin escribir una mención, usa el selector **Trigger Response**.

- En computadora, es un botón junto a Send.
- En el teléfono, está bajo el encabezado **Trigger Response** en la bandeja de herramientas que abres desde la barra de mensajes.

La tooltip del botón dice "Trigger character response".

### Character Exchanges

Activa **Character Exchanges** para dejar que los personajes hablen entre sí por su cuenta. Está desactivado de forma predeterminada. La descripción dice "Characters chat with each other in group chats."

Cuando está activado, los personajes pueden responderse entre sí mientras estás ausente, no solo a ti. Esto se ejecuta solo mientras Marinara está abierto en tu navegador. Si cierras la app, los intercambios se detienen. También comparte el mismo límite diario de mensajes que usan los mensajes autónomos.

## Manejo de turnos de un vistazo

| Modo y ajuste | Qué pasa | Cómo lo diriges |
|---|---|---|
| Roleplay, Merged | Una respuesta da voz a todos los personajes | Siempre todos los personajes juntos |
| Roleplay, Individual, Sequential | Cada personaje responde en el orden de los miembros | Arrastra para reordenar los miembros |
| Roleplay, Individual, Smart | La IA elige al siguiente hablante o hablantes | La mención `@Name` anula la elección |
| Roleplay, Individual, Manual | Nadie responde por su cuenta | Usa el selector **Trigger Response** |
| Conversation, predeterminado | Una respuesta puede dar voz a varios personajes | La mención `@Name` apunta a un personaje |
| Conversation, Reply When Mentioned activado | Nadie responde sin una mención o disparador | Mención `@Name` o selector **Trigger Response** |
| Conversation, Character Exchanges activado | Los personajes también pueden enviarse mensajes entre sí | Desactívalo para detenerlo |

## Guías relacionadas

- [Organizar tu biblioteca de personajes](../characters/library-organization.md)
- [Modo Conversation: primeros pasos](../conversation/getting-started.md)
- [Modo Roleplay: primeros pasos](../roleplay/getting-started.md)
