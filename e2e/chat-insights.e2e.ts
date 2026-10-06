import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { renderTranscriptHtml } from "../packages/server/src/services/chat-insights/transcript-document.js";
import { downloadExport } from "./export-save.js";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettingsTool } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("standalone stories render avatars and included reasoning offline in print", async ({ page }, testInfo) => {
  const avatar = `data:image/png;base64,${readFileSync(new URL("../packages/client/public/icon-192.png", import.meta.url)).toString("base64")}`;
  const reasoningParagraphs = ["The road is safest in daylight.", "We should rest before the journey."];
  const html = renderTranscriptHtml({
    title: "Moon Road",
    entries: [
      {
        speakerKey: "ayla",
        speaker: "Ayla",
        role: "assistant",
        content: "*smiles* We ride at dawn.",
        thinking: reasoningParagraphs.join("\n\n"),
      },
      { speakerKey: "alex", speaker: "Alex", role: "user", content: "Then we should rest." },
      { speakerKey: "ayla", speaker: "Ayla", role: "assistant", content: "One last story first." },
    ],
    avatars: new Map([["ayla", avatar]]),
  });
  await page.context().setOffline(true);
  await page.setContent(html);
  await expect(page.locator("script")).toHaveCount(0);
  const details = page.locator("details");
  const reasoning = details.locator("p");
  await expect(details).toHaveJSProperty("open", false);
  await expect(reasoning.first()).toBeHidden();
  await details.locator("summary").click();
  await expect(reasoning.first()).toBeVisible();
  for (const paragraph of reasoningParagraphs) {
    await expect(page.locator("p:visible").filter({ hasText: paragraph })).toHaveCount(1);
  }
  await details.locator("summary").click();
  await expect(reasoning.first()).toBeHidden();
  const portraits = page.locator(".turn.assistant .avatar");
  await expect(portraits).toHaveCount(2);
  await expect(page.locator(".turn.user .avatar")).toHaveText("A");
  await page.screenshot({ path: testInfo.outputPath("story-avatars.png") });
  for (const medium of ["screen", "print"] as const) {
    await page.emulateMedia({ media: medium });
    await page.screenshot({ path: testInfo.outputPath(`story-reasoning-${medium}.png`) });
    await expect(details).toHaveJSProperty("open", false);
    for (const paragraph of reasoningParagraphs) {
      await expect(page.locator("p:visible").filter({ hasText: paragraph })).toHaveCount(medium === "print" ? 1 : 0);
    }
    for (const portrait of await portraits.all()) {
      await expect(portrait).toBeVisible();
      await expect(portrait).toHaveCSS("background-image", `url("${avatar}")`);
      expect(
        await portrait.evaluate(async (element) => {
          const image = new Image();
          image.src = getComputedStyle(element).backgroundImage.slice(5, -2);
          await image.decode();
          return image.naturalWidth;
        }),
      ).toBe(192);
    }
  }
  await page.emulateMedia({ media: "screen" });
  await expect(reasoning.first()).toBeHidden();
  for (const paragraph of reasoningParagraphs) {
    await expect(page.locator("p:visible").filter({ hasText: paragraph })).toHaveCount(0);
  }
});

test("chat search, stats and story exports work with private content filtered", async ({
  page,
  request,
  playwright,
  baseURL,
}, testInfo) => {
  const chatName = `Insights fixture ${testInfo.workerIndex} ${Date.now()}`;
  const cleanupRequest = await playwright.request.newContext({ baseURL });
  let chatId: string | null = null;
  let gameChatId: string | null = null;
  let testFailure: unknown;

  try {
    const created = await request.post("/api/chats", {
      data: { name: chatName, mode: "roleplay", characterIds: [] },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    chatId = ((await created.json()) as { id: string }).id;

    const messages = [
      { role: "user", content: "Visible comet phrase for insights search." },
      { role: "assistant", content: '<img src=x onerror="alert(1)"><script>alert(2)</script>' },
      {
        role: "assistant",
        content: "private comet needle must stay hidden",
        extra: { hiddenFromUser: true },
      },
    ];
    for (const message of messages) {
      const response = await request.post(`/api/chats/${chatId}/messages`, { data: message });
      expect(response.ok(), await response.text()).toBeTruthy();
    }
    const gameCreated = await request.post("/api/chats", {
      data: { name: `${chatName} Game`, mode: "game", characterIds: [] },
    });
    expect(gameCreated.ok(), await gameCreated.text()).toBeTruthy();
    gameChatId = ((await gameCreated.json()) as { id: string }).id;
    const gameMessage = await request.post(`/api/chats/${gameChatId}/messages`, {
      data: { role: "narrator", content: "Game mode jump fixture phrase." },
    });
    expect(gameMessage.ok(), await gameMessage.text()).toBeTruthy();

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
    await seedUIState(
      page,
      {
        hasCompletedOnboarding: true,
        sidebarOpen: true,
        rightPanelOpen: false,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        theme: testInfo.project.name.includes("mobile") ? "dark" : "light",
      },
      "if-missing",
    );
    await page.addInitScript(
      ({ id, version: appVersion }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      },
      { id: chatId, version },
    );
    // Exercise the browser-download fallback deterministically instead of the
    // Chromium save-file picker, which Playwright does not expose as a download.
    await page.addInitScript(() => {
      Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: undefined });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Visible comet phrase for insights search.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Search all chats", exact: true }).click();
    const searchDialog = page.getByRole("dialog", { name: "Search all chats" });
    const search = page.getByRole("searchbox", { name: "Search messages in all chats" });
    await search.fill("visible comet phrase");
    await expect(searchDialog.getByText(/1 match/u)).toBeVisible();
    await expect(searchDialog.getByText("Visible comet phrase for insights search.", { exact: false })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("search-results.png") });
    await search.fill("");
    await expect(searchDialog.getByText("Visible comet phrase for insights search.", { exact: false })).toBeHidden();
    await search.press("Enter");
    await expect(searchDialog).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("search-cleared.png") });
    await search.fill("private comet needle");
    await expect(searchDialog.getByText("No messages match.", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    // Mobile projects share a server, whose minute-long overview cache may
    // still contain the preceding project's already-deleted fixture chats.
    const timeZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    const refreshedActivity = await request.get(
      `/api/chat-insights/activity?refresh=true&tz=${encodeURIComponent(timeZone)}`,
    );
    expect(refreshedActivity.ok(), await refreshedActivity.text()).toBeTruthy();
    await page.getByRole("button", { name: "Activity overview", exact: true }).click();
    const activityDialog = page.getByRole("dialog", { name: "Activity", exact: true });
    await expect(activityDialog.getByRole("img", { name: /Activity heatmap/u })).toBeVisible();
    await expect(activityDialog.getByRole("button", { name: chatName }).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("activity-overview.png") });
    await page.keyboard.press("Escape");
    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "Close chats", exact: true }).click();
    }

    const openChatMenu = () => openChatSettingsTool(page, "chat-branches");
    await openChatMenu();
    await page.getByRole("button", { name: "Stats", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(chatName);
    await expect(page.getByText("Messages", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("chat-stats.png") });
    await page.keyboard.press("Escape");

    await openChatMenu();
    const exportChat = async (format: "Markdown" | "Story", extension: "md" | "html") => {
      const download = await downloadExport(page, () =>
        page.getByRole("button", { name: format, exact: true }).click(),
      );
      expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`, "u"));
      const body = await readFile((await download.path())!);
      const exported = body.toString("utf8");
      expect(exported).toContain("&lt;img");
      expect(exported).toContain("&lt;script&gt;");
      expect(exported).not.toMatch(/<img\b|<script\b/i);
      expect(exported).not.toContain("private comet needle");
    };
    await exportChat("Markdown", "md");
    await exportChat("Story", "html");
    await page.keyboard.press("Escape");

    await page.keyboard.press("Control+Shift+F");
    const gameSearchDialog = page.getByRole("dialog", { name: "Search all chats" });
    const gameSearch = page.getByRole("searchbox", { name: "Search messages in all chats" });
    await gameSearch.fill("game mode jump fixture phrase");
    await gameSearchDialog.getByRole("button", { name: `${chatName} Game` }).click();
    await expect(
      page.getByText("Jumping to a message is not available in Game mode. Open the game log to read earlier turns.", {
        exact: true,
      }),
    ).toBeVisible();
  } catch (error) {
    testFailure = error;
    throw error;
  } finally {
    let cleanupFailure: unknown;
    try {
      for (const id of [gameChatId, chatId]) {
        if (!id) continue;
        const deleted = await cleanupRequest.delete(`/api/chats/${id}?force=true`);
        if (!deleted.ok()) cleanupFailure ??= new Error(`Could not clean up chat ${id}: ${await deleted.text()}`);
      }
    } catch (error) {
      cleanupFailure = error;
    } finally {
      await cleanupRequest.dispose();
    }
    if (cleanupFailure && !testFailure) throw cleanupFailure;
  }
});
