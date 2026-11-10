# Custom CSS Themes

A theme changes the whole look of Marinara: colors, fonts, pictures and the shape of panels. Marinara has a gallery of ready-made starter themes you can download. You can also import a theme someone shared, or make your own.

For a quick change with no theme at all, see [Appearance Settings](appearance-settings.md) or [Ready-made chat window styles](#ready-made-chat-window-styles). To make your own theme, the [Theme Author Guide](theme-author-guide.md) walks you through it step by step.

## What a custom theme is

A theme is a block of CSS, the code web pages use for colors, fonts and spacing, plus any pictures and fonts it brings along. Themes are saved on your Marinara server, so a theme you install shows up on every device that connects to it. Only one theme is on at a time, and you can keep as many as you like.

## Where to find themes

Open **Library → Settings → Appearance** and click **CSS Themes** in the row of sections. In the classic layout it is **Settings → Addons → Theme Library**.

The section has:

- **Create Theme** and **Import File** at the top.
- **Allow themes with HTML (I accept the risk)**, off by default. See [Themes with HTML](#themes-with-html).
- **Installed Themes**: **Default Theme**, then your own themes, then the starter themes you downloaded.
- **Browse the theme gallery**: the starter themes you can download.

## Starter themes

Starter themes aren't part of the install, so they take no space until you want one. They live in the theme gallery, and Marinara downloads a theme only when you pick it.

1. Click **Browse the theme gallery** under **Installed Themes**. Marinara needs an internet connection for this.
2. Each theme shows a preview, a short description, its size and its tags.
3. Click **Download** next to the ones you like. They appear under **Starter themes** in **Installed Themes**, ready to switch on.

| Theme | Look |
| --- | --- |
| **Apogee Lounge** | The observation lounge of a 1970s space liner, with a gas giant through the window and messages on moulded panels. |
| **Dewglass** | Glossy 2000s glass: messages are gel droplets over a sunny lagoon or an aurora night. |
| **Granite Watch** | A Cold War command post under the mountain: replies print as teleprinter paper and widgets hang on clipboards. |
| **Gutterlight** | A rainy gothic city drawn as a crime comic, with inked panels and caption boxes. |
| **Lantern Meadow** | Calm and very readable, with no motion. |
| **Lantern Path** | A reading column with gentle motion. |
| **Maple's Bramble Cottage** | A cozy cottage, with a reading column for long replies. |
| **NEON//GRID** | Neon cyberpunk, made for long replies. |
| **Petal OS** | A playful retro desktop with pixel fonts. |
| **Rosalind's Folio** | A storybook layout with visual novel touches. |
| **Swiss Poster** | Quiet, clean poster design with no motion. |
| **Under Sail** | The deck of a sailing ship at sea: every message is a canvas sail hung from a timber yard. |
| **Velvet Casket** | Pastel goth by day and traditional goth by night, with coffin-shaped messages. |

Every starter theme has a Dark and a Light version. The small tags under each name, such as **No motion** or **High legibility**, tell you what to expect.

When the gallery has a newer version of a theme you downloaded, the theme shows **Update** in the gallery list. Click it to get the new version.

Downloaded starter themes are read-only, so they always stay as they were made. Each has four buttons:

- **(i) Credits and licences**: who made the art and fonts, and how you may reuse them.
- **Clone + Edit** (the copy icon): makes your own copy, such as "Petal OS (my copy)", and opens it in the editor.
- **Export** (the upload icon): saves the theme as a file.
- **Remove** (the bin icon): removes the theme from this install. You can download it again from the gallery any time.

You can also get the theme files without the app: they're in the `themes` folder of the theme gallery on GitHub ([kolacheee-themes branch](https://github.com/kolacheee/Marinara-Engine-kolacheee/tree/kolacheee-themes/themes)). Download a `.json` file there and use **Import File**.

## Activating a theme

1. Click a theme's name in **Installed Themes**. The theme turns on in this browser tab.
2. A bar asks **Keep this theme?** and counts down from 15 seconds. Pointing at the bar pauses the countdown.
3. Click **Keep theme** to keep it. It now shows on your other devices too. Click **Go back**, or let the countdown run out, to return to your previous look.

Click **Default Theme** to turn custom themes off. **Reset Appearance**, at the top of **Settings → Appearance → Theme**, also turns the theme off.

To use a different theme on one device only, set **Look on this device** to **Only this device** in **Settings → Appearance → Theme** first.

### Getting your normal look back

If a theme makes Marinara hard to use, any of these turns it off in that tab:

- Press <kbd>Esc</kbd> three times.
- Add `?safe` to the end of the address in your browser.
- Press <kbd>Ctrl</kbd>+<kbd>K</kbd> and type "Custom theme".

Marinara also guards the top bar, the sidebars, <kbd>Ctrl</kbd>+<kbd>K</kbd> and the message box. A theme can restyle them, but if it hides, moves or covers one, Marinara switches the theme off in that tab and tells you why.

## Importing a theme

1. Click **Import File**.
2. Choose a `.json` or `.css` theme file.
3. A preview shows the theme's name, author, version, pictures and size, and its credits and license. It lists anything to know before you install, such as moving pictures, text the theme adds, or parts that won't work.
4. Choose what to bring along. The preview offers the theme's suggested settings, such as its color scheme, accent color and font, with most of them ticked. It can also add the theme's backgrounds to your chat background gallery.
5. Click **Install and try it** to switch to it straight away, or **Install** to add it to the list.

If you already have a theme with the same name, the preview offers to update it or **Keep both**. When you go back from a theme you are trying, Marinara also puts back any settings it changed.

A theme can't be installed if it writes text that asks for passwords or keys, or pretends to be Marinara. Never type a key or password because a theme asks for it.

### Themes with HTML

Some themes add a small HTML box to every message, called a message template. Marinara removes scripts, links, images and forms from it, but HTML from someone else could still mislead you. These themes install only while **Allow themes with HTML (I accept the risk)** is on. With the switch off, an installed theme shows without its HTML.

## Creating a theme

Click **Create Theme**, or **Clone + Edit** on a starter theme to start from something that already looks good. The editor has a name box, a large CSS box, **Preview** and **Save**. A new theme turns on when you save it, and asks **Keep this theme?**

The [Theme Author Guide](theme-author-guide.md#your-first-theme-step-by-step) has a step-by-step walkthrough for your first theme.

## Editing, exporting and removing your themes

Your own themes have three buttons on their row:

- **Edit theme CSS** (the code icon) opens the editor. Editing does not change which theme is on.
- **Export** (the upload icon) downloads a `.json` file you can share or import elsewhere.
- **Remove** (the trash icon) deletes the theme after you confirm. This cannot be undone, so export it first if you might want it later.

## A theme for one chat

A chat can have its own theme:

1. Open the chat and open **Chat Settings**.
2. In **Theme**, pick a theme. **Follow the app** uses your app theme, and **Default look (no custom theme)** turns themes off for that chat.
3. In a chat with one character, tick **Use it for every chat with this character** to make it that character's theme.

Settings and the Library always use the app theme.

## Who can change themes

On the computer that runs Marinara, no secret is needed. From another device, such as a phone, creating, importing, cloning, editing and removing themes needs the admin secret. Enter it in **Settings → Advanced → Security**. Picking a theme someone already installed needs no secret. See [The admin secret](../REMOTE_ACCESS.md#the-admin-secret-and-privileged-actions).

## Ready-made chat window styles

Before you start: this needs no CSS.

1. Open **Settings → Appearance → Chat Buttons & Windows**.
2. Under **Chat widget style**, pick a style.

| Style          | Look                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Default**    | The original look.                                                                                                                |
| **Dottore**    | Icy blue instrument frames, pale metal edges and cut corners.                                                                     |
| **Prof. Mari** | Gold-trimmed storybook frames, gemstone blues and Primogems on window titles. Its buttons use the same background as its windows. |

Each style has its own font, works in light and dark mode, and styles buttons, windows and expandable sections together. Choosing a style resets **Font**, **Shape** and all three colors. Your window positions stay.

You can change these separately:

- **Font** and **Shape** follow the style (**Preset font**, **Preset shape**) until you pick another.
- **Border & Buttons Color** changes outlines and button icons. Icons use the first color of a gradient.
- **Background Color** fills buttons, windows, expandable sections and editable fields.
- **Text Color** changes widget text. Gradients appear on headings and labels, and editable fields use the first color.

Each color has a color picker for a solid color and a gradient option. **Reset color** beside a control follows the style's light or dark colors again. Decorative crests keep their original colors.

### Carry the style into the chat

Three switches below the color pickers extend the style. Each starts off and works on its own. Turning one off restores the usual chat styling for that part, and choosing another style keeps your switch choices.

| Switch                  | What it applies                                                                                                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Apply preset font**   | The widget font, for messages, input boxes and chat controls.                                                                                                                                                                                                                                                        |
| **Apply preset shape**  | The frame shape, for Roleplay messages (classic and visual novel), the Game dialogue box, input boxes and controls. Conversation messages keep their own shape.                                                                                                                                                      |
| **Apply preset colors** | The border, background and text colors for those areas, including Conversation messages. Your custom colors and gradients apply too. Quoted dialogue keeps each character's or persona's own Dialogue Highlight Color. A message made of HTML, such as an agent's styled card, keeps the text colors it sets itself. |

The history buttons (**Load More**, **Show older**) follow the switches like other chat controls. In Game Mode they also cover side remarks, HUD widgets, the map panel, character sheets, logs, the Inventory, combat panels and dialogs. Professor Mari can create custom themes for these areas too.

A custom theme can still override the styles. The window and drawer variables in [Styling chat windows and drawers](#styling-chat-windows-and-drawers) take precedence over the style's colors. Use `--mari-window-font-family` for window lettering, `--mari-drawer-radius` for section corners, and `--mari-window-ornament: none` to hide the title ornament. To remove all style decoration, choose **Default** first.

## For theme authors

The rest of this guide is reference material for people who write theme CSS by hand. Start with the [Theme Author Guide](theme-author-guide.md), which lists every stable token, part hook and safety rule.

## Themes and Card CSS

Marinara has two ways to add custom CSS, and both can be active at once.

- A custom theme repaints the whole app. It may override Marinara's core variables, use `!important` and use `position: fixed`.
- Card CSS is embedded in a character or persona card and turned on per chat. It is cleaned more strictly: it cannot override core variables, `!important` is stripped, and `position: fixed` becomes `position: absolute`. It styles chat messages, not the whole app. See the [Card CSS Theming Guide](card-css-theming.md).

## Size and name limits

A theme name can be up to 200 characters. The CSS can be up to 256 KiB, measured in UTF-8 bytes. A larger theme is rejected when you save or import it. Custom theme CSS is also cleaned before it runs: styles that load a file from another website do not work. Embed an image or font as a `data:` URI instead.

## The CSS variable reference

The theme editor has a collapsible **CSS Variable Reference**. Click it to see the most useful variables you can override. A theme changes the app by setting these variables in a `:root` block. The reference lists these variables:

| Variable                       | What it controls          |
| ------------------------------ | ------------------------- |
| `--background`                 | Page background           |
| `--foreground`                 | Main text                 |
| `--primary`                    | Accent and buttons        |
| `--primary-foreground`         | Text on primary           |
| `--secondary`                  | Cards and inputs          |
| `--card`                       | Card background           |
| `--border`                     | Borders                   |
| `--muted-foreground`           | Dimmed text               |
| `--sidebar`                    | Sidebar background        |
| `--sidebar-border`             | Sidebar border            |
| `--marinara-shell-edge-border` | Left and right shell edge |
| `--destructive`                | Error and delete          |
| `--popover`                    | Dropdown background       |
| `--accent`                     | Hover highlights          |

A theme can set any CSS variable Marinara uses, not only these. Some effects have their own variables. For example, `--marinara-theme-accent-pulse: enabled` requests the accent pulse animation.

## Styling chat windows and drawers

On a computer, **Chat Settings** opens as a movable window. Its collapsible sections are called **drawers**. A drawer can pop out into its own window, then minimize to a small movable button, called a **bubble**.

Other chat tools use these windows and buttons too, including Game controls, Session, Volume, Game Assets, connected chats and package controls. On a phone, most windows open as full-width panels; Echo Chamber stays a compact window that you can move and resize. Tools moved out of Chat Settings are listed in the movable **Chat tools** three-dot menu; tracker buttons stay separate.

The classes, data attributes and variables below let a theme style these parts together. Your theme's rules override the defaults without `!important`.

### Classes

| Part                                                                                            | Class                                                             |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Window                                                                                          | `.mari-window`                                                    |
| Title bar                                                                                       | `.mari-window__header`                                            |
| Title and its icon                                                                              | `.mari-window__title-row`                                         |
| Title                                                                                           | `.mari-window__title`                                             |
| Title bar buttons (Reset View, favorite layout star, Tracker Panel, pin, lock, close, Put back) | `.mari-window__controls` (each button is `.mari-window__control`) |
| Window content                                                                                  | `.mari-window__body`                                              |
| Resize edges and corners                                                                        | `.mari-window__resize-handle`                                     |
| The corner mark shown while the pointer or focus is in a window                                 | `.mari-window__resize-grip`                                       |
| Drawer                                                                                          | `.mari-drawer`                                                    |
| Drawer header and title                                                                         | `.mari-drawer__header`, `.mari-drawer__title`                     |
| Drawer icon, count badge and **?**                                                              | `.mari-drawer__icon`, `.mari-drawer__count`, `.mari-drawer__help` |
| A collapsed drawer's preview (a tracker's small widget)                                         | `.mari-drawer__summary`                                           |
| Drawer buttons beside the arrow, and the pop-out button                                         | `.mari-drawer__actions`, `.mari-drawer__popout`                   |
| Drawer arrow and content                                                                        | `.mari-drawer__arrow`, `.mari-drawer__body`                       |
| The preview that follows the pointer while a drawer is dragged out                              | `.mari-drawer-ghost`                                              |
| A minimized window's button (bubble)                                                            | `.mari-window-bubble`                                             |
| The live summary a bubble shows instead of its icon (World State's banner)                      | `.mari-window-bubble__banner`                                     |
| The line shown while a dragged bubble lines up with another                                     | `.mari-window-snap-guide`                                         |
| The dot shown while agents run (Chat Settings button, Trackers window)                          | `.mari-agents-running-dot`                                        |

### Data attributes

- `data-window` names a window and its bubble: `chat-settings`, `trackers`, the control windows `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` and `control:beholder:<package>`, and `drawer:<window>:<drawer>` for a popped-out drawer, for example `drawer:chat-settings:chat-name`.
- `data-drawer` names a drawer, for example `chat-name`. Some names start with the chat mode, such as `roleplay-agents` or `conversation-agents`. Trackers use `tracker-world`, `tracker-persona`, `tracker-characters`, `tracker-quests`, `tracker-inventory`, `tracker-custom` and `agent-activity`.
- `data-presentation` is `"window"` on a desktop window or `"sheet"` on a phone panel.
- `data-pinned` and `data-locked` are `"true"` while the window is pinned or locked.
- `data-window-control` names each title bar button: `"pin"`, `"lock"`, `"close"` or `"put-back"`. A pressed pin or lock button also has `aria-pressed="true"`.
- `data-chat-settings-control` identifies Chat Settings' extra title bar buttons: `"reset-view"`, `"favorite-layout"` and `"tracker-panel"`. The favorite star has `aria-pressed="true"` and a filled icon when the current layout matches the saved favorite.
- `data-edge` is `"n"`, `"s"`, `"e"`, `"w"`, `"ne"`, `"nw"`, `"se"` or `"sw"` on each resize handle.
- An open drawer's toggle button inside `.mari-drawer__header` has `aria-expanded="true"`.
- `data-drawer-control="pop-out"` marks a drawer's pop-out button.
- `data-outside="true"` marks a drag preview that is far enough outside its window to pop out when dropped.
- `data-axis` is `"x"` on a snap guide that runs up and down, and `"y"` on one that runs across.
- `data-detached` is `"true"` when a drawer is shown in its own window, on both that window and the drawer inside it. A popped-out drawer's window is named `data-window="drawer:<window>:<drawer>"`, for example `data-window="drawer:chat-settings:chat-name"`, and `data-drawer-host` names the window it came from.
- `data-dragging` is `"true"` on a drawer while its title is dragged, and `data-drop-target` is `"true"` on a window while a popped-out drawer is held over it, ready to go back.
- A bubble has the `data-window` of its window and `data-minimized="true"`, for example `.mari-window-bubble[data-window="control:volume"]`. Control windows are named `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` and `control:beholder:<package>`. `data-dragging` is `"true"` on a bubble while it is dragged. A bubble that shows a live summary instead of its icon, such as a minimized World State tracker, has `data-banner="true"` and grows as wide as the summary.
- A locked bubble has `data-locked="true"`, including the Chat Settings button. It still opens its window, but cannot be moved until the window is unlocked. Use `.mari-window-bubble[data-locked="true"]` to give these buttons a distinct appearance.
- On a phone, windows have `data-presentation="sheet"`, and so do their bubbles, which are slightly larger. The Tracker Panel's bubble is `.mari-window-bubble[data-tracker-panel-toggle="bubble"]`.
- The Chat Settings button is a bubble too: `.mari-window-bubble[data-chat-settings-button]`, with `data-open="true"` while Chat Settings is open.
- A popped-out section shrinks to a bubble with `data-drawer-host` (the window it came from), and its window's **Put back** button is `[data-window-control="put-back"]`.

### Variables

Each variable falls back to the shared chat chrome colors, so a theme only needs the ones it wants to change.

| Variable                                                                                                 | What it controls                                                               |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `--mari-window-bg`                                                                                       | Window background                                                              |
| `--mari-window-text`                                                                                     | Window text                                                                    |
| `--mari-window-border`, `--mari-window-border-width`                                                     | Window border                                                                  |
| `--mari-window-radius`                                                                                   | Window corner rounding                                                         |
| `--mari-window-shadow`                                                                                   | Window shadow                                                                  |
| `--mari-window-backdrop-filter`                                                                          | Blur behind the window                                                         |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border`                    | Title bar colors                                                               |
| `--mari-window-header-padding`                                                                           | Title bar spacing                                                              |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover`     | Title bar buttons, including the favorite star                                 |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active`                                  | Pressed title bar buttons, including pin, lock and a filled favorite star      |
| `--mari-window-control-radius`, `--mari-window-control-gap`                                              | Button rounding and spacing                                                    |
| `--mari-window-focus-ring`                                                                               | Keyboard focus outline, and the outline of a window a drawer will go back into |
| `--mari-window-resize-handle-size`                                                                       | Width of the resize edges                                                      |
| `--mari-window-bubble-size`, `--mari-window-bubble-radius`, `--mari-window-bubble-shadow`                | Bubble size, rounding and shadow                                               |
| `--mari-window-bubble-bg`, `--mari-window-bubble-bg-hover`, `--mari-window-bubble-border`                | Bubble background and border                                                   |
| `--mari-window-bubble-text`, `--mari-window-bubble-text-hover`                                           | Bubble icon color                                                              |
| `--mari-window-snap-guide`                                                                               | Snap guide color                                                               |
| `--mari-drawer-bg`, `--mari-drawer-border`                                                               | Drawer background and divider                                                  |
| `--mari-drawer-header-bg`, `--mari-drawer-header-bg-hover`                                               | Drawer header colors                                                           |
| `--mari-drawer-header-padding`, `--mari-drawer-body-padding-inline`, `--mari-drawer-body-padding-bottom` | Drawer spacing                                                                 |
| `--mari-drawer-title-color`, `--mari-drawer-icon-color`, `--mari-drawer-arrow-color`                     | Drawer header text and icons                                                   |
| `--mari-drawer-count-bg`, `--mari-drawer-count-text`                                                     | The count badge on a drawer                                                    |

Set a variable in `:root` to change every window, or on a selector to change one:

```css
:root {
  --mari-window-radius: 0.5rem;
  --mari-window-bubble-bg: #3b0764;
}

[data-window="chat-settings"] .mari-drawer[data-drawer="chat-name"] {
  --mari-drawer-border: transparent;
}
```

## Styling messages, input boxes and chat controls

The three **Apply preset** switches also let a custom theme use the widget design in the rest of the chat. A theme can override each part with the variables below. Ask Professor Mari for a matching chat theme if you would rather not write CSS yourself.

| Part                                                                                                                                                                                      | Class                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Roleplay and Game message boxes, Game side remarks, HUD widgets, map panel and character sheets, and chat input boxes                                                                     | `.mari-chat-style-surface`                   |
| Game logs, Inventory, combat panels, choices and dialogs; the panels also have `data-game-section` with their name, such as `logs`, `inventory` or `combat-actions`                       | `.mari-game-section.mari-chat-style-surface` |
| Game content in a window, such as the Journal, which follows the window's colors                                                                                                          | `.mari-game-section`                         |
| Conversation messages (font and colors only)                                                                                                                                              | `.mari-chat-style-conversation`              |
| Unboxed Conversation message text                                                                                                                                                         | `.mari-chat-style-text`                      |
| Chat controls, including Calls and Conversation group controls                                                                                                                            | `.mari-chat-style-control`                   |
| History buttons: **Load More**, **Show older**, **Show newer**, **Latest**, and the Game logs' **Older**, **All** and **Show more older logs**. They also have `.mari-chat-style-control` | `.mari-chat-history-pager`                   |
| A message made of HTML, such as an agent's styled card. Text colors set inside it are kept when **Apply preset colors** is on                                                             | `.mari-html-content`                         |

| Variable                                                  | What it controls                            |
| --------------------------------------------------------- | ------------------------------------------- |
| `--mari-chat-font-family`                                 | Font for the matching chat areas            |
| `--mari-chat-bg`                                          | Box background; accepts a color or gradient |
| `--mari-chat-text`                                        | Readable solid text color                   |
| `--mari-chat-border`                                      | Box outline; accepts a color or gradient    |
| `--mari-chat-border-color`                                | Solid border fallback                       |
| `--mari-chat-radius`                                      | Box rounding, except Conversation messages  |
| `--mari-chat-control-bg`, `--mari-chat-control-bg-hover`  | Chat button backgrounds                     |
| `--mari-chat-control-color`, `--mari-chat-control-radius` | Chat button icon color and rounding         |
| `--mari-chat-input-bg`                                    | Background inside editable fields           |

For example, with **Apply preset font** and **Apply preset colors** on:

```css
:root {
  --mari-chat-font-family: Georgia, serif;
  --mari-chat-bg: #251e29;
  --mari-chat-text: #f4e8dc;
  --mari-chat-border: linear-gradient(100deg, #d6aa66, #dda0b2);
}
```

Unset variables follow the widget settings and preset. The matching switch must be on for these variables to apply through the built-in styling. Conversation messages keep their own shape even when **Apply preset shape** is on. Custom themes can also target the classes directly; keep focus outlines, menus and message content outside any decorative clipping.

On phones, the three-dot menu expands into round buttons. Its trigger is `[data-chat-tools-menu-button]`, the open stack is `[data-chat-tools-menu]`, and each list item has `data-chat-tools-menu-item` set to its window ID. Tool buttons use `.mari-window-bubble.mari-chat-tools-button` and `data-chat-tools-menu-tool` with that same ID. The stack has no window frame; its buttons follow widget colors and button size, independently of the three switches for the rest of the chat, while keeping their round shape.

## Related guides

- [Theme Author Guide](theme-author-guide.md)
- [Weather in Your Theme](theme-weather.md)
- [Card CSS Theming Guide](card-css-theming.md)
- [Appearance Settings](appearance-settings.md)
- [Server Configuration Reference](../CONFIGURATION.md)
- [Remote Access](../REMOTE_ACCESS.md)
