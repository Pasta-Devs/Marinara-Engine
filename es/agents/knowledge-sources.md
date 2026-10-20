# Fuentes de conocimiento: agentes de recuperación y de enrutamiento

Esta guía explica los dos agentes de conocimiento de Marinara Engine: **Knowledge Retrieval** (Recuperación de conocimiento) y **Knowledge Router** (Enrutador de conocimiento). Ambos toman datos de tus lorebooks (libros de trasfondo) y los llevan a un chat solo cuando una escena los necesita. Así no tienes que poner cada detalle en cada prompt (las instrucciones enviadas a la IA).

## Qué hacen estos agentes

Un lorebook es un conjunto de notas de mundo o de personaje que escribes con antelación. Cada nota se llama entrada. A medida que un chat crece, enviar cada entrada en cada turno desperdicia tokens. Un token es un fragmento pequeño de texto que la IA lee, y más tokens significan un costo más alto. Enviarlo todo también puede confundir a la IA.

Los agentes de conocimiento resuelven esto con RAG. RAG significa generación aumentada por recuperación. Quiere decir que la app encuentra las entradas que encajan con la escena actual, y luego añade solo esas al prompt para ese único turno.

Marinara hace esto con dos agentes opcionales:

- **Knowledge Retrieval** lee tus fuentes elegidas, resume los datos que importan, y añade el resumen al prompt.
- **Knowledge Router** lee una lista corta de tus entradas, elige las que encajan con la escena, y añade esas entradas palabra por palabra.

Ambos agentes funcionan solo en chats de **Roleplay**. No puedes añadirlos en Conversation Mode ni en Game Mode. Ninguno de los dos agentes está activado de forma predeterminada. Tú mismo añades a un chat el que quieras.

## Knowledge Retrieval frente a Knowledge Router

Usa esta tabla para elegir. Lee las notas que están debajo antes de decidir.

| Pregunta | Knowledge Retrieval | Knowledge Router |
|---|---|---|
| Cómo añade el contenido | Resume las fuentes primero | Añade las entradas elegidas palabra por palabra |
| Costo por turno | Más alto | Más bajo |
| Puede leer archivos subidos | Sí | No |
| Mejor para | Fuentes más pequeñas, o cuando quieres un resumen ordenado | Lorebooks grandes con buenas descripciones de entrada |

**Knowledge Retrieval** lee cada entrada activada en tus lorebooks elegidos, además del texto de cualquier archivo que subas. Luego pide a la IA que escriba un resumen corto de los datos que encajan con los mensajes recientes. Esto cuesta más por turno porque la IA lee todo el material de origen.

**Knowledge Router** es la opción más barata. Construye un catálogo pequeño de tus entradas. Cada línea del catálogo contiene un ID, un nombre, unas pocas palabras clave y un resumen corto. La IA lee ese catálogo, elige las entradas que encajan con la escena, y Marinara añade esas entradas completas. La IA nunca lee cada entrada completa, así que el enrutador se mantiene barato incluso con un lorebook grande.

Puedes añadir ambos agentes a un mismo chat, pero pueden añadir contenido que se superpone y subir tu costo de tokens. El editor de agentes te avisa cuando ambos están configurados. Para prompts más limpios, elige uno.

## Añadir un agente de conocimiento a un chat

Haz esto dentro de un chat de **Roleplay**.

1. Abre **Chat Settings** (Ajustes del chat).
2. Busca la sección **Agents**.
3. Activa **Enable Agents**. La lista de agentes se desbloquea.
4. Haz clic en **Add Agent**.
5. Abre el grupo **Writer Agents**.
6. Elige **Knowledge Retrieval** o **Knowledge Router**.

Se abre una ventana de configuración para que elijas las fuentes de inmediato. Después de añadir el agente, su tarjeta de ajustes aparece en la sección **Agents**. El agente luego se ejecuta por su cuenta en cada nuevo turno.

Cuando **Knowledge Retrieval** se ejecuta, el indicador de progreso puede mostrar la fase **Retrieving knowledge...** mientras trabaja.

Nota: estos agentes no se ejecutan de nuevo cuando regeneras una respuesta existente. Se ejecutan solo en turnos nuevos.

## Subir archivos para Knowledge Retrieval

Solo **Knowledge Retrieval** puede leer archivos subidos. **Knowledge Router** usa únicamente lorebooks.

En los ajustes de **Knowledge Retrieval**, verás una lista de archivos y un botón **Upload file**. Los archivos subidos quedan disponibles para todos los chats que usan **Knowledge Retrieval**, no solo el actual.

Los tipos de archivo admitidos son .txt, .md, .csv, .json, .xml, .html, .htm, .log, .yaml, .yml, .tsv y .pdf. El selector de archivos bloquea otros tipos. Cada archivo de la lista muestra su nombre y su tamaño, con un botón de eliminar al lado.

Ten en cuenta estos límites:

- Cada archivo excepto un PDF se lee como texto plano. Un archivo que en realidad no es texto, como una imagen renombrada a .txt, se subirá pero añadirá contenido ilegible y confuso.
- Un PDF escaneado o solo de imagen no tiene capa de texto, así que el agente no puede leerlo. Cuando la extracción falla, el agente inserta un marcador de posición en lugar de contenido real. Usa un PDF que contenga texto seleccionable.

## Elegir tus fuentes: anulación fija frente a lorebooks del chat

Ambos agentes comparten los mismos controles de fuente en su tarjeta de ajustes.

El interruptor **Use chat-active lorebooks** está activado de forma predeterminada. El editor de agentes etiqueta ese mismo interruptor como **Use this chat's active lorebooks**. Mientras está activado y no eliges ningún lorebook fijo, el agente usa cualquier lorebook que esté activo para el chat actual.

Debajo del interruptor está **Fixed source override**, que se muestra como **Fixed Source Lorebooks** en la ventana de configuración. Elige aquí uno o más lorebooks para fijar el agente a ese conjunto exacto. Una selección fija siempre gana sobre los lorebooks activos del chat, para todos los chats que usan este agente.

Usa fuentes fijas cuando quieras que un agente siempre lea el mismo lorebook de referencia. Deja el interruptor activado sin elecciones fijas cuando quieras que el agente siga lo que el chat esté usando.

## Escribir buenas descripciones de entrada

Esta sección importa más para **Knowledge Router**. El enrutador decide qué añadir leyendo la **Description** (Descripción) de cada entrada. Una buena descripción es lo que le ayuda a elegir la entrada correcta.

Escribes la descripción en el editor de entradas del lorebook, en el campo **Description**. Manténla como un resumen corto y específico de lo que cubre la entrada. El enrutador usa este texto solo para elegir entradas. No se envía a la IA principal como contenido de la historia.

Si una entrada no tiene descripción, el enrutador recurre a la primera parte del contenido de la entrada. Ese recurso es menos preciso. Así que completa una descripción para cada entrada que quieras que el enrutador encuentre.

Cuando seleccionas lorebooks de origen para el enrutador, aparece una pequeña insignia de cobertura junto a **Fixed source override**. Muestra cuántas entradas tienen descripción, como porcentaje y como cuenta, por ejemplo **75% described (9/12)**. El punto es verde a partir del 75 por ciento, ámbar del 25 al 74 por ciento, y rojo por debajo del 25 por ciento. Dice **No entries yet** cuando los lorebooks elegidos están vacíos. Apunta al verde.

## Preselección semántica opcional

**Knowledge Router** también puede encontrar entradas candidatas por significado, no solo por palabra clave. Esto se llama coincidencia semántica. Usa un embedder. Un embedder es un modelo pequeño que convierte texto en números para que la app pueda comparar el significado. Este paso es opcional. El enrutador sigue funcionando sin él.

Para activarlo, vectoriza tu lorebook. Vectorizar significa que la app ejecuta el embedder en cada entrada una vez y guarda los resultados. Abre el editor del lorebook y busca la sección **Semantic Search (Embeddings)**. Elige una conexión que tenga un modelo de embedding (una representación numérica del texto) o una **Embedding Connection** (Conexión de embeddings). Si elegiste un valor predeterminado de **Embeddings** en **Defaults** (Valores predeterminados) dentro de **Connections** (Conexiones), se selecciona por ti, salvo que antes hayas elegido otra fuente. Revisa la fuente seleccionada antes de vectorizar y usa la misma fuente de embeddings que tu conexión del chat; los vectores de un tamaño diferente se omiten durante la coincidencia semántica. Luego haz clic en **Vectorize N missing**, donde N es la cuenta de entradas que aún necesitan vectores. También puedes hacer clic en **Re-vectorize** para rehacer todas las entradas. Para más detalles, consulta la guía de búsqueda semántica enlazada abajo.

Si un lorebook no tiene vectores, o no hay ningún embedder disponible, el enrutador recurre a la coincidencia por palabra clave para construir su lista de candidatos. Nada se rompe. Simplemente se apoya solo en las palabras clave.

## Guías relacionadas

- [Búsqueda semántica para lorebooks](../lorebooks/semantic-search.md)
- [Descripción general de lorebooks](../lorebooks/overview.md)
- [Agentes: ayudantes de IA para tus chats](agents-overview.md)
