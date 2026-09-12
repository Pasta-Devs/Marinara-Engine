# Variables de preset

Esta guía explica las **Preset Variables** (variables de preset), las pequeñas opciones tipo formulario que puedes incorporar a un preset de prompt. El autor de un preset define las opciones una vez, y cualquiera que use el preset elige las opciones cuando el preset se asigna a un chat. Las variables de preset a veces se llaman bloques de elección.

## Qué son las variables de preset

Un preset de prompt es un plano reutilizable para el texto que se envía a la IA. Una variable de preset añade una elección con etiqueta a ese plano. Le das un nombre a la elección, escribes una pregunta y enumeras algunas opciones.

Dentro de cualquier sección del prompt escribes el nombre de la variable entre llaves dobles, como `{{tone}}`. Cuando la IA genera una respuesta, Marinara Engine reemplaza `{{tone}}` con el valor de la opción que eligió el usuario. Esto permite que un mismo preset produzca comportamientos distintos sin editar el texto del prompt.

Las variables de preset viven dentro de un preset de prompt, así que funcionan en los modos de chat que usan presets de prompt. No se aplican en el modo Conversation. Ese modo usa una única sustitución del texto del prompt en lugar del preset basado en secciones, así que no hay nada que las variables puedan rellenar. Para conocer los presets en sí, consulta [Preset Editor and Prompt Manager](presets.md).

## Los tres tipos de variable de preset

El comportamiento de una variable depende de sus opciones y de dos interruptores. De forma predeterminada, una variable con varias opciones es una elección única: el usuario elige exactamente una opción, mostrada como botones de radio. Sobre esa base hay tres tipos con nombre.

**Boolean Toggle** (interruptor booleano). Si una variable tiene exactamente una opción, se convierte en un interruptor de encendido/apagado. Cuando el usuario lo activa, se inserta el valor de la opción. Cuando está apagado, no se inserta nada. El editor muestra una etiqueta **Boolean Toggle** en estas variables.

**Multi-Select** (selección múltiple). Activa el interruptor **Multi-Select** para permitir que los usuarios elijan más de una opción. De forma predeterminada, los valores seleccionados se unen con un separador. El separador es un campo de texto corto, y el valor predeterminado es una coma y un espacio. Por ejemplo, las opciones Romance, Fantasy y Action unidas con `, ` se convierten en el texto "Romance, Fantasy, Action".

**Random Pick** (elección aleatoria). Para una variable de selección única, Marinara preselecciona una opción al azar en cada chat nuevo. Puedes cambiarla antes de confirmar, y la elección guardada permanece fija hasta que la edites. Con **Multi-Select** activado, la app elige al azar una de las opciones seleccionadas por el usuario cada vez que genera. Esto da variedad: el usuario elige un grupo de opciones, y cada respuesta toma una de ese grupo.

## Añadir una variable de preset

Añades variables mientras editas un preset. Sigue estos pasos.

1. Abre el panel **Presets** y haz clic en un preset para abrir el **Preset Editor**.
2. Ve a la pestaña **Sections** y desplázate hasta el panel **Preset Variables** que está abajo.
3. Haz clic en **Add Variable**. Aparece una nueva tarjeta de variable. Haz clic en ella para expandir el editor.
4. Establece el **Variable Name**. Solo puede usar letras, números y guiones bajos. Este es el nombre que escribes entre llaves, como `{{variable_name}}`.
5. Rellena **Question (shown to user)**. Este es el mensaje que lee el usuario al elegir un valor.
6. Edita la lista de **Options**. Cada opción tiene una **Label** (lo que ve el usuario) y un **Value** (el texto que se inserta en el prompt). Un valor en blanco no inserta nada.
7. Elige un estilo de visualización en **Presentation**: **Auto**, o el estilo de botón (**Radios** o **Checkboxes**), o el estilo compacto (**Dropdown** o **Listbox**). Activa **Alphabetical option display** para ordenar las opciones por etiqueta.
8. Tus cambios se guardan automáticamente. El pie del editor dice "Changes auto-save. Press Escape to close." Pulsa Escape o haz clic en **Done** cuando termines.

Para usar la variable, escribe su nombre entre llaves dentro del contenido de cualquier sección del prompt. Por ejemplo, pon `{{tone}}` en una sección, luego crea una variable llamada `tone` con una opción **Gentle** y una opción **Harsh**. Cuando el usuario elige Harsh, la sección recibe el valor harsh.

Una variable siempre debe conservar al menos una opción. Si intentas eliminar la última opción, Marinara la conserva.

## La ventana Configure Preset Variables

Cuando asignas a un chat un preset que tiene variables, la ventana **Configure Preset Variables** (Configurar variables de preset) se abre automáticamente. Su introducción dice: "This preset has configurable variables. Select option(s) for each to customize your experience."

Cada variable muestra su pregunta, el token al que corresponde (como `{{tone}}`) y una pequeña insignia que dice **Boolean toggle**, **Multi-select** o **Random pick** donde corresponda. Elige un valor para cada variable.

- **Save as default** guarda tus elecciones de vuelta en el preset, para que aparezcan ya rellenadas la próxima vez.
- **Skip** cierra la ventana sin guardar tus elecciones.
- **Confirm Choices** guarda tus elecciones. Permanece desactivado hasta que cada variable de elección única tenga un valor. Las variables **Boolean toggle** y **Multi-select** no lo bloquean, aunque no se haya elegido nada.

Cambiar a un preset distinto borra cualquier elección de variable que hayas hecho para el preset actual.

## Cambiar tus respuestas después

No tienes que reabrir un preset desde cero para cambiar tus respuestas. En el panel lateral de ajustes del chat, la sección **Prompt Preset** muestra un botón de lápiz llamado **Edit preset variables** siempre que el preset seleccionado tenga variables. Haz clic en él para reabrir la ventana **Configure Preset Variables** con tus elecciones actuales ya rellenadas.

## El comodín {{NAME}}

Marinara resuelve muchos macros integrados, como `{{user}}` y `{{char}}`. Después de esos, cualquier marcador de posición restante con la forma `{{NAME}}` (solo letras, números y guiones bajos) se compara con tus variables de preset.

Si existe una variable con ese nombre exacto, el marcador de posición se convierte en el valor elegido. Si ninguna variable coincide, el texto `{{NAME}}` se deja exactamente como se escribió. Por eso un marcador de posición desconocido aparece sin cambios en la salida en lugar de provocar un error. Para la lista completa de macros, consulta [Prompt Macros](macros.md).

## Guías relacionadas

- [Preset Editor and Prompt Manager](presets.md)
- [Prompt Macros](macros.md)

Las variables del preset también se resuelven en los saludos de los personajes, incluidas las elecciones confirmadas después de crear el saludo. El saludo original sigue siendo editable y conserva sus macros.
