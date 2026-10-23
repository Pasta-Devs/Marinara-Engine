import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  parseWorldKit,
  type ExperienceMapPack,
} from "@marinara-engine/shared";
import { openGame } from "./game-ruleset-fight-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

/**
 * Experience map packs (worldgen W9e), on screen: with an Experience that ships one turned on, the setup
 * wizard shows its kit as set and offers only its maps; the game is made with the pick; turned off, the
 * player's own choices come back. A game started with a pack draws its overworld with the pack's tiles.
 */

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const parsed = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "high_fantasy")!);
if (!parsed.ok) throw new Error("The high fantasy kit does not read");
const kit = { ...parsed.kit, id: "riverlands", label: "Riverlands kit" };
const read = checkWorldBrief(kit, { briefVersion: 1, premise: "The river provinces quarrel." });
if (!read.ok) throw new Error(read.issues.join("; "));
const worldOf = (seed: number) => ({
  seed,
  generatorVersion: WORLD_GENERATOR_VERSION,
  grounding: "expand" as const,
  brief: read.brief,
});
const rows = (char: string) => Array.from({ length: 16 }, () => char.repeat(16));
const renamed = compileGameWorld({ kit, ...worldOf(10) }).places[0]!;
const downriver = {
  ...worldOf(10),
  edits: { editsVersion: 1 as const, places: [{ id: renamed.id, name: "Newhaven" }] },
};
// Its story (worldgen W10) is part of the map: the game takes it with the world.
const downriverStory = checkStoryScript(
  { kit, ...downriver, world: compileGameWorld({ kit, ...downriver }) },
  { storyVersion: 1, events: [{ id: "home", when: { on: "arrive", place: renamed.id }, do: [{ tell: "Home." }] }] },
);
if (!downriverStory.ok) throw new Error(downriverStory.issues.join("; "));
const pack: ExperienceMapPack = {
  packageId: "mapfixture",
  name: "River Experience",
  kit,
  worlds: [
    { path: "upriver.world.json", name: "Upriver", world: worldOf(9) },
    { path: "downriver.world.json", name: "Downriver", world: downriver, story: downriverStory.story },
  ],
  tiles: {
    tilePackVersion: 1,
    id: "riverlands-tiles",
    name: "Riverlands tiles",
    family: "fantasy",
    version: 1,
    palette: ["#224466"],
    tiles: { grass: [rows("0")] },
  },
};
const experience = {
  id: "mapfixture",
  version: "1.0.0",
  status: "active",
  readiness: "ready",
  manifest: {
    schemaVersion: 2,
    id: "mapfixture",
    name: "River Experience",
    version: "1.0.0",
    capabilityApi: { major: 1, minor: 72 },
    kind: ["agent"],
    entrypoints: { client: "client.mjs" },
    contributions: {
      slots: ["game-surface"],
      gameSurface: {
        setup: {},
        mapPack: {
          kit: "kit.worldkit.json",
          worlds: pack.worlds.map((world) => world.path),
          tiles: "tiles.tilepack.json",
        },
      },
    },
    permissions: ["ui"],
  },
};
const clientScript = `if (!customElements.get('marinara-capability-mapfixture')) customElements.define('marinara-capability-mapfixture', class extends HTMLElement {});`;

async function mountWizard(page: Page, testInfo: TestInfo): Promise<Locator> {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [experience] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/*/client?*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: clientScript }),
  );
  await page.route("**/api/game/experience-map-pack/mapfixture", (route) => route.fulfill({ json: { mapPack: pack } }));
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
          onComplete: (config: unknown) => {
            const output = document.createElement("output");
            output.setAttribute("data-testid", "wizard-result");
            output.textContent = JSON.stringify({ config });
            document.body.append(output);
          },
        }),
      ),
    );
  });
  const wizard = page.locator('[data-component="GameSetupWizard"]');
  await expect(wizard).toBeVisible();
  return wizard;
}

test("an Experience's map pack sets the kit and offers only its maps, and lets go when it is off", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const wizard = await mountWizard(page, testInfo);
  await wizard
    .locator("select")
    .filter({ has: page.locator('option[value="wizard-connection"]') })
    .first()
    .selectOption("wizard-connection");
  await wizard.getByRole("button", { name: "Show", exact: true }).click();
  await wizard.getByRole("switch", { name: "River Experience", exact: true }).click();
  const heading = wizard.getByRole("heading", { level: 4 }).first();
  const go = async (direction: "Next" | "Back") => {
    const previous = await heading.innerText();
    await wizard.getByRole("button", { name: direction, exact: true }).click();
    await expect(heading).not.toHaveText(previous);
  };
  const kitLabel = wizard.getByText("Setting kit", { exact: true });
  for (let step = 0; step < 6 && !(await kitLabel.isVisible()); step++) await go("Next");

  // Set by the pack: no chooser, no import, its maps to pick from.
  await expect(wizard.getByText("Riverlands kit", { exact: true })).toBeVisible();
  await expect(wizard.getByText("River Experience sets this setting kit with its map pack.")).toBeVisible();
  await expect(wizard.getByRole("button", { name: "Import a world file", exact: true })).toHaveCount(0);
  await expect(wizard.getByRole("checkbox", { name: /Make a world/ })).toHaveCount(0);
  await expect(wizard.getByRole("radio", { name: "Upriver", exact: true })).toBeChecked();
  await wizard.getByRole("radio", { name: "Downriver", exact: true }).check();
  await wizard.getByText("Riverlands kit", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("map-pack-locked.png") });

  // Turned off, the player's own kit chooser comes back; on again, the pack and the map picked return.
  const toggle = wizard.getByRole("switch", { name: "River Experience", exact: true });
  const show = wizard.getByRole("button", { name: "Show", exact: true });
  const toExperience = async () => {
    for (let step = 0; step < 6 && !(await toggle.isVisible()) && !(await show.isVisible()); step++) await go("Back");
    if (await show.isVisible()) await show.click();
  };
  await toExperience();
  await toggle.click();
  for (let step = 0; step < 6 && !(await kitLabel.isVisible()); step++) await go("Next");
  await expect(wizard.getByRole("button", { name: "Import a world file", exact: true })).toBeVisible();
  await expect(wizard.getByText("Riverlands kit", { exact: true })).toHaveCount(0);
  await toExperience();
  await toggle.click();
  for (let step = 0; step < 6 && !(await kitLabel.isVisible()); step++) await go("Next");
  await expect(wizard.getByRole("radio", { name: "Downriver", exact: true })).toBeChecked();

  // Started: the game is made with the pack's kit and the map picked.
  const start = wizard.getByRole("button", { name: "Create world", exact: true });
  for (let step = 0; step < 6 && !(await start.isVisible()); step++) await go("Next");
  await start.click();
  const result = JSON.parse((await page.getByTestId("wizard-result").textContent()) ?? "{}") as {
    config: { gameExperienceId?: string; worldKit?: unknown; world?: unknown; story?: unknown };
  };
  // Exactly the pack's kit and world, its hand edits too: what the Engine's lock compares them against.
  expect(result.config.gameExperienceId).toBe("mapfixture");
  expect(result.config.worldKit).toEqual(pack.kit);
  expect(result.config.world).toEqual(downriver);
  expect(result.config.story).toEqual(downriverStory.story);
});

test("an Experience whose map pack Marinara cannot read cannot start a game, and says why", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const wizard = await mountWizard(page, testInfo);
  // Registered last, so it answers instead of the good pack.
  await page.route("**/api/game/experience-map-pack/mapfixture", (route) =>
    route.fulfill({ status: 400, json: { error: "upriver.world.json was made with another kit" } }),
  );
  await wizard
    .locator("select")
    .filter({ has: page.locator('option[value="wizard-connection"]') })
    .first()
    .selectOption("wizard-connection");
  await wizard.getByRole("button", { name: "Show", exact: true }).click();
  await wizard.getByRole("switch", { name: "River Experience", exact: true }).click();
  const heading = wizard.getByRole("heading", { level: 4 }).first();
  const next = async () => {
    const previous = await heading.innerText();
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(heading).not.toHaveText(previous);
  };
  const kitLabel = wizard.getByText("Setting kit", { exact: true });
  for (let step = 0; step < 6 && !(await kitLabel.isVisible()); step++) await next();
  await expect(
    wizard.getByText("River Experience cannot start a game: upriver.world.json was made with another kit"),
  ).toBeVisible();
  // Neither the pack's maps nor the player's own kit chooser: nothing to start with.
  await expect(wizard.getByRole("radio", { name: "Upriver", exact: true })).toHaveCount(0);
  await expect(wizard.getByRole("button", { name: "Import a world file", exact: true })).toHaveCount(0);
  const start = wizard.getByRole("button", { name: "Create world", exact: true });
  for (let step = 0; step < 6 && !(await start.isVisible()); step++) await next();
  await expect(start).toBeDisabled();
  await expect(wizard.getByText("Marinara could not read this Experience's map pack, so the Experience cannot start a game.")).toBeVisible();
});

test("a game started with a map pack draws its overworld with the pack's tiles", async ({ page, request }) => {
  test.setTimeout(120_000);
  // Answered late, so the overworld is up while the pack is still loading: it waits, never drawing the
  // setting family's tiles in the meantime.
  await page.route("**/api/game/experience-map-pack/mapfixture", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.fulfill({ json: { mapPack: pack } });
  });
  const builtIn: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/game-tile-packs/builtin/")) builtIn.push(req.url());
  });
  const created = await request.post("/api/chats", { data: { name: "River game", mode: "game", characterIds: [] } });
  const chatId = ((await created.json()) as { id: string }).id;
  try {
    const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameId: `map-pack-${chatId}`,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
        enableAgents: false,
        enableTools: false,
        gameWorldKit: kit,
        gameWorld: worldOf(10),
        gameMapPack: { packageId: "mapfixture" },
      },
    });
    expect(meta.ok(), await meta.text()).toBeTruthy();
    const packRead = page.waitForRequest((req) => req.url().includes("/api/game/experience-map-pack/mapfixture"));
    await openGame(page, chatId);
    await expect(page.getByRole("region", { name: "Overworld", exact: true })).toBeVisible({ timeout: 40_000 });
    await packRead;
    // Drawn with its own tiles (its grass is #224466), and the setting family's built-in pack never asked for.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('[aria-label="Overworld"] canvas');
          const ctx = canvas?.getContext("2d");
          if (!canvas || !ctx) return false;
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let at = 0; at < data.length; at += 4) {
            if (data[at] === 0x22 && data[at + 1] === 0x44 && data[at + 2] === 0x66) return true;
          }
          return false;
        }),
      )
      .toBe(true);
    expect(builtIn).toEqual([]);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});
