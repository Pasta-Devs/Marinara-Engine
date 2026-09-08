import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string })
  .version;

async function openConnection(page: Page, id: string) {
  await page.evaluate(async (connectionId) => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openConnectionDetail(connectionId);
  }, id);
  await expect(page.getByPlaceholder("Connection name")).toBeVisible();
}

test("GPT Image 2.5 quality persists and sprite previews retain transparent expression sheets", async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false, theme: "dark" });
  await page.addInitScript(
    (appVersion) => localStorage.setItem("marinara:whats-new:seen-version", appVersion),
    version,
  );
  const created = await request.post("/api/connections", {
    data: {
      name: `GPT Image 2.5 ${testInfo.project.name}`,
      provider: "image_generation",
      imageGenerationSource: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-image-2",
      imageGenerationQuality: "high",
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = (await created.json()) as { id: string };
  const editor = page.locator(".mari-editor-shell").filter({ has: page.getByPlaceholder("Connection name") });
  const qualityPanel = editor
    .locator(".mari-editor-panel")
    .filter({ has: page.getByRole("heading", { name: "Image quality", exact: true }) });
  const quality = qualityPanel.getByRole("combobox");
  const modelPanel = editor
    .locator(".mari-editor-panel")
    .filter({ has: page.getByRole("heading", { name: "Model", exact: true }) });
  const selectModel = async (model: string) => {
    await modelPanel.locator(".cursor-pointer").first().click();
    await modelPanel.getByPlaceholder("Search models…").fill(model);
    await modelPanel
      .getByRole("button")
      .filter({ has: page.getByText(model, { exact: true }) })
      .click();
  };
  const save = async (model: string, value: string) => {
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => {
        const connection = await (await request.get(`/api/connections/${id}`)).json();
        return { model: connection.model, quality: connection.imageGenerationQuality };
      })
      .toEqual({ model, quality: value });
  };
  const screenshot = async (name: string) => {
    await quality.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: "disabled" });
    await testInfo.attach(name, { path: testInfo.outputPath(`${name}.png`), contentType: "image/png" });
  };
  try {
    await page.goto("/");
    await openConnection(page, id);
    await expect(quality).toHaveValue("high");
    await expect(quality.locator("option")).toHaveCount(4);
    await screenshot("legacy-gpt-image-2-dark");

    for (const [model, value, label] of [
      ["gpt-image-2.5-flare", "xhigh", "Extra high"],
      ["gpt-image-2.5-sunburst", "max", "Max"],
    ] as const) {
      await selectModel(model);
      await expect(quality.locator("option")).toHaveCount(6);
      await quality.selectOption({ label });
      await save(model, value);
      await page.reload();
      await openConnection(page, id);
      await expect(quality).toHaveValue(value);
      await screenshot(`${model}-dark`);

      const preview = await request.post("/api/sprites/generate-sheet/preview", {
        data: {
          connectionId: id,
          appearance: "brown hair, red eyes, dark coat",
          expressions: ["neutral", "happy", "sad", "angry", "surprised", "smug"],
          cols: 3,
          rows: 2,
          spriteType: "portrait",
          nativeTransparentPng: true,
          noBackground: true,
        },
      });
      expect(preview.ok()).toBeTruthy();
      const { items } = (await preview.json()) as { items: Array<{ prompt: string; width: number; height: number }> };
      expect(items).toHaveLength(1);
      expect(items[0]?.prompt).toMatch(/output native transparency with no backdrop/iu);
      expect(items[0]).toMatchObject({ width: 1536, height: 1024 });
    }
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setTheme("light");
    });
    await screenshot("gpt-image-2.5-sunburst-light");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await selectModel("gpt-image-2");
    await expect(quality.locator("option")).toHaveCount(4);
    await expect(quality).toHaveValue("auto");
    await save("gpt-image-2", "auto");

    await page.route(`**/api/connections/${id}`, async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...(await response.json()), model: 42, imageGenerationQuality: "max" } });
    });
    await page.reload();
    await openConnection(page, id);
    await expect(modelPanel).toBeVisible();
    await expect(quality).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/connections/${id}`);
  }
});
