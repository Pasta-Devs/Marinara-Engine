# Enviar mensajes y streaming

Escribe un mensaje, envíalo y mira cómo aparece la respuesta. Esta guía cubre el envío, los adjuntos, el streaming, cómo detener una respuesta, cómo reintentar y cómo leer un error.

## Enviar un mensaje

Antes de empezar: tu chat necesita un modelo. Consulta [Conectarte a un proveedor de IA](../connections/connecting-to-a-provider.md).

1. Escribe en la barra de entrada de la parte inferior del chat.
2. Haz clic en **Send** (Enviar), o pulsa <kbd>Enter</kbd> si **Send on Enter** (Enviar con Enter) está activado para ese modo de chat.

Tu mensaje aparece y luego la respuesta llega con streaming. Solo puede generarse una respuesta por chat a la vez. Mientras una respuesta está en streaming, **Send** se convierte en un botón de detener.

Si no funcionó: si el chat no tiene ningún modelo configurado, la respuesta falla de inmediato con un mensaje que dice que no hay ninguna conexión configurada. Elige una en [Chat Settings](chat-settings.md).

### Send on Enter

Está en **Settings → General → Input & Editing** (Configuración → General → Entrada y edición). Hay un interruptor por cada modo de chat.

| Modo de chat | Predeterminado | Cuando está desactivado |
| --- | --- | --- |
| Roleplay | Desactivado | <kbd>Enter</kbd> añade una línea nueva. Haz clic en **Send**. |
| Conversations | Activado | <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> en Mac) envía. |
| Game | Activado | <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> en Mac) envía. |

Roleplay está desactivado de forma predeterminada porque los mensajes de roleplay suelen ser largos y necesitan saltos de línea. Professor Mari tiene su propio interruptor, **Enter sends to Professor Mari** (Enter envía a Professor Mari), en **Settings → General → Search and Professor Mari settings** (Configuración → General → Ajustes de Search y Professor Mari).

## Adjuntar imágenes y archivos

1. Toca el clip de la barra de entrada.
2. Elige un archivo. Aparece como una pequeña ficha sobre la entrada.
3. Envía como siempre.

Marinara acepta imágenes, archivos PDF y archivos de texto plano (`.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml`, `.yml`). Cada archivo debe pesar 20 MB o menos. Marinara rechaza un archivo más grande o un tipo no admitido con un aviso.

Un modelo solo puede ver una imagen si admite visión. Para un modelo de solo texto, activa **Image captioning** (Descripción de imágenes) en **Chat Settings → Advanced Parameters** (Ajustes del chat → Parámetros avanzados). Está desactivado de forma predeterminada. Entonces Marinara describe cada imagen en texto, con un modelo que tú eliges, y envía esa descripción en lugar de la imagen.

## Mostrar una imagen de la galería dentro de un mensaje

Los adjuntos sirven para que el modelo los vea. Un enlace de galería te muestra una imagen a ti dentro del texto del mensaje. Los mensajes admiten la sintaxis de imágenes de Markdown, y Marinara resuelve los enlaces `card://` a archivos de la galería:

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

En Roleplay, el navegador de recursos del chat puede insertar un enlace por ti. También puedes pegar uno en mensajes, saludos y diálogos de ejemplo.

Para la propia galería de un personaje, usa la forma portátil `card://self/gallery/<filename>`. Sigue funcionando después de exportar e importar el personaje. El botón **Copy image reference** (Copiar referencia de imagen) de la galería la genera. Consulta [Galerías de personajes](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

## Streaming de la respuesta

El streaming muestra la respuesta palabra por palabra en lugar de toda de una vez. Estos ajustes están en **Settings → General → Responses** (Configuración → General → Respuestas).

| Ajuste | Predeterminado | Qué hace |
| --- | --- | --- |
| **Enable streaming** | Activado | Muestra la respuesta a medida que se escribe. Cuando está desactivado, la respuesta completa aparece cuando el modelo termina. |
| **Streaming speed** | 50 | Control deslizante de 1 a 100. Un valor más bajo da un efecto de máquina de escribir más lento. No cambia lo rápido que escribe el modelo. |
| **Trim incomplete sentences from the response** | Desactivado | Quita una última frase sin terminar antes de guardar la respuesta. Las respuestas completas y los finales con estilo de comando se quedan como están. |

## Indicadores de escritura y progreso

Antes de que llegue la primera palabra, ves el nombre del personaje con tres puntos animados. En un chat grupal, aparece el nombre de cada personaje que responde. Mientras el servidor prepara el prompt (las instrucciones enviadas a la IA), una línea de progreso pasa por estas etiquetas. Algunos pasos solo se ejecutan cuando el chat usa esa función, así que puede que no las veas todas.

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Si el estado de un personaje es ocupado o ausente, aparece un indicador de espera en lugar de los puntos. La respuesta empieza cuando el personaje está disponible.

## Ver el pensamiento del modelo

Algunos modelos devuelven un rastro de razonamiento oculto, llamado "pensamiento". Cuando una respuesta tiene uno, aparece en el mensaje un icono de cerebro (**View model thoughts**, Ver los pensamientos del modelo). Haz clic en él para leer el razonamiento.

Para que esto funcione, el modelo debe devolver su razonamiento. Algunos modelos lo envuelven en etiquetas de texto plano. Para esos, configura **Thinking Tags** (Etiquetas de pensamiento) en los ajustes de generación para que Marinara pueda separar el razonamiento de la respuesta. Consulta [Parámetros de generación](../prompts/generation-parameters.md).

## Detener una respuesta

Haz clic en el botón de detener, que es el botón **Send** mientras una respuesta está en streaming. El texto que ya llegó suele conservarse. Detener a propósito nunca muestra un error.

<a id="retry-without-retyping"></a>

## Reintentar sin volver a escribir

Si el último mensaje es tuyo y la IA nunca respondió, deja vacío el cuadro de entrada y haz clic en **Send** (o pulsa <kbd>Enter</kbd>). Marinara empieza una respuesta nueva y no añade ningún mensaje duplicado. En Conversation, el botón muestra una flecha circular en este estado. Si el cuadro tiene un borrador, **Send** envía el borrador en su lugar.

En Roleplay, un **Send** vacío también empieza una respuesta completamente nueva después de que la IA ya respondió. No se suma a la respuesta anterior. Para extender la respuesta anterior, usa `/continue`. Consulta [Acciones de mensaje](messages.md).

## Cuando aparece un error de generación

Una respuesta fallida muestra un toast (un mensaje emergente breve) en la parte inferior de la pantalla durante unos 15 segundos. Puedes copiar su texto. Marinara reescribe algunos errores como un paso siguiente:

| Causa | Lo que te dice el toast |
| --- | --- |
| El modelo rechaza un parámetro que no admite | Abre **Chat Settings → Advanced Parameters** y desactiva **Send** para ese parámetro. |
| El modelo requiere un parámetro que está desactivado | Vuelve a activar **Send** en el mismo lugar. |
| La respuesta llegó vacía | Envía tu mensaje de nuevo. |
| Ya se está generando una respuesta | Espera, o detenla con el botón de detener. |
| No hay ninguna conexión configurada | Configura una para el chat. |

Si un error sigue ocurriendo, consulta [Solución de problemas](../TROUBLESHOOTING.md).

## Conexiones lentas y pestañas en el teléfono

Una respuesta larga puede tardar un rato. Puedes detenerla en cualquier momento. En un teléfono, el navegador puede pausar una pestaña de chat cuando cambias a otra. Si una respuesta estaba en streaming, Marinara muestra **Finishing in background...** (Terminando en segundo plano) y luego comprueba si la respuesta terminó en el servidor. Si no ha aparecido, actualiza el chat en un momento.
