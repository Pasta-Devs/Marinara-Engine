# Card CSS Theming Guide

Give your characters a unique visual identity across Marinara's chat modes. This guide covers how to embed custom CSS in your character cards so they look and feel exactly the way you want.

---

## Quick Start

Paste a `<style>` block into your character's **Creator Notes** field (in the character editor, under Advanced). That's it — Marinara extracts and applies the CSS automatically.

```html
<style>
[data-card-css] {
  border-left: 3px solid #ff69b4;
  background: linear-gradient(90deg, rgba(255, 105, 180, 0.05) 0%, transparent 40%);
}
</style>
```

This gives your character a pink accent border on their messages.

---

## How It Works

When a character with CSS in their creator notes is active in a chat, Marinara:

1. Extracts all `<style>` blocks from the creator notes
2. Sanitizes the CSS (strips anything dangerous)
3. Scopes it to the chat area so it can't affect the rest of the app
4. Injects it into the page

Users control how the CSS is applied via **Chat Settings > Card Theming**:

| Mode | What it does |
|------|-------------|
| **Disabled** | No card CSS is applied — the character looks default |
| **Exclusive** | Each character's CSS only affects their own messages |
| **Chat** | All card CSS affects the entire chat area |

**Exclusive** is ideal for group chats where multiple characters each have their own visual style. **Chat** is better for single-character experiences where the card wants to theme the entire chat surface.

---

## Mode-Specific CSS with `@chat-mode`

Different chat modes render content differently. Use `@chat-mode` blocks to target specific surfaces:

```html
<style>
/* This applies to ALL modes */
.g-box {
  border: 1px solid #0f0;
  background: #000;
}

/* Only in Roleplay mode */
@chat-mode roleplay {
  .camera-view {
    border: 2px solid rgba(0, 255, 0, 0.3);
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.4);
  }
}

/* Only in Conversation mode */
@chat-mode conversation {
  [data-card-css] {
    border-left: 2px solid #00FF00;
    border-radius: 1rem;
    padding: 0.75rem;
    background: rgba(0, 30, 0, 0.8);
  }
}

/* Only in Game mode */
@chat-mode game {
  [data-card-css] {
    border: 1px solid rgba(0, 255, 0, 0.2);
  }
}
</style>
```

CSS outside any `@chat-mode` block applies everywhere. Standard `@media` queries work normally inside `@chat-mode` blocks for responsive layouts.

---

## What You Can Style

### Roleplay Mode

Roleplay mode renders full HTML in messages, so you have the most creative freedom here. Your regex scripts can transform plain text into styled HTML, and your CSS styles it.

**Targetable elements:**

| Selector | What it targets |
|----------|----------------|
| `[data-card-css]` | The message wrapper (targets this character's messages in Exclusive mode, or the chat area in Chat mode) |
| `:root` or `body` | Same as `[data-card-css]` — rewritten to the scope automatically |
| Any custom class | Classes your regex scripts inject into message HTML (e.g., `.camera-view`, `.terminal-window`) |
| `.mari-message` | A message container |
| `.mari-message-narrator` | Narrator messages |
| `.mari-message-assistant` | Character messages |
| `.mari-message-user` | User messages |
| `[data-grouped]` | Present on consecutive messages from the same character (grouped/continuation messages) |

**What works well in RP mode:**
- Full HTML structures injected via regex scripts (camera overlays, terminal windows, custom layouts)
- CSS animations (`@keyframes`, transitions)
- Pseudo-elements (`::before`, `::after`) for decorative effects
- Custom backgrounds, borders, shadows, gradients
- Custom fonts via `font-family` (system/web-safe fonts, or embedded `@font-face` with font `data:` URIs; external font URLs are blocked for security)

### Conversation Mode

Conversation mode renders messages as plain text with markdown — it does not render HTML from regex scripts. CSS theming here focuses on styling the existing message elements.

**Targetable elements:**

| Selector | What it targets |
|----------|----------------|
| `[data-card-css]` | The message wrapper div — your main styling target |
| `[data-card-css] .mari-message-body` | The message "bubble" container — background, border, corners, shadows |
| `[data-card-css] .mari-message-meta` | The header row that holds the name + timestamp |
| `[data-card-css] .mari-message-name` | The character's display name |
| `[data-card-css] .mari-message-timestamp` | The message timestamp |
| `[data-card-css] .mari-message-content` | The container around the message text |
| `[data-card-css] .mari-message-avatar` | The avatar column; `.mari-message-avatar > div` is the avatar circle (override `border-radius` to reshape it) |
| `[data-card-css] p` | Paragraph elements in the message text |
| `[data-card-css] span` | Inline text spans |
| `[data-card-css] .mari-typing-indicator` | The "(name) is typing…" indicator (see **Typing Indicator** below) |
| `[data-grouped]` | Present on consecutive messages from the same character — use `[data-card-css]:not([data-grouped])` for first-in-group styling |

**What works well in Convo mode:**
- Message bubbles (border-radius, background, padding, shadows)
- Custom text colors and fonts
- Accent borders (left/top/bottom borders as visual markers)
- Name styling (color, glow via text-shadow, font changes)
- Hover effects on the message wrapper
- Gradient backgrounds

**Example — message bubble:**
```css
@chat-mode conversation {
  [data-card-css] {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid rgba(100, 149, 237, 0.3);
    border-radius: 1rem;
    padding: 0.75rem 1rem;
    margin: 0.25rem 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  [data-card-css] .mari-message-name {
    color: #6495ED;
    text-shadow: 0 0 8px rgba(100, 149, 237, 0.5);
  }

  [data-card-css] p {
    color: #e0e0ff;
    font-family: Georgia, serif;
  }
}
```

#### Typing Indicator

While a character is generating a reply, Marinara shows a "*(name) is typing…*" indicator, and it's fully themeable. If the message it belongs to already has a bubble on screen (for example, during **regeneration**), the indicator renders **inside that bubble**; otherwise it appears as a **standalone row** below the messages. Both expose the same hooks:

| Selector | What it targets |
|----------|----------------|
| `[data-card-css] .mari-typing-indicator` | The indicator row / container |
| `[data-card-css] .mari-typing-dots` | The animated dots wrapper — style the individual dots with `.mari-typing-dots span` |
| `[data-card-css] .mari-typing-text` | The "(name) is typing…" label |

The character's name is also exposed on the indicator as a `data-typing-name` attribute, so you can compose your own label with `content: attr(data-typing-name)`.

> **Scoping note:** on the *standalone* row, `data-card-css` sits **on** the `.mari-typing-indicator` element itself. Target the row with **no space** (`[data-card-css].mari-typing-indicator`) and its children **with a space** (`[data-card-css] .mari-typing-text`). The descendant selectors also match the in-bubble version.

```css
@chat-mode conversation {
  /* Recolor / restyle the default label and dots */
  [data-card-css] .mari-typing-text { color: #c77b92; font-style: italic; font-family: 'Courier New', monospace; }
  [data-card-css] .mari-typing-dots span { background: #e3a8bd; }

  /* OR replace the label text entirely (including the character's name) */
  [data-card-css] .mari-typing-text { display: none; }
  [data-card-css].mari-typing-indicator::after {
    content: attr(data-typing-name) " is cooking up a reply…";
    font-style: italic;
    color: #c77b92;
  }
}
```

> **Group chats (Exclusive mode):** when several characters generate at once, the standalone
> indicator normally combines their names into one row (e.g. *"Aria, Bryn are typing…"*), which
> a single character's CSS can't meaningfully restyle. In **Exclusive** card-CSS mode, any
> character whose CSS targets these hooks (`.mari-typing-*` or `data-typing-name`) is instead
> given **its own row**, sorted alphabetically, so each custom label renders in isolation;
> characters without typing CSS stay grouped in the shared row above them. This split only
> applies in Exclusive mode — Chat mode scopes all card CSS to the shared `.mari-card-css`, so a
> typing rule there would affect every row identically.

#### Avatar

The avatar is a 40px circle by default — but `border-radius` (and the rest) is yours to override:

```css
@chat-mode conversation {
  [data-card-css] .mari-message-avatar > div {
    border-radius: 8px;            /* square it off — 0 = sharp corners, 50% = back to a circle */
    box-shadow: 0 0 0 3px #fff;    /* white "sticker" border */
    transform: scale(1.2);         /* enlarge slightly */
  }
}
```

You can also **swap the avatar image itself**, per character, without any CSS: the editor's **Colors** tab has a **Conversation Avatar** control to set it to an emoji, one of the character's **sprites**, a **gallery** image, or **hide** it entirely (Conversation mode only — Roleplay is unaffected). This pairs nicely with the CSS above — e.g. choose a gallery image, then square it off and add a sticker border. (Sprite/Gallery require a saved character with assets already uploaded; Emoji works any time. The chosen image is center-cropped to the circle/square, so pick a roughly square source for the cleanest result.)

#### Editing & multi-paragraph messages

- **While a message is being edited, its card CSS is turned off** so the edit box uses the app's plain style. You don't need to design for the editing state — only the normal display.
- **A multi-paragraph reply renders as a single `.mari-message-body`**, not several stacked bubbles — so your borders, corners, and `::after` stickers wrap the whole reply cleanly. Use `[data-card-css]:not([data-grouped])` for the first message in a run and `[data-grouped]` for continuations.

### Game Mode

Game mode is primarily GM/narrator-driven. Currently, card CSS applies to log entries that are attributed to specific characters via `data-card-css`. The active narration/dialogue segments do not yet carry character-specific CSS attributes — this may be added in a future update.

**What works in Game mode:**
- Styling log entries attributed to the character
- Terminal/info-box styled blocks (if used with shared-base CSS)
- Background and text color changes on attributed narration

---

## What You Cannot Style

These are blocked by the CSS sanitizer for security:

| Blocked | Why |
|---------|-----|
| `url(https://...)` | Prevents network requests that could track users or exfiltrate data. Only `url(data:...)` is allowed for inline images and embedded fonts. |
| `@font-face` with external URLs | `@font-face` blocks that reference external URLs are stripped. Blocks using only `data:` URIs (base64-embedded fonts) are allowed; the embedded family name is automatically namespaced (e.g. `Inter` → an internal `mc-font-*` name) so it can't override fonts used elsewhere in the app, and your own `font-family` references are rewritten to match. Only font `data:` URIs — `font/*`, `application/font*`, `application/x-font*` — are valid as `@font-face` sources. (The wider `url(data:...)` allowlist that also permits `image/*` applies to general `url()` usage, not font sources.) |
| `@import` | Prevents loading external stylesheets |
| `:has()` selectors | Prevents probing elements outside the chat area |
| `content: "text"` with HTML | `content` text is allowed for decorative labels (e.g., window titles in themed cards) but `<` and `>` characters are stripped and text is capped at 200 characters to prevent UI spoofing. CSS functions such as `attr()` and `counter()` are also permitted (e.g. `content: attr(data-typing-name)`). |
| `position: fixed` | Automatically converted to `position: absolute` to prevent full-screen overlays |
| `!important` | Stripped to prevent overriding the app's own styles |
| App theme tokens | Declarations like `--background: red` or `--primary: blue` are stripped so card CSS can't repaint the app UI |

**Custom fonts:** You can embed fonts directly in your card CSS using base64-encoded `@font-face` blocks with `data:` URIs. External font URLs (like Google Fonts) are blocked for security. You can also use system fonts or web-safe font stacks:
```css
/* Embedded font (base64) — works */
@font-face {
  font-family: 'MyPixelFont';
  src: url(data:font/woff2;base64,d09GMgABAAAAA...) format('woff2');
}

/* System / web-safe fonts — always works */
font-family: 'Courier New', Consolas, monospace;
font-family: Georgia, 'Times New Roman', serif;
font-family: 'Segoe UI', system-ui, sans-serif;
```

---

## Exclusive vs Chat Mode: Choosing the Right Scope

**Use Exclusive when:**
- You're making a card that might be used in group chats
- You want each character's visual identity to be independent
- Your CSS targets `[data-card-css]` (the message wrapper)

**Use Chat when:**
- Your card is designed for 1-on-1 roleplay
- You want to theme the entire chat background/atmosphere
- Your CSS targets elements beyond individual messages (e.g., the chat area itself)

In Exclusive mode, `[data-card-css]` targets only THIS character's message wrappers. In Chat mode, it targets the entire `.mari-card-css` container (the whole chat area). Both `:root` and `body` selectors are also rewritten to match the scope, so they work the same way as `[data-card-css]`.

---

## Tips for Card Creators

1. **Start with Exclusive mode in mind.** Use `[data-card-css]` as your root selector — it works correctly in both Exclusive and Chat modes.

2. **Use `@chat-mode` blocks.** Don't assume your card will only be used in RP. Even a simple convo-mode section with accent colors makes the character feel alive in every surface.

3. **Test in both light and dark themes.** Use `rgba()` colors with transparency so they blend with whatever background the user has.

4. **Keep animations subtle.** Heavy animations can slow down the chat on lower-end devices. Use `animation` sparingly and prefer `transition` for interactive effects.

5. **Don't rely on specific class names for message content.** The internal class names (like Tailwind utility classes) can change between Marinara versions. Stick to the documented selectors: `[data-card-css]`, `.mari-message-name`, `.mari-message`, `p`, `span`.

6. **Use `@media` for mobile.** Many users chat on phones or small windows:
   ```css
   @media (max-width: 768px) {
     [data-card-css] {
       padding: 0.5rem;
       border-radius: 0.5rem;
     }
   }
   ```

7. **Layer your mode CSS.** Put shared styles (keyframes, base classes) outside `@chat-mode` blocks, and mode-specific styling inside them. This avoids duplicating rules.

8. **Theme the "typing…" state.** Style `.mari-typing-text` and `.mari-typing-dots span` so the "(name) is typing…" indicator matches your card — or replace the label entirely with `content: attr(data-typing-name) "…"`. It shows both in-bubble (during regeneration) and as a standalone row, so a little styling here goes a long way.

9. **Reshape the avatar.** The avatar circle is just an overridable `border-radius` on `.mari-message-avatar > div`. Pair it with the per-character **Conversation Avatar** setting (emoji / sprite / gallery / hide) in the editor's Colors tab for a fully custom look.

---

## Using an AI Assistant to Create Card CSS

If you're not comfortable writing CSS by hand, you can ask an AI assistant to generate it for you. Here's a prompt template:

---

> I'm creating a character card for Marinara Engine (a Tauri-based AI chat app). The card has a "creator notes" field where I can embed `<style>` blocks with custom CSS. I need CSS that themes the character's messages.
>
> **Character concept:** [describe your character's aesthetic — e.g., "cyberpunk hacker with neon green terminal vibes" or "soft cottagecore fairy with pink pastels"]
>
> **Technical constraints:**
> - Use `[data-card-css]` as the selector for the message wrapper element
> - Use `[data-card-css] .mari-message-body` for the message bubble (background / border / corners) and `[data-card-css] .mari-message-content` for the text area
> - Use `[data-card-css] .mari-message-name` for the character's display name
> - Use `[data-card-css] .mari-message-avatar > div` for the avatar circle (override `border-radius` to reshape it)
> - Use `[data-card-css] p` for message text paragraphs
> - Style the "typing…" indicator via `[data-card-css] .mari-typing-text` and `[data-card-css] .mari-typing-dots span` (the character name is available as `attr(data-typing-name)` for custom label text)
> - Wrap roleplay-only CSS in `@chat-mode roleplay { ... }`
> - Wrap conversation-only CSS in `@chat-mode conversation { ... }`
> - CSS outside these blocks applies to all modes
> - `url(https://...)` is blocked — only `url(data:...)` works for inline images and embedded fonts
> - `@font-face` with external URLs is blocked — use base64-embedded `data:` URIs or system/web-safe fonts
> - `content: "text"` is allowed for decorative labels but `<>` chars are stripped and text is capped at 200 chars
> - `[data-grouped]` is present on continuation messages from the same character — use `:not([data-grouped])` to target first-in-group
> - `position: fixed` is converted to `position: absolute`
> - `!important` is stripped
> - `:has()` selectors are blocked
> - Use `rgba()` colors so they work on both light and dark backgrounds
>
> **For conversation mode**, create a styled message bubble with:
> - Custom background color/gradient
> - Rounded corners
> - Accent border
> - Styled character name (color + optional text-shadow glow)
> - Custom font for message text
>
> **For roleplay mode**, [describe what you want — e.g., "create a camera surveillance overlay with scanlines" or "just use the same bubble style as conversation"]
>
> Please output a single `<style>` block I can paste into the creator notes field.

---

Adjust the character concept and roleplay description to match your vision. The AI should produce a working `<style>` block you can paste directly into the Creator Notes field.

**After generating:**
1. Paste the CSS into Creator Notes
2. Create a chat with the character
3. Open Chat Settings > Card Theming
4. Set mode to Exclusive
5. Send a test message and check the styling
6. Try switching between Exclusive and Chat to see the difference
7. Test in both RP and Convo modes if you used `@chat-mode` blocks

---

## Example: Complete Multi-Mode Card CSS

Here's a full example for a cyberpunk character that looks different in each mode:

```html
<style>
/* Shared animations */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(0, 255, 0, 0.2); }
  50% { box-shadow: 0 0 16px rgba(0, 255, 0, 0.4); }
}

/* Roleplay: full immersive theming */
@chat-mode roleplay {
  body { color: #0f0; }
  .terminal-window {
    background: #1a1a1a;
    border: 1px solid #0f0;
    border-radius: 8px;
    animation: glow-pulse 3s ease-in-out infinite;
  }
}

/* Conversation: clean message bubbles */
@chat-mode conversation {
  [data-card-css] {
    background: linear-gradient(135deg, rgba(0, 30, 0, 0.85), rgba(0, 15, 0, 0.7));
    border: 1px solid rgba(0, 255, 0, 0.3);
    border-radius: 1rem;
    padding: 0.75rem 1rem;
    margin: 0.25rem 0;
  }
  [data-card-css] .mari-message-name {
    color: #00FF00;
    text-shadow: 0 0 8px rgba(0, 255, 0, 0.6);
    font-family: 'Courier New', monospace;
  }
  [data-card-css] p {
    font-family: 'Courier New', monospace;
    color: #c0ffc0;
  }
  [data-card-css]:hover {
    border-color: rgba(0, 255, 0, 0.5);
  }
}

/* Game: tactical styling */
@chat-mode game {
  [data-card-css] {
    border: 1px solid rgba(0, 255, 0, 0.2);
    border-radius: 4px;
    background: rgba(0, 20, 0, 0.4);
  }
  [data-card-css] p {
    font-family: 'Courier New', monospace;
    color: #b0ffb0;
  }
}
</style>
```
