---
name: Theme design and review
description: Read before designing, building, editing or reviewing a theme's look (shapes, borders, shadows, art, day/night, phones). Pairs with Themes and CSS, which holds the write contract.
---

# Theme design and review

Purpose: help the user make a theme that looks finished on every screen, or review one they already have. This handbook is about **how the theme should look and what to check**. For the `theme.*` actions, `apply`, `readBack` and errors, read the built-in **Themes and CSS** handbook first; both apply.

The reference for every token, part and slot is `docs/appearance/theme-author-guide.md` (read it with `docs_read`; start at `Colour tokens`, `Hooks`, `Pictures`, `Backdrops`, `Ambient overlay`, `Day and night`, `Safety`). Weather is in `docs/appearance/theme-weather.md`. Never invent a token or `data-mari-part` name: if it isn't in those docs, it does nothing.

## What a theme can do here

- **Tokens** on `:root` (all schemes), `[data-theme="light"]` and `[data-theme="dark"]`: the core colours (`--background`, `--card`, `--primary`, `--sidebar`, `--border`…), the new-layout tokens (`--ov-*`, `--mari-selected-tint`) and the theme tokens (`--mari-font-*`, `--mari-top-bar-*`, `--mari-home-widget-*`, `--mari-chat-*`, `--mari-page-veil`, `--mari-accent-text`, `--mari-confirm-scrim`, long-reply tokens such as `--mari-message-measure`…).
- **Parts**: `[data-mari-part="…"]` hooks for messages, avatars, the composer, the top bar, page titles, the page surface every Library page/editor/Settings/Docs sits on (`page`), Home widgets, time, dialogue, VN boxes. Prefer these over internal classes.
- **Art**: `--mari-app-backdrop` (and `-layers`), `--mari-ambient` (under the bars, mostly see-through), `--mari-home-art`, `border-image` frames, `--mari-focus-frame`. Pictures are named `url("theme:name.webp")` and live in the theme's package, not in the CSS.
- **Weather**: `--mari-weather-*` tokens restyle rain, snow, fog, petals, lightning; `data-mari-weather` / `data-mari-sky` on `<html>` let art follow the story weather. A theme can thin weather out but never switch it off.
- **Day and night**: style both `[data-theme]` sides. Users may follow system or time of day.
- **Per-chat looks**: `:root[data-chat-tags~="horror"]`, `[data-chat-open-mode]`.
- **Message templates (HTML)** exist but are off unless the user turns on "Allow themes with HTML". Don't plan a theme around one unless the user asks.

Internal classes (`.ov-*`, Tailwind) work but can change in any update. When you must use one, say so in a CSS comment and keep it to shape and colour.

## What you can't do from chat (tell the user plainly)

- **Fonts, thumbnails, credits, suggested settings** live in the theme package. `theme.create` and `theme.update` only write `name` and `css`, and an update keeps the package as it is. The user adds those in **Library → Settings → Appearance → CSS Themes → their theme → Pictures and sharing details**. Pictures you can add yourself (next section).
- **Starter themes** (ids starting `starter-`) are read-only downloads from the gallery. Never `theme.update` one: the next gallery update would overwrite it. To change one, have the user click **Clone + Edit** (the copy icon) on it, which keeps its pictures, then work on the copy. Copying its CSS into `theme.create` loses all its art.
- **Trying a theme**: picking a theme in CSS Themes asks **Keep this theme?** for 15 seconds. When you switch one on (`theme.setActive`, or `activate: true`), the user's tab asks the same question and goes back if nobody answers. Still prefer creating the theme **inactive** and letting the user pick it when they're ready to look. Activate it yourself only when they ask you to, and tell them to press **Keep theme**.
- **Seeing the screen**: you can't. Every visual check below ends with you asking the user to look at a named spot, or to send a screenshot.
- `theme.get` shows a theme's pictures by name, size and the `url("theme:…")` to use, never the picture itself. Ask the user to describe or screenshot a picture you need to match.

## Pictures for a theme

When the user has an image connection (`mari images connections`), you can make a theme's art: backdrops, the Home picture, tiles, frames, icons.

1. The theme must exist and be the user's own (create it inactive first; for a starter, have them **Clone + Edit** and use the copy's id).
2. `mari images generate --prompt "<your prompt>" --target theme-image --theme <id> --name <name> [--width <n> --height <n>]`. With `--target theme-image` your prompt goes to the provider **exactly as you wrote it**: the user's image style profiles, prompt prefixes, LoRAs and style reference are left out, because those are set up for character art. So write the whole prompt yourself: subject, style, palette, "no people, no text" when that is what you want. Size it for the job: wide (e.g. 1536×864) for a backdrop, square for a tile or icon, and a 9-slice frame with a plain middle.
3. Show the user the preview and wait for a yes. Make another if they don't like it; nothing is saved to the theme yet.
4. `mari images assign --asset <asset-id> --target theme-image --theme <id> --name <name> --apply`. It is saved as WebP (at most 2560 px a side; small pictures stay lossless, so pixel art and frames stay crisp). The same name replaces the old picture. The result gives the `css` to paste, e.g. `url("theme:night-sky.webp")`, and how much of the 6 MiB package is used.
5. Put that `url()` in the CSS with `theme.update` (send the whole stylesheet). Remove a picture with `mari images delete --target theme-image --theme <id> --name <name> --apply`.

A picture is art, not text: keep words, labels and the app's controls out of it, and check readability on top of it (Step 5).

## Hard rules (a theme that breaks these gets switched off, or rejected)

- The top bar, its tabs and icons, the sidebar and its chat rows, Ctrl+K and the message box keep their place and stay visible and clickable. Restyle them (colour, font, border, radius, shadow, a background picture), never hide, move, shrink, fade, filter or cover them.
- **On phones and tablets a theme never adds rows.** Mobile users want every pixel of chat. Decoration goes inside the normal top bar height, not in a new strip under it. If art behind the top bar makes buttons hard to see, give the buttons opaque backing (`--mari-top-bar-plate`, `--mari-top-bar-plate-radius`), don't move the art into its own row.
- Opaque or near-opaque backing behind every button and label that sits on busy art. Readability beats the picture.
- No scripts, no outside addresses (`@import`, remote `url()`, web fonts by link). Pictures and fonts go in the package.
- No text that asks for keys, passwords or sign-ins, claims to be the app ("security alert", "verified"), holds a phone number or web address, or runs past 80 letters in one `content:`. No fake dialogs, fake buttons or relabelled buttons.
- Respect the user's choices: Accessibility settings, Reduce motion, Theme art strength, High contrast and the weather toggle always win. Use tokens instead of literal colours on your own selectors so High contrast can reach them.
- Every hover effect goes inside `@media (hover: hover)`. Touch screens get no hover looks, including sticky ones after a tap.
- Keep the app's headings and labels. Don't hide a section title (e.g. Chat Settings) to tidy a look, even if the theme adds its own title bar.
- Plain names for anything the theme labels. No cute renames of app areas.

## Step 1: agree on the idea

Ask (one short message, offer defaults): the mood or reference, Light/Dark/both, which devices they use, whether they want art (they supply it) and weather styling, and whether this is a new theme or a change to one.

Then pick **one structural idea** and say it in a sentence before writing CSS, e.g. "every container is a coffin shape with cut corners", "everything is a soft glass capsule", "hard square panels with offset shadows, like a field manual". A theme is a shape language plus a palette, not just a palette. If the user wants several themes, each one needs its own structural idea; two themes that only differ in colour read as reskins.

Done when the user has agreed to the idea, or told you to go ahead.

## Step 2: write a shape spec first

Before any rule, write down (in a CSS comment at the top of the theme):

- **Shape family**: one of square (0), small round (4-8px), round (10-16px), capsule (999px), or a chamfer/cut corner. Which elements get which: containers, fields (inputs, selects, search boxes, text areas), buttons, pills/tags, avatars.
- **Border**: width and style for containers, fields and buttons.
- **Shadow style**: one kind (soft blur, hard offset, glow, or none) used by every sibling.
- **Selected and focus look**: an inset ring or fill, never an outset ring that makes the selected item bigger than its neighbours.

Most of the back-and-forth on past themes was this: shapes that didn't match. The spec is how you avoid it.

## Step 3: build, in this order

1. Colours for both schemes (`:root`, then `[data-theme="light"]` and `[data-theme="dark"]`).
2. Fonts (`--mari-font-ui`, `--mari-font-heading`, `--mari-font-chat`), and long-reply tokens for roleplay (`--mari-message-measure`, `--mari-chat-line-height`, `--mari-dialogue-weight`).
3. Shapes from the spec, applied to **every** surface that holds the same kind of thing (see the coverage list in Step 4). Style the shared hook (`[data-mari-part="page"]`, `.mari-window`, `.mari-drawer`) rather than one page's class, so Lorebooks gets the same panel as Characters.
4. Art and the top bar (plates behind controls on art), then weather.
5. Hover inside `@media (hover: hover)`; touch-only tweaks inside `@media (pointer: coarse)`.

Keep the stylesheet well under 256 KiB, and send the whole stylesheet on every update (Themes and CSS explains why).

## Step 4: the shape and border checklist

Go through these against the CSS you wrote, then ask the user to look at the named spots. These are the mistakes that kept coming back.

**Same shape for things in a row**

- [ ] Buttons, selects, search boxes and toggles that sit in one toolbar share one radius and one height. A pill search box next to square buttons is wrong; so is a round view toggle beside square filters.
- [ ] Sibling cards, sibling chips and sibling buttons share radius, padding, border and shadow.
- [ ] Composer buttons (attach, emoji, send, the ^ button) are the same size, so their pressed circles and shadows match.

**A border, glow, shadow or ring takes the shape of what it wraps**

- [ ] A pill-shaped border around a rounded-rectangle button (or the reverse) is wrong. Outline, glow, `box-shadow` and focus ring all follow the element's own `border-radius`.
- [ ] Nested corners are concentric: outer radius = inner radius + the gap between them. A rounded row inside a rounded drawer with too small an outer radius looks pinched.
- [ ] **Never a square shape inside a rounded container**, and never a rounded one inside a square or chamfered container. Common spots: Chat settings rows inside the drawer, a header strip or divider running square into a popover's rounded top corners, the list/grid toggle inside a rounded toolbar, the tag-filter popover's search box, Settings plates.
- [ ] No square backdrop or shadow behind a rounded shape (corners poke out), and no page colour showing through at a panel's rounded corners.
- [ ] A selected item's ring doesn't make it bigger than its neighbours (use an inset `box-shadow` or a fill).
- [ ] Underlines on active tabs don't bend around the tab's rounded bottom corners into a crescent.

**Shadows**

- [ ] One shadow style for the whole theme. Don't mix a soft blurred popover with hard offset shadows elsewhere.
- [ ] Shadows of things that touch don't merge into a smudge (e.g. a swipe counter sitting on message chips).
- [ ] Focus is visible: the focus shadow differs from the resting shadow.
- [ ] No text-shadow glow on small text in Light mode (it looks doubled).

**Coverage: give the shape to every surface, not just the obvious one**

- [ ] Chat settings drawer (rows, fields, Edit button, star), on desktop and as the phone sheet.
- [ ] Library toolbars on every page (Characters, Personas, Lorebooks, Presets, Regex, Connections, Agents), Chats list toolbar, tag-filter popover, sort menus.
- [ ] Ctrl+K, confirm dialogs, toasts, dropdown menus, the long-press sheet on phones, the character profile bubble.
- [ ] Settings (Appearance and one other tab), Docs, an editor (character, lorebook entry, preset).
- [ ] Home widgets including Professor Mari's, Recent chats, What's new.
- [ ] Split view's narrow side and its slim bar.

## Step 5: readability and layout checklist

- [ ] Body text at least 4.5:1 against what is actually behind it (picture included); top-bar labels at least 3:1 everywhere, including small status words like "Online" on a tab.
- [ ] Both Light and Dark checked. A colour that passes at night can fail by day.
- [ ] Every Library page has the same panel behind it (style `[data-mari-part="page"]`).
- [ ] Text over art has a plate, veil (`--mari-page-veil`) or wash. Version labels, timestamps and swipe counters too.
- [ ] Nothing cut mid-letter at narrow widths (phone, narrow split view, big theme fonts). Prefer smaller text or an ellipsis to a new row.
- [ ] Icons centred in their buttons and inside their fields, never overlapping text.
- [ ] Spacing even inside cards; dividers as wide as the box they belong to; tip and help boxes aligned with the content column.
- [ ] Long roleplay replies stay comfortable (line length about 60-75 characters, no bold slabs of dialogue).
- [ ] Phones: top bar is the normal height; Conversation / Roleplay / Game stay on one row on Home.

## Step 6: hand it over and check with the user

1. Create the theme inactive (unless the user asked you to switch it on), and tell them where to try it: **Library → Settings → Appearance → CSS Themes**, pick it, then **Keep theme** within 15 seconds.
2. Give a short, specific look-list from Steps 4 and 5 for the screens they use, both Light and Dark, and ask for a screenshot of anything that looks off. Name exact spots ("the search box and the buttons beside it on the Lorebooks page"), not "check the theme".
3. If the app switched the theme off or refused it, ask what message it showed. It names the reason (covered top bar, unreadable labels, unsafe text, an outside address). Fix that reason; don't work around the guard.
4. Remind them of the way back: Esc three times, `?safe` at the end of the address, or Ctrl+K → "Custom theme".

## Reviewing an existing theme

When the user asks "what's wrong with my theme" or for polish:

1. Get the CSS (`theme.get`, or ask them to paste it for a big theme).
2. List every `border-radius`, `box-shadow`, `outline` and `border` value and which selectors use it. Flag mixed radii among siblings, shapes that disagree with their container, and more than one shadow style.
3. Check the hard rules and Step 5 against the CSS.
4. Report findings grouped by screen, most visible first, each with the selector and the fix. Change nothing until the user says which to fix; then send the whole stylesheet with only those changes.

## Worked example: the shape spec

```css
/* Shape spec — Harbor Glass
   idea: frosted capsules on a sea backdrop
   containers 16px · fields and buttons 999px (capsule) · tags 999px · avatars round
   border 1px rgba(255,255,255,.35) · shadow soft only: 0 4px 14px -6px rgba(0,40,80,.45)
   selected: inset 0 0 0 2px var(--primary) · focus: 0 0 0 3px color-mix(in srgb, var(--primary) 45%, transparent) */
:root {
  --mari-tokens-version: 1;
  --radius: 16px;
  --mari-top-bar-plate: color-mix(in srgb, var(--card) 92%, transparent);
  --mari-top-bar-plate-radius: 999px;
}
[data-mari-part="page"] {
  border-radius: 16px;
}
.mari-drawer {
  border-radius: 16px;
}
@media (hover: hover) {
  [data-mari-part="message"]:hover {
    box-shadow: 0 4px 14px -6px rgba(0, 40, 80, 0.45);
  }
}
```

Every row inside the 16px drawer then uses a radius of 16px minus the drawer's padding (or capsules all the way through), never a square row.
