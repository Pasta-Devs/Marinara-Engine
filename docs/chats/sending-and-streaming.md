# Sending and Streaming Messages

This guide covers the basics of every chat in Marinara Engine. It explains how you send a message, how the AI reply streams onto the screen, and how to stop or retry a reply. It also covers attachments, the "thinking" indicators, and what to do when a generation error appears.

## Send a message

The message input bar sits at the bottom of every chat. Type your text in the box, then start the AI reply in one of two ways:

1. Click the **Send** button at the right of the input bar.
2. Or press Enter, if **Send on Enter** is turned on for that chat mode.

You should see your message appear in the list, followed by the AI reply as it generates.

Only one reply can generate per chat at a time. While a reply is streaming, the **Send** button becomes a stop button, so you cannot start a second reply by accident.

Sending needs a working connection. A connection is your link to an AI provider (see the related guide below). Without one, the reply fails right away with a message that says no connection is configured for the chat.

### Send on Enter

The **Send on Enter** setting lives in **Settings**, under the **General** tab, in the **Input & Editing** section. It has one toggle per chat mode:

| Chat mode | Default | What Enter does when on |
|---|---|---|
| Roleplay | Off | Enter sends the message |
| Conversations | On | Enter sends the message |
| Game | On | Enter sends the message |

When a mode's toggle is off, pressing Enter adds a new line instead. You then click **Send** to post the message. Roleplay is off by default because roleplay messages are often long and need line breaks.

## Attach images and files

You can attach images or files so the AI can see or read them. Click the paperclip control in the input bar and pick a file. Attached files show as small chips above the input before you send.

Marinara accepts these file types:

- Images.
- PDF files.
- Plain text files: `.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml`, and `.yml`.

Each file must be 20 MB or smaller. A larger file is rejected with a note that says the file is too large. An unsupported file type is rejected with a note that lists the allowed types.

The AI can only "see" an image if the connected model supports vision. If your model is text only, turn on **Image Captioning**. This setting lives in the per chat **Chat Settings**, in the **Advanced Parameters** section, and is off by default. When on, Marinara describes each attached image in text using a connection you pick, then sends that description instead of the raw image.

## Streaming the reply

Streaming shows the reply appearing word by word as it generates, instead of waiting for the whole reply at once. The streaming controls live in **Settings**, under the **General** tab, in the **Responses** section:

| Setting | Default | What it does |
|---|---|---|
| **Enable streaming** | On | Shows the reply word by word as it generates |
| **Streaming speed** | 50 | Sets how fast streamed text renders on screen |
| **Trim incomplete model endings** | Off | Trims a trailing unfinished sentence before saving |

**Streaming speed** is a slider from 1 to 100. A lower value gives a slower typewriter effect so you can read along. A higher value shows text almost instantly. Marinara smooths bursty token delivery while the model is writing, then uses your selected speed to finish the reply. This setting does not change how fast the model itself writes.

When **Enable streaming** is off, the full reply appears all at once after the model finishes.

**Trim incomplete model endings** only affects the saved message. When on, Marinara removes a trailing unfinished sentence from the reply. It leaves complete replies and command style endings alone.

## Typing and progress indicators

Before the first word of a reply arrives, Marinara shows that the character is working. You see the character's name with three animated dots. In a group chat the names of every replying character appear together.

While the server prepares the prompt, a short progress line cycles through these labels:

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Each label matches a step Marinara runs before or during the reply. The line clears once the first word of the reply streams in. Some steps only run when a chat uses that feature, so you may not see every label.

If a character's presence is set to a busy or away status, a waiting indicator appears instead of the typing dots. The reply starts once the character is available again.

## See the model's thinking

Some models expose a hidden reasoning trace, often called "thinking". Marinara keeps this separate from the visible reply.

When a reply has thinking attached, a **View thoughts** action (a brain icon) appears on that message. Click it to open a panel that shows the captured reasoning text.

For the reasoning to show, the model must actually return it. Some models wrap their reasoning in plain text tags. For those, set custom **Thinking Tags** on the connection so Marinara can split the hidden reasoning from the visible reply. Several common tag pairs are already recognized. See the generation parameters guide below for how to set **Thinking Tags**.

## Stop a reply

To stop a reply that is still generating, click the stop button. This is the **Send** button: while a reply streams, its icon changes to a stop symbol.

Whatever text already streamed in before you stopped is usually kept on screen. Stopping on purpose is never shown as an error.

## Retry without retyping

If the last message in the chat is yours and the AI never replied, you do not need to retype it. Leave the input box empty. Then click the **Send** button (or press Enter) to start a fresh reply without adding a duplicate message. In Conversation mode, the button shows a circular retry arrow while this state is active.

Retry only works while the box is empty. If you have typed a draft, the button sends that draft instead.

In Roleplay mode there is a related shortcut. Press **Send** with an empty box to nudge the AI to reply again, even after it already answered. This always starts a brand new reply. It does not add on to the previous reply. To extend the previous reply instead, use the `/continue` command, covered in the message actions guide below.

## When a generation error appears

If a reply fails, Marinara shows a toast notification at the bottom of the screen. The toast stays up for about 15 seconds, and you can copy its text. A stopped reply is not treated as an error.

For some common problems, Marinara rewrites the raw error into a clear next step:

- If the model rejects a parameter it does not support, the toast tells you how to fix it. Go to **Chat Settings**, open **Advanced Parameters**, and turn off **Send** for that parameter.
- If the model requires a parameter that is off, the toast tells you to turn it back on. Go to the same place and turn on **Send** for that parameter.
- If the reply comes back completely empty, the toast tells you to try sending your message again.

Other clear messages you may see:

- A reply is already generating for this chat. Wait for it to finish, or stop it with the stop button.
- No connection is configured for this chat. Set one up first (see the related guide below).

If an error keeps happening, the troubleshooting guide below has more fixes for connection and generation error problems.

## Slow connections and mobile tabs

A long reply can take a while, and that is normal. You can stop the reply at any time with the stop button.

On mobile, the browser may pause a chat tab when you switch away from it. If the reply was still streaming, Marinara shows a **Finishing in background...** state. It then checks whether the reply finished on the server. If it is taking longer, you see a note that says the reply is still finishing in the background. Refresh the chat in a moment if it has not appeared.

## Related guides

- [Message Actions: Edit, Delete, Swipe, Regenerate](messages.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Generation Parameters](../prompts/generation-parameters.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
