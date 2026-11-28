// Weather and time of day versions of chat backgrounds (Nov 2026): the same room repainted in the story's
// weather and/or at its time of day, made once per picture, weather and time, and no full-screen weather while
// the story is indoors.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const dataDir = mkdtempSync(join(tmpdir(), "bg-weather-"));
process.env.DATA_DIR = dataDir;
const bgDir = join(dataDir, "backgrounds");
mkdirSync(bgDir, { recursive: true });

const shared = await import("../../../packages/shared/src/utils/scene-weather.js");
const { paintedWeatherRenderConfig, resolveWeatherRenderConfig, shelterWeatherRenderConfig } =
  await import("../../../packages/client/src/lib/weather-renderer.js");
const {
  planChatBackgroundWeather,
  planChatBackgroundVersion,
  chatBackgroundPlainPicture,
  isChatBackgroundWeatherVersion,
  windowMaskFromRepaint,
  chatBackgroundWindowMaskPath,
  chatBackgroundWindowMaskKnown,
} = await import("../../../packages/server/src/services/game/game-asset-generation.js");

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
const { paintedSkyStill, stillPaintedSky } = await import("../../../packages/client/src/lib/weather-renderer.js");
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
  await import("../../../packages/client/src/hooks/use-scene-shelter.js");
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
  time: "",
});
assert.equal(shared.parseBackgroundWeatherVersionName("my-inn.webp").version, "");
assert.deepEqual(shared.parseBackgroundWeatherVersionName("inn--wx-rain--tod-night.png"), {
  baseStem: "inn",
  ext: "png",
  version: "rain",
  time: "night",
});
assert.deepEqual(shared.parseBackgroundWeatherVersionName("inn--tod-sunset.webp"), {
  baseStem: "inn",
  ext: "webp",
  version: "",
  time: "sunset",
});
assert.equal(shared.parseBackgroundWeatherVersionName("inn--tod-noon.png").time, "", "only the four times");
assert.equal(shared.parseBackgroundWeatherVersionName("inn--wx-meteor-shower--tod-dawn.png").version, "meteor-shower");
assert.equal(shared.backgroundVersionStem("inn", "rain", "night"), "inn--wx-rain--tod-night");
assert.equal(shared.backgroundVersionStem("inn", "", "dawn"), "inn--tod-dawn");
assert.equal(isChatBackgroundWeatherVersion("a--tod-night.png"), true, "a time version follows its plain picture too");
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
  time: "",
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
  time: "",
  scenePrompt: "a rainy dock",
});
// Only real library files take part.
assert.deepEqual(planChatBackgroundWeather("../secrets.png", "rain"), { kind: "keep" });
assert.deepEqual(planChatBackgroundWeather("backgrounds:forest", "rain"), { kind: "keep" });
assert.deepEqual(planChatBackgroundWeather("missing.png", "rain"), { kind: "keep" });

assert.equal(planChatBackgroundWeather("inn.png", "aurora borealis").kind, "generate");
assert.equal((planChatBackgroundWeather("inn.png", "meteor shower") as { version?: string }).version, "meteor-shower");

// ── Time of day ──
assert.equal(shared.backgroundTimeOfDay("7:40 PM"), "sunset");
assert.equal(shared.backgroundTimeOfDay("11 p.m."), "night");
assert.equal(shared.backgroundTimeOfDay("12 AM"), "night");
assert.equal(shared.backgroundTimeOfDay("12:15 pm"), "day");
assert.equal(shared.backgroundTimeOfDay("05:30"), "dawn");
assert.equal(shared.backgroundTimeOfDay("21:15"), "night");
assert.equal(shared.backgroundTimeOfDay("Late afternoon"), "day");
assert.equal(shared.backgroundTimeOfDay("Dusk"), "sunset");
assert.equal(shared.backgroundTimeOfDay("Early morning, just after sunrise"), "dawn");
assert.equal(shared.backgroundTimeOfDay("midnight"), "night");
assert.equal(shared.backgroundTimeOfDay("Evening, 8:30 PM"), "night", "a clock reading wins over words");
assert.equal(shared.backgroundTimeOfDay(""), "");
assert.equal(shared.backgroundTimeOfDay("unknown"), "");
assert.equal(shared.backgroundTimeOfDayFromWords(["tavern-night", "cozy"]), "night");
assert.equal(shared.backgroundTimeOfDayFromWords(["tavern"]), "");
// A picture with no time on record is taken as day: daytime keeps it, night gets a version.
writeFileSync(join(bgDir, "hall.png"), png);
assert.deepEqual(planChatBackgroundVersion("hall.png", { time: "2 PM" }), { kind: "keep" });
assert.deepEqual(planChatBackgroundVersion("hall.png", { time: "11 PM" }), {
  kind: "generate",
  baseFilename: "hall.png",
  version: "",
  time: "night",
  scenePrompt: "",
});
writeFileSync(join(bgDir, "hall--tod-night.png"), png);
assert.deepEqual(planChatBackgroundVersion("hall.png", { time: "midnight" }), {
  kind: "switch",
  filename: "hall--tod-night.png",
});
assert.deepEqual(planChatBackgroundVersion("hall--tod-night.png", { time: "noon" }), {
  kind: "switch",
  filename: "hall.png",
});
assert.equal(chatBackgroundPlainPicture("hall--tod-night.png"), "hall.png");
// Weather and time together: one picture for both, and each part keeps what is shown when only the other changes.
assert.deepEqual(planChatBackgroundVersion("hall--tod-night.png", { weather: "rain", time: "night" }), {
  kind: "generate",
  baseFilename: "hall.png",
  version: "rain",
  time: "night",
  scenePrompt: "",
});
writeFileSync(join(bgDir, "hall--wx-rain--tod-night.png"), png);
assert.deepEqual(planChatBackgroundWeather("hall--tod-night.png", "rain"), {
  kind: "switch",
  filename: "hall--wx-rain--tod-night.png",
});
assert.deepEqual(planChatBackgroundVersion("hall--wx-rain--tod-night.png", { time: "midnight" }), { kind: "keep" });
assert.deepEqual(planChatBackgroundWeather("hall--wx-rain--tod-night.png", "clear"), {
  kind: "switch",
  filename: "hall--tod-night.png",
});
assert.deepEqual(planChatBackgroundVersion("hall--wx-rain--tod-night.png", { time: "1 PM" }), {
  kind: "generate",
  baseFilename: "hall.png",
  version: "rain",
  time: "",
  scenePrompt: "",
});
// A picture painted at night (on record, or by its name) needs no night version, and gets a day one.
writeFileSync(join(bgDir, "alley.png"), png);
writeFileSync(join(bgDir, "alley-at-night.png"), png);
writeFileSync(
  join(bgDir, "scenes.json"),
  JSON.stringify({
    "dock.png": { prompt: "a rainy dock", weather: "rain" },
    "alley.png": { prompt: "a dark alley", weather: "", time: "night" },
  }),
);
assert.deepEqual(planChatBackgroundVersion("alley.png", { time: "10 PM" }), { kind: "keep" });
assert.equal((planChatBackgroundVersion("alley.png", { time: "9 AM" }) as { time?: string }).time, "day");
assert.deepEqual(planChatBackgroundVersion("alley-at-night.png", { time: "23:00" }), { kind: "keep" });
// The repaint keeps the place and changes the light.
const nightPrompt = shared.backgroundVersionInstruction("", "night", "indoors");
assert.match(nightPrompt, /different time of day/);
assert.match(nightPrompt, /lamps, candles or fire/);
assert.doesNotMatch(nightPrompt, /weather/);
const both = shared.backgroundVersionInstruction("rain", "sunset", "outdoors");
assert.match(both, /different weather and at a different time of day/);
assert.match(both, /rain falling across the whole scene/);
assert.match(both, /sunset/);

// ── Gallery pictures (pinned places from a character's or persona's gallery) ──
{
  const galleryDir = join(dataDir, "gallery", "characters", "c1");
  mkdirSync(galleryDir, { recursive: true });
  const png1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  writeFileSync(join(galleryDir, "room.png"), png1x1);
  const url = "/api/characters/c1/gallery/file/room.png";
  const plan = planChatBackgroundWeather(url, "heavy rain") as {
    kind: string;
    baseFilename?: string;
    version?: string;
  };
  assert.equal(plan.kind, "generate", "a gallery picture gets weather versions too");
  assert.equal(plan.baseFilename, url, "made from the gallery picture itself");
  assert.equal(plan.version, "rain");
  assert.equal(planChatBackgroundWeather("/api/characters/c1/gallery/file/missing.png", "rain").kind, "keep");
  assert.equal(planChatBackgroundWeather("/api/characters/../gallery/file/room.png", "rain").kind, "keep");
  // Its version sits in the library under a stem from the address; gallery-links.json leads back.
  const { createHash } = await import("node:crypto");
  const stem = `gallery-${createHash("sha256").update("characters/c1/room.png").digest("hex").slice(0, 12)}`;
  writeFileSync(join(bgDir, `${stem}--wx-rain.png`), png1x1);
  writeFileSync(join(bgDir, "gallery-links.json"), JSON.stringify({ [stem]: url }));
  assert.deepEqual(planChatBackgroundWeather(url, "rain"), { kind: "switch", filename: `${stem}--wx-rain.png` });
  assert.deepEqual(planChatBackgroundWeather(`${stem}--wx-rain.png`, "sunny"), { kind: "switch", filename: url });
  assert.equal(chatBackgroundPlainPicture(`${stem}--wx-rain.png`), url);
  // Another spelling of the same address finds the same version.
  assert.deepEqual(planChatBackgroundWeather("/api/characters/c1/gallery/file/%72oom.png", "rain"), {
    kind: "switch",
    filename: `${stem}--wx-rain.png`,
  });
}

// ── Window stencils ──
assert.equal(chatBackgroundWindowMaskPath("inn--wx-rain.png"), null, "no stencil made yet");
// sharp belongs to the server package and is optional there: without it only the stencil painting
// and alpha checks are skipped.
let sharp: any = null;
try {
  sharp = createRequire(new URL("../../../packages/server/package.json", import.meta.url))("sharp");
} catch {
  console.warn("background weather versions: sharp is not installed; skipping the stencil painting checks");
}
let stencilPng: Buffer = png;
if (sharp) {
  // The picture: a grey room, a sky-blue window (x 120-200, y 30-110), an orange cushion in front of the
  // window's lower part (x 140-170, y 90-110) and a magenta rug that was always magenta.
  const W = 320;
  const H = 180;
  const picRaw = Buffer.alloc(W * H * 3, 90);
  const paint = (raw: Buffer, x0: number, x1: number, y0: number, y1: number, rgb: number[]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) raw.set(rgb, (y * W + x) * 3);
  };
  paint(picRaw, 120, 200, 30, 110, [120, 170, 230]);
  paint(picRaw, 140, 170, 90, 110, [230, 140, 40]);
  paint(picRaw, 20, 80, 140, 170, [255, 0, 255]);
  // The model's repaint: only the outside view is magenta; the cushion and the rest are untouched.
  const answerRaw = Buffer.from(picRaw);
  paint(answerRaw, 120, 200, 30, 110, [255, 0, 255]);
  paint(answerRaw, 140, 170, 90, 110, [230, 140, 40]);
  const picture = await sharp(picRaw, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer();
  const answer = await sharp(answerRaw, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer();
  const cleaned = await windowMaskFromRepaint(answer, picture, W, H);
  assert.ok(cleaned, "one window is a usable stencil");
  const expected = (80 * 80 - 30 * 20) / (W * H);
  assert.ok(Math.abs(cleaned!.coverage - expected) < 0.01, `coverage ${cleaned!.coverage} vs ${expected}`);
  const maskMeta = await sharp(cleaned!.png).metadata();
  assert.equal(maskMeta.width, 640);
  assert.equal(maskMeta.height, 360, "the picture's aspect ratio");
  assert.equal(maskMeta.channels, 4);
  const alphaAt = async (x: number, y: number) => {
    const { data } = await sharp(cleaned!.png).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    return data[Math.round(y * 2) * 640 + Math.round(x * 2)]!;
  };
  assert.ok((await alphaAt(150, 60)) > 200, "sky through the glass is in");
  assert.ok((await alphaAt(155, 100)) < 30, "the cushion in front of the glass stays out");
  assert.ok((await alphaAt(50, 155)) < 30, "a rug that was always magenta stays out");
  assert.ok((await alphaAt(60, 60)) < 30, "the wall stays out");
  assert.equal(await windowMaskFromRepaint(picture, picture, W, H), null, "unchanged picture: no windows");
  const allMagenta = await sharp({ create: { width: W, height: H, channels: 3, background: "#ff00ff" } })
    .png()
    .toBuffer();
  assert.equal(
    await windowMaskFromRepaint(allMagenta, picture, W, H),
    null,
    "the whole room painted is a wrong answer",
  );
  stencilPng = cleaned!.png;
}
// A stencil on record is shared by every version of the picture; names come only from the record.
mkdirSync(join(bgDir, "weather-masks"), { recursive: true });
writeFileSync(join(bgDir, "weather-masks", "inn.png"), stencilPng);
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
