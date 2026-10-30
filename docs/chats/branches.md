# Chat Branches

This guide explains chat branches in Marinara Engine: what a branch is and how to make one. It also covers switching, viewing the branch graph, renaming, deleting, exporting, and importing branches. A branch lets you try a different path in a chat without losing the original.

## What a branch is

A branch is a copy of a chat that shares history up to a chosen point. You use branches to explore a different direction while keeping the original chat safe.

All branches of the same chat are grouped together. In the chat list, the chat keeps its row and shows a branch count. Once at least one branch in the group records which chat it was made from, clicking that count opens the branches underneath it. Inside that tree, a branch whose source is unknown sits directly under the chat. The same happens when the source chat has since been deleted. Game sessions are numbered sessions rather than branches, so a Game group always keeps its single row. Each branch shows its display name and when it was last active. A branch made from a branch nests under that one, so branches of branches read as a tree instead of a flat pile. You can switch straight to a branch from the list, or use the **Chat Branches** section of **Chat Settings** (see below) to rename, delete, export or import them.

Each branch can have its own display name, so you can label them like "friendly ending" and "dark ending". This display name is separate from the underlying chat name.

Branch lineage records the immediate source chat and the message where the fork was made. The source message ID and its copied message ID are both retained; this lets integrations identify the fork boundary even though copied messages receive new IDs. Branching a branch records that branch as the immediate parent, not the original root. Older branches and imported siblings keep their display name but have no known lineage: a group with no known lineage keeps its single row in the chat list, and its branches are still reached from the **Chat Branches** section.

## Branch from here

You create a branch from any message in the chat.

1. Hover over a message (or tap it on mobile) to show the message action bar.
2. Click the **Branch from here** button. It uses a small branching icon.

Marinara copies the chat up to and including that message into a new branch. The new branch:

- Keeps the same mode, characters, persona, prompt preset, and connection as the source chat.
- Copies every message, including all swipes (alternate replies) and which swipe was active. See the [Message Actions guide](messages.md) for how swipes work.
- Copies tracker and game state snapshots tied to the copied messages, so Roleplay and Game chats keep their state.
- Keeps Advanced Memory's work in a Roleplay chat, so you do not have to prepare the copied history again. Memories of earlier, finished scenes stay ready to recall. The scene you branch from becomes the ongoing scene again, and its old memories are dropped. See [Memory Recall and Chat Summaries](../agents/memory.md).
- Starts with the display name **New Branch**. You can rename it (see below).
- Stays in the same chat folder as the source chat.

An empty chat has null message anchors. Deleting a parent chat does not change its children's historical lineage. Deleting the whole branch group still deletes every chat in that group.

Day and week summaries do not carry over. Rolling summaries with persisted message ranges fully contained in the copied branch are carried over and remapped to the branch's new message IDs. Summaries whose source range crosses the branch point, or legacy summaries without message metadata, are left out. The new branch starts those fresh.

You cannot branch a scene chat. In a scene chat, the **Branch from here** button does not appear. Scene chats have a separate **Clone from here** action instead. See [Scenes: Branching a Roleplay](../roleplay/scenes.md) for how it works.

## The Chat Branches section

Open **Chat Settings** and expand the **Chat Branches** section, under **Chat Name**. Its header shows the current branch count. On a computer, you can pop it out into its own window (see [Chat Settings Overview](chat-settings.md#popping-a-section-out-into-its-own-window)).

The section lists every branch of the current chat, with the branch you are viewing shown first. Each row shows the branch display name and its last updated time.

### Switch to another branch

Click any branch row to open that branch. The chat view switches to the branch you picked.

### See the branch graph

The branch graph shows where each branch split off, which the list cannot.

1. Open the **Chat Branches** section.
2. Click the **Branch graph** button, the long button above the export buttons. Click it again to close the graph.

The graph opens in its own window, which you can move and resize. On a phone, it opens as a sheet. The graph fills the window: a bigger window folds fewer stretches, and a graph with room to spare zooms in and spreads out. A graph slightly too wide shrinks to fit, down to three-quarters size, and scrolls sideways beyond that. The rows share the window's height, and scroll when there are too many chats to fit.

- Each chat in the group gets one row, in the same tree order as the chat list. Messages run left to right, one dot per message. Grey dots are your messages, accent-coloured dots are character replies, and hollow rings are narrator or system messages.
- A branch draws only its own messages. A line joins it to the message it was branched from, so you can see exactly where it split off.
- Older branches and branches whose source chat was deleted have no recorded fork point. They are drawn from the top chat with a dashed line, and the legend shows **Fork not recorded**.
- Long stretches with no fork nearby fold into a **··· N ···** marker, where N is the number of hidden messages. Click it to show those messages, or use **Expand all** to unfold every stretch. **Collapse long runs** folds them again.
- Fork points and each branch's latest message have a ring. Hover over a ring, tap it, or focus it with the keyboard to see the message number, who wrote it and the start of its text.
- Click a branch's name or row to switch to that branch. The branch you are viewing is highlighted, and the graph opens scrolled to its latest message.

The graph updates when you branch, rename or delete a chat, and shortly after new messages arrive.

### Rename a branch

1. Open the **Chat Branches** section.
2. Click the pencil (rename) button on the branch row you want to rename.
3. A dialog titled **Rename Branch** opens with the message "Set a display name for this chat branch."
4. Type a new name and confirm with the **Rename** button.

An empty name, or a name you did not change, is ignored.

### Delete a branch

1. Open the **Chat Branches** section.
2. Click the trash (delete) button on the branch row.
3. A dialog titled **Delete Branch** asks "Delete this branch? Messages will be lost."
4. Confirm with the **Delete** button.

Deleting a branch removes that branch and its messages only. The other branches stay.

### Delete all branches

When a chat has two or more branches, a **Delete All Branches** button appears at the bottom of the section. It asks "Delete all N branches? This cannot be undone." Confirm with the **Delete All** button to remove every branch in the group at once.

You can also start this from the chat list. Delete a chat that has branches from its trash icon. A dialog titled **Delete Chat** then asks what you want to delete. It offers a **Delete This Branch Only** button and a **Delete All N Branches** button. See [Managing Your Chat List](managing-chats.md) for more on deleting from the list.

## Export a branch

The **Chat Branches** section has export buttons at the top. They export the branch you are currently viewing.

- **JSONL**: downloads the branch as a JSONL file. JSONL means one message per line of text, and this format is compatible with SillyTavern.
- **Text**: downloads the branch as a plain text transcript.
- **Markdown** and **Story**: download the branch as a readable Markdown file or a styled web page. See [File formats you will see](export-import.md#file-formats-you-will-see).

For bulk export of many chats at once, see [Exporting and Importing Chats](export-import.md). That guide also covers the option to include the model's reasoning in exports.

## Import a JSONL file as a new branch

You can bring a saved chat log in as a new branch of the chat you have open.

1. Open the **Chat Branches** section.
2. Click the **Import** button.
3. Pick a JSONL file (`.jsonl`) exported from SillyTavern or from Marinara.

Marinara adds the file as a new branch in the current chat's group. You should see a message like "Imported N messages as a new branch". The app then switches to the new branch.

## Related guides

- [Message Actions: Edit, Delete, Swipe, Regenerate](messages.md)
- [Exporting and Importing Chats](export-import.md)
- [Managing Your Chat List](managing-chats.md)
