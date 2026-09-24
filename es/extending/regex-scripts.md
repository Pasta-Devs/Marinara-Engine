# Scripts de regex

Esta guía explica los scripts de regex en Marinara Engine. Un script de regex es una regla de buscar y reemplazar que reescribe el texto del chat de forma automática. Esta guía cubre qué hacen los scripts de regex, cómo crear uno, dónde se ejecutan y cómo limitarlos a un solo personaje.

## Qué es un script de regex

Regex es la forma corta de "regular expression" (expresión regular). Una expresión regular es un patrón de búsqueda. Encuentra el texto que coincide con una regla, y un script de regex reemplaza ese texto por otra cosa. No necesitas saber programar para usar uno.

Un script de regex se ejecuta por su cuenta cada vez que un mensaje pasa por un chat. Puede limpiar una respuesta de la IA antes de que la veas. Puede cambiar tu propio mensaje antes de enviarlo. También puede cambiar el texto que recibe el modelo. Defines el patrón una vez, y sigue funcionando en cada mensaje que coincida.

Aquí tienes un ejemplo simple de antes y después. Algunos modelos envuelven las acciones entre asteriscos, así:

```
*She smiles* Hello there.
```

Si buscas el patrón `\*([^*]+)\*` y lo reemplazas por `$1`, los asteriscos se eliminan y el texto dentro de ellos se conserva:

```
She smiles Hello there.
```

El `$1` en el reemplazo significa "el texto que el patrón capturó en el primer par de paréntesis". Usarás `$1`, `$2` y tokens (fragmentos de texto) similares a menudo.

Entre los usos comunes están quitar asteriscos, borrar notas fuera de personaje entre paréntesis, censurar una palabra y corregir manías de formato repetidas de un personaje.

## Dónde encontrar tus scripts de regex

Tus scripts de regex globales viven en el panel **Presets** (ajustes guardados). Ábrelo con el botón **Presets** de la barra superior, y luego busca la sección titulada **Regexes**. La nota de la sección dice **Find/replace patterns applied to AI output or user input** (patrones de buscar/reemplazar aplicados a la salida de la IA o a la entrada del usuario).

Cada fila de la lista muestra:

- El nombre del script.
- Una pequeña etiqueta **AI** o **User** que muestra dónde se ejecuta el script.
- El patrón, mostrado como `/pattern/flags`.
- Un interruptor para activar o desactivar el script. Esto tiene efecto de inmediato, sin necesidad de abrir el editor.
- Un botón **Edit regex** (editar regex, icono de lápiz).
- Un botón **Delete regex** (eliminar regex, icono de papelera).

Si aún no tienes scripts, la lista muestra **No regexes yet** (aún no hay regexes). Puedes arrastrar una fila por su asa para cambiar el orden de ejecución. Esta lista muestra solo tus scripts globales. Los scripts ligados a un solo personaje se guardan aparte. Consulta "Scripts de regex limitados a un personaje" más abajo.

El encabezado de la sección también tiene tres botones de icono:

- **Create regex** (crear regex): abre un nuevo script en blanco.
- **Import regexes from JSON** (importar regexes desde JSON): lee scripts de un archivo.
- **Export regexes to JSON** (exportar regexes a JSON): guarda todos tus scripts globales en un solo archivo.

## Crear un script de regex

Para hacer un nuevo script global:

1. Abre el panel **Presets** y busca la sección **Regexes**.
2. Haz clic en **Create regex**. Se abre el editor completo del script de regex.
3. Escribe un nombre en el cuadro de la parte superior. Un script nuevo empieza con el nombre **New Regex Script**.
4. Rellena los campos que se describen a continuación.
5. Haz clic en **Save** (guardar). Aparece por un momento una nota verde de **Saved** (guardado).

El editor tiene estos campos.

### Find Pattern (Regex)

**Find Pattern (Regex)** (patrón de búsqueda) es el patrón de búsqueda. Escríbelo sin las barras delimitadoras. El texto de ejemplo muestra un caso: `\*([^*]+)\*`. Si el patrón no es válido o no es seguro, aparece un error rojo debajo del cuadro y bloquea el guardado. Consulta "Seguridad y rendimiento" más abajo.

### Replace With

**Replace With** (reemplazar por) es el texto que reemplaza cada coincidencia. Déjalo vacío para borrar el texto coincidente. Puedes reutilizar el texto capturado con `$1`, `$2`, y así sucesivamente. Las transformaciones de mayúsculas antes de una captura cambian sus letras:

- `\u$1` pone en mayúscula la primera letra de la captura.
- `\U$1\E` pone en mayúsculas toda la captura.
- `\l$1` pone en minúscula la primera letra de la captura.
- `\L$1\E` pone en minúsculas toda la captura.

El texto literal con barra invertida, como una ruta de Windows del tipo `C:\Users`, se conserva tal como está escrito.

### Regex Flags

**Regex Flags** (banderas de regex) son botones de interruptor que cambian cómo coincide el patrón. Un script nuevo empieza con `g` e `i` activados:

- `g` (global): reemplaza cada coincidencia, no solo la primera.
- `i` (case-insensitive): coincide sin importar si las letras están en mayúsculas o minúsculas.
- `m` (multiline): deja que `^` y `$` coincidan en los saltos de línea.
- `s` (dotAll): deja que `.` coincida también con los caracteres de nueva línea.
- `u` (unicode), `y` (sticky) y `d` (match indices) son banderas avanzadas para casos especiales.

### Trim Strings

**Trim Strings** (cadenas a recortar) es una lista opcional de cadenas de texto simples que se eliminan después de ejecutarse el reemplazo. Haz clic en **Add trim string** (añadir cadena a recortar) para añadir una fila, y en el botón **X** para quitar una. Esto es útil para borrar un fragmento de texto fijo que es más fácil de escribir que de coincidir con un patrón.

### Live Test

**Live Test** (prueba en vivo) te permite comprobar tu patrón antes de guardar. Pega un texto de ejemplo en el cuadro, y el resultado aparece debajo, bajo **Result:** (resultado). **Live Test** solo prueba la lógica de buscar, reemplazar y recortar. No comprueba la ubicación, el estado activado o desactivado, el alcance por personaje ni la profundidad. La nota bajo el cuadro lo dice: **Pattern preview only: placement, enabled state, character scope, and depth are evaluated at runtime** (solo vista previa del patrón: la ubicación, el estado activado, el alcance por personaje y la profundidad se evalúan en tiempo de ejecución).

Puedes usar macros como `{{user}}` y `{{char}}` en el patrón, en el reemplazo y en las cadenas a recortar. En **Live Test** se resuelven en valores de ejemplo. En un chat real se resuelven en los nombres y el texto reales. Para saber más sobre las macros, consulta [Macros](../prompts/macros.md).

## Ubicación: AI Output o User Input

El campo **Apply To** (aplicar a) decide qué lado del chat vigila un script. Al menos una opción debe quedar seleccionada. Puedes elegir ambas.

- **AI Output** (salida de la IA): el script se ejecuta en las respuestas de la IA antes de que se muestren.
- **User Input** (entrada del usuario): el script se ejecuta en tus mensajes antes de enviarlos.

Usa **AI Output** para limpiar lo que escribe el modelo. Usa **User Input** para corregir o reformar tu propio texto.

Con **Only Prompt** o **Both**, en un chat **Roleplay** con el modo de grupo **Individual** (respuestas individuales), la aplicación depende del personaje que recibe el prompt: tus mensajes y los de otros personajes usan **User Input**, mientras que las respuestas propias del personaje que va a responder usan **AI Output**. Esto también se aplica a las respuestas anteriores del mismo turno del grupo. Las restricciones por personaje siguen determinando quién recibe el prompt modificado, así que un narrador excluido de un script que oculta pensamientos conserva los pensamientos originales. Usa **Only Prompt** para mantener intacto el texto guardado del chat.

## Apply Mode: Only Display, Only Prompt o Both

El selector **Apply Mode** (modo de aplicación) vive dentro de **Advanced Options** (opciones avanzadas). Decide cuándo tiene efecto la reescritura. Esto es distinto de la ubicación. Un script nuevo empieza en **Only Display**.

- **Only Display** (solo pantalla): cambia solo lo que ves en el chat. El mensaje guardado y el texto que el modelo recibe en turnos posteriores no cambian.
- **Only Prompt** (solo prompt): cambia solo lo que recibe el modelo. La pantalla del chat y el mensaje guardado no cambian. Esto es también lo que ves en la vista previa del prompt de la app.
- **Both** (ambos): cambia la pantalla y el texto del prompt.

### Qué modo de aplicación quiero

Usa esta guía rápida:

- Solo quieres pulir cómo se ve una respuesta en la pantalla: elige **Only Display**. Es la opción más segura para arreglos cosméticos.
- Quieres cambiar lo que lee el modelo, por ejemplo para quitar una etiqueta que el modelo sigue copiando: elige **Only Prompt**.
- Quieres que el cambio se aplique en la pantalla y en el contexto del modelo: elige **Both**.

Algo que debes saber sobre tus propios mensajes. Cuando un script de **User Input** está en **Only Display** o **Both**, la reescritura ocurre justo antes de enviar tu mensaje. Así que cambia el mensaje que realmente se guarda y se envía, no solo cómo se ve después. No hay un modo de solo pantalla para tus propios mensajes salientes.

## Execution Order y Depth

Ambos ajustes están en **Advanced Options**.

**Execution Order** (orden de ejecución) es un número. Los números más bajos se ejecutan primero. Esto importa cuando más de un script puede coincidir con el mismo texto. Un script nuevo empieza en 0, y la app asigna el siguiente número libre cuando guardas, para que los scripts recién creados no choquen. También puedes arrastrar filas en la lista **Regexes** para reordenarlas.

**Depth Range** (rango de profundidad) limita hasta qué punto hacia atrás en el chat se ejecuta un script, usando dos campos numéricos, **Min** y **Max**. La profundidad cuenta hacia atrás desde el mensaje más nuevo. El mensaje más nuevo es la profundidad 0, el anterior es la profundidad 1, y así sucesivamente. Deja ambos campos vacíos para ejecutarlo a cualquier profundidad. Si el mínimo es mayor que el máximo, el guardado se bloquea.

## Scripts de regex limitados a un personaje

Un script de regex puede pertenecer a uno o más personajes concretos en lugar de ejecutarse en todas partes. Hay dos maneras de limitar un script a un personaje.

La primera manera es dentro del editor. Activa el interruptor **Specific Characters** (personajes específicos) en la tarjeta **Apply To**, y luego elige uno o más personajes de la cuadrícula. Cuando el interruptor está desactivado, el script **Applies to all characters** (se aplica a todos los personajes). Debes elegir al menos un personaje si el interruptor está activado.

La segunda manera es por personaje. Abre un personaje, ve a la pestaña **Advanced** (avanzado) y busca la tarjeta titulada **Regex Scripts**. Esta tarjeta lista solo los scripts ligados a ese personaje, y tiene sus propios botones **Create regex**, importar y exportar. Debes guardar el personaje primero antes de poder añadir scripts limitados. Si el personaje no está guardado, la tarjeta lo indica.

Abrir el editor completo desde esta tarjeta te saca del Character Editor (editor de personajes). Si el personaje tiene cambios sin guardar, la app te avisa primero para que no los pierdas.

### El ajuste por chat Scoped Regex Scripts

Los scripts limitados a un personaje no se ejecutan automáticamente en todos los chats. Un ajuste por chat los controla. Abre el panel **Chat Settings** (Ajustes del chat) de un chat. Una sección titulada **Scoped Regex Scripts** (scripts de regex limitados) aparece solo cuando al menos un personaje de ese chat tiene scripts limitados. Ofrece tres modos:

- **Disabled** (desactivado, el predeterminado): los scripts limitados a un personaje están desactivados, y solo se ejecutan los scripts globales.
- **Exclusive** (exclusivo): cada script limitado solo cambia los mensajes del personaje al que pertenece.
- **Chat** (chat): cada script limitado cambia todos los mensajes del chat.

Debajo de los botones de modo, el panel lista cada personaje con scripts limitados y te deja activar o desactivar cada script para ese chat. Este ajuste controla los scripts del lado de la pantalla. Los scripts de prompt siempre siguen al personaje que realmente está generando la respuesta.

## Importar scripts de regex desde SillyTavern

Marinara puede leer scripts de regex que vienen incluidos dentro de una tarjeta de personaje de SillyTavern. Cuando importas una tarjeta, aparece una sección titulada **Imported regex scripts** (scripts de regex importados) con dos opciones:

- **Character only** (solo personaje, el predeterminado): los scripts quedan limitados a ese único personaje.
- **Global** (global): los scripts se añaden a **Presets** y se ejecutan en cada chat.

Esta opción aparece tanto en la ventana de importación de un solo personaje como en el flujo masivo **Import from SillyTavern Folder** (importar desde carpeta de SillyTavern). Los scripts incluidos con un patrón vacío, o con un patrón que falla la comprobación de seguridad, se omiten durante la importación. También puedes importar un archivo JSON simple de scripts con el botón **Import regexes from JSON** de la sección **Regexes**. Para el recorrido completo de importación, consulta [Importar desde SillyTavern](../data/importing-from-sillytavern.md).

## Seguridad y rendimiento

Cada patrón se comprueba antes de poder guardarse o ejecutarse. Marinara bloquea los patrones que muy probablemente se ejecutarían despacio y colgarían la app. Un patrón bloqueado muestra este mensaje: **Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns** (el patrón de regex no es seguro: evita cuantificadores anidados, alternativas cuantificadas ambiguas y patrones sobredimensionados). El guardado se bloquea hasta que lo corrijas.

En palabras sencillas, evita estas formas:

- Patrones de más de 1000 caracteres.
- Un grupo que se repite colocado dentro de otro grupo que se repite, como `(a+)+`.
- Dos comodines amplios seguidos, como `.*.*` o `\s*\w*`. Un comodín amplio es un token como `.*`, `\s*` o `\w+` que puede coincidir con una cantidad ilimitada de texto.
- Tres o más comodines amplios en cualquier parte de un patrón, incluso con otro texto entre ellos.

Una sola repetición como `a+` o `(a+)` está bien. Un solo comodín amplio por su cuenta, como un único `.*`, también está bien.

Incluso con un patrón seguro, la app también limita cuánto puede tardar un solo reemplazo en un mensaje más largo. Si un script tarda demasiado en un mensaje, la app omite ese script solo para ese mensaje y sigue adelante. El script no se desactiva, y lo intentará de nuevo en el siguiente mensaje. Para ir seguro, prueba siempre un patrón nuevo en **Live Test** con texto de ejemplo corto antes de activarlo.

## Guías relacionadas

- [Macros](../prompts/macros.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
- [Importar desde SillyTavern](../data/importing-from-sillytavern.md)
