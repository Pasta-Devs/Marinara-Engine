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
- **The Storyboard Agent.** Install it from **Agents > Download Agents**, then activate it for the finished Game under **Chat Settings > Agents** when you want still or animated Storyboards.
- **A video generation connection.** This is only needed for scene videos or animated Storyboards.
- **Music.** The **Music DJ** agent can play game music. It needs Spotify or a local music folder, and it is off by default.

## The setup wizard

When you create a Game Mode chat, a **setup wizard** opens. It has seven steps. The only required field is the GM connection on the first step. Every other field has a sensible default. You can move through the wizard quickly and let Marinara fill in the rest.

The seven steps are:

1. **Connection.** Set the game name, pick the GM connection, and optionally set a scene-effects connection. Scene effects default to **Local Model (Gemma)**.
2. **World.** Set the genre, setting, tone, difficulty, content rating, and language.
3. **Party.** Pick your persona (the character you play), the **Game Master Mode**, and any party members.
4. **Goals.** Tell the GM what you want from the adventure.
5. **Lorebooks.** Attach any lorebooks whose facts the GM should treat as canon. A lorebook is a set of background world facts. See [Lorebooks](../lorebooks/overview.md).
6. **Features.** Turn on optional systems like Visual Generation, Music DJ, and HUD widgets. Installable Agents can be activated from Chat Settings after the Game is created.
7. **GM.** Choose the presentation style and review advanced GM instructions before the world is built.

When you finish, click **Start Game**.

### Defaults worth knowing

These are the starting values in the **World**, **Party**, and **Features** steps. You can change any of them.

| Setting | Default | Notes |
|---|---|---|
| Genre | Fantasy | Multi-select, plus your own custom entries |
| Tone | Heroic | Multi-select |
| Difficulty | Normal | Casual, Normal, Hard, or Brutal; higher settings make combat more punishing |
| Content Rating | SFW | SFW or NSFW; NSFW only permits adult content, it does not force it |
| Language | English | All in-game text is written in this language |
| Game Master Mode | Standalone GM | Standalone GM builds a GM for you; Character GM uses one of your cards as the GM |
| Visual Generation | Off | Turn on for images; needs an image generation connection |
| Game Presentation | Standard | **Storyboard Optimized** uses the Storyboard Game Prompt to shape the GM's narration; it does not install or activate the Storyboard Agent |
| Music DJ | Off | Needs Spotify or a local music folder |
| Custom HUD Widgets | On | Uses AI-made status widgets from the new world |
| Start Muted | Off | Begins the game with audio muted |

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

## Where each gameplay topic lives

This guide gets you into a game. Each deeper topic has its own guide:

- [Game Mode: Combat](combat.md) covers encounters, the action menu, damage math, and quick-time events.
- [Game Mode: Party and NPCs](party-and-npcs.md) covers the party bar, character sheets, and the Adventure Journal.
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
