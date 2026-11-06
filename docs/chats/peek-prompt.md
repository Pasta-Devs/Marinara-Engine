# Peek Prompt: See What the AI Received

Peek Prompt shows the exact text Marinara Engine sent to the model for a reply, or a live preview of the next one. Use it when a reply is not what you expected and you want to know what the model saw.

The prompt is the full block of instructions and chat history Marinara puts together and sends. The model reads it and writes the reply.

## Opening Peek Prompt

There are two ways to open the **Assembled Prompt** window.

From a message:

1. Tap the newest AI message to show its action bar.
2. Click **Peek prompt** (a magnifying glass).

It appears only on the last AI message. Older messages do not show it.

From the input box, which also works before any AI reply:

1. Type this exact text in the message box: `{{prompt}}`
2. Press <kbd>Enter</kbd> or click **Send**.

Marinara clears the box and opens the window instead of sending a message. `{{prompt_preview}}` and `{{preview_prompt}}` do the same.

## What the window shows

A badge next to the title says which version of the prompt you are reading.

| Badge | Meaning |
| --- | --- |
| **Exact Text Model Request** | The literal request that was sent to the model. |
| **Live Preview** | A preview built right now. |
| **Raw Messages** | The raw list of messages. |
| **Prompt Preview** | A general preview. |
| **Decision test preview** | A prompt built with the answers from a decision test. It was not sent to the chat model. |

Below it, an info panel can show the service and model, an estimated token count, and the real prompt token count after a reply finishes. A token is a small chunk of text that models count instead of words. It also shows tags for the values used, such as **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** and **Assistant Prefill**, and sampling values like **Top P**, **Top K** and **Min P**. Tags such as **Service Tier** and **Assistant Prefill**, and the sampling values, are advanced model settings. You can ignore them at first. If the first model failed and your fallback wrote the reply, the panel names the failed model and a short reason, such as "key rejected" or "rate limited".

The rest is the prompt in collapsible sections, each with its own rough token estimate. Chat messages are grouped under **Chat History**. For an exact saved request, the service may have merged several chat turns into one block, so expand each block to see all the text. Click a section header to open or close it.

An **Exact Text Model Request** is the request as sent for that reply. It was saved before anything that ran after the reply, such as an automatic summary or hiding messages, so it can hold messages the next reply will not get. Click **Show current context** to build the prompt from the chat as it is now, without sending it. Click **Show sent request** to go back.

### Copy the prompt

Click the copy button next to the close button. It copies every section and message as plain text, in the order sent, including closed sections. Each message starts with a line naming its role, such as `[system]`, `[user]` or `[assistant]`. For an exact saved request, it copies the request as it was sent. Copying sends nothing.

### Find text in the prompt

Use the **Find** field at the top, or press <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>Cmd</kbd>+<kbd>F</kbd> on a Mac) inside the window. Find ignores letter case and searches the whole prompt, including closed sections and chat history. The counter shows the current match, such as "2 of 5". Use the up and down buttons, or <kbd>Enter</kbd> and <kbd>Shift</kbd>+<kbd>Enter</kbd>, to move between matches. It wraps at both ends. While **Find** has text, the window shows the full message text. Clear it to return to sections.

## Check a reply with Reply checkup

When Marinara spots a likely cause for a poor reply, the window shows a **Reply checkup** panel above the prompt. It can say:

- The character card is large and takes a big share of the prompt budget (**Large character card**).
- The reply hit its token limit and stopped mid-sentence (**Cut off**).
- The model sent back no visible text (**Empty reply**).
- Older messages were not sent because the prompt did not fit (**N older messages not sent**).
- Lorebook entries matched but did not fit the budget (**N lorebook entries left out**).
- The reply limit was lowered to make room for the prompt (**Reply limit cut**).

Where it helps, a link jumps to the setting to change, such as **Max output tokens** or **Lorebook token budget**.

## Debug an unexpected reply

Open **Assembled Prompt** and check:

- **Missing information.** If a lorebook entry, memory or persona detail is in no section, the model never saw it.
- **Parameter tags.** A high **Temperature** can make replies random, and a low **Max Output Tokens** can cut them short.
- **Chat History.** Confirm the messages you expect are there, in the right order.
- **Token count.** A large prompt can push older messages out of the model's limit.

Then fix the cause: edit a character card, adjust a lorebook entry, or change a generation setting. See [Generation Parameters](../prompts/generation-parameters.md).

To read the direction behind a steered reply, use **Stored guidance** on the message. See [Guided Generation and Impersonate](guided-and-impersonate.md#read-stored-guidance).

## Testing decision statements

A [Decision model](../connections/decision-models.md) answers yes-or-no questions for features such as lorebooks. **Decision diagnostics** inside Peek Prompt lets you inspect and test those questions for the current chat.

1. Open Peek Prompt and find **Decision diagnostics**.
2. Opening it, or clicking **Preview inputs**, prepares the request bodies without asking any model. Expand **Prepared request bodies** to see the recent messages, resolved statements, options and request format.
3. Click **Test decisions** to ask your Decision model the eligible questions.

**Test decisions** makes real requests, so a hosted model may charge for them. It does not write a chat reply, run agents, change game state, or save its answers or timers to the chat. Later lorebook statements may become reachable only after an earlier one is answered. An explicit test can wait for a local reasoning model even when ordinary pre-reply decisions are deferred. This does not change your setting for live replies.

Each result shows its score when there is one, the threshold for a yes-or-no statement, and the answer. A model that returns only "yes" or "no" is labeled so, and its answer is not shown as a probability. Choice results show the selected option. Held, deferred, over-limit, unavailable and failed decisions each have their own explanation.

After a test, the prompt below uses the test's answers. Click **Show original prompt** to return to what you opened, or **Show tested prompt** to switch back. **Requests sent and results** shows the actual request bodies and results, without authentication headers.

If it did not work: **Could not prepare the decision test. Check the chat connection and try again.** Check that the chat has a working model, then retry.

Tests use the current chat and settings, even when you opened Peek Prompt from an older reply. They do not rebuild the original decision requests. They cover prompt statements and lorebook decisions, not agent activation or post-reply decisions.

When **Use Decision model** is on for Advanced Memory (Marinara's long-term memory feature, see [Memory Recall and Chat Summaries](../agents/memory.md)), the panel also shows **Advanced Memory activity**. These saved reports show the latest recall and scene-end check with their model, time, scores, selections and fallback status. They describe past calls, not the current preview, and can appear even when the prompt has no decision statements. Compatible swipes can reuse an earlier recall report. Each report keeps up to 128 results, selected ones first, and counts the rest. New reports appear after the next eligible Decision model call. Viewing them makes no model requests.
