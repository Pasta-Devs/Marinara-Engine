import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("fal.ai selection saves its endpoint and exposes a free configuration check", async ({
  page,
  request,
}, testInfo) => {
  // A media service is chosen per account in the Add window; its account editor keeps the free check.
  const accountsBefore = new Set(
    ((await (await request.get("/api/connection-accounts")).json()) as Array<{ id: string }>).map((a) => a.id),
  );
  let accountId = "";
  let id = "";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    await page.evaluate(async () => {
      const { openAddConnection } = await import("/src/lib/add-connection.ts" as string);
      openAddConnection();
    });
    const dialog = page.getByRole("dialog", { name: "Add account", exact: true });
    const fal = dialog.locator('[data-add-connection-service="media:fal"]');
    await fal.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("before-fal-selection.png") });
    await fal.click();
    await expect(dialog.getByRole("link", { name: /Where do I find my key\?/ })).toHaveAttribute(
      "href",
      "https://fal.ai/dashboard/keys",
    );
    // fal.ai needs a key before it can connect.
    const connect = dialog.locator("[data-add-connection-connect]");
    await expect(connect).toBeDisabled();
    await dialog.getByLabel("API key", { exact: true }).fill("synthetic-fal-key");
    // Take the ids from this page's own create call: another run on the same server may add an account meanwhile.
    const created = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && new URL(response.url()).pathname === "/api/connection-accounts",
    );
    await connect.click();
    const body = (await (await created).json()) as { account: { id: string }; connectionId: string };
    accountId = body.account.id;
    id = body.connectionId;
    await expect(dialog).toHaveCount(0);
    expect(accountsBefore.has(accountId)).toBe(false);
    const saved = await (await request.get(`/api/connections/${id}`)).json();
    expect(saved.imageGenerationSource).toBe("fal");
    expect(saved.imageService).toBe("fal");
    expect(saved.baseUrl).toBe("https://fal.run");
    const models = await (await request.get(`/api/connections/${id}/models`)).json();
    expect(models.models.map((model: { id: string }) => model.id)).toEqual(["fal-ai/flux/schnell", "fal-ai/flux/dev"]);

    // The free check only reads the configuration; Test Image is the one that spends credits.
    await page.evaluate(async (accountId) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openModal("connection-account", { accountId });
    }, accountId);
    const editor = page.getByRole("dialog", { name: "Edit account", exact: true });
    const checked = page.waitForResponse((response) => response.url().endsWith(`/api/connections/${id}/test`));
    await editor.getByRole("button", { name: "Test account", exact: true }).click();
    expect(await (await checked).json()).toMatchObject({
      success: true,
      message: "fal.ai connection configured. Use Test Image to verify your key and generate an image using credits.",
    });
    await expect(editor.locator("[data-account-test-result]")).toContainText("Ready");
    await page.keyboard.press("Escape");
    await expect(editor).toHaveCount(0);

    // The fal.ai endpoint is the Model's model: picking one saves it, and it is still picked after a reload.
    const openModel = () =>
      page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(id);
      }, id);
    const modelEditor = page.locator(".mari-editor-shell");
    const endpoint = (model: string) => modelEditor.locator(`[data-model-id="${model}"] [data-model-option]`);
    await openModel();
    await endpoint("fal-ai/flux/dev").click();
    await modelEditor.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => (await (await request.get(`/api/connections/${id}`)).json()).model)
      .toBe("fal-ai/flux/dev");
    await page.reload();
    await openModel();
    await expect(endpoint("fal-ai/flux/dev")).toHaveAttribute("aria-current", "true");
    await expect(modelEditor.getByRole("textbox", { name: "Custom Parameters", exact: true })).toBeVisible();
    const screenshot = testInfo.outputPath("saved-fal-selection.png");
    await page.screenshot({ path: screenshot });
    await testInfo.attach("saved-fal-selection", { path: screenshot, contentType: "image/png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    expect(errors).toEqual([]);
  } finally {
    if (id) await request.delete(`/api/connections/${id}`);
    if (accountId) await request.delete(`/api/connection-accounts/${accountId}`);
  }
});

test("connection test results survive hydration and ignore a previous selection", async ({ page, request }) => {
  const ids: string[] = [];
  let release = () => {};
  try {
    for (const name of ["Result scope first", "Result scope second"]) {
      const response = await request.post("/api/connections", {
        data: {
          name,
          provider: "image_generation",
          imageGenerationSource: "fal",
          imageService: "fal",
          baseUrl: "https://fal.run",
          model: "fal-ai/flux/schnell",
        },
      });
      expect(response.ok()).toBeTruthy();
      ids.push((await response.json()).id);
    }
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    const editor = page.locator(".mari-editor-shell");
    const open = async (id: string, name: string) => {
      await page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(id);
      }, id);
      await expect(editor.getByPlaceholder("Model name", { exact: true })).toHaveValue(name);
    };
    await open(ids[0]!, "Result scope first");
    // A Model of an account is tested with Test image here (Test connection is on the account); a result for
    // the previous selection never shows on the next one.
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/api/connections/${ids[0]}/test-image`, async (route) => {
      await gate;
      await route.fulfill({ json: { success: false, error: "STALE_CONNECTION_CHECK", latencyMs: 1 } });
    });
    const requested = page.waitForRequest((r) => r.url().endsWith(`/connections/${ids[0]}/test-image`));
    await editor.getByRole("button", { name: "Test image", exact: true }).click();
    await requested;
    await open(ids[1]!, "Result scope second");
    release();
    await expect(editor.getByRole("button", { name: "Test image", exact: true })).toBeEnabled();
    await expect(editor.getByText("STALE_CONNECTION_CHECK")).toHaveCount(0);

    await page.route(`**/api/connections/${ids[1]}/test-image`, (route) =>
      route.fulfill({ json: { success: false, error: "SAVED_IMAGE_TEST_RESULT", latencyMs: 1 } }),
    );
    await editor.getByRole("button", { name: "Test image", exact: true }).click();
    await expect(editor.getByText("SAVED_IMAGE_TEST_RESULT", { exact: true })).toBeVisible();
    await page.route(`**/api/connections/${ids[1]}`, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const response = await route.fetch();
      await route.fulfill({ json: { ...(await response.json()), name: "Hydrated result fixture" } });
    });
    await editor.getByPlaceholder("Model name", { exact: true }).fill("Renamed result fixture");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor.getByPlaceholder("Model name", { exact: true })).toHaveValue("Hydrated result fixture");
    await expect(editor.getByText("SAVED_IMAGE_TEST_RESULT", { exact: true })).toBeVisible();
    const editedGate = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/api/connections/${ids[1]}/test-image`, async (route) => {
      await editedGate;
      await route.fulfill({ json: { success: false, error: "STALE_EDITED_CONFIG", latencyMs: 1 } });
    });
    const imageRequested = page.waitForRequest((r) => r.url().endsWith(`/connections/${ids[1]}/test-image`));
    await editor.getByRole("button", { name: "Test image", exact: true }).click();
    await imageRequested;
    await editor.getByPlaceholder("Model name", { exact: true }).fill("Configuration changed during test");
    release();
    await expect(editor.getByRole("button", { name: "Test image", exact: true })).toBeEnabled();
    await expect(editor.getByText("STALE_EDITED_CONFIG")).toHaveCount(0);
    await open(ids[0]!, "Result scope first");
    await expect(editor.getByText("SAVED_IMAGE_TEST_RESULT")).toHaveCount(0);
  } finally {
    release();
    for (const id of ids) await request.delete(`/api/connections/${id}`);
  }
});
