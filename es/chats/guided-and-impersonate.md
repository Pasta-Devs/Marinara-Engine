# Generación guiada e Impersonate

Dos formas de dirigir un chat. La generación guiada orienta la próxima respuesta en una dirección sin publicar un mensaje visible. Impersonate hace que el modelo escriba tu propia respuesta. El menú Quick replies (respuestas rápidas) pone ambas junto a **Send** (Enviar).

## Dirigir una respuesta con /guided

Tu dirección es fuera de personaje. Da forma a la respuesta, pero no aparece como un mensaje del chat.

1. Escribe `/guided` y tu dirección en el cuadro de mensaje.
2. Pulsa <kbd>Enter</kbd> o haz clic en **Send**.

El modelo escribe su próxima respuesta orientada hacia tu dirección. Por ejemplo:

```text
/guided make him admit he is lying
```

Puedes escribir `/narrator`, `/narrate` o `/nar` en lugar de `/guided`. En un chat grupal, apunta la dirección a un personaje con `respond as`, `reply as` o `respond for`:

```text
/guided respond as Alice make her admit she is lying
```

## Guiar una regeneración

Esto reutiliza el texto de tu cuadro de mensaje como una dirección de una sola vez para una regeneración.

1. Abre **Settings → Advanced → Message Tools** (Configuración → Avanzado → Herramientas de mensaje) y activa **Guide swipes/regens with chat input** (Guiar swipes/regeneraciones con la entrada del chat). Está desactivado de forma predeterminada.
2. En un chat, escribe una dirección en el cuadro de mensaje, pero no la envíes.
3. Haz clic en **Regenerate** (Regenerar) en el mensaje de la IA. Con texto en el cuadro, la etiqueta del botón es **Regenerate (guided)**.

Después, tu dirección se queda en el cuadro, así que puedes ajustarla y volver a regenerar. Para que se borre en su lugar, desactiva **Keep guidance after regenerating** (Mantener la dirección después de regenerar) en **Settings → General → Input & Editing** (Configuración → General → Entrada y edición).

Si no funcionó: la etiqueta del botón debe ser **Regenerate (guided)**. Si dice solo **Regenerate**, el ajuste está desactivado o el cuadro está vacío.

<a id="read-stored-guidance"></a>

## Leer la Stored guidance

Marinara guarda la dirección que dio forma a una respuesta.

1. Haz clic en el icono **Stored guidance** (Guía guardada), un pergamino, en el mensaje de la IA.
2. Una ventana titulada **Stored guidance** muestra la dirección.

La ventana indica de dónde vino la dirección: **/guided**, **Guided regenerate** o **Game start** (la configuración de Game Mode). Para las direcciones de `/guided` y de regeneración guiada, **Copy /guided** copia un comando `/guided` listo para usar que puedes pegar en otro chat.

## Escribir tu respuesta con Impersonate

Impersonate hace que el modelo escriba tu próximo mensaje con la voz de tu persona. Una persona es el personaje que interpretas, escrito como `{{user}}`. Consulta [Personas de usuario](../characters/personas.md).

Antes de empezar: Impersonate solo funciona en los chats de Roleplay. En Conversation ves "Impersonate is not available in Conversation mode." (Impersonate no está disponible en el modo Conversation). Tampoco está disponible en Game.

1. Escribe `/impersonate` en el cuadro de mensaje. Si quieres, añade una dirección después.
2. Pulsa <kbd>Enter</kbd> o haz clic en **Send**.

El modelo publica un mensaje de usuario como tu persona. Por ejemplo, esto escribe un mensaje que pregunta por el clima:

```text
/impersonate ask about the weather
```

El alias corto es `/imp`. **Regenerate** funciona en un mensaje que escribió Impersonate, así que puedes obtener otra versión.

### Los ajustes de Impersonate

Estos ajustes se aplican a cada `/impersonate` en todos tus chats. Abre **Chat Settings** (Ajustes del chat) en un chat de Roleplay y busca la sección **Impersonate**. Consulta [Descripción general de Chat Settings](chat-settings.md) para saber cómo abrir el panel.

| Control | Qué hace |
| --- | --- |
| **Prompt Template** | Una instrucción opcional que se envía cada vez que usas impersonate. Si está vacía, se usa el prompt (las instrucciones enviadas a la IA) propio del chat o el predeterminado integrado. Admite `{{user}}`, `{{persona_description}}` y `{{impersonate_direction}}`, marcadores de posición que Marinara reemplaza por texto real. Elige **Built-in default** para leer el predeterminado, **Copy built-in default to edit** para empezar una copia, **Save as** para guardar una plantilla con nombre y **Delete template** para quitar una. |
| **Preset** | Un preset de prompt (ajuste guardado) solo para las respuestas de impersonate. Predeterminado: **Use chat default** (Usar el predeterminado del chat). Consulta [Presets](../prompts/presets.md). |
| **Connection** | El modelo para las respuestas de impersonate, por ejemplo uno más barato o más rápido. Predeterminado: **Use chat default**. También puedes elegir **Random** (Aleatorio). Consulta [Conectarte a un proveedor de IA](../connections/connecting-to-a-provider.md). |
| **Skip agents** | Omite los agentes (trackers, enrutadores de lorebook y ayudantes similares) durante impersonate. Así se mantiene rápido y no cambia el estado del mundo. Está desactivado de forma predeterminada. Consulta [Agentes](../agents/agents-overview.md). |
| **Use CYOA as direction** | Al hacer clic en una opción CYOA (choose your own adventure, elige tu propia aventura), se usa como dirección de impersonate en lugar de publicarse. Está desactivado de forma predeterminada. Si **Add CYOA choices to the message box instead of sending them** (Añadir las opciones CYOA al cuadro de mensaje en lugar de enviarlas) está activado en **Settings → General → Input & Editing**, un clic solo añade el texto a tu cuadro de mensaje y este ajuste no tiene efecto. |

### Establecer un prompt para un solo chat

1. Escribe `/impersonate_prompt` y tu prompt entre comillas.
2. Pulsa <kbd>Enter</kbd>.

```text
/impersonate_prompt "You will now play as my OC:"
```

Para volver al predeterminado, escribe `/impersonate_prompt reset`. El alias es `/imp_prompt`.

## Añadir Quick replies junto a Send

Las Quick replies añaden alternativas a **Send** con un solo clic, así que no necesitas escribir un comando slash.

1. Abre **Settings → General → Input & Editing**.
2. Activa **Quick replies** (Respuestas rápidas). Está desactivado de forma predeterminada.
3. Despliégalo para elegir qué acciones aparecen. Una vez activado, las tres acciones están activadas de forma predeterminada.

| Acción | Qué hace |
| --- | --- |
| **Post only** (Solo publicar) | Añade al chat el mensaje que escribiste sin una respuesta. El comando `/send <message>` hace lo mismo. |
| **Guide reply** (Guiar la respuesta) | Envía el texto que escribiste como una dirección `/guided`. |
| **Impersonate** | Genera una respuesta del lado de la persona, usando el texto que escribiste como dirección. Se oculta en los chats de Conversation. |

Con una acción activada, su botón aparece junto a **Send**. Con más de una, se agrupan en un botón de tres puntos (**Quick replies**) que abre un menú.
