# Organizing Connections

This guide covers how to keep your saved connections tidy in Marinara Engine. It explains how models are grouped under connections, favorites, moving a model, folder view, search and sort, duplicating and deleting, Shuffle, quick switch, and exporting or importing connections. A connection is one API key, account, or endpoint for an AI service.

You do all of this in the **Connections** panel. Open it, and below the **Defaults** card your connections appear as cards. Each card shows the connection name and its state (**Ready**, **Needs key**, or **Off**). Open a card to see the models you saved under it. Each saved model keeps its own settings.

## Favorites and moving models

Click the star on a model to add it to **Favorites**. Starring saves the model and keeps it at the top of its connection and of the quick switch. Click the star again to remove it from favorites. Removing the star keeps the saved model.

To move a model to another connection, open the model's **⋯** menu and choose **Move to connection…**. You can only move a model to another connection of the same service. The model then uses that connection's key and model list. Chats that use the model keep working.

When you add a second connection of the same service without typing a name, its automatic name gets the last 4 characters of the key, for example `OpenAI · …a1b2`. A name you type is never changed.

When you update from an older version, Marinara groups your existing connections automatically on first start. The Connections panel shows a one-time note about it. Click **Dismiss this note** to hide it.

## Connection folders

Folders are part of **Folder view**. To turn it on, click **More actions** next to the search box and choose **Folder view**. Choose **Card view** from the same menu to go back to the cards.

Use connection folders to group related connections. For example, put all your local models in one folder and all your paid providers in another.

To create a folder, follow these steps:

1. Click the **New Folder** button above the connection list.
2. A new folder named "unnamed" appears.
3. Rename it right away so you can tell it apart (see below).

To rename a folder, double-click the folder row, or double-tap it on a touch screen. You can also select the folder row and press the **F2** key. Type the new name and press Enter.

To file a connection into a folder, drag the connection row and drop it onto the folder. To take a connection back out, drag it onto the area below the folders. A hint reads **Drop here to move out of folder** while you drag.

To collapse or expand a folder, click the folder row once. A small number on the folder row shows how many connections are inside.

To delete a folder, click the trash icon on the folder row. If the folder still has connections inside, Marinara asks you to confirm with a **Delete Folder** dialog. An empty folder is deleted right away, with no confirmation prompt. Deleting a folder does not delete the connections inside it. Those connections move back to the unfiled area instead.

## Search and sort

The **Search connections** box filters the list as you type. It matches the connection name, service, model, endpoint, image or video service, and embedding model. When nothing matches, you see "No connections match your search".

The **Sort order** dropdown next to the search box changes the list order. It has five options:

| Option | What it does |
|---|---|
| **Custom** | Your own drag-and-drop order. |
| **A-Z** | Sorts by name, A to Z. |
| **Z-A** | Sorts by name, Z to A. |
| **Newest** | Newest connections first. |
| **Oldest** | Oldest connections first. |

To set a custom order, drag connection rows up or down. Dragging a connection switches the sort to **Custom** for you automatically.

## Duplicating and deleting

Open the **⋯** menu on a model row to see its actions, such as **Make default**, **Duplicate**, and **Delete**.

To duplicate a model, choose **Duplicate**. This makes a full copy with the same settings. There is no confirmation step.

To delete a single model, choose **Delete**. Marinara shows a **Delete Connection** dialog that reads Delete "your model name"? This cannot be undone. Click **Delete** to confirm.

To delete a whole connection, click **Edit** on its card, then click **Delete connection**. Marinara asks you to remove its models first. This removes the key and the endpoint.

To delete or export several at once, click **More actions**, then **Select connections**. This turns on selection mode. Tap the items you want, then use the **Export** or **Delete** button in the action bar at the bottom. Bulk delete shows a **Delete Connections** dialog before it removes them.

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

**A pick in the menu does not change the connection.** Other chats, agents, and helpers keep their models. To change the model for new chats, set the **Main** model in the **Defaults** card at the top of the **Connections** panel. The same card sets the **Fallback** and the models for decisions, embeddings, images, and other features.

## Exporting and importing connections

You can export connections to a file to back them up or move them to another install, then import them later.

**Your API keys are never included in an export.** After you import connections, you must open each one and enter its API key again. Favorites are included; the saved model list is not, so it loads again the first time you open the connection's models.

To export a single model, open it in the editor and click its **Export** button (the upload icon). To export several at once, use **Select connections** mode in the panel and click **Export** in the action bar. Before the download starts, Marinara shows an **Export Connection Data** dialog with this warning: This will export your connection data, WITHOUT your provided API Key. Remember to never share those with others! Click **Export** to continue.

A single connection downloads as a `.connection.json` file. Several connections download together as a `marinara-connections.zip` file.

To import connections, click the **Import** button at the top of the Connections panel. The **Import Connections** window opens. Drop one or more `.json` files onto it, or click to browse for them. The window reminds you: Imported connections never include API keys. Add each key again after import. After importing, each new connection has an empty API key until you fill it in.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Chat Settings Overview](../chats/chat-settings.md)
