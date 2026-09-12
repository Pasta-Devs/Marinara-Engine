# Importar y exportar tarjetas de personaje

Esta guía muestra cómo importar tarjetas de personaje a Marinara Engine y exportar tus propios personajes. Cubre los tipos de archivo que Marinara acepta, las opciones de la ventana de importación y los tres formatos de exportación.

Una tarjeta de personaje es un solo archivo que contiene un personaje: su nombre, descripción, personalidad, saludos iniciales y a menudo una imagen de avatar. Las tarjetas te permiten mover un personaje entre Marinara y otras apps de roleplay.

## Formatos de importación

La ventana **Import Character** (Importar personaje) acepta cuatro tipos de archivo. Puedes soltar varios archivos a la vez, y pueden ser de tipos distintos.

| Tipo de archivo | Qué es |
| --- | --- |
| **.json** | Una tarjeta de personaje sencilla en formato de texto (Chara Card V2). |
| **.png** | Una imagen de tarjeta de personaje con los datos de la tarjeta ocultos dentro de la imagen. |
| **.charx** | Un paquete Character Card V3 (CharX), el formato basado en zip que usa RisuAI. |
| **.marinara** | Una exportación nativa de Marinara (también aparece como `.marinara.json`). |

Un archivo **.marinara** conserva el mayor detalle, porque es el formato propio de Marinara. Los otros tres vienen de SillyTavern, Chub, Risu y herramientas similares.

## Importar un personaje

Sigue estos pasos para llevar una o más tarjetas a tu biblioteca.

1. Abre el panel **Characters** (Personajes).
2. Haz clic en el botón **Import** (Importar) de la barra de herramientas. Es un botón de icono con una flecha de descarga. Se abre la ventana **Import Character**.
3. Arrastra tus archivos a la ventana, o haz clic en ella para buscar. Deberías ver "Drop one or more files here or click to browse" (Suelta uno o más archivos aquí o haz clic para buscar).
4. Configura las dos opciones de importación (descritas abajo). Se aplican a cada archivo de este lote.
5. Espera la lista de resultados. Cada archivo muestra una marca verde con "Imported" (Importado) y el nombre, o una marca roja con un error.

### Elegir qué etiquetas conservar

La opción **Imported card tags** (Etiquetas de la tarjeta importada) decide qué pasa con las etiquetas de la tarjeta entrante. Esto se llama modo de importación de etiquetas. Tienes tres opciones:

- **All tags** (Todas las etiquetas): conserva cada etiqueta de la tarjeta de origen. Esta es la opción predeterminada.
- **No tags** (Sin etiquetas): omite las etiquetas de origen.
- **Existing only** (Solo las existentes): conserva solo las etiquetas que ya existen en tu biblioteca.

### Elegir a dónde van los scripts de regex

Algunas tarjetas incluyen scripts de regex, pequeñas reglas de reemplazo de texto. La opción **Imported regex scripts** (Scripts de regex importados) controla su alcance:

- **Character only** (Solo el personaje): los scripts se ejecutan solo para este personaje. Esta es la opción predeterminada.
- **Global**: los scripts se añaden a **Presets**, en la sección **Regexes**, y se ejecutan en cada chat.

Elige **Character only** a menos que sepas que quieres las reglas en todas partes.

### Tarjetas con un lorebook integrado

Un lorebook (libro de trasfondo) es un conjunto de datos de fondo que la IA puede consultar durante un chat. Si una tarjeta que estás importando tiene un lorebook integrado, la importación se detiene y muestra un panel **Embedded lorebook found** (Lorebook integrado encontrado). Enumera cada archivo y cuántas entradas contiene. Elige una opción para todo el lote:

- **Import Lorebook** (Importar lorebook): crea también un lorebook independiente de Marinara vinculado al personaje.
- **No Import** (No importar): conserva el lorebook solo dentro de la tarjeta.

### Importar muchas tarjetas a la vez

La misma ventana **Import Character** gestiona las importaciones por lotes. Selecciona varios archivos, y Marinara los importa uno tras otro. La lista de resultados tiene una fila por archivo, para que veas qué tarjetas funcionaron y cuáles fallaron.

## Exportar un personaje

Abre un personaje en el editor, luego haz clic en **Export character** (Exportar personaje) en la barra de herramientas superior. La ventana **Export Character** ofrece tres formatos.

| Formato | Qué obtienes | Ideal para |
| --- | --- | --- |
| **Marinara Native** | Un archivo `.marinara.json` que conserva los metadatos de Marinara, los sprites, las imágenes de la galería y los lorebooks adjuntos. | Mover un personaje entre instalaciones de Marinara con todo el detalle. |
| **Compatible JSON** | JSON Chara Card V2 sencillo, sin envoltorio de Marinara. | Compartir con otras apps que leen tarjetas JSON. |
| **Compatible PNG Card** | Una imagen Chara Card V2 con los datos de la tarjeta incrustados en la imagen. | Apps y sitios que esperan una tarjeta PNG, como SillyTavern, Chub y Risu. |

Elige **Marinara Native** cuando quieras conservar todo. Elige uno de los formatos **Compatible** cuando el archivo vaya a otra herramienta. Los dos formatos compatibles descartan los extras exclusivos de Marinara, como los sprites y las imágenes de la galería. Añaden los campos **Backstory** (historia previa) y **Appearance** (apariencia) que no estén vacíos a la Description estándar para que otros lectores de V2 conserven esa información de identidad. Esos campos se eliminan de las extensiones exportadas para evitar duplicados al reimportar. La tarjeta guardada no cambia; **Marinara Native** conserva los campos por separado.

## Exportar muchos personajes a la vez

Puedes exportar un lote de personajes como un único archivo zip.

1. Abre el panel **Characters**.
2. Haz clic en el botón **Select** (Seleccionar) de la barra de herramientas para entrar en el modo de selección. Es un botón de icono con una marca de verificación.
3. Marca los personajes que quieres.
4. Haz clic en **Export** (Exportar) en la barra de acciones de abajo. Marinara descarga un zip llamado `marinara-characters.zip`.

El zip contiene un archivo **Marinara Native** por personaje. No hay opción de PNG ni de JSON compatible para la exportación masiva, así que usa la exportación de un solo personaje cuando necesites esos formatos.

## Importar una carpeta completa de SillyTavern

Los pasos anteriores cubren las tarjetas que eliges a mano. Para mover una instalación entera de SillyTavern de una sola vez, usa el importador masivo de carpetas. Trae juntos los personajes, chats, presets y lorebooks. Está en **Settings** (Configuración), en la pestaña **Imports** (Importaciones). Consulta [Importar desde SillyTavern](../data/importing-from-sillytavern.md) para el recorrido completo.

## Guías relacionadas

- [Crear y editar personajes](creating-and-editing-characters.md)
- [Card Browser: buscar e importar personajes](bot-browser.md)
- [Importar desde SillyTavern](../data/importing-from-sillytavern.md)
