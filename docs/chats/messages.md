# Message Actions: Edit, Delete, Swipe, Regenerate

Every message, yours or the AI's, has a toolbar. Use it to edit, delete, regenerate, hide or branch from one message.

The toolbar appears when you tap a message on a phone or tablet, or point at it on a computer.

## The message toolbar

Most used:

- **Edit** changes the message text.
- **Regenerate** asks the model for a new version of an AI reply. Each version is called a swipe.
- **Delete** removes the message.

The buttons are icons. Their labels are below. Some appear only in certain situations.

| Button | What it does |
| --- | --- |
| **Copy** | Copies the message text. |
| **Edit** | Opens the message for editing. |
| **Regenerate** | Creates a new swipe (another version of the reply). AI messages only. Also on your messages in Roleplay, and on your Impersonate messages in Conversation. |
| **Delete** | Deletes the message. |
| **Translate** / **Hide translation** | Translates the message into your language, then hides the translation. |
| **Add reaction** | Opens an emoji picker. Conversation only. |
| **Hide from AI** / **Unhide from AI** | Stops or resumes sending this message to the model. In a Roleplay group chat, opens a character chooser. |
| **Bookmark, pin or note** | Bookmarks the message, pins it so it stays in the prompt past the history limit (up to 10 per chat), or adds a **Private note**. The model never sees a note unless you turn on **Show the note to the narrator character**, which works in one-character chats and in group chats with individual replies. |
| **Branch from here** | Copies the chat up to this message into a new branch. Not in scene chats. |
| **Clone from here** | Copies a scene chat up to this message into a new Roleplay. Scene chats only. |
| **Peek prompt** | Shows the exact prompt for this reply. Latest AI message only. |
| **Stored guidance** | Shows the direction that steered this reply. Only for replies made with guidance or Impersonate. |
| **View model thoughts** | Opens the model's hidden reasoning. Only if the model returned reasoning. |
| **Show original before rewrite** / **Show rewritten version** | Switches between the original and rewritten text when an agent (a helper that runs alongside replies) rewrote the message. |
| **Mark as new start** | Roleplay only. Starts the model's memory of the chat at this message, when Advanced Memory (Marinara's long-term memory feature) is on. See [Advanced Memory](../agents/memory.md). |
| **Pause speaking** / **Resume speaking** / **Restart speaking** | Controls spoken audio when Text to Speech (a voice reads messages aloud) is on and speaking. |

More: [Peek Prompt](peek-prompt.md), [Chat Branches](branches.md), [Scenes](../roleplay/scenes.md) (a scene chat is a short Roleplay branched off a chat), [Message Translation](../integrations/message-translation.md), [Text to Speech (TTS) Setup](../media/tts-setup.md), [Guided Generation and Impersonate](guided-and-impersonate.md), [private notes](../roleplay/getting-started.md#your-private-notes).

## Edit a message

1. Click **Edit** on the message. The text becomes an editable box.
2. Change the text.
3. Click **Save**, or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> on a Mac).
4. To stop without saving, click **Cancel** or press <kbd>Esc</kbd>.

Two settings in **Settings → General → Input & Editing** start an edit faster. Both are on by default.

- **Up Arrow edits last message**: press <kbd>Up</kbd> while the input box is empty.
- **Double-click edits messages**: double-click or double-tap a Roleplay message.

## Delete a message

1. Click **Delete** on the message. The **Delete message** dialog opens.
2. Choose one option.

| Option | What it does |
| --- | --- |
| **Delete only this swipe (1/3)** | Removes the swipe you are viewing. Shown only with more than one swipe. |
| **Delete all other swipes** | Keeps the swipe you are viewing and removes the rest. Shown only with more than one swipe. |
| **Delete this message** | Removes the message and all its swipes. |
| **Delete more** | Selects this message and every message below it and opens the selection bar. |
| **Cancel** | Closes the dialog. |

In the selection bar, click messages to add them. **Select all messages above** and **Select all messages below** extend the selection, **Unselect all** clears it, and **Delete selected** removes the rest. The bar shows how many are selected.

System messages, such as a "joined the chat" line, delete with one click and no dialog.

## Swipes: alternate replies

A swipe is one version of an AI reply. One message can hold several, so you can compare answers and keep the one you like. A swipe control appears once a message has two or more. It shows the active swipe and the total, such as "2/4".

- **Previous swipe** and **Next swipe** step through the swipes.
- The number box jumps to a swipe. Type a number and press <kbd>Enter</kbd>. Its label is **Jump to swipe 1-N**.
- On the newest swipe, the forward button becomes **Generate next swipe** and creates a new swipe.

You cannot delete the last swipe. The app says "Cannot delete the last remaining swipe". Use **Delete this message** instead.

## Regenerate, continue and retry

These three look alike and do different things.

| Action | Result |
| --- | --- |
| **Regenerate** | A new swipe. The original is kept. On a touch screen the app first asks "Regenerate this message as a new swipe?". With guidance armed, the button reads **Regenerate (guided)**. |
| `/continue` | More text on the same message, with no new swipe. |
| Empty **Send** | A fresh reply. |

### Continue a reply

Type `/continue` (or `/cont`) in the input box and send it. The model picks up where its last reply stopped.

```text
/continue
```

Marinara adds a blank line before the new text. To attach it directly to the last character, turn off **Settings → General → Responses → Add a new line before /continue text**.

### Retry with an empty Send

If the last message is yours and the input box is empty, **Send** retries instead of sending. In Roleplay, an empty **Send** also starts a new turn after the AI already answered. It never adds to the previous reply. See [Sending and Streaming](sending-and-streaming.md#retry-without-retyping).

## Hide a message from the AI

Click **Hide from AI** to keep a message out of the prompt on later turns. The message stays visible to you with a **Hidden from AI** label. Click **Unhide from AI** to send it again.

In a Roleplay group chat, **Hide from AI** opens an avatar chooser. Pick the group avatar to hide the message from everyone, or pick one or more characters to hide it only from them. A crossed-eye marker on the message shows who cannot see it. In a one-character chat, the button hides or unhides directly.

If you hide a message from one character, they still receive a whisper in it, but none of the rest. Hiding from everyone removes the whispers too. See [Whispers and secrets](../roleplay/getting-started.md#whispers-and-secrets).

To hide a range, use `/hide` and `/unhide`. See [Slash Commands](slash-commands.md). Message numbers start at 1 at the first message.

When Advanced Memory's **Decide who sees new messages** is on, new messages in a one-by-one group chat are hidden from absent characters automatically. Your own choice always wins. See [Deciding who sees new messages](../agents/memory.md#deciding-who-sees-new-messages).

## Message display toggles

These are in **Settings → Advanced → Message Tools**.

| Toggle | Default | What it shows |
| --- | --- | --- |
| **Show message numbers** | Off | A number on each message, the same numbers `/goto`, `/hide` and `/unhide` use. |
| **Show token usage on messages** | Off | Prompt and completion tokens for each AI reply (tokens are small pieces of text the model counts), plus cache hits and reply time when available. |
| **Show model name on messages** | Off | The model that wrote each reply. |
| **Show "older messages not sent" note** | On | A note under a reply, such as "1109 older messages not sent", when older messages did not fit in the prompt. Notes about a cut-off or empty reply always show. |
