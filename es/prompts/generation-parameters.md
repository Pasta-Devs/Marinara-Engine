# Parámetros de generación

Los parámetros de generación son los ajustes que controlan cómo escribe el modelo cada respuesta, como **Temperature** (Temperatura) y **Max Output Tokens** (Máximo de tokens de salida). Los presets (ajustes guardados) y las cuentas aportan valores predeterminados, y la sección **Advanced Parameters** (Parámetros avanzados) de **Chat Settings** (Ajustes del chat) los sustituye para un chat. Los valores predeterminados funcionan bien para el chat normal y el roleplay, así que cambia estos ajustes solo para arreglar un problema concreto.

## Dónde encontrarlos

| Qué | Dónde |
| --- | --- |
| Valores iniciales de un preset | **Presets**, abre un preset, pestaña **Parameters** (Parámetros) |
| Valores guardados en una cuenta | **Connections** (Conexiones), abre la cuenta, sección **Chat defaults** (Valores predeterminados del chat) |
| Sustituciones para un chat | **Chat Settings**, sección **Advanced Parameters** |

Los presets no fijan límites de tokens de contexto ni de salida. Configura la ventana de contexto en **Connections**, y los límites de salida en **Connections** o en **Advanced Parameters**. Los archivos de preset antiguos siguen cargándose, pero se ignoran sus límites de tokens guardados. El **Marinara's Universal Preset** integrado no aporta ningún parámetro de generación.

Para sustituir los parámetros de un chat:

1. Abre el chat.
2. Abre **Chat Settings**.
3. Busca **Advanced Parameters** y haz clic para desplegarlo.
4. Busca el parámetro, por ejemplo **Temperature**, y escribe un valor nuevo.
5. Revisa el pequeño interruptor junto a su nombre. Si está desactivado, actívalo. Un parámetro con el interruptor desactivado no se envía, así que tu cambio no hace nada. **Temperature** empieza con su interruptor desactivado (consulta [El interruptor de envío](#the-send-switch)).

Verás una nota: "Change generation settings for this chat only. Leave these alone unless you know what they do." (Cambia los ajustes de generación solo para este chat. No los toques salvo que sepas lo que hacen.) **Advanced Parameters** está disponible en los chats de Conversation, Roleplay y Game.

## Cada parámetro en lenguaje claro

Cada parámetro numérico tiene una casilla de entrada y un interruptor de envío (consulta más abajo).

| Parámetro | Qué hace | Rango |
| --- | --- | --- |
| **Temperature** | Aleatoriedad. Más bajo es más enfocado y predecible. Más alto es más creativo. Cerca de 1 es un punto medio común. | De 0 a 2 |
| **Max Output Tokens** | La respuesta más larga que el modelo puede escribir en un turno. Los tokens son fragmentos pequeños de texto. Súbelo si las respuestas se cortan. | Sin límite superior fijo |
| **Top P** | El modelo solo elige entre las palabras más probables cuya probabilidad combinada alcanza este valor. 1 lo considera todo. | De 0 a 1 |
| **Top K** | Limita el modelo a las pocas palabras más probables en cada paso. 0 lo desactiva. Muchos proveedores lo ignoran. | De 0 a 500 |
| **Frequency** | Penaliza las palabras cuanto más veces aparecieron ya. Los valores positivos reducen las palabras repetidas. | De -2 a 2 |
| **Presence** | Penaliza las palabras que aparecieron aunque sea una vez. Los valores positivos empujan hacia temas nuevos. | De -2 a 2 |

**Frequency** y **Presence** son las penalizaciones por repetición.

**Reasoning Effort** (Esfuerzo de razonamiento) le dice a un modelo con capacidad de razonamiento, uno que primero resuelve un problema en pasos ocultos, cuánto razonar antes de responder. Las opciones son **Off**, **Low**, **Medium**, **High**, **Extra high** y **Maximum**. Si el modelo no admite tu nivel, Marinara lo baja al nivel más fuerte que el modelo permite. Después de elegir un modelo, los botones llevan el nombre del nivel que recibe ese modelo, así que **Maximum** puede aparecer como **Max**, **Extra high** o **High**.

- Con el interruptor de envío activado, **Off** le pide al proveedor que desactive el razonamiento, cuando se sabe que el modelo lo admite. Algunos modelos no pueden desactivar el razonamiento y pueden seguir devolviéndolo. Elige un modelo sin razonamiento cuando sea imprescindible que no lo haya.
- Con el interruptor de envío desactivado, no se envía ninguna preferencia de razonamiento, y el proveedor usa su propio valor predeterminado.

**Verbosity** (Verbosidad) fija cuán largas y detalladas deben ser las respuestas: **None**, **Low**, **Medium** o **High**. Solo algunos modelos lo usan.

## Consejos de ajuste

Cambia un ajuste a la vez para que puedas saber qué ayudó. Son reglas generales, y los modelos difieren.

| Problema | Prueba |
| --- | --- |
| Las respuestas se sienten rígidas o repetitivas | Sube **Temperature** un poco, a un valor entre 1.1 y 1.3. |
| Las respuestas se sienten caóticas o se salen del tema | Baja **Temperature**, a un valor entre 0.7 y 0.9. |
| Las respuestas se cortan | Sube **Max Output Tokens**. |
| Un personaje repite la misma forma de expresarse | Sube **Frequency** o **Presence** un poco, a un valor entre 0.3 y 0.6. |

Para ver qué parámetros se enviaron en un mensaje, usa **Peek Prompt**. Muestra el prompt (las instrucciones enviadas a la IA) ensamblado más el modelo, la temperatura, el máximo de tokens, el esfuerzo de razonamiento y más.

<a id="the-send-switch"></a>

## El interruptor de envío

Cada parámetro numérico, más **Reasoning Effort** y **Verbosity**, tiene un pequeño interruptor junto a su nombre. No tiene etiqueta de texto. Pasa el cursor sobre él para ver "This parameter is sent to the model" (Este parámetro se envía al modelo) o "This parameter is not sent to the model." (Este parámetro no se envía al modelo).

- Activado: Marinara incluye el parámetro en la solicitud.
- Desactivado: Marinara lo deja fuera, y el proveedor usa su propio valor predeterminado. Esto es distinto de un valor como 0 o 1, que sigue diciéndole al proveedor qué usar.

Úsalo cuando un proveedor diga que dos ajustes no se pueden usar juntos (desactiva uno), o cuando un error diga que un parámetro no se acepta (desactívalo) o es obligatorio (actívalo).

En los **Advanced Parameters** de un chat, solo **Max Output Tokens** y **Reasoning Effort** se envían de forma predeterminada.

## Valores predeterminados

Estos son los valores que muestra el editor, no siempre lo que se envía. Sin preset, la generación empieza con 4096 tokens de salida antes de aplicar las sustituciones de la cuenta y del chat. Una escena activa puede usar 8192. La línea **Effective** (Efectivo) muestra el valor resultante.

| Parámetro | Valor inicial | Enviado de forma predeterminada |
| --- | --- | --- |
| Temperature | 1 | No |
| Max Output Tokens | 4096 en Conversation, 8192 en Roleplay; sin sustitución de Game | Sí |
| Top P | 1 | No |
| Top K | 0 (desactivado) | No |
| Frequency | 0 | No |
| Presence | 0 | No |
| Reasoning Effort | Maximum | Sí |
| Verbosity | High | No |

Un valor sigue mostrándose en la casilla cuando su interruptor de envío está desactivado. No se envía hasta que actives el interruptor.

## Prefills y etiquetas de pensamiento

**Assistant Prefill** es un texto opcional que se agrega al comienzo de la respuesta de la IA. Déjalo vacío salvo que un modelo lo admita.

- Es lo último que se envía, después de tu mensaje y de todas las instrucciones que lo siguen.
- Si el chat termina en una respuesta de la IA y **Post-Processing Messages** está en **Apply**, el prefill se agrega al final de esa respuesta.
- Algunos modelos rechazan un prompt que termina con las propias palabras de la IA, incluido **Claude (Subscription)** con cualquier modelo. Para ellos, Marinara agrega el prefill al comienzo de la última respuesta de la IA, así que la respuesta nueva no empieza con él.
- En un chat que todavía no tiene ninguna respuesta de la IA, el prefill se envía como tu mensaje al final.

**Assistant Reasoning Prefill** (Prellenado del razonamiento del asistente) es un texto oculto opcional que se agrega al comienzo del razonamiento de la IA, antes de la respuesta visible. Úsalo solo con modelos que admitan un prefill de razonamiento independiente, como Kimi K3. Se puede usar junto con **Assistant Prefill**.

**Thinking Tags** (Etiquetas de pensamiento) le dicen a Marinara cómo marca un modelo su razonamiento oculto en el texto plano, para que pueda ocultar ese razonamiento tras **View model thoughts** (Ver los pensamientos del modelo). Escribe una envoltura por línea, con un hueco en el medio para el texto oculto. Las envolturas comunes como think, thinking, thought, pipe, channel y los pares de corchetes ya se reconocen. Solo necesitas esto para una envoltura poco habitual.

## Custom Parameters

**Custom Parameters** (Parámetros personalizados) te permite agregar ajustes en bruto para los que Marinara no tiene un campo. Escribe un objeto JSON, y Marinara lo fusiona en la solicitud.

- Guardados como valores predeterminados de la cuenta, se envían en cada generación de texto que usa la cuenta: Conversation, Roleplay, Game, Noodle, resúmenes, agentes y paquetes de agentes instalados. Esto incluye los endpoints personalizados de tu propia máquina.
- Los Custom Parameters por chat se agregan para ese chat y sustituyen las claves coincidentes de la cuenta.
- Una clave incorrecta puede hacer que el proveedor rechace la solicitud. Usa `true`, `false` y `null` en minúsculas. Deja esto vacío salvo que la guía de un proveedor te diga que agregues una clave.

## Service Tier

**Service Tier** (Nivel de servicio) solo aparece cuando la cuenta del chat usa OpenRouter o NanoGPT. Elige cómo enruta el proveedor tu solicitud. **Default** no envía ningún nivel. **Flex** puede ser más barato y más lento. **Priority** puede ser más rápido y costar más.

## Límite de mensajes de contexto

**Limit Context Messages** (Limitar mensajes de contexto; también aparece como **Context message limit**) envía solo los últimos N mensajes en lugar de todo el chat. Está desactivado de forma predeterminada. Cuando lo activas, el conteo empieza en 50, y puedes fijar de 1 a 9999. Un número menor baja el costo y acelera las cosas, y la IA recuerda menos.

En un chat de Roleplay con **Advanced Memory Recall** (Recuperación avanzada de memoria) activado, este límite no se usa. Advanced Memory Recall fija cuánto historial se envía con **Maximum allowed context before compression (tokens)** (Contexto máximo permitido antes de la compresión: tokens). Para enviar menos, baja ese ajuste en **Chat Settings → Memory Recall**. Consulta [Advanced Memory Recall](../agents/memory.md#advanced-memory-recall-roleplay-and-game-mode).

## Exclude Past Reasoning

**Exclude Past Reasoning** (Excluir el razonamiento anterior) está activado de forma predeterminada. Mantiene el razonamiento guardado de turnos anteriores fuera de los prompts nuevos. Déjalo activado salvo que tengas una razón clara para volver a enviar el razonamiento antiguo.

Al desactivarlo aparece **Past reasoning blocks** (Bloques de razonamiento anteriores). El valor predeterminado es 1, que conserva el bloque de razonamiento disponible más reciente. Un valor de 0 incluye todos los bloques disponibles. Esto no borra los pensamientos guardados, y solo se puede reenviar el razonamiento que admite la cuenta actual.

## Image captioning

**Image captioning** (Descripción de imágenes) hace que Marinara describa con palabras cada imagen adjunta, usando otro modelo, en lugar de enviar la imagen. Úsalo con modelos que no pueden ver imágenes. Está desactivado de forma predeterminada.

1. En **Advanced Parameters**, activa **Image captioning**.
2. Elige un modelo en el menú desplegable **Captioning model** (Modelo de descripción).
3. Si quieres, edita el **Captioning Prompt** (Prompt de descripción), las instrucciones que se envían con cada imagen. El botón de restablecer, o vaciar el cuadro, recupera el valor predeterminado. El prompt se guarda solo para este chat, y **Save as Connection Default** (Guardar como predeterminado de la conexión) no lo copia.

Si no funcionó: cuando la descripción falla, porque la cuenta que genera las descripciones está rota, se eliminó o no devuelve nada, la respuesta se detiene con el error **Image captioning failed**. Marinara no envía la imagen en su lugar. Repara o cambia el modelo de descripción, o desactiva **Image captioning**.

## Save as Connection Default

En la parte inferior de **Advanced Parameters**, **Save as Connection Default** escribe tus valores actuales en la cuenta. Los chats nuevos que usan esa cuenta parten entonces de ellos. Solo aparece para una cuenta normal y guardada. Está oculto para el grupo aleatorio y para el modelo integrado.

**Reset to Defaults** (Restablecer valores predeterminados) borra todos los cambios por chat y devuelve el chat a sus ajustes heredados. Los interruptores de envío heredados siguen la cuenta seleccionada. Un interruptor de envío que cambiaste tú sigue siendo una sustitución del chat hasta que lo restablezcas.

## Cómo se superponen y sustituyen los valores predeterminados

Marinara resuelve cada parámetro recorriendo esta lista. Los elementos posteriores sustituyen a los anteriores.

1. Los **Parameters** del preset, o los valores predeterminados integrados si no se usa ningún preset. La salida empieza en 4096 tokens, porque los presets no pueden fijar límites de salida. En Roleplay, el preset asignado en la cuenta tiene prioridad sobre el preset seleccionado en el chat.
2. Los **Chat defaults** de la cuenta.
3. Los **Advanced Parameters** de este chat.
4. Reglas del modo. Un chat de escena activo fija la salida en 8192, el razonamiento en **Maximum** y la verbosidad en **High**. Game usa los parámetros guardados de la cuenta y del chat sin forzar el muestreo, el razonamiento ni un tamaño mínimo de salida.
5. Límites de salida. Game aplica el límite de salida conocido del modelo, y el **Max output tokens override** (Sustitución del máximo de tokens de salida) de la cuenta limita las solicitudes en todos los modos. El contexto disponible puede reducir aún más el presupuesto.

La línea **Effective** junto a un parámetro muestra el valor que gana y de qué capa viene, por ejemplo **Effective: 16384 · this chat**, o **Effective: 4096 · output token cap** cuando se aplica un límite de la cuenta. Un interruptor de envío desactivado muestra **not sent**. Los proveedores todavía pueden exigir parámetros o ajustar valores no compatibles. Custom Parameters y el ajuste al contexto pueden cambiar la solicitud final. Restablecer los parámetros del chat solo quita la sustitución de este chat (elemento 3). El valor viene entonces de los **Chat defaults** de la cuenta, si están configurados, o si no, del preset. Las reglas del modo y los límites de salida (elementos 4 y 5) se siguen aplicando después.

<a id="parameters-for-agents"></a>

## Parámetros para agentes

Las llamadas de los agentes usan los **Chat defaults** guardados en la cuenta con la que se ejecutan: la cuenta propia del agente, o la del chat si el agente no tiene una. Los interruptores de envío y los límites del modelo se aplican como en una respuesta del chat. Los presets y los **Advanced Parameters** de un chat no cambian las llamadas de los agentes, salvo por la regla de temperatura de más abajo.

- **Se envían a los agentes:** Temperature, Top P, Top K, Frequency, Presence, Reasoning Effort, Verbosity, Service Tier, Custom Parameters, los encabezados personalizados y los parámetros adicionales que agregas en **Settings** (Configuración), luego **Advanced** (Avanzado) y luego **Parameters** (Parámetros), como Top A o una semilla. Un parámetro con el interruptor de envío desactivado no se envía.
- **No se envían a los agentes:** Max Output Tokens, secuencias de parada, prefills, Thinking Tags y otros ajustes de formato del prompt. Cada agente conserva su propio **Max Output Tokens**.
- **Temperature:** un agente usa la temperatura de la cuenta, o 0.7 si no hay ninguna guardada. Beholder siempre usa 0, y el escritor de prompts de Illustrator usa su propio valor. Durante una respuesta del chat, los agentes que usan la cuenta del chat toman la temperatura y los interruptores de envío que resolvió el chat. Los reintentos usan los valores guardados de la cuenta.
- **Reasoning Effort:** el nivel que eliges, o **Off** (Desactivado), se aplica a todos los agentes de esa cuenta cuyo modelo lo admite. **Use custom defaults for this model** (Usar valores predeterminados personalizados para este modelo) inicia Reasoning Effort en **Maximum** en la mayoría de las cuentas (**Default** en Codex), así que los agentes razonan al nivel más alto, lo que es más lento y cuesta más. Elige un nivel inferior, o desactiva su interruptor de envío, para que razonen menos. Si no hay ningún nivel guardado, los agentes que responden en JSON piden desactivar el razonamiento, y los demás agentes dejan el valor predeterminado del modelo. Gemini 4 Argon y Carbon no pueden desactivar el razonamiento, así que en Google AI Studio y Vertex sus agentes envían **Medium** en su lugar.
- **Espacio para razonar:** cuando la cuenta guarda un Reasoning Effort, o el modelo es Gemini 4 Argon o Carbon, Marinara agrega espacio para razonar además del **Max Output Tokens** del agente, dentro del límite de salida de la cuenta, el límite del modelo y el contexto libre. Un endpoint personalizado lo recibe incluso cuando no envía el nivel.

Los paquetes de agentes instalados siguen los mismos valores de la cuenta. Un valor que la cuenta guarda y envía sustituye lo que pide el paquete, y cualquier ajuste sin configurar conserva el valor propio del paquete. Si **Reasoning Effort** o **Max Output Tokens** están desactivados en la cuenta, no se envían, aunque el paquete los pida. Temperature y Verbosity empiezan desactivados, así que se conserva el valor propio del paquete.

## Algunos modelos ignoran algunos parámetros

No todos los modelos aceptan todos los parámetros. Cuando Marinara sabe que un modelo rechaza un ajuste, lo deja fuera de la solicitud. El control sigue apareciendo, pero cambiarlo no tiene efecto. Esto es común con los modelos de razonamiento, que rechazan ajustes de muestreo como la temperatura. Con un modelo de enrutamiento automático que cambia qué modelo responde cada vez, los parámetros pueden comportarse de forma distinta de un turno a otro. Fija un solo modelo para mantener un comportamiento estable.

## Guías relacionadas

- [Editor de presets y Prompt Manager](presets.md)
- [Peek Prompt: mira lo que recibió la IA](../chats/peek-prompt.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
