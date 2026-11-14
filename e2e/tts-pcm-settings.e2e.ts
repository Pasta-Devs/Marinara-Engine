import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openConnectionsPanel, openDefaultsTile, openJobSettings, ttsConfigCard } from "./connections-panel.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("PCM speech format persists through the settings UI and reload", async ({ page, request }) => {
  const originalResponse = await request.get("/api/tts/config");
  expect(originalResponse.ok()).toBeTruthy();
  const original = await originalResponse.json();
  try {
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
      return ttsConfigCard(page)
        .locator("select")
        .filter({ has: page.locator('option[value="pcm"]') });
    };
    const format = await openSettings();
    await format.selectOption("pcm");
    await expect.poll(async () => (await (await request.get("/api/tts/config")).json()).audioFormat).toBe("pcm");
    const afterReload = await openSettings();
    await expect(afterReload).toHaveValue("pcm");
  } finally {
    const restored = await request.put("/api/tts/config", { data: original });
    expect(restored.ok()).toBeTruthy();
  }
});

// #7848: an Audio connection can be the voice's source. The setting saves only its ID, never the connection's key,
// and the app says so plainly when the connection is gone.
test("An Audio connection chosen as the Source is saved by ID and reported when it is gone", async ({
  page,
  request,
}, testInfo) => {
  const originalResponse = await request.get("/api/tts/config");
  expect(originalResponse.ok()).toBeTruthy();
  const original = await originalResponse.json();
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
  const { id } = await created.json();
  let deleted = false;
  try {
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
    const voiceRow = () =>
      page.locator("[data-connections-panel]").filter({ visible: true }).locator('[data-defaults-role="voice"]');
    const openPicker = async () => {
      await page.goto("/");
      await openConnectionsPanel(page);
      await voiceRow().getByRole("button").first().click();
      const picker = page.getByRole("dialog", { name: "Model for Voice", exact: true });
      await expect(picker).toBeVisible();
      return picker;
    };

    let picker = await openPicker();
    await picker.getByRole("button", { name: new RegExp(`^${studio}, Audio\\b`, "u") }).click();
    await expect.poll(async () => (await (await request.get("/api/tts/config")).json()).connectionId).toBe(id);
    const view = await (await request.get("/api/tts/config")).text();
    expect(view).not.toContain("e2e-connection-secret");
    expect(JSON.parse(view)).toMatchObject({ connectionId: id, model: "studio-model" });

    picker = await openPicker();
    // The Model tab names the chosen model on every screen size.
    await expect(picker.getByRole("tab", { name: `Model ${studio}`, exact: true })).toBeVisible();
    await capture("tts-card-audio-connection-source");

    expect((await request.delete(`/api/connections/${id}`)).ok()).toBeTruthy();
    deleted = true;
    // The setting still names the account by its ID; the server fails rather than use another one.
    expect((await (await request.get("/api/tts/config")).json()).connectionId).toBe(id);
    await page.goto("/");
    const settings = await openJobSettings(page, "voice");
    await expect(settings.getByTitle("The voice account is missing", { exact: true })).toBeVisible();
    await capture("tts-card-missing-audio-connection");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    if (!deleted) await request.delete(`/api/connections/${id}`);
    const restored = await request.put("/api/tts/config", { data: original });
    expect(restored.ok()).toBeTruthy();
  }
});
