# Fondos de escena y la galería

Los fondos de escena generados por IA son imágenes de fondo que Marinara Engine crea desde la **Gallery** (Galería). Esta guía muestra cómo crear uno, qué guarda la galería y cómo volver a dibujar o revisar una imagen. Para la biblioteca de subidas elegidas a mano, consulta [Fondos de chat](../appearance/chat-backgrounds.md). Para el agente que elige un fondo en cada turno, consulta [Fondos de roleplay](../roleplay/backgrounds.md).

## Dónde funcionan los fondos de escena

Los fondos de escena funcionan en los modos Roleplay y Game. No están disponibles en el modo Conversation. Si intentas generar uno en el modo Conversation, la app muestra este mensaje:

```
Scene background generation is available in Roleplay and Game modes.
```

Antes de empezar: necesitas un modelo de imagen. Configura uno primero si aún no lo has hecho. Consulta [Proveedores de generación de imágenes y configuración](image-providers.md).

## Generar y aplicar un fondo desde la galería

La **Gallery** guarda las imágenes y los videos del chat. Es una sección de **Chat Settings** (Ajustes del chat). En una computadora puedes sacarla a su propia ventana (consulta [Vista general de Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window)). Su botón **Background** (Fondo) crea el fondo de la escena actual.

En Roleplay, el botón **Background** aparece en cuanto el agente **Illustrator** está instalado. No necesitas añadirlo al chat ni activar los agentes. Igual que **Illustrate** (Ilustrar), se ejecuta una vez y no inicia ejecuciones automáticas.

Para generar un fondo:

1. Abre la sección **Gallery** de **Chat Settings**.
2. Haz clic en el botón **Background**.
3. La etiqueta del botón cambia a **Generating...** mientras se crea la imagen.
4. Un mensaje de estado dice "AI background generation is running. The new background will be applied when it finishes."
5. Cuando termina, la nueva imagen se aplica a la escena actual de inmediato, y "Background generated." lo confirma.

El fondo se construye a partir de tu escena actual. En un juego, esto incluye el género, el escenario, la ubicación, el clima y la hora del día. Los fondos generados usan el tamaño de lienzo **Backgrounds**, que es de 1280 por 720 píxeles de forma predeterminada. Puedes cambiar ese tamaño en **Settings** (Configuración), luego **Generations**, luego **Image Generation**.

Si no funcionó: si Marinara no encuentra ningún modelo de imagen para usar, el paso falla con este mensaje:

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

Para solucionarlo, establece la tarea **Images** (Imágenes) en la página **Jobs** (Tareas) del panel **Connections** (Conexiones), o dale al agente **Illustrator** su propio modelo de imagen.

## La sección Gallery

La **Gallery** tiene dos pestañas, **Images** y **Videos**. Cada pestaña muestra un recuento de cuántos elementos contiene. La pestaña **Videos** contiene los videos de escena en los chats de Roleplay y de Game, y los mensajes de video en los chats de Conversation.

En la parte superior de la sección, los botones de acción solo aparecen cuando la función correspondiente aplica al chat:

- **Illustrate**: ejecuta el agente Illustrator para una imagen de escena puntual. Consulta [Agente Illustrator](illustrator-agent.md).
- **Selfie**: genera una selfie del personaje en el modo Conversation.
- **Background**: genera y aplica un fondo de escena, como se describió arriba.
- **Video**: crea un video de escena a partir de la ilustración más reciente. En el modo Conversation, envía en cambio un mensaje de video de un personaje; consulta [Mensajes de video](../conversation/selfies.md#video-messages).
- **Create storyboard**: genera fotogramas clave del turno más reciente del Game Mode o del episodio de Roleplay terminado, cuando Storyboard (secuencia de viñetas) está activo.
- **Browse Images**: abre un explorador de imágenes guardadas para insertar.
- **View storyboard**: abre el storyboard más reciente del Game Mode.

Debajo de los botones está la zona de arrastre **Upload Images** (Subir imágenes). Arrastra imágenes sobre ella para añadir tus propias fotos a la galería de este chat.

### Acciones por imagen

Mueve el cursor sobre una imagen en la pestaña **Images**, o tócala en el teléfono, para ver sus acciones:

- Abre la imagen a tamaño completo (**Open gallery image**).
- **Pin to chat**: fija la imagen al chat como una imagen flotante. Arrástrala para moverla y usa el tirador de su esquina para cambiar su tamaño. Conserva su lugar y su tamaño cuando recargas la página en este navegador. El botón de candado junto al botón de descartar impide que se mueva o cambie de tamaño hasta que la desbloquees.
- **Download image**: guarda la imagen en tu dispositivo.
- **Animate illustration**: convierte esa imagen en un video de escena.
- **Copy prompt**: copia el prompt (instrucciones enviadas a la IA) guardado de la imagen. Si la imagen no tiene un prompt guardado, esto muestra **No prompt saved** (Ningún prompt guardado) y queda desactivado.
- **Delete gallery image**: elimina la imagen después de que confirmes.

<a id="regenerating-an-image"></a>

### Regenerar una imagen

Puedes volver a crear una imagen generada sin regenerar la respuesta a la que pertenece. Esto funciona con las imágenes de la Gallery del chat que tienen un prompt guardado, como ilustraciones, selfies y fotogramas de storyboard.

1. Abre la imagen a tamaño completo, desde la Gallery o desde el mensaje en el que está.
2. Haz clic en **Regenerate image** (Regenerar imagen; el botón de flecha circular en la parte superior derecha de la imagen).
3. Cambia lo que quieras en los cuadros debajo de la imagen: **Prompt**, **Negative prompt** (Prompt negativo), un cuadro para cada personaje en **Character prompts** (Prompts de personajes) cuando la imagen los tenía, y el modelo de imagen.
4. Haz clic en **Generate image** (Generar imagen), o en **Cancel** (Cancelar) para dejar la imagen como está.

La imagen nueva pasa a ser la versión seleccionada en el mensaje. Los resultados anteriores se mantienen juntos en una sola ficha de la Gallery con un recuento de versiones. Cada versión conserva su prompt, su prompt negativo y los demás detalles de generación guardados. Las imágenes de referencia se vuelven a enviar a partir de los avatares actuales de los personajes, seguidas de las imágenes de las entradas de lorebook (libro de trasfondo) con las que se dibujó la imagen por primera vez. Stability AI, Arli AI, SD Web UI y Draw Things no reciben imágenes de entradas. Algunas imágenes antiguas no guardaron su prompt negativo ni sus prompts de personaje; el editor lo indica cuando es así.

### Versiones de imagen

Abre una imagen apilada para elegir una versión. En una Gallery, las flechas de izquierda/derecha, las teclas de flecha y los gestos de deslizamiento horizontal permiten moverte entre las fichas. Si abres una imagen desde un mensaje del chat, te quedas dentro de la pila de esa imagen. Los controles de arriba/abajo, las teclas de flecha y los gestos de deslizamiento vertical sobre la imagen permiten moverte entre las versiones de la pila actual. Reduce el zoom antes de navegar. Desplazarte por el prompt no cambia de versión.

Haz clic en la imagen, el encabezado del prompt o el botón para contraerlo para usar las flechas arriba/abajo con las versiones. Haz clic en el texto del prompt o en un botón de copiar para usar las flechas arriba/abajo para desplazarte por el texto. Los controles de versión también siguen visibles mientras regeneras o editas. Aplica o borra la máscara pintada antes de cambiar de versión; los controles se pausan mientras se genera la imagen.

La versión que elijas se guarda y se muestra en el chat, incluso después de recargar. Regenerar o editar una versión anterior agrega un resultado nuevo a la misma pila y conserva también las versiones posteriores. Una rama del chat tiene su propia selección.

Con **Automatically save generated images to character galleries** (Guardar automáticamente las imágenes generadas en las galerías de personajes) activado, las regeneraciones y las ediciones conservan las galerías de personaje y de persona a las que iba la imagen original. Esas galerías también agrupan las versiones. Cada galería guarda su propia versión seleccionada, así que explorarla no cambia la imagen seleccionada en el chat. Las entradas de las galerías comparten los archivos de imagen guardados; no crean copias adicionales. Al abrir una galería también se recuperan las versiones que faltan de pilas de chat antiguas, cuando su entrada original de la galería sigue enlazada al chat de origen. Las versiones que se eliminan de una galería ya agrupada siguen eliminadas.

En la Gallery del chat, usa **Delete gallery image** (Eliminar imagen de la galería) en la ficha, o el botón de eliminar del visor, para elegir qué quitar:

- **Delete this version** (Eliminar esta versión) elimina la versión mostrada. Si era la seleccionada, se muestra la más reciente de las que quedan.
- **Delete other versions** (Eliminar las otras versiones) conserva la versión mostrada y elimina las demás.
- **Delete entire stack** (Eliminar toda la pila) elimina todas las versiones y sus imágenes adjuntas del chat.

Estas opciones eliminan permanentemente las versiones guardadas. **Cancel** las conserva todas.

## Revisar un prompt antes de enviarlo

Puedes comprobar y editar el prompt antes de que Marinara envíe una petición de fondo a tu servicio de imágenes.

1. Abre **Settings**, luego **Generations**, luego **Overall Generations** (Generaciones generales).
2. Activa **Expose media prompts before sending**.

Con este ajuste activado, se abre una ventana **Review Image Prompt** antes de que se envíe cada petición. Su texto de ayuda dice: "Edit the prompt below before Marinara sends the image request to your provider."

En la ventana, puedes:

- Editar el texto del prompt y el prompt negativo.
- Ver el tipo y el tamaño de la imagen, además de un recuento de caracteres en vivo.
- Hacer clic en **Cancel** para detener, o en **Generate** para enviar.

Si alguna casilla de prompt está vacía, **Generate** queda desactivado y ves esta nota: "Every image request needs a prompt." El texto que escribes se envía exactamente como está escrito.

## Gestionar tus fondos guardados

Cada fondo de escena que generas se guarda en tu biblioteca de fondos. También puedes añadir tus propias imágenes a esa misma biblioteca. Los fondos subidos aceptan archivos JPG, PNG, GIF, WebP y AVIF, de hasta 20 MB cada uno.

Puedes etiquetar, renombrar y eliminar los fondos que hayas añadido. Las etiquetas van en minúsculas y pueden contener letras, números, espacios, guiones y guiones bajos, hasta 40 caracteres cada una. Los fondos de recursos de juego integrados aparecen junto a los tuyos, pero no puedes renombrarlos, etiquetarlos ni eliminarlos.

Gestionas esta biblioteca y defines un fondo por chat o predeterminado desde los ajustes de apariencia. Para la biblioteca completa, el selector y **Background Blur**, consulta [Fondos de chat](../appearance/chat-backgrounds.md).

## Guías relacionadas

- [Fondos de chat](../appearance/chat-backgrounds.md): la biblioteca de subidas de la que eliges a mano.
- [Fondos de roleplay](../roleplay/backgrounds.md): el agente que elige un fondo automáticamente en cada turno.
- [Agente Illustrator](illustrator-agent.md): ilustraciones de escena para los modos Roleplay y Game.
- [Proveedores de generación de imágenes y configuración](image-providers.md): configura un modelo de imagen.
- [Generación de videos de escena](scene-video.md): convierte una imagen de la galería en un video.
