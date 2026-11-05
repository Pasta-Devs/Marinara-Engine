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

// Past log entries are kept per message, so they must still pick up an edit to an older line, and a
// regex script limited by depth must still apply to the newest turn only.
test("a long Session Log shows edits to older lines and depth-limited regex scripts", async ({ page, request }) => {
  const script = await request.post("/api/regex-scripts", {
    data: {
      name: "Newest turn marker",
      findRegex: "begins",
      replaceString: "begins (newest)",
      placement: ["ai_output"],
      applyMode: "display",
      flags: "g",
      minDepth: 0,
      maxDepth: 0,
    },
  });
  expect(script.ok()).toBeTruthy();
  const scriptId = ((await script.json()) as { id: string }).id;
  const chatId = await seedLongGame(request);
  try {
    await openGameChat(page, chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toBeVisible({ timeout: 30_000 });
    const logsButton = page.getByRole("button", { name: "Logs", exact: true }).filter({ visible: true }).first();
    await logsButton.click();
    const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Session Logs" }) });
    const log = dialog.locator('[data-game-section="logs"]');
    await expect(log).toContainText(`Turn ${TURNS} begins (newest) at the gatehouse.`);
    await expect(log).toContainText(`Turn ${TURNS - 1} begins at the gatehouse.`);
    await expect(log).not.toContainText(`Turn ${TURNS - 1} begins (newest)`);

    const olderRow = log
      .locator("[data-log-anchor-key]")
      .filter({ hasText: `Turn ${TURNS - 5} begins` })
      .first();
    await olderRow.hover();
    await olderRow.getByTitle("Edit", { exact: true }).click();
    const editor = olderRow.locator("textarea");
    await editor.fill(`Turn ${TURNS - 5} was rewritten.`);
    await editor.press("Control+Enter");
    await expect(log).toContainText(`Turn ${TURNS - 5} was rewritten.`);
    await expect(log).not.toContainText(`Turn ${TURNS - 5} begins`);

    await page.getByRole("button", { name: /close logs/i }).click();
    await expect(dialog).toBeHidden();
    await logsButton.click();
    await expect(log).toContainText(`Turn ${TURNS - 5} was rewritten.`);
    await expect(log).toContainText(`Turn ${TURNS} begins (newest) at the gatehouse.`);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
    await request.delete(`/api/regex-scripts/${scriptId}`);
  }
});
