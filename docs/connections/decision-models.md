# Decision Models

This guide explains the **Decision model**: what it is, the three ways to get one, how to set each up, and where Marinara uses it. It is optional. Without one, chats still generate, but each feature uses the fallback described below.

## What a decision model is

A decision model answers one kind of question. It is given the recent messages of a chat and a statement, such as "The latest message moves the scene to a new place", and it says how likely that statement is to be true, as a number from 0 to 1. Marinara compares that number with a threshold and treats the result as yes or no. It can also pick one answer from a short list, such as "angry", "sad" or "none of these".

Its answers control Marinara's behavior; they are not posted as replies in the chat. A purpose-built decision model scores statements directly. A local chat model is normally asked for a single yes/no token, though some models need to reason first. Decisions can be faster than a full reply, but many statements or a reasoning model can add noticeable time.

## Where Marinara uses it

- **[Activation questions](../agents/custom-agents.md#activation-questions)** decide whether a custom agent runs, before the agent's work in its phase. With no answer, the question does not stop it; keywords and **Trigger Cadence** still apply.
- **[Prompt statements](../prompts/conditional-prompts.md#asking-the-decision-model)** choose text when preparing a chat or agent prompt. With no answer, the decision reads as no, so a simple decision block uses its `{{else}}` branch, if present.
- **[Lorebook Decision fields](../lorebooks/entries.md#decision-activation)** check Require or Trigger during the chat's lorebook scan. With no answer, Require cannot admit a new entry and Trigger adds no activation route. Existing Sticky holds and ordinary Trigger-entry activation routes still apply.
- **[Smart response order](../chats/group-chats.md#response-order-individual-only)** scores who should speak next in a group chat, if enabled. With no answer, Smart order makes its usual AI call.

An activation question controls whether an agent runs; a decision statement inside its prompt controls what that running agent is told. Use `{{#if decision:"..."}}` for yes/no prompt conditions and `{{#if decision_choice:"..." == "..."}}` for a choice among answers.

## What the model sees

For activation questions and prompt/lorebook statements, the model receives the statement and recent messages as saved in the chat. It does not receive the rest of the assembled prompt: your preset, character card, persona description, lorebook entries (Constant ones included), summaries or agent output. Text inserted between messages, such as a preset or lorebook entry placed **@ Depth**, is also left out. A statement that depends on one of those facts must include the fact itself.

**Smart response order also sends a character roster.** It includes each candidate's name, status, activity and talkativeness when available, plus up to 300 characters of personality or, if that is empty, description. A hosted Decision provider receives this roster as well as the recent messages.

- Decision statements in prompts and lorebook entries, and Smart response order, read the last 5 messages. This number is fixed.
- Activation questions read the agent's **Scan Depth**, 5 by default.
- Each message is labeled with its speaker's name. Messages hidden from the AI are left out.
- Anything checked after the reply, such as a post-processing agent's activation question or a statement in its prompt, also sees the reply just written.
- Macros in the statement are filled in first, so `{{char}}` arrives as the character's name.
- When the messages do not fit the model's budget, older messages are dropped first. See [Set up a Decision connection](#set-up-a-decision-connection) for the hosted budget.

## Choosing a Decision model

Open **Connections**, then **Connection defaults**, and pick from **Decision model**. The list has three groups:

- **None**, the default. Nothing is asked, and the activation question fields in the agent editor stay disabled.
- **Local models**: the **Primary local model** or **Utility local model** you already run. Nothing is downloaded and nothing leaves your machine. The **Decision sidecar**, if you installed one, is listed here too.
- **Connections**: any Decision connection you created, hosted or self-run.

Entries that cannot answer right now stay in the list, greyed out with the reason, so you can see what to fix. Click **Test** after choosing. The test sends a fixed sample, not your chat.

### Which one to pick

If you already run a local model, try it first. In a small wording test from one roleplay scene, Gemma 4 E4B answered 32 of 32 recommended statements correctly, and Open-Jev 2B and 9B each answered 31. This is an example of why wording matters, not a general accuracy ranking. Test representative turns from your own chats; see [Writing statements](../prompts/conditional-prompts.md#writing-statements).

**Jev and Open-Jev are different models.** Jev is TypeSafe's hosted model, available directly or through OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) is a separately published model built on Qwen, which Marinara can run locally. The Open-Jev wording tests do not measure hosted Jev's accuracy.

| Option | Costs | Needs | Good for |
| --- | --- | --- | --- |
| A model you already run | Nothing extra | A local model in **Local Model** | Most people who run a local model |
| A hosted Decision connection | Billed requests; one turn can make several | An API key (TypeSafe or OpenRouter) | Phones, and PCs that do not run a local model |
| The installable decision model | Separate disk and GPU memory; see [model sizes](#let-marinara-install-a-decision-model) | Linux x86-64 and a supported NVIDIA GPU | A separate decision model beside your chat model |

**On Android (Termux),** the installable decision model cannot run, because it needs a PC with an NVIDIA GPU. A small local model on a phone's processor may also be too slow for the time limit. A hosted Decision connection is the practical choice on a phone, for example Jev through OpenRouter. See [Set up a Decision connection](#set-up-a-decision-connection).

Presets, cards and agents should be written for "a Decision model", never "requires Jev". They use the same statement syntax whichever model a user picks, but different models can give different answers.

When someone imports content that uses decisions, Marinara shows a notice with a link to this guide. This includes custom agents and Agent catalog installs. If no Decision model is selected, the notice explains the fallback: prompt statements read as no, lorebook entries cannot activate on a decision, and agent activation questions let the agent run whenever its keywords and **Trigger Cadence** allow. Give an agent a cadence as well if it should not run every turn without a Decision model. Whole-profile ZIP restoration does not show this import notice.

## Use a model you already run

If you have a local model in **Local Model**, you can use it for decisions and never create a connection or pay for a request.

1. In **Connections**, open **Connection defaults** and set **Decision model** to **Primary local model**, or to **Utility local model** if you have one set up.
2. Click **Test**. A successful result shows the probability and request time, plus two things that are specific to a local model: whether log-probabilities were available, and whether the model answers directly.

Marinara asks the model a single yes/no question, lets it produce one token, and reads the answer from that token's probabilities. No reply is written, so the request is short. A choice between several answers is asked as one yes/no question per answer. How many recent messages fit is worked out from the slot's own context size.

**Thinking.** Most models answer in one word. Some always reason first, whatever they are asked. The **Thinking** setting below the dropdown controls this:

- **Auto** (default) tries the fast one-word method and, if the model cannot answer that way twice in a row, lets that model think first and tells you.
- **Off** always uses the one-word method. A model that cannot answer that way gives no answer.
- **Allowed** never asks the model to skip reasoning.

A model that thinks first takes seconds, so by default it only answers for things that happen after the reply is on screen, such as post-processing agents. In front of the reply it gives no answer, unless you turn on **Also gate agents that run before the reply**, which makes every reply wait for it.

**About the numbers.** A general chat model's yes/no probabilities are usable for a threshold, but they were never trained to be calibrated the way a purpose-built decision model's are, and a runtime that returns no log-probabilities answers a flat 1 or 0. Tune thresholds against your own chats rather than trusting the default.

## Set up a Decision connection

1. In **Connections**, create a connection with provider **Decision**.
2. Choose **TypeSafe**, **OpenRouter**, or **Custom System One endpoint**. Hosted sources need an API key. Custom accepts a System One server you already run, including Open-Jev; enter its base URL without `/v1/systemone` and use the model name it supports.
3. For OpenRouter, choose a saved OpenRouter connection under **API key source**, or enter a separate key. Its editor also offers **Use this key for decisions (Jev)**. Linked keys follow later key changes automatically. Custom connections may borrow a custom chat connection's key only when both URLs have the same origin (scheme, host, and port).
4. Save, then select it under **Decision model** and click **Test**. A successful result shows the probability, how long the answer took, and the connection's time limit. Test waits at least 10 seconds, and 5 seconds past a longer limit, so a slow answer is reported with its real time. If it took longer than the time limit, the result says so: during chats that answer would count as no answer.

The Decision default is separate from your chat, agent, image, video, and audio defaults. Choosing **None** turns decisions off without deleting any activation questions or decision statements.

Hosted decisions send the selected recent messages and statements to the chosen provider and can incur charges. Smart response order also includes the [character roster](#what-the-model-sees). The **Recent-message token budget** defaults to 30,000 estimated tokens for hosted sources and 3,500 for custom servers. Reduce it if your server has a smaller context limit. Marinara drops older messages first, then trims the oldest portion of the newest message. Token estimates can differ from a server's tokenizer; a rejected or over-budget request gives no answer.

**Time limit (seconds)** is how long each Decision connection waits for an answer during chats, from 0.5 to 30 seconds (1.5 by default). A later answer counts as no answer. Some hosted providers are sometimes slower than 1.5 seconds, which makes decisions look randomly broken, so click **Test** a few times and set the limit above the slowest answer. The trade-off: a statement asked before the reply, such as a decision in a preset or an activation question for an agent that runs before the reply, can hold up the reply for up to this long.

Deleting a connection used for a linked key warns you and leaves the Decision connection needing relinking. Imported standalone connection files also need keys or links restored; they never contain API keys or borrowed connection IDs.

## Let Marinara install a decision model

Marinara can also download and run a purpose-built decision model for you. It runs as its own local process, whether or not you also run a local chat model. Its memory use is added to that of your chat model. If you already have a local model, try its decisions before downloading another one.

The built-in Open-Jev models need Linux **x86-64**, an NVIDIA GPU of compute capability 7.5 or newer (Turing, the RTX 20 series, or later), and driver 580 or newer. Linux ARM devices and Pascal cards or older are not supported by these packages. Where a model cannot run, the option stays visible, says why, and offers to set up a Decision connection instead.

| Built-in model | Model download | Disk including runtime | GPU memory |
| --- | --- | --- | --- |
| Open-Jev 2B | About 4.6 GB | About 10 GB | About 4.8 GB (4.5 GiB) |
| Open-Jev 9B | About 19.4 GB | About 25.3 GB | About 23.6 GB (22 GiB) |

These are the catalog's estimates, based on the pinned model versions and measured workloads. GPU use and speed vary with the workload. The 9B model leaves little headroom on a 24 GB GPU; check the installer's verdict for your selected card and other running models.

1. Open **Connections**, expand **Local Model**, and choose **Decision sidecar (experimental)**.
2. Read the warning, then turn on **Enable decision sidecar**. Confirming shows the verdict for your machine, and the button reads **Enable anyway** when that verdict is a warning.
3. Pick a model and confirm its size, hardware verdict and licenses. Nothing downloads before that point. **Open-Jev 2B** needs much less memory than **Open-Jev 9B**; neither guarantees correct answers for your chat.
4. Select **Decision sidecar** under **Decision model**.

You can also paste a decision model's HuggingFace repository. Marinara reads that repository's own manifest, checks that the artifact type maps to a runtime this build ships, and shows you the base weights it will pull and the total size before offering to install it. A repository it cannot vouch for is refused with the reason rather than installed hopefully.

On a machine with more than one NVIDIA GPU, a **GPU** menu chooses the card it loads on. The verdicts are for that card, and changing it stops the model so it starts again there.

Turning the sidecar off stops the process and keeps the files. **Remove files** deletes the model and its runtime, and stays available while the sidecar is off.

## Thresholds

Probabilities are not directly comparable between models. The same positive example might score 0.99 on one model and 0.2 on another. Marinara's default threshold depends on how the model is connected:

| Selected backend | Default yes/no threshold |
| --- | --- |
| Primary or Utility local chat model | 0.5 |
| TypeSafe, OpenRouter or Custom System One Decision connection | 0.5 |
| Managed Decision sidecar | Its model manifest's recommendation; 0.1 for the built-in Open-Jev 2B and 9B |

An agent's **Run when probability is at least** can override this default. The editor offers to restore the backend's recommendation when the saved value differs. Check the setting whenever you switch models.

Prompt statements and lorebook Decision fields use the backend's default; changing an agent's threshold does not change theirs. **A self-hosted Open-Jev behind a Custom System One connection still uses 0.5.** Marinara cannot identify and calibrate arbitrary custom endpoints automatically. Its results can therefore differ from the managed Open-Jev sidecar, including reading a positive result below 0.5 as no.

## Time limits

A decision that does not arrive in time gives no answer. Generation continues using the [feature's fallback](#where-marinara-uses-it); this can omit a prompt branch or a required lorebook entry.

- **1.5 seconds** for a Decision connection, unless you change its **Time limit**. See [Set up a Decision connection](#set-up-a-decision-connection).
- **4 seconds** for a local model or the decision sidecar. When one turn asks many statements, Open-Jev 9B gets a little more time for each extra one.
- **20 seconds** for a local model that has to think first.

Decision requests stop when you cancel a generation.

## Other settings under Decision model

- **Also use it to pick who speaks in Smart response order.** Off by default. See [Group Chats](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn.** Limits prompt and lorebook statement planning, 32 by default and up to 255. The allowance is applied at several stages; it is not a single cap on all Decision requests or spending during a turn. Agent activation questions and Smart response order are separate. See [Limits and cost](../prompts/conditional-prompts.md#limits-and-cost) for the scope, batching and priority rules.
- **Also gate agents that run before the reply** and **Thinking** appear for a local model. See [Use a model you already run](#use-a-model-you-already-run).

## Accuracy: plan for wrong answers

Any model can answer wrongly. In the small wording test above, several of Open-Jev 2B's correct "yes" answers sat only just above its threshold. Plan for missed or mistaken answers:

- Use a decision to fine-tune, never for something the chat cannot do without. A missed decision should make a reply slightly less tailored, not break it.
- Do not gate consent, content warnings or safety instructions on a decision.
- For an agent that runs only on an activation question, set **Bypass the question after this many messages** so a model that keeps answering "no" cannot silence it forever.

For concrete wording examples and a way to test them on your own chats, see [Writing statements](../prompts/conditional-prompts.md#writing-statements).

## Troubleshooting

- **Test fails.** The message says why: the key was rejected, the provider is rate limiting, the local model is not running, the decision model is not installed, the model did not answer yes or no, or it ran out of time.
- **Test says the answer was over the time limit, or decisions work only some of the time.** The provider answers more slowly than the connection's **Time limit** at least some of the time. Test a few times and raise the limit above the slowest answer.
- **An agent with an activation question runs on every turn.** No Decision model is set, or it is not answering, so the agent runs as if it had no question. Check **Test**.
- **A decision branch in a prompt never appears.** See [When a decision branch never appears](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **Smart response order still makes its usual AI call.** The switch is off, or the Decision model did not answer on that turn.
- **To see every statement and its answer,** set the log level to debug. See [Logging levels](../CONFIGURATION.md#logging-levels).

## Related guides

- [Creating Custom Agents](../agents/custom-agents.md)
- [Conditional Prompts](../prompts/conditional-prompts.md)
- [Group Chats](../chats/group-chats.md)
- [Local Model Setup](local-model.md)
- [Connecting to an AI Provider](connecting-to-a-provider.md)
