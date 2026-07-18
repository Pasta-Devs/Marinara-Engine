# Card CSS Theming Guide

This guide shows character and persona creators how to give a card its own look in chat. You embed CSS in the card's Creator Notes, and Guksu Motor applies it safely to that character's messages. It can only ever style the chat, never the rest of the app.

## Before you start

A few plain definitions used throughout this guide:

- **CSS** is the language that controls colors, fonts, borders, and spacing on a web page.
- **Card CSS** is CSS you embed in a character or persona card. It themes that card's messages.
- **Card Theming** is the on-screen control that turns Card CSS on for a chat.
- A **selector** is the part of a CSS rule that picks which elements to style.
- A **descendant selector** uses a space to mean "inside". `.a .b` matches a `.b` that sits inside an `.a`.
- The **cascade** is the CSS system that decides which rule wins when several rules apply to the same element.
- A **layout** is how messages are arranged on screen. Guksu has a **Linear** row layout and a **Bubbles** layout.

## Quick Start

You theme a card in two places. First you add CSS to the card. Then you turn it on in the chat.

1. Open the character in the Character Editor and find the **Creator Notes** field. Personas have the same field in the Persona Editor.
2. Paste a `<style>` block into **Creator Notes** and save the card.
3. Open a chat with that character.
4. Open **Chat Settings**, then the **Card Theming** section.
5. Choose **Exclusive** or **Chat**. The mode starts on **Disabled**.

You should see the character's messages change right away. The **Card Theming** control only appears once an active character in that chat has CSS in its **Creator Notes**. Persona CSS alone does not make the control appear. At least one character in the chat must carry its own `<style>` block. If you do not see the control, check that your `<style>` block saved correctly.

Here is a starter block to paste into **Creator Notes**:

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

The character's name glows pink and their text goes soft pink in every layout. The bubble rule adds a purple gradient with a pink border. One caveat: `.mari-message-bubble` only exists in the **Bubbles** layout and in roleplay. The default Conversation layout is **Linear**, which has no bubble element, so the bubble rule does nothing there. The "Bubbles compared with Linear" note below explains the difference.

**Sanity check:** for one undeniable test, use the rule below. It targets the message text, which exists in every mode and layout. The text background should turn bright pink at once.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## How Card Theming works

When a character with CSS in their **Creator Notes** is active, Guksu does four things:

1. It reads every `<style>` block from the **Creator Notes**.
2. It sanitizes the CSS and strips anything dangerous. See the "What you cannot style" section below.
3. It scopes the CSS so it can only reach the chat.
4. It injects the CSS so its scoped selectors override the app's own message styling.

You pick how it is applied per chat in **Chat Settings**, then **Card Theming**. There are three modes.

| Mode | What it does |
| --- | --- |
| **Disabled** (default) | Card CSS is off, so no character styling is applied. |
| **Exclusive** | Each character's CSS only affects their own messages. |
| **Chat** | All card CSS affects the entire chat area, including UI elements. |

Use **Exclusive** for group chats where each character has its own look. Use **Chat** for single-character chats where you want the card to theme the whole chat surface.

## The one scoping rule that matters

Guksu rewrites your CSS so it can only reach the chat. How it rewrites it depends on the mode.

- **Chat** mode scopes everything under the chat area. `.mari-message-bubble` matches normally, because it sits inside the area.
- **Exclusive** mode scopes everything under each of your character's own message elements. Those carry `data-card-css`. A class on that same element cannot match it as a descendant. Only things inside it can.

So here is the portable rule. Use `[data-card-css]` to style the message element itself. Use normal class selectors for everything inside it, like `.mari-message-bubble`, `.mari-message-content`, and `.mari-message-name`.

`[data-card-css]` means "this character's message" in **Exclusive** mode and "the chat area" in **Chat** mode. It works in both. The inner-element selectors (the ones with a space) work the same in both modes.

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

## Targeting a mode with @chat-mode

Wrap rules in `@chat-mode` blocks to target one surface. CSS outside any block applies everywhere.

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

Standard `@media` queries work normally inside `@chat-mode` blocks. Use them for responsive layouts.

**Game mode** has baseline support. In **Chat** mode, card CSS reaches the whole game surface. So `[data-card-css]` themes the game area, and `@chat-mode game` targets it. Game uses its own layout. The message-bubble hooks above do not exist there, so target broadly, for example the area background. Per-character (Exclusive) styling of game narration is not available yet.

## What you can style

The chat structure is the same skeleton in Roleplay and Conversation. These are the elements card CSS can target. Internal utility classes are not stable hooks. They change between versions, so stick to the `mari-*` classes and `data-*` attributes below.

| Selector | What it targets |
| --- | --- |
| `[data-card-css]` | The whole message row (the scope element). Good for left or edge accents, or the chat area in **Chat** mode. |
| `[data-card-css] .mari-message-bubble` | The visible bubble: background, border, corners, shadow. Present in the **Bubbles** layout and in roleplay. |
| `[data-card-css] .mari-message-content` | In **Bubbles**, the bubble element itself, including background, border, and corners. In **Linear**, only the message text. |
| `[data-card-css] .mari-message-name` | The character's display name. |
| `[data-card-css] .mari-message-meta` | The header row that holds the name and timestamp. |
| `[data-card-css] .mari-message-timestamp` | The timestamp. |
| `[data-card-css] .mari-message-avatar` | The avatar column. |
| `[data-card-css] .mari-message-narrator` | Narrator messages (roleplay). |
| `[data-card-css] .mari-message-user` | User messages. Use `.mari-message-assistant` for character messages. |
| `[data-card-css] p`, `... span` | Paragraphs and inline spans inside the text. |
| `[data-grouped]` | Continuation messages from the same character. Conversation mode only; roleplay rows never carry it. Use `[data-card-css]:not([data-grouped])` for the first message in a group. |

**Bubbles compared with Linear.** The **Bubbles** layout is what `.mari-message-bubble` targets. The **Linear** layout has no bubble element, so style `.mari-message-content` (the text) and `[data-card-css]` (the row) instead. Change the layout in **Settings**, then **Appearance**, then the **Conversation Display** section, then **Chat Layout**. Roleplay always has a bubble.

Here is a styled conversation or roleplay bubble:

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

While a character writes a reply, the Conversation **Linear** layout shows a "(name) is typing..." row. You can style it.

| Selector | What it targets |
| --- | --- |
| `[data-card-css] .mari-typing-text` | The "(name) is typing..." label. |
| `[data-card-css] .mari-typing-dots span` | The animated dots. |
| `[data-card-css] .mari-typing-indicator` | The row itself. It also carries the name as `data-typing-name`. |

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

The avatar is a circle by default. You can reshape and ring it with pure CSS. The examples below target the clickable avatar button. If a surface renders the avatar as non-clickable, use the same idea on the `.mari-message-avatar > div` fallback for that layout. In roleplay the button sits inside an extra glow-wrapper `div`. Flatten that wrapper if you want only your own ring.

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

### About Me profile popout (Conversation only)

In Conversation mode, clicking an avatar opens a profile popout with the character's or persona's "about me". You can theme it with the same `[data-card-css]` scope. This popout only exists in Conversation mode. It does not exist in roleplay or game. Wrap these rules in `@chat-mode conversation` if you also ship roleplay or game CSS. Both character cards and personas can theme their own popout from their **Creator Notes**.

One caveat for personas: the **Card Theming** control only appears when an active character in the chat has CSS in its **Creator Notes**. Persona-only CSS does not make the control appear. So for a persona's popout theme to work, at least one character in the chat must also carry a `<style>` block.

| Selector | What it targets |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | The popout card itself (the scope element): background, border, shape. |
| `[data-card-css] .mari-about-me-banner` | The top banner strip (defaults to the name color). |
| `[data-card-css] .mari-about-me-avatar` | The enlarged avatar wrapper. Use `... > div` for the circle. |
| `[data-card-css] .mari-about-me-status` | The presence status dot (characters only). |
| `[data-card-css] .mari-about-me-name` | The display name heading. |
| `[data-card-css] .mari-about-me-handle` | The secondary @name line (shown when a Convo display name differs). |
| `[data-card-css] .mari-about-me-presence` | The status or activity line (characters only). |
| `[data-card-css] .mari-about-me-box` | The About Me container box. |
| `[data-card-css] .mari-about-me-label` | The "ABOUT ME" caption. |
| `[data-card-css] .mari-about-me-badge` | The Default or Chat-specific pill. |
| `[data-card-css] .mari-about-me-text` | The rendered about-me body text. |

The popout card is the scope element. Target it with `[data-card-css].mari-about-me-popout` (no space, same element). Target its children with a descendant selector, like `[data-card-css] .mari-about-me-name`. In **Chat** mode the whole area is scoped, so you can use `.mari-about-me-name` directly.

Here is a themed "about me" popout. Paste it into a character's or persona's **Creator Notes**, then enable **Card Theming** in **Chat Settings**. If you paste it into a persona, remember the caveat above. A character in the chat must also have CSS in its **Creator Notes**, or the control stays hidden.

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

## What you cannot style

The sanitizer strips these for security.

| Blocked | Why |
| --- | --- |
| `url(https://...)` | No network requests, to prevent tracking and data leaks. Only `url(data:...)` is allowed, for inline images and fonts. |
| `@font-face` with external URLs | Only `data:` font sources are kept. The family name is auto-renamed so it cannot override app fonts. |
| `@import` | No loading external stylesheets. |
| `:has()` selectors | Cannot probe elements outside the chat. |
| HTML in `content:` | Decorative text is allowed, but `<` and `>` are stripped and the text is capped at 200 characters. `attr()` and `counter()` are allowed. |
| `position: fixed` | Rewritten to `position: absolute`, so no full-screen overlays. |
| `!important` | Stripped, so card CSS cannot force-override app styles. |
| App theme tokens | Tokens like `--primary` and `--background` are stripped, so card CSS cannot repaint the app UI. |

Card CSS is injected with scoped selectors that out-rank the app's own message styles. It wins for colors, backgrounds, borders, and fonts inside the chat. The only things it cannot beat are what the sanitizer strips, anything outside the chat, and styles the app applies inline or with `!important`. Your global chat font color and size in **Settings** are one such example.

**Custom fonts.** Embed a font with a base64 `data:` URI, or use a system or web-safe stack.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## Exclusive compared with Chat: choosing a scope

- **Exclusive** makes `[data-card-css]` mean this character's messages. It is best for group chats and per-character identity. CSS that targets elements inside the message works the same as in **Chat** mode.
- **Chat** makes `[data-card-css]` mean the whole chat area. It is best for one-on-one cards that want to theme the background or atmosphere, not just message bubbles.

Build with `[data-card-css] .mari-message-...` selectors, and your card works correctly in both modes.

## Tips

1. Style the bubble with `.mari-message-bubble`, not `[data-card-css]`. The latter is the full-width row, so a background on it is mostly invisible.
2. Use `rgba()` colors so they blend on both light and dark themes.
3. Keep animations subtle. Prefer `transition` over heavy `animation` on lower-end devices.
4. Use `@media (max-width: 768px)` for phones.
5. Do not depend on utility classes. Only the documented `mari-*` hooks are stable.

## Showcase: Eldritch Grimoire

This is a deliberately extravagant card. It touches every documented hook, in every mode. It demonstrates:

- glowing rune-caps names and themed serif text
- a reshaped and ringed avatar, plus small-caps timestamps
- an edge sigil on the message row
- an animated roleplay bubble with a corner rune, and styled narration
- a Conversation bubble and an eerie typing indicator
- the avatar-click profile popout, fully themed
- the game surface

Paste it whole into **Creator Notes**, then enable **Card Theming** in **Chat Settings**. It themes messages across Roleplay and Conversation, the popout in Conversation, and the surface in Game (set the mode to **Chat** for game). Sections are split by `@chat-mode` so each mode gets exactly the hooks it has. Everything is sanitizer-safe.

```html
<style>
  /* shared keyframe */
  @keyframes grimoire-pulse {
    0%,
    100% {
      box-shadow: 0 0 12px rgba(168, 85, 247, 0.35), inset 0 0 18px rgba(80, 0, 60, 0.5);
    }
    50% {
      box-shadow: 0 0 24px rgba(220, 38, 120, 0.55), inset 0 0 26px rgba(120, 0, 80, 0.6);
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
      animation: grimoire-pulse 4s ease-in-out infinite;
      position: relative;
      overflow: hidden;
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

**User rows compared with character rows.** In **Exclusive** scope, `[data-card-css]` is a character's own message, which is also `.mari-message-assistant`. To theme your own rows too, use **Chat** scope. There `[data-card-css]` is the whole area, and `[data-card-css] .mari-message-user` and `.mari-message-assistant` select each side.

Swap the colors, the `content` glyph, and the fonts to make it your own.

## Using an AI assistant to create Card CSS

If you would rather not hand-write CSS, give an AI assistant this prompt. Fill in your character concept where marked.

```text
I'm creating a character card for Guksu Motor (an AI chat app). The card has a
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
