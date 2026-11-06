# Chat Branches

A branch is a copy of a chat up to one message. Use it to try a different path while the original stays safe. This guide covers making, switching, viewing, renaming, deleting, exporting and importing branches.

All branches of one chat are grouped. In the chat list the chat keeps one row and shows a branch count. When at least one branch in the group records which chat it came from, click the count to open the tree; a branch without that record sits directly under the chat. If no branch in the group has the record (older or imported branches), the group stays in one row; open its branches from **Chat Branches**. A branch made from a branch nests under it, so you see a tree. Each branch has a display name and a last-active time, so you can label them "friendly ending" and "dark ending". The display name is separate from the chat name. A Game group keeps one row, because Game sessions are numbered sessions, not branches.

## Branch from here

1. Tap the message (on a computer, point at it) to show the message action bar.
2. Click **Branch from here**, the small branching icon.

Marinara copies the chat up to and including that message into a new branch named **New Branch**. You can rename it later.

The branch:

- Keeps the same mode, characters, persona, prompt preset and connection.
- Copies every message with all swipes and which swipe was active. See [Message Actions](messages.md).
- Copies tracker and game state tied to the copied messages.
- Keeps Advanced Memory's work in a Roleplay chat. Memories of earlier, finished scenes stay ready to recall. The scene you branch from becomes the ongoing scene again, and its old memories are dropped. See [Memory Recall and Chat Summaries](../agents/memory.md).
- Stays in the same chat folder as the source.

Day and week summaries do not carry over. Rolling summaries that lie fully inside the copied messages carry over. Summaries that cross the branch point, and old summaries without message data, are left out, and the branch starts those fresh.

If it did not work: **Branch from here** does not appear in a scene chat. Scene chats have **Clone from here** instead. See [Scenes: Branching a Roleplay](../roleplay/scenes.md).

## The Chat Branches section

Open **Chat Settings** and expand **Chat Branches**, under **Chat Name**. Its header shows the branch count. On a computer you can pop it out into its own window. See [Chat Settings](chat-settings.md#popping-a-section-out-into-its-own-window).

The section lists every branch of the chat, with the one you are viewing first. Each row shows the display name and last updated time. Click a row to switch to that branch.

Buttons above the list:

| Button | What it does |
| --- | --- |
| **Branch graph** | Opens the graph window. See below. |
| **JSONL**, **Text**, **Markdown**, **Story** | Export the branch you are viewing. See [Exporting and Importing Chats](export-import.md). |
| **Export a range** | Exports part of the chat. Not in Game. See [Exporting and Importing Chats](export-import.md#export-part-of-a-chat). |
| **Import** | Adds a `.jsonl` file as a new branch. See below. |
| **Stats** | Opens chat statistics for the branch you are viewing. |

### See the branch graph

The graph shows where each branch split off, which the list cannot.

1. Open **Chat Branches** and click **Branch graph**. Click it again to close the graph.

The graph opens in its own window that you can move and resize. On a phone it opens as a sheet. Each chat in the group gets one row, in the same order as the chat list. Messages run left to right, one dot per message.

- Grey dots are your messages, accent-colored dots are character replies, and hollow rings are narrator or system messages.
- A branch draws only its own messages. A line joins it to the message it was branched from.
- A branch with no recorded fork point is drawn from the top chat with a dashed line, and the legend shows **Fork not recorded**. This covers older branches and branches whose source chat was deleted.
- Long stretches with no fork fold into a **··· N ···** marker, where N is the number of hidden messages. Click it to show them. **Expand all** unfolds every stretch and **Collapse long runs** folds them again.
- Fork points and each branch's latest message have a ring. Tap it, point at it, or focus it with the keyboard to see the message number, who wrote it and the start of its text.
- Click a branch's name or row to switch to it. The branch you are viewing is highlighted.

The graph updates when you branch, rename or delete a chat, and shortly after new messages arrive.

### Rename a branch

1. In **Chat Branches**, click the pencil button on the branch row.
2. In the **Rename Branch** dialog ("Set a display name for this chat branch."), type a new name.
3. Click **Rename**.

An empty or unchanged name is ignored.

### Delete a branch

1. In **Chat Branches**, click the trash button on the branch row.
2. In the **Delete Branch** dialog ("Delete this branch? Messages will be lost."), click **Delete**.

This removes that branch and its messages only. The other branches stay.

With two or more branches, **Delete All Branches** appears at the bottom of the section. It asks "Delete all N branches? This cannot be undone." Confirm with **Delete All**. You can also start from the chat list, where deleting a chat with branches offers **Delete This Branch Only** and **Delete All N branches**. See [Managing Your Chat List](managing-chats.md#delete-a-chat).

### Import a file as a new branch

1. In **Chat Branches**, click **Import**.
2. Pick a `.jsonl` file exported from SillyTavern or Marinara.

Marinara adds it as a new branch in the current chat's group, shows "Imported N messages as a new branch", and switches to it.

## How branches are linked

This section is for people who build on branch data.

- Each branch records its immediate source chat and the message where the fork was made. Both the source message ID and its copied message ID are kept, so integrations can find the fork boundary even though copied messages get new IDs.
- Branching a branch records that branch as the parent, not the original root.
- Once at least one branch in a group records its source, clicking the count in the chat list opens the tree. A branch with an unknown source sits directly under the chat. A group with no known source keeps one row, and its branches are reached from **Chat Branches**.
- Deleting a parent chat does not change its children's recorded source. Deleting the whole group deletes every chat in it.
