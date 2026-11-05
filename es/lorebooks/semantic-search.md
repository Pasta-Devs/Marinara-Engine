# Búsqueda semántica para lorebooks

La búsqueda semántica permite que una entrada de un lorebook (libro de trasfondo) se active por su significado, no solo por palabras clave exactas. Así, una entrada asociada a "sword" (espada) puede coincidir con un mensaje que diga "blade" (hoja). Úsala cuando tu escritura use muchas palabras distintas para la misma idea.

Funciona con embeddings, listas de números que capturan el significado de un texto. Marinara guarda un embedding, también llamado vector, para cada entrada. Construirlos se llama vectorizar. Al momento del chat, Marinara genera el embedding de tus mensajes recientes y encuentra las entradas más cercanas.

La búsqueda semántica añade coincidencias. Tus palabras clave siguen funcionando. Las coincidencias por palabra clave y las semánticas tienen la misma prioridad dentro de los presupuestos, así que, cuando no cabe todo, decide el **Order** (Orden) de las entradas.

## Configurar la búsqueda semántica

Primero necesitas una fuente de embeddings, luego el interruptor **Vectors** (Vectores) y luego una ejecución de vectorización.

### Paso 1: elige una fuente de embeddings

Antes de empezar: necesitas una cuenta cuyo servicio ofrezca embeddings, o el modelo integrado. No todos los servicios ofrecen embeddings. Si el tuyo no los ofrece, el editor te indica que elijas una cuenta dedicada de embeddings.

Opción 1: una cuenta con un modelo de embeddings.

1. Abre el panel **Connections** (Conexiones) y abre una cuenta para editarla.
2. Abre **Advanced** (Avanzado), luego **More** (Más), y busca **Semantic search (embeddings)** (Búsqueda semántica: embeddings).
3. Escribe el nombre de un modelo de embeddings, como `text-embedding-3-small`. Si no sabes bien el nombre, búscalo en la documentación de tu servicio, o usa en su lugar el modelo integrado.
4. Guarda la cuenta.
5. Haz clic en **Test embedding** (Probar embedding) para comprobarlo. Marinara guarda primero, genera el embedding de una breve muestra y muestra el tamaño del vector, como "1536 dimensions" (1536 dimensiones), o el error que devolvió el servicio.

Para enviar las solicitudes de embeddings mediante la clave y la dirección de otra cuenta, elige esa cuenta en **Embedding provider** (Proveedor de embeddings). El valor predeterminado es **Same as this provider** (Igual que este proveedor). Si la cuenta elegida tiene su propio modelo de embeddings, Marinara lo usa. Si no, usa el nombre de modelo que escribiste aquí.

Opción 2: el modelo integrado. Se ejecuta en tu computadora sin API key (clave de API) y en el selector se llama **Built-in model** (Modelo integrado). Aparece después de que lo descargues, y está oculto en las versiones Lite. Consulta [Configuración del modelo integrado](../connections/local-model.md).

Para que una fuente sea la predeterminada de todas las cuentas que no definen ninguna, abre **Connections** y elígela en la tarea **Embeddings**. El ajuste propio de una cuenta sigue teniendo prioridad. La opción predeterminada, **Marinara's own search** (La búsqueda propia de Marinara), conserva el modelo integrado como respaldo.

### Paso 2: activa Vectors

La búsqueda semántica está desactivada en los lorebooks nuevos.

1. Abre el lorebook y quédate en la pestaña **Overview** (Resumen).
2. Activa **Vectors**. Con él activado, las entradas también se pueden encontrar por significado. Con él desactivado, las palabras clave siguen funcionando y el lorebook no se vectoriza.

Mientras **Vectors** está desactivado, el panel dice "Semantic search is disabled by the lorebook-level Vectors toggle." (La búsqueda semántica está desactivada por el interruptor Vectors a nivel del lorebook.)

### Paso 3: vectoriza las entradas

1. En el panel **Semantic search (embeddings)**, elige una fuente en el menú desplegable. La primera opción es **No semantic search** (Sin búsqueda semántica). Después viene **Built-in model**, cuando está disponible, y luego tus cuentas elegibles.
2. Haz clic en **Vectorize N missing** (Vectorizar N que faltan), por ejemplo "Vectorize 5 missing".
3. Espera. Una ficha muestra el progreso, como "8/12 entries vectorized" (8/12 entradas vectorizadas), y se pone verde cuando todas están listas.

Si no funcionó: si ninguna cuenta tiene un modelo de embeddings, el panel dice "No connections with an embedding model configured. Set an Embedding Model on a connection first." (No hay conexiones con un modelo de embeddings configurado. Configura primero un Embedding Model en una conexión.) Termina el paso 1 y vuelve a intentarlo.

## El panel Semantic search (embeddings)

Tras activar **Vectors**, el panel aparece en la pestaña **Overview** con estos ajustes.

| Ajuste | Qué hace | Predeterminado | Rango |
| --- | --- | --- | --- |
| **Query Messages** (Mensajes de consulta) | Cuántos mensajes recientes del usuario se usan para buscar. 0 usa todos los mensajes disponibles. | 10 | 0 a 100 |
| **Score Threshold** (Umbral de puntuación) | La similitud que necesita una entrada para activarse. Más alto es más estricto. | 0,3 | 0 a 1 |
| **Vector Limit** (Límite de vectores) | El máximo de entradas que este lorebook puede añadir por significado en una respuesta. | 10 | 1 a 100 |

**Include character context** (Incluir el contexto de los personajes) también busca en las respuestas recientes de los personajes, por separado de tus mensajes, y conserva la coincidencia más fuerte. Genera embeddings de texto adicional y está desactivado de forma predeterminada. En ese caso, **Query Messages** también se aplica a las respuestas de los personajes.

Un **Score Threshold** bajo, como 0,2, deja entrar más entradas, pero arriesga coincidencias fuera de tema. Uno alto, como 0,5, solo coincide con significados cercanos. Empieza con el valor predeterminado.

**Vector Limit** solo cuenta las coincidencias por significado. Tus presupuestos de tokens (fragmentos de texto) normales siguen aplicándose.

## Revectorizar, borrar y omitir

- **Re-vectorize N entries** (Revectorizar N entradas) aparece cuando todas las entradas tienen un vector. Las reconstruye todas después de que confirmes.
- **Re-vectorize all** (Revectorizar todo) aparece cuando algunas entradas tienen vectores y otras no. Lo reconstruye todo en una sola pasada.
- **Delete vectors** (Borrar vectores) elimina solo los vectores guardados. El texto y las palabras clave de las entradas se mantienen, y las palabras clave siguen funcionando.
- **No Vector** (Sin vector) en una entrada hace que se omita. Su texto de ayuda dice que la vectorización masiva omite la entrada y elimina cualquier embedding guardado. La entrada sigue activándose por palabra clave.

### Después de cambiar el modelo de embeddings

Los vectores guardados pertenecen al modelo que los creó. Después de cambiar de modelo, usa **Re-vectorize N entries** o **Re-vectorize all** para que todas las entradas usen el mismo modelo. Una ejecución de "solo los que faltan" que devuelve un tamaño de vector diferente se rechaza con "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models." (Las dimensiones del embedding cambiaron. Usa Re-vectorize all entries en lugar de solo las entradas que faltan antes de cambiar de modelo de embeddings.)

Un fallo es silencioso. Al momento del chat, Marinara genera el embedding de tus mensajes con el modelo de embeddings de la cuenta activa, o con el modelo de su **Embedding provider**. Si la cuenta no define ninguno de los dos, usa la fuente de la tarea **Embeddings**, o el modelo integrado. Si el tamaño de vector de ese modelo difiere del de los vectores de tus entradas, Marinara omite esas entradas en la coincidencia semántica y no muestra ningún error. Vectoriza con la misma fuente que usas en el chat, y revectoriza después de cualquier cambio de modelo.

## La búsqueda semántica y el Knowledge Router

Cuando un lorebook está vectorizado, el agente **Knowledge Router** (Enrutador de conocimiento) también usa las coincidencias por significado para construir su lista corta. Sin vectores, usa solo las coincidencias por palabra clave. Consulta [Fuentes de conocimiento: agentes de recuperación y enrutamiento](../agents/knowledge-sources.md).

## Guías relacionadas

- [Resumen de lorebooks](overview.md)
- [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Configuración del modelo integrado](../connections/local-model.md)
- [Fuentes de conocimiento: agentes de recuperación y enrutamiento](../agents/knowledge-sources.md)
