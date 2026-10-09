# Lorebook Token Budgets and Recursion

This guide explains how Marinara Engine limits how much lorebook text reaches the AI. It covers each lorebook's own **Token Budget** and **Entry Limit**, plus the chat-wide **Lorebook Token Budget**. It also explains how Marinara trims entries when a budget is full, and what **Recursive** scanning does.

A token is a small chunk of text, roughly a few characters. Every model has a limited context window, which is the total amount of text it can read at once. Budgets keep your lorebooks from filling that window and crowding out the actual conversation.

## Two token budgets

Marinara applies two separate token budgets every time it builds a prompt. Marinara skips an entry if it would push either budget over its cap.

1. Each lorebook has its own **Token Budget**. This caps how much text that one lorebook can add per reply.
2. The chat has a single **Lorebook Token Budget**. This caps the total text from all active lorebooks combined in that chat.

Both caps run at the same time. A single entry can be blocked by the lorebook budget, the chat budget, or both.

## Setting a lorebook's Token Budget and Entry Limit

Open a lorebook from the **Lorebooks** panel, then use the **Overview** tab. You will see two number fields near the scan settings.

- **Token Budget** (default **2048**): the most tokens this lorebook can add in one reply. Set it to **0** for unlimited.
- **Entry Limit** (default **100**): the most entries this lorebook can add in one reply. You can set it from **1** to **1000**.

The **Entry Limit** is a separate cap from the token budget. It counts entries, not tokens. Even with room in the token budget, a lorebook stops adding entries once it hits this limit. The token budget can still skip entries while the lorebook is under its **Entry Limit**.

For example, imagine a lorebook with a **Token Budget** of **2048** and one 3000-token entry. That lorebook can never add the entry. Lower the budget only if a lorebook is taking too much space. Raise it if important entries keep getting skipped.

## The chat-wide Lorebook Token Budget

The chat-level cap lives in the chat's **Settings** drawer, in the **Lorebooks** section.

1. Open a chat.
2. Open the chat **Settings** drawer.
3. Find the **Lorebooks** section.
4. Set the **Lorebook Token Budget** field.

The default is **8192**. Set it to **0** for unlimited. This budget is the total for every lorebook active in this chat. It applies on top of each lorebook's own **Token Budget**.

## How entries get trimmed

When more entries match than a budget allows, Marinara keeps the most important ones and drops the rest. It sorts entries before trimming so the ones you most likely need survive.

- **Constant** entries come first. These are entries set to inject every time the lorebook is active.
- Entries that matched your latest message come next.
- Remaining entries follow in their normal injection order.

Marinara goes down that list and adds each entry that still fits. If an entry would push a budget over its cap, Marinara skips that entry and moves on. It still checks every entry below the skipped one. This means a smaller entry can get in even after Marinara skips a larger one.

## Seeing skipped entries in Active Context

You do not have to guess which entries were dropped. Open **Chat Settings** and expand the **Active Context** section. It shows the live result of the most recent lorebook scan.

If any matching entries were skipped, a notice in your theme's accent color appears at the top. It reads "N matching lore entries were skipped by token budget." Under that, it names each budget that skipped entries and where to change it. Expand it to see each skipped entry.

Each skipped entry names the lorebook it came from and why it was blocked. The reason is one of these:

- **lorebook budget**: the entry did not fit that single lorebook's **Token Budget**.
- **chat budget**: the entry did not fit the chat-wide **Lorebook Token Budget**.
- **lorebook and chat budgets**: both caps were already full.
- **current-location context cap**: the entry is lore attached to the current location, which has its own limit of 2,048 tokens. No setting changes it, but the entry can still come in through its own keywords.

An entry whose text is blank, or that macros turn into nothing, is not listed. It has nothing to add, so no budget skipped it. Its macros still run, so a `{{setvar}}` in it still sets the variable. With both token budgets at **0**, only the current-location limit can list skipped entries here.

Expand a skipped entry to see more detail. It shows the matched keywords, the estimated token size, and how much of the budget was already used. If large lorebooks keep getting skipped, **Active Context** suggests the **Knowledge Retrieval** or **Knowledge Router** agents. These often fit big lorebooks better than raising your caps.

## Recursive scanning

Normally Marinara scans only your recent messages for keyword matches. With **Recursive** scanning on, it also scans the text of entries that just activated. This lets an activated entry pull in related entries whose keywords appear in its text.

Turn it on in the lorebook **Overview** tab.

1. Open the lorebook.
2. Open the **Overview** tab.
3. Turn on the **Recursive** switch. It is off by default.
4. Set **Max Depth** if you want to change how far the chaining goes.

**Max Depth** (default **3**) sets how many extra scanning passes run. Each pass looks at the newly activated entries for more keyword matches. You can set it from **1** to **10**. Higher values find more connected lore but use more processing.

Recursion is opt-in per entry as well. In an entry's expanded drawer, the **Recursion** toggle controls whether that entry's content can trigger more entries. It is off by default. Keep it off unless that entry should chain into other lore. See [Lorebook Entries: Keys, Position, and Timing](entries.md) for the full entry controls.

Recursion does not bypass your budgets. Entries found by a recursive pass still count against the **Token Budget**, the **Entry Limit**, and the chat-wide **Lorebook Token Budget** like any other entry.

## Related guides

- [Lorebook Entries: Keys, Position, and Timing](entries.md)
- [Lorebooks Overview](overview.md)
- [Knowledge Sources: Retrieval and Router Agents](../agents/knowledge-sources.md)
