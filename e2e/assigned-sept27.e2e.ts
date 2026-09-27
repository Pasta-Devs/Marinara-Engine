import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
test.use({ actionTimeout: 10_000 });
test.beforeEach(async ({ page }, info) => {
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      trackerPanelEnabled: false,
      theme: info.project.name === "desktop-chromium" ? "light" : "dark",
    },
    "if-missing",
  );
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
});

test("Conversation Tools translates an unsent draft without enabling the shortcut or automatic translation", async ({
  page,
  request,
}, info) => {
  const created = await request.post("/api/chats", {
    data: { name: "Mobile draft translation", mode: "conversation", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = await created.json();
  try {
    await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        showInputTranslateButton: false,
        autoTranslate: false,
        translateInput: false,
        translationInputTargetLang: "pl",
      },
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
    const calls: Record<string, unknown>[] = [];
    await page.route("**/api/translate", (route) => {
      calls.push(route.request().postDataJSON());
      return route.fulfill({ json: { translatedText: "Witaj, Mari." } });
    });
    await page.goto("/");
    const composer = page.locator("textarea[data-chat-composer]");
    await composer.fill("Hello, Mari.");
    await page.getByRole("button", { name: "Emoji, GIFs, stickers & tools", exact: true }).click();
    const picker = page.locator("[data-conversation-media-picker]:visible");
    await picker.getByRole("button", { name: "Tools", exact: true }).click();
    const translate = picker.getByRole("button", { name: "Translate draft", exact: true });
    await expect(translate).toBeVisible();
    await page.screenshot({ path: info.outputPath("conversation-translate-tools.png") });
    await translate.click();
    await expect(composer).toHaveValue("Witaj, Mari.");
    expect(calls).toEqual([expect.objectContaining({ text: "Hello, Mari.", targetLanguage: "pl", chatId: chat.id })]);
    expect(await (await request.get(`/api/chats/${chat.id}/messages`)).json()).toEqual([]);
    await page.getByRole("button", { name: "Emoji, GIFs, stickers & tools", exact: true }).click();
    await expect(translate).toBeVisible();
    await page.route("**/api/translate", (route) =>
      route.fulfill({ status: 502, json: { error: "Synthetic provider failure" } }),
    );
    await translate.click();
    await expect(page.getByText("Synthetic provider failure", { exact: true })).toBeVisible();
    await expect(composer).toHaveValue("Witaj, Mari.");
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("regex bulk deletion confirms once and keeps failed and unselected scripts", async ({ page, request }, info) => {
  const scripts: Array<{ id: string; name: string }> = [];
  try {
    for (const name of ["Old pack first", "Old pack second", "Keep this regex"]) {
      const response = await request.post("/api/regex-scripts", {
        data: { name, findRegex: "fixture", replaceString: "replacement", placement: ["ai_output"] },
      });
      expect(response.ok()).toBeTruthy();
      scripts.push(await response.json());
    }
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openRightPanel("presets");
    });
    await page.getByRole("button", { name: "Select regex scripts", exact: true }).click();
    const all = page.getByRole("checkbox", { name: "Select all regex scripts", exact: true });
    await all.check();
    await expect(page.getByRole("checkbox", { name: "Select Keep this regex", exact: true })).toBeChecked();
    await all.uncheck();
    await page.getByRole("checkbox", { name: "Select Old pack first", exact: true }).check();
    await page.getByRole("checkbox", { name: "Select Old pack second", exact: true }).check();
    const bulk = page.locator(".mari-selection-action-bar");
    await expect(bulk).toContainText("2 selected");
    await bulk.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete regex scripts", exact: true });
    await expect(dialog).toContainText("Delete 2 selected regex scripts?");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      (await (await request.get("/api/regex-scripts")).json()).filter((row: { id: string }) =>
        scripts.some((script) => script.id === row.id),
      ),
    ).toHaveLength(3);
    await page.route(`**/api/regex-scripts/${scripts[1]!.id}`, (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({ status: 500, json: { error: "Synthetic deletion failure" } })
        : route.continue(),
    );
    await bulk.getByRole("button", { name: "Delete", exact: true }).click();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Select Old pack first", exact: true })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Select Old pack second", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Select Keep this regex", exact: true })).not.toBeChecked();
    await expect(bulk).toContainText("1 selected");
    await page.screenshot({ path: info.outputPath("regex-bulk-partial-failure.png") });
    await page.unroute(`**/api/regex-scripts/${scripts[1]!.id}`);
    await bulk.getByRole("button", { name: "Delete", exact: true }).click();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(bulk).toHaveCount(0);
    const remaining = await (await request.get("/api/regex-scripts")).json();
    expect(
      remaining
        .filter((row: { id: string }) => scripts.some((script) => script.id === row.id))
        .map((row: { name: string }) => row.name),
    ).toEqual(["Keep this regex"]);
  } finally {
    await Promise.all(scripts.map((script) => request.delete(`/api/regex-scripts/${script.id}`)));
  }
});

test("gallery auto-save setting defaults on and persists off across reload", async ({ page, request }, info) => {
  const previous = await (await request.get("/api/app-settings/ui")).json();
  try {
    await request.put("/api/app-settings/ui", { data: { value: "{}" } });
    await page.route("**/api/capability-packages/installed", (route) =>
      route.fulfill({
        json: [
          {
            id: "illustrator",
            version: "1.0.0",
            status: "active",
            readiness: "ready",
            manifest: {
              schemaVersion: 1,
              id: "illustrator",
              name: "Illustrator",
              version: "1.0.0",
              engine: { min: "2.0.0", maxExclusive: "3.0.0" },
              kind: ["agent"],
              entrypoints: { agents: "agents.json" },
              permissions: ["agent-runtime"],
              files: [],
            },
          },
        ],
      }),
    );
    await page.goto("/");
    const openSettings = async () =>
      page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setSettingsTab("generations");
        useUIStore.getState().openRightPanel("settings");
      });
    await openSettings();
    const toggle = page.getByRole("checkbox", {
      name: "Automatically save generated images to character galleries",
      exact: true,
    });
    await expect(toggle).toBeChecked();
    await page.getByText("Automatically save generated images to character galleries", { exact: true }).click();
    await expect(toggle).not.toBeChecked();
    await expect
      .poll(
        async () =>
          JSON.parse((await (await request.get("/api/app-settings/ui")).json()).value || "{}")
            .autoSaveGeneratedImagesToGalleries,
      )
      .toBe(false);
    await page.reload();
    await openSettings();
    await expect(toggle).not.toBeChecked();
    await toggle.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("gallery-auto-save-off.png") });
  } finally {
    await request.put("/api/app-settings/ui", { data: previous });
  }
});
