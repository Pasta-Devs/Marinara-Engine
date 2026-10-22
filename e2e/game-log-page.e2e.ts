import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// A long Game opened its Session Log on every entry when Messages per page was 0 (load all), which
// took seconds on a phone. The log opens on the newest 20 entries; Older and All still reach the rest.
const TURNS = 30;

async function seedLongGame(request: APIRequestContext) {
  const created = await request.post("/api/chats", {
    data: { name: "Long Session Log", mode: "game", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  const meta = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { gameId: "log-page-fixture", gameSessionStatus: "active", gameIntroPresented: true },
  });
  expect(meta.ok()).toBeTruthy();
  const base = Date.now() - TURNS * 1000;
  for (let turn = 0; turn < TURNS; turn++) {
    const saved = await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: `Turn ${turn + 1} begins at the gatehouse.`,
        createdAt: new Date(base + turn * 1000).toISOString(),
      },
    });
    expect(saved.ok()).toBeTruthy();
  }
  return chat.id;
}

async function openGameChat(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    gameInstantTextReveal: true,
    gameDialogueDisplayMode: "classic",
    messagesPerPage: 0,
  });
  await page.addInitScript(
    ({ id, appVersion }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    },
    { id: chatId, appVersion: version },
  );
  await page.goto("/");
}

test("a long Session Log opens on its newest page when Messages per page loads all", async ({ page, request }) => {
  const chatId = await seedLongGame(request);
  try {
    await openGameChat(page, chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Logs", exact: true }).filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Session Logs" }) });
    const log = dialog.locator('[data-game-section="logs"]');
    await expect(log).toContainText(`Turn ${TURNS} begins`);
    await expect(log).toContainText(`Showing 20 of ${TURNS}`);
    await expect(log).not.toContainText("Turn 1 begins");
    await log.getByRole("button", { name: "All", exact: true }).click();
    await expect(log).toContainText(`Showing ${TURNS} of ${TURNS}`);
    await expect(log).toContainText("Turn 1 begins");
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});
