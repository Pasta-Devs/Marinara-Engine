# HUD y trackers de Roleplay

El HUD (heads-up display) muestra detalles de la historia en vivo en un chat de Roleplay: la hora, el clima, quién está presente, tus estadísticas, tus objetos y tus misiones. Puedes corregir cualquier valor a mano, bloquear un valor para que la IA deje de cambiarlo y volver a ejecutar un tracker cuando quieras.

Los valores vienen de los agentes tracker. Un agente es un ayudante que se ejecuta junto a las respuestas. Un agente tracker vigila la historia y actualiza una parte del HUD después de cada mensaje. Un widget solo aparece cuando su agente está activado para el chat.

## Activar el HUD

1. Abre **Chat Settings** (Ajustes del chat) con el botón de controles deslizantes del chat.
2. Ve a **Agents** (Agentes) y activa **Enable Agents** (Activar agentes).
3. Añade los agentes desde las listas que hay debajo del interruptor. Para un HUD básico, añade primero **World State**. Añade **Persona Stats**, **Character Tracker** o **Quest Tracker** para tener más.
4. Envía un mensaje.

Después de la respuesta, aparece el tracker. En un teléfono ves el botón **World State**. En una computadora ves el **Tracker Panel** o la ventana **Trackers** (consulta más abajo). La tabla de widgets indica qué agente alimenta cada widget.

Si no funcionó: sin agentes tracker activados, el HUD no muestra widgets. Comprueba que **Enable Agents** está activado.

## Dónde aparece el HUD

En un teléfono, los trackers son los botones **World State** y **Player & Tracker**, que puedes mover. Toca uno para abrir su panel y **X** para cerrarlo. Cuando World State tiene detalles, su botón muestra un pequeño banner con la ubicación, el día, la hora, el clima y la temperatura. Arrastra los botones a cualquier lugar. Tu chat recuerda dónde los pusiste. Siguen tu **Chat widget style** (Estilo de widgets del chat) de **Settings → Appearance → App** (Configuración → Apariencia → App).

En una computadora, los mismos trackers aparecen en uno de dos lugares:

- El **Tracker Panel**: un panel lateral junto a tus mensajes. Está activado de forma predeterminada. El botón del dado en la barra de título de **Chat Settings** lo activa y lo desactiva.
- La ventana **Trackers**: una ventana que puedes mover y que contiene los trackers cuando el Tracker Panel está desactivado.

Solo usas uno de los dos a la vez. Consulta [El Tracker Panel](#the-tracker-panel) y [La ventana Trackers](#the-trackers-window).

## Los widgets del HUD

| Widget | Necesita este agente | Muestra |
| --- | --- | --- |
| **World State** | World State | Ubicación, fecha, hora, clima, temperatura y tus campos personalizados del mundo |
| **Persona Stats** | Persona Stats | Las barras de estado de tu persona y una línea de estado |
| **Present Characters** | Character Tracker | Quién está en la escena, con ánimo, aspecto y campos personalizados |
| **Inventory** | Persona Stats | Los objetos que llevas, con cantidades |
| **Inventory Tracker** | Inventory Tracker | Listas separadas para monedas, equipo puesto y objetos que llevas |
| **Active Quests** | Quest Tracker | Tu objetivo actual |
| **Custom Tracker** | Custom Tracker | Tus propios campos con nombre, como contadores o moneda |

El widget **Inventory** viene del agente **Persona Stats**, así que activa ese agente para tener ambos. El **Inventory Tracker** es independiente. Guarda las entradas en tres grupos, **Currencies**, **Equipped** e **Inventory**, y nunca muestra dos veces el equipo puesto.

Cada entrada es una pastilla pequeña. Una cantidad aparece como `×4` solo cuando es mayor que uno. Para cambiar una cantidad de uno, activa el modo de añadir o el modo de bloqueo: ambos muestran el control de cantidad en todas las entradas. El modo de añadir es el botón **+** de la cabecera del Tracker Panel. El [modo de bloqueo](#lock-mode) se explica más abajo.

**Present Characters** muestra hasta tres emoji de personaje más un conteo "+N". **Inventory** y **Custom Tracker** muestran sus entradas de una en una.

## Editar un valor de un tracker

Todos los campos son editables, así que puedes corregir un valor en el que la IA se equivocó. Tu edición se guarda al instante. La siguiente respuesta parte de tu valor corregido, también cuando regeneras la respuesta que corregiste o generas un swipe (respuesta alternativa) de ella.

1. Abre el tracker: toca su botón en un teléfono, o abre su sección en el Tracker Panel o en la ventana Trackers en una computadora.
2. Haz clic en el valor y escribe el nuevo.

- **World State**: **Location**, **Date**, **Time**, **Weather**, **Temperature** y los campos personalizados del mundo.
- **Persona Stats**: una línea de **Status** y barras con nombre, con un valor actual y un valor máximo. Añade o quita barras.
- **Present Characters**: añade o quita personajes. Edita el emoji, el nombre, el **Mood**, el **Look**, el **Outfit**, los **Thinks** (pensamientos privados) y los campos personalizados de cada uno. Puedes subir un avatar para cada uno. El botón **Auto** activa o desactiva "Auto-generate avatars".
- **Inventory**: añade o quita objetos. Edita los nombres y las cantidades.
- **Inventory Tracker**: añade o quita entradas en **Currencies**, **Equipped** e **Inventory**. Para mover un objeto a otro grupo, quítalo y añádelo allí.
- **Active Quests**: añade o quita misiones. Cada misión tiene objetivos con casillas.
- **Custom Tracker**: añade, quita o edita campos de nombre y valor.

Para corregir muchos valores a la vez, usa el [State Editor](#the-state-editor).

<a id="lock-mode"></a>

## Modo de bloqueo

Los agentes tracker sobrescriben los valores del HUD después de cada turno. El modo de bloqueo te permite fijar un valor. Cuando un campo está bloqueado, la siguiente ejecución automática lo deja en paz. Úsalo cuando un valor sigue desviándose mal.

1. Abre el tracker.
2. Haz clic en el interruptor de bloqueo cerca de la parte superior del tracker (tooltip **Enter lock mode**). Aparece un pequeño botón de bloqueo junto a cada valor editable.
3. Haz clic en el botón de bloqueo junto al valor (tooltip **Lock field**). Los campos bloqueados quedan marcados.

Para desbloquear, haz clic en el mismo botón otra vez (**Unlock field**). Para salir del modo de bloqueo, haz clic otra vez en el interruptor superior (**Exit lock mode**). El modo de bloqueo se comparte en todo el HUD, así que activarlo en un tracker muestra los botones de bloqueo en todas partes.

## Volver a ejecutar un tracker

Para actualizar un tracker ahora en lugar de esperar al siguiente mensaje, haz clic en el botón de flecha circular que tiene dentro. Vuelve a ejecutar solo ese tracker para el último turno. El tooltip (texto de ayuda) nombra el tracker, por ejemplo **Re-run world state tracker only**.

Para que un tracker se ejecute solo cuando lo pidas, abre **Chat Settings → Agents → Trackers Control** (Ajustes del chat → Agentes → Control de trackers) y activa el tracker en **Individual tracker schedule**. Un tracker manual no se ejecuta después de cada respuesta. Un chat que tenía activado el antiguo interruptor **Manual Trackers** muestra ahí todos los trackers activados.

Mientras haya al menos un tracker manual, aparece un botón de refresco: en la fila del HUD en un teléfono, y junto al título de la ventana Trackers en una computadora. Haz clic en él para ejecutar los trackers manuales en el turno actual.

**Agent activity** es el lugar para volver a ejecutar todos los trackers, reintentar agentes fallidos y usar **Clear Trackers**. Consulta [Agent activity](getting-started.md#agent-activity).

> **Advertencia:** **Clear Trackers** borra todo el estado del mundo registrado del chat y no se puede deshacer.

<a id="the-trackers-window"></a>

## La ventana Trackers

En una computadora, los trackers usan la ventana **Trackers** cuando el Tracker Panel está desactivado. Si hay espacio junto a tus mensajes, se abre a la izquierda. Si no, empieza como un pequeño botón **Trackers** arriba a la izquierda del chat. Haz clic en el botón para abrirla. Un chat con un diseño guardado conserva tu disposición.

Mueve la ventana por su barra de título y cambia su tamaño desde los bordes. Sus botones de arriba a la derecha son:

- **Pin**: la mantiene abierta cuando haces clic en otro lugar. Empieza fijada.
- **Lock**: impide moverla o cambiar su tamaño, y fija su botón en su sitio. El botón sigue abriendo la ventana.
- **Close**: la reduce al botón móvil **Trackers**.

**Reset View** (Restablecer vista) en Chat Settings borra la disposición guardada y elige la ventana o el botón inicial según el espacio.

Cada tracker tiene una sección plegable. Haz clic en su encabezado para contraerla a una vista previa pequeña, y otra vez para abrirla. Marinara recuerda cuáles contrajiste.

Para dar a un tracker su propia ventana, haz clic en el botón para sacarlo junto a su flecha, o arrastra su título fuera de la ventana Trackers. La ventana nueva empieza sin fijar. Fíjala para mantenerla abierta. **X** la reduce a un botón pequeño con el icono del tracker. **World State**, en cambio, se reduce a un banner con la misma ubicación, fecha, hora y clima que en un teléfono, para que puedas arrastrarlo a cualquier lugar, como la parte superior central del chat. Para devolver el tracker, haz clic en **Put back in Trackers** (la flecha curva a la izquierda de **X**) o arrástralo sobre la ventana Trackers. Cada chat recuerda qué trackers están fuera y dónde.

<a id="the-tracker-panel"></a>

## El Tracker Panel

El **Tracker Panel** es un panel lateral más grande con los mismos datos. También muestra retratos y pensamientos de los personajes.

1. Abre **Chat Settings**.
2. Haz clic en el botón **Tracker Panel** (el dado) de su barra de título, junto a fijar y bloquear. Queda resaltado mientras el panel está activado.
3. Haz clic otra vez para ocultar el panel. En una computadora, los trackers pasan entonces a la ventana Trackers.

En una computadora, el panel ocupa el espacio junto a tus mensajes, hasta el ancho que fija **Desktop size**. Cuando la ventana es demasiado estrecha para ambos, por ejemplo con la barra lateral de chats abierta, tus mensajes y el cuadro de mensaje se estrechan un poco. En un teléfono o una tableta, activarlo añade un botón Tracker Panel que puedes arrastrar. Tócalo para abrir el panel y vuelve a tocarlo para cerrarlo. Mientras el panel u otra pantalla cubre el chat, los botones móviles del chat se ocultan y vuelven a aparecer en los mismos lugares.

### Personalizar los campos del tracker

Los botones de la cabecera del panel cambian la estructura del tracker:

- **+** entra en el modo de añadir. La sección World gana **Add world field**, y cada tarjeta de personaje presente gana **Add custom field**. Los nombres de los campos siguen visibles en el modo normal.
- El icono de papelera entra en el modo de borrado, donde quitas campos personalizados del mundo o de los personajes. Quitar un campo también quita sus bloqueos.
- El icono de candado entra en el modo de bloqueo. Los campos personalizados siguen el mismo comportamiento de bloqueo que los integrados.
- El icono de ojo tachado entra en el modo de ocultar. Elige **Mood**, **Look**, **Outfit** o **Thoughts** en una tarjeta de personaje. Un campo oculto desaparece del Tracker Panel y del HUD, se vacía y queda bloqueado para que los agentes no lo rellenen. Entra otra vez en el modo de ocultar para mostrarlo como un campo vacío.

Los agentes actualizan los valores de tus campos personalizados. Nunca borran un campo que creaste.

### Crear un retrato nuevo

La tarjeta grande de un personaje puede crear un retrato nuevo cuando el Character Tracker tiene una conexión de imágenes. En una tarjeta compacta, haz clic en **Feature character card** (Destacar tarjeta de personaje) para abrir la grande. La ventana Trackers siempre muestra tarjetas grandes. Pasa el cursor sobre el retrato y haz clic en el botón del ojo para crear uno a partir del **Look**, o en el botón de la camisa para el **Look** y el **Outfit**. El botón de la camisa solo aparece cuando el personaje tiene un atuendo. El retrato anterior se queda hasta que el nuevo está listo. Si la creación falla, conservas el anterior. Los personajes que se muestran con el avatar de su tarjeta o con un sprite de expresión no tienen estos botones.

### Ajustes del Tracker Panel

Abre **Settings → Appearance** (Configuración → Apariencia), abre el grupo **Roleplay** y busca la sección **Tracker Panel**.

| Ajuste | Qué hace |
| --- | --- |
| **Tracker Panel** | El interruptor de activación, el mismo que acciona el dado. Activado de forma predeterminada. Cuando está activado, la etiqueta dice "Shown in the Roleplay HUD". |
| **Dock Tracker Panel to edge** | Coloca el panel contra el borde de la pantalla y mantiene los controles cercanos del chat fuera de su espacio. |
| **Use expression sprites for tracker portraits** | Usa el sprite de expresión actual de un personaje en lugar del avatar simple, cuando existe uno. Consulta [Sprites de personaje](../characters/sprites.md). |
| **Panel background** | Un color o un gradiente para el panel. |
| **Desktop size** | Ancho del panel: **Compact**, **Standard** o **Expanded**. |
| **Thought display mode** | **Docked** abre los pensamientos dentro de la tarjeta de personaje. **Floating** los abre como un globo junto al retrato. |
| **Always show Docked thoughts** | Con **Docked**, mantiene visible el pensamiento de cada personaje destacado en lugar de esconderlo detrás de un botón. |
| **Stat display mode** | Muestra las estadísticas como barras o como indicadores circulares. |
| **Temperature unit** | **°C** (predeterminado) o **°F**. Esto cambia solo la visualización, no el valor guardado. |

<a id="the-state-editor"></a>

## El State Editor

El **State Editor** muestra todos los trackers del turno actual en una sola ventana, para que puedas encontrar un valor y corregirlo sin abrir cada tracker. También funciona en un teléfono.

Ábrelo desde cualquiera de estos lugares:

- El engranaje (**Tracker panel settings**) de la cabecera del Tracker Panel y luego el botón **{ }** (**Open in State Editor**).
- El botón **{ }** de la barra de título de la ventana **Trackers**, o de un tracker que sacaste a su propia ventana.
- En un teléfono, el botón **{ }** de los paneles **World State** y **Player & Tracker**.
- El enlace **Open in State Editor** debajo de **Tracker Data** en **Agent Suite**.

Se abre en la sección del tracker desde el que llegaste. World State se abre en **Scene**, por ejemplo.

- **Línea del turno**: debajo del cuadro de búsqueda. Indica el mensaje y el swipe que estás editando, por ejemplo "Editing message #12 · swipe 2 of 3". **Latest** marca el turno más reciente. Cada swipe tiene su propio estado, así que cambia primero de swipe para editar otro.
- **Secciones**: **Scene**, **Present Characters**, **Persona Stats**, **Inventory Tracker**, **Custom Tracker Fields** y **Active Quests**. En un teléfono son chips sobre el editor. Un punto marca una sección cambiada.
- **Búsqueda**: escribe una clave o un valor, como `mood`. Haz clic en un resultado para ir a él.
- **Fields** (Campos): cada sección se abre como **Fields**, con cuadros para texto, números y valores de sí/no.
- **No value** (Sin valor): un campo vacío muestra una opción para elegir entre **Text** (Texto), **Number** (Número) u **On/off** (Sí/no).
- **Add item** (Añadir elemento): añade una entrada, copiando la de arriba.
- **Add** (Añadir): añade un campo con nombre a una sección o a una tarjeta vacía.
- **×**: quita una entrada o vacía un valor.
- **JSON**: edita los datos sin procesar. **Format** (Dar formato) los ordena. Una sección con JSON roto no se puede guardar hasta que lo corrijas.
- **Revert** (Revertir): deshace tus cambios en una sección.

Los personajes y las misiones pertenecen a la historia, así que aquí no puedes añadir sus tarjetas. Puedes editar las listas que contienen, como las estadísticas de un personaje.

Para guardar:

1. Haz clic en **Review changes** (Revisar cambios) para ver cada cambio, línea por línea.
2. Haz clic en **Save changes** (Guardar cambios). Esto escribe todas las secciones a la vez en el turno que estabas editando.

Hasta entonces tus borradores se quedan en la ventana, y al cerrarla se te pregunta antes de descartarlos.

Si no funcionó: si la historia avanzó mientras editabas, el editor no la sobrescribe. Una respuesta o un swipe nuevo, o una actualización de un tracker en una sección que cambiaste, hace que el guardado se rechace con un botón **Reload** (Recargar). **Reload** muestra el estado más reciente y descarta tus borradores.

## Guías relacionadas

- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Colores del personaje y estadísticas de historia](../characters/colors-and-stats.md): la pestaña **Stats** fija las barras y los atributos con los que empieza una persona o un personaje.
- [Modo Roleplay: primeros pasos](getting-started.md)
- [Game Mode: widgets del HUD](../game/hud-widgets.md)
