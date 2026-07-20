# Peek Prompt: See What the AI Received

Peek Prompt shows you the exact text that Marinara Engine sent to the AI model for a reply. It can also show a live preview of the prompt before anything is sent. This guide explains what the viewer shows, how to open it, how to read Stored guidance, and how to use it to debug replies.

A prompt is the full block of instructions and chat history that Marinara builds and sends to the model. The model reads that prompt and writes a reply. Peek Prompt lets you see that block after it is put together, so nothing about your reply is a mystery.

## What Peek Prompt shows

When you open Peek Prompt, a window titled **Assembled Prompt** appears. It has three parts.

A source badge sits at the top next to the title. It tells you which version of the prompt you are looking at:

- **Exact Text Model Request**: the literal request that was sent to the model.
- **Live Preview**: a fresh preview built right now.
- **Raw Messages**: the raw list of messages.
- **Prompt Preview**: a general preview.

Below the badge is a generation info panel. It can show the provider and model name, an estimated token count, and the real prompt token count once a reply has finished. A token is a small chunk of text that models count instead of words. This panel also shows small tags for the values used, such as **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier**, and **Assistant Prefill**. Sampling values like **Top P**, **Top K**, and **Min P** can also appear here.

The rest of the window is the prompt itself, split into collapsible sections. Each section has a label and its own rough token estimate. The chat messages are grouped under one **Chat History** section. For an exact saved request, the provider may have combined several chat turns into one provider block. Expand each block to inspect all model-visible text inside it. Click any section header to open or close it.

## Opening Peek Prompt

There are two ways to open the viewer.

The first way is the message action bar. Follow these steps:

1. Hover over the newest AI message in your chat.
2. Find the **Peek prompt** action. Its icon is a magnifying glass.
3. Click it. The **Assembled Prompt** window opens.

The **Peek prompt** action only appears on the last AI message in the chat. Older messages do not show it.

The second way is a typed shortcut. It works even before you have any AI reply, so you can preview the prompt first. Follow these steps:

1. Click the message input box.
2. Type this exact text:

```
{{prompt}}
```

3. Press Enter or click Send.

Instead of sending a message, Marinara clears the box and opens the Peek Prompt viewer. The shortcuts `{{prompt_preview}}` and `{{preview_prompt}}` do the same thing.

## Reading Stored guidance

Guided generation lets you steer a reply with an out of character instruction. When a message was made with a stored direction, it carries a separate **Stored guidance** action. Its icon is a small scroll. The action also appears on messages made with the `/impersonate` command.

Click **Stored guidance** to open a window that shows the direction used for that message. For a guided message, the window labels the direction by where it came from:

- **/guided**: you used the `/guided` slash command.
- **Guided regenerate**: you regenerated the message with a typed direction.
- **Game start**: the direction came from Game Mode setup.

A **Copy /guided** button appears only for **/guided** and **Guided regenerate** directions. It copies the direction back out as a `/guided` command. You can paste that command later to reuse the same steer. The button does not appear for **Game start** directions.

For an impersonated message, the window shows the impersonation details instead of a single direction. For the full guided generation and impersonate workflow, see the guide linked below.

## Using Peek Prompt to debug responses

Peek Prompt is the best tool for understanding a reply you did not expect. Use it when a character forgets something, ignores a rule, or acts out of character.

Open the **Assembled Prompt** window and check these things:

- Look for missing information. If a lorebook entry, memory, or persona detail is not in any section, the model never saw it.
- Check the parameter tags. A very high **Temperature** can make replies random, and a low **Max Output Tokens** value can cut replies short.
- Expand the **Chat History** section. Confirm the messages you expect are present and in the right order.
- Read the real token count after a reply. A very large prompt can push older messages out of the model's limit.

Once you know what the model actually received, you can fix the cause. You might edit a character card, adjust a lorebook entry, or change a value in your generation parameters.

## Related guides

- [Generation Parameters](../prompts/generation-parameters.md)
- [Preset Editor and Prompt Manager](../prompts/presets.md)
- [Guided Generation and Impersonate](guided-and-impersonate.md)
- [Message Actions: Edit, Delete, Swipe, Regenerate](messages.md)
