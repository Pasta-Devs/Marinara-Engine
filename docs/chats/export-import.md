# Exporting and Importing Chats

This guide shows how to save a chat to a file and load a chat back into Guksu Motor. You can export one chat or many chats at once. You can also import a chat file that came from Guksu or from SillyTavern (another roleplay chat app).

## File formats you will see

Guksu uses two chat file formats.

- **JSONL**: JSONL means JSON Lines. It is a plain text file that saves one message per line. This is the default export format. You can import a JSONL file back into Guksu later.
- **Text**: A plain, readable `.txt` transcript. It is easy to read and share, but Guksu cannot import it back in. Use **Text** only when you want a human to read the chat.

The chat import feature accepts a `.jsonl` file only. If you want to re-import a chat later, export it as **JSONL**, not **Text**.

## Export a single chat

To export one chat to a file, use the **Chat Branches** panel. This is the quickest way to export chat history for a single conversation.

1. Open the chat you want to export.
2. In the chat toolbar, click the branch button (its tooltip reads **Switch branch**).
3. The **Chat Branches** panel opens. It says "Switch, import, export, or clean up this chat's branches."
4. Click **JSONL** to save the chat as a JSONL file, or click **Text** to save it as a readable text file.
5. Your browser downloads the file.

The download saves the chat that is currently open, including its messages.

## Export several chats at once

You can select many chats and download them together in one `.zip` file.

1. Open the chat list in the left sidebar.
2. Pick the mode tab you want: **CONVO** (Conversation), **RP** (Roleplay), or **GM** (Game). Each tab exports only its own chats.
3. Click the **Select chats** button at the top of the chat list.
4. Click each chat you want to include. A checkbox turns on for each one.
5. A bar appears at the bottom showing the count, for example "3 selected".
6. Click **Export** in that bar.
7. Your browser downloads a `.zip` file of JSONL transcripts, one file per chat.

The bulk export always uses the **JSONL** format. Click **Delete** in the same bar only if you want to remove the selected chats instead.

## Import a chat as a new chat

This creates a brand new chat from a `.jsonl` file. Use it to import chat files saved by Guksu or exported from SillyTavern.

1. Open the chat list in the left sidebar.
2. Pick the mode tab you want: **CONVO**, **RP**, or **GM**. Guksu creates the imported chat in the tab you have open right now.
3. Click the import button next to the **New** button at the top of the list. Its tooltip reads **Import SillyTavern or Guksu chat JSONL**.
4. Choose your `.jsonl` file in the file picker.
5. You should see a message that says "Imported N messages", and Guksu switches you into the new chat.

If you want the new chat in Roleplay mode, open the **RP** tab before you import. The tab you have open sets the mode, not the file.

## Import a chat as a new branch

You can also load a `.jsonl` file into an existing chat as a new branch. A branch is a separate saved copy of a chat that you can explore on its own. See [Chat Branches](branches.md) for more about branches.

1. Open the chat you want to add the branch to.
2. In the chat toolbar, click the branch button (tooltip **Switch branch**) to open the **Chat Branches** panel.
3. Click **Import** in that panel.
4. Choose your `.jsonl` file.
5. You should see a message that says "Imported N messages as a new branch".

The new branch joins the open chat. It reuses the open chat's characters, persona, connection, and prompt preset.

## Include reasoning in exports

Some models save hidden thinking or reasoning text with a reply. A setting decides whether that hidden text goes into your export files.

The setting is **Include reasoning in exports**. You find it in **Settings**, on the **Advanced** tab, in the **Message Tools** section. It is a toggle, and it is **off** by default.

- When it is **off**, Guksu leaves saved thinking and reasoning text out of both **JSONL** and **Text** chat exports.
- When it is **on**, Guksu adds that hidden thinking and reasoning text to both formats.

This setting affects both single-chat exports and bulk `.zip` exports.

Keep **Include reasoning in exports** off before you share a transcript with someone else. The hidden reasoning can contain notes you did not mean to send along. Turn it on only when you want a full record for yourself.

## Related guides

- [Chat Branches](branches.md)
- [Importing from SillyTavern](../data/importing-from-sillytavern.md)
- [Backup and Restore](../data/backup-and-restore.md)
- [Settings Overview](../settings/settings-overview.md)
