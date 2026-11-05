# Personas

Una persona es la tarjeta de personaje que te representa en un chat: tu nombre, tu descripción y otros datos opcionales. Marinara los envía en cada prompt (las instrucciones enviadas a la IA) para que la IA sepa con quién está hablando. Puedes tener muchas personas y elegir una por chat. Para usar una, consulta [Elegir tu persona en un chat](choosing-your-persona.md).

## Crear una persona

1. Haz clic en **Personas** en la barra de navegación superior. Si no aparece, abre primero **More** (Más).
2. Haz clic en **New** (Nuevo). Se abre la ventana **Create Persona** (Crear persona).
3. Escribe un nombre en **Name** (Nombre). Es el único campo obligatorio.
4. Haz clic en **Create** (Crear).

La persona se crea con una descripción vacía y se abre en el Persona Editor.

5. Abre la pestaña **Card** (Tarjeta) y escribe tu **Description** (Descripción): tu nombre, tu aspecto y cómo actúas.
6. Haz clic en **Save** (Guardar) en el encabezado.

Después, elígela en el chat donde quieras usarla. Consulta [Elegir tu persona en un chat](choosing-your-persona.md).

## Qué hace una persona

Marinara envía tu persona a la IA en cada prompt. Elige **None** (Ninguna) en un chat para no enviar ninguna persona. Sin persona, la IA te llama "User" (Usuario).

El macro `{{user}}` es un marcador de posición. Marinara lo reemplaza por el nombre de la persona antes de enviar el prompt. Si tu persona se llama Alex, `{{user}}` se convierte en Alex. Consulta [Macros](../prompts/macros.md).

## El panel Personas

El panel **Personas** es tu biblioteca de personas. Haz clic en una fila para abrir esa persona en el Persona Editor.

| Control | Qué hace |
| --- | --- |
| **Download** (Descargar) | Abre el [Card Browser](bot-browser.md), donde también puedes encontrar personas en PlotLight. |
| **Open Library** (Abrir biblioteca) | Abre la Persona Library a página completa, con la misma cuadrícula y vista previa que la Character Library. |
| **New** | Crea una persona. |
| **Import** (Importar) | Abre la ventana **Import Persona** (Importar persona). |
| **Select** (Seleccionar) | Activa el modo de selección para eliminar y exportar en lote. |
| Cuadro de búsqueda | Texto de marcador de posición **Search personas/tags** (Buscar personas/etiquetas). Coincide con el nombre, la descripción, el comentario y las etiquetas. Para las búsquedas por etiquetas, consulta [Búsqueda](library-organization.md#search). |
| Menú desplegable de orden | **Manual order** (Orden manual), **A-Z**, **Z-A**, **Newest** (Más recientes), **Oldest** (Más antiguas) o **Tokens** (tamaño estimado del prompt). |
| **New Folder** (Nueva carpeta) | Crea una carpeta. |
| **Tags** (Etiquetas) | Despliega la lista de etiquetas para filtrar. |

En **Manual order**, arrastra una fila, o pulsa <kbd>Alt</kbd>+<kbd>Up</kbd> o <kbd>Alt</kbd>+<kbd>Down</kbd> en una fila con el foco. En una pantalla táctil, mantén pulsada una fila para tomarla. Pasa el cursor sobre una fila para ver **Duplicate** (Duplicar) y **Delete** (Eliminar). Aparece un botón **Load more** (Cargar más) cuando hay más personas de las que muestra una página. Si no tienes ninguna, el panel dice **No personas yet** (Todavía no hay personas).

## El Persona Editor

Al abrir una persona, el área de chat se reemplaza por el Persona Editor a página completa. El encabezado tiene:

- Una flecha **Back** (Atrás).
- El recuadro del avatar. Haz clic en él para subir una imagen. Si tienes configurada una conexión de generación de imágenes, un botón de varita también genera una.
- El campo de nombre y un campo de comentario, para una etiqueta corta como `Modern AU version`.
- **Save**, que permanece desactivado hasta que cambies algo.
- **Export persona** (Exportar persona), **Add persona as character** (Añadir persona como personaje), **Duplicate persona** (Duplicar persona) y **Delete persona** (Eliminar persona).

Al salir del editor, primero se guardan tus cambios. Si el guardado falla, el editor permanece abierto con tu borrador.

Las pestañas, en orden, son **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors** y **Stats**. Cada pestaña salta a su sección de un único formulario largo.

El editor de personas funciona como el [Character Editor](creating-and-editing-characters.md). Las notas de abajo cubren lo que cambia.

| Pestaña | Notas propias de las personas |
| --- | --- |
| **Metadata** (Metadatos) | Datos de identidad y de biblioteca. Consulta la lista debajo de esta tabla. |
| **Card** | Consulta [Pestaña Card](#card-tab) más abajo. |
| **Convo** | Campos que solo se usan en el modo Conversation. Consulta [Perfiles de Conversation Mode](../conversation/profiles.md). |
| **Lorebook** | Adjunta entradas de lorebook (libro de trasfondo) que se activan cuando esta persona está en el chat. Consulta [Descripción general de los lorebooks](../lorebooks/overview.md). |
| **Sprites** | Arte de pie para Game y Roleplay. Tiene **Facial Expressions** (Expresiones faciales), **Full-body** (Cuerpo completo) y **Clips**, y **Upload Folder** (Subir carpeta). Consulta [Sprites de personaje](sprites.md). |
| **Gallery** (Galería) | Imágenes y videos de referencia, con **Upload Persona Images** (Subir imágenes de la persona) y **Upload Persona Videos** (Subir videos de la persona). Consulta [Galerías de personajes y personas](galleries.md). |
| **Colors** (Colores) | Colores del nombre, del diálogo y del cuadro de mensaje. Consulta [Colores de personaje y estadísticas RPG](colors-and-stats.md). |
| **Stats** (Estadísticas) | Barras de estado y atributos RPG. Consulta [Pestaña Stats](#stats-tab) más abajo. |

La pestaña **Metadata** muestra:

- **Persona ID** (ID de persona), con **Copy** (Copiar).
- El recorte del avatar.
- **Name** y **Creator** (Creador).
- **Phonetic name** (Nombre fonético), que solo se usa cuando el texto a voz (text-to-speech) lee tu nombre.
- **Title / Comment** (Título / Comentario), una etiqueta corta.
- **Version** (Versión), con `1.0` como valor predeterminado y un interruptor **Automatic versioning** (Control de versiones automático).
- **Tags**.
- **Creator Notes** (Notas del creador), que nunca se envían a la IA.

<a id="card-tab"></a>

### Pestaña Card

La pestaña **Card** contiene los campos que te describen ante la IA. Cada uno tiene una estimación en vivo de tokens (fragmentos de texto).

| Campo | Qué escribir | Se envía a la IA |
| --- | --- | --- |
| **Summary** (Resumen) | Una descripción general para la biblioteca y las vistas previas. | No |
| **Description** | Tu identidad y tu rol generales. | En cada prompt |
| **Personality** (Personalidad) | Temperamento, comportamiento, hábitos de habla. | Sí |
| **Backstory** (Trasfondo) | Historia, origen, relaciones. | Sí |
| **Appearance** (Apariencia) | Aspecto, ropa, detalles visuales. | Sí |
| **Scenario** (Escenario) | Tu situación predeterminada en los roleplays. | Sí |
| **Example Dialogue** (Diálogo de ejemplo) | Intercambios de muestra. Sepáralos con `<START>`. Usa `{{user}}` para tu persona y `{{char}}` para el otro personaje. | Sí |

**Image Appearance Override** (Apariencia alternativa para imágenes), debajo de **Appearance**, funciona igual que en los personajes. Consulta [Pestaña Card](creating-and-editing-characters.md#card-tab). Los cuadros de texto admiten macros.

Estas funciones son iguales que en los personajes, pero con la persona como sujeto:

- El botón de varita encima de cada campo lo escribe por ti. Consulta [Escribir un campo de la tarjeta con la varita](creating-and-editing-characters.md#write-a-card-field-with-the-wand).
- **Add Alternative Field** (Añadir campo alternativo), debajo de cada campo, da a los chats seleccionados una versión distinta. La lista **Active in** (Activo en) solo muestra los chats que usan esta persona, y las asignaciones se pausan cuando un chat elige otra persona. Consulta [Usar un campo alternativo en chats seleccionados](creating-and-editing-characters.md#use-an-alternative-field-in-selected-chats).
- **Version history** (Historial de versiones) está en la pestaña **Metadata**. Antes de tu primera edición dice `Previous persona states will appear here after the next edit.` **Reset** (Restablecer) elimina todas las instantáneas y establece la versión en 1.0. Consulta [Historial de versiones](creating-and-editing-characters.md#version-history).

<a id="stats-tab"></a>

### Pestaña Stats

La pestaña **Stats** tiene dos bloques separados. Ambos alimentan el HUD, el panel de estadísticas que se muestra en pantalla durante un chat.

- **Enable Persona Stats** (Activar estadísticas de la persona) activa las barras de estado, indicadores de necesidades como el hambre y el ánimo. Un bloque recién activado empieza con Satiety, Energy, Hygiene y Mood, cada una en 100 de 100. El agente **Persona Stats** las ajusta a medida que avanza la historia.
- **Enable RPG Attributes** (Activar atributos RPG) activa los Pools (barras como HP y MP) y los Attributes (números como la fuerza). Ambos se explican en [Colores de personaje y estadísticas RPG](colors-and-stats.md). Un bloque recién activado empieza con HP y MP en 100 de 100 y STR, DEX, CON, INT, WIS y CHA en 10. Se envían con la persona para el combate y Game Mode, y para las tiradas opcionales. Los agentes no los actualizan.

Un bloque **Game Mode Icon** (Icono de Game Mode) define la imagen de tu ficha en un combate de Game Mode. Consulta [Icono de Game Mode](colors-and-stats.md#game-mode-icon). Cuando hay instalado un conjunto de reglas de Game Mode (un conjunto de reglas para juegos de estilo de mesa), un bloque **Ruleset sheets** (Fichas de conjuntos de reglas) contiene tu configuración inicial para él. Consulta [Fichas de conjuntos de reglas](colors-and-stats.md#ruleset-sheets). Los valores que estableces son los predeterminados de inicio para los chats nuevos.

## Importar y exportar personas

Para importar, haz clic en **Import** en el panel **Personas**. La ventana **Import Persona** acepta archivos `.marinara` y `.json`, y varios a la vez. Un archivo de Marinara restaura todos los datos, los sprites y la estructura de la galería. Un archivo JSON genérico de otra herramienta se mapea campo por campo en una persona nueva. El nombre es obligatorio. Cada archivo muestra una marca de éxito o de fallo.

Para exportar, haz clic en **Export persona** en el editor, o usa **Export** (Exportar) en el modo de selección. La ventana **Export Persona** (Exportar persona) ofrece dos formatos:

| Formato | Qué obtienes |
| --- | --- |
| **Marinara Native** (Nativo de Marinara) | Todos los datos de persona de Marinara, los sprites y los lorebooks adjuntos. Úsalo para mover una persona entre instalaciones de Marinara. |
| **Compatible JSON** (JSON compatible) | Solo los campos simples de la persona, para otras herramientas. |

Una exportación en lote descarga un solo zip con un archivo por persona.

## Duplicar o eliminar una persona

Para duplicar, haz clic en **Duplicate** en una fila o en **Duplicate persona** en el editor. La copia se llama "{original name} (Copy)" y conserva todos los campos de tarjeta, colores, estadísticas y campos de convo. Ningún chat cambia de persona.

Para eliminar, haz clic en **Delete** en una fila o en **Delete persona** en el editor, y luego confirma. No se puede deshacer. Para eliminar muchas, haz clic en **Select**, marca las personas y usa **Delete** en la barra de selección. Si una eliminación falla, esas personas siguen seleccionadas para que puedas volver a intentarlo.

## Añadir una persona como personaje

**Add persona as character**, en el encabezado del editor, crea una tarjeta nueva entre tus personajes. Copia el nombre, la descripción, la personalidad, el escenario, el trasfondo, la apariencia, las etiquetas, el creador, la versión y el avatar. La persona queda como estaba. Para editar la tarjeta nueva, consulta [Crear y editar personajes](creating-and-editing-characters.md).

## Guías relacionadas

- [Elegir tu persona en un chat](choosing-your-persona.md)
- [Colores de personaje y estadísticas RPG](colors-and-stats.md)
- [Crear y editar personajes](creating-and-editing-characters.md)
- [Perfiles de Conversation Mode](../conversation/profiles.md)
- [Macros](../prompts/macros.md)
