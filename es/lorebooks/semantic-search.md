# Búsqueda semántica para lorebooks

Esta guía explica la búsqueda semántica para lorebooks (libros de trasfondo) en Marinara Engine. La búsqueda semántica permite que una entrada de un lorebook se active por su significado, no solo por palabras clave exactas. Aprenderás a configurar una fuente de embeddings, a vectorizar tus entradas y a ajustar la coincidencia.

## Qué aporta la búsqueda semántica

Un lorebook es un conjunto de entradas. Cada entrada tiene palabras clave disparadoras y un bloque de texto. Normalmente una entrada solo se activa cuando una de sus palabras clave exactas aparece en el chat reciente. Si el texto usa una palabra diferente, la entrada permanece en silencio.

La búsqueda semántica corrige eso. Compara el significado del chat reciente con el significado de tus entradas. Así una entrada puede activarse aunque no coincida ninguna palabra clave exacta. Por ejemplo, una entrada asociada a "sword" (espada) puede coincidir con un mensaje que solo diga "blade" (hoja).

Esto funciona usando embeddings (representación numérica del texto). Un embedding es una lista de números que captura el significado de un fragmento de texto. Marinara guarda un embedding, también llamado vector, para cada entrada. Este paso se llama vectorización. Al momento del chat, Marinara genera el embedding de tus mensajes recientes y encuentra las entradas cuyo significado es más cercano.

La coincidencia por palabra clave sigue funcionando cuando la búsqueda semántica está activada. La búsqueda semántica añade coincidencias extra. No reemplaza tus palabras clave.

Las coincidencias por palabra clave y las semánticas tienen la misma prioridad cuando Marinara aplica los presupuestos de entradas y de tokens del lorebook. Si no caben todas las entradas coincidentes, el orden de entradas que configuraste decide entre las coincidencias actuales por palabra clave y las semánticas; el método de activación en sí mismo no gana.

## Antes de empezar: elige una fuente de embeddings

La búsqueda semántica necesita un modelo que pueda crear embeddings. Tienes dos opciones.

Elijas la que elijas, puedes convertirla en la predeterminada de toda la aplicación: abre **Connections** (Conexiones), luego **Connection defaults** (valores predeterminados de conexión) y elígela en **Embeddings**. Todas las conexiones que no definan un modelo de embeddings ni una **Embedding Connection** propios la usan entonces. El ajuste propio de una conexión sigue teniendo prioridad, y la fila te indica cuántas conexiones usan sus propios ajustes. **None** mantiene el modelo local integrado como alternativa.

Opción 1: una conexión con un modelo de embeddings.

1. Abre el panel **Connections** (Conexiones).
2. Abre una conexión para editarla.
3. Busca la sección **Semantic Search (Embeddings)** (Búsqueda semántica (Embeddings)).
4. Escribe el nombre de un modelo de embeddings en el campo del modelo. Un valor común es `text-embedding-3-small`.
5. Guarda la conexión.

No todos los proveedores ofrecen embeddings. Si el proveedor no puede hacer embeddings, el editor te indica que elijas en su lugar una conexión dedicada de embeddings.

Opción 2: el modelo local integrado.

Marinara puede ejecutar un pequeño modelo de embeddings en tu propia máquina sin API key (clave de API). En el selector de lorebooks esta opción se llama **Local Model (sidecar)** (Modelo local (sidecar)). Aparece solo después de que descargues el modelo local. Consulta [Configuración del modelo local](../connections/local-model.md) para saber cómo instalarlo.

Si usas una versión Marinara Lite, la opción **Local Model (sidecar)** está oculta. En Lite, la búsqueda semántica necesita una conexión con un modelo de embeddings.

## Activa Vectors para un lorebook

La búsqueda semántica está desactivada de forma predeterminada en los lorebooks nuevos. La activas por cada lorebook.

1. Abre el lorebook que quieres buscar por significado.
2. Quédate en la pestaña **Overview** (Resumen).
3. Busca el interruptor **Vectors** (Vectores) y actívalo.

El texto de ayuda de **Vectors** dice: "When on, entries in this lorebook may use semantic embeddings. When off, keyword matching still works and vectorization skips this lorebook." (Cuando está activado, las entradas de este lorebook pueden usar embeddings semánticos. Cuando está desactivado, la coincidencia por palabra clave sigue funcionando y la vectorización omite este lorebook.)

Mientras **Vectors** está desactivado, el panel semántico muestra esta nota: "Semantic search is disabled by the lorebook-level Vectors toggle." (La búsqueda semántica está desactivada por el interruptor Vectors a nivel del lorebook.)

## El panel Semantic Search (Embeddings)

Con **Vectors** activado, el panel **Semantic Search (Embeddings)** aparece en la pestaña **Overview**. Una etiqueta de estado muestra cuántas entradas están vectorizadas, por ejemplo "8/12 entries vectorized" (8/12 entradas vectorizadas). Se pone verde con una marca de verificación cuando todas las entradas están listas.

El panel tiene tres ajustes numéricos.

| Ajuste | Qué hace | Predeterminado | Rango |
|---|---|---|---|
| **Query Messages** | Cuántos mensajes recientes del chat generar como embedding al buscar en este lorebook. | 10 | 0 a 100 |
| **Score Threshold** | Similitud calibrada mínima que necesita una entrada antes de activarse. Más alto es más estricto. | 0.3 | 0 a 1 |
| **Vector Limit** | Máximo de coincidencias semánticas que este lorebook puede añadir a una generación. | 10 | 1 a 100 |

Pon **Query Messages** en 0 para buscar contra todo el historial del chat en lugar de una ventana reciente.

**Score Threshold** controla cuán cercano debe ser el significado. Un valor bajo como 0.2 deja entrar más entradas pero arriesga coincidencias fuera de tema. Un valor alto como 0.5 es más estricto y solo coincide con significados cercanos. Empieza con el valor predeterminado y ajústalo si obtienes demasiadas o muy pocas coincidencias.

Marinara calibra esta puntuación contra varios pasajes neutros no relacionados del mismo modelo de embeddings. Esto elimina el piso común de coseno inusualmente alto que producen algunos backends de embeddings locales y compatibles con OpenAI, donde de otro modo textos no relacionados pueden puntuar todos alrededor de 0.95 o más. Por eso el ajuste sigue siendo útil en distintos modelos de embeddings en lugar de requerir un corte específico del modelo cercano a 1.0.

**Vector Limit** limita solo las coincidencias semánticas. Tus presupuestos de tokens normales siguen aplicándose además de ese límite.

## Vectoriza tus entradas

Vectorizar significa construir y guardar el embedding de cada entrada. Debes hacer esto antes de que la coincidencia semántica pueda funcionar.

1. Activa **Vectors** para el lorebook.
2. En el panel **Semantic Search (Embeddings)**, elige una fuente de embeddings en el menú desplegable. La primera opción es **No semantic search** (Sin búsqueda semántica). **Local Model (sidecar)** viene después, cuando está disponible. Tus conexiones elegibles vienen a continuación.
3. Haz clic en el botón de vectorizar. Cuando algunas entradas no tienen vector, el botón dice **Vectorize N missing** (Vectorizar N que faltan), por ejemplo "Vectorize 5 missing".
4. Espera a que termine la ejecución. La etiqueta de estado se actualiza para mostrar todas las entradas vectorizadas.

Si ninguna conexión tiene un modelo de embeddings, el panel muestra esta nota en lugar del menú desplegable: "No connections with an embedding model configured. Set an Embedding Model on a connection first." (No hay conexiones con un modelo de embeddings configurado. Configura primero un Embedding Model en una conexión.) Configura primero una fuente de embeddings, siguiendo los pasos de arriba.

Cuando todas las entradas ya tienen un vector, el botón principal cambia a **Re-vectorize N entries** (Revectorizar N entradas). Esto reconstruye todos los vectores guardados. Te pide confirmación antes de sobrescribirlos.

Un botón aparte **Re-vectorize all** (Revectorizar todo) aparece cuando algunas entradas tienen vectores y otras aún faltan. Úsalo para reconstruir todo en una sola pasada.

Para borrar los vectores guardados, haz clic en **Delete vectors** (Borrar vectores). Esto elimina solo los embeddings. No cambia el texto de tus entradas ni tus palabras clave. La coincidencia por palabra clave sigue funcionando después de que borres los vectores.

### Omite una sola entrada

Puedes dejar una entrada fuera de la vectorización manteniendo el resto. Abre la entrada y luego activa su interruptor **No Vector** (Sin vector). Su texto de ayuda dice: "When enabled, bulk vectorization skips this entry and removes any stored embedding." (Cuando está activado, la vectorización masiva omite esta entrada y elimina cualquier embedding guardado.) Esa entrada sigue activándose por palabra clave. Solo que no coincidirá por significado.

## Revectorizar después de cambiar de modelo

Tus vectores guardados están ligados al modelo de embeddings que los creó. Si cambias a un modelo de embeddings diferente, los vectores antiguos pueden dejar de encajar.

Reconstruye todos los vectores después de cambiar el modelo de embeddings. Usa **Re-vectorize N entries** o **Re-vectorize all** para que todas las entradas usen el mismo modelo.

No ejecutes solo una vectorización parcial después de un cambio de modelo. Si una ejecución de "solo los que faltan" devuelve un tamaño de vector diferente al de los vectores guardados, el servidor la rechaza con este mensaje: "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models." (Las dimensiones del embedding cambiaron. Usa Re-vectorize all entries en lugar de solo las entradas que faltan antes de cambiar de modelo de embeddings.)

Hay un modo de fallo silencioso que conviene conocer. Al momento del chat, Marinara genera el embedding de tus mensajes recientes con un modelo de consulta. El modelo de consulta es el propio modelo de embeddings de la conexión activa o, si define una, el de su **Embedding Connection**. Si la conexión no define ninguno de los dos, Marinara usa el valor predeterminado de **Embeddings** en **Connection defaults** o, cuando es **None**, el modelo local integrado. El modelo de consulta puede producir un tamaño de vector diferente al del modelo que vectorizó tus entradas. Entonces Marinara omite esas entradas en la coincidencia semántica. No ves ningún error. Para evitar esto, vectoriza tus entradas con la misma fuente de embeddings que usas durante el chat. Definir un valor predeterminado de **Embeddings** ayuda: el selector de vectorización empieza en él, salvo que hayas elegido otra cosa antes, y las conexiones sin ajustes de embeddings propios consultan con él. Revectoriza después de cualquier cambio de modelo.

## Cómo alimenta al agente Knowledge Router

La búsqueda semántica también ayuda al agente **Knowledge Router** (Enrutador de conocimiento). Ese agente elige entradas relevantes del lorebook y las inyecta en el prompt (instrucciones enviadas a la IA) para lorebooks grandes. Cuando un lorebook está vectorizado, el enrutador usa las coincidencias semánticas para construir su lista corta de entradas candidatas, junto con tus coincidencias por palabra clave.

Este paso es opcional para el enrutador. Si el lorebook no está vectorizado, o no hay ninguna fuente de embeddings disponible, el enrutador recurre solo a las coincidencias por palabra clave. Vectorizar simplemente le da una mejor lista corta. Consulta [Fuentes de conocimiento: agentes de recuperación y enrutamiento](../agents/knowledge-sources.md) para saber cómo funciona ese agente.

## Guías relacionadas

- [Resumen de lorebooks](overview.md)
- [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Configuración del modelo local](../connections/local-model.md)
- [Fuentes de conocimiento: agentes de recuperación y enrutamiento](../agents/knowledge-sources.md)
