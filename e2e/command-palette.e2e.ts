import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

async function prepareFreshClient(page: Page) {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, APP_VERSION);
  // The Professor Mari navigation hint would take the first key press.
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
  });
}

async function openOmnibar(page: Page) {
  // The shortcut needs page focus, which a fresh load or reload does not have.
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+k");
}

/** Result rows without the promoted "Ask Mari: …" row, which also contains the query. */
const RESULT_ROWS = '[data-command-center-result-row]:not([data-result-id="ask-professor-mari"])';

test.beforeEach(async ({ page }) => {
  const resetUiSettings = await page.request.put("/api/app-settings/ui", { data: { value: "" } });
  expect(resetUiSettings.ok()).toBeTruthy();
  await prepareFreshClient(page);
  await page.goto("/");
});

test("desktop shortcut opens a focused command palette with useful initial options", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The keyboard shortcut is covered on desktop.");

  await openOmnibar(page);

  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  const input = omnibar.getByRole("searchbox", { name: "Search Marinara" });
  await expect(omnibar.getByRole("dialog", { name: "Search Marinara" })).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  // Slice 78: a fresh client gets the first-use examples and the what-to-type line. Slice 79b: Mari's head
  // in the search bar is her one door (the footer pill is gone), so exactly one "Ask Prof. Mari" button.
  await expect(omnibar.locator('[data-result-id="try:search"]')).toBeVisible();
  await expect(omnibar.getByText(/^Type a name, a setting/)).toBeVisible();
  await expect(omnibar.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]')).toBeVisible();
  await expect(omnibar.getByRole("button", { name: "Ask Prof. Mari", exact: true })).toHaveCount(1);
  await expect(omnibar.getByRole("toolbar", { name: "Result categories" })).toBeHidden();
  await expect(omnibar.locator("[data-omnibar-scope-chip='characters']")).toBeVisible();
});

test("desktop command palette can toggle a setting without closing", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Setting controls are covered on desktop.");

  await openOmnibar(page);
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill("reduced effects");
  await omnibar
    .locator("[data-command-center-result-row]")
    .filter({ hasText: "Reduced ambient effects" })
    .getByRole("button", { name: /Reduced ambient effects/ })
    .first()
    .click();
  const toggle = omnibar.getByRole("switch", { name: "Reduced ambient effects" });
  await expect(toggle).toBeVisible();
  const wasOn = await toggle.isChecked();
  // The switch input is visually hidden; its label takes the click.
  await omnibar
    .locator("label")
    .filter({ has: page.getByRole("switch", { name: "Reduced ambient effects" }) })
    .click();
  await expect(toggle).toBeChecked({ checked: !wasOn });
  await expect(omnibar).toBeVisible();
});

test("desktop command result navigates directly to Appearance settings", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Direct command navigation is covered on desktop.");

  await openOmnibar(page);
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill("Appearance");
  await omnibar
    .locator("[data-command-center-result-row]")
    .filter({ hasText: "Appearance" })
    .getByRole("button", { name: /Appearance/ })
    .first()
    .click();

  await expect(omnibar).toBeHidden();
  await expect(page.getByRole("tab", { name: "Appearance", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("Professor Mari header action opens her pane with the typed draft", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Professor Mari command behavior is covered on desktop.");

  const draft = "Help me choose a character for a mystery scene";
  await openOmnibar(page);
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill(draft);
  await omnibar.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]').click();

  // Mari opens inside the omnibar; the typed text is her draft.
  await expect(omnibar.locator('[data-component="GlobalOmnibar.Mari"]')).toBeVisible();
  await expect(omnibar.locator('[data-component="GlobalOmnibar.Mari"] textarea:visible')).toHaveValue(draft);
});

test("Ctrl+Enter carries the selected Command Center result to Mari", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Professor Mari result context is covered on desktop.");

  await openOmnibar(page);
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill("Appearance");
  const appearance = omnibar.locator('[data-result-id="settings-section:appearance"]');
  await appearance.hover();
  await expect(appearance.locator("[data-selected='true']")).toHaveCount(1);
  await page.keyboard.press("Control+Enter");

  await expect(omnibar.locator('[data-component="GlobalOmnibar.Mari"]')).toBeVisible();
  await expect(omnibar.locator(".mari-workspace-composer__context")).toContainText("Appearance");
});

test("mobile keeps the command palette button and panel inside the top-bar layout", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "The mobile top-bar layout is covered on mobile.");

  // The phone has no Search button in the top bar: the omnibar opens from the shortcut or the pull-down.
  const topBar = page.locator('[data-component="TopBar"]');
  await expect(topBar).toBeVisible();

  await openOmnibar(page);
  const panel = page.locator('[data-component="GlobalOmnibar.Panel"]');
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  await expect(panel).toBeVisible();
  await expect(omnibar.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]')).toBeVisible();
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeCloseTo(0, 0);
  expect(panelBox!.y).toBeCloseTo(0, 0);
  expect(panelBox!.width).toBeCloseTo(390, 0);
  expect(panelBox!.height).toBeCloseTo(page.viewportSize()!.height, 0);
  await expect(omnibar.getByRole("toolbar", { name: "Result categories" })).toBeHidden();
});

test("query changes reset the command category filter to All", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Command filtering is covered on desktop.");

  await openOmnibar(page);
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  const input = omnibar.getByRole("searchbox", { name: "Search Marinara" });
  await input.fill("theme");
  const toolbar = omnibar.getByRole("toolbar", { name: "Result categories" });
  await toolbar.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(toolbar.getByRole("button", { name: "Settings", exact: true })).toHaveAttribute("aria-pressed", "true");

  await input.fill("Appearance");
  await expect(toolbar.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(toolbar.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
});

test("desktop keeps a stable shell when a rich result expands", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Stable Command Center geometry is covered on desktop.");

  const name = `Stable Shell ${Date.now()}`;
  // A row expands only when it has something to show, such as a description.
  const response = await page.request.post("/api/characters", {
    data: { data: { name, description: "A character with enough to expand" } },
  });
  expect(response.ok()).toBeTruthy();
  const character = (await response.json()) as { id: string };
  try {
    await page.reload();
    await openOmnibar(page);
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    const panel = omnibar.locator('[data-component="GlobalOmnibar.Panel"]');
    await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill(name);
    const characterRow = omnibar.locator(RESULT_ROWS).filter({ hasText: name });
    await expect(characterRow).toBeVisible();
    const initialBox = await panel.boundingBox();
    expect(initialBox).not.toBeNull();
    // Hover only selects; ArrowRight (or a tap) expands.
    await characterRow.hover();
    await page.keyboard.press("ArrowRight");
    await expect(characterRow.locator('[data-component="GlobalOmnibar.Detail"]')).toBeVisible();
    const richBox = await panel.boundingBox();
    expect(richBox).not.toBeNull();
    expect(richBox!.width).toBeCloseTo(initialBox!.width, 0);
  } finally {
    await page.request.delete(`/api/characters/${character.id}`);
  }
});

test("desktop exposes inline entity controls and rich character information", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Entity Command Center controls are covered on desktop.");

  const name = `Command Character ${Date.now()}`;
  const response = await page.request.post("/api/characters", {
    data: { data: { name, description: "A richly mapped test character", tags: ["test-tag"] } },
  });
  expect(response.ok()).toBeTruthy();
  const character = (await response.json()) as { id: string };
  try {
    await page.reload();
    await openOmnibar(page);
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill(name);
    const row = omnibar.locator(RESULT_ROWS).filter({ hasText: name });
    await row.hover();
    await page.keyboard.press("ArrowRight");
    const detail = row.locator('[data-component="GlobalOmnibar.Detail"]');
    // The row's own second line carries the description; the body below never repeats it.
    await expect(row).toContainText("A richly mapped test character");
    await expect(detail).toContainText("test-tag");
    // Enter already edits, so the expansion offers the other actions.
    await expect(detail.getByRole("button", { name: "Start chat", exact: true })).toBeVisible();
  } finally {
    await page.request.delete(`/api/characters/${character.id}`);
  }
});

test("Command Center can add a character to the active chat", async ({ page, request }, testInfo) => {
  const suffix = Date.now().toString(36);
  const name = `Command Chat Character ${suffix}`;
  const characterResponse = await request.post("/api/characters", {
    data: { data: { name, description: "Joins the chat from the Command Center" } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: `Command Chat ${suffix}`, mode: "conversation", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.evaluate(async (chatId) => {
      const module = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
      module.useChatStore.getState().setActiveChatId(chatId);
    }, chat.id);
    await expect(page.locator("[data-chat-resource-drop-surface]")).toBeVisible();
    await openOmnibar(page);
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    await omnibar.getByRole("searchbox", { name: "Search Marinara" }).fill(name);
    const row = omnibar.locator(RESULT_ROWS).filter({ hasText: name });
    // A tap on a phone row opens the record itself, so the row action is reached from the keyboard on both projects.
    await row.hover();
    await page.keyboard.press("ArrowRight");
    await expect(omnibar.getByRole("button", { name: "Add to this chat", exact: true })).toBeVisible();
    await omnibar.getByRole("button", { name: "Add to this chat", exact: true }).click();

    await expect(omnibar).toBeHidden();
    await expect
      .poll(async () => {
        const response = await request.get(`/api/chats/${chat.id}`);
        const stored = (await response.json()) as { characterIds?: string[] | string };
        return typeof stored.characterIds === "string" ? JSON.parse(stored.characterIds) : (stored.characterIds ?? []);
      })
      .toContain(character.id);
  } finally {
    await Promise.all([
      request.delete(`/api/chats/${chat.id}`).catch(() => undefined),
      request.delete(`/api/characters/${character.id}`).catch(() => undefined),
    ]);
  }
});

test("a category chip scopes the query and lists that whole kind", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The idle deck is covered on desktop.");

  const firstName = `Scope Alpha ${Date.now()}`;
  const secondName = `Scope Beta ${Date.now()}`;
  const firstResponse = await page.request.post("/api/characters", { data: { data: { name: firstName } } });
  const secondResponse = await page.request.post("/api/characters", { data: { data: { name: secondName } } });
  expect(firstResponse.ok()).toBeTruthy();
  expect(secondResponse.ok()).toBeTruthy();
  const first = (await firstResponse.json()) as { id: string };
  const second = (await secondResponse.json()) as { id: string };

  try {
    await page.reload();
    await openOmnibar(page);
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    // The chip types the scope prefix; there is no separate grid surface.
    await omnibar.locator("[data-omnibar-scope-chip='characters']").click();
    const input = omnibar.getByRole("searchbox", { name: "Search Marinara" });
    await expect(input).toHaveValue("char: ");
    await expect(input).toBeFocused();

    const rows = omnibar.locator("[data-command-center-result-row]");
    await expect(rows.filter({ hasText: firstName })).toBeVisible();
    await expect(rows.filter({ hasText: secondName })).toBeVisible();

    // The list keeps its own keyboard model: arrows move the selection, which
    // browse never supported. Assert it actually moved, not merely that
    // something is selected.
    const selectedRowId = () =>
      omnibar
        .locator("[data-command-center-result-row]:has([data-selected='true'])")
        .first()
        .getAttribute("data-result-id");
    // One movement is the whole claim, and it needs only the two rows the
    // fixture guarantees. Asserting two movements would depend on how many
    // characters the test database happens to hold.
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
    const before = await selectedRowId();
    await page.keyboard.press("ArrowDown");
    const after = await selectedRowId();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  } finally {
    await page.request.delete(`/api/characters/${first.id}`);
    await page.request.delete(`/api/characters/${second.id}`);
  }
});

test("expanded results stay reachable and expose concise accessible names", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Inline preview geometry is covered on desktop.");

  const suffix = Date.now().toString(36);
  const created: string[] = [];
  try {
    for (let index = 0; index < 6; index += 1) {
      const response = await request.post("/api/characters", {
        data: {
          data: {
            name: `Preview Reachability ${suffix} ${index}`,
            description: `Long private description marker ${suffix} ${"detail ".repeat(40)}`,
          },
        },
      });
      expect(response.ok()).toBeTruthy();
      created.push(((await response.json()) as { id: string }).id);
    }

    await page.reload();
    await openOmnibar(page);
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    const input = omnibar.getByRole("searchbox", { name: "Search Marinara" });
    await input.fill(`char: Preview Reachability ${suffix}`);
    await page.keyboard.press("End");
    const selectedRow = omnibar.locator("[data-command-center-result-row]:has([data-selected='true'])");
    // Wait for the typed results: the empty list's first row (a Now or Try row) has no preview.
    await expect(selectedRow).toContainText(`Preview Reachability ${suffix}`);
    const accessibleName = await selectedRow.locator(":scope > button").getAttribute("aria-label");
    expect(accessibleName).not.toContain("Long private description marker");

    await page.keyboard.press("ArrowRight");
    const detail = selectedRow.locator('[data-component="GlobalOmnibar.Detail"]');
    await expect(detail).toBeVisible();
    const resultsPane = omnibar.locator('[data-component="GlobalOmnibar.Results"]');
    await expect
      .poll(async () => {
        const [detailBox, paneBox] = await Promise.all([detail.boundingBox(), resultsPane.boundingBox()]);
        return Boolean(detailBox && paneBox && detailBox.y + detailBox.height <= paneBox.y + paneBox.height + 1);
      })
      .toBe(true);

    await expect(omnibar.getByText("Ctrl+Enter Continue with Prof. Mari", { exact: true })).toBeVisible();
    await expect(omnibar.getByText("Esc close", { exact: true })).toBeVisible();
    await omnibar.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]').click();
    await expect(omnibar.locator('[data-component="GlobalOmnibar.Mari"]')).toBeVisible();
    await expect(omnibar.locator('[data-component="GlobalOmnibar.LiveResults"]')).toHaveCount(0);
  } finally {
    await Promise.all(created.map((id) => request.delete(`/api/characters/${id}`).catch(() => undefined)));
  }
});

test("mobile preserves search and composer space when handing context to Mari", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile composer geometry is covered on mobile.");

  const name = `Mobile Mari Context ${Date.now().toString(36)}`;
  const response = await request.post("/api/characters", { data: { data: { name } } });
  expect(response.ok()).toBeTruthy();
  const character = (await response.json()) as { id: string };
  try {
    await page.reload();
    await openOmnibar(page);
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    const input = omnibar.getByRole("searchbox", { name: "Search Marinara" });
    const mariButton = omnibar.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]');
    const [inputBox, mariButtonBox] = await Promise.all([input.boundingBox(), mariButton.boundingBox()]);
    expect(inputBox).not.toBeNull();
    expect(mariButtonBox).not.toBeNull();
    expect(inputBox!.width).toBeGreaterThanOrEqual(128);
    expect(inputBox!.x + inputBox!.width).toBeLessThanOrEqual(mariButtonBox!.x + 1);

    await input.fill(name);
    const row = omnibar.locator("[data-command-center-result-row]").filter({ hasText: name }).first();
    await expect(row).toBeVisible();
    // A character row opens its record on tap, so Ctrl+Enter ("Continue with Prof. Mari") is the handoff on both projects.
    await page.keyboard.press("Control+Enter");

    const textarea = omnibar.locator(".mari-workspace-composer textarea");
    const context = omnibar.locator(".mari-workspace-composer__context");
    const attach = omnibar.locator(".mari-workspace-composer__attach");
    await expect(textarea).toBeVisible();
    await expect(context).toBeVisible();
    const [textareaBox, contextBox, attachBox] = await Promise.all([
      textarea.boundingBox(),
      context.boundingBox(),
      attach.boundingBox(),
    ]);
    expect(textareaBox).not.toBeNull();
    expect(contextBox).not.toBeNull();
    expect(attachBox).not.toBeNull();
    expect(textareaBox!.width).toBeGreaterThanOrEqual(128);
    expect(contextBox!.y + contextBox!.height).toBeLessThanOrEqual(attachBox!.y + 1);
  } finally {
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("Professor Mari consolidates privileged bootstrap failures", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Bootstrap error consolidation is covered on desktop.");

  await page.route(/\/api\/professor-mari\/workspace\/(?:status|skills|instructions)(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Forbidden" }) });
  });
  await openOmnibar(page);
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  await omnibar.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]').click();

  // One quiet note in the transcript, not a toast per failed request.
  const toolsNote = omnibar.locator(".mari-note").filter({
    hasText: "Some of Professor Mari's tools are unavailable.",
  });
  await expect(toolsNote).toHaveCount(1);
  await expect(toolsNote).toContainText("Settings → Advanced → Admin Access");
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "workspace tools" })).toHaveCount(0);
});
