# Modo Roleplay: primeros pasos

Roleplay es el modo de chat para historias. Añade un escenario detrás de tus mensajes (un fondo y sprites de personajes) y un HUD (heads-up display) con detalles de la historia. Un agente es un ayudante que se ejecuta junto a las respuestas, por ejemplo uno que hace seguimiento del clima o elige un sprite.

Elige Roleplay para una escena de historia. Elige [Conversation](../conversation/getting-started.md) para mensajería sencilla, o [Game Mode](../game/getting-started.md) para un juego estructurado con grupo de aventura, combate y dados. Roleplay funciona como chat solo de texto sin generación de imágenes: las ranuras de sprites quedan vacías, el fondo es un color sólido y el HUD sigue haciendo seguimiento de la historia.

## Iniciar un roleplay

Antes de empezar: añade una cuenta en el panel **Connections** (Conexiones), en el lado derecho de la app. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).

1. En la barra lateral de chats, haz clic en la pestaña **RP**.
2. Haz clic en el botón **+** cerca de la parte superior de la barra lateral. Su tooltip (texto de ayuda) dice **New Roleplay** (Nuevo roleplay).

El chat se abre con **Chat Settings** (Ajustes del chat) y un asistente de configuración de cinco pasos. Solo la cuenta es obligatoria. Puedes cambiar todo más tarde.

1. **Name & Connection** (Nombre y conexión). Ponle nombre al roleplay (opcional) y elige qué conexión responde.
2. **Pick a Preset** (Elegir un preset). Un preset (ajuste guardado) fija la estructura del prompt (las instrucciones enviadas a la IA) y los valores de generación. El predeterminado funciona para la mayoría de los chats.
3. **Persona & Characters** (Persona y personajes). Elige la persona que interpretas y los personajes de la escena. En este paso, un botón llamado **Create your persona** (Crear tu persona) puede crearte una persona a partir de unas pocas preguntas. Consulta [Onboarding interactivo](../characters/interactive-onboarding.md).
4. **Attach Lorebooks** (Adjuntar lorebooks). Un lorebook (libro de trasfondo) es un conjunto de datos del mundo que la IA lee cuando aparecen sus palabras clave. Opcional.
5. **Enable Agents** (Activar agentes). Elige qué agentes se ejecutan en este chat. Puedes cambiarlo más tarde en **Chat Settings → Agents** (Ajustes del chat → Agentes).

Cuando termines, ves el chat con un cuadro de mensaje. Escribe tu primer mensaje y envíalo.

## El escenario: fondo, sprites y HUD

- **Background** (Fondo): una imagen de escena completa detrás de tus mensajes que hace una transición suave cuando cambia. El agente **Background** puede elegir uno en cada turno, o puedes fijar uno por chat. Consulta [Fondos de Roleplay](backgrounds.md).
- **Sprites**: las imágenes de los personajes en el escenario. Puede aparecer cualquier personaje con sprites activados. Un personaje necesita una biblioteca de sprites en su tarjeta, o su ranura queda vacía. Consulta [Sprites de personaje](../characters/sprites.md).
- **HUD**: tus trackers (fecha, hora, clima, ubicación, quién está presente, inventario, misiones, estadísticas). Actívalos en **Chat Settings → Agents**. Consulta [HUD y trackers de Roleplay](hud-and-trackers.md).

### Controles de visualización de sprites

Abre **Chat Settings** (el botón de controles deslizantes del chat), ve a **Agents** y busca la tarjeta **Expression Engine**. Es el agente que elige las expresiones de los sprites. Estos controles aparecen cuando al menos un personaje tiene sprites activados.

| Control | Qué hace |
| --- | --- |
| **Sprite Source** (Fuente de los sprites) | Elige **Expressions**, **Full-body** o ambos. Uno debe quedar activado. |
| **Expression Size**, **Full-body Size** | Fijan el tamaño de cada tipo de sprite. |
| **Expression Opacity**, **Full-body Opacity** | Fijan la transparencia de cada tipo. |
| **Default Side** (Lado predeterminado) | **Left** o **Right**: el lado en el que empiezan los sprites nuevos. |
| **Expression Avatars** (Avatares de expresión) | Cuando está activado, los avatares de los mensajes usan el sprite de expresión actual del personaje. |

Los cuatro controles deslizantes de tamaño y opacidad se guardan solo en este navegador. No se sincronizan con otros dispositivos.

Para mover los sprites a mano:

1. Haz clic en **Arrange** (Organizar), el botón de la escena. Se convierte en **Done** (Listo).
2. Arrastra un sprite y luego haz clic en la pequeña marca de verificación sobre él para confirmar.
3. Haz clic en **Done** para terminar. **Reset** (Restablecer) borra todas las colocaciones personalizadas.

Para fijar una expresión escribiendo, envía `/emote happy` para la escena, o `/emote "Aria" angry` para un personaje. Envía `/emote` solo para ver la lista de expresiones de cada personaje.

Si no funcionó: los sprites necesitan una biblioteca de sprites subida en el personaje. Sin ella, el agente de expresiones se ejecuta pero no tiene nada que mostrar.

## Las herramientas del chat

Las herramientas del chat (búsqueda, ramas, resumen, contexto activo, Agent activity, Author's Notes, Gallery) son secciones de **Chat Settings**. Ábrelo con el botón de controles deslizantes del chat. Consulta [Chat Settings](../chats/chat-settings.md) para saber qué hace cada una, y [Sacar una sección a su propia ventana](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Author's Notes

**Author's Notes** (Notas del autor) es una nota que la IA lee en cada respuesta. Úsala para un recordatorio permanente, como una regla de tono o un dato oculto.

1. Abre **Chat Settings** y despliega **Author's Notes**, debajo de **Agents**.
2. Escribe tu nota, por ejemplo: "Mantén el tono oscuro y lleno de suspenso."
3. Deja **Injection Depth** (Profundidad de inyección) como está si tienes dudas. Fija dónde se coloca la nota en el chat: 0 es después del mensaje más reciente, y 4 es cuatro mensajes antes del final.

Para una nota más larga, arrastra la esquina inferior del cuadro en una computadora. Author's Notes funciona igual en Game Mode y en el modo Conversation.

<a id="agent-activity"></a>

## Agent activity

**Agent activity** muestra qué hicieron los agentes del chat. Aparece cuando el chat usa agentes o Advanced Memory. La encuentras como sección propia justo debajo de **Agents** en **Chat Settings**, al final del Tracker Panel y, en una computadora, al final de la ventana Trackers.

- Pestaña **Activity**: las salidas que guardaron los agentes, llamadas globos de pensamiento. Descarta una o usa **Clear all** (Borrar todo). Las salidas de agentes personalizados también aparecen aquí.
- Mientras los agentes trabajan, su icono se convierte en un indicador de carga. Si un agente falla, aparece un punto en el icono hasta que lo abras.
- Los agentes fallidos aparecen en una lista con un botón para reintentar. También puedes detener agentes en ejecución, volver a ejecutar los trackers y usar **Clear Trackers**.
- Pestaña **Injections**: solo aparece cuando **Debug mode** (Modo de depuración) está activado (**Settings → Advanced**, Configuración → Avanzado). Lista los fragmentos de prompt que los agentes tipo escritor guardaron antes de la última respuesta. Estos agentes incluyen **Prose Guardian**, que reescribe las respuestas para que coincidan con tus reglas de estilo, y el **Narrative Director**, que dirige la trama. Puedes ver, editar y volver a ejecutar un fragmento. Una edición cambia solo lo que se usa cuando regeneras esa misma respuesta, así la regeneración sigue siendo repetible. No cambia la respuesta que está en pantalla.

Para todos los agentes, consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md). Para el agente que dirige la historia, consulta [Narrative Director y Secret Plot](narrative-director.md).

## Combate y escenas

- Roleplay tiene una capa de combate ligera. Añade el agente Combat y luego haz clic en **Encounter** (Encuentro) encima del cuadro de chat. Consulta [Encuentros de combate (Roleplay)](combat-encounters.md).
- Una escena es una rama lateral para un flashback o una ubicación secundaria. Consulta [Escenas: ramificar un roleplay](scenes.md).
- Para dirigir la trama, consulta [Narrative Director y Secret Plot](narrative-director.md).

## Elegir modelos

Tu conexión de chat escribe la prosa del personaje. Un modelo más potente mantiene estable la voz de un personaje en escenas largas. Tus conexiones de agentes ejecutan pequeñas tareas estructuradas, como leer el estado o elegir una expresión, y los modelos pequeños pueden equivocarse en ellas. Mucha gente ejecuta el chat en un modelo potente y los agentes en uno rápido y barato. Si los valores del HUD o los sprites siguen saliendo mal, mueve los agentes a un modelo más potente. Para los ajustes del muestreador, consulta [Parámetros de generación](../prompts/generation-parameters.md).

## Comandos

Estas son funciones opcionales. Los comandos son acciones que un personaje puede hacer por su cuenta, escritas dentro de su respuesta como un texto corto entre corchetes, como `[illustrate: ...]`. Marinara lee el texto entre corchetes, hace la acción y lo oculta del mensaje.

### Activar un comando

1. Abre **Chat Settings → Agents** y despliega **Commands** (Comandos).
2. Activa el interruptor **Commands** de la parte superior. Todos los comandos de dentro empiezan desactivados.
3. Activa los comandos que quieras. Un comando atenuado muestra lo que todavía necesita.

- **Illustrations** (Ilustraciones), **Video clips** (Clips de video): añade el agente Illustrator a este chat.
- **Combat** (Combate): añade el agente Combat a este chat.
- **Soundtrack** (Banda sonora): añade el agente Music DJ y activa los agentes.
- **Personal Notes** (Notas personales), **Reminders** (Recordatorios), **Whisper** (Susurro): usa un chat con un solo personaje, o un chat grupal con generación **Individual**.
- **Sound Cues** (Señales de sonido): elige una conexión de Music & Sound Effects con los efectos de sonido activados.
- **Documents** (Documentos), **HTML Artifacts** (Artefactos HTML), **Rolls** (Tiradas), **Direct Messages** (Mensajes directos), **Interruptions** (Interrupciones): no necesitan nada más.

**Rolls**, **Combat**, **Documents** y **Whisper** también preguntan quién puede usarlos: **All** (Todos) los personajes, o solo el **Narrator** (Narrador). El narrador es el personaje que eliges en **Narrator character** (Personaje narrador). Puede usar los comandos solo para el narrador y leer las notas, los recordatorios y los susurros de todos.

Si no funcionó: a un comando atenuado le falta su agente o su tipo de chat. Lee la línea que hay debajo de su interruptor.

### Ilustraciones

Antes de empezar: añade el agente Illustrator al chat y activa **Illustrations**.

Ahora un personaje puede pedir una imagen con `[illustrate: subject="..." characters="..."]`. La imagen usa los ajustes de Illustrator del chat y aparece debajo del mensaje.

Activa **Render in-line** (Mostrar en línea) para mostrar cada imagen dentro del mensaje, donde el personaje escribió el comando. Selecciona una imagen para ver su prompt, o usa la **X** para quitarla. El ajuste se aplica solo a las imágenes nuevas. Las imágenes que el agente Illustrator crea por su cuenta y el diseño de novela visual no cambian.

También puedes crear una ilustración tú con `/illustrate`. En Roleplay necesita el agente Illustrator.

<a id="artifacts-on-demand"></a>

### Artefactos bajo demanda

Activa **HTML Artifacts** para que el narrador pueda crear un objeto dentro del mundo, como una página de un libro de hechizos, un letrero, un boceto en una carta o la lectura de una terminal. El comando es `[html: prompt="..."]`. No necesita ningún agente. También puedes pedir uno tú con `/html <what you want>`.

El artefacto aparece donde el narrador colocó el comando, después de que termine la respuesta. En el diseño de novela visual solo ves un marcador. Una respuesta puede crear como máximo 3 artefactos, y cada uno es una solicitud aparte al modelo. La solicitud usa la conexión del agente **Immersive HTML** si tiene una; si no, tu conexión predeterminada de agentes, y si no, la conexión del chat. El ajuste **Parallel requests** (Solicitudes en paralelo) de esa conexión (en el editor de la cuenta) fija cuántas se ejecutan a la vez. Para una página sencilla con estilo, los tipos integrados de **Documents** son gratuitos e instantáneos.

El narrador no ve el HTML del artefacto. En los turnos posteriores ve una versión breve en texto plano: el texto legible del artefacto y una línea sobre su aspecto. Abre el marcador "used html command" debajo del mensaje para leer o editar ese texto, o para borrar el artefacto, lo que también lo quita de la memoria del narrador. Si una ejecución falla, el marcador indica el motivo.

<a id="whispers-and-secrets"></a>

### Susurros y secretos

Activa **Whisper** para apartes privados, secretos y visiones dentro de una respuesta. El comando es `[whisper: character="name" text="the secret"]`. Nombra exactamente un personaje del chat, o tu persona. Solo ese personaje y el narrador reciben el texto en sus prompts. Un nombre desconocido o ambiguo se ignora, así que el secreto no se filtra.

- **Reveal a secret** (Revelar un secreto) muestra un susurro en tu pantalla. Solo cambia lo que ves tú, no lo que saben los personajes. Los susurros dirigidos a tu persona son visibles de inmediato.
- **Edit whisper** (Editar susurro) te permite cambiar el texto y luego elegir **Save** (Guardar). Para quitar un susurro, borra su texto y elige **Save**. **Cancel** (Cancelar) lo deja como estaba.
- Puedes escribir un susurro en tu propio mensaje para susurrarle a un personaje. El mismo texto entre corchetes funciona cuando editas el mensaje de un personaje o del narrador. El texto puede ocupar varias líneas y conservar las comillas, como `text=""I love you.""`.
- Un mensaje que solo contiene un susurro queda oculto para los personajes a los que no llega.
- Si usas **Hide from AI** (Ocultar a la IA) en un mensaje para algunos personajes, el destinatario del susurro sigue recibiendo el susurro, pero nada del resto del mensaje.

Los agentes también pueden leer los susurros:

- Estos agentes los leen: Echo Chamber, los trackers, Lorebook Keeper y Long-Term Memory. En los chats grupales, el orden de respuesta **Smart** también los lee, así que un susurro puede hacer que ese personaje responda a continuación.
- Cada susurro se marca como privado e indica su destinatario. Lo que un agente escribe a partir de él, como una entrada de lorebook o una nota de un tracker, aun así puede llegar a otros personajes.
- En una sala multijugador alojada, los agentes y el orden de respuesta **Smart** no reciben susurros.
- Relationship Tracker y Memory Nag leen el chat por su cuenta y todavía no ven los susurros.

<a id="your-private-notes"></a>

### Tus notas privadas

Activa **Personal Notes** y luego escribe `[notes: content="your private note"]` en tu propio mensaje. Solo el narrador recibe estas notas, no los demás personajes ni los agentes compartidos. Usa los detalles de comandos del mensaje para editar o eliminar una. Si un personaje se desactiva o se elimina del grupo, el narrador deja de recibir las notas de ese personaje. Volver a activar el personaje las restaura.

También puedes guardar una nota en un solo mensaje:

1. Elige **Bookmark, pin or note** (Marcar, fijar o añadir una nota) debajo del mensaje.
2. Escribe una **Private note** (Nota privada). De forma predeterminada sigue siendo privada y no se envía al modelo.
3. Para compartirla con el modelo, activa **Show the note to the narrator character** (Mostrar la nota al personaje narrador) y elige un personaje. Solo ese personaje recibe la nota, junto a ese mensaje. Para compartirla necesitas un chat con un solo personaje o la generación grupal **Individual**.

**Remove note** (Eliminar nota) también deja de compartirla.

<a id="video-clips"></a>

### Clips de video

Antes de empezar: añade el agente Illustrator al chat y elige una conexión de video en **Scene Videos** (Videos de escena) de Illustrator.

Activa **Video clips** para que los personajes puedan pedir un clip corto de un momento clave con `[video: subject="the moment" motion="what moves and how the camera moves" characters="names"]`. Al modelo se le indica que lo prefiera a `[illustrate]` cuando el momento trata sobre movimiento. El clip empieza desde la imagen que fija **First frame** (Primer fotograma) de Illustrator (una imagen nueva de Illustrator, el avatar o el sprite del personaje, o ninguna). Se reproduce en la respuesta cuando está listo. Solo se ofrece un clip mientras **Video Run Interval** (Intervalo de generación de videos) lo permite, y cuenta para **Videos per reply** (Videos por respuesta).

### Interrupciones de personajes

Activa **Interruptions** para que un personaje pueda cortar el último mensaje cuando encaje una interrupción. El comando es `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara busca esa frase en el mensaje inmediatamente anterior a la respuesta, conserva el texto hasta esa frase y lo termina con una raya. El diálogo conserva su comilla de cierre. Si la frase no aparece o coincide dos veces, el mensaje queda como está.

Para recuperar el original, abre la información de comandos de la respuesta y elige **Restore original message** (Restaurar el mensaje original). Regenerar primero restaura el original completo, para que la nueva respuesta pueda elegir de nuevo. Elegir un swipe (respuesta alternativa) existente aplica la interrupción de ese swipe, salvo que la hayas restaurado. Se conservan tus ediciones manuales posteriores.

## Echo Chamber

**Echo Chamber** es un agente opcional que añade un público en vivo que reacciona a tu escena, como un chat de streaming que publica una nueva reacción según un temporizador. Actívalo en **Chat Settings → Agents**, en la tarjeta **Echo Chamber**.

- En una computadora, arrastra su barra de título para moverlo y un borde para cambiar su tamaño. Fíjalo para mantenerlo abierto. **X** lo cierra y lo reduce a un botón que puedes mover.
- En un teléfono, empieza como una ventana compacta sobre los mensajes. Arrastra su barra de título para moverlo, o un borde o una esquina para cambiar su tamaño. Fijarlo lo mantiene abierto cuando tocas en otro lugar, y bloquearlo evita movimientos accidentales.
- Sigue tu **Chat widget style** (Estilo de widgets del chat) de **Settings → Appearance → App** (Configuración → Apariencia → App). Cada chat recuerda su distribución.

## Opciones CYOA

CYOA significa Choose Your Own Adventure (Elige tu propia aventura). El agente CYOA Choices está desactivado de forma predeterminada y solo funciona en Roleplay. Cuando está activado, añade botones de opción en los que puedes hacer clic después de una respuesta, y al hacer clic en uno se envía como tu siguiente mensaje. Para combinar opciones o editar una antes, activa **Add CYOA choices to the message box instead of sending them** (Añadir las opciones CYOA al cuadro de mensaje en lugar de enviarlas) en **Settings → General → Input & Editing** (Configuración → General → Entrada y edición). Entonces, al hacer clic en una opción, su texto se añade a tu cuadro de mensaje.

## Solución de problemas

| Síntoma | Solución |
| --- | --- |
| Un valor del HUD es incorrecto. | Edítalo a mano y bloquéalo para que la siguiente ejecución no lo toque. Consulta [HUD y trackers de Roleplay](hud-and-trackers.md). Si los valores siguen desviándose, usa un modelo de agentes más potente. |
| Los sprites no cambian. | Comprueba que el personaje tiene una biblioteca de sprites. También puedes usar `/emote`. |
| El fondo nunca cambia. | El agente **Background** elige de tu biblioteca, así que añade más fondos. Consulta [Fondos de Roleplay](backgrounds.md). |
| Una respuesta regenerada mantiene la dirección incorrecta. | Activa **Debug mode**, abre **Agent activity → Injections** y luego edita o vuelve a ejecutar el fragmento guardado antes de regenerar. |

Para más ayuda, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Guías relacionadas

- [Fondos de Roleplay](backgrounds.md)
- [HUD y trackers de Roleplay](hud-and-trackers.md)
- [Encuentros de combate (Roleplay)](combat-encounters.md)
- [Narrative Director y Secret Plot](narrative-director.md)
- [Escenas: ramificar un roleplay](scenes.md)
- [Sprites de personaje](../characters/sprites.md)
- [Conectar una Conversation a un Roleplay o Game](../chats/connected-chats.md)
- [Macros](../prompts/macros.md)
