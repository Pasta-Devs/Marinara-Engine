# Temas de CSS personalizado (Theme Library)

Un tema de CSS personalizado vuelve a pintar todo Marinara. Usa la **Theme Library** (Biblioteca de temas) para crear, importar, exportar y cambiar de tema. Esta guía también enumera las variables y las clases de CSS que puede usar un tema, y explica cómo funcionan los temas junto con Card CSS. Para un cambio rápido sin CSS, consulta [Estilos de ventanas de chat listos para usar](#ready-made-chat-window-styles).

Antes de empezar: si abres Marinara desde otro dispositivo, como un teléfono, el servidor necesita un secreto de administrador antes de que puedas crear, editar, importar, activar o eliminar temas. En la computadora que ejecuta el servidor no hace falta ningún secreto.

1. En el servidor, define `ADMIN_SECRET` en el archivo `.env`.
2. En la app, abre **Settings → Advanced → Admin Access** (Configuración → Avanzado → Acceso de administrador) e ingresa el mismo valor.

Consulta la [Server Configuration Reference](../CONFIGURATION.md) y la [guía de Remote Access](../REMOTE_ACCESS.md). Para cambiar a un tema que alguien te dio, ve a [Activar un tema](#activating-a-theme).

## Qué es un tema personalizado

CSS, abreviatura de Cascading Style Sheets, es el código que define los colores, los bordes y el espaciado. Un tema es un bloque de CSS que puede cambiar el fondo de la página, el color de acento, las tarjetas, los bordes, el texto y más.

Los temas viven en la **Theme Library** de tu servidor de Marinara, así que se sincronizan con todos los dispositivos que se conectan al mismo servidor. La mayoría de los demás ajustes de apariencia permanecen en un solo dispositivo. Solo puede haber un tema activo a la vez, y puedes guardar tantos como quieras.

## Dónde encontrar la Theme Library

1. Abre **Settings**.
2. Abre la pestaña **Addons**.
3. Busca la sección **Theme Library**.

## Crear un tema

1. En la sección **Theme Library**, haz clic en **Create Theme**.
2. Escribe un nombre en el cuadro del nombre (muestra "Theme name...").
3. Escribe o pega tu CSS en el cuadro de texto grande.
4. Deja **Preview** activado para ver tus cambios en vivo mientras escribes. Desactívalo para detener la vista previa en vivo.
5. Haz clic en **Save**.

Un tema nuevo parte de una plantilla que enumera variables comunes como ejemplos comentados. Quita las marcas de comentario y pon tus propios valores. Un tema completamente nuevo se activa al guardarlo, y ves: Theme "My Theme" saved and activated.

Para cambiar un tema más adelante, búscalo en **Installed Themes**, haz clic en el icono de código (tooltip **Edit theme CSS**), edítalo y haz clic en **Save**. Editar no cambia qué tema está activo.

## Importar y exportar temas

Para importar un tema:

1. Haz clic en **Import File** en la sección **Theme Library**.
2. Elige un archivo `.css` o `.json`.
3. Lee el mensaje. Informa cuántos temas se importaron, se omitieron o fallaron.

Un archivo `.css` se convierte en un tema, con el nombre del archivo. Un archivo `.json` puede contener uno o varios temas. Importa tal cual un archivo exportado desde Marinara, o escribe tú mismo uno pequeño:

```json
{ "name": "My Theme", "css": "..." }
```

Los temas importados no se activan por sí solos. Se omite un tema con el mismo nombre y el mismo CSS que uno que ya está en el servidor.

Para exportar un tema, haz clic en el icono de subir (tooltip **Export theme**) de su fila en **Installed Themes**. Marinara descarga un archivo `.json` que puedes importar en otro lugar.

<a id="activating-a-theme"></a>

## Activar un tema

**Installed Themes** muestra todos los temas, con una entrada **Default Theme** en la parte superior.

1. Haz clic en el nombre de un tema para activarlo. Una marca de verificación muestra el activo.
2. Haz clic en **Default Theme** para desactivar la temática personalizada y volver al aspecto integrado.

**Reset Appearance** (Restablecer apariencia), en la parte superior de **App Style** en **Settings → Appearance** (Configuración → Apariencia), también desactiva el tema activo.

Para eliminar un tema, haz clic en el icono de papelera (tooltip **Remove theme**) y confirma en el cuadro de diálogo **Delete Theme**. Esto elimina permanentemente su CSS del servidor.

Si no funcionó: cuando la app se vea mal, revisa tanto el tema activo como cualquier Card CSS del chat. Consulta [Temas y Card CSS](#themes-and-card-css).

<a id="ready-made-chat-window-styles"></a>

## Estilos de ventanas de chat listos para usar

Antes de empezar: esto no necesita CSS.

1. Abre **Settings → Appearance → App** (Configuración → Apariencia → App).
2. Al final de **App Style**, busca **Chat widget style** (Estilo de widgets del chat).
3. Elige un estilo.

| Estilo | Aspecto |
| --- | --- |
| **Default** | El aspecto original. |
| **Dottore** | Marcos de instrumentos en azul hielo, bordes de metal claro y esquinas recortadas. |
| **Prof. Mari** | Marcos de cuento con ribetes dorados, azules de piedras preciosas y Protogemas en los títulos de las ventanas. Sus botones usan el mismo fondo que sus ventanas. |

Cada estilo tiene su propia fuente, funciona en modo claro y oscuro y da estilo a la vez a los botones, las ventanas y las secciones desplegables. Elegir un estilo restablece **Font**, **Shape** y los tres colores. Las posiciones de tus ventanas se mantienen.

Puedes cambiar estos por separado:

- **Font** y **Shape** siguen el estilo (**Preset font**, **Preset shape**) hasta que elijas otra.
- **Border & Buttons Color** cambia los contornos y los iconos de los botones. Los iconos usan el primer color de un degradado.
- **Background Color** rellena los botones, las ventanas, las secciones desplegables y los campos editables.
- **Text Color** cambia el texto de los widgets. Los degradados aparecen en títulos y etiquetas, y los campos editables usan el primer color.

Cada color tiene un selector de color para un color sólido y una opción de degradado. **Reset color**, junto a un control, vuelve a seguir los colores claros u oscuros del estilo. Los emblemas decorativos conservan sus colores originales.

### Llevar el estilo al chat

Tres interruptores debajo de los selectores de color extienden el estilo. Cada uno empieza desactivado y funciona por su cuenta. Desactivar uno restaura el estilo habitual del chat en esa parte, y elegir otro estilo conserva tus elecciones de los interruptores.

| Interruptor | Qué aplica |
| --- | --- |
| **Apply preset font** (Aplicar fuente del preset) | La fuente de los widgets, para los mensajes, los campos de entrada y los controles del chat. |
| **Apply preset shape** (Aplicar forma del preset) | La forma del marco, para los mensajes de Roleplay (clásico y novela visual), el cuadro de diálogo de Game, los campos de entrada y los controles. Los mensajes de Conversation conservan su propia forma. |
| **Apply preset colors** (Aplicar colores del preset) | Los colores del borde, el fondo y el texto en esas áreas, incluidos los mensajes de Conversation. También se aplican tus colores y degradados personalizados. El diálogo entrecomillado conserva el Dialogue Highlight Color propio de cada personaje o persona. Un mensaje hecho de HTML, como la tarjeta con estilo de un agente, conserva los colores de texto que fija por sí mismo. |

Los botones del historial —**Load More** (Cargar más), **Show older** (Mostrar anteriores)— siguen los interruptores igual que los demás controles del chat. En Game Mode también se aplican a los comentarios al margen, los widgets del HUD, el panel del mapa, las fichas de personaje, los registros, el inventario, los paneles de combate y los cuadros de diálogo. Professor Mari también puede crear temas personalizados para estas áreas.

Un tema personalizado puede seguir anulando los estilos. Las variables de ventanas y secciones que aparecen abajo tienen prioridad sobre los colores del estilo. Usa `--mari-window-font-family` para las letras de las ventanas, `--mari-drawer-radius` para las esquinas de las secciones y `--mari-window-ornament: none` para ocultar el adorno del título. Para quitar toda la decoración del estilo, elige primero **Default**.

<a id="themes-and-card-css"></a>

## Temas y Card CSS

Marinara tiene dos formas de agregar CSS personalizado, y ambas pueden estar activas a la vez.

- Un tema personalizado vuelve a pintar toda la app. Puede sobrescribir las variables base de Marinara, usar `!important` y usar `position: fixed`.
- Card CSS va incrustado en una tarjeta de personaje o de persona y se activa por chat. Se limpia de forma más estricta: no puede sobrescribir las variables base, se elimina `!important` y `position: fixed` se convierte en `position: absolute`. Da estilo a los mensajes del chat, no a toda la app. Consulta la [Card CSS Theming Guide](card-css-theming.md).

## Límites de tamaño y nombre

El nombre de un tema puede tener hasta 200 caracteres. El CSS puede tener hasta 256 KiB, medido en bytes UTF-8. Un tema más grande se rechaza cuando lo guardas o lo importas. El CSS de un tema personalizado también se limpia antes de ejecutarse: los estilos que cargan un archivo desde otro sitio web no funcionan. En su lugar, incrusta la imagen o la fuente como una URI `data:`.

## La referencia de variables de CSS

El editor de temas tiene una sección plegable **CSS Variable Reference**. Haz clic en ella para ver las variables más útiles que puedes sobrescribir. Un tema cambia la app al definir estas variables en un bloque `:root`. La referencia enumera estas variables:

| Variable | Qué controla |
| --- | --- |
| `--background` | Fondo de la página |
| `--foreground` | Texto principal |
| `--primary` | Acento y botones |
| `--primary-foreground` | Texto sobre el color primario |
| `--secondary` | Tarjetas y campos de entrada |
| `--card` | Fondo de las tarjetas |
| `--border` | Bordes |
| `--muted-foreground` | Texto atenuado |
| `--sidebar` | Fondo de la barra lateral |
| `--sidebar-border` | Borde de la barra lateral |
| `--marinara-shell-edge-border` | Borde del margen izquierdo y derecho |
| `--destructive` | Error y eliminación |
| `--popover` | Fondo del menú desplegable |
| `--accent` | Resaltados al pasar el cursor |

Un tema puede definir cualquier variable de CSS que use Marinara, no solo estas. Algunos efectos tienen sus propias variables. Por ejemplo, `--marinara-theme-accent-pulse: enabled` solicita la animación de pulso del acento.

## Dar estilo a ventanas y secciones del chat

En una computadora, **Chat Settings** se abre como ventana móvil. Sus secciones plegables se llaman **drawers**. Una sección puede salir a su propia ventana y luego minimizarse a un botón pequeño que puedes mover, llamado **bubble**.

Otras herramientas del chat también usan estas ventanas y botones, como Game controls, Session, Volume, Game Assets, los chats conectados y los controles de paquetes. En un teléfono, la mayoría de las ventanas se abren como paneles de ancho completo; Echo Chamber sigue siendo una ventana compacta que puedes mover y redimensionar. Las herramientas que sacas de Chat Settings aparecen en el menú móvil de tres puntos **Chat tools** (Herramientas del chat); los botones de los trackers siguen separados.

Las clases, los atributos de datos y las variables siguientes permiten dar estilo a estas partes juntas. Las reglas del tema reemplazan los valores predeterminados sin `!important`.

### Clases

| Parte | Clase |
| --- | --- |
| Ventana | `.mari-window` |
| Barra de título | `.mari-window__header` |
| Título y su icono | `.mari-window__title-row` |
| Título | `.mari-window__title` |
| Botones de la barra de título (Reset View, estrella de diseño favorito, Tracker Panel, fijar, bloquear, cerrar, Put back) | `.mari-window__controls` (cada botón es `.mari-window__control`) |
| Contenido de la ventana | `.mari-window__body` |
| Bordes y esquinas para redimensionar | `.mari-window__resize-handle` |
| Marca de esquina visible al tener el puntero o el foco en una ventana | `.mari-window__resize-grip` |
| Sección plegable | `.mari-drawer` |
| Encabezado y título de la sección | `.mari-drawer__header`, `.mari-drawer__title` |
| Icono, contador y **?** de la sección | `.mari-drawer__icon`, `.mari-drawer__count`, `.mari-drawer__help` |
| Vista previa de una sección contraída (widget pequeño del tracker) | `.mari-drawer__summary` |
| Botones junto a la flecha y botón para sacar la sección | `.mari-drawer__actions`, `.mari-drawer__popout` |
| Flecha y contenido de la sección | `.mari-drawer__arrow`, `.mari-drawer__body` |
| Vista previa que sigue al puntero al arrastrar una sección hacia fuera | `.mari-drawer-ghost` |
| Botón de una ventana minimizada (burbuja) | `.mari-window-bubble` |
| Resumen en vivo que muestra una burbuja en lugar de su icono (el banner de World State) | `.mari-window-bubble__banner` |
| Línea que aparece al alinear una burbuja con otra al arrastrarla | `.mari-window-snap-guide` |
| Punto que aparece mientras trabajan los agentes (botón Chat Settings, ventana Trackers) | `.mari-agents-running-dot` |

### Atributos de datos

- `data-window` identifica una ventana y su burbuja: `chat-settings`, `trackers`, las ventanas de controles `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` y `control:beholder:<package>`, y `drawer:<window>:<drawer>` para una sección separada, por ejemplo `drawer:chat-settings:chat-name`.
- `data-drawer` identifica una sección, por ejemplo `chat-name`. Algunos nombres empiezan con el modo del chat, como `roleplay-agents` o `conversation-agents`. Los trackers usan `tracker-world`, `tracker-persona`, `tracker-characters`, `tracker-quests`, `tracker-inventory`, `tracker-custom` y `agent-activity`.
- `data-presentation` es `"window"` en una ventana de computadora o `"sheet"` en un panel de teléfono.
- `data-pinned` y `data-locked` valen `"true"` mientras la ventana está fijada o bloqueada.
- `data-window-control` identifica cada botón de la barra de título: `"pin"`, `"lock"`, `"close"` o `"put-back"`. Un botón de fijar o bloquear pulsado también tiene `aria-pressed="true"`.
- `data-chat-settings-control` identifica los botones adicionales de la barra de título de Chat Settings: `"reset-view"`, `"favorite-layout"` y `"tracker-panel"`. La estrella favorita tiene `aria-pressed="true"` y un icono relleno cuando el diseño actual coincide con el favorito guardado.
- `data-edge` vale `"n"`, `"s"`, `"e"`, `"w"`, `"ne"`, `"nw"`, `"se"` o `"sw"` en cada tirador de redimensionado.
- El botón de una sección abierta dentro de `.mari-drawer__header` tiene `aria-expanded="true"`.
- `data-drawer-control="pop-out"` marca el botón para sacar una sección.
- `data-outside="true"` marca una vista previa de arrastre lo bastante alejada de su ventana como para separarse al soltarla.
- `data-axis` es `"x"` en una guía de alineación vertical y `"y"` en una horizontal.
- `data-detached` vale `"true"` cuando una sección se muestra en su propia ventana, tanto en esa ventana como en la sección interior. Esa ventana se identifica con `data-window="drawer:<window>:<drawer>"`, por ejemplo `data-window="drawer:chat-settings:chat-name"`, y `data-drawer-host` indica la ventana de origen.
- `data-dragging` vale `"true"` en una sección mientras se arrastra su título, y `data-drop-target` vale `"true"` en una ventana cuando se sostiene sobre ella una sección separada lista para volver.
- Una burbuja tiene el `data-window` de su ventana y `data-minimized="true"`, por ejemplo `.mari-window-bubble[data-window="control:volume"]`. Las ventanas de controles se llaman `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` y `control:beholder:<package>`. `data-dragging` vale `"true"` en una burbuja mientras se arrastra. Una burbuja que muestra un resumen en vivo en lugar de su icono, como un tracker World State minimizado, tiene `data-banner="true"` y se ensancha hasta el ancho del resumen.
- Una burbuja bloqueada tiene `data-locked="true"`, incluido el botón Chat Settings. Sigue abriendo su ventana, pero no se puede mover hasta desbloquearla. Usa `.mari-window-bubble[data-locked="true"]` para dar a estos botones un aspecto distinto.
- En un teléfono, las ventanas tienen `data-presentation="sheet"`, al igual que sus burbujas, que son algo mayores. La burbuja de Tracker Panel es `.mari-window-bubble[data-tracker-panel-toggle="bubble"]`.
- El botón Chat Settings también es una burbuja: `.mari-window-bubble[data-chat-settings-button]`, con `data-open="true"` mientras Chat Settings está abierto.
- Una sección separada se reduce a una burbuja con `data-drawer-host` (su ventana de origen), y el botón **Put back** de su ventana es `[data-window-control="put-back"]`.

### Variables

Cada variable usa los colores compartidos de los controles del chat si no la defines, así que el tema solo necesita las que quieras cambiar.

| Variable | Qué controla |
| --- | --- |
| `--mari-window-bg` | Fondo de ventana |
| `--mari-window-text` | Texto de ventana |
| `--mari-window-border`, `--mari-window-border-width` | Borde de ventana |
| `--mari-window-radius` | Redondeo de esquinas |
| `--mari-window-shadow` | Sombra de ventana |
| `--mari-window-backdrop-filter` | Desenfoque detrás de la ventana |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border` | Colores de la barra de título |
| `--mari-window-header-padding` | Espaciado de la barra de título |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover` | Botones de título, incluida la estrella favorita |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active` | Botones de título activos, incluidos fijar, bloquear y estrella favorita rellena |
| `--mari-window-control-radius`, `--mari-window-control-gap` | Redondeo y espaciado de botones |
| `--mari-window-focus-ring` | Contorno del foco de teclado y de la ventana a la que volverá una sección |
| `--mari-window-resize-handle-size` | Ancho de bordes de redimensionado |
| `--mari-window-bubble-size`, `--mari-window-bubble-radius`, `--mari-window-bubble-shadow` | Tamaño, redondeo y sombra de burbujas |
| `--mari-window-bubble-bg`, `--mari-window-bubble-bg-hover`, `--mari-window-bubble-border` | Fondo y borde de burbujas |
| `--mari-window-bubble-text`, `--mari-window-bubble-text-hover` | Color del icono de burbuja |
| `--mari-window-snap-guide` | Color de la guía de alineación |
| `--mari-drawer-bg`, `--mari-drawer-border` | Fondo y separador de sección |
| `--mari-drawer-header-bg`, `--mari-drawer-header-bg-hover` | Colores del encabezado de sección |
| `--mari-drawer-header-padding`, `--mari-drawer-body-padding-inline`, `--mari-drawer-body-padding-bottom` | Espaciado de sección |
| `--mari-drawer-title-color`, `--mari-drawer-icon-color`, `--mari-drawer-arrow-color` | Texto e iconos del encabezado |
| `--mari-drawer-count-bg`, `--mari-drawer-count-text` | Contador de la sección |

Define una variable en `:root` para cambiar todas las ventanas, o en un selector para cambiar una:

```css
:root {
  --mari-window-radius: 0.5rem;
  --mari-window-bubble-bg: #3b0764;
}

[data-window="chat-settings"] .mari-drawer[data-drawer="chat-name"] {
  --mari-drawer-border: transparent;
}
```

## Dar estilo a mensajes, campos de entrada y controles del chat

Los tres interruptores **Apply preset** también permiten que un tema personalizado use el diseño de los widgets en el resto del chat. Un tema puede sustituir cada parte con las variables siguientes. Pide a Professor Mari un tema de chat a juego si prefieres no escribir el CSS tú mismo.

| Parte | Clase |
| --- | --- |
| Cuadros de mensajes de Roleplay y Game, comentarios al margen de Game, widgets del HUD, panel del mapa y fichas de personaje, y campos de entrada del chat | `.mari-chat-style-surface` |
| Registros, inventario, paneles de combate, elecciones y cuadros de diálogo de Game; los paneles también tienen `data-game-section` con su nombre, como `logs`, `inventory` o `combat-actions` | `.mari-game-section.mari-chat-style-surface` |
| Contenido de Game dentro de una ventana, como el Journal, que sigue los colores de la ventana | `.mari-game-section` |
| Mensajes de Conversation (solo fuente y colores) | `.mari-chat-style-conversation` |
| Texto de mensajes de Conversation sin recuadro | `.mari-chat-style-text` |
| Controles del chat, incluidos Calls y los controles de grupo de Conversation | `.mari-chat-style-control` |
| Botones del historial: **Load More**, **Show older**, **Show newer**, **Latest** y, en los registros de Game, **Older**, **All** y **Show more older logs**. También tienen `.mari-chat-style-control` | `.mari-chat-history-pager` |
| Un mensaje hecho de HTML, como la tarjeta con estilo de un agente. Los colores de texto fijados dentro de él se conservan cuando **Apply preset colors** está activado | `.mari-html-content` |

| Variable | Qué controla |
| --- | --- |
| `--mari-chat-font-family` | Fuente de las áreas correspondientes del chat |
| `--mari-chat-bg` | Fondo del recuadro; acepta un color o degradado |
| `--mari-chat-text` | Color sólido legible del texto |
| `--mari-chat-border` | Contorno del recuadro; acepta un color o degradado |
| `--mari-chat-border-color` | Color sólido de respaldo para el borde |
| `--mari-chat-radius` | Redondeado del recuadro, salvo en los mensajes de Conversation |
| `--mari-chat-control-bg`, `--mari-chat-control-bg-hover` | Fondos de los botones del chat |
| `--mari-chat-control-color`, `--mari-chat-control-radius` | Color de los iconos y redondeado de los botones del chat |
| `--mari-chat-input-bg` | Fondo dentro de los campos editables |

Por ejemplo, con **Apply preset font** y **Apply preset colors** activados:

```css
:root {
  --mari-chat-font-family: Georgia, serif;
  --mari-chat-bg: #251e29;
  --mari-chat-text: #f4e8dc;
  --mari-chat-border: linear-gradient(100deg, #d6aa66, #dda0b2);
}
```

Las variables sin definir siguen los ajustes y el preset de los widgets. El interruptor correspondiente debe estar activado para que estas variables se apliquen mediante el estilo integrado. Los mensajes de Conversation conservan su propia forma incluso con **Apply preset shape** activado. Los temas personalizados también pueden apuntar directamente a las clases; mantén los contornos de foco, los menús y el contenido de los mensajes fuera de cualquier recorte decorativo.

En los teléfonos, el menú de tres puntos se despliega en botones redondos. Su activador es `[data-chat-tools-menu-button]`, la columna abierta es `[data-chat-tools-menu]` y cada elemento de la lista tiene `data-chat-tools-menu-item` con el ID de su ventana. Los botones de herramientas usan `.mari-window-bubble.mari-chat-tools-button` y `data-chat-tools-menu-tool` con ese mismo ID. La columna no tiene marco de ventana; sus botones siguen los colores de los widgets y el tamaño de los botones, independientemente de los tres interruptores para el resto del chat, y conservan su forma redonda.

## Guías relacionadas

- [Card CSS Theming Guide](card-css-theming.md)
- [Appearance Settings](appearance-settings.md)
- [Server Configuration Reference](../CONFIGURATION.md)
- [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md)
