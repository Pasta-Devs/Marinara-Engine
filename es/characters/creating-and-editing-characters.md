# Crear y editar personajes

Esta guía te muestra cómo crear un personaje en Marinara Engine. También te muestra cómo usar el Character Editor (editor de personajes) para escribir, guardar y gestionar versiones de una tarjeta. Cubre las pestañas Metadata, Card y Advanced, los avatares y el historial de versiones guardadas.

## Qué es una tarjeta de personaje

Una tarjeta de personaje es el archivo que define un personaje de IA. Contiene quién es, cómo habla, qué aspecto tiene y cómo empieza un chat con él. Escribes estos detalles en el Character Editor. Puedes crear una tarjeta desde cero, importar una desde otra app o exportar la tuya para compartirla.

La mayor parte de lo que escribes va a parar a unos pocos campos de texto. La IA lee esos campos cada vez que responde, así que una escritura clara y específica te da un personaje más consistente.

## Crear un personaje

1. Abre el panel **Characters** (Personajes) desde la barra lateral.
2. Haz clic en **New** (Nuevo, el icono del signo más). Se abre la ventana **Create Character** (Crear personaje).
3. Haz clic en el círculo redondo del avatar para subir una imagen. Este paso es opcional.
4. Escribe un nombre en el campo **Name \*** (Nombre). El nombre es obligatorio.
5. Haz clic en **Create** (Crear).

La nueva tarjeta se guarda con los campos vacíos. Luego se abre el Character Editor completo para que puedas rellenar el resto. También puedes empezar con **Import** (Importar) en lugar de **New** si ya tienes un archivo de tarjeta. Consulta [Importar y exportar tarjetas de personaje](import-export.md).

## El Character Editor de un vistazo

El Character Editor reemplaza el área del chat por un espacio de trabajo a página completa. El encabezado ocupa toda la parte superior y contiene las partes que más usas.

Arriba a la izquierda tienes la flecha **Back** (Atrás), la casilla del avatar, un campo de nombre y un campo de título o comentario. El campo de comentario es para una etiqueta corta como `Modern AU version`. Debajo hay una pequeña línea que muestra el creador y la versión.

Arriba a la derecha tienes estos botones:

- **Save** (Guardar). Este botón está desactivado hasta que haces un cambio. Su etiqueta muestra el estado actual: **Uploading…**, **Embedding…** o **Saving…**.
- La estrella **Favorite** (Favorito), que marca la tarjeta como favorita.
- **Export character** (Exportar personaje).
- **Import character as persona** (Importar personaje como persona), que copia esta tarjeta en una nueva persona de usuario.
- **Duplicate character** (Duplicar personaje).
- **Delete character** (Eliminar personaje).

Si intentas salir con trabajo sin guardar, un aviso dice `You have unsaved changes. Close without saving?` Te ofrece **Keep editing** (Seguir editando), **Discard & close** (Descartar y cerrar) y **Save & close** (Guardar y cerrar).

El editor está dividido en pestañas. En una pantalla ancha las pestañas van por el lado izquierdo. En una pantalla estrecha se convierten en una tira desplazable en la parte superior. Las pestañas, en orden, son **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, **Stats** y **Advanced**.

Esta guía cubre **Metadata**, **Card** y **Advanced**, además de los avatares y el historial de versiones. Las otras pestañas tienen sus propias guías:

- **Convo**: [Perfiles de Conversation Mode](../conversation/profiles.md).
- **Lorebook**: [Vincular lorebooks a personajes](../lorebooks/linking-to-characters.md).
- **Sprites**: [Sprites de personaje](sprites.md).
- **Gallery**: [Galerías de personaje y persona](galleries.md).
- **Colors** y **Stats**: [Colores de personaje y stats de RPG](colors-and-stats.md).

## Pestaña Metadata

La pestaña **Metadata** contiene los detalles de identidad y organización. Estos te ayudan a ordenar, compartir y hacer seguimiento de una tarjeta, pero la mayoría no se envían a la IA.

- **Character ID**. Un valor de solo lectura que se muestra solo después de guardar la tarjeta. Haz clic en **Copy** (Copiar) para copiarlo.
- **Name**. El nombre mostrado. Se usa como `{{char}}` en los prompts.
- **Phonetic name**. Una escritura opcional que se usa solo para corregir la pronunciación en el texto a voz. Déjalo vacío para usar el nombre normal.
- **Creator**. La persona que creó la tarjeta, para dar crédito cuando la compartes.
- **Version**. Un número de versión que tú defines, como `1.0`.
- **Talkativeness**. Un control deslizante del 0 al 100 por ciento. Define con qué frecuencia habla este personaje en los chats grupales. El valor predeterminado es 50 por ciento.
- **Tags**. Escribe una o más etiquetas en el campo de añadir etiqueta y pulsa Enter o haz clic en **Add** (Añadir). Puedes añadir varias a la vez separadas por comas. Quita una etiqueta con su X, o bórralas todas con **Remove All** (Quitar todas).
- **Creator Notes**. Notas privadas que nunca se envían a la IA. Aun así aparecen como un resumen en tu biblioteca.

El panel **Version history** (Historial de versiones) también vive en esta pestaña. Se cubre en la sección Guardado e historial de versiones más abajo.

## Pestaña Card

La pestaña **Card** es el espacio de escritura principal. Contiene los campos que la IA lee para interpretar al personaje. Los enlaces de salto de arriba te dejan ir a cualquier sección. Cada campo tiene un contador de caracteres en vivo.

- **Description**. La identidad y el rol generales del personaje. Esto se envía en cada prompt.
- **Personality**. Un breve resumen del temperamento, los hábitos de habla y los patrones de comportamiento.
- **Backstory**. Historia, origen y relaciones importantes.
- **Appearance**. Descripción física, ropa y detalles visuales. Marinara también usa este texto para generar un prompt de avatar de IA.
- **Scenario**. El entorno predeterminado para los nuevos chats con este personaje.

La sección **Dialogue & Greetings** (Diálogo y saludos iniciales) define cómo se abre un chat y cómo suena el personaje:

- **First Message**. El mensaje de apertura que se muestra cuando empieza un nuevo chat.
- **Alternate Greetings**. Mensajes de apertura adicionales. Cuando empiezas un chat puedes elegir cuál usar. Usa los controles de subir y bajar para reordenarlos, y la X para quitar uno.
- **Example Dialogue**. Intercambios de muestra que enseñan la voz del personaje. Usa `<START>` para separar intercambios. Usa `{{user}}` y `{{char}}` como marcadores de posición.

Los saludos y mensajes de ejemplo también pueden mostrar imágenes de la Gallery del personaje; consulta [Galerías de personajes → Reutilizar una imagen de galería en mensajes y saludos](galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

Una entrada corta de Example Dialogue tiene este aspecto:

```
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

## Añadir un avatar

Un avatar es la imagen que se muestra para el personaje en el chat y en tu biblioteca. Puedes subir uno, ajustar su encuadre o generar uno con IA.

### Subir una imagen

1. Haz clic en la casilla del avatar en el encabezado del editor.
2. Elige un archivo de imagen. La nueva imagen aparece de inmediato.

Una vez que un personaje tiene un avatar, aparece una herramienta de recorte de avatar en la pestaña **Metadata**. Úsala para reposicionar o ampliar la imagen dentro de su círculo sin volver a subir el archivo. La herramienta de recorte también tiene un control para quitar el avatar.

### Generar un avatar con IA

La opción de avatar con IA aparece solo cuando tienes al menos una conexión de generación de imágenes configurada. Consulta [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md).

1. Pasa el cursor sobre la casilla del avatar y haz clic en el pequeño botón de varita **Generate avatar** (Generar avatar).
2. Se abre la ventana **Generate Character Avatar** (Generar avatar de personaje).
3. Elige una **Image Generation Connection** (Conexión de generación de imágenes).
4. Revisa o edita el **Avatar Prompt** (Prompt del avatar). Viene rellenado a partir de tu texto de Appearance. Si Appearance está vacío, usa Description, y luego Personality.
5. Si la tarjeta ya tiene un avatar, puedes marcar **Use current avatar as a reference** (Usar el avatar actual como referencia).
6. Haz clic en **Generate** (Generar). Para volver a intentarlo, haz clic en **Regenerate** (Regenerar).
7. Cuando te guste el resultado, haz clic en **Use Avatar** (Usar avatar).

El tamaño de la imagen viene del ajuste de tamaño de imagen **Portraits** en los ajustes de generación de imágenes, que por predeterminado es 1024 por 1024. Si has activado **Expose media prompts before sending** (Mostrar los prompts de medios antes de enviarlos), aparece un paso de revisión del prompt antes de cada solicitud.

## Pestaña Advanced

La pestaña **Advanced** contiene controles de prompt para usuarios avanzados. Puedes dejarlos todos vacíos para un personaje normal.

Estos controles de prompt escritos por el autor del personaje se aplican en los modos Conversation, Roleplay y Game. Un preset de Conversation o Game seleccionado cambia el prompt que lo rodea, pero no desactiva las Post-History Instructions ni el Depth Prompt del personaje.

- **System Prompt**. Instrucciones específicas del personaje que se añaden a través del bloque de personaje del preset activo, el contexto de personaje de Conversation, o la tarjeta de personaje/GM de Game, según corresponda. Esto no reemplaza el prompt de sistema principal del chat.
- **Post-History Instructions**. Texto colocado cerca del final del prompt, próximo a la generación. Un uso común es un recordatorio corto como "Stay in character".
- **Depth Prompt**. Texto inyectado en un punto elegido del historial del chat. **Depth** define cuántos mensajes hacia atrás va. Depth 0 es justo después del último mensaje, y depth 4 es cuatro mensajes atrás. La profundidad predeterminada es 4. **Role** define si el texto se inserta como **System**, **User** o **Assistant**. El rol predeterminado es System.

La sección **Regex Scripts** de esta pestaña contiene scripts de buscar y reemplazar acotados a este único personaje. Estos usan el motor de regex compartido. Consulta [Scripts de regex](../extending/regex-scripts.md) para saber cómo funcionan.

## Guardado e historial de versiones

Haz clic en **Save** en el encabezado para almacenar tus cambios. El botón permanece desactivado hasta que editas algo, y entonces se activa.

Cada guardado puede añadir una instantánea a **Version history**, que se encuentra en la pestaña **Metadata**. Antes de tu primera edición adicional, el panel dice `Previous card states will appear here after the next edit.` Un contador muestra cuántas instantáneas has guardado.

Para comparar una versión guardada con tu tarjeta actual:

1. Abre la pestaña **Metadata**.
2. En **Version history**, haz clic en una versión guardada.
3. Se abre una ventana **Compare** (Comparar). Enumera campos como Name, Description, Personality, Scenario, First Message y Example Dialogue uno al lado del otro. Marca cada campo que cambió.

Para volver a una versión anterior:

1. Abre la ventana **Compare** para la versión que quieres, o haz clic en su icono de restaurar en la lista.
2. Haz clic en **Restore this version** (Restaurar esta versión), y luego confirma.

Restaurar reemplaza tu tarjeta actual por esa instantánea. No añade una nueva entrada al historial. Usa el icono de lápiz para corregir la etiqueta de versión de una instantánea guardada sin restaurarla. También puedes eliminar una instantánea guardada de la lista; eliminarla no cambia tu tarjeta actual.

Usa **Reset** (Restablecer) en el encabezado de **Version history** cuando quieras reiniciar el versionado de la tarjeta. Después de confirmar, Marinara elimina todas las instantáneas guardadas y establece la versión de la tarjeta actual en `0.0`. Esta acción no se puede deshacer.

## Revisar las actualizaciones de tarjeta propuestas por un agente

Durante un chat de Roleplay, un agente opcional puede sugerir pequeñas ediciones a los campos de la tarjeta según lo que pasó en la escena. Cuando lo hace, aparece una ventana **Review Character Card Updates** (Revisar actualizaciones de la tarjeta de personaje) para que sigas teniendo el control. Tú eliges qué conservar.

Para cada edición propuesta puedes:

- **Approve** (Aprobar). Aplica el cambio. Esto también sube el número de versión y añade una entrada al historial de versiones.
- **Regenerate** (Regenerar). Pide al agente que lo intente de nuevo.
- **Reject** (Rechazar). Descarta la propuesta.

Si el texto subyacente cambió desde que se hizo la propuesta, la app te avisa antes de dejarte forzar la edición. Para saber cómo activar o desactivar estos agentes, consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).

## Una nota sobre Professor Mari

**Professor Mari** es un personaje asistente integrado que viene con Marinara. No puedes eliminarla. Si lo intentas, la app lo bloquea y te dice que es un personaje integrado. Para saber qué hace, consulta [Professor Mari, tu asistente dentro de la app](../home/professor-mari.md).

## Guías relacionadas

- [Personas de usuario: crear y editar](personas.md)
- [Sprites de personaje](sprites.md)
- [Galerías de personaje y persona](galleries.md)
- [Importar y exportar tarjetas de personaje](import-export.md)
- [Colores de personaje y stats de RPG](colors-and-stats.md)
- [Perfiles de Conversation Mode](../conversation/profiles.md)
- [Vincular lorebooks a personajes](../lorebooks/linking-to-characters.md)
