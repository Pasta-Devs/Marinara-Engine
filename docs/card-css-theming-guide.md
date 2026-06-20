# Card CSS Theming Guide

Give your characters a unique visual identity in chat. Embed CSS in a character's **Creator Notes** and Marinara applies it to that character's messages — safely scoped so a card can only ever style the chat, never the rest of the app.

Every selector and example below is written against the real chat DOM and has the cascade working in its favor, so they actually take effect (not just compile).

---

## Quick Start

Paste a `<style>` block into your character's **Creator Notes** field and save. Then open a chat with that character, open **Chat Settings → Card Theming**, and switch the mode on (it defaults to **Disabled** and only appears once an active character has CSS).

```html
<style>
  /* the visible message bubble (bubble style + roleplay) */
  [data-card-css] .mari-message-bubble {
    background: linear-gradient(135deg, #2a1240, #3a1030);
    border: 1px solid #ff66cc;
    border-radius: 14px;
  }
  /* the name and text (works in every message style) */
  [data-card-css] .mari-message-name {
    color: #ff8fd4;
    text-shadow: 0 0 8px rgba(255, 102, 204, 0.6);
  }
  [data-card-css] .mari-message-content {
    color: #ffd6f0;
  }
</style>
```

The character's bubble turns a purple gradient with a pink border, their name glows pink, and their text goes soft pink.

> **Sanity check:** if you want a single undeniable test, use `[data-card-css] .mari-message-bubble { background: hotpink; }` — the bubble should turn bright pink immediately.

---

## How It Works

When a character with CSS in their creator notes is active, Marinara:

1. Extracts every `<style>` block from the creator notes,
2. Sanitizes the CSS (strips anything dangerous — see [What You Cannot Style](#what-you-cannot-style)),
3. Scopes it so it can only affect the chat, and
4. Injects it into the page so its scoped selectors override the app's own message styling.

Users choose how it's applied via **Chat Settings → Card Theming** (per chat):

| Mode                   | What it does                                         |
| ---------------------- | ---------------------------------------------------- |
| **Disabled** (default) | No card CSS is applied — the character looks default |
| **Exclusive**          | Each character's CSS only affects their own messages |
| **Chat**               | All card CSS affects the entire chat area            |

**Exclusive** suits group chats where each character has its own look. **Chat** suits single-character experiences where the card themes the whole chat surface.

---

## The one scoping rule that matters

Your CSS is rewritten so it can only reach the chat. _How_ it's rewritten depends on the mode:

- **Chat mode** scopes everything under the chat area (`.mari-card-css`). `.mari-message-bubble` matches normally — it's inside the area.
- **Exclusive mode** scopes everything under _each of your character's own message elements_ (the ones carrying `data-card-css`). A class on that same element can't match it as a descendant — only things _inside_ it can.

So the portable rule:

> **Use `[data-card-css]` to style the message element itself, and normal class selectors for everything inside it** (`.mari-message-bubble`, `.mari-message-content`, `.mari-message-name`, …).

`[data-card-css]` is rewritten to "this character's message" in Exclusive and "the chat area" in Chat, so it works in both. The inner-element selectors (with a space) work the same in both modes.

```css
[data-card-css] {
  /* the message row itself — good for a left-accent border */
  border-left: 3px solid #ff66cc;
}
[data-card-css] .mari-message-bubble {
  /* the visible bubble inside it */
  border-radius: 14px;
}
```

---

## Mode-Specific CSS with `@chat-mode`

Wrap rules in `@chat-mode` blocks to target a specific surface; CSS outside any block applies everywhere.

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

Standard `@media` queries work normally inside `@chat-mode` blocks for responsive layouts.

> **Game mode** has baseline support: in **Chat** mode, card CSS reaches the whole game surface (scoped to `.mari-card-css`), so `[data-card-css] { … }` themes the game area and `@chat-mode game { … }` targets it specifically. Game uses its own layout — the message-bubble hooks above don't exist there, so target broadly (e.g. the area background). Per-character (Exclusive) scoping of game narration is a planned enhancement, not in yet.

---

## What You Can Style

The chat DOM is the same skeleton in roleplay and conversation. These are the elements card CSS can target. (Internal Tailwind utility classes are **not** documented hooks — they change between versions; stick to the `mari-*` classes and `data-*` attributes below.)

| Selector                                  | What it targets                                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `[data-card-css]`                         | The whole message **row** (the scope element) — left/edge accents, or the chat area in Chat mode               |
| `[data-card-css] .mari-message-bubble`    | The **visible bubble** — background, border, corners, shadow. _(Bubble style + roleplay.)_                     |
| `[data-card-css] .mari-message-content`   | The **message text**. In bubble style this is the bubble element itself, so it also takes background/border    |
| `[data-card-css] .mari-message-name`      | The character's display **name**                                                                               |
| `[data-card-css] .mari-message-meta`      | The header row holding the name + timestamp                                                                    |
| `[data-card-css] .mari-message-timestamp` | The timestamp                                                                                                  |
| `[data-card-css] .mari-message-avatar`    | The avatar column; `.mari-message-avatar > div` is the avatar **circle** (override `border-radius` to reshape) |
| `[data-card-css] .mari-message-narrator`  | Narrator messages (roleplay)                                                                                   |
| `[data-card-css] .mari-message-user`      | User messages — `.mari-message-assistant` for character messages                                               |
| `[data-card-css] p`, `… span`             | Paragraphs and inline spans inside the text                                                                    |
| `[data-grouped]`                          | Continuation messages from the same character — use `[data-card-css]:not([data-grouped])` for first-in-group   |

> **Bubble vs classic:** the **bubble** conversation style is what `.mari-message-bubble` targets. In the **classic** (flat) conversation style there's no bubble element — style `.mari-message-content` (text) and `[data-card-css]` (row) instead. Roleplay always has a bubble.

**Example — a styled conversation/roleplay bubble:**

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

### Typing Indicator

While a character generates a reply, conversation mode (classic message style) shows a "_(name) is typing…_" row:

| Selector                                 | What it targets                                              |
| ---------------------------------------- | ------------------------------------------------------------ |
| `[data-card-css] .mari-typing-text`      | The "(name) is typing…" label                                |
| `[data-card-css] .mari-typing-dots span` | The animated dots                                            |
| `[data-card-css] .mari-typing-indicator` | The row itself (also carries the name as `data-typing-name`) |

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

The avatar is a circle by default — reshape and ring it with pure CSS:

```css
[data-card-css] .mari-message-avatar > div {
  border-radius: 6px; /* 0 = sharp corners, 50% = back to a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
```

---

## What You Cannot Style

These are stripped by the sanitizer for security:

| Blocked                         | Why                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `url(https://…)`                | No network requests (tracking / exfiltration). Only `url(data:…)` is allowed, for inline images/fonts   |
| `@font-face` with external URLs | Only `data:` font sources are kept; the family name is auto-namespaced so it can't override app fonts   |
| `@import`                       | No loading external stylesheets                                                                         |
| `:has()` selectors              | Can't probe elements outside the chat                                                                   |
| `content:` with HTML            | Decorative text allowed, but `<`/`>` are stripped and capped at 200 chars; `attr()`/`counter()` allowed |
| `position: fixed`               | Converted to `position: absolute` (no full-screen overlays)                                             |
| `!important`                    | Stripped, so card CSS can't force-override app styles                                                   |
| App theme tokens                | `--primary`, `--background`, etc. are stripped so card CSS can't repaint the app UI                     |

Card CSS is injected with scoped selectors that out-specify the app's own message styles, so it wins for colors, backgrounds, borders, fonts, and so on within the chat. The only things it can't beat are what the sanitizer strips (above), anything outside the chat scope, and styles the app applies inline or with `!important` (for example your global chat font color/size in Settings).

**Custom fonts** — embed with base64 `data:` URIs, or use system/web-safe stacks:

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
font-family: "Courier New", Consolas, monospace;
```

---

## Exclusive vs Chat: choosing a scope

- **Exclusive** — `[data-card-css]` is _this character's messages_. Best for group chats and per-character identity. CSS targeting elements _inside_ the message works the same as in Chat.
- **Chat** — `[data-card-css]` is the _whole chat area_. Best for 1-on-1 cards that want to theme the background/atmosphere, not just message bubbles.

Build with `[data-card-css] .mari-message-…` selectors and your card works correctly in both.

---

## Tips

1. **Style the bubble with `.mari-message-bubble`, not `[data-card-css]`** — the latter is the full-width row, so a background on it is mostly invisible.
2. **Use `rgba()`** so colors blend on both light and dark themes.
3. **Keep animations subtle** — prefer `transition` over heavy `animation` on lower-end devices.
4. **Use `@media (max-width: 768px)`** for phones.
5. **Don't depend on Tailwind utility classes** — only the documented `mari-*` hooks are stable.

---

## Showcase: "Eldritch Grimoire" — the full extent

A deliberately extravagant card that uses nearly every hook: an animated glowing bubble, a runic corner sigil, a glowing uppercase name, themed serif text, a reshaped/ringed avatar, and an eerie typing indicator. Paste it whole, set the mode to **Exclusive** (or **Chat**), and watch.

```html
<style>
  /* ── animated arcane glow for the bubble ── */
  @keyframes grimoire-pulse {
    0%,
    100% {
      box-shadow:
        0 0 12px rgba(168, 85, 247, 0.35),
        inset 0 0 18px rgba(80, 0, 60, 0.5);
    }
    50% {
      box-shadow:
        0 0 24px rgba(220, 38, 120, 0.55),
        inset 0 0 26px rgba(120, 0, 80, 0.6);
    }
  }

  /* ── the visible message bubble ── */
  [data-card-css] .mari-message-bubble {
    background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
    border: 1px solid rgba(220, 38, 120, 0.45);
    border-radius: 4px 16px 16px 16px;
    animation: grimoire-pulse 4s ease-in-out infinite;
    position: relative;
    overflow: hidden;
  }

  /* a faint rune in the corner, drawn with a pseudo-element */
  [data-card-css] .mari-message-bubble::before {
    content: "✦";
    position: absolute;
    top: 1px;
    right: 7px;
    font-size: 0.7rem;
    color: rgba(220, 38, 120, 0.55);
    text-shadow: 0 0 6px rgba(220, 38, 120, 0.9);
  }

  /* ── glowing serif message text ── */
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    text-shadow: 0 0 2px rgba(168, 85, 247, 0.4);
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  /* ── the character's name — glowing crimson rune-caps ── */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.82rem;
    text-shadow:
      0 0 8px rgba(255, 92, 138, 0.7),
      0 0 16px rgba(168, 85, 247, 0.45);
  }

  /* ── reshape + ring the avatar ── */
  [data-card-css] .mari-message-avatar > div {
    border-radius: 7px;
    box-shadow:
      0 0 0 2px rgba(220, 38, 120, 0.6),
      0 0 14px rgba(168, 85, 247, 0.5);
    filter: saturate(1.2) contrast(1.05);
  }

  /* ── eerie typing indicator (conversation, classic style) ── */
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
</style>
```

Everything in it is sanitizer-safe (no external `url()`, no `!important`, no theme tokens, `position: relative`/`absolute` only). Swap the colors and the `content` glyph to make it your own.

---

## Using an AI Assistant to Create Card CSS

A prompt template if you'd rather not hand-write CSS:

> I'm creating a character card for Marinara Engine (an AI chat app). The card has a "Creator Notes" field where I can embed `<style>` blocks. Write CSS that themes the character's messages.
>
> **Character concept:** [describe the aesthetic]
>
> **Technical constraints:**
>
> - Use `[data-card-css]` for the message row (works in both "Exclusive" and "Chat" modes); use normal class selectors for things inside it.
> - `[data-card-css] .mari-message-bubble` = the visible bubble (background / border / corners / shadow); `[data-card-css] .mari-message-content` = the text; `[data-card-css] .mari-message-name` = the display name; `[data-card-css] .mari-message-avatar > div` = the avatar circle.
> - Style the typing indicator via `[data-card-css] .mari-typing-text` and `[data-card-css] .mari-typing-dots span`.
> - Wrap roleplay-only CSS in `@chat-mode roleplay { … }`, conversation-only in `@chat-mode conversation { … }`; CSS outside applies everywhere.
> - Blocked: `url(https://…)`, `@import`, `:has()`, `!important`, app theme tokens (`--primary`, etc.). `position: fixed` becomes `absolute`. Use `url(data:…)` and `rgba()` colors.
> - `[data-grouped]` marks continuation messages — use `:not([data-grouped])` for first-in-group.
>
> Output a single `<style>` block I can paste into Creator Notes.
