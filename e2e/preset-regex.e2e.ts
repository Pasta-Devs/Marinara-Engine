import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const appVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
test.use({ actionTimeout: 10_000 });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((version) => {
    localStorage.setItem("marinara:whats-new:seen-version", version);
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: {
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: false,
          chatHelpSeenModes: ["conversation", "roleplay", "game"],
        },
        version: 96,
      }),
    );
  }, appVersion);
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
    await editor.getByRole("button", { name: "Back to regex scripts" }).click();
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
    await editor.getByRole("button", { name: "Back to regex scripts" }).click();
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
    await editor.getByRole("button", { name: "Back to regex scripts" }).click();
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
    await editor.getByRole("button", { name: "Back to regex scripts" }).click();
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
