# Modelos de decisión

Esta guía explica **Decision model** (modelo de decisión): qué es, las tres formas de obtener uno, cómo configurar cada opción y dónde lo usa Marinara. Es opcional. Sin uno, los chats siguen generando respuestas, pero cada función usa el comportamiento de respaldo descrito abajo.

## Qué es un modelo de decisión

Un modelo de decisión responde un tipo de pregunta. Recibe los mensajes recientes de un chat y una declaración, como "The latest message moves the scene to a new place", y calcula la probabilidad de que sea verdadera como un número de 0 a 1. Marinara compara ese número con un umbral y trata el resultado como sí o no. También puede elegir una respuesta de una lista corta, como "angry", "sad" o "none of these".

Sus respuestas controlan el comportamiento de Marinara; no se publican como respuestas en el chat. Un modelo creado específicamente para decisiones puntúa las declaraciones directamente. A un modelo de chat local normalmente se le pide un solo token de sí/no, aunque algunos modelos necesitan razonar primero. Las decisiones pueden ser más rápidas que una respuesta completa, pero muchas declaraciones o un modelo que razona pueden añadir un tiempo considerable.

<a id="where-marinara-uses-it"></a>

## Dónde lo usa Marinara

- Las **[preguntas de activación](../agents/custom-agents.md#activation-questions)** deciden si se ejecuta un agente personalizado antes de su trabajo en su fase. Sin respuesta, la pregunta no lo detiene; siguen aplicándose las palabras clave y **Trigger Cadence** (frecuencia de activación).
- Las **[declaraciones en prompts](../prompts/conditional-prompts.md#asking-the-decision-model)** eligen texto al preparar el prompt de un chat o agente. Sin respuesta, la decisión se interpreta como no, así que un bloque de decisión simple usa su rama `{{else}}`, si existe.
- Los **[campos Decision de lorebooks](../lorebooks/entries.md#decision-activation)** comprueban Require o Trigger durante el análisis de lorebooks del chat. Sin respuesta, Require no puede admitir una entrada nueva y Trigger no añade una vía de activación. Siguen aplicándose las retenciones Sticky existentes y las vías ordinarias de activación de las entradas Trigger.
- El **[orden de respuesta Smart](../chats/group-chats.md#response-order-individual-only)** puntúa quién debería hablar después en un chat grupal, si está activado. Sin respuesta, el orden Smart hace su llamada habitual a la IA.

Una pregunta de activación controla si un agente se ejecuta; una declaración de decisión dentro de su prompt controla qué instrucciones recibe ese agente al ejecutarse. Usa `{{#if decision:"..."}}` para condiciones de prompt de sí/no y `{{#if decision_choice:"..." == "..."}}` para elegir entre respuestas.

<a id="what-the-model-sees"></a>

## Qué ve el modelo

Para las preguntas de activación y las declaraciones de prompts/lorebooks, el modelo recibe la declaración y los mensajes recientes tal como se guardaron en el chat. No recibe el resto del prompt ensamblado: tu preset, tarjeta de personaje, descripción de persona, entradas de lorebook (incluidas las Constant), resúmenes ni salida de agentes. También se omite el texto insertado entre mensajes, como un preset o una entrada de lorebook colocada **@ Depth** (a una profundidad). Una declaración que dependa de uno de esos datos debe incluir el dato mismo.

**El orden de respuesta Smart también envía una lista de personajes.** Incluye el nombre, estado, actividad y locuacidad de cada candidato cuando están disponibles, además de hasta 300 caracteres de su personalidad o, si está vacía, de su descripción. Un proveedor de Decision alojado recibe esta lista junto con los mensajes recientes.

- Las declaraciones de decisión en prompts y entradas de lorebook, y el orden de respuesta Smart, leen los últimos 5 mensajes. Este número es fijo.
- Las preguntas de activación leen la **Scan Depth** (profundidad de análisis) del agente, 5 de forma predeterminada.
- Cada mensaje lleva el nombre de quien habla. Se omiten los mensajes ocultos a la IA.
- Todo lo que se comprueba después de la respuesta, como la pregunta de activación de un agente de posprocesamiento o una declaración en su prompt, también ve la respuesta recién escrita.
- Las macros de la declaración se completan primero, así que `{{char}}` llega como el nombre del personaje.
- Cuando los mensajes no caben en el presupuesto del modelo, se descartan primero los más antiguos. Consulta [Configurar una conexión Decision](#set-up-a-decision-connection) para el presupuesto alojado.

## Elegir un modelo de decisión

Abre **Connections** (Conexiones), después **Connection defaults** (valores predeterminados de conexión) y elige en **Decision model**. La lista tiene tres grupos:

- **None** (ninguno), el predeterminado. No se pregunta nada y los campos de preguntas de activación del editor de agentes permanecen desactivados.
- **Local models** (modelos locales): el **Primary local model** (modelo local principal) o **Utility local model** (modelo local auxiliar) que ya ejecutas. No se descarga nada y nada sale de tu computadora. Aquí también aparece **Decision sidecar** (proceso auxiliar de decisiones), si lo instalaste.
- **Connections**: cualquier conexión Decision que hayas creado, alojada o ejecutada por ti.

Las opciones que no pueden responder ahora permanecen en la lista, atenuadas y con el motivo, para que sepas qué corregir. Haz clic en **Test** (probar) después de elegir. La prueba envía una muestra fija, no tu chat.

### Cuál elegir

Si ya ejecutas un modelo local, pruébalo primero. En una pequeña prueba de redacción basada en una escena de Roleplay, Gemma 4 E4B respondió correctamente 32 de 32 declaraciones recomendadas, y Open-Jev 2B y 9B respondieron 31 cada uno. Es un ejemplo de por qué importa la redacción, no una clasificación general de precisión. Prueba turnos representativos de tus propios chats; consulta [Redactar declaraciones](../prompts/conditional-prompts.md#writing-statements).

**Jev y Open-Jev son modelos distintos.** Jev es el modelo alojado de TypeSafe, disponible directamente o mediante OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) es un modelo publicado por separado y basado en Qwen que Marinara puede ejecutar localmente. Las pruebas de redacción de Open-Jev no miden la precisión de Jev alojado.

| Opción | Costos | Necesita | Útil para |
| --- | --- | --- | --- |
| Un modelo que ya ejecutas | Nada adicional | Un modelo local en **Local Model** (modelo local) | La mayoría de quienes ejecutan un modelo local |
| Una conexión Decision alojada | Solicitudes facturadas; un turno puede hacer varias | Una clave de API (TypeSafe u OpenRouter) | Teléfonos y computadoras que no ejecutan un modelo local |
| El modelo de decisión instalable | Espacio en disco y memoria de GPU separados; consulta los [tamaños de modelos](#let-marinara-install-a-decision-model) | Linux x86-64 y una GPU NVIDIA compatible | Un modelo de decisión separado junto a tu modelo de chat |

**En Android (Termux),** el modelo de decisión instalable no puede ejecutarse porque necesita una computadora con GPU NVIDIA. Un modelo local pequeño en el procesador de un teléfono también puede ser demasiado lento para el límite de tiempo. Una conexión Decision alojada es la opción práctica en un teléfono, por ejemplo Jev mediante OpenRouter. Consulta [Configurar una conexión Decision](#set-up-a-decision-connection).

Los presets, tarjetas y agentes deben escribirse para "un modelo de decisión", nunca como "requiere Jev". Usan la misma sintaxis de declaraciones cualquiera que sea el modelo elegido, pero distintos modelos pueden dar respuestas diferentes.

Cuando alguien importa contenido que usa decisiones, Marinara muestra un aviso con un enlace a esta guía. Esto incluye agentes personalizados e instalaciones del catálogo de Agents. Si no hay un Decision model seleccionado, el aviso explica el respaldo: las declaraciones en prompts se interpretan como no, las entradas de lorebook no pueden activarse por una decisión y las preguntas de activación de agentes permiten que el agente se ejecute cuando lo permitan sus palabras clave y **Trigger Cadence**. Configura también una frecuencia si el agente no debe ejecutarse cada turno sin un Decision model. La restauración de un ZIP de perfil completo no muestra este aviso de importación.

<a id="use-a-model-you-already-run"></a>

## Usar un modelo que ya ejecutas

Si tienes un modelo local en **Local Model**, puedes usarlo para decisiones sin crear una conexión ni pagar por una solicitud.

1. En **Connections**, abre **Connection defaults** y establece **Decision model** en **Primary local model**, o en **Utility local model** si tienes uno configurado.
2. Haz clic en **Test**. Un resultado correcto muestra la probabilidad y la duración de la solicitud, además de dos datos específicos de los modelos locales: si había log-probabilidades disponibles y si el modelo responde directamente.

Marinara hace una sola pregunta de sí/no al modelo, le permite producir un token y lee la respuesta a partir de las probabilidades de ese token. No se escribe ninguna respuesta de chat, así que la solicitud es corta. Una elección entre varias respuestas se formula como una pregunta de sí/no por respuesta. La cantidad de mensajes recientes que caben se calcula a partir del tamaño de contexto de la propia ranura.

**Razonamiento.** La mayoría de los modelos responde con una palabra. Algunos siempre razonan primero, se les pida lo que se les pida. El ajuste **Thinking** (razonamiento) debajo del menú desplegable controla esto:

- **Auto** (predeterminado) intenta el método rápido de una palabra y, si el modelo no puede responder así dos veces seguidas, le permite razonar primero y te lo indica.
- **Off** (desactivado) usa siempre el método de una palabra. Un modelo que no pueda responder así no da respuesta.
- **Allowed** (permitido) nunca pide al modelo que omita el razonamiento.

Un modelo que razona primero tarda segundos, así que de forma predeterminada solo responde para tareas que ocurren después de que la respuesta aparece en pantalla, como los agentes de posprocesamiento. Antes de la respuesta no da respuesta, salvo que actives **Also gate agents that run before the reply** (evaluar también los agentes que se ejecutan antes de la respuesta), lo que hace que cada respuesta lo espere.

**Sobre los números.** Las probabilidades de sí/no de un modelo de chat general se pueden usar con un umbral, pero nunca se entrenaron para estar calibradas como las de un modelo específico de decisiones; un entorno de ejecución que no devuelve log-probabilidades responde con un 1 o 0 fijo. Ajusta los umbrales con tus propios chats en lugar de confiar en el valor predeterminado.

<a id="set-up-a-decision-connection"></a>

## Configurar una conexión Decision

1. En **Connections**, crea una conexión con el proveedor **Decision** (decisión).
2. Elige **TypeSafe**, **OpenRouter** o **Custom System One endpoint** (endpoint System One personalizado). Las fuentes alojadas necesitan una clave de API. Custom acepta un servidor System One que ya ejecutes, incluido Open-Jev; introduce su URL base sin `/v1/systemone` y usa el nombre de modelo que admita.
3. Para OpenRouter, elige una conexión OpenRouter guardada en **API key source** (origen de la clave de API) o introduce una clave independiente. Su editor también ofrece **Use this key for decisions (Jev)** (usar esta clave para decisiones con Jev). Las claves vinculadas siguen automáticamente los cambios posteriores de clave. Las conexiones personalizadas solo pueden tomar prestada la clave de una conexión de chat personalizada cuando ambas URL tienen el mismo origen (esquema, host y puerto).
4. Guarda, selecciónala en **Decision model** y haz clic en **Test**. Un resultado correcto muestra la probabilidad, cuánto tardó la respuesta y el límite de tiempo de la conexión. Test espera al menos 10 segundos y 5 segundos más que un límite mayor, para informar la duración real de una respuesta lenta. Si superó el límite, el resultado lo indica: durante un chat esa respuesta contaría como ausencia de respuesta.

El valor predeterminado de Decision es independiente de los de chat, agentes, imágenes, video y audio. Elegir **None** desactiva las decisiones sin borrar preguntas de activación ni declaraciones de decisión.

Las decisiones alojadas envían los mensajes recientes seleccionados y las declaraciones al proveedor elegido y pueden generar cargos. El orden de respuesta Smart también incluye la [lista de personajes](#what-the-model-sees). **Recent-message token budget** (presupuesto de tokens de mensajes recientes) tiene un valor predeterminado de 30.000 tokens estimados para fuentes alojadas y 3.500 para servidores personalizados. Redúcelo si tu servidor tiene un límite de contexto menor. Marinara descarta primero los mensajes más antiguos y después recorta la parte más antigua del mensaje más reciente. Las estimaciones de tokens pueden diferir del tokenizador del servidor; una solicitud rechazada o que supera el presupuesto no da respuesta.

**Time limit (seconds)** (límite de tiempo en segundos) es cuánto espera cada conexión Decision una respuesta durante los chats, de 0,5 a 30 segundos (1,5 de forma predeterminada). Una respuesta posterior cuenta como ausencia de respuesta. Algunos proveedores alojados a veces tardan más de 1,5 segundos, lo que hace que las decisiones parezcan fallar al azar; haz clic en **Test** varias veces y establece un límite superior a la respuesta más lenta. La contrapartida: una declaración evaluada antes de la respuesta, como una decisión de un preset o la pregunta de activación de un agente que se ejecuta antes de la respuesta, puede retrasarla hasta ese tiempo.

Al eliminar una conexión usada para una clave vinculada se muestra una advertencia y la conexión Decision queda pendiente de volver a vincularse. Los archivos de conexión independientes importados también necesitan que se restauren sus claves o vínculos; nunca contienen claves de API ni IDs de conexiones prestadas.

<a id="let-marinara-install-a-decision-model"></a>

## Dejar que Marinara instale un modelo de decisión

Marinara también puede descargar y ejecutar por ti un modelo creado específicamente para decisiones. Funciona como un proceso local propio, ejecutes o no un modelo de chat local. Su uso de memoria se suma al del modelo de chat. Si ya tienes un modelo local, prueba sus decisiones antes de descargar otro.

Los modelos Open-Jev integrados necesitan Linux **x86-64**, una GPU NVIDIA con capacidad de cómputo 7.5 o posterior (Turing, la serie RTX 20 o posterior) y el controlador 580 o posterior. Estos paquetes no admiten dispositivos Linux ARM ni tarjetas Pascal o anteriores. Donde un modelo no puede ejecutarse, la opción permanece visible, indica el motivo y ofrece configurar una conexión Decision en su lugar.

| Modelo integrado | Descarga del modelo | Disco incluido el entorno de ejecución | Memoria de GPU |
| --- | --- | --- | --- |
| Open-Jev 2B | Aproximadamente 4,6 GB | Aproximadamente 10 GB | Aproximadamente 4,8 GB (4,5 GiB) |
| Open-Jev 9B | Aproximadamente 19,4 GB | Aproximadamente 25,3 GB | Aproximadamente 23,6 GB (22 GiB) |

Son las estimaciones del catálogo, basadas en las versiones fijadas de los modelos y las cargas de trabajo medidas. El uso de GPU y la velocidad varían con la carga. El modelo 9B deja poco margen en una GPU de 24 GB; comprueba el dictamen del instalador para la tarjeta elegida y los otros modelos en ejecución.

1. Abre **Connections**, expande **Local Model** y elige **Decision sidecar (experimental)** (proceso auxiliar de decisiones experimental).
2. Lee la advertencia y activa **Enable decision sidecar** (activar el proceso auxiliar de decisiones). Al confirmar se muestra el dictamen para tu computadora, y el botón dice **Enable anyway** (activar de todos modos) cuando el dictamen es una advertencia.
3. Elige un modelo y confirma su tamaño, el dictamen de hardware y las licencias. No se descarga nada antes de ese punto. **Open-Jev 2B** necesita mucha menos memoria que **Open-Jev 9B**; ninguno garantiza respuestas correctas para tu chat.
4. Selecciona **Decision sidecar** en **Decision model**.

También puedes pegar el repositorio HuggingFace de un modelo de decisión. Marinara lee el manifiesto del propio repositorio, comprueba que el tipo de artefacto corresponda a un entorno incluido en esta compilación y muestra los pesos base que descargará y el tamaño total antes de ofrecer instalarlo. Rechaza con el motivo cualquier repositorio que no pueda verificar, en vez de instalarlo sin garantías.

En una computadora con varias GPU NVIDIA, un menú **GPU** elige la tarjeta donde se carga. Los dictámenes corresponden a esa tarjeta; cambiarla detiene el modelo para que se inicie allí.

Desactivar el proceso auxiliar detiene el proceso y conserva los archivos. **Remove files** (eliminar archivos) borra el modelo y su entorno de ejecución y sigue disponible cuando el proceso auxiliar está desactivado.

<a id="thresholds"></a>

## Umbrales

Las probabilidades no son directamente comparables entre modelos. El mismo ejemplo positivo puede puntuar 0,99 en un modelo y 0,2 en otro. El umbral predeterminado de Marinara depende de cómo esté conectado el modelo:

| Backend seleccionado | Umbral predeterminado de sí/no |
| --- | --- |
| Modelo de chat local Primary o Utility | 0,5 |
| Conexión Decision TypeSafe, OpenRouter o Custom System One | 0,5 |
| Decision sidecar administrado | La recomendación del manifiesto del modelo; 0,1 para los Open-Jev 2B y 9B integrados |

**Run when probability is at least** (ejecutar cuando la probabilidad sea al menos) de un agente puede reemplazar este valor predeterminado. El editor ofrece restaurar la recomendación del backend cuando el valor guardado difiere. Comprueba el ajuste siempre que cambies de modelo.

Las declaraciones en prompts y los campos Decision de lorebooks usan el valor predeterminado del backend; cambiar el umbral de un agente no cambia el suyo. **Un Open-Jev autoalojado detrás de una conexión Custom System One sigue usando 0,5.** Marinara no puede identificar y calibrar automáticamente endpoints personalizados arbitrarios. Sus resultados pueden diferir de los del proceso auxiliar Open-Jev administrado, incluida la interpretación de un resultado positivo inferior a 0,5 como no.

<a id="time-limits"></a>

## Límites de tiempo

Una decisión que no llega a tiempo no da respuesta. La generación continúa con el [respaldo de la función](#where-marinara-uses-it); esto puede omitir una rama de prompt o una entrada de lorebook requerida.

- **1,5 segundos** para una conexión Decision, salvo que cambies **Time limit** (límite de tiempo). Consulta [Configurar una conexión Decision](#set-up-a-decision-connection).
- **4 segundos** para un modelo local o el proceso auxiliar de decisiones. Cuando un turno evalúa muchas declaraciones, Open-Jev 9B recibe un poco más de tiempo por cada declaración adicional.
- **20 segundos** para un modelo local que debe razonar primero.

Las solicitudes de decisión se detienen cuando cancelas una generación.

## Otros ajustes de Decision model

- **Also use it to pick who speaks in Smart response order.** (Usarlo también para elegir quién habla en el orden de respuesta Smart). Desactivado de forma predeterminada. Consulta [Chats grupales](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn.** (Declaraciones de decisión por turno). Limita la planificación de declaraciones de prompts y lorebooks, 32 de forma predeterminada y hasta 255. El presupuesto se aplica en varias etapas; no es un límite único para todas las solicitudes Decision ni para el gasto de un turno. Las preguntas de activación de agentes y el orden de respuesta Smart son independientes. Consulta [Límites y costo](../prompts/conditional-prompts.md#limits-and-cost) para el alcance, los lotes y las reglas de prioridad.
- **Also gate agents that run before the reply** y **Thinking** aparecen para un modelo local. Consulta [Usar un modelo que ya ejecutas](#use-a-model-you-already-run).

## Precisión: prevé respuestas incorrectas

Cualquier modelo puede responder incorrectamente. En la pequeña prueba de redacción anterior, varias respuestas "sí" correctas de Open-Jev 2B quedaron apenas por encima de su umbral. Prevé respuestas ausentes o equivocadas:

- Usa una decisión para afinar, nunca para algo indispensable para el chat. Una decisión fallida debería hacer la respuesta un poco menos adaptada, no romperla.
- No supedites el consentimiento, las advertencias de contenido ni las instrucciones de seguridad a una decisión.
- Para un agente que solo se ejecuta con una pregunta de activación, configura **Bypass the question after this many messages** (omitir la pregunta después de esta cantidad de mensajes) para que un modelo que siga respondiendo "no" no pueda silenciarlo para siempre.

Para ejemplos concretos de redacción y una forma de probarlos en tus chats, consulta [Redactar declaraciones](../prompts/conditional-prompts.md#writing-statements).

## Solución de problemas

- **Test falla.** El mensaje explica por qué: la clave fue rechazada, el proveedor limita la frecuencia, el modelo local no está en ejecución, el modelo de decisión no está instalado, el modelo no respondió sí o no o se agotó el tiempo.
- **Test indica que la respuesta superó el límite de tiempo, o las decisiones solo funcionan a veces.** El proveedor responde más despacio que el **Time limit** de la conexión al menos algunas veces. Prueba varias veces y sube el límite por encima de la respuesta más lenta.
- **Un agente con pregunta de activación se ejecuta cada turno.** No hay un Decision model configurado o no responde, así que el agente se ejecuta como si no tuviera pregunta. Comprueba **Test**.
- **Una rama de decisión en un prompt nunca aparece.** Consulta [Cuando una rama de decisión nunca aparece](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **El orden de respuesta Smart sigue haciendo su llamada habitual a la IA.** El interruptor está desactivado o el Decision model no respondió en ese turno.
- **Para ver cada declaración y su respuesta,** establece el nivel de registro en debug. Consulta [Niveles de registro](../CONFIGURATION.md#logging-levels).

## Guías relacionadas

- [Crear agentes personalizados](../agents/custom-agents.md)
- [Prompts condicionales](../prompts/conditional-prompts.md)
- [Chats grupales](../chats/group-chats.md)
- [Configuración del Local Model](local-model.md)
- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
