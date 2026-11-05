import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openDefaultsTile, ttsConfigCard } from "./connections-panel.js";
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
    // #8456 took the Text to Speech card out of the Connections panel; its settings open in the Add window.
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

// #7848: an Audio connection can be the card's Source. The card saves only its ID, hides the address, key and
// model the connection keeps, and says so plainly when the connection is gone.
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
    // #8456 took the Text to Speech card out of the Connections panel; its settings open in the Add window.
    const openCard = async () => {
      await page.goto("/");
      await openDefaultsTile(page, "voice");
      const card = ttsConfigCard(page);
      await expect(card).toBeVisible();
      return card;
    };

    let card = await openCard();
    const sourceSelect = card.getByLabel("Source", { exact: true });
    // #8456 renamed the copy: "API key", and an Audio connection is an Audio provider.
    await expect(card.getByText("API key", { exact: true })).toBeVisible();
    await sourceSelect.selectOption(`connection:${id}`);
    await expect.poll(async () => (await (await request.get("/api/tts/config")).json()).connectionId).toBe(id);
    await expect(card.getByText("Uses this provider's address, key and model.", { exact: true })).toBeVisible();
    for (const field of ["Base URL", "API key", "Model", "Request timeout (seconds)"]) {
      await expect(card.getByText(field, { exact: true })).toBeHidden();
    }
    const view = await (await request.get("/api/tts/config")).text();
    expect(view).not.toContain("e2e-connection-secret");
    expect(JSON.parse(view)).toMatchObject({ connectionId: id, model: "studio-model" });

    card = await openCard();
    await expect(card.getByLabel("Source", { exact: true })).toHaveValue(`connection:${id}`);
    await capture("tts-card-audio-connection-source");

    expect((await request.delete(`/api/connections/${id}`)).ok()).toBeTruthy();
    deleted = true;
    card = await openCard();
    await expect(
      card.getByText("Choose another source, because this Audio provider is missing or unavailable.", {
        exact: true,
      }),
    ).toBeVisible();
    // The Source list says so too. #8456 removed the card's collapsed header, which used to name it.
    await expect(card.getByLabel("Source", { exact: true }).locator("option:checked")).toHaveText(
      "Missing Audio provider",
    );
    await expect(card.getByLabel("Source", { exact: true })).toHaveValue(`connection:${id}`);
    await capture("tts-card-missing-audio-connection");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    if (!deleted) await request.delete(`/api/connections/${id}`);
    const restored = await request.put("/api/tts/config", { data: original });
    expect(restored.ok()).toBeTruthy();
  }
});
