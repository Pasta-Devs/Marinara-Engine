# Fondos de escena y la galería

Esta guía cubre los fondos de escena generados por IA, las imágenes de fondo que Marinara Engine crea para ti desde la **Gallery** (Galería), y la propia galería. Existen dos guías relacionadas: [Fondos de chat](../appearance/chat-backgrounds.md) cubre la biblioteca de subidas elegidas a mano, y [Fondos de roleplay](../roleplay/backgrounds.md) cubre el agente que elige un fondo automáticamente en cada turno.

## Dónde funcionan los fondos de escena

Los fondos de escena funcionan en los modos Roleplay y Game. No están disponibles en el modo Conversation. Si intentas generar uno en el modo Conversation, la app muestra este mensaje:

```
Scene background generation is available in Roleplay and Game modes.
```

Para generar un fondo necesitas una conexión de **Image Generation** (Generación de imágenes). Configura una primero si aún no lo has hecho. Consulta [Proveedores de generación de imágenes y configuración](image-providers.md).

## Generar y aplicar un fondo desde la galería

La **Gallery** guarda las imágenes y los videos del chat. Es una sección de **Chat Settings**: abre Chat Settings y despliega Gallery. En una computadora puedes sacarla a su propia ventana; consulta [Vista general de Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window). El botón **Background** (Fondo) genera el fondo de la escena actual.

Para generar un fondo:

1. Abre la sección **Gallery** de **Chat Settings**.
2. Haz clic en el botón **Background**.
3. La etiqueta del botón cambia a **Generating...** mientras se crea la imagen.
4. Deberías ver este mensaje de estado: "AI background generation is running. The new background will be applied when it finishes."
5. Cuando termina, la nueva imagen se aplica a la escena actual de inmediato. Un mensaje "Background generated." lo confirma.

El fondo se construye a partir de tu escena actual. En un juego, esto incluye el género, el escenario, la ubicación, el clima y la hora del día. Los fondos generados usan el tamaño de lienzo **Backgrounds**, que es de 1280 por 720 píxeles de forma predeterminada. Puedes cambiar ese tamaño en **Settings** (Configuración), luego **Generations**, luego **Image Generation**.

### Si no hay ninguna conexión de imagen configurada

Si Marinara no puede encontrar una conexión de imagen para usar, el paso de generación falla con este mensaje:

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

Para solucionarlo, abre el panel **Connections** (Conexiones), expande **Defaults**, y elige una conexión de imagen en **Images**, o define una conexión de imagen personalizada en el agente **Illustrator**.

## La sección Gallery

La **Gallery** tiene dos pestañas, **Images** y **Videos**. Cada pestaña muestra un recuento de cuántos elementos contiene. La pestaña **Videos** solo está disponible cuando los videos de escena están activados para el chat.

En la parte superior de la sección, los botones de acción solo aparecen cuando la función correspondiente aplica al chat:

- **Illustrate**: ejecuta el agente Illustrator para una imagen de escena puntual. Consulta [Agente Illustrator](illustrator-agent.md).
- **Selfie**: genera una selfie del personaje en el modo Conversation.
- **Background**: genera y aplica un fondo de escena, como se describió arriba.
- **Video**: crea un video de escena a partir de la ilustración más reciente.
- **Create storyboard**: genera fotogramas clave del turno más reciente del Game Mode o del episodio de Roleplay terminado, cuando Storyboard (secuencia de viñetas) está activo.
- **Browse Images**: abre un explorador de imágenes guardadas para insertar.
- **View storyboard**: abre el storyboard más reciente del Game Mode.

Debajo de los botones está la zona de arrastre **Upload Images** (Subir imágenes). Arrastra imágenes sobre ella para añadir tus propias fotos a la galería de este chat.

### Acciones por imagen

Mueve el cursor sobre cualquier imagen en la pestaña **Images**, o tócala en el teléfono o la tableta, para revelar sus acciones:

- Abre la imagen a tamaño completo (**Open gallery image**).
- **Pin to chat**: fija la imagen al chat.
- **Download image**: guarda la imagen en tu dispositivo.
- **Animate illustration**: convierte esa imagen en un video de escena.
- **Copy prompt**: copia el prompt (instrucciones enviadas a la IA) guardado de la imagen. Si la imagen no tiene un prompt guardado, esto muestra **No prompt saved** (Ningún prompt guardado) y queda desactivado.
- **Delete gallery image**: elimina la imagen después de que confirmes.

## Revisar un prompt antes de enviarlo

Puedes comprobar y editar el prompt antes de que Marinara envíe una petición de fondo a tu proveedor de imágenes.

1. Abre **Settings**, luego **Generations**, luego **Image Generation**.
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
- [Proveedores de generación de imágenes y configuración](image-providers.md): configura una conexión de imagen.
- [Generación de videos de escena](scene-video.md): convierte una imagen de la galería en un video.
