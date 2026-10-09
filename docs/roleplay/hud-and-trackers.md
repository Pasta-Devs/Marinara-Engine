# Roleplay HUD and Trackers

This guide explains the Roleplay trackers: the movable buttons and panels on phones, the **Trackers** window and the Tracker Panel on a computer. You will learn how to edit and lock their values. It applies to Roleplay Mode in Marinara Engine.

## What the HUD is

On a phone, the HUD (heads-up display) gives you **World State** and **Player & Tracker** buttons. You can move them around the chat. Tap one to see live story details, such as the time, your stats, or who is present. Marinara keeps these values up to date as the story moves.

Once World State has details to show, its button becomes a small banner that shows them at a glance: a location pin, a calendar with the day, a clock, the weather and the temperature.

These tracker buttons stay separate from the **Chat tools** three-dot menu, which holds sections you have moved out of Chat Settings.

On a computer, the trackers are not in the HUD row. They appear in the **Tracker Panel** while it is shown, and otherwise in the **Trackers** window described below.

The values come from tracker agents. An agent is a small AI helper that runs in the background. Each tracker agent watches the story and updates one part of the HUD after each message. You do not have to ask for it.

A widget only appears when its tracker agent is turned on for the chat. You turn agents on and off in **Chat Settings**, under the **Agents** section. If no tracker agents are on, the HUD shows no widgets.

## The HUD widgets

There are seven tracker widgets. Each one needs its own agent enabled to appear.

| Widget                 | Needs this agent  | Shows                                                                            |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------- |
| **World State**        | World State       | Location, date, time, weather, temperature, and your custom world fields         |
| **Persona Stats**      | Persona Stats     | Your persona's status bars and a status line                                     |
| **Present Characters** | Character Tracker | Who is in the scene, with mood, appearance, and character-specific custom fields |
| **Inventory**          | Persona Stats     | Items you are carrying, with quantities                                          |
| **Inventory Tracker**  | Inventory Tracker | Separate lists for currencies, equipped gear, and carried items                  |
| **Active Quests**      | Quest Tracker     | Your current objective                                                           |
| **Custom Tracker**     | Custom Tracker    | Your own named fields, such as counters or currency                              |

Note that the **Inventory** widget is driven by the same **Persona Stats** agent that powers the **Persona Stats** widget. Turn on **Persona Stats** to get both.

The dedicated **Inventory Tracker** is separate from Persona Stats inventory. It keeps compact name-and-quantity entries in three groups — **Currencies**, **Equipped**, and **Inventory** — and prevents equipped gear from also appearing in carried inventory.

Each entry is a small pill. Pills flow across the panel and wrap onto the next line, so a long carried list stays readable instead of stretching into a tall column. A quantity is shown only when it is more than one, written as `×4` after the name; a single item shows just its name. On a narrow panel the pills stack one per line.

To change a quantity that is currently one, turn on **add mode** or **lock mode** — both reveal the quantity control on every entry.

The **Present Characters** widget shows up to three character emoji plus a "+N" count for any extras. The **Inventory** and **Custom Tracker** widgets cycle through their entries one at a time.

## The Trackers window

On a computer, when the **Tracker Panel** is not shown, a Roleplay chat's trackers use the **Trackers** window. If there is room beside your messages, it opens on the left. Otherwise, it starts as a small **Trackers** button at the top left of the chat. Click the button to open it. A chat with a saved layout keeps the arrangement you chose.

When you update an older chat, its desktop tracker widgets are grouped in this window. Its other chat tools keep their icons as movable buttons.

You can move the window by its title bar, resize it from its edges, and use the buttons in its top-right corner:

- **Pin** keeps it open when you click elsewhere. It starts pinned.
- **Lock** stops it from moving or resizing and fixes its button in place. The button still opens the window, where you can unlock it again.
- **Close** shrinks it to the movable **Trackers** button. Click that button to reopen it where you left it.

To use the Tracker Panel instead, click the die in the Chat Settings title bar. When the panel is not shown, the trackers remain available through their window or button. **Reset View** in Chat Settings clears the saved arrangement and chooses the starting window or button to fit the available space.

While agents are working on the chat, a small dot shows beside the window's title (and on the **Chat Settings** button).

Each tracker has its own collapsible section, called a drawer. Click a drawer's header to collapse it to the tracker's small widget preview, and click it again to see the whole tracker. Marinara remembers which drawers you collapsed.

A tracker can also get its own window: click the pop-out button beside its arrow, or drag its title out of the Trackers window. The new window starts unpinned. Pin it to keep it open when you click elsewhere or close the Trackers window. Its **X** shrinks it to a small button with the tracker's icon, which reopens it where you left it. **World State** shrinks to a banner instead, with the same pin, calendar, clock, weather and temperature as the phone button, so the story's date and time stay in view. Drag it anywhere, such as the top middle of the chat. Click **Put back in Trackers** (the curved arrow just left of **X**), or drag it back onto the Trackers window, to return it. Each chat remembers which trackers are out and where.

At the bottom, **Agent activity** shows what the chat's agents did. From there you can re-run the trackers, retry agents that failed, stop running agents, and **Clear Trackers**. The Tracker Panel has the same section at its bottom.

## Editing tracker values

On a phone, drag the **World State** and **Player & Tracker** buttons wherever you want in the chat. Tap a button to open its panel, and use **X** to close it. The buttons and panels follow your **Chat widget style** in **Settings → Appearance → App**. Your chat remembers where you put each button. On a computer, the same editors are inside the drawers of the Trackers window. Every field is editable, so you can correct a value the AI got wrong. Your edits save right away. The next reply starts from your corrected values, also when you regenerate or swipe the reply you corrected.

Here is what each tracker lets you edit:

- **World State**: the **Location**, **Date**, **Time**, **Weather**, **Temperature**, and custom world-field rows.
- **Persona Stats**: a **Status** line, plus named stat bars with a current value and a max value. You can add or remove bars.
- **Present Characters**: add or remove characters, and edit each one's emoji, name, **Mood**, **Look**, **Outfit**, **Thinks** (private thoughts), and custom field values. You can upload an avatar per character. An **Auto** button toggles "Auto-generate avatars: ON" or "Auto-generate avatars: OFF".
- **Inventory**: add or remove items, and edit each item's name and quantity.
- **Inventory Tracker**: add or remove entries under **Currencies**, **Equipped**, and **Inventory**, and edit each name or quantity. Moving an item between groups is not yet a single action — remove it from one group and add it to the other.
- **Active Quests**: add or remove quests. Each quest has named objectives with completion checkboxes.
- **Custom Tracker**: add, remove, or edit name and value fields.

## Lock mode

The tracker agents overwrite HUD values after each turn. That is helpful, but sometimes a value keeps drifting wrong and you want to pin it by hand. Lock mode does this.

When a field is locked, the next automatic tracker run leaves it alone. Locked fields are marked so you can see them at a glance.

To lock a field:

1. Open the tracker you want to edit.
2. Click the lock toggle near the top of the tracker. Its tooltip reads **Enter lock mode**.
3. A small lock button now appears next to each editable value.
4. Click the lock button beside the value you want to pin. Its tooltip reads **Lock field**.

To unlock, click the same button again (tooltip **Unlock field**). To leave lock mode, click the top toggle again (tooltip **Exit lock mode**). Lock mode is shared across the whole HUD, so turning it on in one tracker reveals the lock buttons everywhere.

## Re-running a tracker

You can force a tracker to update instead of waiting for the next message.

Inside each tracker there is a small refresh (circular arrow) button. Click it to re-run just that one tracker for the latest turn. The tooltips name the tracker, for example **Re-run world state tracker only** or **Re-run quest tracker only**.

In **Chat Settings → Agents**, open **Trackers Control** and turn a tracker on under **Individual tracker schedule** to make it manual. A manual tracker doesn't run after every reply. A chat that had the old **Manual Trackers** switch on shows every tracker turned on there. A refresh button appears whenever at least one tracker is manual: in the HUD row on a phone, and next to the title of the Trackers window on a computer. Click it to run the manual tracker set for the current turn. The refresh button inside each tracker still runs that individual tracker directly.

**Agent activity** has its own section just below **Agents** in **Chat Settings**, at the bottom of the Tracker Panel, and on a computer at the bottom of the Trackers window. From there you can re-run all trackers, retry any agents that failed, and use **Clear Trackers** to wipe all tracked world state for the chat. **Clear Trackers** cannot be undone, so use it with care.

## The Tracker Panel

The **Tracker Panel** is a larger side panel that shows the same tracker data as the compact HUD widgets. It gives the tracker cards more room and adds portrait and thought features. You set it up in **Settings**, under the **Appearance** tab, in the **Tracker Panel** section.

To turn it on in a Roleplay chat, open **Chat Settings** and click the **Tracker Panel** button (the die) in its title bar, next to pin and lock. It stays highlighted while the panel is on, and the panel shows beside the chat. Click it again to turn the panel off and hide it. On a computer, the trackers then show in the Trackers window.

On a computer, the panel fits into the space beside your messages, up to the width you choose in **Desktop size**. When the window is too narrow for both, such as with the chats sidebar open, your messages and message box narrow a little so the panel keeps room for its own buttons.

On a phone or tablet, turning it on puts a Tracker Panel button on the chat that you can drag anywhere. Tap it to open the panel, and tap it again to close it. While the panel or another screen covers the chat, the chat's movable buttons are hidden, and they come back in the same places when you return to the chat. With the panel off, use the separate **World State** and **Player & Tracker** buttons.

The controls in the panel header also let you customize tracker structure:

- Click **+** to enter add mode. The World section gains **Add world field**, and each present-character card gains **Add custom field**. Field names remain visible in normal mode so their values are always understandable.
- Click the trash icon to enter delete mode, then remove custom world or character fields. Removing a field also removes its saved field locks.
- Click the lock icon to enter lock mode. Custom field values follow the same lock behavior as built-in tracker values.
- Click the crossed-out eye icon to enter hide mode, then choose **Mood**, **Look**, **Outfit**, or **Thoughts** on a character card. Hidden fields disappear from the Tracker Panel and Roleplay HUD, are cleared, and stay locked so tracker agents do not refill them. Enter hide mode again to show a hidden field as an empty field.

Custom field names define the structure and remain stable across tracker runs. Tracker agents update their values when the story changes them, while omitted agent output does not erase fields you created.

These settings control it:

- **Tracker Panel**: the master on or off toggle, the same one the die in Chat Settings turns on and off. It is on by default. When on, the label reads "Shown in the Roleplay HUD". When off, trackers show in the Trackers window on a computer.
- **Replace tracker HUD icons**: hides the separate tracker buttons on phones and lets the panel dock to the screen edge instead.
- **Use expression sprites for tracker portraits**: lets tracker portraits use a character's expression sprite (their current emotion portrait) instead of the plain avatar, when one exists. Expression sprites are explained in [Character Sprites](../characters/sprites.md).
- **Panel background**: a color or gradient picker for the panel's background.
- **Desktop size**: choose the panel width. The options are **Compact**, **Standard**, and **Expanded**.
- **Thought display mode**: choose how a character's thoughts appear. **Docked** opens them inside the character card. **Floating** opens them as a bubble beside the portrait.
- **Always show Docked thoughts**: when **Thought display mode** is **Docked**, keeps every featured character's thought visible instead of hiding it behind a button.
- **Temperature unit**: choose **°C** (Celsius) or **°F** (Fahrenheit) for temperature displays. The default is °C. This changes only the display, not the saved world-state value.

## Which agents populate the HUD

Every HUD widget is filled in by a tracker agent that runs after each turn. The widget table at the top of this guide lists which agent feeds each widget.

To set which stat bars and RPG attributes a persona or character starts with, use the **Stats** tab in the character or persona editor. The tracker agents then adjust those values as the story plays out.

## Related guides

- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Character Colors and RPG Stats](../characters/colors-and-stats.md)
- [Roleplay Mode: Getting Started](getting-started.md)
- [Game Mode: HUD Widgets](../game/hud-widgets.md)
