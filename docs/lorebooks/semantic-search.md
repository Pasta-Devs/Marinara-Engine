# Semantic Search for Lorebooks

This guide explains semantic search for lorebooks in Marinara Engine. Semantic search lets a lorebook entry activate by meaning, not just by exact keywords. You will learn how to set up an embedding source, vectorize your entries, and tune the matching.

## What semantic search adds

A lorebook is a set of entries. Each entry has trigger keywords and a block of text. Normally an entry only activates when one of its exact keywords appears in the recent chat. If the writing uses a different word, the entry stays silent.

Semantic search fixes that. It compares the meaning of the recent chat with the meaning of your entries. An entry can then activate even when no exact keyword matches. For example, an entry keyed to "sword" can still match a message that only says "blade".

This works using embeddings. An embedding is a list of numbers that captures the meaning of a piece of text. Marinara stores one embedding, also called a vector, for each entry. This step is called vectorization. At chat time, Marinara embeds your recent messages and finds the entries whose meaning is closest.

Keyword matching still works when semantic search is on. Semantic search adds extra matches. It does not replace your keywords.

Keyword and semantic matches have equal priority when Marinara applies lorebook entry and token budgets. If every matching entry cannot fit, the entry order you configured decides between current keyword and semantic matches; the activation method itself does not win.

## Before you start: pick an embedding source

Semantic search needs a model that can create embeddings. You have two options.

Option 1: a connection with an embedding model.

1. Open the **Connections** panel.
2. Open a connection for editing.
3. Find the **Semantic Search (Embeddings)** section.
4. Type an embedding model name in the model field. A common value is `text-embedding-3-small`.
5. Save the connection.

Not every provider offers embeddings. If the provider cannot do embeddings, the editor tells you to choose a dedicated embedding connection instead.

Option 2: the built-in local model.

Marinara can run a small embedding model on your own machine with no API key. In the lorebook picker this option is named **Local Model (sidecar)**. It appears only after you download the local model. See [Local Model Setup](../connections/local-model.md) for how to install it.

If you are on a Marinara Lite build, the **Local Model (sidecar)** option is hidden. On Lite, semantic search needs a connection with an embedding model.

## Turn on Vectors for a lorebook

Semantic search is off for new lorebooks by default. You turn it on per lorebook.

1. Open the lorebook you want to search by meaning.
2. Stay on the **Overview** tab.
3. Find the **Vectors** switch and turn it on.

The **Vectors** help text reads: "When on, entries in this lorebook may use semantic embeddings. When off, keyword matching still works and vectorization skips this lorebook."

While **Vectors** is off, the semantic panel shows this note: "Semantic search is disabled by the lorebook-level Vectors toggle."

## The Semantic Search (Embeddings) panel

With **Vectors** on, the **Semantic Search (Embeddings)** panel appears on the **Overview** tab. A status chip shows how many entries are vectorized, for example "8/12 entries vectorized". It turns green with a check mark once every entry is done.

The panel has three number settings.

| Setting | What it does | Default | Range |
|---|---|---|---|
| **Query Messages** | How many recent chat messages to embed when searching this lorebook. | 10 | 0 to 100 |
| **Score Threshold** | Minimum calibrated similarity an entry needs before it activates. Higher is stricter. | 0.3 | 0 to 1 |
| **Vector Limit** | Most semantic matches this lorebook can add to one generation. | 10 | 1 to 100 |

Set **Query Messages** to 0 to search against the full chat history instead of a recent window.

**Score Threshold** controls how close the meaning must be. A low value like 0.2 lets more entries in but risks off-topic matches. A high value like 0.5 is stricter and matches only close meanings. Start at the default and adjust if you get too many or too few matches.

Marinara calibrates this score against several unrelated neutral passages from the same embedding model. This removes the unusually high common cosine floor produced by some local and OpenAI-compatible embedding backends, where unrelated texts can otherwise all score around 0.95 or higher. The setting therefore remains useful across embedding models instead of requiring a model-specific cutoff near 1.0.

**Vector Limit** caps semantic matches only. Your normal token budgets still apply on top of it.

## Vectorize your entries

Vectorizing means building and storing the embedding for each entry. You must do this before semantic matching can work.

1. Turn on **Vectors** for the lorebook.
2. In the **Semantic Search (Embeddings)** panel, pick an embedding source in the dropdown. The first option is **No semantic search**. **Local Model (sidecar)** comes next, when available. Your eligible connections come after it.
3. Click the vectorize button. When some entries are missing a vector, the button reads **Vectorize N missing**, for example "Vectorize 5 missing".
4. Wait for the run to finish. The status chip updates to show all entries vectorized.

If no connection has an embedding model, the panel shows this note instead of the dropdown: "No connections with an embedding model configured. Set an Embedding Model on a connection first." Set up an embedding source first, using the steps above.

When every entry already has a vector, the main button changes to **Re-vectorize N entries**. This rebuilds all stored vectors. It asks you to confirm before it overwrites them.

A separate **Re-vectorize all** button appears when some entries have vectors and others are still missing. Use it to rebuild everything in one pass.

To clear the stored vectors, click **Delete vectors**. This removes the embeddings only. It does not change your entry text or keywords. Keyword matching keeps working after you delete vectors.

### Skip a single entry

You can leave one entry out of vectorization while keeping the rest. Open the entry, then turn on its **No Vector** toggle. Its help text reads: "When enabled, bulk vectorization skips this entry and removes any stored embedding." That entry still activates by keyword. It just will not match by meaning.

## Re-vectorizing after you change models

Your stored vectors are tied to the embedding model that made them. If you switch to a different embedding model, the old vectors may no longer line up.

Rebuild every vector after you change the embedding model. Use **Re-vectorize N entries** or **Re-vectorize all** so all entries use the same model.

Do not run only a partial vectorize after a model change. If a "missing only" run returns a different vector size than the stored vectors, the server refuses it with this message: "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models."

There is one quiet failure mode to know about. At chat time, Marinara embeds your recent messages with a query model. The query model is the active connection's own embedding model. If the connection has none set, Marinara uses the built-in local model. The query model may produce a different vector size than the model that vectorized your entries. Marinara then skips those entries in semantic matching. You do not see an error. To avoid this, vectorize your entries with the same embedding source you use during chat. Re-vectorize after any model change.

## How it feeds the Knowledge Router agent

Semantic search also helps the **Knowledge Router** agent. That agent picks relevant lorebook entries and injects them into the prompt for large lorebooks. When a lorebook is vectorized, the router uses semantic matches to build its shortlist of candidate entries, alongside your keyword matches.

This step is optional for the router. If the lorebook is not vectorized, or no embedding source is available, the router falls back to keyword matches only. Vectorizing simply gives it a better shortlist. See [Knowledge Sources: Retrieval and Router Agents](../agents/knowledge-sources.md) for how that agent works.

## Related guides

- [Lorebooks Overview](overview.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Local Model Setup](../connections/local-model.md)
- [Knowledge Sources: Retrieval and Router Agents](../agents/knowledge-sources.md)
