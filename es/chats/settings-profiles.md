# Perfiles de ajustes

Un perfil de ajustes es un paquete con nombre de ajustes de chat reutilizables: la conexión, el preset de prompt, los agentes, las herramientas, la traducción, Memory Recall, Advanced Parameters y más. Aplícalo a otro chat en lugar de volver a configurar esas opciones.

Los perfiles están en la parte superior de **Chat Settings** (Ajustes del chat). Funcionan en Conversation y Roleplay. Los chats de Game no muestran los controles de perfil.

Un **preset de prompt** es algo distinto. Controla la estructura del system prompt y los valores de generación, y se edita en el panel Presets. Consulta [Editor de presets y gestor de prompts](../prompts/presets.md). Un perfil de ajustes es el paquete más amplio, y puede incluir un preset de prompt como uno de sus elementos.

## Aplicar un perfil

1. Abre el chat que quieres cambiar y luego abre **Chat Settings**. Consulta [Chat Settings](chat-settings.md).
2. Abre el menú desplegable **Profile** (Perfil), con la etiqueta **Apply a settings profile to this chat** (Aplicar un perfil de ajustes a este chat).
3. Elige un perfil por su nombre.

El chat se actualiza de inmediato. Si el perfil activa o desactiva **Hide summarised messages** (Ocultar los mensajes resumidos), los mensajes resumidos del chat se ocultan al modelo, o vuelven a mostrársele, en ese mismo momento.

Si no funcionó: cuando los valores del chat no coinciden con ningún perfil guardado, el menú muestra **Custom settings profile** (Perfil de ajustes personalizado). Si el perfil aplicado se eliminó, muestra **Missing profile - choose a profile** (Falta el perfil: elige uno). Elige otro perfil.

## Crear o editar un perfil

1. Junto al menú desplegable, toca **New** (Nuevo: "New profile from this chat's settings"). El creador de perfiles se abre con los ajustes de este chat en sus espacios. Para cambiar un perfil guardado, selecciónalo y haz clic en **Edit** (Editar). El perfil Default no se puede editar.
2. Escribe un **Profile name** (Nombre del perfil).
3. Rellena los espacios (consulta la lista de abajo).
4. Toca **Save and choose chats…** (Guardar y elegir chats…).
5. Para usar el perfil en los chats nuevos, marca **Make this the default** (Convertirlo en el predeterminado). La lista empieza con **New conversation chats** (Chats de conversación nuevos) o **New roleplay chats** (Chats de roleplay nuevos).
6. Marca los chats existentes que deben recibir el perfil ahora.
7. Toca **Apply to N chats** (Aplicar a N chats), o **Save** (Guardar) si no marcaste ninguno.

El creador agrupa los espacios en **Chat**, **Story** (Historia), **Pictures** (Imágenes) y **Behind the scenes** (Entre bastidores). Los espacios son:

- **Connection** (Conexión), **Prompt preset** (Preset de prompt) y **Parameters** (Parámetros)
- **Agents** (Agentes), **Tools** (Herramientas) y **Memory & summary** (Memoria y resumen)
- **Persona**, **Lorebooks** y **Background** (Fondo)
- **Image style** (Estilo de imagen) y **Translation** (Traducción)

Cómo rellenar los espacios:

- Elige elementos de la lista de cada espacio. **Agents**, **Tools** y **Lorebooks** admiten varias selecciones. Usa las casillas de **Tools** para activar o desactivar cada herramienta. En un espacio de un solo elemento, elige **None** (Ninguno) para vaciarlo.
- En las listas de agentes y de lorebooks en una computadora, mantén pulsada la tecla <kbd>Ctrl</kbd> (<kbd>Command</kbd> en macOS) para elegir varios elementos. En un teléfono, usa los controles de selección. **Clear selection** (Borrar la selección) vacía una lista.
- En una computadora puedes abrir una barra lateral de biblioteca mientras el creador sigue abierto y arrastrar un elemento a su campo.
- **Parameters**, **Memory & summary** y **Translation** solo indican si el perfil los incluye. Cámbialos en Chat Settings y luego guarda en el perfil.

En el asistente de chat nuevo, el paso **Use a Profile** (Usar un perfil) también tiene **New profile…** (Perfil nuevo…) al principio de la lista y **Edit** junto a un perfil guardado. Después de guardar, el asistente selecciona ese perfil.

## Guardar los ajustes del chat en un perfil

Para actualizar un perfil desde un chat, aplícalo, cambia el chat y luego usa la fila de iconos bajo el menú desplegable.

| Botón | Etiqueta | Resultado |
| --- | --- | --- |
| Save | **Save current chat settings into this profile** | Reemplaza los valores guardados del perfil. |
| Rename | **Rename profile** | Cambia el nombre. |
| Import | **Import settings profile (.json)** | Carga un archivo de perfil. |
| Export | **Export settings profile (.json)** | Descarga el perfil. |
| Delete | **Delete profile** | Elimina el perfil para siempre. |

### Actualizar otros chats que usan el perfil

Cada chat conserva su propia copia de los ajustes de un perfil, así que guardar un perfil no cambia otros chats por sí solo. Cuando otros chats del mismo modo lo usan, el cuadro de diálogo **Other chats use this profile** (Otros chats usan este perfil) pregunta:

- **Save to this profile only** (Guardar solo en este perfil) guarda el perfil y deja los otros chats como están.
- **Save and update N other chats** (Guardar y actualizar otros N chats) también copia los ajustes de Chat Settings del perfil en esos chats. Reemplaza sus propios cambios en esos ajustes, y un ajuste que dejaste en su valor predeterminado en el chat desde el que guardas vuelve a su valor predeterminado en ellos.

Cuando ningún otro chat usa el perfil, **Save** funciona sin preguntar. Las salas multijugador nunca se actualizan de esta forma.

<a id="choosing-the-default-profile"></a>

## Elegir el perfil predeterminado

La estrella junto al menú desplegable marca el perfil que se usa automáticamente en los chats nuevos de ese modo. Solo un perfil por modo puede ser el predeterminado. Las etiquetas son **Mark this profile as default for new chats in this mode** (Marcar este perfil como predeterminado para los chats nuevos de este modo), **This profile is the default for new chats in this mode** (Este perfil es el predeterminado para los chats nuevos de este modo) y **Select a profile to mark it as default** (Selecciona un perfil para marcarlo como predeterminado). También puedes marcar **Make this the default** en el creador.

## Importar y exportar un perfil

**Export settings profile (.json)** descarga un archivo `.marinara-settings-profile.json` que puedes guardar como copia de seguridad o compartir. **Import settings profile (.json)** crea un perfil nuevo a partir de un archivo compatible y nunca sobrescribe uno existente. Las exportaciones anteriores también se pueden importar. Una importación fallida muestra **Import failed** (No se pudo importar).

Los perfiles guardan ajustes, no secretos del proveedor. Un perfil exportado o importado también deja fuera el webhook de Discord Mirror, la dirección de DeepLX, la clave de DeepL y la dirección de Intiface. Los perfiles que guardas en esta instalación los conservan. Los archivos exportados omiten la persona y los lorebooks, porque solo existen en esta instalación.

## El perfil Default

Conversation y Roleplay tienen cada uno un perfil integrado **Default** (Predeterminado). Aplicarlo restaura los ajustes controlados por el perfil a los valores predeterminados de Marinara para ese modo. No se puede renombrar, sobrescribir ni eliminar. Los controles desactivados dicen **Cannot save into the Default profile**, **Cannot rename the Default profile** y **Cannot delete the Default profile**.

<a id="favorite-window-layouts"></a>

## Diseños de ventanas favoritos

La estrella junto a **Reset View** en la barra de título de Chat Settings guarda un diseño de ventanas favorito para los chats nuevos. La estrella junto al menú desplegable **Profile**, en cambio, elige el perfil predeterminado. Consulta los pasos en [Elegir un diseño para chats nuevos](chat-settings.md#choosing-a-layout-for-new-chats).

Cuando un chat nuevo usa un perfil predeterminado que tiene un diseño guardado, ese diseño tiene prioridad sobre el diseño favorito. Un perfil sin diseño guardado conserva la disposición del chat, incluida la que procede de un favorito. Un perfil sigue aplicando su propio ajuste de consejos de diseño (los perfiles antiguos sin ese ajuste muestran los consejos) y su propio modo de Scoped Regex Scripts, o el valor predeterminado del preset de prompt cuando no tiene uno.

## Qué incluye un perfil

Un perfil guarda cómo se comunica el chat con el modelo:

- La conexión.
- El preset de prompt (llamado prompt source en Conversation).
- Los agentes y las herramientas.
- La traducción, Memory Recall y Advanced Parameters.
- El diseño de ventanas y botones: posiciones, tamaños, fijaciones, bloqueos, qué herramientas están dentro de Chat Settings o separadas, las ventanas de controles abiertas y las posiciones de los botones en computadoras y teléfonos. Los perfiles sin diseño guardado, como **Default**, dejan el diseño del chat tal como está.
- Si los consejos de diseño están ocultos. Aplicar **Default**, o un perfil antiguo sin esta elección, vuelve a mostrar los consejos.
- Otras opciones de chat reutilizables.

Un perfil también puede guardar **selecciones iniciales**: una persona, lorebooks que activar y un fondo.

- Aplicar el perfil copia las selecciones al chat. Si el perfil deja alguna vacía, el chat conserva la suya.
- Los demás ajustes del perfil sí reemplazan los del chat.
- Las selecciones no quedan vinculadas. Un cambio posterior en el chat se queda en ese chat.
- **Save current chat settings into this profile** conserva la persona, los lorebooks y el fondo propios del perfil. Un perfil sin fondo toma el fondo del chat cuando guardas en él.
- Actualizar otros chats nunca cambia su persona, sus lorebooks ni su fondo.

Un perfil no reemplaza el contenido propio del chat: los personajes, los sprites, el resumen, las etiquetas y el prompt de escena. Tampoco guarda el historial de conversación ni ningún estado en curso, como las variables de macro, los personajes que desactivaste o una sala multijugador.

### Qué copia Save and update

**Save and update** (Guardar y actualizar) copia esto en los otros chats:

- Opciones de generación y de contexto.
- Opciones de chat grupal.
- Interruptores de funciones y de comandos.
- Agentes y sus opciones.
- Ajustes de memoria y de resumen.
- Traducción.
- El diseño de ventanas.

Todo lo demás se queda como lo tiene cada chat:

- Su conexión, su preset de prompt y su prompt personalizado.
- Su historia y sus personajes.
- Sus lorebooks y su fondo.
- Sus notas y su progreso.
- Qué comandos de Roleplay solo puede usar su narrador.
- Si Noodle puede usar sus mensajes.

Advanced Parameters y la descripción de imágenes (activada o desactivada, y qué conexión describe las imágenes) solo cambian en los chats que usan la conexión del perfil, porque se configuran para esa conexión. Los horarios de los personajes solo cambian si se activaron o desactivaron en el chat desde el que guardas. Knowledge Retrieval, Knowledge Router, Lorebook Keeper y Expression Engine se quedan activados o desactivados, con sus plantillas de prompt, como los tiene cada chat. Cada chat elige por sí mismo sus fuentes, su lorebook o sus sprites.
