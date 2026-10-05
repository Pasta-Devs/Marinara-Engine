# Ramas de chat

Esta guía explica las ramas de chat en Marinara Engine: qué es una rama y cómo crear una. También cubre cómo cambiar entre ramas, renombrarlas, eliminarlas, exportarlas e importarlas. Una rama te deja probar un camino distinto en un chat sin perder el original.

## Qué es una rama

Una rama es una copia de un chat que comparte el historial hasta un punto que tú eliges. Usas las ramas para explorar una dirección distinta mientras mantienes a salvo el chat original.

Todas las ramas del mismo chat se agrupan juntas. En la lista de chats, un chat con más de una rama aparece como una sola fila. Junto a él aparece un pequeño contador de ramas. Abres y cambias entre sus ramas desde la sección **Chat Branches** (Ramas de chat) de **Chat Settings** (ver más abajo).

Cada rama puede tener su propio nombre para mostrar, así puedes etiquetarlas como "final amistoso" y "final oscuro". Este nombre para mostrar es distinto del nombre del chat subyacente.

El linaje de una rama registra el chat de origen inmediato y el mensaje donde se creó la rama. Se conservan tanto el ID del mensaje de origen como el de su copia; así las integraciones pueden identificar el límite de la rama aunque los mensajes copiados reciban IDs nuevos. Si ramificas una rama, se registra esa rama como padre inmediato, no la raíz original. Las ramas antiguas y las hermanas importadas conservan su nombre para mostrar, pero no tienen un linaje conocido.

## Ramificar desde aquí

Creas una rama a partir de cualquier mensaje del chat.

1. Pasa el cursor sobre un mensaje (o tócalo en el teléfono) para mostrar la barra de acciones del mensaje.
2. Haz clic en el botón **Branch from here** (Ramificar desde aquí). Usa un pequeño icono de ramificación.

Marinara copia el chat hasta ese mensaje inclusive en una rama nueva. La rama nueva:

- Mantiene el mismo modo, personajes, persona, preset de prompt y conexión que el chat de origen.
- Copia todos los mensajes, incluidos todos los swipes (respuestas alternativas) y cuál swipe estaba activo. Consulta la [guía de Acciones de mensaje](messages.md) para saber cómo funcionan los swipes.
- Copia las instantáneas de estado del tracker y del estado del juego ligadas a los mensajes copiados, así los chats de Roleplay y de Game mantienen su estado.
- Empieza con el nombre para mostrar **New Branch** (Rama nueva). Puedes renombrarla (ver más abajo).
- Se queda en la misma carpeta de chats que el chat de origen.

Un chat vacío tiene anclajes de mensaje nulos. Eliminar un chat padre no cambia el linaje histórico de sus hijos. Eliminar todo el grupo de ramas sigue eliminando todos sus chats.

Los resúmenes diarios y semanales no se traspasan. Los resúmenes continuos con rangos de mensajes guardados completamente contenidos en la rama copiada se traspasan y se reasignan a los nuevos IDs de mensaje de la rama. Los resúmenes cuyo rango de origen cruza el punto de ramificación, o los resúmenes antiguos sin metadatos de mensajes, se omiten. La rama nueva empieza esos resúmenes desde cero.

No puedes ramificar un chat de escena. En un chat de escena, el botón **Branch from here** no aparece. Los chats de escena tienen en su lugar una acción **Clone from here** (Clonar desde aquí) aparte. Consulta [Escenas: Ramificar un Roleplay](../roleplay/scenes.md) para saber cómo funciona.

## La sección Chat Branches

Abre **Chat Settings** y despliega **Chat Branches**, debajo de **Chat Name**. El encabezado muestra el número actual de ramas. En una computadora puedes sacarla a una ventana propia; consulta [Vista general de Chat Settings](chat-settings.md#popping-a-section-out-into-its-own-window).

La sección lista todas las ramas del chat actual y muestra primero la que estás viendo. Cada fila muestra el nombre de la rama y la hora de su última actualización.

### Cambiar a otra rama

Haz clic en una fila para abrir esa rama. La vista del chat cambia a la rama que elegiste.

### Renombrar una rama

1. Abre la sección **Chat Branches**.
2. Haz clic en el botón del lápiz (renombrar) en la fila de la rama que quieres renombrar.
3. Se abre una ventana titulada **Rename Branch** (Renombrar rama) con el mensaje "Set a display name for this chat branch."
4. Escribe un nombre nuevo y confirma con el botón **Rename**.

Un nombre vacío, o un nombre que no cambiaste, se ignora.

### Eliminar una rama

1. Abre la sección **Chat Branches**.
2. Haz clic en el botón de la papelera (eliminar) en la fila de la rama.
3. Una ventana titulada **Delete Branch** (Eliminar rama) pregunta "Delete this branch? Messages will be lost."
4. Confirma con el botón **Delete**.

Eliminar una rama quita solo esa rama y sus mensajes. Las demás ramas se quedan.

### Eliminar todas las ramas

Cuando un chat tiene dos ramas o más, aparece un botón **Delete All Branches** (Eliminar todas las ramas) en la parte inferior de la sección. Pregunta "Delete all N branches? This cannot be undone." Confirma con el botón **Delete All** para quitar todas las ramas del grupo de una vez.

También puedes iniciar esto desde la lista de chats. Elimina un chat que tenga ramas desde su icono de papelera. Entonces una ventana titulada **Delete Chat** (Eliminar chat) pregunta qué quieres eliminar. Ofrece un botón **Delete This Branch Only** (Eliminar solo esta rama) y un botón **Delete All N Branches** (Eliminar las N ramas). Consulta [Gestionar tu lista de chats](managing-chats.md) para más información sobre eliminar desde la lista.

## Exportar una rama

La sección **Chat Branches** tiene botones de exportación en la parte superior. Exportan la rama que estás viendo en ese momento.

- **JSONL**: descarga la rama como un archivo JSONL. JSONL significa un mensaje por línea de texto, y este formato es compatible con SillyTavern.
- **Text**: descarga la rama como una transcripción de texto sin formato.

Para exportar en bloque muchos chats a la vez, consulta [Exportar e importar chats](export-import.md). Esa guía también cubre la opción de incluir el razonamiento del modelo en las exportaciones.

## Importar un archivo JSONL como rama nueva

Puedes traer un registro de chat guardado como una rama nueva del chat que tienes abierto.

1. Abre la sección **Chat Branches**.
2. Haz clic en el botón **Import** (Importar).
3. Elige un archivo JSONL (`.jsonl`) exportado desde SillyTavern o desde Marinara.

Marinara agrega el archivo como una rama nueva en el grupo del chat actual. Deberías ver un mensaje como "Imported N messages as a new branch". Luego la app cambia a la rama nueva.

## Guías relacionadas

- [Acciones de mensaje: Editar, Eliminar, Swipe, Regenerar](messages.md)
- [Exportar e importar chats](export-import.md)
- [Gestionar tu lista de chats](managing-chats.md)
