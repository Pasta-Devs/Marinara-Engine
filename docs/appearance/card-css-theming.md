# Card CSS Theming Guide

Card CSS gives a character or persona card its own look in chat. You embed CSS in the card's **Creator Notes**, and Marinara applies it to that character's messages. It can only style the chat, never the rest of the app. This guide is for card creators.

## Before you start

Terms used in this guide:

- **CSS** controls colors, fonts, borders and spacing.
- **Card CSS** is CSS embedded in a card. It themes that card's messages.
- **Card Theming** is the per-chat control that turns Card CSS on. It is in **Chat Settings → Characters** (**Party** in Game).
- A **selector** is the part of a CSS rule that picks which elements to style. A space between two selectors means "inside", so `.a .b` matches a `.b` inside an `.a`.
- A **layout** is how messages are arranged. Conversation has **Linear** rows and **Bubbles**.

## Quick Start

Here is a starter block to paste in step 2:

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

You add CSS to the card, then turn it on in the chat.

1. Open the character in the Character Editor and find **Creator Notes**. Personas have the same field in the Persona Editor.
2. Paste the starter block into **Creator Notes** and save the card.
3. Open a chat with that character.
4. Open **Chat Settings**, then **Characters** (**Party** in Game).
5. Choose **Exclusive** or **Chat** under **Card Theming**. It starts on **Disabled**.

The character's messages change right away.

If it did not work: the **Disabled**, **Exclusive** and **Chat** buttons appear only when an active character in the chat has CSS in its **Creator Notes**. Persona CSS alone does not show them, so a persona's theme also needs one character in the chat with a `<style>` block. Check that your `<style>` block saved. In Roleplay chats, **Color Character Names in Text** is in **Characters**, below **Add Character**.

The name glows pink and the text turns soft pink in every layout. The bubble rule adds a purple gradient with a pink border. `.mari-message-bubble` exists only in the **Bubbles** layout and in roleplay, so in the default **Linear** conversation layout the bubble rule does nothing.

For a test you cannot miss, use this rule. It targets the message text, which exists in every mode and layout, and turns its background bright pink.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## How Card Theming works

When a character with CSS in **Creator Notes** is active, Marinara reads every `<style>` block, removes anything dangerous (see [What you cannot style](#what-you-cannot-style)), scopes the CSS so it can only reach the chat, and injects it so its selectors override the app's own message styling.

You pick how it applies per chat in **Chat Settings → Characters** (**Party** in Game).

| Mode | What it does |
| --- | --- |
| **Disabled** (default) | Card CSS is off. |
| **Exclusive** | Each character's CSS affects only their own messages. |
| **Chat** | All card CSS affects the whole chat area, including UI elements. |

Use **Exclusive** for group chats where each character has a look. Use **Chat** for one-on-one cards that theme the whole chat surface, such as the background.

## The scoping rule

Marinara rewrites your CSS so it can only reach the chat.

- In **Chat** mode, everything is scoped under the chat area. `[data-card-css]` means the chat area.
- In **Exclusive** mode, everything is scoped under each of your character's message elements. `[data-card-css]` means this character's message.

So use `[data-card-css]` to style the message element itself, and normal class selectors for things inside it, such as `.mari-message-bubble`, `.mari-message-content` and `.mari-message-name`. A class on the same element cannot match as a descendant. Build with `[data-card-css] .mari-message-...` and your card works in both modes.

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

In **Exclusive** scope, `[data-card-css]` is a character's own message, which is also `.mari-message-assistant`. To theme your own rows too, use **Chat** scope. There `[data-card-css] .mari-message-user` and `.mari-message-assistant` select each side.

## Target one mode with @chat-mode

Wrap rules in `@chat-mode roleplay`, `@chat-mode conversation` or `@chat-mode game` to target one surface. CSS outside any block applies everywhere. Standard `@media` queries work inside these blocks.

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

Game mode has baseline support. In **Chat** mode, card CSS reaches the whole game surface, so `[data-card-css]` themes the game area. Game has its own layout and no message bubbles, so target broadly, such as the area background. Per-character (**Exclusive**) styling of game narration is not available yet.

## What you can style

Roleplay and Conversation share the same skeleton. Stick to the `mari-*` classes and `data-*` attributes below. Other classes change between versions.

| Selector | What it targets |
| --- | --- |
| `[data-card-css]` | The whole message row (the scope element). Good for edge accents, or the chat area in **Chat** mode. |
| `[data-card-css] .mari-message-bubble` | The visible bubble: background, border, corners, shadow. In **Bubbles** and in roleplay. |
| `[data-card-css] .mari-message-content` | In **Bubbles**, the bubble element itself. In **Linear**, only the message text. |
| `[data-card-css] .mari-message-name` | The character's display name. |
| `[data-card-css] .mari-message-meta` | The header row with the name and timestamp. |
| `[data-card-css] .mari-message-timestamp` | The timestamp. |
| `[data-card-css] .mari-message-avatar` | The avatar column. |
| `[data-card-css] .mari-message-narrator` | Narrator messages (roleplay). |
| `[data-card-css] .mari-message-user` | User messages. Use `.mari-message-assistant` for character messages. |
| `[data-card-css] p`, `[data-card-css] span` | Paragraphs and inline spans inside the text. |
| `[data-grouped]` | Continuation messages from the same character. Conversation only. Use `[data-card-css]:not([data-grouped])` for the first message in a group. |

To change the layout, open **Settings → Appearance → Conversation**, then **Conversation Display**, then **Chat Layout**. In **Linear**, style `.mari-message-content` (the text) and `[data-card-css]` (the row), since there is no bubble.

A styled bubble:

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

### Typing indicator

In the Conversation **Linear** layout, a "(name) is typing..." row shows while a character writes.

| Selector | What it targets |
| --- | --- |
| `[data-card-css] .mari-typing-text` | The label. |
| `[data-card-css] .mari-typing-dots span` | The animated dots. |
| `[data-card-css] .mari-typing-indicator` | The row. It carries the name as `data-typing-name`. |

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

The avatar is a circle by default. The example targets the clickable avatar button. For a non-clickable avatar, use `.mari-message-avatar > div`. In roleplay the button sits inside an extra glow wrapper `div`. Flatten it if you want only your own ring.

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

### About Me profile popout (Conversation only)

Clicking an avatar in Conversation mode opens a profile popout with the "about me". Character cards and personas can theme their own popout. It does not exist in roleplay or game, so wrap these rules in `@chat-mode conversation` if you also ship other modes.

The popout card is the scope element. Target it with `[data-card-css].mari-about-me-popout` (no space, same element), and its children as descendants. In **Chat** mode you can use `.mari-about-me-name` directly.

| Selector | What it targets |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | The popout card: background, border, shape. |
| `[data-card-css] .mari-about-me-banner` | The top banner strip (defaults to the name color). |
| `[data-card-css] .mari-about-me-avatar` | The enlarged avatar wrapper. Use `... > div` for the circle. |
| `[data-card-css] .mari-about-me-status` | The presence status dot (characters only). |
| `[data-card-css] .mari-about-me-name` | The display name heading. |
| `[data-card-css] .mari-about-me-handle` | The secondary @name line, shown when a Convo display name differs. |
| `[data-card-css] .mari-about-me-presence` | The status or activity line (characters only). |
| `[data-card-css] .mari-about-me-box` | The About Me container box. |
| `[data-card-css] .mari-about-me-label` | The "ABOUT ME" caption. |
| `[data-card-css] .mari-about-me-badge` | The Default or Chat-specific pill. |
| `[data-card-css] .mari-about-me-text` | The about-me body text. |

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

## What you cannot style

The sanitizer strips these for security.

| Blocked | Why |
| --- | --- |
| `url(https://...)` | No network requests, to prevent tracking and data leaks. Only `url(data:...)` is allowed, for inline images and fonts. |
| `@font-face` with external URLs | Only `data:` font sources are kept. The family name is renamed so it cannot override app fonts. |
| `@import` | No loading external stylesheets. |
| `:has()` selectors | They cannot probe elements outside the chat. |
| Nested rules and selectors that start with `~` or `+` | Dropped, so card CSS cannot reach outside its scope. Write ordinary selectors. |
| HTML in `content:` | Decorative text is allowed, but `<` and `>` are stripped and the text is capped at 200 characters. `attr()` and `counter()` are allowed. |
| `position: fixed` | Rewritten to `position: absolute`, so no full-screen overlays. |
| `!important` | Stripped, so card CSS cannot force-override app styles. |
| App theme tokens | Tokens such as `--primary` and `--background` are stripped, so card CSS cannot repaint the app UI. |

Card CSS out-ranks the app's own message styles for colors, backgrounds, borders and fonts inside the chat. It cannot beat what the sanitizer strips, anything outside the chat, or styles the app applies inline or with `!important`. Your global chat font color and size in **Settings** are one example.

For a custom font, embed it with a base64 `data:` URI, or use a system font stack.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## Tips

1. Style the bubble with `.mari-message-bubble`, not `[data-card-css]`. The row is full width, so a background on it is mostly invisible.
2. Use `rgba()` colors so they blend on light and dark themes.
3. Keep animations subtle. Prefer `transition` over heavy `animation` on lower-end devices. Animate `opacity`, not `box-shadow`, which repaints every frame.
4. Use `@media (max-width: 768px)` for phones.
5. Do not depend on utility classes. Only the documented `mari-*` hooks are stable.

## Showcase: Eldritch Grimoire

This example touches the main hooks in every mode: glowing names, themed serif text, a ringed avatar, an animated roleplay bubble with a corner rune, a Conversation bubble, an eerie typing indicator and the game surface. Paste it into **Creator Notes**, then choose a Card Theming mode in **Chat Settings → Characters** (**Party** in Game). Set **Chat** for the game surface. Swap the colors, the `content` glyph and the fonts to make it your own.

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

## Use an AI assistant to create Card CSS

To avoid writing CSS by hand, give an AI assistant this prompt. Fill in your character concept where marked.

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

## Related guides

- [Appearance Settings](appearance-settings.md)
- [Custom CSS Themes (Theme Library)](custom-css-themes.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
