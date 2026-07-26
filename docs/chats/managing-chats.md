# Managing Your Chat List

This guide covers the chat list in Marinara Engine. It explains the three mode tabs and how to create, import, rename, delete, organize, search, and bulk-manage your chats. It also covers the recent chats row on the Home screen.

## The chat list and mode tabs

Your chats live in the **Chats** panel, the sidebar on the left. At the top of the panel are three mode tabs:

- **CONVO** for Conversation, a plain messaging-style chat.
- **RP** for Roleplay, an immersive scene with characters and world tracking.
- **GM** for Game, an AI-run single-player RPG.

Each tab shows only the chats of that mode. Clicking a tab switches the list.

Each row in the list shows the chat name and the avatar of its character or characters. In Conversation chats, a small colored dot on the avatar shows each character's status. If a red badge appears on a row, that is the count of unread messages.

Some rows show a small branch icon with a number. This means the chat has more than one branch, and the branches are grouped into a single row. To learn what branches are, see [Chat Branches](branches.md).

## Creating a new chat

1. Pick the mode tab you want (**CONVO**, **RP**, or **GM**).
2. Click the **+** button near the top of the panel. Its tooltip reads **New Conversation**, **New Roleplay**, or **New Game**, matching the active tab.
3. The app creates the chat, opens it, and opens the **Chat Settings** panel plus a setup wizard so you can finish setup.

The new chat is named **New Conversation**, **New Roleplay**, or **New Game**. You can rename it later (see Renaming a chat below).

You need at least one connection before a chat will open. A connection links Marinara to an AI provider. If you have no connection yet, a **Set Up** window appears instead of the chat. It asks you to choose a connection first. If you have none at all, it shows **No connections found** with an **Open Connections** button. To set one up, see [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

If you saved a starred default settings profile for that mode, Marinara applies it to the new chat automatically. See [Chat Settings Overview](chat-settings.md).

## Importing a chat

You can import a chat log saved as a `.jsonl` file, from SillyTavern or from Marinara.

1. Pick the mode tab you want the imported chat to land in.
2. Click the **Import** button near the top of the panel. Its tooltip reads **Import SillyTavern or Marinara chat JSONL**.
3. Choose your `.jsonl` file.

Marinara creates a new chat in the current tab's mode and opens it. You should see a message that reads **Imported N messages**, where N is the message count.

For all the ways to import and export chats, including bulk import and export formats, see [Exporting and Importing Chats](export-import.md).

## Renaming a chat

The chat name is only visible to you. It is not sent to the AI and does not change the conversation.

1. Open the chat.
2. Open the **Chat Settings** panel using the gear button in the chat toolbar.
3. In the **Chat Name** section, click the current name to turn it into a text box.
4. Type the new name, then press Enter or click the checkmark button.

For more on the Chat Settings panel, see [Chat Settings Overview](chat-settings.md).

## Deleting a chat

To delete a single chat, hover over its row and click the trash button. On mobile, the trash button is always shown. A dialog titled **Delete Chat** asks "Delete this chat?". Click **Delete** to confirm.

Deleting a chat is permanent. It also stops any reply that is still being generated for that chat.

### The branch choice dialog

If the chat you delete has more than one branch, a different window opens instead. It is titled **Delete Chat** and says the conversation has several branches. It gives you two choices:

- **Delete This Branch Only** removes just the branch you clicked.
- **Delete All N Branches** removes every branch in the group, where N is the branch count.

To manage branches without deleting the whole chat, see [Chat Branches](branches.md).

### Turning delete confirmations on or off

An app-wide setting called **Confirm before deleting** controls whether these confirmation dialogs appear. It is on by default and is found in **Settings** under the **General** tab. Its own help text recommends keeping it on.

## Chat folders

You can group chats into folders inside each mode tab.

1. Make sure the current tab has at least one chat. The **New Folder** button appears above the list only then.
2. Click **New Folder**. The folder is created with the name **unnamed** (or **unnamed 2**, **unnamed 3**, and so on if that name is taken).

To rename a folder, double-click it, double-tap it, or focus it and press F2. Renaming to an empty name is ignored.

To delete a folder, click the trash button on the folder row. A dialog titled **Delete Folder** confirms it. Deleting a folder never deletes the chats inside it. Those chats move back to the top level.

To reorder folders, drag them up or down by the grip handle.

To move a chat into a folder, drag its row onto the folder. To take a chat out of every folder, drag it onto the empty area below the folders. On a touch screen, press and hold a chat for about half a second to start dragging. If you have several chats selected, dragging one of them moves the whole selection.

Chats that are not in any folder appear in a plain list below the folders.

## Searching, sorting, and filtering by tag

Each mode tab has its own search box at the top of the list. The placeholder text changes per tab: **Search conversations...**, **Search roleplays...**, or **Search games...**. The search matches the chat name, its tags, and the names of its characters. It does not search inside message text.

Next to the search box is a sort menu with the tooltip **Sort chats**. It has four options:

- **Newest**, the default, shows the most recently active chats first.
- **Oldest** shows the least recently active first.
- **A-Z** sorts by name from A to Z.
- **Z-A** sorts by name from Z to A.

If any chat in the tab has tags, a tag filter row appears. Click the **Tags** chip to expand the tag list. Then click a tag to show only chats that carry it. Click **Clear** to remove the filter. When there are many tags, a **+N more** chip reveals the rest.

Note: this screen only filters by tags a chat already has. There is no button here to add a tag to a chat.

The list shows up to 100 chats at a time. If you have more, a **Load more** button appears at the bottom to reveal the next batch.

## Selecting multiple chats

You can act on several chats at once.

1. Click the **Select chats** button near the top of the panel (the checkmark icon).
2. Click each chat you want. A checkbox toggles on each selected row instead of opening the chat.
3. A bar at the bottom shows how many chats are selected, with two buttons.

The **Export** button downloads all selected chats together as a single `.zip` file. The **Delete** button removes them. Delete shows a confirmation titled **Delete Chats** first.

To leave selection mode without acting, click the select button again. Switching tabs also clears the selection.

## Recent Chats on the Home screen

The Home screen shows a compact **Recent Chats** row with your three most recently active chats. Each chat appears as a small chip with an avatar, a mode badge, and the chat name. Click a chip to open that chat. If you have no chats yet, the row reads **No chats yet**.

## Related guides

- [Chat Branches](branches.md)
- [Exporting and Importing Chats](export-import.md)
- [Chat Settings Overview](chat-settings.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
