# Claude, ChatGPT, and Grok Subscription Connections

Three services let you chat with a plan you already pay for instead of an API key: **Claude (Subscription)**, **OpenAI (ChatGPT)**, and **Grok CLI (Subscription)**. You install a small command line tool (CLI) and sign in once. Marinara Engine then reuses that sign-in. Nothing is pasted into Marinara.

The plan you need:

- **Claude (Subscription)**: Anthropic Pro or Max, or another plan Claude Code accepts.
- **OpenAI (ChatGPT)**: a ChatGPT account. Usage limits depend on the plan.
- **Grok CLI (Subscription)**: SuperGrok or X Premium+.

## Add a subscription account

Before you start, know that the CLI must be installed and signed in on the computer that runs the Marinara server. This is not the phone or browser you view Marinara on. If Marinara runs on another computer or in Docker, do steps 1 and 2 there. The `npm` commands need Node.js, which you have if you installed Marinara from source. See [Installation](../INSTALLATION.md).

1. Open a terminal on the computer that runs Marinara. A terminal is the window where you type commands. On Windows, open PowerShell. On macOS, open Terminal.
2. Run the install command for your service, then run its sign-in command. The tool shows its own sign-in steps, usually a web page where you sign in.

| Service | Install | Sign in |
| --- | --- | --- |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude login` |
| ChatGPT | `npm i -g @openai/codex` | `codex login` |
| Grok | see below | `grok login` |

For Grok, the app shows this install command. If it does not run on your system, follow x.ai's own instructions for the Grok CLI.

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

3. In Marinara, click **Connections** in the top bar, then click **Add**.
4. Under **Chat**, click your service. These services have the tag **Sign in**.
5. The window says **Sign in first** and names the command. There is no key field. Click **Connect**. Marinara tests the login. **Connected** means it works.
6. Pick a model from the list, then click **Done**. For Grok CLI you can also leave the model empty, which uses the CLI's own default (see [Grok CLI (Subscription)](#grok-cli-subscription)).

Send a message in a chat to confirm. A reply means it works.

If it did not work:

- **Marinara could not use the login on this computer.** The CLI is not installed or not signed in on the Marinara computer. Run the sign-in command there, then click **Try again**.

## Claude (Subscription)

The sections from here on are optional settings. You do not need them to chat.

This service uses your Claude plan through Claude Code. It has three extra controls in the model editor (**Edit model**): prompt caching, **Fast mode**, and **Diagnose model routing**.

### Extended token caching

Prompt caching lets Claude reuse the start of your prompt, so repeated requests cost less of your limit. **Prompt caching → Extended token caching (1 hour)** asks for a one-hour cache, which helps when you pause between messages. It needs Claude Code 2.1.242 or later. Marinara sends the setting with the request and does not change your saved Claude settings.

When it is off, Claude uses its own default for your account. See [Claude Code prompt caching](https://code.claude.com/docs/en/prompt-caching).

### Fast mode

**Fast mode → Use Claude Code fast-mode routing** is off by default. Leave it off. It asks Claude Code for a faster model tier, but the app says current models no longer offer one, so turning it on does nothing useful and can add overhead. If you try to turn it on, a dialog titled **Turn on fast mode?** appears. Click **Keep it off**.

### Diagnose model routing

Use **Diagnose model routing** when you asked for a large model such as Opus but suspect you got a smaller one.

1. Pick a model. The button stays disabled until a model is set.
2. Click **Diagnose model routing**. Marinara saves unsaved changes first.
3. Read the result. Marinara sends a real prompt through your Claude Code sign-in and reports which model your account was billed for.

## OpenAI (ChatGPT)

This service uses your ChatGPT account through the Codex CLI. Marinara reads the local Codex login file and refreshes the session when it can.

To set how long Codex thinks before it answers, open **Edit model**, turn on **Use custom defaults for this model**, and pick a **Reasoning Effort**. It starts at **Default**, which keeps Codex's own level for the model. A chat can pick its own level in **Advanced Parameters**. The level in a preset does not change it. A Codex model used as a fallback follows only its own level, and agents on the model use the model's level. The levels you see match the ones available for the model you chose.

## Grok CLI (Subscription)

This service runs the Grok CLI on the Marinara computer. Two things differ from other services:

- It does not stream. A reply appears all at once instead of word by word.
- Its context window defaults to 32,000 tokens. Tokens are small pieces of text that models count. Large prompts can hit the CLI's own turn limit, so the default stays low. You can set a larger **Max Context Window** on the model.

In the model editor, **Use the Grok CLI default** leaves the model empty so the CLI picks its own. The editor names `grok-composer-2.5-fast` as usually the safest model for roleplay, because Marinara runs the CLI headless, with Grok's own tools, memory, web search, plans, and subagents turned off.

## Plan usage

Claude (Subscription) and OpenAI (ChatGPT) accounts can show how much of your plan's limits you have used.

1. Click **⋯** on the account's row, choose **Edit account**, and open **Usage and balance**.
2. If outside reads are off, click **Turn on**.
3. Turn on **Show the usage meter on the card**, then save.

Each limit window gets a bar with the percent used and when it resets, for example `58% · resets in 2h`. The same bars appear in a chat's connection picker and in the chat's **Connection** settings while this account is active. They do not appear for **Shuffle**.

- The bars count everything on your plan, not only Marinara. For Claude that includes Claude Code and claude.ai. For ChatGPT it includes all Codex use, such as the Codex CLI. Chats on chatgpt.com have their own limits and are not included.
- The services report a percent for each window and no token counts.
- A reading asks the CLI on the Marinara computer for the same data its own usage command shows. It sends no message to a model and uses none of your plan. The refresh button reads it again.
- A plan with only one window shows one bar.
- Claude Code marks its usage data as experimental. If a new version changes it, the bars show an error and a retry button instead of a wrong number.

## Limits of these services

- They need a paid plan (or an eligible ChatGPT plan) and the CLI signed in on the Marinara computer.
- None of them offers embeddings. Lorebook semantic search and memory recall need a separate account for embeddings.
- **Send test message** needs a model chosen first, except for Grok CLI.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Supported AI Providers](providers-reference.md)
