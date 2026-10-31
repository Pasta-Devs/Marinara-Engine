import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

for (const testCase of [
  {
    apiFailure: "API returned 401: Invalid API key",
    seededFailure: "seeded disabled account failure",
    expectedFailure: "API returned 401: Invalid API key",
  },
  {
    apiFailure: "API key is invalid",
    seededFailure: "seeded disabled account failure",
    expectedFailure: "API key is invalid",
  },
]) {
  test(`a failed account test stays visible until a later test succeeds: ${testCase.expectedFailure}`, async ({
    page,
    request,
  }, info) => {
    await isolateSyncedUISettings(page);
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "{}" } }));
    const createAccount = async (name: string) => {
      const response = await request.post("/api/connection-accounts", {
        data: {
          name,
          provider: "custom",
          baseUrl: "http://127.0.0.1:19093/v1",
          apiKey: "fixture-not-a-real-key",
          model: "nanogpt/vendor/alpha",
        },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return (await response.json()) as { account: { id: string; name: string }; connectionId: string };
    };
    const account = await createAccount(`Failed test ${info.project.name}`);
    const disabled = await createAccount(`Disabled test ${info.project.name}`);
    let tests = 0;
    await page.route(`**/api/connections/${account.connectionId}/test`, async (route) => {
      tests += 1;
      await route.fulfill({
        json:
          tests === 1
            ? { success: false, message: testCase.apiFailure, latencyMs: 2, modelName: null }
            : { success: true, message: "Connection successful", latencyMs: 2, modelName: "Alpha" },
      });
    });
    try {
      const disabledResult = await request.patch(`/api/connection-accounts/${disabled.account.id}`, {
        data: { enabled: false },
      });
      expect(disabledResult.ok(), await disabledResult.text()).toBeTruthy();
      await seedUIState(
        page,
        {
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: true,
          rightPanel: "connections",
          theme: "dark",
          connectionTestFailures: { [disabled.account.id]: testCase.seededFailure },
        },
        "if-missing",
      );
      await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
      await page.goto("/");
      const panel = page.locator("[data-connections-panel]").filter({ visible: true });
      const failedRow = panel.locator(`[data-connection-account-id="${account.account.id}"]`);
      const disabledRow = panel.locator(`[data-connection-account-id="${disabled.account.id}"]`);
      await failedRow.getByRole("button", { name: `Actions for ${account.account.name}`, exact: true }).click();
      await page.getByRole("menuitem", { name: "Test", exact: true }).click();
      await expect(failedRow).toContainText(`Last test failed: ${testCase.expectedFailure}`);
      await expect(
        failedRow.getByRole("button", { name: `Replace the key for ${account.account.name}` }),
      ).toBeVisible();
      await expect(disabledRow.getByRole("button", { name: `Turn on ${disabled.account.name}` })).toBeVisible();
      await expect
        .poll(async () =>
          page.evaluate((accountId) => {
            const stored = localStorage.getItem("marinara-engine-ui");
            return stored
              ? (JSON.parse(stored) as { state?: { connectionTestFailures?: Record<string, string> } }).state
                  ?.connectionTestFailures?.[accountId]
              : undefined;
          }, account.account.id),
        )
        .toBe(testCase.expectedFailure);

      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        for (const theme of ["dark", "light"] as const) {
          await page.evaluate(async (nextTheme) => {
            const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
            useUIStore.getState().setTheme(nextTheme);
          }, theme);
          await page.screenshot({ path: info.outputPath(`failed-account-${width}-${theme}.png`) });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
      }

      await page.reload();
      const reloadedPanel = page.locator("[data-connections-panel]").filter({ visible: true });
      const reloadedRow = reloadedPanel.locator(`[data-connection-account-id="${account.account.id}"]`);
      await expect(reloadedRow).toContainText("Key not accepted");
      await expect(reloadedRow).toContainText(`Last test failed: ${testCase.expectedFailure}`);
      await reloadedRow.getByRole("button", { name: `Actions for ${account.account.name}`, exact: true }).click();
      await page.getByRole("menuitem", { name: "Edit connection", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "Edit connection", exact: true });
      await expect(editor.locator("[data-account-test-result]")).toContainText(
        `Last test failed: ${testCase.expectedFailure}`,
      );
      await editor.getByRole("button", { name: "Test connection", exact: true }).click();
      await expect(editor.locator("[data-account-test-result]")).toHaveText("Ready · key works · 2 ms");
      await page.keyboard.press("Escape");
      await expect(reloadedRow).not.toContainText("Key not accepted");
      await expect(reloadedRow).not.toContainText(`Last test failed: ${testCase.expectedFailure}`);
    } finally {
      await request.delete(`/api/connections/${account.connectionId}`);
      await request.delete(`/api/connection-accounts/${account.account.id}`);
      await request.delete(`/api/connections/${disabled.connectionId}`);
      await request.delete(`/api/connection-accounts/${disabled.account.id}`);
    }
  });
}
