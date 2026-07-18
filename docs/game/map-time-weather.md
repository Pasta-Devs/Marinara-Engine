# Game Mode: Map, Time, and Weather

This guide covers the Game Mode map panel and the systems that track the world around your party. Those systems are the day and time, the weather, and party morale. It explains the map views, how to move and zoom, and how to set the day and time by hand.

## The map panel

Game Mode shows a small map panel on the game screen. The panel lists the current map name, the game day, and a time-of-day sky icon.

On a computer, the map is an inline panel you can read at a glance. On a phone, tap the map icon in the top-left corner. The button label is **Open map**, and it opens the map in a popover.

You can drag the panel and lock it in place. For how draggable panels work, see the HUD widgets guide linked below.

## Grid view and node view

The map has two views. Guksu Motor picks the view for you based on the kind of place the map represents. You do not switch views by hand.

- The **grid** view is for open areas like an overworld, a region, or a city. It shows terrain-colored squares, such as grass, forest, water, mountain, desert, snow, town, road, and cave.
- The **node** view is for enclosed areas like dungeons and interiors. It shows locations as circles joined by lines. A location you have not discovered yet shows a question mark icon. A dashed line means a path you have not traveled. A solid line means a path you have used.

## Moving your party

To travel, pick a place on the map. You can only pick certain places. On a grid map, a square must be next to your party and already discovered. On a node map, a node must be joined to your current location, or already discovered. Other squares and nodes do nothing when you click them.

1. Click a grid square, or click a node on a node map.
2. A **Destination:** chip appears above the message box with the place name.
3. Type your message and send it. Guksu adds a short line like `*moves to <place>*` to the front of your message.

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

| Action | Time added |
|---|---|
| Talking | 15 minutes |
| Exploring | 30 minutes |
| A combat round | 5 minutes |
| A short rest | 1 hour |
| A long rest | 8 hours |
| Travel | 2 hours |

When the clock passes midnight, the day number goes up by one.

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
