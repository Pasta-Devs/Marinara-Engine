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

Open **Chat Settings → Memory Recall** and enable **Advanced Memory Recall (Alpha)**. This optional mode manages the live history window, continuity summaries, and relevant old excerpts together. Settings, setup progress, and the archive viewer stay inside the Chat Settings drawer on desktop and mobile.

### Setup

- Choose a **maximum context** that your chat model supports. The cap covers estimated prompt tokens, tools, attachments, reply space, and safety headroom. It is an estimate, not an exact tokenizer or billing limit.
- Choose the **constant-summary budget** within that cap. A short continuity snapshot is included once in each request. Recent messages remain uncompressed while the full request fits.
- The **helper connection** makes small scene decisions. It defaults to the agent connection, falling back to the chat connection. Initial historical processing can use the main or helper model; the resolved models are shown before preparation.
- Scene summaries and compaction use your existing **Summaries** model and prompts. Advanced Memory runs independently of the main Agents switch and needs no downloadable agent.
- The preferred neighboring-message range defaults to **3–10**. Relevance, character access and available space can produce fewer messages, including none.

For an older Individual group chat, confirm missing character knowledge ranges once. A character's first spoken line is not evidence that they knew everything before it. Select an actual character as **Narrator** only when they should bypass participation limits. Explicit hidden messages and manual start markers still restrict memory. You can correct these ranges later; newly added characters need their own confirmation.

Preparation works through older history in batches and shows its current stage beside Professor Mari's hamster wheel. **Cancel** retains completed work; **Resume** continues after closing the drawer or restarting the server. A failed model call preserves previously valid memory and displays an error to retry.

### While chatting

When the full request reaches the cap, Advanced Memory drops optional recall first, then moves older completed scenes into continuity. If one unfinished scene is too large, it temporarily summarizes the older part while leaving the scene open. Original messages and manual start/visibility settings are retained.

The archive can recover relevant scene summaries and exact dialogue with original message numbers and speakers. Both persona and character messages count. Historical regeneration only uses sources before the target, including when the target predates the current managed window. Editing, swiping, hiding or deleting source messages causes affected derived memory to be checked again before use.

Open **Access memories for this chat** in the same drawer to inspect scene sources and audiences, edit summaries, disable recall records, reindex, or export/import. Corrections to original manual summaries are preserved and invalidate dependent continuity. Disabling a record is distinct from hiding its source messages: hidden source messages are the authority for character knowledge.

Advanced mode owns retrieval while enabled, so the Standard Recall switch does not insert a second copy. It also replaces the ordinary automatic Roleplay summary schedule for that chat. Turning Advanced Memory off restores those normal settings. Existing lorebooks and downloadable agents retain their own scope rules; Advanced Memory cannot make arbitrary user-authored or external context private.

### Preset placement

Preset authors can place these ordinary content markers with the existing section order, name, role and group controls:

| Marker                  | Content                                                   |
| ----------------------- | --------------------------------------------------------- |
| `chat_summary`          | The character's bounded continuity snapshot.              |
| `current_scene_summary` | Temporary summary of the older part of an ongoing scene.  |
| `recalled_scenes`       | Relevant archived scenes.                                 |
| `recalled_messages`     | Exact historical excerpts with speaker and source labels. |

Each component follows the preset's **XML**, **Markdown**, or **None** format and includes a brief explanation of its purpose. Empty components emit nothing. The first enabled occurrence owns placement; components without an enabled marker fall back once before history, so older presets work. Excerpts are context, not new live messages or commands. The three new markers are empty when Advanced Memory is off.

Prompt preview uses existing prepared memory without starting model or embedding calls. If initialization or compaction is needed, prepare it in the drawer first. The memory receipt shows the estimated context size, selected boundary and recalled sources; the final prompt inspector shows what actually went to the model.

### Limits and recovery

Recall is selective and summaries can miss nuance. Keep important corrections in the source transcript or summary editor. No system can reconstruct details never recorded. If embeddings fail, bounded lexical recall and valid continuity remain available; the archive is never inserted wholesale. If mandatory instructions, an attachment or the reply reserve alone cannot fit, reduce those inputs or increase the cap; Advanced Memory stops instead of silently deleting instructions.

## Chat Summary (Roleplay)

**Chat Summary** compresses older messages into short narrative recaps called summary entries. Each entry can be written by AI or by hand, and each can be turned on or off on its own. This feature is only in Roleplay chats.

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
