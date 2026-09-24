import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function prepare(page: Page, selected: string | null) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/decision/options", (route) => route.fulfill({ json: { selected, options: [] } }));
  await page.route("**/api/agents/import-policy", (route) => route.fulfill({ json: { enabled: true } }));
  await page.route("**/api/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme: "dark" });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
}

for (const selected of [null, "fixture-decision"]) {
  test(`custom agent import explains decisions with ${selected ? "a model" : "no model"}`, async ({ page }, info) => {
    await prepare(page, selected);
    await page.route("**/api/agents/import", async (route) => {
      const { agent } = route.request().postDataJSON();
      if (agent.name === "Failed decision agent")
        return route.fulfill({ status: 400, json: { error: "Fixture failure" } });
      await route.fulfill({ json: { ...agent, id: agent.type, settings: JSON.stringify(agent.settings) } });
    });
    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openRightPanel("agents");
    });
    const upload = async (agents: unknown[]) => {
      await expect(page.getByRole("button", { name: "Import agents", exact: true })).toBeEnabled();
      await page.locator('input[type="file"][accept="application/json,application/zip,.json,.zip"]').setInputFiles({
        name: "agents.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(agents)),
      });
      await page.getByRole("button", { name: "Approve Permissions and Import", exact: true }).click();
    };
    const agent = {
      type: "custom_notice",
      name: "Plain agent",
      description: "Import notice proof",
      phase: "post_processing",
      promptTemplate: "Summarize the scene.",
      settings: {},
    };
    // A failed decision import alongside a successful ordinary one must stay quiet.
    await upload([
      agent,
      {
        ...agent,
        type: "custom_failed",
        name: "Failed decision agent",
        settings: { activationQuestion: "The scene changes." },
      },
    ]);
    await expect(page.getByText("Fixture failure", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Open guide", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await upload([
      {
        ...agent,
        type: "custom_question",
        name: "Question agent",
        settings: { activationQuestion: "The scene changes." },
      },
      {
        ...agent,
        type: "custom_statement",
        name: "Statement agent",
        promptTemplate: '{{#if decision:"It rains."}}Describe rain.{{else}}Describe the sky.{{/if}}',
      },
    ]);
    const notice = page
      .locator("[data-sonner-toast]")
      .filter({ has: page.getByRole("button", { name: "Open guide", exact: true }) });
    await expect(notice).toHaveCount(1);
    await expect(notice).toHaveAttribute("data-type", selected ? "info" : "warning");
    await expect(notice).toContainText(selected ? "billed requests" : "keywords and Trigger Cadence allow");
    if (!selected) {
      await expect(notice).toContainText("else branch");
      await expect(notice).toContainText("Lorebook entries cannot activate");
    }
    for (const theme of ["dark", "light"]) {
      await page.evaluate(async (theme) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setTheme(theme);
      }, theme);
      await expect(notice).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await info.attach(`decision-import-${theme}`, {
        body: await page.screenshot({ path: info.outputPath(`decision-import-${theme}.png`), animations: "disabled" }),
        contentType: "image/png",
      });
    }
    await notice.getByRole("button", { name: "Open guide", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Decision Models", exact: true })).toBeVisible();
  });
}

for (const bulk of [false, true]) {
  test(`catalog ${bulk ? "bulk" : "single"} install forwards the installed package's decision notice`, async ({
    page,
  }) => {
    await prepare(page, null);
    const manifest = {
      schemaVersion: 1,
      id: "decision-fixture",
      name: "Decision fixture",
      version: "1.0.0",
      description: "Import notice proof",
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent"],
      entrypoints: {},
      files: [],
      permissions: [],
      restartRequired: true,
    };
    const entry = {
      category: "misc",
      manifest,
      artifact: { url: "https://example.com/fixture.zip", sha256: "a".repeat(64), bytes: 10 },
    };
    await page.route("**/api/capability-packages/catalog", (route) =>
      route.fulfill({
        json: {
          schemaVersion: 1,
          packages: [
            entry,
            ...(bulk ? [{ ...entry, manifest: { ...manifest, id: "failed-fixture", name: "Failed fixture" } }] : []),
          ],
        },
      }),
    );
    await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/capability-packages/*/install", (route) =>
      route.request().url().includes("failed-fixture")
        ? route.fulfill({ status: 400, json: { error: "Fixture installation failed" } })
        : route.fulfill({
            json: { id: manifest.id, manifest, version: "1.0.0", status: "restart-required", usesDecisions: true },
          }),
    );
    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openAgentCatalog("decision-fixture");
    });
    const catalog = page.locator('[data-component="AgentCatalogView"]');
    if (bulk && (page.viewportSize()?.width ?? 1440) < 768)
      await catalog.getByRole("button", { name: "All agents", exact: true }).click();
    await catalog.getByRole("button", { name: bulk ? "Install All" : "Install", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open guide", exact: true })).toHaveCount(1);
    await expect(
      page.locator('[data-sonner-toast][data-type="warning"]').filter({ hasText: "no Decision model is selected" }),
    ).toBeVisible();
  });
}

test("existing lorebook imports warn once for successfully imported decision content", async ({ page }) => {
  await prepare(page, null);
  await page.route("**/api/import/st-lorebook", (route) => route.fulfill({ json: { success: true } }));
  await page.goto("/");
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openModal("import-lorebook");
  });
  await page.locator('input[type="file"][accept=".json"]').setInputFiles([
    {
      name: "decision.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          entries: { 0: { decisionMode: "require", decisionStatement: "It rains.", content: "Rain." } },
        }),
      ),
    },
    { name: "plain.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ entries: {} })) },
  ]);
  await expect(page.getByRole("button", { name: "Open guide", exact: true })).toHaveCount(1);
  await expect(page.locator('[data-sonner-toast][data-type="warning"]')).toContainText("no Decision model is selected");
});
