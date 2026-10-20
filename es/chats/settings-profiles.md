# Perfiles de ajustes

Un perfil de ajustes es un paquete con nombre de ajustes de chat reutilizables. Puede incluir la conexión de un chat, el preset de prompt, los agentes, las herramientas, la traducción, Memory Recall, Advanced Parameters y otras opciones propias del chat. Aplica el perfil a otro chat en lugar de volver a configurar esas opciones.

Los perfiles se gestionan en la parte superior de **Chat Settings** (Ajustes del chat). Funcionan en los modos Conversation y Roleplay. El modo Game no muestra los controles de perfil.

## Perfiles de ajustes y presets de prompt

Marinara usa **preset** solo para las plantillas de prompt:

- Un **preset de prompt** controla la estructura del system prompt y los parámetros de generación. Se edita en el panel **Presets**. Consulta [Editor de presets y gestor de prompts](../prompts/presets.md).
- Un **perfil de ajustes** es la configuración reutilizable más amplia. Puede incluir el preset de prompt seleccionado junto con la conexión, los agentes y otros ajustes del chat.

Por tanto, un preset de prompt puede ser uno de los elementos guardados dentro de un perfil de ajustes.

## Qué incluye un perfil

Un perfil guarda cómo se comunica el chat con la IA:

- Connection
- Prompt preset (llamado prompt source en el modo Conversation)
- Agents y Tools
- Translation
- Memory Recall
- Advanced Parameters
- Diseño de ventanas y botones: posiciones y tamaños de ventanas, fijaciones y bloqueos, herramientas dentro o fuera de Chat Settings, ventanas de controles abiertas y posiciones de botones en computadoras y teléfonos. Los perfiles sin diseño guardado, como **Default**, dejan el diseño del chat tal como está.
- Si los consejos de diseño de Chat Settings están ocultos. Aplicar **Default** o un perfil antiguo sin esta elección vuelve a mostrar los consejos.
- Otras opciones de chat reutilizables

Un perfil no reemplaza contenido propio del chat como los personajes, la persona, los lorebooks, los sprites, el resumen, las etiquetas o el prompt de escena. Tampoco contiene el historial de conversación ni el estado en curso de un chat, como sus variables de macro, los personajes que desactivaste en él o su sala multijugador.

## Aplicar un perfil

El menú desplegable de perfiles está en la parte superior de **Chat Settings**. Su tooltip dice **Apply a settings profile to this chat** (Aplicar un perfil de ajustes a este chat).

1. Abre el chat que quieres cambiar.
2. Abre **Chat Settings**.
3. Abre el menú **Profile** (Perfil).
4. Elige un perfil por su nombre.

El chat se actualiza de inmediato. Si el perfil activa o desactiva **Hide summarised messages** (Ocultar los mensajes resumidos), los mensajes resumidos del chat se ocultan a la IA, o vuelven a mostrársele, en ese mismo momento. Cuando sus valores actuales no coinciden con un perfil guardado, el menú muestra **Custom settings profile** (Perfil de ajustes personalizado). Si un perfil aplicado anteriormente ya no existe, muestra **Missing profile - choose a profile** (Falta el perfil: elige uno).

## Guardar un perfil

La fila de iconos situada bajo el menú contiene estas acciones:

| Botón | Tooltip | Resultado |
|---|---|---|
| Save | **Save current chat settings into this profile** | Reemplaza los valores guardados del perfil seleccionado |
| Rename | **Rename profile** | Cambia el nombre del perfil seleccionado |
| Save As | **Save current chat settings as a new profile** | Crea otro perfil a partir del chat actual |
| Import | **Import settings profile (.json)** | Carga un archivo de perfil |
| Export | **Export settings profile (.json)** | Descarga el perfil seleccionado |
| Delete | **Delete profile** | Elimina permanentemente el perfil seleccionado |

Para crear tu primer perfil, configura un chat y elige **Save current chat settings as a new profile**. Para actualizarlo después, aplica el perfil, cambia el chat y elige **Save current chat settings into this profile**.

### Actualizar otros chats que usan el perfil

Cada chat conserva su propia copia de los ajustes del perfil, así que guardar un perfil no cambia otros chats por sí solo. Cuando otros chats del mismo modo usan el perfil, al guardar se te pregunta qué hacer:

- **Save to this profile only** (Guardar solo en este perfil) guarda el perfil y deja los otros chats como están.
- **Save and update** (Guardar y actualizar) seguido del número de chats, como **Save and update 3 other chats** (Guardar y actualizar otros 3 chats), también copia los ajustes de Chat Settings del perfil en esos chats. Sus propios cambios en esos ajustes se reemplazan, y un ajuste que dejaste en su valor predeterminado en el chat desde el que guardas vuelve a su valor predeterminado en ellos.

**Save and update** copia:

- Opciones de generación y de contexto
- Opciones de chat grupal
- Interruptores de funciones y de comandos
- Agentes y sus opciones
- Ajustes de memoria y de resumen
- Traducción
- El diseño de ventanas

Todo lo demás se queda como lo tiene cada chat, incluido:

- Su conexión, su preset de prompt y su prompt personalizado
- Su historia y sus personajes
- Sus lorebooks y su fondo
- Sus notas y su progreso
- Qué comandos de Roleplay solo puede usar su narrador
- Si Noodle puede usar sus mensajes

Advanced Parameters y la descripción de imágenes (activada o desactivada, y qué conexión describe las imágenes) solo cambian en los chats que usan la conexión del perfil, porque se configuran para esa conexión. Los horarios de los personajes solo cambian si se activaron o desactivaron en el chat desde el que guardas; si no, cada chat conserva su propia elección. Knowledge Retrieval, Knowledge Router, Lorebook Keeper y Expression Engine se quedan activados o desactivados, con sus plantillas de prompt, como los tiene cada chat. Cada chat elige por sí mismo sus fuentes, su lorebook o sus sprites.

Las salas multijugador nunca se actualizan de esta forma. Cuando ningún otro chat usa el perfil, **Save** (Guardar) funciona sin preguntar.

## Elegir el perfil predeterminado

La estrella situada junto al menú marca el perfil que se aplica automáticamente a los chats nuevos de ese modo. Solo un perfil por modo puede ser el predeterminado.

Sus tooltips describen el estado actual:

- **Mark this profile as default for new chats in this mode**
- **This profile is the default for new chats in this mode**
- **Select a profile to mark it as default**

## Diseños de ventanas favoritos

La estrella junto a **Reset View** en la barra de título de Chat Settings guarda un diseño favorito para los chats nuevos del modo actual. También recuerda si ocultaste los consejos de diseño. Puedes usarla en Conversation, Roleplay y Game. La estrella junto al menú **Profile** sigue eligiendo el perfil de ajustes predeterminado.

Al actualizar una instalación existente, la disposición conocida de botones de herramientas pasa a ser el favorito para los chats nuevos de los tres modos. Esto sucede una vez y respeta cualquier favorito que ya hayas guardado o borrado. El diseño sigue siendo el predeterminado hasta que lo cambies. Una instalación nueva empieza con las herramientas dentro de Chat Settings y sin diseño favorito.

Organiza las ventanas y los botones y pulsa la estrella de la barra de título para guardarlos. La estrella se rellena cuando la disposición y los consejos actuales coinciden con el favorito. Si mueves una ventana o cambias la disposición, vuelve a pulsar la estrella para reemplazarlo. Pulsa la estrella rellena para borrarlo y usar el diseño estándar en los chats futuros. Estos cambios no alteran los chats existentes.

Si un chat nuevo usa un perfil de ajustes predeterminado, el diseño guardado de ese perfil tiene prioridad sobre el favorito. Los perfiles sin diseño guardado conservan la disposición del chat, incluida la procedente de un favorito. Un perfil sigue aplicando su propio ajuste de consejos de diseño; los perfiles antiguos sin ese ajuste muestran los consejos.

Consulta los pasos en [Elegir un diseño para chats nuevos](chat-settings.md#choosing-a-layout-for-new-chats).

## Importar y exportar perfiles

**Export settings profile (.json)** descarga un archivo `.marinara-settings-profile.json` que puedes guardar como copia de seguridad o compartir. **Import settings profile (.json)** crea un perfil nuevo desde un archivo compatible sin sobrescribir uno existente. Los archivos de perfil exportados por versiones anteriores también se pueden importar.

Los perfiles guardan ajustes, no secretos del proveedor. Un perfil exportado o importado también deja fuera el webhook de Discord Mirror, la dirección de DeepLX, la clave de DeepL y la dirección de Intiface. Los perfiles que guardas en esta instalación los conservan.

## El perfil Default

Los modos Conversation y Roleplay tienen cada uno un perfil integrado **Default** (Predeterminado). Aplicarlo restaura los ajustes controlados por el perfil a los valores predeterminados de Marinara para ese modo.

El perfil Default no se puede renombrar, sobrescribir ni eliminar. Los controles desactivados lo explican con **Cannot save into the Default profile**, **Cannot rename the Default profile** y **Cannot delete the Default profile**.

## Guías relacionadas

- [Descripción general de Chat Settings](chat-settings.md)
- [Editor de presets y gestor de prompts](../prompts/presets.md)
- [Parámetros de generación](../prompts/generation-parameters.md)
