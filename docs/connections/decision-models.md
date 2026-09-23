# Decision Models

This guide explains the **Decision model**: what it is, the three ways to get one, how to set each up, and where Marinara uses it. You never need one. Everything that uses it keeps working without it.

## What a decision model is

A decision model answers one kind of question. It is given the recent messages of a chat and a statement, such as "The latest message moves the scene to a new place", and it says how likely that statement is to be true, as a number from 0 to 1. Marinara compares that number with a threshold and treats the result as yes or no. It can also pick one answer from a short list, such as "angry", "sad" or "none of these".

It never writes text and never replies in the chat. Because it only has to score a statement, a decision is short and cheap next to a normal AI reply. A local chat model produces a single token, and a purpose-built decision model scores the statement in one pass.

## Where Marinara uses it

- **[Activation questions](../agents/custom-agents.md#activation-questions)** decide whether a custom agent runs on a turn.
- **[Smart response order](../chats/group-chats.md#response-order-individual-only)** can use it to decide who speaks next in a group chat. This is off until you turn it on.
- **[Decision statements in prompts](../prompts/conditional-prompts.md#asking-the-decision-model)**, `{{#if decision:"..."}}` and `{{#if decision_choice:"..." == "..."}}`, choose which part of a preset, character card, lorebook entry or agent prompt is sent.
- **[Lorebook decision activation](../lorebooks/entries.md#decision-activation)** decides whether a lorebook entry activates: a statement can be required on top of its keywords, or trigger it alone.

With no Decision model, or when it does not answer in time, nothing breaks. An agent with an activation question runs as if it had none, Smart response order makes its usual AI call, a decision statement in a prompt reads as no (so its `{{else}}` branch is sent), and a lorebook entry that needs a decision does not activate on it.

## What the model sees

Each request holds only the statement and the chat's recent messages, as they are saved in the chat. The model never sees the rest of the prompt: not your preset, the character card, your persona description, lorebook entries (Constant ones included), summaries or agent output. Text the prompt inserts between messages is left out too, such as a lorebook entry or preset prompt placed **@ Depth**. A statement that depends on a fact from any of those has to state the fact itself.

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

You do not need a special decision service. The local model you already run is often the best choice. In our tests, a mid-sized local model (Gemma 4 E4B) answered every well-worded statement correctly, while the small purpose-built Open-Jev 2B and the larger Open-Jev 9B each missed one of 32. A capable local model can match or beat a small decision model at this job.

| Option | Costs | Needs | Good for |
| --- | --- | --- | --- |
| A model you already run | Nothing extra | A local model in **Local Model** | Most people who run a local model |
| A hosted Decision connection | A billed request per turn that asks | An API key (TypeSafe or OpenRouter) | Phones, and PCs that do not run a local model |
| The installable decision model | About 10 GB of disk and 5 GB of GPU memory (2B) | Linux and an NVIDIA GPU | A separate, fast decision model beside your chat model |

**On Android (Termux),** the installable decision model cannot run, because it needs a PC with an NVIDIA GPU. A small local model on a phone's processor may also be too slow for the time limit. A hosted Decision connection is the practical choice on a phone, for example Jev through OpenRouter. See [Set up a Decision connection](#set-up-a-decision-connection).

Presets, cards and agents should be written for "a Decision model", never "requires Jev". Whichever one a user picks, the same statements work.

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

Hosted decisions send the selected recent messages and the statement to the chosen provider and can incur charges. The **Recent-message token budget** defaults to 30,000 estimated tokens for hosted sources and 3,500 for custom servers. Reduce it if your server has a smaller context limit. Marinara drops older messages first, then trims the oldest portion of the newest message. Token estimates can differ from a server's tokenizer; a rejected or over-budget request gives no answer.

**Time limit (seconds)** is how long each Decision connection waits for an answer during chats, from 0.5 to 30 seconds (1.5 by default). A later answer counts as no answer. Some hosted providers are sometimes slower than 1.5 seconds, which makes decisions look randomly broken, so click **Test** a few times and set the limit above the slowest answer. The trade-off: a statement asked before the reply, such as a decision in a preset or an activation question for an agent that runs before the reply, can hold up the reply for up to this long.

Deleting a connection used for a linked key warns you and leaves the Decision connection needing relinking. Imported standalone connection files also need keys or links restored; they never contain API keys or borrowed connection IDs.

## Let Marinara install a decision model

Marinara can also download and run a purpose-built decision model for you. It runs as its own local process, so it answers whether or not you also run a local chat model. It costs about 10 GB of disk and around 5 GB of GPU memory, on top of any local chat model you run. If you already have one, you probably do not need this: on our measurements that model is **more accurate on roleplay** than the decision model. The decision model is faster, and a little smaller.

It needs Linux with an NVIDIA GPU of compute capability 7.5 or newer (Turing, the RTX 20 series, or later) and driver 580 or newer. Pascal cards and older cannot run it whatever memory they have, because the runtime's kernels do not cover them. Where it cannot run, the option stays visible, says why, and offers to set up a Decision connection instead.

1. Open **Connections**, expand **Local Model**, and choose **Decision sidecar (experimental)**.
2. Read the warning, then turn on **Enable decision sidecar**. Confirming shows the verdict for your machine, and the button reads **Enable anyway** when that verdict is a warning.
3. Pick a model and confirm its size and licenses. Nothing downloads before that point. **Open-Jev 2B** is the smaller choice. **Open-Jev 9B** was more accurate in our tests, but it needs about 22 GB of GPU memory, so on a 24 GB card nothing else fits beside it, and it takes about a second per statement.
4. Select **Decision sidecar** under **Decision model**.

You can also paste a decision model's HuggingFace repository. Marinara reads that repository's own manifest, checks that the artifact type maps to a runtime this build ships, and shows you the base weights it will pull and the total size before offering to install it. A repository it cannot vouch for is refused with the reason rather than installed hopefully.

On a machine with more than one NVIDIA GPU, a **GPU** menu chooses the card it loads on. The verdicts are for that card, and changing it stops the model so it starts again there.

Turning the sidecar off stops the process and keeps the files. **Remove files** deletes the model and its runtime, and stays available while the sidecar is off.

## Thresholds

Probabilities are not comparable between models. A general local model answers a clear "yes" at 0.99, while a purpose-built decision model answers the same turn at 0.2 and a clear "no" at 0.02. So each model has its own recommended threshold, and Marinara uses it:

- An activation question starts from the selected model's recommended value, and the agent editor offers to restore it whenever yours differs.
- A decision statement in a prompt always uses the selected model's own threshold.

When you switch Decision models, check your activation question thresholds again.

## Time limits

A decision that does not arrive in time gives no answer, and no answer never blocks anything.

- **1.5 seconds** for a Decision connection, unless you change its **Time limit**. See [Set up a Decision connection](#set-up-a-decision-connection).
- **4 seconds** for a local model or the decision sidecar. When one turn asks many statements, Open-Jev 9B gets a little more time for each extra one.
- **20 seconds** for a local model that has to think first.

Decision requests stop when you cancel a generation.

## Other settings under Decision model

- **Also use it to pick who speaks in Smart response order.** Off by default. See [Group Chats](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn.** How many decision statements in presets, cards, lorebooks and agent prompts may be asked each turn, 32 by default and up to 255. Past this, the rest read as no. On a hosted connection each statement adds to a billed request; on a local model it only adds time.
- **Also gate agents that run before the reply** and **Thinking** appear for a local model. See [Use a model you already run](#use-a-model-you-already-run).

## Accuracy: plan for wrong answers

Any model will sometimes answer wrongly, and small ones more often. In our wording tests, several of Open-Jev 2B's correct "yes" answers sat only just above its threshold. So:

- Use a decision to fine-tune, never for something the chat cannot do without. A missed decision should make a reply slightly less tailored, not break it.
- Do not gate consent, content warnings or safety instructions on a decision.
- For an agent that runs only on an activation question, set **Bypass the question after this many messages** so a model that keeps answering "no" cannot silence it forever.

How to word statements so every model reads them the same way is in [Writing statements](../prompts/conditional-prompts.md#writing-statements).

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
