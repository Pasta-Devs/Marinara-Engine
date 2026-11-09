# Appearance Settings

The **Appearance** tab changes how Marinara looks: colors, text size, spacing, backgrounds and the chat's buttons and windows. The **Conversation**, **Roleplay** and **Game** tabs next to it style each chat mode.

Looking for something else?

- A ready-made look or your own theme: [Custom CSS Themes](custom-css-themes.md).
- A different font: [Custom Fonts and Google Fonts](fonts.md).
- A chat background image: [Chat Backgrounds](chat-backgrounds.md).
- A character's own look in chat: [Card CSS Theming Guide](card-css-theming.md).

## Opening the Appearance settings

1. Open **Library → Settings**.
2. Click the **Appearance** tab.
3. Click a section name in the row under the tabs to jump to it, or scroll.

| Tab | Sections |
| --- | --- |
| **Appearance** | **Theme**, **Fonts & Text Size**, **Accessibility**, **Text Colors**, **Layout**, **Effects**, **Backgrounds**, **Chat Buttons & Windows**, **CSS Themes** |
| **Conversation** | **Conversation Layout**, **Conversation Background** |
| **Roleplay** | **Tracker Panel**, **Roleplay Messages**, **Avatars**, **Visual Novel** |
| **Game** | **Game Text**, **Game Art**, **Game Assets** |

To start over, click **Reset Appearance** at the top of **Theme**. It resets the look to Marinara defaults, clears the current chat's background, and turns off any custom theme.

In the classic layout, these sections sit in the **Appearance** tab behind four buttons: **App**, **Conversation**, **Roleplay** and **Game**.

## Theme

| Setting | What it does |
| --- | --- |
| **Visual Style** | **Default (Marinara)** is a retro Y2K look with glow effects. **SillyTavern** is a clean, minimal look. It changes the look only and has nothing to do with importing from SillyTavern. **Stage** uses the plum, brass and crimson of the new layout. |
| **New layout (UI overhaul preview)** | On by default. Turn it off to go back to the classic layout. These guides describe the new layout first. |
| **Look on this device** | **Same as my other devices** (the default) shares your Visual Style, colors, font and custom theme with every device. **Only this device** gives this device its own look, for example light on your phone and dark on your computer. |
| **Color Scheme** | **Dark** (the default), **Light**, **Follow system**, or **Follow time of day**, which switches by this device's clock at the times you pick. |
| **Custom Mouse Pointer** | On by default. Uses Marinara's accent-colored cursor. Turn it off for your system cursor, or to let a custom theme set it. |
| **Background Color** | The main app background. Default `#050312` in Dark and `#faf8ff` in Light. |
| **Accent Color** | Buttons, active icons, focus rings, highlights and outlines. Default **Marinara Gradient**, a pink, orange and cyan blend. |
| **Accent Pulse** | Makes the accent gently brighten and darken, or cycle through a gradient's colors. On by default on desktop, off on phones. |
| **RGB Mode** | Cycles the accent through a rainbow. Your saved **Accent Color** stays as it is. Off by default. |

Colors accept a plain color or a gradient, a smooth blend of two or more colors. A value such as `#050312` is a hex color code, a short way to write a color. Click **Reset to default** to go back to the default. Only one of **Accent Pulse** and **RGB Mode** can be on at a time.

## Fonts & Text Size

- **Font** picks the app font. See [Custom Fonts and Google Fonts](fonts.md).
- **Display Size** sets the base text size for the whole app on this device. It applies at once.

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

## Accessibility

| Setting | What it does |
| --- | --- |
| **Line spacing** | Space between lines in messages and longer text: **Default**, **Relaxed (1.6)**, **Loose (1.8)** or **Double (2.0)**. Menus and buttons keep their size. |
| **Letter spacing** | Space between letters everywhere: **Default**, **A little wider**, **Wider** or **Widest**. |
| **High contrast** | Stronger text, borders and focus colors. **Follow system** turns it on when your device asks for more contrast. |
| **Strong focus rings** | A thick outline on whatever the keyboard is on. <kbd>Tab</kbd> also offers **Skip to content** links. |
| **Reduce motion** | Stops animations, transitions, **Accent Pulse** and theme effects. It turns on by itself when your device asks for less motion. |
| **Theme art strength** | How strongly a custom theme's background picture and overlay (rain, leaves, scanlines) show. Lower it when a theme's art makes text hard to read. |
| **Colour-blind-safe colours** | Blue and orange instead of green and red for status dots, gauges and Delete buttons. |

## Text Colors

- **Chat Text Color** is the main message text color. The default is `#d4d4d4` in Dark and `#1a1025` in Light.
- **Default Dialogue Color** colors quoted dialogue when a character or persona has no Dialogue Highlight Color of its own. Card colors win. While **Apply preset colors** is on in **Chat Buttons & Windows**, dialogue uses that style's text color.
- **Chat Chrome Text Color** sets the text of the controls around the chat: tracker widgets, folder labels, settings descriptions and windows opened from chat buttons. It has the same defaults as **Chat Text Color**.
- **Text Outline / Stroke** adds an outline so text stays readable over busy backgrounds. Set the color and a **Width** from 0 to 5 px. The default is 0.5 px, and 0 turns it off.

## Layout

- **Desktop sidebar width** sets the width of both sidebars on a computer. **Reset width** restores it. Phones keep their layout.
- **Show Android status bar** shows the phone's status bar in the Android app.

## Effects

- **Dynamic weather effects (rain, snow, fog, etc.)** is on by default. It shows weather based on the story's weather and time of day, and needs the **World State** agent on for the chat. See [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).
- **Reduce Ambient Animations & Effects** stops decorative animation, particles, rotating previews and gradual text reveal.
- **Reduced paint effects** flattens costly see-through panels and shadows, so slower devices stay smooth.

## Backgrounds

This section holds the **Chat Background** picker and **Background Blur**. The picker shows the current chat's background (or **Default background**) and your recent picks. Click the picture or **Browse library** to choose another. It also has:

- **Conversation background image opacity**: how strongly the chat background shows in Conversation mode.
- **Chat background behind side panels**: spreads the open chat's background, softened, behind the sidebars and top bar.
- **Chat List Backgrounds**: shows each chat's background as a muted banner behind its row in the chat list. Choose **Active & Hovered**, **Every Row** or **Off**.

See [Chat Backgrounds](chat-backgrounds.md).

## Chat Buttons & Windows

**Chat widget style** sets the look of the chat's movable buttons, windows and sections. Pick **Default**, **Dottore** (icy blue, pale metal and cut corners) or **Prof. Mari** (gold-trimmed storybook frames). Picking one resets the controls below it.

| Control | What it does |
| --- | --- |
| **Font** | **Preset font**, **App font**, **Sans serif**, **Storybook serif** or **Technical monospace**. |
| **Shape** | **Preset shape**, **Rounded**, **Square**, **Cut corners** or **Arched**. |
| **Button size (px)** | Resizes movable chat buttons and their icons. Enter 32 to 96, or leave it empty for the default. |
| **Border & Buttons Color**, **Background Color**, **Text Color** | The three main colors. Reset one to follow the preset and Dark or Light. |
| **Apply preset font**, **Apply preset shape**, **Apply preset colors** | Carry the style into messages, input boxes and chat controls too. Off by default. |

Professor Mari can make a custom chat style for you. Ask her in chat.

## CSS Themes

Ready-made themes, and themes you make or import. See [Custom CSS Themes](custom-css-themes.md).

## Conversation tab

- **Chat Layout** (in **Conversation Layout**) changes how Conversation messages look, with a live preview. **Linear** (the default) shows chat-style rows. **Bubbles** shows messenger-style bubbles.
- **Avatar Shape** is **Circular** or **Square**. Avatar size stays the same.
- **Conversation Theme** (in **Conversation Background**) sets a two-color gradient behind every Conversation chat. The **Dark** and **Light** tabs each keep their own gradient. It is a default for all Conversation chats, not a per-chat setting.

The swipe menu switches are in **Settings → Chatting → Editing & Swipes**.

## Roleplay tab

**Tracker Panel** styles the panel of stats, outfit and location beside Roleplay chats. See [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md).

**Roleplay Messages**

| Setting | What it does | Default |
| --- | --- | --- |
| **Chat position** | Where messages and the input box sit on wide screens: **Left**, **Center** or **Right**. Phones keep the full width. | **Center** |
| **Custom chat width** | Sets your own width for the message column. | Off |
| **Roleplay Messages Background Opacity** | Lower it to let the background show through message bubbles. It overrides see-through colors from cards and presets. | 90% |
| **Stretch Messages** | Every message fills the full row, so short messages line up with long ones. | Off |
| **Hide line under names** | Removes the thin line under names. | Off |

**Avatars**

| Setting | What it does | Default |
| --- | --- | --- |
| Avatar style | **None**, **Small Circles**, **Small Rectangles**, **Glued Side Panel** or **Faded Side Panel**, a wide portrait that fades into the message. | **Small Circles** |
| **Scrollable Avatars** | Keeps avatars visible while you scroll a long message. | Off |
| **Narrator's Cycling Avatars**, **Narrator's Avatar Borders** | How the Narrator's avatar looks. | |
| **Message avatar scale** | 75% to 250%. | 100% |
| **Default sprite scale** | 50% to 175%. A chat's own sprite size still wins. | 100% |

**Visual Novel**

**Visual Novel display** shows one finished paragraph at a time with a dialogue portrait and your sprites. It sets the display for new Roleplays and ones without their own choice. **Auto-play VN paragraphs** with a **Paragraph delay**, **Dialogue portrait scale** and **Full-body sprite scale** set how it plays.

**Show Thinking In Messages** and **Don't Collapse Thinking** are in **Settings → Chatting → Thinking**.

## Game tab

**Game Text**

- **Instantly reveal game text** skips the typing effect.
- **Mouse-wheel + click navigation** moves through the story with the mouse.
- **Game narration speed** and **Game auto-play segment delay** set how fast text plays and moves on.
- **Game Dialogue Display**: **Classic Dialogue Box** (the default) shows one segment, with older lines in **Logs**. **History Above Dialogue Box** shows earlier segments above the box.
- **Game text effects** (on by default) animates dramatic words, ALL CAPS, asides and text-effect tags. Turn it off for plain text.

**Game Art** has two sliders: **Dialogue portrait scale** (75% to 175%, default 100%) and **Full-body sprite scale** (75% to 275%, default 135%).

**Game Assets** is covered in [Game Assets](../game/game-assets.md).

## Settings that stay on this device

Most Appearance settings sync to your other devices. **Display Size** and **Chat Font Size** do not. They save in the browser you use. To give one device a whole different look, use **Look on this device** in **Theme**. See [Settings Overview](../settings/settings-overview.md) for what syncs.

## Related guides

- [Custom CSS Themes](custom-css-themes.md)
- [Custom Fonts and Google Fonts](fonts.md)
- [Chat Backgrounds](chat-backgrounds.md)
- [Card CSS Theming Guide](card-css-theming.md)
- [Settings Overview](../settings/settings-overview.md)
