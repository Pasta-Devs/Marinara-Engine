# Message Actions: Edit, Delete, Swipe, Regenerate

This guide covers what you can do with a single message in a chat. It explains the message toolbar, how to edit and delete a message, and how swipes and regeneration work. It also covers the display toggles that show token counts and message numbers.

Every message in Marinara Engine, whether you wrote it or the AI did, has a small toolbar. The toolbar appears when you hover over the message on a computer, or when you tap the message on a phone or tablet.

## The message toolbar

The buttons below appear on messages. Some only show up in certain situations, which the table notes. Each button has a tooltip that matches the label shown here.

| Button | What it does | When it appears |
| --- | --- | --- |
| **Copy** | Copies the message text. The icon turns into a checkmark for a moment. | Always |
| **Add reaction** | Opens an emoji picker and toggles your reaction on the message. | Conversation mode only |
| **Translate** / **Hide translation** | Translates the message into your language, then hides the translation again. | Always |
| **Edit** | Opens the message for editing. See below. | Always |
| **Regenerate** | Creates a new alternate reply (a swipe). See below. | AI messages. In Roleplay mode, also on your messages. In Conversation mode, also on your messages made by Impersonate |
| **Show original before rewrite** / **Show rewritten version** | Switches between the original and rewritten text. Both versions remain available so you can compare them or keep the one you prefer. | Only after an agent rewrote the message |
| **Hide from AI** / **Unhide from AI** | Stops or resumes sending this message to the AI on later turns. In a Roleplay group chat, opens a character chooser. | Always |
| **Peek prompt** | Shows the exact prompt the AI received for this reply. | Only on the latest AI message |
| **Stored guidance** | Shows the direction that steered this reply. | Only if the reply used a guided direction or was made by Impersonate |
| **Branch from here** | Copies the chat up to this message into a new branch. | Always |
| **View thoughts** | Opens the model's hidden reasoning text. | Only if the model returned reasoning |
| **Delete** | Deletes the message. See below. | Always |
| **Pause speaking** / **Resume speaking** / **Restart speaking** | Controls the spoken audio of a message. | Only when Text to Speech is on and speaking |

For the **Peek prompt** viewer, see [Peek Prompt](peek-prompt.md). For **Branch from here**, see [Chat Branches](branches.md). For **Translate**, see [Message Translation](../integrations/message-translation.md). For the speaking controls, see [Text to Speech (TTS) Setup](../media/tts-setup.md). For guided directions, **Stored guidance**, and Impersonate, see [Guided Generation and Impersonate](guided-and-impersonate.md).

## Editing a message

You can edit message text for any message, yours or the AI's.

1. Click **Edit** on the message. The text turns into an editable box.
2. Change the text.
3. Click **Save**, or press Ctrl and Enter together (Cmd and Enter on a Mac). The button tooltip reads **Save (Cmd+Enter)**.
4. To stop without saving, click **Cancel** or press the Escape key. The button tooltip reads **Cancel (Esc)**.

Two settings give you faster ways to start editing. Both live in **Settings**, then the **General** tab, under **Input & Editing**.

- **Up Arrow edits last message** (default on): press the Up Arrow key while the input box is empty. This opens the most recent message for editing.
- **Double-click edits messages** (default on): double-click or double-tap a Roleplay message to open it for editing.

## Deleting a message

When you delete a message, a dialog titled **How to proceed?** appears. The delete message options are:

- **Delete only this swipe (1/3)**: removes just the alternate reply you are viewing. This option only appears when the message has more than one swipe. The numbers show which swipe is active and how many there are.
- **Delete this message**: removes the whole message and all of its swipes.
- **Delete more**: selects this message and every message below it, then turns on message multi-select so you can adjust the selection before deleting.
- **Cancel**: closes the dialog and deletes nothing.

System messages, such as a "joined the chat" line, have a simple delete button with no dialog.

## Swipes: alternate replies

A swipe is one version of an AI reply. A single message can hold several swipes, so you can compare different answers to the same turn and pick the one you like.

A swipe control appears on the message once it has two or more swipes. It shows the active swipe and the total, for example "2/4", with these controls:

- **Previous swipe** and **Next swipe**: step backward or forward through the swipes.
- A number box: type a swipe number and press Enter to jump straight to it. Its tooltip reads **Jump to swipe 1-N**, where N is the total.
- **Generate next swipe**: when you are on the newest swipe, the forward button changes to this and creates a brand-new swipe.

You cannot delete the last swipe of a message. If you try, the app reports "Cannot delete the last remaining swipe". Use **Delete this message** instead to remove the whole message.

## Regenerate, continue, and retry

These three actions look similar but do different things. Choose the one that matches what you want.

**Regenerate** makes a new swipe. Click **Regenerate** on an AI message to generate another version of that reply. The original swipe is kept. On a touch screen, the app first asks "Regenerate this message as a new swipe?" so you do not trigger it by accident. When a guided direction is armed, the button reads **Regenerate (guided)**.

The **/continue** command extends the same message. Type `/continue` (or its short form `/cont`) in the input box and send it. The AI picks up where its last reply stopped and adds more text to that same message, instead of making a new swipe.

```
/continue
```

Empty-Send retry starts a fresh reply. If the last message in the chat is yours and the input box is empty, the same **Send** button retries instead of sending. It does not change its look. Click it, or press Enter, to get a reply without retyping your message. In Roleplay mode, an empty **Send** can also nudge the AI to continue the scene with a new turn. This is not the same as **/continue**: empty-Send always makes a new reply, while **/continue** adds onto the existing one.

## Hiding a message from the AI

The AI context is the set of messages the app sends to the AI on each turn. Click **Hide from AI** to keep a message out of that context on future turns. The message stays visible to you and shows a **Hidden from AI** label. Click **Unhide from AI** to send it again.

In a Roleplay group chat with more than one character, **Hide from AI** opens a compact avatar chooser. Select the group avatar to hide the message from everyone, or select one or more character avatars to hide it only from those characters. Selecting everyone clears individual selections, while selecting an individual character turns off the everyone option. The crossed-eye marker on the message shows the avatars of the characters who cannot see it. In a one-character chat, the button continues to hide or unhide the message directly.

You can also hide or unhide messages by number with the `/hide` and `/unhide` slash commands. Message numbers start at 1, counting from the first message in the chat.

## Message display toggles

Two toggles change what extra detail shows on messages. Both live in **Settings**, then the **Advanced** tab, in the **Message Tools** section. Both are off by default.

- **Show message numbers**: shows a number on each message. The numbers start at 1 from the first message in the chat. These are the same numbers used by the `/goto`, `/hide`, and `/unhide` commands. Turn this on when you need to find a message number.
- **Show token usage on messages**: adds a per-message token count to AI replies. A token is a small piece of text the AI reads and writes. The count shows the prompt tokens and completion tokens for that reply. When available, it also shows cache hits and how long the reply took.

A related toggle in the same **Message Tools** section, **Show model name on messages**, adds the name of the AI model that wrote each reply. It is also off by default.

## Related guides

- [Sending and Streaming Messages](sending-and-streaming.md)
- [Guided Generation and Impersonate](guided-and-impersonate.md)
- [Peek Prompt](peek-prompt.md)
- [Chat Branches](branches.md)
- [Text to Speech (TTS) Setup](../media/tts-setup.md)
- [Message Translation](../integrations/message-translation.md)
- [Settings Overview](../settings/settings-overview.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
