/**
 * A directive is prose the operator typed instead of prose the story produced.
 *
 * It runs through the ordinary agent path rather than a route of its own, so it
 * inherits connection resolution, the local model slot, prompt selection and the state
 * merge. The only difference is which text the lanes read, and that is what this pins:
 * the precedence between the three sources of narration, and the bound on what a
 * caller can push through it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = dirname(dirname(dirname(new URL(import.meta.url).pathname)));
const executor = readFileSync(join(root, "packages/server/src/services/agents/agent-executor.ts"), "utf8");
const route = readFileSync(join(root, "packages/server/src/routes/generate/retry-agents-route.ts"), "utf8");
const agentTypes = readFileSync(join(root, "packages/shared/src/types/agent.ts"), "utf8");

// Precedence: an explicit argument (the take-off repair hands one clause) must still
// beat a directive, or repairing a turn would silently re-read the operator's last
// correction instead of the sentence it meant to fix.
assert.match(
  executor,
  /narrationOverride \?\? context\.narrationOverride \?\? beholderNarration\(config, context\)/u,
  "narration precedence must be: explicit argument, then directive, then the story",
);

assert.match(agentTypes, /narrationOverride\?: string;/u, "the context must carry the directive");

// Bounded and trimmed at the route boundary, once.
assert.match(route, /beholderDirective\?: string;/u, "the route must accept a directive");
assert.match(route, /\.trim\(\)\.slice\(0, 2000\)/u, "and bound what a caller can push through it");
// An empty or whitespace directive must read as absent, not as "read nothing", which
// would blank the state on the next merge.
assert.match(
  route,
  /typeof beholderDirective === "string" && beholderDirective\.trim\(\)/u,
  "an empty directive must fall through to the story rather than becoming empty narration",
);

console.log("beholder directive regression passed.");
