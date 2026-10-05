import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("character library restores New Folder and bulk tags persist across reload", async ({
  page,
  request,
}, testInfo) => {
  const suffix = Date.now().toString();
  const name = `E2E Synthetic Library ${suffix}`;
  const createdIds: string[] = [];
  let createdFolderId: string | undefined;
  try {
    for (const cardName of [name, `${name} (copy)`]) {
      const response = await request.post("/api/characters", {
        data: {
          data: {
            name: cardName,
            description: "Synthetic test card for the character library tools.",
            personality: "Patient and observant.",
            scenario: "A neutral test setting.",
            first_mes: "Hello from the test fixture.",
            tags: ["remove-this-tag"],
            creator: "Synthetic E2E fixture",
            character_version: "1",
          },
        },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      createdIds.push(((await response.json()) as { id: string }).id);
    }

    await page.route("**/api/app-settings/ui", (route) =>
      route.fulfill({ json: route.request().method() === "GET" ? { value: "" } : { success: true } }),
    );
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      professorMariNavigationEnabled: false,
    });
    await page.addInitScript((appVersion) => {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    }, version);
    await page.goto("/");
    await clickTopbarPanel(page, "characters");

    await expect(page.getByRole("button", { name: "Possible duplicates", exact: true })).toHaveCount(0);
    const newFolder = page.getByRole("button", { name: "New Folder", exact: true });
    await expect(newFolder).toBeVisible();
    const folderWidth = await newFolder.evaluate((button) => ({
      button: button.getBoundingClientRect().width,
      row: button.parentElement!.getBoundingClientRect().width,
    }));
    expect(Math.abs(folderWidth.button - folderWidth.row)).toBeLessThanOrEqual(1);
    const folderCreated = page.waitForResponse(
      (response) => response.url().endsWith("/api/characters/groups") && response.request().method() === "POST",
    );
    await newFolder.click();
    const folderResponse = await folderCreated;
    expect(folderResponse.ok()).toBeTruthy();
    createdFolderId = ((await folderResponse.json()) as { id: string }).id;
    await expect(page.locator(`[data-character-folder-id="${createdFolderId}"]`)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("character-new-folder-restored.png") });

    await page.getByRole("button", { name: "Select", exact: true }).click();
    for (const [index, id] of createdIds.entries()) {
      if (index === 1) {
        await page.getByPlaceholder("Search characters", { exact: true }).fill(`${name} (copy)`);
        await expect(page.locator(`[data-character-id="${createdIds[0]}"]`)).toBeHidden();
      }
      await page
        .locator(`[data-character-id="${id}"]`)
        .getByRole("button", { name: "Select character", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Tags", exact: true }).click();
    const tagDialog = page.getByRole("dialog", { name: "Edit tags of 2 characters" });
    await expect(tagDialog).toBeVisible();
    await tagDialog.getByRole("textbox", { name: "Add tags", exact: true }).fill("keep-after-reload");
    await tagDialog.getByRole("button", { name: "Review changes", exact: true }).click();
    await page.route(
      "**/api/characters/bulk-tags",
      async (route) => {
        // Save one card for real and return the other as failed, matching a partial server result.
        const response = await route.fetch({ postData: { ...route.request().postDataJSON(), ids: [createdIds[0]] } });
        await route.fulfill({ response, json: { ...(await response.json()), failedIds: [createdIds[1]] } });
      },
      { times: 1 },
    );
    await tagDialog.getByRole("button", { name: "Apply to 2 characters", exact: true }).click();
    await expect(tagDialog).toBeHidden();
    await expect(
      page
        .locator(`[data-character-id="${createdIds[1]}"]`)
        .getByRole("button", { name: "Deselect character", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("partial-tag-failure-selection-retained.png") });
    await page.getByRole("button", { name: "Tags", exact: true }).click();
    const retryDialog = page.getByRole("dialog", { name: "Edit tags of 1 character" });
    await retryDialog.getByRole("textbox", { name: "Add tags", exact: true }).fill("keep-after-reload");
    await retryDialog.getByRole("button", { name: "Review changes", exact: true }).click();
    const retryRequest = page.waitForRequest((request) => request.url().endsWith("/api/characters/bulk-tags"));
    await retryDialog.getByRole("button", { name: "Apply to 1 character", exact: true }).click();
    expect((await retryRequest).postDataJSON().ids).toEqual([createdIds[1]]);
    await expect(retryDialog).toBeHidden();
    await page.getByPlaceholder("Search characters", { exact: true }).fill("");

    for (const id of createdIds) {
      await expect
        .poll(async () => {
          const response = await request.get(`/api/characters/${id}`);
          const character = (await response.json()) as { data: string };
          return (JSON.parse(character.data) as { tags: string[] }).tags;
        })
        .toContain("keep-after-reload");
    }

    await page.getByRole("button", { name: "Select", exact: true }).click();
    for (const id of createdIds) {
      await page
        .locator(`[data-character-id="${id}"]`)
        .getByRole("button", { name: "Select character", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Tags", exact: true }).click();
    const removeDialog = page.getByRole("dialog", { name: "Edit tags of 2 characters" });
    await removeDialog.getByRole("button", { name: /remove-this-tag/i }).click();
    await removeDialog.getByRole("button", { name: "Review changes", exact: true }).click();
    await removeDialog.getByRole("button", { name: "Apply to 2 characters", exact: true }).click();
    await expect(removeDialog).toBeHidden();

    await page.reload();
    for (const id of createdIds) {
      const response = await request.get(`/api/characters/${id}`);
      const character = (await response.json()) as { data: string };
      const tags = (JSON.parse(character.data) as { tags: string[] }).tags;
      expect(tags).toContain("keep-after-reload");
      expect(tags).not.toContain("remove-this-tag");
    }
  } finally {
    if (createdFolderId) await request.delete(`/api/characters/groups/${createdFolderId}`).catch(() => undefined);
    for (const id of createdIds) await request.delete(`/api/characters/${id}`).catch(() => undefined);
  }
});

test("bulk tag batches keep successes and retry only rejected cards", async ({ page }) => {
  // Exercise the real modal and hook with a large selection without creating ten thousand files.
  // The panel's failed-ID selection callback is covered by the library test above.
  const cards = Array.from({ length: 10001 }, (_, index) => ({
    id: `bulk-tag-batch-${index}`,
    name: `Batch fixture ${index}`,
    tags: [] as string[],
  }));
  const batches: string[][] = [];
  await page.route("**/api/characters/catalog?*", (route) =>
    route.fulfill({ json: { items: cards, limit: cards.length, offset: 0, hasMore: false, catalogGeneration: 1 } }),
  );
  await page.route("**/api/characters/bulk-tags", (route) => {
    const { ids, add } = route.request().postDataJSON() as { ids: string[]; add: string[] };
    batches.push(ids);
    if (batches.length === 2) return route.fulfill({ status: 500, json: { error: "Synthetic batch failure" } });
    const requested = new Set(ids);
    for (const card of cards) if (requested.has(card.id)) card.tags = add;
    return route.fulfill({ json: { updatedIds: ids, unchangedIds: [], failedIds: [] } });
  });
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript(
    (appVersion) => localStorage.setItem("marinara:whats-new:seen-version", appVersion),
    version,
  );
  await page.goto("/");
  await prepareViteFixtureDependencies(page);
  await page.evaluate(
    async (ids) => {
      const { CharacterBulkTagsModal } = await import(
        "/src/components/characters/CharacterBulkTagsModal.tsx" as string
      );
      const dependencyUrl = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(dependencyUrl("react"));
      const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
      const client = new QueryClient();
      const container = document.createElement("div");
      document.body.append(container);
      const root = ReactDOM.createRoot(container);
      const render = (selected: string[]) =>
        root.render(
          React.createElement(
            QueryClientProvider,
            { client },
            React.createElement(CharacterBulkTagsModal, {
              open: selected.length > 0,
              onClose: () => render([]),
              selectedIds: new Set(selected),
              onApplied: render,
            }),
          ),
        );
      render(ids);
    },
    cards.map((card) => card.id),
  );
  const first = page.getByRole("dialog", { name: "Edit tags of 10001 characters" });
  await first.getByRole("textbox", { name: "Add tags", exact: true }).fill("batch-saved");
  await first.getByRole("button", { name: "Review changes", exact: true }).click();
  await first.getByRole("button", { name: "Apply to 10001 characters", exact: true }).click();
  const retry = page.getByRole("dialog", { name: "Edit tags of 5000 characters" });
  await expect(retry).toBeVisible();
  expect(batches.map((ids) => ids.length)).toEqual([5000, 5000, 1]);
  await retry.getByRole("textbox", { name: "Add tags", exact: true }).fill("batch-saved");
  await retry.getByRole("button", { name: "Review changes", exact: true }).click();
  await retry.getByRole("button", { name: "Apply to 5000 characters", exact: true }).click();
  await expect(retry).toBeHidden();
  expect(batches.map((ids) => ids.length)).toEqual([5000, 5000, 1, 5000]);
  expect(batches[3]).toEqual(batches[1]);
  expect(cards.every((card) => card.tags.includes("batch-saved"))).toBe(true);
});
