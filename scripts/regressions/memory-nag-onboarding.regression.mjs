import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const drawer = readFileSync(join(repositoryRoot, "packages/client/src/components/chat/ChatSettingsDrawer.tsx"), "utf8");

function section(start, end) {
  const startIndex = drawer.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source section: ${start}`);
  const endIndex = drawer.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing source boundary: ${end}`);
  return drawer.slice(startIndex, endIndex);
}

const reminder = section("const showMemoryNagSetupReminder", "  useEffect(() => {");
assert.match(reminder, /showAlertDialog\([\s\S]*memoryNagSetupOkay/u);
assert.match(reminder, /setChatSettingsSectionExpanded\(targetId, true\);/u);
assert.match(reminder, /scrollToAgentMenu\(targetId\);/u);

const toggleAgent = section("const toggleAgent = async", "  const removeAgentFromMenu");
assert.match(
  toggleAgent,
  /if \(!isRemoving && agentId === "memory-nag" && isRoleplayMode\) \{\s*await showMemoryNagSetupReminder\(\);/u,
  "enabling Memory Nag directly must show the Roleplay-only setup reminder",
);

const confirmAddAgent = section("const confirmAddAgent = async", "  const ensureMusicDjAgent");
assert.match(
  confirmAddAgent,
  /if \(agent\.id === "memory-nag" && isRoleplayMode\) \{\s*await showMemoryNagSetupReminder\(\);/u,
  "the configured add flow must show the Roleplay-only Memory Nag reminder",
);

console.info("Memory Nag onboarding regression passed.");
