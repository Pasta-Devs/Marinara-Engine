import assert from "node:assert/strict";
import { searchDocsCommandTitles, toDocsCommandPassages } from "../../packages/client/src/lib/docs-command-search.js";

const index = {
  root: "/docs",
  language: "en",
  docs: [
    {
      path: "configuration/providers.md",
      title: "Provider configuration",
      dir: "configuration",
      updatedAt: "2026-08-17T00:00:00.000Z",
      language: "en",
    },
  ],
};

assert.deepEqual(searchDocsCommandTitles(" ", index), []);
assert.deepEqual(searchDocsCommandTitles("p", index), []);
assert.deepEqual(searchDocsCommandTitles(" provider ", index), [
  {
    id: "docs:configuration/providers.md:title",
    title: "Provider configuration",
    source: "configuration/providers.md",
    snippet: "Provider configuration",
    path: "configuration/providers.md",
    line: null,
    command: {
      id: "docs:configuration/providers.md:title",
      title: "Provider configuration",
      kind: "resource",
      icon: "documentation",
    },
    score: 200,
  },
]);

// One row per doc with its best snippet, not one per matching line (51d4c4541).
assert.deepEqual(
  toDocsCommandPassages({
    query: "provider",
    language: "en",
    results: [
      {
        ...index.docs[0],
        matches: 2,
        snippets: [
          { line: 12, text: "Select a provider for this connection." },
          { line: 24, text: "Each provider has its own model settings." },
        ],
      },
    ],
  }),
  [
    {
      id: "docs:configuration/providers.md",
      title: "Provider configuration",
      source: "configuration/providers.md",
      snippet: "Select a provider for this connection.",
      path: "configuration/providers.md",
      line: 12,
      command: {
        id: "docs:configuration/providers.md",
        title: "Provider configuration",
        kind: "resource",
        icon: "documentation",
      },
      score: 102,
    },
  ],
);

const selectedQuery = "provider settings".slice(0, 200);
assert.equal(selectedQuery, "provider settings");
assert.deepEqual(toDocsCommandPassages(undefined), []);

console.info("Documentation command search regression checks passed.");
