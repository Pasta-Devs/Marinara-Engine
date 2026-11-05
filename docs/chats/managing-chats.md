# Managing Your Chat List

The **Chats** panel on the left holds every chat you have. Use it to start, find, sort, organize and delete chats.

## The chat list and mode tabs

At the top of the panel are three mode tabs. Each tab lists only the chats of that mode.

| Tab | Mode |
| --- | --- |
| **CONVO** | Conversation: a messaging-style chat. |
| **RP** | Roleplay: a scene with characters and world tracking. |
| **GM** | Game: a single-player RPG run by the AI. |

Each row shows the chat name and the avatars of its characters. In Conversation chats, a colored dot on an avatar shows that character's status. A red badge is the count of unread messages. A row with a small branch icon and a number is a chat with several branches, grouped into one row. See [Chat Branches](branches.md).

## Start a chat

Before you start: add at least one account in **Connections**. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. Click the tab for the mode you want.
2. Tap the **+** button at the top of the panel. Its label is **New Conversation**, **New Roleplay** or **New Game**, to match the tab.

Marinara creates and opens the chat. **Chat Settings** and a setup wizard open beside it. The chat starts with the name **New Conversation**, **New Roleplay** or **New Game**. If you saved a starred default settings profile for Conversation or Roleplay, Marinara applies it to the new chat. See [Settings Profiles](settings-profiles.md).

If it did not work: with no account saved, the **Add account** window opens instead of a chat. Pick a service, click **Connect**, then choose a model. The full steps are in [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

## Import a chat

You can import a `.jsonl` chat log from SillyTavern or Marinara.

1. Click the tab for the mode the chat should land in.
2. Tap the **Import** button at the top of the panel. Its label is **Import SillyTavern or Marinara chat JSONL**.
3. Choose your `.jsonl` file.

Marinara creates the chat, opens it, and shows **Imported N messages**. For export formats and bulk export, see [Exporting and Importing Chats](export-import.md).

If it did not work: a small message at the bottom of the screen reads **Import failed** with the reason. Only `.jsonl` files are accepted.

## Rename a chat

The chat name is for you only. It is not sent to the model.

1. Open the chat, then open **Chat Settings**.
2. In **Chat Name**, click the current name.
3. Type the new name, then press <kbd>Enter</kbd> or click the checkmark.

See [Chat Settings](chat-settings.md) for how to open the panel.

## Delete a chat

1. Tap the trash button on the chat row. On a computer, it shows when you point at the row.
2. In the **Delete Chat** dialog, click **Delete**.

Deleting is permanent. It also stops any reply still being written for that chat.

If the chat has several branches, the dialog says how many and gives two choices:

- **Delete This Branch Only** removes the branch you clicked.
- **Delete All N branches** removes every branch in the group.

To manage branches without deleting the chat, see [Chat Branches](branches.md).

The app-wide setting **Confirm before deleting** controls these dialogs. It is on by default. Find it in **Settings → General**.

## Chat folders

Folders group chats inside one mode tab.

1. Open a tab that has at least one chat. **New Folder** appears under the tabs only then.
2. Click **New Folder**. The folder is named **unnamed** (then **unnamed 2**, **unnamed 3**).

| To do this | Do this |
| --- | --- |
| Rename a folder | Double-click or double-tap it, or focus it and press <kbd>F2</kbd>. An empty name is ignored. |
| Delete a folder | Click the trash button on the folder row. A **Delete Folder** dialog appears when the folder holds chats. The chats move to the top level and are not deleted. |
| Reorder folders | Drag a folder up or down. The sort menu switches to **Custom**. |
| Move a chat into a folder | Drag the chat row onto the folder. On a touch screen, press and hold the chat for about half a second first. |
| Take a chat out of a folder | Drag it onto the empty area below the folders. |

With several chats selected, dragging one moves the whole selection. Chats outside folders are listed below the folders.

## Search, sort and filter

### Find a chat by name

Each tab has a search box. Its placeholder is **Search conversations**, **Search roleplays** or **Search games**. Type a word. It matches chat names, tags and character names, not message text.

### Find a message in all chats

1. Tap **Search all chats**, the button beside the sort menu.
2. Type your words.

It searches every chat and can filter by mode, character, sender and date.

The sort menu (**Sort chats**) has these options:

| Option | Order |
| --- | --- |
| **Custom** | Your folder order. |
| **Manual order** | Chats in the order you drag them. With a keyboard, focus a chat and press <kbd>Alt</kbd>+<kbd>Up</kbd> or <kbd>Alt</kbd>+<kbd>Down</kbd>. |
| **Recent** | Most recently active first. This is the default. |
| **Newest** | Most recently created first. |
| **Oldest** | Oldest first. |
| **A-Z** and **Z-A** | By name. |

When any chat in the tab has a tag, a **Tags (N)** chip appears. Click it to expand the tags, then click a tag to show only chats with it. Click **Clear** to remove the filter. This panel cannot add tags to a chat.

The list shows 100 chats at a time. Click **Load more** to see the next batch.

## Selecting multiple chats

1. Click the checkmark button (**Select chats**) at the top of the panel.
2. Click each chat you want. Rows show a checkbox instead of opening.
3. Use the bar at the bottom, which shows how many chats are selected.

**Export** downloads the selected chats as one `.zip` file of `.jsonl` files. **Delete** asks you to confirm in a **Delete Chats** dialog, then removes them. Click the checkmark button again to leave selection mode. Switching tabs also clears the selection.

## Recent chats on the Home screen

The Home screen has a **Recent chats** widget with your latest chats. Each shows its name, a mode badge and its last message. Click a chat to open it. With no chats, it reads **Your chats will show here**. See [Home widgets](../home/welcome.md#home-widgets).
