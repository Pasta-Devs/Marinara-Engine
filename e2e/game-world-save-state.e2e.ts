import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkWorldBrief,
  compileGameWorld,
  parseWorldKit,
  worldFile,
  worldKitFile,
  worldSnapshot,
} from "@marinara-engine/shared";
import { downloadExport } from "./export-save.js";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

/**
 * Worlds kept as they were made (worldgen W11), in a new game's setup: a world file another generator made
 * comes in with its snapshot, which its Download keeps; another kit makes a new world with this generator.
 */

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const parsedKit = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "high_fantasy")!);
if (!parsedKit.ok) throw new Error("The high fantasy kit does not read");
const kit = parsedKit.kit;
const read = checkWorldBrief(kit, { briefVersion: 1, premise: "The river provinces quarrel over the succession." });
if (!read.ok) throw new Error(read.issues.join("; "));
const world = {
  seed: 5151,
  generatorVersion: WORLD_GENERATOR_VERSION,
  grounding: "expand" as const,
  brief: read.brief,
};
// As an older Engine made it: another generator's recipe, and the world as that generator laid it out.
const older = { ...world, generatorVersion: WORLD_GENERATOR_VERSION + 1 };
const snapshot = {
  ...worldSnapshot({ kit, ...world, world: compileGameWorld({ kit, ...world }) }),
  generatorVersion: WORLD_GENERATOR_VERSION + 1,
};
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

test("a world file another generator made comes into setup as it was made, until another kit is picked", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const wizard = await mountWizard(page, testInfo);
  const kitLabel = wizard.getByText("Setting kit", { exact: true });
  const heading = wizard.getByRole("heading", { level: 4 }).first();
  for (let step = 0; step < 6 && !(await kitLabel.isVisible()); step++) {
    const previous = await heading.innerText();
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(heading).not.toHaveText(previous);
  }
  await wizard
    .getByLabel("Import a world file", { exact: true })
    .setInputFiles(file(worldFile("Old Riverlands", kit, older, null, snapshot), "old.world.json"));
  await expect(wizard.getByText("Imported the world Old Riverlands with its setting kit.")).toBeVisible();
  await expect(wizard.getByText("Your world", { exact: true })).toBeVisible();
  // The imported world is the one the game will have: its kit chosen and its seed in the field.
  await expect(wizard.getByRole("button", { name: /^High fantasy/u })).toHaveAttribute("aria-pressed", "true");
  await expect(wizard.getByLabel("World seed", { exact: true })).toHaveValue("5151");
  await page.screenshot({ path: testInfo.outputPath("old-world-imported.png") });
  // Its Download keeps it as it was made: the older generator's recipe and its snapshot.
  const kept = await download(page, () =>
    wizard.getByRole("button", { name: "Download this world", exact: true }).click(),
  );
  expect(kept.file.world.generatorVersion).toBe(WORLD_GENERATOR_VERSION + 1);
  expect(kept.file.snapshot).toEqual(JSON.parse(JSON.stringify(snapshot)));

  // Another kit makes a new world with this Engine's generator.
  await wizard
    .getByLabel("Import a kit file", { exact: true })
    .setInputFiles(file(worldKitFile({ ...kit, label: "River kit" }), "river.worldkit.json"));
  await expect(wizard.getByText("Imported the setting kit River kit.")).toBeVisible();
  const remade = await download(page, () =>
    wizard.getByRole("button", { name: "Download this world", exact: true }).click(),
  );
  expect(remade.file.world.generatorVersion).toBe(WORLD_GENERATOR_VERSION);
  expect(remade.file.snapshot.generatorVersion, "a snapshot of the new world, made now").toBe(WORLD_GENERATOR_VERSION);
  expect(remade.file.snapshot.kit.label).toBe("River kit");
});
