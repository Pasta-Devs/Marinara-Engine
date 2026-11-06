# Combat Encounters (Roleplay)

A combat encounter gives a Roleplay scene a turn-based battle screen with health bars, enemy and party lists, and a combat log. It is optional. A chat without it works as before. Game Mode has its own separate combat: see [Game Mode Combat](../game/combat.md).

## Turn on combat

An agent is a helper that runs alongside replies. The **Combat** agent adds the battle feature. It is off by default, so you turn it on per chat.

1. Open the chat. Open **Chat Settings** with the sliders button in the chat.
2. Go to **Agents**.
3. Turn on **Enable Agents** if it is off.
4. Add the **Combat** agent from the lists below the switch.

An **Encounter** button (crossed swords) now appears above the message box. Its tooltip reads **Start Combat Encounter**.

If it did not work: without the button, the **Combat** agent is not active in this chat. For how agents work, see [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).

## Start an encounter

1. Click **Encounter**. The **Configure Combat Narrative** box opens. It sets the writing style the AI uses.
2. Choose the style for **Combat Narration** (while the fight happens) and for **Summary Narration** (the summary written to the chat when it ends). Both groups have the same four settings, listed below. The defaults work, so you can click **Begin Combat** right away.
3. Optional: pick a **Spellbook**. A spellbook is a lorebook (a saved set of world facts) that lists the spells and abilities available in the fight. Leave it on **None** if you do not use one.
4. Click **Begin Combat**. Click **Cancel** to close the box without a fight.

You see "Initializing combat encounter..." while the AI builds the enemies, your party, and their attacks and items. This can take a few seconds.

| Style control | Choices |
| --- | --- |
| Tense | **Present Tense**, **Past Tense** |
| Person | **First Person**, **Second Person**, **Third Person** |
| Narration | **Omniscient**: knows everything. **Limited**: knows what one character knows. |
| Point of view | A text box for whose eyes tell the scene. Leave it blank for a neutral narrator. |

## Play your turn

The **Combat Encounter** screen has four parts:

- **Enemies**: cards with a health bar and status effects.
- **Party**: your side. Your own character is marked **(You)**.
- **Combat Log**: a record of each turn.
- **Your Actions**: your buttons.

On your turn, pick an attack under **Attacks**, use an item under **Items**, or type a free action in **Custom Action** and send it, for example "I kick sand into the guard's eyes".

When an action needs a target, **Select Target** opens. Pick one enemy or ally, or **All Enemies** for an area attack. Area-only actions skip this step.

While the AI works out the turn, you see "Processing action..." and your buttons are locked. They unlock when the turn finishes.

If it did not work: if the AI returns data the app cannot read, a **Combat Error** screen appears. Click **Close Encounter** to leave the fight safely, then start a new one.

## End an encounter

- **Conclude** in the top bar ends the fight early. A box asks to confirm, then a combat summary is written to the chat.
- The **X** in the top bar closes and discards the fight, after a confirm box titled **End Combat**. No summary is written.
- When one side wins, a banner shows **VICTORY**, **DEFEAT**, **FLED** or **INTERRUPTED**. A summary is written to the chat in your **Summary Narration** style. When it is ready, click **Close Combat Window**.

If the summary fails, the button reads **Close Anyway**. Click it to return to the scene without a summary.

## How it differs from Game Mode combat

- You start a Roleplay encounter yourself with **Encounter**. In Game Mode, the Game Master starts combat when the story calls for it.
- Roleplay combat needs the **Combat** agent. Game Mode combat does not.
- The two systems use different battle screens.

## Related guides

- [Roleplay Mode: Getting Started](getting-started.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Game Mode Combat](../game/combat.md)
