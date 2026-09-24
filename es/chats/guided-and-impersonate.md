# Generación guiada e Impersonate

Esta guía cubre dos formas de dirigir un chat en Marinara Engine. La generación guiada apunta a la IA en una dirección sin publicar un mensaje visible. Impersonate hace que la IA escriba por ti tu propia respuesta. También cubre el menú Quick replies (respuestas rápidas) que pone ambas acciones junto al botón Send.

## Generación guiada

La generación guiada te deja indicarle a la IA hacia dónde llevar la próxima respuesta. Tu instrucción es fuera de personaje. Dirige la respuesta, pero no aparece como un mensaje de chat normal.

### Dirigir una respuesta con /guided

La forma principal de guiar una respuesta es el comando slash `/guided`.

1. Escribe `/guided` seguido de tu dirección en el cuadro de mensaje.
2. Pulsa Enter o haz clic en Send.
3. La IA genera su próxima respuesta, orientada en la dirección que diste.

Por ejemplo, esta dirección empuja la próxima respuesta hacia una confesión:

```
/guided make him admit he is lying
```

El comando tiene alias cortos. Puedes escribir `/narrator`, `/narrate` o `/nar` en lugar de `/guided`.

En un chat grupal puedes apuntar la dirección a un personaje. Escribe `/guided respond for <character> <direction>`. Reemplaza `<character>` con el nombre del personaje y `<direction>` con tu instrucción. Por ejemplo:

```
/guided respond for Alice make her admit she is lying
```

### Regenerar guiado

También puedes guiar una respuesta mientras la regeneras. Esto reutiliza cualquier texto que hayas escrito en el cuadro de mensaje como una dirección de una sola vez.

1. Abre **Settings** (Configuración), luego **Advanced** (Avanzado), luego **Message Tools** (Herramientas de mensaje).
2. Activa **Guide swipes/regens with chat input** (Guiar swipes/regeneraciones con la entrada del chat). Este ajuste está desactivado de forma predeterminada.
3. Vuelve a un chat y escribe una dirección en el cuadro de mensaje, pero no la envíes.
4. Haz clic en **Regenerate** (Regenerar) en el mensaje de la IA.

Cuando el ajuste está activado y tienes texto en el cuadro, el botón **Regenerate** cambia su tooltip (texto de ayuda) a **Regenerate (guided)**. La IA crea una nueva versión de la respuesta usando el texto que escribiste como dirección.

### Leer la Stored guidance

Cuando una respuesta se creó con una dirección, Marinara guarda esa dirección para que puedas verla después. Una acción **Stored guidance** (dirección guardada, un icono de pergamino) aparece en el mensaje.

1. Haz clic en el icono **Stored guidance** en el mensaje de la IA.
2. Se abre una ventana titulada **Stored guidance** que muestra la dirección que produjo la respuesta.

La ventana etiqueta la dirección según de dónde vino:

- **/guided**: la dirección vino del comando `/guided`.
- **Guided regenerate**: la dirección vino de un clic en **Regenerate** guiado.
- **Game start**: la dirección vino de la configuración de Game Mode.

Para las direcciones de `/guided` y de regenerar guiado, un botón **Copy /guided** copia la dirección de vuelta como un comando `/guided` listo para usar. Puedes pegarlo en otro chat para reutilizar la misma dirección.

## Impersonate

Impersonate hace que la IA escriba por ti tu próximo mensaje, con la voz de tu persona. Tu persona es el personaje que interpretas, escrito en el chat como `{{user}}`. Consulta [Personas de usuario](../characters/personas.md) para saber cómo configurar una.

Impersonate funciona solo en chats de Roleplay. No está disponible en chats de Conversation ni de Game. Si lo intentas en un chat de Conversation, verás el mensaje **Impersonate is not available in Conversation mode** (Impersonate no está disponible en el modo Conversation).

### Usar /impersonate

1. Escribe `/impersonate` en el cuadro de mensaje. Puedes añadir una dirección opcional después.
2. Pulsa Enter o haz clic en Send.
3. La IA escribe un mensaje de usuario como tu persona y lo publica en el chat.

Por ejemplo, esto hace que la IA escriba un mensaje con tu voz que pregunta por el clima:

```
/impersonate ask about the weather
```

El comando tiene un alias corto. Puedes escribir `/imp` en lugar de `/impersonate`.

Puedes rehacer un mensaje que escribió Impersonate. La acción **Regenerate** funciona en los mensajes de usuario que creó Impersonate, así que puedes obtener una versión diferente.

### Los ajustes de Impersonate

Impersonate tiene una sección de ajustes que se aplica a cada `/impersonate` que ejecutas, en todos tus chats. La abres desde los ajustes por chat.

1. Abre el panel **Chat Settings** (Ajustes del chat) de un chat de Roleplay.
2. Busca la sección **Impersonate**.

La sección tiene estos controles:

- **Prompt Template**: una instrucción opcional que se envía al modelo cada vez que usas impersonate. Déjala vacía para usar el prompt (instrucciones enviadas a la IA) propio del chat, o el predeterminado integrado cuando el chat no tiene ninguno. Admite los macros `{{user}}`, `{{persona_description}}` e `{{impersonate_direction}}`. Un macro es un marcador de posición que Marinara reemplaza por texto real antes de enviar. Haz clic en **Built-in default** para leer el texto predeterminado. Un botón **Reset** borra una plantilla personalizada y la deja vacía.
- **Preset**: usa un preset de prompt (ajuste guardado) específico solo para las respuestas de impersonate. Un preset es un paquete guardado de ajustes de prompt. Consulta [Presets](../prompts/presets.md). El valor predeterminado es **Use chat default**. Los presets se aplican solo en Roleplay.
- **Connection**: dirige las respuestas de impersonate a una conexión específica, como un modelo más barato o más rápido. Una conexión es un enlace guardado a un proveedor de IA. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md). El valor predeterminado es **Use chat default**. También puedes elegir **Random**.
- **Skip agents**: cuando está activado, Marinara omite el pipeline de agentes (trackers, enrutadores de lorebook y ayudantes similares) durante impersonate. Esto mantiene impersonate rápido y evita que cambie el estado del mundo. Está desactivado de forma predeterminada. Consulta [Agentes](../agents/agents-overview.md).
- **Use CYOA as direction**: cuando está activado, hacer clic en una opción CYOA la usa como dirección de impersonate en lugar de publicarla como un mensaje normal. CYOA significa choose your own adventure (elige tu propia aventura), un conjunto de opciones para hacer clic que algunos chats muestran después de una respuesta. Este ajuste está desactivado de forma predeterminada.

### Establecer un prompt de impersonate personalizado

También puedes establecer un prompt de impersonate para un solo chat, usando un comando slash.

1. Escribe `/impersonate_prompt` seguido de tu prompt entre comillas.
2. Pulsa Enter.

Por ejemplo:

```
/impersonate_prompt "You will now play as my OC:"
```

Para borrar el prompt por chat y volver al predeterminado, escribe:

```
/impersonate_prompt reset
```

El comando tiene un alias corto, `/imp_prompt`.

## El menú Quick replies

El menú Quick replies (respuestas rápidas) añade acciones de envío adicionales junto al botón Send normal. Te da acceso con un clic a la generación guiada y a Impersonate sin escribir un comando slash.

Eliges qué acciones se muestran desde los ajustes.

1. Abre **Settings**, luego **Advanced**, luego **Message Tools**.
2. Activa **Quick replies**. Está desactivado de forma predeterminada.
3. Expándelo para elegir qué acciones aparecen. Una vez activado el menú, las tres acciones están activadas de forma predeterminada.

Las tres acciones son:

- **Post only**: añade el mensaje que escribiste al chat sin iniciar una respuesta de IA. También puedes hacerlo con el comando de barra `/send <message>`.
- **Guide reply**: envía el texto que escribiste como una dirección `/guided` en lugar de un mensaje normal.
- **Impersonate**: genera una respuesta como tu persona, usando el texto que escribiste como dirección. Esta acción se oculta en los chats de Conversation, porque Impersonate no funciona ahí.

Cuando solo una acción está activada, su botón se muestra directamente junto a Send. Cuando hay más de una activada, se agrupan en un menú pequeño. Haz clic en el botón de tres puntos (etiquetado **Quick replies**) para abrirlo.

## Guías relacionadas

- [Acciones de mensaje: editar, borrar, swipe, regenerar](messages.md)
- [Peek Prompt: ver lo que recibió la IA](peek-prompt.md)
- [Personas de usuario: crear y editar](../characters/personas.md)
- [Presets](../prompts/presets.md)
