// Add connection redesign (decision 29): the empty new-chat gate opens the Add window at once; a failed test
// offers "Try again" and never "Choose models"; a passing test names how many models it found; on a first run
// the first pick becomes the Main model and "Start chatting" creates the chat with it. Add model on a card opens
// the same model screen alone, where a star adds a model (decisions 30 and 32).
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { showConnectionsList } from "./connections-panel.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

type Row = { id: string; accountId?: string | null; isDefault?: unknown; defaultForAgents?: unknown };
const isTrue = (value: unknown) => value === true || value === "true";

/** A stand-in local server that lists two models. */
async function startProvider() {
  const server = createServer((req, res) => {
    if (req.url === "/v1/models") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          data: [
            { id: "local/alpha", name: "Alpha", context_length: 64_000 },
            { id: "local/beta", name: "Beta" },
          ],
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing provider port");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** The shared test server has Connections; hiding them makes this a first run. */
async function hideExisting(page: Page, request: APIRequestContext) {
  const rows = (await (await request.get("/api/connections")).json()) as Row[];
  const accounts = (await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>;
  const hiddenRows = new Set(rows.map((row) => row.id));
  const hiddenAccounts = new Set(accounts.map((account) => account.id));
  for (const [path, hidden] of [
    ["/api/connections", hiddenRows],
    ["/api/connection-accounts", hiddenAccounts],
  ] as const) {
    await page.route(`**${path}`, async (route) => {
      if (route.request().method() !== "GET" || new URL(route.request().url()).pathname !== path) {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      const body = ((await response.json()) as Array<{ id: string }>).filter((item) => !hidden.has(item.id));
      await route.fulfill({ response, json: body });
    });
  }
  return { rows, hiddenRows, hiddenAccounts };
}

test("a first run adds a connection from the empty new-chat gate and starts the chat", async ({ page, request }) => {
  const provider = await startProvider();
  const { rows, hiddenRows, hiddenAccounts } = await hideExisting(page, request);
  const previousMain = rows.find((row) => isTrue(row.isDefault));
  const previousAgents = rows.find((row) => isTrue(row.defaultForAgents));
  let chatId: string | null = null;
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript((appVersion) => {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      localStorage.removeItem("marinara-active-chat-id");
    }, APP_VERSION);
    await page.goto("/");
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setPendingNewChatMode("conversation");
    });

    // No gate box: the Add window itself, and it names the chat that follows.
    const dialog = page.getByRole("dialog", { name: "Add connection", exact: true });
    await expect(dialog).toBeVisible();
    await expect(page.locator("[data-new-chat-connection-gate]")).toHaveCount(0);
    await expect(dialog.getByText("Connect an AI service, then we start your Conversation.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "OpenRouter", exact: true })).toBeVisible();
    // Built-in parts are in the list too, until they are set up (decision 32).
    await expect(dialog.getByRole("button", { name: "Text to Speech", exact: true })).toBeVisible();

    // A rejected key gets a plain reason and Try again; no way on to the models.
    await page.route("**/api/connections/*/test", (route) =>
      route.fulfill({
        json: { success: false, message: "API returned 401: invalid key", latencyMs: 1, modelName: null },
      }),
    );
    // Stepped flow (decision 29b): screen 1 is the list alone, screen 2 the connect form alone, Back returns.
    await expect(dialog.getByLabel("API key", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "OpenRouter", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "OpenAI-compatible address", exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "OpenAI-compatible address", exact: true })).toBeVisible();
    await expect(dialog.getByLabel("API key", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "OpenRouter", exact: true }).click();
    await expect(dialog.getByRole("link", { name: /Where do I find my key\?/ })).toHaveAttribute(
      "href",
      "https://openrouter.ai/keys",
    );
    await dialog.getByLabel("API key", { exact: true }).fill("sk-or-wrong");
    await dialog.locator("[data-add-connection-connect]").click();
    await expect(dialog.getByRole("status").filter({ hasText: "The key was not accepted." })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Choose models", exact: true })).toHaveCount(0);
    await page.unroute("**/api/connections/*/test");

    // Back to the list (this throws the unused Connection away), then a local server.
    await dialog.getByRole("button", { name: "Back", exact: true }).click();
    await dialog.getByRole("button", { name: "OpenAI-compatible address", exact: true }).click();
    await dialog.getByLabel("Server address", { exact: true }).fill(`${provider.baseUrl}/offline`);
    await dialog.locator("[data-add-connection-connect]").click();
    await expect(dialog.locator('[data-add-connection-result="failed"]')).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Choose models", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Continue anyway", exact: true })).toBeVisible();

    await dialog.getByLabel("Server address", { exact: true }).fill(provider.baseUrl);
    await dialog.locator("[data-add-connection-connect]").click();
    await expect(dialog.locator('[data-add-connection-step="3"]')).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /^Add models to / })).toBeVisible();
    await dialog.locator('[data-model-id="local/alpha"] [data-model-option]').click();
    // Merely starring a model does not change Main before the explicit Ready choice.
    await expect(dialog.locator('[data-model-id="local/alpha"] [data-connection-role]')).toHaveCount(0);
    // A pick gets the star (decision 30).
    await expect(dialog.locator('[data-model-id="local/alpha"] [data-model-star]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(dialog.getByText("1 model added")).toBeVisible();
    // No Main model yet: the first model added is offered as Main, with its box on, under the list.
    await expect(dialog.locator("[data-add-connection-make-main]")).toBeChecked();
    const created = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/chats",
    );
    await dialog.getByRole("button", { name: "Start chatting", exact: true }).click();
    const chat = (await (await created).json()) as { id: string; connectionId: string | null };
    chatId = chat.id;
    await expect(dialog).toHaveCount(0);

    const after = (await (await request.get("/api/connections")).json()) as Array<Row & { model?: string }>;
    const added = after.filter((row) => !hiddenRows.has(row.id));
    expect(added.map((row) => row.model)).toEqual(["local/alpha"]);
    expect(chat.connectionId).toBe(added[0]!.id);
    // The OpenRouter try was thrown away when the user went back.
    const accountsAfter = (await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>;
    expect(accountsAfter.filter((account) => !hiddenAccounts.has(account.id))).toHaveLength(1);
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    // Models first: a Connection that still has Models cannot be deleted.
    const rowsAfter = (await (await request.get("/api/connections")).json()) as Row[];
    for (const row of rowsAfter.filter((item) => !hiddenRows.has(item.id))) {
      await request.delete(`/api/connections/${row.id}`).catch(() => undefined);
    }
    const after = (await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>;
    for (const account of after.filter((item) => !hiddenAccounts.has(item.id))) {
      await request.delete(`/api/connection-accounts/${account.id}`).catch(() => undefined);
    }
    // The first pick took the Main and Agents defaults; give them back.
    if (previousMain) await request.patch(`/api/connections/${previousMain.id}`, { data: { isDefault: true } });
    if (previousAgents)
      await request.patch(`/api/connections/${previousAgents.id}`, { data: { defaultForAgents: true } });
    await provider.close();
  }
});

test("Add model on a card opens the model screen; a star adds a model and taking it off removes it again", async ({
  page,
  request,
}) => {
  const provider = await startProvider();
  const created = (await (
    await request.post("/api/connection-accounts", {
      data: { provider: "custom", name: "E2E add model", baseUrl: provider.baseUrl, model: "local/alpha" },
    })
  ).json()) as { account: { id: string }; connectionId: string };
  const accountRows = async () =>
    (
      (await (await request.get("/api/connections")).json()) as Array<Row & { model?: string; pinnedModels?: string }>
    ).filter((row) => row.accountId === created.account.id);
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: true, rightPanel: "connections" });
    await page.addInitScript((appVersion) => {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    }, APP_VERSION);
    await page.goto("/");

    // Add model sits in the Connection's ⋯ menu in the list.
    await page
      .locator(`[data-connection-account-id="${created.account.id}"]`)
      .getByRole("button", { name: "Actions for E2E add model", exact: true })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Add model", exact: true }).click();
    const screen = page.getByRole("dialog", { name: "Add model", exact: true });
    await expect(screen.getByText("Add models to E2E add model")).toBeVisible();
    // No steps: the screen is the model list alone.
    await expect(screen.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);

    const star = screen.locator('[data-model-id="local/beta"] [data-model-star]');
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await expect(screen.getByText("1 model added")).toBeVisible();
    await expect.poll(async () => (await accountRows()).filter((row) => row.model === "local/beta").length).toBe(1);
    await expect
      .poll(async () => (await accountRows()).find((row) => row.id === created.connectionId)?.pinnedModels)
      .toBe('["local/beta"]');

    // Taking the star off a model added here removes it again (decision 30): it has no role and no settings of
    // its own, so it goes once the Undo toast closes.
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Removed Beta from your models")).toBeVisible();
    await expect
      .poll(async () => (await accountRows()).filter((row) => row.model === "local/beta").length, { timeout: 15_000 })
      .toBe(0);
    await screen.getByRole("button", { name: "Done", exact: true }).click();
    await expect(screen).toHaveCount(0);
  } finally {
    for (const row of await accountRows().catch(() => [])) {
      await request.delete(`/api/connections/${row.id}`).catch(() => undefined);
    }
    await request.delete(`/api/connection-accounts/${created.account.id}`).catch(() => undefined);
    await provider.close();
  }
});

test("the panel list shows each Connection's Models open, and its row or toggle folds them shut", async ({
  page,
  request,
}) => {
  const created = (await (
    await request.post("/api/connection-accounts", {
      data: { provider: "custom", name: "E2E open models", baseUrl: "http://127.0.0.1:9/v1", model: "local/open-one" },
    })
  ).json()) as { account: { id: string }; connectionId: string };
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: true, rightPanel: "connections" });
    await page.addInitScript((appVersion) => {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    }, APP_VERSION);
    await page.goto("/");

    const model = page.locator(`[data-connection-id="${created.connectionId}"]`).filter({ visible: true });
    await expect(model).toBeVisible();
    const toggle = page.locator(`[data-connections-toggle="${created.account.id}"]`).filter({ visible: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(model).toHaveCount(0);
    await toggle.click();
    await expect(model).toBeVisible();

    // The Connection's row folds the same way; it opens no page of its own.
    const row = page.locator(`[data-connections-row="account:${created.account.id}"]`).filter({ visible: true });
    await row.click();
    await expect(model).toHaveCount(0);
    await row.click();
    await expect(model).toBeVisible();

    const panel = page.locator("[data-connections-panel]").filter({ visible: true });
    const search = panel.getByRole("searchbox", { name: "Search models and connections" });
    await search.fill("E2E open models");
    await toggle.click();
    await expect(model).toHaveCount(0);
    await toggle.click();
    await expect(model).toBeVisible();
    // A connection whose final Model was deleted still shows, with its Add model action.
    await request.delete(`/api/connections/${created.connectionId}`);
    await page.reload();
    await expect(row).toBeVisible();
  } finally {
    await request.delete(`/api/connections/${created.connectionId}`);
    await request.delete(`/api/connection-accounts/${created.account.id}`);
  }
});

/** Opens the app with an optional open chat, then the Add window on the custom server's access screen. */
async function openCustomSetup(page: Page, baseUrl: string, chatId?: string) {
  const existing = (await (await page.request.get("/api/connection-accounts")).json()) as Array<{ provider: string }>;
  const hasCustom = existing.some((account) => account.provider === "custom");
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, APP_VERSION);
  await page.goto("/");
  await page.evaluate(async (id) => {
    if (id) {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }
    const { openAddConnection } = await import("/src/lib/add-connection.ts" as string);
    openAddConnection({ provider: "custom" });
  }, chatId ?? null);
  const dialog = page.getByRole("dialog", { name: "Add connection", exact: true });
  if (hasCustom) await dialog.getByRole("button", { name: "Make a new connection", exact: true }).click();
  await dialog.getByLabel("Server address", { exact: true }).fill(baseUrl);
  await dialog.locator("[data-add-connection-connect]").click();
  await expect(dialog.locator('[data-add-connection-step="3"]')).toBeVisible();
  return dialog;
}

/** Deletes the Models, then the Connections, the test made, and gives the Main and Agents defaults back. */
async function removeAdded(request: APIRequestContext, before: Row[]) {
  const known = new Set(before.map((row) => row.id));
  const accountsBefore = new Set(before.map((row) => row.accountId));
  const rows = (await (await request.get("/api/connections")).json()) as Row[];
  const added = rows.filter((row) => !known.has(row.id));
  for (const row of added) await request.delete(`/api/connections/${row.id}`).catch(() => undefined);
  for (const accountId of new Set(added.map((row) => row.accountId)))
    if (accountId && !accountsBefore.has(accountId))
      await request.delete(`/api/connection-accounts/${accountId}`).catch(() => undefined);
  const main = before.find((row) => isTrue(row.isDefault));
  const agents = before.find((row) => isTrue(row.defaultForAgents));
  if (main) await request.patch(`/api/connections/${main.id}`, { data: { isDefault: true } });
  if (agents) await request.patch(`/api/connections/${agents.id}`, { data: { defaultForAgents: true } });
}

const getRows = async (request: APIRequestContext) =>
  (await (await request.get("/api/connections")).json()) as Array<Row & { model?: string }>;

/** Gives the server a Main model when it has none, so Main shows as the quiet "Set as Main" link. Returns a cleanup. */
async function ensureMain(request: APIRequestContext) {
  if ((await getRows(request)).some((row) => isTrue(row.isDefault))) return async () => undefined;
  const created = await request.post("/api/connections", {
    data: { name: "E2E Main", provider: "custom", baseUrl: "http://127.0.0.1:9/v1", apiKey: "", model: "e2e-main" },
  });
  expect(created.ok()).toBeTruthy();
  const { id, accountId } = (await created.json()) as { id: string; accountId?: string | null };
  expect((await request.patch(`/api/connections/${id}`, { data: { isDefault: true } })).ok()).toBeTruthy();
  return async () => {
    await request.delete(`/api/connections/${id}`).catch(() => undefined);
    if (accountId) await request.delete(`/api/connection-accounts/${accountId}`).catch(() => undefined);
  };
}

for (const dismiss of ["Escape", "the close button"] as const) {
  test(`closing the model screen with ${dismiss} saves neither Main nor the chat's model`, async ({
    page,
    request,
  }) => {
    const provider = await startProvider();
    const dropMain = await ensureMain(request);
    const before = await getRows(request);
    const chatResponse = await request.post("/api/chats", {
      data: { name: "E2E ready dismiss", mode: "conversation", characterIds: [] },
    });
    expect(chatResponse.ok()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string; connectionId: string | null };
    try {
      const dialog = await openCustomSetup(page, provider.baseUrl, chat.id);
      await dialog.locator('[data-model-id="local/alpha"] [data-model-option]').click();
      await dialog.locator("[data-add-connection-use-in-chat]").check();
      // The shared server has a Main model, so Main is a quiet link that acts only when pressed.
      await expect(dialog.locator("[data-add-connection-set-main]")).toBeVisible();

      if (dismiss === "Escape") await page.keyboard.press("Escape");
      else await dialog.getByRole("button", { name: "Close Add connection", exact: true }).click();
      await expect(dialog).toHaveCount(0);

      // The added model stays, but only Done applies "Use in this chat".
      const after = await getRows(request);
      const added = after.filter((row) => !before.some((old) => old.id === row.id));
      expect(added.map((row) => row.model)).toEqual(["local/alpha"]);
      expect(isTrue(added[0]!.isDefault)).toBe(false);
      expect(after.find((row) => isTrue(row.isDefault))?.id).toBe(before.find((row) => isTrue(row.isDefault))?.id);
      const chatAfter = (await (await request.get(`/api/chats/${chat.id}`)).json()) as { connectionId: string | null };
      expect(chatAfter.connectionId).toBe(chat.connectionId);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`).catch(() => undefined);
      await removeAdded(request, before);
      await dropMain();
      await provider.close();
    }
  });
}

test("a failed Set as Main keeps the model screen open, and the next try works", async ({ page, request }) => {
  const provider = await startProvider();
  const dropMain = await ensureMain(request);
  const before = await getRows(request);
  try {
    const dialog = await openCustomSetup(page, provider.baseUrl);
    await dialog.locator('[data-model-id="local/alpha"] [data-model-option]').click();
    const setMain = dialog.locator("[data-add-connection-set-main]");
    await expect(setMain).toBeVisible();

    await page.route("**/api/connections/*", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, json: { error: "E2E refused" } })
        : route.fallback(),
    );
    await setMain.click();
    await expect(page.getByText(/Couldn't make it the default/)).toBeVisible();
    await expect(dialog.locator('[data-add-connection-step="3"]')).toBeVisible();
    await expect(setMain).toBeEnabled();

    await page.unroute("**/api/connections/*");
    await setMain.click();
    await expect(dialog.getByText("Alpha is already your Main model.")).toBeVisible();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const added = (await getRows(request)).filter((row) => !before.some((old) => old.id === row.id));
    expect(added.map((row) => [row.model, isTrue(row.isDefault)])).toEqual([["local/alpha", true]]);
  } finally {
    await removeAdded(request, before);
    await dropMain();
    await provider.close();
  }
});

test("unstarring the first model after starring a second keeps the model screen open; unstarring both and closing removes the new Connection", async ({
  page,
  request,
}) => {
  const provider = await startProvider();
  const before = await getRows(request);
  const accountIds = async () =>
    ((await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>)
      .map((account) => account.id)
      .sort();
  const accountsBefore = await accountIds();
  const addedModels = async () =>
    (await getRows(request)).filter((row) => !before.some((old) => old.id === row.id)).map((row) => row.model);
  try {
    const dialog = await openCustomSetup(page, provider.baseUrl);
    // Alpha takes the new Connection's own Model; Beta gets a Model of its own.
    await dialog.locator('[data-model-id="local/alpha"] [data-model-option]').click();
    const alphaStar = dialog.locator('[data-model-id="local/alpha"] [data-model-star]');
    // A tap while Alpha still saves is ignored, so wait for its star.
    await expect(alphaStar).toHaveAttribute("aria-pressed", "true");
    const betaStar = dialog.locator('[data-model-id="local/beta"] [data-model-star]');
    await betaStar.click();
    await expect(betaStar).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText("2 models added")).toBeVisible();

    // Taking Alpha's star off removes the Model the screen was opened on.
    await alphaStar.click();
    await expect(alphaStar).toHaveAttribute("aria-pressed", "false");
    await expect.poll(addedModels, { timeout: 15_000 }).toEqual(["local/beta"]);

    // The list stays on screen with Beta still starred, and the setup can go on.
    await expect(dialog.locator('[data-add-connection-step="3"]')).toBeVisible();
    await expect(betaStar).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText("1 model added")).toBeVisible();

    // Beta goes too: nothing is added, so closing throws the new Connection away, even though the Model the
    // screen was opened on is already gone.
    await betaStar.click();
    await expect(betaStar).toHaveAttribute("aria-pressed", "false");
    await expect.poll(addedModels, { timeout: 15_000 }).toEqual(["local/beta"]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect.poll(accountIds).toEqual(accountsBefore);
    expect(await addedModels()).toEqual([]);
  } finally {
    await removeAdded(request, before);
    await provider.close();
  }
});

/** Opens the app with the Add window closed and the panels shut. */
async function openApp(page: Page) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, APP_VERSION);
  await page.goto("/");
}

test("one search finds jobs, models and services; a model lists every service and the user's own Connection", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/connections", {
    data: {
      name: "E2E Bifrost",
      provider: "custom",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "",
      model: "anthropic/claude-opus-5-5",
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id, accountId } = (await created.json()) as { id: string; accountId: string };
  try {
    await openApp(page);
    await page.evaluate(async () => {
      const { openAddConnection } = await import("/src/lib/add-connection.ts" as string);
      openAddConnection();
    });
    const dialog = page.getByRole("dialog", { name: "Add connection", exact: true });
    // Before typing: jobs, a few models and the services, in that order.
    await expect(dialog.locator('[data-add-connection-section="job"]')).toBeVisible();
    await expect(dialog.locator('[data-add-connection-section="model"]')).toBeVisible();
    await expect(dialog.getByRole("button", { name: "OpenRouter", exact: true })).toBeVisible();

    const search = dialog.getByRole("searchbox");
    await search.fill("opus 5-5");
    const opus = dialog.locator('[data-add-model="claude-opus-5-5"]');
    await expect(opus).toBeVisible();
    for (const service of ["anthropic", "openrouter", "nanogpt"])
      await expect(opus.locator(`[data-add-model-service="${service}"]`)).toBeVisible();
    // The user's own Connection that holds the model comes first, marked as theirs.
    const mine = opus.locator(`[data-add-model-account="${accountId}"]`);
    await expect(mine).toContainText(/^your /);
    await expect(opus.locator("button").first()).toHaveAttribute("data-add-model-account", accountId);

    // A job by name, and a service by name.
    await search.fill("image reading");
    await expect(dialog.locator('[data-add-connection-job-choice="vision"]')).toBeVisible();
    await search.fill("anthropic");
    await expect(dialog.getByRole("button", { name: "Anthropic", exact: true })).toBeVisible();

    // Picking the user's Connection opens its model screen.
    await search.fill("opus 5-5");
    await mine.click();
    await expect(dialog.locator('[data-add-connection-step="3"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  } finally {
    await request.delete(`/api/connections/${id}`).catch(() => undefined);
    await request.delete(`/api/connection-accounts/${accountId}`).catch(() => undefined);
  }
});

test("Defaults' Add a model for this… adds a model, makes it Main, and Undo gives Main back", async ({
  page,
  request,
}) => {
  const provider = await startProvider();
  const dropMain = await ensureMain(request);
  const before = await getRows(request);
  const previousMain = before.find((row) => isTrue(row.isDefault))!;
  const hasCustom = (
    (await (await request.get("/api/connection-accounts")).json()) as Array<{ provider: string }>
  ).some((account) => account.provider === "custom");
  try {
    await openApp(page);
    await showConnectionsList(page);
    const mainTile = page.locator('[data-defaults-tile="main"]').filter({ visible: true });
    if (!(await mainTile.count()))
      await page.locator('[data-connections-row="defaults"]').filter({ visible: true }).click();
    await mainTile.click();
    await page
      .getByRole("button", { name: /^Default model for Main:/ })
      .filter({ visible: true })
      .click();
    await page
      .getByRole("dialog", { name: "Choose a model" })
      .getByRole("button", { name: "Add a model for this…", exact: true })
      .click();

    const dialog = page.getByRole("dialog", { name: "Add connection", exact: true });
    await expect(dialog.locator('[data-add-connection-job="main"]')).toBeVisible();
    await dialog.getByRole("button", { name: "OpenAI-compatible address", exact: true }).click();
    if (hasCustom) await dialog.getByRole("button", { name: "Make a new connection", exact: true }).click();
    await dialog.getByLabel("Server address", { exact: true }).fill(provider.baseUrl);
    await dialog.locator("[data-add-connection-connect]").click();
    await dialog.locator('[data-model-id="local/alpha"] [data-model-option]').click();
    await expect(dialog.locator('[data-model-id="local/alpha"] [data-model-star]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    const toast = page.locator("[data-sonner-toast]").filter({ hasText: /^Now using .+ for Main/ });
    await expect(toast).toBeVisible();
    const mainId = async () => (await getRows(request)).find((row) => isTrue(row.isDefault))?.id;
    const added = async () => (await getRows(request)).find((row) => row.model === "local/alpha")?.id;
    await expect.poll(async () => (await mainId()) === (await added())).toBe(true);

    await toast.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(mainId).toBe(previousMain.id);
  } finally {
    await removeAdded(request, before);
    await dropMain();
    await provider.close();
  }
});
