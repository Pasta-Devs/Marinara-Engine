import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("the Presets tabs mark built-ins and let profiles and prompts move into folders", async ({
  page,
  request,
  isMobile,
}, info) => {
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    theme: isMobile ? "dark" : "light",
    visualTheme: info.project.name === "mobile-webkit" ? "sillytavern" : "default",
  });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));

  const cleanup: string[] = [];
  const create = async (url: string, data: Record<string, unknown>): Promise<{ id: string }> => {
    const response = await request.post(url, { data });
    expect(response.ok()).toBeTruthy();
    const row = await response.json();
    cleanup.push(`${url}/${row.id}`);
    return row;
  };
  try {
    const stockName = "Marinara's Universal Preset";
    const userPreset = await create("/api/prompts", { name: stockName, author: "Marinara" });
    const promptFolder = await create("/api/library-folders/presets", { name: "Filed prompts" });
    const userProfile = await create("/api/chat-presets", { name: "Custom profile", mode: "conversation" });
    await create("/api/regex-scripts", {
      name: "Clean HTML (Outgoing Prompt)",
      findRegex: "fixture",
      placement: ["ai_output"],
      order: 5,
    });

    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openRightPanel("presets");
    });
    const panel = page.locator('[data-panel-key="presets"]');
    const tabs = panel.getByRole("group", { name: "Presets", exact: true });
    const prompts = panel.locator('[data-touch-drag-card="preset"]');
    await expect(prompts.first().getByText("Built-in", { exact: true })).toBeVisible();
    const stockPromptId = (await prompts.first().getAttribute("data-drag-id"))!;
    expect(stockPromptId).not.toBe(userPreset.id);
    await expect(prompts.filter({ hasText: stockName })).toHaveCount(2);
    const stockPrompt = prompts.and(page.locator(`[data-drag-id="${stockPromptId}"]`));
    const editablePrompt = prompts.and(page.locator(`[data-drag-id="${userPreset.id}"]`));
    await expect(editablePrompt.getByText("Built-in", { exact: true })).toHaveCount(0);
    await expect(editablePrompt.getByRole("button", { name: "Delete preset", includeHidden: true })).toHaveCount(1);
    await expect(stockPrompt.getByRole("button", { name: "Delete preset", includeHidden: true })).toHaveCount(0);
    await panel.screenshot({ path: info.outputPath("built-in-prompts.png"), animations: "disabled", scale: "css" });

    const promptFolderRow = panel.locator(`[data-preset-folder-id="${promptFolder.id}"]`);
    if (isMobile) {
      const source = (await stockPrompt.boundingBox())!;
      const target = (await promptFolderRow.boundingBox())!;
      await stockPrompt.evaluate(
        async (element, { source, target }) => {
          const dispatch = (type: string, box: typeof source) => {
            const touch = { identifier: 1, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperties(event, {
              touches: { value: type === "touchend" ? [] : [touch] },
              changedTouches: { value: [touch] },
            });
            element.dispatchEvent(event);
          };
          dispatch("touchstart", source);
          await new Promise((resolve) => setTimeout(resolve, 350));
          dispatch("touchmove", target);
          dispatch("touchend", target);
        },
        { source, target },
      );
    } else {
      await stockPrompt.dragTo(promptFolderRow);
    }
    await expect(promptFolderRow.locator("[inert]").getByText("Built-in", { exact: true })).toHaveCount(1);
    await expect(prompts.getByText("Built-in", { exact: true })).toHaveCount(1);

    await tabs.getByRole("button", { name: "Profiles", exact: true }).click();
    const profileRows = page.locator("[data-settings-profile-row]");
    await expect(profileRows.nth(0).getByText("Built-in", { exact: true })).toBeVisible();
    await expect(profileRows.nth(1).getByText("Built-in", { exact: true })).toBeVisible();
    await expect(profileRows.nth(2)).toContainText("Custom profile");
    await expect(profileRows.nth(0).locator(".mari-panel-gradient--presets")).toBeVisible();
    await expect(page.locator("[data-settings-profile-list] > hr")).toBeVisible();
    const profileId = (await profileRows.first().getAttribute("data-settings-profile-row"))!;
    const roleplayProfileId = (await profileRows.nth(1).getAttribute("data-settings-profile-row"))!;
    const profile = page.locator(`[data-settings-profile-row="${profileId}"]`);
    const roleplayProfile = page.locator(`[data-settings-profile-row="${roleplayProfileId}"]`);
    const conversationFilter = panel.getByRole("button", { name: "Conversation", exact: true });
    const roleplayFilter = panel.getByRole("button", { name: "Roleplay", exact: true });
    const allModes = panel.getByRole("button", { name: "All", exact: true });
    const profileSearch = panel.getByPlaceholder("Search profiles");
    await conversationFilter.click();
    await page.getByRole("button", { name: "New Folder", exact: true }).click();
    const rename = page.getByRole("textbox", { name: "Rename folder" });
    await rename.fill("Filed profiles");
    const profileFolder = page.locator("[data-profile-folder]");
    const profileFolderId = (await profileFolder.getAttribute("data-profile-folder"))!;
    cleanup.push(`/api/library-folders/profiles/${profileFolderId}`);
    await rename.press("Enter");
    const profileFolderToggle = profileFolder.getByRole("button", { name: "Filed profiles", exact: true });
    await expect(profileFolderToggle).toBeVisible();
    if (!isMobile) await profile.hover();
    await profile.getByRole("button", { name: "Move to folder", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Filed profiles" }).click();
    await expect(profileFolder.getByText("Built-in", { exact: true })).toBeVisible();
    await roleplayFilter.click();
    await expect(profileFolder).toHaveCount(0);
    await profileSearch.fill("Custom profile");
    await expect(panel.getByText("Nothing matches your search", { exact: true })).toBeVisible();
    await profileSearch.clear();
    await allModes.click();
    await profileFolderToggle.click();
    await expect(profileFolderToggle).toHaveAttribute("aria-expanded", "false");
    await expect(profileFolder.locator("[inert]").getByText("Built-in", { exact: true })).toHaveCount(1);
    await expect(page.locator("[data-settings-profile-list] > [data-settings-profile-row]")).toHaveCount(2);
    await panel.screenshot({ path: info.outputPath("built-in-profiles.png"), animations: "disabled", scale: "css" });

    await expect(profileFolder).toHaveAttribute("data-profile-folder", profileFolderId);
    await expect
      .poll(async () =>
        (await (await request.get("/api/library-folders/profiles")).json()).find(
          (folder: { id: string }) => folder.id === profileFolderId,
        ),
      )
      .toMatchObject({ collapsed: true, itemIds: [profileId] });
    expect(
      (
        await request.post("/api/library-folders/profiles/move", {
          data: { folderId: profileFolderId, itemIds: [userProfile.id] },
        })
      ).ok(),
    ).toBeTruthy();
    expect((await request.delete(`/api/chat-presets/${userProfile.id}`)).ok()).toBeTruthy();
    expect(
      (await (await request.get("/api/library-folders/profiles")).json()).find(
        (folder: { id: string }) => folder.id === profileFolderId,
      ),
    ).toMatchObject({ itemIds: [profileId] });

    await allModes.click();
    if (!isMobile) await roleplayProfile.hover();
    await roleplayProfile.getByRole("button", { name: "Move to folder", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Filed profiles" }).click();
    await expect(profileFolder.getByText("2 profiles", { exact: true })).toBeVisible();
    await roleplayFilter.click();
    await expect(profileFolder.getByText("1 of 2 profiles", { exact: true })).toBeVisible();
    await expect(profileFolder.locator("[data-settings-profile-row]")).toHaveCount(1);

    await tabs.getByRole("button", { name: "Regexes", exact: true }).click();
    const regexRows = page.locator('[data-preset-regex-root] [data-touch-reorder-item="preset-regex"]');
    await expect(regexRows).toHaveCount(3);
    await expect(regexRows.nth(0).getByText("Built-in", { exact: true })).toBeVisible();
    await expect(regexRows.nth(1)).toContainText("Clean HTML (Outgoing Prompt)");
    await expect(regexRows.nth(1).getByText("Built-in", { exact: true })).toHaveCount(0);
    await expect(regexRows.nth(2)).toContainText("Collapse Excess Newlines");
    await expect(regexRows.nth(2).getByText("Built-in", { exact: true })).toBeVisible();
    await panel.screenshot({ path: info.outputPath("built-in-regexes.png"), animations: "disabled", scale: "css" });
  } finally {
    for (const path of cleanup.reverse()) await request.delete(path);
  }
});
