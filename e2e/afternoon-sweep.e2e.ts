import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import AdmZip from "adm-zip";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
async function prepare(page: Page, chatId?: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    gameInstantTextReveal: true,
  });
  await page.addInitScript(
    ({ version, chatId }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      if (chatId) localStorage.setItem("marinara-active-chat-id", chatId);
    },
    { version, chatId },
  );
  await page.goto("/");
}

test("agent categories fit and built-in context selections survive save, export and reload", async ({
  page,
  request,
}, info) => {
  const response = await request.post("/api/agents", {
    data: {
      type: "world-state",
      name: "World State",
      phase: "post_processing",
      promptTemplate: "Update the weather.",
      settings: {},
    },
  });
  expect(response.ok()).toBeTruthy();
  const agent = await response.json();
  try {
    await page.route("**/api/capability-packages/agents", (route) =>
      route.fulfill({
        json: [
          {
            id: "world-state",
            name: "World State",
            description: "Track the world",
            author: "Pasta Devs",
            phase: "post_processing",
            enabledByDefault: false,
            category: "trackers",
            defaultPromptTemplate: "Update the weather.",
          },
        ],
      }),
    );
    await page.route("**/api/agents", async (route) =>
      route.fulfill({ json: [await (await request.get(`/api/agents/${agent.id}`)).json()] }),
    );
    await prepare(page);
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openRightPanel("agents");
    });
    const filters = page.getByRole("group", { name: "Filter agents by supported chat mode", exact: true });
    await expect(filters).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate(async (theme) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setTheme(theme);
      }, theme);
      for (const button of await filters.getByRole("button").all()) {
        expect(
          await button.evaluate((button) => {
            const span = button.querySelector("span")!;
            const range = document.createRange();
            range.selectNodeContents(span);
            const text = range.getBoundingClientRect();
            const bounds = button.getBoundingClientRect();
            return text.left >= bounds.left - 1 && text.right <= bounds.right + 1;
          }),
        ).toBe(true);
      }
      await page.screenshot({ path: info.outputPath(`agent-categories-${theme}.png`) });
    }
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openAgentDetail("world-state");
    });
    const characters = page.getByRole("checkbox", { name: /^Characters\b/ });
    await expect(characters).toBeChecked();
    await characters.focus();
    await characters.press("Space");
    await page.getByRole("checkbox", { name: /^Persona\b/ }).press("Space");
    await page.locator("button.mari-editor-action--primary").click();
    const saved = async () => {
      const value = await (await request.get(`/api/agents/${agent.id}`)).json();
      return typeof value.settings === "string" ? JSON.parse(value.settings) : value.settings;
    };
    await expect.poll(async () => (await saved()).contextSources?.characters).toBe(false);
    expect((await saved()).contextSources.chatHistory).toBe(true);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export agent", exact: true }).click();
    const exported = new AdmZip(readFileSync((await (await download).path())!));
    const settings = exported.getEntries().find((entry) => entry.entryName.endsWith("/settings.json"))!;
    expect(JSON.parse(settings.getData().toString("utf8")).contextSources.characters).toBe(false);
    await page.reload();
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openAgentDetail("world-state");
    });
    await expect(characters).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^Persona\b/ })).not.toBeChecked();
    await page.screenshot({ path: info.outputPath("built-in-context.png") });
    await page.route("**/api/personas", (route) => route.fulfill({ json: [] }));
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAgentDetail();
      useUIStore.getState().openRightPanel("personas");
    });
    await expect(page.getByText("No personas yet", { exact: true })).toBeVisible();
  } finally {
    await request.delete(`/api/agents/${agent.id}`).catch(() => {});
  }
});

test("mobile GM narration expands for long text and remains within the screen", async ({
  page,
  request,
  isMobile,
}, info) => {
  const response = await request.post("/api/chats", {
    data: { name: "Narration sizing", mode: "game", characterIds: [] },
  });
  const chat = await response.json();
  try {
    await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameId: chat.id,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
      },
    });
    const message = await (
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "The archive is quiet." },
      })
    ).json();
    await prepare(page, chat.id);
    const panel = page.locator('[data-component="GameNarration.ActivePanel"]');
    const prose = panel.locator(".game-narration-prose").first();
    await expect(prose).toContainText("The archive is quiet.");
    const short = (await prose.boundingBox())!.height;
    await request.patch(`/api/chats/${chat.id}/messages/${message.id}`, {
      data: {
        content:
          "The archive stretches into the distance, its shelves filled with patient records of every experiment. ".repeat(
            40,
          ),
      },
    });
    await page.reload();
    await expect(prose).toContainText("patient records");
    const long = (await prose.boundingBox())!;
    expect(long.height).toBeGreaterThan(short);
    if (isMobile) expect(long.height).toBeGreaterThan(200);
    else
      expect(long.height).toBeLessThanOrEqual(
        (await prose.evaluate((element) => parseFloat(getComputedStyle(element).maxHeight))) + 1,
      );
    expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    expect(long.y + long.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.screenshot({ path: info.outputPath("responsive-narration.png") });
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("SwarmUI backend saving is opt-in and survives a connection reload", async ({ page, request }, info) => {
  const response = await request.post("/api/connections", {
    data: {
      name: "Native SwarmUI fixture",
      provider: "image_generation",
      imageGenerationSource: "swarmui",
      imageService: "swarmui",
      baseUrl: "http://127.0.0.1:7801",
      model: "fixture",
    },
  });
  const connection = await response.json();
  try {
    await prepare(page);
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(id);
    }, connection.id);
    await page.getByRole("button", { name: /ComfyUI generation setup/ }).click();
    const saveImages = page.getByRole("checkbox", { name: /^Save images in SwarmUI/ });
    await expect(saveImages).not.toBeChecked();
    await saveImages.check();
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === `/api/connections/${connection.id}`,
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await page.reload();
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(id);
    }, connection.id);
    await expect(saveImages).toBeChecked();
    await saveImages.scrollIntoViewIfNeeded();
    await expect(saveImages).toBeInViewport();
    await page.screenshot({ path: info.outputPath("swarmui-native-settings.png") });
  } finally {
    await request.delete(`/api/connections/${connection.id}`).catch(() => {});
  }
});

test("request timeouts can be found, saved and reloaded in Advanced Settings", async ({ page, request }, info) => {
  const original = await (await request.get("/api/admin/request-timeouts")).json();
  try {
    await prepare(page);
    const openTimeouts = async () => {
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openRightPanel("settings");
      });
      await page.getByPlaceholder("Search settings").fill("request timeouts");
      await page.getByRole("button", { name: /Request timeouts/ }).click();
    };
    await openTimeouts();
    const text = page.getByRole("textbox", { name: "Text generation", exact: true });
    await expect(text).toHaveValue(String(original.chat));
    await text.fill("1234");
    await text.blur();
    await page.getByRole("button", { name: "Save timeouts", exact: true }).click();
    await expect.poll(async () => (await (await request.get("/api/admin/request-timeouts")).json()).chat).toBe(1234);
    await page.reload();
    await openTimeouts();
    await expect(text).toHaveValue("1234");
    await expect(page.getByText(/Restart the server to apply media changes and refresh/)).toBeVisible();
    await page.locator("#settings-section-request-timeouts").scrollIntoViewIfNeeded();
    await expect(
      page.locator("#settings-section-request-timeouts").getByText("Request timeouts", { exact: true }),
    ).toBeInViewport();
    await page.screenshot({ path: info.outputPath("request-timeouts.png") });
  } finally {
    await request.put("/api/admin/request-timeouts", { data: original });
  }
});
