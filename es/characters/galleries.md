# Galerías de personaje y de persona

Esta guía cubre la pestaña **Gallery** (Galería) dentro de los editores de personaje y de persona. Explica cómo agregar imágenes y videos que quedan adjuntos a un personaje o una persona. También muestra cómo etiquetar una imagen de la galería como emoji o sticker personalizado.

## La pestaña Gallery

Cada personaje y cada persona tiene su propia pestaña **Gallery**. Abre un personaje en el **Character Editor** (Editor de personaje), o una persona en el **Persona Editor** (Editor de persona), y luego haz clic en la pestaña **Gallery** (icono de cámara).

La galería tiene dos subpestañas:

- **Images**: imágenes que subes para este personaje o persona.
- **Videos**: videos que subes, más los videos de escena y los clips de videollamada asociados a este personaje.

La galería de un personaje se titula **Character Gallery**. La galería de una persona se titula **Persona Gallery**. Ambas funcionan igual.

## En qué se diferencia la galería de la galería de un chat

Las imágenes de la galería pertenecen al personaje o la persona, no a un solo chat. Si borras un chat, estas imágenes de la galería se conservan. Usa la galería para hojas de referencia, variantes de vestuario o paquetes de imágenes de personaje importados.

La galería propia de un chat es distinta. Contiene ilustraciones específicas de la escena y los archivos adjuntos generados en los mensajes de ese único chat. Guarda el arte de escena de corta duración en la galería del chat. Guarda el arte de personaje duradero en la galería del personaje o la persona.

## Agregar imágenes

1. Abre el editor de personaje o de persona.
2. Haz clic en la pestaña **Gallery**.
3. Asegúrate de que la subpestaña **Images** esté seleccionada.
4. Arrastra archivos de imagen a la casilla **Upload Character Images** (Subir imágenes del personaje), o haz clic en ella para elegir archivos. En una persona, esta casilla se llama **Upload Persona Images**.
5. Espera a que termine la subida. Tus nuevas imágenes de la galería aparecen en la cuadrícula de abajo.

Puedes subir tipos de imagen comunes, como JPG, PNG, GIF, WebP y AVIF. Haz clic en cualquier imagen para abrir una vista más grande. Cada miniatura de imagen también tiene un control para descargar y un control para borrar.

## Agregar videos

1. Haz clic en la pestaña **Gallery**.
2. Selecciona la subpestaña **Videos**.
3. Arrastra archivos de video a la casilla **Upload Character Videos** (Subir videos del personaje), o haz clic en ella para elegir archivos. En una persona, esta casilla se llama **Upload Persona Videos**.
4. Espera a que termine la subida.

Los tipos de video admitidos son MP4, WebM y MOV. La subpestaña **Videos** también lista los videos de escena generados en chats con este personaje, más cualquier clip de videollamada. Se ordenan con el más reciente primero.

## Etiquetar una imagen de la galería como emoji o sticker personalizado

Puedes convertir una imagen de la galería en un emoji personalizado o un sticker para el **Conversation Mode** (el modo de chat estilo mensajería). Un emoji personalizado es una imagen pequeña en línea que se escribe como `:name:`. Un sticker es una imagen de bloque más grande que se escribe como `sticker:name:`. Estos solo funcionan en chats de Conversation Mode.

Para etiquetar una imagen:

1. Abre la pestaña **Gallery** y selecciona la subpestaña **Images**.
2. Busca la imagen que quieres. En su esquina superior izquierda hay un pequeño botón de etiqueta, con la tooltip (texto de ayuda) **Tag as emoji or sticker**.
3. Haz clic en el botón de etiqueta. Se abre un menú con **Make emoji** y **Make sticker**.
4. Haz clic en **Make emoji** o **Make sticker**.
5. En la ventana **Custom Emoji** o **Custom Sticker**, escribe un nombre y luego confirma.

El nombre usa letras minúsculas, números y guiones bajos, hasta 32 caracteres. Los demás caracteres se convierten por ti. Por ejemplo, "Big Grin" se convierte en `big_grin`.

Los límites de tamaño dependen del tipo que elijas, no de la galería. Una imagen de emoji no puede ser mayor que 256 por 256 píxeles. Una imagen de sticker no puede ser mayor que 512 por 512 píxeles. Si la imagen es demasiado grande, aparece un mensaje de error y la etiqueta no se aplica.

### Administrar una imagen etiquetada

Una vez que una imagen está etiquetada, su botón superpuesto muestra el nombre asignado. Haz clic en él para abrir un menú con más opciones:

- **Rename**: cambia el nombre.
- **Switch to sticker** o **Switch to emoji**: cambia de qué tipo es. El cambio vuelve a comprobar el límite de tamaño del nuevo tipo. Una imagen de sticker mayor que 256 por 256 píxeles es demasiado grande para convertirse en emoji. Si eso ocurre, aparece un error y el tipo se mantiene igual.
- **Remove emoji** o **Remove sticker**: quita la etiqueta de la imagen. Esto no borra la imagen de la galería.

### Dónde funcionan estos emojis y stickers de alcance limitado

Un emoji o sticker etiquetado en la galería tiene alcance limitado a ese único personaje o persona. Solo funciona en chats de Conversation Mode que incluyen a ese personaje o persona. Esto es independiente de los conjuntos globales de emojis y stickers que viven en el compositor de mensajes.

Si un nombre de la galería coincide con un nombre del conjunto global, la versión de la galería gana para ese chat. Los nombres no se comprueban para verificar que sean únicos. Elige un nombre distinto para cada imagen para evitar sorpresas.

## Reutilizar una imagen de la galería en mensajes y saludos

Cualquier imagen de la galería de un personaje se puede mostrar dentro del texto del chat: en un saludo, un mensaje de ejemplo o un mensaje que envíe el personaje. Pasa el puntero por la imagen y haz clic en **Copy image reference** (el icono de enlace). Esto copia un pequeño fragmento de Markdown que puedes pegar donde hable el personaje:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

La única regla es que **`self` significa el personaje que está pronunciando ese mensaje.** Cuando se renderiza, Marinara sustituye `self` por ese personaje y muestra la imagen de su galería.

Funciona en **First Message**, **Alternate Greetings** y **Example Dialogue** de la tarjeta; en cualquier mensaje de personaje tanto en Roleplay como en Conversation; y en chats grupales. En una respuesta con varios hablantes, `self` se resuelve por hablante. Si su galería no contiene el archivo, Marinara lo busca en las galerías de los demás personajes del chat.

Por diseño, no funciona en tus propios mensajes, porque no tienen personaje hablante, ni en mensajes del sistema, que no renderizan imágenes Markdown. Para publicar tú una imagen, usa el navegador de recursos del chat, que escribe la forma completa `card://characters/<id>/...`. Las galerías de persona usan `card://personas/<id>/gallery/<file>`.

Si dos personajes tienen imágenes con el mismo nombre de archivo, siempre gana la del hablante. Si el hablante no la tiene, se usa la primera coincidencia según el orden de personajes del chat. Usa nombres distintos si necesitas una versión concreta.

### Por qué usar `self` en vez del enlace completo

Un enlace completo contiene el id interno del personaje (`card://characters/<id>/gallery/<file>`), y ese id se vuelve a generar al importar el personaje; por eso el enlace se rompe al compartirlo. La forma `self` no contiene id ni dirección de servidor. Sobrevive a una **exportación e importación JSON nativa**: las imágenes viajan en la exportación y conservan sus nombres.

Una limitación: **las exportaciones de tarjetas PNG no incluyen la galería**. Comparte la exportación `.json` nativa cuando el personaje use referencias de galería.

## Guías relacionadas

- [Crear y editar personajes](creating-and-editing-characters.md)
- [Personas de usuario: crear y editar](personas.md)
- [Emojis, stickers y GIF personalizados](../conversation/emoji-stickers-gifs.md)
- [Fondos de escena y la galería](../media/scene-backgrounds.md)
