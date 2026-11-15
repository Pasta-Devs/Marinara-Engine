/** Full GM rules reference (Capability API 1.145): validation, caching, context fit and install gate. */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  capabilityPackageManifestSchema,
  parseRulesetDefinition,
  rulesetEffectiveDefinitionSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

mkdirSync(new URL("../../../.tmp/", import.meta.url), { recursive: true });
const dataDir = mkdtempSync(new URL("../../../.tmp/gm-reference-", import.meta.url));
const previous = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const document = () =>
  JSON.parse(readFileSync(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"));
const parsed = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};

try {
  const { buildGmSystemPrompt, buildGmFormatReminder } =
    await import("../../../packages/server/src/services/game/gm-prompts.js");
  const { injectGameGmPromptRuntime } =
    await import("../../../packages/server/src/services/generation/game-gm-prompt-runtime.js");
  const { fitMessagesToContext, estimateMessagesTokens } =
    await import("../../../packages/server/src/services/llm/base-provider.js");
  const { getCapabilityPackageInstallIssue } =
    await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

  const doc = document();
  doc.gmReference = "Journey rules: supplies shelter exposure. ".repeat(400).slice(0, 16000);
  assert.equal(doc.gmReference.length, 16000);
  const ruleset = parsed(doc);
  assert.equal(ruleset.gmReference, doc.gmReference);
  assert.equal(rulesetEffectiveDefinitionSchema.parse(ruleset).gmReference, doc.gmReference);
  assert.equal(parseRulesetDefinition({ ...doc, gmReference: `${doc.gmReference}x` }).ok, false);
  for (const bad of [
    "",
    42,
    null,
    "line\nbreak",
    "line\rbreak",
    "line\u0085break",
    "line\u2028break",
    "line\u2029break",
    "control\u0000",
    "control\t",
    "control\u007f",
    "[skill_check: skill=Heart]",
    "closing ]",
    "{{macro}}",
    "closing }}",
  ]) {
    assert.equal(parseRulesetDefinition({ ...doc, gmReference: bad }).ok, false, JSON.stringify(bad));
  }
  assert.equal(
    parsed({ ...doc, gmReference: "Rules with <tags> & ordinary {braces}." }).gmReference,
    "Rules with <tags> & ordinary {braces}.",
  );
  for (const key of ["checkGuidance", "sheetGuidance", "worldGuidance"]) {
    const candidate = document();
    candidate.gm[key] = "x".repeat(1500);
    assert.equal(parseRulesetDefinition(candidate).ok, true, key);
    candidate.gm[key] += "x";
    assert.equal(parseRulesetDefinition(candidate).ok, false, key);
  }

  const ctx = {
    gameActiveState: "exploration" as const,
    storyArc: null,
    plotTwists: null,
    map: null,
    npcs: [],
    sessionSummaries: [],
    sessionNumber: 1,
    partyNames: [],
    playerName: "Kit",
    gmCharacterCard: null,
    difficulty: "normal",
    genre: "fantasy",
    setting: "original",
    tone: "balanced",
  };
  const system = buildGmSystemPrompt({ ...ctx, ruleset });
  assert.equal(system.split(ruleset.gmReference!).length - 1, 1);
  assert.match(system, /Game Master rules reference/);
  assert.ok(system.indexOf(ruleset.gm.checkGuidance) < system.indexOf(ruleset.gmReference!));
  if (ruleset.gm.sheetGuidance) {
    assert.ok(system.indexOf(ruleset.gm.sheetGuidance) < system.indexOf(ruleset.gmReference!));
  }
  const legacy = parsed(document());
  assert.equal("gmReference" in legacy, false);
  const legacySystem = buildGmSystemPrompt({ ...ctx, ruleset: legacy });
  assert.equal(legacySystem, buildGmSystemPrompt(ctx), "an unset reference keeps the system prompt byte for byte");
  assert.doesNotMatch(legacySystem, /ruleset_gm_reference|Game Master rules reference/);
  const reminder = buildGmFormatReminder({ ...ctx, ruleset, rulesetSheetBlocks: ["Kit: Grit 6"] });
  assert.equal(reminder, buildGmFormatReminder({ ...ctx, ruleset: legacy, rulesetSheetBlocks: ["Kit: Grit 6"] }));
  assert.equal(reminder.includes(ruleset.gmReference!), false);
  assert.doesNotMatch(reminder, /ruleset_gm_reference|Game Master rules reference/);

  const runtimeSystem = async (definition?: RulesetDefinition) => {
    const messages = [{ role: "system" as const, content: "placeholder" }];
    await injectGameGmPromptRuntime({
      messages,
      chatId: "gm-reference-regression",
      chat: {},
      chatMetadata: {},
      world: null,
      ruleset: definition,
      characterIds: [],
      chars: { getById: async () => null, getPersona: async () => null },
      chats: { getById: async () => null, updateMetadata: async () => undefined },
      selectedGameStateSnapshotPromise: Promise.resolve(null),
      mappedMessages: [],
      personaName: "Kit",
      resolvePromptMacros: (value) => value,
    });
    return messages[0]!.content;
  };
  assert.equal((await runtimeSystem(ruleset)).split(ruleset.gmReference!).length - 1, 1);
  assert.equal(await runtimeSystem(legacy), await runtimeSystem());
  const route = readFileSync(new URL("../../../packages/server/src/routes/generate.routes.ts", import.meta.url), "utf8");
  assert.match(
    route,
    /injectGameGmPromptRuntime\(\{[\s\S]*?ruleset: pinnedGameRuleset\?\.status === "ok" \? pinnedGameRuleset\.definition : undefined/u,
  );

  const messages = [{ role: "system" as const, content: system }];
  const uncapped = fitMessagesToContext(messages, {});
  assert.equal(uncapped.estimatedTokensBefore, estimateMessagesTokens(messages));
  assert.equal(uncapped.messages[0]!.content, system);
  const withoutReference = system.replace(ruleset.gmReference!, "");
  const capped = fitMessagesToContext(messages, {
    maxContext: estimateMessagesTokens([{ role: "system", content: withoutReference }]) + 1000,
    maxTokens: 128,
  });
  assert.equal(capped.trimmed, true);
  assert.ok(capped.estimatedTokensAfter <= capped.inputBudget!);
  const cut = capped.messages[0]!.content;
  assert.match(cut, /GM rules reference cut for context limit/);
  assert.equal(
    cut.replace(/(<ruleset_gm_reference>\nGame Master rules reference\n)[^\r\n]*(\n<\/ruleset_gm_reference>)/u, "$1$2"),
    withoutReference,
    "only the reference is shortened when the rest fits",
  );
  assert.equal(messages[0]!.content, system, "context fitting leaves the cached source intact");

  const manifest = (minor: number) =>
    capabilityPackageManifestSchema.parse({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-gm-reference",
      name: "GM reference",
      version: "0.1.0",
      description: "A ruleset with a full GM rules reference.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 20000 }],
      permissions: [],
      restartRequired: false,
    });
  assert.ok(supportedCapabilityApi.minor >= 145);
  assert.match(getCapabilityPackageInstallIssue(manifest(144), doc) ?? "", /capabilityApi 1\.145/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(145), doc), null);
  assert.equal(getCapabilityPackageInstallIssue(manifest(144), document()), null);
  const { capabilityApi: _api, builtAgainst: _build, ...v1 } = manifest(145);
  assert.match(
    getCapabilityPackageInstallIssue({ ...v1, schemaVersion: 1 }, { gmReference: doc.gmReference }) ?? "",
    /schemaVersion 2 and capabilityApi 1\.145/,
  );
  console.log("game-ruleset-gm-reference regression passed");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  for (const key of ["DATA_DIR", "FILE_STORAGE_DIR"] as const) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}
