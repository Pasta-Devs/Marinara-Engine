# Game Mode: HUD Widgets

HUD widgets are small panels at the left and right edges of the game screen. They track things such as a health bar, a gold counter or an ally's trust level. HUD stands for heads-up display. Each game has its own widgets, separate from the Roleplay HUD trackers (see [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md)).

A game can have up to 4 widgets in total, split between the left and right sides however you like. Widgets are used only when **Custom HUD Widgets** is on for the game. It is on by default in the setup wizard. The Game Master (GM) then designs a starting set while it builds your world.

## Widget types

The GM picks a type for each widget it creates. You can pick types yourself when you build widgets by hand.

| Widget type | What it shows |
| --- | --- |
| **Progress Bar** | A horizontal bar for a value out of a maximum, like health or stamina. |
| **Gauge** | A half-circle dial for a value out of a maximum. |
| **Relationship Meter** | A bar with milestone markers and a label, good for an NPC's trust or a bond. |
| **Counter** | One large number, like gold, days passed or kills. |
| **Stat Block** | A small grid of named fields with values, like STR and DEX or a status word. |
| **List** | A short bulleted list of text items, like active goals. |
| **Inventory Grid** | A grid of item slots, with optional category tabs and item counts. |
| **Timer** | A countdown clock in minutes and seconds that can tick down live. |

## Review widgets before the game starts

When custom widgets exist, a **Review Starting Widgets** button sits under **Start Game** on the game screen. Clicking it opens the **Review Starting Widgets** window before you start. It lists every starting widget so you can adjust them before the game locks them in.

1. Press **Edit** on a widget to change its starting values or rename **Stat Block** fields.
2. Press **Remove** to drop a widget you do not want.
3. Press **Start Game** to begin play with the widgets as shown. Press **Back** to close the window without starting.

A similar window, **Prepare Next Session Widgets**, appears when you start a new session in an ongoing game. It has **Start Next Session** instead of **Start Game**, and **Cancel** instead of **Back**.

## Edit a widget during play

The GM updates widget values as the story moves. If it misses an update, fix the widget by hand.

1. Find the widget panel on the left or right edge of the screen.
2. Click the pencil (**Edit**) button in the widget's header.
3. Change the values in the editor window, for example the **Maximum value** on a bar.
4. Click **Save Changes**.

Click the widget header to collapse or expand its body.

## Move and lock panels

Widget panels are locked in place by default. Each has a lock icon in its header.

1. Click the lock icon to unlock the panel. A faint outline shows it can move.
2. Drag the panel to a new spot.
3. Click the lock icon again to lock it.

To return a panel to its default spot, double-click its lock icon, or press <kbd>R</kbd> while the icon is focused. Each panel remembers its position and lock state per game. Your layout does not carry over to other games.

On a phone, widgets show as small pills instead of full panels. Tap a pill to open that widget and tap the X to close it.

## Build your own widgets

You can design widgets yourself instead of letting the GM create them. Open the manual editor in either place:

- In the setup wizard: turn on **Custom HUD Widgets**, then turn on **Build Widget Setup**. The editor appears below.
- In an existing game: open **Chat Settings**, then the **Widgets** section.

1. Pick a widget type from the dropdown and press **Add**.
2. Set the **Icon** (a short symbol or emoji), **Label**, **Type**, **Side** (**Left HUD** or **Right HUD**) and **Accent** (the color).
3. Fill in the fields for that type: a bar uses **Value** and **Max**, a counter uses **Count**, an inventory grid uses **Slots** and **Contents**, and a timer uses **Seconds** and **Running**.
4. In **Chat Settings**, press **Save Widgets** to apply your changes. **Reset** undoes unsaved edits.

The editor shows how many of the 4 allowed widgets you have used.

## Sharing widgets with import and export

You can save a widget layout to a file and load it into another game. The setup wizard and the **Widgets** section of **Chat Settings** both have these buttons.

1. Press **Export Widgets** to download your widgets as a JSON file (a plain text data format).
2. In another game, press **Import Widgets** and pick that file.
3. In **Chat Settings**, press **Save Widgets** so the loaded widgets apply.

## Related guides

- [Game Mode: Getting Started](getting-started.md)
- [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md)
