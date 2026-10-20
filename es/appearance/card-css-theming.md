# Guía de personalización con Card CSS

Esta guía muestra a quienes crean personajes y personas cómo darle a una tarjeta su propio aspecto en el chat. Insertas CSS en las **Creator Notes** (Notas del creador) de la tarjeta, y Marinara Engine lo aplica de forma segura a los mensajes de ese personaje. Solo puede dar estilo al chat, nunca al resto de la app.

## Antes de empezar

Unas cuantas definiciones sencillas que se usan a lo largo de esta guía:

- **CSS** es el lenguaje que controla los colores, las fuentes, los bordes y el espaciado en una página web.
- **Card CSS** es el CSS que insertas en una tarjeta de personaje o de persona. Da estilo a los mensajes de esa tarjeta.
- **Card Theming** es el control en pantalla que activa el Card CSS para un chat.
- Un **selector** es la parte de una regla CSS que elige a qué elementos dar estilo.
- Un **selector de descendiente** usa un espacio para significar "dentro de". `.a .b` coincide con un `.b` que está dentro de un `.a`.
- La **cascada** es el sistema de CSS que decide qué regla gana cuando varias reglas se aplican al mismo elemento.
- Una **disposición** (layout) es cómo se ordenan los mensajes en la pantalla. Marinara tiene una disposición en fila **Linear** y una disposición **Bubbles**.

## Inicio rápido

Das estilo a una tarjeta en dos lugares. Primero añades CSS a la tarjeta. Luego lo activas en el chat.

1. Abre el personaje en el Character Editor (Editor de personajes) y busca el campo **Creator Notes**. Las personas tienen el mismo campo en el Persona Editor (Editor de personas).
2. Pega un bloque `<style>` en **Creator Notes** y guarda la tarjeta.
3. Abre un chat con ese personaje.
4. Abre **Chat Settings** (Ajustes del chat) y luego la sección **Card Theming**.
5. Elige **Exclusive** o **Chat**. El modo empieza en **Disabled**.

Deberías ver cómo los mensajes del personaje cambian de inmediato. El control **Card Theming** solo aparece cuando un personaje activo en ese chat tiene CSS en sus **Creator Notes**. El CSS de una persona por sí solo no hace que aparezca el control. Al menos un personaje del chat debe llevar su propio bloque `<style>`. Si no ves el control, comprueba que tu bloque `<style>` se guardó correctamente.

Aquí tienes un bloque inicial para pegar en **Creator Notes**:

```html
<style>
  /* the visible message bubble (Bubbles layout, and roleplay) */
  [data-card-css] .mari-message-bubble {
    background: linear-gradient(135deg, #2a1240, #3a1030);
    border: 1px solid #ff66cc;
    border-radius: 14px;
  }
  /* the name and the text (works in every message style) */
  [data-card-css] .mari-message-name {
    color: #ff8fd4;
    text-shadow: 0 0 8px rgba(255, 102, 204, 0.6);
  }
  [data-card-css] .mari-message-content {
    color: #ffd6f0;
  }
</style>
```

El nombre del personaje brilla en rosa y su texto se vuelve rosa suave en cualquier disposición. La regla de la burbuja añade un degradado morado con un borde rosa. Una salvedad: `.mari-message-bubble` solo existe en la disposición **Bubbles** y en roleplay. La disposición predeterminada de Conversation es **Linear**, que no tiene elemento de burbuja, así que la regla de la burbuja no hace nada ahí. La nota "Bubbles frente a Linear" más abajo explica la diferencia.

**Comprobación básica:** para una prueba innegable, usa la regla de abajo. Apunta al texto del mensaje, que existe en todos los modos y disposiciones. El fondo del texto debería volverse rosa intenso al instante.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Cómo funciona Card Theming

Cuando un personaje con CSS en sus **Creator Notes** está activo, Marinara hace cuatro cosas:

1. Lee cada bloque `<style>` de las **Creator Notes**.
2. Sanea el CSS y elimina todo lo peligroso. Consulta la sección "Lo que no puedes estilizar" más abajo.
3. Limita el alcance del CSS para que solo pueda llegar al chat.
4. Inyecta el CSS de modo que sus selectores acotados anulen el estilo de mensajes de la propia app.

Eliges cómo se aplica por chat en **Chat Settings** y luego en **Card Theming**. Hay tres modos.

| Modo | Qué hace |
| --- | --- |
| **Disabled** (predeterminado) | El Card CSS está desactivado, así que no se aplica ningún estilo de personaje. |
| **Exclusive** | El CSS de cada personaje solo afecta a sus propios mensajes. |
| **Chat** | Todo el Card CSS afecta a toda el área del chat, incluidos los elementos de la interfaz. |

Usa **Exclusive** para chats grupales donde cada personaje tiene su propio aspecto. Usa **Chat** para chats de un solo personaje donde quieres que la tarjeta dé estilo a toda la superficie del chat.

## La única regla de alcance que importa

Marinara reescribe tu CSS para que solo pueda llegar al chat. Cómo lo reescribe depende del modo.

- El modo **Chat** acota todo bajo el área del chat. `.mari-message-bubble` coincide con normalidad, porque está dentro del área.
- El modo **Exclusive** acota todo bajo cada uno de los elementos de mensaje del propio personaje. Estos llevan `data-card-css`. Una clase en ese mismo elemento no puede coincidir con él como descendiente. Solo pueden hacerlo las cosas que están dentro de él.

Así que aquí está la regla portable. Usa `[data-card-css]` para dar estilo al elemento de mensaje en sí. Usa selectores de clase normales para todo lo que está dentro de él, como `.mari-message-bubble`, `.mari-message-content` y `.mari-message-name`.

`[data-card-css]` significa "el mensaje de este personaje" en el modo **Exclusive** y "el área del chat" en el modo **Chat**. Funciona en ambos. Los selectores de elementos internos (los que llevan un espacio) funcionan igual en los dos modos.

```css
[data-card-css] {
  /* the message row itself, good for a left accent border */
  border-left: 3px solid #ff66cc;
}
[data-card-css] .mari-message-bubble {
  /* the visible bubble inside it */
  border-radius: 14px;
}
```

## Apuntar a un modo con @chat-mode

Envuelve las reglas en bloques `@chat-mode` para apuntar a una sola superficie. El CSS que está fuera de cualquier bloque se aplica en todas partes.

```html
<style>
  /* Applies in ALL modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  /* Only in Roleplay mode */
  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  /* Only in Conversation mode */
  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

Las consultas `@media` estándar funcionan con normalidad dentro de los bloques `@chat-mode`. Úsalas para disposiciones adaptables.

**Game mode** tiene soporte básico. En el modo **Chat**, el Card CSS llega a toda la superficie del juego. Así que `[data-card-css]` da estilo al área del juego, y `@chat-mode game` la apunta. El juego usa su propia disposición. Los enganches de burbuja de mensaje de arriba no existen ahí, así que apunta de forma amplia, por ejemplo al fondo del área. El estilo por personaje (Exclusive) de la narración del juego aún no está disponible.

## Lo que puedes estilizar

La estructura del chat es el mismo esqueleto en Roleplay y en Conversation. Estos son los elementos a los que el Card CSS puede apuntar. Las clases de utilidad internas no son enganches estables. Cambian entre versiones, así que quédate con las clases `mari-*` y los atributos `data-*` de abajo.

| Selector | A qué apunta |
| --- | --- |
| `[data-card-css]` | Toda la fila del mensaje (el elemento de alcance). Bueno para acentos a la izquierda o en el borde, o el área del chat en el modo **Chat**. |
| `[data-card-css] .mari-message-bubble` | La burbuja visible: fondo, borde, esquinas, sombra. Presente en la disposición **Bubbles** y en roleplay. |
| `[data-card-css] .mari-message-content` | En **Bubbles**, el elemento de la burbuja en sí, incluidos el fondo, el borde y las esquinas. En **Linear**, solo el texto del mensaje. |
| `[data-card-css] .mari-message-name` | El nombre visible del personaje. |
| `[data-card-css] .mari-message-meta` | La fila de encabezado que contiene el nombre y la marca de tiempo. |
| `[data-card-css] .mari-message-timestamp` | La marca de tiempo. |
| `[data-card-css] .mari-message-avatar` | La columna del avatar. |
| `[data-card-css] .mari-message-narrator` | Mensajes del narrador (roleplay). |
| `[data-card-css] .mari-message-user` | Mensajes del usuario. Usa `.mari-message-assistant` para los mensajes del personaje. |
| `[data-card-css] p`, `... span` | Párrafos y spans en línea dentro del texto. |
| `[data-grouped]` | Mensajes de continuación del mismo personaje. Solo en el modo Conversation; las filas de roleplay nunca lo llevan. Usa `[data-card-css]:not([data-grouped])` para el primer mensaje de un grupo. |

**Bubbles frente a Linear.** La disposición **Bubbles** es la que apunta `.mari-message-bubble`. La disposición **Linear** no tiene elemento de burbuja, así que da estilo a `.mari-message-content` (el texto) y a `[data-card-css]` (la fila) en su lugar. Cambia la disposición en **Settings** (Configuración), luego **Appearance**, luego la sección **Conversation Display** y luego **Chat Layout**. El roleplay siempre tiene burbuja.

Aquí tienes una burbuja de conversación o roleplay con estilo:

```css
[data-card-css] .mari-message-bubble {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(100, 149, 237, 0.35);
  border-radius: 1rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
[data-card-css] .mari-message-name {
  color: #6495ed;
  text-shadow: 0 0 8px rgba(100, 149, 237, 0.5);
}
[data-card-css] .mari-message-content {
  font-family: Georgia, serif;
}
```

### Indicador de escritura

Mientras un personaje redacta una respuesta, la disposición **Linear** de Conversation muestra una fila "(name) is typing...". Puedes darle estilo.

| Selector | A qué apunta |
| --- | --- |
| `[data-card-css] .mari-typing-text` | La etiqueta "(name) is typing...". |
| `[data-card-css] .mari-typing-dots span` | Los puntos animados. |
| `[data-card-css] .mari-typing-indicator` | La fila en sí. También lleva el nombre como `data-typing-name`. |

```css
[data-card-css] .mari-typing-text {
  color: #ff66cc;
  font-style: italic;
}
[data-card-css] .mari-typing-dots span {
  background: #ff66cc;
}
```

### Avatar

El avatar es un círculo de forma predeterminada. Puedes cambiar su forma y ponerle un anillo con CSS puro. Los ejemplos de abajo apuntan al botón de avatar donde se puede hacer clic. Si una superficie muestra el avatar como no clicable, usa la misma idea sobre el respaldo `.mari-message-avatar > div` para esa disposición. En roleplay el botón está dentro de un `div` envolvente de brillo adicional. Aplana ese envoltorio si quieres solo tu propio anillo.

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
/* roleplay only: drop the app glow wrapper so just your ring shows */
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### Panel emergente de perfil "About Me" (solo Conversation)

En el modo Conversation, hacer clic en un avatar abre un panel emergente de perfil con el "about me" del personaje o de la persona. Puedes darle estilo con el mismo alcance `[data-card-css]`. Este panel emergente solo existe en el modo Conversation. No existe en roleplay ni en el juego. Envuelve estas reglas en `@chat-mode conversation` si también entregas CSS de roleplay o de juego. Tanto las tarjetas de personaje como las personas pueden dar estilo a su propio panel emergente desde sus **Creator Notes**.

Una salvedad para las personas: el control **Card Theming** solo aparece cuando un personaje activo del chat tiene CSS en sus **Creator Notes**. El CSS solo de persona no hace que aparezca el control. Así que, para que el tema del panel emergente de una persona funcione, al menos un personaje del chat también debe llevar un bloque `<style>`.

| Selector | A qué apunta |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | La propia tarjeta del panel emergente (el elemento de alcance): fondo, borde, forma. |
| `[data-card-css] .mari-about-me-banner` | La franja superior del banner (usa el color del nombre de forma predeterminada). |
| `[data-card-css] .mari-about-me-avatar` | El envoltorio del avatar ampliado. Usa `... > div` para el círculo. |
| `[data-card-css] .mari-about-me-status` | El punto de estado de presencia (solo personajes). |
| `[data-card-css] .mari-about-me-name` | El encabezado del nombre visible. |
| `[data-card-css] .mari-about-me-handle` | La línea secundaria @name (se muestra cuando un nombre visible de Convo es distinto). |
| `[data-card-css] .mari-about-me-presence` | La línea de estado o actividad (solo personajes). |
| `[data-card-css] .mari-about-me-box` | La caja contenedora de About Me. |
| `[data-card-css] .mari-about-me-label` | El texto "ABOUT ME". |
| `[data-card-css] .mari-about-me-badge` | La pastilla Default o Chat-specific. |
| `[data-card-css] .mari-about-me-text` | El cuerpo de texto del about-me renderizado. |

La tarjeta del panel emergente es el elemento de alcance. Apúntalo con `[data-card-css].mari-about-me-popout` (sin espacio, mismo elemento). Apunta a sus hijos con un selector de descendiente, como `[data-card-css] .mari-about-me-name`. En el modo **Chat** toda el área está acotada, así que puedes usar `.mari-about-me-name` directamente.

Aquí tienes un panel emergente "about me" con estilo. Pégalo en las **Creator Notes** de un personaje o de una persona, y luego activa **Card Theming** en **Chat Settings**. Si lo pegas en una persona, recuerda la salvedad de arriba. Un personaje del chat también debe tener CSS en sus **Creator Notes**, o el control queda oculto.

```html
<style>
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-avatar > div {
    border-radius: 0.9rem; /* squircle avatar */
    box-shadow: 0 0 0 2px #b478ff;
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
    text-shadow: 0 0 10px rgba(180, 120, 255, 0.6);
  }
  [data-card-css] .mari-about-me-box {
    background: rgba(180, 120, 255, 0.08);
    border: 1px solid rgba(180, 120, 255, 0.25);
    border-radius: 0.75rem;
  }
  [data-card-css] .mari-about-me-label {
    color: #b478ff;
    letter-spacing: 0.12em;
  }
  [data-card-css] .mari-about-me-text {
    font-family: Georgia, serif;
    color: #f2e9ff;
  }
}
</style>
```

## Lo que no puedes estilizar

El saneador elimina lo siguiente por seguridad.

| Bloqueado | Por qué |
| --- | --- |
| `url(https://...)` | Sin peticiones de red, para evitar el rastreo y las fugas de datos. Solo se permite `url(data:...)`, para imágenes y fuentes en línea. |
| `@font-face` con URLs externas | Solo se conservan las fuentes `data:`. El nombre de la familia se renombra automáticamente para que no pueda anular las fuentes de la app. |
| `@import` | Sin cargar hojas de estilo externas. |
| Selectores `:has()` | No pueden sondear elementos fuera del chat. |
| Reglas anidadas y selectores que empiezan por `~` o `+` | Se eliminan, para que el Card CSS no pueda salir de su ámbito. Escríbelos como selectores normales. |
| HTML en `content:` | Se permite texto decorativo, pero `<` y `>` se eliminan y el texto se limita a 200 caracteres. Se permiten `attr()` y `counter()`. |
| `position: fixed` | Se reescribe a `position: absolute`, así que no hay superposiciones a pantalla completa. |
| `!important` | Se elimina, para que el Card CSS no pueda forzar la anulación de los estilos de la app. |
| Tokens del tema de la app | Los tokens como `--primary` y `--background` se eliminan, para que el Card CSS no pueda repintar la interfaz de la app. |

El Card CSS se inyecta con selectores acotados que superan en prioridad a los propios estilos de mensaje de la app. Gana para los colores, fondos, bordes y fuentes dentro del chat. Lo único que no puede vencer es lo que el saneador elimina, cualquier cosa fuera del chat, y los estilos que la app aplica en línea o con `!important`. El color y el tamaño de fuente globales de tu chat en **Settings** son uno de esos ejemplos.

**Fuentes personalizadas.** Inserta una fuente con un URI `data:` en base64, o usa una pila de sistema o segura para web.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## Exclusive frente a Chat: elegir un alcance

- **Exclusive** hace que `[data-card-css]` signifique los mensajes de este personaje. Es lo mejor para chats grupales y para la identidad por personaje. El CSS que apunta a elementos dentro del mensaje funciona igual que en el modo **Chat**.
- **Chat** hace que `[data-card-css]` signifique toda el área del chat. Es lo mejor para tarjetas de uno a uno que quieren dar estilo al fondo o a la atmósfera, no solo a las burbujas de mensaje.

Construye con selectores `[data-card-css] .mari-message-...` y tu tarjeta funcionará correctamente en ambos modos.

## Consejos

1. Da estilo a la burbuja con `.mari-message-bubble`, no con `[data-card-css]`. Este último es la fila de ancho completo, así que un fondo sobre él es casi invisible.
2. Usa colores `rgba()` para que se mezclen tanto en temas claros como oscuros.
3. Mantén las animaciones sutiles. Prefiere `transition` en vez de `animation` pesada en dispositivos de gama baja.
4. Usa `@media (max-width: 768px)` para teléfonos.
5. No dependas de las clases de utilidad. Solo los enganches `mari-*` documentados son estables.

## Muestra: Eldritch Grimoire

Esta es una tarjeta deliberadamente extravagante. Toca cada enganche documentado, en cada modo. Demuestra:

- nombres en versalitas rúnicas brillantes y texto serif con estilo
- un avatar con forma cambiada y anillo, más marcas de tiempo en versalitas
- un sigilo en el borde de la fila del mensaje
- una burbuja de roleplay animada con una runa en la esquina, y narración con estilo
- una burbuja de Conversation y un indicador de escritura inquietante
- el panel emergente de perfil al hacer clic en el avatar, con estilo completo
- la superficie del juego

Pégala entera en **Creator Notes**, y luego activa **Card Theming** en **Chat Settings**. Da estilo a los mensajes en Roleplay y Conversation, al panel emergente en Conversation, y a la superficie en Game (pon el modo en **Chat** para el juego). Las secciones están divididas por `@chat-mode` para que cada modo reciba exactamente los enganches que tiene. Todo es seguro para el saneador.

```html
<style>
  /* shared keyframe. Animate OPACITY, never box-shadow: box-shadow is a "paint"
     property, so animating it repaints and re-blurs the whole element every frame
     (which pins weak GPUs). Animating a layer's opacity is GPU-composited and cheap. */
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* EVERYWHERE (all modes). */
  /* These descendant hooks only match where message rows exist, so they are inert
     in Game and safe to leave unwrapped. */

  /* the character name, glowing crimson rune-caps */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.82rem;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  /* header row and timestamp */
  [data-card-css] .mari-message-meta {
    align-items: baseline;
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  /* reshape, ring, and saturate the clickable avatar. For a non-clickable avatar,
     target .mari-message-avatar > div for that layout. */
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
    filter: saturate(1.2) contrast(1.05);
  }
  /* glowing serif message text */
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    text-shadow: 0 0 2px rgba(168, 85, 247, 0.4);
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  /* ROLEPLAY */
  @chat-mode roleplay {
    /* the row itself, an arcane left edge. (data-grouped does not exist in
       roleplay, so there is no first-of-run trick here.) */
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    /* roleplay wraps the avatar button in its own glow layer. Flatten it
       so only the eldritch ring above hugs the picture. */
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    /* the visible bubble and a corner sigil */
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      /* a steady outer halo. An element's own box-shadow is not clipped by its own
         overflow: hidden, so this bloom shows even though message content is clipped.
         (No inset here: the pulsing inset glow lives on the ::after, so a static inset
         would stack with it and over-brighten the inner glow.) */
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* the breathing inner glow. Animate a full-bleed overlay's OPACITY (cheap, GPU
       composited) instead of the bubble's box-shadow (expensive: a full repaint every
       frame). overflow: hidden clips a child's OUTER shadow, so the pulse rides the inset
       glow while the halo above stays steady. pointer-events keeps it click-through. */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
      will-change: opacity;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
      text-shadow: 0 0 6px rgba(220, 38, 120, 0.9);
    }
    /* narration */
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
      opacity: 0.9;
    }
  }

  /* CONVERSATION */
  @chat-mode conversation {
    /* an arcane left edge on the first message of a run. [data-grouped] marks
       continuations from the same character, and it exists only in
       Conversation mode. */
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css][data-grouped] {
      border-left: 2px solid transparent;
    }
    /* the Bubbles-layout bubble. In the Linear layout there is no bubble, so
       the EVERYWHERE row hooks above carry the theme instead. */
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    /* "(name) is typing..." (Linear layout) */
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
      letter-spacing: 0.05em;
      text-shadow: 0 0 8px rgba(255, 92, 138, 0.6);
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
      box-shadow: 0 0 6px rgba(255, 92, 138, 0.85);
    }

    /* the avatar-click profile popout. The popout card is the scope element,
       so target it with no space, and its children as descendants. */
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-avatar > div {
      border-radius: 0.9rem;
      box-shadow: 0 0 0 2px #dc2678, 0 0 14px rgba(168, 85, 247, 0.5);
    }
    [data-card-css] .mari-about-me-status {
      box-shadow: 0 0 8px rgba(255, 92, 138, 0.9);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
      text-shadow: 0 0 10px rgba(220, 38, 120, 0.6);
    }
    [data-card-css] .mari-about-me-handle {
      color: rgba(201, 168, 255, 0.8);
    }
    [data-card-css] .mari-about-me-presence {
      color: rgba(201, 168, 255, 0.7);
    }
    [data-card-css] .mari-about-me-box {
      background: rgba(168, 85, 247, 0.08);
      border: 1px solid rgba(220, 38, 120, 0.3);
      border-radius: 0.75rem;
    }
    [data-card-css] .mari-about-me-label {
      color: #dc2678;
      letter-spacing: 0.14em;
    }
    [data-card-css] .mari-about-me-badge {
      background: rgba(220, 38, 120, 0.18);
      color: #ffd7ef;
    }
    [data-card-css] .mari-about-me-text {
      color: #f3d7ff;
      font-family: "Iowan Old Style", Georgia, serif;
    }
  }

  /* GAME (set the mode to Chat) */
  @chat-mode game {
    /* Game has its own layout with no message bubbles. In Chat scope,
       [data-card-css] is the whole game surface, so theme the area broadly. */
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

**Filas de usuario frente a filas de personaje.** En el alcance **Exclusive**, `[data-card-css]` es el mensaje propio de un personaje, que también es `.mari-message-assistant`. Para dar estilo también a tus propias filas, usa el alcance **Chat**. Ahí `[data-card-css]` es toda el área, y `[data-card-css] .mari-message-user` y `.mari-message-assistant` seleccionan cada lado.

Cambia los colores, el glifo de `content` y las fuentes para hacerlo tuyo.

## Usar un asistente de IA para crear Card CSS

Si prefieres no escribir el CSS a mano, dale a un asistente de IA este prompt (las instrucciones enviadas a la IA). Rellena tu concepto de personaje donde se indica.

```text
I'm creating a character card for Marinara Engine (an AI chat app). The card has a
"Creator Notes" field where I can embed <style> blocks. Write CSS that themes the
character's messages.

Character concept: [describe the aesthetic]

Technical constraints:
- Use [data-card-css] for the message row (works in both Exclusive and Chat modes);
  use normal class selectors for things inside it.
- [data-card-css] .mari-message-bubble = the visible bubble (background / border /
  corners / shadow); [data-card-css] .mari-message-content = the text;
  [data-card-css] .mari-message-name = the display name;
  [data-card-css] .mari-message-avatar button = the clickable avatar
  (non-clickable fallback: .mari-message-avatar > div; in roleplay the button sits
  under an extra glow-wrapper div).
- Style the typing indicator via [data-card-css] .mari-typing-text and
  [data-card-css] .mari-typing-dots span.
- Conversation only: the avatar-click "about me" popout is themable via
  [data-card-css].mari-about-me-popout (the card), the banner via
  .mari-about-me-banner, the avatar via .mari-about-me-avatar > div, the name via
  .mari-about-me-name, the box via .mari-about-me-box, and the body via
  .mari-about-me-text. Wrap these in @chat-mode conversation { ... }.
- Wrap roleplay-only CSS in @chat-mode roleplay { ... }, conversation-only in
  @chat-mode conversation { ... }; CSS outside applies everywhere.
- Blocked: url(https://...), @import, :has(), !important, app theme tokens
  (--primary, etc.). position: fixed becomes absolute. Use url(data:...) and
  rgba() colors.
- [data-grouped] marks continuation messages, in Conversation mode ONLY
  (roleplay rows never carry it); there, use
  [data-card-css]:not([data-grouped]) for first-in-group.

Output a single <style> block I can paste into Creator Notes.
```

## Guías relacionadas

- [Configuración de apariencia](appearance-settings.md)
- [Temas CSS personalizados (Biblioteca de temas)](custom-css-themes.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
