import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";
import { buildChatImageGenerationRecord, type SceneIllustrationCharacterPrompt } from "@marinara-engine/shared";
import type { ChatImage } from "../packages/client/src/hooks/use-gallery.js";
import { openChatSettingsTool, closeChatSettings } from "./chat-settings-tools.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
const requireServer = createRequire(new URL("../packages/server/package.json", import.meta.url));
const sharp = requireServer("sharp");

for (const owner of ["character", "persona"] as const) {
  test(`${owner} gallery edits retain prompts and require explicit avatar selection`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(90_000);
    const collection = owner === "persona" ? "/api/characters/personas" : "/api/characters";
    const fields = { name: `Quick edit ${owner}` };
    const created = await request.post(collection, { data: owner === "character" ? { data: fields } : fields });
    expect(created.ok(), await created.text()).toBeTruthy();
    const { id } = (await created.json()) as { id: string };
    const path = `${collection}/${id}`;
    try {
      const png = await sharp({ create: { width: 320, height: 480, channels: 3, background: "#164e63" } })
        .png()
        .toBuffer();
      const rows: ChatImage[] = [];
      for (const prompt of ["Portrait before editing", "Portrait after editing"]) {
        const uploaded = await request.post(`${path}/gallery/upload`, {
          multipart: { prompt, file: { name: "portrait.png", mimeType: "image/png", buffer: png } },
        });
        expect(uploaded.ok()).toBeTruthy();
        rows.push(await uploaded.json());
      }
      const [source, result] = rows as [ChatImage, ChatImage];
      const generation = (prompt: string) =>
        JSON.stringify(
          buildChatImageGenerationRecord({
            prompt,
            connectionId: "entity-nai-e2e",
            negativePrompt: "lowres",
            seed: 123,
          }),
        );
      source.generation = generation(source.prompt);
      result.generation = generation(result.prompt);
      expect((await request.post(`${path}/gallery/${source.id}/avatar`)).ok()).toBeTruthy();
      const before = await (await request.get(path)).json();
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await page.route("**/api/connections", (route) =>
        route.fulfill({
          json: [
            {
              id: "entity-nai-e2e",
              name: "NovelAI test",
              provider: "image_generation",
              imageService: "novelai",
              baseUrl: "https://image.novelai.net",
              model: "nai-diffusion-5-full",
              defaultForAgents: true,
            },
          ],
        }),
      );
      source.variantGroupId = result.variantGroupId = `entity-stack-${id}`;
      source.variantSelected = 1;
      result.variantSelected = 0;
      let galleryRows = [source];
      await page.route(`**${path}/gallery`, (route) => route.fulfill({ json: galleryRows }));
      await page.route(`**${path}/gallery/*/select`, async (route) => {
        const selectedId = route.request().url().split("/").at(-2);
        galleryRows = galleryRows.map((row) => ({ ...row, variantSelected: row.id === selectedId ? 1 : 0 }));
        await route.fulfill({ json: galleryRows.find((row) => row.id === selectedId) });
      });
      const edits: Record<string, unknown>[] = [];
      await page.route(`**${path}/gallery/${source.id}/regenerate`, async (route) => {
        edits.push(route.request().postDataJSON());
        source.variantSelected = 0;
        result.variantSelected = 1;
        galleryRows = [source, result];
        await route.fulfill({ json: result });
      });
      await page.route(`**${path}/avatar/edit-source`, (route) =>
        route.fulfill({ json: { ...source, prompt: "", generation: null } }),
      );
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        rightPanelOpen: false,
        sidebarOpen: false,
        appAccentPulseMode: false,
      });
      await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
      await page.goto("/");
      const openEditor = async (tab: string) => {
        await page.evaluate(
          async ({ owner, id, tab }) => {
            const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
            if (owner === "persona") useUIStore.getState().openPersonaDetail(id, { initialTab: tab });
            else useUIStore.getState().openCharacterDetail(id, { initialTab: tab });
          },
          { owner, id, tab },
        );
      };
      await openEditor("gallery");
      await page.locator(".mari-editor-shell").getByRole("img", { name: source.prompt, exact: true }).click();
      const viewer = page.getByRole("dialog", { name: "Image preview", exact: true });
      await expect(viewer.getByText(source.prompt, { exact: true })).toHaveCount(0);
      await viewer.getByRole("button", { name: "Expand panel", exact: true }).click();
      await expect(viewer.getByText(source.prompt, { exact: true })).toBeVisible();
      if (owner === "character") {
        for (const visualTheme of ["default", "sillytavern"] as const) {
          for (const theme of ["light", "dark"] as const) {
            await page.evaluate(
              async ({ visualTheme, theme }) => {
                const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
                useUIStore.getState().setVisualTheme(visualTheme);
                useUIStore.getState().setTheme(theme);
              },
              { visualTheme, theme },
            );
            await page.screenshot({
              path: testInfo.outputPath(`entity-gallery-${visualTheme}-${theme}.png`),
              animations: "disabled",
            });
          }
        }
      }
      await viewer.getByRole("button", { name: "Regenerate image", exact: true }).click();
      await expect(viewer.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(source.prompt);
      await viewer.getByRole("button", { name: "Edit image", exact: true }).click();
      await expect(viewer.getByLabel("Inpainting mask brush canvas")).toBeVisible();
      await page.evaluate(async () => {
        const { queryClient } = await import("/src/lib/query-client.ts" as string);
        const { characterKeys } = await import("/src/hooks/use-characters.ts" as string);
        queryClient.setQueryData(characterKeys.galleryBackgrounds(), []);
      });
      await viewer.getByRole("button", { name: "Apply edit", exact: true }).click();
      await expect.poll(() => edits.length).toBe(1);
      expect(edits[0]).toMatchObject({ prompt: source.prompt, editMode: "img2img", connectionId: "entity-nai-e2e" });
      await expect(viewer.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(result.prompt);
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { queryClient } = await import("/src/lib/query-client.ts" as string);
            const { characterKeys } = await import("/src/hooks/use-characters.ts" as string);
            return queryClient.getQueryState(characterKeys.galleryBackgrounds())?.isInvalidated;
          }),
        )
        .toBe(owner === "character");
      await expect(viewer.getByText("Version 2 of 2", { exact: true })).toBeVisible();
      await expect(viewer.getByRole("button", { name: "Previous image version", exact: true })).toBeEnabled();
      await viewer.getByRole("button", { name: "Previous image version", exact: true }).click();
      await expect(viewer.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(source.prompt);
      await viewer.getByRole("button", { name: "Next image version", exact: true }).click();
      await expect(viewer.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(result.prompt);
      const unchanged = await (await request.get(path)).json();
      expect(unchanged.avatarPath).toBe(before.avatarPath);
      await page.keyboard.press("Escape");
      await screenshot(page, testInfo, `${owner}-version-stack`);
      const applied = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" && response.url().endsWith(`${path}/gallery/${result.id}/avatar`),
      );
      await viewer.getByRole("button", { name: "Use as avatar", exact: true }).click();
      expect((await applied).ok()).toBeTruthy();
      await expect.poll(async () => (await (await request.get(path)).json()).avatarPath).not.toBe(before.avatarPath);
      await viewer.getByRole("button", { name: "Close image", exact: true }).click();
      await openEditor("metadata");
      await page.locator(".mari-editor-shell").getByRole("button", { name: "Go to Gallery", exact: true }).click();
      await expect(
        page.locator(".mari-editor-shell").getByRole("img", { name: result.prompt, exact: true }),
      ).toBeVisible();
      await expect(page.locator(".mari-editor-shell").getByLabel("2 versions", { exact: true })).toBeVisible();
      await screenshot(page, testInfo, `${owner}-stack-tile`);
      await openEditor("metadata");
      // Avatar editing lives in Metadata; the initial preview cannot reapply an unchanged image.
      const editAvatar = page.locator(".mari-editor-shell").getByRole("button", { name: "Edit avatar", exact: true });
      await expect(editAvatar).toHaveCount(1);
      await editAvatar.click();
      await expect(viewer.getByRole("button", { name: "Use as avatar", exact: true })).toHaveCount(0);
      await viewer.getByRole("button", { name: "Regenerate image", exact: true }).click();
      const promptField = viewer.getByRole("textbox", { name: "Prompt", exact: true });
      await expect(promptField).toHaveValue("");
      await promptField.fill(source.prompt);
      await viewer.getByRole("button", { name: "Edit image", exact: true }).click();
      await viewer.getByRole("button", { name: "Apply edit", exact: true }).click();
      await expect.poll(() => edits.length).toBe(2);
      await expect(promptField).toHaveValue(result.prompt);
      // Apply the saved result directly from the open editor, without Cancel or another upload.
      await expect(viewer.getByRole("button", { name: "Use as avatar", exact: true })).toBeVisible();
      await expect
        .poll(() => viewer.getByRole("img").evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBe(320);
      const applyButton = await viewer.getByRole("button", { name: "Use as avatar", exact: true }).boundingBox();
      const previewBounds = await viewer.getByRole("img").boundingBox();
      const editPanelBounds = await viewer
        .getByRole("heading", { name: "Regenerate image", exact: true })
        .boundingBox();
      expect(applyButton && previewBounds && editPanelBounds).toBeTruthy();
      expect(previewBounds!.height).toBeGreaterThan(40);
      expect(applyButton!.y).toBeGreaterThanOrEqual(previewBounds!.y + previewBounds!.height);
      expect(applyButton!.y + applyButton!.height).toBeLessThanOrEqual(editPanelBounds!.y);
      const editButtonBounds = await viewer.getByRole("button", { name: "Apply edit", exact: true }).boundingBox();
      expect(editButtonBounds!.y + editButtonBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      await page.screenshot({ path: testInfo.outputPath("avatar-result-apply.png"), animations: "disabled" });
      const avatarApplied = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" && response.url().endsWith(`${path}/gallery/${result.id}/avatar`),
      );
      await viewer.getByRole("button", { name: "Use as avatar", exact: true }).click();
      expect((await avatarApplied).ok()).toBeTruthy();
      await expect(viewer).toHaveCount(0);
      expect(await (await request.get(`${path}/gallery`)).json()).toHaveLength(2);
    } finally {
      await request.delete(path);
    }
  });
}

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
    editLastMessageOnArrowUp: true,
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

async function watchBackgroundMessageEdits(page: Page) {
  await page.evaluate(() => {
    document.body.dataset.imageViewerMessageEdits = "0";
    window.addEventListener("marinara:start-edit-message", () => {
      document.body.dataset.imageViewerMessageEdits = String(Number(document.body.dataset.imageViewerMessageEdits) + 1);
    });
  });
}

test("chat image version stacks keep two navigation axes and persist the selected result", async ({
  page,
  request,
  browserName,
  isMobile,
}, info) => {
  test.setTimeout(120_000);
  const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#164e63" } })
    .png()
    .toBuffer();
  const provider = createServer(async (incoming, outgoing) => {
    for await (const _chunk of incoming) {
      /* consume the request before replying */
    }
    outgoing.writeHead(200, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }));
  });
  let cleanupConnectionId: string | undefined;
  let cleanupChatId: string | undefined;
  try {
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    const address = provider.address() as { port: number };
    const connectionResponse = await request.post("/api/connections", {
      data: {
        name: "Version stack fixture",
        provider: "image_generation",
        imageGenerationSource: "openai",
        imageService: "openai",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "fixture",
        model: "dall-e-3",
      },
    });
    expect(connectionResponse.ok(), await connectionResponse.text()).toBeTruthy();
    const connection = (await connectionResponse.json()) as { id: string };
    cleanupConnectionId = connection.id;
    const created = await request.post("/api/chats", {
      data: { name: "Image version stacks", mode: "roleplay", characterIds: [] },
    });
    expect(created.ok()).toBeTruthy();
    const { id: chatId } = (await created.json()) as { id: string };
    cleanupChatId = chatId;
    const other = await upload(request, chatId, "Separate gallery picture", png);
    const original = await upload(request, chatId, "First stack version", png);
    const messageResponse = await request.post(`/api/chats/${chatId}/messages`, {
      data: {
        role: "assistant",
        content: "A picture with saved alternatives.",
        extra: { attachments: [{ type: "image", galleryId: original.id, url: original.url }] },
      },
    });
    expect(messageResponse.ok(), await messageResponse.text()).toBeTruthy();
    const savedMessage = (await messageResponse.json()) as { id: string };
    const generate = async (prompt: string) => {
      const result = await request.post(`/api/gallery/${chatId}/images/${original.id}/regenerate`, {
        data: {
          prompt,
          connectionId: connection.id,
          negativePrompt: Array.from({ length: 35 }, (_, index) => `Saved negative prompt line ${index}`).join("\n"),
        },
      });
      expect(result.ok(), await result.text()).toBeTruthy();
      return (await result.json()).image as ChatImage;
    };
    const second = await generate("Second stack version");
    const third = await generate("Third stack version");
    await openChat(page, chatId);
    await watchBackgroundMessageEdits(page);
    let drawer = await openChatSettingsTool(page, "gallery");
    await expect(drawer.getByRole("button", { name: "Open gallery image", exact: true })).toHaveCount(2);
    await closeChatSettings(page);
    await page.locator("[data-message-id]").getByRole("img", { name: "image", exact: true }).first().click();
    const messageViewer = page.getByRole("dialog", { name: "Image preview", exact: true });
    await expect(messageViewer.getByText("Version 3 of 3", { exact: true })).toBeVisible();
    await expect(messageViewer.getByRole("button", { name: "Next image", exact: true })).toHaveCount(0);
    await expect(messageViewer.getByRole("button", { name: "Previous image", exact: true })).toHaveCount(0);
    await screenshot(page, info, "message-single-stack");
    await messageViewer.getByRole("button", { name: "Close image", exact: true }).click();
    const reopenedDrawer = await openChatSettingsTool(page, "gallery");
    await openGalleryImage(reopenedDrawer, third.prompt);
    const dialog = page.getByRole("dialog", { name: "Image preview", exact: true });
    const position = (n: number) => dialog.getByText(`Version ${n} of 3`, { exact: true });
    await expect(position(3)).toBeVisible();
    // The prompt panel opens collapsed; the prompt checks below need its text.
    await dialog.getByRole("button", { name: "Expand panel", exact: true }).click();
    await dialog.getByRole("button", { name: "Previous image version", exact: true }).click();
    await expect(position(2)).toBeVisible();
    const rows = async () => (await request.get(`/api/gallery/${chatId}`)).json() as Promise<ChatImage[]>;
    await expect.poll(async () => (await rows()).find((row) => row.variantSelected === 1)?.id).toBe(second.id);
    await page.route(
      `**/api/gallery/${chatId}/images/${original.id}/select`,
      (route) => route.fulfill({ status: 503, json: { error: "Version selection unavailable" } }),
      { times: 1 },
    );
    await dialog.getByRole("button", { name: "Previous image version", exact: true }).click();
    await expect(page.getByText("Version selection unavailable", { exact: true })).toBeVisible();
    await expect(position(2)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Regenerate image", exact: true })).toBeEnabled();
    await page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "Version selection unavailable" })
      .getByRole("button")
      .click();
    await expect(page.getByText("Version selection unavailable", { exact: true })).toBeHidden();
    await page.keyboard.press("ArrowDown");
    await expect(position(3)).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await expect(position(2)).toBeVisible();
    const nextGallery = dialog.getByRole("button", { name: "Next image", exact: true });
    const forward = await nextGallery.isEnabled();
    await page.keyboard.press(forward ? "ArrowRight" : "ArrowLeft");
    await expect(dialog.getByText(other.prompt, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Previous image version", exact: true })).toHaveCount(0);
    await page.keyboard.press(forward ? "ArrowLeft" : "ArrowRight");
    await expect(position(2)).toBeVisible();

    if (isMobile && browserName === "chromium") {
      const picture = dialog.locator("img").first();
      const rect = await picture.boundingBox();
      expect(rect).not.toBeNull();
      const touch = await page.context().newCDPSession(page);
      try {
        const x = rect!.x + rect!.width / 3;
        const y = rect!.y + rect!.height / 2;
        await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - 80 }] });
        await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await expect(position(3)).toBeVisible();
        await page.keyboard.press("ArrowUp");
        await expect(position(2)).toBeVisible();
      } finally {
        await touch.detach();
      }
    }
    await page.keyboard.press("+");
    await expect(dialog.getByRole("button", { name: "Next image version", exact: true })).toBeDisabled();
    await page.keyboard.press("ArrowDown");
    await expect(position(2)).toBeVisible();
    await page.keyboard.press("0");
    await expect(dialog.getByRole("button", { name: "Next image version", exact: true })).toBeEnabled();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("Exercise clipboard fallback")) },
      });
    });
    const copyPrompt = dialog.getByRole("button", { name: "Copy Positive prompt", exact: true });
    await copyPrompt.click();
    await expect(page.locator("[data-sonner-toast]")).toBeVisible();
    await expect(copyPrompt).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(position(2)).toBeVisible();
    const scrollPrompt = dialog.locator("[data-image-viewer-scroll]");
    await expect.poll(() => scrollPrompt.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press("ArrowUp");
    await expect.poll(() => scrollPrompt.evaluate((element) => element.scrollTop)).toBe(0);
    await dialog.getByRole("button", { name: "Collapse panel", exact: true }).click();
    await page.keyboard.press("ArrowUp");
    await expect(position(1)).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(position(2)).toBeVisible();
    await dialog.getByRole("button", { name: "Expand panel", exact: true }).click();
    await page.keyboard.press("ArrowUp");
    await expect(position(1)).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(position(2)).toBeVisible();
    await dialog.getByRole("heading", { name: "Prompt", exact: true }).click();
    await page.keyboard.press("ArrowUp");
    await expect(position(1)).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(position(2)).toBeVisible();
    await dialog.getByText(second.prompt, { exact: true }).click();
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => scrollPrompt.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await dialog.locator("img").first().click();
    await page.keyboard.press("ArrowUp");
    await expect(position(1)).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(position(2)).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-image-viewer-message-edits", "0");
    for (const closeToast of await page.locator("[data-sonner-toast] [data-close-button]").all())
      await closeToast.click();
    await dialog.getByRole("button", { name: "Close image", exact: true }).focus();
    const previousVersion = dialog.getByRole("button", { name: "Previous image version", exact: true });
    const nextVersion = dialog.getByRole("button", { name: "Next image version", exact: true });
    await expect
      .poll(async () => {
        const up = await previousVersion.boundingBox();
        const down = await nextVersion.boundingBox();
        const left = await dialog.getByRole("button", { name: "Previous image", exact: true }).boundingBox();
        const right = await dialog.getByRole("button", { name: "Next image", exact: true }).boundingBox();
        const picture = await dialog.locator("img").first().boundingBox();
        if (!up || !down || !left || !right || !picture) return false;
        const cx = (rect: { x: number; width: number }) => rect.x + rect.width / 2;
        return (
          Math.abs(cx(up) - cx(down)) < 1 &&
          Math.abs(cx(up) - (cx(left) + cx(right)) / 2) < 1 &&
          up.y + up.height <= picture.y + 1 &&
          down.y >= picture.y + picture.height - 1
        );
      })
      .toBe(true);
    const normalViewport = page.viewportSize()!;
    await page.setViewportSize({ width: normalViewport.width, height: 390 });
    await expect
      .poll(async () => (await dialog.locator("img").first().boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(64);
    await expect
      .poll(async () => {
        const down = await nextVersion.boundingBox();
        const caption = await dialog.locator("[data-image-viewer-caption]").boundingBox();
        const filmstrip = await dialog.getByRole("button", { name: "Show image 1", exact: true }).boundingBox();
        return (
          !!down &&
          !!caption &&
          !!filmstrip &&
          down.y + down.height <= caption.y + 1 &&
          filmstrip.y + filmstrip.height <= 390
        );
      })
      .toBe(true);
    await screenshot(page, info, "stack-short-viewport");
    await page.setViewportSize(normalViewport);
    for (const [visualTheme, theme] of [
      ["default", "light"],
      ["default", "dark"],
      ["sillytavern", "light"],
      ["sillytavern", "dark"],
    ] as const) {
      await page.evaluate(
        async ({ visualTheme, theme }) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
          useUIStore.getState().setVisualTheme(visualTheme);
        },
        { visualTheme, theme },
      );
      await screenshot(page, info, `stack-${visualTheme}-${theme}`);
    }
    await page.reload();
    await watchBackgroundMessageEdits(page);
    drawer = await openChatSettingsTool(page, "gallery");
    await openGalleryImage(drawer, second.prompt);
    await expect(position(2)).toBeVisible();
    const messageRows = await (await request.get(`/api/chats/${chatId}/messages`)).json();
    const savedExtra = messageRows.find((row: { id: string }) => row.id === savedMessage.id).extra;
    const attachments = (typeof savedExtra === "string" ? JSON.parse(savedExtra) : savedExtra).attachments;
    expect(attachments[0].galleryId).toBe(second.id);
    await dialog.getByRole("button", { name: "Delete image?", exact: true }).click();
    const chooser = page.getByRole("dialog", { name: "Delete image?", exact: true });
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("body")).toHaveAttribute("data-image-viewer-message-edits", "0");
    await screenshot(page, info, "stack-delete-chooser");
    await chooser.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await rows()).toHaveLength(4);
    await dialog.getByRole("button", { name: "Delete image?", exact: true }).click();
    const fourth = await generate("Fourth stack version");
    await chooser.getByRole("button", { name: /Delete other version/ }).click();
    await expect(
      page.getByText("The saved versions changed. Reopen the delete dialog to review them.", { exact: true }),
    ).toBeVisible();
    await expect(chooser).toHaveCount(0);
    expect(await rows()).toHaveLength(5);
    await dialog.getByRole("button", { name: "Delete image?", exact: true }).click();
    await chooser.getByRole("button", { name: /Delete this version/ }).click();
    await expect(dialog.getByText("Version 3 of 3", { exact: true })).toBeVisible();
    await expect.poll(async () => (await rows()).find((row) => row.variantSelected === 1)?.id).toBe(fourth.id);
    await dialog.getByRole("button", { name: "Delete image?", exact: true }).click();
    await chooser.getByRole("button", { name: /Delete other version/ }).click();
    await expect(dialog.getByRole("button", { name: "Previous image version", exact: true })).toHaveCount(0);
    await expect.poll(async () => (await rows()).length).toBe(2);
    await dialog.getByRole("button", { name: "Regenerate image", exact: true }).click();
    const editPrompt = dialog.getByRole("textbox", { name: "Prompt", exact: true });
    await editPrompt.fill("");
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("body")).toHaveAttribute("data-image-viewer-message-edits", "0");
    await editPrompt.fill("Fifth stack version");
    await dialog.getByRole("button", { name: "Generate image", exact: true }).click();
    await expect(dialog.getByText("Version 2 of 2", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Previous image version", exact: true }).click();
    await expect(editPrompt).toHaveValue("Fourth stack version");
    await dialog.getByRole("heading", { name: "Regenerate image", exact: true }).click();
    await page.keyboard.press("ArrowDown");
    await expect(editPrompt).toHaveValue("Fifth stack version");
    await screenshot(page, info, "stack-regeneration-controls");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.getByRole("button", { name: "Close image", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Open gallery image", exact: true })).toHaveCount(2);
  } finally {
    if (cleanupChatId) await request.delete(`/api/chats/${cleanupChatId}`).catch(() => {});
    if (cleanupConnectionId) await request.delete(`/api/connections/${cleanupConnectionId}`).catch(() => {});
    provider.closeAllConnections();
    if (provider.listening)
      await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
  }
});

test("gallery navigation remains usable after the first image fails to load", async ({ page, request }) => {
  const created = await request.post("/api/chats", {
    data: { name: "Failed gallery image", mode: "roleplay", characterIds: [], connectionId: "synthetic" },
  });
  expect(created.ok()).toBeTruthy();
  const { id: chatId } = (await created.json()) as { id: string };
  try {
    const png = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#164e63" } })
      .png()
      .toBuffer();
    const broken = await upload(request, chatId, "Broken first picture", png);
    const loaded = await upload(request, chatId, "Loaded second picture", png);
    await page.route(`**/api/gallery/${chatId}`, (route) => route.fulfill({ json: [broken, loaded] }));
    await page.route(`**${broken.url}`, (route) => route.abort());
    await openChat(page, chatId);
    const drawer = await openChatSettingsTool(page, "gallery");
    await openGalleryImage(drawer, broken.prompt);
    const viewer = page.getByRole("dialog", { name: "Image preview", exact: true });
    await expect
      .poll(() => viewer.getByRole("img").evaluate((image: HTMLImageElement) => image.complete && !image.naturalWidth))
      .toBe(true);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 640, height: 360 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(async () => {
          const toolbar = await viewer
            .getByRole("button", { name: "Close image", exact: true })
            .locator("..")
            .boundingBox();
          const next = await viewer.getByRole("button", { name: "Next image", exact: true }).boundingBox();
          return (
            !!toolbar && !!next && toolbar.y + toolbar.height + 15 <= next.y && next.y + next.height <= viewport.height
          );
        })
        .toBe(true);
    }
    await viewer.getByRole("button", { name: "Next image", exact: true }).click();
    await expect
      .poll(() => viewer.getByRole("img").evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(640);
    await expect
      .poll(async () => {
        const image = await viewer.getByRole("img").boundingBox();
        const next = await viewer.getByRole("button", { name: "Next image", exact: true }).boundingBox();
        return !!image && !!next && Math.abs(next.x - image.x - image.width - 16) <= 1;
      })
      .toBe(true);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

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
    await expect(dialog.getByText(legacy.prompt, { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Expand panel", exact: true }).click();
    await expect(dialog.getByText(legacy.prompt, { exact: true })).toBeVisible();
    const originalViewport = page.viewportSize();
    const originalFontSize = await page.evaluate(() => {
      const previous = document.documentElement.style.fontSize;
      document.documentElement.style.fontSize = "20px";
      return previous;
    });
    try {
      for (const viewport of [
        { width: 1600, height: 900 },
        { width: 390, height: 844 },
        { width: 640, height: 360 },
      ]) {
        await page.setViewportSize(viewport);
        await expect
          .poll(async () => {
            const imageBounds = await dialog.getByRole("img").first().boundingBox();
            const toolbarBounds = await dialog
              .getByRole("button", { name: "Close image", exact: true })
              .locator("..")
              .boundingBox();
            const previousBounds = await dialog
              .getByRole("button", { name: "Previous image", exact: true })
              .boundingBox();
            const nextBounds = await dialog.getByRole("button", { name: "Next image", exact: true }).boundingBox();
            if (!imageBounds || !toolbarBounds || !previousBounds || !nextBounds) return false;
            const right = imageBounds.x + imageBounds.width;
            return (
              Math.abs(toolbarBounds.x - right - 16) <= 1 &&
              Math.abs(nextBounds.x - right - 16) <= 1 &&
              Math.abs(imageBounds.x - (previousBounds.x + previousBounds.width) - 16) <= 1 &&
              toolbarBounds.y + toolbarBounds.height + 15 <= nextBounds.y &&
              Math.abs(previousBounds.y - nextBounds.y) <= 1 &&
              toolbarBounds.x + toolbarBounds.width <= viewport.width &&
              nextBounds.y + nextBounds.height <= viewport.height
            );
          })
          .toBe(true);
      }
    } finally {
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, originalFontSize);
      if (originalViewport) await page.setViewportSize(originalViewport);
    }
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
    await expect(dialog.getByText(original.prompt, { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Expand panel", exact: true }).click();
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
    await expect(dialog.getByText(`${revised.prompt} (synced)`, { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Expand panel", exact: true }).click();
    await expect(dialog.getByText(`${revised.prompt} (synced)`, { exact: true })).toBeVisible();
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

test("novelai edit mode supports img2img, painted mask infill, seed reuse, and stays open on edit", async ({
  page,
  request,
}, info) => {
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
    await upload(request, chatId, "Earlier NovelAI result", png);
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
        json: rows.map((row) => ({
          ...row,
          variantGroupId: image.id,
          variantSelected: row.id === image.id ? 1 : 0,
          ...(row.id === image.id && { generation: JSON.stringify(buildChatImageGenerationRecord(recordInput)) }),
        })),
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
            variantGroupId: image.id,
            variantSelected: 1,
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
    const previousVersion = dialog.getByRole("button", { name: "Previous image version", exact: true });
    await expect(previousVersion).toBeEnabled();
    await expect(dialog.getByText("Img2Img", { exact: true })).toBeVisible();
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

    await expect(applyEdit).toBeEnabled();
    await expect(maskCanvas).toHaveClass(/\bcursor-crosshair\b/);
    await expect.poll(() => maskCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBe(640);
    await maskCanvas.scrollIntoViewIfNeeded();
    // Hover waits for layout and any success toast to settle before measuring the paint target.
    await maskCanvas.hover({ position: { x: 20, y: 20 } });
    const box = await maskCanvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.6, { steps: 5 });
    await page.mouse.up();

    await expect(dialog.getByText("Inpainting mask active", { exact: true })).toBeVisible();
    await expect(previousVersion).toBeDisabled();
    await expect(invertBtn).toBeEnabled();
    await invertBtn.click();

    const inpaintBtn = dialog.getByRole("button", { name: "Inpaint image", exact: true });
    await expect(inpaintBtn).toBeVisible();
    await inpaintBtn.click();
    await expect(promptField).toHaveValue("1girl, harbor at dusk (step 1) (step 2)");
    await expect(previousVersion).toBeEnabled();
    expect(editRequests[1]).toEqual(
      expect.objectContaining({
        editMode: "infill",
        strength: 1,
        connectionId: "nai-edit-e2e",
      }),
    );
    expect(String(editRequests[1]?.maskImage ?? "")).toMatch(/^data:image\/png;base64,/);
    await screenshot(page, info, "stack-inpainting-controls");
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});
