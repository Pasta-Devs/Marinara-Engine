# Game Mode: Party and NPCs

This guide covers the people in your Game Mode campaign: your party members and the NPCs (non-player characters) the Game Master introduces. You will learn how to open party character sheets, edit or regenerate them, and read the Adventure Journal, including NPC reputation labels. It also explains the two Game Master modes.

Game Mode is one of Marinara Engine's chat modes. It runs a single-player RPG (role-playing game) with an AI Game Master, often shortened to GM. For setup and the basics, see [Game Mode: Getting Started](getting-started.md).

## Character Profiles

Click or tap the **Character Profiles** avatar button to see the characters traveling with you. With several party members, the button cycles through their portraits and shows a count badge.

You can drag this button around the chat on a computer or phone. Open it and use **Lock window** to keep it in place. On a computer, you can also move and resize the window. **Close** returns it to its button. Its position is saved with the chat, and it follows your chat widget style from **Settings → Appearance → App**. On phones, it stays separate from the three-dot **Chat tools** menu.

Here is what you can do inside **Character Profiles**:

1. Click or tap a portrait to open that character's character sheet.
2. Hover over a portrait (on desktop) to reveal a small **X** button.
3. Click the **X** to remove that character from the party.

You can remove any companion the Game Master recruited, whether it joined during setup or later in the story. Your own persona is the character you play. It has no **X** button, so you cannot remove yourself from the party.

## Character sheets

A character sheet is a game-specific summary of one party member. It is separate from the character card. The Game Master writes it from your character and the current story.

Open **Character Profiles**, then click or tap that character's portrait. The sheet shows any of these sections that have content:

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
- **Wound tracks** are a row of boxes instead of a number, for systems that mark harm rather than count it. Each box says what that level of hurt is called and what it takes off your rolls. Pick the kind of harm first when the ruleset has more than one, then use **Mark** or **Clear one**. You can also click the next empty box to add a mark or the last marked box to clear one; other boxes do not respond to clicks. A worse mark takes the higher box and pushes lighter ones down, and the line underneath says which penalty is in force, along with anything that could not fit on the track at all. Some rulesets number their boxes instead of naming them, sometimes as many as a character's own rating, and some put each mark on the box it is aimed at: on those you can click any clear box, the lightest mark on the highest box is the one **Clear one** takes, and a track that is full refuses another mark instead of making an old one worse. A ruleset can also add boxes to a track from a list on your sheet, and have a rest or a heal clear only one kind of harm. If the ruleset says so, that penalty comes off your rolls: it takes dice off a pool, or is added to a summed roll, and the dice card says how much was applied.
- **Notes**, such as what a character is concentrating on, are short text boxes.
- **Conditions** are buttons you switch on and off.
- **States**, such as a form or a stance, are one value out of a list at a time. Pick the value from the list. A state can change the numbers that follow it, such as the dice a stance adds to your rolls, and a rest may put it back where it started.
- **Rest buttons** apply one of the ruleset's rests. What a rest restores is defined by the ruleset, and a rest can also bring back the charges of items the character carries, such as a wand's; the line under the buttons then says what came back. Under 5e (SRD 5.1), a long rest restores hit points and spell slots and brings back half of the character's hit dice, with a minimum of one.
- Below that is a short summary of the build: ability modifiers, trained skills and saves, and a few values the ruleset picks, such as armor class.

The Game Master keeps the same sheet up to date while it narrates. When a character spends a resource, takes damage, heals, gains or loses a condition, changes a state, or rests, it records the change, and the Engine checks it against the sheet. A change that is not possible, such as a spell cast with no slot left, is refused: nothing changes and a notice tells you so.

When a character uses something they picked from the ruleset's catalogs, such as a spell or a class feature, the Game Master names it and the Engine pays the whole price: whatever the ruleset says it costs, plus one use of each counter that came with it. A spell that costs a slot is paid from the slot level the ruleset names for it, and the Game Master can ask for a higher one instead. The Engine never climbs to a higher slot on its own. If any part of the price cannot be paid, the whole thing is refused and nothing is spent. Something that costs nothing, such as a cantrip, is simply narrated.

Some numbers on the sheet belong to the ruleset rather than to you. A class resource whose maximum follows your level, or uses that follow an ability score, is set by the ruleset and kept right when you edit the sheet.

Some calculated values follow play itself: a ruleset can work out a number from a resource or a track as it stands, give a number for each value of a state, or add up a column of a list, such as the weight of the gear you have packed. It can also cap a skill at a number like that, so a skill can shrink while a resource is low. These show their current value in the game's sheet, and the values a check or a fight uses are the ones at the moment it happens. The sheet editor on a character card, which has no game to read, shows them as they would be at the start of play.

These live values belong to the message they happened in. If you swipe to another version of a turn, or regenerate it, the sheet goes back to how it was before that turn, so nothing is ever spent twice.

Click **Edit sheet** to change the build itself, for example after a level-up: scores, fields, lists such as spells, and skill and save training. Calculated values update as you type. It is the same editor as the one on the character card, so rows can be added from the ruleset's catalogs here too, cells the ruleset keeps are shown but cannot be typed in, and a list whose ruleset text has changed offers a **Review** button. Click **Save sheet** when you are done. This changes only this game's copy of the sheet. The sheet stored on the character or persona is never changed by a game.

The separate **Edit Sheet** button described above still edits the general sheet (class, abilities, strengths and so on) and leaves the ruleset sheet alone.

If the ruleset's package was removed, or the installed copy is older than the one the game was created on, the block shows a notice instead, and checks cannot be rolled until the package is installed again.

## The inventory

Click **Inventory** above the narration to open it. Each square is a stack: an item and how many of it there are. Click a stack to select it.

Everyone in the party carries their own things. The inventory opens on **All**, which shows every bag together, with the name of whoever carries each stack in its corner. Click a party member's tab to see only their bag. While nobody else carries anything, there are no tabs and every stack is yours.

- **Change the amount.** Use **-** and **+** to take or add one. To change it by more, type into the number between them and press Enter: a number sets the count (`300`), and a sign adds or takes that many (`+100`, `-50`). Setting a stack to 0 removes it, and asks first when there is more than one.
- **Split a stack.** Click **Split**, type how many go into the new stack, and click **Split** again. Splitting 100 off 300 apples leaves a stack of 200 and a new stack of 100 beside it.
- **Give.** Click **Give**, pick who gets it and how many, and click **Give** again. To hand over a whole stack, you can also drag it onto that person's tab.
- **Add.** Type the item's name and click **Add**. It goes into the bag of the tab that is open, and into your own bag from **All**, unless your ruleset says what everyone can carry (see below). Adding an item that bag already has adds one to its first stack of it.
- **Merge or reorder.** Drag a stack onto another stack of the same item to merge them, whatever each is called. The merged stack stays with whoever carried the stack you dropped it on. Drag a stack onto a different item to swap the two.
- **From the ruleset.** In a game whose ruleset lists its own items, **From the ruleset** opens a picker of them, with the ruleset's search and filters. Tick the items you want and click **Add**: one of each goes where **Add** puts an item, into the bag of the tab that is open, or from **All** into your own bag unless your ruleset says what everyone can carry. A name you type that is one of the ruleset's items adds that item too. A ruleset can take only its own items, and then there is no name to type.
- **Use.** Click **Use** to tell the Game Master you use the item. For one of the ruleset's items that says what using it does, such as a healing poultice, the Engine does it first: it rolls what it gives back, writes that on the sheet of whoever carries it, takes one off the stack or spends a charge, and tells the Game Master what happened so the story follows it. What it does to somebody else is left to the Game Master to narrate. An item with nothing left is refused, and one that has to be worn is used only while it is. Some items ask a check first, such as a scroll above what you can read: the Engine rolls it, and if it fails the item is used up for nothing.
- **Nickname.** Type a new name for the stack and click **Save**. It is only what you call that stack: it stays the same item, the Game Master can still name it by its own name, and giving it a nickname never merges it into another stack. The item's own name is shown beside the nickname. Type the own name back to clear it.

A ruleset's item shows what it is when you select it: its kind, rarity, tags, stats and description. One stack of it holds only as many as the ruleset says, and anything past that starts a new stack. The Game Master can also invent an item in the ruleset's own words, such as a named blade. It works like the ruleset's own items, and its details say it was invented, with what the Engine changed to fit the ruleset, such as a bonus held to what its rarity allows. Some rulesets turn off Game Mode's own items: then the Game Master gives only the ruleset's items and the ones it invents, while you can still type in items of your own unless the ruleset takes only its own.

### Wearing, binding and carrying

A ruleset can also say how its items are worn and carried:

- **Equipped.** An item that takes slots, such as armor on the body or a bow in both hands, has an **Equipped** button. Its bearer can wear it while those slots are free; the bag's tab shows each slot in use, such as **Hands 2/2**. Equipping one item of a larger stack takes it into a stack of its own, marked as worn.
- **Binding.** An item that has to be bound to work (attuned, invested) has a button named for the ruleset's word for it, such as **Bound**. A character can bind only as many items as their sheet allows, shown as, for example, **Bound 1/3**. A cursed item, once bound, stays bound: you cannot unbind it, take it off, give it away or throw it out. Only the story, through the Game Master, can end the curse.
- **Carrying.** When the ruleset says what everything weighs and what each character can carry, each bag shows its load, such as **Load 5/6, at most 12**, and **Encumbered** once it passes what its bearer carries with ease. An item added from **All** goes to someone who can carry it without becoming encumbered: you first, then the party in order. When nobody can carry all of it, it is shared out by the room each has left, and nobody is ever given more than they can carry at all. What nobody can carry is left behind, and you are told. Handing someone more than they can carry is refused, whether by **Give** or by dragging a stack onto one in their bag.

Giving a worn or bound item to someone else takes it off and unbinds it.

A party member's character sheet lists what they carry.

The Game Master adds, removes and hands over items as the story goes, and says who carries them. An item it names that is one of the ruleset's items is that item, and it is told what each of the ruleset's items you hold is. It uses the ruleset's items the same way the **Use** button does. In a ruleset that says how items are worn and carried, it also puts items on and takes them off, binds and unbinds them, and sees each character's load, slots and bound items; an item it adds without saying who gets it is shared out the same way as yours. Each change is made when the reply is saved, and its notification appears when you reach that part of the story. When the Game Master takes an item without saying from whom, it comes from your bag first and then from the rest of the party. A change that cannot happen, such as taking something nobody has, is refused, and the Game Master is told. When you regenerate a reply, its changes start again from where that turn began, and swiping back to an earlier version shows what that version left. Deleting the version you are on shows what the next one left, and a branch of the chat keeps every version's inventory with it. This only happens while the inventory is still exactly as the reply left it: once you change something yourself, a new reply adds its changes on top and nothing you did is undone. A fight uses items from the **Items** action and counts every stack of an item together, whoever carries it and whatever it is called. Every bag, splits and nicknames included, carries over to the next session.

### Money

A ruleset can have its own money: one or more families of coins, such as pennies, shillings and crowns, where each larger coin is worth a number of the smallest. Coins are stacks like any item. They weigh what the ruleset says and count toward the load of whoever carries them, and you can split, give and merge them like anything else. **From the ruleset** has a **Coins** list for adding them by hand.

Above the stacks, a line shows each family of coins in the tab that is open and what they come to, such as **Coin: crowns ×2, pennies ×12 (worth 132 pennies)**.

The Game Master charges and pays the party in these coins, and a won fight or a treasure it rolls can drop them too. A payment comes out of one character's purse, yours unless it says whose, and only in the family the price is named in: the largest coins go first, and when the exact amount is not there a larger coin is broken and the change comes back in smaller ones. A price the purse cannot meet is refused, and the Game Master is told. A price in one family is never paid in another, so a price in salt is paid in salt. Money the party earns goes into the bags as any item does. Each payment and earning shows as a notification.

A variant of the ruleset can leave a coin out, such as a long night in which no crowns reach the barrows. Nobody is paid in that coin or pays with it then, and a price named in it is shown in the coins left, at the same worth.

A ruleset can also have markets, so what you can buy depends on where you are. The Game Master says which place a scene is in and how big it is, a hamlet or a city in the ruleset's own words, and a small place sells less: rare things may only be found in a town, and some sellers keep shop only in bigger places or serve only some buyers, such as a chapel that sells only to the faithful. When you buy something, the Engine works out the price from the item's cost and how cheap or dear the deal is, takes it from the buyer's purse and puts the item in their bag. Lodging, passage and other services are only paid for. A notification shows what was bought and for how much, and a purchase the place, the seller or the purse cannot make is refused, and the Game Master is told why.

## Recruiting and removing party members

The Game Master controls who is in your party as the story unfolds. There is no manual "add companion" button. Instead, the GM adds or removes party members through the narration, based on what happens in the scene.

To drop a companion yourself, use the **X** beside their portrait in **Character Profiles**, as described above. You cannot remove your own persona this way.

## The Adventure Journal

The Adventure Journal is a running record of your campaign. It is built from saved game events, not written by the AI, so it stays factual.

Open **Session** (see [Opening Session](sessions-and-saves.md#opening-session)), then choose the **Journal** tab. The Journal has these tabs:

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
