import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  hasVisibleGameNarrationText,
  parseGmTags,
  parseSegmentInventoryUpdates,
  stripGmTags,
} from "../../packages/shared/src/utils/game-tag-parser.js";
import { applyGameWidgetUpdate } from "../../packages/shared/src/utils/game-widget-update.js";
import type { HudWidget } from "../../packages/shared/src/types/game.js";

const media = parseGmTags("Before [MUSIC:\t calm ] [music: later] [SFX: step] [sfx: \t] [sfx:door] after");
assert.equal(media.music, "calm", "the first nonempty media-tag body still selects the music");
assert.deepEqual(media.sfx, ["step", "", "door"]);
assert.equal(media.cleanContent, "Before      after");
assert.equal(parseGmTags("[music:][music: next]").music, "next");
assert.equal(parseGmTags("[music: \t]").music, "");
assert.equal(parseGmTags("[sfx:][sfx: next]").sfx[0], "next");
assert.equal(parseGmTags("İ [music: calm] [sfx: step]").cleanContent, "İ");
const backdrop = parseGmTags("Before [bg: harbor] [bg: later] [ambient: wind] [ambient: rain] after");
assert.equal(backdrop.background, "harbor");
assert.equal(backdrop.ambient, "wind");
const cinematic = parseGmTags(
  '[direction: screen_shake, duration: 2, intensity: 0.7] [widget: health, stat: "HP", value: 9]',
);
assert.deepEqual(cinematic.directions, [{ effect: "screen_shake", duration: 2, intensity: 0.7 }]);
assert.deepEqual(cinematic.widgetUpdates, [{ widgetId: "health", changes: { statName: "HP", value: 9 } }]);
const encounter = parseGmTags("Before [combat: Goblin:2] after [qte: Jump, timer: 5s]");
assert.equal(encounter.combatEncounter?.enemies[0]?.name, "Goblin");
assert.equal(encounter.qte, null);
assert.equal(encounter.cleanContent, "Before");
for (const opening of ["[qte: Jump | Duck, timer: 5s]", "[qte:\n Jump | Duck,\n timer: 5s]"]) {
  const quick = parseGmTags(`Before ${opening} after [combat: Goblin]`);
  assert.deepEqual(quick.qte, { actions: ["Jump", "Duck"], timer: 5 });
  assert.equal(quick.combatEncounter, null);
  assert.equal(quick.cleanContent, "Before");
}
assert.equal(parseGmTags("[qte: Bad\nBody, timer: 5s]").qte, null);
assert.deepEqual(parseGmTags("[qte: Bad [qte:\n Jump, timer: 5s]").qte, { actions: ["Jump"], timer: 5 });
assert.equal(stripGmTags("İ [COMBAT_RESULT]private[/combat_result] end"), "İ  end");
assert.equal(stripGmTags("A [COMBAT_RESULT]one[/combat_result] B [combat_result]two[/COMBAT_RESULT] C"), "A  B  C");
assert.equal(stripGmTags("Before [combat_result]unfinished"), "Before [combat_result]unfinished");
const inventory = '[inventory: action="add" item="Map" count="1" result="ok" now="1"]';
assert.deepEqual(
  parseSegmentInventoryUpdates(
    `[combat_result]Hidden ${inventory}[/combat_result]\n[Music: calm]Found it. ${inventory}`,
  ).map(({ segment, update }) => [segment, update.item]),
  [[0, "Map"]],
);

for (const [content, visible] of [
  [" \n\t", false],
  ["{shake: } {GLOW:\n\t}", false],
  ["{glow:}", true],
  ["{unknown: }", true],
  ["{glow:unfinished", true],
  ["{drip:{glow: }}", true],
  ["{glow:visible}", true],
] as const)
  assert.equal(hasVisibleGameNarrationText(content), visible, content);

const list = (items: string[]): HudWidget[] => [
  { id: "notes", type: "list", label: "Notes", position: "hud_left", config: { items } },
];
assert.deepEqual(
  applyGameWidgetUpdate(list(["'Find   the key!'", "Other"]), {
    widgetId: "notes",
    changes: { add: '"find the key"' },
  })[0]?.config.items,
  ["Other", '"find the key"'],
);
assert.deepEqual(
  applyGameWidgetUpdate(list(["Find key", "Other"]), {
    widgetId: "notes",
    changes: { remove: "'FIND KEY!!!'" },
  })[0]?.config.items,
  ["Other"],
);

// Each case previously retried a long suffix for every opener, whitespace split or quote.
// Generous wall-clock ceilings catch the polynomial behavior without timing normal small input.
const bounded = (name: string, run: () => void) => {
  const started = performance.now();
  run();
  assert.ok(performance.now() - started < 2_000, `${name} must finish without polynomial rescanning`);
};
const recap = "[combat_result]".repeat(20_000);
bounded("unclosed combat recaps", () => {
  assert.equal(stripGmTags(recap), recap);
  assert.deepEqual(parseSegmentInventoryUpdates(recap), []);
});
for (const tag of [
  "music",
  "sfx",
  "bg",
  "ambient",
  "qte",
  "combat",
  "direction",
  "widget",
  "skill_check",
  "status",
  "inventory",
  "party_change",
  "party_add",
  "session_end",
  "dice",
] as const) {
  const input = `[${tag}:${"\t".repeat(100_000)}`;
  bounded(`unclosed ${tag} with whitespace`, () => {
    assert.equal(parseGmTags(input).cleanContent, `[${tag}:`);
    assert.equal(stripGmTags(input), `[${tag}:`);
    assert.deepEqual(parseSegmentInventoryUpdates(input), []);
  });
}
bounded("repeated unclosed flat tags", () => {
  const input = "[bg:[ambient:[widget:".repeat(20_000);
  assert.equal(stripGmTags(input), input);
  assert.equal(parseGmTags(input).cleanContent, input);
});
bounded("QTE prefixes before a newline and timer", () => {
  const input = "[qte:invalid ".repeat(20_000) + "\n action, timer: 5s]";
  assert.equal(parseGmTags(input).qte, null);
});
for (const suffix of ["timer: nope]", "timer: 5s]"]) {
  bounded("QTE repeated commas and whitespace", () => {
    const input = "[qte:Jump" + ",\t".repeat(50_000) + suffix;
    assert.equal(parseGmTags(input).qte?.timer ?? null, suffix === "timer: 5s]" ? 5 : null);
  });
}
bounded("unclosed narration effects", () => {
  assert.equal(hasVisibleGameNarrationText("{{glow:" + "{{drip:|".repeat(20_000)), true);
});
for (const character of ['"', "!"]) {
  const item = `a${character.repeat(100_000)}z`;
  bounded("widget suffix normalization", () => {
    assert.deepEqual(
      applyGameWidgetUpdate(list([item]), { widgetId: "notes", changes: { add: item } })[0]?.config.items,
      [item],
    );
  });
}
process.stdout.write("Shared Game parser normal behavior and malformed-input runtime bounds passed.\n");
