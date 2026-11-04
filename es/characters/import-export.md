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
| | **Global**: las reglas van a **Presets → Regexes** y se ejecutan en cada chat. |
| **Split description into fields** (Dividir la descripción en campos) | Desactivado de forma predeterminada. Márcalo para sacar de **Description** (Descripción) el texto etiquetado de personalidad, apariencia y similares, y llevarlo a sus propios campos. |

Los scripts de regex son pequeñas reglas de reemplazo de texto. Mantén **Character only** a menos que quieras las reglas en todas partes. La división deja tal cual las tarjetas de narrador, de mundo y de varios personajes.

### Tarjetas con un lorebook integrado

Un lorebook (libro de trasfondo) es un conjunto de datos de fondo que la IA consulta durante un chat. Si una tarjeta tiene uno integrado, la importación se detiene y muestra **Embedded lorebook found** (Lorebook incrustado encontrado). Enumera cada archivo y cuántas entradas tiene. Elige una opción para todo el lote:

- **Import Lorebook** (Importar lorebook) también crea un lorebook independiente de Marinara vinculado al personaje.
- **No Import** (No importar) conserva el lorebook solo dentro de la tarjeta.

### Importar una carpeta completa de SillyTavern

Para mover una instalación entera de SillyTavern, usa el importador masivo de **Settings** (Configuración), en la pestaña **Imports** (Importaciones). Trae juntos los personajes, chats, presets y lorebooks. Consulta [Importar desde SillyTavern](../data/importing-from-sillytavern.md).

## Exportar un personaje

1. Abre el personaje en el editor.
2. Haz clic en **Export character** (Exportar personaje) en el encabezado. Se abre la ventana **Export Character**.
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
