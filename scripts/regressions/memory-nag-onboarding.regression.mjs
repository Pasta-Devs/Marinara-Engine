import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const drawer = readFileSync(join(repositoryRoot, "packages/client/src/components/chat/ChatSettingsDrawer.tsx"), "utf8");
const english = JSON.parse(
  readFileSync(join(repositoryRoot, "packages/client/src/localization/locales/en.json"), "utf8"),
);

function section(start, end) {
  const startIndex = drawer.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source section: ${start}`);
  const endIndex = drawer.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing source boundary: ${end}`);
  return drawer.slice(startIndex, endIndex);
}

function assertOrdered(source, needles, message) {
  let previousIndex = -1;
  for (const needle of needles) {
    const index = source.indexOf(needle, previousIndex + 1);
    assert.notEqual(index, -1, `${message}: missing ${needle}`);
    assert.ok(index > previousIndex, message);
    previousIndex = index;
  }
}

const reminder = section("const showMemoryNagSetupReminder", "  useEffect(() => {");
assert.match(reminder, /showAlertDialog\([\s\S]*memoryNagSetupOkay/u);
assert.equal(english["ui.chat.chatsettingsdrawer.memoryNagSetupOkay"], "Okay!");
assertOrdered(
  reminder,
  ["await showAlertDialog", "setChatSettingsSectionExpanded(targetId, true);", "scrollToAgentMenu(targetId);"],
  "Memory Nag navigation must happen after the reminder is confirmed",
);

const toggleAgent = section("const toggleAgent = async", "  const removeAgentFromMenu");
assert.match(
  toggleAgent,
  /if \(!isRemoving && agentId === "memory-nag" && isRoleplayMode\) \{\s*await showMemoryNagSetupReminder\(\);/u,
  "enabling Memory Nag directly must show the Roleplay-only setup reminder",
);
assertOrdered(
  toggleAgent,
  [
    "else await saveAgentSelection();",
    'agentId === "memory-nag" && isRoleplayMode',
    "await showMemoryNagSetupReminder();",
  ],
  "the direct activation reminder must follow the successful metadata save",
);

const confirmAddAgent = section("const confirmAddAgent = async", "  const ensureMusicDjAgent");
assert.match(
  confirmAddAgent,
  /if \(agent\.id === "memory-nag" && isRoleplayMode\) \{\s*await showMemoryNagSetupReminder\(\);/u,
  "the configured add flow must show the Roleplay-only Memory Nag reminder",
);
assertOrdered(
  confirmAddAgent,
  [
    "await updateMeta.mutateAsync({",
    'agent.id === "memory-nag" && isRoleplayMode',
    "await showMemoryNagSetupReminder();",
  ],
  "the configured activation reminder must follow the successful metadata save",
);

console.info("Memory Nag onboarding regression passed.");
