import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

test("Add models for an old ElevenLabs row opens the Voice job picker instead of a blank modal", async ({ page, request }, info) => {
  const response = await request.post("/api/connections", {
    data: {
      name: "ElevenLabs voice regression",
      provider: "audio",
      audioSource: "elevenlabs",
      baseUrl: "https://api.elevenlabs.io",
      apiKey: "",
      model: "eleven_multilingual_v2",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const row = (await response.json()) as { id: string; accountId: string };
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    await page.route("**/api/connections/*/models*", (route) =>
      route.fulfill({
        json: {
          models: [
            { id: "eleven_multilingual_v2", name: "Eleven Multilingual v2" },
            { id: "eleven_v3", name: "Eleven v3" },
          ],
        },
      }),
    );
    await page.goto("/");
    await page.evaluate(async (accountId) => {
      const { openAddModels } = await import("/src/lib/add-connection.ts" as string);
      openAddModels({ accountId });
    }, row.accountId);
    // #16: an old Voice row has no models to add; the Voice job's picker opens, not the Model window.
    const picker = page.getByRole("dialog", { name: "Model for Voice" });
    await expect(picker).toBeVisible();
    // The picker browses the account's TTS catalog (ids like eleven_v3), not only its saved row.
    await expect(picker.locator('[data-switcher-entry="eleven_v3"]').filter({ visible: true })).toBeVisible();
    await expect(page.locator("[data-add-connection-step]")).toHaveCount(0);
    expect(
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        return useUIStore.getState().connectionDetailId;
      }),
    ).toBeNull();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: info.outputPath(`elevenlabs-voice-picker-${width}.png`) });
    }
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/connections/${row.id}`);
    await request.delete(`/api/connection-accounts/${row.accountId}`);
  }
});

test("The Voice job turns Text to Speech on with a built-in source", async ({ page, request }, testInfo) => {
  const response = await request.post("/api/connections", {
    data: {
      name: "ElevenLabs off regression",
      provider: "audio",
      audioSource: "elevenlabs",
      baseUrl: "https://api.elevenlabs.io",
      apiKey: "",
      model: "eleven_multilingual_v2",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const row = (await response.json()) as { id: string; accountId: string };
  const original = await (await request.get("/api/tts/config")).json();
  try {
    const off = await request.put("/api/tts/config", { data: { ...original, enabled: false, connectionId: row.id } });
    expect(off.ok(), await off.text()).toBeTruthy();
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: true,
      rightPanel: "connections",
      connectionsCollapsed: [],
    });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    await page.goto("/");
    const voice = page
      .locator("[data-connections-panel]")
      .filter({ visible: true })
      .locator('[data-defaults-role="voice"]');
    // The Voice job is the switch: off reads "Off", and a built-in choice On this device turns text to speech on.
    await expect(voice.getByRole("button", { name: "Turn on", exact: true })).toHaveCount(0);
    await expect(voice).toContainText("Off");
    await voice.locator("[data-defaults-tile]").click();
    const picker = page.getByRole("dialog", { name: "Model for Voice", exact: true });
    // A phone opens the picker on the chosen account's models; the built-in choices are one step up.
    if (testInfo.project.name.includes("mobile"))
      await picker.getByRole("button", { name: "All connections", exact: true }).click();
    await picker
      .getByRole("button", { name: /This device/ })
      .first()
      .click();
    await expect
      .poll(async () => {
        const config = await (await request.get("/api/tts/config")).json();
        return [config.enabled, config.source, config.connectionId];
      })
      .toEqual([true, "pockettts", ""]);
  } finally {
    await request.put("/api/tts/config", { data: original });
    await request.delete(`/api/connections/${row.id}`);
    await request.delete(`/api/connection-accounts/${row.accountId}`);
  }
});
