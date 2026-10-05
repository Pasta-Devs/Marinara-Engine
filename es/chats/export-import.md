# Exportar e importar chats

Esta guía te muestra cómo guardar un chat en un archivo y cómo volver a cargar un chat en Marinara Engine. Puedes exportar un solo chat o muchos chats a la vez. También puedes importar un archivo de chat que venga de Marinara o de SillyTavern (otra app de chat de roleplay).

## Formatos de archivo que verás

Marinara usa dos formatos de archivo de chat.

- **JSONL**: JSONL significa JSON Lines. Es un archivo de texto simple que guarda un mensaje por línea. Este es el formato de exportación predeterminado. Puedes volver a importar un archivo JSONL en Marinara más tarde.
- **Text**: Una transcripción `.txt` simple y legible. Es fácil de leer y compartir, pero Marinara no puede volver a importarla. Usa **Text** solo cuando quieras que una persona lea el chat.

La función de importación de chats acepta únicamente un archivo `.jsonl`. Si quieres volver a importar un chat más tarde, expórtalo como **JSONL**, no como **Text**.

## Exportar un solo chat

Para exportar un chat a un archivo, usa la sección **Chat Branches** de **Chat Settings** (Ramas del chat). Esta es la forma más rápida de exportar el historial de chat de una sola conversación.

1. Abre el chat que quieres exportar.
2. Abre **Chat Settings** y despliega **Chat Branches**, debajo de **Chat Name**.
3. Haz clic en **JSONL** para guardar el chat como archivo JSONL, o haz clic en **Text** para guardarlo como archivo de texto legible.
4. Tu navegador descarga el archivo.

La descarga guarda el chat que está abierto en ese momento, incluidos sus mensajes.

## Exportar varios chats a la vez

Puedes seleccionar muchos chats y descargarlos juntos en un solo archivo `.zip`.

1. Abre la lista de chats en la barra lateral izquierda.
2. Elige la pestaña de modo que quieras: **CONVO** (Conversation), **RP** (Roleplay) o **GM** (Game). Cada pestaña exporta solo sus propios chats.
3. Haz clic en el botón **Select chats** en la parte superior de la lista de chats.
4. Haz clic en cada chat que quieras incluir. Se activa una casilla para cada uno.
5. Aparece una barra en la parte inferior que muestra la cuenta, por ejemplo "3 selected".
6. Haz clic en **Export** en esa barra.
7. Tu navegador descarga un archivo `.zip` de transcripciones JSONL, un archivo por chat.

La exportación en lote siempre usa el formato **JSONL**. Haz clic en **Delete** en esa misma barra solo si en lugar de eso quieres eliminar los chats seleccionados.

## Importar un chat como un chat nuevo

Esto crea un chat completamente nuevo a partir de un archivo `.jsonl`. Úsalo para importar archivos de chat guardados por Marinara o exportados desde SillyTavern.

1. Abre la lista de chats en la barra lateral izquierda.
2. Elige la pestaña de modo que quieras: **CONVO**, **RP** o **GM**. Marinara crea el chat importado en la pestaña que tienes abierta en ese momento.
3. Haz clic en el botón de importar que está junto al botón **New** en la parte superior de la lista. Su tooltip dice **Import SillyTavern or Marinara chat JSONL**.
4. Elige tu archivo `.jsonl` en el selector de archivos.
5. Deberías ver un mensaje que dice "Imported N messages", y Marinara te cambia al chat nuevo.

Si quieres el chat nuevo en modo Roleplay, abre la pestaña **RP** antes de importar. La pestaña que tienes abierta define el modo, no el archivo.

## Importar un chat como una rama nueva

También puedes cargar un archivo `.jsonl` en un chat existente como una rama nueva. Una rama es una copia guardada aparte de un chat que puedes explorar por su cuenta. Consulta [Chat Branches](branches.md) para saber más sobre las ramas.

1. Abre el chat al que quieres añadir la rama.
2. Abre **Chat Settings** y despliega **Chat Branches**, debajo de **Chat Name**.
3. Haz clic en **Import** en esa sección.
4. Elige tu archivo `.jsonl`.
5. Deberías ver un mensaje que dice "Imported N messages as a new branch".

La rama nueva se une al chat abierto. Reutiliza los personajes, la persona, la conexión y el preset de prompt del chat abierto.

## Incluir el razonamiento en las exportaciones

Algunos modelos guardan texto de pensamiento o razonamiento oculto junto con una respuesta. Un ajuste decide si ese texto oculto entra en tus archivos de exportación.

El ajuste es **Include reasoning in exports** (Incluir el razonamiento en las exportaciones). Lo encuentras en **Settings** (Configuración), en la pestaña **Advanced**, en la sección **Message Tools**. Es un interruptor, y está **off** (desactivado) de forma predeterminada.

- Cuando está **off**, Marinara deja fuera el texto de pensamiento y razonamiento guardado, tanto de las exportaciones de chat **JSONL** como de las **Text**.
- Cuando está **on**, Marinara añade ese texto de pensamiento y razonamiento oculto a ambos formatos.

Este ajuste afecta tanto a las exportaciones de un solo chat como a las exportaciones en lote `.zip`.

Mantén **Include reasoning in exports** desactivado antes de compartir una transcripción con otra persona. El razonamiento oculto puede contener notas que no querías enviar. Actívalo solo cuando quieras un registro completo para ti.

## Guías relacionadas

- [Chat Branches](branches.md)
- [Importing from SillyTavern](../data/importing-from-sillytavern.md)
- [Backup and Restore](../data/backup-and-restore.md)
- [Settings Overview](../settings/settings-overview.md)
