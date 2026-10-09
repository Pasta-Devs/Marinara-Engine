import assert from "node:assert/strict";
import { PROVIDERS } from "../../packages/shared/src/constants/providers.ts";
import { buildOmnibarConnectionRows } from "../../packages/client/src/lib/omnibar-entity-rows.js";
import { buildOmnibarLorebookEntryResults } from "../../packages/client/src/lib/omnibar-results.js";

const t = (_key: string, fallback: string, options?: Record<string, unknown>) =>
  fallback.replace(/\{\{(\w+)\}\}/gu, (_match, name: string) => String(options?.[name] ?? ""));

// Lorebook entries: line 2 is the keys, the book is the meta, and line 3 only when the content matched.
const entry = (overrides: Record<string, unknown>) => ({
  id: "entry-1",
  lorebookId: "book-1",
  name: "Harbor",
  keys: ["harbor", "dock"],
  content: "The harbor bell rings at dawn and the ships leave with the tide.",
  enabled: true,
  ...overrides,
});
const [byContent, byName] = buildOmnibarLorebookEntryResults({
  entries: [entry({}), entry({ id: "entry-2", name: "Tide Clock", keys: ["tide"], content: "A brass clock." })] as never,
  lorebookNameById: new Map([["book-1", "Port Notes"]]),
  query: "bell",
  t,
});
assert.equal(byContent!.description, "Keys: harbor, dock", "line 2 is the keys");
assert.equal(byContent!.meta, "Port Notes", "the book is the row's end meta, not line 2");
assert.match(byContent!.excerpt ?? "", /bell/u, "the content that matched is line 3");
assert.deepEqual(
  byContent!.excerptMatch,
  [(byContent!.excerpt ?? "").indexOf("bell"), (byContent!.excerpt ?? "").indexOf("bell") + 4],
  "the match is marked inside line 3",
);
assert.equal(byName!.excerpt, undefined, "a row matched by something other than its text has no line 3");
assert.equal(byName!.meta, "Port Notes", "without content, the book still names the row");

// Connections: the provider's display name, never the raw id, in line 2 with the model.
const [connection] = buildOmnibarConnectionRows({
  connections: [{ id: "c1", name: "Local", provider: "custom", model: "gpt-x" }],
  categoryLabels: {} as never,
  t,
});
const subtitle = connection!.preview().subtitle;
assert.equal(subtitle, `gpt-x · ${PROVIDERS.custom.name}`, "model, then the provider's display name");
assert.ok(!String(subtitle).includes("custom"), "the raw provider id is not shown");

process.stdout.write("omnibar-row-lines regression passed\n");
