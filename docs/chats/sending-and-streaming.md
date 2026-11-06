# Sending and Streaming Messages

Type a message, send it, and watch the reply appear. This guide covers sending, attachments, streaming, stopping a reply, retrying and reading an error.

## Send a message

Before you start: your chat needs a model. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. Type in the input bar at the bottom of the chat.
2. Click **Send**, or press <kbd>Enter</kbd> if **Send on Enter** is on for that chat mode.

Your message appears, then the reply streams in. Only one reply can generate per chat at a time. While a reply streams, **Send** turns into a stop button.

If it did not work: with no model set for the chat, the reply fails at once with a message that no connection is configured. Pick one in [Chat Settings](chat-settings.md).

### Send on Enter

Find it in **Settings → General → Input & Editing**. There is one toggle per chat mode.

| Chat mode | Default | When off |
| --- | --- | --- |
| Roleplay | Off | <kbd>Enter</kbd> adds a new line. Click **Send**. |
| Conversations | On | <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> on Mac) sends. |
| Game | On | <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> on Mac) sends. |

Roleplay is off by default because roleplay messages are often long and need line breaks. Professor Mari has her own toggle, **Enter sends to Professor Mari**, in **Settings → General → Search and Professor Mari settings**.

## Attach images and files

1. Tap the paperclip in the input bar.
2. Pick a file. It shows as a small chip above the input.
3. Send as usual.

Marinara accepts images, PDF files, and plain text files (`.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml`, `.yml`). Each file must be 20 MB or smaller. Marinara rejects a larger file or an unsupported type with a note.

A model can see an image only if it supports vision. For a text-only model, turn on **Image captioning** in **Chat Settings → Advanced Parameters**. It is off by default. Marinara then describes each image in text, with a model you pick, and sends that description in place of the image.

## Show a gallery image inside a message

Attachments are for the model to see. A gallery link shows an image to you inside the message text. Messages accept Markdown image syntax, and Marinara resolves `card://` links to gallery files:

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

In Roleplay, the chat's asset browser can insert a link for you. You can also paste one into messages, greetings and example dialogue.

For a character's own gallery, use the portable form `card://self/gallery/<filename>`. It keeps working after the character is exported and imported. The gallery's **Copy image reference** button makes it. See [Character galleries](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

## Streaming the reply

Streaming shows the reply word by word instead of all at once. These settings are in **Settings → General → Responses**.

| Setting | Default | What it does |
| --- | --- | --- |
| **Enable streaming** | On | Shows the reply as it is written. When off, the whole reply appears when the model finishes. |
| **Streaming speed** | 50 | Slider from 1 to 100. Lower is a slower typewriter effect. It does not change how fast the model writes. |
| **Trim incomplete sentences from the response** | Off | Removes an unfinished last sentence before the reply is saved. Complete replies and command-style endings stay as they are. |

## Typing and progress indicators

Before the first word arrives, you see the character's name with three animated dots. In a group chat, every replying character's name shows. While the server prepares the prompt, a progress line cycles through these labels. Some steps run only when the chat uses that feature, so you may not see all of them.

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

If a character's status is busy or away, a waiting indicator shows instead of the dots. The reply starts when the character is available.

## See the model's thinking

Some models return a hidden reasoning trace, called "thinking". When a reply has one, a brain icon (**View model thoughts**) appears on the message. Click it to read the reasoning.

For this to work, the model must return its reasoning. Some models wrap it in plain text tags. For those, set **Thinking Tags** in the generation settings so Marinara can split reasoning from the reply. See [Generation Parameters](../prompts/generation-parameters.md).

## Stop a reply

Click the stop button, which is the **Send** button while a reply streams. Text that already streamed in is usually kept. Stopping on purpose never shows an error.

## Retry without retyping

If the last message is yours and the AI never replied, leave the input box empty and click **Send** (or press <kbd>Enter</kbd>). Marinara starts a new reply and adds no duplicate message. In Conversation, the button shows a circular arrow in this state. If the box holds a draft, **Send** sends the draft instead.

In Roleplay, an empty **Send** also starts a brand new reply after the AI already answered. It does not add to the previous reply. To extend the previous reply, use `/continue`. See [Message Actions](messages.md).

## When a generation error appears

A failed reply shows a toast (a short pop-up message) at the bottom of the screen for about 15 seconds. You can copy its text. Marinara rewrites some errors into a next step:

| Cause | What the toast tells you |
| --- | --- |
| The model rejects a parameter it does not support | Open **Chat Settings → Advanced Parameters** and turn off **Send** for that parameter. |
| The model requires a parameter that is off | Turn **Send** back on in the same place. |
| The reply came back empty | Send your message again. |
| A reply is already generating | Wait, or stop it with the stop button. |
| No connection is configured | Set one up for the chat. |

If an error keeps happening, see [Troubleshooting](../TROUBLESHOOTING.md).

## Slow connections and mobile tabs

A long reply can take a while. You can stop it at any time. On a phone, the browser may pause a chat tab when you switch away. If a reply was streaming, Marinara shows **Finishing in background...** and then checks whether the reply finished on the server. If it has not appeared, refresh the chat in a moment.
