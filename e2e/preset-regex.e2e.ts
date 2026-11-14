import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const appVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
test.use({ actionTimeout: 10_000 });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), appVersion);
  // The shared seed also dismisses the one-time chat layout video (7f4e6ae98), which otherwise covers Chat Settings.
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
});

async function openPreset(page: Page, id: string) {
  await page.evaluate(async (presetId) => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openPresetDetail(presetId);
  }, id);
  const editor = page.locator(".mari-editor-shell");
  const compact = editor.getByRole("button", { name: "Editor sections", exact: true });
  await expect(editor.locator(".mari-editor-title-input")).toBeVisible();
  if (await compact.isVisible()) {
    await compact.click();
    await editor.getByRole("menuitemradio", { name: "Regex", exact: true }).click();
  } else {
    await editor
      .getByRole("navigation", { name: "Editor sections" })
      .getByRole("button", { name: "Regex", exact: true })
      .click();
  }
  return editor;
}

test("preset regex tab saves defaults, reuses the regex editor, and preserves existing preset targets", async ({
  page,
  request,
}, testInfo) => {
  const preset = (await (await request.post("/api/prompts", { data: { name: "Regex preset fixture" } })).json()) as {
    id: string;
  };
  const script = (await (
    await request.post("/api/regex-scripts", {
      data: {
        name: "Existing scoped fixture",
        findRegex: "RAW",
        replaceString: "formatted",
        placement: ["ai_output"],
        targetPromptPresetIds: ["other-preset"],
      },
    })
  ).json()) as { id: string };
  const scriptIds = [script.id];
  try {
    await page.goto("/");
    const editor = await openPreset(page, preset.id);
    await editor.getByRole("combobox", { name: "Scoped regex default", exact: true }).selectOption("exclusive");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor.getByText("Changes saved", { exact: true })).toBeVisible();
    await expect
      .poll(async () => (await (await request.get(`/api/prompts/${preset.id}`)).json()).scopedRegexMode)
      .toBe("exclusive");
    await editor.getByRole("combobox", { name: "Add existing script", exact: true }).selectOption(script.id);
    await expect(editor.locator(".mari-editor-title-input")).toHaveValue("Existing scoped fixture");
    // Binding remains a draft until Save, rather than changing a global script on selection.
    expect(
      JSON.parse(
        (await (await request.get("/api/regex-scripts")).json()).find((row: { id: string }) => row.id === script.id)
          .targetPromptPresetIds,
      ),
    ).toEqual(["other-preset"]);
    await editor.getByRole("button", { name: /^Back to/ }).click();
    await editor.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(editor.getByRole("combobox", { name: "Scoped regex default", exact: true })).toHaveValue("exclusive");
    await editor.getByRole("combobox", { name: "Add existing script", exact: true }).selectOption(script.id);
    await expect(editor.locator(".mari-editor-title-input")).toHaveValue("Existing scoped fixture");
    await page.route(`**/api/regex-scripts/${script.id}`, (route) =>
      route.fulfill({ status: 500, json: { error: "Synthetic save failure" } }),
    );
    await editor.getByRole("button", { name: "Save regex script", exact: true }).click();
    await expect(editor.getByText("Synthetic save failure", { exact: true })).toBeVisible();
    expect(
      JSON.parse(
        (await (await request.get("/api/regex-scripts")).json()).find((row: { id: string }) => row.id === script.id)
          .targetPromptPresetIds,
      ),
    ).toEqual(["other-preset"]);
    await page.unroute(`**/api/regex-scripts/${script.id}`);
    await editor.getByRole("button", { name: "Save regex script", exact: true }).click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await (await request.get("/api/regex-scripts")).json()).find((row: { id: string }) => row.id === script.id)
            .targetPromptPresetIds,
        ),
      )
      .toEqual(["other-preset", preset.id]);
    await editor.getByRole("button", { name: /^Back to/ }).click();
    await expect(page.locator("[data-preset-regex]")).toBeVisible();
    await expect(editor.getByRole("button", { name: "Existing scoped fixture" })).toBeVisible();
    await editor.getByRole("button", { name: "Existing scoped fixture" }).click();
    await editor.getByRole("button", { name: "Remove Regex preset fixture", exact: true }).click();
    await editor.getByRole("button", { name: "Save regex script", exact: true }).click();
    await expect
      .poll(async () =>
        JSON.parse(
          (await (await request.get("/api/regex-scripts")).json()).find((row: { id: string }) => row.id === script.id)
            .targetPromptPresetIds,
        ),
      )
      .toEqual(["other-preset"]);
    await expect(editor.getByRole("button", { name: "Remove Regex preset fixture", exact: true })).toHaveCount(0);
    await editor.getByRole("button", { name: "Save regex script", exact: true }).click();
    await editor.getByRole("button", { name: /^Back to/ }).click();
    await expect(page.locator("[data-preset-regex]")).toBeVisible();
    await expect(editor.getByRole("button", { name: "Existing scoped fixture" })).toHaveCount(0);
    await editor.getByRole("button", { name: "Create regex", exact: true }).click();
    await editor.locator(".mari-editor-title-input").fill("Created in preset fixture");
    await editor.getByPlaceholder("e.g. \\*([^*]+)\\*", { exact: true }).fill("RAW_NEW");
    await editor.getByPlaceholder("e.g. $1 or leave empty to remove", { exact: true }).fill("new formatted");
    const createdResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().endsWith("/api/regex-scripts"),
    );
    await editor.getByRole("button", { name: "Save regex script", exact: true }).click();
    const created = (await (await createdResponse).json()) as { id: string; targetPromptPresetIds: string };
    scriptIds.push(created.id);
    expect(JSON.parse(created.targetPromptPresetIds)).toEqual([preset.id]);
    await editor.getByRole("button", { name: /^Back to/ }).click();
    await expect(editor.getByRole("button", { name: "Created in preset fixture" })).toBeVisible();
    await expect(editor.getByRole("combobox", { name: "Scoped regex default", exact: true })).toHaveValue("exclusive");
    await testInfo.attach("preset-regex-editor", { body: await page.screenshot(), contentType: "image/png" });
    await page.reload();
    await openPreset(page, preset.id);
    await expect(editor.getByRole("combobox", { name: "Scoped regex default", exact: true })).toHaveValue("exclusive");
  } finally {
    await Promise.all(scriptIds.map((id) => request.delete(`/api/regex-scripts/${id}`)));
    await request.delete(`/api/prompts/${preset.id}`);
  }
});

for (const mode of ["conversation", "roleplay"] as const) {
  test(`${mode} inherits scoped regex defaults and keeps per-chat overrides across reloads and preset changes`, async ({
    page,
    request,
  }, testInfo) => {
    const preset = (await (
      await request.post("/api/prompts", { data: { name: "Scoped display fixture", scopedRegexMode: "exclusive" } })
    ).json()) as { id: string };
    const character = (await (
      await request.post("/api/characters", { data: { data: { name: "Regex Character" } } })
    ).json()) as { id: string };
    const scoped = (await (
      await request.post("/api/regex-scripts", {
        data: {
          name: "Character scope fixture",
          findRegex: "RAW_SCOPED",
          replaceString: "character formatted",
          placement: ["ai_output"],
          targetCharacterIds: [character.id],
        },
      })
    ).json()) as { id: string };
    const bound = (await (
      await request.post("/api/regex-scripts", {
        data: {
          name: "Preset scope fixture",
          findRegex: "RAW_PRESET",
          replaceString: "preset formatted",
          placement: ["ai_output"],
          targetPromptPresetIds: [preset.id],
        },
      })
    ).json()) as { id: string };
    const chat = (await (
      await request.post("/api/chats", {
        data: { name: "Regex override fixture", mode, characterIds: [character.id], promptPresetId: preset.id },
      })
    ).json()) as { id: string };
    let message: { id: string };
    try {
      message = (await (
        await request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "assistant", characterId: character.id, content: "RAW_SCOPED and RAW_PRESET" },
        })
      ).json()) as { id: string };
      await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
      await page.goto("/");
      const displayed = page.locator(`[data-message-id="${message.id}"]`);
      await expect(displayed).toContainText("character formatted and preset formatted");
      const readOverride = async () => {
        const metadata = (await (await request.get(`/api/chats/${chat.id}`)).json()).metadata;
        return (typeof metadata === "string" ? JSON.parse(metadata) : metadata).scopedRegexMode;
      };
      const openSettings = async (): Promise<Locator> => {
        await page.evaluate(async () => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setShouldOpenSettings(true);
        });
        const section = page.locator(`[data-chat-settings-section="${mode}-scoped-regex"]`);
        if (!(await section.getByLabel("Use preset default").isVisible()))
          await section.getByText("Scoped Regex Scripts", { exact: true }).click();
        return section;
      };
      let section = await openSettings();
      await expect(section.getByLabel("Use preset default")).toBeChecked();
      await expect(section.getByRole("button", { name: "Exclusive", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await section.getByRole("button", { name: "Disabled", exact: true }).click();
      await expect(section.getByLabel("Use preset default")).not.toBeChecked();
      await expect.poll(readOverride).toBe("disabled");
      // Changing the preset must not roll back an explicit chat choice.
      await request.patch(`/api/prompts/${preset.id}`, { data: { scopedRegexMode: "chat" } });
      await page.reload();
      await expect(displayed).toContainText("RAW_SCOPED and preset formatted");
      section = await openSettings();
      await expect(section.getByLabel("Use preset default")).not.toBeChecked();
      await section.getByText("Use preset default", { exact: true }).click();
      await expect.poll(readOverride).toBe(null);
      await expect(displayed).toContainText("character formatted and preset formatted");
      await page.reload();
      await expect(displayed).toContainText("character formatted and preset formatted");
      await testInfo.attach(`${mode}-regex-inheritance`, { body: await page.screenshot(), contentType: "image/png" });
      // No selected preset means legacy disabled behavior and no preset-bound scripts.
      await request.patch(`/api/chats/${chat.id}`, { data: { promptPresetId: null } });
      await page.reload();
      await expect(displayed).toContainText("RAW_SCOPED and RAW_PRESET");
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
      await request.delete(`/api/regex-scripts/${scoped.id}`);
      await request.delete(`/api/regex-scripts/${bound.id}`);
      await request.delete(`/api/characters/${character.id}`);
      await request.delete(`/api/prompts/${preset.id}`);
    }
  });
}

test("regex library folders pause chat display and bulk toggles keep each script setting", async ({
  page,
  request,
}, info) => {
  const scripts: { id: string; name: string; order: number }[] = [];
  let folderId: string | undefined;
  let chatId: string | undefined;
  let characterId: string | undefined;
  const tabGroup = page.getByRole("group", { name: "Presets", exact: true });
  const openRegexes = async () => {
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openRightPanel("presets");
    });
    await tabGroup.getByRole("button", { name: "Regexes", exact: true }).click();
  };
  const scriptState = async () => {
    const rows = (await (await request.get("/api/regex-scripts")).json()) as {
      id: string;
      enabled: string;
      order: number;
      pausedByFolder: boolean;
    }[];
    return scripts.map((script) => {
      const row = rows.find(({ id }) => id === script.id);
      return row && [row.enabled, row.order, row.pausedByFolder];
    });
  };
  try {
    const charResponse = await request.post("/api/characters", { data: { data: { name: "Regex Preview Character" } } });
    expect(charResponse.ok()).toBeTruthy();
    characterId = (await charResponse.json()).id;
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Regex folder fixture", mode: "conversation", characterIds: [characterId] },
    });
    expect(chatResponse.ok()).toBeTruthy();
    chatId = (await chatResponse.json()).id;
    const messageResponse = await request.post("/api/chats/" + chatId + "/messages", {
      data: { role: "assistant", characterId, content: "PACK_RAW and OUTSIDE_RAW" },
    });
    expect(messageResponse.ok()).toBeTruthy();
    const messageId = (await messageResponse.json()).id;
    for (const data of [
      { name: "Pack format", findRegex: "PACK_RAW", replaceString: "pack formatted", enabled: true },
      { name: "Pack experimental", findRegex: "PACK_RAW", replaceString: "experimental", enabled: false },
      { name: "Outside pack", findRegex: "OUTSIDE_RAW", replaceString: "outside formatted", enabled: true },
    ]) {
      const result = await request.post("/api/regex-scripts", {
        data: { ...data, placement: ["ai_output"], applyMode: "both" },
      });
      expect(result.ok()).toBeTruthy();
      scripts.push(await result.json());
    }
    const [format, experimental, outside] = scripts;
    const originalOrders = scripts.map((script) => script.order);
    await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id!), chatId);
    await page.goto("/");
    const message = page.locator('[data-message-id="' + messageId + '"]');
    await expect(message).toContainText("pack formatted and outside formatted");
    await openRegexes();
    const selectRegex = page.getByRole("button", { name: "Select regex scripts", exact: true });
    const exitSelection = page.getByRole("button", { name: "Exit regex selection", exact: true });
    const created = page.waitForResponse(
      (response) => response.url().endsWith("/api/library-folders/regex") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "New Folder", exact: true }).click();
    const createdResponse = await created;
    expect(createdResponse.ok()).toBeTruthy();
    folderId = (await createdResponse.json()).id;
    const folder = page.locator('[data-regex-folder="' + folderId + '"]');
    const folderName = folder.getByRole("textbox", { name: "Rename folder", exact: true });
    await folderName.fill("Test pack");
    await folderName.press("Enter");
    await expect(folder.getByRole("button", { name: "Test pack", exact: true })).toBeVisible();
    await folder.getByRole("button", { name: "Rename folder", exact: true }).click();
    await folderName.fill("Cancelled rename");
    await folderName.press("Escape");
    await expect(folder.getByRole("button", { name: "Test pack", exact: true })).toBeVisible();
    await selectRegex.click();
    await page.getByRole("checkbox", { name: "Select Pack format", exact: true }).check();
    await page.getByRole("checkbox", { name: "Select Pack experimental", exact: true }).check();
    await page.getByRole("button", { name: "Move to folder", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Test pack", exact: true }).click();
    await expect(folder.getByRole("checkbox", { name: "Select Pack format", exact: true })).toBeChecked();
    expect((await scriptState()).map((row) => row?.[1])).toEqual(originalOrders);
    await exitSelection.click();

    await folder.getByRole("checkbox", { name: "Run scripts in Test pack", exact: true }).locator("..").click();
    await expect(folder.getByText("Paused", { exact: true })).toBeVisible();
    await expect(folder.getByText("Paused by folder", { exact: true })).toHaveCount(0);
    await expect(
      folder.getByRole("checkbox", { name: "Run Pack format (paused by folder)", exact: true }),
    ).toBeChecked();
    await expect(folder.getByRole("checkbox", { name: "Run Pack experimental", exact: true })).not.toBeChecked();
    await expect(message).toContainText("PACK_RAW and outside formatted");
    await page.screenshot({ path: info.outputPath("regex-folders-paused.png") });
    const orderView = page.getByRole("button", { name: "Execution order", exact: true });
    await orderView.click();
    await expect(page.getByTitle("Paused by folder", { exact: true })).toHaveCount(1);
    await orderView.click();

    await page.reload();
    await expect(message).toContainText("PACK_RAW and outside formatted");
    await openRegexes();
    await expect(folder.getByRole("checkbox", { name: "Run scripts in Test pack", exact: true })).not.toBeChecked();
    await selectRegex.click();
    await folder.getByRole("checkbox", { name: "Select Pack format", exact: true }).check();
    await folder.getByRole("checkbox", { name: "Select Pack experimental", exact: true }).check();
    const bulk = page.locator(".mari-selection-action-bar");
    await bulk.getByRole("button", { name: "Enable selected", exact: true }).click();
    await expect.poll(scriptState).toEqual([
      ["true", format!.order, true],
      ["true", experimental!.order, true],
      ["true", outside!.order, false],
    ]);
    await bulk.getByRole("button", { name: "Disable selected", exact: true }).click();
    await expect.poll(scriptState).toEqual([
      ["false", format!.order, true],
      ["false", experimental!.order, true],
      ["true", outside!.order, false],
    ]);
    const rejected = await request.put("/api/regex-scripts/enabled", {
      data: { scriptIds: [format!.id, "missing-script-id"], enabled: true },
    });
    expect(rejected.status()).toBe(404);
    expect((await scriptState())[0]?.[0]).toBe("false");
    await exitSelection.click();
    await folder.getByRole("checkbox", { name: "Run Pack format", exact: true }).locator("..").click();
    await expect(message).toContainText("PACK_RAW and outside formatted");
    await folder.getByRole("checkbox", { name: "Run scripts in Test pack", exact: true }).locator("..").click();
    await expect(message).toContainText("pack formatted and outside formatted");
    await expect(folder.getByRole("checkbox", { name: "Run Pack experimental", exact: true })).not.toBeChecked();
    await page.getByRole("button", { name: "Execution order", exact: true }).click();
    await expect(folder).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pack format", exact: false }).first()).toBeVisible();
    await page.getByRole("button", { name: "Execution order", exact: true }).click();
    await folder.getByRole("button", { name: "Delete folder", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Delete folder", exact: true })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(folder).toHaveCount(0);
    expect((await scriptState()).map((row) => row?.[1])).toEqual(originalOrders);
  } finally {
    if (chatId) await request.delete("/api/chats/" + chatId + "?force=true");
    await Promise.all(scripts.map((script) => request.delete("/api/regex-scripts/" + script.id)));
    if (folderId) await request.delete("/api/library-folders/regex/" + folderId);
    if (characterId) await request.delete("/api/characters/" + characterId);
  }
});

test("function library folders pause offered tools and bulk toggles keep each function setting", async ({
  page,
  request,
}) => {
  const tools: { id: string; name: string }[] = [];
  let folderId: string | undefined;
  const tabGroup = page.getByRole("group", { name: "Presets", exact: true });
  const toolState = async () => {
    const rows = (await (await request.get("/api/custom-tools")).json()) as {
      id: string;
      enabled: string | boolean;
      pausedByFolder: boolean;
    }[];
    return tools.map((tool) => {
      const row = rows.find(({ id }) => id === tool.id);
      return row && [row.enabled === true || row.enabled === "true" || row.enabled === "1", row.pausedByFolder];
    });
  };
  try {
    for (const data of [
      { name: "e2e_folder_alpha", description: "Alpha fixture", enabled: true },
      { name: "e2e_folder_beta", description: "Beta fixture", enabled: false },
    ]) {
      const result = await request.post("/api/custom-tools", {
        data: { ...data, executionType: "static", staticResult: "ok" },
      });
      expect(result.ok()).toBeTruthy();
      tools.push(await result.json());
    }
    const [alpha] = tools;
    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openRightPanel("presets");
    });
    await tabGroup.getByRole("button", { name: "Functions", exact: true }).click();
    const selectFunctions = page.getByRole("button", { name: "Select functions", exact: true });
    const exitSelection = page.getByRole("button", { name: "Exit function selection", exact: true });
    const created = page.waitForResponse(
      (response) => response.url().endsWith("/api/library-folders/functions") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "New Folder", exact: true }).click();
    const createdResponse = await created;
    expect(createdResponse.ok()).toBeTruthy();
    folderId = (await createdResponse.json()).id;
    const folder = page.locator('[data-function-folder="' + folderId + '"]');
    const folderName = folder.getByRole("textbox", { name: "Rename folder", exact: true });
    await folderName.fill("Test tools");
    await folderName.press("Enter");
    await expect(folder.getByRole("button", { name: "Test tools", exact: true })).toBeVisible();

    await selectFunctions.click();
    await page.getByRole("checkbox", { name: "Select e2e_folder_alpha", exact: true }).check();
    await page.getByRole("checkbox", { name: "Select e2e_folder_beta", exact: true }).check();
    await page.getByRole("button", { name: "Move to folder", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Test tools", exact: true }).click();
    await expect(folder.getByRole("checkbox", { name: "Select e2e_folder_alpha", exact: true })).toBeChecked();
    await exitSelection.click();

    await folder.getByRole("checkbox", { name: "Offer functions in Test tools", exact: true }).locator("..").click();
    await expect(folder.getByText("Paused", { exact: true })).toBeVisible();
    await expect(
      folder.getByRole("checkbox", { name: "Offer e2e_folder_alpha (paused by folder)", exact: true }),
    ).toBeChecked();
    await expect.poll(toolState).toEqual([
      [true, true],
      [false, true],
    ]);
    const orderView = page.getByRole("button", { name: "Manual order", exact: true });
    await orderView.click();
    await expect(page.getByTitle("Paused by folder", { exact: true })).toHaveCount(1);
    await orderView.click();

    await selectFunctions.click();
    await folder.getByRole("checkbox", { name: "Select e2e_folder_alpha", exact: true }).check();
    await folder.getByRole("checkbox", { name: "Select e2e_folder_beta", exact: true }).check();
    const bulk = page.locator(".mari-selection-action-bar");
    await bulk.getByRole("button", { name: "Enable selected", exact: true }).click();
    await expect.poll(toolState).toEqual([
      [true, true],
      [true, true],
    ]);
    await bulk.getByRole("button", { name: "Disable selected", exact: true }).click();
    await expect.poll(toolState).toEqual([
      [false, true],
      [false, true],
    ]);
    const rejected = await request.put("/api/custom-tools/enabled", {
      data: { toolIds: [alpha!.id, "missing-tool-id"], enabled: true },
    });
    expect(rejected.status()).toBe(404);
    expect((await toolState())[0]?.[0]).toBe(false);
    await exitSelection.click();

    await folder.getByRole("checkbox", { name: "Offer functions in Test tools", exact: true }).locator("..").click();
    await expect.poll(toolState).toEqual([
      [false, false],
      [false, false],
    ]);
    await page.getByRole("button", { name: "Manual order", exact: true }).click();
    await expect(folder).toHaveCount(0);
    await page.getByRole("button", { name: "Manual order", exact: true }).click();
    await folder.getByRole("button", { name: "Delete folder", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Delete folder", exact: true })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(folder).toHaveCount(0);
    await expect.poll(toolState).toEqual([
      [false, false],
      [false, false],
    ]);
  } finally {
    await Promise.all(tools.map((tool) => request.delete("/api/custom-tools/" + tool.id)));
    if (folderId) await request.delete("/api/library-folders/functions/" + folderId);
  }
});
