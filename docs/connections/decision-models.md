# Decision Models

A decision model is a small model that answers short questions about your chat for Marinara, such as "Does the latest message move the scene to a new place?" or "What is Kaelen's mood: angry, sad or calm?". Some can also look at the chat's pictures and clips. Lorebooks, custom agents, prompts, group chats and the Illustrator use it. It is optional. Without one, chats still work and each feature uses the fallback described in [Where Marinara uses it](#where-marinara-uses-it).

Its answers control what Marinara does and are never posted in the chat. See [What a decision model can answer](#what-a-decision-model-can-answer) for the kinds of questions and examples.

Our advice: leave it on **None** if you are unsure. If you want decisions, use the Built-in model you may already have, or a chat model on a server you already run. Both cost nothing extra.

## What a decision model can answer

Every answer comes back as a number from 0 to 1: how sure the model is. Marinara turns that number into the answer a feature needs.

### Yes or no

The model reads a statement and says how likely it is to be true. Marinara compares that with a [threshold](#thresholds): at or above it counts as yes. This is the most common kind, used by activation questions, lorebook **Decision** fields, `{{#if decision:"..."}}` and the Illustrator's checks.

| Statement                                                            | What it could switch                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `In the latest message, the characters move to a different location` | A tracker updates the location only on turns where it changed. |
| `In the latest message, a dragon is physically present`              | A lorebook entry about dragons joins the prompt.               |
| `{{user}} asked a question that {{char}} has not answered yet`       | A prompt line reminds the model to answer it.                  |
| `The latest message describes a fight`                               | A combat agent runs on this turn only.                         |

### One of several answers

The model picks the best fit from a short list you write. Marinara asks about every option and keeps the one with the highest score, so you get one answer, not several. Use `{{#if decision_choice:"..." == "..."}}`:

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen speaks in short, clipped sentences.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and avoids eye contact.
{{else if decision_choice:"Kaelen's mood in the latest message" == "calm"}}
Kaelen speaks normally.
{{/if}}
```

Other lists that work well: the kind of scene (`combat`, `dialogue`, `exploration`, `rest`), the time of day (`morning`, `afternoon`, `evening`, `night`), or which room of a house the scene is in. Keep the options distinct, and add one such as `none of these` when nothing may fit. Agents use the same thing to pick one of several instruction sets, and the Illustrator uses it to pick the kind of weather.

### A score

Some features use the number itself instead of a yes or no. [Smart response order](../chats/group-chats.md#response-order-individual-only) scores how likely each character is to speak next and picks the highest. [Advanced Memory](../agents/memory.md#optional-decision-model) scores how relevant each past scene is. Peek Prompt's **Test decisions** shows the score of every statement, which helps you choose a threshold. See [Testing decision statements](../chats/peek-prompt.md#testing-decision-statements).

### Pictures and clips

A built-in decision model that reads pictures can answer the same kinds of questions about the chat's pictures, such as `The picture shows the character at the beach`. Liquid d1, Valen and Winnow read pictures, and Valen's full release also reads short clips. Other models, and every hosted or server account, read text only and are never sent pictures.

Pictures are never sent unless you ask for them, because each one makes the answer slower:

- In a statement, add `pictures:1` (up to 3) or `clips:1`. Add `media_within:2` to ask only when one of the newest 2 messages has a picture. See [Pictures and clips](../prompts/conditional-prompts.md#pictures-and-clips).
- On a lorebook entry, set **Show the decision model** under its **Decision** field. See [Decision activation](../lorebooks/entries.md#decision-activation).
- On a custom agent's activation question, set **Show the decision model**. See [Activation questions](../agents/custom-agents.md#activation-questions).
- Marinara's own picture features: see [Features that look at pictures](#features-that-look-at-pictures).

### What a model page lists

The page of each built-in decision model shows two lines:

- **Answers** lists what the model was built to answer: **Yes/no**, **Weighted choice**, **Score on a scale**, and for some, **Boxes on a picture** (where something is in a picture). Marinara asks yes-or-no and choice questions and reads their scores. It does not ask for boxes yet, so that line only describes the model.
- **Reads** lists **Text**, **Pictures** and **Video**. A kind that only another release of the model reads is named after the others, for example "Video in its full release".

## Choose a decision model

Before you start, see [Which one to pick](#which-one-to-pick).

1. Click **Connections** in the top bar and open the **Jobs** box.
2. Under **Behind the scenes**, click the **Decision** row. A list opens.
3. Pick a model. The list has three groups:
   - **None (decisions off)** is the default. Nothing is asked, and the activation question fields in the agent editor stay disabled.
   - **Built-in model** lists the models Marinara runs on your computer: **Built-in model**, **Built-in model (utility)**, and **Built-in model (decisions)**. Nothing leaves your computer.
   - **Connections** lists your accounts that can answer decisions: hosted, or a chat model on a server you already run.

   Click an account on the left to browse its models. A NanoGPT, OpenRouter, or Google Gemini account lists its own decision models first, under **Decision models**, and its chat models below them, under **Chat models**. A Google Gemini account lists only its decision models, since its chat models cannot answer decisions. A decision model you picked earlier shows above **Starred**, with its account's name under it.

4. To test it, click the **Decision settings** gear on the row and click **Test**. That button shows for the Built-in model entries. For a TypeSafe, OpenRouter, NanoGPT, or Google Gemini decision model, open **Edit model** on it and click **Test provider**. For an **Own decision server** account, use **Test** in the account's **⋯** menu.

A passing test shows the probability of yes and how long the answer took. For a model on your computer it also says whether log-probabilities were available and whether the model answers directly. Log-probabilities are the model's confidence numbers for each word it could write. The test sends a fixed sample, not your chat.

If it did not work, the message says why. Common causes: the key was rejected, the service is limiting requests, the built-in model is not running, or the answer was over the time limit. See [Troubleshooting](#troubleshooting).

Entries that cannot answer right now stay in the list, gray, with the reason. Choosing **None** turns decisions off without deleting any activation question or decision statement.

### Which one to pick

- **A model you already run in the Built-in model.** Costs nothing extra. Best for most people who use the Built-in model.
- **A chat model on your own server** (Ollama, LM Studio, llama.cpp, or another OpenAI-compatible server). Costs nothing extra. Good when your model runs outside Marinara, so it is not loaded twice.
- **A hosted decision model** (TypeSafe, OpenRouter, NanoGPT, or Google Gemini). Billed per request, and one turn can make several. A NanoGPT subscription includes some decision models, and OpenRouter lists some free ones. Good for phones and computers that run no local model.
- **The Built-in decision model.** A purpose-built decision model that Marinara downloads and runs beside your chat model, with its own disk space and memory. Most of them run on almost any computer, some on the processor alone. The only choice that can look at pictures and clips. See [Let Marinara install a decision model](#let-marinara-install-a-decision-model).

If you already run a local model, try it first, and test turns from your own chats. Wording matters a lot. See [Writing statements](../prompts/conditional-prompts.md#writing-statements).

Jev and Open-Jev are different models. Jev is TypeSafe's hosted model, available directly or through OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) is a separately published model built on Qwen, which Marinara can run locally. The Open-Jev tests do not measure hosted Jev.

On Android (Termux), only JevK5 and Liquid d1 are offered as the **Built-in decision model**, and a phone's processor can be too slow for them. A hosted account is the practical choice, for example Jev through OpenRouter. See [Set up a Decision account](#set-up-a-decision-account).

Write presets, cards, and agents for "a decision model", never "requires Jev". A statement that asks for pictures still works with a model that reads only text: it gets the text alone. They use the same statement syntax with any model, but models can give different answers. When you import content that uses decisions, including custom agents and Agent Organizer installs, Marinara shows a notice that links here. Restoring a whole profile ZIP does not show it.

## Use the Built-in model

If you have the Built-in model downloaded, you can use it for decisions with no account and no cost. See [Built-in Model Setup](local-model.md).

1. Click the **Decision** row under **Behind the scenes** in the **Jobs** box.
2. Pick **Built-in model** (or **Built-in model (utility)** if you have one).
3. Click the **Decision settings** gear, then click **Test**.

Marinara asks the model one yes-or-no question, lets it write one token, and reads the answer from that token's probabilities. No reply is written, so the request is short. A choice between several answers is asked as one yes-or-no question per answer.

The **Thinking** setting controls what happens when a model cannot answer in one word. Some models always reason first.

| Thinking                                                    | What it does                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Auto (try one word, allow thinking if the model cannot)** | Default. After two failed one-word answers in a row, the model is allowed to think first, and Marinara tells you. |
| **Off (always answer in one word)**                         | A model that cannot answer in one word gives no answer.                                                           |
| **Allowed (let the model think first)**                     | Never asks the model to skip reasoning.                                                                           |

A model that thinks first takes seconds, so by default it answers only for checks that run after the reply is on screen, such as post-processing agents. To make it also gate agents that run before the reply, turn on **Also gate agents that run before the reply**. Every reply then waits for it.

A general chat model's yes-or-no probabilities work for a threshold, but they were not trained to be calibrated like a purpose-built decision model's. A runtime that returns no log-probabilities answers a flat 1 or 0. Tune thresholds against your own chats.

### On a server you already run

If your chat model runs in Ollama, LM Studio, llama.cpp, or another OpenAI-compatible server, it can answer decisions without Marinara loading a second copy.

1. Click the **Decision** row under **Behind the scenes** in the **Jobs** box. The picker lists the models of every account, including your chat model. Or click **⋯** on the model and choose **Use for…** → **Decision**.
2. Click the gear of the **Decision** row, then click **Test**. A passing test says whether the server returned log-probabilities and whether the model had to think first. Click **Done**.
   You can also create one yourself. Use a Decision account with the source **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**, the same address as your chat account (for example `http://localhost:11434/v1` for Ollama), and the model name the server uses.

It is asked like the Built-in model: one yes-or-no word per statement. Statements go one at a time, because Marinara cannot know how many requests your server handles at once. **Thinking** is always **Auto** for an account. A server on another computer needs `PROVIDER_LOCAL_URLS_ENABLED`. See [Connecting a Local or Self-Hosted Model](local-self-hosted.md).

## Set up a Decision account

A hosted Decision account sends the selected recent messages and statements to the service and can cost money. Smart response order also sends a [character roster](#what-the-model-sees).

1. Click **Connections** in the top bar, then click **Add**.
2. Click **Decision** in the type chips, then click **TypeSafe** or **Own decision server**. For NanoGPT, see [Through NanoGPT](#through-nanogpt). For OpenRouter or Google Gemini, see [Through OpenRouter or Google Gemini](#through-openrouter-or-google-gemini).
3. Enter the **API key**, or for **Own decision server** the **Server address**. Click **Connect**.
4. Under **Found in TypeSafe — use it for:**, tick **Decision**, then click **Done**. The **Decision** row under **Behind the scenes** in the **Jobs** box now shows the model.
5. To test it, click the model in the panel to open **Edit model**, then click **Test provider** in the **Provider tests** card. An **Own decision server** model has no **Test provider** button there. Open the account's **⋯** menu in the panel and click **Test** instead.

A passing **Test provider** shows the probability, how long the answer took, and the account's time limit. The account's **Test** in the **⋯** menu only says whether it worked and how long it took. The test waits at least 10 seconds, or 5 seconds past a longer limit. If the answer took longer than the limit, the result says so: in chats that answer would count as no answer.

If it did not work, see [Troubleshooting](#troubleshooting).

A decision model has these fields. Click the model in the panel to open **Edit model**, or click the gear on the **Decision** row in the **Jobs** box to open **Decision settings** for the current decision model:

| Field                           | What it does                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decision source**             | **TypeSafe**, **OpenRouter**, **NanoGPT**, **Google Gemini**, **Custom System One endpoint**, or **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. It is fixed when you create the model.                                                                                                                                                                                                                                 |
| **API key source**              | **Enter a separate key (optional for local servers)** or **Use key from …** another account. Linked keys follow later key changes. A custom System One or OpenAI-compatible model can borrow a custom chat account's key only when both addresses have the same scheme, host, and port.                                                                                                                                                  |
| **Recent-message token budget** | How many estimated tokens of chat to send. 1 to 30,000. Default 30,000 for TypeSafe, OpenRouter, NanoGPT, and Google Gemini, and 3,500 for custom servers. A decision model from a NanoGPT, OpenRouter, or Google Gemini account with a smaller input limit gets three quarters of it instead. Marinara drops older messages first, then trims the oldest part of the newest message. A rejected or over-budget request gives no answer. |
| **Time limit (seconds)**        | How long to wait for each statement during chats. 0.5 to 30. Default 1.5, or 4 for NanoGPT and for an OpenAI-compatible chat model. See [Time limits](#time-limits).                                                                                                                                                                                                                                                                     |
| **Custom Request Headers**      | Extra headers sent with every decision request, as a JSON object, for example `{"x-billing-mode": "paygo"}`. Not for keys: authentication headers are rejected.                                                                                                                                                                                                                                                                          |

TypeSafe sends to `https://api.typesafe.ai`. You can replace its **Base URL** with another server that runs TypeSafe's API, without `/v1/systemone`. It still needs your TypeSafe key, which goes to that server. **Custom System One endpoint** accepts a System One server you run, such as Open-Jev or [Strands decider](#run-strands-decider-yourself). Enter its address without `/v1/systemone`. A chat model server such as Ollama does not speak System One. Use **OpenAI-compatible chat model** for it.

### Through NanoGPT

NanoGPT lists its own decision models, such as Jev Latest, and answers them at its Decisions API with your NanoGPT key. Some are included in a NanoGPT subscription; the rest bill to your balance.

1. Connect NanoGPT as usual. In **Add**, the **Decision** type chip lists it too.
2. Under **Found in NanoGPT — use it for:**, tick **Decision**. Marinara picks a decision model included in your plan, Jev Latest first.
3. To pick another one, click **⋯** on the NanoGPT account, click **Add model**, then the **Decision** tab. It lists only decision models. A **Plan** pill marks the ones in your subscription. Select one and click **Test decision**.

Decision models are left out of every chat model list, since they cannot chat.

By default, NanoGPT decides whether a request uses your subscription or your balance. To always use the balance, open **Edit model** on the decision model and enter `{"x-billing-mode": "paygo"}` in **Custom Request Headers**.

### Through OpenRouter or Google Gemini

OpenRouter and Google Gemini accounts list their own decision models too, and Marinara asks them at the service's decision API with that account's key. OpenRouter lists many, some of them free (their names end in `:free`). Google Gemini lists one, **Gemini Decision 1**.

1. Connect OpenRouter or Google Gemini as usual.
2. Click the **Decision** row under **Behind the scenes** in the **Jobs** box, then click the account on the left. Pick a model under **Decision models**.
3. To test it, open **Edit model** on it and click **Test provider**.

On an OpenRouter account, the chat models that return log-probabilities follow under **Chat models** and work too. A Google Gemini account offers only its decision model.

An account added before this version may show no **Decision models** at first, because its saved model list predates them. Click the refresh button in the picker, or wait: Marinara refreshes saved model lists once a day.

A standalone **OpenRouter** decision account made in **Add** keeps working. It asks the same API with its own key.

Some hosted services answer slower than 1.5 seconds at times, which makes decisions look randomly broken. Test a few times and set the limit above the slowest answer. Statements asked before the reply, such as a preset's decisions or an activation question for an agent that runs before the reply, can hold up the reply for up to that long each.

Deleting an account whose key is used for decisions shows a warning. The Decision account then needs relinking, and until then decisions give no answer. Imported connection files never contain API keys or borrowed account links, so restore them by hand.

## Where Marinara uses it

- [Activation questions](../agents/custom-agents.md#activation-questions) decide whether a custom agent runs. Without an answer: the question does not stop it. Keywords and **Trigger Cadence** still apply.
- [Prompt statements](../prompts/conditional-prompts.md#asking-the-decision-model) choose text when a chat or agent prompt is built. Without an answer: the decision reads as no, so a decision block uses its `{{else}}` branch if there is one.
- [Lorebook Decision fields](../lorebooks/entries.md#decision-activation) check Require or Trigger during the lorebook scan. Without an answer: require cannot admit a new entry and Trigger adds no route. Sticky holds and ordinary Trigger routes still apply.
- [Smart response order](../chats/group-chats.md#response-order-individual-only) scores who speaks next in a group chat, if turned on. Without an answer: smart order makes its usual AI call.
- [Automate active characters](../chats/group-chats.md#automate-active-characters-merged-only) asks who is in the scene before each reply in a Merged Roleplay group, if set to **Decision model**. Without an answer: if no character gets an answer, it uses the Character Tracker's last scene, or keeps the list.
- [Advanced Memory Recall](../agents/memory.md#optional-decision-model) can use its own decision model for Roleplay scene boundaries and memory selection. Turn on **Use Decision model** in that chat's Advanced Memory settings. Without an answer: failed decisions fall back to ordinary recall or scene checks. Summaries still use the Helper model.

- [Features that look at pictures](#features-that-look-at-pictures) check new pictures, skip repeats, reuse backgrounds and flag sprite faces, if turned on. They need a decision model that reads pictures.

An activation question decides whether an agent runs. A decision statement inside its prompt decides what that running agent is told. Use `{{#if decision:"..."}}` for yes-or-no conditions and `{{#if decision_choice:"..." == "..."}}` for a choice among answers.

### Features that look at pictures

These need a built-in decision model that reads pictures (Liquid d1, Valen or Winnow). They are all off until you turn them on. Without such a model they are greyed out, with an ⓘ that says why. One you turned on earlier can still be turned off.

| Feature                                                  | Where                                         | What it does                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Picture check**                                        | **Chat Settings → Agents → Illustrator**      | Looks at each new Illustrator picture and selfie, and checks that it shows what was asked. A selfie is also compared with the character's avatar. **Make another if it doesn't match** draws once more after a miss. **Always make two, keep the better** draws two and keeps the one that matches better. Each extra picture costs another image generation. |
| **Also check**                                           | Under **Picture check**                       | Your own checks, one per line, up to 6, such as `Kaelen has short red hair`. Start a line with `not:` for something the picture must not show, such as `not: The picture has writing or a watermark`.                                                                                                                                                         |
| **Skip a picture the newest one already shows**          | Illustrator card                              | Before drawing, compares the newest picture in the chat with what is about to be drawn, and skips it when it would show the same scene again. Pictures you ask for are always made.                                                                                                                                                                           |
| **Reuse a library background that looks like the place** | Illustrator card                              | When no background in your library is named for a new place, looks at up to 4 that share words with it and shows one that matches, instead of painting a new one. See [Check pictures with a decision model](../media/illustrator-agent.md#check-pictures-with-a-decision-model).                                                                             |
| **Flag faces that don't match their expression**         | **Generate Sprites** window, expressions only | Looks at each face after it is drawn and marks any that may not show its expression, so you can untick or redraw it. See [Generate sprites with AI](../characters/sprites.md#generate-sprites-with-ai).                                                                                                                                                       |

A check that cannot run, because the model is off, slow or fails, counts as a pass: the picture is kept as it was made.

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
- **TypeSafe, OpenRouter, NanoGPT, Google Gemini, or Custom System One account:** 0.5
- **Built-in decision model:** The model's own recommendation, measured on roleplay turns where we could: 0.3 for JevK5, Liquid d1 and Valen-Decision 1.5 4B; 0.5 for Valen's full release and Winnow (not yet measured); 0.1 for Open-Jev 2B and 9B

An agent's **Run when probability is at least** overrides this. The editor offers to restore the model's recommendation when the saved value differs. Check it whenever you switch models. Prompt statements and lorebook Decision fields use the model's default, and an agent's threshold does not change theirs.

A self-hosted Open-Jev behind a Custom System One account still uses 0.5, because Marinara cannot calibrate arbitrary custom endpoints. Its results can differ from the built-in Open-Jev, including reading a positive result below 0.5 as no.

## Time limits

A decision that does not arrive in time gives no answer, and generation continues with the feature's fallback (see [Where Marinara uses it](#where-marinara-uses-it)). Every limit is per statement. A request with several statements gets the limit for each, and each Choice answer counts as a statement. A local model works on only a few requests at a time, so statements wait their turn, and a statement's time starts when the model starts on it.

- **TypeSafe, OpenRouter, Google Gemini, or Custom System One account:** 1.5 seconds, or your **Time limit**. OpenRouter and Google Gemini answered in 0.2 to 0.5 seconds when measured.
- **NanoGPT decision model:** 4 seconds, or your **Time limit**. It answered in 0.4 to 2.5 seconds when measured.
- **OpenAI-compatible chat model account:** 4 seconds, or your **Time limit**. A model that must think first gets at least 20 seconds.
- **Built-in model:** 4 seconds. A model that must think first gets 20 seconds.
- **Built-in decision model:** Open-Jev gets 4 seconds for the first statement, and each further one gets its measured time: 0.35 seconds for 2B and 0.8 seconds for 9B. The other models time their reading speed each time they start, and their limits follow it, so a slow processor gets more time. Each picture or clip a statement asks for adds time on top. Until the model has started once, it gets 4 seconds for each statement and 30 seconds for each picture and 60 for each clip.

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
- **An account shows no Decision models in the picker.** Its saved model list is older than its decision models. Click the refresh button next to the account's name in the picker.
- **The server has no such endpoint.** The Decision source does not match the server. Ollama, LM Studio, and other chat model servers need **OpenAI-compatible chat model**. **Custom System One endpoint** is only for System One servers such as Open-Jev.
- **The answer was over the time limit, or decisions work only some of the time.** The service is slower than the **Time limit** at times. Test a few times and raise the limit above the slowest answer.
- **An agent with an activation question runs every turn.** No decision model is set or it is not answering, so the agent runs as if it had no question. Run a test.
- **A decision branch in a prompt never appears.** See [When a decision branch never appears](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **Smart response order still makes its usual AI call.** The switch is off, or the decision model did not answer on that turn.
- **Picture settings are greyed out with an ⓘ.** The selected decision model reads text only, or no decision model is set. Pick Liquid d1, Valen or Winnow as the **Built-in decision model**. See [Which built-in decision model](#which-built-in-decision-model).
- **A statement with `pictures:` reads as no.** With `media_within:`, none of the newest messages had a picture. Otherwise the picture made the answer slower than its time limit. The model page's **On this computer** line shows how long a picture takes.
- **A model says it cannot run here.** The reason under the list names what is missing, such as a processor feature, a graphics card generation or a library. Pick another model; Liquid d1 and JevK5 run on almost any computer.
- **Automate active characters follows the Character Tracker.** The model did not answer for every character, it thinks first and **Also gate agents that run before the reply** is off, or the cast is too big for the model's input even by name.

To see decision scores and outputs during generation, turn on Debug Mode or set the log level to debug. See [Logging levels](../CONFIGURATION.md#logging-levels). To test your own statements without generating a reply, open **Peek Prompt → Decision diagnostics → Test decisions**. Explicit tests call the selected model and can cost money on a hosted service. See [Testing decision statements](../chats/peek-prompt.md#testing-decision-statements).

## Let Marinara install a decision model

The **Built-in decision model** is a purpose-built decision model that Marinara downloads and runs on your computer, beside your chat model. Nothing leaves your computer. It adds its memory use to your chat model's. If you already run a local model, try its decisions first.

### Which built-in decision model

| Model                                    | Download      | Reads                 | Languages                                                            | Runs on                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------- | --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JevK5 4B**                             | About 2.7 GB  | Text                  | English                                                              | Almost any computer: NVIDIA, AMD, Intel or Apple graphics, or the processor alone. Uses the same runtime as the Built-in model.                                                                                           |
| **JevK5 2B**                             | About 2 GB    | Text                  | English                                                              | Same as 4B. Faster on a processor or a small graphics card, a little less accurate.                                                                                                                                       |
| **Liquid d1 3B**                         | About 2.3 GB  | Text, pictures        | 16, including Japanese, Chinese, Korean, German, Spanish and Russian | Almost any computer. The pick for chats that are not in English. Free for people and for companies under $10 million a year in revenue.                                                                                   |
| **Valen-Decision 1.5 4B**                | About 5.8 GB  | Text, pictures        | 8 checked                                                            | Linux on a 64-bit Intel or AMD processor, on the processor only.                                                                                                                                                          |
| **Valen-Decision 1.5 2B (full release)** | About 6.4 GB  | Text, pictures, clips | Not stated                                                           | Windows, macOS on Apple silicon, and Linux, on the processor. Needs about 6 GB of memory.                                                                                                                                 |
| **Valen-Decision 1.5 4B (full release)** | About 11.8 GB | Text, pictures, clips | 8 checked                                                            | Same as 2B. Needs about 12 GB of memory, and is slower but more accurate.                                                                                                                                                 |
| **Winnow E4B**                           | About 9 GB    | Text, pictures        | Not stated                                                           | Only Linux with an NVIDIA RTX 50-series card, the CUDA 13 libraries, and a processor with AVX-512 (such as AMD Ryzen 7000 or 9000; current Intel laptop and desktop chips lack it). Needs about 11 GB of graphics memory. |
| **Open-Jev 2B**                          | About 4.6 GB  | Text                  | English                                                              | Linux with an NVIDIA card from the RTX 20 series or newer and driver 580 or newer. Uses about 4.8 GB of graphics memory and 10 GB of disk.                                                                                |
| **Open-Jev 9B**                          | About 19.4 GB | Text                  | English                                                              | Same as 2B. Uses about 23.6 GB of graphics memory, so on a 24 GB card nothing else fits beside it.                                                                                                                        |

On 20 roleplay turns in 8 languages, JevK5 4B, Liquid d1 and Valen-Decision 1.5 4B answered all 20 correctly. Pick Liquid d1 if you are unsure, or Valen's full release if you want clips read.

Before anything downloads, Marinara checks that your computer can run the model: the system, the processor's features, the graphics card and its libraries, and the free memory. A model that cannot run stays in the list, marked **(cannot run here)**, and says why.

### Install one

1. Click **Connections** in the top bar. Under **On this device**, click **Built-in model (decisions)**. You can also click **Add** in the **Connections** panel and click **Built-in model (decisions)** under **Decisions**.
2. Pick a model in the **Model** list. Under it you see its description, then **Answers** and **Reads** (see [What a model page lists](#what-a-model-page-lists)), its languages and licenses.
3. Click **Download** with the model's name and size. Confirm the size, hardware verdict and licenses. Nothing downloads before that.
4. Click **Use for Decision**, or click the **Decision** row under **Behind the scenes** in the **Jobs** box and pick **Built-in model (decisions)**.

Once a model has run, its page also shows **On this computer** with how long it took there: a few turns of chat, a picture, and a clip for models that read them. These times come from your own computer, so they tell you how much slower a statement gets when it asks for a picture.

To switch, pick another model in the list. A model you downloaded before is marked **(downloaded)**, and **Use this model** switches to it without downloading again.

Other controls on the page:

- **Turn off** stops the model and keeps its files. **Turn on** starts it again.
- **Runs on** picks the card on a computer with several NVIDIA cards. Changing it stops the model, which starts again on the new card.
- **Starts** is **When an agent first needs it** by default, or **With Marinara**.
- **Install from a repository** takes a decision model on Hugging Face as `owner/model-name`: an Open-Jev checkpoint, a GGUF that declares itself a decision model, or a Valen GGUF package. Add `:Q8_0` after the name to pick one size of a GGUF. Click **Check**. Marinara reads what the files say about themselves and shows the size and licenses. A repository it cannot vouch for is refused with the reason. Then click **Download and install this one**.
- **Remove files** deletes the model and its runtime.
- **Reinstall** appears when the installed model cannot start because its files or its runtime are missing or out of date, usually after an update. The model is marked **Needs reinstall**. Reinstalling keeps the files that are already downloaded and whole, so usually only the runtime downloads again.

A model's first answer after it starts is slower, so Marinara asks one warm-up question while it loads. If that fails, the model still starts and the first real question pays the delay. If the model stops right after starting, the page says why, for example that the processor lacks a feature it needs.

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
