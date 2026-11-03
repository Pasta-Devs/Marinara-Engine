# Exporting and Importing Chats

Save a chat to a file, share it as a readable story, or load a chat file from Marinara or SillyTavern (another roleplay chat app) back in. You can export one chat, part of a chat, or many chats at once.

## File formats you will see

| Format | What it is | Import it back? |
| --- | --- | --- |
| **JSONL** | JSON Lines, a plain text file with one message per line. The default format. | Yes |
| **Text** | A readable `.txt` transcript. | No |
| **Markdown** | A readable `.md` file. It starts with the chat name and the dates it covers, then each message under its speaker's name. | No |
| **Story** | A styled `.html` web page with each speaker's name and avatar. Open it in a browser to read, share or print it. | No |

**Markdown** and **Story** files leave out system messages and messages hidden from you. Chat import accepts `.jsonl` only, so export as **JSONL** if you want to import the chat later.

A **JSONL** file leaves out a few addresses saved with the chat: the Discord mirror webhook, the DeepLX address, the DeepL key and the Intiface address. Importing never brings them in either. Enter them again in the imported chat's **Chat Settings** if you use them.

## Export a single chat

1. Open the chat.
2. Open **Chat Settings** and expand **Chat Branches**, under **Chat Name**. The export buttons are in this section even if the chat has only one branch.
3. Tap **JSONL**, **Text**, **Markdown** or **Story**.

Your browser downloads the file. It holds the branch you are viewing, with its messages.

## Export part of a chat

Use **Export a range** to save only some messages. It is not available in Game chats.

1. In **Chat Branches**, click **Export a range**.
2. Click the first message, then the last message. A hint reads "Select the first and last message to export."
3. Click **Export selected**.
4. In the **Export messages** dialog, check the message count and the first and last message, then choose **Text**, **Markdown**, **JSONL** or **Story**.

Marinara exports every message from the first to the last one you picked. Click **Cancel** to stop without exporting.

## Export several chats at once

1. In the left sidebar, click the tab for the mode you want: **CONVO**, **RP** or **GM**. Each tab exports only its own chats.
2. Click **Select chats** at the top of the list.
3. Click each chat you want. A bar at the bottom shows the count, such as "3 selected".
4. Click **Export** in the bar.

Your browser downloads a `.zip` file with one JSONL transcript per chat. Bulk export always uses **JSONL**. See [Managing Your Chat List](managing-chats.md#selecting-multiple-chats).

## Import a chat as a new chat

This makes a new chat from a `.jsonl` file saved by Marinara or exported from SillyTavern.

1. In the left sidebar, click the tab for the mode you want. The imported chat uses the mode of the tab you have open, not the mode in the file.
2. Click the **Import** button next to the **+** button. Its label is **Import SillyTavern or Marinara chat JSONL**.
3. Choose your `.jsonl` file.

You see "Imported N messages", and Marinara opens the new chat. For SillyTavern files in more depth, see [Importing from SillyTavern](../data/importing-from-sillytavern.md).

If it did not work: a small message at the bottom of the screen reads **Import failed** with the reason. Check that the file ends in `.jsonl`.

## Import a chat as a new branch

This loads a `.jsonl` file into a chat you already have, as a new branch. See [Chat Branches](branches.md).

1. Open the chat that should get the branch.
2. Open **Chat Settings**, expand **Chat Branches**, and click **Import**.
3. Choose your `.jsonl` file.

You see "Imported N messages as a new branch". The branch reuses the open chat's characters, persona, connection and prompt preset.

## Include reasoning and private notes in exports

Two settings decide whether hidden text goes into export files. Both are toggles in **Settings → Advanced → Message Tools**, and both are off by default. They affect single-chat and `.zip` exports.

| Setting | When on |
| --- | --- |
| **Include reasoning in exports** | Adds the model's saved thinking to every format. In **Markdown** and **Story** files it sits in a collapsible **Thinking** section under the message. |
| **Include private notes in exports** | Adds your private message notes to **JSONL** and **Text** exports. |

> **Warning:** Keep both off before you share a transcript. Hidden reasoning and private notes can hold things you did not mean to send.
