// Conversation video messages in the Gallery (#7651 follow-ups): the empty Videos tab only offers Video and Animate
// when they exist, and a confirmed prompt review closes before the long clip request.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { chatSettingsDrawer, openChatSettingsTool } from "./chat-settings-tools.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

test.beforeEach(async ({ page }) => {
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    sidebarOpen: false,
    rightPanelOpen: false,
  });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
});

async function createConversationChat(request: APIRequestContext) {
  const characterResponse = await request.post("/api/characters", {
    data: { data: { name: `Video Fixture ${Date.now().toString(36)}`, first_mes: "" } },
  });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const characterId = ((await characterResponse.json()) as { id: string }).id;
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Conversation video gallery", mode: "conversation", characterIds: [characterId] },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  return { characterId, chatId: ((await chatResponse.json()) as { id: string }).id };
}

async function mockInstalledIllustrator(page: Page) {
  await page.route("**/api/capability-packages/installed", (route) =>
    route.fulfill({
      json: [
        {
          id: "illustrator",
          version: "1.0.0",
          manifest: {
            schemaVersion: 1,
            id: "illustrator",
            name: "Illustrator",
            version: "1.0.0",
            description: "Conversation video fixture.",
            engine: { min: "2.0.0", maxExclusive: "3.0.0" },
            kind: ["agent"],
            entrypoints: { agents: "agents.json" },
            files: [{ path: "agents.json", sha256: "0".repeat(64), bytes: 1 }],
            permissions: ["agent-runtime"],
            restartRequired: false,
          },
          installedAt: "2026-01-01T00:00:00.000Z",
          status: "active",
          error: null,
          readiness: "ready",
          readinessError: null,
          legacy: false,
        },
      ],
    }),
  );
}

async function openVideosTab(page: Page, chatId: string) {
  await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chatId);
  await page.goto("/");
  await openChatSettingsTool(page, "gallery");
  const drawer = chatSettingsDrawer(page, "gallery");
  await drawer.getByRole("tab", { name: /Videos/ }).click();
  return drawer;
}

test("the empty Videos tab offers Video and Animate only when they exist", async ({ page, request }) => {
  const { characterId, chatId } = await createConversationChat(request);
  try {
    let drawer = await openVideosTab(page, chatId);
    await expect(drawer.getByText("No videos yet", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Generated scene videos will appear here", { exact: true })).toBeVisible();
    await expect(drawer.getByText(/Send a video message/)).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Video", exact: true })).toHaveCount(0);

    await mockInstalledIllustrator(page);
    drawer = await openVideosTab(page, chatId);
    await expect(drawer.getByRole("button", { name: "Video", exact: true })).toBeVisible();
    await expect(
      drawer.getByText("Send a video message or animate a picture to fill this tab", { exact: true }),
    ).toBeVisible();
    await expect(drawer.getByText("Generated scene videos will appear here", { exact: true })).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
    await request.delete(`/api/characters/${characterId}`);
  }
});

test("a confirmed video prompt review closes before the clip is made", async ({ page, request }) => {
  const { characterId, chatId } = await createConversationChat(request);
  let generationStarted = false;
  let finishGeneration = () => {};
  const generationFinished = new Promise<void>((resolve) => (finishGeneration = resolve));
  try {
    await mockInstalledIllustrator(page);
    await page.route("**/api/app-settings/ui", (route) =>
      route.fulfill({
        json: { value: JSON.stringify({ reviewImagePromptsBeforeSend: true, chibiProfessorMariEnabled: false }) },
      }),
    );
    await page.route("**/api/gallery/*/video", async (route) => {
      const body = route.request().postDataJSON() as { previewOnly?: boolean; promptOverride?: string };
      if (body.previewOnly) {
        await route.fulfill({
          json: { prompt: "A wave at the camera.", durationSeconds: 5, aspectRatio: "16:9", resolution: "720p" },
        });
        return;
      }
      expect(body.promptOverride).toBe("A wave at the camera.");
      generationStarted = true;
      await generationFinished;
      await route.fulfill({ json: { messageId: null } });
    });

    const drawer = await openVideosTab(page, chatId);
    await drawer.getByRole("button", { name: "Video", exact: true }).click();
    const review = page.getByRole("dialog").filter({ hasText: "A wave at the camera." });
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => generationStarted).toBe(true);
    // The clip is still being made, and the review window is already closed.
    await expect(review).toHaveCount(0);
    finishGeneration();
    await expect(page.getByText("The video was saved to the Gallery's Videos tab.")).toBeVisible();
  } finally {
    finishGeneration();
    await request.delete(`/api/chats/${chatId}`);
    await request.delete(`/api/characters/${characterId}`);
  }
});
