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
const appShellSource = readFileSync(join(repositoryRoot, "packages/client/src/components/layout/AppShell.tsx"), "utf8");
assert.match(
  catalogViewSource,
  /storyboard:\s*\["roleplay",\s*"game"\]/u,
  "Storyboard must advertise its Roleplay and Game catalog badges",
);
assert.match(catalogViewSource, /(?:"beholder"|beholder):\s*\[\s*"roleplay"\s*\]/u);
assert.match(catalogViewSource, /(?:"gacha-forge"|gacha-forge):\s*\[\s*"conversation",\s*"roleplay",\s*"game"\s*\]/u);
assert.match(catalogViewSource, /(?:"slurp"|slurp):\s*\[\s*"conversation",\s*"roleplay",\s*"game"\s*\]/u);
assert.match(
  catalogViewSource,
  /const modes = packageModes\(entry\.manifest\.id\);[\s\S]*?data-agent-catalog-mode-badges[\s\S]*?modes\.map/u,
  "Catalog rows must show their supported chat modes without opening the detail view",
);
assert.match(
  appShellSource,
  /MOBILE_SHELL_PANEL_BOTTOM_PADDING_CLASS\s*=\s*\n?\s*"pb-\[min\(max\(env\(safe-area-inset-bottom\),0\.5rem\),3rem\)\]"/u,
  "Mobile shell panels must cap broken browser safe-area insets",
);

console.info("Agent catalog kind badge regressions passed.");
