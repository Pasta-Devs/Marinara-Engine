# Agents: AI Helpers for Your Chats

Agents are small AI helpers that run around your main chat reply. One tracks the time and weather, another picks a character expression, another draws an image for an important moment. This guide shows how to install agents, turn them on for a chat, and check that they ran.

## What agents are

Agents are turned on per chat, not per character. Two chats with the same character can run different agents.

A fresh install has no optional agents. Install them from **Agent Organizer**, the store for official one-click packages. The source and catalog are public in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Install through **Agent Organizer**, so Marinara can check compatibility, permissions and file hashes. For what each agent does, see [Downloadable Agents Reference](built-in-agents.md). To make your own, see [Creating Custom Agents](custom-agents.md).

## Add an agent to a chat

Before you start: install the agent first. Open the **Agents** panel (the Sparkles icon in the right-side tabs), click **Agent Organizer**, open the agent's page and click **Get**. See [Install and update agents](#install-and-update-agents).

1. Open the chat.
2. Open **Chat Settings** and find the **Agents** section.
3. Turn on **Enable Agents**. This is the master switch: when it is off, no agent runs in this chat.
4. Click **Add Agent**, open the group the agent belongs to (such as **Writer Agents** or **Misc Agents**) and choose it.

The agents you added appear as active, each with a small remove button. You can add or remove agents at any time.

> **Note:** Each chat mode shows only the agents that work in that mode. In Conversation, installed games appear in the games picker and **Calls** adds toolbar controls. In Game Mode, pick agents when you create the game or add them later.

If an agent did not run, check that **Enable Agents** is on, that the agent is active in this chat, and that its mode matches your chat.

### More controls in the Agents section

These controls are in the same **Agents** section.

- **Agent Menus** (Roleplay only): click an agent's name to jump to its settings.
- **Trackers Control** (Roleplay only): a closed card with the tracker options below.
- **Agent Suite**: opens a viewer where you read and edit what agents stored for this chat.
- **Review Agent Outputs**: makes lorebook, summary and character card changes wait for your approval. In Roleplay it is inside **Trackers Control**. See [Agent Approvals and the Agent Suite](approvals-and-agent-suite.md).

Options inside **Trackers Control**:

- **Attach chat summaries**: off by default. Adds saved chat summaries to agent requests, including retries. It does not remove summaries from the main reply or stop summary generation. Agents with full main-prompt access can still read summaries there.
- **Attach Lorebooks to Trackers**: tracker agents also get the lorebook entries used for the main reply. Shows once the chat has a tracker agent.
- **Individual tracker schedule**: stops a tracker from running after every reply. You run it by hand from the HUD (the on-screen status overlay in Roleplay).

### Give one agent a reference lorebook

1. In **Chat Settings**, open **Agents**, then open the agent's settings.
2. Turn on **Attach lorebook for the specific agent**. It starts off.
3. Choose a book in **Reference lorebook**.

The choice belongs to this agent in this chat. Matching entries follow the normal lorebook trigger rules and go to this agent, including manual retries. This setting does not add the book to the main reply or to unrelated agents, but agents running together may also see the same entries. Deleted or unavailable books supply nothing.

## When agents run

Each agent runs at one point around your reply, called its **pipeline phase**. Every built-in agent has a default. You can change it in the agent editor.

| Phase | When it runs | Examples |
| --- | --- | --- |
| **Pre-Generation** | Before the reply. It can add context to the prompt. | Knowledge lookup |
| **Parallel** | At the same time as the reply. It cannot change the reply. | Live audience reactions |
| **Post-Processing** | After the reply. It can read the reply, and rewrite agents can edit it. | Most trackers, prose cleanup, images |

## Tell whether an agent ran

- Tracker agents write into the HUD and tracker panels. If the time, location, mood or stats changed, a tracker ran.
- **Agent activity** in **Chat Settings** lists short notes from agents. Its icon spins while they work and shows a dot when one fails. See [Agent activity](../roleplay/getting-started.md#agent-activity).
- **Prose Guardian** and **Continuity Checker** change the reply text. A cleaned-up or corrected reply means they ran.
- For a full trace, turn on **Debug mode** in **Settings → Advanced → Message Tools**. It logs each agent's prompt and response to the server console, and agent debug entries also appear in the browser console. Cached prompt injections show in the **Injections** tab of **Agent activity**.

## Watch the cost

Each agent adds its own instructions and often its own model call. Marinara groups agents that share a connection into one call when it can.

A readout above the agent list estimates the extra tokens and calls per turn. Tap the help icon beside it for details. It turns amber with a warning icon when the load is heavy. The real cost is higher, because chat history and character details go with every call.

If you see the warning, remove agents you do not need or move some to a cheaper or local connection. A **Reasoning Effort** saved on a connection also applies to the agents that use it. See [Parameters for agents](../prompts/generation-parameters.md#parameters-for-agents).

## Install and update agents

Open the **Agents** panel (the Sparkles icon in the right-side tabs) and click **Agent Organizer**. It works on desktop and mobile.

- **Home** shows featured agents and a shelf for each section: **Apps**, **Chat games**, **Trackers** and **Writing help**.
- **Updates** lists installed agents with a newer version. **Installed** lists everything you have, with version and size.
- Search and the mode filter narrow every list.
- Select an agent to see its description, download size, permissions, compatibility and **Version history**. Click **Get** to install it. The **⋯** menu offers **Uninstall**.
- The **⋯** menu next to the title has **Update all**, **Install all**, **Refresh catalog** and **Uninstall all**.

Installed agents are grouped as **Apps**, **Writer Agents**, **Tracker Agents** and **Misc Agents**, plus **Custom Agents** for ones you make. **Apps** are packages with their own Home tab, such as Noodle and Slurp. You use them on their own instead of adding them to a chat.

A package marked **Rules** is not an agent. It adds a Game Mode ruleset, such as 5e (SRD 5.1), which you pick under **Rules** when you create a game. See [Playing with a Ruleset](../game/rulesets.md). The 5e package is in preview, so only an Engine on the `staging` branch lists it.

Uninstalling a package removes its code and settings but keeps your chat messages and history. Deleting a custom agent removes it for good.

### Update agents

When a newer compatible version of an installed package exists, an **Agent updates available** window opens. It lists each update with its version and whether it needs a restart.

1. Clear the box of any update you want to skip. Every update starts selected.
2. Read **What's new** if the package published notes. **More** shows a long note in full. A dot marks a change you will notice.
3. Click **Update all** (or **Update 2 of 3** when you cleared some). Each row shows **Updated** or **Failed**. A failed row shows the reason and **Retry**.
4. If an update needs a restart, click **Restart now**, or restart Marinara later.

Click **Not now** to keep your versions. Marinara does not ask again about a version you skipped. You can update from **Agent Organizer** at any time. Installed packages keep working at their current version, even when the catalog cannot be reached. **See in Agent Organizer** opens the agent's page.

Updates apply only to packages you installed. Packages live on the Marinara server, so browser clients use what the server has installed.

When you upgrade from an Engine version that bundled these features, Marinara downloads the matching packages once and keeps your chat selections, settings and history. If it cannot reach the catalog, it retries at the next startup.

## Related guides

- [Downloadable Agents Reference](built-in-agents.md)
- [2D and 3D Avatars](avatars.md)
- [Creating Custom Agents](custom-agents.md)
- [Agent Approvals and the Agent Suite](approvals-and-agent-suite.md)
- [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md)
