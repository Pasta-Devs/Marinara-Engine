# Editor de presets y gestor de prompts

Esta guía explica los presets de prompt (ajuste guardado) en Marinara Engine. Aprenderás qué son, cómo crear uno en el **Preset Editor** (Editor de presets) y cómo asignarlo a un chat. Un preset controla la estructura del texto que Marinara envía a la IA.

## Qué es un preset

Un preset es un plano reutilizable. Decide qué información envía Marinara a la IA y en qué orden. Eso incluye las instrucciones de sistema que escribes, la tarjeta de personaje, tu persona, el historial del chat, las entradas de lorebook (libro de trasfondo) y más.

Los presets dan forma al prompt (instrucciones enviadas a la IA) en los chats de **Roleplay** y **Game**. El modo **Conversation** funciona de otra manera y usa un solo campo de prompt. Consulta "En qué se diferencian los modos Conversation y Game" más abajo.

Los presets no necesitan una API key (clave de API) ni una cuenta. Solo describen cómo se arma un prompt. Aún necesitas una conexión que funcione para enviar el prompt. Consulta [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md).

## Abrir el Preset Editor

Los presets de prompt viven en el panel **Presets** (Presets), en el lado izquierdo de la app.

El panel tiene tres botones en la parte superior:

- **New** (Nuevo; icono de más): crea un preset nuevo.
- **Import** (Importar; icono de descarga): carga un preset desde un archivo `.json`.
- **Select** (Seleccionar; icono de marca): elige varios presets para exportarlos o borrarlos a la vez.

Debajo de los botones hay una casilla **Search presets** (Buscar presets) y un menú de orden con **A-Z**, **Z-A**, **Newest** y **Oldest**. Un botón **New Folder** (Nueva carpeta) te deja agrupar presets en carpetas. Arrastra un preset sobre una carpeta para moverlo. Haz doble clic o doble toque en una carpeta para cambiarle el nombre.

Cada fila de preset muestra su nombre, formato de envoltura, número de secciones y autor. Aparece una insignia **DEFAULT** si el preset es el predeterminado marcado con estrella. Haz clic en una fila de preset para abrirlo en el **Preset Editor**.

## Crear y editar un preset

Sigue estos pasos para hacer un preset nuevo.

1. Abre el panel **Presets**.
2. Haz clic en el botón **New**. Se abre la ventana **Create Preset** (Crear preset).
3. Escribe un **Name** (Nombre). Este campo es obligatorio.
4. Agrega una **Description** (Descripción) opcional para recordar para qué sirve el preset.
5. Haz clic en **Create** (Crear). El preset nuevo se abre en el **Preset Editor**.
6. Arma tu prompt en la pestaña **Sections** (Secciones) (se explica más abajo).
7. Haz clic en **Save** (Guardar) en la esquina superior derecha cuando termines.

El editor no guarda por su cuenta. Tus cambios solo se conservan después de que haces clic en **Save**. Si intentas salir con ediciones sin guardar, aparece un aviso con los botones **Keep editing** (Seguir editando), **Discard** (Descartar) y **Save & close** (Guardar y cerrar).

Para exportar un preset, ábrelo y haz clic en el botón de exportar (icono de flecha hacia arriba) en la barra superior. Marinara te pide guardar primero si tienes ediciones sin guardar. Para borrar un preset, usa el icono de papelera en la barra superior.

## Las pestañas Overview, Sections y Prompts

El **Preset Editor** tiene tres pestañas.

- **Overview** (Resumen): el nombre del preset, la descripción, el formato de envoltura y el autor.
- **Sections**: la estructura real del prompt, construida a partir de bloques y marcadores.
- **Prompts**: los prompts de modo que usan los chats de Conversation y Game.

### Pestaña Overview

La pestaña **Overview** contiene cuatro campos. **Name** es el nombre visible que se muestra en el panel **Presets**. **Description** es un resumen corto del preset. **Wrap Format** (Formato de envoltura) controla cómo se formatean las secciones (consulta "Formatos de envoltura"). **Author** (Autor) es un nombre de creador opcional, útil cuando compartes un preset. Dos tarjetas de solo lectura muestran los recuentos de **Sections** y **Groups** (Grupos).

### Pestaña Prompts

La pestaña **Prompts** contiene los prompts de modo.

- **Conversation Mode** (Modo Conversation): un cuadro de texto que se usa como prompt de Conversation de este preset. Déjalo vacío para usar el prompt de conversación integrado de Marinara.
- **Roleplay Mode** (Modo Roleplay): no se edita aquí. Roleplay usa el prompt ensamblado a partir de tus **Sections**.
- **Game Mode** (Modo Game): un cuadro de texto que se usa como prompt de Game de este preset. Déjalo vacío para usar el prompt de juego integrado de Marinara.

## Secciones y marcadores

La pestaña **Sections** es donde construyes el prompt. Cada sección se vuelve parte del texto final que se envía a la IA. Las secciones se ensamblan de arriba hacia abajo.

Haz clic en **Add Section** (Agregar sección) para abrir el menú de añadir. Ofrece dos tipos de sección.

Un **Prompt Block** (Bloque de prompt) es una sección de texto libre que escribes tú. Úsalo para instrucciones de sistema, reglas de tono o cualquier redacción que quieras en cada prompt.

Un **marker** (marcador) es una sección que se rellena de forma automática. No tiene texto propio. En su lugar, Marinara lo rellena en el momento del envío con contenido en vivo de tu chat. La tabla de abajo lista los marcadores.

| Marcador | Qué inserta |
|---|---|
| **Character Info** | Los detalles de la tarjeta de personaje activa. |
| **Persona** | Los detalles de tu persona activa. |
| **Chat History** | Los mensajes en curso del chat. |
| **Chat Summary** | El resumen compilado de este chat. |
| **Dialogue Examples** | El diálogo de ejemplo del personaje. |
| **Lorebook Marker (All)** | Todas las entradas de lorebook activas. |
| **Lorebook Marker (Before)** | Entradas de lorebook configuradas para insertarse antes. |
| **Lorebook Marker (After)** | Entradas de lorebook configuradas para insertarse después. |

Una sección que es un marcador muestra una insignia **MARKER** en su fila. Expándela para ver una nota que nombra el tipo de marcador. No puedes escribir contenido en la mayoría de los marcadores, porque Marinara los genera por ti.

Cuando un preset no tiene un marcador **Dialogue Examples** activado, el diálogo de ejemplo no vacío se añade a **Character Info** después de Scenario. Usa el formato XML, Markdown o sin envoltura del preset. Agrega un marcador Dialogue Examples cuando quieras controlar su ubicación de forma explícita; Marinara no lo incluirá dos veces.

Si tu chat tiene lorebooks activos pero tu preset no tiene ningún marcador de lorebook, aparece un aviso. Dice: "Add a lorebook marker when this preset should receive active lorebook entries." Agrega un marcador de lorebook para que esas entradas lleguen a la IA. Consulta [Introducción a los lorebooks](../lorebooks/overview.md).

Si has configurado agentes personalizados con la opción "inject as section" activada, el menú de añadir muestra un grupo **Agent Sections** (Secciones de agente). Cada sección de agente inserta la última salida de ese agente en el prompt. Puedes agregar tus propias instrucciones alrededor.

Cada fila de sección tiene controles a la derecha. **Duplicate** (Duplicar) copia la sección. El icono de ojo activa o desactiva la sección. **Delete** (Borrar) la elimina. Para reordenar las secciones, arrastra el tirador, usa las flechas hacia arriba y hacia abajo, o mantén pulsado en una pantalla táctil.

Expande una sección (haz clic en su nombre o en el chevrón) para editarla. Puedes cambiar su **Name** y su rol (**System**, **User** o **Assistant**). Para un **Prompt Block**, también puedes editar su **Content** (Contenido). El cuadro de contenido admite macros. Consulta [Macros de prompt](macros.md).

## Grupos y posición de sección

### Grupos

Los grupos envuelven varias secciones en un contenedor. Esto mantiene juntas las secciones relacionadas en el prompt final.

1. En la pestaña **Sections**, haz clic en el botón **Groups** de la barra de herramientas.
2. Haz clic en **New Group** (Nuevo grupo). Aparece un grupo llamado "New Group".
3. Haz clic en el nombre del grupo para cambiarlo.
4. Expande una sección y elige tu grupo en su menú desplegable **Group**.

Con el formato de envoltura **XML**, un grupo se convierte en una etiqueta padre alrededor de sus secciones. Con **Markdown**, un grupo se convierte en un encabezado. Borrar un grupo no borra sus secciones. Simplemente pierden el grupo.

### Posición y profundidad

Cada sección tiene un ajuste **Position** (Posición) dentro de su editor expandido.

- **Ordered (in sequence)** (Ordenado, en secuencia): la sección se sitúa donde aparece en la lista. Esta es la opción normal.
- **Depth (from end of chat)** (Profundidad, desde el final del chat): la sección se coloca un número fijo de mensajes hacia arriba desde el final del chat. Cuando eliges esto, aparece un número **Depth** (Profundidad). Una profundidad de 0 significa que la sección va después del último mensaje.

Usa **Depth** para recordatorios que quieres que la IA vea cerca de los mensajes más nuevos, como una nota corta de estilo.

## Formatos de envoltura

**Wrap Format** en la pestaña **Overview** controla cómo se envuelve cada sección cuando se ensambla el prompt. Hay tres botones.

- **XML**: cada sección se envuelve en etiquetas, por ejemplo una etiqueta con el nombre alrededor de su contenido. Los grupos se convierten en etiquetas padre. Este es el predeterminado.
- **MARKDOWN**: cada sección se envuelve con un encabezado. Los grupos se convierten en encabezados de nivel superior.
- **NONE**: no se agrega ninguna envoltura. El contenido de la sección se envía exactamente como está escrito.

XML es un buen valor predeterminado para la mayoría de los modelos. Prueba **MARKDOWN** o **NONE** solo si un modelo parece responder mejor sin etiquetas.

## Asignar un preset a un chat

Un preset no hace nada hasta que lo asignas a un chat. Hay dos maneras de hacerlo en un chat de **Roleplay**.

Desde el panel **Presets**:

1. Abre el chat que quieres cambiar.
2. En el panel **Presets**, pasa el cursor sobre una fila de preset.
3. Haz clic en el botón de marca **Assign to chat** (Asignar al chat). Vuelve a hacer clic para quitar la asignación.

Desde **Chat Settings** (Ajustes del chat):

1. Abre el chat.
2. Abre **Chat Settings** (el engranaje).
3. Busca la sección **Prompt Preset**.
4. Elige un preset en el menú desplegable.

Si un preset tiene variables, se abre una ventana **Configure Preset Variables** (Configurar variables del preset) cuando lo asignas. Completa tus opciones ahí. Consulta [Variables de preset](preset-variables.md). Cambiar a un preset distinto borra cualquier opción de variable que hayas hecho antes.

Los presets de prompt no están disponibles en el modo **Conversation** desde el panel. Hacer clic en el botón de asignar en un chat de Conversation muestra un mensaje: "Prompt presets are not available in conversation mode." Consulta la siguiente sección para ver cómo los chats de Conversation y Game usan presets en su lugar.

## En qué se diferencian los modos Conversation y Game

Los chats de **Conversation** y **Game** no construyen un prompt a partir de Sections. En su lugar usan un solo prompt de modo, que puedes anular por cada chat.

En estos modos, **Chat Settings** muestra una sección **Prompt Preset** con un menú desplegable **Prompt source** (Fuente del prompt). El menú desplegable lista tus presets. Su valor predeterminado es "Default conversation prompt" o "Default game prompt". Si no tienes presets, dice "No presets available" (No hay presets disponibles).

Debajo del menú desplegable hay una fila de estado. Muestra uno de tres estados:

- **Default**: se usa el prompt de modo integrado.
- **Preset**: el prompt viene del preset elegido.
- **Custom**: has escrito una edición local para este chat únicamente.

Haz clic en **Edit Prompt** (Editar prompt) para escribir un prompt solo para este chat. El editor se abre como **Edit Conversation Prompt** o **Edit Game Prompt**. Si tu edición coincide con el preset o el predeterminado de forma exacta, Marinara la trata como no personalizada. Una vez que existe una edición personalizada, aparece un botón **Reset to default prompt** (Restablecer al prompt predeterminado) para borrarla.

Los chats de Game también tienen un cuadro **Extra instructions** (Instrucciones adicionales). El texto ahí se agrega al prompt de Game. Tiene un límite de 2000 caracteres. Una instrucción de ejemplo es "Write in the style of Terry Pratchett."

## Comprobar qué recibió la IA

Para confirmar qué preset y qué secciones llegaron realmente a la IA, usa **Peek Prompt**. Muestra el prompt completamente ensamblado de un mensaje. Esta es la manera más rápida de depurar una respuesta rara. Consulta [Peek Prompt: ver qué recibió la IA](../chats/peek-prompt.md).

## Guías relacionadas

- [Variables de preset](preset-variables.md)
- [Macros de prompt](macros.md)
- [Parámetros de generación](generation-parameters.md)
- [Perfiles de ajustes](../chats/settings-profiles.md)
- [Introducción a Chat Settings](../chats/chat-settings.md)
- [Peek Prompt: ver qué recibió la IA](../chats/peek-prompt.md)
