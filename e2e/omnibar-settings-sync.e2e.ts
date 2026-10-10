import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const SETTINGS_PATH = "/api/app-settings/ui";
const QUICK_ANSWER_MODEL = "e2e-quick-answer-model";
const MARI_CONNECTION = "e2e-mari-connection";

/** The browser's own copy of the store, as the persistence layer writes it (debounced by about a second). */
function readBrowserSettings(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("marinara-engine-ui");
    return raw ? (JSON.parse(raw).state as Record<string, unknown>) : null;
  });
}

test("the Quick answer model and Professor Mari's connection follow a fresh browser", async ({
  browser,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "one viewport is enough for a settings round trip");
  const baseURL = testInfo.project.use.baseURL;
  const original = (await (await request.get(SETTINGS_PATH)).json()) as { value: string };
  // An empty blob makes the first browser seed the server with its own choices.
  expect((await request.put(SETTINGS_PATH, { data: { value: "" } })).ok()).toBeTruthy();
  const contextA = await browser.newContext({ baseURL });
  const contextB = await browser.newContext({ baseURL });
  try {
    await contextA.addInitScript(
      (version) => localStorage.setItem("marinara:whats-new:seen-version", version),
      APP_VERSION,
    );
    await seedUIState(contextA, {
      hasCompletedOnboarding: true,
      omnibarAsideConnectionId: QUICK_ANSWER_MODEL,
      mariConnectionId: MARI_CONNECTION,
    });
    const pageA = await contextA.newPage();
    await pageA.goto("/");
    await expect
      .poll(
        async () => {
          const saved = (await (await request.get(SETTINGS_PATH)).json()) as { value: string };
          const settings = JSON.parse(saved.value || "{}") as Record<string, unknown>;
          return [settings.omnibarAsideConnectionId, settings.mariConnectionId];
        },
        { message: "context A saves both choices on the server", timeout: 20_000 },
      )
      .toEqual([QUICK_ANSWER_MODEL, MARI_CONNECTION]);

    // Context B starts with empty browser storage, as a new browser or device would.
    await contextB.addInitScript(
      (version) => localStorage.setItem("marinara:whats-new:seen-version", version),
      APP_VERSION,
    );
    const pageB = await contextB.newPage();
    await pageB.goto("/");
    await expect
      .poll(
        async () => {
          const settings = await readBrowserSettings(pageB);
          return [settings?.omnibarAsideConnectionId, settings?.mariConnectionId];
        },
        { message: "context B loads both choices from the server", timeout: 20_000 },
      )
      .toEqual([QUICK_ANSWER_MODEL, MARI_CONNECTION]);
  } finally {
    await contextA.close();
    await contextB.close();
    await request.put(SETTINGS_PATH, { data: { value: original.value } });
  }
});
