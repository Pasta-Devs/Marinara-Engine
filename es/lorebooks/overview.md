# Descripción general de los lorebooks

Esta guía explica qué es un lorebook (libro de trasfondo) en Marinara Engine, cómo funciona el panel **Lorebooks** y cómo un lorebook se activa en un chat. También te lleva paso a paso a crear tu primer lorebook y su primera entrada. Los temas más profundos, como las palabras clave, el momento de activación y la búsqueda semántica, tienen sus propias guías, enlazadas al final.

## Qué es un lorebook

Un lorebook es una pequeña base de conocimiento de la que la IA puede tomar datos durante un chat. También se le llama **World Info**, y los dos nombres significan lo mismo. Cada lorebook contiene una lista de entradas. Una entrada tiene dos partes: unas palabras clave disparadoras y un bloque de texto.

Cuando una palabra clave aparece en el chat reciente, Marinara Engine agrega el texto de esa entrada al prompt. El prompt son las instrucciones ocultas y el historial que se envían a la IA en cada respuesta. Esto permite que la IA use datos que nunca se le dijeron directamente en la conversación.

Aquí tienes un ejemplo simple. Escribes una entrada de lorebook con la palabra clave `Eldoria` y este texto:

```
Eldoria is a rainy port city ruled by a council of nine merchants.
```

Ahora, cada vez que tú o un personaje mencionen Eldoria, la IA recibe ese dato. Entonces puede responder como si siempre hubiera conocido la ciudad. Sin la entrada, la IA tendría que adivinar.

Los lorebooks son útiles para el trasfondo del mundo, las historias de los personajes, los nombres de lugares, las facciones, las reglas y cualquier dato que quieras que la IA recuerde. No necesitas repetir estos datos en cada mensaje. El lorebook los aporta solo cuando son relevantes, lo que ahorra espacio en el prompt.

La coincidencia por palabra clave funciona con cualquier conexión de IA y no necesita configuración extra. Marinara también puede hacer coincidir entradas por significado en lugar de por palabras exactas, mediante la búsqueda semántica opcional. Esa es una función aparte, que activas tú y que se cubre en su propia guía.

## El panel Lorebooks

El panel **Lorebooks** es la biblioteca donde exploras, buscas y gestionas todos los lorebooks. Ábrelo desde la barra lateral de la app. El panel lista cada lorebook con su imagen, su nombre y una descripción corta.

Tres botones de icono están en la parte superior del panel. Solo muestran un icono, sin etiqueta de texto. Pasa el cursor sobre un botón para ver su nombre.

- **New** (Nuevo) (un signo de más) abre la ventana **Create Lorebook** (Crear lorebook) para que puedas crear un lorebook.
- **Import** (Importar) (una flecha hacia abajo) abre la ventana **Import Lorebook** (Importar lorebook) para cargar un archivo de lorebook.
- **Select** (Seleccionar) (una marca de verificación) activa el modo de selección múltiple para que puedas exportar o eliminar varios lorebooks a la vez.

Debajo de los botones hay un cuadro de búsqueda con el texto de marcador de posición **Search lorebooks** (Buscar lorebooks). Filtra la lista por nombre, descripción, nombres de personaje o persona vinculados y etiquetas. Junto a él hay un menú desplegable **Sort order** (Orden) con estas opciones: **Manual order** (Orden manual), **A-Z**, **Z-A**, **Newest**, **Oldest** y **Token Budget**. Con **Manual order**, arrastra los lorebooks al orden que quieras, o mueve uno con Alt+Arriba y Alt+Abajo en el teclado. Tu orden se conserva.

Cada fila de lorebook muestra un botón **Copy** (Copiar) y un botón **Delete** (Eliminar). Los botones aparecen cuando pasas el cursor sobre la fila. En el teléfono están siempre visibles. **Copy** duplica el lorebook. Un lorebook que está desactivado muestra una pequeña insignia **OFF**. Haz clic en la imagen para subir o reemplazarla.

También puedes crear carpetas de biblioteca con el botón **New Folder** (Nueva carpeta). Arrastra un lorebook sobre una carpeta para archivarlo. Esto mantiene ordenada una biblioteca grande. En un teléfono, mantén pulsado un lorebook un momento y luego arrástralo. Estas carpetas de biblioteca son distintas de las carpetas de entradas que puedes crear dentro de un solo lorebook.

## Categorías

Cada lorebook tiene una categoría. La categoría es solo una etiqueta para ayudarte a organizar tu biblioteca. No cambia cómo ni cuándo se activa el lorebook.

El panel tiene estas pestañas de categoría:

- **All** (Todos) muestra todos los lorebooks, agrupados por categoría.
- **Active** (Activos) muestra solo los lorebooks que son relevantes para el chat que tienes abierto ahora mismo.
- **World**, **Character**, **NPC**, **Spellbook** y **Other** muestran, cada una, los lorebooks de esa única categoría.

Cuando creas un lorebook eliges una de cinco categorías: **World**, **Character**, **NPC**, **Spellbook** u **Other**. La predeterminada es **Other**. Puedes cambiar la categoría más tarde desde la pestaña **Overview** (Descripción general) del lorebook. Ten en cuenta que la pestaña **Overview** etiqueta esta misma categoría como **Uncategorized** en lugar de **Other**. Usa las etiquetas que tengan sentido para ti. Por ejemplo, pon las notas de lugares y ambientación en **World** y pon la historia de un acompañante en **Character**.

## Cómo se activa un lorebook

Un lorebook solo alimenta a la IA cuando está activo en el chat actual. Hay tres maneras en que un lorebook se vuelve activo. Tú eliges la que encaje.

1. **Global.** Un lorebook global está activo en todos los chats, siempre que esté activado. Activa el interruptor **Global** en la pestaña **Overview** del lorebook. Usa esto para datos que importan en todas partes, como las reglas de tu mundo compartido.
2. **Linked to a character or persona** (Vinculado a un personaje o persona). Un lorebook vinculado se activa automáticamente en cualquier chat que incluya ese personaje o use esa persona. Estableces los vínculos en la pestaña **Overview** o desde el editor de personaje o persona. Esta es la opción más común para la propia historia de un personaje.
3. **Pinned to a single chat** (Fijado a un solo chat). Puedes agregar un lorebook a un solo chat desde los ajustes de ese chat. Se mantiene activo únicamente en ese chat. Esto es útil para el trasfondo que encaja en una sola historia y no en toda tu biblioteca.

Un lorebook global y un lorebook vinculado no pueden ser el mismo lorebook. Activar **Global** borra cualquier vínculo con personaje o persona al guardar. Marinara trata estas dos opciones como mutuamente excluyentes.

Todo lorebook activo respeta igualmente su interruptor **Enabled** (Activado). Si un lorebook está desactivado, ninguna de sus entradas se activa, incluso cuando es global o está vinculado. Para ver qué lorebooks están activos en el chat abierto, abre los ajustes del chat y busca su sección **Lorebooks**. Allí también puedes editar la lista de activos. Una guía aparte cubre esa sección.

## Crea tu primer lorebook y entrada

Sigue estos pasos para crear un lorebook y agregar una entrada.

1. Abre el panel **Lorebooks** y haz clic en **New**. Se abre la ventana **Create Lorebook**.
2. Escribe un nombre en el campo **Name** (Nombre). Este campo es obligatorio. Un ejemplo claro es `Eldoria World Lore`.
3. Agrega una **Description** (Descripción) corta si quieres. Esto es opcional y solo te ayuda a encontrar el lorebook más tarde.
4. Elige una **Category** (Categoría) del menú desplegable, o déjala como **Other**.
5. Haz clic en el botón **Create Lorebook**. Tu nuevo lorebook aparece en la lista del panel.

Tu lorebook aún no tiene entradas. Ahora agrega una.

1. Haz clic en la fila de tu lorebook en el panel. Se abre el editor de página completa.
2. Haz clic en la pestaña **Entries** (Entradas). La insignia junto a ella muestra el número de entradas.
3. Haz clic en **Add Entry** (Agregar entrada). Aparece una entrada nueva y vacía.
4. En la entrada, agrega una o más palabras clave disparadoras, como `Eldoria`.
5. En el campo **Content** (Contenido) de la entrada, escribe el texto que quieres que reciba la IA.

La entrada se guarda sola un momento después de que dejas de escribir. Verás una breve nota **Saved automatically** (Guardado automáticamente). Tu lorebook ya funciona: cuando una palabra clave coincide con el chat reciente, el contenido de la entrada se une al prompt. La [guía de entradas](entries.md) explica las palabras clave, las reglas de coincidencia y las opciones de momento de activación. Sus secciones [Estrategia de redacción](entries.md#authoring-strategy-choosing-the-right-entry) y [Ejemplo práctico](entries.md#worked-example-a-small-setting) muestran cómo elegir los controles adecuados para cada entrada.

## Los ajustes de la pestaña Overview

Abre un lorebook y haz clic en la pestaña **Overview** para definir cómo se comporta el lorebook completo. Los campos más importantes son el nombre, la categoría, los vínculos y los interruptores descritos arriba. La pestaña también tiene estos ajustes numéricos.

| Ajuste | Qué hace | Predeterminado |
|---|---|---|
| **Scan Depth** | Cuántos mensajes recientes revisa Marinara en busca de coincidencias de palabras clave. Pon 0 para escanear el chat completo. | 2 |
| **Token Budget** | La mayor cantidad de tokens que este lorebook puede agregar a un prompt. Pon 0 para no tener límite. | 2048 |
| **Entry Limit** | La mayor cantidad de entradas que este lorebook puede agregar a un prompt. El rango es de 1 a 1000. | 100 |
| **Max Depth** | Cuántas pasadas recursivas extra ejecutar. Este campo aparece solo cuando **Recursive** está activado. El rango es de 1 a 10. | 3 |

Un token es un pequeño fragmento de texto, más o menos unos pocos caracteres. La IA tiene un espacio limitado para el prompt, así que el **Token Budget** evita que un lorebook llene ese espacio.

La pestaña también tiene tres interruptores:

- **Enabled** activa o desactiva el lorebook completo. Está activado de forma predeterminada.
- **Recursive** permite que el texto de una entrada activada dispare más entradas en pasadas extra. Está desactivado de forma predeterminada. Actívalo cuando tu trasfondo deba encadenarse con trasfondo relacionado.
- **Vectors** permite que las entradas usen coincidencia semántica. Está desactivado de forma predeterminada. La coincidencia por palabra clave sigue funcionando cuando está desactivado.

Debajo de estos ajustes hay un panel **Semantic Search (Embeddings)** (Búsqueda semántica). Construye los datos que hacen funcionar la coincidencia basada en el significado. La guía de búsqueda semántica cubre la configuración, las fuentes de embeddings (representaciones numéricas del texto) y los botones para vectorizar.

Los detalles más finos de los presupuestos, el **Entry Limit** y la recursión también tienen su propia guía. Empieza con los valores predeterminados de arriba. Funcionan bien para la mayoría de los lorebooks, y puedes ajustarlos más tarde.

## Guías relacionadas

- [Entradas de lorebook: claves, posición y momento de activación](entries.md)
- [Presupuestos de tokens y recursión en lorebooks](token-budgets.md)
- [Búsqueda semántica para lorebooks](semantic-search.md)
- [Vincular lorebooks a personajes y personas](linking-to-characters.md)
- [Importar y exportar lorebooks](import-export.md)
- [Fuentes de conocimiento: agentes de recuperación y de enrutamiento](../agents/knowledge-sources.md)
