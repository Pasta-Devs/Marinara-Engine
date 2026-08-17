# Parámetros de generación

Esta guía explica los parámetros de generación de Marinara Engine. Son los ajustes que controlan cómo escribe la IA cada respuesta, como **Temperature** (Temperatura) y **Max Output Tokens** (Máximo de tokens de salida). Los cambias por chat en el panel **Advanced Parameters** (Parámetros avanzados).

## Qué hacen los parámetros de generación

Un parámetro de generación es un ajuste de muestreo. Da forma a cómo el modelo convierte tu prompt (las instrucciones enviadas a la IA) en texto. No cambia lo que le dices a la IA. Cambia cómo responde la IA.

Por ejemplo, un parámetro hace que las respuestas sean más aleatorias y creativas. Otro fija la respuesta más larga que el modelo puede escribir. La mayoría de la gente nunca necesita tocar esto. Los valores predeterminados funcionan bien para el chat normal y el roleplay.

Cambia estos ajustes solo cuando quieras arreglar un problema concreto. Esta guía lista los problemas comunes y qué parámetro probar cerca del final.

## Dónde encontrarlos

Los parámetros de generación viven en cada chat, no en un menú global.

1. Abre el chat que quieres cambiar.
2. Abre **Chat Settings** (Ajustes del chat) (el icono de engranaje del chat activo).
3. Busca la sección **Advanced Parameters** y haz clic en ella para desplegarla.

Deberías ver una nota de ayuda que dice: "Override generation parameters for this chat. Only change these if you know what you're doing." (Sustituye los parámetros de generación para este chat. Cámbialos solo si sabes lo que haces.) Todos los ajustes de abajo están dentro de **Advanced Parameters**.

**Advanced Parameters** está disponible en todos los modos de chat (Conversation, Roleplay y Game).

## Cada parámetro en lenguaje claro

Cada parámetro numérico tiene una casilla de entrada y su propio interruptor de activar y desactivar. Ese interruptor decide si el parámetro se envía al modelo. Se explica en la siguiente sección.

**Temperature** controla la aleatoriedad. El rango va de 0 a 2. Los valores más bajos hacen las respuestas más enfocadas y predecibles. Los valores más altos hacen las respuestas más creativas y variadas. Un valor cercano a 1 es un punto medio común.

**Max Output Tokens** fija la respuesta más larga que el modelo puede escribir en un turno. Un token (un fragmento de texto) es una porción pequeña de texto, más o menos una palabra corta o parte de una palabra. Súbelo si las respuestas se cortan sin terminar. No hay un límite superior fijo en la casilla.

**Top P** se llama muestreo por núcleo. El rango va de 0 a 1. El modelo solo elige entre las palabras más probables cuya probabilidad combinada alcanza este valor. Los valores más bajos hacen las respuestas más enfocadas. Un valor de 1 deja que el modelo considere todo.

**Top K** limita el modelo a las pocas palabras más probables en cada paso. El rango va de 0 a 500. Un valor de 0 desactiva este límite. Muchos proveedores ignoran este ajuste.

**Frequency** penaliza las palabras cuanto más aparecen ya. El rango va de -2 a 2. Un valor positivo reduce las palabras repetidas. Esta es la penalización por frecuencia, mostrada en la app como **Frequency**.

**Presence** penaliza las palabras que aparecieron aunque sea una vez, sin importar cuántas. El rango va de -2 a 2. Un valor positivo empuja al modelo hacia temas nuevos. Esta es la penalización por presencia, mostrada en la app como **Presence**.

Juntas, **Frequency** y **Presence** son las penalizaciones por repetición.

**Reasoning Effort** le dice a un modelo con capacidad de razonamiento cuánto razonar antes de responder. Un modelo con capacidad de razonamiento es uno que resuelve un problema primero en pasos ocultos. Las opciones son **None**, **Low**, **Medium**, **High**, **Xhigh** y **Maximum**. Si el modelo no admite el nivel que eliges, Marinara lo baja al nivel más fuerte que ese modelo permite.

Cuando el interruptor del parámetro está activado, **None** pide explícitamente al proveedor que desactive el razonamiento, en vez de limitarse a omitir el ajuste de esfuerzo. Marinara solo envía el control de desactivación específico del proveedor a los modelos que sabe que lo admiten. Algunos modelos de razonamiento obligatorio no permiten desactivarlo y pueden seguir devolviendo razonamiento; elige un modelo sin razonamiento cuando sea imprescindible que no lo haya. Desactivar el propio interruptor del parámetro es distinto: no envía ninguna preferencia de razonamiento y deja intacto el comportamiento predeterminado del proveedor.

**Verbosity** controla cuán largas y detalladas deben ser las respuestas. Las opciones son **None**, **Low**, **Medium** y **High**. **Low** mantiene las respuestas cortas. **High** fomenta respuestas más largas y descriptivas. Solo algunos modelos usan este ajuste.

## El interruptor de envío

Cada parámetro numérico, más **Reasoning Effort** y **Verbosity**, tiene un pequeño interruptor de activar y desactivar junto a su nombre. El interruptor no tiene etiqueta de texto en la app; esta guía lo llama el interruptor de envío. Pasa el cursor sobre él para ver "This parameter is sent to the model" (Este parámetro se envía al modelo) o "This parameter is not sent to the model" (Este parámetro no se envía al modelo).

Cuando el interruptor de envío de un parámetro está activado, Marinara incluye ese parámetro en la solicitud al proveedor. Cuando está desactivado, Marinara deja ese parámetro fuera por completo. El proveedor usa entonces su propio valor predeterminado para ese ajuste.

Desactivar el interruptor de envío es distinto de fijar un valor como 1 o 0. Un valor de 1 aún le dice al proveedor qué usar. Desactivar el interruptor no le dice nada al proveedor, así que el modelo decide.

Usa el interruptor de envío cuando un proveedor dice que dos ajustes no se pueden usar juntos. Desactiva uno de ellos e inténtalo de nuevo. También lo usarás cuando un error diga que un parámetro no se acepta o es obligatorio. Desactiva el interruptor de ese parámetro si no se acepta, o actívalo si es obligatorio.

En los **Advanced Parameters** de un chat, solo **Max Output Tokens** y **Reasoning Effort** tienen su interruptor de envío activado de forma predeterminada. Los demás empiezan desactivados.

## Valores predeterminados

Los chats nuevos parten de una base integrada. La tabla de abajo muestra esos valores iniciales y si cada uno se envía de forma predeterminada.

| Parámetro | Valor inicial | Enviado de forma predeterminada |
|---|---|---|
| Temperature | 1 | No |
| Max Output Tokens | 4096 en Conversation, 8192 en Roleplay y Game | Sí |
| Top P | 1 | No |
| Top K | 0 (off) | No |
| Frequency | 0 | No |
| Presence | 0 | No |
| Reasoning Effort | Maximum | Sí |
| Verbosity | High | No |

El valor sigue mostrándose en la casilla aunque el **Send toggle** (interruptor de envío) esté desactivado. Simplemente no se envía hasta que actives el interruptor.

## Assistant Prefill

**Assistant Prefill** es un texto opcional que se añade justo al comienzo de la respuesta de la IA, inmediatamente después de tu mensaje. La mayoría de la gente lo deja vacío.

Úsalo solo para modelos que admiten un prefill o una etiqueta de apertura fija. Por ejemplo, podrías escribir una etiqueta de apertura como la que se muestra en el marcador de posición para forzar al modelo a empezar de cierta manera. Si no estás seguro de necesitarlo, déjalo en blanco.

## Assistant Reasoning Prefill

**Assistant Reasoning Prefill** (prellenado del razonamiento del asistente) es un texto oculto opcional que se añade justo al comienzo del razonamiento de la IA, antes de que escriba la respuesta visible. La mayoría de la gente lo deja vacío.

Úsalo solo con modelos que admitan un prefill de razonamiento independiente, como Kimi K3. Puedes usarlo junto con **Assistant Prefill**: uno inicia el razonamiento oculto del modelo y el otro inicia su respuesta visible. Si no estás seguro de que tu modelo lo admita, déjalo en blanco.

## Thinking Tags

**Thinking Tags** le dice a Marinara cómo marca un modelo su razonamiento oculto dentro del texto plano. Algunos modelos envuelven su razonamiento en etiquetas. Si Marinara conoce esas etiquetas, puede ocultar ese razonamiento tras la acción **View thoughts** (Ver pensamientos) en lugar de mostrarlo en la respuesta.

Escribes un envoltorio por línea, con un hueco en el medio para el texto oculto. Los envoltorios comunes como think, thinking, thought, pipe, channel y los pares de corchetes ya se reconocen. Solo necesitas este campo para modelos que usan un envoltorio poco habitual.

## Custom Parameters

**Custom Parameters** te permite añadir ajustes en bruto que Marinara no muestra como campo propio. Escribes un objeto JSON, y Marinara lo fusiona en la solicitud enviada al proveedor.

Los Custom Parameters guardados como valores predeterminados de la conexión se envían en cada generación de texto respaldada por API que usa esa conexión, incluidos Conversation, Roleplay, Game, Noodle, resúmenes y agentes. Esto también se aplica a los endpoints personalizados que se ejecutan en tu propia máquina. Los Custom Parameters por chat se añaden para ese chat y sustituyen las claves coincidentes a nivel de conexión.

Este es un campo avanzado. Una clave incorrecta puede hacer que el proveedor rechace la solicitud. El objeto debe usar `true`, `false` y `null` en minúsculas. Deja esto vacío a menos que la guía de un proveedor te diga que añadas una clave específica.

## OpenRouter Service Tier

**OpenRouter Service Tier** solo aparece cuando la conexión del chat usa el proveedor OpenRouter. Elige cómo enruta OpenRouter tu solicitud. Las opciones son **Default**, **Flex** y **Priority**. **Flex** puede ser más barato y más lento. **Priority** puede ser más rápido y costar más. **Default** no envía ningún nivel.

## Límite de mensajes de contexto

**Limit Context Messages** controla cuánto historial del chat se envía al modelo. Actívalo para enviar solo los últimos N mensajes en lugar de todo el chat.

Cuando lo activas, el conteo empieza en 50. Puedes fijar cualquier número de 1 a 9999. Un número menor envía menos historial, lo que puede bajar el costo y acelerar las cosas. También significa que la IA recuerda menos de la conversación más antigua. Este ajuste está desactivado de forma predeterminada.

## Exclude Past Reasoning

**Exclude Past Reasoning** está activado de forma predeterminada. Mantiene el razonamiento y el pensamiento guardados de turnos anteriores fuera de los nuevos prompts. Ese razonamiento no se envía de nuevo al modelo.

Déjalo activado a menos que tengas una razón clara para volver a alimentar el razonamiento antiguo al modelo.

## Image Captioning

**Image Captioning** cambia cómo maneja la IA los archivos de imagen adjuntos. Cuando está activado, Marinara describe cada imagen adjunta en texto usando una conexión que tú eliges, en lugar de enviar la imagen misma.

Usa esto para modelos que no pueden ver imágenes. Cuando lo actives, elige una conexión en el menú desplegable **Captioning Connection**. Un endpoint de solo texto puede fallar si lo apuntas a la conexión equivocada. Este ajuste está desactivado de forma predeterminada.

## Save as Connection Default

En la parte inferior de **Advanced Parameters**, el botón **Save as Connection Default** (Guardar como predeterminado de la conexión) escribe tus valores de parámetros actuales en la conexión misma. Después de eso, los chats nuevos que usan esa misma conexión parten de estos valores.

El botón solo aparece para una conexión normal y guardada. Está oculto para el grupo de conexiones aleatorias y para el modelo local integrado.

El botón **Reset to Defaults** (Restablecer valores predeterminados) debajo de él borra cada cambio de parámetro por chat y devuelve este chat a la base del modo.

## Cómo se superponen y sustituyen los valores predeterminados

Tus parámetros efectivos vienen de tres capas. Cada capa gana sobre la anterior, un ajuste a la vez.

1. La base del modo. Este es el punto de partida integrado para el modo del chat.
2. Los valores predeterminados guardados de la conexión. Son los valores que almacenaste con **Save as Connection Default**.
3. Los **Advanced Parameters** de este chat. Son los valores que fijas aquí mismo, y ganan.

Así que un valor que fijas en **Advanced Parameters** siempre vence al valor predeterminado de la conexión y a la base del modo.

Game Mode es un caso especial. Game Mode fija algunos parámetros por su cuenta para mantener funcionando sus turnos estructurados. En Game Mode, algunos de tus cambios en **Advanced Parameters** pueden no aplicarse por completo. Esto es lo esperado.

## Algunos modelos ignoran algunos parámetros

No todos los modelos aceptan todos los parámetros. Cuando Marinara sabe que un modelo rechaza un ajuste, lo deja fuera de la solicitud. El control deslizante o la casilla siguen apareciendo en la app, pero cambiarlo no tiene efecto para ese modelo.

Esto es común con ciertos modelos de razonamiento y pensamiento, que rechazan ajustes de muestreo como temperature. Si un ajuste parece no hacer nada, puede que el modelo no lo acepte. El comportamiento del modelo también depende mucho de qué modelo elegiste, así que el mismo valor puede sentirse diferente entre modelos.

Si usas un modelo de enrutamiento automático que puede cambiar qué modelo responde cada vez, tus parámetros pueden comportarse de forma diferente de un turno a otro. Fijar un modelo específico mantiene el comportamiento estable.

## Consejos de ajuste según el síntoma

La mayoría de la gente nunca cambia esto. Si quieres probar, cambia un ajuste a la vez para que puedas saber qué ayudó.

- Las respuestas se sienten rígidas o repetitivas: sube **Temperature** un poco, por ejemplo de 1 a un valor entre 1.1 y 1.3.
- Las respuestas se sienten caóticas o fuera de tema: baja **Temperature**, por ejemplo a un valor entre 0.7 y 0.9.
- Las respuestas se cortan a la mitad: sube **Max Output Tokens**.
- Un personaje repite una y otra vez la misma forma de hablar: sube **Frequency** o **Presence** un poco, por ejemplo a un valor entre 0.3 y 0.6.

Estas son reglas generales, no recomendaciones probadas. Distintos modelos responden de forma distinta, así que un valor que funciona en una conexión puede no trasladarse a otra.

Para ver exactamente qué parámetros se enviaron en un mensaje, usa **Peek Prompt**. Muestra el prompt ensamblado más el modelo, la temperature, el máximo de tokens, el reasoning effort y más.

## Guías relacionadas

- [Editor de presets y Prompt Manager](presets.md)
- [Peek Prompt: mira lo que recibió la IA](../chats/peek-prompt.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
