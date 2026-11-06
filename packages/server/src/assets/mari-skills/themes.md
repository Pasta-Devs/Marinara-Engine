---
name: Themes and CSS
description: Read before creating, editing, activating or reviewing a custom CSS theme, or explaining what it restyles.
---

# Themes and CSS

Purpose: create, edit or activate a custom CSS theme, and know what its CSS does to the interface. A theme is one document-wide `<style>` for the whole app, stored raw and cleaned only at injection.

Actions: reads `theme.list|active|get`; writes `theme.create|update|setActive` (aliases `theme.set`, `theme.activate`; a `themes.` prefix is normalized). There is no `theme.delete` — never claim you removed a theme; that is the Theme Library trash control. `mari themes` mirrors this in the CLI (`--apply` for writes).

## What the CSS can reach

The active theme is one `<style>` in the document head for the entire app — not scoped to chat, not shadow-DOM, not per-panel: what it matches, it repaints. The server keeps the raw string, so a stored theme is not "already safe".

Kept on purpose, because a theme may repaint the app: `position: fixed`, `:has()`, `content:`, `!important`, global `@keyframes`/`@property` names and theme-token overrides. It can overlay, hide, move or imitate any control, an approval card included — so never hide, move, fake or cover a control (approval cards, dialogs, composers, inputs, placeholders), keep text legible, and never present a theme as a way to change behaviour, permissions or approvals. It changes paint and layout, which is exactly why it can hide a control.

Removed at render, silently, so the theme just looks different with no error:

- `url()` outside the `data:` allowlist becomes `url(about:invalid)`; allowed types are `image/`, `font/`, `application/font*`, `application/x-font*`.
- `@import` and `@namespace` are stripped; `@font-face` survives only with at least one `url()`, all of them font `data:` URIs, and no `local()`.
- `expression(`, `javascript:`, `vbscript:`, `behavior` and `-moz-binding` are removed; `:visited` becomes `:link`; an `image-set()` holding a `var()` or an external URL is rejected whole.
- Escaped keywords are decoded before the checks, comments are stripped, and a literal `</style>` is inert text, not a breakout.

Embed images and fonts as `data:` URIs, and expect no warning when a vector is dropped.

**A theme for the app sets the app tokens in `:root`**: `--background`, `--foreground`, `--primary` (the accent and buttons), `--secondary`, `--card`, `--border`. The hooks below repaint only Mari's own window and drawer. A name that is not in the docs, such as `--mari-window-accent`, `-primary` or `-background`, is read by nothing and changes nothing on screen.

Public hooks: `.mari-window`, `.mari-drawer`, `.mari-window-bubble`, the `--mari-window-*` and `--mari-drawer-*` variables (`--mari-window-font-family` sets lettering; `--mari-window-ornament` replaces or, as `none`, hides the title ornament) and `data-presentation` (`window`, `sheet`, `menu`). Chat surfaces add `.mari-chat-style-surface|conversation|text|control` and `--mari-chat-*`, which override the window variables; conversation bubbles keep their own shape. The three chat-widget colour options are independent and **off by default**: they participate only when `data-chat-widget-apply-colors="true"`, so setting a variable alone does nothing. Dottore and Prof. Mari are chat-widget presets, not theme rows — a theme can repaint them, not activate as one.

## Write contract

- An **applied** theme write returns `readBack` (`verified`, `mismatch`, `unavailable`), `setActive` included; a dry run or a blocked plan returns none. Never tell the user you must re-read after an applied theme write; on `mismatch` read and report the difference, on `unavailable` read before claiming success.
- `theme.create` writes unless you send `apply: false`; `theme.update` and `theme.setActive` need `apply: true`: sent without `apply` they are refused, and `apply: false` returns `mode: "dry-run"` with nothing written.
- **`apply` is top-level only.** It is read from the command arguments, never from `data`, `patch` or `theme`: a create with `data.apply:false` still writes, and an update with `patch.apply:true` still previews. Both fail silently.
- `theme.create` may activate in the same plan: `activate: true` (or `active: true`) clears every other row and inserts this one active; absent, it is inactive. An activating create is the normal path — the Theme Library activates on save.
- `id` is top-level only (`id`/`themeId`) and a caller id is used as-is. `data.id`, `isActive`, `createdAt` and `updatedAt` are dropped. Create fields in `data`: `name`, `css` (both required non-empty), `installedAt`, `activate`. Update fields in `patch`, `data` or `theme`: only `name` and `css` are read, and top-level copies override the record.
- `theme.list` returns summaries with `cssLength` (characters, not bytes), never the CSS; read one row with `theme.get` or `theme.active`. `list` takes `active: true` and `limit` (default 50, max 1000).
- Caps: name 200 characters (checked on `app_data` too); CSS 256 KiB (262144 UTF-8 bytes), enforced on the REST path only — `app_data` will store CSS the Theme Library can then never save. Stay far under it.
- **`css` replaces the whole stylesheet.** An update that sends one changed rule deletes every other rule: `theme.get`, change the rule in that text, send all of it back.
- When the output limit is small (your workspace rules say so, or a reply was cut at it), a stylesheet cannot go in parts, because every update replaces all of it: keep it to `:root` token overrides and a few hook rules. When the look needs more than one reply holds, say so and offer a smaller version; never send a cut stylesheet.
- Dropped on their own: blank `css` or `name` on update (so **you cannot clear a theme's CSS** — send replacement CSS), `installedAt` and `activate` on update, unknown keys. An update whose only fields were dropped throws `theme.update needs a patch with name or css`. A taken id blocks a create (`Theme id <id> already exists`); a duplicate name and CSS still inserts and only notices `A theme with the same name and CSS already exists`.
- A zero-change apply (identical CSS, re-activating the active row) writes nothing and returns `readBack` `unavailable` with `no applied changes to read back`.

## Workflow

1. `theme.list` for ids, then `theme.get` for the row you will touch — done when you hold its full `css` text. Skip the list when the id is known.
2. Read `docs_read` on `docs/appearance/custom-css-themes.md` before writing CSS you have not seen there, and reuse its class, variable and `data-` names — done when every selector you write appears there or in the reach section above. Re-read the reach section before any rule that positions, hides or covers something.
3. Write the stylesheet as one string, preferring `:root` token overrides and public hooks; one line is fine, escaped newlines are normalized on read.
4. Create with `activate: true` when the look should apply now, otherwise inactive — done when the write returns `readBack` `verified` and you have named the tokens you changed.

## Activation

"Active" is one row with `isActive` true in the server's `custom_themes` table: one install-wide setting synced to every device, never per-chat or per-character. Per-chat styling is Card CSS, a separate mechanism with a stricter sanitizer; never offer a theme as a per-chat change. `theme.setActive` plans over every row, so the target turns active and all others inactive in one reversible change card. Deactivate with no id, or with `default`, `none`, `null` or `off` (case-insensitive) — Default Theme, not an error. An unknown id is `Theme not found`. `setActive` never edits CSS or the name.

A theme created with one of those reserved ids (`none`, `default`, `off`, `null`) stores fine but can never be activated: `setActive` reads the id as "deactivate". Pick a real id.

Do not describe activation as admin-gated: on the REST route it is deliberately open while create, update and delete are privileged, and the `theme.*` path does not consult that gate — report what the action returned instead of asserting a permission rule.

The Theme Library activates on save and leaves activation alone when editing. A backup or profile import brings every theme in inactive — `N active custom theme(s) will be imported inactive so profile CSS cannot take effect before review.` — so activate explicitly after a restore.

## Per-chat Card CSS

A card styles its own chat with `<style>` blocks inside its **Creator Notes**, extracted at render as one `#marinara-card-css` element. There is no CSS action: write the note with `character.update` (or `persona.update`), splicing the block into the existing text, `apply:true`.

- **You cannot turn it on.** The switch is **Chat Settings → Card Theming** (`cardCssMode`: `disabled`, `exclusive` or `chat`) and only that panel writes it. In Roleplay chats the section is always there (it also holds the inline name-color switch), but the mode buttons appear only when a card carries a `<style>` block. Send the user there, say which mode you wrote for, and ask them to reload before judging.
- The browser sanitizes at render, silently: `position: fixed` becomes `absolute`, `:has()`/`!important` and theme-token declarations are dropped, and `display`, `visibility`, `opacity`, `transform` and `content:` survive. Write paint only — never a rule that covers, hides or imitates a control. There is no byte cap; keep it small, it is parsed on every render.
- Reuse the class, variable and `data-card-css` names from `docs/appearance/card-css-theming.md`; do not invent selectors from the theme variables.

## Errors and fixes

Wording is exact; a `readBack` status is not an error.

| Message                                                                                                                   | Fix                                                              |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `theme css is required (none was sent): send a non-empty "css" top-level, or inside "data".`                                                                                 | A theme cannot be created empty; send at least one rule.         |
| `theme id is required (none was sent): send a non-empty "id" or "themeId" top-level. If you do not know it, use the matching list or search action first.` | Resolve the row before reading or updating it.                   |
| `theme.update needs a patch with name or css`                                                                             | Every field sent was dropped or unknown; send a real change.     |
| `Theme not found`                                                                                                         | The `setActive` target does not exist; re-list before switching. |
| `Theme name must be 200 characters or fewer`                                                                              | Shorten the name.                                                |
| `Theme id <id> already exists`                                                                                            | Choose another id, or update that row.                           |
| `A theme with the same name and CSS already exists`                                                                       | A notice only; the row was still created.                        |

## Worked example

One `app_data` call per line, ids pinned: create and activate in one call, check it, then the requested accent change — the whole stylesheet with one value changed — and a return to Default.

```
{"action":"theme.create","id":"mari-aurora","data":{"name":"Aurora Nocturne","css":":root { --background: #0a0a12; --primary: #b388ff; }","activate":true},"reason":"Adds the Aurora palette the user asked for.","apply":true}
{"action":"theme.list","limit":5}
{"action":"theme.get","id":"mari-aurora"}
{"action":"theme.update","id":"mari-aurora","patch":{"css":":root { --background: #0a0a12; --primary: #c4a0ff; }"},"reason":"Brightens the accent the user picked.","apply":true}
{"action":"theme.setActive","id":"none","reason":"Returns to the Default theme.","apply":true}
```

Read the results in order: the create returns `verified` with `mari-aurora` active and no other row active; `theme.list` shows `cssLength` and no `css`; the update returns `verified` and keeps `--background`, because it resent the whole stylesheet; the last line leaves no active row. The same update without `apply` would return `mode: "dry-run"`, write nothing and show the user nothing — never send one as a preview.

## Where the detail lives

For a card's own styling read `docs_read docs/appearance/card-css-theming.md` at `What Card CSS is`, `The Card Theming modes`, `Writing Card CSS` and `Security and limits`, then `docs_read` in `docs/appearance/custom-css-themes.md`: `What a custom theme is`, `Creating a theme`, `Activating a theme`, `The CSS variable reference`, then `Styling chat windows and drawers` with its `Classes`, `Data attributes` and `Variables` headings, then `Size and name limits` and `How themes and Card CSS work together`. In `docs/appearance/appearance-settings.md`: `Chat widget style`, `Custom Mouse Pointer`, and `Reset Appearance`, which turns off any active custom theme. The doc's `Admin Access for remote installs` overstates activation; the route disagrees.
