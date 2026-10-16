import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// #7711: how long to wait for a slow voice server is set in the app, on the Text to Speech card and on each
// audio connection, and both start at the 60 s every request used before.
test("Request timeout saves on the Text to Speech card and on an audio connection", async ({
  page,
  request,
}, testInfo) => {
  const originalResponse = await request.get("/api/tts/config");
  expect(originalResponse.ok()).toBeTruthy();
  const original = await originalResponse.json();
  const created = await request.post("/api/connections", {
    data: {
      name: `Laptop voice ${testInfo.project.name}`,
      provider: "audio",
      audioSource: "openai",
      baseUrl: "http://127.0.0.1:9/v1",
      model: "tts-1",
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  try {
    const saved = await request.put("/api/tts/config", {
      data: { ...original, enabled: false, source: "openai", requestTimeoutMs: 60_000 },
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

    const openCard = async () => {
      await page.goto("/");
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openRightPanel("connections");
      });
      const card = page
        .locator('[data-component="RightPanel"]')
        .getByText("Text to Speech", { exact: true })
        .locator("xpath=../../..");
      await card.getByTitle("Expand").click();
      return card.getByLabel("Request timeout (seconds)", { exact: true });
    };
    const cardTimeout = await openCard();
    await expect(cardTimeout).toHaveValue("60");
    await cardTimeout.fill("300");
    await cardTimeout.blur();
    await expect.poll(async () => (await (await request.get("/api/tts/config")).json()).requestTimeoutMs).toBe(300_000);
    await cardTimeout.scrollIntoViewIfNeeded();
    await capture("tts-card-request-timeout");
    await expect(await openCard()).toHaveValue("300");

    const openConnection = async () => {
      await page.goto("/");
      await page.evaluate(async (connectionId) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(connectionId);
      }, id);
      return page.locator(".mari-editor-shell").getByLabel("Request timeout (seconds)", { exact: true });
    };
    const connectionTimeout = await openConnection();
    await connectionTimeout.scrollIntoViewIfNeeded();
    await expect(connectionTimeout).toHaveValue("60");
    await connectionTimeout.fill("240");
    await connectionTimeout.blur();
    await page.locator(".mari-editor-shell").getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => (await (await request.get(`/api/connections/${id}`)).json()).audioTimeoutMs)
      .toBe(240_000);
    await expect(page.locator(".mari-editor-shell").getByText("Unsaved", { exact: true })).toBeHidden();
    await capture("audio-connection-request-timeout");
    await expect(await openConnection()).toHaveValue("240");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await request.delete(`/api/connections/${id}`);
    const restored = await request.put("/api/tts/config", { data: original });
    expect(restored.ok()).toBeTruthy();
  }
});
