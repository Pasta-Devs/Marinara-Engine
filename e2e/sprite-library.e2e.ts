import { expect, test, request as createRequest, type CDPSession } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

async function dispatchTouch(
  session: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
  ...touchPoints: { x: number; y: number }[]
) {
  await session.send("Input.dispatchTouchEvent", { type, touchPoints });
}

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAMCAYAAABfnvydAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFklEQVQYlWPo6en5jw8zjCr4T6dwAACTCf0hFZvtCQAAAABJRU5ErkJggg==",
  "base64",
);

test("sprite metadata stays optional and folder moves work without dragging", async ({ page, request }, info) => {
  test.setTimeout(90_000);
  await isolateSyncedUISettings(page);
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.addInitScript(
    (appVersion) => localStorage.setItem("marinara:whats-new:seen-version", appVersion),
    version,
  );
  const rejectedDirectory = info.outputPath("rejected-import");
  const emptyDirectory = info.outputPath("empty-import");
  mkdirSync(rejectedDirectory, { recursive: true });
  mkdirSync(emptyDirectory, { recursive: true });
  writeFileSync(`${rejectedDirectory}/rejected.png`, png);
  writeFileSync(`${emptyDirectory}/notes.txt`, "No images");
  for (const persona of [false, true]) {
    const ownersPath = persona ? "/api/characters/personas" : "/api/characters";
    const created = await request.post(ownersPath, {
      data: persona ? { name: "Persona folder proof" } : { data: { name: "Character folder proof" } },
    });
    expect(created.ok()).toBeTruthy();
    const owner = await created.json();
    const path = `/api/sprites/${owner.id}`;
    try {
      const folderResponse = await request.post(path + "/folders", {
        data: { name: "Front", category: "expressions" },
      });
      expect(folderResponse.ok()).toBeTruthy();
      const folderId = (await folderResponse.json()).folders[0].id;
      for (const expression of ["happy", "sad"])
        expect(
          (
            await request.post(path, {
              data: {
                expression,
                image: `data:image/png;base64,${png.toString("base64")}`,
                folderId: expression === "happy" ? folderId : null,
              },
            })
          ).ok(),
        ).toBeTruthy();
      let metadata: "failed" | "orphan" | "ok" = "failed";
      await page.route(`**${path}/catalog`, async (route) => {
        if (route.request().method() !== "GET" || metadata === "ok") return route.continue();
        if (metadata === "failed")
          return route.fulfill({ status: 503, json: { error: "Folder information unavailable" } });
        const catalog = await (await request.get(path + "/catalog")).json();
        return route.fulfill({ json: { ...catalog, folders: [] } });
      });
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        characterDetailId: persona ? null : owner.id,
        personaDetailId: persona ? owner.id : null,
        sidebarOpen: false,
        rightPanelOpen: false,
      });
      const openSprites = async () => {
        await page.goto("/");
        const sections = page.getByRole("button", { name: "Editor sections", exact: true });
        await expect(sections.or(page.getByRole("button", { name: "Sprites", exact: true })).first()).toBeVisible({
          timeout: 45000,
        });
        if (await sections.isVisible()) {
          await sections.click();
          await page.getByRole("menuitemradio", { name: "Sprites", exact: true }).click();
        } else await page.getByRole("button", { name: "Sprites", exact: true }).click();
      };
      const library = page.locator("[data-sprite-library]");
      for (const unavailable of ["failed", "orphan"] as const) {
        metadata = unavailable;
        await openSprites();
        await expect(library.locator("[data-sprite-expression]")).toHaveCount(2);
        await library.getByRole("button", { name: "Select", exact: true }).click();
        await library.getByRole("button", { name: "Select all sprites", exact: true }).click();
        await expect(library.getByRole("checkbox", { checked: true })).toHaveCount(2);
      }
      metadata = "ok";
      await openSprites();
      const moving = persona
        ? library.getByRole("button", { name: "Move sprite", exact: true })
        : library.getByRole("button", { name: "Preview sad", exact: true });
      await moving.press("Enter");
      const dialog = page.getByRole("dialog").last();
      const folder = dialog.getByRole("combobox", { name: "Folder", exact: true });
      await expect(folder).toBeEnabled();
      await folder.selectOption({ label: "Front" }, { timeout: 10000 });
      await expect
        .poll(
          async () =>
            (await (await request.get(path)).json()).find(
              (sprite: { expression: string }) => sprite.expression === "sad",
            ).folderId,
        )
        .toBe(folderId);
      await folder.selectOption("unfiled");
      await expect
        .poll(
          async () =>
            (await (await request.get(path)).json()).find(
              (sprite: { expression: string }) => sprite.expression === "sad",
            ).folderId,
        )
        .toBeNull();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await library.getByRole("searchbox").fill("missing");
      await expect(library.getByText("No sprites match this search.", { exact: true })).toBeVisible();
      await library.getByRole("searchbox").fill("sad");
      if (persona) {
        await library.getByRole("button", { name: "Delete", exact: true }).press("Enter");
        await page
          .getByRole("dialog")
          .last()
          .getByRole("button", { name: /^Delete All Expressions$/iu })
          .click();
        await expect.poll(async () => (await (await request.get(path)).json()).length).toBe(0);
      }
      await page.route(`**${path}`, (route) =>
        route.request().method() === "POST"
          ? route.fulfill({ status: 409, json: { error: "The label already exists" } })
          : route.continue(),
      );
      await library.locator("input[webkitdirectory]").setInputFiles(rejectedDirectory);
      await expect(
        page.locator('[data-sonner-toast][data-type="error"]').filter({ hasText: "The label already exists" }),
      ).toBeVisible();
      await library.locator("input[webkitdirectory]").setInputFiles(emptyDirectory);
      await expect(
        page
          .locator('[data-sonner-toast][data-type="warning"]')
          .filter({ hasText: "No supported sprite images were found." }),
      ).toBeVisible();
    } finally {
      await page.unroute(`**${path}/catalog`).catch(() => undefined);
      await page.unroute(`**${path}`).catch(() => undefined);
      const deleted = await request.delete(`${ownersPath}/${owner.id}`).catch(() => null);
      expect.soft(deleted?.ok()).toBeTruthy();
    }
  }
});

test("sprite details, folders and bulk tools keep their intended scope", async ({
  page,
  request,
  baseURL,
  browserName,
}, info) => {
  // WebKit's native scrolling/stability checks make this full editing flow slower on Windows.
  test.setTimeout(browserName === "webkit" ? 300_000 : 180_000);
  const desktop = !info.project.use.isMobile;
  const touchChromium = Boolean(info.project.use.isMobile) && browserName === "chromium";
  if (browserName === "webkit")
    info.annotations.push({
      type: "coverage",
      description:
        "Core sprite UI and folder editing; native hold-to-drag is exercised through Chromium CDP and remains a physical Safari check.",
    });
  const cleanup = await createRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: new URL(baseURL!).origin } });
  const created = await request.post("/api/characters", {
    data: { data: { name: "Sprite library UI proof", first_mes: "" } },
  });
  expect(created.ok()).toBeTruthy();
  const owner = await created.json();
  const path = `/api/sprites/${owner.id}`;
  const catalog = async () => (await request.get(`${path}/catalog`)).json();
  async function expectFolder(expression: string, folderId: string | null) {
    await expect
      .poll(
        async () =>
          (await catalog()).sprites.find((sprite: { expression: string }) => sprite.expression === expression)
            ?.folderId,
      )
      .toBe(folderId);
  }
  const errors: string[] = [];
  let releaseFrameSave = () => {};
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    for (const name of ["Front", "Alternate"])
      expect((await request.post(`${path}/folders`, { data: { name, category: "full-body" } })).ok()).toBeTruthy();
    const expressionCatalog = await request.post(path + "/folders", {
      data: { name: "Front", category: "expressions" },
    });
    expect(expressionCatalog.ok()).toBeTruthy();
    const expressionFront = (await expressionCatalog.json()).folders.find(
      (folder: { name: string; category: string }) => folder.name === "Front" && folder.category === "expressions",
    ).id;
    const folders = (await catalog()).folders;
    const front = folders.find((folder: { name: string }) => folder.name === "Front").id;
    const alternate = folders.find((folder: { name: string }) => folder.name === "Alternate").id;
    for (const expression of ["full_idle", "full_wave", "full_happy", "neutral"]) {
      expect(
        (
          await request.post(path, {
            data: {
              expression,
              image: `data:image/png;base64,${png.toString("base64")}`,
              folderId: expression.startsWith("full_") ? front : expressionFront,
            },
          })
        ).ok(),
      ).toBeTruthy();
    }
    expect((await request.patch(`${path}/neutral`, { data: { expression: "pleased" } })).ok()).toBeTruthy();
    await isolateSyncedUISettings(page);
    // This spec covers the Engine's sprite library, independent of installed
    // third-party client modules and their reload/recovery lifecycle.
    await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      characterDetailId: owner.id,
      sidebarOpen: false,
      rightPanelOpen: false,
      appAccentPulseMode: false,
    });
    await page.addInitScript((appVersion) => {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      // Exercise the portable download fallback rather than a native directory picker.
      Object.defineProperty(window, "showDirectoryPicker", { value: undefined, configurable: true });
      Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true });
    }, version);
    await page.goto("/");
    const sections = page.getByRole("button", { name: "Editor sections", exact: true });
    async function openSprites() {
      await expect(page.getByRole("button", { name: "Sprites", exact: true }).or(sections).first()).toBeVisible({
        timeout: 45000,
      });
      if (await sections.isVisible()) {
        await sections.click();
        await page.getByRole("menuitemradio", { name: "Sprites", exact: true }).click();
      } else await page.getByRole("button", { name: "Sprites", exact: true }).click();
    }
    await openSprites();
    const section = page.locator('[data-editor-section="sprites"]');
    const library = section.locator("[data-sprite-library]");
    const frontSection = library.locator(`[data-sprite-folder="${front}"]`);
    await section.getByRole("button", { name: "Full-body", exact: true }).click();
    await expect(frontSection).toBeVisible();
    // Let section navigation settle before opening a menu that closes on page scroll.
    await library.getByRole("button", { name: "Export", exact: true }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await library.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Full-body only", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(frontSection.getByRole("button", { name: "Front", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await library.getByRole("button", { name: "New folder", exact: true }).click();
    const unnamed = library.getByRole("button", { name: "unnamed", exact: true });
    await expect(unnamed).toHaveAttribute("aria-expanded", "false");
    await expect(
      library.locator("[data-sprite-folder]").first().getByRole("button", { name: "unnamed", exact: true }),
    ).toBeVisible();
    await unnamed.focus();
    await page.keyboard.press("F2");
    await library.getByRole("textbox", { name: "Folder name", exact: true }).fill("Test folder");
    await page.keyboard.press("Enter");
    await expect(library.getByRole("button", { name: "Test folder", exact: true })).toBeVisible();
    const testSection = library
      .getByRole("button", { name: "Test folder", exact: true })
      .locator("xpath=ancestor::section[1]");
    const testFolderId = await testSection.getAttribute("data-sprite-folder");
    const folderOrder = () =>
      library
        .locator("[data-sprite-folder]")
        .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-sprite-folder")));
    const testHeader = testSection.getByRole("button", { name: "Test folder", exact: true });
    await testHeader.click();
    const emptyText = testSection.getByText("Drop sprites here to move them into this folder.", { exact: true });
    await expect(emptyText).toBeVisible();

    await emptyText.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const emptyBounds = (await emptyText.boundingBox())!;
    const emptyX = emptyBounds.x + emptyBounds.width / 2;
    const emptyY = emptyBounds.y + emptyBounds.height / 2;
    if (touchChromium) {
      const touch = await page.context().newCDPSession(page);
      await dispatchTouch(touch, "touchStart", { x: emptyX, y: emptyY });
      await page.waitForTimeout(500);
      await expect(testSection).not.toHaveAttribute("data-drag-source");
      await dispatchTouch(touch, "touchCancel");
      await touch.detach();
    } else {
      await page.mouse.move(emptyX, emptyY);
      await page.mouse.down();
      await page.mouse.move(emptyX + 20, emptyY, { steps: 5 });
      await expect(testSection).not.toHaveAttribute("data-drag-source");
      await page.mouse.up();
    }
    await expect(page.locator('body > [data-drag-kind][aria-hidden="true"]')).toHaveCount(0);
    await expect.poll(folderOrder).toEqual([testFolderId, alternate, front]);
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await testHeader.click();
    await expect(testHeader).toHaveAttribute("aria-expanded", "false");
    await frontSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.mouse.move(1, 400);
    await page.waitForTimeout(200);
    const reorderHeader = testSection.locator(":scope > div").first();
    const restingFolderColor = await reorderHeader.evaluate((element) => getComputedStyle(element).backgroundColor);
    const from = (await frontSection.boundingBox())!;
    const to = (await testSection.boundingBox())!;
    if (touchChromium) {
      const touch = await page.context().newCDPSession(page);
      await dispatchTouch(touch, "touchStart", { x: from.x + 60, y: from.y + 20 });
      await expect(frontSection).toHaveAttribute("data-drag-source", "true");
      // Pickup can autoscroll near the viewport edge; locate the destination after the hold.
      const destination = (await testHeader.boundingBox())!;
      const touchTarget = { x: destination.x + 60, y: destination.y + 8 };
      await dispatchTouch(touch, "touchMove", { x: touchTarget.x, y: (from.y + 20 + touchTarget.y) / 2 });
      await dispatchTouch(touch, "touchMove", touchTarget);
      // An insertion gap or edge scrolling can move the row during pickup.
      // Follow its visible top edge rather than releasing at stale coordinates.
      await expect
        .poll(async () => {
          const box = (await testHeader.boundingBox())!;
          await dispatchTouch(touch, "touchMove", { x: box.x + 60, y: box.y + 3 });
          return testSection.getAttribute("data-drag-insert");
        })
        .toBe("before");
      await expect(testSection).toHaveAttribute("data-drag-insert", "before");
      const hoveredHeader = (await reorderHeader.boundingBox())!;
      await dispatchTouch(touch, "touchMove", {
        x: hoveredHeader.x + 60,
        y: hoveredHeader.y + hoveredHeader.height / 4,
      });
      await expect(testSection).not.toHaveAttribute("data-drag-target");
      await expect(reorderHeader).toHaveCSS("background-color", restingFolderColor);

      await dispatchTouch(touch, "touchEnd");
      await touch.detach();
    } else {
      await page.mouse.move(from.x + 60, from.y + 20);
      await page.mouse.down();
      await page.mouse.move(to.x + 60, to.y + 8, { steps: 10 });
      await expect(frontSection).toHaveAttribute("data-drag-source", "true");
      await expect(testSection).toHaveAttribute("data-drag-insert", "before");
      const hoveredHeader = (await reorderHeader.boundingBox())!;
      await page.mouse.move(hoveredHeader.x + 60, hoveredHeader.y + hoveredHeader.height / 4, { steps: 3 });
      await expect(testSection).not.toHaveAttribute("data-drag-target");
      await expect(reorderHeader).toHaveCSS("background-color", restingFolderColor);

      await page.mouse.up();
    }
    await expect.poll(folderOrder).toEqual([front, testFolderId, alternate]);
    await expect
      .poll(async () =>
        (await catalog()).folders
          .filter((folder: { category: string }) => folder.category === "full-body")
          .map((folder: { id: string }) => folder.id)
          .reverse(),
      )
      .toEqual([front, testFolderId, alternate]);
    expect(
      (await catalog()).folders
        .filter((folder: { category: string }) => folder.category === "expressions")
        .map((folder: { id: string }) => folder.id),
    ).toEqual([expressionFront]);
    await expect(frontSection.getByRole("button", { name: "Front", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await frontSection.getByRole("button", { name: "Front", exact: true }).focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect.poll(folderOrder).toEqual([testFolderId, front, alternate]);
    await library
      .getByRole("button", { name: "Test folder", exact: true })
      .locator("xpath=ancestor::section[1]")
      .getByRole("button", { name: "Remove folder", exact: true })
      .click();
    await page.getByRole("dialog").last().getByRole("button", { name: "Remove folder", exact: true }).click();
    await expect.poll(folderOrder).toEqual([front, alternate]);
    await page.reload();
    await openSprites();
    await section.getByRole("button", { name: "Full-body", exact: true }).click();
    await expect.poll(folderOrder).toEqual([front, alternate]);
    await frontSection.getByRole("button", { name: "Front", exact: true }).click();
    await expect(library.locator("[data-sprite-card]")).toHaveCount(3);
    await expect(section.getByRole("button", { name: "Manage", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(library.getByRole("slider")).toHaveCount(0);

    await section.getByRole("button", { name: "Manage", exact: true }).click();
    await expect(section.getByRole("heading", { name: "Character Sheet", exact: true })).toBeVisible();
    await expect(section.getByText("No character sheet selected", { exact: true })).toBeVisible();
    await expect(section.getByRole("checkbox", { name: /Use as reference image/ })).toBeDisabled();
    await section.getByRole("button", { name: "Close", exact: true }).click();
    await library.getByRole("button", { name: "Add sprites", exact: true }).click();
    const addPanel = library.getByRole("region", { name: "Add sprites", exact: true });
    const upload = (await addPanel.getByRole("button", { name: "Upload images", exact: true }).boundingBox())!;
    const importFolder = (await addPanel.getByRole("button", { name: "Import folder", exact: true }).boundingBox())!;
    const generate = (await addPanel.getByRole("button", { name: "Generate Sprite", exact: true }).boundingBox())!;
    if (desktop) {
      expect(Math.abs(upload.y + upload.height / 2 - (importFolder.y + importFolder.height / 2))).toBeLessThan(2);
      expect(Math.abs(generate.y - importFolder.y)).toBeLessThan(2);
    } else {
      expect(upload.y + upload.height).toBeLessThanOrEqual(importFolder.y);
      expect(Math.abs(importFolder.y - generate.y)).toBeLessThan(2);
      expect(Math.abs(importFolder.width - generate.width)).toBeLessThan(2);
    }

    await addPanel.getByRole("button", { name: "Generate Sprite", exact: true }).click();
    const generation = page.getByRole("dialog").last();
    await generation.getByRole("checkbox", { name: /^Match existing expression sprites/ }).check();
    await expect(generation.getByText("pleased", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await library.getByRole("button", { name: "Close", exact: true }).click();

    const looseArea = library.locator("[data-sprite-loose]");
    const looseRestingColor = await looseArea.evaluate((element) => getComputedStyle(element).backgroundColor);
    const looseHint = looseArea.locator("[data-sprite-loose-hint]");
    const hintAppearance = () =>
      looseHint.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const root = element.parentElement!.getBoundingClientRect();
        return {
          text: element.textContent?.trim(),
          font: style.font,
          color: style.color,
          align: style.textAlign,
          padding: style.padding,
          x: box.x - root.x,
          y: box.y - root.y,
          width: box.width,
          height: box.height,
        };
      });
    await page.evaluate(() => document.fonts.ready);
    const restingHintAppearance = await hintAppearance();
    const expectAlignedGrids = async () => {
      const looseTile = looseArea.locator("[data-sprite-expression]").first();
      await expect(looseTile).toBeVisible();
      const filed = (await frontSection.locator("[data-sprite-expression]").first().boundingBox())!;
      const loose = (await looseTile.boundingBox())!;
      expect(Math.abs(filed.x - loose.x)).toBeLessThan(0.5);
      expect(Math.abs(filed.width - loose.width)).toBeLessThan(0.5);
    };

    // Opening or moving a sprite preserves the collection.
    if (touchChromium) {
      const card = frontSection.getByRole("button", { name: "Preview idle", exact: true });
      await card.scrollIntoViewIfNeeded();
      const session = await page.context().newCDPSession(page);
      const tile = card.locator("xpath=ancestor::*[@data-sprite-expression][1]");
      const picture = card.locator("img");
      for (const imageOrigin of [true, false]) {
        await tile.scrollIntoViewIfNeeded();
        const bounds = await (imageOrigin ? picture : tile).boundingBox();
        expect(bounds).not.toBeNull();
        const x = imageOrigin ? bounds!.x + bounds!.width / 2 : bounds!.x + 1;
        const y = imageOrigin ? bounds!.y + bounds!.height / 2 : bounds!.y + bounds!.height - 1;
        await dispatchTouch(session, "touchStart", { x, y });
        await expect(tile).toHaveAttribute("data-drag-source", "true");
        await dispatchTouch(session, "touchCancel");
        await expect(tile).not.toHaveAttribute("data-drag-source");
        // A browser context menu or HTML drag arriving after cancellation still belongs to the touch tile.
        expect(
          await picture.evaluate((element) =>
            element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })),
          ),
        ).toBe(false);
        expect(
          await tile.evaluate((element) =>
            element.dispatchEvent(
              new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }),
            ),
          ),
        ).toBe(false);
        await expect(page.locator("[data-sprite-drag-preview]")).toHaveCount(0);
      }
      // Ordinary taps still open details, and a swipe before the hold timeout scrolls instead of picking up.
      await card.tap();
      await expect(page.getByRole("dialog").last()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await card.scrollIntoViewIfNeeded();
      const swipe = await card.boundingBox();
      const swipeX = swipe!.x + swipe!.width / 2,
        swipeY = swipe!.y + swipe!.height / 2;
      await dispatchTouch(session, "touchStart", { x: swipeX, y: swipeY });
      for (let offset = 20; offset <= 120; offset += 20)
        await dispatchTouch(session, "touchMove", { x: swipeX, y: swipeY - offset });
      await dispatchTouch(session, "touchEnd");
      await expect.poll(async () => (await card.boundingBox())!.y).toBeLessThan(swipe!.y - 15);
      await expect(tile).not.toHaveAttribute("data-drag-source");
      await card.scrollIntoViewIfNeeded();
      let settledY: number | null = null;
      await expect
        .poll(
          async () => {
            const bounds = await card.boundingBox();
            const settled = bounds !== null && settledY !== null && Math.abs(bounds.y - settledY) < 1;
            settledY = bounds?.y ?? null;
            return settled;
          },
          { intervals: [150] },
        )
        .toBe(true);
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      const x = box!.x + box!.width / 2;
      await dispatchTouch(session, "touchStart", { x, y: box!.y + box!.height / 2 });
      await expect(frontSection.locator('[data-drag-source="true"]')).toHaveCount(1);
      await expect(library.getByText("Drop sprites here to move them out of a folder.", { exact: true })).toBeVisible();
      expect(await hintAppearance()).toEqual(restingHintAppearance);
      const loose = library.locator("[data-sprite-loose]");
      await expect(loose).toHaveCSS("border-top-style", "dashed");
      await expect
        .poll(() => loose.evaluate((element) => getComputedStyle(element).backgroundColor))
        .not.toBe(looseRestingColor);
      for (let i = 0; i < 20; i++) {
        const root = await loose.boundingBox();
        if (root && root.y < 660) break;
        await dispatchTouch(session, "touchMove", { x, y: 810 });
        await page.waitForTimeout(150);
      }
      const root = await loose.boundingBox();
      expect(root).not.toBeNull();
      const y = Math.max(20, Math.min(780, root!.y + 25));
      await dispatchTouch(session, "touchMove", { x, y });
      await expect
        .poll(async () => {
          const bounds = (await loose.boundingBox())!;
          const point = { x, y: Math.max(180, Math.min(700, bounds.y + 20)) };
          await dispatchTouch(session, "touchMove", point);
          return page.evaluate(
            ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest("[data-sprite-loose]")),
            point,
          );
        })
        .toBe(true);
      await dispatchTouch(session, "touchEnd");
      await expectFolder("full_idle", null);
      await expectAlignedGrids();
      await frontSection.getByRole("button", { name: "Front", exact: true }).click();
      await expect(frontSection.getByRole("button", { name: "Front", exact: true })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      const looseTile = loose.locator('[data-sprite-expression="full_idle"]');
      await looseTile.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const looseBefore = await loose.boundingBox();
      const looseBox = (await looseTile.boundingBox())!;
      const destination = library.locator(`[data-sprite-folder="${alternate}"]`);
      const destinationHeader = destination.getByRole("button", { name: "Alternate", exact: true });
      const restingColor = await destinationHeader.evaluate(
        (element) => getComputedStyle(element.parentElement!).backgroundColor,
      );
      await dispatchTouch(session, "touchStart", {
        x: looseBox.x + looseBox.width / 2,
        y: looseBox.y + looseBox.height / 2,
      });
      await expect(looseTile).toHaveAttribute("data-drag-source", "true");
      await expect(library.getByText("Drop sprites here to move them out of a folder.", { exact: true })).toHaveCount(
        0,
      );
      await expect(loose).toHaveCSS("border-top-style", "dashed");
      await expect
        .poll(() => loose.evaluate((element) => getComputedStyle(element).backgroundColor))
        .not.toBe(looseRestingColor);
      expect((await loose.boundingBox())!.height).toBeCloseTo(looseBefore!.height, 1);

      const destinationBox = (await destinationHeader.boundingBox())!;
      const destinationPoint = { x: destinationBox.x + 40, y: destinationBox.y + destinationBox.height / 2 };
      await dispatchTouch(session, "touchMove", {
        x: destinationPoint.x,
        y: (looseBox.y + looseBox.height / 2 + destinationPoint.y) / 2,
      });
      await dispatchTouch(session, "touchMove", destinationPoint);
      await expect(destination).toHaveAttribute("data-drag-target", "inside");
      await expect
        .poll(() => destinationHeader.evaluate((element) => getComputedStyle(element.parentElement!).backgroundColor))
        .not.toBe(restingColor);
      await expect(destinationHeader).toHaveAttribute("aria-expanded", "false");

      await dispatchTouch(session, "touchMove", { x: 1, y: 400 });
      await expect(destination).not.toHaveAttribute("data-drag-target");
      const returnBox = (await destinationHeader.boundingBox())!;
      await dispatchTouch(session, "touchMove", { x: returnBox.x + 40, y: returnBox.y + returnBox.height / 2 });
      await expect(destination).toHaveAttribute("data-drag-target", "inside");
      await dispatchTouch(session, "touchEnd");
      await expectFolder("full_idle", alternate);
      await expect(destination).not.toHaveAttribute("data-drag-target");
      await expect(loose).toHaveCSS("background-color", looseRestingColor);
      // Restore this test fixture through the API before the shared editing checks.
      expect(
        (await request.post(path + "/move", { data: { expressions: ["full_idle"], folderId: front } })).ok(),
      ).toBeTruthy();
      await page.reload();
      await openSprites();
      await section.getByRole("button", { name: "Full-body", exact: true }).click();
      await frontSection.getByRole("button", { name: "Front", exact: true }).click();
      await session.detach();
    }

    await frontSection.getByRole("button", { name: "Front", exact: true }).press("Enter");
    await expect(frontSection.getByRole("button", { name: /^Preview / })).toHaveCount(0);
    await frontSection.getByRole("button", { name: "Front", exact: true }).press("Enter");
    await expect(frontSection.locator("[data-sprite-card]")).toHaveCount(3);
    if (desktop) {
      const card = frontSection
        .getByRole("button", { name: "Preview idle", exact: true })
        .locator("xpath=ancestor::*[@data-sprite-card][1]");
      const picture = card.locator("img");
      await expect(picture).toHaveAttribute("draggable", "false");
      await card.scrollIntoViewIfNeeded();
      let previousY: number | null = null;
      await expect
        .poll(
          async () => {
            const box = await card.boundingBox();
            const stable = box !== null && previousY !== null && Math.abs(previousY - box.y) < 1;
            previousY = box?.y ?? null;
            return stable;
          },
          { intervals: [300], timeout: 15000 },
        )
        .toBe(true);
      for (const fromImage of [true, false]) {
        const bounds = await (fromImage ? picture : card).boundingBox();
        expect(bounds).not.toBeNull();
        const x = fromImage ? bounds!.x + bounds!.width / 2 : bounds!.x + 2;
        const y = fromImage ? bounds!.y + bounds!.height / 2 : bounds!.y + bounds!.height - 3;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 25, y + 8, { steps: 5 });
        const preview = page.locator("[data-sprite-drag-preview]");
        await expect(preview).toBeVisible();
        expect(await preview.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
        await expect(preview.locator("[data-sprite-card]")).toBeVisible();
        await expect(looseArea).toHaveCSS("border-top-style", "dashed");
        await expect(
          library.getByText("Drop sprites here to move them out of a folder.", { exact: true }),
        ).toBeVisible();
        expect(await hintAppearance()).toEqual(restingHintAppearance);
        await expect
          .poll(() => looseArea.evaluate((element) => getComputedStyle(element).backgroundColor))
          .not.toBe(looseRestingColor);

        await expect(card).toBeVisible();
        const original = card.locator("xpath=ancestor::*[@draggable][1]");
        await expect(original).toHaveCSS("opacity", "0.5");
        // This checks the preview only; releasing beyond a tile's lower border could move it into the next folder.
        await page.keyboard.press("Escape");
        await page.mouse.up();
        await expect(preview).toHaveCount(0);
        await expect(original).toHaveCSS("opacity", "1");
        await expect(original).toHaveAttribute("draggable", "true");
        await expect(looseArea).toHaveCSS("background-color", looseRestingColor);
      }
      previousY = null;
      await expect
        .poll(
          async () => {
            const box = await card.boundingBox();
            const stable = box !== null && previousY !== null && Math.abs(previousY - box.y) < 1;
            previousY = box?.y ?? null;
            return stable;
          },
          { intervals: [300], timeout: 15000 },
        )
        .toBe(true);
      await frontSection
        .getByRole("button", { name: "Preview idle", exact: true })
        .dragTo(library.locator("[data-sprite-loose]"));
      await expectFolder("full_idle", null);
      await expect(
        library
          .locator("[data-sprite-loose]")
          .getByRole("button", { name: "Preview idle", exact: true })
          .locator("xpath=ancestor::*[@draggable][1]"),
      ).toHaveAttribute("draggable", "true");
      await expectAlignedGrids();
      const looseTile = looseArea.locator('[data-sprite-expression="full_idle"]');
      await looseTile.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const looseBefore = (await looseArea.boundingBox())!;
      const looseBounds = (await looseTile.boundingBox())!;
      await page.mouse.move(looseBounds.x + looseBounds.width / 2, looseBounds.y + looseBounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(looseBounds.x + looseBounds.width / 2 + 25, looseBounds.y + looseBounds.height / 2 + 8, {
        steps: 5,
      });
      await expect(page.locator("[data-sprite-drag-preview]")).toBeVisible();
      await expect(looseArea).toHaveCSS("border-top-style", "dashed");
      await expect
        .poll(() => looseArea.evaluate((element) => getComputedStyle(element).backgroundColor))
        .not.toBe(looseRestingColor);
      await expect(library.getByText("Drop sprites here to move them out of a folder.", { exact: true })).toHaveCount(
        0,
      );
      expect((await looseArea.boundingBox())!.height).toBeCloseTo(looseBefore.height, 1);

      await page.keyboard.press("Escape");
      await page.mouse.up();
      await expect(looseArea).toHaveCSS("background-color", looseRestingColor);
      const transfer = await page.evaluateHandle(
        ({ owner }) => {
          const data = new DataTransfer();
          data.setData(
            "application/x-marinara-sprites",
            JSON.stringify({ ownerId: owner, expressions: ["full_idle"] }),
          );
          return data;
        },
        { owner: owner.id },
      );
      for (const id of [alternate, front]) {
        const destination = library.locator(`[data-sprite-folder="${id}"]`);
        const header = destination.locator(":scope > div").first();
        const restingColor = await header.evaluate((element) => getComputedStyle(element).backgroundColor);
        await header.dispatchEvent("dragover", { dataTransfer: transfer });
        await expect(destination).toHaveAttribute("data-drag-target", "inside");
        await expect
          .poll(() => header.evaluate((element) => getComputedStyle(element).backgroundColor))
          .not.toBe(restingColor);
        await expect(
          destination.getByRole("button", { name: id === alternate ? "Alternate" : "Front", exact: true }),
        ).toHaveAttribute("aria-expanded", id === alternate ? "false" : "true");

        await destination.dispatchEvent("dragleave", { dataTransfer: transfer });
        await expect(destination).not.toHaveAttribute("data-drag-target");
      }
      await transfer.dispose();
      await library
        .locator("[data-sprite-loose]")
        .getByRole("button", { name: "Preview idle", exact: true })
        .dragTo(frontSection.getByRole("button", { name: "Front", exact: true }));
      await expectFolder("full_idle", front);
    }
    await expect(library.getByRole("checkbox", { name: /^Select/ })).toHaveCount(0);
    await library.getByRole("button", { name: "Select", exact: true }).click();
    const selectAll = library.getByRole("button", { name: "Select all sprites", exact: true });
    const deselectAll = library.getByRole("button", { name: "Deselect all sprites", exact: true });
    const cleanupAction = library.getByRole("button", { name: "Clean Backgrounds", exact: true });
    const deleteAction = library.getByRole("button", { name: "Delete selected", exact: true });
    await expect(selectAll).toBeVisible();
    await expect(cleanupAction).toBeDisabled();
    await expect(deleteAction).toBeDisabled();
    const actionPositions = await Promise.all(
      [selectAll, cleanupAction, deleteAction].map((action) => action.boundingBox()),
    );
    await selectAll.click();
    await expect(deselectAll).toBeVisible();
    const selectedPositions = await Promise.all(
      [deselectAll, cleanupAction, deleteAction].map((action) => action.boundingBox()),
    );
    for (let i = 1; i < actionPositions.length; i++) {
      expect(selectedPositions[i]?.x).toBe(actionPositions[i]?.x);
      expect(selectedPositions[i]?.y).toBe(actionPositions[i]?.y);
    }
    await deselectAll.click();
    await expect(selectAll).toBeVisible();
    for (const checkbox of await library.getByRole("checkbox", { name: /^Select .* in / }).all())
      await checkbox.check();
    await expect(deselectAll).toBeVisible();
    await deselectAll.click();
    await library.getByRole("checkbox", { name: "Select idle in Front", exact: true }).check();
    await library.getByRole("button", { name: "Preview idle", exact: true }).click();
    const details = page.getByRole("dialog").last();
    await expect(details.getByRole("button", { name: "Rename", exact: true })).toBeVisible();
    await expect(details.getByRole("button", { name: "Frame", exact: true })).toBeVisible();
    // Delay a real save response: Escape and the editor's own X must not expose
    // replacement/deletion while that save is pending.
    let frameSaveStarted = () => {};
    const frameStarted = new Promise<void>((resolve) => {
      frameSaveStarted = resolve;
    });
    const frameGate = new Promise<void>((resolve) => {
      releaseFrameSave = resolve;
    });
    await page.route(`**${path}`, async (route) => {
      if (route.request().method() !== "POST" || Object.hasOwn(route.request().postDataJSON(), "folderId"))
        return route.continue();
      const response = await route.fetch();
      frameSaveStarted();
      await frameGate;
      await route.fulfill({ response });
    });
    await details.getByRole("button", { name: "Frame", exact: true }).click();
    await details.getByRole("button", { name: "Apply Frame", exact: true }).click();
    await frameStarted;
    await expect(details.getByRole("button", { name: "Close frame editor", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(details.getByRole("button", { name: "Apply Frame", exact: true })).toBeVisible();
    await expect(details.getByRole("button", { name: "Apply Frame", exact: true })).toBeDisabled();
    releaseFrameSave();
    await expect(details.getByRole("button", { name: "Rename", exact: true })).toBeVisible();
    await page.unroute(`**${path}`);
    await details.getByRole("combobox", { name: "Folder", exact: true }).selectOption(alternate);
    await expectFolder("full_idle", alternate);
    await details.getByRole("button", { name: "Delete Sprite", exact: true }).click();
    const singleDelete = page.getByRole("dialog").last();
    await expect(singleDelete.getByRole("button", { name: /Delete (these|selected|all)/i })).toHaveCount(0);
    await singleDelete.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await catalog()).sprites).toHaveLength(4);
    await library
      .locator(`[data-sprite-folder="${alternate}"]`)
      .getByRole("button", { name: "Alternate", exact: true })
      .click();
    await library.getByRole("checkbox", { name: "Select idle in Alternate", exact: true }).uncheck();
    await expect(deleteAction).toBeDisabled();

    await expect(library.locator("[data-sprite-card]")).toHaveCount(3);

    // Every bulk action uses the same explicit selection, not the whole visible grid.
    const select = library.getByRole("checkbox", { name: /^Select .* in / });
    await select.nth(0).check();
    await select.nth(1).check();
    const selectedCards = library.locator("[data-sprite-expression]").filter({ has: page.locator("input:checked") });
    await expect(selectedCards).toHaveCount(2);
    if (desktop) {
      const box = await selectedCards.first().boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      await page.mouse.move(box!.x + box!.width / 2 + 30, box!.y + box!.height / 2 + 10, { steps: 5 });
      const preview = page.locator("[data-sprite-drag-preview]");
      await expect(preview.locator("[data-sprite-card]")).toHaveCount(2);
      await expect(selectedCards.nth(0)).toHaveCSS("opacity", "0.5");
      await expect(selectedCards.nth(1)).toHaveCSS("opacity", "0.5");
      await page.keyboard.press("Escape");
      await expect(preview).toHaveCount(0);
      await expect(selectedCards.nth(0)).toHaveCSS("opacity", "1");
      await expect(selectedCards.nth(1)).toHaveCSS("opacity", "1");
    } else if (touchChromium) {
      const handles = await selectedCards.evaluateAll((tiles) =>
        tiles.map((tile) => tile.getAttribute("data-sprite-expression")),
      );
      await selectedCards.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const bounds = (await selectedCards.first().boundingBox())!;
      const session = await page.context().newCDPSession(page);
      const x = bounds.x + bounds.width / 2;
      await dispatchTouch(session, "touchStart", { x, y: bounds.y + bounds.height / 2 });
      const preview = page.locator('body > [data-drag-kind="sprite"][aria-hidden="true"]');
      await expect(preview.locator("[data-drag-stack-count]")).toHaveText("2");
      await expect(selectedCards.nth(0)).toHaveCSS("opacity", "0.5");
      await expect(selectedCards.nth(1)).toHaveCSS("opacity", "0.5");
      const destination = library
        .locator(`[data-sprite-folder="${alternate}"]`)
        .getByRole("button", { name: "Alternate", exact: true });
      for (let i = 0; i < 20; i++) {
        const target = await destination.boundingBox();
        if (target && target.y < 740) break;
        await dispatchTouch(session, "touchMove", { x, y: 810 });
        await page.waitForTimeout(150);
      }
      const target = (await destination.boundingBox())!;
      await dispatchTouch(session, "touchMove", { x: target.x + 40, y: target.y + target.height / 2 });
      await dispatchTouch(session, "touchEnd");
      await expect
        .poll(
          async () =>
            (await catalog()).sprites.filter(
              (sprite: { expression: string; folderId: string }) =>
                handles.includes(sprite.expression) && sprite.folderId === alternate,
            ).length,
        )
        .toBe(2);
      await expect(preview).toHaveCount(0);
      await session.detach();
    }
    await library.getByRole("button", { name: "Clean Backgrounds", exact: true }).click();
    await expect(library.getByRole("slider", { name: "Cleanup strength", exact: true })).toBeVisible();
    await expect(library.getByRole("button", { name: "Clean 2 sprites", exact: true })).toBeVisible();
    await library
      .getByRole("region", { name: "Clean Backgrounds" })
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(library.getByRole("button", { name: "Export selected", exact: true })).toHaveCount(0);
    await library.getByRole("button", { name: "Delete selected", exact: true }).click();
    const bulkDelete = page.getByRole("dialog").last();
    await expect(bulkDelete.getByText("Delete 2 selected sprites?", { exact: true })).toBeVisible();
    await bulkDelete.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(library.locator("[data-sprite-card]")).toHaveCount(1);
    expect((await catalog()).sprites).toHaveLength(2);
    await expect(deleteAction).toBeDisabled();

    await library.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(library.getByRole("checkbox", { name: /^Select/ })).toHaveCount(0);
    await expect(library.getByRole("button", { name: "Select", exact: true })).toBeVisible();

    // Upload images is a real multi-file picker, with the current type and destination.
    await section.getByRole("button", { name: "Facial Expressions", exact: true }).click();
    await library.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Expressions only", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await library
      .locator(`[data-sprite-folder="${expressionFront}"]`)
      .getByRole("button", { name: "Front", exact: true })
      .click();
    await library.getByRole("button", { name: "Add sprites", exact: true }).click();
    const picker = page.waitForEvent("filechooser");
    await library.getByRole("button", { name: "Upload images", exact: true }).click();
    await (
      await picker
    ).setFiles([
      { name: "smile.png", mimeType: "image/png", buffer: png },
      { name: "sad.png", mimeType: "image/png", buffer: png },
    ]);
    await expect(library.locator("[data-sprite-card]")).toHaveCount(3);
    const saved = await catalog();
    expect(
      saved.sprites.filter(
        (sprite: { label: string; folderId: string | null }) =>
          ["smile", "sad"].includes(sprite.label) && sprite.folderId === null,
      ),
    ).toHaveLength(2);

    await expect(frontSection).toHaveCount(0);
    const expressionSection = library.locator(`[data-sprite-folder="${expressionFront}"]`);
    await expressionSection.getByRole("button", { name: "Front", exact: true }).focus();
    await page.keyboard.press("F2");
    const longName = "x".repeat(100);
    await library.getByRole("textbox", { name: "Folder name", exact: true }).fill(longName);
    await page.keyboard.press("Enter");
    await expect(expressionSection.getByRole("button", { name: longName, exact: true })).toBeVisible();

    expect(await library.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
    await section.getByRole("button", { name: "Full-body", exact: true }).click();
    await expect(library.getByRole("button", { name: "Front", exact: true })).toBeVisible();
    for (const id of [alternate, front]) {
      const folder = library.locator('[data-sprite-folder="' + id + '"]');
      await folder.getByRole("button", { name: "Remove folder", exact: true }).click();
      await page.getByRole("dialog").last().getByRole("button", { name: "Remove folder", exact: true }).click();
      await section.getByRole("button", { name: "Facial Expressions", exact: true }).click();
      await expect(expressionSection).toBeVisible();
      await expect(expressionSection.getByRole("button", { name: longName, exact: true })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expressionSection.getByRole("button", { name: longName, exact: true }).click();
      await expect(library.locator("[data-sprite-card]")).toHaveCount(3);
      await section.getByRole("button", { name: "Full-body", exact: true }).click();
    }
    await expect(library.locator("[data-sprite-folder]")).toHaveCount(0);
    await expect(library.locator("[data-sprite-loose] [data-sprite-card]")).toHaveCount(1);
    await section.getByRole("button", { name: "Facial Expressions", exact: true }).click();
    const importDirectory = info.outputPath("folder-import");
    mkdirSync(importDirectory, { recursive: true });
    writeFileSync(`${importDirectory}/grin.png`, png);
    writeFileSync(`${importDirectory}/reject.png`, png);
    writeFileSync(`${importDirectory}/catalog.json`, "{broken");
    await page.route(`**${path}`, (route) =>
      route.request().method() === "POST" && route.request().postDataJSON().expression === "reject"
        ? route.fulfill({ status: 409, json: { error: "Fixture import failure" } })
        : route.continue(),
    );
    await library.locator("input[webkitdirectory]").setInputFiles(importDirectory);
    await expect(
      page.getByText("1 sprite could not be imported. Fixture import failure Folder information could not be read.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.unroute(`**${path}`);
    expect((await catalog()).sprites.some((sprite: { label: string }) => sprite.label === "grin")).toBeTruthy();
    expect(errors).toEqual([]);
  } catch (error) {
    const fixtureState = await page
      .evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? "null");
        return {
          version: stored?.version,
          completedOnboarding: stored?.state?.hasCompletedOnboarding,
          characterDetailId: stored?.state?.characterDetailId,
          url: location.href,
        };
      })
      .catch(() => null);
    await info.attach("sprite-fixture-diagnostics", {
      body: JSON.stringify({ errors, fixtureState }),
      contentType: "application/json",
    });
    throw error;
  } finally {
    releaseFrameSave();
    try {
      const removed = await cleanup.delete(`/api/characters/${owner.id}`).catch(() => null);
      expect.soft(removed?.ok(), "test character cleanup").toBeTruthy();
    } finally {
      await cleanup.dispose();
    }
  }
});
