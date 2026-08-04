# Character Colors and RPG Stats

This guide covers the **Colors** tab and the **Stats** tab in Marinara Engine. Both tabs appear in the Character editor and the Persona editor. Colors change how a character or your persona looks in chat. Stats set up trackable values like health or hunger.

## The Colors tab

Every character and persona has a **Colors** tab in its editor. It sets three colors: the name color, the dialogue color, and the message box color. Leave any field empty to use the app theme default color for that part.

To open the Colors tab:

1. Open a character in the Character editor, or a persona in the Persona editor.
2. Click the **Colors** tab in the tab list.
3. You should see a live **Preview** card and three color fields below it.

The **Preview** card shows a sample name and a sample message bubble. It updates as you change each color, so you can see the result before you save.

### Extract Colors from Avatar

The **Extract Colors from Avatar** button picks a name color, a dialogue color, and a message box color automatically from the avatar image. The button is only active once an avatar exists. Before you upload an avatar, the button is disabled and reads **Upload an avatar first**. After extraction you can still change any of the three colors by hand.

### The three colors

Set each color with the color field, or type a value:

- **Name Display Color**: the color of the name. This field also supports a CSS gradient. A gradient is a smooth blend between colors. Example value: `linear-gradient(90deg, #f59e0b, #ef4444)`.
- **Dialogue Highlight Color**: the color for text inside dialogue quotation marks. Example value: `#ffd700`.
- **Message Box Color**: the background color of the chat message bubble. Use a semi-transparent color for the best result. Example value: `rgba(0, 0, 0, 0.5)`.

A semi-transparent color lets some of the background show through the bubble. The `rgba` format is red, green, blue, and an alpha value from 0 (see-through) to 1 (solid).

## Where your colors show

Each color affects a different part of the chat:

- The name color colors the display name in chat messages. For a character it also colors the name in the sidebar tabs. For a persona it also colors the name in the persona pickers.
- The dialogue color colors text inside dialogue quotation marks. It works with straight quotes and other quote styles. You can also make this text bold from **Settings**.
- The message box color sets the background of that character or persona's chat message bubbles. It applies in both Conversation and Roleplay chats.

## The Stats tab

Every character and persona also has a **Stats** tab. Stats are numbers like HP (health points), STR (strength), or a hunger bar. When you turn stats on, the app adds the values to the prompt so the AI knows the current state. The values you set here are the starting defaults for new chats. Agents can then change them during play. See the section on agents below.

The Character **Stats** tab and the Persona **Stats** tab are laid out differently, so each is described on its own below.

### Character stats: Enable RPG Stats

A character has one toggle: **Enable RPG Stats**. When it is off, nothing below is shown or sent. When it is on, two sections appear:

- **Pools**: named bars with a current value, a maximum, and a color. New characters start with an HP pool and an MP pool, each at 100 out of 100. Click **Add** to create another pool. Click the X on a row to remove it.
- **Attributes**: named number values. New characters start with STR, DEX, CON, INT, WIS, and CHA, each at 10. Click **Add** to create another attribute. Click the X on a row to remove it.

### Persona stats: two sections

A persona **Stats** tab has two separate blocks, each with its own toggle.

The first block is **Persona Status Bars**, turned on with **Enable Persona Stats**. These bars track physical and mental needs. When you enable it, the starter bars are Satiety, Energy, Hygiene, and Mood, each at 100 out of 100. Under **Status Bars** you manage the list. Each bar has a name, a current value, a maximum, and a color. Click **Add** to create a bar and the X to remove one.

The second block is **RPG Attributes**, turned on with **Enable RPG Attributes**. This works like a character card. It gives your persona **Pools** (starting with HP and MP at 100 out of 100) and **Attributes** (starting with STR, DEX, CON, INT, WIS, and CHA at 10).

## How agents update your stats

The values on the **Stats** tab become the chat's starting state. Agents can update the tracker-owned values described below. RPG Attributes such as STR and DEX are card context rather than agent-managed tracker values.

- The **Character Tracker** agent adjusts tracked character Stats, including Pools such as HP, based on combat, healing, and story events. It does not track the player's persona.
- The **Persona Stats** agent adjusts your **Persona Status Bars** after each message, based on what happens in the story.
- Character and persona **RPG Attributes** are sent with their card for Combat and Game Mode, and for optional rolls in Roleplay or Game Mode. Agents do not update those Attributes.

If you do not enable the matching tracker agent, tracker-owned values stay at the defaults you set. The **Stats** tab by itself does not update anything on its own. See the built-in agents guide to turn these agents on.

## How stats show in the HUD

When stats are enabled, they appear in the HUD widget during a chat. HUD means heads-up display, a small panel that shows your live values. Bars show as color-coded gradients so you can read them at a glance. The HUD guide covers the full display and how to move or hide it.

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [User Personas: Creating and Editing](personas.md)
- [HUD and Trackers](../roleplay/hud-and-trackers.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
