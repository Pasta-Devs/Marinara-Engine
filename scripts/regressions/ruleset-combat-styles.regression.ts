/** Capability API 1.379: a ruleset names the combat styles its games may play (`combat.styles`). The
 *  list reads and is checked, the helpers allow, refuse and fall back as the docs say, the gate asks
 *  for 1.379, and the wizard, the settings, the game surface and the server all go through it. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUILT_IN_GAME_COMBAT_STYLES,
  parseRulesetDefinition,
  rulesetAllowsCombatStyle,
  rulesetCombatStyle,
  rulesetCombatStyles,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-combat-styles-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const baseText = readSource("docs/development/ruleset-5e-2014.example.json");
const fixture = (styles?: unknown) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  if (styles !== undefined) doc.combat.styles = styles;
  return doc;
};
const parse = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const issuesOf = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  return result.ok ? "" : result.issues.join("; ");
};

try {
  assert.ok(supportedCapabilityApi.minor >= 379);

  // ── The list ──
  const open = parse(fixture());
  const tactical = parse(fixture(["tactical"]));
  const registered = parse(fixture(["hex-board", "tactical"]));
  assert.equal(open.combat?.styles, undefined);
  assert.deepEqual(tactical.combat?.styles, ["tactical"]);
  assert.match(issuesOf(fixture(["tactical", "tactical"])), /Duplicate combat style "tactical"/);
  assert.notEqual(issuesOf(fixture([])), "", "an empty list says nothing and is refused");
  assert.equal(
    issuesOf(fixture(["classic", "Tactical"])),
    "combat.styles.1: Invalid string: must match pattern /^[a-z][a-z0-9_-]{0,47}$/",
    "only the lower-case ID check fails",
  );
  assert.match(
    issuesOf(fixture(["hex-board"])),
    /List classic or tactical too/,
    "a list of registered styles only could leave a client with nothing it may draw",
  );
  const eightStyles = ["classic", ...Array.from({ length: 7 }, (_, index) => `style-${index}`)];
  assert.deepEqual(parse(fixture(eightStyles)).combat?.styles, eightStyles, "exactly eight styles are accepted");
  assert.equal(
    issuesOf(fixture([...eightStyles, "style-7"])),
    "combat.styles: Too big: expected array to have <=8 items",
    "only the nine-item length check fails",
  );

  // The published JSON Schema says what the refinement does: each style once, one of them built in.
  const findCombatStyles = (node: unknown): Record<string, unknown> | undefined => {
    if (!node || typeof node !== "object") return undefined;
    const properties = (node as { properties?: Record<string, Record<string, unknown>> }).properties;
    if (properties?.styles && properties.distance) return properties.styles;
    for (const child of Object.values(node)) {
      const found = findCombatStyles(child);
      if (found) return found;
    }
    return undefined;
  };
  const publishedStyles = findCombatStyles(JSON.parse(readSource("docs/extending/ruleset.schema.json")));
  assert.equal(publishedStyles?.uniqueItems, true);
  assert.deepEqual(publishedStyles?.contains, { enum: [...BUILT_IN_GAME_COMBAT_STYLES] });

  // ── The helpers ──
  assert.equal(rulesetCombatStyles(open), null, "no list allows every style");
  assert.equal(rulesetCombatStyles(null), null);
  assert.equal(rulesetAllowsCombatStyle(open, "classic"), true);
  assert.equal(rulesetAllowsCombatStyle(tactical, "tactical"), true);
  assert.equal(rulesetAllowsCombatStyle(tactical, "classic"), false);
  assert.equal(rulesetAllowsCombatStyle(tactical, undefined), false, "a game that names no style plays classic");
  assert.equal(rulesetCombatStyle(open, "classic"), "classic");
  assert.equal(rulesetCombatStyle(open, undefined), "classic");
  assert.equal(rulesetCombatStyle(null, "hex-board"), "hex-board", "no ruleset leaves the pick alone");
  assert.equal(rulesetCombatStyle(tactical, "classic"), "tactical", "a style left out plays the first listed");
  assert.equal(rulesetCombatStyle(tactical, null), "tactical");
  assert.equal(rulesetCombatStyle(registered, "classic"), "hex-board");
  assert.equal(
    rulesetCombatStyle(registered, "classic", ["classic", "tactical"]),
    "tactical",
    "a client without the registered style plays the first listed one it has",
  );
  assert.equal(
    rulesetCombatStyle(registered, "classic", ["classic"]),
    "tactical",
    "a client that has no listed style it registered plays the first built-in one listed, never classic",
  );
  // Whatever a client has registered, the style it plays is one the ruleset lists and one it can draw.
  for (const known of [["classic", "tactical"], ["classic", "tactical", "hex-board"], ["classic"]]) {
    for (const saved of ["classic", "tactical", "hex-board", undefined]) {
      const played = rulesetCombatStyle(registered, saved, known);
      assert.ok(registered.combat!.styles!.includes(played), `${saved} on ${known} plays a listed style`);
      assert.ok(known.includes(played) || played === "tactical", `${saved} on ${known} plays a style the client draws`);
    }
  }

  // ── The gate ──
  const gate = /capabilityApi 1\.379 or newer/;
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    id: "fivee",
    name: "5e",
    version: "1.0.0",
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const issueAt = (minor: number, doc: unknown) =>
    getCapabilityPackageInstallIssue(manifest(minor) as never, doc as never, undefined as never) ?? "";
  assert.doesNotMatch(issueAt(378, fixture()), gate, "the example asks for nothing new");
  assert.match(issueAt(378, fixture(["tactical"])), gate);
  assert.doesNotMatch(issueAt(778, fixture(["tactical"])), gate);

  // ── Where it is read ──
  const wizard = readSource("packages/client/src/components/game/GameSetupWizard.tsx");
  assert.match(wizard, /rulesetCombatStyle\(activeRuleset\?\.definition, pickedCombatStyle, listCombatStyles\(\)\)/);
  assert.match(wizard, /\(!combatStyles \|\| combatStyles\.includes\("classic"\)\) && \(/);
  assert.match(wizard, /\(!combatStyles \|\| combatStyles\.includes\("tactical"\)\) && \(/);
  const section = readSource("packages/client/src/features/chat-settings/sections/CombatStyleSection.tsx");
  assert.match(section, /offered\("classic"\) && \(/);
  assert.match(section, /offered\("tactical"\) && \(/);
  assert.match(section, /!isBuiltInCombatStyle\(id\) && offered\(id\)/);
  const drawer = readSource("packages/client/src/components/chat/ChatSettingsDrawer.tsx");
  assert.match(drawer, /allowedStyles=\{allowedCombatStyles\}/);
  assert.match(drawer, /rulesetCombatStyle\(\s+rulesetDefinition,[\s\S]{0,200}listCombatStyles\(\),/);
  const surface = readSource("packages/client/src/components/game/GameSurface.tsx");
  assert.match(
    surface,
    /combatPinnedStyle \?\?\s+rulesetCombatStyle\(/,
    "the game surface plays a ruleset's style unless the fight pinned one",
  );
  assert.match(surface, /rulesetFightDefinition\?\.combat\?\.distance && effectiveCombatStyle === "tactical"/);
  const gameRoutes = readSource("packages/server/src/routes/game.routes.ts");
  assert.match(
    gameRoutes,
    /rulesetAllowsCombatStyle\(registered\.definition, parsedCreateGameInput\.setupConfig\.combatStyle\)/,
  );
  assert.match(gameRoutes, /code: "combat_style_not_allowed"/);
  const chatRoutes = readSource("packages/server/src/routes/chats.routes.ts");
  assert.match(
    chatRoutes,
    /!rulesetAllowsCombatStyle\(resolved\.definition, next\.gameCombatStyle as string \| null \| undefined\)/,
  );
  assert.equal(chatRoutes.match(/code: "combat_style_not_allowed"/g)?.length, 1, "the settings refusal names its code");
  const encounterRoutes = readSource("packages/server/src/routes/encounter.routes.ts");
  assert.match(encounterRoutes, /const combatStyle = rulesetCombatStyle\(/);
  const prompt = readSource("packages/server/src/services/generation/game-gm-prompt-runtime.ts");
  assert.match(prompt, /rulesetCombatStyle\(\s+args\.ruleset,/);

  console.log("Ruleset combat styles: the list, the fallbacks, the gate, the wizard, settings, surface and server.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
