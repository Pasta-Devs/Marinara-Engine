import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("RunPod exposes and saves the shared ComfyUI controls", async ({ page, request }, info) => {
  const connection = await (
    await request.post("/api/connections", {
      data: {
        name: "RunPod settings fixture",
        provider: "image_generation",
        imageGenerationSource: "runpod_comfyui",
        imageService: "runpod_comfyui",
        baseUrl: "https://api.runpod.ai/v2",
        imageEndpointId: "fixture",
        comfyuiWorkflow: '{"1":{"class_type":"KSampler","inputs":{"steps":"%steps%"}}}',
      },
    })
  ).json();
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme: info.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    const open = () =>
      page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(id);
      }, connection.id);
    await open();
    const editor = page.locator(".mari-editor-shell");
    await editor.getByRole("button", { name: /ComfyUI generation setup/ }).click();
    await editor.getByRole("spinbutton", { name: "Steps", exact: true }).fill("17");
    await editor.getByRole("spinbutton", { name: "Steps", exact: true }).press("Tab");
    await editor.getByRole("textbox", { name: "Prompt Prefix", exact: true }).fill("A watercolor painting");
    await editor.getByLabel("LoRA 1", { exact: true }).fill("style.safetensors");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    const profile = async () => {
      const row = await (await request.get(`/api/connections/${connection.id}`)).json();
      return JSON.parse(row.defaultParameters).imageGeneration;
    };
    await expect.poll(async () => (await profile())?.comfyui?.steps).toBe(17);
    expect((await profile()).comfyui.promptPrefix).toBe("A watercolor painting");
    expect((await profile()).comfyui.loras[0].model).toBe("style.safetensors");
    await page.screenshot({ path: info.outputPath("runpod-settings.png") });
    await page.reload();
    await open();
    await expect(editor.getByRole("button", { name: /ComfyUI generation setup/ })).toBeVisible();
    if (!(await editor.getByRole("spinbutton", { name: "Steps", exact: true }).isVisible())) {
      await editor.getByRole("button", { name: /ComfyUI generation setup/ }).click();
    }
    await expect(editor.getByRole("spinbutton", { name: "Steps", exact: true })).toHaveValue("17");
  } finally {
    await page.close();
    await request.delete(`/api/connections/${connection.id}`);
  }
});
