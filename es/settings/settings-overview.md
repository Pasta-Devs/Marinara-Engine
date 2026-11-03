# Descripción general de la configuración

Encuentra qué parte de **Settings** (Configuración) contiene un control, configura la pestaña **General** y aprende cómo se sincronizan tus ajustes entre dispositivos.

## El panel de configuración y sus seis pestañas

Abre **Settings** con el icono de engranaje de la barra superior. En la parte de arriba del panel hay un cuadro **Search settings** (Buscar en la configuración). Escribe cualquier palabra (como `delete`, `streaming` o `quotes`) y Marinara te lleva a la sección que coincide. Encuentra un ajuste por su nombre en el idioma de tu interfaz o en inglés.

El panel tiene seis pestañas. Cada pestaña tiene sus propias secciones.

### Quiero…

| Quiero… | Ve a |
| --- | --- |
| Cambiar el idioma | **Settings → General → App Behavior → Language** |
| Hacer el texto más grande | **Settings → Appearance → App → Text & Scale** |
| Cambiar el tema o los colores | **Settings → Appearance → App → App Style** |
| Definir un sonido de notificación | **Settings → General → Notifications** |
| Dejar de pedir confirmación al borrar | **Settings → General → App Behavior** |
| Añadir respuestas rápidas | **Settings → General → Input & Editing** |
| Hacer una copia de seguridad | **Settings → Advanced → Backup & Export** |
| Borrar mis datos | **Settings → Advanced → Danger Zone** |
| Actualizar Marinara | **Settings → Advanced → Updates** |

### Qué contiene cada pestaña

**General** (esta guía)

- **App Behavior** (Comportamiento de la app, con una fila **Search and Professor Mari settings**)
- **Notifications**
- **Responses**
- **Input & Editing**
- **Text Rules** (Reglas de texto)
- **Game Playback**

**Appearance** tiene cuatro botones. Mira [Configuración de apariencia](../appearance/appearance-settings.md).

- **App**: **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds**
- **Conversation**: **Conversation Display**, **Conversation Theme**
- **Roleplay**: **Tracker Panel**, **Roleplay Presentation**
- **Game**: **Game Presentation**

**Generations** tiene **Overall Generations**, **Image Generation**, **Video Generation** y **Prompt Overrides**. Hasta que instales el agente Illustrator, esta pestaña solo muestra una invitación a descargarlo. Mira [Perfiles de estilo](../media/style-profiles.md) y [Video de escena](../media/scene-video.md).

**Addons** tiene el historial de revisiones de extensiones, **Personal Extensions**, **External Extensions** (solo cuando las has desbloqueado) y **Theme Library**. Mira [Extensiones personales](../extending/personal-extensions.md) y [Temas CSS personalizados](../appearance/custom-css-themes.md).

**Imports** tiene **Profile & Marinara**, **SillyTavern Import** y **Game Assets**. Mira [Copia de seguridad y restauración](../data/backup-and-restore.md) e [Importar desde SillyTavern](../data/importing-from-sillytavern.md).

**Advanced** tiene estas secciones, en este orden. Mira [La pestaña Advanced](#the-advanced-tab).

- **Multiplayer WIP**
- **Access**
- **Admin Access**
- **Features**
- **Updates**
- **Support Diagnostics**
- **Request timeouts**
- **Parameters**
- **Message Tools**
- **Backup & Export**
- **Storage Optimization**
- **Danger Zone**

## La pestaña General

Cada sección de la pestaña **General** está en **Settings → General**.

| Sección | Qué controla |
| --- | --- |
| **App Behavior** | Idioma, seguridad al borrar, interruptores para mostrar y ocultar, y la fila **Search and Professor Mari settings**. Mira [App Behavior](#app-behavior). |
| **Notifications** | Sonidos de notificación, y notificaciones del navegador y de Android. Mira [Notifications](#notifications). |
| **Responses** | Streaming, recorte y **Messages per page**. Mira [Enviar y transmitir mensajes](../chats/sending-and-streaming.md). |
| **Input & Editing** | **Send on Enter**, **Quick replies**, atajos de swipe y de edición. Mira [Input and Editing](#input-and-editing). |
| **Text Rules** | Cómo se da formato al texto del chat. Mira [Text Rules](#text-rules). |
| **Game Playback** | Lectura y navegación del modo Game. Mira [Game Mode: primeros pasos](../game/getting-started.md). |

### App Behavior

| Ajuste | Qué hace |
| --- | --- |
| **Language** | Define el idioma de la interfaz. No cambia los prompts del modelo ni el contenido del chat. El texto que aún no se ha traducido se muestra en inglés. El árabe usa una disposición de derecha a izquierda. Valor predeterminado: inglés. |
| **Documentation Language** | Define el idioma de las guías integradas. Mira más abajo. Valor predeterminado: inglés. |
| **Confirm before deleting** | Pregunta antes de que Marinara borre de forma permanente un chat, un personaje u otro elemento. Valor predeterminado: activado. |
| **Hide chat Help button** (Ocultar el botón de ayuda del chat) | Oculta el botón **Help** (Ayuda) en los chats de Conversation, Roleplay y Game. Valor predeterminado: desactivado. |
| **Show Android status bar** (Mostrar la barra de estado de Android) | Mantiene visibles la hora, la batería y los iconos de notificación encima de Marinara. Solo funciona en la app de Android. Valor predeterminado: desactivado. |
| **Achievements** | Hace el seguimiento de los logros, y muestra los avisos de desbloqueo, el marcador de Home y el widget. Mira [Logros](../home/achievements.md). Valor predeterminado: activado. |
| **Disable seasonal ME themes** | Desactiva los temas de temporada de Marinara. Valor predeterminado: desactivado. |
| **Music Player** | Muestra el Music Player compacto. Necesita el agente **Music DJ** de **Agents → Agent Organizer** (Organizador de agentes), y permanece atenuado hasta que lo instales. Mira [Música](../media/music.md). Valor predeterminado: activado. |

**Search and Professor Mari settings** es una fila al final de **App Behavior**. Selecciona **Open** (Abrir) para ir a la página de ajustes de Search, las respuestas breves y Professor Mari. Mira [Professor Mari](../home/professor-mari.md).

Los idiomas de la interfaz son árabe, chino simplificado, inglés, francés, alemán, hindi, japonés, coreano, polaco, portugués de Brasil, ruso y español. Para mejorar una traducción o aportar otro idioma, mira [Localización de la interfaz](../development/localization.md).

Para **Documentation Language**, el inglés viene incluido. Elige otro idioma y haz clic en **Download & Replace** (Descargar y reemplazar). Marinara descarga ese paquete de idioma una sola vez y elimina el anterior, así que solo queda un idioma descargado. Las guías que aún no tienen traducción se abren en inglés con una pequeña insignia `EN`. La búsqueda de guías funciona en el idioma activo. Tu elección se conserva al actualizar, y el paquete se actualiza tras una actualización cuando sus traducciones cambiaron. Si las guías descargadas se pierden o se dañan, aparece el botón **Fix documentation** (Reparar documentación). Vuelve a descargar el paquete, o restablece las guías al inglés si no se puede llegar a la fuente de descarga.

### Notifications

Marinara reproduce un tono integrado para las notificaciones. Para usar tu propio sonido:

1. Abre **Settings → General → Notifications**.
2. Sube un **Custom sound** (Sonido personalizado): MP3, WAV, OGG, M4A, MP4 o WebM, de hasta 10 MB.

El sonido se reproduce en todos los dispositivos conectados a este servidor. Puedes escucharlo, reemplazarlo o quitarlo. Si no se puede leer el archivo, Marinara reproduce el tono integrado. El archivo forma parte de las copias de seguridad y de las exportaciones de perfil.

Las **Background Notifications** (Notificaciones en segundo plano) cubren los mensajes de Conversation que los personajes envían por su cuenta. Las **Generation Completion Notifications** (Notificaciones de generación completada) cubren las respuestas que inicias tú mismo en Conversation, Roleplay y Game Mode. Ambas funcionan mientras Marinara está abierto pero sin el foco. Nunca muestran el contenido de los mensajes.

### Input and Editing

Ajustes de **Settings → General → Input & Editing**:

| Ajuste | Qué hace |
| --- | --- |
| **Send on Enter** | Elige qué modos envían cuando pulsas Enter. |
| **Keep guidance after regenerating** | Deja tu dirección en el cuadro de mensaje después de una regeneración guiada. Activado de forma predeterminada. |
| **Add CYOA choices to the message box instead of sending them** (Añadir las opciones CYOA al cuadro de mensaje en lugar de enviarlas) | Pone en tu cuadro de mensaje la opción en la que haces clic, para que puedas editarla antes. |
| **Quick replies** (Respuestas rápidas) | Añade acciones de borrador junto al botón Send. Mira [Generación guiada e Impersonate](../chats/guided-and-impersonate.md). |
| **Speech-to-text microphone** | Muestra un botón de micrófono en las entradas del chat. |
| **Intuitive swipe navigation** | Te mueve entre swipes (varias respuestas guardadas en un mismo mensaje) con las teclas de flecha o con un swipe táctil. |
| **Reroll past the newest swipe** | Crea una respuesta nueva cuando haces swipe más allá de la más reciente. |
| **Up Arrow edits last message** | Pulsa la flecha arriba en una entrada vacía para editar el último mensaje. |
| **Double-click edits messages** | Haz doble clic en un mensaje de Roleplay para editarlo. |

La sección **Responses** tiene **Enable streaming**, **Streaming speed**, **Trim incomplete sentences from the response**, **Add a new line before /continue text** (Añadir una línea nueva antes del texto de /continue; activado de forma predeterminada) y **Messages per page**. Mira [Enviar y transmitir mensajes](../chats/sending-and-streaming.md). Para las acciones de mensaje, mira [Acciones de mensaje](../chats/messages.md).

### Text Rules

Estas reglas cambian cómo se trata el texto del chat en **Settings → General → Text Rules**. **Bold dialogue in quotes** (Diálogo en negrita entre comillas) y **Convert LaTeX symbols** (Convertir símbolos LaTeX) solo cambian cómo se ve el texto, así que tus mensajes guardados no cambian. **Quote style** (Estilo de comillas) reescribe las comillas del texto que escribes y guardas.

| Ajuste | Qué hace |
| --- | --- |
| **Bold dialogue in quotes** | Muestra en negrita el texto entre comillas. Activado de forma predeterminada. |
| **Convert LaTeX symbols** | Muestra los comandos matemáticos de LaTeX como símbolos. El código se deja intacto. Activado de forma predeterminada. |
| **Quote style** | **Straight** (Rectas) conserva las comillas simples (opción predeterminada). **Typographic** (Tipográficas) las reescribe como comillas y apóstrofos curvos. |
| **Load images from other websites in messages** | Controla las imágenes alojadas en otros sitios web. Desactivado de forma predeterminada. |

#### Bold dialogue in quotes

Con este ajuste activado, las palabras entre las comillas de `"I missed you," she said.` aparecen en negrita. Desactívalo para conservar el color del diálogo sin la negrita.

#### Convert LaTeX symbols

Algunos modelos escriben las matemáticas como comandos LaTeX. Con este ajuste activado, `\rightarrow`, `\neq`, `\times` y `\alpha` se muestran como `→`, `≠`, `×` y `α`.

#### Load images from other websites in messages

Con este ajuste desactivado, una imagen de otro sitio web en un mensaje, un saludo o la vista previa de una tarjeta muestra el nombre del sitio web y un botón **Load image** (Cargar imagen). Esto evita que un mensaje contacte con otros sitios por su cuenta. Selecciona **Load image** para mostrar esa imagen. Marinara recuerda tu elección en todos tus dispositivos. Activa el ajuste para mostrar todas las imágenes de inmediato. Las imágenes guardadas en Marinara, como las imágenes de la galería, los avatares y los sprites, siempre se muestran.

<a id="the-advanced-tab"></a>

## La pestaña Advanced

| Sección | Para saber más |
| --- | --- |
| **Admin Access** | [Acceso remoto](../REMOTE_ACCESS.md) |
| **Features** | [Interruptores de funciones](../configuration/features.md) |
| **Updates** | [Actualizar Marinara Engine](../UPGRADING.md) |
| **Message Tools** | [Message Tools](#message-tools) |
| **Backup & Export** | [Copia de seguridad y restauración](../data/backup-and-restore.md) |
| **Danger Zone** | [Borrar tus datos](../data/clearing-data.md) |

### Message Tools

Estos interruptores están en **Settings → Advanced → Message Tools**. Todos están desactivados de forma predeterminada, excepto **Show context usage** (Mostrar el uso del contexto) y **Show "older messages not sent" note** (Mostrar la nota "mensajes antiguos no enviados").

| Interruptor | Qué hace |
| --- | --- |
| **Show message timestamps** | Muestra la fecha y la hora en cada mensaje. |
| **Show characters in Persona pickers** (Mostrar personajes en los selectores de persona) | Muestra tus personajes en los selectores de persona, para que puedas jugar como uno de ellos. |
| **Show model name on messages** | Muestra qué modelo escribió cada respuesta. |
| **Show token usage on messages** | Muestra el conteo de tokens de prompt y de respuesta por mensaje. |
| **Show context usage** | Muestra cuánto se llenó la ventana de contexto en la última solicitud medida, en los selectores de conexión y en los ajustes del chat de Game. |
| **Show message numbers** | Muestra un número en cada mensaje. |
| **Show "older messages not sent" note** | Muestra una nota debajo de la respuesta más reciente cuando los mensajes antiguos no cupieron en el prompt. Una respuesta cortada o vacía sigue mostrando su propia nota. |
| **Guide swipes/regens with chat input** | Usa tu borrador como dirección cuando regeneras. |
| **Include reasoning in exports** | Añade el pensamiento oculto del modelo a las exportaciones del chat. |
| **Include private notes in exports** (Incluir las notas privadas en las exportaciones) | Añade tus notas privadas de los mensajes a las exportaciones en JSONL y en texto. Déjalo desactivado cuando compartas una transcripción. |
| **Debug mode** | Registra las cargas del modelo en la consola del servidor para soporte. |

Para más información, mira [Acciones de mensaje](../chats/messages.md), [Personas](../characters/personas.md), [Elegir un modelo para un chat](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat), [Peek Prompt](../chats/peek-prompt.md), [Generación guiada e Impersonate](../chats/guided-and-impersonate.md), [Exportar e importar chats](../chats/export-import.md) y [Solución de problemas](../TROUBLESHOOTING.md).

## Cómo se sincroniza la configuración entre dispositivos

Marinara guarda la mayor parte de tu configuración en el servidor, así que te sigue entre navegadores y dispositivos.

1. Cambias un ajuste en **Settings**.
2. Un segundo después, más o menos, Marinara lo guarda en el servidor.
3. Cuando otro navegador abre el mismo servidor, carga esos ajustes.

Gana el cambio más reciente. Si abres Marinara en un segundo dispositivo poco después de un cambio, su copia más antigua puede reemplazar tu cambio. Espera un momento antes de cambiar de dispositivo.

Dos ajustes nunca se sincronizan. Configúralos de nuevo en cada dispositivo, en **Settings → Appearance → Text & Scale**:

- **Display Size**, el tamaño del texto de la interfaz
- **Chat Font Size**, el tamaño del texto del chat

Mira [Configuración de apariencia](../appearance/appearance-settings.md). Si el servidor no está disponible, la app sigue funcionando con tu configuración local y lo reintenta la próxima vez que cambies algo.

## Guías relacionadas

- [Configuración de apariencia](../appearance/appearance-settings.md)
- [Acciones de mensaje](../chats/messages.md)
- [Dónde se guardan tus datos](../data/where-data-is-stored.md)
- [Solución de problemas](../TROUBLESHOOTING.md)
