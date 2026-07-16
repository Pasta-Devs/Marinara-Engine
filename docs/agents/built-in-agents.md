# Downloadable Agents Reference

This guide lists all 29 official first-party packages available through **Agents → Download Agents**, grouped by category. Agents do not ship inside a fresh Marinara Engine installation. Their package sources, manifests, artifacts, and machine-readable catalog are published in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). For each one, this guide explains what the agent does, when it runs or integrates, which chat modes allow it, and the main settings. For installation and activation, read the [Agents overview](agents-overview.md) first.

## How to read this reference

An agent is a small AI helper that runs automatically alongside your main chat reply. Install it from the catalog first, then turn it on and set it up per chat, not per character card. See the [Agents overview](agents-overview.md) for downloading, updating, uninstalling, per-chat setup, and the cost warning.

Each agent below shows three quick facts.

- **Phase or integration**: when a normal pipeline agent runs. **Pre-Generation** runs before the reply and can add text to the prompt. **Parallel** runs at the same time as the reply and does not see the finished text. **Post-Processing** runs after the reply is complete and can read it (some can also rewrite it). Feature packages such as Maps, Calls, and Conversation games integrate directly into their chat surface instead.
- **Where it works**: the chat modes that let you add the agent. Most agents work in **Roleplay** chats. A few work in other modes, and each entry says which.
- **Key settings**: the settings you are most likely to change. You set these when you add the agent, or later in the agent's setup card in **Chat Settings**.

Marinara groups its agents into three categories in the **Agents** panel: **Writer Agents**, **Tracker Agents**, and **Misc Agents**. This reference uses the same grouping.

A run interval means the agent runs once every few assistant messages instead of after every message. You can change a run interval in the agent's setup, up to 100.

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
- **Key settings**: it runs once every 8 assistant messages by default. See [Agent approvals and the Agent Suite](approvals-and-agent-suite.md).

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

Tracker agents keep a running record of the scene, the characters, and your stats. You can add their latest output to the prompt as a section, so the model stays consistent. Five of the trackers below default to **Add as Prompt Section** on: World State, Quest Tracker, Character Tracker, Persona Stats, and Custom Tracker. Expression Engine and Background are the exceptions.

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

Picks the best matching background image for the current scene from your uploaded backgrounds. It can also generate a new background when nothing fits, if you turn that on.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: a **Background Image Generation** toggle. Generated backgrounds are saved into your normal background library for reuse.

### Character Tracker

Tracks the characters present, plus their mood, actions, appearance, outfit, thoughts, and per-character stats such as HP. It can also create portrait images for new characters that have none.

When a recurring character returns after leaving the scene, Character Tracker reuses their latest saved stats and custom fields for continuity. Characters backed by cards also receive their configured RPG pools and attributes as grounding, and always retain the card's avatar and crop. Automatically generated portraits remain limited to NPCs without a matching character card.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Add as Prompt Section** (on by default) and an optional **Auto-Generate NPC Avatars** setting with its own image connection picker.

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

### Hierarchical Maps

Adds persistent nested locations and spatial relationships to a story. You can author regions, areas, rooms, and connections, move between locations, and let the current position contribute spatial context to generation. Game Mode also gains the package's world-map view.

- **Integration**: Feature package; it contributes map UI and chat runtime context instead of running as a normal generation-phase agent.
- **Where it works**: Roleplay and Game.
- **Key settings**: enable it for the Roleplay chat from **Chat Settings → Agents**, or select it during Game creation and manage it later from that game's settings. Installing or removing it requires a Marinara restart.

## Misc agents

Misc agents add extras such as images, music, audience reactions, and card updates.

### Echo Chamber

Simulates a live audience reacting to your scene, shown as a floating **Echo** widget in the chat area. It reveals one new reaction every 30 seconds.

- **Phase**: Parallel.
- **Where it works**: Roleplay.
- **Key settings**: you pick a style from its named options, such as **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad**, and **Harbingers**. Controls in the widget include **Re-run Echo Chamber** and **Clear messages**.

### Illustrator

Responsible for image and video generations. It writes visual prompts for important moments, then sends them to the configured media provider.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: it runs once every 5 assistant messages by default. Settings include **Prompt Model**, **Image Style**, **Attach Card Appearance**, and **Send Avatar References**. For the full setup, see [Illustrator agent](../media/illustrator-agent.md).

### Lorebook Keeper

Creates and updates lorebook entries from important facts in your chat, so your world notes grow as you play.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay. In Game Mode, a session-end variant called **Game Session Keeper** does the same job at the end of a session.
- **Key settings**: it runs once every 8 assistant messages by default. A **Target Lorebook** picker chooses where entries go, with an auto-select option.

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
- **Where it works**: Roleplay.
- **Key settings**: a **Touch Sensitivity** choice (**Subtle**, **Standard**, or **Intense**) and an **Intiface URL** field. For the full setup, see [Haptic Feedback setup](../integrations/haptic-feedback.md).

### CYOA Choices

Adds clickable "What will you do?" choice buttons after each reply, for a choose-your-own-adventure feel. Each button holds a full action you can send with one click.

- **Phase**: Post-Processing.
- **Where it works**: Roleplay.
- **Key settings**: **Edit** to rewrite the choices and **Re-roll** to generate new ones.

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
