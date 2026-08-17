# HUD y trackers de Roleplay

Esta guía explica el HUD de Roleplay y los pequeños widgets tracker que muestra. Aprenderás a editar y bloquear sus valores, y cómo funciona el Tracker Panel más grande. Aplica al Roleplay Mode en Marinara Engine.

## Qué es el HUD

El HUD (barra de estado en pantalla, del inglés heads-up display) es una fila de pequeños widgets con iconos en la parte superior del área del chat. Cada widget muestra una parte del estado vivo de la historia, como la hora, tus estadísticas o quién está presente. Marinara mantiene estos valores actualizados por ti a medida que avanza la historia.

Los valores vienen de los tracker (agentes de seguimiento). Un agente es un pequeño ayudante de IA que corre en segundo plano. Cada tracker vigila la historia y actualiza una parte del HUD después de cada mensaje. No tienes que pedirlo.

Un widget solo aparece cuando su tracker está activado para el chat. Activas y desactivas los agentes en **Chat Settings** (Ajustes del chat), dentro de la sección **Agents**. Si no hay ningún tracker activado, el HUD muestra solo el botón **Agents & Actions** y ningún widget.

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

Para cambiar una cantidad que ahora mismo es uno, activa el modo de añadir o el modo de bloqueo: ambos muestran el control de cantidad en todas las entradas.

El widget **Present Characters** muestra hasta tres emoji de personaje más un conteo "+N" para los adicionales. Los widgets **Inventory** y **Custom Tracker** van rotando sus entradas de una en una.

## Editar valores en un panel emergente

Haz clic en cualquier widget para abrir su panel emergente. Un panel emergente es un pequeño panel flotante. Cada campo dentro de él es editable, así que puedes corregir un valor que la IA acertó mal. Tus ediciones se guardan de inmediato.

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

En **Chat Settings → Agents**, **Manual Trackers** mueve todos los trackers activados a control manual. En su lugar, puedes dejar ese interruptor apagado y poner en manual solo agentes seleccionados en **Individual tracker schedule**. Un botón de refresco aparece en la fila del HUD siempre que al menos un tracker esté en manual; haz clic en él para ejecutar el conjunto de trackers manuales para el turno actual. El botón de refresco dentro de cada panel emergente de tracker sigue ejecutando ese tracker individual directamente.

El icono de destello al inicio de la fila del HUD abre el menú **Agents & Actions**. Desde ahí puedes volver a ejecutar todos los trackers, reintentar cualquier agente que falló, y usar **Clear Trackers** para borrar todo el estado del mundo seguido del chat. **Clear Trackers** no se puede deshacer, así que úsalo con cuidado.

## El Tracker Panel

El **Tracker Panel** es un panel lateral más grande que muestra los mismos datos de tracker que los widgets compactos del HUD. Da más espacio a las tarjetas de tracker y añade funciones de retrato y pensamiento. Lo configuras en **Settings** (Configuración), dentro de la pestaña **Appearance**, en la sección **Tracker Panel**.

Los controles en el encabezado del panel también te permiten personalizar la estructura del tracker:

- Haz clic en **+** para entrar en modo de añadir. La sección World gana **Add world field**, y cada tarjeta de personaje presente gana **Add custom field**. Los nombres de campo permanecen visibles en modo normal para que sus valores siempre sean entendibles.
- Haz clic en el icono de papelera para entrar en modo de borrado, y luego quita campos personalizados del mundo o del personaje. Quitar un campo también quita sus bloqueos de campo guardados.
- Haz clic en el icono de candado para entrar en modo de bloqueo. Los valores de campos personalizados siguen el mismo comportamiento de bloqueo que los valores de tracker integrados.
- Haz clic en el icono de ojo tachado para entrar en modo de ocultar, y luego elige **Mood**, **Look**, **Outfit** o **Thoughts** en una tarjeta de personaje. Los campos ocultos desaparecen del Tracker Panel y del HUD de Roleplay, se limpian y quedan bloqueados para que los tracker no los rellenen de nuevo. Entra en modo de ocultar otra vez para mostrar un campo oculto como un campo vacío.

Los nombres de campos personalizados definen la estructura y permanecen estables entre ejecuciones del tracker. Los tracker actualizan sus valores cuando la historia los cambia, mientras que la salida omitida del agente no borra los campos que creaste.

Estos ajustes lo controlan:

- **Tracker Panel**: el interruptor maestro de encendido o apagado. Está encendido de forma predeterminada. Cuando está encendido, la etiqueta dice "Shown in the Roleplay HUD".
- **Replace tracker HUD icons**: oculta la tira compacta de iconos para que el panel pueda acoplarse al borde de la pantalla en su lugar. El botón **Agents & Actions** permanece visible.
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
