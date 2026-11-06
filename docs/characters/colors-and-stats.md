# Character Colors and RPG Stats

The **Colors** and **Stats** tabs appear in both the Character Editor and the Persona Editor. Colors change how a character or persona looks in chat. Stats set up values you can track, such as health or hunger.

## The Colors tab

The **Colors** tab sets three colors: the name color, the dialogue color and the message box color. Leave a field empty to use the app theme's color for that part.

1. Open a character or persona in its editor.
2. Click the **Colors** tab.
3. A live **Preview** card shows a sample name and message bubble, with the color fields below it. The preview updates as you change each color, before you save.

### Extract Colors from Avatar

**Extract Colors from Avatar** picks all three colors from the avatar image. Before an avatar exists, the button is off and reads **Upload an avatar first**. You can still change any color by hand afterward.

### The three colors

Set each with the color field, or type a value:

| Field | What it colors | Example value |
| --- | --- | --- |
| **Name Display Color** | The name. It also takes a gradient, see below. | `#f59e0b` |
| **Dialogue Highlight Color** | Text inside dialogue quotation marks. | `#ffd700` |
| **Message Box Color** | The background of the Roleplay message bubble. | `#123456` |

**Name Display Color** also takes a CSS gradient, a smooth blend between colors:

```text
linear-gradient(90deg, #f59e0b, #ef4444)
```

A character's **Colors** tab also has **Name Aliases**. Type extra names or nicknames, separated by commas, such as `Kate, Kitty, Katherine`. They get the character's name color when they appear in chat messages. The main name is always included. Turn it on per chat in **Chat Settings → Characters**.

To change transparency, use **Settings → Appearance → Roleplay Presentation → Roleplay Messages Background Opacity**.

The slider replaces the transparency saved in character, persona and preset background colors, including extracted ones. Your saved color values stay as they are. Name and dialogue colors are not affected.

Custom-theme background hooks and card CSS can still override the app's bubble styling.

### Where your colors show

- The name color colors the display name in chat messages. For a character it also colors the name in the sidebar tabs. For a persona it also colors the name in the persona pickers.
- The dialogue color colors text inside dialogue quotation marks, in straight quotes and other quote styles. You can also make this text bold in **Settings**. Conversation chats do not use it.
- The message box color sets the background of that character's or persona's message bubbles in Roleplay chats. Conversation and Game chats do not use it.

## The Stats tab

The **Stats** tab sets numbers such as HP (health points), STR (strength) or a hunger bar. When you turn stats on, Marinara adds the values to the prompt so the AI knows the current state. The values you set are the starting defaults for new chats. Agents can then change some of them during play (see [How agents update your stats](#how-agents-update-your-stats)).

The character and persona **Stats** tabs are laid out differently.

### Character stats

A character has one switch, **Enable RPG Stats**. Off, nothing below is shown or sent. On, two sections appear:

- **Pools** are named bars with a current value, a maximum and a color. New characters start with HP and MP, each at 100 of 100.
- **Attributes** are named numbers. New characters start with STR, DEX, CON, INT, WIS and CHA, each at 10.

Click **Add** to create a pool or attribute, and the X on a row to remove it.

### Persona stats

A persona **Stats** tab has two separate blocks, each with its own switch.

- **Persona Status Bars**, turned on with **Enable Persona Stats**, track physical and mental needs. The starter bars are Satiety, Energy, Hygiene and Mood, each at 100 of 100. Under **Status Bars**, each bar has a name, current value, maximum and color. Click **Add** to create one and the X to remove one.
- **Enable RPG Attributes** works like a character card. It gives your persona **Pools** (starting with HP and MP at 100 of 100) and **Attributes** (starting with STR, DEX, CON, INT, WIS and CHA at 10).

### Game Mode Icon

Both **Stats** tabs have a **Game Mode Icon** block. It sets the picture on this character's or persona's round token on the board in a Game Mode fight. A small token beside the choices shows what the board will draw.

- **Avatar** is the default. It uses the avatar, or the initials when there is no avatar.
- **Custom image** uses a picture from the card's own gallery. Pick one shown there, or upload a new one, which is added to the gallery. Save the card once before you use this.
- **Initials** always shows the initials, even with an avatar.

The same picture shows for this character in the other fight styles. If you delete the chosen picture from the gallery, the block says so. Pick another or switch back to **Avatar**.

### Ruleset sheets

When a Game Mode ruleset is installed, such as 5e (SRD 5.1), both **Stats** tabs gain a **Ruleset sheets** block below the sections above. It has one collapsible entry per installed ruleset. It also appears when a card still holds a sheet for a ruleset you no longer have.

A sheet is that character's starting build for that ruleset. A new game on the ruleset takes a copy. Changes made inside a game stay in that game and never come back to the card.

1. Open the entry and click **Add a sheet**. You get a blank sheet with every value at the ruleset's default.
2. Fill it in. The layout comes from the ruleset: ability scores with their modifiers, fields grouped by section, lists such as attacks and spells, and skills and saves with a training level and an extra bonus. Calculated values, such as a proficiency bonus or passive Perception, update as you type and cannot be edited.
3. Save the character or persona as usual.

You can also ask Professor Mari to fill in or change a sheet, for example "give Rook a Brawn of 2 and add a crowbar to Rook's gear". She writes only that ruleset's sheet, keeps every value within the ruleset's limits and shows the change on a change card.

Some rulesets ship ready-made spells, attacks and features. Lists they fill have an **Add from catalog** button that opens a searchable picker. The rows it adds are copies you can edit like any other.

- A cell the ruleset keeps for you, such as uses that follow an ability score or a class resource that grows with level, is shown in place but cannot be typed in. It carries the note "Set by the ruleset" and is worked out again every time you edit the sheet.
- When the ruleset's own text for one of those rows has changed since you picked it, a line under the list says how many rows have newer text, with a **Review** button. The review shows each row with your text beside the ruleset's, and a tick per row. **Update selected** writes only the ticked rows. Only text is compared. Numbers, switches and anything you typed in another column are left alone.

A sheet for a ruleset you do not have installed is kept. It shows as one line with a **Remove** button, is never sent to the AI, becomes editable again when you install that ruleset, and travels with the card when you export it. A sheet for an installed ruleset that this version cannot read, such as one saved by a newer version, is also kept as it is. Its entry offers **Remove this sheet** only, so a new sheet can never overwrite it by accident. Each sheet is limited to 64 KB.

Ruleset sheets are separate from **Enable RPG Stats** and **Enable RPG Attributes**. A game on Marinara's own rules ignores them. A game on a ruleset uses the sheet instead of the Attributes above for its checks.

## How agents update your stats

The **Stats** tab sets the chat's starting state. Agents update only tracker-owned values.

| Value | Who changes it |
| --- | --- |
| Character **Pools** such as HP | The **Character Tracker** agent, from combat, healing and story events. It does not track the player's persona. |
| **Persona Status Bars** | The **Persona Stats** agent, after each message. |
| **RPG Attributes** such as STR and DEX | No agent. They are sent with the card for combat and Game Mode, and for optional rolls in Roleplay or Game Mode. |

If you do not turn on the matching agent, tracker-owned values stay at the defaults you set. The **Stats** tab alone updates nothing during play. To turn these agents on, see [Downloadable Agents Reference](../agents/built-in-agents.md).

## How stats show in the HUD

Enabled stats appear in the HUD during a chat. The HUD is the small panel that shows your live values. Bars show as color-coded gradients. See [HUD and Trackers](../roleplay/hud-and-trackers.md) for how to move or hide it.

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Personas](personas.md)
- [HUD and Trackers](../roleplay/hud-and-trackers.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
