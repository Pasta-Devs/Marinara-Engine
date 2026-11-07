# Crear y editar personajes

Una tarjeta de personaje es el archivo que define un personaje de IA: quién es, cómo habla, qué aspecto tiene y cómo empieza un chat con él. La escribes en el Character Editor (editor de personajes). La IA lee los campos de la tarjeta cada vez que responde, así que una escritura clara y específica te da un personaje más consistente.

## Crear un personaje

1. Haz clic en **Characters** (Personajes) en la barra de navegación superior. Si no lo ves, abre primero **More** (Más).
2. Haz clic en **New** (Nuevo, el icono del signo más). Se abre la ventana **Create Character** (Crear personaje).
3. Escribe un nombre en **Name \*** (Nombre). El nombre es obligatorio.
4. Haz clic en el círculo redondo del avatar para añadir una imagen. Este paso es opcional.
5. Haz clic en **Create** (Crear).

La tarjeta se guarda con los campos vacíos y se abre el Character Editor.

6. Abre la pestaña **Card** y escribe la **Description**: quién es el personaje. Añade un **First Message** en **Dialogue & Greetings** (Diálogo y saludos iniciales), que es como empieza un chat de Roleplay.
7. Haz clic en **Save** (Guardar) en el encabezado.

Si ya tienes un archivo de tarjeta, haz clic en **Import** (Importar) en su lugar. Consulta [Importar y exportar tarjetas de personaje](import-export.md).

### Empezar un chat con tu personaje

Elige el personaje cuando empieces un chat. Consulta [Modo Roleplay: primeros pasos](../roleplay/getting-started.md) o [Conversation Mode: primeros pasos](../conversation/getting-started.md).

## El Character Editor de un vistazo

El Character Editor reemplaza el área del chat por un espacio de trabajo a página completa. En una pantalla ancha las pestañas van por el lado izquierdo. En una pantalla estrecha se convierten en una tira desplazable en la parte superior. Las pestañas, en orden, son **Metadata**, **Card**, **Onboarding**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, **Voice**, **Stats** y **Advanced**. Cada pestaña salta a su sección de un único formulario largo, así que también puedes desplazarte por él.

El encabezado contiene las partes que más usas:

- La flecha **Back** (Atrás), la casilla del avatar, un campo de nombre y un campo de título o comentario para una etiqueta corta como `Modern AU version`. Una línea debajo muestra el creador y la versión.
- **Save**. Está desactivado hasta que cambias algo. Mientras trabaja, muestra **Uploading…** (se está subiendo un avatar), **Embedding…** (se está añadiendo un lorebook a la tarjeta) o **Saving…**.
- La estrella **Favorite** (Favorito).
- **Export character** (Exportar personaje). Consulta [Importar y exportar tarjetas de personaje](import-export.md).
- **Import character as persona** (Importar personaje como persona), que copia esta tarjeta en una nueva persona de usuario. Consulta [Personas](personas.md).
- **Duplicate character** (Duplicar personaje).
- **Delete character** (Eliminar personaje).

Al salir del editor, primero se guardan tus cambios. Si el guardado falla, el editor permanece abierto con tu borrador para que puedas volver a intentarlo.

Pestañas que tienen su propia guía:

| Pestaña | Guía |
| --- | --- |
| **Onboarding** | [Onboarding interactivo](interactive-onboarding.md) |
| **Convo** | [Perfiles de Conversation Mode](../conversation/profiles.md) |
| **Lorebook** | [Vincular lorebooks a personajes](../lorebooks/linking-to-characters.md) |
| **Sprites** | [Sprites de personaje](sprites.md) |
| **Gallery** | [Galerías de personaje y persona](galleries.md) |
| **Colors** y **Stats** | [Colores del personaje y estadísticas de historia](colors-and-stats.md) |

Las secciones de abajo cubren **Metadata**, **Card**, **Voice** y **Advanced**, además de los avatares y el historial de versiones.

<a id="metadata-tab"></a>

## Pestaña Metadata

La pestaña **Metadata** contiene los detalles de identidad y organización. Te ayudan a ordenar, compartir y hacer seguimiento de una tarjeta. La mayoría no se envían a la IA.

- **Character ID**. Solo lectura. Aparece después de guardar la tarjeta. Haz clic en **Copy** (Copiar) para copiarlo.
- **Name**. El nombre mostrado. Es `{{char}}` en los prompts (las instrucciones enviadas a la IA), un marcador de posición que Marinara reemplaza por el nombre del personaje.
- **Creator**. Quién creó la tarjeta, para dar crédito cuando la compartes.
- **Version**. Un número de versión que tú defines, como `1.0`. El interruptor **Automatic versioning** (Control de versiones automático) que está al lado conserva las versiones anteriores y sube este número cuando la tarjeta cambia. El historial de versiones solo guarda instantáneas mientras este interruptor está activado.
- **Talkativeness**. Un control deslizante del 0 al 100 por ciento. Define con qué frecuencia habla este personaje en los chats grupales. El valor predeterminado es 50 por ciento.
- **Tags**. Escribe etiquetas en el campo de añadir etiqueta y pulsa <kbd>Enter</kbd> o haz clic en **Add** (Añadir). Separa varias etiquetas con comas. El campo sugiere etiquetas que tu biblioteca ya usa, primero las más usadas. Quita una etiqueta con su X, o quítalas todas con **Remove All** (Quitar todas).
- **Creator Notes**. Notas privadas que nunca se envían a la IA.

**Split description into fields** (Dividir la descripción en campos) es un botón debajo de **Version**. Mueve el texto etiquetado (personalidad, apariencia, historia, escenario, reglas, diálogo de ejemplo) de **Description** a sus propios campos. Primero ves un resumen breve, y al aplicarlo la tarjeta se guarda como una nueva versión. El botón está desactivado mientras **Description** está vacío.

El panel **Version history** (Historial de versiones) también está en esta pestaña. Consulta [Historial de versiones](#version-history).

<a id="card-tab"></a>

## Pestaña Card

La pestaña **Card** es el espacio principal de escritura. Los enlaces de la parte superior saltan a cualquier sección, y cada campo tiene un contador de caracteres en tiempo real.

| Campo | Qué escribir | Se envía a la IA |
| --- | --- | --- |
| **Summary** | Una descripción general breve para tu biblioteca y la vista previa de la tarjeta. | No |
| **Description** | La identidad y el rol generales del personaje. | En cada prompt |
| **Personality** | Temperamento, hábitos de habla, patrones de comportamiento. | Sí |
| **Backstory** | Historia, origen, relaciones importantes. | Sí |
| **Appearance** | Aspecto, ropa, detalles visuales. También sirve de base para un prompt de avatar de IA. | Sí |
| **Scenario** | El entorno predeterminado para los nuevos chats con este personaje. | Sí |

**Image Appearance Override** (Apariencia alternativa para imágenes) está debajo de **Appearance** y está desactivado de forma predeterminada. Actívalo para mostrar un segundo cuadro para etiquetas de imagen breves, como la palabra de activación de una LoRA (una palabra clave que activa un estilo de imagen personalizado). Mientras está activado y tiene texto, los prompts de imagen usan esas etiquetas tal como están escritas, y **Appearance** se mantiene como contexto de fondo. El prompt de avatar de IA también parte de ellas. El narrador siempre ve el texto completo de **Appearance**.

La sección **Dialogue & Greetings** define cómo se abre un chat y cómo suena el personaje:

- **First Message**. El mensaje de apertura de un nuevo chat de Roleplay. Los chats de Conversation y de Game no empiezan con un saludo.
- **Alternate Greetings**. Mensajes de apertura adicionales. Cuando empiezas un chat de Roleplay puedes elegir cuál usar. Usa los controles de subir y bajar para reordenarlos y la X para quitar uno.
- **Example Dialogue**. Intercambios de muestra que enseñan la voz del personaje. Usa `<START>` para separar intercambios y `{{user}}` y `{{char}}` como marcadores de posición.

```text
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

Los saludos y los mensajes de ejemplo pueden mostrar imágenes de la Gallery del personaje. Consulta [Reutilizar una imagen de galería en mensajes y saludos](galleries.md#reuse-a-gallery-image-in-messages-and-greetings). Cuando los saludos muestran imágenes de otros sitios web, **Save images locally** (Guardar imágenes localmente) conserva una copia en la Gallery. Consulta [Guardar imágenes web de los saludos](galleries.md#save-web-images-from-greetings).

<a id="write-a-card-field-with-the-wand"></a>

### Escribir un campo de la tarjeta con la varita

**Summary**, **Description**, **Personality**, **Backstory**, **Appearance**, **Scenario**, **Example Dialogue**, **First Message** y cada **Alternate Greeting** tienen encima del campo un botón de varita que solo muestra el icono. Su descripción emergente indica el campo que escribe.

Antes de empezar: configura una conexión de texto que funcione. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).

1. Escribe en el campo las ideas que quieras conservar, como `smart, scientist, handsome`, o déjalo vacío.
2. Completa los demás campos de la tarjeta que quieras que la IA use como referencia. No necesitas guardar primero.
3. Haz clic en la varita del campo. Marinara pide entre 100 y 300 palabras para ese campo, usando tu texto como detalles de partida. Example Dialogue pide intercambios de ejemplo. **First Message** y cada **Alternate Greeting** piden un mensaje de apertura que deja tu respuesta en tus manos.
4. Edita el resultado y luego haz clic en **Save**.

La varita usa tu conexión de texto predeterminada para agentes o, si no hay ninguna, tu conexión de texto predeterminada. Una conexión de respaldo de agentes configurada sigue aplicándose.

La varita solo reemplaza el campo elegido en tu borrador sin guardar. Si la generación falla, tu texto se queda. Si editas ese campo mientras esperas, o cambias a otra tarjeta, un resultado tardío no sobrescribe tu trabajo. No necesitas Professor Mari para usar la varita.

## Añadir un avatar

Un avatar es la imagen que se muestra para el personaje en el chat y en tu biblioteca.

### Subir una imagen

1. Haz clic en la casilla del avatar en el encabezado del editor.
2. Elige un archivo de imagen. La nueva imagen aparece de inmediato.

Una vez que un personaje tiene un avatar, aparece una herramienta de recorte de avatar en la pestaña **Metadata**. Úsala para mover o ampliar la imagen dentro de su círculo, o para quitar el avatar.

### Generar un avatar con IA

Antes de empezar: añade una conexión de generación de imágenes. El botón de avatar con IA solo aparece cuando tienes una. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).

1. Pasa el cursor sobre la casilla del avatar y haz clic en el botón de varita. Se abre la ventana **Generate Character Avatar** (Generar avatar de personaje).
2. Elige una **Image Generation Connection** (Conexión de generación de imágenes).
3. Revisa o edita el **Avatar Prompt** (Prompt del avatar). Parte de **Image Appearance Override** cuando está activado y tiene texto. Si no, usa **Appearance**, luego **Description** y luego **Personality**, el primero que tenga texto.
4. Si la tarjeta ya tiene un avatar, puedes marcar **Use current avatar as a reference** (Usar el avatar actual como referencia).
5. Haz clic en **Generate** (Generar). Para volver a intentarlo, haz clic en **Regenerate** (Regenerar).
6. Haz clic en **Use Avatar** (Usar avatar) cuando te guste el resultado.

El tamaño de la imagen viene del tamaño de imagen **Portraits** en los ajustes de generación de imágenes. De forma predeterminada es 1024 por 1024. Si **Expose media prompts before sending** (Mostrar los prompts de medios antes de enviarlos) está activado, aparece un paso de revisión del prompt antes de cada solicitud.

## Pestaña Voice

La pestaña **Voice** define cómo suena el personaje cuando Text to Speech (texto a voz) lo lee en voz alta.

- **Voice**. La voz de este personaje. Un cambio se guarda de inmediato, sin **Save**. Es el mismo ajuste que la fila de este personaje en **Connections → Text to Speech** (Conexiones → Text to Speech). Deja el campo vacío para usar la voz predeterminada. Si una tarjeta con un nombre coincidente tiene una voz, como el original de una copia AU, el campo vacío muestra el nombre de esa voz, porque esta tarjeta también la usa.
- **Preview** (Probar). Reproduce una frase corta con esa voz. La frase dice el nombre del personaje, o el **Phonetic name** cuando hay uno definido.
- **Phonetic name**. Una escritura opcional que se usa solo para corregir la pronunciación. Forma parte de la tarjeta, así que haz clic en **Save** para conservarlo.

Si Text to Speech está desactivado, o todos los personajes comparten una sola voz, una nota breve reemplaza el campo **Voice**. Con una sola voz compartida, la nota ofrece **Use a voice per character** (Usar una voz por personaje). **Open Text to Speech settings** (Abrir los ajustes de Text to Speech) abre Connections. Consulta [Configuración de Text to Speech (TTS)](../media/tts-setup.md).

## Pestaña Advanced

La pestaña **Advanced** contiene controles de prompt. Déjalos vacíos para un personaje normal. Se aplican en los modos Conversation, Roleplay y Game. Un preset (ajuste guardado) de Conversation o Game cambia el prompt que los rodea, pero no desactiva las Post-History Instructions ni el Depth Prompt del personaje.

- **System Prompt**. Instrucciones específicas del personaje que se añaden a través del bloque de personaje del preset activo, el contexto de personaje de Conversation o la tarjeta de personaje de Game. No reemplaza el prompt de sistema principal del chat.
- **Post-History Instructions**. Texto colocado después del historial del chat, justo antes de que la IA escriba, como "Stay in character".
- **Depth Prompt**. Texto inyectado en el historial del chat. **Depth** es cuántos mensajes hacia atrás: 0 es justo después del último mensaje. El valor predeterminado es 4. **Role** es **System**, **User** o **Assistant**. El valor predeterminado es System.

La sección **Regex Scripts** contiene scripts de buscar y reemplazar para este único personaje. Consulta [Scripts de regex](../extending/regex-scripts.md).

<a id="use-an-alternative-field-in-selected-chats"></a>

## Usar un campo alternativo en chats seleccionados

Un campo alternativo da al mismo personaje otra descripción, apariencia, historia u otro detalle en los chats que elijas, mientras todos los demás conservan el original. Cada uno de los siete campos de la tarjeta tiene **Add Alternative Field** (Añadir campo alternativo) debajo.

1. Haz clic en **Add Alternative Field** debajo del campo que quieras variar. Marinara copia el texto del campo en una nueva alternativa.
2. Edita la alternativa. Tiene su propia varita, que usa el texto de la alternativa como detalles de partida y no cambia el campo original.
3. Abre **Active in 0 chats** (Activo en 0 chats) y marca los chats que deben usarla. Solo aparecen los chats que incluyen a este personaje.
4. Haz clic en **Save**.

Reglas:

- Un chat solo puede usar una alternativa por campo. Marcar un chat en otra alternativa lo traslada allí.
- Sin chats marcados, la alternativa queda inactiva para más adelante.
- Una alternativa vacía borra ese campo en sus chats.
- Las sustituciones de escenario y de apariencia para imágenes específicas del chat siguen teniendo prioridad.
- Las alternativas de **Summary** siguen siendo metadatos y no se envían a la IA.
- Si el personaje sale de un chat, su asignación se pausa y se reanuda cuando vuelves a añadir al personaje.
- La exportación, la importación y la duplicación de tarjetas, y la conversión entre personajes y personas, conservan el texto alternativo, pero borran las marcas de chats. Las copias de seguridad del perfil completo conservan las marcas.

Para quitar una alternativa, haz clic en su botón de papelera, confirma con **Delete** (Eliminar) y luego haz clic en **Save**. Sus chats vuelven al campo original. Eliminar una alternativa nunca elimina el campo original.

<a id="version-history"></a>

## Historial de versiones

Mientras **Automatic versioning** está activado, cada guardado puede añadir una instantánea a **Version history** en la pestaña **Metadata**. Hasta entonces, el panel dice `Previous card states will appear here after the next edit.` Un contador muestra cuántas instantáneas hay guardadas.

Para comparar una versión guardada con tu tarjeta actual:

1. Abre la pestaña **Metadata**.
2. En **Version history**, haz clic en una versión guardada. Una ventana de comparación enumera los campos de la tarjeta uno al lado del otro y marca cada uno que cambió.

Para volver a una versión anterior:

1. Abre la ventana de comparación de esa versión, o haz clic en su icono de restaurar en la lista.
2. Haz clic en **Restore this version** (Restaurar esta versión) y luego confirma.

Marinara primero guarda tu tarjeta actual en el historial de versiones (a menos que ya coincida con esa versión), para que puedas volver a ella más tarde.

Otros controles del panel:

- El icono de lápiz cambia el número de versión de la tarjeta de una instantánea sin restaurarla.
- El icono de papelera elimina una instantánea. Tu tarjeta actual no cambia.
- **Reset** (Restablecer) elimina todas las instantáneas guardadas y establece la versión de la tarjeta en 1.0. Marinara te pide que lo confirmes, y no se puede deshacer. **Reset** está desactivado mientras tienes ediciones sin guardar.

## Revisar las actualizaciones de tarjeta propuestas por un agente

En un chat de Roleplay, un agente opcional puede sugerir pequeñas ediciones a los campos de la tarjeta según la escena. Se abre una ventana **Review Character Card Updates** (Revisar actualizaciones de la tarjeta de personaje) para que decidas qué conservar. Para cada edición propuesta:

- **Approve** (Aprobar) la aplica, sube el número de versión y añade una entrada al historial de versiones.
- **Regenerate** pide al agente que lo intente de nuevo.
- **Reject** (Rechazar) la desestima.

Si el texto cambió desde que se hizo la propuesta, la app te avisa antes de dejarte forzar la edición. Para activar o desactivar estos agentes, consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).

## Si no funcionó

- **La varita no hace nada o falla.** Comprueba que tienes una conexión de texto que funcione. Tu borrador nunca se sobrescribe si falla.
- **No hay botón de avatar con IA.** Primero añade una conexión de generación de imágenes.
- **Professor Mari no se puede eliminar.** Es un personaje integrado que Marinara restablece en cada inicio. Consulta [Professor Mari, tu asistente dentro de la app](../home/professor-mari.md).

## Guías relacionadas

- [Personas](personas.md)
- [Importar y exportar tarjetas de personaje](import-export.md)
- [Organizar tu biblioteca de personajes](library-organization.md)
