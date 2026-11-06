# Memory Recall and Chat Summaries

Every AI model can read only a limited amount of text at once, called the context window. In a long chat the oldest messages fall out of it and the AI forgets them. Marinara Engine (Marinara from here on) has several ways to bring that history back. This guide shows how to turn each one on and fix it when it does not work.

## Which memory feature do I want?

Start with **Memory Recall**. It works with no extra setup, because Marinara can use a built-in embedding model on your computer. Add summaries when chats get very long.

| Feature | What it does | Works in |
| --- | --- | --- |
| **Memory Recall** | Searches older messages for the parts related to what you just said and adds them to the prompt. | Every mode |
| **Chat Summary** | Replaces old messages with short recaps. | Roleplay |
| **Automatic Summarization** | Summarizes each day, then each week. Always on. | Conversation |
| **Advanced Memory Recall** | Manages the live history, scene summaries and recalled excerpts together. Optional. | Roleplay and Game Mode |

Memory Recall and summaries do different jobs and can run together. Game Mode has Memory Recall and, optionally, Advanced Memory Recall (see [In Game Mode](#in-game-mode)). It has no summary feature of its own.

## Memory Recall

Memory Recall uses embeddings. An embedding is a numeric fingerprint of what a message means. Marinara stores past messages in small groups called chunks. It compares the fingerprint of your new message with the stored fingerprints and adds the closest chunks to the prompt.

### Turning Memory Recall on

1. Open a chat and click **Chat Settings**.
2. Find the **Memory Recall** section.
3. Turn on **Enable Memory Recall**.

The setting is per chat. It starts on in Conversation chats, and in Roleplay or Game chats that have an active Scene. It starts off in other chats. Turning it off stops recall but does not delete stored memories.

If it did not work: Memory Recall needs an embedding source (next section). If you set none, Marinara uses its built-in model, so most people can skip that section. Check that **Memory Recall** appears at all. Some container builds, known as Marinara Lite, turn it off completely.

### Set the embedding source (optional)

Memory Recall needs a model that makes fingerprints. If you set nothing, Marinara uses the built-in embedding model (see below), which is the simple answer for most people. To use a service instead, set it on an account, not in chat settings.

Before you start: you need an account that offers embeddings. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. Open **Connections** and edit the account.
2. Find the **Semantic search (embeddings)** section.
3. Enter an embedding model name, for example `text-embedding-3-small`.
4. Optional: set **Embedding endpoint URL** to change the address.
5. Optional: use **Embedding provider** to borrow another account's key and address. **Same as this provider** keeps this account's own.

Some services offer no embeddings. Marinara then asks you to pick a dedicated embedding account, such as an OpenAI-compatible one, Google, or the built-in model.

To use one source everywhere, choose it under **Embeddings** in **Connections → Defaults**. Accounts with no embedding model of their own use it. An account's own setting still wins.

With no embedding account and no **Embeddings** default, Marinara falls back to a built-in embedding model. It downloads once and runs on your computer with no API key. See [Built-in Model Setup](../connections/local-model.md).

The same setting powers lorebook semantic search, so you set it up once for both.

### See and manage stored memories

1. Open **Chat Settings → Memory Recall**.
2. Click **Access memories for this chat**. The **Memories for This Chat** window opens. With Advanced Memory on, the viewer stays inside the Roleplay drawer.

The window shows the number of stored chunks and a rough token count. Each chunk card shows its date range, message count, creation time and a status.

| Status | Meaning |
| --- | --- |
| **Vectorized** | The fingerprint is built and ready to search. |
| **Waiting for vector** | The fingerprint is still being made. |
| **Embedding unavailable** | No embedding source could build it. |

The toolbar has icons to export, import, rebuild and clear memories.

- A chunk's trash icon opens **Forget Memory**. Confirm with **Forget**.
- The clear-all icon opens **Clear Memories**. Confirm with **Clear**. This removes recall memories, not your chat messages.
- The refresh icon rebuilds every chunk from the current messages. Use it after you change the embedding model.
- Export saves a `.marinara.json` file. Import accepts `.json` or `.marinara` files and merges them in.

### How Memory Recall behaves

- Marinara stores chunks in the background whenever an embedding source exists, even if **Enable Memory Recall** is off. The toggle controls only whether memories are added to the prompt.
- A chunk needs at least 5 new messages before it is created.
- Weak matches are skipped, so recall can return nothing even when memories exist. Only a small part of the prompt is used for recalled memories.
- After you change the embedding model, old chunks no longer match. Rebuild them.
- Deleting a chat's messages also deletes its chunks.

## Chat Summary (Roleplay)

Chat Summary compresses older messages into short recaps called summary entries. Each entry can be written by AI or by you, and each can be turned on or off. It is for Roleplay chats only.

Open **Chat Settings** and expand **Chat Summary**, under **Lorebooks**. On a computer you can pop it out into its own window. See [Chat Settings Overview](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Create a summary entry

1. Under **Summary Scope**, choose **Last** for the most recent messages, or **Range** for a message range.
2. Click **Generate** to have the AI write an entry, or click **Write** to type one yourself.

Each entry shows a title, its source range or message count, and a token estimate. You can turn it on or off, expand it, **Edit** it or **Delete** it. **Show Inactive** and **Hide Inactive** change what the list shows. **Activate All** and **Deactivate All** switch every entry at once.

To change several entries, tick them (on a computer, Shift-click to select a range), then use **Enable selected** or **Disable selected**.

If **Review Agent Outputs** is on, AI summaries wait for your approval. See [Agent Approvals and the Agent Suite](approvals-and-agent-suite.md).

### Automatic Summaries

The **Automatic Summaries** panel keeps summaries current as you chat.

1. Turn on **Enabled**.
2. Set **Every** to how many user messages pass between summaries. The default is 5. The range is 1 to 200.
3. Optional: click **Backfill Summary** to summarize an older chat that never had summaries. A progress bar shows. Click **Stop** to end it early.

### Summary prompt, provider and output size

- **Summary Prompt**: click **Edit** to change the instructions the AI uses. Click **Templates** to manage saved prompts with **New template**, **Duplicate**, **Edit** and **Delete**. Templates are global: picking one in a Roleplay chat changes the prompt for every Roleplay chat.
- **Summary Provider**: the account that writes summaries. It uses your default agent account first and the chat's own second.
- **Maximum output size**: how long a summary can be. The default is 4096 tokens. The range is 1 to 32768.

### Display options

- **Hide summarised messages**: hides raw messages once a summary covers them. Off by default.
- **Recent message tail**: keeps this many of the newest messages visible even when hiding is on. The default is 10. Any whole number from 0 up works. 0 hides the whole summarized batch. Higher values make prompts larger and costlier.
- **Collapse hidden messages**: changes how hidden messages look in the transcript.

The tail limits summarized messages. A summarized message older than the tail is left out of the prompt right away, even before the next summary hides it. An older message that no summary covers yet is still sent, because leaving it out would lose it. When there are such messages, Chat Summary shows how many under **Recent message tail**. Click **Backfill Summary** to summarize them.

### Merged group chats

In a merged group chat, one reply speaks for every character. A part of an entry written for certain characters, such as `{{#if char == "Kaito"}}…{{/if}}`, is kept for every character it applies to and marked with who knows it, for example "known only to Kaito". Parts only the Advanced Memory **Narrator** gets stay out. In one-by-one group chats and one-character chats, each character reads the entries as before, and the Narrator reads every part.

## Automatic Summarization (Conversation)

Conversation chats summarize each calendar day, then combine finished weeks into a week summary. The prompt then carries only the week summaries, the current week's day summaries and today's messages. This runs on its own and cannot be turned off.

### Edit summaries

1. Open a Conversation chat and click **Chat Settings**.
2. Find **Automatic Summarization**.
3. Click **Edit Summaries**.

The window lists weeks first, then days not yet folded into a week. Expand an entry to edit its **Summary** text and its **Key Details** rows.

### Set when a day ends

- **Day Rollover Hour**: the hour a new day begins for summaries. The default is 4 AM. You can choose any hour from 12 AM through 11 AM. Messages before this hour count as the previous day. Pick a time when you are not chatting. If you change it after summaries exist, Marinara warns you that older summaries used the previous hour.
- **Recent Message Tail**: how many of today's newest messages stay word for word after being summarized. The default is 10. Higher values make prompts larger and costlier.

### Fill in missing days

A day can miss its summary, for example after you import an old chat. In the window, the **Missing Summaries** panel has a **Backfill** button. It retries up to 14 recent days at a time. Changing the summary model does not rewrite existing day or week entries.

## Advanced Memory Recall (Roleplay and Game Mode)

Advanced Memory Recall is an optional mode that manages the live history window, continuity summaries and old excerpts together. It splits the chat into scenes, summarizes each finished scene, and recalls the scenes and exact messages that matter for each reply. It runs without the Agents switch and needs no downloadable agent.

### Turn it on

1. Open **Chat Settings → Memory Recall**.
2. Turn on **Advanced Memory Recall**. You can also turn on **Automatic context and memory handling**, below Agents in the Roleplay setup wizard.
3. Set **Maximum allowed context before compression (tokens)** within your model's context window.
4. Set **Summary and recall budget (tokens)** within that cap.
5. Optional: choose a **Helper model**.

For a chat that already has history, click **Prepare existing history** first (see below). Settings and progress show in both the wizard and the **Chat Settings** drawer, on desktop and mobile. The archive viewer stays in the drawer.

### Settings

| Setting | Default | What it does |
| --- | --- | --- |
| **Maximum allowed context before compression (tokens)** | 65,000 | When the outgoing prompt reaches this size, older context is cut off and summarized for recall. |
| **Summary and recall budget (tokens)** | 6,500 | How much of the context goes to memories. At least 10% of the maximum is recommended. |
| **Helper model** | Agent account, then chat account | Makes scene decisions, summaries and continuity. |
| **Maximum recalled scenes** | 3 | Upper limit of scenes recalled per reply. 0 turns off optional scene recall. |
| **Moving context** | 3 to 5 messages | Messages in each recalled excerpt. 0 for both gives summaries without excerpts. |
| **Standalone scene check interval (messages)** | 5 | How many new messages pass between scene checks. |
| **Use Decision model** | Off | Lets a decision model find scene ends and choose memories. |
| **Decide who sees new messages** | Off | One-by-one group chats only. |
| **Character recollections** | Off | Gives each character their own memory of a scene. |

The default budget is 10% of the default maximum. Changing the maximum later does not change it. The ceiling covers the whole estimated outgoing prompt: instructions, messages, recalled context, tools and attachments. Reply tokens and safety headroom are separate. It is an estimate, not an exact tokenizer or billing limit.

All memory summary calls use **Chat Summary → Maximum output size**, with at least 8,196 output tokens to leave room for reasoning.

### Prepare existing history

1. Click **Prepare existing history**. The resolved models show before it starts.
2. Wait. It works through older history in batches and shows its current stage.
3. Use **Cancel** to stop. Completed work is kept. Use **Resume** to continue, even after you close the drawer, restart the server or update the app.

A failed model call keeps earlier valid memory and shows an error to retry. Do not reset memory after a failure: **Resume** reuses completed summaries. The last ongoing scene stays open and is summarized when it closes.

If recovered history changes a scene covered by a manual correction, turn that memory off to keep its text for reference, or delete it, then prepare again. **Fix** skips that scene and lists it instead of stopping.

A branch made from a prepared chat, for example with **Branch from here**, keeps its Advanced Memory. A branch made inside a scene reopens that scene: its old summary is dropped and a new one is written when it closes. A chat imported as a new branch is prepared as usual.

### Fixing memory problems

When something in a chat's memory is broken, a steady dot in your accent color appears on the **Chat Settings** button, and a notice says how many scenes have problems. Each set of problems is announced once, and the dot stays until they are settled. In **Chat Settings → Memory Recall** the problems are listed above the settings. **Access memories for this chat** shows the same dot.

Press **Fix**, in the notice or the list, to repair every flagged scene in one run. It uses the **Helper model**. **Pause processing** stops it and **Resume processing** continues. Fix:

- asks the helper again who was in scenes marked **Check who was there**. If it still cannot tell, nobody gains access and the scene is listed for you;
- checks who was in older scenes saved before participant checks;
- writes new summaries for scenes whose messages, hidden messages, character names or supporting summaries changed, and for finished scenes with no summary. Summaries you deleted stay deleted;
- resumes memory work that stopped with an error.

Fix never rewrites a summary you edited by hand. It lists those under **need your review** and carries on. It cannot change settings for you, such as a character's knowledge range or a working Decision connection.

When Fix finishes it shows "Advanced Memory fixed N scenes" and the scene numbers that need review. Select a number to open that scene in **Access memories for this chat**. If Chat Settings was closed, a notice with **Show** takes you there. A scene Fix could not decide is not asked about again on the next Fix, so save its character access yourself.

### Re-scan scenes

If scene changes were missed, for example when a scene never ended, use **Re-scan scenes** in **Chat Settings → Memory Recall**.

1. Enter the first and last message number to check. It starts on the ongoing scene.
2. Press **Re-scan**.

Advanced Memory finds scene changes in those messages again and summarizes the scenes that changed. It uses the Decision model when **Use Decision model** is on, and the Helper model otherwise. Scenes outside the range keep their boundaries and summaries. If a summary you edited would change, the re-scan stops and names that scene.

### Optional Decision model

A decision model is a small model that answers yes-or-no questions. It is off by default and saved per Roleplay chat.

1. Turn on **Use Decision model** in Advanced Memory.
2. Pick a model in **Memory Decision connection**. Under **Built-in model** it lists the same models as the global **Decision model**. One that cannot answer yet is greyed out with the reason, and a stopped one starts when asked. Under **Connections** it lists your saved Decision accounts. See [Decision Models](../connections/decision-models.md).

This choice is separate from the global Decision default.

The model finds scene boundaries while preparing history and checking ongoing scenes. Before a new reply it picks memories in two passes. See [How decision recall works](#how-decision-recall-works) for the details.

Hosted accounts receive recent conversation text and the shortlisted recaps or messages being scored, and may charge for several requests per reply. Recall filters character access before sending candidates.

### Deciding who sees new messages

In a one-by-one Roleplay group chat, Advanced Memory can decide which characters see each new message. You then do not hide every line from a character who left the scene. Merged group chats and one-character chats do not offer it.

1. Turn on **Decide who sees new messages** in Advanced Memory.

Each new message, yours or a character's, is hidden from characters who are not in the scene. It uses the same per-character **Hide from AI** as a message's own button, so the crossed-eye marker shows who cannot see it. Your message is decided as soon as you post it. Earlier messages are decided before the next character replies.

- The **Narrator** chosen here, and the **Narrator character** chosen in the Roleplay commands settings, see every message. A message's author always sees their own. A whisper's recipient who is not in the scene still gets the whisper.
- With **Use Decision model** on, that model is asked, for each character, whether they clearly cannot see or hear the message. A character the story never puts in the scene counts as elsewhere. Otherwise the **Helper model** decides. A message is hidden only when the model is sure.
- The model reads the messages so far in the current scene, and at least the last few before it. It also gets a list of characters who have spoken since the scene began. The list is only a hint: a quiet listener still counts as present.
- If you change a message's **Hide from AI** yourself, or use `/hide` or `/unhide`, your choice stays and Advanced Memory never changes that message again.
- Each message is decided once. If the model fails or times out, nothing is hidden and the error goes to the server log.

With Advanced Memory on, a new character reply can switch scene or point of view with a break line such as `***`, `---` or `* * *`. The reply is then saved as separate messages from the same character, one per part.

- Each part has its own audience. **Decide who sees new messages**, **Hide from AI** and whispers apply to each part.
- The author still sees every part. Hide a part from them yourself if they should not.
- The break line stays at the top of the part after it. A break inside a code block or an HTML block such as `<details>` does not count.
- The reply's thinking shows on the first part. It is not sent back to the model, even with **Exclude Past Reasoning** off.
- Message info, trackers and agent results go with the last part.
- Rewrite agents such as Prose Guardian rewrite each part on its own. With **Hold Message Until Rewrite** on, each part waits for its own rewrite. If one rewrite fails, that part stays as written.
- Speech autoplay reads every part in order.
- Swiping or regenerating a part makes a new version of that message only. For an earlier part, the new version keeps the text before the first break.
- Continue and Impersonate never split.

### Character recollections

Turn on **Character recollections** to give each character their own memory of a scene. It is off by default.

- Each character who was in a finished scene gets one short memory, about 50 to 100 words, in the first person and their own voice. Their card decides what they notice. The **Narrator**, your persona and characters who were elsewhere get none.
- The model may use only what each character could know. A recollection that copies four words in a row from something its character could not know is left out. A fact retold in other words is guarded by the instructions only.

How they stay correct:

- A recollection counts only while its character can read exactly what they could when it was written. If a scene message is later hidden from them or shown to them, a generated recollection is rewritten. One you edited is left out of prompts until you check and save it again.
- A new scene's recollections come from the same request as its summary. If a character card is too large for that, they follow in their own requests. A character whose card takes more than half of the Helper's room for the scene gets none.
- Turning it on in a chat with summarized scenes adds recollections one scene at a time, shown as **Writing character recollections**. Scene summaries never change. **Resume** retries failed scenes.
- If the model writes nothing usable, the scene keeps an empty recollection until its summary or readable text changes. You can write one in **Access memories for this chat**.

Where they appear and what they cost:

- Recollections appear only with recalled scenes, under the scene's summary and before its excerpt, one line per character. In a one-by-one group chat a character sees only their own. In a merged reply every present character who remembers the scene is shown by name.
- They count toward **Summary and recall budget**. Summaries come first, then recollections, then excerpts. Excerpts shrink first, then whole recollections are left out. A recollection is never cut short.
- Recollections never go into **Chat Summaries** and never decide which scenes are recalled.
- After a scene's summary changes, its generated recollections are rewritten for up to three scenes after each reply, newest first. **Prepare existing history**, **Re-scan scenes** and **Resume** do all of them.

Editing and turning off:

- In **Access memories for this chat**, open a scene to read and edit each recollection. An edited one is marked **Manually edited** and never replaced. **Delete** removes it from prompts for good, but you can type a new one.
- Turning the setting off keeps saved recollections and leaves them out of prompts. Export, import and branches include them.

### In Game Mode

Game Mode chats turn on Advanced Memory Recall in **Chat Settings → Memory Recall**, the same way. Without it, a Game session sends its whole history every turn until the context limit, so a long session costs far more input tokens per turn. With it, the prompt stays under **Maximum allowed context before compression**. The current scene goes out as live messages, and earlier scenes go out as recaps plus the moments recall picks.

- **The Game Master reads every memory.** There is no Narrator choice, no knowledge ranges, no automatic message visibility and no character recollections.
- **Placement.** Recaps and recalled scenes go after the history, just before the GM's turn instructions. The instructions and history in front stay the same from turn to turn, so a connection with prompt caching can reuse them. When a scene ends, one request misses the cache.
- **Source.** Recaps follow the story as you see it: your segment edits apply and the GM's command tags are left out.
- **Sessions.** A new session keeps your settings but starts its own archive. The GM still gets recaps of earlier sessions.
- **Decision model.** Optional and off by default. See [Optional Decision model](#optional-decision-model). It adds small requests to each turn.
- **Cost.** The Helper model writes one recap per scene and checks for a scene change every few turns. These requests are small next to resending a long session.
- Prompt preview for a Game chat does not show Advanced Memory yet. Use the final prompt inspector.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Memory Recall recalls nothing | Check that an embedding source is set up. If chunks show **Embedding unavailable**, set a **Semantic search (embeddings)** model or use the built-in model. See [Built-in Model Setup](../connections/local-model.md). |
| Chunks show **Waiting for vector** | Give them time. Fingerprints are built after replies. |
| Nothing seems related | Recall adds only closely related memories. Adding nothing is normal. |
| Recall got worse after switching embedding models | Use the rebuild icon in **Memories for This Chat**. |
| Summaries are not generating | The chat needs a working text account. Chat Summary uses **Summary Provider**. If none works, generation is skipped. |
| AI summaries never appear | **Review Agent Outputs** may be waiting for your approval. |
| A summary is stuck | Failed summaries retry after a delay. Run **Backfill Summary** (Roleplay) or **Backfill** (Conversation). |
| A scene is marked **Check who was there** | Press **Fix**, or open it in **Access memories for this chat** and use **Edit character access**. |

For other problems see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Advanced Memory reference

Details that most readers do not need. Settings above work without reading this.

### How scenes are detected and summarized

- Scene detection runs after the main Roleplay reply is saved. Once the interval's worth of new messages has arrived, the checker gets every message since the last check (up to twice the interval), the message the last check ended on, scene instructions and the output format. It returns the exact message ending each scene, or none when the scene continues. Persona and character messages both count.
- With Decision mode off, a due check shares an eligible post-processing tracker call when visibility and context budget allow. Otherwise the helper makes its own call. Uncertain transitions leave the scene open.
- Only a detected ending triggers background preparation of that scene's summary and message index. **Chat Settings → Agent activity** shows progress as **Advanced Recall**, even when ordinary agents are off.
- Each scene summary request holds the summary instructions, the scene's eligible messages, applicable range corrections and the JSON output format. Scenes too large for one request are processed in saved batches and then combined. Recaps ask for 2 to 3 paragraphs. The default prompt writes a historical recap with no current-situation section. Custom prompts selected in **Summaries** still apply.
- Initial history detection can use the main or helper model. Summaries always use the helper.
- Each summary also records who took part. A participant name that differs from the card, such as "Kaito" for **Kaito Nakamura**, counts when it fits exactly one character and is not your persona's name. Shared names, descriptions such as "Kaito's sister" and names with notes such as "(mentioned)" give no access. When the helper does not say who took part, the scene goes to every character, and in a group chat it is marked **Check who was there**. A scene listing only you stays narrator-only. Scenes saved before participant checks stay narrator-only until **Fix** or **Prepare existing history** checks them. Each reply that finishes a scene also checks up to three.
- For an older one-by-one group chat, confirm missing knowledge ranges once. A character's first line is not evidence that they knew everything before it. Choose an actual character as **Narrator** only if they should bypass participation limits. Global **Hide from AI** only removes a turn from the live transcript. Advanced Memory still scans, summarizes and indexes it. Start markers trim the live transcript.

### The live window and the budget

- Prompt priority is constants (always-on summaries), then selected scene summaries, then character recollections, then message excerpts. Constants aim for at most 70% of the budget. Total memory may use up to 2,000 extra tokens when needed, within the context cap. Live messages do not count toward the constant share.
- When the outgoing prompt reaches the cap, the live window resets to the start of the latest scene for all characters, then grows again. Function-call and roll follow-ups do not count. The cutoff shows in **Mark as new start** with **All** selected. Uncheck All to undo it. Personal start flags still apply. If an unfinished scene or oversized constant cannot fit, the request uses marked source excerpts and keeps the latest messages. Saved summaries and messages are never overwritten.
- Main generation reads saved memory immediately. It never waits for a continuity job.
- After the main reply, Advanced Memory adds **Chat Summaries** for archived messages no summary covers yet. In a one-by-one group chat, everyone who read a scene shares one summary of it.
- When the active summaries one character reads pass 70% of the budget, **Updating continuity** combines them into one summary about half their size after the reply, using the helper. The reply never waits. A summary that still covers live messages waits until they leave the live window. If the combined summary is still over the share, the next update halves it again.
- Each request holds only your **Combine prompt**, one line asking for about half the length, and the summary text. When the text has macros such as `{{user}}`, that line also asks to keep them as written. A text too long for one request is sent in parts, and each part is halved. The helper's reply may be as long as the text plus 1,024 tokens, up to 8,196 tokens or **Chat Summary → Maximum output size** if that is larger.
- Summaries that different characters read are combined into one, including ones you wrote. Private parts stay in their `{{#if char == "Name"}}…{{/if}}` sections for exactly the characters who knew them. The text each group of characters reads is shortened in a request of its own, without its condition, and goes back inside that same condition. The groups follow the order in which each first appears. A part under 64 tokens stays as it is, with no request. Summaries using other macros stay as they are. If those alone fill a character's share, shorten them by hand or raise the budget. Replaced entries become inactive, so you can turn them back on.
- If the helper's reply is cut off at its limit, empty, not shorter or adds a macro, or the result would change who can read a part, the summaries stay as they are and the update still finishes. The same summaries are not sent again until one of them changes, or you change the helper model or the **Combine prompt**. **Resume processing** retries an update that stopped with an error.
- A character's prompt shows a summary's message range and dates only from messages that character can see. The Narrator, replying alone, reads every part once.

### What recall returns

- One **Recalled Scenes** section holds each summary followed by its excerpt, if any, under one range heading. The block names the present live-history range and the last user-message number, so past events are not mistaken for the current turn.
- A scene is recalled only when all its source messages are outside the live history being sent. Ranged **Chat Summaries** are omitted while any covered message is live. They stay saved and enabled. Eligible constants take priority over optional recall. All selected summaries reserve space before any excerpt.
- Illustration attachments and image captions are omitted from recalled text and new summary inputs. Readable text attachments stay.
- With Decision mode off, recall reads prepared memories. A query embedding has a short time limit and falls back to text matching. Text matching weights distinctive terms in your messages since the replying character last spoke. A name they mention counts most. The replying characters' and your persona's names do not, nor does a name found in most memories. It adds no model call.
- Recall runs only for the main Roleplay generation. Agent calls, manual agent reruns and dry runs neither trigger it nor receive it.
- Swipes reuse the earliest compatible saved memory from that reply. A swipe recalls again when an earlier scene its character could recall was saved, edited, turned on or off since. Continuing a reply keeps the memory it began with. Changes to history, access settings, summaries or memories invalidate saved snapshots.
- Editing, swiping, hiding or deleting source messages causes affected memory to be checked again before use. Historical regeneration uses only sources before the target.
- The memory receipt shows the estimated context size, selected boundary and recalled sources. When nothing was recalled, it says whether no earlier scenes existed, no room was left, or nothing was relevant. Prompt preview uses prepared memory and starts no model calls. The final prompt inspector shows what went to the model.
- When a recalled scene has no excerpt, the receipt says why: no room after the summaries, or none of its messages can be quoted.

### Access memories for this chat

Open it to search numbered scene summaries, see their timeframes and audiences, edit **Summary text**, or read the originals with **Inspect source messages**. You can turn off records, **Reindex**, export and import, or **Delete all memories** to restart preparation while keeping the chat and settings. Corrections to manual summaries are kept and invalidate dependent continuity. **Delete summary** at the bottom of a summary removes it after you confirm the summary and audience. It also works for old **Continuity** and **Ongoing scene** entries. Deleted recaps are not regenerated by routine preparation.

To keep a scene out of recall, turn off its memory record. Character-specific hiding still controls who can access it. Global hiding does not remove it from the archive.

### Who can read a scene

- A character present for part of a scene shares its memory access, even when some messages are hidden from them. A scene with no accessible source messages is unavailable. Mentioning an absent character does not make them a participant.
- New recaps mark message visibility, keep shared events in plain prose and use `{{#if character == "Name"}}…{{/if}}` for private sections. If visibility or a recap's target character changes, the old recap is withheld from partial readers until you prepare that scene again (**Fix** does this for every such scene) or review and save its private conditions. A character who joins later does not count, unless only part of the scene is visible to them. Older recaps need one **Fix** after a character joins. Readers with access to every source message can still recall it. Manually corrected text is never silently rewritten.
- Scene dates are shared by all assigned participants. Raw excerpts never include character-hidden messages or whispers. A summary with parts only for some characters still gets an excerpt that quotes only what that character saw. To keep a message out of a character's memory, hide it from them.
- In a merged group chat, recall includes what at least one character remembers. A scene or private part that not every character knows is marked, for example "known only to Kaito". An excerpt quotes only messages every remembering character saw. Memories no character remembers, such as narrator-only scenes, stay out. In one-by-one group chats each character recalls only their own.

### How decision recall works

- Ordinary recall first shortlists up to 24 scene recaps, or **Maximum recalled scenes** if that is higher. The shortlist combines text matching and embeddings. Embeddings compare each scene with up to six of your messages since the replying character last spoke. A first reply uses your latest message. Until almost every scene has embeddings, the shortlist uses ordinary recall's ranking. The scene right after each of the best three also gets a place.
- Each recap the model judges starts with one line: message range, story date and who spoke. The model picks relevant scenes, then judges up to 12 of each chosen scene's best-matching original messages to choose its excerpt. The best pick is the centre, and others lengthen it up to **Maximum messages per excerpt**.
- For each new message, the model also checks whether the story moves to another place or time, switches to characters who are elsewhere, or follows a scene-break line. It sees the three messages before and who wrote them. Uncertain boundaries leave the scene open. A valid decision can select nothing.
- Time limits: each pass gets about what the model needs per question times the number of questions plus half again, at least 10 and at most 25 seconds. Both passes together get at most 40 seconds per reply. When a model cannot fit every question, it judges fewer, best matches first. Requests are short, so answers that arrive in time still count. The reply shows its usual **Thinking…** placeholder meanwhile.
- When one request fails, times out or is too large, only those memories fall back to ordinary recall, after the scenes the model chose, and the receipt says so. A missing connection or a pass with no answer falls back completely to the shortlist ranking and text matching. Unavailable scene decisions fall back to the standard scene checker.
- Embeddings are made in this mode too. A new summarized scene gets them right away. Older scenes and ones made with another embedding model get them after replies, a few at a time. **Reindex** does all at once.
- **Peek Prompt → Decision diagnostics → Advanced Memory activity** shows saved results from the latest recall and scene check: model, time, scores, selected memories or scene starts, fallback status and why a scene has no excerpt. It keeps up to 128 results. These are past activity, not predictions. Opening it does not rerun decisions. Compatible swipes reuse saved selections. A continuation chooses its memories again.
- Hosted Decision accounts get bounded batches within their context budget. Managed Open-Jev models use their measured time per question, and a Decision account answers one request's questions together, so it counts each request once.

### Preset placement

Preset authors can place these content markers with the usual section order, name, role and group controls:

| Marker | Content |
| --- | --- |
| `chat_summary` | Eligible constant entries from Chat Summaries. |
| `current_scene_summary` | Source excerpts from the older part of an ongoing scene. |
| `recalled_scenes` | All selected scene summaries, each followed by its excerpt. |

Each follows the preset's **XML**, **Markdown** or **None** format. Empty components emit nothing. The first enabled marker owns placement. Components without an enabled marker fall back once before history, so older presets work. The preset picker offers only **Recalled Scenes**. An old `recalled_messages` marker is an alias, and an enabled `recalled_scenes` marker wins. These markers are empty when Advanced Memory is off.

### Limits

Recall is selective, and summaries can miss nuance. Keep important corrections in the source transcript or the summary editor. If embeddings fail, bounded text recall and valid continuity remain. The archive is never inserted whole. If instructions or an attachment cannot fit the cap, reduce them or raise the cap. If the reply reserve cannot fit the model's total context, lower the output size or pick a model with a larger context. Advanced Memory stops instead of silently deleting instructions.

Advanced mode owns retrieval while on, so Standard Recall does not insert a second copy. It also replaces the usual automatic Roleplay summary schedule for that chat. Turning it off restores the normal settings. Existing lorebooks and downloadable agents keep their own scope rules.

## Related guides

- [Built-in Model Setup](../connections/local-model.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Conversation Mode: Getting Started](../conversation/getting-started.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
