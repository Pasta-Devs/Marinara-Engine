// Weather versions of chat backgrounds (Nov 2026): the same room repainted in the story's weather, made once
// per picture and weather, and no full-screen weather while the story is indoors.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const dataDir = mkdtempSync(join(tmpdir(), "bg-weather-"));
process.env.DATA_DIR = dataDir;
const bgDir = join(dataDir, "backgrounds");
mkdirSync(bgDir, { recursive: true });

const shared = await import("../../packages/shared/src/utils/scene-weather.js");
const { paintedWeatherRenderConfig, resolveWeatherRenderConfig, shelterWeatherRenderConfig } =
  await import("../../packages/client/src/lib/weather-renderer.js");
const {
  planChatBackgroundWeather,
  chatBackgroundPlainPicture,
  isChatBackgroundWeatherVersion,
  cleanWindowMask,
  chatBackgroundWindowMaskPath,
  chatBackgroundWindowMaskKnown,
} = await import("../../packages/server/src/services/game/game-asset-generation.js");

// ── Weather words ──
assert.equal(shared.sceneWeatherCategory("Heavy thunderstorm"), "storm");
assert.equal(shared.sceneWeatherCategory("light rain"), "rain");
assert.equal(shared.sceneWeatherCategory("Overcast"), "cloudy");
assert.equal(shared.sceneWeatherCategory(""), "");
assert.equal(shared.backgroundWeatherVersion("drizzle and rain"), "rain");
assert.equal(shared.backgroundWeatherVersion("Sunny"), "");
assert.equal(shared.backgroundWeatherVersion("windy"), "", "wind keeps the plain picture");
assert.equal(shared.backgroundWeatherVersion("Clear skies, 24°C, light breeze"), "", "mild words: plain picture");
assert.equal(shared.backgroundWeatherVersion("Partly cloudy"), "");
// Every kind a painter can show gets its own version, unusual weather in the story's own words.
assert.equal(shared.backgroundWeatherVersion("Howling blizzard"), "blizzard");
assert.equal(shared.backgroundWeatherVersion("light snow"), "snow");
assert.equal(shared.backgroundWeatherVersion("Aurora borealis overhead"), "aurora");
assert.equal(shared.backgroundWeatherVersion("cherry blossoms drifting"), "blossom");
assert.equal(shared.backgroundWeatherVersion("embers from the burning city"), "embers");
assert.equal(shared.backgroundWeatherVersion("A meteor shower"), "meteor-shower");
assert.equal(shared.backgroundWeatherVersion("Clear night, blood moon"), "blood-moon");
assert.equal(shared.backgroundWeatherVersion("Solar eclipse!! <script>"), "solar-eclipse-script", "letters only");
assert.ok(shared.unusualWeatherSlug("one two three four five six seven eight nine ten").length <= 32);
assert.equal(shared.unusualWeatherSlug("Crème brûlée haze"), "creme-brulee-haze");
// The weather drawing reports the same words as before for themes.
assert.equal(resolveWeatherRenderConfig("blizzard", "noon").category, "snow");
assert.equal(resolveWeatherRenderConfig("cherry blossoms drifting", "noon").category, "blossom");

// A painted aurora or unusual clear sky (meteor shower) is left still: nothing drawn over it.
const { paintedSkyStill, stillPaintedSky } = await import("../../packages/client/src/lib/weather-renderer.js");
assert.equal(paintedSkyStill(resolveWeatherRenderConfig("aurora borealis", "night")), true);
assert.equal(paintedSkyStill(resolveWeatherRenderConfig("meteor shower", "night")), true);
assert.equal(paintedSkyStill(resolveWeatherRenderConfig("heavy rain", "night")), false);
const stillMeteors = stillPaintedSky(resolveWeatherRenderConfig("meteor shower", "night"));
assert.equal(stillMeteors.count + Number(stillMeteors.addStars) + Number(stillMeteors.addFireflies), 0);
assert.equal(paintedWeatherRenderConfig(resolveWeatherRenderConfig("aurora", "night"), "outdoors").count, 0);

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
assert.equal(
  paintedWeatherRenderConfig(resolveWeatherRenderConfig("rain", "night"), "outdoors").celestial,
  "none",
  "no drawn moon over a painted sky",
);

// ── File names ──
assert.deepEqual(shared.parseBackgroundWeatherVersionName("generated-old-inn--wx-rain.png"), {
  baseStem: "generated-old-inn",
  ext: "png",
  version: "rain",
});
assert.equal(shared.parseBackgroundWeatherVersionName("my-inn.webp").version, "");
assert.equal(isChatBackgroundWeatherVersion("a--wx-snow.png"), true);
assert.equal(isChatBackgroundWeatherVersion("a--wx-2.png"), false, "slugs are letters only");
assert.equal(isChatBackgroundWeatherVersion("a--wx-meteor-shower.png"), true);
assert.equal(shared.parseBackgroundWeatherVersionName("a--wx-a-b-c-d.png").version, "", "at most three words");
assert.equal(backgroundShowsWeather("inn--wx-meteor-shower.png", "a meteor shower"), true);

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

assert.equal(planChatBackgroundWeather("inn.png", "aurora borealis").kind, "generate");
assert.equal((planChatBackgroundWeather("inn.png", "meteor shower") as { version?: string }).version, "meteor-shower");

// ── Window stencils ──
assert.equal(chatBackgroundWindowMaskPath("inn--wx-rain.png"), null, "no stencil made yet");
// sharp belongs to the server package.
const sharp = createRequire(new URL("../../packages/server/package.json", import.meta.url))("sharp");
// A model answer: black room with one white window, a few grey specks of noise.
const answerRaw = Buffer.alloc(320 * 180 * 3, 0);
for (let y = 30; y < 110; y++)
  for (let x = 120; x < 200; x++) answerRaw.fill(250, (y * 320 + x) * 3, (y * 320 + x) * 3 + 3);
answerRaw.fill(255, (5 * 320 + 5) * 3, (5 * 320 + 5) * 3 + 3);
const answer = await sharp(answerRaw, { raw: { width: 320, height: 180, channels: 3 } })
  .png()
  .toBuffer();
const cleaned = await cleanWindowMask(answer, 1600, 900);
assert.ok(cleaned, "one window is a usable stencil");
assert.ok(cleaned!.coverage > 0.08 && cleaned!.coverage < 0.14, `coverage ${cleaned!.coverage}`);
const maskMeta = await sharp(cleaned!.png).metadata();
assert.equal(maskMeta.width, 640);
assert.equal(maskMeta.height, 360, "the picture's aspect ratio");
assert.equal(maskMeta.channels, 4);
const allWhite = await sharp({ create: { width: 64, height: 36, channels: 3, background: "#ffffff" } })
  .png()
  .toBuffer();
assert.equal(await cleanWindowMask(allWhite, 1600, 900), null, "the whole room lit up is a wrong answer");
const allBlack = await sharp({ create: { width: 64, height: 36, channels: 3, background: "#000000" } })
  .png()
  .toBuffer();
assert.equal(await cleanWindowMask(allBlack, 1600, 900), null, "no windows");
// A stencil on record is shared by every version of the picture; names come only from the record.
mkdirSync(join(bgDir, "weather-masks"), { recursive: true });
writeFileSync(join(bgDir, "weather-masks", "inn.png"), cleaned!.png);
writeFileSync(
  join(bgDir, "weather-masks", "masks.json"),
  JSON.stringify({ "inn.png": "inn.png", "dock.png": "none", "evil.png": "../meta.json" }),
);
assert.equal(chatBackgroundWindowMaskPath("inn--wx-rain.png"), join(bgDir, "weather-masks", "inn.png"));
assert.equal(chatBackgroundWindowMaskPath("inn.png"), join(bgDir, "weather-masks", "inn.png"));
assert.equal(chatBackgroundWindowMaskPath("dock.png"), null);
writeFileSync(join(bgDir, "evil.png"), png);
assert.equal(chatBackgroundWindowMaskPath("evil.png"), null, "never a path from the record");
assert.equal(chatBackgroundWindowMaskKnown("dock.png"), true);
assert.equal(chatBackgroundWindowMaskKnown("cellar.png"), false);

// ── Prompt ──
const indoorsPrompt = shared.backgroundWeatherVersionInstruction("rain", "indoors");
assert.match(indoorsPrompt, /only through the windows/);
assert.match(indoorsPrompt, /same location, composition/);
assert.match(shared.backgroundWeatherVersionInstruction("snow", "outdoors"), /across the whole scene/);
assert.match(shared.backgroundWeatherVersionInstruction("aurora", "indoors"), /aurora/);
assert.match(shared.backgroundWeatherVersionInstruction("meteor-shower", "outdoors"), /this weather: meteor shower/);

console.log("background weather versions: ok");
