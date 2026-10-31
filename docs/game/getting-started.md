# Game Mode: Getting Started

Game Mode turns Marinara Engine into a single-player role-playing game run by an AI Game Master. This guide covers what Game Mode is and what you need before you start. It then walks through the setup wizard and shows where to find each gameplay feature. Read it once, start a game, then follow the links at the end for deeper topics.

## What Game Mode is

Game Mode is one of Marinara's chat modes. The others are Conversation and Roleplay.

In Game Mode, an AI Game Master (GM) runs a story for you. A Game Master is the AI that narrates the world, plays every character you meet, and decides what happens next. It works like the Dungeon Master in a tabletop game.

The engine tracks the game state for you across turns. This includes the map, your party, non-player characters (NPCs), your items, quests, in-world time, and weather. You play across many turns. You can split a long game into several **sessions**, like a tabletop group splitting a campaign across game nights. A campaign is the whole ongoing story.

You do not have to use every mechanic. Some players skip combat and dice and use Game Mode for story-driven, visual play. The RPG systems are there when you want them.

## Before you start

You need only one thing to start a game: an AI provider connection for the GM. A connection links Marinara to an AI provider so it can generate text. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md) if you have not set one up yet.

Everything else is optional and off by default. You can add these later:

- **Image generation.** Game Mode has a visual layout with backgrounds and character art. To fill it, you need an image generation connection. The **Visual Generation** setting in the wizard is off by default, so you must turn it on yourself. Without it, you still get the story, state tracking, and combat, but the visual areas stay empty.
- **A Local Model for scene effects.** Marinara can run a small model on your own machine, labeled **Local Model (Gemma)**. It powers background and music suggestions without extra cost. It is the default choice in the wizard. See [Local Model Setup](../connections/local-model.md).
- **The Storyboard Agent.** Install it from **Agents > Agent Organizer**, then activate it for the finished Game under **Chat Settings > Agents** when you want still or animated Storyboards.
- **A video generation connection.** This is only needed for scene videos or animated Storyboards.
- **Music.** The **Music DJ** agent can play game music. It needs Spotify or a local music folder, and it is off by default.

## The setup wizard

When you create a Game Mode chat, a **setup wizard** opens. It has seven steps. The only required field is the GM connection on the first step. Every other field has a sensible default. You can move through the wizard quickly and let Marinara fill in the rest.

The seven steps are:

1. **Connection.** Choose the **Game Mode**: **Overworld RPG** or **Classic**. Overworld RPG is not ready yet, so for now new games start as **Classic**. See [Classic or Overworld RPG](#classic-or-overworld-rpg). Set the game name, pick the GM connection, and optionally set a scene-effects connection. Scene effects default to **Local Model (Gemma)**.
2. **World.** Set the genre, setting, tone, difficulty, content rating, and language. The ideas offered under the setting, and later under the goals, come from different kinds of setting, a new mix each time the wizard opens. Choose **Classic** or **Tactical** under **Combat Preference**. When a Game Mode ruleset is installed, a **Rules** choice appears below it: keep **Marinara's own rules**, or pick the ruleset. See [Choosing rules](#choosing-rules). On the Overworld RPG, below that are the **Setting kit** and **Your world**. See [Choosing a setting kit](#choosing-a-setting-kit) and [Making a world](#making-a-world).
3. **Party.** Pick your persona (the character you play), the **Game Master Mode**, and any party members. **GM intro message** sets the game's first message. See [The GM intro message](#the-gm-intro-message).
4. **Goals.** Tell the GM what you want from the adventure.
5. **Lorebooks.** Attach any lorebooks whose facts the GM should treat as canon. A lorebook is a set of background world facts. See [Lorebooks](../lorebooks/overview.md).
6. **Features.** Turn on optional systems like Visual Generation, Music DJ, and HUD widgets. Installable Agents can be activated from Chat Settings after the Game is created.
7. **GM.** Choose the presentation style and review advanced GM instructions before the world is built.

When you finish, click **Start Game**.

In a Tactical game, the GM writes a short brief for each fight's scene and the engine generates a board from it. See [Combat](combat.md#tactical-battles-and-terrain) for movement rules, terrain bonuses and generation failures.

### Classic or Overworld RPG

A new game is played in one of two Game Modes, chosen on the first step and kept for all of the game's sessions:

- **Overworld RPG** (the default once it is ready): a world made for your setting, walked on an overworld map, with towns to visit, places to explore and dungeons to go down into. It needs a setting kit and a world; until you pick a kit, the one for your first genre is taken (High fantasy for a genre without one), and a world is rolled for it.
- **Classic**: Game Mode as it always was. The story is told scene by scene, with the scene map and battles, and no setting kit, world, overworld, towns or dungeon maps.

A game made before the choice existed keeps playing as it did: with a world it is an Overworld game, without one a Classic game.

Overworld RPG is still being finished. Until it is ready, its card is greyed out with the note "Overworld games, with a setting kit and a generated world, are not ready yet. New games start as Classic games." Every new game is then Classic, and the setting kit and world choices below do not appear. They describe Overworld RPG games.

### Choosing rules

**Rules** only appears when at least one ruleset is installed, and only for a new game. **Marinara's own rules** is the default: the built-in d20 checks and the six-attribute sheet. A ruleset, such as **5e (SRD 5.1)**, replaces those with a tabletop system's own checks and character sheet, and may fight battles by its own rules too. The wizard shows what each ruleset covers and what its battles will do. The ruleset is fixed once the game is created.

See [Playing with a Ruleset](rulesets.md) for getting a ruleset, its layers, party sheets, and what changes in play.

### Choosing a setting kit

A **Setting kit** gives the Game Master the words your kind of world is written in: what its places are called and how big a settlement can be, its kinds of group, what a place may be known for, how people travel, what a year and a day are called, how its peoples name themselves, what a won fight can drop, its money and the everyday things it sells, its elements, the places its fights happen in, and which family of art, music and sounds it uses (see [Game Assets](game-assets.md#a-settings-own-art-and-music)). It also says which kinds of change the world has, such as rivalries, crime, wars or disasters, and how fast it changes on its own. A kind that is off is never brought in as a background event, and a scene does not escalate into it, so a quarrel can stay a quarrel.

It is only offered for a new Overworld RPG game, which always has one: until you pick a kit, the one for your first genre is taken. There are eight to start from: high fantasy, wuxia and xianxia, modern day, modern supernatural, the 1920s, cyberpunk, space opera and post-apocalyptic. Modern day is gentle by default, with no crime, conflict or catastrophe, at a slow pace, for slice of life.

Picking a kit before you have chosen a genre sets the genre that fits it, such as **Cyberpunk** for cyberpunk or **Wuxia** for wuxia and xianxia, and the setting and goal ideas then start with the kit's own. A genre you chose yourself stays as it is.

After you pick one, **Write it for my setting** asks your Game Master connection to rewrite it for the genre, setting and tone you chose. If what the model writes does not hold together, it is asked once more with the reasons, and then the wizard tells you what was wrong and keeps the kit you had. **Change its words** opens every word of the kit for editing. A list is typed on one line, separated by commas. A kit with a problem, such as an empty name or no settlements, says what is wrong, and the game cannot start until it is fixed.

The game keeps the kit it was created with. The Game Master reads it every turn, and world generation uses its words. A shared setup file carries its kit too.

An Experience can ship its own **map pack**: a setting kit, ready-made maps and its own tiles. With
that Experience on, the setup shows its kit as set (no kit to choose) and, if it ships maps, a **Map**
to pick from; the game is played on that map and drawn in the Experience's tiles. Turning the
Experience off gives your own choices back.

**Download this kit** saves the kit as a file (`.worldkit.json`) to share, and **Import a kit file** reads one back in. **Import a world file** brings in a whole world at once (see below).

### Making a world

With a setting kit chosen, **Your world** lays out a whole world in the kit's words before the game starts: its regions, settlements of every size on the kit's ladder, what each place is known for, and the ways between them (roads, rivers, sea lanes, jump lanes) with how many days each trip takes. Every new Overworld RPG game has one, rolled from a seed you can change.

A world is made from a **World seed**. The same seed, kit and brief always make the same world, so **Roll** gives you another and typing a number back brings one back. The preview under it is the world the game will play: a small map of the ground and its settlements, where the party starts, and a list of every settlement by region.

- **Start from this lore** reads the lorebooks you tick for the places they state and the dated events they record, each kept exactly as the lore says, with the entries it came from. **Build around the lore** fills the world in around them; **Only the lore's places** makes nothing beside them.
- **Write the world's brief** asks your Game Master connection for the rest: the present day as the game begins, the major places, the groups the present day turns on (what each wants, and who its allies and rivals are), and names for the places and people the world draws, in each of the kit's peoples' own sound and order. The lore's places are kept whatever the model writes, and anything that does not fit the kit is left out and counted, as are the few names models reach for again and again. **Change the brief** opens its words for editing, including each people's given and family names.

Without a brief, the world is the kit and the lore's places alone, and the places it draws are numbered until a brief gives them names.

A world also has a past. Before the game begins, the world's own engine runs it forward year by year from its founding: every settlement is founded and grows to its size now, the brief's groups are founded at their seats, take and lose leaders, and fall in and out with each other, and, where the world has them, bandits, wars and famines leave their marks, some places lost to them. A severe change only comes after it has been brewing for a while (tension before a war, a dry spell before a famine), and it only uses the kinds of change the kit allows: a gentle world's past is gentle too. Dated events your lore states, or the brief names, happen when and where they say. The same seed and brief always give the same past.

The Game Master is told the most notable events of the past, who keeps the place the party is in and who leads them, and that place's own past. For any other place or group it can ask, and gets the answer on its next turn.

Every settlement has its people, drawn by the seed when the party gets there: more in bigger places, each with a name from their own culture's list, a job suited to what the place is known for, a temperament, what they care about, how they speak and how they look, and some who came from elsewhere. The Game Master is shown a few people of the current place the party has not met, and brings in one of them when someone new enters the scene. Someone it names in full joins the game's tracked characters with what they do and how they look, so two people who share a name are told apart. Without a brief's name lists, people go by their job.

In play, the Game Master always knows where the party is, where it can go from there, and how long each way takes. It names where the party goes with a place tag. A place the world lists keeps the size the world gave it. On a ruleset with markets, it also takes the matching size on the market's ladder, so a world's capital is the market's biggest place. A place the world does not list, such as a farmhouse or a camp, keeps the name the Game Master gives it. Once the game starts, the world's past is fixed. Its layout is fixed too, except for hand edits (see below). A shared setup file carries the world as it was first made.

What the party does to the world stays done. When the party helps or hinders a group, makes two groups friends or enemies, sides with a group or betrays it, improves or damages a place, takes a place for a group, destroys a group, puts someone at a group's head, or brings a place to ruin, the Game Master records it in its reply, as it does a place or group the story brings in. Each is checked against the world: a change of a kind the kit has off, such as a war in a cozy modern-day world, or one naming a place or group the world does not have, is refused. From then on the Game Master is told the world as the story left it: how the place is doing, who keeps it and who leads them, what the party did there, the party's standing with each group it has dealt with, and what has changed since play began. A place the story added is a place the party can go. A change belongs to the reply that made it, so a swipe, a regeneration or a deleted message takes it back with that reply.

The world also goes on without the party. When the Game Master says time passes (a journey, a night's rest, a long wait), the world takes its own steps, a week at a time, and only in the kinds of change the kit has: fortunes rise and fall, newcomers settle, groups grow close or become rivals, heads step down, and, where the world has them, trouble finds places on hard times and tension between two groups can become a war after a season of building up. Catastrophes never come on their own; only the Game Master can narrate one, as it can any event beyond the party, refused if its kind is off. Nothing is decided where the party is: something about to happen there is left for the scene to play out. News travels: the Game Master hears of a change once the days the roads take have passed, as a rumour from far away, and sees what is brewing nearby, so the party can step in. It may hold a brewing war only when it makes no sense for the world or would wreck the game with no real chance for the party to stop it. The party's deeds count for more as it becomes known: a stranger's help changes little, a famous party's a lot.

A world can also keep **hand edits**. These are changes you make with a world editor, a tool that changes a world after it is made. You can rename or move places, paint the ground, and add places and people. You can also paint a place's tactical battlefield (see [Combat](combat.md#tactical-battles-and-terrain)) and lay out a town by hand (see [The town](map-time-weather.md#the-town)). Every part of the game sees the edits at once: the Game Master, the overworld, the towns and the World tab. A renamed place still answers to its old name, and the Game Master is told what it was once called.

Hand edits change the world from now on, never its past. The world's history, and the changes it made on its own, stay as they were. A settlement you add stays as you added it. A town keeps its layout, so the places and people you add go on its next free building plots and in its next free homes.

A world can travel as a file. **Download this world** (under **Your world**) saves the world you are making, and **Download the world** on a game's World tab saves that game's world, hand edits and all, as a `.world.json` file. **Import a world file** (beside the setting kit) reads one into a new game's setup: it chooses the file's setting kit and makes its world, with its hand edits. **Your worlds** does the same with a world kept in your library, such as one made outside any game with a maker like Pixelforge.

A world file can also carry the world's **story**: the events and scenes a creator wrote for it. The story comes with the world and is kept on the same terms. In play, a story's scenes appear in the narration before the Game Master's reply, exactly as written. Its quest objectives are listed under **Story** on the journal's World tab once the story shows them. To write one, see [Writing Game Mode Story Scripts](../extending/writing-story-scripts.md).

The hand edits and the story were made for that seed and brief, so they are left out if you change either. If a file cannot be read, it is refused and the wizard says why. A world file also carries the world as it was made, so a world made by another version of the world maker opens exactly as it was made. An older file without it is refused. If something in the file does not fit the setting kit, it is left out and the wizard says what.

A game made without a world before the Game Mode choice existed can be given one later, only if you want it: the journal's **World** tab offers **Make a world for this game**, with the same setting kit and world choices as a new game. The world starts from the next turn; the game's past turns, map and people stay as they are. While Overworld RPG is not ready, the button is greyed out with the same note as the setup.

A game keeps its world as it was made. The places, people, towns and history are saved with the game when it starts and whenever its hand edits are saved, so an update that changes how worlds are made never changes a world already in play. A new session, a branch and an exported chat keep the same world, and how the world moved on in earlier sessions (its fortunes, rulers and wars) is kept as it played out. A world made by an earlier version of the world generator plays on as it was made, but can no longer be edited.

A game with a world opens on the **overworld**, the world drawn as a pixel map where you can walk the party from settlement to settlement along the world's ways and enter the town it is in; the scene view is a switch away. See [The overworld](map-time-weather.md#the-overworld).

### The GM intro message

**GM intro message**, on the **Party** step, decides how the game opens:

- **None** (the default): the Game Master opens the game as it sees fit.
- **Defined**: type the first message exactly as it should read. The game opens with exactly this message, and regenerating it gives the same text.
- **Guided**: describe how the opening should go, such as where it starts, who is there and what happens first. The Game Master writes the opening from it.

The text can be up to 8,000 characters. It cannot contain double curly braces, and **Guided** text cannot contain square brackets either. The field says when the text cannot be used. A world's story can bring its own intro. When the story locks it, the field shows it with "Set by this Experience and locked, so the game opens as its creator meant." and it cannot be changed.

### Defaults worth knowing

These are the starting values in the **World**, **Party**, and **Features** steps. You can change any of them.

| Setting            | Default       | Notes                                                                                                                                      |
| ------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Genre              | Fantasy       | Multi-select, plus your own custom entries; a setting kit picked first sets its own                                                        |
| Tone               | Heroic        | Multi-select                                                                                                                               |
| Difficulty         | Normal        | Casual, Normal, Hard, or Brutal; higher settings make combat more punishing                                                                |
| Content Rating     | SFW           | SFW or NSFW; NSFW only permits adult content, it does not force it                                                                         |
| Language           | English       | All in-game text is written in this language                                                                                               |
| Game Master Mode   | Standalone GM | Standalone GM builds a GM for you; Character GM uses one of your cards as the GM                                                           |
| Visual Generation  | Off           | Turn on for images; needs an image generation connection                                                                                   |
| Game Presentation  | Standard      | **Storyboard Optimized** uses the Storyboard Game Prompt to shape the GM's narration; it does not install or activate the Storyboard Agent |
| Music DJ           | Off           | Needs Spotify or a local music folder                                                                                                      |
| Custom HUD Widgets | On            | Uses AI-made status widgets from the new world                                                                                             |
| Start Muted        | Off           | Begins the game with audio muted                                                                                                           |

New to Game Mode? Leave **Game Master Mode** on **Standalone GM**. Marinara builds a fair, slightly snarky GM for you, and you can feel out the mode before writing a custom GM card.

Choose **Storyboard Optimized** on the final step when you want GM turns written as filmable visual beats. It selects the built-in **Storyboard Game Prompt** for GM narration. It does not install or activate the Storyboard Agent, turn image or video generation on, change your connections, or replace the Agent's planner and formatter defaults. After the Game is created, install and activate Storyboard separately and configure its keyframe, planner, image, and video settings under **Chat Settings > Agents > Storyboards**.

The alternative anime single-shot combination remains available after setup: choose **Anime Episode Director** for the Animation Planner and **Anime Game Video** for the Storyboard Video Prompt.

The **GM Prompt** editor previews the effective prompt for the selected presentation. With **Storyboard Optimized** selected, opening the editor shows the Storyboard Game Prompt, including its keyframe-count macro. Leaving that text unchanged keeps the built-in preset selected; editing it creates a custom prompt that overrides the presentation preset.

## The three kinds of AI call

Game Mode uses three different kinds of AI call. Knowing them helps you understand where cost and errors come from.

1. **World generation.** This runs once, when you click **Start Game**. The GM connection returns one large, structured document in a format called JSON. That document holds the world overview, the starting map, NPCs, your party's game sheets, and the on-screen widgets. JSON is a strict text format the AI must return exactly, or the game cannot read it. This is the most demanding step, which is why your model choice matters most here.
2. **Gameplay turns.** Each message you send builds a fresh prompt with the current state. Then the GM narrates and updates the world. Combat round math is calculated by the engine, not the model, so results stay fair and consistent.
3. **Session summaries.** When you end a session, the GM writes a structured recap and continuity notes. When you start a new session, it writes a short bridging message so the next chapter picks up cleanly. Older sessions get compressed into summaries so long campaigns do not overwhelm the model.

## Address modes: who you are talking to

The input bar has a small speech-bubble button next to the attach-files button. Its tooltip reads **Choose who to address**. This button sets who your message goes to, and it has three states.

- By default, your message goes into the scene. It is a normal in-game action or line of dialogue. The GM and your party respond in the story.
- **Talk to Party** adds a `[To the party]` marker and speaks to your companions directly. Use it for tactical talk, like "What should we do here?" This option only appears when your party is not empty.
- **Talk to GM** adds a `[To the GM]` marker and asks the GM out-of-character. Use it for questions like "Does my character know about the temple?" or for pacing requests.

The active mode shows an **On** marker in the menu. To turn **Talk to Party** or **Talk to GM** off, click that same menu entry again. Your messages then go back into the scene.

## Optional tool planning and lore searches

Open **Chat Settings → Function Calling** during play. **Let the GM search lore** lets the GM look up information by meaning without enabling every other optional tool. Enable vectorization for the relevant lorebooks and vectorize their entries first. Searches respect enabled books, folders, and chat-specific entry switches. They use the configured embedding connection and can add a model follow-up request.

Game chats require **Let the GM search lore** for lorebook tool lookups, even when **Enable Tool Use** is on. While it is off, `search_lorebook` is unavailable in the tool picker; an already selected entry stays visible with an explanation so you can remove it or turn lore search back on.

**Game tool connection** defaults to **Same as narrator**, which keeps the normal tool loop. Choosing another connection runs one separate planning request before narration. That model chooses the tools, and the narrator receives their actual results as text. The extra request is charged to the selected connection; a cheaper model can reduce tool costs, but may choose different tools. This single planning pass cannot chain a second lookup from the first result. Use **Same as narrator** when you want the narrator to reason through several tool rounds (up to four a turn, after which it narrates with the results it has).

Claude and Grok subscription connections do not support native tool calls. The affected controls explain this and are disabled unless a supported Game tool connection is selected. Text commands and dice tags still work. If a separate connection is missing or its request fails, the turn reports the failure instead of silently narrating without the requested tool work.

**Finish rolled turns in one request** changes the second kind of call above. Without it, a turn that rolls dice costs two requests: the draft, then a rewrite with the real numbers. With it on, the Game Master writes the outcome blind and the engine fills the numbers in afterwards, so the turn costs one request. It is on by default. Two things still add a request on top of it: the dice tool being called when **Enable Tool Use** is on, and a separate **Game tool connection**, which always makes its own planning request. See [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

If your local models share limited GPU memory, open **Chat Settings → Agents** and enable **Run Game tasks one at a time**. Narration, agents, and scene media wait for one another within that Game chat. It starts off, and it does not reserve the GPU against other chats or applications. Existing cancellation controls remain available while work is running or waiting.

## Turning on agents

Agents are optional AI helpers that run alongside the GM. To use them in a game, open **Chat Settings** during play, go to the **Agents** section, and turn on **Enable Agents**. Running agents adds cost, because they make extra calls.

Two agents are worth knowing for Game Mode:

- **Game Session Keeper** helps maintain continuity across your sessions.
- **Music DJ** picks background music. It needs Spotify or a local music folder.

Game Mode also uses **Review Agent Outputs** so you can check what an agent produced. For the full picture of agents, see [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).

## Choosing a model

World generation is the hardest part of Game Mode. It asks the model for one long, strict JSON document with no missing fields. A model that handles ordinary chat well can still fail this step.

For world generation, use a capable, current top-tier model on a paid connection. As of 2026, players report good results from the flagship tiers of the major providers. Examples are Anthropic Claude, OpenAI GPT, and Google Gemini. Specific model names change often, so treat these as examples, not a fixed list.

For ongoing gameplay turns, you can sometimes drop to a cheaper model, because turns ask for narration rather than strict JSON. If the GM starts forgetting NPCs or contradicting earlier details, move back up to a stronger model.

Avoid free or auto-routing models for world generation. They can route to a smaller model that cannot produce valid world-gen JSON. Small open-weight models usually fail this step too.

For the full parameter reference, see [Generation Parameters](../prompts/generation-parameters.md).

## The Game's controls

On a computer, the Game's controls open from buttons near the top right of the chat. On a phone, find them in the movable **Chat tools** three-dot menu:

- **Game controls** (the game controller):
  - **Retry turn**, **Retry scene analysis**, **Retry Music DJ** when Music DJ plays the Game's music, and **Retry assets image generation**.
  - When a storyboard plays as the Game background, it also has replay, play/pause and mute.
  - In a game with a world, **Show the scene** and **Show the overworld** switch views, and **Show the map** returns to an open dungeon, cave or station map.
  - **Edit game data** fixes the game's saved data by hand (see [Editing game data by hand](sessions-and-saves.md#editing-game-data-by-hand)), and **Checkpoints** takes the game back to an earlier moment (see [How your game saves](sessions-and-saves.md#how-your-game-saves)).
- **Session** (the feather): session history, the journal and session controls. See [Game Mode: Sessions and Saves](sessions-and-saves.md).
- **Volume** (the speaker): the **Master**, **Music**, **Sound Effects**, **TTS** and **Ambient** volume.
- **Game Assets** (the folder): scene media and the Asset Browser. See [Game Assets](game-assets.md).
- **Connected chat**, when the Game is linked to a Conversation. See [Connected Chats](../chats/connected-chats.md#switching-between-connected-chats).

Choose a tool to open its controls in a movable window on a computer, or a full-width panel on a phone. On a computer, drag its button to move it. On a phone, move the three-dot menu, or unlock it to reorder the tools inside. Closing the window or panel lets you open the tool again from the same place. See [Control windows and their buttons](../chats/chat-settings.md#control-windows-and-their-buttons).

You can also keep these controls inside **Chat Settings**. Open a control's window and choose **Put back in Chat Settings**; it then appears as an expandable section there. Its pop-out button makes it a separate window again. Each game saves your choice, and **Reset View** restores the starting arrangement: buttons on a computer, or Chat tools entries on a phone.

**Character Profiles** stays outside Chat tools on both computers and phones. Drag its portrait button wherever you want, then open it to choose a party member and view or edit their character sheet. On phones, **Map** also has its own movable button. Both follow your chat widget style, save their positions for this game, and can be locked from their open window. The desktop map keeps its existing map-panel controls.

## Where each gameplay topic lives

This guide gets you into a game. Each deeper topic has its own guide:

- [Game Mode: Combat](combat.md) covers encounters, the action menu, damage math, and quick-time events.
- [Game Mode: Party and NPCs](party-and-npcs.md) covers Character Profiles, character sheets, and the Adventure Journal.
- [Game Mode: Sessions and Saves](sessions-and-saves.md) covers ending and starting sessions and the session history.
- [Game Mode: Map, Time, and Weather](map-time-weather.md) covers the map views and the automatic clock and weather.
- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md) covers the dice menu and skill-check rules.
- [Game Mode: HUD Widgets](hud-widgets.md) covers the on-screen status widgets.
- [Game Assets](game-assets.md) covers the music, sound, sprite, and background library.
- [Storyboard Agent Guide](storyboard.md) covers installation plus Roleplay and Game Mode Storyboards.

Author's Notes work the same way here as in other modes. See [Roleplay Mode: Getting Started](../roleplay/getting-started.md).

## Troubleshooting

### World generation fails with a JSON or 422 error

The most common cause is that the model could not produce the full structured JSON. Try these in order.

1. Check which connection the GM is using. If it points at a free or auto-routing model, switch to a capable paid model.
2. Try again. Some failures are one-off, and the same setup works on a second try.
3. Shorten a very long setting or preferences field. Long inputs leave the model less room for the JSON output.

If a call almost worked but the JSON was slightly broken, Marinara offers a **Repair JSON** modal. It opens a line-numbered editor with the model's raw output. A status line tells you whether the JSON is valid or shows the parse error. Click **Format** to tidy valid JSON. Then click **Apply Repaired JSON** to use your fixed version without paying for a full retry. The **Repair JSON** option also appears for session summaries and other structured calls.

For more symptoms and fixes, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

### The GM narrates cheerfully even though you chose a dark tone

Some models stay upbeat no matter the tone. You have two options. Add a clear instruction in the wizard's preferences field, such as "keep narration grim, do not soften failures." Or switch to a model whose default voice matches the tone you want.

## Related guides

- [Game Mode: Combat](combat.md)
- [Game Mode: Party and NPCs](party-and-npcs.md)
- [Game Mode: Sessions and Saves](sessions-and-saves.md)
- [Game Mode: Map, Time, and Weather](map-time-weather.md)
- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md)
- [Game Mode: HUD Widgets](hud-widgets.md)
- [Game Assets](game-assets.md)
- [Storyboard Agent Guide](storyboard.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Generation Parameters](../prompts/generation-parameters.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
