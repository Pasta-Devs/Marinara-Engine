import { expect, test, request as createRequest } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAMCAYAAABfnvydAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFklEQVQYlWPo6en5jw8zjCr4T6dwAACTCf0hFZvtCQAAAABJRU5ErkJggg==",
  "base64",
);

test("sprite details, folders and bulk tools keep their intended scope", async ({ page, request, baseURL }, info) => {
  test.setTimeout(180_000);
  const cleanup = await createRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: new URL(baseURL!).origin } });
  const created = await request.post("/api/characters", {
    data: { data: { name: "Sprite library UI proof", first_mes: "" } },
  });
  expect(created.ok()).toBeTruthy();
  const owner = await created.json();
  const path = `/api/sprites/${owner.id}`;
  const catalog = async () => (await request.get(`${path}/catalog`)).json();
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
    expect((await request.patch(`${path}/catalog`, { data: { defaultFolderId: front } })).ok()).toBeTruthy();
    await isolateSyncedUISettings(page);
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
    await expect(page.getByRole("button", { name: "Sprites", exact: true }).or(sections).first()).toBeVisible({
      timeout: 45_000,
    });
    if (await sections.isVisible()) {
      await sections.click();
      await page.getByRole("menuitemradio", { name: "Sprites", exact: true }).click();
    } else await page.getByRole("button", { name: "Sprites", exact: true }).click();
    const section = page.locator('[data-editor-section="sprites"]');
    const library = section.locator("[data-sprite-library]");
    const frontSection = library.locator(`[data-sprite-folder="${front}"]`);
    await section.getByRole("button", { name: "Full-body", exact: true }).click();
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
    await frontSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const from = (await frontSection.boundingBox())!;
    const to = (await testSection.boundingBox())!;
    if (info.project.name === "phone") {
      const touch = await page.context().newCDPSession(page);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: from.x + 60, y: from.y + 20 }],
      });
      await expect(frontSection).toHaveAttribute("data-drag-source", "true");
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: to.x + 60, y: to.y + 8 }] });
      await expect(testSection).toHaveAttribute("data-drag-insert", "before");
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await touch.detach();
    } else {
      await page.mouse.move(from.x + 60, from.y + 20);
      await page.mouse.down();
      await page.mouse.move(to.x + 60, to.y + 8, { steps: 10 });
      await expect(frontSection).toHaveAttribute("data-drag-source", "true");
      await expect(testSection).toHaveAttribute("data-drag-insert", "before");
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
    await expect(page.getByRole("button", { name: "Sprites", exact: true }).or(sections).first()).toBeVisible();
    if (await sections.isVisible()) {
      await sections.click();
      await page.getByRole("menuitemradio", { name: "Sprites", exact: true }).click();
    } else await page.getByRole("button", { name: "Sprites", exact: true }).click();
    await section.getByRole("button", { name: "Full-body", exact: true }).click();
    await expect.poll(folderOrder).toEqual([front, alternate]);
    await frontSection.getByRole("button", { name: "Front", exact: true }).click();
    await expect(library.locator("[data-sprite-card]")).toHaveCount(3);
    await expect(section.getByRole("button", { name: "Manage", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(library.getByRole("slider")).toHaveCount(0);
    await expect(library.getByRole("button", { name: /^Unfiled/ })).toHaveCount(0);
    await expect(library.getByRole("combobox", { name: "Browse sprite folders", exact: true })).toHaveCount(0);
    await section.getByRole("button", { name: "Manage", exact: true }).click();
    await expect(section.getByRole("heading", { name: "Character Sheet", exact: true })).toBeVisible();
    await expect(section.getByText("No character sheet selected", { exact: true })).toBeVisible();
    await expect(section.getByRole("checkbox", { name: /Use as reference image/ })).toBeDisabled();
    await section.getByRole("button", { name: "Close", exact: true }).click();
    await library.getByRole("button", { name: "Add sprites", exact: true }).click();
    await expect(library.getByText(/^Adding to:/)).toHaveCount(0);
    await expect(
      library.getByText("Filenames become sprite names. Open a sprite to rename it or change its folder.", {
        exact: true,
      }),
    ).toHaveCount(0);
    await library.getByRole("button", { name: "Close", exact: true }).click();
    await expect(library.getByText("All sprites are available to chats and agents.", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("sprite-library.png"), animations: "disabled" });

    // A picture opens neutral details, and moving that picture does not change the chat default.
    if (info.project.name === "phone") {
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
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        await expect(tile).toHaveAttribute("data-drag-source", "true");
        await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
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
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: swipeX, y: swipeY }] });
      for (let offset = 20; offset <= 120; offset += 20)
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: swipeX, y: swipeY - offset }],
        });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
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
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: box!.y + box!.height / 2 }],
      });
      await expect(frontSection.locator('[data-drag-source="true"]')).toHaveCount(1);
      await expect(library.getByText("Drop here to move out of folder", { exact: true })).toBeVisible();
      const loose = library.locator("[data-sprite-loose]");
      for (let i = 0; i < 20; i++) {
        const root = await loose.boundingBox();
        if (root && root.y < 740) break;
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 810 }] });
        await page.waitForTimeout(150);
      }
      const root = await loose.boundingBox();
      expect(root).not.toBeNull();
      const y = Math.max(20, Math.min(780, root!.y + 25));
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect
        .poll(
          async () =>
            (await catalog()).sprites.find((sprite: { expression: string }) => sprite.expression === "full_idle")
              .folderId,
        )
        .toBeNull();
      // Restore this test fixture through the API before the shared editing checks.
      expect(
        (await request.post(path + "/move", { data: { expressions: ["full_idle"], folderId: front } })).ok(),
      ).toBeTruthy();
      await page.reload();
      await expect(page.getByRole("button", { name: "Sprites", exact: true }).or(sections).first()).toBeVisible({
        timeout: 45000,
      });
      if (await sections.isVisible()) {
        await sections.click();
        await page.getByRole("menuitemradio", { name: "Sprites", exact: true }).click();
      } else await page.getByRole("button", { name: "Sprites", exact: true }).click();
      await section.getByRole("button", { name: "Full-body", exact: true }).click();
      await frontSection.getByRole("button", { name: "Front", exact: true }).click();
      await session.detach();
    }

    await frontSection.getByRole("button", { name: "Front", exact: true }).press("Enter");
    await expect(frontSection.getByRole("button", { name: /^Preview / })).toHaveCount(0);
    await frontSection.getByRole("button", { name: "Front", exact: true }).press("Enter");
    await expect(frontSection.locator("[data-sprite-card]")).toHaveCount(3);
    if (info.project.name === "desktop") {
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
        await page.screenshot({
          path: info.outputPath(fromImage ? "drag-image.png" : "drag-border.png"),
          animations: "disabled",
        });
        await expect(card).toBeVisible();
        const original = card.locator("xpath=ancestor::*[@draggable][1]");
        await expect(original).toHaveCSS("opacity", "0.5");
        await page.mouse.up();
        await expect(preview).toHaveCount(0);
        await expect(original).toHaveCSS("opacity", "1");
        await expect(original).toHaveAttribute("draggable", "true");
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
      await expect
        .poll(
          async () =>
            (await catalog()).sprites.find((sprite: { expression: string }) => sprite.expression === "full_idle")
              .folderId,
        )
        .toBeNull();
      await expect(
        library
          .locator("[data-sprite-loose]")
          .getByRole("button", { name: "Preview idle", exact: true })
          .locator("xpath=ancestor::*[@draggable][1]"),
      ).toHaveAttribute("draggable", "true");
      await library
        .locator("[data-sprite-loose]")
        .getByRole("button", { name: "Preview idle", exact: true })
        .dragTo(frontSection.getByRole("button", { name: "Front", exact: true }));
      await expect
        .poll(
          async () =>
            (await catalog()).sprites.find((sprite: { expression: string }) => sprite.expression === "full_idle")
              .folderId,
        )
        .toBe(front);
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
    await expect
      .poll(
        async () =>
          (await catalog()).sprites.find((sprite: { expression: string }) => sprite.expression === "full_idle")
            .folderId,
      )
      .toBe(alternate);
    expect((await catalog()).defaultFolderId).toBe(front);
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
    if (info.project.name === "desktop") {
      const selectedCards = library.locator("[data-sprite-expression]").filter({ has: page.locator("input:checked") });
      await expect(selectedCards).toHaveCount(2);
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
    expect(saved.defaultFolderId).toBe(front);

    await expect(frontSection).toHaveCount(0);
    const expressionSection = library.locator(`[data-sprite-folder="${expressionFront}"]`);
    await expressionSection.getByRole("button", { name: "Front", exact: true }).focus();
    await page.keyboard.press("F2");
    const longName = "x".repeat(100);
    await library.getByRole("textbox", { name: "Folder name", exact: true }).fill(longName);
    await page.keyboard.press("Enter");
    await expect(expressionSection.getByRole("button", { name: longName, exact: true })).toBeVisible();
    await expect(library.getByRole("button", { name: "Use by default", exact: true })).toHaveCount(0);
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
    expect(errors).toEqual([]);
  } finally {
    releaseFrameSave();
    const removed = await cleanup.delete(`/api/characters/${owner.id}`);
    expect(removed.ok()).toBeTruthy();
    await cleanup.dispose();
  }
});
