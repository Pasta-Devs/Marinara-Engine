# Roleplay HUD and Trackers

The HUD (heads-up display) shows live story details in a Roleplay chat: the time, the weather, who is present, your stats, your items and your quests. You can fix any value by hand, lock a value so the AI stops changing it, and re-run a tracker on demand.

The values come from tracker agents. An agent is a helper that runs alongside replies. A tracker agent watches the story and updates one part of the HUD after each message. A widget shows only when its agent is on for the chat.

## Turn on the HUD

1. Open **Chat Settings** with the sliders button in the chat.
2. Go to **Agents** and turn on **Enable Agents**.
3. Add the agents from the lists below the switch. For a basic HUD, add **World State** first. Add **Persona Stats**, **Character Tracker** or **Quest Tracker** for more.
4. Send a message.

After the reply, the tracker appears. On a phone you see the **World State** button. On a computer you see the **Tracker Panel** or the **Trackers** window (see below). The widget table lists which agent feeds which widget.

If it did not work: with no tracker agents on, the HUD shows no widgets. Check that **Enable Agents** is on.

## Where the HUD appears

On a phone, the trackers are the movable **World State** and **Player & Tracker** buttons. Tap one to open its panel, and **X** to close it. Once World State has details, its button shows a small banner with the location, day, time, weather and temperature. Drag the buttons anywhere. Your chat remembers where you put them. They follow your **Chat widget style** in **Settings → Appearance → App**.

On a computer, the same trackers appear in one of two places:

- The **Tracker Panel**: a side panel beside your messages. It is on by default. The die button in the **Chat Settings** title bar turns it on and off.
- The **Trackers** window: a movable window that holds the trackers when the Tracker Panel is off.

You use only one of the two at a time. See [The Tracker Panel](#the-tracker-panel) and [The Trackers window](#the-trackers-window).

## The HUD widgets

| Widget | Needs this agent | Shows |
| --- | --- | --- |
| **World State** | World State | Location, date, time, weather, temperature and your custom world fields |
| **Persona Stats** | Persona Stats | Your persona's status bars and a status line |
| **Present Characters** | Character Tracker | Who is in the scene, with mood, look and custom fields |
| **Inventory** | Persona Stats | Items you carry, with quantities |
| **Inventory Tracker** | Inventory Tracker | Separate lists for currencies, equipped gear and carried items |
| **Active Quests** | Quest Tracker | Your current objective |
| **Custom Tracker** | Custom Tracker | Your own named fields, such as counters or currency |

The **Inventory** widget comes from the **Persona Stats** agent, so turn that on to get both. The **Inventory Tracker** is separate. It keeps entries in three groups, **Currencies**, **Equipped** and **Inventory**, and never lists equipped gear twice.

Each entry is a small pill. A quantity shows as `×4` only when it is more than one. To change a quantity of one, turn on add mode or lock mode: both show the quantity control on every entry. Add mode is the **+** button in the Tracker Panel header. [Lock mode](#lock-mode) is explained below.

**Present Characters** shows up to three character emoji plus a "+N" count. **Inventory** and **Custom Tracker** show their entries one at a time.

## Edit a tracker value

Every field is editable, so you can correct a value the AI got wrong. Your edit saves at once. The next reply starts from your corrected value, also when you regenerate or swipe the reply you corrected.

1. Open the tracker: tap its button on a phone, or open its section in the Tracker Panel or Trackers window on a computer.
2. Click the value and type the new one.

- **World State**: **Location**, **Date**, **Time**, **Weather**, **Temperature** and custom world fields.
- **Persona Stats**: a **Status** line, and named bars with a current and a max value. Add or remove bars.
- **Present Characters**: add or remove characters. Edit each one's emoji, name, **Mood**, **Look**, **Outfit**, **Thinks** (private thoughts) and custom fields. You can upload an avatar for each one. The **Auto** button turns "Auto-generate avatars" on or off.
- **Inventory**: add or remove items. Edit names and quantities.
- **Inventory Tracker**: add or remove entries under **Currencies**, **Equipped** and **Inventory**. To move an item to another group, remove it and add it there.
- **Active Quests**: add or remove quests. Each quest has objectives with checkboxes.
- **Custom Tracker**: add, remove or edit name and value fields.

To fix many values at once, use the [State Editor](#the-state-editor).

## Lock mode

Tracker agents overwrite HUD values after each turn. Lock mode lets you pin a value. When a field is locked, the next automatic run leaves it alone. Use it when a value keeps drifting wrong.

1. Open the tracker.
2. Click the lock toggle near the top of the tracker (tooltip **Enter lock mode**). A small lock button appears next to each editable value.
3. Click the lock button beside the value (tooltip **Lock field**). Locked fields are marked.

To unlock, click the same button again (**Unlock field**). To leave lock mode, click the top toggle again (**Exit lock mode**). Lock mode is shared across the whole HUD, so turning it on in one tracker shows the lock buttons everywhere.

## Re-run a tracker

To update a tracker now instead of waiting for the next message, click the circular-arrow button inside it. It re-runs only that tracker for the latest turn. The tooltip names the tracker, for example **Re-run world state tracker only**.

To make a tracker run only when you ask, open **Chat Settings → Agents → Trackers Control** and turn the tracker on under **Individual tracker schedule**. A manual tracker does not run after every reply. A chat that had the old **Manual Trackers** switch on shows every tracker turned on there.

While at least one tracker is manual, a refresh button appears: in the HUD row on a phone, and next to the Trackers window title on a computer. Click it to run the manual trackers for the current turn.

**Agent activity** is the place to re-run all trackers, retry failed agents and use **Clear Trackers**. See [Agent activity](getting-started.md#agent-activity).

> **Warning:** **Clear Trackers** wipes all tracked world state for the chat and cannot be undone.

## The Trackers window

On a computer, the trackers use the **Trackers** window when the Tracker Panel is off. If there is room beside your messages, it opens on the left. Otherwise it starts as a small **Trackers** button at the top left of the chat. Click the button to open it. A chat with a saved layout keeps your arrangement.

Move the window by its title bar and resize it from its edges. Its top-right buttons are:

- **Pin**: keeps it open when you click elsewhere. It starts pinned.
- **Lock**: stops it from moving or resizing, and fixes its button in place. The button still opens the window.
- **Close**: shrinks it to the movable **Trackers** button.

**Reset View** in Chat Settings clears the saved arrangement and picks the starting window or button to fit the space.

Each tracker has a collapsible section. Click its header to collapse it to a small preview, and again to open it. Marinara remembers which ones you collapsed.

To give one tracker its own window, click the pop-out button beside its arrow, or drag its title out of the Trackers window. The new window starts unpinned. Pin it to keep it open. **X** shrinks it to a small button with the tracker's icon. **World State** shrinks to a banner instead, with the same location, date, time and weather as on a phone, so you can drag it anywhere, such as the top middle of the chat. To return it, click **Put back in Trackers** (the curved arrow left of **X**) or drag it onto the Trackers window. Each chat remembers which trackers are out and where.

## The Tracker Panel

The **Tracker Panel** is a larger side panel with the same data. It also shows character portraits and thoughts.

1. Open **Chat Settings**.
2. Click the **Tracker Panel** button (the die) in its title bar, next to pin and lock. It stays highlighted while the panel is on.
3. Click it again to hide the panel. On a computer, the trackers then show in the Trackers window.

On a computer, the panel fits beside your messages, up to the width set by **Desktop size**. When the window is too narrow for both, such as with the chats sidebar open, your messages and message box narrow a little. On a phone or tablet, turning it on adds a draggable Tracker Panel button. Tap it to open the panel, and tap again to close it. While the panel or another screen covers the chat, the chat's movable buttons are hidden and come back in the same places.

### Customize tracker fields

The buttons in the panel header change the tracker's structure:

- **+** enters add mode. The World section gains **Add world field**, and each present-character card gains **Add custom field**. Field names stay visible in normal mode.
- The trash icon enters delete mode, where you remove custom world or character fields. Removing a field also removes its locks.
- The lock icon enters lock mode. Custom fields follow the same lock behavior as built-in ones.
- The crossed-out eye icon enters hide mode. Choose **Mood**, **Look**, **Outfit** or **Thoughts** on a character card. A hidden field disappears from the Tracker Panel and the HUD, is cleared, and stays locked so agents do not refill it. Enter hide mode again to show it as an empty field.

Agents update the values of your custom fields. They never delete a field you made.

### Make a new portrait

A character's large card can make a new portrait once the Character Tracker has an image connection. On a compact card, click **Feature character card** to open the large one. The Trackers window always shows large cards. Hover the portrait and click the eye button to make one from the **Look**, or the shirt button for the **Look** and **Outfit**. The shirt button shows only when the character has an outfit. The old portrait stays until the new one is ready. If making one fails, you keep the old one. Characters shown with their card avatar or an expression sprite do not have these buttons.

### Tracker Panel settings

Open **Settings → Appearance**, open the **Roleplay** group, and find the **Tracker Panel** section.

| Setting | What it does |
| --- | --- |
| **Tracker Panel** | The on/off switch, the same one the die turns. On by default. When on, the label reads "Shown in the Roleplay HUD". |
| **Dock Tracker Panel to edge** | Places the panel against the screen edge and keeps nearby chat controls clear of it. |
| **Use expression sprites for tracker portraits** | Uses a character's current expression sprite instead of the plain avatar, when one exists. See [Character Sprites](../characters/sprites.md). |
| **Panel background** | A color or gradient for the panel. |
| **Desktop size** | Panel width: **Compact**, **Standard** or **Expanded**. |
| **Thought display mode** | **Docked** opens thoughts inside the character card. **Floating** opens them as a bubble beside the portrait. |
| **Always show Docked thoughts** | With **Docked**, keeps every featured character's thought visible instead of behind a button. |
| **Stat display mode** | Shows stats as bars or as circular gauges. |
| **Temperature unit** | **°C** (default) or **°F**. This changes only the display, not the saved value. |

## The State Editor

The **State Editor** shows every tracker of the current turn in one window, so you can find a value and fix it without opening each tracker. It also works on a phone.

Open it from any of these:

- The gear (**Tracker panel settings**) in the Tracker Panel header, then the **{ }** button (**Open in State Editor**).
- The **{ }** button in the title bar of the **Trackers** window, or of a tracker you popped out.
- On a phone, the **{ }** button in the **World State** and **Player & Tracker** panels.
- The **Open in State Editor** link under **Tracker Data** in **Agent Suite**.

It opens on the section of the tracker you came from. World State opens on **Scene**, for example.

- **Turn line**: under the search box. It names the message and swipe you are editing, for example "Editing message #12 · swipe 2 of 3". **Latest** marks the newest turn. Each swipe has its own state, so swipe first to edit another one.
- **Sections**: **Scene**, **Present Characters**, **Persona Stats**, **Inventory Tracker**, **Custom Tracker Fields** and **Active Quests**. On a phone they are chips above the editor. A dot marks a changed section.
- **Search**: type a key or value, such as `mood`. Click a result to jump to it.
- **Fields**: each section opens as **Fields**, with boxes for text, numbers and on/off values.
- **No value**: an empty field shows a choice of **Text**, **Number** or **On/off**.
- **Add item**: adds an entry, copying the one above it.
- **Add**: adds a named field to a section or an empty card.
- **×**: removes an entry, or clears a value.
- **JSON**: edit the raw data. **Format** tidies it. A section with broken JSON cannot be saved until you fix it.
- **Revert**: undoes your changes to one section.

Characters and quests belong to the story, so you cannot add their cards here. You can edit lists inside them, such as a character's stats.

To save:

1. Click **Review changes** to see each change, line by line.
2. Click **Save changes**. This writes all sections at once to the turn you were editing.

Until then your drafts stay in the window, and closing it asks before throwing them away.

If it did not work: if the story moved on while you edited, the editor does not overwrite it. A new reply or swipe, or a tracker update to a section you changed, makes the save refuse with a **Reload** button. **Reload** shows the newest state and discards your drafts.

## Related guides

- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Character Colors and RPG Stats](../characters/colors-and-stats.md): the **Stats** tab sets the bars and attributes a persona or character starts with.
- [Roleplay Mode: Getting Started](getting-started.md)
- [Game Mode: HUD Widgets](../game/hud-widgets.md)
