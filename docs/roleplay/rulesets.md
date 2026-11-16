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

## Make your own ruleset

The ruleset builder makes a small ruleset from a form: how checks roll, what is on the sheet, and what the narrator is told. Use it for a system Marinara does not have. A ruleset you make works like an installed one, in Roleplay and in Game Mode.

Before you start: turn on **Allow custom Agent imports**, because the builder saves the ruleset the way an import does. See [Get a ruleset](../game/rulesets.md#get-a-ruleset).

1. In **Chat Settings → Ruleset**, click **New ruleset…**.
2. Type a **Name**.
3. Under **Dice**, pick how checks roll (see the table below). Picking one fills in starting stats, pools and tracks, which you can change.
4. Change the **Difficulties**, **Stats**, **Skills** and the rest of the form. Most sections explain themselves in a line under their title.
5. Click **Create ruleset**.

Marinara saves the ruleset. In a chat with no ruleset, it also turns the new one on. A chat that already has a ruleset keeps it and its sheets; to switch, pick the new ruleset in the list.

If an installed ruleset already rolls the way you picked, the **Dice** section names it. Each ruleset is a separate sheet on every character, so to keep one sheet per character, play or edit that ruleset instead of making another.

| Dice | How a check rolls |
| --- | --- |
| **d20 + modifier** | A d20 plus the stat and skill, against a difficulty number. |
| **2d6 bands** | 2d6 plus the stat: 10 or more is a strong hit, 7 to 9 a weak hit, 6 or less a miss. |
| **Dice pool** | One die per point of stat and skill. Each die that reaches the target number counts. You pick d6 or d10 and the target. |
| **Highest d6** | One d6 per point, keeping the highest: 6 is a full success, 4 or 5 a partial one, two 6s a critical. |
| **Percentile** | A d100. The check succeeds at or under the skill's number. |
| **Hope and Fear** | Two d12s plus the stat. The higher die says whether the result comes with Hope or with Fear. |
| **No dice** | Nothing is thrown. The stat and skill are added up and compared with the difficulty. |

### Change a ruleset you made

1. Turn the ruleset on for a chat.
2. In **Chat Settings → Ruleset**, click **Edit ruleset**.
3. Make your changes and click **Save new version**.

The chat moves to the new version and keeps every sheet. Renaming a stat, skill, pool or list column keeps what each character has in it. Another chat on the same ruleset moves to the new version when you click **Add missing sheets** in that chat.

**Edit ruleset** appears for a ruleset you made or imported from a file, when the form can hold all of it: one the builder made, or a hand-written file that uses only what the form shows. It does not appear for a ruleset from a package or a repository. The builder never opens a ruleset with anything more, such as combat rules or comments, so it cannot drop what it does not show. It also appears only in a chat that plays the newest version; in a chat on an older one, click **Add missing sheets** first.

### Lay out the sheet

| In the form | On the sheet |
| --- | --- |
| The order of rows | Stats, skills, pools, tracks, fields and list tabs show in the order of the form. Drag a row by its grip to move it, or focus the grip and press the up and down arrow keys. |
| A stat's or skill's **Group** | Stats or skills with the same group show under one heading. |
| **Skill ranks** | The ranks you pick for each skill on the sheet, each with what it adds: to the total on a d20 or 2d6 roll, dice on a pool, points on a percentile. |
| **Practice meter** | Each trained skill shows how far it is toward its next rank, from 0 to 99%. Practice in the story raises it, and a rank-up starts it over. You can correct it on the sheet. Under **No meter for:**, tick a group to leave its skills out. |
| **Number**, **Bar** or **Dots** on a pool or track | The number alone, a fill bar beside it, or a row of dots filled up to it, one dot a point. More than 20 dots show as a bar. |
| **Lists** | Each list gets its own tab, named after the list unless you type another tab name. Lists with the same tab name share a tab. |
| A list's columns | Every row has a name, plus your columns: **Text**, **Number** or **Checkbox**. The first checkbox column shows as a tick beside each name. |

### Tell the narrator about your rules

The **Prompts** section holds what the narrator is told about your ruleset. **Checks** and **Keeping the sheets** show a default; leave either empty to use it. Line breaks become spaces. Names and prompts can't contain square brackets or double curly braces, because the narrator's tags and macros use them.

| Box | What it is for |
| --- | --- |
| **Checks** | When to ask for a check, and how to pick the skill and difficulty. |
| **Keeping the sheets** | How the sheets change during play. |
| **Rules reference** | House rules and anything else the narrator should always have in front of it. |
| **World (Game Mode)** | Read once when a Game Mode game is created on the ruleset, so its world suits the rules. |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| **This chat's ruleset is not installed here, so its checks and sheets are paused.** | Install the ruleset again, or pick another one. |
| The narrator never asks for checks. | Use a stronger model for the chat. Some models skip the check instruction. |
| A new character has no sheet. | Click **Add missing sheets**. |

## Related guides

- [Game Mode: Playing with a Ruleset](../game/rulesets.md)
- [Dice and Skill Checks](../game/dice-and-skill-checks.md)
- [Roleplay Mode: Getting Started](getting-started.md)
