import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
  type Request,
  type TestInfo,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

// Generation alone is replaced with a fixture; cards, eligible chat lists, assignment writes,
// confirmations, and save/reopen all use the running app. Prompt substitution is tested server-side.
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const FIELDS = [
  ["summary", "Summary"],
  ["description", "Description"],
  ["personality", "Personality"],
  ["backstory", "Backstory"],
  ["appearance", "Appearance"],
  ["scenario", "Scenario"],
  ["mes_example", "Example Dialogue"],
] as const;
type Field = (typeof FIELDS)[number][0];
type Owner = "character" | "persona";
type Alternative = { id: string; field: Field; value: string; chatIds: string[] };

function endpoint(owner: Owner, id?: string) {
  return `/api/characters${owner === "persona" ? "/personas" : ""}${id ? `/${id}` : ""}`;
}
async function createEntity(request: APIRequestContext, owner: Owner, name: string) {
  const response = await request.post(endpoint(owner), { data: owner === "character" ? { data: { name } } : { name } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}
async function createChat(request: APIRequestContext, owner: Owner, id: string | null, name: string) {
  const response = await request.post("/api/chats", {
    data: {
      name,
      mode: "conversation",
      characterIds: owner === "character" && id ? [id] : [],
      personaId: owner === "persona" ? id : null,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}
async function stored(request: APIRequestContext, owner: Owner, id: string) {
  const response = await request.get(endpoint(owner, id));
  expect(response.ok(), await response.text()).toBeTruthy();
  const entity = (await response.json()) as Record<string, unknown>;
  const data =
    owner === "persona"
      ? entity
      : typeof entity.data === "string"
        ? (JSON.parse(entity.data) as Record<string, unknown>)
        : (entity.data as Record<string, unknown>);
  const extensions = (data.extensions ?? {}) as Record<string, unknown>;
  return {
    name: String(data.name),
    alternatives: ((owner === "persona" ? data.cardFieldAlternatives : extensions.cardFieldAlternatives) ??
      []) as Alternative[],
    field: (field: Field) =>
      String(
        (owner === "character" && (field === "backstory" || field === "appearance")
          ? extensions[field]
          : data[field]) ?? "",
      ),
  };
}
async function prepare(page: Page) {
  await isolateSyncedUISettings(page);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    appAccentPulseMode: false,
  });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
  await page.goto("/");
}
async function openCard(page: Page, owner: Owner, id: string) {
  const saved = await stored(page.request, owner, id);
  await page.evaluate(
    async ({ owner, id }) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      if (owner === "character") useUIStore.getState().openCharacterDetail(id);
      else useUIStore.getState().openPersonaDetail(id);
    },
    { owner, id },
  );
  const editor = page.locator(".mari-editor-shell");
  await expect(
    editor.getByPlaceholder(owner === "character" ? "Character name" : "Persona name", { exact: true }).first(),
  ).toHaveValue(saved.name);
  const compact = editor.getByRole("button", { name: "Editor sections", exact: true });
  const navigation = editor.getByRole("navigation", { name: "Editor sections", exact: true });
  await expect.poll(async () => (await compact.isVisible()) || (await navigation.isVisible())).toBe(true);
  if (await compact.isVisible()) {
    await compact.click();
    await editor
      .getByRole("menu", { name: "Editor sections", exact: true })
      .getByRole("menuitemradio", { name: "Card", exact: true })
      .click();
  } else await navigation.getByRole("button", { name: "Card", exact: true }).click();
  await expect(editor.getByRole("textbox", { name: "Summary", exact: true })).toBeVisible();
  return editor;
}
function cardSection(editor: Locator, owner: Owner, field: Field) {
  return editor.locator(`#${owner}-card-${field === "mes_example" ? "dialogue" : field}`);
}
function alternative(editor: Locator, label: string, index: number) {
  return editor.getByRole("region", { name: `${label} alternative ${index}`, exact: true });
}
async function addAlternative(editor: Locator, owner: Owner, field: Field) {
  await cardSection(editor, owner, field).getByRole("button", { name: "Add Alternative Field", exact: true }).click();
}
async function openChats(section: Locator) {
  const disclosure = section.locator("details");
  if (!(await disclosure.evaluate((element) => (element as HTMLDetailsElement).open)))
    await disclosure.locator("summary").click();
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.mouse.move(0, 0);
  const openHelp = page.getByRole("button", { name: /^Show help/ }).and(page.locator('[aria-expanded="true"]'));
  if (await openHelp.count()) await page.keyboard.press("Escape");
  await expect(openHelp).toHaveCount(0);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: "image/png" });
}

for (const owner of ["character", "persona"] as const) {
  test(`${owner} alternatives copy every field, select eligible chats, transfer assignments, confirm deletion, and persist`, async ({
    page,
    request,
  }, info) => {
    const id = await createEntity(request, owner, `Alternative ${owner} ${info.testId}`);
    const chatNames = [`${owner} laboratory`, `${owner} holiday`, `${owner} unrelated`];
    const chats: string[] = [];
    try {
      for (const [index, name] of chatNames.entries())
        chats.push(await createChat(request, owner, index < 2 ? id : null, name));
      const choicesResponse = await request.get(`${endpoint(owner, id)}/card-field-chats`);
      expect(choicesResponse.ok()).toBeTruthy();
      expect(((await choicesResponse.json()) as { id: string }[]).map((chat) => chat.id).sort()).toEqual(
        chats.slice(0, 2).sort(),
      );
      await prepare(page);
      let editor = await openCard(page, owner, id);
      const bases = new Map<Field, string>();
      for (const [field, label] of FIELDS) {
        const base = `Original ${label} for every other chat.`;
        bases.set(field, base);
        await editor.getByRole("textbox", { name: label, exact: true }).fill(base);
        await expect(
          cardSection(editor, owner, field).getByRole("button", { name: "Add Alternative Field", exact: true }),
        ).toHaveAttribute(
          "title",
          "Copy this field into an alternative. Choose chats where it replaces the original after saving.",
        );
        await addAlternative(editor, owner, field);
        const section = alternative(editor, label, 1);
        await expect(section.getByRole("textbox", { name: `${label} alternative 1`, exact: true })).toHaveValue(base);
        await expect(section.locator("summary")).toHaveText("Active in 0 chats");
        await expect(
          section.getByRole("button", { name: `Delete ${label} alternative 1`, exact: true }),
        ).toHaveAttribute("title", "Delete alternative field?");
      }
      expect((await stored(request, owner, id)).alternatives).toEqual([]);
      await alternative(editor, "Summary", 1).getByRole("button", { name: "Show help", exact: true }).click();
      await expect(
        page.getByText(
          "A chat-specific summary kept as metadata. Summaries are not automatically sent to the model. Save the card to keep this alternative.",
          { exact: true },
        ),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      const first = alternative(editor, "Description", 1);
      await first
        .getByRole("textbox", { name: "Description alternative 1", exact: true })
        .fill("A researcher in this chat-specific laboratory.");
      await openChats(first);
      for (const name of chatNames.slice(0, 2)) await first.getByRole("checkbox", { name, exact: true }).check();
      await expect(first.getByRole("checkbox")).toHaveCount(2);
      await expect(first.getByText(chatNames[2]!, { exact: true })).toHaveCount(0);
      await expect(first.locator("summary")).toHaveText("Active in 2 chats");

      // Eligibility can change while the editor remains open. Reopening the chooser refreshes it.
      const membership = (included: boolean) =>
        owner === "character" ? { characterIds: included ? [id] : [] } : { personaId: included ? id : null };
      expect((await request.patch(`/api/chats/${chats[2]}`, { data: membership(true) })).ok()).toBeTruthy();
      await first.locator("summary").click();
      await openChats(first);
      await expect(first.getByRole("checkbox", { name: chatNames[2]!, exact: true })).toBeVisible();
      expect((await request.patch(`/api/chats/${chats[2]}`, { data: membership(false) })).ok()).toBeTruthy();
      await first.locator("summary").click();
      await openChats(first);
      await expect(first.getByRole("checkbox", { name: chatNames[2]!, exact: true })).toHaveCount(0);

      await addAlternative(editor, owner, "description");
      const second = alternative(editor, "Description", 2);
      await expect(second.getByRole("textbox", { name: "Description alternative 2", exact: true })).toHaveValue(
        bases.get("description")!,
      );
      await second.getByRole("textbox", { name: "Description alternative 2", exact: true }).fill("");
      await openChats(second);
      await second.getByRole("checkbox", { name: chatNames[0]!, exact: true }).check();
      await expect(first.getByRole("checkbox", { name: chatNames[0]!, exact: true })).not.toBeChecked();
      await expect(first.getByRole("checkbox", { name: chatNames[1]!, exact: true })).toBeChecked();
      await expect(second.locator("summary")).toHaveText("Active in 1 chat");
      await addAlternative(editor, owner, "description");
      const third = alternative(editor, "Description", 3);
      await third
        .getByRole("textbox", { name: "Description alternative 3", exact: true })
        .fill("Dormant future version with zero selected chats.");

      for (const theme of ["dark", "light"] as const) {
        await page.evaluate(async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        }, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await first.scrollIntoViewIfNeeded();
        // Tall sections can be centered behind the editor header on WebKit. Frame their controls.
        await first
          .getByRole("button", { name: "Generate Description alternative 1", exact: true })
          .scrollIntoViewIfNeeded();
        const box = (await first.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
        await capture(page, info, `${owner}-alternatives-${theme}`);
      }
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(async () => (await stored(request, owner, id)).alternatives.length).toBe(9);
      let saved = await stored(request, owner, id);
      for (const [field] of FIELDS) expect(saved.field(field)).toBe(bases.get(field));
      const descriptions = saved.alternatives.filter((entry) => entry.field === "description");
      expect(descriptions.map(({ value, chatIds }) => ({ value, chatIds }))).toEqual([
        { value: "A researcher in this chat-specific laboratory.", chatIds: [chats[1]] },
        { value: "", chatIds: [chats[0]] },
        { value: "Dormant future version with zero selected chats.", chatIds: [] },
      ]);
      await second.getByRole("button", { name: "Delete Description alternative 2", exact: true }).click();
      const confirmation = page.getByRole("dialog", { name: "Delete alternative field?", exact: true });
      await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(alternative(editor, "Description", 3)).toBeVisible();
      await second.getByRole("button", { name: "Delete Description alternative 2", exact: true }).click();
      await confirmation.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(alternative(editor, "Description", 3)).toHaveCount(0);
      expect((await stored(request, owner, id)).alternatives).toHaveLength(9);
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(async () => (await stored(request, owner, id)).alternatives.length).toBe(8);
      await page.reload();
      editor = await openCard(page, owner, id);
      await expect(
        alternative(editor, "Description", 2).getByRole("textbox", { name: "Description alternative 2", exact: true }),
      ).toHaveValue("Dormant future version with zero selected chats.");
      saved = await stored(request, owner, id);
      expect(saved.alternatives.some((entry) => entry.chatIds.includes(chats[0]!))).toBe(false);
      expect(saved.alternatives.find((entry) => entry.field === "description")?.chatIds).toEqual([chats[1]]);
    } finally {
      await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat}`)));
      await request.delete(endpoint(owner, id));
    }
  });

  test(`${owner} alternative availability preserves assignments through loading, errors, and dormant membership`, async ({
    page,
    request,
  }, info) => {
    const id = await createEntity(request, owner, `Availability ${owner} ${info.testId}`);
    const chat = await createChat(request, owner, id, `${owner} saved assignment`);
    const entries: Alternative[] = [
      { id: "availability-alternative", field: "description", value: "A saved alternative.", chatIds: [chat] },
    ];
    const saved = await request.patch(endpoint(owner, id), {
      data:
        owner === "character"
          ? { data: { extensions: { cardFieldAlternatives: entries } } }
          : { cardFieldAlternatives: entries },
    });
    expect(saved.ok(), await saved.text()).toBeTruthy();
    const membership = (included: boolean) =>
      owner === "character" ? { characterIds: included ? [id] : [] } : { personaId: included ? id : null };
    expect((await request.patch(`/api/chats/${chat}`, { data: membership(false) })).ok()).toBeTruthy();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let fail = true;
    const pattern = `**${endpoint(owner, id)}/card-field-chats`;
    await page.route(pattern, async (route) => {
      await held;
      if (fail) await route.fulfill({ status: 400, json: { error: "Availability fixture failure" } });
      else await route.continue();
    });
    try {
      await prepare(page);
      const editor = await openCard(page, owner, id);
      const section = alternative(editor, "Description", 1);
      await expect(section.locator("summary")).toHaveText("Loading eligible chats…");
      release();
      await expect(section.locator("summary")).toHaveText("Chat availability unknown");
      const openingRefresh = page.waitForResponse(
        (response) => response.url().endsWith(`${endpoint(owner, id)}/card-field-chats`) && response.status() === 400,
      );
      await openChats(section);
      await openingRefresh;
      await expect(section.locator("summary")).toHaveText("Chat availability unknown");
      await expect(section.getByRole("alert")).toContainText("Your alternative text and assignments were kept.");
      expect((await stored(request, owner, id)).alternatives).toEqual(entries);
      fail = false;
      await section.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(section.locator("summary")).toHaveText("Active in 0 chats");
      await expect(section.getByRole("checkbox")).toHaveCount(0);
      const baseDescription = "Updated base description while the assignment is dormant.";
      await editor.getByRole("textbox", { name: "Description", exact: true }).fill(baseDescription);
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(async () => (await stored(request, owner, id)).field("description")).toBe(baseDescription);
      expect((await stored(request, owner, id)).alternatives).toEqual(entries);
      expect((await request.patch(`/api/chats/${chat}`, { data: membership(true) })).ok()).toBeTruthy();
      await section.locator("summary").click();
      await openChats(section);
      await expect(section.getByRole("checkbox", { name: `${owner} saved assignment`, exact: true })).toBeChecked();
      await expect(section.locator("summary")).toHaveText("Active in 1 chat");
      expect((await stored(request, owner, id)).alternatives).toEqual(entries);
    } finally {
      release();
      if (!page.isClosed()) await page.unroute(pattern);
      await request.delete(`/api/chats/${chat}`);
      await request.delete(endpoint(owner, id));
    }
  });

  test(`${owner} alternative generation uses its own seed and protects later typing and deletion`, async ({
    page,
    request,
  }, info) => {
    const id = await createEntity(request, owner, `Protected alternative ${owner} ${info.testId}`);
    let hold = false;
    let release: (() => void) | undefined;
    let arrived!: () => void;
    let generationRequest!: Request;
    let started = Promise.resolve();
    const generated = `Alternate appearance. ${Array.from({ length: 110 }, (_, index) => `visual${index}`).join(" ")}`;
    const sent: { field: string; card: { appearance: string; description: string } }[] = [];
    await page.route(`**${endpoint(owner, id)}/card-field/generate`, async (route) => {
      sent.push(route.request().postDataJSON());
      generationRequest = route.request();
      if (hold) {
        arrived();
        await new Promise<void>((resolve) => (release = resolve));
      }
      await route.fulfill({ json: { text: generated } });
    });
    try {
      await prepare(page);
      const editor = await openCard(page, owner, id);
      await editor
        .getByRole("textbox", { name: "Description", exact: true })
        .fill("Reference identity from an unsaved base field.");
      await editor
        .getByRole("textbox", { name: "Appearance", exact: true })
        .fill("Original appearance stays unchanged.");
      await addAlternative(editor, owner, "appearance");
      const section = alternative(editor, "Appearance", 1);
      const input = section.getByRole("textbox", { name: "Appearance alternative 1", exact: true });
      const generate = section.getByRole("button", { name: "Generate Appearance alternative 1", exact: true });
      await openChats(section);
      await expect(
        section.getByText(
          "No eligible chats yet. Add this character or select this persona in a chat, then reopen the editor.",
          { exact: true },
        ),
      ).toBeVisible();
      await input.fill("Alternative seed: silver hair and gold mask.");
      await generate.click();
      await expect(input).toHaveValue(generated);
      expect(sent[0]).toMatchObject({
        field: "appearance",
        card: {
          appearance: "Alternative seed: silver hair and gold mask.",
          description: "Reference identity from an unsaved base field.",
        },
      });
      await expect(editor.getByRole("textbox", { name: "Appearance", exact: true })).toHaveValue(
        "Original appearance stays unchanged.",
      );
      expect((await stored(request, owner, id)).alternatives).toEqual([]);

      hold = true;
      started = new Promise<void>((resolve) => (arrived = resolve));
      await input.fill("Stable alternative seed while another field changes.");
      await generate.click();
      await started;
      const editedReference = "A newer base description written while the alternative was generating.";
      await editor.getByRole("textbox", { name: "Description", exact: true }).fill(editedReference);
      release!();
      await expect(generate).toBeEnabled();
      await expect(input).toHaveValue(generated);
      await expect(editor.getByRole("textbox", { name: "Description", exact: true })).toHaveValue(editedReference);

      started = new Promise<void>((resolve) => (arrived = resolve));
      await generate.click();
      await started;
      await input.fill("Later handwritten alternative appearance.");
      release!();
      await expect(generate).toBeEnabled();
      await expect(input).toHaveValue("Later handwritten alternative appearance.");

      started = new Promise<void>((resolve) => (arrived = resolve));
      await generate.click();
      await started;
      const response = generationRequest.response();
      await section.getByRole("button", { name: "Delete Appearance alternative 1", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Delete alternative field?", exact: true })
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      release!();
      await (await response)?.finished();
      await expect(alternative(editor, "Appearance", 1)).toHaveCount(0);
      await expect(editor.getByRole("textbox", { name: "Appearance", exact: true })).toHaveValue(
        "Original appearance stays unchanged.",
      );
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect
        .poll(async () => (await stored(request, owner, id)).field("appearance"))
        .toBe("Original appearance stays unchanged.");
      expect((await stored(request, owner, id)).alternatives).toEqual([]);
    } finally {
      release?.();
      await request.delete(endpoint(owner, id));
    }
  });
}
