# Managing Your Chat List

Your chats live in the sidebar on the right, under **Chats**. Click **Library** at the top right to show or hide the sidebar, then pick **Chats** in the switch at its top (the other side is **Library**). On a phone or tablet, tap the stack button at the top right; the sidebar slides over the page with the same switch. Use the Chats list to start, find, sort, organize and delete chats.

## The chat list and mode tabs

At the top are **Import**, **New folder**, **Select chats** and **New**. On a phone, all but **New** are in the **⋯** menu beside it. Under them are three mode tabs, each with how many chats it holds (on a phone the first reads **Conversation**). Each tab lists only the chats of that mode.

| Tab | Mode |
| --- | --- |
| **Convo** | Conversation: a messaging-style chat. |
| **Roleplay** | Roleplay: a scene with characters and world tracking. |
| **Game** | Game: a single-player RPG run by the AI. |

Each row shows the chat name and the avatars of its characters. In Conversation chats, a colored dot on an avatar shows that character's status. A red badge is the count of unread messages. A row with a small branch icon and a number is a chat with several branches, grouped into one row. See [Chat Branches](branches.md). On a computer, pointing at a row shows a peek of the chat and its **Rename chat** and **Chat tags** buttons.

Pinned chats lead the list. To pin one, right-click it (or swipe it left on a touch screen) and choose **Pin**.

## Start a chat

Before you start: add at least one account in **Connections**. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. Click the tab for the mode you want.
2. Click **New** at the top of the list. Its tooltip is **New Conversation**, **New Roleplay** or **New Game**, to match the tab. You can also start one from **Conversation**, **Roleplay** or **Game** on Home.

Marinara creates and opens the chat. **Chat Settings** and a setup wizard open beside it. Until you finish the setup, the chat stays out of the list. If you leave the setup and choose to keep it, it shows up as **Setup not finished**, so you can come back to it. The chat starts with the name **New Conversation**, **New Roleplay** or **New Game**. If you saved a starred default settings profile for Conversation or Roleplay, Marinara applies it to the new chat. See [Settings Profiles](settings-profiles.md).

If it did not work: with no account saved, the **Add account** window opens instead of a chat. Pick a service, click **Connect**, then choose a model. The full steps are in [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

## Import a chat

You can import a `.jsonl` chat log from SillyTavern or Marinara.

1. Click the tab for the mode the chat should land in.
2. Click the **Import** button (the download arrow) at the top of the list. Its label is **Import SillyTavern or Marinara chat JSONL**.
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

1. Right-click the chat row and choose **Delete**. On a touch screen, swipe the row to the left, or press and hold it, and tap **Delete**.
2. In the **Delete Chat** dialog, click **Delete**.

Deleting is permanent. It also stops any reply still being written for that chat. To delete many at once, see [Selecting multiple chats](#selecting-multiple-chats).

If the chat has several branches, the dialog says how many and gives two choices:

- **Delete This Branch Only** removes the branch you clicked.
- **Delete All N branches** removes every branch in the group.

To manage branches without deleting the chat, see [Chat Branches](branches.md).

The app-wide setting **Confirm before deleting** controls these dialogs. It is on by default. Find it in **Settings → General → Confirmations & Help**.

## Chat folders

Folders group chats inside one mode tab.

1. Open a tab that has at least one chat.
2. Click **New folder** (the folder button at the top of the list). The folder is named **unnamed** (then **unnamed 2**, **unnamed 3**).

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

### Filter by tag

Click **Tags** (the tag button beside the search box). Pick one or more tags, or **Untagged**. The button shows how many you picked. A chat and its branches count once. Add tags to a chat with **Chat tags** on its row, or **Tags** in its right-click or swipe menu.

### Find a message in all chats

Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> (<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> on a Mac), or search for it with the search button in the top bar. It searches every chat and can filter by mode, character, sender and date.

### Sort

The sort menu (**Sort chats**) has these options:

| Option | Order |
| --- | --- |
| **Custom** | Your folder order. |
| **Manual order** | Chats in the order you drag them. With a keyboard, focus a chat and press <kbd>Alt</kbd>+<kbd>Up</kbd> or <kbd>Alt</kbd>+<kbd>Down</kbd>. |
| **Recent** | Most recently active first. This is the default. |
| **Newest** | Most recently created first. |
| **Oldest** | Oldest first. |
| **A to Z** and **Z to A** | By name. |

The list shows 40 chats at first and adds the next 40 as you scroll near the end.

## When the list updates

To keep the app fast, the Chats list doesn't reload itself all the time:

- It updates at once when you make, change or delete a chat on this device.
- Changes from another device (a chat you started on your phone, say) show up when you come back to the app from another app or browser tab: the list refreshes once at that moment.
- The server can't push changes to your device. If two devices are open side by side, switch away from the app and back to see the other one's changes.

## Selecting multiple chats

1. Click the checkmark button (**Select chats**) at the top of the list.
2. Click each chat you want. Rows show a checkbox instead of opening.
3. Use the bar at the bottom, which shows how many chats are selected.

**Export** downloads the selected chats as one `.zip` file of `.jsonl` files. **Delete** asks you to confirm in a **Delete Chats** dialog, then removes them. Click the checkmark button again to leave selection mode. Switching tabs also clears the selection.

## Recent chats on the Home screen

The Home screen has a **Recent chats** widget with your latest chats. Each shows its name, a mode badge and its last message. Click a chat to open it. With no chats, it reads **Your chats will show here**. See [Home widgets](../home/welcome.md#home-widgets).
