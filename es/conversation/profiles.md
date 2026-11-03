# Perfiles de Conversation Mode (nombre visible, About Me, comportamiento)

Cada personaje y cada persona tiene un pequeño perfil estilo app de chat para Conversation Mode (modo Conversación): un nombre visible, una biografía "sobre mí" y una instrucción de comportamiento. Estos campos nunca se usan en Roleplay ni en Game Mode.

Este no es un perfil de ajustes (un conjunto guardado de opciones del chat, consulta [Perfiles de ajustes](../chats/settings-profiles.md)). Si el modo es nuevo para ti, lee primero [Conversation Mode: primeros pasos](getting-started.md). Una persona es la tarjeta de personaje que te representa.

## Dónde están estos campos

Los campos están en una pestaña llamada **Convo**.

1. Abre el personaje en el **Character Editor** (Editor de personajes), o la persona en el **Persona Editor** (Editor de personas). Para llegar, abre el panel **Characters** desde la barra lateral, o el panel **Personas** desde el icono de persona de la barra superior de la barra lateral derecha, y luego haz clic en la tarjeta (consulta [Crear y editar personajes](../characters/creating-and-editing-characters.md) y [Personas de usuario](../characters/personas.md)).
2. Haz clic en la pestaña **Convo**.

La pestaña contiene **Convo Display Name**, **About Me** y **Convo Behavior**. En un personaje también tiene **Weekly schedule** (con **Edit schedule** o **Create schedule**, consulta [horarios](schedules.md)) e **Image generation instructions**, indicaciones opcionales para las selfies de ese personaje (consulta [Selfies](selfies.md)).

## Definir un nombre visible

**Convo Display Name** (nombre visible en Convo) es el nombre que se muestra en los chats de Conversation. Déjalo en blanco para usar el nombre de la tarjeta. Los mensajes existentes se actualizan de inmediato.

Los personajes también tienen **Declare this name on the card in the prompt** (Declarar este nombre en la tarjeta dentro del prompt). Cuando está activado, Marinara añade una línea como "Conversation display name: X" al texto de la tarjeta en el prompt (el texto que Marinara envía al modelo), para que el modelo sepa qué tarjeta usa qué nombre. Primero necesita un nombre visible.

## Escribir un About Me

**About Me** (sobre mí) es una biografía corta: una línea o dos, un emoji, un chiste, o nada. Marinara añade al prompt, en cada turno, el **About Me** de cada personaje y de cada persona presentes, para que el modelo sepa cómo se presenta cada uno. Tú no haces nada para esto.

Para rellenarlo:

- Escríbelo tú. El botón de emoji de la barra de herramientas inserta un emoji. **Revert** (Deshacer) restaura el texto de antes de tu edición actual.
- En un personaje guardado, haz clic en el botón de la varita (**Generate About Me from this card**, Generar About Me a partir de esta tarjeta).
- Pídeselo a **Professor Mari** en la pantalla de inicio, por ejemplo `Write Luna's About Me as a cryptic one-line bio.` Ella lee el perfil guardado, escribe la biografía con la voz de esa persona y la guarda. Puedes conservar o restaurar su cambio en el flujo de revisión de siempre.

Si no funcionó: el botón de la varita no aparece en una tarjeta que aún no está guardada. Guarda primero la tarjeta.

## Definir Convo Behavior

**Convo Behavior** (comportamiento en Convo) es una instrucción sobre cómo actúa el personaje o la persona en Conversation Mode, por ejemplo: mantener las respuestas cortas y en minúsculas, y escribir como una persona real. Las instrucciones post-history son texto del prompt que se coloca después del historial reciente del chat. Conserva el valor predeterminado si no escribes prompts personalizados. Usa **Insertion** (Inserción) para elegir dónde va la instrucción en el prompt:

| Opción | Dónde va la instrucción |
| --- | --- |
| **Constant — after the card** (predeterminado) | Siempre, justo después del texto de la tarjeta. |
| **Constant — before the card** | Siempre, justo antes del texto de la tarjeta. |
| **Append to post-history** | Al final de las instrucciones post-history. |
| **Prepend to post-history** | Al inicio de las instrucciones post-history. |
| **Replace post-history** | En lugar de las instrucciones post-history. |
| **Only where {{convo_behavior}} is placed** | Solo donde pongas el macro en un prompt personalizado. |

## Anulaciones de About Me específicas de un chat

El **About Me** de la tarjeta es el predeterminado en todas partes. Puedes definir una biografía distinta solo para un chat.

1. En un chat de Conversation, haz clic en el avatar o en el nombre de un personaje o de una persona. Se abre una tarjeta de perfil junto a él (desde abajo en un teléfono).
2. Lee la tarjeta. Muestra el avatar, el nombre y el **About Me** actual. Una insignia dice **Default** (Predeterminado) o **Chat-specific** (Específico del chat). Los personajes también muestran **Online**, **Away**, **Busy** u **Offline**.
3. Haz clic en **Edit**.
4. Escribe la biografía para este chat. Hay un selector de emoji con una pestaña **Custom emojis**.
5. Haz clic en **Save**. Verás "Chat-specific about me saved".

**Cancel** cierra el modo de edición sin guardar. **Revert** deshace los cambios sin guardar. **Clear** quita una anulación existente y vuelve al valor predeterminado de la tarjeta. Guardar una biografía vacía también la borra.

## Dejar que un personaje cambie su propio About Me

Esta es una opción avanzada. Una herramienta llamada `update_about_me` permite que un personaje edite su propia biografía durante un chat. Está desactivada de forma predeterminada. Para usarla, abre **Chat Settings → Function Calling**, activa **Enable Tool Use** y luego añade la herramienta `update_about_me`.

El personaje elige una de dos opciones:

- Public cambia la biografía real que se ve en todos los chats. Tú la apruebas primero.
- Chat cambia una biografía privada del chat actual.

## Macros para prompts personalizados

No necesitas macros para que los perfiles lleguen al modelo. Úsalos solo para colocar un valor en un punto exacto de un prompt personalizado. Cada uno está vacío fuera de Conversation Mode. Consulta [Macros](../prompts/macros.md).

| Macro | Valor |
| --- | --- |
| `{{convo_display}}` | El nombre visible del personaje que responde. |
| `{{char_about}}` | El **About Me** efectivo del personaje. |
| `{{persona_about}}` | El **About Me** efectivo de la persona. |
| `{{convo_behavior}}` | El **Convo Behavior** del personaje. |

## Guías relacionadas

- [Conversation Mode: primeros pasos](getting-started.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
- [Personas de usuario: crear y editar](../characters/personas.md)
- [Macros](../prompts/macros.md)
