import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

test("fresh connection retry restores its deleted placeholder under the retained account", async ({
  page,
  request,
}) => {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme: "dark",
  });
  await page.addInitScript(
    (appVersion) => localStorage.setItem("marinara:whats-new:seen-version", appVersion),
    version,
  );

  const before = (await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>;
  const knownAccounts = new Set(before.map(({ id }) => id));
  let connectionDeletes = 0;
  let accountDeletes = 0;
  let placeholderCreates = 0;
  let connectTests = 0;
  let connectionListReads = 0;

  // Page routes run after the context routes used by app defaults. Unmatched requests continue to the real API.
  await page.route("**/api/connections", async (route) => {
    if (route.request().method() === "GET") connectionListReads++;
    if (route.request().method() === "POST") placeholderCreates++;
    await route.fallback();
  });
  await page.route("**/api/connections/*/test", async (route) => {
    connectTests++;
    await route.fulfill({
      json: {
        success: connectTests > 1,
        message: "Provider rejected the key",
        errorCode: "AUTH_REJECTED",
        latencyMs: 1,
      },
    });
  });
  await page.route("**/api/connections/*", async (route) => {
    if (route.request().method() === "DELETE") {
      connectionDeletes++;
      await route.fallback();
      return;
    }
    await route.fallback();
  });
  await page.route("**/api/connection-accounts/*", async (route) => {
    if (route.request().method() === "DELETE") {
      accountDeletes++;
      await route.fulfill({ status: 500, json: { error: "Injected account deletion failure" } });
      return;
    }
    await route.fallback();
  });

  try {
    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openModal("create-connection");
    });
    await page.locator('[data-add-connection-service="openai"]').click();
    await page.locator("#add-connection-key").fill("preserved-invalid-key");
    await page.getByRole("button", { name: "Connect", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Provider rejected the key")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continue anyway" })).toBeVisible();
    await expect(page.locator("#add-connection-key")).toHaveValue("preserved-invalid-key");

    // Failed test removes the fresh placeholder, then injected account-delete failure leaves the account.
    await expect.poll(() => connectionDeletes).toBe(1);
    await expect.poll(() => accountDeletes).toBe(1);
    const retained = (await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>;
    const fresh = retained.filter(({ id }) => !knownAccounts.has(id));
    expect(fresh).toHaveLength(1);
    const afterCleanup = (await (await request.get("/api/connections")).json()) as Array<{
      id: string;
      accountId?: string;
    }>;
    expect(afterCleanup.filter(({ accountId }) => accountId === fresh[0]!.id)).toHaveLength(0);

    await dialog.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(placeholderCreates).toBe(1);
    expect(connectTests).toBe(2);
    expect(connectionListReads).toBeGreaterThanOrEqual(2);

    const finalAccounts = (await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>;
    expect(finalAccounts.filter(({ id }) => !knownAccounts.has(id))).toHaveLength(1);
    const finalRows = (await (await request.get("/api/connections")).json()) as Array<{
      id: string;
      accountId?: string;
    }>;
    expect(finalRows.filter(({ accountId }) => accountId === fresh[0]!.id)).toHaveLength(1);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const accounts = (await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>;
    const rows = (await (await request.get("/api/connections")).json()) as Array<{ id: string; accountId?: string }>;
    for (const account of accounts.filter(({ id }) => !knownAccounts.has(id))) {
      for (const row of rows.filter(({ accountId }) => accountId === account.id))
        await request.delete(`/api/connections/${row.id}`);
      await request.delete(`/api/connection-accounts/${account.id}`);
    }
  }
});
