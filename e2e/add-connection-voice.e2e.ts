import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

test("Add models for ElevenLabs opens the audio editor instead of a blank modal", async ({ page, request }, info) => {
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
    await page.goto("/");
    await page.evaluate(async (accountId) => {
      const { openAddModels } = await import("/src/lib/add-connection.ts" as string);
      openAddModels({ accountId });
    }, row.accountId);
    await expect(page.locator("[data-add-connection-step]")).toHaveCount(0);
    await expect(page.getByText("Default voice", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          return useUIStore.getState().connectionDetailId;
        }),
      )
      .toBe(row.id);
    await expect(page.locator("[data-connection-model-picker]")).toBeVisible();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: info.outputPath(`elevenlabs-editor-${width}.png`) });
    }
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/connections/${row.id}`);
    await request.delete(`/api/connection-accounts/${row.accountId}`);
  }
});

test("A voice job with Text to Speech off offers Turn on", async ({ page, request }) => {
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
    await voice.getByRole("button", { name: "Turn on", exact: true }).click();
    await expect.poll(async () => (await (await request.get("/api/tts/config")).json()).enabled).toBe(true);
  } finally {
    await request.put("/api/tts/config", { data: original });
    await request.delete(`/api/connections/${row.id}`);
    await request.delete(`/api/connection-accounts/${row.accountId}`);
  }
});
