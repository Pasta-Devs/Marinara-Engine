# Appearance Settings

This guide walks through the **Settings -> Appearance** tab in Marinara Engine section by section. It covers colors, text size, chat layout, message styling for each mode, and how to reset everything to the defaults.

Fonts, backgrounds, and custom CSS themes each have their own guide. This page links to them where they belong.

## Opening the Appearance settings

1. Open **Settings**.
2. Select the **Appearance** tab.

The tab is split into sections you scroll through: **App Style**, **Text & Scale**, **Conversation Display**, **Tracker Panel**, **Roleplay Messages**, **Game Presentation**, **Atmosphere**, **Conversation Theme**, and **Backgrounds**.

## Color Scheme (Dark or Light)

The **Color Scheme** dropdown is in the **App Style** section. It has two options:

- **Dark** (the default). Easier on the eyes in a dark room.
- **Light**.

Several colors below have separate dark and light defaults. They follow the active Color Scheme automatically until you set your own color.

## Visual Style

**Visual Style** picks the overall look of the whole app. You choose between two cards:

- **Default (Marinara)** (the default). A retro Y2K look with glow effects.
- **SillyTavern**. A clean, minimal look inspired by the original SillyTavern.

This is only a skin. It has nothing to do with importing data from SillyTavern, which is a separate tool.

## Background Color and Accent Color

These two controls are in the **App Style** section. Both accept a plain color or a gradient. A gradient is a smooth blend between two or more colors.

- **Background Color** paints the main app shell behind everything. The default is `#050312` in Dark mode and `#faf8ff` in Light mode.
- **Accent Color** colors buttons, active icons, focus rings, highlights, and panel outlines. The default is `#d4acfb` in both schemes.

A value like `#d4acfb` is a hex color code, a short way to write a color. To go back to the scheme default, clear the field with **Reset to default**.

Two toggles change how the Accent Color behaves:

- **Accent Pulse** (default off) gently animates your Accent Color. Solid colors brighten and darken. Gradients cycle through their colors.
- **RGB Mode** (default off) cycles the accent through a rainbow palette while it is on. Your saved Accent Color is not changed.

You can only use one of these at a time. Turning on **RGB Mode** turns off **Accent Pulse**, and turning on **Accent Pulse** turns off **RGB Mode**. Accent Pulse previews live while the Appearance tab is open. If your device is set to reduce motion, both animations are skipped.

## Custom Mouse Pointer

**Custom Mouse Pointer** (default on) uses Marinara's accent-colored cursor across the app. Turn it off to use your normal system cursor, or to let a custom CSS theme control the cursor.

## Display Size and Chat Font Size

These two controls are in the **Text & Scale** section.

- **Display Size** sets the base text size for the whole app on this device. The choices are **Tiny**, **Small**, **Medium**, **Default** (17px), **Large**, and **Huge**.
- **Chat Font Size** is a slider that sets the size of chat message text. It ranges from 12px to 48px. The default is 16px.

The **Font** dropdown lives in this same section. To add your own fonts or download from Google Fonts, see [Custom Fonts and Google Fonts](fonts.md).

## Chat text colors and outline

Also in the **Text & Scale** section, four controls change how chat text reads over your background.

- **Chat Text Color** sets the main chat message text color. The default is `#d4d4d4` in Dark mode and `#1a1025` in Light mode.
- **Default Dialogue Color** colors quoted dialogue when a Character or Persona card does not define its own Dialogue Highlight Color. It is always active; card-specific colors take priority.
- **Chat Chrome Text Color** sets ordinary text in tracker widgets, folder labels, and settings descriptions. It uses the same defaults as **Chat Text Color**.
- **Text Outline / Stroke** adds an outline around chat text so it stays readable over busy backgrounds. Set the outline color and a **Width** from 0px to 5px. The default width is 0.5px. Set the width to 0 to turn the outline off.

Each color follows the Color Scheme default until you set your own. Clearing a color field returns it to that scheme default rather than leaving it blank.

## Chat Layout (Conversation Display)

The **Conversation Display** section has one control, **Chat Layout**, that changes how Conversation-mode messages look. A live preview updates as you pick.

- **Linear** (the default). Chat-style rows.
- **Bubbles**. Messenger-style bubbles.

## Tracker Panel

The **Tracker Panel** section styles the Roleplay tracker side panel. That panel is a separate feature with its own guide. See [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md).

## Roleplay message appearance

The **Roleplay Messages** section styles messages in Roleplay chats.

- **Roleplay Messages Background Opacity** is a slider from 0% to 100%. The default is 90%. Lower it to let the background show through the message bubbles.
- **Roleplay Avatars** picks the avatar style beside each message. The four options are **None**, **Small Circles** (the default), **Small Rectangles**, and **Glued Side Panel**.
- **Scrollable Avatars** (default off) keeps avatars visible while you scroll through a long message.
- **Message avatar scale** is a slider from 75% to 250%. The default is 100%.
- **Default sprite scale** is a slider from 50% to 175%. The default is 100%. A per-chat sprite size still overrides this default.

## Game Presentation

The **Game Presentation** section scales the art in Game mode. Game mode can show both a dialogue portrait and a full-body sprite. These two sliders set their size.

- **Dialogue portrait scale** is a slider from 75% to 175%. The default is 100%.
- **Full-body sprite scale** is a slider from 75% to 275%. The default is 135%.

**Game Dialogue Display** chooses how the dialogue box behaves:

- **Classic VN** (the default). One active segment shows in the dialogue box. Older lines are in the **Logs** button.
- **History Above VN**. Prior segments show above the dialogue box. The full session stays scrollable there.

## Atmosphere weather effects

The **Atmosphere** section has one toggle, **Dynamic weather effects (rain, snow, fog, etc.)**, which is on by default. It shows animated weather particles based on the story's weather and time of day.

This toggle only shows anything when the **World State** agent is turned on for the chat. That agent reads the weather from the story. Without it, the toggle has no visible effect. See [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).

## Conversation Theme

The **Conversation Theme** section sets a two-color gradient background for every Conversation-mode chat. It has separate **Dark** and **Light** tabs so each Color Scheme keeps its own gradient. This is a device-wide default for Conversation chats, not a per-chat setting.

## Backgrounds

The **Backgrounds** section lets you import and choose chat background images and set a **Background Blur**. Because this is its own feature area with its own library, it has a dedicated guide. See [Chat Backgrounds](chat-backgrounds.md).

## Reset Appearance

The **Reset Appearance** button sits at the top of the **App Style** section. It resets the entire **Appearance** tab back to Marinara defaults. This includes colors, text sizes, layout, avatar and sprite scales, and gradients.

Reset also clears the current chat's background and turns off any active custom theme from the Theme Library. Use it when your styling gets messy and you want a clean start.

## Settings that stay on this device

Most Appearance settings sync to your other devices. Two do not: **Display Size** and **Chat Font Size** save to the browser you are using and never sync.

For the full picture of which settings sync across devices and which stay local, see [Settings Overview](../settings/settings-overview.md).

## Related guides

- [Custom Fonts and Google Fonts](fonts.md)
- [Chat Backgrounds](chat-backgrounds.md)
- [Custom CSS Themes (Theme Library)](custom-css-themes.md)
- [Card CSS Theming Guide](card-css-theming.md)
- [Settings Overview](../settings/settings-overview.md)
