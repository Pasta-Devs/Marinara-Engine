# Decision Models

A decision model is a small model that answers yes-or-no questions for Marinara, such as "Does the latest message move the scene to a new place?". Lorebooks, custom agents, prompts, and group chats use it. It is optional. Without one, chats still work and each feature uses the fallback described in [Where Marinara uses it](#where-marinara-uses-it).

Its answers control what Marinara does and are never posted in the chat. It scores a statement from 0 to 1. Marinara compares that number with a threshold and treats the result as yes or no. It can also pick one answer from a short list, such as "angry", "sad", or "none of these".

Our advice: leave it on **None** if you are unsure. If you want decisions, use the Built-in model you may already have, or a chat model on a server you already run. Both cost nothing extra.

## Choose a decision model

Before you start, see [Which one to pick](#which-one-to-pick).

1. Click **Connections** in the top bar and open the **Jobs** box.
2. Under **Behind the scenes**, click the **Decision** row. A list opens.
3. Pick a model. The list has three groups:
   - **None (decisions off)** is the default. Nothing is asked, and the activation question fields in the agent editor stay disabled.
   - **Built-in model** lists the models Marinara runs on your computer: **Built-in model**, **Built-in model (utility)**, and **Built-in model (decisions)**. Nothing leaves your computer.
   - **Connections** lists your accounts that can answer decisions: hosted, or a chat model on a server you already run.
4. To test it, click the **Decision settings** gear on the row and click **Test**. That button shows for the Built-in model entries. For a TypeSafe or OpenRouter account, open **Edit model** on its model and click **Test provider**. For an **Own decision server** account, use **Test** in the account's **⋯** menu.

A passing test shows the probability of yes and how long the answer took. For a model on your computer it also says whether log-probabilities were available and whether the model answers directly. Log-probabilities are the model's confidence numbers for each word it could write. The test sends a fixed sample, not your chat.

If it did not work, the message says why. Common causes: the key was rejected, the service is limiting requests, the built-in model is not running, or the answer was over the time limit. See [Troubleshooting](#troubleshooting).

Entries that cannot answer right now stay in the list, gray, with the reason. Choosing **None** turns decisions off without deleting any activation question or decision statement.

### Which one to pick

- **A model you already run in the Built-in model.** Costs nothing extra. Best for most people who use the Built-in model.
- **A chat model on your own server** (Ollama, LM Studio, llama.cpp, or another OpenAI-compatible server). Costs nothing extra. Good when your model runs outside Marinara, so it is not loaded twice.
- **A hosted Decision account** (TypeSafe or OpenRouter key). Billed per request, and one turn can make several. Good for phones and computers that run no local model.
- **The Built-in decision model.** Uses separate disk and GPU memory. Needs Linux x86-64 and a supported NVIDIA GPU. For a separate decision model beside your chat model.

If you already run a local model, try it first, and test turns from your own chats. Wording matters a lot. See [Writing statements](../prompts/conditional-prompts.md#writing-statements).

Jev and Open-Jev are different models. Jev is TypeSafe's hosted model, available directly or through OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) is a separately published model built on Qwen, which Marinara can run locally. The Open-Jev tests do not measure hosted Jev.

On Android (Termux), the **Built-in decision model** cannot run, and a small local model on a phone's processor can be too slow. A hosted account is the practical choice, for example Jev through OpenRouter. See [Set up a Decision connection](#set-up-a-decision-connection).

Write presets, cards, and agents for "a decision model", never "requires Jev". They use the same statement syntax with any model, but models can give different answers. When you import content that uses decisions, including custom agents and Agent Organizer installs, Marinara shows a notice that links here. Restoring a whole profile ZIP does not show it.

## Use the Built-in model

If you have the Built-in model downloaded, you can use it for decisions with no account and no cost. See [Built-in Model Setup](local-model.md).

1. Click the **Decision** row under **Behind the scenes** in the **Jobs** box.
2. Pick **Built-in model** (or **Built-in model (utility)** if you have one).
3. Click the **Decision settings** gear, then click **Test**.

Marinara asks the model one yes-or-no question, lets it write one token, and reads the answer from that token's probabilities. No reply is written, so the request is short. A choice between several answers is asked as one yes-or-no question per answer.

The **Thinking** setting controls what happens when a model cannot answer in one word. Some models always reason first.

| Thinking | What it does |
| --- | --- |
| **Auto (try one word, allow thinking if the model cannot)** | Default. After two failed one-word answers in a row, the model is allowed to think first, and Marinara tells you. |
| **Off (always answer in one word)** | A model that cannot answer in one word gives no answer. |
| **Allowed (let the model think first)** | Never asks the model to skip reasoning. |

A model that thinks first takes seconds, so by default it answers only for checks that run after the reply is on screen, such as post-processing agents. To make it also gate agents that run before the reply, turn on **Also gate agents that run before the reply**. Every reply then waits for it.

A general chat model's yes-or-no probabilities work for a threshold, but they were not trained to be calibrated like a purpose-built decision model's. A runtime that returns no log-probabilities answers a flat 1 or 0. Tune thresholds against your own chats.

### On a server you already run

If your chat model runs in Ollama, LM Studio, llama.cpp, or another OpenAI-compatible server, it can answer decisions without Marinara loading a second copy.

1. Click **⋯** on that model in the **Connections** panel and choose **Use this model for decisions**. The **Add account** window opens on the decision step with the same address, model, and key.
2. Pick the model, then click **Test decision**. A passing test says whether the server returned log-probabilities and whether the model had to think first. Click **Done**.
3. Click the **Decision** row under **Behind the scenes** and pick the new model.

You can also create one yourself. Use a Decision account with the source **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**, the same address as your chat account (for example `http://localhost:11434/v1` for Ollama), and the model name the server uses.

It is asked like the Built-in model: one yes-or-no word per statement. Statements go one at a time, because Marinara cannot know how many requests your server handles at once. **Thinking** is always **Auto** for an account. A server on another computer needs `PROVIDER_LOCAL_URLS_ENABLED`. See [Connecting a Local or Self-Hosted Model](local-self-hosted.md).

## Set up a Decision connection

A hosted Decision account sends the selected recent messages and statements to the service and can cost money. Smart response order also sends a [character roster](#what-the-model-sees).

1. Click **Connections** in the top bar, then click **Add**.
2. Under **Decisions**, click **TypeSafe** or **Own decision server**. For OpenRouter, click **OpenRouter** under **Chat**, connect it, then use **Use this key for decisions** in the model's **⋯** menu.
3. Enter the **API key**, or for **Own decision server** the **Server address**. Click **Connect**. The window closes and the panel shows the new account.
4. Click the **Decision** row under **Behind the scenes** and pick the new model.
5. To test it, click the model in the panel to open **Edit model**, then click **Test provider** in the **Provider tests** card. An **Own decision server** model has no **Test provider** button there. Open the account's **⋯** menu in the panel and click **Test** instead.

A passing **Test provider** shows the probability, how long the answer took, and the account's time limit. The account's **Test** in the **⋯** menu only says whether it worked and how long it took. The test waits at least 10 seconds, or 5 seconds past a longer limit. If the answer took longer than the limit, the result says so: in chats that answer would count as no answer.

If it did not work, see [Troubleshooting](#troubleshooting).

The Decision editor (**Edit model** on a decision model) has these fields:

| Field | What it does |
| --- | --- |
| **Decision source** | **TypeSafe**, **OpenRouter**, **Custom System One endpoint**, or **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. It is fixed when you create the model. |
| **API key source** | **Enter a separate key (optional for local servers)** or **Use key from …** another account. Linked keys follow later key changes. A custom System One or OpenAI-compatible model can borrow a custom chat account's key only when both addresses have the same scheme, host, and port. |
| **Recent-message token budget** | How many estimated tokens of chat to send. 1 to 30,000. Default 30,000 for TypeSafe and OpenRouter, and 3,500 for custom servers. Marinara drops older messages first, then trims the oldest part of the newest message. A rejected or over-budget request gives no answer. |
| **Time limit (seconds)** | How long to wait for each statement during chats. 0.5 to 30. Default 1.5, or 4 for an OpenAI-compatible chat model. See [Time limits](#time-limits). |

TypeSafe sends to `https://api.typesafe.ai`. You can replace its **Base URL** with another server that runs TypeSafe's API, without `/v1/systemone`. It still needs your TypeSafe key, which goes to that server. **Custom System One endpoint** accepts a System One server you run, such as Open-Jev or [Strands decider](#run-strands-decider-yourself). Enter its address without `/v1/systemone`. A chat model server such as Ollama does not speak System One. Use **OpenAI-compatible chat model** for it.

Some hosted services answer slower than 1.5 seconds at times, which makes decisions look randomly broken. Test a few times and set the limit above the slowest answer. Statements asked before the reply, such as a preset's decisions or an activation question for an agent that runs before the reply, can hold up the reply for up to that long each.

Deleting an account whose key is used for decisions shows a warning. The Decision account then needs relinking, and until then decisions give no answer. Imported connection files never contain API keys or borrowed account links, so restore them by hand.

## Where Marinara uses it

- [Activation questions](../agents/custom-agents.md#activation-questions) decide whether a custom agent runs. Without an answer: the question does not stop it. Keywords and **Trigger Cadence** still apply.
- [Prompt statements](../prompts/conditional-prompts.md#asking-the-decision-model) choose text when a chat or agent prompt is built. Without an answer: the decision reads as no, so a decision block uses its `{{else}}` branch if there is one.
- [Lorebook Decision fields](../lorebooks/entries.md#decision-activation) check Require or Trigger during the lorebook scan. Without an answer: require cannot admit a new entry and Trigger adds no route. Sticky holds and ordinary Trigger routes still apply.
- [Smart response order](../chats/group-chats.md#response-order-individual-only) scores who speaks next in a group chat, if turned on. Without an answer: smart order makes its usual AI call.
- [Automate active characters](../chats/group-chats.md#automate-active-characters-merged-only) asks who is in the scene before each reply in a Merged Roleplay group, if set to **Decision model**. Without an answer: if no character gets an answer, it uses the Character Tracker's last scene, or keeps the list.
- [Advanced Memory Recall](../agents/memory.md#optional-decision-model) can use its own decision model for Roleplay scene boundaries and memory selection. Turn on **Use Decision model** in that chat's Advanced Memory settings. Without an answer: failed decisions fall back to ordinary recall or scene checks. Summaries still use the Helper model.

An activation question decides whether an agent runs. A decision statement inside its prompt decides what that running agent is told. Use `{{#if decision:"..."}}` for yes-or-no conditions and `{{#if decision_choice:"..." == "..."}}` for a choice among answers.

## What the model sees

For activation questions and prompt and lorebook statements, the model gets the statement and the recent messages as saved in the chat. It does not get your preset, character card, persona, lorebook entries (Constant ones too), summaries, or agent output. Text placed between messages, such as an entry set to **@ Depth**, is left out too. A statement that depends on one of those must state the fact itself.

- Prompt and lorebook statements, Smart response order, and Automate active characters read the last 5 messages. This number is fixed.
- Activation questions read the agent's **Scan Depth**, 5 by default.
- Each message carries its speaker's name. Messages hidden from the AI are left out.
- A check that runs after the reply, such as a post-processing agent's question, also sees the reply that was written.
- Macros in the statement are filled in first, so `{{char}}` arrives as the character's name.
- When the messages do not fit the model's budget, older messages are dropped first.

**Smart response order** also sends a roster: each candidate's name, status, activity, and talkativeness when known, plus up to 300 characters of personality or, if empty, description.

**Automate active characters** also sends a roster: each character's name and up to 300 characters of description or, if empty, personality, cut to 100 characters or names alone when a big cast does not fit, plus the names the Character Tracker last saw. If names alone leave too little room for messages, the model is not asked and the Character Tracker stands in. Replies in a Merged group are labeled "the narrator", since one reply voices everyone.

A hosted decision service receives these rosters as well as the messages.

**Advanced Memory** uses its own per-chat decision model and not the last-5 rule. Scene checks read the relevant transcript window. Recall sends recent conversation text and up to 24 shortlisted archived recaps (more if **Maximum recalled scenes** is higher), then original messages from the scenes the model chose, after character access checks. Hosted services receive these texts, sometimes in several batches. Each recall pass normally gets 10 to 25 seconds, sized to the model's speed. Both passes share 40 seconds per reply, so a pass can get less than 10 seconds. Memories with no answer in time fall back to ordinary recall. See [Optional Decision model](../agents/memory.md#optional-decision-model).

## Thresholds

Probabilities are not comparable between models. The same example can score 0.99 on one and 0.2 on another. The default yes-or-no threshold depends on the model:

- **Built-in model, or an OpenAI-compatible chat model account:** 0.5
- **TypeSafe, OpenRouter, or Custom System One account:** 0.5
- **Built-in decision model:** The model manifest's recommendation: 0.1 for the Open-Jev 2B and 9B

An agent's **Run when probability is at least** overrides this. The editor offers to restore the model's recommendation when the saved value differs. Check it whenever you switch models. Prompt statements and lorebook Decision fields use the model's default, and an agent's threshold does not change theirs.

A self-hosted Open-Jev behind a Custom System One account still uses 0.5, because Marinara cannot calibrate arbitrary custom endpoints. Its results can differ from the built-in Open-Jev, including reading a positive result below 0.5 as no.

## Time limits

A decision that does not arrive in time gives no answer, and generation continues with the feature's fallback (see [Where Marinara uses it](#where-marinara-uses-it)). Every limit is per statement. A request with several statements gets the limit for each, and each Choice answer counts as a statement. A local model works on only a few requests at a time, so statements wait their turn, and a statement's time starts when the model starts on it.

- **TypeSafe, OpenRouter, or Custom System One account:** 1.5 seconds, or your **Time limit**
- **OpenAI-compatible chat model account:** 4 seconds, or your **Time limit**. A model that must think first gets at least 20 seconds.
- **Built-in model:** 4 seconds. A model that must think first gets 20 seconds.
- **Built-in decision model:** 4 seconds for the first statement. Each further one gets the model's measured time: 0.35 seconds for Open-Jev 2B and 0.8 seconds for Open-Jev 9B. A model you installed from a repository gets 4 seconds for each.

Decision requests stop when you cancel a generation.

## Other settings

These sit in the **Decision settings** gear:

- **Also use it to pick who speaks in Smart response order** is off by default. See [Group Chats](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn** limits prompt and lorebook statement planning. Default 32, up to 255. The allowance applies at several stages and is not a single cap on all requests or spending in a turn. Agent activation questions and Smart response order are separate. See [Limits and cost](../prompts/conditional-prompts.md#limits-and-cost).
- **Also gate agents that run before the reply** and **Thinking** show for the Built-in model entries that can think. The **Built-in decision model** never reasons, so it has neither.

## Plan for wrong answers

Any model can answer wrongly, and correct yes answers can sit close to the threshold.

- Use a decision to fine-tune a reply, never for something the chat cannot do without. A missed decision should make a reply less tailored, not break it.
- Do not gate consent, content warnings, or safety instructions on a decision.
- For an agent that runs only on an activation question, set **Bypass the question after this many messages**, so a model that keeps answering no cannot silence it forever.

## Troubleshooting

- **The test fails.** The message says why: the key was rejected, the service is limiting requests, the built-in model is not running, the decision model is not installed, the model did not answer yes or no, or it ran out of time.
- **The server has no such endpoint.** The Decision source does not match the server. Ollama, LM Studio, and other chat model servers need **OpenAI-compatible chat model**. **Custom System One endpoint** is only for System One servers such as Open-Jev.
- **The answer was over the time limit, or decisions work only some of the time.** The service is slower than the **Time limit** at times. Test a few times and raise the limit above the slowest answer.
- **An agent with an activation question runs every turn.** No decision model is set or it is not answering, so the agent runs as if it had no question. Run a test.
- **A decision branch in a prompt never appears.** See [When a decision branch never appears](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **Smart response order still makes its usual AI call.** The switch is off, or the decision model did not answer on that turn.
- **Automate active characters follows the Character Tracker.** The model did not answer for every character, it thinks first and **Also gate agents that run before the reply** is off, or the cast is too big for the model's input even by name.

To see decision scores and outputs during generation, turn on Debug Mode or set the log level to debug. See [Logging levels](../CONFIGURATION.md#logging-levels). To test your own statements without generating a reply, open **Peek Prompt → Decision diagnostics → Test decisions**. Explicit tests call the selected model and can cost money on a hosted service. See [Testing decision statements](../chats/peek-prompt.md#testing-decision-statements).

## Let Marinara install a decision model

The **Built-in decision model** is an experimental, purpose-built decision model that Marinara downloads and runs as its own local process, beside your chat model. It adds its memory use to your chat model's. If you already have a local model, try its decisions first.

The Open-Jev models need Linux **x86-64**, an NVIDIA GPU of compute capability 7.5 or newer (Turing, the RTX 20 series, or later), and driver 580 or newer. Linux ARM and older cards are not supported. Where a model cannot run, the option stays visible, says why, and offers **Set up a Decision provider instead**.

| Model | Model download | Disk with runtime | GPU memory |
| --- | --- | --- | --- |
| Open-Jev 2B | About 4.6 GB | About 10 GB | About 4.8 GB (4.5 GiB) |
| Open-Jev 9B | About 19.4 GB | About 25.3 GB | About 23.6 GB (22 GiB) |

These are the catalog's estimates. The 9B model leaves little headroom on a 24 GB GPU. Check the installer's verdict for your card.

1. Click **Add** in the **Connections** panel and click **Built-in model (decisions)** under **Decisions**. A window titled **Built-in decision model** opens. You can also open it from the **Built-in model** card's page.
2. Read the warning, then turn on **Use the built-in decision model**. A dialog titled **Turn on the built-in decision model?** shows the verdict for your computer. Click **Enable**, or **Enable anyway** when the verdict is a warning.
3. Under **Available decision models**, pick **Open-Jev 2B** or **Open-Jev 9B**. Click **Download and install** and confirm the size, hardware verdict, and licenses. Nothing downloads before that.
4. Click the **Decision** row under **Behind the scenes** and pick **Built-in model (decisions)**.

Other controls in the window:

- **Install from a repository** takes a HuggingFace decision model as `owner/model-name`. Click **Check**. Marinara reads the repository's own manifest, checks that it maps to a runtime this build ships, and shows the base weights and total size. A repository it cannot vouch for is refused with the reason. Then click **Download and install this one**.
- **GPU** picks the card on a computer with several NVIDIA GPUs. Changing it stops the model, which starts again on the new card.
- **Start this model when Marinara starts** is optional. Off means it starts the first time an agent needs it.
- **Remove files** deletes the model and its runtime. Turning the model off stops the process and keeps the files.

A model's first answer after it starts is slower, so Marinara asks one warm-up question while it loads. If that fails, the model still starts and the first real question pays the delay. A turn with many statements on a long chat takes longer. Open-Jev 2B takes about a quarter of a second per statement on a long chat.

### Run Strands decider yourself

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) is another open decision model (Apache-2.0) that speaks System One. Marinara cannot install it, but it works as a **Custom System One endpoint** while you keep it running.

1. In a Python 3.10 or newer environment, install it and start its server:

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   It uses an NVIDIA GPU or Apple silicon when it finds one, and the processor otherwise, more slowly. The first start downloads the model and about 4.6 GB of base weights, and its Python packages take about 5.5 GB. The server has no password, so keep it on `127.0.0.1`.

2. Add an **Own decision server** account with the **Server address** `http://127.0.0.1:8000`. Any model name works.
3. Pick it on the **Decision** row, then test it with **Test** in the account's **⋯** menu. Its first answer after it starts takes about 2 seconds, longer than the default time limit, so test it once before you chat.

Its probabilities are calibrated, so the default 0.5 threshold suits it, unlike a self-hosted Open-Jev (see [Thresholds](#thresholds)). Its answers depend on wording, so follow [Writing statements](../prompts/conditional-prompts.md#writing-statements).

## Related guides

- [Creating Custom Agents](../agents/custom-agents.md)
- [Conditional Prompts](../prompts/conditional-prompts.md)
- [Group Chats](../chats/group-chats.md)
- [Built-in Model Setup](local-model.md)
- [Connecting to an AI Provider](connecting-to-a-provider.md)
