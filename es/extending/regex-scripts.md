# Scripts de regex

Un script de regex es una regla de buscar y reemplazar que reescribe el texto del chat de forma automática. Úsalo para limpiar una respuesta de la IA, reformar tu propio mensaje o cambiar el texto que recibe el modelo. No necesitas saber programar para usar uno.

Regex es la forma corta de "regular expression" (expresión regular), un patrón de búsqueda que encuentra el texto que coincide con una regla. Defines el patrón una vez, y se ejecuta en cada mensaje que coincida.

Ejemplo: algunos modelos envuelven las acciones entre asteriscos.

```text
*She smiles* Hello there.
```

Copia este patrón tal cual: `\*([^*]+)\*`. Reemplázalo por `$1`, y los asteriscos desaparecen mientras el texto de dentro se conserva:

```text
She smiles Hello there.
```

`$1` significa "el texto capturado por el primer par de paréntesis". Otros usos comunes son borrar notas fuera de personaje entre paréntesis, censurar una palabra y corregir las manías de formato de un personaje.

## Crear un script de regex

Tus scripts globales están en el panel **Presets** (Ajustes guardados), en la sección **Regexes**. Ábrelo con el botón **Presets** de la barra superior.

### Cómo crear un script de regex

1. Abre **Presets** y busca **Regexes**.
2. Haz clic en **Create regex** (Crear regex). Se abre el editor completo.
3. Escribe un nombre en la parte superior. Un script nuevo se llama "New Regex Script".
4. En **Find Pattern (Regex)** (Patrón de búsqueda: regex), escribe `\*([^*]+)\*` (consulta [Campos del editor](#editor-fields)).
5. En **Replace With** (Reemplazar por), escribe `$1`.
6. En **Apply To** (Aplicar a), deja seleccionado **AI Output** (Salida de la IA). El modo de aplicación predeterminado, **Only Display** (Solo pantalla), es la opción segura (consulta [Elegir dónde se ejecuta un script](#choose-where-a-script-runs)).
7. Pega `*She smiles* Hello there.` en **Live Test** (Prueba en vivo). **Result:** debería decir `She smiles Hello there.`
8. Haz clic en **Save** (Guardar). Aparece por un momento una nota verde **Saved** (Guardado).
9. Compruébalo en un chat: cuando una respuesta de la IA tenga texto entre asteriscos, los asteriscos ya no se muestran.

Si no funcionó: un error rojo bajo **Find Pattern (Regex)** bloquea el guardado. El patrón no es válido o no es seguro; consulta [Seguridad y rendimiento](#safety-and-performance).

### Gestionar tus scripts

Cada fila de la lista **Regexes** muestra el nombre del script, una etiqueta **AI** o **User**, el patrón como `/pattern/flags`, un interruptor de activar/desactivar (tiene efecto de inmediato), **Edit regex** (Editar regex, lápiz) y **Delete regex** (Eliminar regex, papelera). Sin scripts, la lista dice "No regexes yet" (aún no hay regexes). Arrastra una fila por su asa para cambiar el orden de ejecución.

El encabezado de la sección tiene tres botones de icono: **Create regex**, **Import regexes from JSON** (Importar regexes desde JSON) y **Export regexes to JSON** (Exportar regexes a JSON: guarda todos tus scripts globales en un solo archivo). Los scripts ligados a un solo personaje se guardan aparte; consulta [Limitar un script a un personaje](#limit-a-script-to-one-character).

<a id="editor-fields"></a>

## Campos del editor

### Find Pattern (Regex)

El patrón de búsqueda. Escribe solo el patrón, sin barra al principio ni al final. El marcador de posición muestra un ejemplo: `\*([^*]+)\*`.

### Replace With

El texto que reemplaza cada coincidencia. Déjalo vacío para borrar la coincidencia. Reutiliza el texto capturado con `$1`, `$2`, y así sucesivamente. Estos cambios de mayúsculas funcionan antes de una captura:

| Escribe | Resultado |
| --- | --- |
| `\u$1` | Pone en mayúscula la primera letra de la captura |
| `\U$1\E` | Pone en mayúsculas toda la captura |
| `\l$1` | Pone en minúscula la primera letra de la captura |
| `\L$1\E` | Pone en minúsculas toda la captura |

El texto literal con barra invertida, como una ruta de Windows del tipo `C:\Users`, se conserva tal como está escrito.

### Regex Flags

Botones de interruptor que cambian cómo coincide el patrón. Un script nuevo empieza con `g` e `i` activados.

| Bandera | Significado |
| --- | --- |
| `g` | Global: reemplaza cada coincidencia, no solo la primera |
| `i` | Sin distinguir entre mayúsculas y minúsculas |
| `m` | Multilínea: `^` y `$` coinciden en los saltos de línea |
| `s` | dotAll: `.` también coincide con los caracteres de nueva línea |
| `u`, `y`, `d` | Unicode, sticky e índices de coincidencia, para casos especiales |

### Trim Strings

Una lista opcional de cadenas de texto simples que se eliminan después de ejecutarse el reemplazo. Haz clic en **Add trim string** (Añadir cadena a recortar) para añadir una fila y en el botón **X** para quitar una. Úsala para un fragmento de texto fijo que es más fácil de escribir que de coincidir con un patrón.

### Live Test

Pega un texto de ejemplo, y el resultado aparece bajo **Result:**. Live Test solo comprueba la lógica de buscar, reemplazar y recortar. La ubicación, el estado activado o desactivado, el alcance por personaje y la profundidad se evalúan en un chat real. Puedes usar macros como `{{user}}` y `{{char}}` en el patrón, en el reemplazo y en las cadenas a recortar. En Live Test usan valores de ejemplo. Consulta [Macros](../prompts/macros.md).

<a id="choose-where-a-script-runs"></a>

## Elegir dónde se ejecuta un script

### Apply To

**Apply To** decide qué lado del chat vigila un script. Mantén al menos una opción seleccionada. Puedes elegir ambas.

- **AI Output**: se ejecuta en las respuestas de la IA antes de que se muestren.
- **User Input** (Entrada del usuario): se ejecuta en tus mensajes antes de que se envíen.

### Apply Mode

**Apply Mode** (Modo de aplicación) está dentro de **Advanced Options** (Opciones avanzadas). Decide qué cambia la reescritura. Un script nuevo empieza en **Only Display**.

- **Only Display**: cambia lo que ves en el chat. El mensaje guardado y el contexto posterior del modelo no cambian. Es lo más seguro para arreglar cómo se ve una respuesta.
- **Only Prompt** (Solo prompt): cambia lo que recibe el modelo, y también se muestra en la vista previa del prompt. La pantalla y el mensaje guardado no cambian. Úsalo para quitar algo que el modelo sigue copiando.
- **Both** (Ambos): cambia la pantalla y el texto del prompt.

Para tus propios mensajes, un script de **User Input** configurado en **Only Display** o **Both** reescribe el mensaje justo antes de enviarlo. Cambia el mensaje guardado y enviado, no solo cómo se ve. No hay un modo de solo pantalla para los mensajes salientes.

### Execution Order y Depth Range

Ambos están en **Advanced Options**.

- **Execution Order** (Orden de ejecución) es un número. Los números más bajos se ejecutan primero, lo que importa cuando varios scripts pueden coincidir con el mismo texto. Un script nuevo empieza en 0, y la app asigna el siguiente número libre cuando guardas. También puedes arrastrar filas en la lista **Regexes**.
- **Depth Range** (Rango de profundidad) limita hasta dónde hacia atrás se ejecuta un script, con **Min** y **Max**. El mensaje más nuevo es la profundidad 0, el anterior es la profundidad 1, y así sucesivamente. Deja ambos vacíos para ejecutarlo a cualquier profundidad. El guardado se bloquea si **Min** es mayor que **Max**.

### Chats de grupo

Esto se aplica a **Only Prompt** y **Both** en un chat de **Roleplay** con el modo de grupo **Individual**.

- La ubicación sigue al personaje que recibe el prompt.
- Tus mensajes y los mensajes de otros personajes cuentan como **User Input**.
- Las respuestas propias del personaje que responde cuentan como **AI Output**, incluidas las respuestas anteriores del mismo turno del grupo.
- Los límites por personaje siguen decidiendo quién recibe el prompt reescrito. Un narrador excluido de un script que oculta pensamientos conserva los pensamientos originales.

<a id="limit-a-script-to-one-character"></a>

## Limitar un script a un personaje

Un script puede pertenecer a personajes concretos en lugar de ejecutarse en todas partes. Hay dos maneras.

- En el editor, activa **Specific Characters** (Personajes específicos) en la tarjeta **Apply To** y elige uno o más personajes. Con el interruptor desactivado, el script "Applies to all characters" (se aplica a todos los personajes). Elige al menos un personaje cuando esté activado.
- En el personaje: abre el personaje, ve a la pestaña **Advanced** (Avanzado) y busca la tarjeta **Regex Scripts**. Lista solo los scripts de ese personaje y tiene sus propios botones **Create regex**, importar y exportar. Guarda primero el personaje, o la tarjeta dice que todavía no puede añadir scripts.

Abrir el editor completo desde esta tarjeta te saca del Character Editor (Editor de personajes). Si el personaje tiene cambios sin guardar, la app te avisa primero.

<a id="the-per-chat-scoped-regex-scripts-setting"></a>

### El ajuste por chat Scoped Regex Scripts

Los scripts limitados a un personaje no se ejecutan por sí solos en todos los chats. Un ajuste por chat los controla. Abre **Chat Settings** (Ajustes del chat). La sección **Scoped Regex Scripts** (Scripts de regex limitados) aparece solo cuando al menos un personaje de ese chat tiene scripts limitados.

| Modo | Qué ocurre |
| --- | --- |
| **Disabled** (Desactivado, el predeterminado) | Los scripts limitados están desactivados. Solo se ejecutan los scripts globales. |
| **Exclusive** (Exclusivo) | Cada script limitado cambia solo los mensajes de su propio personaje. |
| **Chat** | Cada script limitado cambia todos los mensajes del chat. |

**Use preset default** (Usar el valor predeterminado del preset) sigue el **Scoped regex default** (Valor predeterminado de los regex limitados) del preset de prompt. Elegir un modo lo anula para este chat. Para que los chats nuevos empiecen con un modo, usa una de estas opciones:

- Establécelo como valor predeterminado del preset.
- Guárdalo en tu [perfil de ajustes predeterminado](../chats/settings-profiles.md#choosing-the-default-profile).
- Elígelo y luego haz clic en la estrella del diseño favorito junto a **Reset View** (Restablecer vista). Consulta [Elegir un diseño para chats nuevos](../chats/chat-settings.md#choosing-a-layout-for-new-chats).

Debajo de los modos, el panel lista los scripts limitados de cada personaje con un interruptor para cada uno. Ese interruptor es propio del script, así que cambia el script en todos los chats. El modo controla los scripts del lado de la pantalla. Los scripts de prompt siempre siguen al personaje que está generando la respuesta.

## Importar y reemplazar scripts

### Importar desde SillyTavern

Marinara lee los scripts de regex incluidos en una tarjeta de personaje de SillyTavern. Cuando importas una tarjeta, una sección **Imported regex scripts** (Scripts de regex importados) ofrece dos opciones:

- **Character only** (Solo personaje, el predeterminado): los scripts quedan limitados a ese personaje.
- **Global**: los scripts se añaden a **Presets** y se ejecutan en todos los chats.

La opción aparece en la ventana de importación de un solo personaje y en la importación masiva **Import from SillyTavern Folder** (Importar desde carpeta de SillyTavern). Se omiten los scripts con un patrón vacío o con uno que falla la comprobación de seguridad. Para importar un archivo JSON simple de scripts, usa **Import regexes from JSON** en **Regexes**. Consulta [Importar desde SillyTavern](../data/importing-from-sillytavern.md).

### Reemplazar un paquete de regex

1. En **Presets → Regexes** (Presets → Regex), elige **Select regex scripts** (Seleccionar scripts regex).
2. Marca las entradas del paquete anterior, o elige **Select all regex scripts** (Seleccionar todos los scripts regex).
3. Usa **Export** (Exportar) o **Delete** (Eliminar) en la barra de acciones. La eliminación pide una sola confirmación y no se puede deshacer.
4. Importa el paquete actualizado.

Las eliminaciones que fallen siguen seleccionadas para que puedas reintentarlas. Los scripts no seleccionados se quedan donde están. Las asignaciones a presets siguen disponibles en el editor de regex.

<a id="safety-and-performance"></a>

## Seguridad y rendimiento

Cada patrón se comprueba antes de poder guardarse o ejecutarse. Un patrón que probablemente se ejecute despacio y cuelgue la app se bloquea con este mensaje, y el guardado se detiene hasta que lo corrijas:

```text
Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns.
```

Si ves este mensaje, haz el patrón más corto y más simple. Evita estas formas:

- Patrones de más de 1000 caracteres.
- Un grupo que se repite dentro de otro grupo que se repite, como `(a+)+`.
- Dos comodines amplios seguidos, como `.*.*` o `\s*\w*`. Un comodín amplio es un token como `.*`, `\s*` o `\w+` que puede coincidir con una cantidad ilimitada de texto.
- Tres o más comodines amplios en cualquier parte de un patrón, incluso con otro texto entre ellos.

Una sola repetición como `a+` o `(a+)`, o un solo comodín amplio como un único `.*`, está bien.

Incluso un patrón seguro tiene un tiempo límite por reemplazo en un mensaje largo. Si un script tarda demasiado en un mensaje, la app omite ese script solo para ese mensaje. El script sigue activado y lo intenta de nuevo en el siguiente mensaje. Prueba primero un patrón nuevo en **Live Test** con un texto de ejemplo corto.

## Guías relacionadas

- [Macros](../prompts/macros.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
- [Importar desde SillyTavern](../data/importing-from-sillytavern.md)
