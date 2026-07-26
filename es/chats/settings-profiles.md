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
- Otras opciones de chat reutilizables

Un perfil no reemplaza contenido propio del chat como los personajes, la persona, los lorebooks, los sprites, el resumen, las etiquetas o el prompt de escena. Tampoco contiene el historial de conversación.

## Aplicar un perfil

El menú desplegable de perfiles está en la parte superior de **Chat Settings**. Su tooltip dice **Apply a settings profile to this chat** (Aplicar un perfil de ajustes a este chat).

1. Abre el chat que quieres cambiar.
2. Abre **Chat Settings**.
3. Abre el menú **Profile** (Perfil).
4. Elige un perfil por su nombre.

El chat se actualiza de inmediato. Cuando sus valores actuales no coinciden con un perfil guardado, el menú muestra **Custom settings profile** (Perfil de ajustes personalizado). Si un perfil aplicado anteriormente ya no existe, muestra **Missing profile - choose a profile** (Falta el perfil: elige uno).

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

## Elegir el perfil predeterminado

La estrella situada junto al menú marca el perfil que se aplica automáticamente a los chats nuevos de ese modo. Solo un perfil por modo puede ser el predeterminado.

Sus tooltips describen el estado actual:

- **Mark this profile as default for new chats in this mode**
- **This profile is the default for new chats in this mode**
- **Select a profile to mark it as default**

## Importar y exportar perfiles

**Export settings profile (.json)** descarga un archivo `.marinara-settings-profile.json` que puedes guardar como copia de seguridad o compartir. **Import settings profile (.json)** crea un perfil nuevo desde un archivo compatible sin sobrescribir uno existente. Los archivos de perfil exportados por versiones anteriores también se pueden importar.

Los perfiles guardan ajustes, no secretos del proveedor.

## El perfil Default

Los modos Conversation y Roleplay tienen cada uno un perfil integrado **Default** (Predeterminado). Aplicarlo restaura los ajustes controlados por el perfil a los valores predeterminados de Marinara para ese modo.

El perfil Default no se puede renombrar, sobrescribir ni eliminar. Los controles desactivados lo explican con **Cannot save into the Default profile**, **Cannot rename the Default profile** y **Cannot delete the Default profile**.

## Guías relacionadas

- [Descripción general de Chat Settings](chat-settings.md)
- [Editor de presets y gestor de prompts](../prompts/presets.md)
- [Parámetros de generación](../prompts/generation-parameters.md)
