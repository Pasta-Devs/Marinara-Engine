/** A party's health widget, updated by the Game Master by each member's bare name (laptop playtest
 *  2026-10-25): the row "Aldric HP" the setup wrote is the one "Aldric" updates, not a second row
 *  beside it, and "44/44" keeps its maximum. A name that could be either of two rows is a new row. */
import assert from "node:assert/strict";
import { parseGmTags } from "../../packages/shared/src/utils/game-tag-parser.js";
import { applyGameWidgetUpdate } from "../../packages/shared/src/utils/game-widget-update.js";
import type { HudWidget } from "../../packages/shared/src/types/game.js";

const widgets = [
  {
    id: "party_hp",
    type: "stat_block",
    label: "Party Health",
    config: {
      stats: [
        { name: "Aldric HP", value: "36/36" },
        { name: "Kesh HP", value: "33/33" },
        { name: "Vyre HP", value: "26/26" },
        { name: "Vyre MP", value: "10/10" },
      ],
    },
  },
] as unknown as HudWidget[];
const apply = (tag: string, on: HudWidget[] = widgets) =>
  parseGmTags(tag).widgetUpdates.reduce((all, update) => applyGameWidgetUpdate(all, update), on);

const updated = apply('[widget: party_hp, stat: "Aldric", value: "44/44"]');
assert.deepEqual(
  (updated[0]!.config.stats as Array<{ name: string; value: unknown }>).map((stat) => [stat.name, stat.value]),
  [
    ["Aldric HP", "44/44"],
    ["Kesh HP", "33/33"],
    ["Vyre HP", "26/26"],
    ["Vyre MP", "10/10"],
  ],
);
// Two rows it could be: a row of its own, as before.
assert.equal((apply('[widget: party_hp, stat: "Vyre", value: 20]')[0]!.config.stats as unknown[]).length, 5);
// A plain number is still a number.
assert.equal(parseGmTags('[widget: party_hp, stat: "Kesh HP", value: 12]').widgetUpdates[0]!.changes.value, 12);
console.log("Party widget rows: a bare name updates its one row, and a/b values keep their maximum.");
