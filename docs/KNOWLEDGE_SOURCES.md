# Knowledge Sources And RAG

Knowledge Sources are Marinara's retrieval-augmented generation system. They let agents pull relevant uploaded material into a chat without forcing every document into every prompt.

## Uploading Sources

Use the Knowledge Sources surface to upload or manage source files. After ingestion, entries can be retrieved by agents when a chat turn needs them.

Retrieval quality depends on a working embedder. If the local embedder is unavailable, semantic matching can degrade or fall back to less precise selection.

## Retrieval Agent Vs Router Agent

- **Knowledge Retrieval** reads and ranks source content more directly. It is broader and can cost more.
- **Knowledge Router** is cheaper. It reads a compact catalog of entry ids, names, and summaries, then chooses which entries to include.

Router precision depends heavily on entry descriptions. Write short, specific descriptions for each entry so the router can select them without reading the whole entry first.

## Debugging Missing Knowledge

Turn on debug logging or inspect agent activity to see which entries were selected. If the wrong material is chosen, tighten descriptions, add clearer keywords, or use the Retrieval agent for that chat instead of the Router.

