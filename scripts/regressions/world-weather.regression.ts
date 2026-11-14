/**
 * Weather from the world's climate (user, 2026-11-13: "is weather reflected realistically in desert regions").
 *
 *   - The climate is read from the map where the party stands: mountains are colder than the valleys.
 *   - Over a year: a desert never snows and rarely rains, a cold land's winter snows, the tropics are wet.
 *   - The south has its summer in the north's winter, and the tropics have wet and dry seasons.
 *   - The weather drifts rather than flickering, and places a cell apart share their sky.
 *   - A weather asked for that the place cannot have now becomes the nearest it can.
 *   - A game with no map still reads its old biome, and the same inputs give the same weather.
 */
import assert from "node:assert/strict";

import {
  WORLD_STARTER_KITS,
  compileGameWorld,
  parseWorldKit,
  worldBriefSchema,
  worldClimateAt,
  worldClimateOfBiome,
  environmentHeldCells,
  environmentHeldPlaces,
  environmentHoldAt,
  environmentHoldNote,
  readEnvironmentHolds,
  worldDrawnSeason,
  worldGroundCells,
  worldGroundLooks,
  worldWeatherAt,
  worldWeatherFit,
  worldWeatherNote,
  type GameWorld,
  type WorldClimate,
} from "../../packages/shared/src/index.js";

const parsed = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsed.ok);
const inputs = {
  kit: parsed.kit,
  seed: 3,
  grounding: "expand" as const,
  brief: worldBriefSchema.parse({ briefVersion: 1, premise: "A quiet year.", places: [] }),
};
const game: GameWorld = { ...inputs, world: compileGameWorld(inputs) };

const WET = new Set(["rain", "heavy_rain", "storm", "snow", "blizzard", "hail"]);
function year(climate: WorldClimate, seed = 7) {
  const out: Record<
    string,
    { n: number; wet: number; snow: number; rain: number; temps: number[]; labels: Set<string> }
  > = {};
  for (let day = 1; day <= 360; day++)
    for (const hour of [3, 9, 15, 21]) {
      const w = worldWeatherAt({ seed, climate, day, hour });
      const calendar = ["spring", "summer", "autumn", "winter"][Math.floor((day - 1) / 90)]!;
      const s = (out[calendar] ??= { n: 0, wet: 0, snow: 0, rain: 0, temps: [], labels: new Set() });
      s.n++;
      if (WET.has(w.type)) s.wet++;
      if (w.type === "snow" || w.type === "blizzard") s.snow++;
      if (w.type === "rain" || w.type === "heavy_rain" || w.type === "storm") s.rain++;
      s.temps.push(w.temperature);
      s.labels.add(w.seasonLabel);
    }
  return out;
}
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

// ── The map's climate ──
const looks = worldGroundLooks(game);
const cells = worldGroundCells(game.world);
const temps: Record<string, number[]> = {};
let land = -1;
for (let cell = 0; cell < cells.length; cell++) {
  const look = looks[cells[cell]!]!;
  if (look === "sea" || look === "lake") continue;
  if (land < 0 && look === "grass") land = cell;
  (temps[look] ??= []).push(worldClimateAt(game, cell).meanTemp);
}
assert.ok(temps.mountains && temps.grass, "the realm has mountains and grass");
assert.ok(mean(temps.mountains) < mean(temps.grass) - 8, "the mountains are colder than the grass below");
assert.equal(worldDrawnSeason(game, 300), "winter", "a drawn realm is drawn in the calendar's season");

// ── A year of weather ──
const desert = year(worldClimateOfBiome("desert"));
for (const [season, s] of Object.entries(desert)) {
  assert.equal(s.snow, 0, `no snow in the desert in ${season}`);
  assert.ok(s.wet / s.n < 0.08, `the desert is dry in ${season}: ${s.wet}/${s.n}`);
}
const arctic = year(worldClimateOfBiome("arctic"));
assert.ok(arctic.winter!.snow / arctic.winter!.n > 0.05, "the arctic winter snows");
assert.equal(arctic.winter!.rain, 0, "and never rains");
const tropics = year(worldClimateOfBiome("tropical"));
assert.ok(
  Object.values(tropics).every((s) => s.snow === 0 && s.wet / s.n > 0.15),
  "the tropics are wet all year",
);
// A monsoon coast south of the equator: its summer in the north's winter, its wet season with it.
const south: WorldClimate = {
  zone: "savanna",
  latitude: -15,
  meanTemp: 25,
  swing: 3,
  wet: 0.6,
  metres: 50,
  coast: true,
  sandy: false,
  urban: false,
  km: { x: 0, y: 0 },
};
const southYear = year(south);
assert.ok(
  mean(southYear.winter!.temps) > mean(southYear.summer!.temps) + 2,
  "the south's summer is the north's winter",
);
assert.ok(southYear.winter!.labels.has("wet season") && southYear.summer!.labels.has("dry season"));
assert.ok(southYear.winter!.wet > southYear.summer!.wet * 3, "and its rains come then");

// ── Drift, not flicker; neighbours share a sky ──
{
  const climate = worldClimateAt(game, land);
  const neighbour = worldClimateAt(game, land + 1);
  let changes = 0;
  let agree = 0;
  let hours = 0;
  let previous: string | null = null;
  for (let day = 1; day <= 60; day++)
    for (let hour = 0; hour < 24; hour++) {
      const here = worldWeatherAt({ seed: 7, climate, day, hour }).type;
      if (previous !== null && previous !== here) changes++;
      if (worldWeatherAt({ seed: 7, climate: neighbour, day, hour }).type === here) agree++;
      previous = here;
      hours++;
    }
  assert.ok(changes / hours < 0.3, `the weather holds a while: ${changes} changes in ${hours} hours`);
  assert.ok(agree / hours > 0.8, `the next cell over has the same sky: ${agree}/${hours}`);
}

// ── Asking for a weather ──
{
  const midsummerNoon = (climate: WorldClimate) => ({ seed: 7, climate, day: 135, hour: 13 });
  const desertClimate = worldClimateOfBiome("desert");
  const snow = worldWeatherFit(midsummerNoon(desertClimate), "snow");
  assert.notEqual(snow.type, "snow", "no snow in a hot desert's summer");
  assert.equal(snow.asked, "snow");
  assert.equal(worldWeatherFit(midsummerNoon(desertClimate), "storm").type, "storm", "a rare desert storm can");
  assert.equal(worldWeatherFit(midsummerNoon(desertClimate), "sandstorm").type, "sandstorm");
  assert.equal(worldWeatherFit(midsummerNoon(worldClimateOfBiome("coastal")), "sandstorm").type, "wind");
  const arcticSnow = worldWeatherFit({ seed: 7, climate: worldClimateOfBiome("arctic"), day: 315, hour: 8 }, "snow");
  assert.equal(arcticSnow.type, "snow");
  assert.ok(arcticSnow.temperature <= 1, "falling snow is cold");
  assert.ok(
    ["storm", "heavy_rain", "rain"].includes(
      worldWeatherFit(midsummerNoon(worldClimateOfBiome("tropical")), "blizzard").type,
    ),
    "a blizzard asked for in the tropics is a downpour",
  );
  assert.match(worldWeatherNote(snow), /^Climate here: hot desert, summer\. Not possible here now: .*snow/);
}

// ── Determinism ──
{
  const input = { seed: 3, climate: worldClimateAt(game, land), day: 47, hour: 17.5 };
  assert.deepEqual(worldWeatherAt(input), worldWeatherAt(input), "the same every time");
  assert.equal(worldWeatherAt({ ...input, climate: worldClimateOfBiome("underground") }).type, "clear");
}

// ── Holds the Game Master puts on a place ──
{
  const holds = readEnvironmentHolds([
    'The Court seals the city. [environment: place="Gotham" light="dark" weather="rain" note="the Court\'s long night"]',
    'The year turns no further. [environment: place="Sallowmarch" season="autumn"]',
    '[environment: place="Ashby" weather="snow"] And later: [environment: place="Ashby" release]',
    '[environment: place="Gotham" weather="none"]',
  ]);
  assert.deepEqual(
    holds.map((hold) => [hold.place, hold.weather, hold.season, hold.light]),
    [
      ["Gotham", undefined, undefined, "dark"],
      ["Sallowmarch", undefined, "autumn", undefined],
    ],
    "set, let go part by part, and released",
  );
  const here = environmentHoldAt(holds, null, null, "Gotham, the Narrows");
  assert.equal(here.light, "dark", "a game with no map reads the place from the location");
  assert.match(environmentHoldNote(here), /Held here \(Gotham\), by the Court's long night: it is always night/);
  assert.equal(environmentHoldAt(holds, null, null, "Metropolis").light, undefined, "elsewhere is not held");

  // On a world: a place and every place inside it, the nearest hold deciding; "world" holds everything.
  const settlements = game.world.places.filter((place) => place.rank !== undefined && place.parentId);
  const town = settlements[0]!;
  const region = game.world.places.find((place) => place.id === town.parentId)!;
  const other = settlements.find((place) => place.parentId !== region.id && place.id !== region.id)!;
  const onWorld = readEnvironmentHolds([
    `[environment: place="${region.name}" season="winter" weather="blizzard"]`,
    `[environment: place="${town.name}" weather="clear" light="day"]`,
    `[environment: place="world" light="dusk"]`,
  ]);
  const atTown = environmentHoldAt(onWorld, game, town.id);
  assert.deepEqual(
    [atTown.weather, atTown.season, atTown.light],
    ["clear", "winter", "day"],
    "the nearest hold decides",
  );
  const atOther = environmentHoldAt(onWorld, game, other.id);
  assert.deepEqual([atOther.weather, atOther.season, atOther.light], [undefined, undefined, "dusk"]);
  assert.equal(environmentHeldPlaces(onWorld, game, "season")[town.id], "winter", "the town is inside the held region");
  const cells = environmentHeldCells(game, environmentHeldPlaces(onWorld, game, "light"));
  assert.ok(cells && cells.includes("day") && cells.includes("dusk"), "the overworld draws held light by cell");

  // A held weather beats the climate: snow in a summer desert, under a curse.
  const cursed = worldWeatherFit({ seed: 7, climate: worldClimateOfBiome("desert"), day: 135, hour: 13 }, "snow", true);
  assert.equal(cursed.type, "snow");
  assert.ok(cursed.temperature <= 1, "and it is cold enough for it");
}

console.log("world-weather regression passed");
