# Downloadable Agents Reference

This guide lists the official first-party agents in **Agents → Agent Organizer**, by group. Agents do not ship with a fresh install. Their sources and catalog are public in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Each entry says what the agent does, when it runs, where it works and its main settings. To install and turn agents on, read the [Agents overview](agents-overview.md) first. Entries marked **staging only** are available to Engine staging users; stable users see them after the package is promoted.

## How to read this reference

Install an agent from **Agent Organizer**, then add it to each chat you want. Agents are set up per chat, not per character card. The [Agents overview](agents-overview.md) covers installing, updating, per-chat setup and cost.

Each entry shows the same quick facts.

- **Phase** or **Integration**: when a pipeline agent runs. **Pre-Generation** runs before the reply and can add text to the prompt. **Parallel** runs at the same time as the reply and does not see the finished text. **Post-Processing** runs after the reply and can read it. Some can rewrite it. Feature packages such as World Maps, Calls and Conversation games plug into their chat screen instead. Apps open in their own **Home** tab.
- **Where it works**: the chat modes that accept the agent. Most agents work in Roleplay.
- **Key settings**: the settings you are most likely to change, in the agent's card in **Chat Settings**.

A run interval makes an agent run once every few user and assistant messages instead of after every message. You can set it up to 100.

In Roleplay, Illustrator's run interval is set per chat, in its card in **Chat Settings**. The value in its setup is the default for chats without their own. Illustrator also accepts **0**: it never runs automatically and stays available for Gallery actions.

## Apps

Apps have their own tab in **Home**. You use them on their own instead of adding them to a chat. Each asks for a restart after you install it.

### Noodle

Adds the optional local Noodle public timeline in its own **Home** tab. It does not run in the chat-agent pipeline.

- **Integration**: Feature package with local routes, generation and media flows, and background schedulers.
- **Where it works**: Home, with optional context carried in from Conversation, Roleplay and Game chats.
- **Key settings**: install it from **Agents → Agent Organizer** and restart when prompted. Inside Noodle you set invited accounts, text and image connections, timeline refreshes, random users and chat carryover.
- **Data**: uninstalling removes the tab and stops the schedulers after a restart. Your Noodle data stays for a later reinstall.
- **Full guide**: [Noodle: The In-App Social Timeline](noodle.md).

### Slurp

A private social app for your characters. Turn characters and personas into Creators, post public or locked photos, and watch a simulated audience follow, subscribe, buy, comment and message. By default it is tuned for adult content. It is all pretend: prices are fictional and no real payments happen.

- **Integration**: App in its own **Slurp** tab in **Home**.
- **Where it works**: Home.
- **Key settings**: install it, restart when prompted, then open **Home → Slurp**. To let a chat's characters remember recent Slurp posts and messages, turn on **Include Slurp activity** in that chat's **Chat Settings**, under **Connected Chats**. Carryover must also be on for that chat mode in Slurp's settings. **Slurp Settings → Autopurge** removes old Slurp media to save space. It is off by default.
- **Older names**: older catalogs list it as **Slurp Remastered**, next to the retired **Slurp Legacy**, which gets no more updates.
- **Full guide**: [Slurp package guide](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/slurp2/README.md).

### Gacha Forge

A gacha game built from a world you describe: banners to pull on, a cast the model writes and paints, story chapters told by a visual-novel narrator, and battles, gear and events. Your lorebooks can feed the world, but a hand-written scenario is enough.

- **Integration**: App in its own **Gacha Forge** tab in **Home**.
- **Where it works**: Home.
- **Key settings**: install it, restart when prompted, then open **Home → Gacha Forge**. Uninstalling removes the tab after a restart.
- **Full guide**: [Gacha Forge package guide](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/gacha-forge/README.md).

### Modern Life Sim

A life simulation. You live in a small town on a clock, with a job to keep, bills to pay, and energy and hunger to look after. The people around you come from your character cards, and a visual-novel narrator tells the scenes that matter.

- **Integration**: App in its own **Life Sim** tab in **Home**.
- **Where it works**: Home.
- **Availability**: **Staging only**, requiring Engine **2.4.4+** (below 4.0.0). It is an alpha. If an update changes something an older save depends on, Life Sim tells you when you open that save. You can start a new life or continue at your own risk.
- **Key settings**: install it, restart when prompted, then open **Home → Life Sim**. It needs a text connection. An image connection is optional: without one, places show illustrated cards. Optional modules stay off until you switch them on for a life. The **Adult** module asks you to confirm that you are an adult.
- **Full guide**: [Modern Life Sim package guide](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/modern-life-sim/README.md).

### Story Writer

A book you write together with the model. Set up the story, cast and lorebooks in a sidebar, leave author's instructions on a sticky note, and the model writes the next chapter when you ask. You can click anywhere in the text to change it, or write the first chapter yourself.

- **Integration**: App in its own **Story Writer** tab in **Home**.
- **Where it works**: Home.
- **Availability**: needs a Marinara Engine newer than **v2.5.1** (the next release or a current staging build).
- **Key settings**: install it, restart when prompted, then open **Home → Story Writer** and pick a text connection in its sidebar. Stories are saved on your Marinara server. You can start new ones, return to old ones and download them as Markdown or plain text.
- **Full guide**: [Story Writer package guide](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/story-writer/README.md).

## Writer agents

Writer agents shape the story or the prose. They add guidance before the reply or clean up the reply after it.

### Prose Guardian

Rewrites the latest reply to remove banned words and repetition without changing the meaning. Use it to stop a model from repeating phrases or overusing a word.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Banned Words** (default `ozone`), **Prefer In Writing** and **Remove From Writing** text boxes. **Hold Message Until Rewrite** (on by default) hides the reply until the cleanup finishes. Without it, the raw reply shows first and is swapped afterward.

### Continuity Checker

Fixes concrete logic errors in the latest reply, such as a character in two places at once or a broken timeline. When it finds problems, it shows a checklist so you pick which fixes to apply.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Hold Message Until Rewrite** toggle.

### Card Evolution Auditor

Watches how a character changes during play and suggests edits to that character's card. It never edits automatically. Every suggestion opens the **Review Character Card Updates** modal for you to approve or reject.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: it runs once every 8 user and assistant messages by default. See [Agent approvals and the Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Creates a one-time nudge for the story when you ask for it. When this agent is active in a Roleplay chat, a **Push Story** button appears. Click it to arm the next reply, which then advances the plot or adds a surprise.

- **Phase**: Pre-Generation.
- **Where it works**: Roleplay only.
- **Key settings**: **Story Push Mode** (**Natural** advances current threads, **Random Event** adds a plausible surprise). It can also keep a hidden long-term arc called the **Secret Plot**. See [Narrative Director and Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Scans the lorebooks you pick, and any files you upload, before the reply. It summarizes the parts that matter and adds that summary to the prompt. A lorebook is a set of background facts about your world. This is a light search and needs no separate database.

- **Phase**: Pre-Generation.
- **Where it works**: Roleplay.
- **Key settings**: **Use chat-active lorebooks**, a **Fixed Source Lorebooks** picker and file upload. Do not run it together with Knowledge Router, since they overlap. See [Knowledge sources](knowledge-sources.md).

### Knowledge Router

A cheaper alternative to Knowledge Retrieval. It reads short descriptions of your lorebook entries and adds the matching entries word for word. It works best when entries have good descriptions.

- **Phase**: Pre-Generation.
- **Where it works**: Roleplay.
- **Key settings**: **Use chat-active lorebooks** and a **Fixed Source Lorebooks** picker. A coverage badge shows what percentage of source entries have a description. See [Knowledge sources](knowledge-sources.md).

## Tracker agents

Tracker agents keep a running record of the scene, the characters and your stats. **Add as Prompt Section** adds an agent's latest output to the prompt so the model stays consistent. It is on by default for every tracker except Expression Engine and Background.

### World State

Tracks the date, time, weather, location, and which characters are present. This keeps the scene grounded so the model does not forget where and when the story happens.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Add as Prompt Section** (on by default).

### Expression Engine

Reads the emotion in the latest reply and picks a matching sprite or expression for the character. A sprite is a character image shown in the scene. Use it for standing character art that changes with the mood.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Sprite Source** (**Expressions**, **Full-body**, or both), an **Expression Avatars** toggle, a **Sprite Owners** picker, and size and opacity sliders. See [Character sprites](../characters/sprites.md).

### Quest Tracker

Manages quest objectives, completion, and rewards. Use it for adventure style play where you want a visible task list.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Add as Prompt Section** (on by default).

### Background

Picks the best background for the current scene from your uploaded backgrounds. It does not generate images. Use Illustrator for generated scene backgrounds.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: the standard agent connection and context controls. It picks only from images already in your background library.

### Character Tracker

Tracks the characters present, with their mood, actions, appearance, outfit, thoughts and per-character stats such as HP. It can also create portraits for new characters that have none.

A card that describes several people, such as a scenario card with a cast, can be tracked per person. Mark each person in the card text with a `[CHARACTER: Name]` header or a `Name:` field. Each member keeps their own name, mood, outfit, thoughts and portrait. They do not share the card's portrait. An old entry named after the card stays until the tracker reports an individual member to replace it. Manually added characters keep their manual identity.

When a character returns after leaving the scene, the tracker reuses their latest saved stats and custom fields. Characters backed by cards also get their configured RPG pools and attributes. In a Merged Roleplay group, present characters can also set which character cards are active for the next reply. See [Automate active characters](../chats/group-chats.md#automate-active-characters-merged-only).

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Add as Prompt Section** (on by default) and an optional **Auto-Generate NPC Avatars** setting with its own image connection picker. **Include the outfit in portraits** is on by default. Turn it off to draw portraits from the look alone.

### Beholder

Tracks each character's clothing by body slot, held items, wounds, missing body parts, explicitly bare slots and non-human species. Its latest validated snapshot appears in Beholder's drawer in Roleplay **Chat Settings**. It goes to Beholder's next tracking call and to the next main reply.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay only.
- **Key settings**: add it under **Chat Settings → Agents → Tracker Agents**, then open **Configure Beholder** to choose its connection, model, prompt, context and output limits. **Add as Prompt Section** is on by default.
- **Prompt template**: pick the template that matches the model behind Beholder's connection. Marinara cannot detect the model, so this is a manual choice. A wrong choice is not fatal but gives worse results.
  - **SOTA model — one prompt** (default): one call covering every tracked field. Use a strong general model.
  - **Beholder local model — five passes**: five narrow calls, one per tracked lane, for the purpose-trained [Beholder](https://huggingface.co/GetBeholder/Beholder-GGUF) extractor served on your computer (for example `Beholder-Q8_0.gguf` behind koboldcpp or llama.cpp). That model answers one lane at a time, so the single-prompt template returns partial state. It runs offline at no cost.
- **Origin**: adapted from [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), licensed AGPL-3.0-only. The official package does not load the old extension's DOM, polling or local-storage runtime.

### Persona Stats

Tracks status bars for your own character, such as Satiety, Energy, and Hygiene, plus any custom bars you add. Use it for survival or life-sim style play.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Add as Prompt Section** (on by default). See [Character colors and stats](../characters/colors-and-stats.md).

### Custom Tracker

Tracks fields you define yourself, such as currencies, counters, or flags. Use it when the built-in trackers do not cover something your story needs.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Add as Prompt Section** (on by default).

### Inventory Tracker

Tracks money, equipped gear and carried items as three structured lists. Duplicate names are merged, and locked rows stay unchanged in later tracker runs.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Add as Prompt Section** (on by default). The HUD and Tracker Panel let you edit and lock every name and quantity.

### Quartermaster

Manages the active persona's inventory, equipment slots, item quantities, storage locations and saved outfits. It reads the story after replies and applies item changes. A floating dock and the Tracker Panel let you edit the same inventory by hand. Item and outfit artwork is optional.

- **Phase**: Post-Processing, with inventory context supplied to later replies.
- **Where it works**: Roleplay. It tracks the active persona, not party members or NPCs.
- **Availability**: requires Engine **2.4.6+**.
- **Set up**: install it, restart when prompted. In each Roleplay chat, turn on agents in **Chat Settings → Agents**, add Quartermaster under **Tracker Agents** and choose its model connection. Open the dock from the launcher above the Tracker Panel.
- **Key controls**: equip and store items, save outfits, restore inventory or revert recent tracker changes, and export or import a chat's setup. Image generation uses its own image connection. See the [Quartermaster package guide](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/quartermaster/README.md) before turning on the appearance macro or avatar replacement.

### Relationship Tracker

Keeps an editable relationship web for the character cards in a Roleplay group chat, plus each character's view of the active persona. Relationships are positive, neutral, negative or complicated. Manual locks protect your edits from automatic changes.

- **Phase**: Post-Processing, with relationship context supplied to later replies.
- **Where it works**: Roleplay group chats.
- **Availability**: requires Engine **2.4.4+** (below 4.0.0).
- **Set up**: install it, restart when prompted. In each Roleplay chat, turn on agents in **Chat Settings → Agents**, add it under **Tracker Agents** and choose its model connection. The web appears in the Tracker Panel. Select **All relationships** or **Scene-only relationships** there once to start the chat.
- **Key controls**: **All relationships** or **Scene-only relationships** for prompt context, **Update from History** for a scan of recent messages, manual editing and locking, and **Resume automatic updates**. **Context Size** (default 5 messages), **Presence lookback** (default 15) and the history scan's message count are separate controls. See the [Relationship Tracker package guide](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/relationship-tracker/README.md).

### Memory Nag

Keeps a short, editable memory vault for each Roleplay chat. It scans the chat in batches, sorts memories by current and past participants, and moves settled memories to a restorable Resolved list. A memory can keep a short dialogue line word for word when the exact wording matters.

After each reply, word matching hands the tracker only the most relevant active memories. The tracker decides whether the scene calls for a nag and can pick only from those memories. It cannot create a new memory during recall.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay only.
- **Key settings**: **Vault scan connection** (default: the Agent connection), **Messages per batch** (20), **Maximum memories created per character** (10), **Maximum memories considered per character** (5) and **Maximum memories injected** (3). Use **Scan chat** for the first backfill and **Open vault** to search, add, edit, resolve, restore or delete memories.
- **Prompt placement**: without a preset marker, chosen nags enter the next reply inside `<context><memory_nags>…</memory_nags></context>`. Add a Memory Nag Agent section to place them yourself.
- **Data**: the vault belongs to one chat and stays if the package is turned off or uninstalled. Deleting a memory is permanent and always asks first.

### World Maps

Adds nested locations and spatial links to a story. You author regions, areas, rooms and connections, move between locations, and the current position adds spatial context to generation. Game Mode also gets a world-map view.

- **Integration**: Feature package with map UI and chat context instead of a generation-phase agent.
- **Where it works**: Roleplay and Game.
- **Key settings**: turn it on for a Roleplay chat in **Chat Settings → Agents**, or pick it when you create a game and manage it in that game's settings. Installing or removing it needs a restart.
- **Full guide**: [World Maps: Setup, Authoring, and Travel](hierarchical-maps.md).

## Misc agents

Misc agents add extras such as images, music, audience reactions, and card updates.

### Echo Chamber

Simulates a live audience reacting to your scene, in a floating **Echo** widget in the chat area. It reveals one new reaction every 30 seconds.

- **Phase**: Parallel.
- **Where it works**: Roleplay.
- **Key settings**: pick a style such as **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** or **Harbingers**. The widget has **Re-run Echo Chamber** and **Clear messages**.

### Long-Term Memory

Extracts lasting memories from chat summaries, character records and lorebooks into a package-owned vault, then recalls relevant context before the main reply. It supports vault browsing, source imports, review of pending drafts and preset-marker placement.

- **Integration**: Feature package with pre-generation context and memory management UI.
- **Where it works**: Conversation, Roleplay and Game.
- **Key settings**: recall token budget (128-16,384), maximum recalled chunks (1-100), score threshold, recent-message context (1-20), recall style, search weights, resolved-memory inclusion, recall preamble, extraction settings, source limits, prompt templates, AI keyword extraction and Game-mode extraction.
- **Data**: use the Memory Settings backup controls to export or replace the vault, drafts and settings. **Delete all data** permanently removes memories, drafts, activity and indexes but keeps settings. Uninstalling keeps the vault for a later reinstall. Installing, updating or removing it needs a restart.
- **Compatibility**: Engine `2.3.5` through before `4.0.0`. Permissions: `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage`, `ui`.

### Illustrator

Makes images and videos. It writes visual prompts for important moments and sends them to your image or video service.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: Illustrator runs once every 5 user and assistant messages by default. Set **Image Run Interval** on each Roleplay chat's card to change this. Automatic clips use **Video Run Interval** when **Illustrator makes** is **Pictures and clips** or **Clips only**. Set **Video Run Interval** to **0** to turn automatic clips off. Settings include **Prompt Model**, **Image Style**, **Attach Card Appearance**, and **Send Avatar References**. For the full setup, see [Illustrator agent](../media/illustrator-agent.md).

### Lorebook Keeper

Creates and updates lorebook entries from important facts in your chat, so your world notes grow as you play.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay. In Game Mode, a session-end variant called **Game Session Keeper** does the same job.
- **Key settings**: runs once every 8 user and assistant messages by default. **Target Lorebook** chooses where entries go, with an auto-select option. Advanced prompts can return a writable lorebook name or an alias such as `world`, `npc`, `scene` or `player`. Missing alias destinations are created and linked to the chat. With no destination, the single-lorebook behavior stays.

### Combat

Manages combat: initiative, HP and turn order. When it is active, an **Encounter** button appears above the message box.

- **Phase**: Parallel.
- **Where it works**: Roleplay.
- **Key settings**: it includes a dice-roll tool for turn resolution.

### Immersive HTML

Adds in-world visual elements to the latest reply, such as a styled note or screen, without changing the story.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay only.
- **Key settings**: **Hold Message Until Rewrite** toggle.

### Music DJ

Reads the mood of the scene and plays matching music. It can use Spotify, YouTube, or local audio files.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay and Game.
- **Key settings**: a **Music Player** setting picks the provider, and each provider needs its own setup. For the full steps for Spotify, YouTube, and local music, see [Music DJ](../media/music.md).

### Haptic Feedback

Reads the narrative and controls connected intimate toys in real time through Intiface Central. Intiface Central must already be running with a toy connected before you enable this agent.

- **Phase**: Post-Processing.
- **Where it works**: Conversation, Roleplay, and Game.
- **Key settings**: a **Touch Sensitivity** choice (**Subtle**, **Standard**, or **Intense**) and an **Intiface URL** field. Sensitivity guides the Agent's choices without capping the available `0.0-1.0` intensity range. For the full setup, see [Haptic Feedback setup](../integrations/haptic-feedback.md).

### CYOA Choices

Adds clickable "What will you do?" choice buttons after each reply, for a choose-your-own-adventure feel. Each button holds a full action you can send with one click.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Edit** to rewrite the choices and **Re-roll** to generate new ones. Turn on **Add CYOA choices to the message box instead of sending them** in **Settings → General → Input & Editing** to have clicked choices go into your message box.

### Storyboard

Plans still or animated storyboards from finished Roleplay exchanges and Game narration. Separate planning and provider-aware formatting keep the story order, character identity and chosen style across keyframes and videos.

- **Integration**: Agent package; Game and Roleplay use its prompt templates and settings through the Engine's Storyboard integration.
- **Where it works**: Roleplay and Game.
- **Key settings**: still or animation planners, image and video connections, keyframe count, duration, display mode, character-reference handling, Roleplay episode and style templates, and Game illustration and video templates.
- **Compatibility**: Engine `2.3.5` through before `3.0.0`. Permissions: `agent-runtime`, `chat-read`, `prompt-context`, `storage`, `ui`. No restart needed.
- **Full guide**: [Storyboard Agent: Roleplay and Game Mode](../game/storyboard.md).

### 2D Avatars

Shows characters and personas as animated 2D avatars that blink, talk and change faces with each reply. An avatar is either PNGTuber-style sprites (your expression sprites with blink and talk pictures) or a mesh avatar file (`.mavatar`).

- **Integration**: Agent package. The Engine draws the avatars. It sends no extra requests to your AI connections while you chat.
- **Where it works**: Roleplay and Game, for characters and personas.
- **Availability**: in **Agent Organizer** for every install. Needs Marinara Engine 2.5.1 or newer.
- **Key settings**: set up each avatar on the agent's page in **Agents**. The agent also carries the prompts that make blink and talk pictures and a mesh avatar from a sprite.
- **Compatibility**: Engine `2.5.0` through before `4.0.0`, Capability API 1.73. Permissions: `agent-runtime`, `chat-read`, `storage`, `ui`. No restart needed.
- **Full guide**: [2D and 3D Avatars](avatars.md).

### 3D Avatars

Shows characters and personas as animated 3D models that blink, talk and change faces with each reply. It supports VRM models (`.vrm`, versions 0.x and 1.0) with an optional idle animation (`.vrma`), MMD PMX models, and rigged GLB and FBX models whose bones are matched by name.

- **Integration**: Agent package. The Engine draws the avatars. It sends no extra requests to your AI connections while you chat.
- **Where it works**: Roleplay and Game, for characters and personas.
- **Availability**: in **Agent Organizer** for every install. Needs Marinara Engine 2.5.1 or newer.
- **Key settings**: set up each avatar on the agent's page in **Agents**.
- **Compatibility**: same as 2D Avatars.
- **Full guide**: [2D and 3D Avatars](avatars.md).

### Calls

Adds live audio and video calls with Conversation characters: calls you start, incoming calls, call-only transcripts, text-to-speech, microphone input and character video clips.

- **Integration**: Conversation feature package with toolbar, chat and Chat Settings controls.
- **Where it works**: Conversation.
- **Key settings**: open **Chat Settings → Agents → Calls** to turn calls on and choose speech, microphone, ringing and video behavior. See [Conversation Audio and Video Calls](../conversation/calls.md). Installing or removing it needs a restart.

### UNO

Adds a rules-enforced UNO table for you and Conversation characters, with house rules and two to ten players.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/uno`, then choose players and house rules. Installing or removing it needs a restart.

### Chess

Adds a one-on-one Chess board with legal-move checks, check and checkmate detection, captured pieces and in-character opponent turns.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/chess`, then choose the opponent and your side. Installing or removing it needs a restart.

### Poker

Adds a Texas Hold'em table for two to eight players, with blinds, betting rounds, side pots, showdowns and in-character opponents.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/poker`, then choose players, starting chips and blinds. Installing or removing it needs a restart.

### 8-Ball Pool

Adds a one-on-one pool table with solids and stripes, aim and shot strength, fouls, ball-in-hand and in-character opponent shots.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/8ball`, then choose the opponent. Installing or removing it needs a restart.

### Tic-Tac-Toe

Adds a one-on-one Tic-Tac-Toe board with chosen or random marks, turn handling and win and draw detection.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/tictactoe` (alias `/ttt`), then choose the opponent and mark. Installing or removing it needs a restart.

### Rock-Paper-Scissors

Adds a one-on-one match where both choices stay hidden until the reveal.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/rps`, then choose the opponent and a best-of-three, five or seven match. Installing or removing it needs a restart.

## Related guides

- [Agents overview](agents-overview.md)
- [Illustrator agent](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Haptic Feedback setup](../integrations/haptic-feedback.md)
- [Knowledge sources](knowledge-sources.md)
- [Narrative Director and Secret Plot](../roleplay/narrative-director.md)
- [Conversation Audio and Video Calls](../conversation/calls.md)
- [Conversation table games](../conversation/table-games.md)
