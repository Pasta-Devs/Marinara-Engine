# Lorebook Entries: Keys, Position, and Timing

This guide explains how to build the entries inside a lorebook. It covers the **Entries** tab, trigger keywords, and the three entry types. It also covers where each entry goes in the prompt and the timing controls that decide when an entry fires. If you are new to lorebooks, read the [Lorebooks Overview](overview.md) first.

An entry is one block of text plus the rules that decide when Marinara Engine adds that text to the AI's prompt. When an entry activates, its content is injected so the AI "remembers" a fact you never typed into the chat.

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

Your edits save automatically. While you type, the drawer shows **Autosaving…**, then **Saving…**, then **Saved automatically**. If a save fails, your text stays in place and Marinara retries it on your next edit. You do not need a separate save button for entries.

Each entry appears as a compact one-line row. The row holds the most-used controls. Expand the row to reach the rest.

To duplicate an entry, hover the row and click the **Duplicate** button. To remove one, click the **Delete** button. Marinara asks you to confirm with the prompt "Delete this lorebook entry?".

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

That is the simplest possible entry: a name, a couple of keys, and a fact. The **Authoring strategy** and **Worked example** sections below cover when to reach for the other controls and build a small setting from scratch.

## Keyword matching rules

By default, a primary key matches if the word appears anywhere in the recent chat text, ignoring uppercase or lowercase. Three controls change how the matching works. **Whole Words** and **Case Sensitive** live in the expanded drawer. The **Regex** toggle is the small icon on the compact row, and it turns orange when it is on.

| Control | Where | Default | What it does |
|---|---|---|---|
| **Whole Words** | Entry drawer | Off | The key must match a full word, not part of a longer word. |
| **Case Sensitive** | Entry drawer | Off | Uppercase and lowercase must match exactly. |
| **Regex** | Compact row | Off | Treats each key as a regular expression pattern instead of plain text. |

A regular expression (regex) is a pattern-matching language for text. Use it only if you know regex. Marinara runs each regex key with a short safety timeout. A pattern that runs too long does not match on that scan, so keep patterns simple.

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

- **Position**: choose **Before chat**, **After chat**, **@ Depth**, or **Outlet**. Before chat and After chat place the entry around the chat history. **@ Depth** injects the entry inside the chat history. **Outlet** does not inject the entry automatically; it makes activated content available to a named `{{outlet::name}}` macro. On a wide screen, the row shows the first three positions as the short labels **↑Char**, **↓Char**, and **@Depth**.
- **Depth**: appears only when **Position** is **@ Depth**. It sets how many messages back from the latest message the entry is inserted. The default is 4.
- **Order**: the insertion order when several entries activate at once. A lower number comes earlier in the prompt. The default is 100.

Use **@ Depth** sparingly and on purpose. Because it injects the entry *inside* the recent messages rather than around them, the text reads like an interruption dropped into the middle of the conversation:

> **John:** Let's go visit Vlad's castle.
> **Bob:** Bet.
> *The Count's weakness is garlic — an extreme allergy he hides at all costs.*
> **John:** Great, want to go tomorrow? I have the day off.

Reach for it only when a note genuinely needs to sit beside the latest turn — a rule the model keeps forgetting, or a fact that just changed — and leave ordinary lore at **Before chat** or **After chat**.

When you choose **Outlet**, an **Outlet name** field appears. Enter an exact, case-sensitive name such as `character_rules`, then put `{{outlet::character_rules}}` in a prompt section. Every entry assigned to that Outlet still follows its normal keyword, constant, probability, filter, timing, entry-limit, and token-budget rules. Only entries activated for the current generation are collected. Entries that share the same Outlet name are joined in Order, separated by new lines.

An Outlet macro with no active matching entries resolves to nothing. Outlet content cannot call another Outlet macro, which prevents recursive Outlet loops. Outlet macros work in prompt sections in Conversation, Roleplay, and Game modes.

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

## Authoring strategy: choosing the right entry

The sections above describe what each control does. This section maps them to the decisions you make while writing a lorebook: which type to pick, when to tighten a keyword, and how to keep the prompt lean. Start from one question — *when should the AI see this fact?*

- **It must always be true** — the setting's premise, the year, the tone, a rule that colors every scene. Make it **Constant**: it injects every time the lorebook is active, with no keyword needed. Keep these few — each Constant entry spends tokens on every message, so a page of them crowds out the actual chat.
- **It only matters when it comes up** — a person, place, faction, or item. Use the default **Normal** type with three to eight specific **Primary Keys**: the name plus the ways characters actually refer to it (`Castle Dracul`, `the castle`, `the fortress`). This is the workhorse; most entries are Normal.
- **Its keyword is a common word** that would fire in the wrong scene (`king`, `home`, `hunter`) — turn on **Whole Words** so `art` stops matching `start`, or make the entry **Selective** and add **Secondary Keys** that pin it to the right context.
- **Several entries fill the same slot and must never appear together** — three versions of one castle, two alternate backstories. Give them the same **Group** so only one loads at a time.
- **It is important but rarely named outright** — a theme, a relationship, a rule nobody says aloud. Keep it **Normal** and turn on semantic matching so it is recalled by meaning (see [Semantic Search](semantic-search.md)). Semantic matching needs an embedding model; without one, fall back to **Constant** (when it truly must always be present) or to broader keys.

A few habits keep lorebooks healthy:

- **Give every entry a way to fire.** A **Normal** entry with no keys has nothing for keyword matching to catch — it activates only if semantic search recalls it by meaning, which needs a vectorized lorebook and an embedding model (see [Semantic Search](semantic-search.md)). If a fact should always be present, make it **Constant**; otherwise give it keys so it fires without relying on semantic search.
- **Prefer specific keys.** A key like `he`, `it`, or `the city` matches almost every message and wastes budget. Reach for exact names, **Whole Words**, or **Selective** secondary keys when a key is noisy.
- **Fill in the Description** on any entry you expect the **Knowledge Router** agent to route — it reads the description, not the content, to decide relevance (see [Knowledge Sources](../agents/knowledge-sources.md)).
- **Leave Position, Depth, Order, and Role at their defaults** unless you have a reason. Reach for **Order** when several entries fire and the budget is tight (a lower number loads first and survives trimming); use **@ Depth** only for the rare reminder that must sit beside the latest message, as cautioned above. Keep an eye on the lorebook's **Token Budget** and **Entry Limit** (see [Token Budgets and Recursion](token-budgets.md)).

### Structure lore as a tree

Big settings are easier to manage as a tree than as a flat pile of entries. Alongside an entry for each character, place, or item, add **hub entries** for the groups they belong to: an entry for *The Empire* that describes it and lists its prominent members, or an entry for a kingdom that lists its important cities. A hub gives the AI a map — when the Empire comes up, the model sees what it is and who belongs to it, without every member's full entry crowding the prompt.

Leave recursion off on hubs. The lorebook's **Recursive** switch and an entry's **Recursion** toggle are both off by default, which is exactly what a hub wants: it hands the model its overview and lets each member's own entry appear only when that member is actually named. If you turn recursion on elsewhere to chain related lore, keep it off on hub entries — otherwise naming the group pulls every member's full entry into the prompt at once, thousands of tokens of detail that is not yet relevant.

### Reusing lore across characters and chats

Where a lorebook lives decides which chats can see it, so match the container to the kind of lore:

- **Shared-world rules** — the setting everyone in your library belongs to — go in a **Global** lorebook, which is active in every chat (turn on the **Global** switch on the lorebook's **Overview** tab).
- **A character's own lore** — backstory, secrets, relationships — goes in a lorebook **linked** to that character, so it turns on automatically in their chats and nowhere else. When several characters share one book, add a character **filter** to the entries that belong to only one of them.
- **A card you plan to share** — **embed** the lorebook into the character card so its world info travels with the export. Embedding is for characters only, and a card holds one embedded lorebook at a time.
- **Lore for a single story** — pin a lorebook to just that chat from its settings.

See [Lorebooks Overview](overview.md) for how activation works, and [Linking Lorebooks to Characters and Personas](linking-to-characters.md) for the assign, scope, and embed controls.

## Worked example: a small setting

Suppose you are running a gothic-horror roleplay set in 1890s Wallachia. A skeletal lorebook would be a pile of name-and-content entries; a well-built one uses the controls above so each fact appears exactly when it should. Here is how a handful of entries might be configured, and why.

Start with the foundation — one always-on fact and a couple of keyed details:

**The premise** — *Constant.*

- Content: `The year is 1890. Vampires are real and hunt the Carpathian nights; the living bar their windows after dark.`
- Why **Constant**: the ground rules color every reply, so this entry is always present with no keyword. This is the one entry you can justify keeping always-on — resist the urge to make more of them Constant.

**Castle Dracul** — *Normal.*

- Primary Keys: `Castle Dracul`, `the castle`, `the fortress`
- Content: `A black-stone fortress on the ridge above the village, the seat of the vampire count.`
- Why **Normal** with those keys: the castle only matters when it is in play, so it waits for a keyword. The keys cover its name and the ways characters refer to it.

**Count Vlad** — *Normal, with Whole Words on.*

- Primary Keys: `Vlad`
- Description: `The setting's central vampire.`
- Content: `The immortal count who rules Wallachia after dark — charming, patient, and without mercy.`
- Why **Whole Words**: `Vlad` is short and could sit inside another word, so whole-word matching keeps it from mis-firing. The **Description** is filled in so the Knowledge Router can route the entry if you use that agent.

### Stacking several controls on one entry

Most entries need one or two controls; a few earn several at once. Take the rule for how the villain can actually be killed — a fact the AI tends to forget at the worst moment:

**The Count's weakness** — *Selective (AND Any), Whole Words on, Order 10, with a Description.*

- Primary Keys: `weakness`, `kill`, `destroy`, `stake`
- Secondary Keys: `Vlad`, `the count`
- Description: `How Count Vlad can actually be destroyed.`
- Content: `Vlad can only be destroyed by a blackthorn stake through the heart, driven at dawn. Sunlight alone merely weakens him.`

Why this one entry earns several advanced controls:

- **Selective** with those secondary keys — `weakness`, `kill`, and `destroy` are generic combat words that come up whenever the party fights anything. The secondary keys pin the entry to the Count, so it stays silent when they are killing a wolf or plotting against a rival, and fires only when *his* death is on the table.
- **Whole Words** — without it, `stake` would match `mistake` and `kill` would match `skill`. Short, common keys almost always want whole-word matching.
- **Order 10** — a climactic scene activates many entries at once and can blow past the token budget. A low order loads this entry first, so if the tail is trimmed, the one fact the scene hinges on survives.
- **Description** — the Knowledge Router agent reads it to route the entry by meaning, so the rule can surface even when the exact keys are not in the latest message.

### Alternate versions that should not stack

You want the village gossip about the Count to feel inconsistent — but you never want two contradictory rumors in the same reply. Put both in one **Group** and let probability keep them rare:

**Rumor: the bargain** and **Rumor: the bloodline** — *both in Group `count-rumor`, Probability 40%.*

- Both keyed on: `rumor`, `they say`, `the count`
- Contents: `They say the count was once a crusader who bargained with something in the dark.` and `They say the count is not one man but a line of them, each wearing the last one's face.`
- Why **Group** `count-rumor`: entries in the same group are mutually exclusive — only one activates per generation — so the two rumors never contradict each other in the same message. Why **Probability 40%**: a rumor that surfaces every single time the topic comes up stops feeling like a rumor; lowering the odds keeps it an occasional, flavorful aside.

Across the whole lorebook, only the premise is Constant, one entry layers selective logic with a low order, and everything else simply waits for its keys. That is what keeps the prompt lean while still putting the right fact in front of the AI at the right moment.

## Use cases by parameter

The strategy and worked example above show these controls in combination. This section is a quick reference: what each control is *for*, and one example apiece.

### Matching

**Whole Words** — stops a key from matching inside a longer word.

- Use it for: short or single-syllable keys, acronyms, or a key that is a fragment of other words.
- *Example:* the key `Ash` (a character) matches "Ash" but not "ashes" or "cash".

**Case Sensitive** — the key must match capitalization exactly.

- Use it for: a key that is also a common lowercase word; acronyms and initialisms; codes where case carries meaning.
- *Example:* `IT` (the tech department) matches "IT" but not the word "it".

**Regex** — treats the key as a regular-expression pattern.

- Use it for: several spellings or forms at once, optional suffixes, or numbers and codes with a pattern. Keep patterns simple — each runs under a short safety timeout.
- *Example:* `\bVlad(?:'s)?\b` matches both "Vlad" and "Vlad's" as whole words.

### Entry type

**Constant** — injects every turn, with no keyword.

- Use it for: the setting's premise and ground rules, a tone or style directive, or a fact so central the AI should never be without it.
- *Example:* a keyless Constant entry — "Everyone speaks in period 1800s English." — is present in every reply.

**Selective (secondary keys + logic)** — adds a second keyword condition on top of the primary keys.

- Use it for: a common primary keyword that fires in the wrong scene, lore that should appear only in a specific combination of topics, or blocking an entry when a certain term is present.
- *Example (AND Any):* primary `king`, secondary `Silverhaven` — the king's entry fires only when Silverhaven is also mentioned.
- *Example (NOT Any):* primary `the prophecy`, secondary `fulfilled` — the "unfulfilled prophecy" entry is blocked once the prophecy is fulfilled.

### Placement

**Before chat / After chat** — where the entry sits relative to the conversation.

- Use it for: most lore (Before chat, the default); a nudge you want closest to the model's next reply (After chat).
- *Example:* a faction summary Before chat; a short "stay in character" reminder After chat.

**@ Depth (with Depth and Role)** — injects the entry *inside* the recent messages. Use sparingly — see the caution in **Position, Depth, and Order** above.

- Use it for: a rule the model keeps forgetting mid-scene, or a fact that just changed and must land beside the latest turn. **Role** labels the injected line **System**, **User**, or **Assistant**.
- *Example:* "The tavern is now on fire." at @ Depth 1, Role System.

**Order** — the sequence in which activated entries load.

- Use it for: making one entry win when several fire and the budget is tight, or controlling the order of related entries.
- *Example:* a plot-critical rule at Order 10 loads before flavor entries at the default 100 and survives budget trimming.

**Outlet** — collects activated entries into a named macro instead of injecting them directly.

- Use it for: gathering several entries into one spot in your prompt, or building a dynamic block you place yourself.
- *Example:* three entries at Position Outlet with the name `house_rules`; put `{{outlet::house_rules}}` in a prompt section and only the ones that activated this turn appear there, joined in Order.

### When and how often an entry fires

**Probability** — the percent chance the entry fires when its keys match.

- Use it for: occasional flavor, random events, or a quirk that should surface only some of the time.
- *Example:* "the innkeeper is in a foul mood today" at Probability 30%.

**Sticky** — keeps the entry active for a set number of messages after it triggers.

- Use it for: holding a fact in the prompt for a few turns so the model does not forget it mid-scene.
- *Example:* a revealed secret at Sticky 3 stays active for three messages after it comes up.

**Cooldown** — blocks the entry from re-firing for a set number of messages after it triggers.

- Use it for: stopping a dramatic or heavy entry from repeating every message, or pacing a recurring event.
- *Example:* a "the ground trembles" omen at Cooldown 5 fires at most once every five messages.

**Delay** — the entry cannot fire until a set number of messages into the chat.

- Use it for: lore that should not appear at the very start; a twist or later-arc fact held back until the story develops.
- *Example:* a "the mentor was the traitor all along" entry at Delay 20.

**Ephemeral** — the entry disables itself after a set number of activations.

- Use it for: one-time (or few-time) content — an intro, a first-meeting note, a tutorial hint.
- *Example:* "You wake with no memory of how you got here." at Ephemeral 1 fires once, then turns itself off.

### Organization and control

**Group** — makes entries mutually exclusive; only one in a group activates per reply.

- Use it for: alternatives (one of several rumors, moods, or versions), or a random-pick pool.
- *Example:* three "weather today" entries in Group `weather` — exactly one is chosen per reply.

**Tag** — a free-text label for your own sorting. It does not affect activation.

- Use it for: organizing and filtering entries in the editor.
- *Example:* tag entries `npc`, `location`, or `wip` to find and manage them quickly.

**Description** — a summary the Knowledge Router agent reads to route the entry; never sent to the AI as content.

- Use it for: giving a dense or macro-heavy entry a plain-language summary the router can match by meaning, or a note to yourself.
- *Example:* an entry full of formatting macros gets the Description "the rules of the dueling arena".

**Recursion (per-entry)** — lets this entry's content trigger more entries. Off by default.

- Use it for: an entry you *want* to chain into a bounded set of related lore. Keep it off for hub entries (see **Structure lore as a tree** above).
- *Example:* "The party enters the Thornwood." with Recursion on and content naming the wood's landmarks, so those entries activate too.

**No Vector** — excludes the entry from semantic search.

- Use it for: keeping a generic or boilerplate entry from polluting meaning-based matches, or an entry you only want triggered by its exact keys.
- *Example:* mark a formatting-instruction entry No Vector so it never surfaces as a semantic "related lore" hit.

**Locked** — protects the entry from the Lorebook Keeper agent.

- Use it for: a hand-tuned entry an automated pass should not rewrite.
- *Example:* lock your carefully-worded premise so the Keeper cannot edit it.

**Context filters** — limit an entry to certain characters, character tags, or generation types.

- Use it for: lore that applies to only some characters or only some generation types.
- Filtering to a character does more than hide the entry from other chats: in a group chat it also keeps the entry out of *other characters'* replies, activating only when the filtered character is the one responding. That makes it ideal for private backstories, secrets, and knowledge one character holds but the others should not.
- *Example:* filter a spy's secret allegiance to that spy, so it informs her own replies but never leaks into the responses of the characters she is deceiving.

## Using macros in entry content

An entry's **Content** is expanded like any other prompt text: prompt macros resolve before the content is injected. A few that are handy inside lorebook entries:

- `{{char}}` and `{{user}}` — the current character's and the user or persona's names, so a shared entry reads naturally in any chat.
- `{{random::a::b::c}}` and `{{roll:1d6}}` — pick a random option or roll dice, for flavor that varies each time the entry fires. Add `@` weights, as in `{{random::common@3::rare@1}}`, to make some options more likely than others.
- `{{#if ...}}...{{else}}...{{/if}}` — change the text based on who is speaking, a variable, or the active character.
- `{{getvar::name}}` and `{{setvar::name::value}}` — read or set a chat-local persistent variable, so an entry can react to or drive state across later turns without leaking into other chats.

Weighted random pairs well with **Probability** to fold a whole table into a single entry. Instead of a group of twenty monster entries, give one "wandering encounter" entry a low **Probability** (so an encounter is only occasional) and a weighted list of what appears:

`{{random::a lone wolf@5::a bandit scout@3::a wounded traveler@2::a displacer beast@1}}`

The entry fires only sometimes, and when it does it picks one encounter — weighted so common foes turn up more often than rare ones — with no compendium of separate entries to maintain.

Use the **comment macro** to leave a note that never reaches the AI:

- `{{// draft wording, revisit later}}` — everything inside `{{// ... }}` is stripped from the output.

**A note on recursion.** When **Recursive** scanning is turned on for the lorebook (see [Token Budgets and Recursion](token-budgets.md)), Marinara re-scans the *expanded* content of activated entries for more keywords. Because macros resolve first, the text a macro produces can trigger further entries — for instance, content that expands to a name can activate an entry keyed on that name. A `{{// comment}}` is the exception: it is stripped to nothing before the re-scan, so its text can never trigger anything. Comments are for notes only; if you want text to feed recursion, write it plainly.

## Common pitfalls

- **An entry never fires.** A **Normal** entry with no keys has nothing for keyword matching to catch — give it keys or make it **Constant**. (A keyless entry can still be recalled by meaning, but only with semantic search fully set up — enabled **Vectors**, a configured embedding model, and the entry vectorized; see [Semantic Search](semantic-search.md).) Check too that the lorebook is enabled and active in the chat.
- **A keyword stopped working.** Keys are matched only in the last few messages — the lorebook's **Scan Depth** (default 2). Once the trigger word scrolls out of that window, the entry goes quiet. Raise **Scan Depth**, add **Sticky** so a fact lingers once it fires, or make the entry **Constant**.
- **An entry fires in the wrong scenes.** A broad key like `home` or `king` matches too much. Tighten it with **Whole Words**, gate it with **Selective** secondary keys, or filter the entry to the right character.
- **Important lore keeps getting dropped.** When more entries match than the budget allows, the tail is trimmed. Give the entries that matter a lower **Order**, raise the **Token Budget**, or move bulky reference lore behind the Knowledge Router agent. The **Active Context** panel shows exactly what was skipped and why (see [Token Budgets and Recursion](token-budgets.md)).
- **The AI ignores your lore.** Confirm the entry actually activated in **Active Context** — and remember it competes with the rest of the prompt, so a fact buried far from the latest turn has less pull than one at **After chat** or, sparingly, **@ Depth**.

## Authoring checklist

A quick pass for each entry you write:

1. **Name it** clearly — the name is for you and for search, not for the AI.
2. **Decide how it fires:** an always-true fact → **Constant**; anything else → **Normal** with three to eight specific **keys**.
3. **Tame noisy keys** with **Whole Words**, or split them across **Selective** secondary keys.
4. **Write the content** as a plain fact, in as few tokens as it takes.
5. **Fill the Description** if you use the Knowledge Router agent.
6. **Leave placement at its defaults** unless the entry truly needs a custom **Position**, **Depth**, or **Order**.
7. **Group** mutually-exclusive alternates; **filter** character-specific lore to its character.
8. **Test** it in the **Keyword test** panel, then watch **Active Context** in a real chat to confirm it fires and fits the budget.

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
