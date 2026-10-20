# Organiza tu biblioteca de personajes

Esta guía cubre el **Characters panel** (panel de personajes), la barra lateral donde viven todos tus personajes. Aprenderás a buscar, ordenar, agrupar personajes en carpetas, marcar favoritos, filtrar por etiquetas y exportar o eliminar muchos personajes a la vez.

## El Characters panel

El **Characters panel** es la lista de personajes del panel lateral. Contiene cada personaje que has creado o importado. Desde la parte superior del panel puedes:

- Haz clic en **Download** (Descargar) para abrir el [Card Browser](bot-browser.md) y encontrar personajes en sitios públicos.
- Haz clic en **Open Library** (Abrir biblioteca) para abrir una vista de cuadrícula más grande, a página completa, con los mismos personajes.
- Haz clic en el botón **New** (el icono de más) para abrir la ventana **Create Character**.
- Haz clic en el botón **Import** (el icono de descarga) para importar un archivo de personaje.
- Haz clic en el botón **Select** (el icono de marca de verificación) para activar el modo de selección múltiple y hacer acciones en lote.

La biblioteca completa usa el color de texto chroma seleccionado en **Settings** (Configuración), y conserva la tarjeta seleccionada, el orden y la posición de desplazamiento cuando abres un personaje para editarlo y vuelves.

Cada fila de personaje muestra el avatar, el nombre, una línea de título opcional, el creador y la versión, hasta 3 etiquetas y una estimación aproximada de tokens (fragmentos de texto). Una pequeña insignia de estrella marca un favorito. Cuando pasas el cursor por una fila, aparecen un botón **Duplicate** y un botón **Delete**.

Si tienes muchos personajes, aparece un botón **Load more** en la parte inferior. Haz clic en él para cargar la siguiente página de personajes.

## Búsqueda

Escribe en el cuadro de búsqueda de la parte superior del panel para filtrar la lista. El texto de marcador de posición dice **Search characters or -tag:"tag name"** (Busca personajes o -tag:"nombre de etiqueta").

El texto simple coincide con el nombre, el título, la descripción y las etiquetas de un personaje. Por ejemplo, si escribes `knight` se muestran todos los personajes con "knight" en cualquiera de esos campos.

También puedes excluir personajes que tengan cierta etiqueta. Pon un signo menos delante de la etiqueta:

```
-tag:"tag name"
```

Algunas cosas que conviene saber sobre la exclusión de etiquetas:

- Usa comillas cuando la etiqueta tenga un espacio, como `-tag:"slow burn"`.
- Para una etiqueta de una sola palabra puedes omitir las comillas, como `-vampire`.
- Excluir una etiqueta oculta cada personaje que lleve esa etiqueta, aunque el resto de tu texto de búsqueda coincida con ellos.

Puedes combinar texto simple y exclusión en el mismo cuadro. Por ejemplo, `mage -tag:"villain"` encuentra personajes que coinciden con "mage" mientras oculta cualquiera etiquetado como "villain".

## Ordenar

Junto al cuadro de búsqueda está el menú desplegable de orden. Elige uno de estos órdenes:

| Opción        | Qué hace                              |
| ------------- | ------------------------------------- |
| **Manual order** (Orden manual) | El orden que fijas tú mismo. |
| **A-Z**       | Nombres de la A a la Z.               |
| **Z-A**       | Nombres de la Z a la A.               |
| **Newest**    | Primero los creados más recientemente.|
| **Oldest**    | Primero los creados más antiguos.     |
| **Favorites** | Primero los favoritos, luego el resto.|

Para fijar un orden manual, arrastra la fila de un personaje hacia arriba o hacia abajo. También puedes pulsar Alt+Arriba o Alt+Abajo en una fila con el foco. Cualquiera de las dos cosas cambia el orden a **Manual order**.

## Carpetas

Las carpetas te permiten agrupar personajes relacionados dentro del panel. Son opcionales. Siempre puedes mantener cada personaje en una sola lista plana si lo prefieres.

Para crear una carpeta:

1. Haz clic en el botón **New Folder**.
2. Aparece una carpeta nueva, llamada **unnamed** de forma predeterminada.
3. Renómbrala de inmediato o más tarde (ver abajo).

Para renombrar una carpeta, haz doble clic en ella, tócala dos veces, o selecciónala y pulsa la tecla F2. Escribe el nuevo nombre y pulsa Enter.

Para poner un personaje en una carpeta, arrastra la fila del personaje y suéltala sobre la carpeta. Una línea de ayuda dice **Drag and drop characters to folders, double-click or double-tap to rename** (Arrastra y suelta personajes en carpetas, haz doble clic o toca dos veces para renombrar) una vez que tienes al menos una carpeta. Para sacar un personaje de nuevo, pasa el cursor por su fila dentro de la carpeta y haz clic en el botón de quitar de la carpeta, o arrástralo fuera.

En una pantalla táctil, mantén pulsada una fila para tomarla y luego arrástrala. Deslizar el dedo con normalidad sigue desplazando la lista. Mientras sostienes una fila, toca otras filas con un segundo dedo para llevarlas también como una pila, y luego suelta la pila sobre una carpeta.

Haz clic en una carpeta para expandirla o contraerla. El número junto al nombre de una carpeta es cuántos personajes hay dentro de ella.

Para eliminar una carpeta, pasa el cursor por la carpeta y haz clic en su botón de papelera. Si la carpeta tiene personajes dentro, verás un mensaje de confirmación: **Delete "name"? Its N characters will stay in the library and move out of the folder.** (¿Eliminar "nombre"? Sus N personajes permanecerán en la biblioteca y saldrán de la carpeta). Una carpeta vacía se elimina de inmediato, sin mensaje de confirmación. Eliminar una carpeta nunca elimina los personajes que hay dentro. Simplemente vuelven a la lista principal.

## Favoritos y chips de etiqueta

### Favoritos

Marcar un personaje como favorito facilita encontrarlo más tarde. La estrella de favorito se activa dentro del personaje mismo, no desde la lista del panel. Abre un personaje y haz clic en su estrella **Favorite** para activarla o desactivarla. Los personajes marcados como favoritos muestran una pequeña insignia de estrella en su avatar dentro del panel.

Debajo del área de búsqueda hay tres botones de filtro:

- **All** muestra todos los personajes.
- **Favs** muestra solo tus favoritos.
- **Non-favs** muestra solo los personajes que no son favoritos.

También puedes elegir **Favorites** en el menú desplegable de orden para flotar todos los favoritos a la parte superior de la lista.

### Etiquetas

Las etiquetas son marcas que añades a un personaje para describirlo, como `fantasy` o `slow burn`. Añades y editas las etiquetas de un personaje dentro del editor de personajes.

En el panel, cada fila de personaje muestra hasta 3 de sus etiquetas. Haz clic en un chip de etiqueta de cualquier fila para filtrar la lista y dejar solo los personajes que comparten esa etiqueta.

Cuando tus personajes tienen etiquetas, aparece un botón **Tags** en la fila de filtros, con el número total de etiquetas entre paréntesis (por ejemplo, **Tags (12)**). Haz clic en él para expandir la lista completa de etiquetas:

- Haz clic en una etiqueta de la lista expandida para incluirla como filtro. Al hacer clic en más de una etiqueta, coinciden los personajes que tienen cualquiera de las etiquetas seleccionadas.
- Cada etiqueta de la lista expandida tiene una pequeña X. Al hacer clic en ella, se elimina esa etiqueta de cada personaje que la tenga. Se te pedirá que confirmes: **Remove tag "name" from all characters?** (¿Quitar la etiqueta "nombre" de todos los personajes?).
- Aparece un botón **Clear** una vez que hay un filtro de etiqueta activo. Haz clic en él para limpiar tus filtros de etiqueta.

Para excluir una etiqueta en lugar de incluirla, usa la sintaxis de búsqueda `-tag:` descrita más arriba en la sección Búsqueda.

## Selección, exportación y eliminación en lote

Cuando quieras actuar sobre varios personajes a la vez, usa el modo de selección.

1. Haz clic en el botón **Select** en la parte superior del panel.
2. Aparece una casilla en cada fila de personaje.
3. Haz clic en los personajes que quieras incluir. El encabezado del panel muestra cuántos están seleccionados.
4. Usa la barra de acciones de la parte inferior del panel.

La barra de acciones tiene dos botones:

- **Export** descarga todos los personajes seleccionados juntos en un solo archivo zip llamado `marinara-characters.zip`. Esta es una exportación en lote en el propio formato nativo de Marinara Engine.
- **Delete** elimina todos los personajes seleccionados. Se te pedirá que confirmes primero: **Delete N characters?** (¿Eliminar N personajes?).

Mientras estás en el modo de selección, también puedes arrastrar tus personajes seleccionados a una carpeta todos a la vez, en lugar de moverlos uno por uno.

Para la lista completa de formatos de archivo de importación y exportación, consulta la guía de abajo sobre importar y exportar.

## Las carpetas sirven también como listas para chats grupales

Las carpetas que construyes aquí tienen un segundo uso. Cada carpeta es también una lista guardada que puedes agregar a un chat grupal.

Cuando configuras un chat con más de un personaje, busca la opción **Add from Folder**. Añade cada personaje de una carpeta elegida en un solo paso. Esta es la forma más rápida de iniciar un chat grupal con un conjunto de personajes que usas juntos a menudo. Para saber cómo funcionan los chats grupales, consulta la guía de chats grupales de abajo.

## Guías relacionadas

- [Importar y exportar tarjetas de personaje](import-export.md)
- [Crear y editar personajes](creating-and-editing-characters.md)
- [Chats grupales y conversaciones grupales](../chats/group-chats.md)
