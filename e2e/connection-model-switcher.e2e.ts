// #7098: the input-box Connections menu shows the chosen connection's models. Lists are saved on the
// connection, so reopening (even after a reload) does not ask the provider again; Refresh does. Models
// can be pinned, typed by ID, and changed from Chat Settings → Connection too.
// Connections redesign (decisions 25/26): a catalog pick in the menu applies to this chat only and saves no Model;
// it never edits a saved Model. The toast offers Undo and "Make it my Main model"; Recent lists this chat's last
// two choices; the star and "Save to library" save a model. Chat Settings → Connection works the same way.
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
  const createConnection = async (name: string, model: string, baseUrl = provider.baseUrl, apiKey = "") => {
    const response = await request.post("/api/connections", {
      // A separate embedding model shows that a model pick leaves the connection's other models alone.
      data: {
        name,
        provider: "custom",
        baseUrl,
        apiKey,
        model,
        maxContext: 8_000,
        embeddingModel: "fixture-embedding",
      },
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as { id: string };
  };
  const main = await createConnection(`Router ${suffix}`, "vendor/alpha");
  // Another key for the same server: a different key makes it a Connection of its own.
  const other = await createConnection(`Backup ${suffix}`, "vendor/kappa", provider.baseUrl, "fixture-other-key");
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
    // Picks add Models under these Connections; remove them all, then the Connections.
    const rows = (await (await request.get("/api/connections")).json()) as Array<{ id: string; accountId?: string }>;
    const accountIds = new Set(
      rows.filter((row) => [main.id, other.id, broken.id].includes(row.id)).map((row) => row.accountId),
    );
    for (const row of rows) {
      if (row.accountId && accountIds.has(row.accountId)) await request.delete(`/api/connections/${row.id}`);
    }
    for (const accountId of accountIds) if (accountId) await request.delete(`/api/connection-accounts/${accountId}`);
    await provider.close();
  };
  return { provider, main, other, broken, chat, cleanup, suffix };
}

async function connectionRows(request: APIRequestContext) {
  return (await (await request.get("/api/connections")).json()) as Array<Record<string, unknown>>;
}

async function connectionRow(request: APIRequestContext, id: string) {
  return (await connectionRows(request)).find((row) => row.id === id) ?? null;
}

/** The saved Models of one Connection. */
async function accountRows(request: APIRequestContext, accountId: unknown) {
  return (await connectionRows(request)).filter((row) => row.accountId === accountId);
}

/** What the chat runs: its Model, and its per-chat catalog pick when it has one (decision 26). */
async function chatState(request: APIRequestContext, chatId: string) {
  const chat = (await (await request.get(`/api/chats/${chatId}`)).json()) as {
    connectionId?: string | null;
    metadata?: unknown;
  };
  const metadata = (typeof chat.metadata === "string" ? JSON.parse(chat.metadata || "{}") : (chat.metadata ?? {})) as {
    modelOverride?: Record<string, unknown> | null;
  };
  const override = metadata.modelOverride?.connectionId === chat.connectionId ? metadata.modelOverride : null;
  const row = chat.connectionId ? await connectionRow(request, chat.connectionId) : null;
  const model = (override?.model ?? row?.model ?? null) as string | null;
  return { connectionId: chat.connectionId ?? null, override, row, model };
}

const isPhone = (testInfo: TestInfo) => testInfo.project.name.includes("mobile");

async function openMenu(page: Page, testInfo: TestInfo): Promise<Locator> {
  const phone = isPhone(testInfo);
  await page.getByRole("button", { name: phone ? "Quick Switcher" : "Quick Connection Switcher", exact: true }).click();
  const menu = page.locator(phone ? "[data-quick-switcher-mobile-menu]" : "[data-quick-connection-menu]");
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * Shows a Connection's catalog: its group opens in place (the chat's own one is open already); a phone then
 * takes the "Browse all models" step, a desktop shows it in the right column.
 */
async function showModels(menu: Locator, testInfo: TestInfo, groupKey: string): Promise<Locator> {
  const header = menu.locator(`[data-connection-group="${groupKey}"]`);
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
  const picker = menu.locator("[data-connection-model-picker]");
  if (isPhone(testInfo)) {
    await menu.locator(`[data-switcher-browse="${groupKey}"]`).click();
    await expect(picker.locator("[data-model-back]")).toBeVisible();
  }
  return picker;
}

const openModels = async (page: Page, testInfo: TestInfo, groupKey: string) =>
  showModels(await openMenu(page, testInfo), testInfo, groupKey);

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
  const { provider, main, other, broken, chat, cleanup } = await setup(page, request, testInfo, "dark");
  const chatModel = async () => (await chatState(request, chat.id)).model;
  const mainAccount = (await connectionRow(request, main.id))!.accountId as string;
  const otherAccount = ((await connectionRow(request, other.id))!.accountId as string) ?? other.id;
  const brokenGroup = ((await connectionRow(request, broken.id))!.accountId as string) ?? broken.id;
  const menuGone = () =>
    expect(page.locator("[data-quick-connection-menu], [data-quick-switcher-mobile-menu]")).toHaveCount(0);
  try {
    await page.goto("/");
    await expect(page.locator("[data-chat-composer]").first()).toBeVisible();

    // The first look fetches the list once and saves it on the connection.
    let menu = await openMenu(page, testInfo);
    // The chat's Connection is open in place with its saved Models; the others are collapsed.
    await expect(menu.locator(`[data-connection-group="${mainAccount}"]`)).toHaveAttribute("aria-expanded", "true");
    await expect(menu.locator(`[data-connection-group="${otherAccount}"]`)).toHaveAttribute("aria-expanded", "false");
    await expect(menu.locator(`[data-switcher-group-models="${mainAccount}"]`)).toContainText("Browse all models");
    let picker = await showModels(menu, testInfo, mainAccount);
    await expect(picker).toContainText("Models");
    await expect(picker.locator("[data-model-picker-provider]")).not.toBeEmpty();
    await expect(modelRow(picker, "all", "vendor/gamma")).toBeVisible();
    await expect(modelRow(picker, "all", "vendor/alpha").locator("[data-model-option]")).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(picker).toContainText("Applies to this chat");
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
      // The back control returns to the connection list, where the group and its browse row are full-size targets.
      await picker.locator("[data-model-back]").click();
      await expect(sheet.locator("[data-connection-model-picker]")).toHaveCount(0);
      for (const target of [
        sheet.locator(`[data-connection-group="${mainAccount}"]`),
        sheet.locator(`[data-switcher-browse="${mainAccount}"]`),
      ]) {
        await expect(target).toBeVisible();
        expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      picker = await showModels(sheet, testInfo, mainAccount);
      await expect(modelRow(picker, "all", "vendor/beta")).toBeVisible();
    } else {
      // With a mouse the search over all models takes focus; in the models column, arrows move through the list.
      await expect(page.locator("[data-quick-connection-menu] [data-switcher-search]")).toBeFocused();
      await picker.locator("[data-model-search]").focus();
      await page.keyboard.press("ArrowDown");
      await expect(picker.locator("[data-model-option]").first()).toBeFocused();
    }

    // Pinning moves a model into Pinned; the star names what it pins, and it saves the model to the library.
    await picker.getByRole("button", { name: "Pin Beta", exact: true }).click();
    await expect(modelRow(picker, "pinned", "vendor/beta")).toBeVisible();
    await expect(modelRow(picker, "all", "vendor/beta")).toHaveCount(0);
    await expect(picker.getByRole("button", { name: "Pin Beta", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(picker.getByRole("button", { name: "Pin Beta", exact: true })).toHaveAttribute("title", "Unpin Beta");
    await expect.poll(async () => (await connectionRow(request, main.id))?.pinnedModels).toBe('["vendor/beta"]');
    await expect
      .poll(async () => (await accountRows(request, mainAccount)).find((row) => row.model === "vendor/beta")?.name)
      .toBe("Beta");
    await capture(page, testInfo, isPhone(testInfo) ? "mobile-models-step-dark" : "desktop-models-menu-dark");

    // The pin and the saved list survive a reload without asking the provider again.
    await page.reload();
    await expect(page.locator("[data-chat-composer]").first()).toBeVisible();
    picker = await openModels(page, testInfo, mainAccount);
    await expect(modelRow(picker, "pinned", "vendor/beta")).toBeVisible();
    await expect(modelRow(picker, "all", "vendor/gamma")).toBeVisible();
    expect(provider.state.calls).toBe(1);

    // A catalog pick applies to this chat only: the chat keeps its Model and runs Gamma on it with the catalog's
    // context size and output limit. No Model is saved and the saved one does not change.
    const beforePick = (await connectionRow(request, main.id))!;
    const savedCount = (await accountRows(request, mainAccount)).length;
    await modelRow(picker, "all", "vendor/gamma").locator("[data-model-option]").click();
    await menuGone();
    await expect.poll(chatModel).toBe("vendor/gamma");
    const picked = await chatState(request, chat.id);
    expect({ connectionId: picked.connectionId, override: picked.override }).toEqual({
      connectionId: main.id,
      override: {
        connectionId: main.id,
        model: "vendor/gamma",
        name: "Gamma",
        maxContext: 200_000,
        maxTokensOverride: 8_192,
      },
    });
    expect((await accountRows(request, mainAccount)).length).toBe(savedCount);
    expect(await connectionRow(request, main.id)).toEqual(beforePick);
    // The toast offers Undo and "Make it my Main model"; Undo puts the chat back.
    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "This chat now uses Gamma" });
    await expect(toast.getByRole("button", { name: "Make it my Main model" })).toBeVisible();
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect.poll(chatModel).toBe("vendor/alpha");
    expect((await chatState(request, chat.id)).override).toBeNull();

    picker = await openModels(page, testInfo, mainAccount);
    await modelRow(picker, "all", "vendor/gamma").locator("[data-model-option]").click();
    await menuGone();
    await expect.poll(chatModel).toBe("vendor/gamma");
    // The pick shows as current, in the open group ("This chat only") and in the catalog.
    menu = await openMenu(page, testInfo);
    await expect(menu.locator(`[data-switcher-group-models="${mainAccount}"]`)).toContainText("This chat only");
    picker = await showModels(menu, testInfo, mainAccount);
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
    expect(await chatModel()).toBe("vendor/gamma");

    if (!isPhone(testInfo)) {
      // Keys pressed while an input method is composing belong to the composition.
      for (const key of ["Enter", "Escape"]) {
        await search.evaluate((input, key) => {
          input.dispatchEvent(new KeyboardEvent("keydown", { key, isComposing: true, bubbles: true }));
        }, key);
      }
      await expect(picker).toBeVisible();
      expect(await chatModel()).toBe("vendor/gamma");
    }

    // A search with one match picks that model, and focus goes back to the menu button.
    await search.fill("kapp");
    await search.press("Enter");
    await menuGone();
    await expect.poll(chatModel).toBe("vendor/kappa");
    if (!isPhone(testInfo)) {
      await expect(page.getByRole("button", { name: "Quick Connection Switcher", exact: true })).toBeFocused();
    }

    // A model's name, typed in any case, picks that model rather than saving the name as an ID.
    picker = await openModels(page, testInfo, mainAccount);
    search = picker.locator("[data-model-search]");
    await search.fill("gamma");
    await search.press("Enter");
    await menuGone();
    await expect.poll(chatModel).toBe("vendor/gamma");

    // A typed ID that matches nothing can be used with Enter.
    picker = await openModels(page, testInfo, mainAccount);
    search = picker.locator("[data-model-search]");
    await search.fill("my-org/custom-model");
    await expect(picker.locator("[data-model-use-typed]")).toContainText("Use “my-org/custom-model”");
    await expect(picker.locator("[data-model-use-typed]")).toContainText("Press Enter to use this ID.");
    await search.press("Enter");
    await menuGone();
    await expect.poll(chatModel).toBe("my-org/custom-model");
    picker = await openModels(page, testInfo, mainAccount);
    await expect(modelRow(picker, "all", "my-org/custom-model").locator("[data-model-option]")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect((await connectionRow(request, main.id))?.model).toBe("vendor/alpha");
    await closeMenu(page);

    // Recent lists this chat's last two choices; picking one switches back to it.
    menu = await openMenu(page, testInfo);
    const recent = menu.locator('[data-switcher-section="recent"]');
    await expect(recent.locator("[data-switcher-entry]")).toHaveCount(2);
    await expect(recent).toContainText("Gamma");
    await expect(recent).toContainText("Kappa");
    await recent.locator('[data-switcher-entry="vendor/kappa"]').click();
    await menuGone();
    await expect.poll(chatModel).toBe("vendor/kappa");

    // "Save to library" makes the chat's pick a saved Model and points the chat at it.
    menu = await openMenu(page, testInfo);
    await menu.locator("[data-switcher-save]").click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: "Kappa is saved to your library" }),
    ).toBeVisible();
    await expect.poll(async () => (await chatState(request, chat.id)).override).toBeNull();
    const kappa = (await chatState(request, chat.id)).row!;
    expect({ model: kappa.model, name: kappa.name, accountId: kappa.accountId }).toEqual({
      model: "vendor/kappa",
      name: "Kappa",
      accountId: mainAccount,
    });
    await closeMenu(page);

    // Another Connection opens in place; a pick of its own saved model moves the chat to that Model.
    menu = await openMenu(page, testInfo);
    picker = await showModels(menu, testInfo, otherAccount);
    await expect(menu.locator(`[data-switcher-group-models="${otherAccount}"]`)).toContainText("Browse all models");
    await expect(picker.locator("[data-model-picker-provider]")).not.toBeEmpty();
    await modelRow(picker, "all", "vendor/kappa").locator("[data-model-option]").click();
    await menuGone();
    await expect.poll(async () => (await chatState(request, chat.id)).connectionId).toBe(other.id);
    expect((await chatState(request, chat.id)).override).toBeNull();
    expect((await connectionRow(request, other.id))?.model).toBe("vendor/kappa");
    expect(provider.state.calls).toBeLessThanOrEqual(3);

    // Any model in two moves: the search finds catalog models of every Connection, and Enter picks it for this chat.
    menu = await openMenu(page, testInfo);
    const switcherSearch = menu.locator("[data-switcher-search]");
    await switcherSearch.fill("Delta");
    await expect(menu.locator("[data-switcher-results]")).toContainText("Add from catalog");
    await switcherSearch.press("Enter");
    await menuGone();
    await expect.poll(chatModel).toBe("vendor/delta");
    const delta = await chatState(request, chat.id);
    // Both Connections list Delta now; the first hit runs on one of their Models, and nothing is saved.
    expect([mainAccount, otherAccount]).toContain(delta.row?.accountId);
    expect(delta.override?.model).toBe("vendor/delta");
    for (const account of [mainAccount, otherAccount]) {
      expect((await accountRows(request, account)).some((row) => row.model === "vendor/delta")).toBe(false);
    }

    // Back to the other Connection's own Model for the settings check below (this drops the catalog pick).
    expect((await request.patch(`/api/chats/${chat.id}`, { data: { connectionId: other.id } })).ok()).toBeTruthy();
    expect((await chatState(request, chat.id)).override).toBeNull();
    await page.reload();
    await expect(page.locator("[data-chat-composer]").first()).toBeVisible();
    const callsBeforeSettings = provider.state.calls;

    // Chat Settings → Connection has the same picker, and a pick there applies to this chat only too.
    const settings = await openChatSettings(page);
    const field = settings.locator("[data-chat-settings-model-field]");
    await field.scrollIntoViewIfNeeded();
    if (isPhone(testInfo)) {
      expect((await field.locator("button[aria-expanded]").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await field.locator("button[aria-expanded]").click();
    const settingsPicker = field.locator("[data-connection-model-picker]");
    await expect(settingsPicker).toContainText("Applies to this chat");
    await expect(settingsPicker).not.toContainText("Model changes are saved to this connection.");
    // The opened list is scrolled into view inside Chat Settings (it can start near a phone's bottom edge).
    await expect
      .poll(async () => {
        const [sheet, list] = [await settings.boundingBox(), await settingsPicker.boundingBox()];
        return !!sheet && !!list && list.y >= sheet.y - 1 && list.y + list.height <= sheet.y + sheet.height + 1;
      })
      .toBe(true);
    // Pins belong to a Connection: Beta was pinned on the first one, not on this one.
    await expect(modelRow(settingsPicker, "pinned", "vendor/beta")).toHaveCount(0);
    await settingsPicker.locator('[data-model-row][data-model-id="vendor/alpha"] [data-model-option]').click();
    await expect(settingsPicker).toHaveCount(0);
    await expect(field.locator("button[aria-expanded]")).toContainText("vendor/alpha");
    await expect.poll(chatModel).toBe("vendor/alpha");
    expect((await chatState(request, chat.id)).connectionId).toBe(other.id);
    expect((await connectionRow(request, other.id))?.model).toBe("vendor/kappa");
    expect(provider.state.calls).toBe(callsBeforeSettings);
    await expectNoHorizontalScroll(page);
    await closeChatSettings(page);

    // A custom endpoint whose list cannot be read says so plainly, shows no built-in catalog, and still
    // takes a typed model ID (for this chat).
    picker = await openModels(page, testInfo, brokenGroup);
    await expect(picker).toContainText("Couldn't load the model list. You can still type a model ID.");
    await expect(picker.locator("[data-model-section]")).toHaveCount(0);
    await expect(picker.locator('[data-model-row][data-model-id^="gpt-"]')).toHaveCount(0);
    search = picker.locator("[data-model-search]");
    await search.fill("local/my-model");
    await expect(picker.locator("[data-model-use-typed]")).toContainText("Press Enter to use this ID.");
    await search.press("Enter");
    await expect.poll(chatModel).toBe("local/my-model");
    expect((await connectionRow(request, broken.id))?.model).toBe("");
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
    const groupKey = ((await connectionRow(request, main.id))?.accountId as string) ?? main.id;
    const picker = await openModels(page, testInfo, groupKey);
    await picker.getByRole("button", { name: "Pin Gamma", exact: true }).click();
    await expect(modelRow(picker, "pinned", "vendor/gamma")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await capture(page, testInfo, isPhone(testInfo) ? "mobile-models-step-light" : "desktop-models-menu-light");
  } finally {
    await cleanup();
  }
});
