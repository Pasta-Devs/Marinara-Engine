# Área segura inferior en la PWA de iOS (desarrolladores)

Esta guía para desarrolladores explica una franja de color que puede aparecer en la parte inferior de la pantalla. Aparece cuando Marinara Engine se ejecuta como una app en la pantalla de inicio del iPhone. Cubre la solución que incluye Marinara, el compromiso que impone esa solución y cómo diagnosticar la franja si un cambio futuro la vuelve a traer.

Una PWA (Progressive Web App, aplicación web progresiva) es un sitio web que el usuario instala en la pantalla de inicio y abre como una app nativa. Este es material a nivel de código para colaboradores, no una guía para el usuario final.

## El problema

En los iPhone con indicador de inicio (modelos con Face ID), la parte inferior de la pantalla es un área segura reservada para el gesto de inicio. iOS trata esta zona como de aproximadamente 34px de alto. Equivale al valor de la variable CSS `env(safe-area-inset-bottom)`.

Cuando el estilo de la barra de estado de la PWA se ajusta a `black-translucent`, iOS impide que cualquier elemento con `position: fixed` se dibuje dentro de esta zona. Todas las soluciones de CSS fallan. WebKit limita los desplazamientos inferiores negativos, `calc(100dvh + env(safe-area-inset-bottom))` y las anulaciones de altura negativa.

El resultado es una franja visible debajo del cuadro de entrada del chat. Esta franja, a menudo llamada la "chin" (barbilla), muestra un color distinto al del resto de la interfaz.

## La solución que incluimos

Marinara ajusta el estilo de la barra de estado a `black` en lugar de `black-translucent`. La etiqueta meta está en `packages/client/index.html`.

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

La etiqueta viewport mantiene `viewport-fit=cover` y el comportamiento predeterminado del teclado.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

En modo `black` iOS no bloquea la zona inferior. El shell de la app usa `fixed inset-0` sin anulación de altura del viewport, así que se dibuja hasta el fondo, dentro del área segura. El className del shell en `packages/client/src/components/layout/AppShell.tsx` es:

```
mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden
```

No agregues `interactive-widget=resizes-content` a la etiqueta viewport. En las PWA móviles puede redimensionar todo el shell del chat mientras el teclado se anima y dejar recortado el desplazamiento de los mensajes.

## El compromiso

No puedes tener a la vez una barra de estado tipo cristal y una parte inferior rellena. En modo `black` la barra de estado es una barra oscura sólida. `black-translucent` da una parte superior transparente más bonita, pero hace imposible quitar la franja inferior. Esta es una limitación estricta de iOS.

<a id="landscape-the-cameras-side-insets"></a>

## Orientación horizontal: márgenes laterales de la cámara

Cuando un iPhone se gira en horizontal, su cámara (la muesca o Dynamic Island) queda en el borde izquierdo o derecho. Con `viewport-fit=cover`, la página se extiende por debajo, e iOS indica ese espacio mediante `env(safe-area-inset-left)` y `env(safe-area-inset-right)`. En los modelos con Dynamic Island son unos 59px a cada lado, independientemente del sentido del giro. La aplicación de Marinara para Android (SDK de destino 34, sin diseño de borde a borde) se dispone fuera del recorte, por lo que ambos márgenes son 0. Otros navegadores de Android pueden indicar márgenes distintos de cero, por ejemplo en pantalla completa o de borde a borde, y las mismas variables los cubren.

Marinara evita ese espacio del mismo modo que la franja de la barra de estado en vertical:

- `packages/client/src/styles/globals.css` lee una sola vez los dos márgenes y los guarda en `--mari-safe-area-inset-left` y `--mari-safe-area-inset-right`, en `:root`. Todo lo demás lee estas variables, nunca `env()` directamente. `scripts/regressions/mobile-safe-area-inset.regression.ts` lo comprueba. Los diálogos, la omnibar, los editores de pantalla completa y los controles de TopBar conservan esta protección frente a la cámara y las esquinas redondeadas.
- En iPhone, `AppShell.tsx` identifica el lado de la cámara a partir de `window.orientation` (o `screen.orientation.angle` si no está disponible). A 90°, la cámara está a la izquierda; a −90°/270°, a la derecha. Un atributo `data-mari-camera-side` en `<html>` permite que CSS ponga a cero solo el margen del **contenedor** del lado opuesto, `--mari-shell-inset-left` o `--mari-shell-inset-right`. Los giros desconocidos, iPad y Android conservan los márgenes del sistema.
- En el contenedor del teléfono, `.mari-app` toma `left` y `right` de las variables del contenedor. El fondo de la página del cuerpo se muestra sobre la cámara, del mismo color que la franja de la barra de estado en vertical, sin un margen reflejado en el borde opuesto.
- Los elementos fijos dentro del contenedor se posicionan respecto a la pantalla, no al contenedor, de modo que evitan ese espacio por sí mismos. Los paneles del teléfono y sus fondos en `AppShell.tsx` usan `MOBILE_SHELL_PANEL_X_CLASS` con las variables del contenedor. Los adornos, como sus estrellas, son `absolute` y permanecen dentro.

Para comprobarlo sin un teléfono, abre un área visible táctil de 874×402 y pon ambas variables en `59px` con una regla `:root` de la hoja de estilos (los estilos en línea prevalecen sobre el selector del lado de la cámara). En Chromium también puedes emular los márgenes reales con el comando del protocolo de DevTools `Emulation.setSafeAreaInsetsOverride`. `e2e/phone-camera-side.e2e.ts` comprueba ambas direcciones de giro, las API de orientación antigua y nueva, los giros desconocidos y otros dispositivos. La prueba e2e "a phone turned sideways keeps the app out from under its camera" comprueba la alternativa que conserva ambos márgenes.

## Cómo se diagnosticó

La franja se rastreó coloreando cada capa y volviendo a abrir la app. Inyecta los estilos de diagnóstico en `packages/client/dist/index.html`, dentro de su bloque `<style>` en línea. El service worker no guarda ese archivo en caché y siempre se sirve recién generado. Los cambios aparecen la próxima vez que abres la app, sin necesidad de limpiar la caché.

```
html, body { background-color: #ff0000 !important; }
.mari-chat-input-box { background-color: #00ff00 !important; }
.mari-app { background: #0000ff !important; }
```

Lee el resultado así:

- Barbilla roja significa que el lienzo html se está dibujando ahí. Ningún elemento fijo puede cubrirla en modo `black-translucent`.
- Barbilla azul significa que la caja del shell de la app llega hasta el fondo. Este es el estado que funciona.
- Barbilla verde significa que el propio cuadro de entrada se rellena hasta el borde.

## Si una actualización lo rompe

### Síntoma: la franja de la barbilla vuelve debajo del cuadro de entrada

Comprobación 1. Confirma que `apple-mobile-web-app-status-bar-style` sigue siendo `black` en `packages/client/index.html`. Si se volvió a cambiar a `black-translucent`, vuelve a ponerlo en `black`.

Comprobación 2. Confirma que el className de AppShell en `packages/client/src/components/layout/AppShell.tsx` sigue diciendo `mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden`. No combines `inset-0` con `h-screen`, `h-dvh` ni `max-h-screen`. Eso restringe en exceso el shell fijo y deja que el teclado móvil mueva la interfaz.

Comprobación 3. Ejecuta el diagnóstico de color anterior para ver qué capa dibuja la barbilla. Fuerza el cierre y vuelve a abrir la app. No hace falta limpiar la caché, porque `dist/index.html` no está precacheado.

- Barbilla roja con un shell azul en el resto significa que la caja del shell no llega hasta el fondo. Confirma que el estilo de la barra de estado es `black`.
- Barbilla todavía roja con un shell azul significa que el shell no está cubriendo. Confirma que `fixed inset-0` está intacto.
- Barbilla azul significa que el shell la cubre pero el cuadro de entrada no se rellena hasta abajo. Revisa el relleno del contenedor de entrada más abajo.

### Síntoma: el cuadro de entrada queda pegado al borde de la pantalla

Los tres componentes de entrada necesitan `pb-3` en su contenedor exterior para un espaciado flotante natural, no `pb-0`.

- `packages/client/src/components/chat/ChatInput.tsx`: el contenedor dice `mari-chat-input chat-input-container px-3 pb-3`.
- `packages/client/src/components/chat/ConversationInput.tsx`: el contenedor dice `mari-chat-input chat-input-container relative px-2 sm:px-3 pb-3`.
- `packages/client/src/components/game/GameInput.tsx`: el contenedor dice `px-3 pt-2 pb-3`.

## Reconstrucción

El servidor sirve el cliente compilado desde `packages/client/dist`, así que cualquier cambio en el código fuente necesita una reconstrucción.

```
pnpm build:client
```

Luego borra los datos del sitio en el dispositivo y vuelve a abrir la PWA. En el teléfono abre **Settings** (Configuración), luego **Safari**, luego **Advanced** (Avanzado), luego **Website Data** (Datos de sitios web). El service worker guarda en caché el JS y el CSS por hash de contenido, así que un hash cambiado necesita un borrado de datos del sitio para cargar los nuevos fragmentos.

El service worker no guarda `dist/index.html` en caché y siempre se sirve recién generado. Úsalo para inyecciones rápidas de estilos de diagnóstico sin una reconstrucción completa.

## Datos clave

- `black-translucent` da una barra de estado transparente pero bloquea el área segura inferior. No existe ninguna solución de CSS.
- `black` o `default` da una barra de estado sólida y permite que los elementos fijos lleguen al área segura inferior.
- `env(safe-area-inset-bottom)` es de unos 34px en los iPhone con Face ID. Úsalo para dar relleno al contenido interactivo por encima del indicador de inicio cuando haga falta.
- En modo `black-translucent` las unidades de viewport `dvh` y `lvh` equivalen a la altura de contenido segura, no a la altura física de la pantalla. No las uses para extender el shell más allá de ese límite.
- `interactive-widget=resizes-content` puede hacer que el shell fijo del chat se redimensione mientras se abre el teclado. Prefiere el comportamiento predeterminado del viewport.

## Guías relacionadas

- [Arquitectura del frontend (desarrolladores)](frontend.md)
- [Guía de la PWA de iOS / iPadOS](../installation/ios-pwa.md)
