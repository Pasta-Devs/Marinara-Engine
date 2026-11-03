# Creating Custom Agents

A custom agent is a helper you write yourself: your own instructions, when it runs, and what it may change. Build one when no [downloadable agent](built-in-agents.md) does what you want. If an installed agent is close, hover its card in the **Agents** panel and click **Copy agent** to get an editable copy.

Before you start: read [Agents: AI Helpers for Your Chats](agents-overview.md). Building an agent does not run it. You add it to a chat afterward. Custom agents work in every chat mode.

## Creating a custom agent

1. Open the **Agents** panel.
2. Click **New** (the plus icon) near the top. The full-page agent editor opens.
3. Type a name in the title field, for example `Weather Reporter`.
4. Fill in **Description** and **Author**.
5. Choose a **Pipeline Phase** (see [Pipeline Phase](#pipeline-phase)).
6. Turn on the powers it needs under **Custom Agent Abilities**.
7. Pick a **Result Type** that matches what the agent produces.
8. Write its instructions under **Prompt Template**.
9. Click **Save** in the top bar. A green **Saved** badge appears.

The agent now appears in the **Custom Agents** section of the **Agents** panel. To use it, open a chat, go to **Chat Settings**, turn on **Enable Agents** and add the agent from **Custom Agents**.

## Pipeline Phase

**Pipeline Phase** sets when the agent runs.

- **Pre-Generation**: before the reply. It can add context or change the prompt.
- **Parallel**: at the same time as the reply. It cannot see the finished reply.
- **Post-Processing**: after the reply. It can read the reply and, for some result types, edit it.

Some result types force a phase. **Text Rewrite** switches to **Post-Processing**. **Prompt Patch** switches to **Pre-Generation**.

Post-Processing agents also get a **Turn Data Access** section with two toggles, **Pre-generation injections** and **Parallel agent results**. Turn them on to let the agent read what other agents produced in the same turn.

## Custom Agent Abilities

Abilities are opt-in powers. Each stays blocked until you turn on its toggle.

| Ability | What it lets the agent do |
| --- | --- |
| **Create lorebooks** | Create a new agent-made lorebook when its lore output has no target. |
| **Edit lorebooks** | Write lorebook entries or return lorebook update results. |
| **Edit messages** | Replace the generated message text, or add continuation choices to it. |
| **Edit trackers** | Update game, character, persona or custom tracker state. |
| **Frontend styling** | Apply a temporary visual style during generation. |
| **Change chat backgrounds** | Change and save the background for a chat. |
| **Change character sprites** | Change character and persona expressions shown in chat. |
| **Control media playback** | Control Spotify, YouTube or local music. |
| **Control haptic devices** | Send bounded commands to a connected haptic device. |
| **Edit About Me details** | Change chat-specific About Me text. Public card changes still need your approval. |
| **Image generation** | Send an image prompt to the image generator. |
| **Vectors/embeddings** | Use vector context. Vectors let Marinara search text by meaning. |
| **Main prompt edits** | Edit the prompt sent to the main model. |
| **Create character cards** | Propose a new character card. It is saved only after you review and accept it. |
| **Choose active chat characters** | Choose which attached characters are enabled for the current Conversation or Roleplay reply. |

If you turn on **Edit lorebooks**, a **Lorebook Writer** section appears. Turn on **Allow lorebook entry writes** and pick one lorebook in **Target lorebook**. The agent can write only to that lorebook.

## Result Type

**Result Type** tells Marinara how to read the agent's answer. Most types expect JSON, a text format written with braces and quotation marks. Each type needs the matching ability. A type stays greyed out until you turn that ability on.

| Result Type | What it does | Ability needed |
| --- | --- | --- |
| **Context Injection** | Adds text before generation, or records a note after it. | None |
| **Text Rewrite** | Replaces the message text after the reply. | Edit messages |
| **Lorebook Update** | Creates or updates lorebook entries. | Edit lorebooks |
| **Character Tracker** | Updates the present characters. | Edit trackers |
| **Persona Stats** | Updates persona stats, status and inventory. | Edit trackers |
| **Custom Tracker** | Replaces your custom tracker fields. | Edit trackers |
| **Game State** | Updates world-state style game data. | Edit trackers |
| **Image Prompt** | Asks the image generator to draw a scene. | Image generation |
| **Prompt Patch** | Adds, prepends or replaces prompt sections. | Main prompt edits |
| **Frontend Style** | Applies a temporary styling effect. | Frontend styling |
| **Background Change** | Picks and saves an available chat background. | Change chat backgrounds |
| **Sprite Change** | Changes expressions shown in chat. | Change character sprites |
| **Spotify Control**, **YouTube Control**, **Local Music Control** | Controls playback. | Control media playback |
| **Haptic Command** | Sends a bounded command to a haptic device. | Control haptic devices |
| **About Me Update** | Updates chat-specific About Me text and proposes public edits. | Edit About Me details |
| **Interactive Choices** | Adds continuation choices to the message. | Edit messages |
| **Character Card Creation** | Proposes one editable character card for your approval. | Create character cards |
| **Character Activity** | Selects the character cards used for the current reply. | Choose active chat characters |

**Context Injection** is the easiest start. It needs no ability and no strict output format.

### Controls for image agents in a chat

An agent with the **Image generation** ability gets two extra controls in **Chat Settings → Agents → Custom Agents**.

- **Image model**: overrides the image connection for this agent in this chat only. Leave it on **Agent default** to keep the agent's own setting. The chat's **Image Style** also applies to custom-agent images.
- **Camera button**: makes an image now, without waiting for activation keywords. If the agent's template declines to write a prompt, you get an error toast instead of an image.

## Activation Keywords

By default an agent runs on its normal cadence (how often it runs). **Activation Keywords** skip the agent unless the scene is relevant, which saves tokens.

1. In **Activation Keywords**, type one keyword or phrase per line, such as `tavern` or `secret door`.
2. Set **Scan Depth** to the number of recent messages to search. The default is 5 and the maximum is 200.

The agent then runs only when a keyword appears in those messages. Leave the box empty to turn the filter off. Cadence and any activation question still apply.

## Activation questions

An activation question asks whether the recent scene needs your agent. It catches paraphrases that keywords miss. It needs a **Decision model**, a small model that answers yes-or-no questions. Pick one in the Connections panel. See [Decision Models](../connections/decision-models.md). With **Decision model** set to **None**, the default, the question fields stay disabled, and an agent with a question runs as if it had none.

1. Open the custom agent.
2. Type a **Question** of up to 500 characters. The macros `{{user}}` and `{{char}}` work in it.
3. Set **Run when probability is at least** to the threshold for this agent. The agent runs when the chance of "yes" meets it, so higher values skip more runs. The editor shows a recommended value for your model. See [Thresholds](../connections/decision-models.md#thresholds).
4. Optional: set **Bypass the question after this many messages without a successful run**. After that many messages, the question is skipped, so a model that keeps answering "no" cannot silence the agent for good. Keywords and cadence still apply.

Write the question as a statement about the latest message, such as `The latest message moves the scene to a new place.` A small model answered this more reliably than `Did the scene change?` See [Writing statements](../prompts/conditional-prompts.md#writing-statements).

How it runs:

- Keywords and cadence are checked first, so a skipped agent costs no decision request.
- **Scan Depth** sets the messages used by both keywords and the question.
- Pre-generation and parallel agents use the chat before the reply. Post-processing agents also see the finished reply.
- A timeout, an unavailable model or an invalid answer lets the agent run normally. The time limit is the Decision connection's **Time limit (seconds)**, 1.5 seconds by default.
- Imported agents with an activation question or decision statements show a notice linking to the Decision Models guide. Without a Decision model, the agent runs whenever keywords and **Trigger Cadence** allow, and prompt statements read as no.

Activation questions apply to custom agents only.

## Decision statements in the agent's prompt

An activation question decides whether the agent runs. A decision statement in the **Prompt Template** decides what a running agent is told. The syntax is in [Conditional Prompts](../prompts/conditional-prompts.md#asking-the-decision-model):

```text
{{#if decision:"In the latest message, the characters move to a different location"}}
Update the location field.
{{else}}
Leave the location as it is.
{{/if}}
```

Use them to send a smaller prompt on quiet turns. A tracker can update the location only when it changed. An image agent can describe a new picture only when the scene changed. A music agent can change tracks only when the mood shifted.

- Pre-generation and parallel agents read the chat before the reply and share answers with the main prompt. Post-processing agents read the finished reply, and their statements are asked again with it.
- Re-running an agent reuses successful answers still cached for the same turn, model and statements. See [Answer reuse](../prompts/conditional-prompts.md#answer-reuse).
- In an agent prompt, `{{char}}` names every character in the chat, so in a group `{{char}} is angry` becomes "Kaelen, Alyssa is angry". Name the character, or write "a character".
- With no answer, a statement reads as no. Make the `{{else}}` branch sensible, because many users have no Decision model.

Agents installed from Marinara-Agents render prompts the same way.

## Attach tools

An agent can call tools: functions the AI runs to fetch or change something, then reads back. This is also called function calling.

1. In the agent editor, open **Tools / Function Calling** and switch on each tool you want. The list has built-in tools and your own. To build one, see [Custom Tools](../extending/custom-tools.md).
2. In **Chat Settings**, open **Function Calling** and turn on **Enable Tool Use**. Without it, agent tools stay off.

Imported agents never get tool access. Review an imported agent, then select its tools yourself.

An agent gets at most 16 rounds of tool calls per run (fewer if the server's `MAX_TOOL_ROUNDS` is lower), then answers with what it has. A model that calls one tool at a time spends a round per call, so an agent that saves many entries should make several calls in one response. A lorebook backfill run gets up to 64 rounds.

## Named prompt options

An agent can hold several prompt variants, so each chat can pick one without editing the agent.

1. Under **Prompt Template**, find **Named prompt options**.
2. Click **Add option**.
3. Give it a name and a short description, then write its full prompt.

When someone adds the agent to a chat, a **Prompt Mode** dropdown lists your options. With none, only the default prompt shows.

## Other settings

- **Model override**: use a different model for this agent, for example a cheaper one. Leave it empty to use the chat's model. The agent sends the generation parameters saved on that connection. See [Parameters for agents](../prompts/generation-parameters.md#parameters-for-agents).
- **Agent Budget**: **Context Size** is how many recent messages the agent reads (default 5). **Max Output Tokens** is the output room reserved (default 4096, from 128 to 32768).
- **Add as Prompt Section**: exposes the agent's latest output as a section you can place in a prompt preset.

Macros such as `{{user}}` and `{{char}}` work in the **Prompt Template**. See [Macros](../prompts/macros.md).

## Worked example

This agent rewrites every reply into British English.

1. Name it `British English Editor`.
2. Under **Custom Agent Abilities**, turn on **Edit messages**.
3. Under **Result Type**, pick **Text Rewrite**. The phase switches to **Post-Processing**.
4. Paste this into **Prompt Template**:

```text
You are a copy editor. Rewrite the latest reply into British English.
Change spelling and vocabulary only. Do not change the meaning, tone, or events.
Return JSON with an "editedText" field holding the full rewritten reply,
and a "changes" array of short notes describing what you changed.
```

5. Click **Save**.
6. Open a Roleplay chat, turn on **Enable Agents** in **Chat Settings** and add the agent from **Custom Agents**.

After each reply the agent returns JSON like this:

```json
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara swaps `editedText` into the reply. The `changes` notes show as a short summary.

## Import and export agents

To export one agent, click **Export agent** (the upload icon) in the editor's top bar. The file holds the agent's prompt and settings, never custom-tool definitions. To export several, use **Select agents** in the **Agents** panel, pick them and export.

External imports are locked by default.

1. Open **Settings → Advanced → Danger Zone** and turn on **Allow custom Agent imports**. No `.env` change is needed.
2. In the **Agents** panel, click **Import agents** and choose agent files or a folder.
3. Review the permission list Marinara shows. Approve only what the agent needs. Unchecked capabilities stay blocked.

This lock affects only agents from files, folders or custom repositories. Agents you create and official agents from **Agent Organizer** work normally. Each imported file gets a new custom identity, so it cannot replace an official agent.

For safety, Marinara ignores bundled functions, clears tool selections, cleans temporary CSS and checks approved capabilities before an imported agent can change messages, trackers, lorebooks, backgrounds, sprites, media, haptics, About Me data, prompts or images. Import trusted functions separately, review them, and attach them to the agent yourself. Turning the **Danger Zone** toggle off stops imported agents from running.

## Related guides

- [Agents: AI Helpers for Your Chats](agents-overview.md)
- [Decision Models](../connections/decision-models.md)
- [Downloadable Agents Reference](built-in-agents.md)
- [Custom Tools](../extending/custom-tools.md)
- [Macros](../prompts/macros.md)
