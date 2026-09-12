import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  getAgentRunIntervalMeta,
  parseCadenceInputValue,
  stepCadenceValue,
} from "../../packages/client/src/lib/agent-cadence.js";
import { shouldSkipAgentByMessageInterval } from "../../packages/server/src/services/generation/agent-cadence.js";

const illustrator = getAgentRunIntervalMeta("illustrator")!;
assert.equal(illustrator.min, 0, "Illustrator setup must offer manual-only cadence");
assert.equal(illustrator.defaultValue, 5, "automatic cadence remains the default");
assert.equal(parseCadenceInputValue("0", 5, 100, illustrator.min), 0);
assert.equal(parseCadenceInputValue("-1", 5, 100, illustrator.min), 0);
assert.equal(parseCadenceInputValue("101", 5, 100, illustrator.min), 100);
assert.equal(parseCadenceInputValue("", 5, 100, illustrator.min), 5);
assert.equal(parseCadenceInputValue("0", 8, 100), 1, "other agents keep their positive minimum");
assert.equal(stepCadenceValue(1, -1, 100, illustrator.min), 0, "Illustrator arrows reach manual-only cadence");
assert.equal(stepCadenceValue(0, -1, 100, illustrator.min), 0);
assert.equal(stepCadenceValue(1, -1, 100), 1, "other agents retain their positive stepping minimum");
assert.equal(getAgentRunIntervalMeta("lorebook-keeper")?.min ?? 1, 1);
assert.equal(getAgentRunIntervalMeta("custom", false)?.min ?? 1, 1);

let historyReads = 0;
const agentsStore = {
  async getLastSuccessfulRunByType() {
    historyReads++;
    return null;
  },
};
const base = { agentsStore, chatId: "manual-only", agentType: "illustrator", fallbackInterval: 5, messages: [] };
for (const value of [0, "0"]) {
  assert.equal(await shouldSkipAgentByMessageInterval({ ...base, settings: { runInterval: value } }), true);
}
assert.equal(historyReads, 0, "manual-only must skip even before the first successful run");
for (const value of [undefined, null, "", false, -1, "invalid", 1, 5]) {
  assert.equal(
    await shouldSkipAgentByMessageInterval({ ...base, settings: { runInterval: value } }),
    false,
    `invalid or automatic cadence ${String(value)} must not become manual-only`,
  );
}
assert.equal(
  await shouldSkipAgentByMessageInterval({ ...base, agentType: "lorebook-keeper", settings: { runInterval: 0 } }),
  false,
  "zero must not disable unrelated agents",
);
assert.equal(
  await shouldSkipAgentByMessageInterval({
    ...base,
    agentsStore: {
      async getLastSuccessfulRunByType() {
        return { messageId: "prior" };
      },
    },
    settings: { runInterval: 5 },
    messages: [
      { id: "prior", role: "assistant" },
      { id: "new", role: "user" },
    ],
  }),
  true,
  "ordinary interval gating remains intact",
);

// Persona and character turns share the same interval, irrespective of recipient visibility.
const mixedHistory = [
  { id: "checkpoint", role: "assistant" },
  { id: "persona", role: "user", personaId: "mari" },
  { id: "character", role: "assistant", characterId: "dottore", extra: { hiddenFromAICharacterIds: ["narrator"] } },
];
const mixedCadence = {
  ...base,
  agentsStore: {
    async getLastSuccessfulRunByType() {
      return { messageId: "checkpoint" };
    },
  },
  settings: { runInterval: 3 },
};
assert.equal(await shouldSkipAgentByMessageInterval({ ...mixedCadence, messages: mixedHistory.slice(0, 2) }), true);
assert.equal(await shouldSkipAgentByMessageInterval({ ...mixedCadence, messages: mixedHistory }), false);

// Run the production formatter without booting browser hooks in Node.
const hookSource = readFileSync(new URL("../../packages/client/src/hooks/use-generate.ts", import.meta.url), "utf8");
const sourceFile = ts.createSourceFile("use-generate.ts", hookSource, ts.ScriptTarget.Latest, true);
const formatter = sourceFile.statements.find(
  (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "formatAgentBubble",
);
assert.ok(formatter);
const compiled = ts.transpileModule(formatter.getText(sourceFile), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const english = JSON.parse(
  readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
);
const bubble = new Function("translate", `${compiled}; return formatAgentBubble;`)((key: string) => english[key]);
assert.equal(
  bubble("illustrator", "Illustrator", { shouldGenerate: false, reason: "The scene has not changed." }),
  "🎨 No illustration requested this time — The scene has not changed.",
);
assert.equal(
  bubble("illustrator", "Illustrator", { shouldGenerate: true, prompt: "The laboratory." }),
  "🎨 Illustration requested",
);
assert.equal(
  bubble("illustrator", "Illustrator", { generated: true, chosen: "scene.png" }),
  "🎨 Scene background generated",
);
for (const data of [{}, { shouldGenerate: true, prompt: " " }, { shouldGenerate: "true", prompt: "The laboratory." }]) {
  assert.equal(
    bubble("illustrator", "Illustrator", data),
    "🎨 Illustrator returned no usable image decision or prompt",
  );
}

const manualRoute = readFileSync(
  new URL("../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
  "utf8",
);
assert.ok(manualRoute.includes("isManualIllustratorImageRequest"));
assert.ok(!manualRoute.includes("shouldSkipAgentByMessageInterval"), "manual generation must bypass cadence");
console.info("Illustrator manual-only cadence regressions passed");
