# Enviar mensajes y streaming

Esta guía cubre lo básico de cada chat en Marinara Engine. Explica cómo envías un mensaje, cómo la respuesta de la IA aparece en pantalla con streaming, y cómo detener o reintentar una respuesta. También cubre los archivos adjuntos, los indicadores de "pensamiento" y qué hacer cuando aparece un error de generación.

## Enviar un mensaje

La barra de entrada de mensajes está en la parte inferior de cada chat. Escribe tu texto en el cuadro y luego inicia la respuesta de la IA de una de estas dos formas:

1. Haz clic en el botón **Send** (Enviar) a la derecha de la barra de entrada.
2. O pulsa Enter, si **Send on Enter** (Enviar con Enter) está activado para ese modo de chat.

Deberías ver tu mensaje aparecer en la lista, seguido de la respuesta de la IA a medida que se genera.

Solo puede generarse una respuesta por chat a la vez. Mientras una respuesta está en streaming, el botón **Send** se convierte en un botón de detener, así que no puedes iniciar una segunda respuesta por accidente.

Enviar requiere una conexión que funcione. Una conexión es tu vínculo con un proveedor de IA (mira la guía relacionada abajo). Sin una, la respuesta falla de inmediato con un mensaje que dice que no hay ninguna conexión configurada para el chat.

### Send on Enter

El ajuste **Send on Enter** está en **Settings** (Configuración), en la pestaña **General**, en la sección **Input & Editing**. Tiene un interruptor por cada modo de chat:

| Modo de chat | Predeterminado | Qué hace Enter cuando está activado |
|---|---|---|
| Roleplay | Off | Enter envía el mensaje |
| Conversations | On | Enter envía el mensaje |
| Game | On | Enter envía el mensaje |

Cuando el interruptor de un modo está desactivado, pulsar Enter agrega una línea nueva en su lugar. Luego haces clic en **Send** para publicar el mensaje. Roleplay está desactivado de forma predeterminada porque los mensajes de roleplay suelen ser largos y necesitan saltos de línea.

## Adjuntar imágenes y archivos

Puedes adjuntar imágenes o archivos para que la IA los vea o los lea. Haz clic en el control de clip en la barra de entrada y elige un archivo. Los archivos adjuntos aparecen como pequeñas fichas sobre la entrada antes de que envíes.

Marinara acepta estos tipos de archivo:

- Imágenes.
- Archivos PDF.
- Archivos de texto plano: `.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml`, y `.yml`.

Cada archivo debe pesar 20 MB o menos. Un archivo más grande se rechaza con un aviso que dice que el archivo es demasiado grande. Un tipo de archivo no admitido se rechaza con un aviso que enumera los tipos permitidos.

La IA solo puede "ver" una imagen si el modelo conectado admite visión. Si tu modelo es solo de texto, activa **Image Captioning** (subtítulos de imagen). Este ajuste está en las **Chat Settings** (Ajustes del chat) de cada chat, en la sección **Advanced Parameters**, y está desactivado de forma predeterminada. Cuando está activado, Marinara describe cada imagen adjunta en texto usando una conexión que tú eliges, y luego envía esa descripción en lugar de la imagen sin procesar.

## Insertar una imagen de la galería en un mensaje

Los adjuntos sirven para que la IA los *vea*. Las referencias de galería sirven para que el lector las *vea*: muestran una imagen de la galería dentro del texto del mensaje.

Los mensajes admiten imágenes en Markdown y Marinara resuelve enlaces `card://` especiales a archivos de la galería:

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

En Roleplay Mode, el navegador de recursos del chat puede insertar uno de estos enlaces. También puedes pegarlo donde se escriba texto: mensajes, saludos y diálogos de ejemplo.

Para una imagen de la **propia galería del personaje**, usa preferentemente la forma portátil `card://self/gallery/<filename>`, que sigue funcionando después de exportar e importar el personaje. El botón **Copy image reference** de la galería la genera. Consulta [Galerías de personajes → Reutilizar una imagen de la galería en mensajes y saludos](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings) para conocer los detalles.

## Streaming de la respuesta

El streaming muestra la respuesta apareciendo palabra por palabra a medida que se genera, en lugar de esperar la respuesta completa de una vez. Los controles de streaming están en **Settings**, en la pestaña **General**, en la sección **Responses**:

| Ajuste | Predeterminado | Qué hace |
|---|---|---|
| **Enable streaming** | On | Muestra la respuesta palabra por palabra a medida que se genera |
| **Streaming speed** | 50 | Establece qué tan rápido se muestra en pantalla el texto en streaming |
| **Trim incomplete model endings** | Off | Recorta una frase final sin terminar antes de guardar |

**Streaming speed** es un control deslizante de 1 a 100. Un valor más bajo da un efecto de máquina de escribir más lento para que puedas leer a la par. Un valor más alto muestra el texto casi al instante. Marinara suaviza la entrega irregular de tokens (fragmentos de texto) mientras el modelo escribe, y luego usa la velocidad que elegiste para terminar la respuesta. Este ajuste no cambia qué tan rápido escribe el modelo en sí.

Cuando **Enable streaming** está desactivado, la respuesta completa aparece toda de una vez después de que el modelo termina.

**Trim incomplete model endings** solo afecta al mensaje guardado. Cuando está activado, Marinara elimina una frase final sin terminar de la respuesta. Deja intactas las respuestas completas y los finales con estilo de comando.

## Indicadores de escritura y progreso

Antes de que llegue la primera palabra de una respuesta, Marinara muestra que el personaje está trabajando. Ves el nombre del personaje con tres puntos animados. En un chat grupal, los nombres de todos los personajes que responden aparecen juntos.

Mientras el servidor prepara el prompt (las instrucciones enviadas a la IA), una breve línea de progreso pasa por estas etiquetas:

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Cada etiqueta corresponde a un paso que Marinara ejecuta antes o durante la respuesta. La línea desaparece en cuanto la primera palabra de la respuesta llega por streaming. Algunos pasos solo se ejecutan cuando un chat usa esa función, así que puede que no veas todas las etiquetas.

Si la presencia de un personaje está fijada en un estado de ocupado o ausente, aparece un indicador de espera en lugar de los puntos de escritura. La respuesta comienza en cuanto el personaje vuelve a estar disponible.

## Ver el pensamiento del modelo

Algunos modelos exponen un rastro de razonamiento oculto, a menudo llamado "pensamiento". Marinara lo mantiene separado de la respuesta visible.

Cuando una respuesta tiene pensamiento adjunto, aparece una acción **View thoughts** (Ver pensamientos) (un icono de cerebro) en ese mensaje. Haz clic en ella para abrir un panel que muestra el texto de razonamiento capturado.

Para que el razonamiento se muestre, el modelo debe devolverlo realmente. Algunos modelos envuelven su razonamiento en etiquetas de texto plano. Para esos, configura **Thinking Tags** (etiquetas de pensamiento) personalizadas en la conexión para que Marinara pueda separar el razonamiento oculto de la respuesta visible. Ya se reconocen varios pares de etiquetas comunes. Mira la guía de parámetros de generación abajo para saber cómo configurar **Thinking Tags**.

## Detener una respuesta

Para detener una respuesta que todavía se está generando, haz clic en el botón de detener. Este es el botón **Send**: mientras una respuesta está en streaming, su icono cambia a un símbolo de detener.

El texto que ya llegó por streaming antes de que detuvieras suele conservarse en pantalla. Detener a propósito nunca se muestra como un error.

## Reintentar sin volver a escribir

Si el último mensaje del chat es tuyo y la IA nunca respondió, no necesitas volver a escribirlo. Deja el cuadro de entrada vacío. Luego haz clic en el botón **Send** (o pulsa Enter) para iniciar una respuesta nueva sin agregar un mensaje duplicado. En Conversation Mode, el botón muestra una flecha circular de reintento mientras este estado está activo.

Reintentar solo funciona mientras el cuadro está vacío. Si escribiste un borrador, el botón envía ese borrador en su lugar.

En Roleplay hay un atajo relacionado. Pulsa **Send** con el cuadro vacío para animar a la IA a responder de nuevo, incluso después de que ya respondió. Esto siempre inicia una respuesta completamente nueva. No se suma a la respuesta anterior. Para extender la respuesta anterior en su lugar, usa el comando `/continue`, cubierto en la guía de acciones de mensaje abajo.

## Cuando aparece un error de generación

Si una respuesta falla, Marinara muestra una notificación toast en la parte inferior de la pantalla. El toast permanece unos 15 segundos, y puedes copiar su texto. Una respuesta detenida no se trata como un error.

Para algunos problemas comunes, Marinara reescribe el error sin procesar como un paso siguiente claro:

- Si el modelo rechaza un parámetro que no admite, el toast te dice cómo arreglarlo. Ve a **Chat Settings**, abre **Advanced Parameters** y desactiva **Send** para ese parámetro.
- Si el modelo requiere un parámetro que está desactivado, el toast te dice que lo vuelvas a activar. Ve al mismo lugar y activa **Send** para ese parámetro.
- Si la respuesta vuelve completamente vacía, el toast te dice que intentes enviar tu mensaje de nuevo.

Otros mensajes claros que puedes ver:

- Ya se está generando una respuesta para este chat. Espera a que termine, o detenla con el botón de detener.
- No hay ninguna conexión configurada para este chat. Configura una primero (mira la guía relacionada abajo).

Si un error sigue ocurriendo, la guía de solución de problemas abajo tiene más soluciones para problemas de errores de conexión y de generación.

## Conexiones lentas y pestañas en el teléfono

Una respuesta larga puede tardar un rato, y eso es normal. Puedes detener la respuesta en cualquier momento con el botón de detener.

En el teléfono, el navegador puede pausar una pestaña de chat cuando cambias a otra. Si la respuesta todavía estaba en streaming, Marinara muestra un estado **Finishing in background...** (Terminando en segundo plano). Luego comprueba si la respuesta terminó en el servidor. Si está tardando más, ves un aviso que dice que la respuesta todavía se está terminando en segundo plano. Actualiza el chat en un momento si no ha aparecido.

## Guías relacionadas

- [Acciones de mensaje: editar, eliminar, swipe, regenerar](messages.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Parámetros de generación](../prompts/generation-parameters.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
