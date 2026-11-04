# Peek Prompt: mira lo que recibió la IA

Peek Prompt muestra el texto exacto que Marinara Engine envió al modelo para una respuesta, o una vista previa en vivo de la siguiente. Úsalo cuando una respuesta no es lo que esperabas y quieres saber qué vio el modelo.

El prompt (las instrucciones enviadas a la IA) es el bloque completo de instrucciones e historial del chat que Marinara arma y envía. El modelo lo lee y escribe la respuesta.

## Abrir Peek Prompt

Hay dos formas de abrir la ventana **Assembled Prompt** (Prompt armado).

Desde un mensaje:

1. Toca el mensaje de IA más reciente para mostrar su barra de acciones.
2. Haz clic en **Peek prompt** (una lupa).

Solo aparece en el último mensaje de IA. Los mensajes más antiguos no lo muestran.

Desde el cuadro de entrada, lo que también funciona antes de cualquier respuesta de la IA:

1. Escribe este texto exacto en el cuadro de mensaje: `{{prompt}}`
2. Pulsa <kbd>Enter</kbd> o haz clic en **Send** (Enviar).

Marinara vacía el cuadro y abre la ventana en lugar de enviar un mensaje. `{{prompt_preview}}` y `{{preview_prompt}}` hacen lo mismo.

## Qué muestra la ventana

Una insignia junto al título indica qué versión del prompt estás leyendo.

| Insignia | Significado |
| --- | --- |
| **Exact Text Model Request** | La petición literal que se envió al modelo. |
| **Live Preview** | Una vista previa armada en este momento. |
| **Raw Messages** | La lista sin procesar de mensajes. |
| **Prompt Preview** | Una vista previa general. |
| **Decision test preview** | Un prompt armado con las respuestas de una prueba de decisiones. No se envió al modelo de chat. |

Debajo, un panel de información puede mostrar el servicio y el modelo, un recuento estimado de tokens y el recuento real de tokens del prompt cuando termina una respuesta. Un token es un pequeño fragmento de texto que los modelos cuentan en lugar de palabras. También muestra etiquetas con los valores usados, como **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** y **Assistant Prefill**, y valores de muestreo como **Top P**, **Top K** y **Min P**. Las etiquetas como **Service Tier** y **Assistant Prefill**, y los valores de muestreo, son ajustes avanzados del modelo. Al principio puedes ignorarlos. Si el primer modelo falló y tu respaldo escribió la respuesta, el panel nombra el modelo que falló y un motivo breve, como "key rejected" o "rate limited".

El resto es el prompt en secciones plegables, cada una con su propia estimación aproximada de tokens. Los mensajes del chat se agrupan bajo **Chat History** (Historial del chat). En una petición exacta guardada, el servicio puede haber combinado varios turnos del chat en un solo bloque, así que expande cada bloque para ver todo el texto. Haz clic en el encabezado de una sección para abrirla o cerrarla.

### Copiar el prompt

Haz clic en el botón de copiar que está junto al botón de cerrar. Copia todas las secciones y todos los mensajes como texto sin formato, en el orden en que se enviaron, incluidas las secciones cerradas. Cada mensaje empieza con una línea que nombra su rol, como `[system]`, `[user]` o `[assistant]`. En una petición exacta guardada, copia la petición tal como se envió. Copiar no envía nada.

### Buscar texto en el prompt

Usa el campo **Find** (Buscar) de la parte superior, o pulsa <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>Cmd</kbd>+<kbd>F</kbd> en un Mac) dentro de la ventana. La búsqueda no distingue mayúsculas y minúsculas y abarca todo el prompt, incluidas las secciones cerradas y el historial del chat. El contador muestra la coincidencia actual, por ejemplo "2 of 5". Usa los botones de arriba y abajo, o <kbd>Enter</kbd> y <kbd>Shift</kbd>+<kbd>Enter</kbd>, para moverte entre coincidencias. Al llegar a cualquiera de los extremos, continúa por el otro. Mientras **Find** tiene texto, la ventana muestra el texto completo de los mensajes. Vacía el campo para volver a las secciones.

## Revisar una respuesta con Reply checkup

Cuando Marinara detecta una causa probable de una respuesta deficiente, la ventana muestra un panel **Reply checkup** (Revisión de la respuesta) encima del prompt. Puede decir:

- La tarjeta de personaje es grande y ocupa una parte importante del presupuesto del prompt (**Large character card**).
- La respuesta alcanzó su límite de tokens y se detuvo a mitad de una frase (**Cut off**).
- El modelo no devolvió ningún texto visible (**Empty reply**).
- No se enviaron mensajes antiguos porque el prompt no cabía (**N older messages not sent**).
- Algunas entradas del lorebook (libro de trasfondo) coincidieron pero no cupieron en el presupuesto (**N lorebook entries left out**).
- El límite de la respuesta se redujo para hacer sitio al prompt (**Reply limit cut**).

Cuando ayuda, un enlace salta al ajuste que hay que cambiar, como **Max output tokens** o **Lorebook token budget**.

## Depurar una respuesta inesperada

Abre **Assembled Prompt** y revisa:

- **Información que falta.** Si una entrada de lorebook, una memoria o un detalle de la persona no está en ninguna sección, el modelo nunca lo vio.
- **Etiquetas de parámetros.** Un valor alto de **Temperature** puede volver aleatorias las respuestas, y un valor bajo de **Max Output Tokens** puede cortarlas.
- **Chat History.** Confirma que los mensajes que esperas están ahí, en el orden correcto.
- **Recuento de tokens.** Un prompt grande puede empujar los mensajes más antiguos fuera del límite del modelo.

Luego corrige la causa: edita una tarjeta de personaje, ajusta una entrada de lorebook o cambia un ajuste de generación. Consulta [Parámetros de generación](../prompts/generation-parameters.md).

Para leer la dirección que hay detrás de una respuesta guiada, usa **Stored guidance** (Guía guardada) en el mensaje. Consulta [Generación guiada e Impersonate](guided-and-impersonate.md#read-stored-guidance).

<a id="testing-decision-statements"></a>

## Probar declaraciones de decisión

Un [Decision model](../connections/decision-models.md) (modelo de decisión) responde preguntas de sí o no para funciones como los lorebooks. **Decision diagnostics** (Diagnóstico de decisiones), dentro de Peek Prompt, te permite inspeccionar y probar esas preguntas en el chat actual.

1. Abre Peek Prompt y busca **Decision diagnostics**.
2. Al abrirlo, o al hacer clic en **Preview inputs** (Vista previa de entradas), se preparan los cuerpos de las solicitudes sin preguntar a ningún modelo. Expande **Prepared request bodies** (Cuerpos de solicitudes preparados) para ver los mensajes recientes, las declaraciones resueltas, las opciones y el formato de la solicitud.
3. Haz clic en **Test decisions** (Probar decisiones) para hacerle a tu modelo de decisión las preguntas permitidas.

**Test decisions** hace solicitudes reales, así que un modelo alojado puede cobrarlas. No escribe una respuesta de chat, no ejecuta agentes, no cambia el estado del juego ni guarda sus respuestas o temporizadores en el chat. Puede que algunas declaraciones de lorebook posteriores solo resulten accesibles después de responder una anterior. Una prueba explícita puede esperar a un modelo local de razonamiento aunque las decisiones normales anteriores a la respuesta se aplacen. Esto no cambia tu ajuste para las respuestas en vivo.

Cada resultado muestra su puntuación cuando la hay, el umbral de una declaración de sí o no, y la respuesta. Un modelo que solo devuelve "yes" o "no" se indica como tal, y su respuesta no se muestra como una probabilidad. Los resultados de elección muestran la opción elegida. Las decisiones mantenidas, aplazadas, por encima del límite, no disponibles y fallidas tienen cada una su propia explicación.

Después de una prueba, el prompt de abajo usa las respuestas de la prueba. Haz clic en **Show original prompt** (Mostrar prompt original) para volver a lo que abriste, o en **Show tested prompt** (Mostrar prompt probado) para volver al prompt probado. **Requests sent and results** (Solicitudes enviadas y resultados) muestra los cuerpos reales de las solicitudes y los resultados, sin encabezados de autenticación.

Si no funcionó: **Could not prepare the decision test. Check the chat connection and try again.** Comprueba que el chat tiene un modelo que funcione y vuelve a intentarlo.

Las pruebas usan el chat y los ajustes actuales, incluso cuando abriste Peek Prompt desde una respuesta anterior. No reconstruyen las solicitudes de decisión originales. Cubren las declaraciones del prompt y las decisiones de lorebook, no la activación de agentes ni las decisiones posteriores a la respuesta.

Cuando **Use Decision model** (Usar modelo de decisión) está activado para Advanced Memory (la función de memoria a largo plazo de Marinara; consulta [Memory Recall y resúmenes del chat](../agents/memory.md)), el panel también muestra **Advanced Memory activity** (Actividad de Advanced Memory). Estos informes guardados muestran la última recuperación y la última comprobación de fin de escena con su modelo, tiempo, puntuaciones, selecciones y estado del respaldo. Describen llamadas anteriores, no la vista previa actual, y pueden aparecer aunque el prompt no tenga declaraciones de decisión. Los swipes (respuestas alternativas) compatibles pueden reutilizar un informe de recuperación anterior. Cada informe conserva hasta 128 resultados, primero los seleccionados, y cuenta el resto. Los informes nuevos aparecen después de la siguiente llamada permitida al modelo de decisión. Verlos no hace ninguna solicitud al modelo.
