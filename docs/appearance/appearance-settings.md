# Appearance Settings

The **Appearance** tab changes how Marinara looks: colors, text size, chat layout and message styling for each chat mode. 

Looking for something else?

- A different font: [Custom Fonts and Google Fonts](fonts.md).
- A chat background image: [Chat Backgrounds](chat-backgrounds.md).
- A custom theme (**Settings → Addons → Theme Library**): [Custom CSS Themes](custom-css-themes.md).
- A character's own look in chat: [Card CSS Theming Guide](card-css-theming.md).

## Opening the Appearance settings

1. Open **Settings**.
2. Select the **Appearance** tab.
3. Pick a button at the top: **App**, **Conversation**, **Roleplay** or **Game**.

The buttons group the settings by chat mode, and the tab shows only the group you pick.

| Button | Sections |
| --- | --- |
| **App** | **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds** |
| **Conversation** | **Conversation Display**, **Conversation Theme** |
| **Roleplay** | **Tracker Panel**, **Roleplay Presentation** |
| **Game** | **Game Presentation** |

To start over, click **Reset Appearance** at the top of **App Style**. It resets the whole tab to Marinara defaults, clears the current chat's background, and turns off any active theme from the Theme Library.

## App button

### Color Scheme and Visual Style

In **App Style**, the **Color Scheme** dropdown has **Dark** (the default) and **Light**. The app changes at once. Colors with separate dark and light defaults follow it until you set your own.

**Visual Style** has two cards. **Default (Marinara)** is a retro Y2K look with glow effects. **SillyTavern** is a clean, minimal look. It changes the look only and has nothing to do with importing from SillyTavern.

### Background Color and Accent Color

Both accept a plain color or a gradient, a smooth blend of two or more colors. Clear a field with **Reset to default** to return to the default.

| Setting | What it colors | Default |
| --- | --- | --- |
| **Background Color** | The main app shell. | `#050312` in Dark, `#faf8ff` in Light |
| **Accent Color** | Buttons, active icons, focus rings, highlights, panel outlines and the controls around the chat. | **Marinara Gradient**, a pink, orange and cyan blend |

A value such as `#050312` is a hex color code, a short way to write a color.

Two switches change how the accent behaves. Only one can be on at a time.

- **Accent Pulse** animates your accent. Solid colors brighten and darken, and gradients cycle through their colors. It is on by default on desktop and off on phones.
- **RGB Mode** cycles the accent through a rainbow. Your saved **Accent Color** stays unchanged. It is off by default.

If your device asks for reduced motion, both animations are skipped.

### Other App Style controls

- **Custom Mouse Pointer** (on by default) uses Marinara's accent-colored cursor. Turn it off for your system cursor, or to let a custom theme control it.
- **Reduce Ambient Animations & Effects** stops decorative animation, ambient particles, rotating previews and gradual text reveal. Marinara also does this when your device asks for reduced motion.
- **Desktop sidebar width** sets the width of both sidebars on desktop. **Reset width** restores it. Phones keep their layout.

### Chat widget style

At the bottom of **App Style**, pick **Default**, **Dottore** or **Prof. Mari** for movable chat buttons, windows and sections. You can change the font, shape and three main colors separately, and the three **Apply preset** switches carry the style into messages, input boxes and chat controls. **Button size (px)** resizes movable chat buttons and their icons without changing **Display Size**. Enter 32 to 96, or leave it empty for the default. See [Custom CSS Themes](custom-css-themes.md#ready-made-chat-window-styles) for every control.

### Display Size and Chat Font Size

In **Text & Scale**:

- **Display Size** sets the base text size for the whole app on this device. The change applies at once. Choose one of these:

| Choice | Size |
| --- | --- |
| **Tiny** | 12 px |
| **Small** | 14 px |
| **Medium** | 16 px |
| **Default** | 17 px |
| **Large** | 19 px |
| **Huge** | 22 px |
| **Extra large** | 26 px |
| **Extra extra large** | 30 px |
| **Maximum** | 34 px |

- **Chat Font Size** is a slider for chat message text, from 12 px to 72 px. The default is 16 px.

The **Font** dropdown is in the same section. See [Custom Fonts and Google Fonts](fonts.md).

### Chat text colors and outline

Also in **Text & Scale**:

- **Chat Text Color** is the main message text color. The default is `#d4d4d4` in Dark and `#1a1025` in Light.
- **Default Dialogue Color** colors quoted dialogue when a character or persona has no Dialogue Highlight Color of its own. Card colors win. While **Apply preset colors** is on, dialogue uses the chat style's text color.
- **Chat Chrome Text Color** sets the text of the controls around the chat: tracker widgets, folder labels and settings descriptions. It has the same defaults as **Chat Text Color**.
- **Text Outline / Stroke** adds an outline so text stays readable over busy backgrounds. Set the color and a **Width** from 0 to 5 px. The default is 0.5 px, and 0 turns it off.

Clearing a color field returns it to the scheme default.

### Atmosphere

**Dynamic weather effects (rain, snow, fog, etc.)** is on by default. It shows weather particles based on the story's weather and time of day. It shows something only when the **World State** agent is on for the chat. See [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).

### Backgrounds

The **Backgrounds** section holds the **Chat Background** picker and **Background Blur**. Two more controls are here. **Conversation background image opacity** sets how strongly the chat background shows in Conversation mode, with the gradient still visible. **Chat List Backgrounds** shows each chat's background as a muted banner behind its row in the chat list. Choose **Active & Hovered**, **Every Row** or **Off**. See [Chat Backgrounds](chat-backgrounds.md).

## Conversation button

- **Chat Layout** (in **Conversation Display**) changes how Conversation messages look, with a live preview. **Linear** (the default) shows chat-style rows. **Bubbles** shows messenger-style bubbles.
- **Avatar Shape** is **Circular** or **Square**. Avatar size stays the same.
- **Always display swipe menu** shows swipe arrows and the counter from the first response. Turn it off to show them only after regeneration.
- **Conversation Theme** sets a two-color gradient behind every Conversation chat. The **Dark** and **Light** tabs each keep their own gradient. This is a device-wide default, not a per-chat setting.

## Roleplay button

**Tracker Panel** styles the Roleplay tracker side panel. See [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md).

**Roleplay Presentation** styles Roleplay messages.

| Setting | What it does | Default |
| --- | --- | --- |
| **Chat position** | Where messages and the input box sit on wide screens: **Left**, **Center** or **Right**. An open sidebar or a Tracker Panel on the same side moves them along. Phones keep the full width. | **Center** |
| **Visual Novel display** | Shows one finished paragraph at a time with a dialogue portrait and your sprites. It changes the current Roleplay and the default for chats with no saved style. | Off |
| **Roleplay Messages Background Opacity** | A 0% to 100% slider. Lower it to let the background show through message bubbles. | 90% |
| **Roleplay Avatars** | The avatar style beside each message: **None**, **Small Circles**, **Small Rectangles** or **Glued Side Panel**. | **Small Circles** |
| **Scrollable Avatars** | Keeps avatars visible while you scroll a long message. | Off |
| **Message avatar scale** | A 75% to 250% slider. | 100% |
| **Default sprite scale** | A 50% to 175% slider. A chat's own sprite size still wins. | 100% |

This section also has **Custom chat width**, **Always display swipe menu**, **Reduced paint effects** (flattens costly transparency and shadows to keep navigation smooth), **Show Thinking In Messages**, **Don't Collapse Thinking** and **Narrator's Cycling Avatars**. With **Visual Novel display** on, **Auto-play VN paragraphs** with a **Paragraph delay**, **Dialogue portrait scale** and **Full-body sprite scale** also appear.

## Game button

In **Game Presentation**, **Game VN Art** has two sliders: **Dialogue portrait scale** (75% to 175%, default 100%) and **Full-body sprite scale** (75% to 275%, default 135%).

**Game Dialogue Display** chooses how the dialogue box behaves.

- **Classic Dialogue Box** (the default) shows one active segment. Older lines are in the **Logs** button.
- **History Above Dialogue Box** shows earlier segments above the box, and the whole session stays scrollable there.

**Game text effects** (on by default) animates dramatic words, ALL CAPS emphasis, parenthetical asides and text-effect tags. Turn it off for plain text.

## Settings that stay on this device

Most Appearance settings sync to your other devices. **Display Size** and **Chat Font Size** do not. They save in the browser you use. See [Settings Overview](../settings/settings-overview.md) for what syncs.

## Related guides

- [Custom Fonts and Google Fonts](fonts.md)
- [Chat Backgrounds](chat-backgrounds.md)
- [Custom CSS Themes (Theme Library)](custom-css-themes.md)
- [Card CSS Theming Guide](card-css-theming.md)
- [Settings Overview](../settings/settings-overview.md)
