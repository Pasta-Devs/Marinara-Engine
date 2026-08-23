# Downloadable Agents Reference

This guide lists all 36 official first-party packages available through **Agents → Download Agents**, grouped by category. Agents do not ship inside a fresh Marinara Engine installation. Their package sources, manifests, artifacts, and machine-readable catalog are published in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). For each one, this guide explains what the agent does, when it runs or integrates, which chat modes allow it, and the main settings. For installation and activation, read the [Agents overview](agents-overview.md) first.

## How to read this reference

An agent is a small AI helper that runs automatically alongside your main chat reply. Install it from the catalog first, then turn it on and set it up per chat, not per character card. See the [Agents overview](agents-overview.md) for downloading, updating, uninstalling, per-chat setup, and the cost warning.

Each agent below shows three quick facts.

- **Phase or integration**: when a normal pipeline agent runs. **Pre-Generation** runs before the reply and can add text to the prompt. **Parallel** runs at the same time as the reply and does not see the finished text. **Post-Processing** runs after the reply is complete and can read it (some can also rewrite it). Feature packages such as Maps, Calls, and Conversation games integrate directly into their chat surface instead.
- **Where it works**: the chat modes that let you add the agent. Most agents work in **Roleplay** chats. A few work in other modes, and each entry says which.
- **Key settings**: the settings you are most likely to change. You set these when you add the agent, or later in the agent's setup card in **Chat Settings**.

Marinara groups its agents into three categories in the **Agents** panel: **Writer Agents**, **Tracker Agents**, and **Misc Agents**. This reference uses the same grouping.

A run interval means the agent runs once every few user and assistant messages instead of after every message. You can change a run interval in the agent's setup, up to 100.

## Writer agents

Writer agents shape the story or the prose. They either add guidance before the reply or clean up the reply after it.

### Prose Guardian

Rewrites the latest reply to remove banned words and repetition, without changing the meaning. Use it to stop a model from repeating phrases or overusing a word.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Banned Words** (default is `ozone`), **Prefer In Writing**, and **Remove From Writing** text boxes. A **Hold Message Until Rewrite** toggle (on by default) hides the reply until the cleanup finishes. Without it, the raw reply shows first and is swapped afterward.

### Continuity Checker

Fixes concrete logic errors in the latest reply, such as a character being in two places at once or a broken timeline. When it finds problems, it shows them as a checklist so you can pick which fixes to apply.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Hold Message Until Rewrite** toggle.

### Card Evolution Auditor

Watches how a character changes during play and suggests edits to that character's card. It never edits automatically. Every suggestion opens the **Review Character Card Updates** modal for you to approve or reject.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: it runs once every 8 user and assistant messages by default. See [Agent approvals and the Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Creates a one-time nudge for the story only when you ask for it. When this agent is active in a Roleplay chat, a **Push Story** button appears above the message box. Click it to arm the next reply, which then advances the plot or introduces a surprise.

- **Phase**: Pre-Generation.
- **Where it works**: Roleplay only.
- **Key settings**: **Story Push Mode** (**Natural** to advance current threads, or **Random Event** to add a plausible surprise). It can also keep an optional hidden long-term arc called the **Secret Plot**. For the full walkthrough, see [Narrative Director and Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Scans the lorebooks you pick (and any files you upload) before the reply. It summarizes the parts that matter and adds that summary to the prompt. A lorebook is a collection of background facts about your world and characters. This is a lightweight search, so it needs no separate database.

- **Phase**: Pre-Generation.
- **Where it works**: Roleplay.
- **Key settings**: **Use chat-active lorebooks** toggle, a **Fixed Source Lorebooks** picker, and a file upload for supported formats. Do not run this agent and Knowledge Router together, since they overlap. For setup, see [Knowledge sources](knowledge-sources.md).

### Knowledge Router

A cheaper alternative to Knowledge Retrieval. Instead of summarizing, it reads short descriptions of your lorebook entries. It then adds the matching entries word for word. It works best when your entries have good descriptions.

- **Phase**: Pre-Generation.
- **Where it works**: Roleplay.
- **Key settings**: **Use chat-active lorebooks** toggle and a **Fixed Source Lorebooks** picker. A coverage badge shows what percentage of source entries have a written description. For setup, see [Knowledge sources](knowledge-sources.md).

## Tracker agents

Tracker agents keep a running record of the scene, the characters, and your stats. You can add their latest output to the prompt as a section, so the model stays consistent. World State, Quest Tracker, Character Tracker, Persona Stats, Custom Tracker, Inventory Tracker, and Beholder default to **Add as Prompt Section** on. Expression Engine and Background are the exceptions.

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

Picks the best matching background image for the current scene from your uploaded backgrounds. It does not generate images; use Illustrator when you want automatic scene background generation.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: standard Agent connection and context controls. Background selection uses only images already available in your background library.

### Character Tracker

Tracks the characters present, plus their mood, actions, appearance, outfit, thoughts, and per-character stats such as HP. It can also create portrait images for new characters that have none.

When a recurring character returns after leaving the scene, Character Tracker reuses their latest saved stats and custom fields for continuity. Characters backed by cards also receive their configured RPG pools and attributes as grounding, and always retain the card's avatar and crop. Automatically generated portraits remain limited to NPCs without a matching character card.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Add as Prompt Section** (on by default) and an optional **Auto-Generate NPC Avatars** setting with its own image connection picker.

### Beholder

Tracks each character's current clothing by body slot, held items, wounds, missing body parts, explicitly bare slots, and non-human species. Its latest validated snapshot appears inside Beholder's Roleplay Chat Settings drawer and is passed to both Beholder's next tracking call and the next main roleplay response.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay only.
- **Key settings**: add or remove it under **Chat Settings → Agents → Tracker Agents**; open **Configure Beholder** there to choose its connection, model, prompt, context, and output limits. **Add as Prompt Section** is on by default.
- **Model recommendation**: pick the prompt template that matches the model behind Beholder's connection. The two shipped templates are not interchangeable — each is written for a different kind of model.
  - **SOTA model — one prompt** (default): one call covering every tracked field. Use a strong general model such as OpenAI GPT-5.5+, Claude Opus 4.8+, or Kimi K3+.
  - **Beholder local model — five passes**: five narrow calls, one per tracked lane, for the purpose-trained [Beholder](https://huggingface.co/GetBeholder/Beholder-GGUF) extractor served locally (for example `Beholder-Q8_0.gguf` behind koboldcpp or llama.cpp). That model is trained to answer one lane at a time, so the single-prompt template is off-distribution for it and returns partial state. Engine unions the five per-lane results into one update. Runs fully offline at no cost.

  Beholder cannot detect which model sits behind a connection, so this stays a manual choice. A mismatch is not fatal but degrades extraction: a SOTA model handles either template, while the local model needs the five-pass one.
- **Origin**: adapted into Engine's native Agent runtime from [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), licensed AGPL-3.0-only. The official package does not load the legacy extension's DOM, polling, or local-storage runtime.

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

Tracks money, equipped gear, and carried items as three structured lists without reusing Persona Stats inventory or compressing the data into Custom Tracker strings. Duplicate names are merged, quantities of one stay visually compact, and locked rows survive later tracker runs unchanged.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Add as Prompt Section** (on by default). The HUD and Tracker Panel let you edit and lock every name and quantity.

### Memory Nag

Keeps a short editable memory vault for each Roleplay chat. It scans the transcript in checkpointed batches, sorts memories by current and past character participants, and moves clearly settled memories to a restorable Resolved list. A memory may preserve a short dialogue line word for word when its exact wording matters.

After each reply, deterministic word matching gives the tracker only the most relevant active memories for the involved characters. The tracker then decides whether the current situation actually calls for a nag and may choose only from those supplied memories; it cannot create a new memory during recall.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay only.
- **Key settings**: a separate **Vault scan connection** (default: the Agent connection), **Messages per batch** (20), **Maximum memories created per character** (10), **Maximum memories considered per character** (5), and **Maximum memories injected** (3). Use **Scan chat** for the initial backfill and **Open vault** to search, filter, add, edit, resolve, restore, or delete memories.
- **Prompt placement**: without a preset marker, selected nags enter the next reply inside `<context><memory_nags>…</memory_nags></context>`. Add a Memory Nag Agent section to place them explicitly.
- **Data lifecycle**: the vault belongs to one chat and remains stored if the package is disabled or uninstalled, so reinstalling can resume from the last checkpoint. Deleting a memory is permanent and always asks for confirmation.

### World Maps

Adds persistent nested locations and spatial relationships to a story. You can author regions, areas, rooms, and connections, move between locations, and let the current position contribute spatial context to generation. Game Mode also gains the package's world-map view.

- **Integration**: Feature package; it contributes map UI and chat runtime context instead of running as a normal generation-phase agent.
- **Where it works**: Roleplay and Game.
- **Key settings**: enable it for the Roleplay chat from **Chat Settings → Agents**, or select it during Game creation and manage it later from that game's settings. Installing or removing it requires a Marinara restart.
- **Full guide**: [World Maps: Setup, Authoring, and Travel](hierarchical-maps.md).

## Misc agents

Misc agents add extras such as images, music, audience reactions, and card updates.

### Echo Chamber

Simulates a live audience reacting to your scene, shown as a floating **Echo** widget in the chat area. It reveals one new reaction every 30 seconds.

- **Phase**: Parallel.
- **Where it works**: Roleplay.
- **Key settings**: you pick a style from its named options, such as **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad**, and **Harbingers**. Controls in the widget include **Re-run Echo Chamber** and **Clear messages**.

### Noodle

Adds an optional local social world with the Noodle public timeline and the NoodleR creator-and-fan roleplay feed. It opens in a dedicated Home tab instead of running in the normal chat-agent pipeline.

- **Integration**: Feature package; it contributes the Home tab, local routes, generation and media flows, and background schedulers.
- **Where it works**: Home, with optional context carried in from Conversation, Roleplay, and Game chats.
- **Key settings**: install it from **Agents → Download Agents** and restart Marinara Engine when prompted. Inside Noodle, you can configure invited accounts, text and image connections, timeline refreshes, NoodleR Creator profiles, simulated post access, and audience activity.
- **Data lifecycle**: uninstalling removes the Home tab and stops package routes and schedulers after restart while preserving existing Noodle and NoodleR data for a later reinstall.
- **Full guide**: [Noodle: The In-App Social Timeline](../noodle/overview.md).

### Long-Term Memory

Extracts durable memories from chat summaries, character records, and lorebooks into a package-owned vault, then recalls relevant context before the main reply. It supports scoped vault browsing, source imports, pending-draft review, and preset-marker placement for recalled context.

- **Integration**: Feature package; it contributes pre-generation context and memory management UI instead of running as a normal post-processing tracker.
- **Where it works**: Conversation, Roleplay, and Game.
- **Key settings**: enablement, recall token budget (128-16,384), maximum recalled chunks (1-100), score threshold, recent-message context (1-20), recall style and semantic, lexical, graph, and keyword weights, resolved-memory inclusion, recall preamble, extraction reasoning and verbosity, generation limits, source limits, prompt templates, AI keyword extraction, and Game-mode extraction.
- **Data lifecycle**: use the Memory Settings backup controls to export or replace the vault, drafts, and settings. Delete all data permanently removes memories, drafts, activity, and derived indexes while retaining settings. Uninstalling the package preserves the Long-Term Memory vault for a later reinstall. Installing, updating, or removing it requires a Marinara restart.
- **Compatibility**: Engine `2.3.5` through before `4.0.0`. The package uses `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage`, and `ui` permissions.

### Illustrator

Responsible for image and video generations. It writes visual prompts for important moments, then sends them to the configured media provider.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: it runs once every 5 user and assistant messages by default. Settings include **Prompt Model**, **Image Style**, **Attach Card Appearance**, and **Send Avatar References**. For the full setup, see [Illustrator agent](../media/illustrator-agent.md).

### Lorebook Keeper

Creates and updates lorebook entries from important facts in your chat, so your world notes grow as you play.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay. In Game Mode, a session-end variant called **Game Session Keeper** does the same job at the end of a session.
- **Key settings**: it runs once every 8 user and assistant messages by default. A **Target Lorebook** picker chooses where entries go, with an auto-select option. Advanced prompt configurations can return an exact writable lorebook name or a configured alias such as `world`, `npc`, `scene`, or `player`; missing alias destinations are created and linked to the current chat automatically. Omitting a destination keeps the existing single-lorebook behavior.

### Combat

Manages combat, including initiative, HP, and turn order. When it is active, an **Encounter** button appears above the message box.

- **Phase**: Parallel.
- **Where it works**: Roleplay.
- **Key settings**: it ships with a dice-roll tool for turn resolution.

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
- **Key settings**: **Edit** to rewrite the choices and **Re-roll** to generate new ones.

### Storyboard

Plans still or animated visual storyboards from completed Roleplay exchanges and Game narration. Separate planning and provider-aware formatting preserve source chronology, character identity, and the selected visual style across generated keyframes and videos.

- **Integration**: Agent package; Game and Roleplay use the installed package's prompt templates and settings through the Engine's Storyboard host integration.
- **Where it works**: Roleplay and Game.
- **Key settings**: choose still or animation planners, image and video connections, keyframe count, duration, display mode, character-reference handling, Roleplay episode and style templates, and Game illustration/video templates.
- **Compatibility**: Engine `2.3.5` through before `3.0.0`. The package uses `agent-runtime`, `chat-read`, `prompt-context`, `storage`, and `ui` permissions and does not require a restart.
- **Full guide**: [Storyboard Agent: Roleplay and Game Mode](../game/storyboard.md).

### Calls

Adds live audio and video calls with Conversation characters, including user-started and incoming calls, call-only transcripts, text-to-speech, microphone input, and character video clips.

- **Integration**: Conversation feature package; it adds toolbar, chat-surface, and Chat Settings controls instead of running as a normal generation-phase agent.
- **Where it works**: Conversation.
- **Key settings**: open **Chat Settings → Agents → Calls** to enable calls and choose speech, microphone, ringing, and video behavior. See [Conversation Audio and Video Calls](../conversation/calls.md). Installing or removing it requires a Marinara restart.

### UNO

Adds a rules-enforced UNO table for you and Conversation characters, with configurable house rules and support for two to ten total players.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/uno`; the setup chooses players and house rules. Installing or removing it requires a Marinara restart.

### Chess

Adds a one-on-one Chess board with legal move enforcement, check and checkmate detection, captured pieces, and in-character opponent turns.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/chess`, then choose the opponent and which side you play. Installing or removing it requires a Marinara restart.

### Poker

Adds a Texas Hold'em table for two to eight total players, with blinds, betting rounds, side pots, showdown evaluation, and in-character opponents.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/poker`, then choose the players, starting chips, and blind values. Installing or removing it requires a Marinara restart.

### 8-Ball Pool

Adds a one-on-one pool table with solids and stripes, aiming and shot strength, fouls, ball-in-hand, and in-character opponent shots.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/8ball`, then choose the opponent. Installing or removing it requires a Marinara restart.

### Tic-Tac-Toe

Adds a one-on-one Tic-Tac-Toe board with selectable or random marks, legal turn handling, and win and draw detection.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/tictactoe` (alias `/ttt`), then choose the opponent and mark. Installing or removing it requires a Marinara restart.

### Rock-Paper-Scissors

Adds a one-on-one Rock-Paper-Scissors match where both choices stay hidden until reveal.

- **Integration**: Conversation game package.
- **Where it works**: Conversation.
- **Key settings**: start it from the games picker or with `/rps`, then choose the opponent and a best-of-three, five, or seven match. Installing or removing it requires a Marinara restart.

## Related guides

- [Agents overview](agents-overview.md)
- [Illustrator agent](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Haptic Feedback setup](../integrations/haptic-feedback.md)
- [Knowledge sources](knowledge-sources.md)
- [Narrative Director and Secret Plot](../roleplay/narrative-director.md)
- [Conversation Audio and Video Calls](../conversation/calls.md)
- [Conversation table games](../conversation/table-games.md)
