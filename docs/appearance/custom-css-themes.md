# Custom CSS Themes (Theme Library)

This guide explains how to change the whole look of Guksu Motor with a custom CSS theme. You will learn how to create, import, export, and activate themes. You will also see which CSS variables you can change and how themes work with extensions and Card CSS.

## What a custom theme is

A custom theme is a block of CSS that repaints Guksu. CSS, short for Cascading Style Sheets, is the code that sets colors, borders, and spacing across the app. A theme can change the page background, the accent color, cards, borders, text, and more.

Custom themes live in the **Theme Library**. They are stored on your Guksu server, so they sync to every device and browser that connects to the same server. This is different from most other appearance settings, which stay on one device. For the per-device settings, see the [Appearance Settings](appearance-settings.md) guide.

Only one custom theme can be active at a time. You can keep as many themes in your library as you like and switch between them.

## Where to find the Theme Library

1. Open **Settings**.
2. Open the **Addons** tab. The tab opens with the line "Extensions add trusted browser or server behavior; custom themes change Guksu's look."
3. Scroll past the **Extension Library** section. The **Theme Library** section sits below it.

The section is titled **Theme Library** and reads "Create, import, activate, edit, export, or remove custom CSS themes."

## Creating a theme

1. In the **Theme Library** section, click **Create Theme**.
2. Type a name in the **Theme name** field.
3. Write or paste your CSS in the large text box.
4. Leave **Preview** on to see your changes live in the app as you type. Turn **Preview** off to stop the live preview.
5. Click **Save**.

A new theme starts from a template. The template lists common variables as commented-out examples, so you can remove the comment marks and set your own values. When you save a brand new theme, Guksu activates it right away. It also shows a confirmation with the theme name, like: Theme "My Theme" saved and activated.

To change a theme later, find it in the **Installed Themes** list. Click the code icon (its tooltip reads **Edit theme CSS**), make your edits, and click **Save**. Editing a saved theme updates it but does not change which theme is active.

## Importing and exporting themes

You can share themes as files. This is useful for moving a theme between servers or handing it to a friend.

To import a theme:

1. Click **Import File** in the **Theme Library** section.
2. Choose a `.css` file or a `.json` file.
3. Read the toast message. It reports how many themes were imported, skipped, or failed.

A `.css` file becomes one theme, named after the file. A `.json` file can hold one or more themes, and it comes in two kinds.

The first kind is a file exported from Guksu. It wraps each theme in extra fields that Guksu adds on export. You do not need to read or edit it. Import the file as-is.

The second kind is a small file you write yourself. For a single theme, this is enough:

```
{ "name": "My Theme", "css": "..." }
```

Imported themes sync to your server, but they do not activate on their own. A theme that already exists on the server, with the same name and the same CSS, is skipped instead of added twice.

To export a theme, find it in the **Installed Themes** list and click the upload icon (its tooltip reads **Export theme**). Guksu downloads a `.json` file that you can import somewhere else.

## Activating a theme

The **Installed Themes** list shows every theme, plus a **Default Theme** entry at the top.

1. Click a theme's name to make it active. A check mark shows the active theme.
2. Click **Default Theme** to turn off custom theming and return to Guksu's built-in look.

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

You are not limited to this list. A theme can set any CSS variable Guksu uses, and it can add other custom styles too.

Some visual effects have their own variables. For example, a theme can request the accent pulse animation by setting `--marinara-theme-accent-pulse: enabled`.

Custom theme CSS is cleaned before it runs, for safety. Styles that load a file from another website do not work. To use an image or a font inside a theme, embed it as a `data:` URI instead of a web link. A `data:` URI holds the file's content directly inside the CSS.

## Size and name limits

A theme name can be up to 200 characters. The CSS payload can be up to 256 KiB, measured in UTF-8 bytes rather than characters. A theme larger than that is rejected when you save or import it.

## Admin Access for remote installs

Creating, editing, importing, activating, and removing a theme are protected actions. This matters only when you open Guksu over a network.

If you open Guksu on the same computer that runs the server, using loopback (also called localhost), these actions just work. If you open Guksu from another device, such as a phone or a computer on your network, the server needs an admin secret first.

To manage themes over a network:

1. On the server, set `ADMIN_SECRET` in the `.env` file.
2. In the app, open **Settings -> Advanced -> Admin Access** and enter the same value.

Without this, theme changes over a network fail. For the full setup, see the [Server Configuration Reference](../CONFIGURATION.md) and the [Remote Access guide](../REMOTE_ACCESS.md).

## How themes, extensions, and Card CSS work together

Guksu has three ways to add custom CSS. They are separate features and can all be active at once.

A custom theme repaints the whole app. It is allowed to override Guksu's core variables, use `!important`, and use `position: fixed`. That is the point of a theme.

Extensions can also inject CSS into the page. You manage them in **Settings -> Addons -> Extension Library**, right above the Theme Library. Extension CSS follows the same rules as theme CSS, so an enabled extension can also change how the app looks. See the [Extensions guide](../extending/extensions.md).

Card CSS is different. A character or persona creator can embed CSS in a card, and you turn it on per chat. Card CSS is cleaned more strictly. It cannot override the app's core variables, `!important` is stripped, and `position: fixed` becomes `position: absolute`. It styles chat messages, not the whole app. See the [Card CSS Theming Guide](card-css-theming.md).

If the app looks wrong, an active theme, an enabled extension, and Card CSS are all worth checking. Any of the three could be the cause.

## Related guides

- [Card CSS Theming Guide](card-css-theming.md)
- [Appearance Settings](appearance-settings.md)
- [Extensions](../extending/extensions.md)
- [Server Configuration Reference](../CONFIGURATION.md)
- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
