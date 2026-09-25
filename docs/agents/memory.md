# Memory Recall and Chat Summaries

This guide explains **Memory Recall** (search over past messages), opt-in **Advanced Memory Recall (Alpha)** for automatic Roleplay context management, **Chat Summary**, and Conversation **Automatic Summarization**.

## The two memory systems

Every AI model can only read a limited amount of text at one time. That limit is called the context window. When a chat gets long, the oldest messages fall out of that window and the AI forgets them. Marinara Engine (called Marinara after this) has two separate systems that fix this.

- **Memory Recall** searches your older messages for the parts most related to what you just said, then quietly adds those parts back into the prompt. It works in every chat mode.
- **Summaries** compress old messages into short recaps that replace the raw messages in the prompt. Roleplay chats use **Chat Summary**. Conversation chats use **Automatic Summarization**.

Game Mode chats get **Memory Recall** only. They do not have either summary feature.

You can use both systems at the same time. They do different jobs and do not conflict.

## Memory Recall setup

**Memory Recall** finds relevant fragments from earlier in a chat and injects them into the prompt as memories. It uses an embedding: a numeric fingerprint of a message's meaning. Marinara compares the fingerprint of your new message against stored fingerprints of past messages, then adds the closest matches.

### Turning Memory Recall on

1. Open a chat and click the **Chat Settings** button in the chat header.
2. Find the **Memory Recall** section (it has a brain icon).
3. Turn on the **Enable Memory Recall** toggle.

**Enable Memory Recall** is a per-chat setting. Its default depends on the mode:

- On by default in Conversation chats.
- On by default in Roleplay or Game chats that have an active Scene.
- Off by default in all other chats.

Turning the toggle off stops recalled memories from being added to the prompt. It does not delete anything you have already stored.

### The embedding source

Memory Recall needs an embedding source to build those meaning fingerprints. You set it on a connection, not in chat settings. A connection is a saved link to an AI provider.

1. Open the **Connections** panel and edit a connection.
2. Find the **Semantic Search (Embeddings)** section.
3. Enter an embedding model name in the model field. An example value is `text-embedding-3-small`.
4. Optionally set an **Embedding Endpoint URL** to override the address.
5. Optionally use the **Embedding Connection** dropdown to borrow another connection's key and address. Options include **Same as this connection** and **Local Model (sidecar)**.

Some providers do not offer embeddings. In that case Marinara shows a note asking you to pick a dedicated embedding connection, such as an OpenAI-compatible one, Google, or the Local Model.

If you set no embedding connection at all, Marinara falls back to a built-in local embedding model. It downloads this model one time and runs it on your own machine, with no API key needed. For more on the built-in model, see [Local Model Setup](../connections/local-model.md).

This same **Semantic Search (Embeddings)** setting also powers Lorebook semantic search, so setting it up once helps both features.

### Memories for This Chat

To see what a chat has remembered, open **Chat Settings**, go to the **Memory Recall** section, and click **Access memories for this chat**. With Advanced Memory enabled, the viewer stays inside the Roleplay drawer; otherwise this opens the **Memories for This Chat** modal.

The modal shows a count of stored memory chunks and a rough token estimate. Each chunk card shows the date range it covers, the message count, a status, and when it was created. The status is one of:

- **Vectorized**: the fingerprint is built and ready to search.
- **Waiting for vector**: the fingerprint is still being made.
- **Embedding unavailable**: no embedding source could build it.

The toolbar has icons to export memories, import memories, rebuild memories, and clear all memories. Each chunk also has its own trash icon to forget just that chunk.

- Clicking a chunk's trash icon opens a **Forget Memory** dialog. Confirm with **Forget**.
- The clear-all trash icon opens a **Clear Memories** dialog. Confirm with **Clear**. This removes recall memories but does not delete your chat messages.
- The refresh icon rebuilds every memory chunk from the current chat messages. Use it after you change the embedding model.
- Export saves a `.marinara.json` file. Import accepts `.json` or `.marinara` files and merges them into the existing memories.

### How Memory Recall behaves

Keep these points in mind:

- Marinara stores memory chunks in the background whenever an embedding source is available, even if **Enable Memory Recall** is off. The toggle only controls whether stored memories get injected. To stop storing memories, remove the embedding source or clear the memories from time to time.
- A chunk needs at least 5 new messages before it is created. Smaller batches wait for the next reply.
- Recalled fragments must be closely related enough to pass a similarity check. Weak matches are skipped, so recall can return nothing even when memories exist.
- Only a small budget of the prompt is used for recalled memories, so only the most relevant few are ever added.
- If you change the embedding model after memories already exist, the old chunks no longer match. Use the rebuild icon to remake them.
- Deleting a chat's messages also deletes its memory chunks.

Some container builds of Marinara, known as Marinara Lite, turn Memory Recall off completely. On those builds the **Memory Recall** section does not appear at all.

## Advanced Memory Recall (Alpha, Roleplay)

Open **Chat Settings → Memory Recall** and enable **Advanced Memory Recall (Alpha)**. You can also enable **Automatic context and memory handling (alpha)** below Agents in the Roleplay setup wizard. This optional mode manages the live history window, continuity summaries, and relevant old excerpts together. Settings and setup progress are available in both the wizard and the Chat Settings drawer on desktop and mobile. The archive viewer stays in the Chat Settings drawer.

### Setup

- Choose **Maximum allowed context before compression (tokens)** within your chat model's supported context. This ceiling covers the estimated outgoing prompt, including instructions, messages, recalled context, tools, and attachments, for both chat and memory processing requests. Reply tokens and safety headroom are separate. The selected model's total context limit still applies; this is not an exact tokenizer or billing limit.
- Choose **Summary and recall budget (tokens)** within that cap. Active constants target at most **70%** of this value. Prompt priority is constants, then selected scene summaries, then message excerpts. The combined memory may use up to **2,000 extra tokens** when needed, subject to the full context cap. For example, a 10k setting targets at most 7k of constants and allows up to 12k of total memory; the same proportions apply to other configured values. Live messages do not count toward the constant share or trigger constant consolidation.
- The **Helper model** makes standalone scene decisions, scene summaries, and compacted continuity. It defaults to the agent connection, falling back to the chat connection. Initial historical scene detection can use the main or helper model; summaries always use the helper. The resolved models are shown before preparation.
- All memory summary calls use **Chat Summary → Maximum output size**, with at least **8,196 output tokens** to leave room for reasoning. This includes scene summaries and constant-summary consolidation; larger output settings are preserved. The helper connection cannot replace this with its ordinary reply limit. The model's total context must still fit the input and output reserve.
- Each scene summary request contains summary instructions, that scene's eligible messages and applicable ranged corrections, and the JSON output format. Scenes too large for one request are processed in saved batches, then combined. Scene recaps request **2–3 paragraphs**. The default prompt produces a historical recap without current-situation or open-tension sections; custom prompts selected in **Summaries** still apply. Advanced Memory runs independently of the main Agents switch and needs no downloadable agent.
- **Maximum recalled scenes** defaults to **3**. It is an upper limit: weaker matches are skipped. Set it to **0** to disable optional scene recall while retaining required continuity. Each selected scene contributes its summary followed by at most one excerpt.
- **Moving context** controls the messages in each excerpt, defaulting to **3–10**. Set both message limits to **0** for summaries without excerpts, or only the minimum to **0** to make excerpts optional. Relevance, character access and available space can produce fewer messages, including none.

For an older Individual group chat, confirm missing character knowledge ranges once. A character's first spoken line is not evidence that they knew everything before it. Select an actual character as **Narrator** only when they should bypass participation limits. Character-specific hiding and confirmed knowledge ranges still restrict memory. Global **Hide from AI**, whether set manually or by automatic summaries, only removes a turn from the live transcript: Advanced Memory still scans it, determines scene participants, summarizes it, and indexes it for permitted recall. Start markers trim the live transcript. You can correct these ranges later; newly added characters need their own confirmation.

For an existing chat, click **Prepare existing history** first. If recovered history changes the boundaries of a scene covered by a manual correction, disable that memory to keep its text for reference, or delete it, then prepare history again. Saving the same correction cannot safely assign its text to a different source range. Preparation works through older history in batches and shows its current stage beside Professor Mari's hamster wheel. **Cancel** retains completed work; **Resume** continues after closing the drawer, restarting the server, or updating the app. A failed model call preserves previously valid memory and displays an error to retry. Do not reset memory to recover from a failed call: Resume reuses completed summaries and unchanged scene detection. The final ongoing scene stays open and is summarized when it closes, with bounded source excerpts used if its live messages exceed the context cap.

To remove a saved summary, open it in **Access memories for this chat** and choose **Delete summary** at the bottom. Confirm the summary and audience in the dialog. This also works for legacy **Continuity** and **Ongoing scene** entries. Deleted scene recaps are not regenerated by routine preparation. Original messages remain intact. New constant summaries live in **Chat Summaries**, where the existing edit, enable/disable, combine, and delete controls apply; legacy vault continuity is no longer used as an additional constant.

### While chatting

Scene detection runs after the main Roleplay reply is saved. **Standalone scene check interval (messages)** defaults to **5**. At that interval, the checker receives the numbered recent messages, one preceding message for context, scene instructions and output format. It identifies the exact message ending each scene, or returns no endings when the scene continues. Both persona and character messages count. The cadence is independent of tracker schedules, but a due check shares an eligible post-processing tracker call when its source visibility and context budget allow it; otherwise the helper makes a standalone call. Each new scene range begins after the previous scene's end and includes the newly reported ending message. Only a detected ending triggers background preparation of that completed scene's summary and message index, including when the latest reply ends the scene. Uncertain transitions leave the scene open. The top-left **Agents** menu shows preparation as **Advanced Recall**, including progress, errors and recovery controls, even when ordinary agents are disabled. Progress polls only while a memory job is running; ready archives are not polled while idle.

Ordinary recall reads prepared memories instead of preparing the archive again. An optional query embedding has a short time limit and falls back to text matching if unavailable. Text matching gives distinctive terms in the latest user message more weight, so a brief detail can find a long scene recap. Indexed original messages can also find scenes when excerpt output is disabled. Neither adds a model call. Recall runs only for the main Roleplay generation: agent calls, manual agent reruns and auxiliary dry-run generations neither trigger it nor receive its returned summaries or excerpts. Main prompt inspection remains read-only.

Regenerated swipes reuse the earliest compatible saved memory from that reply, including its continuity, scene summaries and exact excerpts. Unchanged swipes do not search or call the summary helper again. Continuing a reply preserves the memory used when it first began. Older replies without a saved memory snapshot prepare one on their next generation, then reuse it on subsequent swipes; no archive reset is needed. Background constant additions and combinations retain compatible swipe memory. User changes to history, access settings, summaries or saved memories invalidate incompatible snapshots, and the current context cap is always enforced.

Main generation reads saved memory immediately. It never starts or waits for continuity generation, including when a background helper is still running. When the outgoing prompt reaches the cap, the live window resets to the beginning of the latest scene for **all characters**, then grows until it reaches the cap again. The automatic cutoff appears in the existing **Mark as new start** control with **All** selected; uncheck All to undo it. Personal start flags still apply. If an unfinished scene or oversized constant cannot fit, the request uses explicitly marked source excerpts while retaining the latest messages. This temporary fitting does not create another persistent flag. Saved summaries and original messages are not overwritten.

After the main reply, Advanced Memory extends the existing ranged **Chat Summaries** only for uncovered archived messages. It reuses completed scene recaps where possible. Existing entries, including inactive ones, count as already handled ranges. When eligible active constants exceed 70% of **Summary and recall budget**, **Updating continuity** combines only their summary texts after the reply, using the selected helper and **Chat Summary → Maximum output size**. Constants overlapping live messages are excluded from both this budget and compaction; legacy unranged constants remain eligible. The reply that crosses the threshold still generates normally with saved eligible constants; compaction never holds it up. The extra 2,000 tokens belong to total memory, not the constant share. Shared templates whose macros expand differently for each character stay unchanged; if they alone exceed the target, they need a manual edit. Other groups receive proportional length guidance, not a hard rejection threshold. A complete, shorter replacement appears in Chat Summaries with a message-range title, and replaced entries become inactive together. Failed or unfinished output is not saved; existing entries remain usable and **Resume processing** retries unfinished work. Scene recaps stay in the vault.

The archive can recover relevant scene summaries and exact dialogue with original message numbers and speakers. One **Recalled Scenes** section contains each summary immediately followed by its excerpt, if available, with one range heading for the excerpt. Scenes without excerpts stay in that same section. The recalled block identifies the present live-history range and the last user-message number so historical events are distinguishable from the current turn. Scene recaps are recalled only when all their source messages are outside the live history being sent; exact recalled messages also exclude live messages. Ranged **Chat Summaries** are likewise omitted while any covered messages remain live. They stay saved and enabled, and become eligible again once their entire range is outside the live window. Eligible constants take priority over optional recall, retaining their character conditions. All selected scene summaries reserve space before any scene receives a message excerpt. Character access and historical source limits still apply. Illustration attachments and image captions are omitted from recalled message text and new summary inputs; readable text attachments remain available. Both persona and character messages count. Historical regeneration only uses sources before the target, including when the target predates the current managed window. Editing, swiping, hiding or deleting source messages causes affected derived memory to be checked again before use.

Open **Access memories for this chat** in the same drawer to search chronologically numbered scene summaries, inspect their timeframes and audiences, edit **Summary text**, or read the full original messages with **Inspect source messages**. Internal verbatim excerpts are not separate scene-summary entries. Source-grounded story timeframes accompany recalled context; unknown dates stay unknown. You can disable recall records, reindex, export/import, or confirm **Delete all memories** to restart memory preparation while retaining the original chat and settings. Corrections to original manual summaries are preserved and invalidate dependent continuity. To keep a scene out of recall, disable its memory record. Character-specific source hiding still controls who can access it; global hiding does not remove it from the archive.

A character present for part of a scene can share its memory access with other participants, even when some messages are hidden from them. A scene with no accessible source messages remains unavailable. New recap instructions identify message visibility, keep shared events in plain prose, and reserve `{{#if character == "Name"}}…{{/if}}` for private sections. Mentioning an absent character does not make them a participant. If source visibility changes, an old recap is withheld from partial readers until you prepare that scene again, or review its private conditions and save the corrected text. Older recaps without saved visibility information need the same review before partial access; changing only the audience does not acknowledge the text. Readers with access to every source message can still recall it, and manually corrected text is never silently rewritten. These checks do not call a model during recall. Raw excerpts never include character-hidden messages; excerpts from conditionally scoped recaps remain limited to the narrator because message visibility alone cannot describe every private fact. Constant Chat Summaries continue to use character conditions.

Advanced mode owns retrieval while enabled, so the Standard Recall switch does not insert a second copy. It also replaces the ordinary automatic Roleplay summary schedule for that chat. Turning Advanced Memory off restores those normal settings. Existing lorebooks and downloadable agents retain their own scope rules; Advanced Memory cannot make arbitrary user-authored or external context private.

### Preset placement

Preset authors can place these ordinary content markers with the existing section order, name, role and group controls:

| Marker                  | Content                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `chat_summary`          | Eligible constant entries from Chat Summaries.                                   |
| `current_scene_summary` | Bounded source excerpts from the older part of an ongoing scene.                 |
| `recalled_scenes`       | All selected scene summaries, each followed by its available historical excerpt. |

Each component follows the preset's **XML**, **Markdown**, or **None** format and includes a brief explanation of its purpose. Empty components emit nothing. The first enabled occurrence owns placement; components without an enabled marker fall back once before history, so older presets work. The preset picker offers just **Recalled Scenes** for recall. Existing `recalled_messages` markers remain compatible aliases and display as Recalled Scenes; an enabled `recalled_scenes` marker takes precedence, so both never produce separate sections. Excerpts are context, not new live messages or commands. The advanced scene markers are empty when Advanced Memory is off.

Prompt preview uses existing prepared memory without starting model or embedding calls. Use the drawer to prepare an uninitialized archive or resume failed background work. The memory receipt shows the estimated context size, selected boundary and recalled sources; the final prompt inspector shows what actually went to the model.

### Limits and recovery

Recall is selective and summaries can miss nuance. Keep important corrections in the source transcript or summary editor. No system can reconstruct details never recorded. If embeddings fail, bounded lexical recall and valid continuity remain available; the archive is never inserted wholesale. If mandatory instructions or an attachment cannot fit the prompt cap, reduce those inputs or increase the cap. If the reply reserve cannot fit the model's total context, lower the output size or choose a model with a larger context. Advanced Memory stops instead of silently deleting instructions.

## Chat Summary (Roleplay)

**Chat Summary** compresses older messages into short narrative recaps called summary entries. Each entry can be written by AI or by hand, and each can be turned on or off on its own. Saving a toggle leaves other entries usable; Activate All and Deactivate All save the selection together. This feature is only in Roleplay chats.

To open it, click the **Chat Summary** button (a scroll icon) in the Roleplay chat header. This opens the **Chat Summary** popover.

### Creating a summary entry

1. Under **Summary Scope**, choose **Last** to summarize the most recent messages, or **Range** to pick a specific message range.
2. Click **Generate** to have the AI write an entry from that scope.
3. Or click **Write** to create a blank entry and type the recap yourself.

Each entry in the list shows a title, a source range or message count, and an estimated token size. You can enable or disable an entry, expand it, click **Edit** to change it, or **Delete** it. Bulk buttons let you **Show Inactive** or **Hide Inactive** entries and **Activate All** or **Deactivate All** at once.

### Automatic Summaries

The **Automatic Summaries** panel keeps summaries updated as you keep chatting. It appears in Roleplay chats only.

- Turn on the **Enabled** toggle inside the **Automatic Summaries** panel.
- Set how often it runs with the **Every** field, measured in user messages. The default is 5, and the range is 1 to 200.
- Click **Backfill Summary** to catch up an older chat that never had summaries. It works through the chat in batches, and a progress bar appears while it runs. Click **Stop** to end it early.

### Summary Prompt templates

The **Summary Prompt** panel controls the instructions the AI uses to write a summary. Click **Edit** to change the active prompt. Click **Templates** to open the template manager. There, **New template** lets you save a named prompt. Each saved template has its own **Duplicate**, **Edit**, and **Delete** controls.

Saved templates are a global, app-wide setting. Editing or picking a template from one Roleplay chat changes the summary prompt used in every Roleplay chat.

### Summary Connection and output size

The **Summary Connection** panel picks which connection writes your summaries. Its default is labeled **Agent default (falls back to chat connection)**. This means it uses your default agent connection first and the chat's own connection second.

The **Maximum output size** field sets how long a generated summary can be. The default is 4096 tokens, and the range is 1 to 32768.

### Display options

The **Display** controls in the popover decide how summarized messages appear on screen:

- **Hide summarised messages**: hides the raw messages once a summary covers them. Off by default.
- **Recent message tail**: keeps this many of the newest messages fully visible even when hiding is on. The default is 10, and any non-negative whole number is accepted. Setting 0 hides the whole summarized batch. Higher values increase prompt size and model cost.
- **Collapse hidden messages**: controls how hidden messages look in the transcript.

If your chat requires agent write approval (a separate Agents setting), AI-generated summaries wait for your review before they take effect.

## Automatic Summarization (Conversation)

Conversation chats use a different system called **Automatic Summarization**. It wraps up each calendar day into a day summary, then combines finished weeks of day summaries into a week summary. The prompt then sends only the week summaries, the current week's day summaries, and today's messages. This keeps each request small.

This feature runs on its own and cannot be turned off for Conversation chats.

### Opening the editor

1. Open a Conversation chat and click **Chat Settings**.
2. Find the **Automatic Summarization** section (it has a calendar icon).
3. Click **Edit Summaries** to open the **Automatic Summarization** modal.

The modal lists week entries first, then any days not yet folded into a week. Expand an entry to edit its **Summary** text and its **Key Details** list, where you can add or remove rows.

### Day Rollover Hour and Recent Message Tail

Two settings in the **Automatic Summarization** section shape how days are split:

- **Day Rollover Hour**: the hour when a new day begins for summaries. The default is 4 AM, and you can pick any hour from 12 AM (midnight) through 11 AM. Messages sent before this hour count as part of the previous day. Pick a time when you are never chatting so a late-night session is not cut in half.
- **Recent Message Tail**: how many of today's newest messages stay word-for-word even after they are summarized. The default is 10, and any non-negative whole number is accepted. Higher values increase prompt size and model cost.

If you change **Day Rollover Hour** after summaries already exist, Marinara warns you that older summaries used the previous setting.

### Filling in missing days

Sometimes a day fails to get a summary, for example after you import an old chat. The **Missing Summaries** panel in the modal has a **Backfill** button that retries recent days that have no summary. It looks back up to 14 days at a time.

Changing the connection or model used for summaries does not rewrite day or week entries that already exist.

## Troubleshooting

### Memory Recall is not recalling anything

- Check that an embedding source is set up. If chunks in **Memories for This Chat** show **Embedding unavailable**, configure a connection's **Semantic Search (Embeddings)** section or rely on the built-in local model. See [Local Model Setup](../connections/local-model.md).
- If chunks show **Waiting for vector**, give them time. Fingerprints are built after replies.
- Recall only adds memories that are closely related to your latest message. If nothing seems related, it adds nothing. This is normal.
- If you recently changed the embedding model, use the rebuild icon in **Memories for This Chat** so old chunks match the new model.

### Summaries are not generating

- Make sure the chat has a working text connection. Chat Summary uses the **Summary Connection**, and Automatic Summarization uses the resolved summary connection. If none works, generation is skipped.
- If your chat requires agent write approval, AI summaries wait for you to approve them first.
- A summary that fails is retried automatically after a delay. If it stays stuck, run **Backfill Summary** (Roleplay) or **Backfill** (Conversation) to try again by hand.

## Related guides

- [Local Model Setup](../connections/local-model.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Conversation Mode: Getting Started](../conversation/getting-started.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
