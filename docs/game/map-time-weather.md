# Game Mode: Map, Time, and Weather

Use the map panel to see where your party is and to move it. This guide also covers the systems that track the world around the party: the day and time, the weather and party morale.

## The map panel

Game Mode shows a map panel on the game screen. It lists the current map name, the game day and a sky icon for the time of day.

- **On a computer**, the map is an inline panel you can read at a glance. You can drag it and lock it in place. For how draggable panels work, see [Game Mode: HUD Widgets](hud-widgets.md).
- **On a phone**, tap **Map** to open the panel. Its button starts near the top left and can be dragged around the chat. Use **Lock window** to keep the button in place, and **Close** to return to it. The position is saved with the chat. The phone map uses your chat widget style from **Settings → Appearance → App**, and its button stays separate from the three-dot **Chat tools** menu.

A plain Classic game has the scene map described here. The overworld, towns and dungeon maps belong to Overworld RPG games, which are not available yet (see [Classic or Overworld RPG](getting-started.md#classic-or-overworld-rpg)).

### Grid view and node view

Marinara picks the view from the kind of place the map shows. You do not switch by hand.

- The **grid** view is for open areas such as a region or a city. It shows terrain-colored squares: grass, forest, water, mountain, desert, snow, town, road and cave.
- The **node** view is for enclosed areas such as dungeons and interiors. It shows locations as circles joined by lines. An undiscovered location shows a question mark. A dashed line is a path you have not traveled, and a solid line is one you have used.

## Move your party

You can pick only certain places. On a grid map, a square must be next to your party and already discovered. On a node map, a node must be joined to your current location, or already discovered. Other squares and nodes do nothing when you click them.

1. Click a grid square, or a node on a node map.
2. A **Map position:** chip with the place name appears above the message box.
3. Type your message and send it. Marinara adds a short line like `*moves to <place>*` to the front of your message.

To cancel, click the clear button (X) on the **Map position:** chip. Its tooltip reads **Clear destination**.

On a phone, tap a node once to select it, then tap **Set destination** in the footer. A node marked **You are here** is your current location.

If it did not work, check that the square is next to your party and discovered, or that the node is joined to where you are.

### Zoom, switch and generate maps

- **Zoom.** Use **Zoom in** (plus) and **Zoom out** (minus) in the top-right corner. Zoom runs from 75% to 180% in steps of 25%.
- **Switch maps.** When a game has more than one map or region, a dropdown at the top of the panel lets you view another. The map you are on is marked **(Current)**.
- **Generate a map.** Click the wand button **Generate another map** in the top-left corner to replace the current map with a new one. A game with no map shows **No map yet** and a **Generate** button that does the same.

## Set the day and time by hand

The day and time control sits at the top of the map panel. It shows **Day** and a number, plus a sky icon.

1. Click the **Day** control.
2. Type a day number from 1 to 9999.
3. Pick a time of day: **Dawn**, **Morning**, **Afternoon**, **Evening**, **Night** or **Midnight**.
4. Click away or press <kbd>Enter</kbd> to save.

This is a manual override, apart from the automatic clock. The clock may also show **Noon** on its own, but Noon is not a manual choice.

## How time passes

The game clock uses fixed math, not the AI. Every new game starts at Day 1, 08:00. Each action moves the clock forward:

| Action | Time added |
| --- | --- |
| Talking | 15 minutes |
| Exploring | 30 minutes |
| A combat round | 5 minutes |
| A short rest | 1 hour |
| A long rest | 8 hours |
| Travel | 2 hours |

When the clock passes midnight, the day number goes up by one.

In a game with a world, time also passes on its own:

- While the overworld is in front and the game is waiting on you, a game minute passes every five real seconds. It stops while the GM is writing, before you have read its reply, while the scene view is in front and while the app is in the background.
- A walk on the overworld passes the days its route takes.
- When the Game Master (GM) says days pass (a journey, a long rest, a wait), the clock moves by those days. A regenerated reply does not move it again. Set the day by hand if the new telling takes a different time.

## Weather

The game tracks weather with fixed math, not the AI. Weather depends on the biome (the kind of place the party is in, such as desert, arctic, coastal or mountain) and the season. Examples are clear, cloudy, rain, storm, snow, blizzard, fog and sandstorm. Weather changes most often when you travel or take a long rest, sometimes when you explore, and rarely otherwise. It flavors how the GM describes each scene.

To see weather on screen, turn on **Dynamic weather effects (rain, snow, fog, etc.)** in the appearance settings. It is on by default. Rain, snow and fog particles then appear over the game and match the weather and time of day. See [Appearance Settings](../appearance/appearance-settings.md).

## Party morale

The game keeps a hidden party morale score from 0 to 100. It has five levels, lowest to highest: Broken, Low, Steady, High and Inspired.

Morale rises when you win a fight, complete a quest or find treasure. It falls when you lose a fight, fail a quest or lose an ally. Over time it drifts back toward the middle. It is not shown as a number. It colors how the GM describes your party's mood. It does not change your dice rolls.

## The overworld and other Overworld RPG maps

The sections below describe **Overworld RPG** games, which are not available yet. They apply only if your server has turned the feature on.

### The overworld

A game with a generated world (see [Making a world](getting-started.md#making-a-world)) opens on the **overworld**: the world's ground drawn as a pixel map behind the narration, with forests, hills, coasts and seas, the roads and lanes between settlements, each settlement drawn by its size, and your party. The bigger places are named, and so is the one you are in. Drag the map to look around.

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

## Related guides

- [Game Mode: Getting Started](getting-started.md)
- [Game Mode: HUD Widgets](hud-widgets.md)
- [Appearance Settings](../appearance/appearance-settings.md)
