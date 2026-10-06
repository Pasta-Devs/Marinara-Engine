import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const characterWindowId = "drawer:trackers:tracker-characters";
test.use({ reducedMotion: "reduce" });

async function createChat(request: APIRequestContext) {
  const response = await request.post("/api/chats", {
    data: { name: "Tracker routing and readable cards", mode: "roleplay", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = await response.json();
  expect(
    (
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: { enableAgents: true, activeAgentIds: ["character-tracker"] },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.patch(`/api/chats/${chat.id}/game-state`, {
        data: {
          manual: true,
          presentCharacters: [
            {
              characterId: "thrum",
              name: "Thrum",
              emoji: "🧔",
              mood: "determined",
              appearance: "stocky dwarf with a braided beard",
              outfit: "leather apron, heavy boots, iron bracers",
              thoughts: "If I can just get my strength up, I can smash through Floor 4.",
              stats: [{ name: "HP", value: 150, max: 150 }],
              customFields: { role: "Adventurer" },
            },
            {
              characterId: "elara",
              name: "Elara",
              emoji: "🧝",
              mood: "serene",
              appearance: "tall elf with pointed ears and silver hair",
              outfit: "silk robes, silver circlet",
              thoughts: "The mana flow in this domain is peculiar.",
              stats: [{ name: "HP", value: 80, max: 80 }],
              customFields: { role: "Adventurer" },
            },
          ],
        },
      })
    ).ok(),
  ).toBeTruthy();
  return chat as { id: string };
}

async function prepare(page: Page, chatId: string, ui: Record<string, unknown>) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    appAccentPulseMode: false,
    ...ui,
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
}

for (const theme of ["dark", "light"]) {
  test(`detached characters have one heading and readable cards that reflow (${theme})`, async ({
    page,
    request,
    isMobile,
  }, info) => {
    test.skip(isMobile, "Desktop has resizable detached tracker windows.");
    const chat = await createChat(request);
    try {
      await prepare(page, chat.id, { theme, trackerPanelEnabled: false, trackerPanelOpen: false });
      await page.goto("/");
      await page.locator('.mari-window-bubble[data-window="trackers"]').click();
      const trackers = page.locator('.mari-window[data-window="trackers"]');
      await trackers.getByRole("button", { name: "Open Present Characters in its own window", exact: true }).click();
      const detached = page.locator(`.mari-window[data-window="${characterWindowId}"]`);
      await expect(detached).toBeVisible();
      await detached.locator('[data-window-control="pin"]').click();
      await trackers.getByRole("button", { name: "Close Trackers", exact: true }).click();
      await page.screenshot({ path: info.outputPath(`detached-characters-${theme}.png`), animations: "disabled" });
      await expect(detached.getByText("Present Characters", { exact: true })).toHaveCount(1);
      await expect(detached.getByText("stocky dwarf with a braided beard", { exact: true })).toBeVisible();
      await expect(detached.getByText("leather apron, heavy boots, iron bracers", { exact: true })).toBeVisible();
      const cards = detached.locator("article[data-tracker-size-profile]");
      await expect(cards).toHaveCount(2);
      const positions = () =>
        cards.evaluateAll((elements) =>
          elements.map((element) => {
            const box = element.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width };
          }),
        );
      expect((await positions())[0]!.x).toBeCloseTo((await positions())[1]!.x, 0);
      const resize = detached.getByRole("button", { name: "Resize window with the arrow keys", exact: true });
      for (let step = 0; step < 12; step++) await resize.press("Shift+ArrowRight");
      await expect.poll(async () => (await positions())[1]!.x - (await positions())[0]!.x).toBeGreaterThan(250);
      expect((await positions())[0]!.y).toBeCloseTo((await positions())[1]!.y, 0);
      const overflow = await detached
        .locator("[data-tracker-character-grid]")
        .evaluate((element) => element.scrollWidth > element.clientWidth + 1);
      expect(overflow).toBe(false);
      await page.screenshot({ path: info.outputPath(`detached-characters-wide-${theme}.png`), animations: "disabled" });

      // The reused cards still edit the same persisted tracker state.
      await detached.getByText("determined", { exact: true }).click();
      const moodEditor = detached.getByRole("textbox").first();
      await moodEditor.fill("relieved");
      await moodEditor.press("Enter");
      await expect
        .poll(
          async () => (await (await request.get(`/api/chats/${chat.id}/game-state`)).json()).presentCharacters[0].mood,
        )
        .toBe("relieved");
      await detached.getByRole("button", { name: "Put back in Trackers", exact: true }).click();
      await expect(detached).toHaveCount(0);
      await page.locator('.mari-window-bubble[data-window="trackers"]').click();
      await expect(trackers.getByText("relieved", { exact: true })).toBeVisible();
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
}

test("Trackers reopens the selected panel and respects each chat's choice", async ({
  page,
  request,
  isMobile,
}, info) => {
  test.skip(isMobile, "Phone launcher and fallback widgets are covered by phone-bubbles.");
  const first = await createChat(request);
  const second = await createChat(request);
  try {
    await prepare(page, first.id, {
      trackerPanelEnabled: true,
      trackerPanelOpen: true,
      trackerPanelOpenByChatId: { [first.id]: true, [second.id]: false },
    });
    await page.goto("/");
    const panel = page.locator('[data-component="TrackerDataSidebar"]:visible');
    const panelLauncher = page.locator('.mari-window-bubble[data-tracker-panel-toggle="bubble"]');
    const classicLauncher = page.locator('.mari-window-bubble[data-window="trackers"]');
    await expect(panel).toBeVisible();
    await expect(classicLauncher).toHaveCount(0);
    await panel.getByRole("button", { name: "Close tracker panel", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(panelLauncher).toBeVisible();
    await expect(panelLauncher).toHaveAccessibleName("Open Trackers");
    await expect(classicLauncher).toHaveCount(0);
    await panelLauncher.click();
    await expect(panel).toBeVisible();
    await page.screenshot({ path: info.outputPath("trackers-opens-panel.png"), animations: "disabled" });
    await panel.getByRole("button", { name: "Close tracker panel", exact: true }).click();
    const switchTo = async (id: string) =>
      page.evaluate(async (chatId) => {
        const module = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
        module.useChatStore.getState().setActiveChatId(chatId);
      }, id);
    await switchTo(second.id);
    await expect(panelLauncher).toHaveCount(0);
    await expect(classicLauncher).toBeVisible();
    await classicLauncher.click();
    await expect(page.locator('.mari-window[data-window="trackers"]')).toBeVisible();
    await switchTo(first.id);
    await expect(classicLauncher).toHaveCount(0);
    await expect(panelLauncher).toBeVisible();
    await expect(panel).toBeVisible();
  } finally {
    await Promise.all([first, second].map((chat) => request.delete(`/api/chats/${chat.id}?force=true`)));
  }
});
