// Try weather versions of chat backgrounds against a real image service (by hand; not a regression).
// Uses the ChatGPT (Codex login) image service, so it needs `codex login` on this computer and
// counts against the ChatGPT image limit (one picture per case).
//
//   cd packages/server && npx tsx ../../scripts/dev/try-background-weather-versions.ts <output folder>
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
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

const { generateChatBackground, generateChatBackgroundWeatherVersion } =
  await import("../../packages/server/src/services/game/game-asset-generation.js");
const { sceneShelter } = await import("../../packages/shared/src/utils/scene-weather.js");

const codex = {
  imgModel: "gpt-image-2",
  imgBaseUrl: "openai-chatgpt://codex-auth",
  imgApiKey: "",
  imgSource: "codex_chatgpt",
  imgService: "codex_chatgpt",
};

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
