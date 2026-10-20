# Personas de usuario: crear y editar

Esta guía explica qué es una persona, cómo crear y editar una, y cómo importar, exportar, duplicar y eliminar personas. Una persona es tu propia tarjeta de personaje: la identidad que Marinara Engine usa para representarte en un chat.

## Qué es una persona

Una persona es quién eres tú en un chat. Tiene un nombre, una descripción y otros datos opcionales. Marinara envía estos datos en cada prompt (las instrucciones enviadas a la IA), para que la IA sepa con quién está hablando.

Puedes crear muchas personas y guardarlas en el panel **Personas**. Elige qué persona usar en cada chat, o elige **None** (Ninguna) para no usar ninguna. Esta guía trata de crear y editar personas. Para saber cómo elegir qué persona usa un chat, consulta [Elegir tu persona en un chat](choosing-your-persona.md).

### El macro {{user}}

Un macro es un marcador de posición en tu texto que la app reemplaza por un valor real antes de enviar el prompt. El macro **{{user}}** se reemplaza por el nombre de la persona que el chat está usando. Es la persona seleccionada para el chat. Por ejemplo, si esa persona se llama Alex, entonces **{{user}}** se convierte en Alex en el prompt.

Si un chat no tiene persona seleccionada, la IA te llama con el nombre genérico "User" (Usuario), y no se envía ningún dato de persona. Para saber cómo un chat elige su persona, consulta [Elegir tu persona en un chat](choosing-your-persona.md). Para saber más sobre los macros, consulta [Macros](../prompts/macros.md).

## El panel Personas

El panel **Personas** es tu biblioteca de personas. Ábrelo desde el icono de persona en la barra superior de la barra lateral derecha. Está junto a los botones **Lorebooks**, **Presets**, **Connections** y **Agents**.

El panel te ofrece estos controles:

- **Download** (Descargar) abre el [Card Browser](bot-browser.md), donde también puedes encontrar personas en PlotLight.
- **Open Library** (Abrir biblioteca) abre la Persona Library de página completa y adaptable. Usa el mismo diseño de cuadrícula y vista previa que la Character Library, con descripciones de personas, secciones de tarjeta, etiquetas y estimaciones de tokens (los tokens son fragmentos de texto).
- **New** (Nuevo) crea una persona.
- **Import** (Importar) abre la ventana **Import Persona**.
- **Select** (Seleccionar) activa el modo de selección múltiple para que puedas actuar sobre muchas personas a la vez.
- El cuadro de búsqueda, con el texto de ejemplo **Search personas** (Buscar personas), coincide con el nombre, la descripción, el comentario y las etiquetas.
- El menú desplegable de orden ofrece **Manual order** (Orden manual), **A-Z**, **Z-A**, **Newest** (Más recientes), **Oldest** (Más antiguas) y **Tokens** (tamaño estimado del prompt). **Manual order** conserva el orden que tú fijes: arrastra una fila hacia arriba o hacia abajo, o pulsa Alt+Arriba o Alt+Abajo en una fila con el foco. En una pantalla táctil, mantén pulsada una fila para tomarla.
- **New Folder** (Nueva carpeta) crea una carpeta para organizar personas.
- El chip **Tags** (Etiquetas) despliega la lista de etiquetas para filtrar.

Cada fila muestra el avatar de la persona, su nombre y una vista previa corta de la descripción. Al pasar el cursor sobre una fila, aparecen las acciones **Duplicate** (Duplicar) y **Delete** (Eliminar). Haz clic en una fila para abrir esa persona en el **Persona Editor** (Editor de personas) de página completa.

Si tienes más personas de las que caben en una página, aparece un botón **Load more** (Cargar más) al final. Cuando todavía no tienes ninguna persona, el panel muestra un mensaje corto "No personas yet" (Todavía no hay personas).

## Crear una persona

1. Abre el panel **Personas**.
2. Haz clic en **New**. Se abre la ventana **Create Persona** (Crear persona).
3. Escribe un nombre en el campo **Name** (Nombre). Este es el único campo obligatorio.
4. Haz clic en **Create** (Crear).

La persona se crea con una descripción vacía. Se abre de inmediato en el **Persona Editor** completo para que puedas rellenar el resto. No puedes establecer otros campos en la ventana de creación. Todo lo demás se edita después en el **Persona Editor**.

Después de crear una persona, selecciónala en el chat donde quieras usarla.

## El Persona Editor

Al abrir una persona, se reemplaza el área de chat con el **Persona Editor** de página completa. El encabezado tiene:

- Una flecha **Back** (Atrás) para cerrar el editor.
- El recuadro del avatar. Haz clic en él para subir un avatar nuevo. Si tienes configurada una conexión de generación de imágenes, aquí también aparece un botón de varita **Generate avatar** (Generar avatar).
- El campo de nombre y un campo de comentario (para una nota corta como "Versión AU moderna").
- Un botón **Save** (Guardar). Permanece atenuado hasta que hagas un cambio.
- Acciones de icono del encabezado: **Export persona** (Exportar persona), **Add persona as character** (Añadir persona como personaje), **Duplicate persona** (Duplicar persona) y **Delete persona** (Eliminar persona).

Si intentas salir con cambios sin guardar, aparece un aviso que dice "You have unsaved changes. Close without saving?" (Tienes cambios sin guardar. ¿Cerrar sin guardar?). Te ofrece **Keep editing** (Seguir editando), **Discard & close** (Descartar y cerrar) y **Save & close** (Guardar y cerrar).

El cuerpo del editor tiene una fila de pestañas, en este orden: **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors** y **Stats**.

### Pestaña Metadata

La pestaña **Metadata** (Metadatos) contiene la información de identidad y de biblioteca:

- Una fila **Persona ID** (ID de persona) con un botón **Copy** (Copiar). La mayoría de la gente nunca lo necesita. Es útil para solicitudes de soporte.
- El widget de recorte de avatar. Arrastra para reposicionar o hacer zoom en el recorte redondo del avatar.
- **Name**: el nombre visible de tu persona. Se inyecta en los prompts como tu identidad.
- **Creator** (Creador): quién hizo esta persona, para dar crédito cuando la compartas.
- **Phonetic name** (Nombre fonético): una anulación opcional de pronunciación. Se usa solo cuando el nombre de tu persona se lee en voz alta mediante text-to-speech (TTS, texto a voz). TTS es la función de la app que lee el texto en voz alta.
- **Title / Comment** (Título / Comentario): una nota privada corta que se muestra bajo el nombre en la biblioteca.
- **Version** (Versión): una cadena de versión de texto libre para llevar el control de tus propios cambios. Su valor predeterminado es **1.0**.
- **Tags**: etiquetas de texto libre. Pulsa Enter o haz clic en **Add** (Añadir) para agregar una. Un botón **Remove All** (Quitar todas) aparece una vez que tienes etiquetas. Las etiquetas se usan para filtrar en el panel **Personas**.
- **Creator Notes** (Notas del creador): una nota privada de varias líneas. No se envía a la IA.

El panel **Version history** (Historial de versiones) está debajo del campo **Version**. La sección "Historial de versiones" más abajo explica cómo funciona.

### Pestaña Card

La pestaña **Card** (Tarjeta) es donde escribes los campos centrales de la persona. Cada campo es un cuadro de texto grande con un recuento estimado de tokens en vivo debajo. Una barra de enlaces de salto te permite desplazarte a cada sección.

- **Description** (Descripción): tu identidad y rol generales. Esto se envía en cada prompt para que la IA sepa quién eres.
- **Personality** (Personalidad): tu temperamento, comportamiento, hábitos de habla y patrones emocionales.
- **Backstory** (Trasfondo): tu historia, origen, relaciones y eventos formativos.
- **Appearance** (Apariencia): descripción física, ropa y detalles visuales que el modelo debe recordar.
- **Image Appearance Override** (Apariencia alternativa para imágenes): un interruptor opcional debajo de **Appearance**, desactivado de forma predeterminada. Actívalo para mostrar un segundo cuadro para etiquetas de imagen breves que describan a tu persona, como la palabra de activación de una LoRA. Si está activado y el cuadro contiene texto, los prompts de imagen usan esas etiquetas tal como están escritas y mantienen **Appearance** como contexto de fondo. El narrador siempre recibe el texto completo de **Appearance**.
- **Scenario** (Escenario): tu situación o contexto predeterminado para los roleplays. Úsalo para establecer dónde empieza tu persona.

Estos cuadros de texto admiten macros. Los caracteres de comilla que escribes se formatean automáticamente para coincidir con el estilo de comillas de tu app.

### Pestaña Convo

La pestaña **Convo** contiene campos que aplican solo en Conversation Mode. Nunca se envían en Roleplay ni en Game Mode. Incluyen **Convo Display Name**, **About Me** y **Convo Behavior**. Como se comparten con los personajes, tienen su propia guía. Consulta [Perfiles de Conversation Mode](../conversation/profiles.md).

### Pestaña Lorebook

La pestaña **Lorebook** (libro de trasfondo) te permite adjuntar entradas de lorebook a tu persona. Un lorebook es un conjunto de entradas de World Info que añaden trasfondo adicional cuando son relevantes. Las entradas vinculadas a una persona pueden activarse cuando esa persona está en el chat. Consulta [Descripción general de los Lorebooks](../lorebooks/overview.md).

### Pestaña Sprites

La pestaña **Sprites** (imágenes del personaje) te permite subir arte de personaje de pie para tu persona. Los sprites se usan en Game Mode y Roleplay. Tiene pestañas de categoría para **Facial Expressions** (Expresiones faciales), **Full-body** (Cuerpo completo) y **Clips**. Puedes subir una imagen a la vez o usar **Upload Folder** (Subir carpeta) para importar en bloque una carpeta de imágenes PNG. Como los sprites son un sistema compartido, consulta [Sprites de personaje](sprites.md) para todos los detalles.

### Pestaña Gallery

La pestaña **Gallery** (Galería) guarda arte de referencia y videos adjuntos a tu persona. Tiene dos subpestañas, **Images** (Imágenes) y **Videos**. Usa **Upload Persona Images** (Subir imágenes de la persona) o **Upload Persona Videos** (Subir videos de la persona) para añadir archivos. La subpestaña **Videos** también gestiona los clips de videollamada para la función de llamada del Conversation Mode. Consulta [Galerías de personajes y personas](galleries.md).

### Pestaña Colors

La pestaña **Colors** (Colores) define cómo se ve tu persona en el chat. Los colores se aplican a tu nombre, a tu diálogo y a la burbuja de tu mensaje.

- **Extract Colors from Avatar** (Extraer colores del avatar) elige colores automáticamente de la imagen de tu avatar. Permanece atenuado con "Upload an avatar first" (Sube un avatar primero) hasta que tengas un avatar.
- **Name Display Color** (Color del nombre) establece el color del nombre de tu persona. Acepta gradientes CSS.
- **Dialogue Highlight Color** (Color de resalte del diálogo) establece el color del texto entre comillas.
- **Message Box Color** (Color del cuadro de mensaje) establece el color de fondo de la burbuja de chat de tu persona.

Deja cualquiera de estos en blanco para usar los colores del tema predeterminado de la app. Para un recorrido más completo de colores y estadísticas, consulta [Colores de personaje y estadísticas RPG](colors-and-stats.md).

### Pestaña Stats

La pestaña **Stats** (Estadísticas) tiene dos bloques separados. Ambos alimentan la pantalla de estadísticas en pantalla (HUD, la barra de estado en pantalla) durante el chat.

- **Enable Persona Stats** (Activar estadísticas de la persona) activa barras de estado para necesidades como hambre, energía y ánimo. Cuando lo activas de nuevo, obtienes barras iniciales para Satiety (Saciedad), Energy (Energía), Hygiene (Higiene) y Mood (Ánimo), cada una en 100 de 100. El agente **Persona Stats** ajusta estos valores a medida que avanza la historia.
- **Enable RPG Attributes** (Activar atributos RPG) activa los Pools y los Attributes de estilo RPG. Cuando lo activas de nuevo, obtienes Pools iniciales de HP y MP en 100 de 100 y Attributes iniciales STR, DEX, CON, INT, WIS y CHA en 10. Estos valores se envían con la tarjeta de la persona para el combate y Game Mode, y para las tiradas opcionales en Roleplay o Game Mode. Los agentes de seguimiento no los actualizan.

Cuando hay instalado un conjunto de reglas de Game Mode, o la persona todavía conserva una ficha de un conjunto de reglas que ya no tienes, aparece un bloque **Ruleset sheets** (Fichas de conjuntos de reglas) debajo de estos dos. Contiene la configuración inicial de tu persona para cada conjunto de reglas, que copia cada partida nueva con ese conjunto de reglas. Consulta [Fichas de conjuntos de reglas](colors-and-stats.md#ruleset-sheets).

Los valores que estableces aquí son los predeterminados de inicio para los chats nuevos. Las Persona Status Bars pueden actualizarse automáticamente cuando el agente Persona Stats está activado; los Pools y los Attributes RPG de la persona no los gestiona ningún agente. Para la explicación completa, consulta [Colores de personaje y estadísticas RPG](colors-and-stats.md).

## Historial de versiones

Cada vez que guardas un cambio en los campos de tarjeta de una persona, Marinara guarda una instantánea automáticamente. El panel **Version history** en la pestaña **Metadata** lista estas versiones guardadas con una marca de tiempo.

Para cada versión guardada puedes:

1. Hacer clic en su título para abrir una vista de comparación contra la persona actual.
2. Hacer clic en **Rename this saved version** (Cambiar el nombre de esta versión guardada; icono de lápiz) para corregir la etiqueta de versión de la tarjeta sin restaurarla.
3. Hacer clic en **Restore this version** (Restaurar esta versión) para sobrescribir la persona actual con esa versión guardada. Un cuadro de diálogo de confirmación te pide que confirmes.
4. Hacer clic en **Delete this saved version** (Eliminar esta versión guardada) para quitar esa entrada del historial. Esto no cambia la persona actual.

Antes de tu primera edición, el panel dice "Previous persona states will appear here after the next edit." (Los estados anteriores de la persona aparecerán aquí después de la próxima edición.).

Usa **Reset** (Restablecer) en el encabezado del panel para eliminar todas las instantáneas guardadas de la persona y establecer la versión de la tarjeta actual en `0.0`. Marinara pide confirmación porque el historial eliminado no se puede recuperar.

## Duplicar una persona

Haz clic en **Duplicate** en una fila de persona, o en el icono **Duplicate persona** en el encabezado del **Persona Editor**. Esto hace una copia completa de la persona, con el nombre "{original name} (Copy)". Copia todos los campos de tarjeta, colores, estadísticas y campos de convo. Duplicar una persona no cambia la persona seleccionada en ningún chat.

## Eliminar personas

Para eliminar una persona, haz clic en el icono de papelera en su fila o en el icono **Delete persona** en el encabezado del **Persona Editor**. Aparece un cuadro de diálogo de confirmación. Eliminar una persona no se puede deshacer.

Para eliminar muchas a la vez, haz clic en **Select** en el panel **Personas** y marca las personas que quieras. Luego usa la barra de selección para hacer clic en **Delete**. Si alguna eliminación falla, los elementos fallidos siguen seleccionados para que puedas reintentar.

## Importar y exportar personas

### Importar

Haz clic en **Import** en el panel **Personas** para abrir la ventana **Import Persona**. Puedes arrastrar archivos dentro o hacer clic para explorar. Puedes importar muchos archivos a la vez. Acepta dos tipos de archivo:

- Archivos de paquete nativo **.marinara**. Estos restauran todos los datos de la persona, los sprites y la estructura de la galería.
- Archivos **.json**. Una exportación JSON de Marinara se importa por completo. Un archivo JSON genérico de otra herramienta se mapea campo por campo en una persona nueva. El nombre es obligatorio. Otros campos reconocidos se incorporan cuando están presentes.

Cada archivo muestra un icono de éxito o de fallo y un mensaje. Una línea de resumen muestra cuántos tuvieron éxito y cuántos fallaron.

### Exportar

Puedes exportar desde el icono **Export persona** en el **Persona Editor**, o con la acción en bloque **Export** en el modo de selección del panel. La ventana **Export Persona** ofrece dos formatos:

- **Marinara Native** (Nativo de Marinara): conserva todos los datos de persona de Marinara, los sprites y los lorebooks adjuntos. Usa esto para mover una persona entre instalaciones de Marinara.
- **Compatible JSON** (JSON compatible): exporta solo los campos simples de la persona. Usa esto para otras herramientas que no entienden el formato de Marinara.

Una exportación en bloque descarga un solo archivo zip con un archivo por cada persona seleccionada.

## Añadir persona como personaje

El encabezado del **Persona Editor** tiene un icono **Add persona as character**. Crea una nueva tarjeta de personaje en tu biblioteca de Characters. La nueva tarjeta copia el nombre, la descripción, la personalidad, el escenario, el trasfondo, la apariencia, las etiquetas, el creador, la versión y el avatar de tu persona.

Esto es útil cuando quieres jugar con una antigua persona como un personaje. No elimina ni cambia la persona original. Para saber sobre la edición de personajes, consulta [Crear y editar personajes](creating-and-editing-characters.md).

## Guías relacionadas

- [Elegir tu persona en un chat](choosing-your-persona.md)
- [Colores de personaje y estadísticas RPG](colors-and-stats.md)
- [Crear y editar personajes](creating-and-editing-characters.md)
- [Perfiles de Conversation Mode](../conversation/profiles.md)
- [Macros](../prompts/macros.md)
