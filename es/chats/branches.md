# Ramas de chat

Una rama es una copia de un chat hasta un mensaje. Úsala para probar un camino distinto mientras el original sigue a salvo. Esta guía cubre cómo crear ramas, cambiar entre ellas, verlas, renombrarlas, eliminarlas, exportarlas e importarlas.

Todas las ramas de un chat se agrupan. En la lista de chats, el chat conserva una sola fila y muestra un contador de ramas. Cuando al menos una rama del grupo registra de qué chat se creó, haz clic en el contador para abrir el árbol; una rama sin ese registro aparece directamente debajo del chat. Si ninguna rama del grupo tiene ese registro (ramas antiguas o importadas), el grupo se queda en una sola fila; abre sus ramas desde **Chat Branches** (Ramas de chat). Una rama creada a partir de otra se anida debajo de ella, así que ves un árbol. Cada rama tiene un nombre para mostrar y una hora de última actividad, así que puedes etiquetarlas como "final amistoso" y "final oscuro". El nombre para mostrar es distinto del nombre del chat. Un grupo de Game conserva una sola fila, porque las sesiones de Game son sesiones numeradas, no ramas.

## Ramificar desde aquí

1. Toca el mensaje (en una computadora, pasa el cursor sobre él) para mostrar la barra de acciones del mensaje.
2. Haz clic en **Branch from here** (Ramificar desde aquí), el pequeño icono de ramificación.

Marinara copia el chat hasta ese mensaje inclusive en una rama nueva llamada **New Branch** (Rama nueva). Puedes renombrarla más tarde.

La rama:

- Mantiene el mismo modo, personajes, persona, preset de prompt y conexión.
- Copia todos los mensajes con todos sus swipes (respuestas alternativas) y cuál swipe estaba activo. Consulta [Acciones de mensaje](messages.md).
- Copia el estado del tracker y del juego ligado a los mensajes copiados.
- Conserva el trabajo de Advanced Memory en un chat de Roleplay. Las memorias de escenas anteriores ya terminadas siguen listas para recuperarse. La escena desde la que creas la rama vuelve a ser la escena en curso, y sus memorias anteriores se eliminan. Consulta [Memory Recall y resúmenes del chat](../agents/memory.md).
- Se queda en la misma carpeta de chats que el chat de origen.

Los resúmenes diarios y semanales no se traspasan. Los resúmenes continuos que quedan completamente dentro de los mensajes copiados sí se traspasan. Los resúmenes que cruzan el punto de ramificación, y los resúmenes antiguos sin datos de mensajes, se omiten, y la rama empieza esos resúmenes desde cero.

Si no funcionó: **Branch from here** no aparece en un chat de escena. Los chats de escena tienen **Clone from here** (Clonar desde aquí) en su lugar. Consulta [Escenas: ramificar un roleplay](../roleplay/scenes.md).

## La sección Chat Branches

Abre **Chat Settings** (Ajustes del chat) y despliega **Chat Branches**, debajo de **Chat Name** (Nombre del chat). Su encabezado muestra el número de ramas. En una computadora puedes sacarla a una ventana propia. Consulta [Descripción general de Chat Settings](chat-settings.md#popping-a-section-out-into-its-own-window).

La sección lista todas las ramas del chat y muestra primero la que estás viendo. Cada fila muestra el nombre para mostrar y la hora de la última actualización. Haz clic en una fila para cambiar a esa rama.

Botones encima de la lista:

| Botón | Qué hace |
| --- | --- |
| **Branch graph** (Gráfico de ramas) | Abre la ventana del gráfico. Ver más abajo. |
| **JSONL**, **Text**, **Markdown**, **Story** | Exportan la rama que estás viendo. Consulta [Exportar e importar chats](export-import.md). |
| **Export a range** (Exportar un intervalo) | Exporta parte del chat. No está en Game. Consulta [Exportar e importar chats](export-import.md#export-part-of-a-chat). |
| **Import** (Importar) | Añade un archivo `.jsonl` como una rama nueva. Ver más abajo. |
| **Stats** (Estadísticas) | Abre las estadísticas del chat de la rama que estás viendo. |

### Ver el gráfico de ramas

El gráfico muestra dónde se separó cada rama, algo que la lista no puede mostrar.

1. Abre **Chat Branches** y haz clic en **Branch graph**. Haz clic otra vez para cerrar el gráfico.

El gráfico se abre en una ventana propia que puedes mover y redimensionar. En un teléfono, se abre como un panel. Cada chat del grupo tiene una fila, en el mismo orden que la lista de chats. Los mensajes van de izquierda a derecha, un punto por mensaje.

- Los puntos grises son tus mensajes, los puntos del color de acento son respuestas de personajes y los círculos huecos son mensajes del narrador o del sistema.
- Una rama solo dibuja sus propios mensajes. Una línea la une al mensaje a partir del cual se creó.
- Una rama sin un punto de ramificación registrado se dibuja desde el chat superior con una línea discontinua, y la leyenda muestra **Fork not recorded** (Punto de ramificación no registrado). Esto incluye las ramas antiguas y las ramas cuyo chat de origen se eliminó.
- Los tramos largos sin ramificación se pliegan en un marcador **··· N ···**, donde N es el número de mensajes ocultos. Haz clic en él para mostrarlos. **Expand all** (Expandir todo) despliega todos los tramos y **Collapse long runs** (Plegar tramos largos) vuelve a plegarlos.
- Los puntos de ramificación y el último mensaje de cada rama tienen un círculo. Tócalo, pasa el cursor sobre él o enfócalo con el teclado para ver el número del mensaje, quién lo escribió y el inicio de su texto.
- Haz clic en el nombre o la fila de una rama para cambiar a ella. La rama que estás viendo aparece resaltada.

El gráfico se actualiza cuando creas una rama, renombras o eliminas un chat, y poco después de que lleguen mensajes nuevos.

### Renombrar una rama

1. En **Chat Branches**, haz clic en el botón del lápiz de la fila de la rama.
2. En el cuadro de diálogo **Rename Branch** (Renombrar rama) ("Set a display name for this chat branch."), escribe un nombre nuevo.
3. Haz clic en **Rename** (Renombrar).

Un nombre vacío o sin cambios se ignora.

### Eliminar una rama

1. En **Chat Branches**, haz clic en el botón de la papelera de la fila de la rama.
2. En el cuadro de diálogo **Delete Branch** (Eliminar rama) ("Delete this branch? Messages will be lost."), haz clic en **Delete** (Eliminar).

Esto quita solo esa rama y sus mensajes. Las demás ramas se quedan.

Con dos ramas o más, aparece **Delete All Branches** (Eliminar todas las ramas) en la parte inferior de la sección. Pregunta "Delete all N branches? This cannot be undone." Confirma con **Delete All** (Eliminar todas). También puedes empezar desde la lista de chats: al eliminar un chat con ramas, se ofrecen **Delete This Branch Only** (Eliminar solo esta rama) y **Delete All N branches** (Eliminar las N ramas). Consulta [Gestionar tu lista de chats](managing-chats.md#delete-a-chat).

### Importar un archivo como rama nueva

1. En **Chat Branches**, haz clic en **Import**.
2. Elige un archivo `.jsonl` exportado desde SillyTavern o desde Marinara.

Marinara lo añade como una rama nueva en el grupo del chat actual, muestra "Imported N messages as a new branch" y cambia a ella.

## Cómo se vinculan las ramas

Esta sección es para quienes construyen sobre los datos de las ramas.

- Cada rama registra su chat de origen inmediato y el mensaje donde se creó la ramificación. Se conservan tanto el ID del mensaje de origen como el ID de su copia, así que las integraciones pueden encontrar el límite de la ramificación aunque los mensajes copiados reciban IDs nuevos.
- Si creas una rama a partir de otra rama, se registra esa rama como padre, no la raíz original.
- En cuanto al menos una rama de un grupo registra su origen, hacer clic en el contador de la lista de chats abre el árbol. Una rama con un origen desconocido aparece directamente debajo del chat. Un grupo sin ningún origen conocido conserva una sola fila, y sus ramas se abren desde **Chat Branches**.
- Eliminar un chat padre no cambia el origen registrado de sus hijos. Eliminar todo el grupo elimina todos sus chats.
