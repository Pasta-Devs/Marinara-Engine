# Professor Mari, Your In-App Assistant

Professor Mari is the built-in assistant on the Home screen. She explains the app, helps you set it up, and creates or edits characters, personas, lorebooks and presets for you. You can undo her changes from the change card for a limited time (see [Reviewing her changes](#reviewing-her-changes)).

## Where to find her

1. Go to the Home screen. It shows when no chat is open.
2. Click **Ask Professor Mari** in the **Professor Mari** widget, or click the **Professor** tab.

Her window opens. You can also reach her from any screen: type in Search and pick **Ask Prof. Mari**, press <kbd>Ctrl</kbd>+<kbd>J</kbd> (<kbd>⌘</kbd>+<kbd>J</kbd> on a Mac), or pull down from the top bar on a phone. Her header reads **Ready to help** when she is idle and **Working on it...** while she works.

Type your message in plain language and press <kbd>Enter</kbd>. <kbd>Shift</kbd>+<kbd>Enter</kbd> adds a new line. If you turn off **Enter sends to Professor Mari** in her settings, <kbd>Enter</kbd> adds a new line and <kbd>Ctrl</kbd>+<kbd>Enter</kbd> sends. Your first message unlocks the **Hello World** achievement.

All her settings are under **Settings → General → Search and Professor Mari settings → Open**, or the gear in Search. On a computer, the **Height** and **Width** sliders under **Professor Mari window** resize her window. On a phone, her window fills the screen.

## Make a character with Mari

Before you start: add an account for text generation. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md) and [Pick an account for her](#pick-an-account-for-her).

1. Open her window (see above).
2. If the chat already has messages, click **New chat** first. The current chat is saved in **Chats**.
3. Click the **Create a character** chip. It fills the message box. If no chip shows, type your request instead.
4. Add your idea to the text, for example the name and personality, then press <kbd>Enter</kbd>.
5. Answer her questions. Pick an option or type your own, then click **Submit**.
6. When she finishes, click **Open** on the result to see the new character.
7. If you do not like a change, click **Undo** on its change card.

If it did not work: with no account added, the **Connections** list opens when you press send. Pick or add an account there.

## What she can do

She reads an item before she edits it, and she asks when your request is vague.

- Explain a setting, a mode or a concept.
- Create or edit a character, a persona or a lorebook. A character card gives the AI a name, personality and voice. A persona is the character card that stands for you. A lorebook is a set of world facts the AI reads when their keywords come up.
- Write a character's [interactive onboarding](../characters/interactive-onboarding.md), and fill a [ruleset sheet](../characters/colors-and-stats.md#ruleset-sheets) for an installed Game Mode ruleset. She is refused, with a reason, when a value does not fit the ruleset.
- Create or edit a theme, an agent, a prompt preset or a Personal Extension draft. A draft stays off until you read its code and approve it in **Settings → Addons**.
- Edit one section of a preset in place, instead of replacing the whole preset.
- Compare the downloadable agents and tell you which fit your goal. She sends you to **Agents → Agent Organizer** to install them. See [Downloadable Agents Reference](../agents/built-in-agents.md).
- Make or assign images such as avatars, sprites and backgrounds. You need an image generation account first. She does not create one.
- Look up public Fandom wiki pages when you research a character or world.

### Start with a chip

On an empty Professor Mari chat, starter chips help you begin: **Create a character**, **Create a lorebook** and **Create a persona**. Click a chip to fill the message box, then edit the text before you send. During a guided task, the chips change to fit the next step. Chips show only in Professor Mari chats.

When your request leaves real choices open, she can ask on a question card under her reply: up to four questions, one at a time, with options and her recommendation marked. Pick an option or type your own, then click **Submit**. Your answers go as your next message. You can also ignore the card and type a message instead. Nothing she proposed alongside the question runs until you answer.

### Ask from the place you are working

These places open her with an editable draft and a small **Context** chip (a label above the message box) that you can remove before you send:

- The **Character**, **Persona**, **Lorebook** and **Preset** editors.
- **FAQ** answers: **Ask Prof. Mari about this**.
- Search: pick a result, then **Ask Prof. Mari**.
- Error states such as **Try again**: **Ask Professor Mari**.

She does not receive a whole item only because you opened its editor.

## Pick an account for her

Before you start: add an account for text generation. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. Click the connection button next to the paperclip. It shows the name of her account, or **Select connection** when none is picked.
2. Pick a text generation account from the **Connections** list. If you downloaded the **Built-in model**, it shows here too.
3. Click a model in the list to use it. The model is saved to the account, so your other chats on that account switch too. The **Built-in model** has no model list.

On a phone, tap an account to use it, or tap the arrow at the end of its row to see its models first. With no accounts yet, the list shows **Add a connection**.

## Reviewing her changes

When she changes something, she saves it at once and shows a change card under her answer. The card lists each field that changed. A text edit shows the old and new words. **Show all** shows every field, and **Technical details** shows the raw command.

The card has one action: **Undo**. It puts back the previous saved version. While its undo copy is kept, every change can be undone in every permissions mode. The permissions mode only decides whether she asks first.

- **Not saved** with a reason means the change failed. **Try again** asks her again.
- **Undo until** shows only in the last 24 hours. An undo copy lasts up to 14 days, and only the newest 50 are kept. After that, the card reads **Undo closed** and the change stays.
- A step in her work list that ends in **· not saved** was only a preview. Nothing changed.
- An edit that would change nothing is not saved and gets no card.
- Characters and personas also keep a version history in their editors, as a second way back.
- She cannot edit or delete her own card. Marinara resets it on every start.

A card belongs to the chat where she made the change. Deleting a chat keeps its changes and removes its cards.

### Changes that wait for you

A held change waits instead of being saved. It shows **Apply** and **Don't apply**. A delete shows **Delete** and **Put back**. Changes are held in Manual mode, and for sensitive files and dependencies (see [Held changes for files and libraries](#held-changes-for-files-and-libraries)). Search does not list her changes: open Professor Mari to apply or undo them.

When she creates or updates a character, persona, lorebook or preset, the result can show **Open**, which opens that item. An updated result can also show **Review** while a review is pending.

## The paperclip menu

Click the paperclip button, labeled **Attach**. It has three sections.

| Section | Items |
| --- | --- |
| **Attach** | **Attach files or photos**, **Add chat history** (share one of your past chats), **View attached context** |
| **Reference** | **Link with @** |
| **Mari** | **New chat**, **Chat history**, **Skills**, **Memories**, **Model**, **Permissions**. **Pending approvals** shows while a change waits for you. |

You can type the same actions with `/`. See [Commands with /](#commands-with-).

### Attach files

Choose **Attach files or photos**, or type `/attach`. She accepts images, PDF files and text files such as `.txt`, `.md`, `.json`, `.csv` and `.log`, up to 20 MB each. You can also paste a screenshot or file into the message box. To have her read an image, the selected model must support image input.

### Link items with @

Type `@` to point her at something in your library. A list opens, grouped into **Characters**, **Personas**, **Lorebooks**, **Presets**, **Skills**, **Memories**, **Chats**, **Agents** and **Docs**. Keep typing to narrow it. Names with spaces need no quotes.

- Use the arrow keys to move, <kbd>Enter</kbd> or <kbd>Tab</kbd> to pick, and <kbd>Escape</kbd> to close. On a lorebook, the right arrow lists its **Entries** so you can link one entry.
- Beside an editor, the first row, **Open beside me**, links what the editor has open. Beside the character editor, its › (or the right arrow) lists the **Fields**. Picking a field switches the field she works on and replaces the field chip in her context row.
- A picked name shows as a chip above the message box. Delete the name and the link goes with it. The chip's **×** removes the link and keeps your text.
- In ordinary text, <kbd>Tab</kbd> completes a name she suggests in grey. Press <kbd>Tab</kbd> again to link it. On a touch screen, tap the grey name, then **Tap to link**.

| Link | What she gets |
| --- | --- |
| Character, persona, preset | The whole item |
| Lorebook | Its settings and its list of entries |
| Lorebook entry | The entry and the lorebook it belongs to |
| Skill | Your skill's instructions. A built-in skill opens as her handbook for that message. |
| Memory | The memory's full text, even when it is off |
| Chat | The chat's details and its newest 30 messages |
| Agent | The agent's settings |
| Doc | The whole page from this documentation |

A link is sent once, with the message you add it in. After that she sees a one-line note and reads the item again if she needs it. One message carries up to 8 links. If they add up to more than about a quarter of the model's context, at most 60,000 characters, the last ones are not sent. She gets a note instead and can read them herself. Linked items count as information, never as instructions.

### Commands with /

Type `/` at the start of a line to list her commands. Keep typing to filter, then press <kbd>Enter</kbd>. The list also shows your Skills and Memories. Picking one links it, like `@`.

| Command | What it does |
| --- | --- |
| `/new` | Start a new chat and save the current one (`/restart` also works) |
| `/history` | Open your past chats with her |
| `/skills` | Open the **Skills** panel |
| `/memories` | Open the **Memories** panel |
| `/context` | See what is attached to this chat |
| `/attach` | Pick files or photos to send |
| `/model` | Choose the account she uses |
| `/permissions` | Choose what she may change |
| `/approvals` | Open changes waiting for you (only while one is pending) |

## Sending messages while she works

The message box stays open while she works. You choose when your message reaches her.

- **Send now** goes in at her next step without stopping her. Her reply so far is saved, your message appears below it, and she continues with it in mind.
- **Send after her answer** waits in a list above the box, marked **Sends when she finishes**. She takes waiting messages one at a time when she finishes cleanly.

- **Enter sends** on (default): <kbd>Enter</kbd> sends now. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> queues.
- **Enter sends** off: <kbd>Ctrl</kbd>+<kbd>Enter</kbd> sends now. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd> queues.

On a Mac, use <kbd>⌘</kbd> in place of <kbd>Ctrl</kbd>. While she works, an empty message box shows only a **Stop** button, which cancels the current task. When you type, **Stop** changes to the send button. Click it to pick **Send now** or **Send after her answer**, which helps on a phone.

Send now is for words only. A message with files, `@` links or a handed-over field is queued instead. So is a message about a different subject, or one sent after you changed the permissions mode. A short notice says so. Click the **X** on a message to remove it. A chat holds up to 20 waiting messages.

Waiting messages do not send by themselves in these cases:

- **You press Stop.** They return to the message box.
- **She waits for you** (an approval or an answer), **the run failed, or the app restarted.** They show **Held** with a **Send** button. **Send** sends only that one.

`/restart` and `/title` do nothing while she works. They stay in the box until she is done.

On a longer job she keeps a to-do list under her latest message, with a count such as **2 of 5**. You cannot edit it. After you write a new message, it shows muted as **Plan from before your last message**.

## Find your Professor Mari chats

Her chats are separate from your normal chat list.

1. Click **Chats** in her header.
2. Use **Search Prof. Mari chats** to find one. Click a chat to open it, rename it or delete it.

Click **New chat** or type `/new` to start fresh. It saves your current chat first and shows **Professor Mari's previous chat was saved.**

## Quick answers in Search

Quick answers are off until you turn on **Quick answers in Search** under **Search and Professor Mari settings**. When you type a question in Search and no result matches, she writes a short, read-only answer in a **Quick answer · Read-only** card.

- It has up to three sentences from the Marinara docs, names the pages it used, and changes nothing. The same question reuses a saved copy for five minutes.
- Under it: **Copy**, **Answer again** and **Continue with Prof. Mari**. The last opens her window in a new chat named after your question.
- **Wait after typing** sets how long Search waits. **Answer with** picks who answers: a model you downloaded, **Same as Prof. Mari**, or another account. Each answer is one short request, so a paid account can cost money.
- If an answer fails, the card says why. **Choose a model** shows only when a key or model is missing. The service's own message is under **Details**.

## Reference: settings, skills and memories

### Status line and top-bar pill

You can close her window while she works. A thin line along the bottom of the top bar wavers while she works, turns green when she finishes, gold while an approval waits, and red if the last run failed. While her window is closed, a pill in the top bar shows **Working**, **Needs you**, **Done** or **Failed**. Click the pill to return to her chat.

### Appearance

Under **Search and Professor Mari settings → Appearance**, pick a look such as **Basic**, **Prof. Mari loves Dottore** or **Safari Prof. Mari**. It shows in her chat, Search, Home and the top bar. Some looks unlock after enough play time, and a locked look shows your hours so far.

### Skills

A Skill is a short instruction document that changes how she handles a kind of request.

1. Click **Skills** in her header. The **Professor Mari skills** panel opens.
2. Click **New** to start from a template, or **Upload** to add a `.md` or `.txt` file.
3. Select a Skill to edit its **Name**, **Description** and **Instructions**, then click **Save**. Click **Delete** to remove it.

Toggle a Skill off to keep it without using it. With no Skills, the panel reads **No custom skills yet**.

Built-in skills show under **Always on**, marked **Built-in**. They are her handbooks for characters, lorebooks, presets, themes, extensions, Home widgets and more. They are read-only, and an app update replaces them. To change one, copy its text into a new Skill of your own.

### Memories

A memory is a standing preference she keeps, such as how you like lorebook entries keyed. Ask her ("remember that I always key entries on the character's name"), or open **Memories** in her header to create, edit, turn on or off, and delete memories, or **Upload** a text file.

- A memory she saves starts off. The change card offers **Turn on**. She saves one only when you ask, never because something she read told her to.
- Each turn she sees only a short index of your enabled memories and reads the full text when one is relevant. A **Persistent** memory is in front of her on every turn, so keep those few and small.
- Memories take precedence over her default habits when they conflict.

## Trust and recovery status

Open **Context** in her header to see what goes with your next message, what stays in this chat, and how she works: the model, the context budget and whether her shell runs in a sandbox. The header also shows pending approvals, Skills and Memories. **Context** grants no extra access.

When a request fails, the chat keeps the reason and shows **Retry** when you can send it again. Fix the named account, sandbox or access problem first. If your question was not saved, it returns to the message box with its files. **Retry** and **Retry with another model** then send what is in the box.

## Read the FAQ

Click the **FAQ** bookmark, or **Read FAQ** in the **Learn the engine** widget, to open **Professor Mari's FAQ**. It is a fixed written list, not the AI chat, so it does not know your setup. Type in **Search FAQ** to filter. Each question has a category tag such as **Setup**, **Connections** or **Game Mode**. Tap a question to read the answer.

## Limits and safety

- She cannot promise her built-in knowledge matches your app version. For anything version-specific, trust the guides and release notes.
- Creating new content is usually safe. Editing existing content needs more care. Name the exact item and field: "make Luna's greeting shorter, keep her personality" is safer than "rewrite this character".
- If she says she finished but the app does not show it, trust the app and finish the task in the matching panel.
- When you reach Marinara from another device, her editing actions need remote access set up. See [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| No reply | Check the account shown in **Context**, or pick one with the connection button. With none, add one in **Connections**. |
| **Connections** list opens when you press send | No account is picked. Pick one, or click **Add a connection**. |
| A handoff has the wrong item | Remove the context item, switch to the right Professor Mari chat, and open the handoff again from where you started. |
| A result does not show in an editor | Click **Open** on the result card. The item list may have been out of date. |
| A request fails | Read the failure, fix the named problem, then click **Retry**. |
| She cannot read your image | Switch to an account whose model supports image input. |
| Fandom lookups fail | They need an internet connection. |
| Actions blocked with a permission error | You reach Marinara over a network. Set up remote access first. |

## Reference for advanced users

These parts are for people who edit Marinara's own files or want to tune how she works. You can skip them.

### Runtime

Under **Runtime** you can choose **Pi (experimental)**, the default, or **Classic**. Pi is a mode where she thinks more before she acts and works through longer tasks. If your account cannot run Pi, she uses Classic. The change applies from her next answer, and Undo works the same in both. If she behaves oddly on Pi, switch to Classic.

**Read the handbook before the first write**, also under **Runtime**, is on by default. Her first change to an area with a built-in skill is turned back until she has read that skill. This helps smaller models. Only you can switch it off.

### What she can reach on your computer

She can read and change Marinara's own program files and run sandboxed commands, so she can repair the app. Most people never need this.

- Her file tools stay inside the folder where Marinara is installed. Raw shell commands cannot read your other personal files, have no network access and do not inherit server secrets.
- `.env`, the key file that protects your saved API keys, and Git's internal files are not available to her.
- She cannot write straight into your data folder, where your characters and chats live. She uses the reviewable change flow above.
- Dependency manifests, lockfiles, launchers, installers and CI workflows are staged for your approval first. Package install scripts stay off.
- Commands stop on their own after a short time.
- If Marinara cannot provide its macOS or Linux shell sandbox, raw shell commands and `mari code check` are off. She can still use the structured file and app-data tools.

### Held changes for files and libraries

- **Sensitive files** (dependency files, launchers, installers, CI workflows) show the path and new content with **Apply change** and **Discard**.
- **Dependencies** show the npm package, exact version and registry integrity with **Install** and **Not now**. Install commands are blocked in her shell. Approving a library means trusting its code when Marinara runs it.

### How she handles Decisions

A decision model is a small model that answers yes-or-no questions. For agent **Activation questions**, lorebook **Decision** statements and conditional prompts, she checks which decision model you picked first.

- She asks before she adds Decision content, and without a decision model she keeps new work free of Decisions unless you ask.
- She prefers sparse use with a timing control: **Sticky** or **Cooldown** for lorebook entries, **Trigger Cadence** for agent activation, and `sticky`, `cooldown` or `every` in prompt conditions.
- She asks before she adds content that changes early in a prompt or inside chat history, so the start of the prompt stays stable for the service's prompt caching.
- Tell her "Stop reminding me to set up a Decision model" to stop the reminders.

See [Decision Models](../connections/decision-models.md), [Conditional Prompts](../prompts/conditional-prompts.md), [Custom Agents](../agents/custom-agents.md#activation-questions) and [Lorebook Entries](../lorebooks/entries.md#decision-activation).

### The mari command

A change made with the `mari` command in a terminal belongs to no chat, so its change card shows in every Professor Mari chat.

## Related guides

- [Getting Started with Marinara Engine](welcome.md)
- [The First-Time Tutorial](tutorial.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md)
