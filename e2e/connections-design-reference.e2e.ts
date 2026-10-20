import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

// Run: pnpm exec playwright test e2e/connections-design-reference.e2e.ts (desktop-chromium project)
// Everything is mocked with route.fulfill; no persistent data is read or written.
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const now = "2026-01-01T00:00:00.000Z";
const account = (id: string, name: string, provider: string, baseUrl: string, modelCount: number) => ({
  id,
  name,
  provider,
  baseUrl,
  hasApiKey: true,
  apiKeyLast4: "1234",
  hasManagementToken: false,
  showUsageWidget: false,
  showUsageFiveHour: false,
  showUsageWeekly: false,
  treatAsLocalEndpoint: false,
  enabled: true,
  maxRequestsPerMinute: null,
  maxParallelJobs: null,
  profileImportReviewRequired: false,
  modelCount,
  state: "ok",
  createdAt: now,
  updatedAt: now,
});
const connection = (
  id: string,
  name: string,
  provider: string,
  model: string,
  accountId: string | null,
  extra = {},
) => ({
  id,
  name,
  provider,
  baseUrl: "",
  model,
  pinnedModels: "[]",
  imagePath: null,
  maxContext: 128000,
  isDefault: false,
  fallbackForMain: false,
  useForRandom: false,
  defaultForAgents: false,
  fallbackForAgents: false,
  enableCaching: false,
  anthropicExtendedCacheTtl: false,
  cachingAtDepth: 5,
  embeddingModel: null,
  embeddingBaseUrl: null,
  embeddingConnectionId: null,
  openrouterProvider: null,
  imageGenerationSource: null,
  comfyuiWorkflow: null,
  imageService: null,
  imageEndpointId: null,
  imagePromptInstructions: null,
  videoGenerationSource: null,
  videoService: null,
  videoPromptInstructions: null,
  audioSource: null,
  audioVoice: null,
  audioSoundEffects: false,
  audioMusic: false,
  accountId,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

const bifrost = account("acc-bifrost", "Bifrost Proxy", "custom", "https://llm.home.wubx.de/v1", 5);
const arli = account("acc-arli", "Arli AI", "image_generation", "http://10.0.0.110:8081", 1);
const accounts = [bifrost, arli];
const connections = [
  connection("c-glm", "GLM 5.2", "custom", "nanogpt/zai-org/glm-5.2", bifrost.id, {
    isDefault: true,
    defaultForAgents: true,
  }),
  connection("c-gpt", "GPT-5.5", "custom", "linkapi/openai/gpt-5.5", bifrost.id),
  connection("c-grok", "Grok 4.3", "custom", "arliai/xai/grok-4.3", bifrost.id),
  connection("c-ds", "DeepSeek V3.2", "custom", "nanogpt/deepseek/deepseek-v3.2", bifrost.id),
  connection("c-decision", "Decision provider", "decision", "jev-latest", bifrost.id, {
    decisionSource: "openai",
    credentialsFromConnectionId: "c-glm",
  }),
  connection("c-arli", "Arli Krea2 (VPN)", "image_generation", "Krea-2-Turbo", arli.id, {
    imageGenerationSource: "automatic1111",
    imageService: "arli",
    defaultForAgents: true,
  }),
];

const sizes = [
  { name: "panel-512x768", width: 512, height: 768, deviceScaleFactor: 2 },
  { name: "320", width: 320, height: 720 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 960 },
];

test.use({ reducedMotion: "reduce" });
test("connections concept A reference renders without overflow", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  mkdirSync(".tmp/concept-a-correction/screenshots", { recursive: true });
  for (const size of sizes) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.deviceScaleFactor ?? 1,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.route("**/api/**", (route) => route.abort());
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    // Reads are mocked; any other /api write is blocked so persistent data never changes.
    await page.route("**/api/connections", (route) =>
      route.request().method() === "GET" ? route.fulfill({ json: connections }) : route.abort(),
    );
    await page.route("**/api/connection-accounts", (route) =>
      route.request().method() === "GET" ? route.fulfill({ json: accounts }) : route.abort(),
    );
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: true,
      rightPanel: "connections",
      chibiProfessorMariEnabled: false,
      theme: "dark",
      appAccentColor: "#ff4fa3",
    });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
    await page.goto("/");
    const panel = page.locator("[data-connections-panel]");
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel).toContainText("Bifrost Proxy");
    await expect(panel).toContainText("Arli AI");
    await expect(panel.locator("[data-connection-group-count]")).toHaveCount(2);
    // The Decision row borrows credentials from GLM, so all 5 stay under Bifrost.
    const proxy = panel.locator('[data-connection-account-id="acc-bifrost"]');
    await expect(proxy.locator("[data-connection-id]")).toHaveCount(5);
    await expect(panel.locator("[data-connection-id]")).toHaveCount(6);

    // A proxy's upstreams are foldable headings in one well; the unprefixed Decision model sits under "Direct".
    await expect(proxy.locator("[data-connection-upstream]")).toHaveCount(3);
    for (const [upstream, label, count] of [
      ["nanogpt", "NanoGPT", 2],
      ["linkapi", "LinkAPI", 1],
      ["arliai", "ArliAI", 1],
    ] as const) {
      const section = proxy.locator(`[data-connection-upstream="${upstream}"]`);
      const heading = section.locator(".mari-connection-model-section-head");
      await expect(heading).toContainText(label);
      await expect(heading).toHaveAttribute("aria-expanded", "true");
      await expect(section.locator("[data-connection-id]")).toHaveCount(count);
    }
    await expect(proxy.getByRole("button", { name: /^Direct/ })).toBeVisible();
    // No "Add models" row per card: "+ Add" at the top and the card's ⋯ menu are the doors.
    await expect(panel.locator("[data-add-models]")).toHaveCount(0);

    // No "Chat" word: only the non-chat kinds get an outlined pill.
    const pills = panel.locator("[data-connection-id] [data-connection-type]");
    await expect(pills).toHaveCount(2);
    await expect(panel.locator('[data-connection-id="c-decision"] [data-connection-type]')).toHaveText("Decision");
    await expect(panel.locator('[data-connection-id="c-arli"] [data-connection-type]')).toHaveText("Image");
    for (const pill of await pills.all()) {
      expect(await pill.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(
        await pill.evaluate(
          // One line: its line height plus the outline's two 1px borders.
          (el) => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) + 3,
        ),
      ).toBe(true);
    }

    // Two role names show; a third or more folds into "+N" with the full list in its tooltip.
    await expect(panel.locator("[data-connection-role]")).toHaveCount(2);
    const glmRole = panel.locator('[data-connection-id="c-glm"] [data-connection-role]');
    await expect(glmRole).toHaveAttribute("title", "Main, Agents");
    await expect(glmRole.locator("> span")).toHaveCount(2);
    await expect(glmRole.locator("> span").first()).toHaveText("Main");
    await expect(glmRole.locator("> span").nth(1)).toHaveText("Agents");
    await expect(panel.locator('[data-connection-id="c-arli"] [data-connection-role]')).toHaveText("Default");
    for (const role of await panel.locator("[data-connection-role] > span").all())
      expect(await role.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    // Rows stay two lines at every width.
    for (const row of await panel.locator("[data-connection-id] .mari-connection-model-choice").all())
      expect(await row.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(72);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(await panel.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);

    // The picture tiles (card heading and model row) are their own buttons and open the picture menu.
    for (const name of ["Change picture for Bifrost Proxy", "Change picture for GLM 5.2"]) {
      await panel.getByRole("button", { name, exact: true }).click();
      const menu = page.getByRole("menu");
      await expect(menu.getByRole("menuitem")).toHaveText([
        "Upload image",
        "Choose service logo",
        "Use letters",
        "Reset to default",
      ]);
      // An outside press closes the menu (Escape would also close a narrow panel).
      await panel.getByRole("searchbox").click();
      await expect(menu).toHaveCount(0);
    }

    const base = `.tmp/concept-a-correction/screenshots/${size.name}`;
    await page.screenshot({ path: `${base}-screen.png` });
    await panel.screenshot({ path: `${base}-panel.png` });
    if (size.width === 512) {
      const card = panel.locator('[data-connection-account-id="acc-bifrost"]');
      await card.scrollIntoViewIfNeeded();
      await card.screenshot({ path: `${base}-bifrost.png` });
    }
    if (size.name !== "panel-512x768") await page.screenshot({ path: `${base}-full.png` });
    if (size.width === 320) {
      const standalone = connection("c-standalone", "Standalone fixture", "custom", "local/fixture", null);
      await page.route("**/api/connections", (route) => route.fulfill({ json: [...connections, standalone] }));
      await page.reload();
      const search = panel.getByRole("searchbox", { name: "Search models and connections" });
      await search.fill("Standalone fixture");
      const row = panel.locator('[data-connection-id="c-standalone"]');
      await expect(row).toBeVisible();
      expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await search.fill("");
      await panel.locator('[data-connections-row="other"]').click();
      await expect(row).toBeVisible();
      expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await context.close();
  }
});

// Slice F: the card header (name alone on line 1), the usage meter, cost badges and Escape inside ⋯ menus.
// Mocked like the test above; screenshots go to .tmp/combined-design/result-f/.
const nanoAccount = {
  ...account("acc-nano", "NanoGPT subscription with a long name", "nanogpt", "https://nano-gpt.com/api/v1", 2),
  showUsageWidget: true,
  showUsageWeekly: true,
  billing: null,
};
const claudeAccount = {
  ...account("acc-claude", "Claude Max", "claude_subscription", "", 1),
  showUsageWidget: true,
  showUsageFiveHour: true,
  showUsageWeekly: true,
  billing: "plan",
};
const sliceFConnections = [
  connection("c-nano-a", "GLM 5.2", "nanogpt", "zai-org/glm-5.2", nanoAccount.id, { isDefault: true }),
  connection("c-nano-b", "GPT-5.5", "nanogpt", "openai/gpt-5.5", nanoAccount.id),
  connection("c-claude", "Claude Opus", "claude_subscription", "claude-opus-4", claudeAccount.id),
];
const resetAt = Date.parse("2026-01-01T14:20:00.000Z");
const usage: Record<string, unknown> = {
  "c-claude": {
    provider: "claude_subscription",
    plan: "max",
    windows: [
      { id: "five_hour", used: null, remaining: null, percentUsed: 0.42, resetAt, degraded: false },
      { id: "seven_day", used: null, remaining: null, percentUsed: 0.18, resetAt, degraded: false },
    ],
  },
  "c-nano-a": {
    provider: "nanogpt",
    active: true,
    state: "active",
    limits: { dailyInputTokens: null, weeklyInputTokens: 60_000_000, dailyImages: null },
    dailyInputTokens: null,
    weeklyInputTokens: { used: 61_000_000, remaining: 0, percentUsed: 1.02, resetAt, degraded: false },
    dailyImages: null,
    currentPeriodEnd: null,
    credential: "api_key",
  },
};
const nanoCatalog = {
  billing: null,
  fetchedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  models: [
    { id: "zai-org/glm-5.2", name: "GLM 5.2", context: 200_000, cost: "included" },
    { id: "openai/gpt-5.5", name: "GPT-5.5", context: 400_000, cost: "multiplier:2" },
    { id: "anthropic/claude-opus-4", name: "Claude Opus 4", cost: "paid" },
    { id: "old/model-1", name: "Old model", cost: "included", deprecated: true, retiresAt: "2026-11-30" },
  ],
};

for (const [size, theme] of [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 960 },
].flatMap((size) => (["dark", "light"] as const).map((theme) => [size, theme] as const))) {
  test(`slice F: card header, usage meter, cost badges and Escape at ${size.name} ${theme}`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const out = ".tmp/combined-design/result-f";
    mkdirSync(out, { recursive: true });
    const context = await browser.newContext({
      baseURL,
      viewport: { width: size.width, height: size.height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.route("**/api/**", (route) => route.abort());
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.route("**/api/connections", (route) =>
      route.request().method() === "GET" ? route.fulfill({ json: sliceFConnections }) : route.abort(),
    );
    await page.route("**/api/connection-accounts", (route) =>
      route.request().method() === "GET" ? route.fulfill({ json: [nanoAccount, claudeAccount] }) : route.abort(),
    );
    let usageRequests = 0;
    await page.route("**/api/connections/*/subscription-usage", (route) => {
      usageRequests += 1;
      const id = new URL(route.request().url()).pathname.split("/").at(-2)!;
      return usage[id] ? route.fulfill({ json: usage[id] }) : route.fulfill({ status: 404, json: {} });
    });
    await page.route(/\/api\/connections\/[^/]+\/models(\?.*)?$/, (route) => route.fulfill({ json: nanoCatalog }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: true,
      rightPanel: "connections",
      chibiProfessorMariEnabled: false,
      theme,
    });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
    await page.goto("/");
    const panel = page.locator("[data-connections-panel]").filter({ visible: true });
    await expect(panel).toBeVisible({ timeout: 30_000 });

    // Line 1 is the name alone; the count moved to line 2 with the plan word and host.
    const claude = panel.locator('[data-connection-account-id="acc-claude"]');
    const nano = panel.locator('[data-connection-account-id="acc-nano"]');
    const nanoHeading = nano.locator("[data-connection-group-heading] strong");
    // Line 1 shows the account's own name; line 2 holds facts only and never repeats it.
    await expect(nanoHeading).toHaveText("NanoGPT subscription with a long name");
    await expect(nano.locator("[data-connection-group-heading]")).toContainText("2 models · nano-gpt.com");
    await expect(nano.locator("[data-connection-identity-meta]")).not.toContainText("long name");
    await expect(nanoHeading.locator("[data-connection-group-count]")).toHaveCount(0);
    await expect(nano.locator("[data-connection-group-count]")).toHaveText("2 models");
    const countTop = await nano
      .locator("[data-connection-group-count]")
      .evaluate((el) => el.getBoundingClientRect().top);
    const nameBottom = await nanoHeading.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(countTop).toBeGreaterThanOrEqual(nameBottom - 1);
    await expect(claude.locator("[data-connection-group-heading]")).toContainText("1 model · Plan");

    // The usage meter: two windows, the limit reads as the problem; still there with the card folded.
    const claudeMeter = claude.locator("[data-connection-usage-meter]");
    await expect(claudeMeter.locator('[data-usage-window="five_hour"]')).toContainText("42% of 5-hour limit used");
    await expect(claudeMeter.locator('[data-usage-window="seven_day"]')).toContainText("18% of weekly limit used");
    await expect(claudeMeter).toHaveAttribute("title", /5-hour window: 42% used, resets/);
    const nanoWeek = nano.locator('[data-connection-usage-meter] [data-usage-window="week"]');
    await expect(nanoWeek).toHaveAttribute("data-usage-level", "limit");
    await expect(nanoWeek).toContainText(/weekly limit reached · resets/);
    await claude.locator("[data-connections-toggle]").click();
    await expect(claude.locator("[data-connection-id]")).toHaveCount(0);
    await expect(claudeMeter).toBeVisible();
    await claude.locator("[data-connections-toggle]").click();
    // One request per Connection: the meter shares the widget's query.
    expect(usageRequests).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `${out}/panel-${size.name}-${theme}.png` });

    // Escape closes a ⋯ menu or the picture menu, never the panel under it.
    await nano.getByRole("button", { name: "Actions for NanoGPT subscription with a long name" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Change picture for GLM 5.2", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Upload image" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(panel).toBeVisible();

    // The Add models catalog: shared rows with cost badges, a retiring hint and "Updated …".
    await nano.getByRole("button", { name: "Actions for NanoGPT subscription with a long name" }).click();
    await page.getByRole("menuitem", { name: "Add model", exact: true }).click();
    const catalog = page.getByRole("dialog", { name: "Add model", exact: true });
    // NanoGPT also offers image and video: the screen opens on Chat, and its chips switch kinds.
    await expect(catalog.locator('[data-add-connection-capability="chat"]')).toHaveAttribute("aria-pressed", "true");
    await expect(catalog.locator('[data-model-id="zai-org/glm-5.2"] [data-model-cost="included"]')).toHaveText(
      "Included",
    );
    await expect(catalog.locator('[data-model-id="openai/gpt-5.5"] [data-model-cost="multiplier"]')).toHaveText("2x");
    await expect(catalog.locator('[data-model-id="anthropic/claude-opus-4"] [data-model-cost="paid"]')).toHaveText(
      "Paid",
    );
    await expect(catalog.locator('[data-model-id="old/model-1"] [data-model-retiring]')).toContainText("Retiring");
    await expect(catalog.locator("[data-model-updated]")).toContainText(/Updated \d+m ago/);
    // On a phone a badged row keeps its id readable; the context size moves to the tooltip.
    const glmMeta = catalog.locator('[data-model-id="zai-org/glm-5.2"] [data-model-metadata]');
    if (size.width < 640) await expect(glmMeta).toBeHidden();
    else await expect(glmMeta).toBeVisible();
    await expect(catalog.locator('[data-model-id="zai-org/glm-5.2"] .mari-connection-model-choice')).toHaveCount(1);
    await page.screenshot({ path: `${out}/add-models-${size.name}-${theme}.png` });
    await page.keyboard.press("Escape");
    await expect(catalog).toHaveCount(0);

    // The catalog is now cached, so the panel rows and the Defaults box wear the same badges.
    await expect(nano.locator('[data-connection-id="c-nano-a"] [data-model-cost="included"]')).toBeVisible();
    await expect(nano.locator('[data-connection-id="c-nano-b"] [data-model-cost="multiplier"]')).toHaveText("2x");
    await expect(panel.locator('[data-defaults-role="main"] [data-model-cost="included"]')).toBeVisible();

    // One panel setting hides every badge.
    await panel.getByRole("button", { name: "More actions", exact: true }).click();
    const toggle = page.getByRole("menuitemcheckbox", { name: "Show cost badges" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(panel.locator("[data-model-cost]")).toHaveCount(0);

    // Add, service already connected: the existing Connection uses the card header's identity.
    await panel.getByRole("button", { name: "Add connection" }).first().click();
    const add = page.getByRole("dialog", { name: "Add connection", exact: true });
    await add.locator('[data-add-connection-service="nanogpt"]').click();
    await expect(add.getByRole("heading", { name: "Use an existing NanoGPT connection?", exact: true })).toBeVisible();
    const existing = add.locator('[data-add-connection-existing-account="acc-nano"]');
    await expect(existing.locator("strong")).toHaveText("NanoGPT subscription with a long name");
    await expect(existing.locator("[data-connection-group-count]")).toHaveText("2 models");
    await page.screenshot({ path: `${out}/add-existing-${size.name}-${theme}.png` });
    await context.close();
  });
}
