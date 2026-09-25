# Game Mode: Party and NPCs

This guide covers the people in your Game Mode campaign: your party members and the NPCs (non-player characters) the Game Master introduces. You will learn how to open party character sheets, edit or regenerate them, and read the Adventure Journal, including NPC reputation labels. It also explains the two Game Master modes.

Game Mode is one of Marinara Engine's chat modes. It runs a single-player RPG (role-playing game) with an AI Game Master, often shortened to GM. For setup and the basics, see [Game Mode: Getting Started](getting-started.md).

## The party bar

The party bar shows the characters traveling with you. It sits near the top of the game screen.

On a desktop screen, it is a horizontal row of small character portraits. On a phone, the bar collapses into a single avatar. When you have more than one party member, that avatar shows a count badge. Tap it to open the list of party members. With only one member, tapping the avatar opens that character's sheet directly.

Here is what you can do with the party bar:

1. Click or tap a portrait to open that character's character sheet.
2. Hover over a portrait (on desktop) to reveal a small **X** button.
3. Click the **X** to remove that character from the party.

You can remove any companion the Game Master recruited, whether it joined during setup or later in the story. Your own persona is the character you play. It has no **X** button, so you cannot remove yourself from the party.

## Character sheets

A character sheet is a game-specific summary of one party member. It is separate from the character card. The Game Master writes it from your character and the current story.

Open a sheet by clicking that character's portrait in the party bar. The sheet shows any of these sections that have content:

- **Attributes**: tabletop-style scores such as STR, DEX, and CON, each with a modifier.
- **Stats**: resource bars such as HP or MP.
- **Abilities**: things the character can do.
- **Strengths** and **Weaknesses**: short lists.
- **Details**: extra facts like Skills, Weapon, or Faction.
- **Inventory**: items the character carries.
- **Traits**: other custom fields.

If a character is new, you may see "Character data will populate as the story progresses." The sheet fills in as you play.

### Regenerate a sheet with AI

Click **Regenerate Sheet** to have the AI rewrite that character's sheet. It uses the character and the current game context. This is useful after the story has changed a character a lot.

### Edit a sheet by hand

Click **Edit Sheet** to change the sheet yourself. In edit mode you can set these:

- **Class** and a short description under **Sheet Details**.
- **RPG Attributes**: turn on **Enable** to track HP-style pools and attributes. Use **Add Pool** to add a bar (name, current value, max value, and color). Use **Add Attribute** to add a score such as STR.
- **Abilities**, **Strengths**, and **Weaknesses**: use **Add** to append a line.
- **Details**: use **Add Detail** to add a labeled fact.

When you are done, click **Save Sheet**. Click **Cancel** to discard your changes.

### The ruleset sheet

In a game that uses a ruleset (see [Games that use a ruleset](dice-and-skill-checks.md#games-that-use-a-ruleset)), each character sheet starts with a **Ruleset sheet** block. Its layout comes from the ruleset, so a 5e sheet and another system's sheet look different. A game with no ruleset does not have this block.

- **Resources** such as hit points, spell slots or a class resource show what is left out of the maximum. Use the minus and plus buttons, or type a number. A resource that has a temporary buffer also shows a **Temp** box.
- **Tracks**, such as exhaustion, step up and down within their range.
- **Wound tracks** are a row of boxes instead of a number, for systems that mark harm rather than count it. Each box says what that level of hurt is called and what it takes off your rolls. Pick the kind of harm first when the ruleset has more than one, then use **Mark** or **Clear one**. You can also click the next empty box to add a mark or the last marked box to clear one; other boxes do not respond to clicks. A worse mark takes the higher box and pushes lighter ones down, and the line underneath says which penalty is in force, along with anything that could not fit on the track at all. If the ruleset says so, that penalty comes off your rolls: it takes dice off a pool, or is added to a summed roll, and the dice card says how much was applied.
- **Notes**, such as what a character is concentrating on, are short text boxes.
- **Conditions** are buttons you switch on and off.
- **Rest buttons** apply one of the ruleset's rests. What a rest restores is defined by the ruleset. Under 5e (SRD 5.1), a long rest restores hit points and spell slots and brings back half of the character's hit dice, with a minimum of one.
- Below that is a short summary of the build: ability modifiers, trained skills and saves, and a few values the ruleset picks, such as armor class.

The Game Master keeps the same sheet up to date while it narrates. When a character spends a resource, takes damage, heals, gains or loses a condition, or rests, it records the change, and the Engine checks it against the sheet. A change that is not possible, such as a spell cast with no slot left, is refused: nothing changes and a notice tells you so.

When a character uses something they picked from the ruleset's catalogs, such as a spell or a class feature, the Game Master names it and the Engine pays the whole price: whatever the ruleset says it costs, plus one use of each counter that came with it. A spell that costs a slot is paid from the slot level the ruleset names for it, and the Game Master can ask for a higher one instead. The Engine never climbs to a higher slot on its own. If any part of the price cannot be paid, the whole thing is refused and nothing is spent. Something that costs nothing, such as a cantrip, is simply narrated.

Some numbers on the sheet belong to the ruleset rather than to you. A class resource whose maximum follows your level, or uses that follow an ability score, is set by the ruleset and kept right when you edit the sheet.

Some calculated values follow play itself: a ruleset can work out a number from a resource or a track as it stands, or add up a column of a list, such as the weight of the gear you have packed. It can also cap a skill at a number like that, so a skill can shrink while a resource is low. These show their current value in the game's sheet, and the values a check or a fight uses are the ones at the moment it happens. The sheet editor on a character card, which has no game to read, shows them as they would be at the start of play.

These live values belong to the message they happened in. If you swipe to another version of a turn, or regenerate it, the sheet goes back to how it was before that turn, so nothing is ever spent twice.

Click **Edit sheet** to change the build itself, for example after a level-up: scores, fields, lists such as spells, and skill and save training. Calculated values update as you type. It is the same editor as the one on the character card, so rows can be added from the ruleset's catalogs here too, cells the ruleset keeps are shown but cannot be typed in, and a list whose ruleset text has changed offers a **Review** button. Click **Save sheet** when you are done. This changes only this game's copy of the sheet. The sheet stored on the character or persona is never changed by a game.

The separate **Edit Sheet** button described above still edits the general sheet (class, abilities, strengths and so on) and leaves the ruleset sheet alone.

If the ruleset's package was removed, or the installed copy is older than the one the game was created on, the block shows a notice instead, and checks cannot be rolled until the package is installed again.

## Recruiting and removing party members

The Game Master controls who is in your party as the story unfolds. There is no manual "add companion" button. Instead, the GM adds or removes party members through the narration, based on what happens in the scene.

To drop a companion yourself, use the **X** button on the party bar, as described above. You cannot remove your own persona this way.

## The Adventure Journal

The Adventure Journal is a running record of your campaign. It is built from saved game events, not written by the AI, so it stays factual.

Click the **Session** button in the top toolbar, then choose the **Journal** tab. A Journal panel opens with these tabs:

- **Timeline**: a list of what has happened, such as locations found, NPC meetings, combat results, quests, and item events.
- **NPCs**: the NPCs you have met, with portraits and reputation labels (see below).
- **Map**: a plain list of the location names you have discovered.
- **Items**: a log of items you acquired, used, lost, or removed.
- **Library**: in-world notes and books the Game Master has shown you, saved so you can read them again.
- **Notes**: your own free-text notepad.

### Player notes

The **Notes** tab is your personal notepad. Type on the left, and a formatted preview shows on the right. A caption above the notepad warns that your notes are visible to the Game Master and party members. That means anything you write here can influence the story.

Your notes save on their own a moment after you stop typing. A small label shows **Saving...** while it saves and **Saved** when it is done.

## NPC reputation labels

The **NPCs** tab of the Adventure Journal tracks how each NPC feels about you. Every listed NPC shows a portrait, a name, and a reputation label.

The reputation label changes as you act in the story. It is one of these seven, from best to worst:

| Label | Meaning |
|---|---|
| **Devoted** | Deeply loyal to you |
| **Allied** | Strong ally |
| **Friendly** | Positive |
| **Neutral** | No strong feeling |
| **Unfriendly** | Negative |
| **Hostile** | Turned against you |
| **Enemy** | Actively opposed |

A label appears only after an NPC's reputation has moved away from the starting point. A brand-new NPC with unchanged reputation shows no label yet.

An NPC appears in this tab once the Game Master has described it, given it a reputation, or recorded a relationship note. Each NPC row also offers these actions:

- Upload or replace the NPC's portrait.
- Generate a portrait with AI, if image generation is on.
- Remove the NPC from the journal.

## Game Master modes

You pick who runs the game in the setup wizard, on the **Party** step, under **Game Master Mode**. There are two choices:

- **Standalone GM**: the default. Marinara builds a game master for you. The wizard describes it as "A snarky narrator running the show". You do not need a character card.
- **Character GM**: use one of your own character cards as the Game Master. The engine tells the model to act as that character while still running the game. Pick this when you want a specific narrator voice.

If this is your first game, use **Standalone GM**. You can set the mode when you create the game. For the full setup walkthrough, see [Game Mode: Getting Started](getting-started.md).

## Related guides

- [Game Mode: Getting Started](getting-started.md)
- [Game Mode: Sessions and Saves](sessions-and-saves.md)
