import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Connections keep the established header, mixed models and compact role controls", async ({
  page,
  request,
}, info) => {
  const initial = (await (await request.get("/api/connections")).json()) as Array<{ id: string; isDefault?: unknown }>;
  const previousMain = initial.find((r) => r.isDefault === true || r.isDefault === "true");
  const response = await request.post("/api/connection-accounts", {
    data: {
      provider: "openai",
      name: `Mixed studio ${info.project.name}`,
      apiKey: "fixture-not-a-real-key",
      baseUrl: "http://127.0.0.1:9/v1",
      model: "gpt-5.5",
    },
  });
  expect(response.ok()).toBeTruthy();
  const created = (await response.json()) as { account: { id: string }; connectionId: string };
  const ids = [created.connectionId];
  try {
    for (const model of [
      { name: "Studio Image", provider: "image_generation", imageGenerationSource: "openai", model: "gpt-image-1.5" },
      { name: "Studio Voice", provider: "audio", audioSource: "openai", model: "gpt-4o-mini-tts" },
    ]) {
      const r = await request.post("/api/connections", {
        data: { ...model, accountId: created.account.id, apiKey: "ignored", baseUrl: "http://127.0.0.1:9/v1" },
      });
      expect(r.ok()).toBeTruthy();
      ids.push((await r.json()).id);
    }
    expect(
      (await request.patch(`/api/connections/${created.connectionId}`, { data: { isDefault: true } })).ok(),
    ).toBeTruthy();
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: true,
      rightPanel: "connections",
      theme: "dark",
    });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
    await page.goto("/");
    const panel = page.locator("[data-connections-panel]").filter({ visible: true });
    const add = panel.getByRole("button", { name: "Create connection", exact: true });
    const imp = panel.getByRole("button", { name: "Import connection", exact: true });
    await expect(add).toBeVisible();
    await expect(imp).toBeVisible();
    const more = panel.getByRole("button", { name: "More actions", exact: true });
    const sizes = await Promise.all([add.boundingBox(), imp.boundingBox(), more.boundingBox()]);
    expect(Math.abs(sizes[0]!.width - sizes[1]!.width)).toBeLessThan(1);
    expect(Math.abs(sizes[0]!.width - sizes[2]!.width)).toBeLessThan(1);
    await expect(panel.getByRole("searchbox", { name: "Search models and connections" })).toBeVisible();
    const group = panel.locator(`[data-connection-account-id="${created.account.id}"]`);
    for (const id of ids) await expect(group.locator(`[data-connection-id="${id}"]`)).toBeVisible();
    await expect(group).toContainText("Chat");
    await expect(group).toContainText("Image");
    await expect(group).toContainText("Audio");
    await panel.locator('[data-connections-row="defaults"]').click();
    await expect(panel.locator('[data-defaults-tile="main"]')).toBeVisible();
    await expect(panel.locator('[data-defaults-tile="main"]')).toHaveAttribute("aria-expanded", "false");
    await panel.locator('[data-defaults-tile="main"]').click();
    await expect(panel.locator('[data-defaults-role="main"]')).toContainText("Fallback");
    await panel.getByRole("button", { name: /Set up another role/ }).click();
    await expect(panel.locator('[data-defaults-tile="images"]')).toBeVisible();
    // A newly configured role must not remount while its controls are open.
    const images = panel.locator('[data-defaults-role="images"]');
    await images.locator('[data-defaults-tile="images"]').click();
    await images.evaluate((element) => element.setAttribute("data-retained-row", "true"));
    const imageDefault = images.getByRole("button", { name: /^Default model for Images:/ });
    await imageDefault.focus();
    await imageDefault.press("Enter");
    await page.getByRole("menuitemradio", { name: /Studio Image/ }).click();
    await expect(imageDefault).toContainText("Studio Image");
    await expect(images).toHaveAttribute("data-retained-row", "true");
    await expect(imageDefault).toBeFocused();
    await panel.getByRole("button", { name: /Set up another role/ }).click();
    await expect(images.locator('[data-defaults-tile="images"]')).toHaveAttribute("aria-expanded", "false");
    await images.locator('[data-defaults-tile="images"]').click();
    await imageDefault.focus();
    await imageDefault.press("Enter");
    await page.getByRole("menuitemradio", { name: "None", exact: true }).click();
    await expect(imageDefault).toContainText("None");
    await images.locator('[data-defaults-tile="images"]').click();
    await expect(panel.locator("[data-defaults-unused]")).toBeFocused();
    // Account credentials remain hidden until requested, and opening access never changes the account.
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openModal("connection-account", { accountId: id });
    }, created.account.id);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Manage access" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Manage access" })).toHaveAttribute("aria-expanded", "false");
    expect(await dialog.locator("[data-account-access]").evaluate((element) => !!element.closest("[inert]"))).toBe(
      true,
    );
    await dialog.getByRole("button", { name: "Manage access" }).click();
    await expect(dialog.locator("[data-account-access]")).toBeVisible();
    expect(await dialog.locator("[data-account-access]").evaluate((element) => !!element.closest("[inert]"))).toBe(
      false,
    );
    await expect(dialog.locator('[data-account-access] input[type="password"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
    const after = (await (await request.get("/api/connection-accounts")).json()) as Array<{
      id: string;
      hasApiKey: boolean;
      name: string;
    }>;
    expect(after.find((a) => a.id === created.account.id)).toMatchObject({
      hasApiKey: true,
      name: `Mixed studio ${info.project.name}`,
    });
  } finally {
    for (const id of ids) await request.delete(`/api/connections/${id}`);
    await request.delete(`/api/connection-accounts/${created.account.id}`);
    if (previousMain) await request.patch(`/api/connections/${previousMain.id}`, { data: { isDefault: true } });
  }
});
