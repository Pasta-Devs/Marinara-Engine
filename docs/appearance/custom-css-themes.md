# Custom CSS Themes (Theme Library)

This guide explains how to change the whole look of Marinara Engine with a custom CSS theme. You will learn how to create, import, export, and activate themes. You will also see which CSS variables you can change and how themes work with Card CSS.

## Ready-made chat window styles

For a quick change without writing CSS, open **Settings > Appearance > App** and find **Chat widget style** at the bottom of **App Style**. **Dottore** gives your chat controls icy blue instrument frames, pale metal edges and cut corners. **Mari** adds gold-trimmed storybook frames, gemstone blues and Primogems on window titles. Its buttons use the same background as its windows. Each preset has its own font, works in light and dark mode, and styles buttons, windows and expandable sections together.

The **Font** and **Shape** controls let you change those details separately. **Preset font** and **Preset shape** follow the selected style.

Below them are three color controls. Each has a color picker for a solid color and a gradient option for blending colors:

- **Border & Buttons Color** changes outlines and button icons. Icons use the first color of a gradient.
- **Background Color** fills buttons, windows, expandable sections and editable fields.
- **Text Color** changes widget text. Gradients appear on headings and labels; text in editable fields uses the first color.

The color controls leave decorative crests in their original colors.

Use **Reset color** beside a control to follow the preset's light or dark colors again. Choosing a preset resets **Font**, **Shape** and all three colors. **Default** brings back the original look. Your window positions stay as you arranged them.

To carry the look into the rest of the chat, use the three switches below the color pickers:

- **Apply preset font** uses the selected widget font for messages, input boxes and chat controls, including Game Mode's HUD widgets, map panel, side remarks and character sheets.
- **Apply preset shape** uses the selected frame shape for Roleplay messages in classic and visual-novel layouts, the Game dialogue box, side remarks, HUD widgets, map panel and character sheets, input boxes and controls. Conversation messages keep their own shape.
- **Apply preset colors** uses the widget's border, background and text colors for those areas, including Conversation messages. Your custom colors and gradients apply too. Quoted dialogue keeps each Character's or Persona's own Dialogue Highlight Color.

Each switch starts off and works independently. For example, you can use Mari's lettering while keeping the chat's usual colors. Turning a switch off restores that part of the usual chat styling. Choosing another preset keeps your switch choices. Professor Mari can create custom themes for these areas too.

Custom CSS themes can still override these presets. The public window and drawer variables below take precedence over the preset colors. Use `--mari-window-font-family` for window lettering, `--mari-drawer-radius` for section corners, and `--mari-window-ornament: none` to hide the title ornament. To remove all preset decoration, choose **Default** first.

## What a custom theme is

A custom theme is a block of CSS that repaints Marinara. CSS, short for Cascading Style Sheets, is the code that sets colors, borders, and spacing across the app. A theme can change the page background, the accent color, cards, borders, text, and more.

Custom themes live in the **Theme Library**. They are stored on your Marinara server, so they sync to every device and browser that connects to the same server. This is different from most other appearance settings, which stay on one device. For the per-device settings, see the [Appearance Settings](appearance-settings.md) guide.

Only one custom theme can be active at a time. You can keep as many themes in your library as you like and switch between them.

## Where to find the Theme Library

1. Open **Settings**.
2. Open the **Addons** tab.
3. Find the **Theme Library** section.

The section is titled **Theme Library** and reads "Create, import, activate, edit, export, or remove custom CSS themes."

## Creating a theme

1. In the **Theme Library** section, click **Create Theme**.
2. Type a name in the **Theme name** field.
3. Write or paste your CSS in the large text box.
4. Leave **Preview** on to see your changes live in the app as you type. Turn **Preview** off to stop the live preview.
5. Click **Save**.

A new theme starts from a template. The template lists common variables as commented-out examples, so you can remove the comment marks and set your own values. When you save a brand new theme, Marinara activates it right away. It also shows a confirmation with the theme name, like: Theme "My Theme" saved and activated.

To change a theme later, find it in the **Installed Themes** list. Click the code icon (its tooltip reads **Edit theme CSS**), make your edits, and click **Save**. Editing a saved theme updates it but does not change which theme is active.

## Importing and exporting themes

You can share themes as files. This is useful for moving a theme between servers or handing it to a friend.

To import a theme:

1. Click **Import File** in the **Theme Library** section.
2. Choose a `.css` file or a `.json` file.
3. Read the toast message. It reports how many themes were imported, skipped, or failed.

A `.css` file becomes one theme, named after the file. A `.json` file can hold one or more themes, and it comes in two kinds.

The first kind is a file exported from Marinara. It wraps each theme in extra fields that Marinara adds on export. You do not need to read or edit it. Import the file as-is.

The second kind is a small file you write yourself. For a single theme, this is enough:

```
{ "name": "My Theme", "css": "..." }
```

Imported themes sync to your server, but they do not activate on their own. A theme that already exists on the server, with the same name and the same CSS, is skipped instead of added twice.

To export a theme, find it in the **Installed Themes** list and click the upload icon (its tooltip reads **Export theme**). Marinara downloads a `.json` file that you can import somewhere else.

## Activating a theme

The **Installed Themes** list shows every theme, plus a **Default Theme** entry at the top.

1. Click a theme's name to make it active. A check mark shows the active theme.
2. Click **Default Theme** to turn off custom theming and return to Marinara's built-in look.

The **Reset Appearance** button sits at the top of the **App Style** section in **Settings -> Appearance**. It also turns off the active custom theme when you use it.

To remove a theme for good, click the trash icon on its row (its tooltip reads **Remove theme**), then confirm in the **Delete Theme** dialog. This permanently deletes the theme's CSS from the server.

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

You are not limited to this list. A theme can set any CSS variable Marinara uses, and it can add other custom styles too.

Some visual effects have their own variables. For example, a theme can request the accent pulse animation by setting `--marinara-theme-accent-pulse: enabled`.

Custom theme CSS is cleaned before it runs, for safety. Styles that load a file from another website do not work. To use an image or a font inside a theme, embed it as a `data:` URI instead of a web link. A `data:` URI holds the file's content directly inside the CSS.

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
| Conversation messages (font and colors only) | `.mari-chat-style-conversation` |
| Unboxed Conversation message text | `.mari-chat-style-text` |
| Chat controls, including Calls and Conversation group controls | `.mari-chat-style-control` |

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

## Size and name limits

A theme name can be up to 200 characters. The CSS payload can be up to 256 KiB, measured in UTF-8 bytes rather than characters. A theme larger than that is rejected when you save or import it.

## Admin Access for remote installs

Creating, editing, importing, activating, and removing a theme are protected actions. This matters only when you open Marinara over a network.

If you open Marinara on the same computer that runs the server, using loopback (also called localhost), these actions just work. If you open Marinara from another device, such as a phone or a computer on your network, the server needs an admin secret first.

To manage themes over a network:

1. On the server, set `ADMIN_SECRET` in the `.env` file.
2. In the app, open **Settings -> Advanced -> Admin Access** and enter the same value.

Without this, theme changes over a network fail. For the full setup, see the [Server Configuration Reference](../CONFIGURATION.md) and the [Remote Access guide](../REMOTE_ACCESS.md).

## How themes and Card CSS work together

Marinara has two ways to add custom CSS. They are separate features and can both be active at once.

A custom theme repaints the whole app. It is allowed to override Marinara's core variables, use `!important`, and use `position: fixed`. That is the point of a theme.

Card CSS is different. A character or persona creator can embed CSS in a card, and you turn it on per chat. Card CSS is cleaned more strictly. It cannot override the app's core variables, `!important` is stripped, and `position: fixed` becomes `position: absolute`. It styles chat messages, not the whole app. See the [Card CSS Theming Guide](card-css-theming.md).

If the app looks wrong, an active theme and Card CSS are both worth checking. Either could be the cause.

## Related guides

- [Card CSS Theming Guide](card-css-theming.md)
- [Appearance Settings](appearance-settings.md)
- [Server Configuration Reference](../CONFIGURATION.md)
- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
