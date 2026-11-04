# Anleitung zum Card-CSS-Theming

Card CSS gibt einer Charakter- oder Persona-Karte im Chat ein eigenes Aussehen. Du bettest CSS in die **Creator Notes** (Notizen der Erstellerin) der Karte ein, und Marinara wendet es auf die Nachrichten dieses Charakters an. Es kann nur den Chat gestalten, nie den Rest der App. Diese Anleitung richtet sich an alle, die Karten erstellen.

## Bevor du loslegst

Begriffe, die in dieser Anleitung vorkommen:

- **CSS** steuert Farben, Schriften, Rahmen und Abstände.
- **Card CSS** ist CSS, das in einer Karte steckt. Es gestaltet die Nachrichten dieser Karte.
- **Card Theming** ist das Bedienelement pro Chat, das Card CSS einschaltet. Du findest es unter **Chat Settings → Characters** (Chat-Einstellungen → Charaktere), in Game unter **Party** (Gruppe).
- Ein **Selektor** ist der Teil einer CSS-Regel, der bestimmt, welche Elemente gestaltet werden. Ein Leerzeichen zwischen zwei Selektoren bedeutet „innerhalb“: `.a .b` trifft ein `.b`, das in einem `.a` liegt.
- Ein **Layout** bestimmt, wie Nachrichten angeordnet sind. Conversation kennt das Zeilen-Layout **Linear** und das Layout **Bubbles**.

## Schnellstart

Hier ist ein Startblock, den du in Schritt 2 einfügst:

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

Du fügst das CSS in die Karte ein und schaltest es dann im Chat ein.

1. Öffne den Charakter im Charakter-Editor und such das Feld **Creator Notes**. Personas haben dasselbe Feld im Persona-Editor.
2. Füge den Startblock in die **Creator Notes** ein und speichere die Karte.
3. Öffne einen Chat mit diesem Charakter.
4. Öffne die **Chat Settings** und dort **Characters** (in Game **Party**).
5. Wähle unter **Card Theming** **Exclusive** oder **Chat**. Anfangs steht es auf **Disabled**.

Die Nachrichten des Charakters ändern sich sofort.

Wenn es nicht funktioniert hat: Die Schaltflächen **Disabled**, **Exclusive** und **Chat** erscheinen nur, wenn ein aktiver Charakter im Chat CSS in seinen **Creator Notes** hat. Persona-CSS allein bringt sie nicht zum Vorschein. Für das Theme einer Persona braucht also auch ein Charakter im Chat einen `<style>`-Block. Prüfe, ob dein `<style>`-Block gespeichert wurde. In Roleplay-Chats liegt **Color Character Names in Text** (Charakternamen im Text einfärben) unter **Characters**, unterhalb von **Add Character** (Charakter hinzufügen).

Der Name leuchtet pink, und der Text wird in jedem Layout zart rosa. Die Bubble-Regel ergänzt einen lila Verlauf mit pinkem Rahmen. `.mari-message-bubble` gibt es nur im Layout **Bubbles** und im Roleplay. Im Standard-Layout **Linear** von Conversation bewirkt die Bubble-Regel deshalb nichts.

Für einen Test, den du nicht übersehen kannst, nimm diese Regel. Sie trifft den Nachrichtentext, den es in jedem Modus und jedem Layout gibt, und färbt seinen Hintergrund grellpink.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## So funktioniert Card Theming

Ist ein Charakter mit CSS in den **Creator Notes** aktiv, liest Marinara jeden `<style>`-Block, entfernt alles Gefährliche (siehe [Was du nicht gestalten kannst](#what-you-cannot-style)), grenzt das CSS so ein, dass es nur den Chat erreicht, und fügt es so ein, dass seine Selektoren die eigene Nachrichtengestaltung der App überstimmen.

Wie es angewendet wird, legst du pro Chat unter **Chat Settings → Characters** (in Game **Party**) fest.

| Modus | Wirkung |
| --- | --- |
| **Disabled** (Standard) | Card CSS ist aus. |
| **Exclusive** | Das CSS jedes Charakters wirkt nur auf dessen eigene Nachrichten. |
| **Chat** | Sämtliches Card CSS wirkt auf den gesamten Chatbereich, auch auf Oberflächenelemente. |

Nimm **Exclusive** für Gruppenchats, in denen jeder Charakter sein eigenes Aussehen hat. Nimm **Chat** für Karten in Einzelchats, die die gesamte Chatfläche gestalten, etwa den Hintergrund.

## Die Scope-Regel

Marinara schreibt dein CSS so um, dass es nur den Chat erreicht.

- Im Modus **Chat** wird alles auf den Chatbereich eingegrenzt. `[data-card-css]` bedeutet dort den Chatbereich.
- Im Modus **Exclusive** wird alles auf jedes Nachrichtenelement deines Charakters eingegrenzt. `[data-card-css]` bedeutet dort die Nachricht dieses Charakters.

Gestalte also das Nachrichtenelement selbst über `[data-card-css]` und alles darin mit gewöhnlichen Klassen-Selektoren wie `.mari-message-bubble`, `.mari-message-content` und `.mari-message-name`. Eine Klasse auf demselben Element kann es nicht als Nachfahre treffen. Baust du mit `[data-card-css] .mari-message-...`, funktioniert deine Karte in beiden Modi.

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

Im Scope **Exclusive** ist `[data-card-css]` die eigene Nachricht eines Charakters, die zugleich `.mari-message-assistant` ist. Willst du auch deine eigenen Zeilen gestalten, nimm den Scope **Chat**. Dort wählen `[data-card-css] .mari-message-user` und `.mari-message-assistant` jeweils eine Seite aus.

## Einen Modus mit @chat-mode ansprechen

Pack Regeln in `@chat-mode roleplay`, `@chat-mode conversation` oder `@chat-mode game`, um eine einzelne Fläche anzusprechen. CSS außerhalb solcher Blöcke gilt überall. Gewöhnliche `@media`-Abfragen funktionieren innerhalb dieser Blöcke.

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

Game Mode wird in Grundzügen unterstützt. Im Modus **Chat** erreicht Card CSS die gesamte Spielfläche; `[data-card-css]` gestaltet also den Spielbereich. Game hat ein eigenes Layout ohne Nachrichten-Bubbles. Arbeite deshalb großflächig, etwa über den Hintergrund des Bereichs. Eine Gestaltung der Spielerzählung pro Charakter (**Exclusive**) gibt es noch nicht.

## Was du gestalten kannst

Roleplay und Conversation teilen dasselbe Grundgerüst. Halte dich an die `mari-*`-Klassen und `data-*`-Attribute unten. Andere Klassen ändern sich von Version zu Version.

| Selektor | Worauf er wirkt |
| --- | --- |
| `[data-card-css]` | Die komplette Nachrichtenzeile (das Scope-Element). Gut für Akzente am Rand oder für den Chatbereich im Modus **Chat**. |
| `[data-card-css] .mari-message-bubble` | Die sichtbare Bubble: Hintergrund, Rahmen, Ecken, Schatten. In **Bubbles** und im Roleplay. |
| `[data-card-css] .mari-message-content` | In **Bubbles** das Bubble-Element selbst. In **Linear** nur der Nachrichtentext. |
| `[data-card-css] .mari-message-name` | Der angezeigte Name des Charakters. |
| `[data-card-css] .mari-message-meta` | Die Kopfzeile mit Name und Zeitstempel. |
| `[data-card-css] .mari-message-timestamp` | Der Zeitstempel. |
| `[data-card-css] .mari-message-avatar` | Die Avatar-Spalte. |
| `[data-card-css] .mari-message-narrator` | Erzähler-Nachrichten (Roleplay). |
| `[data-card-css] .mari-message-user` | Nutzernachrichten. Für Charakternachrichten nimm `.mari-message-assistant`. |
| `[data-card-css] p`, `[data-card-css] span` | Absätze und Inline-Spans im Text. |
| `[data-grouped]` | Folgenachrichten desselben Charakters. Nur in Conversation. Für die erste Nachricht einer Gruppe nimm `[data-card-css]:not([data-grouped])`. |

Um das Layout zu wechseln, öffne **Settings → Appearance → Conversation** (Einstellungen → Darstellung → Conversation), dann **Conversation Display** und dann **Chat Layout**. In **Linear** gestaltest du `.mari-message-content` (den Text) und `[data-card-css]` (die Zeile), weil es dort keine Bubble gibt.

Eine gestaltete Bubble:

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

Im Conversation-Layout **Linear** erscheint eine Zeile „(name) is typing...“, während ein Charakter schreibt.

| Selektor | Worauf er wirkt |
| --- | --- |
| `[data-card-css] .mari-typing-text` | Die Beschriftung. |
| `[data-card-css] .mari-typing-dots span` | Die animierten Punkte. |
| `[data-card-css] .mari-typing-indicator` | Die Zeile. Sie trägt den Namen als `data-typing-name`. |

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

Der Avatar ist standardmäßig rund. Das Beispiel zielt auf die anklickbare Avatar-Schaltfläche. Für einen nicht anklickbaren Avatar nimm `.mari-message-avatar > div`. Im Roleplay steckt die Schaltfläche in einem zusätzlichen `div` mit Leuchteffekt. Neutralisiere diesen Wrapper, wenn nur dein eigener Ring zu sehen sein soll.

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

### About-Me-Profil-Popout (nur Conversation)

Ein Klick auf einen Avatar öffnet im Conversation Mode ein Profil-Popout (kleines Einblendfenster) mit dem „about me“. Charakterkarten und Personas können ihr eigenes Popout gestalten. In Roleplay und Game gibt es das Popout nicht. Pack diese Regeln deshalb in `@chat-mode conversation`, wenn du auch CSS für andere Modi mitlieferst.

Die Popout-Karte ist das Scope-Element. Sprich sie mit `[data-card-css].mari-about-me-popout` an (ohne Leerzeichen, dasselbe Element) und ihre Kinder als Nachfahren. Im Modus **Chat** kannst du `.mari-about-me-name` direkt verwenden.

| Selektor | Worauf er wirkt |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | Die Popout-Karte: Hintergrund, Rahmen, Form. |
| `[data-card-css] .mari-about-me-banner` | Der Banner-Streifen oben (standardmäßig in der Namensfarbe). |
| `[data-card-css] .mari-about-me-avatar` | Der Wrapper des vergrößerten Avatars. Für den Kreis nimm `... > div`. |
| `[data-card-css] .mari-about-me-status` | Der Punkt für den Anwesenheitsstatus (nur Charaktere). |
| `[data-card-css] .mari-about-me-name` | Die Überschrift mit dem angezeigten Namen. |
| `[data-card-css] .mari-about-me-handle` | Die zweite Zeile mit @Name, die erscheint, wenn ein Convo-Anzeigename abweicht. |
| `[data-card-css] .mari-about-me-presence` | Die Zeile mit Status oder Aktivität (nur Charaktere). |
| `[data-card-css] .mari-about-me-box` | Der Container-Kasten von About Me. |
| `[data-card-css] .mari-about-me-label` | Die Beschriftung „ABOUT ME“. |
| `[data-card-css] .mari-about-me-badge` | Das Abzeichen „Default“ oder „Chat-specific“. |
| `[data-card-css] .mari-about-me-text` | Der Fließtext des About Me. |

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

## Was du nicht gestalten kannst

Der Sanitizer, der Card CSS bereinigt, entfernt aus Sicherheitsgründen Folgendes.

| Blockiert | Warum |
| --- | --- |
| `url(https://...)` | Keine Netzwerkanfragen, damit weder Tracking noch Datenabfluss möglich sind. Erlaubt ist nur `url(data:...)` für eingebettete Bilder und Schriften. |
| `@font-face` mit externen URLs | Erhalten bleiben nur Schriftquellen mit `data:`. Der Familienname wird umbenannt und kann so die App-Schriften nicht überschreiben. |
| `@import` | Externe Stylesheets werden nicht geladen. |
| `:has()`-Selektoren | So können sie keine Elemente außerhalb des Chats ausspähen. |
| Verschachtelte Regeln und Selektoren, die mit `~` oder `+` beginnen | Werden verworfen, damit Card CSS nicht über seinen Geltungsbereich hinausgreift. Schreib gewöhnliche Selektoren. |
| HTML in `content:` | Dekorativer Text ist erlaubt, aber `<` und `>` werden entfernt, und der Text ist auf 200 Zeichen begrenzt. `attr()` und `counter()` sind erlaubt. |
| `position: fixed` | Wird zu `position: absolute` umgeschrieben, damit keine bildschirmfüllenden Overlays entstehen. |
| `!important` | Wird entfernt, damit Card CSS die App-Stile nicht erzwungen überschreibt. |
| Theme-Tokens der App | Tokens wie `--primary` und `--background` werden entfernt, damit Card CSS die Oberfläche der App nicht umfärbt. |

Card CSS überstimmt bei Farben, Hintergründen, Rahmen und Schriften innerhalb des Chats die eigenen Nachrichtenstile der App. Nicht durchsetzen kann es sich gegen das, was der Sanitizer entfernt, gegen alles außerhalb des Chats sowie gegen Stile, die die App inline oder mit `!important` setzt. Deine globale Chat-Schriftfarbe und -größe unter **Settings** sind ein Beispiel dafür.

Für eine eigene Schrift bettest du sie über eine base64-`data:`-URI ein, oder du greifst auf eine Reihe von Systemschriften zurück.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## Tipps

1. Gestalte die Bubble über `.mari-message-bubble`, nicht über `[data-card-css]`. Die Zeile reicht über die volle Breite, ein Hintergrund darauf bleibt deshalb meist unsichtbar.
2. Nimm `rgba()`-Farben, damit sie sich in hellen wie dunklen Themes einfügen.
3. Halte Animationen dezent. Auf schwächeren Geräten ist `transition` besser als aufwendige `animation`. Animiere `opacity`, nicht `box-shadow`, das in jedem Frame neu gezeichnet wird.
4. Für Handys nimm `@media (max-width: 768px)`.
5. Verlass dich nicht auf Hilfsklassen. Stabil sind nur die dokumentierten `mari-*`-Anker.

## Schaustück: Eldritch Grimoire

Dieses Beispiel nutzt die wichtigsten Anker in jedem Modus: leuchtende Namen, thematisch passenden Serifentext, einen Avatar mit Ring, eine animierte Roleplay-Bubble mit Rune in der Ecke, eine Conversation-Bubble, eine unheimliche Tipp-Anzeige und die Spielfläche. Füge es in die **Creator Notes** ein und wähle dann einen Modus für Card Theming unter **Chat Settings → Characters** (in Game **Party**). Für die Spielfläche stellst du **Chat** ein. Tausch die Farben, das `content`-Zeichen und die Schriften aus, dann wird es dein eigenes.

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

## Card CSS von einer KI erstellen lassen

Wenn du CSS nicht von Hand schreiben willst, gib einer KI-Assistenz diesen Prompt. Trag an der markierten Stelle dein Charakterkonzept ein.

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

- [Darstellungseinstellungen](appearance-settings.md)
- [Eigene CSS-Themes (Theme Library)](custom-css-themes.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
