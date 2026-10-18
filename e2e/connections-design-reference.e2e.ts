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
  connection("c-glm", "GLM 5.2", "custom", "nanogpt/zai-org/glm-5.2", bifrost.id, { isDefault: true }),
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
    const bifrostRows = panel.locator('[data-connection-account-id="acc-bifrost"] [data-connection-id]');
    await expect(bifrostRows).toHaveCount(5);
    const proxy = panel.locator('[data-connection-account-id="acc-bifrost"]');
    await expect(proxy.locator("[data-connection-upstream]")).toHaveCount(3);
    await expect(proxy.getByText("Other models", { exact: true })).toBeVisible();
    await expect(proxy.locator('[data-connection-upstream="nanogpt"] [data-connection-id]')).toHaveCount(2);
    await expect(proxy.locator('[data-connection-upstream="linkapi"] [data-connection-id="c-gpt"]')).toBeVisible();
    await expect(panel.locator("[data-connection-id]")).toHaveCount(6);
    const left = (loc: ReturnType<typeof panel.locator>) =>
      loc.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    const chatTypes = panel.locator(
      '[data-connection-id]:not([data-connection-id="c-decision"]):not([data-connection-id="c-arli"]) [data-connection-type]',
    );
    await expect(chatTypes).toHaveCount(4);
    expect(new Set(await left(chatTypes)).size).toBe(1);
    const cardWidth = await panel
      .locator('[data-connection-account-id="acc-bifrost"]')
      .evaluate((el) => el.clientWidth);
    if (cardWidth > 376) expect(new Set(await left(panel.locator("[data-connection-role]"))).size).toBe(1);
    for (const label of await panel.locator("[data-connection-type]").all()) {
      expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(
        await label.evaluate(
          (el) => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) + 1,
        ),
      ).toBe(true);
    }
    for (const role of await panel.locator("[data-connection-role] > span").all())
      expect(await role.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(panel.locator("[data-connection-role]")).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(await panel.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);

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
      await expect(row.locator(".mari-connection-model-meta")).toHaveCSS("display", "flex");
      await search.fill("");
      await panel.locator('[data-connections-row="other"]').click();
      await expect(row).toBeVisible();
      await expect(row.locator(".mari-connection-model-meta")).toHaveCSS("display", "flex");
      expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await context.close();
  }
});
