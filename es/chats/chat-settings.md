# Descripción general de Chat Settings

**Chat Settings** (Ajustes del chat) es el panel de opciones del chat que tienes abierto: su modelo, sus personajes, sus agentes, la búsqueda, los resúmenes, las ramas y la galería. La mayoría de los ajustes pertenecen solo a ese chat.

## Abrir Chat Settings

1. Abre un chat.
2. Toca el botón **Chat Settings** (el icono de controles deslizantes). Se abre un panel. En un teléfono, **Help** (el **?**) muestra una guía de los iconos.
3. Toca el título de una sección para abrirla. Vuelve a tocar el título para contraerla.

Chat Settings se abre por sí solo al crear un chat. Para cerrarlo, toca su **X** o vuelve a tocar el botón de controles deslizantes.

En una computadora, el botón de controles deslizantes empieza arriba a la derecha del chat. Con el Tracker Panel visible a la derecha, empieza a la izquierda de ese panel. El Tracker Panel es un panel lateral de Roleplay que muestra lo que siguen los agentes (ayudantes que se ejecutan junto con las respuestas), como los personajes de la escena.

Puedes arrastrar el botón de controles deslizantes a un lugar mejor. Se alinea con los botones cercanos del chat mientras lo arrastras. En una computadora, mantén pulsada la tecla <kbd>Alt</kbd> para colocarlo libremente. Cada chat recuerda la posición. Un punto pequeño en el botón indica que los agentes están trabajando. En un chat de Roleplay con Advanced Memory Recall, un punto fijo en la otra esquina indica que algunas memorias de escenas necesitan atención. Consulta [Reparar problemas de memoria](../agents/memory.md#fixing-memory-problems).

La primera vez que abres un chat, un video corto muestra cómo organizar los botones y las ventanas. Haz clic en **Got it** (Entendido). No vuelve a aparecer en tus otros chats ni tras actualizar la página. Para mantener ocultos los consejos de diseño en un chat, haz clic en la **X** que hay junto a ellos (**Hide these tips for this chat**, Ocultar estos consejos en este chat).

## Las secciones de un vistazo

Las secciones que ves dependen del modo del chat. La sección **Impersonate** se explica en [Generación guiada e Impersonate](guided-and-impersonate.md).

- Barra de perfiles de ajustes: aplica o guarda un paquete de ajustes del chat. Consulta [Perfiles de ajustes](settings-profiles.md). (Conversation, Roleplay.)
- **Search messages** (Buscar mensajes): encuentra mensajes por palabras, o por `#` y un número de mensaje. Sus pestañas **Bookmarks** (Marcadores) y **Trash** (Papelera) muestran los mensajes marcados y los eliminados. (No en Game.)
- **Chat Name** (Nombre del chat): el nombre que aparece en tu lista de chats. Haz clic en él para cambiarlo. Nunca se envía al modelo.
- **Chat Branches** (Ramas de chat): cambia, renombra, exporta e importa ramas. Consulta [Ramas de chat](branches.md).
- **Connection** (Conexión): qué modelo responde en este chat. Consulta más abajo.
- **Prompt Preset** (Preset de prompt): la estructura guardada del prompt (las instrucciones enviadas a la IA) de este chat.
- **Advanced Parameters** (Parámetros avanzados): anula ajustes de generación, como la temperatura, para este chat. Consulta [Parámetros de generación](../prompts/generation-parameters.md).
- **Persona**: a quién interpretas tú. Consulta [Elegir tu persona en un chat](../characters/choosing-your-persona.md). (Conversation, Roleplay.)
- **Characters** (Personajes): los personajes del chat. (Conversation, Roleplay.)
- **Party** (Grupo): reemplaza a **Persona** y **Characters** en un solo lugar. (Game.)
- **Group Chat** (Chat grupal): quién habla en un grupo. Consulta [Chats grupales y conversaciones grupales](group-chats.md). (Chats con más de un personaje.)
- **Scoped Regex Scripts**: control por chat de los scripts de regex que pertenecen a un personaje. Consulta [Scripts de regex](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting). (Solo aparece cuando un personaje del chat tiene scripts limitados.)
- **Chat Variables** (Variables del chat): texto con nombre que reutilizas con `{{name}}`. Consulta más abajo.
- **Connected Chats** (Chats conectados): vincula un chat con otro. Consulta [Chats conectados](connected-chats.md).
- **Lorebooks** (Libros de trasfondo): adjunta datos del mundo. Consulta [Descripción general de los lorebooks](../lorebooks/overview.md).
- **Chat Summary** (Resumen del chat): revisa y crea resúmenes. Consulta [Memory Recall y resúmenes del chat](../agents/memory.md#chat-summary-roleplay). (Donde se usan resúmenes.)
- **Active Context** (Contexto activo): muestra los lorebooks y el contexto activos en este chat. Consulta [Presupuestos de tokens y recursión](../lorebooks/token-budgets.md#seeing-skipped-entries-in-active-context).
- **Agents** (Agentes): activa ayudantes. Consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).
- **Agent activity** (Actividad de los agentes): muestra lo que hicieron los agentes. Vuelve a ejecutar trackers, reintenta o detén agentes y borra trackers. Consulta [Agent activity](../roleplay/getting-started.md#agent-activity). (Roleplay, con agentes o Advanced Memory activados.)
- **Author's Notes** (Notas del autor): una nota que el modelo lee en cada turno. Consulta [Author's Notes](../roleplay/getting-started.md#authors-notes). (Roleplay.)
- **Background** (Fondo): la imagen de fondo del chat. (Roleplay, Game.)
- **Gallery** (Galería): las imágenes y los videos del chat. Consulta [Fondos de escena y la galería](../media/scene-backgrounds.md).
- **Widgets**: qué widgets del HUD se muestran en el juego. (Game.)
- **Impersonate**: ajustes del comando `/impersonate`. (Roleplay.)
- **Memory Recall**: recuerda partes anteriores del chat. Consulta [Memory Recall y resúmenes del chat](../agents/memory.md). (No está en la versión Lite.)
- **Function Calling** (Llamada a funciones): permite que el modelo use herramientas (funciones) en este chat.
- **Translation** (Traducción): traducción automática de mensajes. Consulta [Traducción de mensajes](../integrations/message-translation.md).

Los chats de Conversation también tienen las secciones Autonomous Messaging (los personajes te escriben primero), Commands (acciones que los personajes realizan por su cuenta) y de notas. Se explican en [Conversation Mode: primeros pasos](../conversation/getting-started.md).

## Elegir el modelo de un chat

La sección **Connection** elige el modelo que responde en este chat. Una elección cambia solo este chat.

1. Abre **Chat Settings** y la sección **Connection**.
2. Toca el campo **Model** (Modelo). Muestra el modelo actual.
3. Comprueba si indica que el chat sigue a **Main** (Principal). Main es el modelo predeterminado que estableces en **Connections** (Conexiones).
4. Elige un modelo. El selector es el mismo que el del botón de modelo del área de entrada del chat. El modelo actual se queda arriba, con los modelos recientes y los modelos con estrella debajo, agrupados por cuenta. Busca entre modelos y cuentas, o usa **Browse** (Explorar) para abrir el catálogo de una cuenta.

**Follow Main** (Seguir al principal) quita la elección propia del chat, así que el chat cambia cuando cambias Main. **Shuffle** (Aleatorio) elige un modelo distinto de tu grupo para cada respuesta. Consulta [Shuffle](../connections/organizing-connections.md#shuffle). Si una cuenta necesita una clave o está desactivada, su modelo lleva a la acción para repararla. Para añadir una cuenta, consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).

## Usar variables del chat

Una variable del chat es un nombre para un fragmento de texto. Por ejemplo, añade `char1` con el valor `Mary` y luego escribe `{{char1}} walks in.` en un mensaje. El modelo lee "Mary walks in."

1. Abre **Chat Settings** y la sección **Chat Variables**.
2. Toca **Add variable** (Añadir variable) y luego rellena el **name** (nombre) y el **value** (valor) de la fila.
3. Pulsa <kbd>Enter</kbd> o haz clic fuera del campo para guardar. El botón de la papelera elimina una variable.

Los nombres usan letras, números y guiones bajos, empiezan con una letra o un guion bajo y tienen como máximo 64 caracteres. Un nombre de exactamente 21 caracteres está reservado para referencias a personajes. Se rechaza un nombre que pertenezca a una macro integrada, como `char` o `user`.

- Tu mensaje sigue mostrando la etiqueta que escribiste. Solo el modelo ve el valor. Cambiar un valor más adelante cambia todos los turnos anteriores que usaron la etiqueta.
- Las variables pertenecen solo a este chat y se conservan tras un reinicio.
- Es el mismo almacenamiento que usa `{{setvar}}`. Una sección del prompt o una entrada de lorebook que establezca el mismo nombre sobrescribe tu valor.

Si tienes muchas variables, haz clic en **Search and edit all in the State Editor** (Buscar y editar todo en el State Editor). Muestra todas las variables para que puedas buscar, editar, pegar muchas a la vez como JSON y revisar los cambios antes de guardar. Consulta [El State Editor](../roleplay/hud-and-trackers.md#the-state-editor). Para otras macros con llaves dobles, consulta [Macros de prompt](../prompts/macros.md).

<a id="settings-profiles"></a>

## Perfiles de ajustes

Un perfil de ajustes es un paquete guardado de ajustes del chat que puedes aplicar a otros chats. La barra de perfiles está en la parte superior del panel y no aparece en Game. Cómo guardar, aplicar, importar, exportar y elegir uno predeterminado se explica en [Perfiles de ajustes](settings-profiles.md).

## Mover, fijar y bloquear la ventana

En una computadora, Chat Settings flota sobre el chat y su contenido se reorganiza para ajustarse a su tamaño. Una ventana se abre debajo de su botón la primera vez, o en su posición guardada.

- Moverla: arrastra su barra de título. O coloca el foco en la barra de título y usa las teclas de flecha, con <kbd>Shift</kbd> para dar pasos más grandes.
- Cambiar su tamaño: arrastra un borde o una esquina. O coloca el foco en el tirador de la esquina inferior derecha y usa las teclas de flecha.
- Fijarla: haz clic en **Pin** (Fijar). Una ventana fijada sigue abierta cuando haces clic en otro sitio y se vuelve a abrir tras actualizar la página. Una ventana sin fijar se cierra cuando haces clic fuera de ella o pulsas <kbd>Esc</kbd>, salvo que estés escribiendo o usando un menú abierto.
- Bloquearla: haz clic en **Lock** (Bloquear). La ventana no se puede mover ni cambiar de tamaño, y su botón se queda en su sitio. Aún puedes abrirla.
- Cerrarla: haz clic en **X**.

Las ventanas permanecen dentro del área del chat. Una ventana o un botón pueden colocarse junto al cuadro de mensaje, pero nunca lo cubren. En un teléfono, Chat Settings se abre como un panel de ancho completo que se ajusta por encima del teclado.

## Ayuda, trackers y Reset View

Estos botones están en la barra de título.

- **Help** (el **?**) muestra etiquetas que explican los controles del chat. En un teléfono, primero cierra Chat Settings. Para ocultarlo, activa **Settings → General → App Behavior → Hide chat Help button** (Configuración → General → Comportamiento de la app → Ocultar el botón de ayuda del chat).
- **Reset View** (la flecha circular) pide confirmación y luego restaura el diseño inicial de este chat: las secciones separadas vuelven a su sitio y se restablecen los tamaños, las posiciones, las fijaciones y los bloqueos de las ventanas.
- **Favorite layout** (la estrella) guarda esta disposición para los chats nuevos. Consulta [Elegir un diseño para chats nuevos](#choosing-a-layout-for-new-chats).
- **Tracker Panel** (el dado) activa o desactiva el panel en un chat de Roleplay que use agentes o Advanced Memory. En una computadora se abre junto al chat. En un teléfono o una tableta, lo abre un botón móvil. También cambia la preferencia de Tracker Panel en **Settings → Appearance** (Configuración → Apariencia).

Cuando el Tracker Panel no se muestra, los trackers de computadora usan la [ventana Trackers](../roleplay/hud-and-trackers.md#the-trackers-window). Si hay poco espacio junto a tus mensajes, empieza como un botón pequeño **Trackers**. Usa el dado para volver a mostrar el Tracker Panel.

<a id="popping-a-section-out-into-its-own-window"></a>

## Sacar una sección a su propia ventana

Saca una sección para darle su propia ventana.

1. Haz clic en el botón **Pop out** (Separar) de la sección (el cuadro con una flecha, junto a su **?**). En una computadora también puedes arrastrar el título de la sección fuera de Chat Settings.
2. Mueve, cambia el tamaño, fija o bloquea la nueva ventana igual que Chat Settings. Empieza sin fijar, así que al hacer clic en otro sitio se reduce a un botón.
3. Para devolverla, haz clic en **Put back in Chat Settings** (la flecha curva junto a **X**), o arrastra la ventana sobre Chat Settings.

**X** reduce la sección a un botón pequeño con su icono. Arrastra el botón donde quieras y haz clic en él para volver a abrir la ventana. Los trackers salen de la ventana Trackers del mismo modo, y su botón de retorno es **Put back in Trackers**.

En un teléfono, sacar una sección cierra Chat Settings y la añade al menú de tres puntos **Chat tools** (Herramientas del chat). Toca los puntos y luego el icono redondo de la sección. Toca **Put back in Chat Settings** para devolverla.

<a id="the-phones-chat-tools-menu"></a>

## El menú Chat tools del teléfono

El botón móvil de tres puntos reúne las herramientas que sacaste de Chat Settings. Tócalo para desplegar botones redondos con iconos y luego toca una herramienta. Vuelve a tocar los puntos para plegarlos. Los botones de los trackers, el botón del mapa de Game y Character Profiles siguen separados.

Arrastra el botón de tres puntos para mover el menú. Ábrelo y usa el candado de arriba para dejarlo fijo en su sitio. Mientras está desbloqueado, arrastra una herramienta hacia arriba o hacia abajo para cambiar su orden, o coloca el foco en ella y usa las teclas de flecha. Bloquearlo impide tanto moverlo como cambiar el orden. El menú sigue tu estilo de widgets del chat.

<a id="control-windows-and-their-buttons"></a>

## Ventanas de controles y sus botones

Algunas herramientas abren sus propias ventanas pequeñas: **Game controls**, **Session**, **Volume** y **Game Assets** de un juego; **Connected chat**; y los controles de los paquetes instalados.

En una computadora, estos botones empiezan cerca de la esquina superior derecha del chat. Haz clic en uno para abrir su ventana. Al cerrar la ventana, vuelve el botón. En un teléfono, están en el menú **Chat tools** y se abren como paneles de ancho completo.

Para guardar una dentro de Chat Settings, abre su ventana y elige **Put back in Chat Settings**. Usa el botón de separar de la sección para volver a separarla. **Reset View** restaura la disposición inicial.

Arrastra un botón para moverlo. Los botones cercanos se alinean mientras lo arrastras. Mantén pulsada la tecla <kbd>Alt</kbd> para colocarlo libremente, o usa las teclas de flecha mientras tiene el foco. **Calls** de Conversation sigue siendo un botón normal. En Game, **Character Profiles** (Perfiles de personajes) y el botón **Map** (Mapa) del teléfono se pueden mover, y su candado conserva las posiciones de cada juego.

## Cada chat guarda su propio diseño de ventanas

Cada chat recuerda los tamaños y las posiciones de las ventanas, las fijaciones y los bloqueos, las secciones separadas y las posiciones de los botones. Las posiciones del teléfono y el orden y el bloqueo de Chat tools se guardan por separado de las posiciones de computadora. Un [perfil de ajustes](settings-profiles.md) puede guardar un diseño para otros chats.

<a id="choosing-a-layout-for-new-chats"></a>

## Elegir un diseño para chats nuevos

La estrella junto a **Reset View** convierte tu disposición actual en el diseño inicial de los chats nuevos del mismo modo. Conversation, Roleplay y Game tienen cada uno su propio favorito.

1. Organiza las ventanas y los botones. Guarda las herramientas dentro de Chat Settings o sácalas.
2. Oculta los consejos de diseño si los chats nuevos también deben ocultarlos.
3. Haz clic en la estrella. Se rellena cuando el diseño actual, los consejos y el modo de Scoped Regex Scripts coinciden con tu favorito guardado.

El favorito guarda las posiciones, los tamaños, las fijaciones, los bloqueos, las herramientas separadas o acopladas, la elección de los consejos de diseño y el modo de [Scoped Regex Scripts](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting) del chat. Un chat en **Use preset default** (Usar el valor predeterminado del preset) no guarda ningún modo, así que los chats nuevos siguen su preset de prompt. Los personajes, el modelo, los ajustes de IA y los mensajes se quedan con el chat.

Para reemplazar el favorito, cambia la disposición y vuelve a hacer clic en la estrella. Para dejar de usarlo, haz clic en la estrella rellena. Esto solo afecta a los chats que crees después.

Un perfil de ajustes con su propio diseño guardado tiene prioridad sobre el favorito al aplicarlo. Un perfil sin diseño guardado deja la disposición favorita en su sitio. Los perfiles siguen aplicando su propio ajuste de consejos de diseño y su propio modo de Scoped Regex Scripts. Consulta [Perfiles de ajustes](settings-profiles.md#favorite-window-layouts).

Después de actualizar desde una versión anterior, tu antigua disposición de botones de herramientas ya está marcada con estrella en los tres modos, hasta que la reemplaces o la borres. Una instalación nueva tiene las herramientas dentro de Chat Settings y ningún favorito.

## Cambiar el aspecto de las ventanas del chat

Abre **Settings → Appearance → App** (Configuración → Apariencia → App) y desplázate hasta **Chat widget style** (Estilo de widgets del chat), al final de **App Style**. **Default** conserva el aspecto de Marinara. **Dottore** usa azules de hielo, metal claro y esquinas recortadas. **Prof. Mari** usa azules de piedras preciosas, dorado cálido y marcos arqueados. Ambos se adaptan al modo claro y oscuro y dan estilo a los botones móviles, las ventanas y las secciones de los tres modos de chat.

- **Font** (Fuente), **Shape** (Forma) y tres selectores de color debajo de los presets combinan el aspecto. Las fuentes instaladas en Marinara aparecen en la lista de fuentes. Elegir de nuevo un preset restablece la fuente, la forma y los colores personalizados.
- **Button size (px)** (Tamaño del botón en píxeles) define el tamaño de los botones móviles del chat, de 32 a 96. Un campo vacío conserva el valor predeterminado.
- **Apply preset font** (Aplicar fuente del preset), **Apply preset shape** (Aplicar forma del preset) y **Apply preset colors** (Aplicar colores del preset) extienden el estilo a los mensajes, los campos de entrada y los controles del chat. Cada uno funciona por su cuenta, y todos empiezan desactivados. Los mensajes de Conversation usan la fuente y los colores, pero conservan su propia forma. Con **Apply preset colors** activado, el diálogo entrecomillado conserva el Dialogue Highlight Color propio de cada personaje o persona.

Estas elecciones no mueven tus ventanas. Se guardan con tus preferencias de la app y se sincronizan con los navegadores conectados al mismo servidor. Consulta [Temas de CSS personalizado](../appearance/custom-css-themes.md#ready-made-chat-window-styles).
