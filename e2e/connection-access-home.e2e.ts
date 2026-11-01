import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("the connection editor protects unsaved changes and tests the connection", async ({ page, request }) => {
  const response = await request.post("/api/connection-accounts", {
    data: {
      name: "Studio proxy",
      provider: "custom",
      baseUrl: "http://127.0.0.1:19093/v1",
      apiKey: "",
      model: "nanogpt/vendor/alpha",
    },
  });
  expect(response.ok()).toBeTruthy();
  const { account, connectionId } = await response.json();
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: true,
      rightPanel: "connections",
    });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
    await page.goto("/");
    await page.evaluate(async (accountId) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openModal("connection-account", { accountId });
    }, account.id);
    const editor = page.getByRole("dialog", { name: "Edit connection", exact: true });
    await expect(editor).toBeVisible();
    // Name in the field; the line under it names the service and the model count, and no "Ready" word.
    await expect(editor.getByText("OpenAI-compatible · 1 model", { exact: true })).toBeVisible();
    await expect(editor.getByText("Ready", { exact: true })).toHaveCount(0);
    // The proxy's models sit under their upstream heading, in the shared model row.
    await expect(editor.locator('[data-connection-upstream="nanogpt"]')).toContainText("NanoGPT");
    // Address and key show at once; model tests live in the model editor.
    await expect(editor.locator("[data-account-address]")).toHaveValue("http://127.0.0.1:19093/v1");
    await expect(editor.getByRole("button", { name: "Manage access", exact: true })).toHaveCount(0);
    await expect(editor.getByRole("button", { name: "Test saved model", exact: true })).toHaveCount(0);
    const testCalls: string[] = [];
    await page.route(`**/api/connections/${connectionId}/test`, async (route) => {
      testCalls.push(route.request().url());
      await route.fulfill({ json: { success: true, message: "ok", latencyMs: 2, modelName: "Alpha" } });
    });
    await editor.getByRole("button", { name: "Test connection", exact: true }).click();
    await expect.poll(() => testCalls.length).toBe(1);
    await expect(editor.locator("[data-account-test-result]")).toHaveText("Ready · key works · 2 ms");
    const name = editor.locator("[data-account-name]");
    await name.fill("Studio changed");
    await editor.locator(`[data-account-model-id="${connectionId}"]`).click();
    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(name).toHaveValue("Studio changed");
    await page.route(`**/api/connection-accounts/${account.id}`, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, json: { error: "deliberate fixture failure" } })
        : route.fallback(),
    );
    await editor.locator(`[data-account-model-id="${connectionId}"]`).click();
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await expect(editor).toBeVisible();
    await expect(name).toHaveValue("Studio changed");
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/connection-accounts`)).json()).find(
            (item: { id: string }) => item.id === account.id,
          )?.name,
      )
      .toBe("Studio proxy");
    await page.unroute(`**/api/connection-accounts/${account.id}`);
    // X/Escape and navigation use the same dirty boundary.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(name).toHaveValue("Studio changed");
    await name.fill("Studio proxy");
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      for (const theme of ["dark", "light"]) {
        await page.evaluate(async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        }, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await editor.screenshot({
          animations: "disabled",
          path: `.tmp/connections-coherence/screenshots/edit-${width}-${theme}.png`,
        });
        expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      }
    }
  } finally {
    await request.delete(`/api/connections/${connectionId}`);
    await request.delete(`/api/connection-accounts/${account.id}`);
  }
});
