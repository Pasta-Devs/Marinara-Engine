# Game Mode: Map, Time, and Weather

This guide covers the Game Mode map panel and the systems that track the world around your party. Those systems are the day and time, the weather, and party morale. It explains the map views, how to move and zoom, and how to set the day and time by hand.

## The map panel

Game Mode shows a small map panel on the game screen. The panel lists the current map name, the game day, and a time-of-day sky icon.

On a computer, the map is an inline panel you can read at a glance. You can drag the panel and lock it in place. For how draggable panels work, see the HUD widgets guide linked below.

On a phone, tap **Map** to open the map panel. Its button starts near the top left and can be dragged around the chat. Use the panel's **Lock window** button to keep the map button in place; **Close** returns to that button. The position is saved with the chat. The phone map uses your chat widget style from **Settings → Appearance → App**, and its button stays separate from the three-dot **Chat tools** menu.

## The overworld

A game with a generated world (see [Making a world](getting-started.md#making-a-world)) opens on the **overworld**: the world's ground drawn as a pixel map behind the narration, with its forests, hills, coasts and seas, the roads and lanes between its settlements, each settlement drawn by its size, and your party. The bigger places are named on the map, and so is the one you are in. Drag the map to look around.

Tap or click a settlement, or pick it from **Places** (the places nearest first, with how long the way takes), to see its size and the trip from where you are: how many days or hours on the way, and by which ways. **Walk there** sends the party along the world's ways to it, by the quickest route, and the walk's days pass on the clock at once. The party is there from then on, and **your next turn tells the Game Master** where you walked, how long it took and by which ways, so it can tell the arrival. The world's own days go by with it, as they do when the Game Master says time passes. A second walk before your next turn carries on from where the first ended.

Caves, mines, crypts and ruins a few steps out of a settlement are drawn on the overworld as **sites**: a new world has one or two in each region, named after the settlement beside them ("Hollin Caves", "Ashby Ruins"), and a world maker can add more, with such a name or a map made for it. A world made before sites keeps its places as they were. **Walk there** goes to one as to a settlement: along the world's ways to its settlement, then off the road on foot. At a site, its card offers **Enter**, which opens the site's map (see [Dungeons, caves and stations](#dungeons-caves-and-stations)); leaving it puts the party back on the overworld at the site. A site that matters to the game's story stays **closed** (drawn faded, no trip to it and no going in) until the Game Master opens it as the story reaches it; a world maker can also keep a site hidden from the map until then, or open from the start.

A place in ruins is drawn in ruins. After dark the map dims and the settlements' windows light up. Each setting family has its own tiles: fantasy, wuxia, modern day, the 1920s, science fiction and the wasteland each have their own colours and buildings. A setting kit with no family draws plain tiles.

The overworld is a view, and the scene view (the game's backgrounds and character art) is a switch away: **Show the scene** in **Game controls** (on a phone, in the three-dot **Chat tools** menu), and **Show the overworld** to come back. The game remembers which one you chose. A fight and a session replay use their own screens.

### Tile packs

The overworld and the towns are drawn from **tile packs**: a palette and every tile (each kind of ground, the settlements by size, the party, and the town's streets, roofs and townsfolk) as rows of pixels. Every setting family has its own built-in pack. Open the **Agents** panel and find **Tile packs** to:

- choose which pack each setting is drawn with (**Built in** is its own);
- **Import a tile pack** from a `.tilepack.json` file someone shared;
- **Export** a pack to share it, or **Remove** it, which sends any setting drawn with it back to its own tiles.

A pack only needs the tiles it changes: anything it leaves out is drawn plain. A pack that names a tile Marinara Engine does not draw keeps the rest and says what it left out.

### The town

When the party is at a settlement, pick it on the overworld and choose **Enter** to see the town. It is laid out from the world: its streets and square, the places the world or the story has in it (named on their buildings), its hall in a bigger place, the workplaces of the trades it is known for, and its homes. Its people are where the hour has them: at work by day, in the square at dusk, at home at night.

A town can also be **laid out by hand** with a maker such as Pixelforge, as part of the world's hand edits: its buildings moved to other lots (a building moved onto another's lot swaps with it, and every building still faces a street), and its ground painted with streets, paving, open ground, trees or a well (never under a building or before its door, in the middle of the square or under a market stall). Who lives and works where never changes, and a walk to a moved building is timed from its new door. The maker refuses a layout that does not fit the town, with the reason; places the story adds in play still find a lot. A layout can also place buildings off the lots, paint fields, dirt paths, water with bridges over it and hedges, and set decorations about the town; the town view draws them all (decorations only with an image pack that has them).

Pick a building or the square, or choose from **Places in town**, to see who is there now and how many minutes away it is. **Walk there** takes the party across town along the streets, round the buildings (and round the trees, wells, water and hedges a hand layout painted, over its bridges): the minutes the way takes pass on the clock, and **your next turn tells the Game Master** where the party went and who is there. A visit to a named place, such as an inn the story added, makes it the place the party is in. **Leave town** goes back to the overworld. The game remembers which view you were in.

### Dungeons, caves and stations

In an Overworld RPG game (see [Classic or Overworld RPG](getting-started.md#classic-or-overworld-rpg)), when the story goes underground or aboard, the Game Master can open a **map of the place**: a dungeon, a cave or a station, drawn over the scene. Each one is laid out from the game and the place's name, so the same place always has the same rooms, and going back to a place the party is already in keeps the map as it was. The Game Master also picks its look from eleven: rock, ice, crystal and lava caves; a crypt, a sewer and a temple; and a station's corridors, lab, engine deck and hydroponics. With a tile pack for that look in the tile pack library, the map is drawn with its art; without one, it is drawn in plain colours.

A place in town the party can go down into (a cave, a mine, a crypt, a sewer or a ruin, by its name; in a science fiction setting a derelict or a bunker) has **Go down** when the party is there. It opens that place's map the same way, the same map each time, and leaving it puts the party back in town where it went down. While the party is on another map, leave that one first. A place can also have a map **made for it by hand** with a maker such as Pixelforge: Go down then opens that map, whatever the place is called, drawn with the pack it names. On such a map the way out is where the party came in, its props never stand in the way, and people stand on its named spots at the hours the map gives them; the Game Master is told who is there.

Click a place on the map, or use the arrow keys, to walk there by the shortest way. The minutes pass on the clock (about a minute for every thirty steps), and **your next turn tells the Game Master** which area the party walked from and to. The label at the top says which area the party is in. **Show the scene** and **Show the map** in **Game controls** switch between the map and the scene; the game remembers which you were in.

To leave, walk back to the way out (stairs, a ladder or a hatch, by the look of the place) and choose **Leave**. The Game Master can also end the map when the story leaves the place. Regenerating a turn that opened, walked or left a map puts the map back as it was before that turn. Games without a map play as before.

## Grid view and node view

The map has two views. Marinara Engine picks the view for you based on the kind of place the map represents. You do not switch views by hand.

- The **grid** view is for open areas like an overworld, a region, or a city. It shows terrain-colored squares, such as grass, forest, water, mountain, desert, snow, town, road, and cave.
- The **node** view is for enclosed areas like dungeons and interiors. It shows locations as circles joined by lines. A location you have not discovered yet shows a question mark icon. A dashed line means a path you have not traveled. A solid line means a path you have used.

## Moving your party

To travel, pick a place on the map. You can only pick certain places. On a grid map, a square must be next to your party and already discovered. On a node map, a node must be joined to your current location, or already discovered. Other squares and nodes do nothing when you click them.

1. Click a grid square, or click a node on a node map.
2. A **Destination:** chip appears above the message box with the place name.
3. Type your message and send it. Marinara adds a short line like `*moves to <place>*` to the front of your message.

To cancel, click the small clear button (the X) on the **Destination:** chip.

On a phone the flow is slightly different. Tap a node once to select it, then tap **Set destination** in the footer. A node marked **You are here** is your current location.

## Zooming the map

Each map has a zoom control in the top-right corner.

- Click **Zoom in** (the plus button) to get closer.
- Click **Zoom out** (the minus button) to see more.

Zoom runs from 75% to 180%, in steps of 25%.

## Switching between maps

Some games have more than one map or region. When more than one map exists, a small dropdown appears at the top of the map panel. Use it to view a different map. The map you are actually on is marked **(Current)**.

## Generating a new map

The map panel has a wand button in the top-left corner labeled **Generate another map**. Click it to replace the current map with a fresh one.

If a game has no map yet, the panel shows **No map yet** with a **Generate** button that does the same thing.

## Setting the day and time by hand

The day and time control sits at the top of the map panel. It shows **Day** and a number, plus a small sky icon for the time of day.

1. Click the **Day** control.
2. Type a new day number in the box. The day can be from 1 to 9999.
3. Pick a time of day from the dropdown. The choices are **Dawn**, **Morning**, **Afternoon**, **Evening**, **Night**, and **Midnight**.
4. Click away or press Enter to save.

This is a manual override. You set the day and time yourself, apart from the automatic clock described next. The clock may also show **Noon** on its own, but Noon is not one of the manual choices.

## How time passes automatically

The game clock runs on its own. It uses fixed math, not the AI, so it is always consistent. Every new game starts at Day 1, 08:00 in the morning. Each action you take moves the clock forward by a set amount.

| Action         | Time added |
| -------------- | ---------- |
| Talking        | 15 minutes |
| Exploring      | 30 minutes |
| A combat round | 5 minutes  |
| A short rest   | 1 hour     |
| A long rest    | 8 hours    |
| Travel         | 2 hours    |

When the clock passes midnight, the day number goes up by one.

In a game with a world, time also passes on its own:

- While the overworld is in front and the game is waiting on you, a game minute passes every five real seconds. It stops while the Game Master is writing, before you have read its reply, while the scene view is in front, and while the app is in the background.
- A walk on the overworld passes the days its route takes.
- When the Game Master says days pass (a journey, a long rest, a wait), the clock moves by those days too. A regenerated reply does not move it again; set the day by hand if the new telling takes a different time.

## Weather

The game also tracks weather on its own, with fixed math and no AI. Weather depends on the biome and the season. A biome is the kind of place your party is in, such as desert, arctic, coastal, or mountain. Examples of weather include clear, cloudy, rain, storm, snow, blizzard, fog, and sandstorm.

Weather can change when you act. It changes most often when you travel or take a long rest, sometimes when you explore, and rarely otherwise. The weather flavors how the Game Master describes each scene.

To see weather on screen, turn on the setting labeled **Dynamic weather effects (rain, snow, fog, etc.)** in the app's appearance settings. It is on by default. When it is on, animated particles like rain, snow, and fog appear over the game. They match the current weather and time of day. For more display options, see the appearance settings guide linked below.

## Party morale

The game keeps a hidden party morale score from 0 to 100. It has five levels, from lowest to highest: Broken, Low, Steady, High, and Inspired.

Morale shifts with what happens in the story. Winning a fight, completing a quest, or finding treasure raises it. Losing a fight, a failed quest, or losing an ally lowers it. Over time, morale drifts back toward the middle.

Morale is not shown as a number in the game. Instead it works in the background. It changes your dice rolls, from plus 2 at Inspired down to minus 2 at Broken. It also colors how the Game Master describes your party's mood.

## Related guides

- [Game Mode: Getting Started](getting-started.md)
- [Game Mode: HUD Widgets](hud-widgets.md)
- [Appearance Settings](../appearance/appearance-settings.md)
