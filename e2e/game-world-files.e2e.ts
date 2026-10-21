import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  parseWorldKit,
  worldFile,
  worldKitFile,
} from "@marinara-engine/shared";
import { openChatTool } from "./chat-settings-tools.js";
import { downloadExport } from "./export-save.js";
import { openGame } from "./game-ruleset-fight-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

/**
 * Kit and world share files (worldgen W9d), on screen: a world file is imported into a new game's setup
 * with its setting kit, hand edits and story (W10), the edits and story stay while they fit and are left out once the seed
 * changes, the world and the kit download again, a file that does not read is refused, and a game's
 * world downloads from its World tab.
 */

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const parsedKit = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "high_fantasy")!);
if (!parsedKit.ok) throw new Error("The high fantasy kit does not read");
const kit = parsedKit.kit;
const read = checkWorldBrief(kit, {
  briefVersion: 1,
  premise: "The river provinces quarrel over the succession.",
  places: [{ name: "Ashford", layer: "settlement", size: "city", tags: [] }],
});
if (!read.ok) throw new Error(read.issues.join("; "));
const world = {
  seed: 4242,
  generatorVersion: WORLD_GENERATOR_VERSION,
  grounding: "expand" as const,
  brief: read.brief,
};
const ashford = compileGameWorld({ kit, ...world }).places.find((place) => place.name === "Ashford")!;
const edits = { editsVersion: 1 as const, places: [{ id: ashford.id, name: "Newhaven" }] };
// Its story (worldgen W10): it names Ashford by id, so it is the world's own.
const checkedStory = checkStoryScript(
  { kit, ...world, edits, world: compileGameWorld({ kit, ...world, edits }) },
  {
    storyVersion: 1,
    events: [{ id: "gates", when: { on: "arrive", place: ashford.id }, do: [{ cutscene: "gates" }] }],
    cutscenes: [{ id: "gates", kind: "pages", pages: [{ text: "The gates creak open." }] }],
  },
);
if (!checkedStory.ok) throw new Error(checkedStory.issues.join("; "));
const story = checkedStory.story;
const file = (value: unknown, name: string) => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(value)),
});

/** A fresh new-game setup wizard, on its own. */
async function mountWizard(page: Page, testInfo: TestInfo): Promise<Locator> {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connections", (route) =>
    route.fulfill({
      json: [
        { id: "wizard-connection", name: "Wizard connection", provider: "custom", model: "fixture", isDefault: true },
      ],
    }),
  );
  await page.route("**/api/lorebooks", (route) => route.fulfill({ json: [] }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
  });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What shall we cook tonight?", exact: true })).toBeVisible({
    timeout: 40_000,
  });
  await prepareViteFixtureDependencies(page);
  await page.evaluate(async () => {
    const { GameSetupWizard } = await import("/src/components/game/GameSetupWizard.tsx" as string);
    const dependencyUrl = window.__viteFixtureDependencyUrl;
    const { default: React } = await import(dependencyUrl("react"));
    const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
    const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
    const container = document.createElement("div");
    document.body.append(container);
    ReactDOM.createRoot(container).render(
      React.createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        React.createElement(GameSetupWizard, {
          activeChatId: "wizard-chat",
          isNewGame: true,
          chatMetadata: {},
          onSetupError: () => false,
          onCancel: () => {},
          isLoading: false,
          isDraftingMap: false,
          isLinkingSharedWorld: false,
          characters: [],
          onComplete: () => {},
        }),
      ),
    );
  });
  const wizard = page.locator('[data-component="GameSetupWizard"]');
  await expect(wizard).toBeVisible();
  return wizard;
}

// On iPhone an export offers a Save file toast instead of a download (#7115); downloadExport taps it.
const download = async (page: Page, click: () => Promise<void>) => {
  const saved = await downloadExport(page, click);
  return { name: saved.suggestedFilename(), file: JSON.parse(await readFile((await saved.path())!, "utf8")) };
};

test("a world file comes into a new game's setup with its kit and hand edits, and downloads again", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const wizard = await mountWizard(page, testInfo);
  // On to the step with the setting kit.
  const kitLabel = wizard.getByText("Setting kit", { exact: true });
  const heading = wizard.getByRole("heading", { level: 4 }).first();
  for (let step = 0; step < 6 && !(await kitLabel.isVisible()); step++) {
    const previous = await heading.innerText();
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(heading).not.toHaveText(previous);
  }
  await expect(kitLabel).toBeVisible();

  // A file that is not one is refused with the reason.
  await wizard.getByLabel("Import a world file", { exact: true }).setInputFiles(file(worldKitFile(kit), "kit.json"));
  await expect(wizard.getByRole("alert")).toContainText("setting kit file, not a world file");

  // The world file: its kit chosen, its world made, its hand edits kept.
  await wizard
    .getByLabel("Import a world file", { exact: true })
    .setInputFiles(file(worldFile("Riverlands", kit, { ...world, edits }, story), "riverlands.world.json"));
  await expect(wizard.getByText("Imported the world Riverlands with its setting kit.")).toBeVisible();
  await expect(wizard.getByText("Your world", { exact: true })).toBeVisible();
  // The imported world is the one the game will have: its kit chosen and its seed in the field.
  await expect(wizard.getByRole("button", { name: /^High fantasy/u })).toHaveAttribute("aria-pressed", "true");
  await expect(wizard.getByLabel("World seed", { exact: true })).toHaveValue("4242");
  await expect(wizard.getByText("This world has hand edits.", { exact: false })).toBeVisible();
  await expect(wizard.getByText("This world has a story", { exact: false })).toBeVisible();
  await wizard.getByRole("button", { name: "Import a world file", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("world-file-imported.png") });
  const downloadedWorld = await download(page, () =>
    wizard.getByRole("button", { name: "Download this world", exact: true }).click(),
  );
  expect(downloadedWorld.name).toMatch(/\.world\.json$/);
  expect([downloadedWorld.file.format, downloadedWorld.file.world.seed, downloadedWorld.file.world.edits]).toEqual([
    "marinara-world",
    4242,
    edits,
  ]);
  expect(downloadedWorld.file.story, "the world's story downloads with it").toEqual(story);
  const downloadedKit = await download(page, () =>
    wizard.getByRole("button", { name: "Download this kit", exact: true }).click(),
  );
  expect([downloadedKit.name.endsWith(".worldkit.json"), downloadedKit.file.format, downloadedKit.file.kit.id]).toEqual(
    [true, "marinara-world-kit", kit.id],
  );

  // Another seed: the hand edits were made for this one, so they are left out.
  const seed = wizard.getByLabel("World seed", { exact: true });
  // Save file restores focus while its toast exits; let that finish before editing the seed.
  await expect(
    page.locator("[data-sonner-toast]").filter({
      has: page.getByRole("button", { name: "Save file", exact: true, includeHidden: true }),
    }),
  ).toHaveCount(0);
  await seed.scrollIntoViewIfNeeded();
  await seed.click();
  await expect(seed).toBeFocused();
  await seed.fill("4243");
  await expect(seed).toHaveValue("4243");
  await expect(wizard.getByText("so they are left out now", { exact: false })).toBeVisible();
  await expect(wizard.getByText("so it is left out now", { exact: false })).toBeVisible();
  const reseeded = await download(page, () =>
    wizard.getByRole("button", { name: "Download this world", exact: true }).click(),
  );
  expect([reseeded.file.world.seed, reseeded.file.world.edits, reseeded.file.story]).toEqual([
    4243,
    undefined,
    undefined,
  ]);

  // A kit file on its own.
  await wizard
    .getByLabel("Import a kit file", { exact: true })
    .setInputFiles(file(worldKitFile({ ...kit, label: "River kit" }), "river.worldkit.json"));
  await expect(wizard.getByText("Imported the setting kit River kit.")).toBeVisible();
});

test("a world from the library comes into a new game's setup with its kit, hand edits and story", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  // A world kept outside any game (worldgen W9f).
  const kept = await request.post("/api/game-worlds/import", {
    data: { text: JSON.stringify(worldFile("Library Riverlands", kit, { ...world, edits }, story)) },
  });
  expect(kept.ok(), await kept.text()).toBeTruthy();
  const libraryId = ((await kept.json()) as { world: { id: string } }).world.id;
  try {
    const wizard = await mountWizard(page, testInfo);
    const kitLabel = wizard.getByText("Setting kit", { exact: true });
    const heading = wizard.getByRole("heading", { level: 4 }).first();
    for (let step = 0; step < 6 && !(await kitLabel.isVisible()); step++) {
      const previous = await heading.innerText();
      await wizard.getByRole("button", { name: "Next", exact: true }).click();
      await expect(heading).not.toHaveText(previous);
    }
    const picker = wizard.getByRole("combobox", { name: "Your worlds", exact: true });
    await expect(picker.locator(`option[value="${libraryId}"]`)).toHaveCount(1);
    await picker.selectOption(libraryId);
    await expect(wizard.getByText("Imported the world Library Riverlands with its setting kit.")).toBeVisible();
    await expect(wizard.getByText("This world has hand edits.", { exact: false })).toBeVisible();
    await expect(wizard.getByText("This world has a story", { exact: false })).toBeVisible();
    const downloaded = await download(page, () =>
      wizard.getByRole("button", { name: "Download this world", exact: true }).click(),
    );
    expect([downloaded.file.world.seed, downloaded.file.world.edits, downloaded.file.story]).toEqual([
      4242,
      edits,
      story,
    ]);
  } finally {
    await request.delete(`/api/game-worlds/${libraryId}`);
  }
});

test("a game's world downloads from its World tab, hand edits and all", async ({ page, request }) => {
  test.setTimeout(120_000);
  const created = await request.post("/api/chats", { data: { name: "Riverlands", mode: "game", characterIds: [] } });
  const chatId = ((await created.json()) as { id: string }).id;
  try {
    const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameId: `world-file-${chatId}`,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
        enableAgents: false,
        enableTools: false,
        gameWorldView: "scene",
        gameWorldKit: kit,
        gameWorld: { ...world, edits },
        gameStory: story,
      },
    });
    expect(meta.ok(), await meta.text()).toBeTruthy();
    await openGame(page, chatId);
    // The Session window's journal, opened from its bubble (or the phone's Chat tools menu).
    await expect(
      page.locator('.mari-window-bubble[data-window="control:session"], [data-chat-tools-menu-button]').first(),
    ).toBeVisible({ timeout: 40_000 });
    const session = await openChatTool(page, "control:session");
    await session.getByRole("button", { name: "Journal", exact: true }).click();
    await page.getByRole("button", { name: "World", exact: true }).click();
    const downloaded = await download(page, () =>
      page.getByRole("button", { name: "Download the world", exact: true }).click(),
    );
    expect(downloaded.name).toBe("Riverlands.world.json");
    expect([
      downloaded.file.name,
      downloaded.file.kit.id,
      downloaded.file.world.seed,
      downloaded.file.world.edits,
    ]).toEqual(["Riverlands", kit.id, 4242, edits]);
    expect(downloaded.file.story, "and its story").toEqual(story);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});
