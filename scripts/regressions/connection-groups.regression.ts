// Connection groups: pure arrangement of Models under Connections (accounts).
import assert from "node:assert/strict";
import {
  accountStateLabel,
  groupModelsByAccount,
  recentModels,
  roleBadges,
  subgroupByUpstream,
  upstreamOf,
} from "../../packages/client/src/lib/connection-groups.js";

const account = (id: string) => ({ id, name: id, state: "ok" }) as never;
const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, model: id, ...extra });

// upstreamOf: first "/" segment only.
assert.equal(upstreamOf("linkapi/gpt-5.5"), "linkapi");
assert.equal(upstreamOf("nanogpt/zai-org/glm-5.2"), "nanogpt");
assert.equal(upstreamOf("gpt-5.5"), null);
assert.equal(upstreamOf("/odd"), null);
assert.equal(upstreamOf(null), null);

// Sub-headings need two or more distinct prefixes.
assert.deepEqual(
  subgroupByUpstream([row("a/1"), row("a/2"), row("a/3")]).map((g) => g.upstream),
  [null],
);
assert.deepEqual(
  subgroupByUpstream([row("plain"), row("a/1")]).map((g) => g.upstream),
  [null],
);
const split = subgroupByUpstream([row("a/1"), row("plain"), row("b/1"), row("a/2")]);
assert.deepEqual(
  split.map((g) => [g.upstream, g.rows.map((r) => r.id)]),
  [
    ["a", ["a/1", "a/2"]],
    ["b", ["b/1"]],
    [null, ["plain"]],
  ],
);

// recentModels: newest first, distinct, limit 3, current and unknown ids skipped.
const rows = ["m1", "m2", "m3", "m4", "m5"].map((id) => row(id));
const chats = [
  { connectionId: "m1", updatedAt: "2026-01-01" },
  { connectionId: "m2", updatedAt: "2026-01-05" },
  { connectionId: "m2", updatedAt: "2026-01-04" },
  { connectionId: "gone", updatedAt: "2026-01-06" },
  { connectionId: null, updatedAt: "2026-01-07" },
  { connectionId: "m3", updatedAt: "2026-01-03" },
  { connectionId: "m4", updatedAt: "2026-01-02" },
];
assert.deepEqual(
  recentModels(chats, rows, 3).map((r) => r.id),
  ["m2", "m3", "m4"],
);
assert.deepEqual(
  recentModels(chats, rows, 3, "m2").map((r) => r.id),
  ["m3", "m4", "m1"],
);

// roleBadges accept stored "true"/"false" strings and booleans.
assert.deepEqual(roleBadges({ id: "x", isDefault: "true", defaultForAgents: true, useForRandom: "false" }), [
  "main",
  "agents",
]);
assert.deepEqual(roleBadges({ id: "x", fallbackForAgents: "true", useForRandom: true }), ["fallback", "random"]);
assert.deepEqual(roleBadges({ id: "x" }), []);

// Grouping: chat + image share one Connection, a decision row follows its lender, strays are standalone.
const { groups, standalone } = groupModelsByAccount(
  [
    row("chat", { accountId: "acc", provider: "openai" }),
    row("img", { accountId: "acc", provider: "image_generation" }),
    row("decision", { credentialsFromConnectionId: "chat", provider: "decision" }),
    row("lone"),
    row("orphan", { accountId: "deleted" }),
    row("borrower-of-lone", { credentialsFromConnectionId: "lone" }),
  ],
  [account("acc"), account("empty")],
);
assert.deepEqual(
  groups.map((g) => [g.account.id, g.rows.map((r) => r.id)]),
  [
    ["acc", ["chat", "img", "decision"]],
    ["empty", []],
  ],
);
assert.deepEqual(
  standalone.map((r) => r.id),
  ["lone", "orphan", "borrower-of-lone"],
);

assert.equal(accountStateLabel({ state: "needs_key" }), "connections.accounts.state.needs_key");
console.log("connection-groups regression passed");
