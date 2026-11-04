# Variables de preset

Una variable de preset es una elección con etiqueta incorporada a un preset (ajuste guardado) de prompt. Quien crea el preset la define una vez, y quien usa el preset elige las opciones al asignarlo a un chat. Úsala para que un mismo preset se comporte de distintas maneras sin editar el texto del prompt (las instrucciones enviadas a la IA).

Le das un nombre a la variable, escribes una pregunta y enumeras opciones. Después escribes el nombre entre llaves dobles, como `{{tone}}`, en cualquier sección del prompt. Cuando la IA genera una respuesta, Marinara reemplaza `{{tone}}` con el valor de la opción que eligió el usuario.

Las variables de preset necesitan un preset de prompt, así que funcionan en los chats de Roleplay. No se aplican en los chats de Conversation ni de Game, que usan un único texto de prompt en lugar de secciones. Para los presets en sí, consulta [Editor de presets y gestor de prompts](presets.md).

## Los tipos de variable de preset

De forma predeterminada, una variable con varias opciones es una elección única. El usuario elige una opción, mostrada como botones de radio. Tres ajustes cambian eso.

| Tipo | Cómo se obtiene | Comportamiento |
| --- | --- | --- |
| **Boolean Toggle** (interruptor booleano) | Dale a la variable exactamente una opción. | Un interruptor de encendido/apagado. Activado, inserta el valor de la opción. Desactivado, no inserta nada. |
| **Multi-Select** (selección múltiple) | Activa **Multi-Select**. | El usuario elige varias opciones. Los valores se unen con un separador, `, ` de forma predeterminada. Romance, Fantasy y Action se convierten en "Romance, Fantasy, Action". |
| **Random Pick** (elección aleatoria) | Activa **Random Pick**. | En una variable de selección única, Marinara preselecciona una opción al azar para cada chat nuevo, y la elección permanece fija hasta que la cambies. Con **Multi-Select** activado, el usuario elige un grupo de opciones y cada respuesta toma una de ese grupo. |

## Añadir una variable de preset

1. Abre el panel **Presets** y haz clic en un preset para abrir el **Preset Editor**.
2. Ve a la pestaña **Sections** y desplázate hasta el panel **Preset Variables**, abajo del todo.
3. Haz clic en **Add Variable** (Añadir variable). Aparece una nueva tarjeta de variable. Haz clic en ella para expandirla.
4. Establece el **Variable Name**. El campo solo conserva letras, números y guiones bajos. Este es el nombre que escribes entre llaves.
5. Rellena **Question (shown to user)**. El usuario lo lee al elegir.
6. Edita la lista de **Options**. Cada opción tiene una **Label**, que es lo que ve el usuario, y un **Value**, el texto que se inserta en el prompt. Un valor en blanco no inserta nada.
7. En **Presentation** (Presentación), elige **Auto**, un estilo de botón (**Radios** o **Checkboxes**) o un estilo compacto (**Dropdown** o **Listbox**). Activa **Alphabetical option display** (Orden alfabético de las opciones) para ordenar las opciones por etiqueta.
8. Pulsa <kbd>Escape</kbd> o haz clic en **Done** (Listo). Los cambios se guardan automáticamente, y el pie dice "Changes auto-save. Press Escape to close."

Ahora escribe el nombre entre llaves en una sección del prompt. Por ejemplo, pon `{{tone}}` en una sección y crea una variable llamada `tone` con una opción **Gentle** y una opción **Harsh**. Cuando el usuario elige **Harsh**, la sección recibe su valor.

Una variable siempre conserva al menos una opción. Si intentas eliminar la última, Marinara la conserva.

## Responder a las variables

Cuando asignas a un chat un preset que tiene variables, se abre la ventana **Configure Preset Variables** (Configurar variables de preset). Dice: "This preset has configurable variables. Select option(s) for each to customize your experience."

Cada variable muestra su pregunta, su token, como `{{tone}}`, y una insignia (**Boolean toggle**, **Multi-select** o **Random pick**) donde corresponda.

1. Elige un valor para cada variable.
2. Haz clic en **Confirm Choices** (Confirmar las opciones).

Los otros botones:

- **Save as default** (Guardar como predeterminado) guarda tus elecciones en el preset, para que aparezcan ya rellenadas la próxima vez.
- **Skip** (Saltar) cierra la ventana sin guardar.

**Confirm Choices** permanece desactivado hasta que cada variable de elección única tenga un valor. Las variables **Boolean toggle** y **Multi-select** no lo bloquean, aunque no se haya elegido nada. Cambiar a un preset distinto borra tus elecciones del anterior.

## Cambiar tus respuestas después

En **Chat Settings** (Ajustes del chat), la sección **Prompt Preset** muestra un botón de lápiz, **Edit preset variables** (Editar las variables del preset), cuando el preset seleccionado tiene variables. Haz clic en él para reabrir la ventana con tus elecciones actuales.

## Nombres que no son variables

Marinara resuelve primero los macros integrados, como `{{user}}` y `{{char}}`. Después compara cualquier otro `{{NAME}}` (letras, números y guiones bajos) con tus variables de preset. Si ninguna coincide, prueba con las variables del propio chat, de la sección **Chat Variables** (Variables del chat) de **Chat Settings**. Una variable de preset tiene prioridad cuando ambas comparten un nombre. Si ninguna tiene ese nombre, el texto queda exactamente como lo escribiste, sin ningún error. Consulta [Macros de prompt](macros.md).

## Bloques de decisión en opciones

El valor de una opción puede contener un bloque de decisión, `{{#if decision:"..."}}`, como cualquier otro texto de prompt. Solo se pregunta por las opciones que seleccionó el chat, y cuentan para **Decision statements per turn** (Declaraciones de decisión por turno). En una variable **Random Pick**, se pregunta por todas las opciones del grupo, porque cualquiera podría salir. Consulta [Consultar al Decision model](conditional-prompts.md#asking-the-decision-model).

El valor de una variable aparece donde está su `{{name}}`. Si una decisión cambia ese valor cerca del inicio de un preset, puedes perder gran parte de la reutilización de la caché de prompts del servicio. Coloca más adelante el contenido que cambia con frecuencia. Consulta [Bloques de decisión y caché de prompts](presets.md#decision-blocks-and-prompt-caching).

## Saludos

Las variables de preset también se resuelven en los saludos de los personajes, incluidas las elecciones confirmadas después de crear un saludo. El saludo original sigue siendo editable y conserva intactos sus macros.

## Guías relacionadas

- [Editor de presets y gestor de prompts](presets.md)
- [Macros de prompt](macros.md)
