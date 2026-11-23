# Importar y exportar tarjetas de personaje

Una tarjeta de personaje es un archivo que contiene un personaje: nombre, descripción, personalidad, saludos y a menudo una imagen de avatar. Importa tarjetas para añadir personajes de otras apps y sitios. Exporta tus propios personajes para hacer una copia de seguridad o compartirlos.

## Importar un personaje

Antes de empezar: ten un archivo de tarjeta de personaje en tu dispositivo. Si prefieres buscar tarjetas en internet, consulta [Card Browser](bot-browser.md).

1. Haz clic en **Characters** (Personajes) en la barra de navegación superior. Si no lo ves, abre primero **More** (Más).
2. Haz clic en **Import** (Importar) en la barra de herramientas (el icono con una flecha de descarga). Se abre la ventana **Import Character** (Importar personaje).
3. Configura las opciones de importación de abajo. Se aplican a cada archivo de este lote.
4. Suelta tus archivos en la ventana, o tócala o haz clic en ella para abrir el selector de archivos de tu dispositivo. Puedes elegir varios archivos, y pueden ser de tipos distintos.
5. Espera la lista de resultados. Cada archivo muestra una marca verde, o una marca roja con un error. El texto es `Imported "Name"`, `Imported "Name" with its embedded lorebook` o `Imported "Name" without creating the embedded lorebook`.
6. Busca el nuevo personaje en **Characters**.

Marinara acepta cuatro tipos de archivo:

| Tipo de archivo | Qué es |
| --- | --- |
| **.json** | Una tarjeta guardada como texto. Las exportaciones de Marinara (`.marinara.json`) también son archivos .json. |
| **.png** | Una imagen de tarjeta con los datos de la tarjeta ocultos dentro de la imagen. |
| **.charx** | Un paquete de tarjeta guardado como archivo zip. |
| **.marinara** | Un archivo de exportación de Marinara. |

Una exportación de Marinara conserva el mayor detalle. Los otros tipos vienen de SillyTavern, Chub, Risu y herramientas similares.

Si no funcionó: lee el mensaje rojo junto al archivo. Los demás archivos del lote se importan igualmente.

<a id="import-options"></a>

### Opciones de importación

| Opción | Valores |
| --- | --- |
| **Imported card tags** (Etiquetas de la tarjeta importada) | **All tags** (Todas las etiquetas, predeterminado): conserva todas las etiquetas. |
| | **No tags** (Sin etiquetas): las omite. |
| | **Existing only** (Solo las existentes): conserva las etiquetas que ya están en tu biblioteca. |
| **Imported regex scripts** (Scripts de regex importados) | **Character only** (Solo el personaje, predeterminado): las reglas se ejecutan para este personaje. |
| | **Global**: las reglas van a **Presets → Regexes** y pueden ejecutarse en distintos chats. |
| **Split description into fields** (Dividir la descripción en campos) | Desactivado de forma predeterminada. Márcalo para sacar de **Description** (Descripción) el texto etiquetado de personalidad, apariencia y similares, y llevarlo a sus propios campos. |

Los scripts de regex son pequeñas reglas de reemplazo de texto. Mantén **Character only** a menos que quieras las reglas en todas partes. La división deja tal cual las tarjetas de narrador, de mundo y de varios personajes.

### Tarjetas con un lorebook integrado

Un lorebook (libro de trasfondo) es un conjunto de datos de fondo que la IA consulta durante un chat. Si una tarjeta tiene uno integrado, la importación se detiene y muestra **Embedded lorebook found** (Lorebook incrustado encontrado). Enumera cada archivo y cuántas entradas tiene. Elige una opción para todo el lote:

- **Import Lorebook** (Importar lorebook) también crea un lorebook independiente de Marinara vinculado al personaje.
- **No Import** (No importar) conserva el lorebook solo dentro de la tarjeta.

### Importar una carpeta completa de SillyTavern

Para mover una instalación entera de SillyTavern, usa el importador masivo de **Settings** (Configuración), en la pestaña **Imports** (Importaciones). Trae juntos los personajes, chats, presets y lorebooks. Consulta [Importar desde SillyTavern](../data/importing-from-sillytavern.md).

## Actualizar un personaje que ya tienes

Cuando quien creó una tarjeta publica una versión más reciente, puedes actualizar tu copia en lugar de agregar una segunda. El personaje conserva sus chats, memorias, galería, sprites, carpeta, estrella de favorito, colores y tus propias etiquetas. Primero se guarda su tarjeta actual en **Historial de versiones**, incluso con el control de versiones automático desactivado, para que puedas volver atrás.

### Desde la ventana de importación

1. Importa el archivo de la tarjeta más reciente como siempre (pasos de arriba).
2. Si parece un personaje que ya tienes, la importación se detiene en **Ya está en tu biblioteca**. Marinara encuentra coincidencias con una tarjeta descargada de la misma página del Card Browser, o con una que tenga el mismo nombre y creador. El motivo aparece debajo de cada opción.
3. Para cada tarjeta, elige una opción:
   - **Actualizar "Nombre"**: actualiza ese personaje en su lugar (la opción predeterminada).
   - **Actualizar otro personaje…**: elige cualquier personaje de una lista. Úsalo para una tarjeta que llegó por otra vía, por ejemplo de un sitio web a SillyTavern y luego a Marinara, de modo que su nombre o creador ya no coincide.
   - **Agregar como personaje nuevo**: conserva ambos.
   - **Omitir esta tarjeta**: la deja fuera.
4. Elige si quieres **Usar la imagen de la nueva tarjeta** y qué ocurre con **Notas del creador** (consulta abajo).
5. Haz clic en **Continuar**. Si la tarjeta tiene un lorebook integrado, el siguiente paso pregunta por él como siempre. El lorebook vinculado de un personaje actualizado se renueva con las entradas nuevas, en lugar de copiarse por segunda vez.
6. El resultado dice `Updated "Name". Its old card is in Version history.`

### Desde el editor de personajes

1. Abre el personaje y guarda primero cualquier cambio.
2. Haz clic en **⋯** junto a **Guardar** y elige **Actualizar desde un archivo de tarjeta…**.
3. Elige la tarjeta más reciente (.png, .json o .charx), revisa las opciones y haz clic en **Actualizar**.

Para un personaje descargado del [Card Browser](bot-browser.md), el mismo menú tiene **Buscar actualización**. Abre la página de esa tarjeta en el Card Browser, donde puedes comparar e importar la versión más reciente.

### Notas del creador

Notas del creador es el texto breve debajo de cada tarjeta en **Personajes**, y algunas personas guardan ahí CSS personalizado. Elige una opción:

| Opción | Qué ocurre |
| --- | --- |
| **Combinar: conservar las mías y agregar los cambios del autor** (predeterminado) | Tu texto y tu CSS se conservan. Las líneas que agregó quien creó la tarjeta van antes de tu primer bloque de estilos, y las que eliminó se quitan si no las habías cambiado. Si nunca editaste las notas, simplemente pasan a ser las de la tarjeta nueva. |
| **Usar las notas de la tarjeta** | Las notas de la tarjeta reemplazan las tuyas. |
| **Conservar las mías** | Tus notas se quedan exactamente como están. |

Las tarjetas importadas antes de esta función no recuerdan sus notas originales, así que la primera combinación solo agrega las líneas que aún no tienes.

### Deshacer una actualización

Abre el personaje, busca **Historial de versiones** en la pestaña **Metadatos** y restaura la versión anterior a la actualización. Consulta [Historial de versiones](creating-and-editing-characters.md#version-history).

## Exportar un personaje

1. Abre el personaje en el editor.
2. Haz clic en **…** y luego en **Export character** (Exportar personaje) en el encabezado. Se abre la ventana **Export Character**.
3. Elige un formato. Marinara descarga el archivo.

| Formato | Qué obtienes | Ideal para |
| --- | --- | --- |
| **Marinara Native** | Un archivo `.marinara.json` con los metadatos de Marinara, los sprites, las imágenes de la galería y los lorebooks adjuntos. | Mover un personaje entre instalaciones de Marinara con todo el detalle. |
| **Compatible JSON** | Un archivo de tarjeta sencillo que otras apps pueden leer. Descarta los extras exclusivos de Marinara, como los sprites y las imágenes de la galería. | Otras apps que leen tarjetas JSON. |
| **Compatible PNG Card** | Una imagen de tarjeta con los datos dentro de la imagen. Incluye tus sprites, pero no las imágenes de la galería. | Apps y sitios que esperan una tarjeta PNG, como SillyTavern, Chub y Risu. |

Los dos formatos **Compatible** añaden los campos **Backstory** (Trasfondo) y **Appearance** (Apariencia) que no estén vacíos a la **Description** estándar, para que otras apps conserven esa información. Tu tarjeta guardada no cambia.

El [onboarding interactivo](interactive-onboarding.md) de una tarjeta se conserva con **Marinara Native** y **Compatible PNG Card**, así que la tarjeta sigue haciendo sus preguntas cuando alguien la importa en Marinara. **Compatible JSON** lo omite.

## Exportar muchos personajes a la vez

1. Haz clic en **Characters** en la barra de navegación superior (o primero en **More**, si no aparece).
2. Haz clic en **Select** (Seleccionar) en la barra de herramientas (el icono de marca de verificación) y marca los personajes que quieres.
3. Haz clic en **Export** (Exportar) en la barra de abajo. Marinara descarga `marinara-characters.zip`.

El zip contiene un archivo **Marinara Native** por personaje. La exportación masiva no tiene opción de PNG ni de JSON. Para esos formatos, usa la exportación de un solo personaje. Para más formas de seleccionar personajes, consulta [Organizar tu biblioteca de personajes](library-organization.md#export-or-delete-many-characters).

## Guías relacionadas

- [Crear y editar personajes](creating-and-editing-characters.md)
- [Card Browser: buscar e importar personajes](bot-browser.md)
- [Importar desde SillyTavern](../data/importing-from-sillytavern.md)
