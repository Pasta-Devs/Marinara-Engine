# Noodle: ajustes y traspaso al chat

Esta guía recorre el panel de **Noodle settings** (Ajustes de Noodle) sección por sección, con cada valor predeterminado y cada límite. También explica cómo conectar Noodle con tus chats. Dos funciones hacen esto: **Carryover to chats** (Traspaso a los chats) y el interruptor por chat **Allow Noodle references** (Permitir referencias de Noodle). Funcionan en direcciones opuestas.

Noodle es el timeline de redes sociales dentro de la app de Marinara Engine. Si es la primera vez que lo usas, lee primero [Noodle: el timeline social dentro de la app](overview.md). Una persona es el personaje que interpretas en un chat. Una conexión es un vínculo guardado a un proveedor de IA que genera texto o imágenes. Consulta [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md).

## Abrir el panel de ajustes de Noodle

1. Abre Noodle desde la barra superior.
2. En la barra lateral izquierda, haz clic en el botón **Settings** (Configuración), el icono de engranaje.
3. El encabezado del panel dice **Noodle settings**.

Todos los ajustes de Noodle son globales. Se aplican a todas las personas y a todos los chats, no a un chat concreto. Los cambios se guardan en cuanto los haces.

## Invites

La sección **Invites** (Invitaciones) elige qué personajes pueden participar en un refresco de Noodle. Un refresco es cuando la IA escribe un lote de publicaciones, respuestas, republicaciones y "me gusta" para las cuentas invitadas.

- **Professor Mari participates** (Professor Mari participa): un interruptor, predeterminado **on** (encendido). Apágalo para ocultar a Professor Mari del descubrimiento de cuentas de Noodle y excluirla de futuras publicaciones generadas, respuestas, reacciones, menciones, generación de perfiles y traspaso al chat. El historial existente del timeline se conserva, y volver a encender el interruptor restaura su cuenta.
- **Characters to Invite** (Personajes para invitar): un cuadro de búsqueda. Escribe aquí para filtrar tanto la lista de carpetas como la lista de personajes debajo.
- **Add from Folder** (Añadir desde carpeta): haz clic para desplegar una lista de tus carpetas de personajes. Marca una o más carpetas, luego haz clic en el botón de invitar abajo. La etiqueta del botón cambia según tu selección:
  - **Select folders to invite** (Selecciona carpetas para invitar) cuando no hay nada marcado.
  - **Selected folder characters are invited** (Los personajes de las carpetas seleccionadas están invitados) cuando todo ya está invitado.
  - **Invite N characters** (Invitar N personajes) cuando hay personajes nuevos que añadir.
- **Characters** (Personajes): una lista desplazable de cada personaje de tu biblioteca. Cada fila tiene un botón de invitar o quitar. Su estado aparece como **Invited** (Invitado), **Included by folder** (Incluido por carpeta) o **Not invited** (No invitado).

Invitar desde una carpeta es una acción masiva de una sola vez. No es una sincronización en vivo. Los personajes que añadas a esa carpeta después no se invitan automáticamente.

## Refresh

La sección **Refresh** (Refresco) controla la conexión de IA con la que escribe Noodle, y con qué frecuencia Noodle se refresca por su cuenta.

- **Generation connection** (Conexión de generación): un menú desplegable. Elige la conexión que Noodle usa para escribir publicaciones, respuestas, republicaciones, "me gusta" y texto de perfil. Empieza sin definir, con el marcador de posición **Choose connection** (Elige una conexión). Debes elegir una antes de que se ejecute cualquier refresco. Los modelos con capacidad de visión también reciben hasta ocho imágenes recientes relevantes de publicaciones y comentarios de Noodle. Los modelos de solo texto que rechazan esas entradas de imagen se reintentan automáticamente sin las imágenes.
- **Refreshes/day** (Refrescos/día): un número, de 0 a 24, predeterminado **2**. Es cuántos refrescos automáticos ejecuta Marinara por día. Ponlo en 0 para desactivar los refrescos automáticos. No limita con qué frecuencia refrescas a mano.

### Horario automático

Cuando **Refreshes/day** está por encima de 0, Marinara divide el día en ventanas iguales y elige un momento aleatorio dentro de cada ventana. Los momentos planificados, con su zona horaria, aparecen bajo **Automatic schedule** (Horario automático). Haz clic en el lápiz junto a un momento futuro para moverlo a otra hora. Los momentos pasados, los completados y los duplicados no se pueden elegir.

Los refrescos automáticos se ejecutan dentro del servidor de Marinara. La página de Noodle no necesita quedarse abierta, pero el propio Marinara debe estar en ejecución. Si un refresco falla, el horario muestra el error y reintenta más tarde, esperando más tras fallos repetidos. Si se pierden varios momentos planificados, un solo refresco de recuperación con éxito los cubre en lugar de inundar el timeline.


## Active Accounts

La sección **Active Accounts** (Cuentas activas) define cuántas cuentas elegibles participan en un refresco. Las cuentas elegibles son tus personajes invitados, los personajes incluidos por carpeta y usuarios aleatorios si los activaste.

- **Active selection** (Selección activa): un menú desplegable, predeterminado **Random range** (Rango aleatorio). Las opciones son **Random range**, **Exact count** (Recuento exacto) y **All invited** (Todos los invitados).
- Con **Random range**, aparecen dos campos: **Min active** (Mínimo activo) (1 a 100, predeterminado **2**) y **Max active** (Máximo activo) (1 a 100, predeterminado **5**). Cada refresco elige un recuento entre ellos.
- Con **Exact count**, aparece un campo: **Active count** (Recuento activo) (1 a 100). Fija un número fijo de cuentas.
- Con **All invited**, participan todas las cuentas elegibles, sin tope.

Tu persona activa siempre es elegible, además de estas cuentas. Professor Mari es elegible mientras **Professor Mari participates** esté encendido.

Noodle elige las cuentas activas antes de preparar los perfiles por primera vez. Solo los personajes activos sin un perfil de Noodle generado reciben una solicitud de generación de perfil; los personajes invitados inactivos no se incluyen. La solicitud de escritura del timeline también recibe tarjetas de personaje solo para las cuentas seleccionadas para ese refresco.

## Activity

La sección **Activity** (Actividad) limita cuánto puede crear un solo refresco. Cada campo es un tope por refresco.

| Campo | Predeterminado | Rango |
|---|---|---|
| **Posts** | 8 | 0 a 100 |
| **Replies** | 12 | 0 a 200 |
| **Reposts** | 4 | 0 a 100 |
| **Likes** | 18 | 0 a 500 |

Pon un campo en 0 para impedir que la IA cree ese tipo de actividad.

## Image Generation

La sección **Image Generation** (Generación de imágenes) permite a Noodle adjuntar imágenes hechas por IA a algunas publicaciones. Esto necesita una conexión de generación de imágenes, que es una conexión configurada para hacer imágenes. Consulta [Proveedores de IA compatibles](../connections/providers-reference.md).

- **Image generation** (Generación de imágenes): un interruptor, predeterminado **off**. Actívalo para dejar que la IA genere imágenes de publicación.
- Cuando está encendido, aparecen más controles:
  - **Image generation connection** (Conexión de generación de imágenes): un menú desplegable, predeterminado **Default image generation connection** (Conexión de generación de imágenes predeterminada). Dejarlo en Default usa la conexión marcada como predeterminada para generación de imágenes en el panel de Connections.
  - **Prompt instructions** (Instrucciones de prompt): un cuadro de texto con texto predeterminado incorporado, hasta 4000 caracteres. Estas notas extra se fusionan en el prompt de imagen.
  - **Use avatar references** (Usar referencias de avatar): un interruptor, predeterminado **on**. Envía el avatar del personaje o sus imágenes de referencia al modelo de imagen.
  - **Include descriptions** (Incluir descripciones): un interruptor, predeterminado **on**. Añade las notas escritas de apariencia del personaje al prompt de imagen.
  - **Images/refresh** (Imágenes/refresco): un número, 0 a 50, predeterminado **3**. Esto limita las imágenes de publicación generadas por separado para cada refresco manual o automático.
- **Attach gallery images** (Adjuntar imágenes de la galería): un interruptor aparte, predeterminado **off**. Sigue visible incluso cuando **Image generation** está apagado. En lugar de hacer una imagen nueva, permite que una publicación reutilice una imagen de la galería de ese personaje o de un chat en el que aparece.

Si activas **Image generation** pero no tienes una conexión de imagen usable, un refresco se bloquea. Verás el mensaje "Choose an image generation connection for Noodle first." Una imagen fallida se reintenta una vez. Si el segundo intento también falla, el refresco continúa y publica una publicación limpia de solo texto en lugar de exponer el prompt de imagen sin usar.

La plantilla que Noodle usa para escribir estos prompts de imagen se llama **Noodle Post Image**. Puedes editarla en **Settings** > **Generations** > **Image Generation Prompt Overrides**. Tu texto de **Prompt instructions** se pasa a esa plantilla, y el resultado pasa luego por tu perfil de estilo de imagen normal. Consulta [Sobrescrituras de prompt para imagen y video](../prompts/prompt-overrides.md) y [Perfiles de estilo de imagen](../media/style-profiles.md). Professor Mari no tiene tarjeta de personaje, así que sus publicaciones de imagen usan su avatar incorporado y su arte de referencia en su lugar.

## Timeline Writing

La sección **Timeline Writing** (Escritura del timeline) ajusta el tono del escritor del refresco y su comportamiento de memoria a largo plazo.

- **Enhanced tone & continuity** (Tono y continuidad mejorados): un interruptor, predeterminado **off**. Cuando está encendido, la voz de cada cuenta se apoya con más fuerza en su propia Personality/Description/Backstory en lugar de un tono alegre predeterminado, se anima a las cuentas a reaccionar, citar o discutir con las publicaciones de las demás dentro del mismo refresco, la recuperación de publicaciones antiguas ocurre más a menudo (y favorece las publicaciones relevantes para las cuentas activas en ese momento en lugar de elegir puramente al azar), y la instrucción de recuperación permite las referencias en vez de desalentarlas. Apagado reproduce exactamente el tono y el comportamiento de recuperación originales de Noodle, así que encender esto es la única forma de que tus timelines cambien.
- **Use generated character schedules** (Usar horarios de personaje generados): un interruptor, predeterminado **off**. Cuando está encendido, Noodle incluye el horario de Conversation generado de hoy para cada personaje participante, cuando está disponible. Noodle no genera ni refresca horarios por sí mismo. La fecha y hora locales actuales del usuario se incluyen en cada refresco del timeline, esté este interruptor encendido o apagado.

## Personalizar la voz del escritor del timeline

El escritor del refresco de Noodle sigue un conjunto incorporado de instrucciones de tono y libertad creativa: cuánta personalidad deben llevar las publicaciones de cada cuenta, y cuánto pueden bromear, chancear o chocar las cuentas entre sí. Puedes reescribir este texto en **Settings** > **Generations** > **Image Generation Prompt Overrides** > **Noodle Timeline Voice & Tone** (el título de la sección dice "Image", pero esta lista contiene todos los prompts de texto de Noodle/Conversation personalizables, no solo los de imagen). El texto predeterminado que se muestra ahí sigue el interruptor **Enhanced tone & continuity** de arriba hasta que lo personalizas; una vez que guardas tu propio texto, se usa sin importar ese interruptor.

Esta sobrescritura solo cubre voz y tono. Las reglas que mantienen válida la salida de un refresco (qué acciones estructuradas están permitidas, cómo deben dirigirse las interacciones, etc.) no forman parte de este texto y siempre siguen en efecto, así que una voz reescrita no puede romper un refresco.

## World / Lore

La sección **World / Lore** (Mundo / Trasfondo) permite a un refresco incorporar entradas de lorebook, el mismo sistema de lorebook que usa la generación del chat.

- **Lorebook context** (Contexto de lorebook): un interruptor, predeterminado **off**. Cuando está encendido, cada refresco escanea el texto reciente de publicaciones y respuestas de Noodle, más los perfiles de los personajes activos, en busca de coincidencias de palabra clave de lorebook, e incluye las entradas coincidentes como contexto de mundo/trasfondo para las cuentas que participan en ese refresco. Solo pueden activarse los lorebooks vinculados a un personaje activo (o marcados como globales). El contenido de mundo/trasfondo activado tiene un presupuesto de tokens rígido de 8192 por refresco. Esto está apagado de forma predeterminada, así que los timelines existentes no se ven afectados hasta que lo enciendas.

## Carryover

La sección **Carryover** (Traspaso) empuja la actividad reciente de Noodle a tus chats. Cuando está encendido, el prompt de un chat recibe un bloque "Recent Social Media Activity" que describe lo que tus personajes han estado haciendo en Noodle.

- **Carryover to chats** (Traspaso a los chats): tres interruptores separados, todos **off** de forma predeterminada: **Conversations**, **Roleplays** y **Games**. Enciende los modos que quieres que reciban actividad de Noodle.
- **Carry hours** (Horas de traspaso): un número, 1 a 720, predeterminado **48**. Es cuánto atrás, en horas, mira Noodle para encontrar actividad que traspasar.
- **Carry items** (Elementos de traspaso): un número, 1 a 50, predeterminado **8**. Es la mayor cantidad de resúmenes de actividad que se añaden a un turno de chat.

El traspaso solo trae actividad de los personajes que están invitados en Noodle, más la persona activa del chat. La inclusión solo por carpeta no es suficiente aquí.
El bloque de traspaso completo y envuelto tiene su propio presupuesto de tokens rígido de 8192 por generación de chat. Si el límite de elementos lo superara, Marinara conserva los resúmenes más recientes que caben y los muestra en orden cronológico.

## Reset Noodle

La sección **Reset Noodle** (Restablecer Noodle) borra el timeline manteniendo tus cuentas y ajustes.

1. Haz clic en el botón **Reset Noodle Timeline** (Restablecer el timeline de Noodle).
2. Aparece una ventana titulada **Reset Noodle Timeline**. Dice "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."
3. Haz clic en **Reset timeline** (Restablecer timeline) para confirmar.

Esto solo elimina el contenido del timeline. Tus cuentas, identificadores, biografías, seguimientos, invitaciones y todos los ajustes de Noodle se mantienen en su lugar.

## Random users

Los usuarios aleatorios son seis cuentas ambientales incorporadas que no vienen de tu biblioteca: Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour y Brine Index. Cada una tiene una biografía breve con carácter.

Los enciendes con la fila **Random users** (Usuarios aleatorios) en la parte superior de la lista **Characters** en la sección **Invites**. Está **off** de forma predeterminada. Su subtítulo dice **Enabled** (Activado) cuando está encendido, o **Ambient fake profiles** (Perfiles falsos ambientales) cuando está apagado. Cuando está encendido, estas cuentas pueden publicar, dar "me gusta", republicar, responder y seguir durante un refresco. Nunca se les puede seguir desde un perfil.

## Conectar Noodle con tus chats

Noodle y tus chats pueden compartir contexto en dos direcciones. Son dos funciones separadas. Encender una no enciende la otra.

**Carryover to chats** (configurado en los ajustes de Noodle) envía actividad de Noodle a un chat. Añade el bloque "Recent Social Media Activity" al prompt de ese chat, como se describe en la sección Carryover de arriba.

**Allow Noodle references** es un interruptor por chat. Envía la actividad del chat en el otro sentido, hacia Noodle. Lo encuentras en los propios ajustes del chat, cerca del área **Connected Chats** (Chats conectados). Consulta [Vista general de Chat Settings](../chats/chat-settings.md). Está **off** de forma predeterminada para cada chat. Su descripción dice "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt." Si ese chat también tiene un [horario de personaje de Conversation](../conversation/schedules.md) en marcha, el estado y la actividad actuales de un personaje en esa historia (por ejemplo, "currently dnd (At the office)") se incluyen junto a sus mensajes, limitados a ese único chat.

Para que la actividad de Noodle aparezca en un chat, enciende el modo **Carryover to chats** correspondiente. Para dejar que un refresco de Noodle lea de un chat, enciende **Allow Noodle references** de ese chat. Puedes usar uno solo, o los dos juntos.

## Solución de problemas

- **Refresh ahora no genera nada**: elige una **Generation connection**, invita al menos un personaje (o enciende usuarios aleatorios) y revisa el error mostrado en la sección **Refresh**.
- **Los refrescos automáticos no ocurren**: pon **Refreshes/day** por encima de 0, mantén el servidor de Marinara en ejecución, y revisa los momentos planificados y la zona horaria bajo **Automatic schedule**. Si el horario muestra un error, arregla el problema de conexión o de límite de tasa y deja que se ejecute el reintento.
- **Las publicaciones no mencionan un chat reciente**: enciende **Allow Noodle references** en los ajustes de ese chat, y asegúrate de que el personaje esté invitado. El contexto del chat es una guía para la IA, no una garantía.
- **La actividad de Noodle no aparece en los chats**: enciende el modo **Carryover to chats** correspondiente, y sube **Carry hours** si la actividad es demasiado antigua.
- **Las publicaciones no tienen imágenes**: enciende **Image generation**, elige una conexión de imagen que funcione, y revisa el límite **Images/refresh**.

## Ajustes y valores predeterminados

Esta tabla lista cada ajuste de Noodle con su valor predeterminado y su rango.

| Ajuste | Predeterminado | Rango u opciones |
|---|---|---|
| **Generation connection** | none | cualquier conexión de texto (requerida para el refresco) |
| **Professor Mari participates** | on | on u off |
| **Refreshes/day** | 2 | 0 a 24 (0 desactiva los refrescos automáticos) |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 a 100 (solo Random range) |
| **Max active** | 5 | 1 a 100 (solo Random range) |
| **Active count** | coincide con Max active | 1 a 100 (solo Exact count) |
| **Posts** | 8 | 0 a 100 |
| **Replies** | 12 | 0 a 200 |
| **Reposts** | 4 | 0 a 100 |
| **Likes** | 18 | 0 a 500 |
| **Image generation** | off | on u off |
| **Image generation connection** | Default | cualquier conexión de generación de imágenes |
| **Prompt instructions** | texto incorporado | hasta 4000 caracteres |
| **Use avatar references** | on | on u off |
| **Include descriptions** | on | on u off |
| **Images/refresh** | 3 | 0 a 50 |
| **Attach gallery images** | off | on u off |
| **Lorebook context** | off | on u off |
| **Enhanced tone & continuity** | off | on u off |
| **Carryover: Conversations** | off | on u off |
| **Carryover: Roleplays** | off | on u off |
| **Carryover: Games** | off | on u off |
| **Carry hours** | 48 | 1 a 720 |
| **Carry items** | 8 | 1 a 50 |
| **Allow Noodle references** (por chat) | off | on u off |

## Guías relacionadas

- [Noodle: el timeline social dentro de la app](overview.md)
- [Vista general de Chat Settings](../chats/chat-settings.md)
- [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Proveedores de IA compatibles](../connections/providers-reference.md)
