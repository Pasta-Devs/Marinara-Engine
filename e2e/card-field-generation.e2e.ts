import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
  type Request,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { clickTopbarPanel } from "./topbar-navigation.js";

// This suite exercises the real editor, requests, and save/reopen lifecycle. Only the paid generation
// response is replaced. Provider prompts and connection selection have server regression coverage.
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
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
type Draft = { name: string } & Record<Field, string>;
type GenerationRequest = { field: Field; card: Draft; debugMode?: boolean };
const HINT = "Anything prewritten here will be used as a base for the AI generation with the wand button above.";

function endpoint(owner: Owner, id?: string) {
  return `/api/characters${owner === "persona" ? "/personas" : ""}${id ? `/${id}` : ""}`;
}

async function createEntity(request: APIRequestContext, owner: Owner, name: string) {
  const response = await request.post(endpoint(owner), {
    data: owner === "character" ? { data: { name } } : { name },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

async function storedDraft(request: APIRequestContext, owner: Owner, id: string): Promise<Draft> {
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
  const result = { name: String(data.name ?? "") } as Draft;
  for (const [field] of FIELDS) {
    result[field] = String(
      owner === "character" && (field === "backstory" || field === "appearance")
        ? (extensions[field] ?? "")
        : (data[field] ?? ""),
    );
  }
  return result;
}

async function prepare(page: Page) {
  await isolateSyncedUISettings(page);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    appAccentPulseMode: false,
  });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
  await page.goto("/");
}

async function openCard(page: Page, owner: Owner, id: string) {
  const saved = await storedDraft(page.request, owner, id);
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
  await expect(fieldInput(editor, "Summary")).toBeVisible();
  return editor;
}

function fieldInput(editor: Locator, label: string) {
  return editor.getByRole("textbox", { name: label, exact: true });
}

function wand(editor: Locator, label: string) {
  return editor.getByRole("button", { name: `Generate ${label}`, exact: true });
}

function generatedText(field: Field) {
  const prose = Array.from({ length: 115 }, (_, index) => `detail${index + 1}`).join(" ");
  return field === "mes_example"
    ? `<START>\n{{user}}: ${prose}\n{{char}}: I understand.`
    : `Generated ${field}. ${prose}`;
}

async function expectDraft(editor: Locator, draft: Draft) {
  for (const [field, label] of FIELDS) await expect(fieldInput(editor, label)).toHaveValue(draft[field]);
}

async function capture(page: Page, info: TestInfo, name: string) {
  // Scrolling can move a help icon under the pointer. Clear transient help before visual proof.
  await page.mouse.move(0, 0);
  const openHelp = page.getByRole("button", { name: /^Show help/ }).and(page.locator('[aria-expanded="true"]'));
  if (await openHelp.count()) await page.keyboard.press("Escape");
  await expect(openHelp).toHaveCount(0);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: "image/png" });
}

for (const owner of ["character", "persona"] as const) {
  test(`${owner} Card generation keeps edits to reference fields while applying its target`, async ({
    page,
    request,
  }, info) => {
    const id = await createEntity(request, owner, `Reference ${owner} ${info.testId}`);
    let release!: () => void;
    let arrived!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const started = new Promise<void>((resolve) => (arrived = resolve));
    await page.route(`**${endpoint(owner, id)}/card-field/generate`, async (route) => {
      arrived();
      await held;
      await route.fulfill({ json: { text: generatedText("description") } });
    });
    try {
      await prepare(page);
      const editor = await openCard(page, owner, id);
      await fieldInput(editor, "Description").fill("An unchanged description seed.");
      await wand(editor, "Description").click();
      await started;
      await fieldInput(editor, "Personality").fill("New reference details written while waiting.");
      release();
      await expect(fieldInput(editor, "Description")).toHaveValue(generatedText("description"));
      await expect(fieldInput(editor, "Personality")).toHaveValue("New reference details written while waiting.");
    } finally {
      release();
      await request.delete(endpoint(owner, id));
    }
  });

  test(`${owner} Card wands use unsaved seeds and references, update one draft field, and persist on Save`, async ({
    page,
    request,
  }, info) => {
    const id = await createEntity(request, owner, `Wand ${owner} ${info.testId}`);
    const sent: GenerationRequest[] = [];
    await page.route(`**${endpoint(owner, id)}/card-field/generate`, async (route) => {
      const body = route.request().postDataJSON() as GenerationRequest;
      sent.push(body);
      await route.fulfill({ json: { text: generatedText(body.field) } });
    });
    try {
      await prepare(page);
      const editor = await openCard(page, owner, id);
      const saved = await storedDraft(request, owner, id);
      const draft: Draft = { ...saved };
      draft.name = `${saved.name} unsaved name`;
      await editor
        .getByPlaceholder(owner === "character" ? "Character name" : "Persona name", { exact: true })
        .first()
        .fill(draft.name);
      for (const [field, label] of FIELDS) {
        const input = fieldInput(editor, label);
        await expect(input).toHaveAttribute("placeholder", new RegExp(HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        const button = wand(editor, label);
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeVisible();
        await expect(button).toHaveAttribute("title", /100[–-]300/);
        await expect(button).toHaveText("");
        await expect(button.locator("svg")).toHaveCount(1);
        const box = (await button.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
        draft[field] = `${label}: smart, scientist, handsome; keep this unsaved seed.`;
        await input.fill(draft[field]);
      }

      for (const theme of ["dark", "light"] as const) {
        await page.evaluate(async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        }, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await wand(editor, "Summary").scrollIntoViewIfNeeded();
        await capture(page, info, `${owner}-card-wands-${theme}`);
        await wand(editor, "Example Dialogue").scrollIntoViewIfNeeded();
        await capture(page, info, `${owner}-dialogue-wand-${theme}`);
      }

      for (const [field, label] of FIELDS) {
        const expectedRequest = { ...draft };
        await wand(editor, label).click();
        await expect(fieldInput(editor, label)).toHaveValue(generatedText(field));
        expect(sent.at(-1)).toMatchObject({ field, card: expectedRequest });
        draft[field] = generatedText(field);
        await expectDraft(editor, draft);
        // Calling a wand never writes the saved character/persona, even after seven successful responses.
        expect(await storedDraft(request, owner, id)).toEqual(saved);
      }
      expect(sent).toHaveLength(7);
      expect(draft.summary.length).toBeGreaterThan(500);
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(() => storedDraft(request, owner, id)).toEqual(draft);
      await page.reload();
      await expectDraft(await openCard(page, owner, id), draft);
    } finally {
      await request.delete(endpoint(owner, id));
    }
  });

  test(`${owner} Card generation preserves failures, later typing, and a newly opened card`, async ({
    page,
    request,
  }, info) => {
    const id = await createEntity(request, owner, `Protected ${owner} ${info.testId}`);
    const otherId = await createEntity(request, owner, `Other ${owner} ${info.testId}`);
    let nextRequest!: (route: Route) => Promise<void>;
    let releasePending: (() => void) | undefined;
    await page.route(`**${endpoint(owner, id)}/card-field/generate`, (route) => nextRequest(route));
    try {
      await prepare(page);
      const editor = await openCard(page, owner, id);
      const appearance = fieldInput(editor, "Appearance");
      await appearance.fill("Keep my original appearance.");
      nextRequest = (route) => route.fulfill({ status: 503, json: { error: "Fixture generation unavailable" } });
      await wand(editor, "Appearance").click();
      await expect(page.getByText("Fixture generation unavailable", { exact: true })).toBeVisible();
      await expect(appearance).toHaveValue("Keep my original appearance.");
      await expect(wand(editor, "Appearance")).toBeEnabled();

      let release!: () => void;
      let arrived!: () => void;
      let held = new Promise<void>((resolve) => (release = resolve));
      releasePending = release;
      let started = new Promise<void>((resolve) => (arrived = resolve));
      let generationRequest!: Request;
      nextRequest = async (route) => {
        generationRequest = route.request();
        arrived();
        await held;
        await route.fulfill({ json: { text: generatedText("appearance") } });
      };
      await wand(editor, "Appearance").click();
      await started;
      await appearance.fill("Newer handwritten appearance while AI was working.");
      release();
      await expect(wand(editor, "Appearance")).toBeEnabled();
      await expect(appearance).toHaveValue("Newer handwritten appearance while AI was working.");

      held = new Promise<void>((resolve) => (release = resolve));
      releasePending = release;
      started = new Promise<void>((resolve) => (arrived = resolve));
      await wand(editor, "Appearance").click();
      await started;
      // Cancelling the old request on navigation is as safe as discarding its late result.
      const responseFinished = generationRequest.response();
      const other = await openCard(page, owner, otherId);
      release();
      await (await responseFinished)?.finished();
      await expect(fieldInput(other, "Appearance")).toHaveValue("");
      await expect(other.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
      // Existing editor navigation saves the latest author-written draft before leaving.
      // The late generation must never replace it with the AI response.
      expect((await storedDraft(request, owner, id)).appearance).toBe(
        "Newer handwritten appearance while AI was working.",
      );
      expect((await storedDraft(request, owner, otherId)).appearance).toBe("");
    } finally {
      releasePending?.();
      await Promise.all([request.delete(endpoint(owner, id)), request.delete(endpoint(owner, otherId))]);
    }
  });
}

test("persona summary, creator notes and dialogue stay searchable in the panel and library", async ({
  page,
  request,
}, info) => {
  const token = `dialoguesearchonly${info.testId.replace(/[^a-z]/giu, "")}`;
  const summaryToken = `summarysearchonly${info.testId.replace(/[^a-z]/giu, "")}`;
  const creatorNotesToken = `creatornotessearchonly${info.testId.replace(/[^a-z]/giu, "")}`;
  const name = `Dialogue library ${info.testId}`;
  const tag = `dialogue-tag-${info.testId}`;
  const response = await request.post(endpoint("persona"), {
    data: {
      name,
      summary: summaryToken,
      creatorNotes: creatorNotesToken,
      mes_example: `{{user}}: ${token}`,
      tags: [tag],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const id = ((await response.json()) as { id: string }).id;
  try {
    await prepare(page);
    await clickTopbarPanel(page, "personas");
    const panelSearch = page.getByPlaceholder("Search personas", { exact: true });
    for (const query of [summaryToken, token, creatorNotesToken]) {
      await panelSearch.fill(`missing${query}`);
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
      await panelSearch.fill(query);
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: /^Tags/u }).click();
    await page.getByRole("button", { name: tag, exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open Library", exact: true }).click();
    const library = page.locator('[data-component="CharacterLibraryView"]');
    const librarySearch = library.getByPlaceholder("Search personas", { exact: true });
    for (const query of [summaryToken, creatorNotesToken, token]) {
      await librarySearch.fill(`missing${query}`);
      await expect(library.getByRole("button").filter({ hasText: name })).toHaveCount(0);
      await librarySearch.fill(query);
      await expect(library.getByRole("button").filter({ hasText: name }).first()).toBeVisible();
    }
    await library.getByRole("button").filter({ hasText: name }).first().click();
    const heading = library.getByRole("heading", { name: "Example Dialogue", exact: true });
    await expect(heading).toBeVisible();
    await expect(heading.locator("..")).toContainText(token);
  } finally {
    await request.delete(endpoint("persona", id));
  }
});
