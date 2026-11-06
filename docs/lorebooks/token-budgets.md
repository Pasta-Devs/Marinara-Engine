# Lorebook Token Budgets and Recursion

Budgets limit how much lorebook text reaches the AI, so lorebooks do not crowd out the chat. This guide covers each lorebook's **Token Budget** and **Entry Limit**, the chat's **Lorebook Token Budget**, how Marinara trims entries, and **Recursive** scanning.

Tokens are small pieces of text that models count. A model's context window is how much text it can read at once, counted in tokens. Lorebook text shares that window with the rest of the prompt.

## Two token budgets

Marinara applies two budgets every time it builds a prompt. An entry is skipped if it would push either one over its cap.

- Each lorebook has its own **Token Budget**: the most tokens that lorebook can add to one reply.
- Each chat has one **Lorebook Token Budget**: the most tokens all active lorebooks can add together.

## Setting a lorebook's Token Budget and Entry Limit

1. Open a lorebook from the **Lorebooks** panel.
2. Click the **Overview** tab.
3. Set **Token Budget** and **Entry Limit**.

| Setting | Default | What it does |
| --- | --- | --- |
| **Token Budget** | 2048 | The most tokens this lorebook adds in one reply. 0 means unlimited. |
| **Entry Limit** | 100 | The most entries this lorebook adds in one reply. Range 1 to 1000. |

**Entry Limit** counts entries, not tokens. A lorebook stops adding entries when it reaches either limit.

For example, with a **Token Budget** of 2048, a single 3000-token entry can never be added. Lower a budget if a lorebook takes too much space. Raise it if important entries keep being skipped.

## Set the chat's Lorebook Token Budget

1. Open a chat.
2. Open **Chat Settings**.
3. Find the **Lorebooks** section and set **Lorebook Token Budget**.

The default is 8192, and 0 means unlimited. It is the total for every lorebook active in this chat, on top of each lorebook's own **Token Budget**.

## How entries get trimmed

When more entries match than a budget allows, Marinara adds entries in this order.

1. **Constant** entries.
2. Entries that matched the latest messages.
3. The rest, in their injection order (the entry **Order** field).

Marinara adds each entry that still fits. When one does not fit, it skips that entry and keeps checking the rest, so a smaller entry can still get in after a larger one was skipped.

## Seeing skipped entries in Active Context

1. Open **Chat Settings**.
2. Expand **Active Context**. It shows the most recent lorebook scan.

If matching entries were skipped, a notice at the top reads "N matching lore entries were skipped by token budget." It names each budget that skipped entries and where to change it. Expand it to see each skipped entry, its lorebook, its matched keywords, its estimated size and how much of the budget was used. The reason is one of these.

| Reason | Meaning |
| --- | --- |
| **lorebook budget** | The entry did not fit that lorebook's **Token Budget**. |
| **chat budget** | The entry did not fit the chat's **Lorebook Token Budget**. |
| **lorebook and chat budgets** | Both caps were already full. |
| **current-location context cap** | The entry is attached to the current map location, which has its own fixed cap of 2,048 tokens. |

An entry with blank text, or text that macros turn into nothing, is not listed. Its macros still run, so a `{{setvar}}` in it still sets the variable. With both budgets at 0, only the location cap can list skipped entries.

If large lorebooks keep being skipped, **Active Context** suggests the **Knowledge Retrieval** or **Knowledge Router** agents. See [Knowledge Sources](../agents/knowledge-sources.md). These often fit big lorebooks better than a higher cap.

## Recursive scanning

Normally Marinara scans only your recent messages for keys. With **Recursive** on, it also scans the text of entries that were newly activated, so one entry can pull in related entries.

1. Open the lorebook and click **Overview**.
2. Turn on **Recursive**. It is off by default.
3. Set **Max Depth** if you want to change how far chaining goes.

**Max Depth** is the number of extra scanning passes. The default is 3 and the range is 1 to 10. Higher values find more connected lore and use more processing.

Each entry also has its own **Recursion** toggle, off by default, which decides whether that entry's content can trigger more entries. Keep it off unless the entry should chain. See [Lorebook Entries: Keys, Position, and Timing](entries.md).

Recursion does not bypass budgets. Entries found by a recursive pass count against the **Token Budget**, the **Entry Limit** and the chat's **Lorebook Token Budget**.

## Related guides

- [Lorebook Entries: Keys, Position, and Timing](entries.md)
- [Lorebooks Overview](overview.md)
- [Knowledge Sources: Retrieval and Router Agents](../agents/knowledge-sources.md)
