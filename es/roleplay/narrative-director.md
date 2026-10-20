# Narrative Director y trama secreta

Esta guía explica el agente Narrative Director en Marinara Engine. Cubre el botón Push Story, los modos Natural y Random Event, y el arco oculto de la trama secreta (Secret Plot). Estas funciones son para el Roleplay Mode.

## Qué es el Narrative Director

Un agente es un ayudante de IA que se ejecuta detrás de tu chat para hacer una tarea en segundo plano. El Narrative Director es uno de estos agentes. Escribe una única indicación para la siguiente respuesta, de modo que la historia avance como tú quieres. Para aprender cómo funcionan los agentes en general, consulta la [introducción a los agentes](../agents/agents-overview.md).

El Narrative Director funciona solo en el Roleplay Mode. No hace nada por sí solo. Actúa solo cuando lo armas (lo activas para una respuesta) con el botón **Push Story**, o cuando activas la función **Secret Plot**.

Para usarlo, primero agregas el agente a tu chat. Abre **Chat Settings** (Ajustes del chat), ve a la sección **Agents** (Agentes) y activa el agente **Narrative Director**. Una vez que está activo, aparece un botón **Push Story** encima de tu cuadro de mensaje, y una tarjeta de configuración **Narrative Director** aparece en la sección **Agents**.

## Push Story

**Push Story** es un botón de un solo uso. Da forma solo a la siguiente respuesta y luego se desactiva solo. Úsalo cuando la escena se siente estancada y quieres que la IA haga avanzar las cosas.

Sigue estos pasos para usarlo.

1. Abre un chat de Roleplay que tenga el agente **Narrative Director** activo.
2. Encuentra el botón **Push Story** encima de tu cuadro de mensaje.
3. Haz clic en **Push Story**. En el modo Natural deberías ver el mensaje "The next time a character responds, they will push the story forward naturally!" En el modo Random Event el mensaje termina con "randomly!" en su lugar.
4. Envía tu siguiente mensaje, o genera una nueva respuesta.
5. La IA escribe esa única respuesta con el empuje de la historia aplicado.
6. Después de la respuesta, **Push Story** se desactiva solo.

Si cambias de opinión antes de enviar, haz clic en **Push Story** de nuevo para desactivarlo. Deberías ver el mensaje "Push Story disarmed."

El botón **Push Story** no está disponible mientras una respuesta todavía se está generando. Espera a que termine la respuesta actual, y luego ármalo.

## Modos Natural y Random Event

**Push Story** tiene dos modos. Eliges el modo en la tarjeta **Narrative Director** dentro de **Chat Settings**. El modo que eliges cambia qué tipo de empuje obtienes.

Los dos modos son:

- **Natural**: Empuja la trama existente hacia adelante. La IA hace avanzar los hilos que ya están en tu historia.
- **Random Event**: Agrega una sorpresa plausible. La IA introduce un nuevo giro que aún encaja en la escena.

**Natural** es el predeterminado. Para cambiar el modo, abre **Chat Settings**, ve a **Agents**, encuentra la tarjeta **Narrative Director** y haz clic en el modo que quieres.

El tooltip (texto de ayuda) en el botón **Push Story** te dice qué modo está armado. En el modo **Natural** dice "Arm a natural Narrative Director push for the next response." En el modo **Random Event** dice "Arm a random Narrative Director event for the next response."

## Secret Plot

**Secret Plot** es un arco oculto a largo plazo para tu roleplay. La IA mantiene un plan secreto de hacia dónde va la historia. Este plan se agrega al prompt (instrucciones enviadas a la IA), pero permanece oculto para ti a menos que elijas revelarlo. Está desactivado de forma predeterminada.

A diferencia de **Push Story**, que actúa una vez, **Secret Plot** se ejecuta a lo largo de muchas respuestas. Actualiza su plan oculto en un horario fijo a medida que el chat continúa.

### Activar Secret Plot

1. Abre **Chat Settings** y ve a la sección **Agents**.
2. Encuentra la tarjeta **Narrative Director**.
3. Activa el interruptor **Secret Plot**. Su etiqueta dice "Maintain a hidden long-term arc for this roleplay."

### Run Interval

Cuando **Secret Plot** está activado, aparece un campo **Run Interval**. Esto establece cuántos mensajes del usuario y del asistente pasan entre actualizaciones del arco oculto.

El predeterminado es 8. Puedes establecer cualquier número entero del 1 al 100. Un número más bajo actualiza el plan con más frecuencia. Un número más alto lo actualiza con menos frecuencia.

### Revelar y editar el arco oculto

Debajo del campo **Run Interval** está el panel **Secret plot**. Úsalo para ver y cambiar el plan oculto.

Haz clic en el botón de revelar para mostrar el arco. Dice **Reveal spoilers** una vez que existe un arco, o **Reveal empty arc** si la IA todavía no ha escrito uno. Haz clic en **Hide spoilers** para ocultarlo de nuevo. Mientras el arco está oculto, el panel muestra "Spoilers hidden".

Cuando el arco está revelado, puedes editar estos campos:

- **Arc description**: la trama oculta general.
- **Protagonist arc**: hacia dónde se dirige tu personaje.
- **Character arc**: hacia dónde se dirige un personaje seleccionado en el roleplay.
- **Completed**: una casilla que marcas cuando el arco está terminado.

Después de editar un campo, usa el botón de guardar para conservar tus cambios.

Para descartar el arco actual y hacer que la IA escriba uno nuevo, haz clic en **Regenerate**. Una ventana titulada "Regenerate Secret Plot" te pide que confirmes. Elige **Regenerate** para reemplazarlo, o **Keep Current Arc** para cancelar.

### El arco permanece con el agente

El arco oculto se almacena con el agente **Narrative Director**. Borrar las ejecuciones del agente y la memoria de tu chat no lo elimina. El arco se elimina solo cuando quitas el agente **Narrative Director** del chat. Si quitas el agente, un aviso te dice que el arco oculto se borrará y no se puede deshacer.

### Prompt de Secret Plot

El **Secret Plot Prompt** (Prompt de Secret Plot) contiene las instrucciones que sigue el Narrative Director cuando escribe y actualiza el arco oculto. El prompt integrado plantea cada arco como un misterio por descubrir. Eso encaja con la aventura y la intriga, pero puede no encajar con una historia impulsada por los personajes.

Para usar tus propias instrucciones, sigue estos pasos.

1. Abre **Agents** y edita el **Narrative Director**.
2. En la sección **Secret Plot**, haz clic en **Copy default to edit** (Copiar el predeterminado para editarlo).
3. Cambia el texto y luego guarda el agente.

Haz clic en **Reset to default** (Restablecer el predeterminado) para volver al prompt integrado y luego guarda el agente.

Conserva el formato de respuesta JSON al final del prompt: un objeto `overarchingArc` con `description`, `protagonistArc`, un `characterArc` opcional y `completed`. Sin él, el arco no se puede leer.

Este prompt se guarda en el agente, así que se aplica a todos los chats que usan ese Narrative Director.

## Guías relacionadas

- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Roleplay Mode: primeros pasos](getting-started.md)
- [Guided Generation e Impersonate](../chats/guided-and-impersonate.md)
