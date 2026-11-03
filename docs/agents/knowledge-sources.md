# Knowledge Sources: Retrieval and Router Agents

**Knowledge Retrieval** and **Knowledge Router** pull facts from your lorebooks into a chat only when a scene needs them. You do not have to put every detail into every prompt. Both agents work in Roleplay chats only, and neither is on by default.

## Why use them

A lorebook is a set of world or character notes. Each note is an entry. Sending every entry on every turn wastes tokens (the small pieces of text a model reads and you pay for) and can confuse the AI.

These agents use retrieval-augmented generation (RAG): Marinara finds the entries that fit the current scene and adds only those to the prompt for that turn.

## Choose Retrieval or Router

| Question | Knowledge Retrieval | Knowledge Router |
| --- | --- | --- |
| How it adds content | Summarizes the sources first | Adds chosen entries word for word |
| Cost per turn | Higher | Lower |
| Can read uploaded files | Yes | No |
| Best for | Smaller sources, or a tidy summary | Large lorebooks with good entry descriptions |

- **Knowledge Retrieval** reads every enabled entry in your chosen lorebooks, plus uploaded files, and asks the AI to summarize the facts that fit the recent messages. This costs more because the AI reads all the source text.
- **Knowledge Router** builds a small catalog of your entries. Each line holds an ID, a name, a few keywords and a short summary. The AI picks entries from the catalog, and Marinara adds them in full. The AI never reads every entry, so the router stays cheap with a big lorebook.

You can add both to one chat, but they overlap and raise cost. The agent editor warns you when both are set up. Pick one.

## Add a Knowledge agent to a chat

Before you start: install the agent from **Agent Organizer**. See [Agents overview](agents-overview.md).

1. In a Roleplay chat, open **Chat Settings**.
2. Find the **Agents** section and turn on **Enable Agents**.
3. Click **Add Agent**.
4. Open the **Writer Agents** group and choose **Knowledge Retrieval** or **Knowledge Router**.
5. In the setup dialog, pick your sources (see below).

The agent's settings card then appears in **Agents**, and it runs on each new turn. While Knowledge Retrieval works, the progress indicator can show **Retrieving knowledge...**.

> **Note:** These agents run on new turns only. They do not run again when you regenerate a reply.

## Choose the sources

Both agents share the same source controls.

- **Use chat-active lorebooks** is on by default. The agent editor calls the same toggle **Use this chat's active lorebooks**. While it is on and you pick no fixed lorebooks, the agent reads the lorebooks active in the current chat.
- **Fixed source override** (**Fixed Source Lorebooks** in the setup dialog) locks the agent to the lorebooks you pick. A fixed selection always wins over chat-active lorebooks, in every chat that uses this agent.

Use fixed sources when one agent should always read the same reference lorebook. Leave the toggle on, with no fixed picks, to follow whatever the chat uses.

## Upload files (Knowledge Retrieval only)

In the **Knowledge Retrieval** settings, click **Upload file**. Uploaded files are available to every chat that uses Knowledge Retrieval.

Supported types are `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`, `.htm`, `.log`, `.yaml`, `.yml`, `.tsv` and `.pdf`. The file picker blocks other types. Each file shows its name and size, with a delete button.

- Every file except a PDF is read as plain text. A file that is not text, such as an image renamed to `.txt`, uploads but adds unreadable content.
- A scanned or image-only PDF has no text layer. The agent inserts a placeholder instead of content. Use a PDF with selectable text.

## Write good entry descriptions

This matters most for Knowledge Router, which picks entries by their **Description**.

1. Open the entry in the lorebook editor.
2. Fill in **Description** with a short, specific summary of what the entry covers.

The router uses the description only to choose entries. It is not sent to the main AI as story content. With no description, the router falls back to the start of the entry's content, which is less precise.

When you pick source lorebooks for the router, a coverage badge appears next to **Fixed source override**, for example **75% described (9/12)**. The dot is green at 75% and up, amber from 25% to 74%, and red below 25%. It reads **No entries yet** for empty lorebooks. Aim for green.

## Optional: shortlist by meaning

Knowledge Router can also find candidate entries by meaning, not only by keyword. This uses an embedder, a small model that turns text into numbers so Marinara can compare meaning. The router works without it.

1. Open the lorebook editor and find **Semantic search (embeddings)**.
2. Pick an account that has an embedding model. If you set an **Embeddings** default under **Connections → Defaults**, it is picked for you unless you chose another source earlier.
3. Use the same embedding source as your chat account. Vectors of a different size are skipped.
4. Click the vectorize button. It shows how many entries still need vectors. **Re-vectorize all** redoes every entry.

If a lorebook has no vectors, or no embedder is available, the router builds its candidate list from keywords alone. Nothing breaks. See [Semantic search for lorebooks](../lorebooks/semantic-search.md).

## Related guides

- [Semantic search for lorebooks](../lorebooks/semantic-search.md)
- [Lorebooks overview](../lorebooks/overview.md)
- [Agents: AI helpers for your chats](agents-overview.md)
