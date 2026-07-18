# Lorebook Entries: Keys, Position, and Timing

This guide explains how to build the entries inside a lorebook. It covers the **Entries** tab, trigger keywords, and the three entry types. It also covers where each entry goes in the prompt and the timing controls that decide when an entry fires. If you are new to lorebooks, read the [Lorebooks Overview](overview.md) first.

An entry is one block of text plus the rules that decide when Guksu Motor adds that text to the AI's prompt. When an entry activates, its content is injected so the AI "remembers" a fact you never typed into the chat.

## The Entries tab

Open a lorebook from the **Lorebooks** panel to reach its full-page editor. The editor has two side tabs: **Overview** and **Entries**. Click **Entries** to see the entry list. The tab badge shows how many entries the lorebook has.

The toolbar at the top of the **Entries** tab has these controls:

- **Search entries…** box: filters the list by entry name, keys, or content.
- A sort dropdown with **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Newest**, and **Oldest**. The ↓ options sort from highest to lowest.
- **Select**: turns on multi-select so you can copy, move, or delete several entries at once.
- **Add Folder**: creates a folder to group entries (see the Entry folders section below).
- **Add Entry**: creates a new blank entry at the top of the list.

Below the toolbar, a summary line shows the entry count, the folder count, and the total estimated token size of all entry content.

## Adding and editing an entry

To create an entry, follow these steps.

1. Open your lorebook and click the **Entries** tab.
2. Click **Add Entry**. A new row appears in the list.
3. Type a name in the row's name field. Every entry needs a name.
4. Click the row (or its chevron arrow) to expand the full editor drawer.
5. Fill in the keywords and content, described in the sections below.

Your edits save automatically. While you type, the drawer shows **Autosaving…**, then **Saving…**, then **Saved automatically**. If a save fails, your text stays in place and Guksu retries it on your next edit. You do not need a separate save button for entries.

Each entry appears as a compact one-line row. The row holds the most-used controls. Expand the row to reach the rest.

To duplicate an entry, hover the row and click the **Duplicate** button. To remove one, click the **Delete** button. Guksu asks you to confirm with the prompt "Delete this lorebook entry?".

## Entry content and keys

Expand an entry to edit its main fields.

- **Primary Keys**: the keywords that trigger this entry. When any one of these words appears in the recent chat, the entry activates. Type a keyword and press Enter to add it as a chip.
- **Content**: the text that gets injected into the AI's prompt when the entry activates. Write it as a plain fact you want the AI to know. Content supports prompt macros, and a live token estimate is shown below the box.
- **Secondary Keys**: extra keywords used only when the entry type is **Selective**. See the entry-types section below.
- **Description**: a short summary of the entry. Only the **Knowledge Router** agent reads it, to decide whether to inject the entry. It is never sent to the main AI as content. See [Knowledge Sources](../agents/knowledge-sources.md).

Here is a simple example.

- Name: `Silverhaven`
- Primary Keys: `Silverhaven`, `the capital`
- Content: `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.`

When you or the AI mention `Silverhaven` or `the capital` in the chat, the AI receives that fact automatically.

## Keyword matching rules

By default, a primary key matches if the word appears anywhere in the recent chat text, ignoring uppercase or lowercase. Three controls change how the matching works. **Whole Words** and **Case Sensitive** live in the expanded drawer. The **Regex** toggle is the small icon on the compact row, and it turns orange when it is on.

| Control | Where | Default | What it does |
|---|---|---|---|
| **Whole Words** | Entry drawer | Off | The key must match a full word, not part of a longer word. |
| **Case Sensitive** | Entry drawer | Off | Uppercase and lowercase must match exactly. |
| **Regex** | Compact row | Off | Treats each key as a regular expression pattern instead of plain text. |

A regular expression (regex) is a pattern-matching language for text. Use it only if you know regex. Guksu runs each regex key with a short safety timeout. A pattern that runs too long does not match on that scan, so keep patterns simple.

## Entry types: Normal, Constant, Selective

Every entry has a type. Click the small colored dot on the entry row to open the type menu and pick one.

- **Normal** (green dot): triggers when a primary key matches the scanned text. This is the default.
- **Constant** (yellow dot): injects every time the lorebook is active, with no keyword needed. Use this for facts that must always be present.
- **Selective** (red dot): the primary keys must match, and the secondary-key logic must also pass.

A **Constant** entry still obeys timing, probability, and any filters you set. It just does not need a keyword.

When an entry is **Selective**, add one or more **Secondary Keys** and choose a **Logic** button in the drawer:

- **AND Any**: at least one secondary key must also appear.
- **AND All**: every secondary key must also appear.
- **NOT Any**: the entry is blocked if any secondary key appears.
- **NOT All**: the entry is blocked only if all secondary keys appear.

For example, take a **Selective** entry with primary key `king` and secondary key `Silverhaven`, set to **AND Any**. It fires only when the chat mentions both the king and Silverhaven. This keeps a shared word like `king` from triggering in the wrong scene.

## Position, Depth, and Order

These controls decide where an activated entry lands in the prompt. They sit on the compact row on a wide screen. On a narrow screen, tap the row's quick-controls button to reach them.

- **Position**: choose **Before chat**, **After chat**, or **@ Depth**. Before chat and After chat place the entry around the chat history. **@ Depth** injects the entry inside the chat history. On a wide screen, the row shows these as the short labels **↑Char**, **↓Char**, and **@Depth**.
- **Depth**: appears only when **Position** is **@ Depth**. It sets how many messages back from the latest message the entry is inserted. The default is 4.
- **Order**: the insertion order when several entries activate at once. A lower number comes earlier in the prompt. The default is 100.

## Trigger probability

Each entry has a **Probability** value, shown as a percent on the row. The default is 100%, which means the entry always fires when its keys match. Lower it to make an entry fire only some of the time. For example, 25% means the entry has a one-in-four chance to activate each time its keys match.

## Timing: Sticky, Cooldown, Delay, Ephemeral

The **Timing** fields in the drawer control an entry's behavior across several messages. **Sticky**, **Cooldown**, and **Delay** count in messages. **Ephemeral** counts activations. All four start unset (0, meaning off).

- **Sticky**: after the entry triggers, it stays active for this many more messages, even without a fresh keyword match.
- **Cooldown**: after the entry triggers, it waits this many messages before it can trigger again.
- **Delay**: the entry waits this many messages into the chat before it can activate for the first time.
- **Ephemeral**: the entry disables itself after this many activations. A value of 0 means unlimited.

For example, set **Sticky** to 3 to keep a fact in the prompt for a few turns after it comes up. That way the AI does not forget it mid-scene.

## More entry options

The expanded drawer holds a few more fields.

- **Role**: sets whether the injected text is labeled as **System**, **User**, or **Assistant**. This only matters when **Position** is **@ Depth**. The default is **System**.
- **Group** and **Tag**: put entries in the same **Group** so only one of them activates at a time. The **Tag** is a free-text label for your own sorting.
- **Locked**: prevents the **Lorebook Keeper** agent from changing this entry. See [Downloadable Agents Reference](../agents/built-in-agents.md).
- **No Vector** and the vector-status badge relate to semantic search. See [Semantic Search for Lorebooks](semantic-search.md).

The drawer also has a **Context filters & matching sources** section. There you can limit an entry to certain characters, character tags, or generation types. You can also scan extra card fields (such as the character description) for the entry's keywords.

## The Keyword test tool

The **Keyword test** panel at the top of the **Entries** tab lets you check your keywords without starting a chat. Expand it and paste a sample paragraph or a few messages into the box.

Entries whose keys would match get a green accent and a **Would activate** chip. **Constant** entries get an **Always active** chip, because they fire no matter what the text says. A count line shows how many of your enabled entries would activate.

This test checks keyword rules only. It ignores timing, probability, character filters, and semantic matching, so a live chat can still differ from the preview.

## Entry folders

Folders group entries inside a single lorebook. They are separate from the library folders in the main **Lorebooks** panel.

- Click **Add Folder** to create one, then rename it inline.
- Drag an entry onto a folder to file it, or use the entry's **Folder** picker.
- Drag a folder onto another folder to nest it, or drag it to the top strip to un-nest it.
- Each folder has an **Enabled** switch. When you turn a folder off, every entry inside it stops activating, even if that entry's own switch is on.
- A folder header also has **Clone** and **Delete**. **Clone** deep-copies the folder with all of its entries and sub-folders. **Delete** removes only the folder itself. Its entries and sub-folders move up to the top level.

Folders only display as groups when you sort by **Order** with no active search. Any other sort, or a search, switches to a flat list and shows the note "Folder view paused (clear search and sort by Order)".

## Related guides

- [Lorebooks Overview](overview.md)
- [Lorebook Token Budgets and Recursion](token-budgets.md)
- [Semantic Search for Lorebooks](semantic-search.md)
- [Knowledge Sources: Retrieval and Router Agents](../agents/knowledge-sources.md)
