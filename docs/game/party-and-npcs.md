# Game Mode: Party and NPCs

This guide covers the people in your Game Mode campaign: your party members and the non-player characters (NPCs) the Game Master (GM) introduces. Use it to open and edit character sheets, manage the inventory, read the Adventure Journal and choose a GM mode. For setup and the basics, see [Game Mode: Getting Started](getting-started.md).

## Check your party and inventory

1. Click **Character Profiles** and pick a portrait to see that character's sheet.
2. Click **Inventory** above the story text to see what everyone carries.

Details for both follow.

## Character Profiles

**Character Profiles** is a portrait button that shows who travels with you. It stays outside the **Chat tools** menu (see [The Game's controls](getting-started.md#the-games-controls)). With several party members, it cycles through their portraits and shows a count badge. Before the story adds anyone, the party is only your persona.

1. Click or tap the **Character Profiles** button.
2. Click or tap a portrait to open that character's sheet.

To remove a companion, hover over their portrait on a computer and click the **X**. This works for any companion the GM recruited, in setup or later. Your own persona (the character you play) has no **X**.

You can drag the button around the chat on a computer or phone. Open it and use **Lock window** to keep it in place. On a computer you can also move and resize the window, and **Close** returns it to its button. Its position is saved with the chat, and it follows your chat widget style from **Settings → Appearance → App**. On phones it stays separate from the three-dot **Chat tools** menu.

## Character sheets

A character sheet is a game summary of one party member, separate from the character card. The GM writes it from your character and the current story. It shows the sections that have content:

| Section | What it holds |
| --- | --- |
| **Attributes** | Scores such as STR, DEX and CON with a modifier, and resource bars such as HP or MP. |
| **Stats** | Other stat bars. |
| **Abilities** | Things the character can do. |
| **Strengths**, **Weaknesses** | Short lists. |
| **Details** | Extra facts such as Skills, Weapon or Faction. |
| **Inventory** | Items the character carries. |
| **Traits** | Other custom fields. |

A new character may show "Character data will populate as the story progresses." The sheet fills in as you play.

### Edit a sheet by hand

**Retry**, **Save Sheet** and **Cancel** appear only after you click **Edit card**.

1. Open the character's sheet and click **Edit card**.
2. Change what you need:
   - **Class** and a short description under **Sheet Details**.
   - **RPG Attributes**: turn on **Enable** to track pools and attributes. **Add Pool** adds a bar (name, current value, max value, color). **Add Attribute** adds a score such as STR.
   - **Abilities**, **Strengths** and **Weaknesses**: **Add** appends a line.
   - **Details**: **Add Detail** adds a labeled fact.
3. Click **Save Sheet**. Click **Cancel** to discard your changes.

To have the AI recreate the sheet, click **Retry** while editing. It uses the character and the current game history, and makes a request to your model. It creates a draft: "new sheet draft is ready. Review it, then save to apply." Review the draft, then click **Save Sheet**. Use it after the story has changed a character a lot. On a narrow screen the button shows only an icon.

### The ruleset sheet

In a game on a ruleset, each sheet starts with a **Ruleset sheet** block laid out by the ruleset: its resources, tracks, conditions, rests and a build summary, kept up to date by the GM as it narrates. See [The ruleset sheet](rulesets.md#the-ruleset-sheet).

## Recruit and remove party members

The GM controls who is in your party through the narration. There is no "add companion" button.

When the GM adds an NPC whose name exactly matches one of your character cards, or matches several, a window asks which one joins. It shows each card's name, title and avatar. Pick a card, or choose **Keep the game's own** and the NPC's name (for example **Keep the game's own Emma**) to bring in the character the game made. Closing the window does the same. A card with only a similar name, such as **Samantha** for an NPC named Sam, is never added.

An Experience can bring its own companions: people of its world who can join you, each with a ready-made sheet. The story may bring one in or send one away, and the GM can recruit only those companions (your own library characters can still join). A companion joins at your party's highest level and levels up with the party.

## The inventory

Click the **Inventory** button above the story text. A grid of squares opens. Each square is a stack: an item and how many there are. Click a stack to select it.

Everyone in the party has their own bag. The inventory opens on **All**, which shows every bag together with the carrier's name on each stack. Click a party member's tab to see only their bag. While nobody else carries anything, there are no tabs.

- **Change the amount.** Use **-** and **+** to take or add one. Or type a number between them and press <kbd>Enter</kbd>.
  - A number sets the count: `300`.
  - A sign adds or takes that many: `+100`, `-50`.
  - Setting 0 removes the stack, and asks first when there is more than one.
- **Split a stack.** Click **Split**, type how many go in the new stack, click **Split** again.
- **Give.** Click **Give**, pick who gets it and how many, click **Give** again. Or drag a whole stack onto that person's tab.
- **Add.** Type the item's name and click **Add**. It goes into the open tab's bag, or your own bag from **All**. Adding an item the bag already has adds one to its first stack.
- **Merge.** Drag a stack onto another stack of the same item. The merged stack stays with whoever carried the stack you dropped it on.
- **Swap.** Drag a stack onto a different item to swap the two.
- **Use.** Click **Use** to tell the GM you use the item.
- **Nickname.** Type a new name and click **Save**. The item keeps its own name, shown beside it, and a nickname never merges stacks. Type the own name back to clear it.

### How the GM changes your inventory

The GM adds, removes and hands over items as the story goes, and says who carries them.

- When it takes an item without naming a holder, it comes from your bag first, then from the party.
- A change that cannot happen, such as taking something nobody has, is refused and the GM is told.
- Changes are made when the reply is saved. Regenerating a reply starts again from where that turn began. Swiping back shows what that version left. A branch keeps every version's inventory.
- If you change something yourself, a new reply adds its changes on top and nothing you did is undone.
- A fight uses items from the **Items** action and counts every stack of an item together.
- Every bag, split and nickname carries over to the next session.

## The Adventure Journal

The Adventure Journal is a running record of your campaign. It is built from saved game events, not written by the AI, so it stays factual.

1. Open **Session** (see [Opening Session](sessions-and-saves.md#opening-session)).
2. Choose the **Journal** tab.

| Tab | What it shows |
| --- | --- |
| **Timeline** | What has happened: locations found, NPC meetings, combat results, quests and item events. |
| **NPCs** | NPCs you have met, with portraits and reputation labels. |
| **Map** | A plain list of the location names you have discovered. |
| **Items** | A log of items you acquired, used, lost or removed. |
| **Library** | In-world notes and books the GM has shown you, saved for rereading. |
| **Notes** | Your own notepad. |
| **World** | In a game with a generated world, the world as your party knows it. |

The **World** tab shows where you are and how well known the party is, its standing with each group, what it has done, news that has reached it (rumours are marked), trouble brewing that it has heard of and the past any local would tell. It shows only what the party could know. Secrets only the GM knows stay hidden. It follows the story through swipes and branches.

### Player notes

On the **Notes** tab, type on the left and a formatted preview shows on the right. A caption warns that your notes are visible to the GM and party members, so anything you write can influence the story. Notes save a moment after you stop typing. The label shows **Saving...** and then **Saved**.

### NPC reputation labels

Each NPC in the **NPCs** tab shows a portrait, a name and a reputation label that changes as you act. An NPC appears once the GM has described it, given it a reputation or recorded a relationship note. A label appears only after the reputation has moved from its starting point, so a brand-new NPC shows none.

| Label | Meaning |
| --- | --- |
| **Devoted** | Deeply loyal to you |
| **Allied** | Strong ally |
| **Friendly** | Positive |
| **Neutral** | No strong feeling |
| **Unfriendly** | Negative |
| **Hostile** | Turned against you |
| **Enemy** | Actively opposed |

Each NPC row also lets you upload or replace the portrait, generate a portrait with AI (if image generation is on) and remove the NPC from the journal.

## Game Master modes

You pick who runs the game in the setup wizard, on the **Party** step, under **Game Master Mode**. The mode is set when you create the game.

- **Standalone GM** (default): Marinara builds a GM for you. The wizard describes it as "A snarky narrator running the show". You need no character card.
- **Character GM**: one of your own character cards is the GM. The model acts as that character while still running the game. Pick this for a specific narrator voice.

If this is your first game, use **Standalone GM**.

## Reference: ruleset inventory

These parts apply only to games that use a ruleset, or a setting kit with money. See [Playing with a Ruleset](rulesets.md).

### Ruleset items

These controls appear only when the game runs on a ruleset that has items.

- **From the ruleset** opens a picker of the ruleset's items with its search and filters. Tick items and click **Add**: one of each goes where **Add** puts an item. A name you type that is one of the ruleset's items adds that item. Some rulesets take only their own items, and then there is no name to type.
- **Starting gear** opens gear the ruleset offers to start with. Choose who it is **For**, make any choices the kit asks for and click **Take**. Gear that fits the character's sheet is listed first. Taking it is optional. Once everything is taken, the button reads **Starting gear (taken)**.
- **Use** on a ruleset item that says what it does, such as a healing poultice, makes Marinara apply it first:
  - It rolls what the item gives back and writes that on the carrier's sheet.
  - It takes one off the stack or spends a charge, and tells the GM what happened.
  - What it does to somebody else is left to the GM.
  - An item with nothing left is refused, and an item that must be worn works only while worn.
  - Some items ask for a check first, such as a scroll above your reading level. Marinara rolls it, and if it fails the item is used up for nothing.
- Selecting a ruleset item shows its kind, rarity, tags, stats and description. A stack holds only as many as the ruleset says, and extra items start a new stack.
- The GM can invent an item in the ruleset's words, such as a named blade. It works like a ruleset item, and its details say it was invented and what Marinara changed to fit the ruleset, such as a bonus held to what its rarity allows.
- Some rulesets turn off Game Mode's own items. The GM then gives only the ruleset's items and ones it invents, and you can still type items of your own unless the ruleset takes only its own.

### Wearing, binding and carrying

A ruleset can say how its items are worn and carried.

- **Equipped.** An item that takes slots, such as armor on the body or a bow in both hands, has an **Equipped** button. Its bearer can wear it while those slots are free. The bag's tab shows slots in use, such as **Hands 2/2**. Equipping one item of a larger stack moves it to a stack of its own, marked as worn.
- **Binding.** An item that must be bound to work (attuned, invested) has a button named for the ruleset's word, such as **Bound**. A character can bind only as many as the sheet allows, shown as **Bound 1/3**. A cursed item, once bound, cannot be unbound, taken off, given away or thrown out. Only the story, through the GM, can end the curse.
- **Carrying.** When the ruleset sets weights and capacity, each bag shows its load, such as **Load 5/6, at most 12**, and **Encumbered** once it passes what its bearer carries with ease. An item added from **All** goes to someone who can carry it without becoming encumbered: you first, then the party in order. If nobody can, it is shared by the room each has left, and nobody gets more than they can carry at all. What nobody can carry is left behind and you are told. **Give** or dragging a stack onto a bag that would exceed its limit is refused.

Giving a worn or bound item to someone else takes it off and unbinds it. In a ruleset with these rules, the GM also puts items on and off, binds and unbinds them and sees each load, slots and bound items.

### Money and markets

A ruleset can have its own money: families of coins, such as pennies, shillings and crowns, where each larger coin is worth a number of the smallest. Coins are stacks like any item. They weigh what the ruleset says, count toward the carrier's load, and you can split, give and merge them. **From the ruleset** has a **Coins** list for adding them by hand. Above the stacks, a line shows each family in the open tab and its total, such as **Coin: crowns ×2, pennies ×12 (worth 132 pennies)**.

- The GM charges and pays the party in these coins. A won fight or a rolled treasure can drop them too. A payment comes out of one character's purse, yours unless it says whose.
- A price is paid only in the family it is named in, so a price in salt is paid in salt. The largest coins go first, and a larger coin is broken when the exact amount is not there, with change in smaller coins.
- A price the purse cannot meet is refused and the GM is told. Each payment and earning shows as a notification.
- A variant of the ruleset can leave a coin out. Nobody pays or is paid in that coin then, and a price named in it is shown in the coins left, at the same worth.

A ruleset can also have markets, so what you can buy depends on where you are.

- The GM says which place a scene is in and how big it is, a hamlet or a city in the ruleset's words. A small place sells less: rare things may be found only in a town, and some sellers keep shop only in bigger places or serve only some buyers, such as a chapel that sells only to the faithful.
- When you buy, Marinara works out the price from the item's cost and how cheap or dear the deal is, takes it from the buyer's purse and puts the item in their bag. Lodging, passage and other services are only paid for.
- A purchase the place, seller or purse cannot make is refused and the GM is told why.
- A ruleset can make each day at a place different: a place may keep only a few of something rare, a seller may turn up something unusual, and you can sell things back at a share of the price until the sellers have spent what they pay out in a day. A new day at the same place, which the GM starts when the party stays on, fills the shelves and purses again.

A game without a ruleset has money and a market too when its setting kit has them. Every starter kit does, for example copper, silver and gold in high fantasy, copper cash and taels of silver in wuxia, dollars and cents in modern day, and credits in cyberpunk and space opera. The kit's shop lists everyday goods with a price and the smallest place that sells each, so a village has a café but only a town has a first-aid kit. You can change the money and the shop under the kit's **Change its words**, or remove the money. See [Choosing a setting kit](getting-started.md#choosing-a-setting-kit).

## Related guides

- [Game Mode: Playing with a Ruleset](rulesets.md)
- [Game Mode: Getting Started](getting-started.md)
- [Game Mode: Sessions and Saves](sessions-and-saves.md)
