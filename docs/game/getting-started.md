# Game Mode: Getting Started

Game Mode turns Marinara Engine into a single-player role-playing game run by an AI Game Master. Use this guide to start a game, play the first turn and find the controls.

Game Mode is one of the three chat modes (Conversation, Roleplay and Game Mode). The Game Master (GM) is the AI that narrates the world, plays every character you meet and decides what happens next, like the Dungeon Master in a tabletop game. Marinara keeps track of the map, your party, non-player characters (NPCs), items, quests, in-world time and weather. You can split a long game into several **sessions**, like game nights in one campaign.

You do not have to use every mechanic. You can skip combat and dice and play for the story.

## Before you start

You need one thing: an AI account for the Game Master. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md) if you have not added one.

Everything else is optional and off by default. You can add it later:

- **Images.** The **Illustrator** agent draws NPC portraits, location backgrounds and scene images. Download it from **Agents → Agent Organizer**. It needs an image account. Without it, you still get the story, state tracking and combat, but the visual areas stay empty.
- **Scene effects from the Built-in model.** Marinara can run a small model on your own computer to pick backgrounds and music at no cost. It becomes the default **Scene effects model** once you download it. Until then the default is **Skip - use inline tags from GM**. See [Built-in Model Setup](../connections/local-model.md).
- **Storyboards.** Download the Storyboard agent, then turn it on for the game. See [Storyboard Agent Guide](storyboard.md).
- **Video.** A video account is only needed for scene videos or animated Storyboards.
- **Music.** The **Music DJ** agent plays music from Spotify or a local music folder.

## Start a game

1. Click **Chats** in the top bar, open the **GM** tab and click the **+** button (**New Game**). Or click **Game** on the Home screen. The setup wizard opens. See [Managing Chats](../chats/managing-chats.md).
2. On the first step, pick the **Model** that runs the GM. Choose an account you added before. If the list is empty, add one first. For world generation, pick a strong paid model (see [Choosing a model](#choosing-a-model)).
3. Click **Next** on each step. Every other field has a default, so you can click through.
4. On the last step, click **Create world**. The button shows **Generating World…** while Marinara builds your world. This is one large request to your model, so wait until it finishes.
5. When the world is ready, the game screen shows **Start Game**. Click it. The GM then writes the first message.

If custom HUD widgets are on (the default), a **Review Starting Widgets** button sits under **Start Game**. You can skip it, or use it to change the starting widgets first. See [Game Mode: HUD Widgets](hud-widgets.md).

> **Tip:** If you are new to Game Mode, leave **Game Master Mode** on **Standalone GM**. Marinara builds a snarky narrator for you.

If it did not work, see [World generation fails with a JSON or 422 error](#world-generation-fails-with-a-json-or-422-error).

### The setup wizard

| Step | What you set |
| --- | --- |
| **Connection** | **Game Name**, the **Model** that runs the GM, and an optional **Scene effects model**. The **Game Mode** card shows **VN** only for now. |
| **World** | Genre, setting, tone, difficulty, content rating, story style, violence, content boundaries and language. **Combat Preference** is **Turn-Based** or **Tactical**. Every new game plays on **MRPG** (Marinara RPG) classes (see [MRPG classes](mrpg-classes.md)). When a ruleset is installed, a **Rules** choice appears (see [Choose rules](#choose-rules)). |
| **Party** | Your persona (the character you play), **Game Master Mode**, party members and **GM intro message** (see [The GM intro message](#the-gm-intro-message)). Each member's starting MRPG tree comes from the **Game Mode** section of their card (see [Choose a character's trees](mrpg-classes.md#choose-a-characters-trees)). |
| **Goals** | What you want from the adventure. |
| **Lorebooks** | Lorebooks the GM treats as canon. A lorebook is a set of background world facts. See [Lorebooks](../lorebooks/overview.md). |
| **Features** | **Enable Agents**, then a card for each downloaded agent (**Illustrator**, **Music DJ**, **Lorebook Keeper**), plus **Custom HUD Widgets**, **Quick Time Events** and **Start Muted**. |
| **GM** | The presentation style and the **GM Prompt**. |

The ideas offered under the setting and goals change each time the wizard opens. In a Tactical game, the GM writes a short brief for each fight and Marinara builds a board from it. See [Combat](combat.md#tactical-battles-and-terrain).

The **World** step also has combat options for bosses. **GM directs bosses** is on by default. It lets the GM decide boss turns using your GM connection, which may take a moment. Ordinary enemies decide on their own, unless **GM directs bosses** is on and the game's ruleset gives the opposition to the Game Master (see [Game Master text](../extending/ruleset-sheets.md#game-master-text)). While **GM directs bosses** is on, **Game Master also plays named and brilliant opponents** (on by default) lets the GM play named characters and very clever foes too. Two more options are always shown: **Companions fight on their own** (on by default; turn it off to play the whole party yourself) and **Let cruel opponents strike the fallen** (off by default). A new game also offers **Permadeath** (off by default): a party member who falls in a fight and is not saved before it ends is gone for good. See [Combat](combat.md).

With the **Hierarchical Maps** agent downloaded (now called World Maps, see [World Maps](../agents/hierarchical-maps.md)) and **Enable Agents** on, the **Features** step can also draft a **Hierarchical world map**, use a saved map template or link a shared world.

### Defaults worth knowing

| Setting | Default | Notes |
| --- | --- | --- |
| Genre | Fantasy | Several allowed, plus your own. |
| Tone | Heroic | Several allowed. |
| Difficulty | Normal | **Casual**, **Normal**, **Hard** or **Brutal**. Higher settings make fights harder: more and tougher foes in an MRPG game (see [Battles in an MRPG game](combat.md#battles-in-an-mrpg-game)), harder-hitting enemies in a Legacy game (see [Difficulty scaling](combat.md#difficulty-scaling)). |
| Content Rating (sexual content) | SFW | **SFW** or **NSFW**. Covers sexual content only. NSFW permits it, it does not force it. |
| Story style | Standard | **Gentle** is a lower-stress GM. See [Story style, violence and content boundaries](#story-style-violence-and-content-boundaries). |
| Violence | Serious (SFW) or Graphic (NSFW) | **Mild**, **Serious** or **Graphic**. Set apart from the content rating. |
| Content boundaries | None | Subjects the GM keeps out of the story. |
| Language | English | All in-game text is written in this language. |
| Game Master Mode | Standalone GM | **Character GM** uses one of your character cards as the GM. |
| Scene effects model | Built-in model | Only once you download it. Until then the default is **Skip - use inline tags from GM**. |
| Enable Agents | Off | Turn on to see the agent cards. |
| Illustrator | Off | Needs the Illustrator agent and an image account. |
| Music DJ | Off | Needs Spotify or a local music folder. |
| Custom HUD Widgets | On | The model designs status widgets for the new world. |
| Quick Time Events | On | Turn off for screen-reader or untimed play. |
| Start Muted | Off | Begins the game with all audio muted. |
| Game Presentation | Standard | See below. |

### Story style, violence and content boundaries

The **World** step has four settings that decide what the story may contain and how hard it hits. They sit together under **Content Rating (sexual content)**. You can change all of them except the content rating after the game starts. See [Change them during a game](#change-them-during-a-game).

| Setting | What it decides |
| --- | --- |
| **Content Rating (sexual content)** | **SFW**: romance and affection, and sex scenes fade to black. **NSFW**: sex scenes can be written explicitly. It decides nothing else. |
| **Story style** | **Standard**: mistakes and bad luck land with real consequences. **Gentle**: real challenges, but setbacks do not escalate to punishment or trauma. |
| **Violence** | **Mild**, **Serious** or **Graphic**: how violence is shown. It starts at **Serious** for SFW and **Graphic** for NSFW, which is what each rating always meant. |
| **Content boundaries** | Subjects you never want in the story, one per line, such as `harm to animals`. |

#### The Gentle story style

Choose **Gentle** if you want to enjoy the story and its characters without the GM punishing every slip. With **Gentle**:

- Setbacks cost time, face, resources or a detour. The GM does not answer them with injury, humiliation, the loss of someone you care about, or trauma you did not steer toward.
- The GM calls for a skill check only when your character's own skill or choice matters. It never rolls against something your character cannot control, such as a disability, a condition, their body or their background. See [Skill checks in a Gentle game](dice-and-skill-checks.md#skill-checks-in-a-gentle-game).
- The world is planned with warmth: arcs grow from hopes and relationships as much as from wounds, and twists surprise you instead of betraying you.

**Gentle** replaces the built-in GM instructions only. If you wrote your own **GM Prompt**, the GM keeps your text. Combat, damage and the difficulty setting work the same in both styles.

#### Content boundaries

Write one subject per line, up to 40 subjects and 2,000 characters in all. Anything past either limit is left out. The GM treats each one as a hard limit, above the rating, the tone, any character's personality and the plot. It does not bring them up, use them as a threat, twist or backstory, or hint at them. If you bring one up yourself, the GM keeps it brief and moves on. Boundaries work in both story styles and at both ratings, and your own rating guidelines cannot remove them.

> **Note:** The story is written by an AI model, so Marinara cannot guarantee that a listed subject never appears. If one slips in, swipe or edit the reply.

#### Edit the rating guidelines

Under the rating buttons, expand **Edit rating guidelines** to see the text the GM receives for the chosen rating, violence and story style. Edit it to set your own content rules for this game, or click **Reset to default** to go back to the built-in text. While you leave it unchanged, it follows the rating, violence and style you pick.

#### Change them during a game

Open **Chat Settings → Prompt Preset**. For a game, this section also has **Story style**, **Violence**, **Content boundaries** and **Rating guidelines**. Changes apply from the next turn. The content rating itself is fixed once the game is created.

A prompt preset can also carry a story style, violence level and boundaries, so you can reuse them in every game. See [Game story settings](../prompts/presets.md#game-story-settings).

### Choose rules

**Rules** appears only for a new game and only when at least one ruleset is installed. **Marinara's own rules** is the default: the built-in d20 checks and the six-attribute sheet. A ruleset such as **5e (SRD 5.1)** replaces them with a tabletop system's own checks and character sheet, and may fight battles by its own rules too. The wizard shows what each ruleset covers. The choice is fixed once the game is created. See [Playing with a Ruleset](rulesets.md).

### The GM intro message

**GM intro message** (on the **Party** step) decides how the game opens:

- **None** (default): the GM opens the game as it sees fit.
- **Defined**: type the first message exactly as it should read. The game opens with this text, and regenerating gives the same text.
- **Guided**: describe how the opening should go, such as where it starts and who is there. The GM writes the opening from it.

The text can be up to 8,000 characters. It cannot contain double curly braces, and **Guided** text cannot contain square brackets either. The field tells you when the text cannot be used. A world's story can set its own intro. The field then shows it as locked and you cannot change it.

### Storyboard Optimized

On the **GM** step, **Game Presentation** can be **Standard** or **Storyboard Optimized**. **Storyboard Optimized** uses the Storyboard Game Prompt, which shapes GM turns into filmable visual beats. It does not download or turn on the Storyboard agent, turn on image or video generation, or change your accounts. After the game is created, set those up under **Chat Settings → Agents → Storyboards**.

The **GM Prompt** editor previews the prompt for the selected presentation. If you leave the text unchanged, the built-in preset stays selected. If you edit it, your text overrides the preset.

An alternative single-shot anime setup stays available after setup: choose **Anime Episode Director** for the Animation Planner and **Anime Game Video** for the Storyboard Video Prompt.

## Play your first turn

Type what your character does or says and send it. The GM replies, updates the world and may call for a dice roll or start a fight.

The speech-bubble button next to the attach-files button (tooltip **Choose who to address**) sets who gets your message:

| Mode | What it does |
| --- | --- |
| Default | Your message goes into the scene as an action or line of dialogue. The GM and your party respond in the story. |
| **Talk to Party** | Adds a `[To the party]` marker and speaks to your companions. Only shown when your party is not empty. |
| **Talk to GM** | Adds a `[To the GM]` marker and asks the GM out of character, for example "Does my character know about the temple?". |

The active mode shows **On** in the menu. Click the same entry again to turn it off.

## The Game's controls

On a computer, the controls open from buttons near the top right of the chat. On a phone, find them in the movable **Chat tools** three-dot menu.

| Control | What it holds |
| --- | --- |
| **Game controls** (game controller) | **Retry turn**, **Retry scene analysis**, **Retry Music DJ** (when Music DJ plays the music) and **Retry assets image generation**. For a storyboard background, also replay, play/pause and mute. **Edit game data** fixes saved data by hand (see [Editing game data by hand](sessions-and-saves.md#editing-game-data-by-hand)). **Checkpoints** returns to an earlier moment (see [How your game saves](sessions-and-saves.md#how-your-game-saves)). |
| **Session** (feather) | Session history, the journal and session controls. See [Game Mode: Sessions and Saves](sessions-and-saves.md). |
| **Volume** (speaker) | **Master**, **Music**, **Sound Effects**, **TTS** and **Ambient** volume. |
| **Game Assets** (folder) | Scene media and the Asset Browser. See [Game Assets](game-assets.md). |
| **Connected chat** | Shown when the game is linked to a Conversation. See [Connected Chats](../chats/connected-chats.md#switching-between-connected-chats). |

Choose a tool to open it in a movable window on a computer, or a full-width panel on a phone. On a computer, drag a tool's button to move it. On a phone, move the three-dot menu, or unlock it to reorder the tools inside. See [Control windows and their buttons](../chats/chat-settings.md#control-windows-and-their-buttons).

You can also keep a control inside **Chat Settings**. Open the control's window and choose **Put back in Chat Settings**. It then appears there as an expandable section, and its pop-out button makes it a window again. Each game saves your choice. **Reset View** restores the starting arrangement.

**Character Profiles** stays outside Chat tools on computers and phones. Drag its portrait button where you want it, then open it to choose a party member and view or edit their sheet. On phones, **Map** also has its own movable button. Both follow your chat widget style, save their positions for this game and can be locked from their open window.

## Choosing a model

World generation is the hardest part of Game Mode. It asks the model for one long, strict JSON document (a text format that must be exact or the game cannot read it) with no missing fields. A model that chats well can still fail this step.

- For world generation, use a capable, current top-tier model on a paid account. As of 2026, players report good results from the flagship tiers of the major providers, such as Anthropic Claude, OpenAI GPT and Google Gemini. Model names change often, so treat these as examples, not a fixed list.
- The cheapest models we recommend, both tested in play as of October 31, 2026, are DeepSeek V4 Flash and Claude Haiku 5.5.
- For later turns you can sometimes use a cheaper model, because turns need narration, not strict JSON. If the GM forgets NPCs or contradicts earlier details, move back to a stronger model.
- Avoid free or auto-routing models for world generation. They can route to a small model that cannot produce valid JSON. Small open-weight models usually fail too.

For the full parameter reference, see [Generation Parameters](../prompts/generation-parameters.md).

## What a turn costs

Game Mode makes three kinds of AI request:

1. **World generation.** Once, when you click **Start Game**. One large request that returns the world overview, starting map, NPCs, party sheets and widgets.
2. **Gameplay turns.** Each message builds a fresh prompt with the current state. The GM narrates and updates the world. The engine, not the model, calculates combat round math, so results stay fair.
3. **Session summaries.** When you end a session, the GM writes a recap and continuity notes. When you start the next one, it writes a short bridging message. Older sessions are compressed into summaries so long campaigns fit the model.

## Optional tool planning and lore searches

Open **Chat Settings → Function Calling** during play.

- **Let the GM search lore** lets the GM look up lorebook facts by meaning. Turn on vectorization for the lorebooks and vectorize their entries first. Searches respect enabled books, folders and chat-specific entry switches. They use your embedding account and can add a model request. Game chats need this switch for lorebook lookups, even when **Enable Tool Use** is on. While it is off, `search_lorebook` is unavailable in the tool picker.
- **Game tool provider** defaults to **Same as narrator**, which keeps the normal tool loop (up to four tool rounds a turn). Choosing another account runs one separate planning request before narration. That model picks the tools and the narrator receives their results as text. This costs one extra request per turn on that account. A cheaper model can lower the cost but may choose different tools. One planning pass cannot chain a second lookup.
- **Finish rolled turns in one request** is on by default and saves a request on turns that roll dice. See [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

Claude and Grok subscription accounts do not support native tool calls. The controls explain this and stay disabled unless a supported **Game tool provider** is selected. Text commands and dice tags still work. If a separate account is missing or its request fails, the turn reports the failure instead of narrating without the tool work.

If local models share limited GPU memory, open **Chat Settings → Agents** and turn on **Run Game tasks one at a time**. Narration, agents and scene media then wait for one another within that game chat. It is off by default and does not reserve the GPU against other chats or applications.

## Turning on agents

Agents are optional AI helpers that run alongside the GM. They make extra requests, so they add cost. To use them, open **Chat Settings → Agents** during play and turn on **Enable Agents**. Two are useful in Game Mode:

- **Game Session Keeper** helps keep continuity across sessions.
- **Music DJ** picks background music.

**Review Agent Outputs** lets you check what an agent produced. See [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).

## Troubleshooting

### World generation fails with a JSON or 422 error

The model most likely could not produce the full JSON. Try these in order.

1. Check which model the GM uses. If it is a free or auto-routing model, switch to a capable paid one.
2. Try again. Some failures happen once.
3. Shorten a long setting or preferences field. Long input leaves less room for the JSON.

If a call almost worked, Marinara offers a **Repair JSON** window with the model's raw output in a line-numbered editor. A status line says whether the JSON is valid or shows the parse error. Click **Format** to tidy valid JSON, then **Apply Repaired JSON** to use your fix without paying for a retry. **Repair JSON** also appears for session summaries and other structured calls. For more fixes, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

### The GM narrates cheerfully although you chose a dark tone

Check that the game's **Story style** is **Standard**: **Gentle** keeps setbacks light on purpose (see [The Gentle story style](#the-gentle-story-style)). Some models stay upbeat. Add a clear instruction in the wizard's preferences field, such as "keep narration grim, do not soften failures". Or switch to a model whose default voice fits the tone.

### The model declines a turn

A toast says **The model declined this request** when the model refused to write the turn. Some models refuse on certain wording in a game's rating guidelines, a preset or a character card. Try these in order:

1. Retry the turn. Some refusals happen once.
2. If you edited the rating guidelines, open **Chat Settings → Prompt Preset** and reset **Rating guidelines** to the built-in text.
3. Try another model for this game.

## Where each topic lives

- [Game Mode: Combat](combat.md): encounters, the action menu, damage math and quick-time events.
- [Game Mode: MRPG Classes](mrpg-classes.md): choosing classes, stats, levels and promotions, the class sheet, shared games, and moving a Legacy game over.
- [Game Mode: Party and NPCs](party-and-npcs.md): Character Profiles, sheets and the Adventure Journal.
- [Game Mode: Sessions and Saves](sessions-and-saves.md): ending and starting sessions, history and checkpoints.
- [Game Mode: Map, Time, and Weather](map-time-weather.md): map views, the clock, weather and morale.
- [Game Mode: Dice and Skill Checks](dice-and-skill-checks.md): the dice menu and skill-check rules.
- [Game Mode: HUD Widgets](hud-widgets.md): the on-screen status widgets.
- [Game Assets](game-assets.md): the music, sound, sprite and background library.
- [Storyboard Agent Guide](storyboard.md): Storyboards for Game Mode and Roleplay.
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md): Author's Notes work the same way here.
