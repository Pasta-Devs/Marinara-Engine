# Fuentes de conocimiento: agentes de recuperación y de enrutamiento

**Knowledge Retrieval** (Recuperación de conocimiento) y **Knowledge Router** (Enrutador de conocimiento) toman datos de tus lorebooks (libros de trasfondo) y los llevan a un chat solo cuando una escena los necesita. No tienes que poner cada detalle en cada prompt (las instrucciones enviadas a la IA). Ambos agentes funcionan solo en chats de Roleplay, y ninguno está activado de forma predeterminada.

## Por qué usarlos

Un lorebook es un conjunto de notas de mundo o de personaje. Cada nota es una entrada. Enviar cada entrada en cada turno desperdicia tokens (los fragmentos pequeños de texto que lee un modelo y por los que pagas) y puede confundir a la IA.

Estos agentes usan generación aumentada por recuperación (RAG): Marinara encuentra las entradas que encajan con la escena actual y añade solo esas al prompt de ese turno.

## Elegir Retrieval o Router

| Pregunta | Knowledge Retrieval | Knowledge Router |
| --- | --- | --- |
| Cómo añade el contenido | Resume las fuentes primero | Añade las entradas elegidas palabra por palabra |
| Costo por turno | Más alto | Más bajo |
| Puede leer archivos subidos | Sí | No |
| Mejor para | Fuentes más pequeñas, o un resumen ordenado | Lorebooks grandes con buenas descripciones de entrada |

- **Knowledge Retrieval** lee cada entrada activada de los lorebooks que elegiste, además de los archivos subidos, y pide a la IA que resuma los datos que encajan con los mensajes recientes. Esto cuesta más porque la IA lee todo el texto de origen.
- **Knowledge Router** construye un catálogo pequeño de tus entradas. Cada línea contiene un ID, un nombre, unas pocas palabras clave y un resumen corto. La IA elige entradas del catálogo, y Marinara las añade completas. La IA nunca lee todas las entradas, así que el enrutador se mantiene barato con un lorebook grande.

Puedes añadir ambos a un mismo chat, pero se superponen y suben el costo. El editor de agentes te avisa cuando ambos están configurados. Elige uno.

## Añadir un agente de conocimiento a un chat

Antes de empezar: instala el agente desde **Agent Organizer** (Organizador de agentes). Consulta [Descripción general de los agentes](agents-overview.md).

1. En un chat de Roleplay, abre **Chat Settings** (Ajustes del chat).
2. Busca la sección **Agents** y activa **Enable Agents**.
3. Haz clic en **Add Agent**.
4. Abre el grupo **Writer Agents** y elige **Knowledge Retrieval** o **Knowledge Router**.
5. En la ventana de configuración, elige tus fuentes (consulta más abajo).

Luego la tarjeta de ajustes del agente aparece en **Agents**, y el agente se ejecuta en cada nuevo turno. Mientras Knowledge Retrieval trabaja, el indicador de progreso puede mostrar **Retrieving knowledge...**.

> **Nota:** Estos agentes se ejecutan solo en turnos nuevos. No se ejecutan de nuevo cuando regeneras una respuesta.

## Elegir las fuentes

Ambos agentes comparten los mismos controles de fuente.

- **Use chat-active lorebooks** está activado de forma predeterminada. El editor de agentes llama a ese mismo interruptor **Use this chat's active lorebooks**. Mientras está activado y no eliges ningún lorebook fijo, el agente lee los lorebooks activos en el chat actual.
- **Fixed source override** (**Fixed Source Lorebooks** en la ventana de configuración) fija el agente a los lorebooks que elijas. Una selección fija siempre gana sobre los lorebooks activos del chat, en todos los chats que usan este agente.

Usa fuentes fijas cuando un agente deba leer siempre el mismo lorebook de referencia. Deja el interruptor activado, sin elecciones fijas, para seguir lo que use el chat.

## Subir archivos (solo Knowledge Retrieval)

En los ajustes de **Knowledge Retrieval**, haz clic en **Upload file** (Subir archivo). Los archivos subidos quedan disponibles para todos los chats que usan Knowledge Retrieval.

Los tipos admitidos son `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`, `.htm`, `.log`, `.yaml`, `.yml`, `.tsv` y `.pdf`. El selector de archivos bloquea otros tipos. Cada archivo muestra su nombre y su tamaño, con un botón de eliminar.

- Todos los archivos excepto los PDF se leen como texto plano. Un archivo que no es texto, como una imagen renombrada a `.txt`, se sube pero añade contenido ilegible.
- Un PDF escaneado o solo de imagen no tiene capa de texto. El agente inserta un marcador de posición en lugar de contenido. Usa un PDF con texto seleccionable.

## Escribir buenas descripciones de entrada

Esto importa sobre todo para Knowledge Router, que elige las entradas por su **Description** (Descripción).

1. Abre la entrada en el editor del lorebook.
2. Completa **Description** con un resumen corto y específico de lo que cubre la entrada.

El enrutador usa la descripción solo para elegir entradas. No se envía a la IA principal como contenido de la historia. Sin descripción, el enrutador recurre al comienzo del contenido de la entrada, que es menos preciso.

Cuando eliges lorebooks de origen para el enrutador, aparece una insignia de cobertura junto a **Fixed source override**, por ejemplo **75% described (9/12)**. El punto es verde a partir del 75%, ámbar del 25% al 74% y rojo por debajo del 25%. Dice **No entries yet** en los lorebooks vacíos. Apunta al verde.

## Opcional: preselección por significado

Knowledge Router también puede encontrar entradas candidatas por significado, no solo por palabra clave. Para esto usa un embedder, un modelo pequeño que convierte texto en números para que Marinara pueda comparar el significado. El enrutador funciona sin él.

1. Abre el editor del lorebook y busca **Semantic search (embeddings)** (Búsqueda semántica: embeddings).
2. Elige una cuenta que tenga un modelo de embeddings. Si estableciste un valor predeterminado de **Embeddings** en **Connections → Defaults** (Conexiones → Valores predeterminados), se elige por ti, salvo que antes hayas elegido otra fuente.
3. Usa la misma fuente de embeddings que la cuenta de tu chat. Los vectores de un tamaño diferente se omiten.
4. Haz clic en el botón de vectorizar. Muestra cuántas entradas aún necesitan vectores. **Re-vectorize all** (Revectorizar todo) rehace todas las entradas.

Si un lorebook no tiene vectores, o no hay ningún embedder disponible, el enrutador construye su lista de candidatos solo con las palabras clave. Nada se rompe. Consulta [Búsqueda semántica para lorebooks](../lorebooks/semantic-search.md).

## Guías relacionadas

- [Búsqueda semántica para lorebooks](../lorebooks/semantic-search.md)
- [Descripción general de lorebooks](../lorebooks/overview.md)
- [Agentes: ayudantes de IA para tus chats](agents-overview.md)
