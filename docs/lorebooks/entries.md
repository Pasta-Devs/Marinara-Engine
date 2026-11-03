# Lorebook Entries: Keys, Position, and Timing

An entry is one fact in a lorebook, plus the rules that decide when Marinara adds it to the prompt. This guide covers adding entries, choosing keys and entry types, deciding where an entry lands, and timing.

Before you start: create a lorebook and open it. See [Lorebooks Overview](overview.md).

## The Entries tab

Open a lorebook from the **Lorebooks** panel. The editor has two tabs, **Overview** and **Entries**. Click **Entries** to see the list. The badge on the tab shows how many entries you have.

The toolbar has these controls.

- **Search entries…** filters by name, keys or content.
- The sort menu offers **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Fired ↓**, **Newest** and **Oldest**. The ↓ options sort from highest to lowest.
- **Select** turns on multi-select, so you can copy, move or delete several entries.
- **Add Folder** makes a folder (see [Entry folders](#entry-folders)).
- **Add Entry** adds a blank entry at the top.

A line under the toolbar shows the entry count, the folder count and the estimated token total of all entry content.

## Adding and editing an entry

1. Click **Add Entry**. A new row appears.
2. Type a name in the row. Every entry needs one. The name is for you and for search, not for the AI.
3. Click the row, or its arrow, to open the full editor.
4. Type your keys and **Content**, as described below.

Edits save by themselves. The drawer shows **Autosaving…**, then **Saving…**, then **Saved automatically**. If a save fails, your text stays and Marinara retries on your next edit.

To copy an entry, hover over its row and click **Duplicate**. To remove it, click **Delete** and confirm.

### Content and keys

| Field | What it is |
| --- | --- |
| **Primary Keys** | Words that trigger the entry. Type a key and press <kbd>Enter</kbd> to add it. Any one match activates a **Normal** entry. |
| **Content** | The text sent to the AI. Write a plain fact. It can use [macros](../prompts/macros.md), and a token estimate shows below the box. |
| **Secondary Keys** | Extra keys, used only by **Selective** entries. |
| **Description** | A short summary that only the **Knowledge Router** agent reads. It is never sent to the main model. See [Knowledge Sources](../agents/knowledge-sources.md). |

A list of more than 10 keys shows the first 10. Click **Show N more** to see the rest and **Collapse** to hide them. Hidden keys still match.

For example, an entry named `Silverhaven` with the keys `Silverhaven` and `the capital` and the content `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.` reaches the AI whenever either key appears in the recent chat.

### Matching rules

By default a key matches when it appears anywhere in the recent chat, ignoring upper and lower case. Three controls change that.

| Control | Where | Default | What it does |
| --- | --- | --- | --- |
| **Whole Words** | Entry drawer | Off | The key must be a full word. `Ash` matches "Ash" but not "cash". |
| **Case Sensitive** | Entry drawer | Off | Capitalization must match. `IT` matches "IT" but not "it". |
| **Regex** | Compact row (turns orange when on) | Off | Treats each key as a regular expression, a text-matching pattern. |

Use **Regex** only if you know regular expressions. Each pattern runs with a short time limit, and a pattern that runs too long does not match, so keep patterns simple. For example, `\bVlad(?:'s)?\b` matches "Vlad" and "Vlad's".

## Choose an entry type

Click the colored dot on the row to open the type menu.

| Type | Dot | When it activates | Use it for |
| --- | --- | --- | --- |
| **Normal** | Green | When a primary key matches. This is the default. | Most entries: people, places, items. Give each three to eight specific keys. |
| **Constant** | Yellow | Every time the lorebook is active, with no key. Timing, probability and filters still apply. | The few facts that must always be present, such as the year or the tone. Each one costs tokens on every message. |
| **Selective** | Red | When a primary key matches and the secondary-key logic passes. | A common key that would fire in the wrong scene. |

For a **Selective** entry, add **Secondary Keys** and pick a **Logic** button.

| Logic | The entry fires when |
| --- | --- |
| **AND Any** | At least one secondary key also appears. |
| **AND All** | Every secondary key also appears. |
| **NOT Any** | No secondary key appears. |
| **NOT All** | Not all of the secondary keys appear together. |

For example, primary key `king` with secondary key `Silverhaven` and **AND Any** fires only when the chat mentions both.

If it did not work: a **Normal** entry with no keys has nothing to match. Add keys, or make it **Constant**. A keyless entry can still be found by meaning, but only when [semantic search](semantic-search.md) is fully set up.

## Position, Depth, and Order

These controls decide where an activated entry lands in the prompt. On a wide screen they are on the compact row. On a narrow screen, tap the row's quick-controls button.

| Control | What it does |
| --- | --- |
| **Position** | **Before character definitions** or **After character definitions** place the entry around the character card. **@ Depth** puts it inside the chat history. **Outlet** puts it nowhere automatically (see below). The compact row shows the first three as **↑Char**, **↓Char** and **@Depth**. |
| **Depth** | Shown only for **@ Depth**. How many messages back from the latest the entry sits. Default 4. |
| **Order** | The sequence when several entries activate. A lower number comes first and survives trimming when the budget is tight. Default 100. |
| **Role** | Labels the injected text **System**, **User** or **Assistant**. Matters only for **@ Depth**. Default **System**. |

Leave these at their defaults unless an entry needs more. Use **@ Depth** sparingly. The text lands between recent messages like an interruption, so keep it for a rule the model keeps forgetting or a fact that changed a moment ago. For example, "The tavern is now on fire." at **@ Depth** 1.

### Outlet

An **Outlet** entry appears only where you place a macro.

1. Set **Position** to **Outlet**. An **Outlet name** field appears.
2. Type an exact, case-sensitive name such as `character_rules`.
3. Put `{{outlet::character_rules}}` in a prompt section of your [preset](../prompts/presets.md).

Entries that share a name are joined in **Order**, separated by new lines. Only entries that activated for this reply appear. They still follow keys, probability, filters, timing, **Entry Limit** and **Token Budget**. With no active entries the macro adds nothing. An Outlet entry cannot call another Outlet macro. See [macros](../prompts/macros.md) for the macro.

## Probability and timing

**Probability** is the chance an entry fires when its keys match. The default is 100%. Set 25% for a one-in-four chance each time.

The **Timing** fields control behavior over several messages. All four start unset, which means off.

| Field | What it does | Example |
| --- | --- | --- |
| **Sticky** | After the entry triggers, it stays active for this many more messages, even without a key match. | A revealed secret at 3 stays in for three messages. |
| **Cooldown** | After it triggers, it waits this many messages before it can fire again. | An omen at 5 fires at most once every five messages. |
| **Delay** | It cannot fire until this many messages into the chat. | A twist at 20 stays hidden at first. |
| **Ephemeral** | It turns itself off after this many activations. 0 means no limit. | An intro note at 1 fires once. |

**Sticky**, **Cooldown** and **Delay** count messages. **Ephemeral** counts activations.

## Decision activation

The **Decision** field lets your Decision model, a small model that answers yes-or-no questions, decide whether an entry applies. Write a statement about the recent chat, such as `In the latest message, a dragon is physically present`, and pick a mode.

| Mode | Effect |
| --- | --- |
| **Off** | The entry activates as usual. This is the default. |
| **Require** | The entry activates as usual, and only when the statement is also true. It filters passing mentions. |
| **Trigger** | The statement is another way to activate the entry, even with no key present. It catches paraphrases and situations. |

You can use macros such as `{{user}}` and `{{char}}` in the statement.

Before you start: choose a Decision model under **Decision model** in the **Connections** panel. With no Decision model, or no answer, the statement counts as no. **Require** then never admits a new entry, and **Trigger** adds nothing. The editor warns you when no Decision model is set. Give important entries an ordinary route too, and use **Require** only to filter optional lore.

Decision statements add model requests and share the **Decision statements per turn** limit. For wording tips, limits, cost and answer reuse, see [Writing statements](../prompts/conditional-prompts.md#writing-statements), [Limits and cost](../prompts/conditional-prompts.md#limits-and-cost) and [Answer reuse](../prompts/conditional-prompts.md#answer-reuse). For the model setup, see [Decision Models](../connections/decision-models.md).

- **Sticky** and **Cooldown** work with **Decision**. A sticky entry is not asked again while its hold lasts, and a cooling entry is not asked at all.
- The active-lorebook list shows **decision** for an entry that a **Trigger** statement activated.
- **Peek Prompt** never asks. It uses answers the turn already has and lists statements with none.
- Decision activation applies to chat turns only. Game setup and the scans that agents run for themselves read decision entries as no.
- A `{{#if decision:"..."}}` inside the entry's content is different. It trims the text of an entry that already activated. Use the **Decision** field to decide whether the entry activates at all.

## Groups, filters and other options

The expanded drawer holds more fields.

| Field | What it does |
| --- | --- |
| **Group** | Entries in the same group are mutually exclusive. Only one activates per reply. Use it for alternatives, such as three "weather today" entries. Pair it with a low **Probability** to keep rumors occasional. |
| **Tag** | A free-text label for your own sorting. It does not affect activation. |
| **Locked** | Stops the **Lorebook Keeper** agent from changing this entry. See [Downloadable Agents Reference](../agents/built-in-agents.md). |
| **No Vector** | Leaves the entry out of semantic search. See [Semantic Search for Lorebooks](semantic-search.md). |
| **Recursion** | Lets this entry's content trigger more entries. Off by default. See [Lorebook Token Budgets and Recursion](token-budgets.md). |

The **Context filters & matching sources** section limits an entry to certain characters, character tags or generation types. It also lets you scan extra card fields, such as the character description, for the entry's keys. In a group chat, a character filter also keeps the entry out of other characters' replies. Use it for secrets that only one character knows.

## Put the pieces together

Start from one question: when should the AI see this fact?

| The fact | Setup |
| --- | --- |
| Always true | **Constant**. Keep these few. |
| Matters only when named | **Normal** with specific keys, such as `Castle Dracul`, `the castle`, `the fortress`. |
| Its key is a common word, such as `king` or `home` | **Whole Words**, or **Selective** with secondary keys. |
| Important but rarely named | **Normal** with [semantic search](semantic-search.md), or broader keys. |
| Several versions that must not appear together | The same **Group**. |
| A rule the model forgets in the middle of a scene | **@ Depth** near 1 to 4. |

A few habits keep a lorebook lean.

- Use specific keys. A key like `he` or `the city` matches almost every message and wastes budget.
- Fill in **Description** on any entry you expect the **Knowledge Router** to route. It reads the description, not the content.
- Build big settings as a tree. Add a hub entry for a group, such as an entry for *The Empire* that lists its members, next to an entry for each member. Leave **Recursion** off on hubs. Otherwise naming the group pulls every member's full entry into the prompt at once.

For example, take the rule for how a villain can be killed, which the AI tends to forget. Make it **Selective** with **AND Any**, **Whole Words** on and **Order** 10. Use the primary keys `weakness`, `kill`, `destroy`, `stake` and the secondary keys `Vlad`, `the count`. The secondary keys keep it silent when the party kills a wolf. **Whole Words** stops `stake` from matching "mistake". The low order keeps it from being trimmed in a crowded scene.

Where a lorebook lives decides which chats see it. See [Lorebooks Overview](overview.md) and [Linking Lorebooks to Characters and Personas](linking-to-characters.md) for global, linked and embedded lorebooks.

## Macros in entry content

**Content** is expanded like any other prompt text before it is sent. Some handy macros:

- `{{char}}` and `{{user}}` give the names, so a shared entry reads well in any chat.
- `{{random::a::b::c}}` picks one option. Add weights, as in `{{random::common@3::rare@1}}`. Pair it with a low **Probability** to fold a whole encounter table into one entry.
- `{{include::Entry name}}` puts in the text of another entry from the same lorebook. See [Lorebook include macro](../prompts/macros.md#lorebook-include-macro).
- `{{// note}}` is a comment. It is stripped before the AI sees it, and before recursion scans, so it can never trigger anything.

For the full list, see [Prompt Macros](../prompts/macros.md).

With **Recursive** on, Marinara re-scans the expanded content of activated entries. Text that a macro produces can trigger further entries.

## The Keyword test tool

The **Keyword test** panel at the top of the **Entries** tab checks your keys without a chat.

1. Expand **Keyword test**.
2. Paste a sample paragraph or a few messages into the box.

Entries that would match get a green accent and a **Would activate** chip. **Constant** entries get an **Always active** chip. A count line shows how many enabled entries would activate. The **Include other lorebooks** switch also checks enabled entries in your other lorebooks.

The test ignores timing, chance, character and persona filters, and matching by meaning, so a live chat can still differ.

## Entry folders

Folders group entries inside one lorebook. They are separate from the library folders in the **Lorebooks** panel.

- Click **Add Folder**, then rename the folder in place.
- Drag an entry onto a folder, or use the entry's **Folder** picker.
- Drag a folder onto another to nest it, or onto the top strip to un-nest it.
- Each folder has an **Enabled** switch. When it is off, every entry inside stops activating.
- **Clone** copies the folder with all its entries and sub-folders. **Delete** removes only the folder. Its contents move up to the top level.

Folders show as groups only when you sort by **Order** with no search. Otherwise you see a flat list and the note **Folder view paused (clear search and sort by Order)**.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| An entry never fires. | Give it keys or make it **Constant**. Check that the lorebook is enabled and active in the chat. |
| A key worked, then stopped. | Marinara scans only the last few messages (**Scan Depth**, default 2). Raise **Scan Depth**, add **Sticky**, or make the entry **Constant**. |
| An entry fires in the wrong scenes. | Use **Whole Words**, **Selective** secondary keys, or a character filter. |
| Important lore gets dropped. | Give it a lower **Order** or raise the **Token Budget**. **Active Context** in **Chat Settings** shows what was skipped and why. See [Lorebook Token Budgets and Recursion](token-budgets.md). |
| The AI ignores an entry. | Check **Active Context** to confirm it activated. A fact far from the latest message has less pull than one at **After character definitions** or **@ Depth**. |

## Related guides

- [Lorebooks Overview](overview.md)
- [Decision Models](../connections/decision-models.md)
- [Lorebook Token Budgets and Recursion](token-budgets.md)
- [Semantic Search for Lorebooks](semantic-search.md)
- [Knowledge Sources: Retrieval and Router Agents](../agents/knowledge-sources.md)
