# Modelos de decisión

Un modelo de decisión es un modelo pequeño que responde preguntas breves sobre tu chat para Marinara, como "Does the latest message move the scene to a new place?" o "What is Kaelen's mood: angry, sad or calm?". Algunos también pueden examinar las imágenes y los clips del chat. Lo usan los lorebooks (libros de trasfondo), los agentes personalizados, los prompts (las instrucciones enviadas a la IA), los chats grupales y el Illustrator. Es opcional. Sin uno, los chats siguen funcionando y cada función usa el respaldo descrito en [Dónde lo usa Marinara](#where-marinara-uses-it).

Sus respuestas controlan lo que hace Marinara y nunca se publican en el chat. Consulta [Qué puede responder un modelo de decisión](#what-a-decision-model-can-answer) para conocer los tipos de preguntas y ver ejemplos.

Nuestro consejo: déjalo en **None** (ninguno) si tienes dudas. Si quieres decisiones, usa el modelo integrado que quizá ya tengas o un modelo de chat en un servidor que ya ejecutas. Ninguna de las dos opciones cuesta nada adicional.

## Qué puede responder un modelo de decisión

Cada respuesta llega como un número de 0 a 1: cuánta confianza tiene el modelo. Marinara convierte ese número en la respuesta que necesita una función.

### Sí o no

El modelo lee una declaración e indica qué tan probable es que sea verdadera. Marinara compara ese valor con un [umbral](#thresholds): si lo alcanza o lo supera, cuenta como sí. Este es el tipo más común, usado por las preguntas de activación, los campos **Decision** (Decisión) de lorebooks, `{{#if decision:"..."}}` y las comprobaciones del Illustrator.

| Declaración | Qué podría activar |
| --- | --- |
| `In the latest message, the characters move to a different location` | Un tracker actualiza la ubicación solo en los turnos en los que cambió. |
| `In the latest message, a dragon is physically present` | Una entrada de lorebook sobre dragones se agrega al prompt. |
| `{{user}} asked a question that {{char}} has not answered yet` | Una línea del prompt le recuerda al modelo que la responda. |
| `The latest message describes a fight` | Un agente de combate se ejecuta solo en este turno. |

### Una entre varias respuestas

El modelo elige la opción que mejor encaja de una lista corta que escribes. Marinara pregunta por cada opción y conserva la de mayor puntuación, así que obtienes una respuesta, no varias. Usa `{{#if decision_choice:"..." == "..."}}`:

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen speaks in short, clipped sentences.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and avoids eye contact.
{{else if decision_choice:"Kaelen's mood in the latest message" == "calm"}}
Kaelen speaks normally.
{{/if}}
```

Otras listas que funcionan bien: el tipo de escena (`combat`, `dialogue`, `exploration`, `rest`), el momento del día (`morning`, `afternoon`, `evening`, `night`) o en qué habitación de una casa transcurre la escena. Mantén las opciones diferenciadas y agrega una como `none of these` cuando pueda no encajar ninguna. Los agentes usan lo mismo para elegir uno de varios conjuntos de instrucciones, y el Illustrator lo usa para elegir el tipo de clima.

### Una puntuación

Algunas funciones usan el número en sí en lugar de un sí o un no. El [orden de respuesta Smart](../chats/group-chats.md#response-order-individual-only) puntúa qué tan probable es que cada personaje hable después y elige la puntuación más alta. [Advanced Memory](../agents/memory.md#optional-decision-model) puntúa qué tan relevante es cada escena pasada. **Test decisions** (Probar decisiones) de Peek Prompt muestra la puntuación de cada declaración, lo que te ayuda a elegir un umbral. Consulta [Probar declaraciones de decisión](../chats/peek-prompt.md#testing-decision-statements).

### Imágenes y clips

Un modelo de decisión integrado que lee imágenes puede responder los mismos tipos de preguntas sobre las imágenes del chat, como `The picture shows the character at the beach`. Liquid d1, Valen y Winnow leen imágenes, y la versión completa de Valen también lee clips cortos. Los demás modelos y todas las cuentas alojadas o de servidor solo leen texto y nunca reciben imágenes.

Nunca se envían imágenes a menos que las pidas, porque cada una hace que la respuesta tarde más:

- En una declaración, agrega `pictures:1` (hasta 3) o `clips:1`. Agrega `media_within:2` para preguntar solo cuando uno de los últimos 2 mensajes tenga una imagen. Consulta [Imágenes y clips](../prompts/conditional-prompts.md#pictures-and-clips).
- En una entrada de lorebook, configura **Show the decision model** (Mostrar al modelo de decisión) debajo de su campo **Decision**. Consulta [Activación por decisión](../lorebooks/entries.md#decision-activation).
- En la pregunta de activación de un agente personalizado, configura **Show the decision model**. Consulta [Preguntas de activación](../agents/custom-agents.md#activation-questions).
- Funciones propias de Marinara que usan imágenes: consulta [Funciones que examinan imágenes](#features-that-look-at-pictures).

### Qué muestra la página de un modelo

La página de cada modelo de decisión integrado muestra dos líneas:

- **Answers** (Respuestas) enumera para qué respuestas se creó el modelo: **Yes/no** (Sí/no), **Weighted choice** (Elección ponderada), **Score on a scale** (Puntuación en una escala) y, para algunos, **Boxes on a picture** (Recuadros en una imagen: dónde está algo en una imagen). Marinara hace preguntas de sí o no y de elección, y lee sus puntuaciones. Todavía no pide recuadros, así que esa línea solo describe el modelo.
- **Reads** (Lee) enumera **Text** (Texto), **Pictures** (Imágenes) y **Video**. Un tipo que solo lee otra versión del modelo se nombra después de los demás, por ejemplo "Video en su versión completa".

## Elegir un modelo de decisión

Antes de empezar, consulta [Cuál elegir](#which-one-to-pick).

1. Haz clic en **Connections** (Conexiones) en la barra superior y abre el cuadro **Jobs** (tareas).
2. En **Behind the scenes** (entre bastidores), haz clic en la fila **Decision** (decisión). Se abre una lista.
3. Elige un modelo. La lista tiene tres grupos:
   - **None (decisions off)** (ninguno: decisiones desactivadas) es el predeterminado. No se pregunta nada y los campos de preguntas de activación del editor de agentes permanecen desactivados.
   - **Built-in model** (modelo integrado) enumera los modelos que Marinara ejecuta en tu computadora: **Built-in model**, **Built-in model (utility)** (modelo integrado: auxiliar) y **Built-in model (decisions)** (modelo integrado: decisiones). Nada sale de tu computadora.
   - **Connections** enumera tus cuentas que pueden responder decisiones: alojadas, o un modelo de chat en un servidor que ya ejecutas.

   Haz clic en una cuenta de la izquierda para ver sus modelos. Una cuenta de NanoGPT, OpenRouter o Google Gemini muestra sus propios modelos de decisión primero, en **Decision models** (Modelos de decisión), y debajo sus modelos de chat, en **Chat models** (Modelos de chat). Una cuenta de Google Gemini solo muestra sus modelos de decisión porque sus modelos de chat no pueden responder decisiones. Un modelo de decisión que elegiste antes aparece encima de **Starred** (Destacados), con el nombre de su cuenta debajo.
4. Para probarlo, haz clic en el engranaje **Decision settings** (ajustes de decisión) de la fila y luego en **Test** (probar). Ese botón aparece para las entradas del modelo integrado. Para un modelo de decisión de TypeSafe, OpenRouter, NanoGPT o Google Gemini, abre **Edit model** (editar modelo) y haz clic en **Test provider** (probar proveedor). Para una cuenta **Own decision server** (servidor de decisiones propio), usa **Test** en el menú **⋯** de la cuenta.

Una prueba correcta muestra la probabilidad de sí y cuánto tardó la respuesta. Para un modelo en tu computadora también indica si había log-probabilidades disponibles y si el modelo responde directamente. Las log-probabilidades son los números de confianza del modelo para cada palabra que podría escribir. La prueba envía una muestra fija, no tu chat.

Si no funcionó, el mensaje explica por qué. Causas habituales: la clave fue rechazada, el servicio está limitando las solicitudes, el modelo integrado no está en ejecución o la respuesta superó el límite de tiempo. Consulta [Solución de problemas](#troubleshooting).

Las entradas que no pueden responder ahora permanecen en la lista, en gris y con el motivo. Elegir **None** desactiva las decisiones sin borrar ninguna pregunta de activación ni declaración de decisión.

<a id="which-one-to-pick"></a>

### Cuál elegir

- **Un modelo que ya ejecutas en el modelo integrado.** No cuesta nada adicional. Lo mejor para la mayoría de quienes usan el modelo integrado.
- **Un modelo de chat en tu propio servidor** (Ollama, LM Studio, llama.cpp u otro servidor compatible con OpenAI). No cuesta nada adicional. Útil cuando tu modelo se ejecuta fuera de Marinara, para no cargarlo dos veces.
- **Un modelo de decisión alojado** (TypeSafe, OpenRouter, NanoGPT o Google Gemini). Se factura por solicitud, y un turno puede hacer varias. Una suscripción a NanoGPT incluye algunos modelos de decisión y OpenRouter ofrece algunos gratuitos. Útil para teléfonos y computadoras que no ejecutan ningún modelo local.
- **El modelo de decisión integrado.** Un modelo creado específicamente para decisiones que Marinara descarga y ejecuta junto a tu modelo de chat, con su propio espacio en disco y memoria. La mayoría se ejecuta en casi cualquier computadora, algunos solo en el procesador. La única opción que puede examinar imágenes y clips. Consulta [Dejar que Marinara instale un modelo de decisión](#let-marinara-install-a-decision-model).

Si ya ejecutas un modelo local, pruébalo primero y prueba turnos de tus propios chats. La redacción importa mucho. Consulta [Redactar declaraciones](../prompts/conditional-prompts.md#writing-statements).

Jev y Open-Jev son modelos distintos. Jev es el modelo alojado de TypeSafe, disponible directamente o mediante OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) es un modelo publicado por separado y basado en Qwen, que Marinara puede ejecutar localmente. Las pruebas de Open-Jev no miden Jev alojado.

En Android (Termux), solo se ofrecen JevK5 y Liquid d1 como **Built-in decision model** (modelo de decisión integrado), y el procesador de un teléfono puede ser demasiado lento para ellos. Una cuenta alojada es la opción práctica, por ejemplo Jev mediante OpenRouter. Consulta [Configurar una cuenta Decision](#set-up-a-decision-account).

Escribe los presets (ajustes guardados), las tarjetas y los agentes para "un modelo de decisión", nunca como "requiere Jev". Una declaración que pide imágenes sigue funcionando con un modelo que solo lee texto: recibe solo el texto. Usan la misma sintaxis de declaraciones con cualquier modelo, pero los modelos pueden dar respuestas distintas. Cuando importas contenido que usa decisiones, incluidos agentes personalizados e instalaciones de Agent Organizer, Marinara muestra un aviso con un enlace a esta guía. Restaurar un ZIP de perfil completo no lo muestra.

## Usar el modelo integrado

Si tienes descargado el modelo integrado, puedes usarlo para decisiones sin cuenta y sin costo. Consulta [Configuración del modelo integrado](local-model.md).

1. Haz clic en la fila **Decision**, en **Behind the scenes**, dentro del cuadro **Jobs**.
2. Elige **Built-in model** (o **Built-in model (utility)** si tienes uno).
3. Haz clic en el engranaje **Decision settings** y luego en **Test**.

Marinara hace una sola pregunta de sí o no al modelo, le permite escribir un token (un fragmento de texto) y lee la respuesta a partir de las probabilidades de ese token. No se escribe ninguna respuesta, así que la solicitud es corta. Una elección entre varias respuestas se formula como una pregunta de sí o no por respuesta.

El ajuste **Thinking** (razonamiento) controla qué pasa cuando un modelo no puede responder con una palabra. Algunos modelos siempre razonan primero.

| Thinking | Qué hace |
| --- | --- |
| **Auto (try one word, allow thinking if the model cannot)** (automático: intentar una palabra y permitir el razonamiento si el modelo no puede) | Predeterminado. Tras dos respuestas fallidas de una palabra seguidas, se permite que el modelo razone primero, y Marinara te lo indica. |
| **Off (always answer in one word)** (desactivado: responder siempre con una palabra) | Un modelo que no puede responder con una palabra no da respuesta. |
| **Allowed (let the model think first)** (permitido: dejar que el modelo razone primero) | Nunca pide al modelo que omita el razonamiento. |

Un modelo que razona primero tarda segundos, así que de forma predeterminada solo responde para comprobaciones que se ejecutan después de que la respuesta aparece en pantalla, como los agentes de posprocesamiento. Para que también controle los agentes que se ejecutan antes de la respuesta, activa **Also gate agents that run before the reply** (evaluar también los agentes que se ejecutan antes de la respuesta). Entonces cada respuesta lo espera.

Las probabilidades de sí o no de un modelo de chat general sirven para un umbral, pero no se entrenaron para estar calibradas como las de un modelo creado específicamente para decisiones. Un entorno de ejecución que no devuelve log-probabilidades responde con un 1 o un 0 fijo. Ajusta los umbrales con tus propios chats.

<a id="on-a-server-you-already-run"></a>

### En un servidor que ya ejecutas

Si tu modelo de chat se ejecuta en Ollama, LM Studio, llama.cpp u otro servidor compatible con OpenAI, puede responder decisiones sin que Marinara cargue una segunda copia.

1. Haz clic en la fila **Decision**, en **Behind the scenes**, dentro del cuadro **Jobs**. El selector enumera los modelos de todas las cuentas, incluido tu modelo de chat. O haz clic en **⋯** en el modelo y elige **Use for…** (Usar para…) → **Decision**.
2. Haz clic en el engranaje de la fila **Decision** y luego en **Test**. Una prueba correcta indica si el servidor devolvió log-probabilidades y si el modelo tuvo que razonar primero. Haz clic en **Done** (listo).
También puedes crearla tú. Usa una cuenta Decision con la fuente **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)** (modelo de chat compatible con OpenAI: Ollama, LM Studio, llama.cpp), la misma dirección que tu cuenta de chat (por ejemplo `http://localhost:11434/v1` para Ollama) y el nombre de modelo que usa el servidor.

Se consulta igual que el modelo integrado: una palabra de sí o no por declaración. Las declaraciones se envían de una en una, porque Marinara no puede saber cuántas solicitudes procesa tu servidor a la vez. **Thinking** siempre es **Auto** para una cuenta. Un servidor en otra computadora necesita `PROVIDER_LOCAL_URLS_ENABLED`. Consulta [Conectar un modelo local o autoalojado](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

<a id="set-up-a-decision-account"></a>

## Configurar una cuenta Decision

Una cuenta Decision alojada envía al servicio los mensajes recientes seleccionados y las declaraciones, y puede costar dinero. El orden de respuesta Smart también envía una [lista de personajes](#what-the-model-sees).

1. Haz clic en **Connections** en la barra superior y luego en **Add** (añadir).
2. Haz clic en **Decision** (Decisión) en los filtros de tipo y luego en **TypeSafe** u **Own decision server**. Para NanoGPT, consulta [Mediante NanoGPT](#through-nanogpt). Para OpenRouter o Google Gemini, consulta [Mediante OpenRouter o Google Gemini](#through-openrouter-or-google-gemini).
3. Introduce la **API key** (clave de API) o, para **Own decision server**, la **Server address** (dirección del servidor). Haz clic en **Connect** (conectar).
4. En **Found in TypeSafe — use it for:** (Encontrado en TypeSafe: úsalo para), marca **Decision** y luego haz clic en **Done**. La fila **Decision**, en **Behind the scenes**, dentro del cuadro **Jobs**, ahora muestra el modelo.
5. Para probarlo, haz clic en el modelo en el panel para abrir **Edit model** y luego haz clic en **Test provider** en la tarjeta **Provider tests** (pruebas del proveedor). Un modelo de **Own decision server** no tiene ahí el botón **Test provider**. En su lugar, abre el menú **⋯** de la cuenta en el panel y haz clic en **Test**.

Un **Test provider** correcto muestra la probabilidad, cuánto tardó la respuesta y el límite de tiempo de la cuenta. El **Test** de la cuenta en el menú **⋯** solo indica si funcionó y cuánto tardó. La prueba espera al menos 10 segundos, o 5 segundos más que un límite mayor. Si la respuesta tardó más que el límite, el resultado lo indica: en los chats, esa respuesta contaría como ausencia de respuesta.

Si no funcionó, consulta [Solución de problemas](#troubleshooting).

Un modelo de decisión tiene estos campos. Haz clic en el modelo en el panel para abrir **Edit model**, o haz clic en el engranaje de la fila **Decision** en el cuadro **Jobs** para abrir **Decision settings** del modelo de decisión actual:

| Campo | Qué hace |
| --- | --- |
| **Decision source** (fuente de decisión) | **TypeSafe**, **OpenRouter**, **NanoGPT**, **Google Gemini**, **Custom System One endpoint** (endpoint System One personalizado) u **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. Queda fija al crear el modelo. |
| **API key source** (origen de la clave de API) | **Enter a separate key (optional for local servers)** (introducir una clave aparte: opcional para servidores locales) o **Use key from …** (usar la clave de …) otra cuenta. Las claves vinculadas siguen los cambios posteriores de la clave. Un modelo System One personalizado o compatible con OpenAI puede tomar prestada la clave de una cuenta de chat personalizada solo cuando ambas direcciones tienen el mismo esquema, host y puerto. |
| **Recent-message token budget** (presupuesto de tokens de mensajes recientes) | Cuántos tokens estimados del chat se envían. De 1 a 30.000. 30.000 de forma predeterminada para TypeSafe, OpenRouter, NanoGPT y Google Gemini, y 3.500 para servidores personalizados. Si un modelo de decisión de una cuenta de NanoGPT, OpenRouter o Google Gemini tiene un límite de entrada menor, recibe tres cuartas partes de ese límite. Marinara descarta primero los mensajes más antiguos y después recorta la parte más antigua del mensaje más reciente. Una solicitud rechazada o que supera el presupuesto no da respuesta. |
| **Time limit (seconds)** (límite de tiempo en segundos) | Cuánto se espera cada declaración durante los chats. De 0,5 a 30. 1,5 de forma predeterminada, o 4 para NanoGPT y para un modelo de chat compatible con OpenAI. Consulta [Límites de tiempo](#time-limits). |
| **Custom Request Headers** (Encabezados de solicitud personalizados) | Encabezados adicionales enviados con cada solicitud de decisión, como objeto JSON, por ejemplo `{"x-billing-mode": "paygo"}`. Los encabezados de autenticación para claves se rechazan. |

TypeSafe envía las solicitudes a `https://api.typesafe.ai`. Puedes reemplazar su **Base URL** (URL base) por otro servidor que ejecute la API de TypeSafe, sin `/v1/systemone`. Sigue necesitando tu clave de TypeSafe, que se envía a ese servidor. **Custom System One endpoint** acepta un servidor System One que ejecutes tú, como Open-Jev o [Strands decider](#run-strands-decider-yourself). Introduce su dirección sin `/v1/systemone`. Un servidor de modelos de chat como Ollama no habla System One. Usa **OpenAI-compatible chat model** para él.

<a id="through-nanogpt"></a>

### Mediante NanoGPT

NanoGPT ofrece sus propios modelos de decisión, como Jev Latest, y responde a las solicitudes en su API de decisiones con tu clave de NanoGPT. Algunos están incluidos en la suscripción a NanoGPT y el resto se cobra de tu saldo.

1. Conecta NanoGPT como de costumbre. En **Add** (Añadir), también aparece en el filtro de tipo **Decision**.
2. En **Found in NanoGPT — use it for:** (Encontrado en NanoGPT: úsalo para), marca **Decision**. Marinara elige un modelo de decisión incluido en tu plan y da prioridad a Jev Latest.
3. Para elegir otro modelo, haz clic en **⋯** en la cuenta de NanoGPT, luego en **Add model** (Añadir modelo) y en la pestaña **Decision**. Solo muestra modelos de decisión. La etiqueta **Plan** marca los incluidos en tu suscripción. Selecciona uno y haz clic en **Test decision** (Probar decisión).

Los modelos de decisión quedan fuera de las listas de modelos de chat, ya que no pueden chatear.

De forma predeterminada, NanoGPT decide si una solicitud se carga a tu suscripción o a tu saldo. Para usar siempre el saldo, abre **Edit model** en el modelo de decisión y escribe `{"x-billing-mode": "paygo"}` en **Custom Request Headers**.

<a id="through-openrouter-or-google-gemini"></a>

### Mediante OpenRouter o Google Gemini

Las cuentas de OpenRouter y Google Gemini también muestran sus propios modelos de decisión. Marinara los consulta en la API de decisiones del servicio con la clave de esa cuenta. OpenRouter ofrece muchos, algunos gratuitos (sus nombres terminan en `:free`). Google Gemini ofrece uno, **Gemini Decision 1**.

1. Conecta OpenRouter o Google Gemini como de costumbre.
2. Haz clic en la fila **Decision** en **Behind the scenes**, dentro del cuadro **Jobs**, y luego en la cuenta de la izquierda. Elige un modelo en **Decision models**.
3. Para probarlo, abre **Edit model** en ese modelo y haz clic en **Test provider**.

En una cuenta de OpenRouter, los modelos de chat que devuelven log-probabilidades aparecen a continuación en **Chat models** y también sirven. Una cuenta de Google Gemini solo ofrece su modelo de decisión.

Si añadiste una cuenta antes de esta versión, puede que al principio no muestre **Decision models** porque su lista guardada es anterior. Haz clic en el botón de actualizar del selector o espera a que Marinara actualice las listas guardadas, lo que hace una vez al día.

Una cuenta de decisión independiente de **OpenRouter** creada en **Add** sigue funcionando. Consulta la misma API con su propia clave.

Algunos servicios alojados a veces tardan más de 1,5 segundos, lo que hace que las decisiones parezcan fallar al azar. Prueba varias veces y fija el límite por encima de la respuesta más lenta. Las declaraciones que se preguntan antes de la respuesta, como las decisiones de un preset o una pregunta de activación de un agente que se ejecuta antes de la respuesta, pueden retrasarla hasta ese tiempo cada una.

Al borrar una cuenta cuya clave se usa para decisiones se muestra una advertencia. Después hay que volver a vincular la cuenta Decision, y hasta entonces las decisiones no dan respuesta. Los archivos de conexión importados nunca contienen API keys ni vínculos a cuentas prestadas, así que restáuralos a mano.

<a id="where-marinara-uses-it"></a>

## Dónde lo usa Marinara

- Las [preguntas de activación](../agents/custom-agents.md#activation-questions) deciden si se ejecuta un agente personalizado. Sin respuesta: la pregunta no lo detiene. Siguen aplicándose las palabras clave y **Trigger Cadence** (frecuencia de activación).
- Las [declaraciones en prompts](../prompts/conditional-prompts.md#asking-the-decision-model) eligen texto al preparar el prompt de un chat o de un agente. Sin respuesta: la decisión se interpreta como no, así que un bloque de decisión usa su rama `{{else}}`, si existe.
- Los [campos Decision de lorebooks](../lorebooks/entries.md#decision-activation) comprueban Require o Trigger durante el análisis de lorebooks. Sin respuesta: Require no puede admitir una entrada nueva y Trigger no añade ninguna vía. Siguen aplicándose las retenciones Sticky y las vías ordinarias de Trigger.
- El [orden de respuesta Smart](../chats/group-chats.md#response-order-individual-only) puntúa quién habla después en un chat grupal, si está activado. Sin respuesta: el orden Smart hace su llamada habitual a la IA.
- [Automatizar personajes activos](../chats/group-chats.md#automate-active-characters-merged-only) pregunta quién está en la escena antes de cada respuesta en un grupo de Roleplay en modo Merged, si está en **Decision model** (modelo de decisión). Sin respuesta: si ningún personaje recibe respuesta, usa la última escena del Character Tracker o conserva la lista.
- [Advanced Memory Recall](../agents/memory.md#optional-decision-model) puede usar su propio modelo de decisión para los límites de escena y la selección de recuerdos en Roleplay. Activa **Use Decision model** (usar modelo de decisión) en los ajustes de Advanced Memory de ese chat. Sin respuesta: las decisiones fallidas recurren a la recuperación o a las comprobaciones de escena habituales. Los resúmenes siguen usando el Helper model.

- Las [funciones que examinan imágenes](#features-that-look-at-pictures) comprueban imágenes nuevas, omiten repeticiones, reutilizan fondos y marcan caras de sprites, si están activadas. Necesitan un modelo de decisión que lea imágenes.

Una pregunta de activación decide si un agente se ejecuta. Una declaración de decisión dentro de su prompt decide qué se le dice a ese agente al ejecutarse. Usa `{{#if decision:"..."}}` para condiciones de sí o no y `{{#if decision_choice:"..." == "..."}}` para elegir entre respuestas.

### Funciones que examinan imágenes

Necesitan un modelo de decisión integrado que lea imágenes (Liquid d1, Valen o Winnow). Todas están desactivadas hasta que las activas. Sin un modelo así, aparecen en gris, con un ⓘ que explica el motivo. Una que hayas activado antes todavía se puede desactivar.

| Función | Dónde | Qué hace |
| --- | --- | --- |
| **Picture check** (Comprobación de imágenes) | **Chat Settings → Agents → Illustrator** (Ajustes del chat → Agentes → Illustrator) | Examina cada imagen nueva del Illustrator y selfie, y comprueba que muestre lo que se pidió. Una selfie también se compara con el avatar del personaje. **Make another if it doesn't match** (Crear otra si no coincide) dibuja una vez más si no coincide. **Always make two, keep the better** (Crear siempre dos y conservar la mejor) dibuja dos y conserva la que mejor coincide. Cada imagen adicional cuesta otra generación de imagen. |
| **Also check** (Comprobar también) | En **Picture check** | Tus propias comprobaciones, una por línea, hasta 6, como `Kaelen has short red hair`. Empieza una línea con `not:` para algo que la imagen no deba mostrar, como `not: The picture has writing or a watermark`. |
| **Skip a picture the newest one already shows** (Omitir una imagen si la más reciente ya muestra lo mismo) | Tarjeta del Illustrator | Antes de dibujar, compara la imagen más reciente del chat con lo que se va a dibujar y la omite si mostraría otra vez la misma escena. Las imágenes que pides siempre se crean. |
| **Reuse a library background that looks like the place** (Reutilizar un fondo de la biblioteca que se parezca al lugar) | Tarjeta del Illustrator | Cuando ningún fondo de tu biblioteca tiene el nombre de un lugar nuevo, examina hasta 4 que comparten palabras con él y muestra uno que coincida en lugar de pintar uno nuevo. Consulta [Comprobar imágenes con un modelo de decisión](../media/illustrator-agent.md#check-pictures-with-a-decision-model). |
| **Flag faces that don't match their expression** (Marcar los rostros que no coincidan con su expresión) | Ventana **Generate Sprites** (Generar sprites), solo expresiones | Examina cada cara después de dibujarla y marca las que podrían no mostrar su expresión, para que puedas desmarcarlas o volver a dibujarlas. Consulta [Generar sprites con IA](../characters/sprites.md#generate-sprites-with-ai). |

Una comprobación que no puede ejecutarse porque el modelo está desactivado, tarda demasiado o falla cuenta como aprobada: se conserva la imagen tal como se creó.

<a id="what-the-model-sees"></a>

## Qué ve el modelo

Para las preguntas de activación y las declaraciones de prompts y lorebooks, el modelo recibe la declaración y los mensajes recientes tal como se guardaron en el chat. No recibe tu preset, tu tarjeta de personaje, tu persona, las entradas de lorebook (tampoco las Constant), los resúmenes ni la salida de agentes. También se omite el texto colocado entre mensajes, como una entrada configurada en **@ Depth** (a una profundidad). Una declaración que dependa de uno de esos datos debe incluir el dato mismo.

- Las declaraciones de prompts y lorebooks, el orden de respuesta Smart y Automatizar personajes activos leen los últimos 5 mensajes. Este número es fijo.
- Las preguntas de activación leen la **Scan Depth** (profundidad de análisis) del agente, 5 de forma predeterminada.
- Cada mensaje lleva el nombre de quien habla. Se omiten los mensajes ocultos a la IA.
- Una comprobación que se ejecuta después de la respuesta, como la pregunta de un agente de posprocesamiento, también ve la respuesta que se escribió.
- Las macros de la declaración se completan primero, así que `{{char}}` llega como el nombre del personaje.
- Cuando los mensajes no caben en el presupuesto del modelo, se descartan primero los más antiguos.

**El orden de respuesta Smart** también envía una lista de personajes: el nombre, el estado, la actividad y la locuacidad de cada candidato cuando se conocen, además de hasta 300 caracteres de su personalidad o, si está vacía, de su descripción.

**Automatizar personajes activos** también envía una lista de personajes: el nombre de cada personaje y hasta 300 caracteres de su descripción o, si está vacía, de su personalidad, recortados a 100 caracteres o a solo los nombres cuando un reparto grande no cabe, además de los nombres que el Character Tracker vio por última vez. Si incluso solo con los nombres queda muy poco espacio para los mensajes, no se le pregunta al modelo y el Character Tracker lo sustituye. Las respuestas de un grupo Merged se etiquetan como "the narrator", porque una sola respuesta da voz a todos.

Un servicio de decisión alojado recibe estas listas además de los mensajes.

**Advanced Memory** usa su propio modelo de decisión por chat y no la regla de los últimos 5. Las comprobaciones de escena leen la ventana pertinente del historial. La recuperación envía texto reciente de la conversación y hasta 24 resúmenes archivados preseleccionados —más si **Maximum recalled scenes** (máximo de escenas recuperadas) es mayor—, y luego mensajes originales de las escenas que eligió el modelo, tras comprobar el acceso de los personajes. Los servicios alojados reciben estos textos, a veces en varios lotes. Cada pasada de recuperación recibe normalmente entre 10 y 25 segundos, según la velocidad del modelo. Las dos pasadas comparten 40 segundos por respuesta, así que una pasada puede recibir menos de 10 segundos. Las memorias sin respuesta a tiempo recurren a la recuperación habitual. Consulta [Modelo de decisión opcional](../agents/memory.md#optional-decision-model).

<a id="thresholds"></a>

## Umbrales

Las probabilidades no son comparables entre modelos. El mismo ejemplo puede puntuar 0,99 en uno y 0,2 en otro. El umbral predeterminado de sí o no depende del modelo:

- **Modelo integrado o cuenta de modelo de chat compatible con OpenAI:** 0,5
- **Cuenta de TypeSafe, OpenRouter, NanoGPT, Google Gemini o Custom System One:** 0,5
- **Modelo de decisión integrado:** la recomendación del propio modelo, medida en turnos de roleplay donde fue posible: 0,3 para JevK5, Liquid d1 y Valen-Decision 1.5 4B; 0,5 para la versión completa de Valen y Winnow (aún sin medir); 0,1 para Open-Jev 2B y 9B

**Run when probability is at least** (ejecutar cuando la probabilidad sea al menos) de un agente reemplaza este valor. El editor ofrece restaurar la recomendación del modelo cuando el valor guardado difiere. Compruébalo siempre que cambies de modelo. Las declaraciones en prompts y los campos Decision de lorebooks usan el valor predeterminado del modelo, y el umbral de un agente no cambia el suyo.

Un Open-Jev autoalojado detrás de una cuenta Custom System One sigue usando 0,5, porque Marinara no puede calibrar endpoints personalizados arbitrarios. Sus resultados pueden diferir de los del Open-Jev integrado, incluida la interpretación de un resultado positivo inferior a 0,5 como no.

<a id="time-limits"></a>

## Límites de tiempo

Una decisión que no llega a tiempo no da respuesta, y la generación continúa con el respaldo de la función (consulta [Dónde lo usa Marinara](#where-marinara-uses-it)). Cada límite es por declaración. Una solicitud con varias declaraciones recibe el límite para cada una, y cada respuesta Choice cuenta como una declaración. Un modelo local solo procesa unas pocas solicitudes a la vez, así que las declaraciones esperan su turno, y el tiempo de una declaración empieza cuando el modelo comienza con ella.

- **Cuenta de TypeSafe, OpenRouter, Google Gemini o Custom System One:** 1,5 segundos o tu **Time limit**. En las mediciones, OpenRouter y Google Gemini respondieron en 0,2 a 0,5 segundos.
- **Modelo de decisión de NanoGPT:** 4 segundos o tu **Time limit**. En las mediciones respondió en 0,4 a 2,5 segundos.
- **Cuenta de modelo de chat compatible con OpenAI:** 4 segundos, o tu **Time limit**. Un modelo que debe razonar primero recibe al menos 20 segundos.
- **Modelo integrado:** 4 segundos. Un modelo que debe razonar primero recibe 20 segundos.
- **Modelo de decisión integrado:** Open-Jev recibe 4 segundos para la primera declaración, y cada una de las siguientes recibe su tiempo medido: 0,35 segundos para 2B y 0,8 segundos para 9B. Los demás modelos miden su velocidad de lectura cada vez que se inician, y sus límites se ajustan a ella, así que un procesador lento recibe más tiempo. Cada imagen o clip que pide una declaración agrega tiempo adicional. Hasta que el modelo se inicia una vez, recibe 4 segundos por declaración, 30 segundos por imagen y 60 por clip.

Las solicitudes de decisión se detienen cuando cancelas una generación.

## Otros ajustes

Están en el engranaje **Decision settings**:

- **Also use it to pick who speaks in Smart response order** (usarlo también para elegir quién habla en el orden de respuesta Smart) está desactivado de forma predeterminada. Consulta [Chats grupales](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn** (declaraciones de decisión por turno) limita la planificación de declaraciones de prompts y lorebooks. 32 de forma predeterminada, hasta 255. El margen se aplica en varias etapas y no es un límite único para todas las solicitudes ni para el gasto de un turno. Las preguntas de activación de agentes y el orden de respuesta Smart son independientes. Consulta [Límites y costo](../prompts/conditional-prompts.md#limits-and-cost).
- **Also gate agents that run before the reply** y **Thinking** aparecen para las entradas del modelo integrado que pueden razonar. El **Built-in decision model** nunca razona, así que no tiene ninguno de los dos.

## Prevé respuestas incorrectas

Cualquier modelo puede responder incorrectamente, y las respuestas "sí" correctas pueden quedar cerca del umbral.

- Usa una decisión para afinar una respuesta, nunca para algo indispensable para el chat. Una decisión fallida debería hacer que una respuesta quede menos adaptada, no romperla.
- No supedites el consentimiento, las advertencias de contenido ni las instrucciones de seguridad a una decisión.
- Para un agente que solo se ejecuta con una pregunta de activación, configura **Bypass the question after this many messages** (omitir la pregunta después de esta cantidad de mensajes), para que un modelo que siga respondiendo que no no pueda silenciarlo para siempre.

<a id="troubleshooting"></a>

## Solución de problemas

- **La prueba falla.** El mensaje explica por qué: la clave fue rechazada, el servicio está limitando las solicitudes, el modelo integrado no está en ejecución, el modelo de decisión no está instalado, el modelo no respondió sí o no, o se agotó el tiempo.
- **Una cuenta no muestra modelos de decisión en el selector.** La lista guardada de modelos de la cuenta es anterior a sus modelos de decisión. Haz clic en el botón de actualizar junto al nombre de la cuenta en el selector.
- **El servidor no tiene ese endpoint.** La fuente Decision no corresponde al servidor. Ollama, LM Studio y otros servidores de modelos de chat necesitan **OpenAI-compatible chat model**. **Custom System One endpoint** es solo para servidores System One como Open-Jev.
- **La respuesta superó el límite de tiempo, o las decisiones solo funcionan a veces.** El servicio es a veces más lento que el **Time limit**. Prueba varias veces y sube el límite por encima de la respuesta más lenta.
- **Un agente con pregunta de activación se ejecuta cada turno.** No hay ningún modelo de decisión configurado o no responde, así que el agente se ejecuta como si no tuviera pregunta. Haz una prueba.
- **Una rama de decisión en un prompt nunca aparece.** Consulta [Cuando una rama de decisión nunca aparece](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **El orden de respuesta Smart sigue haciendo su llamada habitual a la IA.** El interruptor está desactivado o el modelo de decisión no respondió en ese turno.
- **Los ajustes de imágenes aparecen en gris con un ⓘ.** El modelo de decisión seleccionado solo lee texto o no hay un modelo de decisión configurado. Elige Liquid d1, Valen o Winnow como **Built-in decision model**. Consulta [Qué modelo de decisión integrado elegir](#which-built-in-decision-model).
- **Una declaración con `pictures:` se interpreta como no.** Con `media_within:`, ninguno de los mensajes más recientes tenía una imagen. De lo contrario, la imagen hizo que la respuesta tardara más que su límite de tiempo. La línea **On this computer** (En esta computadora) de la página del modelo muestra cuánto tarda una imagen.
- **Un modelo dice que no se puede ejecutar aquí.** El motivo que aparece debajo de la lista indica qué falta, como una función del procesador, una generación de tarjeta gráfica o una biblioteca. Elige otro modelo; Liquid d1 y JevK5 se ejecutan en casi cualquier computadora.
- **Automatizar personajes activos sigue al Character Tracker.** El modelo no respondió para todos los personajes, razona primero y **Also gate agents that run before the reply** está desactivado, o el reparto es demasiado grande para la entrada del modelo incluso solo con los nombres.

Para ver las puntuaciones y salidas de las decisiones durante la generación, activa Debug Mode o establece el nivel de registro en debug. Consulta [Niveles de registro](../CONFIGURATION.md#logging-levels). Para probar tus propias declaraciones sin generar una respuesta, abre **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt → diagnóstico de decisiones → probar decisiones). Las pruebas explícitas llaman al modelo seleccionado y pueden costar dinero en un servicio alojado. Consulta [Probar declaraciones de decisión](../chats/peek-prompt.md#testing-decision-statements).

<a id="let-marinara-install-a-decision-model"></a>

## Dejar que Marinara instale un modelo de decisión

El **Built-in decision model** es un modelo creado específicamente para decisiones que Marinara descarga y ejecuta en tu computadora, junto a tu modelo de chat. Nada sale de tu computadora. Su uso de memoria se suma al de tu modelo de chat. Si ya ejecutas un modelo local, prueba primero sus decisiones.

### Qué modelo de decisión integrado elegir

| Modelo | Descarga | Lee | Idiomas | Se ejecuta en |
| --- | --- | --- | --- | --- |
| **JevK5 4B** | Aproximadamente 2,7 GB | Texto | Inglés | Casi cualquier computadora: gráficos NVIDIA, AMD, Intel o Apple, o solo el procesador. Usa el mismo entorno de ejecución que el modelo integrado. |
| **JevK5 2B** | Aproximadamente 2 GB | Texto | Inglés | Igual que 4B. Más rápido en un procesador o una tarjeta gráfica pequeña, un poco menos preciso. |
| **Liquid d1 3B** | Aproximadamente 2,3 GB | Texto, imágenes | 16, incluidos japonés, chino, coreano, alemán, español y ruso | Casi cualquier computadora. La opción para chats que no están en inglés. Gratis para particulares y para empresas con ingresos anuales inferiores a 10 millones de dólares. |
| **Valen-Decision 1.5 4B** | Aproximadamente 5,8 GB | Texto, imágenes | 8 comprobados | Linux en un procesador Intel o AMD de 64 bits, solo en el procesador. |
| **Valen-Decision 1.5 2B (versión completa)** | Aproximadamente 6,4 GB | Texto, imágenes, clips | No se indica | Windows, macOS en Apple silicon y Linux, en el procesador. Necesita unos 6 GB de memoria. |
| **Valen-Decision 1.5 4B (versión completa)** | Aproximadamente 11,8 GB | Texto, imágenes, clips | 8 comprobados | Igual que 2B. Necesita unos 12 GB de memoria y es más lento, pero más preciso. |
| **Winnow E4B** | Aproximadamente 9 GB | Texto, imágenes | No se indica | Solo Linux con una tarjeta NVIDIA de la serie RTX 50, las bibliotecas de CUDA 13 y un procesador con AVX-512 (como AMD Ryzen 7000 o 9000; los chips Intel actuales para portátiles y computadoras de escritorio no lo tienen). Necesita unos 11 GB de memoria gráfica. |
| **Open-Jev 2B** | Aproximadamente 4,6 GB | Texto | Inglés | Linux con una tarjeta NVIDIA de la serie RTX 20 o posterior y el controlador 580 o posterior. Usa unos 4,8 GB de memoria gráfica y 10 GB de disco. |
| **Open-Jev 9B** | Aproximadamente 19,4 GB | Texto | Inglés | Igual que 2B. Usa unos 23,6 GB de memoria gráfica, así que en una tarjeta de 24 GB no cabe nada más junto a él. |

En 20 turnos de roleplay en 8 idiomas, JevK5 4B, Liquid d1 y Valen-Decision 1.5 4B respondieron correctamente los 20. Elige Liquid d1 si tienes dudas, o la versión completa de Valen si quieres que lea clips.

Antes de descargar nada, Marinara comprueba que tu computadora pueda ejecutar el modelo: el sistema, las funciones del procesador, la tarjeta gráfica y sus bibliotecas, y la memoria libre. Un modelo que no puede ejecutarse permanece en la lista, marcado como **(cannot run here)** (no se puede ejecutar aquí), e indica el motivo.

### Instalar uno

1. Haz clic en **Connections** en la barra superior. En **On this device** (En este dispositivo), haz clic en **Built-in model (decisions)**. También puedes hacer clic en **Add** en el panel **Connections** y luego en **Built-in model (decisions)**, en **Decisions** (Decisiones).
2. Elige un modelo en la lista **Model** (Modelo). Debajo ves su descripción, luego **Answers** y **Reads** (consulta [Qué muestra la página de un modelo](#what-a-model-page-lists)), sus idiomas y licencias.
3. Haz clic en **Download** (Descargar) con el nombre y el tamaño del modelo. Confirma el tamaño, el dictamen de hardware y las licencias. No se descarga nada antes de eso.
4. Haz clic en **Use for Decision** (Usar para Decisión), o haz clic en la fila **Decision**, en **Behind the scenes**, dentro del cuadro **Jobs**, y elige **Built-in model (decisions)**.

Una vez que un modelo se ha ejecutado, su página también muestra **On this computer** con cuánto tardó allí: unos turnos de chat, una imagen y un clip para los modelos que los leen. Estos tiempos provienen de tu propia computadora, así que te indican cuánto más tarda una declaración cuando pide una imagen.

Para cambiar, elige otro modelo de la lista. Un modelo que descargaste antes está marcado como **(downloaded)** (descargado), y **Use this model** (Usar este modelo) cambia a él sin descargarlo de nuevo.

Otros controles de la página:

- **Turn off** (Desactivar) detiene el modelo y conserva sus archivos. **Turn on** (Activar) lo inicia de nuevo.
- **Runs on** (Se ejecuta en) elige la tarjeta en una computadora con varias tarjetas NVIDIA. Cambiarla detiene el modelo, que vuelve a iniciarse en la nueva tarjeta.
- **Starts** (Se inicia) está en **When an agent first needs it** (Cuando un agente lo necesite por primera vez) de forma predeterminada, o en **With Marinara** (Con Marinara).
- **Install from a repository** (Instalar desde un repositorio) acepta un modelo de decisión de Hugging Face como `owner/model-name`: un checkpoint de Open-Jev, un GGUF que se declare como modelo de decisión o un paquete GGUF de Valen. Agrega `:Q8_0` después del nombre para elegir un tamaño de un GGUF. Haz clic en **Check** (Comprobar). Marinara lee lo que los archivos dicen sobre sí mismos y muestra el tamaño y las licencias. Rechaza con el motivo un repositorio que no pueda verificar. Después haz clic en **Download and install this one** (Descargar e instalar este).
- **Remove files** (Eliminar archivos) borra el modelo y su entorno de ejecución.
- **Reinstall** (reinstalar) aparece cuando el modelo instalado no puede iniciarse porque sus archivos o su entorno de ejecución faltan o están desactualizados, normalmente después de una actualización. El modelo queda marcado como **Needs reinstall**. Reinstalar conserva los archivos que ya están descargados y completos, así que normalmente solo vuelve a descargarse el entorno de ejecución.

La primera respuesta de un modelo tras iniciarse es más lenta, así que Marinara hace una pregunta de calentamiento mientras lo carga. Si falla, el modelo se inicia de todos modos y la primera pregunta real asume esa demora. Si el modelo se detiene justo después de iniciarse, la página indica el motivo, por ejemplo que al procesador le falta una función que necesita.

<a id="run-strands-decider-yourself"></a>

### Ejecutar Strands decider por tu cuenta

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) es otro modelo de decisión abierto (Apache-2.0) que habla System One. Marinara no puede instalarlo, pero funciona como **Custom System One endpoint** mientras lo mantengas en ejecución.

1. En un entorno con Python 3.10 o posterior, instálalo e inicia su servidor:

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   Usa una GPU NVIDIA o Apple silicon cuando encuentra uno de ellos y, si no, el procesador, con menor velocidad. El primer inicio descarga el modelo y unos 4,6 GB de pesos base, y sus paquetes de Python ocupan unos 5,5 GB. El servidor no tiene contraseña, así que mantenlo en `127.0.0.1`.

2. Añade una cuenta **Own decision server** con la **Server address** `http://127.0.0.1:8000`. Cualquier nombre de modelo funciona.
3. Elígelo en la fila **Decision** y pruébalo con **Test** en el menú **⋯** de la cuenta. Su primera respuesta tras iniciarse tarda unos 2 segundos, más que el límite de tiempo predeterminado, así que pruébalo una vez antes de chatear.

Sus probabilidades están calibradas, así que el umbral predeterminado de 0,5 le resulta adecuado, a diferencia de un Open-Jev autoalojado (consulta [Umbrales](#thresholds)). Sus respuestas dependen de la redacción, así que sigue [Redactar declaraciones](../prompts/conditional-prompts.md#writing-statements).

## Guías relacionadas

- [Crear agentes personalizados](../agents/custom-agents.md)
- [Prompts condicionales](../prompts/conditional-prompts.md)
- [Chats grupales](../chats/group-chats.md)
- [Configuración del modelo integrado](local-model.md)
- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
