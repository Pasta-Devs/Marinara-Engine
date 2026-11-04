# Memory Recall y resúmenes del chat

Cada modelo de IA solo puede leer una cantidad limitada de texto a la vez, llamada ventana de contexto. En un chat largo, los mensajes más antiguos salen de ella y la IA los olvida. Marinara Engine (Marinara de aquí en adelante) tiene varias formas de recuperar ese historial. Esta guía muestra cómo activar cada una y cómo arreglarla cuando no funciona.

## ¿Qué función de memoria quiero?

Empieza con **Memory Recall**. Funciona sin configuración adicional, porque Marinara puede usar un modelo de embeddings integrado en tu computadora. Añade resúmenes cuando los chats se hagan muy largos.

| Función | Qué hace | Funciona en |
| --- | --- | --- |
| **Memory Recall** | Busca en los mensajes más antiguos las partes relacionadas con lo que acabas de decir y las agrega al prompt (las instrucciones enviadas a la IA). | Todos los modos |
| **Chat Summary** | Reemplaza los mensajes antiguos con recapitulaciones cortas. | Roleplay |
| **Automatic Summarization** | Resume cada día y luego cada semana. Siempre activado. | Conversation |
| **Advanced Memory Recall** | Gestiona conjuntamente el historial actual, los resúmenes de escenas y los fragmentos recuperados. Opcional. | Roleplay y Game Mode |

Memory Recall y los resúmenes hacen tareas distintas y pueden funcionar juntos. Game Mode tiene Memory Recall y, de forma opcional, Advanced Memory Recall (consulta [En Game Mode](#in-game-mode)). No tiene ninguna función de resumen propia.

## Memory Recall

Memory Recall usa embeddings. Un embedding es una huella numérica de lo que significa un mensaje. Marinara guarda los mensajes pasados en pequeños grupos llamados fragmentos. Compara la huella de tu mensaje nuevo con las huellas guardadas y agrega al prompt los fragmentos más cercanos.

### Activar Memory Recall

1. Abre un chat y haz clic en **Chat Settings** (Ajustes del chat).
2. Busca la sección **Memory Recall**.
3. Activa **Enable Memory Recall**.

El ajuste es por chat. Empieza activado en los chats de Conversation y en los chats de Roleplay o Game que tienen una Scene (escena) activa. Empieza desactivado en los demás chats. Desactivarlo detiene la recuperación, pero no borra las memorias guardadas.

Si no funcionó: Memory Recall necesita una fuente de embeddings (siguiente sección). Si no configuras ninguna, Marinara usa su modelo integrado, así que la mayoría de las personas puede saltarse esa sección. Comprueba, para empezar, que la sección **Memory Recall** aparezca. Algunas compilaciones en contenedor, conocidas como Marinara Lite, desactivan Memory Recall por completo.

### Configurar la fuente de embeddings (opcional)

Memory Recall necesita un modelo que cree las huellas. Si no configuras nada, Marinara usa el modelo de embeddings integrado (consulta más abajo), que es la opción sencilla para la mayoría de las personas. Para usar un servicio en su lugar, configúralo en una cuenta, no en los ajustes del chat.

Antes de empezar: necesitas una cuenta que ofrezca embeddings. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).

1. Abre **Connections** (Conexiones) y edita la cuenta.
2. Busca la sección **Semantic search (embeddings)** (Búsqueda semántica: embeddings).
3. Escribe el nombre de un modelo de embeddings, por ejemplo `text-embedding-3-small`.
4. Opcional: define **Embedding endpoint URL** (URL del endpoint de embeddings) para cambiar la dirección.
5. Opcional: usa **Embedding provider** (Proveedor de embeddings) para tomar prestadas la clave y la dirección de otra cuenta. **Same as this provider** (Igual que este proveedor) conserva las de esta cuenta.

Algunos servicios no ofrecen embeddings. En ese caso, Marinara te pide elegir una cuenta de embeddings dedicada, como una compatible con OpenAI, Google o el modelo integrado.

Para usar una sola fuente en todas partes, elígela en **Embeddings**, dentro de **Connections → Defaults** (Conexiones → Valores predeterminados). Las cuentas sin un modelo de embeddings propio la usan. El ajuste propio de una cuenta sigue teniendo prioridad.

Sin una cuenta de embeddings ni un valor predeterminado de **Embeddings**, Marinara recurre a un modelo de embeddings integrado. Se descarga una sola vez y se ejecuta en tu computadora sin ninguna API key (clave de API). Consulta [Configuración del modelo integrado](../connections/local-model.md).

El mismo ajuste impulsa la búsqueda semántica de los lorebooks (libros de trasfondo), así que lo configuras una sola vez para ambas funciones.

### Ver y gestionar las memorias guardadas

1. Abre **Chat Settings → Memory Recall**.
2. Haz clic en **Access memories for this chat** (Acceder a las memorias de este chat). Se abre la ventana **Memories for This Chat**. Con Advanced Memory activado, el visor permanece dentro del panel lateral de Roleplay.

La ventana muestra el número de fragmentos guardados y un recuento aproximado de tokens (fragmentos de texto). Cada tarjeta de fragmento muestra su rango de fechas, el recuento de mensajes, cuándo se creó y un estado.

| Estado | Significado |
| --- | --- |
| **Vectorized** | La huella está construida y lista para buscar. |
| **Waiting for vector** | La huella todavía se está creando. |
| **Embedding unavailable** | Ninguna fuente de embeddings pudo construirla. |

La barra de herramientas tiene iconos para exportar, importar, reconstruir y borrar memorias.

- El icono de papelera de un fragmento abre **Forget Memory**. Confirma con **Forget**.
- El icono de borrar todo abre **Clear Memories**. Confirma con **Clear**. Esto elimina las memorias de recuperación, no los mensajes de tu chat.
- El icono de actualizar reconstruye cada fragmento a partir de los mensajes actuales. Úsalo después de cambiar el modelo de embeddings.
- Exportar guarda un archivo `.marinara.json`. Importar acepta archivos `.json` o `.marinara` y los fusiona con las memorias existentes.

### Cómo se comporta Memory Recall

- Marinara guarda fragmentos en segundo plano siempre que existe una fuente de embeddings, incluso si **Enable Memory Recall** está desactivado. El interruptor solo controla si las memorias se agregan al prompt.
- Un fragmento necesita al menos 5 mensajes nuevos antes de crearse.
- Las coincidencias débiles se omiten, así que la recuperación puede no devolver nada aunque existan memorias. Solo se usa una pequeña parte del prompt para las memorias recuperadas.
- Después de cambiar el modelo de embeddings, los fragmentos antiguos dejan de coincidir. Reconstrúyelos.
- Borrar los mensajes de un chat también borra sus fragmentos.

## Chat Summary (Roleplay)

Chat Summary comprime los mensajes antiguos en recapitulaciones cortas llamadas entradas de resumen. Cada entrada puede escribirla la IA o tú, y cada una se puede activar o desactivar. Es solo para los chats de Roleplay.

Abre **Chat Settings** y despliega **Chat Summary**, debajo de **Lorebooks**. En una computadora puedes sacarla a una ventana propia. Consulta [Descripción general de Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Crear una entrada de resumen

1. En **Summary Scope**, elige **Last** para los mensajes más recientes, o **Range** para un rango de mensajes.
2. Haz clic en **Generate** para que la IA escriba una entrada, o haz clic en **Write** para escribirla tú.

Cada entrada muestra un título, su rango de origen o su recuento de mensajes, y una estimación de tokens. Puedes activarla o desactivarla, expandirla, cambiarla con **Edit** o borrarla con **Delete**. **Show Inactive** y **Hide Inactive** cambian lo que muestra la lista. **Activate All** y **Deactivate All** cambian todas las entradas a la vez.

Para cambiar varias entradas, márcalas (en una computadora, mantén Shift y haz clic para seleccionar un rango) y luego usa **Enable selected** (Activar seleccionadas) o **Disable selected** (Desactivar seleccionadas).

Si **Review Agent Outputs** (Revisar salidas de los agentes) está activado, los resúmenes de IA esperan tu aprobación. Consulta [Aprobaciones de agentes y el Agent Suite](approvals-and-agent-suite.md).

### Automatic Summaries

El panel **Automatic Summaries** mantiene los resúmenes al día mientras chateas.

1. Activa **Enabled**.
2. Define en **Every** cuántos mensajes del usuario pasan entre un resumen y otro. El valor predeterminado es 5. El rango va de 1 a 200.
3. Opcional: haz clic en **Backfill Summary** para resumir un chat antiguo que nunca tuvo resúmenes. Aparece una barra de progreso. Haz clic en **Stop** para terminarlo antes.

### Prompt de resumen, proveedor y tamaño de salida

- **Summary Prompt**: haz clic en **Edit** para cambiar las instrucciones que usa la IA. Haz clic en **Templates** para gestionar los prompts guardados con **New template**, **Duplicate**, **Edit** y **Delete**. Las plantillas son globales: elegir una en un chat de Roleplay cambia el prompt de todos los chats de Roleplay.
- **Summary Provider** (Proveedor de resúmenes): la cuenta que escribe los resúmenes. Usa primero tu cuenta de agentes predeterminada y, en segundo lugar, la del propio chat.
- **Maximum output size**: qué longitud puede tener un resumen. El valor predeterminado es 4096 tokens. El rango va de 1 a 32768.

### Opciones de visualización

- **Hide summarised messages**: oculta los mensajes originales una vez que un resumen los cubre. Desactivado de forma predeterminada.
- **Recent message tail**: mantiene visible esta cantidad de los mensajes más nuevos incluso cuando la ocultación está activada. El valor predeterminado es 10. Sirve cualquier número entero desde 0. Poner 0 oculta todo el lote resumido. Los valores más altos hacen los prompts más grandes y más costosos.
- **Collapse hidden messages**: cambia cómo se ven los mensajes ocultos en la transcripción.

### Chats grupales combinados

En un chat grupal combinado, una sola respuesta habla por todos los personajes. Una parte de una entrada escrita para ciertos personajes, como `{{#if char == "Kaito"}}…{{/if}}`, se conserva para todos los personajes a los que se aplica y se marca con quiénes la conocen, por ejemplo "known only to Kaito". Las partes que solo recibe el **Narrator** (Narrador) de Advanced Memory quedan fuera. En los chats grupales en los que los personajes responden de uno en uno y en los chats de un solo personaje, cada personaje lee las entradas como antes, y el Narrator lee todas las partes.

## Automatic Summarization (Conversation)

Los chats de Conversation resumen cada día del calendario y luego combinan las semanas terminadas en un resumen de semana. El prompt entonces lleva solo los resúmenes de semana, los resúmenes de día de la semana actual y los mensajes de hoy. Esto se ejecuta por su cuenta y no se puede desactivar.

### Editar los resúmenes

1. Abre un chat de Conversation y haz clic en **Chat Settings**.
2. Busca **Automatic Summarization**.
3. Haz clic en **Edit Summaries**.

La ventana lista primero las semanas y luego los días que aún no se han incluido en una semana. Expande una entrada para editar su texto de **Summary** y sus filas de **Key Details**.

### Definir cuándo termina un día

- **Day Rollover Hour**: la hora en que empieza un nuevo día para los resúmenes. El valor predeterminado es 4 AM. Puedes elegir cualquier hora desde las 12 AM hasta las 11 AM. Los mensajes anteriores a esta hora cuentan como del día anterior. Elige una hora en la que no estés chateando. Si la cambias cuando ya existen resúmenes, Marinara te advierte que los resúmenes antiguos usaron la hora anterior.
- **Recent Message Tail**: cuántos de los mensajes más nuevos de hoy se mantienen palabra por palabra después de resumirse. El valor predeterminado es 10. Los valores más altos hacen los prompts más grandes y más costosos.

### Rellenar los días que faltan

A un día le puede faltar su resumen, por ejemplo después de importar un chat antiguo. En la ventana, el panel **Missing Summaries** tiene un botón **Backfill**. Reintenta hasta 14 días recientes a la vez. Cambiar el modelo de resumen no reescribe las entradas de día o de semana que ya existen.

<a id="advanced-memory-recall-roleplay-and-game-mode"></a>

## Advanced Memory Recall (Roleplay y Game Mode)

Advanced Memory Recall es un modo opcional que gestiona conjuntamente la ventana del historial actual, los resúmenes de continuidad y los fragmentos antiguos. Divide el chat en escenas, resume cada escena terminada y recupera las escenas y los mensajes exactos que importan para cada respuesta. Funciona sin el interruptor Agents y no necesita ningún agente descargable.

### Activarlo

1. Abre **Chat Settings → Memory Recall**.
2. Activa **Advanced Memory Recall**. También puedes activar **Automatic context and memory handling** (Gestión automática del contexto y la memoria), debajo de Agents en el asistente de configuración de Roleplay.
3. Define **Maximum allowed context before compression (tokens)** (Contexto máximo permitido antes de la compresión: tokens) dentro de la ventana de contexto de tu modelo.
4. Define **Summary and recall budget (tokens)** (Presupuesto de resúmenes y recuperación: tokens) dentro de ese límite.
5. Opcional: elige un **Helper model** (Modelo auxiliar).

Para un chat que ya tiene historial, haz clic primero en **Prepare existing history** (Preparar historial existente); consulta más abajo. Los ajustes y el progreso aparecen tanto en el asistente como en el panel lateral **Chat Settings**, en escritorio y en móvil. El visor del archivo permanece en el panel lateral.

### Ajustes

| Ajuste | Valor predeterminado | Qué hace |
| --- | --- | --- |
| **Maximum allowed context before compression (tokens)** | 65.000 | Cuando el prompt saliente alcanza este tamaño, el contexto más antiguo se recorta y se resume para la recuperación. |
| **Summary and recall budget (tokens)** | 6.500 | Cuánto del contexto se destina a las memorias. Se recomienda al menos el 10% del máximo. |
| **Helper model** | La cuenta de agentes y, si no, la cuenta del chat | Decide las escenas y escribe los resúmenes y la continuidad. |
| **Maximum recalled scenes** (Máximo de escenas recuperadas) | 3 | Límite superior de escenas recuperadas por respuesta. 0 desactiva la recuperación opcional de escenas. |
| **Moving context** (Contexto móvil) | De 3 a 5 mensajes | Mensajes de cada fragmento recuperado. 0 en ambos da resúmenes sin fragmentos. |
| **Standalone scene check interval (messages)** | 5 | Cuántos mensajes nuevos pasan entre una comprobación de escena y otra. |
| **Use Decision model** (Usar modelo de decisión) | Desactivado | Permite que un modelo de decisión encuentre los finales de escena y elija las memorias. |
| **Decide who sees new messages** (Decidir quién ve los mensajes nuevos) | Desactivado | Solo en chats grupales en los que los personajes responden de uno en uno. |
| **Character recollections** (Recuerdos personales de los personajes) | Desactivado | Da a cada personaje su propio recuerdo de una escena. |

El presupuesto predeterminado es el 10% del máximo predeterminado. Cambiar el máximo más tarde no lo modifica. El límite cubre todo el prompt saliente estimado: instrucciones, mensajes, contexto recuperado, herramientas y adjuntos. Los tokens de respuesta y el margen de seguridad van aparte. Es una estimación, no un límite exacto del tokenizador ni de facturación.

Todas las llamadas de resumen de memoria usan **Chat Summary → Maximum output size**, con al menos 8.196 tokens de salida para dejar espacio al razonamiento.

### Preparar el historial existente

1. Haz clic en **Prepare existing history**. Los modelos resueltos aparecen antes de que empiece.
2. Espera. Procesa el historial antiguo por lotes y muestra su fase actual.
3. Usa **Cancel** para detenerlo. El trabajo completado se conserva. Usa **Resume** para continuar, incluso después de cerrar el panel lateral, reiniciar el servidor o actualizar la app.

Una llamada al modelo fallida conserva la memoria válida anterior y muestra un error para reintentar. No restablezcas la memoria después de un fallo: **Resume** reutiliza los resúmenes completados. La última escena en curso permanece abierta y se resume cuando se cierra.

Si el historial recuperado cambia una escena cubierta por una corrección manual, desactiva esa memoria para conservar su texto como referencia, o elimínala, y luego vuelve a preparar el historial. **Fix** (Reparar) omite esa escena y la incluye en la lista en lugar de detenerse.

Una rama creada a partir de un chat preparado, por ejemplo con **Branch from here** (Ramificar desde aquí), conserva su Advanced Memory. Una rama creada dentro de una escena vuelve a abrir esa escena: su resumen anterior se elimina y se escribe uno nuevo cuando la escena se cierra. Un chat importado como rama nueva se prepara como de costumbre.

<a id="fixing-memory-problems"></a>

### Reparar problemas de memoria

Cuando algo falla en la memoria de un chat, aparece un punto fijo con tu color de acento en el botón **Chat Settings**, y un aviso indica cuántas escenas tienen problemas. Cada conjunto de problemas se anuncia una sola vez, y el punto se mantiene hasta que se resuelvan. En **Chat Settings → Memory Recall**, los problemas aparecen en una lista encima de los ajustes. **Access memories for this chat** muestra el mismo punto.

Pulsa **Fix**, en el aviso o en la lista, para reparar de una sola vez todas las escenas marcadas. Usa el **Helper model**. **Pause processing** (Pausar el procesamiento) lo detiene y **Resume processing** (Reanudar el procesamiento) continúa. Fix:

- vuelve a preguntar al auxiliar quién estaba en las escenas marcadas con **Check who was there** (Comprueba quién estaba). Si sigue sin saberlo, nadie obtiene acceso y la escena aparece en la lista para que la revises;
- comprueba quién estaba en las escenas antiguas guardadas antes de que existieran las comprobaciones de participantes;
- escribe resúmenes nuevos para las escenas cuyos mensajes, mensajes ocultos, nombres de personajes o resúmenes de apoyo cambiaron, y para las escenas terminadas que no tienen resumen. Los resúmenes que eliminaste siguen eliminados;
- reanuda el trabajo de memoria que se detuvo por un error.

Fix nunca reescribe un resumen que editaste a mano. Esos los incluye en **need your review** (necesitan tu revisión) y sigue con lo demás. No puede cambiar ajustes por ti, como el intervalo de conocimiento de un personaje o una conexión de decisión que funcione.

Cuando Fix termina, muestra "Advanced Memory fixed N scenes" (Advanced Memory reparó N escenas) y los números de las escenas que necesitan revisión. Selecciona un número para abrir esa escena en **Access memories for this chat**. Si Chat Settings estaba cerrado, un aviso con **Show** (Mostrar) te lleva allí. En el siguiente Fix no se vuelve a preguntar por una escena que Fix no pudo decidir, así que guarda tú el acceso de los personajes de esa escena.

### Volver a escanear escenas

Si se pasaron por alto cambios de escena, por ejemplo cuando una escena nunca terminó, usa **Re-scan scenes** (Volver a escanear escenas) en **Chat Settings → Memory Recall**.

1. Introduce el número del primer y del último mensaje que quieres revisar. De entrada, abarca la escena en curso.
2. Pulsa **Re-scan** (Volver a escanear).

Advanced Memory vuelve a buscar los cambios de escena en esos mensajes y resume las escenas que cambiaron. Usa el modelo de decisión cuando **Use Decision model** está activado y, si no, el Helper model. Las escenas fuera del rango conservan sus límites y resúmenes. Si fuera a cambiar un resumen que editaste, el nuevo escaneo se detiene y nombra esa escena.

<a id="optional-decision-model"></a>

### Modelo de decisión opcional

Un modelo de decisión es un modelo pequeño que responde preguntas de sí o no. Está desactivado de forma predeterminada y se guarda por cada chat de Roleplay.

1. Activa **Use Decision model** en Advanced Memory.
2. Elige un modelo en **Memory Decision connection** (Conexión de decisión para la memoria). En **Built-in model** (Modelo integrado) aparecen los mismos modelos que en el **Decision model** (modelo de decisión) global. Uno que todavía no puede responder aparece atenuado con el motivo, y uno que está detenido se inicia cuando se le pregunta. En **Connections** aparecen tus cuentas de decisión guardadas. Consulta [Modelos de decisión](../connections/decision-models.md).

Esta elección es independiente del valor predeterminado global de decisión.

El modelo encuentra los límites de escena al preparar el historial y al comprobar las escenas en curso. Antes de una respuesta nueva, elige las memorias en dos pasadas. Consulta [Cómo funciona la recuperación con el modelo de decisión](#how-decision-recall-works) para ver los detalles.

Las cuentas de servicios alojados reciben el texto de la conversación reciente y las recapitulaciones o los mensajes preseleccionados que se evalúan, y pueden cobrar por varias solicitudes en cada respuesta. La recuperación filtra el acceso de los personajes antes de enviar candidatos.

<a id="deciding-who-sees-new-messages"></a>

### Decidir quién ve los mensajes nuevos

En un chat grupal de Roleplay en el que los personajes responden de uno en uno, Advanced Memory puede decidir qué personajes ven cada mensaje nuevo. Así no tienes que ocultar cada línea a un personaje que ha salido de la escena. Los chats grupales combinados y los chats de un solo personaje no lo ofrecen.

1. Activa **Decide who sees new messages** en Advanced Memory.

Cada mensaje nuevo, tuyo o de un personaje, se oculta a los personajes que no están en la escena. Usa el mismo **Hide from AI** (Ocultar a la IA) por personaje que el botón del propio mensaje, así que la marca de ojo tachado muestra quién no puede verlo. Tu mensaje se decide en cuanto lo envías. Los mensajes anteriores se deciden antes de que responda el siguiente personaje.

- El **Narrator** elegido aquí y el **Narrator character** (Personaje narrador) elegido en los ajustes de los comandos de Roleplay ven todos los mensajes. Quien escribe un mensaje siempre ve el suyo. El destinatario de un susurro que no está en la escena sigue recibiendo el susurro.
- Con **Use Decision model** activado, se pregunta a ese modelo, para cada personaje, si está claro que no puede ver ni oír el mensaje. Un personaje al que la historia nunca sitúa en la escena cuenta como si estuviera en otro lugar. De lo contrario, decide el **Helper model**. Un mensaje solo se oculta cuando el modelo está seguro.
- El modelo lee los mensajes de la escena actual hasta ese momento y, como mínimo, los últimos mensajes anteriores. También recibe una lista de los personajes que han hablado desde que empezó la escena. La lista es solo una indicación: un personaje que escucha en silencio sigue contando como presente.
- Si cambias tú el **Hide from AI** de un mensaje, o usas `/hide` o `/unhide`, tu elección se mantiene y Advanced Memory nunca vuelve a cambiar ese mensaje.
- Cada mensaje se decide una sola vez. Si el modelo falla o no responde a tiempo, no se oculta nada y el error aparece en el registro del servidor.

Con Advanced Memory activado, una respuesta nueva de un personaje puede cambiar de escena o de punto de vista con una línea de separación como `***`, `---` o `* * *`. La respuesta se guarda entonces como mensajes separados del mismo personaje, uno por parte.

- Cada parte tiene su propio público. **Decide who sees new messages**, **Hide from AI** y los susurros se aplican a cada parte.
- Quien la escribió sigue viendo todas las partes. Oculta tú una parte a ese personaje si no debería verla.
- La línea de separación queda al principio de la parte que la sigue. Una separación dentro de un bloque de código o de un bloque HTML, como `<details>`, no cuenta.
- El razonamiento de la respuesta se muestra en la primera parte. No se vuelve a enviar al modelo, ni siquiera con **Exclude Past Reasoning** (Excluir el razonamiento anterior) desactivado.
- La información del mensaje, los trackers y los resultados de los agentes van con la última parte.
- Los agentes de reescritura, como Prose Guardian, reescriben cada parte por separado. Con **Hold Message Until Rewrite** (Retener el mensaje hasta reescribir) activado, cada parte espera su propia reescritura. Si falla una reescritura, esa parte se queda como se escribió.
- La reproducción automática de voz lee todas las partes en orden.
- Un swipe (respuesta alternativa) o una regeneración de una parte da una versión nueva solo de ese mensaje. En una parte anterior, la versión nueva conserva el texto anterior a la primera separación.
- Continue e Impersonate nunca se dividen.

<a id="character-recollections"></a>

### Recuerdos personales de los personajes

Activa **Character recollections** para dar a cada personaje su propio recuerdo de una escena. Está desactivado de forma predeterminada.

- Cada personaje que estuvo en una escena terminada recibe un recuerdo personal breve, de unas 50 a 100 palabras, en primera persona y con su propia voz. Su tarjeta decide en qué se fija. El **Narrator**, tu persona y los personajes que estaban en otro lugar no reciben ninguno.
- El modelo solo puede usar lo que cada personaje podía saber. Un recuerdo personal que copia cuatro palabras seguidas de algo que su personaje no podía saber se omite. Un hecho contado con otras palabras solo lo evitan las instrucciones.

Cómo se mantienen correctos:

- Un recuerdo personal solo cuenta mientras su personaje puede leer exactamente lo mismo que cuando se escribió. Si más tarde un mensaje de la escena se le oculta o se le muestra, un recuerdo personal generado se vuelve a escribir. Uno que editaste queda fuera de los prompts hasta que lo revises y lo guardes de nuevo.
- Los recuerdos personales de una escena nueva salen de la misma solicitud que su resumen. Si una tarjeta de personaje es demasiado grande para eso, se piden después en solicitudes propias. Un personaje cuya tarjeta ocupa más de la mitad del espacio que tiene el auxiliar para la escena no recibe ninguno.
- Al activarlo en un chat con escenas ya resumidas, se añaden recuerdos personales escena por escena, y el proceso aparece como **Writing character recollections** (Escribiendo recuerdos personales de los personajes). Los resúmenes de escena nunca cambian. **Resume** vuelve a intentar las escenas que fallaron.
- Si el modelo no escribe nada útil, la escena conserva un recuerdo personal vacío hasta que cambien su resumen o el texto que se puede leer. Puedes escribir uno en **Access memories for this chat**.

Dónde aparecen y cuánto cuestan:

- Los recuerdos personales solo aparecen con las escenas recuperadas, debajo del resumen de la escena y antes de su fragmento, una línea por personaje. En un chat grupal en el que los personajes responden de uno en uno, cada personaje solo ve los suyos. En una respuesta combinada se muestran, con su nombre, los de todos los personajes presentes que recuerdan la escena.
- Cuentan para **Summary and recall budget**. Primero van los resúmenes, luego los recuerdos personales y después los fragmentos. Primero se reducen los fragmentos y luego se omiten recuerdos personales completos. Un recuerdo personal nunca se recorta.
- Los recuerdos personales nunca se copian en **Chat Summaries** ni deciden qué escenas se recuperan.
- Cuando cambia el resumen de una escena, sus recuerdos personales generados se vuelven a escribir después de cada respuesta, hasta tres escenas cada vez, empezando por las más recientes. **Prepare existing history**, **Re-scan scenes** y **Resume** los rehacen todos.

Edición y desactivación:

- En **Access memories for this chat**, abre una escena para leer y editar cada recuerdo personal. Uno editado se marca como **Manually edited** (Editado manualmente) y nunca se reemplaza. **Delete** lo quita de los prompts para siempre, pero puedes escribir uno nuevo.
- Desactivar el ajuste conserva los recuerdos personales guardados y los deja fuera de los prompts. La exportación, la importación y las ramas los incluyen.

<a id="in-game-mode"></a>

### En Game Mode

Los chats de Game Mode activan Advanced Memory Recall en **Chat Settings → Memory Recall**, de la misma manera. Sin él, una sesión de Game envía todo su historial en cada turno hasta el límite de contexto, así que una sesión larga cuesta muchos más tokens de entrada por turno. Con él, el prompt se mantiene por debajo de **Maximum allowed context before compression**. La escena actual se envía como mensajes actuales, y las escenas anteriores se envían como recapitulaciones más los momentos que elige la recuperación.

- **El Game Master lee todas las memorias.** No hay elección de Narrator, ni intervalos de conocimiento, ni visibilidad automática de mensajes, ni recuerdos personales de los personajes.
- **Ubicación.** Las recapitulaciones y las escenas recuperadas van después del historial, justo antes de las instrucciones del turno del GM. Las instrucciones y el historial que van delante se mantienen iguales de un turno a otro, así que una conexión con caché de prompts puede reutilizarlos. Cuando termina una escena, una solicitud no aprovecha la caché.
- **Origen.** Las recapitulaciones siguen la historia tal como la ves: se aplican tus ediciones de segmentos y se omiten las etiquetas de comandos del GM.
- **Sesiones.** Una sesión nueva conserva tus ajustes, pero empieza su propio archivo. El GM sigue recibiendo las recapitulaciones de sesiones anteriores.
- **Modelo de decisión.** Opcional y desactivado de forma predeterminada. Consulta [Modelo de decisión opcional](#optional-decision-model). Añade solicitudes pequeñas a cada turno.
- **Costo.** El Helper model escribe una recapitulación por escena y comprueba si hay un cambio de escena cada pocos turnos. Esas solicitudes son pequeñas en comparación con reenviar una sesión larga completa.
- La vista previa del prompt de un chat de Game todavía no muestra Advanced Memory. Usa el inspector final del prompt.

## Solución de problemas

| Problema | Solución |
| --- | --- |
| Memory Recall no recupera nada | Comprueba que haya una fuente de embeddings configurada. Si los fragmentos muestran **Embedding unavailable**, configura un modelo en **Semantic search (embeddings)** o usa el modelo integrado. Consulta [Configuración del modelo integrado](../connections/local-model.md). |
| Los fragmentos muestran **Waiting for vector** | Dales tiempo. Las huellas se construyen después de las respuestas. |
| Nada parece relacionado | La recuperación solo agrega memorias muy relacionadas. No agregar nada es normal. |
| La recuperación empeoró después de cambiar de modelo de embeddings | Usa el icono de reconstruir en **Memories for This Chat**. |
| Los resúmenes no se generan | El chat necesita una cuenta de texto que funcione. Chat Summary usa **Summary Provider**. Si ninguna funciona, se omite la generación. |
| Los resúmenes de IA nunca aparecen | Puede que **Review Agent Outputs** esté esperando tu aprobación. |
| Un resumen está atascado | Los resúmenes fallidos se reintentan tras un retardo. Ejecuta **Backfill Summary** (Roleplay) o **Backfill** (Conversation). |
| Una escena está marcada con **Check who was there** | Pulsa **Fix**, o ábrela en **Access memories for this chat** y usa **Edit character access** (Editar el acceso de los personajes). |

Para otros problemas, consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Referencia de Advanced Memory

Detalles que la mayoría de las personas no necesita. Los ajustes de arriba funcionan sin leer esto.

### Cómo se detectan y resumen las escenas

- La detección de escenas se ejecuta después de guardar la respuesta principal de Roleplay. Cuando llegan tantos mensajes nuevos como indica el intervalo, el detector recibe todos los mensajes desde la última comprobación (hasta el doble del intervalo), el mensaje en el que terminó la última comprobación, las instrucciones de escena y el formato de salida. Devuelve el mensaje exacto que cierra cada escena, o ninguno si la escena continúa. Cuentan tanto los mensajes de tu persona como los de los personajes.
- Con el modo de decisión desactivado, una comprobación programada comparte una llamada apta de un tracker de posprocesamiento cuando la visibilidad y el presupuesto de contexto lo permiten. Si no, el auxiliar hace su propia llamada. Las transiciones dudosas dejan la escena abierta.
- Solo un final detectado inicia en segundo plano la preparación del resumen y del índice de mensajes de esa escena. **Chat Settings → Agent activity** muestra el progreso como **Advanced Recall**, incluso con los agentes normales desactivados.
- Cada solicitud de resumen de escena contiene las instrucciones de resumen, los mensajes aptos de la escena, las correcciones por rango aplicables y el formato de salida JSON. Las escenas demasiado grandes para una sola solicitud se procesan en lotes guardados y luego se combinan. Las recapitulaciones piden de 2 a 3 párrafos. El prompt predeterminado escribe una recapitulación histórica sin sección de situación actual. Siguen aplicándose los prompts personalizados elegidos en **Summaries**.
- La detección inicial del historial puede usar el modelo principal o el auxiliar. Los resúmenes siempre usan el auxiliar.
- Cada resumen también registra quién participó. Un nombre de participante distinto del de la tarjeta, como "Kaito" para **Kaito Nakamura**, cuenta cuando corresponde exactamente a un personaje y no es el nombre de tu persona. Los nombres compartidos, las descripciones como "Kaito's sister" y los nombres con notas como "(mentioned)" no dan acceso. Cuando el auxiliar no dice quién participó, la escena se asigna a todos los personajes, y en un chat grupal se marca con **Check who was there**. Una escena que solo te incluye a ti sigue reservada al narrador. Las escenas guardadas antes de que existieran las comprobaciones de participantes siguen reservadas al narrador hasta que **Fix** o **Prepare existing history** las comprueben. Cada respuesta que termina una escena también comprueba hasta tres.
- En un chat grupal antiguo en el que los personajes responden de uno en uno, confirma una vez los intervalos de conocimiento que falten. La primera intervención de un personaje no demuestra que conociera todo lo anterior. Elige un personaje real como **Narrator** solo si debe saltarse los límites de participación. **Hide from AI** global solo quita un turno de la transcripción activa. Advanced Memory sigue analizándolo, resumiéndolo e indexándolo. Los marcadores de inicio recortan la transcripción activa.

### La ventana actual y el presupuesto

- La prioridad en el prompt es: constantes (resúmenes siempre activos), luego resúmenes de escenas seleccionadas, luego recuerdos personales de los personajes y, por último, fragmentos de mensajes. Las constantes tienen como objetivo ocupar como máximo el 70% del presupuesto. La memoria total puede usar hasta 2.000 tokens adicionales cuando hace falta, dentro del límite de contexto. Los mensajes actuales no cuentan para la parte constante.
- Cuando el prompt saliente alcanza el límite, la ventana actual vuelve al comienzo de la escena más reciente para todos los personajes y luego vuelve a crecer. Las continuaciones de llamadas a funciones y de tiradas no cuentan. El corte aparece en **Mark as new start** con **All** seleccionado. Desmarca All para deshacerlo. Las marcas de inicio personales siguen aplicándose. Si una escena sin terminar o una constante demasiado grande no cabe, la solicitud usa fragmentos de origen marcados como tales y conserva los mensajes más recientes. Los resúmenes y mensajes guardados nunca se sobrescriben.
- La generación principal lee la memoria guardada de inmediato. Nunca espera una tarea de continuidad.
- Después de la respuesta principal, Advanced Memory añade **Chat Summaries** para los mensajes archivados que todavía no cubre ningún resumen. En un chat grupal en el que los personajes responden de uno en uno, todos los que leyeron una escena comparten un único resumen de ella.
- Cuando los resúmenes activos que lee un personaje superan el 70% del presupuesto, **Updating continuity** los combina y los acorta después de la respuesta, con el auxiliar y **Chat Summary → Maximum output size**. La respuesta nunca espera. Un resumen que todavía cubre mensajes actuales espera hasta que salgan de la ventana actual.
- Los resúmenes que leen distintos personajes se combinan en uno solo, incluidos los que escribiste tú. Las partes privadas se quedan en sus secciones `{{#if char == "Name"}}…{{/if}}`, exactamente para los personajes que las conocían. Si un resultado fuera a cambiar quién puede leer una parte, no se guarda y se prueba con grupos más pequeños. Los resúmenes que usan otras macros se quedan como están. Si solo esos llenan la parte de un personaje, acórtalos a mano o sube el presupuesto. Las entradas reemplazadas se desactivan, así que puedes volver a activarlas. **Resume processing** reintenta los resultados fallidos.
- El prompt de un personaje muestra el rango de mensajes y las fechas de un resumen solo a partir de los mensajes que ese personaje puede ver. El Narrator, cuando responde por su cuenta, lee una sola vez cada parte.

### Qué devuelve la recuperación

- Una sola sección **Recalled Scenes** reúne cada resumen seguido de su fragmento, si lo tiene, bajo un único encabezado de rango. El bloque indica el rango actual del historial y el número del último mensaje del usuario, para que los hechos pasados no se confundan con el turno actual.
- Una escena solo se recupera cuando todos sus mensajes de origen quedan fuera del historial actual que se envía. Los **Chat Summaries** por rango se omiten mientras cualquier mensaje cubierto siga en el historial actual. Permanecen guardados y activados. Las constantes aptas tienen prioridad sobre la recuperación opcional. Todos los resúmenes seleccionados reservan espacio antes que cualquier fragmento.
- Se omiten los adjuntos de ilustraciones y los pies de imagen del texto recuperado y de las nuevas entradas para resumir. Se mantienen los adjuntos de texto legibles.
- Con el modo de decisión desactivado, la recuperación lee las memorias preparadas. El embedding de la consulta tiene un plazo breve y recurre a la coincidencia de texto. La coincidencia de texto da más peso a los términos distintivos de tus mensajes desde la última vez que habló el personaje que responde. Un nombre que mencionen es lo que más cuenta. Los nombres de los personajes que responden y el de tu persona no cuentan, ni tampoco un nombre que aparezca en la mayoría de las memorias. No añade ninguna llamada al modelo.
- La recuperación solo se ejecuta en la generación principal de Roleplay. Las llamadas de agentes, las reejecuciones manuales de agentes y las ejecuciones de prueba no la activan ni la reciben.
- Los swipes reutilizan la primera memoria guardada compatible de esa respuesta. Un swipe vuelve a recuperar cuando, desde entonces, se guardó, editó, activó o desactivó una escena anterior que su personaje podía recuperar. Continuar una respuesta conserva la memoria con la que empezó. Los cambios en el historial, los ajustes de acceso, los resúmenes o las memorias invalidan las instantáneas guardadas.
- Editar, hacer swipe, ocultar o borrar mensajes de origen obliga a volver a comprobar la memoria afectada antes de usarla. La regeneración histórica solo usa fuentes anteriores al objetivo.
- El recibo de memoria muestra el tamaño estimado del contexto, el límite elegido y las fuentes recuperadas. Cuando no se recuperó nada, indica si no había escenas anteriores, si no quedaba espacio o si nada era relevante. La vista previa del prompt usa la memoria preparada y no inicia llamadas a modelos. El inspector final del prompt muestra lo que se envió al modelo.
- Cuando una escena recuperada no tiene fragmento, el recibo indica el motivo: no quedaba espacio después de los resúmenes o no se puede citar ninguno de sus mensajes.

### Access memories for this chat

Ábrelo para buscar resúmenes de escenas numerados, ver sus períodos y audiencias, editar **Summary text** (Texto del resumen) o leer los mensajes originales con **Inspect source messages** (Inspeccionar mensajes de origen). Puedes desactivar registros, usar **Reindex**, exportar e importar, o usar **Delete all memories** (Eliminar todas las memorias) para reiniciar la preparación conservando el chat y sus ajustes. Las correcciones de los resúmenes manuales se conservan e invalidan la continuidad dependiente. **Delete summary** (Eliminar resumen), al final de un resumen, lo elimina después de que confirmes el resumen y la audiencia. También sirve para las entradas antiguas **Continuity** (Continuidad) y **Ongoing scene** (Escena en curso). La preparación habitual no regenera las recapitulaciones eliminadas.

Para mantener una escena fuera de la recuperación, desactiva su registro de memoria. La ocultación específica por personaje sigue controlando quién puede acceder a ella. La ocultación global no la quita del archivo.

### Quién puede leer una escena

- Un personaje presente durante parte de una escena comparte su acceso a la memoria, aunque algunos mensajes estén ocultos para él. Una escena sin mensajes de origen accesibles no está disponible. Mencionar a un personaje ausente no lo convierte en participante.
- Las nuevas recapitulaciones indican la visibilidad de los mensajes, describen los hechos compartidos en texto normal y usan `{{#if character == "Name"}}…{{/if}}` para las secciones privadas. Si cambia la visibilidad o el personaje para quien se escribió una recapitulación, la recapitulación anterior se retiene para quienes tienen acceso parcial hasta que prepares de nuevo esa escena (**Fix** lo hace con todas las escenas en esa situación) o revises y guardes sus condiciones privadas. Un personaje que se une más tarde no cuenta, salvo que solo pueda ver parte de la escena. Las recapitulaciones antiguas necesitan un **Fix** después de que se una un personaje. Quienes pueden acceder a todos los mensajes de origen aún pueden recuperarla. El texto corregido manualmente nunca se reescribe sin avisar.
- Las fechas de la escena las comparten todos los participantes asignados. Los fragmentos originales nunca incluyen mensajes ocultos para el personaje ni susurros. Un resumen con partes solo para algunos personajes aun así recibe un fragmento, que solo cita lo que ese personaje vio. Para mantener un mensaje fuera de la memoria de un personaje, ocúltaselo a ese personaje.
- En un chat grupal combinado, la recuperación incluye lo que recuerda al menos un personaje. Una escena o una parte privada que no conocen todos los personajes se marca, por ejemplo con "known only to Kaito". Un fragmento solo cita los mensajes que vieron todos los personajes que recuerdan la escena. Las memorias que no recuerda ningún personaje, como las escenas reservadas al narrador, quedan fuera. En los chats grupales en los que los personajes responden de uno en uno, cada personaje solo recupera las suyas.

<a id="how-decision-recall-works"></a>

### Cómo funciona la recuperación con el modelo de decisión

- La recuperación habitual preselecciona primero hasta 24 recapitulaciones de escena, o hasta **Maximum recalled scenes** si ese valor es mayor. La preselección combina la coincidencia de texto y los embeddings. Los embeddings comparan cada escena con hasta seis de tus mensajes desde la última vez que habló el personaje que responde. La primera respuesta de un personaje usa tu último mensaje. Hasta que casi todas las escenas tengan embeddings, la preselección usa la clasificación de la recuperación habitual. La escena que va justo después de cada una de las tres mejores también obtiene un lugar.
- Cada recapitulación que evalúa el modelo empieza con una línea: rango de mensajes, fecha de la historia y quién habló. El modelo elige las escenas relevantes y luego evalúa hasta 12 de los mensajes originales que mejor coinciden de cada escena elegida para elegir su fragmento. La mejor elección queda en el centro, y las demás lo alargan hasta **Maximum messages per excerpt** (Máximo de mensajes por fragmento).
- Para cada mensaje nuevo, el modelo también comprueba si la historia pasa a otro lugar o a otro momento, cambia a personajes que están en otra parte o sigue a una línea de separación de escena. Ve los tres mensajes anteriores y quién los escribió. Los límites inciertos dejan la escena abierta. Una decisión válida puede no seleccionar nada.
- Límites de tiempo: cada pasada recibe más o menos lo que el modelo necesita por pregunta multiplicado por el número de preguntas, más la mitad; como mínimo 10 y como máximo 25 segundos. Las dos pasadas juntas reciben como máximo 40 segundos por respuesta. Cuando un modelo no puede responder todas las preguntas, evalúa menos, empezando por las mejores coincidencias. Las solicitudes son cortas, así que las respuestas que llegan a tiempo siguen contando. Mientras tanto, la respuesta muestra su marcador de posición habitual **Thinking…**.
- Cuando una solicitud falla, se queda sin tiempo o es demasiado grande, solo esas memorias recurren a la recuperación habitual, después de las escenas que eligió el modelo, y el recibo lo indica. Si falta la conexión o una pasada no recibe ninguna respuesta, se recurre por completo a la clasificación de la preselección y a la coincidencia de texto. Las decisiones de escena no disponibles recurren al detector de escenas estándar.
- En este modo también se crean embeddings. Una escena recién resumida los recibe enseguida. Las escenas más antiguas y las creadas con otro modelo de embeddings los reciben después de las respuestas, unas pocas cada vez. **Reindex** los crea todos de una vez.
- **Peek Prompt → Decision diagnostics → Advanced Memory activity** (Peek Prompt → Diagnóstico de decisiones → Actividad de Advanced Memory) muestra los resultados guardados de la última recuperación y comprobación de escena: modelo, tiempo, puntuaciones, memorias o inicios de escena seleccionados, estado del mecanismo de respaldo y por qué una escena no tiene fragmento. Conserva hasta 128 resultados. Son actividad pasada, no predicciones. Abrirlo no vuelve a ejecutar decisiones. Los swipes compatibles reutilizan las selecciones guardadas. Una continuación vuelve a elegir sus memorias.
- Las cuentas de decisión alojadas reciben lotes limitados dentro de su presupuesto de contexto. Los modelos Open-Jev administrados usan su tiempo medido por pregunta, y una cuenta de decisión responde juntas las preguntas de una solicitud, así que cuenta cada solicitud una sola vez.

### Ubicación en el preset

Quienes crean presets (ajustes guardados) pueden colocar estos marcadores de contenido con los controles habituales de orden, nombre, rol y grupo de las secciones:

| Marcador | Contenido |
| --- | --- |
| `chat_summary` | Entradas constantes aptas de Chat Summaries. |
| `current_scene_summary` | Fragmentos de origen de la parte antigua de una escena en curso. |
| `recalled_scenes` | Todos los resúmenes de escenas seleccionadas, cada uno seguido de su fragmento. |

Cada uno sigue el formato **XML**, **Markdown** o **None** del preset. Los componentes vacíos no añaden nada. El primer marcador activado determina la posición. Los componentes sin un marcador activado aparecen una vez antes del historial, para que los presets antiguos sigan funcionando. El selector del preset ofrece solo **Recalled Scenes**. Un marcador antiguo `recalled_messages` es un alias, y un marcador `recalled_scenes` activado tiene prioridad. Estos marcadores quedan vacíos cuando Advanced Memory está desactivado.

### Límites

La recuperación es selectiva y los resúmenes pueden perder matices. Guarda las correcciones importantes en la transcripción original o en el editor de resúmenes. Si fallan los embeddings, siguen disponibles la recuperación acotada por texto y la continuidad válida. El archivo nunca se inserta completo. Si las instrucciones o un adjunto no caben en el límite, redúcelos o sube el límite. Si la reserva de respuesta no cabe en el contexto total del modelo, reduce el tamaño de salida o elige un modelo con mayor contexto. Advanced Memory se detiene en vez de borrar instrucciones sin avisar.

Mientras está activado, el modo avanzado se encarga de la recuperación, así que Standard Recall no inserta otra copia. También sustituye la programación habitual de resúmenes automáticos de Roleplay de ese chat. Desactivarlo restaura los ajustes normales. Los lorebooks existentes y los agentes descargables mantienen sus propias reglas de alcance.

## Guías relacionadas

- [Configuración del modelo integrado](../connections/local-model.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Conversation Mode: primeros pasos](../conversation/getting-started.md)
- [Roleplay Mode: primeros pasos](../roleplay/getting-started.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
