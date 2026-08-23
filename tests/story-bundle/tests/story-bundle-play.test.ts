/**
 * Story Bundle Play → Roleplay — Playwright E2E Tests
 *
 * Covers: Play button integration (panel + editor)
 * - Play button in panel action pill is visible on hover
 * - Play button in editor header is visible
 * - Clicking play starts a roleplay chat (toast confirms)
 *
 * Each test imports its own data via importStoryBundleFixture and cleans up.
 */
import { expect, test } from "@playwright/test";
import path from "node:path";
import { BasePage } from "../pages/base.page.js";
import { HomePage } from "../../pages/home.page.js";
import { StoryBundlesPanelPage } from "../pages/story-bundles-panel.page.js";
import { StoryBundleEditorPage } from "../pages/story-bundle-editor.page.js";
import { StoryBundlePresetsTabPage } from "../pages/story-bundle-presets-tab.page.js";
import { importStoryBundleFixture } from "../helpers/story-bundle-fixture.js";
import { StoryBundleAPI } from "../helpers/story-bundle-api.js";

const DATA_DIR = path.resolve(import.meta.dirname, "..", "data");

test.describe("Story Bundle Play — Positive", () => {
  test("play button is visible in the row action pill on hover", async ({ page }) => {
    const base = new BasePage(page);
    const home = new HomePage(page);
    const panel = new StoryBundlesPanelPage(page);
    const api = new StoryBundleAPI(page);

    const bundle = await importStoryBundleFixture(page, path.join(DATA_DIR, "empty.json"), test.info().title);

    await base.goto();
    await home.openStoryBundlesPanel();
    await panel.waitFor();

    await panel.hoverRow(bundle.name);
    await expect(panel.playButtonLocator(bundle.name)).toBeVisible();

    await api.delete(bundle.id);
  });

  test("clicking play from panel starts a roleplay and shows success toast", async ({ page }) => {
    const base = new BasePage(page);
    const home = new HomePage(page);
    const panel = new StoryBundlesPanelPage(page);
    const api = new StoryBundleAPI(page);

    const bundle = await importStoryBundleFixture(page, path.join(DATA_DIR, "empty.json"), test.info().title);

    await base.goto();
    await home.openStoryBundlesPanel();
    await panel.waitFor();

    await panel.hoverRow(bundle.name);
    await panel.clickPlay(bundle.name);

    await expect(page.getByText("Roleplay started!")).toBeVisible({ timeout: 10_000 });

    await api.delete(bundle.id);
  });

  test("play button is visible in the editor header", async ({ page }) => {
    const base = new BasePage(page);
    const home = new HomePage(page);
    const panel = new StoryBundlesPanelPage(page);
    const editor = new StoryBundleEditorPage(page);
    const api = new StoryBundleAPI(page);

    const bundle = await importStoryBundleFixture(page, path.join(DATA_DIR, "empty.json"), test.info().title);

    await base.goto();
    await home.openStoryBundlesPanel();
    await panel.waitFor();

    await panel.clickRow(bundle.name);
    await editor.waitFor();

    await expect(editor.playButton).toBeVisible();

    await api.delete(bundle.id);
  });

  test("clicking play from editor starts a roleplay and shows success toast", async ({ page }) => {
    const base = new BasePage(page);
    const home = new HomePage(page);
    const panel = new StoryBundlesPanelPage(page);
    const editor = new StoryBundleEditorPage(page);
    const api = new StoryBundleAPI(page);

    const bundle = await importStoryBundleFixture(page, path.join(DATA_DIR, "empty.json"), test.info().title);

    await base.goto();
    await home.openStoryBundlesPanel();
    await panel.waitFor();

    await panel.clickRow(bundle.name);
    await editor.waitFor();

    await editor.playButton.click();

    await expect(page.getByText("Roleplay started!")).toBeVisible({ timeout: 10_000 });

    await api.delete(bundle.id);
  });

  test("playing a bundle with lorebooks activates them on the chat", async ({ page }) => {
    const base = new BasePage(page);
    const home = new HomePage(page);
    const panel = new StoryBundlesPanelPage(page);
    const editor = new StoryBundleEditorPage(page);
    const api = new StoryBundleAPI(page);

    // Create two lorebooks via API.
    const lore1 = await page.request.post("/api/lorebooks", {
      data: { name: `Lorebook Alpha ${test.info().title}` },
    });
    const lore2 = await page.request.post("/api/lorebooks", {
      data: { name: `Lorebook Beta ${test.info().title}` },
    });
    const lore1Data = (await lore1.json()) as { id: string };
    const lore2Data = (await lore2.json()) as { id: string };

    // Create a bundle with both lorebook IDs.
    const bundle = await api.create({
      name: `Lorebook Play Test ${test.info().title}`,
    });
    await page.request.patch(`/api/story-bundles/${bundle.id}`, {
      data: { lorebookIds: [lore1Data.id, lore2Data.id] },
    });

    await base.goto();
    await home.openStoryBundlesPanel();
    await panel.waitFor();

    await panel.clickRow(bundle.name);
    await editor.waitFor();

    await editor.playButton.click();
    await expect(page.getByText("Roleplay started!")).toBeVisible({ timeout: 10_000 });

    // Find the chat that was just created (matches the bundle name).
    const chatsResp = await page.request.get("/api/chats");
    const chats = (await chatsResp.json()) as Array<{ id: string; name: string; metadata: Record<string, unknown> }>;
    const chat = chats.find((c) => c.name === bundle.name);
    expect(chat).toBeDefined();

    // Verify both lorebooks are active on the chat.
    const meta = (chat!.metadata ?? {}) as Record<string, unknown>;
    const activeIds: string[] = Array.isArray(meta.activeLorebookIds)
      ? (meta.activeLorebookIds as string[])
      : [];
    expect(activeIds).toContain(lore1Data.id);
    expect(activeIds).toContain(lore2Data.id);

    // Cleanup.
    await api.delete(bundle.id);
    await page.request.delete(`/api/lorebooks/${lore1Data.id}`);
    await page.request.delete(`/api/lorebooks/${lore2Data.id}`);
  });
});

test.describe("Story Bundle Play — Negative", () => {
  test("play button is disabled when no connection is configured", async ({ page }) => {
    // Play succeeds even without a connection — the button is always enabled.
    // This test verifies the button remains functional in the default state.
    const base = new BasePage(page);
    const home = new HomePage(page);
    const panel = new StoryBundlesPanelPage(page);
    const api = new StoryBundleAPI(page);

    const bundle = await importStoryBundleFixture(page, path.join(DATA_DIR, "empty.json"), test.info().title);

    await base.goto();
    await home.openStoryBundlesPanel();
    await panel.waitFor();

    await panel.hoverRow(bundle.name);
    await expect(panel.playButtonLocator(bundle.name)).toBeEnabled();

    await api.delete(bundle.id);
  });
});

test.describe("Story Bundle Play — Sidebar Image", () => {
  const TINY_PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  test("playing a bundle with an image shows the bundle picture on the chat sidebar row", async ({ page }) => {
    const base = new BasePage(page);
    const home = new HomePage(page);
    const panel = new StoryBundlesPanelPage(page);
    const api = new StoryBundleAPI(page);

    const bundle = await importStoryBundleFixture(page, path.join(DATA_DIR, "empty.json"), test.info().title);

    // Upload a picture to the bundle so the sidebar has something to show.
    const uploadResp = await page.request.post(`/api/story-bundles/${bundle.id}/image`, {
      data: { image: `data:image/png;base64,${TINY_PNG_BASE64}` },
    });
    expect(uploadResp.ok()).toBeTruthy();
    const imagePath = ((await uploadResp.json()) as { imagePath: string | null }).imagePath;
    expect(imagePath).toBeTruthy();

    let chatId: string | null = null;
    try {
      await base.goto();
      await home.openStoryBundlesPanel();
      await panel.waitFor();

      await panel.hoverRow(bundle.name);
      await panel.clickPlay(bundle.name);

      await expect(page.getByText("Roleplay started!")).toBeVisible({ timeout: 10_000 });

      // The new chat must be tagged with the story bundle it came from.
      const chatsResp = await page.request.get("/api/chats");
      const chats = (await chatsResp.json()) as Array<{
        id: string;
        name: string;
        metadata: Record<string, unknown>;
      }>;
      const chat = chats.find((c) => c.name === bundle.name);
      expect(chat).toBeDefined();
      chatId = chat!.id;
      expect((chat!.metadata ?? {}).storyBundleId).toBe(bundle.id);

      // Open the chat sidebar via the UI store (same pattern as core-flows)
      // and switch to the Roleplay tab. On mobile viewports the Story
      // Bundles right panel is a full-screen overlay, so close it first —
      // otherwise it intercepts every sidebar click.
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts");
        const ui = useUIStore.getState();
        ui.closeRightPanel();
        ui.setSidebarOpen(true);
      });
      const sidebar = page.locator('[data-component="ChatSidebar"]');
      await expect(sidebar).toBeVisible();
      const roleplayTab = page.locator('[data-chat-mode-tab="roleplay"]');
      await expect(roleplayTab).toBeInViewport();
      await roleplayTab.click();

      // The bundle-started chat's row shows the bundle picture as its avatar.
      // Scope by src: the row also renders a background banner <img>, so a
      // bare first() match would hit the banner instead of the avatar.
      const chatRow = sidebar.locator(`[data-chat-id="${chatId}"]`);
      await expect(chatRow).toBeVisible();
      const bundleAvatar = chatRow.locator('img[src*="/api/story-bundles/images/file/"]');
      await expect(bundleAvatar).toBeVisible();
    } finally {
      if (chatId) await page.request.delete(`/api/chats/${chatId}?force=true`);
      await api.delete(bundle.id);
    }
  });

  test("a roleplay started without a story bundle keeps its default sidebar avatar", async ({ page }) => {
    const base = new BasePage(page);

    // A plain roleplay chat that never came from a story bundle.
    const createResp = await page.request.post("/api/chats", {
      data: { name: `Plain RP ${test.info().title}`, mode: "roleplay", characterIds: [] },
    });
    expect(createResp.ok()).toBeTruthy();
    const chat = (await createResp.json()) as { id: string; metadata: Record<string, unknown> };

    try {
      await base.goto();

      // Open the chat sidebar via the UI store (same pattern as core-flows)
      // and switch to the Roleplay tab.
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts");
        useUIStore.getState().setSidebarOpen(true);
      });
      const sidebar = page.locator('[data-component="ChatSidebar"]');
      await expect(sidebar).toBeVisible();
      const roleplayTab = page.locator('[data-chat-mode-tab="roleplay"]');
      await expect(roleplayTab).toBeInViewport();
      await roleplayTab.click();

      const chatRow = sidebar.locator(`[data-chat-id="${chat.id}"]`);
      await expect(chatRow).toBeVisible();
      // No story bundle picture — the row keeps the plain mode icon fallback.
      await expect(chatRow.locator('img[src*="story-bundles"]')).toHaveCount(0);
      expect((chat.metadata ?? {}).storyBundleId).toBeFalsy();
    } finally {
      await page.request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
});

test.describe("Story Bundle Play — Preset Loading", () => {
  test("playing a bundle with a preset applies the preset to the new roleplay chat", async ({ page }) => {
    const base = new BasePage(page);
    const home = new HomePage(page);
    const panel = new StoryBundlesPanelPage(page);
    const api = new StoryBundleAPI(page);

    // Create a prompt preset via API (no variables, so no choice dialog).
    const suffix = Date.now().toString(36);
    const presetResp = await page.request.post("/api/prompts", {
      data: { name: `SB Play Preset ${suffix}`, description: "Preset loading test fixture." },
    });
    expect(presetResp.ok()).toBeTruthy();
    const preset = (await presetResp.json()) as { id: string };

    // Create a bundle that references the preset.
    const bundle = await api.create({ name: `SB Preset Play ${suffix}` });
    const updateResp = await page.request.patch(`/api/story-bundles/${bundle.id}`, {
      data: { presetIds: [preset.id] },
    });
    expect(updateResp.ok()).toBeTruthy();

    let chatId: string | null = null;
    try {
      await base.goto();
      await home.openStoryBundlesPanel();
      await panel.waitFor();

      await panel.hoverRow(bundle.name);
      await panel.clickPlay(bundle.name);

      await expect(page.getByText("Roleplay started!")).toBeVisible({ timeout: 10_000 });

      // The new chat must carry the bundle's prompt preset.
      const chatsResp = await page.request.get("/api/chats");
      const chats = (await chatsResp.json()) as Array<{
        id: string;
        name: string;
        promptPresetId: string | null;
      }>;
      const chat = chats.find((c) => c.name === bundle.name);
      expect(chat).toBeDefined();
      chatId = chat!.id;
      expect(chat!.promptPresetId).toBe(preset.id);

      // The auto-opened settings drawer must show the bundle's preset as the
      // selected prompt preset — this is what "loaded in the RP" means to the
      // user. Scope to the prompt-preset section so we don't match the
      // settings-profile ("Profile") select, which shares the same class. The
      // section is collapsed by default, so expand it before reading the value.
      const presetSection = page.locator('[data-chat-settings-section="prompt-preset"]');
      await expect(presetSection).toBeVisible({ timeout: 10_000 });
      // The chat view can remount while the new chat loads; a header click
      // in that window is silently lost and leaves the section collapsed.
      // Self-heal: keep clicking until the section reports expanded.
      const presetHeader = presetSection.locator('[role="button"]').first();
      await expect
        .poll(
          async () => {
            if ((await presetHeader.getAttribute("aria-expanded")) !== "true") {
              await presetHeader.click();
            }
            return presetHeader.getAttribute("aria-expanded");
          },
          { timeout: 10_000 },
        )
        .toBe("true");
      const presetSelect = presetSection.locator("select.mari-preset-native-select").first();
      await expect(presetSelect).toBeVisible({ timeout: 10_000 });
      await expect(presetSelect).toHaveValue(preset.id);
    } finally {
      if (chatId) await page.request.delete(`/api/chats/${chatId}?force=true`);
      await api.delete(bundle.id);
      await page.request.delete(`/api/prompts/${preset.id}`);
    }
  });

  test("playing a bundle with a preset from the editor applies the preset to the new chat", async ({ page }) => {
    const base = new BasePage(page);
    const home = new HomePage(page);
    const panel = new StoryBundlesPanelPage(page);
    const editor = new StoryBundleEditorPage(page);
    const api = new StoryBundleAPI(page);

    const suffix = Date.now().toString(36);
    const presetResp = await page.request.post("/api/prompts", {
      data: { name: `SB Editor Preset ${suffix}`, description: "Preset loading test fixture (editor)." },
    });
    expect(presetResp.ok()).toBeTruthy();
    const preset = (await presetResp.json()) as { id: string };

    const bundle = await api.create({ name: `SB Editor Preset Play ${suffix}` });
    const updateResp = await page.request.patch(`/api/story-bundles/${bundle.id}`, {
      data: { presetIds: [preset.id] },
    });
    expect(updateResp.ok()).toBeTruthy();

    let chatId: string | null = null;
    try {
      await base.goto();
      await home.openStoryBundlesPanel();
      await panel.waitFor();

      await panel.clickRow(bundle.name);
      await editor.waitFor();

      await editor.playButton.click();
      await expect(page.getByText("Roleplay started!")).toBeVisible({ timeout: 10_000 });

      const chatsResp = await page.request.get("/api/chats");
      const chats = (await chatsResp.json()) as Array<{
        id: string;
        name: string;
        promptPresetId: string | null;
      }>;
      const chat = chats.find((c) => c.name === bundle.name);
      expect(chat).toBeDefined();
      chatId = chat!.id;
      expect(chat!.promptPresetId).toBe(preset.id);
    } finally {
      if (chatId) await page.request.delete(`/api/chats/${chatId}?force=true`);
      await api.delete(bundle.id);
      await page.request.delete(`/api/prompts/${preset.id}`);
    }
  });

  test("playing from the editor applies an unsaved preset selection", async ({ page }) => {
    const base = new BasePage(page);
    const home = new HomePage(page);
    const panel = new StoryBundlesPanelPage(page);
    const editor = new StoryBundleEditorPage(page);
    const presetsTab = new StoryBundlePresetsTabPage(page);
    const api = new StoryBundleAPI(page);

    const suffix = Date.now().toString(36);
    const presetResp = await page.request.post("/api/prompts", {
      data: { name: `SB Unsaved Preset ${suffix}`, description: "Unsaved preset selection test fixture." },
    });
    expect(presetResp.ok()).toBeTruthy();
    const preset = (await presetResp.json()) as { id: string };

    // Bundle starts WITHOUT the preset — it is only added in the editor draft.
    const bundle = await api.create({ name: `SB Unsaved Preset Play ${suffix}` });

    let chatId: string | null = null;
    try {
      await base.goto();
      await home.openStoryBundlesPanel();
      await panel.waitFor();

      await panel.clickRow(bundle.name);
      await editor.waitFor();

      // Add the preset in the Presets tab but do NOT save.
      await editor.switchToPresets();
      await presetsTab.waitFor();
      await presetsTab.search(`SB Unsaved Preset ${suffix}`);
      await presetsTab.addItem(preset.id);
      await expect(presetsTab.removeButtonLocator(preset.id)).toBeVisible({ timeout: 5_000 });

      // Play directly from the editor — the unsaved draft must be honored.
      await editor.playButton.click();
      await expect(page.getByText("Roleplay started!")).toBeVisible({ timeout: 10_000 });

      const chatsResp = await page.request.get("/api/chats");
      const chats = (await chatsResp.json()) as Array<{
        id: string;
        name: string;
        promptPresetId: string | null;
      }>;
      const chat = chats.find((c) => c.name === bundle.name);
      expect(chat).toBeDefined();
      chatId = chat!.id;
      expect(chat!.promptPresetId).toBe(preset.id);
    } finally {
      if (chatId) await page.request.delete(`/api/chats/${chatId}?force=true`);
      await api.delete(bundle.id);
      await page.request.delete(`/api/prompts/${preset.id}`);
    }
  });
});
