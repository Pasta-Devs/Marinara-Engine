import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { chooseOption } from "./select-field.js";
import { openDefaultsTile, openJobSettings, openJobsPage, ttsConfigCard } from "./connections-panel.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// Every spec in a shard talks to one server. A test that runs out of time never finishes its own body, so the voice
// settings are put back in afterEach, which still runs then. Otherwise the next spec finds the voice on a deleted
// Audio connection.
let original: Record<string, unknown> | undefined;
let audioConnectionId: string | undefined;
test.beforeEach(async ({ request }) => {
  original = undefined;
  const originalResponse = await request.get("/api/tts/config");
  expect(originalResponse.ok()).toBeTruthy();
  original = await originalResponse.json();
});
test.afterEach(async ({ request }) => {
  const removed = audioConnectionId ? await request.delete(`/api/connections/${audioConnectionId}`) : undefined;
  audioConnectionId = undefined;
  // Only a snapshot this test captured goes back; a failed capture would otherwise write {} or the last test's copy.
  if (original) {
    const restored = await request.put("/api/tts/config", { data: original });
    expect(restored.ok()).toBeTruthy();
  }
  // Checked after the restore, so a failed deletion is reported without skipping it.
  if (removed) expect(removed.ok(), `deleting the Audio connection returned ${removed.status()}`).toBeTruthy();
});

test("PCM speech format persists through the settings UI and reload", async ({ page, request }) => {
  const saved = await request.put("/api/tts/config", {
    data: { ...original, enabled: false, source: "openai", audioFormat: "mp3" },
  });
  expect(saved.ok()).toBeTruthy();
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  // The Text to Speech settings open from the Voice job's gear (1e4664c38b).
  const openSettings = async () => {
    await page.goto("/");
    await openDefaultsTile(page, "voice");
    return ttsConfigCard(page).getByRole("combobox", { name: "Audio format", exact: true });
  };
  const format = await openSettings();
  await chooseOption(page, format, "PCM (converted to WAV for playback)");
  await expect.poll(async () => (await (await request.get("/api/tts/config")).json()).audioFormat).toBe("pcm");
  const afterReload = await openSettings();
  await expect(afterReload).toHaveAttribute("data-value", "pcm");
});

// #7848: an Audio connection can be the voice's source. The setting saves only its ID, never the connection's key,
// and the app says so plainly when the connection is gone.
test("An Audio connection chosen as the Source is saved by ID and reported when it is gone", async ({
  page,
  request,
}, testInfo) => {
  // Five full page loads, each with the steps after it, take about 12 s apiece on CI's dev server. Every step passes
  // and only the default 60 s runs out.
  test.setTimeout(120_000);
  const created = await request.post("/api/connections", {
    data: {
      name: `Voice studio ${testInfo.project.name}`,
      provider: "audio",
      audioSource: "openai",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "e2e-connection-secret",
      model: "studio-model",
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id, accountId } = (await created.json()) as { id: string; accountId: string };
  audioConnectionId = id;
  const saved = await request.put("/api/tts/config", {
    data: { ...original, enabled: false, source: "openai", connectionId: "" },
  });
  expect(saved.ok()).toBeTruthy();
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  const capture = async (name: string) => {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, animations: "disabled" });
    await testInfo.attach(name, { path, contentType: "image/png" });
  };
  // Since the Voice job (1e4664c38b) the card has no Source list: the voice's Model is picked in the Voice
  // job's "Model for Voice" window, and the Voice settings window reports a missing account.
  const studio = `Voice studio ${testInfo.project.name}`;
  const openPicker = async () => {
    await page.goto("/");
    // The Voice job is on the Jobs page, as a row or (while voice is off) a chip.
    await (await openJobsPage(page)).locator('[data-defaults-role="voice"]').getByRole("button").first().click();
    const picker = page.getByRole("dialog", { name: "Model for Voice", exact: true });
    await expect(picker).toBeVisible();
    return picker;
  };

  // The card's own request timeout shows while voice uses a direct source; an Audio account keeps its own.
  const cardTimeout = () => ttsConfigCard(page).getByText("Request timeout (seconds)", { exact: true });
  await page.goto("/");
  await openJobSettings(page, "voice");
  await expect(cardTimeout()).toBeVisible();

  let picker = await openPicker();
  // With nothing chosen the picker opens on the starred models or the first account by name, and the shared
  // server can hold other specs' accounts, so open this one first. A phone shows one view at a time: go back to
  // the account list before choosing it.
  if (testInfo.project.name.includes("mobile"))
    await picker.getByRole("button", { name: "All connections", exact: true }).click();
  await picker.locator(`[data-switcher-pane="${accountId}"]`).click();
  await picker.getByRole("button", { name: new RegExp(`^${studio}, Audio\\b`, "u") }).click();
  await expect.poll(async () => (await (await request.get("/api/tts/config")).json()).connectionId).toBe(id);
  const view = await (await request.get("/api/tts/config")).text();
  expect(view).not.toContain("e2e-connection-secret");
  expect(JSON.parse(view)).toMatchObject({ connectionId: id, model: "studio-model" });
  await page.goto("/");
  await openJobSettings(page, "voice");
  await expect(ttsConfigCard(page)).toBeVisible();
  await expect(cardTimeout()).toBeHidden();

  picker = await openPicker();
  // The Model tab names the chosen model on every screen size.
  await expect(picker.getByRole("tab", { name: `Model ${studio}`, exact: true })).toBeVisible();
  await capture("tts-card-audio-connection-source");

  expect((await request.delete(`/api/connections/${id}`)).ok()).toBeTruthy();
  audioConnectionId = undefined;
  // The setting still names the account by its ID; the server fails rather than use another one.
  expect((await (await request.get("/api/tts/config")).json()).connectionId).toBe(id);
  await page.goto("/");
  const settings = await openJobSettings(page, "voice");
  await expect(settings.getByTitle("The voice account is missing", { exact: true })).toBeVisible();
  await capture("tts-card-missing-audio-connection");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
