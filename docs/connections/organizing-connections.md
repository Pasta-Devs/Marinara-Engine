# Organizing Connections

This guide covers how to keep your saved connections tidy in Marinara Engine. It explains the Connections panel, favorites, moving a model, search, duplicating and removing, Shuffle, quick switch, and exporting or importing connections. A connection is one API key, account, or endpoint for an AI service.

## The Connections panel

You do all of this in the **Connections** panel. At the top is the **Defaults** row. It shows your **Main** model and, when something needs attention, how many problems there are. Below it your connections are listed in groups:

- **Chat** has the connections for chat models.
- **Images & voice** has the image, video, and voice services.
- **On this device** has the parts built into Marinara that you set up: **Local Model**, **Text to Speech**, and **Speech to Text**.

Each row shows the connection's icon, its name, and how many models you saved. A row that needs attention has its fix on the row: **Add key** for a connection without a key, **Turn on** for a connection that is off, and **Load** or **Retry** for the Local Model.

Each connection shows its models under it. Click the chevron at the left of a connection to hide its models, and click it again to show them. Marinara remembers which connections you hid. Click a connection's row to open its page. When the panel is narrow, the page replaces the list; click **‹ Connections** to go back. When the panel is at least 768 pixels wide, the list stays on the left and the page opens on the right.

A connection's page shows:

- **Test**, **Edit**, and **Add model**. **Test** checks the key and shows the result below.
- A note when the connection needs a key or is off.
- The usage card, for services that report usage.
- **Your models**, grouped by the company that made them. Each model shows its badges and a star. Click a model to edit it.
- **Browse all models**, which opens the connection's full model list.

The **Defaults** page is **Who does what**. It is one list with a section for each job: **Main**, **Agents**, **Images**, **Video**, **Audio**, **Embeddings**, **Decision**, **Voice**, and **Speech to text** (only when the **Calls** agent is installed). Main, Agents, Images, Video and Audio each have a **Default** and a **Fallback** row. Click a row to choose the model. If a job has a problem, for example its connection needs a key or is off, the section shows the problem with a button to fix it. **Voice** and **Speech to text** open the page of their engine. When the engine is not set up, the row shows **Set up ›**, which opens the steps for it. At the end, **Features** lists the models for Professor Mari, quick answers and Impersonate.

### Provider icons

Each connection shows the icon of its service. The icons come with Marinara, so Marinara never loads them from the internet. A custom endpoint shows the icon of a known server or gateway when its address or name contains one, for example Ollama, LM Studio, KoboldCpp, Bifrost, or LiteLLM. Otherwise it shows the first letter of its name. A gateway that groups its models by upstream, for example `linkapi/` or `nanogpt/`, shows the upstream's icon next to each group.

## Favorites and moving models

The star on a model marks it as one of your models. Click the star in the **Add model** list to save a model with a star. Starred models are at the top of the quick switch.

Click the star of a saved model to remove it. Marinara removes the model and shows **Undo** for a few seconds. A model stays, without its star, when it still has a job: when it has a role in **Defaults**, its own settings, a chat that uses it, or when it is the last model of the connection. The message names the reason.

When you update from an older version, Marinara stars all the models you saved before, so none of them are removed.

To move a model to another connection, open the model's **⋯** menu and choose **Move to connection…**. You can only move a model to another connection of the same service. The model then uses that connection's key and model list. Chats that use the model keep working.

When you add a second connection of the same service without typing a name, its automatic name gets the last 4 characters of the key, for example `OpenAI · …a1b2`. A name you type is never changed.

When you update from an older version, Marinara groups your existing connections automatically on first start. The Connections panel shows a one-time note about it. Click **Dismiss this note** to hide it.

## Search

The **Search models and connections** box at the top of the panel searches as you type. Models that match are listed first, then connections. Click a model to open its editor, or a connection to open its page. When nothing matches, the panel says so.

On a computer, you can drag a model row onto a chat to use that model in the chat.

## Duplicating and removing

Open the **⋯** menu on a model row to see its actions, such as **Make default for…**, **Edit model**, **Duplicate**, and **Remove**.

To duplicate a model, choose **Duplicate**. This makes a full copy with the same settings. There is no confirmation step.

To remove a single model, choose **Remove**. Marinara shows a **Delete Connection** dialog that reads Delete "your model name"? This cannot be undone. Click **Delete** to confirm.

To delete a whole connection, open its page and click **Edit**, then click **Delete connection**. Marinara asks you to remove its models first. This removes the key and the endpoint.

## Shuffle and quick switch

Shuffle lets a chat pick a different connection each time it generates a reply. This is useful when you want to spread requests across several services or models.

To add a model to Shuffle, open its **⋯** menu and choose **Add to Shuffle**. Choose **Remove from Shuffle** to take it out again.

To make a chat use Shuffle, open **Chat Settings**, find the **Connection** section, and choose **🎲 Random** from the dropdown. In Game Mode this dropdown is labeled **GM / Party Model**. Each reply then picks a random model from your Shuffle.

The **Connections** menu in the chat input is a faster way to change the model for the chat you are in. Open it from the chat input area. A pick there changes only that chat, and the menu says **This chat only** next to it. It shows these parts:

- **Favorites** and **Recent** models, grouped by connection, for quick picks.
- **Browse all models** opens the full list of a connection. Type in the **Search models or paste an ID…** box to filter the list. To use a model that is not listed, type its exact ID and click the **Use "…"** row. This adds the ID to the connection.
- **Use default (model name)** clears the chat's own pick. The chat then follows your Main model again. The hint reads **Follows your Main model**.
- **Shuffle** turns Shuffle on for this chat.
- After you pick a model, the confirmation message offers **Make it my Main model**, which sets that model as your Main model for new chats, and **Undo**, which reverts the pick.
- Click the star next to a model to add it to **Favorites**.

On a phone, tap the chevron next to the message box and open the **Connections** tab.

**A pick in the menu does not change the connection.** Other chats, agents, and helpers keep their models. To change the model for new chats, set the **Main** model on the **Defaults** page of the **Connections** panel. The same page sets the **Fallback** and the models for decisions, embeddings, images, and other features.

## Exporting and importing connections

You can export connections to a file to back them up or move them to another install, then import them later.

**Your API keys are never included in an export.** After you import connections, you must open each one and enter its API key again. Favorites are included; the saved model list is not, so it loads again the first time you open the connection's models.

To export a single model, open it in the editor and click its **Export** button (the upload icon). To export all of them, open **More actions** at the top of the panel and choose **Export all connections**. Before the download starts, Marinara shows an **Export Connection Data** dialog with this warning: This will export your connection data, WITHOUT your provided API Key. Remember to never share those with others! Click **Export** to continue.

A single connection downloads as a `.connection.json` file. Several connections download together as a `marinara-connections.zip` file.

To import connections, click the **Import** button at the top of the Connections panel. The **Import Connections** window opens. Drop one or more `.json` files onto it, or click to browse for them. The window reminds you: Imported connections never include API keys. Add each key again after import. After importing, each new connection has an empty API key until you fill it in.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Chat Settings Overview](../chats/chat-settings.md)
