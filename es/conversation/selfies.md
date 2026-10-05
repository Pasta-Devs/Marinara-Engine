# Selfies

Esta guía trata sobre los selfies en Conversation Mode. Un selfie es una imagen que un personaje genera de sí mismo y envía al chat, como una foto compartida en una app de mensajería. Esta guía explica cómo activar los selfies, cómo configurarlos y cómo pedir uno tú mismo.

## Qué son los selfies

Los selfies son una función de Conversation Mode. Un personaje puede enviar una imagen generada de sí mismo durante un chat normal. Esto es distinto de las imágenes de escena que se usan en Roleplay Mode y Game Mode. Los selfies están pensados para dar esa sensación de app de mensajería propia de Conversation Mode.

Los selfies usan generación de imágenes. Cada selfie que envía tu personaje usa una solicitud de generación de imágenes de la conexión que elijas. Por eso, los selfies están desactivados hasta que los configuras.

Los selfies los provee el paquete opcional **Illustrator**. Instala Illustrator desde **Agents → Download Agents** (Agentes → Descargar agentes) antes de configurarlos.

## Cómo activar los selfies

Los selfies viven dentro de **Illustrator Settings** (Ajustes de Illustrator), en la sección **Agents** (Agentes) de un chat de Conversation. **Commands** (Comandos) son acciones ocultas que un personaje puede tomar por su cuenta, como enviar un selfie o reproducir una canción. Los controles de comandos aparecen dentro de **Agents** cuando se instala un paquete que provee comandos.

Para activar los selfies:

1. Abre un chat de Conversation.
2. Abre **Chat Settings** (Ajustes del chat) (el icono de controles deslizantes).
3. Busca la sección **Agents**.
4. Activa el interruptor maestro **Commands** que hay dentro. Los personajes no pueden usar ninguna acción oculta mientras esté desactivado.
5. Busca **Illustrator Settings**.
6. Activa el interruptor **Generated Selfies** (Selfies generados).

Después de activar **Generated Selfies**, los ajustes de selfie aparecen debajo del interruptor. Deberías ver campos para la conexión, el modelo de prompt, el estilo y las referencias. Los botones de **Resolution** (Resolución) solo aparecen después de que eliges una **Selfie Connection** (Conexión de selfie).

## Ajustes de selfie

Una vez que los selfies están activados, configura cómo se ven y qué servicio los crea. Todos estos ajustes están en **Illustrator Settings**, en **Chat Settings → Agents**. Se aplican solo al chat actual.

### Selfie Connection

**Selfie Connection** elige el servicio de generación de imágenes que dibuja la imagen. El valor predeterminado es **None (selfies disabled)** (Ninguno (selfies desactivados)), lo que significa que aún no hay un servicio elegido. Elige aquí una de tus conexiones de imagen configuradas.

Hasta que elijas una **Selfie Connection**, los personajes no pueden enviar selfies. Si ves la nota **Choose a Selfie Connection to let characters generate selfie images** (Elige una Selfie Connection para que los personajes generen imágenes de selfie), la conexión todavía está vacía.

Para saber cómo agregar una conexión de imagen, consulta [Proveedores y configuración de generación de imágenes](../media/image-providers.md).

### Prompt Model

**Prompt Model** (Modelo de prompt) elige el modelo de texto que escribe la descripción del selfie. Luego, la conexión de imagen dibuja esa descripción. El valor predeterminado es **Main chat model** (Modelo principal del chat), que reutiliza el mismo modelo que ya usa tu chat. Puedes elegir una conexión de texto distinta si quieres que otro modelo escriba la descripción del selfie.

### Image Style

**Image Style** (Estilo de imagen) elige un Style Profile (perfil de estilo) para el selfie. Un Style Profile es un conjunto guardado de palabras de estilo artístico, como "anime" o "realistic photo". El valor predeterminado es **Use default style from Style Profiles in Advanced settings** (Usar el estilo predeterminado de Style Profiles en los ajustes avanzados), que sigue tu estilo predeterminado global.

Para saber más sobre estilos, consulta [Perfiles de estilo de imagen](../media/style-profiles.md).

### Send Avatar References

**Send Avatar References** (Enviar referencias de avatar) es un interruptor que está desactivado de forma predeterminada. Cuando está activado, Marinara envía el avatar o el sprite (imagen del personaje) del personaje al servicio de imagen como imagen de referencia. Esto ayuda a que el selfie se parezca al personaje. Solo funciona cuando el proveedor de imagen admite imágenes de referencia.

### Attach Card Appearance

**Attach Card Appearance** (Adjuntar apariencia de la tarjeta) es un interruptor que está desactivado de forma predeterminada. Cuando está activado, Marinara agrega el texto de apariencia de la tarjeta de personaje a la descripción del selfie. Esto le da al modelo más detalle sobre cómo se ve el personaje.

### Resolution

**Resolution** define el tamaño de la imagen del selfie. Los botones de **Resolution** solo aparecen después de que eliges una **Selfie Connection**. Elige uno de los botones rápidos. El valor predeterminado es **896x1152**, una forma vertical alta que se adapta bien a la mayoría de los selfies.

Las opciones de tamaño son:

| Resolution | Forma              |
| ---------- | ------------------ |
| 512x512    | Cuadrada           |
| 512x768    | Vertical           |
| 768x768    | Cuadrada           |
| 768x1024   | Vertical           |
| 896x1152   | Vertical (predeterminada) |
| 1024x1024  | Cuadrada           |

## Cómo un personaje envía un selfie

Una vez configurados los selfies, un personaje puede decidir enviar uno durante el chat por su cuenta. Tú no escribes ningún comando. El personaje elige el momento, y Marinara genera la imagen y la publica en el chat.

La respuesta del modelo usa `[selfie]`, opcionalmente con contexto:

```text
Here is a picture from my walk!
[selfie: context="standing beside the river at sunset"]
```

También funcionan `[selfie: "standing beside the river"]` y `[selfie: standing beside the river]`. El comando no distingue mayúsculas de minúsculas, así que `[SELFIE:xxxxx.]` es una sintaxis válida. Es un comando de Conversation, no un activador de imágenes de Roleplay o Game Mode. Si el marcador queda visible en el mensaje, puede que el chat esté en otro modo o que **Commands** esté desactivado. Confirma que Illustrator esté instalado, **Generated Selfies** esté activado y **Selfie Connection** esté seleccionada. Si la generación empieza pero falla, revisa el error de conexión o del proveedor de imágenes; cambiar las mayúsculas del marcador no lo solucionará.

## Pedir un selfie tú mismo

También puedes solicitar un selfie tú mismo en lugar de esperar al personaje.

1. Abre **Chat Settings** y despliega **Gallery** (Galería).
2. Haz clic en el botón **Selfie** (el icono de cámara).
3. Si el chat tiene más de un personaje, elige quién debe tomar el selfie en la lista de personajes que hay junto al botón.
4. Si **Expose media prompts before sending** (Mostrar los prompts de medios antes de enviar) está activado en **Settings** (Configuración), **Generations** (Generaciones), **Image Generation** (Generación de imágenes), revisa o edita el prompt final compilado del selfie y haz clic en **Generate** (Generar). Cancelar la revisión no envía ninguna solicitud de imagen.
5. Espera mientras el botón muestra **Generating...** (Generando...).

Cuando el selfie esté listo, deberías ver un mensaje **Selfie generated.** (Selfie generado.), y la imagen aparece en el chat. Esta solicitud manual también usa la **Selfie Connection** que elegiste, así que también usa una solicitud de generación de imágenes.

## Guías relacionadas

- [Conversation Mode: primeros pasos](getting-started.md)
- [Proveedores y configuración de generación de imágenes](../media/image-providers.md)
- [Perfiles de estilo de imagen](../media/style-profiles.md)
