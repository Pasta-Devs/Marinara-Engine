# Guía de personalización con Card CSS

Card CSS le da a una tarjeta de personaje o de persona su propio aspecto en el chat. Insertas CSS en las **Creator Notes** (Notas del creador) de la tarjeta, y Marinara lo aplica a los mensajes de ese personaje. Solo puede dar estilo al chat, nunca al resto de la app. Esta guía es para quienes crean tarjetas.

## Antes de empezar

Términos que se usan en esta guía:

- **CSS** controla los colores, las fuentes, los bordes y el espaciado.
- **Card CSS** es el CSS insertado en una tarjeta. Da estilo a los mensajes de esa tarjeta.
- **Card Theming** es el control por chat que activa Card CSS. Está en **Chat Settings → Characters** (Ajustes del chat → Personajes), o en **Party** (Grupo) en Game.
- Un **selector** es la parte de una regla CSS que elige a qué elementos dar estilo. Un espacio entre dos selectores significa "dentro de", así que `.a .b` coincide con un `.b` que está dentro de un `.a`.
- Una **disposición** (layout) es cómo se ordenan los mensajes. Conversation tiene una disposición en filas **Linear** y una disposición **Bubbles**.

## Inicio rápido

Aquí tienes un bloque inicial para pegar en el paso 2:

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

Añades CSS a la tarjeta y luego lo activas en el chat.

1. Abre el personaje en el Character Editor (Editor de personajes) y busca **Creator Notes**. Las personas tienen el mismo campo en el Persona Editor (Editor de personas).
2. Pega el bloque inicial en **Creator Notes** y guarda la tarjeta.
3. Abre un chat con ese personaje.
4. Abre **Chat Settings** y luego **Characters** (o **Party** en Game).
5. Elige **Exclusive** o **Chat** en **Card Theming**. Empieza en **Disabled**.

Los mensajes del personaje cambian de inmediato.

Si no funcionó: los botones **Disabled**, **Exclusive** y **Chat** solo aparecen cuando un personaje activo del chat tiene CSS en sus **Creator Notes**. El CSS de una persona por sí solo no los muestra, así que el tema de una persona también necesita un personaje en el chat con un bloque `<style>`. Comprueba que tu bloque `<style>` se guardó. En los chats de Roleplay, **Color Character Names in Text** (colorear los nombres de personajes en el texto) está en **Characters**, debajo de **Add Character** (Añadir personaje).

El nombre brilla en rosa y el texto se vuelve rosa suave en todas las disposiciones. La regla de la burbuja añade un degradado morado con un borde rosa. `.mari-message-bubble` solo existe en la disposición **Bubbles** y en roleplay, así que en la disposición predeterminada **Linear** de Conversation la regla de la burbuja no hace nada.

Para una prueba imposible de pasar por alto, usa esta regla. Apunta al texto del mensaje, que existe en todos los modos y disposiciones, y vuelve su fondo rosa intenso.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Cómo funciona Card Theming

Cuando un personaje con CSS en **Creator Notes** está activo, Marinara lee cada bloque `<style>`, elimina todo lo peligroso (consulta [Lo que no puedes estilizar](#what-you-cannot-style)), limita el alcance del CSS para que solo pueda llegar al chat y lo inyecta de modo que sus selectores anulen el estilo de mensajes de la propia app.

Eliges cómo se aplica por chat en **Chat Settings → Characters** (o **Party** en Game).

| Modo | Qué hace |
| --- | --- |
| **Disabled** (predeterminado) | Card CSS está desactivado. |
| **Exclusive** | El CSS de cada personaje solo afecta a sus propios mensajes. |
| **Chat** | Todo el Card CSS afecta a toda el área del chat, incluidos los elementos de la interfaz. |

Usa **Exclusive** para chats grupales en los que cada personaje tiene su aspecto. Usa **Chat** para tarjetas de uno a uno que dan estilo a toda la superficie del chat, como el fondo.

## La regla de alcance

Marinara reescribe tu CSS para que solo pueda llegar al chat.

- En el modo **Chat**, todo se acota bajo el área del chat. `[data-card-css]` significa el área del chat.
- En el modo **Exclusive**, todo se acota bajo cada uno de los elementos de mensaje de tu personaje. `[data-card-css]` significa el mensaje de este personaje.

Así que usa `[data-card-css]` para dar estilo al elemento de mensaje en sí, y selectores de clase normales para lo que está dentro de él, como `.mari-message-bubble`, `.mari-message-content` y `.mari-message-name`. Una clase en el mismo elemento no puede coincidir como descendiente. Construye con `[data-card-css] .mari-message-...` y tu tarjeta funcionará en ambos modos.

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

En el alcance **Exclusive**, `[data-card-css]` es el mensaje propio de un personaje, que también es `.mari-message-assistant`. Para dar estilo también a tus propias filas, usa el alcance **Chat**. Ahí `[data-card-css] .mari-message-user` y `.mari-message-assistant` seleccionan cada lado.

## Apuntar a un modo con @chat-mode

Envuelve las reglas en `@chat-mode roleplay`, `@chat-mode conversation` o `@chat-mode game` para apuntar a una sola superficie. El CSS que está fuera de cualquier bloque se aplica en todas partes. Las consultas `@media` estándar funcionan dentro de estos bloques.

```html
<style>
  /* Applies in all modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

El modo Game tiene soporte básico. En el modo **Chat**, el Card CSS llega a toda la superficie del juego, así que `[data-card-css]` da estilo al área del juego. Game tiene su propia disposición y no tiene burbujas de mensaje, así que apunta de forma amplia, por ejemplo al fondo del área. El estilo por personaje (**Exclusive**) de la narración del juego aún no está disponible.

## Lo que puedes estilizar

Roleplay y Conversation comparten el mismo esqueleto. Quédate con las clases `mari-*` y los atributos `data-*` de abajo. Las demás clases cambian entre versiones.

| Selector | A qué apunta |
| --- | --- |
| `[data-card-css]` | Toda la fila del mensaje (el elemento de alcance). Buena para acentos en el borde, o el área del chat en el modo **Chat**. |
| `[data-card-css] .mari-message-bubble` | La burbuja visible: fondo, borde, esquinas, sombra. En **Bubbles** y en roleplay. |
| `[data-card-css] .mari-message-content` | En **Bubbles**, el elemento de la burbuja en sí. En **Linear**, solo el texto del mensaje. |
| `[data-card-css] .mari-message-name` | El nombre visible del personaje. |
| `[data-card-css] .mari-message-meta` | La fila de encabezado con el nombre y la marca de tiempo. |
| `[data-card-css] .mari-message-timestamp` | La marca de tiempo. |
| `[data-card-css] .mari-message-avatar` | La columna del avatar. |
| `[data-card-css] .mari-message-narrator` | Mensajes del narrador (roleplay). |
| `[data-card-css] .mari-message-user` | Mensajes del usuario. Usa `.mari-message-assistant` para los mensajes del personaje. |
| `[data-card-css] p`, `[data-card-css] span` | Párrafos y spans en línea dentro del texto. |
| `[data-grouped]` | Mensajes de continuación del mismo personaje. Solo en Conversation. Usa `[data-card-css]:not([data-grouped])` para el primer mensaje de un grupo. |

Para cambiar la disposición, abre **Settings → Appearance → Conversation** (Configuración → Apariencia → Conversation), luego **Conversation Display** y luego **Chat Layout**. En **Linear**, da estilo a `.mari-message-content` (el texto) y a `[data-card-css]` (la fila), ya que no hay burbuja.

Una burbuja con estilo:

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

En la disposición **Linear** de Conversation, se muestra una fila "(name) is typing..." mientras un personaje escribe.

| Selector | A qué apunta |
| --- | --- |
| `[data-card-css] .mari-typing-text` | La etiqueta. |
| `[data-card-css] .mari-typing-dots span` | Los puntos animados. |
| `[data-card-css] .mari-typing-indicator` | La fila. Lleva el nombre como `data-typing-name`. |

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

El avatar es un círculo de forma predeterminada. El ejemplo apunta al botón de avatar en el que se puede hacer clic. Para un avatar no clicable, usa `.mari-message-avatar > div`. En roleplay el botón está dentro de un `div` envolvente de brillo adicional. Aplánalo si quieres solo tu propio anillo.

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### Panel emergente de perfil "About Me" (solo Conversation)

En el modo Conversation, hacer clic en un avatar abre un panel emergente de perfil con el "about me". Las tarjetas de personaje y las personas pueden dar estilo a su propio panel emergente. No existe en roleplay ni en el juego, así que envuelve estas reglas en `@chat-mode conversation` si también entregas otros modos.

La tarjeta del panel emergente es el elemento de alcance. Apunta a ella con `[data-card-css].mari-about-me-popout` (sin espacio, mismo elemento), y a sus hijos como descendientes. En el modo **Chat** puedes usar `.mari-about-me-name` directamente.

| Selector | A qué apunta |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | La tarjeta del panel emergente: fondo, borde, forma. |
| `[data-card-css] .mari-about-me-banner` | La franja superior del banner (usa el color del nombre de forma predeterminada). |
| `[data-card-css] .mari-about-me-avatar` | El envoltorio del avatar ampliado. Usa `... > div` para el círculo. |
| `[data-card-css] .mari-about-me-status` | El punto de estado de presencia (solo personajes). |
| `[data-card-css] .mari-about-me-name` | El encabezado del nombre visible. |
| `[data-card-css] .mari-about-me-handle` | La línea secundaria @name, que se muestra cuando un nombre visible de Convo es distinto. |
| `[data-card-css] .mari-about-me-presence` | La línea de estado o actividad (solo personajes). |
| `[data-card-css] .mari-about-me-box` | La caja contenedora de About Me. |
| `[data-card-css] .mari-about-me-label` | El texto "ABOUT ME". |
| `[data-card-css] .mari-about-me-badge` | La pastilla Default o Chat-specific. |
| `[data-card-css] .mari-about-me-text` | El cuerpo de texto del about-me. |

```css
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
  }
}
```

<a id="what-you-cannot-style"></a>

## Lo que no puedes estilizar

El saneador elimina lo siguiente por seguridad.

| Bloqueado | Por qué |
| --- | --- |
| `url(https://...)` | Sin peticiones de red, para evitar el rastreo y las fugas de datos. Solo se permite `url(data:...)`, para imágenes y fuentes en línea. |
| `@font-face` con URLs externas | Solo se conservan las fuentes `data:`. El nombre de la familia se renombra para que no pueda anular las fuentes de la app. |
| `@import` | Sin cargar hojas de estilo externas. |
| Selectores `:has()` | No pueden sondear elementos fuera del chat. |
| Reglas anidadas y selectores que empiezan por `~` o `+` | Se eliminan, para que el Card CSS no pueda salir de su ámbito. Escribe selectores normales. |
| HTML en `content:` | Se permite texto decorativo, pero `<` y `>` se eliminan y el texto se limita a 200 caracteres. Se permiten `attr()` y `counter()`. |
| `position: fixed` | Se reescribe a `position: absolute`, así que no hay superposiciones a pantalla completa. |
| `!important` | Se elimina, para que el Card CSS no pueda forzar la anulación de los estilos de la app. |
| Tokens del tema de la app | Los tokens como `--primary` y `--background` se eliminan, para que el Card CSS no pueda repintar la interfaz de la app. |

Card CSS supera en prioridad a los propios estilos de mensaje de la app para los colores, fondos, bordes y fuentes dentro del chat. No puede vencer lo que el saneador elimina, cualquier cosa fuera del chat, ni los estilos que la app aplica en línea o con `!important`. El color y el tamaño de fuente globales de tu chat en **Settings** son un ejemplo.

Para una fuente personalizada, insértala con un URI `data:` en base64, o usa una pila de fuentes del sistema.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## Consejos

1. Da estilo a la burbuja con `.mari-message-bubble`, no con `[data-card-css]`. La fila ocupa todo el ancho, así que un fondo sobre ella es casi invisible.
2. Usa colores `rgba()` para que se mezclen tanto en temas claros como oscuros.
3. Mantén las animaciones sutiles. Prefiere `transition` en vez de `animation` pesada en dispositivos de gama baja. Anima `opacity`, no `box-shadow`, que se vuelve a pintar en cada fotograma.
4. Usa `@media (max-width: 768px)` para teléfonos.
5. No dependas de las clases de utilidad. Solo los enganches `mari-*` documentados son estables.

## Muestra: Eldritch Grimoire

Este ejemplo toca los enganches principales en cada modo: nombres brillantes, texto serif con estilo, un avatar con anillo, una burbuja de roleplay animada con una runa en la esquina, una burbuja de Conversation, un indicador de escritura inquietante y la superficie del juego. Pégalo en **Creator Notes** y luego elige un modo de Card Theming en **Chat Settings → Characters** (o **Party** en Game). Pon **Chat** para la superficie del juego. Cambia los colores, el glifo de `content` y las fuentes para hacerlo tuyo.

```html
<style>
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* All modes */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
  }
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  @chat-mode roleplay {
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* breathing inner glow: animate a full-bleed overlay's opacity, which is cheap */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
    }
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
    }
  }

  @chat-mode conversation {
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
    }
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
    }
  }

  /* Game: in Chat scope, [data-card-css] is the whole game surface */
  @chat-mode game {
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

## Usar un asistente de IA para crear Card CSS

Para no escribir CSS a mano, dale a un asistente de IA este prompt (las instrucciones enviadas a la IA). Rellena tu concepto de personaje donde se indica.

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
