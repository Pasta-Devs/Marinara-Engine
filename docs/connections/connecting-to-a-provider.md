# Connecting to an AI Provider

This guide shows you how to connect Marinara Engine to an AI provider so your characters can reply. You will create a connection, paste an API key, pick a model, and test that it works.

## What a connection is

A connection is a saved setup that tells Marinara Engine how to reach one AI service. Each connection stores four things: the provider, the API key or login, the base URL (the web address of the service), and the model.

An API key is a secret code from your AI provider. It works like a password. It lets Marinara talk to the AI service and use your account there. Marinara stores your key encrypted, and it is never included when you export a connection.

Marinara Engine does not come with a ready-made connection or a free starter key. A fresh install has zero connections. You must create at least one connection before you can start a chat.

## Opening the Connections panel

You manage connections in the **Connections** panel on the right side of the app.

If you have no connections yet and you try to start a chat, Marinara shows a **Set Up** dialog. That dialog has an **Open Connections** button. Click it to jump straight to the **Connections** panel.

At the top of the panel you will see three buttons. They show icons only, with no text labels.

- **New** (a plus icon) opens the **Create Connection** window.
- **Import** (a download arrow icon) loads connections from a file.
- **Select** (a checkmark icon) turns on bulk selection so you can export or delete several connections at once.

## Creating a connection

Follow these steps to add your first provider.

1. In the **Connections** panel, click the **New** button (the plus icon).
2. In the **Create Connection** window, type a **Name** for the connection. Pick something you will recognize later, for example `GPT-4o Main`.
3. Under **Provider**, click the button for the service you want, for example **OpenAI**, **Anthropic**, or **OpenRouter**.
4. Click **Create**. Marinara creates the connection and opens the full **Connection Editor** for it.
5. Find the **API Key** field. Paste your key from the provider here. If you do not have a key yet, click the **Get your {Provider} API key** link under the field. That link opens the provider's key page in your browser.
6. Open the **Model** dropdown and pick a model. You can type in the **Search models…** box to filter the list. If the list is empty, click **Fetch Models from API** to load the models your account can use.
7. Click **Save**. The status text near the top changes to **Saved**.

You usually do not need to touch the **Base URL** field. Marinara fills it in for known providers. Only change it if you use a proxy or a local server.

For the list of every supported provider, its default settings, and where to get each key, see [Supported AI Providers](providers-reference.md).

Some providers use a local login instead of an API key. For those, there is no **API Key** field. See [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md).

To connect a model running on your own computer, see [Connecting a Local or Self-Hosted Model](local-self-hosted.md).

## Testing your connection

The bottom of the **Connection Editor** has a **Connection Tests** card. Use it to confirm your setup works before you chat.

1. Click **Test Connection**. This checks your API key against the provider. On success you see a green **Connection Test: Success** line with the response time.
2. Click **Send Test Message**. This sends the word "hi" to the model you picked and shows the reply. On success you see a green **Test Message: Success** line with the model's answer below it.

The **Send Test Message** button stays disabled until you pick a model. If a test fails, the line turns red and shows the error. That message usually tells you what to fix, such as a wrong key or an unknown model.

## Choosing a connection for a chat

A connection does nothing on its own. Each chat picks which connection to use.

1. Open a chat, then open its **Chat Settings**.
2. Find the **Connection** section.
3. Choose your connection from the dropdown.

The dropdown also has two special options. **None** means no connection is chosen yet. **🎲 Random** (a die icon before the word Random) picks a different connection each time from your random pool. In Game Mode, the section is still called **Connection**, but the dropdown inside it is labeled **GM / Party Model**.

When you create a brand-new chat, the **Set Up** dialog asks you to pick a connection first. Choose one, then click **Create Chat**.

## Common errors

If a test or a message fails, check these first:

- A wrong or expired **API Key**. Open the connection, paste the key again, then click **Save**.
- No model chosen. **Send Test Message** stays disabled until you select a **Model**.
- A key from the wrong provider. Each provider needs its own key. Switching the **Provider** clears the **API Key** field on purpose.
- A blocked or unreachable **Base URL**. Leave it blank to use the provider default, unless you run a local or proxy server.

For more fixes to connection and generation errors, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Supported AI Providers](providers-reference.md)
- [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md)
- [Connecting a Local or Self-Hosted Model](local-self-hosted.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
