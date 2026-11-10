# Roleplay: Playing by a Ruleset

A Roleplay chat can play by a tabletop ruleset, the same kind Game Mode uses. The narrator asks for a check when something uncertain happens, Marinara rolls the dice from the character's sheet, and the reply tells what the roll decided. Use this when you want real dice and a character sheet in a roleplay without starting a Game Mode game.

Any ruleset you have installed for Game Mode works, such as 5e (SRD 5.1), and so do the sheets you already made for it in the character and persona editors.

## Turn on a ruleset for a chat

Before you start: install a ruleset. See [Get a ruleset](../game/rulesets.md#get-a-ruleset).

1. Open the Roleplay chat.
2. Open **Chat Settings** and find the **Ruleset** section.
3. Pick a ruleset from the list. It shows the rulesets you have installed.
4. Marinara gives each member of the chat a sheet and says how many it added. Each member is listed under the ruleset.

Each member gets a copy of their own sheet for that ruleset from the character or persona editor (see [Ruleset sheets](../characters/colors-and-stats.md#ruleset-sheets)). A member without one gets a blank sheet, marked **blank sheet** in the list, to build in the chat. Your persona comes first. Changes in the chat stay in the chat and never go back to the character or persona.

If it did not work: an imported ruleset needs **Allow custom Agent imports** turned on. See [Get a ruleset](../game/rulesets.md#get-a-ruleset).

### Build a blank sheet

1. In the **Ruleset** section, click **Build sheet** beside the member.
2. The character sheet opens in the sheet editor. Where the ruleset has a guided builder, it opens on that first, the same as in Game Mode and the character editor.
3. Make your choices and click **Save sheet**.

### Add a sheet for a new member

When a character joins the chat later, click **Add missing sheets**. Members who already have a sheet keep it.

### Remove a sheet

A member who shouldn't have a sheet, such as a narrator card, can lose it.

1. In the **Ruleset** section, click the bin icon beside the member.
2. Click **Remove sheet**.

The chat remembers this, so **Add missing sheets** and a newer version of the ruleset leave that member out. To give them a sheet again, click their button after **No sheet:**, such as **Give Mira a sheet**.

### Change or turn off the ruleset

- Pick **None** to stop playing by the ruleset. The sheets are kept, so picking the same ruleset again continues where you left off.
- Picking a different ruleset starts every sheet over, because a sheet made for one ruleset means nothing to another.

## Checks in play

You write your turn as usual. When your character tries something uncertain whose outcome matters, the narrator writes a check instead of deciding the result. Marinara rolls it from the sheet, and the narrator then writes what the roll decided.

The finished message shows a dice card where the check happened, with the skill, the difficulty, the dice and **Success** or **Failure**. Ordinary actions that cannot really fail get no check.

> **Tip:** Some models ignore the instruction to ask for checks and decide outcomes themselves. If no checks appear, try a stronger model for the chat's **Connection**.

Checks are not rolled for **Impersonate** turns. A multiplayer room cannot play by a ruleset.

## Use the character sheets

Click **Open sheet** beside a member in the **Ruleset** section. The sheet is the same one Game Mode shows. The scroll button at the top of the tracker panel opens your persona's sheet.

- Click **−** and **+** beside a pool or track, such as hit points or stress, to change it. The change is saved with the current message, so it follows swipes and branches.
- Click **Edit ruleset sheet** to change scores, skill ranks, fields and lists, then **Save sheet**.

The narrator reads the sheets on every turn and changes them with sheet commands in its reply, which Marinara applies and hides from the message. To rest, say so in your turn, such as "we take a long rest". The narrator records the rest, and the sheets get back what the ruleset's rest restores. You can also click **Rest** on a sheet.

## Troubleshooting

| Symptom                                                                             | Fix                                                                        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **This chat's ruleset is not installed here, so its checks and sheets are paused.** | Install the ruleset again, or pick another one.                            |
| The narrator never asks for checks.                                                 | Use a stronger model for the chat. Some models skip the check instruction. |
| A new character has no sheet.                                                       | Click **Add missing sheets**.                                              |

## Related guides

- [Game Mode: Playing with a Ruleset](../game/rulesets.md)
- [Dice and Skill Checks](../game/dice-and-skill-checks.md)
- [Roleplay Mode: Getting Started](getting-started.md)
