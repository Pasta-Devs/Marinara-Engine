import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("fal.ai selection saves its endpoint and exposes a free configuration check", async ({
  page,
  request,
}, testInfo) => {
  const created = await request.post("/api/connections", {
    data: {
      name: "fal.ai setup fixture",
      provider: "image_generation",
      imageGenerationSource: "openai",
      imageService: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-image-2",
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
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
    const open = () =>
      page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(id);
      }, id);
    await page.goto("/");
    await open();
    const editor = page.locator(".mari-editor-shell");
    const fal = editor.getByRole("button", { name: /^fal\.ai Generate images/ });
    await fal.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("before-fal-selection.png") });
    await fal.click();
    await expect(editor.getByRole("link", { name: "Get your fal.ai API key" })).toHaveAttribute(
      "href",
      "https://fal.ai/dashboard/keys",
    );
    await editor.getByRole("button", { name: "Test Connection", exact: true }).click();
    await expect(editor.getByText("Connection failed: fal.ai requires an API key", { exact: true })).toBeVisible();
    await editor.getByPlaceholder(/leave empty to keep existing key/).fill("synthetic-fal-key");
    await editor.getByRole("button", { name: "Test Connection", exact: true }).click();
    await expect(
      editor.getByText(
        "fal.ai connection configured. Use Test Image to verify your key and generate an image using credits.",
        { exact: true },
      ),
    ).toBeVisible();
    const saved = await (await request.get(`/api/connections/${id}`)).json();
    expect(saved.imageGenerationSource).toBe("fal");
    expect(saved.imageService).toBe("fal");
    expect(saved.baseUrl).toBe("https://fal.run");
    expect(saved.model).toBe("fal-ai/flux/schnell");
    const models = await (await request.get(`/api/connections/${id}/models`)).json();
    expect(models.models.map((model: { id: string }) => model.id)).toEqual(["fal-ai/flux/schnell", "fal-ai/flux/dev"]);
    await page.reload();
    await open();
    await expect(fal).toHaveClass(/bg-sky-400/);
    await expect(editor.getByRole("textbox", { name: "Custom Parameters", exact: true })).toBeVisible();
    await fal.scrollIntoViewIfNeeded();
    const screenshot = testInfo.outputPath("saved-fal-selection.png");
    await page.screenshot({ path: screenshot });
    await testInfo.attach("saved-fal-selection", { path: screenshot, contentType: "image/png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/connections/${id}`);
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
      await expect(editor.getByPlaceholder("Connection name")).toHaveValue(name);
    };
    await open(ids[0]!, "Result scope first");
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/api/connections/${ids[0]}/test`, async (route) => {
      await gate;
      await route.fulfill({ json: { success: false, message: "STALE_CONNECTION_CHECK", latencyMs: 1 } });
    });
    const requested = page.waitForRequest((r) => r.url().endsWith(`/connections/${ids[0]}/test`));
    await editor.getByRole("button", { name: "Test Connection", exact: true }).click();
    await requested;
    await open(ids[1]!, "Result scope second");
    release();
    await expect(editor.getByRole("button", { name: "Test Connection", exact: true })).toBeEnabled();
    await expect(editor.getByText("STALE_CONNECTION_CHECK")).toHaveCount(0);

    await page.route(`**/api/connections/${ids[1]}/test-image`, (route) =>
      route.fulfill({ json: { success: false, error: "SAVED_IMAGE_TEST_RESULT", latencyMs: 1 } }),
    );
    await editor.getByRole("button", { name: "Test Image", exact: true }).click();
    await expect(editor.getByText("SAVED_IMAGE_TEST_RESULT", { exact: true })).toBeVisible();
    await page.route(`**/api/connections/${ids[1]}`, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const response = await route.fetch();
      await route.fulfill({ json: { ...(await response.json()), name: "Hydrated result fixture" } });
    });
    await editor.getByPlaceholder("Connection name").fill("Renamed result fixture");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor.getByPlaceholder("Connection name")).toHaveValue("Hydrated result fixture");
    await expect(editor.getByText("SAVED_IMAGE_TEST_RESULT", { exact: true })).toBeVisible();
    const editedGate = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/api/connections/${ids[1]}/test-image`, async (route) => {
      await editedGate;
      await route.fulfill({ json: { success: false, error: "STALE_EDITED_CONFIG", latencyMs: 1 } });
    });
    const imageRequested = page.waitForRequest((r) => r.url().endsWith(`/connections/${ids[1]}/test-image`));
    await editor.getByRole("button", { name: "Test Image", exact: true }).click();
    await imageRequested;
    await editor.getByPlaceholder("Connection name").fill("Configuration changed during test");
    release();
    await expect(editor.getByRole("button", { name: "Test Image", exact: true })).toBeEnabled();
    await expect(editor.getByText("STALE_EDITED_CONFIG")).toHaveCount(0);
    await open(ids[0]!, "Result scope first");
    await expect(editor.getByText("SAVED_IMAGE_TEST_RESULT")).toHaveCount(0);
  } finally {
    release();
    for (const id of ids) await request.delete(`/api/connections/${id}`);
  }
});
