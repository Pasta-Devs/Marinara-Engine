# Cómo gestionar tu lista de chats

Esta guía trata sobre la lista de chats en Marinara Engine. Explica las tres pestañas de modo y cómo crear, importar, renombrar, eliminar, organizar, buscar y gestionar en lote tus chats. También trata sobre la fila de chats recientes en la pantalla de inicio.

## La lista de chats y las pestañas de modo

Tus chats viven en el panel **Chats**, la barra lateral de la izquierda. En la parte superior del panel hay tres pestañas de modo:

- **CONVO** para Conversation (Conversación), un chat sencillo estilo mensajería.
- **RP** para Roleplay, una escena inmersiva con personajes y seguimiento del mundo.
- **GM** para Game (Juego), un RPG para un solo jugador dirigido por la IA.

Cada pestaña muestra solo los chats de ese modo. Al hacer clic en una pestaña se cambia la lista.

Cada fila de la lista muestra el nombre del chat y el avatar de su personaje o personajes. En los chats de Conversation, un pequeño punto de color sobre el avatar muestra el estado de cada personaje. Si aparece una insignia roja en una fila, ese es el número de mensajes sin leer.

Algunas filas muestran un pequeño icono de rama con un número. Esto significa que el chat tiene más de una rama, y las ramas se agrupan en una sola fila. Para saber qué son las ramas, consulta [Ramas de chat](branches.md).

## Cómo crear un chat nuevo

1. Elige la pestaña de modo que quieras (**CONVO**, **RP** o **GM**).
2. Haz clic en el botón **+** cerca de la parte superior del panel. Su tooltip (texto de ayuda) dice **New Conversation**, **New Roleplay** o **New Game**, según la pestaña activa.
3. La app crea el chat, lo abre y abre el panel **Chat Settings** (Ajustes del chat) junto con un asistente de configuración para que puedas terminar la configuración.

El nuevo chat se llama **New Conversation**, **New Roleplay** o **New Game**. Puedes renombrarlo más tarde (consulta Cómo renombrar un chat más abajo).

Necesitas al menos una conexión antes de que se abra un chat. Una conexión enlaza Marinara con un proveedor de IA. Si aún no tienes ninguna conexión, aparece una ventana **Set Up** (Configurar) en lugar del chat. Te pide que elijas primero una conexión. Si no tienes ninguna en absoluto, muestra **No connections found** (No se encontraron conexiones) con un botón **Open Connections** (Abrir conexiones). Para configurar una, consulta [Cómo conectarte a un proveedor de IA](../connections/connecting-to-a-provider.md).

Si guardaste un perfil de ajustes predeterminado con estrella para ese modo, Marinara lo aplica al chat nuevo automáticamente. Consulta [Descripción general de Chat Settings](chat-settings.md).

## Cómo importar un chat

Puedes importar un registro de chat guardado como archivo `.jsonl`, desde SillyTavern o desde Marinara.

1. Elige la pestaña de modo en la que quieres que aterrice el chat importado.
2. Haz clic en el botón **Import** (Importar) cerca de la parte superior del panel. Su tooltip dice **Import SillyTavern or Marinara chat JSONL**.
3. Elige tu archivo `.jsonl`.

Marinara crea un chat nuevo en el modo de la pestaña actual y lo abre. Deberías ver un mensaje que dice **Imported N messages**, donde N es el número de mensajes.

Para conocer todas las formas de importar y exportar chats, incluidos los formatos de importación y exportación en lote, consulta [Cómo exportar e importar chats](export-import.md).

## Cómo renombrar un chat

El nombre del chat solo lo ves tú. No se envía a la IA y no cambia la conversación.

1. Abre el chat.
2. Abre el panel **Chat Settings** con el botón de engranaje de la barra de herramientas del chat.
3. En la sección **Chat Name** (Nombre del chat), haz clic en el nombre actual para convertirlo en un campo de texto.
4. Escribe el nombre nuevo, luego pulsa Enter o haz clic en el botón de marca de verificación.

Para más información sobre el panel Chat Settings, consulta [Descripción general de Chat Settings](chat-settings.md).

## Cómo eliminar un chat

Para eliminar un solo chat, pasa el cursor sobre su fila y haz clic en el botón de papelera. En el teléfono, el botón de papelera se muestra siempre. Una ventana titulada **Delete Chat** (Eliminar chat) pregunta "Delete this chat?". Haz clic en **Delete** para confirmar.

Eliminar un chat es permanente. También detiene cualquier respuesta que aún se esté generando para ese chat.

### La ventana de elección de rama

Si el chat que eliminas tiene más de una rama, se abre una ventana distinta en su lugar. Se titula **Delete Chat** y dice que la conversación tiene varias ramas. Te da dos opciones:

- **Delete This Branch Only** (Eliminar solo esta rama) quita únicamente la rama en la que hiciste clic.
- **Delete All N Branches** (Eliminar todas las N ramas) quita cada rama del grupo, donde N es el número de ramas.

Para gestionar ramas sin eliminar el chat completo, consulta [Ramas de chat](branches.md).

### Cómo activar o desactivar las confirmaciones de eliminación

Una opción de toda la app llamada **Confirm before deleting** (Confirmar antes de eliminar) controla si aparecen estas ventanas de confirmación. Está activada de forma predeterminada y se encuentra en **Settings** (Configuración) bajo la pestaña **General**. Su propio texto de ayuda recomienda mantenerla activada.

## Carpetas de chat

Puedes agrupar chats en carpetas dentro de cada pestaña de modo.

1. Asegúrate de que la pestaña actual tenga al menos un chat. El botón **New Folder** (Nueva carpeta) aparece sobre la lista solo entonces.
2. Haz clic en **New Folder**. La carpeta se crea con el nombre **unnamed** (sin nombre) (o **unnamed 2**, **unnamed 3**, y así sucesivamente si ese nombre ya está tomado).

Para renombrar una carpeta, haz doble clic en ella, doble toque sobre ella, o selecciónala y pulsa F2. Renombrar a un nombre vacío se ignora.

Para eliminar una carpeta, haz clic en el botón de papelera de la fila de la carpeta. Una ventana titulada **Delete Folder** (Eliminar carpeta) lo confirma. Eliminar una carpeta nunca elimina los chats que hay dentro. Esos chats vuelven al nivel superior.

Para reordenar las carpetas, arrástralas hacia arriba o hacia abajo por el asa de agarre.

Para mover un chat a una carpeta, arrastra su fila sobre la carpeta. Para sacar un chat de todas las carpetas, arrástralo al área vacía debajo de las carpetas. En una pantalla táctil, mantén pulsado un chat durante medio segundo aproximadamente para empezar a arrastrarlo. Si tienes varios chats seleccionados, arrastrar uno de ellos mueve toda la selección.

Los chats que no están en ninguna carpeta aparecen en una lista sencilla debajo de las carpetas.

## Cómo buscar, ordenar y filtrar por etiqueta

Cada pestaña de modo tiene su propio cuadro de búsqueda en la parte superior de la lista. El texto de marcador de posición cambia según la pestaña: **Search conversations...**, **Search roleplays...** o **Search games...**. La búsqueda coincide con el nombre del chat, sus etiquetas y los nombres de sus personajes. No busca dentro del texto de los mensajes.

Junto al cuadro de búsqueda hay un menú de orden con el tooltip **Sort chats**. Tiene cuatro opciones:

- **Newest** (Más nuevos), la opción predeterminada, muestra primero los chats con actividad más reciente.
- **Oldest** (Más antiguos) muestra primero los de actividad menos reciente.
- **A-Z** ordena por nombre de la A a la Z.
- **Z-A** ordena por nombre de la Z a la A.

Si algún chat de la pestaña tiene etiquetas, aparece una fila de filtro por etiqueta. Haz clic en el chip **Tags** (Etiquetas) para desplegar la lista de etiquetas. Luego haz clic en una etiqueta para mostrar solo los chats que la llevan. Haz clic en **Clear** (Limpiar) para quitar el filtro. Cuando hay muchas etiquetas, un chip **+N more** (+N más) revela el resto.

Nota: esta pantalla solo filtra por etiquetas que un chat ya tiene. Aquí no hay ningún botón para añadir una etiqueta a un chat.

La lista muestra hasta 100 chats a la vez. Si tienes más, aparece un botón **Load more** (Cargar más) en la parte inferior para revelar el siguiente lote.

## Cómo seleccionar varios chats

Puedes actuar sobre varios chats a la vez.

1. Haz clic en el botón **Select chats** (Seleccionar chats) cerca de la parte superior del panel (el icono de marca de verificación).
2. Haz clic en cada chat que quieras. En lugar de abrir el chat, se activa una casilla en cada fila seleccionada.
3. Una barra en la parte inferior muestra cuántos chats están seleccionados, con dos botones.

El botón **Export** (Exportar) descarga todos los chats seleccionados juntos como un solo archivo `.zip`. El botón **Delete** los elimina. Delete muestra primero una confirmación titulada **Delete Chats** (Eliminar chats).

Para salir del modo de selección sin actuar, haz clic de nuevo en el botón de selección. Cambiar de pestaña también borra la selección.

## Chats recientes en la pantalla de inicio

La pantalla de inicio muestra una fila compacta **Recent Chats** (Chats recientes) con tus tres chats de actividad más reciente. Cada chat aparece como un pequeño chip con un avatar, una insignia de modo y el nombre del chat. Haz clic en un chip para abrir ese chat. Si aún no tienes chats, la fila dice **No chats yet** (Aún no hay chats).

## Guías relacionadas

- [Ramas de chat](branches.md)
- [Cómo exportar e importar chats](export-import.md)
- [Descripción general de Chat Settings](chat-settings.md)
- [Cómo conectarte a un proveedor de IA](../connections/connecting-to-a-provider.md)
