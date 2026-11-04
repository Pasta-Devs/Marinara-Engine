# Chats grupales y conversaciones grupales

Un chat grupal es cualquier chat de Conversation o Roleplay con dos o más personajes. Esta guía muestra cómo crear uno, administrar sus miembros y elegir quién habla. Game Mode tiene su propio sistema de grupo y no se cubre aquí.

No hay un botón separado de "chat grupal". Un chat se convierte en chat grupal cuando agregas un segundo personaje. Un chat grupal no es una **Folder** (Carpeta: una lista guardada de personajes que puedes reutilizar) ni una **Chat Branch** (Rama de chat: una versión alternativa de un chat).

## Crear un chat grupal

1. En el panel **Chats**, haz clic en el botón **+** del modo que quieras (**New Conversation** o **New Roleplay**).
2. Se abre un asistente de configuración. En el paso **Persona & Characters** (Persona y personajes), escribe en **Search characters...** (Buscar personajes...) y haz clic en un personaje para agregarlo.
3. Agrega un segundo personaje de la misma forma.
4. Termina el asistente para abrir el chat.

La etiqueta sobre el selector cambia. En Conversation dice **Group Chat** y el número de miembros. En Roleplay dice **Characters** y el número. Si no renombras el chat, Marinara lo nombra según los personajes, por ejemplo "Alice, Bob, Carol".

No hay un límite fijo de personajes. Más personajes significan un prompt (las instrucciones enviadas a la IA) más largo y un costo más alto por respuesta, así que agrega solo los personajes que la escena necesite.

Para agregar una Folder entera de una vez, abre **Add from Folder** (Añadir desde una carpeta) en el mismo paso, elige una Folder y haz clic en **Add** (Añadir). Los personajes que ya están en el chat se omiten. El control solo aparece si tienes al menos una Folder. Consulta [Organizar tu biblioteca de personajes](../characters/library-organization.md). La fila **Random** (etiquetada **Dice pick**) agrega un personaje al azar que no esté ya en el chat.

## Administrar miembros

Abre **Chat Settings** (Ajustes del chat) y busca la sección **Characters** (Personajes). No está en Game Mode. Cada fila de miembro tiene un avatar, un nombre, un tirador para arrastrar, un icono de ojo y un icono de papelera.

| Para hacer esto | Haz esto |
| --- | --- |
| Agregar un personaje | Haz clic en **Add Character** (Añadir personaje) y búscalo. |
| Agregar una Folder | Haz clic en **Add Character** y luego en **Add all** (Añadir todos) en la fila de la carpeta. |
| Cambiar varios a la vez | Haz clic en el nombre de un miembro. Se abre el mismo selector. |
| Quitar un personaje | Haz clic en el icono de papelera (**Remove from chat**, Quitar del chat). |
| Reordenar | Arrastra el tirador (**Drag to reorder**, Arrastrar para reordenar). En el orden **Sequential**, los personajes responden en este orden. |
| Desactivar un rato | Haz clic en el ojo (**Disable in chat**, Desactivar en el chat). Vuelve a hacer clic para activarlo (**Enable in chat**, Activar en el chat). |

Un personaje desactivado se queda en la lista, pero queda fuera de cada respuesta. Su tarjeta no se envía al modelo y no se le puede elegir para hablar. Si desactivas a todos los personajes, Marinara los trata a todos como activos para que una respuesta nunca quede vacía. Esto se guarda por chat y no cambia nada en otros lugares. En un grupo de Roleplay en modo Merged, [Automatizar personajes activos](#automate-active-characters-merged-only) puede establecerlo por ti.

<a id="choose-who-speaks"></a>

## Elegir quién habla

Abre **Chat Settings → Group Chat** (Ajustes del chat → Chat grupal). La sección solo aparece cuando el chat tiene dos o más personajes. Ambos modos usan el mismo interruptor **Mode** (Modo).

- Una respuesta da voz a todos los personajes. Es **Merged (Narrator)** (Fusionado: narrador) en Roleplay y **Grouped** (Agrupado) en Conversation. Es el valor predeterminado. En Roleplay, el narrador es una voz que describe la escena y forma parte de la misma respuesta.
- **Individual** da a cada personaje su propia respuesta.

En Conversation, cambiar a **Individual** muestra una advertencia, **Individual replies can use many tokens** (Las respuestas individuales pueden usar muchos tokens). Cada personaje que responde usa una solicitud aparte al modelo, y los grupos grandes con Autonomous Messaging gastan tokens (fragmentos de texto) rápidamente.

### Automate active characters (Roleplay, solo en Merged)

Este ajuste activa y desactiva personajes por ti en un reparto grande. Consulta [Automatizar personajes activos](#automate-active-characters-merged-only) al final de esta guía.

### Color Dialogues (Roleplay, solo en Merged)

**Color Dialogues** (Colorear diálogos) está desactivado de forma predeterminada. Cuando está activado, las líneas de cada personaje usan los colores propios de ese personaje, de la pestaña **Colors** (Colores) del Character Editor. En un grupo de Conversation, las líneas se colorean por hablante automáticamente y no hay interruptor.

<a id="response-order-individual-only"></a>

### Response Order (solo en Individual)

Cuando **Mode** es **Individual**, aparece **Response Order** (Orden de respuesta). **Sequential** (Secuencial) es el valor predeterminado.

| Orden | Qué pasa |
| --- | --- |
| **Sequential** | Los personajes responden por turnos, en el orden de la lista **Characters**. En Conversation, se omite a los personajes que están desconectados. |
| **Smart** | Una breve llamada oculta al modelo elige quién responde a continuación, normalmente un personaje. Una mención `@Alice` en tu mensaje anula su elección. En Conversation usa la conversación, el estado del horario y la locuacidad. |
| **Manual** | Nadie responde por su cuenta. En Roleplay, usa el selector **Trigger Response** (Activar respuesta). En Conversation, menciona a uno o más personajes con `@mention` o usa el selector. |

Con el orden **Smart**, el modelo puede poner en cola a varios personajes. Solo el primero responde de inmediato. Usa el selector **Trigger Response**, o envía un mensaje vacío, para generar al siguiente personaje en cola.

Si elegiste un [modelo de decisión](../connections/decision-models.md), puedes activar debajo de él **Also use it to pick who speaks in Smart response order** (Usarlo también para elegir quién habla en el orden de respuesta Smart). El orden Smart pide entonces una puntuación de sí o no para cada candidato.

- Las preguntas comparten los últimos cinco mensajes y una lista con el nombre, el estado, la actividad, la locuacidad y un fragmento corto de la personalidad de cada candidato. Un servicio alojado también recibe esa lista. Consulta [Qué ve el modelo](../connections/decision-models.md#what-the-model-sees).
- La velocidad y el costo dependen del modelo y del número de candidatos.
- En Roleplay, Marinara elige al hablante más probable. En Conversation, responden todos los que tienen un motivo, primero los más probables. El personaje que acaba de hablar espera si otro tiene un motivo para responder.
- Si el modelo de decisión no da respuesta, el orden Smart hace su llamada habitual al modelo.

En el modo **Individual** de Roleplay con el orden **Smart** o **Manual**, la primera opción del selector es **Smart**, marcada con un icono de siluetas. Pide al modelo que elija al siguiente hablante solo para esa respuesta. Tu orden guardado no cambia.

### Activar una respuesta a mano

Usa el selector **Trigger Response** para elegir a un hablante. En una computadora es un botón junto a **Send** (Enviar), con la etiqueta **Trigger character response** (Activar la respuesta del personaje). En un teléfono está bajo **Trigger Response**, en la bandeja de herramientas que abres desde la barra de mensajes. Para nombrar a un hablante por escrito, escribe `@` y el nombre del personaje. Aparece una lista de autocompletado.

### Más ajustes de Individual

- **Add Turn To Prompt** (Añadir el turno al prompt) está activado de forma predeterminada. Agrega una breve instrucción que nombra qué personaje debe responder.
- **Name Prefix History** (solo en Roleplay) está desactivado de forma predeterminada. Cambia cómo se etiquetan los mensajes anteriores con los nombres de los hablantes. Déjalo desactivado a menos que un personaje siga confundiendo quién dijo qué.

### Scenario Override (Roleplay)

**Scenario Override** (Sustitución del escenario) da a todo el grupo un mismo escenario compartido. El texto del cuadro reemplaza el escenario propio de cada personaje en el prompt. Un cuadro vacío deja cada escenario como está. No hay interruptor. Para editar en una ventana más grande, haz clic en el icono de expandir (**Expand editor**, Ampliar editor; la ventana se titula **Group Scenario Override**). Este texto se queda con un solo chat y queda fuera de los perfiles de ajustes.

### Character Exchanges (Conversation)

Activa **Character Exchanges** (Intercambios entre personajes) en **Chat Settings → Autonomous Messaging** (Ajustes del chat → Mensajes autónomos) para que los personajes hablen entre sí mientras estás ausente. Está desactivado de forma predeterminada y solo aparece en un chat grupal. Solo se ejecuta mientras Marinara está abierto en tu navegador, y comparte el límite diario de mensajes de los mensajes autónomos. Funciona con o sin horarios de personajes. En un grupo **Individual**, los intercambios y las respuestas por `@mention` nunca usan el último mensaje de contacto del día del grupo.

## Ajustes y valores predeterminados

| Ajuste | Dónde | Predeterminado |
| --- | --- | --- |
| **Mode** | Sección Group Chat | **Merged (Narrator)** en Roleplay, **Grouped** en Conversation |
| **Color Dialogues** | Roleplay, Merged | Desactivado |
| **Automate active characters** | Roleplay, Merged | Desactivado |
| **Response Order** | Individual | Sequential |
| **Add Turn To Prompt** | Individual | Activado |
| **Name Prefix History** | Roleplay, Individual | Desactivado |
| **Scenario Override** | Roleplay | Vacío |
| **Character Exchanges** | Conversation, Autonomous Messaging | Desactivado |

Los perfiles de ajustes guardan estos ajustes, excepto **Scenario Override** y las fijaciones de la automatización. Consulta [Perfiles de ajustes](settings-profiles.md).

## Referencia

<a id="automate-active-characters-merged-only"></a>

### Automate active characters (solo en Merged)

En el modo Merged, la tarjeta de cada personaje activo está en el prompt en cada respuesta. En Roleplay, **Automate active characters** (Automatizar personajes activos) puede activar y desactivar tarjetas por ti, para que un reparto grande no llene el contexto. Tiene tres opciones y está en **Off** de forma predeterminada.

| Opción | Qué hace |
| --- | --- |
| **Off** | Tú eliges quién está activo con los interruptores del ojo. |
| **Decision model** | Antes de cada respuesta, tu [modelo de decisión](../connections/decision-models.md) responde una pregunta de sí o no por personaje: ¿está este personaje en la escena que continúa la respuesta, o entra en ella? Un personaje al que solo se menciona o se recuerda se queda desactivado. |
| **Character Tracker** | Los personajes presentes en la última respuesta según el [Character Tracker](../agents/built-in-agents.md#character-tracker) definen quién está activo. No necesita ninguna llamada extra al modelo, pero va un turno por detrás: un personaje que entra ahora se activa para la siguiente respuesta. |

Una indicación bajo el ajuste te dice cuándo falta algo: no hay un modelo de decisión elegido, el Character Tracker está desactivado en este chat, o el tracker se ejecuta manualmente, lo que cambia la lista solo después de que lo ejecutes.

- **Fijaciones.** Mientras la automatización está activada, cada fila de personaje muestra una chincheta a la izquierda de su ojo. Haz clic en ella para fijar al personaje tal como está ahora, activado o desactivado, y así la automatización lo deja en paz. Cambiar un ojo a mano también fija a ese personaje. Vuelve a hacer clic en una chincheta para soltarla. Poner la automatización en **Off** quita todas las fijaciones.
- **El narrador sigue activo.** El Narrator designado nunca se desactiva.
- **Sin respuesta, se conserva la lista.** En el modo **Decision model**, si el modelo no da respuesta, se usa la última escena del Character Tracker cuando la hay. Esto también cubre un modelo que piensa primero, salvo que **Also gate agents that run before the reply** (Evaluar también los agentes que se ejecutan antes de la respuesta) esté activado, y un reparto demasiado grande para la entrada del modelo de decisión. Si ninguno de los dos responde, la lista se queda como está.
- **Se ignora que nadie esté activo.** No se aplica un resultado que desactivaría a todos.
- **Un agente Character Activity tiene prioridad.** Un chat con un agente personalizado que use el tipo de resultado **Character Activity** mantiene a ese agente al mando.

El Character Tracker escribe su propio nombre para cada personaje. Marinara lo asocia con una tarjeta por el id de la tarjeta, luego por el nombre y luego por los alias de nombre de la pestaña **Colors**. Una lista del tracker que no nombra a ninguno de los personajes del chat conserva la lista actual. La automatización se ejecuta antes de cada respuesta, swipe (respuesta alternativa) y regeneración, y omite **Continue** (Continuar) e Impersonate. El ajuste se guarda en los perfiles de ajustes. Las fijaciones se quedan con ese único chat.
