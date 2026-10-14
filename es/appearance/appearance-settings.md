# Configuración de apariencia

Esta guía recorre la pestaña **Settings -> Appearance** (Configuración -> Apariencia) de Marinara Engine sección por sección. Cubre colores, tamaño del texto, distribución del chat, estilo de los mensajes en cada modo y cómo restablecer todo a los valores predeterminados.

Las fuentes, los fondos y los temas de CSS personalizado tienen cada uno su propia guía. Esta página enlaza a ellas donde corresponde.

## Abrir la configuración de apariencia

1. Abre **Settings**.
2. Selecciona la pestaña **Appearance**.

La pestaña se divide en secciones que recorres desplazándote: **App Style**, **Text & Scale**, **Conversation Display**, **Tracker Panel**, **Roleplay Messages**, **Game Presentation**, **Atmosphere**, **Conversation Theme** y **Backgrounds**.

## Color Scheme (oscuro o claro)

El menú desplegable **Color Scheme** (esquema de color) está en la sección **App Style**. Tiene dos opciones:

- **Dark** (el predeterminado). Más cómodo para la vista en una habitación oscura.
- **Light**.

Varios colores de abajo tienen valores predeterminados separados para oscuro y claro. Siguen el Color Scheme activo automáticamente hasta que fijas tu propio color.

## Visual Style

**Visual Style** (estilo visual) elige el aspecto general de toda la app. Eliges entre dos tarjetas:

- **Default (Marinara)** (el predeterminado). Un aspecto retro Y2K con efectos de brillo.
- **SillyTavern**. Un aspecto limpio y minimalista inspirado en el SillyTavern original.

Esto es solo una capa visual. No tiene nada que ver con importar datos desde SillyTavern, que es una herramienta aparte.

## Background Color y Accent Color

Estos dos controles están en la sección **App Style**. Ambos aceptan un color plano o un degradado. Un degradado es una mezcla suave entre dos o más colores.

- **Background Color** (color de fondo) pinta el marco principal de la app detrás de todo. El predeterminado es `#050312` en modo Dark y `#faf8ff` en modo Light.
- **Accent Color** (color de acento) da color a los botones, los iconos activos, los anillos de foco, los resaltes y los contornos de los paneles. El predeterminado es `#d4acfb` en ambos esquemas.

Un valor como `#d4acfb` es un código de color hexadecimal, una forma corta de escribir un color. Para volver al predeterminado del esquema, borra el campo con **Reset to default** (Restablecer al predeterminado).

Dos interruptores cambian el comportamiento del Accent Color:

- **Accent Pulse** (desactivado de forma predeterminada) anima suavemente tu Accent Color. Los colores planos se aclaran y se oscurecen. Los degradados recorren sus colores.
- **RGB Mode** (desactivado de forma predeterminada) hace que el acento recorra una paleta de arcoíris mientras está activo. Tu Accent Color guardado no cambia.

Solo puedes usar uno de estos a la vez. Activar **RGB Mode** desactiva **Accent Pulse**, y activar **Accent Pulse** desactiva **RGB Mode**. Accent Pulse se previsualiza en vivo mientras la pestaña Appearance está abierta. Si tu dispositivo está configurado para reducir el movimiento, ambas animaciones se omiten.

## Chat widget style

Al final de **App Style**, elige **Default**, **Dottore** o **Prof. Mari** para los botones, las ventanas y las secciones móviles del chat. Puedes cambiar por separado la fuente, la forma del marco y los tres colores principales. Los selectores de color también admiten degradados.

**Button size (px)** (tamaño del botón en píxeles) cambia los botones móviles del chat y sus iconos sin cambiar Display Size. Introduce un tamaño de 32 a 96 píxeles. Deja el campo vacío o usa su botón de restablecer para conservar el valor predeterminado actual. El tamaño se guarda con tus preferencias de apariencia y se mantiene al elegir otro preset.

Debajo de los selectores de color, **Apply preset font** (aplicar fuente del preset), **Apply preset shape** (aplicar forma del preset) y **Apply preset colors** (aplicar colores del preset) hacen que el resto del chat tenga el mismo aspecto. Empiezan desactivados y funcionan de forma independiente. Se aplican a los mensajes, los campos de entrada y los controles del chat. En Game Mode también se aplican a los widgets del HUD, el panel del mapa, los comentarios al margen, las fichas de personaje, los registros, el inventario, los paneles de combate y los cuadros de diálogo. Los mensajes de Conversation usan la fuente y los colores opcionales, pero conservan su propia forma. También incluyen tu fuente, tu forma y tus colores personalizados. Con **Apply preset colors** activado, el diálogo entrecomillado sigue usando el Dialogue Highlight Color propio de cada personaje o persona. Para ver ejemplos y temas personalizados, consulta [Temas de CSS personalizado](custom-css-themes.md#ready-made-chat-window-styles).

## Custom Mouse Pointer

**Custom Mouse Pointer** (puntero del ratón personalizado, activado de forma predeterminada) usa el cursor con el color de acento de Marinara en toda la app. Desactívalo para usar tu cursor normal del sistema, o para dejar que un tema de CSS personalizado controle el cursor.

## Display Size y Chat Font Size

Estos dos controles están en la sección **Text & Scale**.

- **Display Size** (tamaño de visualización) fija el tamaño base del texto para toda la app en este dispositivo. Las opciones son **Tiny**, **Small**, **Medium**, **Default** (17px), **Large** y **Huge**.
- **Chat Font Size** (tamaño de fuente del chat) es un control deslizante que fija el tamaño del texto de los mensajes del chat. Va de 12px a 48px. El predeterminado es 16px.

El menú desplegable **Font** (fuente) está en esta misma sección. Para añadir tus propias fuentes o descargarlas de Google Fonts, consulta [Fuentes personalizadas y Google Fonts](fonts.md).

## Colores y contorno del texto del chat

También en la sección **Text & Scale**, cuatro controles cambian cómo se lee el texto del chat sobre tu fondo.

- **Chat Text Color** (color del texto del chat) fija el color principal del texto de los mensajes del chat. El predeterminado es `#d4d4d4` en modo Dark y `#1a1025` en modo Light.
- **Default Dialogue Color** (color de diálogo predeterminado) da color al diálogo entrecomillado cuando una tarjeta de personaje o persona no define su propio Dialogue Highlight Color. Los colores específicos de la tarjeta tienen prioridad. Mientras **Apply preset colors** está activado, este diálogo usa en su lugar el color del texto del estilo del chat.
- **Chat Chrome Text Color** fija el texto ordinario de los widgets del tracker, las etiquetas de las carpetas y las descripciones de la configuración. Usa los mismos valores predeterminados que **Chat Text Color**.
- **Text Outline / Stroke** (contorno del texto) añade un contorno alrededor del texto del chat para que siga siendo legible sobre fondos recargados. Fija el color del contorno y un **Width** (ancho) de 0px a 5px. El ancho predeterminado es 0.5px. Fija el ancho en 0 para desactivar el contorno.

Cada color sigue el predeterminado del Color Scheme hasta que fijas el tuyo. Borrar un campo de color lo devuelve a ese predeterminado del esquema, en lugar de dejarlo en blanco.

## Chat Layout (Conversation Display)

La sección **Conversation Display** tiene un control, **Chat Layout** (distribución del chat), que cambia el aspecto de los mensajes en modo Conversation. Una vista previa en vivo se actualiza a medida que eliges.

- **Linear** (el predeterminado). Filas al estilo de un chat.
- **Bubbles**. Burbujas al estilo de una app de mensajería.

## Tracker Panel

La sección **Tracker Panel** da estilo al panel lateral del tracker de Roleplay. Ese panel es una función aparte con su propia guía. Consulta [HUD y trackers de Roleplay](../roleplay/hud-and-trackers.md).

## Apariencia de los mensajes de Roleplay

La sección **Roleplay Messages** da estilo a los mensajes en los chats de Roleplay.

- **Chat position** elige dónde se ubican los mensajes y el cuadro de entrada en una pantalla ancha: **Left**, **Center** (el predeterminado) o **Right**. Se mueven juntos, y una barra lateral abierta o el Tracker Panel del mismo lado los desplaza para que el chat nunca quede debajo. En un teléfono o una ventana estrecha el chat conserva todo el ancho, y el modo Game mantiene centrado su cuadro de diálogo.
- **Roleplay Messages Background Opacity** es un control deslizante de 0% a 100%. El predeterminado es 90%. Bájalo para dejar que el fondo se vea a través de las burbujas de mensaje.
- **Roleplay Avatars** elige el estilo del avatar junto a cada mensaje. Las cuatro opciones son **None**, **Small Circles** (el predeterminado), **Small Rectangles** y **Glued Side Panel**.
- **Scrollable Avatars** (desactivado de forma predeterminada) mantiene los avatares visibles mientras te desplazas por un mensaje largo.
- **Message avatar scale** es un control deslizante de 75% a 250%. El predeterminado es 100%.
- **Default sprite scale** es un control deslizante de 50% a 175%. El predeterminado es 100%. Un tamaño de sprite (imagen del personaje) por chat sigue anulando este predeterminado.

## Game Presentation

La sección **Game Presentation** escala el arte en el modo Game. El modo Game puede mostrar tanto un retrato de diálogo como un sprite de cuerpo entero. Estos dos controles deslizantes fijan su tamaño.

- **Dialogue portrait scale** es un control deslizante de 75% a 175%. El predeterminado es 100%.
- **Full-body sprite scale** es un control deslizante de 75% a 275%. El predeterminado es 135%.

**Game Dialogue Display** elige cómo se comporta el cuadro de diálogo:

- **Classic VN** (el predeterminado). Un segmento activo se muestra en el cuadro de diálogo. Las líneas más antiguas están en el botón **Logs**.
- **History Above VN**. Los segmentos anteriores se muestran encima del cuadro de diálogo. La sesión completa se mantiene desplazable ahí.

## Efectos de clima de Atmosphere

La sección **Atmosphere** tiene un interruptor, **Dynamic weather effects (rain, snow, fog, etc.)**, que está activado de forma predeterminada. Muestra partículas de clima animadas según el clima y la hora del día de la historia.

Este interruptor solo muestra algo cuando el agente **World State** está activado para el chat. Ese agente lee el clima de la historia. Sin él, el interruptor no tiene ningún efecto visible. Consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).

## Conversation Theme

La sección **Conversation Theme** fija un fondo de degradado de dos colores para cada chat en modo Conversation. Tiene pestañas separadas **Dark** y **Light** para que cada Color Scheme conserve su propio degradado. Este es un predeterminado para todo el dispositivo en los chats de Conversation, no una configuración por chat.

## Backgrounds

La sección **Backgrounds** te permite importar y elegir imágenes de fondo del chat y fijar un **Background Blur** (desenfoque del fondo). Como esta es su propia área de función con su propia biblioteca, tiene una guía dedicada. Consulta [Fondos del chat](chat-backgrounds.md).

## Reset Appearance

El botón **Reset Appearance** (Restablecer apariencia) está en la parte superior de la sección **App Style**. Restablece toda la pestaña **Appearance** a los valores predeterminados de Marinara. Esto incluye colores, tamaños de texto, distribución, escalas de avatar y sprite, y degradados.

Restablecer también borra el fondo del chat actual y desactiva cualquier tema personalizado activo de la Theme Library. Úsalo cuando tu estilo se desordene y quieras empezar de cero.

## Configuraciones que se quedan en este dispositivo

La mayoría de las configuraciones de Appearance se sincronizan con tus otros dispositivos. Dos no lo hacen: **Display Size** y **Chat Font Size** se guardan en el navegador que estás usando y nunca se sincronizan.

Para el panorama completo de qué configuraciones se sincronizan entre dispositivos y cuáles se quedan en local, consulta [Resumen de configuración](../settings/settings-overview.md).

## Guías relacionadas

- [Fuentes personalizadas y Google Fonts](fonts.md)
- [Fondos del chat](chat-backgrounds.md)
- [Temas de CSS personalizado (Theme Library)](custom-css-themes.md)
- [Guía de temas con CSS de tarjeta](card-css-theming.md)
- [Resumen de configuración](../settings/settings-overview.md)
