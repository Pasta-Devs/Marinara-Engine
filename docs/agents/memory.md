# Memory Recall and Chat Summaries

This guide explains **Memory Recall** (search over past messages), opt-in **Advanced Memory Recall** for automatic Roleplay context management, **Chat Summary**, and Conversation **Automatic Summarization**.

## The two memory systems

Every AI model can only read a limited amount of text at one time. That limit is called the context window. When a chat gets long, the oldest messages fall out of that window and the AI forgets them. Marinara Engine (called Marinara after this) has two separate systems that fix this.

- **Memory Recall** searches your older messages for the parts most related to what you just said, then quietly adds those parts back into the prompt. It works in every chat mode.
- **Summaries** compress old messages into short recaps that replace the raw messages in the prompt. Roleplay chats use **Chat Summary**. Conversation chats use **Automatic Summarization**.

Game Mode chats get **Memory Recall** only. They do not have either summary feature.

You can use both systems at the same time. They do different jobs and do not conflict.

## Memory Recall setup

**Memory Recall** finds relevant fragments from earlier in a chat and injects them into the prompt as memories. It uses an embedding: a numeric fingerprint of a message's meaning. Marinara compares the fingerprint of your new message against stored fingerprints of past messages, then adds the closest matches.

### Turning Memory Recall on

1. Open a chat and click the **Chat Settings** button in the chat (it starts at the top right).
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

## Advanced Memory Recall (Roleplay)

Open **Chat Settings → Memory Recall** and enable **Advanced Memory Recall**. You can also enable **Automatic context and memory handling** below Agents in the Roleplay setup wizard. This optional mode manages the live history window, continuity summaries, and relevant old excerpts together. Settings and setup progress are available in both the wizard and the Chat Settings drawer on desktop and mobile. The archive viewer stays in the Chat Settings drawer.

### Setup

- Choose **Maximum allowed context before compression (tokens)** within your chat model's supported context. This ceiling covers the estimated outgoing prompt, including instructions, messages, recalled context, tools, and attachments, for both chat and memory processing requests. Reply tokens and safety headroom are separate. The selected model's total context limit still applies; this is not an exact tokenizer or billing limit.
- Choose **Summary and recall budget (tokens)** within that cap. Active constants target at most **70%** of this value. Prompt priority is constants, then selected scene summaries, then message excerpts. The combined memory may use up to **2,000 extra tokens** when needed, subject to the full context cap. For example, a 10k setting targets at most 7k of constants and allows up to 12k of total memory; the same proportions apply to other configured values. Live messages do not count toward the constant share or trigger constant consolidation.
- By default, the **Helper model** makes standalone scene decisions, scene summaries, and compacted continuity. It defaults to the agent connection, falling back to the chat connection. Initial historical scene detection can use the main or helper model; summaries always use the helper. The resolved models are shown before preparation.
- All memory summary calls use **Chat Summary → Maximum output size**, with at least **8,196 output tokens** to leave room for reasoning. This includes scene summaries and constant-summary consolidation; larger output settings are preserved. The helper connection cannot replace this with its ordinary reply limit. The model's total context must still fit the input and output reserve.
- Each scene summary request contains summary instructions, that scene's eligible messages and applicable ranged corrections, and the JSON output format. Scenes too large for one request are processed in saved batches, then combined. Scene recaps request **2–3 paragraphs**. The default prompt produces a historical recap without current-situation or open-tension sections; custom prompts selected in **Summaries** still apply. Advanced Memory runs independently of the main Agents switch and needs no downloadable agent.
- **Maximum recalled scenes** defaults to **3**. It is an upper limit: weaker matches are skipped. Set it to **0** to disable optional scene recall while retaining required continuity. Each selected scene contributes its summary followed by at most one excerpt.
- **Moving context** controls the messages in each excerpt, defaulting to **3–10**. Set both message limits to **0** for summaries without excerpts, or only the minimum to **0** to make excerpts optional. Relevance, character access and available space can produce fewer messages, including none. Every recalled scene gets its minimum excerpt before any excerpt grows. When a recalled scene still has no excerpt, the recall receipt says why: no room was left after the summaries, or none of its messages can be quoted.

For an older Individual group chat, confirm missing character knowledge ranges once. A character's first spoken line is not evidence that they knew everything before it. Select an actual character as **Narrator** only when they should bypass participation limits. Character-specific hiding and confirmed knowledge ranges still restrict memory. Global **Hide from AI**, whether set manually or by automatic summaries, only removes a turn from the live transcript: Advanced Memory still scans it, determines scene participants, summarizes it, and indexes it for permitted recall. Start markers trim the live transcript. You can correct these ranges later; newly added characters need their own confirmation.

For an existing chat, click **Prepare existing history** first. If recovered history changes the boundaries of a scene covered by a manual correction, disable that memory to keep its text for reference, or delete it, then prepare history again. **Fix** (see [Fixing memory problems](#fixing-memory-problems)) skips that scene and lists it instead of stopping. Saving the same correction cannot safely assign its text to a different source range. Preparation works through older history in batches and shows its current stage beside Professor Mari's hamster wheel. **Cancel** retains completed work; **Resume** continues after closing the drawer, restarting the server, or updating the app. A failed model call preserves previously valid memory and displays an error to retry. Do not reset memory to recover from a failed call: Resume reuses completed summaries and unchanged scene detection. The final ongoing scene stays open and is summarized when it closes, with bounded source excerpts used if its live messages exceed the context cap.

To remove a saved summary, open it in **Access memories for this chat** and choose **Delete summary** at the bottom. Confirm the summary and audience in the dialog. This also works for legacy **Continuity** and **Ongoing scene** entries. Deleted scene recaps are not regenerated by routine preparation. Original messages remain intact. New constant summaries live in **Chat Summaries**, where the existing edit, enable/disable, combine, and delete controls apply; legacy vault continuity is no longer used as an additional constant.

### Fixing memory problems

When something in a chat's memory is broken, you see it without opening the memory settings. A steady dot in your accent color appears in a corner of the **Chat Settings** button, and a notice says how many scenes have problems. Each set of problems is announced once; the dot stays until they are settled. In **Chat Settings → Memory Recall**, the same problems are listed above the settings, and **Access memories for this chat** shows the same dot.

Press **Fix**, in the notice or in that list, to repair every flagged scene in one run. It uses the **Helper model** and the usual progress bar. **Pause processing** stops it and **Resume processing** continues the Fix; work already done is kept. Fix:

- asks the helper again who was in scenes marked **Check who was there**, and saves a clear answer. If the helper still can't tell, nobody gains access: the scene keeps only characters it already had and the helper didn't leave out, and it is listed for you to check;
- checks who was in older scenes saved before participant checks, including ones whose automatic check failed;
- writes new summaries for scenes whose messages, hidden messages, character names or supporting summaries changed, and for finished scenes that have no summary. Summaries you deleted stay deleted;
- resumes memory work that stopped with an error.

Fix never rewrites a summary you edited by hand. If one no longer matches its messages, misses messages that are shown again, or its scene boundaries moved, Fix leaves it alone and lists it under **need your review**, then carries on with the other scenes. Settings it can't change for you, such as confirming each character's knowledge range or choosing a working Decision connection, stay listed until you change them.

When Fix finishes, it shows **Fixed N scenes** and the scenes that **need your review** as scene numbers. Select a number to open that scene in **Access memories for this chat**. If Chat Settings was closed, a notice with **Show** brings you there. A scene Fix couldn't decide is not asked about again on the next Fix; save its character access yourself.

### Re-scanning scenes

If scene changes were missed, for example when a scene never ended and nothing new was summarized, use **Re-scan scenes** in **Chat Settings → Memory Recall**. Enter the first and last message number to check, then press **Re-scan**. It starts out on the ongoing scene. Advanced Memory finds the scene changes in those messages again, with the Decision model when **Use Decision model** is on and otherwise the Helper model, and summarizes the scenes that changed. Scenes outside those messages keep their boundaries and summaries, and the regular checks after each reply carry on as before. If a summary you edited would change, the re-scan stops and names that scene, as preparation does.

### Optional Decision model

Turn on **Use Decision model** in Advanced Memory, then pick a model in **Memory Decision connection**. Under **Local models** it lists the same local models as the global **Decision model**, such as the **Primary local model** you run in **Local Model**. One that cannot answer yet is greyed out with the reason, and one that is stopped starts when Advanced Memory asks it. Under **Connections** it lists your saved Decision connections. Create one in **Connections** using TypeSafe, OpenRouter or a compatible Decision source; see [Decision Models](../connections/decision-models.md). This option is off by default and saved for each Roleplay chat. Its choice is separate from the global Decision default.

The selected model identifies scene boundaries during history preparation and ongoing scene checks. Before a new reply, it chooses memories in two passes. Ordinary recall first shortlists up to 24 scene recaps, or up to **Maximum recalled scenes** if that is higher, by text matching and, where saved vectors exist, embeddings. The model picks the relevant scenes from that shortlist, then judges up to 12 of each chosen scene's original messages, its best text matches, to choose that scene's excerpt. The best pick is the centre, and the other picks lengthen the excerpt up to **Maximum messages per excerpt**. When it accepts none of a scene's messages, text matching centres the excerpt and the recall receipt says so. A scene where none of those messages fits on its own in the space the summaries left cannot get an excerpt, so the model does not judge its messages; when that applies to every chosen scene, it sends no second request. For each new message, it checks whether the story moves to another place or time, switches to characters who are somewhere else, or follows a scene-break line such as `***` or an out-of-character POV note. It sees the three messages before and who wrote each one. Uncertain boundaries leave the scene open. The **Helper model** still writes every summary and continuity update. Recalled scenes, excerpt lengths, character access and token budgets keep their existing limits. A valid decision can select nothing.

Hosted connections receive recent conversation text and the shortlisted recaps or messages being scored, and may charge for multiple requests per reply. Recall filters character access and renders private summary conditions before sending candidates. It sends only original messages that the characters recalling the scene saw in the chat, and each character still gets only the parts of a summary meant for them. Requests use bounded batches within the selected connection's context budget, rather than assuming the context advertised for a Jev chat router applies to Decision requests.

Each recall pass has its own 10-second decision limit. Missing connections, incomplete answers, oversized candidates, errors and timeouts fall back to ordinary recall: the shortlist's own ranking chooses scenes and text matching chooses excerpts; unavailable scene decisions fall back to the existing scene checker. While this option is on, preparation indexes text without creating new embeddings. Existing vectors remain available for fallback. After turning it off, use **Reindex** if you want embeddings for records prepared in Decision mode.

Prompt inspection stays read-only and previews ordinary recall without calling the Decision provider. In **Peek Prompt → Decision diagnostics**, **Advanced Memory activity** shows saved results from the latest recall and scene check: model, time, scores, selected memories or scene starts, fallback status, and why a recalled scene has no excerpt. Reports are recorded for new calls after this update and keep up to 128 results, with selected results first. These are past activity, not predictions for the preview; opening the panel or testing prompt statements does not rerun memory decisions. Decision model scene checks always use their own request, separate from tracker and agent batches. The recall receipt identifies decisions and fallbacks. Compatible swipes and continuations reuse saved selections; changing these settings invalidates incompatible snapshots.

### Deciding who sees new messages

In a Roleplay group chat where characters reply one by one, Advanced Memory can decide which characters see each new message, so you don't have to hide every line from a character who has left the scene. Turn on **Decide who sees new messages** in Advanced Memory. It is off by default and only appears in group chats where characters reply one by one; merged group chats and one-character chats don't offer it.

When it is on, each new message, yours or a character's, is hidden from the characters who aren't in that scene. The result uses the same per-character **Hide from AI** as the message's own button, so the crossed-eye marker shows who can't see it. Your own message is decided as soon as you post it, even when no character replies. Before the next character replies, the earlier messages are already decided, so that character never reads a line they shouldn't.

- The **Narrator** chosen here, and the **Narrator character** chosen under **Roleplay Commands**, always see every message. A message's author always sees their own message. A whisper's recipient who isn't in the scene loses the rest of the message but still gets the whisper.
- With **Use Decision model** on, the Decision model is asked, for each character, whether they clearly can't see or hear the message, for example because they are somewhere else or have left. A character the story never puts in the scene counts as somewhere else. A character who is there but left out of a whisper still sees the rest of the message. Otherwise the **Helper model** decides. Either way, a message is hidden only when the model is sure; when it isn't, the character keeps seeing it. When a scene check is due after a reply, the same request also answers who is present, so no extra call is made for those messages.
- The model reads the messages so far in the current scene, and always at least the last few before it, even when a new scene has just started. It also gets a list of the characters who have spoken since the current scene began. That list is only a hint: a character who is quietly listening in still counts as present, even if they haven't said anything.
- If you change a message's **Hide from AI** yourself, or use `/hide` or `/unhide` on it, before or after the automatic choice, your choice stays and Advanced Memory never changes that message again. Messages you had already hidden from someone are left alone.
- Each message is decided once. If the model fails or doesn't answer in time, nothing is hidden for that message, and the error appears in the server log.

### While chatting

Scene detection runs after the main Roleplay reply is saved. **Standalone scene check interval (messages)** defaults to **5**. Once that many new messages have arrived, the checker receives every message since the last check (up to twice the interval), the message the last check ended on for comparison, scene instructions and output format. It identifies the exact message ending each scene, which can be that earlier message, or returns no endings when the scene continues. Both persona and character messages count. The cadence is independent of tracker schedules, but with Decision mode off, a due check shares an eligible post-processing tracker call when its source visibility and context budget allow it; otherwise the helper makes a standalone call. Each new scene range begins after the previous scene's end and includes the newly reported ending message. Only a detected ending triggers background preparation of that completed scene's summary and message index, including when the latest reply ends the scene. Uncertain transitions leave the scene open. **Chat Settings → Agent activity** shows preparation as **Advanced Recall**, including progress, errors and recovery controls, even when ordinary agents are disabled. Progress polls only while a memory job is running; ready archives are not polled while idle.

With Decision mode off, ordinary recall reads prepared memories instead of preparing the archive again. An optional query embedding has a short time limit and falls back to text matching if unavailable. Text matching gives distinctive terms in the latest user message more weight, so a brief detail can find a long scene recap. A name it mentions, such as a pet's, counts most. The responding characters' and your persona's names do not, nor does a name that appears in most memories. Indexed original messages can also find scenes when excerpt output is disabled. Text matching adds no model call. Recall runs only for the main Roleplay generation: agent calls, manual agent reruns and auxiliary dry-run generations neither trigger it nor receive its returned summaries or excerpts. Main prompt inspection remains read-only.

Regenerated swipes reuse the earliest compatible saved memory from that reply, including its continuity, scene summaries and exact excerpts. Unchanged swipes do not search or call the summary helper again. Continuing a reply preserves the memory used when it first began. Older replies without a saved memory snapshot prepare one on their next generation, then reuse it on subsequent swipes; no archive reset is needed. Background constant additions and combinations retain compatible swipe memory. User changes to history, access settings, summaries or saved memories invalidate incompatible snapshots, and the current context cap is always enforced. A swipe also recalls again when an earlier scene its character could recall was saved, edited, turned on or turned off since that reply. A scene that is still part of the swiped reply's chat history cannot be recalled yet, so saving it does not trigger another recall.

Main generation reads saved memory immediately. It never starts or waits for continuity generation, including when a background helper is still running. When the outgoing prompt reaches the cap, the live window resets to the beginning of the latest scene for **all characters**, then grows until it reaches the cap again. The automatic cutoff appears in the existing **Mark as new start** control with **All** selected; uncheck All to undo it. Personal start flags still apply. If an unfinished scene or oversized constant cannot fit, the request uses explicitly marked source excerpts while retaining the latest messages. This temporary fitting does not create another persistent flag. Saved summaries and original messages are not overwritten.

After the main reply, Advanced Memory extends the existing ranged **Chat Summaries** only for uncovered archived messages. It reuses completed scene recaps where possible. Existing entries, including inactive ones, count as already handled ranges. When eligible active constants exceed 70% of **Summary and recall budget**, **Updating continuity** combines only their summary texts after the reply, using the selected helper and **Chat Summary → Maximum output size**. Constants overlapping live messages are excluded from both this budget and compaction; legacy unranged constants remain eligible. The reply that crosses the threshold still generates normally with saved eligible constants; compaction never holds it up. The extra 2,000 tokens belong to total memory, not the constant share. Summaries Advanced Memory wrote with private parts for some characters, in `{{#if char == "Name"}}…{{/if}}` sections, are combined with the other summaries the same characters read. The helper gets them with those conditions and your **Combine prompt**, and must keep each private part for exactly the characters who knew it. If its result would change who can read a private part, it is not saved: those summaries stay as they are and only the others are shortened. Summaries you wrote or edited yourself, and others whose macros expand differently for each character, stay unchanged; if they alone exceed the target, they need a manual edit. Other groups receive proportional length guidance, not a hard rejection threshold. A complete, shorter replacement appears in Chat Summaries with a message-range title, and replaced entries become inactive together. Failed or unfinished output is not saved; existing entries remain usable and **Resume processing** retries unfinished work. Scene recaps stay in the vault.

The archive can recover relevant scene summaries and exact dialogue with original message numbers and speakers. One **Recalled Scenes** section contains each summary immediately followed by its excerpt, if available, with one range heading for the excerpt. Scenes without excerpts stay in that same section. The recalled block identifies the present live-history range and the last user-message number so historical events are distinguishable from the current turn. Scene recaps are recalled only when all their source messages are outside the live history being sent; exact recalled messages also exclude live messages. Ranged **Chat Summaries** are likewise omitted while any covered messages remain live. They stay saved and enabled, and become eligible again once their entire range is outside the live window. Eligible constants take priority over optional recall, retaining their character conditions. All selected scene summaries reserve space before any scene receives a message excerpt. Character access and historical source limits still apply. Illustration attachments and image captions are omitted from recalled message text and new summary inputs; readable text attachments remain available. Both persona and character messages count. Historical regeneration only uses sources before the target, including when the target predates the current managed window. Editing, swiping, hiding or deleting source messages causes affected derived memory to be checked again before use.

Open **Access memories for this chat** in the same drawer to search chronologically numbered scene summaries, inspect their timeframes and audiences, edit **Summary text**, or read the full original messages with **Inspect source messages**. Internal verbatim excerpts are not separate scene-summary entries. Source-grounded story timeframes accompany recalled context; unknown dates stay unknown. You can disable recall records, reindex, export/import, or confirm **Delete all memories** to restart memory preparation while retaining the original chat and settings. Corrections to original manual summaries are preserved and invalidate dependent continuity. To keep a scene out of recall, disable its memory record. Character-specific source hiding still controls who can access it; global hiding does not remove it from the archive.

Each scene summary also records who took part. A participant name that differs from the character card, such as "Kaito" for **Kaito Nakamura**, still counts when it fits exactly one character and cannot be your persona's name. Names shared by two characters or by a character and your persona, descriptions such as "Kaito's sister", and names with notes such as "(mentioned)" never give a character access. Your persona's own name is not a mistake and gives no character access. When the helper doesn't say who took part, the scene goes to every character: the only character in a one-character chat, or all of them in a group chat. In a group chat, Advanced Memory then counts it as a memory problem and marks the scene **Check who was there** in **Access memories**, so you can remove anyone who wasn't there with **Edit character access**, or let **Fix** ask the helper again. Names that fit no character give no access and are marked the same way, so you can set the scene's participants. A scene the helper explicitly lists as having only you in it stays narrator-only. Scene summaries saved before participant checks existed stay narrator-only until checked: **Fix** and **Prepare existing history** check all of them, and each reply that finishes a scene also checks up to three. A scene whose automatic check fails waits for **Fix** or **Prepare existing history**.

A character present for part of a scene can share its memory access with other participants, even when some messages are hidden from them. A scene with no accessible source messages remains unavailable. New recap instructions identify message visibility, keep shared events in plain prose, and reserve `{{#if character == "Name"}}…{{/if}}` for private sections. Mentioning an absent character does not make them a participant. If source visibility or the name of a character the recap was written for changes, an old recap is withheld from partial readers until you prepare that scene again (**Fix** does this for every such scene), or review its private conditions and save the corrected text. A character who joins the chat later does not count as a change, unless only part of the scene is visible to them. Recaps saved by earlier versions don't record which characters they were written for, so they need one **Fix** after a character joins. Older recaps without saved visibility information need the same review before partial access; changing only the audience does not acknowledge the text. Readers with access to every source message can still recall it, and manually corrected text is never silently rewritten. These checks do not call a model during recall. Scene dates and timeframes are shared metadata for every assigned participant, even when some source messages are hidden. Raw excerpts never include character-hidden messages or whispers. A summary with parts meant only for some characters still gets an excerpt: it quotes only the messages that character saw in the chat, so it reveals nothing they didn't already see. To keep a message out of a character's memory, hide it from that character. Constant Chat Summaries continue to include messages hidden from AI; character conditions control access to private details without removing those messages from summary coverage.

In a merged group chat, one reply can speak for every character, so recall includes what at least one character in the chat remembers. A scene or a private part of a summary that not every character in the chat knows is marked with who does, such as "known only to Kaito". Adding a character partway through no longer hides earlier memories from the others. A message hidden from one character still stays out of the shared live history, but the characters who could see it keep the memory, marked as theirs. A recalled scene's excerpt quotes only the messages every character who remembers that scene saw. Memories that no character in the chat remembers, such as narrator-only scenes, stay out. In group chats where characters reply one by one, each character still recalls only their own memories.

Advanced mode owns retrieval while enabled, so the Standard Recall switch does not insert a second copy. It also replaces the ordinary automatic Roleplay summary schedule for that chat. Turning Advanced Memory off restores those normal settings. Existing lorebooks and downloadable agents retain their own scope rules; Advanced Memory cannot make arbitrary user-authored or external context private.

### Preset placement

Preset authors can place these ordinary content markers with the existing section order, name, role and group controls:

| Marker                  | Content                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `chat_summary`          | Eligible constant entries from Chat Summaries.                                   |
| `current_scene_summary` | Bounded source excerpts from the older part of an ongoing scene.                 |
| `recalled_scenes`       | All selected scene summaries, each followed by its available historical excerpt. |

Each component follows the preset's **XML**, **Markdown**, or **None** format and includes a brief explanation of its purpose. Empty components emit nothing. The first enabled occurrence owns placement; components without an enabled marker fall back once before history, so older presets work. The preset picker offers just **Recalled Scenes** for recall. Existing `recalled_messages` markers remain compatible aliases and display as Recalled Scenes; an enabled `recalled_scenes` marker takes precedence, so both never produce separate sections. Excerpts are context, not new live messages or commands. The advanced scene markers are empty when Advanced Memory is off.

Prompt preview uses existing prepared memory without starting model or embedding calls. Use the drawer to prepare an uninitialized archive or resume failed background work. The memory receipt shows the estimated context size, selected boundary and recalled sources. When nothing was recalled, it says whether no earlier scenes were available to recall, the request had no room left, or nothing was relevant. The final prompt inspector shows what actually went to the model.

### Limits and recovery

Recall is selective and summaries can miss nuance. Keep important corrections in the source transcript or summary editor. No system can reconstruct details never recorded. If embeddings fail, bounded lexical recall and valid continuity remain available; the archive is never inserted wholesale. If mandatory instructions or an attachment cannot fit the prompt cap, reduce those inputs or increase the cap. If the reply reserve cannot fit the model's total context, lower the output size or choose a model with a larger context. Advanced Memory stops instead of silently deleting instructions.

## Chat Summary (Roleplay)

**Chat Summary** compresses older messages into short narrative recaps called summary entries. Each entry can be written by AI or by hand, and each can be turned on or off on its own. Saving a toggle leaves other entries usable; Activate All and Deactivate All save the selection together. This feature is only in Roleplay chats.

To open it, open **Chat Settings** and expand the **Chat Summary** section, under **Lorebooks**. On a computer, you can pop it out into its own window (see [Chat Settings Overview](../chats/chat-settings.md#popping-a-section-out-into-its-own-window)).

### Creating a summary entry

1. Under **Summary Scope**, choose **Last** to summarize the most recent messages, or **Range** to pick a specific message range.
2. Click **Generate** to have the AI write an entry from that scope.
3. Or click **Write** to create a blank entry and type the recap yourself.

Each entry in the list shows a title, a source range or message count, and an estimated token size. You can enable or disable an entry, expand it, click **Edit** to change it, or **Delete** it. Bulk buttons let you **Show Inactive** or **Hide Inactive** entries and **Activate All** or **Deactivate All** at once.

Tick entries to select them; on a computer, Shift-click another entry to select the visible range between them, then use **Enable selected** or **Disable selected** to change only the selected entries.

In a merged group chat, one reply can speak for every character. A part of an entry written for certain characters, such as `{{#if char == "Kaito"}}…{{/if}}`, is kept for every character in the chat it applies to and marked with who knows it, such as "known only to Kaito". Parts only the Advanced Memory **Narrator** gets stay out. In group chats where characters reply one by one, and in one-character chats, each character reads the entries as before.

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

The **Display** controls in **Chat Summary** decide how summarized messages appear on screen:

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
