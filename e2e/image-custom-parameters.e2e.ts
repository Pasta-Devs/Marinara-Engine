import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Image API custom parameters validate, save, export, and survive copying", async ({ page, request }, testInfo) => {
  const connection = await (
    await request.post("/api/connections", {
      data: {
        name: "Image LoRA parameters",
        provider: "image_generation",
        imageGenerationSource: "nanogpt",
        imageService: "nanogpt",
        baseUrl: "https://example.com/v1",
        model: "flux-2-pro",
      },
    })
  ).json();
  const ids = [connection.id];
  const custom = {
    lora_url_1: "https://example.com/style.safetensors",
    lora_scale_1: 0.7,
    loras: [{ path: "second", scale: 0.4 }],
  };
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript(
      ({ version }) => {
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { version },
    );
    await page.goto("/");
    const open = (id: string) =>
      page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(id);
      }, id);
    await open(connection.id);
    const editor = page.locator(".mari-editor-shell");
    const field = editor.getByRole("textbox", { name: "Custom Parameters", exact: true });
    await expect(field).toBeVisible();
    await field.fill("[");
    await field.press("Control+Enter");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await field.fill(JSON.stringify(custom, null, 2));
    await field.press("Control+Enter");
    await expect(field).not.toHaveAttribute("aria-invalid", "true");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    const stored = async (id: string) => {
      const row = await (await request.get(`/api/connections/${id}`)).json();
      return JSON.parse(row.defaultParameters ?? "{}").customParameters;
    };
    await expect.poll(() => stored(connection.id)).toEqual(custom);
    await field.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("image-custom-parameters.png") });
    if (testInfo.project.name === "desktop-chromium") {
      const downloaded = page.waitForEvent("download");
      await editor.getByRole("button", { name: "Export connection" }).click();
      await page
        .getByRole("dialog", { name: "Export Connection Data" })
        .getByRole("button", { name: "Export", exact: true })
        .click();
      const file = await (await downloaded).path();
      expect(file).not.toBeNull();
      const envelope = JSON.parse(readFileSync(file!, "utf8"));
      expect(envelope.connections[0].defaultParameters.customParameters).toEqual(custom);
    }
    const duplicate = await (await request.post(`/api/connections/${connection.id}/duplicate`)).json();
    ids.push(duplicate.id);
    expect(await stored(duplicate.id)).toEqual(custom);
    await open(duplicate.id);
    await expect.poll(async () => JSON.parse(await field.inputValue())).toEqual(custom);
    await field.fill("{}");
    await field.press("Control+Enter");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => stored(duplicate.id)).toBeUndefined();
    expect(await stored(connection.id)).toEqual(custom);
  } finally {
    for (const id of ids) await request.delete(`/api/connections/${id}`);
  }
});
