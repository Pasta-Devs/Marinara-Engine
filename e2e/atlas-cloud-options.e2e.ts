import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["light", "dark"] as const) {
  test(`Atlas Cloud options persist per model and reset (${theme})`, async ({ page, request }, testInfo) => {
    const response = await request.post("/api/connections", {
      data: {
        name: `Atlas options ${theme} ${testInfo.project.name}`,
        provider: "video_generation",
        videoGenerationSource: "atlas",
        videoService: "atlas",
        baseUrl: "https://api.atlascloud.ai",
        model: "vendor/first",
      },
    });
    expect(response.ok()).toBeTruthy();
    const connection = await response.json();
    await page.route("**/api/connections/atlas-cloud/video-model-schema?*", async (route) => {
      const model = new URL(route.request().url()).searchParams.get("model");
      await route.fulfill({
        json: {
          model,
          available: true,
          limits: null,
          fields: [
            {
              name: model === "vendor/first" ? "prototype" : "negative_prompt",
              type: "string",
              enum: null,
              minimum: null,
              maximum: null,
              default: "",
              description: "Model-specific text option",
              required: false,
            },
            {
              name: "shot_type",
              type: "string",
              enum: [1, "1", "__model_default__"],
              minimum: null,
              maximum: null,
              default: 1,
              description: null,
              required: false,
            },
          ],
        },
      });
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme });
    await page.addInitScript((version) => {
      localStorage.removeItem("marinara-active-chat-id");
      localStorage.setItem("marinara:whats-new:seen-version", version);
    }, version);
    const storedOptions = async () => {
      const stored = await (await request.get(`/api/connections/${connection.id}`)).json();
      const parameters =
        typeof stored.defaultParameters === "string" ? JSON.parse(stored.defaultParameters) : stored.defaultParameters;
      return parameters?.videoGeneration?.atlas?.modelOptions;
    };
    try {
      await page.goto("/");
      await page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(id);
      }, connection.id);
      const editor = page.locator(".mari-editor-shell");
      await expect(editor).toBeVisible();
      const save = async () => {
        const button = editor.getByRole("button", { name: "Save", exact: true });
        const [response] = await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === `/api/connections/${connection.id}` &&
              response.request().method() === "PATCH",
          ),
          button.click(),
        ]);
        expect(response.ok()).toBeTruthy();
        await expect(button).toBeEnabled();
      };
      await editor.getByRole("button", { name: /Atlas Cloud.*setup/i }).click();
      await editor.getByRole("textbox", { name: /prototype/ }).fill("cinematic");
      await editor.getByRole("combobox", { name: "shot_type", exact: true }).selectOption({ value: "1" });
      await save();
      await expect.poll(storedOptions).toEqual({ "vendor/first": { prototype: "cinematic", shot_type: "1" } });
      await editor.getByRole("combobox", { name: "shot_type", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`atlas-options-${theme}.png`) });
      const modelInput = editor.getByPlaceholder("Or type model ID directly…");
      await modelInput.fill("vendor/second");
      await expect(editor.getByRole("textbox", { name: /prototype/ })).not.toBeVisible();
      await editor.getByRole("textbox", { name: /negative_prompt/ }).fill("blurry");
      await editor.getByRole("combobox", { name: "shot_type", exact: true }).selectOption({ value: "2" });
      await save();
      const secondOptions = { negative_prompt: "blurry", shot_type: "__model_default__" };
      await expect.poll(storedOptions).toEqual({
        "vendor/first": { prototype: "cinematic", shot_type: "1" },
        "vendor/second": secondOptions,
      });
      await modelInput.fill("vendor/first");
      await expect(editor.getByRole("textbox", { name: /prototype/ })).toHaveValue("cinematic");
      await editor.getByRole("button", { name: "Reset model options", exact: true }).click();
      await expect(editor.getByRole("textbox", { name: /prototype/ })).toHaveValue("");
      await save();
      await expect.poll(storedOptions).toEqual({ "vendor/second": secondOptions });
    } finally {
      await page.close();
      await request.delete(`/api/connections/${connection.id}`);
    }
  });
}
