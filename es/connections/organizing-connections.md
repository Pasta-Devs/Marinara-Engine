# Organizar las conexiones

Esta guía explica cómo mantener ordenadas tus conexiones guardadas en Marinara Engine. Cubre las carpetas de conexiones, la búsqueda y el orden, cómo duplicar y borrar, el grupo aleatorio, el Quick Connection Switcher (cambiador rápido de conexión) y cómo exportar o importar conexiones. Una conexión es una configuración guardada que le dice a Marinara cómo llegar a un servicio de IA.

Todo esto lo haces en el panel **Connections** (Conexiones). Ábrelo y tus conexiones guardadas aparecen como una lista de filas. Cada fila muestra el nombre de la conexión y, debajo, su proveedor y su modelo.

## Carpetas de conexiones

Usa las carpetas de conexiones para agrupar conexiones relacionadas. Por ejemplo, pon todos tus modelos locales en una carpeta y todos tus proveedores de pago en otra.

Para crear una carpeta, sigue estos pasos:

1. Haz clic en el botón **New Folder** (Nueva carpeta) encima de la lista de conexiones.
2. Aparece una carpeta nueva llamada "unnamed".
3. Cámbiale el nombre de inmediato para poder distinguirla (ver abajo).

Para cambiar el nombre de una carpeta, haz doble clic en la fila de la carpeta o doble toque en una pantalla táctil. También puedes seleccionar la fila de la carpeta y pulsar la tecla **F2**. Escribe el nuevo nombre y pulsa Enter.

Para archivar una conexión en una carpeta, arrastra la fila de la conexión y suéltala sobre la carpeta. Para volver a sacar una conexión, arrástrala hacia el área debajo de las carpetas. Mientras arrastras aparece una pista que dice **Drop here to move out of folder** (Suelta aquí para sacar de la carpeta).

En una pantalla táctil, mantén pulsada una fila para tomarla y luego arrástrala. Deslizar el dedo con normalidad sigue desplazando la lista.

Para plegar o desplegar una carpeta, haz clic una vez en la fila de la carpeta. Un número pequeño en la fila de la carpeta muestra cuántas conexiones hay dentro.

Para borrar una carpeta, haz clic en el icono de papelera de la fila de la carpeta. Si la carpeta todavía tiene conexiones dentro, Marinara te pide confirmación con una ventana **Delete Folder** (Borrar carpeta). Una carpeta vacía se borra de inmediato, sin aviso de confirmación. Borrar una carpeta no borra las conexiones que hay dentro. Esas conexiones vuelven al área sin archivar.

## Búsqueda y orden

La casilla **Search connections** (Buscar conexiones) filtra la lista a medida que escribes. Busca coincidencias en el nombre de la conexión, el proveedor, el modelo, la URL base, el servicio de imagen o video y el modelo de embedding. Cuando no hay coincidencias, ves "No connections match your search" (Ninguna conexión coincide con tu búsqueda).

El menú desplegable **Sort order** (Orden) junto a la casilla de búsqueda cambia el orden de la lista. Tiene cinco opciones:

| Opción | Qué hace |
|---|---|
| **Custom** | Tu propio orden de arrastrar y soltar. |
| **A-Z** | Ordena por nombre, de la A a la Z. |
| **Z-A** | Ordena por nombre, de la Z a la A. |
| **Newest** | Las conexiones más nuevas primero. |
| **Oldest** | Las conexiones más antiguas primero. |

Para fijar un orden personalizado, arrastra las filas de conexión hacia arriba o hacia abajo. Arrastrar una conexión cambia el orden a **Custom** por ti de forma automática. También puedes mover una fila con el foco con Alt+Arriba o Alt+Abajo.

## Duplicar y borrar

Pasa el cursor sobre una fila de conexión (o mira la fila en una pantalla táctil) para ver sus botones de acción.

Para duplicar una conexión, haz clic en el botón **Duplicate** (Duplicar), el icono de copiar. Esto hace una copia completa, incluida la API key (clave de API) almacenada. La copia se abre en el editor para que puedas cambiarle el nombre. No hay paso de confirmación.

Para borrar una sola conexión, haz clic en su botón **Delete** (Borrar), el icono de papelera. Marinara muestra una ventana **Delete Connection** (Borrar conexión) que dice Delete "your connection name"? This cannot be undone. Haz clic en **Delete** para confirmar.

Para borrar o exportar varias conexiones a la vez, haz clic en el botón **Select** (Seleccionar) en la parte superior del panel. Esto activa el modo de selección. Toca las conexiones que quieras y luego usa el botón **Export** (Exportar) o **Delete** en la barra de acciones de abajo. El borrado en lote muestra una ventana **Delete Connections** (Borrar conexiones) antes de eliminarlas.

<a id="the-random-pool-and-quick-connection-switcher"></a>

<a id="the-random-pool-and-quick-connection-switcher"></a>

## El grupo aleatorio y el Quick Connection Switcher

El grupo aleatorio permite que un chat elija una conexión distinta cada vez que genera una respuesta. Esto es útil cuando quieres repartir las peticiones entre varios proveedores o modelos.

Para añadir una conexión al grupo aleatorio, haz clic en el icono de barajar de su fila. Su tooltip (texto de ayuda) dice **Add to random pool** (Añadir al grupo aleatorio). Una vez que la conexión está en el grupo, el tooltip cambia a **In random pool (click to remove)** (En el grupo aleatorio; haz clic para quitar). Haz clic de nuevo en el icono para sacar la conexión.

Para que un chat use el grupo aleatorio, abre **Chat Settings** (Ajustes del chat), busca la sección **Connection** (Conexión) y elige **🎲 Random** en el menú desplegable. En Game Mode este menú desplegable se llama **GM / Party Model**. Cada respuesta elige entonces una conexión al azar de tu grupo.

Si la conexión que eligió una respuesta falla y configuraste una conexión de respaldo para **Main** (Principal), la conexión de respaldo escribe la respuesta en su lugar. Un aviso nombra la conexión que falló, su modelo y un motivo breve, como "key rejected", "rate limited" o "not found", para que sepas qué conexión del grupo necesita arreglo. La respuesta conserva una pequeña etiqueta **Fallback** (Respaldo); tócala, o pasa el puntero sobre ella, para volver a ver esa misma línea.

El **Quick Connection Switcher** es una forma más rápida de cambiar la conexión, y su modelo, del chat en el que estás. Haz clic en el icono de enlace en el área de entrada del chat para abrirlo. Muestra tus conexiones a la izquierda y los **Models** (Modelos) de la conexión elegida a la derecha:

- Haz clic en una conexión para usarla en el chat actual de inmediato. El menú sigue abierto para que puedas elegir después uno de sus modelos.
- Haz clic en un modelo para usarlo. El modelo se guarda en esa conexión, la conexión se selecciona para el chat si todavía no lo estaba, y el menú se cierra. Una marca de verificación señala el modelo que usa ahora la conexión. Igual que en el editor de conexión, elegir un modelo de la lista también actualiza la ventana de contexto de la conexión, y su límite de salida, cuando el proveedor los indica.
- Escribe en el cuadro **Search or enter model ID…** (Buscar o escribir un ID de modelo) para filtrar la lista. Al pulsar Enter se elige el modelo cuyo ID o nombre escribiste, o el único modelo que queda en la lista. Para usar un modelo que no aparece en la lista, escribe su ID exacto: pulsa Enter cuando nada de la lista coincida con él, o haz clic en la fila **Use "…"**.
- Haz clic en la estrella junto a un modelo para fijarlo. Los modelos fijados se quedan arriba, bajo **Pinned** (Fijados), incluso los que escribiste a mano. Haz clic de nuevo en la estrella para dejar de fijarlo.
- La primera vez que abres los modelos de una conexión, Marinara carga la lista desde el proveedor y la guarda con la conexión, así que en las siguientes visitas aparece de inmediato. Haz clic en el botón de actualizar junto al cuadro de búsqueda para volver a cargar la lista, por ejemplo después de que el proveedor añada modelos nuevos. Cambiar la API key, la URL base o el proveedor de la conexión también carga una lista nueva.
- Si el proveedor no tiene lista de modelos o está inalcanzable, el menú lo indica, y aun así puedes escribir un ID de modelo.
- Haz clic en el botón de dados en la parte superior del menú para activar o desactivar el grupo aleatorio en este chat.
- Mientras el grupo aleatorio está activado, hacer clic en una conexión en vez de eso la añade al grupo o la quita de él. Una marca de verificación muestra qué conexiones están en el grupo. La columna **Models** se oculta, porque el grupo no tiene una única conexión.

En un teléfono, toca el chevron junto al cuadro de mensaje y abre la pestaña **Connections**. Toca una conexión para cambiar el chat a ella; el menú se cierra. Para elegir un modelo, toca en su lugar la flecha del extremo derecho de la fila de la conexión. Sus modelos se abren en el mismo menú, y el chat solo cambia cuando eliges uno. Toca la flecha hacia atrás para volver a la lista de conexiones.

**Un cambio de modelo se aplica en todos los lugares donde se usa la conexión.** La nota al pie del menú, "Model changes are saved to this connection." (Los cambios de modelo se guardan en esta conexión), significa que los agentes, las funciones auxiliares y los demás chats que usan la misma conexión también cambian al modelo nuevo. Los demás ajustes de modelo de la conexión, como su modelo de embedding o la conexión de descripción de imágenes, no cambian. Si quieres un modelo distinto solo para un uso concreto, duplica la conexión y cambia la copia.

## Exportar e importar conexiones

Puedes exportar conexiones a un archivo para hacer una copia de seguridad o pasarlas a otra instalación, y luego importarlas más tarde.

**Tus API keys nunca se incluyen en una exportación.** Después de importar conexiones, tienes que abrir cada una y volver a escribir su API key. Los modelos fijados sí se incluyen; la lista de modelos guardada no, así que se vuelve a cargar la primera vez que abres los modelos de la conexión.

Para exportar una sola conexión, ábrela en el editor y haz clic en su botón **Export** (Exportar), el icono de subir. Para exportar varias a la vez, usa el modo **Select** en el panel y haz clic en **Export** en la barra de acciones. Antes de que empiece la descarga, Marinara muestra una ventana **Export Connection Data** (Exportar datos de conexión) con esta advertencia: This will export your connection data, WITHOUT your provided API Key. Remember to never share those with others! Haz clic en **Export** para continuar.

Una sola conexión se descarga como un archivo `.connection.json`. Varias conexiones se descargan juntas como un archivo `marinara-connections.zip`.

Para importar conexiones, haz clic en el botón **Import** (Importar) en la parte superior del panel Connections. Se abre la ventana **Import Connections** (Importar conexiones). Suelta uno o más archivos `.json` sobre ella, o haz clic para buscarlos. La ventana te recuerda: Imported connections never include API keys. Add each key again after import. Después de importar, cada conexión nueva tiene una API key vacía hasta que la rellenas.

## Guías relacionadas

- [Conectarse a un proveedor de IA](connecting-to-a-provider.md)
- [Resumen de Chat Settings](../chats/chat-settings.md)
