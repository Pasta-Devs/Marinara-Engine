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
    await expect(library.getByText("All sprites are available to chats and agents.", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("sprite-library.png"), animations: "disabled" });

    // A picture opens neutral details, and moving that picture does not change the chat default.

    await frontSection.getByRole("button", { name: "Front", exact: true }).click();
    await expect(frontSection.locator("[data-sprite-card]")).toHaveCount(0);
    await frontSection.getByRole("button", { name: "Front", exact: true }).click();
    await expect(frontSection.locator("[data-sprite-card]")).toHaveCount(3);
    await expect
      .poll(() =>
        section.evaluate((element) => {
          const container = element.closest(".mari-editor-content")!;
          return Math.abs(element.getBoundingClientRect().top - container.getBoundingClientRect().top - 16);
        }),
      )
      .toBeLessThan(4);
    if (info.project.name === "desktop") {
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
    await library.getByRole("checkbox", { name: "Select idle in Alternate", exact: true }).uncheck();
    await expect(library.getByRole("button", { name: "Delete selected", exact: true })).toHaveCount(0);

    await expect(library.locator("[data-sprite-card]")).toHaveCount(3);

    // Every bulk action uses the same explicit selection, not the whole visible grid.
    const select = library.getByRole("checkbox", { name: /^Select .* in / });
    await select.nth(0).check();
    await select.nth(1).check();
    await library.getByRole("button", { name: "Clean Backgrounds", exact: true }).click();
    await expect(library.getByRole("slider", { name: "Cleanup strength", exact: true })).toBeVisible();
    await expect(library.getByRole("button", { name: "Clean 2 sprites", exact: true })).toBeVisible();
    await library.getByRole("button", { name: "Cancel", exact: true }).click();
    const exported = page.waitForRequest(
      (outgoing) => outgoing.url().endsWith(`${path}/export`) && outgoing.method() === "POST",
    );
    const download = page.waitForEvent("download");
    await library.getByRole("button", { name: "Export selected", exact: true }).click();
    expect((await exported).postDataJSON().expressions).toHaveLength(2);
    expect(await (await download).failure()).toBeNull();
    await library.getByRole("button", { name: "Delete selected", exact: true }).click();
    const bulkDelete = page.getByRole("dialog").last();
    await expect(bulkDelete.getByText("Delete 2 selected sprites?", { exact: true })).toBeVisible();
    await bulkDelete.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(library.locator("[data-sprite-card]")).toHaveCount(1);
    expect((await catalog()).sprites).toHaveLength(2);
    await expect(library.getByRole("button", { name: "Delete selected", exact: true })).toHaveCount(0);

    // Upload images is a real multi-file picker, with the current type and destination.
    await section.getByRole("button", { name: "Facial Expressions", exact: true }).click();
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
    await expressionSection.getByRole("button", { name: "Folder details", exact: true }).click();
    const longName = "x".repeat(100);
    await library.getByRole("textbox", { name: "Folder name", exact: true }).fill(longName);
    await library.getByRole("button", { name: "Save folder", exact: true }).click();
    await expect(library.getByRole("button", { name: "Use by default", exact: true })).toHaveCount(0);
    expect(await library.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
    await section.getByRole("button", { name: "Full-body", exact: true }).click();
    await expect(library.getByRole("button", { name: "Front", exact: true })).toBeVisible();
    for (const id of [alternate, front]) {
      const folder = library.locator('[data-sprite-folder="' + id + '"]');
      await folder.getByRole("button", { name: "Folder details", exact: true }).click();
      await folder.getByRole("button", { name: "Remove folder", exact: true }).click();
      await page.getByRole("dialog").last().getByRole("button", { name: "Remove folder", exact: true }).click();
      await section.getByRole("button", { name: "Facial Expressions", exact: true }).click();
      await expect(expressionSection).toBeVisible();
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
