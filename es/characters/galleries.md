# Galerías de personaje y de persona

La sección **Gallery** (Galería) de la pestaña **Images** (Imágenes) de los editores de personaje y de persona guarda imágenes y videos adjuntos a un personaje o una persona, así que se conservan aunque borres chats. Úsala para hojas de referencia, variantes de atuendo y paquetes de imágenes importados. También puedes crear nuevas imágenes con IA y etiquetar una imagen de la galería como emoji o sticker personalizado.

## Encontrar la galería

Cada personaje y cada persona tiene su propia galería. Abre el personaje en el Character Editor o la persona en el Persona Editor. Haz clic en la pestaña **Images** y luego en **Gallery** en la parte superior. La galería de un personaje se titula **Character Gallery**, y la de una persona, **Persona Gallery**. Ambas funcionan igual.

La galería tiene dos subpestañas:

- **Images** (Imágenes) contiene las imágenes que subes.
- **Videos** contiene los videos que subes, más los videos de escena y los clips de videollamada asociados a este personaje.

La galería propia de un chat es distinta. Contiene las ilustraciones de escena y los archivos adjuntos generados de ese único chat. Guarda allí el arte de escena de corta duración, y aquí el arte duradero.

### Agregar imágenes

1. Abre **Images → Gallery** y selecciona **Images**.
2. Arrastra archivos de imagen a **Upload Character Images** (Subir imágenes del personaje), o haz clic en esa casilla para elegir archivos. En una persona, la casilla dice **Upload Persona Images** (Subir imágenes de la persona).
3. Espera a que termine la subida. Las nuevas imágenes aparecen en la cuadrícula.

Haz clic en una imagen para verla más grande. Cada miniatura tiene un control para descargar y un control para borrar.

### Agregar videos

1. Abre **Images → Gallery** y selecciona **Videos**.
2. Arrastra archivos de video a **Upload Character Videos** (Subir videos del personaje), o haz clic en esa casilla para elegir archivos. En una persona, la casilla dice **Upload Persona Videos** (Subir videos de la persona).
3. Espera a que termine la subida.

Los tipos admitidos son MP4, WebM y MOV. Los videos más recientes aparecen primero. Para ver qué videos de escena y qué clips aparecen para cada personaje, consulta [Qué videos aparecen en la lista](#which-videos-are-listed).

## Crear imágenes con IA

**Create with AI** (Crear con IA) en la galería crea nuevas imágenes para este personaje o persona con tu conexión de generación de imágenes. Elige qué crear en **Type** (Tipo):

| Tipo                                    | Qué obtienes                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Character sheet** (Hoja de personaje) | Una hoja de referencia, guardada de la misma forma que desde la sección **Character Sheet** (Hoja de personaje).                    |
| **Background** (Fondo)                  | Una imagen panorámica de un lugar, que parte del escenario de la tarjeta. Se guarda en la galería y se etiqueta como fondo de chat. |
| **Sticker sheet** (Hoja de stickers)    | Una imagen con varios stickers, recortada para obtener un sticker por imagen.                                                       |
| **Emoji sheet** (Hoja de emojis)        | Lo mismo, pero con emojis pequeños de caras.                                                                                        |

Antes de empezar: agrega una conexión de generación de imágenes.

1. Abre **Images → Gallery** y haz clic en **Create with AI**.
2. Elige un **Type** y edita el prompt (las instrucciones enviadas a la IA) si quieres un aspecto o un lugar diferente.
3. Para una hoja de stickers o emojis, escribe los nombres en **Stickers to draw** (Stickers para dibujar) o **Emoji to draw** (Emojis para dibujar), separados por comas. En una hoja caben hasta 16.
4. Haz clic en **Generate** (Generar).
5. Haz clic en **Save as Background** (Guardar como fondo), **Save Stickers** (Guardar stickers) o **Save Emoji** (Guardar emojis), o en **Save as Character Sheet** (Guardar como hoja de personaje).

### Corregir el recorte de una hoja

Después de generar una hoja de stickers o emojis, se encuentra cada sticker por su contorno, se elimina su fondo verde y aparece en su propia miniatura con su nombre. En un modelo que dibuja imágenes transparentes (consulta [Fondos transparentes](../media/image-providers.md#transparent-backgrounds)), se pide que la hoja tenga un fondo transparente, con verde solo como respaldo, y una hoja que llega transparente conserva los bordes tal como se dibujaron. Los stickers guardados miden como máximo 512 por 512 píxeles y los emojis, 256 por 256, y cada uno se etiqueta con su nombre.

- Haz clic en una miniatura para conservarla u omitirla. Las miniaturas omitidas no se guardan.
- Edita el nombre debajo de una miniatura para cambiarlo.
- Haz clic en **Recut with a box** (Volver a recortar con un recuadro) en una miniatura para colocar un recuadro sobre la hoja completa. Arrastra el recuadro, tira de sus esquinas o dibuja uno nuevo alrededor del sticker y luego haz clic en **Use this box** (Usar este recuadro).
- Haz clic en **Add a sticker** (Agregar un sticker) o **Add an emoji** (Agregar un emoji) para recortar uno que no se haya detectado.
- Haz clic en **Cut again** (Volver a recortar) para empezar el recorte de nuevo y deshacer tus recuadros.

### Escribir tú el prompt completo

El prompt que se envía al modelo de imágenes se construye a partir de los campos del cuadro de diálogo. Para cambiarlo por completo, por ejemplo, para pedir stickers de cosas que le gustan al personaje y no solo del personaje, haz clic en **Edit full prompt** (Editar el prompt completo). Se envía exactamente como lo escribes. Los cambios en los demás campos solo se agregan cuando haces clic en **Rebuild** (Reconstruir), que también reemplaza tus ediciones. Haz clic en el botón de cerrar junto a **Rebuild** para volver al prompt construido a partir de los campos.

## Etiquetar una imagen de la galería como emoji o sticker personalizado

Un emoji personalizado es una imagen pequeña en línea que se escribe como `:name:`. Un sticker es una imagen de bloque más grande que se escribe como `sticker:name:`. Ambos funcionan solo en los chats de Conversation Mode, el modo de estilo mensajería.

1. Abre **Images → Gallery** y selecciona **Images**.
2. Haz clic en el pequeño botón de etiqueta de la esquina superior izquierda de la imagen (con la descripción emergente **Tag as emoji or sticker**).
3. Haz clic en **Make emoji** (Crear emoji) o **Make sticker** (Crear sticker).
4. En el cuadro de diálogo **Custom Emoji** o **Custom Sticker**, escribe un nombre y confirma.

Un nombre usa de 1 a 32 letras minúsculas, números y guiones bajos. Los demás caracteres se convierten por ti, así que "Big Grin" se convierte en `big_grin`.

Si no funcionó: una imagen de emoji no puede superar los 256 por 256 píxeles, y una de sticker, los 512 por 512. Si la imagen es demasiado grande, aparece un error y no se etiqueta nada.

### Administrar una imagen etiquetada

Una vez que una imagen está etiquetada, su botón superpuesto muestra el nombre. Haz clic en él para ver más opciones:

- **Rename** (Renombrar) cambia el nombre.
- **Switch to sticker** o **Switch to emoji** cambia el tipo. Se comprueba el límite de tamaño del nuevo tipo, así que un sticker mayor que 256 por 256 no puede convertirse en emoji. Aparece un error y el tipo se mantiene.
- **Remove emoji** o **Remove sticker** quita la etiqueta de la imagen. La imagen se queda en la galería.

Un emoji o sticker etiquetado en la galería solo funciona para ese único personaje o persona, en los chats de Conversation Mode que lo incluyen. Esto es independiente de los conjuntos globales de emojis y stickers del compositor de mensajes. Si un nombre de la galería coincide con un nombre global, la versión de la galería tiene prioridad en ese chat. No se comprueba que los nombres sean únicos, así que elige un nombre distinto para cada imagen.

## Describir imágenes

Cualquier imagen de la galería puede tener una descripción breve de lo que muestra. Los chats de Conversation usan las descripciones de los emojis y stickers etiquetados para elegir cuáles ofrecer (consulta [Describir emojis y stickers](../conversation/emoji-stickers-gifs.md#describe-emojis-and-stickers)). La descripción se guarda con la imagen y viaja en una exportación **Marinara Native**.

- Para escribir una, haz clic en el botón de etiqueta de la esquina superior izquierda de la imagen y elige **Add description** (Agregar descripción), o **Edit description** (Editar descripción) para cambiarla.
- Para que la IA las escriba, haz clic en **Select images** (Seleccionar imágenes), elige las imágenes y luego haz clic en **Describe with AI** (Describir con IA). El modelo **Image reading** (Lectura de imágenes) mira cada una y escribe una descripción breve. Si algunas ya tienen una, elige entre describir solo las que no tienen descripción o volver a describirlas todas.

Antes de empezar: las descripciones de IA necesitan un modelo que pueda leer imágenes. Marinara usa el modelo **Image reading** si configuras uno en **Behind the scenes** (Entre bastidores) en los ajustes de tu conexión; de lo contrario, usa el modelo de tus agentes. Se envían hasta 8 imágenes a la vez, así que una selección grande tarda un momento.

La galería propia de un chat tiene la misma opción **Describe with AI** en su modo de selección.

<a id="reuse-a-gallery-image-in-messages-and-greetings"></a>

## Reutilizar una imagen de la galería en mensajes y saludos

Cualquier imagen de la galería de un personaje se puede mostrar dentro del texto del chat: un saludo, un mensaje de ejemplo o un mensaje que envíe el personaje. Pasa el puntero sobre una imagen de la galería y haz clic en **Copy image reference** (Copiar referencia de imagen; el icono de enlace). Copia un fragmento de Markdown para pegarlo donde hable el personaje:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

`self` significa el personaje que pronuncia ese mensaje. Cuando se muestra el mensaje, Marinara sustituye `self` por ese personaje y carga la imagen de su galería.

Funciona en:

- **First Message**, **Alternate Greetings** y **Example Dialogue** de la tarjeta del personaje. La vista previa de Markdown del campo muestra la imagen mientras editas.
- Cualquier mensaje que envíe un personaje, en el modo Roleplay y en el modo Conversation.
- Chats grupales. En una respuesta con varios hablantes, `self` se resuelve para cada hablante. Si la galería del hablante no tiene el archivo, Marinara lo busca en los demás personajes del chat, en el orden del chat. Si dos personajes tienen el mismo nombre de archivo, tiene prioridad la imagen del propio hablante.

No funciona en:

- **Tus propios mensajes**. No tienen personaje hablante, así que una referencia `self` se muestra como una imagen rota. Para publicar tú una imagen de un personaje, usa la opción de insertar del navegador de recursos del chat, que escribe la forma completa `card://characters/<id>/...`.
- **Mensajes del sistema**. No muestran imágenes de Markdown, así que la referencia se muestra como texto.
- **Galerías de persona**. Tus mensajes no tienen hablante, así que usa la forma de persona `card://personas/<id>/gallery/<file>`.

Un enlace completo contiene el id interno del personaje, y los ids se vuelven a generar al importar un personaje, así que los enlaces completos se rompen para cualquiera con quien compartas el personaje. La forma `self` no lleva id. Sobrevive a una exportación e importación **Marinara Native**, porque las imágenes de la galería viajan dentro de la exportación con sus nombres de archivo. Las exportaciones **Compatible PNG Card** y **Compatible JSON** no incluyen la galería, así que ninguna referencia de galería puede funcionar después de compartir de esa forma. Usa **Marinara Native** cuando un personaje use imágenes de la galería.

<a id="save-web-images-from-greetings"></a>

### Guardar imágenes web de los saludos

Muchas tarjetas muestran en sus saludos imágenes de otros sitios web, y esos enlaces pueden romperse. Cuando **First Message** o **Alternate Greetings** muestran imágenes web, **Dialogue & Greetings** (Diálogo y saludos iniciales) tiene un botón **Save images locally** (Guardar imágenes localmente).

1. Abre la pestaña **Card** (Tarjeta) y busca **Dialogue & Greetings**.
2. Haz clic en **Save images locally**. Marinara descarga las imágenes en la galería y cambia cada enlace por una referencia `card://self/gallery/...`.
3. Haz clic en **Save** (Guardar) para conservar los enlaces nuevos.

No se descarga nada hasta que haces clic en el botón. Solo se guardan imágenes PNG, JPEG, GIF y WebP de hasta 10 MB y 40 megapíxeles. Se rechazan los enlaces a tu propia computadora o a tu red doméstica. Una imagen que no se puede guardar conserva su enlace web, y un aviso explica por qué.

**Restore web links** (Restaurar enlaces web) vuelve a poner los enlaces originales en los saludos. Las copias guardadas permanecen en la galería hasta que las borres. Las imágenes de los lorebooks quedan fuera de esta función.

<a id="which-videos-are-listed"></a>

## Qué videos aparecen en la lista

La subpestaña **Videos** muestra los videos de escena generados en chats con este personaje, y los clips de videollamada. Qué personaje muestra un video depende de su origen:

- Un mensaje de video de Conversation aparece en la lista de los personajes que muestra: el que lo envió y cualquiera que nombre. Basta con un nombre de pila cuando nadie más en el chat lo comparte, siempre que esté escrito con mayúscula inicial. Se incluye a todos los del chat cuando el texto pide una foto o un selfie de grupo. Los nombres entre comillas no cuentan.
- La galería de tu persona muestra un clip solo cuando nombra a tu persona.
- Los videos más antiguos, y los videos de chats de Roleplay y Game Mode, aparecen para todos los personajes y la persona de su chat.

## Guías relacionadas

- [Crear y editar personajes](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Emojis, stickers y GIF personalizados](../conversation/emoji-stickers-gifs.md)
- [Fondos de escena y la galería](../media/scene-backgrounds.md)
