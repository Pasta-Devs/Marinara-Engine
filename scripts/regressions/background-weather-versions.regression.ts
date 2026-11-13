// Weather versions of chat backgrounds (Nov 2026): the same room repainted in the story's weather, made once
// per picture and weather, and no full-screen weather while the story is indoors.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "bg-weather-"));
process.env.DATA_DIR = dataDir;
const bgDir = join(dataDir, "backgrounds");
mkdirSync(bgDir, { recursive: true });

const shared = await import("../../packages/shared/src/utils/scene-weather.js");
const { paintedWeatherRenderConfig, resolveWeatherRenderConfig, shelterWeatherRenderConfig } =
  await import("../../packages/client/src/lib/weather-renderer.js");
const { planChatBackgroundWeather, chatBackgroundPlainPicture, isChatBackgroundWeatherVersion } =
  await import("../../packages/server/src/services/game/game-asset-generation.js");

// ── Weather words ──
assert.equal(shared.sceneWeatherCategory("Heavy thunderstorm"), "storm");
assert.equal(shared.sceneWeatherCategory("light rain"), "rain");
assert.equal(shared.sceneWeatherCategory("Overcast"), "cloudy");
assert.equal(shared.sceneWeatherCategory(""), "");
assert.equal(shared.backgroundWeatherVersion("drizzle and rain"), "rain");
assert.equal(shared.backgroundWeatherVersion("Sunny"), "");
assert.equal(shared.backgroundWeatherVersion("windy"), "", "wind keeps the plain picture");
// The weather drawing reports the same words as before for themes.
assert.equal(resolveWeatherRenderConfig("blizzard", "noon").category, "snow");
assert.equal(resolveWeatherRenderConfig("cherry blossoms drifting", "noon").category, "blossom");

// ── Indoors / outdoors ──
assert.equal(shared.sceneShelter("Tideglass Inn, Brinewatch"), "indoors");
assert.equal(shared.sceneShelter("Brinewatch harbour docks"), "outdoors");
assert.equal(shared.sceneShelter("Palace gardens"), "outdoors", "an open-air part of a place wins");
assert.equal(shared.sceneShelter("Lyra's bedroom"), "indoors");
assert.equal(shared.sceneShelter("Somewhere"), "");
assert.equal(shared.sceneShelter("", "room"), "indoors", "a World Maps room is indoors");
assert.equal(shared.sceneShelter("Winter Garden", "room"), "indoors", "a map room named garden is still a room");
assert.equal(shared.sceneShelter(null, "settlement"), "");

// ── Indoors the weather stays outside ──
const storm = resolveWeatherRenderConfig("thunderstorm", "night");
assert.ok(storm.count > 0);
const inside = shelterWeatherRenderConfig(storm, "indoors");
assert.equal(inside.count, 0, "no rain across the room");
assert.equal(inside.celestial, "none");
assert.equal(inside.addStars, false);
assert.equal(inside.lightning, true, "lightning light still comes through the windows");
assert.equal(inside.category, "storm", "themes still see the weather");
assert.equal(shelterWeatherRenderConfig(storm, "outdoors"), storm);
assert.equal(shelterWeatherRenderConfig(storm, ""), storm);
assert.equal(
  shelterWeatherRenderConfig(resolveWeatherRenderConfig("fog", "noon"), "indoors").type,
  "dust",
  "no fog banks indoors",
);

// ── The picture already shows the weather ──
const { backgroundShowsWeather, backgroundFileName } =
  await import("../../packages/client/src/hooks/use-scene-shelter.js");
assert.equal(backgroundFileName("/api/backgrounds/file/old%20inn--wx-rain.png"), "old inn--wx-rain.png");
assert.equal(backgroundShowsWeather("inn--wx-rain.png", "light rain"), true);
assert.equal(backgroundShowsWeather("inn--wx-rain.png", "snow"), false, "an outdated version doesn't count");
assert.equal(backgroundShowsWeather("inn.png", "rain"), false);
assert.equal(backgroundShowsWeather("inn--wx-clear.png", "sunny"), false);
const rain = resolveWeatherRenderConfig("heavy rain", "noon");
assert.equal(
  paintedWeatherRenderConfig(rain, "").count,
  0,
  "unknown shelter + painted weather: nothing falls (a window)",
);
assert.equal(paintedWeatherRenderConfig(rain, "indoors").count, 0);
assert.equal(paintedWeatherRenderConfig(rain, "outdoors").count, Math.round(rain.count / 3), "outdoors: thinner");
const fog = resolveWeatherRenderConfig("thick fog", "noon");
assert.equal(paintedWeatherRenderConfig(fog, "outdoors").type, "dust", "no fog banks over painted fog");
assert.equal(paintedWeatherRenderConfig(fog, "outdoors").count, 0);

// ── File names ──
assert.deepEqual(shared.parseBackgroundWeatherVersionName("generated-old-inn--wx-rain.png"), {
  baseStem: "generated-old-inn",
  ext: "png",
  version: "rain",
});
assert.equal(shared.parseBackgroundWeatherVersionName("my-inn.webp").version, "");
assert.equal(isChatBackgroundWeatherVersion("a--wx-snow.png"), true);
assert.equal(isChatBackgroundWeatherVersion("a--wx-sunny.png"), false);

// ── Plans ──
const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
writeFileSync(join(bgDir, "inn.png"), png);
assert.deepEqual(planChatBackgroundWeather("inn.png", "sunny"), { kind: "keep" });
assert.deepEqual(planChatBackgroundWeather("inn.png", "pouring rain"), {
  kind: "generate",
  baseFilename: "inn.png",
  version: "rain",
  scenePrompt: "",
});
writeFileSync(join(bgDir, "inn--wx-rain.png"), png);
assert.deepEqual(planChatBackgroundWeather("inn.png", "pouring rain"), {
  kind: "switch",
  filename: "inn--wx-rain.png",
});
assert.deepEqual(planChatBackgroundWeather("inn--wx-rain.png", "rain"), { kind: "keep" });
assert.deepEqual(planChatBackgroundWeather("inn--wx-rain.png", "clear skies"), { kind: "switch", filename: "inn.png" });
assert.equal(planChatBackgroundWeather("inn--wx-rain.png", "snow").kind, "generate");
assert.equal(chatBackgroundPlainPicture("inn--wx-rain.png"), "inn.png");
// A picture first painted in the rain gets a dry copy when the rain stops.
writeFileSync(join(bgDir, "dock.png"), png);
writeFileSync(join(bgDir, "scenes.json"), JSON.stringify({ "dock.png": { prompt: "a rainy dock", weather: "rain" } }));
assert.deepEqual(planChatBackgroundWeather("dock.png", "rain"), { kind: "keep" });
assert.deepEqual(planChatBackgroundWeather("dock.png", "sunny"), {
  kind: "generate",
  baseFilename: "dock.png",
  version: "clear",
  scenePrompt: "a rainy dock",
});
// Only real library files take part.
assert.deepEqual(planChatBackgroundWeather("../secrets.png", "rain"), { kind: "keep" });
assert.deepEqual(planChatBackgroundWeather("backgrounds:forest", "rain"), { kind: "keep" });
assert.deepEqual(planChatBackgroundWeather("missing.png", "rain"), { kind: "keep" });

// ── Prompt ──
const indoorsPrompt = shared.backgroundWeatherVersionInstruction("rain", "indoors");
assert.match(indoorsPrompt, /only through the windows/);
assert.match(indoorsPrompt, /same location, composition/);
assert.match(shared.backgroundWeatherVersionInstruction("snow", "outdoors"), /across the whole scene/);

console.log("background weather versions: ok");
