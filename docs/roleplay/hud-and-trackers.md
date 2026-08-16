# Roleplay HUD and Trackers

This guide explains the Roleplay HUD and the small tracker widgets it shows. You will learn how to edit and lock their values, and how the larger Tracker Panel works. It applies to Roleplay Mode in Marinara Engine.

## What the HUD is

The HUD (heads-up display) is a row of small icon widgets at the top of the chat area. Each widget shows a piece of live story state, such as the time, your stats, or who is present. Marinara keeps these values up to date for you as the story moves.

The values come from tracker agents. An agent is a small AI helper that runs in the background. Each tracker agent watches the story and updates one part of the HUD after each message. You do not have to ask for it.

A widget only appears when its tracker agent is turned on for the chat. You turn agents on and off in **Chat Settings**, under the **Agents** section. If no tracker agents are on, the HUD shows only the **Agents & Actions** button and no widgets.

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

## Editing values in a popover

Click any widget to open its popover. A popover is a small floating panel. Every field in it is editable, so you can correct a value the AI got wrong. Your edits save right away.

Here is what each popover lets you edit:

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

1. Open the widget's popover.
2. Click the lock toggle near the top of the popover. Its tooltip reads **Enter lock mode**.
3. A small lock button now appears next to each editable value.
4. Click the lock button beside the value you want to pin. Its tooltip reads **Lock field**.

To unlock, click the same button again (tooltip **Unlock field**). To leave lock mode, click the top toggle again (tooltip **Exit lock mode**). Lock mode is shared across the whole HUD, so turning it on in one popover reveals the lock buttons everywhere.

## Re-running a tracker

You can force a tracker to update instead of waiting for the next message.

Inside each popover there is a small refresh (circular arrow) button. Click it to re-run just that one tracker for the latest turn. The tooltips name the tracker, for example **Re-run world state tracker only** or **Re-run quest tracker only**.

In **Chat Settings → Agents**, **Manual Trackers** moves every enabled tracker to manual control. You can instead leave that switch off and set only selected agents to manual under **Individual tracker schedule**. A refresh button appears in the HUD row whenever at least one tracker is manual; click it to run the manual tracker set for the current turn. The refresh button inside each tracker popover still runs that individual tracker directly.

The sparkle icon at the start of the HUD row opens the **Agents & Actions** menu. From there you can re-run all trackers, retry any agents that failed, and use **Clear Trackers** to wipe all tracked world state for the chat. **Clear Trackers** cannot be undone, so use it with care.

## The Tracker Panel

The **Tracker Panel** is a larger side panel that shows the same tracker data as the compact HUD widgets. It gives the tracker cards more room and adds portrait and thought features. You set it up in **Settings**, under the **Appearance** tab, in the **Tracker Panel** section.

The controls in the panel header also let you customize tracker structure:

- Click **+** to enter add mode. The World section gains **Add world field**, and each present-character card gains **Add custom field**. Field names remain visible in normal mode so their values are always understandable.
- Click the trash icon to enter delete mode, then remove custom world or character fields. Removing a field also removes its saved field locks.
- Click the lock icon to enter lock mode. Custom field values follow the same lock behavior as built-in tracker values.
- Click the crossed-out eye icon to enter hide mode, then choose **Mood**, **Look**, **Outfit**, or **Thoughts** on a character card. Hidden fields disappear from the Tracker Panel and Roleplay HUD, are cleared, and stay locked so tracker agents do not refill them. Enter hide mode again to show a hidden field as an empty field.

Custom field names define the structure and remain stable across tracker runs. Tracker agents update their values when the story changes them, while omitted agent output does not erase fields you created.

These settings control it:

- **Tracker Panel**: the master on or off toggle. It is on by default. When on, the label reads "Shown in the Roleplay HUD".
- **Replace tracker HUD icons**: hides the compact icon strip so the panel can dock to the screen edge instead. The **Agents & Actions** button stays visible.
- **Use expression sprites for tracker portraits**: lets tracker portraits use a character's expression sprite (their current emotion portrait) instead of the plain avatar, when one exists. Expression sprites are explained in [Character Sprites](../characters/sprites.md).
- **Panel background**: a color or gradient picker for the panel's background.
- **Desktop size**: choose the panel width. The options are **Compact**, **Standard**, and **Expanded**.
- **Thought display mode**: choose how a character's thoughts appear. **Docked** opens them inside the character card. **Floating** opens them as a bubble beside the portrait.
- **Always show Docked thoughts**: when **Thought display mode** is **Docked**, keeps every featured character's thought visible instead of hiding it behind a button.
- **Temperature unit**: switch temperature displays between **Celsius** and **Fahrenheit**. The default is Celsius. This changes only the display, not the saved world-state value.

## Which agents populate the HUD

Every HUD widget is filled in by a tracker agent that runs after each turn. The widget table at the top of this guide lists which agent feeds each widget.

To set which stat bars and RPG attributes a persona or character starts with, use the **Stats** tab in the character or persona editor. The tracker agents then adjust those values as the story plays out.

## Related guides

- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Character Colors and RPG Stats](../characters/colors-and-stats.md)
- [Roleplay Mode: Getting Started](getting-started.md)
- [Game Mode: HUD Widgets](../game/hud-widgets.md)
