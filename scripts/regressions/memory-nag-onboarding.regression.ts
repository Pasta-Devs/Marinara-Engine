import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const drawer = readFileSync(join(repositoryRoot, "packages/client/src/components/chat/ChatSettingsDrawer.tsx"), "utf8");

assert.match(
  drawer,
  /const showMemoryNagSetupReminder = useCallback[\s\S]*showAlertDialog\([\s\S]*memoryNagSetupOkay[\s\S]*setChatSettingsSectionExpanded\(targetId, true\);[\s\S]*scrollToAgentMenu\(targetId\);/u,
  "Memory Nag onboarding must confirm setup, expand its settings card, and scroll it into view",
);
assert.equal(
  (drawer.match(/(?:agentId|agent\.id) === "memory-nag" && isRoleplayMode/gu) ?? []).length,
  2,
  "Both Chat Settings add paths must show the Roleplay-only Memory Nag reminder",
);

console.info("Memory Nag onboarding regression passed.");
