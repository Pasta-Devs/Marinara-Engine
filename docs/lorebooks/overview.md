# Lorebooks Overview

This guide explains what a lorebook is in Guksu Motor, how the **Lorebooks** panel works, and how a lorebook becomes active in a chat. It also walks you through creating your first lorebook and its first entry. Deeper topics like keywords, timing, and semantic search live in their own guides, linked at the end.

## What a lorebook is

A lorebook is a small knowledge base that the AI can pull from during a chat. It is also called **World Info**, and the two names mean the same thing. Each lorebook holds a list of entries. An entry has two parts: some trigger keywords and a block of text.

When a keyword shows up in the recent chat, Guksu Motor adds that entry's text into the prompt. The prompt is the hidden instructions and history sent to the AI for each reply. This lets the AI use facts it was never told directly in the conversation.

Here is a simple example. You write a lorebook entry with the keyword `Eldoria` and this text:

```
Eldoria is a rainy port city ruled by a council of nine merchants.
```

Now, whenever you or a character mentions Eldoria, the AI receives that fact. It can then answer as if it always knew the city. Without the entry, the AI would have to guess.

Lorebooks are useful for world lore, character backstories, place names, factions, rules, and any facts you want the AI to remember. You do not need to repeat these facts in every message. The lorebook supplies them only when they are relevant, which saves space in the prompt.

Keyword matching works with any AI connection and needs no extra setup. Guksu can also match entries by meaning instead of exact words, using optional semantic search. That is a separate, opt-in feature covered in its own guide.

## The Lorebooks panel

The **Lorebooks** panel is the library where you browse, search, and manage every lorebook. Open it from the app sidebar. The panel lists each lorebook with its picture, name, and a short description.

Three icon buttons sit at the top of the panel. They show only an icon, with no text label. Hover your mouse over a button to see its name.

- **New** (a plus sign) opens the **Create Lorebook** window so you can make a lorebook.
- **Import** (a downward arrow) opens the **Import Lorebook** window to load a lorebook file.
- **Select** (a check mark) turns on multi-select mode so you can export or delete several lorebooks at once.

Below the buttons is a search box with the placeholder text **Search lorebooks**. It filters the list by name, description, linked character or persona names, and tags. Next to it is a **Sort order** dropdown with these choices: **A-Z**, **Z-A**, **Newest**, **Oldest**, and **Token Budget**.

Each lorebook row shows a **Copy** button and a **Delete** button. The buttons appear when you hover over the row. On mobile they are always visible. **Copy** duplicates the lorebook. A lorebook that is turned off shows a small **OFF** badge. Click the picture to upload or replace it.

You can also make library folders with the **New Folder** button. Drag a lorebook onto a folder to file it away. This keeps a large library tidy. These library folders are separate from the entry folders you can create inside a single lorebook.

## Categories

Every lorebook has one category. The category is only a label to help you organize your library. It does not change how or when the lorebook activates.

The panel has these category tabs:

- **All** shows every lorebook, grouped by category.
- **Active** shows only the lorebooks that are relevant to the chat you have open right now.
- **World**, **Character**, **NPC**, **Spellbook**, and **Other** each show lorebooks in that one category.

When you create a lorebook you pick one of five categories: **World**, **Character**, **NPC**, **Spellbook**, or **Other**. The default is **Other**. You can change the category later from the lorebook's **Overview** tab. Note that the **Overview** tab labels this same category **Uncategorized** instead of **Other**. Use whatever labels make sense to you. For example, put place and setting notes in **World** and put a companion's history in **Character**.

## How a lorebook activates

A lorebook only feeds the AI when it is active in the current chat. There are three ways a lorebook becomes active. You choose the one that fits.

1. **Global.** A global lorebook is active in every chat, as long as it is enabled. Turn on the **Global** switch in the lorebook's **Overview** tab. Use this for facts that matter everywhere, such as the rules of your shared world.
2. **Linked to a character or persona.** A linked lorebook auto-activates in any chat that includes that character or uses that persona. You set links in the **Overview** tab or from the character or persona editor. This is the most common choice for a character's own backstory.
3. **Pinned to a single chat.** You can add a lorebook to just one chat from that chat's settings. It stays active in that chat only. This is handy for lore that fits one story and not your whole library.

A global lorebook and a linked lorebook cannot be the same lorebook. Turning on **Global** clears any character or persona links when you save. Guksu treats these two options as mutually exclusive.

Every active lorebook still respects its **Enabled** switch. If a lorebook is turned off, none of its entries activate, even when it is global or linked. To see which lorebooks are active in the open chat, open the chat's settings and find its **Lorebooks** section. You can also edit the active list there. A separate guide covers that section.

## Create your first lorebook and entry

Follow these steps to make a lorebook and add one entry.

1. Open the **Lorebooks** panel and click **New**. The **Create Lorebook** window opens.
2. Type a name in the **Name** field. This field is required. A clear example is `Eldoria World Lore`.
3. Add a short **Description** if you want. This is optional and only helps you find the lorebook later.
4. Pick a **Category** from the dropdown, or leave it as **Other**.
5. Click the **Create Lorebook** button. Your new lorebook appears in the panel list.

Your lorebook has no entries yet. Now add one.

1. Click your lorebook's row in the panel. The full-page editor opens.
2. Click the **Entries** tab. The badge next to it shows the entry count.
3. Click **Add Entry**. A new, empty entry appears.
4. In the entry, add one or more trigger keywords, such as `Eldoria`.
5. In the entry's **Content** field, write the text you want the AI to receive.

The entry saves on its own a moment after you stop typing. You will see a short **Saved automatically** note. Your lorebook now works: when a keyword matches the recent chat, the entry's content joins the prompt. The entries guide explains keywords, matching rules, and timing options.

## The Overview tab settings

Open a lorebook and click the **Overview** tab to set how the whole lorebook behaves. The most important fields are the name, category, links, and the switches described above. The tab also has these numeric settings.

| Setting | What it does | Default |
|---|---|---|
| **Scan Depth** | How many recent messages Guksu checks for keyword matches. Set 0 to scan the whole chat. | 2 |
| **Token Budget** | The most tokens this lorebook can add to one prompt. Set 0 for no limit. | 2048 |
| **Entry Limit** | The most entries this lorebook can add to one prompt. The range is 1 to 1000. | 100 |
| **Max Depth** | How many extra recursive passes to run. This field appears only when **Recursive** is on. The range is 1 to 10. | 3 |

A token is a small chunk of text, roughly a few characters. The AI has a limited space for the prompt, so the **Token Budget** keeps one lorebook from filling that space.

The tab also has three switches:

- **Enabled** turns the whole lorebook on or off. It is on by default.
- **Recursive** lets an activated entry's text trigger more entries in extra passes. It is off by default. Turn it on when your lore should chain into related lore.
- **Vectors** lets entries use semantic matching. It is off by default. Keyword matching still works when it is off.

Below these settings is a **Semantic Search (Embeddings)** panel. It builds the data that powers meaning-based matching. The semantic search guide covers setup, embedding sources, and the vectorize buttons.

The finer points of budgets, the **Entry Limit**, and recursion have their own guide too. Start with the defaults above. They work well for most lorebooks, and you can adjust them later.

## Related guides

- [Lorebook Entries: Keys, Position, and Timing](entries.md)
- [Lorebook Token Budgets and Recursion](token-budgets.md)
- [Semantic Search for Lorebooks](semantic-search.md)
- [Linking Lorebooks to Characters and Personas](linking-to-characters.md)
- [Importing and Exporting Lorebooks](import-export.md)
- [Knowledge Sources: Retrieval and Router Agents](../agents/knowledge-sources.md)
