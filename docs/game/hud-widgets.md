# Game Mode: HUD Widgets

This guide explains HUD widgets in Guksu Motor Game Mode. HUD stands for heads-up display: small info panels that sit at the left and right edges of the game screen. This guide covers the widget types, the review step before a game starts, moving and locking panels, and sharing widget layouts.

## What HUD widgets are

HUD widgets are small custom panels that track things during a game, like a health bar, a gold counter, or an ally's trust level. Each game can have its own widgets. They are separate from the Roleplay HUD trackers. For the tracker strip used in Roleplay chats, see the Related guides below.

You can have up to 4 widgets in total. You split them between the left side and the right side of the screen however you like.

Widgets are only used when the **Custom HUD Widgets** option is turned on for the game. This option is on by default in the setup wizard. When it is on, the AI Game Master (GM) designs a starting set of widgets while it builds your world.

## The 8 widget types

There are eight widget types. The GM picks a type for each widget it creates. You can also pick types yourself when you build widgets by hand.

| Widget type | What it shows |
|---|---|
| **Progress Bar** | A horizontal bar for a value out of a maximum, like health or stamina. |
| **Gauge** | A half-circle dial for a value out of a maximum. |
| **Relationship Meter** | A bar with milestone markers and a label, good for an NPC's trust or a bond. |
| **Counter** | One large number, like gold, days passed, or kills. |
| **Stat Block** | A small grid of named fields with values, like STR and DEX or a status word. |
| **List** | A short bulleted list of text items, like active goals. |
| **Inventory Grid** | A grid of item slots, with optional category tabs and item counts. |
| **Timer** | A countdown clock in minutes and seconds that can tick down live. |

## The pre-session review modal

When custom widgets exist, a pre-session review step runs before your first turn. The moment you press **Start Game**, the **Review Starting Widgets** window opens. It lists every starting widget so you can adjust them before the game locks them in.

In this window you can:

- Press **Edit** on a widget to change its starting values or rename **Stat Block** fields.
- Press **Remove** to drop a widget you do not want.
- Press **Back** to close the window without starting.
- Press **Start Game** to begin play with the widgets as shown.

A similar window appears when you start a new session in an ongoing game. It is titled **Prepare Next Session Widgets** and has a **Start Next Session** button in place of **Start Game**. Its close button is labeled **Cancel** instead of **Back**.

## Editing a widget during play

During the game, the GM updates widget values for you as the story moves. If the GM misses an update, you can fix a widget by hand.

1. Find the widget panel on the left or right edge of the screen.
2. Click the pencil (**Edit**) button in the widget's header.
3. Change the values in the editor window. For example, set a new **Current value** and **Maximum value** on a bar.
4. Click **Save Changes**.

The header also has a small plus or minus mark. Click the widget header to collapse or expand its body.

## Moving and locking panels

Widget panels are locked in place by default. Each panel has a lock icon in its header.

1. Click the lock icon to unlock the panel. A faint outline shows it is now movable.
2. Drag the panel to a new spot.
3. Click the lock icon again to lock it back in place.

To move a panel back to its default spot, double-click its lock icon or press the R key while the icon is focused. Each panel remembers its position and lock state per game. Your layout does not carry over between different games.

On a phone, widgets show as small pills instead of full panels. Tap a pill to open that widget, and tap the X to close it again.

## Building your own widgets

You can design widgets yourself instead of letting the GM create them. You open the manual widget editor in two places:

- In the game setup wizard: turn on **Custom HUD Widgets**, then turn on the **Build Widget Setup** toggle. The editor appears below the toggle.
- In an existing game: open **Chat Settings**, then open the **Widgets** section.

In the editor, pick a widget type from the dropdown and press **Add**. For each widget you can set:

- **Icon**: a short symbol or emoji shown in the header.
- **Label**: the name shown at the top of the widget.
- **Type**: one of the eight widget types.
- **Side**: **Left HUD** or **Right HUD**.
- **Accent**: the widget's color.

Below those, each type has its own fields. A bar uses **Value** and **Max**. A counter uses **Count**. An inventory grid uses **Slots** and **Contents**. A timer uses **Seconds** and **Running**. The editor shows how many widgets you have used out of the 4 you are allowed.

In **Chat Settings**, press **Save Widgets** to apply your changes to the game, or press **Reset** to undo unsaved edits.

## Sharing widgets with import and export

You can save a widget layout to a file and load it into another game. Both the setup wizard and the **Chat Settings** **Widgets** section have these buttons.

1. Press **Export Widgets** to download your current widgets as a JSON file. JSON is a plain text data format.
2. Press **Import Widgets** in another game and pick that file to load the same widgets.

In **Chat Settings**, remember to press **Save Widgets** after an import so the loaded widgets are applied.

## Related guides

- [Game Mode: Getting Started](getting-started.md)
- [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md)
