import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const APP_VERSION_STORAGE_VERSION = 65;
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * End-to-end coverage for the Inventory Tracker section.
 *
 * Drives the tracker through the chat API rather than a live agent run, since a
 * test environment has no model connection. That still exercises everything the
 * agent's output would touch on the way to the screen: persistence, the
 * game-state read path, section gating on the enabled agent, and the grid.
 */

async function prepareTrackerPanelClient(page: Page, chatId: string) {
  await page.addInitScript(
    ({ appVersion, chat, storageVersion }) => {
      // Suppress the What's New modal; its backdrop otherwise intercepts every click.
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      const storageKey = "marinara-engine-ui";
      const persisted = JSON.parse(localStorage.getItem(storageKey) ?? `{"state":{},"version":${storageVersion}}`) as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.hasCompletedOnboarding = true;
      persisted.state.sidebarOpen = false;
      persisted.state.rightPanelOpen = false;
      persisted.state.trackerPanelEnabled = true;
      persisted.state.trackerPanelOpen = false;
      persisted.state.trackerPanelSide = "left";
      persisted.state.trackerPanelSizeProfile = "expanded";
      persisted.state.trackerPanelHideHudWidgets = false;
      persisted.version ??= storageVersion;
      localStorage.setItem(storageKey, JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chat);
    },
    { appVersion: APP_VERSION, chat: chatId, storageVersion: APP_VERSION_STORAGE_VERSION },
  );
}

async function createInventoryTrackerChat(page: Page, name: string) {
  const chatResponse = await page.request.post("/api/chats", {
    data: { name, mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { enableAgents: true, activeAgentIds: ["inventory-tracker"] },
  });
  expect(metadataResponse.ok()).toBeTruthy();
  return chat;
}

async function seedInventoryTrackerState(page: Page, chatId: string) {
  const gameStateResponse = await page.request.patch(`/api/chats/${chatId}/game-state`, {
    data: {
      manual: true,
      playerStats: {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [],
        activeQuests: [],
        status: "",
        inventoryTrackerCurrencies: [{ name: "Silver coin", qty: 6 }],
        inventoryTrackerEquipped: [
          { name: "Family heirloom longsword", qty: 1 },
          { name: "Hunting knife", qty: 1 },
        ],
        inventoryTrackerCarried: [
          { name: "Billhook", qty: 1 },
          { name: "Scavenged axe", qty: 2 },
        ],
      },
    },
  });
  expect(gameStateResponse.ok()).toBeTruthy();
}

async function openTrackerPanel(page: Page) {
  await page.goto("/");
  const trackerToggle = page.locator('[data-tracker-panel-toggle="roleplay-hud"]:visible').first();
  await expect(trackerToggle).toBeVisible();
  await trackerToggle.click();
  const tracker = page.locator('[data-component="TrackerDataSidebarDesktop.left"]');
  await expect(tracker).toBeVisible();
  return tracker;
}

test.describe("Inventory Tracker", () => {
  test("renders tracked groups as a grid in the tracker panel", async ({ page }) => {
    const chat = await createInventoryTrackerChat(page, "Inventory Tracker Smoke");
    await seedInventoryTrackerState(page, chat.id);
    await prepareTrackerPanelClient(page, chat.id);
    await page.setViewportSize({ width: 1280, height: 940 });

    const tracker = await openTrackerPanel(page);

    // The section itself, gated on the inventory-tracker agent being enabled.
    await expect(tracker.getByRole("button", { name: "Inventory", exact: true })).toBeVisible();
    await expect(tracker.getByRole("button", { name: "Re-run inventory tracker" })).toBeVisible();

    // All three groups render, each with its own heading.
    for (const group of ["Currencies", "Equipped", "Carried"]) {
      await expect(tracker.getByText(group, { exact: true })).toBeVisible();
    }

    // Every seeded row reaches the screen as its own control — the failure this
    // feature exists to fix was rows collapsing into one truncated string.
    for (const itemName of ["Silver coin", "Family heirloom longsword", "Hunting knife", "Billhook", "Scavenged axe"]) {
      await expect(tracker.getByRole("button", { name: itemName, exact: true })).toBeVisible();
    }

    // Quantities survive the round trip.
    await expect(tracker.getByRole("spinbutton", { name: "Silver coin quantity" })).toHaveValue("6");
    await expect(tracker.getByRole("spinbutton", { name: "Scavenged axe quantity" })).toHaveValue("2");
  });

  test("keeps the section hidden when the agent is not enabled", async ({ page }) => {
    const chatResponse = await page.request.post("/api/chats", {
      data: { name: "Inventory Tracker Disabled Smoke", mode: "roleplay", characterIds: [] },
    });
    expect(chatResponse.ok()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: true, activeAgentIds: ["world-state"] },
    });
    expect(metadataResponse.ok()).toBeTruthy();

    await seedInventoryTrackerState(page, chat.id);
    await prepareTrackerPanelClient(page, chat.id);
    await page.setViewportSize({ width: 1280, height: 940 });

    const tracker = await openTrackerPanel(page);
    // The enabled tracker still renders, so an empty panel cannot mask the assertion.
    await expect(tracker.getByRole("button", { name: "Re-run world state tracker" })).toBeVisible();
    await expect(tracker.getByRole("button", { name: "Inventory", exact: true })).toHaveCount(0);
    await expect(tracker.getByRole("button", { name: "Billhook", exact: true })).toHaveCount(0);
  });
});
