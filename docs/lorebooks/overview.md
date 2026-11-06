# Lorebooks Overview

A lorebook is a set of world facts the AI reads when their keywords come up in the chat. Use one for places, factions, backstories and rules, so you do not repeat them in every message.

Each lorebook holds entries. An entry has trigger keywords and a block of text. When a keyword appears in the recent chat, Marinara adds the entry's text to the prompt, the text sent to the model for one reply. Lorebooks are also called World Info in other tools.

For example, an entry with the keyword `Eldoria` and the text below makes the AI know the city whenever someone mentions it.

```text
Eldoria is a rainy port city ruled by a council of nine merchants.
```

Keyword matching works with any model and needs no setup. To match by meaning instead of exact words, see [Semantic Search for Lorebooks](semantic-search.md).

## Create a lorebook and add an entry

1. Open the **Lorebooks** panel from the sidebar.
2. Click **New** (the plus icon). The **Create Lorebook** window opens.
3. Type a **Name**. This field is required.
4. Add a **Description** if you want.
5. Pick a **Category**. The default is **Other**. If you will link this lorebook to a character, pick **Character**, because the character's picker lists only that category.
6. Click **Create Lorebook**. The new lorebook appears in the list.
7. Click the lorebook's row. The full-page editor opens.
8. Click the **Entries** tab.
9. Click **Add Entry**. A new, empty entry row appears.
10. Type a name in the row, such as `Eldoria`, then click the row to open it.
11. In **Primary Keys**, type `Eldoria` and press <kbd>Enter</kbd>.
12. In **Content**, write the text for the AI.

The entry saves by itself a moment after you stop typing, and you see **Saved automatically**. Now the entry joins the prompt whenever its keyword matches. For keywords, position and timing, see [Lorebook Entries: Keys, Position, and Timing](entries.md).

If it did not work: check that the lorebook is active in the chat (see below), that its **Enabled** switch is on, and that the keyword appears in the last few messages. Marinara scans only as many messages as the **Scan Depth** setting says.

## Make a lorebook active in a chat

A lorebook feeds the AI only when it is active in the open chat. There are three ways.

| Way | Where you set it | Active in |
| --- | --- | --- |
| Global | **Global** switch on the lorebook's **Overview** tab | Every chat |
| Linked | Lorebook's **Overview** tab, or the character or persona editor | Chats with that character or persona |
| Added to one chat | **Chat Settings → Lorebooks** | That chat only |

A lorebook cannot be both global and linked. Turning on **Global** clears its character and persona links when you save.

An active lorebook still needs its **Enabled** switch on. For linking, see [Linking Lorebooks to Characters and Personas](linking-to-characters.md).

## The Overview tab settings

Open a lorebook and click **Overview** to set how the whole lorebook behaves.

| Setting | What it does | Default |
| --- | --- | --- |
| **Scan Depth** | How many recent messages Marinara checks for keywords. 0 scans the whole chat. | 2 |
| **Token Budget** | The most tokens this lorebook can add to one reply. 0 means no limit. | 2048 |
| **Entry Limit** | The most entries this lorebook can add to one reply. Range 1 to 1000. | 100 |
| **Max Depth** | Extra passes for recursion. Shown only when **Recursive** is on. Range 1 to 10. | 3 |

Tokens are small pieces of text that models count; about three-quarters of a word in English. For what each limit does, and what recursion means, see [Lorebook Token Budgets and Recursion](token-budgets.md).

The tab also has these switches.

- **Enabled** turns the whole lorebook on or off. It is on by default.
- **Global** makes the lorebook active in every chat.
- **Recursive** lets an activated entry's text trigger more entries. It is off by default.
- **Vectors** lets entries also match by meaning. It is off by default, and keywords still work either way.

The **Semantic search (embeddings)** panel below the switches is covered in [Semantic Search for Lorebooks](semantic-search.md).

## The Lorebooks panel

At the top of the panel, three icon buttons show their names when you hover over them.

- **New** opens the **Create Lorebook** window.
- **Import** opens the **Import Lorebook** window. See [Importing and Exporting Lorebooks](import-export.md).
- **Select** turns on multi-select, so you can export or delete several lorebooks at once.

Below the buttons:

- **Search lorebooks** filters by name, description, linked character or persona names, and tags.
- **Sort order** offers **Manual order**, **A-Z**, **Z-A**, **Newest**, **Oldest** and **Token Budget**. With **Manual order**, drag lorebooks into place, or use <kbd>Alt</kbd>+<kbd>Up</kbd> and <kbd>Alt</kbd>+<kbd>Down</kbd>.
- **New Folder** makes a library folder. Drag a lorebook onto it. On a phone, hold the lorebook, then drag. These folders are separate from the entry folders inside a lorebook.

Each row has **Copy** (duplicates the lorebook) and **Delete** buttons. They appear when you hover over the row, and are always visible on mobile. A lorebook that is turned off shows an **OFF** badge. Click the picture to upload or replace it.

### Categories

A category is a label for your library. It does not change when the lorebook activates. The tabs are **All**, **Active** (lorebooks relevant to the open chat), **World**, **Character**, **NPC**, **Spellbook** and **Other**. You can change a lorebook's category on its **Overview** tab, where **Other** is called **Uncategorized**.

## Related guides

- [Lorebook Entries: Keys, Position, and Timing](entries.md)
- [Lorebook Token Budgets and Recursion](token-budgets.md)
- [Semantic Search for Lorebooks](semantic-search.md)
- [Linking Lorebooks to Characters and Personas](linking-to-characters.md)
- [Importing and Exporting Lorebooks](import-export.md)
- [Knowledge Sources: Retrieval and Router Agents](../agents/knowledge-sources.md)
