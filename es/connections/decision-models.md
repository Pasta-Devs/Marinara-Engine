# Modelos de decisión

Un modelo de decisión es un modelo pequeño que responde preguntas de sí o no para Marinara, como "Does the latest message move the scene to a new place?". Lo usan los lorebooks (libros de trasfondo), los agentes personalizados, los prompts (las instrucciones enviadas a la IA) y los chats grupales. Es opcional. Sin uno, los chats siguen funcionando y cada función usa el respaldo descrito en [Dónde lo usa Marinara](#where-marinara-uses-it).

Sus respuestas controlan lo que hace Marinara y nunca se publican en el chat. Puntúa una declaración de 0 a 1. Marinara compara ese número con un umbral y trata el resultado como sí o no. También puede elegir una respuesta de una lista corta, como "angry", "sad" o "none of these".

Nuestro consejo: déjalo en **None** (ninguno) si tienes dudas. Si quieres decisiones, usa el modelo integrado que quizá ya tengas o un modelo de chat en un servidor que ya ejecutas. Ninguna de las dos opciones cuesta nada adicional.

## Elegir un modelo de decisión

Antes de empezar, consulta [Cuál elegir](#which-one-to-pick).

1. Haz clic en **Connections** (Conexiones) en la barra superior y abre el cuadro **Jobs** (tareas).
2. En **Behind the scenes** (entre bastidores), haz clic en la fila **Decision** (decisión). Se abre una lista.
3. Elige un modelo. La lista tiene tres grupos:
   - **None (decisions off)** (ninguno: decisiones desactivadas) es el predeterminado. No se pregunta nada y los campos de preguntas de activación del editor de agentes permanecen desactivados.
   - **Built-in model** (modelo integrado) enumera los modelos que Marinara ejecuta en tu computadora: **Built-in model**, **Built-in model (utility)** (modelo integrado: auxiliar) y **Built-in model (decisions)** (modelo integrado: decisiones). Nada sale de tu computadora.
   - **Connections** enumera tus cuentas que pueden responder decisiones: alojadas, o un modelo de chat en un servidor que ya ejecutas.
4. Para probarlo, haz clic en el engranaje **Decision settings** (ajustes de decisión) de la fila y luego en **Test** (probar). Ese botón aparece para las entradas del modelo integrado. Para una cuenta de TypeSafe u OpenRouter, abre **Edit model** (editar modelo) en su modelo y haz clic en **Test provider** (probar proveedor). Para una cuenta **Own decision server** (servidor de decisiones propio), usa **Test** en el menú **⋯** de la cuenta.

Una prueba correcta muestra la probabilidad de sí y cuánto tardó la respuesta. Para un modelo en tu computadora también indica si había log-probabilidades disponibles y si el modelo responde directamente. Las log-probabilidades son los números de confianza del modelo para cada palabra que podría escribir. La prueba envía una muestra fija, no tu chat.

Si no funcionó, el mensaje explica por qué. Causas habituales: la clave fue rechazada, el servicio está limitando las solicitudes, el modelo integrado no está en ejecución o la respuesta superó el límite de tiempo. Consulta [Solución de problemas](#troubleshooting).

Las entradas que no pueden responder ahora permanecen en la lista, en gris y con el motivo. Elegir **None** desactiva las decisiones sin borrar ninguna pregunta de activación ni declaración de decisión.

<a id="which-one-to-pick"></a>

### Cuál elegir

- **Un modelo que ya ejecutas en el modelo integrado.** No cuesta nada adicional. Lo mejor para la mayoría de quienes usan el modelo integrado.
- **Un modelo de chat en tu propio servidor** (Ollama, LM Studio, llama.cpp u otro servidor compatible con OpenAI). No cuesta nada adicional. Útil cuando tu modelo se ejecuta fuera de Marinara, para no cargarlo dos veces.
- **Una cuenta Decision alojada** (clave de TypeSafe u OpenRouter). Se factura por solicitud, y un turno puede hacer varias. Útil para teléfonos y computadoras que no ejecutan ningún modelo local.
- **El modelo de decisión integrado.** Usa espacio en disco y memoria de GPU separados. Necesita Linux x86-64 y una GPU NVIDIA compatible. Para un modelo de decisión separado junto a tu modelo de chat.

Si ya ejecutas un modelo local, pruébalo primero y prueba turnos de tus propios chats. La redacción importa mucho. Consulta [Redactar declaraciones](../prompts/conditional-prompts.md#writing-statements).

Jev y Open-Jev son modelos distintos. Jev es el modelo alojado de TypeSafe, disponible directamente o mediante OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) es un modelo publicado por separado y basado en Qwen, que Marinara puede ejecutar localmente. Las pruebas de Open-Jev no miden Jev alojado.

En Android (Termux), el **Built-in decision model** (modelo de decisión integrado) no puede ejecutarse, y un modelo local pequeño en el procesador de un teléfono puede ser demasiado lento. Una cuenta alojada es la opción práctica, por ejemplo Jev mediante OpenRouter. Consulta [Configurar una conexión Decision](#set-up-a-decision-connection).

Escribe los presets (ajustes guardados), las tarjetas y los agentes para "un modelo de decisión", nunca como "requiere Jev". Usan la misma sintaxis de declaraciones con cualquier modelo, pero los modelos pueden dar respuestas distintas. Cuando importas contenido que usa decisiones, incluidos agentes personalizados e instalaciones de Agent Organizer, Marinara muestra un aviso con un enlace a esta guía. Restaurar un ZIP de perfil completo no lo muestra.

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

1. Haz clic en **⋯** en ese modelo del panel **Connections** y elige **Use this model for decisions** (usar este modelo para decisiones). La ventana **Add account** (añadir cuenta) se abre en el paso de decisiones con la misma dirección, el mismo modelo y la misma clave.
2. Elige el modelo y haz clic en **Test decision** (probar decisión). Una prueba correcta indica si el servidor devolvió log-probabilidades y si el modelo tuvo que razonar primero. Haz clic en **Done** (listo).
3. Haz clic en la fila **Decision**, en **Behind the scenes**, y elige el nuevo modelo.

También puedes crearla tú. Usa una cuenta Decision con la fuente **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)** (modelo de chat compatible con OpenAI: Ollama, LM Studio, llama.cpp), la misma dirección que tu cuenta de chat (por ejemplo `http://localhost:11434/v1` para Ollama) y el nombre de modelo que usa el servidor.

Se consulta igual que el modelo integrado: una palabra de sí o no por declaración. Las declaraciones se envían de una en una, porque Marinara no puede saber cuántas solicitudes procesa tu servidor a la vez. **Thinking** siempre es **Auto** para una cuenta. Un servidor en otra computadora necesita `PROVIDER_LOCAL_URLS_ENABLED`. Consulta [Conectar un modelo local o autoalojado](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

## Configurar una conexión Decision

Una cuenta Decision alojada envía al servicio los mensajes recientes seleccionados y las declaraciones, y puede costar dinero. El orden de respuesta Smart también envía una [lista de personajes](#what-the-model-sees).

1. Haz clic en **Connections** en la barra superior y luego en **Add** (añadir).
2. En **Decisions** (decisiones), haz clic en **TypeSafe** u **Own decision server**. Para OpenRouter, haz clic en **OpenRouter** en **Chat**, conéctalo y luego usa **Use this key for decisions** (usar esta clave para decisiones) en el menú **⋯** del modelo.
3. Introduce la **API key** (clave de API) o, para **Own decision server**, la **Server address** (dirección del servidor). Haz clic en **Connect** (conectar). La ventana se cierra y el panel muestra la nueva cuenta.
4. Haz clic en la fila **Decision**, en **Behind the scenes**, y elige el nuevo modelo.
5. Para probarlo, haz clic en el modelo en el panel para abrir **Edit model** y luego haz clic en **Test provider** en la tarjeta **Provider tests** (pruebas del proveedor). Un modelo de **Own decision server** no tiene ahí el botón **Test provider**. En su lugar, abre el menú **⋯** de la cuenta en el panel y haz clic en **Test**.

Un **Test provider** correcto muestra la probabilidad, cuánto tardó la respuesta y el límite de tiempo de la cuenta. El **Test** de la cuenta en el menú **⋯** solo indica si funcionó y cuánto tardó. La prueba espera al menos 10 segundos, o 5 segundos más que un límite mayor. Si la respuesta tardó más que el límite, el resultado lo indica: en los chats, esa respuesta contaría como ausencia de respuesta.

Si no funcionó, consulta [Solución de problemas](#troubleshooting).

El editor de Decision (**Edit model** en un modelo de decisión) tiene estos campos:

| Campo | Qué hace |
| --- | --- |
| **Decision source** (fuente de decisión) | **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (endpoint System One personalizado) u **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. Queda fija al crear el modelo. |
| **API key source** (origen de la clave de API) | **Enter a separate key (optional for local servers)** (introducir una clave aparte: opcional para servidores locales) o **Use key from …** (usar la clave de …) otra cuenta. Las claves vinculadas siguen los cambios posteriores de la clave. Un modelo System One personalizado o compatible con OpenAI puede tomar prestada la clave de una cuenta de chat personalizada solo cuando ambas direcciones tienen el mismo esquema, host y puerto. |
| **Recent-message token budget** (presupuesto de tokens de mensajes recientes) | Cuántos tokens estimados del chat se envían. De 1 a 30.000. 30.000 de forma predeterminada para TypeSafe y OpenRouter, y 3.500 para servidores personalizados. Marinara descarta primero los mensajes más antiguos y después recorta la parte más antigua del mensaje más reciente. Una solicitud rechazada o que supera el presupuesto no da respuesta. |
| **Time limit (seconds)** (límite de tiempo en segundos) | Cuánto se espera cada declaración durante los chats. De 0,5 a 30. 1,5 de forma predeterminada, o 4 para un modelo de chat compatible con OpenAI. Consulta [Límites de tiempo](#time-limits). |

TypeSafe envía las solicitudes a `https://api.typesafe.ai`. Puedes reemplazar su **Base URL** (URL base) por otro servidor que ejecute la API de TypeSafe, sin `/v1/systemone`. Sigue necesitando tu clave de TypeSafe, que se envía a ese servidor. **Custom System One endpoint** acepta un servidor System One que ejecutes tú, como Open-Jev o [Strands decider](#run-strands-decider-yourself). Introduce su dirección sin `/v1/systemone`. Un servidor de modelos de chat como Ollama no habla System One. Usa **OpenAI-compatible chat model** para él.

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

Una pregunta de activación decide si un agente se ejecuta. Una declaración de decisión dentro de su prompt decide qué se le dice a ese agente al ejecutarse. Usa `{{#if decision:"..."}}` para condiciones de sí o no y `{{#if decision_choice:"..." == "..."}}` para elegir entre respuestas.

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
- **Cuenta de TypeSafe, OpenRouter o Custom System One:** 0,5
- **Modelo de decisión integrado:** la recomendación del manifiesto del modelo: 0,1 para Open-Jev 2B y 9B

**Run when probability is at least** (ejecutar cuando la probabilidad sea al menos) de un agente reemplaza este valor. El editor ofrece restaurar la recomendación del modelo cuando el valor guardado difiere. Compruébalo siempre que cambies de modelo. Las declaraciones en prompts y los campos Decision de lorebooks usan el valor predeterminado del modelo, y el umbral de un agente no cambia el suyo.

Un Open-Jev autoalojado detrás de una cuenta Custom System One sigue usando 0,5, porque Marinara no puede calibrar endpoints personalizados arbitrarios. Sus resultados pueden diferir de los del Open-Jev integrado, incluida la interpretación de un resultado positivo inferior a 0,5 como no.

<a id="time-limits"></a>

## Límites de tiempo

Una decisión que no llega a tiempo no da respuesta, y la generación continúa con el respaldo de la función (consulta [Dónde lo usa Marinara](#where-marinara-uses-it)). Cada límite es por declaración. Una solicitud con varias declaraciones recibe el límite para cada una, y cada respuesta Choice cuenta como una declaración. Un modelo local solo procesa unas pocas solicitudes a la vez, así que las declaraciones esperan su turno, y el tiempo de una declaración empieza cuando el modelo comienza con ella.

- **Cuenta de TypeSafe, OpenRouter o Custom System One:** 1,5 segundos, o tu **Time limit**
- **Cuenta de modelo de chat compatible con OpenAI:** 4 segundos, o tu **Time limit**. Un modelo que debe razonar primero recibe al menos 20 segundos.
- **Modelo integrado:** 4 segundos. Un modelo que debe razonar primero recibe 20 segundos.
- **Modelo de decisión integrado:** 4 segundos para la primera declaración. Cada una de las siguientes recibe el tiempo medido del modelo: 0,35 segundos para Open-Jev 2B y 0,8 segundos para Open-Jev 9B. Un modelo que instalaste desde un repositorio recibe 4 segundos para cada una.

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
- **El servidor no tiene ese endpoint.** La fuente Decision no corresponde al servidor. Ollama, LM Studio y otros servidores de modelos de chat necesitan **OpenAI-compatible chat model**. **Custom System One endpoint** es solo para servidores System One como Open-Jev.
- **La respuesta superó el límite de tiempo, o las decisiones solo funcionan a veces.** El servicio es a veces más lento que el **Time limit**. Prueba varias veces y sube el límite por encima de la respuesta más lenta.
- **Un agente con pregunta de activación se ejecuta cada turno.** No hay ningún modelo de decisión configurado o no responde, así que el agente se ejecuta como si no tuviera pregunta. Haz una prueba.
- **Una rama de decisión en un prompt nunca aparece.** Consulta [Cuando una rama de decisión nunca aparece](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **El orden de respuesta Smart sigue haciendo su llamada habitual a la IA.** El interruptor está desactivado o el modelo de decisión no respondió en ese turno.
- **Automatizar personajes activos sigue al Character Tracker.** El modelo no respondió para todos los personajes, razona primero y **Also gate agents that run before the reply** está desactivado, o el reparto es demasiado grande para la entrada del modelo incluso solo con los nombres.

Para ver las puntuaciones y salidas de las decisiones durante la generación, activa Debug Mode o establece el nivel de registro en debug. Consulta [Niveles de registro](../CONFIGURATION.md#logging-levels). Para probar tus propias declaraciones sin generar una respuesta, abre **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt → diagnóstico de decisiones → probar decisiones). Las pruebas explícitas llaman al modelo seleccionado y pueden costar dinero en un servicio alojado. Consulta [Probar declaraciones de decisión](../chats/peek-prompt.md#testing-decision-statements).

<a id="let-marinara-install-a-decision-model"></a>

## Dejar que Marinara instale un modelo de decisión

El **Built-in decision model** es un modelo experimental, creado específicamente para decisiones, que Marinara descarga y ejecuta como su propio proceso local, junto a tu modelo de chat. Su uso de memoria se suma al de tu modelo de chat. Si ya tienes un modelo local, prueba primero sus decisiones.

Los modelos Open-Jev necesitan Linux **x86-64**, una GPU NVIDIA con capacidad de cómputo 7.5 o posterior (Turing, la serie RTX 20 o posterior) y el controlador 580 o posterior. Linux ARM y las tarjetas más antiguas no son compatibles. Donde un modelo no puede ejecutarse, la opción permanece visible, indica el motivo y ofrece **Set up a Decision provider instead** (configurar un proveedor de decisiones en su lugar).

| Modelo | Descarga del modelo | Disco incluido el entorno de ejecución | Memoria de GPU |
| --- | --- | --- | --- |
| Open-Jev 2B | Aproximadamente 4,6 GB | Aproximadamente 10 GB | Aproximadamente 4,8 GB (4,5 GiB) |
| Open-Jev 9B | Aproximadamente 19,4 GB | Aproximadamente 25,3 GB | Aproximadamente 23,6 GB (22 GiB) |

Son las estimaciones del catálogo. El modelo 9B deja poco margen en una GPU de 24 GB. Comprueba el dictamen del instalador para tu tarjeta.

1. Haz clic en **Add** en el panel **Connections** y luego en **Built-in model (decisions)**, en **Decisions**. Se abre una ventana titulada **Built-in decision model**. También puedes abrirla desde la página de la tarjeta **Built-in model**.
2. Lee la advertencia y luego activa **Use the built-in decision model** (usar el modelo de decisión integrado). Un cuadro de diálogo titulado **Turn on the built-in decision model?** (¿activar el modelo de decisión integrado?) muestra el dictamen para tu computadora. Haz clic en **Enable** (activar), o en **Enable anyway** (activar de todos modos) cuando el dictamen es una advertencia.
3. En **Available decision models** (modelos de decisión disponibles), elige **Open-Jev 2B** u **Open-Jev 9B**. Haz clic en **Download and install** (descargar e instalar) y confirma el tamaño, el dictamen de hardware y las licencias. No se descarga nada antes de eso.
4. Haz clic en la fila **Decision**, en **Behind the scenes**, y elige **Built-in model (decisions)**.

Otros controles de la ventana:

- **Install from a repository** (instalar desde un repositorio) acepta un modelo de decisión de HuggingFace como `owner/model-name`. Haz clic en **Check** (comprobar). Marinara lee el manifiesto del propio repositorio, comprueba que corresponda a un entorno de ejecución incluido en esta compilación y muestra los pesos base y el tamaño total. Rechaza con el motivo un repositorio que no pueda verificar. Después haz clic en **Download and install this one** (descargar e instalar este).
- **GPU** elige la tarjeta en una computadora con varias GPU NVIDIA. Cambiarla detiene el modelo, que vuelve a iniciarse en la nueva tarjeta.
- **Start this model when Marinara starts** (iniciar este modelo cuando se inicie Marinara) es opcional. Si está desactivado, el modelo se inicia la primera vez que un agente lo necesita.
- **Remove files** (eliminar archivos) borra el modelo y su entorno de ejecución. Desactivar el modelo detiene el proceso y conserva los archivos.
- **Reinstall** (reinstalar) aparece cuando el modelo instalado no puede iniciarse porque sus archivos o su entorno de ejecución faltan o están desactualizados, normalmente después de una actualización. El modelo queda marcado como **Needs reinstall** y la fila **Decision** muestra **Not set up**. Reinstalar conserva los archivos que ya están descargados y completos, así que normalmente solo vuelven a descargarse los paquetes de Python del entorno de ejecución.

La primera respuesta de un modelo tras iniciarse es más lenta, así que Marinara hace una pregunta de calentamiento mientras lo carga. Si falla, el modelo se inicia de todos modos y la primera pregunta real asume esa demora. Un turno con muchas declaraciones en un chat largo tarda más. En un chat largo, Open-Jev 2B tarda aproximadamente un cuarto de segundo por declaración.

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
