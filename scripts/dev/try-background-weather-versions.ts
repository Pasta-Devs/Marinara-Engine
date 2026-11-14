// Try weather versions of chat backgrounds against a real image service (by hand; not a regression).
// Uses the ChatGPT (Codex login) image service, so it needs `codex login` on this computer and
// counts against the ChatGPT image limit (one picture per case).
//
//   cd packages/server && npx tsx ../../scripts/dev/try-background-weather-versions.ts <output folder>
//   ... <output folder> --window            (a room with a big window, then its rain and snow)
//   ... <output folder> --stencil <inn.png> [runs] (the window repaint and the stencil made from it)
//   ... <output folder> --more <inn.png>    (its window stencil, then aurora/blizzard/blossom/meteor shower)
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const outDir = resolve(process.argv[2] || "weather-version-test");
mkdirSync(outDir, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), "bg-weather-live-"));
process.env.DATA_DIR = dataDir;
const bgDir = join(dataDir, "backgrounds");
mkdirSync(bgDir, { recursive: true });
const assets = resolve("src/assets/default-backgrounds");
for (const name of ["ancient_library.jpg", "dark_forest.jpg"]) {
  copyFileSync(join(assets, name), join(bgDir, name));
  copyFileSync(join(assets, name), join(outDir, name));
}

const { generateChatBackground, generateChatBackgroundWeatherVersion, generateChatBackgroundWindowMask } =
  await import("../../packages/server/src/services/game/game-asset-generation.js");
const { sceneShelter } = await import("../../packages/shared/src/utils/scene-weather.js");

const codex = {
  imgModel: "gpt-image-2",
  imgBaseUrl: "openai-chatgpt://codex-auth",
  imgApiKey: "",
  imgSource: "codex_chatgpt",
  imgService: "codex_chatgpt",
};

// `--stencil <picture> [runs]`: ask for the window repaint of a picture (default 2 runs) and save the
// model's answer next to the stencil made from it, to judge the stencil prompt.
const stencilIndex = process.argv.indexOf("--stencil");
if (stencilIndex > 0) {
  const { WINDOW_MASK_INSTRUCTION, windowMaskFromRepaint } =
    await import("../../packages/server/src/services/game/game-asset-generation.js");
  const { generateImage } = await import("../../packages/server/src/services/image/image-generation.js");
  const picturePath = resolve(process.argv[stencilIndex + 1] || "");
  const runs = Math.max(1, Math.min(4, Number(process.argv[stencilIndex + 2]) || 2));
  const stem = picturePath
    .split(/[\\/]/u)
    .pop()!
    .replace(/\.[^.]+$/u, "");
  const sharp = (await import("sharp")).default;
  const meta = await sharp(picturePath).metadata();
  for (let run = 1; run <= runs; run++) {
    const started = Date.now();
    try {
      const result = await generateImage(codex.imgModel, codex.imgBaseUrl, codex.imgApiKey, codex.imgSource, {
        prompt: WINDOW_MASK_INSTRUCTION,
        model: codex.imgModel,
        width: meta.width!,
        height: meta.height!,
        referenceImage: readFileSync(picturePath).toString("base64"),
        referenceIsCanvas: true,
        preserveProviderOutput: true,
      });
      const answer = Buffer.from(result.base64, "base64");
      writeFileSync(join(outDir, `${stem}--repaint-${run}.png`), answer);
      const mask = await windowMaskFromRepaint(answer, picturePath, meta.width!, meta.height!);
      if (mask) writeFileSync(join(outDir, `${stem}--stencil-v3-${run}.png`), mask.png);
      console.log(
        `run ${run}: ${Math.round((Date.now() - started) / 1000)} s, ${mask ? `${(mask.coverage * 100).toFixed(1)}% glass` : "no usable windows"}`,
      );
    } catch (err) {
      console.log(`run ${run}: FAILED`, err);
    }
  }
  console.log("Output:", outDir, readdirSync(outDir));
  process.exit(0);
}

// `--more <inn picture>`: the window stencil of an indoor picture made earlier with --window, then
// versions in the newer kinds of weather (aurora, blizzard, blossom, an unusual one), indoors and out.
const moreIndex = process.argv.indexOf("--more");
if (moreIndex > 0) {
  const innPath = resolve(process.argv[moreIndex + 1] || "");
  const inn = innPath.split(/[\\/]/u).pop()!;
  copyFileSync(innPath, join(bgDir, inn));
  const innScene = "A cozy old inn common room with a big multi-pane window and a window seat, a stone hearth";
  const timed = async (label: string, run: () => Promise<string | null>, from = bgDir) => {
    const started = Date.now();
    const filename = await run();
    console.log(`${label}: ${filename ?? "FAILED"} in ${Math.round((Date.now() - started) / 1000)} s`);
    if (filename)
      copyFileSync(
        join(from, filename),
        join(
          outDir,
          filename.replace(/\.png$/u, "") +
            (from === bgDir ? "" : "--stencil") +
            (filename.endsWith(".png") ? ".png" : ""),
        ),
      );
    return filename;
  };
  const jobs: Array<() => Promise<unknown>> = [
    () =>
      timed(
        `${inn} -> window stencil`,
        () =>
          generateChatBackgroundWindowMask({
            chatId: "weather-version-test",
            locationSlug: inn,
            sceneDescription: innScene,
            baseFilename: inn,
            ...codex,
          }),
        join(bgDir, "weather-masks"),
      ),
    ...(
      [
        [inn, "aurora", "Tideglass Inn common room", innScene],
        [inn, "blizzard", "Tideglass Inn common room", innScene],
        [inn, "blossom", "Tideglass Inn common room", innScene],
        [inn, "meteor-shower", "Tideglass Inn common room", innScene],
        ["dark_forest.jpg", "aurora", "Dark forest trail", "Dark forest trail"],
        ["dark_forest.jpg", "meteor-shower", "Dark forest trail", "Dark forest trail"],
      ] as const
    ).map(
      ([base, version, location, scene]) =>
        () =>
          timed(`${base} -> ${version}`, () =>
            generateChatBackgroundWeatherVersion({
              chatId: "weather-version-test",
              locationSlug: base,
              sceneDescription: scene,
              baseFilename: base,
              version,
              shelter: sceneShelter(location),
              scenePrompt: scene,
              providerReadyPrompt: true,
              ...codex,
            }),
          ),
    ),
  ];
  // Two at a time, so the ChatGPT image limit isn't hit all at once.
  const queue = [...jobs];
  await Promise.all(
    [0, 1].map(async () => {
      while (queue.length) await queue.shift()!();
    }),
  );
  console.log("Output:", outDir, readdirSync(outDir));
  process.exit(0);
}

// `--window`: first paint a room with big windows on a clear day, then its rain and snow versions.
if (process.argv.includes("--window")) {
  const scene =
    "A cozy old inn common room with a big multi-pane window and a window seat, a stone hearth, wooden tables, warm lamplight, clear sunny afternoon outside the window, no people";
  const base = await generateChatBackground({
    chatId: "weather-version-test",
    locationSlug: "window inn",
    sceneDescription: scene,
    currentWeather: "clear",
    providerReadyPrompt: true,
    ...codex,
  });
  console.log(`base -> ${base ?? "FAILED"}`);
  if (!base) process.exit(1);
  copyFileSync(join(bgDir, base), join(outDir, base));
  for (const version of ["rain", "snow"] as const) {
    const started = Date.now();
    const filename = await generateChatBackgroundWeatherVersion({
      chatId: "weather-version-test",
      locationSlug: base,
      sceneDescription: scene,
      baseFilename: base,
      version,
      shelter: sceneShelter("Tideglass Inn common room"),
      scenePrompt: scene,
      providerReadyPrompt: true,
      ...codex,
    });
    console.log(`${base} -> ${version}: ${filename ?? "FAILED"} in ${Math.round((Date.now() - started) / 1000)} s`);
    if (filename) copyFileSync(join(bgDir, filename), join(outDir, filename));
  }
  console.log("Output:", outDir, readdirSync(outDir));
  process.exit(0);
}

const cases = [
  { base: "ancient_library.jpg", location: "The old library of Brinewatch", version: "rain" },
  { base: "ancient_library.jpg", location: "The old library of Brinewatch", version: "snow" },
  { base: "dark_forest.jpg", location: "Dark forest trail", version: "snow" },
  { base: "dark_forest.jpg", location: "Dark forest trail", version: "storm" },
] as const;

for (const c of cases) {
  const shelter = sceneShelter(c.location);
  const started = Date.now();
  const filename = await generateChatBackgroundWeatherVersion({
    chatId: "weather-version-test",
    locationSlug: c.base,
    sceneDescription: c.location,
    currentLocation: c.location,
    baseFilename: c.base,
    version: c.version,
    shelter,
    scenePrompt: c.location,
    providerReadyPrompt: true,
    ...codex,
    debugLog: (message: string, ...args: unknown[]) => console.log(message, ...args),
  });
  console.log(
    `${c.base} -> ${c.version} (${shelter || "unknown"}): ${filename ?? "FAILED"} in ${Math.round((Date.now() - started) / 1000)} s`,
  );
  if (filename) copyFileSync(join(bgDir, filename), join(outDir, filename));
}
console.log("Output:", outDir, readdirSync(outDir));
