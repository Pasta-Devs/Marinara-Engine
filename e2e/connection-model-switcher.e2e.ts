// #7098: the input-box Connections menu shows the chosen connection's models. Lists are saved on the
// connection, so reopening (even after a reload) does not ask the provider again; Refresh does. Models
// can be pinned, typed by ID, and changed from Chat Settings → Connection too.
import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { closeChatSettings, openChatSettings } from "./chat-settings-tools.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

type CatalogModel = { id: string; name: string; context_length?: number; max_completion_tokens?: number };
const CATALOG: CatalogModel[] = [
  { id: "vendor/alpha", name: "Alpha", context_length: 64_000 },
  { id: "vendor/beta", name: "Beta", context_length: 96_000 },
  { id: "vendor/gamma", name: "Gamma", context_length: 200_000, max_completion_tokens: 8_192 },
  { id: "vendor/kappa", name: "Kappa" },
];

/** A stand-in provider whose /models calls are counted. */
async function startProvider() {
  const state = { calls: 0, catalog: [...CATALOG] };
  const server = createServer((req, res) => {
    if (req.url === "/v1/models") {
      state.calls++;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: state.catalog }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing provider port");
  return {
    state,
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function setup(page: Page, request: APIRequestContext, testInfo: TestInfo, theme: "dark" | "light") {
  const provider = await startProvider();
  const suffix = `${testInfo.project.name} ${theme} ${Date.now()}`;
  const createConnection = async (name: string, model: string, baseUrl = provider.baseUrl) => {
    const response = await request.post("/api/connections", {
      // A separate embedding model shows that a model pick leaves the connection's other models alone.
      data: { name, provider: "custom", baseUrl, model, maxContext: 8_000, embeddingModel: "fixture-embedding" },
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as { id: string };
  };
  const main = await createConnection(`Router ${suffix}`, "vendor/alpha");
  const other = await createConnection(`Backup ${suffix}`, "vendor/kappa");
  // A custom endpoint whose model list cannot be read (its /models answers 404).
  const broken = await createConnection(`Offline ${suffix}`, "", `${provider.baseUrl}/offline`);
  const chatResponse = await request.post("/api/chats", {
    data: { name: `Model switcher ${suffix}`, mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  expect((await request.patch(`/api/chats/${chat.id}`, { data: { connectionId: main.id } })).ok()).toBeTruthy();

  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    chatSettingsExpandedSections: { connection: true },
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", chatId);
    },
    { chatId: chat.id, version: APP_VERSION },
  );
  const cleanup = async () => {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/connections/${main.id}`);
    await request.delete(`/api/connections/${other.id}`);
    await request.delete(`/api/connections/${broken.id}`);
    await provider.close();
  };
  return { provider, main, other, broken, chat, cleanup, suffix };
}

async function connectionRow(request: APIRequestContext, id: string) {
  const rows = (await (await request.get("/api/connections")).json()) as Array<Record<string, unknown>>;
  return rows.find((row) => row.id === id) ?? null;
}

const isPhone = (testInfo: TestInfo) => testInfo.project.name.includes("mobile");

/** Opens the input-box menu and, on phones, the models step for the connection. */
async function openModels(page: Page, testInfo: TestInfo, connectionId: string): Promise<Locator> {
  if (isPhone(testInfo)) {
    await page.getByRole("button", { name: "Quick Switcher", exact: true }).click();
    const sheet = page.locator("[data-quick-switcher-mobile-menu]");
    await expect(sheet).toBeVisible();
    await sheet.locator(`[data-connection-option="${connectionId}"]`).click();
    const picker = sheet.locator("[data-connection-model-picker]");
    await expect(picker.locator("[data-model-back]")).toBeVisible();
    return picker;
  }
  await page.getByRole("button", { name: "Quick Connection Switcher", exact: true }).click();
  const menu = page.locator("[data-quick-connection-menu]");
  await expect(menu).toBeVisible();
  await expect(menu.locator(`[data-connection-option="${connectionId}"]`)).toHaveAttribute("aria-current", "true");
  return menu.locator("[data-connection-model-picker]");
}

async function closeMenu(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-quick-connection-menu], [data-quick-switcher-mobile-menu]")).toHaveCount(0);
}

const modelRow = (picker: Locator, section: "pinned" | "all", id: string) =>
  picker.locator(`[data-model-section="${section}"] [data-model-row][data-model-id="${id}"]`);

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

test("the Connections menu lists, pins, picks, refreshes and types models without refetching (#7098)", async ({
  page,
  request,
}, testInfo) => {
  const { provider, main, other, broken, cleanup } = await setup(page, request, testInfo, "dark");
  try {
    await page.goto("/");
    await expect(page.locator("[data-chat-composer]").first()).toBeVisible();

    // The first look fetches the list once and saves it on the connection.
    let picker = await openModels(page, testInfo, main.id);
    await expect(picker).toContainText("Models");
    await expect(picker.locator("[data-model-picker-provider]")).not.toBeEmpty();
    await expect(modelRow(picker, "all", "vendor/gamma")).toBeVisible();
    await expect(modelRow(picker, "all", "vendor/alpha").locator("[data-model-option]")).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(picker).toContainText("Model changes are saved to this connection.");
    expect(provider.state.calls).toBe(1);

    if (isPhone(testInfo)) {
      await expectNoHorizontalScroll(page);
      const sheet = page.locator("[data-quick-switcher-mobile-menu]");
      const sheetBox = (await sheet.boundingBox())!;
      expect(sheetBox.x).toBeGreaterThanOrEqual(0);
      expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      for (const target of [
        picker.locator("[data-model-back]"),
        picker.locator("[data-model-refresh]"),
        picker.locator("label:has([data-model-search])"),
        modelRow(picker, "all", "vendor/beta").locator("[data-model-option]"),
        modelRow(picker, "all", "vendor/beta").locator("[data-model-pin]"),
      ]) {
        expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      // The back control returns to the connection list.
      await picker.locator("[data-model-back]").click();
      await expect(sheet.locator("[data-connection-model-picker]")).toHaveCount(0);
      const connectionButton = sheet.locator(`[data-connection-option="${main.id}"]`);
      await expect(connectionButton).toBeVisible();
      expect((await connectionButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await connectionButton.click();
      picker = sheet.locator("[data-connection-model-picker]");
      await expect(modelRow(picker, "all", "vendor/beta")).toBeVisible();
    } else {
      // With a mouse the search box takes focus; arrows move through the list.
      await expect(picker.locator("[data-model-search]")).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(picker.locator("[data-model-option]").first()).toBeFocused();
    }

    // Pinning moves a model into Pinned; the star names what it pins.
    await picker.getByRole("button", { name: "Pin Beta", exact: true }).click();
    await expect(modelRow(picker, "pinned", "vendor/beta")).toBeVisible();
    await expect(modelRow(picker, "all", "vendor/beta")).toHaveCount(0);
    await expect(picker.getByRole("button", { name: "Pin Beta", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(picker.getByRole("button", { name: "Pin Beta", exact: true })).toHaveAttribute("title", "Unpin Beta");
    await expect.poll(async () => (await connectionRow(request, main.id))?.pinnedModels).toBe('["vendor/beta"]');
    await capture(page, testInfo, isPhone(testInfo) ? "mobile-models-step-dark" : "desktop-models-menu-dark");

    // The pin and the saved list survive a reload without asking the provider again.
    await page.reload();
    await expect(page.locator("[data-chat-composer]").first()).toBeVisible();
    picker = await openModels(page, testInfo, main.id);
    await expect(modelRow(picker, "pinned", "vendor/beta")).toBeVisible();
    await expect(modelRow(picker, "all", "vendor/gamma")).toBeVisible();
    expect(provider.state.calls).toBe(1);

    // Picking a model saves it with its context size and output limit, as the connection editor does, and
    // changes nothing else on the connection.
    const beforePick = (await connectionRow(request, main.id))!;
    await modelRow(picker, "all", "vendor/gamma").locator("[data-model-option]").click();
    await expect(page.locator("[data-connection-model-picker]")).toHaveCount(0);
    await expect
      .poll(async () => {
        const row = await connectionRow(request, main.id);
        return row && { model: row.model, maxContext: row.maxContext, maxTokensOverride: row.maxTokensOverride };
      })
      .toEqual({ model: "vendor/gamma", maxContext: 200_000, maxTokensOverride: 8_192 });
    const afterPick = (await connectionRow(request, main.id))!;
    const unchanged = (row: Record<string, unknown>) => {
      const { model: _m, maxContext: _c, maxTokensOverride: _o, updatedAt: _u, ...rest } = row;
      return rest;
    };
    expect(unchanged(afterPick)).toEqual(unchanged(beforePick));
    expect(afterPick.embeddingModel).toBe("fixture-embedding");
    picker = await openModels(page, testInfo, main.id);
    await expect(modelRow(picker, "all", "vendor/gamma").locator("[data-model-option]")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(provider.state.calls).toBe(1);

    // Refresh asks the provider again and shows what it reports now.
    provider.state.catalog = [...CATALOG, { id: "vendor/delta", name: "Delta" }];
    await picker.locator("[data-model-refresh]").click();
    await expect(modelRow(picker, "all", "vendor/delta")).toBeVisible();
    expect(provider.state.calls).toBe(2);

    // Enter with several matches waits for a choice; it never saves the search text as a model.
    let search = picker.locator("[data-model-search]");
    await search.fill("vendor/");
    await expect(picker.locator("[data-model-use-typed]")).toContainText("Uses the text exactly as typed.");
    await search.press("Enter");
    await expect(picker).toBeVisible();
    expect((await connectionRow(request, main.id))?.model).toBe("vendor/gamma");

    if (!isPhone(testInfo)) {
      // Keys pressed while an input method is composing belong to the composition.
      for (const key of ["Enter", "Escape"]) {
        await search.evaluate((input, key) => {
          input.dispatchEvent(new KeyboardEvent("keydown", { key, isComposing: true, bubbles: true }));
        }, key);
      }
      await expect(picker).toBeVisible();
      expect((await connectionRow(request, main.id))?.model).toBe("vendor/gamma");
    }

    // A search with one match picks that model, and focus goes back to the menu button.
    await search.fill("kapp");
    await search.press("Enter");
    await expect(page.locator("[data-connection-model-picker]")).toHaveCount(0);
    await expect.poll(async () => (await connectionRow(request, main.id))?.model).toBe("vendor/kappa");
    if (!isPhone(testInfo)) {
      await expect(page.getByRole("button", { name: "Quick Connection Switcher", exact: true })).toBeFocused();
    }

    // A model's name, typed in any case, picks that model rather than saving the name as an ID.
    picker = await openModels(page, testInfo, main.id);
    search = picker.locator("[data-model-search]");
    await search.fill("gamma");
    await search.press("Enter");
    await expect(page.locator("[data-connection-model-picker]")).toHaveCount(0);
    await expect.poll(async () => (await connectionRow(request, main.id))?.model).toBe("vendor/gamma");

    // A typed ID that matches nothing can be used with Enter.
    picker = await openModels(page, testInfo, main.id);
    search = picker.locator("[data-model-search]");
    await search.fill("my-org/custom-model");
    await expect(picker.locator("[data-model-use-typed]")).toContainText("Use “my-org/custom-model”");
    await expect(picker.locator("[data-model-use-typed]")).toContainText("Press Enter to use this ID.");
    await search.press("Enter");
    await expect(page.locator("[data-connection-model-picker]")).toHaveCount(0);
    await expect.poll(async () => (await connectionRow(request, main.id))?.model).toBe("my-org/custom-model");
    picker = await openModels(page, testInfo, main.id);
    await expect(modelRow(picker, "all", "my-org/custom-model").locator("[data-model-option]")).toHaveAttribute(
      "aria-current",
      "true",
    );

    // Picking another connection's model switches the chat to that connection.
    if (!isPhone(testInfo)) {
      const menu = page.locator("[data-quick-connection-menu]");
      await menu.locator(`[data-connection-option="${other.id}"]`).click();
      await expect(menu.locator(`[data-connection-option="${other.id}"]`)).toHaveAttribute("aria-current", "true");
      await expect(modelRow(picker, "all", "vendor/kappa").locator("[data-model-option]")).toHaveAttribute(
        "aria-current",
        "true",
      );
      await closeMenu(page);
    } else {
      await closeMenu(page);
    }
    expect(provider.state.calls).toBeLessThanOrEqual(3);
    const callsBeforeSettings = provider.state.calls;

    // Chat Settings → Connection has the same picker for the chat's connection.
    const settings = await openChatSettings(page);
    const field = settings.locator("[data-chat-settings-model-field]");
    await field.scrollIntoViewIfNeeded();
    if (isPhone(testInfo)) {
      expect((await field.locator("button[aria-expanded]").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await field.locator("button[aria-expanded]").click();
    const settingsPicker = field.locator("[data-connection-model-picker]");
    await expect(settingsPicker).toContainText("Model changes are saved to this connection.");
    // The opened list is scrolled into view inside Chat Settings (it can start near a phone's bottom edge).
    await expect
      .poll(async () => {
        const [sheet, list] = [await settings.boundingBox(), await settingsPicker.boundingBox()];
        return !!sheet && !!list && list.y >= sheet.y - 1 && list.y + list.height <= sheet.y + sheet.height + 1;
      })
      .toBe(true);
    const chatConnectionId = isPhone(testInfo) ? main.id : other.id;
    await expect(modelRow(settingsPicker, "pinned", "vendor/beta")).toHaveCount(isPhone(testInfo) ? 1 : 0);
    await settingsPicker.locator('[data-model-row][data-model-id="vendor/alpha"] [data-model-option]').click();
    await expect(settingsPicker).toHaveCount(0);
    await expect(field.locator("button[aria-expanded]")).toContainText("vendor/alpha");
    await expect.poll(async () => (await connectionRow(request, chatConnectionId))?.model).toBe("vendor/alpha");
    expect(provider.state.calls).toBe(callsBeforeSettings);
    await expectNoHorizontalScroll(page);
    await closeChatSettings(page);

    // A custom endpoint whose list cannot be read says so plainly, shows no built-in catalog, and still
    // takes a typed model ID.
    if (isPhone(testInfo)) {
      picker = await openModels(page, testInfo, broken.id);
    } else {
      await page.getByRole("button", { name: "Quick Connection Switcher", exact: true }).click();
      await page.locator(`[data-quick-connection-menu] [data-connection-option="${broken.id}"]`).click();
      picker = page.locator("[data-quick-connection-menu] [data-connection-model-picker]");
    }
    await expect(picker).toContainText("Couldn't load the model list. You can still type a model ID.");
    await expect(picker.locator("[data-model-section]")).toHaveCount(0);
    await expect(picker.locator('[data-model-row][data-model-id^="gpt-"]')).toHaveCount(0);
    search = picker.locator("[data-model-search]");
    await search.fill("local/my-model");
    await expect(picker.locator("[data-model-use-typed]")).toContainText("Press Enter to use this ID.");
    await search.press("Enter");
    await expect.poll(async () => (await connectionRow(request, broken.id))?.model).toBe("local/my-model");
  } finally {
    await cleanup();
  }
});

test("the models menu reads in light theme too (#7098)", async ({ page, request }, testInfo) => {
  const { main, cleanup } = await setup(page, request, testInfo, "light");
  try {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("[data-chat-composer]").first()).toBeVisible();
    const picker = await openModels(page, testInfo, main.id);
    await picker.getByRole("button", { name: "Pin Gamma", exact: true }).click();
    await expect(modelRow(picker, "pinned", "vendor/gamma")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await capture(page, testInfo, isPhone(testInfo) ? "mobile-models-step-light" : "desktop-models-menu-light");
  } finally {
    await cleanup();
  }
});
