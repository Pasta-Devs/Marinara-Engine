# Noodle: ajustes y traspaso al chat

Usa el panel **Noodle settings** (Ajustes de Noodle) para elegir quién participa en la línea de tiempo, cuánto publica y cómo comparte Noodle el contexto con tus chats. Dos funciones comparten contexto en direcciones opuestas: **Carryover to chats** (Traspaso a los chats) y el interruptor por chat **Allow Noodle references** (Permitir referencias de Noodle).

Si es la primera vez que usas Noodle, lee primero [Noodle: la línea de tiempo social dentro de la app](noodle.md). Una persona es el personaje que interpretas en un chat. Consulta [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md) para las cuentas de IA.

## Abrir los ajustes

1. Abre Noodle desde **Home** (Inicio).
2. En la barra lateral izquierda, haz clic en **Settings** (Configuración), el icono de engranaje. El encabezado dice **Noodle settings**.
3. Elige una página con los botones debajo del encabezado.

| Página | Secciones |
| --- | --- |
| **General** | [Refresh](#refresh), [Translation](#translation) |
| **Timeline** (Línea de tiempo) | [Activity](#activity), [Image Generation](#image-generation) |
| **Participants** (Participantes) | [Invites](#invites), [Random users](#random-users) (**Ambient Profiles**, Perfiles ambientales), [Active Accounts](#active-accounts) |
| **Advanced** (Avanzado) | **Noodle Prompt**, [Image Understanding](#image-understanding), [Timeline Writing](#timeline-writing), [World / Lore](#world--lore), [Carryover](#carryover), [Reset Noodle](#reset-noodle) |

Todos los ajustes de Noodle son globales. Se aplican a todas las personas y a todos los chats. Los cambios se guardan en cuanto los haces. Tienes la lista completa de valores predeterminados en [Ajustes y valores predeterminados](#settings-and-defaults).

## Refresh

Un refresco es cuando la IA escribe un lote de publicaciones, respuestas, reposts y likes para las cuentas invitadas. Esta sección define el modelo con el que escribe Noodle y con qué frecuencia se refresca por su cuenta.

- **Generation model** (Modelo de generación): el modelo que Noodle usa para escribir publicaciones, respuestas, reposts, likes y texto de perfil. Empieza sin definir, con el marcador de posición **Choose connection** (Elige una conexión). Debes elegir uno antes de que se ejecute cualquier refresco. Un modelo que puede ver imágenes también recibe hasta ocho imágenes recientes relevantes de publicaciones y comentarios. Si un modelo de solo texto las rechaza, se reintenta sin las imágenes.
- **Refreshes/day** (Refrescos/día): de 0 a 24, predeterminado **2**. Cuántos refrescos automáticos se ejecutan por día. 0 los desactiva. No limita los refrescos manuales.

### Horario automático

Cuando **Refreshes/day** está por encima de 0, Marinara divide el día en ventanas iguales y elige un momento aleatorio en cada una. Los momentos planificados, con su zona horaria, aparecen bajo **Automatic schedule** (Horario automático). Haz clic en el lápiz junto a un momento futuro para moverlo a otra hora. Los momentos pasados, los completados y los duplicados no se pueden elegir.

Los refrescos automáticos se ejecutan dentro del servidor, así que la página de Noodle puede estar cerrada, pero Marinara debe estar en ejecución. Si un refresco falla, el horario muestra el error y reintenta más tarde, esperando más tras fallos repetidos. Si se pierden varios momentos planificados, un solo refresco de recuperación con éxito los cubre.

## Translation

**Translate posts automatically** (Traducir publicaciones automáticamente) está **desactivado** de forma predeterminada y necesita Noodle 1.5.0 o posterior. Muestra una traducción bajo cada publicación y cada comentario que no hayan escrito tus personas, sin hacer clic en **Translate** (Traducir) en cada uno. Noodle usa los valores predeterminados del traductor guardados desde los ajustes de **Translation** (Traducción) de un chat, con **Save translator defaults** (Guardar valores predeterminados del traductor). Sin valores predeterminados guardados, usa Google Translate para traducir al inglés. Consulta [Traducción de mensajes](../integrations/message-translation.md). El texto que ya está en el idioma de destino no recibe una copia extra, una traducción que ocultas sigue oculta, y desactivar el interruptor detiene las traducciones que aún están pendientes.

Las traducciones se guardan en este navegador, tanto las automáticas como las que haces con **Translate**. Vuelven a aparecer después de un refresco, al salir de Noodle o al recargar la página. En otro dispositivo, o en un navegador con los datos borrados, se vuelven a traducir. **Reset Noodle Timeline** (Restablecer la línea de tiempo de Noodle) también las olvida.

## Invites

**Invites** (Invitaciones) elige qué personajes pueden participar en un refresco.

- **Professor Mari participates** (Professor Mari participa): **activado** de forma predeterminada. Desactívalo para ocultarla del descubrimiento de cuentas y excluirla de nuevas publicaciones, respuestas, reacciones, menciones, generación de perfiles y traspaso al chat. El historial existente se conserva, y volver a activarlo restaura su cuenta.
- **Characters to Invite** (Personajes para invitar): un cuadro de búsqueda que filtra tanto la lista de carpetas como la lista de personajes.
- **Add from Folder** (Añadir desde carpeta): despliega tus carpetas de personajes. Marca una o más y luego haz clic en el botón de invitar de abajo. Su etiqueta dice **Select folders to invite** (Selecciona carpetas para invitar) cuando no hay nada marcado, **Selected folder characters are invited** (Los personajes de las carpetas seleccionadas están invitados) cuando todos ya están invitados, e **Invite N characters** (Invitar N personajes) cuando hay personajes nuevos.
- **Characters** (Personajes): cada personaje de tu biblioteca. Cada fila tiene un botón de invitar o quitar y un estado: **Invited** (Invitado), **Included by folder** (Incluido por carpeta) o **Not invited** (No invitado).

Invitar desde una carpeta es una acción masiva de una sola vez, no una sincronización en vivo. Los personajes que añadas a la carpeta después no se invitan automáticamente.

## Random users

Los usuarios aleatorios son seis cuentas ambientales integradas que no vienen de tu biblioteca: Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour y Brine Index. Cada una tiene una biografía breve.

Actívalos con la fila **Random users** (Usuarios aleatorios) en la parte superior de la lista **Characters** de **Invites**. Está **desactivada** de forma predeterminada y dice **Ambient fake profiles** (Perfiles falsos ambientales) cuando está desactivada y **Enabled** (Activado) cuando está activada. Cuando están activados, pueden publicar, dar like, hacer repost, responder y seguir durante un refresco. Nunca se les puede seguir.

**Ambient Profiles**, en la página **Participants**, te permite editar estas identidades o generar un conjunto distinto. Volver a generarlas conserva las publicaciones y las relaciones, pero quita las imágenes de perfil.

## Active Accounts

**Active Accounts** (Cuentas activas) define cuántas cuentas elegibles participan en un refresco. Las cuentas elegibles son tus personajes invitados, los personajes incluidos por carpeta y los usuarios aleatorios, si están activados. Tu persona activa siempre es elegible además de estas, y también Professor Mari mientras participa.

- **Active selection** (Selección activa), predeterminado **Random range** (Rango aleatorio): **Random range**, **Exact count** (Recuento exacto) o **All invited** (Todos los invitados).
- **Random range** muestra **Min active** (Mínimo activo: de 1 a 100, predeterminado 2) y **Max active** (Máximo activo: de 1 a 100, predeterminado 5). Cada refresco elige un recuento entre ellos.
- **Exact count** muestra **Active count** (Recuento activo: de 1 a 100).
- **All invited**: participan todas las cuentas elegibles, sin tope.

Noodle elige las cuentas activas antes de preparar los perfiles por primera vez. Solo los personajes activos sin un perfil generado reciben una solicitud de perfil. La solicitud de escritura de la línea de tiempo recibe tarjetas de personaje solo para las cuentas elegidas para ese refresco.

## Activity

Cada campo limita lo que puede crear un solo refresco. Pon un campo en 0 para detener ese tipo de actividad.

| Campo | Predeterminado | Rango |
| --- | --- | --- |
| **Posts** | 8 | 0 a 100 |
| **Replies** | 12 | 0 a 200 |
| **Reposts** | 4 | 0 a 100 |
| **Likes** | 18 | 0 a 500 |

## Image Generation

Esta sección permite a Noodle adjuntar imágenes hechas por IA a algunas publicaciones. Necesita un modelo de imagen. Consulta [Proveedores de IA compatibles](../connections/providers-reference.md) y [Proveedores de generación de imágenes y configuración](../media/image-providers.md).

- **Image generation** (Generación de imágenes): **desactivado** de forma predeterminada. Actívalo para dejar que la IA haga imágenes de publicación. Entonces aparecen más controles.
- **Image width** (Ancho de imagen) e **Image height** (Alto de imagen): de 64 a 4096 píxeles, predeterminado **1024** por **1536**.
- **Image generation connection** (Conexión de generación de imágenes): predeterminado **Default image generation connection** (Conexión de generación de imágenes predeterminada), que usa el modelo marcado como predeterminado para imágenes en **Connections** (Conexiones). Un personaje puede usar el suyo propio (consulta [Perfiles y seguimiento](noodle.md#profiles-and-following)).
- **Image instructions (sent to your LLM)** (Instrucciones de imagen: enviadas a tu LLM): texto integrado, hasta 4000 caracteres. El modelo de la línea de tiempo lo sigue cuando escribe la descripción de imagen de cada publicación, así que escribe instrucciones, no etiquetas de imagen. Para etiquetas de estilo que se envían directamente al modelo de imagen, usa un perfil de estilo.
- **Use avatar references** (Usar referencias de avatar): **activado** de forma predeterminada. Envía el avatar del personaje o sus imágenes de referencia al modelo de imagen.
- **Interpret image prompts** (Interpretar prompts de imagen): **activado** de forma predeterminada. Un modelo de texto reescribe cada prompt de imagen siguiendo las **Image prompting instructions** (Instrucciones para prompts de imagen) de tu modelo de imagen y el Style text de tu perfil de estilo. Cuando está desactivado, esas instrucciones no se usan y el Style text se añade tal como está escrito.
- **Include descriptions** (Incluir descripciones): **activado** de forma predeterminada. Añade las notas escritas de apariencia del personaje al prompt de imagen. Con **Interpret image prompts** activado, el modelo de texto las integra en lugar de pegarlas.
- **Images/refresh** (Imágenes/refresco): de 0 a 50, predeterminado **3**. Limita las imágenes de publicación generadas en cada refresco manual o automático.

**Attach gallery images** (Adjuntar imágenes de la galería), **desactivado** de forma predeterminada, es un interruptor aparte que sigue visible incluso cuando la generación de imágenes está desactivada. En lugar de hacer una imagen nueva, una publicación puede reutilizar una imagen de la galería de ese personaje o de un chat en el que aparece.

Si no funcionó: con la generación de imágenes activada pero sin un modelo de imagen usable, un refresco se bloquea con "Choose an image generation connection for Noodle first." (Elige primero una conexión de generación de imágenes para Noodle). Una imagen fallida se reintenta una vez. Si vuelve a fallar, el refresco continúa y publica una publicación limpia de solo texto.

La plantilla de estos prompts de imagen es **Noodle Post Image**. Edítala en **Settings → Generations → Image Generation Prompt Overrides**. Tus instrucciones de imagen entran en esa plantilla, y el resultado pasa por tu perfil de estilo. Consulta [Sobrescrituras de prompt para imagen y video](../prompts/prompt-overrides.md) y [Perfiles de estilo de imagen](../media/style-profiles.md). Professor Mari no tiene tarjeta de personaje, así que sus publicaciones con imagen usan su avatar integrado y su arte de referencia.

## Image Understanding

Esta sección decide cómo ve el escritor de la línea de tiempo las imágenes que ya están en la línea de tiempo.

- **Show images to the writer** (Mostrar las imágenes al escritor): **activado** de forma predeterminada. El escritor recibe hasta ocho imágenes recientes de la línea de tiempo cuando su modelo acepta imágenes. Desactivado, no recibe ninguna.
- **Image captioning** (Descripción de imágenes): un modelo con visión describe las imágenes de la línea de tiempo, así que un escritor de solo texto también puede seguirlas. Hasta que lo cambies, sigue el ajuste de descripción de imágenes del **Generation model**. **Use connection default** (Usar el valor predeterminado de la conexión) vuelve a ese ajuste.
- **Captioning model** (Modelo de descripción): aparece cuando la descripción de imágenes está activada. **Use Noodle generation connection** (Usar la conexión de generación de Noodle) usa el **Generation model**. Elige otro cuando ese modelo no pueda ver imágenes.

La descripción de imágenes sigue enviando las imágenes de la línea de tiempo al modelo de descripción cuando **Show images to the writer** está desactivado.

## Timeline Writing

Esta sección ajusta el tono y la memoria del escritor del refresco.

- **Enhanced tone & continuity** (Tono y continuidad mejorados): **desactivado** de forma predeterminada. Cuando está activado, la voz de cada cuenta se apoya más en su propia Personality, Description y Backstory en lugar de un tono alegre predeterminado. Se anima a las cuentas a reaccionar, citar o discutir con las publicaciones de las demás dentro del mismo refresco. La recuperación de publicaciones antiguas ocurre más a menudo y favorece las publicaciones relevantes para las cuentas activas. La instrucción de recuperación permite las referencias en lugar de desalentarlas. Desactivado, conserva exactamente el tono y la recuperación originales de Noodle.
- **Use generated character schedules** (Usar horarios de personaje generados): **desactivado** de forma predeterminada. Cuando está activado, Noodle incluye el horario de Conversation ya generado de hoy para cada personaje participante, cuando está disponible. Noodle no genera ni refresca horarios por sí mismo. La fecha y la hora locales actuales se incluyen en cada refresco de todos modos.

### Personalizar la voz del escritor

Puedes reescribir las instrucciones integradas de tono y libertad creativa del escritor en **Settings → Generations → Image Generation Prompt Overrides → Noodle Timeline Voice & Tone**. La sección se titula "Image", pero la lista contiene todos los prompts de texto personalizables de Noodle y Conversation. El texto predeterminado que se muestra ahí sigue **Enhanced tone & continuity** hasta que guardes tu propio texto; a partir de entonces se usa el tuyo sin importar ese ajuste.

Esta sobrescritura solo cubre voz y tono. Las reglas que mantienen válido un refresco, como qué acciones estructuradas están permitidas, siempre siguen en efecto.

## World / Lore

**Lorebook context** (Contexto de lorebook), **desactivado** de forma predeterminada, permite a un refresco usar entradas de lorebook. Cuando está activado, cada refresco escanea el texto reciente de publicaciones y respuestas de Noodle, más los perfiles de los personajes activos, en busca de coincidencias de palabras clave de lorebook. Las entradas coincidentes entran como contexto de mundo para las cuentas de ese refresco. Solo pueden activarse los lorebooks vinculados a un personaje activo o marcados como globales. El contenido activado tiene un presupuesto rígido de 8.192 tokens por refresco.

## Carryover

**Carryover** (Traspaso) empuja la actividad reciente de Noodle a tus chats. Cuando está activado, el prompt de un chat recibe un bloque "Recent Social Media Activity" sobre lo que tus personajes hicieron en Noodle.

- **Carryover to chats**: tres interruptores, todos **desactivados** de forma predeterminada: **Conversations**, **Roleplays** y **Games**. Activa los modos que deban recibir actividad de Noodle.
- **Carry hours** (Horas de traspaso): de 1 a 720, predeterminado **48**. Cuánto tiempo atrás mira Noodle.
- **Carry items** (Elementos de traspaso): de 1 a 50, predeterminado **8**. La mayor cantidad de resúmenes que se añaden a un turno de chat.

El traspaso solo trae actividad de los personajes invitados en Noodle, más la persona activa del chat. La inclusión solo por carpeta no es suficiente. El bloque de traspaso completo tiene un presupuesto rígido de 8.192 tokens por generación de chat. Si el límite de elementos lo superara, Marinara conserva los resúmenes más recientes que caben y los muestra en orden cronológico.

## Reset Noodle

Esto borra la línea de tiempo y conserva tus cuentas y ajustes.

1. Haz clic en **Reset Noodle Timeline**.
2. Lee el cuadro de diálogo: "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."
3. Haz clic en **Reset timeline** (Restablecer línea de tiempo) para confirmar.

Solo se borra el contenido de la línea de tiempo. Las cuentas, los identificadores, las biografías, los seguimientos, las invitaciones y todos los ajustes se mantienen.

## Conectar Noodle con tus chats

Noodle y los chats pueden compartir contexto en dos direcciones. Activar una no activa la otra.

- **Carryover to chats** (en los ajustes de Noodle) envía actividad de Noodle a un chat. Consulta [Carryover](#carryover).
- **Allow Noodle references** es un interruptor por chat que envía la actividad del chat a Noodle. Lo encuentras en los propios ajustes del chat, cerca de **Connected Chats** (Chats conectados). Consulta [Descripción general de Chat Settings](../chats/chat-settings.md). Está **desactivado** de forma predeterminada. Su descripción dice "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt." Si el chat también tiene en marcha un [horario de personaje de Conversation](../conversation/schedules.md), se incluyen el estado y la actividad actuales de un personaje en esa historia, como "currently dnd (At the office)", limitados a ese chat.

Usa cualquiera de los dos por separado, o los dos juntos.

## Solución de problemas

- **Un refresco no genera nada**: elige un **Generation model**, invita al menos a un personaje (o activa los usuarios aleatorios) y lee el error en la sección **Refresh**.
- **Los refrescos automáticos no ocurren**: pon **Refreshes/day** por encima de 0, mantén Marinara en ejecución y revisa los momentos planificados y la zona horaria bajo **Automatic schedule**. Si muestra un error, arregla la cuenta o el límite de tasa y deja que se ejecute el reintento.
- **Las publicaciones no mencionan un chat reciente**: activa **Allow Noodle references** en ese chat y asegúrate de que el personaje esté invitado. El contexto del chat es una guía para la IA, no una garantía.
- **La actividad de Noodle no aparece en los chats**: activa el modo de **Carryover to chats** correspondiente y sube **Carry hours** si la actividad es demasiado antigua.
- **Las publicaciones no tienen imágenes**: activa **Image generation**, elige un modelo de imagen que funcione y revisa **Images/refresh**.

<a id="settings-and-defaults"></a>

## Ajustes y valores predeterminados

| Ajuste | Predeterminado | Rango u opciones |
| --- | --- | --- |
| **Generation model** | sin configurar | cualquier modelo de texto (requerido para el refresco) |
| **Professor Mari participates** | activado | activado o desactivado |
| **Refreshes/day** | 2 | 0 a 24 (0 desactiva los refrescos automáticos) |
| **Translate posts automatically** | desactivado | activado o desactivado |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 a 100 (solo Random range) |
| **Max active** | 5 | 1 a 100 (solo Random range) |
| **Active count** | coincide con Max active | 1 a 100 (solo Exact count) |
| **Posts** | 8 | 0 a 100 |
| **Replies** | 12 | 0 a 200 |
| **Reposts** | 4 | 0 a 100 |
| **Likes** | 18 | 0 a 500 |
| **Image generation** | desactivado | activado o desactivado |
| **Image width** | 1024 | 64 a 4096 |
| **Image height** | 1536 | 64 a 4096 |
| **Image generation connection** | Default | cualquier modelo de imagen |
| **Image instructions (sent to your LLM)** | texto integrado | hasta 4000 caracteres |
| **Use avatar references** | activado | activado o desactivado |
| **Interpret image prompts** | activado | activado o desactivado |
| **Include descriptions** | activado | activado o desactivado |
| **Images/refresh** | 3 | 0 a 50 |
| **Attach gallery images** | desactivado | activado o desactivado |
| **Show images to the writer** | activado | activado o desactivado |
| **Image captioning** | sigue al Generation model | activado o desactivado |
| **Captioning model** | Use Noodle generation connection | cualquier modelo que pueda ver imágenes |
| **Use connection default** | activado | activado o desactivado; restablece el ajuste de descripción de imágenes del Generation model |
| **Lorebook context** | desactivado | activado o desactivado |
| **Enhanced tone & continuity** | desactivado | activado o desactivado |
| **Use generated character schedules** | desactivado | activado o desactivado |
| **Carryover: Conversations** | desactivado | activado o desactivado |
| **Carryover: Roleplays** | desactivado | activado o desactivado |
| **Carryover: Games** | desactivado | activado o desactivado |
| **Carry hours** | 48 | 1 a 720 |
| **Carry items** | 8 | 1 a 50 |
| **Allow Noodle references** (por chat) | desactivado | activado o desactivado |

## Guías relacionadas

- [Noodle: la línea de tiempo social dentro de la app](noodle.md)
- [Descripción general de Chat Settings](../chats/chat-settings.md)
- [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Proveedores de IA compatibles](../connections/providers-reference.md)
