# Connecting to an AI Provider

This guide shows you how to connect Marinara Engine to an AI provider so your characters can reply. You will add a connection, paste an API key, choose models, and test that it works.

## What a connection is

A connection is one API key, account, or endpoint for an AI service. It stores the service, the API key or login, the endpoint (the web address of the service), its limits, and an on/off switch. The models you save are grouped under the connection, and each saved model keeps its own settings. If you use two keys for the same service, you have two connections.

An API key is a secret code from your AI provider. It works like a password. It lets Marinara talk to the AI service and use your account there. Marinara stores your key encrypted, and it is never included when you export a connection.

Marinara Engine does not come with a ready-made connection or a free starter key. A fresh install has zero connections. You must create at least one connection before you can start a chat.

## Opening the Connections panel

You manage connections in the **Connections** panel on the right side of the app.

If you have no connections yet and you try to start a chat, Marinara opens the **Add connection** window at once. When you finish, **Start chatting** creates the chat with the model you picked.

At the top of the panel is the **Defaults** row. Its page sets your **Main** model, a **Fallback**, and the models for other jobs such as decisions, embeddings, and images. Below it are your connections, in the groups **Chat**, **Images & voice**, and **On this device**. Click a connection to see its models (see [Organizing Connections](organizing-connections.md)).

Two buttons sit above the list:

- **Add connection** opens the **Add connection** window.
- **Import** loads connections from a file.

The **More actions** button (three dots) opens a menu with **Export all connections**.

## Creating a connection

Follow these steps to add your first connection.

1. In the **Connections** panel, click **Add connection**. The window shows one screen at a time, with a step count and a **Back** button. On a phone it fills the screen.
2. Choose a service, such as **OpenAI**, **Anthropic**, or **OpenRouter**. Search by its name or what it provides, such as chat or images. If the service is already connected, choose **Add models to it** or **Connect a second account**.
3. Enter the service's key, sign in, or enter your local server's **Server address**. The eye button shows or hides a key. **More options** contains the optional name and advanced connection settings. Click **Test and continue**. A successful test opens the model list. A failed test shows its reason and **Try again**; local servers also offer **Continue anyway**.
4. Choose models to star. Clicking a model or its star saves it under the connection. Clicking its star again removes the star. If a model is missing from the catalog, type its exact ID. Click **Continue** to review the models you added.
5. On the ready screen, choose whether to **use the first model in this chat** or **make it your Main model**. These are separate choices. Making it Main is selected initially only when you have no Main model. **Done**, **Add another connection**, or **Start chatting** applies the choices. Closing the window leaves the starred models saved without applying these choices.

If you leave the **Name** empty, Marinara names the connection after the service. When you add a second connection for the same service without typing a name, the automatic name gets the last 4 characters of the key, for example `OpenAI · …a1b2`. A name you type is never changed.

If you pick a service that you already connected, step 1 marks it **Already connected**. Choose **Add models to it** to open its model list, or add a second key as a new connection.

### On this device

The **On this device** group in step 1 has the parts that are built into Marinara: **Local Model**, **Text to Speech**, and **Speech to Text** (only when the **Calls** agent is installed). They need no account. A part that you already set up shows **Already set up**. **Local Model** opens the Local Model download (see [Local Model Setup](local-model.md)). **Text to Speech** and **Speech to Text** show their settings in the window, and changes save at once.

### Adding models later

To add models to a connection that you already have, click **⋯** on its row in the panel and **Add model**, or click **Add model** in its editor. This opens the same model list as step 3, for that connection only. Click a model or its star to add it, click the star again to remove it (see [Favorites](organizing-connections.md#favorites-and-moving-models)), and click **Done** to close.

**Browse all models** in the chat input's **Connections** menu opens the same list. There, a click on a model uses it in this chat only, and a click on its star adds it to the connection.

Later, you can change the model for one chat without opening the editor: use the **Connections** menu in the chat input or the **Model** field in **Chat Settings → Connection**. See [Quick switch](organizing-connections.md#shuffle-and-quick-switch).

You usually do not need to touch the **Endpoint** field. Marinara fills it in for known services. Only change it if you use a proxy or a local server.

For the list of every supported provider, its default settings, and where to get each key, see [Supported AI Providers](providers-reference.md).

Some services use a local login instead of an API key. For those, there is no key field. See [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md).

To connect a model running on your own computer, see [Connecting a Local or Self-Hosted Model](local-self-hosted.md).

## Testing your connection

**Test and continue** in the Add flow already checks the connection. You can test it again later with **Test** on the connection's card. To test a saved model, open it from its connection in the panel. The bottom of the model editor has a **Connection Tests** card. Use it to confirm your setup works before you chat.

1. Click **Test Connection**. This checks your API key against the provider. On success you see a green **Connection Test: Success** line with the response time.
2. Click **Send Test Message**. This sends the word "hi" to the model you picked and shows the reply. On success you see a green **Test Message: Success** line with the model's answer below it.

The **Send Test Message** button stays disabled until you pick a model. If a test fails, the line turns red and shows the error. That message usually tells you what to fix, such as a wrong key or an unknown model.

## Choosing a model for a chat

A new chat uses your **Main** model from **Defaults** in the **Connections** panel. To give one chat a different model, use either of these:

- Open the **Connections** menu in the chat input, then pick a model.
- Open **Chat Settings**, find the **Connection** section, and open the **Model** field to pick a model.

A pick there changes only that chat. Both places open the same chooser: the current model stays at the top, followed by recent and starred models. **Browse** opens a connection's catalog. **Follow Main** clears the chat's own pick. **Shuffle** picks a different model each time from your pool. In Game Mode the field is labeled **GM / Party Model**.

When you create a brand-new chat and have no connection saved, the **Add connection** window opens first. Add a connection and pick a model, then click **Start chatting**.

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
