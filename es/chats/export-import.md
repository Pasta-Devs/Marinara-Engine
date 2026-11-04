# Exportar e importar chats

Guarda un chat en un archivo, compártelo como una historia legible o vuelve a cargar un archivo de chat de Marinara o de SillyTavern (otra app de chat de roleplay). Puedes exportar un chat, una parte de un chat o muchos chats a la vez.

<a id="file-formats-you-will-see"></a>

## Formatos de archivo que verás

| Formato | Qué es | ¿Se puede volver a importar? |
| --- | --- | --- |
| **JSONL** | JSON Lines, un archivo de texto simple con un mensaje por línea. El formato predeterminado. | Sí |
| **Text** (Texto) | Una transcripción `.txt` legible. | No |
| **Markdown** | Un archivo `.md` legible. Empieza con el nombre del chat y las fechas que abarca, y luego muestra cada mensaje bajo el nombre de quien habla. | No |
| **Story** (Historia) | Una página web `.html` con estilo, con el nombre y el avatar de quien habla en cada mensaje. Ábrela en un navegador para leerla, compartirla o imprimirla. | No |

Los archivos **Markdown** y **Story** omiten los mensajes del sistema y los mensajes que están ocultos para ti. La importación de chats acepta únicamente archivos `.jsonl`, así que exporta como **JSONL** si quieres importar el chat más tarde.

Un archivo **JSONL** deja fuera algunas direcciones guardadas con el chat: el webhook de Discord Mirror, la dirección de DeepLX, la clave de DeepL y la dirección de Intiface. Importar tampoco las trae nunca. Si las usas, vuelve a introducirlas en **Chat Settings** (Ajustes del chat) del chat importado.

## Exportar un solo chat

1. Abre el chat.
2. Abre **Chat Settings** y despliega **Chat Branches** (Ramas de chat), debajo de **Chat Name**. Los botones de exportación están en esta sección aunque el chat solo tenga una rama.
3. Toca **JSONL**, **Text**, **Markdown** o **Story**.

Tu navegador descarga el archivo. Contiene la rama que estás viendo, con sus mensajes.

<a id="export-part-of-a-chat"></a>

## Exportar parte de un chat

Usa **Export a range** (Exportar un intervalo) para guardar solo algunos mensajes. No está disponible en los chats de Game.

1. En **Chat Branches**, haz clic en **Export a range**.
2. Haz clic en el primer mensaje y luego en el último. Una indicación dice "Select the first and last message to export."
3. Haz clic en **Export selected** (Exportar selección).
4. En el cuadro de diálogo **Export messages** (Exportar mensajes), revisa el número de mensajes y el primer y el último mensaje, y luego elige **Text**, **Markdown**, **JSONL** o **Story**.

Marinara exporta todos los mensajes desde el primero hasta el último que elegiste. Haz clic en **Cancel** (Cancelar) para detenerte sin exportar.

## Exportar varios chats a la vez

1. En la barra lateral izquierda, haz clic en la pestaña del modo que quieras: **CONVO**, **RP** o **GM**. Cada pestaña exporta solo sus propios chats.
2. Haz clic en **Select chats** en la parte superior de la lista.
3. Haz clic en cada chat que quieras. Una barra en la parte inferior muestra el recuento, por ejemplo "3 selected".
4. Haz clic en **Export** en la barra.

Tu navegador descarga un archivo `.zip` con una transcripción JSONL por chat. La exportación en lote siempre usa **JSONL**. Consulta [Gestionar tu lista de chats](managing-chats.md#selecting-multiple-chats).

## Importar un chat como un chat nuevo

Esto crea un chat nuevo a partir de un archivo `.jsonl` guardado por Marinara o exportado desde SillyTavern.

1. En la barra lateral izquierda, haz clic en la pestaña del modo que quieras. El chat importado usa el modo de la pestaña que tienes abierta, no el modo del archivo.
2. Haz clic en el botón **Import** (Importar) junto al botón **+**. Su etiqueta es **Import SillyTavern or Marinara chat JSONL**.
3. Elige tu archivo `.jsonl`.

Ves el mensaje "Imported N messages", y Marinara abre el chat nuevo. Para ver los archivos de SillyTavern con más detalle, consulta [Importar desde SillyTavern](../data/importing-from-sillytavern.md).

Si no funcionó: un pequeño mensaje en la parte inferior de la pantalla dice **Import failed** (No se pudo importar) con el motivo. Comprueba que el archivo termine en `.jsonl`.

## Importar un chat como una rama nueva

Esto carga un archivo `.jsonl` en un chat que ya tienes, como una rama nueva. Consulta [Ramas de chat](branches.md).

1. Abre el chat que debe recibir la rama.
2. Abre **Chat Settings**, despliega **Chat Branches** y haz clic en **Import**.
3. Elige tu archivo `.jsonl`.

Ves el mensaje "Imported N messages as a new branch". La rama reutiliza los personajes, la persona, la conexión y el preset de prompt del chat abierto.

## Incluir el razonamiento y las notas privadas en las exportaciones

Dos ajustes deciden si el texto oculto entra en los archivos de exportación. Ambos son interruptores en **Settings → Advanced → Message Tools** (Configuración → Avanzado → Herramientas de mensaje), y ambos están desactivados de forma predeterminada. Afectan tanto a las exportaciones de un solo chat como a las exportaciones `.zip`.

| Ajuste | Cuando está activado |
| --- | --- |
| **Include reasoning in exports** (Incluir el razonamiento en las exportaciones) | Añade el pensamiento guardado del modelo a todos los formatos. En los archivos **Markdown** y **Story**, aparece en una sección plegable **Thinking** (Pensamiento) debajo del mensaje. |
| **Include private notes in exports** (Incluir las notas privadas en las exportaciones) | Añade tus notas privadas de los mensajes a las exportaciones **JSONL** y **Text**. |

> **Advertencia:** mantén ambos desactivados antes de compartir una transcripción. El razonamiento oculto y las notas privadas pueden contener cosas que no querías enviar.
