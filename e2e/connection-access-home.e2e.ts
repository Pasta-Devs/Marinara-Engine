import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("the connection editor protects unsaved changes and tests the connection", async ({ page, request }) => {
  // Six screenshots at the phone's 3x scale, up to 1440 wide, take 4-10 s each on CI WebKit, so the steps alone
  // came to about 65 s there (run 42029653525); the screenshot sweeps beside it use the same budget.
  test.setTimeout(120_000);
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
    // The account form checks the address and key live; the fixture server answers with one model.
    const checks: Array<{ baseUrl?: string; accountId?: string }> = [];
    await page.route("**/api/connections/check", async (route) => {
      checks.push(route.request().postDataJSON());
      await route.fulfill({
        json: { supported: true, reachable: true, keyOk: null, modelCount: 1, status: 200, error: null },
      });
    });
    await page.goto("/");
    await page.evaluate(async (accountId) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openModal("connection-account", { accountId });
    }, account.id);
    const editor = page.getByRole("dialog", { name: "Edit account", exact: true });
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
    // The live check replaces the manual Test account button for a server it can reach.
    await expect(editor.getByText("Server answers · 1 model found", { exact: true })).toBeVisible();
    expect(checks).toContainEqual(
      expect.objectContaining({ baseUrl: "http://127.0.0.1:19093/v1", accountId: account.id }),
    );
    await expect(editor.getByRole("button", { name: "Test account", exact: true })).toHaveCount(0);
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
