# Overworld games (unreleased)

Developer notes only. **Overworld** games (setting kits, generated worlds, the overworld map, towns and dungeon maps) are not implemented for players yet. Nothing here is user documentation: Professor Mari and the in-app Docs page do not read `docs/development` (apart from the few guides they list), so keep Overworld material in this file until the mode ships. When it ships, move these sections back into the player guides under `docs/game/`.

The mode stays locked unless the server sets this flag. Do not document it in `docs/CONFIGURATION.md` or `.env.example` while the mode is unfinished.

| Variable | Default | Description |
| --- | --- | --- |
| `MARINARA_OVERWORLD_GAMES` | `false` | Lets players make Overworld games (a setting kit and a generated world) and turn a legacy game into one. Off, the wizard offers VN games only. |

## Setup: game mode, setting kit and world

### VN or Overworld

A new game is played in one of two game modes, chosen on the first step and kept for all its sessions:

- **Overworld** is a world made for your setting, walked on an overworld map, with towns, places to explore and dungeons. It needs a setting kit and a world. Until you pick a kit, the one for your first genre is used (High fantasy if the genre has none), and a world is rolled for it.
- **VN** is Game Mode as it always was, told like a visual novel: scene by scene, with the scene map and battles, and no setting kit, world, overworld, towns or dungeon maps.

Overworld is locked unless the server owner sets `MARINARA_OVERWORLD_GAMES`. While locked, its card is greyed out with the note "Overworld games, with a setting kit and a generated world, are not ready yet. New games start as VN games." Every new game is then a VN game, and the setting kit and world choices do not appear. A game made before the choice existed keeps playing as it did: with a world it is an Overworld game, without one a VN game.

### Choosing a setting kit

A **Setting kit** gives the GM the words your kind of world is written in: place names and settlement sizes, kinds of group, how people travel, names for a year and a day, how peoples name themselves, money and goods, elements, battle places and which family of art and music it uses (see [Game Assets](#art-and-music-families)). It also says which kinds of change the world allows, such as rivalries, crime, wars or disasters, and how fast it changes. A kind that is off is never brought in, so a quarrel can stay a quarrel.

There are eight kits: high fantasy, wuxia and xianxia, modern day, modern supernatural, the 1920s, cyberpunk, space opera and post-apocalyptic. Modern day is gentle by default, with no crime, conflict or catastrophe, at a slow pace.

- Picking a kit before a genre sets the genre that fits it. A genre you chose yourself stays.
- **Write it for my setting** asks your GM model to rewrite the kit for your genre, setting and tone. If the result does not hold together, the model is asked once more with the reasons. If it still fails, the wizard tells you what was wrong and keeps the kit you had.
- **Change its words** opens every word of the kit. Type a list on one line, separated by commas. A kit with a problem, such as an empty name or no settlements, says what is wrong, and the game cannot start until it is fixed.
- **Download this kit** saves a `.worldkit.json` file to share. **Import a kit file** reads one back in.

The game keeps the kit it was created with, and a shared setup file carries it. An Experience can ship its own map pack (a kit, ready-made maps and tiles). With that Experience on, the setup shows its kit as set and, if it ships maps, a **Map** to pick. Turning the Experience off gives your choices back.

### Making a world

With a kit chosen, **Your world** lays out a world in the kit's words before the game starts: regions, settlements of every size, what each place is known for and the ways between them (roads, rivers, sea lanes, jump lanes) with trip times in days.

A world comes from a **World seed**. The same seed, kit and brief always make the same world. **Roll** gives another, and typing a number back brings one back. The preview shows a small map of the ground and settlements, where the party starts and a list of settlements by region.

- **Start from this lore** reads the ticked lorebooks for the places and dated events they state, kept exactly as written. **Build around the lore** fills the world in around them. **Only the lore's places** makes nothing beside them.
- **Write the world's brief** asks your GM model for the present day, the major places, the groups the present day turns on (what each wants, and its allies and rivals) and names for places and people in each people's own sound. The lore's places are kept whatever the model writes. Anything that does not fit the kit is left out and counted. **Change the brief** opens its words, including each people's given and family names. Without a brief, places are numbered and people go by their job.

**A world has a past.** Before the game begins, the world runs forward year by year from its founding. Settlements grow, groups are founded, take and lose leaders and fall in and out with each other. Where the world has them, bandits, wars and famines leave marks. A severe change comes only after it has been brewing, and only in the kinds the kit allows. Dated events from your lore or the brief happen when and where they say. The same seed and brief give the same past.

**What the GM knows.** The GM always knows where the party is, where it can go and how long each way takes. It is told the most notable events of the past, who leads the current place and that place's history. For any other place or group it can ask and gets the answer on its next turn. It names where the party goes with a place tag. A listed place keeps the size the world gave it. A place the world does not list, such as a farmhouse, keeps the name the GM gives it. Each settlement has people drawn by the seed when the party arrives: a name from their culture, a job suited to the place, a temperament, speech and looks. When the GM names someone in full, they join the tracked characters.

**What the party does stays done.** When the party helps or hinders a group, changes how two groups feel about each other, takes or ruins a place or puts someone at a group's head, the GM records it in its reply. Each change is checked against the world. A change of a kind the kit has off, or one naming a place or group the world does not have, is refused. From then on the GM is told the world as the story left it. A place the story added is a place the party can go. A swipe, a regeneration or a deleted message takes a change back with its reply.

**The world goes on without the party.** When the GM says time passes, the world steps forward a week at a time, only in the kinds of change the kit has. Catastrophes never come on their own: only the GM can narrate one, and it is refused if its kind is off. Nothing is decided where the party is. News travels: the GM hears of a far change once the days the roads take have passed. The party's deeds count for more as it becomes known.

**Hand edits.** In a world editor you can rename or move places, paint the ground, add places and people, paint a place's tactical battlefield (see [Combat](../game/combat.md#tactical-battles-and-terrain)) and lay out a town (see [The town](#the-town)). Every part of the game sees the edits at once. A renamed place still answers to its old name. Edits change the world from now on, never its past. A town keeps its layout, so places and people you add go on its next free plots and homes.

**World files.** **Download this world** (under **Your world**) saves the world you are making, and **Download the world** on a game's World tab saves that game's world with hand edits as a `.world.json` file. **Import a world file** (beside the setting kit) reads one into a new game's setup: it picks the file's kit and makes its world. **Your worlds** does the same with a world from your library. A file can also carry the world's story: events and scenes its creator wrote. A story's scenes appear in the narration before the GM's reply, exactly as written, and its quest objectives are listed under **Story** on the journal's World tab. To write one, see [Writing Game Mode Story Scripts](writing-story-scripts.md). Hand edits and the story belong to that seed and brief, so they are left out if you change either. A file that cannot be read is refused and the wizard says why. A file whose content does not fit the kit is partly left out and the wizard says what.

**Later and saved.** A game made without a world can be given one later from the journal's **World** tab with **Make a world for this game**. The world starts from the next turn, and past turns, map and people stay. The button is greyed out while Overworld RPG is locked. A game keeps its world as it was made, so a new session, a branch and an exported chat keep the same world. A world made by an earlier version of the generator plays on but can no longer be edited.

A game with a world opens on the **overworld**, a pixel map where you walk the party between settlements and enter towns. See [The overworld](#the-overworld).

## Maps

### The overworld

A game with a generated world (see [Making a world](#making-a-world)) opens on the **overworld**: the world's ground drawn as a pixel map behind the narration, with forests, hills, coasts and seas, the roads and lanes between settlements, each settlement drawn by its size, and your party. The bigger places are named, and so is the one you are in. Drag the map to look around.

1. Tap or click a settlement, or pick it from **Places** (nearest first, with the trip time).
2. Read its size and the trip from where you are: days or hours, and by which ways.
3. Click **Walk there**. The party goes along the world's ways by the quickest route, and the walk's days pass on the clock at once.

Your next turn tells the GM where you walked, how long it took and by which ways, so it can tell the arrival. A second walk before your next turn carries on from where the first ended.

Caves, mines, crypts and ruins a few steps out of a settlement are drawn as **sites**. A new world has one or two in each region, named after the settlement beside them ("Hollin Caves", "Ashby Ruins"). **Walk there** goes along the ways to its settlement and then off the road on foot. At a site, **Enter** opens its map (see [Dungeons, caves and stations](#dungeons-caves-and-stations)). A site that matters to the story stays **closed** (faded, no trip, no entry) until the GM opens it. A world maker can also hide a site until then or open it from the start.

A place in ruins is drawn in ruins. After dark the map dims and windows light up. Each setting family (fantasy, wuxia, modern day, the 1920s, science fiction, the wasteland) has its own tiles. A kit with no family draws plain tiles.

To switch between views, use **Show the scene** and **Show the overworld** in **Game controls** (on a phone, in the three-dot **Chat tools** menu). The game remembers your choice. A fight and a session replay use their own screens.

### Tile packs

Tile packs hold the palette and every tile (each kind of ground, settlements by size, the party, and a town's streets, roofs and townsfolk) as rows of pixels. Every setting family has a built-in pack. Open the **Agents** panel and find **Tile packs** to:

- choose which pack each setting is drawn with (**Built in** is its own),
- **Import a tile pack** from a `.tilepack.json` file,
- **Export** a pack to share it, or **Remove** it, which sends any setting drawn with it back to its own tiles.

A pack only needs the tiles it changes, and anything it leaves out is drawn plain. A pack that names a tile Marinara does not draw keeps the rest and says what it left out.

### The town

At a settlement, pick it on the overworld and choose **Enter** to see the town. It is laid out from the world: streets and a square, places the world or story has in it (named on their buildings), a hall in a bigger place, workplaces for the trades the place is known for, and homes. People are where the hour puts them: at work by day, in the square at dusk, at home at night.

Pick a building or the square, or choose from **Places in town**, to see who is there and how many minutes away it is. **Walk there** crosses town along the streets, round buildings and anything a hand layout painted, over its bridges. The minutes pass on the clock, and your next turn tells the GM where the party went and who is there. A visit to a named place, such as an inn the story added, makes it the party's current place. **Leave town** goes back to the overworld. The game remembers which view you were in.

A town can be **laid out by hand** with a world editor such as Pixelforge, as part of the world's hand edits.

- Buildings can move to other lots. A building moved onto another's lot swaps with it, and every building still faces a street.
- The ground can be painted with streets, paving, open ground, trees or a well, but never under a building, before its door, in the middle of the square or under a market stall.
- Who lives and works where never changes, and a walk to a moved building is timed from its new door.
- The editor refuses a layout that does not fit the town and says why. Places the story adds in play still find a lot.
- A layout can also place buildings off the lots, paint fields, dirt paths, water with bridges and hedges, and set decorations. The town view draws them all (decorations only with an image pack that has them).

### Dungeons, caves and stations

When the story goes underground or aboard, the GM can open a **map of the place**: a dungeon, cave or station, drawn over the scene. It is laid out from the game and the place's name, so the same place always has the same rooms, and going back keeps the map as it was. The GM picks a look from eleven: rock, ice, crystal and lava caves; a crypt, a sewer and a temple; and a station's corridors, lab, engine deck and hydroponics. With a tile pack for that look, the map uses its art. Without one, it is plain colors.

A place in town the party can go down into (a cave, mine, crypt, sewer or ruin by its name, or in science fiction a derelict or a bunker) shows **Go down** when the party is there.

- It opens the same map each time, and leaving puts the party back in town.
- While the party is on another map, leave that one first.
- A place can also have a map made by hand with a world editor such as Pixelforge. **Go down** then opens that map, whatever the place is called, drawn with the pack it names. On such a map the way out is where the party came in, props never block the way, and people stand on named spots at the hours the map gives them. The GM is told who is there.

Click a place on the map, or use the arrow keys, to walk there by the shortest way. The minutes pass on the clock (about a minute per thirty steps), and your next turn tells the GM which area the party walked from and to. The label at the top names the current area. **Show the scene** and **Show the map** in **Game controls** switch between the scene and the map.

To leave, walk back to the way out (stairs, a ladder or a hatch) and choose **Leave**. The GM can also end the map when the story leaves the place. Regenerating a turn that opened, walked or left a map puts the map back as it was before that turn.

## Time

In a game with a world, time also passes on its own:

- While the overworld is in front and the game is waiting on you, a game minute passes every five real seconds. It stops while the GM is writing, before you have read its reply, while the scene view is in front and while the app is in the background.
- A walk on the overworld passes the days its route takes.
- When the Game Master (GM) says days pass (a journey, a long rest, a wait), the clock moves by those days. A regenerated reply does not move it again. Set the day by hand if the new telling takes a different time.

## Combat

### Elements

Which elements exist belongs to the setting:

- No setting kit, or a kit that names none: the classic six (fire, ice, lightning, poison, holy, shadow).
- Wuxia: the five phases (wood, fire, earth, metal, water), each overcoming the next.
- Cyberpunk and space opera: kinetic, thermal, EM, and chemical or plasma.
- Modern day and 1920s: none.

Rain and storms on open ground damp fire-like elements and feed lightning-like ones. In a tactical fight, an element hits harder against one it beats and softer against one that beats it. You can change a kit's elements and reactions under **Change its words**. See [Choosing a setting kit](#choosing-a-setting-kit).

### Loot

What drops belongs to your setting. A game with a setting kit drops the kit's own loot (a modern-day game drops a gift card or a first-aid kit, never an enchanted sword), and you can change those words under **Change its words**. A game without a kit drops what its genre usually has. A genre with no starter kit, such as Steampunk, drops plain things that belong to no setting. In a game whose ruleset has its own loot tables, enemies drop the ruleset's items instead, and a ruleset that turns Game Mode's own items off drops only its own.

### Hand-made battlefields

A world can also have hand-made battlefields: boards painted tile by tile for one of its places with a world editor such as Pixelforge. When a fight starts at that place, or inside it, it uses one of those boards instead of a generated one.

- The board is used exactly as painted. If the place has several, the fight's seed (a number that picks one) chooses.
- The GM's terrain brief is not used there, but its formation still decides where each side starts. The GM is told the board was made for this place.
- A hand-made board must follow three rules: it is one of the three board sizes, the two columns at each side are plains where the sides line up, and every tile a fighter can stand on connects to the rest. The maker refuses a board that breaks a rule and says why.

These boards are kept with the world's hand edits, so they travel in world files, map packs and the library.

### Battlefield scenes

A game with a setting kit names its own scenes in its words, so a cyberpunk fight happens on a rooftop or in a megablock corridor and a wuxia fight in a bamboo forest or a teahouse. The board's tiles use the setting's words too (cover and debris rather than forest and ruins). You can change a kit's scenes and tile words under **Change its words**.

## Journal, money and sessions

The **World** tab shows where you are and how well known the party is, its standing with each group, what it has done, news that has reached it (rumours are marked), trouble brewing that it has heard of and the past any local would tell. It shows only what the party could know. Secrets only the GM knows stay hidden. It follows the story through swipes and branches.

A game without a ruleset has money and a market too when its setting kit has them. Every starter kit does, for example copper, silver and gold in high fantasy, copper cash and taels of silver in wuxia, dollars and cents in modern day, and credits in cyberpunk and space opera. The kit's shop lists everyday goods with a price and the smallest place that sells each, so a village has a café but only a town has a first-aid kit. You can change the money and the shop under the kit's **Change its words**, or remove the money. See [Choosing a setting kit](#choosing-a-setting-kit).

In a game with a generated world, the world goes on from where it was left: the days that passed, the party's deeds and standing, the places and groups the story added, and where the party went.

## Art and music families

A game started with a setting kit has an art family, shown under **Art and music** when you change the kit's words: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland`, or one of the kit's own. The game uses folders named for its family and every folder not named for a family, and leaves out other families' folders. A cyberpunk game never plays fantasy battle music or shows the enchanted forest. When nothing of its family or the shared folders fits, nothing plays rather than another family's track. A game without a setting kit uses every folder.

- **Music**: put the setting's tracks in `music/<state>/<family>/<intensity>`, such as `combat/wuxia/intense`. They play ahead of shared tracks.
- **Backgrounds**: `backgrounds/<family>`. Backgrounds generated in a game with a setting kit are saved there too.
- **Combat sounds**: a sound in `sfx/combat/<family>` with the same name as a bundled one, such as `sword-swing`, replaces it in games of that family. The bundled combat sounds are fantasy, so other families' fights are quiet until you add their own.

The bundled starter backgrounds count as shared, except the fantasy ones (`ancient_library`, `castle_cliff`, `enchanted_forest`) and the modern `city_night`. A setting kit saved before art families existed keeps working: one made from a starter kit uses that starter's family, and any other uses every folder until you pick a family under **Art and music**. The selection bar above names the open game's family.

## World Maps: From the world

- **From the world** appears when the Game makes a world (see [Making a world](#making-a-world)). It lays that world out as the map: its regions, settlements and places, and the ways between them with their travel times. You review it before it is saved. It needs no AI generation, and the map's places are the world's places. In play the two stay in step. The Game Master and the markets use the place where the map has the party. When the Game Master names a world place, the map moves the party there. With World Maps 1.6.0 or later it takes the shortest route. Earlier versions move only one step: a place inside, the place around it, or a place a way links to.

## Story scripts

Worlds can carry story scripts. See [Writing Game Mode Story Scripts](writing-story-scripts.md).
