# Organizing Connections

This guide covers how to keep your saved connections tidy in Marinara Engine. It explains connection folders, search and sort, duplicating and deleting, the random pool, the Quick Connection Switcher, and exporting or importing connections. A connection is a saved setup that tells Marinara how to reach one AI service.

You do all of this in the **Connections** panel. Open it, and your saved connections appear as a list of rows. Each row shows the connection name and its provider and model below the name.

## Connection folders

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

The **Search connections** box filters the list as you type. It matches the connection name, provider, model, base URL, image or video service, and embedding model. When nothing matches, you see "No connections match your search".

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

Hover over a connection row (or look at the row on a touch screen) to see its action buttons.

To duplicate a connection, click the **Duplicate** button (the copy icon). This makes a full copy, including the stored API key. The copy opens in the editor so you can rename it. There is no confirmation step.

To delete a single connection, click its **Delete** button (the trash icon). Marinara shows a **Delete Connection** dialog that reads Delete "your connection name"? This cannot be undone. Click **Delete** to confirm.

To delete or export several connections at once, click the **Select** button at the top of the panel. This turns on selection mode. Tap the connections you want, then use the **Export** or **Delete** button in the action bar at the bottom. Bulk delete shows a **Delete Connections** dialog before it removes them.

## The random pool and Quick Connection Switcher

The random pool lets a chat pick a different connection each time it generates a reply. This is useful when you want to spread requests across several providers or models.

To add a connection to the random pool, click the shuffle icon on its row. Its tooltip reads **Add to random pool**. Once the connection is in the pool, the tooltip changes to **In random pool (click to remove)**. Click the icon again to take the connection out.

To make a chat use the random pool, open **Chat Settings**, find the **Connection** section, and choose **🎲 Random** from the dropdown. In Game Mode this dropdown is labeled **GM / Party Model**. Each reply then picks a random connection from your pool.

The **Quick Connection Switcher** is a faster way to change the connection for the chat you are in. Click the link icon in the chat input area to open it. It shows your connections in a small menu:

- Click a connection to use it for the current chat right away.
- Click the dice button at the top of the menu to turn the random pool on or off for this chat.
- While the random pool is on, clicking a connection instead adds it to or removes it from the pool. A checkmark shows which connections are in the pool.

## Exporting and importing connections

You can export connections to a file to back them up or move them to another install, then import them later.

**Your API keys are never included in an export.** After you import connections, you must open each one and enter its API key again.

To export a single connection, open it in the editor and click its **Export** button (the upload icon). To export several at once, use **Select** mode in the panel and click **Export** in the action bar. Before the download starts, Marinara shows an **Export Connection Data** dialog with this warning: This will export your connection data, WITHOUT your provided API Key. Remember to never share those with others! Click **Export** to continue.

A single connection downloads as a `.connection.json` file. Several connections download together as a `marinara-connections.zip` file.

To import connections, click the **Import** button at the top of the Connections panel. The **Import Connections** window opens. Drop one or more `.json` files onto it, or click to browse for them. The window reminds you: Imported connections never include API keys. Add each key again after import. After importing, each new connection has an empty API key until you fill it in.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Chat Settings Overview](../chats/chat-settings.md)
