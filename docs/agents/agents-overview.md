# Agents: AI Helpers for Your Chats

This guide explains what agents are in Marinara Engine, how to download them, when they run, and how to turn them on for a chat. It covers the **Agents** panel, the official catalog, per-chat settings, and how to tell when an agent has run. For the full first-party catalog, see the Related guides at the end.

## What agents are

Agents are small AI helpers that run automatically around your main chat reply. They do focused jobs while you talk to a character. For example, an agent can track the time and weather or pick a character expression. Another agent can rewrite the reply to remove repeated words. Others can generate an image for an important moment.

Agents are turned on per chat, not per character. There is no agent toggle on a character card. Two chats with the same character can run completely different agents. You choose which agents run in each chat's settings.

Fresh Marinara Engine installations start without optional agents. This keeps the base app and Termux installation smaller. The official v2.3.0+ catalog contains 29 one-click packages: 6 Writer Agents, 8 Tracker Agents, and 15 Misc Agents, including Maps, Calls, and all six Conversation games. Their source, manifests, downloadable artifacts, and repository-level catalog are public in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). For the complete per-agent guide, see [Downloadable Agents Reference](built-in-agents.md). To make your own, see [Creating Custom Agents](custom-agents.md).

## The three phases

Every agent runs at one of three points around your reply. This point is called the agent's **pipeline phase**. You set it in the agent editor, and each built-in agent already has a sensible default.

- **Pre-Generation**: runs before the AI writes its reply. It can add helpful context to the prompt first. Knowledge lookup agents run here.
- **Parallel**: runs at the same time as the reply. It does not wait for the reply and cannot change it. A live audience reaction agent runs here.
- **Post-Processing**: runs after the reply is finished. It can read the reply and, for rewrite agents, edit it. Most trackers, the prose cleanup agent, and the image agent run here.

## The Agents panel

Open the **Agents** panel from the right-side panel tabs (the Sparkles icon). Here you browse, create, and organize agents. This is your library. It is not the on or off switch for a single chat.

Click **Download Agents** at the top to open the full-screen official catalog. It works on desktop and mobile. Select an item to read its description, supported feature type, download size, permissions, version compatibility, and documentation. Click **Install** to add it; the same screen offers immediate manual updates and **Uninstall** for packages you already have. Marinara also checks every installed official package at server startup and upgrades it to the newest compatible catalog version before its runtime activates. Packages continue working at their current version when the host server is offline or an update cannot be verified.

The in-app catalog is backed by the public [Marinara-Agents repository](https://github.com/Pasta-Devs/Marinara-Agents). You can inspect every package and artifact there, but normal users should install through **Download Agents** so Marinara can validate compatibility, permissions, hashes, archive contents, and restart requirements.

The catalog includes first-party chat agents, Hierarchical Maps, Conversation audio/video calls, and every optional Conversation game. Installed agents are grouped into **Writer Agents**, **Tracker Agents**, and **Misc Agents**, plus a **Custom Agents** section for ones you make. Uninstalling a catalog package removes its code and settings from the Engine while preserving chat messages and history. Deleting a custom agent removes it for good.

When upgrading from an Engine version that bundled these features, Marinara downloads the matching packages once and preserves existing chat selections, agent settings, stored runtime data, and history. If that migration cannot reach the catalog, it retries at the next startup instead of discarding anything.

Automatic startup updates never install an unselected package. Desktop, Docker, and Android/Termux installations update the packages stored by their local server. iOS, iPadOS, and other browser clients use the packages installed and updated by the Marinara server they connect to.

## Enabling agents for a chat

You turn agents on inside each chat, in the **Chat Settings** drawer.

1. Open the chat you want.
2. Open **Chat Settings** (the gear).
3. Find the **Agents** section.
4. Turn on **Enable Agents**. This is the master switch. When it is off, no agent runs for this chat.
5. Add the agents you want from the lists below the switch, or remove ones you do not want.

You should see the agents you added listed as active, each with a small remove button.

The **Agents** section has a few more controls:

- **Review Agent Outputs**: when on, lorebook, summary, and character card changes wait for your approval before they save. When off, lorebook and summary changes can save on their own, but character card edits still ask you first. See [Agent Approvals and the Agent Suite](approvals-and-agent-suite.md).
- **Manual Trackers** (Roleplay chats only): when on, tracker agents do not run after every reply. You trigger them by hand from a button in the HUD. HUD means heads-up display, the on-screen status overlay in Roleplay.
- **Agent Suite**: opens a viewer where you can read and edit everything the agents have stored for this chat.

### The cost warning

Agents cost extra tokens and extra model calls. Each agent adds its own instructions, and often its own model call. Marinara groups agents that share the same connection into one call when it can. Above the agent list, a readout estimates the load for your current setup. It shows about how many tokens of agent instructions you added and about how many extra calls happen per turn.

This readout turns amber with a warning icon when the load gets heavy. The real cost per turn is higher than the number shown. Your chat history and character details are sent with each call. If you see the warning, remove agents you do not need, or move some to a cheaper or local connection.

## Which agents each mode starts with

A fresh installation starts with no optional agents installed or active. Each chat mode shows only compatible packages you have installed.

- **Roleplay**: install Roleplay agents from the catalog, then add them in Chat Settings. Hierarchical Maps appears there like any other supported agent.
- **Conversation**: install Conversation Calls or individual table games from the catalog. Games appear in the games picker and register their slash commands; calls add their toolbar and Chat Settings controls.
- **Game Mode**: installed Game-compatible agents can be selected during game creation or added later. Hierarchical Maps contributes its map workspace and world-map view only when it is active for that game.

You can add or remove compatible agents at any time.

## Telling whether an agent ran

Some agents change something you can see right away. Others work quietly. Here is how to check.

- Tracker agents write into the HUD and the tracker panels. If the time, location, mood, or stats updated, a tracker agent ran.
- A floating status overlay shows short thinking messages from agents while they work, so you can watch them run in real time.
- The **Prose Guardian** and **Continuity Checker** agents change the reply text itself. A cleaned-up or corrected reply is a sign they ran.
- For a full trace, turn on **Debug mode** in **Settings**, then **Advanced**, then **Message Tools**. It logs the prompt and response for each agent to the server console. It also shows an **Agent Debug** overlay with per-agent calls, tokens, and timing.

Did an agent you expected not run? Check that **Enable Agents** is on. Check that the agent is active for this chat. Check that your chat mode allows it.

## Related guides

- [Downloadable Agents Reference](built-in-agents.md)
- [Official Marinara Agents repository](https://github.com/Pasta-Devs/Marinara-Agents)
- [Creating Custom Agents](custom-agents.md)
- [Agent Approvals and the Agent Suite](approvals-and-agent-suite.md)
- [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md)
