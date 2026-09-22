# Memory Recall y resúmenes del chat

Esta guía explica **Memory Recall** (búsqueda en mensajes anteriores), la opción **Advanced Memory Recall (Alpha)** (recuperación avanzada de memoria) para gestionar automáticamente el contexto de Roleplay, **Chat Summary** y **Automatic Summarization** de Conversation.

## Los dos sistemas de memoria

Cada modelo de IA solo puede leer una cantidad limitada de texto a la vez. Ese límite se llama ventana de contexto. Cuando un chat se hace largo, los mensajes más antiguos salen de esa ventana y la IA los olvida. Marinara Engine (llamado Marinara de aquí en adelante) tiene dos sistemas separados que resuelven esto.

- **Memory Recall** busca en tus mensajes más antiguos las partes más relacionadas con lo que acabas de decir y luego, de forma discreta, vuelve a agregar esas partes al prompt (las instrucciones enviadas a la IA). Funciona en todos los modos de chat.
- Los resúmenes comprimen los mensajes antiguos en recapitulaciones cortas que reemplazan a los mensajes originales en el prompt. Los chats de Roleplay usan **Chat Summary**. Los chats de Conversation usan **Automatic Summarization**.

Los chats de Game Mode (modo de juego) solo tienen **Memory Recall**. No cuentan con ninguna de las dos funciones de resumen.

Puedes usar ambos sistemas al mismo tiempo. Hacen tareas distintas y no entran en conflicto.

## Configuración de Memory Recall

**Memory Recall** encuentra fragmentos relevantes de partes anteriores de un chat y los inyecta en el prompt como memorias. Usa un embedding (una representación numérica del texto): una huella numérica del significado de un mensaje. Marinara compara la huella de tu mensaje nuevo con las huellas guardadas de los mensajes pasados y luego agrega las coincidencias más cercanas.

### Activar Memory Recall

1. Abre un chat y haz clic en el botón **Chat Settings** (Ajustes del chat) en el encabezado del chat.
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

Si no defines ninguna conexión de embeddings, Marinara recurre a un modelo de embeddings local integrado. Descarga este modelo una sola vez y lo ejecuta en tu propia computadora, sin necesidad de una API key (clave de API). Para saber más sobre el modelo integrado, consulta [Configuración del Local Model](../connections/local-model.md).

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

## Advanced Memory Recall (Alpha, Roleplay)

Abre **Chat Settings → Memory Recall** y activa **Advanced Memory Recall (Alpha)**. También puedes activar **Automatic context and memory handling (alpha)** (gestión automática del contexto y la memoria) debajo de Agents en el asistente de configuración de Roleplay. Este modo opcional gestiona conjuntamente la ventana de historial actual, los resúmenes de continuidad y los fragmentos antiguos relevantes. Los ajustes y el progreso de preparación están disponibles tanto en el asistente como en el panel lateral Chat Settings, en escritorio y en móvil. El visor del archivo permanece en el panel Chat Settings.

### Configuración

- Elige **Maximum allowed context before compression (tokens)** dentro del contexto admitido por el modelo del chat. El límite cubre el prompt saliente estimado, incluidas instrucciones, mensajes, recuerdos, herramientas y adjuntos, tanto para el chat como para procesar memorias. Los tokens de respuesta y el margen de seguridad se calculan aparte. Sigue vigente el contexto total del modelo; no es un límite exacto del tokenizador ni de facturación.
- Elige **Summary and recall budget (tokens)** (presupuesto de resúmenes y recuperación) dentro de ese límite. Los resúmenes constantes activos tienen como objetivo ocupar como máximo el **70%**. La prioridad es constantes, resúmenes de escenas seleccionadas y, por último, extractos de mensajes. La memoria conjunta puede usar hasta **2,000 tokens adicionales** si hacen falta y caben en el contexto completo. Con 10k, el objetivo es hasta 7k de constantes y hasta 12k en total; las mismas proporciones se aplican a otros valores. Los mensajes actuales no cuentan en la parte constante ni activan su consolidación.
- **Helper model** (modelo auxiliar) decide escenas, resume escenas y compacta continuidad. Usa por defecto la conexión de agentes y, si falta, la del chat. La detección histórica inicial puede usar el principal o auxiliar; los resúmenes siempre usan el auxiliar. Los modelos resueltos aparecen antes de preparar.
- Todas las llamadas de resumen de memoria usan **Chat Summary → Maximum output size**, con al menos **8,196 tokens de salida** para dejar espacio al razonamiento. Incluye resúmenes de escenas y consolidación de constantes; se conservan los valores superiores. El límite habitual de respuesta de la conexión auxiliar no lo sustituye. La entrada y la reserva de salida deben caber en el contexto total del modelo.
- Cada solicitud de resumen de escena contiene instrucciones, mensajes accesibles de esa escena, correcciones por rango aplicables y el formato de salida JSON. Las escenas demasiado grandes se procesan en lotes guardados y luego se combinan. Se piden **2–3 párrafos** por recapitulación. El prompt predeterminado describe hechos pasados sin secciones de situación actual ni tensiones abiertas; siguen aplicándose los prompts personalizados de **Summaries**. Advanced Memory funciona independientemente del interruptor principal Agents y no necesita un agente descargable.
- **Maximum recalled scenes** (máximo de escenas recuperadas) vale **3** por defecto. Es un máximo que omite coincidencias débiles. **0** desactiva escenas opcionales y conserva la continuidad necesaria. Cada escena aporta su resumen seguido de un fragmento como máximo.
- **Moving context** (contexto móvil) controla mensajes por fragmento, **3–10** por defecto. Ambos límites en **0** dan resúmenes sin fragmentos; solo el mínimo en **0** hace opcionales los fragmentos. Relevancia, acceso del personaje y espacio pueden reducir los mensajes a ninguno.

En un chat de grupo Individual antiguo, confirma una vez los rangos de conocimientos que falten. La primera intervención de un personaje no demuestra que conociera todo lo anterior. Selecciona un personaje real como **Narrator** (narrador) solo si debe omitir los límites de participación. Los mensajes ocultos explícitamente y los marcadores de inicio manuales siguen restringiendo la memoria. Puedes corregir estos rangos más tarde; cada personaje nuevo necesita su propia confirmación.

En un chat existente, pulsa **Prepare existing history** (preparar historial existente). Se procesa por lotes y la etapa aparece junto a la rueda de Professor Mari. **Cancel** (cancelar) conserva trabajo terminado; **Resume** (reanudar) continúa tras cerrar el panel, reiniciar o actualizar. Los fallos conservan memoria válida y permiten reintentar. No reinicies la memoria: reanudar reutiliza resúmenes terminados y detección sin cambios. La última escena en curso queda abierta y se resume al cerrarse; si sus mensajes superan el contexto, se usan fragmentos de origen limitados.

Abre un resumen en **Access memories for this chat** y elige **Delete summary** (eliminar resumen) al final. Confirma resumen y audiencia. También sirve para entradas antiguas **Continuity** (continuidad) y **Ongoing scene** (escena en curso). La preparación habitual no regenera resúmenes de escenas eliminados. Los mensajes originales se conservan. Los nuevos resúmenes constantes están en **Chat Summaries**, con los controles existentes para editar, activar, combinar y eliminar; la continuidad antigua de la bóveda no se usa como constante adicional.

### Durante el chat

La detección de escenas se ejecuta después de guardar la respuesta principal de Roleplay. **Standalone scene check interval (messages)** vale **5** de forma predeterminada. El detector recibe los últimos mensajes numerados, un mensaje anterior como contexto, instrucciones y formato de salida. Indica el número exacto que cierra cada escena o no devuelve finales si continúa. Cuentan tanto los mensajes de personas como los de personajes. La frecuencia es independiente de los horarios de los agentes de seguimiento; cuando corresponde, comparte una llamada posterior a la generación si la visibilidad y el presupuesto lo permiten, o usa una llamada auxiliar independiente. Cada rango comienza después del final anterior e incluye el nuevo mensaje final. Solo un final detectado prepara en segundo plano el resumen y el índice de la escena cerrada, aunque termine en la última respuesta. Las transiciones dudosas dejan la escena abierta. **Agents**, arriba a la izquierda, muestra **Advanced Recall** con progreso, errores y recuperación, incluso con los agentes normales desactivados. Solo se consulta el estado mientras hay trabajo de memoria; los archivos listos no se consultan en reposo.

La recuperación lee memoria preparada. El embedding opcional de consulta tiene un plazo breve y recurre a coincidencias de texto si no está disponible. Solo funciona en la generación principal de Roleplay: agentes, reejecuciones manuales y generaciones auxiliares de prueba no la activan ni reciben sus resúmenes o fragmentos. La inspección principal del prompt es de solo lectura.

Las variantes regeneradas reutilizan la primera memoria compatible de esa respuesta: continuidad, resúmenes de escenas y fragmentos exactos. Las variantes sin cambios no buscan ni llaman al auxiliar otra vez. Continuar conserva la memoria inicial. Las respuestas antiguas sin instantánea guardan una en su próxima generación y la reutilizan después; no hace falta reiniciar. Añadir o combinar constantes en segundo plano conserva instantáneas compatibles. Los cambios del usuario en historial, acceso, resúmenes o memorias invalidan las incompatibles. Siempre se respeta el contexto actual.

La generación principal lee la memoria guardada de inmediato. Nunca inicia ni espera la generación de continuidad, aunque haya un auxiliar trabajando. Cuando el prompt saliente alcanza el límite, la ventana actual vuelve al comienzo de la escena más reciente para **todos los personajes** y crece hasta alcanzar de nuevo el límite. El corte aparece en **Mark as new start** con **All** seleccionado; desmarca All para deshacerlo. Las marcas personales siguen aplicándose. Si una escena abierta o una constante demasiado grande no cabe, se usan extractos identificados como tales y se mantienen los mensajes más recientes. Este ajuste temporal no crea otra marca persistente. No se sobrescriben resúmenes guardados ni mensajes originales.

Tras la respuesta principal, Advanced Memory amplía los **Chat Summaries** por rango solo para mensajes archivados aún sin cubrir y reutiliza recapitulaciones de escenas cuando puede. Los rangos de entradas existentes, incluso inactivas, ya cuentan como tratados. Si las constantes activas elegibles superan el 70% de **Summary and recall budget**, **Updating continuity** combina únicamente sus textos después de la respuesta, con el auxiliar elegido y **Chat Summary → Maximum output size**. Las constantes que solapan mensajes actuales quedan fuera del presupuesto y la compactación; las antiguas sin rango siguen siendo elegibles. La respuesta que cruza el umbral se genera normalmente con las constantes guardadas, sin esperar. Los 2,000 tokens extra corresponden a toda la memoria, no a la parte constante. Las plantillas compartidas cuyas macros cambian por personaje se conservan; si por sí solas superan el objetivo, requieren edición manual. Los demás grupos reciben una orientación proporcional de longitud, no un límite rígido de rechazo. Un reemplazo más corto y completo se guarda con un título de rango de mensajes a la vez que se desactivan las entradas reemplazadas. Los resultados fallidos o incompletos no se guardan; las entradas anteriores siguen utilizables y **Resume processing** reintenta lo pendiente. Los resúmenes de escenas permanecen en el archivo.

El archivo recupera resúmenes relevantes y diálogos exactos con sus números y hablantes originales. Una sección **Recalled Scenes** reúne cada resumen seguido de su extracto disponible, con un único encabezado de rango; las escenas sin extracto permanecen allí. El bloque indica el rango actual y el número del último mensaje del usuario. Solo se recuperan escenas cuando todas sus fuentes quedan fuera del historial actual enviado; los extractos también excluyen mensajes actuales. Los **Chat Summaries** por rango se omiten mientras cualquier mensaje cubierto siga en contexto. Permanecen guardados y activados y vuelven a ser elegibles cuando todo el rango queda fuera. Las constantes elegibles tienen prioridad sobre la recuperación opcional y conservan sus condiciones de personaje. Todos los resúmenes seleccionados reservan espacio antes que cualquier extracto. Siguen aplicándose los límites de acceso y fuentes históricas. Se omiten ilustraciones y pies de imagen en los mensajes recuperados y nuevas entradas para resumir; se mantienen los adjuntos de texto legibles. Cuentan personas y personajes. Una regeneración histórica solo usa fuentes anteriores a la respuesta objetivo, incluso antes de la ventana gestionada. Editar, cambiar de variante, ocultar o borrar fuentes obliga a revisar la memoria derivada antes de usarla.

Abre **Access memories for this chat** en el mismo panel para buscar resúmenes de escenas numerados cronológicamente, inspeccionar sus periodos y destinatarios, editar **Summary text** (texto del resumen) o leer los mensajes originales completos con **Inspect source messages** (inspeccionar los mensajes de origen). Los fragmentos internos literales no son entradas separadas de resumen de escena. Los periodos de la historia basados en las fuentes acompañan al contexto recuperado; las fechas desconocidas siguen siendo desconocidas. Puedes desactivar registros de recuperación, reindexar, exportar/importar o confirmar **Delete all memories** (eliminar todos los recuerdos) para reiniciar la preparación de la memoria conservando el chat original y sus ajustes. Las correcciones de los resúmenes manuales originales se conservan e invalidan la continuidad dependiente. Desactivar un registro no equivale a ocultar sus mensajes de origen: las fuentes ocultas son la autoridad para el conocimiento de los personajes.

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

La vista previa usa memoria preparada sin llamadas a modelos ni embeddings. Inicializa el archivo o reanuda trabajo fallido desde el panel. El recibo de memoria muestra contexto estimado, límite elegido y fuentes; el inspector final muestra lo enviado realmente al modelo.

### Límites y recuperación

La recuperación es selectiva y los resúmenes pueden perder matices. Guarda las correcciones importantes en la transcripción o el editor de resúmenes. No se pueden reconstruir detalles nunca registrados. Si fallan los embeddings, siguen disponibles la recuperación léxica acotada y la continuidad válida; nunca se inserta todo el archivo. Si no caben instrucciones obligatorias o un adjunto, redúcelos o aumenta el límite del prompt. Si no cabe la reserva de respuesta en el contexto total del modelo, reduce la salida o elige un modelo con mayor contexto. Advanced Memory se detiene en vez de borrar instrucciones sin avisar.

## Chat Summary (Roleplay)

**Chat Summary** comprime los mensajes antiguos en recapitulaciones narrativas cortas llamadas entradas de resumen. Cada entrada puede escribirla la IA o tú a mano, y cada una se puede activar o desactivar por separado. Esta función solo está en los chats de Roleplay. Guardar un interruptor deja utilizables las demás entradas; Activate All y Deactivate All guardan la selección conjuntamente.

Para abrirla, haz clic en el botón **Chat Summary** (un icono de pergamino) en el encabezado del chat de Roleplay. Esto abre el panel emergente **Chat Summary**.

### Crear una entrada de resumen

1. En **Summary Scope**, elige **Last** para resumir los mensajes más recientes, o **Range** para elegir un rango específico de mensajes.
2. Haz clic en **Generate** para que la IA escriba una entrada a partir de ese alcance.
3. O haz clic en **Write** para crear una entrada en blanco y escribir tú la recapitulación.

Cada entrada de la lista muestra un título, un rango de origen o un recuento de mensajes, y un tamaño estimado en tokens. Puedes activar o desactivar una entrada, expandirla, hacer clic en **Edit** para cambiarla, o en **Delete** para borrarla. Los botones en lote te permiten **Show Inactive** o **Hide Inactive** las entradas y **Activate All** o **Deactivate All** a la vez.

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

Los controles de **Display** en el panel emergente deciden cómo aparecen en pantalla los mensajes resumidos:

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
