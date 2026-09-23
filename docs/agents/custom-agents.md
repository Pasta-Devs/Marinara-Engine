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

An **Activation question** asks whether the recent scene needs your custom agent. For example: `Did the characters move to a different location?` This can recognize paraphrases that keywords miss. Leave the question empty to keep the existing behavior.

Something has to answer that question. Pick it once, under **Decision model** in the Connections panel. The list has three groups:

- **None**, the default. No questions are asked and the question fields in the agent editor stay disabled.
- **Local models**: the model you already run on the main or utility local slot. Nothing is downloaded and nothing leaves your machine.
- **Connections**: any Decision connection you created, hosted or self-run.

Entries that cannot answer right now stay in the list, greyed out with the reason, so you can see what to fix.

### Use a model you already run

If you have a local model in **Local Model**, you can gate agents with it and never create a connection or pay for a request.

1. In **Connections**, open **Connection defaults** and set **Decision model** to **Primary local model**, or to **Utility local model** if you have one set up.
2. Click **Test**. A successful result shows the probability and request time, plus two things that are specific to a local model: whether log-probabilities were available, and whether the model answers directly.

Marinara asks the model a single yes/no question, lets it produce one token, and reads the answer from that token's probabilities. No reply is written, so the request is short. Requests use a 4-second budget, longer than a hosted one, because your slot may already be busy with agent work.

**Thinking.** Most models answer in one word. Some always reason first, whatever they are asked. The **Thinking** setting below the dropdown controls this:

- **Auto** (default) tries the fast one-word method and, if the model cannot answer that way twice in a row, lets that model think first and tells you.
- **Off** always uses the one-word method. A model that cannot answer that way leaves its agents running.
- **Allowed** never asks the model to skip reasoning.

A model that thinks first takes seconds, so it only gates **post-processing** agents by default. Those run after the reply is already on screen. Pre-generation and parallel agents run as if they had no question, unless you turn on **Also gate agents that run before the reply**, which makes every reply wait.

**About the numbers.** A general chat model's yes/no probabilities are usable for a threshold, but they were never trained to be calibrated the way a purpose-built decision model's are, and a runtime that returns no log-probabilities answers a flat 1 or 0. Tune the threshold against your own chats rather than trusting the default.

### Set up a Decision connection

1. In **Connections**, create a connection with provider **Decision**.
2. Choose **TypeSafe**, **OpenRouter**, or **Custom System One endpoint**. Hosted sources need an API key. Custom accepts a System One server you already run, including Open-Jev; enter its base URL without `/v1/systemone` and use the model name it supports.
3. For OpenRouter, choose a saved OpenRouter connection under **API key source**, or enter a separate key. Its editor also offers **Use this key for decisions (Jev)**. Linked keys follow later key changes automatically. Custom connections may borrow a custom chat connection's key only when both URLs have the same origin (scheme, host, and port).
4. Save, then select it under **Decision model** in the Connections panel and click **Test**. The test sends a fixed sample, not your chat. A successful result shows the probability and request time.

The Decision default is separate from your chat, agent, image, video, and audio defaults. Choosing **None** disables activation questions without deleting them.

Hosted decisions send the selected recent messages and question to the chosen provider and can incur charges. The state budget defaults to 30,000 estimated tokens for hosted sources and 3,500 for custom servers. Reduce it if your server has a smaller context limit. Marinara drops older messages first, then trims the oldest portion of the newest message. Token estimates can differ from a server's tokenizer; a rejected or over-budget request lets the agent run normally.

Deleting a connection used for a linked key warns you and leaves the Decision connection needing relinking. Imported standalone connection files also need keys or links restored; they never contain API keys or borrowed connection IDs.

### Set up your agent

With a Decision default selected, open a custom agent and enter a **Question** of up to 500 characters. Standard agent macros, including `{{user}}` and `{{char}}`, work in the question. **Scan Depth** controls the recent messages used by both keywords and the question.

- **Run when probability is at least** starts from whatever the selected decision model answers around, because probabilities are not comparable between models: a general local model answers a clear yes at 0.99, while a purpose-built decision model answers the same turn at 0.2. The agent runs when the probability of “yes” meets or exceeds the threshold, and higher values skip more runs. The editor offers to restore the recommended value whenever yours differs from it.
- **Bypass the question after this many messages without a successful run** is optional. Once this many user/assistant messages have passed since the agent last ran successfully, the question is bypassed. A new agent, or one whose previous message was deleted, also bypasses the question when this setting is enabled. Keywords and cadence must still allow the run.
- Pre-generation and parallel agents use the conversation before the reply. Post-processing agents also see the completed reply.

Keywords and cadence are checked first, so an already-skipped agent does not make a paid decision request. Questions sharing a scan depth are batched for each phase. A timeout, unavailable model, or invalid answer lets the affected agent run normally. The budget is 1.5 seconds for a Decision connection and 4 seconds for a local model, or 20 seconds when that model has to think first. Decision requests follow generation cancellation. Ordinary logs omit chat content; debug prompt logging includes the evaluated messages and questions.

A local model derives its state budget from the slot's own context size rather than from a connection setting.

This setting applies to custom agents. Built-in agent activation and character-activity evaluation keep their existing behavior.

### Let Marinara install a decision model

Marinara can also download and run a purpose-built decision model for you. It runs as its own local process, so it answers activation questions whether or not you also run a local chat model. It costs about 10 GB of disk and around 5 GB of GPU memory, on top of any local chat model you run. If you already have one, you probably do not need this: on our measurements that model is **more accurate on roleplay** than the decision model. The decision model is faster, and a little smaller.

It needs Linux with an NVIDIA GPU of compute capability 7.5 or newer (Turing, the RTX 20 series, or later) and driver 580 or newer. Pascal cards and older cannot run it whatever memory they have, because the runtime's kernels do not cover them. Where it cannot run, the option stays visible, says why, and offers to set up a Decision connection instead.

1. Open **Connections**, expand **Local Model**, and choose **Decision sidecar (experimental)**.
2. Read the warning, then turn on **Enable decision sidecar**. Confirming shows the verdict for your machine, and the button reads **Enable anyway** when that verdict is a warning.
3. Pick a model and confirm its size and licenses. Nothing downloads before that point.
4. Select **Decision sidecar** under **Decision model**.

You can also paste a decision model's HuggingFace repository. Marinara reads that repository's own manifest, checks that the artifact type maps to a runtime this build ships, and shows you the base weights it will pull and the total size before offering to install it. A repository it cannot vouch for is refused with the reason rather than installed hopefully.

Thresholds are not comparable between models, so the editor seeds a new question from whatever the selected model answers around. A decision model that answers yes at 0.2 and no at 0.02 needs a threshold near 0.1, not 0.5.

On a machine with more than one NVIDIA GPU, a **GPU** menu chooses the card it loads on. The verdicts are for that card, and changing it stops the model so it starts again there.

Turning the sidecar off stops the process and keeps the files. **Remove files** deletes the model and its runtime, and stays available while the sidecar is off.

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
- [Downloadable Agents Reference](built-in-agents.md)
- [Custom Tools](../extending/custom-tools.md)
- [Macros](../prompts/macros.md)
