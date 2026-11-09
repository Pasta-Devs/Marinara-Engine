# Roleplay: Playing by a Ruleset

A Roleplay chat can play by a tabletop ruleset, the same kind Game Mode uses. The narrator asks for a check when something uncertain happens, Marinara rolls the dice from the character's sheet, and the reply tells what the roll decided. Use this when you want real dice and a character sheet in a roleplay without starting a Game Mode game.

You can use an installed ruleset such as 5e (SRD 5.1), or make your own in Chat Settings with the ruleset builder.

## Turn on a ruleset for a chat

Before you start: install a ruleset (see [Get a ruleset](../game/rulesets.md#get-a-ruleset)), or make one (see [Make your own ruleset](#make-your-own-ruleset)).

1. Open the Roleplay chat.
2. Open **Chat Settings** and find the **Ruleset** section.
3. Pick a ruleset from the list. It shows the rulesets you have installed.
4. Marinara gives each member of the chat a sheet and says how many it added. The line under the list names who has one, such as **Sheets: Blake, Mira**.

Each member gets a copy of their own sheet for that ruleset from the character or persona editor (see [Ruleset sheets](../characters/colors-and-stats.md#ruleset-sheets)), or a blank sheet with the ruleset's starting values. Your persona's sheet comes first. Changes in the chat stay in the chat and never go back to the character or persona.

If it did not work: an imported or homemade ruleset needs **Allow custom Agent imports** turned on. See [Get a ruleset](../game/rulesets.md#get-a-ruleset).

### Add a sheet for a new member

When a character joins the chat later, click **Add missing sheets**. Members who already have a sheet keep it.

### Change or turn off the ruleset

- Pick **None** to stop playing by the ruleset. The sheets are kept, so picking the same ruleset again continues where you left off.
- Picking a different ruleset starts every sheet over, because a sheet made for one ruleset means nothing to another.

## Checks in play

You write your turn as usual. When your character tries something uncertain whose outcome matters, the narrator writes a check instead of deciding the result. Marinara rolls it from the sheet, and the narrator then writes what the roll decided.

The finished message shows a dice card where the check happened, with the skill, the difficulty, the dice and **Success** or **Failure**. Some rulesets add a line to the card:

| Line on the card | Means |
| --- | --- |
| **With Hope** / **With Fear** | Which of the two named dice rolled higher. |
| **Both dice matched: a critical success** | The two named dice showed the same number. |
| **Messy critical** / **Bestial failure** | A special-dice result, as in Vampire. |
| **Pushed: 2 dice thrown again** | The roll was pushed, as in the Year Zero Engine. |
| **Result moved +1 band** | The narrator moved the result a step, as the ruleset allows. |

Ordinary actions that cannot really fail get no check.

> **Tip:** Some models ignore the instruction to ask for checks and decide outcomes themselves. If no checks appear, try a stronger model for the chat's **Connection**.

Checks are not rolled for **Impersonate** turns or in multiplayer rooms.

## Use the character sheets

Click **Open sheets** in the **Ruleset** section to open **Character sheets** in its own window. It has one tab for each member.

- Click **−** and **+** beside a pool or track, such as hit points or stress, to change it. The change is saved with the current message, so it follows swipes and branches.
- Click **Edit ruleset sheet** to change scores, skill ranks, fields and lists, then **Save sheet**.
- Click a tab such as **Gear** to see a list on its own tab.

The narrator reads the sheets on every turn and changes them with sheet commands, which Marinara applies and hides from the message. To rest, say so in your turn, such as "we take a long rest". The narrator records the rest, and the sheets get back what the ruleset's rest restores. You can also click **Rest** on a sheet.

## Let an agent keep the sheets

You can hand sheet-keeping to a separate agent, so the narrator only writes the story and asks for checks. The agent reads each finished reply and records what it did to the sheets: damage, healing, points spent, a rest.

1. Create a custom agent (see [Creating Custom Agents](../agents/custom-agents.md)).
2. Set **Pipeline Phase** to **Post-Processing**.
3. Under **Custom Agent Abilities**, turn on **Edit trackers**.
4. Set **Result Type** to **Ruleset Sheet Keeper**.
5. Save the agent and add it to the chat in **Chat Settings → Agents**.

While the agent is on, the narrator is told to describe changes in the story and leave the sheet commands to the agent.

## Make your own ruleset

The ruleset builder makes a small ruleset from a form: how checks roll, what is on the sheet, and what the narrator is told. A homemade ruleset works like an installed one, in Roleplay and in Game Mode.

1. In **Chat Settings → Ruleset**, click **New ruleset…**.
2. Type a **Name**.
3. Under **Dice**, pick how checks roll (see the table below). Picking one fills in usual stats, pools and tracks for that style, which you can change.
4. Change the **Difficulties**, **Stats**, **Skills** and the rest of the form as you like. Each section explains itself in a line under its title.
5. Click **Create ruleset**.

Marinara saves the ruleset and turns it on for the chat.

| Dice | How a check rolls |
| --- | --- |
| **d20 + modifier** | A d20 plus the stat and skill, against a difficulty number. |
| **2d6 bands** | 2d6 plus the stat: 10 or more is a strong hit, 7 to 9 a weak hit, 6 or less a miss. |
| **Dice pool** | One die per point of stat and skill, counting the dice that reach the target number. You pick d6 or d10 and the target. |
| **Highest d6** | One d6 per point, keeping the highest: 6 is a full success, 4 or 5 a partial one, two 6s a critical. |
| **Percentile** | A d100, succeeding at or under the skill's number. |
| **Hope and Fear** | Two d12s plus the stat. The higher die says whether the result comes with Hope or with Fear. |
| **Diceless** | No dice. The narrator never asks for a check and decides outcomes from the character sheets. The **Checks** box becomes **Outcomes**, where you say how. |

### Change a ruleset you made

1. Turn the ruleset on for a chat.
2. In **Chat Settings → Ruleset**, click **Edit ruleset**.
3. Make your changes and click **Save new version**.

The chat moves to the new version and keeps every sheet. Another chat on the same ruleset moves to the new version when you click **Add missing sheets** in that chat. **Edit ruleset** appears only for rulesets made with the builder.

### Lay out the sheet

| In the form | On the sheet |
| --- | --- |
| The order of rows | Stats, skills, pools, tracks, fields and list tabs show in the order of the form. Drag a row by its grip to move it, or focus the grip and press the up and down arrow keys. |
| A stat's or skill's **Group** | Stats or skills with the same group show under one heading. |
| **Skill ranks** | The ranks you pick for each skill on the sheet, each with what it adds: to the total on a d20 or 2d6 roll, dice on a pool, points on a percentile. |
| **Bar** on a pool or track | A fill bar beside its number. |
| **Lists** | Each list gets its own tab, named after the list unless you type another tab name. Lists with the same tab name share a tab. |
| A list's columns | Every row has a name, plus your columns: **Text**, **Number** or **Checkbox**. The first checkbox column shows as a tick beside each name. |

### Tell the narrator about your rules

The **Prompts** section holds what the narrator is told about your ruleset. Leave a box empty to use the default shown in it. Line breaks become spaces.

| Box | What it is for |
| --- | --- |
| **Checks** | When to ask for a check, and how to pick the skill and difficulty. |
| **Keeping the sheets** | How the sheets change during play. The narrator reads it, or the Sheet Keeper agent when one is on. |
| **Rules reference** | House rules and anything else the narrator should always have in front of it. |
| **World (Game Mode)** | Read once when a Game Mode game is created on the ruleset, so its world suits the rules. |

For anything the builder does not cover, such as combat, catalogs of spells or layers, write a ruleset file instead. See [Writing Game Mode Rulesets](../extending/writing-rulesets.md).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| **This chat's ruleset is not installed here, so its checks and sheets are paused.** | Install the ruleset again, or pick another one. |
| The narrator never asks for checks. | Use a stronger model for the chat. Some models skip the check instruction. |
| A new character has no sheet. | Click **Add missing sheets**. |
| Saving a new ruleset fails. | Turn on **Allow custom Agent imports**. A homemade ruleset is saved like an imported one. |

## Related guides

- [Game Mode: Playing with a Ruleset](../game/rulesets.md)
- [Dice and Skill Checks](../game/dice-and-skill-checks.md)
- [Creating Custom Agents](../agents/custom-agents.md)
- [Roleplay Mode: Getting Started](getting-started.md)
