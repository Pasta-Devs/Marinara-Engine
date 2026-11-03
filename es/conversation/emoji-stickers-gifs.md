# Emojis, stickers y GIF personalizados

Sube tus propios emojis y stickers, busca GIF y controla qué emojis y stickers personalizados puede usar un personaje en sus respuestas. Estas herramientas funcionan solo en Conversation Mode (modo Conversación). Roleplay y Game Mode tienen el selector de emoji simple.

## Dónde encontrar estas herramientas

En un chat de Conversation, haz clic en el botón redondo de carita sonriente **Emoji, GIFs & stickers** junto al cuadro de mensaje. Encima se abre un panel (una hoja sobre el teclado en un teléfono). Sus pestañas son:

- **Emoji**: la cuadrícula de emoji estándar, más una pestaña con estrella **Custom emojis** para tus imágenes subidas.
- **GIFs**: búsqueda de GIF en vivo.
- **Kaomoji**: caras de texto como `(^_^)`.
- **Stickers**: tus stickers subidos.

También se muestra una pestaña **Tools** cuando hay otras herramientas de entrada activadas.

## Subir un emoji personalizado

Un emoji personalizado es una imagen pequeña que subes una vez y usas en cualquier chat de Conversation. En un mensaje que escribes se usa como un shortcode: el nombre entre dos puntos, como `:kekw:`.

1. Abre el panel, ve a **Emoji** y luego a la pestaña con estrella **Custom emojis**.
2. Haz clic en **Upload** y elige uno o más archivos de imagen.
3. En el cuadro de diálogo **Name this emoji**, escribe un nombre y haz clic en **Add**.

El emoji aparece en la cuadrícula **Custom emojis**.

Reglas:

- Un nombre tiene de 1 a 32 caracteres: letras minúsculas, números y guiones bajos. La app cambia los demás caracteres por ti.
- La imagen puede medir como máximo 256 por 256 píxeles. Los archivos GIF animados funcionan y se reproducen en el chat.
- Los nombres deben ser únicos. Un nombre ya usado muestra `An emoji named ":name:" already exists.`

Si no funcionó: comprueba el nombre y el tamaño de la imagen con las reglas de arriba.

## Usar un emoji personalizado

Haz clic en un icono de la cuadrícula **Custom emojis**. Esto inserta su shortcode en tu mensaje y no lo envía. También puedes escribir el shortcode, en minúsculas, exactamente como se guardó.

En un chat de Conversation, un shortcode se muestra como una pequeña imagen en línea. Un mensaje formado solo por shortcodes de emoji los muestra más grandes. Si el nombre ya no existe, por ejemplo después de borrarlo, el mensaje muestra el texto sin formato `:kekw:`.

## Renombrar, borrar, exportar e importar

Haz clic en **Edit** en la parte superior de la pestaña **Custom emojis** para activar el modo de edición.

- Haz clic en un icono para abrir **Rename emoji** y luego haz clic en **Rename**.
- Haz clic en la insignia de la papelera de un icono para borrarlo. **Delete emoji** avisa de que los mensajes que lo usaron mostrarán el texto en su lugar.
- Haz clic en **Export** para descargar todos tus emojis personalizados como `marinara-custom-emojis.json`. Las imágenes van dentro del archivo.
- Haz clic en **Import** para cargar un archivo exportado. Omite los emojis que incumplen las reglas de nombre o de tamaño o que chocan con uno existente.

## Stickers personalizados

Un sticker es una imagen más grande que se muestra en su propia línea. Normalmente haces clic en él en la pestaña **Stickers**; el texto `sticker:name:` es lo que se inserta. En la pestaña **Stickers**, haz clic en **Upload** y usa **Edit**, **Export** e **Import** como con los emojis. Las diferencias:

- El cuadro de diálogo de subida es **Name this sticker**.
- La imagen más grande mide 512 por 512 píxeles (emojis: 256 por 256).
- El archivo de exportación es `marinara-custom-stickers.json`.

Para enviar un sticker, haz clic en su icono. El cuadro de diálogo **Send sticker** ofrece:

- **Send & reply**: publica el sticker como su propio mensaje y deja que el personaje responda.
- **Add to message**: pone el texto `sticker:name:` en tu mensaje para que puedas seguir escribiendo.

## Buscar GIF

La pestaña **GIFs** busca en Giphy, una biblioteca de GIF en línea. Escribe en el cuadro de búsqueda o explora la lista de tendencias, y luego haz clic en un GIF para enviarlo.

Antes de empezar: la búsqueda de GIF necesita una API key (clave de API) gratuita de Giphy. Una clave es un código secreto que permite a Marinara usar el servicio de Giphy por ti. Sin ella, la pestaña muestra una tarjeta de configuración. Definirla significa editar el archivo `.env`, que es el archivo de ajustes en texto sin formato de Marinara. Está en la carpeta del proyecto de Marinara, o en `/app/data/.env` en Docker (consulta [Editar el archivo .env](../CONFIGURATION.md#edit-the-env-file)).

1. Abre el panel de desarrolladores de Giphy en `https://developers.giphy.com/dashboard/`.
2. Crea una API key para una app web y cópiala.
3. Abre el archivo `.env` en un editor de texto.
4. Añade esta línea al final, con tu clave en lugar de `your_key_here`, y guarda el archivo:

   ```text
   GIPHY_API_KEY=your_key_here
   ```

5. Reinicia Marinara. Eso significa detenerla y volver a iniciarla de la forma en que la inicias normalmente (consulta [Instalación](../INSTALLATION.md)).

Los resultados de GIF usan la clasificación para adultos de Giphy. No puedes cambiarla en la app, así que los resultados pueden incluir GIF para adultos. No hay ninguna fuente de GIF solo seguros.

## Etiquetar una imagen de la galería como emoji o sticker

Cualquier imagen de una Character Gallery o una Persona Gallery puede convertirse en un emoji o un sticker. Funciona solo en los chats que incluyen ese personaje o persona.

1. Abre el **Character Editor** o el **Persona Editor**.
2. Abre la pestaña **Gallery** y luego la subpestaña **Images**.
3. Pasa el cursor sobre una imagen y haz clic en el botón de etiqueta de su esquina superior izquierda.
4. Elige **Make emoji** o **Make sticker**.
5. En el cuadro de diálogo **Custom Emoji** o **Custom Sticker**, escribe un nombre.

El botón de etiqueta ahora muestra el nombre. Se aplican las mismas reglas de tamaño, y una imagen demasiado grande muestra un borde rojo. Para cambiarlo más tarde, haz clic en el botón de etiqueta de nuevo para ver **Rename**, una opción de cambio como **Switch to sticker**, o una opción de quitar como **Remove emoji**. La imagen también sigue siendo una imagen normal de la galería.

## Preferencias de selección

Marinara le dice al personaje que responde qué emojis y stickers personalizados puede usar. Para cambiar cómo los elige, haz clic en el engranaje **Selection preferences** en la parte superior de la pestaña **Custom emojis** o **Stickers**. Ambos abren el mismo ajuste, guardado por chat.

- **Semantic** (predeterminada): ofrece los que mejor encajan con la conversación reciente. Usa un modelo pequeño en tu propia computadora. Si eso no está disponible, elige al azar.
- **Random**: ofrece un conjunto aleatorio en cada respuesta.
- **Tool-call**: un modelo elige los adecuados en cada respuesta. Elige un modelo en **Select a model...**. Si no hay ninguno definido o falla, usa el modo semántico. Se omite cuando varios personajes responden en un mismo turno grupal.

**Max offered (each)** es cuántos nombres de emoji y cuántos nombres de sticker se ofrecen por turno. El valor predeterminado es 20, de 1 a 100.

## Las reacciones usan solo tus emojis personalizados principales

Puedes reaccionar a un mensaje con un emoji personalizado, pero solo con los emojis que subiste en la pestaña **Custom emojis**. Los emojis, stickers y GIF etiquetados desde la galería no están disponibles como reacciones. Consulta [Reaccionar y recibir avisos](getting-started.md#react-and-get-notified).

## Guías relacionadas

- [Conversation Mode: primeros pasos](getting-started.md)
- [Galerías de personajes y personas](../characters/galleries.md)
- [Referencia de configuración del servidor](../CONFIGURATION.md)
