import { clickTopbarPanel } from "./topbar-navigation.js";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

test("sheet uploads persist on refresh without saving unrelated card drafts", async ({ page, request }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript(
    (version: string) => localStorage.setItem("marinara:whats-new:seen-version", version),
    JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version,
  );
  const name = "Immediate sheet save";
  const response = await request.post("/api/characters", {
    data: { data: { name, description: "Saved description", extensions: { talkativeness: 0.25, fav: true } } },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const character = (await response.json()) as { id: string };
  const path = `/api/characters/${character.id}`;
  const file = {
    name: "sheet.webp",
    mimeType: "image/webp",
    buffer: readFileSync(new URL("../packages/client/public/sprites/mari/safari/pose-greet.webp", import.meta.url)),
  };
  const saved = async () => JSON.parse((await (await request.get(path)).json()).data);
  const editor = page.locator(".mari-editor-shell");
  const section = editor
    .getByRole("heading", { name: "Character Sheet", exact: true })
    .locator("xpath=ancestor::section[1]");
  const save = editor.locator(".mari-editor-action--save");
  const title = editor.locator(".mari-editor-title-input");
  const dialogs: string[] = [];
  const patches: Array<{ data: Record<string, unknown> }> = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.type());
    void dialog.accept();
  });
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname === path) patches.push(request.postDataJSON());
  });
  const open = async () => {
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openCharacterDetail(id, { initialTab: "sprites" });
    }, character.id);
    await expect(section).toBeVisible();
    await section.getByRole("button", { name: "Manage", exact: true }).click();
  };
  try {
    await page.goto("/");
    await open();
    await section.locator('input[type="file"]').setInputFiles(file);
    await expect.poll(async () => (await saved()).extensions.characterSheetImageId).toEqual(expect.any(String));
    const firstId = (await saved()).extensions.characterSheetImageId;
    await expect(section.getByAltText(`${name} character sheet`, { exact: true })).toBeVisible();
    await expect(save).toBeDisabled();
    await page.reload();
    expect(dialogs).toEqual([]);
    await open();
    await expect(section.getByAltText(`${name} character sheet`, { exact: true })).toBeVisible();
    expect((await saved()).extensions.characterSheetImageId).toBe(firstId);
    const reference = section.getByRole("checkbox", { name: "Use character sheet" });
    await expect(reference).toBeEnabled();
    await reference.locator("..").click();
    await expect.poll(async () => (await saved()).extensions.useCharacterSheetAsReference).toBe(true);
    await expect(save).toBeDisabled();

    await title.fill(`${name} draft`);
    await section.locator('input[type="file"]').setInputFiles({ ...file, name: "replacement.webp" });
    await expect.poll(async () => (await saved()).extensions.characterSheetImageId).not.toBe(firstId);
    await expect(title).toHaveValue(`${name} draft`);
    expect((await saved()).name).toBe(name);
    expect((await saved()).extensions).toMatchObject({ talkativeness: 0.25, fav: true });
    await expect(save).toBeEnabled();
    expect(patches).toHaveLength(3);
    for (const patch of patches) expect(Object.keys(patch.data)).toEqual(["extensions"]);
    expect(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(true);

    await page.route(`**${path}`, async (route) => {
      if (route.request().method() === "PATCH")
        await route.fulfill({ status: 500, json: { error: "Sheet save rejected" } });
      else await route.continue();
    });
    await reference.locator("..").click();
    await expect(page.getByText("Sheet save rejected", { exact: true })).toBeVisible();
    await expect(reference).toBeChecked();
    expect((await saved()).extensions.useCharacterSheetAsReference).toBe(true);
    await expect(title).toHaveValue(`${name} draft`);
    await page.unroute(`**${path}`);

    await save.click();
    await expect(save).toBeDisabled();
    await expect.poll(async () => (await saved()).name).toBe(`${name} draft`);
    await section.getByRole("button", { name: "Remove character sheet", exact: true }).click();
    await expect.poll(async () => (await saved()).extensions.characterSheetImageId).toBeNull();
    expect((await saved()).extensions.useCharacterSheetAsReference).toBe(false);
    await expect(save).toBeDisabled();
    await page.reload();
    expect(dialogs).toEqual([]);
    await open();
    await expect(section.getByRole("button", { name: "Open full image", exact: true })).toHaveCount(0);
  } finally {
    await page.unroute(`**${path}`);
    await request.delete(path);
  }
});

test("applied character sheets use the avatar Full image presentation", async ({ page, request }, testInfo) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript(
    (version: string) => localStorage.setItem("marinara:whats-new:seen-version", version),
    JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version,
  );
  const avatarPath = "/api/avatars/file/full-image-presentation.png";
  const characterResponse = await request.post("/api/characters", {
    data: { avatarPath, data: { name: "Full image presentation" } },
  });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string; data: string };
  try {
    const upload = await request.post(`/api/characters/${character.id}/gallery/upload`, {
      multipart: {
        file: {
          name: "sheet.webp",
          mimeType: "image/webp",
          buffer: readFileSync(
            new URL("../packages/client/public/sprites/mari/safari/pose-greet.webp", import.meta.url),
          ),
        },
      },
    });
    expect(upload.ok(), await upload.text()).toBeTruthy();
    const sheet = (await upload.json()) as { id: string; url: string };
    const update = await request.patch(`/api/characters/${character.id}`, {
      data: { data: { ...JSON.parse(character.data), extensions: { characterSheetImageId: sheet.id } } },
    });
    expect(update.ok(), await update.text()).toBeTruthy();
    for (const url of [avatarPath, sheet.url]) {
      await page.route(`**${url}`, (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800"><rect width="1200" height="1800" fill="#526679"/><rect x="8" y="8" width="1184" height="1784" fill="none" stroke="#efdecc" stroke-width="16"/><circle cx="600" cy="900" r="400" fill="#b5c9c4"/></svg>',
        }),
      );
    }
    await page.goto("/");
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openCharacterDetail(id);
    }, character.id);
    const editor = page.locator(".mari-editor-shell");
    await editor.getByRole("button", { name: "Full", exact: true }).click();
    const preview = page.getByRole("dialog", { name: "Image preview", exact: true });
    await expect(preview).toBeVisible();
    await expect
      .poll(() => preview.locator("img").evaluate((image: HTMLImageElement) => image.naturalHeight))
      .toBe(1800);
    const avatarBounds = await preview.locator("img").boundingBox();
    expect(avatarBounds).not.toBeNull();
    const viewport = page.viewportSize()!;
    expect(avatarBounds!.height).toBeCloseTo(Math.min(viewport.height * 0.85, viewport.width * 0.9 * 1.5), 0);
    await page.keyboard.press("Escape");
    const sections = editor.getByRole("button", { name: "Editor sections", exact: true });
    if (await sections.isVisible()) {
      await sections.click();
      await editor.getByRole("menuitemradio", { name: "Sprites", exact: true }).click();
    } else {
      await editor
        .getByRole("navigation", { name: "Editor sections" })
        .getByRole("button", { name: "Sprites", exact: true })
        .click();
    }
    await editor.getByRole("button", { name: "Open full image", exact: true }).click();
    await expect(preview).toBeVisible();
    await expect
      .poll(() => preview.locator("img").evaluate((image: HTMLImageElement) => image.naturalHeight))
      .toBe(1800);
    expect(await preview.locator("img").boundingBox()).toEqual(avatarBounds);
    await expect(preview.locator(".mari-modal-panel")).toHaveCount(0);
    await expect(preview.getByRole("heading")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("sheet-full-image.png"), animations: "disabled" });
    await preview.getByRole("button", { name: "Close image", exact: true }).click();
    await expect(preview).toBeHidden();
  } finally {
    await request.delete(`/api/characters/${character.id}`);
  }
});

test("library portraits keep their proportions in compact and full layouts", async ({ page, request }, testInfo) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
  });
  await page.addInitScript(
    (version: string) => {
      localStorage.setItem("marinara:home:widget-visibility:v2", JSON.stringify(["character-library", "recent"]));
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version,
  );
  const avatarPath = "/api/avatars/file/portrait-proportions.png";
  await page.route(`**${avatarPath}`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="400" viewBox="0 0 240 400" preserveAspectRatio="none"><rect width="240" height="400" fill="#526679"/><circle cx="120" cy="100" r="70" fill="#e2b78b"/><path d="M40 400V250Q120 160 200 250V400" fill="#b5c9c4"/><path d="M0 200H240M120 0V400" stroke="#efdecc" stroke-width="2"/></svg>',
    }),
  );
  const response = await request.post("/api/characters", {
    data: {
      avatarPath,
      data: {
        name: "Portrait proportions",
        description: "A portrait with a circular face and a saved square crop.",
        extensions: { avatarCrop: { srcX: 0, srcY: 0, srcWidth: 1, srcHeight: 0.6 } },
      },
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const character = (await response.json()) as { id: string };
  let chatId: string | undefined;
  try {
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Portrait rendering", mode: "roleplay", characterIds: [character.id] },
    });
    expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
    chatId = ((await chatResponse.json()) as { id: string }).id;
    await page.goto("/");
    for (const layout of ["compact", "full"]) {
      if (layout === "full") {
        await clickTopbarPanel(page, "characters");
        await page.getByRole("button", { name: "Open Library", exact: true }).click();
      }
      const card = page.locator(`[data-card-library-card="${character.id}"]`).filter({ visible: true }).first();
      const portrait = card.locator("img");
      await expect(portrait).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(240);
      const geometry = await portrait.evaluate((img: HTMLImageElement) => {
        const bounds = img.getBoundingClientRect();
        return {
          fit: getComputedStyle(img).objectFit,
          renderedRatio: bounds.width / bounds.height,
          sourceRatio: img.naturalWidth / img.naturalHeight,
        };
      });
      expect(
        geometry.fit !== "fill" || Math.abs(geometry.renderedRatio - geometry.sourceRatio) < 0.01,
        `${layout} portrait must use proportional fitting or an undistorted image box: ${JSON.stringify(geometry)}`,
      ).toBe(true);
      if (!testInfo.project.name.includes("mobile")) {
        const before = await portrait.boundingBox();
        await card.hover();
        await card.evaluate((element) =>
          Promise.allSettled(
            element
              .getAnimations({ subtree: true })
              .filter((animation) => animation instanceof CSSTransition)
              .map((animation) => animation.finished),
          ),
        );
        expect(await portrait.boundingBox(), "hover must not rescale or move the portrait").toEqual(before);
      }
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate(async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        }, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        if (layout === "compact") {
          const surface = page.locator('[data-home-widget-id="character-library"] > :not([data-home-drag-handle])');
          await expect(surface).toHaveCSS("filter", "none");
          await expect(surface).toHaveCSS("transform", "none");
        }
        await page.screenshot({ path: testInfo.outputPath(`${layout}-${theme}.png`), animations: "disabled" });
      }
      if (layout === "compact") {
        const recent = page.locator("[data-recent-chat-index]").filter({ hasText: "Portrait rendering" });
        await expect(recent).toBeVisible();
        await recent.scrollIntoViewIfNeeded();
        const recentPortrait = recent.locator("img");
        const before = await recentPortrait.boundingBox();
        if (!testInfo.project.name.includes("mobile")) {
          await recent.hover();
          await expect(recent).toHaveCSS("translate", "none");
          await expect(page.locator('[data-home-widget-id="recent"] > :not([data-home-drag-handle])')).toHaveCSS(
            "filter",
            "none",
          );
          expect(await recentPortrait.boundingBox()).toEqual(before);
        }
      }
    }
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    await request.delete(`/api/characters/${character.id}`);
  }
});

test("avatar crop handles stay whole and draggable on a square image", async ({ page, request }, testInfo) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
  });
  await page.addInitScript(
    (version: string) => localStorage.setItem("marinara:whats-new:seen-version", version),
    JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version,
  );
  const avatarPath = "/api/avatars/file/square-crop-handles.png";
  await page.route(`**${avatarPath}`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#526679"/><circle cx="512" cy="420" r="260" fill="#e2b78b"/></svg>',
    }),
  );
  const response = await request.post("/api/characters", {
    data: { avatarPath, data: { name: "Square crop handles" } },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const character = (await response.json()) as { id: string };
  try {
    await page.goto("/");
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openCharacterDetail(id);
    }, character.id);
    const frame = page.locator("[data-avatar-crop-frame]");
    await expect(frame).toBeVisible();
    await frame.evaluate((element) => element.scrollIntoView({ block: "center" }));

    // A square image starts with the crop on every image edge, where the handles were cut to a sliver (#7323).
    for (const pos of ["tl", "tr", "bl", "br"] as const) {
      const handle = page.locator(`[data-avatar-crop-handle="${pos}"]`);
      const visible = await handle.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const corners: [number, number][] = [
          [bounds.left + 1, bounds.top + 1],
          [bounds.right - 1, bounds.top + 1],
          [bounds.left + 1, bounds.bottom - 1],
          [bounds.right - 1, bounds.bottom - 1],
        ];
        return {
          size: Math.min(bounds.width, bounds.height),
          cornersOnTop: corners.map(([x, y]) => document.elementFromPoint(x, y) === element),
        };
      });
      expect(visible.size, `${pos} handle size`).toBeGreaterThanOrEqual(16);
      expect(visible.cornersOnTop, `${pos} handle must be whole and on top`).toEqual([true, true, true, true]);
    }

    // The handles' touch targets reach past the image; on a phone they must not make the editor scroll sideways.
    const sidewaysScroller = () =>
      frame.evaluate((element) => {
        for (let node = element.parentElement; node; node = node.parentElement) {
          const scrolls = /auto|scroll/.test(getComputedStyle(node).overflowX);
          if (scrolls && node.scrollWidth > node.clientWidth) {
            return `${node.className} ${node.scrollWidth}>${node.clientWidth}`;
          }
        }
        return null;
      });
    expect(await sidewaysScroller(), "the crop widget must not make the editor scroll sideways").toBeNull();

    // Linux WebKit's wider font metrics made the Convo Insertion select exceed the content width.
    // Keep that source of overflow covered on local browsers too, without clipping the crop handles.
    await page.addStyleTag({ content: ".mari-editor-content select { font-family: Verdana, sans-serif; }" });
    expect(await sidewaysScroller(), "wide dropdown options must not make the editor scroll sideways").toBeNull();
    // The changed font can reflow content and move the grip below the phone viewport.
    await frame.evaluate((element) => element.scrollIntoView({ block: "center" }));

    // Grab the outer edge of the bottom-right handle, the part that used to be clipped, and shrink the crop.
    const before = await frame.boundingBox();
    const grip = await page.locator('[data-avatar-crop-handle="br"]').boundingBox();
    expect(before && grip).toBeTruthy();
    await page.mouse.move(grip!.x + grip!.width - 2, grip!.y + grip!.height - 2);
    await page.mouse.down();
    await page.mouse.move(grip!.x - 80, grip!.y - 80, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await frame.boundingBox())?.width ?? 0).toBeLessThan(before!.width - 60);
    await page.screenshot({ path: testInfo.outputPath("square-crop-handles.png"), animations: "disabled" });
  } finally {
    await request.delete(`/api/characters/${character.id}`);
  }
});
