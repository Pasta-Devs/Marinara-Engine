# Creating Custom Agents

This guide shows you how to build your own agent in Marinara Engine. An agent is a small AI helper that runs automatically alongside your chat. You will learn how to set its phase, powers, output type, activation keywords and questions, tools, and prompt, with one full worked example.

New to agents? Read [Agents: AI Helpers for Your Chats](agents-overview.md) first for the basics, then come back here.

## When to build a custom agent

Marinara Engine offers many official downloadable agents. See the [Downloadable Agents Reference](built-in-agents.md) and the public [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) package repository before you build your own. A catalog agent may already do what you want, and the official manifests provide working package examples.

Build a custom agent when you need something the built-ins do not cover. Good reasons include:

- You want a helper with your own instructions and voice.
- You want to inject a specific note into every prompt.
- You want to rewrite each reply in a certain style.
- You want an agent to call your own custom tool.

If an installed first-party agent is close, copy it instead. In the **Agents** panel, hover its card and click **Copy agent**. This makes an editable custom copy.

## Before you start

Two facts matter before you build:

1. Agents are set per chat, not per character. Building an agent in the library does not run it. You must add it to a chat and turn on **Enable Agents** in **Chat Settings**.
2. Custom agents work in every chat mode: Roleplay, Game Mode, and Conversation. Official packages appear only in their supported modes, while your own custom agents remain available everywhere.

## Creating a custom agent

Follow these steps to create a new custom agent from scratch.

1. Open the **Agents** panel.
2. Click the **New** button (the plus icon) near the top.
3. The full-page agent editor opens with a blank custom agent.
4. Type a name in the title field at the top, for example `Weather Reporter`.
5. Fill in the **Description** and **Author** fields so you remember what it does.
6. Choose a **Pipeline Phase** (see below).
7. Turn on the powers you need under **Custom Agent Abilities**.
8. Pick a **Result Type** that matches what the agent should produce.
9. Write the agent instructions under **Prompt Template**.
10. Click **Save** in the top bar. You should see a green **Saved** badge.

Your new agent now appears in the **Custom Agents** section of the **Agents** panel. To use it, open a chat, go to **Chat Settings**, turn on **Enable Agents**, and add your agent from the **Custom Agents** section there.

## Pipeline Phase

The **Pipeline Phase** sets when your agent runs. Pick one of three buttons:

- **Pre-Generation**: runs before the AI replies. It can add context or change the prompt.
- **Parallel**: runs at the same time as the reply. It cannot see the finished reply.
- **Post-Processing**: runs after the reply is complete. It can read and, for some result types, edit the reply.

Some result types force a phase. If you pick **Text Rewrite**, the phase switches to **Post-Processing**. If you pick **Prompt Patch**, the phase switches to **Pre-Generation**. This happens because those jobs only make sense in that phase.

Post-Processing custom agents also get a **Turn Data Access** section. It has two optional toggles: **Pre-generation injections** and **Parallel agent results**. Turn these on to let your agent read what other agents produced during the same turn. Leave them off to keep your agent isolated.

## Custom Agent Abilities

**Custom Agent Abilities** are opt-in powers. A power stays blocked until you turn its toggle on. This keeps a custom agent safe by default. The available abilities are:

| Ability | What it lets the agent do |
|---|---|
| **Create lorebooks** | Create a new agent-made lorebook when its lore output has no target. |
| **Edit lorebooks** | Write lorebook entries or make lorebook update results. |
| **Edit messages** | Replace the generated message text with rewritten text, or add continuation choices to it. |
| **Edit trackers** | Update game, character, persona, or custom tracker state. |
| **Frontend styling** | Apply a temporary visual style effect during generation. |
| **Change chat backgrounds** | Change and persist the background selected for a chat. |
| **Change character sprites** | Change character and Persona expressions shown in chat. |
| **Control media playback** | Control Spotify, YouTube, or local music playback. |
| **Control haptic devices** | Send bounded commands to a connected haptic device. |
| **Edit About Me details** | Change chat-specific About Me text. Public card changes still require separate approval. |
| **Image generation** | Trigger the image generator with an image prompt. |
| **Vectors/embeddings** | Use vector or embedding context. Vectors are a way to search text by meaning. |
| **Main prompt edits** | Edit the prompt sent to the main AI model. |

A lorebook is a set of background notes the AI can pull into a scene. A tracker is a live panel that stores facts like stats, mood, or location.

If you turn on **Edit lorebooks**, a **Lorebook Writer** section appears. Turn on **Allow lorebook entry writes** and pick one lorebook in the **Target lorebook** dropdown. The agent can only write to that one lorebook.

## Result Type

The **Result Type** tells Marinara how to read your agent's output. Most result types expect the agent to return JSON. JSON is a simple text format written with braces and quotation marks. Each result type needs the matching ability from the table above.

| Result Type | What it does | Ability needed |
|---|---|---|
| **Context Injection** | Adds text before generation, or records a note after generation. | None |
| **Text Rewrite** | Runs after the reply and replaces the message text. | Edit messages |
| **Lorebook Update** | Creates or updates lorebook entries. | Edit lorebooks |
| **Character Tracker** | Updates the character tracker (present characters). | Edit trackers |
| **Persona Stats** | Updates persona stats, status, and inventory. | Edit trackers |
| **Custom Tracker** | Replaces your own custom tracker fields. | Edit trackers |
| **Game State** | Updates world-state style game data. | Edit trackers |
| **Image Prompt** | Asks the image generator to draw a scene. | Image generation |
| **Prompt Patch** | Adds, prepends, or replaces prompt sections. | Main prompt edits |
| **Frontend Style** | Applies a temporary styling effect. | Frontend styling |
| **Background Change** | Selects and persists an available chat background. | Change chat backgrounds |
| **Sprite Change** | Changes character and Persona expressions shown in chat. | Change character sprites |
| **Spotify Control** | Controls Spotify playback. | Control media playback |
| **YouTube Control** | Controls YouTube playback. | Control media playback |
| **Local Music Control** | Controls playback from your local music collection. | Control media playback |
| **Haptic Command** | Sends a bounded command to a connected haptic device. | Control haptic devices |
| **About Me Update** | Updates chat-specific About Me text and proposes public edits. | Edit About Me details |
| **Interactive Choices** | Adds continuation choices to the generated message. | Edit messages |

**Context Injection** is the friendliest starting point. It needs no ability toggle and no strict output format. Use it when you just want the agent to add a short note to the prompt or record a summary.

If a result type is greyed out, you have not turned on its ability yet. Turn on the matching toggle under **Custom Agent Abilities**, then the result type becomes clickable.

### Per-chat controls for image agents

An agent with the **Image generation** ability gets two extra controls on its card in **Chat Settings → Agents → Custom Agents**, alongside the prompt template picker every custom agent has:

- **Image Connection** — overrides which image connection this agent uses in this chat only. Leave it on **Agent default** to keep the connection from the agent's own settings. The chat-level **Image Style** select applies to custom-agent images too, so one agent can render differently per chat without duplicating it.
- **Camera button** — generates an image with that agent right now, without waiting for its activation keywords. The agent still writes the prompt itself; if its template declines to produce one, you get an error toast instead of an image.

## Activation Keywords

By default a custom agent runs on its normal cadence. **Activation Keywords** let you skip the agent unless the scene is relevant. This saves tokens and cost. A token is a small chunk of text that the AI counts.

To set this up:

1. In the **Activation Keywords** section, type one keyword or phrase per line. For example:

```
tavern
secret door
moonlit ritual
```

2. Set **Scan Depth** to the number of recent messages to search. The default is 5. The maximum is 200.
3. The agent now runs only when at least one keyword appears in that many recent messages.

Leave the keyword box empty to disable the keyword filter. Cadence and any activation question still apply.

## Activation questions

An **Activation question** asks whether the recent scene needs your custom agent, for example `In the latest message, the characters move to a different location.` It can recognize paraphrases that keywords miss. Leave it empty to keep the existing behavior.

A **Decision model** answers it. Pick one under **Decision model** in the Connections panel: the local model you already run, a hosted Decision connection, or a decision model Marinara installs for you. [Decision Models](../connections/decision-models.md) explains each one, which to pick, and how to set it up. With **Decision model** set to **None**, the default, the question fields in the agent editor stay disabled, and an agent with a question runs as if it had none.

### Set up your agent

With a Decision model selected, open a custom agent and enter a **Question** of up to 500 characters. Standard agent macros, including `{{user}}` and `{{char}}`, work in the question. **Scan Depth** controls the recent messages used by both keywords and the question.

Despite the field's name, write it as a statement of fact about the latest message, not as a question. In our tests a small decision model answered `Did the scene change?` less reliably than `The latest message moves the scene to a new place.` The same advice applies here as to decision statements in prompts; see [Writing statements](../prompts/conditional-prompts.md#writing-statements).

- **Run when probability is at least** starts from whatever the selected decision model answers around, because probabilities are not comparable between models: a general local model answers a clear yes at 0.99, while a purpose-built decision model answers the same turn at 0.2. The agent runs when the probability of “yes” meets or exceeds the threshold, and higher values skip more runs. The editor offers to restore the recommended value whenever yours differs from it. See [Thresholds](../connections/decision-models.md#thresholds).
- **Bypass the question after this many messages without a successful run** is optional. Once this many user/assistant messages have passed since the agent last ran successfully, the question is bypassed. A new agent, or one whose previous message was deleted, also bypasses the question when this setting is enabled. Keywords and cadence must still allow the run. Consider setting it for an agent that matters: any model sometimes answers wrongly, and this stops one that keeps answering "no" from silencing the agent for good.
- Pre-generation and parallel agents use the conversation before the reply. Post-processing agents also see the completed reply.

Keywords and cadence are checked first, so an already-skipped agent does not make a paid decision request. Questions sharing a scan depth are batched for each phase. A timeout, unavailable model, or invalid answer lets the affected agent run normally. The budget is 1.5 seconds for a Decision connection and 4 seconds for a local model, or 20 seconds when that model has to think first. Decision requests follow generation cancellation. Ordinary logs omit chat content; debug prompt logging includes the evaluated messages and questions.

This setting applies to custom agents. Built-in agent activation and character-activity evaluation keep their existing behavior.

### Decision statements in the agent's prompt

An activation question decides whether the agent runs. A decision statement in the agent's **Prompt Template** decides what a running agent is told. Both use the same Decision model, and the syntax is the one in [Conditional Prompts](../prompts/conditional-prompts.md#asking-the-decision-model):

```
{{#if decision:"In the latest message, the characters move to a different location"}}
Update the location field.
{{else}}
Leave the location as it is.
{{/if}}
```

Together, an agent can skip quiet turns entirely and send a smaller prompt on the turns it does run. Some ideas:

- A tracker includes its "update the location" instructions only when the location changed, instead of re-deriving it every turn.
- An image agent describes a new picture only when the scene looks different.
- A music agent is told to change tracks only when the mood shifted.
- A choice picks one of several instruction sets: `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`, `{{else if decision_choice:"The kind of scene in the latest message" == "dialogue"}}`, and so on.

How it runs:

- Pre-generation and parallel agents read the chat before the reply, the same turn the main prompt reads, and share its answers. Post-processing agents read the finished reply as the latest message, and their statements are asked again with it.
- Re-running an agent, for example with a tracker's refresh button, by retrying a failed agent, or with **Re-run** on an injection, reuses the answers its turn already has and asks only what that turn never asked.
- In an agent prompt, `{{char}}` names every character in the chat at once, so in a group `{{char}} is angry` becomes "Kaelen, Alyssa is angry". Name the character, or write "a character".
- With no answer, a statement reads as no. The agent must still do something sensible with its `{{else}}` branch, because many users will not have a Decision model.

Agents installed from Marinara-Agents render their prompt templates the same way, so they can use decision statements too.

## Attaching tools (Function Calling)

Your agent can call tools. A tool is a function the AI can run to fetch or change something, then read the result back. This is also called function calling.

To attach tools, open the **Tools / Function Calling** section and toggle each tool on or off. The list includes built-in tools and any custom tools you have made. To learn how to build your own, read [Custom Tools](../extending/custom-tools.md).

Tools only work if the chat itself allows them. In **Chat Settings**, open the **Function Calling** section and turn on **Enable Tool Use**. Without that chat setting, the agent's tools stay off even when you toggle them here.

Imported agent files do not grant tool access. After importing an agent, inspect its prompt and settings, then select any tools you want it to use yourself.

## Named prompt options

A single agent can hold several prompt variants. This is the **Named prompt options** feature. A chat can then pick one variant without you editing the agent globally.

To add a variant:

1. Under **Prompt Template**, find **Named prompt options**.
2. Click **Add option**.
3. Give the option a name and a short description.
4. Write the full prompt body for that option.

When someone adds your agent to a chat, they see a **Prompt Mode** dropdown listing your named options. If you add none, the chat menu shows only the default prompt.

## Other settings you can adjust

Custom agents share some settings with built-in agents:

- **Connection Override**: pick a different AI connection for this agent. For example, use a cheaper model for background work. Leave it empty to use the chat's connection.
- **Agent Budget**: set **Context Size** (how many recent messages the agent reads, default 5). Also set **Max Output Tokens** (the output room reserved, default 4096, from 128 to 32768).
- **Add as Prompt Section**: turn this on to expose the agent's latest output as a section you can inject in a prompt preset.

Macros like `{{user}}` and `{{char}}` work inside the **Prompt Template**. See [Macros](../prompts/macros.md) for the full list.

## A worked example

Here is a complete custom agent that rewrites every reply into British English.

Setup in the editor:

1. Name it `British English Editor`.
2. Under **Custom Agent Abilities**, turn on **Edit messages**.
3. Under **Result Type**, pick **Text Rewrite**. The phase switches to **Post-Processing** on its own.
4. Paste this into the **Prompt Template**:

```
You are a copy editor. Rewrite the latest reply into British English.
Change spelling and vocabulary only. Do not change the meaning, tone, or events.
Return JSON with an "editedText" field holding the full rewritten reply,
and a "changes" array of short notes describing what you changed.
```

5. Click **Save**.
6. Open a Roleplay chat, go to **Chat Settings**, turn on **Enable Agents**, and add `British English Editor` from the **Custom Agents** section.

The agent returns JSON like this after each reply:

```
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara reads `editedText` and swaps it into the reply. You see the message in British English. The `changes` notes appear as a short summary of what the agent adjusted.

## Importing and exporting agents

You can share a custom agent as a file.

To export from the editor, click the **Export agent** button (the upload icon) in the top bar. This saves the agent's prompt and configuration as a package. Agent packages never include custom-tool definitions.

To export several agents at once, use **Select agents** in the **Agents** panel, pick the agents you want, and export the group.

External Agent imports are locked by default. Open **Settings → Advanced → Danger Zone** and enable **Allow custom Agent imports** first. This toggle does not need an `.env` change. It affects only Agents supplied through files, folders, or custom repositories: Agents you create in Marinara and official Agents installed through **Download Agents** remain available normally.

To import, open the **Agents** panel and click **Import agents** for a single file, or **Import agent folder** to pick a whole folder. Marinara shows a permission review before anything is stored. Approve only the capabilities the Agent needs; unchecked capabilities stay blocked. Each file import receives a new custom identity, so it cannot replace a curated Agent with the same internal type.

For safety, Marinara ignores bundled functions, clears tool selections from imported settings, sanitizes temporary CSS before applying it, and checks approved capabilities before an imported Agent can change messages, trackers, lorebooks, backgrounds, sprites, media, haptics, About Me data, prompts, or generated images. Import trusted functions separately from **Function Calls**, review them, and explicitly attach them to the Agent afterward. Turning the Danger Zone toggle off again prevents externally imported Agents from running; locally authored and official Agents are not affected.

## Related guides

- [Agents: AI Helpers for Your Chats](agents-overview.md)
- [Decision Models](../connections/decision-models.md)
- [Downloadable Agents Reference](built-in-agents.md)
- [Custom Tools](../extending/custom-tools.md)
- [Macros](../prompts/macros.md)
