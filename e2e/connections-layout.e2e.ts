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
    // One header row: Search, a labelled Add and More (Import and Export live in More).
    await expect(panel.getByRole("button", { name: "Add connection", exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Import connection", exact: true })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "More actions", exact: true })).toBeVisible();
    await expect(panel.getByRole("searchbox", { name: "Search models and connections" })).toBeVisible();
    const group = panel.locator(`[data-connection-account-id="${created.account.id}"]`);
    const singleProvider = panel.locator('[data-connection-provider="openai"]');
    const accountHeader = group.locator(`[data-connections-row="account:${created.account.id}"]`);
    // A singleton is one rich header, not a provider row plus another Connection card.
    await expect(singleProvider.locator(":scope > button")).toHaveCount(0);
    // Line 1 is the account's own name; the service stays in the tile and the accessible name.
    await expect(accountHeader.locator("strong")).toHaveText(`Mixed studio ${info.project.name}`);
    await expect(accountHeader.locator("[data-connection-identity-meta]")).toHaveText("3 models · 127.0.0.1:9");
    await expect(accountHeader).toHaveAttribute("aria-label", new RegExp(`^OpenAI, Mixed studio ${info.project.name}`));
    // A healthy Connection shows no status word.
    await expect(accountHeader).not.toContainText("Ready");
    // Opening the merged header also clears a legacy account fold.
    await expect(accountHeader).toHaveAttribute("aria-expanded", "false");
    await accountHeader.press("Enter");
    await expect(accountHeader).toHaveAttribute("aria-expanded", "true");
    for (const id of ids.slice(0, 3)) await expect(group.locator(`[data-connection-id="${id}"]`)).toBeVisible();
    // Chat rows carry no kind word; other kinds get a pill.
    await expect(group).toContainText("Image");
    await expect(group).toContainText("Voice");
    // A keeps authored names and full IDs, while avoiding redundant/subordinate ID noise.
    await expect(
      group.locator(`[data-connection-id="${created.connectionId}"]`).getByText("gpt-5.5", { exact: true }),
    ).toHaveCount(1);
    const gatewayRow = panel.locator(`[data-connection-account-id="${gateway.account.id}"]`);
    await expect(gatewayRow.getByRole("button", { name: "Edit My GLM", exact: true })).toBeVisible();
    const nanoGroup = gatewayRow.locator('[data-connection-upstream="nanogpt"]');
    await expect(nanoGroup.getByRole("button", { name: /^via NanoGPT\s?1$/ })).toBeVisible();
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
    // The one status word is the fix itself, beside the heading.
    const turnOn = group.getByRole("button", { name: `Turn on Mixed studio ${info.project.name}` });
    await expect(turnOn).toHaveText("Off");
    await turnOn.click();
    await expect(turnOn).toHaveCount(0);
    await expect(group.getByText("Ready", { exact: true })).toHaveCount(0);
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
    await expect(comfyHeader).toContainText("2 models · 127.0.0.1:8188");
    // The card head holds the picture tile (its own button) and the folding heading.
    const comfyHead = comfyAccount.locator(".mari-connection-card-head");
    const primaryBox = await group.locator(".mari-connection-card-head").boundingBox();
    const headerBox = await comfyHead.boundingBox();
    expect(Math.abs(headerBox!.x - primaryBox!.x)).toBeLessThan(1);
    for (const entry of comfy) {
      const model = comfyAccount.locator(`[data-connection-id="${entry.id}"]`);
      await expect(model).toBeVisible();
      const modelBox = await model.locator(".mari-provider-icon").boundingBox();
      const headerIconBox = await comfyHead.locator(".mari-provider-icon").boundingBox();
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
    await page.getByRole("menuitem", { name: "Edit connection", exact: true }).click();
    const accountDialog = page.getByRole("dialog");
    for (const entry of comfy)
      await expect(accountDialog.getByRole("button", { name: `Edit ${entry.name}`, exact: true })).toBeVisible();
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
    // The Defaults box starts unfolded; Main, Agents and Images always show.
    await expect(panel.locator('[data-defaults-tile="main"]')).toBeVisible();
    await expect(panel.locator('[data-defaults-tile="main"]')).toHaveAttribute("aria-expanded", "false");
    await panel.locator('[data-defaults-tile="main"]').click();
    await expect(panel.locator('[data-defaults-role="main"]')).toContainText("Fallback");
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
    await imageDefault.focus();
    await imageDefault.press("Enter");
    await page
      .getByRole("dialog", { name: "Choose a model" })
      .getByRole("button", { name: "None", exact: true })
      .click();
    await expect(imageDefault).toContainText("None");
    await images.locator('[data-defaults-tile="images"]').click();
    await expect(images.locator('[data-defaults-tile="images"]')).toBeFocused();
    // The saved key stays masked in the editor, and opening it never changes the connection.
    await group.getByRole("button", { name: `Actions for Mixed studio ${info.project.name}` }).click();
    await page.getByRole("menuitem", { name: "Edit connection", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("[data-account-address]")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Replace", exact: true }).first()).toBeVisible();
    // The API key shows masked, not as a field (the management token in More options may still be one).
    await expect(dialog.getByLabel("API key", { exact: true })).toHaveCount(0);
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

test("Move to connection offers the same service first, then other services with a model step", async ({
  page,
  request,
}, info) => {
  const suffix = info.project.name;
  const accounts: string[] = [];
  const addAccount = async (provider: string, name: string, model: string) => {
    const response = await request.post("/api/connection-accounts", {
      data: {
        provider,
        name: `${name} ${suffix}`,
        apiKey: "fixture-not-a-real-key",
        baseUrl: "http://127.0.0.1:9/v1",
        model,
      },
    });
    expect(response.ok()).toBeTruthy();
    const created = (await response.json()) as { account: { id: string }; connectionId: string };
    accounts.push(created.account.id);
    return created;
  };
  try {
    const home = await addAccount("openai", "Move home", "gpt-5.5");
    const twin = await addAccount("openai", "Move twin", "gpt-5.5-mini");
    const router = await addAccount("openrouter", "Move router", "openai/gpt-4.1");
    const empty = await addAccount("openrouter", "Move empty", "openai/gpt-4.1-mini");
    const broken = await addAccount("openrouter", "Move broken", "openai/gpt-4o");
    let brokenCalls = 0;
    const modelName = `Move me ${suffix}`;
    expect(
      (await request.patch(`/api/connections/${home.connectionId}`, { data: { name: modelName } })).ok(),
    ).toBeTruthy();

    const moves: Array<{ accountId: string; model?: string }> = [];
    await page.route(/\/api\/connections\/[^/]+\/move-candidates\?/, (route) => {
      const target = new URL(route.request().url()).searchParams.get("accountId");
      const base = { kind: "cross", provider: "openrouter", manualModelAllowed: false, catalogFetchedAt: null };
      // The target's list fails to load once, then loads on Retry.
      if (target === broken.account.id && brokenCalls++ === 0) {
        return route.fulfill({ json: { ...base, catalogError: "Provider returned 503: down", candidates: [] } });
      }
      return route.fulfill({
        json:
          target === router.account.id || target === broken.account.id
            ? {
                ...base,
                candidates: [
                  { id: "openai/gpt-5.5", name: "OpenAI: GPT-5.5", match: "prefix", variant: false },
                  { id: "openai/gpt-5.4", name: "OpenAI: GPT-5.4", match: "catalog", variant: false },
                  { id: "openai/gpt-5.5:thinking", name: "OpenAI: GPT-5.5 Thinking", match: "prefix", variant: true },
                ],
              }
            : { ...base, candidates: [] },
      });
    });
    await page.route(/\/api\/connections\/[^/]+\/move$/, (route) => {
      moves.push(route.request().postDataJSON());
      return route.fulfill({ json: { id: home.connectionId } });
    });
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
    const openMove = async () => {
      await panel.getByRole("searchbox", { name: "Search models and connections" }).fill(modelName);
      await panel
        .locator(`[data-connection-id="${home.connectionId}"]`)
        .getByRole("button", { name: `Actions for ${modelName}`, exact: true })
        .click();
      await page.getByRole("menuitem", { name: /^Move to connection…/ }).click();
      return page.getByRole("dialog", { name: "Move to connection" });
    };

    // Same service: listed above "Other services", and one tap moves without a model.
    let dialog = await openMove();
    const twinRow = dialog.locator(`[data-move-target="${twin.account.id}"]`);
    const other = dialog.locator("[data-move-other]");
    await expect(twinRow).toBeVisible();
    await expect(other.getByRole("heading", { name: "Other services" })).toBeVisible();
    await expect(other.locator(`[data-move-target="${router.account.id}"]`)).toBeVisible();
    await expect(other.locator(`[data-move-target="${twin.account.id}"]`)).toHaveCount(0);
    await twinRow.click();
    await expect(page.getByText(`${modelName} moved to Move twin ${suffix}`)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(moves.at(-1)).toEqual({ accountId: twin.account.id });

    // Another service: the best non-variant match is preselected; the variant is marked and not preselected.
    dialog = await openMove();
    await dialog.locator(`[data-move-target="${router.account.id}"]`).click();
    const step = dialog.locator("[data-move-model-step]");
    await expect(step.getByRole("heading", { name: `Choose the model on Move router ${suffix}` })).toBeVisible();
    const best = step.locator('[data-move-candidate="openai/gpt-5.5"]');
    await expect(best.getByRole("radio")).toBeChecked();
    await expect(best).toContainText("Same model");
    const variant = step.locator('[data-move-candidate="openai/gpt-5.5:thinking"]');
    await expect(variant.getByRole("radio")).not.toBeChecked();
    await expect(variant).toContainText("Thinking variant");
    await expect(step.locator("[data-move-manual]")).toHaveCount(0);
    await step.getByRole("button", { name: "Move", exact: true }).click();
    await expect(page.getByText(`${modelName} moved to Move router ${suffix}`)).toBeVisible();
    expect(moves.at(-1)).toEqual({ accountId: router.account.id, model: "openai/gpt-5.5" });

    // No match and no free-form id: say so, keep the search, and leave Move off.
    dialog = await openMove();
    await dialog.locator(`[data-move-target="${empty.account.id}"]`).click();
    await expect(dialog.locator("[data-move-not-offered]")).toHaveText(`Move empty ${suffix} doesn't offer this model`);
    await expect(dialog.locator("[data-move-search]")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Move", exact: true })).toBeDisabled();
    // Back returns to the list of Connections.
    await dialog.getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog.locator("[data-move-targets]")).toBeVisible();

    // A list that fails to load is not "doesn't offer": say so and offer Retry, which loads the candidates.
    await dialog.locator(`[data-move-target="${broken.account.id}"]`).click();
    const failed = dialog.locator("[data-move-catalog-error]");
    await expect(failed).toContainText(`Couldn't load Move broken ${suffix}'s models`);
    await expect(dialog.locator("[data-move-not-offered]")).toHaveCount(0);
    await failed.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(dialog.locator('[data-move-candidate="openai/gpt-5.5"]').getByRole("radio")).toBeChecked();
    await expect(failed).toHaveCount(0);
    await dialog.getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog.locator("[data-move-targets]")).toBeVisible();

    // Proof screenshots of each step at phone and desktop width. A width change remounts the panel, so each width
    // walks the steps again.
    if (suffix === "desktop-chromium") {
      await page.keyboard.press("Escape");
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        dialog = await openMove();
        await expect(dialog.locator("[data-move-targets]")).toBeVisible();
        await page.waitForTimeout(400); // let the dialog finish its enter animation
        await page.screenshot({ path: `.tmp/move-ui/targets-${width}-dark.png` });
        await dialog.locator(`[data-move-target="${router.account.id}"]`).click();
        await expect(dialog.locator('[data-move-candidate="openai/gpt-5.5"]')).toBeVisible();
        await page.waitForTimeout(400); // let the dialog finish its enter animation
        await page.screenshot({ path: `.tmp/move-ui/model-step-${width}-dark.png` });
        await dialog.getByRole("button", { name: "Back", exact: true }).click();
        await dialog.locator(`[data-move-target="${empty.account.id}"]`).click();
        await expect(dialog.locator("[data-move-not-offered]")).toBeVisible();
        await page.waitForTimeout(400); // let the dialog finish its enter animation
        await page.screenshot({ path: `.tmp/move-ui/not-offered-${width}-dark.png` });
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }
    }
  } finally {
    for (const id of accounts) {
      const rows = (await (await request.get("/api/connections")).json()) as Array<{ id: string; accountId?: string }>;
      for (const row of rows.filter((r) => r.accountId === id)) await request.delete(`/api/connections/${row.id}`);
      await request.delete(`/api/connection-accounts/${id}`);
    }
  }
});
