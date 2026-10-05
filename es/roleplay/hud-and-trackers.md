# HUD y trackers de Roleplay

Esta guía explica los trackers de Roleplay: los widgets pequeños en teléfonos, la ventana **Trackers** y Tracker Panel en computadora. Aprenderás a editar y bloquear sus valores. Se aplica al modo Roleplay de Marinara Engine.

## Qué es el HUD

En un teléfono, el HUD (heads-up display) es una fila de widgets pequeños arriba del chat. Cada uno muestra una parte del estado de la historia, como la hora, tus estadísticas o quién está presente. Marinara actualiza estos valores a medida que avanza la historia.

En una computadora, los trackers no están en la fila del HUD. Aparecen en **Tracker Panel** cuando se muestra, y en caso contrario en la ventana **Trackers** descrita más abajo.

Los valores vienen de los tracker (agentes de seguimiento). Un agente es un pequeño ayudante de IA que corre en segundo plano. Cada tracker vigila la historia y actualiza una parte del HUD después de cada mensaje. No tienes que pedirlo.

Un widget solo aparece cuando su tracker está activado para el chat. Activas y desactivas los agentes en **Chat Settings** (Ajustes del chat), dentro de la sección **Agents**. Si no hay ningún tracker activado, el HUD no muestra widgets.

## Los widgets del HUD

Hay siete widgets tracker. Cada uno necesita su propio agente activado para aparecer.

| Widget                 | Necesita este agente | Muestra                                                                            |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------- |
| **World State**        | World State       | Ubicación, fecha, hora, clima, temperatura y tus campos personalizados del mundo         |
| **Persona Stats**      | Persona Stats     | Las barras de estado de tu persona y una línea de estado                                     |
| **Present Characters** | Character Tracker | Quién está en la escena, con ánimo, apariencia y campos personalizados propios del personaje |
| **Inventory**          | Persona Stats     | Los objetos que llevas, con cantidades                                          |
| **Inventory Tracker**  | Inventory Tracker | Listas separadas para monedas, equipo puesto y objetos que llevas                |
| **Active Quests**      | Quest Tracker     | Tu objetivo actual                                                           |
| **Custom Tracker**     | Custom Tracker    | Tus propios campos con nombre, como contadores o moneda                              |

Ten en cuenta que el widget **Inventory** lo alimenta el mismo agente **Persona Stats** que impulsa el widget **Persona Stats**. Activa **Persona Stats** para obtener ambos.

El **Inventory Tracker** dedicado es independiente del inventario de Persona Stats. Mantiene entradas compactas de nombre y cantidad en tres grupos, **Currencies**, **Equipped** e **Inventory**, y evita que el equipo puesto aparezca también entre los objetos que llevas.

Cada entrada es una pastilla pequeña. Las pastillas fluyen a lo ancho del panel y saltan a la línea siguiente, así una lista larga de objetos se sigue leyendo bien en vez de estirarse en una columna muy alta. La cantidad solo aparece cuando es mayor que uno, escrita como `×4` después del nombre; si hay un solo objeto se ve nada más el nombre. En un panel estrecho las pastillas se apilan una por línea.

Para cambiar una cantidad que ahora mismo es uno, activa **add mode** (modo de añadir) o **lock mode** (modo de bloqueo): ambos muestran el control de cantidad en todas las entradas.

El widget **Present Characters** muestra hasta tres emoji de personaje más un conteo "+N" para los adicionales. Los widgets **Inventory** y **Custom Tracker** van rotando sus entradas de una en una.

<a id="the-trackers-window"></a>

## La ventana Trackers

En una computadora, cuando **Tracker Panel** no se muestra, los trackers de Roleplay usan la ventana **Trackers**. Si hay espacio junto a los mensajes, se abre a la izquierda. Si no, empieza como un botón pequeño **Trackers** arriba a la izquierda del chat. Haz clic en él para abrirla. Un chat con diseño guardado conserva la disposición que elegiste.

Al actualizar un chat antiguo, sus widgets de trackers de computadora se agrupan en esta ventana. Las demás herramientas conservan sus iconos como botones móviles.

Puedes moverla por la barra de título, cambiar su tamaño desde los bordes y usar los botones de la esquina superior derecha:

- **Pin** la mantiene abierta al hacer clic fuera. Empieza fijada.
- **Lock** impide moverla o redimensionarla y fija su botón. El botón sigue abriendo la ventana, donde puedes desbloquearla.
- **Close** la reduce al botón móvil **Trackers**. Púlsalo para reabrirla donde la dejaste.

Para usar Tracker Panel, pulsa el dado de la barra de título de Chat Settings. Cuando el panel no se muestra, los trackers siguen disponibles en su ventana o botón. **Reset View** en Chat Settings borra la disposición guardada y elige la ventana o el botón inicial según el espacio disponible.

Mientras los agentes trabajan, aparece un punto pequeño junto al título de la ventana y en el botón **Chat Settings**.

Cada tracker tiene una sección plegable, llamada drawer. Haz clic en su encabezado para contraerla a la vista previa del widget pequeño, y otra vez para ver el tracker completo. Marinara recuerda qué secciones contrajiste.

Un tracker también puede tener su propia ventana: pulsa el botón para sacarlo junto a la flecha o arrastra su título fuera de Trackers. La ventana nueva empieza sin fijar. Fíjala para que permanezca abierta al hacer clic fuera o cerrar Trackers. Su **X** la reduce a un botón con el icono del tracker, que la reabre donde la dejaste. Pulsa **Put back in Trackers** (la flecha curva a la izquierda de **X**) o arrástrala sobre Trackers para devolverla. Cada chat recuerda qué trackers están fuera y dónde.

Al final, **Agent activity** muestra qué hicieron los agentes. Desde ahí puedes volver a ejecutar trackers, reintentar agentes fallidos, detener agentes en ejecución y usar **Clear Trackers**. Tracker Panel tiene la misma sección al final.

## Editar valores en un panel emergente

En un teléfono, toca un widget para abrir su panel emergente. En una computadora, los mismos editores están en las secciones de la ventana Trackers. Un panel emergente es un panel flotante pequeño. Todos sus campos son editables para que puedas corregir valores equivocados de la IA. Los cambios se guardan al instante.

Esto es lo que cada panel emergente te permite editar:

- **World State**: la **Location**, la **Date**, la **Time**, el **Weather**, la **Temperature** y las filas de campos personalizados del mundo.
- **Persona Stats**: una línea de **Status**, más barras de estadística con nombre, con un valor actual y un valor máximo. Puedes añadir o quitar barras.
- **Present Characters**: añade o quita personajes, y edita el emoji, el nombre, el **Mood**, el **Look**, el **Outfit**, los **Thinks** (pensamientos privados) y los valores de campos personalizados de cada uno. Puedes subir un avatar por personaje. Un botón **Auto** alterna entre "Auto-generate avatars: ON" y "Auto-generate avatars: OFF".
- **Inventory**: añade o quita objetos, y edita el nombre y la cantidad de cada objeto.
- **Inventory Tracker**: añade o quita entradas en **Currencies**, **Equipped** e **Inventory**, y edita el nombre o la cantidad de cada una. Mover un objeto de un grupo a otro todavía no es una sola acción: quítalo de un grupo y añádelo al otro.
- **Active Quests**: añade o quita misiones. Cada misión tiene objetivos con nombre con casillas de finalización.
- **Custom Tracker**: añade, quita o edita campos de nombre y valor.

## Modo de bloqueo

Los tracker sobrescriben los valores del HUD después de cada turno. Eso es útil, pero a veces un valor sigue desviándose mal y quieres fijarlo a mano. El modo de bloqueo hace esto.

Cuando un campo está bloqueado, la siguiente ejecución automática del tracker lo deja en paz. Los campos bloqueados están marcados para que los veas de un vistazo.

Para bloquear un campo:

1. Abre el panel emergente del widget.
2. Haz clic en el interruptor de bloqueo cerca de la parte superior del panel emergente. Su tooltip (texto de ayuda) dice **Enter lock mode**.
3. Ahora aparece un pequeño botón de bloqueo junto a cada valor editable.
4. Haz clic en el botón de bloqueo junto al valor que quieres fijar. Su tooltip dice **Lock field**.

Para desbloquear, haz clic en el mismo botón otra vez (tooltip **Unlock field**). Para salir del modo de bloqueo, haz clic en el interruptor superior otra vez (tooltip **Exit lock mode**). El modo de bloqueo se comparte en todo el HUD, así que activarlo en un panel emergente revela los botones de bloqueo en todas partes.

## Volver a ejecutar un tracker

Puedes forzar a un tracker a actualizarse en lugar de esperar al siguiente mensaje.

Dentro de cada panel emergente hay un pequeño botón de refresco (flecha circular). Haz clic en él para volver a ejecutar solo ese tracker para el último turno. Los tooltips nombran el tracker, por ejemplo **Re-run world state tracker only** o **Re-run quest tracker only**.

En **Chat Settings → Agents**, **Manual Trackers** pasa todos los trackers activados a control manual. También puedes dejarlo apagado y elegir solo algunos agentes en **Individual tracker schedule**. Si hay al menos un tracker manual, aparece un botón de refresco: en la fila del HUD en teléfono, y junto al título de Trackers en computadora. Púlsalo para ejecutar los trackers manuales en el turno actual. El refresco dentro de cada tracker sigue ejecutando solo ese tracker.

**Agent activity** tiene su propia sección debajo de **Agents** en **Chat Settings**, al final de Tracker Panel y, en computadora, al final de la ventana Trackers. Desde ahí puedes volver a ejecutar todos los trackers, reintentar agentes fallidos y usar **Clear Trackers** para borrar todo el estado del mundo registrado en el chat. **Clear Trackers** no se puede deshacer; úsalo con cuidado.

## El Tracker Panel

El **Tracker Panel** es un panel lateral más grande que muestra los mismos datos de tracker que los widgets compactos del HUD. Da más espacio a las tarjetas de tracker y añade funciones de retrato y pensamiento. Lo configuras en **Settings** (Configuración), dentro de la pestaña **Appearance**, en la sección **Tracker Panel**.

Para activarlo en un chat de Roleplay, abre **Chat Settings** y pulsa **Tracker Panel** (el dado) en la barra de título, junto a fijar y bloquear. Queda resaltado mientras el panel está activo, y el panel aparece junto al chat. Púlsalo otra vez para desactivarlo y ocultarlo. En una computadora, los trackers pasan a la ventana Trackers.

En un teléfono, activarlo añade al chat un botón Tracker Panel que puedes arrastrar donde quieras. Tócalo para abrir el panel; cerrarlo devuelve el botón. Con el panel apagado, la fila del HUD conserva los widgets.

Los controles en el encabezado del panel también te permiten personalizar la estructura del tracker:

- Haz clic en **+** para entrar en modo de añadir. La sección World gana **Add world field**, y cada tarjeta de personaje presente gana **Add custom field**. Los nombres de campo permanecen visibles en modo normal para que sus valores siempre sean entendibles.
- Haz clic en el icono de papelera para entrar en modo de borrado, y luego quita campos personalizados del mundo o del personaje. Quitar un campo también quita sus bloqueos de campo guardados.
- Haz clic en el icono de candado para entrar en modo de bloqueo. Los valores de campos personalizados siguen el mismo comportamiento de bloqueo que los valores de tracker integrados.
- Haz clic en el icono de ojo tachado para entrar en modo de ocultar, y luego elige **Mood**, **Look**, **Outfit** o **Thoughts** en una tarjeta de personaje. Los campos ocultos desaparecen del Tracker Panel y del HUD de Roleplay, se limpian y quedan bloqueados para que los tracker no los rellenen de nuevo. Entra en modo de ocultar otra vez para mostrar un campo oculto como un campo vacío.

Los nombres de campos personalizados definen la estructura y permanecen estables entre ejecuciones del tracker. Los tracker actualizan sus valores cuando la historia los cambia, mientras que la salida omitida del agente no borra los campos que creaste.

Estos ajustes lo controlan:

- **Tracker Panel**: el interruptor principal, el mismo que controla el dado de Chat Settings. Está activado de forma predeterminada. Cuando está activo, la etiqueta dice "Shown in the Roleplay HUD". Cuando está apagado, los trackers de computadora aparecen en la ventana Trackers.
- **Replace tracker HUD icons**: oculta la tira compacta de iconos en teléfonos y permite acoplar el panel al borde de la pantalla.
- **Use expression sprites for tracker portraits**: permite que los retratos del tracker usen el sprite (imagen del personaje) de expresión de un personaje (su retrato de emoción actual) en lugar del avatar simple, cuando existe uno. Los sprites de expresión se explican en [Sprites de personaje](../characters/sprites.md).
- **Panel background**: un selector de color o gradiente para el fondo del panel.
- **Desktop size**: elige el ancho del panel. Las opciones son **Compact**, **Standard** y **Expanded**.
- **Thought display mode**: elige cómo aparecen los pensamientos de un personaje. **Docked** los abre dentro de la tarjeta de personaje. **Floating** los abre como un globo junto al retrato.
- **Always show Docked thoughts**: cuando **Thought display mode** está en **Docked**, mantiene visible el pensamiento de cada personaje destacado en lugar de esconderlo detrás de un botón.
- **Temperature unit**: cambia las pantallas de temperatura entre **Celsius** y **Fahrenheit**. El valor predeterminado es Celsius. Esto cambia solo la visualización, no el valor de estado del mundo guardado.

## Qué agentes rellenan el HUD

Cada widget del HUD lo rellena un tracker que corre después de cada turno. La tabla de widgets al inicio de esta guía enumera qué agente alimenta cada widget.

Para definir con qué barras de estadística y atributos de RPG empieza una persona o un personaje, usa la pestaña **Stats** en el editor de personaje o de persona. Los tracker luego ajustan esos valores a medida que se desarrolla la historia.

## Guías relacionadas

- [Referencia de agentes descargables](../agents/built-in-agents.md)
- [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md)
- [Colores de personaje y estadísticas de RPG](../characters/colors-and-stats.md)
- [Roleplay Mode: primeros pasos](getting-started.md)
- [Game Mode: widgets del HUD](../game/hud-widgets.md)
