# Claude, ChatGPT, and Grok Subscription Connections

This guide covers the three connections that sign in through an account instead of an API key: **Claude (Subscription)**, **OpenAI (ChatGPT)**, and **Grok CLI (Subscription)**. You install a small command line tool, log in once, and Guksu Motor uses that account to chat. A command line tool (CLI) is a program you run by typing a command in a terminal window.

## What subscription connections are

Most connections in Guksu Motor use an API key. An API key is a secret string, like a password, that you paste into the connection so the AI service can bill your account.

These three connections work differently. They use a local login instead of an API key. You sign in to a CLI on your own machine, and Guksu reuses that login. Nothing is pasted into Guksu.

Use a subscription connection when your account includes access through one of these CLIs:

- **Claude (Subscription)** uses your Anthropic **Pro** or **Max** subscription.
- **OpenAI (ChatGPT)** uses your ChatGPT account.
- **Grok CLI (Subscription)** uses your **SuperGrok** or **X Premium+** account.

## What you need first

The account requirement depends on the provider.

- **Claude (Subscription)** needs a Claude plan supported by Claude Code subscription login.
- **OpenAI (ChatGPT)** supports eligible Free and paid ChatGPT plans. Usage limits vary by plan.
- **Grok CLI (Subscription)** needs SuperGrok or X Premium+.

For all three providers, the CLI must be installed and logged in on the same machine that runs the Guksu server. This is not the browser or phone you view Guksu on. Guksu runs the CLI locally, so the login has to live next to the server.

If you run Guksu on your own computer, that computer is the server. If you run it on another machine or in Docker, install and log in the CLI there.

## Claude (Subscription)

You need an Anthropic Pro or Max subscription. This is the same sign-in that Visual Studio Code and other Anthropic tools use.

1. On the machine running Guksu, install the Claude Code CLI:

```
npm i -g @anthropic-ai/claude-code
```

2. Sign in once:

```
claude auth login
```

3. In Guksu, open the **Connections** panel and click **New**.
4. In the **Create Connection** modal, type a name and pick the **Claude (Subscription)** provider, then click **Create**.
5. In the editor, notice there is no **API Key** or **Base URL** field. An info panel confirms they are not required.
6. Choose a Claude model, such as an Opus or Sonnet model, from the **Model** dropdown.
7. Click **Save**, then click **Send Test Message**. A short reply means the login works.

Claude subscription connections support text chat only. This connection has two extra controls, **Fast Mode** and **Diagnose Model Routing**, described below.

## OpenAI (ChatGPT)

You need a ChatGPT account. Guksu routes chat through the Codex CLI login.

1. On the machine running Guksu, install the Codex CLI:

```
npm i -g @openai/codex
```

2. Sign in once:

```
codex login
```

3. In Guksu, open the **Connections** panel and click **New**.
4. In the **Create Connection** modal, type a name and pick the **OpenAI (ChatGPT)** provider, then click **Create**.
5. Choose a model from the **Model** dropdown. The list comes from your ChatGPT session when available, otherwise a built-in list.
6. Click **Save**, then click **Send Test Message** to confirm a reply.

Guksu reads your local Codex login file and refreshes the session when it can.

## Grok CLI (Subscription)

You need a SuperGrok or X Premium+ account.

1. On the machine running Guksu, install the Grok CLI:

```
curl -fsSL https://x.ai/cli/install.sh | bash
```

2. Sign in once:

```
grok login
```

3. In Guksu, open the **Connections** panel and click **New**.
4. In the **Create Connection** modal, type a name and pick the **Grok CLI (Subscription)** provider, then click **Create**.
5. Pick a model, or leave the **Model** field blank to use the CLI default. The safest model for roleplay is usually `grok-composer-2.5-fast`.
6. Click **Save**, then click **Send Test Message**. This connection can run a test even with no model set.

Two things are special about Grok CLI. It does not stream, so a reply appears all at once instead of word by word. Its context window defaults to 32000 tokens, lower than other providers, because very large prompts can hit the CLI's own turn limit.

To load Grok models, use the **Fetch Models from Grok CLI** button in the **Model** section.

## Why there is no API key field

For all three subscription providers, the **API Key** and **Base URL** fields are hidden. That is on purpose. Your login lives inside the CLI on the server machine, so there is nothing for you to type into Guksu.

If you selected the wrong provider by mistake and see no key field, switch back to the provider you meant in the provider grid. The key field returns for API-based providers.

## Fast Mode (Claude only)

The **Claude (Subscription)** editor has a **Fast Mode** section with one toggle, **Use Claude Code fast-mode routing**. It is off by default.

Leave it off. The app itself describes the feature as doing nothing today. It asks Claude Code for a faster model tier, but current Claude models no longer offer one. Turning it on does nothing useful and may add overhead. The toggle stays in the UI only in case Anthropic brings the feature back.

If you try to turn it on, a confirm dialog titled **YOU DON'T WANT THIS SETTING ON!** appears. Choose **Keep it off**.

## Diagnose Model Routing (Claude only)

The **Claude (Subscription)** editor has a **Diagnose Model Routing** button in the tests area. Use it when you ask for one Claude model but suspect you got a smaller one.

1. Pick a model and click **Save**. The button is disabled until a model is selected.
2. Click **Diagnose Model Routing**.
3. Read the result. Guksu sends a real prompt through your Claude Code login. It then reports which model your account was actually billed for.

This catches a silent downgrade, where you request a larger model like Opus and quietly receive Sonnet or Haiku.

## Limitations to know

- These connections need a paid subscription and the CLI logged in on the server machine.
- Embeddings are not available on any of the three. Lorebook semantic search and memory recall need a separate connection for embeddings.
- **Claude (Subscription)** supports text chat only.
- **Grok CLI (Subscription)** does not stream and starts with a smaller context window.
- **Send Test Message** needs a model chosen first, except for Grok CLI, which can test without one.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Supported AI Providers](providers-reference.md)
