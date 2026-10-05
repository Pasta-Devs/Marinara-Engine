# Combat Encounters (Roleplay)

This guide explains combat encounters in Roleplay Mode. You will learn how to turn on the **Combat** agent, start a fight, and play it in the Encounter modal. It also explains how this feature differs from Game Mode combat.

Combat encounters are an optional Roleplay feature. They give your scene a structured, turn-based battle screen with health bars, enemy and party lists, and a combat log. If you never turn the feature on, your roleplay chats work exactly as before.

## Enabling the Combat agent

An agent is a helper that runs automatically during message generation. The **Combat** agent adds the battle feature to a Roleplay chat. It is off by default, so you must turn it on per chat.

1. Open the chat you want to add combat to.
2. Open **Chat Settings** (the **Chat Settings** button in the chat, at the top right unless you moved it).
3. Open the **Agents** section.
4. Turn on **Enable Agents** if it is not already on.
5. Add the **Combat** agent to the chat.

You should now see an **Encounter** button (a crossed-swords icon) in the action row above the message box. Its tooltip reads **Start Combat Encounter**. If you do not see this button, the **Combat** agent is not active for this chat.

For a full walkthrough of the Agents panel and how agents work, see [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).

## Starting an encounter

Click the **Encounter** button to open the setup box. This box is titled **Configure Combat Narrative**. It controls the writing style the AI uses during and after the fight.

The setup box has two style groups:

- **Combat Narration**: the writing style used while the fight is happening.
- **Summary Narration**: the writing style used for the summary written to the chat when the fight ends.

Each group has the same four controls:

- Tense: **Present Tense** or **Past Tense**.
- Person: **First Person**, **Second Person**, or **Third Person**.
- Narration: **Omniscient** (the narrator knows everything) or **Limited** (the narrator only knows what one character knows).
- A point-of-view text box: type whose eyes the scene is told through. Leave the box blank to keep a neutral narrator voice.

Below the style groups is an optional **Spellbook** dropdown. A spellbook is a special lorebook (a saved set of world information entries) that lists the spells and abilities available in the fight. Attach one so the AI knows what your characters can cast. Leave it on **None** if you do not use spellbooks.

When you are ready, click **Begin Combat**. Click **Cancel** to close the setup without starting a fight.

After you click **Begin Combat**, the app shows "Initializing combat encounter..." while the AI builds the fight. It creates the enemies, your party, their attacks, and their items. This can take a few seconds.

## Running the encounter (the Encounter modal)

The full battle screen (the Encounter modal) is titled **Combat Encounter**. It has these parts:

- **Enemies**: a grid of enemy cards. Each card shows a health bar and any status effects.
- **Party**: your side of the fight. Your own character is marked **(You)**.
- **Combat Log**: a running record of what happens each turn.
- **Your Actions**: the buttons you use on your turn.

Under **Your Actions** you can:

- Pick one of your **Attacks**.
- Use one of your **Items**.
- Type a free action in the **Custom Action** box and send it. Use this for anything the buttons do not cover, for example "I kick sand into the guard's eyes".

When an attack or item needs a target, a **Select Target** box opens. Pick a single enemy or ally, or pick **All Enemies** for an area attack that hits every enemy at once. Some actions are area-only and skip the single-target choice.

While the AI works out a turn, the screen shows "Processing action..." and your buttons are locked. They unlock when the turn finishes.

If the AI returns data the app cannot read, a **Combat Error** screen appears instead of a broken app. Click **Close Encounter** on that screen to safely leave the fight.

## Ending an encounter

There are two ways to end a fight early, plus the natural end when one side wins.

- Click **Conclude** in the top bar to end the fight early. A confirm box asks first. The app then writes a combat summary into the chat.
- Click the **X** button in the top bar to close and discard the fight. A confirm box titled **End Combat** asks first. This does not write a summary.

When a fight ends naturally, a result banner appears: **VICTORY**, **DEFEAT**, **FLED**, or **INTERRUPTED**. The app then writes a combat summary message into your chat, using the **Summary Narration** style you chose. When the summary is ready, click **Close Combat Window** to return to your scene.

If the summary fails to generate, the button reads **Close Anyway** instead. Click it to return to your scene without a summary.

## How it differs from Game Mode combat

Combat encounters are a lighter, separate combat layer for Roleplay Mode. Game Mode has its own, built-in combat system.

The key differences:

- You start a Roleplay encounter yourself with the **Encounter** button. In Game Mode, the AI Game Master starts combat when the story calls for it.
- Roleplay combat needs the **Combat** agent turned on. Game Mode combat does not use the **Combat** agent and works without it.
- The two systems use different battle screens and are not shared.

For the Game Mode battle system, see [Game Mode Combat](../game/combat.md).

## Related guides

- [Roleplay Mode: Getting Started](getting-started.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Game Mode Combat](../game/combat.md)
