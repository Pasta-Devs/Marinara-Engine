# Knowledge Sources: Retrieval and Router Agents

This guide explains the two Knowledge agents in Guksu Motor: **Knowledge Retrieval** and **Knowledge Router**. Both pull facts from your lorebooks into a chat only when a scene needs them. This way you do not have to put every detail into every prompt.

## What these agents do

A lorebook is a set of world or character notes you write ahead of time. Each note is called an entry. As a chat grows, sending every entry on every turn wastes tokens. A token is a small unit of text that the AI reads, and more tokens mean higher cost. Sending everything can also confuse the AI.

Knowledge agents solve this with RAG. RAG stands for retrieval-augmented generation. It means the app finds the entries that fit the current scene, then adds only those to the prompt for that one turn.

Guksu does this with two optional agents:

- **Knowledge Retrieval** reads your chosen sources, summarizes the facts that matter, and adds the summary to the prompt.
- **Knowledge Router** reads a short list of your entries, picks the ones that fit the scene, and adds those entries word for word.

Both agents work only in **Roleplay** chats. You cannot add them in Conversation Mode or Game Mode. Neither agent is on by default. You add the one you want to a chat yourself.

## Knowledge Retrieval vs Knowledge Router

Use this table to choose. Read the notes below it before you decide.

| Question | Knowledge Retrieval | Knowledge Router |
|---|---|---|
| How it adds content | Summarizes the sources first | Adds chosen entries word for word |
| Cost per turn | Higher | Lower |
| Can read uploaded files | Yes | No |
| Best for | Smaller sources, or when you want a tidy summary | Large lorebooks with good entry descriptions |

**Knowledge Retrieval** reads every enabled entry in your chosen lorebooks, plus the text of any files you upload. It then asks the AI to write a short summary of the facts that fit the recent messages. This costs more per turn because the AI reads the full source material.

**Knowledge Router** is the cheaper option. It builds a small catalog of your entries. Each catalog line holds an ID, a name, a few keywords, and a short summary. The AI reads that catalog, picks the entries that fit the scene, and Guksu adds those entries in full. The AI never reads every entry in full, so the router stays cheap even with a big lorebook.

You can add both agents to one chat, but they may add overlapping content and raise your token cost. The agent editor warns you when both are set up. For cleaner prompts, pick one.

## Adding a Knowledge agent to a chat

Do this inside a **Roleplay** chat.

1. Open **Chat Settings**.
2. Find the **Agents** section.
3. Turn on **Enable Agents**. The agent list unlocks.
4. Click **Add Agent**.
5. Open the **Writer Agents** group.
6. Choose **Knowledge Retrieval** or **Knowledge Router**.

A setup dialog opens so you can pick sources right away. After you add the agent, its settings card appears in the **Agents** section. The agent then runs on its own on each new turn.

When **Knowledge Retrieval** runs, the progress indicator can show the phase **Retrieving knowledge...** while it works.

Note: these agents do not run again when you regenerate an existing reply. They run only on new turns.

## Uploading files for Knowledge Retrieval

Only **Knowledge Retrieval** can read uploaded files. **Knowledge Router** uses lorebooks alone.

In the **Knowledge Retrieval** settings, you will see a file list and an **Upload file** button. Uploaded files stay available to every chat that uses **Knowledge Retrieval**, not just the current one.

Supported file types are .txt, .md, .csv, .json, .xml, .html, .htm, .log, .yaml, .yml, .tsv, and .pdf. The file picker blocks other types. Each listed file shows its name and size, with a delete button next to it.

Keep these limits in mind:

- Every file except a PDF is read as plain text. A file that is not really text, such as an image renamed to .txt, will upload but will add garbled, unreadable content.
- A scanned or image-only PDF has no text layer, so the agent cannot read it. When extraction fails, the agent inserts a placeholder instead of real content. Use a PDF that contains selectable text.

## Choosing your sources: fixed override vs chat lorebooks

Both agents share the same source controls in their settings card.

The **Use chat-active lorebooks** toggle is on by default. The agent editor labels the same toggle **Use this chat's active lorebooks**. While it is on and you pick no fixed lorebooks, the agent uses whatever lorebooks are active for the current chat.

Below the toggle is **Fixed source override**, shown as **Fixed Source Lorebooks** in the setup dialog. Pick one or more lorebooks here to lock the agent to that exact set. A fixed selection always wins over the chat-active lorebooks, for every chat that uses this agent.

Use fixed sources when you want one agent to always read the same reference lorebook. Leave the toggle on with no fixed picks when you want the agent to follow whatever the chat is using.

## Writing good entry descriptions

This section matters most for **Knowledge Router**. The router decides what to add by reading each entry's **Description**. A good description is what helps it pick the right entry.

You write the description in the lorebook entry editor, in the **Description** field. Keep it a short, specific summary of what the entry covers. The router uses this text only to choose entries. It is not sent to the main AI as story content.

If an entry has no description, the router falls back to the first part of the entry's content. That fallback is less precise. So fill in a description for each entry you want the router to find.

When you select source lorebooks for the router, a small coverage badge appears next to **Fixed source override**. It shows how many entries have a description, as a percent and a count, for example **75% described (9/12)**. The dot is green at 75 percent and up, amber from 25 to 74 percent, and red below 25 percent. It reads **No entries yet** when the chosen lorebooks are empty. Aim for green.

## Optional semantic shortlisting

**Knowledge Router** can also find candidate entries by meaning, not just by keyword. This is called semantic matching. It uses an embedder. An embedder is a small model that turns text into numbers so the app can compare meaning. This step is optional. The router still works without it.

To enable it, vectorize your lorebook. Vectorizing means the app runs the embedder on each entry once and saves the results. Open the lorebook editor and find the **Semantic Search (Embeddings)** section. Pick a connection that has an embedding model. Then click **Vectorize N missing**, where N is the count of entries that still need vectors. You can also click **Re-vectorize** to redo all entries. For details, see the semantic search guide linked below.

If a lorebook has no vectors, or no embedder is available, the router falls back to keyword matching to build its candidate list. Nothing breaks. It just relies on keywords alone.

## Related guides

- [Semantic search for lorebooks](../lorebooks/semantic-search.md)
- [Lorebooks overview](../lorebooks/overview.md)
- [Agents: AI helpers for your chats](agents-overview.md)
