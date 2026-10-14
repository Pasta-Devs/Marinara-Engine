# Memory Recall y resúmenes del chat

Esta guía explica **Memory Recall** (búsqueda en mensajes anteriores), la opción **Advanced Memory Recall** (recuperación avanzada de memoria) para gestionar automáticamente el contexto de Roleplay, **Chat Summary** y **Automatic Summarization** de Conversation.

## Los dos sistemas de memoria

Cada modelo de IA solo puede leer una cantidad limitada de texto a la vez. Ese límite se llama ventana de contexto. Cuando un chat se hace largo, los mensajes más antiguos salen de esa ventana y la IA los olvida. Marinara Engine (llamado Marinara de aquí en adelante) tiene dos sistemas separados que resuelven esto.

- **Memory Recall** busca en tus mensajes más antiguos las partes más relacionadas con lo que acabas de decir y luego, de forma discreta, vuelve a agregar esas partes al prompt (las instrucciones enviadas a la IA). Funciona en todos los modos de chat.
- Los resúmenes comprimen los mensajes antiguos en recapitulaciones cortas que reemplazan a los mensajes originales en el prompt. Los chats de Roleplay usan **Chat Summary**. Los chats de Conversation usan **Automatic Summarization**.

Los chats de Game Mode (modo de juego) solo tienen **Memory Recall**. No cuentan con ninguna de las dos funciones de resumen.

Puedes usar ambos sistemas al mismo tiempo. Hacen tareas distintas y no entran en conflicto.

## Configuración de Memory Recall

**Memory Recall** encuentra fragmentos relevantes de partes anteriores de un chat y los inyecta en el prompt como memorias. Usa un embedding (una representación numérica del texto): una huella numérica del significado de un mensaje. Marinara compara la huella de tu mensaje nuevo con las huellas guardadas de los mensajes pasados y luego agrega las coincidencias más cercanas.

### Activar Memory Recall

1. Abre un chat y haz clic en el botón **Chat Settings** (Ajustes del chat). Al principio está arriba a la derecha.
2. Busca la sección **Memory Recall** (tiene un icono de cerebro).
3. Activa el interruptor **Enable Memory Recall**.

**Enable Memory Recall** es un ajuste por chat. Su valor predeterminado depende del modo:

- Activado de forma predeterminada en los chats de Conversation.
- Activado de forma predeterminada en los chats de Roleplay o Game que tienen una Scene (escena) activa.
- Desactivado de forma predeterminada en todos los demás chats.

Desactivar el interruptor detiene que las memorias recuperadas se agreguen al prompt. No borra nada de lo que ya hayas guardado.

### La fuente de embeddings

Memory Recall necesita una fuente de embeddings para construir esas huellas de significado. La configuras en una conexión, no en los ajustes del chat. Una conexión es un enlace guardado a un proveedor de IA.

1. Abre el panel **Connections** (Conexiones) y edita una conexión.
2. Busca la sección **Semantic Search (Embeddings)** (búsqueda semántica).
3. Escribe el nombre de un modelo de embeddings en el campo del modelo. Un valor de ejemplo es `text-embedding-3-small`.
4. Opcionalmente, define una **Embedding Endpoint URL** para sobrescribir la dirección.
5. Opcionalmente, usa el menú desplegable **Embedding Connection** para tomar prestada la clave y la dirección de otra conexión. Las opciones incluyen **Same as this connection** y **Local Model (sidecar)**.

Algunos proveedores no ofrecen embeddings. En ese caso, Marinara muestra una nota que te pide elegir una conexión de embeddings dedicada, como una compatible con OpenAI, Google o el Local Model.

Para usar una misma fuente de embeddings en todas partes, elígela en **Embeddings**, dentro de **Connections** > **Connection defaults** (valores predeterminados de conexión). Las conexiones sin un modelo de embeddings ni una **Embedding Connection** propios la usan, y el ajuste propio de una conexión sigue teniendo prioridad.

Si no defines ninguna conexión de embeddings ni un valor predeterminado de **Embeddings**, Marinara recurre a un modelo de embeddings local integrado. Descarga este modelo una sola vez y lo ejecuta en tu propia computadora, sin necesidad de una API key (clave de API). Para saber más sobre el modelo integrado, consulta [Configuración del Local Model](../connections/local-model.md).

Este mismo ajuste de **Semantic Search (Embeddings)** también impulsa la búsqueda semántica del Lorebook, así que configurarlo una vez ayuda a ambas funciones.

### Memories for This Chat

Para ver lo que ha recordado un chat, abre **Chat Settings**, ve a **Memory Recall** y haz clic en **Access memories for this chat**. Con Advanced Memory activado, el visor permanece dentro del panel lateral de Roleplay; de lo contrario, se abre la ventana **Memories for This Chat**.

La ventana muestra un recuento de los fragmentos de memoria guardados y una estimación aproximada de tokens (fragmentos de texto). Cada tarjeta de fragmento muestra el rango de fechas que cubre, el recuento de mensajes, un estado y cuándo se creó. El estado es uno de estos:

- **Vectorized**: la huella está construida y lista para buscar.
- **Waiting for vector**: la huella todavía se está creando.
- **Embedding unavailable**: ninguna fuente de embeddings pudo construirla.

La barra de herramientas tiene iconos para exportar memorias, importar memorias, reconstruir memorias y borrar todas las memorias. Cada fragmento también tiene su propio icono de papelera para olvidar solo ese fragmento.

- Al hacer clic en el icono de papelera de un fragmento se abre una ventana **Forget Memory**. Confirma con **Forget**.
- El icono de papelera de borrar todo abre una ventana **Clear Memories**. Confirma con **Clear**. Esto elimina las memorias de recall, pero no borra los mensajes de tu chat.
- El icono de actualizar reconstruye cada fragmento de memoria a partir de los mensajes actuales del chat. Úsalo después de cambiar el modelo de embeddings.
- Exportar guarda un archivo `.marinara.json`. Importar acepta archivos `.json` o `.marinara` y los fusiona con las memorias existentes.

### Cómo se comporta Memory Recall

Ten en cuenta estos puntos:

- Marinara guarda fragmentos de memoria en segundo plano siempre que hay una fuente de embeddings disponible, incluso si **Enable Memory Recall** está desactivado. El interruptor solo controla si las memorias guardadas se inyectan. Para dejar de guardar memorias, elimina la fuente de embeddings o borra las memorias de vez en cuando.
- Un fragmento necesita al menos 5 mensajes nuevos antes de crearse. Los lotes más pequeños esperan a la siguiente respuesta.
- Los fragmentos recuperados deben estar lo bastante relacionados como para pasar una comprobación de similitud. Las coincidencias débiles se omiten, así que recall puede no devolver nada aunque existan memorias.
- Solo se usa un pequeño presupuesto del prompt para las memorias recuperadas, así que solo se agregan las pocas más relevantes.
- Si cambias el modelo de embeddings cuando ya existen memorias, los fragmentos antiguos dejan de coincidir. Usa el icono de reconstruir para rehacerlos.
- Borrar los mensajes de un chat también borra sus fragmentos de memoria.

Algunas compilaciones en contenedor de Marinara, conocidas como Marinara Lite, desactivan Memory Recall por completo. En esas compilaciones, la sección **Memory Recall** no aparece en absoluto.

## Advanced Memory Recall (Roleplay)

Abre **Chat Settings → Memory Recall** y activa **Advanced Memory Recall**. También puedes activar **Automatic context and memory handling** (gestión automática del contexto y la memoria) debajo de Agents en el asistente de configuración de Roleplay. Este modo opcional gestiona conjuntamente la ventana de historial actual, los resúmenes de continuidad y los fragmentos antiguos relevantes. Los ajustes y el progreso de preparación están disponibles tanto en el asistente como en el panel lateral Chat Settings, en escritorio y en móvil. El visor del archivo permanece en el panel Chat Settings.

### Configuración

- Elige **Maximum allowed context before compression (tokens)** dentro del contexto admitido por el modelo del chat. Cuando el prompt saliente alcanza este tamaño, se recorta el contexto más antiguo y el historial del chat vuelve a crecer a partir de ahí. Lo que se recortó se resume y se añade a las memorias que se pueden recuperar. El límite cubre el prompt saliente estimado, incluidas instrucciones, mensajes, recuerdos, herramientas y adjuntos, tanto para el chat como para procesar memorias. Los tokens de respuesta y el margen de seguridad se calculan aparte. Sigue vigente el contexto total del modelo; no es un límite exacto del tokenizador ni de facturación.
- Elige **Summary and recall budget (tokens)** (presupuesto de resúmenes y recuperación) dentro de ese límite. Establece cuánto del contexto se destina a las memorias; se recomienda al menos el 10% del contexto máximo permitido. Los resúmenes constantes activos tienen como objetivo ocupar como máximo el **70%** de este valor. La prioridad es constantes, resúmenes de escenas seleccionadas, luego [recuerdos personales de los personajes](#character-recollections) cuando están activados y, por último, extractos de mensajes. La memoria conjunta puede usar hasta **2,000 tokens adicionales** si hacen falta y caben en el contexto completo. Con 10k, el objetivo es hasta 7k de constantes y hasta 12k en total; las mismas proporciones se aplican a otros valores. Los mensajes actuales no cuentan en la parte constante ni activan su consolidación.
- Por defecto: **Helper model** (modelo auxiliar) decide escenas, resume escenas y compacta continuidad. Usa por defecto la conexión de agentes y, si falta, la del chat. La detección histórica inicial puede usar el principal o auxiliar; los resúmenes siempre usan el auxiliar. Los modelos resueltos aparecen antes de preparar.
- Todas las llamadas de resumen de memoria usan **Chat Summary → Maximum output size**, con al menos **8,196 tokens de salida** para dejar espacio al razonamiento. Incluye resúmenes de escenas y consolidación de constantes; se conservan los valores superiores. El límite habitual de respuesta de la conexión auxiliar no lo sustituye. La entrada y la reserva de salida deben caber en el contexto total del modelo.
- Cada solicitud de resumen de escena contiene instrucciones, mensajes accesibles de esa escena, correcciones por rango aplicables y el formato de salida JSON. Las escenas demasiado grandes se procesan en lotes guardados y luego se combinan. Se piden **2–3 párrafos** por recapitulación. El prompt predeterminado describe hechos pasados sin secciones de situación actual ni tensiones abiertas; siguen aplicándose los prompts personalizados de **Summaries**. Advanced Memory funciona independientemente del interruptor principal Agents y no necesita un agente descargable.
- **Maximum recalled scenes** (máximo de escenas recuperadas) vale **3** por defecto. Es un máximo que omite coincidencias débiles. **0** desactiva escenas opcionales y conserva la continuidad necesaria. Cada escena aporta su resumen seguido de un fragmento como máximo.
- **Moving context** (contexto móvil) controla mensajes por fragmento, **3–10** por defecto. Un fragmento reúne mensajes de una escena recuperada tal como se escribieron y se añade justo después de su resumen. Ambos límites en **0** dan resúmenes sin fragmentos; solo el mínimo en **0** hace opcionales los fragmentos. Relevancia, acceso del personaje y espacio pueden reducir los mensajes a ninguno. Cada escena recuperada recibe su fragmento mínimo antes de que crezca cualquier fragmento. Si una escena recuperada sigue sin fragmento, el informe de recuperación indica el motivo: no quedaba espacio después de los resúmenes o no se puede citar ninguno de sus mensajes.

En un chat grupal Individual antiguo, confirma una vez los intervalos de conocimiento que falten para cada personaje. La primera intervención de un personaje no demuestra que conociera todo lo anterior. Selecciona un personaje real como **Narrator** (Narrador) solo si debe saltarse los límites de participación. La ocultación específica por personaje y los intervalos de conocimiento confirmados siguen restringiendo la memoria. **Hide from AI** (Ocultar a la IA) global, tanto manual como establecido por resúmenes automáticos, solo quita un turno de la transcripción activa: Advanced Memory sigue analizándolo, identificando a los participantes de la escena, resumiéndolo e indexándolo para la recuperación permitida. Los marcadores de inicio recortan la transcripción activa. Puedes corregir estos intervalos después; los personajes que añadas necesitan su propia confirmación.

En un chat existente, haz clic primero en **Prepare existing history** (Preparar historial existente). Si el historial recuperado cambia los límites de una escena cubierta por una corrección manual, desactiva esa memoria para conservar su texto como referencia, o elimínala, y vuelve a preparar el historial. **Fix** (Reparar) omite esa escena y la incluye en la lista en lugar de detenerse; consulta [Reparar problemas de memoria](#fixing-memory-problems). Guardar la misma corrección no puede asignar su texto de forma segura a otro intervalo de origen. La preparación procesa el historial antiguo por lotes y muestra su fase actual junto a la rueda de hámster de Professor Mari. **Cancel** conserva lo completado; **Resume** continúa después de cerrar el panel, reiniciar el servidor o actualizar la app. Una llamada al modelo fallida conserva la memoria válida anterior y muestra un error para reintentar. No restablezcas la memoria para recuperarte de una llamada fallida: Resume reutiliza los resúmenes completados y la detección de escenas que no haya cambiado. La última escena en curso permanece abierta y se resume al cerrarse; si sus mensajes activos superan el límite de contexto, se usan fragmentos acotados de origen.

Abre un resumen en **Access memories for this chat** y elige **Delete summary** (eliminar resumen) al final. Confirma resumen y audiencia. También sirve para entradas antiguas **Continuity** (continuidad) y **Ongoing scene** (escena en curso). La preparación habitual no regenera resúmenes de escenas eliminados. Los mensajes originales se conservan. Los nuevos resúmenes constantes están en **Chat Summaries**, con los controles existentes para editar, activar, combinar y eliminar; la continuidad antigua de la bóveda no se usa como constante adicional.

<a id="fixing-memory-problems"></a>

### Reparar problemas de memoria

Cuando algo falla en la memoria de un chat, lo ves sin abrir los ajustes de memoria. Aparece un punto fijo con tu color de acento en una esquina del botón **Chat Settings**, y un aviso indica cuántas escenas tienen problemas. Cada conjunto de problemas se anuncia una sola vez; el punto se mantiene hasta que se resuelvan. En **Chat Settings → Memory Recall**, los mismos problemas aparecen en una lista encima de los ajustes, y **Access memories for this chat** muestra el mismo punto.

Pulsa **Fix**, en el aviso o en esa lista, para reparar de una sola vez todas las escenas marcadas. Usa el **Helper model** y la barra de progreso habitual. **Pause processing** (Pausar el procesamiento) lo detiene y **Resume processing** (Reanudar el procesamiento) continúa el Fix; el trabajo ya hecho se conserva. Fix:

- vuelve a preguntar al auxiliar quién estaba en las escenas marcadas con **Check who was there** (Comprueba quién estaba) y guarda una respuesta clara. Si el auxiliar sigue sin saberlo, nadie obtiene acceso nuevo: la escena conserva solo los personajes que ya tenía y que el auxiliar no dejó fuera, y aparece en la lista para que la revises;
- comprueba quién estaba en las escenas antiguas guardadas antes de que existieran las comprobaciones de participantes, incluidas aquellas cuya comprobación automática falló;
- escribe resúmenes nuevos para las escenas cuyos mensajes, mensajes ocultos, nombres de personajes o resúmenes de apoyo cambiaron, y para las escenas terminadas que no tienen resumen. Los resúmenes que eliminaste siguen eliminados;
- reanuda el trabajo de memoria que se detuvo por un error.

Fix nunca reescribe un resumen que editaste a mano. Si uno ya no coincide con sus mensajes, no incluye mensajes que vuelven a mostrarse, o los límites de su escena se movieron, Fix lo deja como está y lo incluye en **need your review** (necesitan tu revisión), y luego sigue con las demás escenas. Los ajustes que no puede cambiar por ti, como confirmar el intervalo de conocimiento de cada personaje o elegir una conexión de decisión que funcione, siguen en la lista hasta que los cambies.

Cuando Fix termina, muestra **Fixed N scenes** (Se repararon N escenas) y, como números de escena, las escenas que **need your review**. Selecciona un número para abrir esa escena en **Access memories for this chat**. Si Chat Settings estaba cerrado, un aviso con **Show** (Mostrar) te lleva allí. En el siguiente Fix no se vuelve a preguntar por una escena que Fix no pudo decidir; guarda tú el acceso de los personajes de esa escena.

### Volver a escanear escenas

Si se pasaron por alto cambios de escena, por ejemplo cuando una escena nunca terminó y no se resumió nada nuevo, usa **Re-scan scenes** (Volver a escanear escenas) en **Chat Settings → Memory Recall**. Introduce el número del primer y del último mensaje que quieres revisar y luego pulsa **Re-scan** (Volver a escanear). De entrada, abarca la escena en curso. Advanced Memory vuelve a buscar los cambios de escena en esos mensajes, con el modelo de decisión cuando **Use Decision model** (Usar modelo de decisión) está activado y, si no, con el Helper model, y resume las escenas que cambiaron. Las escenas fuera de esos mensajes conservan sus límites y resúmenes, y las comprobaciones habituales después de cada respuesta siguen como antes. Si fuera a cambiar un resumen que editaste, el nuevo escaneo se detiene y nombra esa escena, igual que hace la preparación.

<a id="optional-jev-decisions"></a>
<a id="optional-decision-model"></a>

### Modelo de decisión opcional

Activa **Use Decision model** (Usar modelo de decisión) en Advanced Memory y luego elige un modelo en **Memory Decision connection** (Conexión de decisión para la memoria). En **Local models** (modelos locales) aparecen los mismos modelos locales que en el **Decision model** (modelo de decisión) global, como el **Primary local model** (modelo local principal) que ejecutas en **Local Model**. Uno que todavía no puede responder aparece atenuado con el motivo, y uno que está detenido se inicia cuando Advanced Memory le pregunta. En **Connections** aparecen tus conexiones de decisión guardadas. Crea una en **Connections** con TypeSafe, OpenRouter u otra fuente de decisión compatible; consulta [Modelos de decisión](../connections/decision-models.md). La opción está desactivada por defecto y se guarda por cada chat Roleplay. Su elección es independiente del valor predeterminado global de decisión.

El modelo elegido identifica límites de escena al preparar el historial y en las comprobaciones durante el chat. Antes de una respuesta nueva, elige los recuerdos en dos pasadas. Primero, la recuperación habitual preselecciona hasta 24 resúmenes de escena, o hasta **Maximum recalled scenes** si ese valor es mayor, mediante coincidencias de texto y, cuando hay vectores guardados, embeddings. El modelo elige las escenas relevantes de esa preselección y luego evalúa hasta 12 mensajes originales de cada escena elegida, los que mejor coinciden por texto, para elegir el fragmento de esa escena. El mejor mensaje elegido queda en el centro, y los demás mensajes elegidos alargan el fragmento hasta **Maximum messages per excerpt** (Máximo de mensajes por fragmento). Si no acepta ninguno de los mensajes de una escena, la coincidencia de texto centra el fragmento y el informe de recuperación lo indica. Una escena en la que ninguno de esos mensajes cabe por sí solo en el espacio que dejaron los resúmenes no puede recibir un fragmento, así que el modelo no evalúa sus mensajes; cuando eso ocurre con todas las escenas elegidas, no envía una segunda solicitud. Para cada mensaje nuevo, comprueba si la historia pasa a otro lugar o a otro momento, cambia a personajes que están en otra parte, o sigue a una línea de separación de escena como `***` o a una nota de punto de vista fuera de personaje. Ve los tres mensajes anteriores y quién escribió cada uno. Los límites inciertos dejan la escena abierta. El **Helper model** sigue escribiendo todos los resúmenes y las actualizaciones de continuidad. Se mantienen los límites de escenas, longitud de fragmentos, acceso de personajes y tokens. Una decisión válida puede no seleccionar nada.

Los proveedores alojados reciben la conversación reciente y los resúmenes o mensajes preseleccionados que deben evaluar, y pueden cobrar por varias solicitudes en una sola respuesta. Antes de enviar candidatos, se comprueba el acceso de los personajes y se procesan las condiciones de las secciones privadas de los resúmenes. Solo se envían los mensajes originales que vieron en el chat los personajes que recuperan la escena, y cada personaje sigue recibiendo solo las partes de un resumen destinadas a él. Las solicitudes se dividen en lotes limitados por el contexto de la conexión; no se presupone que el contexto anunciado para un enrutador de chat Jev se aplique a las decisiones.

Cada pasada de recuperación tiene su propio límite de decisión de 10 segundos. Si falta la conexión, las respuestas están incompletas, un candidato es demasiado grande, hay errores o se agota el tiempo, se usa la recuperación habitual: la propia clasificación de la preselección elige las escenas y la coincidencia de texto elige los fragmentos. Las decisiones de escena no disponibles recurren al comprobador existente. Mientras la opción está activa, la preparación indexa texto sin crear nuevos embeddings. Los vectores existentes siguen disponibles como alternativa. Tras desactivarla, usa **Reindex** si quieres embeddings para los registros preparados en modo de decisión.

La inspección del prompt sigue siendo de solo lectura y muestra la recuperación habitual sin llamar al proveedor de decisión. En **Peek Prompt → Decision diagnostics** (Peek Prompt → diagnóstico de decisiones), **Advanced Memory activity** (actividad de Advanced Memory) muestra resultados guardados de la última recuperación y comprobación de escena: modelo, tiempo, puntuaciones, recuerdos o inicios de escena seleccionados, estado del mecanismo de respaldo y por qué una escena recuperada no tiene fragmento. Los informes se registran para nuevas llamadas posteriores a esta actualización y conservan hasta 128 resultados, primero los seleccionados. Describen actividad pasada, no predicciones para la vista previa; abrir el panel o probar declaraciones del prompt no vuelve a ejecutar decisiones de memoria. Las comprobaciones de escena del modelo de decisión siempre usan su propia solicitud, separada de los lotes de trackers y agentes. El informe de recuperación identifica decisiones y alternativas usadas. Las variantes de respuesta y continuaciones compatibles reutilizan la selección guardada; cambiar estos ajustes invalida las selecciones guardadas incompatibles.

<a id="deciding-who-sees-new-messages"></a>

### Decidir quién ve los mensajes nuevos

En un chat grupal de Roleplay en el que los personajes responden de uno en uno, Advanced Memory puede decidir qué personajes ven cada mensaje nuevo, para que no tengas que ocultar cada línea a un personaje que ha salido de la escena. Activa **Decide who sees new messages** (Decidir quién ve los mensajes nuevos) en Advanced Memory. Está desactivado de forma predeterminada y solo aparece en los chats grupales en los que los personajes responden de uno en uno; los chats grupales combinados y los chats de un solo personaje no lo ofrecen.

Cuando está activado, cada mensaje nuevo, tuyo o de un personaje, se oculta a los personajes que no están en esa escena. El resultado usa el mismo **Hide from AI** por personaje que el botón del propio mensaje, así que la marca de ojo tachado muestra quién no puede verlo. Tu propio mensaje se decide en cuanto lo envías, aunque ningún personaje responda. Antes de que responda el siguiente personaje, los mensajes anteriores ya están decididos, así que ese personaje nunca lee una línea que no debería.

- El **Narrator** elegido aquí y el **Narrator character** (Personaje narrador) elegido en **Roleplay Commands** siempre ven todos los mensajes. Quien escribe un mensaje siempre ve su propio mensaje. Si el destinatario de un susurro no está en la escena, pierde el resto del mensaje, pero sigue recibiendo el susurro.
- Con **Use Decision model** activado, se pregunta al modelo de decisión, para cada personaje, si está claro que no puede ver ni oír el mensaje, por ejemplo porque está en otro lugar o se ha ido. Un personaje al que la historia nunca sitúa en la escena cuenta como si estuviera en otro lugar. Un personaje que está presente pero queda fuera de un susurro sigue viendo el resto del mensaje. De lo contrario, decide el **Helper model**. En ambos casos, un mensaje solo se oculta cuando el modelo está seguro; si no lo está, el personaje lo sigue viendo. Cuando toca una comprobación de escena después de una respuesta, la misma solicitud también responde quién está presente, así que no se hace ninguna llamada adicional para esos mensajes.
- El modelo lee los mensajes de la escena actual hasta ese momento y siempre, como mínimo, los últimos mensajes anteriores, aunque acabe de empezar una escena nueva. También recibe una lista de los personajes que han hablado desde que empezó la escena actual. Esa lista es solo una indicación: un personaje que escucha en silencio sigue contando como presente, aunque no haya dicho nada.
- Si cambias tú el **Hide from AI** de un mensaje, o usas `/hide` o `/unhide` con él, antes o después de la elección automática, tu elección se mantiene y Advanced Memory nunca vuelve a cambiar ese mensaje. Los mensajes que ya habías ocultado a alguien no se modifican.
- Cada mensaje se decide una sola vez. Si el modelo falla o no responde a tiempo, no se oculta nada en ese mensaje y el error aparece en el registro del servidor.

Con Advanced Memory activado, una respuesta nueva de un personaje puede cambiar de escena o de punto de vista con una línea de separación como `***`, `---` o `* * *`. Entonces se guarda como mensajes separados del mismo personaje, uno por parte.

- Cada parte tiene su propio público. **Decide who sees new messages**, **Hide from AI** y los susurros se aplican a cada parte por separado.
- El personaje que escribió la respuesta sigue viendo todas las partes, como con cualquiera de sus mensajes. Oculta tú una parte a ese personaje si no debería verla.
- La línea de separación queda al principio de la parte que la sigue. Una separación dentro de un bloque de código o de un bloque HTML, como un panel `<details>`, no cuenta.
- El razonamiento de la respuesta se muestra en la primera parte. No se vuelve a enviar al modelo, ni siquiera con **Exclude Past Reasoning** (Excluir el razonamiento anterior) desactivado.
- La información del mensaje, los trackers y los resultados de los agentes van con la última parte.
- Prose Guardian y los demás agentes de reescritura reescriben cada parte por separado, y la línea de separación se queda al principio. Con **Hold Message Until Rewrite** (Retener el mensaje hasta reescribir) activado, cada parte espera su propia reescritura. Si falla la reescritura de una parte, esa parte se queda como se escribió y las demás se siguen reescribiendo.
- La reproducción automática de voz lee todas las partes en orden.
- Un swipe o una regeneración de una parte da una versión nueva solo de ese mensaje. En una parte anterior, la versión nueva conserva solo el texto anterior a la primera separación, porque las escenas posteriores ya tienen sus propios mensajes.
- Continue e Impersonate nunca se dividen.

<a id="character-recollections"></a>

### Recuerdos personales de los personajes

Activa **Character recollections** (Recuerdos personales de los personajes) en Advanced Memory para dar a cada personaje su propio recuerdo de una escena. Está desactivado de forma predeterminada.

- Por cada escena terminada, cada personaje que estuvo en ella recibe un recuerdo personal breve de esa escena, de unas 50–100 palabras, escrito en primera persona y con su propia voz: lo que piensa cuando la recuerda y lo que más se le quedó grabado. Su tarjeta de personaje decide en qué se fija, así que un personaje lógico recuerda cosas distintas de las que recuerda uno al que le importa cómo se sintieron los demás. El **Narrator**, tu persona y los personajes que estaban en otro lugar no reciben ninguno.
- Se le indica al modelo que use solo lo que cada personaje podía saber. La solicitud marca cada mensaje oculto para un personaje, ya sea por la ocultación específica por personaje (incluido **Decide who sees new messages**) o porque es anterior al inicio de su intervalo de conocimiento, y una parte de un resumen escrita solo para algunos personajes (`{{#if char == …}}`) es exclusivamente suya. Los mensajes ocultos para todos con **Hide from AI** global siguen formando parte de la escena, igual que en los resúmenes. Un recuerdo personal que copia cuatro palabras seguidas de algo que su personaje no podía saber se omite, salvo que el personaje haya leído esa frase en otra parte del chat o en su propia tarjeta, o que haya leído cada una de sus palabras en varios mensajes. Un hecho contado con otras palabras no se detecta de esta forma; solo las instrucciones lo evitan.
- Un recuerdo personal solo cuenta mientras su personaje puede leer exactamente lo mismo que cuando se escribió. Si más tarde un mensaje de la escena se le oculta o se le muestra, un recuerdo personal generado se vuelve a escribir, y uno que editaste queda fuera de los prompts hasta que lo revises y lo guardes de nuevo.
- Los recuerdos personales de una escena nueva salen de la misma solicitud que su resumen, que entonces también incluye la tarjeta de personaje completa de cada personaje que podía leer parte de la escena, así que no se hace ninguna solicitud adicional. Si las tarjetas obligaran a dividir la escena en más partes de las que necesita sin ellas, el resumen se escribe sin ellas y los recuerdos personales se piden aparte, en una solicitud propia, o en una por personaje cuando varias tarjetas juntas dividirían la escena. Un personaje cuya tarjeta ocupa más de la mitad del espacio que tiene el auxiliar para la escena no recibe recuerdo personal. Una escena larga resumida por partes termina igualmente con un recuerdo personal por personaje.
- Las solicitudes que solo escriben recuerdos personales también incluyen los **Chat Summaries** que cubren la escena y el resumen de la escena si lo editaste, para que el recuerdo personal siga tus correcciones.
- Al activar el ajuste en un chat cuyas escenas ya están resumidas, se añaden recuerdos personales a esas escenas, con una solicitud por escena, y el proceso aparece como **Writing character recollections** (Escribiendo recuerdos personales de los personajes). Los resúmenes de escena, incluidos los que editaste, nunca cambian. Las escenas que ya tienen recuerdos personales se omiten. Si falla una escena, las demás reciben los suyos igualmente, y **Resume** vuelve a intentar las que fallaron.
- Si el modelo no escribe nada útil para un personaje, la escena guarda un recuerdo personal vacío para él, y no se vuelve a pedir otro para ese personaje hasta que cambien el resumen de la escena o lo que podía leer. Puedes escribir uno tú en **Access memories for this chat**.
- Los recuerdos personales solo aparecen con las escenas recuperadas, justo debajo del resumen de la escena y antes de su fragmento, una línea por personaje, como `Kaito's personal recollections from this scene: *…*`. En un chat grupal en el que los personajes responden de uno en uno, cada personaje solo ve los suyos, y el **Narrator** no ve ninguno cuando responde por su cuenta. En una respuesta combinada se muestran, con su nombre, los de todos los personajes presentes que recuerdan la escena, también cuando el narrador comparte la respuesta.
- Cuentan para **Summary and recall budget**: primero van los resúmenes de escena, luego los recuerdos personales y después los fragmentos. Cuando falta espacio, primero se reducen los fragmentos y luego se omiten recuerdos personales completos. Un recuerdo personal nunca se recorta.
- Los recuerdos personales nunca se copian en **Chat Summaries** ni se usan para elegir qué escenas se recuperan.
- Cuando cambia el resumen de una escena, porque lo editaste o porque se volvió a escribir, sus recuerdos personales generados quedan desactualizados y fuera de los prompts. Después de cada respuesta, una vez que los Chat Summaries están al día, se vuelven a escribir los recuerdos personales de hasta tres escenas, empezando por las más recientes; **Prepare** (Preparar), **Re-scan scenes** y **Resume** los rehacen todos. Una escena cuya solicitud falló después de una respuesta espera a **Prepare** o **Resume**.
- En **Access memories for this chat**, abre una escena para leer y editar el recuerdo personal de cada personaje en **Character recollections**. Un recuerdo personal editado se marca como **Manually edited** (Editado manualmente) y nunca se reemplaza.
- Desactivar el ajuste conserva los recuerdos personales guardados, pero los deja fuera de los prompts. Volver a activarlo en un chat donde se detuvo el proceso de escribir recuerdos personales vuelve a iniciar ese proceso. La exportación, la importación y las ramas los incluyen.

### Durante el chat

La detección de escenas se ejecuta después de guardar la respuesta principal de Roleplay. **Standalone scene check interval (messages)** vale **5** de forma predeterminada. Cuando llegan tantos mensajes nuevos como indica ese intervalo, el detector recibe todos los mensajes desde la última comprobación (hasta el doble del intervalo), el mensaje en el que terminó la última comprobación para comparar, instrucciones y formato de salida. Indica el mensaje exacto que cierra cada escena, que puede ser ese mensaje anterior, o no devuelve finales si continúa. Cuentan tanto los mensajes de personas como los de personajes. La frecuencia es independiente de los horarios de los agentes de seguimiento; con el modo de decisión desactivado, una comprobación programada comparte una llamada de un agente de seguimiento después de la generación si la visibilidad y el presupuesto lo permiten, o usa una llamada auxiliar independiente. Cada rango comienza después del final anterior e incluye el nuevo mensaje final. Solo un final detectado prepara en segundo plano el resumen y el índice de la escena cerrada, aunque termine en la última respuesta. Las transiciones dudosas dejan la escena abierta. **Chat Settings → Agent activity** muestra **Advanced Recall** con progreso, errores y recuperación, incluso con los agentes normales desactivados. Solo se consulta el estado mientras hay trabajo de memoria; los archivos listos no se consultan en reposo. Si activas el modo de decisión, la conexión de decisión elegida realiza esta comprobación.

Con el modo de decisión desactivado: La recuperación lee memoria preparada. El embedding opcional de consulta tiene un plazo breve y recurre a coincidencias de texto si no está disponible. La coincidencia de texto da más peso a los términos distintivos del último mensaje del usuario, de modo que un detalle breve puede encontrar un resumen de escena largo. Un nombre que mencione, como el de una mascota, es lo que más peso tiene. Los nombres de los personajes que responden y el de tu persona no cuentan, ni tampoco un nombre que aparezca en la mayoría de los recuerdos. Los mensajes originales indexados también permiten encontrar escenas aunque la salida de fragmentos esté desactivada. Ninguna de estas funciones añade una llamada al modelo. Solo funciona en la generación principal de Roleplay: agentes, reejecuciones manuales y generaciones auxiliares de prueba no la activan ni reciben sus resúmenes o fragmentos. La inspección principal del prompt es de solo lectura.

Las variantes regeneradas reutilizan la primera memoria compatible de esa respuesta: continuidad, resúmenes de escenas y fragmentos exactos. Las variantes sin cambios no buscan ni llaman al auxiliar otra vez. Continuar conserva la memoria inicial. Las respuestas antiguas sin instantánea guardan una en su próxima generación y la reutilizan después; no hace falta reiniciar. Añadir o combinar constantes en segundo plano conserva instantáneas compatibles. Los cambios del usuario en historial, acceso, resúmenes o memorias invalidan las incompatibles. Siempre se respeta el contexto actual. Un swipe (respuesta alternativa) también repite la recuperación cuando, desde esa respuesta, se guardó, editó, activó o desactivó una escena anterior que su personaje podía recuperar. Una escena que todavía forma parte del historial del chat de esa respuesta aún no se puede recuperar, así que guardarla no provoca otra recuperación.

La generación principal lee la memoria guardada de inmediato. Nunca inicia ni espera la generación de continuidad, aunque haya un auxiliar trabajando. Cuando el prompt saliente alcanza el límite, la ventana actual vuelve al comienzo de la escena más reciente para **todos los personajes** y crece hasta alcanzar de nuevo el límite. Las continuaciones que siguen a llamadas a funciones y a tiradas no cuentan para el límite ni provocan un reinicio. El corte aparece en **Mark as new start** con **All** seleccionado; desmarca All para deshacerlo. Las marcas personales siguen aplicándose. Si una escena abierta o una constante demasiado grande no cabe, se usan extractos identificados como tales y se mantienen los mensajes más recientes. Este ajuste temporal no crea otra marca persistente. No se sobrescriben resúmenes guardados ni mensajes originales.

Tras la respuesta principal, Advanced Memory añade **Chat Summaries** para los mensajes archivados que todavía no cubre ningún resumen y reutiliza las recapitulaciones de escenas terminadas cuando puede. Las entradas inactivas cuentan como cubiertas. En un chat grupal en el que los personajes responden de uno en uno, todos los que leyeron la recapitulación de una escena comparten un único resumen de ella.

Cuando los resúmenes activos que lee un personaje superan el 70% de **Summary and recall budget**, **Updating continuity** los combina y los acorta después de la respuesta, con el auxiliar elegido y **Chat Summary → Maximum output size**. La respuesta en sí nunca espera a que esto termine. La parte de cada personaje se cuenta por separado; en un chat grupal combinado, la parte es lo que lleva el prompt compartido. Un resumen que todavía cubre mensajes del historial actual de alguien espera hasta que esos mensajes salgan de él. Los 2,000 tokens extra corresponden a toda la memoria, no a esta parte.

Los resúmenes que leen distintos personajes se combinan en uno solo, incluidos los que escribiste o editaste tú. Las partes privadas se quedan en sus secciones `{{#if char == "Name"}}…{{/if}}`, exactamente para los personajes que las conocían. Si el resultado del auxiliar cambiara quién puede leer una parte, no se guarda y, en su lugar, se prueba con grupos más pequeños. Una parte para un personaje que salió del chat conserva su condición, así que sigue siendo suya si vuelve. Los resúmenes que usan macros distintas de `{{user}}`, o que solo el narrador sigue leyendo con una parte así, se quedan como están; si por sí solos llenan la parte de un personaje, acórtalos a mano o sube el presupuesto. Las entradas reemplazadas, incluidas las tuyas, se desactivan, así que puedes volver a activarlas. Los resultados fallidos o incompletos no se guardan, y **Resume processing** los reintenta. Los resúmenes de escenas permanecen en el archivo.

El prompt de un personaje muestra el rango de mensajes y las fechas de un resumen solo a partir de los mensajes que ese personaje puede ver. El **Narrator** de Advanced Memory, cuando responde por su cuenta, lee una sola vez cada parte de cada resumen. Una parte que además depende de una variable, o que usa `{{char}}` para más de un personaje, sigue respetando su condición.

El archivo recupera resúmenes relevantes y diálogos exactos con sus números y hablantes originales. Una sección **Recalled Scenes** reúne cada resumen seguido de su extracto disponible, con un único encabezado de rango; las escenas sin extracto permanecen allí. El bloque indica el rango actual y el número del último mensaje del usuario. Solo se recuperan escenas cuando todas sus fuentes quedan fuera del historial actual enviado; los extractos también excluyen mensajes actuales. Los **Chat Summaries** por rango se omiten mientras cualquier mensaje cubierto siga en contexto. Permanecen guardados y activados y vuelven a ser elegibles cuando todo el rango queda fuera. Las constantes elegibles tienen prioridad sobre la recuperación opcional y conservan sus condiciones de personaje. Todos los resúmenes seleccionados reservan espacio antes que cualquier extracto. Siguen aplicándose los límites de acceso y fuentes históricas. Se omiten ilustraciones y pies de imagen en los mensajes recuperados y nuevas entradas para resumir; se mantienen los adjuntos de texto legibles. Cuentan personas y personajes. Una regeneración histórica solo usa fuentes anteriores a la respuesta objetivo, incluso antes de la ventana gestionada. Editar, cambiar de variante, ocultar o borrar fuentes obliga a revisar la memoria derivada antes de usarla.

Abre **Access memories for this chat** (Acceder a las memorias de este chat) en el mismo panel para buscar resúmenes de escenas numerados cronológicamente, inspeccionar sus períodos y audiencias, editar **Summary text** (Texto del resumen) o leer los mensajes originales completos con **Inspect source messages** (Inspeccionar mensajes de origen). Los fragmentos literales internos no son entradas de resumen de escena separadas. Los períodos narrativos basados en las fuentes acompañan al contexto recuperado; las fechas desconocidas siguen siendo desconocidas. Puedes desactivar registros de recuperación, reindexar, exportar/importar o confirmar **Delete all memories** (Eliminar todas las memorias) para reiniciar la preparación conservando el chat original y sus ajustes. Las correcciones de los resúmenes manuales originales se conservan e invalidan la continuidad dependiente. Para excluir una escena de la recuperación, desactiva su registro de memoria. La ocultación de origen específica por personaje sigue controlando quién puede acceder a ella; la ocultación global no la quita del archivo.

Cada resumen de escena también registra quién participó. Un nombre de participante distinto del de la tarjeta de personaje, como "Kaito" para **Kaito Nakamura**, sigue contando cuando corresponde exactamente a un personaje y no puede ser el nombre de tu persona. Los nombres que comparten dos personajes, o un personaje y tu persona, las descripciones como "Kaito's sister" y los nombres con notas como "(mentioned)" nunca dan acceso a un personaje. El nombre de tu propia persona no es un error y no da acceso a ningún personaje. Cuando el auxiliar no dice quién participó, la escena se asigna a todos los personajes: al único personaje en un chat con un solo personaje, o a todos en un chat grupal. En un chat grupal, Advanced Memory lo cuenta entonces como un problema de memoria y marca la escena con **Check who was there** en **Access memories**, para que puedas quitar a quien no estuvo con **Edit character access** (Editar el acceso de los personajes), o dejar que **Fix** vuelva a preguntar al auxiliar. Los nombres que no corresponden a ningún personaje no dan acceso y se marcan de la misma forma, para que puedas definir los participantes de la escena. Una escena en la que el auxiliar indica explícitamente que solo estás tú sigue reservada al narrador. Los resúmenes de escena guardados antes de que existieran las comprobaciones de participantes siguen reservados al narrador hasta que se comprueben: **Fix** y **Prepare existing history** los comprueban todos, y cada respuesta que cierra una escena también comprueba hasta tres. Una escena cuya comprobación automática falla espera a **Fix** o a **Prepare existing history**.

Un personaje presente durante parte de una escena puede compartir el acceso a su recuerdo con otros participantes, aunque algunos mensajes estén ocultos para él. Una escena sin mensajes de origen accesibles sigue sin estar disponible. Las nuevas instrucciones de resumen indican la visibilidad de los mensajes, describen los hechos compartidos en texto normal y reservan `{{#if character == "Name"}}…{{/if}}` para las secciones privadas. Mencionar a un personaje ausente no lo convierte en participante. Si cambia la visibilidad de las fuentes o el nombre de un personaje para quien se escribió el resumen, el resumen anterior se retiene para quienes tienen acceso parcial hasta que prepares de nuevo la escena (**Fix** lo hace con todas las escenas en esa situación) o revises sus condiciones privadas y guardes el texto corregido. Un personaje que se une al chat más tarde no cuenta como un cambio, salvo que solo pueda ver parte de la escena. Los resúmenes guardados por versiones anteriores no registran para qué personajes se escribieron, así que necesitan un **Fix** después de que se una un personaje. Los resúmenes antiguos sin información de visibilidad guardada necesitan la misma revisión antes de permitir acceso parcial; cambiar solo los destinatarios no confirma el texto. Quienes pueden acceder a todos los mensajes de origen aún pueden recuperar el recuerdo, y el texto corregido manualmente nunca se reescribe sin avisar. Estas comprobaciones no llaman a un modelo durante la recuperación. Las fechas y los periodos de la escena son metadatos compartidos por todos los participantes asignados, incluso cuando algunos mensajes están ocultos. Los fragmentos originales nunca incluyen mensajes ocultos para el personaje ni susurros. Un resumen con partes destinadas solo a algunos personajes aun así recibe un fragmento: solo cita los mensajes que ese personaje vio en el chat, así que no revela nada que no haya visto ya. Para mantener un mensaje fuera de la memoria de un personaje, ocúltaselo a ese personaje. Los Chat Summaries constantes siguen incluyendo los mensajes ocultos para la IA; las condiciones por personaje controlan el acceso a los detalles privados sin excluir esos mensajes de la cobertura del resumen.

En un chat grupal combinado, una sola respuesta puede hablar por todos los personajes, así que la recuperación incluye lo que recuerda al menos un personaje del chat. Una escena o una parte privada de un resumen que no conocen todos los personajes del chat se marca con quiénes la conocen, como "known only to Kaito". Añadir un personaje a mitad del chat ya no oculta a los demás los recuerdos anteriores. Un mensaje oculto para un personaje sigue fuera del historial actual compartido, pero los personajes que podían verlo conservan el recuerdo, marcado como suyo. El fragmento de una escena recuperada solo cita los mensajes que vieron todos los personajes que recuerdan esa escena. Lo que no recuerda ningún personaje del chat, como las escenas reservadas al narrador, queda fuera. Cuando el narrador comparte una respuesta combinada con otros personajes, los resúmenes se marcan de la misma forma; el narrador solo lee todas las partes cuando responde por su cuenta. En los chats grupales en los que los personajes responden de uno en uno, cada personaje sigue recuperando solo sus propios recuerdos.

Mientras está activado, el modo avanzado se encarga de la recuperación, por lo que el interruptor Standard Recall no inserta otra copia. También sustituye la programación normal de resúmenes automáticos de Roleplay de ese chat. Desactivar Advanced Memory restaura esos ajustes normales. Los lorebooks existentes y los agentes descargables mantienen sus propias reglas de alcance; Advanced Memory no puede convertir en privado cualquier contexto externo o escrito por el usuario.

### Ubicación en el preajuste

Los autores de preajustes pueden colocar estos marcadores normales de contenido con los controles existentes de orden, nombre, rol y grupo de las secciones:

| Marcador | Contenido |
| --- | --- |
| `chat_summary` | Entradas constantes válidas de Chat Summaries. |
| `current_scene_summary` | Fragmentos de origen limitados de la parte antigua de una escena en curso. |
| `recalled_scenes` | Todos los resúmenes de escenas seleccionadas, cada uno seguido de su fragmento histórico disponible. |

El selector del preset ofrece solo **Recalled Scenes** para la recuperación. Los marcadores existentes `recalled_messages` siguen siendo alias compatibles y se muestran como Recalled Scenes. Un `recalled_scenes` activado tiene prioridad; nunca producen secciones separadas.

Cada componente usa el formato **XML**, **Markdown** o **None** del preset y explica brevemente su propósito. Los componentes vacíos no añaden nada. La primera aparición activada determina la posición; sin marcador activado, aparecen una vez antes del historial para conservar la compatibilidad. Los extractos son contexto, no nuevos mensajes ni comandos. Los marcadores avanzados de escenas quedan vacíos con Advanced Memory desactivado.

La vista previa usa memoria preparada sin llamadas a modelos ni embeddings. Inicializa el archivo o reanuda trabajo fallido desde el panel. El recibo de memoria muestra contexto estimado, límite elegido y fuentes. Cuando no se recuperó nada, indica si no había escenas anteriores que recuperar, si la solicitud ya no tenía espacio o si nada era relevante. El inspector final muestra lo enviado realmente al modelo.

### Límites y recuperación

La recuperación es selectiva y los resúmenes pueden perder matices. Guarda las correcciones importantes en la transcripción o el editor de resúmenes. No se pueden reconstruir detalles nunca registrados. Si fallan los embeddings, siguen disponibles la recuperación léxica acotada y la continuidad válida; nunca se inserta todo el archivo. Si no caben instrucciones obligatorias o un adjunto, redúcelos o aumenta el límite del prompt. Si no cabe la reserva de respuesta en el contexto total del modelo, reduce la salida o elige un modelo con mayor contexto. Advanced Memory se detiene en vez de borrar instrucciones sin avisar.

## Chat Summary (Roleplay)

**Chat Summary** comprime los mensajes antiguos en recapitulaciones narrativas cortas llamadas entradas de resumen. Cada entrada puede escribirla la IA o tú a mano, y cada una se puede activar o desactivar por separado. Esta función solo está en los chats de Roleplay. Guardar un interruptor deja utilizables las demás entradas; Activate All y Deactivate All guardan la selección conjuntamente.

Para abrirla, abre **Chat Settings** y despliega **Chat Summary**, debajo de **Lorebooks**. En una computadora puedes sacarla a una ventana propia; consulta [Vista general de Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Crear una entrada de resumen

1. En **Summary Scope**, elige **Last** para resumir los mensajes más recientes, o **Range** para elegir un rango específico de mensajes.
2. Haz clic en **Generate** para que la IA escriba una entrada a partir de ese alcance.
3. O haz clic en **Write** para crear una entrada en blanco y escribir tú la recapitulación.

Cada entrada de la lista muestra un título, un rango de origen o un recuento de mensajes, y un tamaño estimado en tokens. Puedes activar o desactivar una entrada, expandirla, hacer clic en **Edit** para cambiarla, o en **Delete** para borrarla. Los botones en lote te permiten **Show Inactive** o **Hide Inactive** las entradas y **Activate All** o **Deactivate All** a la vez.

Marca las entradas para seleccionarlas; en una computadora, mantén Shift y haz clic en otra entrada para seleccionar el rango visible entre ambas, y luego usa **Enable selected** (Activar seleccionadas) o **Disable selected** (Desactivar seleccionadas) para cambiar solo las entradas seleccionadas.

En un chat grupal combinado, una sola respuesta puede hablar por todos los personajes. Una parte de una entrada escrita para ciertos personajes, como `{{#if char == "Kaito"}}…{{/if}}`, se conserva para todos los personajes del chat a los que se aplica y se marca con quiénes la conocen, como "known only to Kaito". Las partes que solo recibe el **Narrator** de Advanced Memory quedan fuera. En los chats grupales en los que los personajes responden de uno en uno, y en los chats de un solo personaje, cada personaje lee las entradas como antes, y el **Narrator** de Advanced Memory lee cada parte, sean cuales sean los personajes que nombre.

### Automatic Summaries

El panel **Automatic Summaries** mantiene los resúmenes actualizados a medida que sigues chateando. Aparece solo en los chats de Roleplay.

- Activa el interruptor **Enabled** dentro del panel **Automatic Summaries**.
- Define con qué frecuencia se ejecuta con el campo **Every**, medido en mensajes del usuario. El valor predeterminado es 5, y el rango va de 1 a 200.
- Haz clic en **Backfill Summary** para poner al día un chat antiguo que nunca tuvo resúmenes. Recorre el chat por lotes y aparece una barra de progreso mientras se ejecuta. Haz clic en **Stop** para terminarlo antes.

### Plantillas de Summary Prompt

El panel **Summary Prompt** controla las instrucciones que la IA usa para escribir un resumen. Haz clic en **Edit** para cambiar el prompt activo. Haz clic en **Templates** para abrir el administrador de plantillas. Allí, **New template** te permite guardar un prompt con nombre. Cada plantilla guardada tiene sus propios controles **Duplicate**, **Edit** y **Delete**.

Las plantillas guardadas son un ajuste global, para toda la app. Editar o elegir una plantilla desde un chat de Roleplay cambia el prompt de resumen que se usa en todos los chats de Roleplay.

### Summary Connection y tamaño de salida

El panel **Summary Connection** elige qué conexión escribe tus resúmenes. Su valor predeterminado está etiquetado como **Agent default (falls back to chat connection)**. Esto significa que usa primero tu conexión de agente predeterminada y, en segundo lugar, la propia conexión del chat.

El campo **Maximum output size** define cuánto puede durar un resumen generado. El valor predeterminado es 4096 tokens, y el rango va de 1 a 32768.

### Opciones de visualización

Los controles de **Display** en **Chat Summary** deciden cómo aparecen en pantalla los mensajes resumidos:

- **Hide summarised messages**: oculta los mensajes originales una vez que un resumen los cubre. Desactivado de forma predeterminada.
- **Recent message tail**: mantiene esta cantidad de los mensajes más nuevos totalmente visibles incluso cuando la ocultación está activada. El valor predeterminado es 10, y se acepta cualquier número entero no negativo. Poner 0 oculta todo el lote resumido. Los valores más altos aumentan el tamaño del prompt y el costo del modelo.
- **Collapse hidden messages**: controla cómo se ven los mensajes ocultos en el historial del chat.

Si tu chat requiere aprobación de escritura de agentes (un ajuste aparte de Agents), los resúmenes generados por IA esperan tu revisión antes de surtir efecto.

## Automatic Summarization (Conversation)

Los chats de Conversation usan un sistema distinto llamado **Automatic Summarization**. Cierra cada día del calendario en un resumen de día y luego combina las semanas completas de resúmenes de día en un resumen de semana. El prompt entonces envía solo los resúmenes de semana, los resúmenes de día de la semana actual y los mensajes de hoy. Esto mantiene cada solicitud pequeña.

Esta función se ejecuta por su cuenta y no se puede desactivar en los chats de Conversation.

### Abrir el editor

1. Abre un chat de Conversation y haz clic en **Chat Settings**.
2. Busca la sección **Automatic Summarization** (tiene un icono de calendario).
3. Haz clic en **Edit Summaries** para abrir la ventana **Automatic Summarization**.

La ventana lista primero las entradas de semana y luego los días que aún no se han incluido en una semana. Expande una entrada para editar su texto de **Summary** y su lista de **Key Details**, donde puedes agregar o quitar filas.

### Day Rollover Hour y Recent Message Tail

Dos ajustes en la sección **Automatic Summarization** definen cómo se dividen los días:

- **Day Rollover Hour**: la hora en que empieza un nuevo día para los resúmenes. El valor predeterminado es 4 AM, y puedes elegir cualquier hora desde las 12 AM (medianoche) hasta las 11 AM. Los mensajes enviados antes de esta hora cuentan como parte del día anterior. Elige una hora en la que nunca estés chateando para que una sesión nocturna no quede partida por la mitad.
- **Recent Message Tail**: cuántos de los mensajes más nuevos de hoy se mantienen palabra por palabra incluso después de resumirse. El valor predeterminado es 10, y se acepta cualquier número entero no negativo. Los valores más altos aumentan el tamaño del prompt y el costo del modelo.

Si cambias **Day Rollover Hour** cuando ya existen resúmenes, Marinara te advierte que los resúmenes antiguos usaron el ajuste anterior.

### Rellenar los días que faltan

A veces un día no consigue un resumen, por ejemplo después de importar un chat antiguo. El panel **Missing Summaries** de la ventana tiene un botón **Backfill** que reintenta los días recientes que no tienen resumen. Revisa hasta 14 días atrás a la vez.

Cambiar la conexión o el modelo usado para los resúmenes no reescribe las entradas de día o de semana que ya existen.

## Solución de problemas

### Memory Recall no recupera nada

- Comprueba que haya una fuente de embeddings configurada. Si los fragmentos en **Memories for This Chat** muestran **Embedding unavailable**, configura la sección **Semantic Search (Embeddings)** de una conexión o apóyate en el modelo local integrado. Consulta [Configuración del Local Model](../connections/local-model.md).
- Si los fragmentos muestran **Waiting for vector**, dales tiempo. Las huellas se construyen después de las respuestas.
- Recall solo agrega memorias que están muy relacionadas con tu último mensaje. Si nada parece relacionado, no agrega nada. Esto es normal.
- Si cambiaste el modelo de embeddings hace poco, usa el icono de reconstruir en **Memories for This Chat** para que los fragmentos antiguos coincidan con el nuevo modelo.

### Los resúmenes no se generan

- Asegúrate de que el chat tenga una conexión de texto que funcione. Chat Summary usa la **Summary Connection**, y Automatic Summarization usa la conexión de resumen resuelta. Si ninguna funciona, se omite la generación.
- Si tu chat requiere aprobación de escritura de agentes, los resúmenes de IA esperan a que los apruebes primero.
- Un resumen que falla se reintenta automáticamente tras un retardo. Si sigue atascado, ejecuta **Backfill Summary** (Roleplay) o **Backfill** (Conversation) para intentarlo a mano.

## Guías relacionadas

- [Configuración del Local Model](../connections/local-model.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Conversation Mode: primeros pasos](../conversation/getting-started.md)
- [Roleplay Mode: primeros pasos](../roleplay/getting-started.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
