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
| `--mari-stage-empty-bg`                                                                                  | The game stage before a scene image loads (any `background`, gradients included)                                            |
| `--mari-scrim`                                                                                           | The dimmed backdrop behind Ctrl+K                                                                                           |
| `--mari-user-avatar-placeholder`                                                                         | Your avatar when you have no picture (a gradient)                                                                           |
| `--mari-art-saturation-1`, `--mari-art-lightness-1`, `--mari-art-saturation-2`, `--mari-art-lightness-2` | The gradient on cards without a picture. Each card keeps its own hue; set these (as percentages) to calm the gradients down |
| `--mari-app-backdrop`                                                                                    | An image or gradient behind the whole app, painted once (see below)                                                         |
| `--mari-accent-fx-animation`                                                                             | The Accent Pulse or RGB Mode animation while one is on, otherwise `none`                                                    |

### Theme tokens added in v1.1

These have no value until a theme sets one, so the user's own setting applies until then.

| Token                                                                                                                                                                                                                        | Used for                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mari-text-outline`                                                                                                                                                                                                        | The outline on message text, for example `0` to turn it off or `1px #3b2a1a`. Otherwise it's the user's Text Outline setting                                                                                                      |
| `--mari-dialogue-color`                                                                                                                                                                                                      | Dialogue colour when the character or persona has none of its own (their own colour still wins)                                                                                                                                   |
| `--mari-chat-font-size`                                                                                                                                                                                                      | Message text size. The Accessibility minimum still applies                                                                                                                                                                        |
| `--mari-composer-placeholder`                                                                                                                                                                                                | The message box placeholder, as a quoted string: `"> waiting for user input..."`. Set it on `:root` or on one composer, such as `[data-composer="game"]`. Text that asks for keys or passwords is ignored                         |
| `--mari-page-veil`                                                                                                                                                                                                           | A colour laid over Settings, the Library, editors and Docs, so long text stays readable over a backdrop. `transparent` by default                                                                                                 |
| `--mari-top-bar-bg`                                                                                                                                                                                                          | A whole `background` value for the top bar: an image, a gradient or several layers. `--mari-top-bar-rendering: pixelated` keeps pixel art crisp. The tabs and icons always stay on top and visible                                |
| `--mari-top-bar-plate`, `--mari-top-bar-plate-radius`                                                                                                                                                                        | Over top-bar art, every tab, open-chat tab, icon button and the logo sits on a plate so it stays readable. These set the plate's colour and its corner radius (default `0.5rem`); set the radius to `0` for square pixel buttons. |
| `--mari-msg-head-rule`                                                                                                                                                                                                       | The line under the name in roleplay messages (a `border-bottom` value, such as `none` or `2px dashed currentColor`)                                                                                                               |
| `--mari-home-widget-border`, `--mari-home-widget-border-width`, `--mari-home-widget-radius`, `--mari-home-widget-bg`                                                                                                         | Every Home widget's frame and surface, Professor Mari included                                                                                                                                                                    |
| `--mari-home-widget-font`, `--mari-home-widget-title-font`, `--mari-home-widget-title-size`, `--mari-home-widget-title-color`, `--mari-home-widget-eyebrow-size`, `--mari-home-widget-text-size`, `--mari-home-widget-muted` | Home widget type. Widgets grow taller when the text needs more room instead of clipping it                                                                                                                                        |
| `--mari-home-widget-eyebrow-color`, `--mari-home-widget-action-size`, `--mari-professor-sprite-scale`                                                                                                                        | The small label above widget titles, Professor Mari's Ask button text, and the size of Mari's picture (1 = stock)                                                                                                                 |
| `--mari-home-wash`                                                                                                                                                                                                           | The tint Home lays over a backdrop (stock: 65% of the card colour); `transparent` shows the art at full strength                                                                                                                  |
| `--mari-home-art`                                                                                                                                                                                                            | `none` hides the stock pictures on Home's cards; they load lazily, so hidden ones are never downloaded                                                                                                                            |
| `--mari-ambient` (and `-opacity`, `-blend`, `-animation`)                                                                                                                                                                    | The ambient overlay: see Ambient overlay                                                                                                                                                                                          |
| `--mari-icon-send`, `--mari-icon-stop`, `--mari-icon-attach`, `--mari-icon-emoji`                                                                                                                                            | A picture instead of the message box's icon (a `background-image` value)                                                                                                                                                          |
| `--mari-cursor`, `--mari-cursor-pointer`                                                                                                                                                                                     | A picture pointer (a whole `cursor` value). It wins over Custom Mouse Pointer while the theme is on                                                                                                                               |

### Theme tokens added in v1.4

Like the v1.1 tokens, the first group does nothing until a theme sets it.

| Token                                                                                          | Used for                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mari-message-time`                                                                          | The colour of message times (`[data-mari-part="time"]`) in every chat mode                                                                          |
| `--mari-chat-wash`                                                                             | The tint over a roleplay chat's background, as a whole `background` value. The stock one is a dark wash, lavender-white in Light. `none` removes it |
| `--mari-lore-constant`, `--mari-lore-selective`, `--mari-lore-normal`                          | The lorebook entry status dots                                                                                                                      |
| `--mari-toast-font-size`                                                                       | Toast text size (toasts already use `--mari-font-ui`)                                                                                               |
| `--mari-home-shortcut-size`, `--mari-home-shortcut-desc-size`                                  | Home's Learn and Community shortcut lines. With only `--mari-home-widget-text-size` set they follow it, with descriptions at 0.85x                  |
| `--mari-min-ui-text`                                                                           | A floor for the app's smallest text (9-12 px labels, counts, chips). Tailwind's `--text-xs`, `--text-sm` and `--text-base` can be set too           |
| `--mari-user-avatar-image`                                                                     | A picture for your avatar when the persona has none. With no token, the placeholder now shows the persona's own picture when it has one             |
| `--mari-focus-frame`, `--mari-window-title`, `--mari-ambient-placement`, `--mari-ambient-mask` | Slots, see below                                                                                                                                    |

These replace values that were fixed in the app, and fall back to the stock look:

| Token                                                                               | Used for                                                                                                                                      |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mari-chrome-accent`                                                              | The active tab underline, editor shells, selects and connection screens                                                                       |
| `--mari-chrome-muted`                                                               | Grey secondary text in panels, sidebars and Home (stock: 58% of the chrome text)                                                              |
| `--mari-resource-accent`, `--mari-resource-<type>`                                  | The Library colours per type: `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents`, `settings`, `backgrounds`, `browser` |
| `--mari-ctrlk-conversation`, `--mari-ctrlk-roleplay`, `--mari-ctrlk-game`           | Ctrl+K row colours per mode                                                                                                                   |
| `--mari-game-combat-bg`, `--mari-game-combat-bg-hover`, `--mari-game-combat-border` | The Game Combat button                                                                                                                        |
| `--mari-top-bar-plate-active`                                                       | The plate behind an active top-bar control when the bar has art (stock: the plate mixed with 20% accent)                                      |
| `--mari-chat-header-bg`                                                             | The fade behind the conversation header (stock: the page colour at 88% fading out; `none` under an app backdrop)                              |
| `--mari-home-hero-padding`, `--mari-home-widget-glow`                               | Home's greeting padding and the glow behind a Home widget header                                                                              |

The app also publishes `--mari-top-bar-height` on `<html>` (the top bar's real height, which
changes when a theme makes the bar taller), so a theme can pad its own layers below it.

### Theme tokens added in v1.5

For long replies and the bits that took internal classes before. Each does nothing until a theme
sets it, except where a stock value is given.

| Token                                                      | Used for                                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mari-chat-column`                                       | The roleplay column that messages and the message box share (stock 58rem). The reader's own Chat settings → Chat width still wins                                   |
| `--mari-message-measure`                                   | The longest line of message text, for example `68ch` (roleplay and conversation)                                                                                    |
| `--mari-chat-line-height`                                  | Line height of message text in every chat mode (stock 1.5). Accessibility → Line spacing still wins                                                                 |
| `--mari-dialogue-weight`                                   | The weight of quoted speech (`[data-mari-part="dialogue"]`), for example `400` so a long speech isn't a bold slab                                                   |
| `--mari-dialogue-color`                                    | Now also shows when the theme's `--mari-chat-*` colours switch on the chat colour paint, and so do the colours a theme gives italics and links                      |
| `--mari-paragraph-gap`                                     | Space between paragraphs instead of one blank line, for example `0.85em`                                                                                            |
| `--mari-pinned-speaker`, `--mari-pinned-speaker-bg`        | `on`: the name line of a tall roleplay reply stays at the top of the chat while you scroll through it (desktop and tablet). The background defaults to the bubble's |
| `--mari-pinned-speaker-top`, `--mari-pinned-speaker-bleed` | Where the pinned line sits (stock: the top edge of the visible chat) and how far it reaches past the text (stock 1rem)                                              |
| `--mari-phone-avatar`                                      | `hidden`: phones drop the avatar column in roleplay, so the reply gets the whole width                                                                              |
| `--mari-vn-fade`                                           | The fade at the foot of the VN text box while more of the paragraph is below (stock 1.75rem, `0` turns it off)                                                      |
| `--mari-message-actions`, `--mari-swipe-counter`           | The colour of the tools under a message and of its "2 / 5" swipe counter                                                                                            |
| `--mari-card-art-placeholder`                              | A whole `background` for Library cards with no picture, instead of the random-hue gradient                                                                          |
| `--mari-chat-row-art-opacity`                              | The open chat's picture behind its row in the chats sidebar (stock 0.14; `0` hides it)                                                                              |
| `--mari-chrome-accent`, `--mari-chrome-accent-gradient`    | Now also reach the surfaces that read the accent from `<html>` (the Convo / Roleplay / Game tabs, chrome borders)                                                   |
| `--mari-focus-frame-outset`                                | How far the focus frame reaches past its surface (a length, at most 2rem; see Slots)                                                                                |
| `--mari-scrim`                                             | The dim layer behind dialogs                                                                                                                                        |

The app also publishes `--mari-center-x` on `<html>` while a theme has an ambient overlay: the
horizontal centre of the chat pane, so a mask can keep the reading column clear whether the sidebars
are open or not. `--mari-gutter-mask` uses it.

## Pictures

A theme carries its pictures in `images` in the theme file, and its CSS uses them by name:

```css
:root {
  --mari-app-backdrop: url("theme:night.webp");
}
[data-mari-part="home-widget"] {
  border-image: url("theme:frame.webp") 24 fill / 24px stretch;
}
```

- Pictures count in the 6 MiB package budget, not in the 256 KiB CSS limit, so full-size art fits.
- In the editor, open **Pictures and sharing details** and press **Add pictures**. PNG and JPEG are
  saved as WebP on the way in (small ones lossless, so pixel art and 9-slice frames stay crisp;
  at most 2560 px on the longest side). Click a picture's name to put `url("theme:name")` at the cursor.
- Importing a theme does the same: pictures written inline as `data:` URLs move out of the CSS
  into `images`, still PNG and JPEG become WebP, and the preview lists every picture with its size
  (with a "Keep the original files instead" box).
- `theme:` names also find the theme's `backgrounds` by name, so art you ship for the chat
  background gallery can be used in the CSS too, whether or not the user adds it to the gallery.
- When the theme is applied, every picture becomes a short same-origin `blob:` URL: nothing is
  downloaded, and a picture used in many places is decoded once.
- GIF, APNG, animated WebP and SVG with `<animate>` count as moving pictures. The import preview
  says so, and with Reduce motion on they show as their first frame.

## Backdrops

Set `--mari-app-backdrop` on `:root` to paint art behind the app:

```css
:root {
  --mari-app-backdrop: url("theme:city.webp");
  --mari-app-backdrop-position: bottom center;
  --mari-app-backdrop-rendering: pixelated;
}
```

It is drawn once, on its own fixed layer under the whole app (`[data-mari-part="app-backdrop"]`, so
Home's decorations and the light scheme never hide it), and it shows behind chats too: the roleplay,
conversation and game surfaces go transparent and the stock chat background steps aside. A
background the user picked for a chat still shows on top of it. Panels keep `--card` and
`--sidebar`, so make those translucent if you want the art to show behind them, and use
`--mari-page-veil` to tint full pages.

| Token                            | Default                                                                                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mari-app-backdrop`            | One image or gradient                                                                                                                                                                                             |
| `--mari-app-backdrop-size`       | `cover` (try `auto` or `64px` for tiles)                                                                                                                                                                          |
| `--mari-app-backdrop-position`   | `center`                                                                                                                                                                                                          |
| `--mari-app-backdrop-repeat`     | `no-repeat`                                                                                                                                                                                                       |
| `--mari-app-backdrop-attachment` | `fixed`                                                                                                                                                                                                           |
| `--mari-app-backdrop-rendering`  | `auto` (`pixelated` for pixel art)                                                                                                                                                                                |
| `--mari-app-backdrop-layers`     | A whole `background` value with several layers, such as `url(city.webp) bottom / 100% auto no-repeat, radial-gradient(#fff3 1px, transparent 1px) 0 0 / 12px 12px, #fbe3ef`. It wins over the single-image tokens |

Custom images are the most flexible part of a theme: backdrops, a top bar strip, Home widget
frames and message frames (`border-image`, or a `background` on any part hook), tiled patterns
and bundled pixel fonts all ship inside the theme file, and the import preview lists them.
The user's Appearance > Accessibility > Theme art strength fades the backdrop and the ambient
overlay, and High contrast keeps them at 25% or less; a theme can't undo either.

## Ambient overlay

`--mari-ambient` takes a whole `background` value for a layer over the chat and the pages but
**under** the top bar and both sidebars: rain, falling leaves, scanlines, a vignette.

```css
:root {
  --mari-ambient: url("theme:leaves.webp") 0 0 / 512px repeat;
  --mari-ambient-opacity: 0.6;
  --mari-ambient-animation: leaves-fall 30s linear infinite;
}
@keyframes leaves-fall {
  to {
    background-position: 0 1024px;
  }
}
```

`--mari-ambient-blend` sets a `mix-blend-mode`, and `[data-mari-part="ambient"]::before` and
`::after` are free for two more layers. The layer never takes clicks, stops moving with Reduce
motion (its pictures become still frames), and must stay mostly see-through: a theme whose ambient
layer would hide the chat is switched off. Use this instead of a full-screen `body::after`, which
the guard treats as covering the app.

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

| Selector                                                                               | What it is                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[data-mari-part="message"]`                                                           | One message, in every chat mode. Also has `data-message-id` and `data-message-role` (`user`, `assistant`, `system`, …) and the message data below                                                                                                                                                                                               |
| `[data-mari-part="message"][data-latest]`                                              | The newest reply from the character                                                                                                                                                                                                                                                                                                             |
| `[data-mari-part="message"][data-streaming]`                                           | A reply that is still being written                                                                                                                                                                                                                                                                                                             |
| `[data-mari-part="avatar"]`, `[data-mari-part="header"]`, `[data-mari-part="actions"]` | Inside a message: the avatar, the name line and the message tools                                                                                                                                                                                                                                                                               |
| `[data-mari-part="reasoning"]`, `[data-mari-part="reasoning-text"]`                    | The reasoning toggle (or box) and its text, the same hook on desktop and on phones                                                                                                                                                                                                                                                              |
| `[data-mari-part="composer"]`                                                          | The message box. `data-composer` is `roleplay`, `conversation` or `game`                                                                                                                                                                                                                                                                        |
| `[data-mari-part="home-art"]`                                                          | The stock pictures on Home's cards                                                                                                                                                                                                                                                                                                              |
| `[data-mari-part="message"][data-vn]`                                                  | The visual novel dialogue box: a message with the same data (character, role, index), plus `avatar` and `header` parts inside                                                                                                                                                                                                                   |
| `[data-mari-part="vn-sprite"]`                                                         | An empty layer behind the VN dialogue box, reaching the bottom of the scene. It has `data-vn-speaker` (the speaker's name as a slug, or their role), `data-vn-speaker-role`, `data-character` and `data-character-id` for whoever is speaking now, so a theme can stand their picture there. `[data-roleplay-vn-media]` has the same attributes |
| `[data-mari-part="message"][data-game-narration]`                                      | The Game narration box. `data-message-role` is `narrator`, or `assistant` with `data-character` and `data-character-name` while a character speaks; `data-segment-type` and `data-expression` describe the current line                                                                                                                         |
| `[data-mari-part="app-backdrop"]`, `[data-mari-part="ambient"]`                        | The backdrop and ambient layers. Their place in the page is fixed; style them with the tokens                                                                                                                                                                                                                                                   |
| `[data-mari-part="home-widget"]`                                                       | A Home widget card, Professor Mari included. Its frame has `data-home-widget-id` (`recent`, `professor`, `whats-new`, `character-library`, …). Inside: `home-widget-eyebrow`, `home-widget-title`, `home-widget-text`                                                                                                                           |
| `[data-mari-part="backdrop"]`                                                          | A chat's background image (see Backdrops)                                                                                                                                                                                                                                                                                                       |
| `[data-mari-part="stage-empty"]`                                                       | The game stage with no scene image                                                                                                                                                                                                                                                                                                              |
| `[data-mari-part="time"]`                                                              | A message's time, in every chat mode                                                                                                                                                                                                                                                                                                            |
| `[data-mari-part="chat-header"]`                                                       | The conversation header (`data-chat-mode="conversation"`)                                                                                                                                                                                                                                                                                       |
| `[data-mari-part="game-hud"]`, `[data-mari-part="game-tools"]`                         | The Game map-and-party float and the narration tool row                                                                                                                                                                                                                                                                                         |
| `[data-mari-part="avatar-placeholder"]`                                                | The empty avatar circle; `data-role` is `user` or `assistant`                                                                                                                                                                                                                                                                                   |
| `[data-mari-part="header"][data-placement]`                                            | On roleplay messages: `outside` (name above the bubble) or `inside`                                                                                                                                                                                                                                                                             |
| `[data-mari-part="home-widget-glow"]`                                                  | The glow behind a Home widget's header                                                                                                                                                                                                                                                                                                          |
| `[data-mari-part="dialogue"]`                                                          | Quoted speech in a message                                                                                                                                                                                                                                                                                                                      |
| `[data-mari-part="paragraph-gap"]`                                                     | The blank line between two paragraphs (it becomes a block when `--mari-paragraph-gap` is set)                                                                                                                                                                                                                                                   |
| `[data-mari-part="vn-text"]`, `vn-counter`, `vn-nav`                                   | The VN text box (`data-more-below` while it scrolls on), the "3 / 9" counter and the Previous / Next buttons (`data-direction`)                                                                                                                                                                                                                 |
| `[data-mari-part="card-art"]`                                                          | A Library card's picture; `data-placeholder` when it has none                                                                                                                                                                                                                                                                                   |
| `[data-mari-part="chat-row-art"]`                                                      | The open chat's picture behind its sidebar row                                                                                                                                                                                                                                                                                                  |
| `[data-mari-part="avatar-placeholder"]`                                                | Now in every place an empty avatar shows: conversation lines, chat rows (initials), the persona switcher, the message box and Game                                                                                                                                                                                                              |
| `.ov-lrow__dot[data-status]`                                                           | A lorebook entry dot: `constant`, `selective` or `normal`                                                                                                                                                                                                                                                                                       |
| `[data-chat-row]`                                                                      | A row in the chats sidebar; `data-selected="true"` on the open chat                                                                                                                                                                                                                                                                             |
| `[data-chat-mode]`                                                                     | The chat surface, by mode                                                                                                                                                                                                                                                                                                                       |
| `.mari-messages-scroll`                                                                | The scrolling message list                                                                                                                                                                                                                                                                                                                      |
| `.mari-rp-bubble`, `.mari-rp-bubble--user`, `.mari-message-assistant`                  | Roleplay and conversation bubbles                                                                                                                                                                                                                                                                                                               |
| `.mari-window`, `.mari-drawer`                                                         | Pop-out windows and drawers                                                                                                                                                                                                                                                                                                                     |

### Slots

These appear only while the active theme asks for them, so the stock page carries no extra parts.

- **Focus frame.** `--mari-focus-frame` takes a whole `border-image` value, for example
  `url("theme:frame.png") 24 fill / 24px / 6px stretch`, and paints it on whatever has the
  reader's attention: the newest reply, Ctrl+K, an open dialog and Home's Recent chats. Add
  `data-mari-focus-surface` to any other element (in a message template) to frame it too.
  Since v1.5 the frame only reaches past its surface through `--mari-focus-frame-outset` (at most
  2rem), and not at all when the value has `fill`, so it can't paint over the chat; an outset written
  inside `--mari-focus-frame` is ignored. The frame is a `border-image`: a `border` shorthand later in
  your CSS on the same element resets it, so set `border-color`, `border-width` and `border-style`
  there instead.
- **Window titles.** Setting `--mari-window-title` (any value, such as `on`) adds a title row at the
  top of each message, Home widget and message box: `[data-mari-part="window-title"]` with
  `data-window` (`message`, `home-widget`, `composer`, and since v1.5 `narration`, `omnibar`,
  `window` and `dialog`), holding `window-title-text` (the speaker,
  the widget title, or "Message") and an empty `window-buttons` for your `_ [] X` decorations.
- **Ambient behind cards.** `--mari-ambient-placement: behind-cards` moves the ambient layer under
  messages, Home widgets and panels (still over the backdrop) instead of over the chat.
  `--mari-ambient-mask` (a whole `mask` value) shapes where it shows, and
  `--mari-ambient-mask: var(--mari-gutter-mask)` keeps the middle of the window clear, so rain falls
  in the side gutters and not over the text. `--mari-gutter-clear` sets the clear half-width (26rem).

### Message data

Every message carries who wrote it, its number and how long it took, as attributes for selectors
and `attr()`, and as CSS variables for `content:` and `counter()`:

| Attribute             | Variable           | Value                                                                                      |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| `data-character-id`   |                    | The character's id (absent on your own messages)                                           |
| `data-character-name` | `--mari-msg-char`  | The display name (`--mari-msg-char` is a quoted string)                                    |
| `data-character`      |                    | The name in lowercase with spaces as `-`, for selectors: `[data-character="captain-faye"]` |
| `data-message-index`  | `--mari-msg-index` | The message number shown by "Message numbers"                                              |
| `data-gen-ms`         | `--mari-msg-gen`   | Generation time in ms (`--mari-msg-gen` is a string such as `"3.2s"`)                      |

```css
[data-mari-part="message"] [data-mari-part="header"]::after {
  counter-reset: msg var(--mari-msg-index);
  content: "#" counter(msg) " · " var(--mari-msg-gen, "");
}
```

### Message template (HTML)

When CSS isn't enough, for example a status box with the speaker's name and the message number, a
theme file can carry a small HTML template per role. It is filled in for every message and shown
in a box at the end of the message, `[data-mari-part="message-extra"]`, which your CSS styles and
places:

```json
"templates": {
  "assistant": "<div class=\"status\"><b>{{char}}</b> · entry #{{index}} · {{gen}}</div>",
  "user": "<div class=\"status\">> {{char}} @ {{time}}</div>"
}
```

Keys: `message` (every role), `assistant`, `user`, `narrator` (a role's own template wins over
`message`). Fields: `{{char}}`, `{{role}}`, `{{index}}`, `{{gen}}`, `{{time}}`, `{{date}}`; unknown
fields are left empty. Each template is at most 4,000 characters. Marinara keeps text and layout
tags (`div`, `span`, `p`, `b`, `i`, `ul`, `table`, `details`, `progress`, …) with `class`, `title`,
`role` and `data-*` attributes, and strips scripts, styles, inline `style`, links, images, forms and
event attributes. A template whose text asks for keys or passwords is dropped.

HTML is opt-in for users: a theme with a template can only be installed while Settings > Appearance

> CSS Themes > **Allow themes with HTML** is on (off by default), the import preview warns about it,
> and with the switch off an installed theme shows without its HTML.

## Per-chat looks

Chat settings > Theme gives one chat its own theme ("Default look" turns custom themes off for
that chat). In a chat with exactly one character, the pick can become that character's default
for their other one-on-one chats; group chats and game parties never borrow one member's default.
The Theme section says where the current look comes from: the chat, the character, or the app.
Settings, the Library, editors and Docs always use the app's theme, and `data-chat-id` and
`data-chat-tags` are only on `<html>` while the chat itself is showing.

Tags are the portable way to style particular stories inside one theme:
`:root[data-chat-tags~="noir"] { --primary: #c9a227; }`. Add tags under Chat settings > Chat Name
("+ Add tag"), from a chat row's tag button (or "Tags" in the long-press menu on touch screens).
Tags are lowercased with spaces as `-` in the attribute, so "Noir Mystery" matches `noir-mystery`.

Setting any `--mari-chat-*` variable (for example `--mari-chat-bg`, `--mari-chat-text`,
`--mari-chat-radius`, `--mari-chat-font-family`) switches on the matching chat-surface styling by
itself; users don't need the "Apply preset …" switches for a theme's chat colours to show.

## Day and night

Settings > Appearance > Color Scheme can follow the system or the time of day (Light from 07:00,
Dark from 19:00 by default, both adjustable). Either way it only switches `data-theme` on `<html>`,
so a theme gets a day and a night look by styling both:

```css
:root[data-theme="light"] {
  --mari-app-backdrop: url("theme:day.webp");
}
:root[data-theme="dark"] {
  --mari-app-backdrop: url("theme:night.webp");
}
```

The scheme is worked out on each device by its own clock (it isn't synced), so a phone and a PC in
different places each show the right half. A theme file can suggest the switch itself:
`"settings": { "colorScheme": "time", "dayStart": "07:00", "nightStart": "19:00" }` (or
`"system"`). The import preview offers it like any other setting.

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
  "images": [{ "name": "frame.webp", "src": "data:image/webp;base64,…" }],
  "backgrounds": [{ "name": "forest.webp", "src": "data:image/webp;base64,…" }],
  "css": ":root { --primary: #3fae7a; }"
}
```

Credits (v1.5) go in the same file and show in the theme list (the (i) button) and the import
preview:

```json
{
  "license": "CC BY 4.0",
  "labels": ["High legibility", "No motion"],
  "credits": [{ "what": "Backdrops", "by": "Jane Doe", "license": "CC BY 4.0", "url": "https://example.com" }],
  "fonts": [{ "family": "My Display", "src": "…", "license": "OFL-1.1", "credit": "Fraunces by Undercase Type" }]
}
```

`labels` are up to four short tags (40 characters each) shown under the theme's name. A font or
credit licensed `OFL-1.1` links to the SIL Open Font License text the app ships. Pictures larger
than 1920 px wide (or 2560 px on the long side) are scaled down when the theme is imported.

Only `kind`, `name` and `css` are required. `templates` is described under Message template. `settings` keys: `colorScheme` (`dark`, `light`, `time` or `system`), `dayStart`, `nightStart`, `visualStyle`, `accent`,
`accentLight`, `background`, `backgroundLight`, `fontFamily`, `accentPulse`, `fontSize` (Display
Size in px: 12, 14, 16, 17, 19, 22, 26, 30 or 34) and `reduceMotion` (true or false). Importing shows a
preview first with the suggested settings ticked, except Visual Style, Accent Pulse, Display Size and
Reduce motion, which the user ticks if they want them, and the user picks whether to add the
backgrounds to their gallery. Pictures under 4 KiB stay inline and show as one "small icons" chip.
Fonts load with the theme (as `@font-face` rules) and go away with it. Importing a theme with the same
name as an installed one offers to update it, and an update doesn't add the same background to the
gallery twice. The CSS limit is 256 KiB of CSS text; pictures, thumbnail, fonts and backgrounds
together get 6 MiB. A picture that doesn't fit is left out on its own, with its size, and the rest
of the theme still installs. Plain `.css` files, `{ "name", "css" }` and the older
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

With art, three more choices win over a theme:

- **Theme art strength** (0-100%) fades the backdrop and the ambient overlay.
- **High contrast** also makes surfaces solid in the scheme's own colours (`--background`, `--card`,
  `--popover`, `--sidebar`, `--secondary`, `--muted`, `--mari-rp-bubble-bg`, the page veil, the Home
  wash, Home widgets and the top bar plate) and keeps theme art at 25% or less, so text never sits on
  a pastel picture. Colours a theme writes as literals on its own selectors aren't changed, so
  prefer the tokens.
- **Reduce motion** shows moving pictures as their first frame and stops the ambient overlay.
  Forced colours (Windows High Contrast) hide the art and `border-image` frames.

Use the status and gauge tokens above rather than fixed greens and reds, and the colour-blind-safe
switch reaches your theme too. Skip links (`.mari-skip-link`) stay reachable whatever a theme does.
The import preview tells the user when a theme tries to change any of these.

## Safety

- The top bar (including its fullscreen auto-hide state), the chats sidebar and its chat rows, the
  Library sidebar, Ctrl+K and the message box can be restyled, not hidden, moved, covered, faded,
  filtered away or made unclickable. The guard measures them with and without the theme after the
  theme loads, at 2.5 s and 10 s, when a chat opens, when a panel opens, when the colour scheme
  changes, on resize and when one of the theme's own animations starts or ends, and switches a
  theme off in that tab when it breaks one.
- Pictures count (guard v3). Whatever is painted over a tab, an icon, a chat row or the message
  box is found at the control's centre, `pointer-events: none` or not and at any size, and a layer
  that hides it (a colour, a gradient, or a picture whose pixels there are mostly opaque) counts as
  covering. So do a `border-image` outset that spills over a control and a picture `mask` on one.
  Inside the top bar, every `::before` and `::after` is stacked under the labels and icons, and
  masks, `list-style-image` and `border-image-outset` don't apply. The backdrop and the ambient
  overlay never count: they sit under the bars by construction.
- Guard v4 (round 4). Contrast reads the layers behind text in paint order (a `border-image`
  fill, then each background layer from the top, then the colour), weighs each by the part of the
  text it actually covers (size, position and repeat), and samples a picture only under the text.
  A thin rule or a small corner ornament no longer counts, and a dark veil over a light page is
  read as dark. The top bar and the message box are checked more strictly: their text must keep
  3:1 at its worst spot when it had that before. A picture on a control's own `::before` or
  `::after` that covers the control counts as covering it, in the top bar, the chat rows and the
  message box. A `position: fixed` picture on a pseudo-element gets a warning in the editor; use
  `position: absolute`, `--mari-ambient` or `--mari-app-backdrop` instead. When top-bar art is
  found on a pseudo-element, the tabs and icons get their plates as with `--mari-top-bar-bg`.
- Contrast over art: when a picture is behind text, the guard reads the picture's colours instead
  of skipping the check.
- Chat text (v1.5): the guard samples the last few lines on screen in the chat and switches the theme
  off when it paints over half of them (a pseudo-element cover, a solid ambient behind the cards, or a
  focus frame whose outset spills over the text). A line the theme's own layout moves off screen
  doesn't count, and neither does a name line the theme pins over the reply.
- Text a theme adds with `content:` is shown in the import preview.
- Theme text rules (security audit, Nov 2026). Every string a theme can draw is checked before the
  theme is applied, wherever it came from (a file, the editor, Mari, a backup, a per-chat pick):
  `content:` and `quotes` strings, custom properties (so `content: var(--x)` counts),
  `@counter-style` symbols, the message box placeholder, message templates (words and `title`) and
  the text inside SVG pictures. Text that asks for keys, passwords, sign-ins or account details,
  pretends to be the app ("hacked", "RCE", "security alert", "verified by Marinara", "call
  support"), holds a phone number or a web address, or runs past 80 letters and digits in one
  declaration is refused: the theme can't be installed, and an installed one isn't applied. Look-alike
  letters, accents, zero-width characters, spacing and 1337 spelling are folded first. Strings in
  selectors, `font-family` and grid area names don't count. The theme's name, author, description
  and credits may not ask for secrets or claim to be official either (web addresses are fine there).
- URLs: as well as the text sanitiser (url() allowlist, no `@import`, data: fonts only), the
  stylesheet is parsed by the browser before it is applied, and any address other than the theme's
  own pictures, embedded data: pictures and fonts, `#fragments` and `about:invalid` refuses the
  theme. `src()` follows the url() rules, and an `image-set(` left open at the end is dropped.
- Suggested colours in a theme file (`settings.accent`, `background` and their light twins) must be
  plain colours or gradients: no `url()`, `image-set()` or anything that breaks out of the value.
- SVG pictures are rebuilt from an allowlist before use: no `<script>`, `<foreignObject>`, `<a>`,
  event attributes, outside links, `<?xml-stylesheet?>` or DOCTYPE entities, and their CSS is
  cleaned like a theme's. Raster pictures that would decode past 8192 px a side or 40 megapixels
  are refused.
- Message templates can't use roles that make a dialog, menu or announcement, nor the app's own
  `data-` attributes or `mari-`/`ov-` class names.
- Trying a theme ("Keep this theme?") happens in that tab only: other devices get it only after
  Keep. Unanswered means going back; hovering or focusing the bar pauses the countdown. Escape three
  times turns custom themes off in the tab; an Escape that closes Ctrl+K, a menu or a dialog the
  app shows doesn't count.

## Changes

- **v1.5** (theming round 5, long replies): `--mari-chat-column`, `--mari-message-measure`,
  `--mari-chat-line-height`, `--mari-dialogue-weight`, `--mari-paragraph-gap`, pinned speaker,
  `--mari-phone-avatar`, VN text box parts and fade, `--mari-message-actions`,
  `--mari-swipe-counter`, `--mari-card-art-placeholder`, `--mari-chat-row-art-opacity`,
  `--mari-focus-frame-outset`, `--mari-scrim` and `--mari-center-x`; dialogue, paragraph-gap,
  card-art and chat-row-art parts and avatar placeholders everywhere; window titles on narration,
  Ctrl+K, windows and dialogs; the chrome accent reaches root-scoped chrome; guard checks chat text;
  theme credits, licence and labels, with the OFL text shipped; big pictures shrink on import.

- **v1.4** (theming round 4): guard v4 (layered backgrounds, painted area, strict top bar and
  message box, pseudo-element covers); `fontSize` and `reduceMotion` in theme files and the
  import preview ticking suggested settings; tokens for message times, the roleplay wash, chrome
  accent and muted text, Library and Ctrl+K colours, Combat, toasts, lorebook dots, Home shortcuts,
  a text-size floor and the user avatar; `--mari-top-bar-height` and `--mari-top-bar-plate-active`;
  time, chat-header, game-hud, game-tools, avatar-placeholder and home-widget-glow parts; focus
  frame, window title, ambient behind cards and gutter mask slots.

- **v1.3** (theming round 3, pictures): `images` in the theme file and `url("theme:name")`; the
  CSS limit counts CSS text only; WebP on import; backdrop on its own layer; `--mari-page-veil`
  kept over a backdrop; `!important` shorthands with `var()` kept; ambient overlay; picture icons
  and cursor; `--mari-home-wash`, `--mari-home-art` and more Home widget tokens; VN dialogue, VN
  sprite slot and Game narration hooks; theme files can suggest Follow time of day; guard v3.

- **v1.1**: message hooks in every chat mode with character, index and generation time; avatar,
  header, actions and reasoning parts; `--mari-composer-placeholder`; backdrop v2 (size, position,
  repeat, pixelated, layers) that also shows behind chats; `--mari-page-veil`; `--mari-top-bar-bg`;
  `--mari-text-outline`, `--mari-dialogue-color`, `--mari-chat-font-size`, `--mari-msg-head-rule`;
  Home widget tokens, with Professor Mari as a `home-widget`. `--mari-stage-empty-bg` is now a
  `background` (gradients work).
- **v1.2**: message template slot (`templates` in the theme file, `[data-mari-part="message-extra"]`),
  opt-in for users with "Allow themes with HTML".

- **v1.0.1**: guard v2, protected Accessibility values, added-text checks. Install is all-or-nothing,
  bundled backgrounds install, Go back also restores the settings a theme applied, theme fonts show
  in the Font list, `url(#id)` references are kept, and bundled font names are read from the font.
- **v1** (first published contract): theme tokens, part hooks, backdrop and accent effects above.
