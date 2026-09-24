process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLorebookEntrySchema } from "../../packages/shared/src/schemas/lorebook.schema.js";
import type { LorebookEntry } from "../../packages/shared/src/types/lorebook.js";
import { recursiveScan } from "../../packages/server/src/services/lorebook/keyword-scanner.js";
import { resolveBudgetAndRecursivelyActivateLorebookEntriesWithDiagnostics } from "../../packages/server/src/services/lorebook/index.js";
import {
  createTimeoutRegexExecutor,
  createTimeoutRegexReplaceGuard,
} from "../../packages/server/src/services/lorebook/regex-timeout.js";

function entry(id: string, overrides: Record<string, unknown>, extra: Partial<LorebookEntry> = {}): LorebookEntry {
  return {
    ...createLorebookEntrySchema.parse({ lorebookId: "book", name: id, ...overrides }),
    id,
    embedding: null,
    ...extra,
  } as LorebookEntry;
}

// 1. Recursion passes must not re-run semantic matching, or vectorMaxResults multiplies by depth.
{
  const semanticEntries = ["s1", "s2", "s3", "s4"].map((id) =>
    entry(id, { keys: [`never-${id}`], content: `lore text for ${id}` }, { embedding: [1, 0] }),
  );
  const semanticOptions = {
    chatEmbedding: [1, 0],
    semanticThreshold: 0,
    semanticThresholdByLorebookId: new Map([["book", 0]]),
    semanticMaxMatchesByLorebookId: new Map([["book", 1]]),
    random: () => 0,
  };
  const resolved = resolveBudgetAndRecursivelyActivateLorebookEntriesWithDiagnostics(
    [{ role: "user", content: "hello there" }],
    semanticEntries,
    semanticOptions,
    3,
    new Map([["book", { name: "Book", tokenBudget: 0, entryLimit: 0 }]]),
    100000,
    0,
  );
  assert.equal(resolved.selected.length, 1, "recursive resolver must keep vectorMaxResults = 1 across depths");

  const scanned = recursiveScan([{ role: "user", content: "hello there" }], semanticEntries, semanticOptions, 3);
  assert.equal(scanned.length, 1, "recursiveScan must keep vectorMaxResults = 1 across depths");

  // Per-lorebook query embeddings alone (no chatEmbedding) must also stop at depth 0.
  const perBook = recursiveScan(
    [{ role: "user", content: "hello there" }],
    semanticEntries,
    { ...semanticOptions, chatEmbedding: null, semanticEmbeddingsByLorebookId: new Map([["book", [1, 0]]]) },
    3,
  );
  assert.equal(perBook.length, 1, "recursiveScan must ignore per-lorebook query embeddings in recursion passes");
}

// 2. recursiveScan must not re-activate inclusion-group losers at later depths.
{
  const groupEntries = ["a", "b", "c"].map((id) =>
    entry(id, { keys: [], constant: true, group: "threads", content: `thread ${id}` }),
  );
  const activated = recursiveScan([{ role: "user", content: "anything" }], groupEntries, { random: () => 0 }, 3);
  assert.equal(
    activated.filter((row) => row.entry.group === "threads").length,
    1,
    "only one member of an inclusion group may be activated",
  );
}

// 3. processLorebooks must not run the ordinary scan twice on the recursive path.
{
  const source = readFileSync(
    new URL("../../packages/server/src/services/lorebook/index.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /const ordinaryActivatedEntries =\s*forcedEntriesOnly \|\| anyRecursive\s*\?\s*\[\]/,
    "the outer ordinary scan must be skipped when the recursive resolver will scan",
  );
}

// 4. The vm regex executor reuses one context and still enforces its timeout.
{
  // Generous timeouts for the ordinary patterns so a loaded machine cannot fail
  // them; the pathological pattern would run for far longer than any of these.
  const exec = createTimeoutRegexExecutor(3000);
  const guard = createTimeoutRegexReplaceGuard(3000);
  const shortExec = createTimeoutRegexExecutor(200);
  const shortGuard = createTimeoutRegexReplaceGuard(200);
  assert.equal(exec(/dragon/i, "A DRAGON appears"), true);
  assert.equal(exec(/dragon/, "no match"), false);
  assert.equal(exec(/^x/g, "xx"), true);
  assert.equal(exec(/^x/g, "xx"), true, "no lastIndex state may carry between calls");
  assert.equal(shortExec(/(a+)+$/, `${"a".repeat(40)}!`), false, "pathological pattern must time out");
  assert.equal(exec(/ok/, "still ok"), true, "shared context must stay usable after a timeout");
  assert.equal(guard(/foo/g, "foo bar foo"), true);
  assert.equal(shortGuard(/(a+)+$/, `${"a".repeat(40)}!`), false);
  const regexSource = readFileSync(
    new URL("../../packages/server/src/services/lorebook/regex-timeout.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    (regexSource.match(/vm\.createContext\(/g) ?? []).length,
    1,
    "only one vm context may be created (at module level)",
  );
  const started = performance.now();
  for (let i = 0; i < 500; i += 1) assert.equal(exec(/lore\s+key/i, "some lore  key text"), true);
  assert.ok(performance.now() - started < 20000, "500 regex tests must not take many seconds");
}

console.log("server-hunt-b45 regressions passed.");
