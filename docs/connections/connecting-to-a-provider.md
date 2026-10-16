# Connecting to an AI Provider

This guide shows you how to connect Marinara Engine to an AI provider so your characters can reply. You will add a connection, paste an API key, choose models, and test that it works.

## What a connection is

A connection is one API key, account, or endpoint for an AI service. It stores the service, the API key or login, the endpoint (the web address of the service), its limits, and an on/off switch. The models you save are grouped under the connection, and each saved model keeps its own settings. If you use two keys for the same service, you have two connections.

An API key is a secret code from your AI provider. It works like a password. It lets Marinara talk to the AI service and use your account there. Marinara stores your key encrypted, and it is never included when you export a connection.

Marinara Engine does not come with a ready-made connection or a free starter key. A fresh install has zero connections. You must create at least one connection before you can start a chat.

## Opening the Connections panel

You manage connections in the **Connections** panel on the right side of the app.

If you have no connections yet and you try to start a chat, Marinara shows a **Set Up** dialog. That dialog has an **Open Connections** button. Click it to jump straight to the **Connections** panel.

At the top of the panel is the **Defaults** card. It sets your **Main** model, a **Fallback**, and the models for other features such as decisions, embeddings, and images. Below it are your connections, each with its models grouped under it.

Two buttons sit above the list:

- **Add connection** opens the **Add connection** window.
- **Import** loads connections from a file.

The **More actions** button (three dots) next to the search box opens a menu. It has **Select connections**, which turns on bulk selection so you can export or delete several connections at once, and **Folder view** (see [Organizing Connections](organizing-connections.md)).

## Creating a connection

Follow these steps to add your first connection.

1. In the **Connections** panel, click **Add connection**.
2. Step 1 is **Choose a service**. Click the service you want, for example **OpenAI**, **Anthropic**, or **OpenRouter**. You can type in the **Find a service** box to filter the list.
3. Step 2 is **Key or address**. Paste your key into the **API key** field. If you do not have a key yet, get one from the service's website. For a local server, enter its **Endpoint** instead. For a subscription service, the step tells you that no key is needed. Open **More options** to type a **Name (optional)**, set the **Endpoint**, or limit **Requests per minute** and **Parallel jobs**. Then click **Save and test**. A successful test shows **The connection works.**
4. Step 3 is **Pick models**. Click each model you want to use. A picked model is added to the connection. If the list is empty, type a model ID instead. Click **Done**.

If you leave the **Name** empty, Marinara names the connection after the service. When you add a second connection for the same service without typing a name, the automatic name gets the last 4 characters of the key, for example `OpenAI · …a1b2`. A name you type is never changed.

To use a service you already added with another key, pick it under **Use existing** in step 1 to add more models to that connection.

Later, you can change the model for one chat without opening the editor: use the **Connections** menu in the chat input or the **Model** field in **Chat Settings → Connection**. See [Quick switch](organizing-connections.md#shuffle-and-quick-switch).

You usually do not need to touch the **Endpoint** field. Marinara fills it in for known services. Only change it if you use a proxy or a local server.

For the list of every supported provider, its default settings, and where to get each key, see [Supported AI Providers](providers-reference.md).

Some services use a local login instead of an API key. For those, there is no key field. See [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md).

To connect a model running on your own computer, see [Connecting a Local or Self-Hosted Model](local-self-hosted.md).

## Testing your connection

**Save and test** in the Add flow already checks the connection. You can test it again later with **Test** on the connection's card. To test a saved model, open it from its connection in the panel. The bottom of the model editor has a **Connection Tests** card. Use it to confirm your setup works before you chat.

1. Click **Test Connection**. This checks your API key against the provider. On success you see a green **Connection Test: Success** line with the response time.
2. Click **Send Test Message**. This sends the word "hi" to the model you picked and shows the reply. On success you see a green **Test Message: Success** line with the model's answer below it.

The **Send Test Message** button stays disabled until you pick a model. If a test fails, the line turns red and shows the error. That message usually tells you what to fix, such as a wrong key or an unknown model.

## Choosing a model for a chat

A new chat uses your **Main** model from the **Defaults** card. To give one chat a different model, use either of these:

- Open the **Connections** menu in the chat input, then pick a model.
- Open **Chat Settings**, find the **Connection** section, and pick a saved model from the dropdown.

A pick there changes only that chat. To make the chat follow your Main model again, choose **Use default (model name)**. The dropdown also has **🎲 Random**, which picks a different model each time from your Shuffle. In Game Mode, the section is still called **Connection**, but the dropdown inside it is labeled **GM / Party Model**.

When you create a brand-new chat and have no connection saved, the **Set Up** dialog asks you to pick a connection first. Choose one, then click **Create Chat**.

## Common errors

If a test or a message fails, check these first:

- A wrong or expired **API key**. Open the connection with its **Edit** button, paste the key again, then click **Save**. A connection that has no key shows **Needs key**.
- No model chosen. **Send Test Message** stays disabled until you select a **Model**. A connection with no models shows **No models yet**.
- A key from the wrong service. Each service needs its own key.
- A blocked or unreachable **Endpoint**. Leave it empty to use the provider default, unless you run a local or proxy server.

For more fixes to connection and generation errors, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Supported AI Providers](providers-reference.md)
- [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md)
- [Connecting a Local or Self-Hosted Model](local-self-hosted.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
