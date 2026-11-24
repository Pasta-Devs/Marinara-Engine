// #9758: the Connections panel's quick wins. The panel shows search from 8 Models, the Jobs box is a summary with a
// Jobs page, an account's long model list folds behind Browse and narrows by model family, and the chat's model
// chooser lists this device's recent picks after Starred.
import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { hideExistingItems, openConnectionsPanel, openJobsPage } from "./connections-panel.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/** A catalog of several model families, with proxy-style prefixes, long enough to fold and to get chips. */
const CATALOG = [
  ...Array.from({ length: 8 }, (_, index) => `anthropic/claude-test-${index}`),
  ...Array.from({ length: 6 }, (_, index) => `openai/gpt-test-${index}`),
  ...Array.from({ length: 4 }, (_, index) => `[SP] gpt-proxy-${index}`),
  ...Array.from({ length: 6 }, (_, index) => `deepseek-test-${index}`),
  ...Array.from({ length: 3 }, (_, index) => `mystery-model-${index}`),
];

async function startProvider() {
  const server = createServer((req, res) => {
    if (req.url === "/v1/models") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: CATALOG.map((id) => ({ id, name: id })) }));
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

/** Shows only this test's Models and accounts, and opens the app with the Connections panel. */
async function setup(page: Page, request: APIRequestContext, ui: Record<string, unknown> = {}) {
  await hideExistingItems(page, request, "/api/connections");
  await hideExistingItems(page, request, "/api/connection-accounts");
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: true,
    rightPanel: "connections",
    connectionsCollapsed: [],
    chibiProfessorMariEnabled: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    ...ui,
  });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
}

/** One account on the stand-in provider; each call saves one more Model under it. */
function modelMaker(request: APIRequestContext, baseUrl: string, name: string) {
  const ids: string[] = [];
  const add = async (model: string) => {
    const response = await request.post("/api/connections", {
      data: { name: `${name} ${model}`, provider: "custom", baseUrl, apiKey: "", model },
    });
    expect(response.ok()).toBeTruthy();
    const row = (await response.json()) as { id: string; accountId?: string };
    ids.push(row.id);
    return row;
  };
  const cleanup = async () => {
    const rows = (await (await request.get("/api/connections")).json()) as Array<{ id: string; accountId?: string }>;
    const accounts = new Set(rows.filter((row) => ids.includes(row.id)).map((row) => row.accountId));
    for (const row of rows)
      if (row.accountId && accounts.has(row.accountId)) await request.delete(`/api/connections/${row.id}`);
    for (const account of accounts) if (account) await request.delete(`/api/connection-accounts/${account}`);
  };
  return { add, cleanup };
}

const panelOf = (page: Page) => page.locator("[data-connections-panel]").filter({ visible: true });

/** The model chooser's pane for one account; a phone shows one pane at a time, so Back leads to the accounts. */
async function showAccount(picker: Locator, accountId: string) {
  await expect(picker.locator("[data-switcher-search]")).toBeVisible();
  const back = picker.locator("[data-switcher-back]");
  if (await back.isVisible()) await back.click();
  await picker.locator(`[data-switcher-pane="${accountId}"]`).click();
  const models = picker.locator("[data-switcher-pane-models]");
  await expect(models).toBeVisible();
  return models;
}

test("the panel shows search from 8 Models and keeps sort in More actions", async ({ page, request }) => {
  const provider = await startProvider();
  const models = modelMaker(request, provider.baseUrl, `Search threshold ${Date.now()}`);
  try {
    // Hide what the shared server holds first, so only this test's Models show.
    await setup(page, request);
    for (let index = 0; index < 7; index++) await models.add(`mystery-model-${index}`);
    await page.goto("/");
    await openConnectionsPanel(page);
    const panel = panelOf(page);
    await expect(panel.locator("[data-connection-id]").first()).toBeVisible();
    // Seven Models: nothing to search yet, and no sort control beside the header.
    await expect(panel.getByRole("searchbox", { name: "Search models and accounts" })).toHaveCount(0);
    await expect(panel.getByRole("combobox", { name: "Sort accounts" })).toHaveCount(0);
    await panel.getByRole("button", { name: "More actions", exact: true }).click();
    await expect(page.getByRole("menu").getByText("Sort: A–Z", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    // The eighth Model brings the search box.
    const last = await models.add("mystery-model-7");
    await page.reload();
    await openConnectionsPanel(page);
    const search = panelOf(page).getByRole("searchbox", { name: "Search models and accounts" });
    await expect(search).toBeVisible();
    // During a search an account still folds from its heading, and a new search opens it again.
    await search.fill("mystery-model-7");
    const toggle = panelOf(page).locator(`[data-connections-toggle="${last.accountId}"]`);
    const row = panelOf(page).locator(`[data-connection-id="${last.id}"]`);
    await expect(row).toBeVisible();
    await toggle.click();
    await expect(row).toHaveCount(0);
    await search.fill("mystery-model");
    await expect(row).toBeVisible();
  } finally {
    await models.cleanup();
    await provider.close();
  }
});

test("the Jobs summary says what follows Main and opens the Jobs page", async ({ page, request }, testInfo) => {
  const provider = await startProvider();
  const models = modelMaker(request, provider.baseUrl, `Jobs summary ${Date.now()}`);
  const previousMain = ((await (await request.get("/api/connections")).json()) as Array<Record<string, unknown>>).find(
    (row) => row.isDefault === true || row.isDefault === "true",
  );
  try {
    await setup(page, request);
    const main = await models.add("anthropic/claude-test-0");
    expect((await request.patch(`/api/connections/${main.id}`, { data: { isDefault: true } })).ok()).toBeTruthy();
    await page.goto("/");
    await openConnectionsPanel(page);
    const panel = panelOf(page);
    // The summary: Main is one tap away, and one sentence says what the rest run.
    const jobsRow = panel.locator('[data-connections-row="defaults"]');
    await expect(jobsRow).toHaveAttribute("aria-label", /^Jobs\. Every other job that is on follows Main/u);
    await expect(panel.locator('[data-defaults-role="main"]')).toContainText("claude-test-0");
    await expect(panel.locator('[data-defaults-tile="agents"]')).toHaveCount(0);

    const jobs = await openJobsPage(page);
    await expect(jobs.locator('[data-jobs-section="main"] [data-defaults-tile="main"]')).toBeVisible();
    // Agents runs Main's Model, so it is a chip in the Follow Main row, named with what it does.
    const agents = jobs.locator('[data-jobs-section="follows-main"] [data-defaults-tile="agents"]');
    await expect(agents).toHaveAttribute("aria-label", "Agents: Follows Main");
    // Every job shows once on the page.
    const roles = await jobs
      .locator("[data-defaults-role]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-defaults-role")));
    expect(new Set(roles).size).toBe(roles.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

    if (!testInfo.project.name.includes("mobile")) {
      // A narrow panel drills in, and its Back returns focus to the Jobs row.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await openJobsPage(page);
      const back = panelOf(page).locator("[data-connections-back]");
      await expect(back).toBeFocused();
      await back.click();
      await expect(panelOf(page).locator('[data-connections-row="defaults"]')).toBeFocused();
    }
  } finally {
    await models.cleanup();
    if (previousMain) await request.patch(`/api/connections/${previousMain.id}`, { data: { isDefault: true } });
    await provider.close();
  }
});

test("an account's long model list folds behind Browse and narrows by model family", async ({ page, request }) => {
  const provider = await startProvider();
  const models = modelMaker(request, provider.baseUrl, `Families ${Date.now()}`);
  const previousMain = ((await (await request.get("/api/connections")).json()) as Array<Record<string, unknown>>).find(
    (row) => row.isDefault === true || row.isDefault === "true",
  );
  try {
    await setup(page, request);
    const main = await models.add("anthropic/claude-test-0");
    expect((await request.patch(`/api/connections/${main.id}`, { data: { isDefault: true } })).ok()).toBeTruthy();
    await page.goto("/");
    await openConnectionsPanel(page);
    await panelOf(page).locator('[data-defaults-tile="main"]').click();
    const picker = page.getByRole("dialog", { name: "Model for Main", exact: true });
    const pane = await showAccount(picker, main.accountId!);

    // The saved Model stays in view; the 26 others wait behind Browse.
    await expect(pane.locator('[data-switcher-section="saved"]')).toContainText("claude-test-0");
    const browse = pane.locator("[data-switcher-browse]");
    await expect(browse).toHaveAttribute("aria-expanded", "false");
    await expect(browse).toHaveText("Browse all 26 models");
    await expect(pane.locator('[data-switcher-section="all"]')).toHaveCount(0);
    await browse.click();
    await expect(browse).toHaveAttribute("aria-expanded", "true");

    // Family chips: proxy prefixes and [SP] tags are read through, so both GPT spellings count as GPT.
    const families = pane.getByRole("group", { name: "Model families" });
    await expect(families.getByRole("button", { name: "All, 26 models" })).toHaveAttribute("aria-pressed", "true");
    const gpt = families.getByRole("button", { name: "GPT, 10 models" });
    await expect(families.getByRole("button", { name: "Claude, 7 models" })).toBeVisible();
    await expect(families.getByRole("button", { name: "DeepSeek, 6 models" })).toBeVisible();
    await expect(families.getByRole("button", { name: "Other, 3 models" })).toBeVisible();
    await gpt.click();
    await expect(gpt).toHaveAttribute("aria-pressed", "true");
    const all = pane.locator('[data-switcher-section="all"] [data-switcher-model]');
    await expect(all).toHaveCount(10);
    await expect(pane.getByRole("status").filter({ hasText: "Showing 10 models" })).toHaveCount(1);
    // Pressing the chosen family again shows every model.
    await gpt.click();
    await expect(all).toHaveCount(26);

    // Search covers every model, whatever chip was chosen.
    await gpt.click();
    await picker.locator("[data-switcher-search]").fill("deepseek-test-3");
    await expect(picker.locator('[data-switcher-results] [data-switcher-model="deepseek-test-3"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  } finally {
    await models.cleanup();
    if (previousMain) await request.patch(`/api/connections/${previousMain.id}`, { data: { isDefault: true } });
    await provider.close();
  }
});

test("the chat's model chooser lists this device's recent picks after Starred", async ({ page, request }, testInfo) => {
  const provider = await startProvider();
  const models = modelMaker(request, provider.baseUrl, `Recent ${Date.now()}`);
  let chatId: string | null = null;
  try {
    await setup(page, request, { rightPanelOpen: false });
    const main = await models.add("anthropic/claude-test-0");
    const chat = await request.post("/api/chats", {
      data: { name: `Recent picks ${testInfo.project.name}`, mode: "roleplay", characterIds: [] },
    });
    expect(chat.ok()).toBeTruthy();
    chatId = ((await chat.json()) as { id: string }).id;
    expect((await request.patch(`/api/chats/${chatId}`, { data: { connectionId: main.id } })).ok()).toBeTruthy();
    await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chatId);
    await page.goto("/");

    const phone = testInfo.project.name.includes("mobile");
    const openChooser = async () => {
      await page.getByRole("button", { name: phone ? "Quick Switcher" : /^Model:/, exact: phone }).click();
      const menu = page.locator(phone ? "[data-quick-switcher-mobile-menu]" : "[data-quick-connection-menu]");
      await expect(menu).toBeVisible();
      return menu;
    };
    // A catalog pick for this chat is remembered on this device.
    let menu = await openChooser();
    const pane = await showAccount(menu, main.accountId!);
    const browse = pane.locator("[data-switcher-browse]");
    if (await browse.count()) await browse.click();
    await pane.locator('[data-switcher-model="deepseek-test-2"]').click();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          return useUIStore.getState().recentModelPicks[0]?.model ?? null;
        }),
      )
      .toBe("deepseek-test-2");
    for (let i = 0; i < 3 && (await menu.count()); i++) await page.keyboard.press("Escape");

    // Starred lists it under Recent, after the starred models.
    menu = await openChooser();
    await expect(menu.locator("[data-switcher-search]")).toBeVisible();
    const back = menu.locator("[data-switcher-back]");
    if (await back.isVisible()) await back.click();
    await menu.locator('[data-switcher-pane="starred"]').click();
    const recent = menu.locator('[data-switcher-section="recent"]');
    await expect(recent).toContainText("Recent");
    await expect(recent.locator('[data-switcher-model="deepseek-test-2"]')).toBeVisible();
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    await models.cleanup();
    await provider.close();
  }
});

test("a job keeps its place while its picker is open, then moves and keeps focus", async ({ page, request }, info) => {
  const previousMain = ((await (await request.get("/api/connections")).json()) as Array<Record<string, unknown>>).find(
    (row) => row.isDefault === true || row.isDefault === "true",
  );
  await setup(page, request);
  // An account with a chat model (Main) and an image model that no job uses yet.
  const created = (await (
    await request.post("/api/connection-accounts", {
      data: {
        provider: "openai",
        name: `Freeze studio ${info.project.name} ${Date.now()}`,
        apiKey: "fixture-not-a-real-key",
        baseUrl: "http://127.0.0.1:9/v1",
        model: "gpt-5.5",
      },
    })
  ).json()) as { account: { id: string }; connectionId: string };
  let imageId: string | null = null;
  try {
    expect(
      (await request.patch(`/api/connections/${created.connectionId}`, { data: { isDefault: true } })).ok(),
    ).toBeTruthy();
    const image = await request.post("/api/connections", {
      data: {
        name: "Freeze image",
        provider: "image_generation",
        imageGenerationSource: "openai",
        model: "gpt-image-1.5",
        accountId: created.account.id,
        apiKey: "ignored",
        baseUrl: "http://127.0.0.1:9/v1",
      },
    });
    expect(image.ok()).toBeTruthy();
    imageId = ((await image.json()) as { id: string }).id;
    await page.goto("/");
    const jobs = await openJobsPage(page);
    // Images has no model yet: a chip in the Off row.
    const offImages = jobs.locator('[data-jobs-section="off"] [data-defaults-role="images"]');
    await expect(offImages).toBeVisible();
    await offImages.locator("[data-defaults-tile]").click();
    const picker = page.getByRole("dialog", { name: /^Model for Images/u });
    await expect(picker).toBeVisible();

    // Images gets its model while the picker is open: the job stays where it is, so its picker stays open.
    await offImages.evaluate((element) => element.setAttribute("data-retained-row", "true"));
    expect(
      (await request.patch(`/api/connections/${imageId}`, { data: { defaultForAgents: true } })).ok(),
    ).toBeTruthy();
    await page.evaluate(async () => {
      const { queryClient } = await import("/src/lib/query-client.ts" as string);
      await queryClient.invalidateQueries({ queryKey: ["connections"] });
    });
    await expect(offImages.locator("[data-defaults-tile]")).toHaveAccessibleName(/^Images: Freeze image/u);
    await expect(offImages).toHaveAttribute("data-retained-row", "true");
    await expect(picker).toBeVisible();

    // Closing the picker moves Images to its own row, and focus follows it there.
    await picker.getByRole("button", { name: /^Close Model for Images/u }).click();
    await expect(picker).toBeHidden();
    const ownImages = jobs.locator('[data-jobs-section="own"] [data-defaults-tile="images"]');
    await expect(ownImages).toBeVisible();
    await expect(ownImages).toBeFocused();
  } finally {
    if (imageId) await request.delete(`/api/connections/${imageId}`);
    await request.delete(`/api/connections/${created.connectionId}`);
    await request.delete(`/api/connection-accounts/${created.account.id}`);
    if (previousMain) await request.patch(`/api/connections/${previousMain.id}`, { data: { isDefault: true } });
  }
});
