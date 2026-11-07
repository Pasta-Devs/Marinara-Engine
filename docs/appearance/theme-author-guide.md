# Theme Author Guide

This guide is for people who write or share custom themes. It lists the variables, attributes and part hooks a theme can rely on, how a theme wins over the app's own styles, and the safety rules every theme follows. To switch themes, import one or use the Theme Library, see [Custom CSS Themes](custom-css-themes.md).

**Token contract version 1** (`--mari-tokens-version: 1` on `:root`). The variables, attributes and hooks in this guide keep their names between releases. When one has to change, the version goes up and the change is listed under [Changes](#changes) at the end. Everything else (other `--ov-*`, `--mari-*` and `--marinara-*` variables, Tailwind classes, element structure) is internal and can change in any update.

## Start here

1. Open **Settings → Appearance → CSS Themes** (in the classic layout, **Settings → Addons → Theme Library**) and click **Create Theme**.
2. The editor starts from a template built on the tokens below. Remove the `/*` and `*/` around a line and set your own value.
3. Leave **Preview** on to see each change as you type.
4. Problems show under the editor with a line number: a missing brace, a property the browser doesn't know, a value it won't accept (usually a missing `;`), or a colour written as a bare `270 25% 8%`.
5. Click **Save**. Save first checks the CSS against the safety rules in [Safety](#safety). If the theme hides, moves or covers the top bar, a sidebar, Ctrl+K or the message box, it tells you what broke and doesn't save until you fix it or choose **Save anyway**.

A small theme:

```css
:root {
  --mari-tokens-version: 1;
  --primary: #3fae7a;
  --mari-selected-tint: var(--primary);
  --mari-font-ui: "Inter", system-ui, sans-serif;
}

[data-theme="dark"] {
  --background: #0f1712;
  --card: color-mix(in srgb, #0f1712 80%, transparent);
  --sidebar: #0b120e;
}
```

## How a theme wins

The app's own CSS sits in cascade layers, declared first thing in `index.html`:

```
mari-protected, mari-theme-important, theme, base, components, utilities, mari-app, mari-pickers
```

- A theme is **unlayered**, so a plain selector in a theme beats every app rule without `!important`,
  whatever the app rule's specificity.
- `mari-pickers` holds the Appearance pickers (background, accent, fonts, chat colours). It sits
  above the app's defaults and below a theme, so a theme's colours win over the pickers, and
  Appearance tells the user when a theme overrides a picker.
- `!important` in a theme still works. Those rules are copied into `mari-theme-important`, which
  beats the app's own `!important` rules.
- `mari-protected` keeps the top bar, the chats sidebar, the Library sidebar and Ctrl+K in place.
  A theme can restyle them (colours, fonts, borders, radius, shadows) but not hide, move, shrink or
  cover them. If it tries, the theme is switched off in that tab and the user is told why.

The way back always works: `?safe` in the URL, **Escape three times**, or Ctrl+K > "Custom theme"
turns the theme off. A new theme asks "Keep this theme?" and goes back after 15 seconds.

## Colour tokens

### Core (every visual style defines these)

`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`,
`--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`,
`--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`,
`--border`, `--input`, `--ring`, `--radius`, `--sidebar`, `--sidebar-foreground`, `--sidebar-border`,
`--sidebar-accent`, `--sidebar-accent-foreground`.

Values are full CSS colours (`#1b1530`, `rgb(…)`, `oklch(…)`). Bare HSL triplets such as
`270 25% 8%` (the shadcn convention) are **not** valid here.

Scope light and dark separately with `[data-theme="light"]` and `[data-theme="dark"]`.

### New layout

| Token                                                            | Used for                                                                                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `--ov-line`                                                      | Hairlines and panel borders                                                                                                   |
| `--ov-text`, `--ov-muted`, `--ov-dim`                            | Text, secondary text, faint text                                                                                              |
| `--ov-accent`                                                    | Accent spots (defaults to `--primary`)                                                                                        |
| `--ov-hover`, `--ov-active-bg`                                   | Hover and pressed backgrounds                                                                                                 |
| `--ov-mode-conversation`, `--ov-mode-roleplay`, `--ov-mode-game` | Chat-mode colours in the chats sidebar and editors                                                                            |
| `--ov-serif`                                                     | Title font (follows `--mari-font-heading`)                                                                                    |
| `--mari-selected-tint`                                           | Selected rows, pills and toggles. Neutral (`--foreground`) by default; set it to `var(--primary)` for accent-tinted selection |
| `--mari-selected-bg`, `--mari-selected-ring`                     | Derived from the tint (10% and 18%)                                                                                           |

### Theme tokens (v1)

Each one defaults to the app's own look. Light mode has its own readable values.

| Token                                                                                                    | Used for                                                                                                                    |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `--mari-font-ui`                                                                                         | The whole app's font                                                                                                        |
| `--mari-font-heading`                                                                                    | Page and section titles                                                                                                     |
| `--mari-font-chat`                                                                                       | Message text in roleplay and conversation chats                                                                             |
| `--mari-mode-conversation`, `--mari-mode-roleplay`, `--mari-mode-game`                                   | Home chips, recent chats, the new-chat launcher, Home widget eyebrows                                                       |
| `--mari-home-pink`, `--mari-home-violet`                                                                 | The other Home widget accents                                                                                               |
| `--mari-status-online`, `--mari-status-idle`, `--mari-status-dnd`, `--mari-status-offline`               | Presence dots and labels                                                                                                    |
| `--mari-gauge-ok`, `--mari-gauge-warn`, `--mari-gauge-danger`                                            | Game gauges and HP bars. A widget's own colour still wins in its normal state; danger always uses the token                 |
| `--mari-game-combat`, `--mari-game-combat-text`                                                          | The game's Combat button                                                                                                    |
| `--mari-stage-empty-bg`                                                                                  | The game stage before a scene image loads                                                                                   |
| `--mari-scrim`                                                                                           | The dimmed backdrop behind Ctrl+K                                                                                           |
| `--mari-user-avatar-placeholder`                                                                         | Your avatar when you have no picture (a gradient)                                                                           |
| `--mari-art-saturation-1`, `--mari-art-lightness-1`, `--mari-art-saturation-2`, `--mari-art-lightness-2` | The gradient on cards without a picture. Each card keeps its own hue; set these (as percentages) to calm the gradients down |
| `--mari-app-backdrop`                                                                                    | An image or gradient behind the whole app, painted once (see below)                                                         |
| `--mari-accent-fx-animation`                                                                             | The Accent Pulse or RGB Mode animation while one is on, otherwise `none`                                                    |

## Backdrops

Set `--mari-app-backdrop` on `:root` to paint art behind the app:

```css
:root {
  --mari-app-backdrop: url("data:image/webp;base64,…");
}
```

It is drawn once on the app root, and the nested surfaces that used to repaint the background go
transparent so the art shows through. Panels keep `--card` and `--sidebar`, so make those
translucent if you want the art to show behind them.

A chat's own background is an `<img data-mari-part="backdrop">`. The stock one (no background picked)
also has `data-default-background="true"`, so a theme can replace only that one:

```css
img[data-mari-part="backdrop"][data-default-background] {
  opacity: 0 !important;
}
```

## Accent effects

Accent Pulse and RGB Mode animate a few accent spots in the new layout ("+ New", primary buttons,
the assistant's avatar tile) with a CSS filter. Nothing is rewritten per frame. A theme can:

- turn Accent Pulse on for its users with `:root { --marinara-theme-accent-pulse: enabled; }`;
- add its own elements with `animation: var(--mari-accent-fx-animation);`.

Both stop under `prefers-reduced-motion` and the app's "Reduce ambient animations" setting.

## Hooks

### On `<html>`

| Attribute                       | Values                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `data-theme`                    | `dark`, `light`                                                                                          |
| `data-visual-theme`             | `default` (Marinara), `sillytavern` (Dottore), `stage`                                                   |
| `data-overhaul`                 | `on` (new layout, desktop), `mobile` (new layout, phone and tablet); absent in the old layout            |
| `data-custom-theme`             | The active theme's id                                                                                    |
| `data-seasonal-theme`           | The seasonal look, when one is on                                                                        |
| `data-mari-accent-fx`           | `pulse` or `rgb` while an accent effect runs                                                             |
| `data-chat-id`                  | The open chat's id                                                                                       |
| `data-chat-open-mode`           | The open chat's mode: `roleplay`, `conversation`, `game`                                                 |
| `data-chat-tags`                | The open chat's tags, lowercase with spaces as `-`: style a story with `:root[data-chat-tags~="horror"]` |
| `data-mari-chat-art-behind`     | Present while the chat's background is shown behind the side panels (`--mari-chat-art` is the picture)   |
| `data-marinara-reduced-effects` | Present when ambient animation is reduced                                                                |
| `data-mari-a11y-line-height`    | Present when the user widened line spacing (`--mari-a11y-line-height`)                                   |
| `data-mari-a11y-letter-spacing` | Present when the user widened letter spacing (`--mari-a11y-letter-spacing`)                              |
| `data-mari-a11y-focus`          | Present when strong focus rings are on                                                                   |
| `data-mari-contrast`            | `more` when high contrast is on (the user's choice, or the device asks for it)                           |
| `data-mari-cvd-safe`            | Present when colour-blind-safe colours are on                                                            |

### Areas

`[data-component="…"]` names the big areas: `AppShell`, `TopBar`, `ChatSidebar`, `ChatSidebarSlot`,
`RightPanelDesktop`, `RightPanelDesktopSlot`, `CenterContent`, `GlobalOmnibar`, `OverhaulLibraryNav`,
`OverhaulSettingsPage`, `OverhaulLibraryPage`, `OverhaulCardGallery`, `OverhaulEditorHead`,
`OverhaulEditorRail`.

### Parts

| Selector                                                              | What it is                                                                                                           |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `[data-mari-part="message"]`                                          | One message. Also has `data-message-id` and `data-message-role` (`user`, `assistant`, `system`, …)                   |
| `[data-mari-part="message"][data-latest]`                             | The newest reply from the character                                                                                  |
| `[data-mari-part="message"][data-streaming]`                          | A reply that is still being written                                                                                  |
| `[data-mari-part="composer"]`                                         | The message box. `data-composer` is `roleplay`, `conversation` or `game`                                             |
| `[data-mari-part="home-widget"]`                                      | A Home widget card. Its frame has `data-home-widget-id` (`recent`, `professor`, `whats-new`, `character-library`, …) |
| `[data-mari-part="backdrop"]`                                         | A chat's background image (see Backdrops)                                                                            |
| `[data-mari-part="stage-empty"]`                                      | The game stage with no scene image                                                                                   |
| `[data-chat-row]`                                                     | A row in the chats sidebar; `data-selected="true"` on the open chat                                                  |
| `[data-chat-mode]`                                                    | The chat surface, by mode                                                                                            |
| `.mari-messages-scroll`                                               | The scrolling message list                                                                                           |
| `.mari-rp-bubble`, `.mari-rp-bubble--user`, `.mari-message-assistant` | Roleplay and conversation bubbles                                                                                    |
| `.mari-window`, `.mari-drawer`                                        | Pop-out windows and drawers                                                                                          |

## Per-chat looks

Chat settings > Theme gives one chat its own theme ("Default look" turns custom themes off for that
chat), and a chat with one character can make that the character's default. Inside a theme, tags
are the portable way to style particular stories: `:root[data-chat-tags~="noir"] { --primary: #c9a227; }`.

Setting any `--mari-chat-*` variable (for example `--mari-chat-bg`, `--mari-chat-text`,
`--mari-chat-radius`, `--mari-chat-font-family`) switches on the matching chat-surface styling by
itself; users no longer need the "Apply preset …" switches for a theme's chat colours to show.

## Theme files

Export writes one theme as one JSON file:

```json
{
  "kind": "marinara.theme",
  "formatVersion": 2,
  "name": "Forest Glass",
  "author": "You",
  "version": "1.2",
  "description": "Deep greens with frosted panels.",
  "colorScheme": "dark",
  "thumbnail": "data:image/webp;base64,…",
  "settings": { "colorScheme": "dark", "visualStyle": "stage", "accent": "#3fae7a", "fontFamily": "Georgia" },
  "fonts": [{ "family": "My Display", "src": "data:font/woff2;base64,…" }],
  "backgrounds": [{ "name": "forest.webp", "src": "data:image/webp;base64,…" }],
  "css": ":root { --primary: #3fae7a; }"
}
```

Only `kind`, `name` and `css` are required. `settings` keys: `colorScheme`, `visualStyle`, `accent`,
`accentLight`, `background`, `backgroundLight`, `fontFamily`, `accentPulse`. Importing shows a preview
first, and the user picks which settings to apply and whether to add the backgrounds to their gallery.
Fonts load with the theme (as `@font-face` rules) and go away with it. Importing a theme with the same
name as an installed one offers to update it. The CSS limit is 256 KiB; thumbnail, fonts and
backgrounds together get 6 MiB. Plain `.css` files, `{ "name", "css" }` and the older
`marinara.theme-folder` export still import.

## Accessibility

Settings > Appearance > Accessibility applies the user's line and letter spacing, focus rings,
high contrast, colour-blind-safe colours and a 12 px minimum for message text. The values are
written into the `mari-protected` layer as literals on every element (lib/accessibility-css.ts), so
a theme can't undo them, not even by redefining variables. While an option is off, a theme can set:

| Token                                                  | Used for                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| `--mari-focus-ring-color`                              | The app's normal focus ring (defaults to `--primary`)            |
| `--mari-cvd-good`, `--mari-cvd-warn`, `--mari-cvd-bad` | Status and gauge colours when you want your own blue/orange pair |

Use the status and gauge tokens above rather than fixed greens and reds, and the colour-blind-safe
switch reaches your theme too. Skip links (`.mari-skip-link`) stay reachable whatever a theme does.
The import preview tells the user when a theme tries to change any of these.

## Safety

- The top bar (including its fullscreen auto-hide state), the chats sidebar and its chat rows, the
  Library sidebar, Ctrl+K and the message box can be restyled, not hidden, moved, covered, faded,
  filtered away or made unclickable. The guard measures them with and without the theme after the
  theme loads, at 2.5 s and 10 s, when a chat opens, when a panel opens, when the colour scheme
  changes and on resize, and switches a theme off in that tab when it breaks one.
- Text a theme adds with `content:` is shown in the import preview. Added text in the chat or the
  message box that asks for keys, passwords or sign-ins switches the theme off.
- "Keep this theme?" survives a reload or a closed tab: unanswered means going back. Hovering or
  focusing the bar pauses the countdown. Escape three times turns custom themes off in the tab;
  an Escape that closes Ctrl+K, a menu or a dialog doesn't count.

## Changes

- **v1.0.1**: guard v2, protected Accessibility values, added-text checks. Install is all-or-nothing,
  bundled backgrounds install, Go back also restores the settings a theme applied, theme fonts show
  in the Font list, `url(#id)` references are kept, and bundled font names are read from the font.
- **v1** (first published contract): theme tokens, part hooks, backdrop and accent effects above.
