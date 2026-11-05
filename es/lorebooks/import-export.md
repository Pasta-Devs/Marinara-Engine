# Importar y exportar lorebooks

Importa lorebooks (libros de trasfondo) para traer datos del mundo desde archivos, y expórtalos para compartirlos o hacer una copia de seguridad. Esta guía cubre archivos individuales, muchos archivos a la vez y los cuatro formatos de exportación. Un lorebook es un conjunto de notas activadas por palabras clave que Marinara añade al prompt (las instrucciones enviadas a la IA) cuando aparece una palabra que coincide. Otras herramientas llaman a esta función World Info.

## Qué puedes importar

Marinara detecta el tipo de archivo por ti. Ambos tipos son archivos `.json`, y no necesitas una cuenta ni una API key (clave de API).

- Un lorebook exportado desde Marinara. Conserva todos los campos y todas las carpetas.
- Un archivo de World Info de otra herramienta, como el World Info de SillyTavern o el formato "character-book" de las tarjetas de personaje V2. Marinara asigna sus campos a los suyos propios.

## Importar un lorebook

1. Abre el panel **Lorebooks**.
2. Haz clic en el icono de la flecha de descarga de la fila superior, el del medio de los tres iconos. Su tooltip (texto de ayuda) es **Import** (Importar). El icono del signo más es **New** (Nuevo) y el de la marca de verificación es **Select** (Seleccionar).
3. En la ventana **Import Lorebook** (Importar lorebook), toca o haz clic en la caja que dice **Drop one or more lorebook files here or click to browse** (Suelta uno o más archivos de lorebook aquí o haz clic para explorar) y elige tus archivos `.json`. En una computadora también puedes soltar archivos sobre la caja. Puedes elegir varios a la vez y mezclar archivos de Marinara y de World Info.
4. Espera los resultados. Cada archivo muestra una marca de verificación verde con **Imported lorebook** (Lorebook importado), o una marca roja con un error. Con varios archivos, una línea de resumen muestra cuántos tuvieron éxito y cuántos fallaron.
5. Haz clic en **Close** (Cerrar). Los nuevos lorebooks están en el panel **Lorebooks**.

Marinara conserva la fecha propia del archivo como fecha de creación.

Si no funcionó: lee el error junto al archivo. Un archivo que no es un lorebook, o que está dañado, falla por sí solo mientras los demás archivos se importan.

## Después de importar

Un lorebook importado funciona con palabras clave de inmediato. Si usas la búsqueda semántica, vuelve a construir sus vectores. Consulta [Búsqueda semántica para lorebooks](semantic-search.md).

## Exportar un lorebook

1. En el panel **Lorebooks**, haz clic en un lorebook para abrirlo.
2. Haz clic en el icono de exportar del encabezado del editor, cerca de la esquina superior derecha. Su tooltip es **Export lorebook** (Exportar lorebook).
3. En la ventana **Export Lorebook**, elige un formato. Tu navegador descarga el archivo.

| Formato | Qué obtienes | Úsalo para |
| --- | --- | --- |
| **Marinara Native** | Todos los campos y carpetas de las entradas. El archivo termina en `.marinara.json`. | Mover un lorebook a otra instalación de Marinara. |
| **Compatible JSON** | Un archivo de World Info sin carpetas que termina en `.json`. Se descartan algunos detalles exclusivos de Marinara. | Otras herramientas de roleplay. |
| **Markdown** | Un encabezado `## Name` por entrada, con una línea `Keys:`. | Leer y editar en un editor de texto. |
| **CSV** | Una hoja de cálculo con las columnas name, keys, content, folder, enabled, constant y probability. | Editar muchas entradas en una hoja de cálculo. |

## Exportar muchos lorebooks a la vez

1. En el panel **Lorebooks**, haz clic en el icono de la marca de verificación (**Select**).
2. Marca cada lorebook que quieras.
3. Haz clic en **Export** (Exportar) en la barra de la parte inferior.

Tu navegador descarga `marinara-lorebooks.zip`. La exportación masiva siempre usa **Marinara Native**, así que todo vuelve cuando lo importas.

## Importar entradas desde Markdown o CSV

Puedes añadir entradas a un lorebook desde un archivo de texto Markdown o CSV, por ejemplo uno que editaste después de exportarlo.

1. Abre el lorebook y haz clic en **Import entries from Markdown or CSV** (Importar entradas desde Markdown o CSV) en el encabezado del editor.
2. En la ventana **Import entries** (Importar entradas), haz clic en **Choose file** (Elegir archivo), o pega texto en el cuadro.
3. Comprueba **Format** (Formato). Marinara lo deduce a partir del texto.
4. Lee la vista previa. En Markdown, usa un encabezado `## Name` por entrada, una línea opcional `Keys: a, b` y luego el texto. En CSV, usa una fila de encabezado con name, keys y content, y las columnas opcionales folder, enabled, constant y probability. La vista previa muestra cuántas entradas están listas y enumera los errores y las advertencias por línea.
5. En **Import into** (Importar en), elige **This lorebook** (Este lorebook) o **New lorebook** (Nuevo lorebook). Para uno nuevo, escribe un nombre en **New lorebook name** (Nombre del nuevo lorebook).
6. En **When an entry name already exists** (Cuando ya existe el nombre de una entrada), elige **Skip the imported entry** (Omitir la entrada importada), **Import as a renamed copy** (Importar como copia renombrada) u **Overwrite the existing entry** (Sobrescribir la entrada existente).
7. Haz clic en el botón **Import**, que muestra el número de entradas.

Un aviso te indica cuántas entradas se añadieron, se sobrescribieron y se omitieron.

Si no funcionó: el botón permanece desactivado cuando el archivo tiene un error que afecta a todo el archivo, como que falten columnas obligatorias, o cuando ninguna entrada es válida. Corrige las líneas que enumera la vista previa.

## Importar una carpeta completa de SillyTavern

Para importar desde una carpeta completa de SillyTavern, con personajes, chats y presets (ajustes guardados), consulta [Importar desde SillyTavern](../data/importing-from-sillytavern.md).

## Guías relacionadas

- [Resumen de lorebooks](overview.md)
- [Vincular lorebooks a personajes y personas](linking-to-characters.md)
- [Búsqueda semántica para lorebooks](semantic-search.md)
- [Importar desde SillyTavern](../data/importing-from-sillytavern.md)
