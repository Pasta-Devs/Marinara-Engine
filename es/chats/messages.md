# Acciones de mensaje: editar, borrar, hacer swipe y regenerar

Esta guía cubre lo que puedes hacer con un solo mensaje dentro de un chat. Explica la barra de herramientas del mensaje, cómo editar y borrar un mensaje, y cómo funcionan los swipes (respuestas alternativas) y la regeneración. También cubre los interruptores de visualización que muestran los recuentos de tokens (un token es un fragmento de texto) y los números de mensaje.

Cada mensaje en Marinara Engine, ya lo hayas escrito tú o la IA, tiene una pequeña barra de herramientas. La barra aparece cuando pasas el cursor sobre el mensaje en una computadora, o cuando tocas el mensaje en un teléfono o una tableta.

## La barra de herramientas del mensaje

Los botones de abajo aparecen en los mensajes. Algunos solo se muestran en ciertas situaciones, que la tabla indica. Cada botón tiene un tooltip (texto de ayuda) que coincide con la etiqueta que se muestra aquí.

| Botón | Qué hace | Cuándo aparece |
| --- | --- | --- |
| **Copy** (Copiar) | Copia el texto del mensaje. El icono se convierte en una marca de verificación por un momento. | Siempre |
| **Add reaction** (Añadir reacción) | Abre un selector de emojis y activa o desactiva tu reacción en el mensaje. | Solo en Conversation Mode |
| **Translate** (Traducir) / **Hide translation** (Ocultar traducción) | Traduce el mensaje a tu idioma y luego vuelve a ocultar la traducción. | Siempre |
| **Edit** (Editar) | Abre el mensaje para editarlo. Ver más abajo. | Siempre |
| **Regenerate** (Regenerar) | Crea una nueva respuesta alternativa (un swipe). Ver más abajo. | Mensajes de la IA. En modo Roleplay, también en tus mensajes. En Conversation Mode, también en tus mensajes hechos con Impersonate |
| **Show original before rewrite** (Mostrar original antes de la reescritura) / **Show rewritten version** (Mostrar versión reescrita) | Alterna entre el texto original y el reescrito. Ambas versiones quedan disponibles para que las compares o conserves la que prefieras. | Solo después de que un agente reescriba el mensaje |
| **Hide from AI** (Ocultar a la IA) / **Unhide from AI** (Mostrar a la IA) | Deja de enviar o vuelve a enviar este mensaje a la IA en turnos posteriores. En un chat grupal de Roleplay, abre un selector de personajes. | Siempre |
| **Peek prompt** (Ver el prompt) | Muestra el prompt exacto que la IA recibió para esta respuesta. | Solo en el mensaje más reciente de la IA |
| **Stored guidance** (Guía guardada) | Muestra la dirección que orientó esta respuesta. | Solo si la respuesta usó una dirección guiada o se hizo con Impersonate |
| **Branch from here** (Ramificar desde aquí) | Copia el chat hasta este mensaje en una nueva rama. | Siempre |
| **View model thoughts** (Ver los pensamientos del modelo) | Abre el texto de razonamiento oculto del modelo. | Solo si el modelo devolvió razonamiento |
| **Delete** (Borrar) | Borra el mensaje. Ver más abajo. | Siempre |
| **Pause speaking** (Pausar la voz) / **Resume speaking** (Reanudar la voz) / **Restart speaking** (Reiniciar la voz) | Controla el audio hablado de un mensaje. | Solo cuando Text to Speech (texto a voz) está activado y hablando |

Para el visor de **Peek prompt**, consulta [Peek Prompt](peek-prompt.md). Para **Branch from here**, consulta [Chat Branches](branches.md). Para **Translate**, consulta [Message Translation](../integrations/message-translation.md). Para los controles de voz, consulta [Text to Speech (TTS) Setup](../media/tts-setup.md). Para las direcciones guiadas, **Stored guidance** e Impersonate, consulta [Guided Generation and Impersonate](guided-and-impersonate.md).

## Editar un mensaje

Puedes editar el texto de cualquier mensaje, tuyo o de la IA.

1. Haz clic en **Edit** en el mensaje. El texto se convierte en una caja editable.
2. Cambia el texto.
3. Haz clic en **Save** (Guardar), o pulsa Ctrl y Enter juntas (Cmd y Enter en un Mac). El tooltip del botón dice **Save (Cmd+Enter)**.
4. Para parar sin guardar, haz clic en **Cancel** (Cancelar) o pulsa la tecla Escape. El tooltip del botón dice **Cancel (Esc)**.

Dos ajustes te dan formas más rápidas de empezar a editar. Ambos están en **Settings** (Configuración), luego la pestaña **General**, bajo **Input & Editing**.

- **Up Arrow edits last message** (predeterminado activado): pulsa la tecla de flecha arriba mientras la caja de entrada está vacía. Esto abre el mensaje más reciente para editarlo.
- **Double-click edits messages** (predeterminado activado): haz doble clic o doble toque en un mensaje de Roleplay para abrirlo y editarlo.

## Borrar un mensaje

Cuando borras un mensaje, aparece una ventana titulada **How to proceed?** (¿Cómo continuar?). Las opciones para borrar el mensaje son:

- **Delete only this swipe (1/3)**: quita solo la respuesta alternativa que estás viendo. Esta opción solo aparece cuando el mensaje tiene más de un swipe. Los números muestran qué swipe está activo y cuántos hay.
- **Delete this message**: quita el mensaje completo y todos sus swipes.
- **Delete more**: selecciona este mensaje y todos los mensajes de abajo, y luego activa la selección múltiple de mensajes para que ajustes la selección antes de borrar.
- **Cancel**: cierra la ventana y no borra nada.

Los mensajes del sistema, como una línea de "joined the chat", tienen un botón de borrado simple sin ventana.

## Swipes: respuestas alternativas

Un swipe es una versión de una respuesta de la IA. Un solo mensaje puede contener varios swipes, así que puedes comparar distintas respuestas al mismo turno y elegir la que te guste.

Un control de swipe aparece en el mensaje una vez que tiene dos o más swipes. Muestra el swipe activo y el total, por ejemplo "2/4", con estos controles:

- **Previous swipe** (Swipe anterior) y **Next swipe** (Swipe siguiente): retroceden o avanzan por los swipes.
- Una caja de número: escribe un número de swipe y pulsa Enter para saltar directamente a él. Su tooltip dice **Jump to swipe 1-N**, donde N es el total.
- **Generate next swipe** (Generar swipe siguiente): cuando estás en el swipe más nuevo, el botón de avance cambia a este y crea un swipe totalmente nuevo.

No puedes borrar el último swipe de un mensaje. Si lo intentas, la app informa "Cannot delete the last remaining swipe" (No se puede borrar el único swipe restante). Usa **Delete this message** en su lugar para quitar el mensaje completo.

## Regenerar, continuar y reintentar

Estas tres acciones se parecen pero hacen cosas distintas. Elige la que corresponda a lo que quieres.

**Regenerate** hace un nuevo swipe. Haz clic en **Regenerate** en un mensaje de la IA para generar otra versión de esa respuesta. El swipe original se conserva. En una pantalla táctil, la app primero pregunta "Regenerate this message as a new swipe?" (¿Regenerar este mensaje como un nuevo swipe?) para que no lo actives por accidente. Cuando hay una dirección guiada preparada, el botón dice **Regenerate (guided)**.

El comando **/continue** extiende el mismo mensaje. Escribe `/continue` (o su forma corta `/cont`) en la caja de entrada y envíalo. La IA retoma donde se detuvo su última respuesta y añade más texto a ese mismo mensaje, en lugar de hacer un nuevo swipe.

De forma predeterminada, Marinara inserta una línea en blanco antes del texto añadido. Para adjuntar la continuación directamente al último carácter de la respuesta anterior, desactiva **Settings → General → Responses → Add a new line before /continue text**. Marinara indicará entonces al modelo que continúe exactamente desde el punto de corte, sin separador.

```
/continue
```

El reintento con envío vacío empieza una respuesta nueva. Si el último mensaje del chat es tuyo y la caja de entrada está vacía, el mismo botón **Send** (Enviar) reintenta en lugar de enviar. No cambia su aspecto. Haz clic en él, o pulsa Enter, para obtener una respuesta sin volver a escribir tu mensaje. En modo Roleplay, un **Send** vacío también puede animar a la IA a continuar la escena con un turno nuevo. Esto no es lo mismo que **/continue**: el envío vacío siempre hace una respuesta nueva, mientras que **/continue** se suma a la existente.

## Ocultar un mensaje a la IA

El contexto de la IA es el conjunto de mensajes que la app envía a la IA en cada turno. Haz clic en **Hide from AI** para mantener un mensaje fuera de ese contexto en los turnos futuros. El mensaje sigue visible para ti y muestra una etiqueta **Hidden from AI** (Oculto a la IA). Haz clic en **Unhide from AI** para volver a enviarlo.

En un chat grupal de Roleplay con más de un personaje, **Hide from AI** abre un selector de avatares compacto. Selecciona el avatar del grupo para ocultar el mensaje a todos, o selecciona uno o más avatares de personaje para ocultarlo solo a esos personajes. Seleccionar a todos borra las selecciones individuales, mientras que seleccionar un personaje individual desactiva la opción de todos. La marca de ojo tachado en el mensaje muestra los avatares de los personajes que no pueden verlo. En un chat de un solo personaje, el botón sigue ocultando o mostrando el mensaje directamente.

Un susurro dentro de un mensaje sigue llegando a su destinatario cuando ocultas el mensaje solo a ese personaje. Recibe el susurro, pero nada del resto del mensaje. Ocultar el mensaje a todos también quita sus susurros. Consulta [Susurros y secretos](../roleplay/getting-started.md#whispers-and-secrets).

También puedes ocultar mensajes con `/hide [range] [name (optional)]`, por ejemplo `/hide 3-8`. En Roleplay, `/hide 3-8 Maukie` los oculta solo para Maukie; si omites el nombre, se ocultan para todos. `/unhide [range]` restaura los mensajes ocultos globalmente. Para deshacer la ocultación por personaje, usa el selector de avatares en un chat grupal de Roleplay, o la acción **Unhide from AI** del mensaje en un chat de Roleplay con un solo personaje. Los números de mensaje empiezan en 1, contando desde el primer mensaje del chat. Consulta la [Referencia de comandos slash](slash-commands.md) para ver formatos y ejemplos.

Cuando **Decide who sees new messages** (Decidir quién ve los mensajes nuevos) de Advanced Memory está activado, los mensajes nuevos de un chat grupal en el que los personajes responden de uno en uno se ocultan automáticamente a los personajes ausentes, con la misma marca. Si cambias tú la elección de un mensaje, tu cambio siempre tiene prioridad; consulta [Decidir quién ve los mensajes nuevos](../agents/memory.md#deciding-who-sees-new-messages).

## Interruptores de visualización de mensajes

Dos interruptores cambian qué detalle extra se muestra en los mensajes. Ambos están en **Settings**, luego la pestaña **Advanced**, en la sección **Message Tools**. Ambos están desactivados de forma predeterminada.

- **Show message numbers**: muestra un número en cada mensaje. Los números empiezan en 1 desde el primer mensaje del chat. Son los mismos números que usan los comandos `/goto`, `/hide` y `/unhide`. Activa esto cuando necesites encontrar un número de mensaje.
- **Show token usage on messages**: añade un recuento de tokens por mensaje a las respuestas de la IA. Un token es un pequeño fragmento de texto que la IA lee y escribe. El recuento muestra los tokens del prompt y los tokens de la respuesta para esa réplica. Cuando está disponible, también muestra los aciertos de caché y cuánto tardó la respuesta.

Un interruptor relacionado en la misma sección **Message Tools**, **Show model name on messages**, añade el nombre del modelo de IA que escribió cada respuesta. También está desactivado de forma predeterminada.

Cuando hubo que dejar fuera del prompt mensajes antiguos para que cupiera, una nota breve debajo de la respuesta indica cuántos, por ejemplo "1109 older messages not sent". Para ocultar esta nota debajo de la respuesta, desactiva **Show "older messages not sent" note** (Mostrar la nota "mensajes antiguos no enviados") en la misma sección. Al abrir Checkup se puede seguir viendo. Está activado de forma predeterminada. Las notas sobre una respuesta que se cortó o que llegó vacía se siguen mostrando.

## Guías relacionadas

- [Sending and Streaming Messages](sending-and-streaming.md)
- [Guided Generation and Impersonate](guided-and-impersonate.md)
- [Peek Prompt](peek-prompt.md)
- [Chat Branches](branches.md)
- [Text to Speech (TTS) Setup](../media/tts-setup.md)
- [Message Translation](../integrations/message-translation.md)
- [Settings Overview](../settings/settings-overview.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
