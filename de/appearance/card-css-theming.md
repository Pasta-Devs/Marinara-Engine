# Anleitung zum Card-CSS-Theming

Diese Anleitung richtet sich an alle, die Charaktere und Personas bauen und ihrer Karte im Chat ein eigenes Aussehen geben wollen. Das CSS steckt in den **Creator Notes** (Notizen der Erstellerin) der Karte, und Marinara Engine wendet es kontrolliert auf die Nachrichten dieses Charakters an. Gestaltet wird dabei ausschließlich der Chat, nie der Rest der App.

## Bevor du loslegst

Ein paar Begriffe, die in dieser Anleitung immer wieder vorkommen:

- **CSS** ist die Sprache, die Farben, Schriften, Rahmen und Abstände auf einer Webseite steuert.
- **Card CSS** ist CSS, das in einer Charakter- oder Persona-Karte steckt. Es gestaltet die Nachrichten genau dieser Karte.
- **Card Theming** ist das Bedienelement, mit dem du Card CSS für einen Chat einschaltest.
- Ein **Selektor** ist der Teil einer CSS-Regel, der bestimmt, welche Elemente gestaltet werden.
- Ein **Nachfahren-Selektor** nutzt ein Leerzeichen im Sinne von „innerhalb“. `.a .b` trifft ein `.b`, das in einem `.a` liegt.
- Die **Kaskade** ist das CSS-System, das entscheidet, welche Regel gewinnt, wenn mehrere Regeln dasselbe Element betreffen.
- Ein **Layout** bestimmt, wie Nachrichten auf dem Bildschirm angeordnet sind. Marinara kennt das Zeilen-Layout **Linear** und das Layout **Bubbles**.

## Schnellstart

Das Theming einer Karte passiert an zwei Stellen: Erst kommt das CSS in die Karte, dann schaltest du es im Chat ein.

1. Öffne den Charakter im **Character Editor** (Charakter-Editor) und suche das Feld **Creator Notes**. Bei Personas liegt dasselbe Feld im **Persona Editor** (Persona-Editor).
2. Füge einen `<style>`-Block in die **Creator Notes** ein und speichere die Karte.
3. Öffne einen Chat mit diesem Charakter.
4. Öffne die **Chat Settings** (Chat-Einstellungen) und dort den Bereich **Card Theming**.
5. Wähle **Exclusive** oder **Chat**. Der Modus steht anfangs auf **Disabled**.

Die Nachrichten des Charakters sollten sich sofort verändern. Das Bedienelement **Card Theming** taucht erst auf, sobald ein aktiver Charakter in diesem Chat CSS in seinen **Creator Notes** hat. Persona-CSS allein bringt es nicht zum Vorschein. Mindestens ein Charakter im Chat braucht also einen eigenen `<style>`-Block. Fehlt das Bedienelement, prüfe zuerst, ob der `<style>`-Block wirklich gespeichert wurde.

Dieser Startblock lässt sich direkt in die **Creator Notes** einfügen:

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

Der Name des Charakters leuchtet pink, der Text wird in jedem Layout zart rosa. Die Bubble-Regel ergänzt einen lila Verlauf mit pinkem Rahmen. Ein Haken bleibt: `.mari-message-bubble` existiert nur im Layout **Bubbles** und im Roleplay. Conversation nutzt standardmäßig **Linear**, und dort gibt es kein Bubble-Element – die Bubble-Regel läuft also ins Leere. Der Hinweis „Bubbles im Vergleich zu Linear“ weiter unten erklärt den Unterschied.

**Kurzer Gegentest:** Für einen Test, der garantiert sichtbar ist, nimm die Regel unten. Sie trifft den Nachrichtentext, den es in jedem Modus und jedem Layout gibt. Der Texthintergrund muss sofort grellpink werden.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## So funktioniert Card Theming

Sobald ein Charakter mit CSS in den **Creator Notes** aktiv ist, erledigt Marinara vier Dinge:

1. Marinara liest jeden `<style>`-Block aus den **Creator Notes**.
2. Marinara bereinigt das CSS und entfernt alles Gefährliche. Siehe den Abschnitt „Was du nicht gestalten kannst“ weiter unten.
3. Marinara grenzt den Scope (Geltungsbereich) so ein, dass das CSS nur den Chat erreicht.
4. Marinara fügt das CSS so ein, dass die eingegrenzten Selektoren die eigene Nachrichtengestaltung der App überstimmen.

Wie das Ganze angewendet wird, entscheidest du pro Chat unter **Chat Settings → Card Theming**. Es gibt drei Modi.

| Modus | Wirkung |
| --- | --- |
| **Disabled** (Standard) | Card CSS ist aus, es wird keine Charaktergestaltung angewendet. |
| **Exclusive** | Das CSS eines Charakters wirkt nur auf dessen eigene Nachrichten. |
| **Chat** | Sämtliches Card CSS wirkt auf den gesamten Chatbereich, inklusive der Oberflächenelemente. |

Nimm **Exclusive** für Gruppenchats, in denen jeder Charakter sein eigenes Aussehen bekommt. Nimm **Chat** für Chats mit einem einzigen Charakter, dessen Karte die komplette Chatfläche gestalten soll.

## Die eine Scope-Regel, auf die es ankommt

Marinara schreibt dein CSS so um, dass es nur den Chat erreicht. Wie umgeschrieben wird, hängt vom Modus ab.

- **Chat** grenzt alles auf den Chatbereich ein. `.mari-message-bubble` trifft ganz normal, weil es innerhalb dieses Bereichs liegt.
- **Exclusive** grenzt alles auf die eigenen Nachrichtenelemente des jeweiligen Charakters ein. Diese tragen `data-card-css`. Eine Klasse auf genau diesem Element kann es nicht als Nachfahre treffen – nur was darin liegt.

Daraus folgt die überall gültige Regel: Gestalte das Nachrichtenelement selbst über `[data-card-css]`. Alles darin sprichst du mit gewöhnlichen Klassen-Selektoren an, etwa `.mari-message-bubble`, `.mari-message-content` und `.mari-message-name`.

`[data-card-css]` bedeutet in **Exclusive** „die Nachricht dieses Charakters“ und in **Chat** „der Chatbereich“. Es funktioniert also in beiden Modi. Die Selektoren für die inneren Elemente – die mit Leerzeichen – verhalten sich in beiden Modi gleich.

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

## Einzelne Modi mit @chat-mode ansprechen

Regeln in `@chat-mode`-Blöcken wirken nur auf eine bestimmte Fläche. CSS außerhalb solcher Blöcke gilt überall.

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

Gewöhnliche `@media`-Abfragen funktionieren innerhalb von `@chat-mode`-Blöcken ganz normal. Nutze sie für responsive Layouts.

**Game Mode** wird in Grundzügen unterstützt. Im Modus **Chat** erreicht Card CSS die gesamte Spielfläche. `[data-card-css]` gestaltet also den Spielbereich, und `@chat-mode game` spricht ihn an. Game bringt ein eigenes Layout mit. Die oben genannten Bubble-Anker existieren dort nicht – arbeite deshalb großflächig, zum Beispiel über den Hintergrund des Bereichs. Eine Gestaltung der Spielerzählung pro Charakter (Exclusive) gibt es noch nicht.

## Was du gestalten kannst

Die Chat-Struktur folgt in Roleplay und Conversation demselben Grundgerüst. Diese Elemente kann Card CSS ansprechen. Interne Hilfsklassen sind keine verlässlichen Anker: Sie ändern sich von Version zu Version. Halte dich deshalb an die `mari-*`-Klassen und `data-*`-Attribute unten.

| Selektor | Worauf er wirkt |
| --- | --- |
| `[data-card-css]` | Die komplette Nachrichtenzeile (das Scope-Element). Gut für Akzente am linken oder äußeren Rand – oder für den Chatbereich im Modus **Chat**. |
| `[data-card-css] .mari-message-bubble` | Die sichtbare Bubble: Hintergrund, Rahmen, Ecken, Schatten. Vorhanden im Layout **Bubbles** und im Roleplay. |
| `[data-card-css] .mari-message-content` | In **Bubbles** das Bubble-Element selbst, samt Hintergrund, Rahmen und Ecken. In **Linear** nur der Nachrichtentext. |
| `[data-card-css] .mari-message-name` | Der angezeigte Name des Charakters. |
| `[data-card-css] .mari-message-meta` | Die Kopfzeile mit Name und Zeitstempel. |
| `[data-card-css] .mari-message-timestamp` | Der Zeitstempel. |
| `[data-card-css] .mari-message-avatar` | Die Avatar-Spalte. |
| `[data-card-css] .mari-message-narrator` | Erzähler-Nachrichten (Roleplay). |
| `[data-card-css] .mari-message-user` | Nachrichten der Nutzerin. Für Charakternachrichten nimm `.mari-message-assistant`. |
| `[data-card-css] p`, `... span` | Absätze und Inline-Spans innerhalb des Textes. |
| `[data-grouped]` | Folgenachrichten desselben Charakters. Nur im Conversation Mode; Roleplay-Zeilen tragen das Attribut nie. Für die erste Nachricht einer Gruppe nimm `[data-card-css]:not([data-grouped])`. |

**Bubbles im Vergleich zu Linear.** `.mari-message-bubble` zielt auf das Layout **Bubbles**. Im Layout **Linear** gibt es kein Bubble-Element – gestalte dort stattdessen `.mari-message-content` (den Text) und `[data-card-css]` (die Zeile). Das Layout wechselst du unter **Settings** (Einstellungen) → **Appearance** (Darstellung) → Bereich **Conversation Display** → **Chat Layout**. Roleplay hat immer eine Bubble.

Eine gestaltete Bubble für Conversation oder Roleplay sieht so aus:

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

### Tipp-Anzeige

Während ein Charakter an einer Antwort schreibt, zeigt das Conversation-Layout **Linear** eine Zeile „(name) is typing...“. Auch die lässt sich gestalten.

| Selektor | Worauf er wirkt |
| --- | --- |
| `[data-card-css] .mari-typing-text` | Die Beschriftung „(name) is typing...“. |
| `[data-card-css] .mari-typing-dots span` | Die animierten Punkte. |
| `[data-card-css] .mari-typing-indicator` | Die Zeile selbst. Sie trägt den Namen zusätzlich als `data-typing-name`. |

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

Der Avatar ist standardmäßig rund. Form und Ring lassen sich rein mit CSS ändern. Die Beispiele unten zielen auf die anklickbare Avatar-Schaltfläche. Stellt eine Fläche den Avatar nicht anklickbar dar, wende dieselbe Idee auf den Rückfall `.mari-message-avatar > div` dieses Layouts an. Im Roleplay steckt die Schaltfläche zusätzlich in einem `div` mit Leuchteffekt. Neutralisiere diesen Wrapper, wenn nur dein eigener Ring zu sehen sein soll.

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

### About-Me-Profil-Popout (nur Conversation)

Im Conversation Mode öffnet ein Klick auf den Avatar ein Profil-Popout (kleines Einblendfenster) mit dem „about me“ des Charakters oder der Persona. Auch das lässt sich über denselben `[data-card-css]`-Scope gestalten. Dieses Popout gibt es ausschließlich im Conversation Mode, nicht in Roleplay oder Game. Packe diese Regeln in `@chat-mode conversation`, wenn du auch CSS für Roleplay oder Game mitlieferst. Sowohl Charakterkarten als auch Personas können ihr eigenes Popout aus den **Creator Notes** heraus gestalten.

Bei Personas gibt es einen Haken: Das Bedienelement **Card Theming** erscheint nur, wenn ein aktiver Charakter im Chat CSS in seinen **Creator Notes** hat. CSS allein in der Persona bringt es nicht zum Vorschein. Damit das Popout-Theme einer Persona wirkt, braucht also mindestens ein Charakter im Chat ebenfalls einen `<style>`-Block.

| Selektor | Worauf er wirkt |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | Die Popout-Karte selbst (das Scope-Element): Hintergrund, Rahmen, Form. |
| `[data-card-css] .mari-about-me-banner` | Der Banner-Streifen oben (standardmäßig in der Namensfarbe). |
| `[data-card-css] .mari-about-me-avatar` | Der Wrapper des vergrößerten Avatars. Für den Kreis nimm `... > div`. |
| `[data-card-css] .mari-about-me-status` | Der Punkt für den Anwesenheitsstatus (nur Charaktere). |
| `[data-card-css] .mari-about-me-name` | Die Überschrift mit dem angezeigten Namen. |
| `[data-card-css] .mari-about-me-handle` | Die zweite Zeile mit @Name (erscheint, wenn der Convo-Anzeigename abweicht). |
| `[data-card-css] .mari-about-me-presence` | Die Zeile mit Status oder Aktivität (nur Charaktere). |
| `[data-card-css] .mari-about-me-box` | Der Container-Kasten von About Me. |
| `[data-card-css] .mari-about-me-label` | Die Beschriftung „ABOUT ME“. |
| `[data-card-css] .mari-about-me-badge` | Das Abzeichen **Default** bzw. **Chat-specific**. |
| `[data-card-css] .mari-about-me-text` | Der gerenderte Fließtext des About Me. |

Die Popout-Karte ist das Scope-Element. Sprich sie mit `[data-card-css].mari-about-me-popout` an (ohne Leerzeichen, dasselbe Element). Ihre Kinder erreichst du über einen Nachfahren-Selektor, etwa `[data-card-css] .mari-about-me-name`. Im Modus **Chat** ist der gesamte Bereich eingegrenzt, dort genügt `.mari-about-me-name` direkt.

Hier ein gestaltetes „about me“-Popout. Füge es in die **Creator Notes** eines Charakters oder einer Persona ein und aktiviere anschließend **Card Theming** in den **Chat Settings**. Bei einer Persona gilt der Haken von oben: Auch ein Charakter im Chat braucht CSS in seinen **Creator Notes**, sonst bleibt das Bedienelement verborgen.

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

## Was du nicht gestalten kannst

Der Sanitizer – die Sicherheitsprüfung für CSS – entfernt Folgendes.

| Blockiert | Warum |
| --- | --- |
| `url(https://...)` | Keine Netzwerkanfragen, damit weder Tracking noch Datenabfluss möglich sind. Erlaubt ist nur `url(data:...)` für eingebettete Bilder und Schriften. |
| `@font-face` mit externen URLs | Erhalten bleiben nur Schriftquellen mit `data:`. Der Familienname wird automatisch umbenannt und kann so die App-Schriften nicht überschreiben. |
| `@import` | Externe Stylesheets werden nicht geladen. |
| `:has()`-Selektoren | Damit ließen sich Elemente außerhalb des Chats ausspähen. |
| Verschachtelte Regeln und Selektoren, die mit `~` oder `+` beginnen | Werden verworfen, damit Card CSS nicht über seinen Geltungsbereich hinausgreift. Schreib sie als gewöhnliche Selektoren. |
| HTML in `content:` | Dekorativer Text ist erlaubt, aber `<` und `>` fliegen raus, und bei 200 Zeichen ist Schluss. `attr()` und `counter()` sind erlaubt. |
| `position: fixed` | Wird zu `position: absolute` umgeschrieben, damit keine bildschirmfüllenden Overlays entstehen. |
| `!important` | Wird entfernt, damit Card CSS die App-Stile nicht erzwungen überschreibt. |
| Theme-Tokens der App | Tokens wie `--primary` und `--background` fliegen raus, damit Card CSS die Oberfläche nicht umfärbt. |

Card CSS wird mit eingegrenzten Selektoren eingefügt, die die eigenen Nachrichtenstile der App überstimmen. Bei Farben, Hintergründen, Rahmen und Schriften innerhalb des Chats gewinnt es. Nicht durchsetzen kann es sich nur gegen das, was der Sanitizer entfernt, gegen alles außerhalb des Chats sowie gegen Stile, die die App inline oder mit `!important` setzt. Die globale Chat-Schriftfarbe und -größe unter **Settings** ist so ein Fall.

**Eigene Schriften.** Bette eine Schrift über eine base64-`data:`-URI ein oder greif auf System- und webtaugliche Schriften zurück.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## Exclusive im Vergleich zu Chat: den richtigen Scope wählen

- **Exclusive** lässt `[data-card-css]` für die Nachrichten dieses einen Charakters stehen. Ideal für Gruppenchats und einen eigenen Look pro Charakter. CSS, das Elemente innerhalb der Nachricht anspricht, verhält sich genau wie im Modus **Chat**.
- **Chat** lässt `[data-card-css]` für den gesamten Chatbereich stehen. Ideal für Zweier-Chats, deren Karte nicht nur die Bubbles, sondern Hintergrund und Atmosphäre gestalten soll.

Baust du mit Selektoren der Form `[data-card-css] .mari-message-...`, funktioniert deine Karte in beiden Modi korrekt.

## Tipps

1. Gestalte die Bubble über `.mari-message-bubble`, nicht über `[data-card-css]`. Letzteres ist die Zeile über die volle Breite – ein Hintergrund darauf bleibt meist unsichtbar.
2. Nimm `rgba()`-Farben, damit sie sich in hellen wie dunklen Themes einfügen.
3. Halte Animationen dezent. Auf schwächeren Geräten ist `transition` besser als aufwendige `animation`.
4. Für Handys nimm `@media (max-width: 768px)`.
5. Verlass dich nicht auf Hilfsklassen. Stabil sind nur die dokumentierten `mari-*`-Anker.

## Schaustück: Eldritch Grimoire

Diese Karte ist bewusst über die Stränge geschlagen. Sie fasst jeden dokumentierten Anker an, in jedem Modus. Zu sehen sind:

- leuchtende Namen in Runen-Versalien und thematisch passender Serifentext
- ein umgeformter Avatar mit Ring, dazu Zeitstempel in Kapitälchen
- ein Siegel am Rand der Nachrichtenzeile
- eine animierte Roleplay-Bubble mit Rune in der Ecke sowie gestaltete Erzählung
- eine Conversation-Bubble und eine unheimliche Tipp-Anzeige
- das Profil-Popout beim Avatar-Klick, komplett gestaltet
- die Spielfläche

Füge das Ganze am Stück in die **Creator Notes** ein und aktiviere dann **Card Theming** in den **Chat Settings**. Gestaltet werden die Nachrichten in Roleplay und Conversation, das Popout in Conversation und die Fläche in Game (dafür den Modus auf **Chat** stellen). Die Abschnitte sind nach `@chat-mode` getrennt, sodass jeder Modus genau die Anker bekommt, die es dort gibt. Alles ist sanitizer-fest.

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

**Eigene Zeilen im Vergleich zu Charakterzeilen.** Im Scope **Exclusive** steht `[data-card-css]` für die eigene Nachricht eines Charakters, die zugleich `.mari-message-assistant` ist. Willst du auch deine eigenen Zeilen gestalten, nimm den Scope **Chat**. Dort meint `[data-card-css]` den gesamten Bereich, und `[data-card-css] .mari-message-user` sowie `.mari-message-assistant` wählen jeweils eine Seite aus.

Tausch die Farben, das `content`-Zeichen und die Schriften aus, dann wird die Karte deine eigene.

## Card CSS von einer KI erstellen lassen

Wer CSS nicht selbst schreiben mag, gibt einer KI-Assistenz diesen Prompt – den Text, den Marinara an die KI schickt. Trag dein Charakterkonzept an der markierten Stelle ein.

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

## Verwandte Anleitungen

- [Einstellungen zur Darstellung](appearance-settings.md)
- [Eigene CSS-Themes (Theme-Bibliothek)](custom-css-themes.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
