// Add connection redesign (decision 29): the empty new-chat gate opens the Add window at once; a failed test
// offers "Try again" and never "Choose models"; a passing test names how many models it found; on a first run
// the first pick becomes the Main model and "Start chatting" creates the chat with it. Add model on a card opens
// the same model screen alone, where a star adds a model (decisions 30 and 32).
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

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
    await expect(dialog.getByRole("button", { name: "Custom (OAI-Compatible)", exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Custom (OAI-Compatible)", exact: true })).toBeVisible();
    await expect(dialog.getByLabel("API key", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "OpenRouter", exact: true }).click();
    await expect(dialog.getByRole("link", { name: /Get your OpenRouter API key/ })).toHaveAttribute(
      "href",
      "https://openrouter.ai/keys",
    );
    await dialog.getByLabel("API key", { exact: true }).fill("sk-or-wrong");
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(dialog.getByRole("status").filter({ hasText: "The key was not accepted." })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Choose models", exact: true })).toHaveCount(0);
    await page.unroute("**/api/connections/*/test");

    // Back to the list (this throws the unused Connection away), then a local server.
    await dialog.getByRole("button", { name: "Service", exact: true }).click();
    await dialog.getByRole("button", { name: "Custom (OAI-Compatible)", exact: true }).click();
    await dialog.getByLabel("Server address", { exact: true }).fill(`${provider.baseUrl}/offline`);
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(dialog.locator('[data-add-connection-result="failed"]')).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Choose models", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Continue anyway", exact: true })).toBeVisible();

    await dialog.getByLabel("Server address", { exact: true }).fill(provider.baseUrl);
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(dialog.getByText("Connected · 2 models found")).toBeVisible();
    await dialog.getByRole("button", { name: "Choose models", exact: true }).click();

    await expect(dialog.getByText("Your first pick becomes your Main model.", { exact: false })).toBeVisible();
    await dialog.locator('[data-model-id="local/alpha"] [data-model-option]').click();
    await expect(dialog.locator('[data-model-id="local/alpha"] [data-model-main]')).toBeVisible();
    // A pick gets the star (decision 30).
    await expect(dialog.locator('[data-model-id="local/alpha"] [data-model-star]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(dialog.getByText("1 model added")).toBeVisible();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();

    await expect(dialog.getByText("1 model added · Alpha is your Main model")).toBeVisible();
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

    await page.locator(`[data-connections-row="account:${created.account.id}"]`).click();
    await page.locator(`[data-connection-account-id="${created.account.id}"] [data-add-model]`).click();
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

test("the panel list shows each Connection's Models open, and a toggle folds them shut", async ({ page, request }) => {
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

    // The Connection itself still opens its page.
    await page.locator(`[data-connections-row="account:${created.account.id}"]`).filter({ visible: true }).click();
    await expect(page.locator(`[data-connection-account-id="${created.account.id}"]`)).toBeVisible();
  } finally {
    await request.delete(`/api/connection-accounts/${created.account.id}`);
  }
});
