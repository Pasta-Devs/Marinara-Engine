# Temas de CSS personalizado (Theme Library)

Esta guía explica cómo cambiar el aspecto completo de Marinara Engine con un tema de CSS personalizado. Aprenderás a crear, importar, exportar y activar temas. También verás qué variables de CSS puedes cambiar y cómo funcionan los temas junto con Card CSS.

## Estilos de ventanas de chat listos para usar

Para cambiar el aspecto sin escribir CSS, abre **Settings > Appearance > App** y busca **Chat widget style** al final de **App Style**. **Dottore** da a los controles marcos de instrumentos cian y esquinas recortadas. **Mari** añade marcos rosas y dorados con Protogemas en los títulos de las ventanas. Sus botones usan el mismo fondo que sus ventanas. Cada preset tiene su propia fuente, funciona en modo claro y oscuro y cambia a la vez el aspecto de botones, ventanas y secciones desplegables.

Los controles **Font** y **Shape** permiten cambiar esos detalles por separado. **Preset font** y **Preset shape** siguen el estilo elegido.

Debajo hay tres controles de color. Cada uno tiene un selector de color sólido y una opción de degradado para mezclar colores:

- **Border & Buttons Color** cambia los contornos y los iconos de los botones. Los iconos usan el primer color del degradado.
- **Background Color** rellena los botones, las ventanas, las secciones desplegables y los campos editables.
- **Text Color** cambia el texto de los widgets. Los degradados aparecen en títulos y etiquetas; el texto de los campos editables usa el primer color.

Los controles de color conservan los colores originales de los adornos.

Usa **Reset color** junto a un control para volver a los colores claros u oscuros del preset. Elegir un preset restablece **Font**, **Shape** y los tres colores. **Default** recupera el aspecto original. Las ventanas se quedan donde las colocaste.

Los temas CSS personalizados pueden seguir anulando estos presets. Las variables públicas de ventanas y secciones que aparecen abajo tienen prioridad sobre los colores del preset. Usa `--mari-window-font-family` para las letras de las ventanas, `--mari-drawer-radius` para las esquinas de las secciones y `--mari-window-ornament: none` para ocultar el adorno del título. Para quitar toda la decoración del preset, elige primero **Default**.


## Qué es un tema personalizado

Un tema personalizado es un bloque de CSS que vuelve a pintar Marinara. CSS, abreviatura de Cascading Style Sheets, es el código que define los colores, los bordes y el espaciado en toda la app. Un tema puede cambiar el fondo de la página, el color de acento, las tarjetas, los bordes, el texto y más.

Los temas personalizados viven en la **Theme Library** (Biblioteca de temas). Se guardan en tu servidor de Marinara, así que se sincronizan con todos los dispositivos y navegadores que se conectan al mismo servidor. Esto es distinto de la mayoría de los demás ajustes de apariencia, que permanecen en un solo dispositivo. Para los ajustes por dispositivo, consulta la guía [Appearance Settings](appearance-settings.md).

Solo puede haber un tema personalizado activo a la vez. Puedes mantener tantos temas como quieras en tu biblioteca y alternar entre ellos.

## Dónde encontrar la Theme Library

1. Abre **Settings** (Configuración).
2. Abre la pestaña **Addons**.
3. Busca la sección **Theme Library**.

La sección se titula **Theme Library** y dice "Create, import, activate, edit, export, or remove custom CSS themes."

## Crear un tema

1. En la sección **Theme Library**, haz clic en **Create Theme**.
2. Escribe un nombre en el campo **Theme name**.
3. Escribe o pega tu CSS en el cuadro de texto grande.
4. Deja **Preview** activado para ver tus cambios en vivo en la app mientras escribes. Desactiva **Preview** para detener la vista previa en vivo.
5. Haz clic en **Save**.

Un tema nuevo parte de una plantilla. La plantilla enumera variables comunes como ejemplos comentados, así que puedes quitar las marcas de comentario y poner tus propios valores. Cuando guardas un tema completamente nuevo, Marinara lo activa de inmediato. También muestra una confirmación con el nombre del tema, como: Theme "My Theme" saved and activated.

Para cambiar un tema más adelante, búscalo en la lista **Installed Themes**. Haz clic en el icono de código (su tooltip dice **Edit theme CSS**), haz tus cambios y haz clic en **Save**. Editar un tema guardado lo actualiza, pero no cambia qué tema está activo.

## Importar y exportar temas

Puedes compartir temas como archivos. Esto es útil para mover un tema entre servidores o dárselo a un amigo.

Para importar un tema:

1. Haz clic en **Import File** en la sección **Theme Library**.
2. Elige un archivo `.css` o un archivo `.json`.
3. Lee el mensaje de aviso (toast). Informa cuántos temas se importaron, se omitieron o fallaron.

Un archivo `.css` se convierte en un tema, con el nombre del archivo. Un archivo `.json` puede contener uno o varios temas, y viene en dos tipos.

El primer tipo es un archivo exportado desde Marinara. Envuelve cada tema en campos adicionales que Marinara agrega al exportar. No necesitas leerlo ni editarlo. Importa el archivo tal cual.

El segundo tipo es un archivo pequeño que escribes tú mismo. Para un solo tema, esto es suficiente:

```
{ "name": "My Theme", "css": "..." }
```

Los temas importados se sincronizan con tu servidor, pero no se activan por sí solos. Un tema que ya existe en el servidor, con el mismo nombre y el mismo CSS, se omite en lugar de agregarse dos veces.

Para exportar un tema, búscalo en la lista **Installed Themes** y haz clic en el icono de subir (su tooltip dice **Export theme**). Marinara descarga un archivo `.json` que puedes importar en otro lugar.

## Activar un tema

La lista **Installed Themes** muestra todos los temas, más una entrada **Default Theme** en la parte superior.

1. Haz clic en el nombre de un tema para activarlo. Una marca de verificación muestra el tema activo.
2. Haz clic en **Default Theme** para desactivar la temática personalizada y volver al aspecto integrado de Marinara.

El botón **Reset Appearance** está en la parte superior de la sección **App Style**, en **Settings -> Appearance**. También desactiva el tema personalizado activo cuando lo usas.

Para eliminar un tema de forma definitiva, haz clic en el icono de papelera en su fila (su tooltip dice **Remove theme**) y luego confirma en la ventana **Delete Theme**. Esto elimina permanentemente el CSS del tema del servidor.

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

No te limitas a esta lista. Un tema puede definir cualquier variable de CSS que use Marinara, y también puede agregar otros estilos personalizados.

Algunos efectos visuales tienen sus propias variables. Por ejemplo, un tema puede solicitar la animación de pulso del acento definiendo `--marinara-theme-accent-pulse: enabled`.

El CSS de un tema personalizado se limpia antes de ejecutarse, por seguridad. Los estilos que cargan un archivo desde otro sitio web no funcionan. Para usar una imagen o una fuente dentro de un tema, incrústala como una URI `data:` en lugar de un enlace web. Una URI `data:` contiene el contenido del archivo directamente dentro del CSS.

## Dar estilo a ventanas y secciones del chat

En una computadora, **Chat Settings** se abre como ventana móvil. Sus secciones plegables se llaman **drawers**. Una sección puede salir a su propia ventana y luego minimizarse a un botón pequeño que puedes mover, llamado **bubble**.

Otras herramientas también usan estas ventanas y botones, como Game controls, Session, Volume, Game Assets, los chats conectados y los controles de paquetes. En un teléfono, las ventanas son paneles de ancho completo y Tracker Panel tiene su propio botón móvil.

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
- Una burbuja tiene el `data-window` de su ventana y `data-minimized="true"`, por ejemplo `.mari-window-bubble[data-window="control:volume"]`. Las ventanas de controles se llaman `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` y `control:beholder:<package>`. `data-dragging` vale `"true"` en una burbuja mientras se arrastra.
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

## Límites de tamaño y nombre

El nombre de un tema puede tener hasta 200 caracteres. El contenido de CSS puede tener hasta 256 KiB, medido en bytes UTF-8 en lugar de caracteres. Un tema más grande que eso se rechaza cuando lo guardas o lo importas.

## Acceso de administrador para instalaciones remotas

Crear, editar, importar, activar y eliminar un tema son acciones protegidas. Esto importa solo cuando abres Marinara a través de una red.

Si abres Marinara en la misma computadora que ejecuta el servidor, usando loopback (también llamado localhost), estas acciones simplemente funcionan. Si abres Marinara desde otro dispositivo, como un teléfono o una computadora de tu red, el servidor necesita primero un secreto de administrador.

Para gestionar temas a través de una red:

1. En el servidor, define `ADMIN_SECRET` en el archivo `.env`.
2. En la app, abre **Settings -> Advanced -> Admin Access** e ingresa el mismo valor.

Sin esto, los cambios de tema a través de una red fallan. Para la configuración completa, consulta la [Server Configuration Reference](../CONFIGURATION.md) y la [guía de Remote Access](../REMOTE_ACCESS.md).

## Cómo funcionan juntos los temas y Card CSS

Marinara tiene dos formas de agregar CSS personalizado. Son funciones separadas y ambas pueden estar activas a la vez.

Un tema personalizado vuelve a pintar toda la app. Tiene permiso para sobrescribir las variables base de Marinara, usar `!important` y usar `position: fixed`. Ese es el propósito de un tema.

Card CSS es diferente. Quien crea un personaje o una persona puede incrustar CSS en una tarjeta, y tú lo activas por chat. Card CSS se limpia de forma más estricta. No puede sobrescribir las variables base de la app, se elimina `!important` y `position: fixed` se convierte en `position: absolute`. Da estilo a los mensajes del chat, no a toda la app. Consulta la [Card CSS Theming Guide](card-css-theming.md).

Si la app se ve mal, vale la pena revisar tanto un tema activo como Card CSS. Cualquiera de los dos podría ser la causa.

## Guías relacionadas

- [Card CSS Theming Guide](card-css-theming.md)
- [Appearance Settings](appearance-settings.md)
- [Server Configuration Reference](../CONFIGURATION.md)
- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
