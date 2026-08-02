import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAgentCatalogKindBadgeVisible } from "../../packages/client/src/lib/agent-catalog-kind-badges.js";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

assert.equal(isAgentCatalogKindBadgeVisible("agent"), true);
assert.equal(isAgentCatalogKindBadgeVisible("conversation-calls"), true);
assert.equal(isAgentCatalogKindBadgeVisible("maps"), false);
assert.equal(isAgentCatalogKindBadgeVisible("turn-game"), false);

const catalogViewSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/agents/AgentCatalogView.tsx"),
  "utf8",
);
assert.match(
  catalogViewSource,
  /storyboard:\s*\["roleplay",\s*"game"\]/u,
  "Storyboard must advertise its Roleplay and Game catalog badges",
);

console.info("Agent catalog kind badge regressions passed.");
