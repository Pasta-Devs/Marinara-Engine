# Descripción general de la configuración

Esta guía te muestra el panel **Settings** (Configuración) de Marinara Engine: sus seis pestañas y lo que controla cada una. Cubre en profundidad la pestaña **General**, las **Text Rules** (Reglas de texto) que dan formato al texto de tu chat, y cómo se sincroniza la configuración entre tus dispositivos.

## El panel de configuración y sus seis pestañas

Abre **Settings** con el icono de engranaje de la barra superior. En la parte de arriba del panel hay un cuadro **Search settings** (Buscar en la configuración). Escribe cualquier palabra (como `delete`, `streaming` o `quotes`) y Marinara te lleva a la sección que coincide. Encuentra un ajuste por su nombre en el idioma de tu interfaz o en inglés.

El panel tiene seis pestañas. La tabla de abajo muestra lo que controla cada pestaña.

| Pestaña | Lo que configuras ahí |
| --- | --- |
| **General** | Comportamiento de la app, notificaciones, respuestas, entrada, reglas de texto y reproducción del juego. |
| **Appearance** | Tema, colores, fuentes, disposición del chat, movimiento y fondos. |
| **Generations** | Valores predeterminados de imagen y video, y plantillas de prompt reutilizables. |
| **Addons** | Borradores de Personal Extensions de Professor Mari en un entorno aislado, External Extensions desbloqueadas de forma opcional, y temas personalizados. |
| **Imports** | Restaura perfiles completos e importa desde otras apps. |
| **Advanced** | Acceso de administrador, interruptores de funciones opcionales, actualizaciones, herramientas de mensajes, copias de seguridad y reinicios destructivos. |

Aquí puedes leer más sobre cada pestaña:

- **General**: se cubre en esta página (mira las secciones de abajo).
- **Appearance**: mira [Configuración de apariencia](../appearance/appearance-settings.md).
- **Generations**: mira [Perfiles de estilo](../media/style-profiles.md) y [Video de escena](../media/scene-video.md).
- **Addons**: mira [Extensiones personales](../extending/personal-extensions.md) y [Temas CSS personalizados](../appearance/custom-css-themes.md).
- **Imports**: mira [Importar desde SillyTavern](../data/importing-from-sillytavern.md) y [Copia de seguridad y restauración](../data/backup-and-restore.md).
- **Advanced**: mira la sección **Message Tools** más abajo, [Interruptores de funciones](../configuration/features.md), además de [Actualizar Marinara Engine](../UPGRADING.md), [Acceso remoto](../REMOTE_ACCESS.md) y [Borrar tus datos](../data/clearing-data.md).

## Configuración, pestaña General

La pestaña **General** contiene seis secciones. Esta página cubre dos de ellas por completo: **App Behavior** (Comportamiento de la app) y **Text Rules**. Las demás se resumen aquí y se cubren en detalle en sus propias guías.

- **App Behavior**: idioma, seguridad al borrar, e interruptores para mostrar/ocultar. Se cubre más abajo.
- **Notifications**: sonidos de notificación más controles separados para el navegador y la app de Android. Sube un **Custom sound** (Sonido personalizado) en formato MP3, WAV, OGG, M4A/MP4 o WebM (hasta 10 MB) para reemplazar el tono integrado de Marinara en todos los dispositivos conectados a este servidor. Puedes escucharlo, reemplazarlo o quitarlo en cualquier momento; un archivo personalizado que no se pueda leer vuelve al tono integrado, y el archivo se incluye en las copias de seguridad y en las exportaciones de perfil. Las **Background Notifications** (Notificaciones en segundo plano) cubren los mensajes autónomos de Conversation, mientras que las **Generation Completion Notifications** (Notificaciones de generación completada) cubren las respuestas que inicias tú mismo en los modos Conversation, Roleplay y Game. Ambas funcionan mientras Marinara sigue abierto pero sin el foco, y el contenido de los mensajes permanece oculto.
- **Responses**: cómo las respuestas se transmiten en streaming, se guardan y se paginan. Mira [Enviar y transmitir mensajes](../chats/sending-and-streaming.md).
- **Input & Editing**: controles de entrada de mensajes y edición rápida. Mira [Acciones de mensaje](../chats/messages.md).
- **Text Rules**: formato que se aplica al texto del chat. Se cubre más abajo.
- **Game Playback**: lectura y navegación del modo Game.

## App Behavior

Esta sección está en **Settings** > **General** > **App Behavior**. Controla el comportamiento diario de la app y algunos interruptores para mostrar/ocultar.

- **Language**: elige el idioma de la interfaz de la app. Marinara incluye actualmente árabe, chino simplificado, inglés,
  francés, alemán, hindi, japonés, coreano, polaco, portugués de Brasil, ruso y español. El árabe usa una
  disposición de derecha a izquierda. El texto de la interfaz que aún no se ha traducido vuelve al inglés. Este ajuste cambia
  los controles y las indicaciones de Marinara, no los prompts del modelo ni el contenido del chat. Para mejorar una traducción o aportar otro
  idioma, mira [Localización de la interfaz](../development/localization.md).
- **Documentation Language**: elige el idioma de las guías integradas de Marinara, independiente del idioma de la interfaz de arriba. El inglés viene incluido y nunca se descarga. Al elegir un idioma distinto del inglés aparece **Download & Replace** (Descargar y reemplazar), que descarga ese paquete de idioma una sola vez y elimina el paquete anterior, así que solo queda un idioma descargado. Las guías que aún no tienen traducción se abren en inglés con una pequeña insignia `EN`, y la búsqueda de guías funciona en el idioma activo. Tu elección se conserva al actualizar y, tras una actualización, el paquete se actualiza automáticamente si sus traducciones cambiaron. Si las guías descargadas se pierden o se dañan, aparece el botón **Fix documentation** (Reparar documentación): vuelve a descargar el paquete y, si no se puede llegar a la fuente de descarga, restablece las guías al inglés.
- **Confirm before deleting**: activado de forma predeterminada. Cuando está activado, Marinara pregunta antes de borrar de forma permanente un chat, un personaje u otro elemento. Déjalo activado para evitar borrados accidentales.
- **Hide chat Help button** (Ocultar el botón de ayuda del chat): desactivado de forma predeterminada. Cuando está activado, el botón **Help** (Ayuda) desaparece de los chats de Conversation, Roleplay y Game.
- **Show Android status bar** (Mostrar la barra de estado de Android): desactivado de forma predeterminada, y solo funciona en la app de Android de Marinara Engine. Cuando está activado, la hora, el nivel de batería y los iconos de notificación siguen visibles encima de Marinara.
- **Achievements**: activado de forma predeterminada. Cuando está activado, la pantalla de inicio muestra el marcador **Achievements** y los avisos de desbloqueo. El widget opcional **Achievements** aparece si lo añadiste a la disposición de tu pantalla de inicio. Cuando está desactivado, el seguimiento se mantiene en silencio. Mira [Logros](../home/achievements.md).
- **Music Player**: activado de forma predeterminada. Cuando está activado, se muestra el Music Player compacto. Necesita el agente **Music DJ** de **Agents** > **Download Agents**, y el interruptor permanece atenuado hasta que lo instales. Mira [Música](../media/music.md).
- **Search and Professor Mari settings**: selecciona **Open** (Abrir) para ir a su página de ajustes. Todos los ajustes de Search y Professor Mari están ahí, en estos grupos:

  - **Search** (Búsqueda): ofrecer mejorar un campo e historial de búsqueda.
  - **Quick answers** (Respuestas breves): **Quick answers in Search**, **Answer with** y **Wait after typing**.
  - **Search window** (Ventana de Search) y **Professor Mari window** (Ventana de Professor Mari): cada ventana tiene los ajustes **Height** (Alto) y **Width** (Ancho). Estos grupos no se muestran en teléfonos.
  - **Professor Mari**: Ask Professor Mari from Search, modo de permisos, **Runtime** (Entorno de ejecución), chips de respuesta, cómo se abren las tarjetas de cambios y Enter sends to Professor Mari.
  - **Around the app** (En toda la app): Mini Professor Mari visits.
  - **Appearance**: su aspecto. Cada paquete muestra su retrato. El que está en uso dice **In use**. Un paquete bloqueado muestra cuánto tiempo de juego llevas para desbloquearlo.

  El engranaje de Search abre la misma página. Buscar cualquiera de estos ajustes, por su nombre nuevo o antiguo, te lleva directamente a él.

## Text Rules

Esta sección está en **Settings** > **General** > **Text Rules**. Estas reglas cambian cómo se trata el texto de tu chat. **Bold dialogue in quotes** (Diálogo en negrita entre comillas) y **Convert LaTeX symbols** (Convertir símbolos LaTeX) son solo de visualización, así que nunca cambian tus mensajes guardados. **Quote style** (Estilo de comillas) es diferente: reescribe las comillas reales del texto que escribes y guardas.

### Bold dialogue in quotes

Activado de forma predeterminada. Cuando está activado, el texto entre comillas se muestra en negrita. Toma esta línea:

```
"I missed you," she said.
```

Con **Bold dialogue in quotes** activado, las palabras `I missed you` aparecen en negrita. Desactívalo para conservar el color del diálogo sin la negrita.

### Convert LaTeX symbols

Activado de forma predeterminada. Algunos modelos escriben las matemáticas usando comandos LaTeX. Cuando está activado, los comandos comunes como `\rightarrow`, `\neq`, `\times` y `\alpha` se muestran como sus símbolos normales. Por ejemplo, `\times` se muestra como el signo de multiplicación `×`, y `\alpha` se muestra como la letra griega `α`. Los fragmentos de código se dejan intactos.

### Quote style

Elige cómo se unifican las comillas. A diferencia de las dos reglas de arriba, esto cambia el texto en sí: los mensajes que escribes y guardas se reescriben para usar el estilo que elijas. Hay dos opciones:

- **Straight** (Rectas): conserva las comillas simples de máquina de escribir, como `"Hello," it's me.` Esta es la opción predeterminada.
- **Typographic** (Tipográficas): reemplaza las comillas rectas con comillas y apóstrofos curvos.

### Load images from other websites in messages

Desactivado de forma predeterminada. Cuando está desactivado, una imagen de otro sitio web en un mensaje, un saludo o la vista previa de una tarjeta muestra en su lugar el nombre del sitio web y un botón **Load image** (Cargar imagen), para que un mensaje no pueda contactar con otros sitios por su cuenta. Selecciona **Load image** para mostrar esa imagen; Marinara lo recuerda en todos tus dispositivos. Activa el ajuste para mostrar todas las imágenes de inmediato. Las imágenes guardadas en Marinara, como las imágenes de la galería, los avatares y los sprites, siempre se muestran.

## Responses e Input & Editing

Estas dos secciones de **General** ajustan cómo llegan las respuestas y cómo escribes y editas. Aquí están los controles, con enlaces a las guías completas.

La sección **Responses** controla:

- **Enable streaming**: muestra el texto de la IA palabra por palabra a medida que se genera.
- **Streaming speed**: qué tan rápido aparece el texto transmitido en streaming.
- **Trim incomplete sentences from the response**: recorta una frase final sin terminar antes de guardar.
- **Add a new line before /continue text** (Añadir una línea nueva antes del texto de /continue): empieza el texto añadido por `/continue` después de una línea en blanco. Activado de forma predeterminada.
- **Messages per page**: cuántos mensajes se cargan a la vez.

Lee más en [Enviar y transmitir mensajes](../chats/sending-and-streaming.md).

La sección **Input & Editing** controla:

- **Send on Enter**: elige qué modos envían cuando pulsas Enter.
- **Keep guidance after regenerating**: deja tu dirección en el cuadro de mensaje después de una regeneración guiada. Activado de forma predeterminada.
- **Add CYOA choices to the message box instead of sending them** (Añadir las opciones CYOA al cuadro de mensaje en lugar de enviarlas): una opción CYOA en la que haces clic va a tu cuadro de mensaje, para que puedas editarla antes de enviarla.
- **Quick replies** (Respuestas rápidas): añade acciones de borrador alternativas junto al botón Send. Mira [Generación guiada e Impersonate](../chats/guided-and-impersonate.md).
- **Speech-to-text microphone**: muestra un botón de micrófono en las entradas del chat.
- **Intuitive swipe navigation**: usa las teclas de flecha o swipes táctiles para moverte entre respuestas alternativas.
- **Reroll past the newest swipe**: crea una respuesta nueva cuando haces swipe más allá de la más reciente.
- **Up Arrow edits last message**: pulsa la flecha arriba en una entrada vacía para editar el último mensaje.
- **Double-click edits messages**: haz doble clic en un mensaje de Roleplay para editarlo.

Lee más en [Acciones de mensaje](../chats/messages.md).

## Message Tools

La sección **Message Tools** (Herramientas de mensajes) está en **Settings** > **Advanced** > **Message Tools**. Es un centro de interruptores de visualización y reparación. Cada interruptor de abajo está desactivado de forma predeterminada, excepto **Show context usage** (Mostrar el uso del contexto) y **Show "older messages not sent" note** (Mostrar la nota "mensajes antiguos no enviados"), que están activados. La tabla muestra lo que hace cada uno y dónde leer más.

| Interruptor | Lo que hace | Guía completa |
| --- | --- | --- |
| **Show message timestamps** | Muestra la fecha y la hora en cada mensaje. | [Acciones de mensaje](../chats/messages.md) |
| **Show characters in Persona pickers** (Mostrar personajes en los selectores de persona) | Muestra tus personajes en los selectores de persona, para que puedas jugar como uno de ellos. | [Personas](../characters/personas.md) |
| **Show model name on messages** | Muestra qué modelo de IA escribió cada respuesta. | [Acciones de mensaje](../chats/messages.md) |
| **Show token usage on messages** | Muestra el conteo de tokens de prompt y de respuesta por mensaje. | [Acciones de mensaje](../chats/messages.md) |
| **Show context usage** | Muestra cuánto se llenó el contexto del modelo en la última solicitud medida, en los selectores de conexión y en los ajustes del chat de Game. | [Organizar conexiones](../connections/organizing-connections.md#the-random-pool-and-quick-connection-switcher) |
| **Show message numbers** | Muestra un número en cada mensaje del chat. | [Acciones de mensaje](../chats/messages.md) |
| **Show "older messages not sent" note** | Muestra una nota debajo de la respuesta más reciente cuando los mensajes antiguos no cupieron en el prompt. Desactívalo para ocultar esa nota en chats largos. Una respuesta cortada o vacía sigue mostrando su propia nota. | [Peek Prompt](../chats/peek-prompt.md) |
| **Guide swipes/regens with chat input** | Usa tu borrador actual como dirección cuando regeneras. | [Generación guiada e Impersonate](../chats/guided-and-impersonate.md) |
| **Include reasoning in exports** | Añade el pensamiento oculto a las exportaciones del chat. | [Exportar e importar chats](../chats/export-import.md) |
| **Include private notes in exports** (Incluir las notas privadas en las exportaciones) | Añade tus notas privadas de los mensajes a las exportaciones de chat en JSONL y en texto. Déjalo desactivado cuando compartas una transcripción. | [Exportar e importar chats](../chats/export-import.md) |
| **Debug mode** | Registra las cargas del modelo en la consola del servidor para soporte. | [Solución de problemas](../TROUBLESHOOTING.md) |

El resto de la pestaña **Advanced** se cubre en otros lugares. Mira [Actualizar Marinara Engine](../UPGRADING.md) para **Updates**, [Acceso remoto](../REMOTE_ACCESS.md) para **Admin Access**, [Copia de seguridad y restauración](../data/backup-and-restore.md) para **Backup & Export**, y [Borrar tus datos](../data/clearing-data.md) para **Danger Zone**.

## Cómo se sincroniza la configuración entre dispositivos

Marinara guarda la mayor parte de tu configuración en el servidor, así que te sigue entre navegadores y dispositivos. Este es el comportamiento de sincronización de la configuración.

Así funciona:

1. Cambias un ajuste en cualquier parte de **Settings**.
2. Un segundo después, más o menos, Marinara guarda el cambio en el servidor con una marca de tiempo.
3. Cuando otro navegador abre el mismo servidor de Marinara, carga esa configuración guardada.

Cada dispositivo conserva la copia más nueva. Esto es gana-la-última-escritura por marca de tiempo. Ten cuidado con una consecuencia de esta regla. Si abres Marinara en un segundo dispositivo, su copia puede sobrescribir en silencio un ajuste que acabas de cambiar en el primer dispositivo. Dale un momento a la app para sincronizar antes de cambiar de dispositivo.

Dos ajustes nunca se sincronizan. Se quedan por navegador en el dispositivo donde los configuras:

- **Display Size** (el tamaño del texto de la interfaz)
- **Chat Font Size** (el tamaño del texto del chat)

Ambos están en **Settings** > **Appearance** > **Text & Scale**. Configúralos de nuevo en cada dispositivo que uses. Mira [Configuración de apariencia](../appearance/appearance-settings.md).

Si el servidor no está disponible, la app sigue funcionando con tu configuración local y lo reintenta la próxima vez que cambies algo.

## Guías relacionadas

- [Configuración de apariencia](../appearance/appearance-settings.md)
- [Acciones de mensaje](../chats/messages.md)
- [Enviar y transmitir mensajes](../chats/sending-and-streaming.md)
- [Exportar e importar chats](../chats/export-import.md)
- [Dónde se guardan tus datos](../data/where-data-is-stored.md)
- [Actualizar Marinara Engine](../UPGRADING.md)
- [Solución de problemas](../TROUBLESHOOTING.md)
- [Logros](../home/achievements.md)
- [Extensiones personales](../extending/personal-extensions.md)
- [Localización de la interfaz](../development/localization.md)
