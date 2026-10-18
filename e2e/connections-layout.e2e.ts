import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Connections keep the established header, mixed models and compact role controls", async ({
  page,
  request,
}, info) => {
  const initial = (await (await request.get("/api/connections")).json()) as Array<{
    id: string;
    isDefault?: unknown;
    defaultForAgents?: unknown;
  }>;
  const previousAgents = initial.find((r) => r.defaultForAgents === true || r.defaultForAgents === "true");
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
  const extraAccounts: string[] = [];
  const comfy: Array<{ id: string; accountId: string; name: string }> = [];
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
    for (const media of [
      { name: "Comfy still", provider: "image_generation", imageGenerationSource: "comfyui" },
      { name: "Comfy motion", provider: "video_generation", videoGenerationSource: "comfyui" },
    ]) {
      const result = await request.post("/api/connections", {
        data: { ...media, baseUrl: "http://127.0.0.1:8188", apiKey: "" },
      });
      expect(result.ok()).toBeTruthy();
      const row = (await result.json()) as { id: string; accountId: string };
      ids.push(row.id);
      comfy.push({ ...row, name: media.name });
      if (row.accountId) extraAccounts.push(row.accountId);
    }
    const gatewayResponse = await request.post("/api/connection-accounts", {
      data: {
        provider: "custom",
        name: "Bifrost studio",
        baseUrl: "http://127.0.0.1:9/gateway/v1",
        apiKey: "fixture-key",
        model: "nanogpt/zai-org/glm-5.2",
      },
    });
    expect(gatewayResponse.ok()).toBeTruthy();
    const gateway = (await gatewayResponse.json()) as { account: { id: string }; connectionId: string };
    extraAccounts.push(gateway.account.id);
    ids.push(gateway.connectionId);
    expect(
      (await request.patch(`/api/connections/${gateway.connectionId}`, { data: { name: "My GLM" } })).ok(),
    ).toBeTruthy();
    const localResponse = await request.post(`/api/connection-accounts/${gateway.account.id}/for-model`, {
      data: {
        name: "Local Llama",
        model: "meta-llama/Llama-3.1-8B",
      },
    });
    expect(localResponse.ok()).toBeTruthy();
    ids.push((await localResponse.json()).connectionId);
    expect(
      (
        await request.patch(`/api/connections/${created.connectionId}`, {
          data: { isDefault: true, defaultForAgents: true },
        })
      ).ok(),
    ).toBeTruthy();
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: true,
      rightPanel: "connections",
      theme: "dark",
      connectionsCollapsed: [created.account.id],
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
    const singleProvider = panel.locator('[data-connection-provider="openai"]');
    const accountHeader = group.locator(`[data-connections-row="account:${created.account.id}"]`);
    // A singleton is one rich header, not a provider row plus another Connection card.
    await expect(singleProvider.locator(":scope > button")).toHaveCount(0);
    await expect(accountHeader).toContainText("OpenAI");
    await expect(accountHeader).toContainText("3 models");
    await expect(accountHeader).toContainText(`Mixed studio ${info.project.name}`);
    await expect(accountHeader).toContainText("Ready");
    // Opening the merged header also clears a legacy account fold.
    await expect(accountHeader).toHaveAttribute("aria-expanded", "false");
    await accountHeader.press("Enter");
    await expect(accountHeader).toHaveAttribute("aria-expanded", "true");
    for (const id of ids.slice(0, 3)) await expect(group.locator(`[data-connection-id="${id}"]`)).toBeVisible();
    await expect(group).toContainText("Chat");
    await expect(group).toContainText("Image");
    await expect(group).toContainText("Audio");
    // A keeps authored names and full IDs, while avoiding redundant/subordinate ID noise.
    await expect(
      group.locator(`[data-connection-id="${created.connectionId}"]`).getByText("gpt-5.5", { exact: true }),
    ).toHaveCount(1);
    const gatewayRow = panel.locator(`[data-connection-account-id="${gateway.account.id}"]`);
    await expect(gatewayRow.getByRole("button", { name: "Edit My GLM", exact: true })).toBeVisible();
    const nanoGroup = gatewayRow.locator('[data-connection-upstream="nanogpt"]');
    await expect(nanoGroup.getByText("NanoGPT · 1", { exact: true })).toBeVisible();
    await expect(nanoGroup.getByRole("button", { name: "Edit My GLM", exact: true })).toBeVisible();
    await expect(nanoGroup.getByText("zai-org/glm-5.2", { exact: true })).toBeVisible();
    await expect(gatewayRow.locator("span[title]").filter({ hasText: "My GLM" })).toHaveAttribute(
      "title",
      /nanogpt\/zai-org\/glm-5\.2/,
    );

    await expect(gatewayRow.getByText("meta-llama/Llama-3.1-8B", { exact: true })).toBeVisible();

    await accountHeader.press("Space");
    await expect(group.locator("[data-connection-id]")).toHaveCount(0);
    await group.locator(`[data-connections-toggle="${created.account.id}"]`).click();
    await expect(group.locator("[data-connection-id]")).toHaveCount(3);
    const search = panel.getByRole("searchbox", { name: "Search models and connections" });
    await search.fill("Studio Image");
    await expect(accountHeader).toContainText("1 model");
    await accountHeader.click();
    await expect(group.locator("[data-connection-id]")).toHaveCount(0);
    await search.fill("Studio Voice");
    await expect(group.locator("[data-connection-id]")).toHaveCount(1);
    await search.fill("");
    await expect(group.locator("[data-connection-id]")).toHaveCount(3);
    expect(
      (await request.patch(`/api/connection-accounts/${created.account.id}`, { data: { enabled: false } })).ok(),
    ).toBeTruthy();
    // Refetch to observe the changed state; Repair stays on the same merged header.
    await page.reload();
    await expect(accountHeader).toContainText("Off");
    await group.getByRole("button", { name: `Turn on Mixed studio ${info.project.name}` }).click();
    await expect(accountHeader).toContainText("Ready");
    await accountHeader.press("Enter");
    await expect(group.locator("[data-connection-id]")).toHaveCount(3);
    const provider = panel.locator('[data-connection-provider="comfyui"]');
    // One endpoint/access identity owns both image and video models, with one fold and settings page.
    expect(comfy[0]!.accountId).toBe(comfy[1]!.accountId);
    await expect(provider.locator("[data-connection-account-id]")).toHaveCount(1);
    await expect(provider.locator('[data-connections-row^="provider:"]')).toHaveCount(0);
    const comfyAccount = provider.locator(`[data-connection-account-id="${comfy[0]!.accountId}"]`);
    const comfyHeader = comfyAccount.locator(`[data-connections-row="account:${comfy[0]!.accountId}"]`);
    await expect(comfyHeader).toContainText("ComfyUI");
    await expect(comfyHeader).toContainText("2 models");
    await expect(comfyHeader.getByText("127.0.0.1:8188", { exact: true })).toHaveCount(1);
    const primaryBox = await accountHeader.boundingBox();
    const headerBox = await comfyHeader.boundingBox();
    expect(Math.abs(headerBox!.x - primaryBox!.x)).toBeLessThan(1);
    for (const entry of comfy) {
      const model = comfyAccount.locator(`[data-connection-id="${entry.id}"]`);
      await expect(model).toBeVisible();
      const modelBox = await model.locator(".mari-provider-icon").boundingBox();
      const headerIconBox = await comfyHeader.locator(".mari-provider-icon").boundingBox();
      const rowBox = await model.boundingBox();
      expect(Math.abs(rowBox!.x - headerBox!.x)).toBeLessThan(1);
      expect(modelBox!.x - headerIconBox!.x).toBeGreaterThanOrEqual(8);
      expect(modelBox!.x - headerIconBox!.x).toBeLessThanOrEqual(24);
    }
    await expect(comfyAccount).toContainText("Image");
    await expect(comfyAccount).toContainText("Video");
    await comfyHeader.press("Space");
    await expect(comfyAccount.locator("[data-connection-id]")).toHaveCount(0);
    await comfyHeader.press("Enter");
    await expect(comfyAccount.locator("[data-connection-id]")).toHaveCount(2);
    await comfyAccount.getByRole("button", { name: "Actions for ComfyUI · 127.0.0.1:8188", exact: true }).click();
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    const accountDialog = page.getByRole("dialog");
    for (const entry of comfy)
      await expect(accountDialog.getByRole("button", { name: entry.name, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    if (info.project.name === "desktop-chromium") {
      const originalViewport = page.viewportSize()!;
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        for (const theme of ["dark", "light"]) {
          await page.evaluate((theme) => document.documentElement.setAttribute("data-theme", theme), theme);
          await page.screenshot({ path: `.tmp/provider-headers/screenshots/hierarchy-${width}-${theme}.png` });
          expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        }
      }
      await page.setViewportSize({ width: 320, height: 960 });
      await group.scrollIntoViewIfNeeded();
      await group.screenshot({ path: ".tmp/provider-headers/screenshots/roles-320-dark.png" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.setViewportSize(originalViewport);
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    }
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
    await page
      .getByRole("dialog", { name: "Choose a model" })
      .getByRole("button", { name: /Studio Image/ })
      .click();
    await expect(imageDefault).toContainText("Studio Image");
    await expect(images).toHaveAttribute("data-retained-row", "true");
    await expect(imageDefault).toBeFocused();
    await panel.getByRole("button", { name: /Set up another role/ }).click();
    await expect(images.locator('[data-defaults-tile="images"]')).toHaveAttribute("aria-expanded", "false");
    await images.locator('[data-defaults-tile="images"]').click();
    await imageDefault.focus();
    await imageDefault.press("Enter");
    await page
      .getByRole("dialog", { name: "Choose a model" })
      .getByRole("button", { name: "None", exact: true })
      .click();
    await expect(imageDefault).toContainText("None");
    await images.locator('[data-defaults-tile="images"]').click();
    await expect(panel.locator("[data-defaults-unused]")).toBeFocused();
    // Account credentials remain hidden until requested, and opening access never changes the account.
    await group.getByRole("button", { name: `Actions for Mixed studio ${info.project.name}` }).click();
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
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
    if (previousAgents)
      await request.patch(`/api/connections/${previousAgents.id}`, { data: { defaultForAgents: true } });
    for (const id of ids) await request.delete(`/api/connections/${id}`);
    await request.delete(`/api/connection-accounts/${created.account.id}`);
    for (const id of new Set(extraAccounts)) await request.delete(`/api/connection-accounts/${id}`);
    if (previousMain) await request.patch(`/api/connections/${previousMain.id}`, { data: { isDefault: true } });
  }
});
