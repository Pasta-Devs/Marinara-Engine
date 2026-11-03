# Borrar o restablecer tus datos

Borra de forma permanente una parte o la totalidad de tus datos con la **Danger Zone** (Zona de peligro). No se puede deshacer. Para borrar un chat o un personaje, usa su propio botón de borrar. Consulta [Administrar chats](../chats/managing-chats.md) y [Crear y editar personajes](../characters/creating-and-editing-characters.md).

**Antes de empezar:** haz una copia de seguridad. No hay papelera ni papelera de reciclaje. Consulta [Copia de seguridad y restauración de Marinara](backup-and-restore.md). Si usas Marinara desde otro dispositivo, también necesitas el secreto de administrador. Consulta [Acceso remoto](../REMOTE_ACCESS.md).

## Borrar algunas categorías

1. Abre **Settings → Advanced** y baja hasta **Danger Zone**.
2. Marca cada categoría que quieras borrar. **Select All** marca todas las casillas. Cuando todas están marcadas, el mismo botón dice **Clear Selection** y las desmarca.
3. Haz clic en **Clear Selected Data**. Sigue desactivado hasta que marques una categoría.
4. Lee la advertencia. Muestra cuántas categorías elegiste.
5. Haz clic en **Confirm Delete**, o en **Cancel** para detenerte. No se borra nada hasta que confirmes.

Cuando funciona, un mensaje indica que se borraron los datos seleccionados. Si la solicitud falla, aparece un mensaje de error ("Failed to clear selected data."). Puede que ya se hayan borrado algunos datos, así que revisa qué queda. Comprueba que tienes acceso de administrador.

## Borrar todo

1. En **Danger Zone**, haz clic en **Clear All Data**. No necesitas marcar ninguna casilla.
2. La advertencia pregunta: "Delete all supported data categories except Professor Mari? There is no undo."
3. Haz clic en **Confirm Delete**, o en **Cancel** para detenerte.

Esto equivale a marcar las ocho casillas.

## Las ocho categorías de datos

Cada categoría borra solo lo que indica la lista de su fila, salvo la carpeta de la galería que se señala debajo de la tabla.

| Categoría | Qué borra |
| --- | --- |
| **Chats & Messages** | Todos los chats y su contenido, y toda la carpeta `gallery` y los videos de escenas de Game. |
| **Characters** | Todos los personajes y grupos, salvo Professor Mari, con sus avatares. |
| **Personas** | Todas las personas y grupos, con sus avatares. |
| **Lorebooks** | Todos los lorebooks, entradas y carpetas. |
| **Presets** | Todos los presets de prompts y carpetas de presets, salvo el preset de fábrica integrado. |
| **Connections** | Todas las cuentas guardadas, y las elecciones de modelo y los ajustes de voz vinculados a ellas. |
| **Automation & Addons** | Todos los ajustes de agentes, herramientas personalizadas, scripts de regex y temas sincronizados. No las Personal Extensions ni las External Extensions. |
| **Media & Assets** | Fondos, avatares, sprites, galería, videos de escenas, fuentes y archivos de fuentes de conocimiento. |

Más detalles:

- **Chats & Messages** también borra los swipes (varias respuestas guardadas en un mismo mensaje), las memorias, los ajustes de agentes, el estado del juego y las imágenes de los chats.
- **Characters** y **Personas** también borran los modelos de avatar 2D y 3D.
- **Presets** también borra sus grupos, secciones y variables. Si otro preset era el predeterminado, el preset de fábrica pasa a ser el predeterminado.
- **Connections** también borra los ajustes de texto a voz y de voz a texto, los modelos que elegiste para funciones y una API key de Tripo guardada en la página **3D Avatars**.
- **Automation & Addons** también borra los resultados de agentes, la memoria de agentes, las carpetas de agentes y los widgets de agentes de Home.
- **Media & Assets** también borra la lista de recursos y las imágenes de los chats.
- Las fuentes de conocimiento son archivos que subiste para los agentes de conocimiento. Los temas sincronizados son tus temas personalizados guardados en Marinara.

Algunas categorías llegan a archivos fuera de su propio nombre. **Chats & Messages** borra toda la carpeta `gallery`, incluidas las imágenes de galería de personajes y personas, aunque no hayas marcado **Characters** ni **Personas**.

Borrar no toca tus otros ajustes, la carpeta `backups/` ni el archivo `.encryption-key`. También deja intactos las Personal Extensions, los recursos de Game Mode, los emoji y stickers personalizados, tu sonido de notificación, las imágenes de lorebooks, presets, agentes y cuentas, y los archivos de memoria a largo plazo. Consulta [Dónde guarda Marinara tus datos](where-data-is-stored.md).

## Professor Mari se queda

Professor Mari es el asistente integrado de la pantalla Home. La **Danger Zone** nunca la borra, ni siquiera con **Clear All Data**.

## Guías relacionadas

- [Copia de seguridad y restauración de Marinara](backup-and-restore.md)
- [Dónde guarda Marinara tus datos](where-data-is-stored.md)
- [Acceso remoto](../REMOTE_ACCESS.md)
