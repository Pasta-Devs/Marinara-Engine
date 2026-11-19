// The Playwright set-up: the web server keeps the shared build and starts e2e/start-servers.mjs, desktop and mobile
// projects get their own servers, ports and data folders, and Chromium and WebKit get only their own audio and
// launch settings.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import playwrightConfig from "../../../playwright.config.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const playwrightWebServer = Array.isArray(playwrightConfig.webServer)
  ? playwrightConfig.webServer[0]
  : playwrightConfig.webServer;
assert.equal(playwrightWebServer?.env?.DEV_PRESERVE_SHARED_DIST, "true");
assert.match(playwrightWebServer?.command ?? "", /e2e\/start-servers\.mjs/u);
const desktopPlaywrightProject = playwrightConfig.projects?.find((project) => project.name === "desktop-chromium");
const mobilePlaywrightProject = playwrightConfig.projects?.find((project) => project.name === "mobile-chromium");
assert.ok(desktopPlaywrightProject);
assert.ok(mobilePlaywrightProject);
assert.notEqual(
  desktopPlaywrightProject.use?.baseURL,
  mobilePlaywrightProject.use?.baseURL,
  "desktop and mobile Playwright projects must use isolated app servers",
);
// Chromium runs with its audio output off, so opening an audio device cannot stall a headless page
// (and the toasts with it); the switch is Chromium's own, so a WebKit project never gets it.
for (const project of [desktopPlaywrightProject, mobilePlaywrightProject]) {
  assert.ok(project.use?.launchOptions?.args?.includes("--disable-audio-output"), `${project.name} mutes Chromium`);
}
for (const project of playwrightConfig.projects ?? []) {
  if (!/chromium/u.test(project.name ?? "")) assert.ok(!project.use?.launchOptions?.args?.length, project.name);
}
// WebKit on Linux opens its audio device through GStreamer on the page's main thread (the first tap's audio
// unlock), and a hung audio stack froze that tap. The config ranks the fake audio sink first for every browser.
assert.ok(
  process.env.GST_PLUGIN_FEATURE_RANK?.split(",").includes("fakeaudiosink:MAX"),
  "WebKit e2e browsers play to GStreamer's fake audio sink",
);
const playwrightServerSource = readFileSync(join(REPOSITORY_ROOT, "e2e/start-servers.mjs"), "utf8");
assert.match(playwrightServerSource, /startProject\("mobile", mobileClientPort, mobileServerPort\)/u);
assert.match(playwrightServerSource, /startProject\("desktop", desktopClientPort, desktopServerPort\)/u);
assert.match(playwrightServerSource, /resolve\(dataRoot, name\)/u);
assert.match(playwrightServerSource, /DATA_DIR:\s*dataDir/u);
