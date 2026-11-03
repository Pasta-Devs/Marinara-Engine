# Semantic Search for Lorebooks

Semantic search lets a lorebook entry activate by meaning, not only by exact keywords. An entry keyed to "sword" can then match a message that says "blade". Use it when your writing uses many different words for the same idea.

It works with embeddings, lists of numbers that capture the meaning of a text. Marinara stores one embedding, also called a vector, for each entry. Building them is called vectorizing. At chat time Marinara embeds your recent messages and finds the closest entries.

Semantic search adds matches. Your keywords keep working. Keyword and semantic matches have equal priority under the budgets, so when not everything fits, the entry **Order** decides.

## Set up semantic search

You need an embedding source first, then the **Vectors** switch, then a vectorize run.

### Step 1: Pick an embedding source

Before you start: you need either an account whose service offers embeddings, or the built-in model. Not every service offers embeddings. If yours does not, the editor tells you to pick a dedicated embedding account.

Option 1: an account with an embedding model.

1. Open the **Connections** panel and open an account for editing.
2. Open **Advanced**, then **More**, and find **Semantic search (embeddings)**.
3. Type an embedding model name, such as `text-embedding-3-small`. If you are not sure of the name, look in your service's documentation, or use the built-in model instead.
4. Save the account.
5. Click **Test embedding** to check. Marinara saves first, embeds a short sample, and shows the vector size, such as "1536 dimensions", or the error the service returned.

To send embedding requests through another account's key and address, pick that account under **Embedding provider**. The default is **Same as this provider**. If the chosen account has its own embedding model, Marinara uses it. Otherwise it uses the model name typed here.

Option 2: the built-in model. It runs on your computer with no API key and is named **Built-in model** in the picker. It appears after you download it, and it is hidden on Lite builds. See [Built-in Model Setup](../connections/local-model.md).

To make one source the default for every account that sets none, open **Connections** and choose it in the **Embeddings** job. An account's own setting still wins. The default entry, **Marinara's own search**, keeps the built-in fallback.

### Step 2: Turn on Vectors

Semantic search is off for new lorebooks.

1. Open the lorebook and stay on the **Overview** tab.
2. Turn on **Vectors**. With it on, entries can also be found by meaning. With it off, keywords still work and the lorebook is not vectorized.

While **Vectors** is off, the panel says "Semantic search is disabled by the lorebook-level Vectors toggle."

### Step 3: Vectorize the entries

1. In the **Semantic search (embeddings)** panel, pick a source in the dropdown. The first choice is **No semantic search**. **Built-in model** comes next, when available, then your eligible accounts.
2. Click **Vectorize N missing**, for example "Vectorize 5 missing".
3. Wait. A chip shows progress, such as "8/12 entries vectorized", and turns green when all are done.

If it did not work: with no embedding model on any account, the panel says "No connections with an embedding model configured. Set an Embedding Model on a connection first." Finish Step 1 and try again.

## The Semantic search (embeddings) panel

After you turn on **Vectors**, the panel appears on the **Overview** tab with these settings.

| Setting | What it does | Default | Range |
| --- | --- | --- | --- |
| **Query Messages** | How many recent user messages to search with. 0 uses all available messages. | 10 | 0 to 100 |
| **Score Threshold** | The similarity an entry needs to activate. Higher is stricter. | 0.3 | 0 to 1 |
| **Vector Limit** | The most entries this lorebook can add by meaning in one reply. | 10 | 1 to 100 |

**Include character context** also searches recent character replies, separately from your messages, and keeps the stronger match. It embeds extra text and is off by default. **Query Messages** then applies to character replies too.

A low **Score Threshold** such as 0.2 lets more entries in but risks off-topic matches. A high one such as 0.5 matches only close meanings. Start at the default.

**Vector Limit** counts only meaning matches. Your normal token budgets still apply.

## Re-vectorize, delete, and skip

- **Re-vectorize N entries** appears when every entry has a vector. It rebuilds all of them after you confirm.
- **Re-vectorize all** appears when some entries have vectors and some do not. It rebuilds everything in one pass.
- **Delete vectors** removes the stored vectors only. Entry text and keywords stay, and keywords keep working.
- **No Vector** on an entry skips it. Its help text says bulk vectorization skips the entry and removes any stored embedding. The entry still activates by keyword.

### After you change the embedding model

Stored vectors belong to the model that made them. After you switch models, use **Re-vectorize N entries** or **Re-vectorize all** so every entry uses the same model. A "missing only" run that returns a different vector size is refused with "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models."

One failure is silent. At chat time Marinara embeds your messages with the active account's embedding model, or the model from its **Embedding provider**. If the account sets neither, it uses the **Embeddings** job's source, or the built-in model. If that model's vector size differs from your entries' vectors, Marinara skips those entries in semantic matching and shows no error. Vectorize with the same source you use in chat, and re-vectorize after any model change.

## Semantic search and the Knowledge Router

When a lorebook is vectorized, the **Knowledge Router** agent also uses meaning matches to build its shortlist. Without vectors it uses keyword matches only. See [Knowledge Sources: Retrieval and Router Agents](../agents/knowledge-sources.md).

## Related guides

- [Lorebooks Overview](overview.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Built-in Model Setup](../connections/local-model.md)
- [Knowledge Sources: Retrieval and Router Agents](../agents/knowledge-sources.md)
