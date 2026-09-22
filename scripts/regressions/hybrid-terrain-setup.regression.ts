import assert from "node:assert/strict";
import type { GameSetupConfig } from "../../packages/shared/src/types/game.js";
import { i18n } from "../../packages/client/src/localization/i18n.js";
import {
  buildGameSetupShareFile,
  buildGameSetupSummarySections,
  parseGameSetupShareFileJson,
  resolveGameSetupImport,
} from "../../packages/client/src/lib/game-setup-share.js";

const config: GameSetupConfig = {
  genre: "Fantasy",
  setting: "A ruined river crossing",
  tone: "Adventure",
  difficulty: "normal",
  playerGoals: "Reach the far shore",
  gmMode: "standalone",
  rating: "sfw",
  combatStyle: "tactical",
  partyCharacterIds: [],
  tacticalBattlefield: { seed: 0, size: "large", instructions: "Ruined walls flank a forest clearing." },
};
const source = { gameName: "Terrain round trip", config };
const shared = buildGameSetupShareFile(source, "2026-09-16T00:00:00.000Z");
const imported = parseGameSetupShareFileJson(JSON.stringify(shared));
assert.deepEqual(imported.setup.config.tacticalBattlefield, { size: "large" });
i18n.addResourceBundle("en", "translation", {
  "ui.game.gamesetupsummary.auto": "Localized automatic battlefield",
  "ui.game.gamesetupsummary.sizeLarge": "Localized large battlefield",
  "ui.game.gamesetupsummary.sizeMedium": "Localized medium battlefield",
});
const summary = buildGameSetupSummarySections(source).flatMap((section) => section.rows);
assert.ok(!summary.some((row) => String(row.value) === "0"), "Obsolete battlefield seed is absent from the summary");
assert.ok(
  summary.some((row) => row.value === "Localized large battlefield"),
  "The reusable summary uses the localized size label",
);
assert.ok(
  !summary.some((row) => String(row.value).includes("forest clearing")),
  "Retired creation-time guidance is not advertised as an active setting.",
);

for (const [size, expectedLabel] of [
  [undefined, "Localized automatic battlefield"],
  ["oversized", "Localized medium battlefield"],
  ["toString", "Localized medium battlefield"],
] as const) {
  const savedConfig = { ...config, tacticalBattlefield: { size } } as unknown as GameSetupConfig;
  assert.ok(
    buildGameSetupSummarySections({ ...source, config: savedConfig })
      .flatMap((section) => section.rows)
      .some((row) => row.value === expectedLabel),
    "Older malformed size values retain a readable localized summary",
  );
}

for (const tacticalBattlefield of [
  { seed: -1 },
  { seed: 1.5 },
  { seed: 4294967296 },
  { seed: "0" },
  { size: "huge" },
  { size: ["small"] },
  { instructions: 42 },
  { instructions: "x".repeat(10001) },
  [],
]) {
  assert.throws(
    () =>
      parseGameSetupShareFileJson(
        JSON.stringify({ ...shared, setup: { ...shared.setup, config: { ...config, tacticalBattlefield } } }),
      ),
    `Malformed imported battlefield options must be refused: ${JSON.stringify(tacticalBattlefield).slice(0, 80)}`,
  );
}

const legacy = structuredClone(shared);
delete legacy.setup.config.tacticalBattlefield;
assert.equal(parseGameSetupShareFileJson(JSON.stringify(legacy)).setup.config.tacticalBattlefield, undefined);
const importContext = { characters: [], connections: [], lorebooks: [], personas: [], promptPresets: [] };
const padded = structuredClone(shared);
padded.setup.config.tacticalBattlefield = { seed: 0, instructions: "  Ruins beside the forest.  " };
assert.equal(resolveGameSetupImport(padded, importContext).config.tacticalBattlefield, undefined);
padded.setup.config.tacticalBattlefield = { instructions: "   " };
assert.equal(resolveGameSetupImport(padded, importContext).config.tacticalBattlefield, undefined);
padded.setup.config.tacticalBattlefield = { seed: 0 };
padded.setup.config.combatStyle = "classic";
assert.equal(resolveGameSetupImport(padded, importContext).config.tacticalBattlefield, undefined);
console.info(
  "Hybrid tactical setup preserves size and retires seed and guidance; invalid imports fail and legacy setups load.",
);
