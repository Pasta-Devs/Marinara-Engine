import { expect, test, type Page, type Request } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

// Home's new-chat buttons wait for the connection list when it is still loading (seconds on Termux, the APK
// and phones), instead of taking a loading list for no connections and asking the user to choose one.
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
const FIRST_LOAD_TIMEOUT_MS = 30_000;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
});

/** Holds every connection list request until `release()`, then answers with `rows` or, without them, the
 *  server's list. */
async function holdConnectionList(page: Page, rows?: unknown[]) {
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  let held = 0;
  await page.route("**/api/connections", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    held += 1;
    await released;
    // The page may have dropped the request while it was held.
    await (rows ? route.fulfill({ json: rows }) : route.continue()).catch(() => undefined);
  });
  return { release, held: () => held };
}

function isChatCreate(request: Request) {
  return request.method() === "POST" && new URL(request.url()).pathname === "/api/chats";
}

test("a new roleplay started before the connection list loads opens the setup, not the connection gate", async ({
  page,
  request,
}) => {
  const suffix = Date.now().toString(36);
  const connectionResponse = await request.post("/api/connections", {
    data: {
      name: `Slow Home Start ${suffix}`,
      provider: "custom",
      baseUrl: "http://127.0.0.1:1/v1",
      apiKey: "slow-home-start-e2e",
      model: "slow-home-start-model",
      maxContext: 32768,
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  const chatIds: string[] = [];
  page.on("response", async (response) => {
    if (isChatCreate(response.request()) && response.ok()) chatIds.push(((await response.json()) as { id: string }).id);
  });
  let releaseChat = () => {};
  const chatReleased = new Promise<void>((resolve) => (releaseChat = resolve));
  await page.route("**/api/chats", async (route) => {
    if (!isChatCreate(route.request())) return route.fallback();
    await chatReleased;
    await route.continue().catch(() => undefined);
  });

  try {
    const list = await holdConnectionList(page);
    await page.goto("/");
    const roleplay = page.getByRole("button", { name: "Start a new roleplay", exact: true });
    await expect(roleplay).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
    await expect.poll(list.held, { message: "the connection list is still loading" }).toBeGreaterThan(0);
    await roleplay.click();
    // A second tap while it waits must not make a second chat.
    await roleplay.dispatchEvent("click");
    const creatingChat = page.waitForRequest(isChatCreate);
    list.release();
    await creatingChat;
    // Keep the first save pending after the list has loaded: taps must stay ignored until it finishes.
    const duplicate = page.waitForRequest(isChatCreate, { timeout: 1_000 }).catch(() => null);
    await roleplay.dispatchEvent("click");
    expect(await duplicate, "a second tap during chat creation must not send another save").toBeNull();
    releaseChat();

    // The first open also compiles the chat area and the lazy setup wizard on the dev server.
    await expect(page.getByRole("heading", { name: "New Roleplay", exact: true })).toBeVisible({
      timeout: FIRST_LOAD_TIMEOUT_MS,
    });
    await expect(page.locator("[data-new-chat-connection-gate]")).toHaveCount(0);
    await expect.poll(() => chatIds.length, { message: "one chat is made" }).toBe(1);
  } finally {
    releaseChat();
    await page.unrouteAll({ behavior: "ignoreErrors" });
    for (const chatId of chatIds) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    await request.delete(`/api/connections/${connection.id}`).catch(() => undefined);
  }
});

test("with no connections at all, a new roleplay still asks for one first", async ({ page }) => {
  let chatCreated = false;
  page.on("request", (request) => {
    if (isChatCreate(request)) chatCreated = true;
  });
  const list = await holdConnectionList(page, []);
  await page.goto("/");
  const roleplay = page.getByRole("button", { name: "Start a new roleplay", exact: true });
  await expect(roleplay).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
  await expect.poll(list.held, { message: "the connection list is still loading" }).toBeGreaterThan(0);
  await roleplay.click();
  list.release();

  const gate = page.locator('[data-new-chat-connection-gate="roleplay"]');
  await expect(gate).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
  await expect(gate.locator("[data-new-chat-connection-empty]")).toBeVisible();
  expect(chatCreated, "no chat is made without a connection").toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

for (const cachedEmpty of [true, false]) {
  test(`a stale ${cachedEmpty ? "empty" : "configured"} connection cache waits for the current list`, async ({
    page,
    request,
  }) => {
    const response = await request.post("/api/connections", {
      data: {
        name: `Stale Home Start ${Date.now().toString(36)}`,
        provider: "custom",
        baseUrl: "http://127.0.0.1:1/v1",
        apiKey: "stale-home-start-e2e",
        model: "stale-home-start-model",
      },
    });
    expect(response.ok()).toBeTruthy();
    const connection = (await response.json()) as { id: string };
    const cached = cachedEmpty ? [] : [connection];
    const current = cachedEmpty ? [connection] : [];
    const chatIds: string[] = [];
    let posts = 0;
    let release = () => {};

    try {
      // Expose the real app QueryClient for the stale-cache setup.
      await page.route(/\/src\/main\.tsx(?:\?.*)?$/, async (route) => {
        const entry = await route.fetch();
        await route.fulfill({
          response: entry,
          body: `${await entry.text()}\nObject.assign(window, { __homeNewChatQueryClient: queryClient });`,
        });
      });
      await page.route("**/api/connections", (route) =>
        route.request().method() === "GET" ? route.fulfill({ json: cached }) : route.fallback(),
      );
      await page.route("**/api/chats", async (route) => {
        if (!isChatCreate(route.request())) return route.fallback();
        posts += 1;
        const created = await route.fetch();
        if (created.ok()) chatIds.push(((await created.json()) as { id: string }).id);
        await route.fulfill({ response: created });
      });
      await page.goto("/");
      const roleplay = page.getByRole("button", { name: "Start a new roleplay", exact: true });
      await expect(roleplay).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { connectionListQuery } = await import("/src/hooks/use-connections.ts" as string);
            return Reflect.get(window, "__homeNewChatQueryClient")?.getQueryState(connectionListQuery.queryKey)
              ?.fetchStatus;
          }),
        )
        .toBe("idle");

      await page.unroute("**/api/connections");
      const list = await holdConnectionList(page, current);
      release = list.release;
      await page.evaluate(async (rows) => {
        const { connectionListQuery } = await import("/src/hooks/use-connections.ts" as string);
        const client = Reflect.get(window, "__homeNewChatQueryClient");
        client.setQueryData(connectionListQuery.queryKey, rows, {
          updatedAt: Date.now() - connectionListQuery.staleTime - 1,
        });
        // The mounted useConnections observer starts a refetch, which the launch must join.
        void client.invalidateQueries({ queryKey: connectionListQuery.queryKey, exact: true });
      }, cached);
      await expect.poll(list.held).toBe(1);
      const prematureSave = page.waitForRequest(isChatCreate, { timeout: 500 }).catch(() => null);
      await roleplay.click();
      expect(await prematureSave, "a stale cache must not start a chat while the current list is loading").toBeNull();
      await expect(page.locator("[data-new-chat-connection-gate]")).toHaveCount(0);
      await roleplay.dispatchEvent("click");
      list.release();

      if (cachedEmpty) {
        await expect(page.getByRole("heading", { name: "New Roleplay", exact: true })).toBeVisible({
          timeout: FIRST_LOAD_TIMEOUT_MS,
        });
        await expect(page.locator("[data-new-chat-connection-gate]")).toHaveCount(0);
        expect(posts, "the two taps create one chat after the current list loads").toBe(1);
      } else {
        const gate = page.locator('[data-new-chat-connection-gate="roleplay"]');
        await expect(gate).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT_MS });
        await expect(gate.locator("[data-new-chat-connection-empty]")).toBeVisible();
        expect(posts, "the removed connection must not allow a chat to be created").toBe(0);
      }
      expect(list.held(), "the launch joins the observer's existing request").toBe(1);
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
      for (const chatId of chatIds) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
      await request.delete(`/api/connections/${connection.id}`).catch(() => undefined);
    }
  });
}
