import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WORKSPACE_TOOL_DEFINITIONS } from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";

// #9325: the onboarding handbook told Mari to send `onboarding`, but the app_data schema had no such
// argument, so a careful model refused to write the block. Every top-level argument a handbook's
// example app_data command uses must exist in the schema she sees.
const appData = WORKSPACE_TOOL_DEFINITIONS.find((tool) => tool.name === "app_data");
assert.ok(appData, "app_data tool is defined");
const properties = (appData.parameters as { properties: Record<string, { type?: string }> }).properties;
assert.equal(properties.onboarding?.type, "object", "app_data offers an onboarding object argument");

const skillsDir = join(import.meta.dirname, "../../../packages/server/src/assets/mari-skills");
const missing: string[] = [];
let checked = 0;
for (const file of readdirSync(skillsDir).filter((name) => name.endsWith(".md"))) {
  for (const line of readFileSync(join(skillsDir, file), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{"action":')) continue;
    let command: Record<string, unknown>;
    try {
      command = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    checked += 1;
    for (const key of Object.keys(command)) {
      if (!(key in properties)) missing.push(`${file}: ${String(command.action)} uses "${key}"`);
    }
  }
}
assert.ok(checked > 0, "found example app_data commands in the handbooks");
assert.deepEqual(missing, [], "handbook examples use only arguments the app_data schema declares");

console.log(`app-data handbook arguments: ${checked} example commands match the schema`);
