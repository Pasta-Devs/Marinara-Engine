# Configuración de apariencia

La pestaña **Appearance** (Apariencia) cambia el aspecto de Marinara: colores, tamaño del texto, distribución del chat y estilo de los mensajes en cada modo de chat.

¿Buscas otra cosa?

- Otra fuente: [Fuentes personalizadas y Google Fonts](fonts.md).
- Una imagen de fondo para el chat: [Fondos del chat](chat-backgrounds.md).
- Un tema personalizado (**Settings → Addons → Theme Library**, Configuración → Complementos → Biblioteca de temas): [Temas de CSS personalizado](custom-css-themes.md).
- El aspecto propio de un personaje en el chat: [Guía de temas con CSS de tarjeta](card-css-theming.md).

## Abrir la configuración de apariencia

1. Abre **Settings**.
2. Selecciona la pestaña **Appearance**.
3. Elige un botón en la parte superior: **App**, **Conversation**, **Roleplay** o **Game**.

Los botones agrupan las configuraciones por modo de chat, y la pestaña muestra solo el grupo que eliges.

| Botón | Secciones |
| --- | --- |
| **App** | **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds** |
| **Conversation** | **Conversation Display**, **Conversation Theme** |
| **Roleplay** | **Tracker Panel**, **Roleplay Presentation** |
| **Game** | **Game Presentation** |

Para empezar de cero, haz clic en **Reset Appearance** (Restablecer apariencia) en la parte superior de **App Style** (estilo de la app). Restablece toda la pestaña a los valores predeterminados de Marinara, borra el fondo del chat actual y desactiva cualquier tema activo de la Theme Library.

## Botón App

### Color Scheme y Visual Style

En **App Style**, el menú desplegable **Color Scheme** (esquema de color) tiene **Dark** (el predeterminado) y **Light**. La app cambia al instante. Los colores que tienen valores predeterminados separados para oscuro y claro lo siguen hasta que fijas los tuyos.

**Visual Style** (estilo visual) tiene dos tarjetas. **Default (Marinara)** es un aspecto retro Y2K con efectos de brillo. **SillyTavern** es un aspecto limpio y minimalista. Solo cambia el aspecto y no tiene nada que ver con importar desde SillyTavern.

### Background Color y Accent Color

Ambos aceptan un color plano o un degradado, una mezcla suave de dos o más colores. Borra un campo con **Reset to default** (Restablecer al predeterminado) para volver al predeterminado.

| Ajuste | Qué colorea | Predeterminado |
| --- | --- | --- |
| **Background Color** (color de fondo) | El marco principal de la app. | `#050312` en Dark, `#faf8ff` en Light |
| **Accent Color** (color de acento) | Los botones, los iconos activos, los anillos de foco, los resaltes, los contornos de los paneles y los controles alrededor del chat. | **Marinara Gradient** (degradado de Marinara), una mezcla de rosa, naranja y cian |

Un valor como `#050312` es un código de color hexadecimal, una forma corta de escribir un color.

Dos interruptores cambian el comportamiento del acento. Solo uno puede estar activado a la vez.

- **Accent Pulse** (pulso del acento) anima tu acento. Los colores planos se aclaran y se oscurecen, y los degradados recorren sus colores. Está activado de forma predeterminada en el escritorio y desactivado en los teléfonos.
- **RGB Mode** (modo RGB) hace que el acento recorra un arcoíris. Tu **Accent Color** guardado no cambia. Está desactivado de forma predeterminada.

Si tu dispositivo pide reducir el movimiento, ambas animaciones se omiten.

### Otros controles de App Style

- **Custom Mouse Pointer** (puntero del ratón personalizado, activado de forma predeterminada) usa el cursor de Marinara con el color de acento. Desactívalo para usar el cursor de tu sistema, o para dejar que un tema personalizado lo controle.
- **Reduce Ambient Animations & Effects** (reducir animaciones y efectos ambientales) detiene la animación decorativa, las partículas ambientales, las vistas previas giratorias y la aparición gradual del texto. Marinara también lo hace cuando tu dispositivo pide reducir el movimiento.
- **Desktop sidebar width** (ancho de las barras laterales en el escritorio) fija el ancho de las dos barras laterales en el escritorio. **Reset width** (Restablecer el ancho) lo restablece. Los teléfonos conservan su distribución.

### Chat widget style

Al final de **App Style**, elige **Default**, **Dottore** o **Prof. Mari** para los botones, las ventanas y las secciones móviles del chat. Puedes cambiar por separado la fuente, la forma y los tres colores principales, y los tres interruptores **Apply preset** (aplicar el preset) llevan el estilo a los mensajes, los campos de entrada y los controles del chat. **Button size (px)** (tamaño del botón en píxeles) cambia el tamaño de los botones móviles del chat y de sus iconos sin cambiar **Display Size** (tamaño de visualización). Introduce un valor de 32 a 96, o deja el campo vacío para usar el predeterminado. Consulta [Temas de CSS personalizado](custom-css-themes.md#ready-made-chat-window-styles) para ver todos los controles.

### Display Size y Chat Font Size

En **Text & Scale** (texto y escala):

- **Display Size** fija el tamaño base del texto para toda la app en este dispositivo. El cambio se aplica al instante. Elige una de estas opciones:

| Opción | Tamaño |
| --- | --- |
| **Tiny** | 12 px |
| **Small** | 14 px |
| **Medium** | 16 px |
| **Default** | 17 px |
| **Large** | 19 px |
| **Huge** | 22 px |
| **Extra large** | 26 px |
| **Extra extra large** | 30 px |
| **Maximum** | 34 px |

- **Chat Font Size** (tamaño de fuente del chat) es un control deslizante para el texto de los mensajes del chat, de 12 px a 72 px. El predeterminado es 16 px.

El menú desplegable **Font** (fuente) está en la misma sección. Consulta [Fuentes personalizadas y Google Fonts](fonts.md).

### Colores y contorno del texto del chat

También en **Text & Scale**:

- **Chat Text Color** (color del texto del chat) es el color principal del texto de los mensajes. El predeterminado es `#d4d4d4` en Dark y `#1a1025` en Light.
- **Default Dialogue Color** (color de diálogo predeterminado) da color al diálogo entrecomillado cuando un personaje o una persona no tiene su propio Dialogue Highlight Color. Los colores de la tarjeta tienen prioridad. Mientras **Apply preset colors** (aplicar colores del preset) está activado, el diálogo usa el color del texto del estilo del chat.
- **Chat Chrome Text Color** (color del texto de la interfaz del chat) fija el texto de los controles alrededor del chat: los widgets del tracker, las etiquetas de las carpetas y las descripciones de la configuración. Tiene los mismos valores predeterminados que **Chat Text Color**.
- **Text Outline / Stroke** (contorno del texto) añade un contorno para que el texto siga siendo legible sobre fondos recargados. Fija el color y un **Width** (ancho) de 0 a 5 px. El predeterminado es 0,5 px, y 0 lo desactiva.

Borrar un campo de color lo devuelve al predeterminado del esquema.

### Atmosphere

**Dynamic weather effects (rain, snow, fog, etc.)** (efectos de clima dinámicos: lluvia, nieve, niebla, etc.) está activado de forma predeterminada. Muestra partículas de clima según el clima y la hora del día de la historia. Solo muestra algo cuando el agente **World State** está activado para el chat. Consulta [Agentes: ayudantes de IA para tus chats](../agents/agents-overview.md).

### Backgrounds

La sección **Backgrounds** (fondos) contiene el selector **Chat Background** (fondo del chat) y **Background Blur** (desenfoque del fondo). Aquí hay dos controles más. **Conversation background image opacity** (opacidad de la imagen de fondo de Conversation) fija con qué intensidad se ve el fondo del chat en el modo Conversation, sin que deje de verse el degradado. **Chat List Backgrounds** (fondos en la lista de chats) muestra el fondo de cada chat como un banner atenuado detrás de su fila en la lista de chats. Elige **Active & Hovered**, **Every Row** u **Off**. Consulta [Fondos del chat](chat-backgrounds.md).

## Botón Conversation

- **Chat Layout** (distribución del chat), en **Conversation Display** (visualización de Conversation), cambia el aspecto de los mensajes de Conversation, con una vista previa en vivo. **Linear** (el predeterminado) muestra filas al estilo de un chat. **Bubbles** muestra burbujas al estilo de una app de mensajería.
- **Avatar Shape** (forma del avatar) es **Circular** o **Square**. El tamaño del avatar no cambia.
- **Always display swipe menu** (mostrar siempre el menú de swipes) muestra las flechas de los swipes (respuestas alternativas) y el contador desde la primera respuesta. Desactívalo para mostrarlos solo después de regenerar.
- **Conversation Theme** (tema de Conversation) fija un degradado de dos colores detrás de cada chat de Conversation. Las pestañas **Dark** y **Light** conservan cada una su propio degradado. Este es un predeterminado para todo el dispositivo, no una configuración por chat.

## Botón Roleplay

**Tracker Panel** (panel de trackers) da estilo al panel lateral del tracker de Roleplay. Consulta [HUD y trackers de Roleplay](../roleplay/hud-and-trackers.md).

**Roleplay Presentation** (presentación de Roleplay) da estilo a los mensajes de Roleplay.

| Ajuste | Qué hace | Predeterminado |
| --- | --- | --- |
| **Chat position** | Dónde se ubican los mensajes y el cuadro de entrada en pantallas anchas: **Left**, **Center** o **Right**. Una barra lateral abierta o un Tracker Panel del mismo lado los desplaza. Los teléfonos conservan todo el ancho. | **Center** |
| **Visual Novel display** (visualización de novela visual) | Muestra un párrafo terminado a la vez, con un retrato de diálogo y tus sprites (imágenes del personaje). Cambia el Roleplay actual y el predeterminado de los chats que no tienen un estilo guardado. | Desactivado |
| **Roleplay Messages Background Opacity** | Un control deslizante de 0% a 100%. Bájalo para dejar que el fondo se vea a través de las burbujas de mensaje. | 90% |
| **Roleplay Avatars** | El estilo del avatar junto a cada mensaje: **None**, **Small Circles**, **Small Rectangles** o **Glued Side Panel**. | **Small Circles** |
| **Scrollable Avatars** | Mantiene los avatares visibles mientras te desplazas por un mensaje largo. | Desactivado |
| **Message avatar scale** | Un control deslizante de 75% a 250%. | 100% |
| **Default sprite scale** | Un control deslizante de 50% a 175%. El tamaño de sprite propio de un chat sigue teniendo prioridad. | 100% |

Esta sección también tiene **Custom chat width** (ancho de chat personalizado), **Always display swipe menu**, **Reduced paint effects** (efectos de pintura reducidos: aplana las transparencias y las sombras costosas para que la navegación siga siendo fluida), **Show Thinking In Messages** (mostrar el razonamiento en los mensajes), **Don't Collapse Thinking** (no contraer el razonamiento) y **Narrator's Cycling Avatars** (avatares rotativos del Narrator). Con **Visual Novel display** activado, también aparecen **Auto-play VN paragraphs** (reproducir automáticamente los párrafos de la novela visual) con el ajuste **Paragraph delay** (pausa entre párrafos), **Dialogue portrait scale** (escala de los retratos de diálogo) y **Full-body sprite scale** (escala de los sprites de cuerpo entero).

## Botón Game

En **Game Presentation** (presentación de Game), **Game VN Art** (arte de novela visual de Game) tiene dos controles deslizantes: **Dialogue portrait scale** (de 75% a 175%, predeterminado 100%) y **Full-body sprite scale** (de 75% a 275%, predeterminado 135%).

**Game Dialogue Display** (visualización del diálogo de Game) elige cómo se comporta el cuadro de diálogo.

- **Classic Dialogue Box** (el predeterminado) muestra un segmento activo. Las líneas más antiguas están en el botón **Logs**.
- **History Above Dialogue Box** muestra los segmentos anteriores encima del cuadro, y toda la sesión se mantiene desplazable ahí.

**Game text effects** (efectos de texto del juego, activado de forma predeterminada) anima las palabras dramáticas, el énfasis en MAYÚSCULAS, los apartes entre paréntesis y las etiquetas de efectos de texto. Desactívalo para ver el texto sin efectos.

## Configuraciones que se quedan en este dispositivo

La mayoría de las configuraciones de Appearance se sincronizan con tus otros dispositivos. **Display Size** y **Chat Font Size** no. Se guardan en el navegador que usas. Consulta [Resumen de configuración](../settings/settings-overview.md) para ver qué se sincroniza.

## Guías relacionadas

- [Fuentes personalizadas y Google Fonts](fonts.md)
- [Fondos del chat](chat-backgrounds.md)
- [Temas de CSS personalizado (Theme Library)](custom-css-themes.md)
- [Guía de temas con CSS de tarjeta](card-css-theming.md)
- [Resumen de configuración](../settings/settings-overview.md)
