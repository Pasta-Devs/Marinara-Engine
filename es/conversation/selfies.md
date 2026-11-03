# Selfies

Una selfie es una imagen que un personaje genera de sí mismo y envía en un chat de Conversation, como una foto compartida en una app de mensajería. Esta guía cubre cómo activar las selfies, elegir su aspecto, pedir una a mano y los mensajes de video.

Las selfies provienen del paquete opcional **Illustrator** y usan la generación de imágenes. Cada selfie es una solicitud de imagen al servicio que elijas, así que se mantienen desactivadas hasta que las actives. Son distintas de las imágenes de escena de Roleplay y Game Mode.

## Activar las selfies

Antes de empezar: instala **Illustrator** desde **Agents → Agent Organizer** (Organizador de agentes) y añade una cuenta de imágenes, que es una cuenta de un servicio que hace imágenes (consulta [Proveedores de imágenes y configuración](../media/image-providers.md)).

1. Abre un chat de Conversation y luego abre **Chat Settings** (Ajustes del chat).
2. Busca la sección **Agents** y abre **Illustrator Settings**.
3. Activa **Generated Selfies**. Los ajustes de selfies aparecen debajo.
4. En **Selfie model**, elige tu cuenta de imágenes.

Activar **Generated Selfies** también activa el interruptor general **Commands** del chat.

Los personajes envían selfies solo cuando **Selfie model** está definido. Hasta entonces el chat muestra "Choose a Selfie Provider to let characters generate selfie images."

Si no funcionó: **Illustrator Settings** solo se muestra cuando Illustrator está instalado. Una selfie también necesita el comando **Selfies** (consulta [Elegir qué Commands puede usar un personaje](getting-started.md#choose-which-commands-a-character-can-use)).

## Ajustes de selfies

Todos estos están en **Illustrator Settings** y se aplican solo a este chat.

- **Selfie model**: la cuenta de imágenes que dibuja la imagen. El valor predeterminado es **None (selfies disabled)**.
- **Prompt Model**: el modelo de texto que escribe la descripción de la imagen. El valor predeterminado es **Agent default**.
- **Image Style**: un conjunto guardado de palabras de estilo artístico, como "anime". El valor predeterminado es el estilo predeterminado de Style Profiles en los ajustes avanzados. Consulta [Perfiles de estilo de imagen](../media/style-profiles.md).
- **Images Per Generation**: cuántas variantes hacer para cada ilustración o selfie.
- **Resolution**: el tamaño de la imagen. Solo se muestra después de definir **Selfie model**. El valor predeterminado es **896x1152**.
- **Send Avatar References**: envía el avatar o el sprite del personaje como imagen de referencia. Desactivado de forma predeterminada. Funciona solo si el servicio de imágenes acepta imágenes de referencia.
- **Attach Card Appearance**: añade al prompt el texto de **Appearance** de la tarjeta de cada personaje nombrado. Desactivado de forma predeterminada.

Opciones de **Resolution**: 512x512, 512x768, 768x768, 768x1024, 896x1152 y 1024x1024. 896x1152 es un retrato alto que sirve para la mayoría de las selfies.

**Send Avatar References** y **Attach Card Appearance** ofrecen cada uno **Off**, **Images only**, **Videos only** e **Images and videos**.

Si la tarjeta o la persona tiene **Image Appearance Override** activado (en **Appearance** en el editor), Marinara envía ese texto en lugar de **Appearance**. Úsalo cuando **Appearance** esté escrito para la historia y no para las imágenes.

## Pedir una selfie a mano

1. Abre **Chat Settings** y expande la sección **Gallery**.
2. Haz clic en **Selfie**. Con más de un personaje, elige quién la toma en la lista junto al botón.
3. Si **Expose media prompts before sending** está activado (**Settings → Generations → Overall Generations**), revisa o edita el prompt y haz clic en **Generate**. Cancelar no envía ninguna solicitud.
4. Espera mientras el botón dice **Generating...**. Verás "Selfie generated." y la imagen aparece en el chat. Una solicitud manual usa **Selfie model** y cuesta una solicitud de imagen.

## Cómo envían selfies los personajes

Un personaje decide por su cuenta cuándo enviar una selfie. Tú no escribes nada. Marinara genera la imagen y la publica, y las respuestas posteriores ven una nota corta de lo que mostraba.

Si no funcionó: cuando veas el texto literal `[selfie...]` en un mensaje, comprueba que el chat está en Conversation Mode, que **Commands** y **Selfies** están activados, que **Generated Selfies** está activado y que **Selfie model** está definido. Si la generación empieza pero falla, lee el error sobre la cuenta de imágenes.

## Hacer una selfie de nuevo

1. Haz clic en una selfie del chat para abrirla.
2. Haz clic en **Regenerate image** (la flecha circular junto al botón del pin).
3. Edita los prompts si quieres, incluidos los **Character prompts**. Elige un **Image model**, o conserva el **Chat's image provider**.
4. Haz clic en **Generate image**.

La imagen nueva reemplaza a la anterior en el mensaje. La anterior se queda en la Gallery. Cada intento es una solicitud de imagen. Las imágenes hechas antes de que existiera esta opción usaron la cuenta de selfies del chat, y sus prompts negativos y de personajes no se guardaron.

<a id="video-messages"></a>

## Mensajes de video

Un personaje puede enviar un mensaje de video corto. Instala primero Illustrator. Las selfies pueden quedar desactivadas.

Para pedir uno tú, escribe `/video`, o `/video Aster` para elegir un personaje. O haz clic en **Video** en la **Gallery** del chat, que usa el personaje elegido allí. El clip llega como un mensaje nuevo y se reproduce en el chat. Muestra lo más reciente de la conversación: el modelo que lo escribe lee tantos mensajes recientes como Illustrator lee para una imagen (su **Agent Budget**). También puedes animar una imagen de la Gallery. El clip continúa esa imagen y se une a la respuesta más reciente.

Si un clip no se puede añadir al chat, igualmente se guarda en la pestaña **Videos** de la Gallery. La galería propia de un personaje solo enumera un video cuando el clip muestra a ese personaje (consulta [Galerías de personajes y personas](../characters/galleries.md)).

### Ajustes de video

Abre **Chat Settings → Agents → Illustrator Settings**, **Video messages**.

- **Generated Videos**: deja que los personajes envíen mensajes de video por su cuenta. Desactivado de forma predeterminada en los chats nuevos, porque cada clip es una solicitud de video. También necesita **Videos** en la lista de **Commands**.
- **Video Run Interval**: se muestra una vez que **Generated Videos** está activado. Cuántos mensajes deben pasar entre clips. **0** los detiene.
- **Video model**: la cuenta de video. **Default video provider** usa tu valor predeterminado.
- **First frame**: la imagen desde la que empieza el clip (abajo).

`/video` y el botón **Video** de la Gallery funcionan de ambas formas e ignoran el intervalo. Hacer swipe en una respuesta que envió un clip permite que el nuevo swipe envíe el suyo. En un chat grupal cada personaje puede enviar un clip por respuesta, hasta **Videos per reply** (3 de forma predeterminada) en **Settings → Generations → Video Generation**.

Opciones de **First frame**:

- **New selfie, or the avatar if no selfie provider** (predeterminada): una selfie nueva cuando las selfies están activadas y **Selfie model** está definido, y si no, el avatar.
- **New selfie, then animate it**: siempre una selfie nueva, que también se guarda en la Gallery. Necesita las selfies activadas y **Selfie model**.
- **Avatar or sprite**: el avatar, o un sprite de cuerpo completo si no hay avatar.
- **Prompt only (no picture)**: sin imagen. Algunos flujos de trabajo de ComfyUI fallan sin una. Si **Send Avatar References** incluye videos, esto lee **Prompt only (avatar from Send Avatar References)** y empieza desde el avatar.

Con **Expose media prompts before sending** activado, revisas el prompt de la selfie junto con el prompt del clip.

Las imágenes en otros formatos, como WebP, se convierten para el servicio de video. Un mensaje de video es una solicitud de video, más una solicitud de imagen cuando empieza desde una selfie nueva. Tu **Prompt Model** escribe el prompt del video, y **Settings → Generations → Video Generation Prompt Overrides → Conversation Video Message** contiene sus instrucciones.

## Referencia: la etiqueta de selfie

Los personajes piden una selfie con una etiqueta en su respuesta. Tú nunca la escribes. Tiene este aspecto: `[selfie]`, opcionalmente con contexto:

```text
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]` y `[selfie: standing beside the river]` también funcionan, en cualquier combinación de mayúsculas y minúsculas. Marinara quita la etiqueta y publica la imagen.

## Guías relacionadas

- [Conversation Mode: primeros pasos](getting-started.md)
- [Proveedores de imágenes y configuración](../media/image-providers.md)
- [Perfiles de estilo de imagen](../media/style-profiles.md)
