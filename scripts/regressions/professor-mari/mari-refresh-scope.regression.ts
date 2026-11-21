// After every Professor Mari reply the Mari page refetched every query the app had mounted (~40 requests), even
// for an answer that only read docs. A run now refreshes only what her tools could have changed.
import assert from "node:assert/strict";
import {
  createMariRefreshScope,
  invalidateMariRefreshScope,
  mariAppDataActionLooksReadOnly,
  mariRefreshScopeForTables,
} from "../../../packages/client/src/components/chat/mari/mari-refresh-scope";
import {
  appDataActionLooksReadOnly,
  PROFESSOR_MARI_APP_DATA_ACTIONS,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service";

const scopeOf = (tools: Array<[string, unknown]>) => {
  const scope = createMariRefreshScope();
  for (const [name, input] of tools) scope.noteTool(name, input);
  return scope.result();
};

// Reads and previews refresh nothing.
assert.deepEqual(
  scopeOf([
    ["docs_search", { query: "scan depth" }],
    ["docs_read", { path: "x" }],
    ["read", {}],
    ["grep", {}],
    ["app_data", { action: "lorebook.entries", lorebookId: "a" }],
    ["app_data", { action: "character.get", id: "c", apply: true }],
    ["app_data", { action: "character.update", characterId: "c", patch: {} }],
    ["package_service", {}],
  ]),
  { all: false, keys: [] },
);

// An applied app_data write refreshes its own lists only.
assert.deepEqual(scopeOf([["app_data", { action: "lorebook.updateEntry", entryId: "e", apply: true }]]), {
  all: false,
  keys: [["lorebooks"]],
});
assert.deepEqual(scopeOf([["app_data", { action: "character.moveToFolder", characterId: "c", apply: true }]]), {
  all: false,
  keys: [["characters"], ["home-feed"], ["library-folders"]],
});
// Mari's own memories touch no app list.
assert.deepEqual(scopeOf([["app_data", { action: "instruction.remember", apply: true }]]), { all: false, keys: [] });

// Files, shell commands, package actions and anything unknown keep the old refresh-everything behaviour.
for (const tool of [
  ["bash", { command: "mari characters delete x" }],
  ["write", { path: "a" }],
  ["dependency", {}],
  ["package_service", { package: "p", action: "run" }],
  ["app_data", { action: "something.new", apply: true }],
  ["brand_new_tool", {}],
] as Array<[string, unknown]>) {
  assert.deepEqual(scopeOf([tool]), { all: true }, `${tool[0]} must refresh everything`);
}
const dropped = createMariRefreshScope();
dropped.markAll();
assert.deepEqual(dropped.result(), { all: true }, "a dropped stream refreshes everything");

// Applied changes from the workspace history map by table; an unknown table refreshes everything.
assert.deepEqual(mariRefreshScopeForTables(["lorebook_entries", "lorebooks"]), { all: false, keys: [["lorebooks"]] });
assert.deepEqual(mariRefreshScopeForTables(["some_new_table"]), { all: true });

// The invalidation itself: scoped keys, never cancelling a fetch already running; "all" defers to the full refresh.
const calls: unknown[] = [];
const qc = {
  invalidateQueries: async (filters: unknown, options: unknown) => {
    calls.push([filters, options]);
  },
} as never;
let fullRefreshes = 0;
await invalidateMariRefreshScope(qc, { all: false, keys: [["themes"]] }, async () => {
  fullRefreshes++;
});
assert.deepEqual(calls, [[{ queryKey: ["themes"] }, { cancelRefetch: false }]]);
await invalidateMariRefreshScope(qc, { all: true }, async () => {
  fullRefreshes++;
});
assert.equal(fullRefreshes, 1);

// The client's read test must agree with the server's own (appDataActionLooksReadOnly) on every action Mari has.
for (const action of PROFESSOR_MARI_APP_DATA_ACTIONS) {
  assert.equal(
    mariAppDataActionLooksReadOnly(action),
    appDataActionLooksReadOnly(action),
    `client and server disagree on whether ${action} only reads`,
  );
}

console.log("Mari refresh scope regression passed.");
