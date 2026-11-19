import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { buildChatImageGenerationRecord, type SceneIllustrationCharacterPrompt } from "@marinara-engine/shared";
import type { ChatImage } from "../packages/client/src/hooks/use-gallery.js";
import { openChatSettingsTool } from "./chat-settings-tools.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
const requireServer = createRequire(new URL("../packages/server/package.json", import.meta.url));
const sharp = requireServer("sharp");

const original = {
  prompt: "Harbor at dusk | fog along the pier",
  negativePrompt: "flat lighting, oversaturation",
  characterPrompts: [
    {
      name: "Mira",
      prompt: "red raincoat, holding a lantern",
      negativePrompt: "hood up",
      position: { x: 0.25, y: 0.5 },
    },
    { name: "Jules", prompt: "navy coat, studying the map" },
  ],
};

const revised = {
  prompt: "Harbor at sunrise | mist on the water",
  negativePrompt: "harsh shadows",
  characterPrompts: [
    {
      ...original.characterPrompts[0]!,
      prompt: "yellow raincoat, holding a lantern",
      negativePrompt: "hat",
    },
    { name: "Jules", prompt: "navy coat, pointing to the ferry" },
  ] satisfies [SceneIllustrationCharacterPrompt, SceneIllustrationCharacterPrompt],
};

async function upload(request: APIRequestContext, chatId: string, prompt: string, buffer: Buffer) {
  const response = await request.post(`/api/gallery/${chatId}/upload`, {
    multipart: { prompt, file: { name: "harbor.png", mimeType: "image/png", buffer } },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as ChatImage;
}

async function openChat(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
  await page.goto("/");
}

async function openGalleryImage(drawer: Locator, prompt: string) {
  const tile = drawer.getByRole("button", { name: "Open gallery image", exact: true }).filter({
    has: drawer.page().getByRole("img", { name: prompt, exact: true }),
  });
  await tile.click();
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  const directory = process.env.MARINARA_IMAGE_REGEN_SCREENSHOT_DIR;
  const filename = `${info.project.name}-${name}.png`;
  await page.screenshot({
    path: directory ? join(directory, filename) : info.outputPath(filename),
    animations: "disabled",
  });
}

test("gallery regeneration preserves structured prompts and can revise, generate, or retry independently", async ({
  page,
  request,
}, info) => {
  test.setTimeout(90_000);
  const response = await request.post("/api/chats", {
    data: { name: "Harbor at dusk", mode: "roleplay", characterIds: [], connectionId: "synthetic" },
  });
  expect(response.ok()).toBeTruthy();
  const { id: chatId } = (await response.json()) as { id: string };

  try {
    const png = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#164e63" } })
      .png()
      .toBuffer();
    const displayPrompt = `${original.prompt} | ${original.characterPrompts.map(({ prompt }) => prompt).join(" | ")}`;
    const legacy = await upload(request, chatId, "Legacy harbor | unstructured text", png);
    const image = await upload(request, chatId, displayPrompt, png);

    // Uploads have no generation record. Use the real gallery rows and files with one saved request added.
    await page.route(`**/api/gallery/${chatId}`, async (route) => {
      const response = await route.fetch();
      const rows = (await response.json()) as ChatImage[];
      await route.fulfill({
        response,
        json: rows.map((row) =>
          row.id === image.id ? { ...row, generation: JSON.stringify(buildChatImageGenerationRecord(original)) } : row,
        ),
      });
    });

    const requests: { action: "revise" | "generate"; body: unknown }[] = [];
    let failImage = false;
    let generatedPrompt = "";
    const regeneratePath = `**/api/gallery/${chatId}/images/${image.id}/regenerate`;
    await page.route(`${regeneratePath}/prompt`, async (route) => {
      requests.push({ action: "revise", body: route.request().postDataJSON() });
      await route.fulfill({ json: revised });
    });
    await page.route(regeneratePath, async (route) => {
      const body = route.request().postDataJSON() as typeof original;
      requests.push({ action: "generate", body });
      if (failImage) {
        await route.fulfill({ status: 502, json: { error: "Image provider unavailable" } });
        return;
      }
      const returnedPrompt = `${body.prompt} (synced)`;
      generatedPrompt = returnedPrompt;
      await route.fulfill({
        json: {
          image: {
            ...image,
            prompt: returnedPrompt,
            generation: JSON.stringify(buildChatImageGenerationRecord({ ...body, prompt: returnedPrompt })),
          },
          replacedMessageIds: [],
          replacedKeyframeIds: [],
        },
      });
    });

    await openChat(page, chatId);
    const drawer = await openChatSettingsTool(page, "gallery");
    const dialog = page.getByRole("dialog", { name: "Image preview", exact: true });
    const regenerate = dialog.getByRole("button", { name: "Regenerate image", exact: true });

    await openGalleryImage(drawer, legacy.prompt);
    await expect(dialog.getByText(legacy.prompt, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Copy Negative prompt", exact: true })).toHaveCount(0);
    await regenerate.click();
    await expect(dialog.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(legacy.prompt);
    await page.route(`**/api/gallery/${chatId}/images/${legacy.id}/regenerate/prompt`, async (route) => {
      expect(route.request().postDataJSON().characterPrompts).toEqual([]);
      await route.fulfill({ json: { ...revised, characterPrompts: [revised.characterPrompts[0]] } });
    });
    await dialog.getByRole("button", { name: "Revise prompt", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Mira prompt", exact: true })).toHaveValue(
      revised.characterPrompts[0].prompt,
    );
    await dialog.getByRole("button", { name: "Close image", exact: true }).click();

    await openGalleryImage(drawer, displayPrompt);
    for (const text of [
      original.prompt,
      original.negativePrompt,
      "Mira prompt",
      "Mira negative prompt",
      original.characterPrompts[0]!.prompt,
      original.characterPrompts[0]!.negativePrompt!,
      "Jules prompt",
      original.characterPrompts[1]!.prompt,
    ]) {
      await expect(dialog.getByText(text, { exact: true })).toBeVisible();
    }
    await expect(dialog.getByText(displayPrompt, { exact: true })).toHaveCount(0);

    const preview = dialog.getByRole("img");
    const copyPrompt = dialog.getByRole("button", { name: "Copy Positive prompt", exact: true });
    await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(640);
    await expect
      .poll(async () => {
        const image = await preview.boundingBox();
        const copy = await copyPrompt.boundingBox();
        return !!image && !!copy && copy.y >= image.y + image.height - 1;
      })
      .toBe(true);
    await screenshot(page, info, "structured-viewer");

    await regenerate.click();
    const prompt = dialog.getByRole("textbox", { name: "Prompt", exact: true });
    const negative = dialog.getByRole("textbox", { name: "Negative prompt", exact: true });
    const mira = dialog.getByRole("textbox", { name: "Mira prompt", exact: true });
    const miraNegative = dialog.getByRole("textbox", { name: "Mira negative prompt", exact: true });
    const jules = dialog.getByRole("textbox", { name: "Jules prompt", exact: true });
    const guidance = dialog.getByRole("textbox", { name: "AI guidance (optional)", exact: true });
    const revise = dialog.getByRole("button", { name: "Revise prompt", exact: true });
    const generate = dialog.getByRole("button", { name: "Generate image", exact: true });
    const combined = dialog.getByRole("button", { name: "Revise & generate", exact: true });
    const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
    await expect(generate).toBeVisible();
    await expect(combined).toHaveCount(0);
    await expect(prompt).toHaveValue(original.prompt);
    await expect(negative).toHaveValue(original.negativePrompt);
    await expect(mira).toHaveValue(original.characterPrompts[0]!.prompt);
    await expect(miraNegative).toHaveValue(original.characterPrompts[0]!.negativePrompt!);

    const backgrounds = [];
    const themes = [
      ["default", "light"],
      ["default", "dark"],
      ["sillytavern", "light"],
      ["sillytavern", "dark"],
    ] as const;
    for (const [visualTheme, theme] of themes) {
      await page.evaluate(
        async ({ visualTheme, theme }) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
          useUIStore.getState().setVisualTheme(visualTheme);
        },
        { visualTheme, theme },
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      if (visualTheme === "default") {
        await expect(page.locator("html")).not.toHaveAttribute("data-visual-theme");
        backgrounds.push(await prompt.evaluate((field) => getComputedStyle(field).backgroundColor));
      } else {
        await expect(page.locator("html")).toHaveAttribute("data-visual-theme", visualTheme);
      }
      await screenshot(page, info, `editor-${visualTheme}-${theme}`);
    }
    expect(backgrounds[0]).not.toBe(backgrounds[1]);

    await prompt.fill("Manual harbor edit");
    const placement = dialog.getByRole("group", { name: "Mira placement (NovelAI)", exact: true });
    const xPosition = placement.getByRole("textbox", { name: "X (0 left, 1 right)", exact: true });
    const yPosition = placement.getByRole("textbox", { name: "Y (0 top, 1 bottom)", exact: true });
    // A placement needs both axes: clearing one keeps the other, and one alone never invents the other.
    await xPosition.fill("");
    await xPosition.blur();
    await expect(yPosition).toHaveValue("0.5");
    const julesPlacement = dialog.getByRole("group", { name: "Jules placement (NovelAI)", exact: true });
    const julesX = julesPlacement.getByRole("textbox", { name: "X (0 left, 1 right)", exact: true });
    await julesX.fill("0.7");
    await julesX.blur();
    await expect(julesPlacement.getByRole("textbox", { name: "Y (0 top, 1 bottom)", exact: true })).toHaveValue("");
    const halfPlaced = julesPlacement.getByText(
      "Set both X and Y to place Jules. Until then, placement stays automatic.",
    );
    await expect(halfPlaced).toBeVisible();
    await julesX.fill("");
    await julesX.blur();
    await expect(halfPlaced).toBeHidden();
    await xPosition.fill("0.8");
    await xPosition.blur();
    await yPosition.fill("0.65");
    await yPosition.blur();
    await generate.click();
    await expect(prompt).toHaveValue("Manual harbor edit (synced)");
    await cancel.click();
    await expect(regenerate).toBeVisible();
    expect(requests).toEqual([
      {
        action: "generate",
        body: expect.objectContaining({
          ...original,
          prompt: "Manual harbor edit",
          characterPrompts: [
            { ...original.characterPrompts[0], position: { x: 0.8, y: 0.65 } },
            original.characterPrompts[1],
          ],
        }),
      },
    ]);
    expect(generatedPrompt).toBe("Manual harbor edit (synced)");

    await dialog.getByRole("button", { name: "Close image", exact: true }).click();
    await openGalleryImage(drawer, displayPrompt);
    await regenerate.click();
    await revise.click();
    await expect(prompt).toHaveValue(revised.prompt);
    await expect(negative).toHaveValue(revised.negativePrompt);
    await expect(mira).toHaveValue(revised.characterPrompts[0]!.prompt);
    await expect(miraNegative).toHaveValue(revised.characterPrompts[0]!.negativePrompt!);
    await expect(jules).toHaveValue(revised.characterPrompts[1]!.prompt);
    expect(requests.slice(1)).toEqual([
      { action: "revise", body: expect.objectContaining({ ...original, guidance: "" }) },
    ]);
    await dialog.getByRole("button", { name: "Reset Mira negative prompt to original", exact: true }).click();
    await expect(miraNegative).toHaveValue(original.characterPrompts[0]!.negativePrompt!);
    await expect(mira).toHaveValue(revised.characterPrompts[0]!.prompt);
    await expect(prompt).toHaveValue(revised.prompt);

    await prompt.fill("Harbor sketch, low angle");
    await guidance.fill("Change the scene to sunrise and make Mira's coat yellow.");
    await expect(combined).toBeVisible();
    await expect(generate).toHaveCount(0);
    failImage = true;
    await combined.click();
    await expect(dialog.getByRole("alert")).toContainText("Image provider unavailable");
    await expect(prompt).toHaveValue(revised.prompt);
    await expect(miraNegative).toHaveValue(revised.characterPrompts[0]!.negativePrompt!);
    await expect(generate).toBeVisible();
    expect(requests.slice(2)).toEqual([
      {
        action: "revise",
        body: expect.objectContaining({
          ...revised,
          prompt: "Harbor sketch, low angle",
          guidance: "Change the scene to sunrise and make Mira's coat yellow.",
          characterPrompts: [
            { ...revised.characterPrompts[0], negativePrompt: "hood up" },
            revised.characterPrompts[1],
          ],
        }),
      },
      { action: "generate", body: expect.objectContaining(revised) },
    ]);

    failImage = false;
    await generate.click();
    await expect(prompt).toHaveValue(`${revised.prompt} (synced)`);
    await cancel.click();
    await expect(regenerate).toBeVisible();
    expect(requests.slice(4)).toEqual([{ action: "generate", body: expect.objectContaining(revised) }]);
    expect(generatedPrompt).toBe(`${revised.prompt} (synced)`);
    await expect(dialog.getByText(`${revised.prompt} (synced)`, { exact: true })).toBeVisible();
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

test("novelai edit mode supports img2img, painted mask infill, seed reuse, and stays open on edit", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const response = await request.post("/api/chats", {
    data: { name: "NovelAI harbor", mode: "roleplay", characterIds: [], connectionId: "synthetic" },
  });
  expect(response.ok()).toBeTruthy();
  const { id: chatId } = (await response.json()) as { id: string };

  try {
    const png = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#164e63" } })
      .png()
      .toBuffer();
    const recordInput = {
      prompt: "1girl, harbor at dusk",
      negativePrompt: "lowres",
      connectionId: "nai-edit-e2e",
      seed: 424242,
    };
    const image = await upload(request, chatId, recordInput.prompt, png);

    await page.route("**/api/connections", (route) =>
      route.fulfill({
        json: [
          {
            id: "nai-edit-e2e",
            name: "NovelAI E2E",
            provider: "image_generation",
            baseUrl: "https://image.novelai.net",
            imageService: "novelai",
            model: "nai-diffusion-5-full",
            defaultForAgents: true,
          },
        ],
      }),
    );

    await page.route(`**/api/gallery/${chatId}`, async (route) => {
      const upstream = await route.fetch();
      const rows = (await upstream.json()) as ChatImage[];
      await route.fulfill({
        response: upstream,
        json: rows.map((row) =>
          row.id === image.id
            ? { ...row, generation: JSON.stringify(buildChatImageGenerationRecord(recordInput)) }
            : row,
        ),
      });
    });

    const editRequests: Array<Record<string, unknown>> = [];
    await page.route(`**/api/gallery/${chatId}/images/${image.id}/regenerate`, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      editRequests.push(body);
      const syncedPrompt = `${String(body.prompt ?? "")} (step ${editRequests.length})`;
      await route.fulfill({
        json: {
          image: {
            ...image,
            prompt: syncedPrompt,
            generation: JSON.stringify(
              buildChatImageGenerationRecord({
                prompt: syncedPrompt,
                negativePrompt: String(body.negativePrompt ?? ""),
                connectionId: "nai-edit-e2e",
                seed: 424242,
              }),
            ),
          },
          replacedMessageIds: [],
          replacedKeyframeIds: [],
        },
      });
    });

    await openChat(page, chatId);
    const drawer = await openChatSettingsTool(page, "gallery");
    const dialog = page.getByRole("dialog", { name: "Image preview", exact: true });
    await openGalleryImage(drawer, image.prompt);
    await dialog.getByRole("button", { name: "Regenerate image", exact: true }).click();

    const editModeBtn = dialog.getByRole("button", { name: "Edit image", exact: true });
    await expect(editModeBtn).toBeVisible();
    await editModeBtn.click();

    const maskCanvas = dialog.getByLabel("Inpainting mask brush canvas");
    await expect(maskCanvas).toBeVisible();
    const invertBtn = dialog.getByRole("button", { name: "Invert mask", exact: true });
    await expect(invertBtn).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /Reuse original seed/ }).check();

    const applyEdit = dialog.getByRole("button", { name: "Apply edit", exact: true });
    await applyEdit.click();

    const promptField = dialog.getByRole("textbox", { name: "Prompt", exact: true });
    await expect(promptField).toHaveValue("1girl, harbor at dusk (step 1)");
    expect(editRequests[0]).toEqual(
      expect.objectContaining({
        editMode: "img2img",
        strength: 0.7,
        noise: 0,
        reuseSeed: true,
        connectionId: "nai-edit-e2e",
      }),
    );

    const box = await maskCanvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.6, { steps: 5 });
    await page.mouse.up();

    await expect(invertBtn).toBeEnabled();
    await invertBtn.click();

    const inpaintBtn = dialog.getByRole("button", { name: "Inpaint image", exact: true });
    await expect(inpaintBtn).toBeVisible();
    await inpaintBtn.click();
    await expect(promptField).toHaveValue("1girl, harbor at dusk (step 1) (step 2)");
    expect(editRequests[1]).toEqual(
      expect.objectContaining({
        editMode: "infill",
        strength: 1,
        connectionId: "nai-edit-e2e",
      }),
    );
    expect(String(editRequests[1]?.maskImage ?? "")).toMatch(/^data:image\/png;base64,/);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});
