# Custom CSS Themes (Theme Library)

A custom CSS theme repaints the whole of Marinara. Use the **Theme Library** to create, import, export and switch themes. This guide also lists the CSS variables and classes a theme can use, and explains how themes work with Card CSS. For a quick change with no CSS, see [Ready-made chat window styles](#ready-made-chat-window-styles).

Before you start: if you open Marinara from another device, such as a phone, the server needs an admin secret before you can create, edit, import, activate or remove themes. On the computer that runs the server, no secret is needed.

1. On the server, set `ADMIN_SECRET` in the `.env` file.
2. In the app, open **Settings → Advanced → Admin Access** and enter the same value.

See the [Server Configuration Reference](../CONFIGURATION.md) and the [Remote Access guide](../REMOTE_ACCESS.md). To switch to a theme someone gave you, go to [Activating a theme](#activating-a-theme).

## What a custom theme is

CSS, short for Cascading Style Sheets, is the code that sets colors, borders and spacing. A theme is a block of CSS that can change the page background, accent color, cards, borders, text and more.

Themes live in the **Theme Library** on your Marinara server, so they sync to every device that connects to the same server. Most other appearance settings stay on one device. Only one theme can be active at a time, and you can keep as many as you like.

## Where to find the Theme Library

1. Open **Settings**.
2. Open the **Addons** tab.
3. Find the **Theme Library** section.

## Creating a theme

1. In the **Theme Library** section, click **Create Theme**.
2. Type a name in the name box (it shows "Theme name...").
3. Write or paste your CSS in the large text box.
4. Leave **Preview** on to see your changes live as you type. Turn it off to stop the live preview.
5. Click **Save**.

A new theme starts from a template that lists common variables as commented-out examples. Remove the comment marks and set your own values. A brand new theme is activated when you save it, and you see: Theme "My Theme" saved and activated.

To change a theme later, find it in **Installed Themes**, click the code icon (tooltip **Edit theme CSS**), edit, and click **Save**. Editing does not change which theme is active.

## Importing and exporting themes

To import a theme:

1. Click **Import File** in the **Theme Library** section.
2. Choose a `.css` or `.json` file.
3. Read the message. It reports how many themes were imported, skipped or failed.

A `.css` file becomes one theme, named after the file. A `.json` file can hold one or more themes. Import a file exported from Marinara as it is, or write a small one yourself:

```json
{ "name": "My Theme", "css": "..." }
```

Imported themes do not activate on their own. A theme with the same name and the same CSS as one already on the server is skipped.

To export a theme, click the upload icon (tooltip **Export theme**) on its row in **Installed Themes**. Marinara downloads a `.json` file you can import elsewhere.

## Activating a theme

**Installed Themes** lists every theme, with a **Default Theme** entry at the top.

1. Click a theme's name to make it active. A check mark shows the active one.
2. Click **Default Theme** to turn off custom theming and return to the built-in look.

**Reset Appearance**, at the top of **App Style** in **Settings → Appearance**, also turns off the active theme.

To delete a theme, click the trash icon (tooltip **Remove theme**) and confirm in the **Delete Theme** dialog. This permanently deletes its CSS from the server.

If it did not work: when the app looks wrong, check both the active theme and any Card CSS in the chat. See [Themes and Card CSS](#themes-and-card-css).

## Ready-made chat window styles

Before you start: this needs no CSS.

1. Open **Settings → Appearance → App**.
2. At the bottom of **App Style**, find **Chat widget style**.
3. Pick a style.

| Style | Look |
| --- | --- |
| **Default** | The original look. |
| **Dottore** | Icy blue instrument frames, pale metal edges and cut corners. |
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

| Switch | What it applies |
| --- | --- |
| **Apply preset font** | The widget font, for messages, input boxes and chat controls. |
| **Apply preset shape** | The frame shape, for Roleplay messages (classic and visual novel), the Game dialogue box, input boxes and controls. Conversation messages keep their own shape. |
| **Apply preset colors** | The border, background and text colors for those areas, including Conversation messages. Your custom colors and gradients apply too. Quoted dialogue keeps each character's or persona's own Dialogue Highlight Color. A message made of HTML, such as an agent's styled card, keeps the text colors it sets itself. |

The history buttons (**Load More**, **Show older**) follow the switches like other chat controls. In Game Mode they also cover side remarks, HUD widgets, the map panel, character sheets, logs, the Inventory, combat panels and dialogs. Professor Mari can create custom themes for these areas too.

A custom theme can still override the styles. The window and drawer variables below take precedence over the style's colors. Use `--mari-window-font-family` for window lettering, `--mari-drawer-radius` for section corners, and `--mari-window-ornament: none` to hide the title ornament. To remove all style decoration, choose **Default** first.

## Themes and Card CSS

Marinara has two ways to add custom CSS, and both can be active at once.

- A custom theme repaints the whole app. It may override Marinara's core variables, use `!important` and use `position: fixed`.
- Card CSS is embedded in a character or persona card and turned on per chat. It is cleaned more strictly: it cannot override core variables, `!important` is stripped, and `position: fixed` becomes `position: absolute`. It styles chat messages, not the whole app. See the [Card CSS Theming Guide](card-css-theming.md).

## Size and name limits

A theme name can be up to 200 characters. The CSS can be up to 256 KiB, measured in UTF-8 bytes. A larger theme is rejected when you save or import it. Custom theme CSS is also cleaned before it runs: styles that load a file from another website do not work. Embed an image or font as a `data:` URI instead.

## The CSS variable reference

The theme editor has a collapsible **CSS Variable Reference**. Click it to see the most useful variables you can override. A theme changes the app by setting these variables in a `:root` block. The reference lists these variables:

| Variable | What it controls |
| --- | --- |
| `--background` | Page background |
| `--foreground` | Main text |
| `--primary` | Accent and buttons |
| `--primary-foreground` | Text on primary |
| `--secondary` | Cards and inputs |
| `--card` | Card background |
| `--border` | Borders |
| `--muted-foreground` | Dimmed text |
| `--sidebar` | Sidebar background |
| `--sidebar-border` | Sidebar border |
| `--marinara-shell-edge-border` | Left and right shell edge |
| `--destructive` | Error and delete |
| `--popover` | Dropdown background |
| `--accent` | Hover highlights |

A theme can set any CSS variable Marinara uses, not only these. Some effects have their own variables. For example, `--marinara-theme-accent-pulse: enabled` requests the accent pulse animation.

## Styling chat windows and drawers

On a computer, **Chat Settings** opens as a movable window. Its collapsible sections are called **drawers**. A drawer can pop out into its own window, then minimize to a small movable button, called a **bubble**.

Other chat tools use these windows and buttons too, including Game controls, Session, Volume, Game Assets, connected chats and package controls. On a phone, most windows open as full-width panels; Echo Chamber stays a compact window that you can move and resize. Tools moved out of Chat Settings are listed in the movable **Chat tools** three-dot menu; tracker buttons stay separate.

The classes, data attributes and variables below let a theme style these parts together. Your theme's rules override the defaults without `!important`.

### Classes

| Part | Class |
| --- | --- |
| Window | `.mari-window` |
| Title bar | `.mari-window__header` |
| Title and its icon | `.mari-window__title-row` |
| Title | `.mari-window__title` |
| Title bar buttons (Reset View, favorite layout star, Tracker Panel, pin, lock, close, Put back) | `.mari-window__controls` (each button is `.mari-window__control`) |
| Window content | `.mari-window__body` |
| Resize edges and corners | `.mari-window__resize-handle` |
| The corner mark shown while the pointer or focus is in a window | `.mari-window__resize-grip` |
| Drawer | `.mari-drawer` |
| Drawer header and title | `.mari-drawer__header`, `.mari-drawer__title` |
| Drawer icon, count badge and **?** | `.mari-drawer__icon`, `.mari-drawer__count`, `.mari-drawer__help` |
| A collapsed drawer's preview (a tracker's small widget) | `.mari-drawer__summary` |
| Drawer buttons beside the arrow, and the pop-out button | `.mari-drawer__actions`, `.mari-drawer__popout` |
| Drawer arrow and content | `.mari-drawer__arrow`, `.mari-drawer__body` |
| The preview that follows the pointer while a drawer is dragged out | `.mari-drawer-ghost` |
| A minimized window's button (bubble) | `.mari-window-bubble` |
| The live summary a bubble shows instead of its icon (World State's banner) | `.mari-window-bubble__banner` |
| The line shown while a dragged bubble lines up with another | `.mari-window-snap-guide` |
| The dot shown while agents run (Chat Settings button, Trackers window) | `.mari-agents-running-dot` |

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

| Variable | What it controls |
| --- | --- |
| `--mari-window-bg` | Window background |
| `--mari-window-text` | Window text |
| `--mari-window-border`, `--mari-window-border-width` | Window border |
| `--mari-window-radius` | Window corner rounding |
| `--mari-window-shadow` | Window shadow |
| `--mari-window-backdrop-filter` | Blur behind the window |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border` | Title bar colors |
| `--mari-window-header-padding` | Title bar spacing |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover` | Title bar buttons, including the favorite star |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active` | Pressed title bar buttons, including pin, lock and a filled favorite star |
| `--mari-window-control-radius`, `--mari-window-control-gap` | Button rounding and spacing |
| `--mari-window-focus-ring` | Keyboard focus outline, and the outline of a window a drawer will go back into |
| `--mari-window-resize-handle-size` | Width of the resize edges |
| `--mari-window-bubble-size`, `--mari-window-bubble-radius`, `--mari-window-bubble-shadow` | Bubble size, rounding and shadow |
| `--mari-window-bubble-bg`, `--mari-window-bubble-bg-hover`, `--mari-window-bubble-border` | Bubble background and border |
| `--mari-window-bubble-text`, `--mari-window-bubble-text-hover` | Bubble icon color |
| `--mari-window-snap-guide` | Snap guide color |
| `--mari-drawer-bg`, `--mari-drawer-border` | Drawer background and divider |
| `--mari-drawer-header-bg`, `--mari-drawer-header-bg-hover` | Drawer header colors |
| `--mari-drawer-header-padding`, `--mari-drawer-body-padding-inline`, `--mari-drawer-body-padding-bottom` | Drawer spacing |
| `--mari-drawer-title-color`, `--mari-drawer-icon-color`, `--mari-drawer-arrow-color` | Drawer header text and icons |
| `--mari-drawer-count-bg`, `--mari-drawer-count-text` | The count badge on a drawer |

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

| Part | Class |
| --- | --- |
| Roleplay and Game message boxes, Game side remarks, HUD widgets, map panel and character sheets, and chat input boxes | `.mari-chat-style-surface` |
| Game logs, Inventory, combat panels, choices and dialogs; the panels also have `data-game-section` with their name, such as `logs`, `inventory` or `combat-actions` | `.mari-game-section.mari-chat-style-surface` |
| Game content in a window, such as the Journal, which follows the window's colors | `.mari-game-section` |
| Conversation messages (font and colors only) | `.mari-chat-style-conversation` |
| Unboxed Conversation message text | `.mari-chat-style-text` |
| Chat controls, including Calls and Conversation group controls | `.mari-chat-style-control` |
| History buttons: **Load More**, **Show older**, **Show newer**, **Latest**, and the Game logs' **Older**, **All** and **Show more older logs**. They also have `.mari-chat-style-control` | `.mari-chat-history-pager` |
| A message made of HTML, such as an agent's styled card. Text colors set inside it are kept when **Apply preset colors** is on | `.mari-html-content` |

| Variable | What it controls |
| --- | --- |
| `--mari-chat-font-family` | Font for the matching chat areas |
| `--mari-chat-bg` | Box background; accepts a color or gradient |
| `--mari-chat-text` | Readable solid text color |
| `--mari-chat-border` | Box outline; accepts a color or gradient |
| `--mari-chat-border-color` | Solid border fallback |
| `--mari-chat-radius` | Box rounding, except Conversation messages |
| `--mari-chat-control-bg`, `--mari-chat-control-bg-hover` | Chat button backgrounds |
| `--mari-chat-control-color`, `--mari-chat-control-radius` | Chat button icon color and rounding |
| `--mari-chat-input-bg` | Background inside editable fields |

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

- [Card CSS Theming Guide](card-css-theming.md)
- [Appearance Settings](appearance-settings.md)
- [Server Configuration Reference](../CONFIGURATION.md)
- [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md)
