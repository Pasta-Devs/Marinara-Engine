# Descripción general de los lorebooks

Un lorebook (libro de trasfondo) es un conjunto de datos del mundo que la IA lee cuando sus palabras clave aparecen en el chat. Úsalo para lugares, facciones, trasfondos y reglas, para no tener que repetirlos en cada mensaje.

Cada lorebook contiene entradas. Una entrada tiene palabras clave disparadoras y un bloque de texto. Cuando una palabra clave aparece en el chat reciente, Marinara agrega el texto de la entrada al prompt, el texto que se envía al modelo para una respuesta. En otras herramientas, los lorebooks también se llaman World Info.

Por ejemplo, una entrada con la palabra clave `Eldoria` y el texto de abajo hace que la IA conozca la ciudad cada vez que alguien la menciona.

```text
Eldoria is a rainy port city ruled by a council of nine merchants.
```

La coincidencia por palabra clave funciona con cualquier modelo y no necesita configuración. Para hacer coincidir por significado en lugar de por palabras exactas, consulta [Búsqueda semántica para lorebooks](semantic-search.md).

## Crear un lorebook y agregar una entrada

1. Abre el panel **Lorebooks** desde la barra lateral.
2. Haz clic en **New** (Nuevo: el icono del signo más). Se abre la ventana **Create Lorebook** (Crear lorebook).
3. Escribe un **Name** (Nombre). Este campo es obligatorio.
4. Agrega una **Description** (Descripción) si quieres.
5. Elige una **Category** (Categoría). La predeterminada es **Other**. Si vas a vincular este lorebook a un personaje, elige **Character**, porque el selector del personaje solo muestra esa categoría.
6. Haz clic en **Create Lorebook**. El nuevo lorebook aparece en la lista.
7. Haz clic en la fila del lorebook. Se abre el editor de página completa.
8. Haz clic en la pestaña **Entries** (Entradas).
9. Haz clic en **Add Entry** (Agregar entrada). Aparece una fila de entrada nueva y vacía.
10. Escribe un nombre en la fila, como `Eldoria`, y luego haz clic en la fila para abrirla.
11. En **Primary Keys** (Palabras clave principales), escribe `Eldoria` y pulsa <kbd>Enter</kbd>.
12. En **Content** (Contenido), escribe el texto para la IA.

La entrada se guarda sola un momento después de que dejas de escribir, y ves **Saved automatically** (Guardado automáticamente). Ahora la entrada se une al prompt cada vez que su palabra clave coincide. Para las palabras clave, la posición y el momento de activación, consulta [Entradas de lorebook: claves, posición y momento de activación](entries.md).

Si no funcionó: comprueba que el lorebook esté activo en el chat (consulta abajo), que su interruptor **Enabled** (Activado) esté activado y que la palabra clave aparezca en los últimos mensajes. Marinara solo revisa tantos mensajes como indica el ajuste **Scan Depth** (Profundidad de análisis).

## Activar un lorebook en un chat

Un lorebook solo alimenta a la IA cuando está activo en el chat abierto. Hay tres maneras.

| Manera | Dónde se configura | Activo en |
| --- | --- | --- |
| Global | El interruptor **Global** de la pestaña **Overview** (Descripción general) del lorebook | Todos los chats |
| Vinculado | La pestaña **Overview** del lorebook, o el editor del personaje o de la persona | Los chats con ese personaje o esa persona |
| Agregado a un chat | **Chat Settings → Lorebooks** (Ajustes del chat → Lorebooks) | Solo ese chat |

Un lorebook no puede ser global y estar vinculado a la vez. Activar **Global** borra sus vínculos con personajes y personas al guardar.

Un lorebook activo también necesita tener activado su interruptor **Enabled**. Para los vínculos, consulta [Vincular lorebooks a personajes y personas](linking-to-characters.md).

## Los ajustes de la pestaña Overview

Abre un lorebook y haz clic en **Overview** para definir cómo se comporta el lorebook completo.

| Ajuste | Qué hace | Predeterminado |
| --- | --- | --- |
| **Scan Depth** | Cuántos mensajes recientes revisa Marinara en busca de palabras clave. 0 revisa el chat completo. | 2 |
| **Token Budget** (Presupuesto de tokens) | La mayor cantidad de tokens que este lorebook puede agregar a una respuesta. 0 significa sin límite. | 2048 |
| **Entry Limit** (Límite de entradas) | La mayor cantidad de entradas que este lorebook puede agregar a una respuesta. Rango de 1 a 1000. | 100 |
| **Max Depth** (Profundidad máxima) | Pasadas extra para la recursión. Solo se muestra cuando **Recursive** (Recursivo) está activado. Rango de 1 a 10. | 3 |

Los tokens son pequeños fragmentos de texto que cuentan los modelos; en inglés, más o menos tres cuartos de una palabra. Para saber qué hace cada límite y qué significa la recursión, consulta [Presupuestos de tokens y recursión en lorebooks](token-budgets.md).

La pestaña también tiene estos interruptores.

- **Enabled** activa o desactiva el lorebook completo. Está activado de forma predeterminada.
- **Global** hace que el lorebook esté activo en todos los chats.
- **Recursive** permite que el texto de una entrada activada dispare más entradas. Está desactivado de forma predeterminada.
- **Vectors** (Vectores) permite que las entradas también coincidan por significado. Está desactivado de forma predeterminada, y las palabras clave funcionan de todos modos.

El panel **Semantic search (embeddings)** (Búsqueda semántica: embeddings), debajo de los interruptores, se explica en [Búsqueda semántica para lorebooks](semantic-search.md).

## El panel Lorebooks

En la parte superior del panel, tres botones de icono muestran su nombre cuando pasas el cursor sobre ellos.

- **New** abre la ventana **Create Lorebook**.
- **Import** (Importar) abre la ventana **Import Lorebook** (Importar lorebook). Consulta [Importar y exportar lorebooks](import-export.md).
- **Select** (Seleccionar) activa la selección múltiple, para que puedas exportar o eliminar varios lorebooks a la vez.

Debajo de los botones:

- **Search lorebooks** (Buscar lorebooks) filtra por nombre, descripción, nombres de personajes o personas vinculados y etiquetas.
- **Sort order** (Orden) ofrece **Manual order** (Orden manual), **A-Z**, **Z-A**, **Newest**, **Oldest** y **Token Budget**. Con **Manual order**, arrastra los lorebooks a su lugar, o usa <kbd>Alt</kbd>+<kbd>Up</kbd> y <kbd>Alt</kbd>+<kbd>Down</kbd>.
- **New Folder** (Nueva carpeta) crea una carpeta de biblioteca. Arrastra un lorebook sobre ella. En un teléfono, mantén pulsado el lorebook y luego arrástralo. Estas carpetas son distintas de las carpetas de entradas que hay dentro de un lorebook.

Cada fila tiene los botones **Copy** (Copiar: duplica el lorebook) y **Delete** (Eliminar). Aparecen cuando pasas el cursor sobre la fila y en los teléfonos siempre están visibles. Un lorebook desactivado muestra una insignia **OFF**. Haz clic en la imagen para subirla o reemplazarla.

### Categorías

Una categoría es una etiqueta para tu biblioteca. No cambia cuándo se activa el lorebook. Las pestañas son **All** (Todos), **Active** (Activos: los lorebooks relevantes para el chat abierto), **World**, **Character**, **NPC**, **Spellbook** y **Other**. Puedes cambiar la categoría de un lorebook en su pestaña **Overview**, donde **Other** se llama **Uncategorized**.

## Guías relacionadas

- [Entradas de lorebook: claves, posición y momento de activación](entries.md)
- [Presupuestos de tokens y recursión en lorebooks](token-budgets.md)
- [Búsqueda semántica para lorebooks](semantic-search.md)
- [Vincular lorebooks a personajes y personas](linking-to-characters.md)
- [Importar y exportar lorebooks](import-export.md)
- [Fuentes de conocimiento: agentes de recuperación y de enrutamiento](../agents/knowledge-sources.md)
