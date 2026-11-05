# Narrative Director y Secret Plot

El Narrative Director es un agente (un ayudante que se ejecuta junto a las respuestas) que dirige la trama de un chat de Roleplay. **Push Story** da un empujón a una respuesta cuando la escena se siente estancada. **Secret Plot** mantiene un arco oculto a largo plazo que da forma a muchas respuestas. Funciona solo en Roleplay. Para saber cómo funcionan los agentes en general, consulta la [introducción a los agentes](../agents/agents-overview.md).

## Añadir el Narrative Director a un chat

1. Abre **Chat Settings** (Ajustes del chat) con el botón de controles deslizantes del chat y ve a **Agents** (Agentes).
2. Activa **Enable Agents** (Activar agentes) y luego añade el agente **Narrative Director**.

Ahora aparece un botón **Push Story** encima de tu cuadro de mensaje, y una tarjeta **Narrative Director** aparece en **Agents**. El agente no hace nada hasta que usas **Push Story** o activas **Secret Plot**.

## Hacer avanzar la historia

**Push Story** funciona una sola vez. Da forma solo a la siguiente respuesta y luego se desactiva solo. Primero añade el Narrative Director al chat (consulta más arriba).

1. Haz clic en **Push Story** encima de tu cuadro de mensaje. Un menú pregunta cómo empujar la historia:
   - **Naturally** (De forma natural): empuja hacia adelante la trama existente. La IA hace avanzar los hilos que ya están en tu historia.
   - **Randomly** (De forma aleatoria): añade a la escena una sorpresa plausible.
2. Elige una opción. Ves "The next time a character responds, they will push the story forward naturally!" (o "randomly!"). Ahora el botón dice **Push Story: Naturally** o **Push Story: Randomly**.
3. Envía tu siguiente mensaje o genera una nueva respuesta. La IA escribe esa única respuesta con el empujón aplicado.
4. Después de la respuesta, **Push Story** se desactiva solo.

Eliges el modo en este menú cada vez. No hay modo predeterminado ni ajuste de modo en **Chat Settings**.

Para cancelar antes de enviar, haz clic otra vez en el botón armado. Ves "Push Story disarmed."

Si no funcionó: **Push Story** no responde mientras se genera una respuesta. Espera a que termine la respuesta y luego haz clic en él.

## Activar Secret Plot

**Secret Plot** es un arco oculto a largo plazo. La IA mantiene un plan secreto de hacia dónde va la historia. El plan se agrega al prompt (las instrucciones enviadas a la IA), pero permanece oculto para ti a menos que lo reveles. Está desactivado de forma predeterminada. A diferencia de **Push Story**, actúa a lo largo de muchas respuestas y actualiza su plan según un horario.

1. Abre **Chat Settings → Agents** y busca la tarjeta **Narrative Director**.
2. Activa el interruptor **Secret Plot**. Su etiqueta dice "Maintain a hidden long-term arc for this roleplay."
3. Ajusta **Run Interval** (Intervalo de ejecución), si quieres. Es cuántos mensajes (los tuyos y los de la IA) pasan entre actualizaciones del arco. El predeterminado es 8. Puedes usar cualquier número entero del 1 al 100. Un número más bajo actualiza el plan con más frecuencia.

## Revelar y editar el arco oculto

El panel **Secret plot** está debajo de **Run Interval**.

1. Haz clic en **Reveal spoilers**. Dice **Reveal empty arc** si la IA todavía no ha escrito un arco. Mientras está oculto, el panel muestra "Spoilers hidden". Haz clic en **Hide spoilers** para ocultarlo de nuevo.
2. Edita los campos que quieras:
   - **Arc description**: la trama oculta general.
   - **Protagonist arc**: hacia dónde se dirige tu personaje.
   - **Character arc**: hacia dónde se dirige un personaje elegido.
   - **Completed**: márcalo cuando el arco esté terminado.
3. Usa el botón de guardar para conservar tus cambios.

Para descartar el arco y hacer que la IA escriba uno nuevo, haz clic en **Regenerate**. Un cuadro de diálogo titulado "Regenerate Secret Plot" te pide que confirmes. Elige **Regenerate** para reemplazar el arco, o **Keep Current Arc** para cancelar.

El arco se almacena con el agente **Narrative Director**. Borrar los resultados de los agentes del chat no lo elimina. Solo se elimina cuando quitas el agente del chat, y antes un aviso te lo indica.

## Cambiar el prompt de Secret Plot

El **Secret Plot Prompt** (Prompt de Secret Plot) contiene las instrucciones que sigue el Narrative Director cuando escribe y actualiza el arco. El prompt integrado plantea cada arco como un misterio por descubrir. Eso encaja con la aventura y la intriga, pero puede no encajar con una historia impulsada por sus personajes.

1. Abre **Agents** y edita el **Narrative Director**.
2. En la sección **Secret Plot**, haz clic en **Copy default to edit** (Copiar el predeterminado para editarlo).
3. Cambia el texto y luego guarda el agente.

Haz clic en **Reset to default** (Restablecer el predeterminado) para volver al prompt integrado y luego guarda el agente.

> **Nota:** No borres la última parte del prompt. Describe el formato de respuesta, y sin ella Marinara no puede leer el arco.

El prompt se guarda en el agente, así que se aplica a todos los chats que usan ese Narrative Director.

## Guías relacionadas

- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Modo Roleplay: primeros pasos](getting-started.md)
- [Generación guiada e Impersonate](../chats/guided-and-impersonate.md)
