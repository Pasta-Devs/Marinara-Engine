# Borrar o restablecer tus datos

Esta guía te muestra cómo eliminar de forma permanente tus datos en Marinara Engine usando la **Danger Zone** (Zona de peligro). Puedes borrar unas pocas categorías o eliminarlo todo. No hay forma de deshacerlo, así que lee primero las advertencias.

## Dónde está la Danger Zone

Las herramientas para borrar datos están todas en un mismo lugar.

1. Abre **Settings** (Configuración).
2. Ve a la pestaña **Advanced** (Avanzado).
3. Baja hasta la sección **Danger Zone** al final.

La descripción de la **Danger Zone** dice: "Permanently clear selected categories of local data. Professor Mari is always preserved." (Borra de forma permanente las categorías de datos locales seleccionadas. Professor Mari siempre se conserva.)

Si usas Marinara desde otro dispositivo (no la computadora en la que corre la app), borrar datos requiere acceso de administrador. Consulta [Acceso remoto](../REMOTE_ACCESS.md) para saber cómo configurarlo.

## Haz una copia de seguridad antes de borrar

Borrar datos no se puede deshacer. No hay papelera ni papelera de reciclaje. Una vez que confirmas, los datos desaparecen.

Haz primero una copia de seguridad para poder restaurar más tarde si cambias de opinión. Consulta [Copia de seguridad y restauración de Marinara](backup-and-restore.md).

## Las ocho categorías de datos

La **Danger Zone** muestra una lista de ocho categorías. Cada una es un ámbito independiente. Marcar una categoría no afecta a las demás.

| Categoría | Qué borra |
|---|---|
| **Chats & Messages** | Chats, carpetas, mensajes, datos de escena/OOC y el estado de ejecución del chat. |
| **Characters** | Personajes y grupos de personajes. Professor Mari siempre se conserva. |
| **Personas** | Personas y grupos de personas. |
| **Lorebooks** | Lorebooks y entradas de lorebook. |
| **Presets** | Presets de prompt, grupos, secciones y variables. |
| **Connections** | Conexiones de API y endpoints de modelos. |
| **Automation & Addons** | Agentes, herramientas, scripts de regex, temas sincronizados y estado de automatización. |
| **Media & Assets** | Fondos, avatares, sprites, elementos de la galería, fuentes y archivos de fuentes de conocimiento. |

Algunas categorías eliminan más que registros de la base de datos. **Chats & Messages** también elimina toda la carpeta de la galería en disco y todos los archivos de video de escena. Esto incluye las imágenes de galería de personajes y personas, aunque no hayas marcado **Characters** ni **Personas**. **Media & Assets** elimina las carpetas en disco de fondos, avatares, sprites, galerías, archivos de video de escena, fuentes y archivos de fuentes de conocimiento. **Connections** también borra tus ajustes guardados de Text to Speech (TTS, texto a voz) y de Speech to Text (voz a texto), porque están vinculados a una conexión.

## Borrar categorías seleccionadas

Usa esto cuando quieras eliminar algunos datos pero conservar el resto.

1. Marca la casilla junto a cada categoría que quieras eliminar.
2. Para activar o desactivar todas las casillas a la vez, usa el botón **Select All** (Seleccionar todo). Cuando todas las casillas están marcadas, ese mismo botón cambia a **Clear Selection** (Borrar selección) para que puedas desmarcarlas todas.
3. Haz clic en **Clear Selected Data** (Borrar datos seleccionados). Este botón permanece desactivado hasta que marques al menos una categoría.
4. Aparece un cuadro de advertencia. Indica cuántas categorías elegiste y te recuerda que no hay forma de deshacerlo.
5. Haz clic en **Cancel** (Cancelar) para detenerte, o en **Confirm Delete** (Confirmar eliminación) para eliminar. No se elimina nada hasta que hagas clic en **Confirm Delete**.

Después de un borrado exitoso, deberías ver un mensaje de confirmación. Indica que los datos seleccionados se borraron y que las cachés de ejecución se restablecieron de inmediato.

## Borrar todo

Usa esto para eliminar las ocho categorías en un solo paso.

1. Haz clic en **Clear All Data** (Borrar todos los datos). No necesitas marcar ninguna casilla antes.
2. Un cuadro de advertencia pregunta: "Delete all supported data categories except Professor Mari? There is no undo." (¿Eliminar todas las categorías de datos compatibles excepto Professor Mari? No hay forma de deshacerlo.)
3. Haz clic en **Cancel** para detenerte, o en **Confirm Delete** para eliminar todo.

Esto hace lo mismo que marcar todas las casillas y borrarlas juntas.

## Professor Mari siempre se conserva

Professor Mari es el personaje ayudante integrado. Esta función nunca la elimina. Aunque borres la categoría **Characters** o uses **Clear All Data**, Professor Mari permanece en su lugar. No puedes quitarla desde la **Danger Zone**.

## Guías relacionadas

- [Copia de seguridad y restauración de Marinara](backup-and-restore.md)
- [Acceso remoto](../REMOTE_ACCESS.md)
