import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// Pygmalion login (#7074): masked token field, fixed failure reasons, and expiry back to Log In.
test("Pygmalion login masks the token, explains failures and handles an expired session", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
  await page.route("**/api/bot-browser/chub/search?*", (route) =>
    route.fulfill({ json: { data: { count: 0, nodes: [] } } }),
  );
  await page.route("**/api/bot-browser/pygmalion/session", (route) => route.fulfill({ json: { active: false } }));
  // A search that sends the token is answered as if Pygmalion stopped accepting it.
  await page.route("**/api/bot-browser/pygmalion/search?*", (route) =>
    new URL(route.request().url()).searchParams.get("includeSensitive") === "true"
      ? route.fulfill({ status: 401, json: { error: "Pygmalion session expired", sessionExpired: true } })
      : route.fulfill({ json: { characters: [], totalItems: "0" } }),
  );
  const tokens: string[] = [];
  await page.route("**/api/bot-browser/pygmalion/set-token", (route) => {
    const { token } = route.request().postDataJSON() as { token: string };
    tokens.push(token);
    return token === "accepted-token"
      ? route.fulfill({ json: { ok: true, active: true } })
      : route.fulfill({
          status: 400,
          json: { error: "Pygmalion rejected the token", reason: "rejected", active: false },
        });
  });

  await page.goto("/");
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openBotBrowser();
  });
  const browser = page.locator('[data-component="BotBrowserView"]');
  await browser.getByRole("button", { name: /ChubAI/u }).click();
  await page.getByRole("button", { name: /Pygmalion/u }).click();
  await browser.getByRole("button", { name: "Log In", exact: true }).click();

  const field = page.getByLabel("Auth Token");
  await expect(field).toHaveAttribute("type", "password");
  await expect(field).toHaveAttribute("spellcheck", "false");
  await expect(field).toHaveAttribute("autocomplete", "off");
  await expect(page.getByText(/Marinara keeps it in memory until restart or Log Out/u)).toBeVisible();
  await expect(field).toHaveAccessibleDescription(/Marinara keeps it in memory until restart or Log Out/u);
  await field.fill("rejected-token");
  const screenshot = testInfo.outputPath("pygmalion-login-modal.png");
  await page.screenshot({ path: screenshot });
  await testInfo.attach("pygmalion-login-modal", { path: screenshot, contentType: "image/png" });

  await page.getByRole("button", { name: /Save & Connect/u }).click();
  await expect(page.getByText("Pygmalion rejected the token.", { exact: true })).toBeVisible();
  await expect(field).toBeVisible();
  await expect(page.getByRole("button", { name: /Log Out/u })).toHaveCount(0);

  await field.fill("accepted-token");
  await page.getByRole("button", { name: /Save & Connect/u }).click();
  await expect(page.getByText("Logged in to Pygmalion! NSFW content enabled.")).toBeVisible();
  await expect(page.getByText("Pygmalion session expired — please log in again.")).toBeVisible();
  await expect(browser.getByRole("button", { name: "Log In", exact: true })).toBeVisible();
  expect(tokens).toEqual(["rejected-token", "accepted-token"]);
  await expect(page.getByText("Marinara hit a recoverable UI error.")).toHaveCount(0);
  expect(errors).toEqual([]);
});
